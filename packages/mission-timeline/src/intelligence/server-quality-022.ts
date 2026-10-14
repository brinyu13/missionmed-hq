// The canonical Guardian is pure for analysis; DOM helpers run only on explicit UI calls.
// @ts-expect-error The shared browser module is deliberately JavaScript, bundled by esbuild.
import { analyzeTimelineQuality, mergeAiQualityAnalysis, deterministicFindingsForAi } from "../../web/js/uxr-002/quality-guardian.js";
import type { TimelineDocument } from "../contracts/types.js";
import { clone, sha256, stableStringify } from "../core/canonical.js";
// @ts-expect-error Shared canonical projection is JavaScript, bundled in both runtimes.
import { projectQualitySource022 } from "../../web/js/production/quality-source-projection-022.js";
import type { TimelineQualityAnalysisResponse } from "./timeline-ai-workflow-service.js";

/* TL-AAA-STABILIZE-20261013: the rule-based Guardian pass composes the Founder board several
 * times and ran on every save, checkpoint, list and read of a document — seconds of blocked
 * event loop per request for a CV-imported Timeline (version saves of 5–30 s were observed,
 * past the 20 s WordPress gateway timeout). The analysis is a pure function of the document
 * content it reads, so an exact-key bounded memo returns the identical report for the same
 * content. */
const QUALITY_MEMO_LIMIT = 128;
const qualityMemo = new Map<string, Record<string, unknown>>();
type AnyRecord = Record<string, unknown>;
const record = (value: unknown): AnyRecord => (value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {});
/** Exactly the inputs the deterministic Guardian pass consumes: the canonical quality-source
 * projection (events, exams, profile, presentation, media, categories, theme, interview,
 * applied fixes, accepted candidates, the presentation month) plus the few fields outside
 * that projection which composition or the content checks read. Save bookkeeping
 * (revision, timestamps, drafts, the sanitizer's own report) never enters the key, so a
 * version save of unchanged content is a memo hit. */
function qualityMemoKey(document: TimelineDocument): string | null {
  try {
    const source = record(document);
    const metadata = record(source.metadata), builder = record(source.builder), intake = record(source.intake);
    return sha256(stableStringify({
      projection: projectQualitySource022(document),
      month: new Date().toISOString().slice(0, 7),
      layoutLock: source.layoutLock === true,
      qualityGuardian: metadata.qualityGuardian ?? null,
      localTestPrototype: metadata.localTestPrototype === true,
      stickyNote: metadata.stickyNote ?? "",
      examReviewCorrections: builder.examReviewCorrections ?? null,
      aiExamReviewQueue: builder.aiExamReviewQueue ?? null,
      identity: record(intake.lastImport).identity ?? intake.sourceIdentity ?? null,
      candidates: (Array.isArray(intake.candidates) ? intake.candidates : []).map((candidate) => {
        const item = record(candidate);
        return { id: item.id ?? "", title: item.title ?? "", decision: item.decision ?? "" };
      }),
    }));
  } catch {
    return null;
  }
}
export function canonicalServerQuality022(document: TimelineDocument): Record<string, unknown> {
  const key = qualityMemoKey(document);
  if (key !== null) {
    const hit = qualityMemo.get(key);
    if (hit) {
      qualityMemo.delete(key); qualityMemo.set(key, hit);
      // The report is content-derived; only its revision stamp follows the request.
      return { ...clone(hit), generatedFromRevision: Number(record(document).revision || 0) };
    }
  }
  const report = analyzeTimelineQuality(document) as Record<string, unknown>;
  if (key !== null) {
    qualityMemo.set(key, clone(report));
    while (qualityMemo.size > QUALITY_MEMO_LIMIT) qualityMemo.delete(qualityMemo.keys().next().value as string);
  }
  return report;
}
export function canonicalServerQualityFindings022(report: Record<string, unknown>) {
  return deterministicFindingsForAi(report);
}
export function completeServerQuality022(report: Record<string, unknown>, analysis: TimelineQualityAnalysisResponse): Record<string, unknown> {
  return mergeAiQualityAnalysis(report, analysis) as Record<string, unknown>;
}
