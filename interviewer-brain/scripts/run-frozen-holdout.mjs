import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { evaluateFrozenHoldout } from "./holdout-compat.mjs";
import { buildPolicySnapshot, fileSha256 } from "./policy-freeze.mjs";

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const holdoutPath = resolve(option("--package", "/tmp/Y2_3101_FROZEN_HOLDOUT/holdout.json"));
const expectedHash = option("--expected-hash");
if (!expectedHash) throw new Error("--expected-hash is required");
const freezePath = resolve(option("--policy-freeze", "../Y2-3100-3101-3102/evidence/Y2_3101_POLICY_FREEZE.json"));
const output = resolve(option("--output", "../Y2-3100-3101-3102/evidence/Y2_3101_FROZEN_HOLDOUT_EVALUATION.json"));

const freeze = JSON.parse(await readFile(freezePath, "utf8"));
if (freeze.state !== "POLICY_FROZEN_BEFORE_HOLDOUT_OPEN") throw new Error("Policy freeze evidence is invalid");
const current = await buildPolicySnapshot();
if (current.aggregate_sha256 !== freeze.policy_snapshot.aggregate_sha256) throw new Error("Policy bytes changed after freeze");
const beforeHash = await fileSha256(holdoutPath);
if (beforeHash !== expectedHash || beforeHash !== freeze.holdout_package_unopened.sha256) throw new Error("Frozen holdout checksum mismatch before open");

const raw = JSON.parse(await readFile(holdoutPath, "utf8"));
const evaluation = await evaluateFrozenHoldout(raw);
const afterHash = await fileSha256(holdoutPath);
if (afterHash !== beforeHash) throw new Error("Frozen holdout checksum changed during evaluation");
const report = {
  contract_version: "missionmed.y2.frozen-holdout-evaluation.v1",
  synthetic_only: true,
  first_open_after_policy_freeze: true,
  holdout_path: holdoutPath,
  checksum_before: beforeHash,
  checksum_after: afterHash,
  checksum_unchanged: beforeHash === afterHash,
  policy_freeze_path: freezePath,
  policy_aggregate_sha256: current.aggregate_sha256,
  evaluation,
  pass: evaluation.pass && beforeHash === afterHash,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, case_count: evaluation.case_count, atomic_result_count: evaluation.atomic_result_count, atomic_passes: evaluation.atomic_passes, metrics: Object.fromEntries(Object.entries(evaluation.metrics).map(([key, value]) => [key, value.pass])), kill_rule: evaluation.kill_rule, checksum_unchanged: report.checksum_unchanged, pass: report.pass }));
if (!report.pass) process.exitCode = 1;
