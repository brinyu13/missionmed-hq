import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.sql',
  import.meta.url,
);
const ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260826011500_f2_lor_1012_faculty_candidate_auth_handoff_commands.rollback.sql',
  import.meta.url,
);

const migration = readFileSync(MIGRATION, 'utf8');
const rollback = readFileSync(ROLLBACK, 'utf8');

function body(sql, tag) {
  const startMarker = `AS $${tag}$`;
  const endMarker = `$${tag}$;`;
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${tag} body start`);
  assert.notEqual(end, -1, `missing ${tag} body end`);
  return sql.slice(start, end + endMarker.length);
}

function assertBalancedDollarQuotes(sql) {
  const counts = new Map();
  for (const match of sql.matchAll(/\$[a-z_]*\$/gu)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  assert.ok(counts.size > 0);
  for (const [tag, count] of counts) assert.equal(count % 2, 0, tag);
}

test('115 is a fenced transactional successor of encrypted private storage', () => {
  assert.match(migration, /^-- Migration: 20260826011500/u);
  assert.match(migration, /\nBEGIN;\n/u);
  assert.match(migration, /\nCOMMIT;\s*$/u);
  assert.match(migration, /IN ACCESS EXCLUSIVE MODE;/u);
  assert.match(migration, /target_provider IS DISTINCT FROM 'railway-postgres'/u);
  assert.match(
    migration,
    /target_project_id IS DISTINCT FROM '29afe885-b9b1-425d-8fd8-8611cd275409'/u,
  );
  assert.match(
    migration,
    /target_environment_id IS DISTINCT FROM 'ed3353f7-bcc7-4e25-a000-3c9fc628a9a7'/u,
  );
  assert.match(
    migration,
    /target_service_id IS DISTINCT FROM '576520f5-a702-4343-a277-decdeeed57f6'/u,
  );
  assert.match(migration, /pg_catalog\.current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
  assert.match(migration, /\|encryptedPrivateStorage=20260826011300'/u);
  assert.match(
    migration,
    /observed_sentinel \|\| '\|facultyCandidateAuthHandoff=20260826011500'/u,
  );
  assert.match(migration, /relation_count IS DISTINCT FROM 34/u);
  assert.match(migration, /forced_rls_count IS DISTINCT FROM 34/u);
  assert.match(migration, /definer_count IS DISTINCT FROM 30/u);
  assert.match(migration, /relation_count IS DISTINCT FROM 36/u);
  assert.match(migration, /forced_rls_count IS DISTINCT FROM 36/u);
  assert.match(migration, /definer_count IS DISTINCT FROM 32/u);
  assertBalancedDollarQuotes(migration);
  assertBalancedDollarQuotes(rollback);
});

test('the exact two-function ABI is fixed-search-path, command-owned, and PUBLIC-revoked', () => {
  assert.match(
    migration,
    /CREATE FUNCTION lor_studio\.reserve_faculty_candidate_auth_handoff\(\s*candidate_invitation_id text,\s*candidate_token_hash text,\s*candidate_flow_nonce_hash text,\s*candidate_maximum_lifetime_seconds integer\s*\)\s+RETURNS jsonb[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/u,
  );
  assert.match(
    migration,
    /CREATE FUNCTION lor_studio\.redeem_faculty_candidate_auth_handoff\(\s*candidate_invitation_id text,\s*candidate_token_hash text,\s*candidate_flow_nonce_hash text,\s*candidate_authenticated_subject text,\s*candidate_issued_at timestamptz,\s*candidate_expires_at timestamptz\s*\)\s+RETURNS jsonb[\s\S]*?SECURITY DEFINER\s+SET search_path = ''/u,
  );
  for (const signature of [
    'reserve_faculty_candidate_auth_handoff',
    'redeem_faculty_candidate_auth_handoff',
  ]) {
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON FUNCTION lor_studio\\.${signature}\\([\\s\\S]*?\\) FROM PUBLIC`, 'u'),
    );
    assert.match(
      migration,
      new RegExp(`ALTER FUNCTION lor_studio\\.${signature}\\([\\s\\S]*?\\) OWNER TO lor_studio_command_owner`, 'u'),
    );
    assert.match(
      migration,
      new RegExp(`GRANT EXECUTE ON FUNCTION lor_studio\\.${signature}\\([\\s\\S]*?\\) TO lor_studio_app`, 'u'),
    );
  }
  assert.match(migration, /public_execute_count <> 0/u);
  assert.doesNotMatch(migration, /candidate_raw_token|raw_token/iu);
});

test('opaque reservations and redemptions are exact-bound append-only FORCE-RLS custody', () => {
  for (const relation of [
    'faculty_candidate_auth_handoff_reservations',
    'faculty_candidate_auth_handoff_redemptions',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE lor_studio\\.${relation}`, 'u'));
    assert.match(
      migration,
      new RegExp(`ALTER TABLE lor_studio\\.${relation}\\s+ENABLE ROW LEVEL SECURITY`, 'u'),
    );
    assert.match(
      migration,
      new RegExp(`ALTER TABLE lor_studio\\.${relation}\\s+FORCE ROW LEVEL SECURITY`, 'u'),
    );
    assert.match(
      migration,
      new RegExp(`CREATE TRIGGER ${relation}_append_only[\\s\\S]*?lor_studio\\.reject_append_only_mutation\\(\\)`, 'u'),
    );
  }
  assert.match(migration, /flow_nonce_hash text PRIMARY KEY/u);
  assert.match(migration, /token_hash ~ '\^\[a-f0-9\]\{64\}\$'/u);
  assert.match(migration, /flow_nonce_hash ~ '\^\[a-f0-9\]\{64\}\$'/u);
  assert.match(migration, /faculty_candidate_auth_handoff_reservations_binding_unique/u);
  assert.match(migration, /faculty_candidate_auth_handoff_redemptions_reservation_fk/u);
  assert.match(migration, /reservation_hash = lor_studio\.canonical_jsonb_sha256/u);
  assert.match(migration, /redemption_hash = lor_studio\.canonical_jsonb_sha256/u);
  assert.match(migration, /authenticated_subject <> student_auth_subject/u);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE[\s\S]*?faculty_candidate_auth_handoff_reservations[\s\S]*?faculty_candidate_auth_handoff_redemptions[\s\S]*?FROM lor_studio_app/u,
  );
  assert.doesNotMatch(
    migration,
    /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,220}TO lor_studio_app/iu,
  );
  assert.doesNotMatch(
    migration,
    /GRANT\s+(?:UPDATE|DELETE|TRUNCATE)[\s\S]{0,220}faculty_candidate_auth_handoff/iu,
  );
});

test('candidate context is server-only and pins every admission axis', () => {
  const context = body(migration, 'candidate_auth_context');
  for (const axis of [
    'transaction_isolation',
    'lor_studio.actor_role',
    'lor_studio.operation',
    'lor_studio.purpose',
    'lor_studio.invitation_id',
    'lor_studio.assignment_id',
    'lor_studio.administrative_grant_id',
    'request.jwt.claim.sub',
    'lor_studio.entitlement_verified',
    'lor_studio.lor_enabled',
    'lor_studio.canary_authorized',
    'lor_studio.trusted_service_actor',
    'lor_studio.identity_resolution_verified',
    'lor_studio.student_auth_subject',
  ]) assert.match(context, new RegExp(axis.replaceAll('.', '\\.'), 'u'));
  assert.match(context, /CURRENT_USER = 'lor_studio_command_owner'/u);
  assert.match(context, /'faculty_candidate_auth'/u);
  assert.match(context, /'lor-candidate-auth-v1'/u);
  assert.match(context, /entitlement_verified'[\s\S]*?= 'false'/u);
  assert.match(context, /lor_enabled'[\s\S]*?= 'true'/u);
  assert.match(context, /canary_authorized'[\s\S]*?= 'true'/u);
  assert.match(
    migration,
    /CREATE POLICY faculty_invitations_candidate_handoff_lock[\s\S]*?WITH CHECK \(false\)/u,
  );
  assert.match(
    migration,
    /pg_catalog\.has_function_privilege\([\s\S]*?'lor_studio_app'[\s\S]*?faculty_candidate_auth_context_allows[\s\S]*?'EXECUTE'[\s\S]*?\)/u,
  );
});

test('reservation uses the database clock, serializes invitation state, and emits only bound metadata', () => {
  const reserve = body(migration, 'reserve_candidate_handoff');
  assert.match(reserve, /pg_catalog\.transaction_timestamp\(\)/u);
  assert.match(reserve, /pg_catalog\.date_trunc\(\s*'milliseconds'/u);
  assert.match(reserve, /candidate_maximum_lifetime_seconds NOT BETWEEN 60 AND 900/u);
  assert.match(reserve, /pg_catalog\.pg_advisory_xact_lock/u);
  assert.match(reserve, /FROM lor_studio\.faculty_invitations[\s\S]*?FOR UPDATE/u);
  assert.match(reserve, /current_invitation\.token_hash IS DISTINCT FROM candidate_token_hash/u);
  assert.match(reserve, /requires_otp_verification := current_invitation\.used_at IS NULL/u);
  assert.match(reserve, /current_invitation\.revoked_at IS NOT NULL/u);
  assert.match(reserve, /current_invitation\.expires_at <= command_at/u);
  assert.match(reserve, /faculty_otp_verification_receipts/u);
  assert.match(reserve, /faculty_otp_proof_revocations/u);
  assert.match(reserve, /pg_catalog\.count\(\*\) FILTER \(WHERE reservation\.expires_at > command_at\)/u);
  assert.match(reserve, /recent_reservation_count >= 20/u);
  assert.match(reserve, /active_reservation_count >= 5/u);
  assert.match(reserve, /handoff_expires_at := CASE/u);
  assert.match(reserve, /INSERT INTO lor_studio\.faculty_candidate_auth_handoff_reservations/u);
  assert.match(reserve, /missionmed\.lor\.faculty-candidate-auth-reservation-receipt\.v1/u);
  assert.match(reserve, /'replayed', false/u);
  assert.match(reserve, /LOR_FACULTY_CANDIDATE_HANDOFF_DENIED[\s\S]*?ERRCODE = 'P1311'/u);
  assert.doesNotMatch(reserve, /recommendation_case_(?:audit_events|protected_revision_states)/u);
});

test('redemption pins actor, case, invitation, token, nonce, revision, timestamps, and a single winner', () => {
  const redeem = body(migration, 'redeem_candidate_handoff');
  assert.match(redeem, /candidate_authenticated_subject !~ '\^wp:/u);
  assert.match(redeem, /pg_catalog\.pg_advisory_xact_lock/u);
  assert.match(redeem, /FROM lor_studio\.faculty_invitations[\s\S]*?FOR UPDATE/u);
  assert.match(
    redeem,
    /current_reservation\.token_hash IS DISTINCT FROM candidate_token_hash/u,
  );
  assert.match(
    redeem,
    /current_reservation\.case_id IS DISTINCT FROM current_invitation\.case_id/u,
  );
  assert.match(
    redeem,
    /current_reservation\.student_auth_subject IS DISTINCT FROM[\s\S]*?current_invitation\.student_auth_subject/u,
  );
  assert.match(
    redeem,
    /current_reservation\.invitation_revision IS DISTINCT FROM[\s\S]*?current_invitation\.revision/u,
  );
  assert.match(redeem, /current_reservation\.issued_at IS DISTINCT FROM candidate_issued_at/u);
  assert.match(redeem, /current_reservation\.expires_at IS DISTINCT FROM candidate_expires_at/u);
  assert.match(redeem, /command_at >= current_reservation\.expires_at/u);
  assert.match(redeem, /candidate_authenticated_subject = current_reservation\.student_auth_subject/u);
  assert.match(
    redeem,
    /current_invitation\.faculty_auth_subject IS DISTINCT FROM[\s\S]*?candidate_authenticated_subject/u,
  );
  assert.match(redeem, /faculty_otp_verification_receipts/u);
  assert.match(redeem, /faculty_otp_proof_revocations/u);
  assert.match(
    redeem,
    /EXISTS \([\s\S]*?faculty_candidate_auth_handoff_redemptions[\s\S]*?flow_nonce_hash = candidate_flow_nonce_hash/u,
  );
  assert.match(redeem, /INSERT INTO lor_studio\.faculty_candidate_auth_handoff_redemptions/u);
  assert.match(redeem, /missionmed\.lor\.faculty-candidate-auth-redemption-receipt\.v1/u);
  assert.match(redeem, /'replayed', false/u);
  assert.doesNotMatch(redeem, /recommendation_case_(?:audit_events|protected_revision_states)/u);
});

test('verified faculty re-entry is durable, exact-subject bound, and revocation aware', () => {
  assert.match(
    migration,
    /CREATE POLICY faculty_otp_verification_receipts_candidate_handoff_select/u,
  );
  assert.match(
    migration,
    /CREATE POLICY faculty_otp_proof_revocations_candidate_handoff_select/u,
  );
  assert.match(migration, /'requiresOtpVerification', requires_otp_verification/u);
  assert.match(migration, /'caseId', current_invitation\.case_id/u);
  assert.match(migration, /candidate_policy_count IS DISTINCT FROM 8/u);
});

test('rollback refuses live or divergent custody and restores the exact predecessor explicitly', () => {
  assert.doesNotMatch(rollback, /\bCASCADE\b/iu);
  assert.doesNotMatch(rollback, /\bDELETE\s+FROM\b/iu);
  assert.doesNotMatch(rollback, /\bTRUNCATE\b/iu);
  assert.match(
    rollback,
    /EXISTS \(\s*SELECT 1\s*FROM lor_studio\.faculty_candidate_auth_handoff_reservations/u,
  );
  assert.match(
    rollback,
    /EXISTS \(\s*SELECT 1\s*FROM lor_studio\.faculty_candidate_auth_handoff_redemptions/u,
  );
  assert.match(rollback, /reservation_columns IS DISTINCT FROM ARRAY/u);
  assert.match(rollback, /redemption_columns IS DISTINCT FROM ARRAY/u);
  assert.match(rollback, /reservation_constraints IS DISTINCT FROM ARRAY/u);
  assert.match(rollback, /redemption_constraints IS DISTINCT FROM ARRAY/u);
  assert.match(rollback, /candidate_indexes IS DISTINCT FROM ARRAY/u);
  assert.match(rollback, /attribute\.attacl IS NOT NULL/u);
  assert.match(rollback, /pg_catalog\.pg_publication_rel/u);
  assert.match(rollback, /pg_catalog\.pg_seclabel/u);
  assert.match(rollback, /relreplident <> 'd'/u);
  assert.match(rollback, /DROP POLICY faculty_invitations_candidate_handoff_lock/u);
  assert.match(
    rollback,
    /DROP POLICY faculty_otp_verification_receipts_candidate_handoff_select/u,
  );
  assert.match(
    rollback,
    /DROP POLICY faculty_otp_proof_revocations_candidate_handoff_select/u,
  );
  assert.match(rollback, /DROP TRIGGER faculty_candidate_auth_handoff_redemptions_append_only/u);
  assert.match(rollback, /DROP TABLE lor_studio\.faculty_candidate_auth_handoff_redemptions;/u);
  assert.match(rollback, /DROP TABLE lor_studio\.faculty_candidate_auth_handoff_reservations;/u);
  assert.match(rollback, /relation_count IS DISTINCT FROM 34/u);
  assert.match(rollback, /forced_rls_count IS DISTINCT FROM 34/u);
  assert.match(rollback, /definer_count IS DISTINCT FROM 30/u);
  assert.match(
    rollback,
    /regexp_replace\([\s\S]*?\\\|facultyCandidateAuthHandoff=20260826011500\$[\s\S]*?''/u,
  );
});
