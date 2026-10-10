// Caption sync check on frames of the rendered file (CMO-7584). For three words spread across the scene, read a few frames around
// the word's time, crop the caption band, and find the frame where the highlight box moves onto the word. That frame must land
// within SYNC_TOLERANCE_FRAMES of the frame the word's start time maps to, and leave it within the same tolerance of the next word's
// start (or the page end). Arriving and leaving on time pins the highlight to that word. It checks the delivered mp4, not the component maths.
// Limit: it tracks the centre of highlight-coloured pixels in the caption band, so a beat that paints the highlight colour behind
// the captions can confuse it; the band sits on a solid plate to keep that rare.
import { execFileSync } from "node:child_process";
import { captionPages, captionStyle, wordFrame } from "../../engine/captionMath.js";

export const SYNC_TOLERANCE_FRAMES = 2;
const SEARCH_FRAMES = 4; // frames read either side of the expected frame
const COLOUR_TOLERANCE = 48; // max per-channel distance for a pixel to count as the highlight colour (yuv420 round trip shifts it)
const MOVE_PX = 2; // centroid shift that counts as the highlight moving
const SAMPLE_WIDTH = 480; // the caption band is scaled to this width before reading pixels

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** x centre of the pixels within COLOUR_TOLERANCE of `rgb`, in an rgb24 buffer of w x h. Null when no pixel matches. */
export function highlightCentroid(px, w, h, rgb) {
  let sum = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 3;
    if (Math.abs(px[o] - rgb[0]) <= COLOUR_TOLERANCE && Math.abs(px[o + 1] - rgb[1]) <= COLOUR_TOLERANCE && Math.abs(px[o + 2] - rgb[2]) <= COLOUR_TOLERANCE) { sum += x; n++; }
  }
  return n ? sum / n : null;
}

/** First frame in [{ frame, x }] whose highlight centre moved (or appeared, or vanished) relative to the frame before. */
export function switchFrame(series) {
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1].x, b = series[i].x;
    if ((a === null) !== (b === null) || (a !== null && Math.abs(a - b) > MOVE_PX)) return series[i].frame;
  }
  return null;
}

/** Of every frame where the highlight moved, the one closest to `expected` (a short neighbouring word can switch inside the same window). Null when nothing moved. */
export function nearestSwitch(series, expected) {
  let best = null;
  for (let i = 1; i < series.length; i++) {
    const at = switchFrame(series.slice(i - 1, i + 1));
    if (at !== null && (best === null || Math.abs(at - expected) < Math.abs(best - expected))) best = at;
  }
  return best;
}

export const syncVerdict = (expected, seen) => ({ expected, seen, pass: seen !== null && Math.abs(seen - expected) <= SYNC_TOLERANCE_FRAMES });

/** `count` words spread evenly across the scene, each on screen at least `minLength` seconds so its enter and leave windows do not overlap. */
export function pickCheckWords(words, count = 3, minLength = 0) {
  const pool = words.filter((w) => w.end - w.start >= minLength);
  if (pool.length <= count) return [...pool];
  return Array.from({ length: count }, (_, i) => pool[Math.round(((i + 0.5) * pool.length) / count - 0.5)]);
}

const bare = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * The words to check: the ones a scene names in captions.check (first match of each, case and punctuation ignored), else
 * `count` spread evenly. `usable` drops words that cannot be checked (too short on screen, or no audio onset).
 */
export function chooseCheckWords(words, names, minLength = 0, usable = () => true, count = 3) {
  if (!Array.isArray(names) || !names.length) return pickCheckWords(words.filter(usable), count, minLength);
  return names.map((name) => {
    const w = words.find((x) => bare(x.text) === bare(name));
    if (!w) throw new Error(`captions.check names "${name}", which is not a word in words.json`);
    return w;
  });
}

/** When the highlight should leave a word: the next word's start on the same page, or the page's end for its last word. */
export function leaveTime(pages, word) {
  const page = pages.find((p) => p.words.includes(word));
  if (!page) throw new Error(`word "${word.text}" at ${word.start}s is on no caption page`);
  const i = page.words.indexOf(word);
  return i + 1 < page.words.length ? page.words[i + 1].start : page.end;
}

/** A word is in sync when the highlight both arrives and leaves within tolerance: that pins the highlight to this word's own span. */
export const wordVerdict = (enter, leave) => ({ enter, leave, pass: syncVerdict(enter.expected, enter.seen).pass && syncVerdict(leave.expected, leave.seen).pass });

/** ffmpeg -ss value for frame `first`: half a frame early, so rounding never lands past the frame's timestamp and drops it. */
export const seekTime = (first, fps) => Math.max(0, (first - 0.5) / fps).toFixed(6);

/** Read frames [first, last] of the caption band of `mp4` as rgb24 and return [{ frame, x }]. */
export function bandCentroids(mp4, { width, height, fps }, style, first, last) {
  const bandH = Math.round(height * 0.28);
  const scale = SAMPLE_WIDTH / width;
  const h = Math.max(1, Math.round(bandH * scale));
  const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", seekTime(first, fps), "-i", mp4, "-frames:v", String(last - first + 1),
    "-vf", `crop=${width}:${bandH}:0:${height - bandH},scale=${SAMPLE_WIDTH}:${h}:flags=neighbor`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 28 });
  const size = SAMPLE_WIDTH * h * 3;
  const rgb = hexRgb(style.highlight);
  return Array.from({ length: Math.floor(raw.length / size) }, (_, i) => ({ frame: first + i, x: highlightCentroid(raw.subarray(i * size, (i + 1) * size), SAMPLE_WIDTH, h, rgb) }));
}

/** Check three words of a rendered scene: the highlight must arrive at the word's frame and leave at the next word's (or page end's), each within tolerance. */
export function checkCaptionSync(mp4, { words, brand, width, height, fps, options = {} }) {
  const style = captionStyle(brand);
  const pages = captionPages(words, options);
  const window = (frame) => nearestSwitch(bandCentroids(mp4, { width, height, fps }, style, Math.max(0, frame - SEARCH_FRAMES), frame + SEARCH_FRAMES), frame);
  const minLength = (2 * SEARCH_FRAMES + 1) / fps;
  const rows = chooseCheckWords(words, options.check, minLength).map((w) => {
    const enterAt = wordFrame(w.start, fps);
    const leaveAt = wordFrame(leaveTime(pages, w), fps);
    return { text: w.text, start: w.start, ...wordVerdict({ expected: enterAt, seen: window(enterAt) }, { expected: leaveAt, seen: window(leaveAt) }) };
  });
  return { pass: rows.length > 0 && rows.every((r) => r.pass), rows };
}

const offset = (v) => (v.seen === null ? "never" : `${v.seen} (${v.seen - v.expected >= 0 ? "+" : ""}${v.seen - v.expected})`);

export const formatSyncReport = ({ pass, rows }, fps) =>
  [`caption sync (${fps}fps, tolerance ${SYNC_TOLERANCE_FRAMES} frames): ${pass ? "PASS" : "FAIL"}`,
    ...rows.map((r) => `  ${r.pass ? "PASS" : "FAIL"}  "${r.text}" at ${r.start.toFixed(3)}s: highlight in at frame ${offset(r.enter)} vs expected ${r.enter.expected}, out at ${offset(r.leave)} vs expected ${r.leave.expected}`)].join("\n");
