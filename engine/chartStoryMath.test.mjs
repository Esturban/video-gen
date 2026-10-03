import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGE_WINDOWS, buildStory, stageTimes } from "./chartStoryMath.js";
import { maxPointDistance, polyArea } from "./morphMath.js";

export const CFG = {
  values: [820, 1240, 1610, 2050, 2480],
  labels: ["Jan", "Feb", "Mar", "Apr", "May"],
  colors: { accent: "#2f5d5a", ink: "#241f1a", card: "#ffffff", line: "#e4dccd", paper: "#faf7f1" },
  tl: {
    dotIn: [0, 0.9], toRing: [1.1, 2.9], unroll: [4.6, 6.6], toBars: [6.2, 7.6], baselineIn: [7.4, 8.1], labelsIn: [7.7, 8.4],
    toLine: [9.4, 10.8], absorb: [12.4, 13.5], swell: [13.3, 14.7], count: [14.6, 15.9], toCard: [17.5, 18.2], split: [18.0, 19.5], cardsIn: [19.3, 20.1], bentoIn: [22.8, 24.2],
  },
  camera: [[0, 0, 0, 1.3], [2.9, 6, 0, 1.15], [4.6, 12, 2, 1.12], [6.6, 990, 0, 0.95], [7.6, 1000, 6, 0.94], [9.4, 1008, 10, 0.95], [10.8, 1014, 2, 1], [12.4, 1020, 0, 1], [14.7, 2150, 0, 1.25], [17.5, 2150, 0, 1.25], [19.5, 2150, 0, 1.1], [22.8, 2150, 0, 1.1], [24.6, 2150, 175, 0.92], [26.8, 2150, 180, 0.92]],
};
const END = 26.8;
const VIEW = 1440;
const story = buildStory(CFG);
const FPS = 60;
const bounds = (p) => {
  const xs = p.filter((_, i) => i % 2 === 0);
  const ys = p.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const visiblePolys = (s) => [...s.wedges.filter((w) => w.visible).map((w) => w.poly), ...s.cards.map((c) => c.poly), ...(s.bento ? s.bento.tiles.filter((x) => x.visible).map((x) => x.poly) : [])];

test("a bad config fails loudly", () => {
  assert.throws(() => buildStory({ ...CFG, values: [1] }), /at least two positive/);
  assert.throws(() => buildStory({ ...CFG, tl: { ...CFG.tl, split: [5, 4] } }), /tl.split/);
  assert.throws(() => buildStory({ ...CFG, labels: ["a"] }), /one entry per value/);
  assert.throws(() => buildStory({ ...CFG, cards: [] }), /cards, when given/);
});

test("continuity: across the whole piece no point of any shape moves more than a few px per 60fps frame", () => {
  let worst = 0;
  let at = 0;
  let prev = story.at(0).wedges.map((w) => w.poly);
  for (let f = 1; f <= Math.round(END * FPS); f++) {
    const s = story.at(f / FPS);
    const cur = s.wedges.map((w) => w.poly);
    if (s.cards.length === 0) cur.forEach((p, i) => { const d = maxPointDistance(prev[i], p); if (d > worst) { worst = d; at = f / FPS; } });
    prev = cur;
  }
  assert.ok(worst < 26, `largest single-frame point move ${worst.toFixed(1)}px at ${at}s`);
});

test("continuity of the split: cards start exactly on the big card and move in small steps", () => {
  const before = story.at(17.99).wedges[4].poly;
  const first = story.at(18.0).cards;
  for (const c of first) assert.ok(maxPointDistance(before, c.poly) < 6, "card must start on the big card");
  let prev = story.at(18.0).cards.map((c) => c.poly);
  for (let f = 18.0 * FPS; f <= Math.round(END * FPS); f++) {
    const cur = story.at(f / FPS).cards.map((c) => c.poly);
    cur.forEach((p, j) => assert.ok(maxPointDistance(prev[j], p) < 20, `card ${j} jumped at ${f / FPS}`));
    prev = cur;
  }
});

test("key beats hold still for at least 1.5 seconds: shapes do not move between a stage's end and the next stage's start", () => {
  const holds = [[2.9, 4.6], [7.6, 9.4], [10.8, 12.4], [15.9, 17.5], [20.1, 22.8]];
  for (const [a, b] of holds) {
    assert.ok(b - a >= 1.5, `hold ${a} to ${b} is shorter than 1.5s`);
    const pa = [...story.at(a + 0.01).wedges.map((w) => w.poly), ...story.at(a + 0.01).cards.map((c) => c.poly)];
    const pb = [...story.at(b - 0.01).wedges.map((w) => w.poly), ...story.at(b - 0.01).cards.map((c) => c.poly)];
    pa.forEach((p, i) => assert.ok(maxPointDistance(p, pb[i]) < 1e-6, `shape ${i} moved during the hold ${a} to ${b}`));
  }
});

test("each stage ends exactly on its target: bars have heights proportional to the values, the line ends on the dot", () => {
  const s = story.at(8.5);
  const tops = s.wedges.map((w) => Math.min(...w.poly.filter((_, i) => i % 2 === 1)));
  const heights = tops.map((y) => story.layout.bars.baseY - y);
  const ratio = heights.map((h, i) => h / CFG.values[i]);
  ratio.forEach((r) => assert.ok(Math.abs(r - ratio[0]) < 0.02, `bar heights not proportional: ${ratio}`));
  const end = story.at(12.3).wedges[4].poly;
  const xs = end.filter((_, i) => i % 2 === 0);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - story.linePt[4][0]) < 1e-6);
});

test("ring wedges are sized by value share, with the same colour order as the data", () => {
  const ring = story.at(3.5);
  assert.equal(ring.wedges.length, 5);
  assert.ok(ring.wedges.every((w) => w.visible));
  const lightFirst = ring.wedges.map((w) => Number(w.fill.match(/\d+/g)[0]));
  assert.ok(lightFirst[0] > lightFirst[4], "smallest value is the lightest tint, largest the full accent");
});

test("defect 3: the very first frame already shows the starting dot, large enough for the blank-frame gate", () => {
  const first = story.at(0);
  assert.ok(first.wedges.every((w) => w.visible), "the dot is drawn at t = 0");
  const total = first.wedges.reduce((a, w) => a + polyArea(w.poly), 0);
  const px = (story.layout.ring.dotR * story.layout.ring.dotStart) * first.camera.zoom;
  assert.ok(px > 30, `dot radius on screen at t = 0 is ${px.toFixed(1)}px`);
  assert.ok(total > 0.9 * Math.PI * (story.layout.ring.dotR * story.layout.ring.dotStart) ** 2, "the dot is a filled disc");
  assert.ok(Math.abs(bounds(first.wedges[0].poly).x0) < story.layout.ring.dotR, "and it sits at the camera centre");
});

test("defect 2: the unroll never leaves the frame, at any 60fps sample, with a margin", () => {
  const MARGIN = 40;
  for (let f = Math.round(4.0 * FPS); f <= Math.round(7.0 * FPS); f++) {
    const s = story.at(f / FPS);
    const half = VIEW / (2 * s.camera.zoom);
    for (const w of s.wedges.filter((x) => x.visible)) {
      const b = bounds(w.poly);
      assert.ok(b.x0 > s.camera.cx - half + MARGIN && b.x1 < s.camera.cx + half - MARGIN, `wedge leaves the frame sideways at ${(f / FPS).toFixed(2)}s (x ${b.x0.toFixed(0)} to ${b.x1.toFixed(0)}, view ${(s.camera.cx - half).toFixed(0)} to ${(s.camera.cx + half).toFixed(0)})`);
      assert.ok(b.y0 > s.camera.cy - half + MARGIN && b.y1 < s.camera.cy + half - MARGIN, `wedge leaves the frame vertically at ${(f / FPS).toFixed(2)}s`);
    }
  }
});

test("everything drawn stays inside the camera view for the whole piece", () => {
  for (let f = 0; f <= Math.round(END * FPS); f += 2) {
    const s = story.at(f / FPS);
    const half = VIEW / (2 * s.camera.zoom);
    for (const p of visiblePolys(s)) {
      const b = bounds(p);
      assert.ok(b.x0 >= s.camera.cx - half && b.x1 <= s.camera.cx + half && b.y0 >= s.camera.cy - half && b.y1 <= s.camera.cy + half, `a shape leaves the frame at ${(f / FPS).toFixed(2)}s`);
    }
  }
});

test("defect 4: the cards are the same five months as the series, one card per value, shares add to 100", () => {
  const end = story.at(21);
  assert.equal(end.cards.length, CFG.values.length);
  assert.deepEqual(end.cardContent.map((c) => c.label), CFG.labels);
  assert.deepEqual(end.cardContent.map((c) => c.value), [10, 15, 20, 25, 30]);
  assert.equal(end.cardContent.reduce((a, c) => a + c.value, 0), 100);
  assert.equal(end.wedges.filter((w) => w.visible).length, 0, "the five segments are pulled into the number");
});

test("defect 4: circle to cards is a shape morph: five shapes whose outlines change a little every frame, filled before any text shows", () => {
  const during = story.at(18.6);
  assert.equal(during.cards.length, 5);
  assert.ok(during.cardContent.every((c) => c.opacity === 0), "no card text yet while the shapes are still moving");
  const a = story.at(18.4).cards.map((c) => c.poly);
  const b = story.at(18.5).cards.map((c) => c.poly);
  a.forEach((p, j) => { const d = maxPointDistance(p, b[j]); assert.ok(d > 0.5 && d < 90, `card ${j} should be mid-morph, moved ${d.toFixed(2)}px`); });
  const widths = story.at(18.7).cards.map((c) => { const bb = bounds(c.poly); return bb.x1 - bb.x0; });
  assert.ok(new Set(widths.map((w) => w.toFixed(0))).size > 1, "cards are at different points of the morph (stagger), not a fade");
});

test("the number rolls up monotonically to the end value and then holds; cards count to their shares", () => {
  let last = -1;
  for (let t = 14.4; t <= 16.0; t += 0.02) { const v = story.at(t).number.value; assert.ok(v >= last); last = v; }
  assert.equal(story.at(15.9).number.value, 2480);
  assert.equal(story.at(17).number.value, 2480);
  assert.equal(story.at(0).number.opacity, 0);
  assert.deepEqual(story.at(22).cardContent.map((c) => c.value), [10, 15, 20, 25, 30]);
});

test("the number is clipped to its own shape", () => {
  const n = story.at(16).number;
  assert.equal(n.clip.length, story.at(16).wedges[4].poly.length);
  assert.ok(polyArea(n.clip) > 0);
});

test("added density: the bento tiles, a stacked share bar and a running-total area chart, grow out after the cards and show the same data", () => {
  assert.equal(story.at(22.5).bento.tiles.every((t) => !t.visible), true, "no tile before the cards have had their hold");
  const end = story.at(26.8).bento;
  assert.equal(end.tiles.length, 2);
  assert.equal(end.stack.segments.length, 5);
  const widths = end.stack.segments.map((s) => { const b = bounds(s.poly); return b.x1 - b.x0; });
  assert.ok(Math.abs(widths[4] / widths[0] - 3) < 0.05, "May is three times January, as in the cards (30 vs 10)");
  assert.equal(end.area.line.length, 5);
  assert.deepEqual(end.area.tip, end.area.full[4]);
  const mid = story.at(23.6).bento;
  assert.ok(mid.area.line.length < 5 && mid.tiles.every((t) => t.visible), "mid-reveal the tiles are on screen while the chart is still drawing");
});

test("no config without bentoIn builds a bento", () => {
  const { bentoIn, ...tl } = CFG.tl;
  assert.equal(buildStory({ ...CFG, tl }).at(26).bento, null);
});

test("explicit cards still override the derived ones", () => {
  const custom = buildStory({ ...CFG, cards: [{ label: "A", share: 60 }, { label: "B", share: 40 }] });
  assert.equal(custom.at(21).cards.length, 2);
});

test("camera never jumps and stage times list the chain in order", () => {
  let last = story.at(0).camera;
  for (let f = 1; f <= Math.round(END * FPS); f++) {
    const c = story.at(f / FPS).camera;
    assert.ok(Math.hypot(c.cx - last.cx, c.cy - last.cy) < 20, `camera jumped at ${f / FPS}`);
    last = c;
  }
  assert.deepEqual(stageTimes(CFG).map((s) => s.name), STAGE_WINDOWS);
});

test("the camera is still while any digit changes, so no text can smear", () => {
  const still = (a, b) => { const [p, q] = [story.at(a).camera, story.at(b).camera]; return Math.hypot(p.cx - q.cx, p.cy - q.cy) < 1 && Math.abs(p.zoom - q.zoom) < 0.002; };
  assert.ok(still(14.7, 15.9), "number count");
  assert.ok(still(19.5, 21.2), "card percentages count");
});
