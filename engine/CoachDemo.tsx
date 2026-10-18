// REUSE_CHECKED: 4_agents/sh/thinking/wiki/domains/clients/atomcamp/mashreq-agile-coaches/source/motion/video/src/Demo.tsx  TitleCard, SceneFrame, BuildCard, the tag and credit rules
//   (Root.tsx SPECS: titleTiles, sceneTile, credit, exampleTag, tagFor) moved here as beat kinds reading scene.json data. 1_social/py/video-gen/engine/UiExplainer.tsx
//   was checked first: it is the generalised, rescaled cousin of this look; this file keeps the original 1920x1080 coach-demo layout exactly.
// CoachDemo (CMO-8248): a numbered "how a coach could build this" demo. Three kinds:
//   DemoTitle : "Demo N", the caption, a row of app tiles, the logo.
//   DemoFrame : label, app tile, product and caption on the left; the beat's stage screen on the right (beat.stage.type picks it), data tag, optional credit line.
//   DemoBuild : closing card, build steps arriving across the narration, then the starter prompt, then the logo.
// scene.json data: number, titleTiles, sceneTile {n: tile}, build {tool, steps, prompt}, tiles {id: {name, letter, color}}, logo (file in assets/),
//   exampleTag, tagFor {n: tag}, credit {text, beats}, labels (kind or eyebrow/build/prompt overrides), plus any shared content a stage names as "$key".
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { useBeat, useP, useScene } from "./beat";
import { beatTag, buildCues, resolveRefs, stageLabel } from "./appMockMath.js";
import { AppTile, CreditLine, ExampleTag, Reveal, useMock } from "./AppMock";
import { BoardStage, ChannelStage, ExtractStage, FlowStage, InboxStage, NotesChaseStage, OutputStage, PasteRunStage, ResultStage } from "./coachStages";
import { AgentChatStage, ChatListStage, DataListStage, SheetScrollStage, StatusCardStage } from "./coachDataStages";

type StageSpec = { type: string; [k: string]: unknown };
type StageFC = React.FC<{ stage: never }>;
type Build = { tool: string; steps: string[]; prompt: string };
type Data = {
  number?: number; titleTiles?: string[]; sceneTile?: Record<string, string>; build?: Build; logo?: string;
  exampleTag?: string; tagFor?: Record<string, string>; credit?: { text: string; beats: number[] }; labels?: Record<string, string>;
  [k: string]: unknown;
};
type DemoBeat = { n: number; start: number; end: number; kind: string; product?: string; caption?: string; voiceAt?: number; voice?: number; tag?: string; stage?: StageSpec };

/** Stage screens by stage.type. Split pairs two of them side by side (left at a fixed width). */
export const STAGES: Record<string, StageFC> = {
  inbox: InboxStage as StageFC, flow: FlowStage as StageFC, extract: ExtractStage as StageFC, board: BoardStage as StageFC, channel: ChannelStage as StageFC,
  result: ResultStage as StageFC, notesChase: NotesChaseStage as StageFC, pasteRun: PasteRunStage as StageFC, output: OutputStage as StageFC,
  sheetScroll: SheetScrollStage as StageFC, dataList: DataListStage as StageFC, statusCard: StatusCardStage as StageFC, chat: AgentChatStage as StageFC, chatList: ChatListStage as StageFC,
};

/** One stage screen from its spec; "split" lays out { left, right, leftWidth }. */
export const Stage: React.FC<{ spec: StageSpec }> = ({ spec }) => {
  if (spec.type === "split") {
    const s = spec as unknown as { left: StageSpec; right: StageSpec; leftWidth?: number; gap?: number };
    return (
      <div style={{ display: "flex", gap: s.gap ?? 22, height: "100%" }}>
        <div style={{ width: s.leftWidth ?? 520 }}><Stage spec={s.left} /></div>
        <div style={{ flex: 1 }}><Stage spec={s.right} /></div>
      </div>
    );
  }
  const Part = STAGES[spec.type];
  if (!Part) throw new Error(`stage type "${spec.type}" is not a CoachDemo stage (has: split, ${Object.keys(STAGES).join(", ")})`);
  return <Part stage={spec as never} />;
};

const useDemo = () => {
  const data = (useScene().data ?? {}) as Data;
  const beat = useBeat() as unknown as DemoBeat;
  return { data, beat };
};

const Logo: React.FC<{ file?: string; height: number }> = ({ file, height }) => (file ? <Img src={staticFile(file)} style={{ height }} /> : null);

export const DemoTitle: React.FC = () => {
  const { data, beat } = useDemo();
  const { c, font } = useMock();
  return (
    <AbsoluteFill style={{ fontFamily: font, color: c.onDark, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <Reveal a={0} b={0.15}>
        <div style={{ fontSize: 34, letterSpacing: 6, textTransform: "uppercase", color: c.accent, textAlign: "center" }}>{data.labels?.eyebrow ?? "Demo"} {data.number}</div>
      </Reveal>
      <Reveal a={0.08} b={0.28}>
        <div style={{ fontSize: 110, fontWeight: 300, marginTop: 24, textAlign: "center" }}>{beat.caption}</div>
      </Reveal>
      <div style={{ display: "flex", gap: 56, marginTop: 70 }}>
        {(data.titleTiles ?? []).map((id, i) => (
          <Reveal key={id} a={0.25 + i * 0.1} b={0.4 + i * 0.1}>
            <AppTile id={id} size={84} label />
          </Reveal>
        ))}
      </div>
      <Reveal a={0.5} b={0.7} style={{ position: "absolute", bottom: 90 }}>
        <Logo file={data.logo} height={64} />
      </Reveal>
    </AbsoluteFill>
  );
};

export const DemoFrame: React.FC = () => {
  const { data, beat } = useDemo();
  const { c, font } = useMock();
  const p = useP();
  const inLeft = p(0.0, 0.12);
  const inCap = p(0.05, 0.2);
  const tag = beatTag(beat, data);
  const stage = beat.stage ? (resolveRefs(beat.stage, data) as StageSpec) : null;
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: font, color: c.onDark }}>
      <div style={{ position: "absolute", left: 90, top: 96, opacity: inLeft }}>
        <span style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: c.accent }}>{stageLabel(beat.kind, data.labels)}</span>
      </div>
      <div style={{ position: "absolute", left: 90, top: 190, opacity: inLeft, transform: `translateY(${(1 - inLeft) * 20}px)` }}>
        <AppTile id={data.sceneTile?.[String(beat.n)] ?? ""} size={96} />
        <div style={{ fontSize: 36, color: c.accent, marginTop: 22 }}>{beat.product}</div>
      </div>
      <div style={{ position: "absolute", left: 90, top: 470, width: 520, fontSize: 64, fontWeight: 300, lineHeight: 1.14, opacity: inCap, transform: `translateY(${(1 - inCap) * 24}px)` }}>
        {beat.caption}
      </div>
      <div style={{ position: "absolute", left: 680, top: 120, width: 1150, height: 820 }}>
        {tag ? <ExampleTag text={tag} /> : null}
        {stage ? <Stage spec={stage} /> : null}
      </div>
      {data.credit?.beats.includes(beat.n) ? <CreditLine text={data.credit.text} /> : null}
    </div>
  );
};

/** Closing card: steps arrive one at a time while the voice speaks, then the starter prompt, then the logo. */
export const DemoBuild: React.FC = () => {
  const { data, beat } = useDemo();
  const { c, font } = useMock();
  const build = data.build ?? { tool: "", steps: [], prompt: "" };
  const { stepAt, promptAt } = buildCues({ voiceAt: beat.voiceAt, voice: beat.voice, duration: beat.end - beat.start }, build.steps.length);
  return (
    <AbsoluteFill style={{ fontFamily: font, color: c.onDark }}>
      <Reveal a={0} b={0.06} style={{ position: "absolute", left: 90, top: 80 }}>
        <div style={{ fontSize: 24, letterSpacing: 3, textTransform: "uppercase", color: c.accent }}>{data.labels?.build ?? "How you could build this yourself"}</div>
        <div style={{ fontSize: 76, fontWeight: 300, marginTop: 10 }}>{beat.caption}</div>
        <div style={{ fontSize: 28, color: c.soft, marginTop: 6 }}>{build.tool}</div>
      </Reveal>
      <div style={{ position: "absolute", left: 90, top: 330, width: 800 }}>
        {build.steps.map((s, i) => (
          <Reveal key={s} a={stepAt[i]} b={stepAt[i] + 0.05} dx={-20} dy={0}>
            <div style={{ display: "flex", gap: 22, alignItems: "flex-start", marginBottom: 26 }}>
              <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 25, background: c.accent, color: c.dark, fontSize: 26, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: 30, lineHeight: 1.3, paddingTop: 6 }}>{s}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal a={promptAt} b={promptAt + 0.06} style={{ position: "absolute", left: 960, top: 330, width: 870 }}>
        <div style={{ background: "rgba(255,255,255,0.12)", border: `1px solid ${c.line}`, borderRadius: 18, padding: "28px 34px" }}>
          <div style={{ fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: c.accent, marginBottom: 14 }}>{data.labels?.prompt ?? "Starter prompt to paste"}</div>
          <div style={{ fontSize: 27, lineHeight: 1.42 }}>{build.prompt}</div>
        </div>
      </Reveal>
      <Reveal a={0.86} b={0.95} style={{ position: "absolute", right: 90, top: 90 }}>
        <Logo file={data.logo} height={70} />
      </Reveal>
    </AbsoluteFill>
  );
};
