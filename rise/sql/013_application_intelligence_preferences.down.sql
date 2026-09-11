-- Disposable rehearsal rollback only. Production uses forward-only correction.

BEGIN;

DROP INDEX IF EXISTS rise_runtime.rise_research_jobs_parent_idx;
DROP INDEX IF EXISTS rise_runtime.rise_research_jobs_root_stage_unique_idx;
ALTER TABLE rise_runtime.research_jobs
  DROP CONSTRAINT IF EXISTS research_jobs_parent_stage_shape_check,
  DROP CONSTRAINT IF EXISTS research_jobs_student_charge_key_check,
  DROP CONSTRAINT IF EXISTS research_jobs_research_stage_check,
  DROP CONSTRAINT IF EXISTS research_jobs_stage_ordinal_check,
  DROP COLUMN IF EXISTS student_charge_key,
  DROP COLUMN IF EXISTS research_stage,
  DROP COLUMN IF EXISTS stage_ordinal,
  DROP COLUMN IF EXISTS parent_job_id,
  DROP COLUMN IF EXISTS root_job_id;

DROP TABLE IF EXISTS rise_runtime.application_intelligence_events;
DROP TABLE IF EXISTS rise_runtime.student_application_preferences;

COMMIT;
