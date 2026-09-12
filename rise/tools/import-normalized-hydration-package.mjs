#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createRiseCanonicalEvidenceStore, createRiseEvidenceReviewStore } from "../adapters/postgres-runtime.mjs";
import { loadNormalizedHydrationPackage } from "../adapters/normalized-hydration-package-ingest.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";

const DEFAULT_PACKAGE = fileURLToPath(new URL("../config/research-packages/tx-fl-adult-neurology-2026-09-12.v1", import.meta.url));
const DEFAULT_REGISTRY = fileURLToPath(new URL("../releases/student-rights-safe/api-index.json", import.meta.url));
const TICKET = "P1-RISE-5012J";
const PROMOTION_SOURCE_ID = "rise_src_p1_rise_5012j_review";

function args(argv) {
  const result = { packageRoot: DEFAULT_PACKAGE, registryPath: DEFAULT_REGISTRY, apply: false, reviewedAt: null };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error("Arguments must be --key value pairs");
    if (key === "package") result.packageRoot = value;
    else if (key === "registry") result.registryPath = value;
    else if (key === "apply") result.apply = value === "true";
    else if (key === "reviewed-at") result.reviewedAt = value;
    else throw new Error(`Unknown argument: --${key}`);
  }
  return result;
}

export async function importNormalizedHydrationPackage(options = args([])) {
  const loaded = await loadNormalizedHydrationPackage(options.packageRoot, { registryPath: options.registryPath });
  if (!options.apply) return { ...loaded.summary, apply: false };
  if (!options.reviewedAt || !Number.isFinite(Date.parse(options.reviewedAt))) throw new Error("Production import requires --reviewed-at ISO timestamp");
  const evidenceStore = await createRiseCanonicalEvidenceStore();
  const reviewStore = await createRiseEvidenceReviewStore();
  await evidenceStore.ensureReviewIdentitySource({
    retrievedAt: options.reviewedAt, sourceId: PROMOTION_SOURCE_ID, ticket: TICKET,
    sourceLocator: `${TICKET}/tx-fl-adult-neurology-identity-reconciliation`,
  });
  const identityReadback = await evidenceStore.upsertProgramIdentities(loaded.identities);
  const resolved = await reviewStore.resolvedAcgmeIds(loaded.summary.acgmeIds);
  if (resolved.size !== loaded.summary.programs) throw new Error(`Canonical identity readback incomplete: ${resolved.size}/${loaded.summary.programs}`);
  const targetClaimIds = loaded.ingests.flatMap((ingest) => ingest.claims.map((claim) => claim.id));
  const before = await reviewStore.existingClaimIds(targetClaimIds);
  const ingestResults = [];
  for (const ingest of loaded.ingests.filter((item) => item.claims.some((claim) => !before.has(claim.id)))) {
    ingestResults.push(await evidenceStore.ingestProviderRecord({ ingest }));
  }
  const after = await reviewStore.existingClaimIds(targetClaimIds);
  if (after.size !== targetClaimIds.length) throw new Error(`Canonical claim ingestion incomplete: ${after.size}/${targetClaimIds.length}`);
  const review = reviewResearchCorpus(loaded.ingests, { resolvedAcgmeIds: resolved });
  const applied = await reviewStore.applyCorpus({
    review, actorSubject: TICKET, reviewedAt: options.reviewedAt,
    ticket: TICKET, promotionSourceId: PROMOTION_SOURCE_ID,
  });
  return {
    ...loaded.summary, apply: true, identityReadback,
    insertedRuns: ingestResults.filter((item) => item.insertedRun).length,
    replayedRuns: ingestResults.filter((item) => !item.insertedRun).length,
    insertedClaims: ingestResults.reduce((sum, item) => sum + item.insertedClaims, 0),
    dispositions: review.dispositions, promotions: review.promotions.length,
    applied, readback: await reviewStore.stats(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importNormalizedHydrationPackage(args(process.argv.slice(2))).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
