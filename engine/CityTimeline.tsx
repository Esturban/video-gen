// REUSE_CHECKED: 1_social/py/video-gen/engine/DualTimeline.tsx   that compares two data lanes on a dated axis; this is a drawn city history spine
// City history spine (CMO-8248, promoted from the Riyadh Lab thank-you film): a big city title, dated lines one after another while a
// spine draws across the bottom and three eras rise on it (a stepped mudbrick silhouette, a master-plan grid, glowing modern towers),
// then three human-scale motifs (a metro line with stations, a park, a long walking path) with name chips, and a closing line.
// Architecture only, no figures of people. Local seconds.
import React from "react";
import { linear, ramp, window01 } from "./kineticMath.js";
import { Line, TextBlock, tint, TopScrim, useFilmStyle, useSec } from "./kinetic";

const BASE_Y = 1150;

const Heritage: React.FC<{ p: number; ink: string }> = ({ p, ink }) => {
  const { C } = useFilmStyle();
  const blocks: [number, number, number][] = [
    [110, 70, 120], [180, 60, 170], [240, 90, 140], [330, 60, 95],
  ];
  return (
    <g opacity={p}>
      {blocks.map(([x, w, h], i) => {
        const hh = h * ramp(p, i * 0.15, 0.55 + i * 0.15);
        const top = BASE_Y - hh;
        const teeth = Math.floor(w / 14);
        const crest = Array.from({ length: teeth }, (_, k) => `L${x + k * 14 + 7},${top - 10} L${x + (k + 1) * 14},${top}`).join(" ");
        return (
          <g key={i}>
            <path d={`M${x},${BASE_Y} L${x},${top} ${crest} L${x + w},${top} L${x + w},${BASE_Y} Z`} fill={ink} opacity={0.9} />
            {hh > 40 ? <rect x={x + w / 2 - 6} y={top + 22} width={12} height={20} fill={C.night} opacity={0.7} /> : null}
          </g>
        );
      })}
    </g>
  );
};

const MasterGrid: React.FC<{ p: number }> = ({ p }) => {
  const { C } = useFilmStyle();
  const x0 = 420;
  const w = 250;
  return (
    <g>
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={i} opacity={ramp(p, i * 0.08, 0.3 + i * 0.08)}>
          <line x1={x0 + (i * w) / 6} y1={BASE_Y - 150} x2={x0 + (i * w) / 6} y2={BASE_Y} stroke={C.teal} strokeWidth={2} opacity={0.8} />
          <line x1={x0} y1={BASE_Y - 150 + i * 25} x2={x0 + w} y2={BASE_Y - 150 + i * 25} stroke={C.teal} strokeWidth={2} opacity={0.8} />
        </g>
      ))}
    </g>
  );
};

const ModernGlow: React.FC<{ p: number; t: number; towerInk: string }> = ({ p, t, towerInk }) => {
  const { C } = useFilmStyle();
  const towers: [number, number, number][] = [
    [720, 34, 180], [760, 28, 260], [796, 40, 210], [842, 26, 320], [874, 44, 240], [924, 30, 190], [960, 22, 140],
  ];
  return (
    <g>
      <ellipse cx={850} cy={BASE_Y} rx={200} ry={70} fill={C.amber} opacity={0.18 * p} />
      {towers.map(([x, w, h], i) => {
        const hh = h * ramp(p, i * 0.08, 0.5 + i * 0.08);
        return (
          <g key={i}>
            <rect x={x} y={BASE_Y - hh} width={w} height={hh} fill={towerInk} stroke={C.amber} strokeOpacity={0.7} />
            {Array.from({ length: Math.floor(hh / 22) }).map((_, k) => (
              <rect key={k} x={x + 6} y={BASE_Y - hh + 10 + k * 22} width={w - 12} height={4} fill={C.amber} opacity={0.35 + 0.3 * Math.abs(Math.sin(t * 2 + k + i))} />
            ))}
          </g>
        );
      })}
    </g>
  );
};

const Motifs: React.FC<{ t: number; at: number; parkInk: string }> = ({ t, at, parkInk }) => {
  const { C } = useFilmStyle();
  const metro = ramp(t, at, at + 1.2);
  const park = ramp(t, at + 0.4, at + 1.6);
  const walk = ramp(t, at + 0.8, at + 2);
  const stations = [0.1, 0.3, 0.5, 0.7, 0.9];
  return (
    <g>
      <path d="M150 640 C 350 600, 450 800, 620 760 S 880 640, 960 700" fill="none" stroke={C.teal} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={`${metro} 1`} />
      {stations.map((s, i) => (
        <circle key={i} cx={150 + s * 810} cy={[636, 668, 748, 718, 690][i]} r={11} fill={C.night} stroke={C.teal} strokeWidth={4} opacity={ramp(metro, s, s + 0.1)} />
      ))}
      <path d="M430 820 C 470 780, 610 790, 640 830 C 670 880, 560 900, 480 890 C 420 880, 400 850, 430 820 Z" fill={tint(C.teal, 0.18)} fillOpacity={park} stroke={parkInk} strokeWidth={4} pathLength={1} strokeDasharray={`${park} 1`} />
      <line x1={120} y1={940} x2={960} y2={900} stroke={C.amber} strokeWidth={6} strokeDasharray="22 14" strokeDashoffset={-t * 40} opacity={walk} />
    </g>
  );
};

const Chip: React.FC<{ t: number; at: number; text: string }> = ({ t, at, text }) => {
  const { C, font } = useFilmStyle();
  const p = ramp(t, at, at + 0.35);
  const pop = 1 + 0.08 * Math.sin(Math.min(1, (t - at) / 0.35) * Math.PI) * (t > at ? 1 : 0);
  return (
    <div
      style={{
        opacity: p,
        transform: `scale(${pop * (0.9 + 0.1 * p)})`,
        padding: "10px 26px",
        borderRadius: 999,
        border: `3px solid ${C.teal}`,
        background: tint(C.night, 0.85),
        fontFamily: font,
        fontSize: 64,
        fontWeight: 600,
        color: C.white,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/** steps: [from, until, text] dated lines under the title. chips: [at, text], the first chip's time also starts the motifs. */
export const CityTimeline: React.FC<{
  title: string;
  steps: [number, number, string][];
  chips: [number, string][];
  closing: string;
  heritageInk?: string;
  towerInk?: string;
  parkInk?: string;
  width?: number;
  height?: number;
}> = ({ title, steps, chips, closing, heritageInk = "#b9895a", towerInk = "#12294a", parkInk = "#5fd08a", width = 1080, height = 1350 }) => {
  const t = useSec();
  const { C, side, top } = useFilmStyle();
  const spine = ramp(t, 3.4, 12, linear);
  const chipsOut = ramp(t, 13.2, 13.6);
  const motifsAt = chips.length > 0 ? chips[0][0] : 12;
  return (
    <>
      <TopScrim height={560} />
      <TextBlock top={top}>
        <Line t={t} at={2} until={15.9} size={128} weight={700} color={C.teal} blurIn>
          {title}
        </Line>
      </TextBlock>
      {steps.map(([a, b, text]) => (
        <TextBlock key={text} top={top + 164}>
          <Line t={t} at={a} until={b} size={72}>
            {text}
          </Line>
        </TextBlock>
      ))}
      <div style={{ position: "absolute", left: side, right: side, top: top + 160, display: "flex", flexWrap: "wrap", gap: 16, opacity: 1 - chipsOut }}>
        {chips.map(([at, text]) => (
          <Chip key={text} t={t} at={at} text={text} />
        ))}
      </div>
      <TextBlock top={top + 164}>
        <Line t={t} at={13.6} until={16.3} size={72} color={C.amber}>
          {closing}
        </Line>
      </TextBlock>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: window01(t, 3.4, 16.2, 0.6) }}>
        <g opacity={1 - 0.55 * ramp(t, 11.8, 12.6)}>
          <line x1={side} y1={BASE_Y + 2} x2={side + 888 * spine} y2={BASE_Y + 2} stroke={C.amber} strokeWidth={4} />
          <Heritage p={ramp(t, 3.6, 5.6)} ink={heritageInk} />
          <MasterGrid p={ramp(t, 8.3, 9.8)} />
          <ModernGlow p={ramp(t, 10.2, 11.8)} t={t} towerInk={towerInk} />
        </g>
        <Motifs t={t} at={motifsAt} parkInk={parkInk} />
      </svg>
    </>
  );
};
