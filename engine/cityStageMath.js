// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/parts.tsx   rgbOf/alpha and the heat/ramp/pulse maths lifted from that scene (and its stagesB.tsx) unchanged in output; colorMath.js mixRgb works on rgb arrays, not the brand-hex ramp these stages need
// Pure maths for the tool-stage parts (ToolStageFrame, CityMapStages, CityFlowStages, CaseCard, ExampleGrid, LoopHandoff, TitleCard).
// Everything here is a function of its arguments: no clock, no random. Colours come in from the brand, never from this file.

/** A brand hex (#rrggbb, extra alpha digits ignored) as [r, g, b]. */
export const rgbOf = (hex) => {
  const n = parseInt(String(hex).slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A brand hex as an rgba() string with alpha a. */
export const alpha = (hex, a) => `rgba(${rgbOf(hex).join(",")},${a})`;

const WHITE = "#FFFFFF";
const INK = "#0A0A0A";

/**
 * Brand colours to the roles the stage parts draw with. Brand keys first (the dark client palette names), then the
 * generic engine keys, then a neutral default, so any brand renders something sane.
 */
export const stagePalette = (colors = {}) => {
  const c = colors;
  const ink = c.navy ?? c.ink ?? INK;
  const accent = c.green ?? c.accent ?? c.action ?? ink;
  const warn = c.alert ?? c.action ?? accent;
  const paper = c.paper ?? c.card ?? WHITE;
  return {
    ink,
    accent,
    warn,
    hot: c.hot ?? warn,
    sage: c.sage ?? c.inkSoft ?? ink,
    deep: c.deep ?? ink,
    paper,
    mist: c.mist ?? c.line ?? paper,
    muted: c.muted ?? c.inkSoft ?? ink,
    soft: c.soft ?? c.inkSoft ?? ink,
    line: c.line ?? alpha(WHITE, 0.24),
    light: c.light ?? WHITE,
  };
};

/** The dot colour for a chip label: dots maps label -> brand colour key (or a literal colour); unknown labels get the fallback. */
export const dotFor = (label, dots, colors, fallback) => {
  const key = dots ? dots[label] : undefined;
  if (key === undefined) return fallback;
  return colors && colors[key] !== undefined ? colors[key] : key;
};

/** 0 before start, then a 0..1 saw that repeats every period seconds. */
export const pulseAt = (s, start, period) => (s > start ? ((s - start) % period) / period : 0);

/**
 * Heat value 0..1 of grid cell (c, r): falls off with distance from the hot cell, a fixed ripple, and a cool zone.
 * spec: { hot: [c, r], radius, cool: (c, r) => boolean, coolValue }.
 */
export const heatAt = (c, r, spec) => {
  if (spec.cool && spec.cool(c, r)) return spec.coolValue ?? 0.05;
  const d = Math.hypot(c - spec.hot[0], r - spec.hot[1]);
  return Math.max(0, Math.min(1, 1 - d / spec.radius + 0.12 * Math.sin(c * 1.7 + r * 2.3)));
};

/** Colour on a three-stop ramp (hex stops) at v in 0..1, as rgb(). */
export const rampColor = (v, stops) => {
  const [s0, s1, s2] = stops.map(rgbOf);
  const [a, b, k] = v < 0.5 ? [s0, s1, v / 0.5] : [s1, s2, (v - 0.5) / 0.5];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(",")})`;
};

/** Point i of n evenly spaced around a circle, starting at the top and going clockwise. */
export const ringPoint = (i, n, cx, cy, R) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
};

/** Width of a chat bubble for text: a fixed width per character plus padding. */
export const bubbleWidth = (text, perChar = 14.2, pad = 60) => text.length * perChar + pad;

/** Opacity of typing dot k at time s: a phase-shifted pulse that never fully disappears. */
export const typingDot = (s, k) => 0.35 + 0.65 * Math.abs(Math.sin(s * 5 + k));

/** True while s is strictly inside (a, b). */
export const within = (s, a, b) => s > a && s < b;
