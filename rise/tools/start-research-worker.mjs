#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import http from "node:http";
import { pathToFileURL } from "node:url";

import { createReplayResearchProvider } from "../adapters/research-replay-provider.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";

const workerId = process.env.RISE_RESEARCH_WORKER_ID || `rise-research-worker-${randomUUID()}`;
const adapterPath = process.env.RISE_RESEARCH_ADAPTER_MODULE || "/app/adapters/postgres-runtime.mjs";
const pollMs = Math.min(30_000, Math.max(250, Number(process.env.RISE_RESEARCH_WORKER_POLL_MS) || 5_000));

export async function loadResearchProviders(specification = process.env.RISE_RESEARCH_PROVIDER_MODULES || "") {
  const providers = new Map([["RISE_REPLAY_TEST", createReplayResearchProvider()]]);
  const modules = String(specification).split(",").map((value) => value.trim()).filter(Boolean);
  for (const modulePath of modules) {
    const loaded = await import(pathToFileURL(modulePath).href);
    const loadedProviders = typeof loaded.createResearchProviders === "function"
      ? await loaded.createResearchProviders()
      : [await loaded.createResearchProvider?.()];
    for (const provider of loadedProviders) {
      if (!provider?.providerKey || typeof provider.execute !== "function" || providers.has(provider.providerKey)) {
        throw new Error(`Research provider module is invalid or duplicated: ${modulePath}`);
      }
      providers.set(provider.providerKey, provider);
    }
  }
  return providers;
}

export async function runResearchWorkerOnce({
  store, provider, providers, canonicalStore, evidenceReviewStore,
  workerId: id = workerId, leaseSeconds = 180, heartbeatIntervalMs = null,
} = {}) {
  const claimed = await store.claimNextJob({ workerId: id, leaseSeconds });
  if (!claimed) return null;
  const { job, leaseToken } = claimed;
  let result = null;
  let heartbeatTimer = null;
  let heartbeatPending = null;
  let heartbeatError = null;
  const stopHeartbeat = async () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (heartbeatPending) await heartbeatPending;
    if (heartbeatError) throw heartbeatError;
  };
  try {
    const selectedProvider = provider || providers?.get(job.providerKey);
    if (!selectedProvider || (!provider && selectedProvider.providerKey !== job.providerKey)) {
      throw Object.assign(new Error(`No worker adapter is loaded for ${job.providerKey}`), {
        code: "RESEARCH_PROVIDER_ADAPTER_UNAVAILABLE",
      });
    }
    await store.transitionJob({ jobId: job.jobId, leaseToken, workerId: id, status: "RUNNING", leaseSeconds });
    if (typeof store.heartbeatJob === "function") {
      const heartbeatEveryMs = heartbeatIntervalMs === null
        ? Math.max(5_000, Math.min(30_000, Math.floor(leaseSeconds * 1_000 / 3)))
        : Math.max(10, Number(heartbeatIntervalMs) || 10);
      heartbeatTimer = setInterval(() => {
        if (heartbeatPending || heartbeatError) return;
        heartbeatPending = store.heartbeatJob({ jobId: job.jobId, leaseToken, workerId: id, leaseSeconds })
          .catch((error) => { heartbeatError = error; })
          .finally(() => { heartbeatPending = null; });
      }, heartbeatEveryMs);
    }
    result = await selectedProvider.execute({ job });
    await store.transitionJob({ jobId: job.jobId, leaseToken, workerId: id, status: "NORMALIZING", leaseSeconds });
    let canonicalIngestRunId = null;
    let reviewReceipt = null;
    const benchmarkOnly = job.taskClass === "PROVIDER_BENCHMARK";
    if (result.ingest && !benchmarkOnly) {
      if (!canonicalStore?.ingestProviderRecord) {
        throw Object.assign(new Error("Canonical provider ingestion store is unavailable"), {
          code: "CANONICAL_INGEST_STORE_UNAVAILABLE",
        });
      }
      canonicalIngestRunId = (await canonicalStore.ingestProviderRecord({ ingest: result.ingest })).ingestRunId;
      if (result.canonicalPromotion !== "PROMOTED" && (!evidenceReviewStore?.resolvedAcgmeIds || !evidenceReviewStore?.applyCorpus)) {
        throw Object.assign(new Error("Canonical evidence review store is unavailable"), {
          code: "CANONICAL_REVIEW_STORE_UNAVAILABLE",
        });
      }
      if (result.canonicalPromotion !== "PROMOTED") {
        const resolvedAcgmeIds = await evidenceReviewStore.resolvedAcgmeIds([job.acgmeId]);
        const review = reviewResearchCorpus([result.ingest], {
          resolvedAcgmeIds,
          allowedCanaryAcgmeIds: new Set(["1854831078", "1851113100"]),
        });
        reviewReceipt = await evidenceReviewStore.applyCorpus({
          review,
          actorSubject: "P1-RISE-5012F",
          reviewedAt: new Date().toISOString(),
          ticket: "P1-RISE-5012F",
          promotionSourceId: "rise_src_p1_rise_5012f_review",
        });
      }
    }
    await store.transitionJob({ jobId: job.jobId, leaseToken, workerId: id, status: "PROMOTING", leaseSeconds });
    const promoted = Boolean(canonicalIngestRunId
      && (result.canonicalPromotion === "PROMOTED" || reviewReceipt?.insertedPromotions > 0));
    const status = benchmarkOnly ? "COMPLETED"
      : promoted ? (result.dossierOutcome === "DEEP" ? "COMPLETED" : "PARTIAL")
        : "NEEDS_REVIEW";
    const resultSummary = {
      providerKey: result.providerKey, modelKey: result.modelKey,
      providerResponseId: result.providerResponseId, networkUsed: result.networkUsed,
      newSpendUsd: result.actualCostUsd ?? result.newSpendUsd ?? 0,
      latencyMs: result.latencyMs, usage: result.usage ?? {}, webSearchCalls: result.webSearchCalls ?? 0,
      researchSummary: result.researchSummary, findingCount: result.findingCount ?? 0,
      benchmarkFindings: benchmarkOnly ? (result.benchmarkFindings ?? []) : undefined,
      benchmarkMetrics: benchmarkOnly ? (result.benchmarkMetrics ?? {}) : undefined,
      canonicalPromotion: benchmarkOnly ? "BENCHMARK_ISOLATED" : (result.canonicalPromotion === "PROMOTED" || reviewReceipt?.insertedPromotions > 0 ? "PROMOTED" : "NEEDS_REVIEW"),
      reviewReceipt,
      contractId: result.contractId,
      contractVersion: result.contractVersion,
      resultSchemaVersion: result.resultSchemaVersion,
      requestClass: result.requestClass,
      requestedDomains: result.requestedDomains,
      requestedFields: result.requestedFields,
      completionMatrix: result.completionMatrix,
      completionScore: result.completionScore,
      dossierOutcome: result.dossierOutcome,
      researchTimestamp: result.researchTimestamp,
    };
    await stopHeartbeat();
    return await store.completeJob({
      jobId: job.jobId,
      leaseToken,
      workerId: id,
      status,
      resultSummary,
      canonicalIngestRunId,
      actualCostUsd: result.actualCostUsd ?? result.newSpendUsd ?? 0,
      usage: result.usage ?? {},
      providerResponseId: result.providerResponseId ?? null,
      dossier: benchmarkOnly ? null : {
        completionMatrix: result.completionMatrix,
        completionScore: result.completionScore,
        dossierOutcome: result.dossierOutcome,
        researchTimestamp: result.researchTimestamp,
        resultSchemaVersion: result.resultSchemaVersion,
      },
    });
  } catch (error) {
    try { await stopHeartbeat(); } catch (heartbeatFailure) { error = heartbeatFailure; }
    await store.failJob({
      jobId: job.jobId,
      leaseToken,
      workerId: id,
      errorCode: error.code || "RESEARCH_WORKER_FAILED",
      errorSummary: error.message,
      actualCostUsd: error.actualCostUsd ?? result?.actualCostUsd ?? result?.newSpendUsd ?? 0,
      usage: error.usage ?? result?.usage ?? {},
      providerResponseId: error.providerResponseId ?? result?.providerResponseId ?? null,
      unknownCost: error.costKnown === false || (result === null && error.code === "RESEARCH_JOB_LEASE_LOST"),
    });
    throw error;
  }
}

export async function startResearchWorker() {
  const adapter = await import(pathToFileURL(adapterPath).href);
  if (typeof adapter.createRiseResearchStore !== "function") {
    throw new Error("RISE research adapter must export createRiseResearchStore()");
  }
  const store = await adapter.createRiseResearchStore();
  const canonicalStore = typeof adapter.createRiseCanonicalEvidenceStore === "function"
    ? await adapter.createRiseCanonicalEvidenceStore()
    : null;
  const evidenceReviewStore = typeof adapter.createRiseEvidenceReviewStore === "function"
    ? await adapter.createRiseEvidenceReviewStore()
    : null;
  const providers = await loadResearchProviders();
  let stopping = false;
  const healthServer = http.createServer(async (request, response) => {
    if (request.url !== "/api/rise/v1/health" && request.url !== "/health") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end('{"error":"not_found"}\n');
      return;
    }
    try {
      const health = await store.health();
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(`${JSON.stringify({ ok: true, service: "rise-research-worker", providers: [...providers.keys()], spendUsd: Number(health.actualSpendUsd ?? 0), queue: { total: health.total, active: health.active } })}\n`);
    } catch {
      response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end('{"ok":false,"service":"rise-research-worker"}\n');
    }
  });
  await new Promise((resolve) => healthServer.listen(Number(process.env.PORT || 4178), "0.0.0.0", resolve));
  const stop = () => { stopping = true; healthServer.close(); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  console.log(JSON.stringify({ event: "rise_research_worker_started", workerId, providers: [...providers.keys()], pollMs, spend: 0 }));
  while (!stopping) {
    try {
      const result = await runResearchWorkerOnce({ store, providers, canonicalStore, evidenceReviewStore });
      if (result) console.log(JSON.stringify({ event: "rise_research_job_finished", workerId, jobId: result.jobId, status: result.status, actualCostUsd: result.actualCostUsd ?? 0 }));
    } catch (error) {
      console.error(JSON.stringify({ event: "rise_research_job_error", workerId, code: error.code || "RESEARCH_WORKER_FAILED", message: error.message }));
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  console.log(JSON.stringify({ event: "rise_research_worker_stopped", workerId }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await startResearchWorker();
