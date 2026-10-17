// EV's video shape rule (CMO-8170): a short history or geography lead-in, then ONE aha, then stop.
// Scene fields: "aha" (string, the one finding) and "history" (string, optional lead-in), plus "intro" (a scenes/ folder, e.g. "brand/intro").
// The aha is only required where the brand's taste.json says require_aha: true, and not for scene names listed in aha_exempt.
import { statSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";

export const AHA_MISSING = 'scene has no "aha": name the ONE finding the video builds to (EV shape rule, CMO-8170)';

const isRequired = (scene, rules) => rules?.require_aha === true && !(rules.aha_exempt ?? []).includes(scene.name);

/** Does the "one aha" checklist item apply: required by the brand, or the scene set aha or history anyway. */
export const shapeApplies = (scene, rules) => isRequired(scene, rules) || scene.aha !== undefined || scene.history !== undefined;

/** Problems with a scene's aha and history fields. Empty array means fine. */
export function ahaProblems(scene, rules) {
  const problems = [];
  if (scene.aha !== undefined && typeof scene.aha !== "string") problems.push('"aha" must be a string: the ONE finding the video builds to');
  else if (isRequired(scene, rules) && !(scene.aha ?? "").trim()) problems.push(AHA_MISSING);
  if (scene.history !== undefined && typeof scene.history !== "string") problems.push('"history" must be a string: the short lead-in before the aha');
  return problems;
}

/** The scenes/ folder that holds a scene (the nearest ancestor named scenes), or null. */
export function scenesRootOf(dir) {
  const parts = dir.split(sep);
  const at = parts.lastIndexOf("scenes");
  return at > 0 ? parts.slice(0, at + 1).join(sep) : null;
}

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** Problems with scene.intro: it must be a relative path that resolves to a folder under the consumer's scenes/. */
export function introProblems(dir, scene) {
  if (scene.intro === undefined) return [];
  if (typeof scene.intro !== "string" || !scene.intro.trim()) return ['"intro" must be a string naming a folder under scenes/, e.g. "brand/intro"'];
  const root = scenesRootOf(dir);
  if (!root) return [`intro "${scene.intro}": the scene is not inside a scenes/ folder, so the intro cannot be resolved`];
  const rel = normalize(scene.intro);
  if (isAbsolute(rel) || rel.startsWith("..")) return [`intro "${scene.intro}" must stay inside scenes/ (use a path like "brand/intro")`];
  return isDir(join(root, rel)) ? [] : [`intro "${scene.intro}" does not resolve to a folder under ${root}: build it there or fix the name`];
}
