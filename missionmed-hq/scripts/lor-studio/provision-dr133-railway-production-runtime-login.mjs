import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  DR133_ARTIFACTS,
  DR133_RUNNER_CONTRACT,
  DR133_RUNTIME_LOGIN,
  Dr133RunnerError,
  assertRuntimeAdminRow,
  assertRuntimeCleanupRow,
  assertRuntimeIdentityRow,
  assertRuntimeSetRoleRow,
  assertSuccessorSchemaPreflightRow,
  buildNonemptyRelationsSql,
  classifySafeFailure,
  extractSuccessorRollbackGuardVerificationSql,
  failDr133,
  postgresOutcomeIsUnknown,
  resolveDr133RunnerEnvironment,
  sha256Bytes,
  targetGucEntries,
  writeDr133Receipt,
} from './railway-dr133-production-runner-core.mjs';

const { Client } = pg;

export const DR133_RUNTIME_ADVISORY_LOCK_SQL = `
SELECT pg_catalog.pg_try_advisory_lock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:576520f5-a702-4343-a277-decdeeed57f6:database-mutation',
    0
  )
) AS acquired
`;

export const DR133_RUNTIME_ADVISORY_UNLOCK_SQL = `
SELECT pg_catalog.pg_advisory_unlock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:576520f5-a702-4343-a277-decdeeed57f6:database-mutation',
    0
  )
) AS released
`;

export const DR133_RUNTIME_ADMIN_PREFLIGHT_SQL = `
/* missionmed:dr133:runtime-login-admin-preflight */
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
      pg_catalog.inet_server_addr() << pg_catalog.inet '127.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '::1/128'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
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

export const DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL = `
/* missionmed:dr133:runtime-login-admin-postflight */
WITH role_oids AS (
  SELECT
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_app') AS app_oid,
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_runtime_login')
      AS runtime_oid
),
runtime_memberships AS (
  SELECT membership.*
  FROM pg_catalog.pg_auth_members AS membership
  CROSS JOIN role_oids
  WHERE membership.roleid IN (role_oids.app_oid, role_oids.runtime_oid)
    OR membership.member IN (role_oids.app_oid, role_oids.runtime_oid)
),
runtime_owned_objects AS (
  SELECT namespace.oid
  FROM pg_catalog.pg_namespace AS namespace
  CROSS JOIN role_oids
  WHERE namespace.nspowner = role_oids.runtime_oid
  UNION ALL
  SELECT class.oid
  FROM pg_catalog.pg_class AS class
  CROSS JOIN role_oids
  WHERE class.relowner = role_oids.runtime_oid
  UNION ALL
  SELECT procedure.oid
  FROM pg_catalog.pg_proc AS procedure
  CROSS JOIN role_oids
  WHERE procedure.proowner = role_oids.runtime_oid
)
SELECT
  (
    SELECT pg_catalog.count(*) = 1
    FROM pg_catalog.pg_roles AS role
    JOIN pg_catalog.pg_authid AS auth_identity ON auth_identity.oid = role.oid
    WHERE role.rolname = 'lor_studio_runtime_login'
      AND role.rolsuper IS FALSE
      AND role.rolinherit IS FALSE
      AND role.rolcreaterole IS FALSE
      AND role.rolcreatedb IS FALSE
      AND role.rolcanlogin IS TRUE
      AND role.rolreplication IS FALSE
      AND role.rolbypassrls IS FALSE
      AND role.rolconnlimit = 20
      AND role.rolvaliduntil IS NULL
      AND auth_identity.rolpassword LIKE 'SCRAM-SHA-256$%'
      AND role.rolconfig @> ARRAY[
        'search_path=pg_catalog',
        'statement_timeout=15s',
        'lock_timeout=5s',
        'idle_in_transaction_session_timeout=15s'
      ]::text[]
      AND pg_catalog.cardinality(role.rolconfig) = 4
  ) AS runtime_role_safe,
  (
    SELECT pg_catalog.count(*) = 1
    FROM pg_catalog.pg_auth_members AS membership
    CROSS JOIN role_oids
    WHERE membership.roleid = role_oids.app_oid
      AND membership.member = role_oids.runtime_oid
      AND membership.grantor = (
        SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user
      )
      AND membership.admin_option IS FALSE
      AND membership.inherit_option IS FALSE
      AND membership.set_option IS TRUE
  ) AS membership_safe,
  (SELECT pg_catalog.count(*)::text FROM runtime_memberships) AS membership_count,
  (SELECT pg_catalog.count(*)::text FROM runtime_owned_objects)
    AS runtime_owned_object_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_default_acl AS default_acl
    CROSS JOIN role_oids
    WHERE default_acl.defaclrole = role_oids.runtime_oid
  ) AS runtime_default_acl_count
`;

export const DR133_RUNTIME_IDENTITY_SQL = `
WITH ssl_session AS (
  SELECT ssl, version, cipher
  FROM pg_catalog.pg_stat_ssl
  WHERE pid = pg_catalog.pg_backend_pid()
)
SELECT
  pg_catalog.current_database()::text AS database_name,
  current_user::text AS current_user,
  session_user::text AS session_user,
  (
    pg_catalog.inet_server_addr() IS NOT NULL
    AND (
      pg_catalog.inet_server_addr() << pg_catalog.inet '127.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '::1/128'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
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
  ssl_session.cipher::text AS ssl_cipher
FROM (SELECT 1) AS one
LEFT JOIN ssl_session ON true
`;

export const DR133_RUNTIME_SET_ROLE_SQL = `
SELECT
  current_user::text AS current_user,
  session_user::text AS session_user,
  (SELECT pg_catalog.count(*)::text FROM lor_studio.recommendation_cases)
    AS visible_case_count
`;

export const DR133_RUNTIME_CREATE_ROLE_SQL = `
DO $runtime_login$
DECLARE
  runtime_password text := pg_catalog.current_setting(
    'missionmed.lor.runtime_login_password',
    true
  );
BEGIN
  IF runtime_password IS NULL
    OR runtime_password !~ '^[A-Za-z0-9_-]{43,128}$'
  THEN
    RAISE EXCEPTION 'DR-133 runtime login password is missing or invalid'
      USING ERRCODE = '22023';
  END IF;

  EXECUTE pg_catalog.format(
    'CREATE ROLE lor_studio_runtime_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 20 PASSWORD %L',
    runtime_password
  );
  PERFORM pg_catalog.set_config('missionmed.lor.runtime_login_password', '', true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('missionmed.lor.runtime_login_password', '', true);
    RAISE EXCEPTION 'DR-133 runtime login creation failed'
      USING ERRCODE = SQLSTATE;
END
$runtime_login$
`;

export const DR133_RUNTIME_FORBIDDEN_DELETE_SQL =
  'DELETE FROM lor_studio.recommendation_cases WHERE false';

export const DR133_RUNTIME_ROLE_HARDENING_SQL = Object.freeze([
  'ALTER ROLE lor_studio_runtime_login SET search_path = pg_catalog',
  "ALTER ROLE lor_studio_runtime_login SET statement_timeout = '15s'",
  "ALTER ROLE lor_studio_runtime_login SET lock_timeout = '5s'",
  "ALTER ROLE lor_studio_runtime_login SET idle_in_transaction_session_timeout = '15s'",
  'GRANT lor_studio_app TO lor_studio_runtime_login WITH INHERIT FALSE, SET TRUE, ADMIN FALSE',
]);

export const DR133_RUNTIME_SECRET_LOG_GUARD_SQL = Object.freeze([
  "SET LOCAL log_statement = 'none'",
  "SET LOCAL log_min_error_statement = 'panic'",
  "SET LOCAL log_min_duration_statement = '-1'",
  "SET LOCAL log_min_duration_sample = '-1'",
  "SET LOCAL log_duration = 'off'",
  "SET LOCAL log_statement_sample_rate = '0'",
  "SET LOCAL log_transaction_sample_rate = '0'",
  "SET LOCAL log_parameter_max_length = '0'",
  "SET LOCAL log_parameter_max_length_on_error = '0'",
]);

export const DR133_RUNTIME_SECRET_LOG_GUARD_VERIFY_SQL = `
/* missionmed:dr133:runtime-login-secret-log-guard */
SELECT (
  pg_catalog.current_setting('log_statement') = 'none'
  AND pg_catalog.current_setting('log_min_error_statement') = 'panic'
  AND pg_catalog.current_setting('log_min_duration_statement')::integer = -1
  AND pg_catalog.current_setting('log_min_duration_sample')::integer = -1
  AND pg_catalog.current_setting('log_duration') = 'off'
  AND pg_catalog.current_setting('log_statement_sample_rate')::numeric = 0
  AND pg_catalog.current_setting('log_transaction_sample_rate')::numeric = 0
  AND pg_catalog.current_setting('log_parameter_max_length')::integer = 0
  AND pg_catalog.current_setting('log_parameter_max_length_on_error')::integer = 0
) AS logging_safe
`;

function assertRuntimeAdminPreflightRow(row) {
  try {
    assertSuccessorSchemaPreflightRow(row);
  } catch {
    failDr133('RUNTIME_ADMIN_PREFLIGHT_INVALID');
  }
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
    if (sha256Bytes(bytes) !== contract.sha256) failDr133('ARTIFACT_HASH_MISMATCH');
    artifacts.set(contract.id, Object.freeze({ ...contract, bytes }));
  }
  return artifacts;
}

function resultForFailure(stage, error, runtimeTransactionRolledBack) {
  if ([
    'INITIAL',
    'ARTIFACTS_VERIFIED',
    'ADMIN_CONNECTED',
    'PREFLIGHT_VERIFIED',
    'LOCKED',
  ].includes(stage)) return 'NO_MUTATION';
  if (stage === 'RUNTIME_COMMIT_DISPATCHED') return 'RUNTIME_LOGIN_OUTCOME_UNKNOWN';
  if (stage === 'RUNTIME_TRANSACTION_DISPATCHED') {
    if (runtimeTransactionRolledBack || !postgresOutcomeIsUnknown(error)) {
      return 'RUNTIME_LOGIN_ROLLED_BACK';
    }
    return 'RUNTIME_LOGIN_OUTCOME_UNKNOWN';
  }
  if (stage === 'RUNTIME_SMOKE_VERIFIED') {
    return 'RUNTIME_LOGIN_COMMITTED_VERIFIED_CLEANUP_FAILED';
  }
  const { postgresCode } = classifySafeFailure(error);
  return error instanceof Dr133RunnerError
      || ['28000', '28P01', '42501', '55000'].includes(postgresCode)
    ? 'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED'
    : 'RUNTIME_LOGIN_COMMITTED_VERIFICATION_UNKNOWN';
}

async function closeClient(client) {
  if (!client) return null;
  try {
    await client.end();
    return null;
  } catch (error) {
    return error;
  }
}

export async function provisionDr133RailwayProductionRuntimeLogin({
  environment = process.env,
  ClientClass = Client,
  readFileFn = readFile,
  output = process.stdout,
} = {}) {
  let stage = 'INITIAL';
  let primaryError = null;
  let adminClient = null;
  let runtimeClient = null;
  let adminConnected = false;
  let runtimeConnected = false;
  let locked = false;
  let runtimeTransactionRolledBack = false;
  let artifacts;
  let rollbackArtifact = null;

  try {
    const resolved = resolveDr133RunnerEnvironment(environment, { mode: 'runtime-login' });
    artifacts = await loadVerifiedArtifacts(readFileFn);
    stage = 'ARTIFACTS_VERIFIED';
    rollbackArtifact = artifacts.get('mentor-assignment-rollback');
    if (!rollbackArtifact) failDr133('ARTIFACT_INVENTORY_INVALID');
    const guardVerificationSql = extractSuccessorRollbackGuardVerificationSql(
      rollbackArtifact.bytes.toString('utf8'),
      rollbackArtifact.id,
    );

    adminClient = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-runtime-login-admin',
      connectionTimeoutMillis: 15_000,
    });
    await adminClient.connect();
    adminConnected = true;
    stage = 'ADMIN_CONNECTED';

    const preflightResult = await adminClient.query(DR133_RUNTIME_ADMIN_PREFLIGHT_SQL);
    assertRuntimeAdminPreflightRow(preflightResult.rows?.[0]);
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await adminClient.query(DR133_RUNTIME_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    locked = true;
    stage = 'LOCKED';

    await adminClient.query("SET statement_timeout = '300s'");
    await adminClient.query("SET lock_timeout = '15s'");
    await adminClient.query("SET idle_in_transaction_session_timeout = '120s'");
    for (const [name, value] of targetGucEntries()) {
      const gucResult = await adminClient.query(
        'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
        [name, value],
      );
      if (gucResult.rows?.[0]?.configured_value !== value) failDr133('TARGET_GUC_REJECTED');
    }
    await adminClient.query(guardVerificationSql);
    const emptyResult = await adminClient.query(buildNonemptyRelationsSql());
    if (emptyResult.rows?.[0]?.nonempty_relation_count !== '0') {
      failDr133('RUNTIME_LOGIN_REQUIRES_EMPTY_TARGET');
    }

    stage = 'RUNTIME_TRANSACTION_DISPATCHED';
    try {
      await adminClient.query('BEGIN');
      for (const statement of DR133_RUNTIME_SECRET_LOG_GUARD_SQL) {
        await adminClient.query(statement);
      }
      const logGuardResult = await adminClient.query(
        DR133_RUNTIME_SECRET_LOG_GUARD_VERIFY_SQL,
      );
      if (logGuardResult.rows?.[0]?.logging_safe !== true) {
        failDr133('RUNTIME_SECRET_LOG_GUARD_REJECTED');
      }
      await adminClient.query("SET LOCAL password_encryption = 'scram-sha-256'");
      await adminClient.query("SET LOCAL statement_timeout = '30s'");
      await adminClient.query("SET LOCAL lock_timeout = '5s'");
      const passwordBindResult = await adminClient.query(
        `SELECT pg_catalog.set_config(
          'missionmed.lor.runtime_login_password',
          $1::text,
          true
        ) IS NOT NULL AS configured`,
        [resolved.runtimePassword],
      );
      if (passwordBindResult.rows?.[0]?.configured !== true) {
        failDr133('RUNTIME_PASSWORD_BIND_FAILED');
      }
      await adminClient.query(DR133_RUNTIME_CREATE_ROLE_SQL);
      for (const statement of DR133_RUNTIME_ROLE_HARDENING_SQL) {
        await adminClient.query(statement);
      }
      stage = 'RUNTIME_COMMIT_DISPATCHED';
      await adminClient.query('COMMIT');
    } catch (error) {
      try {
        await adminClient.query('ROLLBACK');
        runtimeTransactionRolledBack = true;
      } catch {
        runtimeTransactionRolledBack = false;
      }
      throw error;
    }
    stage = 'RUNTIME_COMMITTED';

    const adminPostflight = await adminClient.query(DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL);
    assertRuntimeAdminRow(adminPostflight.rows?.[0]);

    runtimeClient = new ClientClass({
      connectionString: resolved.runtimePgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-runtime-login-smoke',
      connectionTimeoutMillis: 15_000,
    });
    await runtimeClient.connect();
    runtimeConnected = true;
    const runtimeIdentity = await runtimeClient.query(DR133_RUNTIME_IDENTITY_SQL);
    assertRuntimeIdentityRow(runtimeIdentity.rows?.[0]);

    let directReadDenied = false;
    try {
      await runtimeClient.query(
        'SELECT pg_catalog.count(*) FROM lor_studio.recommendation_cases',
      );
    } catch (error) {
      directReadDenied = error?.code === '42501';
    }
    if (!directReadDenied) failDr133('RUNTIME_DIRECT_READ_NOT_DENIED');

    await runtimeClient.query('BEGIN');
    try {
      await runtimeClient.query('SET LOCAL ROLE lor_studio_app');
      const setRoleResult = await runtimeClient.query(DR133_RUNTIME_SET_ROLE_SQL);
      assertRuntimeSetRoleRow(setRoleResult.rows?.[0]);
      await runtimeClient.query('SAVEPOINT dr133_forbidden_direct_dml');
      let directDeleteDenied = false;
      try {
        await runtimeClient.query(DR133_RUNTIME_FORBIDDEN_DELETE_SQL);
      } catch (error) {
        directDeleteDenied = error?.code === '42501';
      }
      await runtimeClient.query('ROLLBACK TO SAVEPOINT dr133_forbidden_direct_dml');
      await runtimeClient.query('RELEASE SAVEPOINT dr133_forbidden_direct_dml');
      if (!directDeleteDenied) failDr133('RUNTIME_DIRECT_DELETE_NOT_DENIED');
    } finally {
      await runtimeClient.query('ROLLBACK');
    }
    const cleanupIdentity = await runtimeClient.query(
      'SELECT current_user::text AS current_user, session_user::text AS session_user',
    );
    assertRuntimeCleanupRow(cleanupIdentity.rows?.[0]);
    stage = 'RUNTIME_SMOKE_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  if (runtimeConnected) {
    const runtimeCloseError = await closeClient(runtimeClient);
    primaryError ??= runtimeCloseError;
    runtimeConnected = false;
  }
  if (adminConnected && locked) {
    try {
      const unlockResult = await adminClient.query(DR133_RUNTIME_ADVISORY_UNLOCK_SQL);
      if (unlockResult.rows?.[0]?.released !== true) failDr133('ADVISORY_UNLOCK_FAILED');
      locked = false;
    } catch (error) {
      primaryError ??= error;
    }
  }
  if (adminConnected) {
    const adminCloseError = await closeClient(adminClient);
    primaryError ??= adminCloseError;
    adminConnected = false;
  }

  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeDr133Receipt(output, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'runtime-login',
      result: resultForFailure(stage, primaryError, runtimeTransactionRolledBack),
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      ...(rollbackArtifact
        ? { mentorAssignmentRollbackSha256: rollbackArtifact.sha256 }
        : {}),
    });
    failDr133(
      safeFailure.postgresCode
        ? `POSTGRES_${safeFailure.postgresCode}`
        : safeFailure.runnerCode,
    );
  }

  writeDr133Receipt(output, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'runtime-login',
    result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED',
    mentorAssignmentRollbackSha256: rollbackArtifact.sha256,
  });
  return Object.freeze({ result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED' });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  provisionDr133RailwayProductionRuntimeLogin().catch(() => {
    process.exitCode = 1;
  });
}
