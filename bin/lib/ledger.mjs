// registry.csv and cost-log.csv bookkeeping for bin/video, split out so it can be tested without rendering.
// Both files are for REAL deliverable renders only: a render made with --out (a scratch render) writes to neither.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export const REGISTRY_HEAD = "name,owner,area,status,output,last_rendered";
export const COSTLOG_HEAD = "date,video,owner,tokens,render_minutes,video_seconds,fps,blur";

/** ISO UTC stamp to the minute with a Z suffix, e.g. 2026-10-03T15:36Z. */
export const utcStamp = (d = new Date()) => `${d.toISOString().slice(0, 16)}Z`;

/**
 * --tokens is required on a non-draft render (0 is allowed: a pure render spent no model tokens). Returns the
 * validated whole number, or throws an Error whose message says what to pass. --draft is exempt (returns null).
 */
export function requireTokens(flags) {
  if (flags.draft) return null;
  const raw = flags.tokens;
  if (raw === undefined) throw new Error("a render needs --tokens N, the model tokens spent making this video (0 is fine for a pure render with no model tokens). Example: bin/video render <scene> --tokens 0. --draft is exempt.");
  if (!/^\d+$/.test(String(raw))) throw new Error(`--tokens must be a whole number of tokens, 0 or more (got "${raw}")`);
  return Number(raw);
}

export const readRegistry = (paths) => (existsSync(paths.registry) ? readFileSync(paths.registry, "utf8").trim().split("\n").slice(1).filter(Boolean).map((l) => l.split(",")) : []);
export const writeRegistry = (paths, rows) => writeFileSync(paths.registry, [REGISTRY_HEAD, ...rows.map((r) => r.join(","))].join("\n") + "\n");

/** Update registry.csv for a finished render. Returns "skipped" for a --out scratch render, else "written". */
export function registryTouch(paths, scene, master, now = new Date()) {
  if (paths.customOut) return "skipped";
  const rows = readRegistry(paths);
  const out = master.replace(paths.root + "/", "");
  const today = now.toISOString().slice(0, 10);
  const row = rows.find((r) => r[0] === scene.name);
  if (row) { row[4] = out; row[5] = today; } else rows.push([scene.name, scene.owner, scene.area, "draft", out, today]);
  writeRegistry(paths, rows);
  return "written";
}

/** Append one row to cost-log.csv for a finished render. Returns "skipped" for a --out scratch render, else "written". */
export function costLog(paths, scene, { tokens, minutes, fps, blur }, now = new Date()) {
  if (paths.customOut) return "skipped";
  if (!existsSync(paths.costlog)) writeFileSync(paths.costlog, COSTLOG_HEAD + "\n");
  appendFileSync(paths.costlog, [utcStamp(now), scene.name, scene.owner, tokens, minutes.toFixed(1), scene.beats.at(-1).end, fps, blur].join(",") + "\n");
  return "written";
}
