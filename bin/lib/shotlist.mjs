// out/<area>/<name>/shotlist.md: one row per beat, so the plan can be read without opening scene.json (CMO-7537 B).
const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export function shotlist(scene) {
  const rows = scene.beats.map((b) => `| ${b.n} | ${b.start.toFixed(1)}-${b.end.toFixed(1)}s | ${cell(b.kind)} | ${cell(b.enter)} | ${cell(b.exit)} | ${cell(b.why)} |`);
  return [`# Shot list: ${scene.name}`, "", "| Beat | Time | Kind | Enter | Exit | Why |", "|---|---|---|---|---|---|", ...rows, ""].join("\n");
}
