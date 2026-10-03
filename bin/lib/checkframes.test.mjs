// Pure scoring functions on synthetic arrays, a synthetic pixel buffer, and black-box runs of `bin/video frames` on tiny ffmpeg-made clips.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DEAD_DIFF, SAMPLE_FPS, analyse, blankRuns, deadRuns, evaluate, teleports } from "./checkframes.mjs";

const FPS = 30;
const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..", "video");
/** n steps of motion that vary smoothly around `level`, so they are neither dead nor spiky. */
const motion = (n, level = 1) => Array.from({ length: n }, (_, i) => level * (0.8 + 0.4 * Math.abs(Math.sin(i / 5))));

test("blankRuns flags a run of flat frames longer than the grace, ignores a short lead-in", () => {
  const stds = [...Array(6).fill(0.1), ...Array(30).fill(40), ...Array(20).fill(0.5), ...Array(10).fill(40)];
  const runs = blankRuns(stds, FPS);
  assert.equal(runs.length, 1, "the 6-frame (0.2s) lead-in is inside the grace, the 20-frame (0.67s) run is not");
  assert.ok(Math.abs(runs[0].from - 36 / FPS) < 1e-9);
  assert.ok(Math.abs(runs[0].seconds - 20 / FPS) < 1e-9);
});

test("blankRuns passes a clip that is never flat", () => {
  assert.deepEqual(blankRuns(Array(90).fill(25), FPS), []);
});

test("deadRuns flags only holds longer than the limit; a shorter hold is fine", () => {
  const diffs = [...motion(20), ...Array(45).fill(0), ...motion(20), ...Array(90).fill(0.001), ...motion(5)];
  const dead = deadRuns(diffs, FPS, { maxHold: 2 });
  assert.equal(dead.length, 1, "1.5s hold passes, 3s hold fails");
  assert.ok(Math.abs(dead[0].seconds - 3) < 1e-9);
  assert.equal(deadRuns(diffs, FPS, { maxHold: 4 }).length, 0, "the limit is configurable");
  assert.equal(deadRuns(diffs, FPS, { maxHold: 1 }).length, 2);
});

test("deadRuns counts a hold at the very end of the clip", () => {
  const diffs = [...motion(10), ...Array(75).fill(0)];
  assert.equal(deadRuns(diffs, FPS, { maxHold: 2 }).length, 1);
});

test("teleports flags an isolated spike far above the median motion", () => {
  const diffs = motion(120);
  diffs[60] = 40; // a jump: 40x the typical step, neighbours are normal
  const t = teleports(diffs, FPS);
  assert.equal(t.length, 1);
  assert.ok(Math.abs(t[0].at - 61 / FPS) < 1e-9);
  assert.ok(t[0].ratio > 20);
});

test("teleports ignores a big move that ramps in and out smoothly", () => {
  const diffs = motion(120);
  [3, 6, 10, 12, 10, 6, 3].forEach((v, i) => { diffs[50 + i] = v; });
  assert.deepEqual(teleports(diffs, FPS), [], "spike of 12 is 10x median but its neighbours are 10, so it is motion, not a jump");
});

test("teleports does not flag small noise in an otherwise still clip (absolute floor)", () => {
  const diffs = Array(100).fill(0);
  diffs[50] = 1;
  assert.deepEqual(teleports(diffs, FPS), []);
});

test("teleports flags a hard cut inside an otherwise still clip", () => {
  const diffs = Array(100).fill(0);
  diffs[50] = 30;
  const t = teleports(diffs, FPS);
  assert.equal(t.length, 1);
  assert.equal(t[0].ratio, Infinity);
});

test("evaluate: a clean synthetic clip passes all three rules", () => {
  const r = evaluate({ stds: Array(121).fill(30), diffs: motion(120) }, { fps: FPS });
  assert.equal(r.pass, true);
  assert.deepEqual(r.checks.map((c) => c.id), ["blank", "dead", "teleport"]);
});

test("evaluate: each rule can fail on its own and names where", () => {
  const stds = [...Array(30).fill(30), ...Array(30).fill(0), ...Array(61).fill(30)];
  const diffs = motion(120);
  diffs[100] = 50;
  for (let i = 0; i < 10; i++) diffs[i] = 0;
  const r = evaluate({ stds, diffs }, { fps: FPS, maxHold: 0.2 });
  assert.equal(r.pass, false);
  assert.ok(r.checks.every((c) => !c.pass));
  assert.match(r.checks[0].detail, /1\.00s to 2\.00s/);
});

test("analyse: std and consecutive diff of a synthetic grey buffer", () => {
  const px = 4;
  const flat = Buffer.alloc(px * px, 100);
  const half = Buffer.alloc(px * px, 0);
  half.fill(200, 0, (px * px) / 2);
  const { stds, diffs } = analyse(Buffer.concat([flat, flat, half]), px);
  assert.equal(stds.length, 3);
  assert.equal(stds[0], 0);
  assert.ok(Math.abs(stds[2] - 100) < 1e-9);
  assert.equal(diffs.length, 2);
  assert.equal(diffs[0], 0);
  assert.ok(Math.abs(diffs[1] - 100) < 1e-9, "half the pixels moved by 100 and half by 100");
  assert.ok(DEAD_DIFF < 1 && SAMPLE_FPS >= 24);
});

// ---- black box: the CLI on tiny clips made with ffmpeg ----
const clip = (dir, name, lavfi) => {
  const out = join(dir, name);
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", lavfi, "-pix_fmt", "yuv420p", "-c:v", "libx264", out]);
  assert.equal(r.status, 0, String(r.stderr));
  return out;
};
const frames = (...args) => spawnSync("node", [VIDEO, "frames", ...args], { encoding: "utf8" });

test("bin/video frames: a flat clip FAILS blank and dead, exits 2, and still writes the contact sheet", () => {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  const f = clip(dir, "flat.mp4", "color=c=0xfaf7f1:s=320x320:r=30:d=4");
  const r = frames(f);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL {2}no blank/);
  assert.match(r.stdout, /FAIL {2}no dead stretch/);
  assert.ok(existsSync(join(dir, "flat-sheet.png")), "sheet is written next to the mp4 even on FAIL");
});

test("bin/video frames: a clip with a hard cut FAILS the teleport rule; --sheet DIR moves the sheet", () => {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  const sheets = join(dir, "sheets");
  const f = clip(dir, "cut.mp4", "testsrc2=s=320x320:r=30:d=2,split[a][b];[b]negate,trim=start=1,setpts=PTS-STARTPTS[n];[a]trim=end=1[o];[o][n]concat");
  const r = frames(f, "--sheet", sheets);
  assert.match(r.stdout, /teleport/);
  assert.ok(existsSync(join(sheets, "cut-sheet.png")));
});

test("bin/video frames: a moving clip passes and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  const f = clip(dir, "move.mp4", "testsrc2=s=320x320:r=30:d=3");
  const r = frames(f);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /frame check PASS/);
});

test("bin/video frames: missing file and missing argument exit 2 with a message", () => {
  assert.equal(frames("/nope/x.mp4").status, 2);
  assert.match(frames().stderr, /which file/);
});
