import assert from "node:assert/strict";
import { test } from "node:test";
import { areaGeometry, cumulative, shareSegments, stackedSegments, tileReveal } from "./bentoMath.js";

const VALUES = [820, 1240, 1610, 2050, 2480];

test("shares of the five months are 10, 15, 20, 25, 30 and always add to 100", () => {
  assert.deepEqual(shareSegments(VALUES), [10, 15, 20, 25, 30]);
  for (const v of [[1, 1, 1], [3, 3, 3, 1], [7, 11, 13, 17, 19, 23]]) assert.equal(shareSegments(v).reduce((a, b) => a + b, 0), 100);
});

test("shares reject bad input", () => {
  assert.throws(() => shareSegments([]), /positive/);
  assert.throws(() => shareSegments([1, -2]), /positive/);
});

test("cumulative is the running total", () => {
  assert.deepEqual(cumulative([1, 2, 3]), [1, 3, 6]);
  assert.equal(cumulative(VALUES).at(-1), 8200);
});

test("stacked segments: widths are proportional to shares, in order, and grow from nothing to full", () => {
  const box = { x0: 100, width: 560, gap: 4 };
  const shares = [10, 15, 20, 25, 30];
  const start = stackedSegments(box, shares, -1, [0, 1]);
  assert.ok(start.every((s) => s.w === 0));
  const end = stackedSegments(box, shares, 99, [0, 1]);
  assert.ok(end.every((s) => Math.abs(s.w - s.fullW) < 1e-9));
  assert.ok(Math.abs(end.reduce((a, s) => a + s.fullW, 0) + 4 * 4 - 560) < 1e-9);
  assert.ok(Math.abs(end[4].fullW / end[0].fullW - 3) < 1e-9);
  assert.ok(Math.abs(end.at(-1).x + end.at(-1).fullW - 660) < 1e-9, "the bar ends on the right edge of its box");
  for (let j = 1; j < 5; j++) assert.ok(end[j].x > end[j - 1].x + end[j - 1].fullW);
});

test("area chart: nothing at k = 0, every point at k = 1, a cut segment in between", () => {
  const box = { x0: 0, baseY: 100, width: 400, height: 100 };
  assert.equal(areaGeometry(VALUES, box, 0).line.length, 0);
  const full = areaGeometry(VALUES, box, 1);
  assert.equal(full.line.length, 5);
  assert.deepEqual(full.tip, full.full[4]);
  assert.ok(Math.abs(full.full[4][1] - 0) < 1e-9, "the total reaches the top of the box");
  const half = areaGeometry(VALUES, box, 0.375);
  assert.equal(half.line.length, 3);
  assert.ok(Math.abs(half.tip[0] - 150) < 1e-9);
  assert.deepEqual(half.area[0], [0, 100]);
  assert.deepEqual(half.area.at(-1), [half.tip[0], 100]);
});

test("area chart line grows monotonically in x", () => {
  const box = { x0: 0, baseY: 100, width: 400, height: 100 };
  let last = -1;
  for (let k = 0.01; k <= 1; k += 0.01) { const x = areaGeometry(VALUES, box, k).tip[0]; assert.ok(x >= last); last = x; }
});

test("tile reveal is staggered by index and lands on 1", () => {
  assert.equal(tileReveal(0, [1, 2], 0), 0);
  assert.equal(tileReveal(99, [1, 2], 3), 1);
  assert.ok(tileReveal(1.6, [1, 2], 0) > tileReveal(1.6, [1, 2], 1));
});
