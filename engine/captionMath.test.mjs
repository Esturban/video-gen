// Word-timed captions (CMO-7584): which page and word show at time t, and the style taken from the brand file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { captionAt, captionPages, captionStyle, wordFrame } from "./captionMath.js";

const W = (text, start, end, beat = 0) => ({ text, start, end, beat });
const words = [W("one", 1, 1.3), W("two", 1.3, 1.6), W("three", 1.6, 2), W("four", 2, 2.4), W("five", 2.4, 2.8), W("six", 4, 4.4, 1)];

test("captionPages splits at maxWords, at a beat change and at a long silence", () => {
  const pages = captionPages(words, { maxWords: 3, maxGap: 0.8 });
  assert.deepEqual(pages.map((p) => p.words.map((w) => w.text)), [["one", "two", "three"], ["four", "five"], ["six"]]);
  assert.equal(pages[0].start, 1);
  assert.equal(pages[1].start, 2);
});

test("a page stays up until the next page starts, but not more than linger after its last word", () => {
  const pages = captionPages(words, { maxWords: 3, maxGap: 0.8, linger: 0.5 });
  assert.equal(pages[0].end, 2); // next page starts at 2
  assert.equal(pages[1].end, 3.3); // 2.8 + 0.5, the next page is at 4
  assert.equal(pages[2].end, 4.9);
});

test("captionAt returns nothing before the first word and in silences", () => {
  const pages = captionPages(words, { maxWords: 3, linger: 0.5 });
  assert.equal(captionAt(pages, 0.99), null);
  assert.equal(captionAt(pages, 3.5), null);
});

test("captionAt makes a word active exactly from its start time", () => {
  const pages = captionPages(words, { maxWords: 3 });
  assert.equal(captionAt(pages, 1.299).active, 0);
  assert.equal(captionAt(pages, 1.3).active, 1);
  const c = captionAt(pages, 2.0);
  assert.equal(c.page, 1);
  assert.equal(c.active, 0);
});

test("the active word holds through the gap before the next word on its page", () => {
  const gappy = [W("a", 1, 1.2), W("b", 1.6, 2)];
  const pages = captionPages(gappy, { maxWords: 4 });
  assert.equal(captionAt(pages, 1.4).active, 0);
});

test("wordFrame is the first frame whose time reaches the word start", () => {
  assert.equal(wordFrame(1, 30), 30);
  assert.equal(wordFrame(1.01, 30), 31);
  assert.equal(wordFrame(0.5, 60), 30);
});

test("at every word's frame captionAt reports that word, at 30 and 60 fps", () => {
  const pages = captionPages(words, { maxWords: 3 });
  for (const fps of [30, 60]) {
    for (const w of words) {
      const c = captionAt(pages, wordFrame(w.start, fps) / fps);
      assert.equal(pages[c.page].words[c.active].text, w.text, `${w.text} at ${fps}fps`);
    }
  }
});

test("captionStyle derives from the brand colours and font when the brand has no captions block", () => {
  const brand = { name: "b", background: "#faf7f1", font: "Avenir", colors: { ink: "#241f1a", accent: "#2f5d5a", paper: "#faf7f1", card: "#ffffff" } };
  const s = captionStyle(brand);
  assert.equal(s.font, "Avenir");
  assert.equal(s.ink, "#241f1a");
  assert.equal(s.highlight, "#2f5d5a");
  assert.equal(s.highlightInk, "#faf7f1");
  assert.equal(s.plate, "#ffffff");
});

test("a brand captions block overrides the derived values field by field", () => {
  const brand = { name: "b", background: "#000", font: "Avenir", colors: { ink: "#111111", accent: "#222222" }, captions: { highlight: "#ff0000", size: 70 } };
  const s = captionStyle(brand);
  assert.equal(s.highlight, "#ff0000");
  assert.equal(s.size, 70);
  assert.equal(s.ink, "#111111");
});

test("captionStyle falls back to safe values for a brand with few colours", () => {
  const s = captionStyle({ name: "b", background: "linear-gradient(red, blue)", font: "x", colors: {} });
  for (const k of ["ink", "highlight", "highlightInk", "plate"]) assert.match(s[k], /^#[0-9a-f]{6}$/i, k);
});
