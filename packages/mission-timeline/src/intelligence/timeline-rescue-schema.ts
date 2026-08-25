export const TIMELINE_RESCUE_SCHEMA_VERSION = "d1-timeline-rescue-1" as const;

export type TimelineRescueFormat = "PPTX" | "PDF" | "IMAGE" | "KEYNOTE";
export type TimelineRescueCategoryId = "education" | "usmle" | "th" | "cl" | "res" | "work" | "personal" | "unclassified";

export interface RescueGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "EMU" | "PDF_POINT" | "NORMALIZED";
}

export interface RescueSourceEvidence {
  evidenceId: string;
  artifactSha256: string;
  format: Exclude<TimelineRescueFormat, "KEYNOTE">;
  pageOrSlide: number;
  objectId: string;
  extractionMethod: "PPTX_OOXML" | "PDF_TEXT_OPERATOR" | "OCR_OR_VISION_OBSERVATION";
  support: "SOURCE_FACT" | "GEOMETRY_INFERENCE" | "VISION_OBSERVATION";
  sourceText: string;
  geometry: RescueGeometry | null;
  confidence: number;
}

export interface RescueVisualObject {
  id: string;
  pageOrSlide: number;
  kind: "TEXT" | "SHAPE" | "LINE" | "IMAGE" | "GROUP";
  name: string | null;
  text: string | null;
  geometry: RescueGeometry | null;
  groupId: string | null;
  zIndex: number;
  fill: string | null;
  stroke: string | null;
  fontFamily: string | null;
  fontSizePt: number | null;
  relationshipTarget: string | null;
  mediaSha256: string | null;
  sourceConfidence?: number | null;
}

export interface RescueVisionObservation {
  id: string;
  pageOrSlide: number;
  text: string;
  geometry?: Omit<RescueGeometry, "unit"> & { unit?: "PDF_POINT" | "NORMALIZED" };
  confidence: number;
}

export interface TimelineRescueSource {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  /**
   * OCR/vision output supplied by the authenticated server-side document-understanding seam.
   * The rescue module never manufactures these observations and binds every derived field to one.
   */
  visualObservations?: RescueVisionObservation[];
}

export interface RescueSemanticCandidate {
  id: string;
  title: string;
  categoryId: TimelineRescueCategoryId;
  timelineKind: "duration" | "milestone";
  startDate: string;
  endDate: string | null;
  location: string | null;
  institution: string | null;
  confidence: {
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW" | "NEEDS_REVIEW";
    reasons: string[];
  };
  provenance: RescueSourceEvidence[];
  uncertainties: string[];
  reviewState: "REQUIRED";
  safeToAutoAccept: false;
}

export interface RescueCleanupAction {
  id: string;
  kind:
    | "RESTORE_CANONICAL_BACKGROUND"
    | "RESTORE_CANONICAL_FURNITURE"
    | "REBUILD_SEMANTIC_EVENT"
    | "NORMALIZE_TYPOGRAPHY"
    | "ALIGN_TO_CHRONOLOGY"
    | "RESOLVE_LAYOUT_COLLISION";
  scope: "PRESENTATION_ONLY";
  reason: string;
  candidateIds: string[];
  requiresReview: true;
  changesBiography: false;
}

export interface RescueCleanupProposal {
  authority: "MISSIONMED_FOUNDER_KEYNOTE_2024_CANONICAL_PRESENTATION";
  mode: "PROPOSAL_ONLY";
  factualMutationAllowed: false;
  actions: RescueCleanupAction[];
}

export interface RescueCvCandidate {
  id: string;
  title: string;
  categoryId: string;
  startDate: string | null;
  endDate: string | null;
  provenance?: unknown;
}

export interface RescueReconciliationItem {
  timelineCandidateId: string | null;
  cvCandidateId: string | null;
  state: "MATCH" | "DATE_CONFLICT" | "CATEGORY_CONFLICT" | "TIMELINE_ONLY" | "CV_ONLY";
  authority: "CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION";
  recommendation: string;
  requiresReview: true;
}

export interface TimelineRescueResult {
  schemaVersion: typeof TIMELINE_RESCUE_SCHEMA_VERSION;
  format: TimelineRescueFormat;
  artifactSha256: string;
  extractionStatus: "STRUCTURED" | "LIMITED" | "VISION_REQUIRED" | "UNSUPPORTED_KEYNOTE";
  slideOrPageCount: number;
  slideSize: { width: number; height: number; unit: "EMU" } | null;
  objects: RescueVisualObject[];
  evidence: RescueSourceEvidence[];
  candidates: RescueSemanticCandidate[];
  cleanupProposal: RescueCleanupProposal;
  reconciliation: RescueReconciliationItem[];
  warnings: string[];
  unresolvedQuestions: string[];
  keynoteGuidance: string | null;
  integrationHook: "SERVER_AUTHENTICATED_REVIEW_QUEUE";
}
