// REUSE_CHECKED: 1_social/py/video-gen/engine/chartStoryMath.js (the whole chain as pure maths), engine/parallaxMath.js, engine/bentoMath.js and engine/beat.tsx (our own). Method reference only: Remocn/remocn (MIT) charts and bento-pan for the look.
// Renders the data-story chain from chartStoryMath.js: ONE svg whose viewBox IS the camera, so panning and zooming are exact, frame-derived and never a CSS transition.
// Two clocks: the raw clock drives the MORPHING SHAPES (they keep their motion blur); the crisp clock (every blur subframe of one output frame reads the same time) drives the camera, digits and text, so nothing that is read can ghost.
import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { useCrispSeconds, useSeconds } from "./beat";
import { buildStory } from "./chartStoryMath.js";
import { viewBoxFor } from "./cameraMath.js";
import { polyPath } from "./morphMath.js";
import { driftOffset, layerShift, motes } from "./parallaxMath.js";

export type StoryColors = { accent: string; ink: string; inkSoft: string; card: string; line: string; paper: string };
export type StoryConfig = {
  values: number[]; labels: string[]; endValue?: number; cards?: { label: string; share: number }[];
  tl: Record<string, [number, number]>; camera: number[][]; layout?: Record<string, Record<string, number>>;
  ringInnerLag?: number; splitStagger?: number; curves?: Record<string, string>;
  bentoTitles?: [string, string];
};

const GRID = 90; // world px between background dots
const GRID_EXTENT = [-2400, 5200] as const;
const NUMBER_FONT_PX = 124;
const CARD_VALUE_PX = 64;
const CARD_LABEL_PX = 28;
const LABEL_PX = 30;
const TILE_TITLE_PX = 26;
const TILE_LABEL_PX = 22;
const BAR_H = 14;
const BENTO_TITLES: [string, string] = ["Share of total", "Running total"];

// Parallax layers: factor 1 sits in the world with the chart, below 1 is far, above 1 is near. Drift is px per second, slow on purpose.
const FAR = { factor: 0.45, drift: [-7, 3] as [number, number], count: 9, box: { x0: -900, y0: -1100, x1: 3200, y1: 1100 }, size: { minR: 170, maxR: 360 }, opacity: 0.4 };
const GRID_LAYER = { factor: 0.8, drift: [5, 0] as [number, number] };
const NEAR = { factor: 1.35, drift: [9, -4] as [number, number], count: 26, box: { x0: -900, y0: -1000, x1: 4300, y1: 1000 }, size: { minR: 5, maxR: 12 }, opacity: 0.2 };
const FAR_MOTES = motes(FAR.count, FAR.box, FAR.size);
const NEAR_MOTES = motes(NEAR.count, NEAR.box, NEAR.size);

const fmt = (n: number) => n.toLocaleString("en-US");
const pts = (p: number[][]) => p.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(" ");

export const ChartStory: React.FC<{ config: StoryConfig; colors: StoryColors; fontFamily: string }> = ({ config, colors, fontFamily }) => {
  const { width, height } = useVideoConfig();
  const raw = useSeconds();
  const crisp = useCrispSeconds();
  const story = useMemo(() => buildStory({ ...config, colors }), [config, colors]);
  const shape = story.at(raw); // morphing shapes: blurred like everything else
  const s = story.at(crisp); // camera and everything that is read: identical in every subframe of an output frame
  const cam = s.camera;
  const titles = config.bentoTitles ?? BENTO_TITLES;
  const [farDx, farDy] = [...layerShift(cam, FAR.factor)].map((v, i) => v + driftOffset(crisp, FAR.drift)[i]);
  const [gridDx, gridDy] = [...layerShift(cam, GRID_LAYER.factor)].map((v, i) => v + driftOffset(crisp, GRID_LAYER.drift)[i]);
  const [nearDx, nearDy] = [...layerShift(cam, NEAR.factor)].map((v, i) => v + driftOffset(crisp, NEAR.drift)[i]);
  const bento = s.bento;
  const bentoShape = shape.bento;
  return (
    <svg width={width} height={height} viewBox={viewBoxFor(cam, width, height)} style={{ position: "absolute", inset: 0, fontFamily }}>
      <defs>
        <pattern id="story-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse" patternTransform={`translate(${gridDx} ${gridDy})`}><circle cx={GRID / 2} cy={GRID / 2} r={2.4} fill={colors.line} /></pattern>
        <filter id="story-soft" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="22" /></filter>
        <clipPath id="story-num-clip"><path d={polyPath(s.number.clip)} /></clipPath>
      </defs>

      <g transform={`translate(${farDx} ${farDy})`} opacity={FAR.opacity}>
        {FAR_MOTES.map((m, i) => <circle key={`far${i}`} cx={m.x} cy={m.y} r={m.r} fill="none" stroke={colors.line} strokeWidth={3} />)}
      </g>
      <rect x={GRID_EXTENT[0]} y={GRID_EXTENT[0]} width={GRID_EXTENT[1] - GRID_EXTENT[0]} height={GRID_EXTENT[1] - GRID_EXTENT[0]} fill="url(#story-dots)" opacity={0.9} />

      {s.baseline.opacity > 0.001 ? <line x1={s.baseline.x0} x2={s.baseline.x1} y1={s.baseline.y} y2={s.baseline.y} stroke={colors.inkSoft} strokeOpacity={0.45 * s.baseline.opacity} strokeWidth={3} strokeLinecap="round" /> : null}
      {s.labels.map((l) => (l.opacity > 0.001 ? <text key={l.text} x={l.x} y={l.y} textAnchor="middle" fontSize={LABEL_PX} fontWeight={500} fill={colors.inkSoft} opacity={l.opacity}>{l.text}</text> : null))}

      {bentoShape ? bentoShape.tiles.map((tile, i) => (tile.visible ? (
        <g key={`tile${i}`}>
          <path d={polyPath(tile.poly)} fill={colors.ink} opacity={0.1 * tile.shadow} filter="url(#story-soft)" transform="translate(0 24)" />
          <path d={polyPath(tile.poly)} fill={colors.card} stroke={colors.line} strokeWidth={2.5} />
        </g>
      ) : null)) : null}

      {shape.wedges.map((w, i) => (w.visible ? <path key={`w${i}`} d={polyPath(w.poly)} fill={w.fill} /> : null))}

      {shape.cards.map((c, j) => (
        <g key={`c${j}`}>
          <path d={polyPath(c.poly)} fill={colors.ink} opacity={0.12 * c.shadow} filter="url(#story-soft)" transform="translate(0 26)" />
          <path d={polyPath(c.poly)} fill={c.fill} stroke={colors.line} strokeWidth={2.5} strokeOpacity={c.outline} />
        </g>
      ))}

      <g transform={`translate(${nearDx} ${nearDy})`} opacity={NEAR.opacity}>
        {NEAR_MOTES.map((m, i) => <circle key={`near${i}`} cx={m.x} cy={m.y} r={m.r} fill={colors.accent} />)}
      </g>

      {s.number.opacity > 0.001 ? (
        <g clipPath="url(#story-num-clip)">
          <text x={s.number.x} y={s.number.y} textAnchor="middle" dominantBaseline="central" fontSize={NUMBER_FONT_PX} fontWeight={600} fill={colors.card} opacity={s.number.opacity} style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1', letterSpacing: "-0.01em" }}>{fmt(s.number.value)}</text>
        </g>
      ) : null}

      {s.cardContent.map((c, j) => {
        if (c.opacity < 0.001) return null;
        const w = story.layout.cards.width;
        const h = story.layout.cards.height;
        const trackW = w - 48;
        return (
          <g key={`t${j}`} opacity={c.opacity}>
            <text x={c.x} y={c.y - h / 2 + 70} textAnchor="middle" fontSize={CARD_LABEL_PX} fontWeight={500} fill={colors.inkSoft}>{c.label}</text>
            <text x={c.x} y={c.y + 10} textAnchor="middle" dominantBaseline="central" fontSize={CARD_VALUE_PX} fontWeight={600} fill={colors.ink} style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1' }}>{c.value}%</text>
            <rect x={c.x - trackW / 2} y={c.y + h / 2 - 66} width={trackW} height={BAR_H} rx={BAR_H / 2} fill={colors.line} />
            <rect x={c.x - trackW / 2} y={c.y + h / 2 - 66} width={Math.max(0.001, trackW * c.bar)} height={BAR_H} rx={BAR_H / 2} fill={colors.accent} />
          </g>
        );
      })}

      {bento && bentoShape ? (
        <g>
          {bento.stack.title.opacity > 0.001 ? <text x={bento.stack.title.x} y={bento.stack.title.y} fontSize={TILE_TITLE_PX} fontWeight={500} fill={colors.inkSoft} opacity={bento.stack.title.opacity}>{titles[0]}</text> : null}
          {bento.stack.segments.map((sg, j) => (
            <g key={`sg${j}`}>
              {sg.visible ? <path d={polyPath(sg.poly)} fill={sg.fill} /> : null}
              {sg.label.opacity > 0.001 ? <text x={sg.label.x} y={sg.label.y} textAnchor="middle" fontSize={TILE_LABEL_PX} fontWeight={500} fill={colors.inkSoft} opacity={sg.label.opacity}>{sg.label.text}</text> : null}
            </g>
          ))}
          {bento.area.title.opacity > 0.001 ? (
            <g opacity={bento.area.opacity}>
              <text x={bento.area.title.x} y={bento.area.title.y} fontSize={TILE_TITLE_PX} fontWeight={500} fill={colors.inkSoft}>{titles[1]}</text>
              <line x1={bento.area.x0} x2={bento.area.x1} y1={bento.area.baseY} y2={bento.area.baseY} stroke={colors.line} strokeWidth={3} strokeLinecap="round" />
              {bento.area.area.length > 2 ? <polygon points={pts(bento.area.area)} fill={colors.accent} opacity={0.14} /> : null}
              {bento.area.line.length > 1 ? <polyline points={pts(bento.area.line)} fill="none" stroke={colors.accent} strokeWidth={bento.area.stroke} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {bento.area.tip ? <circle cx={bento.area.tip[0]} cy={bento.area.tip[1]} r={bento.area.tipR} fill={colors.accent} stroke={colors.card} strokeWidth={3} /> : null}
            </g>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
};
