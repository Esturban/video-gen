// Black-box tests of bin/video for the commands that never start a render: check, and a render refused for lack of --tokens.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..", "video");
const SCENE = { name: "t", owner: "CMO", area: "promo", brand: "b", beats: [{ n: 0, start: 0, end: 4, kind: "offer" }] };

function fixture(scene = SCENE) {
  const root = mkdtempSync(join(tmpdir(), "cli-"));
  const dir = join(root, "scenes", "promo", "t");
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(root, "brands"), { recursive: true });
  writeFileSync(join(root, "brands", "b.json"), "{}");
  writeFileSync(join(dir, "scene.json"), JSON.stringify(scene));
  writeFileSync(join(dir, "kinds.tsx"), "export const KINDS = { offer: X };");
  return { root, dir };
}

const video = (...args) => spawnSync("node", [VIDEO, ...args], { encoding: "utf8" });

test("check prints PASS per item and exits 0 on a clean scene", () => {
  const { dir } = fixture();
  const r = video("check", dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PASS {2}scene\.json valid/);
  assert.match(r.stdout, /checklist PASS: 6\/6/);
  assert.doesNotMatch(r.stdout, /FAIL/);
});

test("check prints FAIL for the broken item and exits 2", () => {
  const { dir } = fixture({ ...SCENE, caption: "one — two" });
  const r = video("check", dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /FAIL {2}no em or en dash/);
  assert.match(r.stderr, /failed on 1 item: dashes/);
});

test("check writes nothing: no out folder, registry or cost-log appear", () => {
  const { root, dir } = fixture();
  video("check", dir);
  for (const name of ["out", "registry.csv", "cost-log.csv"]) assert.equal(existsSync(join(root, name)), false, name);
});

test("render without --tokens exits 2 with a clear message and renders nothing", () => {
  const { root, dir } = fixture();
  const r = video("render", dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--tokens N/);
  assert.equal(existsSync(join(root, "out")), false);
  assert.equal(existsSync(join(root, "cost-log.csv")), false);
});

test("render with a bad --tokens value exits 2", () => {
  const { dir } = fixture();
  const r = video("render", dir, "--tokens", "lots");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /whole number/);
});
