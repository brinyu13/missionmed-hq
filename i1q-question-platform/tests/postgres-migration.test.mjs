import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CORE_ENTITY_TYPES,
  OPERATIONAL_ENTITY_TYPES,
  ROLES,
  STAT_DATASET_FIELDS,
} from '../src/contracts.mjs';
import { buildReleaseMembership } from '../src/adapters/stat-v1.mjs';

const migrationPath = fileURLToPath(new URL(
  '../db/migrations/20260715122434_i1q_1007x_question_platform.sql',
  import.meta.url,
));
const compensationPath = fileURLToPath(new URL(
  '../db/rollback/20260715122435_i1q_1007x_compensating_disable.sql',
  import.meta.url,
));
const migration = readFileSync(migrationPath, 'utf8');
const compensation = readFileSync(compensationPath, 'utf8');

function executableSql(sql) {
  return sql.replace(/^\s*--.*$/gmu, '');
}

function tableDefinition(tableName) {
  const match = migration.match(new RegExp(
    `CREATE TABLE IF NOT EXISTS i1q\\.${tableName} \\(([\\s\\S]*?)\\n\\);`,
    'u',
  ));
  assert.ok(match, `missing table definition: ${tableName}`);
  return match[1];
}

function functionDefinition(functionName) {
  const match = migration.match(new RegExp(
    `CREATE OR REPLACE FUNCTION i1q\\.${functionName}\\([\\s\\S]*?\\n\\$function\\$;`,
    'u',
  ));
  assert.ok(match, `missing function definition: ${functionName}`);
  return match[0];
}

function declaredTables() {
  return [...migration.matchAll(/CREATE TABLE IF NOT EXISTS i1q\.([a-z_]+)/gu)]
    .map((match) => match[1]);
}

test('MR-078A filenames, headers, authority, and transaction wrappers are exact', () => {
  assert.match(migrationPath, /20260715122434_i1q_1007x_question_platform\.sql$/u);
  assert.match(compensationPath, /20260715122435_i1q_1007x_compensating_disable\.sql$/u);
  for (const [sql, filename] of [
    [migration, '20260715122434_i1q_1007x_question_platform.sql'],
    [compensation, '20260715122435_i1q_1007x_compensating_disable.sql'],
  ]) {
    assert.match(sql, new RegExp(`^-- Migration: ${filename}`, 'u'));
    for (const field of ['Ticket', 'Authority', 'Target', 'Date', 'Depends on', 'Dependencies', 'Description', 'Idempotent', 'Risk', 'Rollback/Compensation']) {
      assert.match(sql, new RegExp(`^-- ${field}:`, 'mu'));
    }
    assert.match(sql, /^-- Ticket: I1Q-1007X$/mu);
    assert.match(sql, /^-- Target: RANKLISTIQ, .*OFFLINE APP-OWNED CANDIDATE ONLY$/mu);
    assert.match(sql, /\nBEGIN;\n/u);
    assert.match(sql, /\nCOMMIT;\s*$/u);
  }
});

test('Architecture 1002.1 entities, roles, and forced RLS coverage stay aligned', () => {
  const tables = declaredTables();
  for (const entity of [...CORE_ENTITY_TYPES, ...OPERATIONAL_ENTITY_TYPES]) {
    assert.ok(tables.includes(entity), `missing Architecture entity table: ${entity}`);
  }
  const roleConstraint = tableDefinition('actor_role_memberships');
  for (const role of ROLES) assert.match(roleConstraint, new RegExp(`'${role}'`, 'u'));

  const allTablesBlock = migration.match(/all_tables text\[\] := ARRAY\[([\s\S]*?)\n  \];/u)?.[1];
  assert.ok(allTablesBlock, 'all_tables RLS inventory missing');
  const protectedTables = [...allTablesBlock.matchAll(/'([a-z_]+)'/gu)].map((match) => match[1]);
  assert.deepEqual(new Set(protectedTables), new Set(tables));
  assert.equal(protectedTables.length, tables.length);
  assert.match(migration, /ALTER TABLE i1q\.%I ENABLE ROW LEVEL SECURITY/u);
  assert.match(migration, /ALTER TABLE i1q\.%I FORCE ROW LEVEL SECURITY/u);
});

test('deny-by-default SQL has no destructive statement, permissive policy, or broad grant', () => {
  const sql = executableSql(migration);
  assert.doesNotMatch(sql, /\bDROP\b/iu);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/iu);
  assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/iu);
  assert.doesNotMatch(sql, /\bGRANT\b[\s\S]*?\b(?:PUBLIC|anon|authenticated)\b/iu);
  assert.match(sql, /REVOKE ALL ON SCHEMA i1q FROM PUBLIC/u);
  assert.match(sql, /ARRAY\['anon', 'authenticated'\]/u);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA i1q/u);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES IN SCHEMA i1q REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/u);
});

test('identity is grounded in auth.uid and caller role GUC spoofing is inert', () => {
  const sql = executableSql(migration);
  assert.match(functionDefinition('current_actor_id'), /SELECT auth\.uid\(\)/u);
  assert.match(functionDefinition('has_active_role'), /actor_role_memberships/u);
  assert.match(functionDefinition('has_active_role'), /membership\.actor_id = i1q\.current_actor_id\(\)/u);
  assert.doesNotMatch(sql, /current_setting\s*\(/iu);
  assert.doesNotMatch(sql, /set_config\s*\(/iu);
  assert.doesNotMatch(sql, /app\.actor_(?:id|roles)/iu);
  assert.match(migration, /Caller role GUCs are ignored/u);
  assert.match(migration, /runtime grants are intentionally absent pending a canonical unprivileged adapter role/iu);
});

test('answer-bearing and raw source fields are structurally isolated', () => {
  const revision = tableDefinition('item_revisions');
  assert.doesNotMatch(revision, /\banswer\b|\bexplanation\b|rationale|private_storage_ref/iu);
  assert.match(tableDefinition('item_revision_answers'), /answer char\(1\)/u);
  assert.match(tableDefinition('item_revision_answers'), /correct_answer_rationale/u);
  assert.match(tableDefinition('restricted_source_references'), /private_storage_ref text NOT NULL/u);
  assert.doesNotMatch(migration, /ON i1q\.item_revision_answers FOR SELECT/u);
  assert.doesNotMatch(migration, /ON i1q\.restricted_source_references FOR SELECT/u);
  assert.doesNotMatch(migration, /ON i1q\.channel_artifact_payloads FOR SELECT/u);
  assert.match(functionDefinition('read_item_revision_answers'), /PERFORM i1q\.append_audit_event/u);
  assert.match(functionDefinition('read_restricted_source_reference'), /PERFORM i1q\.append_audit_event/u);
});

test('anonymous, read-only, admin, author, reviewer, release, and privacy boundaries fail closed', () => {
  const answers = functionDefinition('read_item_revision_answers');
  const restricted = functionDefinition('read_restricted_source_reference');
  const revisionRead = functionDefinition('can_read_revision');

  assert.match(answers, /current_actor_id\(\) IS NULL/u);
  assert.match(revisionRead, /has_active_role\('read_only'\)[\s\S]*revision_workflow_state\(revision\.id\) = 'approved'/u);
  assert.doesNotMatch(answers, /platform_admin/u);
  assert.doesNotMatch(restricted, /platform_admin|read_only|release_manager|author|editorial_reviewer|physician_reviewer/u);
  assert.match(answers, /access_purpose = 'authoring'[\s\S]*revision\.author_actor_id = i1q\.current_actor_id\(\)/u);
  assert.match(answers, /assignment\.reviewer_actor_id = i1q\.current_actor_id\(\)/u);
  assert.match(answers, /assignment\.exact_revision_hash = revision\.content_hash/u);
  assert.match(answers, /assignment\.review_type = 'editorial'.*access_purpose = 'editorial_review'/u);
  assert.match(answers, /assignment\.review_type = 'medical'.*access_purpose = 'medical_review'/u);
  assert.match(answers, /access_purpose = 'release_validation'[\s\S]*has_active_role\('release_manager'\)[\s\S]*= 'approved'/u);
  assert.match(restricted, /ARRAY\['privacy_officer', 'system'\]/u);
});

test('review writes are assignment-scoped, exact-hash-bound, credentialed, and non-impersonating', () => {
  const assignments = tableDefinition('review_assignments');
  const events = tableDefinition('review_events');
  const create = functionDefinition('create_review_assignment');
  const record = functionDefinition('record_review_event');

  assert.match(assignments, /FOREIGN KEY \(item_revision_id, exact_revision_hash\)[\s\S]*REFERENCES i1q\.item_revisions\(id, content_hash\)/u);
  assert.match(events, /FOREIGN KEY \(assignment_id, item_revision_id, reviewer_id, reviewer_actor_id, review_type, reviewer_role, exact_revision_hash\)/u);
  assert.match(record, /assignment\.state <> 'accepted'/u);
  assert.match(record, /assignment\.reviewer_actor_id <> i1q\.current_actor_id\(\)/u);
  assert.match(record, /assignment\.exact_revision_hash <> revision\.content_hash/u);
  assert.match(record, /reviewer\.credential_verification_id = assignment\.credential_verification_id/u);
  assert.match(record, /reviewer_calibration_records/u);
  assert.match(create, /self_review_forbidden/u);
  assert.match(record, /self_review_forbidden/u);
  assert.match(record, /item_already_has_approved_revision/u);
  assert.doesNotMatch(record.match(/record_review_event\(([\s\S]*?)\)\nRETURNS/u)?.[1] ?? '', /actor|reviewer|role|credential|hash/iu);
  assert.match(migration, /review_assignments_scoped_read/u);
  assert.doesNotMatch(record, /platform_admin/u);
});

test('release identity, exact membership, hash chains, and disabled consumer flags are explicit', () => {
  const membership = tableDefinition('release_memberships');
  for (const field of ['release_id', 'item_id', 'item_revision_id', 'revision_number', 'content_hash', 'dataset_version', 'question_id']) {
    assert.match(membership, new RegExp(`\\b${field}\\b`, 'u'));
  }
  assert.match(membership, /UNIQUE \(dataset_version, question_id\)/u);
  assert.match(membership, /REFERENCES i1q\.item_revisions\(id, item_id, revision_number, content_hash\)/u);
  assert.match(migration, /question_id column is the adapter projected_question_id/u);

  const assemble = functionDefinition('assemble_release');
  assert.match(assemble, /medical_governance_is_credentialed\(\)/u);
  assert.match(assemble, /exact_medical_approval_missing/u);
  assert.match(assemble, /calculated_manifest_hash := i1q\.sha256_hex\(manifest_payload::text\)/u);
  assert.match(assemble, /previous_manifest_hash/u);
  assert.match(assemble, /release_membership', normalized_memberships/u);
  assert.match(functionDefinition('promote_release'), /medical_governance_is_credentialed\(\)/u);

  for (const key of ['student_content_enabled', 'student_release_enabled', 'stat_adapter_enabled', 'drills_adapter_enabled']) {
    assert.match(migration, new RegExp(`'${key}', false`, 'u'));
  }
  assert.doesNotMatch(migration, /FUNCTION i1q\.(?:enable|set)_feature_flag/iu);
  assert.doesNotMatch(migration, /ON i1q\.feature_flags FOR (?:INSERT|UPDATE|DELETE)/iu);
});

test('application adapter membership and projection contracts map exactly to SQL', () => {
  const hash = 'a'.repeat(64);
  const membership = buildReleaseMembership([{
    dataset_version: 'synthetic_v1',
    question_id: 'I1Q-SYNTHETIC-0001',
    revision: {
      id: 'itemrev_synthetic_1',
      item_id: 'item_synthetic_1',
      revision_number: 1,
      content_hash: hash,
    },
  }])[0];
  assert.deepEqual(Object.keys(membership), [
    'item_id',
    'item_revision_id',
    'revision_number',
    'content_hash',
    'dataset_version',
    'question_id',
  ]);
  for (const field of Object.keys(membership)) assert.match(tableDefinition('release_memberships'), new RegExp(`\\b${field}\\b`, 'u'));
  assert.deepEqual(STAT_DATASET_FIELDS, [
    'dataset_version', 'question_id', 'prompt', 'choice_a', 'choice_b', 'choice_c', 'choice_d', 'answer', 'explanation',
  ]);
  assert.match(tableDefinition('export_question_identities'), /question_id text PRIMARY KEY/u);
});

test('immutable records and the audit chain reject caller-supplied chain material', () => {
  const immutableBlock = migration.match(/immutable_tables text\[\] := ARRAY\[([\s\S]*?)\n  \];/u)?.[1] ?? '';
  for (const table of [
    'item_revisions', 'item_revision_answers', 'review_events', 'release_snapshots',
    'release_memberships', 'release_promotion_records', 'channel_artifacts',
    'channel_artifact_payloads', 'audit_events',
  ]) {
    assert.match(immutableBlock, new RegExp(`'${table}'`, 'u'));
  }
  assert.match(migration, /BEFORE UPDATE OR DELETE ON i1q\.%I/u);
  const prepare = functionDefinition('prepare_audit_event');
  for (const assignedField of ['sequence', 'id', 'actor_id', 'actor_label', 'previous_hash', 'occurred_at', 'event_hash']) {
    assert.match(prepare, new RegExp(`NEW\\.${assignedField} :=`, 'u'));
  }
  assert.match(prepare, /FOR UPDATE/u);
  const appendSignature = functionDefinition('append_audit_event').match(/append_audit_event\(([\s\S]*?)\)\nRETURNS/u)?.[1] ?? '';
  assert.doesNotMatch(appendSignature, /previous|predecessor|event_hash|sequence|actor/iu);
  assert.doesNotMatch(migration, /ON i1q\.audit_events FOR/u);
});

test('primary and compensation files are statically repeat-safe and compensation preserves history', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS/gu);
  assert.match(migration, /CREATE OR REPLACE FUNCTION/gu);
  assert.match(migration, /ON CONFLICT \([a-z_]+\) DO NOTHING/gu);
  assert.match(migration, /IF NOT EXISTS \(SELECT 1 FROM pg_catalog\.pg_policies/gu);

  const sql = executableSql(compensation);
  assert.doesNotMatch(sql, /\bDROP\b/iu);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/iu);
  assert.doesNotMatch(sql, /\bALTER\s+TABLE\b|\bTRUNCATE\b/iu);
  assert.match(sql, /SELECT i1q\.disable_i1q_behavior/u);
  const disable = functionDefinition('disable_i1q_behavior');
  assert.match(disable, /SET enabled = false/u);
  assert.match(disable, /IF NOT EXISTS[\s\S]*i1q_behavior_compensated/u);
  assert.match(disable, /'data_preserved', true/u);
  assert.match(disable, /'history_preserved', true/u);
});

const postgresUrl = process.env.I1Q_POSTGRES_TEST_URL;

function runPsql(args, input) {
  const result = spawnSync(
    process.env.PSQL_BIN || 'psql',
    ['-X', '--set', 'ON_ERROR_STOP=1', '--dbname', postgresUrl, ...args],
    { encoding: 'utf8', input, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
  return result.stdout;
}

test('ephemeral PostgreSQL apply, reapply, role attacks, compensation, and reapply proof', {
  skip: postgresUrl ? false : 'set I1Q_POSTGRES_TEST_URL to an isolated disposable local database',
  timeout: 60_000,
}, () => {
  runPsql([], `
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $auth$
      SELECT NULLIF(pg_catalog.current_setting('i1q_test.actor_id', true), '')::uuid
    $auth$;
  `);

  runPsql(['--file', migrationPath]);
  runPsql(['--file', migrationPath]);

  runPsql([], `
    DO $role$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'i1q_test_runtime') THEN
        CREATE ROLE i1q_test_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      END IF;
    END
    $role$;

    GRANT USAGE ON SCHEMA auth, i1q TO i1q_test_runtime;
    GRANT EXECUTE ON FUNCTION auth.uid() TO i1q_test_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA i1q TO i1q_test_runtime;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA i1q TO i1q_test_runtime;
    REVOKE EXECUTE ON FUNCTION i1q.append_audit_event(text, text, text, jsonb) FROM i1q_test_runtime;
    REVOKE EXECUTE ON FUNCTION i1q.disable_i1q_behavior(text, text) FROM i1q_test_runtime;
    REVOKE EXECUTE ON FUNCTION i1q.prepare_audit_event() FROM i1q_test_runtime;
    REVOKE EXECUTE ON FUNCTION i1q.reject_immutable_change() FROM i1q_test_runtime;
    REVOKE EXECUTE ON FUNCTION i1q.enforce_assignment_transition() FROM i1q_test_runtime;

    INSERT INTO i1q.actor_role_memberships (id, actor_id, role_name, grant_evidence_hash)
    VALUES
      ('membership_admin', '00000000-0000-0000-0000-000000000001', 'platform_admin', repeat('1', 64)),
      ('membership_author', '00000000-0000-0000-0000-000000000002', 'author', repeat('2', 64)),
      ('membership_editor', '00000000-0000-0000-0000-000000000003', 'editorial_reviewer', repeat('3', 64)),
      ('membership_physician', '00000000-0000-0000-0000-000000000004', 'physician_reviewer', repeat('4', 64)),
      ('membership_release', '00000000-0000-0000-0000-000000000005', 'release_manager', repeat('5', 64)),
      ('membership_privacy', '00000000-0000-0000-0000-000000000006', 'privacy_officer', repeat('6', 64)),
      ('membership_read', '00000000-0000-0000-0000-000000000007', 'read_only', repeat('7', 64));

    INSERT INTO i1q.taxonomy_versions (id, version, status, content, content_hash)
    VALUES ('tax_synthetic', 'synthetic_v1', 'active', '{}', repeat('a', 64));
    INSERT INTO i1q.misconception_vocabulary_versions (id, version, status, content_hash)
    VALUES ('mvv_synthetic', 'synthetic_v1', 'active', repeat('b', 64));
    INSERT INTO i1q.concepts (id, taxonomy_version_id, canonical_name, learning_objective, lifecycle, content_hash)
    VALUES ('concept_synthetic', 'tax_synthetic', 'Synthetic concept', 'Synthetic objective', 'active', repeat('c', 64));
    INSERT INTO i1q.variant_groups (id, concept_id, assertion, lifecycle, content_hash)
    VALUES ('vg_synthetic', 'concept_synthetic', 'Synthetic assertion', 'active', repeat('d', 64));
    INSERT INTO i1q.items (id, variant_group_id, item_type, variant_form, lifecycle)
    VALUES ('item_synthetic', 'vg_synthetic', 'single_best_answer', 'recall', 'active');
    INSERT INTO i1q.item_revisions (
      id, item_id, revision_number, author_actor_id, workflow_status,
      medical_validation_status, taxonomy_version_id, misconception_vocabulary_version_id,
      concept_id, prompt, choice_a, choice_b, choice_c, choice_d, classification, content_hash
    ) VALUES (
      'itemrev_synthetic', 'item_synthetic', 1, '00000000-0000-0000-0000-000000000002', 'candidate',
      'AI_DRAFT_NOT_MEDICALLY_VALIDATED', 'tax_synthetic', 'mvv_synthetic',
      'concept_synthetic', 'Synthetic prompt?', 'Alpha', 'Beta', 'Gamma', 'Delta', '{}', repeat('e', 64)
    );
    INSERT INTO i1q.item_revision_answers (
      item_revision_id, answer, explanation, correct_answer_rationale,
      distractor_rationales, teaching_point, answer_content_hash
    ) VALUES (
      'itemrev_synthetic', 'A', 'Synthetic explanation', 'Synthetic rationale',
      '{}', 'Synthetic teaching point', repeat('f', 64)
    );
    INSERT INTO i1q.rights_records (id, source_authority, rights_status, allowed_uses)
    VALUES ('rights_synthetic', 'synthetic', 'cleared_for', ARRAY['question_derivation']);
    INSERT INTO i1q.source_records (
      id, source_type, canonical_source_id, title, source_hash, rights_record_id
    ) VALUES (
      'source_synthetic', 'REVIEWER_AUTHORED', 'synthetic-source', 'Synthetic source', repeat('8', 64), 'rights_synthetic'
    );
    INSERT INTO i1q.restricted_source_references (
      id, source_record_id, raw_artifact_hash, private_storage_ref
    ) VALUES (
      'restricted_synthetic', 'source_synthetic', repeat('9', 64), 'private://synthetic-fixture'
    );
    INSERT INTO i1q.reviewers (
      id, actor_id, display_name, roles, credential_class, credential_status,
      credential_verification_id, active
    ) VALUES
      ('reviewer_editor', '00000000-0000-0000-0000-000000000003', 'Synthetic Editor', ARRAY['editorial_reviewer'], 'editorial', 'not_applicable', NULL, true),
      ('reviewer_physician', '00000000-0000-0000-0000-000000000004', 'Synthetic Credentialed Reviewer', ARRAY['physician_reviewer'], 'md', 'verified', 'synthetic-verification', true);
    INSERT INTO i1q.review_assignments (
      id, item_revision_id, reviewer_id, reviewer_actor_id, review_type, required_role,
      priority, exact_revision_hash, credential_status, state, assigned_by_actor_id, accepted_at
    ) VALUES
      ('assignment_editor', 'itemrev_synthetic', 'reviewer_editor', '00000000-0000-0000-0000-000000000003', 'editorial', 'editorial_reviewer',
       'P1', repeat('e', 64), 'not_applicable', 'accepted', '00000000-0000-0000-0000-000000000001', pg_catalog.clock_timestamp()),
      ('assignment_cross', 'itemrev_synthetic', 'reviewer_physician', '00000000-0000-0000-0000-000000000004', 'medical', 'physician_reviewer',
       'P1', repeat('e', 64), 'verified', 'open', '00000000-0000-0000-0000-000000000001', NULL);

    SET ROLE i1q_test_runtime;

    CREATE OR REPLACE FUNCTION pg_temp.expect_denied(command text)
    RETURNS void
    LANGUAGE plpgsql
    AS $expect$
    BEGIN
      BEGIN
        EXECUTE command;
      EXCEPTION WHEN insufficient_privilege THEN
        RETURN;
      END;
      RAISE EXCEPTION 'expected_42501:%', command;
    END
    $expect$;

    SELECT pg_catalog.set_config('i1q_test.actor_id', '', false);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'authoring')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000007', false);
    DO $check$ BEGIN
      IF EXISTS (SELECT 1 FROM i1q.item_revisions WHERE id = 'itemrev_synthetic') THEN
        RAISE EXCEPTION 'read_only_unapproved_revision_visible';
      END IF;
    END $check$;
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'authoring')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000001', false);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'authoring')$sql$);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_restricted_source_reference('restricted_synthetic', 'privacy_review')$sql$);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.create_review_assignment('forged_assignment', 'itemrev_synthetic', 'reviewer_editor', 'editorial', 'P1', NULL)$sql$);
    DO $check$ BEGIN
      UPDATE i1q.feature_flags SET enabled = true WHERE key = 'student_release_enabled';
      IF FOUND THEN RAISE EXCEPTION 'ordinary_role_enabled_student_release'; END IF;
    END $check$;

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000002', false);
    DO $check$ BEGIN
      IF (SELECT count(*) FROM i1q.read_item_revision_answers('itemrev_synthetic', 'authoring')) <> 1 THEN
        RAISE EXCEPTION 'author_answer_scope_failed';
      END IF;
      IF EXISTS (SELECT 1 FROM i1q.item_revision_answers) THEN
        RAISE EXCEPTION 'answer_base_table_visible';
      END IF;
    END $check$;
    SELECT pg_catalog.set_config('app.actor_roles', 'privacy_officer,system', false);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_restricted_source_reference('restricted_synthetic', 'privacy_review')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000003', false);
    DO $check$ BEGIN
      IF (SELECT count(*) FROM i1q.read_item_revision_answers('itemrev_synthetic', 'editorial_review')) <> 1 THEN
        RAISE EXCEPTION 'assigned_editor_answer_scope_failed';
      END IF;
    END $check$;
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.accept_review_assignment('assignment_cross')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000004', false);
    DO $check$ BEGIN
      IF EXISTS (SELECT 1 FROM i1q.review_assignments WHERE id = 'assignment_editor') THEN
        RAISE EXCEPTION 'cross_assignment_visible';
      END IF;
    END $check$;
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'medical_review')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000005', false);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'release_validation')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000006', false);
    DO $check$ BEGIN
      IF (SELECT count(*) FROM i1q.read_restricted_source_reference('restricted_synthetic', 'privacy_review')) <> 1 THEN
        RAISE EXCEPTION 'privacy_scope_failed';
      END IF;
      IF EXISTS (SELECT 1 FROM i1q.restricted_source_references) THEN
        RAISE EXCEPTION 'restricted_source_base_table_visible';
      END IF;
    END $check$;

    DO $check$ BEGIN
      IF pg_catalog.has_function_privilege(CURRENT_USER, 'i1q.append_audit_event(text,text,text,jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION 'runtime_can_append_arbitrary_audit';
      END IF;
      IF pg_catalog.has_function_privilege(CURRENT_USER, 'i1q.disable_i1q_behavior(text,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'runtime_can_call_compensation';
      END IF;
    END $check$;

    RESET ROLE;
    DO $check$
    DECLARE blocked boolean := false;
    BEGIN
      BEGIN
        UPDATE i1q.item_revisions SET prompt = 'Mutated' WHERE id = 'itemrev_synthetic';
      EXCEPTION WHEN SQLSTATE '55000' THEN
        blocked := true;
      END;
      IF NOT blocked THEN RAISE EXCEPTION 'immutable_revision_update_succeeded'; END IF;
    END $check$;
  `);

  runPsql(['--file', compensationPath]);
  runPsql(['--file', compensationPath]);
  runPsql(['--file', migrationPath]);
  runPsql([], `
    DO $verify$
    BEGIN
      IF EXISTS (SELECT 1 FROM i1q.feature_flags WHERE enabled) THEN
        RAISE EXCEPTION 'compensation_flag_reenabled';
      END IF;
      IF (SELECT count(*) FROM i1q.audit_events WHERE action = 'i1q_behavior_compensated' AND entity_id = '20260715122435') <> 1 THEN
        RAISE EXCEPTION 'compensation_audit_not_idempotent';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM i1q.item_revisions WHERE id = 'itemrev_synthetic') THEN
        RAISE EXCEPTION 'compensation_removed_history';
      END IF;
      IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'i1q' AND c.relkind IN ('r', 'p') AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)) <> 0 THEN
        RAISE EXCEPTION 'rls_not_forced_on_every_table';
      END IF;
    END
    $verify$;
  `);
});
