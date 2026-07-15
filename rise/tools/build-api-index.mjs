#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { assertCurrentSourceRights } from "../src/source-authorization.mjs";

const BUILDER_VERSION = "rise-api-index/1.3.0";
const SELECTED_FIELDS = new Set([
  "Program Website",
  "FREIDA URL",
  "Program Director",
  "Program Director Credentials",
  "Program Coordinator",
  "Coordinator Email",
  "Coordinator Phone",
  "Faculty Page URL",
  "Categorical Positions",
  "Residents Per Year",
  "Total Residents",
  "Salary PGY1",
  "Salary PGY2",
  "Salary PGY3",
  "Salary PGY4",
  "Vacation",
  "Meal Allowance",
  "Educational Stipend",
  "Research Requirement",
  "Research Track",
  "Night Float",
  "Call Schedule",
  "Clinic Structure",
  "Moonlighting",
  "Visa Sponsorship",
  "J1",
  "H1B",
  "Step Preferences",
  "COMLEX Accepted",
  "Board Pass Rate",
  "Research Opportunities",
  "Simulation Center",
  "Benefits",
  "Housing",
  "Parking",
  "Childcare",
  "Wellness",
  "Program Length",
  "First Year Positions",
  "Application Deadline",
  "Application Service",
  "Average Work Hours",
  "Applicant Interview Format",
  "ERAS Participates",
  "NRMP Main Match Participation",
  "US MD Step 1 Required",
  "US MD Step 2 Required",
  "IMG Step 1 Required",
  "IMG Step 2 Required",
  "DO COMLEX Level 1 Required",
  "DO COMLEX Level 2 Required",
  "DO Step 1 Required",
  "DO Step 2 Required",
  "Minimum LOR",
  "Maximum LOR",
  "Specialty Specific LOR Required",
  "Requires Previous GME",
  "Offers Preliminary Positions",
  "Required Away Rotations",
  "Required Supplemental Information",
  "Osteopathic Recognition",
  "Medical School Graduation Timeline",
  "Gap Experience Requirement",
  "F1 OPT First Year",
  "Program Best Described As",
  "DO Graduates Percent",
  "US MD Graduates Percent",
  "IMG Graduates Percent",
  "Official Program Description",
  "Curriculum Summary",
  "Didactics",
  "Career Mentorship"
]);

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("Arguments must be --key value pairs");
    result[key.slice(2)] = value;
  }
  return result;
}

async function readNdjson(filePath, visit) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  for await (const line of lines) {
    if (!line) continue;
    await visit(JSON.parse(line), count);
    count += 1;
  }
  return count;
}

function digest(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function claimView(claim) {
  return {
    knowledge: claim.knowledge,
    claimId: claim.id,
    authority: claim.authority,
    sourceDocumentId: claim.sourceDocumentId,
    sourceLocator: claim.sourceLocator,
    sourceUrl: claim.sourceUrl,
    period: claim.period,
    retrievedAt: claim.retrievedAt,
    sourceUpdatedAt: claim.sourceUpdatedAt ?? null,
    surveyReceivedAt: claim.surveyReceivedAt ?? null,
    missionMedVerifiedAt: claim.missionMedVerifiedAt ?? null,
    missionMedVerifiedBy: claim.missionMedVerifiedBy ?? null,
    assertionClass: claim.assertionClass,
    snapshotId: claim.snapshotId,
    parserVersion: claim.parserVersion,
    contentSha256: claim.contentSha256,
  };
}

async function verifyReleaseFiles(releaseDirectory, release) {
  if (!release.files || !release.outputHashes) throw new Error("Registry release is missing file lineage");
  for (const file of Object.values(release.files)) {
    const expected = release.outputHashes[file];
    if (!/^[a-f0-9]{64}$/.test(expected ?? "")) {
      throw new Error(`Registry release has no valid hash for ${file}`);
    }
    const actual = await sha256File(path.join(releaseDirectory, file));
    if (actual !== expected) throw new Error(`Registry release file hash mismatch: ${file}`);
  }
}

export async function buildIndex(releaseDirectory, outputParent, {
  now = Date.now(),
  revokedAuthorizationSha256s = process.env.RISE_REVOKED_SOURCE_AUTHORIZATION_SHA256S,
  expectedReleaseManifestSha256 = process.env.RISE_RELEASE_MANIFEST_SHA256,
} = {}) {
  const releaseBytes = await fsp.readFile(path.join(releaseDirectory, "release.json"));
  const releaseManifestSha256 = createHash("sha256").update(releaseBytes).digest("hex");
  const release = JSON.parse(releaseBytes.toString("utf8"));
  if (!release.immutable || release.activationStatus !== "offline_shadow_only") {
    throw new Error("API index input must be an immutable offline-shadow registry release");
  }
  assertCurrentSourceRights(release.releaseGate, { now, revokedAuthorizationSha256s });
  if (!/^[a-f0-9]{64}$/.test(expectedReleaseManifestSha256 ?? "")) {
    throw new Error("RISE_RELEASE_MANIFEST_SHA256 is required to build an API index");
  }
  if (releaseManifestSha256 !== expectedReleaseManifestSha256) {
    throw new Error("RISE registry release manifest hash mismatch");
  }
  await verifyReleaseFiles(releaseDirectory, release);
  const programs = new Map();
  const programSpecialties = new Map();
  const offeringByProgram = new Map();
  const membershipsByOffering = new Map();
  const sourceDocuments = new Map();
  const identifiersByProgram = new Map();
  const fieldsBySubject = new Map();
  const metricsBySubject = new Map();

  await readNdjson(path.join(releaseDirectory, release.files.programs), (record) => programs.set(record.id, record));
  await readNdjson(path.join(releaseDirectory, release.files.programSpecialties), (record) => {
    programSpecialties.set(record.id, record);
    offeringByProgram.set(record.programId, record);
  });
  await readNdjson(path.join(releaseDirectory, release.files.browseMemberships), (record) => {
    if (!membershipsByOffering.has(record.programSpecialtyId)) membershipsByOffering.set(record.programSpecialtyId, []);
    membershipsByOffering.get(record.programSpecialtyId).push(record);
  });
  await readNdjson(path.join(releaseDirectory, release.files.sourceDocuments), (record) => {
    sourceDocuments.set(record.id, record);
  });
  await readNdjson(path.join(releaseDirectory, release.files.externalIdentifiers), (record) => {
    if (!identifiersByProgram.has(record.programId)) identifiersByProgram.set(record.programId, []);
    identifiersByProgram.get(record.programId).push({ namespace: record.namespace, value: record.value });
  });
  await readNdjson(path.join(releaseDirectory, release.files.claims), (claim) => {
    if (!metricsBySubject.has(claim.subjectId)) {
      metricsBySubject.set(claim.subjectId, {
        total: 0,
        known: 0,
        knownEvidenceLabeled: 0,
        unknown: 0,
        quarantined: 0,
        evidenceLabeled: 0,
      });
    }
    const metrics = metricsBySubject.get(claim.subjectId);
    metrics.total += 1;
    if (claim.knowledge.state === "known") metrics.known += 1;
    else metrics.unknown += 1;
    if (claim.publication === "quarantined") metrics.quarantined += 1;
    else {
      metrics.evidenceLabeled += 1;
      if (claim.knowledge.state === "known") metrics.knownEvidenceLabeled += 1;
    }
    if (claim.publication !== "source_attributed_snapshot" || !SELECTED_FIELDS.has(claim.field)) return;
    if (!fieldsBySubject.has(claim.subjectId)) fieldsBySubject.set(claim.subjectId, {});
    fieldsBySubject.get(claim.subjectId)[claim.field] = claimView(claim);
  });

  const fieldContract = JSON.parse(await fsp.readFile(path.join(releaseDirectory, release.files.fields), "utf8"));
  const records = [];
  for (const program of programs.values()) {
    const offering = offeringByProgram.get(program.id);
    if (!offering) throw new Error(`Program has no specialty designation: ${program.id}`);
    const source = sourceDocuments.get(program.sourceDocumentId);
    if (!source) throw new Error(`Program has no source document: ${program.id}`);
    const emptyMetrics = { total: 0, known: 0, knownEvidenceLabeled: 0, unknown: 0, quarantined: 0, evidenceLabeled: 0 };
    const programMetrics = metricsBySubject.get(program.id) ?? emptyMetrics;
    const offeringMetrics = metricsBySubject.get(offering.id) ?? emptyMetrics;
    const known = programMetrics.known + offeringMetrics.known;
    const knownEvidenceLabeled = programMetrics.knownEvidenceLabeled + offeringMetrics.knownEvidenceLabeled;
    const quarantined = programMetrics.quarantined + offeringMetrics.quarantined;
    const selectedFields = {
      ...(fieldsBySubject.get(program.id) ?? {}),
      ...(fieldsBySubject.get(offering.id) ?? {}),
    };
    const selectedClaims = Object.values(selectedFields);
    const knownSelectedClaims = selectedClaims
      .filter((field) => field.knowledge?.state === "known").length;
    const absentSelectedClaims = Math.max(0, SELECTED_FIELDS.size - selectedClaims.length);
    const unknownSelectedClaims = SELECTED_FIELDS.size - knownSelectedClaims;
    records.push({
      id: program.id,
      programSpecialtyId: offering.id,
      lifecycle: program.lifecycle ?? "unknown",
      display: program.display,
      designation: offering.designation,
      kind: offering.kind,
      entryFormat: offering.entryFormat,
      components: offering.components,
      browseMemberships: (membershipsByOffering.get(offering.id) ?? []).sort((a, b) =>
        a.browseSpecialty.localeCompare(b.browseSpecialty)),
      identifiers: (identifiersByProgram.get(program.id) ?? []).sort((left, right) =>
        left.namespace.localeCompare(right.namespace)),
      fields: selectedFields,
      evidence: {
        knownClaims: known,
        knownEvidenceLabeledClaims: knownEvidenceLabeled,
        knownSelectedClaims,
        evidenceLabeledClaims: programMetrics.evidenceLabeled + offeringMetrics.evidenceLabeled,
        quarantinedClaims: quarantined,
        coveragePercent: Math.round(knownSelectedClaims / SELECTED_FIELDS.size * 1000) / 10,
        selectedFieldCount: SELECTED_FIELDS.size,
        absentSelectedClaims,
        unknownSelectedClaims,
        matchableClaims: 0,
      },
      source: {
        sourceDocumentId: source.id,
        authority: source.authority,
        assertionClass: source.assertionClass,
        urls: source.urls,
        retrievedAt: source.retrievedAt,
        sourceUpdatedAt: source.sourceUpdatedAt,
        surveyReceivedAt: source.surveyReceivedAt,
        missionMedVerifiedAt: source.missionMedVerifiedAt,
        missionMedVerifiedBy: source.missionMedVerifiedBy,
      },
    });
  }
  records.sort((a, b) => {
    const name = String(a.display.programName ?? "").localeCompare(String(b.display.programName ?? ""));
    return name || a.id.localeCompare(b.id);
  });

  const states = [...new Set(records.map((record) => record.display.state).filter(Boolean))].sort();
  const specialties = [...new Set(records.flatMap((record) =>
    record.browseMemberships.map((membership) => membership.browseSpecialty)))].sort();
  const indexSeed = {
    builderVersion: BUILDER_VERSION,
    releaseId: release.releaseId,
    releaseManifestSha256,
    releaseHashes: release.outputHashes,
    selectedFields: [...SELECTED_FIELDS].sort(),
  };
  const indexId = `rise_index_${release.releaseId}_${digest(indexSeed).slice(0, 12)}`;
  const outputDirectory = path.join(outputParent, indexId);
  await fsp.mkdir(outputParent, { recursive: true });
  await fsp.mkdir(outputDirectory, { recursive: false });
  const indexPath = path.join(outputDirectory, "api-index.json");
  await fsp.writeFile(indexPath, `${JSON.stringify({
    schemaVersion: 1,
    indexId,
    registryReleaseId: release.releaseId,
    registryReleaseManifestSha256: releaseManifestSha256,
    sourceSnapshotId: release.source.snapshotId,
    activationStatus: release.activationStatus,
    dataClassification: "source_controlled_registry",
    sourcePolicy: release.sourcePolicy,
    releaseGate: release.releaseGate,
    source: {
      canonicalContentSha256: release.source.canonicalContentSha256,
      datasetVersion: release.source.datasetVersion,
      retrievalDate: release.source.retrievalDate,
    },
    counts: release.counts,
    filters: { states, specialties },
    selectedFields: [...SELECTED_FIELDS],
    programs: records,
  })}\n`, { flag: "wx" });
  const indexSha256 = await sha256File(indexPath);
  const manifest = {
    schemaVersion: 1,
    indexId,
    immutable: true,
    builderVersion: BUILDER_VERSION,
    registryReleaseId: release.releaseId,
    registryContentSha256: release.source.canonicalContentSha256,
    dataClassification: "source_controlled_registry",
    sourceRightsApproved: true,
    sourceRights: release.releaseGate.sourceRights,
    programCount: records.length,
    selectedFieldCount: SELECTED_FIELDS.size,
    apiIndexSha256: indexSha256,
  };
  await fsp.writeFile(path.join(outputDirectory, "index-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return { outputDirectory, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args["release-dir"] || !args.out || !args["release-manifest-sha256"]) {
      throw new Error("Usage: node rise/tools/build-api-index.mjs --release-dir <release> --release-manifest-sha256 <sha256> --out <index-parent>");
    }
    const result = await buildIndex(path.resolve(args["release-dir"]), path.resolve(args.out), {
      expectedReleaseManifestSha256: args["release-manifest-sha256"],
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message, code: error.code ?? "RISE_INDEX_FAILED" }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
