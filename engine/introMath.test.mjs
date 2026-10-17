import assert from "node:assert/strict";
import test from "node:test";
import { REF_SECONDS, TREND, WORDMARK_EM, WINDOWS, cycle, easeOut, introState, layoutFor, pathOf, smooth, trendPoints, visibleTrend } from "./introMath.js";

test("smooth and easeOut hold 0 before, 1 after, and never decrease", () => {
  for (const fn of [smooth, easeOut]) {
    assert.equal(fn(0, 0.2, 0.5), 0);
    assert.equal(fn(0.9, 0.2, 0.5), 1);
    let prev = -1;
    for (let x = 0.2; x <= 0.5; x += 0.005) {
      const v = fn(x, 0.2, 0.5);
      assert.ok(v >= prev);
      prev = v;
    }
  }
});

test("every window sits inside the beat and the order is the story order", () => {
  for (const [name, [a, b]] of Object.entries(WINDOWS)) {
    assert.ok(a >= 0 && b <= 1 && a < b, `${name} window ${a}..${b}`);
  }
  assert.ok(WINDOWS.trend[0] < WINDOWS.wordmark[0]);
  assert.ok(WINDOWS.wordmark[0] < WINDOWS.rule[0]);
  assert.ok(WINDOWS.rule[0] < WINDOWS.byline[0]);
  assert.ok(WINDOWS.byline[1] < WINDOWS.exit[0]);
  assert.equal(REF_SECONDS, 6.5);
});

test("the first frame is empty-ish and the hold frame has every element in", () => {
  const first = introState(0, 6.5);
  assert.equal(first.grid[0], 0);
  assert.ok(introState(0.04, 6.5).grid[0] > 0.3); // motion is already under way inside the first 0.3 s
  assert.equal(first.trend, 0);
  assert.equal(first.wordmark, 0);
  assert.equal(first.byline, 0);
  assert.equal(first.exit, 1);
  const hold = introState(0.85, 6.5);
  assert.equal(hold.trend, 1);
  assert.equal(hold.wordmark, 1);
  assert.equal(hold.rule, 1);
  assert.equal(hold.byline, 1);
  assert.equal(hold.exit, 1);
});

test("the piece fades fully to paper on the last frame", () => {
  assert.equal(introState(1, 6.5).exit, 0);
  assert.ok(introState(0.97, 6.5).exit < 1);
});

test("introState is a pure function: same input, same output, in any order", () => {
  const a = introState(0.6, 6.5);
  introState(0.1, 6.5);
  assert.deepEqual(introState(0.6, 6.5), a);
});

test("the same fraction of a 5 s and an 8 s beat draws the same windows", () => {
  const a = introState(0.5, 5);
  const b = introState(0.5, 8);
  for (const key of ["exit", "trend", "head", "series", "wordmark", "rule", "byline"]) assert.equal(a[key], b[key], key);
});

test("trend points run left to right across the band and end at the top right", () => {
  const band = { x0: 0, x1: 1920, y0: 860, y1: 1004 };
  const pts = trendPoints(band);
  assert.equal(pts[0][0], 0);
  assert.equal(pts[pts.length - 1][0], 1920);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] > pts[i - 1][0]);
  assert.equal(pts[pts.length - 1][1], 860 + TREND[TREND.length - 1][1] * 144);
});

test("visibleTrend grows monotonically and lands exactly on the full polyline", () => {
  const pts = trendPoints({ x0: 0, x1: 1000, y0: 0, y1: 100 });
  assert.equal(visibleTrend(pts, 0).length, 1);
  assert.deepEqual(visibleTrend(pts, 1), pts);
  let prev = -1;
  for (let p = 0; p <= 1; p += 0.01) {
    const tip = visibleTrend(pts, p).at(-1);
    assert.ok(tip[0] >= prev);
    prev = tip[0];
  }
  assert.ok(Math.abs(visibleTrend(pts, 0.5).at(-1)[0] - 500) < 1e-9);
  assert.throws(() => visibleTrend([[0, 0]], 0.5));
});

test("layout keeps the wordmark block clear of the head frame and inside the canvas", () => {
  for (const [w, h] of [[1920, 1080], [3840, 2160], [1080, 1920]]) {
    const L = layoutFor(w, h);
    assert.ok(L.rule.x + L.rule.len < L.head.cx - L.head.r || w < h, `${w}x${h} rule meets head`);
    assert.ok(L.head.cx + L.head.r <= w && L.head.cy - L.head.r >= 0);
    assert.ok(L.band.y1 <= h && L.band.y0 > L.head.cy + L.head.r);
    assert.ok(L.band.x0 >= 64 * L.k && w - L.band.x1 >= 64 * L.k, "trend stays inside the 64 px safe margin");
  }
  assert.throws(() => layoutFor(0, 100));
});

test("cycle repeats and stays in 0..1; pathOf writes an M then L path", () => {
  assert.ok(Math.abs(cycle(0.25, 4, 1) - 0) < 1e-9);
  for (let f = 0; f <= 1; f += 0.07) {
    const c = cycle(f, 6.5, 0.6);
    assert.ok(c >= 0 && c < 1);
  }
  assert.equal(pathOf([[0, 0], [1, 2]]), "M0.00 0.00 L1.00 2.00");
});

test("introState rejects a non-positive duration", () => {
  assert.throws(() => introState(0.5, 0));
});

test("portrait layout: head on top, wordmark and rule inside the side margins, trend lower (CMO-8185)", () => {
  for (const [w, h] of [[1080, 1920], [720, 1280], [2160, 3840]]) {
    const L = layoutFor(w, h);
    const wordEnd = L.left + L.wordSize * WORDMARK_EM;
    assert.ok(L.left >= L.margin, `${w}x${h} wordmark starts inside the left margin`);
    assert.ok(wordEnd <= w - L.margin, `${w}x${h} wordmark end ${wordEnd} runs past the right margin ${w - L.margin}`);
    assert.ok(L.rule.x + L.rule.len <= w - L.margin, `${w}x${h} rule inside the margin`);
    const wordTop = L.wordBase - L.wordSize * 1.05;
    assert.ok(L.head.cy + L.head.r < wordTop - L.series.size, `${w}x${h} head bottom clears the series label and wordmark`);
    assert.ok(L.head.cy - L.head.r >= L.margin, "head inside the top margin");
    assert.ok(L.head.cx - L.head.r >= L.margin && L.head.cx + L.head.r <= w - L.margin, "head inside the side margins");
    assert.ok(L.byline.y < L.band.y0, "byline sits above the trend band");
    assert.ok(L.band.y1 <= h - L.margin, "trend band inside the bottom margin");
    assert.ok(L.band.x0 >= 64 * L.k && w - L.band.x1 >= 64 * L.k);
  }
});

test("landscape layout is unchanged by the portrait branch", () => {
  const L = layoutFor(1920, 1080);
  assert.equal(L.left, 140);
  assert.equal(L.wordSize, 168);
  assert.equal(L.head.cx, 1920 - 140 - 190);
});
