// Pre-render gate for bin/video render. Pure checks over a scene folder; the CLI prints the result and exits 2 on any FAIL.
// Source of the rules: the DEV-7364 pre-render checklist plus house rules (no em or en dash, banned figure pair).
import { accessSync, constants, existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolveBrandSlot } from "../../engine/brandSlotMath.js";

const DASHES = /[\u2013\u2014]/; // en and em dash, as escapes so this file carries neither
const BANNED_A = /(?<!\d)(14|4) hours/i; // "14 hours" or "4 hours" ...
const BANNED_B = /12 minutes/i; // ... paired with "12 minutes" (EV disowned this figure, 2026-07-16)
const FONT_REF = /fonts\/[\w.-]+\.(?:woff2?|ttf|otf)/g;
const SOURCE_EXT = /\.(?:tsx?|jsx?|json)$/;
const SKIP_DIRS = new Set(["node_modules", "assets", "audio"]);
const REQUIRED = ["name", "owner", "area", "brand", "beats"];

export const MANUAL_REVIEW = [
  "Partner and government logos only on the closing wall, last",
  "No Microsoft logos; plain name, once",
  "Transparent logos on one clean dark backdrop, no white boxes",
  "Never write a name beside a logo that already carries it",
  "Small on-brand titles, about 8 words on screen per beat at most",
  "Event facts from our own decks first, labels verbatim",
  "Name every tool relevant to the event",
];

/** Every scene source file (json, ts, tsx) as [path, text], skipping assets and generated folders. */
export function sceneSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) out.push(...sceneSources(join(dir, entry.name))); continue; }
    if (SOURCE_EXT.test(entry.name) && entry.name !== "timing.json") out.push([join(dir, entry.name), readFileSync(join(dir, entry.name), "utf8")]);
  }
  return out;
}

const result = (id, label, problems) => ({ id, label, pass: problems.length === 0, detail: problems.join("; ") });

function checkScene(dir) {
  const file = join(dir, "scene.json");
  if (!existsSync(file)) return { problems: [`${file} is missing`] };
  let scene;
  try { scene = JSON.parse(readFileSync(file, "utf8")); } catch (e) { return { problems: [`not valid JSON: ${e.message}`] }; }
  const problems = REQUIRED.filter((k) => scene[k] === undefined).map((k) => `missing "${k}"`);
  if (!Array.isArray(scene.beats) || scene.beats.length === 0) return { scene, problems: [...problems, "beats must be a non-empty array"] };
  let prev = 0;
  for (const b of scene.beats) {
    if (!(b.end > b.start)) problems.push(`beat ${b.n}: needs start < end (got ${b.start}..${b.end})`);
    else if (b.start < prev) problems.push(`beat ${b.n}: starts at ${b.start}, before the previous beat ends (${prev})`);
    else prev = b.end;
  }
  return { scene, problems };
}

function checkKinds(dir, scene) {
  const file = join(dir, "kinds.tsx");
  if (!existsSync(file)) return [`${file} is missing: it maps each beat kind to a component`];
  const text = readFileSync(file, "utf8");
  const kinds = [...new Set((scene?.beats ?? []).map((b) => b.kind))];
  return kinds.filter((k) => !new RegExp(`(^|[\\s,{])["']?${k}["']?\\s*[:,}]`).test(text)).map((k) => `kind "${k}" is not in kinds.tsx`);
}

function checkFonts(dir, scene, brandDirs) {
  const problems = [];
  const brand = brandDirs.map((d) => join(d, `${scene?.brand}.json`)).find(existsSync);
  if (!brand) problems.push(`brand "${scene?.brand}" not found in ${brandDirs.join(" or ")}`);
  const refs = new Set(sceneSources(dir).flatMap(([, text]) => text.match(FONT_REF) ?? []));
  for (const ref of refs) if (!existsSync(join(dir, "assets", ref))) problems.push(`${ref} is referenced but missing from assets/`);
  return problems;
}

function checkCopy(dir) {
  const hits = (re) => sceneSources(dir).filter(([, text]) => re.test(text)).map(([p]) => basename(p));
  return {
    dashes: hits(DASHES).map((f) => `${f} contains an en or em dash`),
    banned: sceneSources(dir).filter(([, t]) => BANNED_A.test(t) && BANNED_B.test(t)).map(([p]) => `${basename(p)} carries the banned figure pair`),
  };
}

/** Read-only: the nearest existing ancestor of outDir (outDir itself when present) must be writable. Creates nothing, so `bin/video check` writes nothing. */
function checkWritable(outDir) {
  let at = outDir;
  while (!existsSync(at) && dirname(at) !== at) at = dirname(at);
  try { accessSync(at, constants.W_OK); return []; } catch (e) { return [`${outDir} is not writable (${at}): ${e.code ?? e.message}`]; }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Problems with a scene's brandSlot field: a bad value, a logo that is not in assets/, or a .png that is not a PNG. Empty array means fine. */
export function validateBrandSlotAssets(dir, spec) {
  let slot;
  try { slot = resolveBrandSlot(spec); } catch (e) { return [e.message]; }
  if (!slot.logo) return [];
  const file = join(dir, "assets", slot.logo);
  if (!existsSync(file)) return [`brandSlot.logo "${slot.logo}" is not in ${join(dir, "assets")}`];
  if (/\.png$/i.test(slot.logo) && !readFileSync(file).subarray(0, 8).equals(PNG_SIGNATURE)) return [`brandSlot.logo "${slot.logo}" is not a valid PNG`];
  return [];
}

/** Run every mechanical check. Returns [{ id, label, pass, detail }]. */
export function runChecklist({ dir, brandDirs, outDir }) {
  const { scene, problems: sceneProblems } = checkScene(dir);
  const copy = existsSync(dir) ? checkCopy(dir) : { dashes: [], banned: [] };
  const slot = scene?.brandSlot === undefined ? [] : [result("brandSlot", "brand slot valid", validateBrandSlotAssets(dir, scene.brandSlot))]; // only when the scene asks for one
  return [
    result("scene", "scene.json valid", sceneProblems),
    result("kinds", "every beat kind present in kinds.tsx", scene ? checkKinds(dir, scene) : ["no scene to check"]),
    result("fonts", "brand and fonts resolve", scene ? checkFonts(dir, scene, brandDirs) : ["no scene to check"]),
    result("dashes", "no em or en dash in on-screen copy", copy.dashes),
    result("banned", "banned figure pair absent", copy.banned),
    ...slot,
    result("output", "output dir writable", checkWritable(outDir)),
  ];
}

export const formatChecklist = (items) =>
  items.map((i) => `  ${i.pass ? "PASS" : "FAIL"}  ${i.label}${i.pass ? "" : `: ${i.detail}`}`).join("\n");
