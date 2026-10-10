// Caption sync against the audio itself (CMO-7584 follow-up). captionsync.mjs proves the highlight follows words.json; this proves
// words.json follows the voice. voice/audioref.py decodes the delivered mp4's own audio track, force-aligns the words' TEXT (never
// their times) with a local model, and refines each word to an acoustic onset (pause end, stop burst, or frication start). For
// the same three checked words, the highlight frame read from the render must land within SYNC_TOLERANCE_FRAMES of the frame that
// audio onset maps to. Everything is local; the aligner model downloads once, like the whisper model before it.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { captionStyle, wordFrame } from "../../engine/captionMath.js";
import { bandCentroids, chooseCheckWords, nearestSwitch, SYNC_TOLERANCE_FRAMES } from "./captionsync.mjs";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEARCH_FRAMES = 4;
const CONTROL_FRAMES = 3;
// Pinned so the aligner behaves the same every run; torchaudio's forced_align is deprecated in later releases.
const ALIGNER_ENV = ["run", "--quiet", "--python", "3.12", "--with", "torch==2.5.1", "--with", "torchaudio==2.5.1", "--with", "numpy"];

/** voice/audioref.py output, checked against the words it was asked about: one entry per word, same text, in order. */
export function parseAudioRefs(refs, words) {
  if (!Array.isArray(refs) || refs.length !== words.length) throw new Error(`audio reference has ${refs?.length ?? 0} entries for ${words.length} words`);
  refs.forEach((r, i) => {
    if (r.text !== words[i].text) throw new Error(`audio reference ${i} is "${r.text}", expected "${words[i].text}"`);
  });
  return refs;
}

/** Frames to read: both the audio onset's frame and the words.json frame, with a margin either side. */
export const audioSearchWindow = (audioFrame, wordsFrame, margin = SEARCH_FRAMES) =>
  [Math.max(0, Math.min(audioFrame, wordsFrame) - margin), Math.max(audioFrame, wordsFrame) + margin];

export const audioVerdict = (expected, seen) => ({ expected, seen, pass: seen !== null && Math.abs(seen - expected) <= SYNC_TOLERANCE_FRAMES });

/** [{ word, ref, seen }] to report rows: the audio onset's frame is what the highlight is held to. */
export const audioRows = (checked, fps) =>
  checked.map(({ word, ref, seen }) => ({ text: word.text, start: word.start, audio: ref.start, rule: ref.rule, ...audioVerdict(wordFrame(ref.start, fps), seen) }));

/** Would the check still pass with every highlight moved by `frames`? The control: at +/-3 it must not. */
export const shiftedVerdict = (rows, frames) => rows.every((r) => r.seen !== null && Math.abs(r.seen + frames - r.expected) <= SYNC_TOLERANCE_FRAMES);

/** Run voice/audioref.py on the media file's audio track for these words' text. Returns one { text, aligner, start, rule } per word. */
export function audioReferences(media, words) {
  const work = mkdtempSync(join(tmpdir(), "audioref-"));
  try {
    const texts = join(work, "words.json");
    writeFileSync(texts, JSON.stringify(words.map((w) => w.text)));
    const out = execFileSync("uv", [...ALIGNER_ENV, "python", join(KIT, "voice", "audioref.py"), media, texts], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
    return parseAudioRefs(JSON.parse(out.toString()), words);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The three checked words' highlight frames in the render, each held to its onset in the render's own audio. */
export function checkAudioSync(mp4, { words, brand, width, height, fps, options = {}, refs = audioReferences(mp4, words) }) {
  const style = captionStyle(brand);
  const minLength = (2 * SEARCH_FRAMES + 1) / fps;
  const hasOnset = (w) => refs[words.indexOf(w)]?.start != null;
  const checked = chooseCheckWords(words, options.check, minLength, hasOnset).map((word) => {
    const ref = refs[words.indexOf(word)];
    if (ref.start == null) throw new Error(`"${word.text}" has no audio onset (no letters to align)`);
    const wordsAt = wordFrame(word.start, fps);
    const [first, last] = audioSearchWindow(wordFrame(ref.start, fps), wordsAt);
    return { word, ref, seen: nearestSwitch(bandCentroids(mp4, { width, height, fps }, style, first, last), wordsAt) };
  });
  const rows = audioRows(checked, fps);
  return { pass: rows.length > 0 && rows.every((r) => r.pass), rows, control: { plus: shiftedVerdict(rows, CONTROL_FRAMES), minus: shiftedVerdict(rows, -CONTROL_FRAMES) } };
}

const offset = (r) => (r.seen === null ? "never" : `${r.seen} (${r.seen - r.expected >= 0 ? "+" : ""}${r.seen - r.expected})`);
const verdict = (passed) => (passed ? "PASS" : "FAIL");

export const formatAudioReport = ({ pass, rows, control }, fps) =>
  [`caption sync vs audio (${fps}fps, tolerance ${SYNC_TOLERANCE_FRAMES} frames): ${verdict(pass)}`,
    ...rows.map((r) => `  ${verdict(r.pass)}  "${r.text}" audio onset ${r.audio.toFixed(3)}s (${r.rule}): highlight in at frame ${offset(r)} vs audio frame ${r.expected}; words.json ${r.start.toFixed(3)}s`),
    `  control: highlight moved +${CONTROL_FRAMES} frames ${verdict(control.plus)}, -${CONTROL_FRAMES} frames ${verdict(control.minus)} (must both FAIL)`].join("\n");
