import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { briefProblems } from "./brief.mjs";

const BRIEF = `# Brief
One sentence: A data story about prompt injection.
Audience: Ops leads at mid-size firms.
## Assets
- chart.png
- logo.svg
Banned defaults: no purple gradients, no stock robots.
Deliverables: 1440x1440 master, 9x16 cut.
`;
const STYLE = `## Palette
Navy and sand.
## Type
Geist.
## Pacing
One idea per beat.
## Motion
Morph, no spin.
## Do not copy
onetake code; method reference only.
`;
const SCENE = { name: "t", beats: [{ n: 0, kind: "offer", image: "assets/chart.png" }], brandSlot: { logo: "logo.svg" } };

function fixture({ brief = BRIEF, style = STYLE } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brief-"));
  if (brief !== null) writeFileSync(join(dir, "brief.md"), brief);
  if (style !== null) writeFileSync(join(dir, "style-guide.md"), style);
  return dir;
}

test("a full brief, style guide and listed assets has no problems", () => {
  assert.deepEqual(briefProblems(fixture(), SCENE), []);
});

test("a missing brief.md is a problem", () => {
  assert.ok(briefProblems(fixture({ brief: null }), { name: "t", beats: [] }).some((p) => /brief\.md is missing/.test(p)));
});

test("a missing field is named, case-insensitive heading or Field: line both count", () => {
  const brief = BRIEF.replace(/^Audience:.*$/m, "");
  assert.deepEqual(briefProblems(fixture({ brief }), SCENE), ['brief.md: "Audience" is missing or empty']);
  const mixed = BRIEF.replace("One sentence:", "## ONE SENTENCE\n");
  assert.deepEqual(briefProblems(fixture({ brief: mixed }), SCENE), []);
});

test("an empty field counts as missing", () => {
  const brief = BRIEF.replace(/^Deliverables:.*$/m, "Deliverables:");
  assert.deepEqual(briefProblems(fixture({ brief }), SCENE), ['brief.md: "Deliverables" is missing or empty']);
});

test("a screenshot named in scene.json but not listed in Assets fails, naming the file", () => {
  const scene = { ...SCENE, beats: [...SCENE.beats, { n: 1, kind: "offer", shots: ["assets/screens/dashboard.webp"] }] };
  assert.deepEqual(briefProblems(fixture(), scene), ['"dashboard.webp" is on screen but not listed in brief.md Assets: never invent product screens']);
});

test("a file named outside the Assets section does not count as listed", () => {
  const brief = BRIEF.replace("- logo.svg\n", "") + "\nNote: logo.svg pending.\n";
  assert.deepEqual(briefProblems(fixture({ brief }), SCENE), ['"logo.svg" is on screen but not listed in brief.md Assets: never invent product screens']);
});

test("a missing style-guide.md is a problem", () => {
  assert.deepEqual(briefProblems(fixture({ style: null }), SCENE), ["style-guide.md is missing"]);
});

test("a style guide missing a field names it", () => {
  const style = STYLE.replace("## Pacing\nOne idea per beat.\n", "");
  assert.deepEqual(briefProblems(fixture({ style }), SCENE), ['style-guide.md: "Pacing" is missing or empty']);
});
