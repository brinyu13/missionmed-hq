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

test("worker heartbeats a slow provider lease until result reconciliation", async () => {
  const calls = [];
  const store = {
    async claimNextJob() { return { job: { jobId: "job-slow" }, leaseToken: "lease-slow" }; },
    async transitionJob(input) { calls.push(`${input.status}:${input.leaseSeconds}`); },
    async heartbeatJob(input) { calls.push(`heartbeat:${input.leaseSeconds}`); },
    async completeJob(input) { calls.push(`complete:${input.status}`); return { jobId: input.jobId, status: input.status }; },
    async failJob() { calls.push("fail"); },
  };
  const provider = {
    async execute() {
      await new Promise((resolve) => setTimeout(resolve, 35));
      return { networkUsed: true, canonicalPromotion: "NOT_ATTEMPTED", actualCostUsd: 0.01 };
    },
  };
  const result = await runResearchWorkerOnce({
    store, provider, workerId: "test-worker", leaseSeconds: 180, heartbeatIntervalMs: 10,
  });
  assert.ok(calls.filter((call) => call === "heartbeat:180").length >= 2);
  assert.deepEqual(calls.filter((call) => !call.startsWith("heartbeat:")), [
    "RUNNING:180", "NORMALIZING:180", "PROMOTING:180", "complete:NEEDS_REVIEW",
  ]);
  assert.equal(result.status, "NEEDS_REVIEW");
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
    async execute() { return {
      canonicalPromotion: "PROMOTED", ingest: { fixture: true }, dossierOutcome: "DEEP",
      completionMatrix: { fixture: { state: "VERIFIED" } }, completionScore: 1,
      researchTimestamp: "2026-09-11T00:00:00.000Z", resultSchemaVersion: "fixture.v2",
    }; },
  }]]);
  const canonicalStore = { async ingestProviderRecord() { calls.push("canonical-ingest"); return { ingestRunId: "00000000-0000-4000-8000-000000000001" }; } };
  const result = await runResearchWorkerOnce({ store, providers, canonicalStore, workerId: "test-worker" });
  assert.deepEqual(calls, ["RUNNING", "NORMALIZING", "canonical-ingest", "PROMOTING", "complete:COMPLETED:00000000-0000-4000-8000-000000000001"]);
  assert.equal(result.status, "COMPLETED");
});

test("partial deep-research completion schedules one durable residue continuation without another worker charge", async () => {
  const calls = [];
  const store = {
    async claimNextJob() {
      return {
        job: {
          jobId: "job-root", providerKey: "AUTHORIZED_FIXTURE", taskClass: "PROGRAM_DEEP_RESEARCH",
          acgmeId: "1851113100",
        },
        leaseToken: "lease-root",
      };
    },
    async transitionJob(input) { calls.push(input.status); },
    async completeJob(input) {
      calls.push(`complete:${input.status}`);
      return { jobId: input.jobId, status: input.status, researchStage: "TERRA_FULL" };
    },
    async scheduleFollowup({ completedJob }) {
      calls.push(`followup:${completedJob.jobId}`);
      return { scheduled: true, job: { jobId: "job-child", researchStage: "TERRA_DELTA" } };
    },
    async failJob() { calls.push("refund"); },
  };
  const providers = new Map([["AUTHORIZED_FIXTURE", {
    providerKey: "AUTHORIZED_FIXTURE",
    async execute() {
      return {
        canonicalPromotion: "PROMOTED", ingest: { fixture: true }, dossierOutcome: "PARTIAL",
        completionMatrix: { identity_structure: { state: "VERIFIED" } }, completionScore: 0.8,
        researchTimestamp: "2026-09-11T00:00:00.000Z", resultSchemaVersion: "fixture.v2",
      };
    },
  }]]);
  const canonicalStore = {
    async ingestProviderRecord() { return { ingestRunId: "00000000-0000-4000-8000-000000000002" }; },
  };
  const result = await runResearchWorkerOnce({ store, providers, canonicalStore, workerId: "test-worker" });
  assert.deepEqual(calls, ["RUNNING", "NORMALIZING", "PROMOTING", "complete:PARTIAL", "followup:job-root"]);
  assert.equal(result.autoCompletion.scheduled, true);
  assert.equal(result.autoCompletion.job.researchStage, "TERRA_DELTA");
});

test("completed deep research does not schedule a residue continuation", async () => {
  let followups = 0;
  const store = {
    async claimNextJob() {
      return { job: { jobId: "job-deep", providerKey: "AUTHORIZED_FIXTURE", taskClass: "PROGRAM_DEEP_RESEARCH" }, leaseToken: "lease-deep" };
    },
    async transitionJob() {},
    async completeJob(input) { return { jobId: input.jobId, status: input.status }; },
    async scheduleFollowup() { followups += 1; },
    async failJob() {},
  };
  const providers = new Map([["AUTHORIZED_FIXTURE", {
    providerKey: "AUTHORIZED_FIXTURE",
    async execute() {
      return { canonicalPromotion: "PROMOTED", ingest: { fixture: true }, dossierOutcome: "DEEP" };
    },
  }]]);
  const canonicalStore = { async ingestProviderRecord() { return { ingestRunId: "00000000-0000-4000-8000-000000000003" }; } };
  const result = await runResearchWorkerOnce({ store, providers, canonicalStore, workerId: "test-worker" });
  assert.equal(result.status, "COMPLETED");
  assert.equal(followups, 0);
});
