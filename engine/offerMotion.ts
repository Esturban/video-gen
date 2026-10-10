// REUSE_CHECKED: ~/Downloads/motion-template.zip (EV's reviewed ONE / SYSTEM engine), src/motion/{spring,interpolation,cursor}.ts and components/MorphShell.tsx.
//   springStep, track, pressPulse, smooth, mix, window are ported from there with frames turned into seconds; the pointer is a fresh stop-and-go path (arc plus smooth ease)
//   because the template's cursor is a periodic spline tied to its 840 frame loop. engine/time.js spring()/follow() were checked first: they have no compact tail and no per-target duration, so they are not used here.
// Everything is a pure function of t (seconds): no state between frames, so any frame renders alone.

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const win = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const smooth = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
export const eased = (t: number, a: number, b: number) => smooth(win(t, a, b));

/** Closed-form damped spring step (0 to 1) with a compact C1 tail so it lands exactly at `dur` seconds. damping < 1 overshoots. */
export const springStep = (age: number, dur = 0.45, damping = 0.91) => {
  if (age <= 0) return 0;
  if (age >= dur) return 1;
  const u = age / dur;
  const w = 10;
  const d = Math.sqrt(1 - damping * damping);
  const r = 1 - Math.exp(-damping * w * u) * (Math.cos(w * d * u) + (damping / d) * Math.sin(w * d * u));
  return r + (1 - r) * smooth(win(u, 0.7, 1));
};

export type Target = readonly [at: number, value: number, dur?: number, damping?: number];
/** A value that springs to each new target; overlapping targets blend and keep velocity. `lag` offsets the whole track. */
export const track = (t: number, initial: number, targets: readonly Target[], lag = 0) => {
  let v = initial;
  let prev = initial;
  for (const [at, to, dur, damp] of targets) {
    v += (to - prev) * springStep(t - at - lag, dur, damp);
    prev = to;
  }
  return v;
};

export const pressPulse = (age: number) => (age < 0 ? 0 : (1 - springStep(age, 0.25)) * clamp(age * 60 + 1));

const rgb = (c: string) => (c.startsWith("rgb") ? (c.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
export const mixColor = (a: string, b: string, t: number) => {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(mix(v, B[i], clamp(t)))).join(",")})`;
};
/** Colour that springs through a list of [at, hex] changes, starting at `initial`. */
export const colorTrack = (t: number, initial: string, changes: readonly (readonly [number, string, number?])[]) => {
  let from = initial;
  let out = initial;
  for (const [at, hex, dur] of changes) {
    const k = clamp(springStep(t - at, dur ?? 0.5, 0.95));
    out = k <= 0 ? out : mixColor(from, hex, k);
    if (k >= 1) out = hex;
    from = hex;
  }
  return out;
};

/** Pointer waypoints: [t, x, y]. The pointer eases from stop to stop along a slight arc. */
export type Waypoint = readonly [t: number, x: number, y: number];
export const pointerAt = (pts: readonly Waypoint[], t: number) => {
  if (t <= pts[0][0]) return { x: pts[0][1], y: pts[0][2] };
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, x0, y0] = pts[i];
    const [t1, x1, y1] = pts[i + 1];
    if (t >= t0 && t < t1) {
      const u = smooth((t - t0) / (t1 - t0));
      const dx = x1 - x0;
      const dy = y1 - y0;
      const bow = Math.sin(Math.PI * u) * 0.07 * (i % 2 ? -1 : 1);
      return { x: x0 + dx * u - dy * bow, y: y0 + dy * u + dx * bow };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last[1], y: last[2] };
};

export const hexA = (hex: string, a: number) => `rgba(${rgb(hex).join(",")},${a})`;
