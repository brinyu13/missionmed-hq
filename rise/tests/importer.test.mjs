import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { importRegistry } from "../src/importer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const combined = JSON.parse(await fs.readFile(path.resolve(here, "../config/combined-specialties.v1.json"), "utf8"));

function fixtureHeaders() {
  const headers = [
    "RISE_ID", "Specialty", "Program Name", "Institution", "Hospital", "City", "State", "Zip", "Region",
    "ACGME ID", "NRMP Code", "Program Website", "Residency Explorer URL", "FREIDA URL", "Survey Received",
    "FREIDA Last Updated", "FREIDA Program ID", "Primary Source", "Secondary Source", "Evidence URL",
    "Evidence Notes", "Verification Date", "Verified By", "Confidence", "J1", "H1B", "IMG Friendly Indicators",
    "MissionMed Notes",
  ];
  while (headers.length < 196) headers.push(`Fixture Field ${headers.length}`);
  return headers;
}

function fixtureRow(headers, values) {
  return headers.map((header) => values[header] ?? "");
}

async function writeFixture(filePath, { residencyExplorer = false, sourceAuthorizationSha256s = [] } = {}) {
  const headers = fixtureHeaders();
  const group = headers.map(() => "GROUP");
  const exact = {
    RISE_ID: "RISE-IM-0001",
    Specialty: "Internal Medicine",
    "Program Name": "Exact IM Program",
    Institution: "Exact Institution",
    City: "Boston",
    State: "MA",
    "ACGME ID": "1400000001",
    "FREIDA Program ID": "1400000001",
    "FREIDA URL": "https://freida.ama-assn.org/program/1400000001",
    "Residency Explorer URL": residencyExplorer ? "https://www.residencyexplorer.org/program/fixture" : "",
    "Survey Received": "2025-07-01",
    "FREIDA Last Updated": "2026-02-19",
    "Primary Source": residencyExplorer ? "Residency Explorer" : "FREIDA",
    "Evidence URL": "https://freida.ama-assn.org/program/1400000001",
    "Verification Date": "2026-07-09",
    J1: "Yes",
    H1B: "No",
    "IMG Friendly Indicators": "unsafe editorial fixture",
  };
  const combinedProgram = {
    RISE_ID: "RISE-IM-0002",
    Specialty: "Internal Medicine/Pediatrics",
    "Program Name": "Combined IM/Peds Program",
    Institution: "Combined Institution",
    City: "Chicago",
    State: "IL",
    "ACGME ID": "7000000002",
    "FREIDA Program ID": "7000000002",
    "FREIDA URL": "https://freida.ama-assn.org/program/7000000002",
    "Survey Received": "2025-07-02",
    "FREIDA Last Updated": "2026-02-19",
    "Primary Source": "FREIDA",
    "Evidence URL": "https://freida.ama-assn.org/program/7000000002",
    "Verification Date": "2026-07-09",
    J1: "Yes",
  };
  const combinedPedsProjection = { ...combinedProgram, RISE_ID: "RISE-PED-0001" };
  const tables = [
    { kind: "table", sheet: "Internal Medicine", values: [group, headers, fixtureRow(headers, exact), fixtureRow(headers, combinedProgram)] },
    { kind: "table", sheet: "Pediatrics", values: [group, headers, fixtureRow(headers, combinedPedsProjection)] },
  ];
  const contentSha256 = createHash("sha256");
  for (const table of tables) contentSha256.update(JSON.stringify({ sheet: table.sheet, values: table.values }));
  const records = [
    ...tables,
    {
      kind: "workbook",
      schemaVersion: 2,
      sourceArtifact: "fixture.xlsx",
      sourceSha256: "a".repeat(64),
      contentSha256: contentSha256.digest("hex"),
      specialtyTabs: 2,
      sourceAuthorizationSha256s: [...sourceAuthorizationSha256s].sort(),
    },
  ];
  await fs.writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return records.at(-1).contentSha256;
}

async function writeAuthorization(filePath, provider, product) {
  const grantPath = `${filePath}.grant`;
  const grant = `Synthetic source-owner grant fixture for ${provider} ${product}.\n`;
  await fs.writeFile(grantPath, grant);
  const sourceOwnerGrantSha256 = createHash("sha256").update(grant).digest("hex");
  const content = `${JSON.stringify({
    schemaVersion: 1,
    status: "approved",
    provider,
    product,
    authorizationId: `test-${product.toLowerCase().replaceAll(" ", "-")}-authorization`,
    writtenAuthorizationReference: "test-fixture-reference-only",
    sourceOwnerGrantSha256,
    allowedUses: ["create_or_supplement_missionmed_rise_database"],
    effectiveFrom: "2026-01-01",
    validThrough: "2099-12-31",
    missionMedReview: {
      decision: "approved",
      decisionRecordId: "test-decision-record",
      reviewerSubject: "test-reviewer",
      reviewedAt: "2026-01-02",
    },
  })}\n`;
  await fs.writeFile(filePath, content);
  return createHash("sha256").update(content).digest("hex");
}

function grantPath(authorizationPath) {
  return `${authorizationPath}.grant`;
}

function datasetConfig(sourcePins, { canonicalContentSha256 = "a".repeat(64) } = {}) {
  return {
    schemaVersion: 1,
    datasetVersion: "synthetic-test",
    canonicalGoogleSheetId: "synthetic-test",
    canonicalWorkbook: "fixture.xlsx",
    referenceLocalWorkbookSha256: "a".repeat(64),
    canonicalContentSha256,
    canonicalSpecialtyTabs: ["Internal Medicine", "Pediatrics"],
    retrievedAt: "2026-07-10",
    requiredSourceAuthorizations: Object.entries(sourcePins).map(([source, approvedRecordSha256]) => ({
      source,
      required: true,
      approvedRecordSha256,
    })),
  };
}

test("importer reconciles exact and combined programs without duplicate canonical identity", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-import-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  const freidaAuthorizationPath = path.join(temp, "freida-authorization.json");
  const freidaAuthorizationSha256 = await writeAuthorization(freidaAuthorizationPath, "AMA", "FREIDA");
  const contentSha256 = await writeFixture(inspectPath, { sourceAuthorizationSha256s: [freidaAuthorizationSha256] });
  const result = await importRegistry({
    inspectPath,
    outputDirectory: path.join(temp, "releases"),
    combinedConfig: combined,
    sourceResolutions: { schemaVersion: 1, resolutions: {} },
    freidaAuthorizationPath,
    freidaGrantPath: grantPath(freidaAuthorizationPath),
    datasetConfig: datasetConfig(
      { FREIDA: freidaAuthorizationSha256 },
      { canonicalContentSha256: contentSha256 },
    ),
    expectedSourceContentSha256: contentSha256,
    expectedBaseline: {
      rawSourceRows: 3,
      activeSourceRows: 3,
      quarantinedSourceRows: 0,
      uniquePrograms: 2,
      additionalBrowseMemberships: 1,
      internalMedicineBrowseMemberships: 2,
      exactInternalMedicinePrograms: 1,
      specialtyTabs: 2,
    },
  });
  assert.equal(result.manifest.counts.uniquePrograms, 2);
  assert.equal(result.manifest.counts.browseMemberships, 3);
  assert.equal(result.manifest.counts.additionalBrowseMemberships, 1);
  assert.equal(result.manifest.counts.matchableClaims, 0);
  assert.equal(result.manifest.releaseGate.sourceRights[0].sha256, freidaAuthorizationSha256);
  const validation = JSON.parse(await fs.readFile(path.join(result.releaseDirectory, "validation.json"), "utf8"));
  assert.equal(validation.baseline.passed, true);
  assert.equal(validation.invariants.missingValuesRemainUnknown, true);
  const claims = (await fs.readFile(path.join(result.releaseDirectory, "claims.ndjson"), "utf8"))
    .trim().split("\n").map(JSON.parse);
  const sourceDocuments = (await fs.readFile(path.join(result.releaseDirectory, "source-documents.ndjson"), "utf8"))
    .trim().split("\n").map(JSON.parse);
  assert.equal(sourceDocuments[0].retrievedAt, "2026-07-10");
  assert.equal(sourceDocuments[0].missionMedVerifiedAt, "2026-07-09");
  const h1b = claims.find((claim) => claim.field === "H1B");
  assert.deepEqual(h1b.knowledge, { state: "unknown", reason: "source_list_absence" });
  assert.equal(h1b.retrievedAt, "2026-07-10");
  assert.equal(h1b.missionMedVerifiedAt, "2026-07-09");
  const editorial = claims.find((claim) => claim.field === "IMG Friendly Indicators");
  assert.equal(editorial.publication, "quarantined");
  await fs.rm(temp, { recursive: true, force: true });
});

test("Residency Explorer source material is blocked by governance configuration before inspection read", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-source-policy-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  const freidaAuthorizationPath = path.join(temp, "freida-authorization.json");
  const freidaAuthorizationSha256 = await writeAuthorization(freidaAuthorizationPath, "AMA", "FREIDA");
  await assert.rejects(
    importRegistry({
      inspectPath: path.join(temp, "must-not-be-opened.ndjson"),
      outputDirectory: path.join(temp, "releases"),
      combinedConfig: combined,
      freidaAuthorizationPath,
      freidaGrantPath: grantPath(freidaAuthorizationPath),
      datasetConfig: datasetConfig({ FREIDA: freidaAuthorizationSha256, "Residency Explorer": null }),
    }),
    (error) => error.code === "RISE_SOURCE_POLICY_BLOCKED" &&
      error.details?.source === "Residency Explorer",
  );
  await fs.rm(temp, { recursive: true, force: true });
});

test("FREIDA source material is blocked before inspection read without a governance pin", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-freida-policy-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  await assert.rejects(
    importRegistry({
      inspectPath,
      outputDirectory: path.join(temp, "releases"),
      combinedConfig: combined,
      datasetConfig: datasetConfig({ FREIDA: null }),
    }),
    (error) => error.code === "RISE_SOURCE_POLICY_BLOCKED" && error.details?.source === "FREIDA",
  );
  await fs.rm(temp, { recursive: true, force: true });
});

test("approved source hash is enforced before a release is created", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-source-hash-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  const freidaAuthorizationPath = path.join(temp, "freida-authorization.json");
  const freidaAuthorizationSha256 = await writeAuthorization(freidaAuthorizationPath, "AMA", "FREIDA");
  const contentSha256 = await writeFixture(inspectPath, { sourceAuthorizationSha256s: [freidaAuthorizationSha256] });
  await assert.rejects(
    importRegistry({
      inspectPath,
      outputDirectory: path.join(temp, "releases"),
      combinedConfig: combined,
      expectedSourceContentSha256: "b".repeat(64),
      freidaAuthorizationPath,
      freidaGrantPath: grantPath(freidaAuthorizationPath),
      datasetConfig: datasetConfig(
        { FREIDA: freidaAuthorizationSha256 },
        { canonicalContentSha256: contentSha256 },
      ),
    }),
    (error) => error.code === "RISE_SOURCE_HASH_MISMATCH",
  );
  await fs.rm(temp, { recursive: true, force: true });
});

test("caller-authored authorization is rejected unless its exact hash is governance pinned", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-auth-pin-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  const freidaAuthorizationPath = path.join(temp, "freida-authorization.json");
  const freidaAuthorizationSha256 = await writeAuthorization(freidaAuthorizationPath, "AMA", "FREIDA");
  const contentSha256 = await writeFixture(inspectPath, { sourceAuthorizationSha256s: [freidaAuthorizationSha256] });
  await assert.rejects(
    importRegistry({
      inspectPath,
      outputDirectory: path.join(temp, "releases"),
      combinedConfig: combined,
      freidaAuthorizationPath,
      freidaGrantPath: grantPath(freidaAuthorizationPath),
      datasetConfig: datasetConfig({ FREIDA: "f".repeat(64) }),
    }),
    (error) => error.code === "RISE_SOURCE_AUTHORIZATION_INVALID",
  );
  await fs.rm(temp, { recursive: true, force: true });
});

test("inspection table content is rehashed instead of trusting declared metadata", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-inspection-integrity-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  const freidaAuthorizationPath = path.join(temp, "freida-authorization.json");
  const freidaAuthorizationSha256 = await writeAuthorization(freidaAuthorizationPath, "AMA", "FREIDA");
  const contentSha256 = await writeFixture(inspectPath, { sourceAuthorizationSha256s: [freidaAuthorizationSha256] });
  const lines = (await fs.readFile(inspectPath, "utf8")).trim().split("\n").map(JSON.parse);
  lines[0].values[2][2] = "Tampered Program";
  await fs.writeFile(inspectPath, `${lines.map((record) => JSON.stringify(record)).join("\n")}\n`);
  await assert.rejects(
    importRegistry({
      inspectPath,
      outputDirectory: path.join(temp, "releases"),
      combinedConfig: combined,
      freidaAuthorizationPath,
      freidaGrantPath: grantPath(freidaAuthorizationPath),
      datasetConfig: datasetConfig(
        { FREIDA: freidaAuthorizationSha256 },
        { canonicalContentSha256: contentSha256 },
      ),
    }),
    (error) => error.code === "RISE_INSPECTION_INTEGRITY_FAILED",
  );
  await fs.rm(temp, { recursive: true, force: true });
});

test("inspection workbook identity, binary hash, content hash, and specialty tabs must match dataset governance", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-inspection-dataset-test-"));
  const inspectPath = path.join(temp, "fixture.inspect.ndjson");
  const freidaAuthorizationPath = path.join(temp, "freida-authorization.json");
  const freidaAuthorizationSha256 = await writeAuthorization(freidaAuthorizationPath, "AMA", "FREIDA");
  const contentSha256 = await writeFixture(inspectPath, { sourceAuthorizationSha256s: [freidaAuthorizationSha256] });
  const lines = (await fs.readFile(inspectPath, "utf8")).trim().split("\n").map(JSON.parse);
  lines.at(-1).sourceSha256 = "c".repeat(64);
  await fs.writeFile(inspectPath, `${lines.map((record) => JSON.stringify(record)).join("\n")}\n`);
  await assert.rejects(
    importRegistry({
      inspectPath,
      outputDirectory: path.join(temp, "releases"),
      combinedConfig: combined,
      freidaAuthorizationPath,
      freidaGrantPath: grantPath(freidaAuthorizationPath),
      datasetConfig: datasetConfig(
        { FREIDA: freidaAuthorizationSha256 },
        { canonicalContentSha256: contentSha256 },
      ),
    }),
    (error) => error.code === "RISE_INSPECTION_DATASET_MISMATCH",
  );
  await fs.rm(temp, { recursive: true, force: true });
});
