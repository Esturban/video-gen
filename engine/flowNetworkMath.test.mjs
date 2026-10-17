import assert from "node:assert/strict";
import test from "node:test";
import {
  TEXT_FLOOR, WAIT_OPACITY, controlPoint, dotAt, edgeCurve, edgeWidth, fillVars, frameAt, pickLayout, quadAt, relax, splitQuad, validateConfig, window01, wrapText,
} from "./flowNetworkMath.js";

const LAYOUT = (size, zone) => ({
  size, zone, r: 60,
  anchors: { A: [0.3, 0.5], B: [0.7, 0.5], C: [0.5, 0.15] },
  wait: { A: [0, 0.5], B: [1, 0.5], C: [0.5, 0] },
  steps: { focus: { A: [0.5, 0.5] } },
  caption: { x: 64, y: 700, w: 800, headPx: 40, chipPx: 28, sourceY: 1000, sourcePx: 26, center: { y: 400, align: "middle" } },
  notes: { footer: { x: 64, y: 1040, px: 24 } },
});
export const CFG = {
  vars: { fig: { value: "~215bp", asOf: "Aug 9, 2026" } },
  nodes: [{ id: "A", appear: 0, enter: 1 }, { id: "B", appear: 0.3, enter: 1 }, { id: "C", appear: 0.6, enter: 4, lines: ["Line", "two"] }],
  edges: [
    { id: "ab", from: "A", to: "B", style: "solid", usd: 250e9, at: 1.5, value: "$250B", kind: "compute" },
    { id: "ca", from: "C", to: "A", style: "dashed", usd: 13e9, at: 4.5, open: true, value: "$13B", kind: "equity", chip: "chip" },
  ],
  steps: [
    { name: "start", at: 1, dur: 0.9 },
    { name: "grow", at: 5, dur: 0.7 },
    { name: "focus", at: 7, dur: 0.7, keep: ["A"], dim: 0.3, scale: { A: 1.5 }, recede: 0.5 },
    { name: "back", at: 9, dur: 0.7 },
  ],
  glows: [{ ids: ["A"], kind: "warm", at: 6, until: 10 }, { ids: ["B"], kind: "cool", at: 6, until: 10 }],
  ghosts: [{ id: "A", at: 7.5, until: 9, scale: 1.5 }],
  ripples: [{ ids: ["B"], at: 9, until: 11 }],
  captions: [
    { at: 0, until: 4, lines: [{ text: "Who owes whom?" }, { text: "Commitments, not cash.", delay: 1, role: "body" }], source: "Source: test" },
    { at: 4, until: 8, lines: [{ text: "Insure it" }], big: { text: "{fig.value}", near: "A", delay: 0.5 }, chip: "a b c", source: "CDS, {fig.asOf}" },
    { at: 8, until: 12, center: true, lines: [{ text: "Research framing." }] },
  ],
  notes: [{ id: "footer", text: "Research framing, not investment advice", at: 6, until: 12 }],
  layouts: { wide: LAYOUT([1920, 1080], [64, 64, 1856, 800]), tall: LAYOUT([1080, 1920], [64, 200, 1016, 1250]) },
};

test("pickLayout takes the nearest aspect and scales to the frame", () => {
  assert.equal(pickLayout(CFG.layouts, 1920, 1080).name, "wide");
  assert.equal(pickLayout(CFG.layouts, 1080, 1920).name, "tall");
  assert.equal(pickLayout(CFG.layouts, 3840, 2160).s, 2);
  assert.throws(() => pickLayout({}, 10, 10));
  assert.throws(() => pickLayout(CFG.layouts, 0, 10));
});

test("edgeWidth is log scaled between the bounds", () => {
  assert.equal(edgeWidth(1e9, 1e9, 1e11, 2, 12), 2);
  assert.equal(edgeWidth(1e11, 1e9, 1e11, 2, 12), 12);
  assert.ok(Math.abs(edgeWidth(1e10, 1e9, 1e11, 2, 12) - 7) < 1e-9);
  assert.throws(() => edgeWidth(0, 1, 2, 1, 2));
});

test("splitQuad keeps the start, lands on the curve, and the whole split is the curve", () => {
  const p0 = [0, 0]; const c = [50, 100]; const p1 = [100, 0];
  const half = splitQuad(p0, c, p1, 0.5);
  assert.deepEqual(half[0], p0);
  assert.deepEqual(half[2], quadAt(p0, c, p1, 0.5));
  assert.deepEqual(splitQuad(p0, c, p1, 1)[2], p1);
  assert.deepEqual(splitQuad(p0, c, p1, 2)[2], p1);
});

test("edgeCurve starts on the payer rim and stops short of the payee rim", () => {
  const { p0, p1 } = edgeCurve([0, 0], 10, [100, 0], 20, 0, 5);
  assert.ok(Math.abs(p0[0] - 10) < 1e-9 && Math.abs(p0[1]) < 1e-9);
  assert.ok(Math.abs(p1[0] - 75) < 1e-9);
  const bent = controlPoint([0, 0], [100, 0], 0.2);
  assert.ok(bent[1] < 0, "positive bend goes up-left of a rightward edge on screen");
});

test("relax is deterministic, stays in the box and pushes overlapping circles apart", () => {
  const nodes = [{ id: "a", x: 100, y: 100, r: 40 }, { id: "b", x: 110, y: 100, r: 40 }, { id: "c", x: 500, y: 400, r: 40 }];
  const box = { x0: 0, y0: 0, x1: 600, y1: 500 };
  const one = relax(nodes, [["a", "c"]], box);
  const two = relax(nodes, [["a", "c"]], box);
  assert.deepEqual(one, two);
  const d = Math.hypot(one.a[0] - one.b[0], one.a[1] - one.b[1]);
  assert.ok(d >= 80 + 28 - 2, `overlap left: ${d}`);
  for (const p of Object.values(one)) assert.ok(p[0] >= 40 && p[0] <= 560 && p[1] >= 40 && p[1] <= 460);
  const free = relax(nodes, [], box);
  const pulled = relax(nodes, [["a", "c"]], box);
  assert.ok(Math.hypot(pulled.c[0] - pulled.a[0], pulled.c[1] - pulled.a[1]) < Math.hypot(free.c[0] - free.a[0], free.c[1] - free.a[1]), "an edge pulls its ends closer");
});

test("wrapText wraps by estimated width and never drops words", () => {
  const lines = wrapText("one two three four five six", 200, 40);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(" "), "one two three four five six");
  assert.deepEqual(wrapText("", 100, 20), []);
  assert.throws(() => wrapText("x", 0, 10));
});

test("fillVars fills a figure and its date from one field, and throws on a typo", () => {
  assert.equal(fillVars("{fig.value} on {fig.asOf}", CFG.vars), "~215bp on Aug 9, 2026");
  assert.throws(() => fillVars("{fig.nope}", CFG.vars));
  assert.throws(() => fillVars("{fig}", CFG.vars));
});

test("window01 eases in and out and is 0 outside", () => {
  assert.equal(window01(-1, 0, 4), 0);
  assert.equal(window01(2, 0, 4), 1);
  assert.equal(window01(4, 0, 4), 0);
});

test("the money dot makes one trip then loops with faded ends", () => {
  assert.equal(dotAt(0, 1), null);
  assert.equal(dotAt(1, 1).u, 0);
  const loop = dotAt(1 + 0.8 + 1.6, 1);
  assert.ok(loop.u > 0.49 && loop.u < 0.51 && loop.op > 0.99);
  assert.ok(dotAt(1 + 0.8, 1).op < 1e-9);
  assert.ok(dotAt(1, 1).op < 1e-9, "the dot fades in on landing, it never pops");
  assert.ok(dotAt(1.1, 1).op > 0 && dotAt(1.1, 1).op < 1);
});

test("validateConfig names an unknown node or a missing anchor", () => {
  assert.throws(() => validateConfig({ ...CFG, edges: [{ id: "x", from: "A", to: "Z", style: "solid", usd: 1, at: 0 }] }), /"Z"/);
  assert.throws(() => validateConfig({ ...CFG, edges: [{ ...CFG.edges[0], style: "wavy" }] }), /style/);
  const noAnchor = { ...CFG, layouts: { wide: { ...CFG.layouts.wide, anchors: { A: [0, 0], B: [0, 0] } } } };
  assert.throws(() => validateConfig(noAnchor), /no anchor for C/);
  assert.throws(() => validateConfig({ ...CFG, steps: [{ name: "s", at: 0, dur: 0 }] }), /dur/);
  assert.throws(() => validateConfig({ ...CFG, steps: [] }), /at least one step/);
  assert.throws(() => validateConfig({ ...CFG, steps: [CFG.steps[1], CFG.steps[0]] }), /time order/);
  assert.throws(() => validateConfig({ ...CFG, nodes: [...CFG.nodes, { id: "A", enter: 1 }] }), /used twice/);
  assert.throws(() => validateConfig({ ...CFG, nodes: [{ id: "A" }, ...CFG.nodes.slice(1)] }), /enter/);
  assert.throws(() => validateConfig({ ...CFG, captions: [{ at: 0, until: 1, big: { text: "x", near: "Q" } }] }), /"Q"/);
  assert.throws(() => validateConfig({ ...CFG, glows: [{ ids: ["A"], kind: "hot", at: 0, until: 1 }] }), /warm or cool/);
  assert.throws(() => validateConfig({ ...CFG, edges: [{ ...CFG.edges[0], chip: " " }] }), /chip is empty/);
  assert.throws(() => validateConfig({ ...CFG, steps: [{ ...CFG.steps[0], scale: { A: 0 } }] }), /positive/);
  assert.throws(() => validateConfig({ nodes: [] }), /"edges" array/);
});

test("frameAt is pure: the same time gives the same frame whatever was drawn before", () => {
  const a = JSON.stringify(frameAt(CFG, 1920, 1080, 7.3));
  frameAt(CFG, 1920, 1080, 2);
  assert.equal(JSON.stringify(frameAt(CFG, 1920, 1080, 7.3)), a);
});

test("no node teleports: positions move less than a set distance per 60 fps frame across the whole timeline", () => {
  for (const [W, H] of [[1920, 1080], [1080, 1920]]) {
    let prev = frameAt(CFG, W, H, 0).nodes;
    for (let f = 1; f <= 12 * 60; f++) {
      const cur = frameAt(CFG, W, H, f / 60).nodes;
      for (let i = 0; i < cur.length; i++) {
        const d = Math.hypot(cur[i].x - prev[i].x, cur[i].y - prev[i].y);
        assert.ok(d < 40, `${cur[i].id} jumped ${d.toFixed(1)}px at frame ${f} (${W}x${H})`);
        assert.ok(Math.abs(cur[i].r - prev[i].r) < 6, `${cur[i].id} radius jumped at frame ${f}`);
      }
      prev = cur;
    }
  }
});

test("waiting nodes sit at 40 percent, light up on their first edge, and text never drops under the floor", () => {
  const early = frameAt(CFG, 1920, 1080, 1.2).nodes.find((n) => n.id === "A");
  assert.ok(Math.abs(early.op - WAIT_OPACITY) < 1e-9);
  const lit = frameAt(CFG, 1920, 1080, 3).nodes.find((n) => n.id === "A");
  assert.equal(lit.op, 1);
  const dimmed = frameAt(CFG, 1920, 1080, 8).nodes.find((n) => n.id === "B");
  assert.ok(dimmed.op < 0.35);
  assert.ok(dimmed.textOp >= TEXT_FLOOR - 1e-9);
  const shown = frameAt({ ...CFG, steps: CFG.steps.map((st) => (st.name === "focus" ? { ...st, dim: 0.4 } : st)) }, 1920, 1080, 8.5).edges.find((e) => e.id === "ab");
  assert.ok(shown.label.op >= TEXT_FLOOR - 1e-9, `a dimmed but shown edge label sits at the floor, got ${shown.label.op}`);
});

test("edges appear at their time, draw to full, and the focus step scales and dims", () => {
  assert.equal(frameAt(CFG, 1920, 1080, 1.4).edges.length, 0);
  const drawn = frameAt(CFG, 1920, 1080, 3).edges;
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].p, 1);
  assert.ok(drawn[0].dot);
  const focus = frameAt(CFG, 1920, 1080, 8).nodes;
  assert.ok(Math.abs(focus.find((n) => n.id === "A").scale - 1.5) < 1e-9);
  assert.ok(Math.abs(focus.find((n) => n.id === "B").look - 0.3) < 1e-9);
  const hidden = frameAt(CFG, 1920, 1080, 8).edges.find((e) => e.id === "ab");
  assert.equal(hidden.label.op, 0, "an edge dimmed to 0.3 drops its label in a focus step");
  const chip = frameAt(CFG, 1920, 1080, 6).edges.find((e) => e.id === "ca");
  assert.ok(chip.chipOp > 0.99);
  assert.equal(frameAt(CFG, 1920, 1080, 6).edges.find((e) => e.id === "ab").chipOp, 0);
  const back = frameAt(CFG, 1920, 1080, 10).nodes.find((n) => n.id === "A");
  assert.ok(Math.abs(back.scale - 1) < 1e-9);
});

test("edgePull 0 on a step keeps its nodes on their anchors instead of being dragged by edges", () => {
  const pulled = frameAt(CFG, 1920, 1080, 6).nodes.find((n) => n.id === "A");
  const held = frameAt({ ...CFG, steps: CFG.steps.map((st) => ({ ...st, edgePull: 0 })) }, 1920, 1080, 6).nodes.find((n) => n.id === "A");
  const anchorX = 64 + 0.3 * (1856 - 64);
  assert.ok(Math.abs(held.x - anchorX) < 1e-6, `held at ${held.x}, anchor ${anchorX}`);
  assert.ok(pulled.x > held.x, "with pull the A to B edge drags A toward B");
});

test("captions, big figure, chip, source and notes fill their vars and show only in their windows", () => {
  const f = frameAt(CFG, 1920, 1080, 6.6);
  assert.equal(f.captions.length, 1);
  assert.equal(f.captions[0].big.text, "~215bp");
  assert.equal(f.captions[0].source.text, "CDS, Aug 9, 2026");
  assert.ok(f.captions[0].chip);
  assert.equal(f.notes.length, 1);
  const g = frameAt(CFG, 1920, 1080, 1.2);
  assert.equal(g.captions[0].rows.length, 2);
  assert.ok(g.captions[0].rows[1].op < g.captions[0].rows[0].op, "the delayed line lands later");
  assert.equal(frameAt(CFG, 1920, 1080, 10).captions[0].align, "middle");
});

test("a layout can dock an edge chip into the caption block instead of the graph", () => {
  const dockWide = { ...CFG.layouts.wide, labels: { ca: { chipDock: "caption" } } };
  const noCapChip = CFG.captions.map((c, i) => (i === 1 ? { ...c, chip: undefined } : c));
  const docked = { ...CFG, captions: noCapChip, layouts: { ...CFG.layouts, wide: dockWide } };
  const f = frameAt(docked, 1920, 1080, 6.6);
  assert.equal(f.edges.find((e) => e.id === "ca").chipOp, 0, "the edge no longer draws it");
  assert.equal(f.captions[0].chip.lines.join(" "), "chip", "the caption block carries the edge chip");
  const busy = frameAt({ ...CFG, layouts: { ...CFG.layouts, wide: dockWide } }, 1920, 1080, 6.6);
  assert.equal(busy.captions[0].chip.lines.join(" "), "a b c", "a caption's own chip is never replaced");
  assert.ok(busy.edges.find((e) => e.id === "ca").chipOp > 0, "so the edge keeps its chip on the graph");
  assert.ok(frameAt(docked, 1080, 1920, 6.6).edges.find((e) => e.id === "ca").chipOp > 0, "other layouts keep the chip on the edge");
});

test("glows pulse at or under 1 Hz, ripples and ghosts follow their nodes", () => {
  const samples = [];
  for (let f = 0; f < 150; f++) samples.push(frameAt(CFG, 1920, 1080, 6.7 + f / 60).glows.find((g) => g.kind === "warm").op);
  let turns = 0;
  for (let i = 2; i < samples.length; i++) if ((samples[i] - samples[i - 1]) * (samples[i - 1] - samples[i - 2]) < 0) turns++;
  assert.ok(turns <= 3, `warm glow turned ${turns} times in 2.5 s (0.5 Hz allows 2 or 3)`);
  const r = frameAt(CFG, 1920, 1080, 10);
  assert.ok(r.ripples.length > 0);
  const b = r.nodes.find((n) => n.id === "B");
  for (const rp of r.ripples) assert.ok(rp.x === b.x && rp.r >= b.r);
  assert.equal(frameAt(CFG, 1920, 1080, 8).ghosts.length, 1);
});
