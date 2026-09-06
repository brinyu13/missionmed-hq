import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const handoffDir = path.join(
  root,
  "_AI_HANDOFFS/from_codex/P1_RISE_4006_PRODUCTION_COMPLETION",
);
const outputPath = path.join(
  handoffDir,
  "P1_RISE_4006_PRODUCTION_COMPLETION_COMBINED_HANDOFF.md",
);

const entries = (await fs.readdir(handoffDir))
  .filter((name) => /^\d{2}_.+\.md$/.test(name))
  .sort((left, right) => left.localeCompare(right));

const expected = Array.from({ length: 22 }, (_, index) => String(index + 1).padStart(2, "0"));
const actual = entries.map((name) => name.slice(0, 2));
if (entries.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
  throw new Error(`Expected reports 01-22, found: ${entries.join(", ")}`);
}

const sections = [];
for (const name of entries) {
  const content = (await fs.readFile(path.join(handoffDir, name), "utf8")).trim();
  sections.push(`<!-- BEGIN ${name} -->\n\n${content}\n\n<!-- END ${name} -->`);
}

const combined = [
  "# P1 RISE 4006 Production Completion Combined Handoff",
  "",
  "This file contains the complete text of reports 01 through 22 in canonical order.",
  "",
  ...sections,
  "",
].join("\n");

await fs.writeFile(outputPath, combined, "utf8");
console.log(outputPath);
