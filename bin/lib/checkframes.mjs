// REUSE_CHECKED: method only from github Alexwtlf/agentic-product-demo scripts/check-frames.mjs (decode with ffmpeg, score frames, a gate that fails the build and is never loosened to pass; its checks are tiled frames and luminance jumps).
//   Its licence shows NOASSERTION, so nothing is copied. These checks are our own, from the CMO-7526 round 3 brief: blank frames, dead stretches, teleports, plus a contact sheet.
// Frame gate for a rendered mp4. Decode at a fixed interval with ffmpeg, small and grey, then score. The scoring functions are pure (arrays in, findings out) and unit-tested;
// only decodeFrames and contactSheet touch ffmpeg. Do not loosen a threshold to make a file pass: fix the video, or change a threshold with a reason that is not "it failed".
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

/** Frames sampled per second of video. 30 sees a one-frame glitch in a 60fps master half the time and every glitch in a 30fps cut, at trivial cost. */
export const SAMPLE_FPS = 30;
/** Sampled frames are scaled to this many pixels square, greyscale: enough to see a pointer or a caret move, cheap to diff. */
export const FRAME_PX = 160;
/** A frame whose pixel standard deviation (0 to 255 grey levels) is below this is blank or near-uniform: nothing is drawn on it. */
export const BLANK_STD = 3;
/** A run of blank frames this long or shorter (seconds) is a pause, not a defect: a clean beat before the first element lands. */
export const BLANK_MAX_RUN_S = 0.3;
/** Mean absolute grey change between consecutive samples (0 to 255 scale) below this means nothing visibly moved. Above encode noise, below a pointer crossing 3 px. */
export const DEAD_DIFF = 0.02;
/** Default longest hold (seconds) where nothing changes. Holds shorter than this are fine; override with --max-hold. */
export const DEAD_MAX_HOLD_S = 2;
/** A step is a teleport candidate if its change is this many times the clip's own median change on moving steps... */
export const TELEPORT_RATIO = 8;
/** ...and this many times larger than BOTH neighbouring steps (smooth motion ramps; a jump is isolated)... */
export const TELEPORT_ISOLATION = 2.5;
/** ...and above this absolute floor (grey levels), so a clip whose median motion is tiny does not flag noise. */
export const TELEPORT_FLOOR = 3;
/** Fewer than this share of steps moving means the clip is essentially still, so its "median motion" is taken as zero and any isolated spike over the floor is a jump. */
export const TELEPORT_MIN_MOVING_SHARE = 0.1;
/** Contact sheet grid. */
export const SHEET_COLS = 4;
export const SHEET_ROWS = 3;
const SHEET_THUMB_PX = 360;

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Per-frame standard deviation and consecutive-frame mean absolute difference from a buffer of n grey frames of px*px bytes.
 * stds[i] is frame i; diffs[i] is between frame i and i+1, so diffs happen at time (i + 1) / fps.
 */
export function analyse(buf, px = FRAME_PX) {
  const size = px * px;
  const n = Math.floor(buf.length / size);
  const stds = [];
  const diffs = [];
  for (let f = 0; f < n; f++) {
    const o = f * size;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < size; i++) { const v = buf[o + i]; sum += v; sq += v * v; }
    const mean = sum / size;
    stds.push(Math.sqrt(Math.max(0, sq / size - mean * mean)));
    if (f + 1 < n) {
      let d = 0;
      const p = o + size;
      for (let i = 0; i < size; i++) d += Math.abs(buf[p + i] - buf[o + i]);
      diffs.push(d / size);
    }
  }
  return { stds, diffs };
}

/** Runs of consecutive indices where pred(value) holds, as [first, last] inclusive. */
const runs = (xs, pred) => {
  const out = [];
  let start = -1;
  xs.forEach((v, i) => {
    if (pred(v)) { if (start < 0) start = i; } else if (start >= 0) { out.push([start, i - 1]); start = -1; }
  });
  if (start >= 0) out.push([start, xs.length - 1]);
  return out;
};

/** Blank runs longer than the grace, as { from, to, seconds }. Frame i covers [i/fps, (i+1)/fps). */
export function blankRuns(stds, fps = SAMPLE_FPS, { blankStd = BLANK_STD, maxRun = BLANK_MAX_RUN_S } = {}) {
  return runs(stds, (s) => s < blankStd)
    .map(([a, b]) => ({ from: a / fps, to: (b + 1) / fps, seconds: (b - a + 1) / fps }))
    .filter((r) => r.seconds > maxRun + 1e-9);
}

/** Stretches where nothing changes for longer than maxHold seconds. A run of k still steps spans k / fps seconds. */
export function deadRuns(diffs, fps = SAMPLE_FPS, { deadDiff = DEAD_DIFF, maxHold = DEAD_MAX_HOLD_S } = {}) {
  return runs(diffs, (d) => d < deadDiff)
    .map(([a, b]) => ({ from: a / fps, to: (b + 1) / fps, seconds: (b - a + 1) / fps }))
    .filter((r) => r.seconds > maxHold + 1e-9);
}

/** Single-step spikes far above the clip's own median motion, isolated from their neighbours. Returns { at, diff, ratio } with `at` in seconds. */
export function teleports(diffs, fps = SAMPLE_FPS, { ratio = TELEPORT_RATIO, isolation = TELEPORT_ISOLATION, floor = TELEPORT_FLOOR, deadDiff = DEAD_DIFF } = {}) {
  const moving = diffs.filter((d) => d >= deadDiff);
  const typical = moving.length >= TELEPORT_MIN_MOVING_SHARE * diffs.length ? median(moving) : 0;
  const limit = Math.max(floor, ratio * typical);
  const out = [];
  diffs.forEach((d, i) => {
    if (d < limit) return;
    const around = Math.max(diffs[i - 1] ?? 0, diffs[i + 1] ?? 0);
    if (d < isolation * around) return;
    out.push({ at: (i + 1) / fps, diff: d, ratio: typical > 0 ? d / typical : Infinity });
  });
  return out;
}

const span = (r) => `${r.from.toFixed(2)}s to ${r.to.toFixed(2)}s (${r.seconds.toFixed(2)}s)`;

/** Score decoded frames. `checks` is one entry per rule: { id, label, pass, detail }. */
export function evaluate({ stds, diffs }, { fps = SAMPLE_FPS, maxHold = DEAD_MAX_HOLD_S } = {}) {
  const blank = blankRuns(stds, fps);
  const dead = deadRuns(diffs, fps, { maxHold });
  const tele = teleports(diffs, fps);
  const checks = [
    { id: "blank", label: `no blank or near-uniform frames (std < ${BLANK_STD}, runs over ${BLANK_MAX_RUN_S}s)`, pass: blank.length === 0, detail: blank.map(span).join("; ") },
    { id: "dead", label: `no dead stretch over ${maxHold}s where nothing changes`, pass: dead.length === 0, detail: dead.map(span).join("; ") },
    { id: "teleport", label: `no teleport (one-step change over ${TELEPORT_RATIO}x the clip's median motion)`, pass: tele.length === 0, detail: tele.map((x) => `${x.at.toFixed(2)}s (diff ${x.diff.toFixed(1)}, ${Number.isFinite(x.ratio) ? x.ratio.toFixed(0) + "x median" : "clip otherwise still"})`).join("; ") },
  ];
  return { pass: checks.every((c) => c.pass), checks, blank, dead, teleports: tele, medianMotion: median(diffs.filter((d) => d >= DEAD_DIFF)) };
}

const ff = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { maxBuffer: 1 << 30, ...opts });
  if (r.error) throw new Error(`${cmd} could not run: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} failed (exit ${r.status}): ${String(r.stderr ?? "").trim().split("\n").slice(-3).join(" | ")}`);
  return r;
};

export const durationOf = (file) => Number(ff("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout.toString().trim());

/** Decode the file at SAMPLE_FPS to FRAME_PX square greyscale and analyse it. */
export function decodeFrames(file) {
  const r = ff("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${SAMPLE_FPS},scale=${FRAME_PX}:${FRAME_PX}:flags=area,format=gray`, "-f", "rawvideo", "-"]);
  const a = analyse(r.stdout);
  if (a.stds.length < 3) throw new Error(`${file}: decoded only ${a.stds.length} frames, is it a video?`);
  return a;
}

/** One PNG of SHEET_COLS x SHEET_ROWS evenly spaced stills, each centred in its slice of the clip. Returns the path. */
export function contactSheet(file, dir) {
  mkdirSync(dir, { recursive: true });
  const cells = SHEET_COLS * SHEET_ROWS;
  const dur = durationOf(file);
  const out = join(dir, `${basename(file, extname(file))}-sheet.png`);
  ff("ffmpeg", ["-y", "-v", "error", "-ss", String(dur / (2 * cells)), "-i", file, "-vf", `fps=${cells}/${dur},scale=${SHEET_THUMB_PX}:-1,tile=${SHEET_COLS}x${SHEET_ROWS}`, "-frames:v", "1", out]);
  return out;
}

/** Run the whole gate on an mp4: decode, score, write the contact sheet. */
export function checkFrames(file, { sheetDir, maxHold = DEAD_MAX_HOLD_S } = {}) {
  const frames = decodeFrames(file);
  const result = evaluate(frames, { maxHold });
  const sheet = sheetDir ? contactSheet(file, sheetDir) : null;
  return { ...result, sheet, samples: frames.stds.length, file };
}

/** Printable report: PASS or FAIL per rule, details under a FAIL, sheet path. */
export function formatFrameReport(r) {
  const lines = r.checks.map((c) => `  ${c.pass ? "PASS" : "FAIL"}  ${c.label}${c.pass ? "" : `\n        ${c.detail}`}`);
  const head = `frame check (${r.file}): ${r.samples} samples at ${SAMPLE_FPS}/s, median motion ${r.medianMotion.toFixed(2)}`;
  return [head, ...lines, r.sheet ? `  contact sheet: ${r.sheet}` : null, `  frame check ${r.pass ? "PASS" : "FAIL"}`].filter(Boolean).join("\n");
}
