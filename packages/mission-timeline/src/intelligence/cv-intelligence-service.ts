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

export interface CvIntelligenceServiceOptions {
  provider?: CvIntelligenceProvider | null;
  expectedConsentVersion?: string | null;
}

export class CvIntelligenceService {
  private readonly provider: CvIntelligenceProvider | null;
  private readonly expectedConsentVersion: string | null;

  constructor(options: CvIntelligenceServiceOptions = {}) {
    this.provider = options.provider ?? null;
    this.expectedConsentVersion = options.expectedConsentVersion?.trim() || null;
  }

  async analyze(
    context: PrincipalContext,
    document: TimelineDocument,
    sourceObject: ObjectRecord | null,
    rawInput: unknown,
    signal?: AbortSignal,
  ): Promise<CvIntelligenceResponse> {
    const request = parseCvIntelligenceRequest(rawInput);
    if (context.role !== "STUDENT" || document.studentOwnerId !== context.principalId) {
      throw new TimelineError("CV_ANALYSIS_OWNER_REQUIRED", "Student ownership is required for CV analysis.", 403);
    }
    if (!sourceObject || sourceObject.ownerPrincipalId !== context.principalId || sourceObject.documentId !== document.id) {
      throw new TimelineError("CV_SOURCE_ACCESS_DENIED", "CV source access is denied.", 403);
    }
    if (sourceObject.objectClass !== "SOURCE" || sourceObject.status !== "CONFIRMED") {
      throw new TimelineError("CV_SOURCE_NOT_READY", "CV source is not ready for analysis.", 409);
    }
    if (sourceObject.expectedSha256 !== request.source.sha256 || sourceObject.mimeType !== request.source.mimeType) {
      throw new TimelineError("CV_SOURCE_INTEGRITY_MISMATCH", "CV source integrity does not match the analysis request.", 409);
    }
    if (this.provider && (!this.expectedConsentVersion || request.consentVersion !== this.expectedConsentVersion)) {
      throw new TimelineError("CV_AI_CONSENT_REQUIRED", "Approved AI processing consent is required.", 409);
    }

    const analysisId = `cv_analysis_${sha256(stableStringify({
      documentId: document.id,
      sourceSha256: request.source.sha256,
      idempotencyKey: request.idempotencyKey,
      schemaVersion: CV_INTELLIGENCE_SCHEMA_VERSION,
    })).slice(0, 24)}`;
    if (!this.provider) return this.fallback(document, request.source.sha256, analysisId, "UNCONFIGURED");

    try {
      const providerResult = await this.provider.analyze(request, signal);
      const validated = postValidateCvProviderResult(providerResult, request);
      return {
        analysisId,
        status: "COMPLETE",
        mode: "SERVER_AI",
        provider: this.provider.descriptor.provider,
        model: this.provider.descriptor.model,
        schemaVersion: CV_INTELLIGENCE_SCHEMA_VERSION,
        promptVersion: CV_INTELLIGENCE_PROMPT_VERSION,
        sourceSha256: request.source.sha256,
        candidates: validated.candidates,
        qualitySuggestions: buildCvQualitySuggestions(document, validated.candidates, validated.providerSuggestions, request.blocks, validated.localIdMap),
        unresolvedQuestions: validated.unresolvedQuestions,
        rejectedCandidateCount: validated.rejectedCandidateCount,
        fallbackReason: null,
      };
    } catch (error) {
      if (error instanceof CvIntelligenceProviderError) {
        return this.fallback(document, request.source.sha256, analysisId, error.code);
      }
      if (error instanceof TimelineError && error.code === "CV_PROVIDER_OUTPUT_INVALID") {
        return this.fallback(document, request.source.sha256, analysisId, "INVALID_PROVIDER_OUTPUT");
      }
      throw error;
    }
  }

  private fallback(
    document: TimelineDocument,
    sourceSha256: string,
    analysisId: string,
    fallbackReason: CvIntelligenceResponse["fallbackReason"],
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
      unresolvedQuestions: ["Server semantic analysis is unavailable. Review suggestions from the limited local parser before accepting them."],
      rejectedCandidateCount: 0,
      fallbackReason,
    };
  }
}
