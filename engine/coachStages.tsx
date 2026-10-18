// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/src/demo1.tsx  and demo2.tsx in the same folder: their stage screens
//   (Problem, Trigger, Extract, Board, Channel, Result; Problem, Paste, Output, FollowUps, Proof) made data driven here. The demo1 look is the content-thinking
//   mashreq-demo1 migration (brand tokens instead of hex); demo2's few off-brand hexes are mapped to brand roles the same way.
// Coach demo stages, part 1 (CMO-8248): app-workflow screens. Each stage type is one choreography (its beat-fraction timings live here);
// all words, tiles, rows and colours come from the beat's "stage" object in scene.json ("$key" strings pull shared content from scene data).
import React from "react";
import { useP } from "./beat";
import { alpha, countUp } from "./appMockMath.js";
import { ChannelFeed, EmailBody, FlowCanvas, Pill, Reveal, RunHistory, StatCard, TaskBoard, TaskTable, Typed, Win, toneOf, useMock } from "./AppMock";
import type { Email, FlowBox, Msg, Run, Task } from "./AppMock";

type PillSpec = { text: string; bg?: string; fg?: string };
type WinSpec = { app: string; title: string };
const HAND_FONT = "\"Segoe Print\", \"Bradley Hand\", cursive"; // sticky notes: a handwriting face from the system

/** "Time spent: {n} min" with {n} counted up. */
const fill = (template: string, n: number) => template.replace("{n}", String(n));

/** Inbox with one email whose requests light up, then one request retyped by hand while a counter climbs. */
export const InboxStage: React.FC<{ stage: WinSpec & { inbox: [string, string, string][]; email: Email; hl?: [number, number]; retype: WinSpec & { label: string; text: string; note: string }; counter: { text: string; to: number } } }> = ({ stage }) => {
  const { c, tile } = useMock();
  const p = useP();
  const n = countUp(stage.counter.to, p(0.62, 1));
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Win app={stage.app} title={stage.title}>
        <div style={{ display: "flex", height: "100%" }}>
          <div style={{ width: 330, borderRight: `1px solid ${c.rule}`, background: c.mist }}>
            {stage.inbox.map(([from, subj, time], i) => (
              <div key={subj} style={{ padding: "14px 18px", borderBottom: `1px solid ${c.rule}`, background: i === 0 ? c.paper : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, fontWeight: i === 0 ? 700 : 500 }}><span>{from}</span><span style={{ color: c.muted, fontWeight: 400 }}>{time}</span></div>
                <div style={{ fontSize: 17, color: c.muted, marginTop: 3 }}>{subj}</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, padding: "26px 30px" }}>
            <EmailBody email={stage.email} hl={stage.hl ?? [0.22, 0.55]} />
          </div>
        </div>
      </Win>
      <Reveal a={0.58} b={0.66} style={{ position: "absolute", right: -20, bottom: -30, width: 560 }}>
        <Win app={stage.retype.app} title={stage.retype.title} h={190}>
          <div style={{ padding: "18px 22px", fontSize: 22 }}>
            <div style={{ color: c.muted, fontSize: 17 }}>{stage.retype.label}</div>
            <div style={{ borderBottom: `2px solid ${tile(stage.retype.app).color}`, padding: "6px 0" }}><Typed text={stage.retype.text} a={0.62} b={0.9} /></div>
            <div style={{ color: c.muted, fontSize: 17, marginTop: 10 }}>{stage.retype.note}</div>
          </div>
        </Win>
      </Reveal>
      <Reveal a={0.6} b={0.66} style={{ position: "absolute", left: 20, bottom: -24 }}>
        <Pill text={fill(stage.counter.text, n)} bg={c.red} fg={c.onDark} size={24} />
      </Reveal>
    </div>
  );
};

type FlowHeader =
  | { type: "trigger"; pill: string; note: string; pills: PillSpec[] }
  | { type: "describe"; label: string; text: string; typeAt?: [number, number] };

const Header: React.FC<{ h: FlowHeader }> = ({ h }) => {
  const { c } = useMock();
  if (h.type === "describe") {
    const [a, b] = h.typeAt ?? [0.02, 0.2];
    return (
      <div style={{ position: "absolute", left: 30, right: 30, top: 24, background: c.card, border: `2px solid ${c.glow}`, borderRadius: 12, padding: "14px 18px", fontSize: 20, color: c.ink }}>
        <div style={{ color: c.muted, fontSize: 17 }}>{h.label}</div>
        <Typed text={h.text} a={a} b={b} />
      </div>
    );
  }
  return (
    <Reveal a={0.3} b={0.38} style={{ position: "absolute", left: 30, top: 30, right: 30 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 21, color: c.ink }}>
        <Pill text={h.pill} size={20} />
        <span style={{ color: c.muted }}>{h.note}</span>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        {h.pills.map((x) => <Pill key={x.text} text={x.text} bg={toneOf(c, x.bg)} fg={toneOf(c, x.fg)} size={20} />)}
      </div>
    </Reveal>
  );
};

/** Flow designer: boxes slide in; an optional header (trigger pills or a typed plain-words description) and an optional run history card. */
export const FlowStage: React.FC<{ stage: WinSpec & { boxes: FlowBox[]; glow?: [number, number]; header?: FlowHeader; runs?: WinSpec & { rows: Run[] } } }> = ({ stage }) => (
  <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <FlowCanvas app={stage.app} title={stage.title} boxes={stage.boxes} glow={stage.glow} header={stage.header ? <Header h={stage.header} /> : undefined} />
    {stage.runs ? (
      <Reveal a={0.58} b={0.66} style={{ position: "absolute", left: -590, top: 540, width: 470 }}>
        <RunHistory app={stage.runs.app} title={stage.runs.title} runs={stage.runs.rows} />
      </Reveal>
    ) : null}
  </div>
);

/** Source email on the left, a glowing AI chip, and the extracted task table on the right. */
export const ExtractStage: React.FC<{ stage: { source: WinSpec & { email: Email }; ai: { tile: string; label?: string }; out: WinSpec; tasks: Task[] } }> = ({ stage }) => {
  const { c, tile } = useMock();
  const p = useP();
  const g = Math.sin(Math.PI * p(0.06, 0.5));
  return (
    <div style={{ display: "flex", gap: 24, height: "100%", alignItems: "stretch" }}>
      <Win app={stage.source.app} title={stage.source.title} w={430}>
        <div style={{ padding: 20 }}><EmailBody email={stage.source.email} size={17} /></div>
      </Win>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: 24, background: tile(stage.ai.tile).color, color: c.onDark, fontSize: 40, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${60 * g}px ${20 * g}px ${alpha(c.glow, 0.8)}` }}>{stage.ai.label ?? "AI"}</div>
      </div>
      <Win app={stage.out.app} title={stage.out.title} w={560}>
        <div style={{ padding: 22 }}>
          <TaskTable tasks={stage.tasks} start={0.32} step={0.09} size={19} />
        </div>
      </Win>
    </div>
  );
};

/** Task board filling up. */
export const BoardStage: React.FC<{ stage: WinSpec & { tasks: Task[]; start?: number; step?: number; compact?: boolean; buckets?: string[] } }> = ({ stage }) => (
  <TaskBoard app={stage.app} title={stage.title} tasks={stage.tasks} start={stage.start ?? 0.22} step={stage.step ?? 0.09} compact={stage.compact} buckets={stage.buckets} />
);

type MsgSpec = { from: string; bot?: boolean; at: number; text?: string; title?: string; tasks?: Task[]; taskAt?: [number, number] };

const MsgBody: React.FC<{ m: MsgSpec }> = ({ m }) => {
  const { c } = useMock();
  if (m.tasks) {
    const [a0, step] = m.taskAt ?? [0.22, 0.07];
    return (
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{m.title}</div>
        {m.tasks.map((t, i) => (
          <Reveal key={t.task} a={a0 + i * step} b={a0 + 0.05 + i * step} dy={8}>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${c.rule}`, padding: "6px 0", fontSize: 20 }}>
              <span>{t.task}</span><span style={{ color: c.muted }}>{t.owner}, {t.due}</span>
            </div>
          </Reveal>
        ))}
      </div>
    );
  }
  if (m.title) return <div><b>{m.title}</b><div style={{ fontSize: 18, color: c.muted }}>{m.text}</div></div>;
  return <>{m.text}</>;
};

/** Team channel: messages in order; a message may carry a titled task list that reveals row by row. */
export const ChannelStage: React.FC<{ stage: WinSpec & { botTile: string; botInitials?: string; msgs: MsgSpec[] } }> = ({ stage }) => {
  const msgs: Msg[] = stage.msgs.map((m) => ({ from: m.from, bot: m.bot, at: m.at, body: <MsgBody m={m} /> }));
  return <ChannelFeed app={stage.app} title={stage.title} msgs={msgs} botTile={stage.botTile} botInitials={stage.botInitials} />;
};

/** The source email beside result stats. */
export const ResultStage: React.FC<{ stage: { source: WinSpec & { email: Email }; stats: { n: string; label: string; a: number; tone?: string }[] } }> = ({ stage }) => {
  const { c } = useMock();
  return (
    <div style={{ display: "flex", gap: 30, height: "100%" }}>
      <Reveal a={0} b={0.12} style={{ width: 470 }}>
        <Win app={stage.source.app} title={stage.source.title} h={640}>
          <div style={{ padding: 20 }}><EmailBody email={stage.source.email} size={17} /></div>
        </Win>
      </Reveal>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, justifyContent: "center" }}>
        {stage.stats.map((s) => <StatCard key={s.label} n={s.n} label={s.label} a={s.a} color={toneOf(c, s.tone, c.accent) as string} />)}
      </div>
    </div>
  );
};

const NoteLines: React.FC<{ lines: string[]; size: number }> = ({ lines, size }) => {
  const { c } = useMock();
  return <div style={{ fontSize: size, lineHeight: 1.55, color: c.ink }}>{lines.map((l, i) => <div key={l} style={{ fontWeight: i === 0 ? 600 : 400 }}>{l}</div>)}</div>;
};

/** Meeting notes, sticky notes piling up around them, and a column of chase messages with a climbing count. */
export const NotesChaseStage: React.FC<{ stage: { notes: WinSpec & { lines: string[] }; stickies: { text: string; x: number; y: number; r: number }[]; chases: string[]; counter: { text: string } } }> = ({ stage }) => {
  const { c } = useMock();
  const p = useP();
  const sent = countUp(stage.chases.length, p(0.35, 0.9));
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Win app={stage.notes.app} title={stage.notes.title} w={700} h={400}>
        <div style={{ padding: "22px 26px" }}><NoteLines lines={stage.notes.lines} size={21} /></div>
      </Win>
      {stage.stickies.map((s, i) => (
        <Reveal key={s.text} a={0.1 + i * 0.1} b={0.16 + i * 0.1} dy={-30} style={{ position: "absolute", left: s.x, top: s.y }}>
          <div style={{ transform: `rotate(${s.r}deg)`, width: 260, padding: "22px 20px", background: c.alert, color: c.ink, fontSize: 26, fontFamily: HAND_FONT, boxShadow: "0 8px 18px rgba(0,0,0,0.22)" }}>{s.text}</div>
        </Reveal>
      ))}
      <div style={{ position: "absolute", right: 0, top: 0, width: 400, display: "flex", flexDirection: "column", gap: 12 }}>
        {stage.chases.map((x, i) => (
          <Reveal key={x} a={0.35 + i * 0.1} b={0.4 + i * 0.1} dx={30} dy={0}>
            <div style={{ background: c.card, borderRadius: 12, padding: "12px 16px", fontSize: 20, color: c.ink, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{x}</div>
          </Reveal>
        ))}
        <Reveal a={0.4} b={0.46}>
          <Pill text={fill(stage.counter.text, sent)} bg={c.red} fg={c.onDark} size={24} />
        </Reveal>
      </div>
    </div>
  );
};

/** Test panel: text is pasted into a box, a pointer presses Run, status pills follow. */
export const PasteRunStage: React.FC<{ stage: WinSpec & { label: string; lines: string[]; button: string; buttonTile: string; pills: (PillSpec & { at: [number, number] })[] } }> = ({ stage }) => {
  const { c, tile } = useMock();
  const p = useP();
  const pasted = p(0.18, 0.24);
  const press = p(0.5, 0.53) - p(0.55, 0.58);
  const cx = 700 - 615 * p(0.36, 0.5);
  const cy = 300 + 200 * p(0.36, 0.5);
  return (
    <Win app={stage.app} title={stage.title}>
      <div style={{ padding: "26px 32px" }}>
        <div style={{ fontSize: 20, color: c.muted, marginBottom: 8 }}>{stage.label}</div>
        <div style={{ height: 390, border: `2px solid ${pasted > 0 && pasted < 1 ? c.glow : c.rule}`, borderRadius: 10, padding: "16px 20px", background: c.card }}>
          <div style={{ opacity: pasted }}><NoteLines lines={stage.lines} size={21} /></div>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 26 }}>
          <div style={{ padding: "14px 44px", borderRadius: 10, background: tile(stage.buttonTile).color, color: c.onDark, fontSize: 26, fontWeight: 600, transform: `scale(${1 - 0.08 * press})` }}>{stage.button}</div>
          {stage.pills.map((x) => <Reveal key={x.text} a={x.at[0]} b={x.at[1]}><Pill text={x.text} bg={toneOf(c, x.bg)} fg={toneOf(c, x.fg)} size={20} /></Reveal>)}
        </div>
      </div>
      <div style={{ position: "absolute", left: cx, top: cy, width: 0, height: 0, borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderBottom: `28px solid ${c.ink}`, transform: "rotate(-30deg)", opacity: p(0.3, 0.36) }} />
    </Win>
  );
};

/** AI step output: bulleted minutes, then an action-item table, then a closing pill. */
export const OutputStage: React.FC<{ stage: WinSpec & { minutesLabel: string; minutes: string[]; actionsLabel: string; tasks: Task[]; pill?: PillSpec } }> = ({ stage }) => {
  const { c } = useMock();
  const head: React.CSSProperties = { fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: c.muted };
  return (
    <Win app={stage.app} title={stage.title}>
      <div style={{ padding: "24px 32px", color: c.ink }}>
        <div style={head}>{stage.minutesLabel}</div>
        <div style={{ margin: "10px 0 26px" }}>
          {stage.minutes.map((m, i) => (
            <Reveal key={m} a={0.06 + i * 0.07} b={0.11 + i * 0.07} dx={20} dy={0}>
              <div style={{ fontSize: 24, padding: "4px 0" }}>{"•"}  {m}</div>
            </Reveal>
          ))}
        </div>
        <div style={{ ...head, marginBottom: 10 }}>{stage.actionsLabel}</div>
        <TaskTable tasks={stage.tasks} start={0.42} step={0.1} size={23} />
        {stage.pill ? (
          <Reveal a={0.8} b={0.86} style={{ marginTop: 22 }}>
            <Pill text={stage.pill.text} bg={toneOf(c, stage.pill.bg)} fg={toneOf(c, stage.pill.fg)} size={21} />
          </Reveal>
        ) : null}
      </div>
    </Win>
  );
};
