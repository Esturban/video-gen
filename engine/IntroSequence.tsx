// REUSE_CHECKED: 1_social/py/video-gen/engine/GrowLine.tsx (same svg-per-beat shape and clock split: raw clock for the drawn line, crisp clock for text), 1_social/py/video-gen/engine/beat.tsx (useBeat/useBrand/useSeconds/useCrispSeconds), 1_social/py/video-gen/engine/fonts.ts, 1_social/py/video-gen/engine/brandSlot.tsx (signature overlay is a corner tag, not an opening, so not reusable here).
// The branded opening for every EV Advisory video (CMO-8170): one continuous 5 to 8 s motion piece, silent. A chart grid draws in, an accent trend line climbs across the lower band,
// the wordmark wipes in, a rule extends under it, the byline settles, and the piece fades to paper. The right side holds a reserved frame for a head (beat.head null = quiet placeholder).
// Beat fields: wordmark (default "EV Advisory"), byline (default "Esteban V."), series (optional label, e.g. "Episode 03"), head (null or a path inside the scene's assets/).
import React from "react";
import { Img, staticFile, useVideoConfig } from "remotion";
import { useBeat, useBrand, useCrispSeconds, useSeconds } from "./beat";
import { FONT } from "./fonts";
import { introState, layoutFor, pathOf, trendPoints, visibleTrend } from "./introMath.js";

type IntroBeat = { start: number; end: number; pace?: number; wordmark?: string; byline?: string; series?: string | null; head?: string | null };

const LINE_W = 6;
const GRID_W = 2;
const TIP_R = 13;
const RING_GROW = 2.4; // tip ring reaches this many tip radii before it fades
const SERIES_TRACK_EM = 0.18;
const BYLINE_TRACK_EM = 0.08;
const RISE_PX = 34; // wordmark rises this far while it wipes in
const SHEEN_W = 0.16; // sheen length as a fraction of the rule

export const IntroSequence: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const beat = useBeat() as unknown as IntroBeat;
  const raw = useSeconds();
  const crisp = useCrispSeconds();
  const c = brand.colors;
  const L = layoutFor(W, H);
  const k = L.k;
  const dur = (beat.end - beat.start) / (beat.pace ?? 1);
  const s = introState(raw / dur, dur); // blurred clock: grid, line, tip, ring
  const t = introState(crisp / dur, dur); // crisp clock: text, rule, head frame
  const font = { fontFamily: FONT } as const;

  const wordmark = beat.wordmark ?? "EV Advisory";
  const [first, ...rest] = wordmark.split(" ");
  const byline = beat.byline ?? "Esteban V.";
  const pts = trendPoints(L.band);
  const vis = visibleTrend(pts, s.trend);
  const tip = vis[vis.length - 1];
  const head = L.head;
  const wipeW = (L.rule.len + 30 * k) * t.wordmark;
  const ruleX2 = L.rule.x + L.rule.len * t.rule;
  const sheenA = L.rule.x + (L.rule.len * (1 + SHEEN_W)) * t.sheen - L.rule.len * SHEEN_W;
  const sheenX1 = Math.max(L.rule.x, sheenA);
  const sheenX2 = Math.min(L.rule.x + L.rule.len, sheenA + L.rule.len * SHEEN_W);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, background: brand.background, ...font }}>
      <defs>
        <clipPath id="intro-wordmark"><rect x={L.left - 10 * k} y={L.wordBase - L.wordSize * 1.05} width={Math.max(0, wipeW)} height={L.wordSize * 1.35} /></clipPath>
      </defs>
      <rect width={W} height={H} fill={brand.background} />
      <g opacity={s.exit}>
        {L.gridYs.map((y, i) => (
          <line key={i} x1={L.margin} x2={L.margin + (W - 2 * L.margin) * s.grid[i]} y1={y} y2={y} stroke={c.line} strokeWidth={GRID_W * k} />
        ))}
        {vis.length > 1 && <path d={pathOf(vis)} fill="none" stroke={c.accent} strokeWidth={LINE_W * k} strokeLinejoin="round" strokeLinecap="round" />}
        {s.trend > 0 && <circle cx={tip[0]} cy={tip[1]} r={TIP_R * k} fill={c.accent} />}
        {s.ringOn > 0 && <circle cx={tip[0]} cy={tip[1]} r={TIP_R * k * (1 + (RING_GROW - 1) * s.ring)} fill="none" stroke={c.accent} strokeWidth={3 * k} opacity={s.ringOn * (1 - s.ring) * 0.8} />}
      </g>
      <g opacity={t.exit}>
        <g opacity={t.head}>
          <circle cx={head.cx} cy={head.cy} r={head.r * (0.9 + 0.1 * t.head)} fill={c.accentSoft} fillOpacity={0.5} stroke={c.line} strokeWidth={3 * k} />
          <circle cx={head.cx} cy={head.cy} r={head.r * 0.86 * (0.9 + 0.1 * t.head)} fill="none" stroke={c.line} strokeWidth={2 * k} />
          {beat.head && (
            <>
              <clipPath id="intro-head"><circle cx={head.cx} cy={head.cy} r={head.r * (0.9 + 0.1 * t.head)} /></clipPath>
              <Img src={staticFile(beat.head)} x={head.cx - head.r} y={head.cy - head.r} width={head.r * 2} height={head.r * 2} style={{ objectFit: "cover" }} />
            </>
          )}
        </g>
        {beat.series && (
          <text x={L.series.x} y={L.series.y} fontSize={L.series.size} fontWeight={600} letterSpacing={L.series.size * SERIES_TRACK_EM} fill={c.accent} opacity={t.series} {...font}>{beat.series.toUpperCase()}</text>
        )}
        <g clipPath="url(#intro-wordmark)">
          <text x={L.left} y={L.wordBase + RISE_PX * k * (1 - t.wordmark)} fontSize={L.wordSize} fontWeight={600} letterSpacing={-L.wordSize * 0.02} fill={c.ink} {...font}>
            <tspan fill={c.accent}>{first}</tspan>
            {rest.length > 0 && <tspan> {rest.join(" ")}</tspan>}
          </text>
        </g>
        <line x1={L.rule.x} x2={ruleX2} y1={L.rule.y} y2={L.rule.y} stroke={c.ink} strokeWidth={4 * k} strokeLinecap="round" />
        {t.sheen > 0 && sheenX2 > sheenX1 && <line x1={sheenX1} x2={sheenX2} y1={L.rule.y} y2={L.rule.y} stroke={c.accent} strokeWidth={4 * k} strokeLinecap="round" />}
        <text x={L.byline.x} y={L.byline.y} fontSize={L.byline.size} fontWeight={500} letterSpacing={L.byline.size * BYLINE_TRACK_EM} fill={c.inkSoft} opacity={t.byline} {...font}>{byline}</text>
      </g>
    </svg>
  );
};
