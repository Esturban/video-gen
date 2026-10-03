import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { COSTLOG_HEAD, costLog, REGISTRY_HEAD, registryTouch, requireTokens, utcStamp } from "./ledger.mjs";

const SCENE = { name: "t", owner: "CMO", area: "promo", beats: [{ n: 0, start: 0, end: 12 }] };
const RENDER = { tokens: 0, minutes: 1.74, fps: 60, blur: 2 };

function paths(customOut) {
  const root = mkdtempSync(join(tmpdir(), "ledger-"));
  return { root, customOut, out: join(root, "out"), registry: join(root, "registry.csv"), costlog: join(root, "cost-log.csv") };
}

test("utcStamp is ISO UTC to the minute with a Z suffix", () => {
  assert.equal(utcStamp(new Date("2026-10-03T15:36:59.123Z")), "2026-10-03T15:36Z");
  assert.match(utcStamp(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
});

test("requireTokens refuses a missing --tokens on a non-draft render", () => {
  assert.throws(() => requireTokens({}), /--tokens N/);
});

test("requireTokens accepts 0 and whole numbers", () => {
  assert.equal(requireTokens({ tokens: "0" }), 0);
  assert.equal(requireTokens({ tokens: "180000" }), 180000);
});

test("requireTokens rejects non-numeric, negative and fractional values", () => {
  for (const bad of ["abc", "-5", "1.5", ""]) assert.throws(() => requireTokens({ tokens: bad }), /whole number/);
});

test("requireTokens exempts --draft", () => {
  assert.equal(requireTokens({ draft: true }), null);
});

test("costLog writes the same 8 columns with a Z stamp and the given tokens", () => {
  const p = paths(false);
  assert.equal(costLog(p, SCENE, RENDER, new Date("2026-10-03T15:36:00Z")), "written");
  const [head, row] = readFileSync(p.costlog, "utf8").trim().split("\n");
  assert.equal(head, COSTLOG_HEAD);
  assert.equal(row, "2026-10-03T15:36Z,t,CMO,0,1.7,12,60,2");
  assert.equal(row.split(",").length, head.split(",").length);
});

test("costLog appends below existing older-format rows without touching them", () => {
  const p = paths(false);
  writeFileSync(p.costlog, `${COSTLOG_HEAD}\n2026-09-29T22:27,tj-vsl,CMO,200000,9.1,75.45,60,2\n`);
  costLog(p, SCENE, RENDER, new Date("2026-10-03T15:36:00Z"));
  const lines = readFileSync(p.costlog, "utf8").trim().split("\n");
  assert.equal(lines[1], "2026-09-29T22:27,tj-vsl,CMO,200000,9.1,75.45,60,2");
  assert.equal(lines.length, 3);
});

test("a --out render writes nothing to cost-log.csv", () => {
  const p = paths(true);
  assert.equal(costLog(p, SCENE, RENDER), "skipped");
  assert.equal(existsSync(p.costlog), false);
});

test("a --out render leaves an existing cost-log.csv byte for byte unchanged", () => {
  const p = paths(true);
  const before = `${COSTLOG_HEAD}\n2026-09-29T22:27,tj-vsl,CMO,200000,9.1,75.45,60,2\n`;
  writeFileSync(p.costlog, before);
  costLog(p, SCENE, RENDER);
  assert.equal(readFileSync(p.costlog, "utf8"), before);
});

test("a --out render writes nothing to registry.csv, a real render does", () => {
  const scratch = paths(true);
  assert.equal(registryTouch(scratch, SCENE, join(scratch.root, "out/promo/t/t.mp4")), "skipped");
  assert.equal(existsSync(scratch.registry), false);
  const real = paths(false);
  assert.equal(registryTouch(real, SCENE, join(real.root, "out/promo/t/t.mp4"), new Date("2026-10-03T15:36:00Z")), "written");
  assert.equal(readFileSync(real.registry, "utf8"), `${REGISTRY_HEAD}\nt,CMO,promo,draft,out/promo/t/t.mp4,2026-10-03\n`);
});
