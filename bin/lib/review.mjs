// reviews/<scene>-<date>.md: the file a reviewer and the judge write into. Each render appends its frame-gate report and sheet path (CMO-7537 C).
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const reviewFile = (folder, name, date) => join(folder, `${name}-${date}.md`);

const template = (name, date) => `# Review: ${name} ${date}

## Top 3 defects
Worst first. Each one: timestamp, evidence, local fix (the smallest change that removes it).

1. Timestamp:
   Evidence:
   Local fix:
2. Timestamp:
   Evidence:
   Local fix:
3. Timestamp:
   Evidence:
   Local fix:

## Everything else

## Judge verdict
Paste the Sonnet judge's verdict here and on the PAD ticket.

`;

/** Creates the file from the template on the first call, then appends one "Render" section with the frame-gate report. Returns the file path. */
export function appendRenderEntry(folder, { name, date, label, report }) {
  mkdirSync(folder, { recursive: true });
  const file = reviewFile(folder, name, date);
  if (!existsSync(file)) writeFileSync(file, template(name, date));
  appendFileSync(file, `## Render ${label}\n\n\`\`\`\n${report}\n\`\`\`\n\n`);
  return file;
}
