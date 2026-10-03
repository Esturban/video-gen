import assert from "node:assert/strict";
import { test } from "node:test";
import { EASINGS, ease, eased, springStep, staggerProgress, staggerStart, tween, win } from "./motionMath.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("every named easing maps 0 to 0, 1 to 1 and never leaves 0..1", () => {
  for (const [name, fn] of Object.entries(EASINGS)) {
    near(fn(0), 0);
    near(fn(1), 1);
    for (let i = 0; i <= 100; i++) {
      const v = fn(i / 100);
      assert.ok(v >= -1e-12 && v <= 1 + 1e-12, `${name}(${i / 100}) = ${v}`);
    }
  }
});

test("ease clamps its input and throws on an unknown curve name", () => {
  near(ease("smooth", -3), 0);
  near(ease("smooth", 9), 1);
  assert.throws(() => ease("bouncy", 0.5), /unknown easing "bouncy"/);
});

test("smooth has zero velocity at both ends (it can come to rest)", () => {
  const h = 1e-4;
  assert.ok(EASINGS.smooth(h) < 1e-9);
  assert.ok(1 - EASINGS.smooth(1 - h) < 1e-9);
});

test("eased is 0 before the window, 1 after it, and win handles a zero-length window", () => {
  near(eased(0.5, 1, 2), 0);
  near(eased(2.5, 1, 2), 1);
  near(win(0.9, 1, 1), 0);
  near(win(1, 1, 1), 1);
});

test("springStep is 0 before, exactly 1 at and after dur", () => {
  near(springStep(-0.1), 0);
  near(springStep(0.45), 1);
  near(springStep(3), 1);
});

test("stagger: item i starts step seconds after item i-1, lands exactly, and is monotonic in time", () => {
  const cfg = { start: 5, step: 0.3, dur: 0.5 };
  near(staggerStart(2, 5, 0.3), 5.6);
  for (const curve of ["easeOutCubic", "smooth", "spring"]) {
    near(staggerProgress(4.99, 1, { ...cfg, curve }), 0);
    near(staggerProgress(5.3 + 0.5, 1, { ...cfg, curve }), 1);
  }
  let prev = -1;
  for (let t = 5; t < 6.5; t += 0.01) {
    const v = staggerProgress(t, 1, { ...cfg, curve: "smooth" });
    assert.ok(v >= prev);
    prev = v;
  }
  assert.ok(staggerProgress(5.35, 0, cfg) > staggerProgress(5.35, 1, cfg), "earlier item is further along");
});

test("tween: starts at initial, lands on each target, and holds between changes", () => {
  const ch = [{ at: 1, to: 10, dur: 0.5 }, { at: 3, to: 4, dur: 1 }];
  near(tween(0, 0, ch), 0);
  near(tween(1, 0, ch), 0);
  near(tween(1.5, 0, ch), 10);
  near(tween(2.9, 0, ch), 10);
  near(tween(4, 0, ch), 4);
  near(tween(99, 0, ch), 4);
});

test("tween never teleports: the largest step between 1ms samples stays small, even when changes overlap", () => {
  const ch = [{ at: 1, to: 100, dur: 0.6 }, { at: 1.3, to: -50, dur: 0.6 }, { at: 2.4, to: 0, dur: 0.4 }];
  let prev = tween(0, 0, ch);
  let worst = 0;
  for (let t = 0.001; t < 4; t += 0.001) {
    const v = tween(t, 0, ch);
    worst = Math.max(worst, Math.abs(v - prev));
    prev = v;
  }
  // total travel is hundreds of units; a jump would be one of them in a single millisecond
  assert.ok(worst < 1.2, `largest 1ms step was ${worst}`);
});

test("tween departs from the current value when a change begins mid-flight", () => {
  const ch = [{ at: 0, to: 10, dur: 1 }, { at: 0.5, to: 0, dur: 1 }];
  const mid = tween(0.5, 0, ch);
  assert.ok(mid > 0 && mid < 10);
  near(tween(0.5 + 1e-9, 0, ch), mid, 1e-6);
  near(tween(1.5, 0, ch), 0);
});

test("tween refuses a zero-length change: that would be a teleport", () => {
  assert.throws(() => tween(1, 0, [{ at: 1, to: 5, dur: 0 }]), /teleport/);
});

test("tween is a pure function of t: same t, same value, any order", () => {
  const ch = [{ at: 1, to: 10, dur: 0.5, curve: "easeOutCubic" }];
  const a = [2, 1.2, 0.5, 1.2].map((t) => tween(t, 0, ch));
  assert.equal(a[1], a[3]);
});
