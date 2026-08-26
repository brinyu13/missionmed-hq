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
const productionRlsPath = path.join(
  scriptDirectory,
  'migrations',
  '20260825010100_f2_lor_1012_production_rls_projection_grants.sql',
);
const foundationRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260820180700_f2_lor_1012_schema_foundation.rollback.sql',
);
const rlsRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260820180800_f2_lor_1012_rls_projection_grants.rollback.sql',
);
const productionFoundationRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010000_f2_lor_1012_production_schema_foundation.rollback.sql',
);
const productionRlsRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010100_f2_lor_1012_production_rls_projection_grants.rollback.sql',
);
const identityScopeRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010200_f2_lor_1012_identity_scope_commands.rollback.sql',
);
const productionIdentityScopeRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010300_f2_lor_1012_production_identity_scope_commands.rollback.sql',
);
const facultyInvitationRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010400_f2_lor_1012_faculty_invitation_commands.rollback.sql',
);
const productionFacultyInvitationRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010500_f2_lor_1012_production_faculty_invitation_commands.rollback.sql',
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

const COMMAND_OWNER_POLICIES = Object.freeze([
  'student_auth_bindings_command_select@student_auth_bindings:SELECT',
  'student_auth_binding_revocations_command_select@student_auth_binding_revocations:SELECT',
  'recommendation_cases_student_command_select@recommendation_cases:SELECT',
  'recommendation_cases_student_command_insert@recommendation_cases:INSERT',
  'recommendation_cases_student_command_update@recommendation_cases:UPDATE',
  'case_creation_reservations_student_command_select@recommendation_case_creation_reservations:SELECT',
  'case_creation_reservations_student_command_lock@recommendation_case_creation_reservations:UPDATE',
  'recommendation_case_audit_events_student_command_select@recommendation_case_audit_events:SELECT',
  'recommendation_case_audit_events_student_command_insert@recommendation_case_audit_events:INSERT',
  'protected_revision_states_student_command_select@recommendation_case_protected_revision_states:SELECT',
  'protected_revision_states_student_command_insert@recommendation_case_protected_revision_states:INSERT',
  'recommendation_case_write_receipts_student_command_select@recommendation_case_write_receipts:SELECT',
  'recommendation_case_write_receipts_student_command_insert@recommendation_case_write_receipts:INSERT',
  'consent_receipts_student_command_select@consent_receipts:SELECT',
  'consent_receipts_student_command_insert@consent_receipts:INSERT',
  'waiver_receipts_student_command_select@waiver_receipts:SELECT',
  'waiver_receipts_student_command_insert@waiver_receipts:INSERT',
  'released_student_documents_student_command_select@released_student_documents:SELECT',
  'recommendation_cases_mentor_command_select@recommendation_cases:SELECT',
  'protected_revision_states_mentor_command_select@recommendation_case_protected_revision_states:SELECT',
  'mentor_case_assignments_command_select@mentor_case_assignments:SELECT',
  'mentor_case_assignment_revocations_command_select@mentor_case_assignment_revocations:SELECT',
  'recommendation_cases_faculty_command_select@recommendation_cases:SELECT',
  'recommendation_cases_faculty_command_update@recommendation_cases:UPDATE',
  'faculty_invitations_faculty_command_select@faculty_invitations:SELECT',
  'faculty_otp_verification_receipts_faculty_command_select@faculty_otp_verification_receipts:SELECT',
  'faculty_otp_proof_revocations_faculty_command_select@faculty_otp_proof_revocations:SELECT',
  'consent_receipts_faculty_command_select@consent_receipts:SELECT',
  'waiver_receipts_faculty_command_select@waiver_receipts:SELECT',
  'faculty_private_content_faculty_command_select@faculty_private_content:SELECT',
  'faculty_private_content_faculty_command_update@faculty_private_content:UPDATE',
  'released_student_documents_faculty_command_select@released_student_documents:SELECT',
  'released_student_documents_faculty_command_insert@released_student_documents:INSERT',
  'private_write_receipts_faculty_command_select@recommendation_case_private_write_receipts:SELECT',
  'private_write_receipts_faculty_command_insert@recommendation_case_private_write_receipts:INSERT',
  'recommendation_case_audit_events_faculty_command_select@recommendation_case_audit_events:SELECT',
  'recommendation_case_audit_events_faculty_command_insert@recommendation_case_audit_events:INSERT',
  'protected_revision_states_faculty_command_select@recommendation_case_protected_revision_states:SELECT',
  'protected_revision_states_faculty_command_insert@recommendation_case_protected_revision_states:INSERT',
  'writer_depot_artifacts_faculty_select@writer_depot_artifacts:SELECT',
  'writer_depot_artifacts_faculty_insert@writer_depot_artifacts:INSERT',
  'ai_generation_runs_faculty_select@ai_generation_runs:SELECT',
  'ai_generation_runs_faculty_insert@ai_generation_runs:INSERT',
  'ai_letter_proposals_faculty_select@ai_letter_proposals:SELECT',
  'ai_letter_proposals_faculty_insert@ai_letter_proposals:INSERT',
  'ai_proposal_decisions_faculty_select@ai_proposal_decisions:SELECT',
  'ai_proposal_decisions_faculty_insert@ai_proposal_decisions:INSERT',
]);

const REMOVED_DIRECT_APP_POLICIES = Object.freeze([
  'recommendation_cases_student_insert',
  'recommendation_cases_student_update',
  'protected_revision_states_student_insert',
  'consent_receipts_student_insert',
  'waiver_receipts_student_insert',
  'recommendation_cases_mentor_select',
  'recommendation_case_audit_events_authorized_select',
  'recommendation_case_write_receipts_authorized_select',
]);

function normalizeArguments(argumentsText) {
  if (argumentsText.trim() === '') return '';
  return argumentsText
    .split(',')
    .map((argument) => argument.trim().split(/\s+/u).at(-1))
    .join(',');
}

function createdFunctions(sql) {
  return [...sql.matchAll(
    /^CREATE FUNCTION lor_studio\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*\nRETURNS([\s\S]*?)^AS \$[a-z0-9_]*\$/gmu,
  )].map((match) => Object.freeze({
    identity: `${match[1]}(${normalizeArguments(match[2])})`,
    properties: match[3],
  }));
}

function droppedFunctions(sql) {
  return [...sql.matchAll(/^DROP FUNCTION\s+([\s\S]*?);/gmu)]
    .flatMap((statement) => [...statement[1].matchAll(
      /lor_studio\.([a-z0-9_]+)\s*\(([^)]*)\)/gu,
    )])
    .map((match) => `${match[1]}(${match[2].replaceAll(/\s+/gu, '')})`);
}

function commandOwnerFunctionIdentities(sql) {
  return [...sql.matchAll(
    /^ALTER FUNCTION lor_studio\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s+OWNER TO lor_studio_command_owner;/gmu,
  )].map((match) => `${match[1]}(${normalizeArguments(match[2])})`);
}

function createdPolicies(sql) {
  return [...sql.matchAll(
    /^CREATE POLICY\s+([a-z0-9_]+)\s*\n\s*ON\s+lor_studio\.([a-z0-9_]+)\s*\n\s*FOR\s+(SELECT|INSERT|UPDATE|DELETE)[\s\S]*?\nTO\s+(lor_studio_app|lor_studio_command_owner)\b/gmu,
  )].map((match) => `${match[1]}@${match[2]}:${match[3]}:${match[4]}`);
}

function droppedPolicies(sql) {
  return [...sql.matchAll(
    /^DROP POLICY\s+([a-z0-9_]+)\s+ON\s+lor_studio\.([a-z0-9_]+);/gmu,
  )].map((match) => `${match[1]}@${match[2]}`);
}

function createdTriggers(sql) {
  return [...sql.matchAll(
    /^CREATE (?:CONSTRAINT )?TRIGGER\s+([a-z0-9_]+)\s+[\s\S]*?\s+ON\s+lor_studio\.([a-z0-9_]+)\s+[\s\S]*?FOR EACH ROW EXECUTE FUNCTION\s+lor_studio\.([a-z0-9_]+)\([^;]*\);/gmu,
  )].map((match) => `${match[1]}@${match[2]}:${match[3]}`);
}

function droppedTriggers(sql) {
  return [...sql.matchAll(
    /^DROP TRIGGER\s+([a-z0-9_]+)\s+ON\s+lor_studio\.([a-z0-9_]+);/gmu,
  )].map((match) => `${match[1]}@${match[2]}`);
}

function withoutLineComments(sql) {
  return sql.replace(/^\s*--.*$/gmu, '');
}

function lockedRelations(sql) {
  const lockBlock = sql.match(/^LOCK TABLE\s+([\s\S]*?)\nIN ACCESS EXCLUSIVE MODE;/mu)?.[1] ?? '';
  return [...lockBlock.matchAll(/lor_studio\.([a-z0-9_]+)/gu)]
    .map((match) => match[1]);
}

test('both rollback files have the same sentinel-bound disposable identity guard', async () => {
  const [foundation, rls, foundationRollback, rlsRollback] = await Promise.all([
    readFile(foundationPath, 'utf8'),
    readFile(rlsPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);
  const sentinel = 'missionmed.lor.disposable-postgres-harness.v1';
  for (const sql of [foundationRollback, rlsRollback]) {
    assert.match(sql, /database_suffix[\s\S]*admin_suffix IS DISTINCT FROM database_suffix/u);
    assert.match(sql, /session_user IS DISTINCT FROM current_user/u);
    assert.match(sql, /current_setting\('data_directory'\)/u);
    assert.match(sql, /current_setting\('unix_socket_directories'\)/u);
    assert.match(sql, /socket_directories IS DISTINCT FROM harness_root \|\| '\/s'/u);
    assert.match(sql, /obj_description\(namespace\.oid, 'pg_namespace'\)/u);
    assert.match(sql, new RegExp(sentinel.replaceAll('.', '\\.'), 'u'));
    assert.match(sql, /IN ACCESS EXCLUSIVE MODE/u);
  }
  assert.match(foundation, new RegExp(sentinel.replaceAll('.', '\\.'), 'u'));
  assert.match(rls, /lor_studio_command_owner/u);
});

test('RLS guard relation ordering is C-canonical in every forward and rollback artifact', async () => {
  for (const sqlPath of [
    rlsPath,
    productionRlsPath,
    foundationRollbackPath,
    productionFoundationRollbackPath,
    rlsRollbackPath,
    productionRlsRollbackPath,
  ]) {
    const sql = await readFile(sqlPath, 'utf8');
    assert.match(
      sql,
      /relation_name \|\| ':(?:false:false|true:true)' ORDER BY relation_name COLLATE "C"/u,
    );
    assert.doesNotMatch(
      sql,
      /relation_name \|\| ':(?:false:false|true:true)' ORDER BY relation_name\)/u,
    );
  }
});

test('rollback SQL contains no optional or scope-expanding destructive form', async () => {
  const sqlFiles = await Promise.all([
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);
  for (const rawSql of sqlFiles) {
    const sql = withoutLineComments(rawSql);
    assert.doesNotMatch(sql, /\bCASCADE\b/iu);
    assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|VIEW|FUNCTION|POLICY|TRIGGER|SCHEMA|ROLE)\s+IF\s+EXISTS\b/iu);
    assert.doesNotMatch(sql, /\bDROP\s+OWNED\s+BY\b/iu);
    assert.doesNotMatch(sql, /\bREASSIGN\s+OWNED\b/iu);
    assert.doesNotMatch(sql, /ON\s+ALL\s+(?:TABLES|SEQUENCES|FUNCTIONS)/iu);
    assert.doesNotMatch(sql, /FOR\s+policy\s+IN[\s\S]*?DROP POLICY/iu);
  }
});

test('both rollbacks lock the exact 28 tables and foundation drops only that set', async () => {
  const [sql, rlsRollback] = await Promise.all([
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);
  for (const relation of RELATIONS) {
    assert.match(sql, new RegExp(`lor_studio\\.${relation}`, 'u'), relation);
  }
  for (const rollback of [sql, rlsRollback]) {
    const locked = lockedRelations(rollback);
    assert.deepEqual([...locked].sort(), [...RELATIONS].sort());
    assert.equal(new Set(locked).size, 28);
  }
  const droppedTableBlock = sql.match(/^DROP TABLE\s+([\s\S]*?);/mu)?.[1] ?? '';
  const dropped = [...droppedTableBlock.matchAll(/lor_studio\.([a-z0-9_]+)/gu)]
    .map((match) => match[1]);
  assert.deepEqual([...dropped].sort(), [...RELATIONS].sort());
  assert.equal(new Set(dropped).size, 28);
});

test('forward and rollback function inventories are exact and reverse-scoped', async () => {
  const [foundation, rls, foundationRollback, rlsRollback] = await Promise.all([
    readFile(foundationPath, 'utf8'),
    readFile(rlsPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);
  const foundationFunctions = createdFunctions(foundation).map((entry) => entry.identity);
  const rlsFunctions = createdFunctions(rls).map((entry) => entry.identity);
  const foundationDrops = droppedFunctions(foundationRollback);
  const rlsDrops = droppedFunctions(rlsRollback);
  assert.deepEqual([...foundationDrops].sort(), [...foundationFunctions].sort());
  assert.deepEqual([...rlsDrops].sort(), [...rlsFunctions].sort());
  assert.equal(foundationDrops.some((identity) => rlsFunctions.includes(identity)), false);
});

test('only the eight approved command surfaces are security definers and command-owned', async () => {
  const sql = await readFile(rlsPath, 'utf8');
  const definers = createdFunctions(sql)
    .filter((entry) => /SECURITY\s+DEFINER/u.test(entry.properties));
  assert.deepEqual(definers.map((entry) => entry.identity), APPROVED_SECURITY_DEFINER_FUNCTIONS);
  assert.deepEqual(commandOwnerFunctionIdentities(sql), APPROVED_SECURITY_DEFINER_FUNCTIONS);
  assert.match(
    sql,
    /CREATE ROLE\s+lor_studio_command_owner[\s\S]*?NOLOGIN[\s\S]*?NOINHERIT[\s\S]*?NOBYPASSRLS/u,
  );
});

test('RLS policies are exact, literal on rollback, and command surfaces replace app writes', async () => {
  const [forward, rollback] = await Promise.all([
    readFile(rlsPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);
  const policies = createdPolicies(forward);
  const policyNamesAndTables = policies.map((policy) => policy.replace(/:(?:SELECT|INSERT|UPDATE|DELETE):[^:]+$/u, ''));
  assert.equal(policies.length, 91);
  assert.deepEqual(
    policies
      .filter((policy) => policy.endsWith(':lor_studio_command_owner'))
      .map((policy) => policy.replace(/:lor_studio_command_owner$/u, ''))
      .sort(),
    [...COMMAND_OWNER_POLICIES].sort(),
  );
  for (const removed of REMOVED_DIRECT_APP_POLICIES) {
    assert.equal(policies.some((policy) => policy.startsWith(`${removed}@`)), false, removed);
  }
  assert.deepEqual([...droppedPolicies(rollback)].sort(), [...policyNamesAndTables].sort());
});

test('foundation triggers are exact and are literally removed before tables', async () => {
  const [forward, rollback] = await Promise.all([
    readFile(foundationPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
  ]);
  const triggers = createdTriggers(forward);
  const drops = droppedTriggers(rollback);
  assert.equal(triggers.length, 46);
  assert.deepEqual(
    [...drops].sort(),
    triggers.map((trigger) => trigger.replace(/:[^:]+$/u, '')).sort(),
  );
  assert.ok(rollback.indexOf('DROP TRIGGER') < rollback.indexOf('DROP TABLE'));
  assert.ok(rollback.indexOf('DROP TABLE') < rollback.indexOf('DROP FUNCTION'));
  assert.ok(rollback.indexOf('DROP FUNCTION') < rollback.indexOf('DROP SCHEMA lor_studio;'));
});

test('RLS rollback preflights the exact final non-owner ACL and role surface', async () => {
  const sql = await readFile(rlsRollbackPath, 'utf8');
  const expectedAclBlock = sql.match(
    /expected_nonowner_acls constant text\[\] := ARRAY\[([\s\S]*?)\n  \]::text\[\];/u,
  )?.[1] ?? '';
  const aclEntries = [...expectedAclBlock.matchAll(/'([^']+)'/gu)]
    .map((match) => match[1]);

  assert.equal(aclEntries.length, 84);
  assert.equal(new Set(aclEntries).size, 84);
  assert.deepEqual(aclEntries, [...aclEntries].sort());
  for (const required of [
    'relation:recommendation_cases:app:SELECT:false',
    'relation:recommendation_cases:command_owner:UPDATE:false',
    'relation:recommendation_case_protected_revision_states:command_owner:INSERT:false',
    'relation:recommendation_case_creation_reservations:command_owner:UPDATE:false',
    'relation:consent_receipts:command_owner:INSERT:false',
    'relation:waiver_receipts:command_owner:INSERT:false',
    'relation:faculty_private_content:command_owner:UPDATE:false',
    'function:commit_faculty_final_document_release(bigint,text,text,text,jsonb,text):app:EXECUTE:false',
    'function:read_mentor_case_projection():app:EXECUTE:false',
    'function:student_context_allows(text,text,uuid,text[]):app:EXECUTE:false',
    'function:operational_content_context_allows(text,text,text[],text[]):app:EXECUTE:false',
    'function:ai_grounding_manifest_is_complete(jsonb):app:EXECUTE:false',
    'function:canonical_jsonb_text(jsonb):app:EXECUTE:false',
    'schema:lor_studio:command_owner:USAGE:false',
  ]) {
    assert.equal(aclEntries.includes(required), true, required);
  }
  for (const forbidden of [
    'relation:recommendation_cases:app:INSERT:false',
    'relation:recommendation_cases:app:UPDATE:false',
    'relation:recommendation_case_protected_revision_states:app:INSERT:false',
    'relation:consent_receipts:app:INSERT:false',
    'relation:waiver_receipts:app:INSERT:false',
    'relation:faculty_private_content:app:SELECT:false',
    'relation:faculty_private_content:app:UPDATE:false',
    'relation:faculty_invitations:app:SELECT:false',
    'relation:faculty_otp_verification_receipts:app:SELECT:false',
    'relation:faculty_otp_proof_revocations:app:SELECT:false',
    'function:faculty_context_allows(text,text,text[]):app:EXECUTE:false',
  ]) {
    assert.equal(aclEntries.includes(forbidden), false, forbidden);
  }
  assert.equal(
    aclEntries.some((entry) => entry.startsWith('column:') && entry.includes(':command_owner:')),
    false,
  );
  assert.equal(aclEntries.some((entry) => entry.startsWith('column:')), false);
  assert.match(sql, /observed_nonowner_acls IS DISTINCT FROM expected_nonowner_acls/u);
  assert.match(sql, /pg_default_acl/u);
  assert.match(sql, /role\.rolconfig IS NOT DISTINCT FROM ARRAY\['search_path=pg_catalog'\]/u);
});

test('both rollback files fail closed on owner, ACL, RLS, inventory, and nonempty drift', async () => {
  const sqlFiles = await Promise.all([
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);
  for (const sql of sqlFiles) {
    for (const required of [
      'pg_roles',
      'pg_auth_members',
      'pg_class',
      'pg_proc',
      'pg_policies',
      'pg_trigger',
      'relrowsecurity',
      'relforcerowsecurity',
      'aclexplode',
      'attacl',
      'refuses nonempty relation',
    ]) {
      assert.match(sql, new RegExp(required, 'u'), required);
    }
  }
});

test('foundation rollback reconciles only default privileges the forward migration created', async () => {
  const sql = await readFile(foundationRollbackPath, 'utf8');
  assert.match(sql, /observed_default_acl_types IS DISTINCT FROM ARRAY\[\]::text\[\]/u);
  assert.match(sql, /unexpected_default_acl_entry_count <> 0/u);
  assert.doesNotMatch(
    sql,
    /ALTER DEFAULT PRIVILEGES IN SCHEMA lor_studio GRANT EXECUTE ON FUNCTIONS TO PUBLIC;/u,
  );
});

test('both rollbacks fingerprint the exact index and version-specific constraint catalogs before DDL', async () => {
  const rollbackFiles = await Promise.all([
    readFile(rlsRollbackPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
  ]);
  const expectedFingerprints = [
    '6486aa57aebe29f7dd19f48611f4a24958bffbbbe5bf95ff603c16bad2a8f8d6',
    'aa251174fe7dd624049a0a45c46b279cad5757f46e2a355f85b466b53ac1a002',
    '80aebb352dba03810b876597b83b4224cc391bc9e7688f5ccbac1e3eeae78c8f',
  ];

  for (const [index, sql] of rollbackFiles.entries()) {
    const destructiveBoundary = index === 0
      ? sql.indexOf('-- Literal reverse operations follow.')
      : sql.indexOf('DROP TRIGGER');
    assert.ok(destructiveBoundary > 0);
    for (const required of [
      'pg_catalog.pg_get_indexdef',
      'pg_catalog.pg_get_constraintdef',
      'pg_catalog.sha256',
      'observed_index_count <> expected_index_count',
      'observed_index_fingerprint IS DISTINCT FROM expected_index_fingerprint',
      'observed_constraint_count <> expected_constraint_count',
      'observed_constraint_fingerprint IS DISTINCT FROM expected_constraint_fingerprint',
      'expected_index_fingerprint IS NULL',
      'expected_constraint_fingerprint IS NULL',
    ]) {
      const guardPosition = sql.indexOf(required);
      assert.ok(guardPosition > 0, required);
      assert.ok(guardPosition < destructiveBoundary, required);
    }
    for (const fingerprint of expectedFingerprints) {
      assert.equal(sql.includes(fingerprint), true, fingerprint);
    }
  }
});

test('both rollbacks fingerprint the semantic catalog and reject same-name drift before DDL', async () => {
  const rollbackFiles = await Promise.all([
    readFile(rlsRollbackPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
  ]);
  for (const [index, sql] of rollbackFiles.entries()) {
    const destructiveBoundary = index === 0
      ? sql.indexOf('-- Literal reverse operations follow.')
      : sql.indexOf('DROP TRIGGER');
    assert.ok(destructiveBoundary > 0);
    for (const required of [
      'semantic_inventory',
      'expected_semantic_count',
      'observed_semantic_count',
      'expected_semantic_fingerprint',
      'observed_semantic_fingerprint',
      'pg_catalog.pg_attribute',
      'pg_catalog.pg_get_functiondef',
      'pg_catalog.pg_get_triggerdef',
      'pg_catalog.pg_get_viewdef',
      'pg_catalog.pg_get_ruledef',
      'pg_catalog.pg_description',
      'pg_catalog.pg_shdescription',
      'pg_catalog.pg_seclabel',
      'pg_catalog.pg_shseclabel',
      'pg_catalog.pg_publication_rel',
      'pg_catalog.pg_statistic_ext',
      'policy.permissive',
      'policy.qual',
      'policy.with_check',
      'trigger.tgisinternal IS TRUE',
      'observed_semantic_count <> expected_semantic_count',
      'observed_semantic_fingerprint IS DISTINCT FROM expected_semantic_fingerprint',
    ]) {
      const guardPosition = sql.indexOf(required);
      assert.ok(guardPosition > 0, required);
      assert.ok(guardPosition < destructiveBoundary, required);
    }
  }
});

test('forward and rollback custody fingerprints owner-inclusive schema, relation, and row-type ACL state', async () => {
  const [foundationSql, rlsSql, foundationRollbackSql, rlsRollbackSql] = await Promise.all([
    readFile(foundationPath, 'utf8'),
    readFile(rlsPath, 'utf8'),
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
  ]);

  assert.match(
    foundationSql,
    /GRANT ALL PRIVILEGES ON SCHEMA lor_studio TO CURRENT_USER;[\s\S]*GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA lor_studio TO CURRENT_USER;[\s\S]*COMMIT;/u,
  );

  for (const [sql, expectedCount] of [
    [rlsSql, 714],
    [foundationRollbackSql, 714],
    [rlsRollbackSql, 844],
  ]) {
    assert.match(sql, new RegExp(`expected_semantic_count constant bigint := ${expectedCount};`, 'u'));
    const semanticStart = sql.indexOf('WITH semantic_inventory AS (');
    const semanticEnd = sql.indexOf('FROM semantic_inventory;', semanticStart);
    assert.ok(semanticStart > 0);
    assert.ok(semanticEnd > semanticStart);
    const semanticInventory = sql.slice(semanticStart, semanticEnd);
    for (const required of [
      "'schema'::text AS category",
      "'aclIsNull', namespace.nspacl IS NULL",
      'pg_catalog.aclexplode(namespace.nspacl)',
      "'aclIsNull', class.relacl IS NULL",
      'pg_catalog.aclexplode(class.relacl)',
      "'row_type'",
      "'arrayType', array_type.typname",
      "'arrayOwner', CASE",
      "'arrayAclIsNull', array_type.typacl IS NULL",
      'pg_catalog.aclexplode(array_type.typacl)',
      "'arrayComment', pg_catalog.obj_description(array_type.oid, 'pg_type')",
      'JOIN pg_catalog.pg_type AS array_type ON array_type.oid = type.typarray',
      "'aclIsNull', type.typacl IS NULL",
      'pg_catalog.aclexplode(type.typacl)',
      "pg_catalog.obj_description(type.oid, 'pg_type')",
      "'grantor'",
      "'grantee'",
      "'privilege'",
      "'grantable'",
    ]) {
      assert.equal(semanticInventory.includes(required), true, required);
    }
    assert.ok(
      semanticInventory.match(/'aclIsNull', class\.relacl IS NULL/gu)?.length >= 2,
      'table and view ACL NULL/default state must both be fingerprinted',
    );
    assert.ok(
      semanticInventory.match(/pg_catalog\.aclexplode\(class\.relacl\)/gu)?.length >= 2,
      'table and view full ACL entries must both be fingerprinted',
    );
  }

  for (const required of [
    'owner_schema_relation_acl_mismatch_count',
    "object_acl IS NULL AS acl_is_null",
    "pg_catalog.acldefault(object_acls.acl_kind, object_acls.owner_oid)",
    'acl_is_null OR actual_acl IS DISTINCT FROM expected_acl',
  ]) {
    assert.equal(rlsRollbackSql.includes(required), true, required);
  }
});

test('DR-133 production rollbacks preserve exact no-CASCADE bodies and require the forward target sentinel', async () => {
  const [
    foundationRollback,
    rlsRollback,
    productionFoundationRollback,
    productionRlsRollback,
  ] = await Promise.all([
    readFile(foundationRollbackPath, 'utf8'),
    readFile(rlsRollbackPath, 'utf8'),
    readFile(productionFoundationRollbackPath, 'utf8'),
    readFile(productionRlsRollbackPath, 'utf8'),
  ]);

  const bodyMarker = 'LOCK TABLE\n';
  assert.equal(
    productionFoundationRollback.slice(productionFoundationRollback.indexOf(bodyMarker)),
    foundationRollback.slice(foundationRollback.indexOf(bodyMarker)),
  );
  assert.equal(
    productionRlsRollback.slice(productionRlsRollback.indexOf(bodyMarker)),
    rlsRollback.slice(rlsRollback.indexOf(bodyMarker)),
  );

  for (const sql of [productionFoundationRollback, productionRlsRollback]) {
    assert.match(sql, /Authority: F2-LOR-1012 \/ DR-133/u);
    assert.match(sql, /missionmed\.lor\.railway-postgres-target\.v1/u);
    assert.match(sql, /foundation=20260825010000/u);
    assert.match(sql, /observed_sentinel IS DISTINCT FROM expected_sentinel/u);
    assert.match(sql, /session_user IS DISTINCT FROM current_user/u);
    assert.match(sql, /database_owner IS DISTINCT FROM current_user/u);
    assert.match(sql, /schema_owner IS DISTINCT FROM current_user/u);
    for (const exactIdentity of [
      '29afe885-b9b1-425d-8fd8-8611cd275409',
      'f5705d38-393c-4176-9cc2-0d1dbad42c93',
      'b49a52e7-df15-4417-b67a-a64403aa5db7',
      'postgres',
    ]) {
      assert.match(sql, new RegExp(exactIdentity, 'u'), exactIdentity);
    }
    assert.match(sql, /inet_server_addr\(\) IS NULL/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '10\.0\.0\.0\/8'/u);
    assert.match(sql, /current_setting\('ssl'\) IS DISTINCT FROM 'on'/u);
    assert.match(sql, /FROM pg_catalog\.pg_stat_ssl AS ssl_session/u);
    assert.match(sql, /ssl_session\.pid = pg_catalog\.pg_backend_pid\(\)/u);
    assert.match(sql, /AND ssl_session\.ssl/u);
    for (const deniedTarget of [
      'mftguikkftmrxjxrkdln',
      'fglyvdykwgbuivikqoah',
    ]) {
      assert.match(sql, new RegExp(deniedTarget, 'u'), deniedTarget);
    }
    const destructiveSql = withoutLineComments(sql);
    assert.doesNotMatch(destructiveSql, /\bCASCADE\b/iu);
    assert.doesNotMatch(destructiveSql, /\bDROP\s+OWNED\s+BY\b/iu);
    assert.doesNotMatch(destructiveSql, /\bREASSIGN\s+OWNED\b/iu);
  }
});

test('identity/scope rollback is exact, data preserving, and no-CASCADE', async () => {
  const sql = await readFile(identityScopeRollbackPath, 'utf8');
  const semanticGuardStart = sql.indexOf('DO $semantic_catalog_guard$');
  const semanticGuardEnd = sql.indexOf('$semantic_catalog_guard$;', semanticGuardStart);
  const firstReverseDdl = sql.indexOf('REVOKE EXECUTE ON FUNCTION');
  assert.ok(semanticGuardStart > 0);
  assert.ok(semanticGuardEnd > semanticGuardStart);
  assert.ok(firstReverseDdl > semanticGuardEnd);
  const semanticGuard = sql.slice(semanticGuardStart, semanticGuardEnd);
  for (const required of [
    'expected_inventory_count constant bigint := 22',
    'expected_function_count constant bigint := 51',
    'expected_definer_count constant bigint := 12',
    'expected_policy_count constant bigint := 100',
    'expected_nonowner_relation_acl_count constant bigint := 11',
    'expected_column_acl_count constant bigint := 0',
    '99b0910c25caa8c6b5e16bdee2fbb6dcef3000a4360880f86e73f3c134fb409c',
    'b161095ce9d6529ed1e2ddacb2a86d5b59bff455400f51b927bd569dd7e66705',
    'pg_catalog.pg_get_functiondef',
    'procedure.prokind',
    'procedure.proconfig',
    'procedure.proacl IS NULL',
    'pg_catalog.aclexplode',
    'pg_catalog.pg_get_expr(policy.polqual',
    'pg_catalog.pg_get_expr(policy.polwithcheck',
    'class.relacl IS NULL',
    'class.relrowsecurity',
    'class.relforcerowsecurity',
    'FROM pg_catalog.pg_attribute AS attribute',
    'pg_catalog.aclexplode(attribute.attacl)',
    'observed_column_acl_count IS DISTINCT FROM expected_column_acl_count',
    'ORDER BY sort_key COLLATE "C"',
    'observed_fingerprint IS DISTINCT FROM expected_fingerprint',
  ]) {
    assert.equal(semanticGuard.includes(required), true, required);
  }
  for (const functionIdentity of [
    'ensure_student_auth_binding(text, text, text)',
    'revoke_student_auth_binding(text, text)',
    'resolve_faculty_case_scope(text, text, text)',
    'resolve_mentor_case_scope(text, text, text)',
    'identity_bootstrap_context_allows(text, text[])',
    'actor_scope_resolution_context_allows(text, text, text[], text)',
  ]) {
    assert.equal(
      semanticGuard.includes(`'${functionIdentity.slice(0, functionIdentity.indexOf('('))}'`),
      true,
      `semantic fingerprint ${functionIdentity}`,
    );
    assert.match(
      sql,
      new RegExp(`DROP FUNCTION lor_studio\\.${functionIdentity.replaceAll(/[()[\]]/gu, '\\$&')};`, 'u'),
      functionIdentity,
    );
  }
  for (const policy of [
    'student_auth_bindings_identity_command_select',
    'student_auth_bindings_identity_command_insert',
    'student_auth_binding_revocations_identity_command_select',
    'student_auth_binding_revocations_identity_command_insert',
    'faculty_invitations_scope_resolution_select',
    'faculty_otp_verification_scope_resolution_select',
    'faculty_otp_revocations_scope_resolution_select',
    'mentor_assignments_scope_resolution_select',
    'mentor_assignment_revocations_scope_resolution_select',
  ]) {
    assert.match(sql, new RegExp(`DROP POLICY ${policy}`, 'u'), policy);
  }
  assert.match(sql, /REVOKE INSERT ON TABLE[\s\S]*student_auth_bindings/u);
  assert.match(sql, /identityScope=20260825010200/u);
  assert.match(sql, /FROM pg_catalog\.pg_auth_members AS membership/u);
  assert.match(sql, /rolname = 'lor_studio_app'[\s\S]*NOT rolsuper[\s\S]*NOT rolinherit[\s\S]*NOT rolcanlogin[\s\S]*NOT rolbypassrls/u);
  assert.match(sql, /rolname = 'lor_studio_command_owner'[\s\S]*NOT rolsuper[\s\S]*NOT rolinherit[\s\S]*NOT rolcanlogin[\s\S]*NOT rolbypassrls/u);
  assert.match(sql, /regexp_replace\([\s\S]*identityScope=20260825010200\$/u);
  const destructiveSql = withoutLineComments(sql);
  assert.doesNotMatch(destructiveSql, /\bCASCADE\b/iu);
  assert.doesNotMatch(destructiveSql, /\b(?:DELETE|TRUNCATE)\b/iu);
  assert.doesNotMatch(destructiveSql, /\bDROP\s+(?:TABLE|SCHEMA|ROLE)\b/iu);
});

test('production identity/scope rollback preserves local reverse operations and exact target custody', async () => {
  const [localSql, productionSql] = await Promise.all([
    readFile(identityScopeRollbackPath, 'utf8'),
    readFile(productionIdentityScopeRollbackPath, 'utf8'),
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
  const destructiveSql = withoutLineComments(productionSql);
  assert.doesNotMatch(destructiveSql, /\bCASCADE\b/iu);
  assert.doesNotMatch(destructiveSql, /\bDROP\s+(?:TABLE|SCHEMA|ROLE)\b/iu);
});

test('faculty invitation rollback is exact, empty-ledger guarded, and no-CASCADE', async () => {
  const sql = await readFile(facultyInvitationRollbackPath, 'utf8');
  const guardEnd = sql.indexOf('$catalog_guard$;');
  const reverseStart = sql.indexOf('REVOKE EXECUTE ON FUNCTION');
  assert.ok(guardEnd > 0);
  assert.ok(reverseStart > guardEnd);
  const guard = sql.slice(0, guardEnd);
  for (const required of [
    'relation_count IS DISTINCT FROM 29',
    'function_count IS DISTINCT FROM 57',
    'definer_count IS DISTINCT FROM 18',
    'policy_count IS DISTINCT FROM 123',
    'trigger_count IS DISTINCT FROM 47',
    'index_count IS DISTINCT FROM 120',
    'WHEN 16 THEN 320::bigint',
    'WHEN 18 THEN 642::bigint',
    'nonowner_acl_count IS DISTINCT FROM 107',
    'invitation_policy_count IS DISTINCT FROM 23',
    'EXISTS (SELECT 1 FROM lor_studio.faculty_invitation_command_receipts)',
    'faculty.invitation_delivered',
    'faculty.invitation_delivery_pending',
    'faculty.invitation_delivery_unknown',
    'faculty.invitation_otp_resent',
    'faculty.invitation_revoked',
  ]) {
    assert.equal(guard.includes(required), true, required);
  }
  for (const identity of [
    'issue_faculty_invitation',
    'resend_faculty_invitation_otp',
    'revoke_faculty_invitation',
    'verify_faculty_invitation',
    'commit_faculty_invitation_delivery',
    'resolve_lor_actor_case_access',
  ]) {
    assert.match(sql, new RegExp(`DROP FUNCTION lor_studio\\.${identity}\\(`, 'u'), identity);
  }
  for (const policy of [
    'consent_receipts_invitation_command_select',
    'recommendation_cases_invitation_command_select',
    'faculty_invitations_invitation_command_select',
    'faculty_invitation_command_receipts_command_select',
    'faculty_invitation_command_receipts_command_insert',
    'mentor_case_assignment_revocations_actor_access_select',
  ]) {
    assert.match(sql, new RegExp(`DROP POLICY ${policy}`, 'u'), policy);
  }
  assert.match(sql, /DROP TABLE lor_studio\.faculty_invitation_command_receipts;/u);
  assert.match(sql, /principal_authority = 'durable_otp_provider_proof'/u);
  assert.match(sql, /CREATE OR REPLACE FUNCTION lor_studio\.faculty_context_allows\(/u);
  assert.match(sql, /invitation\.expires_at > pg_catalog\.statement_timestamp\(\)/u);
  assert.match(sql, /verification\.otp_expires_at > pg_catalog\.statement_timestamp\(\)/u);
  assert.match(
    sql,
    /faculty_context_source NOT LIKE '%proof_revocation\.case_id = verification\.case_id%'/u,
  );
  assert.match(sql, /facultyInvitationCommands=20260825010400/u);
  assert.match(sql, /regexp_replace\([\s\S]*facultyInvitationCommands=20260825010400\$/u);
  const destructiveSql = withoutLineComments(sql);
  assert.doesNotMatch(destructiveSql, /\bCASCADE\b/iu);
  assert.doesNotMatch(destructiveSql, /\b(?:DELETE|TRUNCATE)\b/iu);
  assert.doesNotMatch(destructiveSql, /\bDROP\s+(?:SCHEMA|ROLE)\b/iu);
  assert.deepEqual(
    [...destructiveSql.matchAll(/\bDROP\s+TABLE\s+([^;]+);/giu)].map((match) => match[1]),
    ['lor_studio.faculty_invitation_command_receipts'],
  );
});

test('production faculty invitation rollback preserves the local reverse body and target custody', async () => {
  const [localSql, productionSql] = await Promise.all([
    readFile(facultyInvitationRollbackPath, 'utf8'),
    readFile(productionFacultyInvitationRollbackPath, 'utf8'),
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
  const destructiveSql = withoutLineComments(productionSql);
  assert.doesNotMatch(destructiveSql, /\bCASCADE\b/iu);
  assert.doesNotMatch(destructiveSql, /\bDROP\s+(?:SCHEMA|ROLE)\b/iu);
});
