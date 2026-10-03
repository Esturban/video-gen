import assert from "node:assert/strict";
import test from "node:test";
import { countValue, splitCounted } from "./countValue.js";

const SPEC = { from: 0, to: 20, start: 9.2, end: 9.8 };

test("holds the start value before start", () => {
  assert.equal(countValue(0, SPEC), 0);
  assert.equal(countValue(9.2, SPEC), 0);
  assert.equal(countValue(9.19, { ...SPEC, from: 5 }), 5);
});

test("is part way up mid count", () => {
  const mid = countValue(9.5, SPEC);
  assert.ok(mid > 0 && mid < 20, `mid ${mid}`);
  assert.ok(Number.isInteger(mid));
});

test("lands exactly on the target at end", () => {
  assert.equal(countValue(9.8, SPEC), 20);
});

test("holds the target after end, to any later time", () => {
  for (const t of [9.8001, 10, 12, 500]) assert.equal(countValue(t, SPEC), 20);
});

test("is monotonic non-decreasing across a fine sweep, counting up", () => {
  let prev = -1;
  for (let t = 9; t <= 10.5; t += 1 / 240) {
    const v = countValue(t, SPEC);
    assert.ok(v >= prev, `dropped from ${prev} to ${v} at t=${t}`);
    prev = v;
  }
  assert.equal(prev, 20);
});

test("is monotonic non-increasing when counting down, landing exactly", () => {
  const down = { from: 10, to: 3, start: 1, end: 2 };
  let prev = 11;
  for (let t = 0.5; t <= 3; t += 1 / 240) {
    const v = countValue(t, down);
    assert.ok(v <= prev);
    prev = v;
  }
  assert.equal(prev, 3);
});

test("a single digit count steps through whole numbers and lands on the target", () => {
  const seen = new Set();
  for (let t = 5; t <= 6; t += 1 / 60) seen.add(countValue(t, { from: 0, to: 6, start: 5.17, end: 5.72 }));
  assert.equal(Math.max(...seen), 6);
  assert.equal(Math.min(...seen), 0);
});

test("rejects non-integer from or to", () => {
  assert.throws(() => countValue(1, { ...SPEC, to: 2.5 }), /whole numbers/);
});

test("splitCounted splits copy around each counted number in order", () => {
  assert.deepEqual(splitCounted("Live in 2 to 6 weeks once tested", ["2", "6"]), [
    { text: "Live in " }, { num: 2, digits: 1, index: 0 }, { text: " to " }, { num: 6, digits: 1, index: 1 }, { text: " weeks once tested" },
  ]);
});

test("splitCounted never matches a token inside a longer number", () => {
  assert.deepEqual(splitCounted("Free, 20 minutes, 2 steps", ["2"]), [
    { text: "Free, 20 minutes, " }, { num: 2, digits: 1, index: 0 }, { text: " steps" },
  ]);
});

test("splitCounted throws when a token is missing or not a whole number", () => {
  assert.throws(() => splitCounted("Free, 20 minutes.", ["30"]), /not found/);
  assert.throws(() => splitCounted("Free, 20 minutes.", ["2x"]), /whole number/);
});
