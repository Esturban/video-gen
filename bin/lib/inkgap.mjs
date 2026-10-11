// Ink gap (CMO-7577): how close any ink comes to each canvas edge, measured PIXEL EXACT on a full-resolution greyscale decode.
// Why it exists: the frame gate's safe-area rule (checkframes.mjs) reads an area-averaged 360 px sample, so a 1 px hairline (the script signature) averages
// below its ink threshold and passes while it sits 18 px from the edge (REVIEW-9x16.md, missed defect 1). This is a measurement, not a change to that gate:
// no frame-gate threshold is touched. Pure scoring functions are unit-tested; only decodeInkGaps touches ffmpeg.
import { spawnSync } from "node:child_process";
import { SAFE_BG_TOLERANCE, SAFE_MARGIN_PX, SAFE_REFERENCE_PX } from "./checkframes.mjs";

/** Samples per second for the full-resolution decode. Full frames are large, so this is sparse; an element parked in the margin for half a second is caught. */
export const INK_SAMPLE_FPS = 2;
const SIDES = ["left", "right", "top", "bottom"];
const MAX_DECODE_BYTES = 2 ** 31; // 27 s at 2/s of 1440x1440 grey is about 110 MB; room for longer pieces

/** Most common grey level on the frame's 1 px border ring: the background next to the edges, where the margin rule looks. */
function borderMode(buf, w, h) {
  const hist = new Uint32Array(256);
  for (let x = 0; x < w; x++) { hist[buf[x]]++; hist[buf[(h - 1) * w + x]]++; }
  for (let y = 1; y < h - 1; y++) { hist[buf[y * w]]++; hist[buf[y * w + w - 1]]++; }
  let best = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v;
  return best;
}

/**
 * Distance in px from each edge to the nearest ink pixel of one w x h grey frame, as { left, right, top, bottom } (null on a side with no ink at all).
 * A pixel is ink when it differs from the border background by more than `tolerance` grey levels: the same tolerance the frame gate uses, applied per pixel.
 */
export function inkGaps(buf, w, h, { tolerance = SAFE_BG_TOLERANCE } = {}) {
  const bg = borderMode(buf, w, h);
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (Math.abs(buf[row + x] - bg) <= tolerance) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { left: null, right: null, top: null, bottom: null };
  return { left: x0, right: w - 1 - x1, top: y0, bottom: h - 1 - y1 };
}

/** Every sample and side where ink is closer to the edge than `margin` px, as { t, side, gap }. perFrame is [{ t, gaps }]. */
export const inkGapFailures = (perFrame, margin) => perFrame.flatMap(({ t, gaps }) => SIDES.filter((s) => gaps[s] !== null && gaps[s] < margin).map((side) => ({ t, side, gap: gaps[side] })));

/** The safe margin on a width x height canvas, scaled like the brand slot and the frame gate: 64 px on 1440, 48 px on 1080x1920. */
export const marginFor = (width, height) => (SAFE_MARGIN_PX * Math.min(width, height)) / SAFE_REFERENCE_PX;

/** Decode an mp4 at full resolution, greyscale, INK_SAMPLE_FPS, and measure each sample. Returns { width, height, margin, perFrame, failures, closest }. */
export function decodeInkGaps(file, { fps = INK_SAMPLE_FPS } = {}) {
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]);
  if (probe.status !== 0) throw new Error(`ffprobe failed on ${file}: ${String(probe.stderr).trim()}`);
  const [width, height] = probe.stdout.toString().trim().split(",").map(Number);
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `fps=${fps},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: MAX_DECODE_BYTES });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${String(r.stderr).trim().split("\n").slice(-2).join(" | ")}`);
  const size = width * height;
  const perFrame = [];
  for (let o = 0, i = 0; o + size <= r.stdout.length; o += size, i++) perFrame.push({ t: (i + 0.5) / fps, gaps: inkGaps(r.stdout.subarray(o, o + size), width, height) });
  const margin = marginFor(width, height);
  const closest = Object.fromEntries(SIDES.map((s) => {
    const hits = perFrame.filter((p) => p.gaps[s] !== null);
    if (!hits.length) return [s, null];
    const m = hits.reduce((a, p) => (p.gaps[s] < a.gaps[s] ? p : a));
    return [s, { gap: m.gaps[s], t: m.t }];
  }));
  return { width, height, margin, perFrame, failures: inkGapFailures(perFrame, margin), closest };
}
