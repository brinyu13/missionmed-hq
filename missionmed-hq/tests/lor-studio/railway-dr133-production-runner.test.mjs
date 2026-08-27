import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { access, appendFile, chmod, readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import pg from 'pg';

import {
  createStudentSafeRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';

import {
  DR133_APPLICATION_ROLE,
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_RUNNER_CONTRACT,
  DR133_RUNNER_ENV_KEYS,
  DR133_RUNTIME_LOGIN,
  DR133_RUNTIME_ENV_KEYS,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_STAGES,
  DR133_TARGET,
  Dr133RunnerError,
  assertRuntimeDeprovisionPreflightRow,
  buildNonemptyRelationsSql,
  dr133RuntimeDeprovisionRollbackArtifactId,
  expectedDr133SuccessorSentinelAt,
  expectedDr133Sentinel,
  expectedDr133SuccessorSentinel,
  extractRollbackGuardVerificationSql,
  extractSuccessorRollbackGuardVerificationSql,
  resolveDr133RunnerEnvironment,
  targetGucEntries,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  dr133RuntimeCaTransferDescriptors,
} from '../../scripts/lor-studio/railway-dr133-production-runtime-ca-transfer.mjs';
import {
  DR133_ADVISORY_LOCK_SQL,
  DR133_ADVISORY_UNLOCK_SQL,
  DR133_FOUNDATION_SENTINEL_SQL,
  DR133_POSTFLIGHT_CATALOG_SQL,
  DR133_PREFLIGHT_SQL,
  DR133_SUCCESSOR_PREFLIGHT_SQL,
  runDr133ProductionMigration,
  runDr133ProductionSuccessorMigration,
  verifyDr133ProductionSuccessorSchema,
} from '../../scripts/lor-studio/run-dr133-railway-production-migrations.mjs';
import {
  DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL,
  DR133_RUNTIME_ADMIN_PREFLIGHT_SQL,
  DR133_RUNTIME_ADVISORY_LOCK_SQL,
  DR133_RUNTIME_ADVISORY_UNLOCK_SQL,
  DR133_RUNTIME_CREATE_ROLE_SQL,
  DR133_RUNTIME_FORBIDDEN_DELETE_SQL,
  DR133_RUNTIME_IDENTITY_SQL,
  DR133_RUNTIME_SECRET_LOG_GUARD_SQL,
  DR133_RUNTIME_SECRET_LOG_GUARD_VERIFY_SQL,
  DR133_RUNTIME_SET_ROLE_SQL,
  provisionDr133RailwayProductionRuntimeLogin,
} from '../../scripts/lor-studio/provision-dr133-railway-production-runtime-login.mjs';
import {
  DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL,
  DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
} from '../../scripts/lor-studio/deprovision-dr133-railway-production-runtime-login.mjs';
import {
  DR133_PRODUCTION_CONNECTIVITY_SQL,
} from '../../scripts/lor-studio/verify-dr133-railway-production-connectivity.mjs';
import {
  normalizeDr133ProductionProviderAdminUrl,
  normalizeDr133ProductionProviderRuntimeUrl,
  scrubDr133SensitiveAmbientEnvironment,
} from '../../scripts/lor-studio/run-dr133-railway-production-service-operation.mjs';
import {
  DR133_ROLLBACK_DRILL_ABSENCE_SQL,
  runDr133ProductionRollbackDrill,
} from '../../scripts/lor-studio/run-dr133-railway-production-rollback-drill.mjs';
import {
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const scriptDirectory = path.resolve(testDirectory, '..', '..', 'scripts', 'lor-studio');
const PASSWORD = 'p'.repeat(43);
const RUNTIME_PASSWORD = 'r'.repeat(48);
const PRODUCTION_CA = await readFile(
  new URL('./dr133-production-root-ca.pem', import.meta.url),
  'utf8',
);
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

test('production runner is pinned to the exact isolated provider target', () => {
  assert.equal(DR133_RUNNER_CONTRACT, 'missionmed.lor.railway-dr133-production-runner.v1');
  assert.deepEqual(DR133_TARGET, {
    provider: 'railway-postgres',
    deploymentEnvironment: 'production',
    migrationLedger: 'lor_studio/migrations/production',
    projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
    environmentId: 'ed3353f7-bcc7-4e25-a000-3c9fc628a9a7',
    environmentName: 'production',
    executionServiceId: '576520f5-a702-4343-a277-decdeeed57f6',
    applicationServiceId: '3d18b017-4fc9-4b22-b097-ba879816d374',
    databaseServiceId: '576520f5-a702-4343-a277-decdeeed57f6',
    databaseHost: 'postgres-3tcu.railway.internal',
    databaseName: 'railway',
    databaseAdmin: 'postgres',
    region: 'us-west2',
    decisionRecord: 'DR-133',
    dataCopied: 'false',
    sourceBaselineCommit: 'b44c18fa4c69e773f333221dda9c6cc6a42cbb85',
    sourceBaselineTree: '0f800ef984147c40cd6251ac1c79fb58351c7e32',
  });
  assert.match(expectedDr133Sentinel(), /^missionmed\.lor\.railway-postgres-target\.v2\|deploymentEnvironment=production\|migrationLedger=lor_studio\/migrations\/production\|/u);
  assert.match(
    expectedDr133SuccessorSentinel(),
    /privateStorageObjectIdRegex=20260826011900$/u,
  );
  assert.doesNotMatch(expectedDr133SuccessorSentinel(), /f5705d38|b49a52e7|lor-staging/u);
});

test('all twenty-two live-production artifacts are hash-pinned and target-exclusive', async () => {
  assert.equal(DR133_ARTIFACTS.length, 22);
  assert.equal(new Set(DR133_ARTIFACTS.map((artifact) => artifact.id)).size, 22);
  for (const artifact of DR133_ARTIFACTS) {
    const source = await readFile(path.join(scriptDirectory, artifact.relativePath));
    const text = source.toString('utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'), artifact.sha256, artifact.id);
    assert.match(
      artifact.relativePath,
      /2026082601(?:00|01|03|05|07|09|11|13|15|17|19)00_f2_lor_1012_(?:live_production_)?/u,
    );
    assert.match(text, /ed3353f7-bcc7-4e25-a000-3c9fc628a9a7/u);
    assert.match(text, /576520f5-a702-4343-a277-decdeeed57f6/u);
    assert.match(text, /missionmed\.lor\.railway-postgres-target\.v2\|deploymentEnvironment=production\|migrationLedger=lor_studio\/migrations\/production/u);
    assert.match(text, /missionmed\.lor\.target_deployment_environment/u);
    assert.match(text, /missionmed\.lor\.target_migration_ledger/u);
    assert.match(text, /inet_server_addr\(\) << pg_catalog\.inet '127\.0\.0\.0\/8'/u);
    assert.match(text, /inet_server_addr\(\) << pg_catalog\.inet '::1\/128'/u);
    assert.match(text, /inet_server_addr\(\) << pg_catalog\.inet '10\.0\.0\.0\/8'/u);
    assert.match(text, /inet_server_addr\(\) << pg_catalog\.inet 'fc00::\/7'/u);
    assert.doesNotMatch(text, /f5705d38|b49a52e7|lor-staging|railway-postgres-target\.v1/u);
  }
});

test('all production private-target probes accept the pinned Railway tunnel loopback', () => {
  for (const sql of [
    DR133_PRODUCTION_CONNECTIVITY_SQL,
    DR133_PREFLIGHT_SQL,
    DR133_SUCCESSOR_PREFLIGHT_SQL,
    DR133_RUNTIME_ADMIN_PREFLIGHT_SQL,
    DR133_RUNTIME_IDENTITY_SQL,
    DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL,
  ]) {
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '127\.0\.0\.0\/8'/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '::1\/128'/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '10\.0\.0\.0\/8'/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '172\.16\.0\.0\/12'/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '192\.168\.0\.0\/16'/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet '100\.64\.0\.0\/10'/u);
    assert.match(sql, /inet_server_addr\(\) << pg_catalog\.inet 'fc00::\/7'/u);
    assert.match(sql, /AS private_server_address/u);
  }
});

test('production runtime deprovision accepts only exact empty-schema cursor prefixes', () => {
  const row = {
    database_name: DR133_TARGET.databaseName,
    current_user: DR133_TARGET.databaseAdmin,
    session_user: DR133_TARGET.databaseAdmin,
    database_owner: DR133_TARGET.databaseAdmin,
    postgres_major: 18,
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
    schema_sentinel: expectedDr133SuccessorSentinelAt(5),
    app_role_count: '1',
    command_owner_count: '1',
    runtime_login_count: '1',
    lor_role_count: '3',
    runtime_role_oid: '42042',
    runtime_role_active_safe: true,
    runtime_role_quarantined_safe: false,
    membership_safe: true,
    membership_count: '1',
    runtime_active_session_count: '0',
    starting_unauthenticated_client_backend_count: '0',
    runtime_owned_object_count: '0',
    runtime_default_acl_count: '0',
    runtime_unsafe_dependency_count: '0',
    authentication_timeout_seconds: '60',
    pre_auth_delay_seconds: '0',
    post_auth_delay_seconds: '0',
  };
  assert.equal(assertRuntimeDeprovisionPreflightRow(row).successorStageIndex, 5);
  assert.equal(
    dr133RuntimeDeprovisionRollbackArtifactId(5),
    'student-evidence-rollback',
  );
  assert.equal(
    dr133RuntimeDeprovisionRollbackArtifactId(DR133_SUCCESSOR_STAGES.length),
    'private-storage-object-id-regex-rollback',
  );
  assert.throws(
    () => assertRuntimeDeprovisionPreflightRow({ ...row, schema_sentinel: 'foreign' }),
    /RUNTIME_LOGIN_DEPROVISION_PREFLIGHT_INVALID/u,
  );
  assert.throws(
    () => assertRuntimeDeprovisionPreflightRow({ ...row, lor_role_count: '4' }),
    /RUNTIME_LOGIN_DEPROVISION_PREFLIGHT_INVALID/u,
  );
  assert.match(DR133_RUNTIME_DEPROVISION_PREFLIGHT_SQL, /AS lor_role_count/u);
  assert.match(DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL, /SELECT EXISTS/u);
  assert.match(DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL, /ERRCODE = '55000'/u);
  assert.doesNotMatch(DR133_RUNTIME_DEPROVISION_EMPTY_SCHEMA_SQL, /DELETE|TRUNCATE|DROP/u);
});

test('production GUCs and service-operation URL normalization fail closed', () => {
  assert.deepEqual(targetGucEntries(), [
    ['missionmed.lor.target_provider', 'railway-postgres'],
    ['missionmed.lor.target_deployment_environment', 'production'],
    ['missionmed.lor.target_migration_ledger', 'lor_studio/migrations/production'],
    ['missionmed.lor.target_project_id', DR133_TARGET.projectId],
    ['missionmed.lor.target_environment_id', DR133_TARGET.environmentId],
    ['missionmed.lor.target_service_id', DR133_TARGET.databaseServiceId],
    ['missionmed.lor.target_database_name', DR133_TARGET.databaseName],
    ['missionmed.lor.target_region', DR133_TARGET.region],
    ['missionmed.lor.target_decision_record', DR133_TARGET.decisionRecord],
    ['missionmed.lor.target_data_copied', DR133_TARGET.dataCopied],
  ]);
  const raw = `postgresql://postgres:${PASSWORD}@${DR133_TARGET.databaseHost}:5432/railway`;
  const normalized = normalizeDr133ProductionProviderAdminUrl(raw);
  assert.equal(normalized, `${raw}?sslmode=require`);
  const runtimeRaw = raw.replace('postgres:', `${DR133_RUNTIME_LOGIN}:`);
  assert.equal(
    normalizeDr133ProductionProviderRuntimeUrl(runtimeRaw),
    `${runtimeRaw}?sslmode=require`,
  );
  assert.equal(normalizeDr133ProductionProviderRuntimeUrl(raw), null);
  for (const rejected of [
    raw.replace(DR133_TARGET.databaseHost, 'postgres.railway.internal'),
    raw.replace('/railway', '/other'),
    `${raw}?application_name=unsafe`,
    `${raw}#fragment`,
  ]) assert.equal(normalizeDr133ProductionProviderAdminUrl(rejected), null);
});

test('service-operation dispatch scrubs ambient credentials before running product code', () => {
  const environment = {
    DATABASE_URL: 'must-not-survive',
    DATABASE_PRIVATE_URL: 'must-not-survive',
    DATABASE_PUBLIC_URL: 'must-not-survive',
    ENV: 'must-not-survive',
    GITHUB_TOKEN: 'must-not-survive',
    LOR_DR133_RUNTIME_DATABASE_CA: 'must-not-survive',
    LOR_DR133_RUNTIME_DATABASE_URL: 'must-not-survive',
    NODE_OPTIONS: '--require=must-not-survive',
    PGHOST: 'must-not-survive',
    PGOPTIONS: 'must-not-survive',
    PGPASSWORD: 'must-not-survive',
    PGSSLNEGOTIATION: 'must-not-survive',
    RAILWAY_API_KEY: 'must-not-survive',
    SSH_AUTH_SOCK: 'must-not-survive',
    WAL_ARCHIVE_SECRET: 'must-not-survive',
    LOR_DR133_MODE: 'schema-verifier',
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
  };
  assert.equal(scrubDr133SensitiveAmbientEnvironment(environment), true);
  assert.deepEqual(environment, {});
});

test('service-operation bootstrap clears ambient state before loading any pg-backed module', async () => {
  const source = await readFile(
    new URL('../../scripts/lor-studio/run-dr133-railway-production-service-operation.mjs', import.meta.url),
    'utf8',
  );
  for (const moduleName of [
    'verify-dr133-railway-production-connectivity',
    'run-dr133-railway-production-migrations',
    'run-dr133-railway-production-rollback-drill',
    'provision-dr133-railway-production-runtime-login',
    'deprovision-dr133-railway-production-runtime-login',
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`from './${moduleName}\\.mjs'`, 'u'),
    );
  }
  const scrubIndex = source.indexOf('scrubDr133SensitiveAmbientEnvironment(ambient)');
  const dynamicImportIndex = source.indexOf('await import(operationDescriptor.module)');
  assert.equal(scrubIndex >= 0, true);
  assert.equal(dynamicImportIndex > scrubIndex, true);
});

test('production environment resolution accepts only the database-variable execution identity', () => {
  assert.equal(typeof TEST_CA, 'string');
  for (const unavailableLocalRunKey of [
    'RAILWAY_DEPLOYMENT_ID',
    'RAILWAY_REPLICA_REGION',
  ]) {
    assert.equal(DR133_RUNNER_ENV_KEYS.includes(unavailableLocalRunKey), false);
    assert.equal(DR133_RUNTIME_ENV_KEYS.includes(unavailableLocalRunKey), false);
  }
  const environment = {
    LOR_DR133_ADMIN_DATABASE_URL:
      `postgresql://postgres:${PASSWORD}@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`,
    LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
    LOR_DR133_MODE: 'schema-verifier',
    LOR_DR133_TUNNEL_HOST: '127.0.0.1',
    LOR_DR133_TUNNEL_PORT: '55432',
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
  };
  const resolved = resolveDr133RunnerEnvironment(environment, { mode: 'schema-verifier' });
  assert.equal(resolved.mode, 'schema-verifier');
  assert.equal(resolved.runtimePassword, null);
  assert.equal(new URL(resolved.adminPgConnectionString).hostname, '127.0.0.1');
  assert.equal(new URL(resolved.adminPgConnectionString).port, '55432');
  assert.equal(new URL(resolved.adminPgConnectionString).search, '');
  assert.equal(resolved.databaseTlsServername, DR133_TARGET.databaseHost);
  assert.throws(
    () => resolveDr133RunnerEnvironment({
      ...environment,
      LOR_DR133_TUNNEL_HOST: 'localhost',
    }, { mode: 'schema-verifier' }),
  );
  assert.throws(
    () => resolveDr133RunnerEnvironment({
      ...environment,
      LOR_DR133_TUNNEL_PORT: '5432',
    }, { mode: 'schema-verifier' }),
  );
  assert.throws(
    () => resolveDr133RunnerEnvironment({
      ...environment,
      LOR_DR133_RUNTIME_DATABASE_CA: TEST_CA,
    }, { mode: 'schema-verifier' }),
  );
  assert.throws(
    () => resolveDr133RunnerEnvironment({
      ...environment,
      RAILWAY_SERVICE_ID: DR133_TARGET.applicationServiceId,
    }, { mode: 'schema-verifier' }),
  );
});

test('CA transfer reads the database service and binds only the application service', () => {
  const descriptors = dr133RuntimeCaTransferDescriptors('/tmp/f2-lor-production-root.crt');
  const downloadServiceIndex = descriptors.download.indexOf('--service') + 1;
  const bindServiceIndex = descriptors.variableSet.indexOf('--service') + 1;
  assert.equal(descriptors.download[downloadServiceIndex], DR133_TARGET.databaseServiceId);
  assert.equal(descriptors.variableSet[bindServiceIndex], DR133_TARGET.applicationServiceId);
  assert.equal(descriptors.variableSet.includes('--stdin'), true);
  assert.equal(descriptors.variableSet.includes('--skip-deploys'), true);
});

function runtimeLoginEnvironment() {
  return {
    LOR_DR133_ADMIN_DATABASE_URL:
      `postgresql://postgres:${PASSWORD}@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`,
    LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
    LOR_DR133_RUNTIME_DATABASE_URL:
      `postgresql://${DR133_RUNTIME_LOGIN}:${RUNTIME_PASSWORD}`
      + `@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`,
    LOR_DR133_MODE: 'runtime-login',
    LOR_DR133_TUNNEL_HOST: '127.0.0.1',
    LOR_DR133_TUNNEL_PORT: '55432',
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
  };
}

function runtimeAdminPreflightRow() {
  return {
    database_name: DR133_TARGET.databaseName,
    current_user: DR133_TARGET.databaseAdmin,
    session_user: DR133_TARGET.databaseAdmin,
    database_owner: DR133_TARGET.databaseAdmin,
    postgres_major: 18,
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
    schema_sentinel: expectedDr133SuccessorSentinel(),
    schema_owner: DR133_TARGET.databaseAdmin,
    schema_count: '1',
    app_role_count: '1',
    command_owner_count: '1',
    runtime_login_count: '0',
  };
}

function createProductionRuntimeLoginFake({ loggingSafe = true } = {}) {
  const calls = [];
  class FakeClient {
    constructor(options) {
      this.options = options;
      this.kind = options.application_name.endsWith('-admin') ? 'admin' : 'runtime';
    }

    async connect() { calls.push({ kind: this.kind, text: 'CONNECT' }); }
    async end() { calls.push({ kind: this.kind, text: 'END' }); }

    async query(input, values) {
      const text = typeof input === 'string' ? input : input?.text;
      calls.push({ kind: this.kind, text, values });
      if (this.kind === 'admin') {
        if (text === DR133_RUNTIME_ADMIN_PREFLIGHT_SQL) {
          return { rows: [runtimeAdminPreflightRow()] };
        }
        if (text === DR133_RUNTIME_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
        if (text === DR133_RUNTIME_ADVISORY_UNLOCK_SQL) return { rows: [{ released: true }] };
        if (text === DR133_RUNTIME_SECRET_LOG_GUARD_VERIFY_SQL) {
          return { rows: [{ logging_safe: loggingSafe }] };
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
        if (text === DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL) {
          return { rows: [{
            runtime_role_safe: true,
            membership_safe: true,
            membership_count: '1',
            runtime_owned_object_count: '0',
            runtime_default_acl_count: '0',
          }] };
        }
        return { rows: [] };
      }
      if (text === DR133_RUNTIME_IDENTITY_SQL) {
        return { rows: [{
          database_name: DR133_TARGET.databaseName,
          current_user: DR133_RUNTIME_LOGIN,
          session_user: DR133_RUNTIME_LOGIN,
          private_server_address: true,
          ssl_active: true,
          ssl_version: 'TLSv1.3',
          ssl_cipher: 'TLS_AES_256_GCM_SHA384',
        }] };
      }
      if (text === 'SELECT pg_catalog.count(*) FROM lor_studio.recommendation_cases') {
        const error = new Error('private denial');
        error.code = '42501';
        throw error;
      }
      if (text === DR133_RUNTIME_SET_ROLE_SQL) {
        return { rows: [{
          current_user: DR133_APPLICATION_ROLE,
          session_user: DR133_RUNTIME_LOGIN,
          visible_case_count: '0',
        }] };
      }
      if (text === DR133_RUNTIME_FORBIDDEN_DELETE_SQL) {
        const error = new Error('private denial');
        error.code = '42501';
        throw error;
      }
      if (text.startsWith('SELECT current_user::text AS current_user')) {
        return { rows: [{
          current_user: DR133_RUNTIME_LOGIN,
          session_user: DR133_RUNTIME_LOGIN,
        }] };
      }
      return { rows: [] };
    }
  }
  return { calls, ClientClass: FakeClient };
}

test('runtime-login suppresses server statement and parameter logging before password custody', async () => {
  const fake = createProductionRuntimeLoginFake();
  let receipt = '';
  const result = await provisionDr133RailwayProductionRuntimeLogin({
    environment: runtimeLoginEnvironment(),
    ClientClass: fake.ClientClass,
    output: { write(fragment) { receipt += fragment; } },
  });
  assert.deepEqual(result, { result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED' });
  const admin = fake.calls.filter((call) => call.kind === 'admin');
  const beginIndex = admin.findIndex((call) => call.text === 'BEGIN');
  const guardIndexes = DR133_RUNTIME_SECRET_LOG_GUARD_SQL.map(
    (statement) => admin.findIndex((call) => call.text === statement),
  );
  const verifyIndex = admin.findIndex(
    (call) => call.text === DR133_RUNTIME_SECRET_LOG_GUARD_VERIFY_SQL,
  );
  const passwordIndex = admin.findIndex(
    (call) => call.text.includes("'missionmed.lor.runtime_login_password'"),
  );
  const createIndex = admin.findIndex((call) => call.text === DR133_RUNTIME_CREATE_ROLE_SQL);
  assert.equal(beginIndex >= 0, true);
  assert.equal(guardIndexes.every((index) => index > beginIndex), true);
  assert.equal(verifyIndex > Math.max(...guardIndexes), true);
  assert.equal(passwordIndex > verifyIndex, true);
  assert.equal(createIndex > passwordIndex, true);
  assert.deepEqual(admin[passwordIndex].values, [RUNTIME_PASSWORD]);
  assert.equal(fake.calls.some((call) => call.text.includes(RUNTIME_PASSWORD)), false);
  assert.match(DR133_RUNTIME_CREATE_ROLE_SQL, /EXCEPTION\n  WHEN OTHERS THEN/u);
  assert.match(
    DR133_RUNTIME_CREATE_ROLE_SQL,
    /set_config\('missionmed\.lor\.runtime_login_password', '', true\)/u,
  );
  assert.doesNotMatch(DR133_RUNTIME_CREATE_ROLE_SQL, /RAISE;\s*$/mu);
  assert.doesNotMatch(receipt, new RegExp(RUNTIME_PASSWORD, 'u'));

  const blocked = createProductionRuntimeLoginFake({ loggingSafe: false });
  let blockedReceipt = '';
  await assert.rejects(
    provisionDr133RailwayProductionRuntimeLogin({
      environment: runtimeLoginEnvironment(),
      ClientClass: blocked.ClientClass,
      output: { write(fragment) { blockedReceipt += fragment; } },
    }),
    (error) => error?.code === 'RUNTIME_SECRET_LOG_GUARD_REJECTED',
  );
  assert.equal(blocked.calls.some(
    (call) => call.text.includes("'missionmed.lor.runtime_login_password'"),
  ), false);
  assert.equal(blocked.calls.some((call) => call.text === 'ROLLBACK'), true);
  assert.equal(JSON.parse(blockedReceipt).result, 'RUNTIME_LOGIN_ROLLED_BACK');
});

function productionMigrationEnvironment(mode) {
  return {
    LOR_DR133_ADMIN_DATABASE_URL:
      `postgresql://postgres:${PASSWORD}@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`,
    LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
    LOR_DR133_MODE: mode,
    LOR_DR133_TUNNEL_HOST: '127.0.0.1',
    LOR_DR133_TUNNEL_PORT: '55432',
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
  };
}

function productionCursorRow(cursor) {
  const common = {
    database_name: DR133_TARGET.databaseName,
    current_user: DR133_TARGET.databaseAdmin,
    session_user: DR133_TARGET.databaseAdmin,
    database_owner: DR133_TARGET.databaseAdmin,
    postgres_major: 18,
    private_server_address: true,
    ssl_active: true,
    ssl_version: 'TLSv1.3',
    ssl_cipher: 'TLS_AES_256_GCM_SHA384',
    runtime_login_count: '0',
  };
  if (cursor.state === 'absent') {
    return {
      ...common,
      schema_sentinel: null,
      schema_owner: null,
      schema_count: '0',
      app_role_count: '0',
      command_owner_count: '0',
      lor_role_count: '0',
    };
  }
  return {
    ...common,
    schema_sentinel: cursor.state === 'foundation'
      ? expectedDr133Sentinel()
      : expectedDr133SuccessorSentinelAt(cursor.index),
    schema_owner: DR133_TARGET.databaseAdmin,
    schema_count: '1',
    app_role_count: '1',
    command_owner_count: cursor.state === 'foundation' ? '0' : '1',
    lor_role_count: cursor.state === 'foundation' ? '1' : '2',
  };
}

function productionPostflightRow() {
  return {
    schema_sentinel: expectedDr133SuccessorSentinel(),
    schema_owner: DR133_TARGET.databaseAdmin,
    relation_names: [...DR133_RELATIONS].sort(),
    relation_count: String(DR133_RELATIONS.length),
    forced_rls_count: String(DR133_RELATIONS.length),
    definer_identities: [...DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES].sort(),
    definer_count: String(DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length),
    definer_custody_safe: true,
    app_execute_identities: [...DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES].sort(),
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
  };
}

function receiptCapture() {
  let value = '';
  return {
    stream: { write(fragment) { value += fragment; } },
    receipt: () => JSON.parse(value.trim()),
  };
}

async function createProductionMigrationStatefulFake({
  cursor,
  failAfterCommitId = null,
} = {}) {
  const calls = [];
  let failureConsumed = false;
  const sources = new Map();
  for (const artifact of DR133_ARTIFACTS) {
    sources.set(
      artifact.id,
      await readFile(path.join(scriptDirectory, artifact.relativePath), 'utf8'),
    );
  }
  const baseGuard = extractRollbackGuardVerificationSql(sources.get('rls-rollback'));
  const successorGuards = new Map(DR133_SUCCESSOR_STAGES.map((stage, index) => [
    extractSuccessorRollbackGuardVerificationSql(sources.get(stage.rollbackId), stage.rollbackId),
    index + 1,
  ]));
  const forwardSources = new Map(
    DR133_ARTIFACTS.filter(({ purpose }) => purpose.startsWith('forward')).map(
      ({ id }) => [sources.get(id), id],
    ),
  );
  const maybeFailAfterCommit = (id) => {
    if (id !== failAfterCommitId || failureConsumed) return;
    failureConsumed = true;
    throw Object.assign(new Error('secret-free simulated disconnect'), { code: '08006' });
  };
  class FakeClient {
    async connect() { calls.push({ sql: 'CONNECT' }); }
    async end() { calls.push({ sql: 'END' }); }

    async query(input, values) {
      const sql = typeof input === 'string' ? input : input?.text;
      calls.push({ sql, values });
      if (sql === DR133_SUCCESSOR_PREFLIGHT_SQL) {
        return { rows: [productionCursorRow(cursor)] };
      }
      if (sql === DR133_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
      if (sql === DR133_ADVISORY_UNLOCK_SQL) return { rows: [{ released: true }] };
      if (sql === DR133_FOUNDATION_SENTINEL_SQL) {
        return { rows: [{ schema_sentinel: expectedDr133Sentinel() }] };
      }
      if (sql === DR133_POSTFLIGHT_CATALOG_SQL) {
        if (cursor.state !== 'committed' || cursor.index !== DR133_SUCCESSOR_STAGES.length) {
          throw Object.assign(new Error('postflight before final cursor'), { code: '55000' });
        }
        return { rows: [productionPostflightRow()] };
      }
      if (sql === buildNonemptyRelationsSql()) {
        return { rows: [{ nonempty_relation_count: '0' }] };
      }
      if (values?.length === 2 && sql.includes('set_config($1, $2, false)')) {
        return { rows: [{ configured_value: values[1] }] };
      }
      const forwardId = forwardSources.get(sql);
      if (forwardId === 'foundation') {
        assert.equal(cursor.state, 'absent');
        cursor.state = 'foundation';
        delete cursor.index;
        maybeFailAfterCommit(forwardId);
        return { rows: [] };
      }
      if (forwardId === 'rls') {
        assert.equal(cursor.state, 'foundation');
        cursor.state = 'committed';
        cursor.index = 0;
        maybeFailAfterCommit(forwardId);
        return { rows: [] };
      }
      const successorIndex = DR133_SUCCESSOR_STAGES.findIndex(({ id }) => id === forwardId);
      if (successorIndex >= 0) {
        assert.deepEqual(cursor, { state: 'committed', index: successorIndex });
        cursor.index += 1;
        maybeFailAfterCommit(forwardId);
        return { rows: [] };
      }
      if (sql === baseGuard) {
        assert.deepEqual(cursor, { state: 'committed', index: 0 });
        return { rows: [] };
      }
      if (successorGuards.has(sql)) {
        assert.deepEqual(cursor, {
          state: 'committed',
          index: successorGuards.get(sql),
        });
        return { rows: [] };
      }
      return { rows: [] };
    }
  }
  return { calls, ClientClass: FakeClient, sources };
}

test('production migration resumes a committed foundation without replaying it', async () => {
  const cursor = { state: 'absent' };
  const fake = await createProductionMigrationStatefulFake({
    cursor,
    failAfterCommitId: 'foundation',
  });
  const first = receiptCapture();
  await assert.rejects(
    runDr133ProductionMigration({
      environment: productionMigrationEnvironment('migration'),
      ClientClass: fake.ClientClass,
      output: first.stream,
    }),
    (error) => error instanceof Dr133RunnerError && error.code === 'POSTGRES_08006',
  );
  assert.equal(first.receipt().result, 'FOUNDATION_OUTCOME_UNKNOWN');
  assert.deepEqual(cursor, { state: 'foundation' });

  const retry = receiptCapture();
  assert.deepEqual(await runDr133ProductionMigration({
    environment: productionMigrationEnvironment('migration'),
    ClientClass: fake.ClientClass,
    output: retry.stream,
  }), { result: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED' });
  assert.equal(retry.receipt().result, 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED');
  for (const { id, purpose } of DR133_ARTIFACTS) {
    if (purpose.startsWith('forward')) {
      assert.equal(fake.calls.filter(({ sql }) => sql === fake.sources.get(id)).length, 1, id);
    }
  }
});

test('production migration skips exact committed base/successor artifacts and rejects foreign cursors', async () => {
  for (const cursor of [
    { state: 'foundation' },
    ...Array.from(
      { length: DR133_SUCCESSOR_STAGES.length + 1 },
      (_, index) => ({ state: 'committed', index }),
    ),
  ]) {
    const initial = { ...cursor };
    const fake = await createProductionMigrationStatefulFake({ cursor });
    const capture = receiptCapture();
    await runDr133ProductionMigration({
      environment: productionMigrationEnvironment('migration'),
      ClientClass: fake.ClientClass,
      output: capture.stream,
    });
    assert.equal(
      fake.calls.some(({ sql }) => sql === fake.sources.get('foundation')),
      initial.state === 'absent',
    );
    assert.equal(
      fake.calls.some(({ sql }) => sql === fake.sources.get('rls')),
      initial.state === 'foundation',
    );
    if (initial.state === 'committed') {
      for (let index = 0; index < DR133_SUCCESSOR_STAGES.length; index += 1) {
        const id = DR133_SUCCESSOR_STAGES[index].id;
        assert.equal(
          fake.calls.filter(({ sql }) => sql === fake.sources.get(id)).length,
          index < initial.index ? 0 : 1,
          id,
        );
      }
    }
  }

  for (const rowOverrides of [
    { schema_sentinel: 'foreign' },
    { lor_role_count: '1' },
  ]) {
    const foreign = { state: 'foreign' };
    const fake = await createProductionMigrationStatefulFake({ cursor: foreign });
    const output = receiptCapture();
    await assert.rejects(runDr133ProductionMigration({
      environment: productionMigrationEnvironment('migration'),
      ClientClass: class extends fake.ClientClass {
        async query(input, values) {
          const sql = typeof input === 'string' ? input : input?.text;
          if (sql === DR133_SUCCESSOR_PREFLIGHT_SQL) {
            return { rows: [{
              ...productionCursorRow({ state: 'absent' }),
              ...rowOverrides,
            }] };
          }
          return await super.query(input, values);
        }
      },
      output: output.stream,
    }), (error) => error?.code === 'PRODUCTION_SCHEMA_CURSOR_INVALID');
    assert.equal(output.receipt().result, 'NO_MUTATION');
    assert.equal(
      DR133_ARTIFACTS.filter(({ purpose }) => purpose.startsWith('forward')).some(
        ({ id }) => fake.calls.some(({ sql }) => sql === fake.sources.get(id)),
      ),
      false,
    );
  }
});

test('successor migration and schema verifier resume the exact next stage directly', async () => {
  const cursor = { state: 'committed', index: 2 };
  const failedId = DR133_SUCCESSOR_STAGES[2].id;
  const fake = await createProductionMigrationStatefulFake({
    cursor,
    failAfterCommitId: failedId,
  });
  await assert.rejects(runDr133ProductionSuccessorMigration({
    environment: productionMigrationEnvironment('successor-migration'),
    ClientClass: fake.ClientClass,
    output: receiptCapture().stream,
  }), (error) => error?.code === 'POSTGRES_08006');
  assert.deepEqual(cursor, { state: 'committed', index: 3 });

  assert.deepEqual(await runDr133ProductionSuccessorMigration({
    environment: productionMigrationEnvironment('successor-migration'),
    ClientClass: fake.ClientClass,
    output: receiptCapture().stream,
  }), { result: 'SUCCESSOR_COMMITTED_VERIFIED' });
  for (let index = 0; index < DR133_SUCCESSOR_STAGES.length; index += 1) {
    const id = DR133_SUCCESSOR_STAGES[index].id;
    const expectedCount = index < 2 ? 0 : 1;
    assert.equal(fake.calls.filter(({ sql }) => sql === fake.sources.get(id)).length, expectedCount, id);
  }

  assert.deepEqual(await verifyDr133ProductionSuccessorSchema({
    environment: productionMigrationEnvironment('schema-verifier'),
    ClientClass: fake.ClientClass,
    output: receiptCapture().stream,
  }), { result: 'SCHEMA_VERIFIED_NO_MUTATION' });
});

function productionPostgresBinaries(root) {
  return Object.freeze({
    initdb: `${root}/initdb`,
    pgCtl: `${root}/pg_ctl`,
    createdb: `${root}/createdb`,
    psql: `${root}/psql`,
  });
}

function approvedProductionPrivateIpv4Address() {
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
  assert.ok(selected, 'an approved private IPv4 address is required for the DR-133 guard');
  return selected.address;
}

function assertSafePostgresConfigLiteral(value) {
  assert.equal(typeof value, 'string');
  assert.equal(value.includes("'"), false);
  assert.equal(/[\r\n\0]/u.test(value), false);
  return value;
}

async function enableProductionDisposablePrivateTls(harness, binaries, privateHost) {
  const description = harness.describe();
  const dataDirectory = path.join(description.tempRoot, 'd');
  const caCertificatePath = path.join(dataDirectory, 'dr133-production-test-ca.crt');
  const caPrivateKeyPath = path.join(dataDirectory, 'dr133-production-test-ca.key');
  const certificatePath = path.join(dataDirectory, 'dr133-production-test-server.crt');
  const certificateRequestPath = path.join(dataDirectory, 'dr133-production-test-server.csr');
  const privateKeyPath = path.join(dataDirectory, 'dr133-production-test-server.key');
  for (const value of [
    dataDirectory,
    caCertificatePath,
    caPrivateKeyPath,
    certificatePath,
    certificateRequestPath,
    privateKeyPath,
    privateHost,
  ]) assertSafePostgresConfigLiteral(value);

  await access('/opt/homebrew/bin/openssl');
  await execFile('/opt/homebrew/bin/openssl', [
    'req', '-new', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '1', '-sha256',
    '-subj', '/CN=MissionMed DR133 Production Disposable Test CA',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-keyout', caPrivateKeyPath,
    '-out', caCertificatePath,
  ], { timeout: 15_000, maxBuffer: 64 * 1024 });
  await execFile('/opt/homebrew/bin/openssl', [
    'req', '-new', '-nodes', '-newkey', 'rsa:2048', '-sha256',
    '-subj', `/CN=${privateHost}`,
    '-addext', `subjectAltName=DNS:${DR133_TARGET.databaseHost},IP:${privateHost}`,
    '-keyout', privateKeyPath,
    '-out', certificateRequestPath,
  ], { timeout: 15_000, maxBuffer: 64 * 1024 });
  await execFile('/opt/homebrew/bin/openssl', [
    'x509', '-req', '-in', certificateRequestPath,
    '-CA', caCertificatePath,
    '-CAkey', caPrivateKeyPath,
    '-CAcreateserial', '-days', '1', '-sha256', '-copy_extensions', 'copy',
    '-out', certificatePath,
  ], { timeout: 15_000, maxBuffer: 64 * 1024 });
  await chmod(caPrivateKeyPath, 0o600);
  await chmod(caCertificatePath, 0o600);
  await chmod(privateKeyPath, 0o600);
  await chmod(certificatePath, 0o600);

  const databaseCa = new X509Certificate(await readFile(caCertificatePath, 'utf8'));
  const serverCertificate = new X509Certificate(await readFile(certificatePath, 'utf8'));
  assert.equal(databaseCa.ca, true);
  assert.equal(databaseCa.checkIssued(databaseCa), true);
  assert.equal(databaseCa.verify(databaseCa.publicKey), true);
  assert.equal(serverCertificate.ca, false);
  assert.equal(serverCertificate.checkIssued(databaseCa), true);
  assert.equal(serverCertificate.verify(databaseCa.publicKey), true);
  assert.equal(serverCertificate.checkIP(privateHost), privateHost);

  await appendFile(path.join(dataDirectory, 'postgresql.conf'), `
# DR-133 disposable production-entrypoint test. Harness root is removed on stop.
listen_addresses = '${privateHost}'
ssl = on
ssl_cert_file = '${certificatePath}'
ssl_key_file = '${privateKeyPath}'
`);
  await appendFile(
    path.join(dataDirectory, 'pg_hba.conf'),
    `\nhostssl all all ${privateHost}/32 trust\n`,
  );
  await execFile(binaries.pgCtl, [
    'restart',
    '-D', dataDirectory,
    '-l', path.join(description.tempRoot, 'postgres.log'),
    '-w',
    '-t', '30',
  ], { timeout: 35_000, maxBuffer: 64 * 1024 });
  return databaseCa.toString();
}

async function bootstrapProductionDisposableDatabase(harness) {
  const harnessOptions = harness.connectionOptions();
  let client;
  try {
    client = new RealPgClient(harnessOptions);
    await client.connect();
    await client.query('CREATE ROLE dr133_production_role_renamer LOGIN SUPERUSER');
    await client.end();
    client = new RealPgClient({
      ...harnessOptions,
      user: 'dr133_production_role_renamer',
    });
    await client.connect();
    await client.query(
      `ALTER ROLE "${harness.describe().administrativeRole}" RENAME TO postgres`,
    );
    await client.end();
    client = new RealPgClient({ ...harnessOptions, user: 'postgres' });
    await client.connect();
    await client.query('DROP ROLE dr133_production_role_renamer');
    await client.query('CREATE DATABASE railway OWNER postgres');
  } finally {
    await client?.end().catch(() => {});
  }
}

function createProductionPrivateTlsClientClass({
  databaseCa,
  failureSql = null,
  host,
  port,
}) {
  const queries = [];
  const failures = [];
  let failureConsumed = false;
  class PrivateTlsClient extends RealPgClient {
    constructor(options) {
      const parsed = new URL(options.connectionString);
      assert.equal(options.enableChannelBinding, true);
      super({
        host,
        port,
        database: DR133_TARGET.databaseName,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        ssl: {
          ca: databaseCa,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          servername: DR133_TARGET.databaseHost,
        },
        enableChannelBinding: true,
        application_name: options.application_name,
        connectionTimeoutMillis: options.connectionTimeoutMillis,
      });
      this.failureClosed = false;
    }

    async query(input, values) {
      const sql = typeof input === 'string' ? input : input?.text;
      let result;
      try {
        result = await super.query(input, values);
      } catch (error) {
        failures.push({ code: error?.code, message: error?.message });
        throw error;
      }
      queries.push(sql);
      if (!failureConsumed && failureSql !== null && sql === failureSql) {
        failureConsumed = true;
        this.failureClosed = true;
        await super.end();
        throw Object.assign(new Error('secret-free simulated disconnect'), { code: '08006' });
      }
      return result;
    }

    async end() {
      if (this.failureClosed) return;
      return await super.end();
    }
  }
  return Object.freeze({ ClientClass: PrivateTlsClient, failures, queries });
}

async function configureProductionTargetGucs(client) {
  for (const [name, value] of targetGucEntries()) {
    const result = await client.query(
      'SELECT pg_catalog.set_config($1, $2, false) AS configured_value',
      [name, value],
    );
    assert.equal(result.rows[0].configured_value, value);
  }
}

const STORAGE_REGEX_CASE_ID = 'case_dr133_storage_regex_matrix';
const STORAGE_REGEX_STUDENT_SUBJECT = 'wp:9001';
const STORAGE_REGEX_STUDENT_UID = '90010000-0000-4000-8000-000000000001';

async function expectStorageRegexError(client, expectedCode, operation) {
  await client.query('SAVEPOINT storage_regex_expected_failure');
  try {
    await assert.rejects(operation, (error) => error?.code === expectedCode);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT storage_regex_expected_failure');
    await client.query('RELEASE SAVEPOINT storage_regex_expected_failure');
  }
}

async function provePrivateStorageObjectIdValidation(client) {
  const objectId300 = 'a'.repeat(300);
  const objectId301 = 'a'.repeat(301);
  const studentCase = createStudentSafeRecommendationCase({
    id: STORAGE_REGEX_CASE_ID,
    studentId: STORAGE_REGEX_STUDENT_SUBJECT,
    actorId: STORAGE_REGEX_STUDENT_SUBJECT,
    builderSessionId: 'builder_dr133_storage_regex_matrix',
    now: '2026-08-26T00:00:00.000Z',
  }).state;
  const studentSafeRecord = {
    builder: studentCase.builder,
    studentEvidence: studentCase.studentEvidence,
    applicantOptions: studentCase.applicantOptions,
    delivery: studentCase.delivery,
  };
  const contentHash = 'c'.repeat(64);
  const requestHash = 'd'.repeat(64);
  const aadHash = 'e'.repeat(64);
  const storageRef = 'f'.repeat(64);
  const actorRef = `actor_${'1'.repeat(64)}`;
  const versionId = `version_${'2'.repeat(64)}`;
  const salt = Buffer.alloc(32, 1);
  const iv = Buffer.alloc(12, 2);
  const authTag = Buffer.alloc(16, 3);
  const ciphertext = Buffer.from('a');

  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    await client.query(
      `SELECT pg_catalog.set_config('lor_studio.actor_role', 'student', true)`,
    );
    await client.query({
      text: `INSERT INTO lor_studio.student_auth_bindings (
          binding_id, student_auth_subject, student_auth_uid, binding_source,
          source_reference_hash, proof_hash, bound_at
        ) VALUES (
          'binding_dr133_storage_regex_matrix', $1, $2::uuid,
          'wordpress_verified_bootstrap', $3, $4,
          pg_catalog.transaction_timestamp() - interval '1 second'
        )`,
      values: [
        STORAGE_REGEX_STUDENT_SUBJECT,
        STORAGE_REGEX_STUDENT_UID,
        'a'.repeat(64),
        'b'.repeat(64),
      ],
    });
    await client.query({
      text: `INSERT INTO lor_studio.recommendation_cases (
          case_id, student_auth_subject, student_auth_uid, revision, status,
          created_at, updated_at, closed_at, record, record_hash,
          protected_state_hash
        ) VALUES (
          $1, $2, $3::uuid, 0, 'draft', $4::timestamptz, $4::timestamptz,
          NULL, $5::jsonb, lor_studio.canonical_jsonb_sha256($5::jsonb),
          lor_studio.canonical_jsonb_sha256(
            pg_catalog.jsonb_build_object('caseId', $1::text, 'revision', 0)
          )
        )`,
      values: [
        STORAGE_REGEX_CASE_ID,
        STORAGE_REGEX_STUDENT_SUBJECT,
        STORAGE_REGEX_STUDENT_UID,
        studentCase.createdAt,
        studentSafeRecord,
      ],
    });

    const insertArtifact = (objectId, suffix) => client.query({
      text: `INSERT INTO lor_studio.private_artifact_versions (
          case_id, student_auth_subject, object_id, version_id, private_object_key,
          content_class, purpose, content_type, content_hash, plaintext_byte_length,
          idempotency_key, request_hash, created_by_actor_ref, storage_identity_ref,
          encryption_profile, encryption_key_version, hkdf_salt, aes_gcm_iv,
          aes_gcm_auth_tag, ciphertext, aad_hash, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'student_prepared', 'case_workflow',
          'text/plain', $6, 1, $7, $8, $9, $10,
          'aes-256-gcm+hkdf-sha256.v1', 'railway-kek-2026-08-v1',
          $11, $12, $13, $14, $15, pg_catalog.transaction_timestamp()
        )`,
      values: [
        STORAGE_REGEX_CASE_ID,
        STORAGE_REGEX_STUDENT_SUBJECT,
        objectId,
        `version_${suffix.repeat(64)}`,
        `cases/${STORAGE_REGEX_CASE_ID}/${suffix}`,
        contentHash,
        `storage-regex-${suffix}`,
        requestHash,
        actorRef,
        storageRef,
        salt,
        iv,
        authTag,
        ciphertext,
        aadHash,
      ],
    });

    await insertArtifact(objectId300, '3');
    const boundary = await client.query({
      text: `SELECT pg_catalog.length(object_id)::integer AS object_id_length
        FROM lor_studio.private_artifact_versions
        WHERE case_id = $1 AND object_id = $2`,
      values: [STORAGE_REGEX_CASE_ID, objectId300],
    });
    assert.deepEqual(boundary.rows[0], { object_id_length: 300 });
    await expectStorageRegexError(client, '23514', () => insertArtifact(objectId301, '4'));

    const putValues = (objectId) => [
      STORAGE_REGEX_STUDENT_SUBJECT,
      'student',
      STORAGE_REGEX_CASE_ID,
      objectId,
      `cases/${STORAGE_REGEX_CASE_ID}/command`,
      'student_prepared',
      'case_workflow',
      'text/plain',
      contentHash,
      1,
      'storage-regex-command',
      requestHash,
      'railway-postgres:lor-private-artifacts:v1',
      'railway-kek-2026-08-v1',
      `capability_${'5'.repeat(64)}`,
      `evidence_${'6'.repeat(64)}`,
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
      aadHash,
    ];
    const invokePut = async (objectId) => {
      await client.query('SET LOCAL ROLE lor_studio_app');
      return client.query({
        text: `SELECT lor_studio.put_encrypted_private_artifact_version(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        ) AS result`,
        values: putValues(objectId),
      });
    };
    const invokeGet = async (objectId) => {
      await client.query('SET LOCAL ROLE lor_studio_app');
      return client.query({
        text: `SELECT lor_studio.get_encrypted_private_artifact_version(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        ) AS result`,
        values: [
          STORAGE_REGEX_STUDENT_SUBJECT,
          'student',
          STORAGE_REGEX_CASE_ID,
          objectId,
          versionId,
          `cases/${STORAGE_REGEX_CASE_ID}/command`,
          'student_prepared',
          'case_workflow',
          'railway-postgres:lor-private-artifacts:v1',
          `capability_${'5'.repeat(64)}`,
          `evidence_${'6'.repeat(64)}`,
        ],
      });
    };

    await expectStorageRegexError(client, 'P1501', () => invokePut(objectId300));
    await expectStorageRegexError(client, 'P1505', () => invokePut(objectId301));
    await expectStorageRegexError(client, 'P1501', () => invokeGet(objectId300));
    await expectStorageRegexError(client, 'P1505', () => invokeGet(objectId301));
  } finally {
    await client.query('ROLLBACK');
  }
}

const MENTOR_COMMAND_CASE_ID = 'case_dr133_mentor_command_matrix';
const MENTOR_COMMAND_STUDENT_SUBJECT = 'wp:9101';
const MENTOR_COMMAND_STUDENT_UID = '91010000-0000-4000-8000-000000000001';
const MENTOR_COMMAND_MENTOR_SUBJECT = 'wp:9102';

async function configureMentorCommandContext(client, {
  assignmentId = '',
  operation,
  studentAuthSubject = MENTOR_COMMAND_STUDENT_SUBJECT,
  caseId = MENTOR_COMMAND_CASE_ID,
} = {}) {
  await client.query('SET LOCAL ROLE lor_studio_app');
  await client.query({
    text: `SELECT
      pg_catalog.set_config('request.jwt.claim.sub', $1, true),
      pg_catalog.set_config('lor_studio.student_auth_subject', $2, true),
      pg_catalog.set_config('lor_studio.actor_role', $3, true),
      pg_catalog.set_config('lor_studio.resource_student_id', $4, true),
      pg_catalog.set_config('lor_studio.case_id', $5, true),
      pg_catalog.set_config('lor_studio.operation', $6, true),
      pg_catalog.set_config('lor_studio.purpose', $7, true),
      pg_catalog.set_config('lor_studio.invitation_id', $8, true),
      pg_catalog.set_config('lor_studio.assignment_id', $9, true),
      pg_catalog.set_config('lor_studio.administrative_grant_id', $10, true),
      pg_catalog.set_config('lor_studio.entitlement_verified', $11, true),
      pg_catalog.set_config('lor_studio.lor_enabled', $12, true),
      pg_catalog.set_config('lor_studio.canary_authorized', $13, true),
      pg_catalog.set_config('lor_studio.trusted_service_actor', $14, true),
      pg_catalog.set_config('lor_studio.identity_resolution_verified', $15, true)`,
    values: [
      '', 'service:lor-mentor-assignment-operator-v1', 'service',
      studentAuthSubject, caseId, operation, 'mentor_assignment_administration',
      '', assignmentId, '', 'true', 'true', 'true',
      'lor-mentor-assignment-operator-v1', 'true',
    ],
  });
}

async function invokeMentorAssignment(client, {
  caseId = MENTOR_COMMAND_CASE_ID,
  studentAuthSubject = MENTOR_COMMAND_STUDENT_SUBJECT,
  mentorAuthSubject = MENTOR_COMMAND_MENTOR_SUBJECT,
  purpose = 'mentor_case_read',
  maximumLifetimeSeconds = 3_600,
  idempotencyKey = 'mentor-command-assign-one',
} = {}) {
  await configureMentorCommandContext(client, {
    caseId,
    operation: 'assign_mentor_case',
    studentAuthSubject,
  });
  const result = await client.query({
    text: `SELECT lor_studio.assign_mentor_to_case($1, $2, $3, $4, $5, $6) AS result`,
    values: [
      caseId, studentAuthSubject, mentorAuthSubject, purpose,
      maximumLifetimeSeconds, idempotencyKey,
    ],
  });
  await client.query('RESET ROLE');
  return result.rows[0].result;
}

async function invokeMentorRevocation(client, {
  assignmentId,
  caseId = MENTOR_COMMAND_CASE_ID,
  studentAuthSubject = MENTOR_COMMAND_STUDENT_SUBJECT,
  reasonCode = 'OPERATOR_REVOKED',
  idempotencyKey = 'mentor-command-revoke-one',
} = {}) {
  await configureMentorCommandContext(client, {
    assignmentId,
    caseId,
    operation: 'revoke_mentor_assignment',
    studentAuthSubject,
  });
  const result = await client.query({
    text: `SELECT lor_studio.revoke_mentor_case_assignment($1, $2, $3, $4, $5) AS result`,
    values: [caseId, studentAuthSubject, assignmentId, reasonCode, idempotencyKey],
  });
  await client.query('RESET ROLE');
  return result.rows[0].result;
}

async function expectMentorCommandError(client, expectedCode, operation) {
  await client.query('SAVEPOINT mentor_command_expected_failure');
  try {
    await assert.rejects(operation, (error) => error?.code === expectedCode);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT mentor_command_expected_failure');
    await client.query('RELEASE SAVEPOINT mentor_command_expected_failure');
  }
}

async function proveMentorAssignmentCommands(client) {
  const studentCase = createStudentSafeRecommendationCase({
    id: MENTOR_COMMAND_CASE_ID,
    studentId: MENTOR_COMMAND_STUDENT_SUBJECT,
    actorId: MENTOR_COMMAND_STUDENT_SUBJECT,
    builderSessionId: 'builder_dr133_mentor_command_matrix',
    now: '2026-08-26T00:00:00.000Z',
  }).state;
  const studentSafeRecord = {
    builder: studentCase.builder,
    studentEvidence: studentCase.studentEvidence,
    applicantOptions: studentCase.applicantOptions,
    delivery: studentCase.delivery,
  };

  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    await client.query(
      `SELECT pg_catalog.set_config('lor_studio.actor_role', 'student', true)`,
    );
    await client.query({
      text: `INSERT INTO lor_studio.student_auth_bindings (
          binding_id, student_auth_subject, student_auth_uid, binding_source,
          source_reference_hash, proof_hash, bound_at
        ) VALUES (
          'binding_dr133_mentor_command_matrix', $1, $2::uuid,
          'wordpress_verified_bootstrap', $3, $4,
          pg_catalog.transaction_timestamp() - interval '1 second'
        )`,
      values: [
        MENTOR_COMMAND_STUDENT_SUBJECT,
        MENTOR_COMMAND_STUDENT_UID,
        'a'.repeat(64),
        'b'.repeat(64),
      ],
    });
    await client.query({
      text: `INSERT INTO lor_studio.recommendation_cases (
          case_id, student_auth_subject, student_auth_uid, revision, status,
          created_at, updated_at, closed_at, record, record_hash,
          protected_state_hash
        ) VALUES (
          $1, $2, $3::uuid, 0, 'draft', $4::timestamptz, $4::timestamptz,
          NULL, $5::jsonb, lor_studio.canonical_jsonb_sha256($5::jsonb),
          lor_studio.canonical_jsonb_sha256(
            pg_catalog.jsonb_build_object('caseId', $1::text, 'revision', 0)
          )
        )`,
      values: [
        MENTOR_COMMAND_CASE_ID,
        MENTOR_COMMAND_STUDENT_SUBJECT,
        MENTOR_COMMAND_STUDENT_UID,
        studentCase.createdAt,
        studentSafeRecord,
      ],
    });

    const privileges = await client.query(`SELECT
      pg_catalog.has_function_privilege(
        'lor_studio_app',
        'lor_studio.assign_mentor_to_case(text,text,text,text,integer,text)',
        'EXECUTE'
      ) AS app_assign_execute,
      pg_catalog.has_function_privilege(
        'lor_studio_app',
        'lor_studio.revoke_mentor_case_assignment(text,text,text,text,text)',
        'EXECUTE'
      ) AS app_revoke_execute,
      pg_catalog.has_function_privilege(
        'lor_studio_app',
        'lor_studio.mentor_assignment_command_context_allows(text,text,text,text)',
        'EXECUTE'
      ) AS app_context_execute,
      pg_catalog.has_table_privilege(
        'lor_studio_app', 'lor_studio.mentor_case_assignments', 'INSERT'
      ) AS app_assignment_insert,
      pg_catalog.has_table_privilege(
        'lor_studio_app', 'lor_studio.mentor_case_assignment_revocations', 'INSERT'
      ) AS app_revocation_insert`);
    assert.deepEqual(privileges.rows[0], {
      app_assign_execute: true,
      app_revoke_execute: true,
      app_context_execute: false,
      app_assignment_insert: false,
      app_revocation_insert: false,
    });

    const assigned = await invokeMentorAssignment(client);
    assert.equal(assigned.action, 'mentor.assignment_issued');
    assert.equal(assigned.committed, true);
    assert.equal(assigned.replayed, false);
    assert.equal(assigned.caseId, MENTOR_COMMAND_CASE_ID);
    assert.equal(assigned.studentAuthSubject, MENTOR_COMMAND_STUDENT_SUBJECT);
    assert.equal(assigned.mentorAuthSubject, MENTOR_COMMAND_MENTOR_SUBJECT);
    assert.equal(assigned.operation, 'read');
    assert.equal(Date.parse(assigned.expiresAt) - Date.parse(assigned.assignedAt), 3_600_000);
    assert.match(assigned.assignmentHash, /^[a-f0-9]{64}$/u);
    assert.match(assigned.eventHash, /^[a-f0-9]{64}$/u);

    const replay = await invokeMentorAssignment(client);
    assert.deepEqual(replay, { ...assigned, replayed: true });
    await expectMentorCommandError(
      client,
      'P1602',
      () => invokeMentorAssignment(client, { maximumLifetimeSeconds: 7_200 }),
    );
    await expectMentorCommandError(
      client,
      'P1604',
      () => invokeMentorAssignment(client, {
        idempotencyKey: 'mentor-command-assign-active-duplicate',
      }),
    );
    await expectMentorCommandError(
      client,
      'P1601',
      () => invokeMentorAssignment(client, { studentAuthSubject: 'wp:9999' }),
    );

    const revoked = await invokeMentorRevocation(client, {
      assignmentId: assigned.assignmentId,
    });
    assert.equal(revoked.action, 'mentor.assignment_revoked');
    assert.equal(revoked.committed, true);
    assert.equal(revoked.replayed, false);
    assert.match(revoked.revocationHash, /^[a-f0-9]{64}$/u);
    const revokeReplay = await invokeMentorRevocation(client, {
      assignmentId: assigned.assignmentId,
    });
    assert.deepEqual(revokeReplay, { ...revoked, replayed: true });
    await expectMentorCommandError(
      client,
      'P1602',
      () => invokeMentorRevocation(client, {
        assignmentId: assigned.assignmentId,
        idempotencyKey: 'mentor-command-revoke-conflict',
      }),
    );

    const reassigned = await invokeMentorAssignment(client, {
      idempotencyKey: 'mentor-command-assign-after-revocation',
    });
    assert.notEqual(reassigned.assignmentId, assigned.assignmentId);
    assert.equal(reassigned.replayed, false);

    const custody = await client.query({
      text: `SELECT
        (SELECT pg_catalog.count(*)::integer
           FROM lor_studio.mentor_case_assignments
          WHERE case_id = $1 AND student_auth_subject = $2) AS assignment_count,
        (SELECT pg_catalog.count(*)::integer
           FROM lor_studio.mentor_case_assignment_revocations
          WHERE case_id = $1 AND student_auth_subject = $2) AS revocation_count,
        (SELECT pg_catalog.count(*)::integer
           FROM lor_studio.recommendation_case_audit_events
          WHERE case_id = $1 AND student_auth_subject = $2
            AND event_type = 'mentor.assignment_issued'
            AND event_hash = lor_studio.canonical_jsonb_sha256(event)) AS issued_audit_count,
        (SELECT pg_catalog.count(*)::integer
           FROM lor_studio.recommendation_case_audit_events
          WHERE case_id = $1 AND student_auth_subject = $2
            AND event_type = 'mentor.assignment_revoked'
            AND event_hash = lor_studio.canonical_jsonb_sha256(event)) AS revoked_audit_count`,
      values: [MENTOR_COMMAND_CASE_ID, MENTOR_COMMAND_STUDENT_SUBJECT],
    });
    assert.deepEqual(custody.rows[0], {
      assignment_count: 2,
      revocation_count: 1,
      issued_audit_count: 2,
      revoked_audit_count: 1,
    });
  } finally {
    await client.query('ROLLBACK');
  }
}

test('production entrypoints recover exact interruption cursors on disposable PostgreSQL 16/18', {
  skip: !RUN_REAL_POSTGRES_MATRIX,
}, async (parent) => {
  const sources = new Map();
  for (const artifact of DR133_ARTIFACTS) {
    sources.set(
      artifact.id,
      await readFile(path.join(scriptDirectory, artifact.relativePath), 'utf8'),
    );
  }
  const privateHost = approvedProductionPrivateIpv4Address();

  for (const toolchain of POSTGRES_TOOLCHAINS) {
    await parent.test(`PostgreSQL ${toolchain.major}`, async () => {
      const binaries = productionPostgresBinaries(toolchain.root);
      await Promise.all(Object.values(binaries).map((binary) => access(binary)));
      const harness = createDisposablePostgresHarness({
        binaries,
        startupTimeoutMs: 30_000,
        shutdownTimeoutMs: 15_000,
      });
      let inspector;
      let running = false;
      try {
        await harness.start();
        running = true;
        const databaseCa = await enableProductionDisposablePrivateTls(
          harness,
          binaries,
          privateHost,
        );
        await bootstrapProductionDisposableDatabase(harness);
        const clientOptions = {
          databaseCa,
          host: privateHost,
          port: harness.describe().port,
        };

        inspector = new RealPgClient({
          host: privateHost,
          port: harness.describe().port,
          database: DR133_TARGET.databaseName,
          user: DR133_TARGET.databaseAdmin,
          ssl: {
            ca: databaseCa,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            servername: DR133_TARGET.databaseHost,
          },
          enableChannelBinding: true,
        });
        await inspector.connect();
        await inspector.query('CREATE ROLE lor_studio_intruder NOLOGIN');
        try {
          const intruderClient = createProductionPrivateTlsClientClass(clientOptions);
          const intruderFailure = receiptCapture();
          await assert.rejects(runDr133ProductionMigration({
            environment: productionMigrationEnvironment('migration'),
            ClientClass: intruderClient.ClientClass,
            output: intruderFailure.stream,
          }), (error) => error?.code === 'PRODUCTION_SCHEMA_CURSOR_INVALID');
          assert.equal(intruderFailure.receipt().result, 'NO_MUTATION');
          assert.equal(
            DR133_ARTIFACTS.filter(({ purpose }) => purpose.startsWith('forward')).some(
              ({ id }) => intruderClient.queries.includes(sources.get(id)),
            ),
            false,
          );
          const schema = await inspector.query(
            `SELECT pg_catalog.count(*)::text AS schema_count
             FROM pg_catalog.pg_namespace
             WHERE nspname = 'lor_studio'`,
          );
          assert.equal(schema.rows[0].schema_count, '0');
        } finally {
          await inspector.query('DROP ROLE lor_studio_intruder');
        }

        const migrationClient = createProductionPrivateTlsClientClass({
          ...clientOptions,
          failureSql: sources.get('foundation'),
        });
        const migrationFailure = receiptCapture();
        await assert.rejects(runDr133ProductionMigration({
          environment: productionMigrationEnvironment('migration'),
          ClientClass: migrationClient.ClientClass,
          output: migrationFailure.stream,
        }), (error) => error?.code === 'POSTGRES_08006');
        assert.equal(migrationFailure.receipt().result, 'FOUNDATION_OUTCOME_UNKNOWN');
        let recoveredMigration;
        try {
          recoveredMigration = await runDr133ProductionMigration({
            environment: productionMigrationEnvironment('migration'),
            ClientClass: migrationClient.ClientClass,
            output: receiptCapture().stream,
          });
        } catch (error) {
          const completedArtifacts = DR133_ARTIFACTS
            .filter(({ purpose }) => purpose.startsWith('forward'))
            .filter(({ id }) => migrationClient.queries.includes(sources.get(id)))
            .map(({ id }) => id);
          const firstFailure = migrationClient.failures.find(({ code }) => code === '55000')
            ?? migrationClient.failures.at(-1);
          throw new Error(
            `production migration failed after: ${completedArtifacts.join(',')}; ${
              firstFailure?.code ?? 'UNKNOWN'
            }/${firstFailure?.message ?? 'unknown'}`,
            { cause: error },
          );
        }
        assert.deepEqual(recoveredMigration, {
          result: 'CUMULATIVE_SCHEMA_COMMITTED_VERIFIED',
        });
        assert.equal(
          migrationClient.queries.filter((sql) => sql === sources.get('foundation')).length,
          1,
        );
        const lock = await inspector.query(DR133_ADVISORY_LOCK_SQL);
        assert.equal(lock.rows[0].acquired, true);
        try {
          await configureProductionTargetGucs(inspector);
          for (let index = DR133_SUCCESSOR_STAGES.length - 1; index >= 2; index -= 1) {
            await inspector.query(sources.get(DR133_SUCCESSOR_STAGES[index].rollbackId));
          }
        } finally {
          const unlock = await inspector.query(DR133_ADVISORY_UNLOCK_SQL);
          assert.equal(unlock.rows[0].released, true);
        }
        const partial = await inspector.query(DR133_SUCCESSOR_PREFLIGHT_SQL);
        assert.equal(partial.rows[0].schema_sentinel, expectedDr133SuccessorSentinelAt(2));

        const failedSuccessorId = DR133_SUCCESSOR_STAGES[2].id;
        const successorClient = createProductionPrivateTlsClientClass({
          ...clientOptions,
          failureSql: sources.get(failedSuccessorId),
        });
        const successorFailure = receiptCapture();
        await assert.rejects(runDr133ProductionSuccessorMigration({
          environment: productionMigrationEnvironment('successor-migration'),
          ClientClass: successorClient.ClientClass,
          output: successorFailure.stream,
        }), (error) => error?.code === 'POSTGRES_08006');
        assert.equal(successorFailure.receipt().result, 'SUCCESSOR_NEXT_STEP_OUTCOME_UNKNOWN');
        assert.deepEqual(await runDr133ProductionSuccessorMigration({
          environment: productionMigrationEnvironment('successor-migration'),
          ClientClass: successorClient.ClientClass,
          output: receiptCapture().stream,
        }), { result: 'SUCCESSOR_COMMITTED_VERIFIED' });
        assert.equal(
          successorClient.queries.filter((sql) => sql === sources.get(failedSuccessorId)).length,
          1,
        );
        assert.deepEqual(await verifyDr133ProductionSuccessorSchema({
          environment: productionMigrationEnvironment('schema-verifier'),
          ClientClass: successorClient.ClientClass,
          output: receiptCapture().stream,
        }), { result: 'SCHEMA_VERIFIED_NO_MUTATION' });

        await provePrivateStorageObjectIdValidation(inspector);
        await proveMentorAssignmentCommands(inspector);

        const failedRollbackId = 'ai-proposal-rollback';
        const rollbackClient = createProductionPrivateTlsClientClass({
          ...clientOptions,
          failureSql: sources.get(failedRollbackId),
        });
        const rollbackFailure = receiptCapture();
        await assert.rejects(runDr133ProductionRollbackDrill({
          environment: productionMigrationEnvironment('rollback-drill'),
          ClientClass: rollbackClient.ClientClass,
          output: rollbackFailure.stream,
        }), (error) => error?.code === 'POSTGRES_08006');
        assert.equal(rollbackFailure.receipt().result, 'ROLLBACK_PROGRESS_OUTCOME_UNKNOWN');
        const rollbackSuccess = receiptCapture();
        let recoveredRollback;
        try {
          recoveredRollback = await runDr133ProductionRollbackDrill({
            environment: productionMigrationEnvironment('rollback-drill'),
            ClientClass: rollbackClient.ClientClass,
            output: rollbackSuccess.stream,
          });
        } catch (error) {
          const completedRollbacks = DR133_ARTIFACTS
            .filter(({ relativePath }) => relativePath.startsWith('rollbacks/'))
            .filter(({ id }) => rollbackClient.queries.includes(sources.get(id)))
            .map(({ id }) => id);
          const catalogFailure = rollbackClient.failures.find(({ code }) => code === '55000')
            ?? rollbackClient.failures.at(-1);
          throw new Error(
            `production rollback failed after: ${completedRollbacks.join(',')}; ${
              catalogFailure?.code ?? 'UNKNOWN'
            }/${catalogFailure?.message ?? 'unknown'}`,
            { cause: error },
          );
        }
        assert.deepEqual(recoveredRollback, {
          result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED',
        });
        assert.equal(rollbackSuccess.receipt().rollbackCount, 11);
        for (const rollbackId of [
          ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => stage.rollbackId),
          'rls-rollback',
          'foundation-rollback',
        ]) {
          assert.equal(
            rollbackClient.queries.filter((sql) => sql === sources.get(rollbackId)).length,
            1,
            rollbackId,
          );
        }
        const absent = await inspector.query(DR133_ROLLBACK_DRILL_ABSENCE_SQL);
        assert.deepEqual(absent.rows[0], { schema_count: '0', role_count: '0' });
      } finally {
        await inspector?.end().catch(() => {});
        if (running) await harness.stop();
      }
    });
  }
});
