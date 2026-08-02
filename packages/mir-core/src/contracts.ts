export type MirCapability =
  | "reasoning_high"
  | "extraction_fast"
  | "multimodal_precise"
  | "live_cue_low_latency"
  | "embedding_default"
  | "rerank_default"
  | "speech_transcription"
  | "policy_check"
  | "batch_refresh";

export type DataClass =
  | "public_professional"
  | "public_personal"
  | "missionmed_intel"
  | "founder_private"
  | "student_provided"
  | "derived_claims"
  | "student_facing_outputs"
  | "phi";
export type PriqRole = "founder" | "admin" | "coach" | "student" | "service";

export interface MirContext {
  tenantId: string;
  userId: string;
  role: PriqRole;
  subjectIds: string[];
  dataClasses: DataClass[];
  feature: string;
  requestId: string;
}

export type JsonSchema = Record<string, unknown> & { type: "object"; properties: Record<string, unknown> };

export interface MirRequest<T = unknown> {
  capability: MirCapability;
  context: MirContext;
  instructions: string;
  input: T;
  output: { name: string; schema: JsonSchema };
  promptVersion: string;
  maxOutputTokens: number;
}

export interface ProviderResult {
  provider: string;
  model: string;
  payload: unknown;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  providerRequestId?: string;
}

export interface MirProvider {
  readonly name: string;
  readonly restrictedDataApproved: boolean;
  invoke(request: MirRequest, model: string): Promise<ProviderResult>;
  health(): Promise<{ configured: boolean; detail: string }>;
}

export interface ModelRun {
  id: string;
  requestId: string;
  tenantId: string;
  userId: string;
  subjectIds: string[];
  capability: MirCapability;
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  outputHash: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "succeeded" | "failed" | "blocked";
  createdAt: string;
}
