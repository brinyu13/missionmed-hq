-- Migration: 20260624002000_mmc_schema_foundation.sql
-- Authority: MMC-020A, MMC-019A READY_FOR_SCHEMA_BUILD, MMC-019_SCHEMA_FOUNDATION_SPEC
-- Date: 2026-06-24
-- Depends on: 20260427131000_mr_stat_human_async_duel_contract_repair_035.sql
-- Description: Create the staging/local MMC-owned persistence foundation with deny-by-default RLS.
-- Idempotent: YES
-- =============================================================================
-- MMC-020 Staging Schema Build - MMC-owned persistence foundation
-- Scope: STAGING/LOCAL ONLY. No production execution is authorized by this file.
-- =============================================================================
-- Runtime boundary:
--   * Creates only mmc-owned tables.
--   * Does not duplicate students, profiles, enrollments, Scheduler, Calendar,
--     CRM, LearnDash, Messages, File Vault, Arena, Drills, Webex, R2, or
--     WordPress data.
--   * Uses mmc.action_items, not student_tasks.
--   * Does not create a service_role runtime dependency.
--   * Requires an explicit session guard before execution:
--       SET mmc.schema_build_target = 'local';
--       SET mmc.schema_build_target = 'staging';
--       SET mmc.schema_build_target = 'ci';
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_target text := lower(coalesce(current_setting('mmc.schema_build_target', true), ''));
BEGIN
  IF v_target NOT IN ('local', 'staging', 'ci') THEN
    RAISE EXCEPTION
      'MMC-020 is staging/local only. Set mmc.schema_build_target to local, staging, or ci in this session before applying.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS mmc;

COMMENT ON SCHEMA mmc IS
  'MMC-owned mentor intelligence schema. Staging/local foundation only for MMC-020; production execution requires a separate approval gate.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mmc.jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION mmc.current_principal_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sub text;
BEGIN
  v_sub := nullif(mmc.jwt_claims() ->> 'sub', '');
  IF v_sub IS NOT NULL THEN
    RETURN v_sub::uuid;
  END IF;

  RETURN auth.uid();
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION mmc.current_mmc_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(
    nullif(mmc.jwt_claims() -> 'app_metadata' ->> 'mmc_role', ''),
    nullif(mmc.jwt_claims() -> 'app_metadata' ->> 'mm_role', ''),
    nullif(mmc.jwt_claims() ->> 'mmc_role', ''),
    nullif(mmc.jwt_claims() ->> 'role', ''),
    ''
  ));
$$;

CREATE OR REPLACE FUNCTION mmc.is_mmc_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT mmc.current_mmc_role() IN ('admin', 'hq_admin', 'hq_operator', 'operator');
$$;

CREATE OR REPLACE FUNCTION mmc.is_mmc_mentor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT mmc.current_mmc_role() IN ('mentor', 'admin', 'hq_admin', 'hq_operator', 'operator');
$$;

CREATE OR REPLACE FUNCTION mmc.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by_principal_id = coalesce(NEW.updated_by_principal_id, mmc.current_principal_id());
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mmc.identity_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_status text NOT NULL DEFAULT 'unverified',
  primary_anchor_type text NOT NULL,
  primary_anchor_hash text NOT NULL,
  anchor_set_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_method text,
  verified_by_principal_id uuid,
  verified_at timestamptz,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  conflict_notes text,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT identity_references_status_chk CHECK (reference_status IN ('unverified', 'verified', 'conflict', 'retired')),
  CONSTRAINT identity_references_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT identity_references_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT identity_references_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT identity_references_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.identity_references IS
  'Optional non-authoritative provenance references only. Does not own canonical student identity, profiles, enrollments, Scheduler, Calendar, CRM, LearnDash, or WordPress data.';

CREATE TABLE IF NOT EXISTS mmc.mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_source text NOT NULL,
  auth_subject_id text NOT NULL,
  auth_subject_email_hash text,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'mentor',
  status text NOT NULL DEFAULT 'active',
  last_verified_at timestamptz,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
  review_status text NOT NULL DEFAULT 'verified',
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
  CONSTRAINT mentors_role_chk CHECK (role IN ('admin', 'hq_admin', 'hq_operator', 'operator', 'mentor')),
  CONSTRAINT mentors_status_chk CHECK (status IN ('active', 'inactive', 'suspended', 'retired')),
  CONSTRAINT mentors_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT mentors_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT mentors_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.mentors IS
  'MMC mentor principals after approved auth mapping. Does not own WordPress users or HR/staff records.';

CREATE TABLE IF NOT EXISTS mmc.mentor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  assignment_scope text NOT NULL DEFAULT 'coaching',
  status text NOT NULL DEFAULT 'active',
  granted_by_principal_id uuid,
  grant_reason text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by_principal_id uuid,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
  review_status text NOT NULL DEFAULT 'verified',
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
  CONSTRAINT mentor_assignments_status_chk CHECK (status IN ('active', 'paused', 'revoked', 'ended')),
  CONSTRAINT mentor_assignments_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT mentor_assignments_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT mentor_assignments_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected')),
  CONSTRAINT mentor_assignments_time_chk CHECK (ends_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE mmc.mentor_assignments IS
  'MMC-owned assignment authority for mentor access to non-authoritative subject references. Does not create canonical student ownership.';

CREATE TABLE IF NOT EXISTS mmc.coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  session_status text NOT NULL DEFAULT 'planned',
  scheduled_for_manual timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  prep_summary text,
  session_focus text,
  post_session_summary text,
  source_type text NOT NULL DEFAULT 'manual_mmc',
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT coaching_sessions_status_chk CHECK (session_status IN ('planned', 'prep', 'in_session', 'post_session', 'completed', 'canceled', 'archived')),
  CONSTRAINT coaching_sessions_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT coaching_sessions_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT coaching_sessions_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected')),
  CONSTRAINT coaching_sessions_time_chk CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE mmc.coaching_sessions IS
  'MMC-owned advising/coaching lifecycle. Does not own Scheduler appointments, Calendar events, Webex meetings, recordings, or transcripts.';

CREATE TABLE IF NOT EXISTS mmc.session_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES mmc.coaching_sessions(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  artifact_type text NOT NULL,
  title text,
  content_body text,
  content_pointer text,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT session_artifacts_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT session_artifacts_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT session_artifacts_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.session_artifacts IS
  'MMC-authored session artifacts only. Does not store raw recordings, transcripts, Drills artifacts, File Vault files, or R2 objects.';

CREATE TABLE IF NOT EXISTS mmc.mentor_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  memory_type text NOT NULL,
  memory_text text NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 0.5,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_confirmed_at timestamptz,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT mentor_memory_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT mentor_memory_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT mentor_memory_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT mentor_memory_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.mentor_memory IS
  'MMC-owned relationship memory and coaching context. Does not own Matrix Profile, CRM profile, official academic records, or application records.';

CREATE TABLE IF NOT EXISTS mmc.private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  note_type text NOT NULL DEFAULT 'mentor_private',
  note_body text NOT NULL,
  visibility text NOT NULL DEFAULT 'mentor_private',
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
  CONSTRAINT private_notes_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT private_notes_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT private_notes_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.private_notes IS
  'Strict mentor-private notes. Not student-visible, not Messages, and not CRM notes.';

CREATE TABLE IF NOT EXISTS mmc.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  owner_type text NOT NULL DEFAULT 'mentor',
  action_type text NOT NULL DEFAULT 'task',
  title text NOT NULL,
  details text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  closed_by_principal_id uuid,
  related_session_id uuid REFERENCES mmc.coaching_sessions(id) ON DELETE SET NULL,
  related_memory_id uuid REFERENCES mmc.mentor_memory(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT action_items_owner_type_chk CHECK (owner_type IN ('mentor', 'student', 'shared', 'system')),
  CONSTRAINT action_items_action_type_chk CHECK (action_type IN ('task', 'promise', 'follow_up', 'deadline', 'prep', 'review')),
  CONSTRAINT action_items_status_chk CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'canceled', 'archived')),
  CONSTRAINT action_items_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT action_items_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT action_items_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.action_items IS
  'MMC-owned tasks, promises, follow-ups, deadlines, and commitment tracking. This is intentionally not named student_tasks.';

CREATE TABLE IF NOT EXISTS mmc.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  goal_type text NOT NULL DEFAULT 'coaching',
  title text NOT NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'active',
  progress_state text NOT NULL DEFAULT 'not_started',
  milestone_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT goals_status_chk CHECK (status IN ('active', 'paused', 'achieved', 'abandoned', 'archived')),
  CONSTRAINT goals_progress_state_chk CHECK (progress_state IN ('not_started', 'progressing', 'stalled', 'at_risk', 'complete')),
  CONSTRAINT goals_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT goals_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT goals_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.goals IS
  'MMC coaching goals and milestones. Does not own LearnDash progress, official application status, CRM program enrollment, or external tasks.';

CREATE TABLE IF NOT EXISTS mmc.open_loops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  loop_type text NOT NULL DEFAULT 'coaching',
  summary text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_principal_id uuid,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT open_loops_severity_chk CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT open_loops_status_chk CHECK (status IN ('open', 'watching', 'blocked', 'resolved', 'archived')),
  CONSTRAINT open_loops_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT open_loops_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT open_loops_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.open_loops IS
  'MMC-derived unresolved issues, repeated themes, and unfinished commitments. Does not own external tickets, CRM alerts, or Messages.';

CREATE TABLE IF NOT EXISTS mmc.intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES mmc.mentors(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES mmc.mentor_assignments(id) ON DELETE RESTRICT,
  subject_ref_id uuid NOT NULL REFERENCES mmc.identity_references(id) ON DELETE RESTRICT,
  snapshot_type text NOT NULL,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_principal_id uuid,
  expires_at timestamptz,
  visibility text NOT NULL DEFAULT 'mentor_admin',
  sensitivity text NOT NULL DEFAULT 'standard',
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
  CONSTRAINT intelligence_snapshots_confidence_chk CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT intelligence_snapshots_visibility_chk CHECK (visibility IN ('mentor_private', 'mentor_admin', 'future_student_visible', 'system_only')),
  CONSTRAINT intelligence_snapshots_sensitivity_chk CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  CONSTRAINT intelligence_snapshots_review_status_chk CHECK (review_status IN ('unreviewed', 'reviewed', 'verified', 'rejected'))
);

COMMENT ON TABLE mmc.intelligence_snapshots IS
  'Reviewed or recomputable MMC briefing, risk, timeline, readiness, and next-best-move snapshots. Does not own source facts.';

CREATE TABLE IF NOT EXISTS mmc.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_principal_id uuid,
  actor_role text,
  action text NOT NULL,
  object_schema text NOT NULL DEFAULT 'mmc',
  object_table text,
  object_id uuid,
  subject_ref_id uuid REFERENCES mmc.identity_references(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES mmc.mentor_assignments(id) ON DELETE SET NULL,
  before_hash text,
  after_hash text,
  reason text,
  request_id text,
  source_ip_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE mmc.audit_events IS
  'Append-only MMC audit trail for sensitive reads, writes, admin overrides, assignment changes, exports, and privacy-sensitive actions.';

-- ---------------------------------------------------------------------------
-- Functions that depend on table existence
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mmc.current_mentor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT m.id
  FROM mmc.mentors m
  WHERE m.auth_subject_id = mmc.current_principal_id()::text
    AND m.status = 'active'
    AND m.deleted_at IS NULL
  ORDER BY m.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION mmc.assignment_is_active(
  p_assignment_id uuid,
  p_subject_ref_id uuid,
  p_mentor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mmc.mentor_assignments a
    WHERE a.id = p_assignment_id
      AND a.subject_ref_id = p_subject_ref_id
      AND a.mentor_id = p_mentor_id
      AND a.status = 'active'
      AND a.revoked_at IS NULL
      AND a.deleted_at IS NULL
      AND a.starts_at <= now()
      AND (a.ends_at IS NULL OR a.ends_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION mmc.current_mentor_can_access_assignment(
  p_assignment_id uuid,
  p_subject_ref_id uuid,
  p_mentor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT mmc.is_mmc_mentor()
    AND p_mentor_id = mmc.current_mentor_id()
    AND mmc.assignment_is_active(p_assignment_id, p_subject_ref_id, p_mentor_id);
$$;

CREATE OR REPLACE FUNCTION mmc.current_mentor_can_access_subject(p_subject_ref_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT mmc.is_mmc_mentor()
    AND EXISTS (
      SELECT 1
      FROM mmc.mentor_assignments a
      WHERE a.subject_ref_id = p_subject_ref_id
        AND a.mentor_id = mmc.current_mentor_id()
        AND a.status = 'active'
        AND a.revoked_at IS NULL
        AND a.deleted_at IS NULL
        AND a.starts_at <= now()
        AND (a.ends_at IS NULL OR a.ends_at > now())
    );
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS identity_references_anchor_uk
  ON mmc.identity_references(primary_anchor_type, primary_anchor_hash)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS identity_references_status_idx ON mmc.identity_references(reference_status);
CREATE INDEX IF NOT EXISTS identity_references_source_refs_gin ON mmc.identity_references USING gin(source_refs);

CREATE UNIQUE INDEX IF NOT EXISTS mentors_auth_subject_uk
  ON mmc.mentors(auth_source, auth_subject_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mentors_role_status_idx ON mmc.mentors(role, status);

CREATE UNIQUE INDEX IF NOT EXISTS mentor_assignments_active_uk
  ON mmc.mentor_assignments(mentor_id, subject_ref_id, assignment_scope)
  WHERE status = 'active' AND revoked_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mentor_assignments_mentor_idx ON mmc.mentor_assignments(mentor_id, status);
CREATE INDEX IF NOT EXISTS mentor_assignments_subject_idx ON mmc.mentor_assignments(subject_ref_id, status);

CREATE INDEX IF NOT EXISTS coaching_sessions_assignment_idx ON mmc.coaching_sessions(assignment_id, session_status);
CREATE INDEX IF NOT EXISTS coaching_sessions_mentor_subject_idx ON mmc.coaching_sessions(mentor_id, subject_ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coaching_sessions_source_refs_gin ON mmc.coaching_sessions USING gin(source_refs);

CREATE INDEX IF NOT EXISTS session_artifacts_session_idx ON mmc.session_artifacts(session_id);
CREATE INDEX IF NOT EXISTS session_artifacts_mentor_subject_idx ON mmc.session_artifacts(mentor_id, subject_ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS session_artifacts_source_refs_gin ON mmc.session_artifacts USING gin(source_refs);

CREATE INDEX IF NOT EXISTS mentor_memory_mentor_subject_idx ON mmc.mentor_memory(mentor_id, subject_ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mentor_memory_type_idx ON mmc.mentor_memory(memory_type);
CREATE INDEX IF NOT EXISTS mentor_memory_evidence_refs_gin ON mmc.mentor_memory USING gin(evidence_refs);

CREATE INDEX IF NOT EXISTS private_notes_mentor_subject_idx ON mmc.private_notes(mentor_id, subject_ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS private_notes_sensitivity_idx ON mmc.private_notes(sensitivity);

CREATE INDEX IF NOT EXISTS action_items_mentor_subject_status_idx ON mmc.action_items(mentor_id, subject_ref_id, status, due_at);
CREATE INDEX IF NOT EXISTS action_items_assignment_status_idx ON mmc.action_items(assignment_id, status);
CREATE INDEX IF NOT EXISTS action_items_related_session_idx ON mmc.action_items(related_session_id);

CREATE INDEX IF NOT EXISTS goals_mentor_subject_status_idx ON mmc.goals(mentor_id, subject_ref_id, status, target_date);
CREATE INDEX IF NOT EXISTS goals_assignment_status_idx ON mmc.goals(assignment_id, status);

CREATE INDEX IF NOT EXISTS open_loops_mentor_subject_status_idx ON mmc.open_loops(mentor_id, subject_ref_id, status, severity);
CREATE INDEX IF NOT EXISTS open_loops_assignment_status_idx ON mmc.open_loops(assignment_id, status);

CREATE INDEX IF NOT EXISTS intelligence_snapshots_subject_type_idx ON mmc.intelligence_snapshots(subject_ref_id, snapshot_type, generated_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_snapshots_assignment_type_idx ON mmc.intelligence_snapshots(assignment_id, snapshot_type, generated_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_snapshots_summary_gin ON mmc.intelligence_snapshots USING gin(summary_json);

CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON mmc.audit_events(actor_principal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_object_idx ON mmc.audit_events(object_schema, object_table, object_id);
CREATE INDEX IF NOT EXISTS audit_events_subject_idx ON mmc.audit_events(subject_ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_assignment_idx ON mmc.audit_events(assignment_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_identity_references_updated_at ON mmc.identity_references;
CREATE TRIGGER trg_identity_references_updated_at
  BEFORE UPDATE ON mmc.identity_references
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_mentors_updated_at ON mmc.mentors;
CREATE TRIGGER trg_mentors_updated_at
  BEFORE UPDATE ON mmc.mentors
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_mentor_assignments_updated_at ON mmc.mentor_assignments;
CREATE TRIGGER trg_mentor_assignments_updated_at
  BEFORE UPDATE ON mmc.mentor_assignments
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_sessions_updated_at ON mmc.coaching_sessions;
CREATE TRIGGER trg_coaching_sessions_updated_at
  BEFORE UPDATE ON mmc.coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_session_artifacts_updated_at ON mmc.session_artifacts;
CREATE TRIGGER trg_session_artifacts_updated_at
  BEFORE UPDATE ON mmc.session_artifacts
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_mentor_memory_updated_at ON mmc.mentor_memory;
CREATE TRIGGER trg_mentor_memory_updated_at
  BEFORE UPDATE ON mmc.mentor_memory
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_private_notes_updated_at ON mmc.private_notes;
CREATE TRIGGER trg_private_notes_updated_at
  BEFORE UPDATE ON mmc.private_notes
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_action_items_updated_at ON mmc.action_items;
CREATE TRIGGER trg_action_items_updated_at
  BEFORE UPDATE ON mmc.action_items
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_goals_updated_at ON mmc.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON mmc.goals
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_open_loops_updated_at ON mmc.open_loops;
CREATE TRIGGER trg_open_loops_updated_at
  BEFORE UPDATE ON mmc.open_loops
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

DROP TRIGGER IF EXISTS trg_intelligence_snapshots_updated_at ON mmc.intelligence_snapshots;
CREATE TRIGGER trg_intelligence_snapshots_updated_at
  BEFORE UPDATE ON mmc.intelligence_snapshots
  FOR EACH ROW EXECUTE FUNCTION mmc.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS enablement
-- ---------------------------------------------------------------------------
ALTER TABLE mmc.identity_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.identity_references FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.mentors FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.mentor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.mentor_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.coaching_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.session_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.session_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.mentor_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.mentor_memory FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.private_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.action_items FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.goals FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.open_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.open_loops FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.intelligence_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.intelligence_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE mmc.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.audit_events FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Grants: authenticated users receive table privileges, RLS provides the guard.
-- No anon grants are provided.
-- ---------------------------------------------------------------------------
REVOKE ALL ON SCHEMA mmc FROM anon;
GRANT USAGE ON SCHEMA mmc TO authenticated;

GRANT SELECT, INSERT, UPDATE ON
  mmc.identity_references,
  mmc.mentors,
  mmc.mentor_assignments,
  mmc.coaching_sessions,
  mmc.session_artifacts,
  mmc.mentor_memory,
  mmc.private_notes,
  mmc.action_items,
  mmc.goals,
  mmc.open_loops,
  mmc.intelligence_snapshots
TO authenticated;

GRANT SELECT, INSERT ON mmc.audit_events TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS identity_references_admin_all ON mmc.identity_references;
CREATE POLICY identity_references_admin_all ON mmc.identity_references
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());

DROP POLICY IF EXISTS identity_references_mentor_read_assigned ON mmc.identity_references;
CREATE POLICY identity_references_mentor_read_assigned ON mmc.identity_references
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND mmc.current_mentor_can_access_subject(id)
  );

DROP POLICY IF EXISTS mentors_admin_all ON mmc.mentors;
CREATE POLICY mentors_admin_all ON mmc.mentors
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());

DROP POLICY IF EXISTS mentors_read_self ON mmc.mentors;
CREATE POLICY mentors_read_self ON mmc.mentors
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND status = 'active'
    AND auth_subject_id = mmc.current_principal_id()::text
  );

DROP POLICY IF EXISTS mentor_assignments_admin_all ON mmc.mentor_assignments;
CREATE POLICY mentor_assignments_admin_all ON mmc.mentor_assignments
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());

DROP POLICY IF EXISTS mentor_assignments_read_own_active ON mmc.mentor_assignments;
CREATE POLICY mentor_assignments_read_own_active ON mmc.mentor_assignments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND revoked_at IS NULL
    AND status = 'active'
    AND mentor_id = mmc.current_mentor_id()
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

-- Content table policy family: admins can manage, assigned mentors can read/write.
DROP POLICY IF EXISTS coaching_sessions_admin_all ON mmc.coaching_sessions;
CREATE POLICY coaching_sessions_admin_all ON mmc.coaching_sessions
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS coaching_sessions_assigned_mentor_select ON mmc.coaching_sessions;
CREATE POLICY coaching_sessions_assigned_mentor_select ON mmc.coaching_sessions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS coaching_sessions_assigned_mentor_insert ON mmc.coaching_sessions;
CREATE POLICY coaching_sessions_assigned_mentor_insert ON mmc.coaching_sessions
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS coaching_sessions_assigned_mentor_update ON mmc.coaching_sessions;
CREATE POLICY coaching_sessions_assigned_mentor_update ON mmc.coaching_sessions
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS session_artifacts_admin_all ON mmc.session_artifacts;
CREATE POLICY session_artifacts_admin_all ON mmc.session_artifacts
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS session_artifacts_assigned_mentor_select ON mmc.session_artifacts;
CREATE POLICY session_artifacts_assigned_mentor_select ON mmc.session_artifacts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS session_artifacts_assigned_mentor_insert ON mmc.session_artifacts;
CREATE POLICY session_artifacts_assigned_mentor_insert ON mmc.session_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS session_artifacts_assigned_mentor_update ON mmc.session_artifacts;
CREATE POLICY session_artifacts_assigned_mentor_update ON mmc.session_artifacts
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS mentor_memory_admin_all ON mmc.mentor_memory;
CREATE POLICY mentor_memory_admin_all ON mmc.mentor_memory
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS mentor_memory_assigned_mentor_select ON mmc.mentor_memory;
CREATE POLICY mentor_memory_assigned_mentor_select ON mmc.mentor_memory
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS mentor_memory_assigned_mentor_insert ON mmc.mentor_memory;
CREATE POLICY mentor_memory_assigned_mentor_insert ON mmc.mentor_memory
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS mentor_memory_assigned_mentor_update ON mmc.mentor_memory;
CREATE POLICY mentor_memory_assigned_mentor_update ON mmc.mentor_memory
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS private_notes_admin_all ON mmc.private_notes;
CREATE POLICY private_notes_admin_all ON mmc.private_notes
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS private_notes_assigned_mentor_select ON mmc.private_notes;
CREATE POLICY private_notes_assigned_mentor_select ON mmc.private_notes
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND visibility = 'mentor_private' AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS private_notes_assigned_mentor_insert ON mmc.private_notes;
CREATE POLICY private_notes_assigned_mentor_insert ON mmc.private_notes
  FOR INSERT TO authenticated
  WITH CHECK (visibility = 'mentor_private' AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS private_notes_assigned_mentor_update ON mmc.private_notes;
CREATE POLICY private_notes_assigned_mentor_update ON mmc.private_notes
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND visibility = 'mentor_private' AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (visibility = 'mentor_private' AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS action_items_admin_all ON mmc.action_items;
CREATE POLICY action_items_admin_all ON mmc.action_items
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS action_items_assigned_mentor_select ON mmc.action_items;
CREATE POLICY action_items_assigned_mentor_select ON mmc.action_items
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS action_items_assigned_mentor_insert ON mmc.action_items;
CREATE POLICY action_items_assigned_mentor_insert ON mmc.action_items
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS action_items_assigned_mentor_update ON mmc.action_items;
CREATE POLICY action_items_assigned_mentor_update ON mmc.action_items
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS goals_admin_all ON mmc.goals;
CREATE POLICY goals_admin_all ON mmc.goals
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS goals_assigned_mentor_select ON mmc.goals;
CREATE POLICY goals_assigned_mentor_select ON mmc.goals
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS goals_assigned_mentor_insert ON mmc.goals;
CREATE POLICY goals_assigned_mentor_insert ON mmc.goals
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS goals_assigned_mentor_update ON mmc.goals;
CREATE POLICY goals_assigned_mentor_update ON mmc.goals
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS open_loops_admin_all ON mmc.open_loops;
CREATE POLICY open_loops_admin_all ON mmc.open_loops
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS open_loops_assigned_mentor_select ON mmc.open_loops;
CREATE POLICY open_loops_assigned_mentor_select ON mmc.open_loops
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS open_loops_assigned_mentor_insert ON mmc.open_loops;
CREATE POLICY open_loops_assigned_mentor_insert ON mmc.open_loops
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS open_loops_assigned_mentor_update ON mmc.open_loops;
CREATE POLICY open_loops_assigned_mentor_update ON mmc.open_loops
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS intelligence_snapshots_admin_all ON mmc.intelligence_snapshots;
CREATE POLICY intelligence_snapshots_admin_all ON mmc.intelligence_snapshots
  FOR ALL TO authenticated
  USING (mmc.is_mmc_admin())
  WITH CHECK (mmc.is_mmc_admin());
DROP POLICY IF EXISTS intelligence_snapshots_assigned_mentor_select ON mmc.intelligence_snapshots;
CREATE POLICY intelligence_snapshots_assigned_mentor_select ON mmc.intelligence_snapshots
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS intelligence_snapshots_assigned_mentor_insert ON mmc.intelligence_snapshots;
CREATE POLICY intelligence_snapshots_assigned_mentor_insert ON mmc.intelligence_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));
DROP POLICY IF EXISTS intelligence_snapshots_assigned_mentor_update ON mmc.intelligence_snapshots;
CREATE POLICY intelligence_snapshots_assigned_mentor_update ON mmc.intelligence_snapshots
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id))
  WITH CHECK (mmc.current_mentor_can_access_assignment(assignment_id, subject_ref_id, mentor_id));

DROP POLICY IF EXISTS audit_events_admin_select ON mmc.audit_events;
CREATE POLICY audit_events_admin_select ON mmc.audit_events
  FOR SELECT TO authenticated
  USING (mmc.is_mmc_admin());

DROP POLICY IF EXISTS audit_events_mentor_select_own ON mmc.audit_events;
CREATE POLICY audit_events_mentor_select_own ON mmc.audit_events
  FOR SELECT TO authenticated
  USING (
    mmc.is_mmc_mentor()
    AND actor_principal_id = mmc.current_principal_id()
  );

DROP POLICY IF EXISTS audit_events_insert_mmc_actor ON mmc.audit_events;
CREATE POLICY audit_events_insert_mmc_actor ON mmc.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (mmc.is_mmc_admin() OR mmc.current_mmc_role() = 'mentor')
    AND actor_principal_id = mmc.current_principal_id()
    AND lower(coalesce(actor_role, '')) = mmc.current_mmc_role()
  );

-- ---------------------------------------------------------------------------
-- Seed strategy note
-- ---------------------------------------------------------------------------
COMMENT ON TABLE mmc.mentor_assignments IS
  'Seed strategy: staging/local may seed mentors and assignments through RLS-tested scripts only. Production seeding is not authorized by MMC-020.';

COMMIT;

-- =============================================================================
-- ROLLBACK (commented; Supabase migrations do not provide native down files)
-- =============================================================================
-- BEGIN;
-- DROP SCHEMA IF EXISTS mmc CASCADE;
-- COMMIT;
