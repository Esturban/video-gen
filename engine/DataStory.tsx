// REUSE_CHECKED: video-gen engine/chartStory.tsx and engine/morph (this round) for the whole chain; Geist loader and warm palette from our own ui-demo-proof scene (engine/fonts.ts).
// Data story: one canvas, one chain of morphs (dot, ring, bars, line, number, cards), all drawn by the engine from the numbers in scene.json.
// This file only adds the fixed screen overlay: a short title and the "Sample data" corner label, so nobody reads the figures as a real result.
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { useBeat, useBrand, useSeconds } from "./beat";
import { ChartStory, type StoryColors, type StoryConfig } from "./chartStory";
import { eased } from "./motion";
import { FONT } from "./fonts";

const MARGIN = 64; // px: same safe margin as the brand slot
const TITLE_PX = 46;
const LABEL_PX = 26;
const TITLE_IN = [0.9, 1.7] as const;
const LABEL_IN = [0.4, 1.0] as const;

type StoryBeat = StoryConfig & { title: string; sampleLabel: string };

export const DataStory: React.FC = () => {
  const t = useSeconds();
  const brand = useBrand();
  const beat = useBeat() as unknown as StoryBeat;
  const c = brand.colors;
  const colors: StoryColors = useMemo(() => ({ accent: c.accent, ink: c.ink, inkSoft: c.inkSoft, card: c.card, line: c.line, paper: c.paper }), [c]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, #ffffff 0%, ${brand.background} 100%)`, fontFamily: FONT, color: c.ink, WebkitFontSmoothing: "antialiased" }}>
      <ChartStory config={beat} colors={colors} fontFamily={FONT} />
      <div style={{ position: "absolute", left: MARGIN, top: MARGIN, fontSize: TITLE_PX, fontWeight: 600, letterSpacing: "-0.01em", opacity: eased(t, TITLE_IN[0], TITLE_IN[1]) }}>{beat.title}</div>
      <div style={{ position: "absolute", left: MARGIN, bottom: MARGIN, fontSize: LABEL_PX, fontWeight: 500, color: c.inkSoft, opacity: eased(t, LABEL_IN[0], LABEL_IN[1]), display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: c.accent, display: "inline-block" }} />
        {beat.sampleLabel}
      </div>
    </AbsoluteFill>
  );
};
