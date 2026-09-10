import assert from "node:assert/strict";
import test from "node:test";
import { providerCorpusAlreadyIngested, reviewAndPromoteResearch } from "../tools/review-promote-research.mjs";

test("exact provider readback skips costly replay without weakening the count contract", () => {
  const providers = { CLAUDE_OPUS: 977, CLAUDE_SONNET: 2116, PARALLEL: 2063 };
  const stats = {
    totalClaims: 5156,
    providers: Object.entries(providers).map(([provider, claims]) => ({ provider, claims })),
  };
  assert.equal(providerCorpusAlreadyIngested(stats, providers, 5156), true);
  assert.equal(providerCorpusAlreadyIngested({ ...stats, totalClaims: 5155 }, providers, 5156), false);
});

test("5012D dry run accounts for every provider claim without spend", async () => {
  const result = await reviewAndPromoteResearch({
    dryRun: true,
    parallel: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_PARALLEL_CONTINUOUS_FACTORY_003/raw_results",
    opus: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_OPUS_IM_EXPIRING_TOKEN_SPRINT_009/ingest_staging",
    sonnet: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_CLAUDE_SUBSTITUTE_RESEARCH_009/ingest_staging",
  });
  assert.equal(result.claims, 5156);
  assert.equal(result.claimsWithoutFinalDisposition, 0);
  assert.deepEqual(result.providers, { CLAUDE_OPUS: 977, CLAUDE_SONNET: 2116, PARALLEL: 2063 });
  assert.equal(Object.values(result.dispositions).reduce((sum, count) => sum + count, 0), 5156);
  assert.equal(result.canaryHoldoutsPreserved, true);
  assert.equal(result.newParallelSpendUsd, 0);
});
