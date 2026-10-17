import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const worktreeRoot = resolve(packageRoot, "../..");
const engineRoot = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const reportRoot = join(engineRoot, "reports");
const evidenceRoot = join(engineRoot, "evidence/413");
const repoHandoffRoot = join(worktreeRoot, "_AI_HANDOFFS/from_codex/D1_TIMELINE_413");

const requiredReports = [
  "D1_413_FINAL_REPORT.md",
  "D1_413_EXECUTION_REPORT.md",
  "D1_413_AGENT_EXECUTION_PLAN.md",
  "D1_413_MATRIX_SOURCE_AUTHORITY_REPORT.md",
  "D1_413_MATRIX_HOST_PATCH_REPORT.md",
  "D1_413_MATRIX_ECOSYSTEM_REGRESSION.md",
  "D1_413_IDENTITY_BFF_REPORT.md",
  "D1_413_POSTGRES_RLS_REPORT.md",
  "D1_413_PRIVATE_STORAGE_REPORT.md",
  "D1_413_HYBRID_SYNC_REPORT.md",
  "D1_413_MAC_PRO_RENDERER_REPORT.md",
  "D1_413_LEGACY_FILEVAULT_STAGING_REPORT.md",
  "D1_413_MEDICAL_ADVISOR_WORKFLOW_REPORT.md",
  "D1_413_UI_UX_ACCESSIBILITY_REPORT.md",
  "D1_413_SECURITY_PRIVACY_REPORT.md",
  "D1_413_PERFORMANCE_FAILURE_REPORT.md",
  "D1_413_RELEASE_ROLLBACK_REPORT.md",
  "D1_413_STAGING_CANDIDATE_MANIFEST.md",
  "D1_413_KNOWN_LIMITATIONS.md",
  "D1_413_NEXT_STEPS.md",
  "D1_413_COMPLETION_AUDIT.md",
];

for (const name of requiredReports) {
  if (!existsSync(join(reportRoot, name))) throw new Error(`Missing mandatory report: ${name}`);
}

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") && !/COMBINED_HANDOFF/.test(entry.name) ? [path] : [];
  });
}

const optionalGeneratedMarkdown = [
  ...markdownFiles(join(packageRoot, "operator")),
  ...markdownFiles(join(packageRoot, "src/export/staging")),
  ...markdownFiles(join(packageRoot, "src/filevault/staging")),
  ...markdownFiles(join(packageRoot, "src/identity/staging")),
  ...markdownFiles(join(packageRoot, "src/storage/staging")),
].sort();

const evidenceMarkdown = markdownFiles(evidenceRoot).sort();
const candidateMarkdown = [
  join(engineRoot, "staging_candidate_413/README.md"),
  join(engineRoot, "staging_candidate_413/rollback/ROLLBACK_STATUS_413.md"),
].filter((path) => existsSync(path));

const inputs = [
  ...requiredReports.map((name) => ({ label: `reports/${name}`, path: join(reportRoot, name) })),
  ...optionalGeneratedMarkdown.map((path) => ({
    label: `packages/mission-timeline/${path.slice(packageRoot.length + 1)}`,
    path,
  })),
  ...evidenceMarkdown.map((path) => ({
    label: `evidence/413/${path.slice(evidenceRoot.length + 1)}`,
    path,
  })),
  ...candidateMarkdown.map((path) => ({
    label: `staging_candidate_413/${path.slice(join(engineRoot, "staging_candidate_413").length + 1)}`,
    path,
  })),
];

const sections = inputs.map((item) => [
  `# Included File: ${item.label}`,
  "",
  `Source: \`${item.path}\``,
  "",
  readFileSync(item.path, "utf8").trimEnd(),
].join("\n"));

const combined = [
  "# D1-413 Complete Combined Handoff",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This file contains the full, unabridged text of every D1-413 individual report and every additional Markdown document generated in the D1-413 staging-adapter paths. Combined handoffs are excluded from recursive inclusion.",
  "",
  `Included files: ${inputs.length}`,
  "",
  "---",
  "",
  sections.join("\n\n---\n\n"),
  "",
].join("\n");

const combinedPaths = [
  join(engineRoot, "D1_413_COMBINED_HANDOFF.md"),
  join(reportRoot, "D1_413_COMBINED_HANDOFF.md"),
  join(repoHandoffRoot, "D1_413_COMBINED_HANDOFF.md"),
];

mkdirSync(repoHandoffRoot, { recursive: true });
for (const path of combinedPaths) writeFileSync(path, combined);
for (const name of requiredReports) copyFileSync(join(reportRoot, name), join(repoHandoffRoot, name));

for (const name of readdirSync(evidenceRoot)) {
  const source = join(evidenceRoot, name);
  if (!existsSync(source) || !name.endsWith(".json") && !name.endsWith(".md")) continue;
  copyFileSync(source, join(repoHandoffRoot, basename(source)));
}

const stagingManifest = join(engineRoot, "staging_candidate_413/manifests/staging-candidate-manifest-413.json");
if (existsSync(stagingManifest)) copyFileSync(stagingManifest, join(repoHandoffRoot, "staging-candidate-manifest-413.json"));

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const hashes = combinedPaths.map((path) => ({ path, sha256: sha256(path) }));
if (new Set(hashes.map((item) => item.sha256)).size !== 1) throw new Error("Combined handoff copies are not hash-identical.");

const allGeneratedPath = join(engineRoot, "D1_TIMELINE_ENGINE_ALL_GENERATED_MD_HANDOFF.md");
const markerStart = "<!-- D1_413_APPEND_BEGIN -->";
const markerEnd = "<!-- D1_413_APPEND_END -->";
const existing = readFileSync(allGeneratedPath, "utf8");
const start = existing.indexOf(markerStart);
const end = existing.indexOf(markerEnd);
const withoutPrior = start >= 0 && end > start
  ? `${existing.slice(0, start).trimEnd()}\n${existing.slice(end + markerEnd.length).trimStart()}`
  : existing;
writeFileSync(
  allGeneratedPath,
  [
    withoutPrior.trimEnd(),
    "",
    markerStart,
    "",
    combined.trimEnd(),
    "",
    markerEnd,
    "",
  ].join("\n"),
);

process.stdout.write(`${combinedPaths.join("\n")}\nsha256 ${hashes[0].sha256}\n${allGeneratedPath}\n`);
