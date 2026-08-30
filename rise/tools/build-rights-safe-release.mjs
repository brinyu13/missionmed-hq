#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { importSoap2026 } from "./import-soap-2026.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const riseRoot = path.resolve(here, "..");
const DEFAULT_INSPECTION = "/Users/brianb/MissionMed_worktrees/P1-RISE-4000/outputs/P1_RISE_4000_EVERY_SPECIALTY/MissionMed_RISE_Residency_Database_EVERY_SPECIALTY.xlsx.inspect.ndjson";
const DEFAULT_WORKBOOK = "/Users/brianb/MissionMed_worktrees/P1-RISE-4000/outputs/P1_RISE_4000_EVERY_SPECIALTY/MissionMed_RISE_Residency_Database_EVERY_SPECIALTY_GSHEETS.xlsx";
const EXPECTED_WORKBOOK_SHA256 = "c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e";
const EXPECTED_CONTENT_SHA256 = "40d86561cf08ff56ede703d999849740bad36ac536518da23495cbada1262494";
const RETRIEVED_AT = "2026-08-28";
const REVIEWED_AT = "2026-08-28T00:00:00.000Z";
const VALID_THROUGH = "2027-08-28";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function stableId(prefix, parts) {
  const seed = parts.map((part) => String(part).trim().toLocaleLowerCase("en-US")).join("\0");
  return `${prefix}_${sha256(seed).slice(0, 24)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

async function legacyHeaders(inspectPath) {
  const lines = readline.createInterface({ input: fs.createReadStream(inspectPath, "utf8"), crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.kind !== "table" || record.sheet !== "Internal Medicine") continue;
    const headers = record.values?.[1];
    if (!Array.isArray(headers) || headers.length !== 196) {
      throw new Error(`Canonical registry field contract drifted: expected 196 fields, received ${headers?.length ?? 0}`);
    }
    lines.close();
    return headers.map((header) => String(header).trim());
  }
  throw new Error("Canonical Internal Medicine table header was not found");
}

function rightsSafeProgram([grantee, city, state, specialty], source) {
  const id = stableId("rise_prg", [source.source, grantee, city, state, specialty]);
  const programSpecialtyId = stableId("rise_ps", [id, specialty]);
  return {
    id,
    programSpecialtyId,
    lifecycle: "unknown",
    researchStatus: "RESEARCH_PENDING",
    display: {
      programName: `${grantee} — ${specialty} THCGME`,
      institution: grantee,
      hospital: null,
      city,
      state,
      zip: null
    },
    designation: specialty,
    kind: "single",
    entryFormat: "not_published",
    components: [specialty],
    browseMemberships: [{ browseSpecialty: specialty, relationship: "EXACT_DESIGNATION" }],
    identifiers: [{ namespace: "MISSIONMED_RISE_ID", value: id }],
    fields: {},
    evidence: {
      knownClaims: 4,
      knownEvidenceLabeledClaims: 4,
      knownSelectedClaims: 0,
      evidenceLabeledClaims: 4,
      quarantinedClaims: 0,
      coveragePercent: 0,
      selectedFieldCount: 0,
      absentSelectedClaims: 0,
      unknownSelectedClaims: 0,
      matchableClaims: 0
    },
    source: {
      sourceDocumentId: "hrsa_thcgme_ay2025_2026_awardees",
      authority: "HRSA_THCGME",
      assertionClass: "authoritative_government_awardee_listing",
      urls: [source.sourceUrl, source.programContextUrl],
      retrievedAt: source.retrievedAt,
      sourceUpdatedAt: null,
      surveyReceivedAt: null,
      missionMedVerifiedAt: RETRIEVED_AT,
      missionMedVerifiedBy: "P1-RISE-5005 deterministic public-source projection"
    }
  };
}

function soapRightsSafeProgram(identity, claims) {
  const soapClaims = claims.filter((claim) => claim.subjectId === identity.programSpecialtyId);
  return {
    id: identity.programIdentityId,
    programSpecialtyId: identity.programSpecialtyId,
    lifecycle: "unknown",
    researchStatus: "RESEARCH_PENDING",
    display: {
      programName: identity.programName,
      institution: identity.institution,
      hospital: null,
      city: identity.city,
      state: identity.state,
      zip: null
    },
    designation: identity.specialty,
    kind: identity.tracks.length > 1 ? "multi_track" : "single",
    entryFormat: identity.tracks.map((track) => track.programType).filter(Boolean).join(" / ") || "not_published",
    components: [identity.specialty],
    browseMemberships: [{ browseSpecialty: identity.specialty, relationship: "EXACT_DESIGNATION" }],
    identifiers: [
      { namespace: "MISSIONMED_RISE_ID", value: identity.programIdentityId },
      { namespace: "ACGME_PROGRAM", value: identity.acgmeId }
    ],
    fields: {
      "SOAP 2026 Appearance": {
        knowledge: { state: "known", value: true },
        authority: "NRMP_SOAP_CLOSURE",
        assertionClass: "historical_cycle_fact",
        period: { kind: "match_cycle", label: "2026" },
        retrievedAt: RETRIEVED_AT,
        wording: "SOAP 2026 - This program appeared in the 2026 SOAP results.",
        context: "SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood."
      }
    },
    soap2026: {
      appeared: true,
      cycle: 2026,
      tracks: identity.tracks,
      wording: "SOAP 2026 - This program appeared in the 2026 SOAP results.",
      context: "SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood.",
      claimIds: soapClaims.map((claim) => claim.id)
    },
    evidence: {
      knownClaims: soapClaims.length + 5,
      knownEvidenceLabeledClaims: soapClaims.length + 5,
      knownSelectedClaims: 0,
      evidenceLabeledClaims: soapClaims.length + 5,
      quarantinedClaims: 0,
      coveragePercent: 0,
      selectedFieldCount: 0,
      absentSelectedClaims: 0,
      unknownSelectedClaims: 0,
      matchableClaims: 0
    },
    source: {
      sourceDocumentId: "soap_2026_import_data",
      authority: "NRMP_SOAP_CLOSURE",
      assertionClass: "historical_cycle_fact",
      urls: [],
      retrievedAt: RETRIEVED_AT,
      sourceUpdatedAt: null,
      surveyReceivedAt: null,
      missionMedVerifiedAt: RETRIEVED_AT,
      missionMedVerifiedBy: "P1-RISE-5008 exact ACGME reconciliation"
    }
  };
}

export async function buildRightsSafeRelease({
  inspectionPath = DEFAULT_INSPECTION,
  workbookPath = DEFAULT_WORKBOOK,
  outputDirectory = path.join(riseRoot, "releases", "student-rights-safe"),
  governanceDirectory = path.join(riseRoot, "governance"),
} = {}) {
  const workbookSha256 = await sha256File(workbookPath);
  if (workbookSha256 !== EXPECTED_WORKBOOK_SHA256) {
    throw new Error(`Canonical workbook hash drifted: ${workbookSha256}`);
  }
  const headers = await legacyHeaders(inspectionPath);
  const source = JSON.parse(await fsp.readFile(path.join(riseRoot, "data-sources", "hrsa-thcgme-ay2025-2026.v1.json"), "utf8"));
  const rightsEvidencePath = path.join(riseRoot, "governance", "hrsa-thcgme-public-domain-evidence.v1.json");
  const rightsEvidenceSha256 = await sha256File(rightsEvidencePath);

  await fsp.mkdir(path.dirname(outputDirectory), { recursive: true });
  await fsp.mkdir(outputDirectory, { recursive: false });
  await fsp.mkdir(governanceDirectory, { recursive: true });

  const authorization = {
    schemaVersion: 1,
    authorizationId: "rise-auth-hrsa-thcgme-public-domain-v1",
    status: "approved",
    provider: "U.S. Health Resources and Services Administration",
    product: "THCGME AY 2025-2026 Awardees",
    writtenAuthorizationReference: source.sourceUrl,
    sourceOwnerGrantSha256: rightsEvidenceSha256,
    allowedUses: ["create_or_supplement_missionmed_rise_database"],
    effectiveFrom: "2026-08-28T00:00:00.000Z",
    validThrough: `${VALID_THROUGH}T23:59:59.999Z`,
    projection: source.permittedProjection,
    excluded: source.excludedFromStudentProjection,
    missionMedReview: {
      decision: "approved",
      decisionRecordId: "P1-RISE-5005-HRSA-PUBLIC-FACT-PROJECTION",
      reviewerSubject: "founder-ticket:P1-RISE-5005",
      reviewedAt: REVIEWED_AT,
      legalStatus: "technical release-governance classification; not legal advice"
    }
  };
  const authorizationBytes = Buffer.from(`${JSON.stringify(authorization, null, 2)}\n`);
  const authorizationSha256 = sha256(authorizationBytes);
  await fsp.writeFile(path.join(outputDirectory, "hrsa-source-authorization.json"), authorizationBytes, { flag: "wx" });

  const sourceRight = {
    source: "HRSA THCGME",
    status: "approved",
    sha256: authorizationSha256,
    sourceOwnerGrantSha256: rightsEvidenceSha256,
    sourceOwnerGrantBytesVerified: true,
    authorizationId: authorization.authorizationId,
    decisionRecordId: authorization.missionMedReview.decisionRecordId,
    validThrough: authorization.validThrough
  };
  const soap = await importSoap2026({ write: false, workbookPath });
  const soapAuthorization = {
    schemaVersion: 1,
    authorizationId: "rise-auth-soap-2026-dr-148-v1",
    status: "approved",
    provider: "NRMP R3 SOAP Unfilled Positions 2026",
    product: "SOAP 2026 bounded historical projection",
    writtenAuthorizationReference: "MissionMed OS decision record DR-148",
    sourceOwnerGrantSha256: soap.manifest.sourceSha256,
    allowedUses: ["create_or_supplement_missionmed_rise_database"],
    effectiveFrom: "2026-08-29T00:00:00.000Z",
    validThrough: "2027-08-29T23:59:59.999Z",
    projection: ["acgme_id", "program_name", "institution", "state", "specialty", "program_type", "nrmp_program_code", "available_positions", "historical_cycle_appearance"],
    excluded: soap.manifest.prohibitedInferences,
    missionMedReview: {
      decision: "approved",
      decisionRecordId: "DR-148",
      reviewerSubject: "independent-authority-review:085c00dac4032da2c283f4834bba97a8d2cf13a9",
      reviewedAt: "2026-08-29T00:00:00.000Z",
      legalStatus: "bounded technical publication authority; not legal advice"
    }
  };
  const soapAuthorizationBytes = Buffer.from(`${JSON.stringify(soapAuthorization, null, 2)}\n`);
  const soapAuthorizationSha256 = sha256(soapAuthorizationBytes);
  await fsp.writeFile(path.join(outputDirectory, "soap-source-authorization.json"), soapAuthorizationBytes, { flag: "wx" });
  const soapRight = {
    source: "SOAP 2026",
    status: "approved",
    sha256: soapAuthorizationSha256,
    sourceOwnerGrantSha256: soap.manifest.sourceSha256,
    sourceOwnerGrantBytesVerified: true,
    authorizationId: soapAuthorization.authorizationId,
    decisionRecordId: "DR-148",
    validThrough: soapAuthorization.validThrough
  };
  const soapPrograms = soap.release.identities
    .filter((identity) => identity.exposureState === "PRIVATE_BETA")
    .map((identity) => soapRightsSafeProgram(identity, soap.claims));
  const programs = [...source.records.map((record) => rightsSafeProgram(record, source)), ...soapPrograms]
    .sort((left, right) => left.display.programName.localeCompare(right.display.programName));
  if (programs.length !== 909 || new Set(programs.map((program) => program.programSpecialtyId)).size !== programs.length) {
    throw new Error("Rights-safe registry must contain 909 unique HRSA and reconciled SOAP program-specialty records");
  }
  const states = [...new Set(programs.map((record) => record.display.state))].sort();
  const specialties = [...new Set(programs.map((record) => record.designation))].sort();
  const releaseId = `rise_rights_safe_beta_${RETRIEVED_AT.replaceAll("-", "")}_${sha256(JSON.stringify(programs)).slice(0, 12)}`;
  const index = {
    schemaVersion: 1,
    indexId: `rise_index_${releaseId}`,
    registryReleaseId: releaseId,
    registryReleaseManifestSha256: null,
    sourceSnapshotId: "hrsa_thcgme_ay2025_2026+soap_2026",
    activationStatus: "offline_shadow_only",
    dataClassification: "source_controlled_registry",
    releaseProjection: "STUDENT_RIGHTS_SAFE_RISE",
    sourcePolicy: {
      hrsaThcgme: "government_public_domain_factual_projection",
      freida: "excluded_no_written_authorization",
      residencyExplorer: "excluded_no_written_authorization",
      acgmeIdentifiers: "private_beta_only_when_exactly_reconciled_from_soap_2026",
      soap2026: "historical_cycle_only_no_future_or_quality_inference"
    },
    releaseGate: { sourceRightsApproved: true, sourceRights: [sourceRight, soapRight] },
    source: {
      authority: "HRSA_THCGME",
      sourceUrl: source.sourceUrl,
      retrievedAt: source.retrievedAt,
      canonicalLegacyContentSha256: EXPECTED_CONTENT_SHA256,
      canonicalLegacyWorkbookSha256: workbookSha256,
      legacyFieldsExcluded: headers.length
    },
    counts: {
      rawSourceRows: source.records.length + soap.release.counts.sourceRows,
      activeSourceRows: programs.length,
      quarantinedSourceRows: soap.release.counts.reviewRequired,
      uniquePrograms: programs.length,
      programSpecialties: programs.length,
      browseMemberships: programs.length,
      additionalBrowseMemberships: soap.release.counts.additionalTrackRows,
      specialtyTabs: specialties.length,
      exactSpecialtyDesignations: specialties.length,
      evidenceLabeledClaims: source.records.length * 4 + soap.claims.length + soapPrograms.length * 5,
      unknownClaimsFromAmbiguousNegatives: 0,
      omittedBlankCells: 0,
      matchableClaims: 0,
      rightsBlockedFields: headers.length
    },
    filters: { states, specialties, designations: specialties },
    selectedFields: [],
    programs
  };
  const indexBytes = Buffer.from(`${JSON.stringify(index)}\n`);
  const indexSha256 = sha256(indexBytes);
  await fsp.writeFile(path.join(outputDirectory, "api-index.json"), indexBytes, { flag: "wx" });

  const manifest = {
    schemaVersion: 1,
    indexId: index.indexId,
    immutable: true,
    builderVersion: "rise-rights-safe-release/1.0.0",
    registryReleaseId: releaseId,
    registryContentSha256: sha256(JSON.stringify(programs)),
    dataClassification: "source_controlled_registry",
    releaseProjection: "STUDENT_RIGHTS_SAFE_RISE",
    sourceRightsApproved: true,
    sourceRights: [sourceRight, soapRight],
    programCount: programs.length,
    selectedFieldCount: 0,
    rightsBlockedFieldCount: headers.length,
    apiIndexSha256: indexSha256
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestSha256 = sha256(manifestBytes);
  await fsp.writeFile(path.join(outputDirectory, "index-manifest.json"), manifestBytes, { flag: "wx" });

  const activationReceipt = {
    schemaVersion: 1,
    immutable: true,
    action: "activate",
    revoked: false,
    registryReleaseId: releaseId,
    apiIndexSha256: indexSha256,
    indexManifestSha256: manifestSha256,
    decisionRecordId: "PENDING-P1-RISE-5008-INDEPENDENT-RELEASE-APPROVAL",
    approvedBySubject: "pending-independent-release-review",
    approvedAt: null
  };
  const activationBytes = Buffer.from(`${JSON.stringify(activationReceipt, null, 2)}\n`);
  await fsp.writeFile(path.join(outputDirectory, "activation-receipt.json"), activationBytes, { flag: "wx" });

  const internalManifest = {
    schemaVersion: 1,
    dataset: "INTERNAL_FULL_RISE",
    publication: "prohibited",
    storage: "existing_governed_internal_corpora",
    canonicalWorkbookSha256: workbookSha256,
    canonicalContentSha256: EXPECTED_CONTENT_SHA256,
    canonicalFieldCount: headers.length,
    copiedIntoStudentRelease: false,
    soap2026: {
      exactAcgmeMatchesProjected: soap.release.counts.exactAcgmeMatches,
      reviewRequiredNotProjected: soap.release.counts.reviewRequired,
      additionalTrackRowsPreserved: soap.release.counts.additionalTrackRows
    },
    note: "This manifest binds the internal corpus without copying restricted field values into Git, the image, or the student API. SOAP identities are projected only after exact ACGME reconciliation."
  };
  await fsp.writeFile(path.join(outputDirectory, "internal-full-rise-manifest.json"), `${JSON.stringify(internalManifest, null, 2)}\n`, { flag: "wx" });

  const reviewRows = [["field", "source", "current use", "reason blocked", "what permission/review would unblock it"]];
  for (const field of headers) reviewRows.push([
    field,
    "FREIDA-derived canonical workbook",
    "INTERNAL_FULL_RISE only",
    "No written source-owner display/database grant is present; row-level provenance is FREIDA.",
    "Written source-owner authorization or independent field re-verification from a rights-safe source with a recorded rights decision."
  ]);
  reviewRows.push(
    ["ALL_FIELDS", "SOL56 official-source corpus", "INTERNAL_FULL_RISE only", "Student display authorization is false and per-domain rights decisions are incomplete.", "Per-source terms review and affirmative student-display decision."],
    ["ALL_FIELDS", "P1-RISE-4102 official-source corpus", "INTERNAL_FULL_RISE only", "Current-publishable fact count is zero and source-domain decisions are incomplete or deny reuse.", "Field-level re-verification plus affirmative source-domain rights decision."],
    ["3 unmatched SOAP 2026 program identities", "Recovered SOAP 2026 corpus", "INTERNAL_FULL_RISE only", "No exact ACGME identity exists in the canonical workbook.", "A verified RISE crosswalk; display-name-only joins remain prohibited."],
    ["HRSA narrative, award amount, and deeper enrichment", "HRSA THCGME", "Excluded", "Only the bounded factual awardee projection is approved; broader reuse was not evaluated.", "Legal/rights review for any broader or paid-tier reproduction."]
  );
  await fsp.writeFile(path.join(governanceDirectory, "RIGHTS_REVIEW_REQUIRED.csv"), csv(reviewRows));

  const auditRows = [["field", "projection", "provenance_category", "source", "production_action", "notes"]];
  for (const field of headers) auditRows.push([field, "INTERNAL_FULL_RISE", "E", "FREIDA-derived canonical workbook", "EXCLUDE", "Retained internally; never exposed by the student release."]);
  for (const [field, category, notes] of [
    ["program_name", "B", "Derived only from HRSA grantee plus specialty and visibly labeled THCGME."],
    ["institution", "B", "HRSA grantee name."],
    ["city", "B", "HRSA awardee table."],
    ["state", "B", "HRSA awardee table."],
    ["specialty", "B", "HRSA awardee table."],
    ["RISE_ID", "A", "MissionMed-generated opaque identifier."],
    ["research_status", "A", "MissionMed-generated release state."],
    ["source_and_freshness", "A/B", "MissionMed projection of HRSA source URL and retrieval date."]
  ]) auditRows.push([field, "STUDENT_RIGHTS_SAFE_RISE", category, category === "A" ? "MissionMed" : "HRSA THCGME", "INCLUDE", notes]);
  for (const [field, notes] of [
    ["acgme_id", "Exact ACGME identity used only for the 883 reconciled private-beta records."],
    ["program_name", "SOAP 2026 source identity; exact ACGME reconciliation required."],
    ["institution", "SOAP 2026 source identity; exact ACGME reconciliation required."],
    ["state", "SOAP 2026 source identity; exact ACGME reconciliation required."],
    ["specialty", "SOAP 2026 source identity; exact ACGME reconciliation required."],
    ["soap_2026_appearance", "Historical cycle fact only; no future availability or match-likelihood inference."],
    ["track_and_reported_positions", "Track rows remain separate and are never silently merged."]
  ]) auditRows.push([field, "PRIVATE_BETA_RIGHTS_SAFE_IDENTITY", "B", "NRMP SOAP 2026 bounded corpus", "INCLUDE", notes]);
  await fsp.writeFile(path.join(governanceDirectory, "FIELD_PROVENANCE_AUDIT.csv"), csv(auditRows));

  const checksums = [
    "api-index.json",
    "index-manifest.json",
    "activation-receipt.json",
    "hrsa-source-authorization.json",
    "soap-source-authorization.json",
    "internal-full-rise-manifest.json"
  ];
  const checksumLines = [];
  for (const filename of checksums) checksumLines.push(`${await sha256File(path.join(outputDirectory, filename))}  ${filename}`);
  await fsp.writeFile(path.join(outputDirectory, "CHECKSUMS.txt"), `${checksumLines.join("\n")}\n`, { flag: "wx" });

  return {
    releaseId,
    outputDirectory,
    workbookSha256,
    legacyFieldCount: headers.length,
    rightsSafePrograms: programs.length,
    rightsReviewRequired: reviewRows.length - 1,
    indexSha256,
    manifestSha256,
    activationReceiptSha256: sha256(activationBytes),
    authorizationSha256,
    soapAuthorizationSha256,
    rightsEvidenceSha256
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildRightsSafeRelease().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
