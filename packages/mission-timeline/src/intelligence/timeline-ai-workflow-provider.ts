import type {
  TimelineQualityAiInput,
  TimelineQualityAiResult,
  TimelineRescueAiInput,
  TimelineRescueAiResult,
} from "./timeline-ai-workflow-schema.js";

export interface TimelineAiWorkflowProviderDescriptor {
  provider: string;
  model: string;
}

export interface TimelineAiWorkflowProvider {
  readonly descriptor: TimelineAiWorkflowProviderDescriptor;
  analyzeQuality(input: TimelineQualityAiInput, signal?: AbortSignal): Promise<TimelineQualityAiResult>;
  observeRescue(input: TimelineRescueAiInput, signal?: AbortSignal): Promise<TimelineRescueAiResult>;
}

export class TimelineAiWorkflowProviderError extends Error {
  constructor(
    public readonly code: "PROVIDER_UNAVAILABLE" | "INVALID_PROVIDER_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "TimelineAiWorkflowProviderError";
  }
}
