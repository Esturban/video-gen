import assert from "node:assert/strict";
import test from "node:test";
import { arcPath, bezierAt, camAt, easeInOutCubic, isVisibleFrom } from "./geoMath.js";

// Keys from the Riyadh Lab thank-you film (CMO-8248): [t, lon, lat, radius, cy].
const KEYS = [
  [0, 34, 18, 330, 900],
  [9.5, 8, 14, 350, 890],
  [13.5, -73.4, -3.5, 1250, 800],
];

test("ease lands on 0, 1/2 and 1 and is symmetric", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(Math.abs(easeInOutCubic(0.2) + easeInOutCubic(0.8) - 1) < 1e-12);
});

test("camera holds before the first key and after the last", () => {
  assert.deepEqual(camAt(KEYS, -5), { lon: 34, lat: 18, r: 330, cy: 900 });
  assert.deepEqual(camAt(KEYS, 99), { lon: -73.4, lat: -3.5, r: 1250, cy: 800 });
});

test("camera passes through every key exactly", () => {
  for (const [t, lon, lat, r, cy] of KEYS) {
    const c = camAt(KEYS, t);
    assert.ok(Math.abs(c.lon - lon) < 1e-9 && Math.abs(c.lat - lat) < 1e-9 && Math.abs(c.r - r) < 1e-9 && Math.abs(c.cy - cy) < 1e-9, `key at ${t}`);
  }
});

test("radius moves in log space: the midpoint is the geometric mean", () => {
  const c = camAt(KEYS, (9.5 + 13.5) / 2);
  assert.ok(Math.abs(c.r - Math.sqrt(350 * 1250)) < 1e-9);
});

test("camera is a pure function of time (same t, same answer, any order)", () => {
  const a = camAt(KEYS, 11.2);
  camAt(KEYS, 3);
  assert.deepEqual(camAt(KEYS, 11.2), a);
});

test("empty keys fail loudly", () => {
  assert.throws(() => camAt([], 1), /non-empty/);
});

test("visibility: the camera centre is visible, its antipode and the limb are not", () => {
  const cam = { lon: 46.72, lat: 24.69 };
  assert.equal(isVisibleFrom(cam, [46.72, 24.69]), true);
  assert.equal(isVisibleFrom(cam, [46.72 - 180, -24.69]), false);
  assert.equal(isVisibleFrom({ lon: 0, lat: 0 }, [90, 0]), false); // exactly on the limb counts as hidden
  assert.equal(isVisibleFrom({ lon: 0, lat: 0 }, [88, 0]), true);
});

test("arc control point sits above the chord midpoint by lift times its length", () => {
  const { d, c } = arcPath([0, 100], [200, 100], 0.25);
  assert.deepEqual(c, [100, 50]);
  assert.equal(d, "M0,100 Q100,50 200,100");
});

test("bezier starts at a, ends at b and passes the curve midpoint", () => {
  const a = [0, 0], c = [50, 100], b = [100, 0];
  assert.deepEqual(bezierAt(a, c, b, 0), [0, 0]);
  assert.deepEqual(bezierAt(a, c, b, 1), [100, 0]);
  assert.deepEqual(bezierAt(a, c, b, 0.5), [50, 50]);
});
