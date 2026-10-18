// @ts-check
// REUSE_CHECKED: none   no isometric grid maths in the engine before this (CMO-8248, from the Riyadh Lab thank-you film's skyline)
// Pure isometric city maths: grid-to-screen projection and the block layout of a generic district (streets on the middle row and
// column, taller blocks toward the centre). Randomness is passed in, so the engine part can use Remotion's seeded random().

/**
 * Screen point of grid cell (i, j) at height z for an isometric grid whose (0, 0) corner sits at origin.
 * @param {[number, number]} origin
 * @param {number} tile cell width in px (cell height is half of it)
 * @param {number} i @param {number} j @param {number} [z]
 * @returns {[number, number]}
 */
export const iso = (origin, tile, i, j, z = 0) => [origin[0] + (i - j) * tile, origin[1] + (i + j) * tile * 0.5 - z];

/**
 * Blocks of an n x n district, back to front (paint order). The middle row and column are streets (no block).
 * Height: 40 px + up to 200 px toward the centre + up to 70 px from rand; lit when rand > 0.25.
 * @param {number} n odd grid size
 * @param {(seed: string) => number} rand seeded 0..1
 * @returns {{ i: number, j: number, h: number, lit: boolean }[]}
 */
export const buildBlocks = (n, rand) => {
  if (!(Number.isInteger(n) && n >= 3 && n % 2 === 1)) throw new Error(`buildBlocks: n must be an odd whole number >= 3, got ${n}`);
  const mid = (n - 1) / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === mid || j === mid) continue;
      const centre = 1 - Math.hypot(i - mid, j - mid) / (mid + 1.5);
      out.push({ i, j, h: 40 + centre * 200 + rand(`h${i}-${j}`) * 70, lit: rand(`l${i}-${j}`) > 0.25 });
    }
  }
  return out.sort((a, b) => a.i + a.j - (b.i + b.j));
};
