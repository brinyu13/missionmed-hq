import type { PrincipalContext, TimelineDocument } from "../contracts/types.js";
import { sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import {
  MISSIONMED_TIMELINE_STANDARD_VERSION,
  TIMELINE_AI_WORKFLOW_SCHEMA_VERSION,
  TIMELINE_QUALITY_CATEGORIES,
  TIMELINE_QUALITY_PROMPT_VERSION,
  TIMELINE_RESCUE_PROMPT_VERSION,
  qualityInputFromDocument,
  sanitizeServerApprovedFounderPreferenceRules,
  type TimelineFounderPreferenceRule,
  type TimelineQualityAiFinding,
  type TimelineQualityAiInput,
  type TimelineRescueAiInput,
} from "./timeline-ai-workflow-schema.js";
import {
  TimelineAiWorkflowProviderError,
  type TimelineAiWorkflowProvider,
} from "./timeline-ai-workflow-provider.js";

const PRESENTATION_FIXES = new Set([
  "AUTO_ARRANGE_EVENTS",
  "CLAMP_OBJECTS",
  "RESTORE_THEME_BACKGROUND",
  "RESTORE_DEFAULT_THEME",
]);

export interface TimelineQualityAnalysisResponse {
  analysisId: string;
  status: "COMPLETE" | "AI_UNAVAILABLE";
  mode: "SERVER_AI" | "UNAVAILABLE";
  provider: string | null;
  model: string | null;
  schemaVersion: typeof TIMELINE_AI_WORKFLOW_SCHEMA_VERSION;
  promptVersion: typeof TIMELINE_QUALITY_PROMPT_VERSION;
  standardVersion: typeof MISSIONMED_TIMELINE_STANDARD_VERSION;
  documentRevision: number;
  findings: TimelineQualityAiFinding[];
  unresolvedQuestions: string[];
  unavailableMessage: string | null;
}

export interface TimelineRescueObservationResponse {
  analysisId: string;
  status: "COMPLETE" | "AI_UNAVAILABLE";
  mode: "SERVER_AI" | "UNAVAILABLE";
  provider: string | null;
  model: string | null;
  schemaVersion: typeof TIMELINE_AI_WORKFLOW_SCHEMA_VERSION;
  promptVersion: typeof TIMELINE_RESCUE_PROMPT_VERSION;
  observations: Awaited<ReturnType<TimelineAiWorkflowProvider["observeRescue"]>>["observations"];
  unresolvedQuestions: string[];
  unavailableMessage: string | null;
}

function safeQualityFindings(
  raw: unknown,
  document: TimelineDocument,
): TimelineQualityAiFinding[] {
  if (!Array.isArray(raw)) return [];
  const knownIds = new Set(document.events.map((event) => String(event.id)));
  const advanced = document.advanced && typeof document.advanced === "object" ? document.advanced as Record<string, unknown> : {};
  for (const collection of [advanced.media, advanced.textBlocks, advanced.elements]) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) if (item && typeof item === "object" && "id" in item) knownIds.add(String((item as { id: unknown }).id));
  }
  return raw.slice(0, 100).flatMap((item): TimelineQualityAiFinding[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const finding = item as Record<string, unknown>;
    const category = String(finding.category ?? "");
    const severity = String(finding.severity ?? "");
    const basis = String(finding.basis ?? "");
    const actionMode = String(finding.actionMode ?? "");
    const fixKind = finding.fixKind === null ? null : String(finding.fixKind ?? "");
    const confidence = Number(finding.confidence);
    const elementIds = Array.isArray(finding.elementIds)
      ? [...new Set(finding.elementIds.map(String).filter((id) => knownIds.has(id)))].slice(0, 100)
      : [];
    if (
      !(TIMELINE_QUALITY_CATEGORIES as readonly string[]).includes(category) ||
      !["BLOCK_EXPORT", "REVIEW", "INFO"].includes(severity) ||
      !["SOURCE_FACT", "AI_INFERENCE", "PRESENTATION_RECOMMENDATION"].includes(basis) ||
      !["REVIEW", "FIX_FOR_ME"].includes(actionMode) ||
      !Number.isFinite(confidence) || confidence < 0 || confidence > 1
    ) return [];
    if (actionMode === "FIX_FOR_ME" && (basis !== "PRESENTATION_RECOMMENDATION" || !PRESENTATION_FIXES.has(String(fixKind)))) return [];
    if (actionMode === "REVIEW" && fixKind !== null) return [];
    const message = String(finding.message ?? "").trim().slice(0, 1_000);
    const recommendation = String(finding.recommendation ?? "").trim().slice(0, 1_000);
    const code = String(finding.code ?? "").trim().slice(0, 100);
    if (!message || !recommendation || !/^[A-Z0-9_]+$/.test(code)) return [];
    const stableId = `qg-ai:${sha256(stableStringify({ category, code, elementIds, message })).slice(0, 24)}`;
    return [{
      id: stableId,
      category: category as TimelineQualityAiFinding["category"],
      code,
      severity: severity as TimelineQualityAiFinding["severity"],
      basis: basis as TimelineQualityAiFinding["basis"],
      elementIds,
      message,
      recommendation,
      confidence,
      actionMode: actionMode as TimelineQualityAiFinding["actionMode"],
      fixKind: fixKind as TimelineQualityAiFinding["fixKind"],
    }];
  });
}

function cleanQuestions(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item).trim().slice(0, 1_000)).filter(Boolean))].slice(0, 50)
    : [];
}

export class TimelineAiWorkflowService {
  private readonly syntheticPrincipalIds: ReadonlySet<string>;
  private readonly serverApprovedFounderPreferences: readonly TimelineFounderPreferenceRule[];

  constructor(
    private readonly provider: TimelineAiWorkflowProvider | null = null,
    syntheticPrincipalIds: Iterable<string> = [],
    serverApprovedFounderPreferences: unknown = [],
  ) {
    this.syntheticPrincipalIds = new Set(
      [...syntheticPrincipalIds].map((value) => String(value).trim()).filter(Boolean),
    );
    this.serverApprovedFounderPreferences = Object.freeze(
      sanitizeServerApprovedFounderPreferenceRules(serverApprovedFounderPreferences),
    );
  }

  async analyzeQuality(
    context: PrincipalContext,
    document: TimelineDocument,
    deterministicFindings: TimelineQualityAiInput["presentation"]["deterministicFindings"] = [],
    syntheticFixture = false,
    signal?: AbortSignal,
  ): Promise<TimelineQualityAnalysisResponse> {
    this.assertOwner(context, document, "TIMELINE_QUALITY_OWNER_REQUIRED");
    this.assertSyntheticAuthorized(context, syntheticFixture);
    const input = qualityInputFromDocument(document, deterministicFindings, this.serverApprovedFounderPreferences);
    const analysisId = `quality_analysis_${sha256(stableStringify({ documentId: document.id, revision: document.revision, prompt: TIMELINE_QUALITY_PROMPT_VERSION })).slice(0, 24)}`;
    if (!this.provider) return this.qualityUnavailable(document, analysisId);
    try {
      const result = await this.provider.analyzeQuality(input, signal);
      return {
        analysisId,
        status: "COMPLETE",
        mode: "SERVER_AI",
        provider: this.provider.descriptor.provider,
        model: this.provider.descriptor.model,
        schemaVersion: TIMELINE_AI_WORKFLOW_SCHEMA_VERSION,
        promptVersion: TIMELINE_QUALITY_PROMPT_VERSION,
        standardVersion: MISSIONMED_TIMELINE_STANDARD_VERSION,
        documentRevision: document.revision,
        findings: safeQualityFindings(result.findings, document),
        unresolvedQuestions: cleanQuestions(result.unresolvedQuestions),
        unavailableMessage: null,
      };
    } catch (error) {
      if (error instanceof TimelineAiWorkflowProviderError) return this.qualityUnavailable(document, analysisId);
      throw error;
    }
  }

  async observeRescue(
    context: PrincipalContext,
    document: TimelineDocument,
    input: TimelineRescueAiInput,
    syntheticFixture = false,
    signal?: AbortSignal,
  ): Promise<TimelineRescueObservationResponse> {
    this.assertOwner(context, document, "TIMELINE_RESCUE_OWNER_REQUIRED");
    this.assertSyntheticAuthorized(context, syntheticFixture);
    const analysisId = `rescue_analysis_${sha256(stableStringify({ documentId: document.id, artifactSha256: input.artifactSha256, prompt: TIMELINE_RESCUE_PROMPT_VERSION })).slice(0, 24)}`;
    if (!this.provider) return this.rescueUnavailable(analysisId);
    try {
      const result = await this.provider.observeRescue(input, signal);
      return {
        analysisId,
        status: "COMPLETE",
        mode: "SERVER_AI",
        provider: this.provider.descriptor.provider,
        model: this.provider.descriptor.model,
        schemaVersion: TIMELINE_AI_WORKFLOW_SCHEMA_VERSION,
        promptVersion: TIMELINE_RESCUE_PROMPT_VERSION,
        observations: Array.isArray(result.observations) ? result.observations.slice(0, 2_000) : [],
        unresolvedQuestions: cleanQuestions(result.unresolvedQuestions),
        unavailableMessage: null,
      };
    } catch (error) {
      if (error instanceof TimelineAiWorkflowProviderError) return this.rescueUnavailable(analysisId);
      throw error;
    }
  }

  private assertOwner(context: PrincipalContext, document: TimelineDocument, code: string): void {
    if (context.role !== "STUDENT" || document.studentOwnerId !== context.principalId) {
      throw new TimelineError(code, "Student ownership is required for Timeline AI.", 403);
    }
  }

  private assertSyntheticAuthorized(context: PrincipalContext, syntheticFixture: boolean): void {
    if (!syntheticFixture || !this.syntheticPrincipalIds.has(context.principalId)) {
      throw new TimelineError(
        "TIMELINE_AI_SYNTHETIC_PRINCIPAL_REQUIRED",
        "This AI workflow is restricted to an authorized synthetic test principal.",
        403,
      );
    }
  }

  private qualityUnavailable(document: TimelineDocument, analysisId: string): TimelineQualityAnalysisResponse {
    return {
      analysisId,
      status: "AI_UNAVAILABLE",
      mode: "UNAVAILABLE",
      provider: this.provider?.descriptor.provider ?? null,
      model: this.provider?.descriptor.model ?? null,
      schemaVersion: TIMELINE_AI_WORKFLOW_SCHEMA_VERSION,
      promptVersion: TIMELINE_QUALITY_PROMPT_VERSION,
      standardVersion: MISSIONMED_TIMELINE_STANDARD_VERSION,
      documentRevision: document.revision,
      findings: [],
      unresolvedQuestions: [],
      unavailableMessage: "Timeline AI is temporarily unavailable. Your Timeline was not changed.",
    };
  }

  private rescueUnavailable(analysisId: string): TimelineRescueObservationResponse {
    return {
      analysisId,
      status: "AI_UNAVAILABLE",
      mode: "UNAVAILABLE",
      provider: this.provider?.descriptor.provider ?? null,
      model: this.provider?.descriptor.model ?? null,
      schemaVersion: TIMELINE_AI_WORKFLOW_SCHEMA_VERSION,
      promptVersion: TIMELINE_RESCUE_PROMPT_VERSION,
      observations: [],
      unresolvedQuestions: [],
      unavailableMessage: "Timeline AI is temporarily unavailable. No rescue facts were created.",
    };
  }
}
