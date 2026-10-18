// REUSE_CHECKED: 1_social/py/video-gen/engine/typing.tsx   that is a typed caret line for UI demos; these are the film kit's kinetic title lines, star field and walkers
// Film kit primitives (CMO-8248, promoted from the Riyadh Lab thank-you film): a style context every film part reads, kinetic text
// lines, word-by-word reveals, a twinkling star field, a flat walking figure and a top scrim. Pure functions of time and props.
import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import { easeInCubic, lerp, ramp } from "./kineticMath.js";

export type FilmPalette = { night: string; deep: string; amber: string; teal: string; white: string; soft: string; faint: string };
export type FilmStyle = { C: FilmPalette; font: string; side: number; top: number; bottom: number };

/** Dark night look the thank-you film was made in; a scene overrides any field through scene.json data.film.style. */
export const DEFAULT_FILM_STYLE: FilmStyle = {
  C: { night: "#05080F", deep: "#0B1B33", amber: "#F2B84B", teal: "#3DD6C6", white: "#FFFFFF", soft: "rgba(255,255,255,0.72)", faint: "rgba(255,255,255,0.18)" },
  font: '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif',
  side: 96,
  top: 180,
  bottom: 180,
};

export const FilmStyleContext = React.createContext<FilmStyle>(DEFAULT_FILM_STYLE);
export const useFilmStyle = () => React.useContext(FilmStyleContext);

/** "#RRGGBB" plus alpha as rgba(), for tints of a palette colour. */
export const tint = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Seconds elapsed in the current Sequence. */
export const useSec = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

type LineProps = {
  t: number;
  at: number;
  until?: number;
  size?: number;
  weight?: number;
  color?: string;
  blurIn?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** A kinetic text line: fades and rises 12 px in, optional blur-to-sharp, fades out at `until`. */
export const Line: React.FC<LineProps> = ({ t, at, until, size = 64, weight = 600, color, blurIn, style, children }) => {
  const { C, font } = useFilmStyle();
  const pIn = ramp(t, at, at + 0.45);
  const pOut = until === undefined ? 0 : ramp(t, until - 0.4, until, easeInCubic);
  const opacity = pIn * (1 - pOut);
  const blur = blurIn ? (1 - ramp(t, at, at + 0.2)) * 14 : 0;
  const scale = blurIn ? lerp(0.92, 1, pIn) : 1;
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.12,
        letterSpacing: -0.5,
        color: color ?? C.white,
        opacity,
        transform: `translateY(${(1 - pIn) * 12 - pOut * 12}px) scale(${scale})`,
        transformOrigin: "left center",
        filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
        textShadow: `0 2px 24px ${tint(C.night, 0.85)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Types words on one at a time starting at `at`, `gap` seconds apart. */
export const WordsOn: React.FC<{ t: number; at: number; gap?: number; text: string; size?: number }> = ({ t, at, gap = 0.22, text, size = 64 }) => {
  const { C, font } = useFilmStyle();
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: 600, color: C.white, lineHeight: 1.12 }}>
      {text.split(" ").map((w, i) => {
        const p = ramp(t, at + i * gap, at + i * gap + 0.3);
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.26, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Absolute text block inside the safe side margins. */
export const TextBlock: React.FC<{ top: number; children: React.ReactNode; gap?: number }> = ({ top, children, gap = 18 }) => {
  const { side } = useFilmStyle();
  return <div style={{ position: "absolute", left: side, right: side, top, display: "flex", flexDirection: "column", gap }}>{children}</div>;
};

/** Deterministic star field over the whole frame. */
export const Stars: React.FC<{ opacity?: number; count?: number }> = ({ opacity = 1, count = 140 }) => {
  const t = useSec();
  const { width, height } = useVideoConfig();
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = random(`sx${i}`) * width;
        const y = random(`sy${i}`) * height;
        const r = 0.6 + random(`sr${i}`) * 1.4;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + random(`st${i}`)) + i));
        return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={tw * 0.55} />;
      })}
    </svg>
  );
};

/** Flat silhouette walker (no face) for use inside an svg. Walk cycle driven by phase. */
export const Walker: React.FC<{ x: number; y: number; h: number; phase: number; color?: string; opacity?: number }> = ({ x, y, h, phase, color, opacity = 1 }) => {
  const { C } = useFilmStyle();
  const ink = color ?? C.teal;
  const s = h / 60;
  const swing = Math.sin(phase * Math.PI * 2) * 11;
  const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 1.5;
  return (
    <g transform={`translate(${x},${y - bob * s}) scale(${s})`} opacity={opacity}>
      <circle cx={0} cy={-52} r={6.5} fill={ink} />
      <line x1={0} y1={-44} x2={0} y2={-22} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <line x1={0} y1={-40} x2={swing * 0.8} y2={-26} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <line x1={0} y1={-40} x2={-swing * 0.8} y2={-26} stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <line x1={0} y1={-22} x2={swing} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />
      <line x1={0} y1={-22} x2={-swing} y2={0} stroke={ink} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
};

/** Vertical scrim so text reads over busy visuals. */
export const TopScrim: React.FC<{ height?: number; opacity?: number }> = ({ height = 640, opacity = 1 }) => {
  const { C } = useFilmStyle();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height,
        opacity,
        background: `linear-gradient(180deg, ${C.night} 0%, ${tint(C.night, 0.88)} 45%, ${tint(C.night, 0)} 100%)`,
      }}
    />
  );
};
