-- P1-RISE-5012E isolated rehearsal rollback only.
-- Production rollback leaves migration 011 additive history dormant.

BEGIN;

DROP INDEX IF EXISTS rise_runtime.rise_research_spend_job_idx;
DROP INDEX IF EXISTS rise_runtime.rise_research_benchmark_batch_idx;
DROP TRIGGER IF EXISTS rise_research_spend_immutable ON rise_runtime.research_spend_ledger;
DROP TABLE IF EXISTS rise_runtime.research_spend_ledger;

DELETE FROM rise_runtime.research_provider_routes
WHERE provider_key IN ('OPENAI_TERRA', 'OPENAI_SOL')
  AND NOT EXISTS (
    SELECT 1 FROM rise_runtime.research_jobs j
    WHERE j.provider_key = rise_runtime.research_provider_routes.provider_key
  );

ALTER TABLE rise_runtime.provider_ingest_runs
  DROP CONSTRAINT provider_ingest_runs_provider_check,
  DROP CONSTRAINT provider_ingest_runs_new_spend_usd_check;
ALTER TABLE rise_runtime.provider_ingest_runs
  ADD CONSTRAINT provider_ingest_runs_provider_check
    CHECK (provider IN ('PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'NRMP_SOAP_CLOSURE')),
  ADD CONSTRAINT provider_ingest_runs_new_spend_usd_check CHECK (new_spend_usd = 0);

ALTER TABLE rise_runtime.canonical_evidence_sources
  DROP CONSTRAINT canonical_evidence_sources_provider_check;
ALTER TABLE rise_runtime.canonical_evidence_sources
  ADD CONSTRAINT canonical_evidence_sources_provider_check
  CHECK (provider IN (
    'PARALLEL', 'CLAUDE_OPUS', 'CLAUDE_SONNET', 'NRMP_SOAP_CLOSURE',
    'STUDENT_INTEL', 'MISSIONMED_REVIEW'
  ));

ALTER TABLE rise_runtime.research_jobs
  DROP CONSTRAINT research_jobs_benchmark_shape_check,
  DROP CONSTRAINT research_jobs_task_payload_check,
  DROP CONSTRAINT research_jobs_task_class_check,
  DROP CONSTRAINT research_jobs_actual_cost_usd_check,
  DROP CONSTRAINT research_jobs_estimated_cost_usd_check;
ALTER TABLE rise_runtime.research_jobs
  DROP COLUMN benchmark_baseline,
  DROP COLUMN benchmark_batch_key,
  DROP COLUMN task_payload;
ALTER TABLE rise_runtime.research_jobs
  ADD CONSTRAINT research_jobs_task_class_check CHECK (task_class = 'PROGRAM_DEEP_RESEARCH'),
  ADD CONSTRAINT research_jobs_estimated_cost_usd_check CHECK (estimated_cost_usd = 0),
  ADD CONSTRAINT research_jobs_actual_cost_usd_check CHECK (actual_cost_usd IS NULL OR actual_cost_usd = 0);

ALTER TABLE rise_runtime.research_provider_routes
  DROP CONSTRAINT research_provider_routes_spend_cap_check,
  DROP CONSTRAINT research_provider_routes_spend_nonnegative_check,
  DROP CONSTRAINT research_provider_routes_spend_state_check,
  DROP CONSTRAINT research_provider_routes_state_check,
  DROP COLUMN reserved_spend_usd;
ALTER TABLE rise_runtime.research_provider_routes
  ADD CONSTRAINT research_provider_routes_state_check
    CHECK (state IN ('TEST_ONLY', 'BENCHMARKING', 'PRODUCTION_APPROVED', 'PAUSED')),
  ADD CONSTRAINT research_provider_routes_check1
    CHECK (state = 'PRODUCTION_APPROVED' OR spend_allowed = false),
  ADD CONSTRAINT research_provider_routes_actual_spend_usd_check CHECK (actual_spend_usd = 0);

UPDATE rise_runtime.research_router_settings
SET global_enabled = false,
    student_enabled = false,
    emergency_kill_switch = true,
    default_quota = 1,
    budget_cap_usd = 0,
    actual_spend_usd = 0,
    updated_at = now()
WHERE control_id = true;

ALTER TABLE rise_runtime.research_router_settings
  DROP CONSTRAINT research_router_settings_spend_cap_check,
  DROP CONSTRAINT research_router_settings_spend_nonnegative_check,
  DROP COLUMN reserved_spend_usd;
ALTER TABLE rise_runtime.research_router_settings
  ADD CONSTRAINT research_router_settings_actual_spend_usd_check CHECK (actual_spend_usd = 0);

COMMIT;
