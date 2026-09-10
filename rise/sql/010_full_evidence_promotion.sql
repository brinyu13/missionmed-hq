-- P1-RISE-5012D additive review ledger and canonical promotion lineage.
-- Canonical evidence remains append-only; a review never mutates its source claim.

BEGIN;

ALTER TABLE rise_runtime.canonical_evidence_sources
  DROP CONSTRAINT canonical_evidence_sources_provider_check;
ALTER TABLE rise_runtime.canonical_evidence_sources
  ADD CONSTRAINT canonical_evidence_sources_provider_check
  CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'NRMP_SOAP_CLOSURE', 'STUDENT_INTEL', 'MISSIONMED_REVIEW'));

CREATE TABLE rise_runtime.evidence_claim_review_events (
  review_id text PRIMARY KEY CHECK (btrim(review_id) <> ''),
  source_claim_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_claims(claim_id),
  disposition text NOT NULL CHECK (disposition IN (
    'APPROVED_CURRENT', 'APPROVED_HISTORICAL', 'RESEARCHED_NOT_FOUND', 'SUPERSEDED',
    'CONFLICT_REQUIRES_REVIEW', 'INSUFFICIENT_EVIDENCE', 'STALE_NEEDS_REFRESH', 'IDENTITY_AMBIGUITY'
  )),
  reason_code text NOT NULL CHECK (btrim(reason_code) <> '' AND length(reason_code) <= 512),
  rule_version text NOT NULL CHECK (btrim(rule_version) <> '' AND length(rule_version) <= 128),
  normalized_value jsonb,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_urls) = 'array'),
  quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score >= 0),
  actor_subject_key char(64) NOT NULL CHECK (actor_subject_key ~ '^[0-9a-f]{64}$'),
  decision_sha256 char(64) NOT NULL UNIQUE CHECK (decision_sha256 ~ '^[0-9a-f]{64}$'),
  overrides_review_id text REFERENCES rise_runtime.evidence_claim_review_events(review_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rise_evidence_review_source_current_idx
  ON rise_runtime.evidence_claim_review_events (source_claim_id, created_at DESC, review_id DESC);
CREATE INDEX rise_evidence_review_disposition_idx
  ON rise_runtime.evidence_claim_review_events (disposition, created_at DESC);

CREATE VIEW rise_runtime.evidence_claim_review_current
WITH (security_invoker = true, security_barrier = true)
AS
SELECT DISTINCT ON (source_claim_id)
  review_id, source_claim_id, disposition, reason_code, rule_version,
  normalized_value, source_urls, quality_score, actor_subject_key,
  overrides_review_id, created_at
FROM rise_runtime.evidence_claim_review_events
ORDER BY source_claim_id, created_at DESC, review_id DESC;

CREATE TABLE rise_runtime.canonical_claim_promotion_lineage (
  promoted_claim_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_claims(claim_id),
  source_claim_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_claims(claim_id),
  review_id text NOT NULL REFERENCES rise_runtime.evidence_claim_review_events(review_id),
  contributor_order integer NOT NULL CHECK (contributor_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promoted_claim_id, source_claim_id),
  UNIQUE (promoted_claim_id, contributor_order)
);

CREATE INDEX rise_claim_promotion_source_idx
  ON rise_runtime.canonical_claim_promotion_lineage (source_claim_id, promoted_claim_id);

CREATE TRIGGER rise_evidence_review_events_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.evidence_claim_review_events
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_canonical_evidence_mutation();
CREATE TRIGGER rise_claim_promotion_lineage_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.canonical_claim_promotion_lineage
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_canonical_evidence_mutation();

ALTER TABLE rise_runtime.evidence_claim_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.evidence_claim_review_events FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_claim_promotion_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_claim_promotion_lineage FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_evidence_review_admin ON rise_runtime.evidence_claim_review_events
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_claim_promotion_lineage_admin ON rise_runtime.canonical_claim_promotion_lineage
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');

REVOKE ALL ON rise_runtime.evidence_claim_review_events FROM PUBLIC;
REVOKE ALL ON rise_runtime.evidence_claim_review_current FROM PUBLIC;
REVOKE ALL ON rise_runtime.canonical_claim_promotion_lineage FROM PUBLIC;
GRANT SELECT, INSERT ON rise_runtime.evidence_claim_review_events TO rise_app_runtime;
GRANT SELECT ON rise_runtime.evidence_claim_review_current TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.canonical_claim_promotion_lineage TO rise_app_runtime;

COMMIT;
