-- P1-RISE-5012D recoverable application rollback.
-- Preserve append-only review decisions, provenance, and promoted facts.

BEGIN;
REVOKE ALL ON rise_runtime.evidence_claim_review_events FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.evidence_claim_review_current FROM rise_app_runtime;
REVOKE ALL ON rise_runtime.canonical_claim_promotion_lineage FROM rise_app_runtime;
COMMIT;
