// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/riyadh-day3/motion/video/src/parts.tsx   useT/useSeconds/PaceContext lifted here unchanged in behaviour; mashreq theme.tsx useP lifted as well
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { progress } from "./time.js";

export { clamp01, cursor, drag, follow, progress, spring } from "./time.js";

/** One beat of a scene file. Kind-specific fields (caption, track, case, ...) ride along untyped. */
export type Beat = {
  n: number;
  start: number;
  end: number;
  kind: string;
  pace?: number; // 2 means every animation in the beat takes twice as long
  caption?: string;
  narration?: string;
  voiceAt?: number; // seconds into the beat where narration starts
  voice?: number; // narration length, seconds
  [field: string]: unknown;
};

export type Scene = {
  name: string;
  brand: string;
  size?: [number, number];
  fade?: number; // cross fade between beats, seconds
  progress?: boolean; // thin progress bar along the bottom
  poster?: number; // seconds
  data?: Record<string, unknown>; // scene-wide data for this video's kinds
  brandSlot?: { text?: string; corner?: string; logo?: string | null }; // signature or logo overlay in one corner; absent means nothing is rendered
  beats: Beat[];
};

export type Brand = {
  name: string;
  background: string;
  font: string;
  colors: Record<string, string>;
  [field: string]: unknown;
};

const NO_BEAT: Beat = { n: 0, start: 0, end: 1, kind: "" };
export const BeatContext = React.createContext<Beat>(NO_BEAT);
export const SceneContext = React.createContext<Scene>({ name: "", brand: "", beats: [] });
export const BrandContext = React.createContext<Brand>({ name: "", background: "#000", font: "sans-serif", colors: {} });

export const useBeat = () => React.useContext(BeatContext);
export const useScene = () => React.useContext(SceneContext);
export const useBrand = () => React.useContext(BrandContext);

/** Seconds since this beat started, divided by the beat's pace. */
export const useSeconds = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps / (useBeat().pace ?? 1);
};

/** Eased 0..1 progress between two times in seconds (pace applied). */
export const useT = () => {
  const s = useSeconds();
  return (a: number, b: number) => progress(s, a, b);
};

/** Eased 0..1 progress between two fractions of the beat length (pace ignored). */
export const useP = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = useBeat();
  const d = b.end - b.start;
  return (a: number, c: number) => progress(frame / fps, a * d, c * d);
};
