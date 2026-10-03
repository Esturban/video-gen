import assert from "node:assert/strict";
import { test } from "node:test";
import { driftOffset, layerShift, motes } from "./parallaxMath.js";

test("factor 1 is fixed in the world, factor 0 follows the camera exactly", () => {
  const cam = { cx: 900, cy: -40, zoom: 1 };
  assert.deepEqual(layerShift(cam, 1), [0, 0]);
  assert.deepEqual(layerShift(cam, 0), [900, -40]);
});

test("a far layer appears to move less than the camera, a near layer more", () => {
  const [a, b] = [{ cx: 0, cy: 0, zoom: 1 }, { cx: 1000, cy: 0, zoom: 1 }];
  const apparent = (f) => (b.cx - layerShift(b, f)[0]) - (a.cx - layerShift(a, f)[0]);
  assert.equal(apparent(0.4), 400);
  assert.equal(apparent(1.3), 1300);
});

test("drift is linear in time and zero at t = 0", () => {
  assert.deepEqual(driftOffset(0, [5, -3]), [0, 0]);
  assert.deepEqual(driftOffset(10, [5, -3]), [50, -30]);
});

test("motes are deterministic, inside the box, and sized in range", () => {
  const box = { x0: -100, y0: -50, x1: 400, y1: 250 };
  const a = motes(24, box, { minR: 4, maxR: 14 });
  assert.deepEqual(a, motes(24, box, { minR: 4, maxR: 14 }));
  assert.equal(a.length, 24);
  for (const m of a) {
    assert.ok(m.x >= box.x0 && m.x <= box.x1 && m.y >= box.y0 && m.y <= box.y1);
    assert.ok(m.r >= 4 && m.r <= 14);
  }
  assert.equal(new Set(a.map((m) => `${m.x.toFixed(3)},${m.y.toFixed(3)}`)).size, 24);
});
