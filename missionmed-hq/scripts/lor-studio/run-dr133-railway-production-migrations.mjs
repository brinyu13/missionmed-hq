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
  DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_STAGES,
  DR133_TARGET,
  Dr133RunnerError,
  assertFoundationSentinelRow,
  assertPostflightRow,
  assertSuccessorSchemaPreflightRow,
  buildNonemptyRelationsSql,
  classifySafeFailure,
  extractRollbackGuardVerificationSql,
  extractSuccessorRollbackGuardVerificationSql,
  failDr133,
  postgresOutcomeIsUnknown,
  resolveDr133RunnerEnvironment,
  sha256Bytes,
  targetGucEntries,
  writeDr133Receipt,
  expectedDr133SuccessorSentinelAt,
} from './railway-dr133-production-runner-core.mjs';

const { Client } = pg;

export const DR133_PREFLIGHT_SQL = `
/* missionmed:dr133:production-preflight */
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
    'missionmed:F2-LOR-1012:DR-133:576520f5-a702-4343-a277-decdeeed57f6:database-mutation',
    0
  )
) AS acquired
`;

export const DR133_SUCCESSOR_PREFLIGHT_SQL = `
/* missionmed:dr133:production-successor-preflight */
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
  ) AS runtime_login_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname LIKE 'lor\\_studio\\_%' ESCAPE '\\'
  ) AS lor_role_count,
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
  ) AS runtime_membership_safe,
  (SELECT pg_catalog.count(*)::text FROM runtime_memberships) AS runtime_membership_count,
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

export const DR133_ADVISORY_UNLOCK_SQL = `
SELECT pg_catalog.pg_advisory_unlock(
  pg_catalog.hashtextextended(
    'missionmed:F2-LOR-1012:DR-133:576520f5-a702-4343-a277-decdeeed57f6:database-mutation',
    0
  )
) AS released
`;

export const DR133_FOUNDATION_SENTINEL_SQL = `
SELECT pg_catalog.obj_description(namespace.oid, 'pg_namespace') AS schema_sentinel
FROM pg_catalog.pg_namespace AS namespace
WHERE namespace.nspname = 'lor_studio'
`;

export function classifyDr133ProductionSchemaCursor(row) {
  if (!row || typeof row !== 'object'
    || row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || typeof row.ssl_version !== 'string'
    || row.ssl_version.length === 0
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length === 0
    || !['0', '1'].includes(row.runtime_login_count)) {
    failDr133('PRODUCTION_SCHEMA_CURSOR_INVALID');
  }
  if (row.schema_count === '0'
    && row.schema_sentinel === null
    && row.schema_owner === null
    && row.app_role_count === '0'
    && row.command_owner_count === '0'
    && row.lor_role_count === '0') {
    return Object.freeze({ state: 'absent', successorStageIndex: -1 });
  }
  if (row.schema_count !== '1'
    || row.schema_owner !== DR133_TARGET.databaseAdmin
    || row.app_role_count !== '1') {
    failDr133('PRODUCTION_SCHEMA_CURSOR_INVALID');
  }
  if (row.schema_sentinel === expectedDr133SuccessorSentinelAt(0)
    && row.command_owner_count === '0'
    && row.lor_role_count === '1') {
    return Object.freeze({ state: 'foundation', successorStageIndex: -1 });
  }
  const runtimeLoginActive = row.runtime_login_count === '1';
  if (row.command_owner_count !== '1'
    || row.lor_role_count !== (runtimeLoginActive ? '3' : '2')
    || (runtimeLoginActive && (
      row.runtime_role_active_safe !== true
      || row.runtime_membership_safe !== true
      || row.runtime_membership_count !== '1'
      || row.runtime_owned_object_count !== '0'
      || row.runtime_default_acl_count !== '0'
      || row.runtime_unsafe_dependency_count !== '0'
    ))) {
    failDr133('PRODUCTION_SCHEMA_CURSOR_INVALID');
  }
  const successorStageIndex = Array.from(
    { length: DR133_SUCCESSOR_STAGES.length + 1 },
    (_, index) => index,
  ).find((index) => row.schema_sentinel === expectedDr133SuccessorSentinelAt(index));
  if (successorStageIndex === undefined) failDr133('PRODUCTION_SCHEMA_CURSOR_INVALID');
  return Object.freeze({ state: 'committed', successorStageIndex, runtimeLoginActive });
}

function productionSchemaCursorRank(cursor) {
  if (cursor.state === 'absent') return 0;
  if (cursor.state === 'foundation') return 1;
  if (cursor.state === 'committed') return cursor.successorStageIndex + 2;
  failDr133('PRODUCTION_SCHEMA_CURSOR_INVALID');
}

export const DR133_POSTFLIGHT_CATALOG_SQL = `
/* missionmed:dr133:production-postflight-catalog */
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
      pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ',') || ')'
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
  SELECT
    procedure.proname || '(' ||
      pg_catalog.replace(pg_catalog.oidvectortypes(procedure.proargtypes), ', ', ',') || ')'
      AS function_identity
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
    SELECT COALESCE(
      pg_catalog.array_agg(function_identity ORDER BY function_identity COLLATE "C"),
      ARRAY[]::text[]
    )
    FROM definer_inventory
    WHERE pg_catalog.has_function_privilege(
      'lor_studio_app', function_oid, 'EXECUTE'
    )
  ) AS app_execute_identities,
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
  (
    SELECT pg_catalog.count(*) = 1
      AND COALESCE(pg_catalog.bool_and(NOT pg_catalog.has_function_privilege(
        'lor_studio_app', function_oid, 'EXECUTE'
      )), false)
    FROM definer_inventory
    WHERE function_identity = '${DR133_PRE_EVIDENCE_DEFINER_IDENTITY}'
  ) AS pre_evidence_app_execute_denied,
  (
    SELECT pg_catalog.count(*) = 0
    FROM public_function_acl
    WHERE function_identity = '${DR133_PRE_EVIDENCE_DEFINER_IDENTITY}'
  ) AS pre_evidence_public_execute_denied,
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

function artifactReceiptHashes() {
  const hash = (id) => DR133_ARTIFACTS.find((artifact) => artifact.id === id)?.sha256;
  const receipt = {
    foundationSha256: hash('foundation'),
    rlsSha256: hash('rls'),
    identityScopeSha256: hash('identity-scope'),
    identityScopeRollbackSha256: hash('identity-scope-rollback'),
    facultyInvitationSha256: hash('faculty-invitation'),
    facultyInvitationRollbackSha256: hash('faculty-invitation-rollback'),
    facultyPrivateExportSha256: hash('faculty-private-export'),
    facultyPrivateExportRollbackSha256: hash('faculty-private-export-rollback'),
    aiProposalSha256: hash('ai-proposal'),
    aiProposalRollbackSha256: hash('ai-proposal-rollback'),
    studentEvidenceSha256: hash('student-evidence'),
    studentEvidenceRollbackSha256: hash('student-evidence-rollback'),
    encryptedPrivateStorageSha256: hash('encrypted-private-storage'),
    encryptedPrivateStorageRollbackSha256: hash('encrypted-private-storage-rollback'),
    facultyCandidateAuthHandoffSha256: hash('faculty-candidate-auth-handoff'),
    facultyCandidateAuthHandoffRollbackSha256:
      hash('faculty-candidate-auth-handoff-rollback'),
    mentorAssignmentSha256: hash('mentor-assignment'),
    mentorAssignmentRollbackSha256: hash('mentor-assignment-rollback'),
    privateStorageObjectIdRegexSha256: hash('private-storage-object-id-regex'),
    privateStorageObjectIdRegexRollbackSha256:
      hash('private-storage-object-id-regex-rollback'),
    facultyScopeDurableVerificationSha256:
      hash('faculty-scope-durable-verification'),
    facultyScopeDurableVerificationRollbackSha256:
      hash('faculty-scope-durable-verification-rollback'),
  };
  if (Object.values(receipt).some((value) => typeof value !== 'string')) {
    failDr133('ARTIFACT_INVENTORY_INVALID');
  }
  return Object.freeze(receipt);
}

function successorGuardSqlByStage(artifacts) {
  return new Map(DR133_SUCCESSOR_STAGES.map((successor) => {
    const source = artifactById(artifacts, successor.rollbackId).bytes.toString('utf8');
    return [
      successor.id,
      extractSuccessorRollbackGuardVerificationSql(source, successor.rollbackId),
    ];
  }));
}

async function applySuccessorStages({ client, artifacts, guards, startIndex, setStage }) {
  for (let index = startIndex; index < DR133_SUCCESSOR_STAGES.length; index += 1) {
    const successor = DR133_SUCCESSOR_STAGES[index];
    const stageName = successor.id.replaceAll('-', '_').toUpperCase();
    setStage(`${stageName}_DISPATCHED`);
    await client.query(artifactById(artifacts, successor.id).bytes.toString('utf8'));
    setStage(`${stageName}_RETURNED`);
    setStage(`${stageName}_GUARD_DISPATCHED`);
    await client.query(guards.get(successor.id));
    setStage(`${stageName}_GUARD_VERIFIED`);
  }
}

function successorStageName(successorId) {
  return successorId.replaceAll('-', '_').toUpperCase();
}

function isSuccessorForwardDispatchStage(stage) {
  return DR133_SUCCESSOR_STAGES.some((successor) => (
    stage === `${successorStageName(successor.id)}_DISPATCHED`
  ));
}

function isSuccessorCommittedStage(stage) {
  return DR133_SUCCESSOR_STAGES.some((successor) => {
    const prefix = successorStageName(successor.id);
    return [
      `${prefix}_RETURNED`,
      `${prefix}_GUARD_DISPATCHED`,
      `${prefix}_GUARD_VERIFIED`,
    ].includes(stage);
  });
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
  if (isSuccessorForwardDispatchStage(stage)) {
    return postgresOutcomeIsUnknown(error)
      ? 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN'
      : 'SUCCESSOR_PROGRESS_PRESERVED';
  }
  if (
    isSuccessorCommittedStage(stage)
    || [
    'POSTFLIGHT_DISPATCHED',
    'POSTFLIGHT_RETURNED',
    ].includes(stage)
  ) {
    const { postgresCode } = classifySafeFailure(error);
    return error instanceof Dr133RunnerError || ['42501', '55000'].includes(postgresCode)
      ? 'CUMULATIVE_SCHEMA_COMMITTED_POSTFLIGHT_REJECTED'
      : 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN';
  }
  if (stage === 'POSTFLIGHT_VERIFIED') {
    return 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED_CLEANUP_FAILED';
  }
  return 'CUMULATIVE_SCHEMA_COMMITTED_POSTFLIGHT_REJECTED';
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

export async function runDr133ProductionMigration({
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
  let preflightCursor = null;
  const state = { connected: false, locked: false };
  let artifacts;

  try {
    const resolved = resolveDr133RunnerEnvironment(environment, { mode: 'migration' });
    artifacts = await loadVerifiedArtifacts(readFileFn);
    stage = 'ARTIFACTS_VERIFIED';

    const rlsRollbackSource = artifactById(artifacts, 'rls-rollback').bytes.toString('utf8');
    const baseGuardVerificationSql = extractRollbackGuardVerificationSql(rlsRollbackSource);
    const successorGuards = successorGuardSqlByStage(artifacts);

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-production-migration',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflightResult = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    preflightRow = preflightResult.rows?.[0];
    preflightCursor = classifyDr133ProductionSchemaCursor(preflightRow);
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflightResult = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    const lockedCursor = classifyDr133ProductionSchemaCursor(
      lockedPreflightResult.rows?.[0],
    );
    if (productionSchemaCursorRank(lockedCursor) < productionSchemaCursorRank(preflightCursor)) {
      failDr133('PRODUCTION_SCHEMA_STATE_REGRESSED');
    }
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

    let successorStartIndex;
    if (lockedCursor.state === 'absent') {
      stage = 'FOUNDATION_DISPATCHED';
      await client.query(artifactById(artifacts, 'foundation').bytes.toString('utf8'));
      stage = 'FOUNDATION_RETURNED';

      const sentinelResult = await client.query(DR133_FOUNDATION_SENTINEL_SQL);
      assertFoundationSentinelRow(sentinelResult.rows?.[0]);
    }
    if (['absent', 'foundation'].includes(lockedCursor.state)) {
      stage = 'RLS_DISPATCHED';
      await client.query(artifactById(artifacts, 'rls').bytes.toString('utf8'));
      stage = 'RLS_RETURNED';

      stage = 'BASE_GUARD_DISPATCHED';
      await client.query(baseGuardVerificationSql);
      stage = 'BASE_GUARD_VERIFIED';
      successorStartIndex = 0;
    } else {
      successorStartIndex = lockedCursor.successorStageIndex;
      if (successorStartIndex === 0) {
        stage = 'BASE_GUARD_DISPATCHED';
        await client.query(baseGuardVerificationSql);
        stage = 'BASE_GUARD_VERIFIED';
      } else {
        const committedSuccessor = DR133_SUCCESSOR_STAGES[successorStartIndex - 1];
        const committedStageName = successorStageName(committedSuccessor.id);
        stage = `${committedStageName}_GUARD_DISPATCHED`;
        await client.query(successorGuards.get(committedSuccessor.id));
        stage = `${committedStageName}_GUARD_VERIFIED`;
      }
    }

    await applySuccessorStages({
      client,
      artifacts,
      guards: successorGuards,
      startIndex: successorStartIndex,
      setStage(value) { stage = value; },
    });
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

  const receiptHashes = artifactReceiptHashes();
  if (primaryError) {
    const safeFailure = classifySafeFailure(primaryError);
    writeDr133Receipt(output, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'migration',
      result: resultForFailure(stage, primaryError),
      runnerCode: safeFailure.runnerCode,
      postgresCode: safeFailure.postgresCode,
      ...receiptHashes,
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
    result: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED',
    postgresMajor: preflightRow.postgres_major,
    relationCount: Number(postflightRow.relation_count),
    definerCount: Number(postflightRow.definer_count),
    ...receiptHashes,
  });
  return Object.freeze({ result: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED' });
}

function successorSchemaCursor(row) {
  let cursor;
  try {
    cursor = classifyDr133ProductionSchemaCursor(row);
  } catch {
    failDr133('SUCCESSOR_MIGRATION_PREFLIGHT_TARGET_INVALID');
  }
  if (cursor.state !== 'committed') {
    failDr133('SUCCESSOR_MIGRATION_PREFLIGHT_TARGET_INVALID');
  }
  return cursor;
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
  if (mutationDispatched && isSuccessorForwardDispatchStage(stage)) {
    return postgresOutcomeIsUnknown(error)
      ? 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN'
      : 'SUCCESSOR_NEXT_STEP_ROLLED_BACK';
  }
  if (
    isSuccessorCommittedStage(stage)
    || ['POSTFLIGHT_DISPATCHED', 'POSTFLIGHT_RETURNED'].includes(stage)
  ) {
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

export async function runDr133ProductionSuccessorMigration({
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
    const successorGuards = successorGuardSqlByStage(artifacts);

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-production-successor-migration',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflightResult = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    preflightRow = preflightResult.rows?.[0];
    const preflightCursor = successorSchemaCursor(preflightRow);
    const preflightStageIndex = preflightCursor.successorStageIndex;
    stage = 'BASE_PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflight = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    const lockedCursor = successorSchemaCursor(lockedPreflight.rows?.[0]);
    const lockedStageIndex = lockedCursor.successorStageIndex;
    if (lockedStageIndex < preflightStageIndex) {
      failDr133('SUCCESSOR_SCHEMA_STATE_REGRESSED');
    }
    if (lockedCursor.runtimeLoginActive !== preflightCursor.runtimeLoginActive) {
      failDr133('SUCCESSOR_RUNTIME_LOGIN_STATE_CHANGED');
    }
    alreadyCommitted = lockedStageIndex === DR133_SUCCESSOR_STAGES.length;
    const liveDataUpgrade = lockedCursor.runtimeLoginActive;
    if (liveDataUpgrade && !alreadyCommitted) {
      const remainingStages = DR133_SUCCESSOR_STAGES.slice(lockedStageIndex);
      if (remainingStages.length !== 1 || remainingStages[0].liveDataSafe !== true) {
        failDr133('SUCCESSOR_LIVE_DATA_STAGE_NOT_APPROVED');
      }
    }
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

    let preMutationNonemptyCount = '0';
    if (liveDataUpgrade) {
      const preMutationNonempty = await client.query(buildNonemptyRelationsSql());
      preMutationNonemptyCount = preMutationNonempty.rows?.[0]?.nonempty_relation_count;
      if (!/^(?:0|[1-9][0-9]{0,9})$/u.test(preMutationNonemptyCount ?? '')) {
        failDr133('SUCCESSOR_DATA_CUSTODY_PREFLIGHT_INVALID');
      }
    }

    if (!alreadyCommitted) {
      if (lockedStageIndex === 0) {
        stage = 'BASE_GUARD_DISPATCHED';
        await client.query(baseGuardVerificationSql);
        stage = 'BASE_GUARD_VERIFIED';
      }
      mutationDispatched = true;
      await applySuccessorStages({
        client,
        artifacts,
        guards: successorGuards,
        startIndex: lockedStageIndex,
        setStage(value) { stage = value; },
      });
    } else {
      const finalSuccessor = DR133_SUCCESSOR_STAGES.at(-1);
      stage = `${successorStageName(finalSuccessor.id)}_GUARD_DISPATCHED`;
      await client.query(successorGuards.get(finalSuccessor.id));
      stage = `${successorStageName(finalSuccessor.id)}_GUARD_VERIFIED`;
    }
    stage = 'POSTFLIGHT_DISPATCHED';
    const catalogResult = await client.query(DR133_POSTFLIGHT_CATALOG_SQL);
    const nonemptyResult = await client.query(buildNonemptyRelationsSql());
    stage = 'POSTFLIGHT_RETURNED';
    postflightRow = {
      ...catalogResult.rows?.[0],
      ...nonemptyResult.rows?.[0],
    };
    assertPostflightRow(postflightRow, { allowNonempty: liveDataUpgrade });
    if (postflightRow.nonempty_relation_count !== preMutationNonemptyCount) {
      failDr133('SUCCESSOR_DATA_CUSTODY_CHANGED');
    }
    stage = 'POSTFLIGHT_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  const cleanupError = await closeClientFailClosed(client, state);
  primaryError ??= cleanupError;

  const receiptHashes = artifactReceiptHashes();
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
      ...receiptHashes,
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
    ...receiptHashes,
  });
  return Object.freeze({ result: successResult });
}

export async function verifyDr133ProductionSuccessorSchema({
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
    const finalSuccessor = DR133_SUCCESSOR_STAGES.at(-1);
    const successorRollbackSource = artifactById(
      artifacts,
      finalSuccessor.rollbackId,
    ).bytes.toString('utf8');
    const successorGuardVerificationSql = extractSuccessorRollbackGuardVerificationSql(
      successorRollbackSource,
      finalSuccessor.rollbackId,
    );

    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-production-schema-verifier',
      connectionTimeoutMillis: 15_000,
    });
    await client.connect();
    state.connected = true;
    stage = 'CONNECTED';

    const preflightResult = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    preflightRow = preflightResult.rows?.[0];
    const preflightState = assertSuccessorSchemaPreflightRow(preflightRow);
    stage = 'PREFLIGHT_VERIFIED';

    const lockResult = await client.query(DR133_ADVISORY_LOCK_SQL);
    if (lockResult.rows?.[0]?.acquired !== true) failDr133('ADVISORY_LOCK_UNAVAILABLE');
    state.locked = true;
    stage = 'LOCKED';

    const lockedPreflight = await client.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
    const lockedState = assertSuccessorSchemaPreflightRow(lockedPreflight.rows?.[0]);
    if (lockedState.runtimeLoginActive !== preflightState.runtimeLoginActive) {
      failDr133('SUCCESSOR_RUNTIME_LOGIN_STATE_CHANGED');
    }
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
    assertPostflightRow(postflightRow, {
      allowNonempty: lockedState.runtimeLoginActive,
    });
    stage = 'POSTFLIGHT_VERIFIED';
  } catch (error) {
    primaryError = error;
  }

  const cleanupError = await closeClientFailClosed(client, state);
  primaryError ??= cleanupError;

  const receiptHashes = artifactReceiptHashes();
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
      ...receiptHashes,
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
    ...receiptHashes,
  });
  return Object.freeze({ result: 'SCHEMA_VERIFIED_NO_MUTATION' });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const configuredOperation = process.env.LOR_DR133_MODE === 'migration'
    ? runDr133ProductionMigration
    : process.env.LOR_DR133_MODE === 'successor-migration'
      ? runDr133ProductionSuccessorMigration
    : process.env.LOR_DR133_MODE === 'schema-verifier'
      ? verifyDr133ProductionSuccessorSchema
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
