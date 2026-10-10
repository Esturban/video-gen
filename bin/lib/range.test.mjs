// Tests for --range START:END parsing and the frame math it drives (CMO-7578).
import assert from "node:assert/strict";
import test from "node:test";
import { parseRange, rangeFrames } from "./range.mjs";

test("parseRange reads whole and fractional seconds", () => {
  assert.deepEqual(parseRange("2:3", 10), { start: 2, end: 3 });
  assert.deepEqual(parseRange("0.5:1.25", 10), { start: 0.5, end: 1.25 });
});

test("parseRange throws a --range error on malformed, reversed, empty, negative or too-long ranges", () => {
  for (const bad of ["2", "a:b", "3:2", "2:2", "-1:2", "1:2:3", ""]) assert.throws(() => parseRange(bad, 10), /--range/, `"${bad}"`);
  assert.throws(() => parseRange("2:11", 10), /--range/);
});

test("rangeFrames: output frames equal range length times fps, composition frames are scaled by blur", () => {
  assert.deepEqual(rangeFrames({ start: 2, end: 3 }, 60, 2), { outputFrames: 60, subframes: 120, frameRange: [240, 359] });
  assert.equal(rangeFrames({ start: 0, end: 0.5 }, 30, 1).outputFrames, 15);
});
