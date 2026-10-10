import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendRenderEntry, reviewFile } from "./review.mjs";

const entry = (over = {}) => ({ name: "demo", date: "2026-10-10", label: "master", report: "frame check (a.mp4): 10 samples\n  PASS  no blank frames\n  contact sheet: /out/a-sheet.png\n  frame check PASS", ...over });
const tmp = () => mkdtempSync(join(tmpdir(), "review-"));

test("the review file is <folder>/<scene>-<date>.md", () => {
  assert.equal(reviewFile("/r", "demo", "2026-10-10"), join("/r", "demo-2026-10-10.md"));
});

test("the first render creates the template: top 3 defects with timestamp, evidence and local fix, then the rest, then the judge verdict", () => {
  const text = readFileSync(appendRenderEntry(tmp(), entry()), "utf8");
  assert.match(text, /^# Review: demo 2026-10-10/);
  assert.match(text, /## Top 3 defects[\s\S]*Timestamp[\s\S]*Evidence[\s\S]*Local fix/);
  assert.match(text, /## Everything else/);
  assert.match(text, /## Judge verdict/);
});

test("each render appends its frame-gate report and sheet path, one section per cut", () => {
  const dir = tmp();
  appendRenderEntry(dir, entry());
  const file = appendRenderEntry(dir, entry({ label: "9x16", report: "frame check (b.mp4)\n  contact sheet: /out/b-sheet.png" }));
  const text = readFileSync(file, "utf8");
  assert.match(text, /frame check \(a\.mp4\)[\s\S]*contact sheet: \/out\/a-sheet\.png/);
  assert.match(text, /frame check \(b\.mp4\)[\s\S]*contact sheet: \/out\/b-sheet\.png/);
  assert.equal((text.match(/^## Render /gm) ?? []).length, 2);
});

test("what a reviewer wrote survives the next render", () => {
  const dir = tmp();
  const file = appendRenderEntry(dir, entry());
  writeFileSync(file, readFileSync(file, "utf8").replace("1. ", "1. 00:07 the numeral ghosts. "));
  appendRenderEntry(dir, entry({ label: "9x16" }));
  assert.match(readFileSync(file, "utf8"), /1\. 00:07 the numeral ghosts\./);
});
