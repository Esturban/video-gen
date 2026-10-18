// REUSE_CHECKED: 1_social/py/video-gen/engine/uiExplainerMath.test.mjs   same node:test layout as the other engine maths tests
import assert from "node:assert/strict";
import test from "node:test";
import { alpha, bubbleWidth, dotFor, heatAt, pulseAt, rampColor, rgbOf, ringPoint, stagePalette, typingDot, within } from "./cityStageMath.js";

test("rgbOf and alpha read a brand hex, ignoring extra alpha digits", () => {
  assert.deepEqual(rgbOf("#99D930"), [153, 217, 48]);
  assert.deepEqual(rgbOf("#99D930ff"), [153, 217, 48]);
  assert.equal(alpha("#FFFFFF", 0.14), "rgba(255,255,255,0.14)");
});

test("stagePalette maps the dark client keys straight through", () => {
  const P = stagePalette({ navy: "#0A0A0A", green: "#99D930", alert: "#F2B84B", hot: "#F2B84B", sage: "#898989", deep: "#000000", paper: "#FFFFFF", mist: "#E0FAE3", muted: "#595959", soft: "#898989", line: "rgba(255,255,255,0.24)" });
  assert.equal(P.ink, "#0A0A0A");
  assert.equal(P.accent, "#99D930");
  assert.equal(P.warn, "#F2B84B");
  assert.equal(P.mist, "#E0FAE3");
  assert.equal(P.line, "rgba(255,255,255,0.24)");
  assert.equal(P.light, "#FFFFFF");
});

test("stagePalette falls back to the generic engine keys, then to neutral defaults", () => {
  const P = stagePalette({ ink: "#241f1a", accent: "#2f5d5a", action: "#1f4f8f", card: "#ffffff", inkSoft: "#6b6358" });
  assert.equal(P.ink, "#241f1a");
  assert.equal(P.accent, "#2f5d5a");
  assert.equal(P.warn, "#1f4f8f");
  assert.equal(P.paper, "#ffffff");
  assert.equal(P.sage, "#6b6358");
  const empty = stagePalette();
  for (const v of Object.values(empty)) assert.equal(typeof v, "string");
});

test("dotFor resolves a brand key, passes a literal colour, and falls back for unknown labels", () => {
  const colors = { green: "#0f0" };
  assert.equal(dotFor("A", { A: "green" }, colors, "#fff"), "#0f0");
  assert.equal(dotFor("A", { A: "#123456" }, colors, "#fff"), "#123456");
  assert.equal(dotFor("B", { A: "green" }, colors, "#fff"), "#fff");
  assert.equal(dotFor("B", undefined, colors, "#fff"), "#fff");
});

test("pulseAt is 0 until start, then repeats every period", () => {
  assert.equal(pulseAt(6, 6.4, 1.6), 0);
  assert.equal(pulseAt(6.4, 6.4, 1.6), 0);
  assert.ok(Math.abs(pulseAt(7.2, 6.4, 1.6) - 0.5) < 1e-9);
  assert.ok(Math.abs(pulseAt(7.2 + 1.6, 6.4, 1.6) - 0.5) < 1e-9);
});

test("heatAt peaks at the hot cell, stays in 0..1, and honours the cool zone", () => {
  const spec = { hot: [7, 2], radius: 6, cool: (c, r) => c <= 2 && r >= 3 };
  assert.equal(heatAt(1, 4, spec), 0.05);
  for (let c = 0; c < 10; c++) for (let r = 0; r < 6; r++) {
    const v = heatAt(c, r, spec);
    assert.ok(v >= 0 && v <= 1, `cell ${c},${r} out of range: ${v}`);
  }
  assert.ok(heatAt(7, 2, spec) > heatAt(4, 5, spec));
});

test("rampColor hits each stop exactly", () => {
  const stops = ["#000000", "#808080", "#FFFFFF"];
  assert.equal(rampColor(0, stops), "rgb(0,0,0)");
  assert.equal(rampColor(0.5, stops), "rgb(128,128,128)");
  assert.equal(rampColor(1, stops), "rgb(255,255,255)");
});

test("ringPoint starts at the top and goes clockwise", () => {
  const [x0, y0] = ringPoint(0, 4, 960, 560, 250);
  assert.ok(Math.abs(x0 - 960) < 1e-9 && Math.abs(y0 - 310) < 1e-9);
  const [x1, y1] = ringPoint(1, 4, 960, 560, 250);
  assert.ok(Math.abs(x1 - 1210) < 1e-9 && Math.abs(y1 - 560) < 1e-9);
});

test("bubbleWidth, typingDot and within", () => {
  assert.equal(bubbleWidth("abc"), 3 * 14.2 + 60);
  for (let s = 0; s < 10; s += 0.37) for (let k = 0; k < 3; k++) {
    const o = typingDot(s, k);
    assert.ok(o >= 0.35 && o <= 1);
  }
  assert.equal(within(2, 1.9, 3.3), true);
  assert.equal(within(1.9, 1.9, 3.3), false);
  assert.equal(within(3.3, 1.9, 3.3), false);
});
