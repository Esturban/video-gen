// REUSE_CHECKED: 1_social/py/video-gen/engine/uiExplainerMath.test.mjs  same node:test layout; these cases cover the AppMock / CoachDemo maths (CMO-8248)
import assert from "node:assert/strict";
import test from "node:test";
import { alpha, beatTag, buildCues, countUp, emailLineWindow, mockPalette, resolveRefs, rgbOf, scrollOffset, stageLabel, streamCount, typedState } from "./appMockMath.js";

const ATOMCAMP = { navy: "#0A0A0A", deep: "#000000", green: "#99D930", sage: "#898989", ok: "#99D930", alert: "#F2B84B", red: "#E06C5A", soft: "#898989", line: "rgba(255,255,255,0.24)", paper: "#FFFFFF", mist: "#E0FAE3", ink: "#0A0A0A", muted: "#595959" };

test("rgbOf reads a 6 digit hex, alpha writes rgba and passes non-hex colours through", () => {
  assert.deepEqual(rgbOf("#F2B84B"), [242, 184, 75]);
  assert.equal(alpha("#F2B84B", 0.45), "rgba(242,184,75,0.45)");
  assert.equal(alpha("rgba(1,2,3,0.5)", 0.2), "rgba(1,2,3,0.5)");
});

test("mockPalette maps the atomcamp brand exactly as mashreq-demo1's theme did", () => {
  const c = mockPalette(ATOMCAMP);
  assert.equal(c.dark, "#0A0A0A");
  assert.equal(c.accent, "#99D930");
  assert.equal(c.glow, "#99D930");
  assert.equal(c.amber, "#F2B84B");
  assert.equal(c.rule, "#E0FAE3");
  assert.equal(c.mist, "#E0FAE3");
  assert.equal(c.muted, "#595959");
  assert.equal(c.onDark, "#fff");
});

test("mockPalette falls back through role chains for a brand with other keys, never undefined", () => {
  const c = mockPalette({ accent: "#2f5d5a", paper: "#faf7f1", line: "#e4dccd", ink: "#241f1a", inkSoft: "#6b6358", card: "#ffffff" });
  assert.equal(c.accent, "#2f5d5a");
  assert.equal(c.muted, "#6b6358");
  assert.equal(c.rule, "#faf7f1");
  for (const [k, v] of Object.entries(c)) assert.equal(typeof v, "string", `role ${k}`);
  assert.equal(mockPalette({}).ink.length > 0, true);
});

test("typedState is monotonic, lands on the full string and shows a caret only mid-typing", () => {
  assert.deepEqual(typedState(10, 0), { n: 0, caret: false });
  assert.deepEqual(typedState(10, 0.5), { n: 5, caret: true });
  assert.deepEqual(typedState(10, 1), { n: 10, caret: false });
  let prev = -1;
  for (let k = 0; k <= 1; k += 0.01) { const { n } = typedState(37, k); assert.ok(n >= prev); prev = n; }
});

test("streamCount streams joined lines and lands exactly on the whole text", () => {
  assert.equal(streamCount(["ab", "cd"], 1), 5);
  assert.equal(streamCount(["ab", "cd"], 0), 0);
});

test("countUp rounds and holds the target", () => {
  assert.equal(countUp(25, 1), 25);
  assert.equal(countUp(25, 0.5), 13);
  assert.equal(countUp(25, 0), 0);
});

test("buildCues reproduces mashreq BuildCard step and prompt times as beat fractions", () => {
  const { stepAt, promptAt } = buildCues({ voiceAt: 0.4, voice: 16.15, duration: 22.75 }, 5);
  assert.equal(stepAt.length, 5);
  assert.ok(Math.abs(stepAt[0] - 2.4 / 22.75) < 1e-12);
  assert.ok(Math.abs(stepAt[4] - (0.4 + 2 + 4 * (13.15 / 5)) / 22.75) < 1e-12);
  assert.ok(Math.abs(promptAt - (0.4 + 16.15 * 0.72) / 22.75) < 1e-12);
  for (let i = 1; i < 5; i++) assert.ok(stepAt[i] > stepAt[i - 1]);
});

test("buildCues survives a beat with no narration timing", () => {
  const { stepAt, promptAt } = buildCues({ duration: 10 }, 3);
  assert.ok(stepAt.every((x) => Number.isFinite(x)));
  assert.ok(Number.isFinite(promptAt));
});

test("emailLineWindow splits a highlight span evenly across n lines", () => {
  assert.deepEqual(emailLineWindow([0.2, 0.7], 0, 5), [0.2, 0.2 + 0.6 * 0.1]);
  const [a, b] = emailLineWindow([0.2, 0.7], 4, 5);
  assert.ok(Math.abs(a - 0.6) < 1e-12 && Math.abs(b - 0.66) < 1e-12);
});

test("resolveRefs swaps \"$key\" strings for scene data, deeply, and leaves other values alone", () => {
  const data = { tasks: [{ task: "A" }], email: { subject: "S" } };
  const out = resolveRefs({ type: "board", tasks: "$tasks", nested: { e: "$email" }, list: ["$tasks", 3], plain: "price $5" }, data);
  assert.deepEqual(out.tasks, [{ task: "A" }]);
  assert.deepEqual(out.nested.e, { subject: "S" });
  assert.deepEqual(out.list[0], [{ task: "A" }]);
  assert.equal(out.plain, "price $5");
  assert.throws(() => resolveRefs({ x: "$missing" }, data), /\$missing/);
});

test("scrollOffset wraps and is a pure function of time", () => {
  assert.equal(scrollOffset(0, 120, 440), -0);
  assert.equal(scrollOffset(1, 120, 440), -120);
  assert.equal(scrollOffset(4, 120, 440), -40);
  assert.equal(scrollOffset(4, 120, 440), scrollOffset(4, 120, 440));
});

test("stageLabel follows the beat kind with overrides", () => {
  assert.equal(stageLabel("problem"), "The problem");
  assert.equal(stageLabel("result"), "The result");
  assert.equal(stageLabel("proof"), "The result");
  assert.equal(stageLabel("tool"), "What the agent does");
  assert.equal(stageLabel("tool", { tool: "How it works" }), "How it works");
});

test("beatTag: beat tag, then per-beat override, then scene tag, then the default", () => {
  assert.equal(beatTag({ n: 1 }, {}), "Example data");
  assert.equal(beatTag({ n: 1 }, { exampleTag: "Real open source data" }), "Real open source data");
  assert.equal(beatTag({ n: 1 }, { exampleTag: "Real", tagFor: { 1: "Illustration" } }), "Illustration");
  assert.equal(beatTag({ n: 2, tag: "Own" }, { tagFor: { 2: "x" } }), "Own");
  assert.equal(beatTag({ n: 2, tag: "" }, {}), "");
});
