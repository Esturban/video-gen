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
// ---- safe area (CMO-7575) ----
// The 160 px square sample above squashes the real aspect, so the margin rule decodes a second, true-aspect sample and maps the margin per axis.
/** The safe margin: nothing but background within this many px of any canvas edge, on a SAFE_REFERENCE_PX canvas. Same rule as the brand slot's 64 px inset. */
export const SAFE_MARGIN_PX = 64;
/** The canvas size SAFE_MARGIN_PX is defined on; on other canvases it scales with min(width, height) / this (1920x1080 gets 48 px), as the brand slot does. */
export const SAFE_REFERENCE_PX = 1440;
/** The true-aspect sample's long side in pixels. 360 on a 1440 canvas makes the 64 px margin exactly 16 sample pixels. */
export const SAFE_PX = 360;
/** Safe-area samples per second. An element parked in the margin for 0.1s or more is caught; cheaper than the 30/s motion sample at 5x the pixels. */
export const SAFE_SAMPLE_FPS = 10;
/**
 * "Background", stated: each margin strip is cut into square cells as long as the band is thick, and a cell's background is its most common grey level.
 * A pixel is ink when it differs from that level by more than this many grey levels (0 to 255): a quarter of the range. Below it a mark is page decor, under about 2:1
 * contrast and well short of the 3:1 WCAG floor for meaningful graphics (the parallax layer's dots measure 56 levels off the cream page); at or above it the mark
 * reads as content (brand ink at 0.55 opacity measures 113). x264 noise is 2 or 3 levels, and a cell is small enough (64 px on a 1440 canvas) that a brand
 * gradient changes by only a few levels across it.
 */
export const SAFE_BG_TOLERANCE = 64;
/** A cell intrudes when it holds at least this many ink sample pixels (4 = an 8x8 px mark on a 1440 canvas). Fewer is a speck, not an element. */
export const SAFE_MIN_INK_PX = 4;
const SAFE_SIDES = ["top", "bottom", "left", "right"];

/** Size of the true-aspect safe-area sample: long side SAFE_PX, short side scaled to match. */
export function safeSampleSize(width, height, px = SAFE_PX) {
  return width >= height ? { w: px, h: Math.round((px * height) / width) } : { w: Math.round((px * width) / height), h: px };
}

/**
 * Margin band in sample pixels, per axis. A sample pixel i (area-scaled) covers source [i / s, (i + 1) / s), so only floor(margin * s) pixels lie wholly inside the band;
 * an element sitting right on the safe line cannot bleed into the count.
 */
export function safeBand(width, height, sw, sh, { margin = SAFE_MARGIN_PX, reference = SAFE_REFERENCE_PX } = {}) {
  const marginPx = (margin * Math.min(width, height)) / reference;
  return { x: Math.floor((marginPx * sw) / width), y: Math.floor((marginPx * sh) / height), marginPx };
}

/** Square-ish cells covering the four margin strips, as { side, x0, y0, x1, y1 } (end exclusive). Top and bottom run full width; left and right fill between them. */
function marginCells(w, h, band) {
  const strips = {
    top: [0, 0, w, band.y], bottom: [0, h - band.y, w, h],
    left: [0, band.y, band.x, h - band.y], right: [w - band.x, band.y, w, h - band.y],
  };
  const cells = [];
  for (const side of SAFE_SIDES) {
    const [x0, y0, x1, y1] = strips[side];
    if (x1 <= x0 || y1 <= y0) continue;
    const horizontal = side === "top" || side === "bottom";
    const len = horizontal ? x1 - x0 : y1 - y0;
    const step = Math.max(1, horizontal ? y1 - y0 : x1 - x0);
    for (let a = 0; a < len; a += step) {
      const b = Math.min(len, a + step);
      cells.push(horizontal ? { side, x0: x0 + a, y0, x1: x0 + b, y1 } : { side, x0, y0: y0 + a, x1, y1: y0 + b });
    }
  }
  return cells;
}

/** Ink sample pixels in one cell: pixels further than `tolerance` from the cell's most common grey level. */
function cellInk(buf, w, c, tolerance) {
  const hist = new Uint32Array(256);
  for (let y = c.y0; y < c.y1; y++) for (let x = c.x0; x < c.x1; x++) hist[buf[y * w + x]]++;
  let mode = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[mode]) mode = v;
  let ink = 0;
  for (let v = 0; v < 256; v++) if (Math.abs(v - mode) > tolerance) ink += hist[v];
  return ink;
}

/** Cells of one w x h grey frame whose margin holds an element, as { side, x, y, w, h, ink } in sample pixels. Empty means the margin is all background. */
export function marginInk(buf, w, h, band, { tolerance = SAFE_BG_TOLERANCE, minInk = SAFE_MIN_INK_PX } = {}) {
  return marginCells(w, h, band)
    .map((c) => ({ side: c.side, x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0, ink: cellInk(buf, w, c, tolerance) }))
    .filter((c) => c.ink >= minInk);
}

/** Runs of consecutive safe-area samples with an intrusion, as { from, to, seconds, sides } with the sides sorted and unique. */
export function safeRuns(perFrame, fps = SAFE_SAMPLE_FPS) {
  return runs(perFrame, (cells) => cells.length > 0).map(([a, b]) => ({
    from: a / fps, to: (b + 1) / fps, seconds: (b - a + 1) / fps,
    sides: [...new Set(perFrame.slice(a, b + 1).flat().map((c) => c.side))].sort(),
  }));
}

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

/** The safe-area check entry, from { fps, perFrame, band } (perFrame[i] is marginInk of sample i). */
function safeCheck(safe) {
  const found = safeRuns(safe.perFrame, safe.fps);
  return {
    check: {
      id: "safe",
      label: `nothing but background in the ${SAFE_MARGIN_PX}px margin (${safe.band.marginPx.toFixed(0)}px on this canvas)`,
      pass: found.length === 0,
      detail: found.map((r) => `${span(r)} ${r.sides.join(", ")}`).join("; "),
    },
    found,
  };
}

/** Score decoded frames. `checks` is one entry per rule: { id, label, pass, detail }. The safe-area rule runs when `safe` samples are given. */
export function evaluate({ stds, diffs, safe }, { fps = SAMPLE_FPS, maxHold = DEAD_MAX_HOLD_S } = {}) {
  const blank = blankRuns(stds, fps);
  const dead = deadRuns(diffs, fps, { maxHold });
  const tele = teleports(diffs, fps);
  const margin = safe ? safeCheck(safe) : null;
  const checks = [
    { id: "blank", label: `no blank or near-uniform frames (std < ${BLANK_STD}, runs over ${BLANK_MAX_RUN_S}s)`, pass: blank.length === 0, detail: blank.map(span).join("; ") },
    { id: "dead", label: `no dead stretch over ${maxHold}s where nothing changes`, pass: dead.length === 0, detail: dead.map(span).join("; ") },
    { id: "teleport", label: `no teleport (one-step change over ${TELEPORT_RATIO}x the clip's median motion)`, pass: tele.length === 0, detail: tele.map((x) => `${x.at.toFixed(2)}s (diff ${x.diff.toFixed(1)}, ${Number.isFinite(x.ratio) ? x.ratio.toFixed(0) + "x median" : "clip otherwise still"})`).join("; ") },
    ...(margin ? [margin.check] : []),
  ];
  return { pass: checks.every((c) => c.pass), checks, blank, dead, teleports: tele, safe: margin?.found ?? [], medianMotion: median(diffs.filter((d) => d >= DEAD_DIFF)) };
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

const sizeOf = (file) => {
  const [w, h] = ff("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).stdout.toString().trim().split(",").map(Number);
  if (!(w > 0 && h > 0)) throw new Error(`${file}: could not read the video size`);
  return { width: w, height: h };
};

/** Decode at SAFE_SAMPLE_FPS to a true-aspect greyscale sample and score each frame's margin band. Returns { fps, perFrame, band, size }. */
export function decodeSafe(file) {
  const { width, height } = sizeOf(file);
  const { w, h } = safeSampleSize(width, height);
  const band = safeBand(width, height, w, h);
  const buf = ff("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${SAFE_SAMPLE_FPS},scale=${w}:${h}:flags=area,format=gray`, "-f", "rawvideo", "-"]).stdout;
  const size = w * h;
  const perFrame = [];
  for (let o = 0; o + size <= buf.length; o += size) perFrame.push(marginInk(buf.subarray(o, o + size), w, h, band));
  return { fps: SAFE_SAMPLE_FPS, perFrame, band, size: { width, height, w, h } };
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
  const frames = { ...decodeFrames(file), safe: decodeSafe(file) };
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
