// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (clamp, win: imported), 1_social/py/video-gen/engine/ledgerRowsMath.js (LAYOUTS per frame shape,
//   MAX_ALPHA_STEP idea), content-thinking scenes/client/mashreq-demo1 (caption column left, mock window right, staggered reveals: the look this generalises).
// Pure maths for UiExplainer (CMO-8242): where the caption column and the mock panel sit for a wide or tall frame, when each item in a beat reveals
// (spread across the spoken part of the beat), and where the dots on a flow path are. Every value is a function of its inputs, so any frame draws alone.
import { clamp, win } from "./motionMath.js";

const REVEAL_S = 0.5; // smoothstep over 0.5 s peaks at 1.5/0.5 = 3 per s, 0.1 per 30 fps frame: no flash
const CUE_SPAN = [0.12, 0.85]; // items land between 12 and 85 percent of the spoken part
const DEFAULT_LEAD = 0.4; // voice step lead, seconds (voice/narrate.py)
const DEFAULT_HOLD = 1; // seconds kept clear at the end of a silent beat
const FLOW_SPEED = 0.45; // path lengths per second
const FLOW_FADE_S = 0.5;
const TALL_ASPECT = 1.15; // H / W above this is a tall frame

const box = (x, y, w, h) => ({ x, y, w, h });

/** Design layouts in px at their own size. Every box is { x, y, w, h }; px holds type sizes. */
export const LAYOUTS = {
  wide: {
    size: [1920, 1080],
    label: box(96, 150, 540, 40), tile: box(96, 220, 96, 96), caption: box(96, 380, 540, 440), source: box(96, 930, 540, 60),
    panel: box(720, 150, 1104, 790),
    px: { label: 24, product: 34, caption: 62, source: 22, body: 28, title: 104 },
  },
  tall: {
    size: [1080, 1920],
    label: box(72, 170, 936, 40), tile: box(72, 230, 80, 80), caption: box(72, 350, 936, 320), source: box(72, 1650, 936, 60),
    panel: box(72, 720, 936, 880),
    px: { label: 26, product: 34, caption: 64, source: 24, body: 30, title: 96 },
  },
};

const scaleBox = (b, k, ox, oy) => box(ox + b.x * k, oy + b.y * k, b.w * k, b.h * k);

/** The layout for a W x H frame: the design for its shape, scaled uniformly and centred. s is the scale (1 at the design size). */
export function layoutFor(W, H) {
  const shape = H / W > TALL_ASPECT ? "tall" : "wide";
  const d = LAYOUTS[shape];
  const k = Math.min(W / d.size[0], H / d.size[1]);
  const ox = (W - d.size[0] * k) / 2;
  const oy = (H - d.size[1] * k) / 2;
  const boxes = Object.fromEntries(["label", "tile", "caption", "source", "panel"].map((key) => [key, scaleBox(d[key], k, ox, oy)]));
  const px = Object.fromEntries(Object.entries(d.px).map(([key, v]) => [key, v * k]));
  return { shape, s: k, W, H, ...boxes, px };
}

/**
 * Beat-local reveal times for n items, spread across the spoken part of the beat (voiceAt .. voiceAt + voice, written by the voice step).
 * A beat without narration uses its own length minus a lead and a hold.
 */
export function cueTimes(n, beat) {
  if (n <= 0) return [];
  const base = beat.voiceAt ?? DEFAULT_LEAD;
  const len = beat.voice ?? Math.max(0.5, beat.end - beat.start - base - DEFAULT_HOLD);
  const [a, b] = CUE_SPAN;
  if (n === 1) return [base + len * a];
  return Array.from({ length: n }, (_, i) => base + len * (a + ((b - a) * i) / (n - 1)));
}

/** 0 before `at`, 1 after at + dur, smoothstep between. */
export function reveal(t, at, dur = REVEAL_S) {
  const x = win(t, at, at + dur);
  return x * x * (3 - 2 * x);
}

/** n dots moving along a path from `start`: u in [0, 1) along the path, op fades in with the flow and out at both path ends. */
export function flowDots(t, start, n, speed = FLOW_SPEED) {
  const age = Math.max(0, t - start);
  const on = t < start ? 0 : clamp(age / FLOW_FADE_S);
  return Array.from({ length: n }, (_, i) => {
    const raw = age * speed + i / n;
    const u = raw - Math.floor(raw);
    return { i, u, op: on * Math.sin(Math.PI * u) };
  });
}

export const PUSH = 0.03; // slow camera push across a beat: keeps a held screen alive for the frame gate without new motion

/** Scale of the slow push at beat-local time t in a beat of length dur: 1 at the start, 1 + PUSH at the end, linear (no ease, no stop). */
export function pushScale(t, dur) {
  return 1 + PUSH * clamp(dur > 0 ? t / dur : 1);
}

/** x of an item placed at fraction f of a lane that starts at x0 and is w wide. */
export function laneX(f, x0, w) {
  if (!(f >= 0 && f <= 1)) throw new Error(`lane position must be 0 to 1, got ${f}`);
  return x0 + f * w;
}
