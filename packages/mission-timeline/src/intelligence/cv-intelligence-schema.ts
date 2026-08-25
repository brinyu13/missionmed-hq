import { TimelineError } from "../core/errors.js";

export const CV_INTELLIGENCE_SCHEMA_VERSION = "d1-timeline-cv-intelligence-2" as const;
export const CV_INTELLIGENCE_PROMPT_VERSION = "d1-timeline-cv-prompt-3" as const;

export const CV_CANONICAL_TYPES = [
  "EDUCATION",
  "MEDICAL_DEGREE",
  "GRADUATION",
  "STEP_1",
  "STEP_2_CK",
  "STEP_3",
  "USMLE_STUDY_PERIOD",
  "ECFMG_CERTIFICATION",
  "APPLICATION_CYCLE",
  "INTERVIEW",
  "MOVE_TO_USA",
  "RESIDENCY_FELLOWSHIP",
  "INTERNSHIP_HOUSE_OFFICER",
  "OBSERVERSHIP",
  "EXTERNSHIP",
  "SUB_INTERNSHIP",
  "CLERKSHIP",
  "USCE_CLINIC",
  "USCE_TEACHING_HOSPITAL",
  "PUBLICATION",
  "ABSTRACT_POSTER_PRESENTATION",
  "RESEARCH_EXPERIENCE",
  "VOLUNTEER_EXPERIENCE",
  "LEADERSHIP",
  "WORK_EXPERIENCE",
  "AWARD_HONOR",
  "CERTIFICATION",
  "PERSONAL_NOT_ON_CV",
  "UNCLASSIFIED",
] as const;

export const CV_CATEGORY_IDS = ["education", "usmle", "th", "cl", "res", "work", "personal"] as const;
export const CV_EVIDENCE_FIELDS = [
  "title",
  "organization",
  "location",
  "country",
  "specialty",
  "experienceType",
  "startDate",
  "endDate",
  "canonicalType",
  "categoryId",
] as const;

export type CvCanonicalType = (typeof CV_CANONICAL_TYPES)[number];
export type CvCategoryId = (typeof CV_CATEGORY_IDS)[number];
export type CvEvidenceField = (typeof CV_EVIDENCE_FIELDS)[number];
export type CvDocumentType = "CV" | "RESUME" | "MYERAS" | "OTHER";

export interface CvSourceReference {
  objectId: string;
  sha256: string;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  /** Student-visible label only. The provider receives the hash, not this name. */
  fileName?: string | null;
}

export interface CvSourceBlock {
  id: string;
  pageNumber: number | null;
  section: string | null;
  text: string;
}

export interface CvExistingEventSummary {
  id: string;
  title: string;
  categoryId: string;
  startDate: string;
  endDate: string | null;
  organization: string | null;
}

export interface CvIntelligenceRequest {
  source: CvSourceReference;
  blocks: CvSourceBlock[];
  documentType: CvDocumentType;
  existingEvents: CvExistingEventSummary[];
  consentVersion: string;
  idempotencyKey: string;
}

export interface CvProviderEvidence {
  field: CvEvidenceField;
  sourceBlockIds: string[];
  excerpt: string;
  support: "EXPLICIT" | "INFERRED";
  reason: string;
  uncertainty: string | null;
}

export interface CvProviderCandidate {
  localId: string;
  canonicalType: CvCanonicalType;
  categoryId: CvCategoryId;
  timelineKind: "duration" | "milestone";
  title: string | null;
  organization: string | null;
  location: string | null;
  country: string | null;
  specialty: string | null;
  experienceType: string | null;
  startDate: string | null;
  endDate: string | null;
  datePrecision: "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
  openEnded: boolean;
  classificationReason: string;
  evidence: CvProviderEvidence[];
  uncertainty: string[];
  warnings: string[];
}

export type CvQualitySuggestionType =
  | "POSSIBLE_DUPLICATE"
  | "CATEGORY_REVIEW"
  | "CHRONOLOGY_REVIEW"
  | "MISSING_END_DATE"
  | "SOURCE_ITEM_NOT_INCLUDED"
  | "LABEL_READABILITY"
  | "VISUAL_OVERLAP";

export interface CvProviderQualitySuggestion {
  localId: string;
  type: CvQualitySuggestionType;
  severity: "INFO" | "REVIEW";
  candidateIds: string[];
  eventIds: string[];
  sourceBlockIds: string[];
  reason: string;
  recommendation: string;
}

export interface CvProviderResult {
  candidates: CvProviderCandidate[];
  qualitySuggestions: CvProviderQualitySuggestion[];
  unresolvedQuestions: string[];
}

export interface CvValidatedCandidate extends Omit<CvProviderCandidate, "localId"> {
  id: string;
  fingerprint: string;
  confidence: {
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW" | "NEEDS_REVIEW";
    calibrationVersion: "evidence-v1";
    reasons: string[];
  };
  missingFields: string[];
  duplicateOfEventIds: string[];
  duplicateCandidateIds: string[];
  safeToBulkAccept: boolean;
  normalizedInterpretation: {
    canonicalType: CvCanonicalType;
    categoryId: CvCategoryId;
    timelineKind: "duration" | "milestone";
    title: string | null;
    organization: string | null;
    location: string | null;
    country: string | null;
    specialty: string | null;
    experienceType: string | null;
    startDate: string | null;
    endDate: string | null;
    datePrecision: "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
    openEnded: boolean;
  };
  provenance: Array<{
    sourceObjectId: string;
    sourceSha256: string;
    sourceFileName: string | null;
    sourceBlockId: string;
    pageNumber: number | null;
    section: string | null;
    excerpt: string;
    charStart: number;
    charEnd: number;
    fields: CvEvidenceField[];
    support: "EXPLICIT" | "INFERRED";
    reason: string;
    uncertainty: string | null;
  }>;
  review: {
    lane: "HIGH" | "MEDIUM" | "LOW";
    action: "BULK_ACCEPT" | "QUICK_CONFIRM" | "TARGETED_QUESTION";
    requiredFields: string[];
    smallestQuestion: string | null;
  };
}

export interface CvQualitySuggestion extends Omit<CvProviderQualitySuggestion, "localId"> {
  id: string;
  source: "DETERMINISTIC" | "AI_REVIEW";
  actionMode: "ACCEPT_EDIT_DISMISS";
}

export interface CvIntelligenceResponse {
  analysisId: string;
  status: "COMPLETE" | "LIMITED_FALLBACK_REQUIRED";
  mode: "SERVER_AI" | "LOCAL_LIMITED";
  provider: string | null;
  model: string | null;
  schemaVersion: typeof CV_INTELLIGENCE_SCHEMA_VERSION;
  promptVersion: typeof CV_INTELLIGENCE_PROMPT_VERSION;
  sourceSha256: string;
  candidates: CvValidatedCandidate[];
  qualitySuggestions: CvQualitySuggestion[];
  unresolvedQuestions: string[];
  rejectedCandidateCount: number;
  fallbackReason:
    | "UNCONFIGURED"
    | "PROVIDER_UNAVAILABLE"
    | "INVALID_PROVIDER_OUTPUT"
    | "OCR_REQUIRED"
    | "AI_AUTHORIZATION_REQUIRED"
    | null;
  reviewSummary: {
    high: number;
    medium: number;
    low: number;
    bulkAcceptable: number;
  };
  prefillSummary: {
    timelineEvents: number;
    profileCandidates: number;
    examCandidates: number;
  };
}

const ID_PATTERN = /^[-_a-zA-Z0-9:.]{1,160}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/;
const MIME_TYPES = new Set<CvSourceReference["mimeType"]>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TimelineError(code, "CV intelligence input is invalid.", 400);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code: string, maxLength: number): string {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) throw new TimelineError(code, "CV intelligence input is invalid.", 400);
  return text;
}

function nullableString(value: unknown, code: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(value, code, maxLength);
}

export function parseCvIntelligenceRequest(value: unknown): CvIntelligenceRequest {
  const input = record(value, "CV_INTELLIGENCE_REQUEST_INVALID");
  const sourceInput = record(input.source, "CV_SOURCE_INVALID");
  const objectId = requiredString(sourceInput.objectId, "CV_SOURCE_OBJECT_INVALID", 160);
  if (!ID_PATTERN.test(objectId)) throw new TimelineError("CV_SOURCE_OBJECT_INVALID", "CV source object is invalid.", 400);
  const sourceSha256 = requiredString(sourceInput.sha256, "CV_SOURCE_HASH_INVALID", 64).toLowerCase();
  if (!SHA256_PATTERN.test(sourceSha256)) throw new TimelineError("CV_SOURCE_HASH_INVALID", "CV source hash is invalid.", 400);
  const mimeType = requiredString(sourceInput.mimeType, "CV_SOURCE_MIME_INVALID", 120) as CvSourceReference["mimeType"];
  if (!MIME_TYPES.has(mimeType)) throw new TimelineError("CV_SOURCE_MIME_INVALID", "CV source type is invalid.", 400);
  const fileName = nullableString(sourceInput.fileName, "CV_SOURCE_FILE_NAME_INVALID", 500);

  if (!Array.isArray(input.blocks) || input.blocks.length < 1 || input.blocks.length > 500) {
    throw new TimelineError("CV_SOURCE_BLOCKS_INVALID", "CV source blocks are invalid.", 400);
  }
  const seen = new Set<string>();
  let totalCharacters = 0;
  const blocks = input.blocks.map((item) => {
    const block = record(item, "CV_SOURCE_BLOCK_INVALID");
    const id = requiredString(block.id, "CV_SOURCE_BLOCK_ID_INVALID", 160);
    if (!ID_PATTERN.test(id) || seen.has(id)) throw new TimelineError("CV_SOURCE_BLOCK_ID_INVALID", "CV source block ID is invalid.", 400);
    seen.add(id);
    const text = requiredString(block.text, "CV_SOURCE_BLOCK_TEXT_INVALID", 20_000);
    totalCharacters += text.length;
    const pageNumber = block.pageNumber === null || block.pageNumber === undefined ? null : Number(block.pageNumber);
    if (pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 500)) {
      throw new TimelineError("CV_SOURCE_BLOCK_PAGE_INVALID", "CV source block page is invalid.", 400);
    }
    return { id, pageNumber, section: nullableString(block.section, "CV_SOURCE_BLOCK_SECTION_INVALID", 200), text };
  });
  if (totalCharacters > 300_000) throw new TimelineError("CV_SOURCE_TEXT_TOO_LARGE", "CV source text is too large.", 413);

  const documentType = requiredString(input.documentType, "CV_DOCUMENT_TYPE_INVALID", 20).toUpperCase() as CvDocumentType;
  if (!["CV", "RESUME", "MYERAS", "OTHER"].includes(documentType)) {
    throw new TimelineError("CV_DOCUMENT_TYPE_INVALID", "CV document type is invalid.", 400);
  }
  const existingEvents = Array.isArray(input.existingEvents) ? input.existingEvents.map((item) => {
    const event = record(item, "CV_EXISTING_EVENT_INVALID");
    const startDate = requiredString(event.startDate, "CV_EXISTING_EVENT_DATE_INVALID", 10);
    const endDate = nullableString(event.endDate, "CV_EXISTING_EVENT_DATE_INVALID", 10);
    if (!DATE_PATTERN.test(startDate) || (endDate && !DATE_PATTERN.test(endDate))) {
      throw new TimelineError("CV_EXISTING_EVENT_DATE_INVALID", "Existing event date is invalid.", 400);
    }
    return {
      id: requiredString(event.id, "CV_EXISTING_EVENT_ID_INVALID", 160),
      title: requiredString(event.title, "CV_EXISTING_EVENT_TITLE_INVALID", 500),
      categoryId: requiredString(event.categoryId, "CV_EXISTING_EVENT_CATEGORY_INVALID", 80),
      startDate,
      endDate,
      organization: nullableString(event.organization, "CV_EXISTING_EVENT_ORGANIZATION_INVALID", 500),
    };
  }) : [];
  if (existingEvents.length > 1_000) throw new TimelineError("CV_EXISTING_EVENTS_TOO_LARGE", "Too many existing events were supplied.", 413);

  const consentVersion = requiredString(input.consentVersion, "CV_AI_CONSENT_REQUIRED", 120);
  const idempotencyKey = requiredString(input.idempotencyKey, "CV_IDEMPOTENCY_KEY_INVALID", 160);
  if (!ID_PATTERN.test(idempotencyKey)) throw new TimelineError("CV_IDEMPOTENCY_KEY_INVALID", "CV idempotency key is invalid.", 400);
  return {
    source: { objectId, sha256: sourceSha256, mimeType, fileName },
    blocks,
    documentType,
    existingEvents,
    consentVersion,
    idempotencyKey,
  };
}

export const CV_PROVIDER_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "qualitySuggestions", "unresolvedQuestions"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["localId", "canonicalType", "categoryId", "timelineKind", "title", "organization", "location", "country", "specialty", "experienceType", "startDate", "endDate", "datePrecision", "openEnded", "classificationReason", "evidence", "uncertainty", "warnings"],
        properties: {
          localId: { type: "string", minLength: 1, maxLength: 160 },
          canonicalType: { type: "string", enum: [...CV_CANONICAL_TYPES] },
          categoryId: { type: "string", enum: [...CV_CATEGORY_IDS] },
          timelineKind: { type: "string", enum: ["duration", "milestone"] },
          title: { type: ["string", "null"], maxLength: 500 },
          organization: { type: ["string", "null"], maxLength: 500 },
          location: { type: ["string", "null"], maxLength: 500 },
          country: { type: ["string", "null"], maxLength: 200 },
          specialty: { type: ["string", "null"], maxLength: 200 },
          experienceType: { type: ["string", "null"], maxLength: 200 },
          startDate: { type: ["string", "null"], maxLength: 10 },
          endDate: { type: ["string", "null"], maxLength: 10 },
          datePrecision: { type: "string", enum: ["DAY", "MONTH", "YEAR", "UNKNOWN"] },
          openEnded: { type: "boolean" },
          classificationReason: { type: "string", minLength: 1, maxLength: 1000 },
          evidence: {
            type: "array",
            maxItems: 40,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "sourceBlockIds", "excerpt", "support", "reason", "uncertainty"],
              properties: {
                field: { type: "string", enum: [...CV_EVIDENCE_FIELDS] },
                sourceBlockIds: { type: "array", minItems: 1, maxItems: 10, items: { type: "string", minLength: 1, maxLength: 160 } },
                excerpt: { type: "string", minLength: 1, maxLength: 2000 },
                support: { type: "string", enum: ["EXPLICIT", "INFERRED"] },
                reason: { type: "string", minLength: 1, maxLength: 1000 },
                uncertainty: { type: ["string", "null"], maxLength: 1000 },
              },
            },
          },
          uncertainty: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 1000 } },
          warnings: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 1000 } },
        },
      },
    },
    qualitySuggestions: {
      type: "array",
      maxItems: 200,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["localId", "type", "severity", "candidateIds", "eventIds", "sourceBlockIds", "reason", "recommendation"],
        properties: {
          localId: { type: "string", minLength: 1, maxLength: 160 },
          type: { type: "string", enum: ["POSSIBLE_DUPLICATE", "CATEGORY_REVIEW", "CHRONOLOGY_REVIEW", "MISSING_END_DATE", "SOURCE_ITEM_NOT_INCLUDED", "LABEL_READABILITY", "VISUAL_OVERLAP"] },
          severity: { type: "string", enum: ["INFO", "REVIEW"] },
          candidateIds: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 160 } },
          eventIds: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 160 } },
          sourceBlockIds: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 160 } },
          reason: { type: "string", minLength: 1, maxLength: 1000 },
          recommendation: { type: "string", minLength: 1, maxLength: 1000 },
        },
      },
    },
    unresolvedQuestions: { type: "array", maxItems: 100, items: { type: "string", minLength: 1, maxLength: 1000 } },
  },
} as const;
