import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const paths = {
  local: new URL('../../scripts/lor-studio/migrations/20260825011000_f2_lor_1012_student_evidence_commands.sql', import.meta.url),
  production: new URL('../../scripts/lor-studio/migrations/20260825011100_f2_lor_1012_production_student_evidence_commands.sql', import.meta.url),
  localRollback: new URL('../../scripts/lor-studio/rollbacks/20260825011000_f2_lor_1012_student_evidence_commands.rollback.sql', import.meta.url),
  productionRollback: new URL('../../scripts/lor-studio/rollbacks/20260825011100_f2_lor_1012_production_student_evidence_commands.rollback.sql', import.meta.url),
};
const local = readFileSync(paths.local, 'utf8');
const production = readFileSync(paths.production, 'utf8');
const localRollback = readFileSync(paths.localRollback, 'utf8');
const productionRollback = readFileSync(paths.productionRollback, 'utf8');
const migrations = [local, production];
const rollbacks = [localRollback, productionRollback];

function functionBody(sql, tag) {
  const start = sql.indexOf(`AS $${tag}$`);
  const end = sql.indexOf(`$${tag}$;`, start + tag.length + 5);
  assert.notEqual(start, -1, `missing ${tag} start`);
  assert.notEqual(end, -1, `missing ${tag} end`);
  return sql.slice(start, end);
}

function assertBalancedDollarQuotes(sql) {
  const counts = new Map();
  for (const match of sql.matchAll(/\$[a-z_]*\$/gu)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  for (const [tag, count] of counts) assert.equal(count % 2, 0, tag);
}

test('110/111 are fenced transactional successors with exact predecessor counts and deltas', () => {
  for (const migration of migrations) {
    assert.match(migration, /^-- Migration: 20260825011[01]00/u);
    assert.match(migration, /\nBEGIN;\n/u);
    assert.match(migration, /\nCOMMIT;\s*$/u);
    assert.match(migration, /IN ACCESS EXCLUSIVE MODE;/u);
    assert.match(migration, /evidence_migration_preflight_counts/u);
    assert.match(migration, /relation_count IS DISTINCT FROM 32/u);
    assert.match(migration, /forced_rls_count IS DISTINCT FROM 32/u);
    assert.match(migration, /definer_count IS DISTINCT FROM 26/u);
    assert.match(migration, /relation_count IS DISTINCT FROM predecessor_relation_count \+ 1/u);
    assert.match(migration, /definer_count IS DISTINCT FROM predecessor_definer_count \+ 2/u);
    assert.match(migration, /ai_proposal_command_receipts/u);
    assertBalancedDollarQuotes(migration);
  }
  assert.match(local, /exact AI-successor disposable harness identity/u);
  assert.match(local, /aiProposalCommands=20260825010800/u);
  assert.match(production, /target_provider IS DISTINCT FROM 'railway-postgres'/u);
  assert.match(production, /target_project_id IS DISTINCT FROM '29afe885-b9b1-425d-8fd8-8611cd275409'/u);
  assert.match(production, /pg_catalog\.current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
  assert.match(production, /aiProposalCommands=20260825010900/u);
});

test('the only new app command ABI has no content, IDs, consent, provenance, support, or visibility arguments', () => {
  for (const migration of migrations) {
    assert.match(
      migration,
      /CREATE FUNCTION lor_studio\.commit_student_evidence_publication\(\s*candidate_expected_revision bigint,\s*candidate_idempotency_key text,\s*candidate_request_hash text,\s*candidate_event jsonb,\s*candidate_event_hash text\s*\)\s+RETURNS jsonb[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/u,
    );
    assert.match(
      migration,
      /GRANT EXECUTE ON FUNCTION lor_studio\.commit_student_evidence_publication\(\s*bigint, text, text, jsonb, text\s*\) TO lor_studio_app/u,
    );
    assert.doesNotMatch(
      migration.match(/CREATE FUNCTION lor_studio\.commit_student_evidence_publication\([\s\S]*?\)\s+RETURNS jsonb/u)[0],
      /(?:content|evidence_id|consent_receipt|provenance|support|visibility)/iu,
    );
  }
});

test('publication derives canonical evidence, direct-identifier redaction, latest consent, hashes, audit, and protected chain in SQL', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'publish_evidence');
    assert.match(body, /current_case\.record -> 'builder' -> 'stepData'/u);
    for (const field of [
      'priorityEvidence', 'evidenceSummary', 'standoutMoment', 'timelineSummary',
    ]) assert.match(body, new RegExp(`'${field}'`, 'u'));
    assert.match(body, /consent_and_waiver' -> 'understanding'/u);
    const latestConsentSelection = body.match(
      /SELECT receipt\.\* INTO consent_receipt[\s\S]*?LIMIT 1;/u,
    )?.[0];
    assert.ok(latestConsentSelection, 'latest consent selection');
    assert.match(
      latestConsentSelection,
      /receipt\.case_revision <= candidate_expected_revision[\s\S]*?ORDER BY receipt\.case_revision DESC, receipt\.recorded_at DESC, receipt\.receipt_id DESC/u,
    );
    assert.doesNotMatch(latestConsentSelection, /receipt\.scopes/u);
    assert.match(
      body,
      /IF NOT FOUND OR NOT \(\s*consent_receipt\.policy_version = 'dr-133-identified-education-record-v1'\s*AND consent_receipt\.scopes @> ARRAY\['ai_drafting', 'evidence_grounding'\]::text\[\]\s*AND NOT \('consent_withdrawn' = ANY \(consent_receipt\.scopes\)\)/u,
    );
    assert.match(body, /\[redacted-email\]/u);
    assert.match(body, /\[redacted-url\]/u);
    assert.match(body, /\[redacted-phone\]/u);
    assert.match(body, /\[redacted-identifier\]/u);
    assert.match(body, /missionmed\.lor\.direct-identifier-redaction\.v1/u);
    assert.doesNotMatch(body, /missionmed\.lor\.evidence-deidentify\.v1/u);
    assert.match(body, /evidence_id := 'evidence_' \|\| lor_studio\.canonical_jsonb_sha256/u);
    assert.match(body, /sourceRecordHash/u);
    assert.match(body, /sourceProtectedStateHash/u);
    assert.match(body, /consentReceiptHash/u);
    assert.match(body, /INSERT INTO lor_studio\.student_evidence_records/u);
    assert.match(body, /INSERT INTO lor_studio\.recommendation_case_audit_events/u);
    assert.match(body, /INSERT INTO lor_studio\.recommendation_case_protected_revision_states/u);
    assert.match(body, /lor_studio\.protected_state_chain_hash/u);
    assert.match(body, /'student\.evidence\.publish'/u);
    assert.match(body, /'student\.material_updated'/u);
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/u);
    assert.match(body, /FOR UPDATE/u);
  }
});

test('canonical evidence custody is append-only, FORCE-RLS, and contains no raw student identity columns', () => {
  for (const migration of migrations) {
    const table = migration.slice(
      migration.indexOf('CREATE TABLE lor_studio.student_evidence_records'),
      migration.indexOf('CREATE INDEX student_evidence_records_case_revision_idx'),
    );
    assert.match(table, /evidence_record jsonb NOT NULL/u);
    assert.match(table, /provenance jsonb NOT NULL/u);
    assert.match(table, /content_hash text NOT NULL/u);
    assert.match(table, /consent_receipt_id text NOT NULL/u);
    assert.doesNotMatch(table, /student_auth_subject|student_auth_uid|faculty_visibility/u);
    assert.match(migration, /ALTER TABLE lor_studio\.student_evidence_records FORCE ROW LEVEL SECURITY/u);
    assert.match(migration, /student_evidence_records_append_only/u);
    assert.match(migration, /REVOKE ALL ON TABLE lor_studio\.student_evidence_records FROM lor_studio_app/u);
    assert.doesNotMatch(migration, /GRANT\s+(?:UPDATE|DELETE|TRUNCATE)[\s\S]{0,100}student_evidence_records/iu);
  }
});

test('faculty drafting DTO reads only DB-validated evidence under the latest consent receipt', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'read_drafting_context');
    const latestConsentSelection = body.match(
      /SELECT receipt\.\* INTO latest_consent_receipt[\s\S]*?LIMIT 1;/u,
    )?.[0];
    assert.ok(latestConsentSelection, 'latest faculty consent selection');
    assert.match(latestConsentSelection, /receipt\.case_revision <= recommendation_case\.revision/u);
    assert.match(
      latestConsentSelection,
      /ORDER BY receipt\.case_revision DESC, receipt\.recorded_at DESC, receipt\.receipt_id DESC/u,
    );
    assert.doesNotMatch(latestConsentSelection, /receipt\.scopes/u);
    assert.match(
      body,
      /IF NOT FOUND OR NOT \(\s*latest_consent_receipt\.policy_version = 'dr-133-identified-education-record-v1'\s*AND latest_consent_receipt\.scopes @> ARRAY\['ai_drafting', 'evidence_grounding'\]::text\[\]\s*AND NOT \('consent_withdrawn' = ANY \(latest_consent_receipt\.scopes\)\)/u,
    );
    assert.match(body, /JOIN lor_studio\.student_evidence_records AS evidence/u);
    assert.match(body, /evidence\.evidence_record IS NOT DISTINCT FROM expected\.value/u);
    assert.match(body, /student_evidence_record_is_complete/u);
    assert.match(body, /expected_evidence_count IS DISTINCT FROM approved_evidence_count/u);
    assert.match(body, /receipt\.receipt_hash = evidence\.consent_receipt_hash/u);
    assert.match(body, /pg_catalog\.jsonb_build_object\(\s*'id', latest_consent_receipt\.receipt_id/u);
    assert.doesNotMatch(body, /referenced_consents/u);
    assert.match(body, /missionmed\.lor\.faculty-drafting-context\.v1/u);
    for (const field of [
      'schemaVersion', 'id', 'studentId', 'status', 'faculty',
      'consentReceipts', 'studentEvidence',
    ]) assert.match(body, new RegExp(`'${field}'`, 'u'));
    assert.doesNotMatch(body, /RETURN\s+recommendation_case/iu);
  }
});

test('110/111 command-function semantics are exact twins', () => {
  for (const tag of [
    'evidence_complete', 'student_safe_state', 'publish_evidence', 'read_drafting_context',
  ]) assert.equal(functionBody(local, tag), functionBody(production, tag), tag);
});

test('rollbacks preserve live custody, restore the exact predecessor function object, and use explicit reverse operations', () => {
  for (const rollback of rollbacks) {
    assert.doesNotMatch(rollback, /\bCASCADE\b/iu);
    assert.doesNotMatch(rollback, /\bDELETE\s+FROM\b/iu);
    assert.doesNotMatch(rollback, /\bTRUNCATE\b/iu);
    assert.match(rollback, /EXISTS \(SELECT 1 FROM lor_studio\.student_evidence_records\)/u);
    assert.match(rollback, /command_type = 'student\.evidence\.publish'/u);
    assert.match(rollback, /rollback refuses to remove live evidence custody/u);
    assert.match(rollback, /relation_count IS DISTINCT FROM 33/u);
    assert.match(rollback, /forced_rls_count IS DISTINCT FROM 33/u);
    assert.match(rollback, /definer_count IS DISTINCT FROM 28/u);
    assert.match(rollback, /DROP FUNCTION lor_studio\.read_faculty_drafting_context\(\)/u);
    assert.match(rollback, /RENAME TO read_faculty_drafting_context/u);
    assert.match(rollback, /OWNER TO lor_studio_command_owner/u);
    assert.match(rollback, /DROP POLICY student_evidence_records_student_command_insert/u);
    assert.match(rollback, /DROP TRIGGER student_evidence_records_append_only/u);
    assert.match(rollback, /DROP TABLE lor_studio\.student_evidence_records;/u);
    assert.match(rollback, /predecessor_relation_count - 1/u);
    assert.match(rollback, /predecessor_definer_count - 2/u);
    for (const fingerprint of [
      'table_fingerprint', 'function_fingerprint', 'policy_fingerprint',
      'trigger_fingerprint', 'receipt_constraint_fingerprint',
      'grant_fingerprint', 'dependency_fingerprint', 'metadata_fingerprint',
    ]) assert.match(rollback, new RegExp(`${fingerprint} IS DISTINCT FROM`, 'u'));
    for (const catalogSurface of [
      'attribute.attacl',
      'pg_catalog.pg_description',
      'pg_catalog.pg_seclabel',
      "'internal', trigger_row.tgisinternal",
      "'clustered', index_row.indisclustered",
      "'replicaIdentity', index_row.indisreplident",
      "'exclusion', index_row.indisexclusion",
      "'immediate', index_row.indimmediate",
      "'checkXmin', index_row.indcheckxmin",
      "'nullsNotDistinct', index_row.indnullsnotdistinct",
      "'accessMethod', access_method.amname",
      "'tablespace', tablespace.spcname",
      "'options', pg_catalog.to_jsonb(index_class.reloptions)",
    ]) assert.ok(rollback.includes(catalogSurface), catalogSurface);
    assert.match(rollback, /pg_catalog\.pg_depend AS dependency/u);
    assert.match(rollback, /successor_sentinel IS DISTINCT FROM expected_successor_sentinel/u);
  }
  assert.match(localRollback, /missionmed\.lor\.disposable-postgres-harness\.v1[\s\S]*?studentEvidenceCommands=20260825011000/u);
  assert.doesNotMatch(localRollback, /missionmed\.lor\.railway-postgres-target\.v1/u);
  assert.match(productionRollback, /missionmed\.lor\.railway-postgres-target\.v1[\s\S]*?studentEvidenceCommands=20260825011100/u);
  assert.doesNotMatch(productionRollback, /missionmed\.lor\.disposable-postgres-harness\.v1/u);
  assert.match(localRollback, /studentEvidenceCommands=20260825011000\$/u);
  assert.match(productionRollback, /studentEvidenceCommands=20260825011100\$/u);
});
