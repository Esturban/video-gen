// Word onsets from the audio itself (CMO-7584 follow-up). Runs voice/onsets.py under python3 (numpy) on synthetic signals whose
// pauses, stop closures and frication onsets sit at known times, so every detector is checked against a ground truth it did not make.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const VOICE = dirname(fileURLToPath(import.meta.url));
const SR = 24000;

/** Run python against voice/onsets.py with a small signal builder in scope; prints JSON back. */
function py(code, ...args) {
  const prelude = `import sys, json, numpy as np; sys.path.insert(0, ${JSON.stringify(VOICE)}); import onsets
SR = ${SR}
rng = np.random.default_rng(7)
def tone(s, f=150): t = np.arange(int(s*SR))/SR; return 0.3*(np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*2*f*t)+0.3*np.sin(2*np.pi*3*f*t))
def hiss(s): x = rng.standard_normal(int(s*SR)); return 0.2*np.diff(x, prepend=0)
def gap(s): return np.zeros(int(s*SR))
`;
  return JSON.parse(execFileSync("python3", ["-c", `${prelude}\n${code}`, ...args]).toString());
}

test("pauses() finds a 300ms silence between two voiced stretches, to within 5ms", () => {
  const runs = py("x = np.concatenate([tone(0.3), gap(0.3), tone(0.4)]); print(json.dumps(onsets.pauses(x, SR)))");
  assert.equal(runs.length, 1);
  assert.ok(Math.abs(runs[0][0] - 0.3) <= 0.005 && Math.abs(runs[0][1] - 0.6) <= 0.005, JSON.stringify(runs));
});

test("pauses() ignores a stop closure shorter than the minimum pause", () => {
  const runs = py("x = np.concatenate([tone(0.3), gap(0.06), tone(0.3)]); print(json.dumps(onsets.pauses(x, SR)))");
  assert.deepEqual(runs, []);
});

test("snap_to_pauses() moves a word that starts inside a pause to the speech onset, and ends the word before at the pause", () => {
  const words = [{ text: "here", start: 1.5, end: 2.0 }, { text: "was", start: 2.03, end: 2.26 }, { text: "timed", start: 2.26, end: 2.67 }];
  const out = py("print(json.dumps(onsets.snap_to_pauses(json.loads(sys.argv[1]), [[1.75, 2.12]])))", JSON.stringify(words));
  assert.deepEqual(out, [{ text: "here", start: 1.5, end: 1.75 }, { text: "was", start: 2.12, end: 2.26 }, { text: "timed", start: 2.26, end: 2.67 }]);
});

test("snap_to_pauses() leaves words outside every pause exactly as they were", () => {
  const words = [{ text: "on", start: 2.49, end: 2.61 }, { text: "this", start: 2.61, end: 2.78 }];
  assert.deepEqual(py("print(json.dumps(onsets.snap_to_pauses(json.loads(sys.argv[1]), [[0.0, 0.41]])))", JSON.stringify(words)), words);
});

test("tts_words() folds punctuation into the word before it and offsets each segment by the audio before it", () => {
  const segments = [
    { seconds: 2.0, tokens: [["Hello", 0.375, 0.7], [",", 0.7, 0.8], ["there", 0.8, 1.2], [".", 1.2, 1.3]] },
    { seconds: 1.0, tokens: [["Again", 0.3, 0.8], ["!", null, null]] },
  ];
  assert.deepEqual(py("print(json.dumps(onsets.tts_words(json.loads(sys.argv[1]))))", JSON.stringify(segments)), [
    { text: "Hello,", start: 0.375, end: 0.7 },
    { text: "there.", start: 0.8, end: 1.2 },
    { text: "Again!", start: 2.3, end: 2.8 },
  ]);
});

test("first_sound() sorts a word by how its first sound starts in the audio", () => {
  const got = py("print(json.dumps({w: onsets.first_sound(w) for w in sys.argv[1:]}))", "timed", "short", "this", "Each", "cell", "chip", "phone", "hold", "Kite", "\"Gone");
  assert.deepEqual(got, { timed: "stop", short: "fricative", this: "other", Each: "other", cell: "fricative", chip: "stop", phone: "fricative", hold: "fricative", Kite: "stop", "\"Gone": "stop" });
});

test("onset() puts a stop-initial word at its audible burst, not at the silent closure before it nor the late aligner guess", () => {
  // closure 0.50 to 0.56 is silent; the burst (first audible energy) is at 0.56
  for (const guess of [0.58, 0.53]) {
    const t = py(`x = np.concatenate([tone(0.5), gap(0.06), hiss(0.01), tone(0.3)]); print(json.dumps(onsets.onset(x, SR, ${guess}, 'stop')))`);
    assert.ok(Math.abs(t.start - 0.56) <= 0.005 && t.rule === "burst", `${guess}: ${JSON.stringify(t)}`);
  }
});

test("onset() puts a voiced stop at its burst when the closure carries a faint voice bar", () => {
  const t = py("x = np.concatenate([tone(0.5), 0.02*tone(0.05), hiss(0.01), tone(0.3)]); print(json.dumps(onsets.onset(x, SR, 0.57, 'stop')))");
  assert.ok(Math.abs(t.start - 0.55) <= 0.005 && t.rule === "burst", JSON.stringify(t));
});

test("onset() puts a fricative-initial word where the frication starts", () => {
  const t = py("x = np.concatenate([tone(0.5), hiss(0.15), tone(0.3)]); print(json.dumps(onsets.onset(x, SR, 0.6, 'fricative')))");
  assert.ok(Math.abs(t.start - 0.5) <= 0.01 && t.rule === "frication", JSON.stringify(t));
});

test("onset() puts any word that follows a pause at the end of the pause", () => {
  const t = py("x = np.concatenate([tone(0.3), gap(0.3), tone(0.4)]); print(json.dumps(onsets.onset(x, SR, 0.64, 'other')))");
  assert.ok(Math.abs(t.start - 0.6) <= 0.005 && t.rule === "pause", JSON.stringify(t));
});

test("onset() keeps the aligner time when no landmark is in reach", () => {
  const t = py("x = tone(1.0); print(json.dumps(onsets.onset(x, SR, 0.5, 'other')))");
  assert.deepEqual(t, { start: 0.5, rule: "aligner" });
});

test("onset() never reaches back past its search window for a closure (a stop ending the word before is not this word's closure)", () => {
  const t = py("x = np.concatenate([tone(0.4), gap(0.12), tone(0.4)]); print(json.dumps(onsets.onset(x, SR, 0.6, 'stop')))");
  assert.deepEqual(t, { start: 0.6, rule: "aligner" });
});

test("last_sound() sorts a word by how its last sound ends: nasal murmur, hiss, or other", () => {
  const got = py("print(json.dumps({w: onsets.last_sound(w) for w in sys.argv[1:]}))", "on", "as", "the", "laptop,", "ring", "box", "rice", "came", "dish");
  assert.deepEqual(got, { on: "nasal", as: "fricative", the: "other", "laptop,": "other", ring: "nasal", box: "fricative", rice: "fricative", came: "nasal", dish: "fricative" });
});

test("onset() finds a fricative-initial word from an early guess as well as a late one", () => {
  const t = py("x = np.concatenate([tone(0.5), hiss(0.15), tone(0.3)]); print(json.dumps(onsets.onset(x, SR, 0.46, 'fricative')))");
  assert.ok(Math.abs(t.start - 0.5) <= 0.01 && t.rule === "frication", JSON.stringify(t));
});

test("onset() puts a weak-onset word after a hissing word where the hiss ends, from either side", () => {
  for (const guess of [0.46, 0.55]) {
    const t = py(`x = np.concatenate([tone(0.4), hiss(0.1), tone(0.3)]); print(json.dumps(onsets.onset(x, SR, ${guess}, 'other', 'fricative')))`);
    assert.ok(Math.abs(t.start - 0.5) <= 0.01 && t.rule === "frication end", `${guess}: ${JSON.stringify(t)}`);
  }
});

test("onset() puts a weak-onset word after a nasal where the murmur ends and the high band comes back", () => {
  for (const guess of [0.36, 0.45]) {
    const t = py(`x = np.concatenate([tone(0.4), tone(0.3) + 0.05*hiss(0.3)]); print(json.dumps(onsets.onset(x, SR, ${guess}, 'other', 'nasal')))`);
    assert.ok(Math.abs(t.start - 0.4) <= 0.01 && t.rule === "nasal end", `${guess}: ${JSON.stringify(t)}`);
  }
});
