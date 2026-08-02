import { createHash, randomUUID } from "node:crypto";
import type { MirCapability, MirProvider, MirRequest, ModelRun } from "./contracts.ts";
import { authorize } from "./policy.ts";
import { validateSchema } from "./validation.ts";

export interface Route { provider: string; model: string; reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max"; inputUsdPerMillion: number; outputUsdPerMillion: number }
export type RouteTable = Record<MirCapability, Route>;

export class BudgetExceeded extends Error {}

export class BudgetLedger {
  private daily = 0;
  private monthly = 0;
  constructor(readonly dailyLimitUsd: number, public monthlyLimitUsd: number) {}
  setMonthlyLimit(limitUsd: number): void {
    if (!Number.isFinite(limitUsd) || limitUsd <= 0) throw new Error("INVALID_MONTHLY_LIMIT");
    this.monthlyLimitUsd = limitUsd;
  }
  reserve(estimatedUsd: number): void {
    if (this.daily + estimatedUsd > this.dailyLimitUsd || this.monthly + estimatedUsd > this.monthlyLimitUsd) {
      throw new BudgetExceeded("MIR budget limit reached");
    }
  }
  record(actualUsd: number): void { this.daily += actualUsd; this.monthly += actualUsd; }
  snapshot() { return { dailyUsd: this.daily, monthlyUsd: this.monthly, dailyLimitUsd: this.dailyLimitUsd, monthlyLimitUsd: this.monthlyLimitUsd }; }
}

export class MirRuntime {
  readonly runs: ModelRun[] = [];
  constructor(
    private readonly providers: Map<string, MirProvider>,
    private readonly routes: RouteTable,
    readonly budget: BudgetLedger,
    private readonly enabled: () => boolean = () => true,
  ) {}

  async invoke<T>(request: MirRequest): Promise<T> {
    if (!this.enabled()) throw new Error("MIR_KILL_SWITCH_ACTIVE");
    const route = this.routes[request.capability];
    const provider = this.providers.get(route.provider);
    if (!provider) throw new Error(`PROVIDER_NOT_CONFIGURED:${route.provider}`);
    authorize(request, provider.restrictedDataApproved);
    const upperEstimate = request.maxOutputTokens * route.outputUsdPerMillion / 1_000_000;
    this.budget.reserve(upperEstimate);
    const inputHash = hash(request.input);
    try {
      const result = await provider.invoke({ ...request, input: { payload: request.input, reasoningEffort: route.reasoningEffort } }, route.model);
      const errors = validateSchema(result.payload, request.output.schema);
      if (errors.length) throw new Error(`SCHEMA_VALIDATION_FAILED:${errors.join(";")}`);
      const cost = result.inputTokens * route.inputUsdPerMillion / 1_000_000 + result.outputTokens * route.outputUsdPerMillion / 1_000_000;
      this.budget.record(cost);
      this.runs.push({
        id: randomUUID(), requestId: request.context.requestId, tenantId: request.context.tenantId,
        userId: request.context.userId, subjectIds: [...request.context.subjectIds], capability: request.capability,
        provider: result.provider, model: result.model, promptVersion: request.promptVersion, inputHash,
        outputHash: hash(result.payload), inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        costUsd: cost, latencyMs: result.latencyMs,
        httpStatusCategory: result.httpStatus === undefined ? undefined : `${Math.floor(result.httpStatus / 100)}xx`,
        status: "succeeded", createdAt: new Date().toISOString(),
      });
      return result.payload as T;
    } catch (error) {
      this.runs.push({
        id: randomUUID(), requestId: request.context.requestId, tenantId: request.context.tenantId,
        userId: request.context.userId, subjectIds: [...request.context.subjectIds], capability: request.capability,
        provider: provider.name, model: route.model, promptVersion: request.promptVersion, inputHash, outputHash: "",
        inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, status: "failed", createdAt: new Date().toISOString(),
      });
      throw error;
    }
  }
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
