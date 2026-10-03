// @ts-check
// Pure maths for the counting-up number (engine/counter.tsx). A closed-form function of t (seconds): no state, any frame renders alone.
// Built on time.js progress(), so it eases out like every other reveal in the engine and lands exactly on `to` at `end`, then holds.
import { progress } from "./time.js";

/**
 * Integer shown at time t. Before `start` it is `from`; from `end` on it is exactly `to`.
 * Works counting up (from < to) or down; monotonic either way, because round() of a monotonic curve is monotonic.
 * @param {number} t seconds
 * @param {{ from: number, to: number, start: number, end: number }} spec
 */
export function countValue(t, { from, to, start, end }) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error(`counter needs whole numbers, got from=${from} to=${to}`);
  return Math.round(from + (to - from) * progress(t, start, end));
}

/**
 * Split copy into plain text and counted numbers. `tokens` are the whole numbers in `text` to count, in order of appearance;
 * each is matched as a whole number (so "2" never matches inside "20"). Throws if a token is not a whole number or is not found,
 * so a typo in scene data fails the render instead of silently not counting.
 * @param {string} text
 * @param {string[]} tokens
 * @returns {({ text: string } | { num: number, digits: number, index: number })[]}
 */
export function splitCounted(text, tokens) {
  /** @type {({ text: string } | { num: number, digits: number, index: number })[]} */
  const parts = [];
  let at = 0;
  tokens.forEach((token, index) => {
    if (!/^\d+$/.test(token)) throw new Error(`counted token "${token}" is not a whole number`);
    const found = new RegExp(`(?<!\\d)${token}(?!\\d)`).exec(text.slice(at));
    if (!found) throw new Error(`counted token "${token}" not found in "${text}" after position ${at}`);
    const hit = at + found.index;
    if (hit > at) parts.push({ text: text.slice(at, hit) });
    parts.push({ num: Number(token), digits: token.length, index });
    at = hit + token.length;
  });
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
