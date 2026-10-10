// Word timings from local whisper-cli output (CMO-7584). Pure parts only; the whisper run itself is checked by bin/video render.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alignToScript, normalizeWords, parseWhisperJson, sceneWords, whisperArgs } from "./words.mjs";

// Trimmed from a real whisper-cli -ml 1 -sow -oj run on a Kokoro beat ("Demo one. From an email ...").
const WHISPER = {
  transcription: [
    { offsets: { from: 0, to: 480 }, text: "" },
    { offsets: { from: 480, to: 1650 }, text: " Demo" },
    { offsets: { from: 1650, to: 2050 }, text: " 1:" },
    { offsets: { from: 2050, to: 2260 }, text: " From" },
    { offsets: { from: 2260, to: 2380 }, text: " an" },
    { offsets: { from: 2380, to: 2640 }, text: " email" },
    { offsets: { from: 2640, to: 2700 }, text: " [BLANK_AUDIO]" },
  ],
};

test("parseWhisperJson keeps spoken words in seconds and drops empty and bracketed tokens", () => {
  const words = parseWhisperJson(WHISPER);
  assert.deepEqual(words, [
    { text: "Demo", start: 0.48, end: 1.65 },
    { text: "1:", start: 1.65, end: 2.05 },
    { text: "From", start: 2.05, end: 2.26 },
    { text: "an", start: 2.26, end: 2.38 },
    { text: "email", start: 2.38, end: 2.64 },
  ]);
});

test("parseWhisperJson rejects output with no transcription array", () => {
  assert.throws(() => parseWhisperJson({ result: {} }), /transcription/);
});

test("alignToScript takes the script spelling when the word counts match", () => {
  const words = parseWhisperJson(WHISPER);
  const aligned = alignToScript(words, "Demo one. From an email");
  assert.deepEqual(aligned.map((w) => w.text), ["Demo", "one.", "From", "an", "email"]);
  assert.deepEqual(aligned.map((w) => w.start), words.map((w) => w.start));
});

test("alignToScript keeps whisper's words when the counts differ", () => {
  const words = parseWhisperJson(WHISPER);
  assert.deepEqual(alignToScript(words, "Demo one, from an email to a plan"), words);
});

test("sceneWords places each beat's words at beat start plus voiceAt, tagged with the beat", () => {
  const beats = [
    { n: 0, start: 0, end: 3, voiceAt: 0.4, narration: "Hi there" },
    { n: 1, start: 3, end: 6, kind: "x" },
    { n: 2, start: 6, end: 9, voiceAt: 0.4, narration: "Bye" },
  ];
  const perBeat = { 0: [{ text: "Hi", start: 0, end: 0.3 }, { text: "there", start: 0.3, end: 0.7 }], 2: [{ text: "Bye", start: 0.1, end: 0.5 }] };
  assert.deepEqual(sceneWords(beats, perBeat), [
    { text: "Hi", start: 0.4, end: 0.7, beat: 0 },
    { text: "there", start: 0.7, end: 1.1, beat: 0 },
    { text: "Bye", start: 6.5, end: 6.9, beat: 2 },
  ]);
});

test("sceneWords clamps a word that would run past its beat end", () => {
  const beats = [{ n: 0, start: 0, end: 1, voiceAt: 0.4, narration: "Long" }];
  const out = sceneWords(beats, { 0: [{ text: "Long", start: 0.2, end: 2 }] });
  assert.equal(out[0].end, 1);
});

test("whisperArgs asks for one word per segment, JSON out, no prints, local model", () => {
  const args = whisperArgs("/m.bin", "/a.wav", "/o/base");
  for (const flag of ["-ml", "-sow", "-oj", "-np"]) assert.ok(args.includes(flag), flag);
  assert.deepEqual(args.slice(args.indexOf("-m"), args.indexOf("-m") + 2), ["-m", "/m.bin"]);
  assert.deepEqual(args.slice(args.indexOf("-of"), args.indexOf("-of") + 2), ["-of", "/o/base"]);
});

test("normalizeWords shares time between words whisper stacked on one start, so every word gets shown", () => {
  // Real case from the fixture: "plus" came back as 9.42..9.42 and "a" also started at 9.42.
  const out = normalizeWords([{ text: "narration,", start: 8.9, end: 9.42 }, { text: "plus", start: 9.42, end: 9.42 }, { text: "a", start: 9.42, end: 9.6 }, { text: "short", start: 9.6, end: 9.9 }]);
  assert.deepEqual(out.map((w) => w.text), ["narration,", "plus", "a", "short"]);
  assert.equal(out[1].start, 9.42);
  assert.equal(out[2].start, 9.51);
  assert.ok(out.every((w, i) => w.end > w.start && (i === 0 || w.start > out[i - 1].start)), JSON.stringify(out));
});

test("normalizeWords gives a zero-length last word a minimum length", () => {
  const out = normalizeWords([{ text: "a", start: 1, end: 1.2 }, { text: "b", start: 1.2, end: 1.2 }]);
  assert.ok(out[1].end > out[1].start);
});

test("normalizeWords leaves well-formed words as they are", () => {
  const ws = [{ text: "a", start: 0, end: 0.3 }, { text: "b", start: 0.3, end: 0.6 }];
  assert.deepEqual(normalizeWords(ws), ws);
});
