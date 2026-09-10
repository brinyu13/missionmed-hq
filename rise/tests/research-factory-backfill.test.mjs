import assert from "node:assert/strict";
import test from "node:test";
import { backfillResearchFactory } from "../tools/backfill-research-factory.mjs";

test("the completed provider corpus has the exact 5012D accounting contract", async () => {
  const result = await backfillResearchFactory({
    dryRun: true,
    provider: "all",
    parallel: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_PARALLEL_CONTINUOUS_FACTORY_003/raw_results",
    opus: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_OPUS_IM_EXPIRING_TOKEN_SPRINT_009/ingest_staging",
    sonnet: "/Users/brianb/MissionMed/_AI_HANDOFFS/from_claude_code/P1_RISE_CLAUDE_SUBSTITUTE_RESEARCH_009/ingest_staging",
  });
  assert.deepEqual(result.providers, { CLAUDE_OPUS: 270, CLAUDE_SONNET: 695, PARALLEL: 271 });
  assert.equal(result.completedInputFiles, 1236);
  assert.equal(result.uniqueIngests, 1236);
  assert.equal(result.uniquePrograms, 1077);
  assert.equal(result.claims, 5156);
  assert.equal(result.newParallelSpendUsd, 0);
});
