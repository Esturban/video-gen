import assert from "node:assert/strict";
import test from "node:test";
import { shotlist } from "./shotlist.mjs";

const SCENE = {
  name: "demo",
  beats: [
    { n: 0, start: 0, end: 4.5, kind: "meter", enter: "fade in from the ground", exit: "shrinks to a dot", why: "Shows the cost before the fix." },
    { n: 1, start: 4.5, end: 9, kind: "card", why: "Lands the figure | with its source." },
  ],
};

test("one row per beat with time, kind, enter, exit and why", () => {
  const rows = shotlist(SCENE).split("\n").filter((l) => /^\| \d/.test(l));
  assert.equal(rows.length, 2);
  assert.equal(rows[0], "| 0 | 0.0-4.5s | meter | fade in from the ground | shrinks to a dot | Shows the cost before the fix. |");
});

test("missing enter and exit are blank cells, and a pipe in the text cannot break the table", () => {
  const row = shotlist(SCENE).split("\n").find((l) => l.startsWith("| 1 "));
  assert.equal(row, "| 1 | 4.5-9.0s | card |  |  | Lands the figure \\| with its source. |");
});

test("a scene with no plan fields still gets a list, with empty why cells", () => {
  const out = shotlist({ name: "old", beats: [{ n: 0, start: 0, end: 2, kind: "x" }] });
  assert.match(out, /^# Shot list: old/);
  assert.match(out, /\| 0 \| 0\.0-2\.0s \| x \|  \|  \|  \|/);
});
