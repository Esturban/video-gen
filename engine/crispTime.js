// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/time.js and bin/video (our own). The pairing below was measured with ffmpeg, not assumed: tmix=frames=N,fps=F outputs frame k as the mean of subframes kN-(N-1) .. kN.
// Crisp clock for anything that must not ghost: text, digits, hairlines. The master is rendered at F x N frames per second and tmix averages N subframes into each output frame (motion blur).
// A value that changes between subframes is drawn twice and averaged: a counting number shows two digits at once. Snapping the clock so every subframe of one output frame reads the SAME time makes
// that average of identical images, so the element stays sharp while shapes driven by the raw clock keep their blur. Pure function of its inputs.

/**
 * Time (seconds) that every subframe of the same output frame shares.
 * @param {number} t raw composition time in seconds (frame / (outFps * blur))
 * @param {number} outFps frames per second of the delivered file
 * @param {number} blur subframes averaged into one output frame (1 = no blur, then t is returned unchanged)
 */
export function crispTime(t, outFps, blur) {
  if (!(outFps > 0) || !Number.isInteger(blur) || blur < 1) throw new Error(`crispTime needs outFps > 0 and a whole blur >= 1, got ${outFps} and ${blur}`);
  if (blur === 1) return t;
  const subframe = Math.round(t * outFps * blur);
  return Math.ceil(subframe / blur) / outFps;
}
