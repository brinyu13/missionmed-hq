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
