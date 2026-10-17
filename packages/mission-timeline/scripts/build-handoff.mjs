import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const worktreeRoot = resolve(packageRoot, "../..");
const engineRoot = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const reportRoot = join(engineRoot, "reports");
const repoHandoffRoot = join(worktreeRoot, "_AI_HANDOFFS/from_codex/D1_TIMELINE_412");

const packageMarkdown = [
  "README.md",
  "database/README.md",
  "docs/ARCHITECTURE.md",
  "docs/DEPLOYMENT_GATES.md",
  "docs/MATRIX_PATCH_CONTRACT.md",
  "docs/MEDICAL_EDUCATION_REVIEW.md",
  "docs/SECURITY.md",
  "matrix/README.md",
  "release/rollback-plan.md",
].map((relativePath) => ({
  label: `packages/mission-timeline/${relativePath}`,
  path: join(packageRoot, relativePath),
}));

const reportNames = [
  "D1_412_FINAL_REPORT.md",
  "D1_412_EXECUTION_REPORT.md",
  "D1_412_PRODUCTION_IMPLEMENTATION_REPORT.md",
  "D1_412_MATRIX_APP_MODE_REPORT.md",
  "D1_412_IDENTITY_SECURITY_RLS_REPORT.md",
  "D1_412_PERSISTENCE_STORAGE_REPORT.md",
  "D1_412_ADVISOR_EXPORT_FILEVAULT_REPORT.md",
  "D1_412_MEDICAL_EDUCATION_REVIEW.md",
  "D1_412_TEST_UI_ACCESSIBILITY_PERFORMANCE_REPORT.md",
  "D1_412_RELEASE_ROLLBACK_AND_BLOCKERS.md",
  "D1_412_NEXT_STEPS.md",
  "D1_412_COMPLETION_AUDIT.md",
];

const reports = reportNames.map((name) => ({ label: `reports/${name}`, path: join(reportRoot, name) }));
const included = [...reports, ...packageMarkdown];

for (const item of included) {
  if (!existsSync(item.path)) throw new Error(`Missing handoff input: ${item.path}`);
}

const sections = included.map((item) => [
  `# Included File: ${item.label}`,
  "",
  `Source: \`${item.path}\``,
  "",
  readFileSync(item.path, "utf8").trimEnd(),
].join("\n"));

const combined = [
  "# D1-412 Complete Combined Handoff",
  "",
  "Generated: 2026-07-15",
  "",
  "This file contains the complete text of every Markdown report and package document created by D1-412. Combined handoff files are excluded from recursive inclusion.",
  "",
  `Included files: ${included.length}`,
  "",
  "---",
  "",
  sections.join("\n\n---\n\n"),
  "",
].join("\n");

const combinedPaths = [
  join(engineRoot, "D1_412_COMBINED_HANDOFF.md"),
  join(reportRoot, "D1_412_COMBINED_HANDOFF.md"),
];

for (const path of combinedPaths) writeFileSync(path, combined);

mkdirSync(repoHandoffRoot, { recursive: true });
for (const report of reports) copyFileSync(report.path, join(repoHandoffRoot, basename(report.path)));
copyFileSync(combinedPaths[0], join(repoHandoffRoot, "D1_412_COMBINED_HANDOFF.md"));

for (const name of ["test_summary_412.json", "source_integrity_412.json", "no_touch_412.json", "browser_qa_412.json"]) {
  copyFileSync(join(engineRoot, "evidence/412", name), join(repoHandoffRoot, name));
}
copyFileSync(join(packageRoot, "release/manifest.json"), join(repoHandoffRoot, "release_manifest_412.json"));

const allGeneratedPath = join(engineRoot, "D1_TIMELINE_ENGINE_ALL_GENERATED_MD_HANDOFF.md");
const markerStart = "<!-- D1_411_AND_412_APPEND_BEGIN -->";
const markerEnd = "<!-- D1_411_AND_412_APPEND_END -->";
const existing = readFileSync(allGeneratedPath, "utf8");
const markerIndex = existing.indexOf(markerStart);
const preserved = (markerIndex >= 0 ? existing.slice(0, markerIndex) : existing).trimEnd();
const architectureHandoffPath = join(engineRoot, "D1_411_COMBINED_HANDOFF.md");
const architectureHandoff = readFileSync(architectureHandoffPath, "utf8").trimEnd();
const appendix = [
  preserved,
  "",
  markerStart,
  "",
  "# D1-411 Architecture Handoff Appendix",
  "",
  architectureHandoff,
  "",
  "---",
  "",
  "# D1-412 Implementation Handoff Appendix",
  "",
  combined.trimEnd(),
  "",
  markerEnd,
  "",
].join("\n");
writeFileSync(allGeneratedPath, appendix);

process.stdout.write(`${combinedPaths.join("\n")}\n${join(repoHandoffRoot, "D1_412_COMBINED_HANDOFF.md")}\n${allGeneratedPath}\n`);
