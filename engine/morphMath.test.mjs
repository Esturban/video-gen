import assert from "node:assert/strict";
import { test } from "node:test";
import { POLY_LENGTH, SIDES, bendPoint, bentRectPoly, circlePoly, maxPointDistance, morphPoly, pointPoly, polyArea, polyPath, quadPoly, roundedRectPoly, segmentQuad } from "./morphMath.js";
import { mixRgb, parseColor, rgbCss } from "./colorMath.js";
import { cameraAt, viewBoxFor } from "./cameraMath.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("every generator returns the same layout length", () => {
  const shapes = [
    bentRectPoly({ u0: -50, u1: 50, v0: -10, v1: 10, kappa: 0.01, ox: 5, oy: 6 }),
    quadPoly([0, 0], [10, 0], [10, 10], [0, 10]),
    roundedRectPoly(0, 0, 100, 60, 12),
    circlePoly(0, 0, 30),
    pointPoly(4, 4),
    segmentQuad([0, 0], [100, 40], 10),
  ];
  for (const s of shapes) assert.equal(s.length, POLY_LENGTH);
});

test("morphPoly returns exactly a at 0 and exactly b at 1", () => {
  const a = roundedRectPoly(10, 20, 200, 80, 0);
  const b = circlePoly(300, 40, 60);
  assert.deepEqual(morphPoly(a, b, 0), a);
  assert.deepEqual(morphPoly(a, b, 1), b);
  assert.throws(() => morphPoly([1, 2], [1, 2, 3, 4], 0.5), /different length/);
});

test("morph distance from the start grows monotonically and moves in small steps (continuous)", () => {
  const a = roundedRectPoly(0, 0, 150, 400, 0);
  const b = circlePoly(500, -100, 40);
  let prev = 0;
  let last = a;
  for (let i = 1; i <= 200; i++) {
    const p = morphPoly(a, b, i / 200);
    const d = maxPointDistance(a, p);
    assert.ok(d >= prev - 1e-9, `distance fell at step ${i}`);
    assert.ok(maxPointDistance(last, p) < 6, `step ${i} jumped ${maxPointDistance(last, p)}`);
    prev = d;
    last = p;
  }
});

test("bendPoint: flat at kappa 0, on a circle of radius 1/kappa + v otherwise, continuous as kappa shrinks", () => {
  assert.deepEqual(bendPoint(30, 7, 0), [30, -7]);
  const kappa = 1 / 200;
  const [x, y] = bendPoint(120, 15, kappa);
  near(Math.hypot(x - 0, y - 200), 215, 1e-6);
  const flat = bendPoint(120, 15, 0);
  const almost = bendPoint(120, 15, 1e-7);
  assert.ok(Math.hypot(flat[0] - almost[0], flat[1] - almost[1]) < 0.01);
});

test("bentRectPoly with kappa 0 is exactly the screen rectangle", () => {
  const bent = bentRectPoly({ u0: -40, u1: 60, v0: -5, v1: 25, kappa: 0, ox: 1000, oy: 200 });
  const flat = roundedRectPoly(1010, 190, 100, 30, 0);
  near(maxPointDistance(bent, flat), 0, 1e-9);
});

test("a bent full-turn strip closes into a ring: points sit at radius R + v from the centre", () => {
  const R = 240;
  const L = 2 * Math.PI * R;
  const poly = bentRectPoly({ u0: -L / 2, u1: L / 2, v0: -50, v1: 50, kappa: 1 / R, ox: 0, oy: -R });
  for (let i = 0; i < poly.length; i += 2) {
    const d = Math.hypot(poly[i], poly[i + 1]);
    assert.ok(Math.abs(d - 290) < 1e-6 || Math.abs(d - 190) < 1e-6 || (d > 189 && d < 291), `radius ${d}`);
  }
});

test("circlePoly lies on the circle and a rounded rect with r = 0 equals the sharp quad", () => {
  const c = circlePoly(100, 50, 40);
  for (let i = 0; i < c.length; i += 2) near(Math.hypot(c[i] - 100, c[i + 1] - 50), 40, 1e-9);
  const sharp = roundedRectPoly(0, 0, 100, 60, 0);
  const quad = quadPoly([-50, -30], [50, -30], [50, 30], [-50, 30]);
  near(maxPointDistance(sharp, quad), 0, 1e-9);
});

test("a square and a circle share a layout: no point travels more than the corner offset (no twisting)", () => {
  const sq = roundedRectPoly(0, 0, 100, 100, 0);
  const c = circlePoly(0, 0, 50);
  assert.ok(maxPointDistance(sq, c) < 50 * (Math.SQRT2 - 1) + 1, `${maxPointDistance(sq, c)}`);
});

test("segmentQuad covers the segment and polyArea tells collapsed from visible", () => {
  const q = segmentQuad([0, 0], [100, 0], 10);
  near(polyArea(q), 110 * 10, 1e-6);
  assert.ok(polyArea(pointPoly(5, 5)) < 1e-9);
  assert.ok(polyPath(q).startsWith("M") && polyPath(q).endsWith("Z"));
});

test("sides constant is the layout contract", () => assert.equal(POLY_LENGTH, SIDES * 8));

test("colour mix: endpoints exact, hex and rgb() both parse, a mix of a mix never goes NaN", () => {
  assert.deepEqual(mixRgb("#000000", "#ffffff", 0), [0, 0, 0]);
  assert.deepEqual(mixRgb("#000000", "#ffffff", 1), [255, 255, 255]);
  assert.deepEqual(parseColor("rgb(10, 20, 30)"), [10, 20, 30]);
  const nested = mixRgb(mixRgb("#2f5d5a", "#ffffff", 0.4), rgbCss(mixRgb("#000", "#fff", 0.5)), 0.3);
  assert.ok(nested.every(Number.isFinite));
  assert.throws(() => parseColor("teal"), /cannot parse/);
  assert.equal(rgbCss([1.4, 2.6, 3], 1), "rgb(1,3,3)");
});

test("camera: holds before and after, passes through keys, velocity is continuous across a key", () => {
  const keys = [[0, 0, 0, 1], [2, 100, 0, 1.2], [4, 300, 50, 0.9], [6, 320, 50, 1]];
  assert.deepEqual(cameraAt(-1, keys), { cx: 0, cy: 0, zoom: 1 });
  assert.deepEqual(cameraAt(99, keys), { cx: 320, cy: 50, zoom: 1 });
  near(cameraAt(2, keys).cx, 100);
  near(cameraAt(4, keys).zoom, 0.9);
  const e = 1e-4;
  const vel = (t) => (cameraAt(t + e, keys).cx - cameraAt(t - e, keys).cx) / (2 * e);
  near(vel(2 - 0.001), vel(2 + 0.001), 5);
  let last = cameraAt(0, keys);
  for (let i = 1; i <= 600; i++) {
    const c = cameraAt(i / 100, keys);
    assert.ok(Math.hypot(c.cx - last.cx, c.cy - last.cy) < 8, `camera jumped at ${i / 100}`);
    last = c;
  }
  assert.throws(() => cameraAt(1, [[0, 0, 0, 1]]), /at least two/);
  assert.throws(() => cameraAt(1, [[0, 0, 0, 1], [0, 1, 1, 1]]), /increasing/);
});

test("viewBoxFor shows width / zoom of world centred on the camera", () => {
  assert.equal(viewBoxFor({ cx: 100, cy: 50, zoom: 2 }, 1440, 1440), `${100 - 360} ${50 - 360} 720 720`);
});
