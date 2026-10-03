// @ts-check
// REUSE_CHECKED: method only from github Alexwtlf/agentic-product-demo (visible typing with a caret, chars revealed on a schedule); written from scratch, its licence shows NOASSERTION.
//   engine/countValue.js (our own) was checked: it eases a number, but typing needs a steady per-character rhythm with pauses, so it is not reused.
// Pure typing model: how many characters of `text` are visible at time t (seconds), and whether the caret shows. A function of t only.
//
// Character k (1-based count visible) appears at  start + (k - 1) / cps + (sum of pause durations whose `at` is below k).
// A pause { at: n, dur } holds the text at n characters for dur seconds (n counts characters already shown). The count is monotonic,
// is exactly text.length from typingEnd(spec) on, and holds there.

/** Seconds the caret stays solid after each character appears (a caret that blinks mid-word looks broken). */
export const CARET_SOLID_S = 0.5;
/** Caret blink period in seconds when idle: on for half, off for half. */
export const CARET_PERIOD_S = 1.0;

/**
 * @typedef {{ text: string, start: number, cps: number, pauses?: ReadonlyArray<{ at: number, dur: number }> }} TypingSpec
 */

/** @param {TypingSpec} s */
function validate(s) {
  if (!(s.cps > 0)) throw new Error(`typing cps must be positive, got ${s.cps}`);
  for (const p of s.pauses ?? []) {
    if (!(p.dur >= 0) || !Number.isInteger(p.at) || p.at < 1 || p.at > s.text.length) throw new Error(`typing pause { at: ${p.at}, dur: ${p.dur} } must have a whole at in 1..${s.text.length} and dur >= 0`);
  }
}

/**
 * Time at which `k` characters are visible (k from 1 to text.length).
 * @param {TypingSpec} s
 * @param {number} k
 */
export const timeOfChar = (s, k) => s.start + (k - 1) / s.cps + (s.pauses ?? []).filter((p) => p.at < k).reduce((sum, p) => sum + p.dur, 0);

/** The moment the last character lands. */
export const typingEnd = (/** @type {TypingSpec} */ s) => (s.text.length ? timeOfChar(s, s.text.length) : s.start);

/**
 * Number of visible characters at t.
 * @param {number} t
 * @param {TypingSpec} s
 */
export function shownChars(t, s) {
  validate(s);
  let n = 0;
  while (n < s.text.length && timeOfChar(s, n + 1) <= t) n++;
  return n;
}

/** The visible text at t. */
export const typedText = (t, /** @type {TypingSpec} */ s) => s.text.slice(0, shownChars(t, s));

/**
 * Whether the caret shows at t. It is hidden before `focusAt`, solid while typing and for CARET_SOLID_S after each character, then blinks.
 * @param {number} t
 * @param {TypingSpec} s
 * @param {number} focusAt time the field gained focus
 * @param {number} [hideAt] time the caret goes away for good (default: never)
 */
export function caretVisible(t, s, focusAt, hideAt = Infinity) {
  if (t < focusAt || t >= hideAt) return false;
  const n = shownChars(t, s);
  const last = n > 0 ? timeOfChar(s, n) : focusAt;
  const idle = t - last - CARET_SOLID_S;
  if (idle < 0) return true;
  return idle % CARET_PERIOD_S < CARET_PERIOD_S / 2;
}
