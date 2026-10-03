import assert from "node:assert/strict";
import { test } from "node:test";
import { DWELL_S, HOLD_S, buildStops, pointerSpeed, pointerState, pressTimes } from "./pointerPath.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// enter from off frame, rest on a field and click it, wait, glide to a button and click it, drift away
const PATH = [
  { t: 0.0, x: 1500, y: 1100 },
  { t: 1.5, x: 400, y: 500, act: "press" },
  { t: 4.0, x: 420, y: 520 },
  { t: 5.0, x: 900, y: 500, act: "press" },
  { t: 6.4, x: 1000, y: 700 },
];

test("held at the first waypoint before the start and at the last after the end", () => {
  const a = pointerState(PATH, -5);
  const b = pointerState(PATH, 0);
  near(a.x, 1500);
  near(a.y, 1100);
  assert.deepEqual([a.x, a.y], [b.x, b.y]);
  const z = pointerState(PATH, 60);
  near(z.x, 1000);
  near(z.y, 700);
});

test("lands exactly on every waypoint at its arrival time", () => {
  for (const w of PATH) {
    const s = pointerState(PATH, w.t);
    near(s.x, w.x, 1e-6);
    near(s.y, w.y, 1e-6);
  }
});

test("position is continuous across waypoint boundaries (no step between 1ms samples)", () => {
  let prev = pointerState(PATH, 0);
  let worst = 0;
  for (let t = 0.001; t < 7; t += 0.001) {
    const s = pointerState(PATH, t);
    worst = Math.max(worst, Math.hypot(s.x - prev.x, s.y - prev.y));
    prev = s;
  }
  // fastest glide here moves roughly 1500px in 1.5s with a smootherstep peak ~1.9x mean: about 2px per ms. A teleport would be hundreds.
  assert.ok(worst < 4, `largest 1ms step was ${worst}px`);
});

test("speed approaches zero as it arrives at the press target, and is exactly zero at the press time", () => {
  const stops = buildStops(PATH);
  const arrive = PATH[1].t;
  const mean = Math.hypot(400 - 1500, 500 - 1100) / (arrive - 0);
  const cruise = pointerSpeed(PATH, arrive / 2);
  assert.ok(cruise > 0.8 * mean, "it is actually moving mid-glide");
  assert.ok(pointerSpeed(PATH, arrive - 0.03) < 0.1 * mean, `still at ${pointerSpeed(PATH, arrive - 0.03)} px/s just before arrival`);
  const [pressAt] = pressTimes(PATH);
  near(pressAt, arrive + DWELL_S);
  near(pointerSpeed(PATH, pressAt), 0, 1e-6);
  near(stops[1].down, pressAt);
  // second press, same rule
  const [, press2] = pressTimes(PATH);
  near(pointerSpeed(PATH, press2), 0, 1e-6);
  const mean2 = Math.hypot(900 - 420, 500 - 520) / (PATH[3].t - PATH[2].t);
  assert.ok(pointerSpeed(PATH, PATH[3].t - 0.03) < 0.1 * mean2, "decelerates into the second press too");
});

test("button goes down at the press time, depth eases, comes up after HOLD_S, and a ripple is born", () => {
  const [p1] = pressTimes(PATH);
  assert.equal(pointerState(PATH, p1 - 0.01).down, false);
  assert.equal(pointerState(PATH, p1 + 0.01).down, true);
  assert.equal(pointerState(PATH, p1 + HOLD_S + 0.01).down, false);
  assert.equal(pointerState(PATH, p1 - 0.01).press, 0);
  const deep = Math.max(...[0.05, 0.08, 0.12, 0.15].map((d) => pointerState(PATH, p1 + d).press));
  assert.ok(deep > 0.95, `press depth peaked at ${deep}`);
  assert.ok(pointerState(PATH, p1 + 1.0).press < 1e-6, "released and settled");
  assert.equal(pointerState(PATH, p1 - 0.001).ripples.length, 0);
  const r = pointerState(PATH, p1 + 0.2).ripples;
  assert.equal(r.length, 1);
  near(r[0].x, 400);
  assert.equal(pointerState(PATH, p1 + 0.7).ripples.length, 0);
});

test("the pointer is held still while the button is down", () => {
  const [p1] = pressTimes(PATH);
  const a = pointerState(PATH, p1);
  const b = pointerState(PATH, p1 + HOLD_S - 0.001);
  near(a.x, b.x);
  near(a.y, b.y);
});

test("a press followed by a release is a drag: down until the release waypoint, pointer moves meanwhile", () => {
  const drag = [
    { t: 0, x: 0, y: 0 },
    { t: 1, x: 100, y: 100, act: "press" },
    { t: 2, x: 300, y: 100, act: "release" },
  ];
  assert.equal(pointerState(drag, 1.5).down, true);
  assert.ok(pointerState(drag, 1.5).x > 100);
  assert.equal(pointerState(drag, 2.01).down, false);
  assert.throws(() => buildStops([{ t: 0, x: 0, y: 0, act: "release" }]), /must follow a "press"/);
});

test("data that would force a teleport throws instead of rendering one", () => {
  assert.throws(() => buildStops([{ t: 0, x: 0, y: 0, act: "press" }, { t: 0.2, x: 50, y: 50 }]), /teleport/);
  assert.throws(() => buildStops([{ t: 1, x: 0, y: 0 }, { t: 1, x: 5, y: 5 }]), /not after the previous/);
  assert.throws(() => buildStops([]), /at least one/);
});

test("pointerState is a pure function of t: same t, same state, any order", () => {
  const a = [3, 1.2, 0.4, 1.2].map((t) => JSON.stringify(pointerState(PATH, t)));
  assert.equal(a[1], a[3]);
});
