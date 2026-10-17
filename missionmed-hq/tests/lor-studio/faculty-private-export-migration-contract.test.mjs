import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const LOCAL_MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260825010600_f2_lor_1012_faculty_private_export_commands.sql',
  import.meta.url,
);
const PRODUCTION_MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260825010700_f2_lor_1012_production_faculty_private_export_commands.sql',
  import.meta.url,
);
const LOCAL_ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010600_f2_lor_1012_faculty_private_export_commands.rollback.sql',
  import.meta.url,
);
const PRODUCTION_ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010700_f2_lor_1012_production_faculty_private_export_commands.rollback.sql',
  import.meta.url,
);

const localMigration = readFileSync(LOCAL_MIGRATION, 'utf8');
const productionMigration = readFileSync(PRODUCTION_MIGRATION, 'utf8');
const localRollback = readFileSync(LOCAL_ROLLBACK, 'utf8');
const productionRollback = readFileSync(PRODUCTION_ROLLBACK, 'utf8');
const migrations = [localMigration, productionMigration];
const rollbacks = [localRollback, productionRollback];

function functionBody(sql, dollarTag) {
  const start = sql.indexOf('AS $' + dollarTag + '$');
  const end = sql.indexOf('$' + dollarTag + '$;', start + 1);
  assert.notEqual(start, -1, 'missing ' + dollarTag + ' function start');
  assert.notEqual(end, -1, 'missing ' + dollarTag + ' function end');
  return sql.slice(start, end);
}

test('local and production successors expose only the fixed three-function ABI', () => {
  for (const migration of migrations) {
    assert.match(
      migration,
      /CREATE FUNCTION lor_studio\.append_artifact_export_audit\(\s*candidate_event jsonb,\s*candidate_event_hash text,\s*candidate_scope_hash text,\s*candidate_target_binding_hash text\s*\)\s+RETURNS jsonb[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/u,
    );
    assert.match(
      migration,
      /CREATE FUNCTION lor_studio\.read_final_document_export\(\)\s+RETURNS jsonb[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/u,
    );
    assert.match(
      migration,
      /CREATE FUNCTION lor_studio\.commit_faculty_private_content\(\s*candidate_expected_revision bigint,\s*candidate_content jsonb,\s*candidate_idempotency_key text,\s*candidate_request_hash text,\s*candidate_event jsonb,\s*candidate_event_hash text\s*\)\s+RETURNS jsonb[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/u,
    );
    assert.match(
      migration,
      /ALTER FUNCTION lor_studio\.append_artifact_export_audit\(\s*jsonb,\s*text,\s*text,\s*text\s*\)\s+OWNER TO lor_studio_command_owner/u,
    );
    assert.match(
      migration,
      /ALTER FUNCTION lor_studio\.read_final_document_export\(\)\s+OWNER TO lor_studio_command_owner/u,
    );
    assert.match(
      migration,
      /ALTER FUNCTION lor_studio\.commit_faculty_private_content\(\s*bigint,\s*jsonb,\s*text,\s*text,\s*jsonb,\s*text\s*\)\s+OWNER TO lor_studio_command_owner/u,
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION lor_studio\.append_artifact_export_audit\(\s*jsonb,\s*text,\s*text,\s*text\s*\)\s+FROM PUBLIC/u,
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION lor_studio\.read_final_document_export\(\)\s+FROM PUBLIC/u,
    );
    assert.match(
      migration,
      /GRANT EXECUTE ON FUNCTION lor_studio\.read_final_document_export\(\)\s+TO lor_studio_app/u,
    );
    assert.doesNotMatch(
      migration,
      /has_function_privilege\(\s*'PUBLIC'/u,
    );
    assert.match(
      migration,
      /pg_catalog\.aclexplode\(COALESCE\([\s\S]*?acl\.grantee = 0[\s\S]*?acl\.privilege_type = 'EXECUTE'/u,
    );
    assert.doesNotMatch(
      migration,
      /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,120}TO lor_studio_app/iu,
    );
  }
});

test('artifact audit command is database-owned, actor/case-bound, append-only, and replay-safe', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'artifact_export_audit');
    assert.match(migration, /CREATE TABLE lor_studio\.artifact_export_audit_events/u);
    assert.match(
      migration,
      /ALTER TABLE lor_studio\.artifact_export_audit_events\s+ENABLE ROW LEVEL SECURITY/u,
    );
    assert.match(
      migration,
      /ALTER TABLE lor_studio\.artifact_export_audit_events\s+FORCE ROW LEVEL SECURITY/u,
    );
    assert.match(
      migration,
      /CREATE TRIGGER artifact_export_audit_events_append_only[\s\S]*?lor_studio\.reject_append_only_mutation\(\)/u,
    );
    assert.match(body, /lor_studio\.canonical_jsonb_sha256\(candidate_event\)/u);
    assert.match(body, /lor-studio:actor:/u);
    assert.match(body, /lor-studio:case:/u);
    assert.match(body, /candidate_event ->> 'type' = 'artifact\.generated'/u);
    assert.match(body, /candidate_event ->> 'type' = 'artifact\.denied'/u);
    assert.match(body, /'artifactSha256', 'releaseDocumentHash', 'sourceRevision'/u);
    assert.match(body, /actor_role = 'student'[\s\S]*?'releaseDocumentHash' = 'null'::jsonb/u);
    assert.match(migration, /artifact_sha256 text,[\s\S]*?release_document_hash text,[\s\S]*?source_revision bigint/u);
    assert.match(migration, /artifact_export_audit_events_artifact_binding CHECK \([\s\S]*?\)\) IS TRUE[\s\S]*?event_hash = lor_studio\.canonical_jsonb_sha256\(event\)/u);
    assert.match(body, /ON CONFLICT \(event_id\) DO NOTHING/u);
    assert.match(body, /'schemaVersion', 'missionmed\.lor\.artifact-audit-receipt\.v1'/u);
    assert.match(body, /'transactionRef', 'txn_' \|\| pg_catalog\.encode/u);
    assert.doesNotMatch(body, /candidate_event ->> '(?:text|content|email|prompt|token)'/u);
  }
});

test('export reads are actor-safe, role-bound, and never return the aggregate', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'final_document_export');
    for (const axis of [
      'lor_studio.actor_role',
      'lor_studio.operation',
      'lor_studio.purpose',
      'lor_studio.resource_student_id',
      'lor_studio.student_auth_subject',
      'request.jwt.claim.sub',
      'lor_studio.entitlement_verified',
      'lor_studio.lor_enabled',
      'lor_studio.canary_authorized',
    ]) assert.match(body, new RegExp(axis.replaceAll('.', '\\.'), 'u'));
    assert.match(body, /lor_studio\.student_context_allows\(/u);
    assert.match(body, /lor_studio\.faculty_context_allows\(/u);
    assert.match(body, /released_document\.snapshot_hash\s*<>\s*lor_studio\.canonical_jsonb_sha256/u);
    assert.match(body, /private_content\.private_record_hash\s*<>\s*lor_studio\.canonical_jsonb_sha256/u);
    assert.match(body, /'schemaVersion', 'missionmed\.lor\.final-document-export\.v1'/u);
    assert.match(body, /'exportProjection', 'student_visible'/u);
    assert.match(body, /'exportProjection', 'faculty_owner'/u);
    assert.doesNotMatch(body, /RETURN\s+recommendation_case\.record/iu);
    assert.doesNotMatch(body, /'record',\s*recommendation_case\.record/iu);
  }
});

test('faculty-private command serializes, validates, hashes, audits, and receipts one revision', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'faculty_private_content');
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/u);
    assert.match(body, /FROM lor_studio\.recommendation_cases[\s\S]*?FOR UPDATE/u);
    assert.match(body, /candidate_expected_revision <> recommendation_case\.revision/u);
    assert.match(body, /stored_receipt\.request_hash <> candidate_request_hash/u);
    assert.match(body, /expected_request_hash := lor_studio\.canonical_jsonb_sha256/u);
    assert.match(body, /candidate_event_hash\s*<>\s*lor_studio\.canonical_jsonb_sha256\(candidate_event\)/u);
    assert.match(body, /event_occurred_at > pg_catalog\.statement_timestamp\(\)/u);
    assert.match(
      body,
      /candidate_content -> 'facultyApproval' ->> 'approved' = 'true'/u,
    );
    assert.match(
      body,
      /candidate_content -> 'facultyApproval'\s*->> 'signatureAttested' = 'true'/u,
    );
    assert.match(body, /recommendation_case\.status <> ALL \(\s*ARRAY\['faculty_verified', 'faculty_review', 'faculty_approved'\]/u);
    assert.doesNotMatch(
      body,
      /ARRAY\['faculty_verified', 'faculty_review', 'faculty_approved', 'delivered'\]/u,
    );
    assert.match(body, /recommendation_case\.released_at IS NOT NULL/u);
    assert.match(body, /private_content\.released_at IS NOT NULL/u);
    assert.match(body, /lor_studio\.protected_state_chain_hash\(/u);
    assert.match(body, /INSERT INTO lor_studio\.recommendation_case_audit_events/u);
    assert.match(body, /INSERT INTO lor_studio\.recommendation_case_protected_revision_states/u);
    assert.match(body, /INSERT INTO lor_studio\.recommendation_case_private_write_receipts/u);
    assert.match(body, /'faculty\.private_content_updated'/u);
    assert.match(body, /'faculty\.private_content_update'/u);
    assert.match(body, /released_snapshot_hash,\s*event_hash[\s\S]*?NULL,\s*candidate_event_hash/u);
  }
});

test('new DML custody is narrow, RLS-bound, and receipt constrained', () => {
  for (const migration of migrations) {
    assert.match(
      migration,
      /ADD CONSTRAINT recommendation_case_private_write_receipts_command_type_known CHECK \(\s*command_type IN \(\s*'faculty\.final_document_release',\s*'faculty\.private_content_update'\s*\)\s*\)/u,
    );
    assert.match(
      migration,
      /GRANT INSERT ON TABLE lor_studio\.faculty_private_content\s+TO lor_studio_command_owner/u,
    );
    assert.match(
      migration,
      /CREATE POLICY faculty_private_content_faculty_command_insert[\s\S]*?TO lor_studio_command_owner[\s\S]*?lor_studio\.student_write_axes_satisfied\(\)[\s\S]*?lor_studio\.faculty_context_allows/u,
    );
    assert.match(
      migration,
      /CREATE POLICY released_student_documents_student_export_select[\s\S]*?TO lor_studio_command_owner[\s\S]*?'student_case_read'[\s\S]*?lor_studio\.student_context_allows/u,
    );
    assert.match(
      migration,
      /CREATE POLICY artifact_export_audit_events_command_insert[\s\S]*?TO lor_studio_command_owner[\s\S]*?student_case_read[\s\S]*?faculty_private_edit/u,
    );
    assert.match(
      migration,
      /GRANT SELECT, INSERT ON TABLE lor_studio\.artifact_export_audit_events\s+TO lor_studio_command_owner/u,
    );
    assert.doesNotMatch(migration, /GRANT\s+DELETE/iu);
    assert.doesNotMatch(migration, /GRANT\s+TRUNCATE/iu);
  }
});

test('successors are exact environment twins with fenced predecessor and successor sentinels', () => {
  assert.match(
    localMigration,
    /\|identityScope=20260825010200\|facultyInvitationCommands=20260825010400'/u,
  );
  assert.match(
    localMigration,
    /observed_sentinel \|\| '\|facultyPrivateExportCommands=20260825010600'/u,
  );
  assert.match(
    productionMigration,
    /\|identityScope=20260825010300\|facultyInvitationCommands=20260825010500'/u,
  );
  assert.match(
    productionMigration,
    /observed_sentinel \|\| '\|facultyPrivateExportCommands=20260825010700'/u,
  );
  assert.match(productionMigration, /target_provider IS DISTINCT FROM 'railway-postgres'/u);
  assert.match(productionMigration, /pg_catalog\.inet_server_addr\(\) IS NULL/u);
  assert.match(productionMigration, /pg_catalog\.current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
  assert.match(localMigration, /pg_catalog\.inet_server_addr\(\) IS NOT NULL/u);
  assert.match(localMigration, /pg_catalog\.current_setting\('listen_addresses'\) <> ''/u);
});

test('rollbacks are no-CASCADE, data-preserving, and restore exact prior custody', () => {
  for (const rollback of rollbacks) {
    assert.doesNotMatch(rollback, /\bCASCADE\b/iu);
    assert.doesNotMatch(rollback, /\bDELETE\s+FROM\b/iu);
    assert.doesNotMatch(rollback, /\bTRUNCATE\b/iu);
    assert.equal(
      (rollback.match(/\bDROP\s+TABLE\b/giu) ?? []).length,
      1,
    );
    assert.match(
      rollback,
      /IF EXISTS \(\s*SELECT 1\s*FROM lor_studio\.artifact_export_audit_events\s*\)[\s\S]*?rollback refuses to destroy artifact export audit custody/u,
    );
    assert.doesNotMatch(rollback, /has_function_privilege\(\s*'PUBLIC'/u);
    assert.match(
      rollback,
      /pg_catalog\.aclexplode\(COALESCE\([\s\S]*?acl\.grantee = 0[\s\S]*?acl\.privilege_type = 'EXECUTE'/u,
    );
    assert.match(
      rollback,
      /WHERE receipt\.command_type = 'faculty\.private_content_update'[\s\S]*?rollback refuses to orphan faculty-private command custody/u,
    );
    assert.match(rollback, /DROP FUNCTION lor_studio\.read_final_document_export\(\)/u);
    assert.match(
      rollback,
      /DROP FUNCTION lor_studio\.append_artifact_export_audit\(\s*jsonb,\s*text,\s*text,\s*text\s*\)/u,
    );
    assert.match(rollback, /DROP TABLE lor_studio\.artifact_export_audit_events/u);
    assert.match(
      rollback,
      /DROP FUNCTION lor_studio\.commit_faculty_private_content\(\s*bigint,\s*jsonb,\s*text,\s*text,\s*jsonb,\s*text\s*\)/u,
    );
    assert.match(
      rollback,
      /DROP POLICY faculty_private_content_faculty_command_insert\s+ON lor_studio\.faculty_private_content/u,
    );
    assert.match(
      rollback,
      /REVOKE INSERT ON TABLE lor_studio\.faculty_private_content\s+FROM lor_studio_command_owner/u,
    );
    assert.match(
      rollback,
      /ADD CONSTRAINT recommendation_case_private_write_receipts_command_type_known CHECK \(\s*command_type = 'faculty\.final_document_release'\s*\)/u,
    );
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
  assert.match(localRollback, /missionmed\.lor\.disposable-postgres-harness\.v1[\s\S]*?facultyPrivateExportCommands=20260825010600/u);
  assert.doesNotMatch(localRollback, /missionmed\.lor\.railway-postgres-target\.v1/u);
  assert.match(productionRollback, /missionmed\.lor\.railway-postgres-target\.v1[\s\S]*?facultyPrivateExportCommands=20260825010700/u);
  assert.doesNotMatch(productionRollback, /missionmed\.lor\.disposable-postgres-harness\.v1/u);
  assert.match(localRollback, /facultyPrivateExportCommands=20260825010600\$/u);
  assert.match(productionRollback, /facultyPrivateExportCommands=20260825010700\$/u);
});
