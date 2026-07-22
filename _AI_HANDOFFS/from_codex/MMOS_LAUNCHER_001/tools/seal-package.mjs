#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "ARTIFACT_MANIFEST.json");
const CHECKSUMS_PATH = resolve(PACKAGE_ROOT, "CHECKSUMS.sha256");
const EXCLUDED_DIRECTORIES = new Set(["node_modules"]);
const EXCLUDED_FILES = new Set([".DS_Store", "ARTIFACT_MANIFEST.json", "CHECKSUMS.sha256"]);

function packagePath(absolutePath) {
  return relative(PACKAGE_ROOT, absolutePath).split(sep).join("/");
}

async function collect(directory = PACKAGE_ROOT) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name) || EXCLUDED_FILES.has(entry.name)) continue;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing to seal symlink: ${packagePath(absolutePath)}`);
    if (entry.isDirectory()) output.push(...await collect(absolutePath));
    else if (entry.isFile()) output.push(absolutePath);
    else throw new Error(`Unsupported entry: ${packagePath(absolutePath)}`);
  }
  return output.sort((left, right) => {
    const leftPath = packagePath(left);
    const rightPath = packagePath(right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function mediaType(filePath) {
  const types = {
    ".cmd": "text/plain",
    ".command": "text/x-shellscript",
    ".html": "text/html",
    ".json": "application/json",
    ".md": "text/markdown",
    ".mjs": "text/javascript",
    ".sh": "text/x-shellscript",
    ".sha256": "text/plain",
    ".txt": "text/plain",
  };
  return types[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function role(filePath) {
  if (filePath === "MISSIONMED_PROTOTYPE_LAUNCH_STANDARD.md") return "standard-candidate";
  if (filePath.includes("AUTHORITY_AND_BOUNDARY")) return "authority-receipt";
  if (filePath.includes("VALIDATION_REPORT")) return "validation-report";
  if (filePath.includes("COMPLETE_COMBINED_HANDOFF")) return "combined-handoff";
  if (filePath.startsWith("framework/templates/")) return "launcher-template";
  if (filePath.startsWith("framework/tests/")) return "launcher-test";
  if (filePath === "framework/missionmed-prototype-launcher.mjs") return "launcher-engine";
  if (filePath.startsWith("framework/")) return "launcher-framework-support";
  if (filePath.startsWith("tools/")) return "package-integrity-tool";
  return "package-artifact";
}

async function main() {
  const files = await collect();
  const artifacts = [];
  for (const absolutePath of files) {
    const buffer = await readFile(absolutePath);
    const fileStats = await stat(absolutePath);
    const filePath = packagePath(absolutePath);
    artifacts.push({
      path: filePath,
      sha256: digest(buffer),
      bytes: fileStats.size,
      media_type: mediaType(filePath),
      role: role(filePath),
    });
  }
  const manifest = {
    schema: "missionmed.prototype-launch-standard-manifest",
    schema_version: 1,
    ticket: "MMOS-LAUNCHER-001",
    status: "PROVISIONAL_LOCAL_STANDARD_CANDIDATE",
    adoption_status: "NOT_CANONICAL",
    deployment_status: "NOT_DEPLOYED",
    generated_at: new Date().toISOString(),
    root: ".",
    algorithm: "SHA-256",
    base_commit: "a8949fc0811b0be49524dbe6cbb7fdd01abf2a59",
    exclusions: {
      directories: [...EXCLUDED_DIRECTORIES].sort(),
      files: [...EXCLUDED_FILES].sort(),
      note: "Dependency state and self-referential seal outputs are excluded.",
    },
    summary: {
      artifact_count: artifacts.length,
      total_bytes: artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0),
    },
    artifacts,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(
    CHECKSUMS_PATH,
    `${artifacts.map((artifact) => `${artifact.sha256}  ${artifact.path}`).join("\n")}\n`,
    "utf8",
  );
  console.log(`SEALED MMOS-LAUNCHER-001: ${artifacts.length} artifacts, ${manifest.summary.total_bytes} bytes`);
}

main().catch((error) => {
  console.error(`SEAL FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
