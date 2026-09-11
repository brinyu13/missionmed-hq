import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { normalizeProviderRoute } from "../src/research-router.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";
import { runResearchWorkerOnce } from "../tools/start-research-worker.mjs";

test("migration 011 installs a forced-RLS spend ledger and exact combined cap", async () => {
  const sql = await fs.readFile(new URL("../sql/011_provider_benchmark_on_demand_canary.sql", import.meta.url), "utf8");
  assert.match(sql, /budget_cap_usd <= 12[.]0000/);
  assert.match(sql, /actual_spend_usd \+ reserved_spend_usd <= budget_cap_usd/);
  assert.match(sql, /research_spend_ledger ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /research_spend_ledger FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /'OPENAI_TERRA', 'gpt-5[.]6-terra'/);
  assert.match(sql, /'OPENAI_SOL', 'gpt-5[.]6-sol'/);
});

test("only authorized Terra and Sol routes may spend in benchmark mode", () => {
  for (const providerKey of ["OPENAI_TERRA", "OPENAI_SOL"]) {
    const route = normalizeProviderRoute({
      providerKey, modelKey: providerKey === "OPENAI_TERRA" ? "gpt-5.6-terra" : "gpt-5.6-sol",
      state: "BENCHMARKING", enabled: true, networkAllowed: true, spendAllowed: true,
      budgetCapUsd: 6, concurrencyCap: 1,
    });
    assert.equal(route.spendAllowed, true);
  }
  assert.throws(() => normalizeProviderRoute({
    providerKey: "PARALLEL", modelKey: "legacy", state: "BENCHMARKING",
    enabled: true, networkAllowed: true, spendAllowed: true, budgetCapUsd: 1,
  }), /authorized OpenAI/);
});

test("live admin controls can promote a benchmark winner to production approved", async () => {
  const app = await fs.readFile(new URL("../web/app.js", import.meta.url), "utf8");
  assert.match(app, /setOpenAiProviderMode\('\$\{esc\(p[.]providerKey\)\}','PRODUCTION_APPROVED'\)/);
  assert.match(app, /mode === 'BENCHMARKING' \|\| mode === 'PRODUCTION_APPROVED'/);
  assert.match(app, /enabled:active, networkAllowed:active, spendAllowed:active/);
  assert.match(app, /researchSourceIndex = new Map\(\)/);
  assert.match(app, /Approved canonical research dossier source/);
});

test("existing quota windows adopt the live configured quota without invalidating prior use", async () => {
  const adapter = await fs.readFile(new URL("../adapters/postgres-runtime.mjs", import.meta.url), "utf8");
  assert.match(adapter, /quota_limit = greatest\(\$2::integer, reserved_count \+ consumed_count\)/);
});

test("promoted stable-identity facts project into release-specific Program Files by ACGME ID", async () => {
  const adapter = await fs.readFile(new URL("../adapters/postgres-runtime.mjs", import.meta.url), "utf8");
  assert.match(adapter, /LEFT JOIN rise_runtime[.]canonical_program_identities i\s+ON i[.]program_identity_id = f[.]subject_id/);
  assert.match(adapter, /coalesce\(s[.]metadata->>'acgmeId', i[.]acgme_id::text\) = \$2/);
});

test("benchmark worker result is isolated from canonical ingestion", async () => {
  const calls = [];
  const store = {
    async claimNextJob() { return { job: { jobId: "bench", taskClass: "PROVIDER_BENCHMARK", providerKey: "OPENAI_TERRA" }, leaseToken: "lease" }; },
    async transitionJob({ status }) { calls.push(status); },
    async completeJob(input) { calls.push(`complete:${input.status}`); return { jobId: input.jobId, status: input.status }; },
    async failJob() { calls.push("fail"); },
  };
  const providers = new Map([["OPENAI_TERRA", {
    providerKey: "OPENAI_TERRA",
    async execute() { return { providerKey: "OPENAI_TERRA", modelKey: "gpt-5.6-terra", actualCostUsd: 0.01, findingCount: 1, ingest: { claims: [] } }; },
  }]]);
  const canonicalStore = { async ingestProviderRecord() { calls.push("canonical-ingest"); } };
  await runResearchWorkerOnce({ store, providers, canonicalStore, workerId: "worker" });
  assert.deepEqual(calls, ["RUNNING", "NORMALIZING", "PROMOTING", "complete:COMPLETED"]);
});

test("review allows only Holdout A under an exact 5012E allowance and preserves Holdout B", () => {
  const ingest = (acgmeId) => ({ acgmeId, claims: [{
    id: `claim-${acgmeId}`, field: "research.visa", provider: "OPENAI",
    value: { j1: true }, sourceUrls: ["https://example.edu/visa"], directSourceUrls: ["https://example.edu/visa"],
  }] });
  assert.equal(reviewResearchCorpus([ingest("1854831078")], {
    resolvedAcgmeIds: new Set(["1854831078"]), allowedCanaryAcgmeIds: new Set(["1854831078"]),
  }).promotions.length, 1);
  assert.throws(() => reviewResearchCorpus([ingest("1851113100")], {
    resolvedAcgmeIds: new Set(["1851113100"]), allowedCanaryAcgmeIds: new Set(["1854831078"]),
  }), /without an exact 5012E allowance/);
});
