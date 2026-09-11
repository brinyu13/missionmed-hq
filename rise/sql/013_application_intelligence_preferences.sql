-- P1-RISE-5012H additive application-intelligence preferences, privacy-safe
-- analytics, and bounded parent/child research orchestration metadata.

BEGIN;

CREATE TABLE rise_runtime.student_application_preferences (
  subject_key char(64) PRIMARY KEY CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  personalization_enabled boolean NOT NULL DEFAULT true,
  priorities text[] NOT NULL DEFAULT ARRAY['visa','exams','yog','usce','research_depth']::text[],
  card_fields text[] NOT NULL DEFAULT ARRAY['visa','exams','yog','usce','composition','research_depth']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(priorities) BETWEEN 1 AND 5),
  CHECK (priorities <@ ARRAY['visa','exams','attempts','yog','usce','img','do','same_school','same_country','location','research_depth','fellowships','soap']::text[]),
  CHECK (cardinality(card_fields) BETWEEN 3 AND 8),
  CHECK (card_fields <@ ARRAY['visa','exams','yog','usce','composition','research_depth','attempts','same_school','same_country','fellowships','soap']::text[])
);

CREATE TABLE rise_runtime.application_intelligence_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_key char(64) NOT NULL CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  event_type text NOT NULL CHECK (event_type IN (
    'SEARCH_USED','FILTER_APPLIED','SAME_SCHOOL_FILTER','SAME_COUNTRY_FILTER',
    'PERSONALIZATION_ENABLED','PROGRAM_FILE_OPENED','RESEARCH_MODAL_OPENED',
    'RESEARCH_REQUEST_SUBMITTED','RESEARCH_REQUEST_NO_OP','PROGRAM_SAVED','COMPARE_USED'
  )),
  program_specialty_id text,
  dimension text CHECK (dimension IS NULL OR length(dimension) <= 64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pg_column_size(metadata) <= 2048)
);

CREATE INDEX rise_application_intelligence_events_type_created_idx
  ON rise_runtime.application_intelligence_events (event_type, created_at DESC);
CREATE INDEX rise_application_intelligence_events_subject_created_idx
  ON rise_runtime.application_intelligence_events (subject_key, created_at DESC);

CREATE TRIGGER rise_application_intelligence_events_immutable
  BEFORE UPDATE OR DELETE ON rise_runtime.application_intelligence_events
  FOR EACH ROW EXECUTE FUNCTION rise_runtime.reject_research_audit_mutation();

ALTER TABLE rise_runtime.research_jobs
  ADD COLUMN root_job_id uuid REFERENCES rise_runtime.research_jobs(job_id),
  ADD COLUMN parent_job_id uuid REFERENCES rise_runtime.research_jobs(job_id),
  ADD COLUMN stage_ordinal smallint,
  ADD COLUMN research_stage text,
  ADD COLUMN student_charge_key char(64);

ALTER TABLE rise_runtime.research_jobs
  ADD CONSTRAINT research_jobs_stage_ordinal_check CHECK (stage_ordinal IS NULL OR stage_ordinal BETWEEN 1 AND 3),
  ADD CONSTRAINT research_jobs_research_stage_check CHECK (research_stage IS NULL OR research_stage IN ('TERRA_FULL','TERRA_DELTA','SOL_CRITICAL_RESIDUE')),
  ADD CONSTRAINT research_jobs_student_charge_key_check CHECK (student_charge_key IS NULL OR student_charge_key ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT research_jobs_parent_stage_shape_check CHECK (
    root_job_id IS NULL OR (
      task_class = 'PROGRAM_DEEP_RESEARCH' AND stage_ordinal IS NOT NULL
      AND research_stage IS NOT NULL AND student_charge_key IS NOT NULL
      AND ((stage_ordinal = 1 AND parent_job_id IS NULL AND root_job_id = job_id)
        OR (stage_ordinal > 1 AND parent_job_id IS NOT NULL))
    )
  );

CREATE UNIQUE INDEX rise_research_jobs_root_stage_unique_idx
  ON rise_runtime.research_jobs (root_job_id, stage_ordinal)
  WHERE root_job_id IS NOT NULL;
CREATE INDEX rise_research_jobs_parent_idx
  ON rise_runtime.research_jobs (parent_job_id)
  WHERE parent_job_id IS NOT NULL;

ALTER TABLE rise_runtime.student_application_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_application_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.application_intelligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.application_intelligence_events FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_student_application_preferences_subject
  ON rise_runtime.student_application_preferences
  FOR ALL TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true))
  WITH CHECK (subject_key = current_setting('rise.subject_key', true));

CREATE POLICY rise_application_intelligence_events_subject_insert
  ON rise_runtime.application_intelligence_events
  FOR INSERT TO rise_app_runtime
  WITH CHECK (subject_key = current_setting('rise.subject_key', true));
CREATE POLICY rise_application_intelligence_events_admin_read
  ON rise_runtime.application_intelligence_events
  FOR SELECT TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true');

REVOKE ALL ON rise_runtime.student_application_preferences FROM PUBLIC;
REVOKE ALL ON rise_runtime.application_intelligence_events FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.student_application_preferences TO rise_app_runtime;
GRANT SELECT, INSERT ON rise_runtime.application_intelligence_events TO rise_app_runtime;
GRANT USAGE, SELECT ON SEQUENCE rise_runtime.application_intelligence_events_event_id_seq TO rise_app_runtime;

ALTER TABLE rise_runtime.research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_jobs FORCE ROW LEVEL SECURITY;

COMMIT;
