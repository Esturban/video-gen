// Caption sync against the audio (CMO-7584 follow-up). Pure parts only; the aligner run and the frame reads are checked by bin/video render.
import { test } from "node:test";
import assert from "node:assert/strict";
import { audioRows, audioSearchWindow, audioVerdict, formatAudioReport, parseAudioRefs, shiftedVerdict } from "./audiosync.mjs";

const WORDS = [
  { text: "was", start: 2.522, end: 2.663, beat: 0 },
  { text: "timed", start: 2.663, end: 3.075, beat: 0 },
  { text: "from", start: 3.075, end: 3.212, beat: 0 },
];

test("parseAudioRefs keeps one onset per word and rejects a list that does not match the words", () => {
  const refs = [{ text: "was", aligner: 2.53, start: 2.5225, rule: "pause" }, { text: "timed", aligner: 2.731, start: 2.65, rule: "closure" }, { text: "from", aligner: 3.13, start: 3.13, rule: "aligner" }];
  assert.deepEqual(parseAudioRefs(refs, WORDS), refs);
  assert.throws(() => parseAudioRefs(refs.slice(1), WORDS), /3 words/);
  assert.throws(() => parseAudioRefs([refs[0], { ...refs[1], text: "tamed" }, refs[2]], WORDS), /"timed"/);
});

test("the search window covers both the audio frame and the words.json frame, plus a margin", () => {
  assert.deepEqual(audioSearchWindow(160, 147, 4), [143, 164]);
  assert.deepEqual(audioSearchWindow(2, 1, 4), [0, 6]);
});

test("a highlight within 2 frames of the audio onset passes; 3 frames off fails", () => {
  assert.equal(audioVerdict(160, 162).pass, true);
  assert.equal(audioVerdict(160, 158).pass, true);
  assert.equal(audioVerdict(160, 163).pass, false);
  assert.equal(audioVerdict(160, null).pass, false);
});

test("audioRows maps each checked word to its audio frame and to the highlight frame seen in the render", () => {
  const refs = [{ text: "timed", start: 2.65, rule: "closure", aligner: 2.73 }];
  const rows = audioRows([{ word: WORDS[1], ref: refs[0], seen: 160 }], 60);
  assert.deepEqual(rows, [{ text: "timed", start: 2.663, audio: 2.65, rule: "closure", expected: 159, seen: 160, pass: true }]);
});

test("the control: moving every highlight 3 frames either way makes the check fail", () => {
  const rows = [{ expected: 159, seen: 160, pass: true }, { expected: 581, seen: 581, pass: true }, { expected: 919, seen: 918, pass: true }];
  assert.equal(shiftedVerdict(rows, 0), true);
  assert.equal(shiftedVerdict(rows, 3), false);
  assert.equal(shiftedVerdict(rows, -3), false);
});

test("formatAudioReport prints each word's audio onset, rule, and the highlight frame against it, and the control", () => {
  const rows = [{ text: "timed", start: 2.663, audio: 2.65, rule: "closure", expected: 159, seen: 160, pass: true }];
  const text = formatAudioReport({ pass: true, rows, control: { plus: false, minus: false } }, 60);
  assert.match(text, /caption sync vs audio \(60fps, tolerance 2 frames\): PASS/);
  assert.match(text, /"timed" audio onset 2\.650s \(closure\): highlight in at frame 160 \(\+1\) vs audio frame 159/);
  assert.match(text, /control: highlight moved \+3 frames FAIL, -3 frames FAIL/);
});
