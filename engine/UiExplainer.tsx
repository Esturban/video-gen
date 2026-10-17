// REUSE_CHECKED: content-thinking scenes/client/mashreq-demo1 {kinds,theme,demo1}.tsx (SceneFrame: label, app tile, product and caption on the left, mock window on
//   the right; TitleCard; BuildCard steps): that look, generalised and moved into the engine with brand tokens instead of client colours.
//   1_social/py/video-gen/engine/{beat.tsx,fonts.ts,uiExplainerMath.js}.
// UiExplainer (CMO-8242): calm UI-screen explainer. Three kinds from one file:
//   UiTitle  : eyebrow, big caption, a row of letter tiles.
//   UiScreen : caption column plus one mock window whose content is beat.panel (type bars | cards | flow | lanes); items reveal across the narration.
//   UiSteps  : closing card, numbered steps reveal one by one.
// Layout comes from layoutFor(W, H), so the same beats compose for 16:9 and 9:16. Text and shapes read the crisp clock: no ghosting.
import React from "react";
import { useVideoConfig } from "remotion";
import { useBeat, useBrand, useCrispSeconds } from "./beat";
import { FONT } from "./fonts";
import { cueTimes, flowDots, layoutFor, laneX, pushScale, reveal } from "./uiExplainerMath.js";

type Tile = { letter: string; label?: string; tone?: string };
type Bar = { label: string; w: number; note?: string };
type Card = { title: string; meta?: string; badge?: string };
type FlowEnd = { title: string; meta?: string };
type Lane = { label: string; items: { at: number; text: string }[] };
type Panel = {
  type: "bars" | "cards" | "flow" | "lanes"; title: string; app?: string; tone?: string; tag?: string;
  rows?: Bar[]; items?: Card[]; from?: FlowEnd; to?: FlowEnd; label?: string; lanes?: Lane[]; axis?: string;
};
type UiBeat = { n: number; start: number; end: number; voiceAt?: number; voice?: number; eyebrow?: string; caption?: string; product?: string; tile?: Tile; tiles?: Tile[]; source?: string; panel?: Panel; steps?: string[] };

const useKit = () => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const beat = useBeat() as unknown as UiBeat;
  const t = useCrispSeconds();
  const c = brand.colors;
  const tone = (k?: string) => (k ? c[k] ?? k : c.accent);
  const push: React.CSSProperties = { transform: `scale(${pushScale(t, beat.end - beat.start)})`, transformOrigin: "50% 50%" };
  return { L: layoutFor(W, H), c, t, beat, tone, push };
};

const lift = (k: number, px: number): React.CSSProperties => ({ opacity: k, transform: `translateY(${(1 - k) * px}px)` });

const LetterTile: React.FC<{ tile: Tile; size: number; ink: string; labelPx?: number; tone: string }> = ({ tile, size, ink, labelPx, tone }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.24, background: tone, color: "#fff", fontWeight: 600, fontSize: size * (tile.letter.length > 1 ? 0.34 : 0.5), display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(36,31,26,0.16)" }}>{tile.letter}</div>
    {labelPx && tile.label ? <span style={{ fontSize: labelPx, color: ink }}>{tile.label}</span> : null}
  </div>
);

export const UiTitle: React.FC = () => {
  const { L, c, t, beat, tone, push } = useKit();
  const tiles = beat.tiles ?? [];
  const cues = cueTimes(tiles.length + 2, beat);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: c.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `0 ${80 * L.s}px`, textAlign: "center", ...push }}>
      <div style={{ fontSize: L.px.label * 1.3, letterSpacing: 6 * L.s, textTransform: "uppercase", color: c.accent, ...lift(reveal(t, 0), 16 * L.s) }}>{beat.eyebrow}</div>
      <div style={{ fontSize: L.px.title, fontWeight: 400, lineHeight: 1.08, marginTop: 28 * L.s, maxWidth: 1500 * L.s, ...lift(reveal(t, 0.15), 24 * L.s) }}>{beat.caption}</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 56 * L.s, marginTop: 72 * L.s }}>
        {tiles.map((tile, i) => (
          <div key={tile.letter + i} style={lift(reveal(t, cues[i + 1]), 20 * L.s)}>
            <LetterTile tile={tile} size={84 * L.s} ink={c.ink} labelPx={L.px.product} tone={tone(tile.tone)} />
          </div>
        ))}
      </div>
    </div>
  );
};

const Window: React.FC<{ panel: Panel; s: number; c: Record<string, string>; tone: string; k: number; children: React.ReactNode }> = ({ panel, s, c, tone, k, children }) => (
  <div style={{ position: "absolute", inset: 0, ...lift(k, 30 * s) }}>
    {panel.tag ? (
      <div style={{ position: "absolute", right: 0, top: -50 * s, padding: `${4 * s}px ${14 * s}px`, borderRadius: 999, background: c.accentSoft, color: c.accent, fontSize: 20 * s, fontWeight: 500 }}>{panel.tag}</div>
    ) : null}
    <div style={{ width: "100%", height: "100%", background: c.card, borderRadius: 18 * s, overflow: "hidden", boxShadow: "0 18px 50px rgba(36,31,26,0.14)", border: `1px solid ${c.line}`, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 58 * s, background: tone, display: "flex", alignItems: "center", gap: 14 * s, padding: `0 ${20 * s}px`, color: "#fff", flexShrink: 0 }}>
        <div style={{ width: 32 * s, height: 32 * s, borderRadius: 8 * s, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 17 * s }}>{panel.app ?? panel.title.slice(0, 1)}</div>
        <span style={{ fontSize: 22 * s, fontWeight: 500 }}>{panel.title}</span>
      </div>
      <div style={{ flex: 1, position: "relative", padding: 34 * s }}>{children}</div>
    </div>
  </div>
);

type PanelProps = { panel: Panel; t: number; cues: number[]; s: number; c: Record<string, string>; tone: string; body: number; w: number; h: number; tall: boolean };

const Bars: React.FC<PanelProps> = ({ panel, t, cues, s, c, tone, body }) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 56 * s, fontSize: body * 1.15 }}>
    {(panel.rows ?? []).map((r, i) => {
      const k = reveal(t, cues[i]);
      const grow = reveal(t, cues[i] + 0.15, 0.9);
      return (
        <div key={r.label + i} style={{ opacity: k }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 * s }}>
            <span>{r.label}</span><span style={{ color: c.inkSoft, opacity: grow }}>{r.note}</span>
          </div>
          <div style={{ height: 44 * s, borderRadius: 22 * s, background: c.accentSoft, overflow: "hidden" }}>
            <div style={{ width: `${r.w * grow * 100}%`, height: "100%", borderRadius: 22 * s, background: tone }} />
          </div>
        </div>
      );
    })}
  </div>
);

const Cards: React.FC<PanelProps> = ({ panel, t, cues, s, c, tone, body }) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 28 * s }}>
    {(panel.items ?? []).map((it, i) => {
      const k = reveal(t, cues[i]);
      return (
        <div key={it.title + i} style={{ ...lift(k, 26 * s), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 * s, padding: `${30 * s}px ${30 * s}px`, borderRadius: 14 * s, border: `1px solid ${c.line}`, borderLeft: `${6 * s}px solid ${tone}`, background: c.paper }}>
          <div>
            <div style={{ fontSize: body * 1.15, fontWeight: 500 }}>{it.title}</div>
            {it.meta ? <div style={{ fontSize: body * 0.78, color: c.inkSoft, marginTop: 6 * s }}>{it.meta}</div> : null}
          </div>
          {it.badge ? <div style={{ flexShrink: 0, padding: `${4 * s}px ${14 * s}px`, borderRadius: 999, background: c.accentSoft, color: c.accent, fontSize: body * 0.7, fontWeight: 500 }}>{it.badge}</div> : null}
        </div>
      );
    })}
  </div>
);

const Flow: React.FC<PanelProps> = ({ panel, t, cues, s, c, tone, body, w, h, tall }) => {
  const from = panel.from ?? { title: "" };
  const to = panel.to ?? { title: "" };
  const kFrom = reveal(t, cues[0]);
  const kTo = reveal(t, cues[1]);
  const kLabel = reveal(t, cues[2]);
  const fill = reveal(t, cues[1] + 0.3, Math.max(0.6, cues[2] - cues[1] + 1.2));
  const inner = { w: w - 68 * s, h: h - 58 * s - 68 * s };
  const big = tall ? { x: 0, y: 0, w: inner.w, h: inner.h * 0.36 } : { x: 0, y: inner.h * 0.18, w: inner.w * 0.42, h: inner.h * 0.64 };
  const small = tall ? { x: inner.w * 0.2, y: inner.h * 0.7, w: inner.w * 0.6, h: inner.h * 0.26 } : { x: inner.w * 0.66, y: inner.h * 0.3, w: inner.w * 0.34, h: inner.h * 0.4 };
  const a = tall ? { x: inner.w / 2, y: big.y + big.h } : { x: big.x + big.w, y: big.y + big.h / 2 };
  const b = tall ? { x: inner.w / 2, y: small.y } : { x: small.x, y: small.y + small.h / 2 };
  const dots = flowDots(t, cues[1], 7);
  const End: React.FC<{ e: FlowEnd; r: typeof big; k: number; strong: boolean }> = ({ e, r, k, strong }) => (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, ...lift(k, 20 * s), borderRadius: 16 * s, background: strong ? tone : c.paper, color: strong ? "#fff" : c.ink, border: `${2 * s}px solid ${tone}`, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${26 * s}px`, boxSizing: "border-box" }}>
      <div style={{ fontSize: body * (strong ? 1.25 : 1.05), fontWeight: 500 }}>{e.title}</div>
      {e.meta ? <div style={{ fontSize: body * 0.8, opacity: 0.8, marginTop: 8 * s }}>{e.meta}</div> : null}
      {!strong ? (
        <div style={{ height: 12 * s, borderRadius: 6 * s, background: c.accentSoft, marginTop: 18 * s, overflow: "hidden" }}>
          <div style={{ width: `${fill * 100}%`, height: "100%", background: tone }} />
        </div>
      ) : null}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: 34 * s, top: 34 * s, width: inner.w, height: inner.h }}>
      <svg width={inner.w} height={inner.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.line} strokeWidth={4 * s} strokeDasharray={`${10 * s} ${8 * s}`} opacity={kTo} />
        {dots.map((d: { i: number; u: number; op: number }) => <circle key={d.i} cx={a.x + (b.x - a.x) * d.u} cy={a.y + (b.y - a.y) * d.u} r={8 * s} fill={tone} opacity={d.op} />)}
      </svg>
      <End e={from} r={big} k={kFrom} strong />
      <End e={to} r={small} k={kTo} strong={false} />
      {panel.label ? (
        <div style={{ position: "absolute", left: tall ? inner.w * 0.55 : (a.x + b.x) / 2 - 120 * s, top: tall ? (a.y + b.y) / 2 - 24 * s : a.y - 90 * s, width: 240 * s, textAlign: tall ? "left" : "center", fontSize: body * 0.85, color: c.accent, fontWeight: 500, opacity: kLabel }}>{panel.label}</div>
      ) : null}
    </div>
  );
};

const Lanes: React.FC<PanelProps> = ({ panel, t, cues, s, c, tone, body, w }) => {
  const lanes = panel.lanes ?? [];
  const flat = lanes.flatMap((ln, li) => ln.items.map((it, ii) => ({ li, ii, at: it.at }))).sort((p, q) => p.at - q.at || p.li - q.li);
  const order = new Map(flat.map((f, i) => [`${f.li}:${f.ii}`, i]));
  const x0 = 0;
  const lw = w - 68 * s - 150 * s;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 64 * s }}>
      {lanes.map((ln, li) => (
        <div key={ln.label} style={{ opacity: reveal(t, 0.1 + li * 0.2) }}>
          <div style={{ fontSize: body * 1.1, fontWeight: 500, marginBottom: 20 * s }}>{ln.label}</div>
          <div style={{ position: "relative", height: 80 * s }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 40 * s, height: 2 * s, background: c.line }} />
            {ln.items.map((it, ii) => {
              const k = reveal(t, cues[order.get(`${li}:${ii}`) ?? 0]);
              return (
                <div key={ii} style={{ position: "absolute", left: laneX(it.at, x0, lw), top: 6 * s, ...lift(k, -18 * s), padding: `${12 * s}px ${18 * s}px`, borderRadius: 12 * s, background: li === 0 ? tone : c.paper, color: li === 0 ? "#fff" : c.ink, border: `${2 * s}px solid ${tone}`, fontSize: body * 0.9, fontWeight: 500, whiteSpace: "nowrap" }}>{it.text}</div>
              );
            })}
          </div>
        </div>
      ))}
      {panel.axis ? <div style={{ fontSize: body * 0.75, color: c.inkSoft, textAlign: "right", opacity: reveal(t, 0.4) }}>{panel.axis}</div> : null}
    </div>
  );
};

const PANELS = { bars: Bars, cards: Cards, flow: Flow, lanes: Lanes };
const itemCount = (p: Panel) => (p.type === "bars" ? p.rows?.length ?? 0 : p.type === "cards" ? p.items?.length ?? 0 : p.type === "flow" ? 3 : (p.lanes ?? []).reduce((n, l) => n + l.items.length, 0));

const CaptionColumn: React.FC = () => {
  const { L, c, t, beat, tone } = useKit();
  const kIn = reveal(t, 0);
  const kCap = reveal(t, 0.05);
  return (
    <>
      <div style={{ position: "absolute", left: L.label.x, top: L.label.y, width: L.label.w, fontSize: L.px.label, letterSpacing: 3 * L.s, textTransform: "uppercase", color: c.accent, opacity: kIn }}>{beat.eyebrow}</div>
      {beat.tile ? (
        <div style={{ position: "absolute", left: L.tile.x, top: L.tile.y, display: "flex", alignItems: "center", gap: 22 * L.s, ...lift(kIn, 20 * L.s) }}>
          <LetterTile tile={beat.tile} size={L.tile.w} ink={c.ink} tone={tone(beat.tile.tone)} />
          <span style={{ fontSize: L.px.product, color: c.accent }}>{beat.product}</span>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: L.caption.x, top: L.caption.y, width: L.caption.w, fontSize: L.px.caption, fontWeight: 400, lineHeight: 1.14, color: c.ink, ...lift(kCap, 24 * L.s) }}>{beat.caption}</div>
      {beat.source ? <div style={{ position: "absolute", left: L.source.x, top: L.source.y, width: L.source.w, fontSize: L.px.source, color: c.inkSoft, opacity: reveal(t, 0.5) }}>{beat.source}</div> : null}
    </>
  );
};

export const UiScreen: React.FC = () => {
  const { L, c, t, beat, tone, push } = useKit();
  const panel = beat.panel;
  if (!panel || !(panel.type in PANELS)) throw new Error(`beat ${beat.n}: UiScreen needs beat.panel with type bars | cards | flow | lanes`);
  const Body = PANELS[panel.type];
  const cues = cueTimes(itemCount(panel), beat);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: c.ink, ...push }}>
      <CaptionColumn />
      <div style={{ position: "absolute", left: L.panel.x, top: L.panel.y, width: L.panel.w, height: L.panel.h }}>
        <Window panel={panel} s={L.s} c={c} tone={tone(panel.tone)} k={reveal(t, 0.1, 0.6)}>
          <Body panel={panel} t={t} cues={cues} s={L.s} c={c} tone={tone(panel.tone)} body={L.px.body} w={L.panel.w} h={L.panel.h} tall={L.shape === "tall"} />
        </Window>
      </div>
    </div>
  );
};

export const UiSteps: React.FC = () => {
  const { L, c, t, beat, push } = useKit();
  const steps = beat.steps ?? [];
  const cues = cueTimes(steps.length, beat);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: c.ink, ...push }}>
      <CaptionColumn />
      <div style={{ position: "absolute", left: L.panel.x, top: L.panel.y + 40 * L.s, width: L.panel.w, display: "flex", flexDirection: "column", gap: 30 * L.s }}>
        {steps.map((st, i) => {
          // the row shells are on screen from the first frame (a checklist waiting to fill), so a cross-fade into this card never dips to a blank frame
          const k = reveal(t, cues[i]);
          return (
            <div key={st} style={{ display: "flex", gap: 24 * L.s, alignItems: "center", padding: `${26 * L.s}px ${28 * L.s}px`, borderRadius: 16 * L.s, background: c.card, border: `1px solid ${c.line}`, opacity: 0.45 + 0.55 * k }}>
              <div style={{ width: 58 * L.s, height: 58 * L.s, flexShrink: 0, borderRadius: 29 * L.s, background: k > 0 ? c.accent : c.line, color: "#fff", fontSize: 28 * L.s, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: L.px.body * 1.1, lineHeight: 1.3, ...lift(k, 14 * L.s) }}>{st}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
