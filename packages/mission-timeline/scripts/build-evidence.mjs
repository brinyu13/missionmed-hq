import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const worktreeRoot = resolve(packageRoot, "../..");
const engineRoot = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const evidenceRoot = join(engineRoot, "evidence/412");
const authorityRoot = join(engineRoot, "release_candidate_410/application");

mkdirSync(evidenceRoot, { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(name, value) {
  const path = join(evidenceRoot, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function command(commandName, args, cwd = packageRoot) {
  return execFileSync(commandName, args, { cwd, encoding: "utf8" }).trim();
}

function checkedRun(commandName, args) {
  const result = spawnSync(commandName, args, { cwd: packageRoot, encoding: "utf8" });
  return {
    passed: result.status === 0,
    exitCode: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

const historicalFiles = [407, 408, 409, 410].map((layer) => ({
  layer,
  path: join(engineRoot, `evidence/${layer}/test_results_${layer}.json`),
}));

const historical = historicalFiles.map(({ layer, path }) => {
  const data = readJson(path);
  const summary = data.summary || data.resultsSummary || {};
  const total = data.total ?? summary.total ?? data.pass + data.fail;
  const passed = data.passed ?? summary.passed ?? data.pass;
  const failed = data.failed ?? summary.failed ?? data.fail;
  return { layer, path, generatedAt: data.generatedAt || data.generated, total, passed, failed };
});

const typecheck = checkedRun("npm", ["run", "typecheck"]);
const unit = checkedRun("npm", ["test"]);
const unitGroups = [...unit.output.matchAll(/ℹ tests (\d+)/g)].map((match) => Number(match[1]));
const unitPassGroups = [...unit.output.matchAll(/ℹ pass (\d+)/g)].map((match) => Number(match[1]));
const unitFailGroups = [...unit.output.matchAll(/ℹ fail (\d+)/g)].map((match) => Number(match[1]));
const benchmark = unit.output.match(/100 create operations: ([\d.]+) ms/);

const verify = JSON.parse(command("node", ["scripts/verify-package.mjs"]));
const browser = readJson(join(evidenceRoot, "browser_qa_412.json"));
const release = readJson(join(packageRoot, "release/manifest.json"));

const tests = {
  generatedAt: new Date().toISOString(),
  typecheck: { passed: typecheck.passed, exitCode: typecheck.exitCode },
  unit: {
    passed: unit.passed,
    total: unitGroups.reduce((sum, value) => sum + value, 0),
    passedCount: unitPassGroups.reduce((sum, value) => sum + value, 0),
    failedCount: unitFailGroups.reduce((sum, value) => sum + value, 0),
  },
  historical,
  historicalAggregate: {
    total: historical.reduce((sum, item) => sum + item.total, 0),
    passed: historical.reduce((sum, item) => sum + item.passed, 0),
    failed: historical.reduce((sum, item) => sum + item.failed, 0),
  },
  matrixBrowserQa: browser.summary,
  packageVerification: { total: verify.passed + verify.failed, passed: verify.passed, failed: verify.failed },
  aggregateAutomatedAssertions: unitGroups.reduce((sum, value) => sum + value, 0)
    + historical.reduce((sum, item) => sum + item.total, 0)
    + browser.summary.total
    + verify.passed
    + 1,
  performance: {
    serviceCreate100Ms: benchmark ? Number(benchmark[1]) : null,
    matrixStartupMs: browser.performance,
  },
};

const authorityIndex = join(authorityRoot, "index.html");
const packageIndex = join(packageRoot, "web/index.html");
const diffResult = spawnSync("diff", ["-qr", authorityRoot, join(packageRoot, "web")], { encoding: "utf8" });
const sourceIntegrity = {
  generatedAt: new Date().toISOString(),
  authority: {
    path: authorityRoot,
    indexPath: authorityIndex,
    indexSha256: sha256(authorityIndex),
  },
  packageWeb: {
    path: join(packageRoot, "web"),
    indexPath: packageIndex,
    indexSha256: sha256(packageIndex),
  },
  exactIndexMatch: sha256(authorityIndex) === sha256(packageIndex),
  documentedWebDifferences: diffResult.stdout.trim().split("\n").filter(Boolean),
  releaseManifest: {
    path: join(packageRoot, "release/manifest.json"),
    schemaVersion: release.schemaVersion,
    classification: release.classification,
    fileCount: release.files.length,
  },
};

const status = command("git", ["status", "--short"], worktreeRoot).split("\n").filter(Boolean);
const trackedDiff = command("git", ["diff", "--name-only"], worktreeRoot).split("\n").filter(Boolean);
const stagedDiff = command("git", ["diff", "--cached", "--name-only"], worktreeRoot).split("\n").filter(Boolean);
const noTouch = {
  generatedAt: new Date().toISOString(),
  worktreeRoot,
  branch: command("git", ["branch", "--show-current"], worktreeRoot),
  status,
  trackedFilesModified: trackedDiff,
  stagedFiles: stagedDiff,
  productionTrackedFilesModified: trackedDiff.filter((path) => /^(missionmed-hq|LIVE|server\.mjs|routes|_SYSTEM_LOGS|Supabase|R2|DROP_ZONE|VIDEO_SYSTEM)/.test(path)),
  passed: trackedDiff.length === 0 && stagedDiff.length === 0,
};

const outputs = [
  writeJson("test_summary_412.json", tests),
  writeJson("source_integrity_412.json", sourceIntegrity),
  writeJson("no_touch_412.json", noTouch),
];

if (!typecheck.passed || !unit.passed || verify.failed || tests.historicalAggregate.failed || browser.summary.failed || !sourceIntegrity.exactIndexMatch || !noTouch.passed) {
  process.stderr.write("Evidence gate failed. Inspect generated JSON.\n");
  process.exitCode = 1;
}

process.stdout.write(`${outputs.join("\n")}\n`);
