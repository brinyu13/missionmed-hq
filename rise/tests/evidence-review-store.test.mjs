import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { databaseEvidenceSourceUrl } from "../adapters/postgres-runtime.mjs";

const source = fs.readFileSync(fileURLToPath(new URL("../adapters/postgres-runtime.mjs", import.meta.url)), "utf8");

test("production adapter uses one canonical append-only review and promotion path", () => {
  assert.match(source, /createRiseEvidenceReviewStore/);
  assert.match(source, /evidence_claim_review_events/);
  assert.match(source, /canonical_claim_promotion_lineage/);
  assert.match(source, /source_attributed_reconciled/);
  assert.match(source, /newProviderSpendUsd: 0/);
  assert.doesNotMatch(source, /UPDATE rise_runtime\.canonical_evidence_claims/);
});

test("database source projection preserves provenance while selecting a constraint-safe URL", () => {
  assert.equal(databaseEvidenceSourceUrl([
    "http://legacy.example.test/source",
    "https://current.example.test/source",
  ]), "https://current.example.test/source");
  assert.equal(databaseEvidenceSourceUrl(["http://legacy.example.test/source"]), null);
});
