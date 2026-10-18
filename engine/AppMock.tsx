// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/src/theme.tsx  Reveal, Typed, AppTile, Pill, Win, ExampleTag, CreditLine (as migrated in content-thinking mashreq-demo1/theme.tsx) moved here with brand roles instead of a fixed palette;
//   its mocks.tsx (FlowCanvas, PlannerBoard, TeamsChannel, TaskTable) and the vault demo3.tsx chat and list pieces (ChatShell, Bubble, Streamed, ListHead/ListRow) moved here too.
//   1_social/py/video-gen/engine/UiExplainer.tsx checked first: its Window is a different, scaled look; this file keeps the mashreq look pixel for pixel.
// AppMock (CMO-8248): mock app windows and the small pieces they are built from. Colours come from the brand (mockPalette roles) and the app tiles
// from scene.json data.tiles ({ id: { name, letter, color } }), so nothing here names a client or a product. Every piece reads beat-fraction time only (useP).
import React from "react";
import { useBrand, useP, useScene } from "./beat";
import { alpha, mockPalette, streamCount, typedState } from "./appMockMath.js";

export type TileSpec = { name: string; letter: string; color: string };
export type Task = { task: string; owner: string; due: string };

/** Brand roles, font and app tiles for every mock piece. */
export const useMock = () => {
  const brand = useBrand();
  const data = (useScene().data ?? {}) as { tiles?: Record<string, TileSpec> };
  const c = mockPalette(brand.colors);
  const tile = (id: string): TileSpec => data.tiles?.[id] ?? { name: id, letter: id.slice(0, 1).toUpperCase(), color: c.accent };
  return { c, font: brand.font, tile };
};

/** A colour named in scene.json: a brand role ("accent", "dark", ...) or a literal colour; undefined keeps the fallback. */
export const toneOf = (c: Record<string, string>, v: string | undefined, fallback?: string) => (v ? c[v] ?? v : fallback);

/** Fade and lift children in over [a, b] (fractions of the beat). */
export const Reveal: React.FC<{ a: number; b?: number; dy?: number; dx?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ a, b, dy = 18, dx = 0, style, children }) => {
  const p = useP();
  const k = p(a, b ?? a + 0.08);
  return <div style={{ opacity: k, transform: `translate(${(1 - k) * dx}px, ${(1 - k) * dy}px)`, ...style }}>{children}</div>;
};

/** Text typed out between two fractions of the beat, caret while typing. */
export const Typed: React.FC<{ text: string; a: number; b: number; caret?: boolean }> = ({ text, a, b, caret = true }) => {
  const p = useP();
  const { n, caret: on } = typedState(text.length, p(a, b));
  return (
    <span>
      {text.slice(0, n)}
      {caret && on ? <span style={{ borderLeft: "3px solid currentColor", marginLeft: 2 }} /> : null}
    </span>
  );
};

/** Lines streamed in character by character between two fractions of the beat. */
export const Streamed: React.FC<{ lines: string[]; a: number; b: number }> = ({ lines, a, b }) => {
  const p = useP();
  return <div style={{ whiteSpace: "pre-wrap" }}>{lines.join("\n").slice(0, streamCount(lines, p(a, b)))}</div>;
};

/** Plain letter tile standing in for an app icon. Generic on purpose, not a brand mark. */
export const AppTile: React.FC<{ id: string; size?: number; label?: boolean }> = ({ id, size = 64, label = false }) => {
  const { c, font, tile } = useMock();
  const t = tile(id);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      <div style={{ width: size, height: size, borderRadius: size * 0.24, background: t.color, color: c.onDark, fontFamily: font, fontWeight: 600, fontSize: size * 0.5, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
        {t.letter}
      </div>
      {label ? <span style={{ fontSize: size * 0.42, color: c.onDark, fontWeight: 400 }}>{t.name}</span> : null}
    </div>
  );
};

export const Pill: React.FC<{ text: string; bg?: string; fg?: string; size?: number }> = ({ text, bg, fg, size = 18 }) => {
  const { c } = useMock();
  return <span style={{ display: "inline-block", padding: `${size * 0.2}px ${size * 0.6}px`, borderRadius: 999, background: bg ?? c.mist, color: fg ?? c.ink, fontSize: size, fontWeight: 500, whiteSpace: "nowrap" }}>{text}</span>;
};

/** Mock app window: paper card with a title bar in the app tile's colour. */
export const Win: React.FC<{ app: string; title: string; w?: number | string; h?: number | string; style?: React.CSSProperties; children: React.ReactNode }> = ({ app, title, w = "100%", h = "100%", style, children }) => {
  const { c, font, tile } = useMock();
  const t = tile(app);
  return (
    <div style={{ width: w, height: h, background: c.paper, borderRadius: 16, overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column", color: c.ink, fontFamily: font, ...style }}>
      <div style={{ height: 52, background: t.color, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", color: c.onDark, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17 }}>{t.letter}</div>
        <span style={{ fontSize: 21, fontWeight: 500 }}>{title}</span>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/** Small pill above the top right of a stage saying what kind of data is on screen. */
export const ExampleTag: React.FC<{ text?: string }> = ({ text = "Example data" }) => {
  const { c, font } = useMock();
  return (
    <div style={{ position: "absolute", right: 0, top: -54, fontFamily: font }}>
      <Pill text={text} bg={c.alert} fg={c.dark} size={20} />
    </div>
  );
};

/** Data credit along the bottom of the frame. */
export const CreditLine: React.FC<{ text: string }> = ({ text }) => {
  const { c, font } = useMock();
  return <div style={{ position: "absolute", left: 90, right: 90, bottom: 62, fontFamily: font, fontSize: 22, color: c.soft, textAlign: "center" }}>{text}</div>;
};

export type FlowBox = { app: string; title: string; detail?: string; ai?: boolean; at: number };

/** Flow designer canvas: boxes slide in top to bottom, joined by connectors; ai boxes may glow over [glow]. */
export const FlowCanvas: React.FC<{ app: string; title: string; boxes: FlowBox[]; glow?: [number, number]; header?: React.ReactNode }> = ({ app, title, boxes, glow, header }) => {
  const { c, tile } = useMock();
  const p = useP();
  const g = glow ? Math.sin(Math.PI * p(glow[0], glow[1])) : 0;
  return (
    <Win app={app} title={title}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: c.mist, backgroundImage: `radial-gradient(${c.paper} 1.4px, transparent 1.4px)`, backgroundSize: "26px 26px" }} />
      {header}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: header ? 150 : 50 }}>
        {boxes.map((b, i) => (
          <Reveal key={b.title} a={b.at} b={b.at + 0.07} dy={-40}>
            {i > 0 ? <div style={{ width: 3, height: 40, background: c.sage, margin: "0 auto" }} /> : null}
            <div style={{ width: 620, background: c.card, borderRadius: 12, border: `2px solid ${b.ai && g > 0 ? c.glow : c.rule}`, boxShadow: b.ai ? `0 0 ${40 * g}px ${12 * g}px ${alpha(c.glow, 0.7)}` : "0 4px 14px rgba(0,0,0,0.08)", padding: "18px 22px", display: "flex", gap: 18, alignItems: "center" }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: tile(b.app).color, color: c.onDark, fontWeight: 700, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{b.ai ? "AI" : tile(b.app).letter}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{b.title}</div>
                {b.detail ? <div style={{ fontSize: 19, color: c.muted, marginTop: 4 }}>{b.detail}</div> : null}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Win>
  );
};

/** Task board with cards dropping into the first bucket. Compact boards show only the first bucket and name the rest in its header. */
export const TaskBoard: React.FC<{ app: string; title: string; tasks: Task[]; start: number; step: number; compact?: boolean; buckets?: string[] }> = ({ app, title, tasks, start, step, compact, buckets = ["To do", "In progress", "Done"] }) => {
  const { c, tile } = useMock();
  const shown = compact ? buckets.slice(0, 1) : buckets;
  return (
    <Win app={app} title={title}>
      <div style={{ display: "flex", gap: 20, padding: 22, height: "100%", boxSizing: "border-box", background: c.mist }}>
        {shown.map((b, bi) => (
          <div key={b} style={{ flex: bi === 0 ? 1.6 : 1, display: "flex", flexDirection: "column", gap: compact ? 10 : 14 }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: c.ink, marginBottom: 4, whiteSpace: "nowrap" }}>
              {b}{bi === 0 ? `  (${tasks.length})` : "  (0)"}
              {compact ? <span style={{ fontWeight: 400, color: c.muted, fontSize: 18, marginLeft: 18 }}>{buckets.slice(1).map((x) => `${x} (0)`).join(", ")}</span> : null}
            </div>
            {bi === 0
              ? tasks.map((t, i) => (
                  <Reveal key={t.task} a={start + i * step} b={start + i * step + 0.05} dy={-50}>
                    <div style={{ background: c.card, borderRadius: 10, borderLeft: `6px solid ${tile(app).color}`, padding: compact ? "10px 14px" : "14px 16px", boxShadow: "0 3px 10px rgba(0,0,0,0.08)" }}>
                      <div style={{ fontSize: compact ? 19 : 22, fontWeight: 500 }}>{t.task}</div>
                      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <Pill text={t.owner} size={compact ? 15 : 17} />
                        <Pill text={`Due ${t.due}`} size={compact ? 15 : 17} />
                      </div>
                    </div>
                  </Reveal>
                ))
              : null}
          </div>
        ))}
      </div>
    </Win>
  );
};

export type Msg = { from: string; bot?: boolean; at: number; body: React.ReactNode };

/** Chat channel with messages appearing in order; bot messages wear the bot tile's colour and initials. */
export const ChannelFeed: React.FC<{ app: string; title: string; msgs: Msg[]; botTile: string; botInitials?: string }> = ({ app, title, msgs, botTile, botInitials = "AF" }) => {
  const { c, tile } = useMock();
  return (
    <Win app={app} title={title}>
      <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16, background: c.mist, height: "100%", boxSizing: "border-box" }}>
        {msgs.map((m, i) => (
          <Reveal key={i} a={m.at} b={m.at + 0.06}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: m.bot ? tile(botTile).color : c.muted, color: c.onDark, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.bot ? botInitials : m.from.slice(0, 2)}</div>
              <div style={{ background: c.card, borderRadius: 10, padding: "12px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", flex: 1 }}>
                <div style={{ fontSize: 17, color: c.muted, marginBottom: 6 }}>{m.from}</div>
                <div style={{ fontSize: 21, lineHeight: 1.4 }}>{m.body}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Win>
  );
};

/** Plain task table (task, owner, due), rows sliding in from the right. */
export const TaskTable: React.FC<{ tasks: Task[]; start: number; step: number; size?: number; heads?: [string, string, string] }> = ({ tasks, start, step, size = 21, heads = ["Task", "Owner", "Due"] }) => {
  const { c } = useMock();
  return (
    <div style={{ fontSize: size }}>
      <div style={{ display: "grid", gridTemplateColumns: "2.6fr 1.2fr 1fr", gap: 10, fontWeight: 600, color: c.muted, borderBottom: `2px solid ${c.rule}`, paddingBottom: 8 }}>
        {heads.map((h) => <span key={h}>{h}</span>)}
      </div>
      {tasks.map((t, i) => (
        <Reveal key={t.task} a={start + i * step} b={start + i * step + 0.05} dx={30} dy={0}>
          <div style={{ display: "grid", gridTemplateColumns: "2.6fr 1.2fr 1fr", gap: 10, padding: "10px 0", borderBottom: `1px solid ${c.rule}` }}>
            <span>{t.task}</span><span>{t.owner}</span><span>{t.due}</span>
          </div>
        </Reveal>
      ))}
    </div>
  );
};

export type Col = { key: string; label: string; fr: number };

/** Header row of a data list. */
export const DataHead: React.FC<{ cols: Col[] }> = ({ cols }) => {
  const { c } = useMock();
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols.map((x) => `${x.fr}fr`).join(" "), gap: 8, fontSize: 18, fontWeight: 600, color: c.muted, padding: "10px 18px", borderBottom: `2px solid ${c.rule}` }}>
      {cols.map((x) => <span key={x.key}>{x.label}</span>)}
    </div>
  );
};

/** One data list row; hl (0..1) washes it in the alert colour. The first column is set in medium weight. */
export const DataRow: React.FC<{ cols: Col[]; row: Record<string, unknown>; hl?: number }> = ({ cols, row, hl = 0 }) => {
  const { c } = useMock();
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols.map((x) => `${x.fr}fr`).join(" "), gap: 8, fontSize: 19, padding: "7px 18px", borderBottom: `1px solid ${c.rule}`, background: alpha(c.alert, 0.5 * hl) }}>
      {cols.map((x, i) => <span key={x.key} style={i === 0 ? { fontWeight: 500 } : undefined}>{String(row[x.key] ?? "")}</span>)}
    </div>
  );
};

/** Chat window body on a soft background. */
export const ChatShell: React.FC<{ app: string; title: string; children: React.ReactNode }> = ({ app, title, children }) => {
  const { c } = useMock();
  return (
    <Win app={app} title={title}>
      <div style={{ padding: "26px 30px", background: c.mist, height: "100%", boxSizing: "border-box" }}>{children}</div>
    </Win>
  );
};

/** One chat bubble: mine on the right on a tint, the agent's on the left on a card. */
export const Bubble: React.FC<{ me?: boolean; children: React.ReactNode }> = ({ me, children }) => {
  const { c } = useMock();
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", marginBottom: 18 }}>
      <div style={{ maxWidth: 820, background: me ? alpha(c.accent, 0.22) : c.card, border: me ? undefined : `1px solid ${c.rule}`, borderRadius: 16, padding: "16px 22px", fontSize: 24, lineHeight: 1.45, color: c.ink }}>{children}</div>
    </div>
  );
};

/** Big number with a label on a translucent card, for a result beat on a dark stage. */
export const StatCard: React.FC<{ n: string; label: string; a: number; color: string }> = ({ n, label, a, color }) => {
  const { c } = useMock();
  return (
    <Reveal a={a} b={a + 0.12}>
      <div style={{ background: "rgba(255,255,255,0.14)", border: `1px solid ${c.line}`, borderRadius: 18, padding: "22px 30px", color: c.onDark }}>
        <div style={{ fontSize: 84, fontWeight: 300, color }}>{n}</div>
        <div style={{ fontSize: 26 }}>{label}</div>
      </div>
    </Reveal>
  );
};

export type Email = { subject: string; from: string; intro: string; lines: string[] };

/** An email body; with hl = [a, b] each listed line lights up in turn. */
export const EmailBody: React.FC<{ email: Email; hl?: [number, number]; size?: number }> = ({ email, hl, size = 22 }) => {
  const { c } = useMock();
  const p = useP();
  const n = email.lines.length;
  return (
    <div style={{ fontSize: size, lineHeight: 1.5, color: c.ink }}>
      <div style={{ fontSize: size + 4, fontWeight: 600 }}>{email.subject}</div>
      <div style={{ color: c.muted, fontSize: size - 3, marginBottom: 14 }}>From: {email.from}</div>
      <div>{email.intro}</div>
      {email.lines.map((l, i) => {
        const k = hl ? p(hl[0] + i * ((hl[1] - hl[0]) / n), hl[0] + (i + 0.6) * ((hl[1] - hl[0]) / n)) : 0;
        return <div key={l} style={{ marginTop: 6, padding: "2px 8px", borderRadius: 6, background: alpha(c.alert, 0.45 * k) }}>{l}</div>;
      })}
    </div>
  );
};

export type Run = [string, string, string];

/** Small run history window: when, state (ticked), how long. */
export const RunHistory: React.FC<{ app: string; title: string; runs: Run[]; h?: number }> = ({ app, title, runs, h = 230 }) => {
  const { c } = useMock();
  return (
    <Win app={app} title={title} h={h}>
      <div style={{ padding: "10px 18px" }}>
        {runs.map(([when, state, took]) => (
          <div key={when} style={{ display: "flex", justifyContent: "space-between", fontSize: 20, padding: "8px 0", borderBottom: `1px solid ${c.rule}` }}>
            <span>{when}</span><span style={{ color: c.ink, fontWeight: 600 }}><span style={{ color: c.ok }}>{"✓"}</span> {state}</span><span style={{ color: c.muted }}>{took}</span>
          </div>
        ))}
      </div>
    </Win>
  );
};
