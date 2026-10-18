// REUSE_CHECKED: 1_social/py/video-gen/engine/isoMath.js   grid projection and block layout live there; this draws them
// Generic digital-twin district (CMO-8248, promoted from the Riyadh Lab thank-you film): an isometric ground grid, wireframe blocks
// rising with a ripple from the centre, then lighting up into a skyline with walkers on the streets. No real buildings.
// Clocks: `clock0 + local` drives the build and every cycle (the film keyed it at 70 s); `nowFrom + local` is the film time the
// optional dims are keyed on (dim under later scenes, gone before the end card).
import React from "react";
import { random } from "remotion";
import { buildBlocks, iso } from "./isoMath.js";
import { lerp, ramp } from "./kineticMath.js";
import { tint, useFilmStyle, useSec, Walker } from "./kinetic";

type Block = { i: number; j: number; h: number; lit: boolean };
export type SkylineGrid = { n: number; tile: number; origin: [number, number] };
export const DEFAULT_GRID: SkylineGrid = { n: 7, tile: 56, origin: [540, 790] };
export type SkylineDims = { dimAt?: number; dimTo?: number; dim2At?: number; dim2To?: number; goneAt?: number };

const pts = (p: [number, number][]) => p.map((q) => q.join(",")).join(" ");

const BlockShape: React.FC<{ b: Block; h: number; fill: number; t: number; grid: SkylineGrid; sideInk: string }> = ({ b, h, fill, t, grid, sideInk }) => {
  const { C } = useFilmStyle();
  const P = (i: number, j: number, z = 0) => iso(grid.origin, grid.tile, i, j, z);
  const m = 0.12;
  const [i0, j0, i1, j1] = [b.i + m, b.j + m, b.i + 1 - m, b.j + 1 - m];
  const g = [P(i0, j0), P(i1, j0), P(i1, j1), P(i0, j1)];
  const top = [P(i0, j0, h), P(i1, j0, h), P(i1, j1, h), P(i0, j1, h)];
  const left: [number, number][] = [g[3], g[2], top[2], top[3]];
  const right: [number, number][] = [g[1], g[2], top[2], top[1]];
  const floors = Math.floor(h / 18);
  const flick = (k: number) => 0.45 + 0.4 * Math.abs(Math.sin(t * 1.3 + k * 1.7 + b.i * 3 + b.j));
  return (
    <g>
      <polygon points={pts(left)} fill={tint(C.deep, 0.95 * fill)} stroke={C.teal} strokeOpacity={lerp(0.9, 0.35, fill)} strokeWidth={1.4} />
      <polygon points={pts(right)} fill={tint(sideInk, 0.95 * fill)} stroke={C.teal} strokeOpacity={lerp(0.9, 0.35, fill)} strokeWidth={1.4} />
      <polygon points={pts(top)} fill={tint(C.teal, 0.1 + 0.15 * fill)} stroke={C.teal} strokeWidth={1.4} />
      {b.lit && fill > 0.05
        ? Array.from({ length: floors }).map((_, k) => {
            const z = 12 + k * 18;
            const a = P(i0, j1, z);
            const c = P(i1, j1, z);
            const d = P(i1, j0, z);
            return (
              <g key={k} opacity={fill * flick(k)}>
                <line x1={a[0] + 4} y1={a[1] - 2} x2={c[0] - 4} y2={c[1] + 2} stroke={C.amber} strokeWidth={3} />
                <line x1={c[0] + 4} y1={c[1] - 2} x2={d[0] - 4} y2={d[1] + 2} stroke={C.amber} strokeWidth={2.4} opacity={0.7} />
              </g>
            );
          })
        : null}
    </g>
  );
};

/** Screen point on top of grid cell (i, j) at height z, for leaders that point at the skyline. */
export const skylinePoint = (grid: SkylineGrid, i: number, j: number, z: number) => iso(grid.origin, grid.tile, i, j, z);

export const IsoSkyline: React.FC<{ clock0?: number; nowFrom?: number; dims?: SkylineDims; grid?: SkylineGrid; sideInk?: string; width?: number; height?: number }> = ({
  clock0 = 0,
  nowFrom = 0,
  dims = {},
  grid = DEFAULT_GRID,
  sideInk = "#12294A",
  width = 1080,
  height = 1350,
}) => {
  const { C } = useFilmStyle();
  const blocks: Block[] = React.useMemo(() => buildBlocks(grid.n, (s: string) => random(s)), [grid.n]);
  const P = (i: number, j: number, z = 0) => iso(grid.origin, grid.tile, i, j, z);
  const N = grid.n;
  const mid = (N - 1) / 2;
  const local = useSec();
  const gt = clock0 + local;
  const now = nowFrom + local;
  const dimTracks = dims.dimAt === undefined ? 1 : lerp(1, dims.dimTo ?? 0.4, ramp(now, dims.dimAt - 0.6, dims.dimAt + 0.6));
  const dimCredits = dims.dim2At === undefined ? 1 : lerp(1, dims.dim2To ?? 0.55, ramp(now, dims.dim2At - 0.6, dims.dim2At + 1));
  const gone = dims.goneAt === undefined ? 0 : ramp(now, dims.goneAt - 0.8, dims.goneAt + 0.2);
  const vis = ramp(gt, clock0, clock0 + 0.8) * dimTracks * dimCredits * (1 - gone);
  if (vis <= 0.01) return null;
  const light = ramp(gt, clock0 + 4.5, clock0 + 7.5);
  const ground = ramp(gt, clock0 + 0.2, clock0 + 1.4);
  const lines = Array.from({ length: N + 1 }, (_, k) => k);
  const streetWalkers = Array.from({ length: 6 }, (_, k) => k);
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: vis }}>
      <defs>
        <radialGradient id="cityGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.amber} stopOpacity={0.28} />
          <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={grid.origin[0]} cy={grid.origin[1] + N * grid.tile * 0.5} rx={560} ry={300} fill="url(#cityGlow)" opacity={light} />
      <g opacity={ground}>
        {lines.map((k) => {
          const a = P(k, 0);
          const b = P(k, N);
          const c = P(0, k);
          const d = P(N, k);
          return (
            <g key={k} stroke={C.teal} strokeOpacity={0.35} strokeWidth={1}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              <line x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} />
            </g>
          );
        })}
      </g>
      {blocks.map((b, k) => {
        const delay = Math.hypot(b.i - mid, b.j - mid) * 0.45;
        const rise = ramp(gt, clock0 + 0.6 + delay, clock0 + 2.6 + delay);
        const fill = ramp(gt, clock0 + 4.5 + delay * 0.5, clock0 + 6 + delay * 0.5);
        return <BlockShape key={k} b={b} h={Math.max(2, b.h * rise)} fill={fill} t={gt} grid={grid} sideInk={sideInk} />;
      })}
      {streetWalkers.map((k) => {
        const along = ((gt * 0.07 + k / 6) % 1) * N;
        const onI = k % 2 === 0;
        const [x, y] = onI ? P(mid + 0.5, along) : P(along, mid + 0.5);
        return <Walker key={k} x={x} y={y} h={30} phase={gt * 1.6 + k * 0.4} color={C.white} opacity={ramp(gt, clock0 + 6 + k * 0.2, clock0 + 6.6 + k * 0.2) * 0.9} />;
      })}
    </svg>
  );
};
