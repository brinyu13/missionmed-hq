import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { BudgetExceeded, BudgetLedger, MirRuntime, type MirRequest, type RouteTable } from "../packages/mir-core/src/index.ts";
import { OpenAIResponsesProvider, ProviderConfigurationError } from "../packages/mir-providers/src/index.ts";
import { builtFrontendSecretScan } from "./priq-frontend-scan.ts";

function category(error: unknown): string {
  if (error instanceof ProviderConfigurationError) return "credential_health_error";
  if (error instanceof BudgetExceeded) return "budget_blocked";
  const message = error instanceof Error ? error.message : "";
  if (message.includes(":401:")) return "authentication_rejected";
  if (message.includes(":403:")) return "provider_permission_denied";
  if (message.includes(":429:")) return "provider_rate_limited";
  if (/timeout|abort/i.test(message)) return "provider_timeout";
  if (message.includes("MIR_KILL_SWITCH_ACTIVE")) return "kill_switch_blocked";
  if (message.includes("SCHEMA_VALIDATION_FAILED")) return "structured_output_invalid";
  return "provider_noncredential_failure";
}

async function main(): Promise<void> {
  const present = Boolean(process.env.OPENAI_API_KEY?.trim());
  process.stdout.write(`OPENAI_API_KEY present: ${present ? "yes" : "no"}\n`);
  if (process.env.MIR_REAL_AI_TESTS !== "1") throw new Error("REAL_AI_TEST_GATE_DISABLED");
  if (!present) throw new ProviderConfigurationError("OPENAI_CREDENTIAL_HEALTH_ERROR");

  const config = JSON.parse(readFileSync("config/priq/mir-routes.json", "utf8")) as { routes: RouteTable };
  const route = config.routes.extraction_fast;
  if (route.provider !== "openai") throw new Error("OPENAI_ROUTE_DISABLED");
  const provider = new OpenAIResponsesProvider();
  const health = await provider.health();
  const source = await provider.credentialSource();
  let killed = false;
  const runtime = new MirRuntime(new Map([["openai", provider]]), config.routes, new BudgetLedger(
    Number(process.env.MIR_DAILY_BUDGET_USD ?? "1"), Number(process.env.MIR_MONTHLY_BUDGET_USD ?? "5"),
  ), () => !killed);
  const request: MirRequest = {
    capability: "extraction_fast",
    context: {
      tenantId: "missionmed-local-provider-proof", userId: "provider-proof", role: "service", subjectIds: ["synthetic:provider-proof"],
      dataClasses: ["public_professional"], feature: "profile", requestId: randomUUID(),
    },
    instructions: "Return the requested synthetic health result. Do not add fields.",
    input: { synthetic: true, instruction: "Return status ok." },
    output: {
      name: "priq_provider_health",
      schema: { type: "object", properties: { status: { type: "string", enum: ["ok"] } }, required: ["status"], additionalProperties: false },
    },
    promptVersion: "priq-provider-proof-v1", maxOutputTokens: 32,
  };

  const firstPayload = await runtime.invoke<{ status: string }>(request);
  const first = runtime.runs.at(-1);
  if (!first || first.status !== "succeeded" || firstPayload.status !== "ok") throw new Error("PROVIDER_PROOF_RUN_MISSING");

  killed = true;
  const runCountBeforeKill = runtime.runs.length;
  let killBlocked = false;
  try { await runtime.invoke(request); } catch (error) { killBlocked = category(error) === "kill_switch_blocked"; }
  if (!killBlocked || runtime.runs.length !== runCountBeforeKill) throw new Error("KILL_SWITCH_PROOF_FAILED");

  killed = false;
  await runtime.invoke<{ status: string }>({ ...request, context: { ...request.context, requestId: randomUUID() } });
  const released = runtime.runs.at(-1);
  if (!released || released.status !== "succeeded") throw new Error("KILL_RELEASE_PROOF_FAILED");

  const frontendScan = await builtFrontendSecretScan();
  if (!frontendScan) throw new Error("FRONTEND_SECRET_SCAN_FAILED");
  process.stdout.write(`${JSON.stringify({
    success: true,
    provider: first.provider,
    capabilityRoute: first.capability,
    model: first.model,
    httpStatusCategory: first.httpStatusCategory ?? "unknown",
    latencyMs: first.latencyMs,
    tokenUsage: { input: first.inputTokens, output: first.outputTokens },
    estimatedCostUsd: first.costUsd,
    modelRunId: first.id,
    sanitizedErrorCategory: null,
    credentialSource: source,
    providerHealthGreen: health.configured,
    structuredOutputValid: true,
    killSwitchBlockedNextCall: killBlocked,
    releaseRestoredCalls: true,
    frontendSecretScanPassed: frontendScan,
  })}\n`);
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({ success: false, sanitizedErrorCategory: category(error) })}\n`);
  process.exitCode = 1;
});
