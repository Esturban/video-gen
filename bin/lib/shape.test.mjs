import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ahaProblems, introProblems, scenesRootOf, shapeApplies } from "./shape.mjs";

const RULES = { require_aha: true, aha_exempt: ["old-one"] };

test("a missing or blank aha fails with the EV shape message", () => {
  const msg = 'scene has no "aha": name the ONE finding the video builds to (EV shape rule, CMO-8170)';
  assert.deepEqual(ahaProblems({ name: "new" }, RULES), [msg]);
  assert.deepEqual(ahaProblems({ name: "new", aha: "" }, RULES), [msg]);
  assert.deepEqual(ahaProblems({ name: "new", aha: "   " }, RULES), [msg]);
});

test("a filled aha passes, history is optional", () => {
  assert.deepEqual(ahaProblems({ name: "new", aha: "Small models win." }, RULES), []);
  assert.deepEqual(ahaProblems({ name: "new", aha: "x", history: "Back then." }, RULES), []);
});

test("aha and history must be strings", () => {
  assert.match(ahaProblems({ name: "n", aha: 5 }, RULES).join(";"), /"aha" must be a string/);
  assert.match(ahaProblems({ name: "n", aha: "x", history: [] }, RULES).join(";"), /"history" must be a string/);
});

test("exempt scenes and brands without the key are unaffected", () => {
  assert.deepEqual(ahaProblems({ name: "old-one" }, RULES), []);
  assert.deepEqual(ahaProblems({ name: "new" }, {}), []);
  assert.deepEqual(ahaProblems({ name: "new" }, null), []);
  assert.equal(shapeApplies({ name: "old-one" }, RULES), false);
  assert.equal(shapeApplies({ name: "new" }, {}), false);
  assert.equal(shapeApplies({ name: "new" }, RULES), true);
});

test("an item still applies when a non-required scene sets aha or history", () => {
  assert.equal(shapeApplies({ name: "x", aha: "y" }, {}), true);
  assert.equal(shapeApplies({ name: "x", history: "y" }, null), true);
});

function tree() {
  const root = mkdtempSync(join(tmpdir(), "shape-"));
  const dir = join(root, "scenes", "promo", "s");
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, "scenes", "brand", "intro"), { recursive: true });
  return { root, dir };
}

test("scenesRootOf finds the scenes ancestor", () => {
  const { root, dir } = tree();
  assert.equal(scenesRootOf(dir), join(root, "scenes"));
  assert.equal(scenesRootOf("/tmp/nowhere/x"), null);
});

test("intro resolves to a folder under scenes/", () => {
  const { dir } = tree();
  assert.deepEqual(introProblems(dir, { intro: "brand/intro" }), []);
  assert.deepEqual(introProblems(dir, {}), []);
});

test("intro that does not resolve, escapes scenes/ or is not a string fails", () => {
  const { dir } = tree();
  assert.match(introProblems(dir, { intro: "brand/missing" }).join(";"), /does not resolve to a folder under/);
  assert.match(introProblems(dir, { intro: "../../etc" }).join(";"), /inside scenes\//);
  assert.match(introProblems(dir, { intro: "/abs/path" }).join(";"), /inside scenes\//);
  assert.match(introProblems(dir, { intro: 5 }).join(";"), /must be a string/);
});

test("intro on a scene outside any scenes/ folder fails clearly", () => {
  assert.match(introProblems("/tmp/nowhere/x", { intro: "brand/intro" }).join(";"), /not inside a scenes\/ folder/);
});
