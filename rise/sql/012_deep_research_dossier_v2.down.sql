-- Isolated-rehearsal rollback only. Production rollback leaves additive history dormant.

BEGIN;

DROP INDEX IF EXISTS rise_runtime.rise_research_dossier_v2_program_idx;

ALTER TABLE rise_runtime.research_job_attempts
  DROP CONSTRAINT IF EXISTS research_job_attempts_status_check;
ALTER TABLE rise_runtime.research_job_attempts
  ADD CONSTRAINT research_job_attempts_status_check
    CHECK (status IN (
      'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING', 'COMPLETED',
      'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'REFUNDED'
    ));

ALTER TABLE rise_runtime.research_jobs
  DROP CONSTRAINT IF EXISTS research_jobs_dossier_v2_shape_check,
  DROP CONSTRAINT IF EXISTS research_jobs_dossier_outcome_check,
  DROP CONSTRAINT IF EXISTS research_jobs_completion_score_check,
  DROP CONSTRAINT IF EXISTS research_jobs_completion_matrix_check,
  DROP CONSTRAINT IF EXISTS research_jobs_requested_fields_check,
  DROP CONSTRAINT IF EXISTS research_jobs_required_domains_check,
  DROP CONSTRAINT IF EXISTS research_jobs_request_class_check,
  DROP CONSTRAINT IF EXISTS research_jobs_result_schema_version_check,
  DROP CONSTRAINT IF EXISTS research_jobs_contract_version_check,
  DROP CONSTRAINT IF EXISTS research_jobs_status_check;

ALTER TABLE rise_runtime.research_jobs
  DROP COLUMN IF EXISTS research_timestamp,
  DROP COLUMN IF EXISTS dossier_outcome,
  DROP COLUMN IF EXISTS completion_score,
  DROP COLUMN IF EXISTS completion_matrix,
  DROP COLUMN IF EXISTS requested_fields,
  DROP COLUMN IF EXISTS required_domains,
  DROP COLUMN IF EXISTS request_class,
  DROP COLUMN IF EXISTS result_schema_version,
  DROP COLUMN IF EXISTS contract_version;

ALTER TABLE rise_runtime.research_jobs
  ADD CONSTRAINT research_jobs_status_check
    CHECK (status IN (
      'QUEUED', 'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING',
      'COMPLETED', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'REFUNDED', 'PAUSED'
    ));

COMMIT;
