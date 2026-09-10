import assert from "node:assert/strict";
import test from "node:test";
import { backfillResearchFactory } from "../tools/backfill-research-factory.mjs";

test("completed Parallel, Opus, and Sonnet inputs deduplicate into one zero-spend canonical backfill", async () => {
  const summary = await backfillResearchFactory({
    dryRun: true,
    provider: "all",
    parallel: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_PARALLEL_CONTINUOUS_FACTORY_003/ingest_staging",
    opus: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_OPUS_IM_EXPIRING_TOKEN_SPRINT_009/ingest_staging",
    sonnet: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_CLAUDE_SUBSTITUTE_RESEARCH_009/ingest_staging",
  });
  assert.equal(summary.completedInputFiles, 2042);
  assert.equal(summary.duplicateCompletedInputs, 965);
  assert.equal(summary.uniqueIngests, 1077);
  assert.deepEqual(summary.providers, { CLAUDE_OPUS: 270, CLAUDE_SONNET: 695, PARALLEL: 112 });
  assert.equal(summary.claims, 3984);
  assert.deepEqual(summary.publicationStates, { REVIEW_REQUIRED: 3984 });
  assert.equal(summary.newParallelSpendUsd, 0);
});
