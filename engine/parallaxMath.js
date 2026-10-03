// @ts-check
// REUSE_CHECKED: 1_social/py/video-gen/engine/cameraMath.js (our own camera, same {cx, cy, zoom} shape) and motionMath.js. Method reference only: Remocn/remocn (MIT) infinite-bento-pan for layers that slide at different rates under one camera.
// Pure parallax maths. The camera is an svg viewBox, so a layer that should seem to move at `factor` times the camera speed is drawn offset by camera * (1 - factor):
// factor 1 sits in the world (moves with the content), factor 0 is glued to the screen, below 1 reads as far away, above 1 as near. Every function is a pure function of its inputs.

/** Offset [dx, dy] to draw a layer at so it appears to move at `factor` times the camera. */
export const layerShift = (camera, factor) => [camera.cx * (1 - factor) + 0, camera.cy * (1 - factor) + 0];

/** Slow ambient drift of a layer: position after t seconds at velocity [vx, vy] px/s. Keeps a held frame alive without moving the content. */
export const driftOffset = (t, [vx, vy]) => [vx * t + 0, vy * t + 0];

const frac = (x) => x - Math.floor(x);
const PHI_X = 0.7548776662466927; // plastic-number lattice constants: a low-discrepancy spread, no randomness
const PHI_Y = 0.5698402909980532;
const PHI_S = 0.6180339887498949;

/**
 * Deterministic scatter of `count` motes inside the box. Same inputs give the same motes on every frame and every render.
 * @param {number} count
 * @param {{ x0: number, y0: number, x1: number, y1: number }} box
 * @param {{ minR: number, maxR: number }} size
 * @returns {{ x: number, y: number, r: number }[]}
 */
export function motes(count, box, size) {
  return Array.from({ length: count }, (_, i) => ({
    x: box.x0 + frac(0.5 + (i + 1) * PHI_X) * (box.x1 - box.x0),
    y: box.y0 + frac(0.5 + (i + 1) * PHI_Y) * (box.y1 - box.y0),
    r: size.minR + frac((i + 1) * PHI_S) * (size.maxR - size.minR),
  }));
}
