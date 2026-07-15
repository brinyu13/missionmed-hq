import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../db/migrations/20260715122434_i1q_1007x_question_platform.sql', import.meta.url);
const rollbackPath = new URL('../db/rollback/20260715122435_i1q_1007x_compensating_disable.sql', import.meta.url);
const historicalPath = new URL('../db/migrations/0001_i1q_question_platform.sql', import.meta.url);

const [migration, rollback, historical] = await Promise.all([
  readFile(migrationPath, 'utf8'),
  readFile(rollbackPath, 'utf8'),
  readFile(historicalPath, 'utf8'),
]);

function stripLineComments(sql) {
  return sql.replace(/^\s*--.*$/gmu, '');
}

function taggedBlock(sql, tag) {
  const marker = `$${tag}$`;
  const start = sql.indexOf(`DO ${marker}`);
  const end = sql.indexOf(`${marker};`, start + marker.length);
  assert.notEqual(start, -1, `missing ${tag} block`);
  assert.notEqual(end, -1, `unterminated ${tag} block`);
  return sql.slice(start, end + marker.length + 1);
}

function functionBlock(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION i1q.${name}`);
  const end = sql.indexOf('$function$;', start);
  assert.notEqual(start, -1, `missing function ${name}`);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return sql.slice(start, end + '$function$;'.length);
}

function tableBlock(sql, name) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS i1q.${name} (`);
  const end = sql.indexOf('\n);', start);
  assert.notEqual(start, -1, `missing table ${name}`);
  assert.notEqual(end, -1, `unterminated table ${name}`);
  return sql.slice(start, end + 3);
}

function quotedArray(block, variableName) {
  const expression = new RegExp(`${variableName}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\];`, 'u');
  const match = block.match(expression);
  assert.ok(match, `missing array ${variableName}`);
  return [...match[1].matchAll(/'([a-z_]+)'/gu)].map((entry) => entry[1]);
}

function sorted(values) {
  return [...values].sort();
}

test('1007X migration is a standalone, transaction-wrapped, versioned candidate', () => {
  assert.match(migration, /^-- Migration: 20260715122434_i1q_1007x_question_platform\.sql/mu);
  assert.match(migration, /\nBEGIN;[\s\S]*\nCOMMIT;\s*$/u);
  assert.match(migration, /i1q_unversioned_schema_requires_authoritative_reconciliation/u);
  assert.match(migration, /pg_catalog\.to_regclass\('i1q\.schema_versions'\) IS NULL/u);
  assert.match(migration, /VALUES \('20260715122434', '20260715122434_i1q_1007x_question_platform\.sql'/u);
  assert.match(migration, /ON CONFLICT \(version\) DO NOTHING/u);
  assert.doesNotMatch(stripLineComments(migration), /\b(?:DROP|TRUNCATE)\b/iu);
});

test('every created table is covered by both enabled and forced RLS', () => {
  const createdTables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS i1q\.([a-z_]+)\s*\(/gu)]
    .map((match) => match[1]);
  const rlsBlock = taggedBlock(migration, 'rls_enable');
  const rlsTables = quotedArray(rlsBlock, 'all_tables');

  assert.equal(createdTables.length, 52);
  assert.equal(new Set(createdTables).size, createdTables.length);
  assert.deepEqual(sorted(rlsTables), sorted(createdTables));
  assert.match(rlsBlock, /ALTER TABLE i1q\.%I ENABLE ROW LEVEL SECURITY/u);
  assert.match(rlsBlock, /ALTER TABLE i1q\.%I FORCE ROW LEVEL SECURITY/u);
});

test('runtime grants fail closed for PUBLIC and built-in client roles', () => {
  const executableSql = stripLineComments(migration);
  assert.doesNotMatch(executableSql, /\bGRANT\b/iu);
  assert.match(executableSql, /REVOKE ALL ON SCHEMA i1q FROM PUBLIC/u);
  assert.match(executableSql, /REVOKE ALL ON ALL TABLES IN SCHEMA i1q FROM PUBLIC/u);
  assert.match(executableSql, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA i1q FROM PUBLIC/u);
  assert.match(executableSql, /ALTER DEFAULT PRIVILEGES IN SCHEMA i1q REVOKE ALL ON TABLES FROM PUBLIC/u);
  assert.match(executableSql, /ALTER DEFAULT PRIVILEGES IN SCHEMA i1q REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/u);

  const revokeBlock = taggedBlock(migration, 'revoke_builtin_roles');
  assert.match(revokeBlock, /ARRAY\['anon', 'authenticated'\]::text\[\]/u);
  assert.match(revokeBlock, /REVOKE ALL ON ALL TABLES IN SCHEMA i1q FROM %I/u);
  assert.match(revokeBlock, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA i1q FROM %I/u);
});

test('authorization derives actor identity from auth.uid and database memberships', () => {
  const executableSql = stripLineComments(migration);
  const actorFunction = functionBlock(migration, 'current_actor_id()');
  const roleFunction = functionBlock(migration, 'has_active_role(required_role text)');

  assert.match(migration, /pg_catalog\.to_regprocedure\('auth\.uid\(\)'\) IS NULL/u);
  assert.match(actorFunction, /SECURITY INVOKER/u);
  assert.match(actorFunction, /SELECT auth\.uid\(\)/u);
  assert.match(roleFunction, /FROM i1q\.actor_role_memberships membership/u);
  assert.match(roleFunction, /membership\.actor_id = i1q\.current_actor_id\(\)/u);
  assert.match(roleFunction, /membership\.revoked_at IS NULL/u);
  assert.match(roleFunction, /membership\.valid_from <= pg_catalog\.clock_timestamp\(\)/u);
  assert.doesNotMatch(executableSql, /current_setting\s*\(/iu);
  assert.doesNotMatch(executableSql, /set_config\s*\(/iu);
  assert.doesNotMatch(executableSql, /app\.actor_(?:id|roles)/iu);
});

test('historical caller-asserted role GUC semantics are not carried into 1007X', () => {
  assert.match(historical, /current_setting\('app\.actor_id'/u);
  assert.match(historical, /current_setting\('app\.actor_roles'/u);
  assert.doesNotMatch(migration, /current_setting\('app\.actor_/u);
  assert.match(migration, /does not apply or modify 0001_i1q_question_platform\.sql/u);
});

test('all six initial feature flags are explicitly seeded off', () => {
  const expectedKeys = [
    'drills_adapter_enabled',
    'internal_platform_enabled',
    'internal_review_enabled',
    'stat_adapter_enabled',
    'student_content_enabled',
    'student_release_enabled',
  ];
  const seedBlock = migration.slice(
    migration.indexOf('INSERT INTO i1q.feature_flags'),
    migration.indexOf('ON CONFLICT (key) DO NOTHING') + 'ON CONFLICT (key) DO NOTHING'.length,
  );
  const rows = [...seedBlock.matchAll(/\('flag_[a-z_]+', '([a-z_]+)', false, 'migration:I1Q-1007X'\)/gu)]
    .map((match) => match[1]);

  assert.deepEqual(sorted(rows), expectedKeys);
  assert.doesNotMatch(seedBlock, /, true,/u);
  assert.match(seedBlock, /ON CONFLICT \(key\) DO NOTHING/u);
});

test('student publication requires ratification and both student flags', () => {
  const promoteRelease = functionBlock(migration, 'promote_release(');
  assert.match(promoteRelease, /target_state = 'published'/u);
  assert.match(promoteRelease, /target_authority_type <> 'brian_publication_ratification'/u);
  assert.match(promoteRelease, /authority\.authority_code = 'brian_publication_ratifier'/u);
  assert.match(promoteRelease, /authority\.actor_id = i1q\.current_actor_id\(\)/u);
  assert.match(promoteRelease, /flag\.key IN \('student_content_enabled', 'student_release_enabled'\)[\s\S]*flag\.enabled/u);
  assert.match(promoteRelease, /pg_catalog\.jsonb_array_length\(promotion_evidence_hashes\) = 0/u);
  assert.match(promoteRelease, /evidence_hash #>> '\{\}' !~ '\^\[0-9a-f\]\{64\}\$'/u);
  assert.match(promoteRelease, /student_publication_not_authorized/u);
});

test('item revisions are answer free and answer material is isolated', () => {
  const revisions = tableBlock(migration, 'item_revisions');
  const answers = tableBlock(migration, 'item_revision_answers');
  assert.doesNotMatch(revisions, /^\s+(?:answer|explanation|correct_answer_rationale|distractor_rationales|teaching_point)\s/mu);
  for (const field of ['answer', 'explanation', 'correct_answer_rationale', 'distractor_rationales', 'teaching_point']) {
    assert.match(answers, new RegExp(`^\\s+${field}\\s`, 'mu'));
  }
  assert.doesNotMatch(migration, /CREATE POLICY\s+[a-z_]+\s+ON i1q\.item_revision_answers\b/iu);

  const answerReader = functionBlock(migration, 'read_item_revision_answers(');
  assert.match(answerReader, /access_purpose = 'authoring'/u);
  assert.match(answerReader, /access_purpose = 'editorial_review'/u);
  assert.match(answerReader, /access_purpose = 'medical_review'/u);
  assert.match(answerReader, /access_purpose = 'release_validation'/u);
  assert.match(answerReader, /access_purpose = 'system_validation'/u);
  assert.match(answerReader, /answer_access_denied/u);
  assert.match(answerReader, /'answer_accessed'/u);
});

test('restricted source references have no direct read policy', () => {
  assert.doesNotMatch(migration, /CREATE POLICY\s+[a-z_]+\s+ON i1q\.restricted_source_references\b/iu);
  const sourceReader = functionBlock(migration, 'read_restricted_source_reference(');
  assert.match(sourceReader, /ARRAY\['privacy_officer', 'system'\]::text\[\]/u);
  assert.match(sourceReader, /access_purpose NOT IN \('privacy_review', 'redaction', 'incident_response'\)/u);
  assert.match(sourceReader, /restricted_source_access_denied/u);
  assert.match(sourceReader, /'restricted_source_accessed'/u);
});

test('history is immutable while draft revisions use guarded mutation', () => {
  const triggerBlock = taggedBlock(migration, 'triggers');
  const immutableTables = quotedArray(triggerBlock, 'immutable_tables');
  const required = [
    'audit_events',
    'channel_artifact_payloads',
    'channel_artifacts',
    'export_question_identities',
    'export_validation_results',
    'item_revision_claims',
    'item_revision_concepts',
    'item_revision_misconceptions',
    'item_revision_sources',
    'source_records',
    'privacy_redaction_records',
    'extraction_runs',
    'compensation_records',
    'psychometric_snapshots',
    'release_memberships',
    'release_promotion_records',
    'release_snapshots',
    'restricted_source_references',
    'review_events',
    'reviewer_calibration_records',
    'schema_versions',
  ];

  assert.deepEqual(sorted(immutableTables), sorted(required));
  assert.match(triggerBlock, /BEFORE UPDATE OR DELETE ON i1q\.%I/u);
  assert.match(triggerBlock, /review_assignments_no_delete/u);
  assert.match(triggerBlock, /review_assignments_transition/u);
  assert.match(triggerBlock, /item_revisions_guarded_mutation/u);
  assert.match(triggerBlock, /item_revision_answers_guarded_mutation/u);
  const revisionGuard = functionBlock(migration, 'enforce_item_revision_mutation(');
  assert.match(revisionGuard, /OLD\.workflow_status = 'draft'[\s\S]*NEW\.workflow_status = 'candidate'/u);
  assert.match(revisionGuard, /NEW\.workflow_status IN \('superseded', 'retired'\)/u);
});

test('release assembly binds exact immutable revision and evidence state', () => {
  const assembleRelease = functionBlock(migration, 'assemble_release(');
  assert.match(assembleRelease, /i1q\.revision_workflow_state\(revision\.id\) <> 'approved'/u);
  assert.match(assembleRelease, /event\.exact_revision_hash = revision\.content_hash/u);
  assert.match(assembleRelease, /event\.credential_status = 'verified'/u);
  assert.match(assembleRelease, /claim\.status = 'verified'/u);
  assert.match(assembleRelease, /rights\.rights_status <> 'cleared_for'/u);
  assert.match(assembleRelease, /rights\.expires_at IS NOT NULL[\s\S]*rights\.expires_at <= pg_catalog\.clock_timestamp/u);
  assert.match(assembleRelease, /privacy\.status NOT IN \('pass', 'pass_with_redactions'\)/u);
  assert.match(assembleRelease, /identity\.question_id = stable_question_id/u);
  assert.match(assembleRelease, /identity\.item_id = revision\.item_id/u);
});

test('release validation requires the official checks and artifact-bound evidence', () => {
  const recordValidation = functionBlock(migration, 'record_export_validation(');
  const evidenceHash = functionBlock(migration, 'release_validation_evidence_hash(');
  const canonicalJson = functionBlock(migration, 'canonical_json(');
  for (const checkId of ['LT-1', 'LT-2', 'LT-3', 'LT-4', 'LT-5', 'LT-6']) {
    assert.match(recordValidation, new RegExp(`'${checkId}'`, 'u'));
  }
  assert.match(recordValidation, /normalized_check_ids <> required_check_ids/u);
  assert.match(recordValidation, /validation_evidence_hash <> expected_evidence_hash/u);
  assert.match(recordValidation, /artifact_results/u);
  assert.match(evidenceHash, /artifact\.artifact_hash/u);
  assert.match(evidenceHash, /release\.manifest_hash/u);
  assert.match(evidenceHash, /i1q\.release-validation\.v1/u);
  assert.match(canonicalJson, /pg_catalog\.normalize/u);
});

test('medical revision requests can return to a fresh editorial assignment', () => {
  const createAssignment = functionBlock(migration, 'create_review_assignment(');
  const acceptAssignment = functionBlock(migration, 'accept_review_assignment(');
  assert.match(createAssignment, /target_review_type = 'editorial'[\s\S]*NOT IN \('candidate', 'editorial_review'\)/u);
  assert.match(acceptAssignment, /assignment\.review_type = 'editorial'[\s\S]*NOT IN \('candidate', 'editorial_review'\)/u);
});

test('channel artifacts bind policy, phase, class, and pre-answer fields', () => {
  const createArtifact = functionBlock(migration, 'create_channel_artifact(');
  const identifierValues = functionBlock(migration, 'release_class_d_identifier_values(');
  const stringValues = functionBlock(migration, 'jsonb_string_values(');
  const markerCheck = functionBlock(migration, 'is_class_d_field_marker(');
  assert.match(createArtifact, /policy\.channel <> target_channel/u);
  assert.match(createArtifact, /contract_valid/u);
  assert.match(createArtifact, /i1q\.jsonb_field_paths\(artifact_payload\)/u);
  assert.match(createArtifact, /channel_artifact_policy_field_denied/u);
  assert.match(createArtifact, /channel_artifact_pre_answer_leak/u);
  assert.match(createArtifact, /target_data_class IN \('A', 'C'\)/u);
  assert.match(createArtifact, /channel_artifact_class_d_scan_unavailable/u);
  assert.match(createArtifact, /i1q\.jsonb_field_names\(artifact_payload\)/u);
  assert.match(createArtifact, /i1q\.jsonb_string_values\(artifact_payload\)/u);
  assert.match(createArtifact, /identifier\.identifier_value = scalar\.string_value/u);
  assert.match(createArtifact, /channel_artifact_class_d_field_marker/u);
  assert.match(createArtifact, /channel_artifact_class_d_value_leak/u);
  for (const relation of [
    'release_memberships',
    'item_revision_sources',
    'item_revision_claims',
    'review_assignments',
    'review_events',
    'item_revision_misconceptions',
    'psychometric_snapshots',
  ]) {
    assert.match(identifierValues, new RegExp(`i1q\\.${relation}`, 'u'));
  }
  assert.match(identifierValues, /'item'/u);
  assert.match(identifierValues, /'revision'/u);
  assert.match(identifierValues, /'source'/u);
  assert.match(identifierValues, /'claim'/u);
  assert.match(identifierValues, /'reviewer'/u);
  assert.match(identifierValues, /'misconception'/u);
  assert.match(identifierValues, /'psychometric'/u);
  assert.match(stringValues, /pg_catalog\.jsonb_typeof\(walk\.value\) = 'string'/u);
  assert.match(markerCheck, /i1q\.normalize_security_marker\(candidate\)/u);
  assert.match(markerCheck, /'sourceid'/u);
  assert.match(markerCheck, /'psychometricsnapshotid'/u);
});

test('compensating rollback is forward-only, preserving, and reapply-safe', () => {
  const executableRollback = stripLineComments(rollback);
  assert.match(executableRollback, /^\s*BEGIN;[\s\S]*COMMIT;\s*$/u);
  assert.match(executableRollback, /SELECT i1q\.disable_i1q_behavior\(\s*'20260715122435'/u);
  assert.doesNotMatch(executableRollback, /\b(?:DROP|TRUNCATE|DELETE|ALTER|UPDATE|INSERT)\b/iu);

  const disableFunction = functionBlock(migration, 'disable_i1q_behavior(');
  assert.match(disableFunction, /UPDATE i1q\.feature_flags[\s\S]*SET enabled = false[\s\S]*WHERE enabled/u);
  assert.match(disableFunction, /pg_advisory_xact_lock/u);
  assert.match(disableFunction, /FROM i1q\.compensation_records record/u);
  assert.match(disableFunction, /compensation_operator_context_required/u);
  assert.match(disableFunction, /'data_preserved', true/u);
  assert.match(disableFunction, /'history_preserved', true/u);
  assert.doesNotMatch(disableFunction, /\b(?:DROP|TRUNCATE|DELETE)\b/iu);
});

test('reapply guards cover tables, policies, triggers, and initialization rows', () => {
  const createTableStatements = [...migration.matchAll(/CREATE TABLE[^;]+;/gsu)].map((match) => match[0]);
  assert.equal(createTableStatements.length, 52);
  for (const statement of createTableStatements) {
    assert.match(statement, /^CREATE TABLE IF NOT EXISTS i1q\./u);
  }
  assert.match(migration, /IF NOT EXISTS \(SELECT 1 FROM pg_catalog\.pg_policies/u);
  assert.match(migration, /IF NOT EXISTS \([\s\S]*FROM pg_catalog\.pg_trigger/u);
  assert.match(migration, /ON CONFLICT \(slot\) DO NOTHING/u);
  assert.match(migration, /ON CONFLICT \(authority_code\) DO NOTHING/u);
  assert.match(migration, /event\.action = 'schema_candidate_initialized'[\s\S]*event\.entity_id = '20260715122434'/u);
});
