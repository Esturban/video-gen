import assert from "node:assert/strict";
import test from "node:test";
import { MARGIN, PULSE_HZ, TEXT_MIN_PX, textRect } from "./dualTimelineMath.js";
import { MAX_ALPHA_STEP, MAX_CRAWL_PX_S, frameAt, validateConfig } from "./ledgerRowsMath.js";

// Mirrors the CMO-8236 storyboard (seven deals, no verified amounts), body clock 0 to 40 s.
const EMPTY = ["no verified", "amount"];
const row = (label, meta, at, litAt, labelAt) => ({ label, meta, at, chip: { text: "MGX", litAt }, slot: { state: "empty", emptyLabel: EMPTY, labelAt } });
export const CFG = {
  vars: { r1: { value: "$6.6B round", asOf: "Oct 2, 2024" }, r2: { value: "$500B pledge", asOf: "Jan 21, 2025" } },
  heads: { label: "Deal and round headline (whole round)", chip: "MGX", slot: "MGX share", at: 0.3 },
  guides: { at: 0.8, step: 0.1 },
  rows: [
    row("OpenAI round", "{r1.asOf} · {r1.value}", 3.3, 21.8, 27.3),
    row("Stargate LLC", "{r2.asOf} · {r2.value}", 4.3, 22.4, 27.7),
    row("xAI Series E", "Jan 2026 · $20B round", 8.3, 23.0, 28.1),
    row("Anthropic Series G", "Feb 12, 2026 · $30B round", 9.3, 23.6, 28.5),
    row("OpenAI round", "Mar 31, 2026 · $122B round", 13.3, 24.2, 28.9),
    row("Anthropic Series H", "May 28, 2026 · $65B round", 14.3, 24.8, 29.3),
    row("Aligned Data Centers", "Jul 21, 2026 · $40B deal", 18.3, 25.4, 29.7),
  ],
  focus: { row: 1, at: 33, until: 36, dim: 0.4, pulse: true },
  badge: { text: "7 deals", at: 19.0, until: 21.5 },
  captions: [
    { at: 0, until: 3, lines: ["Seven AI deals. One investor name."], source: "Source: CFO Gulf AI capital study, Oct 17, 2026" },
    { at: 33, until: 36, lines: ["One Stargate figure is reported. It may be two firms combined."], source: "The Information via Seeking Alpha, UNVERIFIED (CFO QA, Oct 17, 2026)" },
    { at: 36, until: 41, lines: [{ text: "Seven deals. One name. No verified amounts.", delay: 1.0 }], source: "Research framing, not investment advice. Sources dated above." },
  ],
  footer: { text: "Research framing, not investment advice", at: 21.5 },
};

const SIZES = [[1080, 1920], [1920, 1080], [1080, 1080]];
const times = (a, b, fps = 30) => { const out = []; for (let i = Math.round(a * fps); i <= Math.round(b * fps); i++) out.push(i / fps); return out; };
const clone = (x) => JSON.parse(JSON.stringify(x));

test("(1) frameAt is deterministic: same inputs give the same frame, whatever was drawn before", () => {
  for (const [W, H] of SIZES) {
    const a = frameAt(CFG, W, H, 25.3);
    frameAt(CFG, W, H, 2);
    frameAt(CFG, W, H, 39);
    assert.deepEqual(frameAt(CFG, W, H, 25.3), a);
  }
});

test("(2) rows appear in config order and row y increases down the ledger", () => {
  for (const [W, H] of SIZES) {
    const f = frameAt(CFG, W, H, 39);
    assert.equal(f.rows.length, 7);
    for (let i = 1; i < f.rows.length; i++) assert.ok(f.rows[i].y > f.rows[i - 1].y, `row ${i} is not below row ${i - 1} at ${W}x${H}`);
    CFG.rows.forEach((r, i) => {
      assert.equal(frameAt(CFG, W, H, r.at - 0.01).rows[i].op, 0, `row ${i} shows before its at`);
      assert.equal(frameAt(CFG, W, H, r.at + 0.5).rows[i].op, 1, `row ${i} not landed 0.5 s after at`);
      if (i + 1 < CFG.rows.length) assert.ok(CFG.rows[i + 1].at >= r.at, "config rows are in time order");
    });
  }
});

test("(3) chip fill is 0 before litAt and 1 from litAt + 0.3", () => {
  for (const [W, H] of SIZES) {
    CFG.rows.forEach((r, i) => {
      assert.equal(frameAt(CFG, W, H, r.chip.litAt - 0.01).rows[i].chip.lit, 0);
      assert.equal(frameAt(CFG, W, H, r.chip.litAt + 0.3).rows[i].chip.lit, 1);
    });
  }
});

test("(4) a slot never carries anything but its emptyLabel; a value anywhere in a row or slot throws", () => {
  for (const [W, H] of SIZES) {
    for (const t of [0, 10, 26, 30, 34, 39]) {
      const slotTexts = frameAt(CFG, W, H, t).texts.filter((x) => x.key.startsWith("slot-"));
      for (const x of slotTexts) assert.ok(EMPTY.includes(x.text), `slot text "${x.text}" is not the empty label`);
    }
  }
  const withSlotValue = clone(CFG); withSlotValue.rows[0].slot.value = "$1B";
  assert.throws(() => validateConfig(withSlotValue), /no value/);
  const withRowValue = clone(CFG); withRowValue.rows[2].value = "$1B";
  assert.throws(() => validateConfig(withRowValue), /no value/);
  const withAmount = clone(CFG); withAmount.rows[3].slot.amount = 5;
  assert.throws(() => validateConfig(withAmount), /slot/);
  const notEmpty = clone(CFG); notEmpty.rows[4].slot.state = "filled";
  assert.throws(() => validateConfig(notEmpty), /empty/);
});

test("(5) the focus pulse is at most 0.5 Hz and no alpha steps more than 0.15 per frame at 30 fps", () => {
  assert.ok(PULSE_HZ <= 0.5);
  assert.ok(MAX_ALPHA_STEP <= 0.15);
  for (const [W, H] of SIZES) {
    let prev = null;
    let peaks = 0;
    let last = [0, 0];
    for (const t of times(0, 40)) {
      const f = frameAt(CFG, W, H, t);
      if (prev) {
        for (const [k, v] of Object.entries(f.alphas)) {
          const d = Math.abs(v - (prev[k] ?? 0));
          assert.ok(d <= 0.15 + 1e-9, `${k} steps ${d.toFixed(3)} at ${t.toFixed(3)} s in ${W}x${H}`);
        }
      }
      const p = f.rows[CFG.focus.row].slot.pulse;
      if (last[1] > last[0] && last[1] > p) peaks++;
      last = [last[1], p];
      prev = f.alphas;
    }
    const window = CFG.focus.until - CFG.focus.at;
    assert.ok(peaks <= Math.ceil(window * PULSE_HZ), `${peaks} pulse peaks in ${window} s is faster than ${PULSE_HZ} Hz`);
    assert.ok(peaks >= 1, "the focus slot never pulses");
  }
});

test("(6) no text rectangle leaves the 64 px margins at 1080x1920, 1920x1080 and 1080x1080", () => {
  for (const [W, H] of SIZES) {
    for (const t of times(0, 40, 4)) {
      for (const tx of frameAt(CFG, W, H, t).texts) {
        const r = textRect(tx);
        assert.ok(r.x0 >= MARGIN - 1e-6 && r.x1 <= W - MARGIN + 1e-6 && r.y0 >= MARGIN - 1e-6 && r.y1 <= H - MARGIN + 1e-6,
          `${tx.key} "${tx.text}" leaves the margins at ${t} s in ${W}x${H}: ${JSON.stringify(r)}`);
      }
    }
  }
});

test("(7) every text item is 30 px or larger", () => {
  for (const [W, H] of SIZES) {
    for (const t of times(0, 40, 4)) {
      for (const tx of frameAt(CFG, W, H, t).texts) assert.ok(tx.px >= TEXT_MIN_PX - 1e-9, `${tx.key} is ${tx.px} px at ${W}x${H}`);
    }
  }
});

test("(8) seven rows fit between y 300 and 1230 at 1080x1920, slots 316 x 88", () => {
  const f = frameAt(CFG, 1080, 1920, 39);
  for (const r of f.rows) {
    assert.ok(r.slot.y0 >= 300 && r.slot.y0 + r.slot.h <= 1230, `row ${r.i} slot ${r.slot.y0}..${r.slot.y0 + r.slot.h}`);
    assert.equal(r.slot.w, 316);
    assert.equal(r.slot.h, 88);
  }
  for (const tx of f.texts.filter((x) => /^row-|^slot-|^chip-/.test(x.key))) {
    const r = textRect(tx);
    assert.ok(r.y0 >= 300 && r.y1 <= 1230, `${tx.key} "${tx.text}" at ${r.y0}..${r.y1}`);
  }
});

test("row text never runs into the chip column, and the ledger never overlaps the caption", () => {
  for (const [W, H] of SIZES) {
    const f = frameAt(CFG, W, H, 39);
    const chipX0 = Math.min(...f.rows.map((r) => r.chip.x0));
    for (const tx of f.texts.filter((x) => x.key.startsWith("row-"))) assert.ok(textRect(tx).x1 <= chipX0, `${tx.key} "${tx.text}" runs into the chip at ${W}x${H}`);
    const ledgerBottom = Math.max(...f.rows.map((r) => r.slot.y0 + r.slot.h));
    for (const t of [1, 34, 39]) {
      for (const tx of frameAt(CFG, W, H, t).texts.filter((x) => x.key.startsWith("cap-"))) assert.ok(textRect(tx).y0 >= ledgerBottom, `${tx.key} overlaps the ledger at ${W}x${H}`);
    }
  }
});

test("the focus row stays bright while the other rows dim to 40 percent, then all return", () => {
  const f = frameAt(CFG, 1080, 1920, 35);
  f.rows.forEach((r, i) => assert.equal(r.dim, i === CFG.focus.row ? 1 : 0.4));
  frameAt(CFG, 1080, 1920, 36.6).rows.forEach((r) => assert.equal(r.dim, 1));
});

test("validateConfig names the problem", () => {
  assert.throws(() => validateConfig({}), /rows/);
  const late = clone(CFG); late.rows[1].at = 1;
  assert.throws(() => validateConfig(late), /time order/);
  const badFocus = clone(CFG); badFocus.focus.row = 9;
  assert.throws(() => validateConfig(badFocus), /focus/);
});

test("empty-slot dashes march at slotCrawl px per second from the row's at, never above the cap, and are still without it", () => {
  const cfg = { ...clone(CFG), slotCrawl: 24 };
  const r = cfg.rows[2];
  assert.equal(frameAt(cfg, 1920, 1080, r.at - 1).rows[2].slot.dash, 0);
  assert.ok(Math.abs(frameAt(cfg, 1920, 1080, r.at + 2).rows[2].slot.dash - 48) < 1e-9);
  assert.equal(frameAt(CFG, 1920, 1080, 30).rows[2].slot.dash, 0);
  assert.throws(() => validateConfig({ ...clone(CFG), slotCrawl: MAX_CRAWL_PX_S + 1 }), /slotCrawl/);
});
