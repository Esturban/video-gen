// Step contents for the offer explainer: title, body, rows (ring or check icon), optional note chip. World units, centre-origin, left edge of the text column at x = -340.
import React from "react";
import { CountedText } from "./counter";
import { Layer } from "./OfferShell";
import { mix, springStep, win } from "./offerMotion";
import { OfferCfg, Step, Timeline } from "./offerTypes";

/** Absolutely placed box by centre. `center` centres its text. */
export const At: React.FC<{
  x: number; y: number; w: number; h: number; r?: number; bg?: string; shadow?: string; color?: string; size?: number; weight?: number;
  center?: boolean; opacity?: number; children?: React.ReactNode;
}> = ({ x, y, w, h, r, bg, shadow, color, size, weight, center, opacity, children }) => (
  <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: r, background: bg, boxShadow: shadow, color, fontSize: size, fontWeight: weight, opacity, whiteSpace: "nowrap",
    display: center ? "flex" : undefined, alignItems: "center", justifyContent: center ? "center" : undefined, lineHeight: `${h}px` }}>{children}</div>
);

const COL = -340;
const ROW_Y = (i: number) => -10 + i * 80;

/** Seconds a piece of copy takes to rise in; the note's counter runs inside this same window. */
const REVEAL_S = 0.65;

/** Rise, de-blur and fade in at `at`; the shared enter for every piece of step copy. */
const useIn = (t: number, at: number) => {
  const k = springStep(t - at, REVEAL_S, 0.8);
  const o = win(t, at, at + 0.3);
  return { opacity: o, transform: `translateY(${(1 - k) * 26}px)`, filter: o < 1 ? `blur(${(1 - o) * 8}px)` : undefined } as React.CSSProperties;
};

const Icon: React.FC<{ kind: "ring" | "check"; t: number; at: number; ink: string; accent: string; soft: string }> = ({ kind, t, at, accent, soft }) => {
  if (kind === "ring") {
    const k = win(t, at + 0.2, at + 0.7);
    return (
      <svg width={30} height={30} viewBox="0 0 30 30"><circle cx={15} cy={15} r={11} fill="none" stroke={soft} strokeWidth={2.4} strokeDasharray="4 5" transform={`rotate(${k * 90} 15 15)`} /></svg>
    );
  }
  const pop = springStep(t - (at + 0.15), 0.5, 0.6);
  const draw = win(t, at + 0.3, at + 0.65);
  return (
    <svg width={30} height={30} viewBox="0 0 30 30" style={{ transform: `scale(${mix(0.6, 1, pop)})` }}>
      <circle cx={15} cy={15} r={14} fill={accent} />
      <path d="M8.5 15.5L13 20L21.5 10.5" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    </svg>
  );
};

const Row: React.FC<{ i: number; label: string; kind: "ring" | "check"; t: number; at: number; ink: string; soft: string; accent: string }> = ({ i, label, kind, t, at, ink, soft, accent }) => {
  const a = at + i * 0.1;
  return (
    <div style={{ position: "absolute", left: COL, top: ROW_Y(i) - 32, width: 680, height: 64, borderRadius: 22, background: "#f6f2ea", display: "flex", alignItems: "center", gap: 18, padding: "0 20px", ...useIn(t, a) }}>
      <Icon kind={kind} t={t} at={a} ink={ink} accent={accent} soft={soft} />
      <span style={{ fontSize: 23, fontWeight: 500, color: ink }}>{label}</span>
    </div>
  );
};

const Copy: React.FC<{ t: number; at: number; step: Step; color: string; soft: string }> = ({ t, at, step, color, soft }) => (
  <>
    <div style={{ position: "absolute", left: COL, top: -170, height: 60, lineHeight: "60px", fontSize: 44, fontWeight: 600, letterSpacing: -1.2, color, whiteSpace: "nowrap", ...useIn(t, at) }}>{step.title}</div>
    <div style={{ position: "absolute", left: COL, top: -104, height: 40, lineHeight: "40px", fontSize: 23, fontWeight: 400, color: soft, whiteSpace: "nowrap", ...useIn(t, at + 0.08) }}>{step.body}</div>
  </>
);

const Note: React.FC<{ t: number; at: number; text: string; accent: string; count?: string[]; stagger?: number }> = ({ t, at, text, accent, count, stagger }) => (
  <div style={{ position: "absolute", left: COL, top: 214, height: 40, padding: "0 20px", borderRadius: 20, border: `1.5px solid ${accent}`, color: accent, fontSize: 20, fontWeight: 500, lineHeight: "37px", whiteSpace: "nowrap", ...useIn(t, at) }}>{count ? <CountedText text={text} tokens={count} start={at} end={at + REVEAL_S} stagger={stagger} /> : text}</div>
);

export const StepBlock: React.FC<{ t: number; cfg: OfferCfg; tl: Timeline; ink: string; soft: string; accent: string; line: string }> = ({ t, cfg, tl, ink, soft, accent }) => {
  const [s1, s2, s3] = cfg.steps;
  const w1 = { a: tl.toCard + 0.5, b: tl.tab2 + 0.05 };
  const w2 = { a: tl.tab2 + 0.22, b: tl.tab3 + 0.05 };
  const w3 = { a: tl.tab3 + 0.22, b: tl.cta + 0.2 };
  return (
    <>
      <Layer t={t} {...w1} fadeIn={0.05}>
        <Copy t={t} at={w1.a} step={s1} color={ink} soft={soft} />
        {(s1.rows ?? []).map((r, i) => <Row key={r} i={i} label={r} kind={s1.icon ?? "ring"} t={t} at={w1.a + 0.2} ink={ink} soft={soft} accent={accent} />)}
      </Layer>
      <Layer t={t} {...w2} fadeIn={0.05}>
        <Copy t={t} at={w2.a} step={s2} color={ink} soft={soft} />
        {(s2.rows ?? []).map((r, i) => <Row key={r} i={i} label={r} kind={s2.icon ?? "check"} t={t} at={w2.a + 0.2} ink={ink} soft={soft} accent={accent} />)}
        {s2.note ? <Note t={t} at={w2.a + 0.65} text={s2.note} accent={accent} count={cfg.count?.note} stagger={cfg.count?.stagger} /> : null}
      </Layer>
      <Layer t={t} {...w3} fadeIn={0.05}>
        <Copy t={t} at={w3.a} step={s3} color="#ffffff" soft="#bdb5a8" />
      </Layer>
    </>
  );
};
