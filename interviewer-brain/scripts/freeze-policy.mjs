import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { PolicyEngine } from "../src/index.mjs";
import { buildPolicySnapshot, fileSha256 } from "./policy-freeze.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const output = resolve(option("--output", "../Y2-3100-3101-3102/evidence/Y2_3101_POLICY_FREEZE.json"));
const developmentReport = resolve(option("--development-report", "../Y2-3100-3101-3102/evidence/Y2_3101_DEVELOPMENT_ITERATION_2_FINAL.json"));
const holdoutFreeze = resolve(option("--holdout-freeze", "../Y2-3100-3101-3102/evidence/Y2_3101_HOLDOUT_FREEZE.json"));
const development = JSON.parse(await readFile(developmentReport, "utf8"));
if (development.pass !== true || development.decision !== "CONTINUE") throw new Error("Passing final development evidence is required before policy freeze");
const holdout = JSON.parse(await readFile(holdoutFreeze, "utf8"));
const snapshot = await buildPolicySnapshot();
const report = {
  contract_version: "missionmed.y2.policy-freeze.v1",
  state: "POLICY_FROZEN_BEFORE_HOLDOUT_OPEN",
  frozen_at: new Date().toISOString(),
  policy_ref: new PolicyEngine().reference,
  policy_snapshot: snapshot,
  development_evaluation: { path: developmentReport, sha256: await fileSha256(developmentReport), fixture_count: development.fixture_count, pass: development.pass },
  holdout_package_unopened: {
    path: holdout.holdout_path,
    sha256: holdout.holdout_sha256,
    manifest_path: holdout.manifest_path,
    manifest_sha256: holdout.manifest_sha256,
    case_count: holdout.case_count,
  },
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ output, policy_revision: report.policy_ref.revision, aggregate_sha256: snapshot.aggregate_sha256, file_count: snapshot.files.length, holdout_unopened: true }));
