import assert from "node:assert/strict";
import { test } from "node:test";
import { cursor, drag, follow, progress, spring } from "./time.js";

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("spring is 0 before the step and settles at 1 for all damping regimes", () => {
  for (const damping of [10, 2 * Math.sqrt(170), 60]) {
    near(spring(0, { damping }), 0);
    near(spring(-1, { damping }), 0);
    near(spring(8, { damping }), 1);
  }
});

test("spring is a pure function of t: same t, same value, any order", () => {
  const ts = [3, 0.2, 1.1, 0.2];
  const vals = ts.map((t) => spring(t));
  assert.equal(vals[1], vals[3]);
});

test("follow sums one spring per target change", () => {
  const keys = [[0, 10], [1, 50], [2, 30]];
  near(follow(0.5, keys), 10);
  near(follow(9, keys), 30);
  near(follow(1.5, keys), 10 + 40 * spring(0.5));
});

test("progress is eased, clamped, and handles zero-length windows", () => {
  near(progress(-1, 0, 2), 0);
  near(progress(5, 0, 2), 1);
  near(progress(1, 1, 1), 1);
  assert.ok(progress(1, 0, 2) > 0.5);
});

test("cursor presses only on click waypoints", () => {
  const path = [[0, 0, 0], [1, 100, 100, true]];
  assert.equal(cursor(0.5, path).press, 0);
  assert.ok(cursor(1 + 0.09, path).press > 0.9);
  near(cursor(9, path).x, 100);
});

test("drag holds while moving and releases once settled", () => {
  const d = { at: 1, from: [0, 0], to: [200, 0] };
  assert.equal(drag(0.5, d).held, false);
  assert.equal(drag(0.9, d).held, true);
  assert.equal(drag(1.2, d).held, true);
  const end = drag(9, d);
  near(end.x, 200);
  assert.equal(end.held, false);
});
