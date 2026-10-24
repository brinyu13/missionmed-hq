import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const LOCAL_MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260825010800_f2_lor_1012_ai_proposal_commands.sql',
  import.meta.url,
);
const PRODUCTION_MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260825010900_f2_lor_1012_production_ai_proposal_commands.sql',
  import.meta.url,
);
const LOCAL_ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010800_f2_lor_1012_ai_proposal_commands.rollback.sql',
  import.meta.url,
);
const PRODUCTION_ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260825010900_f2_lor_1012_production_ai_proposal_commands.rollback.sql',
  import.meta.url,
);

const localMigration = readFileSync(LOCAL_MIGRATION, 'utf8');
const productionMigration = readFileSync(PRODUCTION_MIGRATION, 'utf8');
const localRollback = readFileSync(LOCAL_ROLLBACK, 'utf8');
const productionRollback = readFileSync(PRODUCTION_ROLLBACK, 'utf8');
const migrations = [localMigration, productionMigration];
const rollbacks = [localRollback, productionRollback];

const ABI = Object.freeze([
  Object.freeze({
    name: 'read_faculty_drafting_context',
    types: '',
    tag: 'read_drafting_context',
  }),
  Object.freeze({
    name: 'persist_ai_provider_run_and_proposal_atomic',
    types: 'text, text, text, text, text, text, text, text, text, jsonb',
    tag: 'persist_proposal',
  }),
  Object.freeze({
    name: 'transition_ai_proposal_generation_reservation',
    types: 'text, text, text, text, text, text',
    tag: 'transition_generation',
  }),
  Object.freeze({
    name: 'read_actor_safe_ai_proposal',
    types: 'text, text, text, text',
    tag: 'read_proposal',
  }),
  Object.freeze({
    name: 'attach_ai_proposal_decision_if_undecided_atomic',
    types: 'text, text, text, text, text, text, text, text, text, text, text, jsonb',
    tag: 'attach_decision',
  }),
]);

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function functionBody(sql, tag) {
  const startMarker = `AS $${tag}$`;
  const endMarker = `$${tag}$;`;
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${tag} body start`);
  assert.notEqual(end, -1, `missing ${tag} body end`);
  return sql.slice(start, end + endMarker.length);
}

function normalizedSuccessorBody(sql, timestamp) {
  const start = sql.indexOf('LOCK TABLE');
  assert.notEqual(start, -1, 'missing locked successor body');
  return sql.slice(start).replaceAll(timestamp, 'AI_COMMAND_TS').trim();
}

function assertBalancedDollarQuotes(sql) {
  const counts = new Map();
  for (const match of sql.matchAll(/\$[a-z_]*\$/gu)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  assert.ok(counts.size > 0);
  for (const [tag, count] of counts) {
    assert.equal(count % 2, 0, `${tag} is not balanced`);
  }
}

test('both migrations are fenced, transactional, syntactically balanced successors', () => {
  for (const migration of migrations) {
    assert.match(migration, /^-- Migration: 20260825010[89]00/u);
    assert.match(migration, /\nBEGIN;\n/u);
    assert.match(migration, /\nCOMMIT;\s*$/u);
    assert.match(migration, /IN ACCESS EXCLUSIVE MODE;/u);
    assert.match(migration, /relation_count IS DISTINCT FROM 30/u);
    assert.match(migration, /forced_rls_count IS DISTINCT FROM 30/u);
    assert.match(migration, /definer_count IS DISTINCT FROM 21/u);
    assertBalancedDollarQuotes(migration);
  }
  assert.match(localMigration, /exact disposable PostgreSQL 16\/18 harness only/u);
  assert.match(localMigration, /pg_catalog\.inet_server_addr\(\) IS NOT NULL/u);
  assert.match(localMigration, /facultyPrivateExportCommands=20260825010600/u);
  assert.match(productionMigration, /target_provider IS DISTINCT FROM 'railway-postgres'/u);
  assert.match(productionMigration, /target_project_id IS DISTINCT FROM '29afe885-b9b1-425d-8fd8-8611cd275409'/u);
  assert.match(productionMigration, /target_environment_id IS DISTINCT FROM 'f5705d38-393c-4176-9cc2-0d1dbad42c93'/u);
  assert.match(productionMigration, /target_service_id IS DISTINCT FROM 'b49a52e7-df15-4417-b67a-a64403aa5db7'/u);
  assert.match(productionMigration, /target_data_copied IS DISTINCT FROM 'false'/u);
  assert.match(productionMigration, /pg_catalog\.inet_server_addr\(\) IS NULL/u);
  assert.match(productionMigration, /pg_catalog\.current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
  assert.match(productionMigration, /facultyPrivateExportCommands=20260825010700/u);
});

test('the exact five-function driver ABI is command-owner only', () => {
  for (const migration of migrations) {
    for (const entry of ABI) {
      const declaration = new RegExp(
        `CREATE FUNCTION lor_studio\\.${entry.name}\\([\\s\\S]*?\\)\\s+RETURNS jsonb[\\s\\S]*?SECURITY DEFINER\\s+SET search_path = ''`,
        'u',
      );
      const signature = escaped(entry.types).replaceAll('\\ ', '\\s*');
      assert.match(migration, declaration);
      assert.match(
        migration,
        new RegExp(`ALTER FUNCTION lor_studio\\.${entry.name}\\(\\s*${signature}\\s*\\)\\s+OWNER TO lor_studio_command_owner`, 'u'),
      );
      assert.match(
        migration,
        new RegExp(`REVOKE ALL ON FUNCTION lor_studio\\.${entry.name}\\([\\s\\S]*?\\) FROM PUBLIC`, 'u'),
      );
      assert.match(
        migration,
        new RegExp(`GRANT EXECUTE ON FUNCTION lor_studio\\.${entry.name}\\([\\s\\S]*?\\) TO lor_studio_app`, 'u'),
      );
    }
    assert.equal(
      [...migration.matchAll(/^CREATE FUNCTION lor_studio\.(?:read_faculty_drafting_context|transition_ai_proposal_generation_reservation|persist_ai_provider_run_and_proposal_atomic|read_actor_safe_ai_proposal|attach_ai_proposal_decision_if_undecided_atomic)\(/gmu)].length,
      5,
    );
    assert.match(migration, /definer_count IS DISTINCT FROM 26/u);
  }
});

test('faculty drafting context exposes only verified consented hash-bound evidence', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'read_drafting_context');
    assert.match(body, /faculty_context_allows\([\s\S]*?ARRAY\['read'\]::text\[\]/u);
    assert.match(body, /invitation\.invitation_id = scope_invitation_id/u);
    assert.match(body, /invitation\.faculty_auth_subject = faculty_subject/u);
    assert.match(body, /invitation\.faculty_auth_uid = faculty_uid/u);
    assert.match(body, /faculty_otp_proof_revocations/u);
    assert.match(body, /receipt\.scopes @> ARRAY\['ai_drafting', 'evidence_grounding'\]::text\[\]/u);
    assert.match(body, /receipt\.case_revision <= recommendation_case\.revision/u);
    assert.match(body, /pg_catalog\.sha256/u);
    assert.match(body, /missionmed\.lor\.faculty-drafting-context\.v1/u);
    for (const field of [
      'schemaVersion', 'id', 'studentId', 'status', 'faculty',
      'consentReceipts', 'studentEvidence',
    ]) assert.match(body, new RegExp(`'${field}'`, 'u'));
    for (const excluded of ['builder', 'applicantOptions', 'facultyPrivate', 'delivery']) {
      assert.doesNotMatch(body, new RegExp(`'${excluded}'`, 'u'));
    }
    assert.doesNotMatch(body, /RETURN\s+recommendation_case/iu);
  }
});

test('complete proposal records bind canonical provenance, grounding, decisions, and content hashes', () => {
  for (const migration of migrations) {
    const validator = functionBody(migration, 'record_complete');
    for (const field of [
      'schemaVersion', 'id', 'caseId', 'requestedBy', 'requestedAt', 'state',
      'humanDecisionRequired', 'text', 'segments', 'claims', 'grounding',
      'provenance', 'fallbackUsed', 'decision', 'acceptedContent',
    ]) assert.match(validator, new RegExp(`'${field}'`, 'u'));
    assert.match(validator, /missionmed\.lor\.ai-proposal-record\.v1/u);
    assert.match(validator, /missionmed\.lor\.ai-proposal-provenance\.v1/u);
    assert.match(validator, /provenance ->> 'provider' <> 'openai'/u);
    assert.match(validator, /provenance ->> 'model' <> 'gpt-5\.6-terra'/u);
    assert.match(validator, /provenance ->> 'templateHash' <> pg_catalog\.encode/u);
    assert.match(validator, /sourceSetHash'[\s\S]*?canonical_jsonb_sha256/u);
    assert.match(validator, /END \|\| \(segment_rows\.segment ->> 'text'\)/u);
    assert.match(validator, /composed_text IS DISTINCT FROM payload ->> 'text'/u);
    assert.match(validator, /expected_claims IS DISTINCT FROM payload -> 'claims'/u);
    assert.match(validator, /expected_support_ids IS DISTINCT FROM grounding -> 'supportIds'/u);
    assert.match(validator, /reconstructed_grounding := pg_catalog\.jsonb_build_object/u);
    assert.match(validator, /canonical_jsonb_sha256\(reconstructed_grounding\)/u);
    assert.match(validator, /missionmed\.lor\.human-decision\.v1/u);
    assert.match(validator, /decision_record ->> 'proposalOutputHash' <> provenance ->> 'outputHash'/u);
    assert.match(validator, /accepted_content ->> 'textHash' <> decision_record ->> 'resultingTextHash'/u);
    assert.match(validator, /accepted_content ->> 'groundingAttestationHash'[\s\S]*?grounding ->> 'attestationHash'/u);
    assert.match(validator, /accepted_content ->> 'origin' = 'human_edited'/u);
    assert.match(validator, /EXCEPTION WHEN OTHERS THEN\s+RETURN false/u);
    assert.match(
      migration,
      /GRANT EXECUTE ON FUNCTION lor_studio\.ai_grounding_manifest_is_complete\(jsonb\)\s+TO lor_studio_command_owner/u,
    );
  }
});

test('proposal persistence recomputes request and record hashes before one atomic provider run plus proposal write', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'persist_proposal');
    assert.match(body, /expected_request_hash := lor_studio\.canonical_jsonb_sha256/u);
    assert.match(body, /'operation', 'ai\.proposal\.generate'/u);
    assert.match(body, /'factIds'[\s\S]*?jsonb_agg/u);
    assert.match(body, /candidate_request_hash IS DISTINCT FROM expected_request_hash/u);
    assert.match(body, /candidate_submitted_record_hash <>[\s\S]*?canonical_jsonb_sha256\(candidate_record\)/u);
    assert.match(body, /candidate_provider_run_hash <>[\s\S]*?canonical_jsonb_sha256\(candidate_record -> 'provenance'\)/u);
    assert.match(body, /candidate_output_hash <>[\s\S]*?provenance' ->> 'outputHash'/u);
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/u);
    assert.match(body, /pending_reservation\.receipt_id IS NULL/u);
    assert.match(body, /unknown_reservation\.receipt_id IS NOT NULL/u);
    assert.match(body, /missionmed\.lor\.ai-generation-reservation\.v1/u);
    assert.match(body, /pg_catalog\.set_config\('lor_studio\.actor_role', 'service', true\)/u);
    assert.match(body, /ai_proposal_command_context_allows\(candidate_case_id, 'save'\)/u);
    assert.match(body, /INSERT INTO lor_studio\.ai_generation_runs[\s\S]*?INSERT INTO lor_studio\.ai_letter_proposals/u);
    assert.match(body, /'sameTransaction', true/u);
    assert.match(body, /'databaseClockUsed', true/u);
    assert.match(body, /pg_catalog\.statement_timestamp\(\)/u);
  }
});

test('provider generation is durably reserved before IO and replays pending accepted or unknown', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'transition_generation');
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/u);
    assert.match(body, /missionmed\.lor\.ai-generation-reservation\.v1/u);
    assert.match(body, /candidate_operation <> ALL \(ARRAY\[[\s\S]*?'reserve_generation'[\s\S]*?'mark_generation_unknown'/u);
    assert.match(body, /pending_receipt\.request_hash <> candidate_request_hash/u);
    assert.match(body, /unknown_receipt\.request_hash <> candidate_request_hash/u);
    assert.match(body, /accepted_receipt\.request_hash <> candidate_request_hash/u);
    assert.match(body, /'status', 'pending'[\s\S]*?'providerCallAuthorized', true/u);
    assert.match(body, /'status', 'pending'[\s\S]*?'providerCallAuthorized', false/u);
    assert.match(body, /'status', 'accepted'[\s\S]*?'providerCallAuthorized', false/u);
    assert.match(body, /'status', 'unknown'[\s\S]*?'providerCallAuthorized', false/u);
    assert.match(body, /accepted_receipt\.result -> 'record'/u);
    assert.match(body, /INSERT INTO lor_studio\.ai_proposal_generation_reservation_receipts/u);
  }
});

test('reads are faculty-scoped, actor-safe, case-bound receipts with no table-shaped result', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'read_proposal');
    assert.match(body, /ai_proposal_command_context_allows\(candidate_case_id, 'read'\)/u);
    assert.match(body, /ai_proposal_scope_hash\(candidate_case_id, 'read'\)/u);
    assert.match(body, /proposal\.case_id = candidate_case_id/u);
    assert.match(body, /proposal\.student_auth_subject = pg_catalog\.current_setting/u);
    assert.match(body, /proposal\.proposal_id = candidate_proposal_id/u);
    assert.match(body, /missionmed\.lor\.ai-proposal-read-receipt\.v1/u);
    assert.match(body, /'found', false/u);
    assert.match(body, /'found', true/u);
    assert.match(body, /'recordHash', selected_record_hash/u);
    assert.doesNotMatch(body, /RETURN\s+stored_proposal/iu);
    assert.doesNotMatch(body, /'studentAuthSubject'/u);
  }
});

test('decision writes recompute request hashes, serialize, and conditionally admit exactly one human decision', () => {
  for (const migration of migrations) {
    const body = functionBody(migration, 'attach_decision');
    assert.match(body, /expected_request_hash := lor_studio\.canonical_jsonb_sha256/u);
    assert.match(body, /'operation', 'ai\.proposal\.decide'/u);
    assert.match(body, /candidate_request_hash IS DISTINCT FROM expected_request_hash/u);
    assert.match(body, /decision_record ->> 'facultyId' <> faculty_subject/u);
    assert.match(body, /candidate_decision_hash <>[\s\S]*?canonical_jsonb_sha256\(decision_record\)/u);
    assert.match(body, /candidate_accepted_content_hash IS DISTINCT FROM \(CASE/u);
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/u);
    assert.match(body, /SELECT decision\.\* INTO existing_decision/u);
    assert.match(body, /LOR_AI_PROPOSAL_ALREADY_DECIDED/u);
    assert.match(body, /current_case\.status IN \('delivered', 'closed', 'cancelled'\)/u);
    assert.match(body, /current_case\.released_at IS NOT NULL/u);
    assert.equal([...body.matchAll(/INSERT INTO lor_studio\.ai_proposal_decisions/gu)].length, 1);
    assert.match(body, /WHEN unique_violation THEN[\s\S]*?ERRCODE = 'P1404'/u);
  }
});

test('idempotency replay requires the identical operation and request hash', () => {
  for (const migration of migrations) {
    const persist = functionBody(migration, 'persist_proposal');
    const decide = functionBody(migration, 'attach_decision');
    for (const body of [persist, decide]) {
      assert.match(body, /receipt\.case_id = candidate_case_id/u);
      assert.match(body, /receipt\.student_auth_subject = student_subject/u);
      assert.match(body, /receipt\.idempotency_key = candidate_idempotency_key/u);
      assert.match(body, /stored_receipt\.request_hash <> candidate_request_hash/u);
      assert.match(body, /LOR_AI_PROPOSAL_IDEMPOTENCY_CONFLICT/u);
      assert.match(body, /'outcome', 'replayed'/u);
      assert.match(body, /'writeApplied', false/u);
      assert.match(body, /'replayed', true/u);
    }
    assert.match(decide, /stored_receipt\.proposal_id <> candidate_proposal_id/u);
  }
});

test('receipt storage is append-only, forced-RLS, hash-bound, and exact-shape', () => {
  for (const migration of migrations) {
    assert.match(migration, /CREATE TABLE lor_studio\.ai_proposal_command_receipts \(/u);
    assert.match(migration, /UNIQUE \(case_id, student_auth_subject, idempotency_key\)/u);
    assert.match(migration, /result_hash = lor_studio\.canonical_jsonb_sha256\(result\)/u);
    assert.match(migration, /result - ARRAY\[[\s\S]*?'committedAt', 'record'[\s\S]*?\]::text\[\] = '\{\}'::jsonb/u);
    assert.match(migration, /missionmed\.lor\.ai-proposal-write-receipt\.v1/u);
    assert.match(migration, /result -> 'sameTransaction' = 'true'::jsonb/u);
    assert.match(migration, /result -> 'databaseClockUsed' = 'true'::jsonb/u);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY;/u);
    assert.match(migration, /FORCE ROW LEVEL SECURITY;/u);
    assert.match(migration, /CREATE TRIGGER ai_proposal_command_receipts_append_only/u);
    assert.match(migration, /CREATE TABLE lor_studio\.ai_proposal_generation_reservation_receipts \(/u);
    assert.match(migration, /phase IN \('pending', 'unknown'\)/u);
    assert.match(migration, /CREATE TRIGGER ai_proposal_generation_reservation_receipts_append_only/u);
    assert.match(migration, /EXECUTE FUNCTION lor_studio\.reject_append_only_mutation\(\)/u);
  }
});

test('RLS and grants make provider writes trusted-service-only and remove app table DML', () => {
  for (const migration of migrations) {
    for (const policy of [
      'recommendation_cases_ai_command_service_select',
      'ai_generation_runs_ai_command_service_select',
      'ai_generation_runs_ai_command_service_insert',
      'ai_letter_proposals_ai_command_service_insert',
      'ai_proposal_command_receipts_faculty_select',
      'ai_proposal_command_receipts_faculty_insert',
      'ai_proposal_generation_reservations_faculty_select',
      'ai_proposal_generation_reservations_faculty_insert',
    ]) assert.match(migration, new RegExp(`CREATE POLICY ${policy}`, 'u'));
    assert.match(migration, /trusted_service_actor'[\s\S]*?'lor-ai-proposal-store-v1'/u);
    assert.match(migration, /REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*?ai_generation_runs,[\s\S]*?ai_letter_proposals,[\s\S]*?ai_proposal_decisions[\s\S]*?FROM lor_studio_app/u);
    assert.doesNotMatch(migration, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,160}TO lor_studio_app/iu);
    assert.match(migration, /public_execute_count <> 0/u);
    assert.match(migration, /ai_policy_count IS DISTINCT FROM 8/u);
  }
});

test('audit entries are metadata-only and all provider or database failures collapse to fixed codes', () => {
  for (const migration of migrations) {
    for (const entry of [
      ['persist_proposal', 'ai.proposal_generated'],
      ['attach_decision', 'ai.proposal_decision_recorded'],
    ]) {
      const body = functionBody(migration, entry[0]);
      const eventStart = body.indexOf('event_record := pg_catalog.jsonb_build_object(');
      const eventEnd = body.indexOf('event_hash :=', eventStart);
      assert.notEqual(eventStart, -1);
      assert.notEqual(eventEnd, -1);
      const event = body.slice(eventStart, eventEnd);
      assert.match(event, new RegExp(`'eventType', '${escaped(entry[1])}'`, 'u'));
      assert.doesNotMatch(event, /'text'|'record'|'grounding'|'provenance'/u);
    }
    for (const code of ['P1401', 'P1402', 'P1403', 'P1404', 'P1405']) {
      assert.match(migration, new RegExp(`'${code}'`, 'u'));
    }
    assert.match(migration, /WHEN OTHERS THEN\s+RAISE EXCEPTION 'LOR_AI_PROPOSAL_COMMAND_INVALID'/u);
    assert.doesNotMatch(migration, /\b(?:password|credential|secret|access_token|refresh_token)\b/iu);
  }
});

test('local and production implementations are exact semantic twins after their identity guards', () => {
  assert.equal(
    normalizedSuccessorBody(localMigration, '20260825010800'),
    normalizedSuccessorBody(productionMigration, '20260825010900'),
  );
  assert.equal(
    normalizedSuccessorBody(localRollback, '20260825010800'),
    normalizedSuccessorBody(productionRollback, '20260825010900'),
  );
});

test('rollbacks fail closed on any durable AI custody and reverse every object explicitly', () => {
  for (const rollback of rollbacks) {
    assert.match(rollback, /\nBEGIN;\n/u);
    assert.match(rollback, /\nCOMMIT;\s*$/u);
    assertBalancedDollarQuotes(rollback);
    assert.doesNotMatch(rollback, /\bCASCADE\b/iu);
    assert.doesNotMatch(rollback, /\bDELETE\s+FROM\b/iu);
    assert.doesNotMatch(rollback, /\bTRUNCATE\b/iu);
    assert.match(rollback, /EXISTS \(SELECT 1 FROM lor_studio\.ai_proposal_command_receipts\)/u);
    assert.match(rollback, /SELECT 1 FROM lor_studio\.ai_proposal_generation_reservation_receipts/u);
    assert.match(rollback, /EXISTS \(SELECT 1 FROM lor_studio\.ai_generation_runs\)/u);
    assert.match(rollback, /EXISTS \(SELECT 1 FROM lor_studio\.ai_letter_proposals\)/u);
    assert.match(rollback, /EXISTS \(SELECT 1 FROM lor_studio\.ai_proposal_decisions\)/u);
    assert.match(rollback, /'ai\.proposal_generated', 'ai\.proposal_decision_recorded'/u);
    for (const entry of ABI) {
      assert.match(rollback, new RegExp(`DROP FUNCTION lor_studio\\.${entry.name}\\(`, 'u'));
    }
    assert.match(rollback, /DROP TABLE lor_studio\.ai_proposal_command_receipts;/u);
    assert.match(rollback, /DROP TABLE lor_studio\.ai_proposal_generation_reservation_receipts;/u);
    assert.match(rollback, /DROP FUNCTION lor_studio\.ai_proposal_record_is_complete\(jsonb\);/u);
    assert.match(
      rollback,
      /REVOKE EXECUTE ON FUNCTION lor_studio\.ai_grounding_manifest_is_complete\(jsonb\)\s+FROM lor_studio_command_owner/u,
    );
    assert.match(rollback, /relation_count IS DISTINCT FROM 30/u);
    assert.match(rollback, /forced_rls_count IS DISTINCT FROM 30/u);
    assert.match(rollback, /definer_count IS DISTINCT FROM 21/u);
  }
  assert.match(localRollback, /aiProposalCommands=20260825010800\$/u);
  assert.match(productionRollback, /aiProposalCommands=20260825010900\$/u);
});
