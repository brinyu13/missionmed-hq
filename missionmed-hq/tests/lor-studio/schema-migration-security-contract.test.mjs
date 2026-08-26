import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptDirectory = path.resolve(testDirectory, '..', '..', 'scripts', 'lor-studio');
const foundationPath = path.join(
  scriptDirectory,
  'migrations',
  '20260820180700_f2_lor_1012_schema_foundation.sql',
);
const rlsPath = path.join(
  scriptDirectory,
  'migrations',
  '20260820180800_f2_lor_1012_rls_projection_grants.sql',
);
const rlsRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260820180800_f2_lor_1012_rls_projection_grants.rollback.sql',
);
const foundationRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260820180700_f2_lor_1012_schema_foundation.rollback.sql',
);
const productionFoundationPath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010000_f2_lor_1012_production_schema_foundation.sql',
);
const productionRlsPath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010100_f2_lor_1012_production_rls_projection_grants.sql',
);
const identityScopePath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010200_f2_lor_1012_identity_scope_commands.sql',
);
const productionIdentityScopePath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010300_f2_lor_1012_production_identity_scope_commands.sql',
);
const facultyInvitationPath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010400_f2_lor_1012_faculty_invitation_commands.sql',
);
const productionFacultyInvitationPath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010500_f2_lor_1012_production_faculty_invitation_commands.sql',
);

const RELATIONS = Object.freeze([
  'student_auth_bindings',
  'student_auth_binding_revocations',
  'recommendation_cases',
  'recommendation_case_creation_reservations',
  'recommendation_case_audit_events',
  'recommendation_case_protected_revision_states',
  'recommendation_case_write_receipts',
  'faculty_invitations',
  'faculty_otp_challenges',
  'faculty_otp_challenge_revocations',
  'faculty_otp_verification_receipts',
  'faculty_otp_proof_revocations',
  'consent_receipts',
  'waiver_receipts',
  'faculty_private_content',
  'released_student_documents',
  'recommendation_case_private_write_receipts',
  'administrative_case_grants',
  'administrative_case_grant_revocations',
  'mentor_case_assignments',
  'mentor_case_assignment_revocations',
  'writer_depot_artifacts',
  'ai_generation_runs',
  'ai_letter_proposals',
  'ai_proposal_decisions',
  'deletion_intents',
  'deletion_hold_releases',
  'deletion_receipts',
]);

const APPROVED_SECURITY_DEFINER_FUNCTIONS = Object.freeze([
  'commit_student_case_create(jsonb,text,text,jsonb,text,jsonb)',
  'commit_student_builder_autosave(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_builder_complete(jsonb,bigint,text,text,jsonb,text,jsonb)',
  'commit_student_consent_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'commit_student_waiver_receipt(jsonb,bigint,text,text,jsonb,text,jsonb,jsonb)',
  'read_mentor_case_projection()',
  'read_faculty_case_projection()',
  'commit_faculty_final_document_release(bigint,text,text,text,jsonb,text)',
]);

const APPROVED_IDENTITY_SCOPE_DEFINERS = Object.freeze([
  'ensure_student_auth_binding(text,text,text)',
  'revoke_student_auth_binding(text,text)',
  'resolve_faculty_case_scope(text,text,text)',
  'resolve_mentor_case_scope(text,text,text)',
]);

const APPROVED_FACULTY_INVITATION_DEFINERS = Object.freeze([
  'issue_faculty_invitation(text,bigint,text,text,text,text,text,timestamptz,timestamptz,integer,bigint,bigint,text,text)',
  'resend_faculty_invitation_otp(text,text,text,text,timestamptz,text,text)',
  'revoke_faculty_invitation(text,text,text)',
  'verify_faculty_invitation(text,text,text,text,text,text)',
  'commit_faculty_invitation_delivery(text,text,text,text,text)',
  'resolve_lor_actor_case_access(text,text)',
]);

const IDENTITY_SCOPE_POLICIES = Object.freeze([
  'student_auth_bindings_identity_command_select',
  'student_auth_bindings_identity_command_insert',
  'student_auth_binding_revocations_identity_command_select',
  'student_auth_binding_revocations_identity_command_insert',
  'faculty_invitations_scope_resolution_select',
  'faculty_otp_verification_scope_resolution_select',
  'faculty_otp_revocations_scope_resolution_select',
  'mentor_assignments_scope_resolution_select',
  'mentor_assignment_revocations_scope_resolution_select',
]);

function functionDeclarations(sql) {
  return [...sql.matchAll(
    /^CREATE FUNCTION lor_studio\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*\nRETURNS([\s\S]*?)^AS \$[a-z0-9_]*\$/gmu,
  )].map((match) => {
    const argumentTypes = match[2].trim() === ''
      ? []
      : match[2].split(',').map((argument) => argument.trim().split(/\s+/u).at(-1));
    return Object.freeze({
      identity: `${match[1]}(${argumentTypes.join(',')})`,
      properties: match[3],
    });
  });
}

function commandOwnerFunctionIdentities(sql) {
  return [...sql.matchAll(
    /^ALTER FUNCTION lor_studio\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s+OWNER TO lor_studio_command_owner;/gmu,
  )].map((match) => {
    const argumentTypes = match[2].trim() === ''
      ? []
      : match[2].split(',').map((argument) => argument.trim().split(/\s+/u).at(-1));
    return `${match[1]}(${argumentTypes.join(',')})`;
  });
}

function declaredFunctionBlock(sql, functionName) {
  let start = sql.indexOf(`CREATE FUNCTION lor_studio.${functionName}(`);
  if (start === -1) {
    start = sql.indexOf(`CREATE OR REPLACE FUNCTION lor_studio.${functionName}(`);
  }
  assert.notEqual(start, -1, functionName);
  const candidateEnds = [
    sql.indexOf('\nCREATE FUNCTION lor_studio.', start + 1),
    sql.indexOf('\nCREATE OR REPLACE FUNCTION lor_studio.', start + 1),
  ].filter((candidate) => candidate !== -1);
  const end = candidateEnds.length === 0 ? -1 : Math.min(...candidateEnds);
  return sql.slice(start, end === -1 ? undefined : end);
}

function declaredPolicyBlock(sql, policyName) {
  const start = sql.indexOf(`CREATE POLICY ${policyName}\n`);
  assert.notEqual(start, -1, policyName);
  const end = sql.indexOf('\nCREATE POLICY ', start + 1);
  return sql.slice(start, end === -1 ? undefined : end);
}

test('foundation is executable SQL with the exact relation inventory', async () => {
  const sql = await readFile(foundationPath, 'utf8');
  assert.doesNotMatch(sql, /DESIGN ONLY|F2-LOR-1009 schema design is non-executable/iu);
  assert.match(sql, /CREATE SCHEMA lor_studio/u);
  assert.match(
    sql,
    /CREATE ROLE\s+lor_studio_app[\s\S]*?NOLOGIN[\s\S]*?NOINHERIT[\s\S]*?NOBYPASSRLS/u,
  );
  const versionGuard = sql.indexOf("current_setting('server_version_num')::integer / 10000");
  const firstPersistentMutation = sql.indexOf('CREATE ROLE lor_studio_app');
  assert.ok(versionGuard > 0 && versionGuard < firstPersistentMutation);
  assert.match(sql, /NOT IN \(16, 18\)/u);
  for (const relation of RELATIONS) {
    assert.match(sql, new RegExp(`CREATE TABLE lor_studio\\.${relation} \\(`, 'u'), relation);
  }
  const observed = [...sql.matchAll(/^CREATE TABLE lor_studio\.([a-z0-9_]+) \(/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(observed, RELATIONS);
});

test('foundation defines immutable safety and truth guards', async () => {
  const sql = await readFile(foundationPath, 'utf8');
  for (const fragment of [
    'student_record_is_safe',
    'audit_event_is_metadata',
    'reject_append_only_mutation',
    'enforce_recommendation_case_update',
    'enforce_faculty_private_content_update',
    'enforce_released_student_document_insert',
    'enforce_faculty_invitation_update',
    'enforce_faculty_otp_challenge_insert',
    'enforce_faculty_otp_verification_receipt_insert',
    'enforce_ai_proposal_decision_insert',
  ]) {
    assert.match(sql, new RegExp(`lor_studio\\.${fragment}`, 'u'), fragment);
  }
  assert.match(sql, /FOR UPDATE/u, 'release and waiver truth checks must serialize');
  for (const functionName of [
    'enforce_ai_generation_run_insert',
    'enforce_ai_letter_proposal_insert',
  ]) {
    const start = sql.indexOf(`CREATE FUNCTION lor_studio.${functionName}()`);
    const end = sql.indexOf('\nCREATE FUNCTION lor_studio.', start + 1);
    assert.notEqual(start, -1, functionName);
    const body = sql.slice(start, end === -1 ? undefined : end);
    assert.match(body, /status NOT IN \('delivered', 'closed', 'cancelled'\)/u, functionName);
    assert.match(body, /pg_catalog\.pg_advisory_xact_lock/u, functionName);
    assert.doesNotMatch(body, /FROM pg_catalog\.pg_locks AS held_lock/u, functionName);
    assert.match(
      body,
      /current_setting\('transaction_isolation', true\) IS DISTINCT FROM 'read committed'/u,
      functionName,
    );
    assert.match(body, /'missionmed\.lor\.case-lock\.v1'/u, functionName);
    for (const releaseField of [
      'released_at',
      'release_document_id',
      'release_document_hash',
      'released_at_revision',
      'release_waiver_receipt_id',
    ]) {
      assert.match(
        body,
        new RegExp(`recommendation_case\\.${releaseField} IS NULL`, 'u'),
        `${functionName}: ${releaseField}`,
      );
    }
  }
});

test('case serialization keys are collision-framed without PostgreSQL-invalid NUL text', async () => {
  const [foundation, rls] = await Promise.all([
    readFile(foundationPath, 'utf8'),
    readFile(rlsPath, 'utf8'),
  ]);
  const combined = `${foundation}\n${rls}`;
  assert.doesNotMatch(combined, /pg_catalog\.chr\s*\(\s*0\s*\)/u);
  assert.equal(
    [...combined.matchAll(/pg_catalog\.pg_advisory_xact_lock\s*\(/gu)].length,
    7,
  );
  assert.equal(
    [...combined.matchAll(
      /pg_catalog\.jsonb_build_array\s*\(\s*'missionmed\.lor\.case-lock\.v1'/gu,
    )].length,
    7,
  );
});

test('RLS migration grants only the two NOLOGIN product roles and eight approved definers', async () => {
  const sql = await readFile(rlsPath, 'utf8');
  assert.doesNotMatch(sql, /\b(?:TO|GRANT)\s+(?:anon|authenticated)\b/iu);
  assert.doesNotMatch(sql, /GRANT\s+[^;]+\s+TO\s+PUBLIC/iu);
  assert.match(sql, /REVOKE ALL ON SCHEMA lor_studio FROM PUBLIC/u);
  assert.match(sql, /GRANT USAGE ON SCHEMA lor_studio TO lor_studio_app/u);
  assert.match(
    sql,
    /CREATE ROLE\s+lor_studio_command_owner[\s\S]*?NOLOGIN[\s\S]*?NOINHERIT[\s\S]*?NOBYPASSRLS/u,
  );
  assert.match(sql, /ALTER ROLE\s+lor_studio_command_owner\s+SET search_path\s*=\s*pg_catalog/u);
  const definers = functionDeclarations(sql)
    .filter((declaration) => /SECURITY\s+DEFINER/u.test(declaration.properties));
  assert.deepEqual(definers.map((declaration) => declaration.identity), APPROVED_SECURITY_DEFINER_FUNCTIONS);
  for (const declaration of definers) {
    assert.match(declaration.properties, /SET search_path = ''/u, declaration.identity);
  }
  assert.deepEqual(commandOwnerFunctionIdentities(sql), APPROVED_SECURITY_DEFINER_FUNCTIONS);
  assert.match(sql, /CREATE VIEW lor_studio\.student_recommendation_case_projection/u);
  assert.match(sql, /security_invoker\s*=\s*true/iu);
  for (const relation of RELATIONS) {
    assert.match(sql, new RegExp(`ALTER TABLE lor_studio\\.${relation} ENABLE ROW LEVEL SECURITY`, 'u'));
    assert.match(sql, new RegExp(`ALTER TABLE lor_studio\\.${relation} FORCE ROW LEVEL SECURITY`, 'u'));
  }
});

test('RLS policy text carries every server-controlled identity and capability axis', async () => {
  const sql = await readFile(rlsPath, 'utf8');
  for (const axis of [
    'request.jwt.claim.sub',
    'lor_studio.student_auth_subject',
    'lor_studio.actor_role',
    'lor_studio.resource_student_id',
    'lor_studio.case_id',
    'lor_studio.operation',
    'lor_studio.purpose',
    'lor_studio.invitation_id',
    'lor_studio.assignment_id',
    'lor_studio.administrative_grant_id',
    'lor_studio.entitlement_verified',
    'lor_studio.lor_enabled',
    'lor_studio.canary_authorized',
  ]) {
    assert.match(sql, new RegExp(axis.replaceAll('.', '\\.')), axis);
  }
  assert.match(sql, /NULLIF\([^)]*current_setting[^)]*''/u);
  assert.match(sql, /WITH CHECK/u);
  for (const functionName of [
    'student_context_allows',
    'faculty_context_allows',
    'mentor_context_allows',
    'operational_content_context_allows',
  ]) {
    const start = sql.indexOf(`CREATE FUNCTION lor_studio.${functionName}(`);
    const end = sql.indexOf('\nCREATE FUNCTION lor_studio.', start + 1);
    assert.notEqual(start, -1, functionName);
    const body = sql.slice(start, end === -1 ? undefined : end);
    assert.match(
      body,
      /current_setting\('transaction_isolation', true\) = 'read committed'/u,
      functionName,
    );
  }
  for (const policyName of [
    'case_creation_reservations_student_select',
    'case_creation_reservations_student_insert',
  ]) {
    const start = sql.indexOf(`CREATE POLICY ${policyName}`);
    const end = sql.indexOf('\nCREATE POLICY ', start + 1);
    assert.notEqual(start, -1, policyName);
    const body = sql.slice(start, end === -1 ? undefined : end);
    assert.match(
      body,
      /current_setting\('transaction_isolation', true\) = 'read committed'/u,
      policyName,
    );
  }
  const reservationInsertStart = sql.indexOf(
    'CREATE POLICY case_creation_reservations_student_insert',
  );
  const reservationInsertEnd = sql.indexOf('\nCREATE POLICY ', reservationInsertStart + 1);
  const reservationInsert = sql.slice(
    reservationInsertStart,
    reservationInsertEnd === -1 ? undefined : reservationInsertEnd,
  );
  assert.match(reservationInsert, /'missionmed\.lor\.case-creation-key\.v1'/u);
  assert.match(reservationInsert, /creation_ref = 'case_creation_' \|\|/u);
  assert.match(reservationInsert, /actor_ref = 'actor_' \|\|/u);
  assert.match(reservationInsert, /request_hash = lor_studio\.canonical_jsonb_sha256/u);
  assert.match(reservationInsert, /transaction_id = pg_catalog\.pg_current_xact_id\(\)::text/u);
  assert.match(reservationInsert, /reserved_at = pg_catalog\.statement_timestamp\(\)/u);
  assert.match(reservationInsert, /case_id <> builder_session_id/u);
});

test('rollback is reverse ordered, local-harness guarded, and empty-schema only', async () => {
  const [rlsRollback, foundationRollback] = await Promise.all([
    readFile(rlsRollbackPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
  ]);
  for (const sql of [rlsRollback, foundationRollback]) {
    assert.match(sql, /\^lorh_db_\(\[a-f0-9\]\{20\}\)\$/u);
    assert.match(sql, /\^lorh_admin_\(\[a-f0-9\]\{20\}\)\$/u);
    assert.match(sql, /inet_server_addr\(\) IS NOT NULL/u);
    assert.match(sql, /listen_addresses/u);
    assert.match(sql, /f2lorpg-/u);
    assert.match(sql, /expected_relations constant text\[\] := ARRAY/u);
    assert.match(sql, /observed_relations IS DISTINCT FROM expected_relations/u);
    for (const relation of RELATIONS) {
      assert.match(sql, new RegExp(`'${relation}'`, 'u'), `rollback inventory: ${relation}`);
    }
    assert.match(sql, /refuses nonempty relation/u);
  }
  assert.match(rlsRollback, /DROP VIEW lor_studio\.student_recommendation_case_projection/u);
  assert.match(rlsRollback, /DROP FUNCTION lor_studio\.student_write_axes_satisfied\(\)/u);
  assert.match(rlsRollback, /DROP POLICY/u);
  assert.match(rlsRollback, /DISABLE ROW LEVEL SECURITY/u);
  assert.doesNotMatch(rlsRollback, /DROP SCHEMA/u);
  assert.match(foundationRollback, /DROP SCHEMA lor_studio;/u);
  assert.doesNotMatch(foundationRollback, /\bCASCADE\b/u);
  assert.match(foundationRollback, /DROP ROLE lor_studio_app/u);
});

test('DR-133 production baseline is target-bound while preserving accepted DR-120 bodies byte-for-byte', async () => {
  const [foundation, rls, productionFoundation, productionRls] = await Promise.all([
    readFile(foundationPath, 'utf8'),
    readFile(rlsPath, 'utf8'),
    readFile(productionFoundationPath, 'utf8'),
    readFile(productionRlsPath, 'utf8'),
  ]);

  const foundationBodyMarker = 'ALTER DEFAULT PRIVILEGES IN SCHEMA lor_studio';
  const rlsBodyMarker = 'LOCK TABLE\n';
  assert.equal(
    productionFoundation.slice(productionFoundation.indexOf(foundationBodyMarker)),
    foundation.slice(foundation.indexOf(foundationBodyMarker)),
  );
  assert.equal(
    productionRls.slice(productionRls.indexOf(rlsBodyMarker)),
    rls.slice(rls.indexOf(rlsBodyMarker)),
  );

  for (const sql of [productionFoundation, productionRls]) {
    assert.match(sql, /Authority: F2-LOR-1012 \/ DR-133/u);
    for (const setting of [
      'target_provider',
      'target_project_id',
      'target_environment_id',
      'target_service_id',
      'target_database_name',
      'target_region',
      'target_decision_record',
      'target_data_copied',
    ]) {
      assert.match(sql, new RegExp(`missionmed\\.lor\\.${setting}`, 'u'), setting);
    }
    for (const exactIdentity of [
      'railway-postgres',
      '29afe885-b9b1-425d-8fd8-8611cd275409',
      'f5705d38-393c-4176-9cc2-0d1dbad42c93',
      'b49a52e7-df15-4417-b67a-a64403aa5db7',
      'railway',
      'postgres',
      'us-west2',
      'DR-133',
      'false',
    ]) {
      assert.match(sql, new RegExp(exactIdentity, 'u'), exactIdentity);
    }
    for (const deniedTarget of [
      'mftguikkftmrxjxrkdln',
      'fglyvdykwgbuivikqoah',
    ]) {
      assert.match(sql, new RegExp(deniedTarget, 'u'), deniedTarget);
    }
    assert.match(sql, /session_user IS DISTINCT FROM current_user/u);
    assert.match(sql, /database_owner IS DISTINCT FROM current_user/u);
    assert.match(sql, /inet_server_addr\(\) IS NULL/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '10\.0\.0\.0\/8'/u);
    assert.match(sql, /current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
    assert.match(sql, /FROM pg_catalog\.pg_stat_ssl AS ssl_session/u);
    assert.match(sql, /ssl_session\.pid = pg_catalog\.pg_backend_pid\(\)/u);
    assert.match(sql, /AND ssl_session\.ssl/u);
    assert.match(sql, /missionmed\.lor\.railway-postgres-target\.v1/u);
    assert.match(sql, /foundation=20260825010000/u);
  }

  assert.match(productionFoundation, /requires a fresh lor_studio schema/u);
  assert.match(productionRls, /observed_sentinel IS DISTINCT FROM expected_sentinel/u);
});

test('DR-133 identity bootstrap and actor-scope ABI is DB-owned, allowlisted, and fail closed', async () => {
  const sql = await readFile(identityScopePath, 'utf8');
  const declarations = functionDeclarations(sql);
  const definers = declarations.filter((declaration) => (
    /SECURITY\s+DEFINER/u.test(declaration.properties)
  ));

  assert.deepEqual(
    definers.map((declaration) => declaration.identity),
    APPROVED_IDENTITY_SCOPE_DEFINERS,
  );
  assert.deepEqual(
    commandOwnerFunctionIdentities(sql),
    APPROVED_IDENTITY_SCOPE_DEFINERS,
  );
  for (const declaration of definers) {
    assert.match(declaration.properties, /SET search_path = ''/u, declaration.identity);
  }
  for (const policy of IDENTITY_SCOPE_POLICIES) {
    assert.match(sql, new RegExp(`CREATE POLICY ${policy}`, 'u'), policy);
  }
  for (const functionIdentity of APPROVED_IDENTITY_SCOPE_DEFINERS) {
    const escaped = functionIdentity.replaceAll(/[()[\]]/gu, '\\$&').replaceAll(',', ', ');
    assert.match(
      sql,
      new RegExp(`REVOKE ALL ON FUNCTION lor_studio\\.${escaped} FROM PUBLIC`, 'u'),
      functionIdentity,
    );
  }
  assert.match(sql, /canonical_uid := pg_catalog\.gen_random_uuid\(\)/u);
  assert.doesNotMatch(sql, /canonical_wp_auth_uid/u);
  assert.doesNotMatch(sql, /missionmed\.lor\.student-auth-uid\.v1/u);
  assert.doesNotMatch(sql, /candidate_(?:auth_)?uid/iu);
  assert.doesNotMatch(sql, /rotate_student_auth_binding/u);
  assert.match(sql, /LOR_IDENTITY_REBIND_REQUIRES_SUCCESSOR_AUTHORITY/u);
  assert.match(sql, /trusted_service_actor[\s\S]*wordpress-admission-v2/u);
  assert.match(sql, /identity_resolution_verified/u);
  assert.match(sql, /FROM pg_catalog\.pg_auth_members AS membership/u);
  assert.match(sql, /granted_role\.rolname IN \('lor_studio_app', 'lor_studio_command_owner'\)/u);
  assert.match(sql, /faculty_otp_proof_revocations/u);
  assert.match(sql, /mentor_case_assignment_revocations/u);
  assert.match(sql, /eligible_count <> 1/u);
  assert.match(sql, /candidate_operation <> ALL \(ARRAY\['read', 'save'\]::text\[\]\)/u);
  assert.doesNotMatch(sql, /'release'/u);
  assert.match(sql, /pg_catalog\.length\(candidate_subject\) > 200/u);
  assert.match(sql, /pg_catalog\.length\(candidate_faculty_subject\) > 200/u);
  assert.match(sql, /pg_catalog\.length\(candidate_mentor_subject\) > 200/u);
  assert.match(sql, /pg_catalog\.length\(assignment\.purpose\) BETWEEN 1 AND 160/u);
  assert.match(sql, /identityScope=20260825010200/u);
  assert.doesNotMatch(sql, /\b(?:TO|GRANT)\s+(?:anon|authenticated|service_role)\b/iu);
  assert.doesNotMatch(sql, /GRANT\s+[^;]+\s+TO\s+PUBLIC/iu);
  assert.doesNotMatch(sql, /\bCASCADE\b/iu);
});

test('DR-133 production identity/scope migration preserves the reviewed local command body', async () => {
  const [localSql, productionSql] = await Promise.all([
    readFile(identityScopePath, 'utf8'),
    readFile(productionIdentityScopePath, 'utf8'),
  ]);
  const bodyMarker = 'LOCK TABLE\n';
  assert.equal(
    productionSql.slice(productionSql.indexOf(bodyMarker)).replaceAll(
      'identityScope=20260825010300',
      'identityScope=20260825010200',
    ).trimEnd(),
    localSql.slice(localSql.indexOf(bodyMarker)).trimEnd(),
  );
  for (const required of [
    'missionmed.lor.railway-postgres-target.v1',
    '29afe885-b9b1-425d-8fd8-8611cd275409',
    'f5705d38-393c-4176-9cc2-0d1dbad42c93',
    'b49a52e7-df15-4417-b67a-a64403aa5db7',
    'mftguikkftmrxjxrkdln',
    'fglyvdykwgbuivikqoah',
    'foundation=20260825010000',
    'identityScope=20260825010300',
  ]) {
    assert.match(productionSql, new RegExp(required.replaceAll('.', '\\.'), 'u'), required);
  }
  assert.match(productionSql, /inet_server_addr\(\) IS NULL/u);
  assert.match(productionSql, /current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
  assert.match(productionSql, /observed_sentinel IS DISTINCT FROM expected_sentinel/u);
});

test('faculty invitation successor exposes only the six exact DB-owned command surfaces', async () => {
  const sql = await readFile(facultyInvitationPath, 'utf8');
  const declarations = functionDeclarations(sql);
  const definers = declarations.filter((declaration) => (
    /SECURITY\s+DEFINER/u.test(declaration.properties)
  ));
  assert.deepEqual(
    definers.map((declaration) => declaration.identity),
    APPROVED_FACULTY_INVITATION_DEFINERS,
  );
  assert.deepEqual(
    commandOwnerFunctionIdentities(sql),
    APPROVED_FACULTY_INVITATION_DEFINERS,
  );
  for (const declaration of definers) {
    assert.match(declaration.properties, /SET search_path = ''/u, declaration.identity);
  }
  assert.match(sql, /CREATE TABLE lor_studio\.faculty_invitation_command_receipts/u);
  assert.match(sql, /ALTER TABLE lor_studio\.faculty_invitation_command_receipts FORCE ROW LEVEL SECURITY/u);
  assert.match(sql, /faculty_invitation_command_receipts_append_only/u);
  assert.match(sql, /relation_count IS DISTINCT FROM 29/u);
  assert.match(sql, /definer_count IS DISTINCT FROM 18/u);
  assert.match(sql, /identityScope=20260825010200/u);
  assert.match(sql, /facultyInvitationCommands=20260825010400/u);
  assert.doesNotMatch(sql, /\b(?:TO|GRANT)\s+(?:anon|authenticated|service_role)\b/iu);
  assert.doesNotMatch(sql, /GRANT\s+[^;]+\s+TO\s+PUBLIC/iu);
  assert.doesNotMatch(sql, /\bCASCADE\b/iu);
});

test('faculty invitation commands enforce revision, server resolution, safe receipts, and DB admission', async () => {
  const sql = await readFile(facultyInvitationPath, 'utf8');
  const issue = declaredFunctionBlock(sql, 'issue_faculty_invitation');
  const resend = declaredFunctionBlock(sql, 'resend_faculty_invitation_otp');
  const revoke = declaredFunctionBlock(sql, 'revoke_faculty_invitation');
  const verify = declaredFunctionBlock(sql, 'verify_faculty_invitation');
  const delivery = declaredFunctionBlock(sql, 'commit_faculty_invitation_delivery');
  const resolver = declaredFunctionBlock(sql, 'resolve_lor_actor_case_access');
  const durableFacultyContext = declaredFunctionBlock(sql, 'faculty_context_allows');
  const caseUpdatePolicy = declaredPolicyBlock(
    sql,
    'recommendation_cases_invitation_command_update',
  );
  const invitationUpdatePolicy = declaredPolicyBlock(
    sql,
    'faculty_invitations_invitation_command_update',
  );
  const caseUpdateCheck = caseUpdatePolicy.slice(caseUpdatePolicy.indexOf('\nWITH CHECK ('));
  const invitationUpdateCheck = invitationUpdatePolicy.slice(
    invitationUpdatePolicy.indexOf('\nWITH CHECK ('),
  );

  assert.match(issue, /candidate_expected_revision bigint/u);
  assert.match(issue, /current_case\.revision IS DISTINCT FROM candidate_expected_revision/u);
  assert.match(issue, /LOR_FACULTY_INVITATION_STALE_REVISION/u);
  assert.match(issue, /ERRCODE = 'P1306'/u);
  assert.match(issue, /current_case\.status NOT IN \('draft', 'faculty_invited'\)/u);
  assert.match(issue, /used_at IS NULL[\s\S]*revoked_at IS NULL[\s\S]*expires_at > command_at/u);

  assert.match(resend, /candidate_recipient_email_hash text/u);
  assert.doesNotMatch(resend, /candidate_invitation_id/u);
  assert.match(resend, /active_invitation_count IS DISTINCT FROM 1::bigint/u);
  assert.match(resend, /current_invitation\.recipient_email_hash <>[\s\S]*candidate_recipient_email_hash/u);
  assert.match(resend, /set_config\([\s\S]*'lor_studio\.invitation_id', current_invitation\.invitation_id/u);
  assert.equal(resend.match(/\bFOR UPDATE;/gu)?.length, 1);

  assert.doesNotMatch(revoke, /candidate_invitation_id/u);
  assert.match(revoke, /active_invitation_count IS DISTINCT FROM 1::bigint/u);
  assert.match(revoke, /set_config\([\s\S]*'lor_studio\.invitation_id', current_invitation\.invitation_id/u);
  assert.equal(revoke.match(/\bFOR UPDATE;/gu)?.length, 1);

  for (const operation of [
    'resend_faculty_invitation_otp',
    'revoke_faculty_invitation',
    'commit_faculty_invitation_delivery',
  ]) {
    assert.match(caseUpdatePolicy, new RegExp(operation, 'u'), operation);
    assert.doesNotMatch(caseUpdateCheck, new RegExp(operation, 'u'), operation);
  }
  assert.match(invitationUpdatePolicy, /commit_faculty_invitation_delivery/u);
  assert.doesNotMatch(invitationUpdateCheck, /commit_faculty_invitation_delivery/u);
  assert.match(caseUpdatePolicy, /reserve_faculty_invitation_delivery/u);
  assert.doesNotMatch(caseUpdateCheck, /reserve_faculty_invitation_delivery/u);
  assert.match(invitationUpdatePolicy, /reserve_faculty_invitation_delivery/u);
  assert.doesNotMatch(invitationUpdateCheck, /reserve_faculty_invitation_delivery/u);

  assert.match(sql, /delivery_action text/u);
  assert.match(sql, /faculty\.invitation\.delivery_pending/u);
  assert.match(sql, /faculty\.invitation\.delivery_unknown/u);
  assert.match(delivery, /pg_catalog\.pg_advisory_xact_lock/u);
  assert.match(delivery, /reserve_faculty_invitation_delivery/u);
  assert.match(delivery, /mark_faculty_invitation_delivery_unknown/u);
  assert.match(delivery, /'dispatchGranted', true/u);
  assert.match(delivery, /'dispatchGranted', false/u);
  assert.match(delivery, /'status', 'pending'/u);
  assert.match(delivery, /'status', 'unknown'/u);
  assert.match(delivery, /'status', 'accepted'/u);
  assert.match(delivery, /stored_unknown\.receipt_id IS NOT NULL/u);
  assert.match(delivery, /stored_delivery\.receipt_id IS NOT NULL/u);
  assert.match(delivery, /candidate_delivery_value !~ '\^\[a-f0-9\]\{64\}\$'/u);
  assert.doesNotMatch(delivery, /recipient_email|token_hash|otp_code/u);

  for (const command of [issue, resend, revoke, verify, delivery]) {
    assert.match(
      command,
      /date_trunc\(\s*'milliseconds', pg_catalog\.transaction_timestamp\(\)\s*\)/u,
    );
  }

  assert.doesNotMatch(verify, /candidate_case_id/u);
  assert.doesNotMatch(verify, /request\.jwt\.claim\.sub/u);
  assert.match(verify, /candidate_otp_code text/u);
  assert.match(verify, /candidate_otp_code !~ '\^\[0-9\]\{6\}\$'/u);
  assert.match(verify, /lor-studio:otp-attempt:' \|\| current_challenge\.challenge_id/u);
  assert.match(verify, /database_otp_proof_ref := lor_studio\.canonical_jsonb_sha256/u);
  assert.match(verify, /missionmed\.lor\.database-otp-proof\.v1/u);
  assert.match(verify, /command_at, current_challenge\.expires_at, false/u);
  assert.match(verify, /database_verified_otp_challenge/u);
  assert.match(verify, /missionmed\.lor\.faculty-auth-uid\.v1:/u);
  assert.match(verify, /next_failed_attempts := LEAST\(/u);
  assert.doesNotMatch(verify, /pg_catalog\.least/u);
  assert.match(verify, /pg_catalog\.substr\(faculty_uid_hex, 9, 4\) \|\| '-5'/u);
  assert.match(verify, /pg_catalog\.substr\(faculty_uid_hex, 14, 3\) \|\| '-8'/u);
  assert.match(verify, /set_config\([\s\S]*'lor_studio\.case_id', current_invitation\.case_id/u);
  assert.match(verify, /set_config\([\s\S]*'lor_studio\.resource_student_id', current_invitation\.student_auth_subject/u);
  assert.equal(verify.match(/candidate_otp_code/gu)?.length, 3);
  assert.match(
    verify,
    /pg_advisory_xact_lock\([\s\S]*faculty\.invitation\.verify:idempotency:[\s\S]*candidate_idempotency_key/u,
  );
  const caseLockIndex = verify.indexOf('SELECT recommendation_case.* INTO current_case');
  const invitationLockIndex = verify.indexOf(
    'SELECT invitation.* INTO current_invitation',
    verify.indexOf('FOR UPDATE;') + 'FOR UPDATE;'.length,
  );
  const selfVerificationGuardIndex = verify.indexOf(
    'IF faculty_subject = current_case.student_auth_subject THEN',
  );
  const verificationReceiptLookupIndex = verify.indexOf(
    'SELECT receipt.* INTO stored_receipt',
  );
  assert.ok(caseLockIndex >= 0);
  assert.ok(invitationLockIndex >= 0);
  assert.ok(selfVerificationGuardIndex > invitationLockIndex);
  assert.ok(verificationReceiptLookupIndex > selfVerificationGuardIndex);
  assert.match(
    verify.slice(selfVerificationGuardIndex, verificationReceiptLookupIndex),
    /LOR_FACULTY_INVITATION_AUTHORIZATION_DENIED'[\s\S]*ERRCODE = 'P1301'/u,
  );
  assert.doesNotMatch(
    verify.slice(0, selfVerificationGuardIndex),
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+lor_studio\./u,
  );

  for (const key of [
    'invitationExpiresAt',
    'challengeExpiresAt',
    'challengeIdHash',
    'caseRevision',
    'invitationRevision',
  ]) {
    assert.match(sql, new RegExp(`'${key}'`, 'u'), key);
  }
  assert.match(sql, /missionmed\.lor\.faculty-invitation-command-receipt\.v1/u);
  assert.match(sql, /principal_authority = 'database_verified_otp_challenge'/u);
  assert.match(sql, /YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"/u);
  assert.doesNotMatch(sql, /recipientEmail(?:'|"|\s+text)/u);
  assert.doesNotMatch(sql, /(?:token|otpCode)(?:'|"|\s+text)/u);

  assert.match(resolver, /missionmed\.lor\.actor-case-access\.v1/u);
  assert.match(resolver, /database_verified_case_access/u);
  assert.match(resolver, /eligible_role_count = 0/u);
  assert.match(resolver, /eligible_role_count <> 1/u);
  assert.match(resolver, /ERRCODE = 'P1202'/u);
  assert.match(resolver, /actor_case_access_resolution/u);
  for (const durableBinding of [durableFacultyContext, resolver]) {
    assert.match(durableBinding, /invitation\.used_at < invitation\.expires_at/u);
    assert.match(
      durableBinding,
      /verification\.invitation_used_at < verification\.otp_expires_at/u,
    );
    assert.doesNotMatch(
      durableBinding,
      /invitation\.expires_at > pg_catalog\.statement_timestamp\(\)/u,
    );
    assert.doesNotMatch(
      durableBinding,
      /verification\.otp_expires_at > pg_catalog\.statement_timestamp\(\)/u,
    );
  }
  assert.match(
    durableFacultyContext,
    /proof_revocation\.case_id = verification\.case_id/u,
  );
});

test('production faculty invitation successor preserves the reviewed command body', async () => {
  const [localSql, productionSql] = await Promise.all([
    readFile(facultyInvitationPath, 'utf8'),
    readFile(productionFacultyInvitationPath, 'utf8'),
  ]);
  const bodyMarker = 'LOCK TABLE\n';
  assert.equal(
    productionSql.slice(productionSql.indexOf(bodyMarker)).replaceAll(
      'facultyInvitationCommands=20260825010500',
      'facultyInvitationCommands=20260825010400',
    ).trimEnd(),
    localSql.slice(localSql.indexOf(bodyMarker)).trimEnd(),
  );
  for (const required of [
    'missionmed.lor.railway-postgres-target.v1',
    '29afe885-b9b1-425d-8fd8-8611cd275409',
    'f5705d38-393c-4176-9cc2-0d1dbad42c93',
    'b49a52e7-df15-4417-b67a-a64403aa5db7',
    'identityScope=20260825010300',
    'facultyInvitationCommands=20260825010500',
  ]) {
    assert.match(productionSql, new RegExp(required.replaceAll('.', '\\.'), 'u'), required);
  }
  assert.match(productionSql, /inet_server_addr\(\) IS NULL/u);
  assert.match(productionSql, /current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
  assert.match(productionSql, /observed_sentinel IS DISTINCT FROM expected_sentinel/u);
});
