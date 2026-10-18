// REUSE_CHECKED: 1_social/py/video-gen/engine/IsoSkyline.tsx   leaders point at its grid through skylinePoint; this adds the cards and the scene's title lines
// Tool callouts over a city (CMO-8248, promoted from the Riyadh Lab thank-you film): staggered dotted leaders rise from spots on an
// IsoSkyline grid to small cards with plain product names (no logos), under a scrim with timed title lines. No charts, no claims.
import React from "react";
import { DEFAULT_GRID, SkylineGrid, skylinePoint } from "./IsoSkyline";
import { lerp, ramp } from "./kineticMath.js";
import { Line, TextBlock, tint, TopScrim, useFilmStyle, useSec } from "./kinetic";

/** at/until: local seconds. spot: grid cell (i, j) and height z on the skyline. card: card centre on screen. */
export type Callout = { name: string; at: number; until: number; spot: [number, number, number]; card: [number, number] };
export type CalloutTitle = { at: number; until: number; text: string };

const CARD_H = 96;

const CalloutLeader: React.FC<{ t: number; c: Callout; grid: SkylineGrid }> = ({ t, c, grid }) => {
  const { C } = useFilmStyle();
  const draw = ramp(t, c.at, c.at + 0.7);
  const out = ramp(t, c.until - 0.5, c.until);
  if (draw <= 0 || out >= 1) return null;
  const [sx, sy] = skylinePoint(grid, c.spot[0], c.spot[1], c.spot[2]);
  const [cx, cy] = c.card;
  const ex = lerp(sx, cx, draw);
  const ey = lerp(sy, cy + CARD_H / 2, draw);
  const ping = ((t - c.at) % 1.4) / 1.4;
  return (
    <g opacity={1 - out}>
      <circle cx={sx} cy={sy} r={8 + ping * 26} fill="none" stroke={C.amber} strokeWidth={2} opacity={1 - ping} />
      <circle cx={sx} cy={sy} r={7} fill={C.amber} />
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={C.amber} strokeWidth={3} strokeLinecap="round" strokeDasharray="2 10" />
    </g>
  );
};

const CalloutCard: React.FC<{ t: number; c: Callout }> = ({ t, c }) => {
  const { C, font } = useFilmStyle();
  const p = ramp(t, c.at + 0.55, c.at + 0.9);
  const out = ramp(t, c.until - 0.5, c.until);
  if (p <= 0 || out >= 1) return null;
  const pop = 1 + 0.1 * Math.sin(Math.min(1, (t - c.at - 0.55) / 0.35) * Math.PI);
  return (
    <div
      style={{
        position: "absolute",
        left: c.card[0],
        top: c.card[1] - CARD_H / 2,
        height: CARD_H,
        padding: "0 26px",
        whiteSpace: "nowrap",
        fontFamily: font,
        fontSize: 48,
        fontWeight: 700,
        color: C.white,
        borderRadius: 22,
        border: `3px solid ${C.teal}`,
        background: tint(C.night, 0.92),
        boxShadow: `0 0 30px ${tint(C.teal, 0.4 * p)}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: p * (1 - out),
        transform: `translateX(-50%) scale(${pop * lerp(0.8, 1, p)})`,
      }}
    >
      {c.name}
    </div>
  );
};

export const ToolCallouts: React.FC<{ titles?: CalloutTitle[]; callouts: Callout[]; grid?: SkylineGrid; scrim?: number; width?: number; height?: number }> = ({
  titles = [],
  callouts,
  grid = DEFAULT_GRID,
  scrim = 460,
  width = 1080,
  height = 1350,
}) => {
  const t = useSec();
  const { top } = useFilmStyle();
  return (
    <>
      <TopScrim height={scrim} />
      {titles.map((l) => (
        <TextBlock key={l.text} top={top}>
          <Line t={t} at={l.at} until={l.until} size={88} weight={700}>
            {l.text}
          </Line>
        </TextBlock>
      ))}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {callouts.map((c) => (
          <CalloutLeader key={c.name} t={t} c={c} grid={grid} />
        ))}
      </svg>
      {callouts.map((c) => (
        <CalloutCard key={c.name} t={t} c={c} />
      ))}
    </>
  );
};
