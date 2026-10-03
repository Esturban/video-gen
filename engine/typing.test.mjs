import assert from "node:assert/strict";
import { test } from "node:test";
import { CARET_PERIOD_S, CARET_SOLID_S, caretVisible, shownChars, timeOfChar, typedText, typingEnd } from "./typingState.js";

const SPEC = { text: "Summarise the open items", start: 2, cps: 16, pauses: [{ at: 9, dur: 0.3 }] };

test("nothing before start, first character exactly at start", () => {
  assert.equal(shownChars(1.99, SPEC), 0);
  assert.equal(shownChars(2, SPEC), 1);
  assert.equal(typedText(2, SPEC), "S");
});

test("chars shown are monotonic in t and never skip more than one at a 60fps step", () => {
  let prev = 0;
  for (let t = 0; t < 6; t += 1 / 240) {
    const n = shownChars(t, SPEC);
    assert.ok(n >= prev, `went back at ${t}`);
    assert.ok(n - prev <= 1, `jumped ${n - prev} chars at ${t}`);
    prev = n;
  }
});

test("lands exactly on the full string at typingEnd, then holds forever", () => {
  const end = typingEnd(SPEC);
  assert.equal(shownChars(end - 1e-6, SPEC), SPEC.text.length - 1);
  assert.equal(typedText(end, SPEC), SPEC.text);
  assert.equal(typedText(end + 1000, SPEC), SPEC.text);
});

test("end time is start + (n-1)/cps + the pauses", () => {
  assert.ok(Math.abs(typingEnd(SPEC) - (2 + 23 / 16 + 0.3)) < 1e-12);
});

test("a pause holds the text at the pause point for its duration", () => {
  const at = timeOfChar(SPEC, 9);
  assert.equal(typedText(at, SPEC), "Summarise");
  assert.equal(typedText(at + 0.29, SPEC), "Summarise");
  assert.equal(typedText(timeOfChar(SPEC, 10), SPEC), "Summarise ");
  assert.ok(Math.abs(timeOfChar(SPEC, 10) - timeOfChar(SPEC, 9) - (1 / 16 + 0.3)) < 1e-12);
});

test("bad specs throw: cps, and pauses outside the text", () => {
  assert.throws(() => shownChars(1, { ...SPEC, cps: 0 }), /cps must be positive/);
  assert.throws(() => shownChars(1, { ...SPEC, pauses: [{ at: 99, dur: 1 }] }), /whole at in 1/);
  assert.throws(() => shownChars(1, { ...SPEC, pauses: [{ at: 0, dur: 1 }] }), /whole at in 1/);
});

test("caret: hidden before focus, solid while typing, blinks when idle, hidden after hideAt", () => {
  assert.equal(caretVisible(1, SPEC, 1.5), false);
  assert.equal(caretVisible(1.5, SPEC, 1.5), true);
  for (let t = 1.5; t < typingEnd(SPEC); t += 0.01) {
    // inside the typing run a pause longer than CARET_SOLID_S would blink, ours is shorter, so it stays solid
    assert.equal(caretVisible(t, SPEC, 1.5), true, `caret blinked mid-typing at ${t}`);
  }
  const end = typingEnd(SPEC);
  assert.equal(caretVisible(end + CARET_SOLID_S - 0.01, SPEC, 1.5), true);
  assert.equal(caretVisible(end + CARET_SOLID_S + CARET_PERIOD_S / 2 + 0.01, SPEC, 1.5), false);
  assert.equal(caretVisible(end + CARET_SOLID_S + CARET_PERIOD_S + 0.01, SPEC, 1.5), true);
  assert.equal(caretVisible(end + 5, SPEC, 1.5, end + 2), false);
});

test("typing is a pure function of t: same t, same text, any order", () => {
  const a = [5, 2.3, 0, 2.3].map((t) => typedText(t, SPEC));
  assert.equal(a[1], a[3]);
});
