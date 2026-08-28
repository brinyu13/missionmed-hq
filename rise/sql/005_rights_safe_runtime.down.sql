-- P1-RISE-5006 controlled rollback for the isolated migration-005 objects.
-- This script is intentionally executable only in an explicitly named,
-- empty rehearsal database. It never drops the cluster-wide runtime role.

BEGIN;

DO $guard$
DECLARE
  table_name text;
  row_present boolean;
BEGIN
  IF current_setting('rise.rollback_005_empty_confirmed', true) IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'migration 005 rollback requires rise.rollback_005_empty_confirmed=YES';
  END IF;

  IF current_database() !~ '^rise_rollback_005_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'migration 005 rollback is restricted to a named rise_rollback_005_* rehearsal database';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'registry_releases',
    'source_authorizations',
    'registry_programs',
    'student_program_states',
    'request_budget_windows'
  ]
  LOOP
    IF to_regclass(format('rise_runtime.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM rise_runtime.%I LIMIT 1)', table_name)
        INTO row_present;
      IF row_present THEN
        RAISE EXCEPTION 'migration 005 rollback refuses non-empty table rise_runtime.%', table_name;
      END IF;
    END IF;
  END LOOP;
END
$guard$;

DROP POLICY IF EXISTS rise_runtime_student_subject_isolation
  ON rise_runtime.student_program_states;

REVOKE ALL ON ALL TABLES IN SCHEMA rise_runtime FROM rise_app_runtime;
REVOKE USAGE ON SCHEMA rise_runtime FROM rise_app_runtime;

DROP TABLE IF EXISTS rise_runtime.student_program_states;
DROP TABLE IF EXISTS rise_runtime.request_budget_windows;
DROP TABLE IF EXISTS rise_runtime.registry_programs;
DROP TABLE IF EXISTS rise_runtime.source_authorizations;
DROP TABLE IF EXISTS rise_runtime.registry_releases;
DROP SCHEMA IF EXISTS rise_runtime;

-- rise_app_runtime is a cluster-scoped shared role. Leaving it intact avoids
-- affecting production or another database in the same PostgreSQL cluster.

COMMIT;
