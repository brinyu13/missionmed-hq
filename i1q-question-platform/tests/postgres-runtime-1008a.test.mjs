import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const basePath = fileURLToPath(new URL(
  '../db/migrations/20260715122434_i1q_1007x_question_platform.sql',
  import.meta.url,
));
const runtimePath = fileURLToPath(new URL(
  '../db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql',
  import.meta.url,
));
const compensationPath = fileURLToPath(new URL(
  '../db/rollback/20260715193845_i1q_1008a_compensating_disable.sql',
  import.meta.url,
));
const reapplyPath = fileURLToPath(new URL(
  '../db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql',
  import.meta.url,
));

for (const path of [basePath, runtimePath, compensationPath, reapplyPath]) readFileSync(path, 'utf8');

const postgresUrl = process.env.I1Q_RUNTIME_POSTGRES_TEST_URL;

function runPsql(args = [], input = '') {
  const result = spawnSync(
    process.env.PSQL_BIN || 'psql',
    ['-X', '--set', 'ON_ERROR_STOP=1', '--dbname', postgresUrl, ...args],
    { encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
  return result.stdout;
}

function runPsqlFailure(args = [], input = '', expectedPattern) {
  const result = spawnSync(
    process.env.PSQL_BIN || 'psql',
    ['-X', '--set', 'ON_ERROR_STOP=1', '--dbname', postgresUrl, ...args],
    { encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.notEqual(result.status, 0, 'expected psql command to fail closed');
  assert.match([result.stdout, result.stderr].filter(Boolean).join('\n'), expectedPattern);
}

test('1008A PostgreSQL runtime role, compensation, and reapply execute against a disposable target', {
  skip: postgresUrl ? false : 'set I1Q_RUNTIME_POSTGRES_TEST_URL to an isolated disposable local database',
  timeout: 60_000,
}, () => {
  runPsql([], `
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $roles$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    SET search_path = pg_catalog
    AS $uid$
      SELECT NULLIF(pg_catalog.current_setting('i1q_test.actor_id', true), '')::uuid
    $uid$;
  `);
  runPsql(['--file', basePath]);
  runPsql([], `
    INSERT INTO i1q.actor_role_memberships (
      id, actor_id, role_name, grant_evidence_hash
    ) VALUES (
      'membership_runtime_fixture',
      '10000000-0000-4000-8000-000000000001',
      'read_only',
      repeat('a', 64)
    );
  `);
  runPsql(['--file', runtimePath]);
  runPsql(['--file', runtimePath]);
  runPsql([], `
    CREATE TABLE public.i1q_role_collision_fixture (value text);
    GRANT SELECT ON public.i1q_role_collision_fixture TO i1q_identity_profile_reader;
  `);
  runPsqlFailure(
    ['--file', runtimePath],
    '',
    /i1q_1008a_role_direct_privilege_invalid/u,
  );
  runPsql([], `
    REVOKE SELECT ON public.i1q_role_collision_fixture FROM i1q_identity_profile_reader;
    DROP TABLE public.i1q_role_collision_fixture;
    UPDATE i1q.feature_flags
       SET enabled = true
     WHERE key = 'public_access_enabled';
  `);
  runPsqlFailure(
    ['--file', runtimePath],
    '',
    /i1q_1008a_preexisting_safety_flag_enabled/u,
  );
  runPsql([], `
    UPDATE i1q.feature_flags
       SET enabled = false
     WHERE key = 'public_access_enabled';
  `);
  runPsql([], `
    CREATE OR REPLACE FUNCTION pg_temp.expect_denied(statement text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = pg_catalog
    AS $expect$
    DECLARE denied boolean := false;
    BEGIN
      BEGIN
        EXECUTE statement;
      EXCEPTION WHEN insufficient_privilege THEN
        denied := true;
      END;
      IF NOT denied THEN
        RAISE EXCEPTION 'statement_was_not_denied';
      END IF;
    END
    $expect$;

    DO $role_shape$
    DECLARE
      identity_role pg_catalog.pg_roles%ROWTYPE;
      app_runtime_role pg_catalog.pg_roles%ROWTYPE;
    BEGIN
      SELECT * INTO identity_role FROM pg_catalog.pg_roles WHERE rolname = 'i1q_identity_profile_reader';
      SELECT * INTO app_runtime_role FROM pg_catalog.pg_roles WHERE rolname = 'i1q_app_runtime';
      IF identity_role.rolcanlogin OR identity_role.rolinherit OR identity_role.rolsuper
         OR identity_role.rolcreatedb OR identity_role.rolcreaterole
         OR identity_role.rolreplication OR identity_role.rolbypassrls THEN
        RAISE EXCEPTION 'identity_profile_role_privileged';
      END IF;
      IF app_runtime_role.rolcanlogin OR app_runtime_role.rolinherit OR app_runtime_role.rolsuper
         OR app_runtime_role.rolcreatedb OR app_runtime_role.rolcreaterole
         OR app_runtime_role.rolreplication OR app_runtime_role.rolbypassrls THEN
        RAISE EXCEPTION 'application_runtime_role_privileged';
      END IF;
      IF NOT pg_catalog.pg_has_role('authenticated', 'i1q_identity_profile_reader', 'MEMBER') THEN
        RAISE EXCEPTION 'authenticated_identity_profile_membership_missing';
      END IF;
      IF pg_catalog.pg_has_role('authenticated', 'i1q_app_runtime', 'MEMBER') THEN
        RAISE EXCEPTION 'application_runtime_is_browser_reachable';
      END IF;
      IF EXISTS (
        SELECT 1
          FROM pg_catalog.pg_namespace namespace
         WHERE namespace.nspname = 'i1q'
           AND namespace.nspowner IN (
             SELECT oid FROM pg_catalog.pg_roles
              WHERE rolname IN ('i1q_identity_profile_reader', 'i1q_app_runtime')
           )
      ) THEN
        RAISE EXCEPTION 'i1q_capability_role_owns_schema';
      END IF;
      IF EXISTS (
        SELECT 1
          FROM pg_catalog.pg_class relation
          JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = 'i1q'
           AND relation.relkind IN ('r', 'p', 'S')
           AND (
             pg_catalog.has_table_privilege('i1q_identity_profile_reader', relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
             OR pg_catalog.has_table_privilege('i1q_app_runtime', relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
           )
      ) THEN
        RAISE EXCEPTION 'i1q_capability_role_has_direct_table_privilege';
      END IF;
    END
    $role_shape$;

    SET ROLE authenticated;
    SELECT pg_catalog.set_config('i1q_test.actor_id', '10000000-0000-4000-8000-000000000001', false);
    DO $identity$
    DECLARE profile jsonb := i1q.resolve_current_identity();
    BEGIN
      IF profile ->> 'identity_contract_version' <> 'i1q.identity.v1'
         OR profile ->> 'actor_id' <> '10000000-0000-4000-8000-000000000001'
         OR (profile ->> 'active')::boolean IS NOT TRUE
         OR profile -> 'memberships' -> 0 ->> 'name' <> 'read_only' THEN
        RAISE EXCEPTION 'runtime_identity_profile_invalid';
      END IF;
    END
    $identity$;
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.actor_role_memberships$sql$);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.item_revision_answers$sql$);
    SELECT pg_temp.expect_denied($sql$SELECT i1q.disable_i1q_behavior('forged', 'forged')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '10000000-0000-4000-8000-000000000099', false);
    DO $unauthorized$
    DECLARE profile jsonb := i1q.resolve_current_identity();
    BEGIN
      IF (profile ->> 'active')::boolean OR pg_catalog.jsonb_array_length(profile -> 'memberships') <> 0 THEN
        RAISE EXCEPTION 'unauthorized_actor_received_role';
      END IF;
    END
    $unauthorized$;
    RESET ROLE;
  `);

  runPsql(['--file', compensationPath]);
  runPsql(['--file', compensationPath]);
  runPsql([], `
    DO $compensated$
    BEGIN
      IF pg_catalog.pg_has_role('authenticated', 'i1q_identity_profile_reader', 'MEMBER') THEN
        RAISE EXCEPTION 'identity_profile_membership_survived_compensation';
      END IF;
      IF pg_catalog.pg_has_role('authenticated', 'i1q_app_runtime', 'MEMBER') THEN
        RAISE EXCEPTION 'application_runtime_became_browser_reachable';
      END IF;
      IF EXISTS (SELECT 1 FROM i1q.feature_flags WHERE enabled) THEN
        RAISE EXCEPTION 'feature_flag_survived_compensation';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM i1q.actor_role_memberships
         WHERE id = 'membership_runtime_fixture'
      ) THEN
        RAISE EXCEPTION 'compensation_removed_identity_history';
      END IF;
      IF (SELECT count(*) FROM i1q.compensation_records WHERE compensation_id = '20260715193845') <> 1 THEN
        RAISE EXCEPTION 'compensation_not_idempotent';
      END IF;
    END
    $compensated$;
  `);

  runPsql(['--file', reapplyPath]);
  runPsql(['--file', reapplyPath]);
  runPsql([], `
    DO $reapplied$
    BEGIN
      IF NOT pg_catalog.pg_has_role('authenticated', 'i1q_identity_profile_reader', 'MEMBER') THEN
        RAISE EXCEPTION 'identity_profile_membership_not_reapplied';
      END IF;
      IF pg_catalog.pg_has_role('authenticated', 'i1q_app_runtime', 'MEMBER') THEN
        RAISE EXCEPTION 'application_runtime_reapply_became_browser_reachable';
      END IF;
      IF EXISTS (SELECT 1 FROM i1q.feature_flags WHERE enabled) THEN
        RAISE EXCEPTION 'reapply_enabled_feature_flag';
      END IF;
      IF (SELECT count(*) FROM i1q.schema_versions WHERE version IN (
        '20260715193625', '20260715193845', '20260715193955'
      )) <> 3 THEN
        RAISE EXCEPTION 'runtime_migration_history_incomplete';
      END IF;
      IF (SELECT count(*) FROM i1q.audit_events WHERE action = 'identity_runtime_contract_reapplied') <> 1 THEN
        RAISE EXCEPTION 'reapply_audit_not_idempotent';
      END IF;
    END
    $reapplied$;
  `);
});
