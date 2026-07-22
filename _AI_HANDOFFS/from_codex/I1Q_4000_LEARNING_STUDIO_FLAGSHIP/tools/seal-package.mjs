#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

function toPackagePath(absolutePath) {
  return relative(PACKAGE_ROOT, absolutePath).split(sep).join("/");
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
    const packagePath = toPackagePath(absolutePath);

    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to seal symlink: ${packagePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...(await collectIncludedFiles(absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Refusing unsupported filesystem entry: ${packagePath}`);
    }
    files.push(absolutePath);
  }

  return files.sort((left, right) => {
    const leftPath = toPackagePath(left);
    const rightPath = toPackagePath(right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
}

function mediaTypeFor(packagePath) {
  const extension = extname(packagePath).toLowerCase();
  const mediaTypes = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jsx": "text/javascript",
    ".md": "text/markdown",
    ".mjs": "text/javascript",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
  };
  return mediaTypes[extension] ?? "application/octet-stream";
}

function roleFor(packagePath) {
  if (/^SCREENSHOT_BOOK\/\d{2}_.+\.png$/.test(packagePath)) {
    return "founder-review-screenshot";
  }
  if (packagePath === "SCREENSHOT_BOOK/README.md") {
    return "screenshot-index";
  }
  if (packagePath === "prototype/public/og.png") {
    return "generated-visual-asset";
  }
  if (packagePath.startsWith("prototype/public/")) {
    return "prototype-static-asset";
  }
  if (packagePath.startsWith("prototype/tests/")) {
    return "prototype-test";
  }
  if (packagePath.startsWith("prototype/app/")) {
    return "prototype-application-source";
  }
  if (
    packagePath.startsWith("prototype/build/") ||
    packagePath.startsWith("prototype/db/") ||
    packagePath.startsWith("prototype/worker/")
  ) {
    return "prototype-support-source";
  }
  if (packagePath.startsWith("prototype/")) {
    return "prototype-configuration";
  }
  if (packagePath.startsWith("tools/")) {
    return "package-integrity-tool";
  }
  if (packagePath.endsWith(".md")) {
    return "evidence-document";
  }
  return "package-artifact";
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function requiredMatch(text, expression, label) {
  const match = text.match(expression);
  if (!match) {
    throw new Error(`Authority receipt does not expose ${label}`);
  }
  return match[1];
}

function sourceLineageFromReceipt(receiptText) {
  const rows = [...receiptText.matchAll(/\|\s*`([^`]+)`\s*\|\s*`([a-f0-9]{64})`\s*\|/g)].map(
    ([, path, hash]) => ({ path, sha256: hash }),
  );

  const rowEndingWith = (suffix, label) => {
    const row = rows.find(({ path }) => path.endsWith(suffix));
    if (!row) throw new Error(`Authority receipt does not expose ${label}`);
    return row;
  };

  const prompt = rowEndingWith(
    "/I1Q-4000_Codex_MegaRun_Flagship_Prototype_Prompt.md",
    "the task prompt hash",
  );
  const passport = rowEndingWith(
    "/PRODUCT_PASSPORTS/question-platform.md",
    "the Question Platform passport hash",
  );
  const decision = rowEndingWith(
    "/decisions/DR-006_i1q_question_platform_internal_integration.md",
    "the DR-006 hash",
  );

  return [
    { id: "task_prompt", scope: "external", ...prompt },
    { id: "question_platform_passport", scope: "external", ...passport },
    { id: "dr_006", scope: "external", ...decision },
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

async function main() {
  const receiptPath = resolve(
    PACKAGE_ROOT,
    "I1Q-4000_AUTHORITY_AND_BOUNDARY_RECEIPT.md",
  );
  const receiptText = await readFile(receiptPath, "utf8");
  const sourceLineage = sourceLineageFromReceipt(receiptText);
  const includedFiles = await collectIncludedFiles();
  const artifacts = [];

  for (const absolutePath of includedFiles) {
    const buffer = await readFile(absolutePath);
    const fileStat = await stat(absolutePath);
    const packagePath = toPackagePath(absolutePath);
    artifacts.push({
      path: packagePath,
      sha256: sha256(buffer),
      bytes: fileStat.size,
      media_type: mediaTypeFor(packagePath),
      role: roleFor(packagePath),
    });
  }

  const manifest = {
    schema: "missionmed.artifact-manifest",
    schema_version: 1,
    ticket: "I1Q-4000",
    status: "LOCAL_P4_INTERACTION_CANDIDATE",
    generated_at: new Date().toISOString(),
    root: ".",
    algorithm: "SHA-256",
    exclusions: {
      directories: [...EXCLUDED_DIRECTORIES].sort(),
      files: [...EXCLUDED_FILES].sort(),
      note: "Excluded build/dependency state and the two self-referential seal outputs are not package artifacts.",
    },
    source_lineage: sourceLineage,
    summary: {
      artifact_count: artifacts.length,
      total_bytes: artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0),
    },
    artifacts,
  };

  const checksumLedger = artifacts
    .map((artifact) => `${artifact.sha256}  ${artifact.path}`)
    .join("\n");

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(CHECKSUMS_PATH, `${checksumLedger}\n`, "utf8");

  console.log(
    `SEALED I1Q-4000: ${artifacts.length} artifacts, ${manifest.summary.total_bytes} bytes`,
  );
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Checksums: ${CHECKSUMS_PATH}`);
}

main().catch((error) => {
  console.error(`SEAL FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
