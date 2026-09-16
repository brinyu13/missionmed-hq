-- P1-RISE-5014A: one canonical, contiguous priority order on My Programs.
-- Additive and forward-only: the existing relationship remains authoritative.

BEGIN;

ALTER TABLE rise_runtime.student_program_states
  ADD COLUMN IF NOT EXISTS priority_position integer;

WITH ranked AS (
  SELECT subject_key, program_specialty_id,
         row_number() OVER (
           PARTITION BY subject_key
           ORDER BY created_at, program_specialty_id
         )::integer AS priority_position
  FROM rise_runtime.student_program_states
)
UPDATE rise_runtime.student_program_states AS state
SET priority_position = ranked.priority_position
FROM ranked
WHERE state.subject_key = ranked.subject_key
  AND state.program_specialty_id = ranked.program_specialty_id
  AND state.priority_position IS NULL;

ALTER TABLE rise_runtime.student_program_states
  ALTER COLUMN priority_position SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rise_runtime_student_state_priority_positive'
      AND conrelid = 'rise_runtime.student_program_states'::regclass
  ) THEN
    ALTER TABLE rise_runtime.student_program_states
      ADD CONSTRAINT rise_runtime_student_state_priority_positive
      CHECK (priority_position > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rise_runtime_student_state_subject_priority_key'
      AND conrelid = 'rise_runtime.student_program_states'::regclass
  ) THEN
    ALTER TABLE rise_runtime.student_program_states
      ADD CONSTRAINT rise_runtime_student_state_subject_priority_key
      UNIQUE (subject_key, priority_position)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rise_runtime_student_state_priority_idx
  ON rise_runtime.student_program_states (subject_key, priority_position);

DROP POLICY IF EXISTS rise_runtime_student_admin_priority_update
  ON rise_runtime.student_program_states;
CREATE POLICY rise_runtime_student_admin_priority_update
  ON rise_runtime.student_program_states
  FOR UPDATE TO rise_app_runtime
  USING (current_setting('rise.is_admin', true) = 'true')
  WITH CHECK (current_setting('rise.is_admin', true) = 'true');

CREATE TABLE IF NOT EXISTS rise_runtime.student_program_priority_audit (
  audit_id uuid PRIMARY KEY,
  actor_subject_key char(64) NOT NULL CHECK (actor_subject_key ~ '^[0-9a-f]{64}$'),
  target_subject_key char(64) NOT NULL CHECK (target_subject_key ~ '^[0-9a-f]{64}$'),
  actor_role text NOT NULL CHECK (actor_role IN ('student', 'admin', 'operator')),
  prior_order jsonb NOT NULL CHECK (jsonb_typeof(prior_order) = 'array'),
  ordered_program_specialty_ids jsonb NOT NULL CHECK (jsonb_typeof(ordered_program_specialty_ids) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rise_runtime_student_priority_audit_target_idx
  ON rise_runtime.student_program_priority_audit (target_subject_key, created_at DESC);

ALTER TABLE rise_runtime.student_program_priority_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_runtime.student_program_priority_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rise_runtime_student_priority_audit_insert
  ON rise_runtime.student_program_priority_audit;
CREATE POLICY rise_runtime_student_priority_audit_insert
  ON rise_runtime.student_program_priority_audit
  FOR INSERT TO rise_app_runtime
  WITH CHECK (
    actor_subject_key = current_setting('rise.subject_key', true)
    AND (
      target_subject_key = current_setting('rise.subject_key', true)
      OR current_setting('rise.is_admin', true) = 'true'
    )
  );

DROP POLICY IF EXISTS rise_runtime_student_priority_audit_read
  ON rise_runtime.student_program_priority_audit;
CREATE POLICY rise_runtime_student_priority_audit_read
  ON rise_runtime.student_program_priority_audit
  FOR SELECT TO rise_app_runtime
  USING (
    target_subject_key = current_setting('rise.subject_key', true)
    OR current_setting('rise.is_admin', true) = 'true'
  );

REVOKE ALL ON rise_runtime.student_program_priority_audit FROM PUBLIC;
GRANT SELECT, INSERT ON rise_runtime.student_program_priority_audit TO rise_app_runtime;

COMMIT;
