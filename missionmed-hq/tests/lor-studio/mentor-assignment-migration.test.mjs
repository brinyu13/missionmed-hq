import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const MIGRATION = new URL(
  '../../scripts/lor-studio/migrations/20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.sql',
  import.meta.url,
);
const ROLLBACK = new URL(
  '../../scripts/lor-studio/rollbacks/20260826011700_f2_lor_1012_live_production_mentor_assignment_commands.rollback.sql',
  import.meta.url,
);
const PREDECESSOR = new URL(
  '../../scripts/lor-studio/migrations/20260826010500_f2_lor_1012_live_production_faculty_invitation_commands.sql',
  import.meta.url,
);
const migration = readFileSync(MIGRATION, 'utf8');
const rollback = readFileSync(ROLLBACK, 'utf8');
const predecessor = readFileSync(PREDECESSOR, 'utf8');

function body(sql, tag) {
  const startMarker = `AS $${tag}$`;
  const endMarker = `$${tag}$;`;
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${tag} body start`);
  assert.notEqual(end, -1, `missing ${tag} body end`);
  return sql.slice(start, end + endMarker.length);
}

function executableSql(sql) {
  return sql.replace(/^--.*$/gmu, '');
}

function assertBalancedDollarQuotes(sql) {
  const counts = new Map();
  for (const match of sql.matchAll(/\$[a-z_]*\$/gu)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  for (const [tag, count] of counts) assert.equal(count % 2, 0, tag);
}

function auditEventTypes(sql) {
  const match = sql.match(
    /ADD CONSTRAINT recommendation_case_audit_events_event_type_known CHECK \(event_type IN \(([\s\S]*?)\n\s*\)\);/u,
  );
  assert.notEqual(match, null, 'audit event constraint missing');
  return [...match[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1]);
}

test('117 is the exact fenced transactional successor of candidate handoff', () => {
  assert.match(migration, /^-- Migration: 20260826011700/u);
  assert.match(migration, /\nBEGIN;\n/u);
  assert.match(migration, /\nCOMMIT;\s*$/u);
  assert.match(migration, /IN ACCESS EXCLUSIVE MODE;/u);
  assert.match(migration, /target_provider IS DISTINCT FROM 'railway-postgres'/u);
  assert.match(
    migration,
    /target_environment_id IS DISTINCT FROM 'ed3353f7-bcc7-4e25-a000-3c9fc628a9a7'/u,
  );
  assert.match(migration, /\|facultyCandidateAuthHandoff=20260826011500'/u);
  assert.match(
    migration,
    /observed_sentinel \|\| '\|mentorAssignmentCommands=20260826011700'/u,
  );
  assert.match(migration, /definer_count IS DISTINCT FROM 32/u);
  assert.match(migration, /definer_count IS DISTINCT FROM 34/u);
  assertBalancedDollarQuotes(migration);
  assertBalancedDollarQuotes(rollback);
  const predecessorEvents = auditEventTypes(predecessor);
  const forwardEvents = auditEventTypes(migration);
  assert.deepEqual(auditEventTypes(rollback), predecessorEvents);
  assert.deepEqual(
    forwardEvents.filter((eventType) => !eventType.startsWith('mentor.assignment_')),
    predecessorEvents,
  );
  assert.deepEqual(
    forwardEvents.filter((eventType) => eventType.startsWith('mentor.assignment_')),
    ['mentor.assignment_issued', 'mentor.assignment_revoked'],
  );
});

test('two tightly allowlisted definers are command-owned, empty-search-path, and PUBLIC-revoked', () => {
  for (const signature of [
    ['assign_mentor_to_case', 'text, text, text, text, integer, text'],
    ['revoke_mentor_case_assignment', 'text, text, text, text, text'],
  ]) {
    assert.match(
      migration,
      new RegExp(
        `CREATE FUNCTION lor_studio\\.${signature[0]}\\([\\s\\S]*?\\)\\s+RETURNS jsonb[\\s\\S]*?SECURITY DEFINER\\s+SET search_path = ''`,
        'u',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `REVOKE ALL ON FUNCTION lor_studio\\.${signature[0]}\\([\\s\\S]*?\\) FROM PUBLIC`,
        'u',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `ALTER FUNCTION lor_studio\\.${signature[0]}\\([\\s\\S]*?\\) OWNER TO lor_studio_command_owner`,
        'u',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `GRANT EXECUTE ON FUNCTION lor_studio\\.${signature[0]}\\([\\s\\S]*?\\) TO lor_studio_app`,
        'u',
      ),
    );
  }
  assert.match(migration, /public_execute_count <> 0/u);
  assert.doesNotMatch(migration, /GRANT\s+(?:INSERT|UPDATE|DELETE)[\s\S]{0,180}TO lor_studio_app/iu);
});

test('trusted service context fixes every authority axis and cannot reuse browser identity', () => {
  const context = body(migration, 'mentor_assignment_context');
  for (const axis of [
    'transaction_isolation',
    'lor_studio.actor_role',
    'lor_studio.student_auth_subject',
    'lor_studio.resource_student_id',
    'lor_studio.case_id',
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
  ]) assert.match(context, new RegExp(axis.replaceAll('.', '\\.'), 'u'));
  assert.match(context, /CURRENT_USER = 'lor_studio_command_owner'/u);
  assert.match(context, /'service:lor-mentor-assignment-operator-v1'/u);
  assert.match(context, /'lor-mentor-assignment-operator-v1'/u);
  assert.match(context, /'mentor_assignment_administration'/u);
});

test('assignment validates subjects/case, permits only read, bounds expiry, serializes and binds audit', () => {
  const assign = body(migration, 'assign_mentor');
  assert.match(assign, /candidate_student_subject !~ '\^wp:/u);
  assert.match(assign, /candidate_mentor_subject !~ '\^wp:/u);
  assert.match(assign, /candidate_mentor_subject = candidate_student_subject/u);
  assert.match(assign, /candidate_maximum_lifetime_seconds NOT BETWEEN 300 AND 15552000/u);
  assert.match(assign, /current_assignment\.expires_at IS DISTINCT FROM\s+current_assignment\.assigned_at \+ pg_catalog\.make_interval\(\s+secs => candidate_maximum_lifetime_seconds/u);
  assert.match(assign, /pg_catalog\.transaction_timestamp\(\)/u);
  assert.match(assign, /pg_catalog\.pg_advisory_xact_lock/gmu);
  assert.match(assign, /FROM lor_studio\.recommendation_cases/u);
  assert.match(assign, /student_auth_subject = candidate_student_subject/u);
  assert.match(assign, /assignment_id_value := 'mentor_service_assignment_'/u);
  assert.match(assign, /'operation', 'read'/u);
  assert.match(assign, /'missionmed\.lor\.mentor-auth-uid\.v1'/u);
  assert.match(assign, /assignment_hash_value := lor_studio\.canonical_jsonb_sha256/u);
  assert.match(assign, /LOR_MENTOR_ASSIGNMENT_ALREADY_ACTIVE/u);
  assert.match(assign, /INSERT INTO lor_studio\.mentor_case_assignments/u);
  assert.match(assign, /INSERT INTO lor_studio\.recommendation_case_audit_events/u);
  assert.match(assign, /'mentor\.assignment_issued'/u);
  assert.match(assign, /'replayed', replayed_value/u);
  assert.doesNotMatch(assign, /\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/iu);
});

test('revocation is exact-assignment, append-only, serialized, idempotent, and audit-bound', () => {
  const revoke = body(migration, 'revoke_mentor');
  assert.match(revoke, /candidate_assignment_id !~ '\^mentor_service_assignment_/u);
  assert.match(revoke, /candidate_reason_code !~ '\^\[A-Z0-9_:-\]/u);
  assert.match(revoke, /pg_catalog\.pg_advisory_xact_lock/gmu);
  assert.match(revoke, /assignment\.assignment_id = candidate_assignment_id/u);
  assert.match(revoke, /assignment\.case_id = candidate_case_id/u);
  assert.match(revoke, /assignment\.student_auth_subject = candidate_student_subject/u);
  assert.match(revoke, /revocation_hash_value := lor_studio\.canonical_jsonb_sha256/u);
  assert.match(revoke, /LOR_MENTOR_IDEMPOTENCY_CONFLICT/u);
  assert.match(revoke, /INSERT INTO lor_studio\.mentor_case_assignment_revocations/u);
  assert.match(revoke, /INSERT INTO lor_studio\.recommendation_case_audit_events/u);
  assert.match(revoke, /'mentor\.assignment_revoked'/u);
  assert.doesNotMatch(revoke, /\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/iu);
});

test('rollback refuses command-owned custody and restores the predecessor without broad destruction', () => {
  const executable = executableSql(rollback);
  assert.doesNotMatch(executable, /\bCASCADE\b/iu);
  assert.doesNotMatch(executable, /\bDELETE\s+FROM\b/iu);
  assert.doesNotMatch(executable, /\bTRUNCATE\b/iu);
  assert.match(rollback, /owned_assignment_count <> 0/u);
  assert.match(rollback, /owned_revocation_count <> 0/u);
  assert.match(rollback, /owned_audit_count <> 0/u);
  assert.match(rollback, /DROP FUNCTION lor_studio\.assign_mentor_to_case/u);
  assert.match(rollback, /DROP FUNCTION lor_studio\.revoke_mentor_case_assignment/u);
  assert.match(rollback, /DROP POLICY mentor_case_assignments_service_insert/u);
  assert.match(rollback, /ADD CONSTRAINT recommendation_case_audit_events_event_type_known/u);
  assert.match(rollback, /definer_count IS DISTINCT FROM 32/u);
  assert.match(rollback, /'\|mentorAssignmentCommands=20260826011700'/u);
});
