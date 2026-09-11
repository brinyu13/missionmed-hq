-- P1-RISE-5012E bounded OpenAI benchmark and one-program live canary.
-- Additive, private-schema-only, USD 12.00 hard cap, fail-closed by default.

BEGIN;

ALTER TABLE rise_runtime.research_router_settings
  DROP CONSTRAINT research_router_settings_actual_spend_usd_check;
ALTER TABLE rise_runtime.research_router_settings
  ADD COLUMN reserved_spend_usd numeric(12,4) NOT NULL DEFAULT 0;
ALTER TABLE rise_runtime.research_router_settings
  ADD CONSTRAINT research_router_settings_spend_nonnegative_check
    CHECK (actual_spend_usd >= 0 AND reserved_spend_usd >= 0),
  ADD CONSTRAINT research_router_settings_spend_cap_check
    CHECK (budget_cap_usd <= 12.0000 AND actual_spend_usd + reserved_spend_usd <= budget_cap_usd);

ALTER TABLE rise_runtime.research_provider_routes
  DROP CONSTRAINT research_provider_routes_actual_spend_usd_check,
  DROP CONSTRAINT research_provider_routes_state_check,
  DROP CONSTRAINT research_provider_routes_check1;
ALTER TABLE rise_runtime.research_provider_routes
  ADD COLUMN reserved_spend_usd numeric(12,4) NOT NULL DEFAULT 0;
ALTER TABLE rise_runtime.research_provider_routes
  ADD CONSTRAINT research_provider_routes_state_check
    CHECK (state IN ('DISABLED', 'CONFIGURED', 'TEST_ONLY', 'BENCHMARKING', 'PRODUCTION_APPROVED', 'PAUSED')),
  ADD CONSTRAINT research_provider_routes_spend_state_check
    CHECK (state IN ('BENCHMARKING', 'PRODUCTION_APPROVED') OR spend_allowed = false),
  ADD CONSTRAINT research_provider_routes_spend_nonnegative_check
    CHECK (actual_spend_usd >= 0 AND reserved_spend_usd >= 0),
  ADD CONSTRAINT research_provider_routes_spend_cap_check
    CHECK (actual_spend_usd + reserved_spend_usd <= budget_cap_usd);

ALTER TABLE rise_runtime.research_jobs
  DROP CONSTRAINT research_jobs_estimated_cost_usd_check,
  DROP CONSTRAINT research_jobs_actual_cost_usd_check,
  DROP CONSTRAINT research_jobs_task_class_check;
ALTER TABLE rise_runtime.research_jobs
  ADD COLUMN task_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN benchmark_batch_key text,
  ADD COLUMN benchmark_baseline jsonb;
ALTER TABLE rise_runtime.research_jobs
  ADD CONSTRAINT research_jobs_estimated_cost_usd_check
    CHECK (estimated_cost_usd >= 0 AND estimated_cost_usd <= 12.0000),
  ADD CONSTRAINT research_jobs_actual_cost_usd_check
    CHECK (actual_cost_usd IS NULL OR (actual_cost_usd >= 0 AND actual_cost_usd <= 12.0000)),
  ADD CONSTRAINT research_jobs_task_class_check
    CHECK (task_class IN ('PROGRAM_DEEP_RESEARCH', 'PROVIDER_BENCHMARK')),
  ADD CONSTRAINT research_jobs_task_payload_check
    CHECK (jsonb_typeof(task_payload) = 'object'),
  ADD CONSTRAINT research_jobs_benchmark_shape_check
    CHECK (
      (task_class = 'PROVIDER_BENCHMARK' AND benchmark_batch_key IS NOT NULL AND jsonb_typeof(benchmark_baseline) = 'object')
      OR (task_class = 'PROGRAM_DEEP_RESEARCH' AND benchmark_batch_key IS NULL AND benchmark_baseline IS NULL)
    );

ALTER TABLE rise_runtime.canonical_evidence_sources
  DROP CONSTRAINT canonical_evidence_sources_provider_check;
ALTER TABLE rise_runtime.canonical_evidence_sources
  ADD CONSTRAINT canonical_evidence_sources_provider_check
  CHECK (provider IN (
    'PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'OPENAI',
    'NRMP_SOAP_CLOSURE', 'STUDENT_INTEL', 'MISSIONMED_REVIEW'
  ));

ALTER TABLE rise_runtime.provider_ingest_runs
  DROP CONSTRAINT provider_ingest_runs_provider_check,
  DROP CONSTRAINT provider_ingest_runs_new_spend_usd_check;
ALTER TABLE rise_runtime.provider_ingest_runs
  ADD CONSTRAINT provider_ingest_runs_provider_check
    CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'OPENAI', 'NRMP_SOAP_CLOSURE')),
  ADD CONSTRAINT provider_ingest_runs_new_spend_usd_check
    CHECK (new_spend_usd >= 0 AND new_spend_usd <= 12.0000);

CREATE TABLE rise_runtime.research_spend_ledger (
  spend_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key char(64) NOT NULL UNIQUE CHECK (event_key ~ '^[0-9a-f]{64}$'),
  job_id uuid REFERENCES rise_runtime.research_jobs(job_id),
  provider_key text NOT NULL REFERENCES rise_runtime.research_provider_routes(provider_key),
  model_key text NOT NULL CHECK (btrim(model_key) <> '' AND length(model_key) <= 128),
  event_type text NOT NULL CHECK (event_type IN ('RESERVE', 'RECONCILE', 'RELEASE', 'UNKNOWN_COST_CHARGE')),
  amount_usd numeric(12,4) NOT NULL CHECK (amount_usd >= 0 AND amount_usd <= 12.0000),
  cumulative_actual_usd numeric(12,4) NOT NULL CHECK (cumulative_actual_usd >= 0 AND cumulative_actual_usd <= 12.0000),
  cumulative_reserved_usd numeric(12,4) NOT NULL CHECK (cumulative_reserved_usd >= 0 AND cumulative_reserved_usd <= 12.0000),
  usage jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(usage) = 'object'),
  provider_response_id text CHECK (provider_response_id IS NULL OR length(provider_response_id) <= 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cumulative_actual_usd + cumulative_reserved_usd <= 12.0000)
);

CREATE TRIGGER rise_research_spend_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.research_spend_ledger
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_research_audit_mutation();

CREATE INDEX rise_research_benchmark_batch_idx
  ON rise_runtime.research_jobs (benchmark_batch_key, provider_key, acgme_id)
  WHERE task_class = 'PROVIDER_BENCHMARK';
CREATE INDEX rise_research_spend_job_idx
  ON rise_runtime.research_spend_ledger (job_id, created_at);

ALTER TABLE rise_runtime.research_spend_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_spend_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY rise_research_spend_admin ON rise_runtime.research_spend_ledger
  FOR ALL TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');
REVOKE ALL ON rise_runtime.research_spend_ledger FROM PUBLIC;
GRANT SELECT, INSERT ON rise_runtime.research_spend_ledger TO rise_app_runtime;
GRANT USAGE, SELECT ON SEQUENCE rise_runtime.research_spend_ledger_spend_event_id_seq TO rise_app_runtime;

INSERT INTO rise_runtime.research_provider_routes (
  provider_key, model_key, state, enabled, network_allowed, spend_allowed,
  budget_cap_usd, concurrency_cap, configuration
) VALUES
  ('OPENAI_TERRA', 'gpt-5.6-terra', 'PAUSED', false, false, false, 6.0000, 1,
   '{"adapter":"openai-responses-web-search-v1","reservationUsd":0.6000,"maxOutputTokens":8000,"maxToolCalls":3}'::jsonb),
  ('OPENAI_SOL', 'gpt-5.6-sol', 'PAUSED', false, false, false, 6.0000, 1,
   '{"adapter":"openai-responses-web-search-v1","reservationUsd":0.6000,"maxOutputTokens":8000,"maxToolCalls":3}'::jsonb)
ON CONFLICT (provider_key) DO NOTHING;

UPDATE rise_runtime.research_router_settings
SET default_quota = 30,
    budget_cap_usd = 12.0000,
    canary_acgme_ids = ARRAY['1854831078', '1851113100']::text[],
    global_enabled = false,
    student_enabled = false,
    emergency_kill_switch = true,
    updated_at = now()
WHERE control_id = true;

COMMIT;
