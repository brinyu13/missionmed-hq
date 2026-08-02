import test from "node:test";
import assert from "node:assert/strict";
import { BudgetExceeded, BudgetLedger, MirRuntime, PolicyDenied, type MirCapability, type MirContext, type MirRequest, type RouteTable } from "../../packages/mir-core/src/index.ts";
import { ContractTestProvider, OpenAIResponsesProvider, ProviderConfigurationError } from "../../packages/mir-providers/src/index.ts";

const context: MirContext = {
  tenantId: "missionmed", userId: "founder:1", role: "founder", subjectIds: ["student:1"],
  dataClasses: ["public_professional"], feature: "profile", requestId: "req:1",
};
const request: MirRequest = {
  capability: "reasoning_high", context, instructions: "Return evidence-bound output.", input: { sourceIds: ["s1"] },
  output: { name: "claim", schema: { type: "object", required: ["value"], additionalProperties: false, properties: { value: { type: "string" } } } },
  promptVersion: "test-v1", maxOutputTokens: 100,
};
const baseRoute = { provider: "contract-test", model: "contract-v1", inputUsdPerMillion: 1, outputUsdPerMillion: 1 };
const routes = Object.fromEntries([
  "reasoning_high", "extraction_fast", "multimodal_precise", "live_cue_low_latency", "embedding_default",
  "rerank_default", "speech_transcription", "policy_check", "batch_refresh",
].map((key) => [key, baseRoute])) as RouteTable;

test("contract-test provider is forbidden outside tests", async () => {
  const previous = process.env.NODE_ENV; delete process.env.NODE_ENV;
  await assert.rejects(new ContractTestProvider(() => ({ value: "ok" })).invoke(request, "x"), /FORBIDDEN_OUTSIDE_TEST/);
  if (previous) process.env.NODE_ENV = previous;
});

test("runtime enforces policy, schema, metering, and hashes", async () => {
  process.env.NODE_ENV = "test";
  const runtime = new MirRuntime(new Map([["contract-test", new ContractTestProvider(() => ({ value: "supported" }))]]), routes, new BudgetLedger(1, 2));
  assert.deepEqual(await runtime.invoke<{ value: string }>(request), { value: "supported" });
  assert.equal(runtime.runs.length, 1);
  assert.equal(runtime.runs[0].status, "succeeded");
  assert.match(runtime.runs[0].inputHash, /^[a-f0-9]{64}$/);
  assert.equal(runtime.runs[0].subjectIds[0], "student:1");
});

test("schema-invalid provider output fails closed", async () => {
  process.env.NODE_ENV = "test";
  const runtime = new MirRuntime(new Map([["contract-test", new ContractTestProvider(() => ({ wrong: true }))]]), routes, new BudgetLedger(1, 2));
  await assert.rejects(runtime.invoke(request), /SCHEMA_VALIDATION_FAILED/);
  assert.equal(runtime.runs[0].status, "failed");
});

test("restricted data needs explicit provider approval", async () => {
  process.env.NODE_ENV = "test";
  const runtime = new MirRuntime(new Map([["contract-test", new ContractTestProvider(() => ({ value: "x" }))]]), routes, new BudgetLedger(1, 2));
  const restricted: MirRequest = { ...request, context: { ...context, dataClasses: ["student_provided"] } };
  await assert.rejects(runtime.invoke(restricted), (error: unknown) => error instanceof PolicyDenied && error.code === "RESTRICTED_DATA_PROVIDER_UNAPPROVED");
});

test("student cannot invoke profile synthesis", async () => {
  process.env.NODE_ENV = "test";
  const runtime = new MirRuntime(new Map([["contract-test", new ContractTestProvider(() => ({ value: "x" }))]]), routes, new BudgetLedger(1, 2));
  const student = { ...request, context: { ...context, role: "student" as const } };
  await assert.rejects(runtime.invoke(student), (error: unknown) => error instanceof PolicyDenied && error.code === "ROLE_FEATURE_DENIED");
});

test("budget and global kill switch stop calls before provider execution", async () => {
  process.env.NODE_ENV = "test";
  let calls = 0;
  const provider = new ContractTestProvider(() => { calls += 1; return { value: "x" }; });
  const expensive = { ...routes, reasoning_high: { ...baseRoute, outputUsdPerMillion: 1_000_000 } };
  await assert.rejects(new MirRuntime(new Map([["contract-test", provider]]), expensive, new BudgetLedger(1, 2)).invoke(request), BudgetExceeded);
  await assert.rejects(new MirRuntime(new Map([["contract-test", provider]]), routes, new BudgetLedger(1, 2), () => false).invoke(request), /KILL_SWITCH/);
  assert.equal(calls, 0);
});

test("OpenAI adapter ignores generic key and requires MIR-scoped credential", async () => {
  const provider = new OpenAIResponsesProvider({ OPENAI_API_KEY: "generic-is-not-authority" });
  assert.deepEqual(await provider.health(), { configured: false, detail: "MIR_OPENAI_API_KEY is missing" });
  await assert.rejects(provider.invoke(request, "gpt-5.6-sol"), ProviderConfigurationError);
});

test("OpenAI adapter sends Responses structured-output contract without storage", async () => {
  let captured: Record<string, unknown> | undefined;
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    captured = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "resp_1", status: "completed", output_text: "{\"value\":\"ok\"}", usage: { input_tokens: 12, output_tokens: 4 } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const provider = new OpenAIResponsesProvider({ MIR_OPENAI_API_KEY: "test-placeholder", MIR_OPENAI_RESTRICTED_DATA_APPROVED: "false" }, fakeFetch);
  const result = await provider.invoke(request, "gpt-5.6-sol");
  assert.equal(captured?.store, false);
  assert.deepEqual(captured?.text, { format: { type: "json_schema", name: "claim", strict: true, schema: request.output.schema } });
  assert.equal(result.providerRequestId, "resp_1");
  assert.deepEqual(result.payload, { value: "ok" });
});
