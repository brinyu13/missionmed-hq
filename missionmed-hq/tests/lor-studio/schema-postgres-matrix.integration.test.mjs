import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  createAtomicRlsCaseDriver,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  NODE_POSTGRES_DATABASE_ROLE,
  createNodePostgresExecutor,
} from '../../lor-studio/adapters/node-postgres-executor.mjs';
import {
  appendStudentSafeReceipt,
  autosaveStudentSafeBuilderStep,
  completeStudentSafeBuilderStep,
  createStudentSafeRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import {
  createConsentReceipt,
  createWaiverReceipt,
} from '../../lor-studio/domain/receipts.js';
import {
  hashValue,
  sha256,
} from '../../lor-studio/domain/value-utils.js';
import {
  createMetadataServiceEvent,
} from '../../lor-studio/services/metadata-events.js';
import {
  PostgresHarnessError,
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const { Pool } = pg;
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptDirectory = path.resolve(testDirectory, '..', '..', 'scripts', 'lor-studio');
const contractPath = path.join(scriptDirectory, 'schema-design.contract.json');
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
const identityScopeRollbackPath = path.join(
  scriptDirectory,
  'rollbacks',
  '20260825010200_f2_lor_1012_identity_scope_commands.rollback.sql',
);

const RUN_REAL_MATRIX = process.env.LOR_RUN_REAL_POSTGRES_MATRIX === '1';
const TOOLCHAINS = Object.freeze([
  Object.freeze({ major: 16, root: '/opt/homebrew/opt/postgresql@16/bin' }),
  Object.freeze({ major: 18, root: '/opt/homebrew/opt/postgresql@18/bin' }),
]);
const STUDENT = 'wp:41';
const AUTH_UID = '4c1d4b2e-1f1a-4a67-9a1a-7b0f0c9d5e01';
const OTHER_STUDENT = 'wp:42';
const OTHER_AUTH_UID = '5d2e5c3f-2a2b-4b78-8b2b-8c1d1e0e6f02';
const REVOKED_STUDENT = 'wp:43';
const REVOKED_AUTH_UID = '6e3f6d4a-3b3c-4c89-9c3c-9d2e2f1f7a13';
const CASE_ID = 'case_disposable_pg_matrix_0001';
const OTHER_CASE_ID = 'case_disposable_pg_matrix_other';
const BUILDER_SESSION_ID = 'builder_disposable_pg_matrix_0001';
const CREATED_AT = '2026-08-20T12:00:00.000Z';
const HASH_A = sha256('synthetic-local-binding-source');
const HASH_B = sha256('synthetic-local-binding-proof');
const FACULTY = 'wp:84';
const FACULTY_AUTH_UID = '6e3f6d4a-3b3c-4c89-9c3c-9d2e2f1f7a03';
const OTHER_FACULTY = 'wp:85';
const OTHER_FACULTY_AUTH_UID = '7f4a7e5b-4c4d-4d90-8d4d-0e3f30208b04';
const FACULTY_INVITATION_ID = 'invitation_disposable_pg_matrix_0001';
const FACULTY_CHALLENGE_ID = 'challenge_disposable_pg_matrix_0001';
const FACULTY_OTP_RECEIPT_ID = 'otp_receipt_disposable_pg_matrix_0001';
const CONSENT_RECEIPT_ID = 'consent_disposable_pg_matrix_0001';
const WAIVER_RECEIPT_ID = 'waiver_disposable_pg_matrix_0001';
const FINAL_DOCUMENT_ID = 'document_disposable_pg_matrix_0001';
const FINAL_DOCUMENT_TEXT = 'Synthetic local faculty-approved final letter.';
const FACULTY_DRAFT_TEXT = 'Synthetic local faculty draft.';
const FACULTY_APPROVED_AT = '2026-08-20T12:05:00.000Z';
const FACULTY_RELEASED_AT = '2026-08-20T12:06:00.000Z';
const FACULTY_FIXTURE_EXPIRES_AT = '2099-01-01T00:00:00.000Z';
const OPERATIONAL_ACTOR = 'service:lor-local-security-harness';
const OPERATIONAL_AUTH_UID = '8a5b8f6c-5d5e-4ea1-9e5e-1f4041309c05';
const IDENTITY_SUBJECT = 'wp:141';
const IDENTITY_SOURCE_HASH = sha256('synthetic-local-wordpress-admission-source');
const IDENTITY_PROOF_HASH = sha256('synthetic-local-wordpress-admission-proof');
const MENTOR = 'wp:96';
const MENTOR_AUTH_UID = '9b6c907d-6e6f-4fb2-af6f-20515241ad06';
const MENTOR_ASSIGNMENT_ID = 'assignment_disposable_pg_matrix_0001';
const MENTOR_ASSIGNMENT_ID_TWO = 'assignment_disposable_pg_matrix_0002';

const BINDING = resolveLorTargetBinding({
  schemaVersion: LOR_TARGET_BINDING_SCHEMA,
  ratified: true,
  decisionRecord: 'DR-133',
  environment: 'staging',
  provider: 'railway-postgres',
  projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
  environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
  serviceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
  databaseName: 'railway',
  region: 'us-west2',
  schema: 'lor_studio',
  migrationLedger: 'lor_studio/migrations/disposable-local',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: false,
});

function binaries(root) {
  return Object.freeze({
    initdb: path.join(root, 'initdb'),
    pgCtl: path.join(root, 'pg_ctl'),
    createdb: path.join(root, 'createdb'),
    psql: path.join(root, 'psql'),
  });
}

async function assertToolchainPresent(toolchain) {
  for (const binary of Object.values(binaries(toolchain.root))) {
    await access(binary);
  }
}

async function readContract() {
  return JSON.parse(await readFile(contractPath, 'utf8'));
}

function integer(value) {
  const parsed = Number(value);
  assert.equal(Number.isSafeInteger(parsed), true, `unsafe catalog integer: ${value}`);
  return parsed;
}

async function catalogSnapshot(pool) {
  const { rows: [row] } = await pool.query(`SELECT
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'r') AS table_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND class.relkind IN ('v', 'm')) AS view_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio') AS function_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef) AS definer_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_policies AS policy
      WHERE policy.schemaname = 'lor_studio') AS policy_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_trigger AS trigger
      JOIN pg_catalog.pg_class AS class ON class.oid = trigger.tgrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND trigger.tgisinternal IS FALSE) AS trigger_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio'
        AND class.relkind = 'r'
        AND class.relrowsecurity
        AND class.relforcerowsecurity) AS forced_rls_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND class.relkind = 'i') AS index_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_constraint AS constraint_record
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = constraint_record.connamespace
      WHERE namespace.nspname = 'lor_studio') AS constraint_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname LIKE 'lor_studio_%') AS role_count`);
  return Object.freeze(Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, integer(value)]),
  ));
}

async function definerFunctions(pool) {
  const { rows } = await pool.query(`SELECT
      procedure.proname || '(' ||
      pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', '') ||
      ')' AS identity
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'lor_studio' AND procedure.prosecdef
    ORDER BY procedure.proname, procedure.proargtypes::text`);
  return rows.map(({ identity }) => identity);
}

async function nonownerAclEntryCount(pool) {
  const { rows: [row] } = await pool.query(`WITH acl_entries AS (
    SELECT namespace.nspowner AS owner_oid, acl.grantee
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT class.relowner, acl.grantee
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT procedure.proowner, acl.grantee
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) AS acl
    WHERE namespace.nspname = 'lor_studio'
    UNION ALL
    SELECT class.relowner, acl.grantee
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_class AS class ON class.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
    WHERE namespace.nspname = 'lor_studio'
      AND attribute.attnum > 0
      AND attribute.attacl IS NOT NULL
  )
  SELECT pg_catalog.count(*) AS count
  FROM acl_entries
  WHERE grantee <> owner_oid`);
  return integer(row.count);
}

function expectedConstraintCount(contract, postgresMajor) {
  const expected = contract.expectedConstraintCountByPostgresMajor?.[String(postgresMajor)];
  assert.equal(Number.isSafeInteger(expected), true, `missing PostgreSQL ${postgresMajor} constraint contract`);
  return expected;
}

async function assertFinalCatalog(pool, contract, postgresMajor) {
  const snapshot = await catalogSnapshot(pool);
  assert.deepEqual(snapshot, {
    table_count: contract.executableRelations.length,
    view_count: contract.projectionViews.length,
    function_count: contract.expectedFinalFunctionCount,
    definer_count: contract.approvedSecurityDefinerFunctions.length,
    policy_count: contract.expectedFinalPolicyCount,
    trigger_count: contract.expectedFinalTriggerCount,
    forced_rls_count: contract.executableRelations.length,
    index_count: contract.expectedFinalIndexCount,
    constraint_count: expectedConstraintCount(contract, postgresMajor),
    role_count: 2,
  });
  assert.deepEqual(
    await definerFunctions(pool),
    [...contract.approvedSecurityDefinerFunctions].sort(),
  );
  assert.equal(
    await nonownerAclEntryCount(pool),
    contract.rollbackCustody.expectedFinalNonownerAclEntryCount,
  );
  const { rows: [privileges] } = await pool.query(`SELECT
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.recommendation_cases', 'INSERT'
    ) AS app_case_insert,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.recommendation_cases', 'UPDATE'
    ) AS app_case_update,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.recommendation_case_protected_revision_states', 'INSERT'
    ) AS app_protected_insert,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.recommendation_case_protected_revision_states', 'SELECT'
    ) AS app_protected_select,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.faculty_private_content', 'SELECT'
    ) AS app_faculty_private_select,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.faculty_private_content', 'UPDATE'
    ) AS app_faculty_private_update,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.released_student_documents', 'INSERT'
    ) AS app_released_insert,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.recommendation_case_private_write_receipts', 'SELECT'
    ) AS app_private_receipt_select,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.recommendation_case_private_write_receipts', 'INSERT'
    ) AS app_private_receipt_insert,
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.mentor_case_assignments', 'SELECT'
    ) AS app_mentor_assignment_select,
    pg_catalog.has_table_privilege(
      'lor_studio_command_owner',
      'lor_studio.recommendation_case_creation_reservations',
      'UPDATE'
    ) AS command_owner_reservation_update`);
  assert.deepEqual(privileges, {
    app_case_insert: false,
    app_case_update: false,
    app_protected_insert: false,
    app_protected_select: false,
    app_faculty_private_select: false,
    app_faculty_private_update: false,
    app_released_insert: false,
    app_private_receipt_select: false,
    app_private_receipt_insert: false,
    app_mentor_assignment_select: false,
    command_owner_reservation_update: true,
  });
}

async function assertFoundationCatalog(pool, contract, postgresMajor) {
  const snapshot = await catalogSnapshot(pool);
  assert.deepEqual(snapshot, {
    table_count: contract.executableRelations.length,
    view_count: 0,
    function_count: contract.expectedFoundationFunctionCount,
    definer_count: 0,
    policy_count: 0,
    trigger_count: contract.expectedFinalTriggerCount,
    forced_rls_count: 0,
    index_count: contract.expectedFinalIndexCount,
    constraint_count: expectedConstraintCount(contract, postgresMajor),
    role_count: 1,
  });
}

async function assertFullyRemoved(pool) {
  const { rows: [row] } = await pool.query(`SELECT
    (SELECT pg_catalog.count(*) FROM pg_catalog.pg_namespace
      WHERE nspname = 'lor_studio') AS schema_count,
    (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles
      WHERE rolname LIKE 'lor_studio_%') AS role_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_default_acl AS default_acl
      WHERE default_acl.defaclrole = (
        SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = CURRENT_USER
      )) AS default_acl_count`);
  assert.deepEqual(row, { schema_count: '0', role_count: '0', default_acl_count: '0' });
}

async function withHarness(toolchain, operation) {
  const harness = createDisposablePostgresHarness({
    binaries: binaries(toolchain.root),
    startupTimeoutMs: 30_000,
    shutdownTimeoutMs: 15_000,
  });
  let running = false;
  let pool;
  try {
    await harness.start();
    running = true;
    pool = new Pool({
      ...harness.connectionOptions(),
      max: 2,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 5_000,
    });
    return await operation({ harness, pool });
  } finally {
    if (pool) await pool.end();
    if (running) await harness.stop();
  }
}

async function applyForward(harness) {
  await harness.applySqlFile(foundationPath);
  await harness.applySqlFile(rlsPath);
}

async function withIdentityResolutionContext(pool, {
  actorRole,
  subject,
  caseId = '',
  operation,
  purpose,
  trustedServiceActor = '',
}, handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query('SET LOCAL ROLE lor_studio_app');
    await client.query({
      text: `SELECT
        pg_catalog.set_config('request.jwt.claim.sub', '', true),
        pg_catalog.set_config('lor_studio.student_auth_subject', $1, true),
        pg_catalog.set_config('lor_studio.actor_role', $2, true),
        pg_catalog.set_config('lor_studio.resource_student_id', $1, true),
        pg_catalog.set_config('lor_studio.case_id', $3, true),
        pg_catalog.set_config('lor_studio.operation', $4, true),
        pg_catalog.set_config('lor_studio.purpose', $5, true),
        pg_catalog.set_config('lor_studio.trusted_service_actor', $6, true),
        pg_catalog.set_config('lor_studio.identity_resolution_verified', 'true', true),
        pg_catalog.set_config('lor_studio.entitlement_verified', 'true', true),
        pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
        pg_catalog.set_config('lor_studio.canary_authorized', 'true', true)`,
      values: [subject, actorRole, caseId, operation, purpose, trustedServiceActor],
    });
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function assertProductionFoundationRejectsDisposableTarget({ harness, pool }) {
  await assert.rejects(() => harness.applySqlFile(productionFoundationPath), isSqlApplyFailure);
  const { rows: [state] } = await pool.query(`SELECT
    (SELECT pg_catalog.count(*) FROM pg_catalog.pg_namespace
      WHERE nspname = 'lor_studio') AS schema_count,
    (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles
      WHERE rolname LIKE 'lor_studio_%') AS role_count`);
  assert.deepEqual(state, { schema_count: '0', role_count: '0' });
}

async function assertFoundationSetRoleLookalikeRejected({ harness, pool }) {
  const { rows: [{ database_name: databaseName }] } = await pool.query(
    'SELECT pg_catalog.current_database() AS database_name',
  );
  const currentSuffix = databaseName.match(/^lorh_db_([a-f0-9]{20})$/u)?.[1];
  assert.ok(currentSuffix);
  const lookalikeSuffix = currentSuffix === '00000000000000000000'
    ? '11111111111111111111'
    : '00000000000000000000';
  const lookalikeRole = `lorh_admin_${lookalikeSuffix}`;
  const lookalikeDatabase = `lorh_db_${lookalikeSuffix}`;
  assert.match(lookalikeRole, /^[a-z][a-z0-9_]{1,62}$/u);
  assert.match(lookalikeDatabase, /^[a-z][a-z0-9_]{1,62}$/u);

  let lookalikePool;
  try {
    await pool.query(`CREATE ROLE ${lookalikeRole} NOLOGIN`);
    await pool.query(`CREATE DATABASE ${lookalikeDatabase} OWNER ${lookalikeRole}`);
    lookalikePool = new Pool({
      ...harness.connectionOptions(),
      database: lookalikeDatabase,
      max: 1,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 5_000,
    });
    const client = await lookalikePool.connect();
    try {
      await client.query(`SET ROLE ${lookalikeRole}`);
      const foundationSql = await readFile(foundationPath, 'utf8');
      await assert.rejects(
        () => client.query(foundationSql),
        (error) => error?.code === '42501',
      );
      await client.query('ROLLBACK');
      const { rows: [lookalikeState] } = await client.query(`SELECT
        (SELECT pg_catalog.count(*) FROM pg_catalog.pg_namespace
          WHERE nspname = 'lor_studio') AS schema_count,
        (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles
          WHERE rolname = 'lor_studio_app') AS app_role_count`);
      assert.deepEqual(lookalikeState, { schema_count: '0', app_role_count: '0' });
    } finally {
      client.release();
    }
  } finally {
    if (lookalikePool) await lookalikePool.end();
    await pool.query(`DROP DATABASE IF EXISTS ${lookalikeDatabase}`);
    await pool.query(`DROP ROLE IF EXISTS ${lookalikeRole}`);
  }
}

async function assertRlsForwardUnapplied(pool) {
  const { rows: [state] } = await pool.query(`SELECT
    (SELECT pg_catalog.count(*) FROM pg_catalog.pg_roles
      WHERE rolname = 'lor_studio_command_owner') AS command_owner_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_class AS class
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio' AND class.relrowsecurity) AS rls_count,
    (SELECT pg_catalog.count(*)
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'lor_studio') AS policy_count`);
  assert.deepEqual(state, {
    command_owner_count: '0',
    rls_count: '0',
    policy_count: '0',
  });
}

async function proveRlsForwardFoundationCustody({ harness, pool, contract, postgresMajor }) {
  await harness.applySqlFile(foundationPath);
  await assertFoundationCatalog(pool, contract, postgresMajor);
  const { rows: [{ schema_comment: schemaComment }] } = await pool.query(`SELECT
    pg_catalog.obj_description(namespace.oid, 'pg_namespace') AS schema_comment
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.match(schemaComment, /^missionmed\.lor\.disposable-postgres-harness\.v1\|/u);

  await pool.query(`COMMENT ON SCHEMA lor_studio
    IS 'tampered disposable-local RLS forward sentinel'`);
  await assert.rejects(() => harness.applySqlFile(rlsPath), isSqlApplyFailure);
  await assertRlsForwardUnapplied(pool);
  const { rows: [{ statement: restoreComment }] } = await pool.query({
    text: `SELECT pg_catalog.format(
      'COMMENT ON SCHEMA lor_studio IS %L', $1::text
    ) AS statement`,
    values: [schemaComment],
  });
  await pool.query(restoreComment);

  await pool.query('CREATE TABLE lor_studio.rls_forward_adversarial_extra (id bigint)');
  await assert.rejects(() => harness.applySqlFile(rlsPath), isSqlApplyFailure);
  await assertRlsForwardUnapplied(pool);
  await pool.query('DROP TABLE lor_studio.rls_forward_adversarial_extra');

  await pool.query(`REVOKE SELECT ON lor_studio.recommendation_cases
    FROM CURRENT_USER`);
  const { rows: [{ owner_relation_select_count: ownerRelationSelectCount }] } = await pool.query(`SELECT
    pg_catalog.count(*) AS owner_relation_select_count
    FROM pg_catalog.pg_class AS class
    CROSS JOIN LATERAL pg_catalog.aclexplode(class.relacl) AS acl
    WHERE class.oid = 'lor_studio.recommendation_cases'::pg_catalog.regclass
      AND acl.grantee = class.relowner
      AND acl.privilege_type = 'SELECT'`);
  assert.equal(integer(ownerRelationSelectCount), 0);
  await assert.rejects(() => harness.applySqlFile(rlsPath), isSqlApplyFailure);
  await assertRlsForwardUnapplied(pool);
  await pool.query(`GRANT SELECT ON lor_studio.recommendation_cases
    TO CURRENT_USER`);

  await pool.query(`COMMENT ON TYPE lor_studio.recommendation_cases
    IS 'tampered disposable-local row-type comment'`);
  await assert.rejects(() => harness.applySqlFile(rlsPath), isSqlApplyFailure);
  await assertRlsForwardUnapplied(pool);
  await pool.query('COMMENT ON TYPE lor_studio.recommendation_cases IS NULL');

  await pool.query(`COMMENT ON TYPE lor_studio._recommendation_cases
    IS 'tampered disposable-local array-type comment'`);
  await assert.rejects(() => harness.applySqlFile(rlsPath), isSqlApplyFailure);
  await assertRlsForwardUnapplied(pool);
  await pool.query('COMMENT ON TYPE lor_studio._recommendation_cases IS NULL');

  await harness.applySqlFile(rlsPath);
  await assertFinalCatalog(pool, contract, postgresMajor);
  await harness.applySqlFile(rlsRollbackPath);
  await harness.applySqlFile(foundationRollbackPath);
  await assertFullyRemoved(pool);
}

async function assertRlsForwardOwnerSchemaAclDriftRejected({
  harness,
  pool,
  contract,
  postgresMajor,
}) {
  await harness.applySqlFile(foundationPath);
  await assertFoundationCatalog(pool, contract, postgresMajor);
  await pool.query('REVOKE USAGE ON SCHEMA lor_studio FROM CURRENT_USER');
  const { rows: [{ owner_schema_usage_count: ownerSchemaUsageCount }] } = await pool.query(`SELECT
    pg_catalog.count(*) AS owner_schema_usage_count
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS acl
    WHERE namespace.nspname = 'lor_studio'
      AND acl.grantee = namespace.nspowner
      AND acl.privilege_type = 'USAGE'`);
  assert.equal(integer(ownerSchemaUsageCount), 0);
  await assert.rejects(() => harness.applySqlFile(rlsPath), isSqlApplyFailure);
  await assertRlsForwardUnapplied(pool);
}

async function insertSyntheticStudentBinding(pool, {
  bindingId = 'binding_disposable_pg_matrix_0001',
  studentId = STUDENT,
  authUid = AUTH_UID,
  sourceHash = HASH_A,
  proofHash = HASH_B,
} = {}) {
  await pool.query({
    text: `INSERT INTO lor_studio.student_auth_bindings
      (binding_id, student_auth_subject, student_auth_uid, binding_source,
       source_reference_hash, proof_hash, bound_at, expires_at, created_at)
      VALUES ($1, $2, $3::uuid, 'wordpress_verified_bootstrap', $4, $5,
        $6::timestamptz, NULL, $6::timestamptz)`,
    values: [
      bindingId,
      studentId,
      authUid,
      sourceHash,
      proofHash,
      CREATED_AT,
    ],
  });
}

function studentScope({
  operation = 'create',
  resourceStudentId = STUDENT,
  actorId = resourceStudentId,
  authenticatedSubject = actorId,
  authUid = AUTH_UID,
  caseId = CASE_ID,
} = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid,
    authenticatedSubject,
    actorId,
    actorRole: 'student',
    resourceStudentId,
    caseId,
    operation,
    purpose: operation === 'read' ? 'student_case_read' : 'student_case_write',
    assignmentId: null,
    invitationId: null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  };
}

function facultyScope({
  operation = 'read',
  actorId = FACULTY,
  authenticatedSubject = actorId,
  authUid = FACULTY_AUTH_UID,
  resourceStudentId = STUDENT,
  caseId = CASE_ID,
  invitationId = FACULTY_INVITATION_ID,
} = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid,
    authenticatedSubject,
    actorId,
    actorRole: 'faculty',
    resourceStudentId,
    caseId,
    operation,
    purpose: 'faculty_private_edit',
    assignmentId: null,
    invitationId,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  };
}

function transitionEvent(transition, { eventId, eventType }) {
  return createMetadataServiceEvent({
    eventId,
    eventType,
    caseId: CASE_ID,
    actorId: STUDENT,
    actorRole: 'student',
    correlationId: 'disposable-pg-matrix-correlation',
    revision: transition.state.revision,
    occurredAt: transition.state.updatedAt,
  });
}

function studentCommand({
  transition,
  expectedRevision,
  idempotencyKey,
  requestHash,
  event,
  receipt = null,
  scope = studentScope({ operation: expectedRevision === null ? 'create' : 'save' }),
}) {
  return {
    binding: BINDING,
    scope,
    state: transition.state,
    expectedRevision,
    idempotencyKey,
    requestHash,
    event,
    versionEntry: transition.versionEntry,
    receipt,
  };
}

async function assertDirectAppDmlDenied(pool, text, values = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query('SET LOCAL ROLE lor_studio_app');
    await assert.rejects(
      () => client.query({ text, values }),
      (error) => error?.code === '42501',
    );
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

async function assertCommandOwnerReservationCustody(pool, creationRef) {
  const { rows: [before] } = await pool.query({
    text: `SELECT reserved_at
      FROM lor_studio.recommendation_case_creation_reservations
      WHERE creation_ref = $1`,
    values: [creationRef],
  });
  assert.ok(before);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE lor_studio_command_owner');
    await client.query({
      text: `SELECT
        pg_catalog.set_config('request.jwt.claim.sub', $1, true),
        pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
        pg_catalog.set_config('lor_studio.actor_role', 'student', true),
        pg_catalog.set_config('lor_studio.resource_student_id', $2, true),
        pg_catalog.set_config('lor_studio.case_id', $3, true),
        pg_catalog.set_config('lor_studio.operation', 'create', true),
        pg_catalog.set_config('lor_studio.purpose', 'student_case_write', true),
        pg_catalog.set_config('lor_studio.invitation_id', '', true),
        pg_catalog.set_config('lor_studio.assignment_id', '', true),
        pg_catalog.set_config('lor_studio.administrative_grant_id', '', true),
        pg_catalog.set_config('lor_studio.entitlement_verified', 'true', true),
        pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
        pg_catalog.set_config('lor_studio.canary_authorized', 'true', true)`,
      values: [AUTH_UID, STUDENT, creationRef],
    });
    const { rows: lockedRows } = await client.query({
      text: `SELECT creation_ref
        FROM lor_studio.recommendation_case_creation_reservations
        WHERE creation_ref = $1
        FOR UPDATE`,
      values: [creationRef],
    });
    assert.deepEqual(lockedRows, [{ creation_ref: creationRef }]);
    await assert.rejects(
      () => client.query({
        text: `UPDATE lor_studio.recommendation_case_creation_reservations
          SET reserved_at = reserved_at
          WHERE creation_ref = $1`,
        values: [creationRef],
      }),
      (error) => ['42501', '55000'].includes(error?.code),
    );
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }

  const { rows: [after] } = await pool.query({
    text: `SELECT reserved_at
      FROM lor_studio.recommendation_case_creation_reservations
      WHERE creation_ref = $1`,
    values: [creationRef],
  });
  assert.equal(new Date(after.reserved_at).toISOString(), new Date(before.reserved_at).toISOString());
}

async function withStudentCommandOwnerScope(pool, operationUnderTest) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE lor_studio_command_owner');
    await client.query({
      text: `SELECT
        pg_catalog.set_config('request.jwt.claim.sub', $1, true),
        pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
        pg_catalog.set_config('lor_studio.actor_role', 'student', true),
        pg_catalog.set_config('lor_studio.resource_student_id', $2, true),
        pg_catalog.set_config('lor_studio.case_id', $3, true),
        pg_catalog.set_config('lor_studio.operation', 'save', true),
        pg_catalog.set_config('lor_studio.purpose', 'student_case_write', true),
        pg_catalog.set_config('lor_studio.action', '', true),
        pg_catalog.set_config('lor_studio.invitation_id', '', true),
        pg_catalog.set_config('lor_studio.assignment_id', '', true),
        pg_catalog.set_config('lor_studio.administrative_grant_id', '', true),
        pg_catalog.set_config('lor_studio.entitlement_verified', 'true', true),
        pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
        pg_catalog.set_config('lor_studio.canary_authorized', 'true', true)`,
      values: [AUTH_UID, STUDENT, CASE_ID],
    });
    const result = await operationUnderTest(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function insertAdministrativeGrant(pool, {
  grantId,
  operation,
  purpose,
} = {}) {
  await pool.query({
    text: `INSERT INTO lor_studio.administrative_case_grants
      (grant_id, case_id, student_auth_subject, grantee_auth_subject,
       grantee_auth_uid, operation, purpose, privacy_authority, issued_at,
       expires_at, audit_event_ref, grant_hash)
      SELECT $1, $2, $3, $4, $5::uuid, $6, $7,
        'privacy-authority:disposable-local-security-review',
        '2026-08-20T12:00:00.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz,
        audit.event_ref, $8
      FROM lor_studio.recommendation_case_audit_events AS audit
      WHERE audit.case_id = $2 AND audit.student_auth_subject = $3
      ORDER BY audit.occurred_at, audit.event_ref
      LIMIT 1`,
    values: [
      grantId,
      CASE_ID,
      STUDENT,
      OPERATIONAL_ACTOR,
      OPERATIONAL_AUTH_UID,
      operation,
      purpose,
      sha256(`disposable-local-grant:${grantId}:${operation}:${purpose}`),
    ],
  });
}

async function bindOperationalScope(client, {
  grantId,
  operation,
  purpose,
  action,
}) {
  await client.query('SET LOCAL ROLE lor_studio_app');
  await client.query({
    text: `SELECT
      pg_catalog.set_config('request.jwt.claim.sub', $1, true),
      pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
      pg_catalog.set_config('lor_studio.actor_role', 'service', true),
      pg_catalog.set_config('lor_studio.resource_student_id', $3, true),
      pg_catalog.set_config('lor_studio.case_id', $4, true),
      pg_catalog.set_config('lor_studio.operation', $5, true),
      pg_catalog.set_config('lor_studio.purpose', $6, true),
      pg_catalog.set_config('lor_studio.action', $7, true),
      pg_catalog.set_config('lor_studio.invitation_id', '', true),
      pg_catalog.set_config('lor_studio.assignment_id', '', true),
      pg_catalog.set_config('lor_studio.administrative_grant_id', $8, true),
      pg_catalog.set_config('lor_studio.entitlement_verified', 'false', true),
      pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
      pg_catalog.set_config('lor_studio.canary_authorized', 'false', true)`,
    values: [
      OPERATIONAL_AUTH_UID,
      OPERATIONAL_ACTOR,
      STUDENT,
      CASE_ID,
      operation,
      purpose,
      action,
      grantId,
    ],
  });
}

async function acquireCaseSerializationLock(client, {
  caseId = CASE_ID,
  studentAuthSubject = STUDENT,
} = {}) {
  await client.query({
    text: `SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array(
        'missionmed.lor.case-lock.v1', $1::text, $2::text
      )::text,
      0
    ))`,
    values: [caseId, studentAuthSubject],
  });
}

async function withOperationalScope(pool, scope, operationUnderTest) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await bindOperationalScope(client, scope);
    const result = await operationUnderTest(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function waitForAdvisoryLockWait(observerClient, backendPid) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { rows: [state] } = await observerClient.query({
      text: `SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_locks AS pending_lock
        WHERE pending_lock.pid = $1
          AND pending_lock.locktype = 'advisory'
          AND pending_lock.granted IS FALSE
      ) AS waiting`,
      values: [backendPid],
    });
    if (state.waiting) return;
    await delay(10);
  }
  assert.fail('AI transaction did not queue on the case advisory lock');
}

async function proveAiReleaseSerialization(pool) {
  const releaseClient = await pool.connect();
  const aiClient = await pool.connect();
  let insertOutcomePromise;
  const serializationRunId = 'run_disposable_pg_matrix_release_serialization_probe';
  const insertRun = () => aiClient.query({
    text: `INSERT INTO lor_studio.ai_generation_runs
      (run_id, case_id, student_auth_subject, requested_by_actor_ref,
       provider_kind, provider_configuration_hash, input_hash,
       grounding_manifest_hash, status, started_at, completed_at, error_code, run_hash)
      VALUES ($1, $2, $3, $4, 'deterministic_test', $5, $6, $7,
        'succeeded', $8::timestamptz, $9::timestamptz, NULL, $10)`,
    values: [
      serializationRunId,
      CASE_ID,
      STUDENT,
      `actor_${sha256(`lor-studio:actor:${OPERATIONAL_ACTOR}`)}`,
      sha256('disposable-local-serialization-provider-configuration'),
      sha256('disposable-local-serialization-ai-input'),
      sha256('disposable-local-serialization-grounding'),
      '2026-08-20T12:05:20.000Z',
      '2026-08-20T12:05:21.000Z',
      sha256('disposable-local-serialization-provider-run'),
    ],
  });

  try {
    await releaseClient.query('BEGIN');
    await acquireCaseSerializationLock(releaseClient);

    await aiClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await bindOperationalScope(aiClient, {
      grantId: 'grant_ai_generation',
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.provider_run.create',
    });
    const { rows: [{ backend_pid: backendPid }] } = await aiClient.query(
      'SELECT pg_catalog.pg_backend_pid() AS backend_pid',
    );
    let insertSettled = false;
    insertOutcomePromise = insertRun().then(
      () => {
        insertSettled = true;
        return { error: null };
      },
      (error) => {
        insertSettled = true;
        return { error };
      },
    );
    await waitForAdvisoryLockWait(releaseClient, backendPid);
    assert.equal(insertSettled, false);

    await releaseClient.query("SET LOCAL session_replication_role = 'replica'");
    const releaseProbe = await releaseClient.query({
      text: `UPDATE lor_studio.recommendation_cases
        SET release_document_id = 'document_serialization_probe',
            release_document_hash = $3,
            released_at = '2026-08-20T12:05:30.000Z'::timestamptz,
            released_at_revision = revision,
            release_waiver_receipt_id = $4
        WHERE case_id = $1 AND student_auth_subject = $2`,
      values: [CASE_ID, STUDENT, sha256('disposable-local-release-serialization'), WAIVER_RECEIPT_ID],
    });
    assert.equal(releaseProbe.rowCount, 1);
    await releaseClient.query('COMMIT');

    const insertOutcome = await insertOutcomePromise;
    assert.equal(insertOutcome.error?.code, '42501');
    await aiClient.query('ROLLBACK');

    const { rows: [{ count }] } = await releaseClient.query({
      text: 'SELECT count(*) AS count FROM lor_studio.ai_generation_runs WHERE run_id = $1',
      values: [serializationRunId],
    });
    assert.equal(integer(count), 0);

    await releaseClient.query('BEGIN');
    await releaseClient.query("SET LOCAL session_replication_role = 'replica'");
    await releaseClient.query({
      text: `UPDATE lor_studio.recommendation_cases
        SET release_document_id = NULL,
            release_document_hash = NULL,
            released_at = NULL,
            released_at_revision = NULL,
            release_waiver_receipt_id = NULL
        WHERE case_id = $1 AND student_auth_subject = $2
          AND release_document_id = 'document_serialization_probe'`,
      values: [CASE_ID, STUDENT],
    });
    await releaseClient.query('COMMIT');

    await aiClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const { rows: staleSnapshotRows } = await aiClient.query({
      text: `SELECT case_id FROM lor_studio.recommendation_cases
        WHERE case_id = $1 AND student_auth_subject = $2
          AND released_at IS NULL`,
      values: [CASE_ID, STUDENT],
    });
    assert.deepEqual(staleSnapshotRows, [{ case_id: CASE_ID }]);

    await releaseClient.query('BEGIN');
    await acquireCaseSerializationLock(releaseClient);
    await releaseClient.query("SET LOCAL session_replication_role = 'replica'");
    await releaseClient.query({
      text: `UPDATE lor_studio.recommendation_cases
        SET release_document_id = 'document_serialization_probe',
            release_document_hash = $3,
            released_at = '2026-08-20T12:05:30.000Z'::timestamptz,
            released_at_revision = revision,
            release_waiver_receipt_id = $4
        WHERE case_id = $1 AND student_auth_subject = $2`,
      values: [CASE_ID, STUDENT, sha256('disposable-local-release-serialization'), WAIVER_RECEIPT_ID],
    });
    await releaseClient.query('COMMIT');

    await bindOperationalScope(aiClient, {
      grantId: 'grant_ai_generation',
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.provider_run.create',
    });
    await assert.rejects(insertRun, (error) => error?.code === '42501');
    await aiClient.query('ROLLBACK');
  } finally {
    await releaseClient.query('ROLLBACK').catch(() => {});
    if (insertOutcomePromise) await insertOutcomePromise;
    await aiClient.query('ROLLBACK').catch(() => {});
    await releaseClient.query('BEGIN');
    try {
      await releaseClient.query("SET LOCAL session_replication_role = 'replica'");
      await releaseClient.query({
        text: `UPDATE lor_studio.recommendation_cases
          SET release_document_id = NULL,
              release_document_hash = NULL,
              released_at = NULL,
              released_at_revision = NULL,
              release_waiver_receipt_id = NULL
          WHERE case_id = $1 AND student_auth_subject = $2
            AND release_document_id = 'document_serialization_probe'`,
        values: [CASE_ID, STUDENT],
      });
      await releaseClient.query('COMMIT');
    } catch (error) {
      await releaseClient.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      aiClient.release();
      releaseClient.release();
    }
  }
}

async function proveOperationalRevocationRejectsRepeatableRead(pool) {
  const grantId = 'grant_repeatable_read_revocation_probe';
  await insertAdministrativeGrant(pool, {
    grantId,
    operation: 'create_ai_generation',
    purpose: 'ai_generation',
  });

  const staleClient = await pool.connect();
  try {
    await staleClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await bindOperationalScope(staleClient, {
      grantId,
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.provider_run.create',
    });
    const { rows: visibleGrantRows } = await staleClient.query({
      text: `SELECT grant_id FROM lor_studio.administrative_case_grants
        WHERE grant_id = $1`,
      values: [grantId],
    });
    assert.deepEqual(visibleGrantRows, [{ grant_id: grantId }]);

    const revocationHash = sha256('disposable-local-repeatable-read-grant-revocation');
    const revocation = await pool.query({
      text: `INSERT INTO lor_studio.administrative_case_grant_revocations
        (grant_id, case_id, student_auth_subject, grant_hash, revoked_at,
         revoked_by_authority, reason_code, audit_event_ref, revocation_hash)
        SELECT administrative_grant.grant_id,
          administrative_grant.case_id,
          administrative_grant.student_auth_subject,
          administrative_grant.grant_hash,
          '2026-08-20T12:10:00.000Z'::timestamptz,
          'privacy-authority:disposable-local-security-review',
          'REPEATABLE_READ_STALE_SNAPSHOT_PROBE',
          audit_event.event_ref,
          $2
        FROM lor_studio.administrative_case_grants AS administrative_grant
        CROSS JOIN LATERAL (
          SELECT event_ref
          FROM lor_studio.recommendation_case_audit_events
          WHERE case_id = administrative_grant.case_id
            AND student_auth_subject = administrative_grant.student_auth_subject
          ORDER BY occurred_at, event_ref
          LIMIT 1
        ) AS audit_event
        WHERE administrative_grant.grant_id = $1`,
      values: [grantId, revocationHash],
    });
    assert.equal(revocation.rowCount, 1);

    const { rows: staleRevocationRows } = await staleClient.query({
      text: `SELECT grant_id FROM lor_studio.administrative_case_grant_revocations
        WHERE grant_id = $1`,
      values: [grantId],
    });
    assert.deepEqual(staleRevocationRows, []);
    const { rows: [repeatableReadDecision] } = await staleClient.query({
      text: `SELECT lor_studio.operational_content_context_allows(
        $1, $2, ARRAY['save']::text[], ARRAY['create_ai_generation']::text[]
      ) AS allowed`,
      values: [CASE_ID, STUDENT],
    });
    assert.equal(repeatableReadDecision.allowed, false);
    await staleClient.query('ROLLBACK');

    const readCommittedAllowed = await withOperationalScope(pool, {
      grantId,
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.provider_run.create',
    }, async (client) => (await client.query({
      text: `SELECT lor_studio.operational_content_context_allows(
        $1, $2, ARRAY['save']::text[], ARRAY['create_ai_generation']::text[]
      ) AS allowed`,
      values: [CASE_ID, STUDENT],
    })).rows[0].allowed);
    assert.equal(readCommittedAllowed, false);
  } finally {
    await staleClient.query('ROLLBACK').catch(() => {});
    staleClient.release();
  }
}

async function proveReservationRevocationRejectsRepeatableRead(pool) {
  const bindingId = 'binding_repeatable_read_reservation_probe';
  const idempotencyKey = 'idem-repeatable-read-revocation-probe';
  const creationRef = `case_creation_${hashValue({
    schemaVersion: 'missionmed.lor.case-creation-key.v1',
    actorId: REVOKED_STUDENT,
    idempotencyKey,
  })}`;
  await insertSyntheticStudentBinding(pool, {
    bindingId,
    studentId: REVOKED_STUDENT,
    authUid: REVOKED_AUTH_UID,
    sourceHash: sha256('synthetic-local-repeatable-read-binding-source'),
    proofHash: sha256('synthetic-local-repeatable-read-binding-proof'),
  });

  const attemptReservation = async (client, targetCreationRef = creationRef) => {
    await client.query('SET LOCAL ROLE lor_studio_app');
    await client.query({
      text: `SELECT
        pg_catalog.set_config('request.jwt.claim.sub', $1, true),
        pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
        pg_catalog.set_config('lor_studio.actor_role', 'student', true),
        pg_catalog.set_config('lor_studio.resource_student_id', $2, true),
        pg_catalog.set_config('lor_studio.case_id', $3, true),
        pg_catalog.set_config('lor_studio.operation', 'create', true),
        pg_catalog.set_config('lor_studio.purpose', 'student_case_write', true),
        pg_catalog.set_config('lor_studio.action', '', true),
        pg_catalog.set_config('lor_studio.invitation_id', '', true),
        pg_catalog.set_config('lor_studio.assignment_id', '', true),
        pg_catalog.set_config('lor_studio.administrative_grant_id', '', true),
        pg_catalog.set_config('lor_studio.entitlement_verified', 'true', true),
        pg_catalog.set_config('lor_studio.lor_enabled', 'true', true),
        pg_catalog.set_config('lor_studio.canary_authorized', 'true', true)`,
      values: [REVOKED_AUTH_UID, REVOKED_STUDENT, targetCreationRef],
    });
    return client.query({
      text: `INSERT INTO lor_studio.recommendation_case_creation_reservations
        (creation_ref, student_auth_subject, student_auth_uid, actor_ref,
         idempotency_key, request_hash, case_id, builder_session_id,
         created_at, transaction_id)
        VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8,
          $9::timestamptz, pg_catalog.txid_current()::text)`,
      values: [
        targetCreationRef,
        REVOKED_STUDENT,
        REVOKED_AUTH_UID,
        `actor_${sha256(`lor-studio:actor:${REVOKED_STUDENT}`)}`,
        idempotencyKey,
        hashValue({ operation: 'case.create', actorId: REVOKED_STUDENT, payload: {} }),
        'case_repeatable_read_revocation_probe',
        'builder_repeatable_read_revocation_probe',
        CREATED_AT,
      ],
    });
  };

  const squatClient = await pool.connect();
  try {
    await squatClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const victimCreationRef = `case_creation_${hashValue({
      schemaVersion: 'missionmed.lor.case-creation-key.v1',
      actorId: STUDENT,
      idempotencyKey,
    })}`;
    await assert.rejects(
      () => attemptReservation(squatClient, victimCreationRef),
      (error) => error?.code === '42501',
    );
    const { rows: [squatCount] } = await pool.query({
      text: `SELECT pg_catalog.count(*)::integer AS count
        FROM lor_studio.recommendation_case_creation_reservations
        WHERE creation_ref = $1`,
      values: [victimCreationRef],
    });
    assert.equal(squatCount.count, 0);
  } finally {
    await squatClient.query('ROLLBACK').catch(() => {});
    squatClient.release();
  }

  const staleClient = await pool.connect();
  try {
    await staleClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const { rows: visibleBindingRows } = await staleClient.query({
      text: `SELECT binding_id FROM lor_studio.student_auth_bindings
        WHERE binding_id = $1`,
      values: [bindingId],
    });
    assert.deepEqual(visibleBindingRows, [{ binding_id: bindingId }]);

    const revocation = await pool.query({
      text: `INSERT INTO lor_studio.student_auth_binding_revocations
        (binding_id, student_auth_subject, student_auth_uid, revoked_at,
         authority_ref, revocation_hash)
        VALUES ($1, $2, $3::uuid, $4::timestamptz, $5, $6)`,
      values: [
        bindingId,
        REVOKED_STUDENT,
        REVOKED_AUTH_UID,
        '2026-08-20T12:10:00.000Z',
        `authority_${sha256('disposable-local-repeatable-read-authority')}`,
        sha256('disposable-local-repeatable-read-binding-revocation'),
      ],
    });
    assert.equal(revocation.rowCount, 1);

    const { rows: staleRevocationRows } = await staleClient.query({
      text: `SELECT binding_id FROM lor_studio.student_auth_binding_revocations
        WHERE binding_id = $1`,
      values: [bindingId],
    });
    assert.deepEqual(staleRevocationRows, []);
    await assert.rejects(() => attemptReservation(staleClient), (error) => error?.code === '42501');
    await staleClient.query('ROLLBACK');

    const readCommittedClient = await pool.connect();
    try {
      await readCommittedClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await assert.rejects(
        () => attemptReservation(readCommittedClient),
        (error) => error?.code === '42501',
      );
    } finally {
      await readCommittedClient.query('ROLLBACK').catch(() => {});
      readCommittedClient.release();
    }

    const { rows: [reservationCount] } = await pool.query({
      text: `SELECT pg_catalog.count(*)::integer AS count
        FROM lor_studio.recommendation_case_creation_reservations
        WHERE creation_ref = $1`,
      values: [creationRef],
    });
    assert.equal(reservationCount.count, 0);
  } finally {
    await staleClient.query('ROLLBACK').catch(() => {});
    staleClient.release();
  }
}

async function proveActorSafeStudentCommand(pool) {
  await insertSyntheticStudentBinding(pool);
  await insertSyntheticStudentBinding(pool, {
    bindingId: 'binding_disposable_pg_matrix_other',
    studentId: OTHER_STUDENT,
    authUid: OTHER_AUTH_UID,
    sourceHash: sha256('synthetic-local-other-binding-source'),
    proofHash: sha256('synthetic-local-other-binding-proof'),
  });

  const executor = createNodePostgresExecutor({
    pool,
    databaseRole: NODE_POSTGRES_DATABASE_ROLE,
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const createIdempotencyKey = 'idem-disposable-pg-matrix-create';
  const creationRef = `case_creation_${hashValue({
    schemaVersion: 'missionmed.lor.case-creation-key.v1',
    actorId: STUDENT,
    idempotencyKey: createIdempotencyKey,
  })}`;
  const reservationRequestHash = hashValue({
    operation: 'case.create',
    actorId: STUDENT,
    payload: {},
  });
  const createRequestHash = hashValue({
    operation: 'case.create',
    caseId: CASE_ID,
    actorId: STUDENT,
    payload: {},
  });
  assert.notEqual(reservationRequestHash, createRequestHash);

  const reservation = await driver.reserveCaseCreation({
    binding: BINDING,
    scope: studentScope({ caseId: creationRef }),
    operation: 'reserve_create',
    creationRef,
    actorRef: `actor_${sha256(`lor-studio:actor:${STUDENT}`)}`,
    idempotencyKey: createIdempotencyKey,
    requestHash: reservationRequestHash,
    proposedIdentifiers: {
      caseId: CASE_ID,
      builderSessionId: BUILDER_SESSION_ID,
      createdAt: CREATED_AT,
    },
  });
  assert.equal(reservation.reserved, true);
  assert.equal(reservation.replayed, false);
  assert.equal(reservation.sameTransaction, true);
  assert.equal(reservation.creationRef, creationRef);
  assert.equal(reservation.requestHash, reservationRequestHash);
  assert.equal(reservation.caseId, CASE_ID);
  assert.equal(reservation.builderSessionId, BUILDER_SESSION_ID);
  assert.equal(reservation.createdAt, CREATED_AT);
  await assertCommandOwnerReservationCustody(pool, creationRef);

  const created = createStudentSafeRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT,
    actorId: STUDENT,
    builderSessionId: BUILDER_SESSION_ID,
    now: CREATED_AT,
  });
  const createEvent = transitionEvent(created, {
    eventId: 'disposable-pg-matrix-create',
    eventType: 'case.created',
  });
  const createCommand = studentCommand({
    transition: created,
    expectedRevision: null,
    idempotencyKey: createIdempotencyKey,
    requestHash: createRequestHash,
    event: createEvent,
  });
  const createReceipt = await driver.commitStudentCaseCreate(createCommand);
  assert.equal(createReceipt.committed, true);
  assert.equal(createReceipt.replayed, false);
  assert.equal(createReceipt.sameTransaction, true);
  assert.equal(createReceipt.caseId, CASE_ID);
  assert.deepEqual(createReceipt.state, created.state);

  const createReplay = await driver.commitStudentCaseCreate(createCommand);
  assert.deepEqual(createReplay, { ...createReceipt, replayed: true });

  const crossRuntimeCanonicalStepData = {
    programType: 'synthetic-local-md',
    tinyNumber: 1e-7,
    largeNumber: -1.25e+21,
    '\u{1F600}': 'non-bmp-key',
    '\uE000': 'bmp-private-use-key',
  };
  const autosaved = autosaveStudentSafeBuilderStep(created.state, {
    actorId: STUDENT,
    stepId: 'case_basics',
    stepData: crossRuntimeCanonicalStepData,
    now: '2026-08-20T12:01:00.000Z',
  });
  const autosaveEvent = transitionEvent(autosaved, {
    eventId: 'disposable-pg-matrix-autosave',
    eventType: 'builder.autosaved',
  });
  const autosaveCommand = studentCommand({
    transition: autosaved,
    expectedRevision: 0,
    idempotencyKey: 'idem-disposable-pg-matrix-autosave',
    requestHash: hashValue({
      operation: 'builder.autosave',
      caseId: CASE_ID,
      actorId: STUDENT,
      payload: {
        stepId: 'case_basics',
        stepData: crossRuntimeCanonicalStepData,
      },
    }),
    event: autosaveEvent,
  });
  const autosaveReceipt = await driver.commitStudentBuilderAutosave(autosaveCommand);
  assert.equal(autosaveReceipt.replayed, false);
  assert.deepEqual(autosaveReceipt.state, autosaved.state);

  const autosaveReplay = await driver.commitStudentBuilderAutosave(autosaveCommand);
  assert.deepEqual(autosaveReplay, { ...autosaveReceipt, replayed: true });

  const completed = completeStudentSafeBuilderStep(autosaved.state, {
    actorId: STUDENT,
    stepId: 'case_basics',
    now: '2026-08-20T12:02:00.000Z',
  });
  const completeEvent = transitionEvent(completed, {
    eventId: 'disposable-pg-matrix-complete',
    eventType: 'builder.step_completed',
  });
  const staleCompleteCommand = studentCommand({
    transition: completed,
    expectedRevision: 0,
    idempotencyKey: 'idem-disposable-pg-matrix-complete-stale',
    requestHash: hashValue({
      operation: 'builder.complete_step',
      caseId: CASE_ID,
      actorId: STUDENT,
      payload: { stepId: 'case_basics', staleProbe: 'synthetic-local' },
    }),
    event: completeEvent,
  });
  await assert.rejects(
    () => driver.commitStudentBuilderComplete(staleCompleteCommand),
    (error) => error?.code === 'STALE_REVISION'
      && error?.details?.caseId === CASE_ID
      && error?.details?.expectedRevision === 0
      && error?.details?.actualRevision === null,
  );

  const completeCommand = studentCommand({
    transition: completed,
    expectedRevision: 1,
    idempotencyKey: 'idem-disposable-pg-matrix-complete',
    requestHash: hashValue({
      operation: 'builder.complete_step',
      caseId: CASE_ID,
      actorId: STUDENT,
      payload: { stepId: 'case_basics' },
    }),
    event: completeEvent,
  });
  const completeReceipt = await driver.commitStudentBuilderComplete(completeCommand);
  assert.equal(completeReceipt.replayed, false);
  assert.deepEqual(completeReceipt.state, completed.state);

  const consent = createConsentReceipt({
    id: CONSENT_RECEIPT_ID,
    caseId: CASE_ID,
    studentId: STUDENT,
    scopes: ['faculty_handoff', 'letter_drafting'],
    policyVersion: 'synthetic-local-policy-v1',
    recordedAt: '2026-08-20T12:03:00.000Z',
  });
  const consented = appendStudentSafeReceipt(completed.state, {
    actorId: STUDENT,
    receiptType: 'consent',
    receipt: consent,
    now: consent.recordedAt,
  });
  const consentEvent = transitionEvent(consented, {
    eventId: 'disposable-pg-matrix-consent',
    eventType: 'consent.recorded',
  });
  const consentCommand = studentCommand({
    transition: consented,
    expectedRevision: 2,
    idempotencyKey: 'idem-disposable-pg-matrix-consent',
    requestHash: hashValue({
      operation: 'consent.record',
      caseId: CASE_ID,
      actorId: STUDENT,
      payload: {
        receiptType: 'consent',
        receiptData: {
          policyVersion: consent.policyVersion,
          scopes: consent.scopes,
        },
      },
    }),
    event: consentEvent,
    receipt: consent,
  });
  const consentCommandReceipt = await driver.commitStudentConsentReceipt(consentCommand);
  assert.equal(consentCommandReceipt.replayed, false);
  assert.deepEqual(consentCommandReceipt.state, consented.state);

  const waiver = createWaiverReceipt({
    id: WAIVER_RECEIPT_ID,
    caseId: CASE_ID,
    studentId: STUDENT,
    waived: false,
    policyVersion: 'synthetic-local-policy-v1',
    priorReceiptId: null,
    acknowledgment: 'Synthetic local disclosure decision.',
    recordedAt: '2026-08-20T12:04:00.000Z',
  });
  const waived = appendStudentSafeReceipt(consented.state, {
    actorId: STUDENT,
    receiptType: 'waiver',
    receipt: waiver,
    now: waiver.recordedAt,
  });
  const waiverEvent = transitionEvent(waived, {
    eventId: 'disposable-pg-matrix-waiver',
    eventType: 'waiver.recorded',
  });
  const waiverCommand = studentCommand({
    transition: waived,
    expectedRevision: 3,
    idempotencyKey: 'idem-disposable-pg-matrix-waiver',
    requestHash: hashValue({
      operation: 'waiver.record',
      caseId: CASE_ID,
      actorId: STUDENT,
      payload: {
        receiptType: 'waiver',
        receiptData: {
          acknowledgment: waiver.acknowledgment,
          policyVersion: waiver.policyVersion,
          priorReceiptId: waiver.priorReceiptId,
          waived: waiver.waived,
        },
      },
    }),
    event: waiverEvent,
    receipt: waiver,
  });
  const waiverCommandReceipt = await driver.commitStudentWaiverReceipt(waiverCommand);
  assert.equal(waiverCommandReceipt.replayed, false);
  assert.deepEqual(waiverCommandReceipt.state, waived.state);

  const read = await driver.readStudentSafeCase({
    binding: BINDING,
    scope: studentScope({ operation: 'read' }),
    caseId: CASE_ID,
  });
  assert.equal(read.found, true);
  assert.deepEqual(read.state, waived.state);

  const wrongStudentRead = await driver.readStudentSafeCase({
    binding: BINDING,
    scope: studentScope({
      operation: 'read',
      resourceStudentId: OTHER_STUDENT,
      authUid: OTHER_AUTH_UID,
    }),
    caseId: CASE_ID,
  });
  assert.deepEqual(wrongStudentRead, { found: false, state: null });
  const crossCaseRead = await driver.readStudentSafeCase({
    binding: BINDING,
    scope: studentScope({ operation: 'read', caseId: OTHER_CASE_ID }),
    caseId: OTHER_CASE_ID,
  });
  assert.deepEqual(crossCaseRead, { found: false, state: null });
  await assert.rejects(
    () => driver.commitStudentWaiverReceipt({
      ...waiverCommand,
      scope: studentScope({
        operation: 'save',
        resourceStudentId: OTHER_STUDENT,
        authUid: OTHER_AUTH_UID,
      }),
    }),
    (error) => error?.code === 'AUTHORIZATION_DENIED',
  );
  await assert.rejects(
    () => driver.commitStudentWaiverReceipt({
      ...waiverCommand,
      scope: studentScope({ operation: 'save', caseId: OTHER_CASE_ID }),
    }),
    (error) => error?.code === 'DOMAIN_INVARIANT',
  );

  const directDmlStatements = [
    {
      text: `INSERT INTO lor_studio.recommendation_cases
        (case_id, student_auth_subject, student_auth_uid, revision, status,
         created_at, updated_at, record, record_hash, protected_state_hash)
        VALUES ('case_forbidden', 'wp:999', $1::uuid, 0, 'draft', now(), now(),
          '{}'::jsonb, $2, $2)`,
      values: [AUTH_UID, HASH_A],
    },
    {
      text: `UPDATE lor_studio.recommendation_cases
        SET updated_at = updated_at WHERE case_id = $1`,
      values: [CASE_ID],
    },
    { text: 'INSERT INTO lor_studio.recommendation_case_audit_events DEFAULT VALUES' },
    {
      text: `INSERT INTO lor_studio.recommendation_case_protected_revision_states
        DEFAULT VALUES`,
    },
    { text: 'INSERT INTO lor_studio.recommendation_case_write_receipts DEFAULT VALUES' },
    { text: 'INSERT INTO lor_studio.consent_receipts DEFAULT VALUES' },
    { text: 'INSERT INTO lor_studio.waiver_receipts DEFAULT VALUES' },
  ];
  for (const statement of directDmlStatements) {
    await assertDirectAppDmlDenied(pool, statement.text, statement.values);
  }

  const { rows: [counts] } = await pool.query({
    text: `SELECT
      (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_cases
        WHERE case_id = $1) AS cases,
      (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_case_audit_events
        WHERE case_id = $1) AS audits,
      (SELECT pg_catalog.count(*)
        FROM lor_studio.recommendation_case_protected_revision_states
        WHERE case_id = $1) AS protected_states,
      (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_case_write_receipts
        WHERE case_id = $1) AS write_receipts,
      (SELECT pg_catalog.count(*) FROM lor_studio.consent_receipts
        WHERE case_id = $1) AS consents,
      (SELECT pg_catalog.count(*) FROM lor_studio.waiver_receipts
        WHERE case_id = $1) AS waivers`,
    values: [CASE_ID],
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, integer(value)])),
    {
      cases: 1,
      audits: 5,
      protected_states: 5,
      write_receipts: 5,
      consents: 1,
      waivers: 1,
    },
  );

  const { rows: [persistedCase] } = await pool.query({
    text: `SELECT revision, record_hash, protected_state_hash,
      lor_studio.canonical_jsonb_sha256(record) AS recomputed_record_hash
      FROM lor_studio.recommendation_cases
      WHERE case_id = $1 AND student_auth_subject = $2`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(integer(persistedCase.revision), 4);
  assert.equal(persistedCase.record_hash, persistedCase.recomputed_record_hash);
  assert.equal(persistedCase.record_hash, waiverCommandReceipt.safeRecordHash);
  assert.equal(persistedCase.protected_state_hash, waiverCommandReceipt.protectedStateHash);

  const { rows: protectedRows } = await pool.query({
    text: `SELECT revision, previous_revision, previous_protected_state_hash,
      protected_state_hash, event_hash, audit_event_ref, transaction_id,
      lor_studio.protected_state_chain_hash(
        case_id, student_auth_subject, revision, previous_protected_state_hash,
        event_hash, protected_state
      ) AS recomputed_protected_state_hash
      FROM lor_studio.recommendation_case_protected_revision_states
      WHERE case_id = $1 AND student_auth_subject = $2
      ORDER BY revision`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(protectedRows.length, 5);
  for (const [index, row] of protectedRows.entries()) {
    assert.equal(integer(row.revision), index);
    assert.equal(row.protected_state_hash, row.recomputed_protected_state_hash);
    if (index === 0) {
      assert.equal(row.previous_revision, null);
      assert.equal(row.previous_protected_state_hash, null);
    } else {
      assert.equal(integer(row.previous_revision), index - 1);
      assert.equal(row.previous_protected_state_hash, protectedRows[index - 1].protected_state_hash);
    }
  }

  const { rows: writeRows } = await pool.query({
    text: `SELECT revision, command_type, idempotency_key, request_hash,
      record_hash, protected_state_hash, event_hash, audit_event_ref, transaction_id,
      lor_studio.canonical_jsonb_sha256(record) AS recomputed_record_hash
      FROM lor_studio.recommendation_case_write_receipts
      WHERE case_id = $1 AND student_auth_subject = $2
      ORDER BY revision`,
    values: [CASE_ID, STUDENT],
  });
  assert.deepEqual(writeRows.map((row) => row.command_type), [
    'student.case.create',
    'student.builder.autosave',
    'student.builder.complete',
    'student.consent.record',
    'student.waiver.record',
  ]);
  const commandReceipts = [
    createReceipt,
    autosaveReceipt,
    completeReceipt,
    consentCommandReceipt,
    waiverCommandReceipt,
  ];
  for (const [index, row] of writeRows.entries()) {
    const commandReceipt = commandReceipts[index];
    assert.equal(integer(row.revision), index);
    assert.equal(row.record_hash, row.recomputed_record_hash);
    assert.equal(row.record_hash, commandReceipt.safeRecordHash);
    assert.equal(row.protected_state_hash, protectedRows[index].protected_state_hash);
    assert.equal(row.protected_state_hash, commandReceipt.protectedStateHash);
    assert.equal(row.event_hash, protectedRows[index].event_hash);
    assert.equal(row.event_hash, commandReceipt.eventHash);
    assert.equal(row.audit_event_ref, protectedRows[index].audit_event_ref);
    assert.equal(row.audit_event_ref, commandReceipt.auditEventRef);
    assert.equal(row.transaction_id, protectedRows[index].transaction_id);
    assert.equal(row.transaction_id, commandReceipt.transactionId);
  }

  const { rows: auditRows } = await pool.query({
    text: `SELECT revision, event_hash, transaction_id,
      lor_studio.canonical_jsonb_sha256(event) AS recomputed_event_hash
      FROM lor_studio.recommendation_case_audit_events
      WHERE case_id = $1 AND student_auth_subject = $2
      ORDER BY revision`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(auditRows.length, 5);
  for (const [index, row] of auditRows.entries()) {
    assert.equal(integer(row.revision), index);
    assert.equal(row.event_hash, row.recomputed_event_hash);
    assert.equal(row.event_hash, writeRows[index].event_hash);
    assert.equal(row.transaction_id, writeRows[index].transaction_id);
  }

  const { rows: [persistedConsent] } = await pool.query({
    text: `SELECT receipt_id, case_revision, scopes, policy_version, recorded_at, receipt_hash
      FROM lor_studio.consent_receipts
      WHERE case_id = $1 AND student_auth_subject = $2`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(persistedConsent.receipt_id, consent.id);
  assert.equal(integer(persistedConsent.case_revision), 3);
  assert.deepEqual(persistedConsent.scopes, consent.scopes);
  assert.equal(persistedConsent.policy_version, consent.policyVersion);
  assert.equal(new Date(persistedConsent.recorded_at).toISOString(), consent.recordedAt);
  assert.equal(persistedConsent.receipt_hash, consent.receiptHash);

  const { rows: [persistedWaiver] } = await pool.query({
    text: `SELECT receipt_id, case_revision, prior_receipt_id, waived, policy_version,
      acknowledgment, recorded_at, receipt_hash
      FROM lor_studio.waiver_receipts
      WHERE case_id = $1 AND student_auth_subject = $2`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(persistedWaiver.receipt_id, waiver.id);
  assert.equal(integer(persistedWaiver.case_revision), 4);
  assert.equal(persistedWaiver.prior_receipt_id, waiver.priorReceiptId);
  assert.equal(persistedWaiver.waived, waiver.waived);
  assert.equal(persistedWaiver.policy_version, waiver.policyVersion);
  assert.equal(persistedWaiver.acknowledgment, waiver.acknowledgment);
  assert.equal(new Date(persistedWaiver.recorded_at).toISOString(), waiver.recordedAt);
  assert.equal(persistedWaiver.receipt_hash, waiver.receiptHash);
}

function syntheticFacultyPrivateRecord({ released = false } = {}) {
  const documentHash = hashValue({
    contentHash: null,
    id: FINAL_DOCUMENT_ID,
    mimeType: null,
    text: FINAL_DOCUMENT_TEXT,
  });
  return {
    facultyPrivate: {
      answers: [],
      notes: [],
      draftText: FACULTY_DRAFT_TEXT,
      finalDocument: {
        contentHash: null,
        id: FINAL_DOCUMENT_ID,
        mimeType: null,
        text: FINAL_DOCUMENT_TEXT,
        releasedToStudentAt: released ? FACULTY_RELEASED_AT : null,
      },
    },
    finalDocumentState: {
      documentState: 'faculty_final',
      facultyApproval: {
        approved: true,
        approvedAt: FACULTY_APPROVED_AT,
        facultyId: FACULTY,
        signatureAttested: true,
      },
      release: released
        ? {
          documentHash,
          documentId: FINAL_DOCUMENT_ID,
          releasedAt: FACULTY_RELEASED_AT,
          releasedAtRevision: 5,
          waiverReceiptId: WAIVER_RECEIPT_ID,
        }
        : null,
    },
  };
}

function releasedStudentSnapshot() {
  const documentHash = hashValue({
    contentHash: null,
    id: FINAL_DOCUMENT_ID,
    mimeType: null,
    text: FINAL_DOCUMENT_TEXT,
  });
  const finalDocument = {
    id: FINAL_DOCUMENT_ID,
    text: FINAL_DOCUMENT_TEXT,
    contentHash: null,
    mimeType: null,
    releasedToStudentAt: FACULTY_RELEASED_AT,
  };
  const facultyApproval = {
    approved: true,
    approvedAt: FACULTY_APPROVED_AT,
    facultyRef: `faculty_${sha256(`lor-studio:faculty:${FACULTY}`)}`,
    signatureAttested: true,
  };
  const release = {
    documentId: FINAL_DOCUMENT_ID,
    documentHash,
    releasedAt: FACULTY_RELEASED_AT,
    releasedAtRevision: 5,
    waiverReceiptId: WAIVER_RECEIPT_ID,
  };
  return {
    finalDocument,
    facultyApproval,
    release,
    snapshotHash: hashValue({ finalDocument, facultyApproval, release }),
  };
}

async function seedSyntheticFacultyPrerequisites(pool) {
  // Privileged disposable-local fixture only. This does not claim that invitation or OTP
  // issuance, delivery, verification, or provider binding is operational in any environment.
  const recipientEmailHash = sha256('synthetic-local-faculty-recipient');
  const challengeCodeHash = sha256('synthetic-local-faculty-otp-code');
  const preReleasePrivateRecord = syntheticFacultyPrivateRecord();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [audit] } = await client.query({
      text: `SELECT event_ref
        FROM lor_studio.recommendation_case_audit_events
        WHERE case_id = $1 AND student_auth_subject = $2 AND revision = 4
          AND event_type = 'waiver.recorded'`,
      values: [CASE_ID, STUDENT],
    });
    assert.ok(audit?.event_ref);

    await client.query({
      text: `INSERT INTO lor_studio.faculty_invitations (
        invitation_id, case_id, student_auth_subject, faculty_auth_subject,
        faculty_auth_uid, recipient_email_hash, token_hash, revision,
        failed_attempts, max_attempts, attempt_window_ms, lockout_ms,
        attempt_window_started_at, locked_until, last_failure_code,
        created_at, expires_at, used_at, revoked_at, updated_at
      ) VALUES (
        $1, $2, $3, NULL, NULL, $4, $5, 0,
        0, 3, 600000, 600000, NULL, NULL, NULL,
        $6::timestamptz, $7::timestamptz, NULL, NULL, $6::timestamptz
      )`,
      values: [
        FACULTY_INVITATION_ID,
        CASE_ID,
        STUDENT,
        recipientEmailHash,
        sha256('synthetic-local-faculty-invitation-token'),
        '2026-08-20T12:04:20.000Z',
        FACULTY_FIXTURE_EXPIRES_AT,
      ],
    });
    await client.query({
      text: `INSERT INTO lor_studio.faculty_otp_challenges (
        challenge_id, invitation_id, case_id, student_auth_subject,
        recipient_email_hash, otp_code_hash, issued_at, expires_at, challenge_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9
      )`,
      values: [
        FACULTY_CHALLENGE_ID,
        FACULTY_INVITATION_ID,
        CASE_ID,
        STUDENT,
        recipientEmailHash,
        challengeCodeHash,
        '2026-08-20T12:04:30.000Z',
        FACULTY_FIXTURE_EXPIRES_AT,
        hashValue({
          schemaVersion: 'missionmed.lor.synthetic-local-otp-challenge.v1',
          challengeId: FACULTY_CHALLENGE_ID,
          invitationId: FACULTY_INVITATION_ID,
          recipientEmailHash,
          otpCodeHash: challengeCodeHash,
        }),
      ],
    });
    await client.query({
      text: `UPDATE lor_studio.faculty_invitations
        SET faculty_auth_subject = $1,
            faculty_auth_uid = $2::uuid,
            revision = revision + 1,
            used_at = $3::timestamptz,
            updated_at = $3::timestamptz
        WHERE invitation_id = $4`,
      values: [
        FACULTY,
        FACULTY_AUTH_UID,
        '2026-08-20T12:04:50.000Z',
        FACULTY_INVITATION_ID,
      ],
    });
    await client.query({
      text: `INSERT INTO lor_studio.faculty_otp_verification_receipts (
        receipt_id, challenge_id, invitation_id, case_id, student_auth_subject,
        faculty_auth_subject, faculty_auth_uid, recipient_email_hash, otp_proof_ref,
        otp_verified_at, otp_expires_at, otp_revoked, principal_authority,
        invitation_used_at, audit_event_ref, transaction_id, receipt_hash, committed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::uuid, $8, $9,
        $10::timestamptz, $11::timestamptz, false, 'durable_otp_provider_proof',
        $12::timestamptz, $13, pg_catalog.pg_current_xact_id()::text, $14,
        pg_catalog.transaction_timestamp()
      )`,
      values: [
        FACULTY_OTP_RECEIPT_ID,
        FACULTY_CHALLENGE_ID,
        FACULTY_INVITATION_ID,
        CASE_ID,
        STUDENT,
        FACULTY,
        FACULTY_AUTH_UID,
        recipientEmailHash,
        sha256('synthetic-local-faculty-otp-proof'),
        '2026-08-20T12:04:40.000Z',
        FACULTY_FIXTURE_EXPIRES_AT,
        '2026-08-20T12:04:50.000Z',
        audit.event_ref,
        hashValue({
          schemaVersion: 'missionmed.lor.synthetic-local-otp-verification.v1',
          receiptId: FACULTY_OTP_RECEIPT_ID,
          challengeId: FACULTY_CHALLENGE_ID,
          invitationId: FACULTY_INVITATION_ID,
          facultyId: FACULTY,
          facultyAuthUid: FACULTY_AUTH_UID,
        }),
      ],
    });

    // No actor-safe lifecycle command exists in this slice. This one status re-anchor is the
    // only trigger-bypassed fixture mutation and is required to reach the approved release ABI.
    await client.query("SET LOCAL session_replication_role = 'replica'");
    const statusUpdate = await client.query({
      text: `UPDATE lor_studio.recommendation_cases
        SET status = 'faculty_approved'
        WHERE case_id = $1 AND student_auth_subject = $2 AND revision = 4`,
      values: [CASE_ID, STUDENT],
    });
    assert.equal(statusUpdate.rowCount, 1);
    await client.query("SET LOCAL session_replication_role = 'origin'");

    await client.query({
      text: `INSERT INTO lor_studio.faculty_private_content (
        case_id, student_auth_subject, faculty_auth_subject, faculty_auth_uid,
        invitation_id, private_revision, answers, notes, draft_text,
        final_document_id, final_document_text, final_document_content_hash,
        final_document_mime_type, document_state, approval_approved, approval_at,
        approval_faculty_auth_subject, approval_signature_attested,
        release_document_hash, release_document_id, released_at,
        released_at_revision, release_waiver_receipt_id, private_record_hash,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4::uuid, $5, 4, '[]'::jsonb, '[]'::jsonb, $6,
        $7, $8, NULL, NULL, 'faculty_final', true, $9::timestamptz,
        $3, true, NULL, NULL, NULL, NULL, NULL, $10,
        $9::timestamptz, $9::timestamptz
      )`,
      values: [
        CASE_ID,
        STUDENT,
        FACULTY,
        FACULTY_AUTH_UID,
        FACULTY_INVITATION_ID,
        FACULTY_DRAFT_TEXT,
        FINAL_DOCUMENT_ID,
        FINAL_DOCUMENT_TEXT,
        FACULTY_APPROVED_AT,
        hashValue(preReleasePrivateRecord),
      ],
    });
    await client.query('COMMIT');
    return preReleasePrivateRecord;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function proveIdentityScopeSuccessor({ harness, pool, contract, postgresMajor }) {
  await applyForward(harness);
  await assert.rejects(
    () => harness.applySqlFile(productionIdentityScopePath),
    isSqlApplyFailure,
  );
  const { rows: [rejectedProductionState] } = await pool.query(`SELECT
    pg_catalog.to_regprocedure(
      'lor_studio.ensure_student_auth_binding(text,text,text)'
    ) IS NULL AS successor_absent,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      NOT LIKE '%|identityScope=%' AS base_sentinel_unchanged
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(rejectedProductionState, {
    successor_absent: true,
    base_sentinel_unchanged: true,
  });
  await pool.query('GRANT lor_studio_command_owner TO lor_studio_app');
  await assert.rejects(
    () => harness.applySqlFile(identityScopePath),
    isSqlApplyFailure,
  );
  const { rows: [membershipRejectedState] } = await pool.query(`SELECT
    pg_catalog.to_regprocedure(
      'lor_studio.ensure_student_auth_binding(text,text,text)'
    ) IS NULL AS successor_absent,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      NOT LIKE '%|identityScope=%' AS base_sentinel_unchanged
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(membershipRejectedState, rejectedProductionState);
  await pool.query('REVOKE lor_studio_command_owner FROM lor_studio_app');
  await harness.applySqlFile(identityScopePath);

  const missingContextClient = await pool.connect();
  try {
    await missingContextClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await missingContextClient.query('SET LOCAL ROLE lor_studio_app');
    await assert.rejects(
      () => missingContextClient.query({
        text: `SELECT lor_studio.ensure_student_auth_binding($1, $2, $3) AS result`,
        values: [IDENTITY_SUBJECT, IDENTITY_SOURCE_HASH, IDENTITY_PROOF_HASH],
      }),
      (error) => error?.code === 'P1101',
    );
  } finally {
    await missingContextClient.query('ROLLBACK').catch(() => {});
    missingContextClient.release();
  }

  const oversizedWordPressSubject = `wp:${'1'.repeat(198)}`;
  assert.equal(oversizedWordPressSubject.length, 201);
  await assert.rejects(
    () => withIdentityResolutionContext(pool, {
      actorRole: 'service',
      subject: oversizedWordPressSubject,
      operation: 'ensure_student_binding',
      purpose: 'wordpress_verified_bootstrap',
      trustedServiceActor: 'wordpress-admission-v2',
    }, (client) => client.query({
      text: `SELECT lor_studio.ensure_student_auth_binding($1, $2, $3) AS result`,
      values: [oversizedWordPressSubject, IDENTITY_SOURCE_HASH, IDENTITY_PROOF_HASH],
    })),
    (error) => error?.code === 'P1105',
  );

  await assertDirectAppDmlDenied(
    pool,
    `INSERT INTO lor_studio.student_auth_bindings
      (binding_id, student_auth_subject, student_auth_uid, binding_source,
       source_reference_hash, proof_hash, bound_at, expires_at)
      VALUES ('forbidden_direct_identity_binding', $1,
        '00000000-0000-5000-a000-000000000000'::uuid,
        'wordpress_verified_bootstrap', $2, $3,
        pg_catalog.statement_timestamp(), NULL)`,
    [IDENTITY_SUBJECT, IDENTITY_SOURCE_HASH, IDENTITY_PROOF_HASH],
  );

  const ensureBinding = () => withIdentityResolutionContext(pool, {
    actorRole: 'service',
    subject: IDENTITY_SUBJECT,
    operation: 'ensure_student_binding',
    purpose: 'wordpress_verified_bootstrap',
    trustedServiceActor: 'wordpress-admission-v2',
  }, async (client) => (await client.query({
    text: `SELECT lor_studio.ensure_student_auth_binding($1, $2, $3) AS result`,
    values: [IDENTITY_SUBJECT, IDENTITY_SOURCE_HASH, IDENTITY_PROOF_HASH],
  })).rows[0].result);

  const ensured = await ensureBinding();
  assert.equal(ensured.schemaVersion, 'missionmed.lor.student-auth-binding-receipt.v1');
  assert.equal(ensured.studentAuthSubject, IDENTITY_SUBJECT);
  assert.equal(ensured.bindingSource, 'wordpress_verified_bootstrap');
  assert.equal(ensured.sourceReferenceHash, IDENTITY_SOURCE_HASH);
  assert.equal(ensured.replayed, false);
  assert.match(ensured.studentAuthUid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.match(ensured.bindingId, /^binding_[a-f0-9]{64}$/u);
  assert.equal('proofHash' in ensured, false);

  const ensureReplay = await ensureBinding();
  assert.deepEqual(ensureReplay, { ...ensured, replayed: true });

  await assert.rejects(
    () => withIdentityResolutionContext(pool, {
      actorRole: 'service',
      subject: IDENTITY_SUBJECT,
      operation: 'ensure_student_binding',
      purpose: 'wordpress_verified_bootstrap',
      trustedServiceActor: 'wordpress-admission-v2',
    }, (client) => client.query({
      text: `SELECT lor_studio.ensure_student_auth_binding($1, $2, $3) AS result`,
      values: [IDENTITY_SUBJECT, IDENTITY_SOURCE_HASH, sha256('conflicting-proof')],
    })),
    (error) => error?.code === 'P1102',
  );

  const revokeBinding = () => withIdentityResolutionContext(pool, {
    actorRole: 'service',
    subject: IDENTITY_SUBJECT,
    operation: 'revoke_student_binding',
    purpose: 'wordpress_verified_bootstrap',
    trustedServiceActor: 'wordpress-admission-v2',
  }, async (client) => (await client.query({
    text: `SELECT lor_studio.revoke_student_auth_binding($1, $2) AS result`,
    values: [IDENTITY_SUBJECT, 'WORDPRESS_ACCESS_REVOKED'],
  })).rows[0].result);

  const revoked = await revokeBinding();
  assert.equal(revoked.schemaVersion, 'missionmed.lor.student-auth-binding-revocation-receipt.v1');
  assert.equal(revoked.studentAuthSubject, IDENTITY_SUBJECT);
  assert.equal(revoked.studentAuthUid, ensured.studentAuthUid);
  assert.equal(revoked.bindingId, ensured.bindingId);
  assert.match(revoked.authorityRef, /^authority_[a-f0-9]{64}$/u);
  assert.equal(revoked.reasonCode, 'WORDPRESS_ACCESS_REVOKED');
  assert.match(revoked.revocationHash, /^[a-f0-9]{64}$/u);
  assert.equal(revoked.replayed, false);
  assert.deepEqual(await revokeBinding(), { ...revoked, replayed: true });
  await assert.rejects(
    () => withIdentityResolutionContext(pool, {
      actorRole: 'service',
      subject: IDENTITY_SUBJECT,
      operation: 'revoke_student_binding',
      purpose: 'wordpress_verified_bootstrap',
      trustedServiceActor: 'wordpress-admission-v2',
    }, (client) => client.query({
      text: `SELECT lor_studio.revoke_student_auth_binding($1, $2) AS result`,
      values: [IDENTITY_SUBJECT, 'DIFFERENT_REVOCATION_REASON'],
    })),
    (error) => error?.code === 'P1102',
  );
  await assert.rejects(ensureBinding, (error) => error?.code === 'P1102');

  await pool.query({
    text: `INSERT INTO lor_studio.student_auth_bindings
      (binding_id, student_auth_subject, student_auth_uid, binding_source,
       source_reference_hash, proof_hash, bound_at, expires_at)
      VALUES ('binding_synthetic_ambiguous_identity', $1,
        '11111111-1111-5111-a111-111111111111'::uuid,
        'wordpress_verified_bootstrap', $2, $3,
        '2026-08-20T12:00:00.000Z'::timestamptz, NULL)`,
    values: [
      IDENTITY_SUBJECT,
      sha256('synthetic-local-ambiguous-binding-source'),
      sha256('synthetic-local-ambiguous-binding-proof'),
    ],
  });
  await assert.rejects(revokeBinding, (error) => error?.code === 'P1102');

  await proveActorSafeStudentCommand(pool);
  await seedSyntheticFacultyPrerequisites(pool);

  const resolveFaculty = ({
    subject = FACULTY,
    caseId = CASE_ID,
    operation = 'read',
  } = {}) => withIdentityResolutionContext(pool, {
    actorRole: 'faculty',
    subject,
    caseId,
    operation,
    purpose: 'faculty_scope_resolution',
  }, async (client) => (await client.query({
    text: `SELECT lor_studio.resolve_faculty_case_scope($1, $2, $3) AS result`,
    values: [subject, caseId, operation],
  })).rows[0].result);

  const facultyResolved = await resolveFaculty();
  assert.deepEqual(facultyResolved, {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: FACULTY_AUTH_UID,
    authenticatedSubject: FACULTY,
    actorId: FACULTY,
    actorRole: 'faculty',
    resourceStudentId: STUDENT,
    caseId: CASE_ID,
    operation: 'read',
    purpose: 'faculty_private_edit',
    assignmentId: null,
    invitationId: FACULTY_INVITATION_ID,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  });
  assert.deepEqual(await resolveFaculty({ operation: 'save' }), {
    ...facultyResolved,
    operation: 'save',
  });
  await assert.rejects(
    () => withIdentityResolutionContext(pool, {
      actorRole: 'faculty',
      subject: FACULTY,
      caseId: CASE_ID,
      operation: 'read',
      purpose: 'faculty_scope_resolution',
    }, (client) => client.query({
      text: `SELECT lor_studio.resolve_faculty_case_scope($1, $2, 'release') AS result`,
      values: [FACULTY, CASE_ID],
    })),
    (error) => error?.code === 'P1205',
  );
  await assert.rejects(
    () => resolveFaculty({ subject: oversizedWordPressSubject }),
    (error) => error?.code === 'P1205',
  );
  assert.equal(await resolveFaculty({ subject: OTHER_FACULTY }), null);
  assert.equal(await resolveFaculty({ caseId: OTHER_CASE_ID }), null);

  await pool.query({
    text: `INSERT INTO lor_studio.mentor_case_assignments
      (assignment_id, case_id, student_auth_subject, mentor_auth_subject,
       mentor_auth_uid, operation, purpose, assigned_at, expires_at, assignment_hash)
      VALUES ($1, $2, $3, $4, $5::uuid, 'read', 'mentor_case_read',
        '2026-08-20T12:07:00.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz, $6)`,
    values: [
      MENTOR_ASSIGNMENT_ID,
      CASE_ID,
      STUDENT,
      MENTOR,
      MENTOR_AUTH_UID,
      sha256('synthetic-local-mentor-assignment-one'),
    ],
  });

  const resolveMentor = ({
    subject = MENTOR,
    caseId = CASE_ID,
    operation = 'read',
  } = {}) => withIdentityResolutionContext(pool, {
    actorRole: 'mentor',
    subject,
    caseId,
    operation,
    purpose: 'mentor_scope_resolution',
  }, async (client) => (await client.query({
    text: `SELECT lor_studio.resolve_mentor_case_scope($1, $2, $3) AS result`,
    values: [subject, caseId, operation],
  })).rows[0].result);

  assert.deepEqual(await resolveMentor(), {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: MENTOR_AUTH_UID,
    authenticatedSubject: MENTOR,
    actorId: MENTOR,
    actorRole: 'mentor',
    resourceStudentId: STUDENT,
    caseId: CASE_ID,
    operation: 'read',
    purpose: 'mentor_case_read',
    assignmentId: MENTOR_ASSIGNMENT_ID,
    invitationId: null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  });
  assert.equal(await resolveMentor({ subject: 'wp:97' }), null);
  assert.equal(await resolveMentor({ caseId: OTHER_CASE_ID }), null);
  await assert.rejects(
    () => resolveMentor({ subject: oversizedWordPressSubject }),
    (error) => error?.code === 'P1205',
  );

  await pool.query({
    text: `INSERT INTO lor_studio.mentor_case_assignments
      (assignment_id, case_id, student_auth_subject, mentor_auth_subject,
       mentor_auth_uid, operation, purpose, assigned_at, expires_at, assignment_hash)
      VALUES ('assignment_disposable_pg_matrix_oversized_purpose', $1, $2, 'wp:98',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'read', $3,
        '2026-08-20T12:07:15.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz, $4)`,
    values: [CASE_ID, STUDENT, 'x'.repeat(161), sha256('oversized-mentor-purpose')],
  });
  assert.equal(await resolveMentor({ subject: 'wp:98' }), null);

  await pool.query({
    text: `INSERT INTO lor_studio.mentor_case_assignments
      (assignment_id, case_id, student_auth_subject, mentor_auth_subject,
       mentor_auth_uid, operation, purpose, assigned_at, expires_at, assignment_hash)
      VALUES ($1, $2, $3, $4, $5::uuid, 'read', 'mentor_case_read',
        '2026-08-20T12:07:30.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz, $6)`,
    values: [
      MENTOR_ASSIGNMENT_ID_TWO,
      CASE_ID,
      STUDENT,
      MENTOR,
      MENTOR_AUTH_UID,
      sha256('synthetic-local-mentor-assignment-two'),
    ],
  });
  await assert.rejects(resolveMentor, (error) => error?.code === 'P1202');

  const { rows: [audit] } = await pool.query({
    text: `SELECT event_ref
      FROM lor_studio.recommendation_case_audit_events
      WHERE case_id = $1 AND student_auth_subject = $2
      ORDER BY revision, event_ref
      LIMIT 1`,
    values: [CASE_ID, STUDENT],
  });
  assert.ok(audit?.event_ref);
  await pool.query({
    text: `INSERT INTO lor_studio.faculty_otp_proof_revocations
      (receipt_id, case_id, student_auth_subject, revoked_at,
       reason_code, audit_event_ref, revocation_hash)
      VALUES ($1, $2, $3, pg_catalog.statement_timestamp(),
        'SECURITY_REVOKED', $4, $5)`,
    values: [
      FACULTY_OTP_RECEIPT_ID,
      CASE_ID,
      STUDENT,
      audit.event_ref,
      sha256('synthetic-local-faculty-proof-revocation'),
    ],
  });
  assert.equal(await resolveFaculty(), null);

  for (const [assignmentId, suffix] of [
    [MENTOR_ASSIGNMENT_ID, 'one'],
    [MENTOR_ASSIGNMENT_ID_TWO, 'two'],
  ]) {
    await pool.query({
      text: `INSERT INTO lor_studio.mentor_case_assignment_revocations
        (assignment_id, case_id, student_auth_subject, revoked_at, revocation_hash)
        VALUES ($1, $2, $3, pg_catalog.statement_timestamp(), $4)`,
      values: [
        assignmentId,
        CASE_ID,
        STUDENT,
        sha256(`synthetic-local-mentor-assignment-revocation-${suffix}`),
      ],
    });
  }
  assert.equal(await resolveMentor(), null);

  const snapshot = await catalogSnapshot(pool);
  assert.equal(snapshot.function_count, contract.expectedFinalFunctionCount + 6);
  assert.equal(snapshot.definer_count, contract.approvedSecurityDefinerFunctions.length + 4);
  assert.equal(snapshot.policy_count, contract.expectedFinalPolicyCount + 9);
  assert.equal(snapshot.forced_rls_count, contract.executableRelations.length);
  const { rows: [privileges] } = await pool.query(`SELECT
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.student_auth_bindings', 'INSERT'
    ) AS app_binding_insert,
    pg_catalog.has_table_privilege(
      'lor_studio_command_owner', 'lor_studio.student_auth_bindings', 'INSERT'
    ) AS command_binding_insert,
    pg_catalog.has_function_privilege(
      'lor_studio_app', 'lor_studio.resolve_faculty_case_scope(text,text,text)', 'EXECUTE'
    ) AS app_faculty_resolver_execute`);
  assert.deepEqual(privileges, {
    app_binding_insert: false,
    command_binding_insert: true,
    app_faculty_resolver_execute: true,
  });

  const { rows: [beforeRollback] } = await pool.query(`SELECT
    (SELECT pg_catalog.count(*) FROM lor_studio.student_auth_bindings) AS binding_count,
    (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_cases) AS case_count`);
  await harness.applySqlFile(identityScopeRollbackPath);
  await assertFinalCatalog(pool, contract, postgresMajor);
  const { rows: [afterRollback] } = await pool.query(`SELECT
    (SELECT pg_catalog.count(*) FROM lor_studio.student_auth_bindings) AS binding_count,
    (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_cases) AS case_count,
    pg_catalog.to_regprocedure(
      'lor_studio.ensure_student_auth_binding(text,text,text)'
    ) IS NULL AS successor_removed,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      NOT LIKE '%|identityScope=%' AS base_sentinel_restored
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(afterRollback, {
    ...beforeRollback,
    successor_removed: true,
    base_sentinel_restored: true,
  });
}

async function proveActorSafeFacultyRelease(pool) {
  const preReleasePrivateRecord = await seedSyntheticFacultyPrerequisites(pool);
  const executor = createNodePostgresExecutor({
    pool,
    databaseRole: NODE_POSTGRES_DATABASE_ROLE,
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });

  const studentBeforeRelease = await driver.readStudentSafeCase({
    binding: BINDING,
    scope: studentScope({ operation: 'read' }),
    caseId: CASE_ID,
  });
  assert.equal(studentBeforeRelease.found, true);
  assert.equal(studentBeforeRelease.state.status, 'faculty_approved');
  assert.equal(studentBeforeRelease.state.revision, 4);
  assert.equal(studentBeforeRelease.state.releasedDocument, null);

  const facultyReadRequest = {
    binding: BINDING,
    scope: facultyScope(),
    caseId: CASE_ID,
  };
  const facultyRead = await driver.readFacultyCaseProjection(facultyReadRequest);
  const latestWaiver = studentBeforeRelease.state.waiverReceipts.at(-1);
  const expectedFacultyBeforeRelease = {
    schemaVersion: 'missionmed.lor.faculty-projection.v1',
    caseId: CASE_ID,
    revision: 4,
    status: 'faculty_approved',
    studentShared: {
      evidence: studentBeforeRelease.state.studentEvidence,
      applicantOptions: studentBeforeRelease.state.applicantOptions,
      consentReceipts: studentBeforeRelease.state.consentReceipts,
      waiverState: {
        decided: true,
        waived: latestWaiver.waived,
        receiptId: latestWaiver.id,
      },
    },
    facultyPrivate: preReleasePrivateRecord.facultyPrivate,
    delivery: studentBeforeRelease.state.delivery,
  };
  assert.deepEqual(facultyRead, {
    found: true,
    projection: expectedFacultyBeforeRelease,
  });

  await assert.rejects(
    () => driver.readFacultyCaseProjection({
      ...facultyReadRequest,
      scope: facultyScope({
        actorId: OTHER_FACULTY,
        authUid: OTHER_FACULTY_AUTH_UID,
      }),
    }),
    (error) => error?.code === 'AUTHORIZATION_DENIED'
      && error?.details?.reasonCode === 'DATABASE_COMMAND_AUTHORIZATION_DENIED',
  );
  await assert.rejects(
    () => driver.readFacultyCaseProjection({
      ...facultyReadRequest,
      scope: facultyScope({ authenticatedSubject: OTHER_FACULTY }),
    }),
    (error) => error?.code === 'AUTHORIZATION_DENIED',
  );

  const idempotencyKey = 'idem-disposable-pg-matrix-faculty-release';
  const eventId = `event_${sha256(
    `${CASE_ID}:faculty.final_document_released:${idempotencyKey}`,
  ).slice(0, 32)}`;
  const correlationId = sha256(idempotencyKey).slice(0, 32);
  const releaseEvent = createMetadataServiceEvent({
    eventId,
    eventType: 'faculty.final_document_released',
    caseId: CASE_ID,
    actorId: FACULTY,
    actorRole: 'faculty',
    correlationId,
    revision: 5,
    occurredAt: FACULTY_RELEASED_AT,
  });
  const releaseRequestHash = hashValue({
    operation: 'faculty.final_document_release',
    caseId: CASE_ID,
    actorId: FACULTY,
    payload: { documentId: FINAL_DOCUMENT_ID },
  });
  const releaseCommand = {
    binding: BINDING,
    scope: facultyScope({ operation: 'save' }),
    expectedRevision: 4,
    documentId: FINAL_DOCUMENT_ID,
    idempotencyKey,
    requestHash: releaseRequestHash,
    event: releaseEvent,
  };
  const releaseReceipt = await driver.commitFacultyFinalDocumentRelease(releaseCommand);
  const expectedFacultyAfterRelease = {
    ...expectedFacultyBeforeRelease,
    revision: 5,
    facultyPrivate: {
      ...expectedFacultyBeforeRelease.facultyPrivate,
      finalDocument: {
        ...expectedFacultyBeforeRelease.facultyPrivate.finalDocument,
        releasedToStudentAt: FACULTY_RELEASED_AT,
      },
    },
  };
  assert.equal(releaseReceipt.committed, true);
  assert.equal(releaseReceipt.replayed, false);
  assert.equal(releaseReceipt.sameTransaction, true);
  assert.deepEqual(releaseReceipt.state, expectedFacultyAfterRelease);

  const releaseReplay = await driver.commitFacultyFinalDocumentRelease(releaseCommand);
  assert.deepEqual(releaseReplay, { ...releaseReceipt, replayed: true });

  const wrongFacultyEvent = createMetadataServiceEvent({
    eventId,
    eventType: 'faculty.final_document_released',
    caseId: CASE_ID,
    actorId: OTHER_FACULTY,
    actorRole: 'faculty',
    correlationId,
    revision: 5,
    occurredAt: FACULTY_RELEASED_AT,
  });
  await assert.rejects(
    () => driver.commitFacultyFinalDocumentRelease({
      ...releaseCommand,
      scope: facultyScope({
        operation: 'save',
        actorId: OTHER_FACULTY,
        authUid: OTHER_FACULTY_AUTH_UID,
      }),
      requestHash: hashValue({
        operation: 'faculty.final_document_release',
        caseId: CASE_ID,
        actorId: OTHER_FACULTY,
        payload: { documentId: FINAL_DOCUMENT_ID },
      }),
      event: wrongFacultyEvent,
    }),
    (error) => error?.code === 'AUTHORIZATION_DENIED'
      && error?.details?.reasonCode === 'DATABASE_COMMAND_AUTHORIZATION_DENIED',
  );

  const expectedSnapshot = releasedStudentSnapshot();
  const studentAfterRelease = await driver.readStudentSafeCase({
    binding: BINDING,
    scope: studentScope({ operation: 'read' }),
    caseId: CASE_ID,
  });
  assert.equal(studentAfterRelease.found, true);
  assert.deepEqual(studentAfterRelease.state, {
    ...studentBeforeRelease.state,
    revision: 5,
    updatedAt: FACULTY_RELEASED_AT,
    releasedDocument: expectedSnapshot,
  });

  const { rows: [releasedDocument] } = await pool.query({
    text: `SELECT final_document_id, final_document_text, final_document_content_hash,
      final_document_mime_type, approval_approved, approval_at, approval_faculty_ref,
      approval_signature_attested, release_document_id, release_document_hash,
      released_at, released_at_revision, waiver_receipt_id, snapshot_hash,
      lor_studio.release_document_hash(
        final_document_content_hash, final_document_id,
        final_document_mime_type, final_document_text
      ) AS recomputed_release_document_hash
      FROM lor_studio.released_student_documents
      WHERE case_id = $1 AND student_auth_subject = $2`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(releasedDocument.final_document_id, FINAL_DOCUMENT_ID);
  assert.equal(releasedDocument.final_document_text, FINAL_DOCUMENT_TEXT);
  assert.equal(releasedDocument.final_document_content_hash, null);
  assert.equal(releasedDocument.final_document_mime_type, null);
  assert.equal(releasedDocument.approval_approved, true);
  assert.equal(new Date(releasedDocument.approval_at).toISOString(), FACULTY_APPROVED_AT);
  assert.equal(releasedDocument.approval_faculty_ref, expectedSnapshot.facultyApproval.facultyRef);
  assert.equal(releasedDocument.approval_signature_attested, true);
  assert.equal(releasedDocument.release_document_id, FINAL_DOCUMENT_ID);
  assert.equal(releasedDocument.release_document_hash, expectedSnapshot.release.documentHash);
  assert.equal(
    releasedDocument.release_document_hash,
    releasedDocument.recomputed_release_document_hash,
  );
  assert.equal(new Date(releasedDocument.released_at).toISOString(), FACULTY_RELEASED_AT);
  assert.equal(integer(releasedDocument.released_at_revision), 5);
  assert.equal(releasedDocument.waiver_receipt_id, WAIVER_RECEIPT_ID);
  assert.equal(releasedDocument.snapshot_hash, expectedSnapshot.snapshotHash);
  assert.equal(releasedDocument.snapshot_hash, studentAfterRelease.state.releasedDocument.snapshotHash);

  const releasedPrivateRecord = syntheticFacultyPrivateRecord({ released: true });
  const { rows: [linkedReceipt] } = await pool.query({
    text: `SELECT receipt.revision, receipt.command_type, receipt.operation,
      receipt.idempotency_key, receipt.request_hash, receipt.safe_record,
      receipt.private_record, receipt.private_record_hash, receipt.safe_record_hash,
      receipt.protected_state_hash, receipt.released_snapshot_hash,
      receipt.event_hash, receipt.audit_event_ref, receipt.transaction_id,
      lor_studio.canonical_jsonb_sha256(receipt.safe_record)
        AS recomputed_safe_record_hash,
      lor_studio.canonical_jsonb_sha256(receipt.private_record)
        AS recomputed_private_record_hash,
      audit.event_hash AS audit_event_hash,
      audit.transaction_id AS audit_transaction_id,
      lor_studio.canonical_jsonb_sha256(audit.event) AS recomputed_audit_event_hash,
      protected.previous_revision, protected.previous_protected_state_hash,
      protected.protected_state_hash AS linked_protected_state_hash,
      protected.event_hash AS protected_event_hash,
      protected.audit_event_ref AS protected_audit_event_ref,
      protected.transaction_id AS protected_transaction_id,
      lor_studio.protected_state_chain_hash(
        protected.case_id, protected.student_auth_subject, protected.revision,
        protected.previous_protected_state_hash, protected.event_hash,
        protected.protected_state
      ) AS recomputed_protected_state_hash,
      private_content.private_revision,
      private_content.private_record_hash AS current_private_record_hash,
      released.snapshot_hash AS linked_snapshot_hash
      FROM lor_studio.recommendation_case_private_write_receipts AS receipt
      JOIN lor_studio.recommendation_case_audit_events AS audit
        ON audit.event_ref = receipt.audit_event_ref
       AND audit.case_id = receipt.case_id
       AND audit.student_auth_subject = receipt.student_auth_subject
       AND audit.revision = receipt.revision
      JOIN lor_studio.recommendation_case_protected_revision_states AS protected
        ON protected.case_id = receipt.case_id
       AND protected.student_auth_subject = receipt.student_auth_subject
       AND protected.revision = receipt.revision
      JOIN lor_studio.faculty_private_content AS private_content
        ON private_content.case_id = receipt.case_id
       AND private_content.student_auth_subject = receipt.student_auth_subject
      JOIN lor_studio.released_student_documents AS released
        ON released.case_id = receipt.case_id
       AND released.student_auth_subject = receipt.student_auth_subject
      WHERE receipt.case_id = $1 AND receipt.student_auth_subject = $2`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(integer(linkedReceipt.revision), 5);
  assert.equal(linkedReceipt.command_type, 'faculty.final_document_release');
  assert.equal(linkedReceipt.operation, 'save');
  assert.equal(linkedReceipt.idempotency_key, idempotencyKey);
  assert.equal(linkedReceipt.request_hash, releaseRequestHash);
  assert.deepEqual(linkedReceipt.private_record, releasedPrivateRecord);
  assert.equal(linkedReceipt.private_record_hash, hashValue(releasedPrivateRecord));
  assert.equal(linkedReceipt.private_record_hash, linkedReceipt.recomputed_private_record_hash);
  assert.equal(linkedReceipt.private_record_hash, linkedReceipt.current_private_record_hash);
  assert.equal(linkedReceipt.safe_record_hash, linkedReceipt.recomputed_safe_record_hash);
  assert.equal(linkedReceipt.safe_record_hash, releaseReceipt.safeRecordHash);
  assert.equal(linkedReceipt.protected_state_hash, releaseReceipt.protectedStateHash);
  assert.equal(linkedReceipt.protected_state_hash, linkedReceipt.linked_protected_state_hash);
  assert.equal(
    linkedReceipt.protected_state_hash,
    linkedReceipt.recomputed_protected_state_hash,
  );
  assert.equal(integer(linkedReceipt.previous_revision), 4);
  const { rows: [previousProtected] } = await pool.query({
    text: `SELECT protected_state_hash
      FROM lor_studio.recommendation_case_protected_revision_states
      WHERE case_id = $1 AND student_auth_subject = $2 AND revision = 4`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(
    linkedReceipt.previous_protected_state_hash,
    previousProtected.protected_state_hash,
  );
  assert.equal(linkedReceipt.event_hash, releaseReceipt.eventHash);
  assert.equal(linkedReceipt.event_hash, linkedReceipt.audit_event_hash);
  assert.equal(linkedReceipt.event_hash, linkedReceipt.recomputed_audit_event_hash);
  assert.equal(linkedReceipt.event_hash, linkedReceipt.protected_event_hash);
  assert.equal(linkedReceipt.audit_event_ref, releaseReceipt.auditEventRef);
  assert.equal(linkedReceipt.audit_event_ref, linkedReceipt.protected_audit_event_ref);
  assert.equal(linkedReceipt.transaction_id, releaseReceipt.transactionId);
  assert.equal(linkedReceipt.transaction_id, linkedReceipt.audit_transaction_id);
  assert.equal(linkedReceipt.transaction_id, linkedReceipt.protected_transaction_id);
  assert.equal(linkedReceipt.released_snapshot_hash, expectedSnapshot.snapshotHash);
  assert.equal(linkedReceipt.released_snapshot_hash, linkedReceipt.linked_snapshot_hash);
  assert.equal(integer(linkedReceipt.private_revision), 5);

  const { rows: [counts] } = await pool.query({
    text: `SELECT
      (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_case_audit_events
        WHERE case_id = $1) AS audits,
      (SELECT pg_catalog.count(*)
        FROM lor_studio.recommendation_case_protected_revision_states
        WHERE case_id = $1) AS protected_states,
      (SELECT pg_catalog.count(*) FROM lor_studio.recommendation_case_write_receipts
        WHERE case_id = $1) AS student_write_receipts,
      (SELECT pg_catalog.count(*)
        FROM lor_studio.recommendation_case_private_write_receipts
        WHERE case_id = $1) AS private_write_receipts,
      (SELECT pg_catalog.count(*) FROM lor_studio.released_student_documents
        WHERE case_id = $1) AS released_documents`,
    values: [CASE_ID],
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, integer(value)])),
    {
      audits: 7,
      protected_states: 6,
      student_write_receipts: 5,
      private_write_receipts: 1,
      released_documents: 1,
    },
  );

  for (const relation of [
    'faculty_private_content',
    'released_student_documents',
    'recommendation_case_private_write_receipts',
  ]) {
    await assertDirectAppDmlDenied(
      pool,
      `INSERT INTO lor_studio.${relation} DEFAULT VALUES`,
    );
  }
}

async function proveOperationalGrantLeastPrivilege(pool) {
  const grantSpecs = [
    ['grant_ai_generation', 'create_ai_generation', 'ai_generation'],
    ['grant_legal_hold', 'release_deletion_legal_hold', 'legal_hold_release'],
    ['grant_delivery_investigation', 'investigate_delivery_failure', 'delivery_investigation'],
    ['grant_privacy_read', 'read_case_content_for_privacy_request', 'privacy_case_read'],
    ['grant_verified_restore', 'restore_case_from_verified_backup', 'verified_restore'],
  ];
  for (const [grantId, operation, purpose] of grantSpecs) {
    await insertAdministrativeGrant(pool, { grantId, operation, purpose });
  }

  await pool.query({
    text: `INSERT INTO lor_studio.writer_depot_artifacts
      (artifact_id, case_id, student_auth_subject, created_by_actor_ref,
       artifact_kind, storage_bucket, private_object_key, storage_version_id,
       content_hash, mime_type, byte_length, privacy_class,
       released_snapshot_hash, released_document_id, encryption_profile, created_at)
      VALUES ($1, $2, $3, $4, 'faculty_final', 'lor-writer-depot', $5, $6,
        $7, 'text/plain', 64, 'faculty_private', NULL, NULL,
        'disposable-local-encryption-profile', $8::timestamptz)`,
    values: [
      'artifact_private_faculty_final_0001',
      CASE_ID,
      STUDENT,
      `actor_${sha256(`lor-studio:actor:${FACULTY}`)}`,
      'cases/disposable/faculty-final.txt',
      'version-disposable-private-faculty-final-0001',
      sha256('disposable-local-private-faculty-final'),
      '2026-08-20T12:06:30.000Z',
    ],
  });

  const groundingAttestationHash = sha256('disposable-local-grounding-attestation');
  const groundingManifest = {
    schemaVersion: 'missionmed.lor.grounding-model.v1',
    attestationHash: groundingAttestationHash,
    factualSegmentCount: 1,
    connectiveSegmentCount: 0,
    supportIds: ['support-1'],
    attestations: [{
      index: 0,
      kind: 'factual',
      supportIds: ['support-1'],
      status: 'ENTAILED',
      verifierId: 'disposable-local-verifier',
      rationaleCode: null,
      sourceHashes: [HASH_A],
    }],
  };
  const proposalText = 'Synthetic local grounded AI proposal.';
  const proposalOutputHash = sha256(proposalText);

  await withOperationalScope(pool, {
    grantId: 'grant_ai_generation',
    operation: 'save',
    purpose: 'ai_generation',
    action: 'ai.provider_run.create',
  }, (client) => client.query({
    text: `INSERT INTO lor_studio.ai_generation_runs
      (run_id, case_id, student_auth_subject, requested_by_actor_ref,
       provider_kind, provider_configuration_hash, input_hash,
       grounding_manifest_hash, status, started_at, completed_at, error_code, run_hash)
      VALUES ($1, $2, $3, $4, 'deterministic_test', $5, $6, $7,
        'succeeded', $8::timestamptz, $9::timestamptz, NULL, $10)`,
    values: [
      'run_disposable_pg_matrix_0001',
      CASE_ID,
      STUDENT,
      `actor_${sha256(`lor-studio:actor:${OPERATIONAL_ACTOR}`)}`,
      sha256('disposable-local-provider-configuration'),
      sha256('disposable-local-ai-input'),
      groundingAttestationHash,
      '2026-08-20T12:07:00.000Z',
      '2026-08-20T12:07:01.000Z',
      sha256('disposable-local-provider-run'),
    ],
  }));

  await withOperationalScope(pool, {
    grantId: 'grant_ai_generation',
    operation: 'save',
    purpose: 'ai_generation',
    action: 'ai.provider_run.create',
  }, (client) => client.query({
    text: `INSERT INTO lor_studio.ai_generation_runs
      (run_id, case_id, student_auth_subject, requested_by_actor_ref,
       provider_kind, provider_configuration_hash, input_hash,
       grounding_manifest_hash, status, started_at, completed_at, error_code, run_hash)
      VALUES ($1, $2, $3, $4, 'deterministic_test', $5, $6, $7,
        'succeeded', $8::timestamptz, $9::timestamptz, NULL, $10)`,
    values: [
      'run_disposable_pg_matrix_reserved_for_post_release',
      CASE_ID,
      STUDENT,
      `actor_${sha256(`lor-studio:actor:${OPERATIONAL_ACTOR}`)}`,
      sha256('disposable-local-reserved-provider-configuration'),
      sha256('disposable-local-reserved-ai-input'),
      groundingAttestationHash,
      '2026-08-20T12:07:02.000Z',
      '2026-08-20T12:07:03.000Z',
      sha256('disposable-local-reserved-provider-run'),
    ],
  }));

  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_ai_generation',
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.letter_proposal.create',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.ai_letter_proposals
        (proposal_id, run_id, case_id, student_auth_subject, idempotency_key,
         request_hash, proposal_text, proposal_output_hash, grounding_manifest,
         grounding_manifest_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10,
          $11::timestamptz)`,
      values: [
        'proposal_disposable_pg_matrix_0001',
        'run_disposable_pg_matrix_0001',
        CASE_ID,
        STUDENT,
        'idem-disposable-local-ai-proposal',
        sha256('disposable-local-ai-proposal-request'),
        proposalText,
        sha256('wrong-proposal-wording'),
        JSON.stringify(groundingManifest),
        groundingAttestationHash,
        '2026-08-20T12:08:00.000Z',
      ],
    })),
    (error) => error?.code === '23514',
  );

  await withOperationalScope(pool, {
    grantId: 'grant_ai_generation',
    operation: 'save',
    purpose: 'ai_generation',
    action: 'ai.letter_proposal.create',
  }, (client) => client.query({
    text: `INSERT INTO lor_studio.ai_letter_proposals
      (proposal_id, run_id, case_id, student_auth_subject, idempotency_key,
       request_hash, proposal_text, proposal_output_hash, grounding_manifest,
       grounding_manifest_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10,
        $11::timestamptz)`,
    values: [
      'proposal_disposable_pg_matrix_0001',
      'run_disposable_pg_matrix_0001',
      CASE_ID,
      STUDENT,
      'idem-disposable-local-ai-proposal',
      sha256('disposable-local-ai-proposal-request'),
      proposalText,
      proposalOutputHash,
      JSON.stringify(groundingManifest),
      groundingAttestationHash,
      '2026-08-20T12:08:00.000Z',
    ],
  }));

  const aiRows = await withOperationalScope(pool, {
    grantId: 'grant_ai_generation',
    operation: 'save',
    purpose: 'ai_generation',
    action: 'ai.letter_proposal.read_for_generation',
  }, async (client) => (await client.query(
    'SELECT proposal_text FROM lor_studio.ai_letter_proposals WHERE case_id = $1',
    [CASE_ID],
  )).rows);
  assert.deepEqual(aiRows, [{ proposal_text: proposalText }]);

  const aiArtifactRows = await withOperationalScope(pool, {
    grantId: 'grant_ai_generation',
    operation: 'save',
    purpose: 'ai_generation',
    action: 'ai.evidence_artifact.read_for_generation',
  }, async (client) => (await client.query(
    `SELECT artifact_id, artifact_kind, private_object_key
      FROM lor_studio.writer_depot_artifacts WHERE case_id = $1`,
    [CASE_ID],
  )).rows);
  assert.deepEqual(aiArtifactRows, []);

  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_verified_restore',
      operation: 'save',
      purpose: 'verified_restore',
      action: 'writer_depot.artifact.restore',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.writer_depot_artifacts
        (artifact_id, case_id, student_auth_subject, created_by_actor_ref,
         artifact_kind, storage_bucket, private_object_key, storage_version_id,
         content_hash, mime_type, byte_length, privacy_class,
         released_snapshot_hash, released_document_id, encryption_profile, created_at)
        VALUES ($1, $2, $3, $4, 'evidence_source', 'lor-writer-depot',
          'disposable-local/forbidden-restore', 'version-forbidden-restore', $5,
          'text/plain', 1, 'student_private', NULL, NULL,
          'disposable-local-envelope-v1', '2026-08-20T12:08:30.000Z'::timestamptz)`,
      values: [
        'artifact_forbidden_direct_restore',
        CASE_ID,
        STUDENT,
        `actor_${sha256(`lor-studio:actor:${OPERATIONAL_ACTOR}`)}`,
        sha256('forbidden-direct-writer-depot-restore'),
      ],
    })),
    (error) => error?.code === '42501',
  );

  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_ai_generation',
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.proposal_decision.create',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.ai_proposal_decisions
        (decision_id, proposal_id, case_id, student_auth_subject,
         faculty_auth_subject, faculty_auth_uid, invitation_id, idempotency_key,
         request_hash, action, proposal_output_hash, proposal_text,
         resulting_text_hash, accepted_content_origin, accepted_content_text,
         accepted_content_hash, accepted_support_ids,
         accepted_grounding_attestation_hash, grounded_as_attested, reason_code,
         decided_at, decision_hash)
        VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9, 'accepted',
          $10, $11, $10, 'ai_proposal_accepted', $11, $10,
          ARRAY['support-1']::text[], $12, true, NULL,
          '2026-08-20T12:09:00.000Z'::timestamptz, $13)`,
      values: [
        'decision_forbidden_service_forgery',
        'proposal_disposable_pg_matrix_0001',
        CASE_ID,
        STUDENT,
        FACULTY,
        FACULTY_AUTH_UID,
        FACULTY_INVITATION_ID,
        'idem-forbidden-service-faculty-decision',
        sha256('forbidden-service-faculty-decision-request'),
        proposalOutputHash,
        proposalText,
        groundingAttestationHash,
        sha256('forbidden-service-faculty-decision'),
      ],
    })),
    (error) => error?.code === '42501',
  );

  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_verified_restore',
      operation: 'save',
      purpose: 'verified_restore',
      action: 'ai.proposal_decision.restore',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.ai_proposal_decisions
        (decision_id, proposal_id, case_id, student_auth_subject,
         faculty_auth_subject, faculty_auth_uid, invitation_id, idempotency_key,
         request_hash, action, proposal_output_hash, proposal_text,
         resulting_text_hash, accepted_content_origin, accepted_content_text,
         accepted_content_hash, accepted_support_ids,
         accepted_grounding_attestation_hash, grounded_as_attested, reason_code,
         decided_at, decision_hash)
        VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9, 'accepted',
          $10, $11, $10, 'ai_proposal_accepted', $11, $10,
          ARRAY['support-1']::text[], $12, true, NULL,
          '2026-08-20T12:09:00.000Z'::timestamptz, $13)`,
      values: [
        'decision_forbidden_direct_restore',
        'proposal_disposable_pg_matrix_0001',
        CASE_ID,
        STUDENT,
        FACULTY,
        FACULTY_AUTH_UID,
        FACULTY_INVITATION_ID,
        'idem-forbidden-direct-ai-decision-restore',
        sha256('forbidden-direct-ai-decision-restore-request'),
        proposalOutputHash,
        proposalText,
        groundingAttestationHash,
        sha256('forbidden-direct-ai-decision-restore'),
      ],
    })),
    (error) => error?.code === '42501',
  );

  const restoredDecisionRows = await withOperationalScope(pool, {
    grantId: 'grant_verified_restore',
    operation: 'save',
    purpose: 'verified_restore',
    action: 'ai.proposal_decision.read_after_restore',
  }, async (client) => (await client.query(
    `SELECT action, accepted_content_origin, accepted_support_ids,
      accepted_grounding_attestation_hash, grounded_as_attested
      FROM lor_studio.ai_proposal_decisions WHERE case_id = $1`,
    [CASE_ID],
  )).rows);
  assert.deepEqual(restoredDecisionRows, []);

  const legalHoldAiRows = await withOperationalScope(pool, {
    grantId: 'grant_legal_hold',
    operation: 'save',
    purpose: 'legal_hold_release',
    action: 'deletion.hold_release',
  }, async (client) => (await client.query(
    'SELECT proposal_text FROM lor_studio.ai_letter_proposals WHERE case_id = $1',
    [CASE_ID],
  )).rows);
  assert.deepEqual(legalHoldAiRows, []);

  const legalHoldCaseRows = await withOperationalScope(pool, {
    grantId: 'grant_legal_hold',
    operation: 'save',
    purpose: 'legal_hold_release',
    action: 'deletion.hold_release',
  }, async (client) => (await client.query(
    'SELECT record FROM lor_studio.recommendation_cases WHERE case_id = $1',
    [CASE_ID],
  )).rows);
  assert.deepEqual(legalHoldCaseRows, []);

  const deletionIntentId = 'intent_disposable_pg_matrix_0001';
  const duplicateDeletionIntentId = 'intent_disposable_pg_matrix_0002';
  for (const intentId of [deletionIntentId, duplicateDeletionIntentId]) {
    await withOperationalScope(pool, {
      grantId: 'grant_verified_restore',
      operation: 'save',
      purpose: 'verified_restore',
      action: 'retention.deletion_intent.restore',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.deletion_intents
        (intent_id, case_id, student_auth_subject, requested_by_actor_ref,
         deletion_scope, reason_code, legal_hold, requested_at, due_by, intent_hash)
        VALUES ($1, $2, $3, $4, 'case_private_content', 'VERIFIED_LOCAL_REQUEST',
          true, $5::timestamptz, $6::timestamptz, $7)`,
      values: [
        intentId,
        CASE_ID,
        STUDENT,
        `actor_${sha256(`lor-studio:actor:${OPERATIONAL_ACTOR}`)}`,
        '2026-08-20T12:09:00.000Z',
        '2026-08-21T12:09:00.000Z',
        sha256(`disposable-local-deletion-intent:${intentId}`),
      ],
    }));
  }

  const legalHoldReleasedAt = '2026-08-20T12:10:00.000Z';
  const legalHoldEvent = createMetadataServiceEvent({
    eventId: 'disposable-local-legal-hold-release',
    eventType: 'deletion.hold_released',
    caseId: CASE_ID,
    actorId: OPERATIONAL_ACTOR,
    actorRole: 'service',
    correlationId: 'disposable-local-legal-hold-release',
    outcome: 'success',
    revision: 0,
    occurredAt: legalHoldReleasedAt,
  });
  const legalHoldEventHash = hashValue(legalHoldEvent);
  const insertLegalHoldAudit = async (client) => {
    const { rows: [transaction] } = await client.query(
      'SELECT pg_catalog.pg_current_xact_id()::text AS transaction_id',
    );
    await client.query({
      text: `INSERT INTO lor_studio.recommendation_case_audit_events
        (event_ref, case_id, student_auth_subject, case_ref, actor_ref, actor_role,
         correlation_ref, event_type, outcome, revision, occurred_at, event,
         event_hash, transaction_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11::timestamptz, $12::jsonb, $13, $14)`,
      values: [
        legalHoldEvent.eventRef,
        CASE_ID,
        STUDENT,
        legalHoldEvent.caseRef,
        legalHoldEvent.actorRef,
        legalHoldEvent.actorRole,
        legalHoldEvent.correlationRef,
        legalHoldEvent.eventType,
        legalHoldEvent.outcome,
        legalHoldEvent.revision,
        legalHoldEvent.occurredAt,
        JSON.stringify(legalHoldEvent),
        legalHoldEventHash,
        transaction.transaction_id,
      ],
    });
  };
  const insertLegalHoldRelease = (client, intentId) => client.query({
    text: `INSERT INTO lor_studio.deletion_hold_releases
      (intent_id, case_id, student_auth_subject, released_at,
       released_by_authority, audit_event_ref, release_hash)
      VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7)`,
    values: [
      intentId,
      CASE_ID,
      STUDENT,
      legalHoldReleasedAt,
      'privacy-authority:disposable-local-security-review',
      legalHoldEvent.eventRef,
      sha256(`disposable-local-legal-hold-release:${intentId}`),
    ],
  });

  // A legal-hold audit row cannot commit without the release row that consumes
  // it in the same transaction; the deferred reverse-binding trigger must fire.
  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_legal_hold',
      operation: 'save',
      purpose: 'legal_hold_release',
      action: 'deletion.hold_release',
    }, insertLegalHoldAudit),
    (error) => error?.code === '23514',
  );

  // One audit authority may consume exactly one held intent, even when two
  // release rows are attempted inside the same otherwise-authorized xact.
  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_legal_hold',
      operation: 'save',
      purpose: 'legal_hold_release',
      action: 'deletion.hold_release',
    }, async (client) => {
      await insertLegalHoldAudit(client);
      await insertLegalHoldRelease(client, deletionIntentId);
      await insertLegalHoldRelease(client, duplicateDeletionIntentId);
    }),
    (error) => error?.code === '23505',
  );

  const legalHoldRows = await withOperationalScope(pool, {
    grantId: 'grant_legal_hold',
    operation: 'save',
    purpose: 'legal_hold_release',
    action: 'deletion.hold_release',
  }, async (client) => {
    await insertLegalHoldAudit(client);
    await insertLegalHoldRelease(client, deletionIntentId);
    return (await client.query({
      text: `SELECT hold_release.intent_id, audit.event_type
        FROM lor_studio.deletion_hold_releases AS hold_release
        JOIN lor_studio.recommendation_case_audit_events AS audit
          ON audit.event_ref = hold_release.audit_event_ref
        WHERE hold_release.intent_id = $1`,
      values: [deletionIntentId],
    })).rows;
  });
  assert.deepEqual(legalHoldRows, [{
    intent_id: deletionIntentId,
    event_type: 'deletion.hold_released',
  }]);

  const deliveryRows = await withOperationalScope(pool, {
    grantId: 'grant_delivery_investigation',
    operation: 'read',
    purpose: 'delivery_investigation',
    action: 'delivery.failure_investigate',
  }, async (client) => {
    const released = await client.query(
      'SELECT final_document_id FROM lor_studio.released_student_documents WHERE case_id = $1',
      [CASE_ID],
    );
    const proposals = await client.query(
      'SELECT proposal_text FROM lor_studio.ai_letter_proposals WHERE case_id = $1',
      [CASE_ID],
    );
    return { released: released.rows, proposals: proposals.rows };
  });
  assert.deepEqual(deliveryRows, {
    released: [],
    proposals: [],
  });

  const privacyRows = await withOperationalScope(pool, {
    grantId: 'grant_privacy_read',
    operation: 'read',
    purpose: 'privacy_case_read',
    action: 'privacy.case_content.read',
  }, async (client) => (await client.query(
    'SELECT proposal_text FROM lor_studio.ai_letter_proposals WHERE case_id = $1',
    [CASE_ID],
  )).rows);
  assert.deepEqual(privacyRows, [{ proposal_text: proposalText }]);
}

async function provePostReleaseOperationalBoundaries(pool) {
  const deliveryRows = await withOperationalScope(pool, {
    grantId: 'grant_delivery_investigation',
    operation: 'read',
    purpose: 'delivery_investigation',
    action: 'delivery.failure_investigate',
  }, async (client) => {
    const released = await client.query(
      'SELECT final_document_id FROM lor_studio.released_student_documents WHERE case_id = $1',
      [CASE_ID],
    );
    const proposals = await client.query(
      'SELECT proposal_text FROM lor_studio.ai_letter_proposals WHERE case_id = $1',
      [CASE_ID],
    );
    return { released: released.rows, proposals: proposals.rows };
  });
  assert.deepEqual(deliveryRows, {
    released: [{ final_document_id: FINAL_DOCUMENT_ID }],
    proposals: [],
  });

  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_ai_generation',
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.provider_run.create',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.ai_generation_runs
        (run_id, case_id, student_auth_subject, requested_by_actor_ref,
         provider_kind, provider_configuration_hash, input_hash,
         grounding_manifest_hash, status, started_at, completed_at, error_code, run_hash)
        VALUES ($1, $2, $3, $4, 'deterministic_test', $5, $6, $7,
          'succeeded', $8::timestamptz, $9::timestamptz, NULL, $10)`,
      values: [
        'run_disposable_pg_matrix_after_delivery',
        CASE_ID,
        STUDENT,
        `actor_${sha256(`lor-studio:actor:${OPERATIONAL_ACTOR}`)}`,
        sha256('disposable-local-provider-configuration-after-delivery'),
        sha256('disposable-local-ai-input-after-delivery'),
        sha256('disposable-local-grounding-after-delivery'),
        '2026-08-20T12:12:00.000Z',
        '2026-08-20T12:12:01.000Z',
        sha256('disposable-local-provider-run-after-delivery'),
      ],
    })),
    (error) => error?.code === '42501',
  );

  const groundingAttestationHash = sha256('disposable-local-grounding-attestation');
  const groundingManifest = {
    schemaVersion: 'missionmed.lor.grounding-model.v1',
    attestationHash: groundingAttestationHash,
    factualSegmentCount: 1,
    connectiveSegmentCount: 0,
    supportIds: ['support-1'],
    attestations: [{
      index: 0,
      kind: 'factual',
      supportIds: ['support-1'],
      status: 'ENTAILED',
      verifierId: 'disposable-local-verifier',
      rationaleCode: null,
      sourceHashes: [HASH_A],
    }],
  };
  const postReleaseProposalText = 'Synthetic local post-release proposal probe.';
  await assert.rejects(
    () => withOperationalScope(pool, {
      grantId: 'grant_ai_generation',
      operation: 'save',
      purpose: 'ai_generation',
      action: 'ai.letter_proposal.create',
    }, (client) => client.query({
      text: `INSERT INTO lor_studio.ai_letter_proposals
        (proposal_id, run_id, case_id, student_auth_subject, idempotency_key,
         request_hash, proposal_text, proposal_output_hash, grounding_manifest,
         grounding_manifest_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10,
          $11::timestamptz)`,
      values: [
        'proposal_disposable_pg_matrix_after_delivery',
        'run_disposable_pg_matrix_reserved_for_post_release',
        CASE_ID,
        STUDENT,
        'idem-disposable-local-ai-proposal-after-delivery',
        sha256('disposable-local-ai-proposal-request-after-delivery'),
        postReleaseProposalText,
        sha256(postReleaseProposalText),
        JSON.stringify(groundingManifest),
        groundingAttestationHash,
        '2026-08-20T12:12:02.000Z',
      ],
    })),
    (error) => error?.code === '42501',
  );

  const successorWaiver = createWaiverReceipt({
    id: 'waiver_disposable_pg_matrix_after_release',
    caseId: CASE_ID,
    studentId: STUDENT,
    waived: true,
    policyVersion: 'synthetic-local-policy-v1',
    priorReceiptId: WAIVER_RECEIPT_ID,
    acknowledgment: 'Synthetic local post-release waiver mutation probe.',
    recordedAt: '2026-08-20T12:07:00.000Z',
  });
  await assert.rejects(
    () => withStudentCommandOwnerScope(pool, (client) => client.query({
      text: `INSERT INTO lor_studio.waiver_receipts
        (receipt_id, case_id, student_auth_subject, student_auth_uid,
         case_revision, prior_receipt_id, waived, policy_version,
         acknowledgment, recorded_at, receipt_hash)
        VALUES ($1, $2, $3, $4::uuid, 5, $5, $6, $7, $8, $9::timestamptz, $10)`,
      values: [
        successorWaiver.id,
        CASE_ID,
        STUDENT,
        AUTH_UID,
        successorWaiver.priorReceiptId,
        successorWaiver.waived,
        successorWaiver.policyVersion,
        successorWaiver.acknowledgment,
        successorWaiver.recordedAt,
        successorWaiver.receiptHash,
      ],
    })),
    (error) => error?.code === '55000',
  );
  const { rows: [waiverCount] } = await pool.query({
    text: `SELECT pg_catalog.count(*) AS count
      FROM lor_studio.waiver_receipts
      WHERE case_id = $1 AND student_auth_subject = $2`,
    values: [CASE_ID, STUDENT],
  });
  assert.equal(integer(waiverCount.count), 1);
}

function isSqlApplyFailure(error) {
  return error instanceof PostgresHarnessError && error.code === 'SQL_FILE_APPLY_FAILED';
}

async function assertIdentityScopeFunctionDefinitionDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`CREATE OR REPLACE FUNCTION lor_studio.resolve_mentor_case_scope(
      candidate_mentor_subject text,
      candidate_case_id text,
      candidate_operation text
    ) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $$ BEGIN RETURN NULL; END $$`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    pg_catalog.to_regprocedure(
      'lor_studio.resolve_mentor_case_scope(text,text,text)'
    ) IS NOT NULL AS altered_function_preserved,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(state, {
    altered_function_preserved: true,
    successor_sentinel_preserved: true,
  });
}

async function assertIdentityScopeFunctionConfigDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`ALTER FUNCTION lor_studio.identity_bootstrap_context_allows(
    text, text[]
  ) RESET search_path`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    procedure.proconfig IS NULL AS config_reset_preserved,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE procedure.oid =
      'lor_studio.identity_bootstrap_context_allows(text,text[])'::pg_catalog.regprocedure`);
  assert.deepEqual(state, {
    config_reset_preserved: true,
    successor_sentinel_preserved: true,
  });
}

async function assertIdentityScopeFunctionAclDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`GRANT EXECUTE ON FUNCTION
    lor_studio.identity_bootstrap_context_allows(text, text[])
    TO lor_studio_app`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    pg_catalog.has_function_privilege(
      'lor_studio_app',
      'lor_studio.identity_bootstrap_context_allows(text,text[])',
      'EXECUTE'
    ) AS overbroad_execute_preserved,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(state, {
    overbroad_execute_preserved: true,
    successor_sentinel_preserved: true,
  });
}

async function assertIdentityScopeOverloadDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`CREATE FUNCTION lor_studio.resolve_mentor_case_scope(text)
    RETURNS jsonb
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = ''
    AS $$ SELECT NULL::jsonb $$`);
  await pool.query(`ALTER FUNCTION lor_studio.resolve_mentor_case_scope(text)
    OWNER TO lor_studio_command_owner`);
  await pool.query(`GRANT EXECUTE ON FUNCTION
    lor_studio.resolve_mentor_case_scope(text) TO lor_studio_app`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    pg_catalog.to_regprocedure(
      'lor_studio.resolve_mentor_case_scope(text)'
    ) IS NOT NULL AS overload_preserved,
    pg_catalog.to_regprocedure(
      'lor_studio.resolve_mentor_case_scope(text,text,text)'
    ) IS NOT NULL AS expected_function_preserved
  `);
  assert.deepEqual(state, {
    overload_preserved: true,
    expected_function_preserved: true,
  });
}

async function assertIdentityScopePolicyPredicateDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`ALTER POLICY mentor_assignments_scope_resolution_select
    ON lor_studio.mentor_case_assignments USING (false)`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false) AS qualifier,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = 'mentor_case_assignments'
      AND policy.polname = 'mentor_assignments_scope_resolution_select'`);
  assert.equal(state.qualifier, 'false');
  assert.equal(state.successor_sentinel_preserved, true);
}

async function assertIdentityScopeRelationAclDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`GRANT UPDATE ON TABLE lor_studio.faculty_invitations
    TO lor_studio_app`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    pg_catalog.has_table_privilege(
      'lor_studio_app', 'lor_studio.faculty_invitations', 'UPDATE'
    ) AS overbroad_grant_preserved,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(state, {
    overbroad_grant_preserved: true,
    successor_sentinel_preserved: true,
  });
}

async function assertIdentityScopeColumnAclDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query(`GRANT UPDATE (faculty_auth_subject)
    ON TABLE lor_studio.faculty_invitations TO lor_studio_app`);
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    pg_catalog.has_column_privilege(
      'lor_studio_app',
      'lor_studio.faculty_invitations',
      'faculty_auth_subject',
      'UPDATE'
    ) AS overbroad_column_grant_preserved,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'`);
  assert.deepEqual(state, {
    overbroad_column_grant_preserved: true,
    successor_sentinel_preserved: true,
  });
}

async function assertIdentityScopeRoleAttributeDriftRejected({ harness, pool }) {
  await applyForward(harness);
  await harness.applySqlFile(identityScopePath);
  await pool.query('ALTER ROLE lor_studio_app LOGIN INHERIT');
  await assert.rejects(
    () => harness.applySqlFile(identityScopeRollbackPath),
    isSqlApplyFailure,
  );
  const { rows: [state] } = await pool.query(`SELECT
    role.rolcanlogin AS login_preserved,
    role.rolinherit AS inherit_preserved,
    pg_catalog.obj_description(namespace.oid, 'pg_namespace')
      LIKE '%|identityScope=20260825010200' AS successor_sentinel_preserved
    FROM pg_catalog.pg_roles AS role
    CROSS JOIN pg_catalog.pg_namespace AS namespace
    WHERE role.rolname = 'lor_studio_app'
      AND namespace.nspname = 'lor_studio'`);
  assert.deepEqual(state, {
    login_preserved: true,
    inherit_preserved: true,
    successor_sentinel_preserved: true,
  });
}

async function assertUnexpectedObjectRejected({ harness, pool, createSql, dropSql }) {
  await pool.query(createSql);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  const snapshot = await catalogSnapshot(pool);
  assert.ok(snapshot.table_count > 0, 'failed rollback must preserve the complete schema');
  await pool.query(dropSql);
}

async function assertSameCountIndexReplacementRejected({ harness, pool, expectedIndexCount }) {
  await pool.query(
    'DROP INDEX lor_studio.recommendation_cases_status_updated_idx',
  );
  await pool.query(`CREATE INDEX rollback_adversarial_replacement_idx
    ON lor_studio.recommendation_cases (case_id, status)`);
  assert.equal((await catalogSnapshot(pool)).index_count, expectedIndexCount);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  const snapshot = await catalogSnapshot(pool);
  assert.ok(snapshot.table_count > 0, 'failed rollback must preserve the complete schema');
  assert.equal(snapshot.index_count, expectedIndexCount);
  await pool.query('DROP INDEX lor_studio.rollback_adversarial_replacement_idx');
  await pool.query(`CREATE INDEX recommendation_cases_status_updated_idx
    ON lor_studio.recommendation_cases (status, updated_at DESC)`);
}

async function assertFunctionBodyReplacementRejected({ harness, pool }) {
  const { rows: [original] } = await pool.query(`SELECT
    pg_catalog.pg_get_functiondef(
      'lor_studio.student_record_is_safe(jsonb)'::pg_catalog.regprocedure
    ) AS definition`);
  await pool.query(`CREATE OR REPLACE FUNCTION lor_studio.student_record_is_safe(payload jsonb)
    RETURNS boolean
    LANGUAGE sql
    IMMUTABLE
    PARALLEL SAFE
    SECURITY INVOKER
    SET search_path = ''
    AS $$ SELECT false $$`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(original.definition);
}

async function assertPolicyPredicateReplacementRejected({ harness, pool }) {
  const { rows: [original] } = await pool.query(`SELECT
      pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) AS qualifier
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS class ON class.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relname = 'recommendation_cases'
      AND policy.polname = 'recommendation_cases_student_select'`);
  assert.ok(original?.qualifier);
  await pool.query(`ALTER POLICY recommendation_cases_student_select
    ON lor_studio.recommendation_cases USING (false)`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(`ALTER POLICY recommendation_cases_student_select
    ON lor_studio.recommendation_cases USING (${original.qualifier})`);
}

async function assertDisabledTriggerRejected({ harness, pool }) {
  await pool.query(`ALTER TABLE lor_studio.recommendation_cases
    DISABLE TRIGGER recommendation_cases_update_guard`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(`ALTER TABLE lor_studio.recommendation_cases
    ENABLE TRIGGER recommendation_cases_update_guard`);
}

async function assertViewOptionReplacementRejected({ harness, pool }) {
  await pool.query(`ALTER VIEW lor_studio.student_recommendation_case_projection
    SET (security_barrier = false)`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(`ALTER VIEW lor_studio.student_recommendation_case_projection
    SET (security_barrier = true)`);
}

async function assertInternalConstraintTriggerDisabledRejected({ harness, pool }) {
  const { rows: [row] } = await pool.query(`SELECT trigger.tgname
    FROM pg_catalog.pg_trigger AS trigger
    JOIN pg_catalog.pg_constraint AS constraint_record
      ON constraint_record.oid = trigger.tgconstraint
    WHERE constraint_record.conname = 'recommendation_case_audit_events_case_fk'
      AND trigger.tgrelid =
        'lor_studio.recommendation_case_audit_events'::pg_catalog.regclass
    ORDER BY trigger.tgname
    LIMIT 1`);
  assert.match(row?.tgname ?? '', /^[A-Za-z0-9_]+$/u);
  await pool.query(`ALTER TABLE lor_studio.recommendation_case_audit_events
    DISABLE TRIGGER "${row.tgname}"`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(`ALTER TABLE lor_studio.recommendation_case_audit_events
    ENABLE TRIGGER "${row.tgname}"`);
}

async function assertFoundationColumnDriftRejected({ harness, pool }) {
  await pool.query(`ALTER TABLE lor_studio.recommendation_cases
    ADD COLUMN rollback_foundation_extra text`);
  await assert.rejects(() => harness.applySqlFile(foundationRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(`ALTER TABLE lor_studio.recommendation_cases
    DROP COLUMN rollback_foundation_extra`);
}

async function assertFinalOwnerRelationAclDriftRejected({
  harness,
  pool,
  contract,
  postgresMajor,
}) {
  await applyForward(harness);
  await assertFinalCatalog(pool, contract, postgresMajor);
  await pool.query(`REVOKE SELECT ON lor_studio.recommendation_cases
    FROM CURRENT_USER`);
  const { rows: [{ owner_select_count: ownerSelectCount }] } = await pool.query(`SELECT
    pg_catalog.count(*) AS owner_select_count
    FROM pg_catalog.pg_class AS class
    CROSS JOIN LATERAL pg_catalog.aclexplode(class.relacl) AS acl
    WHERE class.oid = 'lor_studio.recommendation_cases'::pg_catalog.regclass
      AND acl.grantee = class.relowner
      AND acl.privilege_type = 'SELECT'`);
  assert.equal(integer(ownerSelectCount), 0);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query(`GRANT SELECT ON lor_studio.recommendation_cases
    TO CURRENT_USER`);

  await pool.query(`COMMENT ON TYPE lor_studio.recommendation_cases
    IS 'rollback adversarial row-type comment'`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query('COMMENT ON TYPE lor_studio.recommendation_cases IS NULL');

  await pool.query(`COMMENT ON TYPE lor_studio._recommendation_cases
    IS 'rollback adversarial array-type comment'`);
  await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
}

async function assertFoundationOwnerSchemaAclDriftRejected({
  harness,
  pool,
  contract,
  postgresMajor,
}) {
  await harness.applySqlFile(foundationPath);
  await assertFoundationCatalog(pool, contract, postgresMajor);
  await pool.query('REVOKE USAGE ON SCHEMA lor_studio FROM CURRENT_USER');
  const { rows: [{ owner_usage_count: ownerUsageCount }] } = await pool.query(`SELECT
    pg_catalog.count(*) AS owner_usage_count
    FROM pg_catalog.pg_namespace AS namespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS acl
    WHERE namespace.nspname = 'lor_studio'
      AND acl.grantee = namespace.nspowner
      AND acl.privilege_type = 'USAGE'`);
  assert.equal(integer(ownerUsageCount), 0);
  await assert.rejects(() => harness.applySqlFile(foundationRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
}

async function assertFoundationRowTypeDriftRejected({
  harness,
  pool,
  contract,
  postgresMajor,
}) {
  await harness.applySqlFile(foundationPath);
  await assertFoundationCatalog(pool, contract, postgresMajor);
  await pool.query(`COMMENT ON TYPE lor_studio.recommendation_cases
    IS 'foundation rollback adversarial row-type comment'`);
  await assert.rejects(() => harness.applySqlFile(foundationRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query('COMMENT ON TYPE lor_studio.recommendation_cases IS NULL');

  await pool.query(`COMMENT ON TYPE lor_studio._recommendation_cases
    IS 'foundation rollback adversarial array-type comment'`);
  await assert.rejects(() => harness.applySqlFile(foundationRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
  await pool.query('COMMENT ON TYPE lor_studio._recommendation_cases IS NULL');

  await pool.query(`REVOKE USAGE ON TYPE lor_studio.recommendation_cases
    FROM CURRENT_USER`);
  const { rows: [{ owner_type_usage_count: ownerTypeUsageCount }] } = await pool.query(`SELECT
    pg_catalog.count(*) AS owner_type_usage_count
    FROM pg_catalog.pg_type AS type
    CROSS JOIN LATERAL pg_catalog.aclexplode(type.typacl) AS acl
    WHERE type.oid = 'lor_studio.recommendation_cases'::pg_catalog.regtype
      AND acl.grantee = type.typowner
      AND acl.privilege_type = 'USAGE'`);
  assert.equal(integer(ownerTypeUsageCount), 0);
  await assert.rejects(() => harness.applySqlFile(foundationRollbackPath), isSqlApplyFailure);
  assert.ok((await catalogSnapshot(pool)).table_count > 0);
}

test('DR-120 real disposable PostgreSQL 16/18 apply, RLS, rollback, and reapply matrix', {
  skip: !RUN_REAL_MATRIX,
  timeout: 240_000,
}, async (matrix) => {
  const contract = await readContract();
  for (const toolchain of TOOLCHAINS) {
    await matrix.test(`PostgreSQL ${toolchain.major}`, { timeout: 120_000 }, async () => {
      await assertToolchainPresent(toolchain);

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertProductionFoundationRejectsDisposableTarget({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await proveIdentityScopeSuccessor({
          harness,
          pool,
          contract,
          postgresMajor: toolchain.major,
        });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeFunctionDefinitionDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeFunctionConfigDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeFunctionAclDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeOverloadDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopePolicyPredicateDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeRelationAclDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeColumnAclDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertIdentityScopeRoleAttributeDriftRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertFoundationSetRoleLookalikeRejected({ harness, pool });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await proveRlsForwardFoundationCustody({
          harness,
          pool,
          contract,
          postgresMajor: toolchain.major,
        });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertRlsForwardOwnerSchemaAclDriftRejected({
          harness,
          pool,
          contract,
          postgresMajor: toolchain.major,
        });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertFinalOwnerRelationAclDriftRejected({
          harness,
          pool,
          contract,
          postgresMajor: toolchain.major,
        });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertFoundationOwnerSchemaAclDriftRejected({
          harness,
          pool,
          contract,
          postgresMajor: toolchain.major,
        });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await assertFoundationRowTypeDriftRejected({
          harness,
          pool,
          contract,
          postgresMajor: toolchain.major,
        });
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await applyForward(harness);
        await assertFinalCatalog(pool, contract, toolchain.major);
        await proveActorSafeStudentCommand(pool);
        await proveReservationRevocationRejectsRepeatableRead(pool);
        await proveOperationalGrantLeastPrivilege(pool);
        await proveOperationalRevocationRejectsRepeatableRead(pool);
        await proveAiReleaseSerialization(pool);
        await proveActorSafeFacultyRelease(pool);
        await provePostReleaseOperationalBoundaries(pool);
        await assert.rejects(() => harness.applySqlFile(rlsRollbackPath), isSqlApplyFailure);
        assert.equal(
          integer((await pool.query(
            'SELECT count(*) AS count FROM lor_studio.recommendation_cases',
          )).rows[0].count),
          1,
        );
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await applyForward(harness);
        await assertFinalCatalog(pool, contract, toolchain.major);
        await assertUnexpectedObjectRejected({
          harness,
          pool,
          createSql: `CREATE INDEX rollback_adversarial_extra_idx
            ON lor_studio.recommendation_cases (case_id)`,
          dropSql: 'DROP INDEX lor_studio.rollback_adversarial_extra_idx',
        });
        await assertUnexpectedObjectRejected({
          harness,
          pool,
          createSql: `ALTER TABLE lor_studio.recommendation_cases
            ADD CONSTRAINT rollback_adversarial_extra_check CHECK (case_id <> '')`,
          dropSql: `ALTER TABLE lor_studio.recommendation_cases
            DROP CONSTRAINT rollback_adversarial_extra_check`,
        });
        await assertUnexpectedObjectRejected({
          harness,
          pool,
          createSql: `ALTER TABLE lor_studio.recommendation_cases
            ADD COLUMN rollback_adversarial_extra text`,
          dropSql: `ALTER TABLE lor_studio.recommendation_cases
            DROP COLUMN rollback_adversarial_extra`,
        });
        await assertUnexpectedObjectRejected({
          harness,
          pool,
          createSql: `CREATE RULE rollback_adversarial_extra_rule AS
            ON INSERT TO lor_studio.recommendation_cases DO ALSO NOTHING`,
          dropSql: `DROP RULE rollback_adversarial_extra_rule
            ON lor_studio.recommendation_cases`,
        });
        await assertUnexpectedObjectRejected({
          harness,
          pool,
          createSql: `COMMENT ON COLUMN lor_studio.recommendation_cases.record
            IS 'rollback adversarial comment'`,
          dropSql: `COMMENT ON COLUMN lor_studio.recommendation_cases.record IS NULL`,
        });
        await assertSameCountIndexReplacementRejected({
          harness,
          pool,
          expectedIndexCount: contract.expectedFinalIndexCount,
        });
        await assertFunctionBodyReplacementRejected({ harness, pool });
        await assertPolicyPredicateReplacementRejected({ harness, pool });
        await assertDisabledTriggerRejected({ harness, pool });
        await assertViewOptionReplacementRejected({ harness, pool });
        await assertInternalConstraintTriggerDisabledRejected({ harness, pool });
        await harness.applySqlFile(rlsRollbackPath);
        await assertFoundationCatalog(pool, contract, toolchain.major);
        await assertFoundationColumnDriftRejected({ harness, pool });
        await harness.applySqlFile(foundationRollbackPath);
        await assertFullyRemoved(pool);
      });

      await withHarness(toolchain, async ({ harness, pool }) => {
        await applyForward(harness);
        await assertFinalCatalog(pool, contract, toolchain.major);
        await harness.applySqlFile(rlsRollbackPath);
        await harness.applySqlFile(foundationRollbackPath);
        await assertFullyRemoved(pool);

        // Reapply in the same database/session custody after the complete
        // rollback.  A fresh harness would miss residual roles, default ACLs,
        // or other database-global state left by an incomplete rollback.
        await applyForward(harness);
        await assertFinalCatalog(pool, contract, toolchain.major);
        await harness.applySqlFile(rlsRollbackPath);
        await harness.applySqlFile(foundationRollbackPath);
        await assertFullyRemoved(pool);
      });
    });
  }
});
