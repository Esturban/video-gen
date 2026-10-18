// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/time.js   its progress() is linear 0..1 over a beat; these are the eased second-based ramps the
//   Riyadh Lab thank-you film was cut with (Remotion interpolate + Easing.out/in(cubic), reproduced exactly so a re-render matches).
// Pure timing maths for the film kit (CMO-8248): eased ramps, fade windows, and a piecewise time remap that lets a layer keyed on an
// earlier cut stay in step after scene lengths change. Every value is a function of time only.

/** Cubic ease out (Remotion Easing.out(Easing.cubic)). */
export const easeOutCubic = (x) => 1 - (1 - x) ** 3;
/** Cubic ease in (Remotion Easing.in(Easing.cubic)). */
export const easeInCubic = (x) => x * x * x;
/** No easing. */
export const linear = (x) => x;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * 0..1 eased progress of t between a and b (seconds), clamped on both sides.
 * @param {number} t @param {number} a @param {number} b @param {(x: number) => number} [easing]
 */
export const ramp = (t, a, b, easing = easeOutCubic) => {
  if (!(b > a)) throw new Error(`ramp: end ${b} must be after start ${a}`);
  return easing(clamp01((t - a) / (b - a)));
};

/**
 * Fade in over d seconds from a, fade out over the d seconds ending at b (ease in on the way out).
 * @param {number} t @param {number} a @param {number} b @param {number} [d]
 */
export const window01 = (t, a, b, d = 0.5) => Math.min(ramp(t, a, a + d), 1 - ramp(t, b - d, b, easeInCubic));

/** @param {number} a @param {number} b @param {number} p */
export const lerp = (a, b, p) => a + (b - a) * p;

/**
 * Map t on the current cut onto an earlier cut, segment by segment: segment i of `now` maps linearly onto segment i of `was`.
 * Past the last segment the last mapping extends; before the first, the first does.
 * @param {number} t
 * @param {[number, number][]} now segments [start, end] on the current timeline, in order
 * @param {[number, number][]} was the same segments on the earlier timeline
 */
export const remapTime = (t, now, was) => {
  if (!Array.isArray(now) || now.length === 0 || now.length !== was.length) throw new Error("remapTime: now and was must be equal-length, non-empty segment lists");
  for (let i = 0; i < now.length; i++) {
    const [a, b] = now[i];
    if (t < b || i === now.length - 1) {
      const [fa, fb] = was[i];
      return fa + ((t - a) / (b - a)) * (fb - fa);
    }
  }
  return t;
};

/** Pulse-scale overshoot for a pop-in: 1 before `at`, then a sine bump of `amount` over `dur` seconds, back to 1. */
export const popScale = (t, at, dur, amount) => (t > at ? 1 + amount * Math.sin(Math.min(1, (t - at) / dur) * Math.PI) : 1);
