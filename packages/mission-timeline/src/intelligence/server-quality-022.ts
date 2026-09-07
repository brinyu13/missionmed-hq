// The canonical Guardian is pure for analysis; DOM helpers run only on explicit UI calls.
// @ts-expect-error The shared browser module is deliberately JavaScript, bundled by esbuild.
import { analyzeTimelineQuality, mergeAiQualityAnalysis, deterministicFindingsForAi } from "../../web/js/uxr-002/quality-guardian.js";
import type { TimelineDocument } from "../contracts/types.js";
import type { TimelineQualityAnalysisResponse } from "./timeline-ai-workflow-service.js";

export function canonicalServerQuality022(document: TimelineDocument): Record<string, unknown> {
  return analyzeTimelineQuality(document) as Record<string, unknown>;
}
export function canonicalServerQualityFindings022(report: Record<string, unknown>) {
  return deterministicFindingsForAi(report);
}
export function completeServerQuality022(report: Record<string, unknown>, analysis: TimelineQualityAnalysisResponse): Record<string, unknown> {
  return mergeAiQualityAnalysis(report, analysis) as Record<string, unknown>;
}
