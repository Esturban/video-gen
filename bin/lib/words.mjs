// Word timings from the narration audio (CMO-7584), all local: whisper-cli (whisper.cpp, Homebrew) with the large-v3-turbo model already on this Mac.
// Each narrated beat's wav is transcribed once with one word per segment, cached next to the wav under the beat's narration key,
// then placed on the scene clock (beat start + voiceAt). bin/video render writes the result to out/<area>/<name>/words.json.
// A TTS engine that knows its own word times (Kokoro, TIMED in voice/engines/) writes that cache itself from voice/narrate.py,
// moved onto landmarks in the wav; whisper-cli runs only for engines without word times. whisper word starts run early.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export const WHISPER_BIN = process.env.VIDEO_WHISPER_BIN ?? "/opt/homebrew/bin/whisper-cli";
export const WHISPER_MODEL = process.env.VIDEO_WHISPER_MODEL ?? join(homedir(), ".config", "open-wispr", "models", "ggml-large-v3-turbo.bin");
const WHISPER_RATE = 16000; // whisper.cpp wants 16 kHz mono
const NOT_SPEECH = /^\[.*\]$|^\(.*\)$/; // [BLANK_AUDIO], (music) and the like

/** whisper-cli arguments: one word per segment (-ml 1 -sow), JSON out, nothing else printed. */
export const whisperArgs = (model, wav, outBase) => ["-m", model, "-f", wav, "-ml", "1", "-sow", "-oj", "-np", "-l", "en", "-of", outBase];

/** whisper-cli JSON to [{ text, start, end }] in seconds, dropping empty and non-speech segments. */
export function parseWhisperJson(json) {
  if (!Array.isArray(json?.transcription)) throw new Error("whisper output has no transcription array");
  return json.transcription
    .map((s) => ({ text: String(s.text ?? "").trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000 }))
    .filter((w) => w.text && !NOT_SPEECH.test(w.text));
}

/** Show the script's own spelling ("one." not "1:") when whisper heard the same number of words; otherwise keep what whisper heard. */
export function alignToScript(words, script) {
  const said = String(script ?? "").split(/\s+/).filter(Boolean);
  if (said.length !== words.length) return words;
  return words.map((w, i) => ({ ...w, text: said[i] }));
}

const r3 = (x) => Math.round(x * 1000) / 1000;
const MIN_WORD_S = 0.12; // a zero-length word at the end of a beat still gets this long on screen
const SAME_S = 0.001;

/**
 * whisper sometimes stacks words on one start or returns a zero-length word ("plus" at 9.42..9.42 with "a" also at 9.42), which
 * would never be highlighted. Words sharing a start split the time up to the next distinct start evenly; a zero-length word gets a
 * minimum length. Well-formed words come back unchanged.
 */
export function normalizeWords(words) {
  const out = [];
  for (let i = 0; i < words.length;) {
    let j = i;
    while (j + 1 < words.length && Math.abs(words[j + 1].start - words[i].start) < SAME_S) j++;
    const run = words.slice(i, j + 1);
    const next = words[j + 1]?.start;
    if (run.length === 1) {
      const w = run[0];
      out.push(w.end > w.start ? w : { ...w, end: r3(next ?? w.start + MIN_WORD_S) });
    } else {
      const s = run[0].start;
      const until = next ?? Math.max(run.at(-1).end, s + MIN_WORD_S * run.length);
      const slot = (until - s) / run.length;
      run.forEach((w, k) => out.push({ ...w, start: r3(s + k * slot), end: r3(k < run.length - 1 ? s + (k + 1) * slot : Math.max(w.end, s + (k + 1) * slot)) }));
    }
    i = j + 1;
  }
  return out;
}

/** Put each narrated beat's words on the scene clock: beat start + voiceAt + word time, clamped inside the beat, tagged with the beat number. */
export function sceneWords(beats, perBeat) {
  return beats.filter((b) => b.narration && perBeat[b.n]).flatMap((b) => {
    const at = b.start + (b.voiceAt ?? 0);
    return perBeat[b.n].map((w) => ({ text: w.text, start: r3(Math.min(at + w.start, b.end)), end: r3(Math.min(at + w.end, b.end)), beat: b.n }));
  });
}

function requireWhisper() {
  if (!existsSync(WHISPER_BIN)) throw new Error(`whisper-cli not found at ${WHISPER_BIN}. Install it with: brew install whisper-cpp (or set VIDEO_WHISPER_BIN)`);
  if (!existsSync(WHISPER_MODEL)) throw new Error(`whisper model not found at ${WHISPER_MODEL} (set VIDEO_WHISPER_MODEL to a local ggml model)`);
}

/** Transcribe one wav with whisper-cli, locally. Returns [{ text, start, end }] in seconds from the start of the wav. */
export function transcribe(wav) {
  requireWhisper();
  const work = mkdtempSync(join(tmpdir(), "words-"));
  try {
    const mono = join(work, "in.wav");
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-ar", String(WHISPER_RATE), "-ac", "1", "-c:a", "pcm_s16le", mono]);
    execFileSync(WHISPER_BIN, whisperArgs(WHISPER_MODEL, mono, join(work, "out")), { stdio: ["ignore", "ignore", "pipe"] });
    return parseWhisperJson(JSON.parse(readFileSync(join(work, "out.json"), "utf8")));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Words for every narrated beat of a timed scene, from <scene>/audio/beat<n>.wav. A beat's result is cached as beat<n>.words.json,
 * reused while its narration key (beat<n>.key, written by voice/narrate.py) is unchanged. `log` reports each beat transcribed.
 */
export function wordsForScene(dir, scene, log = () => {}) {
  const perBeat = {};
  for (const b of scene.beats.filter((x) => x.narration)) {
    const wav = join(dir, "audio", `beat${b.n}.wav`);
    if (!existsSync(wav)) throw new Error(`beat ${b.n}: ${wav} is missing; run bin/video voice first`);
    const keyFile = join(dir, "audio", `beat${b.n}.key`);
    const key = existsSync(keyFile) ? readFileSync(keyFile, "utf8") : null;
    const cache = join(dir, "audio", `beat${b.n}.words.json`);
    const cached = existsSync(cache) ? JSON.parse(readFileSync(cache, "utf8")) : null;
    if (cached && key && cached.key === key) { perBeat[b.n] = normalizeWords(cached.words); continue; }
    log(`words: beat ${b.n} (whisper-cli, local)`);
    const words = alignToScript(transcribe(wav), b.narration);
    if (!words.length) throw new Error(`beat ${b.n}: whisper heard no words in ${wav}`);
    writeFileSync(cache, JSON.stringify({ key, words }, null, 1) + "\n");
    perBeat[b.n] = normalizeWords(words);
  }
  return sceneWords(scene.beats, perBeat);
}
