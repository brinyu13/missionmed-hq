-- Migration: 20260626040000_mmc_coaching_intelligence_pipeline.sql
-- Authority: MMC-400 Coaching Intelligence Pipeline
-- Scope: STAGING/LOCAL ONLY. Production execution requires a separate approval gate.
-- =============================================================================
-- Adds only MMC-owned pipeline control objects:
--   * mmc.ai_prompt_versions
--   * mmc.coaching_source_assets
--   * mmc.coaching_analysis_runs
--
-- Does NOT duplicate students, profiles, enrollments, Scheduler, Calendar,
-- Webex, R2, Drills, VIDEO_SYSTEM registry, WordPress, or media ownership.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_target text := lower(coalesce(current_setting('mmc.schema_build_target', true), ''));
BEGIN
  IF v_target NOT IN ('local', 'staging', 'ci') THEN
    RAISE EXCEPTION
      'MMC-400 is staging/local only. Set mmc.schema_build_target to local, staging, or ci in this session before applying.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS mmc;

CREATE TABLE IF NOT EXISTS mmc.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  prompt_version integer NOT NULL,
  prompt_title text NOT NULL,
  prompt_body text NOT NULL,
  output_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  provider text NOT NULL DEFAULT 'openai',
  model_name text,
  activation_notes text,
  activated_at timestamptz,
  activated_by_principal_id uuid,
  rolled_back_from_prompt_id uuid REFERENCES mmc.ai_prompt_versions(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'sensitive',
  review_status text NOT NULL DEFAULT 'unreviewed',
  audit_required boolean NOT NULL DEFAULT true,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_principal_id uuid,
  updated_by_principal_id uuid,
  archived_at timestamptz,
  archived_by_principal_id uuid,
  deleted_at timestamptz,
  deleted_by_principal_id uuid,
  CONSTRAINT ai_prompt_versions_status_chk CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT ai_prompt_versions_version_chk CHECK (prompt_version > 0),
  CONSTRAINT ai_prompt_versions_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT ai_prompt_versions_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT ai_prompt_versions_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.ai_prompt_versions IS
  'MMC-owned editable/versioned prompt registry. Railway stores API keys/provider flags only; production prompt text lives here after review.';

CREATE TABLE IF NOT EXISTS mmc.coaching_source_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_id text NOT NULL,
  asset_title text NOT NULL,
  asset_date timestamptz,
  media_url text,
  thumbnail_url text,
  transcript_pointer text,
  transcript_hash text,
  asset_status text NOT NULL DEFAULT 'candidate',
  meeting_match_status text NOT NULL DEFAULT 'manual_review',
  meeting_match_confidence numeric(5,4) NOT NULL DEFAULT 0,
  subject_match_status text NOT NULL DEFAULT 'manual_review',
  subject_match_confidence numeric(5,4) NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'sensitive',
  review_status text NOT NULL DEFAULT 'unreviewed',
  audit_required boolean NOT NULL DEFAULT true,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_principal_id uuid,
  updated_by_principal_id uuid,
  archived_at timestamptz,
  archived_by_principal_id uuid,
  deleted_at timestamptz,
  deleted_by_principal_id uuid,
  CONSTRAINT coaching_source_assets_status_chk CHECK (asset_status IN ('candidate', 'attached', 'analysis_ready', 'analyzed', 'rejected', 'archived')),
  CONSTRAINT coaching_source_assets_meeting_match_status_chk CHECK (meeting_match_status IN ('unverified', 'probable', 'verified', 'manual_review', 'conflict')),
  CONSTRAINT coaching_source_assets_subject_match_status_chk CHECK (subject_match_status IN ('unverified', 'probable', 'verified', 'manual_review', 'conflict')),
  CONSTRAINT coaching_source_assets_meeting_confidence_chk CHECK (meeting_match_confidence >= 0 AND meeting_match_confidence <= 1),
  CONSTRAINT coaching_source_assets_subject_confidence_chk CHECK (subject_match_confidence >= 0 AND subject_match_confidence <= 1),
  CONSTRAINT coaching_source_assets_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT coaching_source_assets_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT coaching_source_assets_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.coaching_source_assets IS
  'MMC-owned read-only pointers to existing video/transcript assets. Does not own VIDEO_SYSTEM, R2, Stream, Webex, Scheduler, or transcript ingestion.';

CREATE TABLE IF NOT EXISTS mmc.coaching_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_asset_id uuid NOT NULL REFERENCES mmc.coaching_source_assets(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES mmc.coaching_sessions(id) ON DELETE SET NULL,
  prompt_version_id uuid REFERENCES mmc.ai_prompt_versions(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'mock',
  model_name text,
  run_status text NOT NULL DEFAULT 'queued',
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  structured_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'sensitive',
  review_status text NOT NULL DEFAULT 'unreviewed',
  audit_required boolean NOT NULL DEFAULT true,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_principal_id uuid,
  updated_by_principal_id uuid,
  archived_at timestamptz,
  archived_by_principal_id uuid,
  deleted_at timestamptz,
  deleted_by_principal_id uuid,
  CONSTRAINT coaching_analysis_runs_status_chk CHECK (run_status IN ('queued', 'running', 'succeeded', 'failed', 'review_required', 'canceled')),
  CONSTRAINT coaching_analysis_runs_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT coaching_analysis_runs_attempt_chk CHECK (attempt_count >= 0),
  CONSTRAINT coaching_analysis_runs_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT coaching_analysis_runs_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT coaching_analysis_runs_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected')),
  CONSTRAINT coaching_analysis_runs_completed_time_chk CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

COMMENT ON TABLE mmc.coaching_analysis_runs IS
  'MMC-owned analysis run log that turns reviewed coaching assets into structured MMC intelligence. Raw media/transcript ownership stays external.';

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_versions_key_version_uk
  ON mmc.ai_prompt_versions(prompt_key, prompt_version)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_versions_one_active_key_uk
  ON mmc.ai_prompt_versions(prompt_key)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ai_prompt_versions_status_idx
  ON mmc.ai_prompt_versions(prompt_key, status, prompt_version DESC);

CREATE UNIQUE INDEX IF NOT EXISTS coaching_source_assets_source_uk
  ON mmc.coaching_source_assets(source_system, source_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS coaching_source_assets_status_idx
  ON mmc.coaching_source_assets(asset_status, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS coaching_source_assets_source_refs_gin
  ON mmc.coaching_source_assets USING gin(source_refs);

CREATE INDEX IF NOT EXISTS coaching_analysis_runs_asset_idx
  ON mmc.coaching_analysis_runs(source_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coaching_analysis_runs_assignment_status_idx
  ON mmc.coaching_analysis_runs(assignment_id, run_status, created_at DESC);

CREATE INDEX IF NOT EXISTS coaching_analysis_runs_subject_idx
  ON mmc.coaching_analysis_runs(subject_ref_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coaching_analysis_runs_output_gin
  ON mmc.coaching_analysis_runs USING gin(structured_output);

DROP TRIGGER IF EXISTS trg_ai_prompt_versions_updated_at ON mmc.ai_prompt_versions;
CREATE TRIGGER trg_ai_prompt_versions_updated_at
  BEFORE UPDATE ON mmc.ai_prompt_versions
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_source_assets_updated_at ON mmc.coaching_source_assets;
CREATE TRIGGER trg_coaching_source_assets_updated_at
  BEFORE UPDATE ON mmc.coaching_source_assets
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_analysis_runs_updated_at ON mmc.coaching_analysis_runs;
CREATE TRIGGER trg_coaching_analysis_runs_updated_at
  BEFORE UPDATE ON mmc.coaching_analysis_runs
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

ALTER TABLE mmc.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.ai_prompt_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.coaching_source_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.coaching_source_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.coaching_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.coaching_analysis_runs FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON
  mmc.ai_prompt_versions,
  mmc.coaching_source_assets,
  mmc.coaching_analysis_runs
TO authenticated;

DROP POLICY IF EXISTS ai_prompt_versions_admin_all ON mmc.ai_prompt_versions;
CREATE POLICY ai_prompt_versions_admin_all ON mmc.ai_prompt_versions
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());

DROP POLICY IF EXISTS ai_prompt_versions_mentor_read_active ON mmc.ai_prompt_versions;
CREATE POLICY ai_prompt_versions_mentor_read_active ON mmc.ai_prompt_versions
  FOR SELECT TO authenticated
  USING (status = 'active' AND deleted_at IS NULL AND mmc.is_mmc_mentor());

DROP POLICY IF EXISTS coaching_source_assets_admin_all ON mmc.coaching_source_assets;
CREATE POLICY coaching_source_assets_admin_all ON mmc.coaching_source_assets
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());

DROP POLICY IF EXISTS coaching_analysis_runs_admin_all ON mmc.coaching_analysis_runs;
CREATE POLICY coaching_analysis_runs_admin_all ON mmc.coaching_analysis_runs
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());

DROP POLICY IF EXISTS coaching_analysis_runs_assigned_mentor_select ON mmc.coaching_analysis_runs;
CREATE POLICY coaching_analysis_runs_assigned_mentor_select ON mmc.coaching_analysis_runs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id)
  );

DROP POLICY IF EXISTS coaching_analysis_runs_assigned_mentor_insert ON mmc.coaching_analysis_runs;
CREATE POLICY coaching_analysis_runs_assigned_mentor_insert ON mmc.coaching_analysis_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id)
  );

DROP POLICY IF EXISTS coaching_analysis_runs_assigned_mentor_update ON mmc.coaching_analysis_runs;
CREATE POLICY coaching_analysis_runs_assigned_mentor_update ON mmc.coaching_analysis_runs
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id)
  )
  WITH CHECK (
    mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id)
  );

COMMIT;
