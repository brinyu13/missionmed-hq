import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL(
  '../db/migrations/20260715193625_i1q_1008a_identity_runtime_contract.sql',
  import.meta.url,
);
const migration = await readFile(migrationPath, 'utf8');
const compensationPath = new URL(
  '../db/rollback/20260715193845_i1q_1008a_compensating_disable.sql',
  import.meta.url,
);
const compensation = await readFile(compensationPath, 'utf8');
const reapplyPath = new URL(
  '../db/reapply/20260715193955_i1q_1008a_runtime_reapply.sql',
  import.meta.url,
);
const reapply = await readFile(reapplyPath, 'utf8');

function executableSql(sql) {
  return sql.replace(/^\s*--.*$/gmu, '');
}

test('1008A runtime migration satisfies the MR-078A file contract', () => {
  assert.match(migration, /^-- Migration: 20260715193625_i1q_1008a_identity_runtime_contract\.sql/mu);
  for (const field of [
    'Ticket', 'Authority', 'Target', 'Date', 'Depends on', 'Dependencies',
    'Description', 'Idempotent', 'Risk', 'Rollback/Compensation',
  ]) {
    assert.match(migration, new RegExp(`^-- ${field}:`, 'mu'));
  }
  assert.match(migration, /^-- Ticket: I1Q-1008A$/mu);
  assert.match(migration, /^-- Depends on: 20260715122434_i1q_1007x_question_platform\.sql$/mu);
  assert.match(migration, /^-- Dependencies:.*roles anon, authenticated,/mu);
  assert.match(migration, /\nBEGIN;[\s\S]*\nCOMMIT;\s*$/u);
  assert.doesNotMatch(executableSql(migration), /\b(?:DROP|TRUNCATE|DELETE)\b/iu);
});

test('identity capability and app runtime roles are separate and deny by default', () => {
  const sql = executableSql(migration);
  for (const role of ['i1q_identity_profile_reader', 'i1q_app_runtime']) {
    assert.match(sql, new RegExp(`CREATE ROLE ${role}[\\s\\S]*NOLOGIN[\\s\\S]*NOINHERIT[\\s\\S]*NOSUPERUSER[\\s\\S]*NOCREATEDB[\\s\\S]*NOCREATEROLE[\\s\\S]*NOREPLICATION[\\s\\S]*NOBYPASSRLS`, 'u'));
  }
  assert.match(sql, /RAISE EXCEPTION 'i1q_identity_profile_role_is_not_unprivileged'/u);
  assert.match(sql, /RAISE EXCEPTION 'i1q_app_runtime_role_is_not_unprivileged'/u);
  assert.match(sql, /GRANT USAGE ON SCHEMA i1q TO i1q_identity_profile_reader/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION i1q\.resolve_current_identity\(\) TO i1q_identity_profile_reader/u);
  assert.match(sql, /GRANT i1q_identity_profile_reader TO authenticated/u);
  assert.doesNotMatch(sql, /GRANT i1q_app_runtime TO authenticated/u);
  assert.doesNotMatch(sql, /GRANT (?:USAGE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|ALL)[\s\S]* TO i1q_app_runtime/u);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON (?:ALL )?TABLE/u);
  assert.doesNotMatch(sql, /ALTER (?:SCHEMA|TABLE|FUNCTION)[\s\S]*OWNER TO i1q_(?:identity_profile_reader|app_runtime)/u);
  assert.doesNotMatch(sql, /GRANT [\s\S]* TO anon/u);
  assert.match(sql, /FUNCTION i1q\.assert_1008a_role_contract\(expected_identity_membership boolean\)/u);
  assert.match(sql, /pg_catalog\.aclexplode/u);
  assert.match(sql, /i1q_1008a_role_direct_privilege_invalid/u);
  assert.match(sql, /i1q_1008a_role_membership_graph_invalid/u);
});

test('identity RPC is auth.uid grounded and exposes only database-owned roles', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION i1q.resolve_current_identity()');
  const end = migration.indexOf('$function$;', start);
  const fn = migration.slice(start, end);
  assert.match(fn, /actor uuid := i1q\.current_actor_id\(\)/u);
  assert.match(fn, /FROM i1q\.actor_role_memberships membership/u);
  assert.match(fn, /membership\.actor_id = actor/u);
  assert.match(fn, /membership\.revoked_at IS NULL/u);
  assert.match(fn, /reviewer\.actor_id = actor/u);
  assert.match(fn, /'identity_contract_version', 'i1q\.identity\.v1'/u);
  assert.doesNotMatch(fn, /email|wordpress|request|header|current_setting|set_config/iu);
});

test('every 1008A safety flag is inserted false without an enable function', () => {
  for (const key of [
    'transcript_batch_extraction_enabled',
    'physician_approval_enabled',
    'public_access_enabled',
    'automated_release_publication_enabled',
  ]) {
    assert.match(migration, new RegExp(`'${key}', false`, 'u'));
  }
  assert.doesNotMatch(migration, /FUNCTION i1q\.(?:enable|set)_feature_flag/iu);
  assert.match(migration, /i1q_1008a_preexisting_safety_flag_enabled/u);
  assert.match(migration, /i1q_1008a_safety_flag_invariant_failed/u);
});

test('1008A compensation is forward-only, data-preserving, and removes runtime capability', () => {
  assert.match(compensation, /^-- Migration: 20260715193845_i1q_1008a_compensating_disable\.sql/mu);
  assert.match(compensation, /^-- Depends on: 20260715193625_i1q_1008a_identity_runtime_contract\.sql$/mu);
  assert.match(compensation, /\nBEGIN;[\s\S]*\nCOMMIT;\s*$/u);
  const sql = executableSql(compensation);
  assert.match(sql, /REVOKE i1q_identity_profile_reader FROM authenticated/u);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA i1q FROM i1q_identity_profile_reader, i1q_app_runtime/u);
  assert.match(sql, /assert_1008a_role_contract\(false\)/u);
  assert.match(sql, /SELECT i1q\.disable_i1q_behavior/u);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/iu);
  assert.match(sql, /preserve all data and immutable history/u);
});

test('1008A reapply restores only identity capability and requires every flag off', () => {
  assert.match(reapply, /^-- Migration: 20260715193955_i1q_1008a_runtime_reapply\.sql/mu);
  assert.match(reapply, /^-- Depends on: 20260715193845_i1q_1008a_compensating_disable\.sql$/mu);
  assert.match(reapply, /\nBEGIN;[\s\S]*\nCOMMIT;\s*$/u);
  const sql = executableSql(reapply);
  assert.match(sql, /IF EXISTS \(SELECT 1 FROM i1q\.feature_flags flag WHERE flag\.enabled\)/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION i1q\.resolve_current_identity\(\) TO i1q_identity_profile_reader/u);
  assert.match(sql, /GRANT i1q_identity_profile_reader TO authenticated/u);
  assert.match(sql, /assert_1008a_role_contract\(true\)/u);
  assert.doesNotMatch(sql, /GRANT i1q_app_runtime TO authenticated/u);
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/iu);
  assert.doesNotMatch(sql, /SET enabled = true/iu);
  assert.match(sql, /'all_feature_flags_off', true/u);
});
