import assert from "node:assert/strict";
import test from "node:test";
import { backfillResearchFactory } from "../tools/backfill-research-factory.mjs";

test("completed Parallel and Claude inputs deduplicate into one zero-spend canonical backfill", async () => {
  const summary = await backfillResearchFactory({
    dryRun: true,
    provider: "both",
    parallel: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_PARALLEL_CONTINUOUS_FACTORY_003/ingest_staging",
    opus: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_OPUS_IM_EXPIRING_TOKEN_SPRINT_009/ingest_staging",
  });
  assert.equal(summary.completedInputFiles, 811);
  assert.equal(summary.duplicateCompletedInputs, 270);
  assert.equal(summary.uniqueIngests, 541);
  assert.deepEqual(summary.providers, { CLAUDE_OPUS: 270, PARALLEL: 271 });
  assert.equal(summary.claims, 3040);
  assert.deepEqual(summary.publicationStates, { REVIEW_REQUIRED: 3040 });
  assert.equal(summary.newParallelSpendUsd, 0);
});
