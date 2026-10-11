import assert from "node:assert/strict";
import test from "node:test";
import { inkGaps, inkGapFailures } from "./inkgap.mjs";
import { marginInk, safeBand, safeSampleSize } from "./checkframes.mjs";

const BG = 245;
const INK = 60;

/** A w x h grey frame of background with ink pixels set at [x, y]. */
function frame(w, h, ink = []) {
  const buf = new Uint8Array(w * h).fill(BG);
  for (const [x, y] of ink) buf[y * w + x] = INK;
  return buf;
}

/** Area-average a full-res grey frame down to sw x sh, the way the frame gate's ffmpeg scale=...:flags=area sample does. */
function areaSample(buf, w, h, sw, sh) {
  const out = new Uint8Array(sw * sh);
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const [x0, x1, y0, y1] = [Math.floor((i * w) / sw), Math.floor(((i + 1) * w) / sw), Math.floor((j * h) / sh), Math.floor(((j + 1) * h) / sh)];
    let sum = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += buf[y * w + x];
    out[j * sw + i] = Math.round(sum / ((x1 - x0) * (y1 - y0)));
  }
  return out;
}

// The defect the Reality Checker found: a 1 px hairline of signature ink 18 px from the right edge of a 1080x1920 frame (rightmost ink at x = 1061).
const W = 1080;
const H = 1920;
const HAIRLINE = Array.from({ length: 6 }, (_, k) => [1061, 1800 + k]);

test("a hairline the area-averaged gate sample cannot see is still measured, pixel exact", () => {
  const buf = frame(W, H, HAIRLINE);
  const { w, h } = safeSampleSize(W, H);
  assert.deepEqual(marginInk(areaSample(buf, W, H, w, h), w, h, safeBand(W, H, w, h)), [], "precondition: the gate's sample is blind to it");
  assert.equal(inkGaps(buf, W, H).right, 18);
});

test("gaps on all four sides are the distance from each edge to the nearest ink pixel", () => {
  const buf = frame(200, 100, [[10, 50], [150, 3], [120, 90]]);
  assert.deepEqual(inkGaps(buf, 200, 100), { left: 10, right: 49, top: 3, bottom: 9 });
});

test("a frame of pure background has no ink: every gap is null", () => {
  assert.deepEqual(inkGaps(frame(50, 40), 50, 40), { left: null, right: null, top: null, bottom: null });
});

test("background is read from the frame border, so a light gradient or encode noise is not ink", () => {
  const buf = frame(100, 100);
  for (let i = 0; i < buf.length; i++) buf[i] = BG - (i % 7) - Math.floor(i / 100 / 10); // up to 15 levels of drift
  assert.deepEqual(inkGaps(buf, 100, 100), { left: null, right: null, top: null, bottom: null });
});

test("failures name every side whose ink is closer than the margin, with the time", () => {
  const perFrame = [{ t: 0, gaps: { left: 100, right: 80, top: 90, bottom: 70 } }, { t: 2.5, gaps: { left: 100, right: 18, top: null, bottom: 70 } }];
  assert.deepEqual(inkGapFailures(perFrame, 48), [{ t: 2.5, side: "right", gap: 18 }]);
  assert.deepEqual(inkGapFailures(perFrame, 10), []);
});
