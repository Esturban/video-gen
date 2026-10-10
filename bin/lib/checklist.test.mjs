import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { runChecklist } from "./checklist.mjs";

const SCENE = { name: "t", owner: "CMO", area: "promo", brand: "b", beats: [{ n: 0, start: 0, end: 4, kind: "offer" }] };
const KINDS = "export const KINDS = { offer: X };";

/** A scene folder plus a brands dir in a temp consumer root. Returns the args runChecklist wants. */
function fixture({ scene = SCENE, kinds = KINDS, extra = {}, engine = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "checklist-"));
  const dir = join(root, "scenes", "promo", "t");
  mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
  mkdirSync(join(root, "brands"), { recursive: true });
  writeFileSync(join(root, "brands", "b.json"), "{}");
  writeFileSync(join(dir, "scene.json"), typeof scene === "string" ? scene : JSON.stringify(scene));
  writeFileSync(join(dir, "kinds.tsx"), kinds);
  for (const [name, text] of Object.entries(extra)) { mkdirSync(dirname(join(dir, name)), { recursive: true }); writeFileSync(join(dir, name), text); }
  const engineDir = join(root, "engine");
  mkdirSync(engineDir, { recursive: true });
  for (const [name, text] of Object.entries(engine)) writeFileSync(join(engineDir, name), text);
  return { dir, brandDirs: [join(root, "brands")], outDir: join(root, "out"), engineDir };
}

const failed = (items) => items.filter((i) => !i.pass).map((i) => i.id);

test("passes a clean scene on every item", () => {
  assert.deepEqual(failed(runChecklist(fixture())), []);
});

test("fails scene when JSON is invalid", () => {
  assert.deepEqual(failed(runChecklist(fixture({ scene: "{nope" }))), ["scene", "kinds", "fonts"]);
});

test("fails scene when beats overlap", () => {
  const scene = { ...SCENE, beats: [{ n: 0, start: 0, end: 4, kind: "offer" }, { n: 1, start: 3, end: 6, kind: "offer" }] };
  assert.deepEqual(failed(runChecklist(fixture({ scene }))), ["scene"]);
});

test("fails kinds when a beat kind is not in kinds.tsx", () => {
  assert.deepEqual(failed(runChecklist(fixture({ kinds: "export const KINDS = { other: X };" }))), ["kinds"]);
});

test("fails fonts when a referenced font file is missing", () => {
  const items = runChecklist(fixture({ extra: { "fonts.ts": 'staticFile("fonts/Geist-Regular.woff2")' } }));
  assert.deepEqual(failed(items), ["fonts"]);
});

test("fails fonts when the brand is unknown", () => {
  assert.deepEqual(failed(runChecklist(fixture({ scene: { ...SCENE, brand: "ghost" } }))), ["fonts"]);
});

test("fails dashes when scene.json carries an em dash", () => {
  const scene = { ...SCENE, caption: "one \u2014 two" };
  assert.deepEqual(failed(runChecklist(fixture({ scene }))), ["dashes"]);
});

test("fails dashes when a tsx file carries an en dash", () => {
  assert.deepEqual(failed(runChecklist(fixture({ extra: { "copy.tsx": "const a = '1\u20132';" } }))), ["dashes"]);
});

test("fails banned only when both halves of the figure pair appear", () => {
  assert.deepEqual(failed(runChecklist(fixture({ extra: { "a.tsx": "14 hours" } }))), []);
  assert.deepEqual(failed(runChecklist(fixture({ extra: { "a.tsx": "14 hours then 12 minutes" } }))), ["banned"]);
  assert.deepEqual(failed(runChecklist(fixture({ extra: { "a.tsx": "4 hours to 12 minutes" } }))), ["banned"]);
});

test("fails output when the directory cannot be created", () => {
  const args = { ...fixture(), outDir: "/proc/nope/out" };
  assert.deepEqual(failed(runChecklist(args)), ["output"]);
});

test("a narrated beat may leave out start and end: its times come from the audio (CMO-7584)", () => {
  const scene = { ...SCENE, beats: [{ n: 0, kind: "offer", narration: "Hello." }, { n: 1, kind: "offer", narration: "Bye." }] };
  assert.deepEqual(failed(runChecklist(fixture({ scene }))), []);
});

test("a beat with no narration still needs start and end", () => {
  const scene = { ...SCENE, beats: [{ n: 0, kind: "offer" }] };
  assert.deepEqual(failed(runChecklist(fixture({ scene }))), ["scene"]);
});

test("captions on a scene with no narrated beat fail the captions item", () => {
  const scene = { ...SCENE, captions: true };
  assert.deepEqual(failed(runChecklist(fixture({ scene }))), ["captions"]);
});

test("captions on a narrated scene pass the captions item", () => {
  const scene = { ...SCENE, captions: true, beats: [{ n: 0, kind: "offer", narration: "Hello." }] };
  const items = runChecklist(fixture({ scene }));
  assert.ok(items.some((i) => i.id === "captions" && i.pass));
});

const VARIANTS = { "9x16": { size: [1080, 1920], layoutOverrides: { 0: { layout: { x: 1 } } } }, "1x1": { size: [1080, 1080] } };

test("one checklist item per variant, each passing when valid (CMO-7577)", () => {
  const items = runChecklist(fixture({ scene: { ...SCENE, size: [1440, 1440], variants: VARIANTS } }));
  assert.deepEqual(failed(items), []);
  const v = items.filter((i) => i.id.startsWith("variant:"));
  assert.deepEqual(v.map((i) => i.id), ["variant:9x16", "variant:1x1"]);
  assert.match(v[0].label, /1080x1920/);
});

test("a bad variant fails only its own item", () => {
  const scene = { ...SCENE, variants: { ...VARIANTS, "9x16": { size: [1080, 1080] } } };
  assert.deepEqual(failed(runChecklist(fixture({ scene }))), ["variant:9x16"]);
});

test("no variant items when the scene declares none", () => {
  assert.equal(runChecklist(fixture()).some((i) => i.id.startsWith("variant")), false);
});

test("no brief item unless the scene sets brief: true (CMO-7576)", () => {
  assert.equal(runChecklist(fixture()).some((i) => i.id === "brief"), false);
});

test("brief: true without brief.md fails the brief item only", () => {
  assert.deepEqual(failed(runChecklist(fixture({ scene: { ...SCENE, brief: true } }))), ["brief"]);
});

test("brief: true with a full brief.md and style-guide.md passes", () => {
  const extra = {
    "brief.md": "One sentence: x\nAudience: x\nAssets: none\nBanned defaults: x\nDeliverables: x\n",
    "style-guide.md": "Palette: x\nType: x\nPacing: x\nMotion: x\nDo not copy: x\n",
  };
  const items = runChecklist(fixture({ scene: { ...SCENE, brief: true }, extra }));
  assert.deepEqual(failed(items), []);
  assert.ok(items.some((i) => i.id === "brief" && i.pass));
});

// Seek purity (CMO-7537 A): nothing in engine/ or a scene's kinds.tsx may read the wall clock, randomness or a CSS transition.
const IMPURE = [
  ["Math.random", "const r = Math.random();"],
  ["Date.now", "const t = Date.now();"],
  ["performance.now", "const t = performance.now();"],
  ["setTimeout", "setTimeout(() => {}, 10);"],
  ["requestAnimationFrame", "requestAnimationFrame(tick);"],
  ["CSS transition", 'const s = { transition: "opacity 1s" };'],
];

for (const [name, code] of IMPURE) {
  test(`purity fails a kinds.tsx that uses ${name}`, () => {
    const items = runChecklist(fixture({ kinds: `${KINDS}\n${code}` }));
    assert.deepEqual(failed(items), ["purity"]);
    assert.match(items.find((i) => i.id === "purity").detail, /kinds\.tsx/);
  });
  test(`purity fails an engine file that uses ${name}`, () => {
    const items = runChecklist(fixture({ engine: { "part.tsx": code } }));
    assert.deepEqual(failed(items), ["purity"]);
    assert.match(items.find((i) => i.id === "purity").detail, /part\.tsx/);
  });
}

test("purity ignores the banned names in comments and in engine test files", () => {
  const items = runChecklist(fixture({ kinds: `${KINDS}\n// never Math.random here\n/* Date.now */`, engine: { "a.test.mjs": "Date.now()", "b.js": "// a CSS transition: no" } }));
  assert.deepEqual(failed(items), []);
});

test("purity passes the real engine", () => {
  const { engineDir, ...real } = fixture();
  assert.deepEqual(failed(runChecklist(real)), []); // no engineDir given: the engine this file ships with
});

// One home for visual parts (CMO-7537): a scene's parts/ folder holds no component.
test("parts fails a scene whose parts folder holds a component and names the engine path", () => {
  const args = fixture({ extra: { "parts/Meter.tsx": "export const Meter = () => null;" } });
  const items = runChecklist(args);
  assert.deepEqual(failed(items), ["parts"]);
  assert.ok(items.find((i) => i.id === "parts").detail.includes(join(args.engineDir, "Meter.tsx")));
});

test("parts passes a scene with no parts folder, or one holding only non-component files", () => {
  assert.deepEqual(failed(runChecklist(fixture())), []);
  assert.deepEqual(failed(runChecklist(fixture({ extra: { "parts/types.ts": "export type A = 1;" } }))), []);
});

// Beat plan (CMO-7537 B): opt in with plan: true; each beat then says why it is there.
const PLANNED = (beat) => ({ ...SCENE, plan: true, beats: [{ n: 0, start: 0, end: 4, kind: "offer", ...beat }] });

test("plan: true with an empty or missing why fails the plan item", () => {
  assert.deepEqual(failed(runChecklist(fixture({ scene: PLANNED({ why: "" }) }))), ["plan"]);
  assert.deepEqual(failed(runChecklist(fixture({ scene: PLANNED({ why: "   " }) }))), ["plan"]);
  assert.deepEqual(failed(runChecklist(fixture({ scene: PLANNED({}) }))), ["plan"]);
});

test("plan: true with a why passes; enter and exit are optional", () => {
  const items = runChecklist(fixture({ scene: PLANNED({ why: "Shows the cost before the fix." }) }));
  assert.deepEqual(failed(items), []);
  assert.ok(items.some((i) => i.id === "plan" && i.pass));
});

test("without plan: true there is no plan item and an empty why is ignored", () => {
  const scene = { ...SCENE, beats: [{ n: 0, start: 0, end: 4, kind: "offer", why: "" }] };
  assert.equal(runChecklist(fixture({ scene })).some((i) => i.id === "plan"), false);
});
