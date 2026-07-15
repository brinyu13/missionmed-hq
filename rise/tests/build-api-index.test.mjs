import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildIndex } from "../tools/build-api-index.mjs";

async function writeNdjson(directory, name, records) {
  await fs.writeFile(path.join(directory, name), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
}

function releaseFixture(sourceRightsApproved) {
  return {
    releaseId: "rise_registry_fixture",
    immutable: true,
    activationStatus: "offline_shadow_only",
    releaseGate: {
      sourceRightsApproved,
      sourceRights: sourceRightsApproved ? [{
        source: "FREIDA",
        status: "approved",
        sha256: "b".repeat(64),
        sourceOwnerGrantSha256: "d".repeat(64),
        sourceOwnerGrantBytesVerified: true,
        authorizationId: "fixture-authorization",
        decisionRecordId: "fixture-decision",
        validThrough: "2099-12-31",
      }] : [],
    },
    sourcePolicy: { freida: "written_authorization_required" },
    source: {
      snapshotId: "rise_snapshot_fixture",
      canonicalContentSha256: "a".repeat(64),
      datasetVersion: "fixture-v1",
      retrievalDate: "2026-07-09",
    },
    counts: { uniquePrograms: 1, programSpecialties: 1, matchableClaims: 0 },
    outputHashes: {},
    files: {
      programs: "programs.ndjson",
      programSpecialties: "program-specialties.ndjson",
      browseMemberships: "browse-memberships.ndjson",
      sourceDocuments: "source-documents.ndjson",
      externalIdentifiers: "external-identifiers.ndjson",
      claims: "claims.ndjson",
      fields: "fields.json",
    },
  };
}

async function populateOutputHashes(directory, release) {
  for (const file of Object.values(release.files)) {
    const bytes = await fs.readFile(path.join(directory, file));
    release.outputHashes[file] = createHash("sha256").update(bytes).digest("hex");
  }
  const bytes = Buffer.from(JSON.stringify(release));
  await fs.writeFile(path.join(directory, "release.json"), bytes);
  return createHash("sha256").update(bytes).digest("hex");
}

test("API index creation is blocked before reading unauthorized source material", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-policy-"));
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-output-"));
  await fs.writeFile(path.join(directory, "release.json"), JSON.stringify(releaseFixture(false)));
  try {
    await assert.rejects(buildIndex(directory, output), (error) => {
      assert.equal(error.code, "RISE_SOURCE_POLICY_BLOCKED");
      return true;
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
    await fs.rm(output, { recursive: true, force: true });
  }
});

test("field coverage excludes quarantined known claims", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-coverage-"));
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-output-"));
  const release = releaseFixture(true);
  await writeNdjson(directory, release.files.programs, [{
    id: "rise_prg_fixture",
    sourceDocumentId: "rise_src_fixture",
    display: { programName: "Synthetic Atlas Program", city: "Testville", state: "NY" },
  }]);
  await writeNdjson(directory, release.files.programSpecialties, [{
    id: "rise_ps_fixture",
    programId: "rise_prg_fixture",
    designation: "Internal Medicine",
    kind: "single",
    entryFormat: "categorical",
    components: ["Internal Medicine"],
  }]);
  await writeNdjson(directory, release.files.browseMemberships, [{
    programSpecialtyId: "rise_ps_fixture",
    browseSpecialty: "Internal Medicine",
    relationship: "EXACT_DESIGNATION",
  }]);
  await writeNdjson(directory, release.files.sourceDocuments, [{
    id: "rise_src_fixture",
    authority: "SYNTHETIC_TEST",
    assertionClass: "synthetic_fixture",
    urls: [],
    retrievedAt: "2026-07-09",
  }]);
  await writeNdjson(directory, release.files.externalIdentifiers, [{
    programId: "rise_prg_fixture",
    namespace: "ACGME_PROGRAM",
    value: "1400000001",
  }]);
  await writeNdjson(directory, release.files.claims, [
    {
      id: "claim-publishable",
      subjectId: "rise_prg_fixture",
      field: "Program Director",
      publication: "source_attributed_snapshot",
      knowledge: { state: "known", value: "Dr. Test" },
      sourceDocumentId: "rise_src_fixture",
      assertionClass: "synthetic_fixture",
    },
    {
      id: "claim-quarantined",
      subjectId: "rise_prg_fixture",
      field: "J1",
      publication: "quarantined",
      knowledge: { state: "known", value: true },
      sourceDocumentId: "rise_src_fixture",
      assertionClass: "synthetic_fixture",
    },
  ]);
  await fs.writeFile(path.join(directory, release.files.fields), JSON.stringify({ fields: ["Program Director", "J1"] }));
  const releaseManifestSha256 = await populateOutputHashes(directory, release);

  try {
    const result = await buildIndex(directory, output, { expectedReleaseManifestSha256: releaseManifestSha256 });
    const index = JSON.parse(await fs.readFile(path.join(result.outputDirectory, "api-index.json"), "utf8"));
    assert.equal(index.programs[0].evidence.knownClaims, 2);
    assert.equal(index.programs[0].evidence.knownEvidenceLabeledClaims, 1);
    assert.equal(index.programs[0].evidence.knownSelectedClaims, 1);
    assert.equal(index.programs[0].evidence.quarantinedClaims, 1);
    assert.equal(
      index.programs[0].evidence.coveragePercent,
      Math.round(1 / index.programs[0].evidence.selectedFieldCount * 1000) / 10,
    );
    assert.equal(
      index.programs[0].evidence.unknownSelectedClaims,
      index.programs[0].evidence.selectedFieldCount - 1,
    );
    assert.deepEqual(index.programs[0].identifiers, [{ namespace: "ACGME_PROGRAM", value: "1400000001" }]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
    await fs.rm(output, { recursive: true, force: true });
  }
});

test("API index builder rejects a release file whose bytes do not match the manifest", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-lineage-"));
  const output = await fs.mkdtemp(path.join(os.tmpdir(), "rise-index-output-"));
  const release = releaseFixture(true);
  for (const file of Object.values(release.files)) await fs.writeFile(path.join(directory, file), "{}\n");
  const releaseManifestSha256 = await populateOutputHashes(directory, release);
  await fs.appendFile(path.join(directory, release.files.programs), "tampered\n");
  try {
    await assert.rejects(
      buildIndex(directory, output, { expectedReleaseManifestSha256: releaseManifestSha256 }),
      /file hash mismatch: programs\.ndjson/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
    await fs.rm(output, { recursive: true, force: true });
  }
});
