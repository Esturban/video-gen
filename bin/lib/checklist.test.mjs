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
