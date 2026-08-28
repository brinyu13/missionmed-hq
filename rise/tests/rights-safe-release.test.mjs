import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadPinnedSourceAuthorizations } from "../src/source-authorization.mjs";

const riseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDirectory = path.join(riseRoot, "releases", "student-rights-safe");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("student rights-safe release contains only the 26 bounded HRSA awardee-specialty records", async () => {
  const indexBytes = await fs.readFile(path.join(releaseDirectory, "api-index.json"));
  const manifestBytes = await fs.readFile(path.join(releaseDirectory, "index-manifest.json"));
  const receipt = JSON.parse(await fs.readFile(path.join(releaseDirectory, "activation-receipt.json"), "utf8"));
  const index = JSON.parse(indexBytes);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(index.releaseProjection, "STUDENT_RIGHTS_SAFE_RISE");
  assert.equal(index.programs.length, 26);
  assert.equal(index.source.legacyFieldsExcluded, 196);
  assert.equal(manifest.apiIndexSha256, sha256(indexBytes));
  assert.equal(receipt.apiIndexSha256, sha256(indexBytes));
  assert.equal(receipt.indexManifestSha256, sha256(manifestBytes));
  for (const program of index.programs) {
    assert.deepEqual(program.fields, {});
    assert.deepEqual(program.identifiers.map((identifier) => identifier.namespace), ["MISSIONMED_RISE_ID"]);
    assert.equal(program.source.authority, "HRSA_THCGME");
    assert.equal(program.researchStatus, "RESEARCH_PENDING");
  }
  const serializedPrograms = JSON.stringify(index.programs);
  for (const prohibited of ["ACGME_PROGRAM", "NRMP", "FREIDA URL", "Program Director", "Visa Sponsorship", "Salary PGY1"]) {
    assert.equal(serializedPrograms.includes(prohibited), false, prohibited);
  }
});

test("HRSA public-domain projection authorization is hash-bound to its rights evidence", async () => {
  const authorizationPath = path.join(releaseDirectory, "hrsa-source-authorization.json");
  const authorizationSha256 = sha256(await fs.readFile(authorizationPath));
  const evidencePath = path.join(riseRoot, "governance", "hrsa-thcgme-public-domain-evidence.v1.json");
  const result = await loadPinnedSourceAuthorizations({
    datasetConfig: {
      requiredSourceAuthorizations: [{ source: "HRSA THCGME", required: true, approvedRecordSha256: authorizationSha256 }],
    },
    pathsBySource: { "HRSA THCGME": authorizationPath },
    grantPathsBySource: { "HRSA THCGME": evidencePath },
    now: Date.parse("2026-08-28T12:00:00.000Z"),
  });
  assert.equal(result["HRSA THCGME"].sourceOwnerGrantBytesVerified, true);
  assert.equal(result["HRSA THCGME"].sha256, authorizationSha256);
});

test("rights review queue covers every blocked canonical field plus four bounded corpus reviews", async () => {
  const rows = (await fs.readFile(path.join(riseRoot, "governance", "RIGHTS_REVIEW_REQUIRED.csv"), "utf8"))
    .trimEnd().split("\n");
  assert.equal(rows.length - 1, 200);
  assert.equal(rows.filter((row) => row.includes("FREIDA-derived canonical workbook")).length, 196);
});
