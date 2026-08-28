-- P1-RISE-5005 isolated rights-safe runtime.
-- Additive and forward-only: application rollback does not drop student state,
-- source decisions, request budgets, or release provenance.

BEGIN;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_app_runtime') THEN
    CREATE ROLE rise_app_runtime NOLOGIN;
  END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS rise_runtime;
REVOKE ALL ON SCHEMA rise_runtime FROM PUBLIC;

CREATE TABLE rise_runtime.registry_releases (
  release_id text PRIMARY KEY,
  projection text NOT NULL CHECK (projection IN ('STUDENT_RIGHTS_SAFE_RISE')),
  api_index_sha256 char(64) NOT NULL CHECK (api_index_sha256 ~ '^[0-9a-f]{64}$'),
  index_manifest_sha256 char(64) NOT NULL CHECK (index_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  program_count integer NOT NULL CHECK (program_count >= 0),
  rights_blocked_field_count integer NOT NULL CHECK (rights_blocked_field_count >= 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (projection = 'STUDENT_RIGHTS_SAFE_RISE')
);

CREATE UNIQUE INDEX rise_runtime_one_active_release_idx
  ON rise_runtime.registry_releases (active) WHERE active = true;

CREATE TABLE rise_runtime.source_authorizations (
  release_id text NOT NULL REFERENCES rise_runtime.registry_releases(release_id),
  source text NOT NULL,
  authorization_sha256 char(64) NOT NULL CHECK (authorization_sha256 ~ '^[0-9a-f]{64}$'),
  rights_evidence_sha256 char(64) NOT NULL CHECK (rights_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  authorization_basis text NOT NULL CHECK (authorization_basis = 'government_public_domain_factual_projection'),
  decision_record_id text NOT NULL CHECK (btrim(decision_record_id) <> ''),
  valid_through date NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (release_id, source),
  UNIQUE (release_id, authorization_sha256)
);

CREATE TABLE rise_runtime.registry_programs (
  release_id text NOT NULL REFERENCES rise_runtime.registry_releases(release_id),
  program_specialty_id text NOT NULL,
  public_record jsonb NOT NULL CHECK (jsonb_typeof(public_record) = 'object'),
  PRIMARY KEY (release_id, program_specialty_id)
);

CREATE TABLE rise_runtime.student_program_states (
  subject_key char(64) NOT NULL CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  release_id text NOT NULL,
  program_specialty_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('SAVED', 'APPLIED', 'INTERVIEWING', 'RANKED')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_key, program_specialty_id),
  FOREIGN KEY (release_id, program_specialty_id)
    REFERENCES rise_runtime.registry_programs(release_id, program_specialty_id),
  CHECK (updated_at >= created_at)
);

CREATE INDEX rise_runtime_student_state_updated_idx
  ON rise_runtime.student_program_states (subject_key, updated_at DESC);

ALTER TABLE rise_runtime.student_program_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_program_states FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_runtime_student_subject_isolation
  ON rise_runtime.student_program_states
  FOR ALL
  TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true))
  WITH CHECK (subject_key = current_setting('rise.subject_key', true));

CREATE TABLE rise_runtime.request_budget_windows (
  budget_key text NOT NULL CHECK (btrim(budget_key) <> ''),
  window_start timestamptz NOT NULL,
  request_cost bigint NOT NULL CHECK (request_cost >= 0),
  PRIMARY KEY (budget_key, window_start)
);

REVOKE ALL ON ALL TABLES IN SCHEMA rise_runtime FROM PUBLIC;
GRANT USAGE ON SCHEMA rise_runtime TO rise_app_runtime;
GRANT SELECT ON rise_runtime.registry_releases, rise_runtime.source_authorizations, rise_runtime.registry_programs TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON rise_runtime.student_program_states TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON rise_runtime.request_budget_windows TO rise_app_runtime;

COMMIT;
