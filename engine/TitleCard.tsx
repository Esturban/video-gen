// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/closing.tsx   TitleCard and PartnerStrip moved here unchanged in look; copy and strip file are props, colours from the brand. UiExplainer's UiTitle uses letter tiles and the crisp clock, a different card, so not reused.
// TitleCard: static centred title (eyebrow, big title, a row of chips) with an optional logo strip; doubles as the poster frame.
// LogoStrip: one official partner image on a white band at the bottom centre, shown at `scale`, never cropped or recoloured.
import React from "react";
import { Img, staticFile } from "remotion";
import { Dots, TrackChip, useStagePalette } from "./ToolStageFrame";

export type Strip = { file: string; width: number; height: number; scale?: number };

export const LogoStrip: React.FC<{ strip: Strip; opacity: number }> = ({ strip, opacity }) => {
  const { P } = useStagePalette();
  const k = strip.scale ?? 1.5;
  return (
    <div style={{ position: "absolute", bottom: 62, left: "50%", transform: "translateX(-50%)", opacity, background: P.light, borderRadius: 26, padding: "22px 40px", boxShadow: "0 10px 30px rgba(0,0,0,0.18)" }}>
      <Img src={staticFile(strip.file)} style={{ width: strip.width * k, height: strip.height * k, display: "block" }} />
    </div>
  );
};

export const TitleCard: React.FC<{ eyebrow: string; title: string; chips: string[]; dots?: Dots; strip?: Strip }> = ({ eyebrow, title, chips, dots, strip }) => {
  const { P, font } = useStagePalette();
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: font, color: P.light, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 34, color: P.accent }}>{eyebrow}</div>
      <div style={{ fontSize: 120, fontWeight: 300, marginTop: 10 }}>{title}</div>
      <div style={{ display: "flex", gap: 18, marginTop: 56 }}>
        {chips.map((tr) => <TrackChip key={tr} track={tr} size={27} dots={dots} />)}
      </div>
      {strip ? <LogoStrip strip={strip} opacity={1} /> : null}
    </div>
  );
};
