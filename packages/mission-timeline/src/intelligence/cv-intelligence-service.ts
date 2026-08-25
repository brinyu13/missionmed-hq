import type { ObjectRecord, PrincipalContext, TimelineDocument } from "../contracts/types.js";
import { sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import {
  CV_INTELLIGENCE_PROMPT_VERSION,
  CV_INTELLIGENCE_SCHEMA_VERSION,
  parseCvIntelligenceRequest,
  type CvIntelligenceResponse,
} from "./cv-intelligence-schema.js";
import {
  CvIntelligenceProviderError,
  type CvIntelligenceProvider,
} from "./cv-intelligence-provider.js";
import { postValidateCvProviderResult } from "./cv-post-validator.js";
import { buildCvQualitySuggestions } from "./quality-assistant.js";
import { extractExactCvSourceBlocks } from "./cv-source-extractor.js";

export interface AuthorizedCvSourceObject {
  record: ObjectRecord;
  bytes: Uint8Array;
}

export interface CvIntelligenceServiceOptions {
  provider?: CvIntelligenceProvider | null;
  expectedConsentVersion?: string | null;
  syntheticPrincipalIds?: Iterable<string>;
}

export class CvIntelligenceService {
  private readonly provider: CvIntelligenceProvider | null;
  private readonly expectedConsentVersion: string | null;
  private readonly syntheticPrincipalIds: ReadonlySet<string>;

  constructor(options: CvIntelligenceServiceOptions = {}) {
    this.provider = options.provider ?? null;
    this.expectedConsentVersion = options.expectedConsentVersion?.trim() || null;
    this.syntheticPrincipalIds = new Set(options.syntheticPrincipalIds ?? []);
  }

  async analyze(
    context: PrincipalContext,
    document: TimelineDocument,
    authorizedSource: AuthorizedCvSourceObject | null,
    rawInput: unknown,
    syntheticFixture = false,
    signal?: AbortSignal,
  ): Promise<CvIntelligenceResponse> {
    const request = parseCvIntelligenceRequest(rawInput);
    if (context.role !== "STUDENT" || document.studentOwnerId !== context.principalId) {
      throw new TimelineError("CV_ANALYSIS_OWNER_REQUIRED", "Student ownership is required for CV analysis.", 403);
    }
    const sourceObject = authorizedSource?.record ?? null;
    if (
      !sourceObject
      || sourceObject.id !== request.source.objectId
      || sourceObject.ownerPrincipalId !== context.principalId
      || sourceObject.documentId !== document.id
    ) {
      throw new TimelineError("CV_SOURCE_ACCESS_DENIED", "CV source access is denied.", 403);
    }
    if (sourceObject.objectClass !== "SOURCE" || sourceObject.status !== "CONFIRMED") {
      throw new TimelineError("CV_SOURCE_NOT_READY", "CV source is not ready for analysis.", 409);
    }
    const bytes = authorizedSource!.bytes;
    const exactSha256 = sha256(bytes);
    if (
      sourceObject.expectedBytes !== bytes.byteLength
      || sourceObject.expectedSha256 !== exactSha256
      || request.source.sha256 !== exactSha256
      || sourceObject.mimeType !== request.source.mimeType
    ) {
      throw new TimelineError("CV_SOURCE_INTEGRITY_MISMATCH", "CV source integrity does not match the analysis request.", 409);
    }

    let verifiedBlocks;
    try {
      verifiedBlocks = (await extractExactCvSourceBlocks(bytes, request.source.mimeType)).blocks;
    } catch (error) {
      if (error instanceof TimelineError && error.code === "CV_SOURCE_OCR_REQUIRED") {
        const analysisId = this.analysisId(document.id, exactSha256, request.idempotencyKey);
        return this.fallback(
          document,
          exactSha256,
          analysisId,
          "OCR_REQUIRED",
          "No reliable born-digital text was recovered from the exact stored CV. Review the file or use authenticated OCR before AI analysis.",
        );
      }
      throw error;
    }

    // Client-supplied blocks are transport hints only. Provider input and all
    // post-validation are rebuilt from the authenticated object's exact bytes.
    const verifiedRequest = { ...request, blocks: verifiedBlocks };

    const analysisId = this.analysisId(document.id, exactSha256, request.idempotencyKey);
    if (!this.provider) return this.fallback(document, exactSha256, analysisId, "UNCONFIGURED");
    if (!syntheticFixture) {
      return this.fallback(
        document,
        exactSha256,
        analysisId,
        "AI_AUTHORIZATION_REQUIRED",
        "AI CV analysis is limited to an authorized synthetic test fixture in this release. The exact source was not sent to the provider.",
      );
    }
    if (!this.syntheticPrincipalIds.has(context.principalId)) {
      throw new TimelineError(
        "CV_AI_SYNTHETIC_PRINCIPAL_REQUIRED",
        "This principal is not authorized for synthetic AI CV verification.",
        403,
      );
    }
    if (!this.expectedConsentVersion || verifiedRequest.consentVersion !== this.expectedConsentVersion) {
      throw new TimelineError("CV_AI_CONSENT_REQUIRED", "Approved AI processing consent is required.", 409);
    }

    try {
      const providerResult = await this.provider.analyze(verifiedRequest, signal);
      const validated = postValidateCvProviderResult(providerResult, verifiedRequest);
      const reviewSummary = validated.candidates.reduce((summary, candidate) => {
        const key = candidate.review.lane.toLowerCase() as "high" | "medium" | "low";
        summary[key] += 1;
        if (candidate.safeToBulkAccept) summary.bulkAcceptable += 1;
        return summary;
      }, { high: 0, medium: 0, low: 0, bulkAcceptable: 0 });
      const prefillSummary = validated.candidates.reduce((summary, candidate) => {
        if (candidate.startDate && candidate.title) summary.timelineEvents += 1;
        if (["EDUCATION", "MEDICAL_DEGREE", "GRADUATION"].includes(candidate.canonicalType)) summary.profileCandidates += 1;
        if (["STEP_1", "STEP_2_CK", "STEP_3", "USMLE_STUDY_PERIOD", "ECFMG_CERTIFICATION"].includes(candidate.canonicalType)) summary.examCandidates += 1;
        return summary;
      }, { timelineEvents: 0, profileCandidates: 0, examCandidates: 0 });
      return {
        analysisId,
        status: "COMPLETE",
        mode: "SERVER_AI",
        provider: this.provider.descriptor.provider,
        model: this.provider.descriptor.model,
        schemaVersion: CV_INTELLIGENCE_SCHEMA_VERSION,
        promptVersion: CV_INTELLIGENCE_PROMPT_VERSION,
        sourceSha256: exactSha256,
        candidates: validated.candidates,
        qualitySuggestions: buildCvQualitySuggestions(document, validated.candidates, validated.providerSuggestions, verifiedRequest.blocks, validated.localIdMap),
        unresolvedQuestions: validated.unresolvedQuestions,
        rejectedCandidateCount: validated.rejectedCandidateCount,
        fallbackReason: null,
        reviewSummary,
        prefillSummary,
      };
    } catch (error) {
      if (error instanceof CvIntelligenceProviderError) {
        return this.fallback(document, exactSha256, analysisId, error.code);
      }
      if (error instanceof TimelineError && error.code === "CV_PROVIDER_OUTPUT_INVALID") {
        return this.fallback(document, exactSha256, analysisId, "INVALID_PROVIDER_OUTPUT");
      }
      throw error;
    }
  }

  private analysisId(documentId: string, sourceSha256: string, idempotencyKey: string): string {
    return `cv_analysis_${sha256(stableStringify({
      documentId,
      sourceSha256,
      idempotencyKey,
      schemaVersion: CV_INTELLIGENCE_SCHEMA_VERSION,
    })).slice(0, 24)}`;
  }

  private fallback(
    document: TimelineDocument,
    sourceSha256: string,
    analysisId: string,
    fallbackReason: CvIntelligenceResponse["fallbackReason"],
    unresolvedQuestion = "Server semantic analysis is unavailable. Review suggestions from the limited local parser before accepting them.",
  ): CvIntelligenceResponse {
    return {
      analysisId,
      status: "LIMITED_FALLBACK_REQUIRED",
      mode: "LOCAL_LIMITED",
      provider: this.provider?.descriptor.provider ?? null,
      model: this.provider?.descriptor.model ?? null,
      schemaVersion: CV_INTELLIGENCE_SCHEMA_VERSION,
      promptVersion: CV_INTELLIGENCE_PROMPT_VERSION,
      sourceSha256,
      candidates: [],
      qualitySuggestions: buildCvQualitySuggestions(document, [], [], [], new Map()),
      unresolvedQuestions: [unresolvedQuestion],
      rejectedCandidateCount: 0,
      fallbackReason,
      reviewSummary: { high: 0, medium: 0, low: 0, bulkAcceptable: 0 },
      prefillSummary: { timelineEvents: 0, profileCandidates: 0, examCandidates: 0 },
    };
  }
}
