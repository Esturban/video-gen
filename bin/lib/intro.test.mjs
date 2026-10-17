import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { introConcatArgs, introFileFor, introMp4, parseRate, probeMedia, prependIntro, withIntroPath } from "./intro.mjs";

test("withIntroPath puts -with-intro beside the master", () => {
  assert.equal(withIntroPath("/o/a/vid.mp4"), "/o/a/vid-with-intro.mp4");
});

test("parseRate reads fractions", () => {
  assert.equal(parseRate("60/1"), 60);
  assert.ok(Math.abs(parseRate("30000/1001") - 29.97) < 0.01);
  assert.equal(parseRate("25"), 25);
});

test("introMp4 finds intro.mp4, or <leaf>.mp4, and fails clearly when absent", () => {
  const out = mkdtempSync(join(tmpdir(), "intro-"));
  assert.throws(() => introMp4("brand/intro", out), /has no rendered mp4.*intro\.mp4.*render it first/s);
  mkdirSync(join(out, "brand", "intro"), { recursive: true });
  writeFileSync(join(out, "brand", "intro", "intro.mp4"), "x");
  assert.equal(introMp4("brand/intro", out), join(out, "brand", "intro", "intro.mp4"));
  mkdirSync(join(out, "brand", "open"), { recursive: true });
  writeFileSync(join(out, "brand", "open", "open.mp4"), "x");
  assert.equal(introMp4("brand/open", out), join(out, "brand", "open", "open.mp4"));
});

const MASTER = { width: 1920, height: 1080, fps: "60/1", codec: "h264", hasAudio: true, duration: 50 };
const INTRO_SILENT = { width: 1280, height: 720, fps: "30/1", codec: "h264", hasAudio: false, duration: 6 };

test("silent intro gets generated silence when the master has audio", () => {
  const args = introConcatArgs({ intro: "i.mp4", master: "m.mp4", out: "o.mp4", info: { master: MASTER, intro: INTRO_SILENT } });
  const s = args.join(" ");
  assert.match(s, /anullsrc/);
  assert.match(s, /scale=1920:1080/);
  assert.match(s, /fps=60\/1/);
  assert.match(s, /concat=n=2:v=1:a=1/);
  assert.ok(args.includes("libx264"));
  assert.equal(args.at(-1), "o.mp4");
});

test("an intro with its own audio uses it", () => {
  const args = introConcatArgs({ intro: "i", master: "m", out: "o", info: { master: MASTER, intro: { ...INTRO_SILENT, hasAudio: true } } });
  assert.doesNotMatch(args.join(" "), /anullsrc/);
  assert.match(args.join(" "), /\[0:a\]/);
});

test("a master without audio gives a video-only result", () => {
  const args = introConcatArgs({ intro: "i", master: "m", out: "o", info: { master: { ...MASTER, hasAudio: false }, intro: INTRO_SILENT } });
  const s = args.join(" ");
  assert.match(s, /concat=n=2:v=1:a=0/);
  assert.ok(args.includes("-an"));
  assert.doesNotMatch(s, /anullsrc/);
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

test("prependIntro joins a real intro and master, matching the master, leaving the master untouched", { skip: !hasFfmpeg }, () => {
  const d = mkdtempSync(join(tmpdir(), "intro-real-"));
  const ff = (...a) => execFileSync("ffmpeg", ["-y", "-v", "error", ...a], { stdio: "ignore" });
  ff("-f", "lavfi", "-i", "color=c=blue:s=320x180:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(d, "intro.mp4"));
  ff("-f", "lavfi", "-i", "color=c=red:s=640x360:r=24:d=2", "-f", "lavfi", "-i", "sine=f=440:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(d, "master.mp4"));
  const before = probeMedia(join(d, "master.mp4"));
  const out = prependIntro(join(d, "master.mp4"), join(d, "intro.mp4"));
  assert.equal(out, join(d, "master-with-intro.mp4"));
  const after = probeMedia(out);
  assert.equal(after.width, 640);
  assert.equal(after.height, 360);
  assert.equal(parseRate(after.fps), 24);
  assert.equal(after.codec, "h264");
  assert.equal(after.hasAudio, true);
  assert.ok(Math.abs(after.duration - 3) < 0.3, `duration ${after.duration}`);
  assert.deepEqual(probeMedia(join(d, "master.mp4")), before);
});

test("introMp4 with a variant name reads <leaf>-<variant>.mp4 and says which one is missing", () => {
  const out = mkdtempSync(join(tmpdir(), "intro-var-"));
  mkdirSync(join(out, "brand", "intro"), { recursive: true });
  writeFileSync(join(out, "brand", "intro", "intro.mp4"), "x");
  assert.throws(() => introMp4("brand/intro", out, "9x16"), /intro-9x16\.mp4/);
  writeFileSync(join(out, "brand", "intro", "intro-9x16.mp4"), "x");
  assert.equal(introMp4("brand/intro", out, "9x16"), join(out, "brand", "intro", "intro-9x16.mp4"));
});

test("introFileFor picks the intro that matches each output's aspect (CMO-8185)", () => {
  const out = mkdtempSync(join(tmpdir(), "intro-pick-"));
  mkdirSync(join(out, "brand", "intro"), { recursive: true });
  for (const f of ["intro.mp4", "intro-9x16.mp4"]) writeFileSync(join(out, "brand", "intro", f), "x");
  const wide = join(out, "brand", "intro", "intro.mp4");
  const tall = join(out, "brand", "intro", "intro-9x16.mp4");
  assert.equal(introFileFor("brand/intro", out, { label: "master", size: [1920, 1080] }), wide);
  assert.equal(introFileFor("brand/intro", out, { label: "linkedin", size: [1920, 1080] }), wide);
  assert.equal(introFileFor("brand/intro", out, { label: "9x16", size: [1080, 1920] }), tall);
  assert.equal(introFileFor("brand/intro", out, { label: "1x1", size: [1080, 1080] }), wide);
});

test("a portrait output with no native intro fails instead of letterboxing the 16:9 one", () => {
  const out = mkdtempSync(join(tmpdir(), "intro-nopt-"));
  mkdirSync(join(out, "brand", "intro"), { recursive: true });
  writeFileSync(join(out, "brand", "intro", "intro.mp4"), "x");
  assert.throws(() => introFileFor("brand/intro", out, { label: "9x16", size: [1080, 1920] }), /intro-9x16\.mp4/);
});

test("a native vertical intro is concatenated at the master size", () => {
  const master = { width: 1080, height: 1920, fps: "60/1", codec: "h264", hasAudio: true, duration: 50 };
  const intro = { width: 1080, height: 1920, fps: "60/1", codec: "h264", hasAudio: false, duration: 6.5 };
  const s = introConcatArgs({ intro: "i", master: "m", out: "o", info: { master, intro } }).join(" ");
  assert.match(s, /scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920/);
  assert.match(s, /concat=n=2:v=1:a=1/);
});

test("LinkedIn and 9x16 outputs are named <stem>-with-intro, 30 fps kept for LinkedIn", () => {
  assert.equal(withIntroPath("/o/a/vid-linkedin.mp4"), "/o/a/vid-linkedin-with-intro.mp4");
  assert.equal(withIntroPath("/o/a/vid-9x16.mp4"), "/o/a/vid-9x16-with-intro.mp4");
  const s = introConcatArgs({ intro: "i", master: "m", out: "o", info: { master: { ...MASTER, fps: "30/1" }, intro: INTRO_SILENT } }).join(" ");
  assert.match(s, /fps=30\/1/);
  assert.match(s, /-r 30\/1/);
});
