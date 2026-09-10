import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sql = fs.readFileSync(fileURLToPath(new URL("../sql/010_full_evidence_promotion.sql", import.meta.url)), "utf8");
const down = fs.readFileSync(fileURLToPath(new URL("../sql/010_full_evidence_promotion.down.sql", import.meta.url)), "utf8");

test("migration 010 is additive, append-only, RLS-forced, and enumerates every final disposition", () => {
  for (const disposition of [
    "APPROVED_CURRENT", "APPROVED_HISTORICAL", "RESEARCHED_NOT_FOUND", "SUPERSEDED",
    "CONFLICT_REQUIRES_REVIEW", "INSUFFICIENT_EVIDENCE", "STALE_NEEDS_REFRESH", "IDENTITY_AMBIGUITY",
  ]) assert.match(sql, new RegExp(`'${disposition}'`));
  assert.match(sql, /evidence_claim_review_events ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /evidence_claim_review_events FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /canonical_claim_promotion_lineage ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /reject_canonical_evidence_mutation/);
  assert.match(sql, /MISSIONMED_REVIEW/);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE)\s+TABLE\b/i);
  assert.doesNotMatch(down, /\b(?:DROP|TRUNCATE|DELETE)\b/i);
});
