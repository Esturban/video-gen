// Brief and style-guide gate (CMO-7576): a scene that sets "brief": true needs a filled brief.md and style-guide.md,
// and every image or video file scene.json names must be listed under Assets in brief.md (never invent product screens).
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const BRIEF_FIELDS = ["One sentence", "Audience", "Assets", "Banned defaults", "Deliverables"];
const STYLE_FIELDS = ["Palette", "Type", "Pacing", "Motion", "Do not copy"];
const MEDIA = /\.(?:png|jpe?g|svg|webp|gif|mp4|mov)$/i;

/** Field label -> section text. A field starts at a "## Field" heading or a "Field: text" line; any other heading ends it. */
function sections(text, fields) {
  const out = {};
  let current = null;
  for (const line of text.split("\n")) {
    const field = fields.find((f) => new RegExp(`^#{1,6}\\s+${f}\\s*:?\\s*$`, "i").test(line.trim()));
    const inline = field ? null : fields.map((f) => [f, line.trim().match(new RegExp(`^(?:[-*]\\s+)?\\**\\s*${f}\\s*\\**\\s*:\\s*\\**\\s*(.*)$`, "i"))]).find(([, m]) => m);
    if (field) { current = field; out[current] = ""; }
    else if (inline) { current = inline[0]; out[current] = inline[1][1]; }
    else if (/^\s*#/.test(line)) current = null;
    else if (current) out[current] += `\n${line}`;
  }
  return out;
}

function fieldProblems(dir, name, fields) {
  const file = join(dir, name);
  if (!existsSync(file)) return { problems: [`${name} is missing`], found: {} };
  const found = sections(readFileSync(file, "utf8"), fields);
  return { problems: fields.filter((f) => !found[f]?.trim()).map((f) => `${name}: "${f}" is missing or empty`), found };
}

/** Every string value in scene.json, at any depth, that names an image or video file. */
function mediaRefs(value) {
  if (typeof value === "string") return MEDIA.test(value) ? [value] : [];
  if (value && typeof value === "object") return Object.values(value).flatMap(mediaRefs);
  return [];
}

/** Problems with a scene's brief.md and style-guide.md. Empty array means fine. */
export function briefProblems(dir, scene) {
  const brief = fieldProblems(dir, "brief.md", BRIEF_FIELDS);
  const assets = brief.found.Assets ?? "";
  const unlisted = [...new Set(mediaRefs(scene).map((p) => basename(p)))].filter((f) => !assets.includes(f));
  return [
    ...brief.problems,
    ...unlisted.map((f) => `"${f}" is on screen but not listed in brief.md Assets: never invent product screens`),
    ...fieldProblems(dir, "style-guide.md", STYLE_FIELDS).problems,
  ];
}
