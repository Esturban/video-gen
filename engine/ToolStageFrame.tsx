// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/parts.tsx   SceneFrame, TrackChip, Tag, Stage and Logo moved here unchanged in look; brand tokens via useBrand instead of a scene-imported brand json. UiExplainer's UiScreen is a different layout (mock window, crisp clock), so not reused.
// ToolStageFrame: left column (chip, product logo, product name, optional badge, big caption) and a 1140x860 stage on the right.
// Also the small pieces the tool-stage parts share: TrackChip, StageSvg, StageTag, LogoImg and useStagePalette.
import React from "react";
import { Img, staticFile } from "remotion";
import { useBrand, useT } from "./beat";
import { alpha, dotFor, stagePalette } from "./cityStageMath.js";

export type Palette = ReturnType<typeof stagePalette>;
/** Chip label -> brand colour key (or a literal colour) for the chip's dot. */
export type Dots = Record<string, string>;

/** Stage roles from the active brand, plus the brand font. */
export const useStagePalette = () => {
  const brand = useBrand();
  return { P: stagePalette(brand.colors) as Palette, font: brand.font, colors: brand.colors };
};

export const TrackChip: React.FC<{ track: string; size?: number; dots?: Dots }> = ({ track, size = 26, dots }) => {
  const { P, colors } = useStagePalette();
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: size * 0.5,
        padding: `${size * 0.35}px ${size * 0.8}px ${size * 0.35}px ${size * 0.55}px`,
        borderRadius: 999, background: alpha(P.light, 0.14), border: `1px solid ${P.line}`,
        fontSize: size, fontWeight: 300, color: P.light, whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: size * 0.62, height: size * 0.62, borderRadius: "50%", background: dotFor(track, dots, colors, P.accent) }} />
      {track}
    </div>
  );
};

/** A pill tag drawn inside an svg stage, e.g. "Example data". */
export const StageTag: React.FC<{ text: string; x: number; y: number; w?: number }> = ({ text, x, y, w = 190 }) => {
  const { P } = useStagePalette();
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={40} rx={20} fill={P.warn} />
      <text x={w / 2} y={27} textAnchor="middle" fontSize={20} fontWeight={500} fill={P.ink}>{text}</text>
    </g>
  );
};

/** The 1140x860 svg every stage draws into. label is the accessible description. */
export const StageSvg: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => {
  const { font } = useStagePalette();
  return (
    <svg viewBox="0 0 1140 860" width={1140} height={860} role="img" aria-label={label} style={{ fontFamily: font }}>
      {children}
    </svg>
  );
};

/** A square logo from the scene's assets/. */
export const LogoImg: React.FC<{ file: string; size: number }> = ({ file, size }) => (
  <Img src={staticFile(file)} style={{ width: size, height: size }} />
);

type FrameProps = {
  track: string;
  logo: string;
  product: string;
  caption: string;
  optional?: boolean;
  optionalLabel?: string;
  dots?: Dots;
  children: React.ReactNode;
};

/** Left column (track, logo, product, caption) plus the stage on the right. */
export const ToolStageFrame: React.FC<FrameProps> = ({ track, logo, product, caption, optional, optionalLabel = "Optional", dots, children }) => {
  const t = useT();
  const { P, font } = useStagePalette();
  const inLeft = t(0.2, 1.2);
  const inCap = t(0.8, 2.0);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: font, color: P.light }}>
      <div style={{ position: "absolute", left: 90, top: 86, opacity: inLeft }}>
        <TrackChip track={track} dots={dots} />
      </div>
      <div style={{ position: "absolute", left: 90, top: 250, width: 560, opacity: inLeft, transform: `translateY(${(1 - inLeft) * 20}px)` }}>
        <Img src={staticFile(logo)} style={{ width: 150, height: 150 }} />
        <div style={{ fontSize: 40, fontWeight: 400, color: P.accent, marginTop: 26, display: "flex", alignItems: "center", gap: 16 }}>
          {product}
          {optional ? (
            <span style={{ fontSize: 22, padding: "4px 14px", borderRadius: 999, border: `1px solid ${P.accent}`, color: P.accent }}>{optionalLabel}</span>
          ) : null}
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 560, width: 540, fontSize: 70, fontWeight: 300, lineHeight: 1.12, opacity: inCap, transform: `translateY(${(1 - inCap) * 24}px)` }}>
        {caption}
      </div>
      <div style={{ position: "absolute", left: 700, top: 90, width: 1140, height: 860 }}>{children}</div>
    </div>
  );
};
