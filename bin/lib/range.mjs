// --range START:END (seconds, end exclusive) for `video render`: parse it and turn it into composition frames (CMO-7578).

/** "2:3" -> { start: 2, end: 3 }. Throws an error naming --range when malformed, reversed, empty, negative, or past the scene's end. */
export function parseRange(str, durationS) {
  const bad = (why) => { throw new Error(`--range ${why}: expected START:END in seconds, e.g. --range 2:3 (scene is ${durationS}s long)`); };
  const parts = String(str).split(":");
  if (parts.length !== 2) bad(`"${str}" is not START:END`);
  const [start, end] = parts.map((p) => (p.trim() === "" ? NaN : Number(p)));
  if (!Number.isFinite(start) || !Number.isFinite(end)) bad(`"${str}" has a non-numeric bound`);
  if (start < 0) bad(`"${str}" starts before 0`);
  if (!(end > start)) bad(`"${str}" is empty or reversed`);
  if (end > durationS) bad(`"${str}" ends after the scene (${durationS}s)`);
  return { start, end };
}

/** Output frames at fps, and the inclusive composition frame range. The composition runs at fps * blur, so each output frame is `blur` subframes. */
export function rangeFrames({ start, end }, fps, blur) {
  const outputFrames = Math.round((end - start) * fps);
  const subframes = outputFrames * blur;
  const first = Math.round(start * fps) * blur;
  return { outputFrames, subframes, frameRange: [first, first + subframes - 1] };
}
