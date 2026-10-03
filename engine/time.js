// @ts-check
// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/riyadh-day3/motion/video/src/parts.tsx   its eased useT is lifted here as progress(); no repo had closed-form springs, cursor or drag
// Time engine. Every value here is a pure function of t (seconds since the beat started).
// No state is carried between frames, so any frame renders on its own: seek(t) is just f(t).
// That is what lets Remotion render frames out of order, in parallel, and at any fps.

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const easeOutCubic = (x) => 1 - (1 - x) ** 3;

/** Eased 0..1 progress of t between a and b (seconds). Same curve both source projects used. */
export const progress = (t, a, b, ease = easeOutCubic) => (b <= a ? (t >= a ? 1 : 0) : ease(clamp01((t - a) / (b - a))));

export const SPRING = { stiffness: 170, damping: 26, mass: 1 };

/**
 * Closed-form unit step response of a damped spring: 0 for t <= 0, settles at 1.
 * Analytic, not integrated, so it is exact at any t and costs the same at t = 0.1 or t = 500.
 */
export function spring(t, { stiffness = SPRING.stiffness, damping = SPRING.damping, mass = SPRING.mass } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = w0 * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * w0 + s;
  const r2 = -zeta * w0 - s;
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

/**
 * A value that springs to each new target: keys are [at, value] sorted by time, the first is the start value.
 * v(t) = v0 + sum over changes of (target_i - target_(i-1)) * spring(t - at_i).
 * Summing one spring per target change keeps it closed form: retargeting mid-flight blends naturally.
 */
export function follow(t, keys, cfg) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], cfg);
  return v;
}

export const CLICK_S = 0.18;

/** Pointer along waypoints [at, x, y, click?]. Returns position plus press (0..1 pulse on click waypoints). */
export function cursor(t, path, cfg) {
  const x = follow(t, path.map((p) => [p[0], p[1]]), cfg);
  const y = follow(t, path.map((p) => [p[0], p[2]]), cfg);
  let press = 0;
  for (const p of path) {
    const d = t - p[0];
    if (p[3] && d >= 0 && d < CLICK_S) press = Math.max(press, Math.sin((Math.PI * d) / CLICK_S));
  }
  return { x, y, press };
}

/**
 * Drag from one point to another starting at `at`. The dragged item and the pointer share one position;
 * `held` is true from the grab until the spring has settled.
 */
export function drag(t, { at, from, to, grab = 0.2 }, cfg) {
  const k = spring(t - at, cfg);
  const held = t >= at - grab && (t < at || Math.abs(1 - k) > 0.01);
  return { x: from[0] + (to[0] - from[0]) * k, y: from[1] + (to[1] - from[1]) * k, held };
}
