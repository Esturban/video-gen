// Offer explainer: ONE persistent shell morphs pill -> step 1 -> step 2 -> step 3 -> the CTA pill, driven by a pointer that clicks the tabs and the button.
// Layout is in world units (the camera zooms); the shell is a moving mask. Copy and timing come from the beat in scene.json (see offerTypes.ts).
import React from "react";
import { useBeat, useBrand, useSeconds } from "./beat";
import { CountedText } from "./counter";
import { FONT } from "./fonts";
import { clamp, colorTrack, hexA, mix, mixColor, pointerAt, pressPulse, springStep, track, win, Waypoint } from "./offerMotion";
import { DEFAULT_TL, OfferCfg } from "./offerTypes";
import { Layer, MorphShell, Pointer, Stage, shellAt, ShellState } from "./OfferShell";
import { StepBlock, At } from "./OfferSteps";

const TAB_X = [-240, 0, 240];
const TAB_Y = -272;
const BTN = { x: 0, y: 20, w: 440, h: 88 };

export const OfferExplainer: React.FC = () => {
  const t = useSeconds();
  const brand = useBrand();
  const cfg = useBeat() as unknown as OfferCfg;
  const tl = { ...DEFAULT_TL, ...cfg.tl };
  const c = brand.colors;
  const ink = c.ink, accent = c.accent, paper = brand.background, soft = c.inkSoft, line = c.line;
  const accentLight = mixColor(accent, "#ffffff", 0.55);

  const states: ShellState[] = [
    { at: 0, L: -230, R: 230, T: -44, B: 44, r: 44, bg: ink, cam: 2.0, cy: 0 },
    { at: tl.toCard, L: -380, R: 380, T: -310, B: 214, r: 44, bg: "#ffffff", cam: 1.3, cy: -48, dur: 0.75 },
    { at: tl.tab2 + 0.05, L: -380, R: 380, T: -310, B: 268, r: 44, bg: "#ffffff", cam: 1.3, cy: -21 },
    { at: tl.tab3 + 0.05, L: -380, R: 380, T: -310, B: 124, r: 44, bg: ink, cam: 1.42, cy: -93, dur: 0.7 },
    { at: tl.cta + 0.05, L: -260, R: 260, T: BTN.y - BTN.h / 2 - 4, B: BTN.y + BTN.h / 2 + 4, r: 50, bg: accent, cam: 1.75, cy: -36, dur: 0.8, damp: 0.8 },
  ];
  const s = shellAt(t, states);

  const clicks = [tl.tab2, tl.tab3, tl.cta];
  const path = [
    [tl.cursorIn, 470, 330], [tl.tab2 - 0.45, TAB_X[1] + 20, TAB_Y + 12], [tl.tab2 + 0.5, TAB_X[1] + 20, TAB_Y + 12],
    [tl.tab2 + 1.5, 190, 60], [tl.tab3 - 0.55, TAB_X[2] + 10, TAB_Y + 10], [tl.tab3 + 0.45, TAB_X[2] + 10, TAB_Y + 10],
    [tl.cta - 0.7, BTN.x + 70, BTN.y + 8], [tl.cta + 0.7, BTN.x + 70, BTN.y + 8], [tl.cursorOut - 0.5, 330, 140], [tl.cursorOut + 1.2, 330, 140],
  ] as const;

  const press = Math.max(0, ...clicks.map((k) => pressPulse(t - k)));
  const enter = springStep(t - tl.pillIn, 0.7, 0.75);
  const shellOpacity = win(t, tl.pillIn, tl.pillIn + 0.25);

  // camera: state zoom, a slow continuous push, and a small pan toward the pointer so the frame is never static
  const px = pathPoint(path, t);
  const cam = s.cam * (1 + 0.012 * (t / 12)) + 0;
  const camX = s.cx + (win(t, tl.cursorIn, tl.cursorIn + 1) * px.x * 0.04);
  const camY = s.cy + (win(t, tl.cursorIn, tl.cursorIn + 1) * (px.y - s.cy) * 0.03);

  // shared label: starts as the pill's text, ends as the step kicker
  const sz = track(t, 26, [[tl.toCard, 17, 0.7, 0.88]]);
  const lx = track(t, -165, [[tl.toCard, -340, 0.7, 0.88]]);
  const ly = track(t, 0, [[tl.toCard, -196, 0.7, 0.88]]);
  const lcol = colorTrack(t, "#ffffff", [[tl.toCard + 0.1, accent, 0.5], [tl.tab3 + 0.05, accentLight, 0.5]]);
  const labelOp = win(t, tl.pillIn + 0.15, tl.pillIn + 0.5) * (1 - win(t, tl.cta - 0.05, tl.cta + 0.2));

  const dark = clamp(track(t, 0, [[tl.tab3 + 0.05, 1, 0.5, 0.95]]));
  const tabBg = mixColor("#f1ece2", "#2e2924", dark);
  const tabInd = mixColor("#ffffff", "#4a443d", dark);
  const indX = track(t, TAB_X[0], [[tl.tab2, TAB_X[1], 0.55, 0.78], [tl.tab3, TAB_X[2], 0.55, 0.78]]);
  const btnHov = 1 + 0.04 * (1 - clamp(Math.hypot(px.x - BTN.x, px.y - BTN.y) / 240)) * win(t, tl.tab3 + 1, tl.tab3 + 1.4);
  const btnIn = springStep(t - (tl.tab3 + 0.45), 0.7, 0.8);

  return (
    <Stage canvas={paper} scale={cam} cx={camX} cy={camY}>
      <div style={{ fontFamily: FONT, color: ink, WebkitFontSmoothing: "antialiased", fontVariantNumeric: "tabular-nums" }}>
        <MorphShell s={s} press={press} opacity={shellOpacity} scale={mix(0.82, 1, enter)} ink={ink}>
          <Layer t={t} a={tl.toCard + 0.35} b={tl.cta + 0.2}>
            <At x={0} y={TAB_Y} w={720} h={56} r={28} bg={tabBg} />
            <At x={indX} y={TAB_Y} w={232} h={44} r={22} bg={tabInd} shadow={dark < 0.5 ? `0 2px 8px ${hexA(ink, 0.12)}` : undefined} />
            {cfg.tabs.map((label, i) => {
              const active = i === 0 ? 1 - springStep(t - tl.tab2, 0.4) : i === 1 ? springStep(t - tl.tab2, 0.4) * (1 - springStep(t - tl.tab3, 0.4)) : springStep(t - tl.tab3, 0.4);
              const hov = 1 - clamp(Math.hypot(px.x - TAB_X[i], px.y - TAB_Y) / 150);
              const on = mixColor(mixColor(soft, ink, clamp(0.35 * hov)), "#ffffff", dark);
              const col = active > 0.5 ? mixColor(ink, "#ffffff", dark) : on;
              return <At key={label} x={TAB_X[i]} y={TAB_Y} w={232} h={44} color={col} size={20} weight={active > 0.5 ? 600 : 500} center>{label}</At>;
            })}
          </Layer>
          <StepBlock t={t} cfg={cfg} tl={tl} ink={ink} soft={soft} accent={accent} line={line} />
          <Layer t={t} a={tl.tab3 + 0.4} b={99}>
            <div style={{ position: "absolute", left: BTN.x - BTN.w / 2, top: BTN.y - BTN.h / 2 + (1 - btnIn) * 24, width: BTN.w, height: BTN.h, borderRadius: BTN.h / 2, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontSize: 25, fontWeight: 500, transform: `scale(${mix(0.92, 1, btnIn) * btnHov})`, whiteSpace: "nowrap" }}>
              {cfg.cta}
              <svg width={26} height={26} viewBox="0 0 26 26"><path d="M5 13H20M14 7L20 13L14 19" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </Layer>
          <div style={{ position: "absolute", left: lx - sz * 0.95, top: ly - 5, width: 10, height: 10, borderRadius: 5, background: lcol, opacity: labelOp, transform: `scale(${sz / 26})` }} />
          <div style={{ position: "absolute", left: lx, top: ly - 20, height: 40, lineHeight: "40px", fontSize: 26, fontWeight: 500, whiteSpace: "nowrap", color: lcol, opacity: labelOp, transformOrigin: "0 50%", transform: `scale(${sz / 26})`, filter: labelOp < 1 ? `blur(${(1 - labelOp) * 5}px)` : undefined }}>{cfg.category}</div>
        </MorphShell>
        <Ring t={t} at={tl.cta + 1.1} accent={accent} />
        <Ring t={t} at={tl.cta + 2.6} accent={accent} />
        <At x={0} y={BTN.y + 86} w={520} h={30} size={19} color={soft} center opacity={win(t, tl.cta + 0.9, tl.cta + 1.5)}>{cfg.count?.endNote ? <span><CountedText text={cfg.endNote} tokens={cfg.count.endNote} start={tl.cta + 0.9} end={tl.cta + 1.5} stagger={cfg.count.stagger} /></span> : cfg.endNote}</At>
        <Pointer t={t} path={path} clicks={clicks} showAt={tl.cursorIn} hideAt={tl.cursorOut + 0.4} ink={ink} paper="#ffffff" accent={accent} />
      </div>
    </Stage>
  );
};

const Ring: React.FC<{ t: number; at: number; accent: string }> = ({ t, at, accent }) => {
  const k = win(t, at, at + 1.3);
  if (k <= 0 || k >= 1) return null;
  const e = 1 - (1 - k) ** 3;
  return <div style={{ position: "absolute", left: -260, top: BTN.y - 52, width: 520, height: 104, borderRadius: 52, border: `2px solid ${accent}`, opacity: 0.45 * (1 - k), transform: `scale(${1 + 0.22 * e})` }} />;
};

const pathPoint = (p: readonly Waypoint[], t: number) => pointerAt(p, t);
