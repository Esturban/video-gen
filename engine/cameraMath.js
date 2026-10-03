// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (our own) for clamp; the camera is one monotone cubic Hermite spline through keyframes, so it never stops dead and never jumps.
// Pure camera path: a continuous glide across a larger canvas, a function of t (seconds) only. Used by the data-story piece; any scene can reuse it.
import { clamp } from "./motionMath.js";

/**
 * Camera state at time t. keys: [[t, cx, cy, zoom], ...] sorted by time, at least two. Position and zoom follow a C1 spline (continuous velocity)
 * through the keys, so the camera glides through each key instead of stopping on it. The first and last key are rest points (zero velocity).
 * Before the first key and after the last it holds. Place two keys close together with a small offset for a slow drift during a hold.
 * @param {number} t
 * @param {ReadonlyArray<readonly number[]>} keys
 * @returns {{ cx: number, cy: number, zoom: number }}
 */
export function cameraAt(t, keys) {
  if (keys.length < 2) throw new Error("camera needs at least two keys [t, cx, cy, zoom]");
  for (let i = 1; i < keys.length; i++) if (!(keys[i][0] > keys[i - 1][0])) throw new Error(`camera keys must be strictly increasing in time (key ${i} at ${keys[i][0]})`);
  if (t <= keys[0][0]) return { cx: keys[0][1], cy: keys[0][2], zoom: keys[0][3] };
  if (t >= keys[keys.length - 1][0]) { const k = keys[keys.length - 1]; return { cx: k[1], cy: k[2], zoom: k[3] }; }
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const [k0, k1] = [keys[i], keys[i + 1]];
  const h = k1[0] - k0[0];
  const s = clamp((t - k0[0]) / h);
  // Monotone cubic tangents (Fritsch-Carlson): C1 like Catmull-Rom, but a component never overshoots between keys, so a still hold followed by a long move
  // eases in with no backward dip. Where the neighbouring slopes change sign the tangent is zero (the camera comes to a soft rest there).
  const slope = (idx, comp) => (keys[idx + 1][comp] - keys[idx][comp]) / (keys[idx + 1][0] - keys[idx][0]);
  const tangent = (idx, comp) => {
    if (idx <= 0 || idx >= keys.length - 1) return 0;
    const [d0, d1] = [slope(idx - 1, comp), slope(idx, comp)];
    if (d0 * d1 <= 0) return 0;
    const [h0, h1] = [keys[idx][0] - keys[idx - 1][0], keys[idx + 1][0] - keys[idx][0]];
    const [w0, w1] = [2 * h1 + h0, h1 + 2 * h0];
    return (w0 + w1) / (w0 / d0 + w1 / d1);
  };
  const hermite = (comp) => {
    const [p0, p1] = [k0[comp], k1[comp]];
    const [m0, m1] = [tangent(i, comp) * h, tangent(i + 1, comp) * h];
    const [s2, s3] = [s * s, s * s * s];
    return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
  };
  return { cx: hermite(1), cy: hermite(2), zoom: hermite(3) };
}

/** SVG viewBox string for a camera on a width x height canvas: the world window the camera sees. */
export const viewBoxFor = ({ cx, cy, zoom }, width, height) => `${cx - width / (2 * zoom)} ${cy - height / (2 * zoom)} ${width / zoom} ${height / zoom}`;
