import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  DR133_APPLICATION_ROLE,
  DR133_ARTIFACTS,
  DR133_COMMAND_OWNER_ROLE,
  DR133_RELATIONS,
  DR133_RUNNER_CONTRACT,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_TARGET,
  Dr133RunnerError,
  assertBaseSchemaPreflightRow,
  assertFoundationSentinelRow,
  assertPostflightRow,
  assertPreflightRow,
  assertSuccessorSchemaPreflightRow,
  buildNonemptyRelationsSql,
  classifySafeFailure,
  extractIdentityScopeRollbackGuardVerificationSql,
  extractRollbackGuardVerificationSql,
  failDr133,
  postgresOutcomeIsUnknown,
  resolveDr133RunnerEnvironment,
  sha256Bytes,
  targetGucEntries,
  writeDr133Receipt,
} from './railway-dr133-runner-core.mjs';

const { Client } = pg;

export const DR133_PREFLIGHT_SQL = `
/* missionmed:dr133:staging-preflight */
WITH ssl_session AS (
  SELECT ssl, version, cipher
  FROM pg_catalog.pg_stat_ssl
  WHERE pid = pg_catalog.pg_backend_pid()
),
database_identity AS (
  SELECT pg_catalog.pg_get_userbyid(datdba)::text AS database_owner
  FROM pg_catalog.pg_database
  WHERE datname = pg_catalog.current_database()
)
SELECT
  pg_catalog.current_database()::text AS database_name,
  current_user::text AS current_user,
  session_user::text AS session_user,
  database_identity.database_owner,
  (pg_catalog.current_setting('server_version_num')::integer / 10000)::integer
    AS postgres_major,
  (
    pg_catalog.inet_server_addr() IS NOT NULL
    AND (
      pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7'
    )
  ) AS private_server_address,
  (
    pg_catalog.current_setting('ssl') = 'on'
    AND COALESCE(ssl_session.ssl, false)
  ) AS ssl_active,
  ssl_session.version::text AS ssl_version,
  ssl_session.cipher::text AS ssl_cipher,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_namespace
    WHERE nspname = 'lor_studio'
  ) AS schema_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_app'
  ) AS app_role_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_command_owner'
  ) AS command_owner_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_runtime_login'
  ) AS runtime_login_count
FROM database_identity
LEFT JOIN ssl_session ON true
`;

export const DR133_ADVISORY_LOCK_SQL = `
SELECT pg_catalog.pg_try_advisory_lock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:b49a52e7-df15-4417-b67a-a64403aa5db7:database-mutation',
    0
  )
) AS acquired
`;

export const DR133_SUCCESSOR_PREFLIGHT_SQL = `
/* missionmed:dr133:staging-successor-preflight */
WITH ssl_session AS (
  SELECT ssl, version, cipher
  FROM pg_catalog.pg_stat_ssl
  WHERE pid = pg_catalog.pg_backend_pid()
),
database_identity AS (
  SELECT pg_catalog.pg_get_userbyid(datdba)::text AS database_owner
  FROM pg_catalog.pg_database
  WHERE datname = pg_catalog.current_database()
)
SELECT
  pg_catalog.current_database()::text AS database_name,
  current_user::text AS current_user,
  session_user::text AS session_user,
  database_identity.database_owner,
  (pg_catalog.current_setting('server_version_num')::integer / 10000)::integer
    AS postgres_major,
  (
    pg_catalog.inet_server_addr() IS NOT NULL
    AND (
      pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7'
    )
  ) AS private_server_address,
  (
    pg_catalog.current_setting('ssl') = 'on'
    AND COALESCE(ssl_session.ssl, false)
  ) AS ssl_active,
  ssl_session.version::text AS ssl_version,
  ssl_session.cipher::text AS ssl_cipher,
  (
    SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace')
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'
  ) AS schema_sentinel,
  (
    SELECT pg_catalog.pg_get_userbyid(namespace.nspowner)::text
    FROM pg_catalog.pg_namespace AS namespace
    WHERE namespace.nspname = 'lor_studio'
  ) AS schema_owner,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_namespace
    WHERE nspname = 'lor_studio'
  ) AS schema_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_app'
  ) AS app_role_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_command_owner'
  ) AS command_owner_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_runtime_login'
  ) AS runtime_login_count
FROM database_identity
LEFT JOIN ssl_session ON true
`;

export const DR133_ADVISORY_UNLOCK_SQL = `
SELECT pg_catalog.pg_advisory_unlock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:b49a52e7-df15-4417-b67a-a64403aa5db7:database-mutation',
    0
  )
) AS released
`;

export const DR133_FOUNDATION_SENTINEL_SQL = `
SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace') AS schema_sentinel
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname = 'lor_studio'
`;

export const DR133_POSTFLIGHT_CATALOG_SQL = `
/* missionmed:dr133:staging-postflight-catalog */
WITH relation_inventory AS (
  SELECT
    class.relname::text AS relation_name,
    class.relrowsecurity,
    class.relforcerowsecurity
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind = 'r'
),
definer_inventory AS (
  SELECT
    procedure.proname || '(' ||
      pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ' ', '') || ')'
      AS function_identity,
    procedure.oid AS function_oid,
    procedure.proowner,
    procedure.proconfig
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'lor_studio'
    AND procedure.prosecdef
),
public_function_acl AS (
  SELECT 1
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE'
),
public_relation_acl AS (
  SELECT 1
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(class.relacl, pg_catalog.acldefault('r', class.relowner))
  ) AS acl
  WHERE namespace.nspname = 'lor_studio'
    AND class.relkind IN ('r', 'v', 'm', 'p')
    AND acl.grantee = 0
),
nologin_role_memberships AS (
  SELECT 1
  FROM pg_catalog.pg_auth_members AS membership
  JOIN pg_catalog.pg_roles AS granted_role ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles AS member_role ON member_role.oid = membership.member
  WHERE granted_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
    OR member_role.rolname IN ('lor_studio_app', 'lor_studio_command_owner')
)
SELECT
  pg_catalog.obj_description(namespace.oid, 'pg_namespace') AS schema_sentinel,
  pg_catalog.pg_get_userbyid(namespace.nspowner)::text AS schema_owner,
  (
    SELECT COALESCE(
      pg_catalog.array_agg(relation_name ORDER BY relation_name COLLATE "C"),
      ARRAY[]::text[]
    )
    FROM relation_inventory
  ) AS relation_names,
  (SELECT pg_catalog.count(*)::text FROM relation_inventory) AS relation_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM relation_inventory
    WHERE relrowsecurity AND relforcerowsecurity
  ) AS forced_rls_count,
  (
    SELECT COALESCE(
      pg_catalog.array_agg(function_identity ORDER BY function_identity COLLATE "C"),
      ARRAY[]::text[]
    )
    FROM definer_inventory
  ) AS definer_identities,
  (SELECT pg_catalog.count(*)::text FROM definer_inventory) AS definer_count,
  (
    SELECT pg_catalog.count(*) = ${DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length}
      AND COALESCE(pg_catalog.bool_and(
        pg_catalog.pg_get_userbyid(proowner) = 'lor_studio_command_owner'
        AND proconfig IS NOT DISTINCT FROM ARRAY['search_path=""']::text[]
      ), false)
    FROM definer_inventory
  ) AS definer_custody_safe,
  (
    SELECT pg_catalog.count(*)::text
    FROM definer_inventory
    WHERE pg_catalog.has_function_privilege(
      'lor_studio_app', function_oid, 'EXECUTE'
    )
  ) AS app_execute_count,
  (SELECT pg_catalog.count(*)::text FROM public_function_acl)
    AS public_function_execute_count,
  (SELECT pg_catalog.count(*)::text FROM public_relation_acl)
    AS public_table_privilege_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS view_namespace ON view_namespace.oid = class.relnamespace
    WHERE view_namespace.nspname = 'lor_studio'
      AND class.relkind IN ('v', 'm')
  ) AS view_count,
  (
    SELECT pg_catalog.string_agg(
      class.relname::text || '@' || pg_catalog.pg_get_userbyid(class.relowner),
      ',' ORDER BY class.relname
    )
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS view_namespace ON view_namespace.oid = class.relnamespace
    WHERE view_namespace.nspname = 'lor_studio'
      AND class.relkind IN ('v', 'm')
  ) AS view_identity,
  (
    SELECT pg_catalog.count(*) = 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'lor_studio_app'
      AND role.rolsuper IS FALSE
      AND role.rolinherit IS FALSE
      AND role.rolcreaterole IS FALSE
      AND role.rolcreatedb IS FALSE
      AND role.rolcanlogin IS FALSE
      AND role.rolreplication IS FALSE
      AND role.rolbypassrls IS FALSE
      AND role.rolconnlimit = -1
      AND role.rolvaliduntil IS NULL
      AND role.rolconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
  ) AS app_role_safe,
  (
    SELECT pg_catalog.count(*) = 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'lor_studio_command_owner'
      AND role.rolsuper IS FALSE
      AND role.rolinherit IS FALSE
      AND role.rolcreaterole IS FALSE
      AND role.rolcreatedb IS FALSE
      AND role.rolcanlogin IS FALSE
      AND role.rolreplication IS FALSE
      AND role.rolbypassrls IS FALSE
      AND role.rolconnlimit = -1
      AND role.rolvaliduntil IS NULL
      AND role.rolconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
  ) AS command_owner_safe,
  (SELECT pg_catalog.count(*)::text FROM nologin_role_memberships)
    AS nologin_role_membership_count
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname = 'lor_studio'
`;

function artifactById(artifacts, id) {
  const artifact = artifacts.get(id);
  if (!artifact) failDr133('ARTIFACT_INVENTORY_INVALID');
  return artifact;
}

async function loadVerifiedArtifacts(readFileFn) {
  const artifacts = new Map();
  for (const contract of DR133_ARTIFACTS) {
    let bytes;
    try {
      bytes = await readFileFn(new URL(contract.relativePath, import.meta.url));
    } catch {
      failDr133('ARTIFACT_READ_FAILED');
    }
    if (!Buffer.isBuffer(bytes)) failDr133('ARTIFACT_BYTES_INVALID');
    if (sha256Bytes(bytes) !== contract.sha256) {
      failDr133('ARTIFACT_HASH_MISMATCH');
    }
    artifacts.set(contract.id, Object.freeze({ ...contract, bytes }));
  }
  return artifacts;
}

function resultForFailure(stage, error) {
  if ([
    'INITIAL',
    'ARTIFACTS_VERIFIED',
    'CONNECTED',
    'PREFLIGHT_VERIFIED',
    'LOCKED',
  ].includes(stage)) return 'NO_MUTATION';
  if (stage === 'FOUNDATION_DISPATCHED') {
    return postgresOutcomeIsUnknown(error)
      ? 'FOUNDATION_OUTCOME_UNKNOWN'
      : 'FOUNDATION_ROLLED_BACK';
  }
  if (['FOUNDATION_RETURNED', 'RLS_DISPATCHED'].includes(stage)) {
    if (stage === 'RLS_DISPATCHED' && postgresOutcomeIsUnknown(error)) {
      return 'RLS_OUTCOME_UNKNOWN';
    }
    return 'FOUNDATION_ONLY_COMMITTED';
  }
  if ([
    'RLS_RETURNED',
    'BASE_GUARD_DISPATCHED',
    'BASE_GUARD_VERIFIED',
  ].includes(stage)) return 'BASE_SCHEMA_ONLY_COMMITTED';
  if (stage === 'IDENTITY_SCOPE_DISPATCHED') {
    return postgresOutcomeIsUnknown(error)
      ? 'IDENTITY_SCOPE_OUTCOME_UNKNOWN'
      : 'BASE_SCHEMA_ONLY_COMMITTED';
  }
  if ([
    'IDENTITY_SCOPE_RETURNED',
    'SUCCESSOR_VERIFICATION_DISPATCHED',
    'SUCCESSOR_GUARD_VERIFIED',
    'POSTFLIGHT_DISPATCHED',
    'POSTFLIGHT_RETURNED',
  ].includes(stage)) {
    const { postgresCode } = classifySafeFailure(error);
    return error instanceof Dr133RunnerError || ['42501', '55000'].includes(postgresCode)
      ? 'ALL_THREE_COMMITTED_POSTFLIGHT_REJECTED'
      : 'ALL_THREE_COMMITTED_VERIFICATION_UNKNOWN';
  }
  if (stage === 'POSTFLIGHT_VERIFIED') {
    return 'ALL_THREE_COMMITTED_VERIFIED_CLEANUP_FAILED';
  }
  return 'ALL_THREE_COMMITTED_POSTFLIGHT_REJECTED';
}

async function closeClientFailClosed(client, state) {
  if (!client || !state.connected) return null;
  let cleanupError = null;
  if (state.locked) {
    try {
      const unlockResult = await client.query(DR133_ADVISORY_UNLOCK_SQL);
      if (unlockResult.rows?.[0]?.released !== true) failDr133('ADVISORY_UNLOCK_FAILED');
      state.locked = false;
    } catch (error) {
      cleanupError = error;
    }
  }
  try {
    await client.end();
    state.connected = false;
  } catch (error) {
    cleanupError ??= error;
  }
  return cleanupError;
}

export async function runDr133StagingMigration({
  environment = process.env,
  ClientClass = Client,
  readFileFn = readFile,
  output = process.stdout,
} = {}) {
  let stage = 'INITIAL';
  let primaryError = null;
  let client = null;
  let preflightRow = null;
  let postflightRow = null;
  const state = { connected: false, locked: false };
  let artifacts;

  try {
    const resolved = resolveDr133RunnerEnvironment(environment, { mode: 'migration' });
    artifacts = await loadVerifiedArtifacts(readFileFn);
    stage = 'ARTIFACTS_VERIFIED';

    const rlsRollbackSource = artifactById(artifacts, 'rls-rollback').bytes.toString('utf8');
    const baseGuardVerificationSql = extractRollbackGuardVerificationSql(rlsRollbackSource);
    const identityScopeRollbackSource = artifactById(
      artifacts,
      'identity-scope-rollback',
    ).bytes.toString('utf8');
    const successorGuardVerificationSql = extractIdentityScopeRollbackGuardVerificationSql(
      identityScopeRollbackSource,
    );

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: { rejectUnauthorized: false },
      application_name: 'missionmed-f2-lor-1012-dr133-staging-migration',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflightResult = await client.query(DR133_PREFLIGHT_SQL);
    preflightRow = preflightResult.rows?.[0];
    assertPreflightRow(preflightRow);
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflightResult = await client.query(DR133_PREFLIGHT_SQL);
    assertPreflightRow(lockedPreflightResult.rows?.[0]);
    await client.query("SET statement_timeout = '300s'");
    await client.query("SET lock_timeout = '15s'");
    await client.query("SET idle_in_transaction_session_timeout = '120s'");
    for (const [name, value] of targetGucEntries()) {
      const gucResult = await client.query(
        'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
        [name, value],
      );
      if (gucResult.rows?.[0]?.configured_value !== value) failDr133('TARGET_GUC_REJECTED');
    }

    stage = 'FOUNDATION_DISPATCHED';
    await client.query(artifactById(artifacts, 'foundation').bytes.toString('utf8'));
    stage = 'FOUNDATION_RETURNED';

    const sentinelResult = await client.query(DR133_FOUNDATION_SENTINEL_SQL);
    assertFoundationSentinelRow(sentinelResult.rows?.[0]);

    stage = 'RLS_DISPATCHED';
    await client.query(artifactById(artifacts, 'rls').bytes.toString('utf8'));
    stage = 'RLS_RETURNED';

    stage = 'BASE_GUARD_DISPATCHED';
    await client.query(baseGuardVerificationSql);
    stage = 'BASE_GUARD_VERIFIED';

    stage = 'IDENTITY_SCOPE_DISPATCHED';
    await client.query(artifactById(artifacts, 'identity-scope').bytes.toString('utf8'));
    stage = 'IDENTITY_SCOPE_RETURNED';

    stage = 'SUCCESSOR_VERIFICATION_DISPATCHED';
    await client.query(successorGuardVerificationSql);
    stage = 'SUCCESSOR_GUARD_VERIFIED';
    stage = 'POSTFLIGHT_DISPATCHED';
    const catalogResult = await client.query(DR133_POSTFLIGHT_CATALOG_SQL);
    const nonemptyResult = await client.query(buildNonemptyRelationsSql());
    stage = 'POSTFLIGHT_RETURNED';
    postflightRow = {
      ...catalogResult.rows?.[0],
      ...nonemptyResult.rows?.[0],
    };
    assertPostflightRow(postflightRow);
    stage = 'POSTFLIGHT_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  const cleanupError = await closeClientFailClosed(client, state);
  primaryError ??= cleanupError;

  const foundation = DR133_ARTIFACTS.find((artifact) => artifact.id === 'foundation');
  const rls = DR133_ARTIFACTS.find((artifact) => artifact.id === 'rls');
  const identityScope = DR133_ARTIFACTS.find((artifact) => artifact.id === 'identity-scope');
  const identityScopeRollback = DR133_ARTIFACTS.find(
    (artifact) => artifact.id === 'identity-scope-rollback',
  );
  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeDr133Receipt(output, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'migration',
      result: resultForFailure(stage, primaryError),
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      foundationSha256: foundation.sha256,
      rlsSha256: rls.sha256,
      identityScopeSha256: identityScope.sha256,
      identityScopeRollbackSha256: identityScopeRollback.sha256,
    });
    failDr133(
      safeFailure.postgresCode
        ? `POSTGRES_${safeFailure.postgresCode}`
        : safeFailure.runnerCode,
    );
  }

  writeDr133Receipt(output, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'migration',
    result: 'ALL_THREE_COMMITTED_VERIFIED',
    postgresMajor: preflightRow.postgres_major,
    relationCount: Number(postflightRow.relation_count),
    definerCount: Number(postflightRow.definer_count),
    foundationSha256: foundation.sha256,
    rlsSha256: rls.sha256,
    identityScopeSha256: identityScope.sha256,
    identityScopeRollbackSha256: identityScopeRollback.sha256,
  });
  return Object.freeze({ result: 'ALL_THREE_COMMITTED_VERIFIED' });
}

function successorSchemaState(row) {
  try {
    assertBaseSchemaPreflightRow(row);
    return 'base';
  } catch {
    try {
      assertSuccessorSchemaPreflightRow(row);
      return 'successor';
    } catch {
      failDr133('SUCCESSOR_MIGRATION_PREFLIGHT_TARGET_INVALID');
    }
  }
}

function successorResultForFailure(stage, error, { alreadyCommitted, mutationDispatched }) {
  if (alreadyCommitted) {
    return stage === 'POSTFLIGHT_VERIFIED'
      ? 'SUCCESSOR_ALREADY_COMMITTED_VERIFIED_CLEANUP_FAILED'
      : 'NO_MUTATION';
  }
  if ([
    'INITIAL',
    'ARTIFACTS_VERIFIED',
    'CONNECTED',
    'BASE_PREFLIGHT_VERIFIED',
    'LOCKED',
    'BASE_GUARD_DISPATCHED',
    'BASE_GUARD_VERIFIED',
  ].includes(stage)) return 'NO_MUTATION';
  if (mutationDispatched && stage === 'IDENTITY_SCOPE_DISPATCHED') {
    return postgresOutcomeIsUnknown(error)
      ? 'SUCCESSOR_OUTCOME_UNKNOWN'
      : 'SUCCESSOR_ROLLED_BACK';
  }
  if ([
    'IDENTITY_SCOPE_RETURNED',
    'SUCCESSOR_VERIFICATION_DISPATCHED',
    'SUCCESSOR_GUARD_VERIFIED',
    'POSTFLIGHT_DISPATCHED',
    'POSTFLIGHT_RETURNED',
  ].includes(stage)) {
    const { postgresCode } = classifySafeFailure(error);
    return error instanceof Dr133RunnerError || ['42501', '55000'].includes(postgresCode)
      ? 'SUCCESSOR_COMMITTED_POSTFLIGHT_REJECTED'
      : 'SUCCESSOR_COMMITTED_VERIFICATION_UNKNOWN';
  }
  if (stage === 'POSTFLIGHT_VERIFIED') {
    return 'SUCCESSOR_COMMITTED_VERIFIED_CLEANUP_FAILED';
  }
  return 'SUCCESSOR_COMMITTED_POSTFLIGHT_REJECTED';
}

export async function runDr133StagingSuccessorMigration({
  environment = process.env,
  ClientClass = Client,
  readFileFn = readFile,
  output = process.stdout,
} = {}) {
  let stage = 'INITIAL';
  let primaryError = null;
  let client = null;
  let preflightRow = null;
  let postflightRow = null;
  let alreadyCommitted = false;
  let mutationDispatched = false;
  const state = { connected: false, locked: false };
  let artifacts;

  try {
    const resolved = resolveDr133RunnerEnvironment(environment, { mode: 'successor-migration' });
    artifacts = await loadVerifiedArtifacts(readFileFn);
    stage = 'ARTIFACTS_VERIFIED';

    const rlsRollbackSource = artifactById(artifacts, 'rls-rollback').bytes.toString('utf8');
    const baseGuardVerificationSql = extractRollbackGuardVerificationSql(rlsRollbackSource);
    const identityScopeRollbackSource = artifactById(
      artifacts,
      'identity-scope-rollback',
    ).bytes.toString('utf8');
    const successorGuardVerificationSql = extractIdentityScopeRollbackGuardVerificationSql(
      identityScopeRollbackSource,
    );

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: { rejectUnauthorized: false },
      application_name: 'missionmed-f2-lor-1012-dr133-staging-successor-migration',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflightResult = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    preflightRow = preflightResult.rows?.[0];
    const preflightState = successorSchemaState(preflightRow);
    stage = 'BASE_PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflight = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    const lockedState = successorSchemaState(lockedPreflight.rows?.[0]);
    if (preflightState === 'successor' && lockedState !== 'successor') {
      failDr133('SUCCESSOR_SCHEMA_STATE_REGRESSED');
    }
    alreadyCommitted = lockedState === 'successor';
    await client.query("SET statement_timeout = '300s'");
    await client.query("SET lock_timeout = '15s'");
    await client.query("SET idle_in_transaction_session_timeout = '120s'");
    for (const [name, value] of targetGucEntries()) {
      const gucResult = await client.query(
        'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
        [name, value],
      );
      if (gucResult.rows?.[0]?.configured_value !== value) failDr133('TARGET_GUC_REJECTED');
    }

    if (!alreadyCommitted) {
      stage = 'BASE_GUARD_DISPATCHED';
      await client.query(baseGuardVerificationSql);
      stage = 'BASE_GUARD_VERIFIED';
      stage = 'IDENTITY_SCOPE_DISPATCHED';
      mutationDispatched = true;
      await client.query(artifactById(artifacts, 'identity-scope').bytes.toString('utf8'));
      stage = 'IDENTITY_SCOPE_RETURNED';
    }
    stage = 'SUCCESSOR_VERIFICATION_DISPATCHED';
    await client.query(successorGuardVerificationSql);
    stage = 'SUCCESSOR_GUARD_VERIFIED';
    stage = 'POSTFLIGHT_DISPATCHED';
    const catalogResult = await client.query(DR133_POSTFLIGHT_CATALOG_SQL);
    const nonemptyResult = await client.query(buildNonemptyRelationsSql());
    stage = 'POSTFLIGHT_RETURNED';
    postflightRow = {
      ...catalogResult.rows?.[0],
      ...nonemptyResult.rows?.[0],
    };
    assertPostflightRow(postflightRow);
    stage = 'POSTFLIGHT_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  const cleanupError = await closeClientFailClosed(client, state);
  primaryError ??= cleanupError;

  const foundation = DR133_ARTIFACTS.find((artifact) => artifact.id === 'foundation');
  const rls = DR133_ARTIFACTS.find((artifact) => artifact.id === 'rls');
  const identityScope = DR133_ARTIFACTS.find((artifact) => artifact.id === 'identity-scope');
  const identityScopeRollback = DR133_ARTIFACTS.find(
    (artifact) => artifact.id === 'identity-scope-rollback',
  );
  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeDr133Receipt(output, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'successor-migration',
      result: successorResultForFailure(stage, primaryError, {
        alreadyCommitted,
        mutationDispatched,
      }),
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      foundationSha256: foundation.sha256,
      rlsSha256: rls.sha256,
      identityScopeSha256: identityScope.sha256,
      identityScopeRollbackSha256: identityScopeRollback.sha256,
    });
    failDr133(
      safeFailure.postgresCode
        ? `POSTGRES_${safeFailure.postgresCode}`
        : safeFailure.runnerCode,
    );
  }

  const successResult = alreadyCommitted
    ? 'SUCCESSOR_ALREADY_COMMITTED_VERIFIED'
    : 'SUCCESSOR_COMMITTED_VERIFIED';
  writeDr133Receipt(output, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'successor-migration',
    result: successResult,
    postgresMajor: preflightRow.postgres_major,
    relationCount: Number(postflightRow.relation_count),
    definerCount: Number(postflightRow.definer_count),
    foundationSha256: foundation.sha256,
    rlsSha256: rls.sha256,
    identityScopeSha256: identityScope.sha256,
    identityScopeRollbackSha256: identityScopeRollback.sha256,
  });
  return Object.freeze({ result: successResult });
}

export async function verifyDr133StagingSuccessorSchema({
  environment = process.env,
  ClientClass = Client,
  readFileFn = readFile,
  output = process.stdout,
} = {}) {
  let stage = 'INITIAL';
  let primaryError = null;
  let client = null;
  let preflightRow = null;
  let postflightRow = null;
  const state = { connected: false, locked: false };
  let artifacts;

  try {
    const resolved = resolveDr133RunnerEnvironment(environment, { mode: 'schema-verifier' });
    artifacts = await loadVerifiedArtifacts(readFileFn);
    stage = 'ARTIFACTS_VERIFIED';
    const identityScopeRollbackSource = artifactById(
      artifacts,
      'identity-scope-rollback',
    ).bytes.toString('utf8');
    const successorGuardVerificationSql = extractIdentityScopeRollbackGuardVerificationSql(
      identityScopeRollbackSource,
    );

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: { rejectUnauthorized: false },
      application_name: 'missionmed-f2-lor-1012-dr133-staging-schema-verifier',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflightResult = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    preflightRow = preflightResult.rows?.[0];
    assertSuccessorSchemaPreflightRow(preflightRow);
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflight = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    assertSuccessorSchemaPreflightRow(lockedPreflight.rows?.[0]);
    await client.query("SET statement_timeout = '300s'");
    await client.query("SET lock_timeout = '15s'");
    await client.query("SET idle_in_transaction_session_timeout = '120s'");
    for (const [name, value] of targetGucEntries()) {
      const gucResult = await client.query(
        'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
        [name, value],
      );
      if (gucResult.rows?.[0]?.configured_value !== value) failDr133('TARGET_GUC_REJECTED');
    }

    await client.query(successorGuardVerificationSql);
    const catalogResult = await client.query(DR133_POSTFLIGHT_CATALOG_SQL);
    const nonemptyResult = await client.query(buildNonemptyRelationsSql());
    postflightRow = {
      ...catalogResult.rows?.[0],
      ...nonemptyResult.rows?.[0],
    };
    assertPostflightRow(postflightRow);
    stage = 'POSTFLIGHT_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  const cleanupError = await closeClientFailClosed(client, state);
  primaryError ??= cleanupError;

  const foundation = DR133_ARTIFACTS.find((artifact) => artifact.id === 'foundation');
  const rls = DR133_ARTIFACTS.find((artifact) => artifact.id === 'rls');
  const identityScope = DR133_ARTIFACTS.find((artifact) => artifact.id === 'identity-scope');
  const identityScopeRollback = DR133_ARTIFACTS.find(
    (artifact) => artifact.id === 'identity-scope-rollback',
  );
  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeDr133Receipt(output, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'schema-verifier',
      result: stage === 'POSTFLIGHT_VERIFIED'
        ? 'SCHEMA_VERIFIED_NO_MUTATION_CLEANUP_FAILED'
        : 'NO_MUTATION',
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      foundationSha256: foundation.sha256,
      rlsSha256: rls.sha256,
      identityScopeSha256: identityScope.sha256,
      identityScopeRollbackSha256: identityScopeRollback.sha256,
    });
    failDr133(
      safeFailure.postgresCode
        ? `POSTGRES_${safeFailure.postgresCode}`
        : safeFailure.runnerCode,
    );
  }

  writeDr133Receipt(output, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'schema-verifier',
    result: 'SCHEMA_VERIFIED_NO_MUTATION',
    postgresMajor: preflightRow.postgres_major,
    relationCount: Number(postflightRow.relation_count),
    definerCount: Number(postflightRow.definer_count),
    foundationSha256: foundation.sha256,
    rlsSha256: rls.sha256,
    identityScopeSha256: identityScope.sha256,
    identityScopeRollbackSha256: identityScopeRollback.sha256,
  });
  return Object.freeze({ result: 'SCHEMA_VERIFIED_NO_MUTATION' });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const configuredOperation = process.env.LOR_DR133_MODE === 'migration'
    ? runDr133StagingMigration
    : process.env.LOR_DR133_MODE === 'successor-migration'
      ? runDr133StagingSuccessorMigration
    : process.env.LOR_DR133_MODE === 'schema-verifier'
      ? verifyDr133StagingSuccessorSchema
      : null;
  if (!configuredOperation) {
    process.exitCode = 1;
  } else {
    configuredOperation().catch(() => {
      process.exitCode = 1;
    });
  }
}

void DR133_TARGET;
void DR133_APPLICATION_ROLE;
void DR133_COMMAND_OWNER_ROLE;
void DR133_RELATIONS;
void DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES;
