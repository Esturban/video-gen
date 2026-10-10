// Caption sync check on rendered stills (CMO-7584): find the frame where the highlight moves onto a word, compare with the word's time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { captionPages } from "../../engine/captionMath.js";
import { highlightCentroid, leaveTime, nearestSwitch, pickCheckWords, seekTime, switchFrame, syncVerdict, wordVerdict, SYNC_TOLERANCE_FRAMES } from "./captionsync.mjs";

test("highlightCentroid finds the x centre of pixels near the highlight colour, null when none", () => {
  const w = 4, h = 1;
  const px = Buffer.from([0, 0, 0, 47, 93, 90, 47, 93, 90, 255, 255, 255]); // black, accent, accent, white
  assert.equal(highlightCentroid(px, w, h, [47, 93, 90]), 1.5);
  assert.equal(highlightCentroid(Buffer.alloc(12), w, h, [47, 93, 90]), null);
});

test("switchFrame returns the first frame whose centroid moved from the frame before", () => {
  const series = [{ frame: 27, x: 100 }, { frame: 28, x: 100.4 }, { frame: 29, x: 100 }, { frame: 30, x: 180 }, { frame: 31, x: 180 }];
  assert.equal(switchFrame(series), 30);
});

test("switchFrame treats appearing from nothing as a switch", () => {
  assert.equal(switchFrame([{ frame: 10, x: null }, { frame: 11, x: null }, { frame: 12, x: 50 }]), 12);
});

test("switchFrame is null when nothing changes in the window", () => {
  assert.equal(switchFrame([{ frame: 1, x: 5 }, { frame: 2, x: 5 }]), null);
});

test("syncVerdict passes within the tolerance and fails outside it or when no switch was seen", () => {
  assert.equal(SYNC_TOLERANCE_FRAMES, 2);
  assert.equal(syncVerdict(30, 32).pass, true);
  assert.equal(syncVerdict(30, 27).pass, false);
  assert.equal(syncVerdict(30, null).pass, false);
});

test("pickCheckWords takes three words spread across the scene, long enough that their enter and leave windows do not overlap", () => {
  const words = Array.from({ length: 12 }, (_, i) => ({ text: `w${i}`, start: i, end: i + (i % 2 ? 1 : 0.05), beat: 0 }));
  const picked = pickCheckWords(words, 3, 0.5);
  assert.equal(picked.length, 3);
  assert.ok(new Set(picked.map((w) => w.text)).size === 3);
  assert.ok(picked.every((w) => w.end - w.start >= 0.5));
  assert.ok(picked[0].start < picked[1].start && picked[1].start < picked[2].start);
});

test("pickCheckWords returns what it can when few words qualify", () => {
  const words = [{ text: "a", start: 0, end: 1, beat: 0 }];
  assert.equal(pickCheckWords(words, 3, 0.1).length, 1);
});

test("leaveTime is the next word's start on the same page, or the page end for a page's last word", () => {
  const words = [{ text: "a", start: 1, end: 1.4, beat: 0 }, { text: "b", start: 1.5, end: 2, beat: 0 }, { text: "c", start: 5, end: 5.5, beat: 1 }];
  const pages = captionPages(words, { linger: 0.6 });
  assert.equal(leaveTime(pages, words[0]), 1.5);
  assert.equal(leaveTime(pages, words[1]), 2.6);
});

test("wordVerdict passes only when the highlight both enters and leaves within tolerance", () => {
  assert.equal(wordVerdict({ expected: 30, seen: 31 }, { expected: 60, seen: 59 }).pass, true);
  assert.equal(wordVerdict({ expected: 30, seen: 31 }, { expected: 60, seen: 64 }).pass, false);
  assert.equal(wordVerdict({ expected: 30, seen: null }, { expected: 60, seen: 60 }).pass, false);
});

test("seekTime lands half a frame before the first frame, so ffmpeg never rounds past it and drops it", () => {
  // 151 / 60 = 2.51666..., which toFixed(4) rounds up to 2.5167: past frame 151's timestamp, so ffmpeg would start at 152.
  assert.equal(seekTime(151, 60), "2.508333");
  for (const [f, fps] of [[151, 60], [148, 60], [7, 30], [0, 60]]) {
    const t = Number(seekTime(f, fps));
    assert.ok(t <= f / fps && t > (f - 1) / fps, `${f}@${fps}: ${t}`);
  }
});

test("nearestSwitch picks the change closest to the expected frame, not a neighbouring short word's earlier change", () => {
  // Fixture case: "a" (2 frames) arrives at 568, "short" at 570; checking "short" must report 570.
  const series = [566, 567, 568, 569, 570, 571, 572].map((frame) => ({ frame, x: frame < 568 ? 100 : frame < 570 ? 140 : 190 }));
  assert.equal(nearestSwitch(series, 570), 570);
  assert.equal(nearestSwitch(series, 568), 568);
  assert.equal(nearestSwitch([{ frame: 1, x: 5 }, { frame: 2, x: 5 }], 2), null);
});

test("chooseCheckWords takes the words a scene names (first match, punctuation and case ignored), else spreads three evenly", async () => {
  const { chooseCheckWords } = await import("./captionsync.mjs");
  const words = ["Every", "word", "was", "timed", "plus", "a", "short", "on", "this", "laptop,"].map((text, i) => ({ text, start: i, end: i + 0.5 }));
  assert.deepEqual(chooseCheckWords(words, ["timed", "Short", "this"]).map((w) => w.text), ["timed", "short", "this"]);
  assert.deepEqual(chooseCheckWords(words, ["laptop"]).map((w) => w.text), ["laptop,"]);
  assert.throws(() => chooseCheckWords(words, ["absent"]), /"absent"/);
  assert.equal(chooseCheckWords(words, undefined).length, 3);
  assert.deepEqual(chooseCheckWords(words, undefined, 0, (w) => w.text !== "word").map((w) => w.text).includes("word"), false);
});
