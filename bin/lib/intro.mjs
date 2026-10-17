// Branded intro include (CMO-8170): scene field "intro": "brand/intro" names a folder under scenes/. After the master renders,
// the pre-rendered intro mp4 (<consumer>/out/<intro>/) is put in front of it, re-encoded to the master's size, fps and codec.
// The master is never touched; each result is <stem>-with-intro.mp4 beside its source (master, -linkedin, -9x16), CMO-8185.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const ENCODERS = { h264: "libx264", hevc: "libx265" };

export const withIntroPath = (master) => join(dirname(master), `${basename(master, ".mp4")}-with-intro.mp4`);

/** "60/1" or "30000/1001" or "25" as a number. */
export function parseRate(rate) {
  const [n, d] = String(rate).split("/").map(Number);
  return d ? n / d : n;
}

/** The rendered intro mp4 for a scene's intro ref: <outRoot>/<ref>/intro.mp4, else <leaf>.mp4; with a variant name, <leaf>-<variant>.mp4 (intro-9x16.mp4). Throws a message that says what to run. */
export function introMp4(ref, outRoot, variant = null) {
  const folder = join(outRoot, ref);
  const leaf = basename(ref);
  const names = variant ? [`${leaf}-${variant}.mp4`] : ["intro.mp4", `${leaf}.mp4`];
  const found = names.map((f) => join(folder, f)).find(existsSync);
  if (found) return found;
  const how = variant ? `a native ${variant} intro: add "variants": {"${variant}": {"size": [w, h]}} to the intro scene and render it` : `render it first with bin/video render ${ref} --tokens 0`;
  throw new Error(`intro "${ref}" has no rendered mp4 in ${folder} (looked for ${names.join(", ")}): ${how}`);
}

/**
 * The intro that matches one output's aspect (CMO-8185). output is { label, size: [w, h] }; the master and LinkedIn cut are 16:9.
 * A portrait output needs its own native intro (<leaf>-<label>.mp4) and fails rather than letterbox the 16:9 one;
 * a landscape or square variant uses its own intro when rendered, else the 16:9 one scaled to fit.
 */
export function introFileFor(ref, outRoot, { label, size }) {
  const [w, h] = size;
  if (label === "master" || label === "linkedin") return introMp4(ref, outRoot);
  try { return introMp4(ref, outRoot, label); } catch (e) { if (h > w) throw e; return introMp4(ref, outRoot); }
}

/** Size, fps, codec, audio and duration of a media file, from ffprobe. */
export function probeMedia(file) {
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration", "-of", "json", file]).toString());
  const v = info.streams.find((s) => s.codec_type === "video");
  return { width: v.width, height: v.height, fps: v.r_frame_rate, codec: v.codec_name, hasAudio: info.streams.some((s) => s.codec_type === "audio"), duration: Number(info.format.duration) };
}

/** ffmpeg arguments for intro + master. Pure: info is { master, intro } from probeMedia. A silent intro gets generated silence when the master has audio. */
export function introConcatArgs({ intro, master, out, info }) {
  const m = info.master;
  const silence = m.hasAudio && !info.intro.hasAudio;
  const size = `${m.width}:${m.height}`;
  const video = [
    `[0:v]scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${m.fps},format=yuv420p[iv]`,
    `[1:v]setsar=1,fps=${m.fps},format=yuv420p[mv]`,
  ];
  const norm = "aresample=48000,aformat=channel_layouts=stereo";
  const audio = m.hasAudio ? [`[${silence ? 2 : 0}:a]${norm}[ia]`, `[1:a]${norm}[ma]`] : [];
  const join2 = m.hasAudio ? "[iv][ia][mv][ma]concat=n=2:v=1:a=1[v][a]" : "[iv][mv]concat=n=2:v=1:a=0[v]";
  return [
    "-y", "-v", "error", "-i", intro, "-i", master,
    ...(silence ? ["-f", "lavfi", "-t", String(info.intro.duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"] : []),
    "-filter_complex", [...video, ...audio, join2].join(";"),
    "-map", "[v]", ...(m.hasAudio ? ["-map", "[a]", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-c:v", ENCODERS[m.codec] ?? "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", String(m.fps), "-movflags", "+faststart",
    out,
  ];
}

/** Write <master stem>-with-intro.mp4 beside the master and return its path. */
export function prependIntro(master, intro) {
  const out = withIntroPath(master);
  const info = { master: probeMedia(master), intro: probeMedia(intro) };
  execFileSync("ffmpeg", introConcatArgs({ intro, master, out, info }), { stdio: ["ignore", "ignore", "inherit"] });
  return out;
}
