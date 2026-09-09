import type { FounderStandardRetrieval } from "./founder-standard-registry.js";
import type { TimelineDocument } from "../contracts/types.js";
import type {
  RescueVisualObject,
  RescueVisionObservation,
  TimelineRescueFormat,
} from "./timeline-rescue-schema.js";

export const TIMELINE_AI_WORKFLOW_SCHEMA_VERSION = "d1-timeline-ai-workflows.1" as const;
export const TIMELINE_QUALITY_PROMPT_VERSION = "d1-timeline-quality-guardian-ai.2" as const;
export const TIMELINE_RESCUE_PROMPT_VERSION = "d1-timeline-rescue-ai.1" as const;
export const MISSIONMED_TIMELINE_STANDARD_VERSION = "D1-TIMELINE-FOUNDER-REANCHOR-015+DR-127" as const;
export const TIMELINE_FOUNDER_PREFERENCE_AUTHORITY_SOURCE = "MISSIONMED_SERVER_APPROVED" as const;

export const TIMELINE_QUALITY_CATEGORIES = [
  "CONTENT",
  "CHRONOLOGY",
  "LAYOUT",
  "READABILITY",
  "MISSIONMED_FORMAT",
  "EXPORT",
] as const;

export type TimelineQualityCategory = typeof TIMELINE_QUALITY_CATEGORIES[number];

export interface TimelineFounderPreferenceRule {
  id: string;
  kind: "CATEGORY_CORRECTION" | "LABEL_CONVENTION" | "VISIBILITY_CONVENTION" | "LAYOUT_PREFERENCE" | "PRESENTATION_CORRECTION";
  version: number;
  payload: Readonly<Record<string, string | number>>;
  approvalRef: string;
  authoritySource: typeof TIMELINE_FOUNDER_PREFERENCE_AUTHORITY_SOURCE;
}

type QualityDatePrecision = "DAY" | "MONTH" | "YEAR" | "UNKNOWN" | null;
type QualityEventDetails = Record<"siteName" | "organization" | "institution" | "medicalSchool" | "degree" | "journal", string | null>;

export interface TimelineQualityAiInput {
  documentId: string;
  documentRevision: number;
  events: Array<{
    id: string;
    title: string;
    categoryId: string;
    startDate: string;
    endDate: string | null;
    visibilityState: string;
    provenancePresent: boolean;
    eventType: "bar" | "duration" | "milestone" | null;
    openEnded: boolean | null;
    canonicalType: string | null;
    datePrecision: { start: QualityDatePrecision; end: QualityDatePrecision };
    details: QualityEventDetails;
    sourceSupport: { basis: "DOCUMENT_PROVENANCE_ONLY"; citedReferenceCount: number; fieldsMatchedToCitedText: Array<keyof QualityEventDetails> };
  }>;
  educationContext?: { medicalSchool: string; scope: "PROFILE_ONLY_NOT_EVENT_ASSIGNMENT"; basis: "DOCUMENT_PROVENANCE_ONLY"; citedReferenceCount: number };
  presentation: {
    theme: string;
    backgroundKind: string | null;
    advancedObjectCount: number;
    deterministicFindings: Array<{
      id: string;
      category: TimelineQualityCategory;
      code: string;
      severity: "BLOCK_EXPORT" | "REVIEW" | "INFO";
      elementIds: string[];
      message: string;
    }>;
  };
  standard: {
    version: typeof MISSIONMED_TIMELINE_STANDARD_VERSION;
    requirements: readonly string[];
    founderPreferences: readonly TimelineFounderPreferenceRule[];
    approvedGuidance?: FounderStandardRetrieval;
  };
}

export interface TimelineQualityAiFinding {
  id: string;
  category: TimelineQualityCategory;
  code: string;
  severity: "BLOCK_EXPORT" | "REVIEW" | "INFO";
  basis: "SOURCE_FACT" | "AI_INFERENCE" | "PRESENTATION_RECOMMENDATION";
  elementIds: string[];
  message: string;
  recommendation: string;
  confidence: number;
  actionMode: "REVIEW" | "FIX_FOR_ME";
  fixKind: "AUTO_ARRANGE_EVENTS" | "CLAMP_OBJECTS" | "RESTORE_THEME_BACKGROUND" | "RESTORE_DEFAULT_THEME" | null;
}

export interface TimelineQualityAiResult {
  findings: TimelineQualityAiFinding[];
  unresolvedQuestions: string[];
}

export interface TimelineRescueAiInput {
  founderStandards?: FounderStandardRetrieval;
  artifactSha256: string;
  format: Exclude<TimelineRescueFormat, "KEYNOTE">;
  pageOrSlideCount: number;
  objects: RescueVisualObject[];
  image?: {
    mimeType: "image/png" | "image/jpeg";
    bytes: Uint8Array;
  } | null;
  pdf?: {
    mimeType: "application/pdf";
    bytes: Uint8Array;
  } | null;
}

export interface TimelineRescueAiResult {
  observations: RescueVisionObservation[];
  unresolvedQuestions: string[];
}

export const TIMELINE_QUALITY_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings", "unresolvedQuestions"],
  properties: {
    findings: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "category", "code", "severity", "basis", "elementIds", "message", "recommendation", "confidence", "actionMode", "fixKind"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 160 },
          category: { type: "string", enum: [...TIMELINE_QUALITY_CATEGORIES] },
          code: { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Z0-9_]+$" },
          severity: { type: "string", enum: ["BLOCK_EXPORT", "REVIEW", "INFO"] },
          basis: { type: "string", enum: ["SOURCE_FACT", "AI_INFERENCE", "PRESENTATION_RECOMMENDATION"] },
          elementIds: { type: "array", maxItems: 100, items: { type: "string", minLength: 1, maxLength: 160 } },
          message: { type: "string", minLength: 1, maxLength: 1_000 },
          recommendation: { type: "string", minLength: 1, maxLength: 1_000 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          actionMode: { type: "string", enum: ["REVIEW", "FIX_FOR_ME"] },
          fixKind: { anyOf: [{ type: "string", enum: ["AUTO_ARRANGE_EVENTS", "CLAMP_OBJECTS", "RESTORE_THEME_BACKGROUND", "RESTORE_DEFAULT_THEME"] }, { type: "null" }] },
        },
      },
    },
    unresolvedQuestions: { type: "array", maxItems: 50, items: { type: "string", minLength: 1, maxLength: 1_000 } },
  },
} as const;

export const TIMELINE_RESCUE_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["observations", "unresolvedQuestions"],
  properties: {
    observations: {
      type: "array",
      maxItems: 2_000,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "pageOrSlide", "text", "geometry", "confidence"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 160 },
          pageOrSlide: { type: "integer", minimum: 1, maximum: 500 },
          text: { type: "string", minLength: 1, maxLength: 2_000 },
          geometry: {
            anyOf: [{
              type: "object",
              additionalProperties: false,
              required: ["x", "y", "width", "height", "unit"],
              properties: {
                x: { type: "number", minimum: 0 },
                y: { type: "number", minimum: 0 },
                width: { type: "number", minimum: 0 },
                height: { type: "number", minimum: 0 },
                unit: { type: "string", enum: ["PDF_POINT", "NORMALIZED"] },
              },
            }, { type: "null" }],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    unresolvedQuestions: { type: "array", maxItems: 50, items: { type: "string", minLength: 1, maxLength: 1_000 } },
  },
} as const;

export const MISSIONMED_TIMELINE_STANDARD_REQUIREMENTS = Object.freeze([
  "Use the checksum-bound 2025 Founder Keynote as the canonical MissionMed presentation authority, preserving the recorded 2024 source lineage.",
  "Preserve its 1920 by 1080 landscape composition, MissionMed background, year ribbon, typography hierarchy, profile treatment, media rhythm, and intentional whitespace.",
  "Keep the six Founder Keynote Color Key category IDs and protected default order.",
  "Treat chronology as semantic evidence for initial composition, never as a fixed lane or swimlane constraint.",
  "Represent chronology faithfully and never silently change factual dates during presentation editing.",
  "Keep event arrows, milestone flags, labels, photos, logos, profile, and Color Key readable without collisions or clipping.",
  "Reject or explicitly review unresolved overlaps, missing provenance, or factual ambiguity before export.",
  "Export must serialize the same scene and preserve the composition, background, fonts, crop, grouping, and geometry visible on canvas.",
]);

function text(value: unknown, maximum: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

const FOUNDER_PREFERENCE_KINDS = new Set([
  "CATEGORY_CORRECTION",
  "LABEL_CONVENTION",
  "VISIBILITY_CONVENTION",
  "LAYOUT_PREFERENCE",
  "PRESENTATION_CORRECTION",
]);
const FOUNDER_PRESENTATION_FIXES = new Set([
  "AUTO_ARRANGE_EVENTS",
  "CLAMP_OBJECTS",
  "RESTORE_THEME_BACKGROUND",
  "RESTORE_DEFAULT_THEME",
]);

function safeFounderPreferencePayload(kind: string, input: unknown): Readonly<Record<string, string | number>> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  if (kind === "CATEGORY_CORRECTION") {
    const fromCategoryId = text(source.fromCategoryId, 80);
    const toCategoryId = text(source.toCategoryId, 80);
    return fromCategoryId && toCategoryId && fromCategoryId !== toCategoryId ? Object.freeze({ fromCategoryId, toCategoryId }) : null;
  }
  if (kind === "LABEL_CONVENTION") {
    const categoryId = text(source.categoryId, 80);
    const preferredLabel = text(source.preferredLabel, 120);
    return categoryId && preferredLabel ? Object.freeze({ categoryId, preferredLabel }) : null;
  }
  if (kind === "VISIBILITY_CONVENTION") {
    const eventType = text(source.eventType, 80).toUpperCase();
    const defaultVisibility = text(source.defaultVisibility, 40).toUpperCase();
    return eventType && ["PRIVATE", "ADVISOR", "INTERVIEWER"].includes(defaultVisibility)
      ? Object.freeze({ eventType, defaultVisibility })
      : null;
  }
  if (kind === "LAYOUT_PREFERENCE") {
    const objectKind = text(source.objectKind, 80).toUpperCase();
    const alignment = text(source.alignment, 20).toUpperCase();
    const minimumGap = Math.round(Number(source.minimumGap));
    return objectKind && ["LEFT", "CENTER", "RIGHT"].includes(alignment) && Number.isFinite(minimumGap) && minimumGap >= 0 && minimumGap <= 240
      ? Object.freeze({ objectKind, alignment, minimumGap })
      : null;
  }
  if (kind === "PRESENTATION_CORRECTION") {
    const fixKind = text(source.fixKind, 100).toUpperCase();
    return FOUNDER_PRESENTATION_FIXES.has(fixKind) ? Object.freeze({ fixKind }) : null;
  }
  return null;
}

export function sanitizeServerApprovedFounderPreferenceRules(value: unknown): TimelineFounderPreferenceRule[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item): TimelineFounderPreferenceRule[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const authoritySource = text(source.authoritySource, 80);
    const id = text(source.id, 160);
    const kind = text(source.kind, 80).toUpperCase();
    const version = Math.round(Number(source.version));
    const approvalRef = text(source.approvalRef, 200);
    const payload = safeFounderPreferencePayload(kind, source.payload);
    if (
      authoritySource !== TIMELINE_FOUNDER_PREFERENCE_AUTHORITY_SOURCE ||
      !id || !FOUNDER_PREFERENCE_KINDS.has(kind) || !Number.isInteger(version) || version < 1 ||
      !approvalRef || !payload
    ) return [];
    return [Object.freeze({
      id,
      kind: kind as TimelineFounderPreferenceRule["kind"],
      version,
      payload,
      approvalRef,
      authoritySource: TIMELINE_FOUNDER_PREFERENCE_AUTHORITY_SOURCE,
    })];
  });
}

function qualityRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function qualityFactText(value: unknown, maximum = 300): string | null {
  if (typeof value !== "string") return null;
  const bounded = text(value, maximum)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[contact omitted]")
    .replace(/(?:https?:\/\/|data:)[^\s]+/gi, "[link omitted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[credential omitted]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[credential omitted]")
    .replace(/Bearer\s+\S+/gi, "[credential omitted]");
  return bounded || null;
}

function qualityPrecision(value: unknown): QualityDatePrecision {
  const candidate = typeof value === "string" ? value.toUpperCase() : "";
  return ["DAY", "MONTH", "YEAR", "UNKNOWN"].includes(candidate) ? candidate as QualityDatePrecision : null;
}

function eventPrecision(event: Record<string, unknown>, fields: Record<string, unknown>, edge: "start" | "end"): QualityDatePrecision {
  // Current explicit event precision wins; historical AI interpretations are not current facts.
  const source = event.datePrecision ?? fields.datePrecision;
  if (source != null) return qualityPrecision(typeof source === "string" ? source : qualityRecord(source)[edge]);
  // The guided clinical Builder stores its current exact-day contract in rotation fields.
  if (event.categoryId === "clinical") {
    if (fields.rotationDatePrecision === "day") return "DAY";
    if (fields.rotationDatePrecision === "month-legacy") return "MONTH";
    if (fields.rotationDatePrecision === "unknown") return "UNKNOWN";
  }
  return null;
}

function validQualityDate(value: unknown): string {
  // Stored canonical dates are ISO dates, not free text. Reject invalid days instead of normalizing them.
  if (typeof value !== "string" || value.length > 10 || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return "";
  const year = Number(value.slice(0, 4));
  if (year < 1) return "";
  if (value.length === 4) return value;
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return "";
  if (value.length === 7) return value;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  const day = Number(value.slice(8, 10));
  return day >= 1 && day <= days ? value : "";
}

function qualityDate(event: Record<string, unknown>, fields: Record<string, unknown>, edge: "start" | "end"): { value: string; precision: QualityDatePrecision } {
  const precision = eventPrecision(event, fields, edge);
  const raw = validQualityDate(event[`${edge}Date`]);
  if (!raw) return { value: "", precision: precision === null ? null : "UNKNOWN" };
  // Exact clinical dates supplement only their matching month anchors and explicit DAY contract.
  // A later coarser edit, another month, or missing canonical end must never resurrect old dates.
  if (precision === "DAY" && event.categoryId === "clinical" && raw.length === 7) {
    const exact = validQualityDate(fields[edge === "start" ? "rotationStartDate" : "rotationEndDate"]);
    if (exact.length === 10 && exact.slice(0, 7) === raw) return { value: exact, precision: "DAY" };
  }
  // January/December anchors must not become source months; absent days must not be labeled DAY.
  if (precision === "YEAR") return { value: raw.slice(0, 4), precision };
  if (precision === "MONTH" || precision === "DAY") {
    if (raw.length === 4) return { value: raw, precision: "YEAR" };
    if (precision === "MONTH" || raw.length === 7) return { value: raw.slice(0, 7), precision: "MONTH" };
  }
  return { value: raw, precision };
}

function qualityEvidence(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const excerpts: string[] = [];
  for (const value of values) {
    for (const item of (Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []).slice(0, 16)) {
      const source = qualityRecord(item);
      const excerpt = typeof source.sourceExcerpt === "string" ? text(source.sourceExcerpt, 1_000) : "";
      if (typeof source.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sourceSha256)
          || typeof source.sourceBlockId !== "string" || !/^[A-Za-z0-9_.:-]{1,160}$/.test(source.sourceBlockId)
          || !Number.isInteger(source.pageNumber) || Number(source.pageNumber) < 1 || Number(source.pageNumber) > 10_000 || !excerpt) continue;
      const identity = `${source.sourceSha256}:${source.sourceBlockId}:${source.pageNumber}:${excerpt}`;
      if (seen.has(identity)) continue;
      seen.add(identity); excerpts.push(excerpt);
      if (excerpts.length === 16) return excerpts;
    }
  }
  // Excerpts are used locally for bounded exact-value support checks, never sent to the provider.
  return excerpts;
}

function matchesSource(value: string | null, excerpts: string[]): boolean {
  if (!value || value.includes("[contact omitted]") || value.includes("[link omitted]") || value.includes("[credential omitted]")) return false;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
  return excerpts.some((excerpt) => pattern.test(excerpt));
}

export function qualityInputFromDocument(
  document: TimelineDocument,
  deterministicFindings: TimelineQualityAiInput["presentation"]["deterministicFindings"] = [],
  serverApprovedFounderPreferences: unknown = [],
): TimelineQualityAiInput {
  const advanced = qualityRecord(document.advanced);
  const background = qualityRecord(advanced.background);
  const events: TimelineQualityAiInput["events"] = document.events.slice(0, 1_000).map((event) => {
    const fields = qualityRecord(event.fields);
    const start = qualityDate(event, fields, "start");
    const end = event.endDate ? qualityDate(event, fields, "end") : null;
    const eventType = ["bar", "duration", "milestone"].includes(String(event.eventType))
      ? event.eventType as "bar" | "duration" | "milestone" : null;
    const rawType = typeof event.canonicalType === "string" ? event.canonicalType : fields.canonicalType;
    const canonicalType = typeof rawType === "string" && /^[A-Z0-9_]{1,80}$/.test(rawType) ? rawType : null;
    const details: QualityEventDetails = {
      siteName: qualityFactText(event.siteName),
      organization: qualityFactText(fields.organization),
      institution: qualityFactText(fields.institution),
      medicalSchool: qualityFactText(fields.medicalSchool),
      degree: qualityFactText(fields.degree, 120),
      journal: qualityFactText(fields.journal),
    };
    const excerpts = qualityEvidence(event.provenance, fields.sourceProvenance);
    return {
      id: text(event.id, 160), title: text(event.title, 500), categoryId: text(event.categoryId, 100),
      startDate: start.value,
      endDate: end?.value || null,
      visibilityState: text(event.visibilityState, 64),
      provenancePresent: [event.provenance, fields.sourceProvenance].some((value) => Array.isArray(value)
        ? value.some((item) => Object.keys(qualityRecord(item)).length > 0) : Object.keys(qualityRecord(value)).length > 0),
      eventType, openEnded: typeof event.openEnded === "boolean" ? event.openEnded : null,
      canonicalType, datePrecision: { start: start.precision, end: end?.precision ?? null }, details,
      sourceSupport: { basis: "DOCUMENT_PROVENANCE_ONLY", citedReferenceCount: excerpts.length,
        fieldsMatchedToCitedText: (Object.keys(details) as Array<keyof QualityEventDetails>).filter((key) => matchesSource(details[key], excerpts)) },
    };
  });
  const needsEducationContext = events.some((event) => (event.categoryId === "education" || ["MEDICAL_DEGREE", "GRADUATION"].includes(event.canonicalType ?? ""))
    && ![event.details.siteName, event.details.organization, event.details.institution, event.details.medicalSchool].some(Boolean));
  const profile = qualityRecord(document.studentProfile);
  const medicalSchool = qualityFactText(profile.medicalSchool);
  const schoolEvidence = needsEducationContext
    ? qualityEvidence(qualityRecord(qualityRecord(profile.fieldProvenance).medicalSchool).provenance) : [];
  return {
    documentId: text(document.id, 160),
    documentRevision: Number.isInteger(document.revision) ? document.revision : 0,
    events,
    ...(needsEducationContext && medicalSchool && matchesSource(medicalSchool, schoolEvidence)
      ? { educationContext: { medicalSchool, scope: "PROFILE_ONLY_NOT_EVENT_ASSIGNMENT" as const, basis: "DOCUMENT_PROVENANCE_ONLY" as const, citedReferenceCount: schoolEvidence.length } } : {}),
    presentation: {
      theme: text(document.theme, 100),
      backgroundKind: background.kind ? text(background.kind, 64) : null,
      advancedObjectCount: [advanced.media, advanced.textBlocks, advanced.elements]
        .map((value) => Array.isArray(value) ? value.length : 0)
        .reduce((total, count) => total + count, 0),
      deterministicFindings: deterministicFindings.slice(0, 100),
    },
    standard: {
      version: MISSIONMED_TIMELINE_STANDARD_VERSION,
      requirements: MISSIONMED_TIMELINE_STANDARD_REQUIREMENTS,
      founderPreferences: sanitizeServerApprovedFounderPreferenceRules(serverApprovedFounderPreferences),
    },
  };
}
