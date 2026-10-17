import assert from "node:assert/strict";
import test from "node:test";
import { MAX_HASHTAGS, MAX_WORDS, postFor, postProblems, wordCount } from "./post.mjs";

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const OK = "Compute grew 4x a year for a decade.\n\nThat is why small models now train faster.\n\nThe full story is in the video.";

test("wordCount counts whitespace separated words", () => {
  assert.equal(wordCount("  one two\nthree  "), 3);
  assert.equal(wordCount(""), 0);
});

test("a good post has no problems", () => {
  assert.deepEqual(postProblems(OK), []);
});

test("fails at 80 words, passes at 79", () => {
  const filler = (n) => Array.from({ length: n }, () => "word").join(" ");
  assert.equal(MAX_WORDS, 80);
  assert.deepEqual(postProblems(`Hook line.\n\n${filler(74)}\n\nWatch the video.`), []); // 2 + 74 + 3 = 79 words
  const long = `Hook line.\n\n${filler(75)}\n\nWatch the video.`; // 2 + 75 + 3 = 80 words
  assert.match(postProblems(long).join(";"), /under 80 words/);
});

test("fails when the first line is empty", () => {
  assert.match(postProblems("\nBody about the video.").join(";"), /first line/);
});

test("fails when the text never says video", () => {
  assert.match(postProblems("A hook.\n\nA body with no mention.").join(";"), /"video"/);
});

test("allows two hashtags, fails three", () => {
  assert.equal(MAX_HASHTAGS, 2);
  assert.deepEqual(postProblems(`${OK}\n\n#AI #Data`), []);
  assert.match(postProblems(`${OK}\n\n#AI #Data #Compute`).join(";"), /at most 2 hashtags/);
});

test("fails on an em or en dash", () => {
  assert.match(postProblems(`${OK} one ${EM} two`).join(";"), /dash/);
  assert.match(postProblems(`${OK} 1${EN}2`).join(";"), /dash/);
});

test("skips a scene with no aha and no post", () => {
  const r = postFor({ name: "old", beats: [] });
  assert.equal(r.skip, true);
  assert.match(r.reason, /no aha or post/);
});

test("derives hook from history and body from aha when post is absent", () => {
  const r = postFor({ history: "In 2012 a GPU run took a week. By 2020 it took a day.", aha: "Bigger runs make smaller models cheaper to train." });
  assert.equal(r.skip, undefined);
  assert.equal(r.text.split("\n")[0], "In 2012 a GPU run took a week.");
  assert.match(r.text, /Bigger runs make smaller models cheaper to train\./);
  assert.match(r.text, /video/);
  assert.deepEqual(r.problems, []);
  assert.ok(r.words < 80);
});

test("derives the hook from aha alone and does not repeat it as the body", () => {
  const r = postFor({ aha: "Bigger runs make smaller models cheaper. That is the point." });
  assert.equal(r.text.split("\n")[0], "Bigger runs make smaller models cheaper.");
  assert.equal(r.text.split("Bigger runs").length - 1, 1);
});

test("uses explicit post fields over derived ones", () => {
  const r = postFor({ aha: "x.", post: { hook: "Why small models win.", body: "Short body.", cta: "Watch the video." } });
  assert.equal(r.text, "Why small models win.\n\nShort body.\n\nWatch the video.");
  assert.deepEqual(r.problems, []);
});

test("a long explicit post is reported as a problem, not thrown", () => {
  const body = Array.from({ length: 90 }, () => "w").join(" ");
  const r = postFor({ aha: "x.", post: { hook: "Hook.", body } });
  assert.match(r.problems.join(";"), /under 80 words/);
});

test("a post object with nothing to build a hook from is a problem", () => {
  const r = postFor({ post: { body: "Only a body about the video." } });
  assert.match(r.problems.join(";"), /hook/);
});
