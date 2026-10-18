// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/stagesA.tsx   MapStage, and stagesB.tsx ShadeStage/HeatStage, moved here unchanged in look; place names and copy now come in as props, colours from the brand. geo.ts draws real geography, these are schematic district maps, so not reused.
// Three schematic map stages for a ToolStageFrame (all draw into the 1140x860 StageSvg):
//   PinMapStage   : streets draw on, blocks fade in, labelled pins drop; the highlighted pin pulses.
//   ShadeMapStage : streets, a park, trees one by one, shaded walkways, a legend and a closing chip.
//   HeatGridStage : a 10x6 block grid coloured cooler to hotter, a cool park corner, a ring on the hottest block, a question chip.
import React from "react";
import { useSeconds, useT } from "./beat";
import { alpha, heatAt, pulseAt, rampColor } from "./cityStageMath.js";
import { StageSvg, StageTag, useStagePalette } from "./ToolStageFrame";

export type MapPin = { x: number; y: number; label: string; hi?: boolean };

const PIN_STREETS = [
  "M40 200 L1100 170", "M40 520 L1100 560", "M40 760 L1100 740",
  "M260 40 L230 820", "M620 40 L650 820", "M920 40 L900 820",
];

export const PinMapStage: React.FC<{ title: string; pins: MapPin[]; label: string; highlightAt?: number; pulseFrom?: number }> = ({ title, pins, label, highlightAt = 6.2, pulseFrom = 6.4 }) => {
  const t = useT();
  const s = useSeconds();
  const { P } = useStagePalette();
  const draw = t(0.6, 3.2);
  const pulse = pulseAt(s, pulseFrom, 1.6);
  return (
    <StageSvg label={label}>
      <rect x="0" y="0" width="1140" height="860" rx="32" fill={alpha(P.light, 0.06)} stroke={P.line} />
      <text x="48" y="92" fontSize="34" fontWeight="300" fill={P.light} opacity={t(0.4, 1.4)}>{title}</text>
      <g opacity={t(2.0, 3.4)} fill={alpha(P.light, 0.08)}>
        <rect x="300" y="230" width="280" height="250" rx="16" /><rect x="690" y="225" width="190" height="260" rx="16" />
        <rect x="300" y="600" width="280" height="120" rx="16" fill={alpha(P.accent, 0.28)} /><rect x="690" y="600" width="190" height="120" rx="16" />
      </g>
      <g stroke={alpha(P.light, 0.28)} strokeWidth="16" fill="none" strokeLinecap="round">
        {PIN_STREETS.map((d) => (
          <path key={d} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} />
        ))}
      </g>
      {pins.map((p, i) => {
        const drop = t(3.4 + i * 0.6, 4.2 + i * 0.6);
        return (
          <g key={p.label} transform={`translate(${p.x},${p.y - (1 - drop) * 60})`} opacity={drop}>
            {p.hi && pulse > 0 ? <circle cx="0" cy="40" r={30 + pulse * 60} fill="none" stroke={P.warn} strokeWidth="4" opacity={1 - pulse} /> : null}
            <path d="M0 -10 C -26 -10 -34 10 -34 22 C -34 48 0 76 0 76 C 0 76 34 48 34 22 C 34 10 26 -10 0 -10 Z" fill={p.hi && s > highlightAt ? P.warn : P.accent} />
            <circle cx="0" cy="20" r="11" fill={P.ink} />
            <rect x="-100" y="88" width="200" height="44" rx="22" fill={P.light} />
            <text x="0" y="118" textAnchor="middle" fontSize="22" fill={P.ink}>{p.label}</text>
          </g>
        );
      })}
    </StageSvg>
  );
};

const SHADE_STREETS = ["M40 200 L1100 200", "M40 470 L1100 470", "M40 770 L1100 770", "M420 120 L420 840", "M780 120 L780 840"];
const TREES = [
  [150, 560], [190, 610], [240, 575], [165, 660], [230, 650], [300, 620], [270, 700],
  [520, 250], [560, 250], [600, 250], [640, 250], [680, 250],
  [860, 520], [900, 560], [940, 520], [980, 560],
];

type ShadeCopy = { title: string; park: string; trees: string; walkway: string; chip: string; label: string };

export const ShadeMapStage: React.FC<ShadeCopy> = ({ title, park, trees, walkway, chip, label }) => {
  const t = useT();
  const { P } = useStagePalette();
  const streets = t(0.4, 1.8);
  return (
    <StageSvg label={label}>
      <rect x="0" y="0" width="1140" height="860" rx="32" fill={alpha(P.light, 0.06)} stroke={P.line} />
      <text x="48" y="84" fontSize="32" fontWeight="300" fill={P.light} opacity={t(0.2, 1.0)}>{title}</text>
      <g stroke={alpha(P.light, 0.3)} strokeWidth="18" fill="none" strokeLinecap="round">
        {SHADE_STREETS.map((d) => (
          <path key={d} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - streets} />
        ))}
      </g>
      <g opacity={t(2.0, 3.0)}>
        <rect x="90" y="520" width="280" height="210" rx="22" fill={alpha(P.accent, 0.55)} />
        <text x="230" y="508" textAnchor="middle" fontSize="24" fill={P.light}>{park}</text>
      </g>
      <g opacity={t(5.4, 6.4)} stroke={P.accent} strokeWidth="14" strokeLinecap="round" fill="none">
        <path d="M480 250 L720 250" />
        <path d="M840 540 L1000 540" />
      </g>
      {TREES.map(([x, y], i) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="17" fill={P.accent} stroke={P.mist} strokeWidth="3" opacity={t(3.2 + i * 0.12, 3.6 + i * 0.12)} />
      ))}
      <g opacity={t(6.6, 7.4)} transform="translate(460,560)">
        <rect width="280" height="150" rx="20" fill={P.paper} />
        <circle cx="36" cy="44" r="14" fill={P.accent} />
        <text x="64" y="52" fontSize="23" fill={P.ink}>{trees}</text>
        <path d="M22 100 L50 100" stroke={P.accent} strokeWidth="12" strokeLinecap="round" />
        <text x="64" y="108" fontSize="23" fill={P.ink}>{walkway}</text>
      </g>
      <g opacity={t(7.6, 8.4)}>
        <rect x="770" y="20" width="330" height="60" rx="30" fill={P.paper} />
        <text x="935" y="59" textAnchor="middle" fontSize="25" fontWeight="500" fill={P.ink}>{chip}</text>
      </g>
    </StageSvg>
  );
};

const COLS = 10;
const ROWS = 6;
const HOT: [number, number] = [7, 2];
const isPark = (c: number, r: number) => c <= 2 && r >= 3;
const HEAT = { hot: HOT, radius: 6, cool: isPark };
const cx = (c: number) => 60 + c * 102 + 44;
const cy = (r: number) => 130 + r * 102 + 44;

type HeatCopy = { title: string; tag: string; park: string; cooler: string; hotter: string; question: string; label: string };

export const HeatGridStage: React.FC<HeatCopy> = ({ title, tag, park, cooler, hotter, question, label }) => {
  const t = useT();
  const s = useSeconds();
  const { P } = useStagePalette();
  const stops = [P.sage, P.warn, P.hot];
  const ring = t(5.2, 6.2);
  const pulse = pulseAt(s, 6.2, 1.8);
  return (
    <StageSvg label={label}>
      <rect x="0" y="0" width="1140" height="860" rx="32" fill={alpha(P.light, 0.06)} stroke={P.line} />
      <text x="48" y="84" fontSize="32" fontWeight="300" fill={P.light} opacity={t(0.3, 1.1)}>{title}</text>
      <g opacity={t(0.3, 1.1)}><StageTag text={tag} x={900} y={52} /></g>
      {Array.from({ length: COLS * ROWS }, (_, k) => {
        const c = k % COLS;
        const r = Math.floor(k / COLS);
        const show = t(1.0 + (c + r) * 0.12, 1.8 + (c + r) * 0.12);
        return (
          <rect key={k} x={60 + c * 102} y={130 + r * 102} width="88" height="88" rx="12"
            fill={isPark(c, r) ? alpha(P.accent, 0.75) : rampColor(heatAt(c, r, HEAT), stops)} opacity={show} />
        );
      })}
      <text x="211" y="580" textAnchor="middle" fontSize="24" fill={P.ink} opacity={t(2.4, 3.2)}>{park}</text>
      <g opacity={ring}>
        <circle cx={cx(HOT[0])} cy={cy(HOT[1])} r={120} fill="none" stroke={P.light} strokeWidth="5" />
        {pulse > 0 ? <circle cx={cx(HOT[0])} cy={cy(HOT[1])} r={120 + pulse * 50} fill="none" stroke={P.light} strokeWidth="3" opacity={1 - pulse} /> : null}
      </g>
      <g opacity={t(2.8, 3.6)} transform="translate(60,770)">
        <text x="0" y="28" fontSize="22" fill={P.light}>{cooler}</text>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => <rect key={v} x={90 + i * 56} y="6" width="50" height="30" rx="6" fill={rampColor(v, stops)} />)}
        <text x="380" y="28" fontSize="22" fill={P.light}>{hotter}</text>
      </g>
      <g opacity={t(6.4, 7.4)}>
        <rect x="640" y="760" width="420" height="64" rx="32" fill={P.paper} />
        <text x="850" y="802" textAnchor="middle" fontSize="27" fontWeight="500" fill={P.ink}>{question}</text>
      </g>
    </StageSvg>
  );
};
