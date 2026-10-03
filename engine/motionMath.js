// @ts-check
// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/promo/motion-pieces/parts/motion.ts (our own, round 2): smooth, springStep, window helpers are lifted here so any scene can import them.
//   Method reference only, no code copied: github Alexwtlf/agentic-product-demo src/motion.ts (named curves, stagger, never jump a value between states). Its licence shows NOASSERTION, so this file is written from scratch.
// Pure motion vocabulary. Every function is a pure function of t (seconds): no state between frames, so any frame renders alone, in any order, at any fps.
// This is .js with JSDoc (like time.js and countValue.js) so node:test can import it; engine/motion.ts is the typed door scenes import as "@video/engine/motion".

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
/** 0..1 position of t inside [a, b], clamped. */
export const win = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));

/** Named easing curves, each maps 0..1 to 0..1 with ease(0) = 0 and ease(1) = 1. */
export const EASINGS = {
  linear: (x) => x,
  easeOutCubic: (x) => 1 - (1 - x) ** 3,
  easeOutQuint: (x) => 1 - (1 - x) ** 5,
  easeInOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  /** Quintic smootherstep: zero velocity and zero acceleration at both ends. The default for anything that must come to rest. */
  smooth: (x) => x * x * x * (x * (x * 6 - 15) + 10),
};

/** @typedef {keyof typeof EASINGS} EaseName */

/** Eased 0..1 for x, by curve name. Throws on an unknown name so a typo in scene data fails the render. */
export const ease = (name, x) => {
  const fn = EASINGS[name];
  if (!fn) throw new Error(`unknown easing "${name}". Have: ${Object.keys(EASINGS).join(", ")}`);
  return fn(clamp(x));
};

/** Eased 0..1 progress of t across [a, b]. */
export const eased = (t, a, b, name = "smooth") => ease(name, win(t, a, b));

/**
 * Closed-form damped spring step (0 to 1) with a compact C1 tail so it lands exactly at `dur` seconds. damping < 1 overshoots.
 * @param {number} age seconds since the step began
 */
export const springStep = (age, dur = 0.45, damping = 0.91) => {
  if (age <= 0) return 0;
  if (age >= dur) return 1;
  const u = age / dur;
  const w = 10;
  const d = Math.sqrt(1 - damping * damping);
  const r = 1 - Math.exp(-damping * w * u) * (Math.cos(w * d * u) + (damping / d) * Math.sin(w * d * u));
  return r + (1 - r) * EASINGS.smooth(win(u, 0.7, 1));
};

/** Start time of item `index` in a staggered list: the first starts at `start`, each later one `step` seconds after the previous. */
export const staggerStart = (index, start, step) => start + index * step;

/**
 * 0..1 progress of item `index` in a staggered list. Each item runs for `dur` seconds from its own start and lands exactly at 1.
 * @param {number} t
 * @param {number} index
 * @param {{ start: number, step: number, dur: number, curve?: EaseName | "spring" }} cfg
 */
export const staggerProgress = (t, index, { start, step, dur, curve = "easeOutCubic" }) => {
  const at = staggerStart(index, start, step);
  return curve === "spring" ? springStep(t - at, dur) : ease(curve, win(t, at, at + dur));
};

/**
 * No-teleport helper: a value that moves between states ONLY through an eased interval, never by jumping.
 * `initial` is the value before the first change. Each change is { at, to, dur?, curve? }; it starts at `at` and lands exactly at at+dur.
 * If a change starts while the previous is still moving, it departs from the CURRENT value (not the previous target), so the value is
 * continuous everywhere. dur must be positive: a zero-length change would be a jump, so it throws instead.
 * @param {number} t
 * @param {number} initial
 * @param {ReadonlyArray<{ at: number, to: number, dur?: number, curve?: EaseName }>} changes
 */
export const tween = (t, initial, changes) => {
  const sorted = [...changes].sort((a, b) => a.at - b.at);
  for (const c of sorted) if (!((c.dur ?? DEFAULT_TWEEN_S) > 0)) throw new Error(`tween change at ${c.at} has dur ${c.dur}: a state change needs a positive eased interval, a zero one is a teleport`);
  let value = initial;
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (t < c.at) return value;
    const dur = c.dur ?? DEFAULT_TWEEN_S;
    const k = ease(c.curve ?? "smooth", win(t, c.at, c.at + dur));
    const next = sorted[i + 1];
    // while this change runs, a later change may already have started: value at that later start is the new "from"
    if (next && t >= next.at) {
      const from = valueAt(value, c, next.at);
      value = from;
      continue;
    }
    return mix(value, c.to, k);
  }
  return value;
};

const DEFAULT_TWEEN_S = 0.5;
const valueAt = (from, c, at) => mix(from, c.to, ease(c.curve ?? "smooth", win(at, c.at, c.at + (c.dur ?? DEFAULT_TWEEN_S))));
