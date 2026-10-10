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

function fixture(scene = SCENE, kinds = "export const KINDS = { offer: X };") {
  const root = mkdtempSync(join(tmpdir(), "cli-"));
  const dir = join(root, "scenes", "promo", "t");
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(root, "brands"), { recursive: true });
  writeFileSync(join(root, "brands", "b.json"), "{}");
  writeFileSync(join(dir, "scene.json"), JSON.stringify(scene));
  writeFileSync(join(dir, "kinds.tsx"), kinds);
  return { root, dir };
}

const video = (...args) => spawnSync("node", [VIDEO, ...args], { encoding: "utf8" });

test("check prints PASS per item and exits 0 on a clean scene", () => {
  const { dir } = fixture();
  const r = video("check", dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PASS {2}scene\.json valid/);
  assert.match(r.stdout, /checklist PASS: 8\/8/);
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

test("check runs the checklist per variant and passes a scene with a valid 9x16 variant (CMO-7577)", () => {
  const { dir } = fixture({ ...SCENE, variants: { "9x16": { size: [1080, 1920] } } });
  const r = video("check", dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PASS {2}variant 9x16: 1080x1920/);
  assert.match(r.stdout, /checklist PASS: 9\/9/);
});

test("check fails a variant whose size does not match its name", () => {
  const { dir } = fixture({ ...SCENE, variants: { "9x16": { size: [1080, 1080] } } });
  const r = video("check", dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /FAIL {2}variant 9x16/);
});

test("check exits 2 on a kinds.tsx that calls Math.random (seek purity, CMO-7537)", () => {
  const { dir } = fixture(SCENE, "export const KINDS = { offer: X };\nconst r = Math.random();");
  const r = video("check", dir);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /FAIL {2}engine and kinds\.tsx are seek-pure \(no clock, random or CSS transition\): kinds\.tsx uses Math\.random/);
  assert.match(r.stderr, /failed on 1 item: purity/);
});

test("check exits 2 on plan: true with an empty why, exits 0 once it is filled (CMO-7537)", () => {
  const empty = fixture({ ...SCENE, plan: true, beats: [{ ...SCENE.beats[0], why: "" }] });
  const bad = video("check", empty.dir);
  assert.equal(bad.status, 2);
  assert.match(bad.stdout, /FAIL {2}every beat says why it is there \(plan\): beat 0: why is empty/);
  const filled = fixture({ ...SCENE, plan: true, beats: [{ ...SCENE.beats[0], why: "Opens on the cost." }] });
  assert.equal(video("check", filled.dir).status, 0);
});
