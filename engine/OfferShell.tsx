// REUSE_CHECKED: ~/Downloads/motion-template.zip src/components/{MorphShell,Cursor}.tsx and src/motion/timeline.ts (shellAt/cameraAt/visibility), ported: one persistent shell whose four edges, radius, colour
// and the camera spring to each state, with a small per-edge lag. Contents live in world coordinates and the shell is a moving mask over them.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { colorTrack, hexA, mix, pointerAt, pressPulse, springStep, track, win, Waypoint } from "./offerMotion";

export type ShellState = {
  at: number; L: number; R: number; T: number; B: number; r: number; bg: string; cam: number; cy: number;
  cx?: number; dur?: number; damp?: number;
};

const EDGE_LAG = { L: 0, R: 0.033, T: 0.017, B: 0.05 };

export const shellAt = (t: number, states: readonly ShellState[]) => {
  const s0 = states[0];
  const rest = states.slice(1);
  const col = (k: "L" | "R" | "T" | "B" | "r" | "cam" | "cy" | "cx") =>
    rest.map((s) => [s.at, s[k] ?? 0, s.dur ?? 0.62, s.damp ?? 0.88] as const);
  return {
    L: track(t, s0.L, col("L"), EDGE_LAG.L),
    R: track(t, s0.R, col("R"), EDGE_LAG.R),
    T: track(t, s0.T, col("T"), EDGE_LAG.T),
    B: track(t, s0.B, col("B"), EDGE_LAG.B),
    r: track(t, s0.r, col("r")),
    cam: track(t, s0.cam, col("cam"), 0.03),
    cy: track(t, s0.cy, col("cy"), 0.03),
    cx: track(t, s0.cx ?? 0, col("cx"), 0.03),
    bg: colorTrack(t, s0.bg, rest.map((s) => [s.at, s.bg, 0.5] as const)),
  };
};

/** Canvas plus camera. Children are laid out in world units around (0,0); the camera looks at (cx, cy) with zoom `scale`. */
export const Stage: React.FC<{ canvas: string; scale: number; cx: number; cy: number; children: React.ReactNode }> = ({ canvas, scale, cx, cy, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, #ffffff 0%, ${canvas} 100%)` }}>
      <div style={{ position: "absolute", left: width / 2, top: height / 2, width: 0, height: 0, transform: `scale(${scale}) translate(${-cx}px, ${-cy}px)` }}>{children}</div>
    </AbsoluteFill>
  );
};

export const MorphShell: React.FC<{ s: ReturnType<typeof shellAt>; press: number; opacity: number; scale: number; ink: string; children: React.ReactNode }> = ({ s, press, opacity, scale, ink, children }) => (
  <div
    style={{
      position: "absolute", left: s.L, top: s.T, width: s.R - s.L, height: s.B - s.T, borderRadius: s.r, background: s.bg, overflow: "hidden", opacity,
      transform: `scale(${scale * (1 - 0.035 * press)})`, boxShadow: `0 40px 80px -30px ${hexA(ink, 0.28)}, 0 2px 0 ${hexA(ink, 0.05)}`,
    }}
  >
    <div style={{ position: "absolute", left: -s.L, top: -s.T }}>{children}</div>
  </div>
);

/** Content that owns a time window. Incompatible contents have disjoint windows, so the shell never dissolves, only what is inside it. */
export const Layer: React.FC<{ t: number; a: number; b: number; fadeIn?: number; fadeOut?: number; children: React.ReactNode }> = ({ t, a, b, fadeIn = 0.2, fadeOut = 0.18, children }) => {
  const op = Math.min(win(t, a, a + fadeIn), 1 - win(t, b - fadeOut, b));
  if (op <= 0) return null;
  return <div style={{ position: "absolute", left: 0, top: 0, opacity: op, filter: op < 1 ? `blur(${(1 - op) * 6}px)` : undefined }}>{children}</div>;
};

/** Pointer arrow (template shape) with press squash and a click ripple. World coordinates. */
export const Pointer: React.FC<{ t: number; path: readonly Waypoint[]; clicks: readonly number[]; showAt: number; hideAt: number; ink: string; paper: string; accent: string }> = ({ t, path, clicks, showAt, hideAt, ink, paper, accent }) => {
  const p = pointerAt(path, t);
  const press = Math.max(0, ...clicks.map((c) => pressPulse(t - c)));
  const op = win(t, showAt, showAt + 0.3) * (1 - win(t, hideAt, hideAt + 0.5));
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, opacity: op }}>
      {clicks.map((c) => {
        const k = win(t, c, c + 0.55);
        return k > 0 && k < 1 ? <div key={c} style={{ position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: 30, border: `2px solid ${accent}`, opacity: 0.55 * (1 - k), transform: `scale(${mix(0.3, 1.2, springStep(t - c, 0.5, 0.9))})` }} /> : null;
      })}
      <svg width={31} height={40} viewBox="0 0 31 40" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", transformOrigin: "3px 3px", transform: `scale(${1 - 0.15 * press})` }}>
        <path d="M3 3L3 31L10.5 24L16.5 36L22 33L16 21L27 20Z" fill={ink} stroke={paper} strokeWidth={2.2} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
