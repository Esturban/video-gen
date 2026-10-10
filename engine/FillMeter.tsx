// REUSE_CHECKED: data-story-morph DataStory (overlay layout, Geist loader, warm radial ground) and video-gen engine parts
//   @video/engine/morph (roundedRectPoly, circlePoly, morphPoly, polyPath, mixRgb, driftOffset), @video/engine/motion (eased, tween),
//   @video/engine/counter (countValue) and beat.tsx (useCrispSeconds). ChartStory's fixed chain has no fill meter, so the one-bar meter is drawn here from those parts. Promoted from the llm-injection-morph scene (CMO-7537).
// One tall rounded bar carries the whole video: fill height, tone (alert to brand) and the numeral inside it all move between states, never cut.
// Two clocks, as in ChartStory: shapes use the raw clock (they keep motion blur) except the fill level, which crosses the numeral; every digit and line of text uses the crisp clock so nothing that is read can ghost.
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { progress, useBeat, useBrand, useCrispSeconds, useSeconds } from "./beat";
import { countValue } from "./counter";
import { circlePoly, driftOffset, mixRgb, morphPoly, polyPath, rgbCss, roundedRectPoly } from "./morph";
import { eased, tween } from "./motion";
import { FONT } from "./fonts";

const MARGIN = 64; // px: same safe margin as the brand slot
const HEADLINE_PX = 58;
const LABEL_PX = 44; // two lines: model and benchmark, then the figures and table; legible on a 390 px phone downscale
const LEGEND_PX = 36;
const NUMERAL_PX = 128;
const GHOST_PX = 64;
const BAR = { cx: 720, top: 420, bottom: 1200, width: 400, radius: 56 };
const TAG = { gap: 26, width: 8 };
const DOT_R = 16;
const CARD = { cx: 720, cy: 720, w: 1200, h: 700, r: 40, pad: 90 };
const CAVEAT_PX = 40;
const POLY_SIDES = 240; // points per side for track, dot and card: high enough that corners read round, not faceted
const GRID = 90;
const GRID_DRIFT: [number, number] = [6, -3]; // px per second: keeps held frames alive without moving the content
const GHOST_SLIDE = 90; // px the ghost numeral slides right as it leaves

type Step = { from: string; to: string; start: number; end: number };
type Change = { at: number; dur: number; to: number };
type TextBlock = { in: [number, number]; out: [number, number]; headline: string; label: string };
type Ghost = { value: string; in: [number, number]; out: [number, number] };
type MeterBeat = {
  legend: { text: string; out: [number, number] };
  texts: TextBlock[]; steps: Step[]; tone: Change[]; tag: Change[]; ghosts: Ghost[];
  close: { shrink: [number, number]; open: [number, number]; textIn: [number, number]; framing: string; title: string; ref: string; caveat: string };
};

const tenths = (s: string) => Math.round(Number(s) * 10);
const barHeight = BAR.bottom - BAR.top;
const levelY = (pct: number) => BAR.bottom - (barHeight * pct) / 100;

/** Step that owns time t: the last one whose start has passed (or the first, before anything starts). */
const stepAt = (steps: Step[], t: number) => steps.reduce((cur, s) => (t >= s.start ? s : cur), steps[0]);

/** Fill percent on the raw clock: same easing as countValue, so bar and numeral agree. */
const fillAt = (steps: Step[], t: number) => {
  const s = stepAt(steps, t);
  const [a, b] = [Number(s.from), Number(s.to)];
  return a + (b - a) * progress(t, s.start, s.end);
};

/** Numeral on the crisp clock, counted in whole tenths; it lands on the figure exactly as printed in the paper. */
const numeralAt = (steps: Step[], t: number) => {
  const s = stepAt(steps, t);
  const v = countValue(t, { from: tenths(s.from), to: tenths(s.to), start: s.start, end: s.end });
  if (v === tenths(s.to)) return s.to;
  if (v === tenths(s.from)) return s.from;
  return (v / 10).toFixed(1);
};

/** Opacity of a block that fades in over `inn` and out over `out`. A zero-length `in` window means visible from frame 0. */
const blockOpacity = (t: number, inn: [number, number], out: [number, number]) =>
  (inn[1] <= inn[0] ? 1 : eased(t, inn[0], inn[1])) * (1 - eased(t, out[0], out[1]));

export const FillMeter: React.FC = () => {
  const raw = useSeconds();
  const t = useCrispSeconds();
  const brand = useBrand();
  const beat = useBeat() as unknown as MeterBeat;
  const c = brand.colors;
  const close = beat.close;

  const shapes = useMemo(() => ({
    track: roundedRectPoly(BAR.cx, (BAR.top + BAR.bottom) / 2, BAR.width, barHeight, BAR.radius, POLY_SIDES),
    dot: circlePoly(CARD.cx, CARD.cy, DOT_R, POLY_SIDES),
    card: roundedRectPoly(CARD.cx, CARD.cy, CARD.w, CARD.h, CARD.r, POLY_SIDES),
  }), []);

  const shrink = eased(raw, close.shrink[0], close.shrink[1], "easeInOutCubic");
  const open = eased(raw, close.open[0], close.open[1], "easeInOutCubic");
  const shape = morphPoly(morphPoly(shapes.track, shapes.dot, shrink), shapes.card, open);
  const trackColor = rgbCss(mixRgb(mixRgb(mixRgb(c.paper, c.line, 0.6), c.accent, shrink), c.card, open));

  const tone = tween(raw, 0, beat.tone);
  const fillColor = rgbCss(mixRgb(c.action, c.accent, tone));
  // Fill level on the crisp clock: its edge crosses the numeral, so it must not motion-blur into a pale strip over the digits.
  const fillPct = fillAt(beat.steps, t);
  const fillTop = levelY(fillPct);
  const meterAlpha = 1 - shrink;

  const tagDraw = tween(raw, 0, beat.tag) * (1 - shrink);
  const tagX = BAR.cx - BAR.width / 2 - TAG.gap;

  const numeral = numeralAt(beat.steps, t);
  const numeralAlpha = 1 - eased(t, close.shrink[0], close.shrink[0] + 0.3);
  const numeralY = (BAR.top + BAR.bottom) / 2;
  const [gx, gy] = driftOffset(raw, GRID_DRIFT);

  const numeralText = (fill: string) => (
    <text x={BAR.cx} y={numeralY} textAnchor="middle" dominantBaseline="central" fontSize={NUMERAL_PX} fontWeight={600} fill={fill}
      style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1', letterSpacing: "-0.02em" }}>
      {numeral}<tspan fontSize={NUMERAL_PX * 0.5} dx={6}>%</tspan>
    </text>
  );

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, #ffffff 0%, ${brand.background} 100%)`, fontFamily: FONT, color: c.ink, WebkitFontSmoothing: "antialiased" }}>
      <svg width={1440} height={1440} viewBox="0 0 1440 1440" style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
        <defs>
          <pattern id="meter-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse" patternTransform={`translate(${gx} ${gy})`}><circle cx={GRID / 2} cy={GRID / 2} r={2.4} fill={c.line} /></pattern>
          <clipPath id="meter-track"><path d={polyPath(shape)} /></clipPath>
          <clipPath id="meter-fill"><rect x={0} y={fillTop} width={1440} height={Math.max(0, BAR.bottom - fillTop)} /></clipPath>
        </defs>
        <rect x={-200} y={-200} width={1840} height={1840} fill="url(#meter-dots)" opacity={0.9} />

        <path d={polyPath(shape)} fill={trackColor} stroke={c.line} strokeWidth={2.5} strokeOpacity={open} />

        {meterAlpha > 0.001 ? (
          <g clipPath="url(#meter-track)" opacity={meterAlpha}>
            {beat.ghosts.map((g) => {
              const a = blockOpacity(t, g.in, g.out);
              return a > 0.001 ? <rect key={`band${g.value}`} x={0} y={levelY(Number(g.value))} width={1440} height={BAR.bottom - levelY(Number(g.value))} fill={c.action} opacity={0.16 * a} /> : null;
            })}
            {fillPct > 0.01 ? <rect x={0} y={fillTop} width={1440} height={BAR.bottom - fillTop} fill={fillColor} /> : null}
          </g>
        ) : null}

        {tagDraw > 0.001 ? (
          <line x1={tagX} x2={tagX} y1={BAR.top + 8} y2={BAR.top + 8 + (barHeight - 16) * tagDraw} stroke={c.accent} strokeWidth={TAG.width} strokeLinecap="round" />
        ) : null}

        {numeralAlpha > 0.001 ? (
          <g opacity={numeralAlpha}>
            {numeralText(c.ink)}
            <g clipPath="url(#meter-track)"><g clipPath="url(#meter-fill)">{numeralText(c.card)}</g></g>
          </g>
        ) : null}

        {beat.ghosts.map((g) => {
          const a = blockOpacity(t, g.in, g.out);
          if (a < 0.001) return null;
          const y = levelY(Number(g.value));
          const slide = GHOST_SLIDE * eased(t, g.out[0], g.out[1]);
          const x0 = BAR.cx + BAR.width / 2;
          return (
            <g key={`ghost${g.value}`} opacity={a}>
              <line x1={x0 + 14} x2={x0 + 70} y1={y} y2={y} stroke={c.action} strokeOpacity={0.55} strokeWidth={4} strokeDasharray="8 8" strokeLinecap="round" />
              <text x={x0 + 90 + slide} y={y} dominantBaseline="central" fontSize={GHOST_PX} fontWeight={600} fill={c.action} opacity={0.6}
                style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1' }}>
                {g.value}<tspan fontSize={GHOST_PX * 0.5} dx={4}>%</tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {beat.texts.map((b) => {
        const a = blockOpacity(t, b.in, b.out);
        return a > 0.001 ? (
          <div key={b.headline} style={{ position: "absolute", left: MARGIN, top: MARGIN, right: MARGIN, opacity: a }}>
            <div style={{ fontSize: HEADLINE_PX, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.1 }}>{b.headline}</div>
            {b.label ? <div style={{ marginTop: 18, fontSize: LABEL_PX, fontWeight: 500, color: c.inkSoft, lineHeight: 1.3, whiteSpace: "pre-line" }}>{b.label}</div> : null}
          </div>
        ) : null;
      })}

      <Legend text={beat.legend.text} opacity={1 - eased(t, beat.legend.out[0], beat.legend.out[1])} color={c.inkSoft} dot={c.action} />
      <ClosingText close={close} opacity={eased(t, close.textIn[0], close.textIn[1])} colors={c} />
    </AbsoluteFill>
  );
};

const Legend: React.FC<{ text: string; opacity: number; color: string; dot: string }> = ({ text, opacity, color, dot }) => (opacity > 0.001 ? (
  <div style={{ position: "absolute", left: MARGIN, bottom: MARGIN + 6, fontSize: LEGEND_PX, fontWeight: 500, color, opacity, display: "flex", alignItems: "center", gap: 12 }}>
    <span style={{ width: 12, height: 12, borderRadius: 6, background: dot, display: "inline-block" }} />
    {text}
  </div>
) : null);

const ClosingText: React.FC<{ close: MeterBeat["close"]; opacity: number; colors: Record<string, string> }> = ({ close, opacity, colors }) => (opacity > 0.001 ? (
  <>
    <div style={{
      position: "absolute", left: CARD.cx - CARD.w / 2 + CARD.pad, top: CARD.cy - CARD.h / 2, width: CARD.w - 2 * CARD.pad, height: CARD.h,
      display: "flex", flexDirection: "column", justifyContent: "center", opacity,
    }}>
      <div style={{ fontSize: 38, fontWeight: 500, color: colors.inkSoft, lineHeight: 1.3 }}>{close.framing}</div>
      <div style={{ marginTop: 40, fontSize: 60, fontWeight: 600, color: colors.ink, lineHeight: 1.18, letterSpacing: "-0.015em" }}>{close.title}</div>
      <div style={{ marginTop: 44, fontSize: 46, fontWeight: 600, color: colors.accent, fontVariantNumeric: "tabular-nums" }}>{close.ref}</div>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: CARD.cy + CARD.h / 2 + 44, textAlign: "center", fontSize: CAVEAT_PX, fontWeight: 500, color: colors.inkSoft, opacity }}>{close.caveat}</div>
  </>
) : null);
