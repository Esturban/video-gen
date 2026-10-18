// Seek purity (CMO-7537 A): every engine part draws the same output for the same time, whatever was drawn before.
// Each part is bundled with a stub "remotion" whose frame is set by the test, rendered at t=7, t=2, t=7, and the two t=7 outputs must match.
// Adding a .tsx part to engine/ without a case here fails the coverage test at the bottom.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const ENGINE = dirname(fileURLToPath(import.meta.url));
const KIT = join(ENGINE, "..");
const FPS = 30;

const STUB = `
import React from "react";
export const useCurrentFrame = () => globalThis.__frame;
export const useVideoConfig = () => ({ fps: ${FPS}, width: 1440, height: 1440, durationInFrames: 1200 });
export const AbsoluteFill = ({ children, style }) => React.createElement("div", { style }, children);
export const Img = ({ src }) => React.createElement("img", { src });
export const delayRender = () => 1;
export const continueRender = () => {};
export const cancelRender = (e) => { throw e; };
export const staticFile = (p) => "/" + p;
export const random = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
export const Sequence = ({ children, from = 0, durationInFrames = Infinity }) => (globalThis.__frame >= from && globalThis.__frame < from + durationInFrames ? React.createElement(React.Fragment, null, children) : null);
`;

const COLORS = { paper: "#faf7f1", line: "#e4dccd", accent: "#2f5d5a", card: "#ffffff", action: "#1f4f8f", ink: "#241f1a", inkSoft: "#6b6358" };
const STORY = {
  values: [820, 1240, 1610, 2050, 2480], labels: ["Jan", "Feb", "Mar", "Apr", "May"],
  tl: { dotIn: [0, 0.9], toRing: [1.1, 2.9], unroll: [4.6, 6.6], toBars: [6.2, 7.6], baselineIn: [7.4, 8.1], labelsIn: [7.7, 8.4], toLine: [9.4, 10.8], absorb: [12.4, 13.5], swell: [13.3, 14.7], count: [14.6, 15.9], toCard: [17.5, 18.2], split: [18.0, 19.5], cardsIn: [19.3, 20.1], bentoIn: [22.8, 24.2] },
  camera: [[0, 0, 0, 1.3], [2.9, 6, 0, 1.15], [4.6, 12, 2, 1.12], [6.6, 990, 0, 0.95], [7.6, 1000, 6, 0.94], [9.4, 1008, 10, 0.95], [10.8, 1014, 2, 1], [12.4, 1020, 0, 1], [14.7, 2150, 0, 1.25], [17.5, 2150, 0, 1.25], [19.5, 2150, 0, 1.1], [22.8, 2150, 0, 1.1], [24.6, 2150, 175, 0.92], [26.8, 2150, 180, 0.92]],
};
const METER_BEAT = {
  n: 0, start: 0, end: 12, kind: "meter",
  legend: { text: "percent of attacks that worked", out: [4.7, 5.1] },
  texts: [{ in: [0, 0], out: [4.8, 5.1], headline: "A frozen model obeyed hidden instructions", label: "No defense" }, { in: [5.1, 5.4], out: [99, 99], headline: "The overlay brought it near zero", label: "" }],
  steps: [{ from: "0", to: "97.5", start: 0.3, end: 2.3 }, { from: "97.5", to: "0", start: 5.4, end: 8 }],
  tone: [{ at: 5.4, dur: 1, to: 1 }], tag: [{ at: 0.5, dur: 1, to: 1 }],
  ghosts: [{ value: "97.5", in: [2.4, 2.8], out: [5.0, 5.4] }],
  close: { shrink: [9, 9.8], open: [9.6, 10.6], textIn: [10.4, 10.9], framing: "Frame", title: "Title", ref: "ref 1", caveat: "caveat" },
};

const PLAIN_BEAT = { n: 0, start: 0, end: 30, kind: "x" };
const DATA_BEAT = { ...PLAIN_BEAT, ...STORY, title: "Title", sampleLabel: "Sample data" };
const UI_BEAT = {
  ...PLAIN_BEAT, windowTitle: "Assistant", fieldLabel: "Task", placeholder: "Describe the task", task: "Summarise the open items", button: "Run", resultsLabel: "Result",
  results: ["Open items gathered", "Grouped by owner", "Summary ready"], typing: { cps: 16, pauses: [{ at: 9, dur: 0.3 }] },
  tl: { pointerIn: 0.4, fieldArrive: 1.5, typeStart: 2.1, leaveField: 4.2, buttonArrive: 5.0, rowsStart: 5.6, rowsStep: 0.35, rowsDur: 0.6, pointerAway: 6.6 },
};
const OFFER_BEAT = {
  ...PLAIN_BEAT, category: "AI Agent Implementation", tabs: ["The problem", "What you get", "Next step"],
  steps: [
    { title: "Work that repeats itself.", body: "The same steps, by hand.", icon: "ring", rows: ["Copying data", "Chasing updates", "Rebuilding reports"] },
    { title: "One narrow agent.", body: "You review it first.", icon: "check", rows: ["One job", "Your tools", "Tested on real work"], note: "Live in 2 to 6 weeks" },
    { title: "Start with a Live Audit.", body: "Free, and it takes 20 minutes." },
  ],
  cta: "Book the free Live Audit", endNote: "Free, 20 minutes.", count: { note: ["2", "6"], endNote: ["20"], stagger: 0.1 },
  tl: { pillIn: 0.2, toCard: 1.5, cursorIn: 2.9, tab2: 4.2, tab3: 6.8, cta: 8.3, cursorOut: 10.2 },
};
const GROW_BEAT = {
  ...PLAIN_BEAT, title: "Title", sub: "Sub", source: "Source: Test", stat: { text: "100x", note: "note", count: { to: 100, start: 0.2, end: 3 } }, yLabel: "FLOP", yDomain: [21, 28], ticks: [22, 25],
  series: [{ label: "2018", value: 8.7e21, tier: "filled" }, { label: "2019", value: 1.1e23, tier: "ring" }, { label: "2020", value: 3.1e23, tier: null }],
  reveal: { from: -1, to: 2 }, draw: [0.1, 0.8], callouts: [{ idx: 0, place: "below-right", title: "A" }, { idx: 1, place: "above-left", title: "B", in: [0.2, 0.4] }],
  trend: { label: "4x", draw: [0.2, 0.7] }, legend: { filled: "f", ring: "r", in: [0.3, 0.5] },
};
const SKETCH_BEAT = {
  ...PLAIN_BEAT, shapes: [
    { t: "person", x: 300, y: 700, h: 300, pose: "busy", at: [0.5, 3] }, { t: "arrow", from: [400, 500], to: [700, 500], at: [3, 4] },
    { t: "rect", x: 800, y: 300, w: 400, h: 200, fill: "accentSoft", at: [4, 6], ink: "accent" }, { t: "text", x: 960, y: 200, text: "Hello", size: 80, anchor: "middle", at: [5, 8] },
    { t: "count", x: 960, y: 900, to: 48000, size: 120, anchor: "middle", at: [6, 9] },
  ],
};
const FLOW_LAYOUT = {
  size: [1440, 1440], zone: [64, 64, 1376, 1000], r: 70, anchors: { A: [0.3, 0.5], B: [0.7, 0.5] }, wait: { A: [0, 0.5], B: [1, 0.5] },
  caption: { x: 64, y: 1060, w: 1200, headPx: 44, chipPx: 28, sourceY: 1370, sourcePx: 26 }, notes: { footer: { x: 64, y: 1410, px: 24 } }, big: { place: "below", px: 100 },
};
const FLOW_BEAT = {
  ...PLAIN_BEAT, network: {
    vars: { fig: { value: "~215bp", asOf: "Aug 9, 2026" } },
    nodes: [{ id: "A", appear: 0, enter: 1 }, { id: "B", appear: 0.3, enter: 1, lines: ["Bond +", "credit"] }],
    edges: [{ id: "ab", from: "A", to: "B", style: "dotted", usd: 43e9, at: 1.5, value: "$43B", kind: "debt", chip: "chip" }, { id: "ba", from: "B", to: "A", style: "dashed", usd: 13e9, at: 3, open: true, bend: 0.3, value: "$13B" }],
    steps: [{ name: "a", at: 1, dur: 0.9 }, { name: "b", at: 6, dur: 0.7, keep: ["A"], dim: 0.4, scale: { A: 1.4 } }],
    glows: [{ ids: ["A"], kind: "warm", at: 5, until: 20 }, { ids: ["B"], kind: "cool", at: 5, until: 20 }], ghosts: [{ id: "A", at: 6, until: 9, scale: 1.4 }], ripples: [{ ids: ["A"], at: 6, until: 9 }],
    captions: [{ at: 5, until: 9, lines: [{ text: "Insure it" }], big: { text: "{fig.value}", near: "A" }, chip: "four names", source: "CDS, {fig.asOf}" }],
    notes: [{ id: "footer", text: "Research framing", at: 5, until: 20 }], layouts: { square: FLOW_LAYOUT },
  },
};
const DUAL_BEAT = {
  ...PLAIN_BEAT, timeline: {
    vars: { bond: { value: "$27B" } },
    axis: { from: 2025, to: 2049, startLabel: "2025", endLabel: "2049", at: 0.5, endAt: 4, note: { text: "illustrative, to scale", at: 4.5 } },
    lanes: [{ id: "bond", label: "Bond", at: 0 }, { id: "lease", label: "Lease", at: 0.2 }],
    spread: { base: 90, dur: 1.2, steps: [{ at: 5, px: 200 }, { at: 8, px: 340 }] },
    bar: { lane: "bond", draw: [1, 4], chips: [{ text: "{bond.value} of bonds", at: 0.3 }] },
    blocks: { lane: "lease", years: 4, label: "4 yrs", items: [{ at: 5 }, { at: 5.5, fill: 6.5 }, { at: 6, fill: 7 }], note: { text: "up to 20 years total", at: 6.5 } },
    playhead: { at: 6, dur: 2 },
    brackets: [{ kind: "span", from: 0, to: 1, label: "Per one source", draw: [6.5, 7.5] }, { kind: "ticks", label: "Per another source", draw: [6.8, 7.6] }],
    chip: { text: "Sources differ", at: 7 },
    gap: { label: "Mismatch, not a forecast", fromBlock: 1, at: 6.5 },
    captions: [{ at: 0, until: 9, lines: ["Two clocks."], source: "Source: test" }],
    footer: { text: "Research framing, not investment advice", at: 6 },
  },
};
const LEDGER_BEAT = {
  ...PLAIN_BEAT, ledger: {
    vars: { r1: { value: "$6.6B round", asOf: "Oct 2, 2024" } },
    heads: { label: "Deal and round headline (whole round)", chip: "MGX", slot: "MGX share", at: 0 },
    guides: { at: 0.2, step: 0.1 },
    rows: [
      { label: "Row one", meta: "{r1.asOf} · {r1.value}", at: 1, chip: { text: "MGX", litAt: 4 }, slot: { state: "empty", emptyLabel: ["no verified", "amount"], labelAt: 6 } },
      { label: "Row two", meta: "Jan 2026 · $20B round", at: 2, chip: { text: "MGX", litAt: 4.6 }, slot: { state: "empty", emptyLabel: ["no verified", "amount"], labelAt: 6.4 } },
    ],
    focus: { row: 1, at: 7, until: 9, dim: 0.4, pulse: true },
    badge: { text: "2 deals", at: 3, until: 5 },
    captions: [{ at: 0, until: 9, lines: ["Two deals."], source: "Source: test" }],
    footer: { text: "Research framing, not investment advice", at: 4 },
  },
};
const UIX_BEAT = {
  ...PLAIN_BEAT, end: 12, voiceAt: 0.4, voice: 9, eyebrow: "Eyebrow", caption: "A caption.", product: "Product", tile: { letter: "G", tone: "accent" }, tiles: [{ letter: "A", label: "One" }, { letter: "B", label: "Two" }],
  source: "Source: test", steps: ["Step one", "Step two"],
  panel: { type: "flow", title: "Window", tag: "Illustrative", from: { title: "Big", meta: "m" }, to: { title: "Small", meta: "m" }, label: "teaches" },
};
const INTRO_BEAT = { ...PLAIN_BEAT, end: 6.5, wordmark: "EV Advisory", byline: "Esteban V.", series: "Episode 03", head: null };
const ATLAS = JSON.parse(readFileSync(join(KIT, "fixtures", "storyAtlas.json"), "utf8")); // the Riyadh Lab thank-you film's atlas (CMO-8248)
const FILM_LINES = { scrim: { height: 560 }, blocks: [{ top: 180, lines: [{ text: "An idea", at: 1, words: true, size: 72, out: [6.4, 6.9] }, { text: "A line", at: 3, until: 9, size: 112, color: "amber", blurIn: true }] }] };
const CALLOUTS = [{ name: "Tool A", at: 5.6, until: 9.2, spot: [1, 5, 180], card: [230, 560] }, { name: "Tool B", at: 1, until: 12, spot: [2.5, 2.5, 240], card: [560, 470] }];
const WALL = {
  heading: "Thank you.", logos: { a: { file: "logos/a.png", plate: "none", h: 96 }, b: { text: "Partner", plate: "none", h: 96, label: "Label" } },
  rows: [{ logos: ["a"], h: 128 }, { logos: ["b"], h: 92 }], order: ["b", "a"],
};
const FILM_BEAT = {
  ...PLAIN_BEAT, end: 20, style: { C: { amber: "#F2B84B" } },
  layers: [
    { from: 0, len: 20, parts: [{ part: "stars" }] },
    { from: 0, len: 10, parts: [{ part: "atlas", props: { config: ATLAS } }] },
    { from: 5, len: 15, parts: [{ part: "lines", props: FILM_LINES }, { part: "walkRing", props: { needs: ["home", "park"], distance: "1 km", time: "15 min" } }] },
  ],
};
const TASKS3 = [{ task: "Task one", owner: "Lead", due: "Monday" }, { task: "Task two", owner: "Coach", due: "Friday" }];
const MAIL = { subject: "Actions", from: "Sponsor", intro: "Two things:", lines: ["1. One", "2. Two"] };
const COLS = [{ key: "project", label: "Project", fr: 2 }, { key: "open", label: "Open", fr: 1 }, { key: "rag", label: "Status", fr: 1 }];
const ROWS = [{ project: "Alpha", open: 3, rag: "red", reason: "1 blocked" }, { project: "Beta", open: 1, rag: "green", reason: "2 resolved" }];
const COACH = {
  inbox: { type: "inbox", app: "mail", title: "Inbox", email: MAIL, inbox: [["Sponsor", "Actions", "08:00"]], retype: { app: "board", title: "New task", label: "Task name", text: "Task one", note: "1 of 2" }, counter: { text: "Retyping: {n} min", to: 25 } },
  flow: { type: "flow", app: "flow", title: "Designer", boxes: [{ app: "mail", title: "Trigger", at: 0.04 }, { app: "flow", title: "AI step", ai: true, at: 0.1 }], glow: [0.1, 0.4], header: { type: "trigger", pill: "New email", note: "arrived", pills: [{ text: "No code", bg: "accent", fg: "dark" }] }, runs: { app: "flow", title: "Run history", rows: [["Today", "Succeeded", "38 s"]] } },
  describe: { type: "flow", app: "flow", title: "Designer", boxes: [{ app: "flow", title: "Step", at: 0.2 }], header: { type: "describe", label: "Describe it", text: "When I paste notes, list the tasks.", typeAt: [0.02, 0.4] } },
  extract: { type: "extract", source: { app: "mail", title: "The email", email: MAIL }, ai: { tile: "flow" }, out: { app: "flow", title: "Output" }, tasks: TASKS3 },
  board: { type: "board", app: "board", title: "Board", tasks: TASKS3, compact: true },
  channel: { type: "channel", app: "chat", title: "Channel", botTile: "flow", msgs: [{ from: "Lead", at: 0.02, text: "Hi" }, { from: "Bot", bot: true, at: 0.1, title: "New", tasks: TASKS3 }, { from: "Bot", bot: true, at: 0.2, title: "Minutes", text: "Done." }] },
  result: { type: "result", source: { app: "mail", title: "The email", email: MAIL }, stats: [{ n: "2", label: "tasks", a: 0.1, tone: "accent" }] },
  notesChase: { type: "notesChase", notes: { app: "chat", title: "Notes", lines: ["Standup", "Line"] }, stickies: [{ text: "who?", x: 40, y: 430, r: -6 }], chases: ["Did you?", "Who?"], counter: { text: "Sent: {n}" } },
  pasteRun: { type: "pasteRun", app: "flow", title: "Test", label: "Transcript", lines: ["Standup", "Line"], button: "Run", buttonTile: "flow", pills: [{ text: "Running", at: [0.1, 0.2] }] },
  output: { type: "output", app: "flow", title: "Output", minutesLabel: "Minutes", minutes: ["One.", "Two."], actionsLabel: "Action items", tasks: TASKS3, pill: { text: "Same result", bg: "accent", fg: "dark" } },
  sheetScroll: { type: "sheetScroll", app: "sheet", title: "tracker.xlsx", rows: 8, cols: 6, bubbles: ["status?"], bubbleTile: "chat" },
  dataList: { type: "dataList", app: "sheet", title: "List", cols: COLS, rows: ROWS, badge: { tile: "flow", head: "Every week", big: "Monday", note: "reads the list" } },
  statusCard: { type: "statusCard", app: "chat", title: "Pulse", heading: "This week", rows: ROWS, nameKey: "project", statusKey: "rag", reasonKey: "reason", risksTitle: "Top risks", risks: ["Alpha: 1 blocked"], flag: { label: "Overloaded:", text: "Reviewer A" } },
  chat: { type: "chat", app: "agent", title: "Coach", history: [{ me: true, text: "Q1" }, { text: "A1" }], ask: "Which will slip?", typeAt: [0.05, 0.3], answer: ["Alpha: blocked."], answerAt: [0.35, 0.4], streamAt: [0.38, 0.9] },
  chatList: { type: "chatList", chat: { app: "agent", title: "Coach", lines: ["Alpha slips."] }, list: { app: "sheet", title: "List", cols: COLS, rows: ROWS, matchKey: "project", match: ["Alpha"] } },
};
const COACH_BEAT = { ...PLAIN_BEAT, kind: "tool", voiceAt: 0.4, voice: 20, product: "Product", caption: "A caption.", tag: "Example data", stage: { type: "split", left: COACH.board, right: COACH.channel } };
const stageCase = (Part, k) => `<${Part} stage={${JSON.stringify(COACH[k])}} />`;
const BEATS = { CoachDemo: COACH_BEAT, FilmLayers: FILM_BEAT, IntroSequence: INTRO_BEAT, Sketch: SKETCH_BEAT, FillMeter: METER_BEAT, DataStory: DATA_BEAT, UiDemo: UI_BEAT, OfferExplainer: OFFER_BEAT, GrowLine: GROW_BEAT, FlowNetwork: FLOW_BEAT, DualTimeline: DUAL_BEAT, LedgerRows: LEDGER_BEAT, UiExplainer: UIX_BEAT };

// engine file (without extension) -> the parts it draws, as JSX source over the imported names
const CASES = {
  counter: ['<Counter from={0} to={100} start={1} end={3} />', '<CountedText text="97 of 12" tokens={["97", "12"]} start={1} end={3} />'],
  pointer: ['<Pointer waypoints={[{ t: 0, x: 100, y: 100 }, { t: 1.5, x: 400, y: 300, act: "press" }, { t: 5, x: 800, y: 600 }]} ink="#111" paper="#fff" accent="#0a0" />'],
  typing: ['<Typing text="hello world" start={1} cps={12} />'],
  chartStory: [`<ChartStory config={${JSON.stringify(STORY)}} colors={${JSON.stringify(COLORS)}} fontFamily="sans-serif" />`],
  captions: ['<Captions words={[{ text: "one", start: 1, end: 1.5 }, { text: "two", start: 1.5, end: 2 }, { text: "three", start: 6.5, end: 7.5 }]} />'],
  brandSlot: ['<BrandSlot spec={{ text: "Esteban V.", corner: "bottom-right" }} />'],
  Sketch: ["<Sketch />"],
  FillMeter: ["<FillMeter />"],
  DataStory: ["<DataStory />"],
  UiDemo: ["<UiDemo />"],
  OfferExplainer: ["<OfferExplainer />"],
  GrowLine: ["<GrowLine />"],
  IntroSequence: ["<IntroSequence />"],
  FlowNetwork: ["<FlowNetwork />"],
  DualTimeline: ["<DualTimeline />"],
  LedgerRows: ["<LedgerRows />"],
  UiExplainer: ["<UiTitle />", "<UiScreen />", "<UiSteps />"],
  kinetic: ['<Line t={7} at={1} until={9} blurIn>Hello</Line>', '<WordsOn t={7} at={1} text="one two three" />', "<Stars />", '<svg><Walker x={100} y={100} h={60} phase={0.3} /></svg>', "<TopScrim />", '<TextBlock top={180}>x</TextBlock>'],
  TimedLines: [`<TimedLines {...${JSON.stringify(FILM_LINES)}} />`],
  StoryAtlas: [`<StoryAtlas config={${JSON.stringify(ATLAS)}} />`],
  IsoSkyline: ['<IsoSkyline clock0={70} nowFrom={63} dims={{ dimAt: 83, dim2At: 92, goneAt: 104 }} />'],
  ToolCallouts: [`<ToolCallouts titles={[{ at: 1, until: 9, text: "Three days." }]} callouts={${JSON.stringify(CALLOUTS)}} />`],
  TrackRows: ['<TrackRows heading="Four tracks." tracks={[{ title: "One", icon: "mobility" }, { title: "Two", icon: "air" }]} />'],
  PartnerWall: [`<PartnerWall {...${JSON.stringify(WALL)}} />`, '<EndCard name="Lab" tagline="Build in person." />'],
  WalkRing: ['<WalkRing needs={["education", "health", "park"]} distance="about 1.2 km" time="15 min walk" />'],
  DistrictMap: ['<DistrictMap label="15 min" />'],
  CityTimeline: ['<CityTimeline title="City." steps={[[3.6, 6.2, "One."], [6.3, 8.2, "Two."]]} chips={[[6, "Metro"], [6.3, "Park"]]} closing="Close." />'],
  FilmLayers: ["<FilmLayers />"],
  AppMock: ['<Reveal a={0.1} b={0.3}><Typed text="hello" a={0.1} b={0.4} /></Reveal>', '<Streamed lines={["a b", "c"]} a={0.1} b={0.5} />', '<Win app="x" title="T"><AppTile id="x" label /><Pill text="p" /></Win>', '<FlowCanvas app="x" title="T" boxes={[{ app: "x", title: "A", at: 0.1, ai: true }]} glow={[0.1, 0.4]} />', '<TaskBoard app="x" title="T" tasks={[{ task: "a", owner: "b", due: "c" }]} start={0.1} step={0.1} />', '<ChannelFeed app="x" title="T" botTile="y" msgs={[{ from: "A", at: 0.1, body: "hi" }]} />', '<TaskTable tasks={[{ task: "a", owner: "b", due: "c" }]} start={0.1} step={0.1} />', '<ChatShell app="x" title="T"><Bubble me>q</Bubble></ChatShell>', '<StatCard n="5" label="l" a={0.1} color="#0a0" />', '<RunHistory app="x" title="T" runs={[["a", "b", "c"]]} />', '<EmailBody email={{ subject: "S", from: "F", intro: "I", lines: ["1", "2"] }} hl={[0.1, 0.5]} />', '<div><ExampleTag text="t" /><CreditLine text="c" /><DataHead cols={[{ key: "a", label: "A", fr: 1 }]} /><DataRow cols={[{ key: "a", label: "A", fr: 1 }]} row={{ a: 1 }} hl={0.5} /></div>'],
  CoachDemo: ["<DemoTitle />", "<DemoFrame />", "<DemoBuild />", `<Stage spec={${JSON.stringify(COACH.describe)}} />`],
  coachStages: [stageCase("InboxStage", "inbox"), stageCase("FlowStage", "flow"), stageCase("FlowStage", "describe"), stageCase("ExtractStage", "extract"), stageCase("BoardStage", "board"), stageCase("ChannelStage", "channel"), stageCase("ResultStage", "result"), stageCase("NotesChaseStage", "notesChase"), stageCase("PasteRunStage", "pasteRun"), stageCase("OutputStage", "output")],
  coachDataStages: [stageCase("SheetScrollStage", "sheetScroll"), stageCase("DataListStage", "dataList"), stageCase("StatusCardStage", "statusCard"), stageCase("AgentChatStage", "chat"), stageCase("ChatListStage", "chatList")],
  ToolStageFrame: ['<ToolStageFrame track="Mobility" logo="a.svg" product="Maps" caption="A caption." optional dots={{ Mobility: "accent" }}><svg /></ToolStageFrame>', '<TrackChip track="Mobility" dots={{ Mobility: "accent" }} />', '<StageSvg label="s"><StageTag text="Example data" x={10} y={10} /></StageSvg>', '<LogoImg file="a.svg" size={40} />'],
  CityMapStages: ['<PinMapStage title="City" label="m" pins={[{ x: 440, y: 340, label: "Station", hi: true }, { x: 790, y: 330, label: "Street" }]} />', '<ShadeMapStage title="A district" park="Park" trees="Trees" walkway="Walkway" chip="Shade today" label="s" />', '<HeatGridStage title="A district" tag="Example data" park="Park" cooler="Cooler" hotter="Hotter" question="Shade here?" label="h" />'],
  CityFlowStages: ['<HourBarsStage title="People by hour" tag="Example data" values={[0.3, 0.7, 0.9, 0.5]} ticks={["6 am", "", "", "9 am"]} peak={2} peakLabel="Peak" label="b" />', '<PhoneReportStage street="A street" heading="Report" fields={["Light out", "North side"]} photo="Photo added" send="Send" sent="Sent" label="p" />', '<RouteFlowStage card={{ eyebrow: "New", title: "Light out", meta: "Street" }} hub={["Which", "team?"]} teams={["A team", "B team"]} reply={{ eyebrow: "To you", text: "Thanks." }} label="r" />', '<NodeGraphStage nodes={{ A: [100, 100], B: [400, 100], C: [250, 400] }} edges={[["A", "B"], ["B", "C"]]} route={["B|C"]} routeLabel="Route" label="g" />', '<ChatStage title="Helper" label="c" lines={[{ y: 170, text: "Question?", me: true, at: 1 }, { y: 280, text: "Answer.", at: 7.5, typing: 6 }]} />'],
  CaseCard: ['<CaseCard c={{ city: "City", track: "Mobility", image: "a.png", credit: "Credit", problem: "P", solution: "S", outcome: "O", riyadh: "Here", logos: ["a.svg"] }} labels={{ eyebrow: "A real example", problem: "Problem", solution: "Solution", outcome: "Outcome", tools: "Tools", local: "Here" }} toolNames={{ "a.svg": "Tool A" }} />'],
  ExampleGrid: ['<ExampleGrid eyebrow="Checked" title="Cities doing this." step={2} items={[{ title: "One", body: "Body", chip: "Mobility", source: "a.org" }, { title: "Two", body: "Body", chip: "Parks", source: "b.org" }]} />'],
  LoopHandoff: ['<LoopHandoff eyebrow="How it works" steps={["Observe", "Build", "Automate", "Decide"]} lines={["Your turn:", "start."]} logos={["a.svg"]} strip={{ file: "s.png", width: 100, height: 10 }} />'],
  TitleCard: ['<TitleCard eyebrow="Lab" title="Six tools." chips={["Mobility", "Parks"]} dots={{ Mobility: "accent" }} strip={{ file: "s.png", width: 100, height: 10 }} />', '<LogoStrip strip={{ file: "s.png", width: 100, height: 10, scale: 2 }} opacity={0.5} />'],
  glyphs: ['<Glyph kind="mobility" color="#3DD6C6" />', '<svg><GlyphAt kind="park" x={10} y={10} color="#3DD6C6" /></svg>'],
};
const NOT_PARTS = new Set(["beat", "index", "Video", "OfferSteps", "OfferShell"]); // contexts, the composition root, and pieces drawn inside OfferExplainer: no part of their own to seek

const entrySource = () => {
  const imports = Object.keys(CASES).map((f) => `import * as ns_${f} from ${JSON.stringify(join(ENGINE, f + ".tsx"))};`).join("\n");
  const spread = Object.keys(CASES).map((f) => `const { ${[...new Set(CASES[f].flatMap((s) => [...s.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1])))].join(", ")} } = ns_${f};`).join("\n");
  const parts = Object.entries(CASES).flatMap(([f, list]) => list.map((jsx, i) => `  ${JSON.stringify(`${f}#${i}`)}: [() => (${jsx}), ${JSON.stringify(BEATS[f] ?? PLAIN_BEAT)}],`)).join("\n");
  return `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BeatContext, BrandContext, SceneContext } from ${JSON.stringify(join(ENGINE, "beat.tsx"))};
${imports}
${spread}
const PARTS = {
${parts}
};
const BRAND = { name: "t", background: "#f3efe6", font: "sans-serif", colors: ${JSON.stringify(COLORS)} };
const SCENE = { name: "t", brand: "t", beats: [] };
export const names = () => Object.keys(PARTS);
export const draw = (name, frame) => {
  globalThis.__frame = frame;
  const [Part, beat] = PARTS[name];
  return renderToStaticMarkup(<SceneContext.Provider value={SCENE}><BrandContext.Provider value={BRAND}><BeatContext.Provider value={beat}><Part /></BeatContext.Provider></BrandContext.Provider></SceneContext.Provider>);
};
`;
};

let work;
let mod;
test.before(async () => {
  global.FontFace = class { load() { return Promise.resolve(this); } };
  global.document = { fonts: { add() {} } };
  work = mkdtempSync(join(KIT, ".video", "seek-"));
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "remotion-stub.js"), STUB);
  writeFileSync(join(work, "entry.tsx"), entrySource());
  await build({
    entryPoints: [join(work, "entry.tsx")], outfile: join(work, "bundle.mjs"), bundle: true, format: "esm", platform: "node", jsx: "automatic", logLevel: "silent",
    alias: { remotion: join(work, "remotion-stub.js") }, external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"], nodePaths: [join(KIT, "node_modules")], loader: { ".ttf": "dataurl" },
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  });
  mod = await import(pathToFileURL(join(work, "bundle.mjs")).href);
});
test.after(() => { if (work) rmSync(work, { recursive: true, force: true }); });

test("every engine part draws the same output at t=7 before and after being drawn at t=2", () => {
  for (const name of mod.names()) {
    const first = mod.draw(name, 7 * FPS);
    const other = mod.draw(name, 2 * FPS);
    const again = mod.draw(name, 7 * FPS);
    assert.ok(first.length > 0 || name.startsWith("captions"), `${name} drew nothing at t=7`);
    assert.equal(again, first, `${name} is not seekable: t=7 differs after t=2`);
    assert.notEqual(other, undefined);
  }
});

test("every .tsx part in engine/ has a seek case in this file", () => {
  const parts = readdirSync(ENGINE).filter((f) => f.endsWith(".tsx")).map((f) => f.slice(0, -4)).filter((f) => !NOT_PARTS.has(f));
  assert.deepEqual(parts.filter((p) => !(p in CASES)), [], "add a case for each new engine part");
});

test("FillMeter lands on the printed figure and holds it", () => {
  const afterFirstStep = mod.draw("FillMeter#0", 3 * FPS);
  assert.match(afterFirstStep, />97\.5<tspan/);
  const drained = mod.draw("FillMeter#0", 8.5 * FPS);
  assert.match(drained, />0<tspan/);
});
