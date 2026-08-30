#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { canonicalProgramSpecialtyIdentity } from "../src/identity.mjs";
import { soap2026EvidenceClaim } from "../src/evidence.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const riseRoot = path.resolve(here, "..");
const DEFAULT_SOURCE = "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_SOAP_2026_CLOSURE_006/07_SOAP_IMPORT_DATA.json";
const DEFAULT_WORKBOOK = "/Users/brianb/Desktop/RISE_4102_SOL_ULTRA_UPLOAD_PACK/MissionMed_RISE_Residency_Database_EVERY_SPECIALTY_GSHEETS.xlsx";
const EXPECTED_SOURCE_SHA256 = "af7215525bb3b974bc5092f18bd6b42f19c3c397d259ea60ab32dd89418b68ac";
const EXPECTED_WORKBOOK_SHA256 = "c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e";
const RETRIEVED_AT = "2026-08-29T00:00:00.000Z";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function parseArgs(argv) {
  const result = { source: DEFAULT_SOURCE, workbook: DEFAULT_WORKBOOK, write: false, apply: false };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error("Arguments must be --key value pairs");
    result[key] = value;
  }
  result.write = String(result.write) === "true";
  result.apply = String(result.apply) === "true";
  return result;
}

async function canonicalAcgmeIds(workbookPath) {
  if (await sha256File(workbookPath) !== EXPECTED_WORKBOOK_SHA256) throw new Error("Canonical workbook hash drifted");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const identifiers = new Set();
  for (const sheet of workbook.worksheets) {
    if (["Reference Lists", "Data Dictionary", "Change Log"].includes(sheet.name)) continue;
    const headers = {};
    sheet.getRow(2).eachCell((cell, column) => { headers[String(cell.text ?? "").trim()] = column; });
    const identifierColumn = headers["ACGME ID"] || headers["FREIDA Program ID"];
    if (!identifierColumn) continue;
    for (let row = 3; row <= sheet.rowCount; row += 1) {
      const identifier = String(sheet.getCell(row, identifierColumn).text ?? "").trim();
      if (/^\d{10}$/.test(identifier)) identifiers.add(identifier);
    }
  }
  return identifiers;
}

function validateSource(source) {
  if (source.total_rows !== 925 || source.total_positions !== 2854 || source.specialties !== 23 || source.rows?.length !== 925) {
    throw new Error("SOAP 2026 source count contract drifted");
  }
  const ids = new Set();
  let positions = 0;
  for (const row of source.rows) {
    if (!/^\d{10}$/.test(String(row.ACGME_ID ?? ""))) throw new Error("SOAP row has an invalid ACGME ID");
    const count = Number.parseInt(String(row.Available_Positions ?? ""), 10);
    if (!Number.isInteger(count) || count < 0) throw new Error("SOAP row has invalid available positions");
    ids.add(row.ACGME_ID);
    positions += count;
  }
  if (ids.size !== 886 || positions !== 2854) throw new Error("SOAP 2026 identity/position contract drifted");
}

export async function importSoap2026({
  sourcePath = DEFAULT_SOURCE,
  workbookPath = DEFAULT_WORKBOOK,
  identityPath = path.join(riseRoot, "releases/private-beta/program-identity.v1.json"),
  manifestPath = path.join(riseRoot, "releases/private-beta/program-identity-manifest.v1.json"),
  write = false,
} = {}) {
  const sourceBytes = await fsp.readFile(sourcePath);
  if (sha256(sourceBytes) !== EXPECTED_SOURCE_SHA256) throw new Error("SOAP 2026 source hash drifted");
  const source = JSON.parse(sourceBytes);
  validateSource(source);
  const canonicalIds = await canonicalAcgmeIds(workbookPath);
  const grouped = new Map();
  source.rows.forEach((row, index) => {
    const id = String(row.ACGME_ID);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push({ row, sourceRow: index + 1 });
  });
  const identities = [];
  const claims = [];
  for (const [acgmeId, entries] of [...grouped].sort()) {
    const first = entries[0].row;
    const specialty = String(first.Specialty).trim();
    if (entries.some(({ row }) => String(row.Specialty).trim() !== specialty)) {
      throw new Error(`SOAP ACGME identity spans multiple specialties: ${acgmeId}`);
    }
    const canonical = canonicalProgramSpecialtyIdentity(acgmeId, specialty);
    const reconciliationStatus = canonicalIds.has(acgmeId) ? "EXACT_ACGME_MATCH" : "REVIEW_REQUIRED";
    const exposureState = reconciliationStatus === "EXACT_ACGME_MATCH" ? "PRIVATE_BETA" : "INTERNAL_ONLY";
    const tracks = entries.map(({ row, sourceRow }) => ({
      sourceRow,
      programType: String(row.Program_Type_Full).trim(),
      programTypeCode: String(row.Program_Type).trim(),
      nrmpProgramCode: String(row.NRMP_Program_Code).trim(),
      availablePositions: Number.parseInt(String(row.Available_Positions), 10),
    })).sort((left, right) => left.nrmpProgramCode.localeCompare(right.nrmpProgramCode));
    const identityCore = {
      programIdentityId: canonical.program.id,
      programSpecialtyId: canonical.id,
      acgmeId,
      programName: String(first.Program_Name).trim(),
      institution: String(first.Institution).trim(),
      city: String(first.City).trim() || null,
      state: String(first.State).trim(),
      specialty,
      reconciliationStatus,
      exposureState,
      sourceId: "rise_src_soap_2026",
      tracks,
    };
    identities.push({ ...identityCore, contentSha256: sha256(JSON.stringify(identityCore)) });
    for (const { row, sourceRow } of entries) {
      claims.push(soap2026EvidenceClaim({
        programSpecialtyId: canonical.id,
        sourceRow: row,
        sourceLocator: `07_SOAP_IMPORT_DATA.json#/rows/${sourceRow - 1}`,
        retrievedAt: RETRIEVED_AT,
        publicationState: exposureState === "PRIVATE_BETA" ? "PRIVATE_BETA" : "INTERNAL_ONLY",
        reviewState: exposureState === "PRIVATE_BETA" ? "APPROVED" : "REVIEW_REQUIRED",
      }));
    }
  }
  const matched = identities.filter((identity) => identity.reconciliationStatus === "EXACT_ACGME_MATCH");
  const reviewRequired = identities.filter((identity) => identity.reconciliationStatus === "REVIEW_REQUIRED");
  const additionalTrackRows = source.rows.length - identities.length;
  if (matched.length !== 883 || reviewRequired.length !== 3 || additionalTrackRows !== 39) {
    throw new Error("SOAP 2026 reconciliation contract drifted");
  }
  const release = {
    schemaVersion: 1,
    releaseId: `rise_program_identity_soap_2026_${sha256(JSON.stringify(identities)).slice(0, 12)}`,
    projection: "PRIVATE_BETA_RIGHTS_SAFE_IDENTITY",
    source: {
      provider: source.source,
      sourceSha256: EXPECTED_SOURCE_SHA256,
      retrievedAt: RETRIEVED_AT,
      period: { kind: "match_cycle", label: "2026" },
    },
    counts: {
      sourceRows: source.rows.length,
      positions: source.total_positions,
      uniqueAcgmeIds: identities.length,
      exactAcgmeMatches: matched.length,
      reviewRequired: reviewRequired.length,
      additionalTrackRows,
      specialties: source.specialties,
    },
    identities,
  };
  const releaseBytes = Buffer.from(`${JSON.stringify(release, null, 2)}\n`);
  const manifest = {
    schemaVersion: 1,
    immutable: true,
    releaseId: release.releaseId,
    releaseSha256: sha256(releaseBytes),
    sourceSha256: EXPECTED_SOURCE_SHA256,
    canonicalWorkbookSha256: EXPECTED_WORKBOOK_SHA256,
    studentVisibleIdentityCount: matched.length,
    internalReviewRequiredIdentityCount: reviewRequired.length,
    historicalClaimCount: claims.length,
    wording: "SOAP 2026 - This program appeared in the 2026 SOAP results.",
    prohibitedInferences: ["currently_unfilled", "quality", "friendliness", "accessibility", "easy_match", "guaranteed_match", "future_participation"],
  };
  if (write) {
    await fsp.mkdir(path.dirname(identityPath), { recursive: true });
    await fsp.writeFile(identityPath, releaseBytes);
    await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { release, manifest, claims };
}

export async function backfillSoap2026({
  store,
  sourcePath = DEFAULT_SOURCE,
  workbookPath = DEFAULT_WORKBOOK,
} = {}) {
  if (!store?.ingestSoapDataset) throw new TypeError("A canonical evidence store with ingestSoapDataset is required");
  const imported = await importSoap2026({ sourcePath, workbookPath, write: false });
  const result = await store.ingestSoapDataset({
    release: imported.release,
    claims: imported.claims,
    sourceFile: sourcePath,
    sourceFileSha256: EXPECTED_SOURCE_SHA256,
  });
  return { ...result, releaseId: imported.release.releaseId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const operation = options.apply
    ? import("../adapters/postgres-runtime.mjs").then(async ({ createRiseCanonicalEvidenceStore }) => {
      const store = await createRiseCanonicalEvidenceStore();
      return backfillSoap2026({ store, sourcePath: options.source, workbookPath: options.workbook });
    })
    : importSoap2026({ sourcePath: options.source, workbookPath: options.workbook, write: options.write }).then(({ release, manifest, claims }) => ({
      releaseId: release.releaseId,
      counts: release.counts,
      releaseSha256: manifest.releaseSha256,
      claims: claims.length,
      wrote: options.write,
      applied: false,
    }));
  operation.then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
