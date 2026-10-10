import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runChecklist } from "./checklist.mjs";

const SCENE = { name: "t", owner: "CMO", area: "promo", brand: "b", beats: [{ n: 0, start: 0, end: 4, kind: "offer" }] };
const KINDS = "export const KINDS = { offer: X };";

/** A scene folder plus a brands dir in a temp consumer root. Returns the args runChecklist wants. */
function fixture({ scene = SCENE, kinds = KINDS, extra = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "checklist-"));
  const dir = join(root, "scenes", "promo", "t");
  mkdirSync(join(dir, "assets", "fonts"), { recursive: true });
  mkdirSync(join(root, "brands"), { recursive: true });
  writeFileSync(join(root, "brands", "b.json"), "{}");
  writeFileSync(join(dir, "scene.json"), typeof scene === "string" ? scene : JSON.stringify(scene));
  writeFileSync(join(dir, "kinds.tsx"), kinds);
  for (const [name, text] of Object.entries(extra)) writeFileSync(join(dir, name), text);
  return { dir, brandDirs: [join(root, "brands")], outDir: join(root, "out") };
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
