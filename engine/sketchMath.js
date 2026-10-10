// REUSE_CHECKED: none
// Searched video-gen/engine, content-thinking/video and bin/card-prompts for excalidraw, rough, virgil and hachure: no sketch renderer exists, only the Virgil font on the host.
// Method reference only, no code copied: rough.js (double stroke, hachure fill, jittered endpoints) and Excalidraw's look. Written from scratch so the jitter is seeded and seek-pure.
// Pure maths for the hand-drawn Sketch part (engine/Sketch.tsx), CMO-6823. A diagram is data (a list of shapes); every point here is a pure function of (shape, seed).
// Wobble comes from a seeded generator (mulberry32), never a clock or an unseeded source, so any frame draws alone and in any order.
// "Boil": the seed variant steps at BOIL_FPS (a function of t), which gives the slight re-drawn shimmer of hand-animated line work.
import { countValue } from "./countValue.js";
import { EASINGS, win } from "./motionMath.js";

export const SEED = 1776; // constant base seed for every diagram
export const BOIL_FPS = 6;
export const BOIL_VARIANTS = 3;
const AMP = 2.4; // px: base jitter of a stroke
const SEGMENT_PX = 64; // px per wobble point along a line
const HEAD_RATIO = 0.12;
const CHAR_EM = 0.62; // average Virgil advance as a fraction of the font size (over-estimates a little so clips never cut a glyph)

/** mulberry32: small seeded generator, returns a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes whole numbers into one 32 bit seed. */
export function hashSeed(...nums) {
  let h = 2166136261;
  for (const n of nums) {
    h ^= Math.floor(n) | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Which of the BOIL_VARIANTS jitter sets is on screen at time t (seconds). */
export const boilVariant = (t) => Math.floor(Math.max(0, t) * BOIL_FPS) % BOIL_VARIANTS;

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp2 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

/** Total length of a polyline. */
export const polyLength = (pts) => pts.reduce((sum, p, i) => (i === 0 ? 0 : sum + dist(pts[i - 1], p)), 0);
/** Total length of a list of polylines. */
export const strokeLength = (strokes) => strokes.reduce((sum, s) => sum + polyLength(s), 0);

/** One wobbly pass from a to b: endpoints land near the targets, the middle bows and shakes. */
export function roughLine(r, a, b, amp = AMP) {
  const len = dist(a, b);
  if (len === 0) return [a, b];
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const k = Math.min(amp, len * 0.06 + 0.4);
  const n = Math.max(2, Math.round(len / SEGMENT_PX));
  const bow = (r() - 0.5) * k * 2.4;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const base = lerp2(a, b, i / n);
    const edge = i === 0 || i === n;
    const off = (r() - 0.5) * k * (edge ? 1.2 : 2) + Math.sin((Math.PI * i) / n) * bow;
    const along = edge ? (r() - 0.5) * k : 0;
    pts.push([base[0] - uy * off + ux * along, base[1] + ux * off + uy * along]);
  }
  return pts;
}

/** Two passes over the same line, like a pen that goes back over it. */
export const doubleLine = (r, a, b, amp = AMP) => [roughLine(r, a, b, amp), roughLine(r, b, a, amp * 0.8)];

/** A hand-drawn ellipse: wobbling radius, starts at a seeded angle and overshoots the start a little. */
export function roughEllipse(r, cx, cy, rx, ry, amp = AMP) {
  const pass = (turns) => {
    const n = Math.max(14, Math.round((Math.PI * (rx + ry)) / 22));
    const start = r() * Math.PI * 2;
    const wob = [];
    for (let i = 0; i <= Math.round(n * turns); i++) {
      const ang = start + (i / n) * Math.PI * 2;
      const k = 1 + ((r() - 0.5) * amp * 1.6) / Math.max(rx, ry, 1);
      wob.push([cx + Math.cos(ang) * rx * k, cy + Math.sin(ang) * ry * k]);
    }
    return wob;
  };
  return [pass(1.08), pass(1.04)];
}

/** Outline of an axis-aligned rectangle as wobbling double lines. */
export function roughRect(r, x, y, w, h, amp = AMP) {
  const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return c.flatMap((p, i) => doubleLine(r, p, c[(i + 1) % 4], amp));
}

/** Exact polygon points of an ellipse (used only to clip hachure fill). */
export const ellipsePolygon = (cx, cy, rx, ry, n = 48) =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry]);

/** Hachure fill: parallel pen strokes at `angle` degrees, `gap` px apart, clipped to a polygon (even-odd), each one wobbled. */
export function hachure(r, poly, gap = 15, angle = -41, amp = 1.4) {
  const th = (angle * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const rot = poly.map(([x, y]) => [x * c + y * s, -x * s + y * c]); // into the hatch frame: lines run along +x
  const back = (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  const ys = rot.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const out = [];
  let flip = false;
  for (let y = lo + gap / 2; y < hi; y += gap) {
    const xs = [];
    for (let i = 0; i < rot.length; i++) {
      const p = rot[i];
      const q = rot[(i + 1) % rot.length];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = [xs[i] + 3, y];
      const b = [xs[i + 1] - 3, y];
      if (b[0] <= a[0]) continue;
      out.push(roughLine(r, flip ? back(b) : back(a), flip ? back(a) : back(b), amp));
    }
    flip = !flip;
  }
  return out;
}

const POSES = {
  idle: { l: [-0.17, -0.4], r: [0.17, -0.4] },
  busy: { l: [-0.21, -0.8], r: [0.21, -0.8] },
  work: { l: [-0.15, -0.44], r: [0.2, -0.66], tool: [0.29, -0.76] },
};

/** Stick figure from feet position (x, y) and height h. Poses: idle, busy (both arms up), work (one hand out holding a tool). */
export function personStrokes(r, { x, y, h, pose = "idle" }) {
  const P = POSES[pose];
  if (!P) throw new Error(`unknown person pose "${pose}". Have: ${Object.keys(POSES).join(", ")}`);
  const at = (dx, dy) => [x + dx * h, y + dy * h];
  const neck = at(0, -0.74);
  const hip = at(0, -0.38);
  const shoulder = at(0, -0.66);
  const strokes = [...roughEllipse(r, x, y - 0.87 * h, HEAD_RATIO * h, HEAD_RATIO * h)];
  strokes.push(...doubleLine(r, neck, hip));
  strokes.push(...doubleLine(r, hip, at(-0.12, 0)), ...doubleLine(r, hip, at(0.12, 0)));
  strokes.push(...doubleLine(r, shoulder, at(...P.l)), ...doubleLine(r, shoulder, at(...P.r)));
  if (P.tool) strokes.push(roughLine(r, at(...P.r), at(...P.tool)));
  return strokes;
}

/** Arrow from `from` to `to` with a two stroke head. */
export function arrowStrokes(r, from, to, head = 18) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const wing = (d) => [to[0] - Math.cos(ang + d) * head, to[1] - Math.sin(ang + d) * head];
  return [roughLine(r, from, to), roughLine(r, wing(0.45), to, 1.2), roughLine(r, wing(-0.45), to, 1.2)];
}

/**
 * Geometry for one drawn shape: { strokes, fills } as lists of polylines, or null for text-like shapes.
 * `seed` is the already-mixed seed (SEED, shape index, boil variant).
 */
export function buildShape(shape, seed) {
  const r = mulberry32(seed);
  switch (shape.t) {
    case "line": {
      const pts = shape.p;
      return { strokes: pts.slice(1).flatMap((p, i) => doubleLine(r, pts[i], p)), fills: [] };
    }
    case "arrow":
      return { strokes: arrowStrokes(r, shape.from, shape.to), fills: [] };
    case "rect": {
      const poly = [[shape.x, shape.y], [shape.x + shape.w, shape.y], [shape.x + shape.w, shape.y + shape.h], [shape.x, shape.y + shape.h]];
      return { strokes: roughRect(r, shape.x, shape.y, shape.w, shape.h), fills: shape.fill ? hachure(r, poly, shape.gap, shape.angle) : [] };
    }
    case "ellipse":
      return {
        strokes: roughEllipse(r, shape.cx, shape.cy, shape.rx, shape.ry),
        fills: shape.fill ? hachure(r, ellipsePolygon(shape.cx, shape.cy, shape.rx, shape.ry), shape.gap, shape.angle) : [],
      };
    case "person":
      return { strokes: personStrokes(r, shape), fills: [] };
    default:
      return null;
  }
}

/** The first fraction p (0..1) of a list of polylines, measured along their total length. */
export function revealStrokes(strokes, p) {
  if (p <= 0) return [];
  if (p >= 1) return strokes;
  let left = strokeLength(strokes) * p;
  const out = [];
  for (const s of strokes) {
    const len = polyLength(s);
    if (len <= left) {
      out.push(s);
      left -= len;
      continue;
    }
    const cut = [s[0]];
    for (let i = 1; i < s.length; i++) {
      const seg = dist(s[i - 1], s[i]);
      if (seg >= left) {
        cut.push(lerp2(s[i - 1], s[i], seg === 0 ? 0 : left / seg));
        break;
      }
      cut.push(s[i]);
      left -= seg;
    }
    out.push(cut);
    break;
  }
  return out;
}

export const BOIL_PX = 0.9; // px: largest nudge a point takes between boil variants

/** Boil: the same stroke geometry with each point nudged by at most BOIL_PX, seeded by (shape seed, variant). Variant 0 is the base drawing. */
export function boilStrokes(strokes, seed, variant) {
  if (variant === 0) return strokes;
  const r = mulberry32(hashSeed(seed, variant, 7));
  return strokes.map((s) => s.map(([x, y]) => [x + (r() - 0.5) * 2 * BOIL_PX, y + (r() - 0.5) * 2 * BOIL_PX]));
}

const f1 = (n) => Math.round(n * 10) / 10;

/** SVG path data for polylines, smoothed through segment midpoints so the wobble reads as ink, not as a polygon. */
export function strokesToPath(strokes) {
  return strokes
    .filter((s) => s.length > 1)
    .map((s) => {
      if (s.length === 2) return `M${f1(s[0][0])} ${f1(s[0][1])}L${f1(s[1][0])} ${f1(s[1][1])}`;
      let d = `M${f1(s[0][0])} ${f1(s[0][1])}`;
      for (let i = 1; i < s.length - 1; i++) {
        const mx = (s[i][0] + s[i + 1][0]) / 2;
        const my = (s[i][1] + s[i + 1][1]) / 2;
        d += `Q${f1(s[i][0])} ${f1(s[i][1])} ${f1(mx)} ${f1(my)}`;
      }
      const last = s[s.length - 1];
      return `${d}L${f1(last[0])} ${f1(last[1])}`;
    })
    .join("");
}

/** Reveal progress of a shape at time t: hand speed eases in and out. `at` is [start, end] seconds. */
export const drawProgress = (t, at) => EASINGS.easeInOutSine(win(t, at[0], at[1]));

/** Opacity of a shape at t: 1 until its `out` window, then fades to 0. */
export const shapeOpacity = (t, out) => (out ? 1 - win(t, out[0], out[1]) : 1);

/** Whole number with thousands commas, e.g. 48000 -> "48,000". */
export const formatInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Estimated advance width of a line of Virgil text, px. */
export const textWidth = (text, size) => text.length * size * CHAR_EM;

/** Number shown by a `count` shape at t. */
export const countAt = (t, shape) => countValue(t, { from: shape.from ?? 0, to: shape.to, start: shape.at[0], end: shape.at[1] });
