-- P1-RISE-5014: additive admin visibility over canonical student-program state.
-- Student choices remain student-owned. Admin access is read-only and requires
-- both the server capability guard and the transaction-scoped RLS flag.

BEGIN;

ALTER TABLE rise_runtime.student_program_states
  ADD COLUMN IF NOT EXISTS gold_starred boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS rise_runtime_student_state_admin_activity_idx
  ON rise_runtime.student_program_states (updated_at DESC, subject_key);

CREATE INDEX IF NOT EXISTS rise_runtime_student_state_gold_idx
  ON rise_runtime.student_program_states (subject_key, gold_starred, updated_at DESC)
  WHERE gold_starred;

DROP POLICY IF EXISTS rise_runtime_student_admin_read ON rise_runtime.student_program_states;
CREATE POLICY rise_runtime_student_admin_read
  ON rise_runtime.student_program_states
  FOR SELECT
  TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true');

CREATE TABLE IF NOT EXISTS rise_runtime.student_program_subjects (
  subject_key char(64) PRIMARY KEY CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  subject_ref text NOT NULL CHECK (length(subject_ref) BETWEEN 1 AND 256),
  display_name text CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 120),
  email text CHECK (email IS NULL OR length(email) BETWEEN 3 AND 320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CHECK (updated_at >= created_at),
  CHECK (last_seen_at >= created_at)
);

CREATE INDEX IF NOT EXISTS rise_runtime_student_subject_name_idx
  ON rise_runtime.student_program_subjects ((lower(display_name)) text_pattern_ops)
  WHERE display_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS rise_runtime_student_subject_last_seen_idx
  ON rise_runtime.student_program_subjects (last_seen_at DESC);

ALTER TABLE rise_runtime.student_program_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_program_subjects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rise_runtime_student_subject_owner_read ON rise_runtime.student_program_subjects;
CREATE POLICY rise_runtime_student_subject_owner_read
  ON rise_runtime.student_program_subjects
  FOR SELECT TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true));

DROP POLICY IF EXISTS rise_runtime_student_subject_owner_insert ON rise_runtime.student_program_subjects;
CREATE POLICY rise_runtime_student_subject_owner_insert
  ON rise_runtime.student_program_subjects
  FOR INSERT TO rise_app_runtime
  WITH CHECK (subject_key = current_setting('rise.subject_key', true));

DROP POLICY IF EXISTS rise_runtime_student_subject_owner_update ON rise_runtime.student_program_subjects;
CREATE POLICY rise_runtime_student_subject_owner_update
  ON rise_runtime.student_program_subjects
  FOR UPDATE TO rise_app_runtime
  USING (subject_key = current_setting('rise.subject_key', true))
  WITH CHECK (subject_key = current_setting('rise.subject_key', true));

DROP POLICY IF EXISTS rise_runtime_student_subject_admin_read ON rise_runtime.student_program_subjects;
CREATE POLICY rise_runtime_student_subject_admin_read
  ON rise_runtime.student_program_subjects
  FOR SELECT TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true');

REVOKE ALL ON rise_runtime.student_program_subjects FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON rise_runtime.student_program_subjects TO rise_app_runtime;

COMMIT;
