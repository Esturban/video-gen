import assert from "node:assert/strict";
import { test } from "node:test";
import { crispTime } from "./crispTime.js";

const FPS = 60;
const BLUR = 2;

test("the subframes that tmix averages into one output frame read the same time", () => {
  for (let k = 1; k < 600; k++) {
    const a = crispTime((k * BLUR - 1) / (FPS * BLUR), FPS, BLUR);
    const b = crispTime((k * BLUR) / (FPS * BLUR), FPS, BLUR);
    assert.equal(a, b, `output frame ${k}`);
    assert.ok(Math.abs(a - k / FPS) < 1e-9);
  }
});

test("consecutive output frames still advance by one output frame", () => {
  assert.ok(Math.abs(crispTime(61 * 2 / 120, FPS, BLUR) - crispTime(60 * 2 / 120, FPS, BLUR) - 1 / FPS) < 1e-9);
});

test("with no blur the time is untouched, and the first frame is time zero", () => {
  assert.equal(crispTime(0.123, 30, 1), 0.123);
  assert.equal(crispTime(0, FPS, BLUR), 0);
});

test("works for three subframes", () => {
  const f = (m) => crispTime(m / (FPS * 3), FPS, 3);
  assert.equal(f(4), f(5));
  assert.equal(f(5), f(6));
  assert.notEqual(f(6), f(7));
});

test("bad arguments fail loudly", () => {
  assert.throws(() => crispTime(1, 0, 2), /crispTime/);
  assert.throws(() => crispTime(1, 60, 1.5), /crispTime/);
});
