// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/chartStoryMath.js (its line stage is one step of a fixed chain with no log axis, no markers, no source line, so it cannot carry a sourced time series); engine/time.js clamp01 (our own).
// Pure maths for GrowLine: a growing line over a log y axis. Every value here is a function of its inputs, so any frame can be drawn alone.

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smoothstep 0..1 of x between a and b, for a steady draw that eases in and out. */
export const smooth = (x, a, b) => {
  if (b <= a) return x >= a ? 1 : 0;
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/**
 * Geometry for a canvas of width W and height H, in px. Everything scales with k = min(W, H) / 1080.
 * Wide canvases put the headline number at the top right; square ones stack it under the title.
 */
export function layoutFor(W, H) {
  if (!(W > 0) || !(H > 0)) throw new Error(`layoutFor needs a positive size, got ${W} x ${H}`);
  const k = Math.min(W, H) / 1080;
  const wide = W / H > 1.3;
  const M = 64 * k;
  const titleY = M + 44 * k;
  const subY = titleY + 42 * k;
  const stat = wide ? { x: W - M, y: M + 104 * k, anchor: "end" } : { x: M, y: subY + 122 * k, anchor: "start" };
  const left = M + 150 * k;
  const right = W - M - 30 * k;
  const top = wide ? M + 150 * k : stat.y + 44 * k;
  const bottom = 0.9 * H - 190 * k;
  return { k, wide, M, title: { x: M, y: titleY }, sub: { x: M, y: subY }, stat, chart: { left, right, top, bottom }, source: { x: M, y: H - M } };
}

/** Y px of value v on a log10 axis whose exponents run lo (at bottom) to hi (at top). */
export function logY(v, lo, hi, top, bottom) {
  if (!(v > 0)) throw new Error(`logY needs a positive value, got ${v}`);
  if (!(hi > lo)) throw new Error(`logY needs hi > lo, got ${lo} and ${hi}`);
  return bottom - ((Math.log10(v) - lo) / (hi - lo)) * (bottom - top);
}

/** X px of point i of n, spread evenly between left + pad and right - pad. */
export function pointX(i, n, left, right, pad) {
  if (n < 2) throw new Error(`pointX needs at least 2 points, got ${n}`);
  return left + pad + (i / (n - 1)) * (right - left - 2 * pad);
}

/** Fractional index the line tip has reached: from at p = 0, to at p = 1. */
export const tipIndex = (from, to, p) => from + (to - from) * clamp01(p);

/** Screen points of the line up to the tip: every whole point at or before it, then the tip itself on its segment. Empty while the tip is before point 0. */
export function visiblePoints(pts, tip) {
  if (!(tip >= 0) || pts.length === 0) return [];
  const last = pts.length - 1;
  const t = Math.min(tip, last);
  const whole = Math.floor(t);
  const out = pts.slice(0, whole + 1);
  const f = t - whole;
  if (f > 0 && whole < last) {
    const a = pts[whole];
    const b = pts[whole + 1];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

/** Alpha of a marker or callout at point idx given the tip: fades in over `lead` index units as the tip arrives, 1 once it has passed. */
export const arrivalAlpha = (tip, idx, lead = 0.35) => clamp01((tip - idx + lead) / lead);

/** SVG path data for a list of points, two decimals so the output is stable. */
export const pathOf = (p) => p.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join(" ");

/** Mantissa (one decimal) and exponent of a positive number, for "8.7 x 10^21" style text. Rounding up to 10.0 carries into the exponent. */
export function sci(v) {
  if (!(v > 0)) throw new Error(`sci needs a positive value, got ${v}`);
  let e = Math.floor(Math.log10(v));
  let m = Math.round((v / 10 ** e) * 10) / 10;
  if (m >= 10) {
    m = 1;
    e += 1;
  }
  return { m: m.toFixed(1), e };
}

/** Whole-number text with thousands separators, rounded to the nearest 1000 above 10000: 114375 -> "114,000". */
export function roundedCount(n) {
  if (!(n >= 0)) throw new Error(`roundedCount needs a non-negative number, got ${n}`);
  const r = n >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n);
  return r.toLocaleString("en-US");
}

/** Growth factor per step between the first and last value over `steps` equal steps: (last / first) ^ (1 / steps). */
export function growthPerStep(first, last, steps) {
  if (!(first > 0) || !(last > 0) || !(steps > 0)) throw new Error(`growthPerStep needs positive inputs, got ${first}, ${last}, ${steps}`);
  return (last / first) ** (1 / steps);
}

/** Running maximum: out[i] = max(values[0..i]). */
export function runningMax(values) {
  let best = -Infinity;
  return values.map((v) => (best = Math.max(best, v)));
}

/**
 * Whether the headline stat of beat n enters (fades in) or is already on screen from the beat before.
 * It carries over, with no exit and no entry, when the previous beat declares the same text and note and does not count; a counting stat always enters (its count is expected to have finished before the next beat starts).
 * @param {{ stat?: { text: string, note: string, count?: unknown } }[]} beats
 * @param {number} n index into beats
 */
export function statEnters(beats, n) {
  const cur = beats[n]?.stat;
  if (!cur) return false;
  const prev = n > 0 ? beats[n - 1]?.stat : undefined;
  if (cur.count || !prev) return true;
  return prev.text !== cur.text || prev.note !== cur.note;
}

/** Opacity of the stat t seconds into its beat: a fade over [a, b] when it enters, otherwise fully on from the first frame. */
export const statOpacity = (t, enters, a = 0.05, b = 0.6) => (enters ? smooth(t, a, b) : 1);
