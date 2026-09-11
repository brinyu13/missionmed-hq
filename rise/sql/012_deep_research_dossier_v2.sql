-- P1-RISE-5012F additive Deep Research Dossier V2 persistence.
-- Private rise_runtime schema only; existing forced RLS and grants are preserved.

BEGIN;

ALTER TABLE rise_runtime.research_jobs
  DROP CONSTRAINT research_jobs_status_check;

ALTER TABLE rise_runtime.research_jobs
  ADD COLUMN contract_version text,
  ADD COLUMN result_schema_version text,
  ADD COLUMN request_class text,
  ADD COLUMN required_domains text[],
  ADD COLUMN requested_fields text[],
  ADD COLUMN completion_matrix jsonb,
  ADD COLUMN completion_score numeric(6,4),
  ADD COLUMN dossier_outcome text,
  ADD COLUMN research_timestamp timestamptz;

ALTER TABLE rise_runtime.research_jobs
  ADD CONSTRAINT research_jobs_status_check
    CHECK (status IN (
      'QUEUED', 'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING',
      'COMPLETED', 'PARTIAL', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'REFUNDED', 'PAUSED'
    )),
  ADD CONSTRAINT research_jobs_contract_version_check
    CHECK (contract_version IS NULL OR contract_version = '2.0.0'),
  ADD CONSTRAINT research_jobs_result_schema_version_check
    CHECK (result_schema_version IS NULL OR result_schema_version = 'missionmed.rise.deep-research-dossier.v2'),
  ADD CONSTRAINT research_jobs_request_class_check
    CHECK (request_class IS NULL OR request_class IN ('FULL', 'DELTA', 'REFRESH', 'NO_OP')),
  ADD CONSTRAINT research_jobs_required_domains_check
    CHECK (required_domains IS NULL OR cardinality(required_domains) = 18),
  ADD CONSTRAINT research_jobs_requested_fields_check
    CHECK (requested_fields IS NULL OR cardinality(requested_fields) BETWEEN 1 AND 64),
  ADD CONSTRAINT research_jobs_completion_matrix_check
    CHECK (
      completion_matrix IS NULL OR (
        jsonb_typeof(completion_matrix) = 'object'
        AND completion_matrix ?& ARRAY[
          'identity_structure','visa','application_requirements','current_resident_roster',
          'resident_medical_schools','resident_composition','program_leadership','core_faculty',
          'trained_here_retention','board_pass_rate','in_house_fellowships','graduate_outcomes',
          'salary_benefits','curriculum_training','research_scholarly','program_differentiators',
          'culture_resident_experience','facilities_patient_population'
        ]
      )
    ),
  ADD CONSTRAINT research_jobs_completion_score_check
    CHECK (completion_score IS NULL OR completion_score BETWEEN 0 AND 1),
  ADD CONSTRAINT research_jobs_dossier_outcome_check
    CHECK (dossier_outcome IS NULL OR dossier_outcome IN ('DEEP', 'PARTIAL')),
  ADD CONSTRAINT research_jobs_dossier_v2_shape_check
    CHECK (
      contract_version IS NULL
      OR (
        task_class = 'PROGRAM_DEEP_RESEARCH'
        AND request_class IN ('FULL', 'DELTA', 'REFRESH')
        AND cardinality(required_domains) = 18
        AND cardinality(requested_fields) BETWEEN 1 AND 64
        AND (
          status NOT IN ('COMPLETED', 'PARTIAL')
          OR (
            jsonb_typeof(completion_matrix) = 'object'
            AND completion_score IS NOT NULL
            AND dossier_outcome IS NOT NULL
            AND result_schema_version = 'missionmed.rise.deep-research-dossier.v2'
            AND research_timestamp IS NOT NULL
            AND NOT jsonb_path_exists(completion_matrix, '$.* ? (@.state == "NOT_RESEARCHED")')
          )
        )
      )
    );

ALTER TABLE rise_runtime.research_job_attempts
  DROP CONSTRAINT research_job_attempts_status_check;
ALTER TABLE rise_runtime.research_job_attempts
  ADD CONSTRAINT research_job_attempts_status_check
    CHECK (status IN (
      'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING', 'COMPLETED',
      'PARTIAL', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'REFUNDED'
    ));

CREATE INDEX rise_research_dossier_v2_program_idx
  ON rise_runtime.research_jobs (acgme_id, research_timestamp DESC)
  WHERE contract_version = '2.0.0' AND status IN ('COMPLETED', 'PARTIAL');

ALTER TABLE rise_runtime.research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.research_job_attempts FORCE ROW LEVEL SECURITY;

COMMIT;
