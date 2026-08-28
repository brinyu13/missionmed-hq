-- Forward-only custody: this rollback intentionally refuses to drop student data.
-- Restore an earlier application release while leaving the table and rows intact.

BEGIN;

DO $$
BEGIN
  IF to_regclass('rise_app.student_program_states') IS NULL THEN
    RAISE EXCEPTION 'rise_app.student_program_states is absent; nothing to preserve';
  END IF;
  RAISE EXCEPTION 'Destructive rollback refused: preserve student program state and roll back application code only';
END
$$;

ROLLBACK;
