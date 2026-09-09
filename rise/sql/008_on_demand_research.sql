-- P1-RISE-5012A production-durable on-demand research control plane.
-- Additive, private-schema-only, zero-spend by default and fail-closed.

BEGIN;

CREATE TABLE rise_runtime.research_router_settings (
  control_id boolean PRIMARY KEY DEFAULT true CHECK (control_id = true),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  global_enabled boolean NOT NULL DEFAULT false,
  student_enabled boolean NOT NULL DEFAULT false,
  emergency_kill_switch boolean NOT NULL DEFAULT true,
  specialty_scope text[] NOT NULL DEFAULT ARRAY['Neurology']::text[]
    CHECK (cardinality(specialty_scope) BETWEEN 1 AND 32),
  state_scope text[] NOT NULL DEFAULT ARRAY['FL', 'TX']::text[]
    CHECK (cardinality(state_scope) BETWEEN 1 AND 64),
  canary_mode text NOT NULL DEFAULT 'PROGRAM_ID_ALLOWLIST'
    CHECK (canary_mode = 'PROGRAM_ID_ALLOWLIST'),
  canary_acgme_ids text[] NOT NULL DEFAULT ARRAY['1854831078', '1851113100']::text[]
    CHECK (cardinality(canary_acgme_ids) BETWEEN 1 AND 100),
  entitlement_scope text[] NOT NULL DEFAULT ARRAY['rise:private-beta']::text[]
    CHECK (cardinality(entitlement_scope) BETWEEN 1 AND 32),
  subject_allowlist_hashes char(64)[] NOT NULL DEFAULT ARRAY[]::char(64)[]
    CHECK (cardinality(subject_allowlist_hashes) <= 100),
  default_quota integer NOT NULL DEFAULT 1 CHECK (default_quota BETWEEN 0 AND 100),
  quota_window_days integer NOT NULL DEFAULT 30 CHECK (quota_window_days BETWEEN 1 AND 366),
  budget_cap_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (budget_cap_usd >= 0),
  actual_spend_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (actual_spend_usd = 0),
  concurrency_cap integer NOT NULL DEFAULT 1 CHECK (concurrency_cap BETWEEN 1 AND 32),
  primary_provider text NOT NULL DEFAULT 'RISE_REPLAY_TEST' CHECK (btrim(primary_provider) <> ''),
  fallback_provider text,
  escalation_provider text,
  updated_by_subject_key char(64) NOT NULL DEFAULT repeat('0', 64)
    CHECK (updated_by_subject_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (updated_at >= created_at)
);

CREATE TABLE rise_runtime.research_provider_routes (
  provider_key text PRIMARY KEY CHECK (provider_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  model_key text NOT NULL CHECK (btrim(model_key) <> '' AND length(model_key) <= 128),
  state text NOT NULL CHECK (state IN ('TEST_ONLY', 'BENCHMARKING', 'PRODUCTION_APPROVED', 'PAUSED')),
  enabled boolean NOT NULL DEFAULT false,
  network_allowed boolean NOT NULL DEFAULT false,
  spend_allowed boolean NOT NULL DEFAULT false,
  budget_cap_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (budget_cap_usd >= 0),
  actual_spend_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (actual_spend_usd = 0),
  concurrency_cap integer NOT NULL DEFAULT 1 CHECK (concurrency_cap BETWEEN 1 AND 32),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(configuration) = 'object'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_by_subject_key char(64) NOT NULL DEFAULT repeat('0', 64)
    CHECK (updated_by_subject_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (updated_at >= created_at),
  CHECK (state = 'PRODUCTION_APPROVED' OR spend_allowed = false),
  CHECK (provider_key <> 'RISE_REPLAY_TEST' OR (
    state = 'TEST_ONLY' AND network_allowed = false AND spend_allowed = false AND budget_cap_usd = 0
  ))
);

ALTER TABLE rise_runtime.research_router_settings
  ADD CONSTRAINT rise_research_primary_provider_fk
  FOREIGN KEY (primary_provider) REFERENCES rise_runtime.research_provider_routes(provider_key);
ALTER TABLE rise_runtime.research_router_settings
  ADD CONSTRAINT rise_research_fallback_provider_fk
  FOREIGN KEY (fallback_provider) REFERENCES rise_runtime.research_provider_routes(provider_key);
ALTER TABLE rise_runtime.research_router_settings
  ADD CONSTRAINT rise_research_escalation_provider_fk
  FOREIGN KEY (escalation_provider) REFERENCES rise_runtime.research_provider_routes(provider_key);

INSERT INTO rise_runtime.research_provider_routes (
  provider_key, model_key, state, enabled, network_allowed, spend_allowed,
  budget_cap_usd, concurrency_cap
) VALUES
  ('RISE_REPLAY_TEST', 'deterministic-private-replay-v1', 'TEST_ONLY', true, false, false, 0, 1),
  ('PARALLEL', 'unconfigured', 'PAUSED', false, false, false, 0, 1),
  ('CLAUDE_OPUS', 'unconfigured', 'PAUSED', false, false, false, 0, 1);

INSERT INTO rise_runtime.research_router_settings (control_id) VALUES (true);

CREATE TABLE rise_runtime.research_quota_ledgers (
  subject_key char(64) NOT NULL CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  window_start date NOT NULL,
  window_end date NOT NULL,
  quota_limit integer NOT NULL CHECK (quota_limit BETWEEN 0 AND 100),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  consumed_count integer NOT NULL DEFAULT 0 CHECK (consumed_count >= 0),
  refunded_count integer NOT NULL DEFAULT 0 CHECK (refunded_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_key, window_start),
  CHECK (window_end > window_start),
  CHECK (reserved_count + consumed_count <= quota_limit),
  CHECK (updated_at >= created_at)
);

CREATE TABLE rise_runtime.research_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key char(64) NOT NULL UNIQUE CHECK (dedupe_key ~ '^[0-9a-f]{64}$'),
  release_id text NOT NULL CHECK (btrim(release_id) <> ''),
  program_specialty_id text NOT NULL CHECK (btrim(program_specialty_id) <> '' AND length(program_specialty_id) <= 128),
  acgme_id char(10) NOT NULL CHECK (acgme_id ~ '^[0-9]{10}$'),
  specialty text NOT NULL CHECK (btrim(specialty) <> '' AND length(specialty) <= 128),
  state_code char(2) NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  requester_subject_key char(64) NOT NULL CHECK (requester_subject_key ~ '^[0-9a-f]{64}$'),
  request_source text NOT NULL CHECK (request_source IN ('STUDENT', 'ADMIN')),
  task_class text NOT NULL DEFAULT 'PROGRAM_DEEP_RESEARCH'
    CHECK (task_class IN ('PROGRAM_DEEP_RESEARCH')),
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING',
    'COMPLETED', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'REFUNDED', 'PAUSED'
  )),
  provider_key text NOT NULL REFERENCES rise_runtime.research_provider_routes(provider_key),
  model_key text NOT NULL CHECK (btrim(model_key) <> '' AND length(model_key) <= 128),
  router_revision bigint NOT NULL CHECK (router_revision >= 1),
  quota_window_start date NOT NULL,
  estimated_cost_usd numeric(12,4) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd = 0),
  actual_cost_usd numeric(12,4) CHECK (actual_cost_usd IS NULL OR actual_cost_usd = 0),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  worker_id text CHECK (worker_id IS NULL OR (btrim(worker_id) <> '' AND length(worker_id) <= 128)),
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  result_summary jsonb CHECK (result_summary IS NULL OR jsonb_typeof(result_summary) = 'object'),
  canonical_ingest_run_id uuid,
  error_code text CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,64}$'),
  error_summary text CHECK (error_summary IS NULL OR length(error_summary) <= 1000),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (requester_subject_key, quota_window_start)
    REFERENCES rise_runtime.research_quota_ledgers(subject_key, window_start),
  CHECK (updated_at >= created_at),
  CHECK ((lease_token IS NULL AND lease_expires_at IS NULL) OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (provider_key <> 'RISE_REPLAY_TEST' OR estimated_cost_usd = 0)
);

CREATE INDEX rise_research_job_queue_idx
  ON rise_runtime.research_jobs (status, created_at, job_id)
  WHERE status IN ('QUEUED', 'PAUSED');
CREATE INDEX rise_research_job_subject_idx
  ON rise_runtime.research_jobs (requester_subject_key, created_at DESC);
CREATE INDEX rise_research_job_program_idx
  ON rise_runtime.research_jobs (program_specialty_id, created_at DESC);
CREATE INDEX rise_research_job_lease_idx
  ON rise_runtime.research_jobs (lease_expires_at)
  WHERE status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING');

CREATE TABLE rise_runtime.research_job_attempts (
  attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES rise_runtime.research_jobs(job_id),
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  provider_key text NOT NULL REFERENCES rise_runtime.research_provider_routes(provider_key),
  model_key text NOT NULL CHECK (btrim(model_key) <> ''),
  status text NOT NULL CHECK (status IN (
    'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING', 'COMPLETED',
    'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'REFUNDED'
  )),
  worker_id text NOT NULL CHECK (btrim(worker_id) <> '' AND length(worker_id) <= 128),
  error_code text CHECK (error_code IS NULL OR error_code ~ '^[A-Z0-9_]{1,64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (job_id, attempt_number, status),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE rise_runtime.research_control_audit_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_subject_key char(64) NOT NULL CHECK (actor_subject_key ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action ~ '^[A-Z0-9_]{1,64}$'),
  target_type text NOT NULL CHECK (target_type IN ('ROUTER', 'PROVIDER', 'JOB', 'QUOTA', 'WORKER')),
  target_id text NOT NULL CHECK (btrim(target_id) <> '' AND length(target_id) <= 128),
  before_state jsonb CHECK (before_state IS NULL OR jsonb_typeof(before_state) = 'object'),
  after_state jsonb CHECK (after_state IS NULL OR jsonb_typeof(after_state) = 'object'),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION rise_runtime.reject_research_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rise_runtime
AS $$
BEGIN
  RAISE EXCEPTION 'RISE research attempts and audit records are immutable';
END
$$;

CREATE TRIGGER rise_research_attempts_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.research_job_attempts
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_research_audit_mutation();
CREATE TRIGGER rise_research_control_audit_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.research_control_audit_events
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_research_audit_mutation();

ALTER TABLE rise_runtime.research_router_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_router_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_provider_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_provider_routes FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_quota_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_quota_ledgers FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_job_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_control_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_control_audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_research_router_admin ON rise_runtime.research_router_settings
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_provider_admin ON rise_runtime.research_provider_routes
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_quota_owner_read ON rise_runtime.research_quota_ledgers
  FOR SELECT TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_quota_owner_write ON rise_runtime.research_quota_ledgers
  FOR ALL TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_job_owner_read ON rise_runtime.research_jobs
  FOR SELECT TO rise_app_runtime
  USING (requester_subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_job_owner_insert ON rise_runtime.research_jobs
  FOR INSERT TO rise_app_runtime
  WITH CHECK (requester_subject_key = current_setting('rise.subject_key', true) OR current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_job_admin_update ON rise_runtime.research_jobs
  FOR UPDATE TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_attempt_admin ON rise_runtime.research_job_attempts
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
CREATE POLICY rise_research_audit_admin ON rise_runtime.research_control_audit_events
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');

REVOKE ALL ON rise_runtime.research_router_settings FROM PUBLIC;
REVOKE ALL ON rise_runtime.research_provider_routes FROM PUBLIC;
REVOKE ALL ON rise_runtime.research_quota_ledgers FROM PUBLIC;
REVOKE ALL ON rise_runtime.research_jobs FROM PUBLIC;
REVOKE ALL ON rise_runtime.research_job_attempts FROM PUBLIC;
REVOKE ALL ON rise_runtime.research_control_audit_events FROM PUBLIC;
REVOKE ALL ON FUNCTION rise_runtime.reject_research_audit_mutation() FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON rise_runtime.research_router_settings TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.research_provider_routes TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.research_quota_ledgers TO rise_app_runtime;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.research_jobs TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.research_job_attempts TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.research_control_audit_events TO rise_app_runtime;
GRANT USAGE, SELECT ON SEQUENCE rise_runtime.research_job_attempts_attempt_id_seq TO rise_app_runtime;
GRANT USAGE, SELECT ON SEQUENCE rise_runtime.research_control_audit_events_event_id_seq TO rise_app_runtime;

COMMIT;
