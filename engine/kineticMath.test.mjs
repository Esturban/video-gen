import assert from "node:assert/strict";
import test from "node:test";
import { easeInCubic, easeOutCubic, lerp, linear, popScale, ramp, remapTime, window01 } from "./kineticMath.js";

test("ramp clamps before and after, eases out between", () => {
  assert.equal(ramp(0, 1, 2), 0);
  assert.equal(ramp(3, 1, 2), 1);
  assert.equal(ramp(1.5, 1, 2), easeOutCubic(0.5));
  assert.equal(ramp(1.5, 1, 2, linear), 0.5);
  assert.equal(ramp(1.5, 1, 2, easeInCubic), 0.125);
});

test("ramp refuses an empty or reversed interval", () => {
  assert.throws(() => ramp(1, 2, 2), /after start/);
  assert.throws(() => ramp(1, 3, 2), /after start/);
});

test("window01 is 0 outside, 1 on the plateau, and fades both ways", () => {
  assert.equal(window01(0, 1, 5, 0.5), 0);
  assert.equal(window01(3, 1, 5, 0.5), 1);
  assert.equal(window01(6, 1, 5, 0.5), 0);
  assert.ok(window01(1.25, 1, 5, 0.5) > 0 && window01(1.25, 1, 5, 0.5) < 1);
  assert.ok(window01(4.75, 1, 5, 0.5) > 0 && window01(4.75, 1, 5, 0.5) < 1);
});

test("lerp hits both ends", () => {
  assert.equal(lerp(2, 6, 0), 2);
  assert.equal(lerp(2, 6, 1), 6);
  assert.equal(lerp(2, 6, 0.5), 4);
});

// The thank-you film: scenes were lengthened after the atlas was keyed on the first cut.
const NOW = [[0, 7], [7, 21], [21, 33], [33, 47], [47, 63], [63, 83]];
const WAS = [[0, 10], [10, 24], [24, 38], [38, 54], [54, 70], [70, 90]];

test("remapTime maps segment ends onto segment ends", () => {
  for (let i = 0; i < NOW.length; i++) {
    assert.ok(Math.abs(remapTime(NOW[i][0], NOW, WAS) - WAS[i][0]) < 1e-9, `start ${i}`);
  }
  assert.equal(remapTime(3.5, NOW, WAS), 5);
});

test("remapTime extends the last segment past its end", () => {
  assert.equal(remapTime(93, NOW, WAS), 90 + (10 / 20) * 20);
});

test("remapTime refuses mismatched segment lists", () => {
  assert.throws(() => remapTime(1, [[0, 1]], []), /equal-length/);
});

test("popScale is 1 before the pop, peaks mid-pop and settles back to 1", () => {
  assert.equal(popScale(0.9, 1, 0.4, 0.1), 1);
  assert.ok(Math.abs(popScale(1.2, 1, 0.4, 0.1) - 1.1) < 1e-12);
  assert.ok(Math.abs(popScale(5, 1, 0.4, 0.1) - 1) < 1e-12);
});
