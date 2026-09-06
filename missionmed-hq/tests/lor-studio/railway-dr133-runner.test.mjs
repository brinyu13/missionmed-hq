import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { access, appendFile, chmod, readFile } from 'node:fs/promises';
import { connect as connectNet } from 'node:net';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { connect as connectTls, rootCertificates } from 'node:tls';
import { promisify } from 'node:util';

import pg from 'pg';

import {
  DR133_APPLICATION_ROLE,
  DR133_APPROVED_DEFINER_IDENTITIES,
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_RUNNER_CONTRACT,
  DR133_RUNTIME_LOGIN,
  DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_STAGES,
  DR133_TARGET,
  Dr133RunnerError,
  assertBaseSchemaPreflightRow,
  assertPostflightRow,
  assertPreflightRow,
  assertRuntimeAdminRow,
  assertRuntimeDeprovisionAbsentRow,
  assertRuntimeDeprovisionPreflightRow,
  assertRuntimeDeprovisionQuarantinedRow,
  assertRuntimeDeprovisionRevokedRow,
  buildNonemptyRelationsSql,
  expectedDr133Sentinel,
  expectedDr133SuccessorSentinel,
  expectedDr133SuccessorSentinelAt,
  extractIdentityScopeRollbackGuardTransactionBodySql,
  extractIdentityScopeRollbackGuardVerificationSql,
  extractRollbackGuardTransactionBodySql,
  extractRollbackGuardVerificationSql,
  extractSuccessorRollbackGuardTransactionBodySql,
  extractSuccessorRollbackGuardVerificationSql,
  parsePrivateDatabaseUrl,
  resolveDr133RunnerEnvironment,
  sha256Bytes,
  targetGucEntries,
  writeDr133Receipt,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';
import {
  DR133_ADVISORY_LOCK_SQL,
  DR133_ADVISORY_UNLOCK_SQL,
  DR133_FOUNDATION_SENTINEL_SQL,
  DR133_POSTFLIGHT_CATALOG_SQL,
  DR133_PREFLIGHT_SQL,
  DR133_SUCCESSOR_PREFLIGHT_SQL,
  runDr133StagingMigration,
  runDr133StagingSuccessorMigration,
  verifyDr133StagingSuccessorSchema,
} from '../../scripts/lor-studio/run-dr133-railway-staging-migrations.mjs';
import {
  DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL,
  DR133_RUNTIME_ADMIN_PREFLIGHT_SQL,
  DR133_RUNTIME_ADVISORY_LOCK_SQL,
  DR133_RUNTIME_ADVISORY_UNLOCK_SQL,
  DR133_RUNTIME_CREATE_ROLE_SQL,
  DR133_RUNTIME_FORBIDDEN_DELETE_SQL,
  DR133_RUNTIME_IDENTITY_SQL,
  DR133_RUNTIME_ROLE_HARDENING_SQL,
  DR133_RUNTIME_SET_ROLE_SQL,
  provisionDr133RailwayStagingRuntimeLogin,
} from '../../scripts/lor-studio/provision-dr133-railway-staging-runtime-login.mjs';
import {
  DR133_RUNTIME_DEPROVISION_ABSENCE_SQL,
  DR133_RUNTIME_DEPROVISION_ADVISORY_LOCK_SQL,
  DR133_RUNTIME_DEPROVISION_ADVISORY_UNLOCK_SQL,
  DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_MARGIN_SECONDS,
  DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_SQL,
  DR133_RUNTIME_DEPROVISION_DROP_SQL,
  DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
  DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL,
  DR133_RUNTIME_DEPROVISION_REVOKED_SQL,
  DR133_RUNTIME_DEPROVISION_REVOKE_SQL,
  deprovisionDr133RailwayStagingRuntimeLogin,
} from '../../scripts/lor-studio/deprovision-dr133-railway-staging-runtime-login.mjs';
import {
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const ADMIN_PASSWORD = 'a'.repeat(48);
const RUNTIME_PASSWORD = 'b'.repeat(48);
const DEPLOYMENT_ID = '11111111-1111-4111-8111-111111111111';
const RUNTIME_ROLE_OID = '42042';
const TEST_CA_SOURCE = rootCertificates.find((candidate) => {
  try {
    const certificate = new X509Certificate(candidate);
    const now = Date.now();
    return certificate.ca === true && certificate.checkIssued(certificate)
      && certificate.verify(certificate.publicKey)
      && Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo);
  } catch {
    return false;
  }
});
if (!TEST_CA_SOURCE) throw new Error('Node runtime has no valid self-signed test root CA');
const TEST_CA = new X509Certificate(TEST_CA_SOURCE).toString();
const { Client: RealPgClient } = pg;
const execFile = promisify(execFileCallback);
const RUN_REAL_POSTGRES_MATRIX = process.env.LOR_RUN_REAL_POSTGRES_MATRIX === '1';
const POSTGRES_TOOLCHAINS = Object.freeze([
  Object.freeze({ major: 16, root: '/opt/homebrew/opt/postgresql@16/bin' }),
  Object.freeze({ major: 18, root: '/opt/homebrew/opt/postgresql@18/bin' }),
]);

function privateUrl(user, password) {
  return `postgresql://${user}:${password}@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`;
}

function environment(mode = 'migration', overrides = {}) {
  return {
    LOR_DR133_ADMIN_DATABASE_URL: privateUrl('postgres', ADMIN_PASSWORD),
    LOR_DR133_RUNTIME_DATABASE_CA: TEST_CA,
    LOR_DR133_MODE: mode,
    RAILWAY_DEPLOYMENT_ID: DEPLOYMENT_ID,
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_REPLICA_REGION: DR133_TARGET.region,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
    ...(mode === 'runtime-login'
      ? { LOR_DR133_RUNTIME_DATABASE_URL: privateUrl(DR133_RUNTIME_LOGIN, RUNTIME_PASSWORD) }
      : {}),
    ...overrides,
  };
}

function assertPinnedTls(options) {
  assert.equal(options.enableChannelBinding, true);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.minVersion, 'TLSv1.2');
  assert.equal(new X509Certificate(options.ssl.ca).fingerprint256.length > 0, true);
}

function captureStream() {
  let value = '';
  return {
    stream: {
      write(fragment) {
        value += fragment;
      },
    },
    value: () => value,
  };
}

function artifactHash(id) {
  const artifact = DR133_ARTIFACTS.find((candidate) => candidate.id === id);
  assert.ok(artifact, id);
  return artifact.sha256;
}

function artifactReceiptHashes() {
  return {
    foundationSha256: artifactHash('foundation'),
    rlsSha256: artifactHash('rls'),
    identityScopeSha256: artifactHash('identity-scope'),
    identityScopeRollbackSha256: artifactHash('identity-scope-rollback'),
    facultyInvitationSha256: artifactHash('faculty-invitation'),
    facultyInvitationRollbackSha256: artifactHash('faculty-invitation-rollback'),
    facultyPrivateExportSha256: artifactHash('faculty-private-export'),
    facultyPrivateExportRollbackSha256: artifactHash('faculty-private-export-rollback'),
    aiProposalSha256: artifactHash('ai-proposal'),
    aiProposalRollbackSha256: artifactHash('ai-proposal-rollback'),
    studentEvidenceSha256: artifactHash('student-evidence'),
    studentEvidenceRollbackSha256: artifactHash('student-evidence-rollback'),
  };
}

function runnerError(code) {
  return (error) => error instanceof Dr133RunnerError && error.code === code;
}

function preflightRow() {
  return {
    database_name: 'railway',
    current_user: 'postgres',
    session_user: 'postgres',
    database_owner: 'postgres',
    postgres_major: 18,
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
    schema_count: '0',
    app_role_count: '0',
    command_owner_count: '0',
    runtime_login_count: '0',
  };
}

function postflightRow(overrides = {}) {
  return {
    schema_sentinel: expectedDr133SuccessorSentinel(),
    schema_owner: 'postgres',
    relation_names: [...DR133_RELATIONS].sort(),
    relation_count: String(DR133_RELATIONS.length),
    forced_rls_count: String(DR133_RELATIONS.length),
    definer_identities: [...DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES].sort(),
    definer_count: String(DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length),
    definer_custody_safe: true,
    app_execute_identities: [
      ...DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
    ].sort(),
    app_execute_count: String(DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES.length),
    pre_evidence_app_execute_denied: true,
    pre_evidence_public_execute_denied: true,
    public_function_execute_count: '0',
    public_table_privilege_count: '0',
    nonempty_relation_count: '0',
    view_count: '1',
    view_identity: 'student_recommendation_case_projection@postgres',
    app_role_safe: true,
    command_owner_safe: true,
    nologin_role_membership_count: '0',
    ...overrides,
  };
}

function runtimeAdminPreflightRow(overrides = {}) {
  return {
    database_name: 'railway',
    current_user: 'postgres',
    session_user: 'postgres',
    database_owner: 'postgres',
    postgres_major: 18,
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
    schema_sentinel: expectedDr133SuccessorSentinel(),
    schema_owner: 'postgres',
    schema_count: '1',
    app_role_count: '1',
    command_owner_count: '1',
    runtime_login_count: '0',
    ...overrides,
  };
}

function runtimeIdentityRow() {
  return {
    database_name: 'railway',
    current_user: DR133_RUNTIME_LOGIN,
    session_user: DR133_RUNTIME_LOGIN,
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
  };
}

function runtimeDeprovisionPreflightRow(overrides = {}) {
  return {
    database_name: 'railway',
    current_user: 'postgres',
    session_user: 'postgres',
    database_owner: 'postgres',
    postgres_major: 18,
    authentication_timeout_seconds: '1',
    pre_auth_delay_seconds: '0',
    post_auth_delay_seconds: '0',
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
    schema_sentinel: expectedDr133SuccessorSentinel(),
    app_role_count: '1',
    command_owner_count: '1',
    runtime_login_count: '1',
    runtime_role_oid: RUNTIME_ROLE_OID,
    runtime_role_active_safe: true,
    runtime_role_quarantined_safe: false,
    membership_safe: true,
    membership_count: '1',
    runtime_active_session_count: '0',
    starting_unauthenticated_client_backend_count: '0',
    runtime_owned_object_count: '0',
    runtime_default_acl_count: '0',
    runtime_unsafe_dependency_count: '0',
    ...overrides,
  };
}

function runtimeDeprovisionRevokedRow(overrides = {}) {
  return {
    checked_runtime_oid: RUNTIME_ROLE_OID,
    runtime_name_count: '1',
    runtime_oid_count: '1',
    membership_count: '0',
    runtime_active_session_count: '0',
    starting_unauthenticated_client_backend_count: '0',
    runtime_owned_object_count: '0',
    runtime_default_acl_count: '0',
    runtime_unsafe_dependency_count: '0',
    ...overrides,
  };
}

function runtimeDeprovisionAbsentRow(overrides = {}) {
  return {
    checked_runtime_oid: RUNTIME_ROLE_OID,
    runtime_name_count: '0',
    runtime_oid_count: '0',
    membership_count: '0',
    runtime_active_session_count: '0',
    starting_unauthenticated_client_backend_count: '0',
    runtime_owned_object_count: '0',
    runtime_default_acl_count: '0',
    runtime_unsafe_dependency_count: '0',
    ...overrides,
  };
}

function sqlText(input) {
  return typeof input === 'string' ? input : input?.text;
}

function syntheticPgError(code) {
  const error = new Error('synthetic database failure');
  error.code = code;
  return error;
}

test('binds exact forward and rollback artifacts and extracts only the rollback guard', async () => {
  assert.deepEqual(DR133_ARTIFACTS.map((artifact) => artifact.id), [
    'foundation',
    'rls',
    'foundation-rollback',
    'rls-rollback',
    'identity-scope',
    'identity-scope-rollback',
    'faculty-invitation',
    'faculty-invitation-rollback',
    'faculty-private-export',
    'faculty-private-export-rollback',
    'ai-proposal',
    'ai-proposal-rollback',
    'student-evidence',
    'student-evidence-rollback',
  ]);
  for (const artifact of DR133_ARTIFACTS) {
    const bytes = await readFile(
      new URL(`../../scripts/lor-studio/${artifact.relativePath}`, import.meta.url),
    );
    assert.equal(sha256Bytes(bytes), artifact.sha256, artifact.id);
    if (artifact.id === 'rls-rollback') {
      const source = bytes.toString('utf8');
      const guard = extractRollbackGuardVerificationSql(source);
      const guardBody = extractRollbackGuardTransactionBodySql(source);
      assert.match(guard, /^-- Rollback:/u);
      assert.match(guard, /LOCK TABLE/u);
      assert.match(guard, /\$catalog_guard\$;/u);
      assert.match(guard, /ROLLBACK;\n$/u);
      assert.doesNotMatch(
        guard,
        /REVOKE EXECUTE ON FUNCTION lor_studio\.commit_student_case_create/u,
      );
      assert.doesNotMatch(guard, /DROP POLICY/u);
      assert.match(guardBody, /^DO \$identity_guard\$/u);
      assert.match(guardBody, /LOCK TABLE/u);
      assert.match(guardBody, /\$catalog_guard\$;\n$/u);
      assert.doesNotMatch(guardBody, /\bBEGIN;\s*$/u);
      assert.doesNotMatch(guardBody, /\bROLLBACK;/u);
      assert.doesNotMatch(guardBody, /DROP POLICY/u);
    }
    if (artifact.id === 'identity-scope-rollback') {
      const source = bytes.toString('utf8');
      const guard = extractIdentityScopeRollbackGuardVerificationSql(source);
      const guardBody = extractIdentityScopeRollbackGuardTransactionBodySql(source);
      assert.match(guard, /^-- Rollback:/u);
      assert.match(guard, /\$semantic_catalog_guard\$;/u);
      assert.match(guard, /\$catalog_guard\$;/u);
      assert.match(guard, /ROLLBACK;\n$/u);
      assert.doesNotMatch(guard, /REVOKE EXECUTE ON FUNCTION lor_studio\.ensure_student/u);
      assert.doesNotMatch(guard, /DROP POLICY/u);
      assert.match(guardBody, /^DO \$identity_guard\$/u);
      assert.match(guardBody, /\$semantic_catalog_guard\$;/u);
      assert.match(guardBody, /\$catalog_guard\$;\n$/u);
      assert.doesNotMatch(guardBody, /REVOKE EXECUTE/u);
      assert.doesNotMatch(guardBody, /DROP FUNCTION/u);
    }
    if (DR133_SUCCESSOR_STAGES.some((stage) => stage.rollbackId === artifact.id)) {
      const source = bytes.toString('utf8');
      const guard = extractSuccessorRollbackGuardVerificationSql(source, artifact.id);
      const guardBody = extractSuccessorRollbackGuardTransactionBodySql(source, artifact.id);
      assert.match(guard, /^-- Rollback:/u);
      assert.match(guard, /ROLLBACK;\n$/u);
      assert.match(guardBody, /^DO \$identity_guard\$/u);
      assert.doesNotMatch(guardBody, /\nREVOKE EXECUTE ON FUNCTION/u);
      assert.doesNotMatch(guardBody, /\nDROP (?:FUNCTION|POLICY|TABLE)/u);
    }
  }
});

test('private database URL parser requires exact private TLS target and clean decoded fields', () => {
  const valid = privateUrl('postgres', ADMIN_PASSWORD);
  const parsed = parsePrivateDatabaseUrl(valid, 'postgres');
  assert.doesNotMatch(parsed.pgConnectionString, /sslmode/u);
  const resolved = resolveDr133RunnerEnvironment(environment(), { mode: 'migration' });
  const effectiveClient = new RealPgClient({
    connectionString: resolved.adminPgConnectionString,
    ssl: { ca: resolved.databaseCa, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    enableChannelBinding: true,
  });
  assert.equal(effectiveClient.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(effectiveClient.connectionParameters.ssl.minVersion, 'TLSv1.2');
  for (const invalid of [
    valid.replace('?sslmode=require', ''),
    `${valid}&sslmode=require`,
    valid.replace('postgres.railway.internal', 'public.proxy.example'),
    valid.replace('/railway', '/wrong'),
    valid.replace(ADMIN_PASSWORD, 'short'),
    valid.replace(ADMIN_PASSWORD, `${ADMIN_PASSWORD}%0A`),
    valid.replace('postgres:', 'postgres%00:'),
    valid.replace('postgres.railway.internal', 'mftguikkftmrxjxrkdln.example'),
  ]) {
    assert.throws(() => parsePrivateDatabaseUrl(invalid, 'postgres'), Dr133RunnerError);
  }
});

test('environment resolver pins every Railway axis and separates runtime credentials', () => {
  const resolvedMigration = resolveDr133RunnerEnvironment(environment(), { mode: 'migration' });
  assert.equal(resolvedMigration.mode, 'migration');
  assert.equal(resolvedMigration.databaseCa, TEST_CA);
  assert.equal(new X509Certificate(resolvedMigration.databaseCa).fingerprint256.length > 0, true);
  assert.equal(
    resolveDr133RunnerEnvironment(environment('successor-migration'), {
      mode: 'successor-migration',
    }).mode,
    'successor-migration',
  );
  assert.equal(
    resolveDr133RunnerEnvironment(environment('runtime-login-deprovision'), {
      mode: 'runtime-login-deprovision',
    }).runtimePgConnectionString,
    null,
  );
  assert.equal(
    resolveDr133RunnerEnvironment(environment('runtime-login'), { mode: 'runtime-login' })
      .runtimePassword,
    RUNTIME_PASSWORD,
  );
  for (const [key, value] of [
    ['RAILWAY_PROJECT_ID', '22222222-2222-4222-8222-222222222222'],
    ['RAILWAY_ENVIRONMENT_ID', '22222222-2222-4222-8222-222222222222'],
    ['RAILWAY_ENVIRONMENT_NAME', 'production'],
    ['RAILWAY_SERVICE_ID', '22222222-2222-4222-8222-222222222222'],
    ['RAILWAY_REPLICA_REGION', 'us-east4'],
  ]) {
    assert.throws(
      () => resolveDr133RunnerEnvironment(environment('migration', { [key]: value }), {
        mode: 'migration',
      }),
      Dr133RunnerError,
      key,
    );
  }
  assert.throws(
    () => resolveDr133RunnerEnvironment(environment('migration', {
      LOR_DR133_UNEXPECTED_SECRET: 'blocked',
    }), { mode: 'migration' }),
    runnerError('UNEXPECTED_LOR_ENVIRONMENT_KEY'),
  );
  assert.throws(
    () => resolveDr133RunnerEnvironment(environment('runtime-login', {
      LOR_DR133_RUNTIME_DATABASE_URL: privateUrl(DR133_RUNTIME_LOGIN, ADMIN_PASSWORD),
    }), { mode: 'runtime-login' }),
    runnerError('RUNTIME_PASSWORD_NOT_SEPARATE'),
  );
  assert.throws(
    () => resolveDr133RunnerEnvironment(environment('runtime-login', {
      LOR_DR133_RUNTIME_DATABASE_URL: privateUrl(DR133_RUNTIME_LOGIN, '!'.repeat(48)),
    }), { mode: 'runtime-login' }),
    runnerError('RUNTIME_PASSWORD_FORMAT_INVALID'),
  );
  const railwayNormalizedCa = TEST_CA.slice(0, -1);
  assert.equal(
    resolveDr133RunnerEnvironment(environment('migration', {
      LOR_DR133_RUNTIME_DATABASE_CA: railwayNormalizedCa,
    }), { mode: 'migration' }).databaseCa,
    TEST_CA,
  );
  for (const databaseCa of [
    '',
    'not-a-certificate',
    `${TEST_CA}\n${TEST_CA}`,
    `prefix${TEST_CA}`,
    `${TEST_CA}trailer`,
    `${TEST_CA}\n`,
    TEST_CA.slice(0, -2),
    `${railwayNormalizedCa} `,
    TEST_CA.replaceAll('\n', '\r\n'),
    `${TEST_CA}\u0000`,
    `${TEST_CA}\t`,
    `Certificate:\n${TEST_CA}`,
    `${TEST_CA}-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n`,
    '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----',
  ]) {
    assert.throws(
      () => resolveDr133RunnerEnvironment(environment('migration', {
        LOR_DR133_RUNTIME_DATABASE_CA: databaseCa,
      }), { mode: 'migration' }),
      runnerError('DATABASE_CA_REJECTED'),
    );
  }
});

test('receipt writer accepts only its fixed evidence schema and cannot emit a credential field', () => {
  const capture = captureStream();
  writeDr133Receipt(capture.stream, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'migration',
    result: 'NO_MUTATION',
    runnerCode: 'SYNTHETIC_FAILURE',
    postgresCode: null,
    ...artifactReceiptHashes(),
  });
  assert.deepEqual(JSON.parse(capture.value()), {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'migration',
    result: 'NO_MUTATION',
    runnerCode: 'SYNTHETIC_FAILURE',
    postgresCode: null,
    ...artifactReceiptHashes(),
  });
  assert.throws(
    () => writeDr133Receipt(capture.stream, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'migration',
      result: 'NO_MUTATION',
      databaseUrl: privateUrl('postgres', ADMIN_PASSWORD),
    }),
    runnerError('OUTPUT_RECEIPT_INVALID'),
  );
  assert.throws(
    () => writeDr133Receipt(capture.stream, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'schema-verifier',
      result: 'SCHEMA_VERIFIED_NO_MUTATION',
    }),
    runnerError('OUTPUT_RECEIPT_INVALID'),
  );
  assert.throws(
    () => writeDr133Receipt(capture.stream, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'runtime-login',
      result: 'ALL_THREE_COMMITTED_VERIFIED',
      foundationSha256: artifactHash('foundation'),
      rlsSha256: artifactHash('rls'),
      identityScopeSha256: artifactHash('identity-scope'),
      identityScopeRollbackSha256: artifactHash('identity-scope-rollback'),
      relationCount: 28,
      definerCount: 12,
    }),
    runnerError('OUTPUT_RECEIPT_INVALID'),
  );
  assert.throws(
    () => writeDr133Receipt(capture.stream, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'schema-verifier',
      result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED',
      foundationSha256: artifactHash('foundation'),
      rlsSha256: artifactHash('rls'),
      identityScopeSha256: artifactHash('identity-scope'),
      identityScopeRollbackSha256: artifactHash('identity-scope-rollback'),
      relationCount: 28,
      definerCount: 12,
    }),
    runnerError('OUTPUT_RECEIPT_INVALID'),
  );
  assert.throws(
    () => writeDr133Receipt(capture.stream, {
      contract: DR133_RUNNER_CONTRACT,
      mode: 'migration',
      result: 'BOTH_COMMITTED_VERIFIED',
      foundationSha256: artifactHash('foundation'),
      rlsSha256: artifactHash('rls'),
      identityScopeSha256: artifactHash('identity-scope'),
      identityScopeRollbackSha256: artifactHash('identity-scope-rollback'),
      relationCount: 28,
      definerCount: 12,
    }),
    runnerError('OUTPUT_RECEIPT_INVALID'),
  );
  const getterPayload = {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'migration',
    result: 'NO_MUTATION',
  };
  Object.defineProperty(getterPayload, 'runnerCode', { enumerable: true, get: () => 'LEAK' });
  assert.throws(
    () => writeDr133Receipt(capture.stream, getterPayload),
    runnerError('OUTPUT_RECEIPT_INVALID'),
  );
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
});

test('preflight and postflight assertions reject coercible or incomplete catalog rows', () => {
  assert.match(
    DR133_POSTFLIGHT_CATALOG_SQL,
    /array_agg\(relation_name ORDER BY relation_name COLLATE "C"\)/u,
  );
  assert.match(
    DR133_POSTFLIGHT_CATALOG_SQL,
    /array_agg\(function_identity ORDER BY function_identity COLLATE "C"\)/u,
  );
  assert.equal(DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length, 28);
  assert.equal(DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES.length, 27);
  assert.equal(
    DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES.includes(
      DR133_PRE_EVIDENCE_DEFINER_IDENTITY,
    ),
    false,
  );
  assert.match(DR133_POSTFLIGHT_CATALOG_SQL, /AS app_execute_identities/u);
  assert.match(DR133_POSTFLIGHT_CATALOG_SQL, /AS pre_evidence_app_execute_denied/u);
  assert.match(DR133_POSTFLIGHT_CATALOG_SQL, /AS pre_evidence_public_execute_denied/u);
  assert.doesNotThrow(() => assertPreflightRow(preflightRow()));
  assert.doesNotThrow(() => assertBaseSchemaPreflightRow(runtimeAdminPreflightRow({
    schema_sentinel: expectedDr133Sentinel(),
  })));
  assert.throws(
    () => assertBaseSchemaPreflightRow(runtimeAdminPreflightRow()),
    runnerError('BASE_SCHEMA_PREFLIGHT_TARGET_INVALID'),
  );
  assert.doesNotThrow(() => assertPostflightRow(postflightRow()));
  assert.throws(
    () => assertPreflightRow({ ...preflightRow(), schema_count: 0 }),
    runnerError('PREFLIGHT_TARGET_INVALID'),
  );
  assert.throws(
    () => assertPostflightRow(postflightRow({ relation_count: null })),
    runnerError('POSTFLIGHT_CATALOG_INVALID'),
  );
  for (const drift of [
    { app_execute_count: '28' },
    { app_execute_identities: [...DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES] },
    { pre_evidence_app_execute_denied: false },
    { pre_evidence_public_execute_denied: false },
  ]) {
    assert.throws(
      () => assertPostflightRow(postflightRow(drift)),
      runnerError('POSTFLIGHT_CATALOG_INVALID'),
    );
  }
  assert.throws(
    () => assertPostflightRow(postflightRow({
      definer_identities: DR133_APPROVED_DEFINER_IDENTITIES.map((identity) => (
        identity.replace('(jsonb,text,text,jsonb,text,jsonb)', '(text)')
      )),
    })),
    runnerError('POSTFLIGHT_CATALOG_INVALID'),
  );
  const emptySql = buildNonemptyRelationsSql();
  for (const relation of DR133_RELATIONS) assert.match(emptySql, new RegExp(`"${relation}"`, 'u'));
  assert.equal(targetGucEntries().length, 8);
  assert.doesNotThrow(() => (
    assertRuntimeDeprovisionPreflightRow(runtimeDeprovisionPreflightRow())
  ));
  assert.doesNotThrow(() => (
    assertRuntimeDeprovisionQuarantinedRow(runtimeDeprovisionPreflightRow({
      runtime_role_active_safe: false,
      runtime_role_quarantined_safe: true,
    }), RUNTIME_ROLE_OID, { requireNoSessions: true })
  ));
  assert.doesNotThrow(() => (
    assertRuntimeDeprovisionRevokedRow(runtimeDeprovisionRevokedRow(), RUNTIME_ROLE_OID)
  ));
  assert.doesNotThrow(() => (
    assertRuntimeDeprovisionAbsentRow(runtimeDeprovisionAbsentRow(), RUNTIME_ROLE_OID)
  ));
  assert.throws(
    () => assertRuntimeDeprovisionPreflightRow(runtimeDeprovisionPreflightRow({
      runtime_active_session_count: '01',
    })),
    runnerError('RUNTIME_LOGIN_DEPROVISION_PREFLIGHT_INVALID'),
  );
  assert.throws(
    () => assertRuntimeDeprovisionPreflightRow(runtimeDeprovisionPreflightRow({
      starting_unauthenticated_client_backend_count: '01',
    })),
    runnerError('RUNTIME_LOGIN_DEPROVISION_PREFLIGHT_INVALID'),
  );
});

function createMigrationFake({
  failurePoint = null,
  postflightOverrides = {},
  successorPreflightOverrides = {},
  successorPreflightSequence = null,
} = {}) {
  const calls = [];
  const instances = [];
  let successorPreflightIndex = 0;
  const foundationPrefix = '-- Migration: 20260825010000';
  const rlsPrefix = '-- Migration: 20260825010100';
  const identityScopePrefix = '-- Migration: 20260825010300';
  const successorPrefixes = new Map([
    ['faculty-invitation', '-- Migration: 20260825010500'],
    ['faculty-private-export', '-- Migration: 20260825010700'],
    ['ai-proposal', '-- Migration: 20260825010900'],
    ['student-evidence', '-- Migration: 20260825011100'],
  ]);
  class FakeClient {
    constructor(options) {
      this.options = options;
      this.ended = false;
      instances.push(this);
    }

    async connect() {
      calls.push({ text: 'CONNECT' });
    }

    async end() {
      this.ended = true;
      calls.push({ text: 'END' });
    }

    async query(input, values) {
      const text = sqlText(input);
      calls.push({ text, values });
      if (text.startsWith(foundationPrefix) && failurePoint === 'foundation-pg') {
        throw syntheticPgError('42501');
      }
      if (text.startsWith(foundationPrefix) && failurePoint === 'foundation-transport') {
        const error = new Error(`synthetic transport failure ${ADMIN_PASSWORD}`);
        error.code = 'ECONNRESET';
        throw error;
      }
      if (text.startsWith(foundationPrefix) && failurePoint === 'foundation-08006') {
        throw syntheticPgError('08006');
      }
      if (text.startsWith(rlsPrefix) && failurePoint === 'rls-pg') {
        throw syntheticPgError('55000');
      }
      if (text.startsWith(rlsPrefix) && failurePoint === 'rls-transport') {
        const error = new Error('synthetic transport failure');
        error.code = 'EPIPE';
        throw error;
      }
      if (text.startsWith(rlsPrefix) && failurePoint === 'rls-57P01') {
        throw syntheticPgError('57P01');
      }
      if (text.startsWith(identityScopePrefix) && failurePoint === 'identity-pg') {
        throw syntheticPgError('55000');
      }
      if (text.startsWith(identityScopePrefix) && failurePoint === 'identity-transport') {
        const error = new Error('synthetic identity transport failure');
        error.code = 'EPIPE';
        throw error;
      }
      if (text.startsWith(identityScopePrefix) && failurePoint === 'identity-57P01') {
        throw syntheticPgError('57P01');
      }
      for (const [successor, prefix] of successorPrefixes) {
        if (text.startsWith(prefix) && failurePoint === `${successor}-pg`) {
          throw syntheticPgError('55000');
        }
        if (text.startsWith(prefix) && failurePoint === `${successor}-transport`) {
          const error = new Error('synthetic successor transport failure');
          error.code = 'EPIPE';
          throw error;
        }
      }
      if (/^-- Rollback: 2026082501(?:03|05|07|09|11)00/u.test(text)) {
        if (failurePoint === 'successor-guard-transport') {
          const error = new Error('synthetic successor verification transport failure');
          error.code = 'ECONNRESET';
          throw error;
        }
        if (failurePoint === 'successor-guard-57P01') throw syntheticPgError('57P01');
        if (failurePoint === 'successor-guard-57014') throw syntheticPgError('57014');
        if (failurePoint === 'successor-guard-semantic') throw syntheticPgError('55000');
      }
      if (
        text.startsWith('-- Rollback: 20260825010100')
        && failurePoint === 'base-guard-semantic'
      ) throw syntheticPgError('55000');
      if (text === DR133_PREFLIGHT_SQL) return { rows: [preflightRow()] };
      if (text === DR133_SUCCESSOR_PREFLIGHT_SQL) {
        const overrides = Array.isArray(successorPreflightSequence)
          ? successorPreflightSequence[Math.min(
            successorPreflightIndex,
            successorPreflightSequence.length - 1,
          )]
          : successorPreflightOverrides;
        successorPreflightIndex += 1;
        return { rows: [runtimeAdminPreflightRow(overrides)] };
      }
      if (text === DR133_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
      if (text === DR133_ADVISORY_UNLOCK_SQL) {
        if (failurePoint === 'unlock-transport') throw syntheticPgError('08006');
        return { rows: [{ released: true }] };
      }
      if (text === DR133_FOUNDATION_SENTINEL_SQL) {
        return { rows: [{ schema_sentinel: expectedDr133Sentinel() }] };
      }
      if (text === DR133_POSTFLIGHT_CATALOG_SQL) {
        if (failurePoint === 'postflight-transport') {
          const error = new Error('synthetic catalog transport failure');
          error.code = 'ECONNRESET';
          throw error;
        }
        if (failurePoint === 'postflight-57P01') throw syntheticPgError('57P01');
        if (failurePoint === 'postflight-55P03') throw syntheticPgError('55P03');
        if (failurePoint === 'postflight-semantic') throw syntheticPgError('55000');
        return { rows: [postflightRow(postflightOverrides)] };
      }
      if (text === buildNonemptyRelationsSql()) {
        return { rows: [{ nonempty_relation_count: '0' }] };
      }
      if (text.includes('set_config($1, $2, false)')) {
        return { rows: [{ configured_value: values[1] }] };
      }
      return { rows: [] };
    }
  }
  return { ClientClass: FakeClient, calls, instances };
}

test('migration runner verifies and applies the exact cumulative production sequence once', async () => {
  const fake = createMigrationFake();
  const capture = captureStream();
  const result = await runDr133StagingMigration({
    environment: environment(),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  });
  assert.equal(result.result, 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED');
  const receipt = JSON.parse(capture.value());
  assert.equal(receipt.result, 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED');
  assert.equal(receipt.relationCount, DR133_RELATIONS.length);
  assert.equal(receipt.definerCount, DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length);
  assert.equal(receipt.identityScopeSha256, DR133_ARTIFACTS.find(
    (artifact) => artifact.id === 'identity-scope',
  ).sha256);
  assert.equal(receipt.facultyInvitationSha256, artifactHash('faculty-invitation'));
  assert.equal(
    receipt.facultyPrivateExportSha256,
    artifactHash('faculty-private-export'),
  );
  assert.equal(receipt.aiProposalSha256, artifactHash('ai-proposal'));
  assert.equal(
    receipt.aiProposalRollbackSha256,
    artifactHash('ai-proposal-rollback'),
  );
  assert.equal(
    receipt.studentEvidenceSha256,
    artifactHash('student-evidence'),
  );
  assert.equal(
    receipt.studentEvidenceRollbackSha256,
    artifactHash('student-evidence-rollback'),
  );
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  assert.equal(fake.instances.length, 1);
  assertPinnedTls(fake.instances[0].options);
  assert.equal(fake.instances[0].ended, true);
  const texts = fake.calls.map((call) => call.text);
  const foundationIndexes = texts
    .map((text, index) => text.startsWith('-- Migration: 20260825010000') ? index : -1)
    .filter((index) => index >= 0);
  const rlsIndexes = texts
    .map((text, index) => text.startsWith('-- Migration: 20260825010100') ? index : -1)
    .filter((index) => index >= 0);
  const identityScopeIndexes = texts
    .map((text, index) => text.startsWith('-- Migration: 20260825010300') ? index : -1)
    .filter((index) => index >= 0);
  assert.equal(foundationIndexes.length, 1);
  assert.equal(rlsIndexes.length, 1);
  assert.equal(identityScopeIndexes.length, 1);
  const successorIndexes = DR133_SUCCESSOR_STAGES.map((successor) => {
    const artifact = DR133_ARTIFACTS.find((candidate) => candidate.id === successor.id);
    const migrationId = artifact.relativePath.match(/\/([0-9]{14})_/u)?.[1];
    const indexes = texts
      .map((text, index) => text.startsWith(`-- Migration: ${migrationId}`) ? index : -1)
      .filter((index) => index >= 0);
    assert.equal(indexes.length, 1, successor.id);
    return indexes[0];
  });
  assert.ok(texts.indexOf(DR133_ADVISORY_LOCK_SQL) < foundationIndexes[0]);
  assert.ok(foundationIndexes[0] < texts.indexOf(DR133_FOUNDATION_SENTINEL_SQL));
  assert.ok(texts.indexOf(DR133_FOUNDATION_SENTINEL_SQL) < rlsIndexes[0]);
  assert.ok(rlsIndexes[0] < identityScopeIndexes[0]);
  assert.deepEqual(successorIndexes, [...successorIndexes].sort((left, right) => left - right));
  assert.ok(successorIndexes.at(-1) < texts.indexOf(DR133_POSTFLIGHT_CATALOG_SQL));
  assert.equal(fake.calls.filter((call) => call.text.includes('set_config($1, $2, false)')).length, 8);
});

test('successor migration applies or resumes the exact 10300→10500→10700→10900→11100 chain', async () => {
  const fake = createMigrationFake({
    successorPreflightOverrides: { schema_sentinel: expectedDr133Sentinel() },
  });
  const capture = captureStream();
  assert.deepEqual(await runDr133StagingSuccessorMigration({
    environment: environment('successor-migration'),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  }), { result: 'SUCCESSOR_COMMITTED_VERIFIED' });
  const receipt = JSON.parse(capture.value());
  assert.equal(receipt.mode, 'successor-migration');
  assert.equal(receipt.result, 'SUCCESSOR_COMMITTED_VERIFIED');
  assert.equal(receipt.relationCount, DR133_RELATIONS.length);
  assert.equal(receipt.definerCount, DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length);
  assertPinnedTls(fake.instances[0].options);
  const texts = fake.calls.map((call) => call.text);
  assert.equal(texts.some((text) => text.startsWith('-- Migration: 20260825010000')), false);
  assert.equal(texts.some((text) => text.startsWith('-- Migration: 20260825010100')), false);
  for (const migrationId of [
    '20260825010300',
    '20260825010500',
    '20260825010700',
    '20260825010900',
    '20260825011100',
  ]) {
    assert.equal(texts.filter((text) => text.startsWith(`-- Migration: ${migrationId}`)).length, 1);
  }
  assert.equal(texts.filter((text) => text === DR133_SUCCESSOR_PREFLIGHT_SQL).length, 2);
  assert.ok(texts.includes(DR133_ADVISORY_LOCK_SQL));
  assert.ok(texts.includes(DR133_ADVISORY_UNLOCK_SQL));
  assert.ok(texts.indexOf(DR133_ADVISORY_LOCK_SQL) < texts.findIndex((text) => (
    text.startsWith('-- Migration: 20260825010300')
  )));
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));

  const resumed = createMigrationFake({
    successorPreflightOverrides: { schema_sentinel: expectedDr133SuccessorSentinelAt(2) },
  });
  const resumedCapture = captureStream();
  assert.deepEqual(await runDr133StagingSuccessorMigration({
    environment: environment('successor-migration'),
    ClientClass: resumed.ClientClass,
    output: resumedCapture.stream,
  }), { result: 'SUCCESSOR_COMMITTED_VERIFIED' });
  const resumedTexts = resumed.calls.map((call) => call.text);
  assert.equal(resumedTexts.some((text) => text.startsWith('-- Migration: 20260825010300')), false);
  assert.equal(resumedTexts.some((text) => text.startsWith('-- Migration: 20260825010500')), false);
  assert.equal(resumedTexts.filter((text) => text.startsWith('-- Migration: 20260825010700')).length, 1);
  assert.equal(resumedTexts.filter((text) => text.startsWith('-- Migration: 20260825010900')).length, 1);
  assert.equal(resumedTexts.filter((text) => text.startsWith('-- Migration: 20260825011100')).length, 1);

  const alreadyAdvanced = createMigrationFake();
  const advancedCapture = captureStream();
  assert.deepEqual(await runDr133StagingSuccessorMigration({
    environment: environment('successor-migration'),
    ClientClass: alreadyAdvanced.ClientClass,
    output: advancedCapture.stream,
  }), { result: 'SUCCESSOR_ALREADY_COMMITTED_VERIFIED' });
  assert.equal(
    JSON.parse(advancedCapture.value()).result,
    'SUCCESSOR_ALREADY_COMMITTED_VERIFIED',
  );
  assert.equal(alreadyAdvanced.calls.some((call) => (
    call.text.startsWith('-- Migration: 20260825010300')
  )), false);

  const raced = createMigrationFake({
    successorPreflightSequence: [
      { schema_sentinel: expectedDr133Sentinel() },
      {},
    ],
  });
  const racedCapture = captureStream();
  assert.deepEqual(await runDr133StagingSuccessorMigration({
    environment: environment('successor-migration'),
    ClientClass: raced.ClientClass,
    output: racedCapture.stream,
  }), { result: 'SUCCESSOR_ALREADY_COMMITTED_VERIFIED' });
  assert.equal(raced.calls.some((call) => (
    call.text.startsWith('-- Migration: 20260825010300')
  )), false);

  const regressed = createMigrationFake({
    successorPreflightSequence: [
      { schema_sentinel: expectedDr133SuccessorSentinelAt(2) },
      { schema_sentinel: expectedDr133SuccessorSentinelAt(1) },
    ],
  });
  const regressedCapture = captureStream();
  await assert.rejects(runDr133StagingSuccessorMigration({
    environment: environment('successor-migration'),
    ClientClass: regressed.ClientClass,
    output: regressedCapture.stream,
  }), runnerError('SUCCESSOR_SCHEMA_STATE_REGRESSED'));
  assert.equal(JSON.parse(regressedCapture.value()).result, 'NO_MUTATION');
});

test('successor migration classifies each next-step failure without erasing prior progress', async () => {
  for (const [failurePoint, expectedResult, expectedPostgresCode] of [
    ['base-guard-semantic', 'NO_MUTATION', '55000'],
    ['identity-pg', 'SUCCESSOR_NEXT_STEP_ROLLED_BACK', '55000'],
    ['identity-transport', 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN', null],
    ['identity-57P01', 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN', '57P01'],
    ['faculty-invitation-pg', 'SUCCESSOR_NEXT_STEP_ROLLED_BACK', '55000'],
    ['faculty-invitation-transport', 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN', null],
    ['faculty-private-export-pg', 'SUCCESSOR_NEXT_STEP_ROLLED_BACK', '55000'],
    ['faculty-private-export-transport', 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN', null],
    ['ai-proposal-pg', 'SUCCESSOR_NEXT_STEP_ROLLED_BACK', '55000'],
    ['ai-proposal-transport', 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN', null],
    ['student-evidence-pg', 'SUCCESSOR_NEXT_STEP_ROLLED_BACK', '55000'],
    ['student-evidence-transport', 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN', null],
    ['successor-guard-semantic', 'SUCCESSOR_COMMITTED_POSTFLIGHT_REJECTED', '55000'],
    ['successor-guard-transport', 'SUCCESSOR_COMMITTED_VERIFICATION_UNKNOWN', null],
    ['postflight-semantic', 'SUCCESSOR_COMMITTED_POSTFLIGHT_REJECTED', '55000'],
    ['postflight-transport', 'SUCCESSOR_COMMITTED_VERIFICATION_UNKNOWN', null],
    ['unlock-transport', 'SUCCESSOR_COMMITTED_VERIFIED_CLEANUP_FAILED', '08006'],
  ]) {
    const fake = createMigrationFake({
      failurePoint,
      successorPreflightOverrides: { schema_sentinel: expectedDr133Sentinel() },
    });
    const capture = captureStream();
    await assert.rejects(runDr133StagingSuccessorMigration({
      environment: environment('successor-migration'),
      ClientClass: fake.ClientClass,
      output: capture.stream,
    }), Dr133RunnerError, failurePoint);
    const receipt = JSON.parse(capture.value());
    assert.equal(receipt.result, expectedResult, failurePoint);
    assert.equal(receipt.postgresCode, expectedPostgresCode, failurePoint);
    const texts = fake.calls.map((call) => call.text);
    assert.equal(texts.some((text) => text.startsWith('-- Migration: 20260825010000')), false);
    assert.equal(texts.some((text) => text.startsWith('-- Migration: 20260825010100')), false);
    assert.equal(
      texts.filter((text) => text.startsWith('-- Migration: 20260825010300')).length,
      ['base-guard-semantic'].includes(failurePoint) ? 0 : 1,
      failurePoint,
    );
    assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  }

  for (const overrides of [
    { schema_sentinel: 'partial' },
    { schema_sentinel: expectedDr133Sentinel(), runtime_login_count: '1' },
  ]) {
    const rejected = createMigrationFake({ successorPreflightOverrides: overrides });
    const capture = captureStream();
    await assert.rejects(runDr133StagingSuccessorMigration({
      environment: environment('successor-migration'),
      ClientClass: rejected.ClientClass,
      output: capture.stream,
    }), runnerError('SUCCESSOR_MIGRATION_PREFLIGHT_TARGET_INVALID'));
    assert.equal(JSON.parse(capture.value()).result, 'NO_MUTATION');
    assert.equal(rejected.calls.some((call) => (
      call.text.startsWith('-- Migration: 20260825010300')
    )), false);
  }
});

test('migration runner reports truthful no-retry partial-commit states', async () => {
  for (const [failurePoint, expectedResult, expectedPostgresCode] of [
    ['foundation-pg', 'FOUNDATION_ROLLED_BACK', '42501'],
    ['foundation-transport', 'FOUNDATION_OUTCOME_UNKNOWN', null],
    ['foundation-08006', 'FOUNDATION_OUTCOME_UNKNOWN', '08006'],
    ['rls-pg', 'FOUNDATION_ONLY_COMMITTED', '55000'],
    ['rls-transport', 'RLS_OUTCOME_UNKNOWN', null],
    ['rls-57P01', 'RLS_OUTCOME_UNKNOWN', '57P01'],
    ['identity-pg', 'SUCCESSOR_PROGRESS_PRESERVED', '55000'],
    ['identity-transport', 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN', null],
    ['identity-57P01', 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN', '57P01'],
    ['faculty-invitation-pg', 'SUCCESSOR_PROGRESS_PRESERVED', '55000'],
    ['faculty-invitation-transport', 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN', null],
    ['faculty-private-export-pg', 'SUCCESSOR_PROGRESS_PRESERVED', '55000'],
    ['faculty-private-export-transport', 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN', null],
    ['ai-proposal-pg', 'SUCCESSOR_PROGRESS_PRESERVED', '55000'],
    ['ai-proposal-transport', 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN', null],
    ['student-evidence-pg', 'SUCCESSOR_PROGRESS_PRESERVED', '55000'],
    ['student-evidence-transport', 'SUCCESSOR_PROGRESS_OUTCOME_UNKNOWN', null],
  ]) {
    const fake = createMigrationFake({ failurePoint });
    const capture = captureStream();
    let observedError;
    try {
      await runDr133StagingMigration({
        environment: environment(),
        ClientClass: fake.ClientClass,
        output: capture.stream,
      });
    } catch (error) {
      observedError = error;
    }
    assert.ok(observedError instanceof Dr133RunnerError, failurePoint);
    assert.doesNotMatch(observedError.message, new RegExp(ADMIN_PASSWORD, 'u'));
    const receipt = JSON.parse(capture.value());
    assert.equal(receipt.result, expectedResult, failurePoint);
    assert.equal(receipt.postgresCode, expectedPostgresCode, failurePoint);
    const texts = fake.calls.map((call) => call.text);
    assert.equal(
      texts.filter((text) => text.startsWith('-- Migration: 20260825010000')).length,
      1,
      failurePoint,
    );
    assert.ok(texts.includes(DR133_ADVISORY_UNLOCK_SQL), failurePoint);
    assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  }

  const rejected = createMigrationFake({ postflightOverrides: { relation_count: '27' } });
  const rejectedCapture = captureStream();
  await assert.rejects(runDr133StagingMigration({
    environment: environment(),
    ClientClass: rejected.ClientClass,
    output: rejectedCapture.stream,
  }));
  assert.equal(
    JSON.parse(rejectedCapture.value()).result,
    'CUMULATIVE_SCHEMA_COMMITTED_POSTFLIGHT_REJECTED',
  );

  for (const [failurePoint, expectedResult, expectedPostgresCode] of [
    ['successor-guard-transport', 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN', null],
    ['successor-guard-57P01', 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN', '57P01'],
    ['successor-guard-57014', 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN', '57014'],
    ['postflight-transport', 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN', null],
    ['postflight-57P01', 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN', '57P01'],
    ['postflight-55P03', 'CUMULATIVE_SCHEMA_COMMITTED_VERIFICATION_UNKNOWN', '55P03'],
    ['successor-guard-semantic', 'CUMULATIVE_SCHEMA_COMMITTED_POSTFLIGHT_REJECTED', '55000'],
    ['postflight-semantic', 'CUMULATIVE_SCHEMA_COMMITTED_POSTFLIGHT_REJECTED', '55000'],
  ]) {
    const verificationFailure = createMigrationFake({ failurePoint });
    const verificationCapture = captureStream();
    await assert.rejects(runDr133StagingMigration({
      environment: environment(),
      ClientClass: verificationFailure.ClientClass,
      output: verificationCapture.stream,
    }));
    const receipt = JSON.parse(verificationCapture.value());
    assert.equal(receipt.result, expectedResult, failurePoint);
    assert.equal(receipt.postgresCode, expectedPostgresCode, failurePoint);
    assert.equal(receipt.identityScopeSha256, artifactHash('identity-scope'));
  }
});

test('successor verifier proves exact final cumulative custody without dispatching forward SQL', async () => {
  const fake = createMigrationFake();
  const capture = captureStream();
  assert.deepEqual(await verifyDr133StagingSuccessorSchema({
    environment: environment('schema-verifier'),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  }), { result: 'SCHEMA_VERIFIED_NO_MUTATION' });
  const receipt = JSON.parse(capture.value());
  assert.equal(receipt.mode, 'schema-verifier');
  assert.equal(receipt.result, 'SCHEMA_VERIFIED_NO_MUTATION');
  assert.equal(receipt.definerCount, DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length);
  assertPinnedTls(fake.instances[0].options);
  const texts = fake.calls.map((call) => call.text);
  for (const prefix of [
    '-- Migration: 20260825010000',
    '-- Migration: 20260825010100',
    '-- Migration: 20260825010300',
    '-- Migration: 20260825010500',
    '-- Migration: 20260825010700',
    '-- Migration: 20260825010900',
    '-- Migration: 20260825011100',
  ]) assert.equal(texts.some((text) => text.startsWith(prefix)), false);
  for (const destructivePattern of [
    /\nREVOKE EXECUTE ON FUNCTION lor_studio\.ensure_student_auth_binding/u,
    /\nDROP POLICY/u,
    /\nDROP FUNCTION/u,
  ]) assert.equal(texts.some((text) => destructivePattern.test(text)), false);
  assert.equal(texts.filter((text) => text === DR133_SUCCESSOR_PREFLIGHT_SQL).length, 2);
  assert.ok(texts.includes(DR133_ADVISORY_LOCK_SQL));
  assert.ok(texts.includes(DR133_ADVISORY_UNLOCK_SQL));
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));

  const stale = createMigrationFake({
    successorPreflightOverrides: { schema_sentinel: expectedDr133Sentinel() },
  });
  const staleCapture = captureStream();
  await assert.rejects(verifyDr133StagingSuccessorSchema({
    environment: environment('schema-verifier'),
    ClientClass: stale.ClientClass,
    output: staleCapture.stream,
  }), runnerError('SUCCESSOR_PREFLIGHT_TARGET_INVALID'));
  assert.equal(JSON.parse(staleCapture.value()).result, 'NO_MUTATION');
  assert.equal(stale.calls.some((call) => (
    call.text.startsWith('-- Migration: 20260825010300')
  )), false);

  const cleanupFailure = createMigrationFake({ failurePoint: 'unlock-transport' });
  const cleanupCapture = captureStream();
  await assert.rejects(verifyDr133StagingSuccessorSchema({
    environment: environment('schema-verifier'),
    ClientClass: cleanupFailure.ClientClass,
    output: cleanupCapture.stream,
  }), runnerError('POSTGRES_08006'));
  const cleanupReceipt = JSON.parse(cleanupCapture.value());
  assert.equal(cleanupReceipt.result, 'SCHEMA_VERIFIED_NO_MUTATION_CLEANUP_FAILED');
  assert.equal(cleanupReceipt.identityScopeRollbackSha256, artifactHash(
    'identity-scope-rollback',
  ));
});

function createRuntimeFake({
  grantFailure = false,
  allowDirectRead = false,
  commitFailure = false,
  adminPostflightFailureCode = null,
  runtimeConnectFailureCode = null,
} = {}) {
  const calls = [];
  const instances = [];
  let commitFailed = false;
  class FakeClient {
    constructor(options) {
      this.options = options;
      this.kind = options.application_name.endsWith('-admin') ? 'admin' : 'runtime';
      instances.push(this);
    }

    async connect() {
      calls.push({ kind: this.kind, text: 'CONNECT' });
      if (this.kind === 'runtime' && runtimeConnectFailureCode) {
        throw syntheticPgError(runtimeConnectFailureCode);
      }
    }

    async end() {
      calls.push({ kind: this.kind, text: 'END' });
    }

    async query(input, values) {
      const text = sqlText(input);
      calls.push({ kind: this.kind, text, values });
      if (this.kind === 'admin') {
        if (text === DR133_RUNTIME_ADMIN_PREFLIGHT_SQL) {
          return { rows: [runtimeAdminPreflightRow()] };
        }
        if (text === DR133_RUNTIME_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
        if (text === DR133_RUNTIME_ADVISORY_UNLOCK_SQL) return { rows: [{ released: true }] };
        if (text === DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL) {
          if (adminPostflightFailureCode) throw syntheticPgError(adminPostflightFailureCode);
          return { rows: [{
            runtime_role_safe: true,
            membership_safe: true,
            membership_count: '1',
            runtime_owned_object_count: '0',
            runtime_default_acl_count: '0',
          }] };
        }
        if (text === buildNonemptyRelationsSql()) {
          return { rows: [{ nonempty_relation_count: '0' }] };
        }
        if (text.includes('set_config($1, $2, false)')) {
          return { rows: [{ configured_value: values[1] }] };
        }
        if (text.includes("'missionmed.lor.runtime_login_password'")) {
          return { rows: [{ configured: true }] };
        }
        if (text === DR133_RUNTIME_CREATE_ROLE_SQL) return { rows: [] };
        if (text.startsWith('GRANT lor_studio_app') && grantFailure) {
          throw syntheticPgError('42501');
        }
        if (text === 'COMMIT' && commitFailure) {
          commitFailed = true;
          throw syntheticPgError('08006');
        }
        if (text === 'ROLLBACK' && commitFailed) throw syntheticPgError('08006');
        return { rows: [] };
      }

      if (text === DR133_RUNTIME_IDENTITY_SQL) return { rows: [runtimeIdentityRow()] };
      if (text === 'SELECT pg_catalog.count(*) FROM lor_studio.recommendation_cases') {
        if (allowDirectRead) return { rows: [{ count: '0' }] };
        throw syntheticPgError('42501');
      }
      if (text === DR133_RUNTIME_SET_ROLE_SQL) {
        return { rows: [{
          current_user: DR133_APPLICATION_ROLE,
          session_user: DR133_RUNTIME_LOGIN,
          visible_case_count: '0',
        }] };
      }
      if (text === DR133_RUNTIME_FORBIDDEN_DELETE_SQL) throw syntheticPgError('42501');
      if (text.startsWith('SELECT current_user::text AS current_user')) {
        return { rows: [{
          current_user: DR133_RUNTIME_LOGIN,
          session_user: DR133_RUNTIME_LOGIN,
        }] };
      }
      return { rows: [] };
    }
  }
  return { ClientClass: FakeClient, calls, instances };
}

test('runtime-login runner creates a SCRAM login transaction and proves explicit SET ROLE', async () => {
  const fake = createRuntimeFake();
  const capture = captureStream();
  const result = await provisionDr133RailwayStagingRuntimeLogin({
    environment: environment('runtime-login'),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  });
  assert.equal(result.result, 'RUNTIME_LOGIN_COMMITTED_VERIFIED');
  const receipt = JSON.parse(capture.value());
  assert.equal(receipt.result, 'RUNTIME_LOGIN_COMMITTED_VERIFIED');
  assert.equal(
    receipt.studentEvidenceRollbackSha256,
    artifactHash('student-evidence-rollback'),
  );
  assert.equal(fake.instances.length, 2);
  fake.instances.forEach(({ options }) => assertPinnedTls(options));
  const adminCalls = fake.calls.filter((call) => call.kind === 'admin');
  const runtimeCalls = fake.calls.filter((call) => call.kind === 'runtime');
  const passwordBindCall = adminCalls.find(
    (call) => call.text.includes("'missionmed.lor.runtime_login_password'"),
  );
  assert.deepEqual(passwordBindCall.values, [RUNTIME_PASSWORD]);
  assert.ok(adminCalls.some((call) => call.text === DR133_RUNTIME_CREATE_ROLE_SQL));
  assert.ok(adminCalls.some((call) => (
    call.text.startsWith('-- Rollback:')
      && call.text.includes('studentEvidenceCommands=20260825011100')
  )));
  assert.ok(fake.calls.every((call) => !call.text.includes(RUNTIME_PASSWORD)));
  assert.ok(adminCalls.some((call) => call.text === 'COMMIT'));
  assert.ok(runtimeCalls.some((call) => call.text === 'SET LOCAL ROLE lor_studio_app'));
  assert.ok(runtimeCalls.some((call) => call.text === DR133_RUNTIME_FORBIDDEN_DELETE_SQL));
  assert.ok(runtimeCalls.some((call) => call.text === 'ROLLBACK'));
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  assert.doesNotMatch(capture.value(), new RegExp(RUNTIME_PASSWORD, 'u'));
});

test('runtime-login runner rolls back DDL errors and rejects inherited direct reads', async () => {
  const rolledBack = createRuntimeFake({ grantFailure: true });
  const rolledBackCapture = captureStream();
  await assert.rejects(provisionDr133RailwayStagingRuntimeLogin({
    environment: environment('runtime-login'),
    ClientClass: rolledBack.ClientClass,
    output: rolledBackCapture.stream,
  }));
  assert.equal(
    JSON.parse(rolledBackCapture.value()).result,
    'RUNTIME_LOGIN_ROLLED_BACK',
  );
  assert.ok(rolledBack.calls.some((call) => call.kind === 'admin' && call.text === 'ROLLBACK'));
  assert.equal(rolledBack.instances.length, 1);

  const uncertainCommit = createRuntimeFake({ commitFailure: true });
  const uncertainCapture = captureStream();
  await assert.rejects(provisionDr133RailwayStagingRuntimeLogin({
    environment: environment('runtime-login'),
    ClientClass: uncertainCommit.ClientClass,
    output: uncertainCapture.stream,
  }));
  assert.equal(
    JSON.parse(uncertainCapture.value()).result,
    'RUNTIME_LOGIN_OUTCOME_UNKNOWN',
  );
  assert.equal(uncertainCommit.instances.length, 1);

  for (const [options, expectedResult, expectedPostgresCode] of [
    [
      { adminPostflightFailureCode: '08006' },
      'RUNTIME_LOGIN_COMMITTED_VERIFICATION_UNKNOWN',
      '08006',
    ],
    [
      { adminPostflightFailureCode: '57014' },
      'RUNTIME_LOGIN_COMMITTED_VERIFICATION_UNKNOWN',
      '57014',
    ],
    [
      { runtimeConnectFailureCode: '08006' },
      'RUNTIME_LOGIN_COMMITTED_VERIFICATION_UNKNOWN',
      '08006',
    ],
    [
      { runtimeConnectFailureCode: '28P01' },
      'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED',
      '28P01',
    ],
    [
      { adminPostflightFailureCode: '55000' },
      'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED',
      '55000',
    ],
  ]) {
    const postcommitFailure = createRuntimeFake(options);
    const postcommitCapture = captureStream();
    await assert.rejects(provisionDr133RailwayStagingRuntimeLogin({
      environment: environment('runtime-login'),
      ClientClass: postcommitFailure.ClientClass,
      output: postcommitCapture.stream,
    }));
    const postcommitReceipt = JSON.parse(postcommitCapture.value());
    assert.equal(postcommitReceipt.result, expectedResult, expectedPostgresCode);
    assert.equal(postcommitReceipt.postgresCode, expectedPostgresCode);
  }

  const inherited = createRuntimeFake({ allowDirectRead: true });
  const inheritedCapture = captureStream();
  await assert.rejects(
    provisionDr133RailwayStagingRuntimeLogin({
      environment: environment('runtime-login'),
      ClientClass: inherited.ClientClass,
      output: inheritedCapture.stream,
    }),
    runnerError('RUNTIME_DIRECT_READ_NOT_DENIED'),
  );
  assert.equal(
    JSON.parse(inheritedCapture.value()).result,
    'RUNTIME_LOGIN_COMMITTED_POSTFLIGHT_REJECTED',
  );
});

function createRuntimeDeprovisionFake({
  failurePoint = null,
  preflightOverrides = {},
  activeSessions = '0',
  startingBackends = '0',
  initiallyQuarantined = false,
} = {}) {
  const calls = [];
  const instances = [];
  let absenceCount = 0;
  let currentTransaction = null;
  let quarantinePhaseComplete = false;
  let postquarantineReturned = false;
  let quarantined = initiallyQuarantined;
  let commitUncertain = false;
  class FakeClient {
    constructor(options) {
      this.options = options;
      instances.push(this);
    }

    async connect() {
      calls.push({ text: 'CONNECT' });
    }

    async end() {
      calls.push({ text: 'END' });
      if (failurePoint === 'cleanup-close') throw syntheticPgError('55000');
    }

    async query(input, values) {
      const text = sqlText(input);
      calls.push({ text, values });
      if (text === DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL) {
        const isPostquarantine = quarantinePhaseComplete
          && currentTransaction === null
          && !postquarantineReturned;
        if (isPostquarantine) {
          postquarantineReturned = true;
          if (failurePoint === 'quarantine-postflight-timeout') {
            throw syntheticPgError('57014');
          }
        }
        const overrides = {
          runtime_role_active_safe: !quarantined,
          runtime_role_quarantined_safe: quarantined,
          runtime_active_session_count: quarantined ? activeSessions : '0',
          starting_unauthenticated_client_backend_count: startingBackends,
          ...preflightOverrides,
        };
        if (isPostquarantine && failurePoint === 'quarantine-postflight-mismatch') {
          overrides.runtime_role_oid = '42043';
        }
        if (currentTransaction === 'deprovision' && failurePoint === 'drain-session-race') {
          overrides.runtime_active_session_count = '1';
        }
        if (currentTransaction === 'deprovision' && failurePoint === 'drain-startup-race') {
          overrides.starting_unauthenticated_client_backend_count = '1';
        }
        return { rows: [runtimeDeprovisionPreflightRow(overrides)] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_ADVISORY_LOCK_SQL) {
        return { rows: [{ acquired: true }] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_ADVISORY_UNLOCK_SQL) {
        return { rows: [{ released: failurePoint !== 'cleanup-unlock' }] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_SQL) {
        if (failurePoint === 'auth-drain-timeout') throw syntheticPgError('57014');
        return { rows: [{ waited: failurePoint !== 'auth-drain-invalid' }] };
      }
      if (text === buildNonemptyRelationsSql()) {
        return { rows: [{ nonempty_relation_count: '0' }] };
      }
      if (text.includes('set_config($1, $2, false)')) {
        return { rows: [{ configured_value: values[1] }] };
      }
      if (text === 'BEGIN') {
        currentTransaction = quarantinePhaseComplete ? 'deprovision' : 'quarantine';
        return { rows: [] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL) {
        if (currentTransaction === 'quarantine' && failurePoint === 'quarantine') {
          throw syntheticPgError('42501');
        }
        quarantined = true;
        return { rows: [] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_REVOKE_SQL) {
        if (failurePoint === 'revoke') throw syntheticPgError('42501');
        return { rows: [] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_REVOKED_SQL) {
        return { rows: [runtimeDeprovisionRevokedRow({
          checked_runtime_oid: values[0],
          ...(failurePoint === 'revoked-startup-race'
            ? { starting_unauthenticated_client_backend_count: '1' }
            : {}),
        })] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_DROP_SQL) {
        if (failurePoint === 'drop') throw syntheticPgError('55006');
        return { rows: [] };
      }
      if (text.startsWith('DO $identity_guard$')) {
        if (failurePoint === 'guard-body') throw syntheticPgError('55000');
        return { rows: [] };
      }
      if (text === DR133_RUNTIME_DEPROVISION_ABSENCE_SQL) {
        absenceCount += 1;
        if (absenceCount > 1 && failurePoint === 'postflight-transport') {
          const error = new Error(`transport ${ADMIN_PASSWORD}`);
          error.code = 'EPIPE';
          throw error;
        }
        if (absenceCount > 1 && failurePoint === 'postflight-lock-timeout') {
          throw syntheticPgError('55P03');
        }
        return { rows: [runtimeDeprovisionAbsentRow(
          absenceCount > 1 && failurePoint === 'postflight-mismatch'
            ? { runtime_name_count: '1' }
            : { checked_runtime_oid: values[0] },
        )] };
      }
      if (text === 'COMMIT') {
        if (
          (currentTransaction === 'quarantine' && failurePoint === 'quarantine-commit')
          || (currentTransaction === 'deprovision' && failurePoint === 'deprovision-commit')
        ) {
          commitUncertain = true;
          throw syntheticPgError('08006');
        }
        if (currentTransaction === 'quarantine') quarantinePhaseComplete = true;
        currentTransaction = null;
        return { rows: [] };
      }
      if (text === 'ROLLBACK') {
        if (commitUncertain) throw syntheticPgError('08006');
        if (currentTransaction === 'quarantine') quarantinePhaseComplete = true;
        currentTransaction = null;
        return { rows: [] };
      }
      if (text.startsWith('-- Rollback:')) {
        if (failurePoint === 'guard-verification') throw syntheticPgError('55000');
        if (failurePoint === 'guard-verification-timeout') throw syntheticPgError('57014');
        return { rows: [] };
      }
      return { rows: [] };
    }
  }
  return { ClientClass: FakeClient, calls, instances };
}

test('runtime deprovision commits quarantine before OID-bound revoke, drop, and guard', async () => {
  const fake = createRuntimeDeprovisionFake();
  const capture = captureStream();
  const result = await deprovisionDr133RailwayStagingRuntimeLogin({
    environment: environment('runtime-login-deprovision'),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  });
  assert.equal(result.result, 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED');
  const receipt = JSON.parse(capture.value());
  assert.equal(receipt.result, 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED');
  assert.equal(receipt.postgresMajor, 18);
  assert.equal(
    receipt.studentEvidenceRollbackSha256,
    artifactHash('student-evidence-rollback'),
  );
  assertPinnedTls(fake.instances[0].options);
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));

  const texts = fake.calls.map(({ text }) => text);
  const revokeIndex = texts.indexOf(DR133_RUNTIME_DEPROVISION_REVOKE_SQL);
  const revokedIndex = texts.indexOf(DR133_RUNTIME_DEPROVISION_REVOKED_SQL);
  const dropIndex = texts.indexOf(DR133_RUNTIME_DEPROVISION_DROP_SQL);
  const guardBodyIndex = texts.findIndex((text) => text.startsWith('DO $identity_guard$'));
  const commitIndexes = texts
    .map((text, index) => text === 'COMMIT' ? index : -1)
    .filter((index) => index >= 0);
  const fullGuardIndex = texts.findIndex((text) => text.startsWith('-- Rollback:'));
  const authDrainIndex = texts.indexOf(DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_SQL);
  assert.ok(texts.indexOf(DR133_RUNTIME_DEPROVISION_ADVISORY_LOCK_SQL) < revokeIndex);
  assert.equal(commitIndexes.length, 2);
  assert.ok(texts.indexOf(DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL) < commitIndexes[0]);
  assert.ok(commitIndexes[0] < authDrainIndex);
  assert.ok(authDrainIndex < revokeIndex);
  assert.ok(revokeIndex < revokedIndex);
  assert.ok(revokedIndex < dropIndex);
  assert.ok(dropIndex < guardBodyIndex);
  assert.ok(guardBodyIndex < commitIndexes[1]);
  assert.equal(texts.filter((text) => text === DR133_RUNTIME_DEPROVISION_ABSENCE_SQL).length, 2);
  assert.ok(commitIndexes[1] < fullGuardIndex);
  assert.match(texts[fullGuardIndex], /studentEvidenceCommands=20260825011100/u);
  const revokedCall = fake.calls.find(({ text }) => text === DR133_RUNTIME_DEPROVISION_REVOKED_SQL);
  assert.deepEqual(revokedCall.values, [RUNTIME_ROLE_OID]);
  const authDrainCall = fake.calls.find(
    ({ text }) => text === DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_SQL,
  );
  assert.deepEqual(authDrainCall.values, [
    1 + DR133_RUNTIME_DEPROVISION_AUTH_DRAIN_MARGIN_SECONDS,
  ]);
  assert.ok(fullGuardIndex < texts.indexOf(DR133_RUNTIME_DEPROVISION_ADVISORY_UNLOCK_SQL));
  assert.match(DR133_RUNTIME_DEPROVISION_REVOKE_SQL, /GRANTED BY postgres\s+RESTRICT/u);
  assert.equal(DR133_RUNTIME_DEPROVISION_DROP_SQL, 'DROP ROLE lor_studio_runtime_login');
  for (const forbidden of ['IF EXISTS', 'CASCADE', 'DROP OWNED', 'REASSIGN OWNED']) {
    assert.doesNotMatch(
      `${DR133_RUNTIME_DEPROVISION_REVOKE_SQL}\n${DR133_RUNTIME_DEPROVISION_DROP_SQL}`,
      new RegExp(forbidden, 'u'),
    );
  }
});

test('runtime deprovision fails closed on malformed identity, grants, ownership, ACLs, or dependencies', async () => {
  for (const [field, value] of [
    ['membership_count', '2'],
    ['runtime_active_session_count', '01'],
    ['starting_unauthenticated_client_backend_count', '01'],
    ['runtime_owned_object_count', '1'],
    ['runtime_default_acl_count', '1'],
    ['runtime_unsafe_dependency_count', '1'],
    ['runtime_role_oid', '0'],
    ['runtime_role_active_safe', false],
    ['membership_safe', false],
    ['authentication_timeout_seconds', '0'],
    ['authentication_timeout_seconds', '121'],
    ['pre_auth_delay_seconds', '1'],
    ['post_auth_delay_seconds', '1'],
  ]) {
    const fake = createRuntimeDeprovisionFake({ preflightOverrides: { [field]: value } });
    const capture = captureStream();
    await assert.rejects(
      deprovisionDr133RailwayStagingRuntimeLogin({
        environment: environment('runtime-login-deprovision'),
        ClientClass: fake.ClientClass,
        output: capture.stream,
      }),
      runnerError('RUNTIME_LOGIN_DEPROVISION_PREFLIGHT_INVALID'),
    );
    assert.equal(JSON.parse(capture.value()).result, 'NO_MUTATION', field);
    assert.equal(
      fake.calls.some(({ text }) => text === DR133_RUNTIME_DEPROVISION_REVOKE_SQL),
      false,
      field,
    );
  }
});

test('runtime deprovision quarantines without terminating a live OID-bound session', async () => {
  const fake = createRuntimeDeprovisionFake({ activeSessions: '1' });
  const capture = captureStream();
  await assert.rejects(
    deprovisionDr133RailwayStagingRuntimeLogin({
      environment: environment('runtime-login-deprovision'),
      ClientClass: fake.ClientClass,
      output: capture.stream,
    }),
    runnerError('RUNTIME_LOGIN_DEPROVISION_SESSIONS_ACTIVE'),
  );
  assert.equal(
    JSON.parse(capture.value()).result,
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_SESSIONS_ACTIVE',
  );
  const texts = fake.calls.map(({ text }) => text);
  assert.ok(texts.includes(DR133_RUNTIME_DEPROVISION_QUARANTINE_SQL));
  assert.equal(texts.includes(DR133_RUNTIME_DEPROVISION_REVOKE_SQL), false);
  assert.equal(texts.includes(DR133_RUNTIME_DEPROVISION_DROP_SQL), false);
  assert.equal(texts.some((text) => text.includes('pg_terminate_backend')), false);
});

test('runtime deprovision quarantines while an unauthenticated client backend is starting', async () => {
  const fake = createRuntimeDeprovisionFake({ startingBackends: '1' });
  const capture = captureStream();
  await assert.rejects(
    deprovisionDr133RailwayStagingRuntimeLogin({
      environment: environment('runtime-login-deprovision'),
      ClientClass: fake.ClientClass,
      output: capture.stream,
    }),
    runnerError('RUNTIME_LOGIN_DEPROVISION_SESSIONS_ACTIVE'),
  );
  assert.equal(
    JSON.parse(capture.value()).result,
    'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_SESSIONS_ACTIVE',
  );
  const texts = fake.calls.map(({ text }) => text);
  assert.equal(texts.includes(DR133_RUNTIME_DEPROVISION_REVOKE_SQL), false);
  assert.equal(texts.includes(DR133_RUNTIME_DEPROVISION_DROP_SQL), false);
  assert.equal(texts.some((text) => text.includes('pg_terminate_backend')), false);
});

test('runtime deprovision resumes an already quarantined login after sessions drain', async () => {
  const fake = createRuntimeDeprovisionFake({ initiallyQuarantined: true });
  const capture = captureStream();
  const result = await deprovisionDr133RailwayStagingRuntimeLogin({
    environment: environment('runtime-login-deprovision'),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  });
  assert.equal(result.result, 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED');
  assert.equal(
    fake.calls.filter(({ text }) => text === 'COMMIT').length,
    1,
  );
});

test('runtime deprovision classifies rollback, uncertainty, verification, and cleanup truthfully', async () => {
  for (const [failurePoint, expectedResult] of [
    ['quarantine', 'RUNTIME_LOGIN_DEPROVISION_ROLLED_BACK'],
    ['quarantine-commit', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_OUTCOME_UNKNOWN'],
    [
      'quarantine-postflight-mismatch',
      'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_POSTFLIGHT_REJECTED',
    ],
    [
      'quarantine-postflight-timeout',
      'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_VERIFICATION_UNKNOWN',
    ],
    [
      'auth-drain-timeout',
      'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_VERIFICATION_UNKNOWN',
    ],
    [
      'auth-drain-invalid',
      'RUNTIME_LOGIN_DEPROVISION_QUARANTINE_COMMITTED_POSTFLIGHT_REJECTED',
    ],
    ['drain-session-race', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'],
    ['drain-startup-race', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'],
    ['revoked-startup-race', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'],
    ['revoke', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'],
    ['drop', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'],
    ['guard-body', 'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_ONLY'],
    ['deprovision-commit', 'RUNTIME_LOGIN_DEPROVISION_OUTCOME_UNKNOWN'],
    ['postflight-mismatch', 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_POSTFLIGHT_REJECTED'],
    ['postflight-transport', 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFICATION_UNKNOWN'],
    ['postflight-lock-timeout', 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFICATION_UNKNOWN'],
    ['guard-verification', 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_POSTFLIGHT_REJECTED'],
    [
      'guard-verification-timeout',
      'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFICATION_UNKNOWN',
    ],
    ['cleanup-unlock', 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED_CLEANUP_FAILED'],
    ['cleanup-close', 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED_CLEANUP_FAILED'],
  ]) {
    const fake = createRuntimeDeprovisionFake({ failurePoint });
    const capture = captureStream();
    let observedError;
    try {
      await deprovisionDr133RailwayStagingRuntimeLogin({
        environment: environment('runtime-login-deprovision'),
        ClientClass: fake.ClientClass,
        output: capture.stream,
      });
    } catch (error) {
      observedError = error;
    }
    assert.ok(observedError instanceof Dr133RunnerError, failurePoint);
    assert.doesNotMatch(observedError.message, new RegExp(ADMIN_PASSWORD, 'u'));
    assert.equal(JSON.parse(capture.value()).result, expectedResult, failurePoint);
    assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  }
});

test('Railway configs are domainless, single-region, no-retry pre-deploy runners', async () => {
  for (const [filename, expectedCommand, expectedBuildCommand] of [
    [
      '../../../railway.lor-dr133-migration.json',
      'node missionmed-hq/scripts/lor-studio/run-dr133-railway-staging-migrations.mjs',
      'node --check missionmed-hq/scripts/lor-studio/run-dr133-railway-staging-migrations.mjs',
    ],
    [
      '../../../railway.lor-dr133-runtime-login.json',
      'node missionmed-hq/scripts/lor-studio/provision-dr133-railway-staging-runtime-login.mjs',
      'node --check missionmed-hq/scripts/lor-studio/provision-dr133-railway-staging-runtime-login.mjs',
    ],
    [
      '../../../railway.lor-dr133-runtime-login-deprovision.json',
      'node missionmed-hq/scripts/lor-studio/deprovision-dr133-railway-staging-runtime-login.mjs',
      'node --check missionmed-hq/scripts/lor-studio/deprovision-dr133-railway-staging-runtime-login.mjs',
    ],
  ]) {
    const config = JSON.parse(await readFile(new URL(filename, import.meta.url), 'utf8'));
    assert.equal(config.$schema, 'https://railway.com/railway.schema.json');
    assert.equal(config.build.builder, 'RAILPACK');
    assert.equal(config.build.buildCommand, expectedBuildCommand);
    assert.doesNotMatch(config.build.buildCommand, /npm run build/u);
    assert.deepEqual(config.deploy.preDeployCommand, [expectedCommand]);
    assert.equal(config.deploy.restartPolicyType, 'NEVER');
    assert.deepEqual(config.deploy.multiRegionConfig, { 'us-west2': { numReplicas: 1 } });
    assert.match(config.deploy.startCommand, /one-shot-complete/u);
    assert.doesNotMatch(config.deploy.startCommand, /setInterval/u);
    assert.doesNotMatch(config.deploy.startCommand, /server\.mjs/u);
    assert.equal(config.deploy.healthcheckPath, undefined);
    assert.equal(config.deploy.restartPolicyMaxRetries, undefined);
  }
});

test('migration and runtime provisioning share one database-mutation advisory lock', () => {
  assert.equal(DR133_RUNTIME_ADVISORY_LOCK_SQL, DR133_ADVISORY_LOCK_SQL);
  assert.equal(DR133_RUNTIME_ADVISORY_UNLOCK_SQL, DR133_ADVISORY_UNLOCK_SQL);
  assert.equal(DR133_RUNTIME_DEPROVISION_ADVISORY_LOCK_SQL, DR133_ADVISORY_LOCK_SQL);
  assert.equal(DR133_RUNTIME_DEPROVISION_ADVISORY_UNLOCK_SQL, DR133_ADVISORY_UNLOCK_SQL);
  assert.match(DR133_ADVISORY_LOCK_SQL, /:database-mutation/u);
});

function postgresBinaries(root) {
  return Object.freeze({
    initdb: `${root}/initdb`,
    pgCtl: `${root}/pg_ctl`,
    createdb: `${root}/createdb`,
    psql: `${root}/psql`,
  });
}

function approvedPrivateIpv4Address() {
  const addresses = Object.values(networkInterfaces()).flatMap((entries) => entries ?? []);
  const selected = addresses.find((entry) => {
    if (entry.family !== 'IPv4' || entry.internal) return false;
    const octets = entry.address.split('.').map(Number);
    return octets.length === 4 && (
      octets[0] === 10
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
    );
  });
  assert.ok(selected, 'an approved private IPv4 address is required for the exact DR-133 guard');
  return selected.address;
}

function assertSafeConfigLiteral(value) {
  assert.equal(typeof value, 'string');
  assert.equal(value.includes("'"), false);
  assert.equal(/[\r\n\0]/u.test(value), false);
  return value;
}

async function enableDisposablePrivateTls(harness, binaries, privateHost) {
  const description = harness.describe();
  const dataDirectory = path.join(description.tempRoot, 'd');
  const caCertificatePath = path.join(dataDirectory, 'dr133-test-ca.crt');
  const caPrivateKeyPath = path.join(dataDirectory, 'dr133-test-ca.key');
  const certificatePath = path.join(dataDirectory, 'dr133-test-server.crt');
  const certificateRequestPath = path.join(dataDirectory, 'dr133-test-server.csr');
  const privateKeyPath = path.join(dataDirectory, 'dr133-test-server.key');
  const certificateSerialPath = path.join(dataDirectory, 'dr133-test-ca.srl');
  for (const value of [
    dataDirectory,
    caCertificatePath,
    caPrivateKeyPath,
    certificatePath,
    certificateRequestPath,
    privateKeyPath,
    certificateSerialPath,
    privateHost,
  ]) {
    assertSafeConfigLiteral(value);
  }
  await access('/opt/homebrew/bin/openssl');
  await execFile('/opt/homebrew/bin/openssl', [
    'req',
    '-new',
    '-x509',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-days',
    '1',
    '-sha256',
    '-subj',
    '/CN=MissionMed DR133 Disposable Test CA',
    '-addext',
    'basicConstraints=critical,CA:TRUE',
    '-addext',
    'keyUsage=critical,keyCertSign,cRLSign',
    '-keyout',
    caPrivateKeyPath,
    '-out',
    caCertificatePath,
  ], { timeout: 15_000, maxBuffer: 64 * 1024 });
  await execFile('/opt/homebrew/bin/openssl', [
    'req',
    '-new',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-subj',
    `/CN=${privateHost}`,
    '-addext',
    `subjectAltName=DNS:${DR133_TARGET.databaseHost},IP:${privateHost}`,
    '-keyout',
    privateKeyPath,
    '-out',
    certificateRequestPath,
  ], { timeout: 15_000, maxBuffer: 64 * 1024 });
  await execFile('/opt/homebrew/bin/openssl', [
    'x509',
    '-req',
    '-in',
    certificateRequestPath,
    '-CA',
    caCertificatePath,
    '-CAkey',
    caPrivateKeyPath,
    '-CAcreateserial',
    '-days',
    '1',
    '-sha256',
    '-copy_extensions',
    'copy',
    '-out',
    certificatePath,
  ], { timeout: 15_000, maxBuffer: 64 * 1024 });
  await chmod(caPrivateKeyPath, 0o600);
  await chmod(caCertificatePath, 0o600);
  await chmod(privateKeyPath, 0o600);
  await chmod(certificatePath, 0o600);
  const caCertificate = new X509Certificate(await readFile(caCertificatePath, 'utf8'));
  const serverCertificate = new X509Certificate(await readFile(certificatePath, 'utf8'));
  assert.equal(caCertificate.ca, true);
  assert.equal(caCertificate.checkIssued(caCertificate), true);
  assert.equal(caCertificate.verify(caCertificate.publicKey), true);
  assert.equal(serverCertificate.ca, false);
  assert.equal(serverCertificate.checkIssued(caCertificate), true);
  assert.equal(serverCertificate.verify(caCertificate.publicKey), true);
  assert.equal(serverCertificate.checkIP(privateHost), privateHost);
  await appendFile(path.join(dataDirectory, 'postgresql.conf'), `
# DR-133 disposable exact-target guard test. Harness root is removed on stop.
listen_addresses = '${privateHost}'
ssl = on
ssl_cert_file = '${certificatePath}'
ssl_key_file = '${privateKeyPath}'
authentication_timeout = '1s'
pre_auth_delay = 0
post_auth_delay = 0
`);
  await appendFile(
    path.join(dataDirectory, 'pg_hba.conf'),
    `\nhostssl railway lor_studio_runtime_login ${privateHost}/32 scram-sha-256\n`
      + `hostssl all all ${privateHost}/32 trust\n`,
  );
  await execFile(binaries.pgCtl, [
    'restart',
    '-D',
    dataDirectory,
    '-l',
    path.join(description.tempRoot, 'postgres.log'),
    '-w',
    '-t',
    '30',
  ], { timeout: 35_000, maxBuffer: 64 * 1024 });
  return Object.freeze({ databaseCa: caCertificate.toString() });
}

function postgresStartupPacket(parameters) {
  const fields = [];
  for (const [name, value] of Object.entries(parameters)) {
    fields.push(Buffer.from(`${name}\0${value}\0`, 'utf8'));
  }
  const protocol = Buffer.alloc(4);
  protocol.writeInt32BE(196_608);
  const payload = Buffer.concat([protocol, ...fields, Buffer.from([0])]);
  const packet = Buffer.alloc(payload.length + 4);
  packet.writeInt32BE(packet.length);
  payload.copy(packet, 4);
  return packet;
}

async function onceWithin(emitter, event, timeoutMs) {
  const controller = new AbortController();
  const timeout = delay(timeoutMs, null, { signal: controller.signal }).then(() => {
    throw new Error(`Timed out waiting for ${event}`);
  });
  try {
    return await Promise.race([once(emitter, event), timeout]);
  } finally {
    controller.abort();
  }
}

async function openStalledScramAuthentication({ databaseCa, host, port }) {
  const socket = connectNet({ host, port });
  await onceWithin(socket, 'connect', 3_000);
  const sslRequest = Buffer.alloc(8);
  sslRequest.writeInt32BE(8, 0);
  sslRequest.writeInt32BE(80_877_103, 4);
  socket.write(sslRequest);
  const [sslResponse] = await onceWithin(socket, 'data', 3_000);
  assert.equal(sslResponse.length, 1);
  assert.equal(sslResponse[0], 'S'.charCodeAt(0));

  const secureSocket = connectTls({
    socket,
    ca: databaseCa,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    servername: DR133_TARGET.databaseHost,
  });
  secureSocket.on('error', () => {});
  await onceWithin(secureSocket, 'secureConnect', 3_000);
  secureSocket.write(postgresStartupPacket({
    user: DR133_RUNTIME_LOGIN,
    database: 'railway',
    application_name: 'missionmed-dr133-stalled-scram',
    options: '-c role=lor_studio_app',
  }));
  let authenticationPacket = Buffer.alloc(0);
  while (authenticationPacket.length < 9) {
    const [chunk] = await onceWithin(secureSocket, 'data', 3_000);
    authenticationPacket = Buffer.concat([authenticationPacket, chunk]);
  }
  assert.equal(authenticationPacket[0], 'R'.charCodeAt(0));
  assert.equal(authenticationPacket.readInt32BE(5), 10);
  const closed = once(secureSocket, 'close').then(
    () => true,
    () => true,
  );
  return Object.freeze({
    closed,
    destroy: () => secureSocket.destroy(),
  });
}

async function bootstrapExactRailwayDatabase(harness) {
  let bootstrapClient;
  let renamerClient;
  let adminClient;
  const harnessOptions = harness.connectionOptions();
  try {
    bootstrapClient = new RealPgClient(harnessOptions);
    await bootstrapClient.connect();
    await bootstrapClient.query('CREATE ROLE dr133_role_renamer LOGIN SUPERUSER');
    await bootstrapClient.end();
    bootstrapClient = null;

    renamerClient = new RealPgClient({
      ...harnessOptions,
      user: 'dr133_role_renamer',
    });
    await renamerClient.connect();
    await renamerClient.query(
      `ALTER ROLE "${harness.describe().administrativeRole}" RENAME TO postgres`,
    );
    await renamerClient.end();
    renamerClient = null;

    adminClient = new RealPgClient({ ...harnessOptions, user: 'postgres' });
    await adminClient.connect();
    await adminClient.query('DROP ROLE dr133_role_renamer');
    await adminClient.query('CREATE DATABASE railway OWNER postgres');
    await adminClient.end();
    adminClient = null;
  } finally {
    if (bootstrapClient) await bootstrapClient.end().catch(() => {});
    if (renamerClient) await renamerClient.end().catch(() => {});
    if (adminClient) await adminClient.end().catch(() => {});
  }
}

function createPrivateTlsHarnessClientClass({ host, port }) {
  return class PrivateTlsHarnessClient extends RealPgClient {
    constructor(options) {
      const parsed = new URL(options.connectionString);
      assert.equal(options.enableChannelBinding, true);
      super({
        host,
        port,
        database: 'railway',
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        ssl: {
          ...options.ssl,
          servername: options.ssl.servername ?? parsed.hostname,
        },
        enableChannelBinding: options.enableChannelBinding,
        application_name: options.application_name,
        connectionTimeoutMillis: options.connectionTimeoutMillis,
      });
    }
  };
}

async function captureSafeConnectionFailureCode(client) {
  try {
    await client.connect();
    return 'NO_ERROR';
  } catch (error) {
    return typeof error?.code === 'string' && /^[A-Z0-9_]{2,96}$/u.test(error.code)
      ? error.code
      : 'UNKNOWN_ERROR';
  }
}

async function configureExactTargetGucs(client) {
  for (const [name, value] of targetGucEntries()) {
    const configured = await client.query(
      'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
      [name, value],
    );
    assert.equal(configured.rows[0].configured_value, value);
  }
}

async function runExactCanonicalRollbacks({
  ClientClass,
  databaseCa,
  successorRollbacks,
  rlsRollback,
  foundationRollback,
}) {
  const client = new ClientClass({
    connectionString: privateUrl('postgres', ADMIN_PASSWORD).replace('?sslmode=require', ''),
    ssl: { ca: databaseCa, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    enableChannelBinding: true,
    application_name: 'missionmed-dr133-exact-rollback-matrix',
    connectionTimeoutMillis: 15_000,
  });
  let connected = false;
  let locked = false;
  try {
    await client.connect();
    connected = true;
    const lock = await client.query(DR133_ADVISORY_LOCK_SQL);
    assert.equal(lock.rows[0].acquired, true);
    locked = true;
    await configureExactTargetGucs(client);
    const nonempty = await client.query(buildNonemptyRelationsSql());
    assert.equal(nonempty.rows[0].nonempty_relation_count, '0');
    for (const rollback of successorRollbacks) await client.query(rollback);
    await client.query(rlsRollback);
    await client.query(foundationRollback);
    const inventory = await client.query(`SELECT
      (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_namespace
        WHERE nspname = 'lor_studio') AS schema_count,
      (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_roles
        WHERE rolname LIKE 'lor_studio_%') AS role_count`);
    assert.deepEqual(inventory.rows[0], { schema_count: '0', role_count: '0' });
  } finally {
    if (connected && locked) {
      await client.query(DR133_ADVISORY_UNLOCK_SQL).catch(() => {});
    }
    if (connected) await client.end().catch(() => {});
  }
}

test('exact cumulative DR-133 migration, runtime, rollback, and reapply pass PostgreSQL 16/18', {
  skip: !RUN_REAL_POSTGRES_MATRIX,
}, async (parent) => {
  const artifactSources = new Map();
  for (const contract of DR133_ARTIFACTS) {
    const source = await readFile(
      new URL(`../../scripts/lor-studio/${contract.relativePath}`, import.meta.url),
      'utf8',
    );
    assert.equal(sha256Bytes(source), contract.sha256, contract.id);
    artifactSources.set(contract.id, source);
  }
  const rlsRollback = artifactSources.get('rls-rollback');
  const foundationRollback = artifactSources.get('foundation-rollback');
  const successorRollbacks = [...DR133_SUCCESSOR_STAGES].reverse().map((stage) => (
    artifactSources.get(stage.rollbackId)
  ));
  for (const [id, source] of [
    ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => [
      stage.rollbackId,
      artifactSources.get(stage.rollbackId),
    ]),
    ['rls-rollback', rlsRollback],
    ['foundation-rollback', foundationRollback],
  ]) {
    assert.equal(typeof source, 'string', id);
    assert.doesNotMatch(source, /\bCASCADE\b/iu, id);
    assert.doesNotMatch(source, /\bDROP\s+OWNED\b/iu, id);
    assert.doesNotMatch(source, /\bREASSIGN\s+OWNED\b/iu, id);
  }
  const privateHost = approvedPrivateIpv4Address();

  for (const toolchain of POSTGRES_TOOLCHAINS) {
    await parent.test(`PostgreSQL ${toolchain.major}`, async () => {
      const binaries = postgresBinaries(toolchain.root);
      await Promise.all(Object.values(binaries).map((binary) => access(binary)));
      const harness = createDisposablePostgresHarness({
        binaries,
        startupTimeoutMs: 30_000,
        shutdownTimeoutMs: 15_000,
      });
      let inspectorClient;
      let liveRuntimeClient;
      let rejectedRuntimeClient;
      let wrongCaClient;
      let wrongHostClient;
      let stalledAuthentication;
      let running = false;
      try {
        await harness.start();
        running = true;
        const tls = await enableDisposablePrivateTls(harness, binaries, privateHost);
        await bootstrapExactRailwayDatabase(harness);
        const matrixEnvironment = (mode) => environment(mode, {
          LOR_DR133_RUNTIME_DATABASE_CA: tls.databaseCa,
        });
        const pinnedTls = Object.freeze({
          ca: tls.databaseCa,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        });

        const ClientClass = createPrivateTlsHarnessClientClass({
          host: privateHost,
          port: harness.describe().port,
        });

        wrongCaClient = new ClientClass({
          connectionString: privateUrl('postgres', ADMIN_PASSWORD),
          ssl: { ...pinnedTls, ca: TEST_CA },
          enableChannelBinding: true,
          application_name: 'missionmed-dr133-wrong-ca-negative',
          connectionTimeoutMillis: 3_000,
        });
        assert.ok(new Set([
          'SELF_SIGNED_CERT_IN_CHAIN',
          'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
          'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        ]).has(await captureSafeConnectionFailureCode(wrongCaClient)));
        await wrongCaClient.end().catch(() => {});
        wrongCaClient = null;

        wrongHostClient = new ClientClass({
          connectionString: privateUrl('postgres', ADMIN_PASSWORD),
          ssl: { ...pinnedTls, servername: 'wrong.railway.internal' },
          enableChannelBinding: true,
          application_name: 'missionmed-dr133-wrong-host-negative',
          connectionTimeoutMillis: 3_000,
        });
        assert.equal(
          await captureSafeConnectionFailureCode(wrongHostClient),
          'ERR_TLS_CERT_ALTNAME_INVALID',
        );
        await wrongHostClient.end().catch(() => {});
        wrongHostClient = null;

        inspectorClient = new ClientClass({
          connectionString: privateUrl('postgres', ADMIN_PASSWORD),
          ssl: pinnedTls,
          enableChannelBinding: true,
          application_name: 'missionmed-dr133-exact-matrix-inspector',
          connectionTimeoutMillis: 15_000,
        });
        await inspectorClient.connect();
        const exactTransport = await inspectorClient.query(
          `SELECT
            pg_catalog.current_database()::text AS database_name,
            current_user::text AS current_user,
            pg_catalog.host(pg_catalog.inet_server_addr())::text AS server_address,
            COALESCE((
              SELECT ssl FROM pg_catalog.pg_stat_ssl
              WHERE pid = pg_catalog.pg_backend_pid()
            ), false) AS ssl_active`,
        );
        assert.deepEqual(exactTransport.rows[0], {
          database_name: 'railway',
          current_user: 'postgres',
          server_address: privateHost,
          ssl_active: true,
        });

        const migrationCapture = captureStream();
        const migrationResult = await runDr133StagingMigration({
          environment: matrixEnvironment('migration'),
          ClientClass,
          output: migrationCapture.stream,
        });
        assert.deepEqual(migrationResult, { result: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED' });
        assert.equal(JSON.parse(migrationCapture.value()).relationCount, DR133_RELATIONS.length);
        assert.equal(
          JSON.parse(migrationCapture.value()).definerCount,
          DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length,
        );

        const foundationCatalog = await inspectorClient.query(DR133_POSTFLIGHT_CATALOG_SQL);
        const foundationEmpty = await inspectorClient.query(buildNonemptyRelationsSql());
        assertPostflightRow({
          ...foundationCatalog.rows[0],
          ...foundationEmpty.rows[0],
        });

        const verifierCapture = captureStream();
        assert.deepEqual(await verifyDr133StagingSuccessorSchema({
          environment: matrixEnvironment('schema-verifier'),
          ClientClass,
          output: verifierCapture.stream,
        }), { result: 'SCHEMA_VERIFIED_NO_MUTATION' });
        assert.equal(
          JSON.parse(verifierCapture.value()).result,
          'SCHEMA_VERIFIED_NO_MUTATION',
        );

        let identityRollbackLocked = false;
        let identityRollbackError = null;
        try {
          const identityRollbackLock = await inspectorClient.query(DR133_ADVISORY_LOCK_SQL);
          assert.equal(identityRollbackLock.rows[0].acquired, true);
          identityRollbackLocked = true;
          await configureExactTargetGucs(inspectorClient);
          for (const rollback of successorRollbacks) await inspectorClient.query(rollback);
        } catch (error) {
          identityRollbackError = error;
          await inspectorClient.query('ROLLBACK').catch(() => {});
        } finally {
          if (identityRollbackLocked) {
            const released = await inspectorClient.query(DR133_ADVISORY_UNLOCK_SQL);
            assert.equal(released.rows[0].released, true);
          }
        }
        if (identityRollbackError) throw identityRollbackError;
        const exactBase = await inspectorClient.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
        assertBaseSchemaPreflightRow(exactBase.rows[0]);
        await inspectorClient.query(extractRollbackGuardVerificationSql(rlsRollback));

        const successorCapture = captureStream();
        let successorResult;
        try {
          successorResult = await runDr133StagingSuccessorMigration({
            environment: matrixEnvironment('successor-migration'),
            ClientClass,
            output: successorCapture.stream,
          });
        } catch (error) {
          const receipt = JSON.parse(successorCapture.value());
          error.message += ` [${receipt.result}/${receipt.runnerCode}/${receipt.postgresCode}]`;
          throw error;
        }
        assert.deepEqual(successorResult, { result: 'SUCCESSOR_COMMITTED_VERIFIED' });
        assert.equal(
          JSON.parse(successorCapture.value()).result,
          'SUCCESSOR_COMMITTED_VERIFIED',
        );
        const successorReplayCapture = captureStream();
        assert.deepEqual(await runDr133StagingSuccessorMigration({
          environment: matrixEnvironment('successor-migration'),
          ClientClass,
          output: successorReplayCapture.stream,
        }), { result: 'SUCCESSOR_ALREADY_COMMITTED_VERIFIED' });
        const successorCatalog = await inspectorClient.query(DR133_POSTFLIGHT_CATALOG_SQL);
        const successorEmpty = await inspectorClient.query(buildNonemptyRelationsSql());
        assertPostflightRow({
          ...successorCatalog.rows[0],
          ...successorEmpty.rows[0],
        });

        const replayCapture = captureStream();
        await assert.rejects(runDr133StagingMigration({
          environment: matrixEnvironment('migration'),
          ClientClass,
          output: replayCapture.stream,
        }), runnerError('PREFLIGHT_TARGET_INVALID'));
        assert.equal(JSON.parse(replayCapture.value()).result, 'NO_MUTATION');

        const provisionCapture = captureStream();
        let provisionResult;
        try {
          provisionResult = await provisionDr133RailwayStagingRuntimeLogin({
            environment: matrixEnvironment('runtime-login'),
            ClientClass,
            output: provisionCapture.stream,
          });
        } catch (error) {
          const receipt = JSON.parse(provisionCapture.value());
          error.message += ` [${receipt.result}/${receipt.runnerCode}/${receipt.postgresCode}]`;
          throw error;
        }
        assert.deepEqual(provisionResult, { result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED' });
        assert.equal(
          JSON.parse(provisionCapture.value()).result,
          'RUNTIME_LOGIN_COMMITTED_VERIFIED',
        );

        const roleIdentity = await inspectorClient.query(
          `SELECT oid::text AS runtime_role_oid
           FROM pg_catalog.pg_roles
           WHERE rolname = 'lor_studio_runtime_login'`,
        );
        assert.equal(roleIdentity.rowCount, 1);
        const runtimeRoleOid = roleIdentity.rows[0].runtime_role_oid;

        liveRuntimeClient = new ClientClass({
          connectionString: privateUrl(DR133_RUNTIME_LOGIN, RUNTIME_PASSWORD),
          ssl: pinnedTls,
          enableChannelBinding: true,
          application_name: 'missionmed-dr133-exact-live-session',
          connectionTimeoutMillis: 15_000,
        });
        await liveRuntimeClient.connect();
        await liveRuntimeClient.query('BEGIN');
        await liveRuntimeClient.query('SET LOCAL ROLE lor_studio_app');
        const liveBeforeQuarantine = await liveRuntimeClient.query(
          DR133_RUNTIME_SET_ROLE_SQL,
        );
        assert.deepEqual(liveBeforeQuarantine.rows[0], {
          current_user: DR133_APPLICATION_ROLE,
          session_user: DR133_RUNTIME_LOGIN,
          visible_case_count: '0',
        });

        const quarantineCapture = captureStream();
        await assert.rejects(
          deprovisionDr133RailwayStagingRuntimeLogin({
            environment: matrixEnvironment('runtime-login-deprovision'),
            ClientClass,
            output: quarantineCapture.stream,
          }),
          runnerError('RUNTIME_LOGIN_DEPROVISION_SESSIONS_ACTIVE'),
        );
        assert.equal(
          JSON.parse(quarantineCapture.value()).result,
          'RUNTIME_LOGIN_DEPROVISION_QUARANTINED_SESSIONS_ACTIVE',
        );
        const quarantinedCatalog = await inspectorClient.query(
          `SELECT
            role.oid::text AS runtime_role_oid,
            role.rolcanlogin,
            role.rolconnlimit::text AS connection_limit,
            (SELECT pg_catalog.count(*)::text
             FROM pg_catalog.pg_stat_activity
             WHERE usesysid = role.oid) AS active_session_count,
            (SELECT pg_catalog.count(*)::text
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
               )) AS starting_backend_count,
            (SELECT pg_catalog.count(*)::text
             FROM pg_catalog.pg_auth_members
             WHERE member = role.oid) AS membership_count
           FROM pg_catalog.pg_roles AS role
           WHERE role.rolname = 'lor_studio_runtime_login'`,
        );
        assert.deepEqual(quarantinedCatalog.rows[0], {
          runtime_role_oid: runtimeRoleOid,
          rolcanlogin: false,
          connection_limit: '0',
          active_session_count: '1',
          starting_backend_count: '0',
          membership_count: '1',
        });
        const liveAfterQuarantine = await liveRuntimeClient.query(
          'SELECT pg_catalog.count(*)::text AS visible_case_count FROM lor_studio.recommendation_cases',
        );
        assert.equal(liveAfterQuarantine.rows[0].visible_case_count, '0');

        rejectedRuntimeClient = new ClientClass({
          connectionString: privateUrl(DR133_RUNTIME_LOGIN, RUNTIME_PASSWORD),
          ssl: pinnedTls,
          enableChannelBinding: true,
          application_name: 'missionmed-dr133-exact-rejected-new-session',
          connectionTimeoutMillis: 15_000,
        });
        await assert.rejects(
          rejectedRuntimeClient.connect(),
          (error) => error?.code === '28000',
        );
        await rejectedRuntimeClient.end().catch(() => {});
        rejectedRuntimeClient = null;

        await liveRuntimeClient.query('ROLLBACK');
        await liveRuntimeClient.end();
        liveRuntimeClient = null;

        const deprovisionCapture = captureStream();
        assert.deepEqual(
          await deprovisionDr133RailwayStagingRuntimeLogin({
            environment: matrixEnvironment('runtime-login-deprovision'),
            ClientClass,
            output: deprovisionCapture.stream,
          }),
          { result: 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED' },
        );
        assert.equal(
          JSON.parse(deprovisionCapture.value()).result,
          'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
        );
        const absent = await inspectorClient.query(
          DR133_RUNTIME_DEPROVISION_ABSENCE_SQL,
          [runtimeRoleOid],
        );
        assertRuntimeDeprovisionAbsentRow(absent.rows[0], runtimeRoleOid);

        const reprovisionCapture = captureStream();
        assert.deepEqual(
          await provisionDr133RailwayStagingRuntimeLogin({
            environment: matrixEnvironment('runtime-login'),
            ClientClass,
            output: reprovisionCapture.stream,
          }),
          { result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED' },
        );
        const reprovisionedRole = await inspectorClient.query(
          `SELECT oid::text AS runtime_role_oid
           FROM pg_catalog.pg_roles
           WHERE rolname = 'lor_studio_runtime_login'`,
        );
        assert.equal(reprovisionedRole.rowCount, 1);
        const reprovisionedRuntimeRoleOid = reprovisionedRole.rows[0].runtime_role_oid;

        stalledAuthentication = await openStalledScramAuthentication({
          databaseCa: tls.databaseCa,
          host: privateHost,
          port: harness.describe().port,
        });
        const inFlightCatalogShape = await inspectorClient.query(
          `SELECT
            (SELECT pg_catalog.count(*)::text
             FROM pg_catalog.pg_stat_activity
             WHERE usesysid = $1::oid) AS runtime_oid_session_count,
            (SELECT pg_catalog.count(*)::text
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
               )) AS starting_backend_count`,
          [reprovisionedRuntimeRoleOid],
        );
        assert.deepEqual(inFlightCatalogShape.rows[0], {
          runtime_oid_session_count: '0',
          starting_backend_count: toolchain.major === 18 ? '1' : '0',
        });

        const rawDeprovisionCapture = captureStream();
        const rawDeprovisionStartedAt = Date.now();
        const rawDeprovisionPromise = deprovisionDr133RailwayStagingRuntimeLogin({
          environment: matrixEnvironment('runtime-login-deprovision'),
          ClientClass,
          output: rawDeprovisionCapture.stream,
        });
        let quarantineObserved = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const roleState = await inspectorClient.query(
            `SELECT rolcanlogin, rolconnlimit::text AS connection_limit
             FROM pg_catalog.pg_roles
             WHERE rolname = 'lor_studio_runtime_login'`,
          );
          if (
            roleState.rows[0]?.rolcanlogin === false
            && roleState.rows[0]?.connection_limit === '0'
          ) {
            quarantineObserved = true;
            break;
          }
          await delay(20);
        }
        assert.equal(quarantineObserved, true);

        rejectedRuntimeClient = new ClientClass({
          connectionString: privateUrl(DR133_RUNTIME_LOGIN, RUNTIME_PASSWORD),
          ssl: pinnedTls,
          enableChannelBinding: true,
          application_name: 'missionmed-dr133-bounded-drain-new-login-refusal',
          connectionTimeoutMillis: 15_000,
        });
        await assert.rejects(
          rejectedRuntimeClient.connect(),
          (error) => error?.code === '28000',
        );
        await rejectedRuntimeClient.end().catch(() => {});
        rejectedRuntimeClient = null;

        assert.deepEqual(await rawDeprovisionPromise, {
          result: 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
        });
        assert.ok(Date.now() - rawDeprovisionStartedAt >= 1_900);
        assert.equal(await stalledAuthentication.closed, true);
        stalledAuthentication = null;
        assert.equal(
          JSON.parse(rawDeprovisionCapture.value()).result,
          'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
        );
        const rawCycleAbsent = await inspectorClient.query(
          DR133_RUNTIME_DEPROVISION_ABSENCE_SQL,
          [reprovisionedRuntimeRoleOid],
        );
        assertRuntimeDeprovisionAbsentRow(
          rawCycleAbsent.rows[0],
          reprovisionedRuntimeRoleOid,
        );

        const stillExact = await inspectorClient.query(DR133_POSTFLIGHT_CATALOG_SQL);
        const stillEmpty = await inspectorClient.query(buildNonemptyRelationsSql());
        assertPostflightRow({ ...stillExact.rows[0], ...stillEmpty.rows[0] });

        await runExactCanonicalRollbacks({
          ClientClass,
          databaseCa: tls.databaseCa,
          successorRollbacks,
          rlsRollback,
          foundationRollback,
        });

        const reapplyCapture = captureStream();
        assert.deepEqual(
          await runDr133StagingMigration({
            environment: matrixEnvironment('migration'),
            ClientClass,
            output: reapplyCapture.stream,
          }),
          { result: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED' },
        );
        assert.equal(JSON.parse(reapplyCapture.value()).relationCount, DR133_RELATIONS.length);
        assert.equal(
          JSON.parse(reapplyCapture.value()).definerCount,
          DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length,
        );
        const reappliedCatalog = await inspectorClient.query(DR133_POSTFLIGHT_CATALOG_SQL);
        const reappliedEmpty = await inspectorClient.query(buildNonemptyRelationsSql());
        assertPostflightRow({
          ...reappliedCatalog.rows[0],
          ...reappliedEmpty.rows[0],
        });

        await runExactCanonicalRollbacks({
          ClientClass,
          databaseCa: tls.databaseCa,
          successorRollbacks,
          rlsRollback,
          foundationRollback,
        });
        const finalInventory = await inspectorClient.query(`SELECT
          (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_namespace
           WHERE nspname = 'lor_studio') AS schema_count,
          (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_roles
           WHERE rolname LIKE 'lor_studio_%') AS role_count`);
        assert.deepEqual(finalInventory.rows[0], {
          schema_count: '0',
          role_count: '0',
        });
      } finally {
        if (liveRuntimeClient) await liveRuntimeClient.query('ROLLBACK').catch(() => {});
        if (liveRuntimeClient) await liveRuntimeClient.end().catch(() => {});
        if (stalledAuthentication) stalledAuthentication.destroy();
        if (stalledAuthentication) await stalledAuthentication.closed.catch(() => {});
        if (wrongCaClient) await wrongCaClient.end().catch(() => {});
        if (wrongHostClient) await wrongHostClient.end().catch(() => {});
        if (rejectedRuntimeClient) await rejectedRuntimeClient.end().catch(() => {});
        if (inspectorClient) await inspectorClient.end().catch(() => {});
        if (running) await harness.stop();
      }
    });
  }
});
