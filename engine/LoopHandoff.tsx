// REUSE_CHECKED: 4_agents/sh/brains/content-thinking/video/scenes/client/riyadh-day3/closing.tsx   CloseScene moved here unchanged in look; steps, lines, logos and strip are props, colours from the brand. OfferSteps/UiSteps are numbered lists, not a loop, so not reused.
// LoopHandoff: a closing beat in two acts. A dashed ring with N steps that light up in turn, then the ring fades and a
// two-line hand-off appears with a row of tool logos and an optional partner strip (credits).
import React from "react";
import { useT } from "./beat";
import { alpha, ringPoint } from "./cityStageMath.js";
import { LogoStrip, Strip } from "./TitleCard";
import { LogoImg, useStagePalette } from "./ToolStageFrame";

type Props = { eyebrow: string; steps: string[]; lines: [string, string]; logos: string[]; strip?: Strip };

const R = 250;

export const LoopHandoff: React.FC<Props> = ({ eyebrow, steps, lines, logos, strip }) => {
  const t = useT();
  const { P, font } = useStagePalette();
  const loopOut = 1 - t(7.4, 8.2);
  const hand = t(8.2, 9.4);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: font, color: P.light }}>
      <div style={{ position: "absolute", inset: 0, opacity: loopOut }}>
        <div style={{ position: "absolute", left: 90, top: 86, fontSize: 30, color: P.accent, opacity: t(0.2, 1) }}>{eyebrow}</div>
        <svg viewBox="0 0 1920 1080" width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <circle cx="960" cy="560" r={R} fill="none" stroke={P.line} strokeWidth="4" strokeDasharray="10 12" opacity={t(0.3, 1.2)} />
          {steps.map((name, i) => {
            const [x, y] = ringPoint(i, steps.length, 960, 560, R);
            const on = t(1.2 + i * 1.3, 2.0 + i * 1.3);
            return (
              <g key={name} opacity={0.35 + 0.65 * on}>
                <circle cx={x} cy={y} r={108} fill={on > 0.5 ? P.accent : alpha(P.light, 0.14)} stroke={P.light} strokeWidth="3" />
                <text x={x} y={y + 14} textAnchor="middle" fontSize="40" fontWeight={on > 0.5 ? 500 : 300} fill={on > 0.5 ? P.ink : P.light} fontFamily={font}>{name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: hand, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 110, fontWeight: 300, transform: `translateY(${(1 - hand) * 24}px)` }}>{lines[0]}</div>
        <div style={{ fontSize: 110, fontWeight: 500, color: P.accent }}>{lines[1]}</div>
        <div style={{ display: "flex", gap: 30, marginTop: 70, opacity: t(9.6, 10.6) }}>
          {logos.map((f) => <LogoImg key={f} file={f} size={78} />)}
        </div>
        {strip ? <LogoStrip strip={strip} opacity={t(10.2, 11.2)} /> : null}
      </div>
    </div>
  );
};
