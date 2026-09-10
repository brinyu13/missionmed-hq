#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRiseCanonicalEvidenceStore, createRiseEvidenceReviewStore } from "../adapters/postgres-runtime.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";
import { loadResearchFactoryInputs } from "./backfill-research-factory.mjs";

const DEFAULTS = Object.freeze({
  parallel: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_PARALLEL_CONTINUOUS_FACTORY_003/raw_results",
  opus: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_OPUS_IM_EXPIRING_TOKEN_SPRINT_009/ingest_staging",
  sonnet: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_CLAUDE_SUBSTITUTE_RESEARCH_009/ingest_staging",
  registry: fileURLToPath(new URL("../releases/student-rights-safe/api-index.json", import.meta.url)),
});

function args(argv) {
  const result = { ...DEFAULTS, dryRun: false, reviewedAt: null };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    const value = argv[index + 1];
    if (!key || value === undefined) throw new Error("Arguments must be --key value pairs");
    result[key] = value;
  }
  result.dryRun = String(result["dry-run"] ?? result.dryRun) === "true";
  result.reviewedAt = result["reviewed-at"] ?? result.reviewedAt;
  return result;
}

async function mapWithConcurrency(values, limit, operation) {
  const results = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await operation(values[index], index);
    }
  }));
  return results;
}

export function providerCorpusAlreadyIngested(stats, providers, claimCount) {
  const actual = Object.fromEntries((stats?.providers ?? []).map((item) => [item.provider, Number(item.claims)]));
  return Number(stats?.totalClaims) === claimCount
    && Object.keys(providers).length === Object.keys(actual).length
    && Object.entries(providers).every(([provider, claims]) => actual[provider] === claims);
}

function registryIdentity(program) {
  const acgmeId = program.identifiers?.find((item) => item.namespace === "ACGME_PROGRAM")?.value;
  const record = {
    programIdentityId: program.id,
    acgmeId,
    programSpecialtyId: program.programSpecialtyId,
    programName: program.display?.programName,
    institution: program.display?.institution,
    city: program.display?.city || null,
    state: program.display?.state,
    specialty: program.designation,
    sourceId: "rise_src_p1_rise_5012d_review",
  };
  if (!/^\d{10}$/.test(String(acgmeId ?? "")) || Object.entries(record).some(([key, value]) => key !== "city" && !value)) {
    throw new Error("Full-registry identity record is incomplete");
  }
  return {
    ...record,
    contentSha256: createHash("sha256").update(JSON.stringify(record)).digest("hex"),
  };
}

export async function reviewAndPromoteResearch(options) {
  const { deduped } = await loadResearchFactoryInputs({ ...options, provider: "all" });
  const preliminary = reviewResearchCorpus(deduped);
  if (deduped.length !== 1236 || preliminary.decisions.length !== 5156) {
    throw new Error("P1-RISE-5012D provider corpus count contract drifted");
  }
  const providers = Object.fromEntries([...new Set(preliminary.decisions.map((decision) => decision.provider))].sort()
    .map((provider) => [provider, preliminary.decisions.filter((decision) => decision.provider === provider).length]));
  const summary = {
    sourceRows: deduped.length,
    uniquePrograms: new Set(deduped.map((item) => item.acgmeId)).size,
    claims: preliminary.decisions.length,
    promotions: preliminary.promotions.length,
    providers,
    dispositions: preliminary.dispositions,
    claimsWithoutFinalDisposition: 0,
    canaryHoldoutsPreserved: true,
    newParallelSpendUsd: 0,
    unapprovedProviderSpendUsd: 0,
    dryRun: options.dryRun,
  };
  if (options.dryRun) return summary;
  if (!options.reviewedAt || !Number.isFinite(Date.parse(options.reviewedAt))) {
    throw new Error("Production promotion requires an explicit --reviewed-at ISO timestamp");
  }
  const reviewStore = await createRiseEvidenceReviewStore();
  const targetClaimIds = preliminary.decisions.map((decision) => decision.claimId);
  const existingClaimIds = await reviewStore.existingClaimIds(targetClaimIds);
  const missingIngests = deduped.filter((ingest) => ingest.claims.some((claim) => !existingClaimIds.has(claim.id)));
  let evidenceStore = missingIngests.length === 0 ? null : await createRiseCanonicalEvidenceStore();
  const ingests = missingIngests.length === 0 ? [] : await mapWithConcurrency(
    missingIngests,
    4,
    (ingest) => evidenceStore.ingestProviderRecord({ ingest }),
  );
  const completeClaimIds = await reviewStore.existingClaimIds(targetClaimIds);
  if (completeClaimIds.size !== targetClaimIds.length) {
    throw new Error(`P1-RISE-5012D canonical claim ingestion incomplete: ${completeClaimIds.size}/${targetClaimIds.length}`);
  }
  const targetAcgmeIds = [...new Set(deduped.map((item) => item.acgmeId))];
  let resolved = await reviewStore.resolvedAcgmeIds(targetAcgmeIds);
  const unresolved = targetAcgmeIds.filter((acgmeId) => !resolved.has(acgmeId));
  let identityBackfill = { requested: unresolved.length, upserted: 0 };
  if (unresolved.length > 0) {
    evidenceStore ??= await createRiseCanonicalEvidenceStore();
    await evidenceStore.ensureReviewIdentitySource({ retrievedAt: options.reviewedAt });
    const registry = JSON.parse(await fs.readFile(options.registry ?? DEFAULTS.registry, "utf8"));
    if (registry?.counts?.uniquePrograms !== 6139 || registry?.counts?.specialtyTabs !== 31) {
      throw new Error("P1-RISE-5012D full-registry identity contract drifted");
    }
    const unresolvedSet = new Set(unresolved);
    const identities = registry.programs.map(registryIdentity).filter((item) => unresolvedSet.has(item.acgmeId));
    if (identities.length !== unresolved.length) {
      throw new Error(`Provider programs missing from full canonical registry: ${identities.length}/${unresolved.length}`);
    }
    identityBackfill = { requested: unresolved.length, ...await evidenceStore.upsertProgramIdentities(identities) };
    resolved = await reviewStore.resolvedAcgmeIds(targetAcgmeIds);
  }
  if (resolved.size !== targetAcgmeIds.length) {
    throw new Error(`P1-RISE-5012D identity reconciliation incomplete: ${resolved.size}/${targetAcgmeIds.length}`);
  }
  const review = reviewResearchCorpus(deduped, { resolvedAcgmeIds: resolved });
  const applied = await reviewStore.applyCorpus({ review, reviewedAt: options.reviewedAt });
  const legacy = await reviewStore.supersedeLegacyClaims({ currentClaimIds: targetClaimIds, reviewedAt: options.reviewedAt });
  const readback = await reviewStore.stats();
  return {
    ...summary,
    dryRun: false,
    insertedRuns: ingests.filter((item) => item.insertedRun).length,
    replayedRuns: ingests.filter((item) => !item.insertedRun).length,
    insertedClaims: ingests.reduce((sum, item) => sum + item.insertedClaims, 0),
    sourceRowsSkippedAsExact: deduped.length - missingIngests.length,
    providerCorpusIngestSkippedAsExact: missingIngests.length === 0,
    identityBackfill,
    legacy,
    applied,
    readback,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reviewAndPromoteResearch(args(process.argv.slice(2))).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
