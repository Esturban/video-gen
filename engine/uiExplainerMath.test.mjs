import assert from "node:assert/strict";
import test from "node:test";
import { LAYOUTS, PUSH, cueTimes, flowDots, layoutFor, laneX, pushScale, reveal } from "./uiExplainerMath.js";

const inside = (box, W, H) => box.x >= 0 && box.y >= 0 && box.x + box.w <= W + 0.5 && box.y + box.h <= H + 0.5;

test("wide frame puts the caption column left of the panel", () => {
  const L = layoutFor(1920, 1080);
  assert.equal(L.shape, "wide");
  assert.ok(L.caption.x + L.caption.w < L.panel.x, "caption column ends before the panel starts");
  assert.ok(inside(L.panel, 1920, 1080));
  assert.equal(L.s, 1);
});

test("tall frame stacks the caption above the panel, inside the frame", () => {
  const L = layoutFor(1080, 1920);
  assert.equal(L.shape, "tall");
  assert.ok(L.caption.y + L.caption.h <= L.panel.y, "caption block ends above the panel");
  assert.ok(inside(L.panel, 1080, 1920));
  assert.ok(inside(L.caption, 1080, 1920));
});

test("a scaled frame scales every box and keeps the shape", () => {
  const big = layoutFor(3840, 2160);
  const base = layoutFor(1920, 1080);
  assert.equal(big.shape, "wide");
  assert.equal(big.s, 2);
  assert.equal(big.panel.w, base.panel.w * 2);
  assert.ok(Object.keys(LAYOUTS).includes("tall"));
});

test("cue times spread n items across the spoken part of the beat, in order", () => {
  const beat = { start: 10, end: 20, voiceAt: 0.4, voice: 8 };
  const ts = cueTimes(4, beat);
  assert.equal(ts.length, 4);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i] > ts[i - 1], "strictly increasing");
  assert.ok(ts[0] >= 0.4, "nothing reveals before the voice starts");
  assert.ok(ts[3] <= 0.4 + 8, "the last item lands while the voice is still speaking");
});

test("cue times without narration fall back to the beat length", () => {
  const ts = cueTimes(3, { start: 0, end: 6 });
  assert.ok(ts[0] >= 0 && ts[2] < 6);
  assert.deepEqual(cueTimes(1, { start: 0, end: 6, voiceAt: 1, voice: 4 }), [1 + 4 * 0.12]);
  assert.deepEqual(cueTimes(0, { start: 0, end: 6 }), []);
});

test("reveal is 0 before its cue, 1 after, and never steps more than 0.15 per 30 fps frame", () => {
  assert.equal(reveal(0.9, 1), 0);
  assert.equal(reveal(5, 1), 1);
  let prev = 0;
  for (let f = 0; f < 120; f++) {
    const v = reveal(f / 30, 1);
    assert.ok(Math.abs(v - prev) <= 0.15 + 1e-9, `frame ${f} jumped ${v - prev}`);
    prev = v;
  }
});

test("flow dots are a pure function of time: same t, same dots, all on the path", () => {
  const a = flowDots(7, 2, 6);
  const b = flowDots(7, 2, 6);
  assert.deepEqual(a, b);
  assert.equal(a.length, 6);
  for (const d of a) {
    assert.ok(d.u >= 0 && d.u < 1, "position along the path is in [0, 1)");
    assert.ok(d.op >= 0 && d.op <= 1);
  }
  assert.ok(flowDots(1, 2, 6).every((d) => d.op === 0), "no dots before the flow starts");
});

test("the slow push runs from 1 to 1 + PUSH across the beat and holds outside it", () => {
  assert.equal(pushScale(0, 10), 1);
  assert.equal(pushScale(10, 10), 1 + PUSH);
  assert.equal(pushScale(20, 10), 1 + PUSH);
  assert.ok(pushScale(5, 10) > 1 && pushScale(5, 10) < 1 + PUSH);
});

test("lane positions follow the given fractions inside the lane width", () => {
  assert.equal(laneX(0, 100, 900), 100);
  assert.equal(laneX(1, 100, 900), 1000);
  assert.throws(() => laneX(1.2, 0, 10), /0 to 1/);
});
