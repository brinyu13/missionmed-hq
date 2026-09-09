#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import http from "node:http";
import { pathToFileURL } from "node:url";

import { createReplayResearchProvider } from "../adapters/research-replay-provider.mjs";

const workerId = process.env.RISE_RESEARCH_WORKER_ID || `rise-research-worker-${randomUUID()}`;
const adapterPath = process.env.RISE_RESEARCH_ADAPTER_MODULE || "/app/adapters/postgres-runtime.mjs";
const pollMs = Math.min(30_000, Math.max(250, Number(process.env.RISE_RESEARCH_WORKER_POLL_MS) || 5_000));

export async function loadResearchProviders(specification = process.env.RISE_RESEARCH_PROVIDER_MODULES || "") {
  const providers = new Map([["RISE_REPLAY_TEST", createReplayResearchProvider()]]);
  const modules = String(specification).split(",").map((value) => value.trim()).filter(Boolean);
  for (const modulePath of modules) {
    const loaded = await import(pathToFileURL(modulePath).href);
    if (typeof loaded.createResearchProvider !== "function") {
      throw new Error(`Research provider module must export createResearchProvider(): ${modulePath}`);
    }
    const provider = await loaded.createResearchProvider();
    if (!provider?.providerKey || typeof provider.execute !== "function" || providers.has(provider.providerKey)) {
      throw new Error(`Research provider module is invalid or duplicated: ${modulePath}`);
    }
    providers.set(provider.providerKey, provider);
  }
  return providers;
}

export async function runResearchWorkerOnce({ store, provider, providers, canonicalStore, workerId: id = workerId, leaseSeconds = 45 } = {}) {
  const claimed = await store.claimNextJob({ workerId: id, leaseSeconds });
  if (!claimed) return null;
  const { job, leaseToken } = claimed;
  try {
    const selectedProvider = provider || providers?.get(job.providerKey);
    if (!selectedProvider || (!provider && selectedProvider.providerKey !== job.providerKey)) {
      throw Object.assign(new Error(`No worker adapter is loaded for ${job.providerKey}`), {
        code: "RESEARCH_PROVIDER_ADAPTER_UNAVAILABLE",
      });
    }
    await store.transitionJob({ jobId: job.jobId, leaseToken, workerId: id, status: "RUNNING" });
    const result = await selectedProvider.execute({ job });
    await store.transitionJob({ jobId: job.jobId, leaseToken, workerId: id, status: "NORMALIZING" });
    let canonicalIngestRunId = null;
    if (result.ingest) {
      if (!canonicalStore?.ingestProviderRecord) {
        throw Object.assign(new Error("Canonical provider ingestion store is unavailable"), {
          code: "CANONICAL_INGEST_STORE_UNAVAILABLE",
        });
      }
      canonicalIngestRunId = (await canonicalStore.ingestProviderRecord({ ingest: result.ingest })).ingestRunId;
    }
    await store.transitionJob({ jobId: job.jobId, leaseToken, workerId: id, status: "PROMOTING" });
    const status = result.canonicalPromotion === "PROMOTED" && canonicalIngestRunId ? "COMPLETED" : "NEEDS_REVIEW";
    return await store.completeJob({
      jobId: job.jobId,
      leaseToken,
      workerId: id,
      status,
      resultSummary: result,
      canonicalIngestRunId,
    });
  } catch (error) {
    await store.failJob({
      jobId: job.jobId,
      leaseToken,
      workerId: id,
      errorCode: error.code || "RESEARCH_WORKER_FAILED",
      errorSummary: error.message,
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
      response.end(`${JSON.stringify({ ok: true, service: "rise-research-worker", providers: [...providers.keys()], spendUsd: 0, queue: { total: health.total, active: health.active } })}\n`);
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
      const result = await runResearchWorkerOnce({ store, providers, canonicalStore });
      if (result) console.log(JSON.stringify({ event: "rise_research_job_finished", workerId, jobId: result.jobId, status: result.status, actualCostUsd: 0 }));
    } catch (error) {
      console.error(JSON.stringify({ event: "rise_research_job_error", workerId, code: error.code || "RESEARCH_WORKER_FAILED", message: error.message }));
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  console.log(JSON.stringify({ event: "rise_research_worker_stopped", workerId }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await startResearchWorker();
