import assert from "node:assert/strict";
import test from "node:test";
import { statEnters, statOpacity, arrivalAlpha, growthPerStep, layoutFor, logY, pathOf, pointX, roundedCount, runningMax, sci, smooth, tipIndex, visiblePoints } from "./growLineMath.js";

test("smooth holds 0 before a, 1 after b, and is monotonic between", () => {
  assert.equal(smooth(0, 1, 2), 0);
  assert.equal(smooth(3, 1, 2), 1);
  let prev = -1;
  for (let x = 1; x <= 2; x += 0.01) {
    const v = smooth(x, 1, 2);
    assert.ok(v >= prev);
    prev = v;
  }
});

test("logY puts the exponent bounds on the top and bottom edges", () => {
  assert.equal(logY(1e21, 21, 28, 100, 800), 800);
  assert.ok(Math.abs(logY(1e28, 21, 28, 100, 800) - 100) < 1e-9);
  assert.ok(Math.abs(logY(1e24, 21, 28, 100, 800) - (800 - (3 / 7) * 700)) < 1e-9);
  assert.throws(() => logY(0, 21, 28, 100, 800));
  assert.throws(() => logY(5, 28, 21, 100, 800));
});

test("pointX spreads points evenly inside the padding", () => {
  assert.equal(pointX(0, 9, 100, 900, 50), 150);
  assert.equal(pointX(8, 9, 100, 900, 50), 850);
  assert.equal(pointX(4, 9, 100, 900, 50), 500);
  assert.throws(() => pointX(0, 1, 0, 10, 0));
});

test("tipIndex runs from to to and clamps p", () => {
  assert.equal(tipIndex(2, 5, 0), 2);
  assert.equal(tipIndex(2, 5, 1), 5);
  assert.equal(tipIndex(2, 5, 2), 5);
  assert.equal(tipIndex(2, 5, -1), 2);
});

test("visiblePoints is empty before point 0, whole at integers, interpolated between", () => {
  const pts = [[0, 0], [10, 20], [20, 40]];
  assert.deepEqual(visiblePoints(pts, -0.5), []);
  assert.deepEqual(visiblePoints(pts, 0), [[0, 0]]);
  assert.deepEqual(visiblePoints(pts, 1), [[0, 0], [10, 20]]);
  assert.deepEqual(visiblePoints(pts, 1.5), [[0, 0], [10, 20], [15, 30]]);
  assert.deepEqual(visiblePoints(pts, 9), pts);
});

test("arrivalAlpha is 0 before the tip nears, 1 once it passes", () => {
  assert.equal(arrivalAlpha(0, 2), 0);
  assert.equal(arrivalAlpha(2, 2), 1);
  assert.equal(arrivalAlpha(5, 2), 1);
  const mid = arrivalAlpha(1.8, 2);
  assert.ok(mid > 0 && mid < 1);
});

test("pathOf writes stable two decimal path data", () => {
  assert.equal(pathOf([[1, 2], [3.456, 4]]), "M1.00 2.00 L3.46 4.00");
});

test("sci gives one decimal mantissa and carries a rounded up 10", () => {
  assert.deepEqual(sci(8.74395e21), { m: "8.7", e: 21 });
  assert.deepEqual(sci(1.0001e27), { m: "1.0", e: 27 });
  assert.deepEqual(sci(9.97e24), { m: "1.0", e: 25 });
  assert.throws(() => sci(0));
});

test("roundedCount rounds to thousands above 10000", () => {
  assert.equal(roundedCount(114375), "114,000");
  assert.equal(roundedCount(950), "950");
  assert.throws(() => roundedCount(-1));
});

test("growthPerStep is the per step factor", () => {
  assert.ok(Math.abs(growthPerStep(1, 256, 4) - 4) < 1e-9);
  assert.throws(() => growthPerStep(0, 5, 2));
});

test("runningMax never falls", () => {
  assert.deepEqual(runningMax([3, 1, 5, 4, 9, 2]), [3, 3, 5, 5, 9, 9]);
});

test("layoutFor keeps the chart inside the canvas for wide and square", () => {
  for (const [W, H] of [[1920, 1080], [1440, 1440]]) {
    const l = layoutFor(W, H);
    assert.ok(l.chart.left > 0 && l.chart.right < W);
    assert.ok(l.chart.top > 0 && l.chart.top < l.chart.bottom && l.chart.bottom < H);
    assert.ok(l.source.y < H);
  }
  assert.equal(layoutFor(1920, 1080).wide, true);
  assert.equal(layoutFor(1440, 1440).wide, false);
  assert.throws(() => layoutFor(0, 10));
});

test("a stat identical in back-to-back beats carries over: no entry, full opacity from frame 0", () => {
  const same = { text: "114,000x", note: "2018 to Sep 2026" };
  const beats = [{ stat: { ...same, count: { to: 114000, start: 0.3, end: 9.2 } } }, { stat: { ...same } }, { stat: { ...same } }];
  assert.equal(statEnters(beats, 0), true);
  assert.equal(statEnters(beats, 1), false);
  assert.equal(statEnters(beats, 2), false);
  for (const n of [1, 2]) for (const t of [0, 0.05, 0.3, 0.6, 5]) assert.equal(statOpacity(t, statEnters(beats, n)), 1);
});

test("a stat enters when the previous beat has none or a different text or note", () => {
  const a = { text: "1x", note: "n" };
  assert.equal(statEnters([{}, { stat: a }], 1), true);
  assert.equal(statEnters([{ stat: a }, { stat: { ...a, text: "2x" } }], 1), true);
  assert.equal(statEnters([{ stat: a }, { stat: { ...a, note: "m" } }], 1), true);
  assert.equal(statEnters([{ stat: a }, {}], 1), false);
});

test("an entering stat fades in from 0 to 1 and holds", () => {
  assert.equal(statOpacity(0, true), 0);
  assert.equal(statOpacity(0.6, true), 1);
  assert.equal(statOpacity(3, true), 1);
  const mid = statOpacity(0.3, true);
  assert.ok(mid > 0 && mid < 1);
});
