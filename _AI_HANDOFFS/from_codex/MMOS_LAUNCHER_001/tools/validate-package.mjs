#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, "../../..");
const I1Q_ROOT = resolve(PACKAGE_ROOT, "../I1Q_4000_LEARNING_STUDIO_FLAGSHIP");
const FRAMEWORK_ROOT = resolve(PACKAGE_ROOT, "framework");
const ENTRYPOINT = resolve(FRAMEWORK_ROOT, "missionmed-prototype-launcher.mjs");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "ARTIFACT_MANIFEST.json");
const CHECKSUMS_PATH = resolve(PACKAGE_ROOT, "CHECKSUMS.sha256");
const EXCLUDED_DIRECTORIES = new Set(["node_modules"]);
const EXCLUDED_FILES = new Set([".DS_Store", "ARTIFACT_MANIFEST.json", "CHECKSUMS.sha256"]);

const REQUIRED_FILES = [
  "MISSIONMED_PROTOTYPE_LAUNCH_STANDARD.md",
  "MMOS-LAUNCHER-001_AUTHORITY_AND_BOUNDARY_RECEIPT.md",
  "MMOS-LAUNCHER-001_COMPLETE_COMBINED_HANDOFF.md",
  "MMOS-LAUNCHER-001_VALIDATION_REPORT.md",
  "framework/bootstrap.cmd",
  "framework/bootstrap.sh",
  "framework/README.md",
  "framework/missionmed-prototype-launcher.mjs",
  "framework/package.json",
  "framework/templates/OPEN_IN_CHROME.cmd",
  "framework/templates/OPEN_IN_CHROME.command",
  "framework/templates/OPEN_IN_DEFAULT_BROWSER.cmd",
  "framework/templates/OPEN_IN_DEFAULT_BROWSER.command",
  "framework/templates/LAUNCHER_FRAMEWORK_CHECKSUMS.sha256",
  "framework/templates/README_FIRST.txt",
  "framework/templates/STOP_LOCAL_SERVER.cmd",
  "framework/templates/STOP_LOCAL_SERVER.command",
  "framework/templates/launcher-integrity.cmd",
  "framework/templates/launcher-integrity.sh",
  "framework/templates/prototype.launch.json",
  "framework/templates/static.prototype.launch.json",
  "framework/tests/fixtures/static-site/index.html",
  "framework/tests/launcher.test.mjs",
  "tools/seal-package.mjs",
  "tools/validate-package.mjs",
];

function packagePath(absolutePath) {
  return relative(PACKAGE_ROOT, absolutePath).split(sep).join("/");
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function collect(directory = PACKAGE_ROOT) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (EXCLUDED_DIRECTORIES.has(entry.name) || EXCLUDED_FILES.has(entry.name)) continue;
    const absolutePath = resolve(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Symlink is forbidden: ${packagePath(absolutePath)}`);
    if (entry.isDirectory()) output.push(...await collect(absolutePath));
    else {
      assert.equal(entry.isFile(), true, `Unsupported entry: ${packagePath(absolutePath)}`);
      output.push(absolutePath);
    }
  }
  return output.sort((left, right) => {
    const leftPath = packagePath(left);
    const rightPath = packagePath(right);
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
}

function parseChecksums(text) {
  const output = new Map();
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `Malformed checksum line: ${line}`);
    assert.equal(output.has(match[2]), false, `Duplicate checksum path: ${match[2]}`);
    output.set(match[2], match[1]);
  }
  assert.deepEqual([...output.keys()], [...output.keys()].sort(), "Checksum paths must be sorted");
  return output;
}

async function validateSeal() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  assert.equal(manifest.schema, "missionmed.prototype-launch-standard-manifest");
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.ticket, "MMOS-LAUNCHER-001");
  assert.equal(manifest.status, "PROVISIONAL_LOCAL_STANDARD_CANDIDATE");
  assert.equal(manifest.adoption_status, "NOT_CANONICAL");
  assert.equal(manifest.deployment_status, "NOT_DEPLOYED");
  assert.equal(manifest.base_commit, "a8949fc0811b0be49524dbe6cbb7fdd01abf2a59");
  assert.deepEqual(manifest.exclusions.directories, [...EXCLUDED_DIRECTORIES].sort());
  assert.deepEqual(manifest.exclusions.files, [...EXCLUDED_FILES].sort());

  const files = await collect();
  const current = [];
  for (const absolutePath of files) {
    const buffer = await readFile(absolutePath);
    current.push({ path: packagePath(absolutePath), sha256: digest(buffer), bytes: buffer.length });
  }
  assert.deepEqual(
    manifest.artifacts.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
    current,
    "Manifest projection differs from current package bytes",
  );
  assert.equal(manifest.summary.artifact_count, current.length);
  assert.equal(manifest.summary.total_bytes, current.reduce((sum, item) => sum + item.bytes, 0));
  for (const artifact of manifest.artifacts) {
    assert.ok(artifact.media_type, `Missing media type: ${artifact.path}`);
    assert.ok(artifact.role, `Missing role: ${artifact.path}`);
  }
  const checksums = parseChecksums(await readFile(CHECKSUMS_PATH, "utf8"));
  assert.equal(checksums.size, current.length);
  for (const item of current) assert.equal(checksums.get(item.path), item.sha256, `Checksum mismatch: ${item.path}`);
  return manifest;
}

async function validateFramework() {
  for (const filePath of REQUIRED_FILES) await access(resolve(PACKAGE_ROOT, filePath), fsConstants.R_OK);
  for (const filePath of [
    "framework/bootstrap.sh",
    "framework/missionmed-prototype-launcher.mjs",
    "framework/templates/OPEN_IN_CHROME.command",
    "framework/templates/OPEN_IN_DEFAULT_BROWSER.command",
    "framework/templates/STOP_LOCAL_SERVER.command",
    "framework/templates/launcher-integrity.sh",
    "tools/seal-package.mjs",
    "tools/validate-package.mjs",
  ]) {
    await access(resolve(PACKAGE_ROOT, filePath), fsConstants.X_OK);
  }
  assert.equal(
    await readFile(resolve(FRAMEWORK_ROOT, "templates/README_FIRST.txt"), "utf8"),
    "Double-click OPEN_IN_CHROME.command.\n",
  );
  const integrityTemplate = await readFile(resolve(FRAMEWORK_ROOT, "templates/launcher-integrity.sh"), "utf8");
  assert.ok(integrityTemplate.includes("shasum -a 256 -c CHECKSUMS.sha256"), "Template must verify its package seal");
  assert.ok(integrityTemplate.includes("shasum -a 256 -c LAUNCHER_FRAMEWORK_CHECKSUMS.sha256"), "Template must verify its framework binding");

  const packageJson = JSON.parse(await readFile(resolve(FRAMEWORK_ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.version, "1.0.0");
  assert.equal(packageJson.private, true);
  const launcherSource = await readFile(ENTRYPOINT, "utf8");
  for (const forbidden of ["shell: true", "pkill", "killall", "lsof -t"] ) {
    assert.equal(launcherSource.includes(forbidden), false, `Launcher contains forbidden execution pattern: ${forbidden}`);
  }
  assert.ok(launcherSource.includes("process.kill(-owned.child.pid"), "Owned POSIX process-group stop is missing");
  assert.ok(launcherSource.includes("randomUUID()"), "In-memory stop challenge is missing");
  assert.ok(launcherSource.includes("chmod(paths.controlPath, 0o600)"), "Private control-channel mode is missing");
  assert.ok(launcherSource.includes("chmod(paths.directory, 0o700)"), "Private state-directory mode is missing");
  assert.ok(launcherSource.includes("MMPL-CONFIG-040"), "Wildcard-host config rejection is missing");
  assert.ok(launcherSource.includes("server.allowedExtensions"), "Static asset allowlist is missing");
  assert.ok(launcherSource.includes("frame-ancestors 'none'"), "Static response frame hardening is missing");
  assert.equal(/https?:\/\/(?!localhost|127\.0\.0\.1|\[?::1\]?)/.test(launcherSource), false, "Launcher source contains a non-loopback URL literal");

  const launcherModule = await import(pathToFileURL(ENTRYPOINT).href);
  assert.equal(launcherModule.FRAMEWORK_VERSION, "1.0.0");

  const syntax = spawnSync(process.execPath, ["--check", ENTRYPOINT], { encoding: "utf8", timeout: 30000 });
  assert.equal(syntax.status, 0, `${syntax.stdout}${syntax.stderr}`);
  const tests = spawnSync(process.execPath, ["--test", resolve(FRAMEWORK_ROOT, "tests/launcher.test.mjs")], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, CI: "true" },
  });
  assert.equal(tests.status, 0, `${tests.stdout}${tests.stderr}`);
  assert.match(tests.stdout, /pass 8/);

  const templateLedger = parseChecksums(
    await readFile(resolve(FRAMEWORK_ROOT, "templates/LAUNCHER_FRAMEWORK_CHECKSUMS.sha256"), "utf8"),
  );
  for (const [relativePath, expected] of templateLedger) {
    const absolutePath = resolve(PACKAGE_ROOT, relativePath);
    assert.equal(digest(await readFile(absolutePath)), expected, `Template framework digest mismatch: ${relativePath}`);
  }
  return tests.stdout;
}

async function validateI1qBinding() {
  for (const filePath of [
    "OPEN_IN_CHROME.command",
    "OPEN_IN_DEFAULT_BROWSER.command",
    "README_FIRST.txt",
    "STOP_LOCAL_SERVER.command",
    "prototype.launch.json",
  ]) {
    await access(resolve(I1Q_ROOT, filePath), fsConstants.R_OK);
  }
  assert.equal(
    await readFile(resolve(I1Q_ROOT, "README_FIRST.txt"), "utf8"),
    "Double-click OPEN_IN_CHROME.command.\n",
  );
  const launcherModule = await import(pathToFileURL(ENTRYPOINT).href);
  const config = await launcherModule.loadConfig(resolve(I1Q_ROOT, "prototype.launch.json"));
  assert.equal(config.prototypeId, "i1q-4000-learning-studio");
  assert.equal(config.port, 3000);
  assert.equal(config.openUrl, "http://localhost:3000/");
  assert.equal(config.health.bodyIncludes, "MissionMed Learning Studio · P4 Prototype");
  assert.deepEqual(config.dependencies.installArgs, ["install", "--frozen-lockfile"]);
  const i1qLedger = parseChecksums(await readFile(resolve(I1Q_ROOT, "LAUNCHER_FRAMEWORK_CHECKSUMS.sha256"), "utf8"));
  for (const [relativePath, expected] of i1qLedger) {
    assert.equal(digest(await readFile(resolve(I1Q_ROOT, relativePath))), expected, `I1Q framework digest mismatch: ${relativePath}`);
  }
}

async function main() {
  const manifest = await validateSeal();
  const testOutput = await validateFramework();
  await validateI1qBinding();
  console.log("PASS MMOS-LAUNCHER-001 package validation");
  console.log(`Artifacts: ${manifest.summary.artifact_count}`);
  console.log(testOutput.match(/pass \d+/)?.[0] ?? "framework tests passed");
  console.log("I1Q-4000 binding: PASS at fixed origin http://localhost:3000/");
  console.log("Deployment: none; canonical adoption: not claimed; Windows: unverified");
}

main().catch((error) => {
  console.error(`VALIDATION FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
