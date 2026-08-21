import type { TimelineDocument } from "../contracts/types.js";
import { sha256, stableStringify } from "../core/canonical.js";
import { reviewMedicalEducationTimeline } from "../medical-education/reviewer.js";
import type {
  CvProviderQualitySuggestion,
  CvQualitySuggestion,
  CvQualitySuggestionType,
  CvSourceBlock,
  CvValidatedCandidate,
} from "./cv-intelligence-schema.js";

const PROVIDER_TYPES = new Set<CvQualitySuggestionType>([
  "POSSIBLE_DUPLICATE",
  "CATEGORY_REVIEW",
  "CHRONOLOGY_REVIEW",
  "MISSING_END_DATE",
  "SOURCE_ITEM_NOT_INCLUDED",
  "LABEL_READABILITY",
  "VISUAL_OVERLAP",
]);

function deterministicType(code: string): CvQualitySuggestionType {
  if (code.includes("OVERLAP")) return "VISUAL_OVERLAP";
  if (code.includes("CHRONOLOGY") || code.includes("DATE")) return "CHRONOLOGY_REVIEW";
  return "LABEL_READABILITY";
}

function suggestionId(value: unknown): string {
  return `cv_quality_${sha256(stableStringify(value)).slice(0, 24)}`;
}

export function buildCvQualitySuggestions(
  document: TimelineDocument,
  candidates: CvValidatedCandidate[],
  providerSuggestions: CvProviderQualitySuggestion[],
  blocks: CvSourceBlock[],
  localIdMap: Map<string, string>,
): CvQualitySuggestion[] {
  const findings = reviewMedicalEducationTimeline(document).findings.map((finding): CvQualitySuggestion => ({
    id: suggestionId({ source: "deterministic", code: finding.code, eventIds: finding.eventIds }),
    type: deterministicType(finding.code),
    severity: finding.severity === "INFO" ? "INFO" : "REVIEW",
    candidateIds: [],
    eventIds: finding.eventIds,
    sourceBlockIds: [],
    reason: finding.message,
    recommendation: finding.recommendation,
    source: "DETERMINISTIC",
    actionMode: "ACCEPT_EDIT_DISMISS",
  }));
  for (const candidate of candidates) {
    if (!candidate.duplicateOfEventIds.length && !candidate.duplicateCandidateIds.length) continue;
    findings.push({
      id: suggestionId({ source: "duplicate", candidate: candidate.id }),
      type: "POSSIBLE_DUPLICATE",
      severity: "REVIEW",
      candidateIds: [candidate.id, ...candidate.duplicateCandidateIds],
      eventIds: candidate.duplicateOfEventIds,
      sourceBlockIds: [...new Set(candidate.evidence.flatMap((item) => item.sourceBlockIds))],
      reason: "This extracted item resembles another candidate or an existing Timeline event.",
      recommendation: "Compare the source evidence and choose merge, keep both, edit, or dismiss.",
      source: "DETERMINISTIC",
      actionMode: "ACCEPT_EDIT_DISMISS",
    });
  }

  const blockIds = new Set(blocks.map((block) => block.id));
  const eventIds = new Set(document.events.map((event) => event.id));
  for (const item of providerSuggestions.slice(0, 200)) {
    if (!PROVIDER_TYPES.has(item.type) || (item.severity !== "INFO" && item.severity !== "REVIEW")) continue;
    if (!item.sourceBlockIds.every((id) => blockIds.has(id)) || !item.eventIds.every((id) => eventIds.has(id))) continue;
    const mappedCandidateIds = item.candidateIds.map((id) => localIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (mappedCandidateIds.length !== item.candidateIds.length) continue;
    const reason = String(item.reason ?? "").trim().slice(0, 1_000);
    const recommendation = String(item.recommendation ?? "").trim().slice(0, 1_000);
    if (!reason || !recommendation) continue;
    findings.push({
      id: suggestionId({ source: "ai", type: item.type, candidates: mappedCandidateIds, events: item.eventIds, blocks: item.sourceBlockIds, reason }),
      type: item.type,
      severity: item.severity,
      candidateIds: mappedCandidateIds,
      eventIds: [...item.eventIds],
      sourceBlockIds: [...item.sourceBlockIds],
      reason,
      recommendation,
      source: "AI_REVIEW",
      actionMode: "ACCEPT_EDIT_DISMISS",
    });
  }
  return [...new Map(findings.map((item) => [item.id, item])).values()];
}
