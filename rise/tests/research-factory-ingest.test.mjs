import assert from "node:assert/strict";
import test from "node:test";
import { extractEvidenceUrls, normalizeParallelRawResearchRecord, normalizeResearchFactoryRecord } from "../adapters/research-factory-ingest.mjs";

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
  const sonnetRecord = fixture("CLAUDE-SUBSTITUTE-009");
  const sonnet = normalizeResearchFactoryRecord({ record: sonnetRecord, sourceBytes: Buffer.from(JSON.stringify(sonnetRecord)), sourceFile: "claude-sonnet/1400000000.json" });
  assert.equal(parallel.provider, "PARALLEL");
  assert.equal(opus.provider, "CLAUDE_OPUS");
  assert.equal(sonnet.provider, "CLAUDE_SONNET");
  assert.notEqual(parallel.idempotencyKey, opus.idempotencyKey);
  assert.notEqual(sonnet.idempotencyKey, opus.idempotencyKey);
  for (const ingest of [parallel, opus, sonnet]) {
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

test("raw Parallel results reproduce the original safe-fact staging contract and retain evidence URLs", () => {
  const raw = {
    run: { metadata: { acgme_id: "1400000000" }, modified_at: "2026-08-29T00:00:00.000Z" },
    output: { content: {
      visa: { j1: "YES", source_url: "https://program.example/visa" },
      abim: { pass_rate: "NOT_FOUND" },
      img_accessibility: { signal: "observed" },
      caribbean_accessibility: { signal: "unknown" },
      do_accessibility: { signal: "observed" },
      leadership: [{ name: "Review Person" }], resident_roster: [], fellowship_inventory: ["Cardiology"],
      sources: ["https://program.example/home"], conflicts: [],
    } },
  };
  const normalized = normalizeParallelRawResearchRecord({
    record: raw, sourceBytes: Buffer.from(JSON.stringify(raw)), sourceFile: "parallel-raw/example.json",
  });
  assert.equal(normalized.provider, "PARALLEL");
  assert.equal(normalized.claims.length, 7);
  assert.equal(normalized.claims.find((claim) => claim.field === "research.visa").sourceUrl, "https://program.example/home");
  assert.ok(normalized.claims.find((claim) => claim.field === "research.visa").sourceUrls.includes("https://program.example/visa"));
  assert.match(normalized.claims.find((claim) => claim.field === "research.leadership").sourceLocator, /#\/needs_review\/leadership$/);
  assert.ok(normalized.claims.every((claim) => claim.publicationState === "REVIEW_REQUIRED"));
  assert.deepEqual(extractEvidenceUrls({ source: "See https://a.example/x." }), ["https://a.example/x"]);
});
