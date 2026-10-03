// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (our own) for mix(); colours are held as [r, g, b] triples through a whole chain of mixes and turned into a CSS string only once, so nested mixes can never parse a rgb() string by accident (round 3 lesson: that renders NaN).
// Pure colour helpers for morphs: parse "#rrggbb" or "rgb(r,g,b)" once, mix as numbers, format at the end.
import { mix } from "./motionMath.js";

/** @returns {[number, number, number]} */
export function parseColor(c) {
  if (Array.isArray(c)) return /** @type {[number, number, number]} */ (c);
  const s = String(c).trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  const hex = /^#([0-9a-f]{6})$/i.exec(short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : s);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((v) => Number(v));
    if ([r, g, b].every(Number.isFinite)) return [r, g, b];
  }
  throw new Error(`cannot parse colour "${c}" (use #rrggbb or rgb(r,g,b))`);
}

/** Mix two colours (any accepted form) by k, 0 gives a and 1 gives b exactly. Returns a [r, g, b] triple. */
export const mixRgb = (a, b, k) => {
  const [pa, pb] = [parseColor(a), parseColor(b)];
  return /** @type {[number, number, number]} */ (pa.map((v, i) => mix(v, pb[i], k)));
};

export const rgbCss = (c, alpha = 1) => {
  const [r, g, b] = parseColor(c).map((v) => Math.round(v));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
};
