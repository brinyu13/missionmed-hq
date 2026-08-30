-- P1-RISE-5008 provider-neutral canonical evidence bridge.
-- Additive, RLS-forced, append-only evidence. It preserves the existing RISE
-- registry and Student Intel tables and authorizes no paid provider work.

BEGIN;

CREATE TABLE rise_runtime.release_source_rights (
  release_id text NOT NULL REFERENCES rise_runtime.registry_releases(release_id),
  source text NOT NULL CHECK (btrim(source) <> ''),
  authorization_sha256 char(64) NOT NULL CHECK (authorization_sha256 ~ '^[0-9a-f]{64}$'),
  rights_evidence_sha256 char(64) NOT NULL CHECK (rights_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  authorization_basis text NOT NULL CHECK (authorization_basis IN (
    'government_public_domain_factual_projection',
    'bounded_historical_cycle_projection'
  )),
  decision_record_id text NOT NULL CHECK (btrim(decision_record_id) <> ''),
  valid_through date NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, source),
  UNIQUE (release_id, authorization_sha256)
);

CREATE TABLE rise_runtime.canonical_evidence_sources (
  source_id text PRIMARY KEY CHECK (btrim(source_id) <> ''),
  provider text NOT NULL CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'NRMP_SOAP_CLOSURE', 'STUDENT_INTEL')),
  provider_run_id text NOT NULL CHECK (btrim(provider_run_id) <> ''),
  source_type text NOT NULL CHECK (btrim(source_type) <> ''),
  source_url text CHECK (source_url IS NULL OR (source_url ~ '^https://' AND length(source_url) <= 2048)),
  source_file_sha256 char(64) CHECK (source_file_sha256 IS NULL OR source_file_sha256 ~ '^[0-9a-f]{64}$'),
  source_locator text CHECK (source_locator IS NULL OR length(source_locator) <= 2048),
  retrieved_at timestamptz NOT NULL,
  rights_state text NOT NULL CHECK (rights_state IN ('APPROVED', 'REVIEW_REQUIRED', 'REJECTED')),
  exposure_state text NOT NULL CHECK (exposure_state IN ('STUDENT_VISIBLE', 'PRIVATE_BETA', 'REVIEW_REQUIRED', 'INTERNAL_ONLY', 'REJECTED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_run_id)
);

CREATE TABLE rise_runtime.canonical_evidence_claims (
  claim_id text PRIMARY KEY CHECK (btrim(claim_id) <> ''),
  subject_id text NOT NULL CHECK (btrim(subject_id) <> ''),
  field text NOT NULL CHECK (btrim(field) <> '' AND length(field) <= 256),
  knowledge jsonb NOT NULL CHECK (jsonb_typeof(knowledge) = 'object'),
  canonical_value jsonb NOT NULL,
  assertion_class text NOT NULL CHECK (btrim(assertion_class) <> ''),
  publication_state text NOT NULL CHECK (publication_state IN ('STUDENT_VISIBLE', 'PRIVATE_BETA', 'REVIEW_REQUIRED', 'INTERNAL_ONLY', 'REJECTED')),
  review_state text NOT NULL CHECK (btrim(review_state) <> ''),
  conflict_state text NOT NULL DEFAULT 'NONE' CHECK (conflict_state IN ('NONE', 'CONFLICTING', 'RESOLVED')),
  source_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_sources(source_id),
  source_locator text CHECK (source_locator IS NULL OR length(source_locator) <= 2048),
  observed_period jsonb NOT NULL DEFAULT '{"kind":"not_stated"}'::jsonb CHECK (jsonb_typeof(observed_period) = 'object'),
  retrieved_at timestamptz NOT NULL,
  content_sha256 char(64) NOT NULL UNIQUE CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  supersedes_claim_id text REFERENCES rise_runtime.canonical_evidence_claims(claim_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (publication_state NOT IN ('STUDENT_VISIBLE', 'PRIVATE_BETA') OR review_state = 'APPROVED')
);

CREATE INDEX rise_canonical_evidence_subject_field_idx
  ON rise_runtime.canonical_evidence_claims (subject_id, field, retrieved_at DESC);
CREATE INDEX rise_canonical_evidence_review_queue_idx
  ON rise_runtime.canonical_evidence_claims (review_state, source_id, retrieved_at)
  INCLUDE (subject_id, field)
  WHERE publication_state = 'REVIEW_REQUIRED';

CREATE TABLE rise_runtime.canonical_program_identities (
  program_identity_id text PRIMARY KEY CHECK (btrim(program_identity_id) <> ''),
  acgme_id char(10) NOT NULL UNIQUE CHECK (acgme_id ~ '^[0-9]{10}$'),
  program_specialty_id text NOT NULL UNIQUE CHECK (btrim(program_specialty_id) <> ''),
  program_name text NOT NULL CHECK (btrim(program_name) <> ''),
  institution text NOT NULL CHECK (btrim(institution) <> ''),
  city text,
  state text NOT NULL CHECK (btrim(state) <> ''),
  specialty text NOT NULL CHECK (btrim(specialty) <> ''),
  reconciliation_status text NOT NULL CHECK (reconciliation_status IN ('EXACT_ACGME_MATCH', 'REVIEW_REQUIRED')),
  exposure_state text NOT NULL CHECK (exposure_state IN ('PRIVATE_BETA', 'INTERNAL_ONLY')),
  source_id text NOT NULL REFERENCES rise_runtime.canonical_evidence_sources(source_id),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (updated_at >= created_at),
  CHECK ((reconciliation_status = 'EXACT_ACGME_MATCH' AND exposure_state = 'PRIVATE_BETA') OR
         (reconciliation_status = 'REVIEW_REQUIRED' AND exposure_state = 'INTERNAL_ONLY'))
);

CREATE TABLE rise_runtime.provider_ingest_runs (
  ingest_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key char(64) NOT NULL UNIQUE CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'NRMP_SOAP_CLOSURE')),
  campaign_id text NOT NULL CHECK (btrim(campaign_id) <> ''),
  acgme_id char(10) CHECK (acgme_id IS NULL OR acgme_id ~ '^[0-9]{10}$'),
  source_file text NOT NULL CHECK (btrim(source_file) <> '' AND length(source_file) <= 1024),
  source_file_sha256 char(64) NOT NULL CHECK (source_file_sha256 ~ '^[0-9a-f]{64}$'),
  staged_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('INGESTED', 'PARTIAL', 'REVIEW_REQUIRED', 'FAILED')),
  new_spend_usd numeric(10,4) NOT NULL DEFAULT 0 CHECK (new_spend_usd = 0),
  claim_count integer NOT NULL CHECK (claim_count >= 0),
  replay_count integer NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION rise_runtime.reject_canonical_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_runtime
AS $$
BEGIN
  RAISE EXCEPTION 'RISE canonical evidence and sources are append-only';
END
$$;

CREATE TRIGGER rise_canonical_sources_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.canonical_evidence_sources
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_canonical_evidence_mutation();
CREATE TRIGGER rise_canonical_claims_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.canonical_evidence_claims
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_canonical_evidence_mutation();

CREATE VIEW rise_runtime.canonical_current_facts
WITH (security_invoker = true, security_barrier = true)
AS
SELECT DISTINCT ON (subject_id, field)
  claim_id, subject_id, field, knowledge, canonical_value, assertion_class,
  publication_state, source_id, observed_period, retrieved_at, content_sha256
FROM rise_runtime.canonical_evidence_claims
WHERE review_state = 'APPROVED'
  AND conflict_state <> 'CONFLICTING'
  AND publication_state IN ('STUDENT_VISIBLE', 'PRIVATE_BETA')
ORDER BY subject_id, field, retrieved_at DESC, created_at DESC, claim_id;

ALTER TABLE rise_runtime.release_source_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.release_source_rights FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_evidence_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_evidence_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_evidence_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_program_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.canonical_program_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.provider_ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.provider_ingest_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_release_source_rights_read ON rise_runtime.release_source_rights
  FOR SELECT TO rise_app_runtime USING (true);
CREATE POLICY rise_release_source_rights_admin_write ON rise_runtime.release_source_rights
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_canonical_sources_projection ON rise_runtime.canonical_evidence_sources
  FOR SELECT TO rise_app_runtime
  USING (exposure_state IN ('STUDENT_VISIBLE', 'PRIVATE_BETA') OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_canonical_sources_admin_insert ON rise_runtime.canonical_evidence_sources
  FOR INSERT TO rise_app_runtime WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_canonical_claims_projection ON rise_runtime.canonical_evidence_claims
  FOR SELECT TO rise_app_runtime
  USING (publication_state IN ('STUDENT_VISIBLE', 'PRIVATE_BETA') OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_canonical_claims_admin_insert ON rise_runtime.canonical_evidence_claims
  FOR INSERT TO rise_app_runtime WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_canonical_identity_projection ON rise_runtime.canonical_program_identities
  FOR SELECT TO rise_app_runtime
  USING (exposure_state = 'PRIVATE_BETA' OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_canonical_identity_admin_write ON rise_runtime.canonical_program_identities
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_provider_ingest_admin ON rise_runtime.provider_ingest_runs
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');

REVOKE ALL ON rise_runtime.release_source_rights FROM PUBLIC;
REVOKE ALL ON rise_runtime.canonical_evidence_sources FROM PUBLIC;
REVOKE ALL ON rise_runtime.canonical_evidence_claims FROM PUBLIC;
REVOKE ALL ON rise_runtime.canonical_program_identities FROM PUBLIC;
REVOKE ALL ON rise_runtime.provider_ingest_runs FROM PUBLIC;
REVOKE ALL ON rise_runtime.canonical_current_facts FROM PUBLIC;
REVOKE ALL ON FUNCTION rise_runtime.reject_canonical_evidence_mutation() FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON rise_runtime.release_source_rights TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.canonical_evidence_sources TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.canonical_evidence_claims TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.canonical_program_identities TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.provider_ingest_runs TO rise_app_runtime;
GRANT SELECT ON rise_runtime.canonical_current_facts TO rise_app_runtime;

COMMIT;
