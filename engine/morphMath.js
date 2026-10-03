// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (our own, round 3) for eased progress; this file adds shape maths only. Method reference only, no code copied: remotion-dev/remotion @remotion/paths interpolatePath (MIT) was considered, and this hand-rolls equal-length point lists instead so no dependency is added and every shape shares one point layout.
// Pure shape maths for morphing. A "poly" is a flat array [x0, y0, x1, y1, ...] with exactly POLY_POINTS points, always laid out the same way:
// four sides (top, right, bottom, left, clockwise on screen), SIDES points per side, starting at the first corner. Because every generator below
// uses that one layout, any two polys can be interpolated point by point, and a shape can pass through a rectangle, a ring wedge, a line segment,
// a circle and a card with no re-sampling and no jump. Everything is a pure function of its inputs (no state between frames).

export const SIDES = 28;
export const POLY_POINTS = 4 * SIDES;
export const POLY_LENGTH = POLY_POINTS * 2;

export const lerp = (a, b, k) => a + (b - a) * k;

/**
 * Point on a strip bent into a circular arc. (u, v) are strip coordinates: u along the strip, v across it (v up is positive).
 * kappa is the curvature, 1 / radius. kappa = 0 is the flat strip, (u, v) maps to (u, -v). For kappa > 0 the strip lies on a circle of radius 1/kappa whose
 * centre is (0, 1/kappa), touching the baseline at u = 0, with v pointing away from the centre. Stable as kappa approaches 0.
 */
export function bendPoint(u, v, kappa) {
  if (Math.abs(kappa) < 1e-9) return [u, -v];
  const radius = 1 / kappa;
  const theta = u * kappa;
  const sin = Math.sin(theta);
  const half = Math.sin(theta / 2);
  return [(radius + v) * sin, 2 * radius * half * half - v * Math.cos(theta)];
}

const sideSamples = (from, to, count) => Array.from({ length: count }, (_, j) => [lerp(from[0], to[0], j / count), lerp(from[1], to[1], j / count)]);
const flat = (points) => points.flatMap((p) => [p[0], p[1]]);

/**
 * A rectangle in strip space bent by `kappa`, moved by (ox, oy). Rectangle sides in (u, v): top v1 from u0 to u1, right u1 from v1 to v0, bottom v0 from u1 to u0, left u0 from v0 to v1.
 * With kappa = 0 this is exactly the screen rectangle x in [ox + u0, ox + u1], y in [oy - v1, oy - v0].
 * @param {{ u0: number, u1: number, v0: number, v1: number, kappa: number, ox: number, oy: number }} s
 */
export function bentRectPoly({ u0, u1, v0, v1, kappa, ox, oy }, sides = SIDES) {
  const corners = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
  const pts = corners.flatMap((c, i) => sideSamples(c, corners[(i + 1) % 4], sides));
  return flat(pts.map(([u, v]) => { const [x, y] = bendPoint(u, v, kappa); return [x + ox, y + oy]; }));
}

/** A quadrilateral from four corners in order top-left, top-right, bottom-right, bottom-left (same layout as every other poly). */
export function quadPoly(c0, c1, c2, c3, sides = SIDES) {
  const corners = [c0, c1, c2, c3];
  return flat(corners.flatMap((c, i) => sideSamples(c, corners[(i + 1) % 4], sides)));
}

/**
 * Point u (0 up to 1) of the way along quadrant q of a rounded rectangle. A quadrant runs from the middle of one corner arc to the middle of the next
 * (q = 0 top, 1 right, 2 bottom, 3 left), sampled by arc length. r = 0 gives sharp corners, r = min(w, h) / 2 gives a circle or a pill.
 * Every shape from a rectangle to a circle has the same point layout, so they morph into each other by plain interpolation.
 */
export function roundedRectPoint(cx, cy, w, h, r, q, u) {
  const a = w / 2;
  const b = h / 2;
  const radius = Math.max(0, Math.min(r, a, b));
  const [A, B] = q % 2 === 0 ? [a, b] : [b, a];
  const side = 2 * (A - radius);
  const arc = (Math.PI * radius) / 4;
  const s = u * (2 * arc + side);
  let x;
  let y;
  if (s < arc) {
    const phi = -0.75 * Math.PI + s / radius;
    x = -(A - radius) + radius * Math.cos(phi);
    y = -(B - radius) + radius * Math.sin(phi);
  } else if (s < arc + side) {
    x = -(A - radius) + (s - arc);
    y = -B;
  } else {
    const phi = -0.5 * Math.PI + (radius > 0 ? (s - arc - side) / radius : 0);
    x = A - radius + radius * Math.cos(phi);
    y = -(B - radius) + radius * Math.sin(phi);
  }
  for (let i = 0; i < q; i++) [x, y] = [-y, x]; // quarter turn clockwise on screen
  return [cx + x, cy + y];
}

/** Rounded rectangle poly centred on (cx, cy). */
export function roundedRectPoly(cx, cy, w, h, r, sides = SIDES) {
  const out = [];
  for (let q = 0; q < 4; q++) for (let j = 0; j < sides; j++) out.push(...roundedRectPoint(cx, cy, w, h, r, q, j / sides));
  return out;
}

/** Circle as a poly, same layout as a rectangle: point 0 is the top-left diagonal, so a square becomes a circle without twisting. */
export const circlePoly = (cx, cy, radius, sides = SIDES) => roundedRectPoly(cx, cy, radius * 2, radius * 2, radius, sides);

/** Every point of the poly at one place: the zero-size end of any shape that should be pulled into something. */
export const pointPoly = (x, y, sides = SIDES) => Array.from({ length: 4 * sides }, () => [x, y]).flat();

/** Point-by-point interpolation. k = 0 returns a, k = 1 returns b, exactly. */
export function morphPoly(a, b, k) {
  if (a.length !== b.length) throw new Error(`cannot morph polys of different length (${a.length} vs ${b.length}); build both with the same SIDES`);
  if (k <= 0) return a;
  if (k >= 1) return b;
  return a.map((v, i) => v + (b[i] - v) * k);
}

/** SVG path data for a poly. Straight segments between the dense samples, closed. */
export function polyPath(poly) {
  let d = "";
  for (let i = 0; i < poly.length; i += 2) d += `${i === 0 ? "M" : "L"}${poly[i].toFixed(2)} ${poly[i + 1].toFixed(2)}`;
  return `${d}Z`;
}

/** Shoelace area of a poly, absolute. Used to tell a collapsed shape (nothing to draw) from a visible one. */
export function polyArea(poly) {
  let sum = 0;
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += poly[2 * i] * poly[2 * j + 1] - poly[2 * j] * poly[2 * i + 1];
  }
  return Math.abs(sum) / 2;
}

/** Largest distance any single point is from the matching point of another poly. The continuity measure the tests use. */
export function maxPointDistance(a, b) {
  let worst = 0;
  for (let i = 0; i < a.length; i += 2) worst = Math.max(worst, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1]));
  return worst;
}

/** The quadrilateral for a line segment from p to q with stroke width w, ends extended by half the width so joints overlap with no notch. Same layout as a bar. */
export function segmentQuad(p, q, w, sides = SIDES) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  const d = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  const up = [d[1], -d[0]];
  const cap = w / 2;
  const at = (pt, sign, side) => [pt[0] + d[0] * cap * sign + up[0] * (w / 2) * side, pt[1] + d[1] * cap * sign + up[1] * (w / 2) * side];
  return quadPoly(at(p, -1, 1), at(q, 1, 1), at(q, 1, -1), at(p, -1, -1), sides);
}
