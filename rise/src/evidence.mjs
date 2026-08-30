import { createHash } from "node:crypto";
import { stableOpaqueId } from "./identity.mjs";

export const DERIVED_OR_EDITORIAL_FIELDS = new Set([
  "Program Type",
  "University Affiliated",
  "Community",
  "Hybrid",
  "Teaching Hospital",
  "Program Status",
  "IMG Friendly Indicators",
  "Historical Interview Stats",
]);

export const MISSIONMED_INTELLIGENCE_FIELDS = new Set([
  "Interview Style",
  "Behavioral %",
  "Traditional %",
  "Stress Interview",
  "Virtual",
  "In Person",
  "Program Values",
  "Mission Statement",
  "Culture Notes",
  "MissionMed Alumni",
  "ACTN Connections",
  "StoryForge Tags",
  "Timeline Assets",
  "CAM Interview Pack",
  "Interview Questions",
  "MissionMed Notes",
]);

export const ABSENCE_IS_NOT_NEGATIVE_FIELDS = new Set([
  "J1",
  "H1B",
  "F1 OPT First Year",
]);

export const SOURCE_METADATA_FIELDS = new Set([
  "Last Verified",
  "Source Confidence",
  "Primary Source",
  "Secondary Source",
  "Evidence URL",
  "Evidence Notes",
  "Verification Date",
  "Verified By",
  "Confidence",
]);

export const IDENTITY_FIELDS = new Set([
  "RISE_ID",
  "Specialty",
  "ACGME ID",
  "FREIDA Program ID",
]);

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function knowledgeFromStaging(field, value) {
  if (isBlank(value)) return { state: "unknown", reason: "not_collected" };
  if (ABSENCE_IS_NOT_NEGATIVE_FIELDS.has(field)) {
    const token = String(value).trim().toLowerCase();
    if (token === "yes") return { state: "known", value: true, explicit: true };
    if (token === "no") return { state: "unknown", reason: "source_list_absence" };
  }
  return { state: "known", value, explicit: true };
}

export function evidencePolicyFor(field) {
  if (MISSIONMED_INTELLIGENCE_FIELDS.has(field)) {
    return {
      assertionClass: "editorial",
      publication: "quarantined",
      matchable: false,
      reason: "missionmed_intelligence_requires_independent_source_review",
    };
  }
  if (DERIVED_OR_EDITORIAL_FIELDS.has(field)) {
    return {
      assertionClass: "derived",
      publication: "quarantined",
      matchable: false,
      reason: "staging_semantics_not_source_equivalent",
    };
  }
  return {
    assertionClass: "program_reported",
    publication: "source_attributed_snapshot",
    matchable: false,
    reason: "staging_cell_has_no_upstream_field_locator_or_current_cycle_scope",
  };
}

export function createEvidenceClaim({
  programId,
  programSpecialtyId,
  field,
  value,
  sourceDocumentId,
  sourceLocator,
  sourceUrl,
  retrievedAt,
  sourceUpdatedAt,
  surveyReceivedAt,
  missionMedVerifiedAt,
  missionMedVerifiedBy,
  snapshotId,
  parserVersion,
}) {
  const knowledge = knowledgeFromStaging(field, value);
  const policy = evidencePolicyFor(field);
  const subjectId = field === "Program Name" || field === "Institution" || field === "Hospital" ||
    field === "City" || field === "State" || field === "Zip" || field === "Region"
    ? programId
    : programSpecialtyId;
  const canonical = JSON.stringify({
    subjectId,
    field,
    knowledge,
    rawValue: value,
    sourceDocumentId,
    sourceLocator,
    sourceUrl,
    retrievedAt,
    sourceUpdatedAt,
    surveyReceivedAt,
    missionMedVerifiedAt,
    missionMedVerifiedBy,
    snapshotId,
    parserVersion,
  });
  const contentSha256 = createHash("sha256").update(canonical).digest("hex");
  return {
    id: stableOpaqueId("rise_claim", contentSha256),
    subjectId,
    field,
    knowledge,
    rawValue: value,
    authority: "FREIDA_GME_CENSUS",
    assertionClass: policy.assertionClass,
    publication: policy.publication,
    matchable: policy.matchable,
    policyReason: policy.reason,
    sourceDocumentId,
    sourceLocator,
    sourceUrl,
    period: { kind: "not_stated" },
    retrievedAt,
    sourceUpdatedAt: sourceUpdatedAt || undefined,
    surveyReceivedAt: surveyReceivedAt || undefined,
    missionMedVerifiedAt: missionMedVerifiedAt || undefined,
    missionMedVerifiedBy: missionMedVerifiedBy || undefined,
    snapshotId,
    parserVersion,
    contentSha256,
  };
}

export function knowledgeForField(claims, subjectId, field) {
  const matches = claims.filter((claim) => claim.subjectId === subjectId && claim.field === field);
  if (!matches.length) return { state: "unknown", reason: "not_collected" };
  const known = matches.filter((claim) => claim.knowledge.state === "known");
  if (!known.length) return matches[0].knowledge;
  const distinct = new Set(known.map((claim) => JSON.stringify(claim.knowledge.value)));
  if (distinct.size > 1) return { state: "conflict", claimIds: known.map((claim) => claim.id) };
  return known[0].knowledge;
}

const CANONICAL_PUBLICATION_STATES = new Set([
  "STUDENT_VISIBLE", "PRIVATE_BETA", "REVIEW_REQUIRED", "INTERNAL_ONLY", "REJECTED",
]);

export function createCanonicalEvidenceClaim({
  subjectId,
  field,
  value,
  provider,
  providerRunId,
  sourceType,
  sourceUrl = null,
  sourceLocator = null,
  retrievedAt,
  observedPeriod = { kind: "not_stated" },
  assertionClass = "source_attributed",
  publicationState = "REVIEW_REQUIRED",
  reviewState = "PENDING",
  conflictState = "NONE",
}) {
  if (!subjectId || !field || !provider || !providerRunId || !sourceType || !retrievedAt) {
    throw new TypeError("Canonical evidence identity, source, and retrieval fields are required");
  }
  if (!CANONICAL_PUBLICATION_STATES.has(publicationState)) {
    throw new Error(`Unsupported canonical publication state: ${publicationState}`);
  }
  if (publicationState === "STUDENT_VISIBLE" && reviewState !== "APPROVED") {
    throw new Error("Student-visible canonical evidence must be approved");
  }
  const canonical = {
    subjectId: String(subjectId), field: String(field), value,
    provider: String(provider), providerRunId: String(providerRunId), sourceType: String(sourceType),
    sourceUrl: sourceUrl || null, sourceLocator: sourceLocator || null,
    retrievedAt: String(retrievedAt), observedPeriod, assertionClass,
    publicationState, reviewState, conflictState,
  };
  const contentSha256 = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return {
    ...canonical,
    id: stableOpaqueId("rise_claim", contentSha256),
    contentSha256,
    knowledge: { state: value === null || value === undefined ? "unknown" : "known", value },
  };
}

export function soap2026EvidenceClaim({
  programSpecialtyId,
  sourceRow,
  sourceLocator,
  retrievedAt,
  publicationState = "PRIVATE_BETA",
  reviewState = "APPROVED",
}) {
  const positions = Number.parseInt(String(sourceRow.Available_Positions ?? ""), 10);
  return createCanonicalEvidenceClaim({
    subjectId: programSpecialtyId,
    field: "SOAP_2026_APPEARANCE",
    value: {
      appeared: true,
      availablePositions: Number.isInteger(positions) && positions >= 0 ? positions : null,
      programType: String(sourceRow.Program_Type_Full ?? "").trim() || null,
      nrmpProgramCode: String(sourceRow.NRMP_Program_Code ?? "").trim() || null,
      wording: "SOAP 2026 - This program appeared in the 2026 SOAP results.",
      context: "SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood.",
    },
    provider: "NRMP_SOAP_CLOSURE",
    providerRunId: "P1_RISE_SOAP_2026_CLOSURE_006",
    sourceType: "historical_match_cycle_result",
    sourceLocator,
    retrievedAt,
    observedPeriod: { kind: "match_cycle", label: "2026" },
    assertionClass: "historical_cycle_fact",
    publicationState,
    reviewState,
  });
}
