// REUSE_CHECKED: 1_social/py/video-gen/engine/chartStoryMath.js (this round, the whole chain as pure maths) and engine/beat.tsx (our own). Method reference only: Remocn/remocn (MIT) charts and bento-pan for the look.
// Renders the data-story chain from chartStoryMath.js: ONE svg whose viewBox IS the camera, so panning and zooming are exact, frame-derived and never a CSS transition.
// Every shape is a single path whose points are interpolated by the maths file; this component only draws what at(t) says.
import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { useSeconds } from "./beat";
import { buildStory } from "./chartStoryMath.js";
import { viewBoxFor } from "./cameraMath.js";
import { polyPath } from "./morphMath.js";

export type StoryColors = { accent: string; ink: string; inkSoft: string; card: string; line: string; paper: string };
export type StoryConfig = {
  values: number[]; labels: string[]; endValue?: number; cards: { label: string; share: number }[];
  tl: Record<string, [number, number]>; camera: number[][]; layout?: Record<string, Record<string, number>>;
  ringInnerLag?: number; splitStagger?: number; curves?: Record<string, string>;
};

const GRID = 90; // world px between background dots
const GRID_EXTENT = [-1800, 4200] as const;
const NUMBER_FONT_PX = 150;
const CARD_VALUE_PX = 76;
const CARD_LABEL_PX = 28;
const LABEL_PX = 30;
const BAR_H = 14;

const fmt = (n: number) => n.toLocaleString("en-US");

export const ChartStory: React.FC<{ config: StoryConfig; colors: StoryColors; fontFamily: string }> = ({ config, colors, fontFamily }) => {
  const { width, height } = useVideoConfig();
  const t = useSeconds();
  const story = useMemo(() => buildStory({ ...config, colors }), [config, colors]);
  const s = story.at(t);
  return (
    <svg width={width} height={height} viewBox={viewBoxFor(s.camera, width, height)} style={{ position: "absolute", inset: 0, fontFamily }}>
      <defs>
        <pattern id="story-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><circle cx={GRID / 2} cy={GRID / 2} r={2.4} fill={colors.line} /></pattern>
        <filter id="story-soft" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <rect x={GRID_EXTENT[0]} y={GRID_EXTENT[0]} width={GRID_EXTENT[1] - GRID_EXTENT[0]} height={GRID_EXTENT[1] - GRID_EXTENT[0]} fill="url(#story-dots)" opacity={0.9} />

      {s.baseline.opacity > 0.001 ? <line x1={s.baseline.x0} x2={s.baseline.x1} y1={s.baseline.y} y2={s.baseline.y} stroke={colors.inkSoft} strokeOpacity={0.45 * s.baseline.opacity} strokeWidth={3} strokeLinecap="round" /> : null}
      {s.labels.map((l) => (l.opacity > 0.001 ? <text key={l.text} x={l.x} y={l.y} textAnchor="middle" fontSize={LABEL_PX} fontWeight={500} fill={colors.inkSoft} opacity={l.opacity}>{l.text}</text> : null))}

      {s.wedges.map((w, i) => (w.visible ? <path key={`w${i}`} d={polyPath(w.poly)} fill={w.fill} /> : null))}

      {s.cards.map((c, j) => (
        <g key={`c${j}`}>
          <path d={polyPath(c.poly)} fill={colors.ink} opacity={0.12 * c.shadow} filter="url(#story-soft)" transform="translate(0 26)" />
          <path d={polyPath(c.poly)} fill={c.fill} stroke={colors.line} strokeWidth={2.5} strokeOpacity={c.outline} />
        </g>
      ))}

      {s.number.opacity > 0.001 ? (
        <text x={s.number.x} y={s.number.y} textAnchor="middle" dominantBaseline="central" fontSize={NUMBER_FONT_PX} fontWeight={600} fill={colors.card} opacity={s.number.opacity} style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(s.number.value)}</text>
      ) : null}

      {s.cardContent.map((c, j) => {
        if (c.opacity < 0.001) return null;
        const w = story.layout.cards.width;
        const h = story.layout.cards.height;
        const trackW = w - 64;
        return (
          <g key={`t${j}`} opacity={c.opacity}>
            <text x={c.x} y={c.y - h / 2 + 70} textAnchor="middle" fontSize={CARD_LABEL_PX} fontWeight={500} fill={colors.inkSoft}>{c.label}</text>
            <text x={c.x} y={c.y + 10} textAnchor="middle" dominantBaseline="central" fontSize={CARD_VALUE_PX} fontWeight={600} fill={colors.ink} style={{ fontVariantNumeric: "tabular-nums" }}>{c.value}%</text>
            <rect x={c.x - trackW / 2} y={c.y + h / 2 - 66} width={trackW} height={BAR_H} rx={BAR_H / 2} fill={colors.line} />
            <rect x={c.x - trackW / 2} y={c.y + h / 2 - 66} width={Math.max(0.001, trackW * c.bar)} height={BAR_H} rx={BAR_H / 2} fill={colors.accent} />
          </g>
        );
      })}
    </svg>
  );
};
