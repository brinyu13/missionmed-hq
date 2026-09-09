import assert from "node:assert/strict";
import { test } from "node:test";

import { createReplayResearchProvider } from "../adapters/research-replay-provider.mjs";
import { runResearchWorkerOnce } from "../tools/start-research-worker.mjs";

test("replay provider is offline, zero-spend, and does not fabricate canonical evidence", async () => {
  const result = await createReplayResearchProvider().execute({
    job: { jobId: "job-1", programSpecialtyId: "ps-1", acgmeId: "acgme-1", specialty: "Neurology", state: "TX" },
  });
  assert.equal(result.networkUsed, false);
  assert.equal(result.newSpendUsd, 0);
  assert.equal(result.canonicalPromotion, "NOT_ATTEMPTED");
  assert.equal(result.publicationState, "INTERNAL_ONLY");
});

test("worker claims, transitions, and closes an infrastructure-only replay", async () => {
  const calls = [];
  const store = {
    async claimNextJob() { calls.push("claim"); return { job: { jobId: "job-1" }, leaseToken: "lease-1" }; },
    async transitionJob(input) { calls.push(input.status); },
    async completeJob(input) { calls.push(`complete:${input.status}`); return { jobId: "job-1", status: input.status }; },
    async failJob() { calls.push("fail"); },
  };
  const result = await runResearchWorkerOnce({ store, provider: createReplayResearchProvider(), workerId: "test-worker" });
  assert.deepEqual(calls, ["claim", "RUNNING", "NORMALIZING", "PROMOTING", "complete:NEEDS_REVIEW"]);
  assert.deepEqual(result, { jobId: "job-1", status: "NEEDS_REVIEW" });
});

test("worker failure invokes the durable refund transition", async () => {
  const calls = [];
  const store = {
    async claimNextJob() { return { job: { jobId: "job-refund" }, leaseToken: "lease-refund" }; },
    async transitionJob(input) { calls.push(input.status); },
    async completeJob() { calls.push("complete"); },
    async failJob(input) { calls.push(`refund:${input.jobId}:${input.errorCode}`); },
  };
  const provider = { async execute() { throw Object.assign(new Error("fixture failure"), { code: "FIXTURE_FAILURE" }); } };
  await assert.rejects(
    runResearchWorkerOnce({ store, provider, workerId: "test-worker" }),
    /fixture failure/,
  );
  assert.deepEqual(calls, ["RUNNING", "refund:job-refund:FIXTURE_FAILURE"]);
});

test("provider-neutral worker selects the routed adapter and records canonical ingest custody", async () => {
  const calls = [];
  const store = {
    async claimNextJob() { return { job: { jobId: "job-provider", providerKey: "AUTHORIZED_FIXTURE" }, leaseToken: "lease-provider" }; },
    async transitionJob(input) { calls.push(input.status); },
    async completeJob(input) { calls.push(`complete:${input.status}:${input.canonicalIngestRunId}`); return { jobId: input.jobId, status: input.status }; },
    async failJob() { calls.push("refund"); },
  };
  const providers = new Map([["AUTHORIZED_FIXTURE", {
    providerKey: "AUTHORIZED_FIXTURE",
    async execute() { return { canonicalPromotion: "PROMOTED", ingest: { fixture: true } }; },
  }]]);
  const canonicalStore = { async ingestProviderRecord() { calls.push("canonical-ingest"); return { ingestRunId: "00000000-0000-4000-8000-000000000001" }; } };
  const result = await runResearchWorkerOnce({ store, providers, canonicalStore, workerId: "test-worker" });
  assert.deepEqual(calls, ["RUNNING", "NORMALIZING", "canonical-ingest", "PROMOTING", "complete:COMPLETED:00000000-0000-4000-8000-000000000001"]);
  assert.equal(result.status, "COMPLETED");
});
