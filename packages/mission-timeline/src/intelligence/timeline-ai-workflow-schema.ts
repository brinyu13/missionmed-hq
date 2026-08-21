import type { TimelineDocument } from "../contracts/types.js";
import type {
  RescueVisualObject,
  RescueVisionObservation,
  TimelineRescueFormat,
} from "./timeline-rescue-schema.js";

export const TIMELINE_AI_WORKFLOW_SCHEMA_VERSION = "d1-timeline-ai-workflows.1" as const;
export const TIMELINE_QUALITY_PROMPT_VERSION = "d1-timeline-quality-guardian-ai.1" as const;
export const TIMELINE_RESCUE_PROMPT_VERSION = "d1-timeline-rescue-ai.1" as const;
export const MISSIONMED_TIMELINE_STANDARD_VERSION = "D1-409H-A1+D1-411A" as const;

export const TIMELINE_QUALITY_CATEGORIES = [
  "CONTENT",
  "CHRONOLOGY",
  "LAYOUT",
  "READABILITY",
  "MISSIONMED_FORMAT",
  "EXPORT",
] as const;

export type TimelineQualityCategory = typeof TIMELINE_QUALITY_CATEGORIES[number];

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
  }>;
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
  artifactSha256: string;
  format: Exclude<TimelineRescueFormat, "KEYNOTE">;
  pageOrSlideCount: number;
  objects: RescueVisualObject[];
  image?: {
    mimeType: "image/png" | "image/jpeg";
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
  "Use the canonical D1-409H-A1 MissionMed background and protected furniture.",
  "Preserve the accepted typography hierarchy and readable minimum text sizes.",
  "Keep the six canonical Color Key categories and their protected order.",
  "Keep titles, profile content, Color Key, and events inside protected safe zones.",
  "Represent chronology faithfully and never silently change factual dates.",
  "Keep event and milestone labels readable without collisions or clipping.",
  "Reject or explicitly review unresolved overlaps before export.",
  "Export must preserve the same composition, background, fonts, and geometry visible on canvas.",
]);

function text(value: unknown, maximum: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function qualityInputFromDocument(
  document: TimelineDocument,
  deterministicFindings: TimelineQualityAiInput["presentation"]["deterministicFindings"] = [],
): TimelineQualityAiInput {
  const advanced = document.advanced && typeof document.advanced === "object" ? document.advanced as Record<string, unknown> : {};
  const background = advanced.background && typeof advanced.background === "object" ? advanced.background as Record<string, unknown> : {};
  return {
    documentId: text(document.id, 160),
    documentRevision: Number.isInteger(document.revision) ? document.revision : 0,
    events: document.events.slice(0, 1_000).map((event) => ({
      id: text(event.id, 160),
      title: text(event.title, 500),
      categoryId: text(event.categoryId, 100),
      startDate: text(event.startDate, 32),
      endDate: event.endDate ? text(event.endDate, 32) : null,
      visibilityState: text(event.visibilityState, 64),
      provenancePresent: Boolean(event.provenance),
    })),
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
    },
  };
}
