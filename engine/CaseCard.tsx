// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/caseScene.tsx   CaseScene moved here unchanged in look; headings and tool names are props, colours from the brand. No engine part shows a problem/solution/outcome case, so nothing to reuse.
// CaseCard: one real-world example. Name, chip and eyebrow on top; a screenshot with its credit on the left;
// Problem, Solution and Outcome boxes on the right; the tool logos below; a closing "here" card. Builds over about 15 seconds, then holds.
import React from "react";
import { Img, staticFile } from "remotion";
import { useT } from "./beat";
import { alpha } from "./cityStageMath.js";
import { Dots, LogoImg, TrackChip, useStagePalette } from "./ToolStageFrame";

export type CaseData = {
  city: string; track: string; image: string; credit: string;
  problem: string; solution: string; outcome: string; riyadh: string; logos: string[];
};

export type CaseLabels = { eyebrow: string; problem: string; solution: string; outcome: string; tools: string; local: string };

const Box: React.FC<{ label: string; text: string; o: number; tint: string }> = ({ label, text, o, tint }) => {
  const { P } = useStagePalette();
  return (
    <div style={{ opacity: o, transform: `translateX(${(1 - o) * 30}px)`, background: alpha(P.light, 0.95), borderRadius: 22, padding: "20px 28px", display: "flex", gap: 22, alignItems: "center", minHeight: 132 }}>
      <div style={{ flex: "none", width: 150, padding: "8px 0", borderRadius: 999, background: tint, color: P.ink, fontSize: 24, fontWeight: 500, textAlign: "center" }}>{label}</div>
      <div style={{ fontSize: 31, fontWeight: 400, lineHeight: 1.25, color: P.ink }}>{text}</div>
    </div>
  );
};

/** c.riyadh is the "how it would look here" line (field name kept from the scene data). toolNames maps a logo file to its caption. */
export const CaseCard: React.FC<{ c: CaseData; labels: CaseLabels; toolNames: Record<string, string>; dots?: Dots }> = ({ c, labels, toolNames, dots }) => {
  const t = useT();
  const { P, font } = useStagePalette();
  const head = t(0.3, 1.8);
  const img = t(1.2, 3.0);
  const tools = t(11.0, 12.5);
  const here = t(12.8, 14.6);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: font, color: P.light }}>
      <div style={{ position: "absolute", left: 90, top: 64, opacity: head, display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ fontSize: 76, fontWeight: 400 }}>{c.city}</div>
        <TrackChip track={c.track} dots={dots} />
        <div style={{ fontSize: 26, color: P.accent }}>{labels.eyebrow}</div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 200, width: 800, opacity: img, transform: `scale(${0.96 + img * 0.04})`, transformOrigin: "left top" }}>
        <div style={{ width: 800, height: 500, borderRadius: 22, overflow: "hidden", background: P.light, boxShadow: "0 18px 40px rgba(0,0,0,0.25)" }}>
          <Img src={staticFile(c.image)} style={{ width: 800, height: 500, objectFit: "cover", objectPosition: "top left" }} />
        </div>
        <div style={{ fontSize: 20, color: P.soft, marginTop: 10 }}>{c.credit}</div>
      </div>
      <div style={{ position: "absolute", left: 940, top: 200, width: 890, display: "flex", flexDirection: "column", gap: 20 }}>
        <Box label={labels.problem} text={c.problem} o={t(3.4, 5.0)} tint={P.warn} />
        <Box label={labels.solution} text={c.solution} o={t(6.0, 7.6)} tint={P.accent} />
        <Box label={labels.outcome} text={c.outcome} o={t(8.6, 10.2)} tint={P.mist} />
      </div>
      <div style={{ position: "absolute", left: 90, top: 770, width: 800, opacity: tools }}>
        <div style={{ fontSize: 26, color: P.accent, marginBottom: 14 }}>{labels.tools}</div>
        <div style={{ display: "flex", gap: 30 }}>
          {c.logos.map((f) => (
            <div key={f} style={{ width: 170, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <LogoImg file={f} size={78} />
              <div style={{ fontSize: 20, color: P.light, textAlign: "center", lineHeight: 1.2 }}>{toolNames[f] ?? ""}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 940, top: 800, width: 890, opacity: here, transform: `translateY(${(1 - here) * 20}px)`, background: P.accent, color: P.ink, borderRadius: 24, padding: "22px 30px" }}>
        <div style={{ fontSize: 24, fontWeight: 500, opacity: 0.8 }}>{labels.local}</div>
        <div style={{ fontSize: 36, fontWeight: 500, lineHeight: 1.2, marginTop: 4 }}>{c.riyadh}</div>
      </div>
    </div>
  );
};
