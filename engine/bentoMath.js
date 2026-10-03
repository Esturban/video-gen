// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/motionMath.js (eased, mix: our own) and chartStoryMath.js. Method reference only, no code copied: Remocn/remocn (MIT) infinite-bento-pan tiles and animated-line-chart area under the line.
// Pure maths for the second act of the data story: a bento of tiles under the cards that show the SAME series a second and third way, as a stacked share bar and a running-total area chart.
// Every function is a pure function of its inputs, so any frame renders alone.
import { eased, mix } from "./motionMath.js";

/** Whole-number shares of the series that always add up to exactly 100 (largest remainder), so the cards and the stacked bar never disagree. */
export function shareSegments(values) {
  if (!Array.isArray(values) || values.length < 1 || !values.every((v) => Number.isFinite(v) && v > 0)) throw new Error("shareSegments needs positive numbers");
  const total = values.reduce((a, b) => a + b, 0);
  const exact = values.map((v) => (100 * v) / total);
  const shares = exact.map(Math.floor);
  let left = 100 - shares.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; shares[i] += 1; left -= 1; }
  return shares;
}

/** Running total of a series: [a, a+b, a+b+c, ...]. */
export const cumulative = (values) => values.reduce((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);

/**
 * Segments of a stacked share bar. Each segment keeps its final x and full width; its drawn width grows from 0 as k advances, left to right with `stagger` between segments.
 * @param {{ x0: number, width: number, gap: number }} box
 * @param {number[]} shares whole-number shares
 * @param {number} t seconds
 * @param {[number, number]} window reveal window [start, end] of the FIRST segment
 * @param {number} stagger seconds between segments
 * @returns {{ x: number, fullW: number, w: number }[]}
 */
export function stackedSegments(box, shares, t, window, stagger = 0.1) {
  const sum = shares.reduce((a, b) => a + b, 0);
  const avail = box.width - box.gap * (shares.length - 1);
  let x = box.x0;
  return shares.map((s, j) => {
    const fullW = (avail * s) / sum;
    const seg = { x, fullW, w: fullW * eased(t, window[0] + j * stagger, window[1] + j * stagger) };
    x += fullW + box.gap;
    return seg;
  });
}

/**
 * Geometry of a running-total area chart drawn left to right. k in 0..1 is how much of the line is drawn; the last visible segment is cut part way.
 * @param {number[]} values the series (the chart plots its running total)
 * @param {{ x0: number, baseY: number, width: number, height: number }} box
 * @param {number} k
 * @returns {{ pts: number[][], line: number[][], area: number[][], tip: number[] | null, full: number[][] }}
 */
export function areaGeometry(values, box, k) {
  const run = cumulative(values);
  const top = run.at(-1);
  const full = run.map((v, i) => [box.x0 + (box.width * i) / (run.length - 1), box.baseY - (v / top) * box.height]);
  const reach = Math.max(0, Math.min(1, k)) * (run.length - 1);
  if (k <= 0) return { pts: full, line: [], area: [], tip: null, full };
  const whole = Math.min(run.length - 1, Math.floor(reach));
  const frac = reach - whole;
  const line = full.slice(0, whole + 1);
  if (whole < run.length - 1 && frac > 0) line.push([mix(full[whole][0], full[whole + 1][0], frac), mix(full[whole][1], full[whole + 1][1], frac)]);
  const tip = line.at(-1);
  const area = [[line[0][0], box.baseY], ...line, [tip[0], box.baseY]];
  return { pts: full, line, area, tip, full };
}

/** Tile reveal 0..1 with a stagger per tile index. */
export const tileReveal = (t, window, index, stagger = 0.18) => eased(t, window[0] + index * stagger, window[1] + index * stagger);
