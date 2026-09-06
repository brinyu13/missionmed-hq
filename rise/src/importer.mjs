import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { once } from "node:events";
import {
  IDENTITY_FIELDS,
  SOURCE_METADATA_FIELDS,
  createEvidenceClaim,
  evidencePolicyFor,
} from "./evidence.mjs";
import {
  assertUniqueExternalIdentifiers,
  normalizeExternalProgramId,
  programIdentity,
  stableOpaqueId,
} from "./identity.mjs";
import { buildBrowseMembership, buildProgramSpecialty } from "./specialties.mjs";
import { loadPinnedSourceAuthorizations } from "./source-authorization.mjs";

export const IMPORTER_VERSION = "rise-registry-importer/1.2.0";
export const EXPECTED_STAGING_COLUMNS = 196;
export const EXPECTED_RELEASE_BASELINE = Object.freeze({
  rawSourceRows: 6346,
  activeSourceRows: 6345,
  quarantinedSourceRows: 1,
  uniquePrograms: 6139,
  additionalBrowseMemberships: 206,
  internalMedicineBrowseMemberships: 828,
  exactInternalMedicinePrograms: 695,
  specialtyTabs: 31,
});

const REQUIRED_HEADERS = [
  "RISE_ID",
  "Specialty",
  "Program Name",
  "ACGME ID",
  "Residency Explorer URL",
  "FREIDA URL",
  "Survey Received",
  "FREIDA Last Updated",
  "FREIDA Program ID",
  "Primary Source",
  "Evidence URL",
  "Verification Date",
];

function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  return value;
}

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])]));
}

function comparableRow(headers, row) {
  return headers.map((header, index) => header === "RISE_ID" ? "" : normalizeCell(row[index]));
}

function splitEvidenceUrls(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateOnly(value) {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

function recordDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertCanonicalInspection(staging, datasetConfig) {
  const expectedTabs = datasetConfig?.canonicalSpecialtyTabs;
  const actualTabs = staging.tables.map((table) => table.sheet);
  const valid = typeof datasetConfig?.canonicalWorkbook === "string" &&
    /^[a-f0-9]{64}$/.test(datasetConfig?.referenceLocalWorkbookSha256 ?? "") &&
    /^[a-f0-9]{64}$/.test(datasetConfig?.canonicalContentSha256 ?? "") &&
    Array.isArray(expectedTabs) &&
    staging.sourceArtifact.name === datasetConfig.canonicalWorkbook &&
    staging.sourceArtifact.sha256 === datasetConfig.referenceLocalWorkbookSha256 &&
    staging.computedContentSha256 === datasetConfig.canonicalContentSha256 &&
    staging.sourceArtifact.specialtyTabs === actualTabs.length &&
    JSON.stringify(actualTabs) === JSON.stringify(expectedTabs);
  if (!valid) {
    const error = new Error("Inspection artifact does not match the exact canonical dataset bindings");
    error.code = "RISE_INSPECTION_DATASET_MISMATCH";
    error.details = {
      expectedWorkbook: datasetConfig?.canonicalWorkbook ?? null,
      actualWorkbook: staging.sourceArtifact.name,
      expectedWorkbookSha256: datasetConfig?.referenceLocalWorkbookSha256 ?? null,
      actualWorkbookSha256: staging.sourceArtifact.sha256,
      expectedContentSha256: datasetConfig?.canonicalContentSha256 ?? null,
      actualContentSha256: staging.computedContentSha256,
      expectedTabs: expectedTabs ?? null,
      actualTabs,
    };
    throw error;
  }
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);
  stream.on("data", (chunk) => hash.update(chunk));
  await once(stream, "end");
  return hash.digest("hex");
}

async function writeLine(stream, record) {
  if (!stream.write(`${JSON.stringify(record)}\n`)) await once(stream, "drain");
}

async function closeStream(stream) {
  stream.end();
  await once(stream, "finish");
}

async function writeRecords(filePath, records) {
  const stream = fs.createWriteStream(filePath, { encoding: "utf8", flags: "wx" });
  let count = 0;
  for (const record of records) {
    await writeLine(stream, record);
    count += 1;
  }
  await closeStream(stream);
  return count;
}

function validateHeaders(headers, sheet) {
  if (headers.length !== EXPECTED_STAGING_COLUMNS) {
    throw new Error(`${sheet}: expected ${EXPECTED_STAGING_COLUMNS} columns, found ${headers.length}`);
  }
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) throw new Error(`${sheet}: missing required header ${required}`);
  }
}

function removeProjectionRecords(records, projectionKey) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].projectionKey === projectionKey) records.splice(index, 1);
  }
}

function resolveConflictingProjection({ externalProgramId, prior, current, sourceResolutions }) {
  const resolution = sourceResolutions?.resolutions?.[externalProgramId];
  if (!resolution) return null;
  if (resolution.normalizedExternalProgramId !== externalProgramId) return null;
  const expected = new Set([
    resolution.winningRawExternalProgramId,
    resolution.quarantinedRawExternalProgramId,
  ]);
  const observed = new Set([prior.rawExternalProgramId, current.rawExternalProgramId]);
  if (expected.size !== observed.size || [...expected].some((value) => !observed.has(value))) return null;
  if (current.rawExternalProgramId === resolution.winningRawExternalProgramId) {
    return { winner: "current", resolution };
  }
  if (prior.rawExternalProgramId === resolution.winningRawExternalProgramId) {
    return { winner: "prior", resolution };
  }
  return null;
}

function quarantinedProjection(projection, normalizedExternalProgramId, resolution) {
  return {
    id: stableOpaqueId("rise_quarantine", `${resolution.id}:${projection.projectionKey}`),
    resolutionId: resolution.id,
    action: resolution.action,
    normalizedExternalProgramId,
    rawExternalProgramId: projection.rawExternalProgramId,
    legacyRiseId: projection.legacyRiseId,
    sourceProjection: projection.table,
    sourceRow: projection.sourceRow,
    programName: projection.fields["Program Name"] || null,
    sourceUpdatedAt: dateOnly(projection.fields["FREIDA Last Updated"]) ?? null,
    surveyReceivedAt: dateOnly(projection.fields["Survey Received"]) ?? null,
    freidaUrl: projection.fields["FREIDA URL"] || null,
    rationale: resolution.rationale,
  };
}

async function readStagingInspection(inspectPath, {
  sourceAuthorizations = {},
  sourceResolutions = { schemaVersion: 1, resolutions: {} },
} = {}) {
  const freidaAuthorization = sourceAuthorizations.FREIDA ?? null;
  const residencyExplorerAuthorization = sourceAuthorizations["Residency Explorer"] ?? null;
  const programsByExternalId = new Map();
  const memberships = [];
  const aliases = [];
  const quarantinedSourceRows = [];
  const tables = [];
  let rawSourceRows = 0;
  let sourceArtifact = null;
  let canonicalHeaders = null;
  let freidaMaterialRows = 0;
  let residencyExplorerMaterialCells = 0;
  const contentHash = createHash("sha256");

  const input = fs.createReadStream(inspectPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.startsWith('{"kind":"workbook"')) {
      const record = JSON.parse(line);
      if (
        record.schemaVersion !== 2 ||
        !/^[a-f0-9]{64}$/.test(record.sourceSha256 ?? "") ||
        !/^[a-f0-9]{64}$/.test(record.contentSha256 ?? "") ||
        !Array.isArray(record.sourceAuthorizationSha256s) ||
        record.sourceAuthorizationSha256s.some((sha) => !/^[a-f0-9]{64}$/.test(sha))
      ) {
        throw new Error("Inspection artifact is missing valid canonical workbook metadata");
      }
      sourceArtifact = {
        name: record.sourceArtifact,
        sha256: record.sourceSha256,
        contentSha256: record.contentSha256,
        specialtyTabs: record.specialtyTabs,
        sourceAuthorizationSha256s: [...new Set(record.sourceAuthorizationSha256s)].sort(),
      };
      continue;
    }
    if (!line.startsWith('{"kind":"table"')) continue;
    const table = JSON.parse(line);
    const headers = table.values?.[1] ?? [];
    if (headers.length !== EXPECTED_STAGING_COLUMNS) continue;
    validateHeaders(headers, table.sheet);
    contentHash.update(JSON.stringify({ sheet: table.sheet, values: table.values }));
    if (!canonicalHeaders) canonicalHeaders = headers;
    else if (JSON.stringify(canonicalHeaders) !== JSON.stringify(headers)) {
      throw new Error(`${table.sheet}: header contract differs from the canonical specialty tab`);
    }
    const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
    const rows = table.values.slice(2);
    tables.push({ sheet: table.sheet, rows: rows.length });
    for (let sourceRowIndex = 0; sourceRowIndex < rows.length; sourceRowIndex += 1) {
      rawSourceRows += 1;
      const row = rows[sourceRowIndex];
      const fields = rowObject(headers, row);
      if (fields["FREIDA URL"] || /freida/i.test(String(fields["Primary Source"]))) {
        freidaMaterialRows += 1;
      }
      const rawExternalProgramId = String(fields["FREIDA Program ID"] ?? "");
      const externalProgramId = normalizeExternalProgramId(rawExternalProgramId);
      const acgmeId = normalizeExternalProgramId(fields["ACGME ID"]);
      if (externalProgramId !== acgmeId) {
        throw new Error(`${table.sheet}: FREIDA/ACGME identifier mismatch for ${externalProgramId}`);
      }
      if (fields["Residency Explorer URL"] || /residency explorer/i.test(String(fields["Primary Source"]))) {
        residencyExplorerMaterialCells += 1;
      }
      const identity = programIdentity(externalProgramId);
      const exactSpecialty = String(fields.Specialty).trim();
      if (!exactSpecialty) throw new Error(`${table.sheet}: missing exact specialty for ${externalProgramId}`);
      const projection = {
        table: table.sheet,
        sourceRow: sourceRowIndex + 3,
        projectionKey: `${table.sheet}:${sourceRowIndex + 3}:${rawExternalProgramId}`,
        rawExternalProgramId,
        row: row.map(normalizeCell),
        fields,
        exactSpecialty,
        legacyRiseId: String(fields.RISE_ID ?? "").trim(),
      };
      const prior = programsByExternalId.get(externalProgramId);
      let activateProjection = true;
      if (!prior) {
        programsByExternalId.set(externalProgramId, {
          identity,
          projections: [projection],
          comparable: comparableRow(headers, row),
        });
      } else {
        const comparison = comparableRow(headers, row);
        if (JSON.stringify(prior.comparable) !== JSON.stringify(comparison)) {
          const differingFields = headers.filter((header, index) =>
            JSON.stringify(prior.comparable[index]) !== JSON.stringify(comparison[index]));
          const priorProjection = prior.projections[0];
          const resolved = resolveConflictingProjection({
            externalProgramId,
            prior: priorProjection,
            current: projection,
            sourceResolutions,
          });
          if (!resolved) {
            const error = new Error(`Conflicting projections for program ${externalProgramId}`);
            error.code = "RISE_DUPLICATE_SOURCE_CONFLICT";
            error.details = { externalProgramId, differingFields, tables: [priorProjection.table, table.sheet] };
            throw error;
          }
          if (resolved.winner === "current") {
            quarantinedSourceRows.push(quarantinedProjection(priorProjection, externalProgramId, resolved.resolution));
            removeProjectionRecords(memberships, priorProjection.projectionKey);
            removeProjectionRecords(aliases, priorProjection.projectionKey);
            programsByExternalId.set(externalProgramId, {
              identity,
              projections: [projection],
              comparable: comparison,
            });
          } else {
            quarantinedSourceRows.push(quarantinedProjection(projection, externalProgramId, resolved.resolution));
            activateProjection = false;
          }
        } else {
          prior.projections.push(projection);
        }
      }
      if (activateProjection) memberships.push({
        externalProgramId,
        exactSpecialty,
        browseSpecialty: table.sheet,
        projectionKey: projection.projectionKey,
      });
      if (activateProjection && projection.legacyRiseId) {
        aliases.push({
          namespace: "LEGACY_STAGING_RISE_ID",
          value: projection.legacyRiseId,
          programId: identity.id,
          sourceProjection: table.sheet,
          projectionKey: projection.projectionKey,
        });
      }
      void indexes;
    }
  }

  if (!canonicalHeaders) throw new Error("No specialty tables were found in the inspection artifact");
  if (!sourceArtifact) throw new Error("Inspection artifact does not identify its canonical workbook source");
  const computedContentSha256 = contentHash.digest("hex");
  if (computedContentSha256 !== sourceArtifact.contentSha256) {
    const error = new Error("Inspection content hash does not match its table records");
    error.code = "RISE_INSPECTION_INTEGRITY_FAILED";
    error.details = { declared: sourceArtifact.contentSha256, computed: computedContentSha256 };
    throw error;
  }
  const currentAuthorizationSha256s = Object.values(sourceAuthorizations).map((record) => record.sha256).sort();
  if (JSON.stringify(currentAuthorizationSha256s) !== JSON.stringify(sourceArtifact.sourceAuthorizationSha256s)) {
    const error = new Error("Inspection authorization lineage does not match the current governance pins");
    error.code = "RISE_INSPECTION_AUTHORIZATION_MISMATCH";
    throw error;
  }
  if (freidaMaterialRows && !freidaAuthorization) {
    const error = new Error(
      `FREIDA material detected in ${freidaMaterialRows} source rows without a valid written-authorization record`,
    );
    error.code = "RISE_SOURCE_POLICY_BLOCKED";
    error.details = { source: "FREIDA", materialRows: freidaMaterialRows };
    throw error;
  }
  if (residencyExplorerMaterialCells && !residencyExplorerAuthorization) {
    const error = new Error(
      `Residency Explorer material detected in ${residencyExplorerMaterialCells} source cells without a valid written-authorization record`,
    );
    error.code = "RISE_SOURCE_POLICY_BLOCKED";
    error.details = { source: "Residency Explorer", materialCells: residencyExplorerMaterialCells };
    throw error;
  }
  return {
    headers: canonicalHeaders,
    programsByExternalId,
    memberships,
    aliases,
    quarantinedSourceRows,
    rawSourceRows,
    sourceArtifact,
    computedContentSha256,
    tables,
    sourcePolicy: {
      freidaMaterialRows,
      freidaAuthorization: freidaAuthorization ? {
        ...freidaAuthorization,
      } : null,
      residencyExplorerMaterialCells,
      residencyExplorerAuthorization: residencyExplorerAuthorization ? {
        ...residencyExplorerAuthorization,
      } : null,
    },
  };
}

function buildRegistryRecords(staging, combinedConfig, snapshotId, artifactRetrievedAt) {
  const programRecords = [];
  const programSpecialtyRecords = [];
  const sourceDocumentRecords = [];
  const externalIdentifierRecords = [];
  const canonicalByExternalId = new Map();
  const programSpecialtyByExternalId = new Map();

  for (const [externalProgramId, source] of [...staging.programsByExternalId].sort(([a], [b]) => a.localeCompare(b))) {
    const projection = [...source.projections].sort((a, b) => a.table.localeCompare(b.table))[0];
    const fields = projection.fields;
    const programSpecialty = buildProgramSpecialty(source.identity.id, projection.exactSpecialty, combinedConfig);
    const sourceUrls = splitEvidenceUrls(fields["Evidence URL"]);
    const freidaUrl = String(fields["FREIDA URL"] ?? "").trim();
    if (freidaUrl && !sourceUrls.includes(freidaUrl)) sourceUrls.unshift(freidaUrl);
    const sourceDocumentId = stableOpaqueId("rise_src", `${externalProgramId}:${snapshotId}`);
    programRecords.push({
      id: source.identity.id,
      lifecycle: "unknown",
      identityStatus: "bootstrap_external_identifier_bound",
      display: {
        programName: fields["Program Name"] || null,
        institution: fields.Institution || null,
        hospital: fields.Hospital || null,
        city: fields.City || null,
        state: fields.State || null,
        zip: fields.Zip || null,
      },
      sourceDocumentId,
    });
    programSpecialtyRecords.push(programSpecialty);
    programSpecialtyByExternalId.set(externalProgramId, programSpecialty);
    canonicalByExternalId.set(externalProgramId, { projection, sourceDocumentId, sourceUrls });
    sourceDocumentRecords.push({
      id: sourceDocumentId,
      snapshotId,
      authority: "FREIDA_GME_CENSUS",
      assertionClass: "program_reported",
      externalProgramId,
      urls: sourceUrls,
      retrievedAt: artifactRetrievedAt,
      sourceUpdatedAt: dateOnly(fields["FREIDA Last Updated"]) ?? null,
      surveyReceivedAt: dateOnly(fields["Survey Received"]) ?? null,
      missionMedVerifiedAt: dateOnly(fields["Verification Date"]) ?? null,
      missionMedVerifiedBy: String(fields["Verified By"] ?? "").trim() || null,
      evidenceNotes: fields["Evidence Notes"] || null,
      sourceProjectionHash: recordDigest(comparableRow(staging.headers, projection.row)),
    });
    externalIdentifierRecords.push(
      { programId: source.identity.id, namespace: "FREIDA_PROGRAM", value: externalProgramId },
      { programId: source.identity.id, namespace: "ACGME_PROGRAM", value: externalProgramId },
    );
  }
  assertUniqueExternalIdentifiers(externalIdentifierRecords);

  const browseMembershipRecords = staging.memberships.map((membership) => {
    const programSpecialty = programSpecialtyByExternalId.get(membership.externalProgramId);
    return buildBrowseMembership(programSpecialty, membership.browseSpecialty);
  }).sort((a, b) => a.id.localeCompare(b.id));

  const aliasRecords = staging.aliases.map((alias) => ({
    ...alias,
    id: stableOpaqueId("rise_alias", `${alias.namespace}:${alias.value}:${alias.sourceProjection}`),
  })).sort((a, b) => a.id.localeCompare(b.id));

  return {
    programs: programRecords,
    programSpecialties: programSpecialtyRecords,
    sourceDocuments: sourceDocumentRecords,
    externalIdentifiers: externalIdentifierRecords.sort((a, b) =>
      `${a.programId}:${a.namespace}`.localeCompare(`${b.programId}:${b.namespace}`)),
    browseMemberships: browseMembershipRecords,
    aliases: aliasRecords,
    canonicalByExternalId,
    programSpecialtyByExternalId,
  };
}

function claimFields(headers) {
  return headers.filter((field) => !IDENTITY_FIELDS.has(field) && !SOURCE_METADATA_FIELDS.has(field) &&
    field !== "Residency Explorer URL" && field !== "NRMP Code");
}

function cellLocator(externalProgramId, field) {
  return `staging://MissionMed_RISE_Residency_Database_EVERY_SPECIALTY/${externalProgramId}/${encodeURIComponent(field)}`;
}

async function writeClaims(filePath, staging, records, snapshotId, artifactRetrievedAt) {
  const stream = fs.createWriteStream(filePath, { encoding: "utf8", flags: "wx" });
  const fields = claimFields(staging.headers);
  const counts = {
    claims: 0,
    known: 0,
    unknownFromAmbiguousNegatives: 0,
    quarantined: 0,
    evidenceLabeled: 0,
    omittedBlankCells: 0,
    matchable: 0,
  };
  const externalIds = [...staging.programsByExternalId.keys()].sort();
  for (const externalProgramId of externalIds) {
    const source = staging.programsByExternalId.get(externalProgramId);
    const canonical = records.canonicalByExternalId.get(externalProgramId);
    const programSpecialty = records.programSpecialtyByExternalId.get(externalProgramId);
    const row = canonical.projection.fields;
    for (const field of fields) {
      const value = row[field];
      if (value === "" || value === null || value === undefined) {
        counts.omittedBlankCells += 1;
        continue;
      }
      const claim = createEvidenceClaim({
        programId: source.identity.id,
        programSpecialtyId: programSpecialty.id,
        field,
        value,
        sourceDocumentId: canonical.sourceDocumentId,
        sourceLocator: cellLocator(externalProgramId, field),
        sourceUrl: canonical.sourceUrls[0] ?? null,
        retrievedAt: artifactRetrievedAt,
        sourceUpdatedAt: dateOnly(row["FREIDA Last Updated"]),
        surveyReceivedAt: dateOnly(row["Survey Received"]),
        missionMedVerifiedAt: dateOnly(row["Verification Date"]),
        missionMedVerifiedBy: String(row["Verified By"] ?? "").trim() || undefined,
        snapshotId,
        parserVersion: IMPORTER_VERSION,
      });
      await writeLine(stream, claim);
      counts.claims += 1;
      if (claim.knowledge.state === "known") counts.known += 1;
      else counts.unknownFromAmbiguousNegatives += 1;
      if (claim.publication === "quarantined") counts.quarantined += 1;
      else counts.evidenceLabeled += 1;
      if (claim.matchable) counts.matchable += 1;
    }
  }
  await closeStream(stream);
  return { ...counts, candidateFields: fields.length, fields };
}

function validateBaseline(counts, expected) {
  const checks = {
    rawSourceRows: counts.rawSourceRows === expected.rawSourceRows,
    activeSourceRows: counts.activeSourceRows === expected.activeSourceRows,
    quarantinedSourceRows: counts.quarantinedSourceRows === expected.quarantinedSourceRows,
    uniquePrograms: counts.uniquePrograms === expected.uniquePrograms,
    additionalBrowseMemberships: counts.additionalBrowseMemberships === expected.additionalBrowseMemberships,
    internalMedicineBrowseMemberships:
      counts.internalMedicineBrowseMemberships === expected.internalMedicineBrowseMemberships,
    exactInternalMedicinePrograms: counts.exactInternalMedicinePrograms === expected.exactInternalMedicinePrograms,
    specialtyTabs: counts.specialtyTabs === expected.specialtyTabs,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

export async function importRegistry({
  inspectPath,
  outputDirectory,
  combinedConfig,
  sourceResolutions = { schemaVersion: 1, resolutions: {} },
  expectedSourceContentSha256,
  datasetConfig,
  freidaAuthorizationPath,
  residencyExplorerAuthorizationPath,
  freidaGrantPath,
  residencyExplorerGrantPath,
  expectedBaseline = EXPECTED_RELEASE_BASELINE,
}) {
  if (!inspectPath || !outputDirectory || !combinedConfig) {
    throw new TypeError("inspectPath, outputDirectory, and combinedConfig are required");
  }
  const artifactRetrievedAt = dateOnly(datasetConfig?.retrievedAt);
  if (!artifactRetrievedAt) {
    throw new TypeError("datasetConfig.retrievedAt must be an explicit YYYY-MM-DD artifact retrieval date");
  }
  const sourceAuthorizations = await loadPinnedSourceAuthorizations({
    datasetConfig,
    pathsBySource: {
      FREIDA: freidaAuthorizationPath,
      "Residency Explorer": residencyExplorerAuthorizationPath,
    },
    grantPathsBySource: {
      FREIDA: freidaGrantPath,
      "Residency Explorer": residencyExplorerGrantPath,
    },
  });
  const sourceSha256 = await sha256File(inspectPath);
  const staging = await readStagingInspection(inspectPath, {
    sourceAuthorizations,
    sourceResolutions,
  });
  assertCanonicalInspection(staging, datasetConfig);
  if (
    expectedSourceContentSha256 &&
    staging.computedContentSha256 !== expectedSourceContentSha256
  ) {
    const error = new Error("Canonical workbook content does not match the approved dataset configuration");
    error.code = "RISE_SOURCE_HASH_MISMATCH";
    error.details = {
      expected: expectedSourceContentSha256,
      actual: staging.computedContentSha256,
    };
    throw error;
  }
  const snapshotId = stableOpaqueId("rise_snapshot", staging.computedContentSha256);
  const records = buildRegistryRecords(staging, combinedConfig, snapshotId, artifactRetrievedAt);
  const activeSourceRows = staging.memberships.length;
  const uniquePrograms = records.programs.length;
  const internalMedicineBrowseMemberships = records.browseMemberships
    .filter((membership) => membership.browseSpecialty === "Internal Medicine").length;
  const exactInternalMedicinePrograms = records.programSpecialties
    .filter((record) => record.designation === "Internal Medicine").length;
  const counts = {
    rawSourceRows: staging.rawSourceRows,
    activeSourceRows,
    quarantinedSourceRows: staging.quarantinedSourceRows.length,
    uniquePrograms,
    programSpecialties: records.programSpecialties.length,
    browseMemberships: records.browseMemberships.length,
    additionalBrowseMemberships: activeSourceRows - uniquePrograms,
    specialtyTabs: staging.tables.length,
    exactSpecialtyDesignations: new Set(records.programSpecialties.map((record) => record.designation)).size,
    internalMedicineBrowseMemberships,
    exactInternalMedicinePrograms,
    aliases: records.aliases.length,
    sourceDocuments: records.sourceDocuments.length,
    externalIdentifiers: records.externalIdentifiers.length,
  };
  const baseline = validateBaseline(counts, expectedBaseline);
  if (!baseline.passed) {
    const error = new Error("Registry source does not reconcile to the expected release baseline");
    error.code = "RISE_BASELINE_MISMATCH";
    error.details = { counts, expectedBaseline, checks: baseline.checks };
    throw error;
  }

  const retrievalDates = records.sourceDocuments.map((record) => record.retrievedAt).filter(Boolean).sort();
  const retrievalDate = retrievalDates.at(-1) ?? "undated";
  const releaseId = `rise_registry_${retrievalDate}_${staging.computedContentSha256.slice(0, 12)}`;
  const releaseDirectory = path.join(outputDirectory, releaseId);
  await fsp.mkdir(outputDirectory, { recursive: true });
  try {
    await fsp.mkdir(releaseDirectory, { recursive: false });
  } catch (error) {
    if (error.code === "EEXIST") {
      const duplicate = new Error(`Immutable release already exists: ${releaseDirectory}`);
      duplicate.code = "RISE_RELEASE_EXISTS";
      throw duplicate;
    }
    throw error;
  }

  const files = {
    programs: "programs.ndjson",
    programSpecialties: "program-specialties.ndjson",
    browseMemberships: "browse-memberships.ndjson",
    aliases: "aliases.ndjson",
    sourceDocuments: "source-documents.ndjson",
    externalIdentifiers: "external-identifiers.ndjson",
    quarantinedSourceRows: "quarantined-source-rows.ndjson",
    claims: "claims.ndjson",
    fields: "fields.json",
    validation: "validation.json",
  };
  try {
    await writeRecords(path.join(releaseDirectory, files.programs), records.programs);
    await writeRecords(path.join(releaseDirectory, files.programSpecialties), records.programSpecialties);
    await writeRecords(path.join(releaseDirectory, files.browseMemberships), records.browseMemberships);
    await writeRecords(path.join(releaseDirectory, files.aliases), records.aliases);
    await writeRecords(path.join(releaseDirectory, files.sourceDocuments), records.sourceDocuments);
    await writeRecords(path.join(releaseDirectory, files.externalIdentifiers), records.externalIdentifiers);
    await writeRecords(path.join(releaseDirectory, files.quarantinedSourceRows), staging.quarantinedSourceRows);
    const claimCounts = await writeClaims(
      path.join(releaseDirectory, files.claims),
      staging,
      records,
      snapshotId,
      artifactRetrievedAt,
    );
    counts.claims = claimCounts.claims;
    counts.knownClaims = claimCounts.known;
    counts.unknownClaimsFromAmbiguousNegatives = claimCounts.unknownFromAmbiguousNegatives;
    counts.quarantinedClaims = claimCounts.quarantined;
    counts.evidenceLabeledClaims = claimCounts.evidenceLabeled;
    counts.omittedBlankCells = claimCounts.omittedBlankCells;
    counts.matchableClaims = claimCounts.matchable;
    await fsp.writeFile(path.join(releaseDirectory, files.fields), `${JSON.stringify({
      schemaVersion: 1,
      missingFieldSemantics: "A missing claim is unknown and must never be interpreted as false.",
      fields: claimCounts.fields.map((field) => ({ field, ...evidencePolicyFor(field) })),
    }, null, 2)}\n`, { flag: "wx" });
    await fsp.writeFile(path.join(releaseDirectory, files.validation), `${JSON.stringify({
      schemaVersion: 1,
      baseline,
      counts,
      sourcePolicy: staging.sourcePolicy,
      invariants: {
        noFreidaMaterialWithoutAuthorization:
          staging.sourcePolicy.freidaMaterialRows === 0 || Boolean(staging.sourcePolicy.freidaAuthorization),
        noResidencyExplorerMaterialWithoutAuthorization:
          staging.sourcePolicy.residencyExplorerMaterialCells === 0 || Boolean(staging.sourcePolicy.residencyExplorerAuthorization),
        noExternalIdentifierCollisions: true,
        noConflictingDuplicateProjections: true,
        noOrdinalIdsUsedAsCanonicalIdentity: true,
        missingValuesRemainUnknown: true,
        currentReleaseHasNoHardMatchableClaims: counts.matchableClaims === 0,
      },
    }, null, 2)}\n`, { flag: "wx" });

    const outputHashes = {};
    for (const file of Object.values(files)) {
      outputHashes[file] = await sha256File(path.join(releaseDirectory, file));
    }
    const manifest = {
      schemaVersion: 1,
      releaseId,
      immutable: true,
      activationStatus: "offline_shadow_only",
      importerVersion: IMPORTER_VERSION,
      source: {
        artifactType: "xlsx_workbook_inspection_ndjson",
        inspectionSha256: sourceSha256,
        canonicalWorkbook: staging.sourceArtifact.name,
        workbookSerializationSha256: staging.sourceArtifact.sha256,
        canonicalContentSha256: staging.computedContentSha256,
        snapshotId,
        canonicalGoogleSheetId: datasetConfig?.canonicalGoogleSheetId ?? null,
        datasetVersion: datasetConfig?.datasetVersion ?? null,
        retrievalDate,
      },
      counts,
      sourcePolicy: staging.sourcePolicy,
      files,
      outputHashes,
      releaseGate: {
        registryCountsReconciled: baseline.passed,
        productionDatabaseLoaded: false,
        productionRouteEnabled: false,
        sourceRightsApproved:
          Boolean(staging.sourcePolicy.freidaAuthorization) &&
          (
            staging.sourcePolicy.residencyExplorerMaterialCells === 0 ||
            Boolean(staging.sourcePolicy.residencyExplorerAuthorization)
          ),
        sourceRights: Object.values(sourceAuthorizations).sort((left, right) => left.source.localeCompare(right.source)),
        hardMatchingEnabled: false,
      },
    };
    await fsp.writeFile(path.join(releaseDirectory, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    return { releaseDirectory, manifest };
  } catch (error) {
    await fsp.rm(releaseDirectory, { recursive: true, force: true });
    throw error;
  }
}
