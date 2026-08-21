import { sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import {
  CV_CANONICAL_TYPES,
  CV_CATEGORY_IDS,
  CV_EVIDENCE_FIELDS,
  type CvCategoryId,
  type CvEvidenceField,
  type CvIntelligenceRequest,
  type CvProviderCandidate,
  type CvProviderEvidence,
  type CvProviderQualitySuggestion,
  type CvQualitySuggestionType,
  type CvProviderResult,
  type CvValidatedCandidate,
} from "./cv-intelligence-schema.js";

export interface CvPostValidationResult {
  candidates: CvValidatedCandidate[];
  providerSuggestions: CvProviderQualitySuggestion[];
  unresolvedQuestions: string[];
  rejectedCandidateCount: number;
  localIdMap: Map<string, string>;
}

const DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/;
const CANONICAL_TYPES = new Set<string>(CV_CANONICAL_TYPES);
const CATEGORY_IDS = new Set<string>(CV_CATEGORY_IDS);
const EVIDENCE_FIELDS = new Set<string>(CV_EVIDENCE_FIELDS);
const QUALITY_TYPES = new Set<CvQualitySuggestionType>([
  "POSSIBLE_DUPLICATE",
  "CATEGORY_REVIEW",
  "CHRONOLOGY_REVIEW",
  "MISSING_END_DATE",
  "SOURCE_ITEM_NOT_INCLUDED",
  "LABEL_READABILITY",
  "VISUAL_OVERLAP",
]);

const FORCED_CATEGORY: Partial<Record<CvProviderCandidate["canonicalType"], CvCategoryId>> = {
  EDUCATION: "education",
  MEDICAL_DEGREE: "education",
  GRADUATION: "education",
  AWARD_HONOR: "education",
  CERTIFICATION: "education",
  VOLUNTEER_EXPERIENCE: "work",
  STEP_1: "usmle",
  STEP_2_CK: "usmle",
  STEP_3: "usmle",
  USMLE_STUDY_PERIOD: "usmle",
  ECFMG_CERTIFICATION: "usmle",
  PUBLICATION: "res",
  ABSTRACT_POSTER_PRESENTATION: "res",
  RESEARCH_EXPERIENCE: "res",
  PERSONAL_NOT_ON_CV: "personal",
};

function normalizeExplicitServiceClassification(
  canonicalType: string,
  title: string | null,
): { canonicalType: string; corrected: boolean; warning: string | null } {
  if (
    canonicalType === "RESEARCH_EXPERIENCE"
    && /\b(?:volunteer|community service|community health|mentor(?:ing)?)\b/i.test(String(title || ""))
  ) {
    return {
      canonicalType: "VOLUNTEER_EXPERIENCE",
      corrected: true,
      warning: "Classification corrected to volunteer experience from explicit service wording; review before acceptance.",
    };
  }
  return { canonicalType, corrected: false, warning: null };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if ((!normalized && !nullable) || normalized.length > max) return null;
  return normalized || null;
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    const normalized = text(item, maxLength);
    if (!normalized) return null;
    result.push(normalized);
  }
  return result;
}

function normalizedEvidenceText(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

function providerEvidence(value: unknown, blocks: Map<string, string>): CvProviderEvidence | null {
  const item = asRecord(value);
  if (!item) return null;
  const field = text(item.field, 80) as CvEvidenceField | null;
  const sourceBlockIds = stringArray(item.sourceBlockIds, 10, 160);
  const excerpt = text(item.excerpt, 2_000);
  const support = item.support === "EXPLICIT" || item.support === "INFERRED" ? item.support : null;
  const reason = text(item.reason, 1_000);
  const uncertainty = text(item.uncertainty, 1_000, true);
  if (!field || !EVIDENCE_FIELDS.has(field) || !sourceBlockIds?.length || !excerpt || !support || !reason) return null;
  if (sourceBlockIds.some((id) => !blocks.has(id))) return null;
  const normalizedExcerpt = normalizedEvidenceText(excerpt);
  if (!sourceBlockIds.some((id) => normalizedEvidenceText(blocks.get(id)!).includes(normalizedExcerpt))) return null;
  return { field, sourceBlockIds, excerpt, support, reason, uncertainty };
}

function normalizedKey(value: unknown): string {
  return String(value ?? "").toLocaleLowerCase("en-US").normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(normalizedKey(left).split(" ").filter(Boolean));
  const b = new Set(normalizedKey(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / new Set([...a, ...b]).size;
}

function explicitEvidenceMatches(field: CvEvidenceField, value: string | null, evidence: CvProviderEvidence[], datePrecision: CvProviderCandidate["datePrecision"]): boolean {
  if (value === null || ["canonicalType", "categoryId"].includes(field)) return true;
  const excerpts = evidence.filter((item) => item.field === field && item.support === "EXPLICIT").map((item) => item.excerpt);
  if (!excerpts.length) return true;
  if (field === "startDate" || field === "endDate") {
    const year = value.slice(0, 4);
    if (datePrecision === "YEAR") return excerpts.some((excerpt) => excerpt.includes(year));
    return excerpts.some((excerpt) => excerpt.includes(year));
  }
  const normalizedValue = normalizedEvidenceText(value);
  return excerpts.some((excerpt) => {
    const normalizedExcerpt = normalizedEvidenceText(excerpt);
    return normalizedExcerpt.includes(normalizedValue) || tokenSimilarity(value, excerpt) >= 0.72;
  });
}

function duplicateEventIds(candidate: CvProviderCandidate, request: CvIntelligenceRequest): string[] {
  return request.existingEvents.filter((event) => {
    if (candidate.startDate && event.startDate.slice(0, 7) !== candidate.startDate.slice(0, 7)) return false;
    const titleScore = tokenSimilarity(candidate.title ?? "", event.title);
    const organizationScore = candidate.organization && event.organization
      ? tokenSimilarity(candidate.organization, event.organization)
      : 0;
    return titleScore >= 0.75 || (titleScore >= 0.5 && organizationScore >= 0.65);
  }).map((event) => event.id);
}

function evidenceConfidence(
  candidate: CvProviderCandidate,
  evidence: CvProviderEvidence[],
  missingFields: string[],
  duplicateOfEventIds: string[],
  correctedCategory: boolean,
): CvValidatedCandidate["confidence"] {
  const populated = ["title", "organization", "location", "country", "specialty", "experienceType", "startDate", "endDate", "canonicalType", "categoryId"]
    .filter((field) => field === "canonicalType" || field === "categoryId" || candidate[field as keyof CvProviderCandidate] !== null);
  const explicit = new Set(evidence.filter((item) => item.support === "EXPLICIT").map((item) => item.field));
  const inferred = new Set(evidence.filter((item) => item.support === "INFERRED").map((item) => item.field));
  const explicitlySupported = populated.filter((field) => explicit.has(field as CvEvidenceField)).length;
  let score = Math.round((explicitlySupported / Math.max(1, populated.length)) * 75);
  if (explicit.has("title")) score += 8;
  if (explicit.has("startDate")) score += 8;
  if (explicit.has("canonicalType") && explicit.has("categoryId")) score += 9;
  const reasons = [`${explicitlySupported}/${populated.length} populated fields have explicit source evidence.`];
  if (inferred.size) {
    score = Math.min(score, 79);
    reasons.push(`${inferred.size} field(s) rely on inference.`);
  }
  if (missingFields.length) {
    score = Math.min(score, 39);
    reasons.push(`Required review fields missing: ${missingFields.join(", ")}.`);
  }
  if (candidate.canonicalType === "UNCLASSIFIED") {
    score = Math.min(score, 39);
    reasons.push("Classification remains unresolved.");
  }
  if (duplicateOfEventIds.length) {
    score = Math.min(score, 69);
    reasons.push("A possible existing-event duplicate requires a student decision.");
  }
  if (correctedCategory) {
    score = Math.min(score, 69);
    reasons.push("The provider category conflicted with the canonical taxonomy and was corrected for review.");
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    level: score >= 85 ? "HIGH" : score >= 65 ? "MEDIUM" : score >= 40 ? "LOW" : "NEEDS_REVIEW",
    calibrationVersion: "evidence-v1",
    reasons,
  };
}

function parseCandidate(value: unknown, request: CvIntelligenceRequest): { localId: string; candidate: CvValidatedCandidate } | null {
  const item = asRecord(value);
  if (!item) return null;
  const localId = text(item.localId, 160);
  const canonicalTypeInput = text(item.canonicalType, 80);
  const categoryInput = text(item.categoryId, 80);
  const timelineKind = item.timelineKind === "duration" || item.timelineKind === "milestone" ? item.timelineKind : null;
  const classificationReason = text(item.classificationReason, 1_000);
  const evidenceInput = Array.isArray(item.evidence) && item.evidence.length <= 40 ? item.evidence : null;
  if (!localId || !canonicalTypeInput || !CANONICAL_TYPES.has(canonicalTypeInput) || !categoryInput || !CATEGORY_IDS.has(categoryInput) || !timelineKind || !classificationReason || !evidenceInput) return null;
  const blocks = new Map(request.blocks.map((block) => [block.id, block.text]));
  const evidence = evidenceInput.map((entry) => providerEvidence(entry, blocks));
  if (evidence.some((entry) => entry === null)) return null;
  const requiredEvidence = new Set((evidence as CvProviderEvidence[]).map((entry) => entry.field));
  if (!requiredEvidence.has("canonicalType") || !requiredEvidence.has("categoryId")) return null;

  const title = text(item.title, 500, true);
  const organization = text(item.organization, 500, true);
  const location = text(item.location, 500, true);
  const country = text(item.country, 200, true);
  const specialty = text(item.specialty, 200, true);
  const experienceType = text(item.experienceType, 200, true);
  const startDate = text(item.startDate, 10, true);
  const endDate = text(item.endDate, 10, true);
  if ((startDate && !DATE_PATTERN.test(startDate)) || (endDate && !DATE_PATTERN.test(endDate)) || (startDate && endDate && endDate < startDate)) return null;
  const datePrecision = ["DAY", "MONTH", "YEAR", "UNKNOWN"].includes(String(item.datePrecision))
    ? item.datePrecision as CvProviderCandidate["datePrecision"]
    : null;
  if (!datePrecision || typeof item.openEnded !== "boolean") return null;
  const uncertainty = stringArray(item.uncertainty, 20, 1_000);
  const warnings = stringArray(item.warnings, 20, 1_000);
  if (!uncertainty || !warnings) return null;
  const factualValues: Partial<Record<CvEvidenceField, string | null>> = {
    title,
    organization,
    location,
    country,
    specialty,
    experienceType,
    startDate,
    endDate,
  };
  if (Object.entries(factualValues).some(([field, value]) => !explicitEvidenceMatches(
    field as CvEvidenceField,
    value ?? null,
    evidence as CvProviderEvidence[],
    datePrecision,
  ))) return null;

  const classificationNormalization = normalizeExplicitServiceClassification(canonicalTypeInput, title);
  const canonicalType = classificationNormalization.canonicalType;
  const forcedCategory = FORCED_CATEGORY[canonicalType as CvProviderCandidate["canonicalType"]];
  const correctedCategory = Boolean(classificationNormalization.corrected || (forcedCategory && forcedCategory !== categoryInput));
  const categoryId = forcedCategory ?? categoryInput as CvCategoryId;
  const correctedWarnings = correctedCategory
    ? [...warnings, ...(classificationNormalization.warning ? [classificationNormalization.warning] : []), `Category corrected from ${categoryInput} to ${categoryId} by the canonical taxonomy.`]
    : warnings;
  const providerCandidate: CvProviderCandidate = {
    localId,
    canonicalType: canonicalType as CvProviderCandidate["canonicalType"],
    categoryId,
    timelineKind,
    title,
    organization,
    location,
    country,
    specialty,
    experienceType,
    startDate,
    endDate,
    datePrecision,
    openEnded: item.openEnded,
    classificationReason,
    evidence: evidence as CvProviderEvidence[],
    uncertainty,
    warnings: correctedWarnings,
  };
  const missingFields = [!title ? "title" : null, !startDate ? "startDate" : null].filter((field): field is string => Boolean(field));
  const duplicateOfEventIds = duplicateEventIds(providerCandidate, request);
  const fingerprint = sha256(stableStringify({
    source: request.source.sha256,
    type: canonicalType,
    categoryId,
    timelineKind,
    title: normalizedKey(title),
    organization: normalizedKey(organization),
    location: normalizedKey(location),
    country: normalizedKey(country),
    specialty: normalizedKey(specialty),
    experienceType: normalizedKey(experienceType),
    startDate,
    endDate,
    datePrecision,
    openEnded: providerCandidate.openEnded,
    blocks: [...new Set(providerCandidate.evidence.flatMap((entry) => entry.sourceBlockIds))].sort(),
  }));
  const confidence = evidenceConfidence(providerCandidate, providerCandidate.evidence, missingFields, duplicateOfEventIds, correctedCategory);
  const candidate: CvValidatedCandidate = {
    id: `cv_candidate_${fingerprint.slice(0, 24)}`,
    fingerprint,
    canonicalType: providerCandidate.canonicalType,
    categoryId: providerCandidate.categoryId,
    timelineKind,
    title,
    organization,
    location,
    country,
    specialty,
    experienceType,
    startDate,
    endDate,
    datePrecision,
    openEnded: providerCandidate.openEnded,
    classificationReason,
    evidence: providerCandidate.evidence,
    uncertainty,
    warnings: correctedWarnings,
    confidence,
    missingFields,
    duplicateOfEventIds,
    duplicateCandidateIds: [],
    safeToBulkAccept: false,
  };
  return { localId, candidate };
}

function mergeSourceIdenticalCandidate(
  target: CvValidatedCandidate,
  duplicate: CvValidatedCandidate,
): void {
  const evidence = new Map(target.evidence.map((item) => [stableStringify(item), item]));
  for (const item of duplicate.evidence) evidence.set(stableStringify(item), item);
  target.evidence = [...evidence.values()];
  target.uncertainty = [...new Set([...target.uncertainty, ...duplicate.uncertainty])];
  target.warnings = [...new Set([...target.warnings, ...duplicate.warnings])];
  target.missingFields = [...new Set([...target.missingFields, ...duplicate.missingFields])];
  target.duplicateOfEventIds = [...new Set([
    ...target.duplicateOfEventIds,
    ...duplicate.duplicateOfEventIds,
  ])];
  target.confidence.score = Math.min(target.confidence.score, duplicate.confidence.score);
  target.confidence.level = target.confidence.score >= 85
    ? "HIGH"
    : target.confidence.score >= 65
      ? "MEDIUM"
      : target.confidence.score >= 40
        ? "LOW"
        : "NEEDS_REVIEW";
  target.confidence.reasons = [...new Set([
    ...target.confidence.reasons,
    ...duplicate.confidence.reasons,
  ])];
}

function parseProviderSuggestion(value: unknown): CvProviderQualitySuggestion | null {
  const item = asRecord(value);
  if (!item) return null;
  const localId = text(item.localId, 160);
  const type = text(item.type, 80) as CvQualitySuggestionType | null;
  const severity = item.severity === "INFO" || item.severity === "REVIEW" ? item.severity : null;
  const candidateIds = stringArray(item.candidateIds, 20, 160);
  const eventIds = stringArray(item.eventIds, 20, 160);
  const sourceBlockIds = stringArray(item.sourceBlockIds, 20, 160);
  const reason = text(item.reason, 1_000);
  const recommendation = text(item.recommendation, 1_000);
  if (!localId || !type || !QUALITY_TYPES.has(type) || !severity || !candidateIds || !eventIds || !sourceBlockIds || !reason || !recommendation) return null;
  return { localId, type, severity, candidateIds, eventIds, sourceBlockIds, reason, recommendation };
}

function candidateDuplicates(candidates: CvValidatedCandidate[]): void {
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const a = candidates[left]!;
      const b = candidates[right]!;
      if (a.startDate && b.startDate && a.startDate.slice(0, 7) !== b.startDate.slice(0, 7)) continue;
      if (tokenSimilarity(a.title ?? "", b.title ?? "") < 0.75) continue;
      a.duplicateCandidateIds.push(b.id);
      b.duplicateCandidateIds.push(a.id);
    }
  }
}

function finalizeBulkSafety(candidate: CvValidatedCandidate): void {
  const explicit = new Set(candidate.evidence.filter((item) => item.support === "EXPLICIT").map((item) => item.field));
  candidate.safeToBulkAccept = candidate.confidence.level === "HIGH"
    && candidate.canonicalType !== "UNCLASSIFIED"
    && candidate.missingFields.length === 0
    && candidate.duplicateOfEventIds.length === 0
    && candidate.duplicateCandidateIds.length === 0
    && candidate.uncertainty.length === 0
    && candidate.warnings.length === 0
    && ["title", "startDate", "canonicalType", "categoryId"].every((field) => explicit.has(field as CvEvidenceField));
}

export function postValidateCvProviderResult(value: unknown, request: CvIntelligenceRequest): CvPostValidationResult {
  const result = asRecord(value);
  if (!result || !Array.isArray(result.candidates) || result.candidates.length > 500 || !Array.isArray(result.qualitySuggestions) || !Array.isArray(result.unresolvedQuestions)) {
    throw new TimelineError("CV_PROVIDER_OUTPUT_INVALID", "CV intelligence output is invalid.", 502);
  }
  const candidates: CvValidatedCandidate[] = [];
  const candidatesByFingerprint = new Map<string, CvValidatedCandidate>();
  const localIdMap = new Map<string, string>();
  let rejectedCandidateCount = 0;
  for (const input of result.candidates) {
    const parsed = parseCandidate(input, request);
    if (!parsed || localIdMap.has(parsed.localId)) {
      rejectedCandidateCount += 1;
      continue;
    }
    localIdMap.set(parsed.localId, parsed.candidate.id);
    const existing = candidatesByFingerprint.get(parsed.candidate.fingerprint);
    if (existing) {
      mergeSourceIdenticalCandidate(existing, parsed.candidate);
      continue;
    }
    candidatesByFingerprint.set(parsed.candidate.fingerprint, parsed.candidate);
    candidates.push(parsed.candidate);
  }
  candidateDuplicates(candidates);
  for (const candidate of candidates) finalizeBulkSafety(candidate);
  const unresolvedQuestions = stringArray(result.unresolvedQuestions, 100, 1_000);
  if (!unresolvedQuestions) throw new TimelineError("CV_PROVIDER_OUTPUT_INVALID", "CV intelligence questions are invalid.", 502);
  if (result.qualitySuggestions.length > 200) throw new TimelineError("CV_PROVIDER_OUTPUT_INVALID", "CV intelligence suggestions are invalid.", 502);
  const providerSuggestions = result.qualitySuggestions.map(parseProviderSuggestion).filter((item): item is CvProviderQualitySuggestion => item !== null);
  return {
    candidates,
    providerSuggestions,
    unresolvedQuestions,
    rejectedCandidateCount,
    localIdMap,
  };
}
