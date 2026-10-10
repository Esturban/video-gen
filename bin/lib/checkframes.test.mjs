// Pure scoring functions on synthetic arrays, a synthetic pixel buffer, and black-box runs of `bin/video frames` on tiny ffmpeg-made clips.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEAD_DIFF, SAFE_BG_TOLERANCE, SAFE_MARGIN_PX, SAFE_MIN_INK_PX, SAFE_PX, SAMPLE_FPS,
  analyse, blankRuns, deadRuns, evaluate, marginInk, safeBand, safeRuns, safeSampleSize, teleports,
} from "./checkframes.mjs";

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

// ---- safe area: nothing but background inside the 64px margin band ----
/** A w x h grey frame filled with `bg`, optionally with value(x, y) overriding pixels. */
const frame = (w, h, bg, value = () => undefined) => {
  const buf = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf[y * w + x] = value(x, y) ?? bg;
  return buf;
};
const box = (x0, y0, x1, y1, v) => (x, y) => (x >= x0 && x < x1 && y >= y0 && y < y1 ? v : undefined);

test("safeSampleSize keeps the true aspect: long side SAFE_PX, short side scaled", () => {
  assert.deepEqual(safeSampleSize(1440, 1440), { w: SAFE_PX, h: SAFE_PX });
  assert.deepEqual(safeSampleSize(1920, 1080), { w: SAFE_PX, h: Math.round((SAFE_PX * 1080) / 1920) });
  assert.deepEqual(safeSampleSize(1080, 1920), { w: Math.round((SAFE_PX * 1080) / 1920), h: SAFE_PX });
});

test("safeBand maps the margin per axis and counts only sample pixels wholly inside it", () => {
  assert.equal(SAFE_MARGIN_PX, 64);
  // 1440 square sampled at 360: 64 px is exactly 16 sample pixels on both axes.
  assert.deepEqual(safeBand(1440, 1440, 360, 360), { x: 16, y: 16, marginPx: 64 });
  // 1920x1080: the margin scales with min(w, h) / 1440 like the brand slot (48 px), then maps per axis.
  const b = safeBand(1920, 1080, 360, 203);
  assert.equal(b.marginPx, 48);
  assert.equal(b.x, Math.floor((48 * 360) / 1920));
  assert.equal(b.y, Math.floor((48 * 203) / 1080));
  // A squashed sample would give the same band on both axes; per-axis mapping does not.
  assert.deepEqual(safeBand(2000, 1000, 200, 200, { reference: 1000 }), { x: 6, y: 12, marginPx: 64 });
});

test("marginInk: a flat background passes", () => {
  assert.deepEqual(marginInk(frame(120, 80, 240), 120, 80, { x: 8, y: 8 }), []);
});

test("marginInk: a block inside the band is flagged with its side, a block just inside the safe line is not", () => {
  const w = 120, h = 80, band = { x: 8, y: 8 };
  const inMargin = marginInk(frame(w, h, 240, box(2, 30, 6, 36, 20)), w, h, band);
  assert.ok(inMargin.length >= 1);
  assert.ok(inMargin.every((c) => c.side === "left" && c.ink >= SAFE_MIN_INK_PX));
  assert.equal(inMargin.reduce((n, c) => n + c.ink, 0), 4 * 6, "every pixel of the 4x6 block is counted once, across the cells it straddles");
  assert.deepEqual(marginInk(frame(w, h, 240, box(8, 8, 112, 72, 20)), w, h, band), [], "content filling the safe area right up to the line is fine");
});

test("marginInk: a block covering most of a cell is still flagged (its background remainder is the odd one out)", () => {
  const r = marginInk(frame(120, 80, 240, box(40, 0, 46, 7, 20)), 120, 80, { x: 8, y: 8 });
  assert.ok(r.some((c) => c.side === "top"));
});

test("marginInk: a smooth gradient background is background, not ink", () => {
  const w = 360, h = 360;
  const grad = frame(w, h, 0, (x, y) => Math.round(55 + (150 * (x + y)) / (w + h)));
  assert.deepEqual(marginInk(grad, w, h, { x: 16, y: 16 }), []);
});

test("marginInk: encode noise under the tolerance and specks under the size floor pass", () => {
  const w = 120, h = 80;
  const noisy = frame(w, h, 0, (x, y) => 120 + ((x * 7 + y * 13) % SAFE_BG_TOLERANCE)); // every value within the tolerance of any mode the cell can have
  assert.deepEqual(marginInk(noisy, w, h, { x: 8, y: 8 }), []);
  const speck = frame(w, h, 240, box(3, 40, 3 + SAFE_MIN_INK_PX - 1, 41, 0));
  assert.deepEqual(marginInk(speck, w, h, { x: 8, y: 8 }), [], "a mark smaller than SAFE_MIN_INK_PX sample pixels is a speck");
});

test("marginInk: faint page decor is background, a brand-ink mark is not (values measured on data-story-morph)", () => {
  const w = 120, h = 80, band = { x: 8, y: 8 };
  const PAGE = 249, DECOR_DOT = 193, BRAND_INK_055 = 136;
  assert.deepEqual(marginInk(frame(w, h, PAGE, box(20, 2, 25, 7, DECOR_DOT)), w, h, band), [], "a parallax decor dot under the tolerance");
  assert.equal(marginInk(frame(w, h, PAGE, box(114, 40, 118, 46, BRAND_INK_055)), w, h, band)[0].side, "right", "a signature tail in the margin");
});

test("safeRuns groups intruding samples into runs with the sides involved", () => {
  const perFrame = [[], [], [{ side: "left" }], [{ side: "left" }, { side: "bottom" }], [], [{ side: "top" }]];
  const runs = safeRuns(perFrame, 10);
  assert.equal(runs.length, 2);
  assert.ok(Math.abs(runs[0].from - 0.2) < 1e-9 && Math.abs(runs[0].to - 0.4) < 1e-9);
  assert.deepEqual(runs[0].sides, ["bottom", "left"]);
  assert.deepEqual(runs[1].sides, ["top"]);
});

test("evaluate: the safe rule appears only when safe-area samples are given, and fails on an intrusion", () => {
  const base = { stds: Array(121).fill(30), diffs: motion(120) };
  assert.deepEqual(evaluate(base, { fps: FPS }).checks.map((c) => c.id), ["blank", "dead", "teleport"]);
  const clean = evaluate({ ...base, safe: { fps: 10, perFrame: Array(40).fill([]), band: { marginPx: 64 } } }, { fps: FPS });
  assert.equal(clean.pass, true);
  assert.deepEqual(clean.checks.map((c) => c.id), ["blank", "dead", "teleport", "safe"]);
  const perFrame = Array(40).fill([]);
  perFrame[12] = [{ side: "right" }];
  const bad = evaluate({ ...base, safe: { fps: 10, perFrame, band: { marginPx: 64 } } }, { fps: FPS });
  assert.equal(bad.pass, false);
  const safe = bad.checks.find((c) => c.id === "safe");
  assert.equal(safe.pass, false);
  assert.match(safe.detail, /1\.20s.*right/);
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

// Moving content inside the safe area on a flat page: what a good scene looks like. (Before CMO-7575 this was full-bleed testsrc2, which fills the margin band.)
const MOVING_IN_SAFE = "testsrc2=s=200x200:r=30:d=3,pad=320:320:60:60:color=0xfaf7f1";

test("bin/video frames: a moving clip inside the safe area passes and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  const f = clip(dir, "move.mp4", MOVING_IN_SAFE);
  const r = frames(f);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS {2}nothing but background in the 64px margin/);
  assert.match(r.stdout, /frame check PASS/);
});

test("bin/video frames: a block in the 64px margin FAILS the safe-area rule only, and names the side", () => {
  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  // 320 px canvas: the margin is 64 * 320 / 1440 = 14.2 px. The block sits 2 px from the left edge, 8 px wide.
  const f = clip(dir, "margin.mp4", `${MOVING_IN_SAFE},drawbox=x=2:y=120:w=8:h=60:color=0x14406e:t=fill`);
  const r = frames(f);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL {2}nothing but background in the 64px margin[^\n]*\n[^\n]*left/);
  assert.match(r.stdout, /PASS {2}no blank/);
  assert.match(r.stdout, /PASS {2}no teleport/);
  assert.match(r.stderr, /frame check failed on safe/);
});

test("bin/video frames: missing file and missing argument exit 2 with a message", () => {
  assert.equal(frames("/nope/x.mp4").status, 2);
  assert.match(frames().stderr, /which file/);
});
