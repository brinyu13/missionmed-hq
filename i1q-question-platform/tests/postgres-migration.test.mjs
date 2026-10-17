import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CORE_ENTITY_TYPES,
  OPERATIONAL_ENTITY_TYPES,
  REQUIRED_RELEASE_VALIDATION_CHECK_IDS,
  ROLES,
  STAT_DATASET_FIELDS,
} from '../src/contracts.mjs';
import { buildReleaseMembership } from '../src/adapters/stat-v1.mjs';
import { releaseValidationEvidenceHash } from '../src/exports.mjs';
import { sha256 } from '../src/hash.mjs';

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
  assert.match(answers, /assignment\.review_type = 'editorial'[\s\S]*access_purpose = 'editorial_review'/u);
  assert.match(answers, /assignment\.review_type = 'medical'[\s\S]*access_purpose = 'medical_review'/u);
  assert.match(answers, /assignment\.state = 'accepted'/u);
  assert.match(answers, /has_active_role\(assignment\.required_role\)/u);
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
  assert.match(create, /target_review_type = 'editorial'[\s\S]*NOT IN \('candidate', 'editorial_review'\)/u);
  assert.match(functionDefinition('accept_review_assignment'), /assignment\.review_type = 'editorial'[\s\S]*NOT IN \('candidate', 'editorial_review'\)/u);
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
  assert.match(assemble, /calculated_manifest_hash := i1q\.sha256_hex\(i1q\.canonical_json\(manifest_payload\)\)/u);
  assert.match(assemble, /previous_manifest_hash/u);
  assert.match(assemble, /release_membership', normalized_memberships/u);
  const promote = functionDefinition('promote_release');
  assert.match(promote, /medical_governance_is_credentialed\(\)/u);
  assert.match(promote, /pg_catalog\.jsonb_array_length\(promotion_evidence_hashes\) = 0/u);
  assert.match(promote, /evidence_hash #>> '\{\}' !~ '\^\[0-9a-f\]\{64\}\$'/u);
  assert.match(functionDefinition('record_export_validation'), /normalized_check_ids <> required_check_ids/u);
  assert.match(functionDefinition('record_export_validation'), /artifact_results/u);
  assert.match(functionDefinition('create_channel_artifact'), /policy\.channel <> target_channel/u);
  assert.match(functionDefinition('create_channel_artifact'), /channel_artifact_pre_answer_leak/u);

  for (const key of ['student_content_enabled', 'student_release_enabled', 'stat_adapter_enabled', 'drills_adapter_enabled']) {
    assert.match(migration, new RegExp(`'${key}', false`, 'u'));
  }
  assert.doesNotMatch(migration, /FUNCTION i1q\.(?:enable|set)_feature_flag/iu);
  assert.doesNotMatch(migration, /ON i1q\.feature_flags FOR (?:INSERT|UPDATE|DELETE)/iu);
});

test('student artifacts reject exact release-scoped Class D values embedded in prose', () => {
  const createArtifact = functionDefinition('create_channel_artifact');
  const identifierValues = functionDefinition('release_class_d_identifier_values');
  const identifierLeak = functionDefinition('contains_release_class_d_identifier');
  const canonicalText = functionDefinition('canonical_security_text');
  const normalizedText = functionDefinition('normalize_security_text');
  const markerCheck = functionDefinition('is_class_d_field_marker');
  const markerLeak = functionDefinition('contains_class_d_field_marker');

  assert.match(createArtifact, /target_data_class IN \('A', 'C'\)/u);
  assert.match(createArtifact, /i1q\.release_memberships membership/u);
  assert.match(createArtifact, /channel_artifact_class_d_scan_unavailable/u);
  assert.match(createArtifact, /i1q\.jsonb_string_values\(artifact_payload\)/u);
  assert.match(createArtifact, /i1q\.contains_release_class_d_identifier\(scalar\.string_value, target_release_id\)/u);
  assert.match(identifierLeak, /pg_catalog\.strpos\(candidate_entry\.normalized, identifier\.normalized\) > 0/u);
  assert.match(identifierLeak, /pg_catalog\.length\(identifier\.normalized\) >= 4/u);
  assert.match(identifierLeak, /'base64'/u);
  assert.match(identifierLeak, /identifier\.canonical/u);
  assert.match(identifierLeak, /canonical_base64_value/u);
  assert.match(canonicalText, /max_security_text_bytes constant integer := 65536/u);
  assert.match(normalizedText, /max_url_decode_rounds constant integer := 8/u);
  assert.match(normalizedText, /FOR decode_round IN 1\.\.max_url_decode_rounds LOOP/u);
  assert.match(normalizedText, /FOR ascii_code IN 32\.\.126 LOOP/u);
  assert.match(normalizedText, /CONTINUE WHEN ascii_code = 37/u);
  assert.match(normalizedText, /normalized := pg_catalog\.lower\(normalized\);/u);
  assert.match(normalizedText, /normalized := pg_catalog\.lower\(pg_catalog\.normalize\(normalized, 'NFKC'\)\);/u);
  assert.match(normalizedText, /normalized ~ '%\[0-9a-f\]\{2\}'/u);
  assert.match(normalizedText, /security_text_encoding_depth_exceeded/u);
  assert.match(normalizedText, /security_text_size_limit_exceeded/u);
  assert.ok(normalizedText.indexOf('FOR ascii_code IN 32..126 LOOP') < normalizedText.indexOf("replace(normalized, '%25', '%')"));
  assert.ok(normalizedText.indexOf("replace(normalized, '%25', '%')") < normalizedText.indexOf('normalized := pg_catalog.lower(normalized);'));
  assert.ok(createArtifact.indexOf("IF target_data_class IN ('A', 'C')") < createArtifact.indexOf('calculated_hash := '));
  assert.ok(createArtifact.indexOf('calculated_hash := ') < createArtifact.indexOf('INSERT INTO i1q.channel_artifacts'));
  for (const family of ['item', 'revision', 'source', 'claim', 'reviewer', 'misconception', 'psychometric']) {
    assert.match(identifierValues, new RegExp(`SELECT '${family}'`, 'u'));
  }
  assert.match(identifierValues, /JOIN i1q\.item_revision_sources/u);
  assert.match(identifierValues, /JOIN i1q\.item_revision_claims/u);
  assert.match(identifierValues, /JOIN i1q\.review_assignments/u);
  assert.match(identifierValues, /JOIN i1q\.review_events/u);
  assert.match(identifierValues, /JOIN i1q\.item_revision_misconceptions/u);
  assert.match(identifierValues, /JOIN i1q\.psychometric_snapshots/u);
  assert.match(markerCheck, /'sourceid'/u);
  assert.match(markerCheck, /'psychometricsnapshotid'/u);
  assert.match(markerLeak, /i1q\.normalize_security_text\(candidate\)/u);
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

test('immutable and guarded records reject caller-supplied chain material', () => {
  const immutableBlock = migration.match(/immutable_tables text\[\] := ARRAY\[([\s\S]*?)\n  \];/u)?.[1] ?? '';
  for (const table of [
    'review_events', 'release_snapshots',
    'release_memberships', 'release_promotion_records', 'channel_artifacts',
    'channel_artifact_payloads', 'audit_events',
  ]) {
    assert.match(immutableBlock, new RegExp(`'${table}'`, 'u'));
  }
  assert.match(migration, /item_revisions_guarded_mutation/u);
  assert.match(migration, /item_revision_answers_guarded_mutation/u);
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
  assert.match(disable, /pg_advisory_xact_lock/u);
  assert.match(disable, /FROM i1q\.compensation_records/u);
  assert.match(disable, /INSERT INTO i1q\.compensation_records/u);
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
  const safeArtifactPayload = [{
    dataset_version: 'synthetic_release_v1',
    question_id: 'Q1',
    prompt: 'Synthetic?',
    choices: ['A', 'B', 'C', 'D'],
  }];
  const cleanClassCArtifactPayload = [{
    dataset_version: 'synthetic_release_v1',
    question_id: 'Q1',
    answer: 'A',
    explanation: 'A source and reviewer can support a medical claim without exposing internal identifiers.',
    correct_answer_rationale: 'The item revision is coherent.',
    distractor_rationales: [{
      choice_key: 'B',
      why_tempting: 'Psychometric evidence can make a distractor seem plausible.',
      why_wrong: 'The stated reasoning does not support that choice.',
    }],
  }];
  const safeArtifactSql = JSON.stringify(safeArtifactPayload).replaceAll("'", "''");
  const cleanClassCArtifactSql = JSON.stringify(cleanClassCArtifactPayload).replaceAll("'", "''");
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
      ('membership_read', '00000000-0000-0000-0000-000000000007', 'read_only', repeat('7', 64)),
      ('membership_assembler', '00000000-0000-0000-0000-000000000008', 'release_manager', repeat('8', 64));

    INSERT INTO i1q.taxonomy_versions (id, version, status, content, content_hash)
    VALUES ('tax_synthetic', 'synthetic_v1', 'active', '{}', repeat('a', 64));
    INSERT INTO i1q.misconception_vocabulary_versions (id, version, status, content_hash)
    VALUES ('mvv_synthetic', 'synthetic_v1', 'active', repeat('b', 64));
    INSERT INTO i1q.misconception_entries (
      id, vocabulary_version_id, label, definition, content_hash
    ) VALUES
      (
        'misconception_synthetic', 'mvv_synthetic', 'Synthetic misconception',
        'Synthetic non-clinical fixture definition', repeat('b', 64)
      ),
      (
        'Misconception_MixedCase', 'mvv_synthetic', 'Synthetic mixed-case misconception',
        'Synthetic non-clinical mixed-case fixture definition', repeat('6', 64)
      );
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
    INSERT INTO i1q.items (id, variant_group_id, item_type, variant_form, lifecycle)
    VALUES ('Item_MixedCase', 'vg_synthetic', 'single_best_answer', 'recall', 'active');
    INSERT INTO i1q.item_revisions (
      id, item_id, revision_number, author_actor_id, workflow_status,
      medical_validation_status, taxonomy_version_id, misconception_vocabulary_version_id,
      concept_id, prompt, choice_a, choice_b, choice_c, choice_d, classification, content_hash
    ) VALUES (
      'ItemRev_MixedCase', 'Item_MixedCase', 1, '00000000-0000-0000-0000-000000000002', 'candidate',
      'AI_DRAFT_NOT_MEDICALLY_VALIDATED', 'tax_synthetic', 'mvv_synthetic',
      'concept_synthetic', 'Synthetic mixed-case prompt?', 'Alpha', 'Beta', 'Gamma', 'Delta', '{}', repeat('6', 64)
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
    ) VALUES
      (
        'source_synthetic', 'REVIEWER_AUTHORED', 'synthetic-source', 'Synthetic source', repeat('8', 64), 'rights_synthetic'
      ),
      (
        'Source_MixedCase', 'REVIEWER_AUTHORED', 'synthetic-source-mixed', 'Synthetic mixed-case source', repeat('7', 64), 'rights_synthetic'
      );
    INSERT INTO i1q.item_revision_sources (
      item_revision_id, source_record_id, source_role
    ) VALUES
      ('itemrev_synthetic', 'source_synthetic', 'primary'),
      ('itemrev_synthetic', 'Source_MixedCase', 'supporting');
    INSERT INTO i1q.item_revision_misconceptions (
      item_revision_id, choice_key, misconception_id, vocabulary_version_id, trap_type, provenance
    ) VALUES
      (
        'itemrev_synthetic', 'B', 'misconception_synthetic', 'mvv_synthetic',
        'synthetic_trap', 'reviewer_authored'
      ),
      (
        'itemrev_synthetic', 'C', 'Misconception_MixedCase', 'mvv_synthetic',
        'synthetic_mixed_case_trap', 'reviewer_authored'
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
      ('reviewer_physician', '00000000-0000-0000-0000-000000000004', 'Synthetic Credentialed Reviewer', ARRAY['physician_reviewer'], 'md', 'verified', 'synthetic-verification', true),
      ('Reviewer_MixedCase', '00000000-0000-0000-0000-000000000009', 'Synthetic Mixed-Case Reviewer', ARRAY['editorial_reviewer'], 'editorial', 'not_applicable', NULL, true);
    INSERT INTO i1q.evidence_claims (
      id, statement, claim_type, authority_class, status, verified_by_reviewer_id,
      evidence_review_date, review_by_date, content_hash
    ) VALUES
      (
        'claim_synthetic', 'Synthetic fixture claim', 'other', 'physician_attested',
        'verified', 'reviewer_physician', CURRENT_DATE, CURRENT_DATE + 1, repeat('c', 64)
      ),
      (
        'Claim_MixedCase', 'Synthetic mixed-case fixture claim', 'other', 'physician_attested',
        'verified', 'Reviewer_MixedCase', CURRENT_DATE, CURRENT_DATE + 1, repeat('6', 64)
      );
    INSERT INTO i1q.item_revision_claims (
      item_revision_id, evidence_claim_id, claim_role
    ) VALUES
      ('itemrev_synthetic', 'claim_synthetic', 'primary'),
      ('itemrev_synthetic', 'Claim_MixedCase', 'supporting');
    UPDATE i1q.governance_slots
       SET reviewer_id = 'reviewer_editor',
           assigned_by_actor_id = '00000000-0000-0000-0000-000000000001',
           assignment_evidence_hash = repeat('a', 64),
           assigned_at = pg_catalog.clock_timestamp()
     WHERE slot = 'editorial_lead';
    INSERT INTO i1q.reviewer_calibration_records (
      id, reviewer_id, calibration_set_id, agreement_rate, kappa, status,
      calibrated_at, expires_at, content_hash
    ) VALUES (
      'calibration_physician', 'reviewer_physician', 'synthetic-calibration', 1, 1,
      'current', pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp() + interval '1 day', repeat('b', 64)
    );
    INSERT INTO i1q.review_assignments (
      id, item_revision_id, reviewer_id, reviewer_actor_id, review_type, required_role,
      priority, exact_revision_hash, credential_status, credential_verification_id,
      state, assigned_by_actor_id, accepted_at
    ) VALUES
      ('assignment_editor', 'itemrev_synthetic', 'reviewer_editor', '00000000-0000-0000-0000-000000000003', 'editorial', 'editorial_reviewer',
       'P1', repeat('e', 64), 'not_applicable', NULL, 'accepted', '00000000-0000-0000-0000-000000000001', pg_catalog.clock_timestamp()),
      ('assignment_cross', 'itemrev_synthetic', 'reviewer_physician', '00000000-0000-0000-0000-000000000004', 'medical', 'physician_reviewer',
       'P1', repeat('e', 64), 'verified', 'synthetic-verification', 'open', '00000000-0000-0000-0000-000000000001', NULL);

    INSERT INTO i1q.release_snapshots (
      id, release_label, dataset_version, sequence, manifest_hash, manifest,
      claims_currency_checked_at, assembled_by_actor_id
    ) VALUES (
      'release_synthetic', 'Synthetic release', 'synthetic_release_v1', 1,
      repeat('1', 64), pg_catalog.jsonb_build_object('manifest_hash', repeat('1', 64)),
      pg_catalog.clock_timestamp(), '00000000-0000-0000-0000-000000000008'
    );
    INSERT INTO i1q.export_question_identities (
      question_id, item_id, created_by_actor_id
    ) VALUES
      ('Q1', 'item_synthetic', '00000000-0000-0000-0000-000000000008'),
      ('Q2', 'Item_MixedCase', '00000000-0000-0000-0000-000000000008');
    INSERT INTO i1q.release_memberships (
      release_id, position, item_id, item_revision_id, revision_number,
      content_hash, dataset_version, question_id
    ) VALUES
      (
        'release_synthetic', 1, 'item_synthetic', 'itemrev_synthetic', 1,
        repeat('e', 64), 'synthetic_release_v1', 'Q1'
      ),
      (
        'release_synthetic', 2, 'Item_MixedCase', 'ItemRev_MixedCase', 1,
        repeat('6', 64), 'synthetic_release_v1', 'Q2'
      );
    INSERT INTO i1q.psychometric_snapshots (
      id, item_revision_id, release_id, channel, sample_window_start,
      sample_window_end, attempt_count, metrics, content_hash
    ) VALUES
      (
        'psychometric_synthetic', 'itemrev_synthetic', 'release_synthetic', 'stat',
        pg_catalog.clock_timestamp() - interval '2 days',
        pg_catalog.clock_timestamp() - interval '1 day', 0, '{}', repeat('d', 64)
      ),
      (
        'Psychometric_MixedCase', 'itemrev_synthetic', 'release_synthetic', 'drills',
        pg_catalog.clock_timestamp() - interval '2 days',
        pg_catalog.clock_timestamp() - interval '1 day', 0, '{}', repeat('6', 64)
      );
    INSERT INTO i1q.channel_security_policies (
      id, channel, policy_version, field_rules, content_hash, status
    ) VALUES
      (
        'csp_stat_pre_answer', 'stat_pre_answer', 1,
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('field_path', 'dataset_version', 'class_name', 'A', 'channels', pg_catalog.jsonb_build_array('stat_pre_answer'), 'phases', pg_catalog.jsonb_build_array('pre_answer')),
          pg_catalog.jsonb_build_object('field_path', 'question_id', 'class_name', 'A', 'channels', pg_catalog.jsonb_build_array('stat_pre_answer'), 'phases', pg_catalog.jsonb_build_array('pre_answer')),
          pg_catalog.jsonb_build_object('field_path', 'prompt', 'class_name', 'A', 'channels', pg_catalog.jsonb_build_array('stat_pre_answer'), 'phases', pg_catalog.jsonb_build_array('pre_answer')),
          pg_catalog.jsonb_build_object('field_path', 'choices', 'class_name', 'A', 'channels', pg_catalog.jsonb_build_array('stat_pre_answer'), 'phases', pg_catalog.jsonb_build_array('pre_answer'))
        ),
        repeat('2', 64), 'active'
      ),
      (
        'csp_stat_post_answer', 'stat_post_answer_debrief', 1,
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('field_path', 'dataset_version', 'class_name', 'A', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'question_id', 'class_name', 'A', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'answer', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'explanation', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'correct_answer_rationale', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'distractor_rationales', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'distractor_rationales.choice_key', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'distractor_rationales.why_tempting', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer')),
          pg_catalog.jsonb_build_object('field_path', 'distractor_rationales.why_wrong', 'class_name', 'C', 'channels', pg_catalog.jsonb_build_array('stat_post_answer_debrief'), 'phases', pg_catalog.jsonb_build_array('post_answer'))
        ),
        repeat('3', 64), 'active'
      );

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

    CREATE OR REPLACE FUNCTION pg_temp.expect_class_d_value_denied(
      candidate_artifact_id text,
      candidate_value text,
      candidate_field text DEFAULT 'explanation',
      probe_group text DEFAULT 'legacy',
      encoding_depth integer DEFAULT NULL
    )
    RETURNS void
    LANGUAGE plpgsql
    AS $expect$
    DECLARE
      candidate_payload jsonb;
      candidate_prose text;
      denied_state text;
    BEGIN
      candidate_prose := 'Synthetic permitted prose contains ' || candidate_value || ' as an internal token.';
      candidate_payload := pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'dataset_version', 'synthetic_release_v1',
          'question_id', 'Q1',
          'answer', 'A',
          'explanation', 'Synthetic permitted explanation.',
          'correct_answer_rationale', 'Synthetic permitted rationale.',
          'distractor_rationales', pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'choice_key', 'B',
              'why_tempting', 'Synthetic permitted lure.',
              'why_wrong', 'Synthetic permitted correction.'
            )
          )
        )
      );
      candidate_payload := CASE candidate_field
        WHEN 'explanation' THEN pg_catalog.jsonb_set(
          candidate_payload, ARRAY['0', 'explanation'], pg_catalog.to_jsonb(candidate_prose), false
        )
        WHEN 'correct_answer_rationale' THEN pg_catalog.jsonb_set(
          candidate_payload, ARRAY['0', 'correct_answer_rationale'], pg_catalog.to_jsonb(candidate_prose), false
        )
        WHEN 'why_tempting' THEN pg_catalog.jsonb_set(
          candidate_payload, ARRAY['0', 'distractor_rationales', '0', 'why_tempting'], pg_catalog.to_jsonb(candidate_prose), false
        )
        WHEN 'why_wrong' THEN pg_catalog.jsonb_set(
          candidate_payload, ARRAY['0', 'distractor_rationales', '0', 'why_wrong'], pg_catalog.to_jsonb(candidate_prose), false
        )
        ELSE NULL
      END;
      IF candidate_payload IS NULL THEN
        RAISE EXCEPTION 'unsupported_class_c_prose_field:%', candidate_field;
      END IF;
      BEGIN
        PERFORM i1q.create_channel_artifact(
          candidate_artifact_id, 'release_synthetic', 'csp_stat_post_answer',
          'stat_post_answer_debrief', 'post_answer', 'C', 'application/json',
          candidate_payload
        );
      EXCEPTION WHEN insufficient_privilege OR program_limit_exceeded THEN
        GET STACKED DIAGNOSTICS denied_state = RETURNED_SQLSTATE;
        IF EXISTS (
          SELECT 1 FROM i1q.channel_artifacts artifact WHERE artifact.id = candidate_artifact_id
        ) THEN
          RAISE EXCEPTION 'denied_artifact_row_persisted:%', candidate_artifact_id;
        END IF;
        INSERT INTO pg_temp.class_d_denial_probes (
          artifact_id, probe_group, prose_field, encoding_depth, denied_sqlstate
        ) VALUES (
          candidate_artifact_id, probe_group, candidate_field, encoding_depth, denied_state
        );
        RETURN;
      END;
      RAISE EXCEPTION 'expected_class_d_value_denial:%:%', candidate_artifact_id, candidate_value;
    END
    $expect$;

    CREATE TEMP TABLE class_d_denial_probes (
      artifact_id text PRIMARY KEY,
      probe_group text NOT NULL,
      prose_field text NOT NULL,
      encoding_depth integer,
      denied_sqlstate text NOT NULL
    ) ON COMMIT PRESERVE ROWS;

    CREATE OR REPLACE FUNCTION pg_temp.encode_separator(
      candidate_value text,
      encoding_depth integer
    )
    RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
    AS $encode$
    DECLARE
      encoded text;
      encoding_round integer;
    BEGIN
      IF encoding_depth < 1 OR encoding_depth > 9 THEN
        RAISE EXCEPTION 'invalid_test_encoding_depth';
      END IF;
      encoded := pg_catalog.replace(candidate_value, '_', '%5F');
      encoded := pg_catalog.replace(encoded, '-', '%2D');
      IF encoding_depth > 1 THEN
        FOR encoding_round IN 2..encoding_depth LOOP
          encoded := pg_catalog.replace(encoded, '%', '%25');
        END LOOP;
      END IF;
      RETURN encoded;
    END
    $encode$;

    CREATE OR REPLACE FUNCTION pg_temp.encode_ascii(
      candidate_value text,
      encoding_depth integer
    )
    RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
    AS $encode$
    DECLARE
      byte_index integer;
      encoded text := '';
      encoded_bytes bytea;
      encoding_round integer;
    BEGIN
      IF encoding_depth < 1 OR encoding_depth > 9 THEN
        RAISE EXCEPTION 'invalid_test_encoding_depth';
      END IF;
      encoded_bytes := pg_catalog.convert_to(candidate_value, 'UTF8');
      IF pg_catalog.length(encoded_bytes) > 0 THEN
        FOR byte_index IN 0..(pg_catalog.length(encoded_bytes) - 1) LOOP
          encoded := encoded || '%' || pg_catalog.lpad(
            pg_catalog.to_hex(pg_catalog.get_byte(encoded_bytes, byte_index)),
            2,
            '0'
          );
        END LOOP;
      END IF;
      IF encoding_depth > 1 THEN
        FOR encoding_round IN 2..encoding_depth LOOP
          encoded := pg_catalog.replace(encoded, '%', '%25');
        END LOOP;
      END IF;
      RETURN encoded;
    END
    $encode$;

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
    RESET ROLE;
    UPDATE i1q.reviewers SET active = false WHERE id = 'reviewer_editor';
    SET ROLE i1q_test_runtime;
    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000003', false);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'editorial_review')$sql$);
    RESET ROLE;
    UPDATE i1q.reviewers SET active = true WHERE id = 'reviewer_editor';
    SET ROLE i1q_test_runtime;
    SELECT * FROM i1q.record_review_event(
      'event_editor_pass', 'assignment_editor', 'pass', '{}'::jsonb
    );
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.accept_review_assignment('assignment_cross')$sql$);

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000004', false);
    DO $check$ BEGIN
      IF EXISTS (SELECT 1 FROM i1q.review_assignments WHERE id = 'assignment_editor') THEN
        RAISE EXCEPTION 'cross_assignment_visible';
      END IF;
    END $check$;
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'medical_review')$sql$);
    SELECT * FROM i1q.accept_review_assignment('assignment_cross');
    DO $check$ BEGIN
      IF (SELECT count(*) FROM i1q.read_item_revision_answers('itemrev_synthetic', 'medical_review')) <> 1 THEN
        RAISE EXCEPTION 'assigned_physician_answer_scope_failed';
      END IF;
    END $check$;
    SELECT * FROM i1q.record_review_event(
      'event_medical_revision', 'assignment_cross', 'needs_revision', '{}'::jsonb
    );
    DO $check$ BEGIN
      IF i1q.revision_workflow_state('itemrev_synthetic') <> 'editorial_review' THEN
        RAISE EXCEPTION 'medical_revision_request_not_editorial';
      END IF;
    END $check$;

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000003', false);
    SELECT * FROM i1q.create_review_assignment(
      'assignment_editor_second', 'itemrev_synthetic', 'reviewer_editor', 'editorial', 'P1', NULL
    );
    SELECT * FROM i1q.accept_review_assignment('assignment_editor_second');
    SELECT * FROM i1q.record_review_event(
      'event_editor_second_pass', 'assignment_editor_second', 'pass', '{}'::jsonb
    );
    DO $check$ BEGIN
      IF i1q.revision_workflow_state('itemrev_synthetic') <> 'medical_review' THEN
        RAISE EXCEPTION 'second_editorial_pass_not_medical';
      END IF;
    END $check$;

    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000005', false);
    SELECT pg_temp.expect_denied($sql$SELECT * FROM i1q.read_item_revision_answers('itemrev_synthetic', 'release_validation')$sql$);
    SELECT pg_temp.expect_denied($sql$
      SELECT i1q.create_channel_artifact(
        'artifact_wrong_policy', 'release_synthetic', 'csp_stat_pre_answer',
        'drills', 'internal', 'internal', 'application/json', '[]'::jsonb
      )
    $sql$);
    SELECT pg_temp.expect_denied($sql$
      SELECT i1q.create_channel_artifact(
        'artifact_leak', 'release_synthetic', 'csp_stat_pre_answer',
        'stat_pre_answer', 'pre_answer', 'A', 'application/json',
        '[{"dataset_version":"synthetic_release_v1","question_id":"Q1","prompt":"Synthetic?","choices":["A","B","C","D"],"answer":"A"}]'::jsonb
      )
    $sql$);
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_source_leak', 'source_synthetic');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_item_leak', 'item_synthetic');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_revision_leak', 'itemrev_synthetic');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_claim_leak', 'claim_synthetic');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_reviewer_leak', 'reviewer_editor');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_misconception_leak', 'misconception_synthetic');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_psychometric_leak', 'psychometric_synthetic');
    SELECT pg_temp.expect_class_d_value_denied('artifact_class_c_marker_leak', 'source%5Fid');
    SELECT pg_temp.expect_class_d_value_denied(
      'artifact_class_c_mixed_case_base64_leak',
      pg_catalog.encode(pg_catalog.convert_to('Source_MixedCase', 'UTF8'), 'base64')
    );
    SELECT pg_temp.expect_class_d_value_denied(
      'artifact_class_c_mixed_case_base64url_leak',
      pg_catalog.rtrim(
        pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.encode(pg_catalog.convert_to('Source_MixedCase', 'UTF8'), 'base64'),
            '+',
            '-'
          ),
          '/',
          '_'
        ),
        '='
      )
    );
    DO $iterative_probes$
    DECLARE
      candidate_field text;
      encoding_depth integer;
      identifier_family text;
      identifier_value text;
    BEGIN
      FOR identifier_family, identifier_value IN
        SELECT fixture.identifier_family, fixture.identifier_value
          FROM (VALUES
            ('item', 'Item_MixedCase'),
            ('revision', 'ItemRev_MixedCase'),
            ('source', 'Source_MixedCase'),
            ('claim', 'Claim_MixedCase'),
            ('reviewer', 'Reviewer_MixedCase'),
            ('misconception', 'Misconception_MixedCase'),
            ('psychometric', 'Psychometric_MixedCase')
          ) fixture(identifier_family, identifier_value)
      LOOP
        FOREACH candidate_field IN ARRAY ARRAY[
          'explanation', 'correct_answer_rationale', 'why_tempting', 'why_wrong'
        ]::text[] LOOP
          PERFORM pg_temp.expect_class_d_value_denied(
            pg_catalog.format('artifact_mixed_direct_%s_%s', identifier_family, candidate_field),
            identifier_value,
            candidate_field,
            'mixed_case_direct',
            0
          );
          PERFORM pg_temp.expect_class_d_value_denied(
            pg_catalog.format('artifact_mixed_base64_%s_%s', identifier_family, candidate_field),
            pg_catalog.encode(pg_catalog.convert_to(identifier_value, 'UTF8'), 'base64'),
            candidate_field,
            'mixed_case_base64',
            1
          );
          PERFORM pg_temp.expect_class_d_value_denied(
            pg_catalog.format('artifact_mixed_base64url_%s_%s', identifier_family, candidate_field),
            pg_catalog.rtrim(
              pg_catalog.replace(
                pg_catalog.replace(
                  pg_catalog.encode(pg_catalog.convert_to(identifier_value, 'UTF8'), 'base64'),
                  '+', '-'
                ),
                '/', '_'
              ),
              '='
            ),
            candidate_field,
            'mixed_case_base64url',
            1
          );
          FOREACH encoding_depth IN ARRAY ARRAY[2, 3]::integer[] LOOP
            PERFORM pg_temp.expect_class_d_value_denied(
              pg_catalog.format(
                'artifact_iterative_%s_%s_d%s',
                identifier_family,
                candidate_field,
                encoding_depth
              ),
              pg_temp.encode_separator(identifier_value, encoding_depth),
              candidate_field,
              'iterative_identifier',
              encoding_depth
            );
            PERFORM pg_temp.expect_class_d_value_denied(
              pg_catalog.format(
                'artifact_ascii_%s_%s_d%s',
                identifier_family,
                candidate_field,
                encoding_depth
              ),
              pg_temp.encode_ascii(identifier_value, encoding_depth),
              candidate_field,
              'iterative_ascii_identifier',
              encoding_depth
            );
          END LOOP;
        END LOOP;
      END LOOP;

      FOREACH candidate_field IN ARRAY ARRAY[
        'explanation', 'correct_answer_rationale', 'why_tempting', 'why_wrong'
      ]::text[] LOOP
        FOREACH encoding_depth IN ARRAY ARRAY[2, 3]::integer[] LOOP
          PERFORM pg_temp.expect_class_d_value_denied(
            pg_catalog.format('artifact_marker_%s_d%s', candidate_field, encoding_depth),
            pg_temp.encode_separator('source_id', encoding_depth),
            candidate_field,
            'iterative_marker',
            encoding_depth
          );
          PERFORM pg_temp.expect_class_d_value_denied(
            pg_catalog.format('artifact_ascii_marker_%s_d%s', candidate_field, encoding_depth),
            pg_temp.encode_ascii('source_id', encoding_depth),
            candidate_field,
            'iterative_ascii_marker',
            encoding_depth
          );
        END LOOP;
      END LOOP;
    END
    $iterative_probes$;
    SELECT pg_temp.expect_class_d_value_denied(
      'artifact_encoding_depth_limit',
      pg_temp.encode_separator('source_synthetic', 9),
      'explanation',
      'depth_limit',
      9
    );
    SELECT pg_temp.expect_class_d_value_denied(
      'artifact_security_text_size_limit',
      pg_catalog.repeat('x', 65537),
      'explanation',
      'size_limit',
      NULL
    );

    RESET ROLE;
    DO $probe_check$
    BEGIN
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'mixed_case_direct') <> 28 THEN
        RAISE EXCEPTION 'mixed_case_direct_probe_count_invalid';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'mixed_case_base64') <> 28 THEN
        RAISE EXCEPTION 'mixed_case_base64_probe_count_invalid';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'mixed_case_base64url') <> 28 THEN
        RAISE EXCEPTION 'mixed_case_base64url_probe_count_invalid';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'iterative_identifier') <> 56 THEN
        RAISE EXCEPTION 'iterative_identifier_probe_count_invalid';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'iterative_marker') <> 8 THEN
        RAISE EXCEPTION 'iterative_marker_probe_count_invalid';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'iterative_ascii_identifier') <> 56 THEN
        RAISE EXCEPTION 'iterative_ascii_identifier_probe_count_invalid';
      END IF;
      IF (SELECT pg_catalog.count(*) FROM pg_temp.class_d_denial_probes WHERE probe_group = 'iterative_ascii_marker') <> 8 THEN
        RAISE EXCEPTION 'iterative_ascii_marker_probe_count_invalid';
      END IF;
      IF EXISTS (
        SELECT 1 FROM pg_temp.class_d_denial_probes
         WHERE probe_group IN (
           'mixed_case_direct', 'mixed_case_base64', 'mixed_case_base64url',
           'iterative_identifier', 'iterative_marker',
           'iterative_ascii_identifier', 'iterative_ascii_marker'
         )
           AND denied_sqlstate <> '42501'
      ) THEN
        RAISE EXCEPTION 'iterative_probe_sqlstate_invalid';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_temp.class_d_denial_probes
         WHERE probe_group = 'depth_limit' AND encoding_depth = 9 AND denied_sqlstate = '54000'
      ) THEN
        RAISE EXCEPTION 'encoding_depth_limit_not_fail_closed';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_temp.class_d_denial_probes
         WHERE probe_group = 'size_limit' AND denied_sqlstate = '54000'
      ) THEN
        RAISE EXCEPTION 'security_text_size_limit_not_fail_closed';
      END IF;
      IF EXISTS (
        SELECT 1
          FROM i1q.channel_artifacts artifact
          JOIN pg_temp.class_d_denial_probes probe ON probe.artifact_id = artifact.id
      ) THEN
        RAISE EXCEPTION 'denied_channel_artifact_row_persisted';
      END IF;
      IF EXISTS (
        SELECT 1
          FROM i1q.channel_artifact_payloads payload
          JOIN pg_temp.class_d_denial_probes probe ON probe.artifact_id = payload.artifact_id
      ) THEN
        RAISE EXCEPTION 'denied_channel_payload_row_persisted';
      END IF;
    END
    $probe_check$;
    SET ROLE i1q_test_runtime;
    SELECT pg_catalog.set_config('i1q_test.actor_id', '00000000-0000-0000-0000-000000000005', false);
    SELECT i1q.create_channel_artifact(
      'artifact_safe', 'release_synthetic', 'csp_stat_pre_answer',
      'stat_pre_answer', 'pre_answer', 'A', 'application/json',
      '${safeArtifactSql}'::jsonb
    );
    SELECT i1q.create_channel_artifact(
      'artifact_class_c_clean', 'release_synthetic', 'csp_stat_post_answer',
      'stat_post_answer_debrief', 'post_answer', 'C', 'application/json',
      '${cleanClassCArtifactSql}'::jsonb
    );
    SELECT pg_temp.expect_denied($sql$
      SELECT i1q.record_export_validation(
        'validation_invented', 'release_synthetic', repeat('3', 64), ARRAY['CALLER-PASS']::text[]
      )
    $sql$);
    SELECT pg_temp.expect_denied($sql$
      SELECT i1q.record_export_validation(
        'validation_wrong_hash', 'release_synthetic', repeat('3', 64),
        ARRAY['LT-1','LT-2','LT-3','LT-4','LT-5','LT-6']::text[]
      )
    $sql$);
    SELECT i1q.record_export_validation(
      'validation_synthetic',
      'release_synthetic',
      i1q.release_validation_evidence_hash('release_synthetic'),
      ARRAY['LT-1','LT-2','LT-3','LT-4','LT-5','LT-6']::text[]
    );
    DO $check$ BEGIN
      IF (SELECT pg_catalog.jsonb_array_length(artifact_results)
            FROM i1q.export_validation_results
           WHERE id = 'validation_synthetic') <> 2 THEN
        RAISE EXCEPTION 'artifact_validation_results_missing';
      END IF;
    END $check$;

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

  const validationVector = JSON.parse(runPsql(['--tuples-only', '--no-align'], `
    SELECT pg_catalog.jsonb_build_object(
      'release_id', release.id,
      'manifest_hash', release.manifest_hash,
      'artifacts', pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'channel', artifact.channel,
          'phase', artifact.phase,
          'data_class', artifact.data_class,
          'artifact_hash', artifact.artifact_hash,
          'record_count', artifact.record_count
        ) ORDER BY artifact.channel
      ),
      'evidence_hash', i1q.release_validation_evidence_hash(release.id)
    )::text
      FROM i1q.channel_artifacts artifact
      JOIN i1q.release_snapshots release ON release.id = artifact.release_id
     WHERE artifact.id IN ('artifact_safe', 'artifact_class_c_clean')
     GROUP BY release.id, release.manifest_hash;
  `).trim());
  const nodeEvidenceHash = releaseValidationEvidenceHash({
    releaseId: validationVector.release_id,
    manifestHash: validationVector.manifest_hash,
    artifacts: validationVector.artifacts,
    checks: REQUIRED_RELEASE_VALIDATION_CHECK_IDS.map((id) => ({ id, status: 'pass' })),
  });
  assert.equal(
    validationVector.artifacts.find((artifact) => artifact.channel === 'stat_pre_answer')?.artifact_hash,
    sha256(safeArtifactPayload),
  );
  assert.equal(
    validationVector.artifacts.find((artifact) => artifact.channel === 'stat_post_answer_debrief')?.artifact_hash,
    sha256(cleanClassCArtifactPayload),
  );
  assert.equal(nodeEvidenceHash, validationVector.evidence_hash);

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
