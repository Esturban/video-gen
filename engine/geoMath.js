// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/cameraMath.js (a 2D viewBox spline for svg cameras, not a lon/lat globe),
//   1_social/py/video-gen/engine/motionMath.js (named easings; easeInOutCubic below is the exact curve the Riyadh thank-you film
//   shipped with, kept bit-identical so its re-render matches).
// Pure globe and map maths (CMO-8248, from the Riyadh Lab thank-you film): a keyed orthographic camera, hemisphere visibility,
// and lifted screen-space arcs for flight trails. No d3 here, so node:test runs it directly; engine/geo.ts adds the d3 projections.

/** Cubic ease in-out on 0..1. */
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * Globe camera at time t from keys [t, lon, lat, radius, cy], sorted by t. Held before the first key and after the last.
 * Between keys the ease is cubic in-out; the radius moves in log space so a zoom feels even at every scale.
 * @param {[number, number, number, number, number][]} keys
 * @param {number} t
 */
export const camAt = (keys, t) => {
  if (!Array.isArray(keys) || keys.length === 0) throw new Error("camAt: keys must be a non-empty array of [t, lon, lat, radius, cy]");
  if (t <= keys[0][0]) return { lon: keys[0][1], lat: keys[0][2], r: keys[0][3], cy: keys[0][4] };
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1];
      const b = keys[i];
      const p = easeInOutCubic((t - a[0]) / (b[0] - a[0]));
      return {
        lon: a[1] + (b[1] - a[1]) * p,
        lat: a[2] + (b[2] - a[2]) * p,
        r: Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * p),
        cy: a[4] + (b[4] - a[4]) * p,
      };
    }
  }
  const z = keys[keys.length - 1];
  return { lon: z[1], lat: z[2], r: z[3], cy: z[4] };
};

/** Cosine margin past the limb: a point this close to the edge of the globe counts as hidden (avoids pins flickering on the rim). */
export const LIMB_MARGIN = 0.02;

/**
 * True when [lon, lat] is on the visible hemisphere of an orthographic camera centred on cam.lon, cam.lat.
 * @param {{ lon: number, lat: number }} cam
 * @param {[number, number]} ll
 */
export const isVisibleFrom = (cam, ll) => {
  const toRad = Math.PI / 180;
  const [l1, p1] = [ll[0] * toRad, ll[1] * toRad];
  const [l0, p0] = [cam.lon * toRad, cam.lat * toRad];
  const cosD = Math.sin(p0) * Math.sin(p1) + Math.cos(p0) * Math.cos(p1) * Math.cos(l1 - l0);
  return cosD > LIMB_MARGIN;
};

/**
 * Screen-space arc from a to b, lifted by `lift` times the chord length: an svg path and its control point.
 * @param {[number, number]} a
 * @param {[number, number]} b
 */
export const arcPath = (a, b, lift = 0.28) => {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  /** @type {[number, number]} */
  const c = [mx, my - d * lift];
  return { d: `M${a[0]},${a[1]} Q${c[0]},${c[1]} ${b[0]},${b[1]}`, c };
};

/**
 * Point at p (0..1) on the quadratic bezier a, c, b.
 * @param {[number, number]} a
 * @param {[number, number]} c
 * @param {[number, number]} b
 * @param {number} p
 * @returns {[number, number]}
 */
export const bezierAt = (a, c, b, p) => {
  const q = 1 - p;
  return [q * q * a[0] + 2 * q * p * c[0] + p * p * b[0], q * q * a[1] + 2 * q * p * c[1] + p * p * b[1]];
};
