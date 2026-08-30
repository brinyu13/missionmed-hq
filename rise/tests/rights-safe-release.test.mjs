import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadPinnedSourceAuthorizations, validateAuthorizationRecord } from "../src/source-authorization.mjs";
import { buildRightsSafeRelease } from "../tools/build-rights-safe-release.mjs";
import { seedRightsSafeRuntime } from "../tools/seed-rights-safe-runtime.mjs";

const riseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDirectory = path.join(riseRoot, "releases", "student-rights-safe");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("candidate rights-safe release combines 26 HRSA records with 883 exact SOAP identities and quarantines the unmatched tail", async () => {
  const parent = await fs.mkdtemp("/tmp/rise-5008-release-test-");
  const output = path.join(parent, "candidate");
  await buildRightsSafeRelease({ outputDirectory: output, governanceDirectory: path.join(parent, "governance") });
  const indexBytes = await fs.readFile(path.join(output, "api-index.json"));
  const manifestBytes = await fs.readFile(path.join(output, "index-manifest.json"));
  const receipt = JSON.parse(await fs.readFile(path.join(output, "activation-receipt.json"), "utf8"));
  const index = JSON.parse(indexBytes);
  const manifest = JSON.parse(manifestBytes);
  const soapAuthorizationBytes = await fs.readFile(path.join(output, "soap-source-authorization.json"));
  const soapAuthorization = JSON.parse(soapAuthorizationBytes);
  assert.equal(index.releaseProjection, "STUDENT_RIGHTS_SAFE_RISE");
  assert.equal(index.programs.length, 909);
  assert.equal(index.counts.quarantinedSourceRows, 3);
  assert.equal(index.counts.additionalBrowseMemberships, 39);
  assert.equal(index.source.legacyFieldsExcluded, 196);
  assert.equal(manifest.apiIndexSha256, sha256(indexBytes));
  assert.equal(receipt.apiIndexSha256, sha256(indexBytes));
  assert.equal(receipt.indexManifestSha256, sha256(manifestBytes));
  for (const program of index.programs) {
    assert.equal(program.researchStatus, "RESEARCH_PENDING");
  }
  const soap = index.programs.filter((program) => program.soap2026?.appeared);
  assert.equal(soap.length, 883);
  assert.equal(soap.reduce((sum, program) => sum + program.soap2026.tracks.length, 0), 922);
  assert.ok(soap.every((program) => program.identifiers.some((identifier) => identifier.namespace === "ACGME_PROGRAM")));
  assert.equal(manifest.sourceRights.find((right) => right.source === "SOAP 2026").sha256, sha256(soapAuthorizationBytes));
  assert.equal(
    validateAuthorizationRecord(soapAuthorization, "SOAP 2026", { now: Date.parse("2026-08-30T12:00:00.000Z") }).decisionRecordId,
    "DR-148",
  );
  assert.equal(receipt.approvedBySubject, "pending-independent-release-review");
  await assert.rejects(
    seedRightsSafeRuntime({
      releaseDirectory: output,
      databaseUrl: "postgresql://rise:test-value@localhost:5432/blocked-before-connect",
      sslMode: "disable",
    }),
    /immutable activation set/,
  );
  const serializedPrograms = JSON.stringify(index.programs);
  for (const prohibited of ["FREIDA URL", "Program Director", "Visa Sponsorship", "Salary PGY1", "currently unfilled", "easy match", "guaranteed match"]) {
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
