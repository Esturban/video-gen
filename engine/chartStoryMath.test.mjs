import assert from "node:assert/strict";
import { test } from "node:test";
import { STAGE_WINDOWS, buildStory, stageTimes } from "./chartStoryMath.js";
import { maxPointDistance, morphPoly } from "./morphMath.js";

export const CFG = {
  values: [820, 1240, 1610, 2050, 2480],
  labels: ["Jan", "Feb", "Mar", "Apr", "May"],
  cards: [{ label: "A", share: 38 }, { label: "B", share: 27 }, { label: "C", share: 21 }, { label: "D", share: 14 }],
  colors: { accent: "#2f5d5a", ink: "#241f1a", card: "#ffffff", line: "#e4dccd", paper: "#faf7f1" },
  tl: {
    dotIn: [0, 0.7], toRing: [1.0, 2.7], unroll: [3.6, 5.8], toBars: [5.2, 6.6], baselineIn: [6.3, 7.0], labelsIn: [6.8, 7.4],
    toLine: [7.5, 8.9], absorb: [9.6, 10.7], swell: [10.5, 12.0], count: [11.6, 12.9], toCard: [13.6, 14.2], split: [14.0, 15.4], cardsIn: [15.0, 15.8],
  },
  camera: [[0, 0, 0, 1.3], [2.7, 8, 2, 1.17], [3.6, 16, 2, 1.15], [5.8, 960, 0, 0.9], [6.6, 990, 8, 0.94], [7.5, 1004, 12, 0.96], [8.9, 1010, 2, 1], [10.5, 1022, 0, 1], [11.3, 1560, 0, 1.12], [12.2, 2140, 0, 1.3], [13.6, 2150, 0, 1.3], [15, 2160, 0, 1.1], [17.8, 2150, 0, 1]],
};
const END = 17.8;
const story = buildStory(CFG);
const FPS = 60;
const polysAt = (t) => { const s = story.at(t); return [...s.wedges.map((w) => w.poly), ...s.cards.map((c) => c.poly)]; };

test("a bad config fails loudly", () => {
  assert.throws(() => buildStory({ ...CFG, values: [1] }), /at least two positive/);
  assert.throws(() => buildStory({ ...CFG, tl: { ...CFG.tl, split: [5, 4] } }), /tl.split/);
  assert.throws(() => buildStory({ ...CFG, labels: ["a"] }), /one entry per value/);
});

test("continuity: across the whole piece no point of any shape moves more than a few px per 60fps frame", () => {
  let worst = 0;
  let at = 0;
  let prev = story.at(0).wedges.map((w) => w.poly);
  for (let f = 1; f <= Math.round(END * FPS); f++) {
    const s = story.at(f / FPS);
    const cur = s.wedges.map((w) => w.poly);
    if (s.cards.length === 0) cur.forEach((p, i) => { const d = maxPointDistance(prev[i], p); if (d > worst) { worst = d; at = f / FPS; } });
    prev = cur;
  }
  assert.ok(worst < 26, `largest single-frame point move ${worst.toFixed(1)}px at ${at}s`);
});

test("continuity of the split: cards start exactly on the big card and move in small steps", () => {
  const before = story.at(13.99).wedges[4].poly;
  const first = story.at(14.0).cards;
  for (const c of first) assert.ok(maxPointDistance(before, c.poly) < 6, "card must start on the big card");
  let prev = story.at(14.0).cards.map((c) => c.poly);
  for (let f = 14.0 * FPS; f <= Math.round(END * FPS); f++) {
    const cur = story.at(f / FPS).cards.map((c) => c.poly);
    cur.forEach((p, j) => assert.ok(maxPointDistance(prev[j], p) < 20, `card ${j} jumped at ${f / FPS}`));
    prev = cur;
  }
});

test("holds are still: shapes do not move between a stage's end and the next stage's start", () => {
  const holds = [[2.7, 3.6], [6.6, 7.5], [8.9, 9.6], [12.9, 13.6], [15.8, END]];
  for (const [a, b] of holds) {
    const pa = polysAt(a + 0.01);
    const pb = polysAt(b - 0.01);
    pa.forEach((p, i) => assert.ok(maxPointDistance(p, pb[i]) < 1e-6, `shape ${i} moved during the hold ${a} to ${b}`));
  }
});

test("each stage ends exactly on its target: bars have heights proportional to the values, the line ends on the dot", () => {
  const s = story.at(7.0);
  const tops = s.wedges.map((w) => Math.min(...w.poly.filter((_, i) => i % 2 === 1)));
  const heights = tops.map((y) => story.layout.bars.baseY - y);
  const ratio = heights.map((h, i) => h / CFG.values[i]);
  ratio.forEach((r) => assert.ok(Math.abs(r - ratio[0]) < 0.02, `bar heights not proportional: ${ratio}`));
  const end = story.at(9.5).wedges[4].poly;
  const xs = end.filter((_, i) => i % 2 === 0);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - story.linePt[4][0]) < 1e-6);
});

test("ring wedges are sized by value share, with the same colour order as the data", () => {
  const ring = story.at(3.2);
  assert.equal(ring.wedges.length, 5);
  assert.ok(ring.wedges.every((w) => w.visible));
  const lightFirst = ring.wedges.map((w) => Number(w.fill.match(/\d+/g)[0]));
  assert.ok(lightFirst[0] > lightFirst[4], "smallest value is the lightest tint, largest the full accent");
});

test("the dot at the start is one visible shape and the segments are absorbed by the end", () => {
  assert.ok(story.at(0.9).wedges.every((w) => w.visible), "dot visible at 0.9s");
  assert.equal(story.at(0).wedges.every((w) => !w.visible), true, "nothing drawn at t = 0");
  const end = story.at(16);
  assert.equal(end.cards.length, 4);
  assert.equal(end.wedges.filter((w) => w.visible).length, 0, "the four segments are pulled into the number");
});

test("the number rolls up monotonically to the end value and then holds; cards count to their shares", () => {
  let last = -1;
  for (let t = 11; t <= 13.0; t += 0.02) { const v = story.at(t).number.value; assert.ok(v >= last); last = v; }
  assert.equal(story.at(12.9).number.value, 2480);
  assert.equal(story.at(16).number.value, 2480);
  assert.deepEqual(story.at(17.5).cardContent.map((c) => c.value), [38, 27, 21, 14]);
  assert.equal(story.at(0).number.opacity, 0);
});

test("camera never jumps and stage times list the chain in order", () => {
  let last = story.at(0).camera;
  for (let f = 1; f <= Math.round(END * FPS); f++) {
    const c = story.at(f / FPS).camera;
    assert.ok(Math.hypot(c.cx - last.cx, c.cy - last.cy) < 20, `camera jumped at ${f / FPS}`);
    last = c;
  }
  assert.deepEqual(stageTimes(CFG).map((s) => s.name), STAGE_WINDOWS);
  const m = morphPoly([0, 0], [10, 10], 0.5);
  assert.deepEqual(m, [5, 5]);
});
