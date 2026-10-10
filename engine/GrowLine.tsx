// REUSE_CHECKED: 1_social/py/video-gen/engine/chartStory.tsx (fixed dot-to-cards chain, no log axis or source line, so not reusable for a sourced series), engine/beat.tsx (useBeat/useBrand/useSeconds/useCrispSeconds), engine/growLineMath.js (this round), engine/fonts.ts.
// Growing line on a log y axis with a source line on every beat. A scene beat carries the series and the reveal window; the line is drawn from the first point up to a tip that moves from reveal.from to reveal.to
// over the draw window (fractions of the beat), so the same series can be split across narrated beats and each beat starts where the last one stopped.
// While the tip moves, a dashed level line runs across the plot at the tip height so the value can be read against the log scale; its dashes drift, so a held beat never freezes.
// The line, trend and tip are drawn on the raw clock (they keep their blur); text, markers and callouts on the crisp clock.
import React from "react";
import { useVideoConfig } from "remotion";
import { useBeat, useBrand, useCrispSeconds, useScene, useSeconds } from "./beat";
import { countValue } from "./countValue.js";
import { FONT } from "./fonts";
import { arrivalAlpha, clamp01, layoutFor, logY, pathOf, pointX, sci, smooth, statEnters, statOpacity, tipIndex, visiblePoints } from "./growLineMath.js";

type Place = "above-left" | "above-right" | "below-right" | "left";
type Point = { label: string; value: number; tier: "filled" | "ring" | null };
type Callout = { idx: number; place: Place; title: string; sub?: string; in?: [number, number] };
type GrowBeat = {
  title: string; sub: string; source: string; stat?: { text: string; note: string; count?: { to: number; start: number; end: number } };
  series: Point[]; yDomain: [number, number]; ticks: number[]; yLabel: string;
  reveal: { from: number; to: number }; draw: [number, number]; callouts?: Callout[];
  trend?: { label: string; draw: [number, number] }; legend?: { filled: string; ring: string; in: [number, number] };
};

const PAD_X = 70; // px at k = 1: space between the axis and the first and last point
const MARKER_R = 11;
const LINE_W = 6;
const STAT_PX = 120;
const TITLE_PX = 44;
const SUB_PX = 26;
const TICK_PX = 26;
const YEAR_PX = 28;
const CALL_TITLE_PX = 30;
const CALL_SUB_PX = 24;
const SOURCE_PX = 24;
const GAP = 22;
const MARCH_PX_PER_S = 110; // dash drift along the trend line, px per second at k = 1: the trend reads as live and the frame never sits dead
const LEGEND_ROW_GAP = 44;

const Sci: React.FC<{ v: number; size: number }> = ({ v, size }) => {
  const { m, e } = sci(v);
  return (<>{m} × 10<tspan fontSize={size * 0.62} dy={-size * 0.38}>{e}</tspan><tspan dy={size * 0.38}> FLOP</tspan></>);
};

export const GrowLine: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const scene = useScene();
  const beat = useBeat() as unknown as GrowBeat & { start: number; end: number; pace?: number };
  const raw = useSeconds();
  const crisp = useCrispSeconds();
  const c = brand.colors;
  const L = layoutFor(W, H);
  const k = L.k;
  const { left, right, top, bottom } = L.chart;
  const [lo, hi] = beat.yDomain;
  const n = beat.series.length;
  const dur = (beat.end - beat.start) / (beat.pace ?? 1);
  const fracRaw = raw / dur;
  const fracCrisp = crisp / dur;
  const px = (i: number) => pointX(i, n, left, right, PAD_X * k);
  const py = (v: number) => logY(v, lo, hi, top, bottom);
  const pts: [number, number][] = beat.series.map((s, i) => [px(i), py(s.value)]);
  const tip = tipIndex(beat.reveal.from, beat.reveal.to, smooth(fracRaw, beat.draw[0], beat.draw[1]));
  const tipCrisp = tipIndex(beat.reveal.from, beat.reveal.to, smooth(fracCrisp, beat.draw[0], beat.draw[1]));
  const line = visiblePoints(pts, tip);
  const tr = beat.trend;
  const trendP = tr ? smooth(fracRaw, tr.draw[0], tr.draw[1]) : 0;
  const a = pts[0];
  const b = pts[n - 1];
  const font = { fontFamily: FONT } as const;

  const callout = (cl: Callout) => {
    const alpha = cl.in ? clamp01(smooth(fracCrisp, cl.in[0], cl.in[1])) : arrivalAlpha(tipCrisp, cl.idx);
    if (alpha <= 0) return null;
    const [x, y] = pts[cl.idx];
    const s = beat.series[cl.idx];
    const anchor = cl.place === "above-left" || cl.place === "left" ? "end" : "start";
    const dx = (anchor === "end" ? -1 : 1) * GAP * k;
    const ty = cl.place === "left" ? y - 4 * k : cl.place === "below-right" ? y + (GAP + CALL_TITLE_PX * 0.6) * k : y - (GAP + CALL_SUB_PX + 8) * k;
    const halo = { stroke: c.paper, strokeWidth: 7 * k, paintOrder: "stroke" as const };
    return (
      <g key={cl.idx} opacity={alpha}>
        <text x={x + dx} y={ty} textAnchor={anchor} fontSize={CALL_TITLE_PX * k} fontWeight={600} fill={c.ink} {...halo} {...font}>{cl.title}</text>
        <text x={x + dx} y={ty + (CALL_SUB_PX + 8) * k} textAnchor={anchor} fontSize={CALL_SUB_PX * k} fontWeight={500} fill={c.inkSoft} {...halo} {...font}><Sci v={s.value} size={CALL_SUB_PX * k} /></text>
      </g>
    );
  };

  const legend = beat.legend;
  const legendA = legend ? smooth(fracCrisp, legend.in[0], legend.in[1]) : 0;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, background: brand.background, ...font }}>
      <rect width={W} height={H} fill={brand.background} />
      <text x={L.title.x} y={L.title.y} fontSize={TITLE_PX * k} fontWeight={600} fill={c.ink} {...font}>{beat.title}</text>
      <text x={L.sub.x} y={L.sub.y} fontSize={SUB_PX * k} fontWeight={500} fill={c.inkSoft} {...font}>{beat.sub}</text>
      {beat.stat && (
        <g opacity={statOpacity(crisp, statEnters(scene.beats as unknown as { stat?: { text: string; note: string; count?: unknown } }[], beat.n))}>
          <text x={L.stat.x} y={L.stat.y} textAnchor={L.stat.anchor as "start" | "end"} fontSize={STAT_PX * k} fontWeight={600} fill={c.accent} {...font}>{beat.stat.count ? `${countValue(crisp, { from: 0, ...beat.stat.count }).toLocaleString("en-US")}${beat.stat.text.slice(-1)}` : beat.stat.text}</text>
          <text x={L.stat.x} y={L.stat.y + 34 * k} textAnchor={L.stat.anchor as "start" | "end"} fontSize={SUB_PX * k} fontWeight={500} fill={c.inkSoft} {...font}>{beat.stat.note}</text>
        </g>
      )}
      {beat.ticks.map((e) => {
        const y = logY(10 ** e, lo, hi, top, bottom);
        return (
          <g key={e}>
            <line x1={left} x2={right} y1={y} y2={y} stroke={c.line} strokeWidth={2 * k} />
            <text x={left - 16 * k} y={y + 9 * k} textAnchor="end" fontSize={TICK_PX * k} fontWeight={500} fill={c.inkSoft} {...font}>10<tspan fontSize={TICK_PX * 0.62 * k} dy={-TICK_PX * 0.38 * k}>{e}</tspan>{e === Math.max(...beat.ticks) ? <tspan dy={TICK_PX * 0.38 * k}> {beat.yLabel}</tspan> : null}</text>
          </g>
        );
      })}
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke={c.inkSoft} strokeWidth={2 * k} />
      {beat.series.map((s, i) => (
        <text key={i} x={px(i)} y={bottom + 44 * k} textAnchor="middle" fontSize={YEAR_PX * k} fontWeight={500} fill={c.ink} {...font}>
          {s.label.split("|")[0]}
          {s.label.includes("|") ? <tspan x={px(i)} dy={YEAR_PX * 0.95 * k} fontSize={YEAR_PX * 0.72 * k} fill={c.inkSoft}>{s.label.split("|")[1]}</tspan> : null}
        </text>
      ))}
      {line.length > 0 && beat.reveal.from !== beat.reveal.to && (
        <line x1={left} x2={right} y1={line[line.length - 1][1]} y2={line[line.length - 1][1]} stroke={c.inkSoft} strokeWidth={3 * k} strokeDasharray={`${10 * k} ${10 * k}`} strokeDashoffset={-raw * MARCH_PX_PER_S * k} opacity={0.75} />
      )}
      {tr && trendP > 0 && (
        <g>
          <line x1={a[0]} y1={a[1]} x2={a[0] + (b[0] - a[0]) * trendP} y2={a[1] + (b[1] - a[1]) * trendP} stroke={c.action} strokeWidth={4 * k} strokeDasharray={`${14 * k} ${12 * k}`} strokeDashoffset={-raw * MARCH_PX_PER_S * k} strokeLinecap="round" />
          <text x={a[0] + (b[0] - a[0]) * 0.52 + 26 * k} y={a[1] + (b[1] - a[1]) * 0.52 + 62 * k} fontSize={CALL_TITLE_PX * k} fontWeight={600} fill={c.action} opacity={smooth(fracCrisp, tr.draw[0] + 0.25, tr.draw[1])} stroke={c.paper} strokeWidth={7 * k} paintOrder="stroke" {...font}>{tr.label}</text>
        </g>
      )}
      {line.length > 1 && <path d={pathOf(line)} fill="none" stroke={c.accent} strokeWidth={LINE_W * k} strokeLinejoin="round" strokeLinecap="round" />}
      {beat.series.map((s, i) => {
        if (!s.tier) return null;
        const al = arrivalAlpha(tipCrisp, i);
        if (al <= 0) return null;
        const r = MARKER_R * k;
        return s.tier === "filled"
          ? <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r={r} fill={c.accent} opacity={al} />
          : <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r={r} fill={c.paper} stroke={c.accent} strokeWidth={4 * k} opacity={al} />;
      })}
      {(beat.callouts ?? []).map(callout)}
      {legend && legendA > 0 && (
        <g opacity={legendA}>
          <circle cx={left + 14 * k} cy={bottom + 112 * k} r={MARKER_R * k} fill={c.accent} />
          <text x={left + 40 * k} y={bottom + 121 * k} fontSize={CALL_SUB_PX * k} fontWeight={500} fill={c.ink} {...font}>{legend.filled}</text>
          <circle cx={left + 14 * k} cy={bottom + (112 + LEGEND_ROW_GAP) * k} r={MARKER_R * k} fill={c.paper} stroke={c.accent} strokeWidth={4 * k} />
          <text x={left + 40 * k} y={bottom + (121 + LEGEND_ROW_GAP) * k} fontSize={CALL_SUB_PX * k} fontWeight={500} fill={c.ink} {...font}>{legend.ring}</text>
        </g>
      )}
      <text x={L.source.x} y={L.source.y} fontSize={SOURCE_PX * k} fontWeight={500} fill={c.inkSoft} {...font}>{beat.source}</text>
    </svg>
  );
};
