-- P1-RISE-5003 proposed durable My Programs state.
-- Apply only through an authorized, reviewed, forward-only migration after the
-- active registry release, backup, restore rehearsal, and runtime role exist.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rise_student_state_runtime') THEN
    CREATE ROLE rise_student_state_runtime NOLOGIN;
  END IF;
END
$$;

CREATE TABLE rise_app.student_program_states (
  subject_key char(64) NOT NULL CHECK (subject_key ~ '^[0-9a-f]{64}$'),
  last_bound_release_id text NOT NULL,
  program_specialty_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('SAVED', 'APPLIED', 'INTERVIEWING', 'RANKED')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_key, program_specialty_id),
  FOREIGN KEY (last_bound_release_id, program_specialty_id)
    REFERENCES rise.program_specialties(release_id, program_specialty_id),
  CHECK (updated_at >= created_at)
);

CREATE INDEX rise_student_program_states_subject_updated_idx
  ON rise_app.student_program_states (subject_key, updated_at DESC);

ALTER TABLE rise_app.student_program_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE rise_app.student_program_states FORCE ROW LEVEL SECURITY;

CREATE POLICY rise_student_program_states_subject_isolation
  ON rise_app.student_program_states
  FOR ALL
  TO rise_student_state_runtime
  USING (subject_key = (SELECT current_setting('rise.subject_key', true)))
  WITH CHECK (subject_key = (SELECT current_setting('rise.subject_key', true)));

REVOKE ALL ON rise_app.student_program_states FROM PUBLIC;
GRANT USAGE ON SCHEMA rise_app TO rise_student_state_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON rise_app.student_program_states TO rise_student_state_runtime;

COMMIT;
