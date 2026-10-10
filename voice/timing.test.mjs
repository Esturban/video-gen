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
