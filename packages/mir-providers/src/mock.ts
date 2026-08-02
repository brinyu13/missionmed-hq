import type { MirProvider, MirRequest, ProviderResult } from "../../mir-core/src/index.ts";

export class ContractTestProvider implements MirProvider {
  readonly name = "contract-test";
  readonly restrictedDataApproved = false;
  constructor(private readonly responder: (request: MirRequest) => unknown) {}
  async health() { return { configured: process.env.NODE_ENV === "test", detail: "test-only deterministic provider" }; }
  async invoke(request: MirRequest, model: string): Promise<ProviderResult> {
    if (process.env.NODE_ENV !== "test") throw new Error("CONTRACT_TEST_PROVIDER_FORBIDDEN_OUTSIDE_TEST");
    return { provider: this.name, model, payload: this.responder(request), inputTokens: 10, outputTokens: 10, latencyMs: 1 };
  }
}
