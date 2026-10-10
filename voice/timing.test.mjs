// Beat timing from the real narration audio (CMO-7584). Runs voice/narrate.py's retime() under python3 against a wav of known length.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const VOICE = dirname(fileURLToPath(import.meta.url));
const KNOWN_S = 1.5;

/** A mono wav of exactly KNOWN_S seconds, made by ffmpeg, so the measured length is known in advance. */
function knownWav() {
  const wav = join(mkdtempSync(join(tmpdir(), "timing-")), "known.wav");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=24000:duration=${KNOWN_S}`, "-c:a", "pcm_s16le", wav]);
  return wav;
}

/** Call narrate.py's python functions directly; prints JSON back. */
function py(code, ...args) {
  const out = execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(VOICE)}); import narrate\n${code}`, ...args]).toString();
  return JSON.parse(out);
}

test("duration() measures the fixture wav from the audio itself", () => {
  const d = py("print(json.dumps(narrate.duration(narrate.Path(sys.argv[1]))))", knownWav());
  assert.ok(Math.abs(d - KNOWN_S) < 0.01, `measured ${d}`);
});

test("a narrated beat lasts lead + measured audio + hold, with no hand-set seconds in the scene", () => {
  const d = py("print(json.dumps(narrate.duration(narrate.Path(sys.argv[1]))))", knownWav());
  const beats = [{ n: 0, kind: "a", narration: "x" }, { n: 1, kind: "a", narration: "y" }];
  const { timing, consts } = py("b=json.loads(sys.argv[1]); d=json.loads(sys.argv[2]); print(json.dumps({'timing': narrate.retime(b, {0: d, 1: d}), 'consts': [narrate.LEAD, narrate.HOLD, narrate.SECTION_HOLD]}))", JSON.stringify(beats), JSON.stringify(d));
  const [LEAD, HOLD] = consts;
  assert.equal(timing[0].start, 0);
  assert.equal(timing[0].voiceAt, LEAD);
  assert.ok(Math.abs(timing[0].end - (LEAD + KNOWN_S + HOLD)) <= 1 / 60 + 1e-9, `beat 0 ends ${timing[0].end}`);
  assert.equal(timing[1].start, timing[0].end);
  assert.ok(Math.abs(timing[0].voice - KNOWN_S) < 0.01);
});

test("a later beat of a new kind gets the section hold, and a beat's tail adds to it", () => {
  const beats = [{ n: 0, kind: "a", narration: "x", tail: 0.5 }, { n: 1, kind: "b", narration: "y" }];
  const { timing, consts } = py("b=json.loads(sys.argv[1]); print(json.dumps({'timing': narrate.retime(b, {0: 1.0, 1: 1.0}), 'consts': [narrate.LEAD, narrate.HOLD, narrate.SECTION_HOLD]}))", JSON.stringify(beats));
  const [LEAD, , SECTION] = consts;
  assert.ok(Math.abs(timing[0].end - (LEAD + 1.0 + SECTION + 0.5)) <= 1 / 60 + 1e-9);
});

test("a beat without narration keeps its own length and moves to follow the narrated beat before it", () => {
  const beats = [{ n: 0, kind: "a", narration: "x" }, { n: 1, kind: "a", start: 0, end: 3 }];
  const timing = py("b=json.loads(sys.argv[1]); print(json.dumps(narrate.retime(b, {0: 1.0})))", JSON.stringify(beats));
  const silent = timing.find((t) => t.n === 1);
  assert.equal(silent.start, timing[0].end);
  assert.ok(Math.abs(silent.end - silent.start - 3) < 1e-9);
});

test("beats before any narration keep their hand times untouched", () => {
  const beats = [{ n: 0, kind: "a", start: 0, end: 2 }, { n: 1, kind: "a", narration: "x" }];
  const timing = py("b=json.loads(sys.argv[1]); print(json.dumps(narrate.retime(b, {1: 1.0})))", JSON.stringify(beats));
  assert.equal(timing.find((t) => t.n === 0), undefined);
  assert.equal(timing[0].start, 2);
});

/** A mono 24 kHz wav: 0.5s tone, 0.4s silence, 0.5s tone, so the voice comes back at exactly 0.9s. */
function pausedWav() {
  const wav = join(mkdtempSync(join(tmpdir(), "timing-")), "paused.wav");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=24000:duration=0.5", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.4",
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=24000:duration=0.5", "-filter_complex", "[0][1][2]concat=n=3:v=0:a=1", "-c:a", "pcm_s16le", wav]);
  return wav;
}

test("timed_words() moves a TTS word that starts inside a pause of the wav to where the voice comes back", () => {
  const words = [{ text: "one", start: 0.1, end: 0.62 }, { text: "two", start: 0.7, end: 1.3 }];
  const out = py("print(json.dumps(narrate.timed_words(json.loads(sys.argv[1]), narrate.Path(sys.argv[2]))))", JSON.stringify(words), pausedWav());
  assert.equal(out[0].start, 0.1);
  assert.ok(Math.abs(out[0].end - 0.5) <= 0.005, `one ends ${out[0].end}`);
  assert.ok(Math.abs(out[1].start - 0.9) <= 0.005, `two starts ${out[1].start}`);
});

test("needs_voice() re-synthesises when a timing engine has no word file of its own, and not when key and source match", () => {
  const dir = mkdtempSync(join(tmpdir(), "timing-"));
  const res = py(`from pathlib import Path
d = Path(sys.argv[1]); wav, key, words = d/'b.wav', d/'b.key', d/'b.words.json'
wav.write_bytes(b'x'); key.write_text('k')
r = {}
words.write_text(json.dumps({'key': 'k', 'words': []}))
r['whisper_cache_timed_engine'] = narrate.needs_voice(False, wav, key, words, 'k', 'kokoro')
r['whisper_cache_plain_engine'] = narrate.needs_voice(False, wav, key, words, 'k', None)
words.write_text(json.dumps({'key': 'k', 'source': 'kokoro', 'words': []}))
r['older_onset_rules'] = narrate.needs_voice(False, wav, key, words, 'k', 'kokoro')
words.write_text(json.dumps({'key': 'k', 'source': 'kokoro', 'rules': narrate.onsets.RULES, 'words': []}))
r['own_cache'] = narrate.needs_voice(False, wav, key, words, 'k', 'kokoro')
r['forced'] = narrate.needs_voice(True, wav, key, words, 'k', 'kokoro')
r['key_changed'] = narrate.needs_voice(False, wav, key, words, 'k2', 'kokoro')
print(json.dumps(r))`, dir);
  assert.deepEqual(res, { whisper_cache_timed_engine: true, whisper_cache_plain_engine: false, older_onset_rules: true, own_cache: false, forced: true, key_changed: true });
});

test("timed_words() moves a weak-onset word after a hissing word to where the hiss ends, and ends the word before there", () => {
  const wav = join(mkdtempSync(join(tmpdir(), "timing-")), "hiss.wav");
  execFileSync("python3", ["-c", `import numpy as np, wave
SR=24000; t=lambda s: np.arange(int(s*SR))/SR
tone=lambda s: 0.3*(np.sin(2*np.pi*150*t(s))+0.5*np.sin(2*np.pi*300*t(s)))
rng=np.random.default_rng(3); n=rng.standard_normal(int(0.1*SR)); hiss=0.2*np.diff(n, prepend=0)
x=np.concatenate([tone(0.4), hiss, tone(0.3)])
w=wave.open(${JSON.stringify(wav)},'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x*32767).astype('<i2').tobytes()); w.close()`]);
  const words = [{ text: "as", start: 0.2, end: 0.46 }, { text: "its", start: 0.46, end: 0.7 }];
  const out = py("print(json.dumps(narrate.timed_words(json.loads(sys.argv[1]), narrate.Path(sys.argv[2]))))", JSON.stringify(words), wav);
  assert.ok(Math.abs(out[1].start - 0.5) <= 0.01, `its starts ${out[1].start}`);
  assert.equal(out[0].end, out[1].start);
});
