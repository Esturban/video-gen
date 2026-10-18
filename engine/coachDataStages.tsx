// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/src/demo3.tsx  its stage screens (Problem, List, Card, Ask, FollowUp, Proof)
//   made data driven here; its off-brand hexes (sticky yellow, salmon cells, lavender bubble, pink alert box) mapped to brand roles.
// Coach demo stages, part 2 (CMO-8248): data views. A scrolling spreadsheet, a list table, a red/amber/green status card, an agent chat, and a chat
// answer beside the list it came from. Rows, columns, questions and answers all come from the beat's "stage" in scene.json.
import React from "react";
import { useP, useSeconds } from "./beat";
import { alpha, scrollOffset } from "./appMockMath.js";
import { Bubble, ChatShell, DataHead, DataRow, Reveal, Streamed, Typed, Win, useMock } from "./AppMock";
import type { Col } from "./AppMock";

type WinSpec = { app: string; title: string };
type Row = Record<string, unknown>;
const BAR_WIDTHS = [0.9, 0.5, 0.7, 0.35, 0.8, 0.6, 0.45, 0.75]; // placeholder cell bars, a fixed pattern so every frame draws the same

/** An endless spreadsheet scrolling by while chat bubbles pop up over it. */
export const SheetScrollStage: React.FC<{ stage: WinSpec & { rows?: number; cols?: number; speed?: number; bubbles: string[]; bubbleTile: string } }> = ({ stage }) => {
  const { c, tile } = useMock();
  const s = useSeconds();
  const rows = stage.rows ?? 40;
  const cols = stage.cols ?? 14;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Win app={stage.app} title={stage.title}>
        <div style={{ transform: `translateY(${scrollOffset(s, stage.speed ?? 120, 440)}px)` }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ display: "flex", borderBottom: `1px solid ${c.rule}` }}>
              {Array.from({ length: cols }).map((__, k) => (
                <div key={k} style={{ width: 82, height: 34, borderRight: `1px solid ${c.rule}`, display: "flex", alignItems: "center", padding: "0 6px", background: (r * 7 + k * 3) % 11 === 0 ? alpha(c.alert, 0.55) : (r * 5 + k) % 13 === 0 ? alpha(c.red, 0.35) : undefined }}>
                  <div style={{ height: 9, borderRadius: 4, background: alpha(c.sage, 0.5), width: `${BAR_WIDTHS[(r + k) % BAR_WIDTHS.length] * 100}%` }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Win>
      {stage.bubbles.map((q, i) => (
        <Reveal key={q} a={0.25 + i * 0.15} b={0.31 + i * 0.15} dy={30} style={{ position: "absolute", right: 40 + i * 150, top: 140 + i * 170 }}>
          <div style={{ background: tile(stage.bubbleTile).color, color: c.onDark, fontSize: 34, padding: "16px 28px", borderRadius: 26, boxShadow: "0 10px 26px rgba(0,0,0,0.3)" }}>{q}</div>
        </Reveal>
      ))}
    </div>
  );
};

/** A list table whose rows arrive in turn, with an optional schedule badge in the corner. */
export const DataListStage: React.FC<{ stage: WinSpec & { cols: Col[]; rows: Row[]; badge?: { tile: string; head: string; big: string; note: string } } }> = ({ stage }) => {
  const { c, tile } = useMock();
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Win app={stage.app} title={stage.title}>
        <DataHead cols={stage.cols} />
        {stage.rows.map((r, i) => (
          <Reveal key={String(r[stage.cols[0].key])} a={0.04 + i * 0.025} b={0.08 + i * 0.025} dy={10}><DataRow cols={stage.cols} row={r} /></Reveal>
        ))}
      </Win>
      {stage.badge ? (
        <Reveal a={0.62} b={0.7} style={{ position: "absolute", right: 24, bottom: -30 }}>
          <div style={{ background: c.card, borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", overflow: "hidden", width: 250, textAlign: "center", color: c.ink }}>
            <div style={{ background: tile(stage.badge.tile).color, color: c.onDark, fontSize: 20, padding: "8px 0" }}>{stage.badge.head}</div>
            <div style={{ fontSize: 46, fontWeight: 600, padding: "8px 0 0" }}>{stage.badge.big}</div>
            <div style={{ fontSize: 18, color: c.muted, padding: "0 0 12px" }}>{stage.badge.note}</div>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
};

/** Status card: a red, amber or green dot and a reason per row, then the top risks, then one flagged line. */
export const StatusCardStage: React.FC<{ stage: WinSpec & { heading: string; rows: Row[]; nameKey: string; statusKey: string; reasonKey: string; risksTitle: string; risks: string[]; flag: { label: string; text: string } } }> = ({ stage }) => {
  const { c } = useMock();
  const dot: Record<string, string> = { red: c.red, amber: c.amber, green: c.ok };
  return (
    <Win app={stage.app} title={stage.title}>
      <div style={{ display: "flex", gap: 26, padding: "18px 24px", color: c.ink }}>
        <div style={{ flex: 1.35 }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{stage.heading}</div>
          {stage.rows.map((r, i) => (
            <Reveal key={String(r[stage.nameKey])} a={0.04 + i * 0.03} b={0.08 + i * 0.03} dx={16} dy={0}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 18, padding: "5px 0", borderBottom: `1px solid ${c.rule}` }}>
                <span style={{ width: 16, height: 16, borderRadius: 8, background: dot[String(r[stage.statusKey])] ?? c.muted, flexShrink: 0 }} />
                <span style={{ width: 230, fontWeight: 500, flexShrink: 0 }}>{String(r[stage.nameKey])}</span>
                <span style={{ color: c.muted }}>{String(r[stage.reasonKey])}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <Reveal a={0.56} b={0.62}>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>{stage.risksTitle}</div>
            {stage.risks.map((t, i) => (
              <div key={t} style={{ fontSize: 19, lineHeight: 1.4, padding: "8px 0", borderBottom: `1px solid ${c.rule}` }}>{i + 1}. {t}</div>
            ))}
          </Reveal>
          <Reveal a={0.76} b={0.82} style={{ marginTop: 24 }}>
            <div style={{ background: alpha(c.red, 0.12), border: `2px solid ${c.red}`, borderRadius: 12, padding: "14px 16px", fontSize: 20 }}>
              <b>{stage.flag.label}</b> {stage.flag.text}
            </div>
          </Reveal>
        </div>
      </div>
    </Win>
  );
};

/** Agent chat: earlier turns faded, a question typed live, the answer streamed in. */
export const AgentChatStage: React.FC<{ stage: WinSpec & { history?: { me?: boolean; text: string }[]; ask: string; typeAt: [number, number]; answer: string[]; answerAt: [number, number]; streamAt: [number, number] } }> = ({ stage }) => (
  <ChatShell app={stage.app} title={stage.title}>
    {stage.history?.length ? (
      <div style={{ opacity: 0.45 }}>
        {stage.history.map((h, i) => <Bubble key={i} me={h.me}>{h.text}</Bubble>)}
      </div>
    ) : null}
    <Bubble me><Typed text={stage.ask} a={stage.typeAt[0]} b={stage.typeAt[1]} /></Bubble>
    <Reveal a={stage.answerAt[0]} b={stage.answerAt[1]}><Bubble><Streamed lines={stage.answer} a={stage.streamAt[0]} b={stage.streamAt[1]} /></Bubble></Reveal>
  </ChatShell>
);

/** A chat answer beside the list it came from; the rows it names light up. */
export const ChatListStage: React.FC<{ stage: { chat: WinSpec & { lines: string[] }; list: WinSpec & { cols: Col[]; rows: Row[]; matchKey: string; match: string[] } } }> = ({ stage }) => {
  const { c } = useMock();
  const p = useP();
  const hit = new Set(stage.list.match);
  return (
    <div style={{ display: "flex", gap: 22, height: "100%" }}>
      <div style={{ width: 420 }}>
        <ChatShell app={stage.chat.app} title={stage.chat.title}>
          <div style={{ fontSize: 20, lineHeight: 1.5, color: c.ink }}>
            {stage.chat.lines.map((l) => <div key={l} style={{ marginBottom: 10 }}>{l}</div>)}
          </div>
        </ChatShell>
      </div>
      <div style={{ flex: 1 }}>
        <Win app={stage.list.app} title={stage.list.title}>
          <div style={{ transform: "scale(0.86)", transformOrigin: "top left", width: "116%" }}>
            <DataHead cols={stage.list.cols} />
            {stage.list.rows.map((r) => <DataRow key={String(r[stage.list.cols[0].key])} cols={stage.list.cols} row={r} hl={hit.has(String(r[stage.list.matchKey])) ? p(0.25, 0.4) : 0} />)}
          </div>
        </Win>
      </div>
    </div>
  );
};
