import type { FeatureFlags } from "./features.ts";

export type PriqStateCode =
  | "FOUNDATION_READY" | "CREDENTIAL_BLOCKED" | "STUDENT_INTAKE_BLOCKED" | "MEDIA_BLOCKED"
  | "RESEARCH_IN_PROGRESS" | "FOUNDER_REVIEW_REQUIRED" | "STUDENT_PUBLICATION_DISABLED"
  | "AI_KILL_SWITCH_ACTIVE" | "DEGRADED_READ_ONLY" | "VERTICAL_SLICE_READY";

export interface PriqUiState {
  code: PriqStateCode;
  active: boolean;
  surface: "today" | "students" | "programs" | "copilot" | "lab" | "panel" | "ai";
  label: string;
  detail: string;
}

export function deriveUiStates(input: {
  flags: FeatureFlags;
  credentialConfigured: boolean;
  restrictedProviderApproved: boolean;
  authorizedPrivatePacket: boolean;
  audiovisualSource: boolean;
  researchInProgress: boolean;
  founderApproved: boolean;
}): PriqUiState[] {
  const ready = input.credentialConfigured && input.restrictedProviderApproved && input.authorizedPrivatePacket && input.audiovisualSource && input.founderApproved && input.flags.studentPublicationEnabled && input.flags.mirEnabled;
  return [
    { code: "FOUNDATION_READY", active: true, surface: "today", label: "Foundation ready", detail: "MIR, policy, intake, evidence, and review foundations are available locally." },
    { code: "CREDENTIAL_BLOCKED", active: !input.credentialConfigured, surface: "ai", label: "OpenAI credential required", detail: "No scoped MIR credential is configured. Existing approved intelligence stays readable." },
    { code: "STUDENT_INTAKE_BLOCKED", active: !input.authorizedPrivatePacket, surface: "students", label: "Waiting for Ezechiel’s authorized materials", detail: "No private packet has been added or copied into Git." },
    { code: "MEDIA_BLOCKED", active: !input.audiovisualSource || !input.flags.videoAnalysisEnabled, surface: "lab", label: input.flags.videoAnalysisEnabled ? "Video evidence not yet added" : "Video analysis disabled", detail: "Media analysis remains off and founder review is mandatory." },
    { code: "RESEARCH_IN_PROGRESS", active: input.researchInProgress, surface: "programs", label: "Research in progress", detail: "Evidence assertions are being checked against approved sources." },
    { code: "FOUNDER_REVIEW_REQUIRED", active: !input.founderApproved, surface: "programs", label: "Founder review pending", detail: "No derived profile or recommendation is approved for delivery." },
    { code: "STUDENT_PUBLICATION_DISABLED", active: !input.flags.studentPublicationEnabled, surface: "students", label: "Student publication disabled", detail: "Preview is founder-only; nothing has been published to Ezechiel." },
    { code: "AI_KILL_SWITCH_ACTIVE", active: !input.flags.mirEnabled, surface: "panel", label: "Emergency AI pause active", detail: "External model calls are halted; deterministic detectors and approved artifacts remain read-only." },
    { code: "DEGRADED_READ_ONLY", active: !input.flags.mirEnabled || !input.credentialConfigured, surface: "copilot", label: "Degraded read-only", detail: "Live AI generation is unavailable; deterministic cue governance remains visible." },
    { code: "VERTICAL_SLICE_READY", active: ready, surface: "today", label: "Vertical slice ready", detail: "All evidence, provider, review, and publication gates are satisfied." },
  ];
}
