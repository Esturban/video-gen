// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/closing.tsx   CitiesScene moved here unchanged in look; the examples are props, colours from the brand. bentoMath lays out a bento of mixed sizes, this is a plain 3-column card grid, so not reused.
// ExampleGrid: eyebrow and title, then a 3-column grid of example cards (title, one line, chip, source) that rise in one by one, `step` seconds apart.
import React from "react";
import { useT } from "./beat";
import { alpha } from "./cityStageMath.js";
import { Dots, TrackChip, useStagePalette } from "./ToolStageFrame";

export type Example = { title: string; body: string; chip: string; source: string };

export const ExampleGrid: React.FC<{ eyebrow: string; title: string; items: Example[]; step?: number; dots?: Dots }> = ({ eyebrow, title, items, step = 8, dots }) => {
  const t = useT();
  const { P, font } = useStagePalette();
  const head = t(0.2, 1.2);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: font, color: P.light }}>
      <div style={{ position: "absolute", left: 90, top: 70, opacity: head, transform: `translateY(${(1 - head) * 20}px)` }}>
        <div style={{ fontSize: 30, fontWeight: 400, color: P.accent }}>{eyebrow}</div>
        <div style={{ fontSize: 76, fontWeight: 300, marginTop: 6 }}>{title}</div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 290, width: 1740, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 28 }}>
        {items.map((c, i) => {
          const o = t(2 + i * step, 3.2 + i * step);
          return (
            <div key={c.title} style={{ opacity: o, transform: `translateY(${(1 - o) * 24}px)`, background: alpha(P.light, 0.95), color: P.ink, borderRadius: 26, padding: "30px 34px", height: 318, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 44, fontWeight: 500 }}>{c.title}</div>
              <div style={{ fontSize: 29, fontWeight: 300, lineHeight: 1.3, marginTop: 12, flex: 1 }}>{c.body}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ background: P.ink, borderRadius: 999 }}><TrackChip track={c.chip} size={19} dots={dots} /></div>
                <div style={{ fontSize: 18, color: P.muted }}>{c.source}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
