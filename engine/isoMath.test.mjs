import assert from "node:assert/strict";
import test from "node:test";
import { buildBlocks, iso } from "./isoMath.js";

const ORIGIN = [540, 790];

test("iso: the origin cell corner sits on the origin, z lifts straight up", () => {
  assert.deepEqual(iso(ORIGIN, 56, 0, 0), [540, 790]);
  assert.deepEqual(iso(ORIGIN, 56, 0, 0, 100), [540, 690]);
});

test("iso: i steps right and down, j steps left and down, half as far down as across", () => {
  assert.deepEqual(iso(ORIGIN, 56, 1, 0), [596, 818]);
  assert.deepEqual(iso(ORIGIN, 56, 0, 1), [484, 818]);
});

const half = () => 0.5;

test("blocks skip the middle street row and column", () => {
  const b = buildBlocks(7, half);
  assert.equal(b.length, 36);
  assert.ok(b.every((x) => x.i !== 3 && x.j !== 3));
});

test("blocks are painted back to front", () => {
  const b = buildBlocks(7, half);
  for (let k = 1; k < b.length; k++) assert.ok(b[k - 1].i + b[k - 1].j <= b[k].i + b[k].j);
});

test("centre blocks are taller than corner blocks for the same random draw", () => {
  const b = buildBlocks(7, half);
  const at = (i, j) => b.find((x) => x.i === i && x.j === j).h;
  assert.ok(at(2, 2) > at(0, 0));
  assert.equal(at(0, 0), 40 + (1 - Math.hypot(3, 3) / 4.5) * 200 + 35);
});

test("lit follows the random draw against 0.25", () => {
  assert.ok(buildBlocks(7, () => 0.3).every((x) => x.lit));
  assert.ok(buildBlocks(7, () => 0.2).every((x) => !x.lit));
});

test("an even or tiny grid fails loudly", () => {
  assert.throws(() => buildBlocks(6, half), /odd/);
  assert.throws(() => buildBlocks(1, half), /odd/);
});
