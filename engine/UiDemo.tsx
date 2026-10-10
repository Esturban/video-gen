// REUSE_CHECKED: video-gen engine/{motion,pointer,typing} (this round) for the pointer, typing and stagger; Geist loader and warm palette from our own motion-pieces scene (engine/fonts.ts copied).
// UI demo proof: one persistent window. A pointer glides in, decelerates and presses into the field, the task types in, the pointer glides to Run, decelerates and presses, result rows spring in one by one.
import React from "react";
import { AbsoluteFill } from "remotion";
import { useBeat, useBrand, useSeconds } from "./beat";
import { eased, mix, staggerProgress, tween } from "./motion";
import { Pointer, pressTimes, pointerState, type Waypoint } from "./pointer";
import { Typing, typingEnd } from "./typing";
import { FONT } from "./fonts";
import type { UiCfg } from "./uiTypes";

// Layout in px on the 1440 canvas.
const WIN = { x: 250, y: 330, w: 940, h: 700, r: 36 };
const FIELD = { x: 40, y: 150, w: 650, h: 88 }; // relative to the window
const BTN = { x: 720, y: 150, w: 180, h: 88 };
const ROW = { x: 40, y: 330, h: 84, gap: 16 };
const HOVER_R = 260; // px: how near the pointer must be for the Run button to warm up

const rgb = (c: string) => (c.startsWith("rgb") ? (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
const mixHex = (a: string, b: string, k: number) => `rgb(${rgb(a).map((v, i) => Math.round(mix(v, rgb(b)[i], k))).join(",")})`;
const rgba = (hex: string, a: number) => `rgba(${rgb(hex).join(",")},${a})`;

export const UiDemo: React.FC = () => {
  const t = useSeconds();
  const brand = useBrand();
  const cfg = useBeat() as unknown as UiCfg;
  const { tl } = cfg;
  const c = brand.colors;

  const fieldC = { x: WIN.x + FIELD.x + 120, y: WIN.y + FIELD.y + FIELD.h / 2 };
  const btnC = { x: WIN.x + BTN.x + BTN.w * 0.55, y: WIN.y + BTN.y + BTN.h * 0.5 };
  const path: Waypoint[] = [
    { t: 0, x: 1560, y: 1180 },
    { t: tl.pointerIn, x: 1560, y: 1180 },
    { t: tl.fieldArrive, ...fieldC, act: "press" },
    { t: tl.fieldArrive + 1.2, x: fieldC.x + 36, y: fieldC.y + 30 },
    { t: tl.leaveField, x: fieldC.x + 36, y: fieldC.y + 30 },
    { t: tl.buttonArrive, ...btnC, act: "press" },
    { t: tl.pointerAway, x: btnC.x + 150, y: btnC.y + 130 },
  ];
  const [fieldPress] = pressTimes(path);
  const px = pointerState(path, t);

  const spec = { text: cfg.task, start: tl.typeStart, cps: cfg.typing.cps, pauses: cfg.typing.pauses };
  const typedAt = typingEnd(spec);

  const focus = eased(t, fieldPress, fieldPress + 0.25);
  const armed = eased(t, typedAt, typedAt + 0.4);
  const hover = Math.max(0, 1 - Math.hypot(px.x - btnC.x, px.y - btnC.y) / HOVER_R) * eased(t, tl.leaveField, tl.leaveField + 0.5);
  const btnBg = mixHex(mixHex(c.inkSoft, c.accent, armed), c.ink, 0.12 * hover);
  const btnScale = 1 - 0.04 * (px.down && Math.hypot(px.x - btnC.x, px.y - btnC.y) < 80 ? px.press : 0);
  const settle = tween(t, 0.985, [{ at: 0, to: 1, dur: 0.7 }]);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, #ffffff 0%, ${brand.background} 100%)`, fontFamily: FONT, color: c.ink, WebkitFontSmoothing: "antialiased" }}>
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, borderRadius: WIN.r, background: "#fff", boxShadow: `0 40px 80px -30px ${rgba(c.ink, 0.28)}, 0 2px 0 ${rgba(c.ink, 0.05)}`, transform: `scale(${settle})`, overflow: "hidden" }}>
        <div style={{ height: 84, display: "flex", alignItems: "center", gap: 10, padding: "0 36px", borderBottom: `1px solid ${c.line}` }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c.line }} />)}
          <div style={{ marginLeft: 18, fontSize: 24, fontWeight: 500, color: c.inkSoft }}>{cfg.windowTitle}</div>
        </div>
        <Label x={FIELD.x} y={FIELD.y - 40} color={c.inkSoft}>{cfg.fieldLabel}</Label>
        <div style={{ position: "absolute", left: FIELD.x, top: FIELD.y, width: FIELD.w, height: FIELD.h, borderRadius: 20, background: mixHex(c.paper, "#ffffff", focus), border: `2px solid ${mixHex(c.line, c.accent, focus)}`, boxShadow: `0 0 0 ${6 * focus}px ${rgba(c.accent, 0.14 * focus)}`, display: "flex", alignItems: "center", padding: "0 28px", fontSize: 32, fontWeight: 500 }}>
          <div style={{ position: "absolute", left: 28, color: c.inkSoft, opacity: 0.8 * (1 - eased(t, fieldPress, fieldPress + 0.3)) }}>{cfg.placeholder}</div>
          <Typing {...spec} focusAt={fieldPress} caretColor={c.accent} caretHeight={38} />
        </div>
        <div style={{ position: "absolute", left: BTN.x, top: BTN.y, width: BTN.w, height: BTN.h, borderRadius: 20, background: btnBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 600, transform: `scale(${btnScale})`, }}>{cfg.button}</div>
        <Label x={ROW.x} y={ROW.y - 52} color={c.inkSoft} opacity={eased(t, tl.rowsStart - 0.1, tl.rowsStart + 0.3)}>{cfg.resultsLabel}</Label>
        {cfg.results.map((text, i) => {
          const k = staggerProgress(t, i, { start: tl.rowsStart, step: tl.rowsStep, dur: tl.rowsDur, curve: "spring" });
          return (
            <div key={text} style={{ position: "absolute", left: ROW.x, top: ROW.y + i * (ROW.h + ROW.gap) + (1 - k) * 28, width: WIN.w - 2 * ROW.x, height: ROW.h, borderRadius: 18, background: c.accentSoft, display: "flex", alignItems: "center", gap: 22, padding: "0 28px", fontSize: 30, fontWeight: 500, opacity: Math.min(1, k * 1.6), transform: `scale(${mix(0.96, 1, Math.min(1, k))})` }}>
              <Check color={c.accent} />
              {text}
            </div>
          );
        })}
      </div>
      <Pointer waypoints={path} ink={c.ink} paper="#ffffff" accent={c.accent} />
    </AbsoluteFill>
  );
};

const Label: React.FC<{ x: number; y: number; color: string; opacity?: number; children: React.ReactNode }> = ({ x, y, color, opacity = 1, children }) => (
  <div style={{ position: "absolute", left: x, top: y, fontSize: 22, fontWeight: 500, color, opacity, letterSpacing: 0.3 }}>{children}</div>
);

const Check: React.FC<{ color: string }> = ({ color }) => (
  <svg width={32} height={32} viewBox="0 0 32 32"><circle cx={16} cy={16} r={15} fill="none" stroke={color} strokeWidth={2} /><path d="M9 16.5L14 21.5L23 11.5" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
