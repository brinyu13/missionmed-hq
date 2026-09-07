import type { PrincipalContext } from "../contracts/types.js";

export type TimelineAiProcessingMode = "synthetic_only" | "consented_students";
export interface TimelineAiAuthorizationOptions {
  processingMode?: TimelineAiProcessingMode;
  expectedConsentVersion?: string | null;
  syntheticPrincipalIds: ReadonlySet<string>;
  syntheticFixture: boolean;
  clock?: () => Date;
}
export type TimelineAiAuthorization =
  | { allowed: true; basis: "SYNTHETIC_FIXTURE" | "VERIFIED_STUDENT_CONSENT"; consentVersion: string | null }
  | { allowed: false; code: "TIMELINE_AI_SYNTHETIC_PRINCIPAL_REQUIRED" | "TIMELINE_AI_PROCESSING_DISABLED" | "TIMELINE_AI_CONSENT_REQUIRED" };

export function timelineAiProcessingMode(value: unknown): TimelineAiProcessingMode {
  const mode = String(value ?? "synthetic_only").trim() || "synthetic_only";
  if (mode !== "synthetic_only" && mode !== "consented_students") throw new Error("TIMELINE_AI_PROCESSING_MODE_INVALID");
  return mode;
}

/** Evaluates server identity only; source ownership is independently checked by each service. */
export function authorizeTimelineAi(context: PrincipalContext, options: TimelineAiAuthorizationOptions): TimelineAiAuthorization {
  if (options.syntheticFixture) {
    return options.syntheticPrincipalIds.has(context.principalId)
      ? { allowed: true, basis: "SYNTHETIC_FIXTURE", consentVersion: options.expectedConsentVersion ?? null }
      : { allowed: false, code: "TIMELINE_AI_SYNTHETIC_PRINCIPAL_REQUIRED" };
  }
  if (timelineAiProcessingMode(options.processingMode) !== "consented_students") {
    return { allowed: false, code: "TIMELINE_AI_PROCESSING_DISABLED" };
  }
  const consent = context.aiConsent;
  const acceptedAt = Date.parse(consent?.consentedAt ?? "");
  if (
    context.role !== "STUDENT" || context.hasLearndash3893Access !== true
    || consent?.source !== "WORDPRESS_VERIFIED" || !options.expectedConsentVersion
    || consent.version !== options.expectedConsentVersion
    || !Number.isFinite(acceptedAt) || acceptedAt > (options.clock ?? (() => new Date()))().getTime()
  ) return { allowed: false, code: "TIMELINE_AI_CONSENT_REQUIRED" };
  return { allowed: true, basis: "VERIFIED_STUDENT_CONSENT", consentVersion: consent.version };
}
