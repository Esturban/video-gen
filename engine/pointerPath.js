// @ts-check
// REUSE_CHECKED: method only from github Alexwtlf/agentic-product-demo (pointer and click beats in chrome.tsx: decelerate, press, ripple, never teleport); its licence shows NOASSERTION, so this is written from scratch.
//   Our own pointerAt in content-thinking motion-pieces/parts/motion.ts was checked: it glides but has no press timing, dwell or release, so this supersedes it for new scenes.
// Pure pointer model: waypoints in, position and press state out, a function of t (seconds) only.
//
// A waypoint is { t, x, y, act? }. The pointer ARRIVES at (x, y) at time t, having glided there on an ease with zero velocity at the end, so it is
// stopped by t. act:
//   (none)     just a stop: the pointer rests here until it departs for the next waypoint.
//   "press"    button goes down `dwell` seconds after arrival (the pointer is stationary, fully decelerated), and comes up after `hold` seconds
//              unless the next waypoint is a "release", which comes up when the pointer arrives there (a drag).
//   "release"  only meaningful right after a "press": the button comes up on arrival.
// The pointer departs a waypoint when the button is up again: arrival + dwell + hold for a click, arrival otherwise. A departure that would be
// later than the next arrival throws: that is data that would force a teleport.
import { EASINGS, clamp, win } from "./motionMath.js";

/** Seconds the pointer sits still on target before the button goes down. */
export const DWELL_S = 0.12;
/** Seconds the button stays down on a click. */
export const HOLD_S = 0.16;
/** Press depth eases in over this long (seconds)... */
export const PRESS_IN_S = 0.07;
/** ...and out over this long. */
export const PRESS_OUT_S = 0.14;
/** How long a click ripple lives (seconds). */
export const RIPPLE_S = 0.6;
/** Sideways bow of a glide as a fraction of its length: a hand does not move in a ruler line. Zero at both ends, so it never breaks continuity. */
export const ARC = 0.06;

/**
 * @typedef {{ t: number, x: number, y: number, act?: "press" | "release" }} Waypoint
 * @typedef {{ x: number, y: number, depart: number, arrive: number, down?: number, up?: number }} Stop
 */

/**
 * Validate and expand waypoints into stops with explicit arrival, departure and button times.
 * @param {ReadonlyArray<Waypoint>} wps
 * @param {{ dwell?: number, hold?: number }} [o]
 * @returns {Stop[]}
 */
export function buildStops(wps, { dwell = DWELL_S, hold = HOLD_S } = {}) {
  if (!wps.length) throw new Error("pointer needs at least one waypoint");
  /** @type {Stop[]} */
  const stops = wps.map((w, i) => {
    if (i > 0 && !(w.t > wps[i - 1].t)) throw new Error(`pointer waypoint ${i}: t ${w.t} is not after the previous (${wps[i - 1].t})`);
    return { x: w.x, y: w.y, arrive: w.t, depart: w.t };
  });
  wps.forEach((w, i) => {
    if (w.act === "release") {
      const prev = stops[i - 1];
      if (!prev || prev.down === undefined) throw new Error(`pointer waypoint ${i}: "release" must follow a "press"`);
      prev.up = w.t;
      prev.depart = prev.down;
      return;
    }
    if (w.act === "press") {
      const s = stops[i];
      s.down = w.t + dwell;
      const nextIsRelease = wps[i + 1]?.act === "release";
      if (!nextIsRelease) s.up = s.down + hold; // with a release next, the release waypoint sets `up`
      s.depart = nextIsRelease ? s.down : /** @type {number} */ (s.up);
    }
  });
  stops.forEach((s, i) => {
    const next = stops[i + 1];
    if (next && s.depart >= next.arrive) throw new Error(`pointer waypoint ${i} departs at ${s.depart.toFixed(3)} but waypoint ${i + 1} arrives at ${next.arrive}: no time to glide, the pointer would teleport. Give the next waypoint a later t.`);
  });
  return stops;
}

/** Glide position between two stops at time t: ease-in-out along a gentle arc, exactly at the ends. */
const glide = (a, b, t, bowSign) => {
  const u = EASINGS.smooth(win(t, a.depart, b.arrive));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bow = Math.sin(Math.PI * u) * ARC * bowSign;
  return { x: a.x + dx * u - dy * bow, y: a.y + dy * u + dx * bow };
};

/**
 * Pointer state at time t.
 *   x, y     position (held at the first waypoint before the start, at the last after the end)
 *   press    0..1 press depth (eased in and out), for the squash
 *   down     whether the button is currently held
 *   ripples  click ripples alive at t: { x, y, age (seconds), k (0..1) }
 * @param {ReadonlyArray<Waypoint>} wps
 * @param {number} t
 * @param {{ dwell?: number, hold?: number }} [o]
 */
export function pointerState(wps, t, o = {}) {
  const stops = buildStops(wps, o);
  const pos = positionAt(stops, t);
  let press = 0;
  let down = false;
  const ripples = [];
  for (const s of stops) {
    if (s.down === undefined) continue;
    const up = /** @type {number} */ (s.up);
    press = Math.max(press, EASINGS.smooth(win(t, s.down, s.down + PRESS_IN_S)) * (1 - EASINGS.smooth(win(t, up, up + PRESS_OUT_S))));
    if (t >= s.down && t < up) down = true;
    const age = t - s.down;
    if (age >= 0 && age < RIPPLE_S) ripples.push({ x: s.x, y: s.y, age, k: age / RIPPLE_S });
  }
  return { x: pos.x, y: pos.y, press: clamp(press), down, ripples };
}

/** @param {Stop[]} stops */
function positionAt(stops, t) {
  if (t <= stops[0].arrive) return { x: stops[0].x, y: stops[0].y };
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t < a.depart) return { x: a.x, y: a.y };
    if (t < b.arrive) return glide(a, b, t, i % 2 ? -1 : 1);
  }
  const last = stops[stops.length - 1];
  return { x: last.x, y: last.y };
}

/** Speed (px per second) of the pointer at t, by a central difference. For tests and diagnostics. */
export function pointerSpeed(wps, t, o = {}, eps = 1e-4) {
  const a = pointerState(wps, t - eps, o);
  const b = pointerState(wps, t + eps, o);
  return Math.hypot(b.x - a.x, b.y - a.y) / (2 * eps);
}

/** The times the button goes down, for scene timing and for the report. */
export const pressTimes = (wps, o = {}) => buildStops(wps, o).filter((s) => s.down !== undefined).map((s) => /** @type {number} */ (s.down));
