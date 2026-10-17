// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/growLineMath.js (smooth and clamp01 are copied in shape, not imported, so the intro stays a leaf with no data-chart dependency), 1_social/py/video-gen/engine/time.js (no opening-title helper exists in the engine).
// Pure maths for IntroSequence, the branded TV-show opening (CMO-8170). Every value is a function of the beat fraction and the duration, so any frame can be drawn alone.

/** Reference length the windows below are written for, seconds. Any beat length scales the same windows by fraction. */
export const REF_SECONDS = 6.5;

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smoothstep 0..1 of x between a and b. */
export const smooth = (x, a, b) => {
  if (b <= a) return x >= a ? 1 : 0;
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/** Ease-out cubic 0..1 of x between a and b: fast start, soft landing. */
export const easeOut = (x, a, b) => {
  if (b <= a) return x >= a ? 1 : 0;
  const u = clamp01((x - a) / (b - a));
  return 1 - (1 - u) ** 3;
};

/** Window in seconds on the 6.5 s reference, as fractions of the beat. */
const win = (a, b) => /** @type {[number, number]} */ ([a / REF_SECONDS, b / REF_SECONDS]);

export const WINDOWS = {
  grid: win(0, 1.3), // hairlines draw in, staggered
  trend: win(0, 3.2), // the accent line draws left to right
  head: win(1.2, 2.4), // reserved head frame scales in
  series: win(1.4, 2.2), // optional series or episode label
  wordmark: win(2.1, 3.5), // left to right wipe with a short rise
  rule: win(3.3, 4.3), // rule under the wordmark extends
  byline: win(3.9, 4.8), // byline fades in
  exit: win(6.1, 6.5), // everything fades to paper
};

/** Rising trend, normalised: x in 0..1, y in 0..1 where 0 is the top of the band and 1 the bottom. Steps up like a chart. */
export const TREND = [
  [0, 0.92], [0.13, 0.84], [0.26, 0.88], [0.4, 0.62], [0.54, 0.7], [0.68, 0.38], [0.82, 0.3], [1, 0.04],
];

/** Width of the wordmark in em, estimated for Geist SemiBold "EV Advisory"; sets the rule length. Tuned by eye on the poster. */
export const WORDMARK_EM = 5.55;

/**
 * Geometry for a canvas of width W and height H, in px. Everything scales with k = min(W, H) / 1080.
 * The head frame sits on the right, the wordmark block on the left, the trend runs across the lower band.
 */
export function layoutFor(W, H) {
  if (!(W > 0) || !(H > 0)) throw new Error(`layoutFor needs a positive size, got ${W} x ${H}`);
  const k = Math.min(W, H) / 1080;
  const margin = 90 * k; // clear of the frame gate's 64 px safe margin
  if (H > W) return portraitLayout(W, H, k, margin);
  const left = 140 * k;
  const wordSize = 168 * k;
  const wordBase = 0.5 * H;
  const headR = 190 * k;
  const head = { cx: W - 140 * k - headR, cy: 0.43 * H, r: headR };
  const band = { x0: margin, x1: W - margin, y0: 0.68 * H, y1: 0.94 * H };
  return blockLayout({ k, margin, left, wordSize, wordBase, head, band, H });
}

/** Wordmark block pieces below the head, shared by both orientations. */
function blockLayout({ k, margin, left, wordSize, wordBase, head, band, H }) {
  const rule = { x: left, y: wordBase + 46 * k, len: wordSize * WORDMARK_EM };
  const byline = { x: left, y: rule.y + 84 * k, size: 46 * k };
  const series = { x: left, y: wordBase - wordSize * 0.98, size: 30 * k };
  const gridYs = [0.1, 0.18, 0.74, 0.82, 0.9].map((f) => f * H);
  return { k, margin, left, wordSize, wordBase, head, band, rule, byline, series, gridYs };
}

/** Portrait (H > W), CMO-8185: head slot centred on top, the wordmark block below it sized to fit the side margins, the trend band lower. */
function portraitLayout(W, H, k, margin) {
  const left = 1.2 * margin;
  const wordSize = Math.min(168 * k, (W - 2 * left) / WORDMARK_EM);
  const headR = Math.min(230 * k, (W - 2 * margin) / 2);
  const head = { cx: W / 2, cy: 0.24 * H, r: headR };
  const wordBase = 0.5 * H;
  const band = { x0: margin, x1: W - margin, y0: 0.68 * H, y1: 0.94 * H };
  return blockLayout({ k, margin, left, wordSize, wordBase, head, band, H });
}

/** Polyline of the trend in px for a band. */
export function trendPoints(band) {
  return TREND.map(([x, y]) => /** @type {[number, number]} */ ([band.x0 + x * (band.x1 - band.x0), band.y0 + y * (band.y1 - band.y0)]));
}

/** The part of a polyline drawn at progress p (0..1, by x), ending exactly on the tip. Returns the visible points; the last one is the tip. */
export function visibleTrend(points, p) {
  if (points.length < 2) throw new Error("visibleTrend needs at least two points");
  if (p <= 0) return [points[0]];
  if (p >= 1) return points.slice();
  const x0 = points[0][0];
  const xt = x0 + p * (points[points.length - 1][0] - x0);
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (xt >= b[0]) {
      out.push(b);
      continue;
    }
    const u = (xt - a[0]) / (b[0] - a[0]);
    out.push([xt, a[1] + (b[1] - a[1]) * u]);
    break;
  }
  return out;
}

export const pathOf = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

/** Phase 0..1 of a repeating pulse, `perSecond` cycles per second of the beat, for the tip ring and the rule sheen. */
export const cycle = (f, durSeconds, perSecond) => {
  const x = f * durSeconds * perSecond;
  return x - Math.floor(x);
};

/** Everything the piece draws at beat fraction f (0..1) of a beat lasting dur seconds. */
export function introState(f, dur) {
  if (!(dur > 0)) throw new Error(`introState needs a positive duration, got ${dur}`);
  const settled = smooth(f, WINDOWS.trend[1], WINDOWS.trend[1] + 0.08);
  return {
    exit: 1 - smooth(f, WINDOWS.exit[0], WINDOWS.exit[1]),
    grid: [0, 1, 2, 3, 4].map((i) => easeOut(f, WINDOWS.grid[0] + i * 0.02, WINDOWS.grid[0] + i * 0.02 + 0.12)),
    trend: easeOut(f, WINDOWS.trend[0], WINDOWS.trend[1]),
    head: easeOut(f, WINDOWS.head[0], WINDOWS.head[1]),
    series: smooth(f, WINDOWS.series[0], WINDOWS.series[1]),
    wordmark: easeOut(f, WINDOWS.wordmark[0], WINDOWS.wordmark[1]),
    rule: easeOut(f, WINDOWS.rule[0], WINDOWS.rule[1]),
    byline: smooth(f, WINDOWS.byline[0], WINDOWS.byline[1]),
    ring: cycle(f, dur, 0.6),
    ringOn: settled,
    sheen: smooth(f, WINDOWS.rule[1], WINDOWS.rule[1] + 0.05) * cycle(f, dur, 0.45),
  };
}
