import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import pg from 'pg';

import {
  DR133_APPLICATION_ROLE,
  DR133_APPROVED_DEFINER_IDENTITIES,
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_RUNNER_CONTRACT,
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  Dr133RunnerError,
  assertPostflightRow,
  assertPreflightRow,
  assertRuntimeAdminRow,
  buildNonemptyRelationsSql,
  expectedDr133Sentinel,
  extractRollbackGuardVerificationSql,
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
  runDr133StagingMigration,
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
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const ADMIN_PASSWORD = 'a'.repeat(48);
const RUNTIME_PASSWORD = 'b'.repeat(48);
const DEPLOYMENT_ID = '11111111-1111-4111-8111-111111111111';
const { Client: RealPgClient } = pg;
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
    schema_sentinel: expectedDr133Sentinel(),
    schema_owner: 'postgres',
    relation_names: [...DR133_RELATIONS].sort(),
    relation_count: String(DR133_RELATIONS.length),
    forced_rls_count: String(DR133_RELATIONS.length),
    definer_identities: [...DR133_APPROVED_DEFINER_IDENTITIES].sort(),
    definer_count: String(DR133_APPROVED_DEFINER_IDENTITIES.length),
    definer_custody_safe: true,
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

function runtimeAdminPreflightRow() {
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
    schema_sentinel: expectedDr133Sentinel(),
    app_role_count: '1',
    command_owner_count: '1',
    runtime_login_count: '0',
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
  ]);
  for (const artifact of DR133_ARTIFACTS) {
    const bytes = await readFile(
      new URL(`../../scripts/lor-studio/${artifact.relativePath}`, import.meta.url),
    );
    assert.equal(sha256Bytes(bytes), artifact.sha256, artifact.id);
    if (artifact.id === 'rls-rollback') {
      const guard = extractRollbackGuardVerificationSql(bytes.toString('utf8'));
      assert.match(guard, /^-- Rollback:/u);
      assert.match(guard, /LOCK TABLE/u);
      assert.match(guard, /\$catalog_guard\$;/u);
      assert.match(guard, /ROLLBACK;\n$/u);
      assert.doesNotMatch(
        guard,
        /REVOKE EXECUTE ON FUNCTION lor_studio\.commit_student_case_create/u,
      );
      assert.doesNotMatch(guard, /DROP POLICY/u);
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
    ssl: { rejectUnauthorized: false },
  });
  assert.deepEqual(effectiveClient.connectionParameters.ssl, { rejectUnauthorized: false });
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
  assert.equal(resolveDr133RunnerEnvironment(environment(), { mode: 'migration' }).mode, 'migration');
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
});

test('receipt writer accepts only its fixed evidence schema and cannot emit a credential field', () => {
  const capture = captureStream();
  writeDr133Receipt(capture.stream, {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'migration',
    result: 'NO_MUTATION',
    runnerCode: 'SYNTHETIC_FAILURE',
    postgresCode: null,
  });
  assert.deepEqual(JSON.parse(capture.value()), {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'migration',
    result: 'NO_MUTATION',
    runnerCode: 'SYNTHETIC_FAILURE',
    postgresCode: null,
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
  assert.doesNotThrow(() => assertPreflightRow(preflightRow()));
  assert.doesNotThrow(() => assertPostflightRow(postflightRow()));
  assert.throws(
    () => assertPreflightRow({ ...preflightRow(), schema_count: 0 }),
    runnerError('PREFLIGHT_TARGET_INVALID'),
  );
  assert.throws(
    () => assertPostflightRow(postflightRow({ relation_count: null })),
    runnerError('POSTFLIGHT_CATALOG_INVALID'),
  );
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
});

function createMigrationFake({ failurePoint = null, postflightOverrides = {} } = {}) {
  const calls = [];
  const instances = [];
  const foundationPrefix = '-- Migration: 20260825010000';
  const rlsPrefix = '-- Migration: 20260825010100';
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
      if (text === DR133_PREFLIGHT_SQL) return { rows: [preflightRow()] };
      if (text === DR133_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
      if (text === DR133_ADVISORY_UNLOCK_SQL) return { rows: [{ released: true }] };
      if (text === DR133_FOUNDATION_SENTINEL_SQL) {
        return { rows: [{ schema_sentinel: expectedDr133Sentinel() }] };
      }
      if (text === DR133_POSTFLIGHT_CATALOG_SQL) {
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

test('migration runner verifies, serializes, applies once in order, and emits no secret', async () => {
  const fake = createMigrationFake();
  const capture = captureStream();
  const result = await runDr133StagingMigration({
    environment: environment(),
    ClientClass: fake.ClientClass,
    output: capture.stream,
  });
  assert.equal(result.result, 'BOTH_COMMITTED_VERIFIED');
  const receipt = JSON.parse(capture.value());
  assert.equal(receipt.result, 'BOTH_COMMITTED_VERIFIED');
  assert.equal(receipt.relationCount, 28);
  assert.equal(receipt.definerCount, 8);
  assert.doesNotMatch(capture.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  assert.equal(fake.instances.length, 1);
  assert.equal(fake.instances[0].options.ssl.rejectUnauthorized, false);
  assert.equal(fake.instances[0].ended, true);
  const texts = fake.calls.map((call) => call.text);
  const foundationIndexes = texts
    .map((text, index) => text.startsWith('-- Migration: 20260825010000') ? index : -1)
    .filter((index) => index >= 0);
  const rlsIndexes = texts
    .map((text, index) => text.startsWith('-- Migration: 20260825010100') ? index : -1)
    .filter((index) => index >= 0);
  assert.equal(foundationIndexes.length, 1);
  assert.equal(rlsIndexes.length, 1);
  assert.ok(texts.indexOf(DR133_ADVISORY_LOCK_SQL) < foundationIndexes[0]);
  assert.ok(foundationIndexes[0] < texts.indexOf(DR133_FOUNDATION_SENTINEL_SQL));
  assert.ok(texts.indexOf(DR133_FOUNDATION_SENTINEL_SQL) < rlsIndexes[0]);
  assert.ok(rlsIndexes[0] < texts.indexOf(DR133_POSTFLIGHT_CATALOG_SQL));
  assert.equal(fake.calls.filter((call) => call.text.includes('set_config($1, $2, false)')).length, 8);
});

test('migration runner reports truthful no-retry partial-commit states', async () => {
  for (const [failurePoint, expectedResult, expectedPostgresCode] of [
    ['foundation-pg', 'FOUNDATION_ROLLED_BACK', '42501'],
    ['foundation-transport', 'FOUNDATION_OUTCOME_UNKNOWN', null],
    ['foundation-08006', 'FOUNDATION_OUTCOME_UNKNOWN', '08006'],
    ['rls-pg', 'FOUNDATION_ONLY_COMMITTED', '55000'],
    ['rls-transport', 'RLS_OUTCOME_UNKNOWN', null],
    ['rls-57P01', 'RLS_OUTCOME_UNKNOWN', '57P01'],
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
    'BOTH_COMMITTED_POSTFLIGHT_REJECTED',
  );
});

function createRuntimeFake({
  grantFailure = false,
  allowDirectRead = false,
  commitFailure = false,
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
  assert.equal(JSON.parse(capture.value()).result, 'RUNTIME_LOGIN_COMMITTED_VERIFIED');
  assert.equal(fake.instances.length, 2);
  const adminCalls = fake.calls.filter((call) => call.kind === 'admin');
  const runtimeCalls = fake.calls.filter((call) => call.kind === 'runtime');
  const passwordBindCall = adminCalls.find(
    (call) => call.text.includes("'missionmed.lor.runtime_login_password'"),
  );
  assert.deepEqual(passwordBindCall.values, [RUNTIME_PASSWORD]);
  assert.ok(adminCalls.some((call) => call.text === DR133_RUNTIME_CREATE_ROLE_SQL));
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

test('Railway configs are domainless, single-region, no-retry pre-deploy runners', async () => {
  for (const [filename, expectedCommand] of [
    [
      '../../../railway.lor-dr133-migration.json',
      'node missionmed-hq/scripts/lor-studio/run-dr133-railway-staging-migrations.mjs',
    ],
    [
      '../../../railway.lor-dr133-runtime-login.json',
      'node missionmed-hq/scripts/lor-studio/provision-dr133-railway-staging-runtime-login.mjs',
    ],
  ]) {
    const config = JSON.parse(await readFile(new URL(filename, import.meta.url), 'utf8'));
    assert.equal(config.$schema, 'https://railway.com/railway.schema.json');
    assert.equal(config.build.builder, 'RAILPACK');
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

test('exact runtime role, membership, SET ROLE, and DML denial pass PostgreSQL 16/18', {
  skip: !RUN_REAL_POSTGRES_MATRIX,
}, async (parent) => {
  for (const toolchain of POSTGRES_TOOLCHAINS) {
    await parent.test(`PostgreSQL ${toolchain.major}`, async () => {
      const binaries = postgresBinaries(toolchain.root);
      await Promise.all(Object.values(binaries).map((binary) => access(binary)));
      const harness = createDisposablePostgresHarness({
        binaries,
        startupTimeoutMs: 30_000,
        shutdownTimeoutMs: 15_000,
      });
      let adminClient;
      let runtimeClient;
      let running = false;
      try {
        await harness.start();
        running = true;
        adminClient = new RealPgClient(harness.connectionOptions());
        await adminClient.connect();
        await adminClient.query(`CREATE ROLE lor_studio_app
          NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
          NOREPLICATION NOBYPASSRLS`);
        await adminClient.query('CREATE SCHEMA lor_studio');
        await adminClient.query('CREATE TABLE lor_studio.recommendation_cases (id bigint)');
        await adminClient.query('REVOKE ALL ON SCHEMA lor_studio FROM PUBLIC');
        await adminClient.query('REVOKE ALL ON TABLE lor_studio.recommendation_cases FROM PUBLIC');
        await adminClient.query('GRANT USAGE ON SCHEMA lor_studio TO lor_studio_app');
        await adminClient.query(
          'GRANT SELECT ON TABLE lor_studio.recommendation_cases TO lor_studio_app',
        );

        await adminClient.query('BEGIN');
        await adminClient.query("SET LOCAL password_encryption = 'scram-sha-256'");
        const passwordBind = await adminClient.query(
          `SELECT pg_catalog.set_config(
            'missionmed.lor.runtime_login_password', $1::text, true
          ) IS NOT NULL AS configured`,
          [RUNTIME_PASSWORD],
        );
        assert.equal(passwordBind.rows[0].configured, true);
        await adminClient.query(DR133_RUNTIME_CREATE_ROLE_SQL);
        for (const statement of DR133_RUNTIME_ROLE_HARDENING_SQL) {
          await adminClient.query(statement);
        }
        await adminClient.query('COMMIT');

        const adminPostflight = await adminClient.query(DR133_RUNTIME_ADMIN_POSTFLIGHT_SQL);
        assertRuntimeAdminRow(adminPostflight.rows[0]);

        runtimeClient = new RealPgClient({
          ...harness.connectionOptions(),
          user: DR133_RUNTIME_LOGIN,
          password: RUNTIME_PASSWORD,
        });
        await runtimeClient.connect();
        const identity = await runtimeClient.query(
          'SELECT current_user::text AS current_user, session_user::text AS session_user',
        );
        assert.deepEqual(identity.rows[0], {
          current_user: DR133_RUNTIME_LOGIN,
          session_user: DR133_RUNTIME_LOGIN,
        });
        await assert.rejects(
          runtimeClient.query('SELECT * FROM lor_studio.recommendation_cases'),
          (error) => error?.code === '42501',
        );

        await runtimeClient.query('BEGIN');
        await runtimeClient.query('SET LOCAL ROLE lor_studio_app');
        const setRole = await runtimeClient.query(DR133_RUNTIME_SET_ROLE_SQL);
        assert.deepEqual(setRole.rows[0], {
          current_user: DR133_APPLICATION_ROLE,
          session_user: DR133_RUNTIME_LOGIN,
          visible_case_count: '0',
        });
        await runtimeClient.query('SAVEPOINT dr133_forbidden_direct_dml');
        await assert.rejects(
          runtimeClient.query(DR133_RUNTIME_FORBIDDEN_DELETE_SQL),
          (error) => error?.code === '42501',
        );
        await runtimeClient.query('ROLLBACK TO SAVEPOINT dr133_forbidden_direct_dml');
        await runtimeClient.query('RELEASE SAVEPOINT dr133_forbidden_direct_dml');
        await runtimeClient.query('ROLLBACK');
      } finally {
        if (runtimeClient) await runtimeClient.end();
        if (adminClient) {
          await adminClient.query('DROP TABLE IF EXISTS lor_studio.recommendation_cases');
          await adminClient.query('DROP SCHEMA IF EXISTS lor_studio');
          await adminClient.query('DROP ROLE IF EXISTS lor_studio_runtime_login');
          await adminClient.query('DROP ROLE IF EXISTS lor_studio_app');
          await adminClient.end();
        }
        if (running) await harness.stop();
      }
    });
  }
});
