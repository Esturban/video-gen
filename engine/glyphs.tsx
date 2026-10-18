// REUSE_CHECKED: 1_social/py/video-gen/engine/OfferSteps.tsx   its step icons are filled badges for the offer card, not a line-glyph set; this is new
// Flat line glyphs (CMO-8248, promoted from the Riyadh Lab thank-you film): city-life and tech icons drawn as strokes in a
// 52 x 52 box centred on (0, 0). Static drawings, no clock: the caller animates position and opacity.
import React from "react";

export type GlyphKind =
  | "mobility" | "air" | "district" | "heritage"
  | "code" | "terminal" | "home" | "education" | "health" | "work" | "groceries" | "park" | "culture" | "nocar";

const STROKE = 3.6;

const GlyphPaths: React.FC<{ kind: GlyphKind }> = ({ kind }) => {
  switch (kind) {
    case "mobility":
      return (
        <>
          <path d="M-20 6 V-8 Q-20 -16 -12 -16 H12 Q20 -16 20 -8 V6 Z" />
          <path d="M-20 -2 H20" />
          <circle cx={-11} cy={12} r={5} />
          <circle cx={11} cy={12} r={5} />
        </>
      );
    case "air":
      return (
        <>
          <path d="M-22 -8 H6 Q14 -8 14 -15 Q14 -21 8 -21" />
          <path d="M-22 2 H14 Q22 2 22 9 Q22 16 15 16" />
          <path d="M-22 12 H-2" />
        </>
      );
    case "district":
      return (
        <>
          <circle cx={0} cy={0} r={20} />
          <path d="M0 0 V-12 M0 0 L9 6" />
          <circle cx={0} cy={0} r={2.5} />
        </>
      );
    case "heritage":
      return (
        <>
          <path d="M-22 20 H22" />
          <path d="M-16 20 V-4 M16 20 V-4" />
          <path d="M-20 -4 H20 L0 -20 Z" />
          <path d="M-6 20 V8 Q0 2 6 8 V20" />
        </>
      );
    case "home":
      return (
        <>
          <path d="M-20 -2 L0 -20 L20 -2" />
          <path d="M-14 -7 V20 H14 V-7" />
          <path d="M-5 20 V8 H5 V20" />
        </>
      );
    case "education":
      return (
        <>
          <path d="M-22 -6 L0 -17 L22 -6 L0 5 Z" />
          <path d="M-12 0 V11 Q0 19 12 11 V0" />
          <path d="M22 -6 V8" />
        </>
      );
    case "health":
      return <path d="M-6 -18 H6 V-6 H18 V6 H6 V18 H-6 V6 H-18 V-6 H-6 Z" />;
    case "work":
      return (
        <>
          <rect x={-20} y={-9} width={40} height={27} rx={4} />
          <path d="M-7 -9 V-16 H7 V-9" />
          <path d="M-20 3 H20" />
        </>
      );
    case "groceries":
      return (
        <>
          <path d="M-22 -16 H-15 L-9 8 H15 L20 -8 H-12" />
          <circle cx={-6} cy={16} r={3} />
          <circle cx={12} cy={16} r={3} />
        </>
      );
    case "park":
      return (
        <>
          <path d="M0 20 V2" />
          <path d="M0 4 C-18 4 -18 -20 0 -20 C18 -20 18 4 0 4" />
          <path d="M-18 20 H18" />
        </>
      );
    case "culture":
      return (
        <>
          <path d="M-20 -8 L0 -20 L20 -8 Z" />
          <path d="M-14 -4 V14 M-5 -4 V14 M5 -4 V14 M14 -4 V14" />
          <path d="M-20 18 H20" />
        </>
      );
    case "nocar":
      return (
        <>
          <path d="M-14 4 V-4 Q-14 -10 -8 -10 H8 Q14 -10 14 -4 V4 Z" />
          <circle cx={-8} cy={9} r={3} />
          <circle cx={8} cy={9} r={3} />
          <circle cx={0} cy={0} r={22} />
          <path d="M-15 -15 L15 15" />
        </>
      );
    case "code":
      return <path d="M-10 -14 L-22 0 L-10 14 M10 -14 L22 0 L10 14 M4 -18 L-4 18" />;
    case "terminal":
      return (
        <>
          <rect x={-22} y={-16} width={44} height={32} rx={5} />
          <path d="M-14 -6 L-6 0 L-14 6 M-2 8 H10" />
        </>
      );
  }
};

/** A glyph as its own svg, `size` px square. */
export const Glyph: React.FC<{ kind: GlyphKind; color: string; size?: number }> = ({ kind, size = 48, color }) => (
  <svg width={size} height={size} viewBox="-26 -26 52 52" style={{ flex: "none", display: "block" }}>
    <g fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      <GlyphPaths kind={kind} />
    </g>
  </svg>
);

/** The same glyph inside an existing svg, centred on (x, y). */
export const GlyphAt: React.FC<{ kind: GlyphKind; x: number; y: number; color: string; size?: number }> = ({ kind, x, y, size = 40, color }) => (
  <g transform={`translate(${x} ${y}) scale(${size / 52})`} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <GlyphPaths kind={kind} />
  </g>
);
