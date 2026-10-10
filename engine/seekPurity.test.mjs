// Seek purity (CMO-7537 A): every engine part draws the same output for the same time, whatever was drawn before.
// Each part is bundled with a stub "remotion" whose frame is set by the test, rendered at t=7, t=2, t=7, and the two t=7 outputs must match.
// Adding a .tsx part to engine/ without a case here fails the coverage test at the bottom.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
const BEATS = { FillMeter: METER_BEAT, DataStory: DATA_BEAT, UiDemo: UI_BEAT, OfferExplainer: OFFER_BEAT };

// engine file (without extension) -> the parts it draws, as JSX source over the imported names
const CASES = {
  counter: ['<Counter from={0} to={100} start={1} end={3} />', '<CountedText text="97 of 12" tokens={["97", "12"]} start={1} end={3} />'],
  pointer: ['<Pointer waypoints={[{ t: 0, x: 100, y: 100 }, { t: 1.5, x: 400, y: 300, act: "press" }, { t: 5, x: 800, y: 600 }]} ink="#111" paper="#fff" accent="#0a0" />'],
  typing: ['<Typing text="hello world" start={1} cps={12} />'],
  chartStory: [`<ChartStory config={${JSON.stringify(STORY)}} colors={${JSON.stringify(COLORS)}} fontFamily="sans-serif" />`],
  captions: ['<Captions words={[{ text: "one", start: 1, end: 1.5 }, { text: "two", start: 1.5, end: 2 }, { text: "three", start: 6.5, end: 7.5 }]} />'],
  brandSlot: ['<BrandSlot spec={{ text: "Esteban V.", corner: "bottom-right" }} />'],
  FillMeter: ["<FillMeter />"],
  DataStory: ["<DataStory />"],
  UiDemo: ["<UiDemo />"],
  OfferExplainer: ["<OfferExplainer />"],
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
