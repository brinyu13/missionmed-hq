import type { CvIntelligenceRequest, CvProviderResult } from "./cv-intelligence-schema.js";

export interface CvIntelligenceProviderDescriptor {
  provider: string;
  model: string;
}

export interface CvIntelligenceProvider {
  readonly descriptor: CvIntelligenceProviderDescriptor;
  analyze(request: CvIntelligenceRequest, signal?: AbortSignal): Promise<CvProviderResult>;
}

export class CvIntelligenceProviderError extends Error {
  constructor(
    public readonly code: "PROVIDER_UNAVAILABLE" | "INVALID_PROVIDER_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "CvIntelligenceProviderError";
  }
}
