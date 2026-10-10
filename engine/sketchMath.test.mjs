// Sketch maths (CMO-6823): deterministic, seek-pure, and the reveal behaves.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { BOIL_PX, boilStrokes, SEED, boilVariant, buildShape, formatInt, hachure, hashSeed, mulberry32, polyLength, revealStrokes, roughLine, strokeLength, strokesToPath, textWidth, ellipsePolygon } from "./sketchMath.js";

const SHAPES = [
  { t: "line", p: [[0, 0], [200, 10], [300, 80]] },
  { t: "arrow", from: [0, 0], to: [120, 40] },
  { t: "rect", x: 10, y: 10, w: 300, h: 120, fill: "accentSoft" },
  { t: "ellipse", cx: 100, cy: 100, rx: 60, ry: 40, fill: "x" },
  { t: "person", x: 100, y: 400, h: 200, pose: "work" },
  { t: "person", x: 300, y: 400, h: 200, pose: "busy" },
  { t: "person", x: 500, y: 400, h: 200 },
];

test("same seed gives identical geometry, different seeds differ", () => {
  const a = JSON.stringify(buildShape(SHAPES[4], hashSeed(SEED, 3, 1)));
  assert.equal(a, JSON.stringify(buildShape(SHAPES[4], hashSeed(SEED, 3, 1))));
  assert.notEqual(a, JSON.stringify(buildShape(SHAPES[4], hashSeed(SEED, 3, 2))));
});

test("every shape type builds finite points", () => {
  for (const s of SHAPES) {
    const g = buildShape(s, SEED);
    assert.ok(g.strokes.length > 0);
    for (const st of [...g.strokes, ...g.fills]) for (const [x, y] of st) assert.ok(Number.isFinite(x) && Number.isFinite(y));
  }
  assert.equal(buildShape({ t: "text" }, SEED), null);
  assert.throws(() => buildShape({ t: "person", x: 0, y: 0, h: 1, pose: "nope" }, SEED), /unknown person pose/);
});

test("rough line ends near its targets", () => {
  const pts = roughLine(mulberry32(5), [0, 0], [400, 0]);
  assert.ok(Math.hypot(pts[0][0], pts[0][1]) < 4);
  assert.ok(Math.hypot(pts.at(-1)[0] - 400, pts.at(-1)[1]) < 4);
});

test("reveal is empty at 0, whole at 1, and proportional in between", () => {
  const g = buildShape(SHAPES[4], SEED).strokes;
  assert.deepEqual(revealStrokes(g, 0), []);
  assert.equal(revealStrokes(g, 1), g);
  const half = strokeLength(revealStrokes(g, 0.5));
  assert.ok(Math.abs(half - strokeLength(g) / 2) < 0.5);
  let prev = 0;
  for (let p = 0; p <= 1; p += 0.1) {
    const len = strokeLength(revealStrokes(g, p));
    assert.ok(len >= prev - 1e-9);
    prev = len;
  }
});

test("hachure stays inside the polygon bounds", () => {
  const poly = ellipsePolygon(100, 100, 60, 40);
  for (const seg of hachure(mulberry32(1), poly, 12)) for (const [x, y] of seg) assert.ok(x > 30 && x < 170 && y > 55 && y < 145);
});

test("path data is non-empty and a polyline keeps its length", () => {
  const g = buildShape(SHAPES[0], SEED).strokes;
  assert.match(strokesToPath(g), /^M/);
  assert.ok(polyLength(g[0]) > 200);
});

test("boil variant and helpers are pure", () => {
  assert.equal(boilVariant(1.3), boilVariant(1.3));
  assert.ok([0, 1, 2].includes(boilVariant(9.9)));
  assert.equal(formatInt(48000), "48,000");
  assert.equal(formatInt(20), "20");
  assert.ok(textWidth("abcd", 50) > textWidth("abc", 50));
});

test("sketch source has no unseeded randomness or clock", () => {
  for (const f of ["sketchMath.js", "Sketch.tsx"]) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.doesNotMatch(src, /Math\.random|Date\.now|performance\.now|setTimeout|requestAnimationFrame|transition/);
  }
});

test("boil keeps the drawing: variant 0 is the base, others move each point by at most BOIL_PX", () => {
  const g = buildShape(SHAPES[4], SEED).strokes;
  assert.equal(boilStrokes(g, SEED, 0), g);
  const b = boilStrokes(g, SEED, 2);
  assert.deepEqual(JSON.stringify(b), JSON.stringify(boilStrokes(g, SEED, 2)));
  g.forEach((s, i) => s.forEach((p, j) => assert.ok(Math.abs(b[i][j][0] - p[0]) <= BOIL_PX && Math.abs(b[i][j][1] - p[1]) <= BOIL_PX)));
});
