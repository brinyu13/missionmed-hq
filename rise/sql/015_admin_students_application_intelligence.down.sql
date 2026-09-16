-- P1-RISE-5014 rollback contract.
-- Do not destructively drop student priority or identity history after apply.
-- Roll back application bytes to the recorded P1-RISE-5013 deployment; the
-- additive table/column and fail-closed RLS policies may remain inert. Any
-- schema correction must be a separately authorized forward-only migration.

BEGIN;
DO $$
BEGIN
  IF to_regclass('rise_runtime.student_program_subjects') IS NULL THEN
    RAISE EXCEPTION 'P1-RISE-5014 schema is not present';
  END IF;
  RAISE NOTICE 'P1-RISE-5014 rollback is application-only; preserved student data is not dropped';
END
$$;
COMMIT;
