#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "../../..");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "ARTIFACT_MANIFEST.json");
const CHECKSUMS_PATH = resolve(PACKAGE_ROOT, "CHECKSUMS.sha256");

const EXCLUDED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".wrangler",
  ".next",
  ".vinext",
]);
const EXCLUDED_FILES = new Set([
  ".DS_Store",
  "ARTIFACT_MANIFEST.json",
  "CHECKSUMS.sha256",
]);

const REQUIRED_FILES = [
  "I1Q-4000_ASSET_PROVENANCE.md",
  "I1Q-4000_AUTHORITY_AND_BOUNDARY_RECEIPT.md",
  "I1Q-4000_COMPLETE_COMBINED_HANDOFF.md",
  "I1Q-4000_EDUCATIONAL_RATIONALE.md",
  "I1Q-4000_EXECUTION_REPORT.md",
  "I1Q-4000_FOUNDER_DECISION_LOG.md",
  "I1Q-4000_UX_RATIONALE.md",
  "I1Q-4000_VALIDATION_REPORT.md",
  "SCREENSHOT_BOOK/README.md",
  "prototype/.openai/hosting.json",
  "prototype/README.md",
  "prototype/app/LearningStudio.tsx",
  "prototype/app/globals.css",
  "prototype/app/layout.tsx",
  "prototype/app/page.tsx",
  "prototype/app/studio-data.ts",
  "prototype/app/studio-state.ts",
  "prototype/package.json",
  "prototype/pnpm-lock.yaml",
  "prototype/public/favicon.svg",
  "prototype/public/og.png",
  "prototype/tests/learning-studio.test.mjs",
  "prototype/tsconfig.json",
  "tools/seal-package.mjs",
  "tools/validate-package.mjs",
];

const SCREENSHOT_FILES = [
  "01_home_desktop.png",
  "02_builder_templates_desktop.png",
  "03_builder_scope_desktop.png",
  "04_quick_review_desktop.png",
  "05_clinical_mastery_desktop.png",
  "06_layered_feedback_desktop.png",
  "07_replay_placeholder_desktop.png",
  "08_zoom_notes_placeholder_desktop.png",
  "09_mobile_home.png",
  "10_mobile_quick_review.png",
  "11_analytics_prediction_desktop.png",
  "12_mastery_proxy_desktop.png",
  "13_founder_decision_log_desktop.png",
  "14_empty_saved_recovery_desktop.png",
  "15_high_zoom_equivalent_720.png",
  "16_board_review_desktop.png",
  "17_adaptive_why_selected_desktop.png",
  "18_completed_debrief_desktop.png",
  "19_saved_resume_desktop.png",
  "20_favorites_desktop.png",
  "21_rounds_branch_desktop.png",
];

const EXPECTED_TEMPLATES = [
  ["quick-review", "Quick Review"],
  ["board-review", "Board Review"],
  ["clinical-mastery", "Clinical Mastery"],
  ["adaptive", "Adaptive"],
];

const EXPECTED_ANALYTICS_TABS = [
  ["current", "Current session"],
  ["lifetime", "Lifetime"],
  ["mastery", "Mastery proxy"],
  ["heatmap", "Heatmaps"],
  ["trends", "Trends"],
  ["replay", "Replay usage"],
  ["explanations", "Explanation usage"],
  ["confidence", "Confidence history"],
];

function packagePath(absolutePath) {
  return relative(PACKAGE_ROOT, absolutePath).split(sep).join("/");
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function collectIncludedFiles(directory = PACKAGE_ROOT) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name) || EXCLUDED_FILES.has(entry.name)) {
      continue;
    }
    const absolutePath = resolve(directory, entry.name);
    const path = packagePath(absolutePath);
    assert.equal(entry.isSymbolicLink(), false, `Symlink is forbidden: ${path}`);
    if (entry.isDirectory()) {
      files.push(...(await collectIncludedFiles(absolutePath)));
    } else {
      assert.equal(entry.isFile(), true, `Unsupported filesystem entry: ${path}`);
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => {
    const leftPath = packagePath(left);
    const rightPath = packagePath(right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
}

async function isReadable(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function requireFiles() {
  for (const path of REQUIRED_FILES) {
    assert.equal(
      await isReadable(resolve(PACKAGE_ROOT, path)),
      true,
      `Required artifact is absent or unreadable: ${path}`,
    );
  }
  assert.equal(await isReadable(MANIFEST_PATH), true, "ARTIFACT_MANIFEST.json is absent");
  assert.equal(await isReadable(CHECKSUMS_PATH), true, "CHECKSUMS.sha256 is absent");
}

function pngDimensions(buffer, path) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.length >= 24, `${path} is too short to be a PNG`);
  assert.equal(buffer.subarray(0, 8).equals(signature), true, `${path} lacks the PNG signature`);
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR", `${path} lacks an IHDR header`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.ok(width > 0 && height > 0, `${path} has invalid dimensions ${width}x${height}`);
  return { width, height };
}

async function validateScreenshots() {
  const directory = resolve(PACKAGE_ROOT, "SCREENSHOT_BOOK");
  const entries = await readdir(directory, { withFileTypes: true });
  const actualPngFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(actualPngFiles, SCREENSHOT_FILES, "Screenshot inventory must be the exact named 21-file set");

  const dimensions = new Map();
  const screenshotDigests = new Set();
  for (const name of SCREENSHOT_FILES) {
    const buffer = await readFile(resolve(directory, name));
    dimensions.set(name, pngDimensions(buffer, name));
    screenshotDigests.add(digest(buffer));
  }
  assert.equal(
    screenshotDigests.size,
    SCREENSHOT_FILES.length,
    "Every documented screenshot scenario must have distinct captured bytes",
  );
  assert.equal(dimensions.get("09_mobile_home.png").width, 390, "Mobile home must be 390 CSS pixels wide");
  assert.equal(dimensions.get("10_mobile_quick_review.png").width, 390, "Mobile Quick Review must be 390 CSS pixels wide");
  assert.equal(
    dimensions.get("15_high_zoom_equivalent_720.png").width,
    720,
    "High-zoom reflow proxy must be 720 CSS pixels wide",
  );
}

function parseChecksums(text) {
  const entries = new Map();
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `Malformed checksum line: ${line}`);
    const [, sha256, path] = match;
    assert.equal(entries.has(path), false, `Duplicate checksum path: ${path}`);
    entries.set(path, sha256);
  }
  assert.deepEqual([...entries.keys()], [...entries.keys()].sort(), "Checksum paths must be sorted");
  return entries;
}

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  assert.ok(match, `Authority receipt does not expose ${label}`);
  return match[1];
}

function sourceLineageFromReceipt(receiptText) {
  const rows = [...receiptText.matchAll(/\|\s*`([^`]+)`\s*\|\s*`([a-f0-9]{64})`\s*\|/g)].map(
    ([, path, sha256]) => ({ path, sha256 }),
  );
  const rowEndingWith = (suffix, label) => {
    const row = rows.find(({ path }) => path.endsWith(suffix));
    assert.ok(row, `Authority receipt does not expose ${label}`);
    return row;
  };

  return [
    {
      id: "task_prompt",
      scope: "external",
      ...rowEndingWith(
        "/I1Q-4000_Codex_MegaRun_Flagship_Prototype_Prompt.md",
        "the task prompt hash",
      ),
    },
    {
      id: "question_platform_passport",
      scope: "external",
      ...rowEndingWith(
        "/PRODUCT_PASSPORTS/question-platform.md",
        "the Question Platform passport hash",
      ),
    },
    {
      id: "dr_006",
      scope: "external",
      ...rowEndingWith(
        "/decisions/DR-006_i1q_question_platform_internal_integration.md",
        "the DR-006 hash",
      ),
    },
    {
      id: "i1q_3000_combined_handoff",
      scope: "predecessor",
      path: "_AI_HANDOFFS/from_codex/I1Q_3000_PROTOTYPE_ARCHAEOLOGY/I1Q-3000_COMPLETE_COMBINED_HANDOFF.md",
      sha256: requiredMatch(
        receiptText,
        /combined handoff SHA-256:\s*`([a-f0-9]{64})`/,
        "the I1Q-3000 combined handoff hash",
      ),
    },
    {
      id: "i1q_3000_checksum_ledger",
      scope: "predecessor",
      path: "_AI_HANDOFFS/from_codex/I1Q_3000_PROTOTYPE_ARCHAEOLOGY/CHECKSUMS.sha256",
      sha256: requiredMatch(
        receiptText,
        /predecessor checksum ledger SHA-256:\s*`([a-f0-9]{64})`/,
        "the I1Q-3000 checksum-ledger hash",
      ),
    },
    {
      id: "predecessor_git_commit",
      scope: "git",
      repository: ".",
      commit: requiredMatch(
        receiptText,
        /predecessor Git commit:\s*`([a-f0-9]{40})`/,
        "the predecessor Git commit",
      ),
    },
  ];
}

async function validateSeal() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  assert.equal(manifest.schema, "missionmed.artifact-manifest", "Unexpected manifest schema");
  assert.equal(manifest.schema_version, 1, "Unexpected manifest schema version");
  assert.equal(manifest.ticket, "I1Q-4000", "Unexpected manifest ticket");
  assert.equal(manifest.status, "LOCAL_P4_INTERACTION_CANDIDATE", "Unexpected package status");
  assert.equal(manifest.algorithm, "SHA-256", "Unexpected manifest digest algorithm");
  assert.deepEqual(manifest.exclusions.directories, [...EXCLUDED_DIRECTORIES].sort(), "Manifest directory exclusions drifted");
  assert.deepEqual(manifest.exclusions.files, [...EXCLUDED_FILES].sort(), "Manifest file exclusions drifted");

  const authorityText = await readFile(
    resolve(PACKAGE_ROOT, "I1Q-4000_AUTHORITY_AND_BOUNDARY_RECEIPT.md"),
    "utf8",
  );
  const expectedLineage = sourceLineageFromReceipt(authorityText);
  assert.deepEqual(manifest.source_lineage, expectedLineage, "Manifest source lineage differs from the authority receipt");

  const currentFiles = await collectIncludedFiles();
  const currentArtifacts = [];
  for (const absolutePath of currentFiles) {
    const buffer = await readFile(absolutePath);
    currentArtifacts.push({ path: packagePath(absolutePath), sha256: digest(buffer), bytes: buffer.length });
  }

  assert.ok(Array.isArray(manifest.artifacts), "Manifest artifacts must be an array");
  const manifestPaths = manifest.artifacts.map((artifact) => artifact.path);
  assert.deepEqual(manifestPaths, [...manifestPaths].sort(), "Manifest artifact paths must be sorted");
  assert.equal(new Set(manifestPaths).size, manifestPaths.length, "Manifest contains duplicate artifact paths");
  assert.deepEqual(
    manifest.artifacts.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
    currentArtifacts,
    "Manifest file/hash/byte projection does not match current package bytes",
  );
  for (const artifact of manifest.artifacts) {
    assert.equal(typeof artifact.media_type, "string", `Missing media_type for ${artifact.path}`);
    assert.ok(artifact.media_type.length > 0, `Empty media_type for ${artifact.path}`);
    assert.equal(typeof artifact.role, "string", `Missing role for ${artifact.path}`);
    assert.ok(artifact.role.length > 0, `Empty role for ${artifact.path}`);
  }
  assert.equal(manifest.summary.artifact_count, currentArtifacts.length, "Manifest artifact count is stale");
  assert.equal(
    manifest.summary.total_bytes,
    currentArtifacts.reduce((sum, artifact) => sum + artifact.bytes, 0),
    "Manifest total byte count is stale",
  );

  const checksums = parseChecksums(await readFile(CHECKSUMS_PATH, "utf8"));
  assert.equal(checksums.size, currentArtifacts.length, "Checksum count differs from current artifact count");
  for (const artifact of currentArtifacts) {
    assert.equal(checksums.get(artifact.path), artifact.sha256, `Checksum mismatch: ${artifact.path}`);
  }

  return { manifest, sourceLineage: expectedLineage };
}

async function validatePrototypeMarkers() {
  const hosting = JSON.parse(
    await readFile(resolve(PACKAGE_ROOT, "prototype/.openai/hosting.json"), "utf8"),
  );
  assert.equal(hosting.d1, null, "Hosting scaffold d1 must remain null");
  assert.equal(hosting.r2, null, "Hosting scaffold r2 must remain null");

  const dataSource = await readFile(resolve(PACKAGE_ROOT, "prototype/app/studio-data.ts"), "utf8");
  const templateStart = dataSource.indexOf("export const TEMPLATES");
  const templateEnd = dataSource.indexOf("export const SUBJECTS", templateStart);
  assert.ok(templateStart >= 0 && templateEnd > templateStart, "Template definition block is missing");
  const templateBlock = dataSource.slice(templateStart, templateEnd);
  const actualTemplates = [...templateBlock.matchAll(/id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"/g)].map(
    ([, id, name]) => [id, name],
  );
  assert.deepEqual(actualTemplates, EXPECTED_TEMPLATES, "The four template markers drifted");

  const uiSource = await readFile(resolve(PACKAGE_ROOT, "prototype/app/LearningStudio.tsx"), "utf8");
  const tabsStart = uiSource.indexOf("const tabs: [AnalyticsTab, string][] = [");
  const tabsEnd = uiSource.indexOf("];", tabsStart);
  assert.ok(tabsStart >= 0 && tabsEnd > tabsStart, "Analytics tab definition block is missing");
  const actualTabs = [...uiSource.slice(tabsStart, tabsEnd).matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map(
    ([, id, label]) => [id, label],
  );
  assert.deepEqual(actualTabs, EXPECTED_ANALYTICS_TABS, "The eight analytics-tab markers drifted");

  for (const marker of [
    "LOCAL_P4_INTERACTION_CANDIDATE",
    "local synthetic only",
    "not deployed",
    "No external requests",
    "No protected source",
  ]) {
    assert.ok(uiSource.includes(marker), `Client boundary marker is missing: ${marker}`);
  }

  const boundaryReceipt = await readFile(
    resolve(PACKAGE_ROOT, "I1Q-4000_AUTHORITY_AND_BOUNDARY_RECEIPT.md"),
    "utf8",
  );
  for (const nonClaim of [
    "NOT DEPLOYED",
    "NOT PRODUCTION-INTEGRATED",
    "NOT MEDICALLY VALIDATED",
    "NOT PSYCHOMETRICALLY VALIDATED",
    "NOT ACCESSIBILITY-CERTIFIED",
    "NOT CANONICAL PRODUCT ADOPTION",
  ]) {
    assert.ok(boundaryReceipt.includes(nonClaim), `Authority non-claim is missing: ${nonClaim}`);
  }

  const appEntries = await readdir(resolve(PACKAGE_ROOT, "prototype/app"), { withFileTypes: true });
  const clientSourceFiles = appEntries.filter(
    (entry) => entry.isFile() && /\.(?:ts|tsx|js|jsx)$/.test(entry.name),
  );
  const requestPrimitives = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\s*\(/,
    /\bEventSource\s*\(/,
    /\bnavigator\.sendBeacon\s*\(/,
    /\baxios\b/,
  ];
  for (const entry of clientSourceFiles) {
    const source = await readFile(resolve(PACKAGE_ROOT, "prototype/app", entry.name), "utf8");
    for (const primitive of requestPrimitives) {
      assert.equal(primitive.test(source), false, `External request primitive ${primitive} found in prototype/app/${entry.name}`);
    }
  }
}

async function validateAvailableLineageFiles(sourceLineage) {
  const checked = [];
  const skipped = [];
  for (const source of sourceLineage.filter((entry) => entry.sha256 && entry.path)) {
    const absolutePath = isAbsolute(source.path)
      ? source.path
      : resolve(REPOSITORY_ROOT, source.path);
    if (!(await isReadable(absolutePath))) {
      skipped.push(source.id);
      continue;
    }
    const actual = digest(await readFile(absolutePath));
    assert.equal(actual, source.sha256, `Source lineage hash mismatch: ${source.id}`);
    checked.push(source.id);
  }
  return { checked, skipped };
}

async function main() {
  await requireFiles();
  await validateScreenshots();
  const { manifest, sourceLineage } = await validateSeal();
  await validatePrototypeMarkers();
  const lineage = await validateAvailableLineageFiles(sourceLineage);

  console.log(`PASS I1Q-4000 package validation`);
  console.log(`Artifacts: ${manifest.summary.artifact_count}`);
  console.log(`Screenshots: ${SCREENSHOT_FILES.length} distinct true PNG files`);
  console.log(`Source hashes verified: ${lineage.checked.join(", ") || "none available"}`);
  if (lineage.skipped.length > 0) {
    console.log(`Source hashes skipped because paths were unavailable: ${lineage.skipped.join(", ")}`);
  }
  console.log("Hosting: d1=null, r2=null; no deployment assertion made");
}

main().catch((error) => {
  console.error(`VALIDATION FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
