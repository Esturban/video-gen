// REUSE_CHECKED: 1_social/py/video-gen/engine/WalkRing.tsx   same ring language; this one sits on an abstract street map with a river and walkers
// Abstract district map (CMO-8248, promoted from the Riyadh Lab thank-you film): a fine street grid, a river drawn on, a walking ring
// with a pulse and walkers inside, a time pill, and two waves of glyph pins (by default schools and parks, then car-free streets).
import React from "react";
import { GlyphAt, GlyphKind } from "./glyphs";
import { ramp, window01 } from "./kineticMath.js";
import { tint, useFilmStyle, useSec, Walker } from "./kinetic";

export type DistrictPin = { kind: GlyphKind; dx: number; dy: number; r: number; size: number; ink: "amber" | "teal"; at: number };

const DEFAULT_PINS: DistrictPin[] = [
  { kind: "education", dx: -150, dy: -90, r: 46, size: 48, ink: "amber", at: 5.9 },
  { kind: "park", dx: -58, dy: -150, r: 40, size: 44, ink: "teal", at: 5.9 },
  { kind: "nocar", dx: 170, dy: 110, r: 48, size: 60, ink: "amber", at: 8.9 },
];

export const DistrictMap: React.FC<{ t?: number; label: string; pins?: DistrictPin[]; river?: string; show?: [number, number]; width?: number; height?: number }> = ({
  t: tProp,
  label,
  pins = DEFAULT_PINS,
  river = "#2c6fb3",
  show = [2.8, 11.9],
  width = 1080,
  height = 1350,
}) => {
  const sec = useSec();
  const t = tProp ?? sec;
  const { C, font, side } = useFilmStyle();
  const vis = window01(t, show[0], show[1], 0.7);
  if (vis <= 0) return null;
  const cx = 540;
  const cy = 900;
  const ring = ramp(t, 3.4, 4.1);
  const pulse = ((t - 4.1) % 2) / 2;
  const streets = Array.from({ length: 15 }, (_, i) => i);
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: vis }}>
      <defs>
        <clipPath id="districtClip">
          <rect x={side} y={600} width={888} height={580} rx={30} />
        </clipPath>
      </defs>
      <rect x={side} y={600} width={888} height={580} rx={30} fill={C.night} opacity={0.9} />
      <g clipPath="url(#districtClip)">
        {streets.map((i) => (
          <g key={i} opacity={ramp(t, 3 + i * 0.04, 3.6 + i * 0.04) * 0.5}>
            <line x1={side + i * 64} y1={600} x2={side + i * 64 - 120} y2={1180} stroke={C.soft} strokeWidth={1} />
            <line x1={side} y1={620 + i * 42} x2={side + 888} y2={580 + i * 42} stroke={C.soft} strokeWidth={1} />
          </g>
        ))}
        <path
          d="M60 760 C 260 700, 380 900, 560 850 S 860 700, 1040 800"
          fill="none"
          stroke={river}
          strokeWidth={26}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${ramp(t, 3, 4)} 1`}
          opacity={0.8}
        />
        <circle cx={cx} cy={cy} r={220 + pulse * 60} fill="none" stroke={C.amber} strokeWidth={2} opacity={ring * (1 - pulse) * 0.7} />
        <circle cx={cx} cy={cy} r={220} fill={tint(C.amber, 0.08)} stroke={C.amber} strokeWidth={5} pathLength={1} strokeDasharray={`${ring} 1`} />
        <circle cx={cx} cy={cy} r={12} fill={C.amber} opacity={ring} />
        {Array.from({ length: 7 }).map((_, i) => {
          const ang = (i / 7) * Math.PI * 2 + t * 0.12 * (i % 2 ? 1 : -1);
          const rad = 70 + (i % 3) * 45;
          return <Walker key={i} x={cx + Math.cos(ang) * rad} y={cy + 30 + Math.sin(ang) * rad * 0.6} h={54} phase={t * 1.4 + i * 0.3} opacity={ramp(t, 4 + i * 0.1, 4.5 + i * 0.1)} />;
        })}
      </g>
      {pins.map((p, i) => (
        <g key={i} opacity={ramp(t, p.at, p.at + 0.4)}>
          <circle cx={cx + p.dx} cy={cy + p.dy} r={p.r} fill={C.night} stroke={C[p.ink]} strokeWidth={3} />
          <GlyphAt kind={p.kind} x={cx + p.dx} y={cy + p.dy} size={p.size} color={C[p.ink]} />
        </g>
      ))}
      <g opacity={ring}>
        <rect x={cx + 150} y={cy - 250} width={210} height={84} rx={42} fill={C.amber} />
        <text x={cx + 255} y={cy - 193} textAnchor="middle" fontFamily={font} fontSize={52} fontWeight={700} fill={C.night}>
          {label}
        </text>
      </g>
    </svg>
  );
};
