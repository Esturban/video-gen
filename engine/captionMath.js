// @ts-check
// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/dev/video-production-patterns-oss.md   names remotion-dev/template-tiktok's pattern (pages of words, one active word, timing from measured audio); written here as pure functions of t so any frame renders alone
// Word-timed captions (CMO-7584). Words come from words.json (bin/lib/words.mjs, local whisper-cli); every value here is a pure function of time.

/** @typedef {{ text: string, start: number, end: number, beat?: number }} Word */
/** @typedef {{ words: Word[], start: number, end: number }} Page */

export const CAPTION_DEFAULTS = { maxWords: 5, maxGap: 0.8, linger: 0.6 };

/**
 * Group words into pages (what is on screen at once). A new page starts at maxWords, at a beat change, or after a silence longer than maxGap.
 * A page shows from its first word until the next page starts, but never longer than `linger` after its last word ends.
 * @param {Word[]} words
 * @param {{ maxWords?: number, maxGap?: number, linger?: number }} [opts]
 * @returns {Page[]}
 */
export function captionPages(words, opts = {}) {
  const { maxWords, maxGap, linger } = { ...CAPTION_DEFAULTS, ...opts };
  /** @type {Word[][]} */
  const groups = [];
  for (const w of words) {
    const cur = groups.at(-1);
    const last = cur?.at(-1);
    const fresh = !cur || cur.length >= maxWords || last?.beat !== w.beat || w.start - (last?.end ?? w.start) > maxGap;
    if (fresh) groups.push([w]);
    else cur.push(w);
  }
  return groups.map((g, i) => {
    const lastEnd = g[g.length - 1].end + linger;
    const next = groups[i + 1]?.[0].start ?? Infinity;
    return { words: g, start: g[0].start, end: Math.round(Math.min(next, lastEnd) * 1e6) / 1e6 };
  });
}

/**
 * What the caption shows at time t: the page index and its active word, or null when nothing is up.
 * A word is active from its start until the next word on the page starts (it holds through short gaps).
 * @param {Page[]} pages
 * @param {number} t seconds
 * @returns {{ page: number, active: number } | null}
 */
export function captionAt(pages, t) {
  const page = pages.findIndex((p) => t >= p.start && t < p.end);
  if (page < 0) return null;
  const ws = pages[page].words;
  let active = 0;
  for (let i = 0; i < ws.length; i++) if (t >= ws[i].start) active = i;
  return { page, active };
}

/** First frame whose time reaches `start` (the frame where the word becomes active). Tolerates float noise like 0.5 * 60 = 29.999999. */
export const wordFrame = (start, fps) => Math.ceil(start * fps - 1e-6);

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v, fallback) => (typeof v === "string" && HEX.test(v) ? v : fallback);

/**
 * Caption look from the brand file. A brand may carry a "captions" block (the EV or Atomcamp style guide, when they land);
 * until then every field is derived from the brand's own font and colours.
 * @param {{ font?: string, background?: string, colors?: Record<string, string>, captions?: Record<string, unknown> }} brand
 */
export function captionStyle(brand) {
  const c = brand.colors ?? {};
  const derived = {
    font: brand.font ?? "sans-serif",
    size: 54, // px at 1080p; scaled by min(width, height) / 1080 in the component
    weight: 700,
    ink: hexOr(c.ink, "#111111"),
    highlight: hexOr(c.accent, hexOr(c.navy, "#2f5d5a")),
    highlightInk: hexOr(c.paper, hexOr(brand.background, "#ffffff")),
    plate: hexOr(c.card, hexOr(c.paper, "#ffffff")),
    plateOpacity: 0.92,
    bottom: 0.1, // fraction of height from the bottom edge
  };
  return { ...derived, ...(brand.captions ?? {}) };
}
