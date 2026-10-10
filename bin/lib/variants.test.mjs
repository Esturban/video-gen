import assert from "node:assert/strict";
import test from "node:test";
import { LOCKED_BEAT_KEYS, resolveVariant, variantFileName, variantProblems, variantSizes } from "./variants.mjs";

const SCENE = Object.freeze({
  name: "story",
  size: [1440, 1440],
  beats: [
    { n: 0, start: 0, end: 10, kind: "story", layout: { strip: { cx: 1000, cy: 0 }, bars: { width: 150 } }, camera: [[0, 0, 0, 1.3], [10, 2150, 0, 1]] },
    { n: 1, start: 10, end: 12, kind: "outro", caption: "Thanks" },
  ],
  variants: {
    "9x16": { size: [1080, 1920], layoutOverrides: { 0: { layout: { strip: { cx: 0, cy: 920 } }, camera: [[0, 0, 0, 1.2], [10, 0, 2300, 1]] } } },
    "1x1": { size: [1080, 1080] },
  },
});

test("variant sizes: each declared variant renders at its own size, the master keeps its own", () => {
  assert.deepEqual(variantSizes(SCENE), [{ name: "9x16", size: [1080, 1920] }, { name: "1x1", size: [1080, 1080] }]);
  assert.deepEqual(resolveVariant(SCENE, "9x16").size, [1080, 1920]);
  assert.deepEqual(resolveVariant(SCENE, "1x1").size, [1080, 1080]);
  assert.deepEqual(SCENE.size, [1440, 1440]);
});

test("a scene with no variants has none", () => {
  const { variants, ...plain } = SCENE;
  assert.deepEqual(variantSizes(plain), []);
  assert.deepEqual(variantProblems(plain), {});
});

test("layout overrides deep-merge objects into the beat and replace arrays", () => {
  const v = resolveVariant(SCENE, "9x16");
  assert.deepEqual(v.beats[0].layout, { strip: { cx: 0, cy: 920 }, bars: { width: 150 } });
  assert.deepEqual(v.beats[0].camera, [[0, 0, 0, 1.2], [10, 0, 2300, 1]]);
  assert.equal(v.beats[1], SCENE.beats[1], "a beat with no override is passed through untouched");
});

test("same beats: timing, kind and narration are identical in every variant", () => {
  for (const { name } of variantSizes(SCENE)) {
    const v = resolveVariant(SCENE, name);
    assert.deepEqual(v.beats.map((b) => [b.n, b.start, b.end, b.kind]), SCENE.beats.map((b) => [b.n, b.start, b.end, b.kind]));
  }
});

test("resolving a variant never mutates the scene", () => {
  const before = JSON.stringify(SCENE);
  resolveVariant(SCENE, "9x16");
  assert.equal(JSON.stringify(SCENE), before);
});

test("the resolved scene carries its variant name and no variants map", () => {
  const v = resolveVariant(SCENE, "9x16");
  assert.equal(v.variant, "9x16");
  assert.equal(v.variants, undefined);
  assert.equal(v.name, "story");
});

test("an unknown variant name throws, naming the ones that exist", () => {
  assert.throws(() => resolveVariant(SCENE, "4x5"), /no variant "4x5".*9x16, 1x1/);
});

test("output file name: <scene>-<variant>", () => {
  assert.equal(variantFileName("data-story-morph", "9x16"), "data-story-morph-9x16");
});

const withVariant = (v) => ({ ...SCENE, variants: { "9x16": v } });

test("problems: a valid variant has none", () => {
  assert.deepEqual(variantProblems(SCENE), { "9x16": [], "1x1": [] });
});

test("problems: size must match the aspect in the name", () => {
  assert.match(variantProblems(withVariant({ size: [1080, 1080] }))["9x16"].join(), /aspect/);
});

test("problems: size must be two even whole numbers (h264 needs even sides)", () => {
  assert.match(variantProblems(withVariant({ size: [1081, 1922] }))["9x16"].join(), /even/);
  assert.match(variantProblems(withVariant({ size: "1080x1920" }))["9x16"].join(), /size/);
  assert.match(variantProblems(withVariant({}))["9x16"].join(), /size/);
});

test("problems: the name must be <w>x<h>", () => {
  const p = variantProblems({ ...SCENE, variants: { vertical: { size: [1080, 1920] } } });
  assert.match(p.vertical.join(), /name/);
});

test("problems: an override for a beat that does not exist", () => {
  assert.match(variantProblems(withVariant({ size: [1080, 1920], layoutOverrides: { 7: { layout: {} } } }))["9x16"].join(), /beat 7/);
});

test("problems: an override may not change timing or content keys", () => {
  for (const key of LOCKED_BEAT_KEYS) {
    const p = variantProblems(withVariant({ size: [1080, 1920], layoutOverrides: { 0: { [key]: 1 } } }));
    assert.match(p["9x16"].join(), new RegExp(`"${key}"`), key);
  }
});

test("problems: variants must be an object of objects", () => {
  assert.deepEqual(Object.keys(variantProblems({ ...SCENE, variants: [] })), ["variants"]);
  assert.match(variantProblems({ ...SCENE, variants: { "9x16": 3 } })["9x16"].join(), /object/);
});
