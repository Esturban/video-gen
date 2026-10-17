import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { aacArgs, beatFilter, CLEAN, COMPRESS, FLOAT, gainStage, LIMIT, LOUDNESS, mixNarration, narrationGraph, parseLoudnorm, RESAMPLE } from "./voicefx.mjs";

test("beatFilter resamples with the long filter, cleans, then delays", () => {
  const f = beatFilter(2, 1400.4);
  assert.ok(f.startsWith(`[2:a]${FLOAT},${RESAMPLE},${FLOAT},${CLEAN},`));
  assert.match(f, /adelay=1400:all=1\[a2\]$/);
  assert.match(RESAMPLE, /aresample=48000:filter_size=256/);
});

test("the clean chain leaves out the filters that measured worse", () => {
  assert.doesNotMatch(CLEAN, /deesser|aexciter/);
});

test("narrationGraph mixes every beat without normalising and cuts to the scene length", () => {
  const g = narrationGraph([400, 5000], 12.5);
  assert.ok(g.endsWith(`[a0][a1]amix=inputs=2:normalize=0,${COMPRESS},apad,atrim=0:12.5[mix]`));
  assert.throws(() => narrationGraph([], 3), /no narrated beats/);
});

test("parseLoudnorm reads the measuring pass and refuses junk", () => {
  const stderr = `[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-27.01",\n\t"input_tp" : "-4.90",\n\t"input_lra" : "4.10",\n\t"input_thresh" : "-37.30",\n\t"output_i" : "-14.0",\n\t"target_offset" : "0.02"\n}\n`;
  assert.deepEqual(parseLoudnorm(stderr), { I: -27.01, TP: -4.9, LRA: 4.1, thresh: -37.3, offset: 0.02 });
  assert.throws(() => parseLoudnorm("nothing here"), /no measurement/);
  assert.throws(() => parseLoudnorm(stderr.replace('"-27.01"', '"-inf"')), /not numeric/);
});

test("gainStage is one linear gain to -14 LUFS, then the lookahead limiter", () => {
  const f = gainStage({ I: -27.82, TP: -5, LRA: 4, thresh: -37, offset: 0 });
  assert.equal(f, `${FLOAT},volume=13.82dB,${LIMIT}`);
  assert.match(LIMIT, /alimiter=limit=0\.794:/);
});

test("aacArgs is 192k at 48 kHz", () => {
  assert.deepEqual(aacArgs(), ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]);
});

const ffmpegOk = spawnSync("ffmpeg", ["-version"]).status === 0;

/** Integrated loudness (LUFS) and true peak (dBTP) of a file. */
function loudness(f) {
  const e = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return { I: Number(e.match(/I:\s+(-?[\d.]+) LUFS/)[1]), TP: Number(e.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]) };
}
/** Mono 48 kHz samples of a file. */
const pcm = (f) => { const b = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 }); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
/** Hann-windowed Goertzel power of one frequency. */
function power(x, hz, sr = 48000) {
  const k = 2 * Math.cos((2 * Math.PI * hz) / sr);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < x.length; i++) { const s = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (x.length - 1))) + k * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}

test("mixNarration: 24 kHz beats in, 48 kHz at -14 LUFS out, no resampler image above 12 kHz", { skip: !ffmpegOk && "ffmpeg not installed" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "voicefx-"));
  // Two quiet 24 kHz beats (Kokoro sits near -27 LUFS): a 150 Hz buzz, and an 11 kHz tone whose resampler image would land
  // at exactly 13 kHz (24 - 11). The old default aresample left that image 21 dB under the tone; the long filter, about -90.
  const buzz = join(dir, "buzz.wav"), tone = join(dir, "tone.wav");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=150:sample_rate=24000:d=2", "-af", "asoftclip=type=hard:threshold=0.2,volume=0.08", "-ac", "1", buzz]);
  // Faded in and out: a hard start or stop is a click, and a click has energy at 13 kHz too.
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=11000:sample_rate=24000:d=2", "-af", "volume=0.05,afade=t=in:d=0.2,afade=t=out:st=1.8:d=0.2", "-ac", "1", tone]);
  const out = join(dir, "voice.wav");
  const m = mixNarration([buzz, tone], [400, 2600], 5, out);
  assert.ok(existsSync(out) && !existsSync(`${out}.pre.wav`));
  assert.ok(m.I < -20, `input measured quiet (${m.I})`);
  const rate = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", out]).toString().trim();
  assert.equal(rate, "48000");
  const l = loudness(out);
  assert.ok(Math.abs(l.I - LOUDNESS.I) < 1, `loudness ${l.I} LUFS`);
  assert.ok(l.TP <= -1, `true peak ${l.TP} dBTP`);
  const x = pcm(out);
  const image = 10 * Math.log10(power(x, 13000) / power(x, 11000));
  assert.ok(image < -70, `13 kHz image is ${image.toFixed(1)} dB under the 11 kHz tone (needs < -70)`);
});
