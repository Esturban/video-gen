// REUSE_CHECKED: 1_social/py/video-gen/engine/glyphs.tsx   the icons come from there; this is the walking-radius diagram around them
// Walking-radius diagram (CMO-8248, promoted from the Riyadh Lab thank-you film): home at the centre, a ring drawn on with a soft
// pulse, a radius line with its distance, a time pill on the ring, and daily needs popping in around home. Local seconds.
import React from "react";
import { GlyphAt, GlyphKind } from "./glyphs";
import { ramp, window01 } from "./kineticMath.js";
import { tint, useFilmStyle, useSec } from "./kinetic";

export const WalkRing: React.FC<{ t?: number; needs: GlyphKind[]; distance: string; time: string; show?: [number, number]; width?: number; height?: number }> = ({
  t: tProp,
  needs,
  distance,
  time,
  show = [5.0, 13.9],
  width = 1080,
  height = 1350,
}) => {
  const sec = useSec();
  const t = tProp ?? sec;
  const { C, font, side } = useFilmStyle();
  const vis = window01(t, show[0], show[1], 0.6);
  if (vis <= 0) return null;
  const cx = 540;
  const cy = 900;
  const R = 250;
  const ring = ramp(t, 5.6, 6.6);
  const pulse = ((t - 6.6) % 2.2) / 2.2;
  const radius = ramp(t, 6.8, 7.6);
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: vis }}>
      <rect x={side} y={560} width={888} height={660} rx={30} fill={tint(C.night, 0.86)} stroke={C.faint} />
      <circle cx={cx} cy={cy} r={R + pulse * 50} fill="none" stroke={C.amber} strokeWidth={2} opacity={ring * (1 - pulse) * 0.6} />
      <circle cx={cx} cy={cy} r={R} fill={tint(C.amber, 0.07)} stroke={C.amber} strokeWidth={5} pathLength={1} strokeDasharray={`${ring} 1`} />
      <g opacity={radius}>
        <line x1={cx} y1={cy} x2={cx + R * radius} y2={cy} stroke={C.amber} strokeWidth={3} strokeDasharray="8 8" />
        <text x={cx} y={cy + R + 62} textAnchor="middle" fontFamily={font} fontSize={40} fontWeight={600} fill={C.soft}>
          {distance}
        </text>
      </g>
      <g opacity={ring}>
        <rect x={cx - 170} y={cy - R - 44} width={340} height={80} rx={40} fill={C.amber} />
        <text x={cx} y={cy - R + 12} textAnchor="middle" fontFamily={font} fontSize={48} fontWeight={700} fill={C.night}>
          {time}
        </text>
      </g>
      <g opacity={ramp(t, 5.2, 5.8)}>
        <circle cx={cx} cy={cy} r={50} fill={C.teal} opacity={0.18} />
        <GlyphAt kind="home" x={cx} y={cy} size={70} color={C.teal} />
      </g>
      {needs.map((k, i) => {
        const at = 7.6 + i * 0.45;
        const p = ramp(t, at, at + 0.35);
        const pop = t > at ? 1 + 0.25 * Math.sin(Math.min(1, (t - at) / 0.35) * Math.PI) : 0;
        const ang = (i / needs.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6;
        const x = cx + Math.cos(ang) * R * 0.66;
        const y = cy + Math.sin(ang) * R * 0.66;
        return (
          <g key={k} opacity={p} transform={`translate(${x} ${y}) scale(${pop}) translate(${-x} ${-y})`}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={C.teal} strokeWidth={2} strokeDasharray="3 7" opacity={0.7} />
            <circle cx={x} cy={y} r={44} fill={C.night} stroke={C.teal} strokeWidth={3} />
            <GlyphAt kind={k} x={x} y={y} size={52} color={C.white} />
          </g>
        );
      })}
    </svg>
  );
};
