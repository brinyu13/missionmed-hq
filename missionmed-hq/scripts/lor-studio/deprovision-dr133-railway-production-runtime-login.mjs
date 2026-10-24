import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  DR133_ARTIFACTS,
  DR133_RUNNER_CONTRACT,
  DR133_SUCCESSOR_STAGES,
  Dr133RunnerError,
  assertRuntimeDeprovisionAbsentRow,
  assertRuntimeDeprovisionPreflightRow,
  assertRuntimeDeprovisionQuarantinedRow,
  assertRuntimeDeprovisionRevokedRow,
  classifySafeFailure,
  dr133RuntimeDeprovisionRollbackArtifactId,
  extractRollbackGuardTransactionBodySql,
  extractRollbackGuardVerificationSql,
  extractSuccessorRollbackGuardTransactionBodySql,
  extractSuccessorRollbackGuardVerificationSql,
  failDr133,
  resolveDr133RunnerEnvironment,
  sha256Bytes,
  targetGucEntries,
  writeDr133Receipt,
} from './railway-dr133-production-runner-core.mjs';

const { Client } = pg;

export const DR133_RUNTIME_DEPROVISION_ADVISORY_LOCK_SQL = `
SELECT pg_catalog.pg_try_advisory_lock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:576520f5-a702-4343-a277-decdeeed57f6:database-mutation',
    0
  )
) AS acquired
`;

export const DR133_RUNTIME_DEPROVISION_ADVISORY_UNLOCK_SQL = `
SELECT pg_catalog.pg_advisory_unlock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:576520f5-a702-4343-a277-decdeeed57f6:database-mutation',
    0
  )
) AS released
`;

export const DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL = `
/* missionmed:dr133:runtime-login-deprovision-preflight */
WITH ssl_session AS (
  SELECT ssl, version, cipher
  FROM pg_catalog.pg_stat_ssl
  WHERE pid = pg_catalog.pg_backend_pid()
),
database_identity AS (
  SELECT pg_catalog.pg_get_userbyid(datdba)::text AS database_owner
  FROM pg_catalog.pg_database
  WHERE datname = pg_catalog.current_database()
),
role_oids AS (
  SELECT
    (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'lor_studio_app') AS app_oid,
    (
      SELECT oid
      FROM pg_catalog.pg_roles
      WHERE rolname = 'lor_studio_runtime_login'
    ) AS runtime_oid
),
runtime_role_state AS (
  SELECT role.*, auth_identity.rolpassword AS auth_rolpassword
  FROM pg_catalog.pg_roles AS role
  JOIN pg_catalog.pg_authid AS auth_identity ON auth_identity.oid = role.oid
  CROSS JOIN role_oids
  WHERE role.oid = role_oids.runtime_oid
),
runtime_memberships AS (
  SELECT membership.*
  FROM pg_catalog.pg_auth_members AS membership
  CROSS JOIN role_oids
  WHERE membership.roleid IN (role_oids.app_oid, role_oids.runtime_oid)
    OR membership.member IN (role_oids.app_oid, role_oids.runtime_oid)
),
runtime_dependencies AS (
  SELECT dependency.*
  FROM pg_catalog.pg_shdepend AS dependency
  CROSS JOIN role_oids
  WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
    AND dependency.refobjid = role_oids.runtime_oid
),
starting_unauthenticated_client_backends AS (
  SELECT activity.pid
  FROM pg_catalog.pg_stat_activity AS activity
  LEFT JOIN pg_catalog.pg_authid AS authenticated_role
    ON authenticated_role.oid = activity.usesysid
  WHERE (
      activity.backend_type IS NULL
      OR activity.backend_type = 'client backend'
    )
    AND (
      activity.usesysid IS NULL
      OR authenticated_role.oid IS NULL
    )
)
SELECT
  pg_catalog.current_database()::text AS database_name,
  current_user::text AS current_user,
  session_user::text AS session_user,
  database_identity.database_owner,
  (pg_catalog.current_setting('server_version_num')::integer / 10000)::integer
    AS postgres_major,
  (
    SELECT setting::text
    FROM pg_catalog.pg_settings
    WHERE name = 'authentication_timeout'
      AND unit = 's'
      AND pending_restart IS FALSE
  ) AS authentication_timeout_seconds,
  (
    SELECT setting::text
    FROM pg_catalog.pg_settings
    WHERE name = 'pre_auth_delay'
      AND unit = 's'
      AND pending_restart IS FALSE
  ) AS pre_auth_delay_seconds,
  (
    SELECT setting::text
    FROM pg_catalog.pg_settings
    WHERE name = 'post_auth_delay'
      AND unit = 's'
      AND pending_restart IS FALSE
  ) AS post_auth_delay_seconds,
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
  ) AS runtime_login_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname LIKE 'lor\\_studio\\_%' ESCAPE '\\'
  ) AS lor_role_count,
  (SELECT runtime_oid::text FROM role_oids) AS runtime_role_oid,
  (
    SELECT pg_catalog.count(*) = 1
    FROM runtime_role_state AS role
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
      AND role.auth_rolpassword LIKE 'SCRAM-SHA-256$%'
      AND role.rolconfig @> ARRAY[
        'search_path=pg_catalog',
        'statement_timeout=15s',
        'lock_timeout=5s',
        'idle_in_transaction_session_timeout=15s'
      ]::text[]
      AND pg_catalog.cardinality(role.rolconfig) = 4
  ) AS runtime_role_active_safe,
  (
    SELECT pg_catalog.count(*) = 1
    FROM runtime_role_state AS role
    WHERE role.rolname = 'lor_studio_runtime_login'
      AND role.rolsuper IS FALSE
      AND role.rolinherit IS FALSE
      AND role.rolcreaterole IS FALSE
      AND role.rolcreatedb IS FALSE
      AND role.rolcanlogin IS FALSE
      AND role.rolreplication IS FALSE
      AND role.rolbypassrls IS FALSE
      AND role.rolconnlimit = 0
      AND role.rolvaliduntil IS NULL
      AND role.auth_rolpassword LIKE 'SCRAM-SHA-256$%'
      AND role.rolconfig @> ARRAY[
        'search_path=pg_catalog',
        'statement_timeout=15s',
        'lock_timeout=5s',
        'idle_in_transaction_session_timeout=15s'
      ]::text[]
      AND pg_catalog.cardinality(role.rolconfig) = 4
  ) AS runtime_role_quarantined_safe,
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
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_stat_activity
    CROSS JOIN role_oids
    WHERE usesysid = role_oids.runtime_oid
  ) AS runtime_active_session_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM starting_unauthenticated_client_backends
  ) AS starting_unauthenticated_client_backend_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM runtime_dependencies
    WHERE deptype = 'o'
  ) AS runtime_owned_object_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_default_acl AS default_acl
    CROSS JOIN role_oids
    WHERE default_acl.defaclrole = role_oids.runtime_oid
  ) AS runtime_default_acl_count,
  (SELECT pg_catalog.count(*)::text FROM runtime_dependencies)
    AS runtime_unsafe_dependency_count
FROM database_identity
LEFT JOIN ssl_session ON true
`;

export const DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL =
  'ALTER ROLE lor_studio_runtime_login NOLOGIN CONNECTION LIMIT 0';

export const DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_MARGIN_SECONDS = 1;

export const DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_SQL = `
SELECT true AS waited
FROM pg_catalog.pg_sleep($1::double precision)
`;

export const DR133_RUNTIME_DEPROVISION_REVOKED_SQL = `
/* missionmed:dr133:runtime-login-deprovision-revoked */
WITH runtime_dependencies AS (
  SELECT dependency.*
  FROM pg_catalog.pg_shdepend AS dependency
  WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
    AND dependency.refobjid = $1::oid
),
starting_unauthenticated_client_backends AS (
  SELECT activity.pid
  FROM pg_catalog.pg_stat_activity AS activity
  LEFT JOIN pg_catalog.pg_authid AS authenticated_role
    ON authenticated_role.oid = activity.usesysid
  WHERE (
      activity.backend_type IS NULL
      OR activity.backend_type = 'client backend'
    )
    AND (
      activity.usesysid IS NULL
      OR authenticated_role.oid IS NULL
    )
)
SELECT
  $1::oid::text AS checked_runtime_oid,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_runtime_login'
  ) AS runtime_name_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE oid = $1::oid
  ) AS runtime_oid_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.roleid = $1::oid
      OR membership.member = $1::oid
  ) AS membership_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_stat_activity
    WHERE usesysid = $1::oid
  ) AS runtime_active_session_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM starting_unauthenticated_client_backends
  ) AS starting_unauthenticated_client_backend_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM runtime_dependencies
    WHERE deptype = 'o'
  ) AS runtime_owned_object_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_default_acl AS default_acl
    WHERE default_acl.defaclrole = $1::oid
  ) AS runtime_default_acl_count,
  (SELECT pg_catalog.count(*)::text FROM runtime_dependencies)
    AS runtime_unsafe_dependency_count
`;

export const DR133_RUNTIME_DEPROVISION_ABSENCE_SQL = `
/* missionmed:dr133:runtime-login-deprovision-absence */
WITH runtime_dependencies AS (
  SELECT dependency.*
  FROM pg_catalog.pg_shdepend AS dependency
  WHERE dependency.refclassid = 'pg_catalog.pg_authid'::pg_catalog.regclass
    AND dependency.refobjid = $1::oid
),
starting_unauthenticated_client_backends AS (
  SELECT activity.pid
  FROM pg_catalog.pg_stat_activity AS activity
  LEFT JOIN pg_catalog.pg_authid AS authenticated_role
    ON authenticated_role.oid = activity.usesysid
  WHERE (
      activity.backend_type IS NULL
      OR activity.backend_type = 'client backend'
    )
    AND (
      activity.usesysid IS NULL
      OR authenticated_role.oid IS NULL
    )
)
SELECT
  $1::oid::text AS checked_runtime_oid,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname = 'lor_studio_runtime_login'
  ) AS runtime_name_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE oid = $1::oid
  ) AS runtime_oid_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.roleid = $1::oid
      OR membership.member = $1::oid
  ) AS membership_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_stat_activity
    WHERE usesysid = $1::oid
  ) AS runtime_active_session_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM starting_unauthenticated_client_backends
  ) AS starting_unauthenticated_client_backend_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM runtime_dependencies
    WHERE deptype = 'o'
  ) AS runtime_owned_object_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_default_acl AS default_acl
    WHERE default_acl.defaclrole = $1::oid
  ) AS runtime_default_acl_count,
  (SELECT pg_catalog.count(*)::text FROM runtime_dependencies)
    AS runtime_unsafe_dependency_count
`;

export const DR133_RUNTIME_DEPROVISION_REVOKE_SQL = `
REVOKE lor_studio_app
FROM lor_studio_runtime_login
GRANTED BY postgres
RESTRICT
`;

export const DR133_RUNTIME_DEPROVISION_DROP_SQL =
  'DROP ROLE lor_studio_runtime_login';

export const DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL = `
DO $empty_schema_guard$
DECLARE
  relation record;
  relation_nonempty boolean;
BEGIN
  FOR relation IN
    SELECT class.relname::text AS relation_name
    FROM pg_catalog.pg_class AS class
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'lor_studio'
      AND class.relkind IN ('r', 'p')
    ORDER BY class.relname COLLATE "C"
  LOOP
    EXECUTE pg_catalog.format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)',
      'lor_studio',
      relation.relation_name
    ) INTO STRICT relation_nonempty;
    IF relation_nonempty THEN
      RAISE EXCEPTION 'DR-133 runtime-login deprovision requires an empty LOR target'
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END
$empty_schema_guard$;
`;

async function loadVerifiedRuntimeDeprovisionGuards(readFileFn) {
  const guards = new Map();
  for (let stageIndex = 0; stageIndex <= DR133_SUCCESSOR_STAGES.length; stageIndex += 1) {
    const artifactId = dr133RuntimeDeprovisionRollbackArtifactId(stageIndex);
    const contract = DR133_ARTIFACTS.find((artifact) => artifact.id === artifactId);
    if (!contract) failDr133('ARTIFACT_INVENTORY_INVALID');
    let bytes;
    try {
      bytes = await readFileFn(new URL(contract.relativePath, import.meta.url));
    } catch {
      failDr133('ARTIFACT_READ_FAILED');
    }
    if (!Buffer.isBuffer(bytes)) failDr133('ARTIFACT_BYTES_INVALID');
    if (sha256Bytes(bytes) !== contract.sha256) failDr133('ARTIFACT_HASH_MISMATCH');
    guards.set(stageIndex, Object.freeze({ ...contract, bytes }));
  }
  return guards;
}

const SEMANTIC_POSTCOMMIT_POSTGRES_CODES = new Set(['42501', '55000']);

function postcommitFailureResult(error, rejectedResult, unknownResult) {
  if (error instanceof Dr133RunnerError) return rejectedResult;
  const { postgresCode } = classifySafeFailure(error);
  return SEMANTIC_POSTCOMMIT_POSTGRES_CODES.has(postgresCode)
    ? rejectedResult
    : unknownResult;
}

function resultForFailure({
  stage,
  error,
  transactionRolledBack,
  quarantineKnown,
}) {
  if ([
    'INITIAL',
    'ARTIFACT_VERIFIED',
    'ADMIN_CONNECTED',
    'PREFLIGHT_VERIFIED',
    'LOCKED',
  ].includes(stage)) {
    return quarantineKnown ? 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY' : 'NO_MUTATION';
  }
  if (stage === 'QUARANTINE_TRANSACTION_DISPATCHED') {
    return transactionRolledBack
      ? 'RUNTIME_LOGIN_DEPROVISION_ROLLED_BACK'
      : 'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_OUTCOME_UNKNOWN';
  }
  if (stage === 'QUARANTINE_COMMIT_DISPATCHED') {
    return 'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_OUTCOME_UNKNOWN';
  }
  if (stage === 'QUARANTINE_COMMITTED') {
    return postcommitFailureResult(
      error,
      'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_POSTFLIGHT_REJECTED',
      'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_VERIFICATION_UNKNOWN',
    );
  }
  if (stage === 'QUARANTINED_SESSIONS_ACTIVE') {
    return 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_SESSIONS_ACTIVE';
  }
  if (stage === 'QUARANTINE_VERIFIED') {
    return 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY';
  }
  if (stage === 'DEPROVISION_COMMIT_DISPATCHED') {
    return 'RUNTIME_LOGIN_DEPROVISION_OUTCOME_UNKNOWN';
  }
  if (stage === 'DEPROVISION_TRANSACTION_DISPATCHED') {
    return transactionRolledBack
      ? 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'
      : 'RUNTIME_LOGIN_DEPROVISION_OUTCOME_UNKNOWN';
  }
  if (stage === 'DEPROVISION_COMMITTED') {
    return postcommitFailureResult(
      error,
      'RUNTIME_LOGIN_DEPROVISION_COMMITTED_POSTFLIGHT_REJECTED',
      'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFICATION_UNKNOWN',
    );
  }
  return 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED_CLEANUP_FAILED';
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

export async function deprovisionDr133RailwayProductionRuntimeLogin({
  environment = process.env,
  ClientClass = Client,
  readFileFn = readFile,
  output = process.stdout,
} = {}) {
  let stage = 'INITIAL';
  let primaryError = null;
  let adminClient = null;
  let adminConnected = false;
  let locked = false;
  let transactionStarted = false;
  let transactionRolledBack = false;
  let quarantineKnown = false;
  let rollbackArtifact = null;
  let rollbackGuards = null;
  let guardBodySql = null;
  let guardVerificationSql = null;
  let runtimeDeprovisionGuardStage = null;
  let postgresMajor = null;
  let runtimeRoleOid = null;

  try {
    const resolved = resolveDr133RunnerEnvironment(environment, {
      mode: 'runtime-login-deprovision',
    });
    rollbackGuards = await loadVerifiedRuntimeDeprovisionGuards(readFileFn);
    stage = 'ARTIFACT_VERIFIED';

    adminClient = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-runtime-login-deprovision',
      connectionTimeoutMillis: 15_000,
    });
    await adminClient.connect();
    adminConnected = true;
    stage = 'ADMIN_CONNECTED';

    const preflightResult = await adminClient.query(DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL);
    const preflightState = assertRuntimeDeprovisionPreflightRow(preflightResult.rows?.[0]);
    postgresMajor = preflightResult.rows[0].postgres_major;
    runtimeRoleOid = preflightState.runtimeRoleOid;
    runtimeDeprovisionGuardStage = preflightState.successorStageIndex;
    rollbackArtifact = rollbackGuards.get(runtimeDeprovisionGuardStage);
    if (!rollbackArtifact) failDr133('ARTIFACT_INVENTORY_INVALID');
    const rollbackSource = rollbackArtifact.bytes.toString('utf8');
    if (runtimeDeprovisionGuardStage === 0) {
      guardBodySql = extractRollbackGuardTransactionBodySql(rollbackSource);
      guardVerificationSql = extractRollbackGuardVerificationSql(rollbackSource);
    } else {
      guardBodySql = extractSuccessorRollbackGuardTransactionBodySql(
        rollbackSource,
        rollbackArtifact.id,
      );
      guardVerificationSql = extractSuccessorRollbackGuardVerificationSql(
        rollbackSource,
        rollbackArtifact.id,
      );
    }
    quarantineKnown = preflightState.roleState === 'quarantined';
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await adminClient.query(DR133_RUNTIME_DEPROVISION_ADVISORY_LOCK_SQL);
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
    await adminClient.query(DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL);

    await adminClient.query('BEGIN');
    transactionStarted = true;
    try {
      await adminClient.query("SET LOCAL statement_timeout = '30s'");
      await adminClient.query("SET LOCAL lock_timeout = '5s'");
      const lockedPreflight = await adminClient.query(
        DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
      );
      const lockedState = assertRuntimeDeprovisionPreflightRow(lockedPreflight.rows?.[0]);
      if (lockedState.runtimeRoleOid !== runtimeRoleOid) {
        failDr133('RUNTIME_LOGIN_DEPROVISION_ROLE_OID_CHANGED');
      }
      if (lockedState.successorStageIndex !== runtimeDeprovisionGuardStage) {
        failDr133('RUNTIME_LOGIN_DEPROVISION_SCHEMA_STAGE_CHANGED');
      }
      if (
        lockedState.authenticationTimeoutSeconds
        !== preflightState.authenticationTimeoutSeconds
      ) failDr133('RUNTIME_LOGIN_DEPROVISION_AUTH_TIMEOUT_CHANGED');
      if (lockedState.roleState === 'active') {
        stage = 'QUARANTINE_TRANSACTION_DISPATCHED';
        await adminClient.query(DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL);
        const quarantineResult = await adminClient.query(
          DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
        );
        assertRuntimeDeprovisionQuarantinedRow(
          quarantineResult.rows?.[0],
          runtimeRoleOid,
        );
        stage = 'QUARANTINE_COMMIT_DISPATCHED';
        await adminClient.query('COMMIT');
        transactionStarted = false;
      } else {
        quarantineKnown = true;
        await adminClient.query('ROLLBACK');
        transactionStarted = false;
      }
    } catch (error) {
      if (transactionStarted) {
        try {
          await adminClient.query('ROLLBACK');
          transactionRolledBack = true;
          transactionStarted = false;
        } catch {
          transactionRolledBack = false;
        }
      }
      throw error;
    }
    quarantineKnown = true;
    stage = 'QUARANTINE_COMMITTED';

    const drainWaitResult = await adminClient.query(
      DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_SQL,
      [
        preflightState.authenticationTimeoutSeconds
          + DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_MARGIN_SECONDS,
      ],
    );
    if (drainWaitResult.rows?.[0]?.waited !== true) {
      failDr133('RUNTIME_LOGIN_DEPROVISION_AUTH_DRAIN_WAIT_INVALID');
    }

    const postquarantineResult = await adminClient.query(
      DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
    );
    const postquarantineState = assertRuntimeDeprovisionQuarantinedRow(
      postquarantineResult.rows?.[0],
      runtimeRoleOid,
    );
    if (
      postquarantineState.authenticationTimeoutSeconds
      !== preflightState.authenticationTimeoutSeconds
    ) failDr133('RUNTIME_LOGIN_DEPROVISION_AUTH_TIMEOUT_CHANGED');
    if (postquarantineState.successorStageIndex !== runtimeDeprovisionGuardStage) {
      failDr133('RUNTIME_LOGIN_DEPROVISION_SCHEMA_STAGE_CHANGED');
    }
    if (
      postquarantineState.activeSessionCount !== 0
      || postquarantineState.startingClientBackendCount !== 0
    ) {
      stage = 'QUARANTINED_SESSIONS_ACTIVE';
      failDr133('RUNTIME_LOGIN_DEPROVISION_SESSIONS_ACTIVE');
    }
    await adminClient.query(DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL);
    stage = 'QUARANTINE_VERIFIED';

    transactionRolledBack = false;
    await adminClient.query('BEGIN');
    transactionStarted = true;
    try {
      await adminClient.query("SET LOCAL statement_timeout = '30s'");
      await adminClient.query("SET LOCAL lock_timeout = '5s'");
      await adminClient.query(DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL);
      const drainBarrier = await adminClient.query(
        DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
      );
      const drainBarrierState = assertRuntimeDeprovisionQuarantinedRow(
        drainBarrier.rows?.[0],
        runtimeRoleOid,
        { requireNoSessions: true },
      );
      if (
        drainBarrierState.authenticationTimeoutSeconds
        !== preflightState.authenticationTimeoutSeconds
      ) failDr133('RUNTIME_LOGIN_DEPROVISION_AUTH_TIMEOUT_CHANGED');
      if (drainBarrierState.successorStageIndex !== runtimeDeprovisionGuardStage) {
        failDr133('RUNTIME_LOGIN_DEPROVISION_SCHEMA_STAGE_CHANGED');
      }
      await adminClient.query(DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL);

      stage = 'DEPROVISION_TRANSACTION_DISPATCHED';
      await adminClient.query(DR133_RUNTIME_DEPROVISION_REVOKE_SQL);
      const revokedResult = await adminClient.query(
        DR133_RUNTIME_DEPROVISION_REVOKED_SQL,
        [runtimeRoleOid],
      );
      assertRuntimeDeprovisionRevokedRow(revokedResult.rows?.[0], runtimeRoleOid);
      await adminClient.query(DR133_RUNTIME_DEPROVISION_DROP_SQL);
      await adminClient.query(guardBodySql);
      const absenceResult = await adminClient.query(
        DR133_RUNTIME_DEPROVISION_ABSENCE_SQL,
        [runtimeRoleOid],
      );
      assertRuntimeDeprovisionAbsentRow(absenceResult.rows?.[0], runtimeRoleOid);

      stage = 'DEPROVISION_COMMIT_DISPATCHED';
      await adminClient.query('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try {
          await adminClient.query('ROLLBACK');
          transactionRolledBack = true;
          transactionStarted = false;
        } catch {
          transactionRolledBack = false;
        }
      }
      throw error;
    }
    stage = 'DEPROVISION_COMMITTED';

    const postcommitAbsence = await adminClient.query(
      DR133_RUNTIME_DEPROVISION_ABSENCE_SQL,
      [runtimeRoleOid],
    );
    assertRuntimeDeprovisionAbsentRow(postcommitAbsence.rows?.[0], runtimeRoleOid);
    try {
      await adminClient.query(guardVerificationSql);
    } catch (error) {
      try {
        await adminClient.query('ROLLBACK');
      } catch {
        // The primary verification error determines the no-retry classification.
      }
      throw error;
    }
    stage = 'DEPROVISION_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  if (adminConnected && transactionStarted) {
    try {
      await adminClient.query('ROLLBACK');
      transactionRolledBack = true;
      transactionStarted = false;
    } catch (error) {
      primaryError ??= error;
    }
  }
  if (adminConnected && locked) {
    try {
      const unlockResult = await adminClient.query(
        DR133_RUNTIME_DEPROVISION_ADVISORY_UNLOCK_SQL,
      );
      if (unlockResult.rows?.[0]?.released !== true) failDr133('ADVISORY_UNLOCK_FAILED');
      locked = false;
    } catch (error) {
      primaryError ??= error;
    }
  }
  if (adminConnected) {
    const closeError = await closeClient(adminClient);
    primaryError ??= closeError;
    adminConnected = false;
  }

  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeDr133Receipt(output, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'runtime-login-deprovision',
      result: resultForFailure({
        stage,
        error: primaryError,
        transactionRolledBack,
        quarantineKnown,
      }),
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      ...(rollbackArtifact && runtimeDeprovisionGuardStage !== null
        ? {
          runtimeDeprovisionGuardRollbackSha256: rollbackArtifact.sha256,
          runtimeDeprovisionGuardStage,
        }
        : {}),
      ...(postgresMajor === null ? {} : { postgresMajor }),
    });
    failDr133(
      safeFailure.postgresCode
        ? `POSTGRES_${safeFailure.postgresCode}`
        : safeFailure.runnerCode,
    );
  }

  writeDr133Receipt(output, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'runtime-login-deprovision',
    result: 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
    runtimeDeprovisionGuardRollbackSha256: rollbackArtifact.sha256,
    runtimeDeprovisionGuardStage,
    postgresMajor,
  });
  return Object.freeze({
    result: 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
  });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  deprovisionDr133RailwayProductionRuntimeLogin().catch(() => {
    process.exitCode = 1;
  });
}
