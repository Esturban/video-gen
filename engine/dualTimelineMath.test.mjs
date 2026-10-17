import assert from "node:assert/strict";
import test from "node:test";
import { MARGIN, PULSE_HZ, frameAt, textRect, validateConfig } from "./dualTimelineMath.js";

// Mirrors the CMO-8232 storyboard (bond vs lease), body clock 0 to 40 s.
export const CFG = {
  vars: { bond: { value: "$27B", asOf: "Oct 17, 2026" } },
  axis: { from: 2025, to: 2049, startLabel: "2025", endLabel: "2049", at: 1, endAt: 7.8, note: { text: "illustrative, to scale", at: 8.5 } },
  lanes: [{ id: "bond", label: "Bond", at: 0.3 }, { id: "lease", label: "Lease", at: 0.6 }],
  spread: { base: 90, dur: 1.2, steps: [{ at: 11, px: 160 }, { at: 15, px: 220 }, { at: 20, px: 280 }, { at: 24.5, px: 320 }, { at: 29.5, px: 340 }] },
  bar: { lane: "bond", draw: [3.2, 7.6], chips: [{ text: "{bond.value} of bonds", at: 0.3 }, { text: "Rated A+ (S&P)", at: 0.7 }] },
  blocks: {
    lane: "lease", years: 4, label: "4 yrs",
    items: [{ at: 11.4, fill: 11.4 }, { at: 15.3, fill: 17.4 }, { at: 15.8, fill: 17.9 }, { at: 16.3, fill: 18.4 }, { at: 16.8, fill: 18.9 }],
    note: { text: "up to 20 years total", at: 18.5, until: 24.5 },
  },
  playhead: { at: 20.4, dur: 3.5 },
  brackets: [
    { kind: "span", from: 0, to: 3, label: "Per Meta: first 16 years", draw: [24.8, 25.8], dim: { at: 29.5, to: 0.4 } },
    { kind: "ticks", label: "Per another source: each renewal term", draw: [25.6, 26.6], dim: { at: 29.5, to: 0.4 } },
  ],
  chip: { text: "Sources differ", at: 26.6, until: 29.5 },
  gap: { label: "Mismatch, not a forecast", fromBlock: 1, at: 29.5, fade: 1.2 },
  captions: [
    { at: 0, until: 3, lines: ["One data center. Two clocks."], source: "Source: CFO circularity study, Oct 17, 2026 refresh" },
    { at: 3, until: 7, lines: ["A {bond.value} bond, rated A+."], source: "S&P rating, via CFO study (Bisnow). A+ also in GDCH, Jul 21, 2026" },
    { at: 29.5, until: 34.5, lines: ["Bond: set to 2049. Lease: chosen four years at a time."], source: "Kothari, Nov 18, 2025 (secondary)" },
    { at: 34.5, until: 40, lines: [{ text: "A 2049 bond." }, { text: "A lease renewed four years at a time.", delay: 1.5 }], source: "Research framing, not investment advice. Sources dated above." },
  ],
  footer: { text: "Research framing, not investment advice", at: 24.5 },
};

const SIZES = [[1080, 1920], [1920, 1080]];
// sample times on an integer frame grid, so 29.5 s is exactly 29.5 and never 29.500000001 from float accumulation
const times = (a, b, fps = 30) => { const out = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) out.push(i / fps); return out; };

test("(1) block width is 4/24 of the bar and five blocks end before the bar cap", () => {
  for (const [W, H] of SIZES) {
    const f = frameAt(CFG, W, H, 39);
    const bar = f.bar.x1 - f.bar.x0;
    assert.ok(bar > 0);
    for (const b of f.blocks) assert.ok(Math.abs((b.x1 - b.x0) - (4 / 24) * bar) < 1e-9, `slot ${b.i} is ${b.x1 - b.x0}px`);
    assert.equal(f.blocks.length, 5);
    assert.ok(f.blocks[4].x1 < f.bar.x1 - 1, "the chain stops short of the 2049 cap");
    assert.ok(Math.abs(f.blocks[0].x0 - f.bar.x0) < 1e-9, "block 1 starts at the shared start");
  }
});

test("(2) lane separation never shrinks from beat 4 to beat 8 (11.0 to 34.5 s)", () => {
  for (const [W, H] of SIZES) {
    let prev = -Infinity;
    for (const t of times(11, 34.5)) {
      const sep = frameAt(CFG, W, H, t).sep;
      assert.ok(sep >= prev - 1e-9, `separation fell at ${t.toFixed(3)} s`);
      prev = sep;
    }
    const s = W / (W > H ? 1920 : 1080);
    assert.ok(Math.abs(frameAt(CFG, W, H, 5).sep - 90 * s) < 1e-9);
    assert.ok(Math.abs(frameAt(CFG, W, H, 34.5).sep - 340 * s) < 1e-9);
  }
});

test("(3) frameAt is pure: the same t gives the same frame whatever was drawn before", () => {
  const a = JSON.stringify(frameAt(CFG, 1080, 1920, 26.3));
  frameAt(CFG, 1080, 1920, 3);
  frameAt(CFG, 1920, 1080, 31);
  assert.equal(JSON.stringify(frameAt(CFG, 1080, 1920, 26.3)), a);
});

test("(4) every pulse runs at 1 Hz or slower at every t", () => {
  assert.ok(PULSE_HZ <= 1);
  const series = new Map();
  for (const t of times(0, 40, 60)) {
    const f = frameAt(CFG, 1080, 1920, t);
    for (const p of f.pulses) {
      if (!series.has(p.key)) series.set(p.key, []);
      series.get(p.key).push([t, p.v]);
    }
  }
  assert.ok(series.size >= 5, "ticks and the gap band report their pulse");
  for (const [key, s] of series) {
    const turns = [];
    for (let i = 2; i < s.length; i++) if ((s[i][1] - s[i - 1][1]) * (s[i - 1][1] - s[i - 2][1]) < -1e-12) turns.push(s[i - 1][0]);
    // a cycle at f Hz turns twice per period: in any 1 s window at most 2 turns at 1 Hz
    for (let i = 0; i < turns.length; i++) {
      const inWin = turns.filter((x) => x >= turns[i] && x < turns[i] + 1).length;
      assert.ok(inWin <= 2, `${key} turned ${inWin} times within 1 s from ${turns[i].toFixed(2)} s`);
    }
  }
});

test("(5) a gap band without a label string throws", () => {
  assert.throws(() => validateConfig({ ...CFG, gap: { ...CFG.gap, label: undefined } }), /label/);
  assert.throws(() => validateConfig({ ...CFG, gap: { ...CFG.gap, label: "  " } }), /label/);
  assert.throws(() => frameAt({ ...CFG, gap: { fromBlock: 1, at: 29.5 } }, 1080, 1920, 31), /label/);
  for (const t of times(29.5, 40, 4)) {
    const g = frameAt(CFG, 1080, 1920, t).gap;
    if (g.op > 0) {
      const lbl = frameAt(CFG, 1080, 1920, t).texts.find((x) => x.key === "gap-label");
      assert.ok(lbl && lbl.text === "Mismatch, not a forecast" && lbl.px >= 30 && lbl.op > 0, `gap label missing at ${t}`);
    }
  }
});

test("(6) bracket A spans exactly four blocks", () => {
  for (const [W, H] of SIZES) {
    const f = frameAt(CFG, W, H, 27);
    const a = f.brackets.find((b) => b.kind === "span");
    assert.ok(Math.abs(a.x0 - f.blocks[0].x0) < 1e-9 && Math.abs(a.x1 - f.blocks[3].x1) < 1e-9);
    assert.ok(Math.abs((a.x1 - a.x0) - 4 * (f.blocks[0].x1 - f.blocks[0].x0)) < 1e-9);
    const b = f.brackets.find((x) => x.kind === "ticks");
    assert.equal(b.ticks.length, 5, "bracket B ticks every block");
  }
});

test("(7) no text rectangle leaves the 64 px margins at 1080x1920 and 1920x1080", () => {
  for (const [W, H] of SIZES) {
    const f0 = frameAt(CFG, W, H, 0);
    assert.ok(f0.bar.x0 >= 208 * (W / (W > H ? 1920 : 1080)) - 1e-9, "the axis starts after the label gutter");
    for (const t of times(0, 40, 4)) {
      for (const tx of frameAt(CFG, W, H, t).texts) {
        if (!(tx.op > 0)) continue;
        const r = textRect(tx);
        assert.ok(r.x0 >= MARGIN - 1e-6 && r.x1 <= W - MARGIN + 1e-6 && r.y0 >= MARGIN - 1e-6 && r.y1 <= H - MARGIN + 1e-6,
          `${tx.key} "${tx.text}" leaves the margins at ${t} s in ${W}x${H}: ${JSON.stringify(r)}`);
      }
    }
    const f = frameAt(CFG, W, H, 1);
    const lease = textRect(f.texts.find((x) => x.key === "lane-lease"));
    assert.ok(lease.x1 < f.bar.x0, "the Lease label stays in its gutter, clear of the bar");
  }
});

test("(8) amber alpha is 0 before 29.5 s", () => {
  for (const [W, H] of SIZES) {
    for (const t of times(0, 29.5)) assert.equal(frameAt(CFG, W, H, t).gap.op, 0, `amber at ${t}`);
    assert.ok(frameAt(CFG, W, H, 31).gap.op > 0);
  }
});

test("every text is 30 px or larger and drawn in ink tones, never the gold", () => {
  for (const t of [1, 5, 9, 13, 18, 22, 27, 31, 37]) {
    for (const tx of frameAt(CFG, 1080, 1920, t).texts) {
      assert.ok(tx.px >= 30 - 1e-9, `${tx.key} at ${tx.px}px`);
      assert.ok(tx.tone === "ink" || tx.tone === "inkSoft", `${tx.key} drawn in ${tx.tone}`);
    }
  }
});

test("footer persists from its time and vars fill caption and chip text", () => {
  assert.equal(frameAt(CFG, 1080, 1920, 20).texts.find((x) => x.key === "footer"), undefined);
  assert.ok(frameAt(CFG, 1080, 1920, 39.9).texts.find((x) => x.key === "footer").op > 0);
  const f = frameAt(CFG, 1080, 1920, 6);
  assert.ok(f.texts.some((x) => x.text === "$27B of bonds"));
  assert.ok(f.texts.some((x) => x.text.startsWith("A $27B bond")));
  assert.throws(() => frameAt({ ...CFG, bar: { ...CFG.bar, chips: [{ text: "{bond.nope}", at: 0.3 }] } }, 1080, 1920, 6));
});

test("validateConfig names what is wrong", () => {
  assert.throws(() => validateConfig({ ...CFG, spread: { ...CFG.spread, steps: [{ at: 11, px: 200 }, { at: 15, px: 150 }] } }), /px/);
  assert.throws(() => validateConfig({ ...CFG, brackets: [{ kind: "span", from: 0, to: 9, label: "x", draw: [1, 2] }] }), /block/);
  assert.throws(() => validateConfig({ ...CFG, bar: { ...CFG.bar, lane: "nope" } }), /"nope"/);
  assert.throws(() => validateConfig({ ...CFG, blocks: { ...CFG.blocks, years: 30 } }), /years/);
  assert.throws(() => validateConfig({ ...CFG, gap: { ...CFG.gap, px: 20 } }), /30/);
  assert.doesNotThrow(() => validateConfig(CFG));
});

test("a square frame picks the square layout and stays inside the margins", () => {
  for (const t of [1, 13, 27, 37]) {
    for (const tx of frameAt(CFG, 1440, 1440, t).texts) {
      if (!(tx.op > 0)) continue;
      const r = textRect(tx);
      assert.ok(r.x0 >= MARGIN - 1e-6 && r.x1 <= 1440 - MARGIN + 1e-6 && r.y1 <= 1440 - MARGIN + 1e-6, `${tx.key} at ${t}`);
    }
  }
});
