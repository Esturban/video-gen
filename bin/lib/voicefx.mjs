// Voice post-process for the narration track (CMO-8242). EV, 2026-10-17: the voice "sounds amazing" but has a "tinny
// background effect". Measured on a Kokoro beat (24 kHz mono): the noise is already in the raw TTS wav; mix and AAC add
// nothing measurable. What the raw wav carries: a noise-like vocoder layer that sits 2.5 to 7.5 kHz about 10 dB hotter
// than a natural voice's roll-off, a residual floor in the pauses that follows the speech spectrum, and a level of
// -27 LUFS that makes listeners turn it up. The default aresample (32-tap) also mirrored 10 to 12 kHz into 12 to 14 kHz
// at -48 dB (inharmonic fizz). This file is the single place every later video gets the fix: per beat clean-up in
// cleanBeat(), loudness in two passes in mixNarration(), and one AAC setting for every encode in aacArgs().
// The raw beat wavs are never changed: voice/narrate.py reads them at 24 kHz for word onsets and captions.
// REUSE_CHECKED: none   no audio post-process in video-gen or content-thinking/video; ffmpeg filter options per `ffmpeg -h filter=<name>` (ffmpeg 9.0.2)
import { execFileSync, spawnSync } from "node:child_process";
import { renameSync, unlinkSync } from "node:fs";

export const SAMPLE_RATE = 48000;
export const LOUDNESS = { I: -14, TP: -1.5, LRA: 11 };
export const AAC_BITRATE = "192k";

/** Long Kaiser swr resampler. This ffmpeg build has no soxr; this filter pushes the 12 to 14 kHz images from -48 dB to under -85 dB. It adds no content above the source's 12 kHz Nyquist. */
export const RESAMPLE = `aresample=${SAMPLE_RATE}:filter_size=256:phase_shift=14:cutoff=0.96:filter_type=kaiser:kaiser_beta=12`;

/**
 * Per beat clean-up, in order: rumble off below 70 Hz; FFT denoise (gentle, tracks the floor) for the vocoder residual;
 * -1.5 dB at 3.2 kHz and -3 dB at 6.5 kHz to take the tinny band back toward a natural roll-off.
 * Not used: ffmpeg deesser (sprays broadband junk at 16 to 24 kHz, -83 to -48 dB), aexciter (lifts 10 to 12 kHz,
 * brighter, writes almost nothing above 12 kHz), anlmdn (crashes ffmpeg 9.0.2 with SIGTRAP/SIGSEGV in a delayed or
 * multi-input graph).
 */
export const CLEAN = [
  "highpass=f=70",
  "afftdn=nr=10:nf=-70:tn=1",
  "equalizer=f=3200:t=q:w=1.5:g=-1.5",
  "equalizer=f=6500:t=q:w=1.2:g=-3",
].join(",");

/** Float samples through the whole chain. Left to itself ffmpeg negotiates the biquads down to 16-bit, which put a
 * quantisation floor 62 dB under a quiet tone; float keeps it near -100 dB. Files between passes are 32-bit float too, so
 * the +13 dB loudness gain does not lift 16-bit noise from a -27 LUFS mix. */
export const FLOAT = "aformat=sample_fmts=fltp";
const PCM = ["-c:a", "pcm_f32le"];

/** One beat's filter: float, resample, clean, then place it on the timeline. Pure. */
export const beatFilter = (i, delayMs) => `[${i}:a]${FLOAT},${RESAMPLE},${FLOAT},${CLEAN},adelay=${Math.round(delayMs)}:all=1[a${i}]`;

/** The mix graph for n beats placed at delaysMs, padded and cut to totalS seconds. Pure. */
export function narrationGraph(delaysMs, totalS) {
  if (!delaysMs.length) throw new Error("narrationGraph: no narrated beats");
  const beats = delaysMs.map((d, i) => beatFilter(i, d));
  return `${beats.join(";")};${delaysMs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${delaysMs.length}:normalize=0,${COMPRESS},apad,atrim=0:${totalS}[mix]`;
}

/** The JSON block loudnorm prints in its measuring pass, as numbers. Throws when it is missing. */
export function parseLoudnorm(stderr) {
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
  if (!m) throw new Error("loudnorm printed no measurement (is the track silent?)");
  const d = JSON.parse(m[0]);
  const out = { I: Number(d.input_i), TP: Number(d.input_tp), LRA: Number(d.input_lra), thresh: Number(d.input_thresh), offset: Number(d.target_offset) };
  if (!Object.values(out).every(Number.isFinite)) throw new Error(`loudnorm measurement is not numeric: ${m[0]}`);
  return out;
}

const target = `I=${LOUDNESS.I}:TP=${LOUDNESS.TP}:LRA=${LOUDNESS.LRA}`;

/** Kokoro's peak-to-loudness ratio is about 23 dB (-4.4 dBTP at -27.8 LUFS); -14 LUFS under -1.5 dBTP leaves 12.5 dB. A
 * gentle 2.5:1 speech compressor on the mix brings it near 15.5 dB, so the limiter below only shaves about 3 dB off
 * plosive peaks. linear loudnorm alone stopped at -15.2 LUFS (it caps gain at the peak ceiling). */
export const COMPRESS = "acompressor=threshold=0.1:ratio=2.5:attack=5:release=100:knee=4";
/** Lookahead limiter at -2 dBFS sample peak, which held true peak at or under -1 dBTP after AAC in the measurements. */
export const LIMIT = "alimiter=limit=0.794:attack=7:release=80:level=false";

/** Second pass: one linear gain to the target from the first pass's loudness, then the limiter. Lands within 1 LU of -14 (the limiter takes a little back). Pure. */
export const gainStage = (m) => `${FLOAT},volume=${(LOUDNESS.I - m.I).toFixed(2)}dB,${LIMIT}`;

/** Audio encoder arguments for every mp4 this kit writes. */
export const aacArgs = () => ["-c:a", "aac", "-b:a", AAC_BITRATE, "-ar", String(SAMPLE_RATE)];

const ff = (args) => execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

/**
 * Write the cleaned, loudness-normalised narration track to outWav (48 kHz, 32-bit float). wavs and delaysMs line up;
 * totalS is the scene length. Two passes: mix and clean to a temp wav, measure, then apply the measured linear gain.
 */
export function mixNarration(wavs, delaysMs, totalS, outWav) {
  const tmp = `${outWav}.pre.wav`;
  ff(["-y", "-v", "error", ...wavs.flatMap((w) => ["-i", w]), "-filter_complex", narrationGraph(delaysMs, totalS), "-map", "[mix]", ...PCM, tmp]);
  const pass1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", tmp, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  if (pass1.status !== 0) throw new Error(`loudnorm measuring pass failed: ${pass1.stderr.slice(-400)}`);
  const measured = parseLoudnorm(pass1.stderr);
  ff(["-y", "-v", "error", "-i", tmp, "-af", gainStage(measured), ...PCM, `${outWav}.tmp.wav`]);
  renameSync(`${outWav}.tmp.wav`, outWav);
  unlinkSync(tmp);
  return measured;
}
