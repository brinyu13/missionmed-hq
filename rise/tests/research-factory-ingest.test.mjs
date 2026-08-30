import assert from "node:assert/strict";
import test from "node:test";
import { normalizeResearchFactoryRecord } from "../adapters/research-factory-ingest.mjs";

function fixture(campaignId = "RISE-BOOTSTRAP-001") {
  return {
    acgme_id: "1400000000",
    campaign_id: campaignId,
    staged_at: "2026-08-29T00:00:00.000Z",
    safe_facts: { visa: { j1: "YES", source_url: "https://example.test/program" } },
    needs_review: { resident_roster: [{ name: "Private Review Person" }] },
    source_result: "/read-only/normalized/1400000000.json",
  };
}

test("provider-neutral normalization converges Parallel and Claude without auto-publishing people or roster facts", () => {
  const parallelBytes = Buffer.from(JSON.stringify(fixture()));
  const parallel = normalizeResearchFactoryRecord({ record: fixture(), sourceBytes: parallelBytes, sourceFile: "parallel/1400000000.json" });
  const opusRecord = fixture("CLAUDE-SPRINT-009");
  const opus = normalizeResearchFactoryRecord({ record: opusRecord, sourceBytes: Buffer.from(JSON.stringify(opusRecord)), sourceFile: "claude-opus/1400000000.json" });
  assert.equal(parallel.provider, "PARALLEL");
  assert.equal(opus.provider, "CLAUDE_OPUS");
  assert.notEqual(parallel.idempotencyKey, opus.idempotencyKey);
  for (const ingest of [parallel, opus]) {
    assert.equal(ingest.claims.length, 2);
    assert.ok(ingest.claims.every((claim) => claim.publicationState === "REVIEW_REQUIRED"));
    assert.ok(ingest.claims.every((claim) => claim.reviewState !== "APPROVED"));
  }
  assert.throws(() => normalizeResearchFactoryRecord({
    record: { ...fixture(), campaign_id: "UNAUTHORIZED-PAID-CAMPAIGN" },
    sourceBytes: Buffer.from("{}"),
    sourceFile: "unknown.json",
  }), /Unsupported completed research campaign/);
});
