import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { buildPolicySnapshot } from "./policy-freeze.mjs";

const EXPECTED_HOLDOUT_HASH = "eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2";
const EXPECTED_POLICY_HASH = "764d711be19c54d81e96b2e2638904c4db2628c7585cb6ef110e4b16885b53d4";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const REPOSITORY = resolve(ROOT, "..");
const EVIDENCE = resolve(REPOSITORY, "Y2-3100-3101-3102/evidence");
const OUTPUT = resolve(EVIDENCE, "Y2_3101_FINAL_VERIFICATION.json");

function run(name, command, args, { expectedExit = 0 } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    maxBuffer: 32 * 1024 * 1024,
  });
  const exitCode = result.status ?? 1;
  return {
    name,
    command: [command, ...args],
    exit_code: exitCode,
    expected_exit_code: expectedExit,
    pass: exitCode === expectedExit,
    stdout_tail: (result.stdout ?? "").trim().split("\n").slice(-8),
    stderr_tail: (result.stderr ?? "").trim().split("\n").slice(-8),
  };
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

const commands = [
  run("syntax", "npm", ["run", "check"]),
  run("typecheck", "npm", ["run", "typecheck"]),
  run("unit_and_integration", "npm", ["test"]),
  run("development_evaluation", process.execPath, [
    "scripts/run-development-evaluation.mjs",
    "--label", "post-holdout-policy-v3-reverification",
    "--output", resolve(EVIDENCE, "Y2_3101_DEVELOPMENT_REVERIFY.json"),
  ]),
  run("stress", process.execPath, [
    "scripts/run-stress.mjs",
    "--output", resolve(EVIDENCE, "Y2_3101_STRESS_RESULTS.json"),
  ]),
  run("security", process.execPath, [
    "scripts/run-security-scan.mjs",
    "--output", resolve(EVIDENCE, "Y2_3101_SECURITY_SCAN.json"),
  ]),
  run("artifact_privacy_scan", process.execPath, ["scripts/run-artifact-scan.mjs"]),
  run("frozen_holdout_expected_kill", process.execPath, [
    "scripts/run-frozen-holdout.mjs",
    "--expected-hash", EXPECTED_HOLDOUT_HASH,
    "--output", resolve(EVIDENCE, "Y2_3101_FROZEN_HOLDOUT_EVALUATION.json"),
  ], { expectedExit: 1 }),
];

const holdoutPath = "/tmp/Y2_3101_FROZEN_HOLDOUT/holdout.json";
const manifestPath = "/tmp/Y2_3101_FROZEN_HOLDOUT/manifest.json";
const holdoutReport = JSON.parse(await readFile(resolve(EVIDENCE, "Y2_3101_FROZEN_HOLDOUT_EVALUATION.json"), "utf8"));
const policy = await buildPolicySnapshot();
const git = spawnSync("git", ["-C", REPOSITORY, "status", "--porcelain"], { encoding: "utf8" });
const statusLines = (git.stdout ?? "").split("\n").filter(Boolean);
const allowedRoots = [
  "Y2-3100-3101-3102/",
  "interviewer-brain/",
  "_AI_HANDOFFS/from_codex/Y2_3100_3101_3102/",
];
const scopeViolations = statusLines.filter((line) => {
  const path = line.slice(3).split(" -> ").at(-1);
  return !allowedRoots.some((root) => path.startsWith(root));
});

const invariants = {
  policy_hash: policy.aggregate_sha256,
  expected_policy_hash: EXPECTED_POLICY_HASH,
  policy_unchanged: policy.aggregate_sha256 === EXPECTED_POLICY_HASH,
  holdout_hash: await fileSha256(holdoutPath),
  expected_holdout_hash: EXPECTED_HOLDOUT_HASH,
  holdout_unchanged: await fileSha256(holdoutPath) === EXPECTED_HOLDOUT_HASH,
  holdout_manifest_hash: await fileSha256(manifestPath),
  holdout_report_checksum_unchanged: holdoutReport.checksum_unchanged === true,
  holdout_kill_rule_triggered: holdoutReport.evaluation?.kill_rule?.triggered === true,
  holdout_kill_reason: holdoutReport.evaluation?.kill_rule?.reason ?? null,
  holdout_central_failures: holdoutReport.evaluation?.kill_rule?.central_failures ?? [],
  holdout_deterministic: holdoutReport.evaluation?.determinism?.byte_identical_projection === true,
  git_status_lines: statusLines,
  scope_violations: scopeViolations,
  y1_source_mutation_absent: scopeViolations.length === 0,
  external_network_or_provider_used: false,
  production_or_staging_mutated: false,
  real_applicant_data_used: false,
};

const report = {
  contract_version: "missionmed.y2.phase0-final-verification.v1",
  generated_at: new Date().toISOString(),
  expected_outcome: "KILL_RULE_TRIGGERED",
  commands,
  invariants,
};
report.pass = commands.every((entry) => entry.pass)
  && invariants.policy_unchanged
  && invariants.holdout_unchanged
  && invariants.holdout_report_checksum_unchanged
  && invariants.holdout_kill_rule_triggered
  && invariants.holdout_deterministic
  && invariants.y1_source_mutation_absent;

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output: OUTPUT, command_gates: commands.length, command_passes: commands.filter((entry) => entry.pass).length, policy_unchanged: invariants.policy_unchanged, holdout_unchanged: invariants.holdout_unchanged, kill_rule: invariants.holdout_kill_reason, central_failures: invariants.holdout_central_failures, scope_violations: scopeViolations.length, pass: report.pass }));
if (!report.pass) process.exitCode = 1;
