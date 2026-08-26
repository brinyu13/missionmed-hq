import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { rootCertificates } from 'node:tls';

import {
  DR133_ARTIFACTS,
  DR133_RELATIONS,
  DR133_SUCCESSOR_STAGES,
  DR133_TARGET,
  Dr133RunnerError,
  buildNonemptyRelationsSql,
  expectedDr133Sentinel,
  expectedDr133SuccessorSentinel,
  expectedDr133SuccessorSentinelAt,
  extractRollbackGuardVerificationSql,
  extractSuccessorRollbackGuardVerificationSql,
  targetGucEntries,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  DR133_ADVISORY_LOCK_SQL,
  DR133_ADVISORY_UNLOCK_SQL,
  DR133_FOUNDATION_SENTINEL_SQL,
  DR133_SUCCESSOR_PREFLIGHT_SQL,
} from '../../scripts/lor-studio/run-dr133-railway-production-migrations.mjs';
import {
  DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT,
  DR133_ROLLBACK_DRILL_ABSENCE_SQL,
  DR133_ROLLBACK_DRILL_EMPTY_RELATIONS_SQL,
  resolveDr133RollbackDrillEnvironment,
  runDr133ProductionRollbackDrill,
} from '../../scripts/lor-studio/run-dr133-railway-production-rollback-drill.mjs';

const ADMIN_PASSWORD = 'a'.repeat(48);
const PRODUCTION_CA = await readFile(
  new URL('./dr133-production-root-ca.pem', import.meta.url),
  'utf8',
);
const TEST_CA_SOURCE = rootCertificates.find((candidate) => {
  try {
    const certificate = new X509Certificate(candidate);
    const now = Date.now();
    return certificate.ca === true
      && certificate.checkIssued(certificate)
      && certificate.verify(certificate.publicKey)
      && Date.parse(certificate.validFrom) <= now
      && now < Date.parse(certificate.validTo);
  } catch {
    return false;
  }
});
if (!TEST_CA_SOURCE) throw new Error('Node runtime has no valid self-signed test root CA');
const TEST_CA = new X509Certificate(TEST_CA_SOURCE).toString();

function privateUrl() {
  return `postgresql://postgres:${ADMIN_PASSWORD}@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`;
}

function environment(overrides = {}) {
  return {
    LOR_DR133_ADMIN_DATABASE_URL: privateUrl(),
    LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
    LOR_DR133_MODE: 'rollback-drill',
    LOR_DR133_TUNNEL_HOST: '127.0.0.1',
    LOR_DR133_TUNNEL_PORT: '55432',
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
    ...overrides,
  };
}

function successorPreflightRow() {
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
    lor_role_count: '2',
  };
}

function captureStream() {
  let value = '';
  return {
    stream: { write(fragment) { value += fragment; } },
    value: () => value,
    receipt: () => JSON.parse(value.trim()),
  };
}

function runnerError(code) {
  return (error) => error instanceof Dr133RunnerError && error.code === code;
}

async function artifactSources() {
  const sources = new Map();
  for (const artifact of DR133_ARTIFACTS) {
    sources.set(
      artifact.id,
      await readFile(
        new URL(`../../scripts/lor-studio/${artifact.relativePath}`, import.meta.url),
        'utf8',
      ),
    );
  }
  return sources;
}

test('rollback custody artifacts retain private-target guards and accept tunnel loopback', async () => {
  const sources = await artifactSources();
  for (const source of sources.values()) {
    assert.match(source, /inet_server_addr\(\) << pg_catalog\.inet '127\.0\.0\.0\/8'/u);
    assert.match(source, /inet_server_addr\(\) << pg_catalog\.inet '::1\/128'/u);
    assert.match(source, /inet_server_addr\(\) << pg_catalog\.inet '10\.0\.0\.0\/8'/u);
    assert.match(source, /inet_server_addr\(\) << pg_catalog\.inet 'fc00::\/7'/u);
  }
});

function createFakeClientClass({
  queryOverride = null,
  endError = null,
  instances = [],
} = {}) {
  return class FakeClient {
    constructor(options) {
      this.options = options;
      this.queries = [];
      instances.push(this);
    }

    async connect() {
      this.connected = true;
    }

    async query(sql, values) {
      this.queries.push({ sql, values });
      const overridden = await queryOverride?.({ sql, values, client: this });
      if (overridden !== undefined) return overridden;
      if (sql === DR133_SUCCESSOR_PREFLIGHT_SQL) return { rows: [successorPreflightRow()] };
      if (sql === DR133_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
      if (sql === DR133_ADVISORY_UNLOCK_SQL) return { rows: [{ released: true }] };
      if (sql === buildNonemptyRelationsSql()) {
        return { rows: [{ nonempty_relation_count: '0' }] };
      }
      if (sql === DR133_FOUNDATION_SENTINEL_SQL) {
        return { rows: [{ schema_sentinel: expectedDr133Sentinel() }] };
      }
      if (sql === DR133_ROLLBACK_DRILL_ABSENCE_SQL) {
        return { rows: [{ schema_count: '0', role_count: '0' }] };
      }
      if (values?.length === 2 && sql.includes('set_config')) {
        return { rows: [{ configured_value: values[1] }] };
      }
      return { rows: [] };
    }

    async end() {
      if (endError) throw endError;
      this.ended = true;
    }
  };
}

test('rollback drill environment is exact to production, database-service import, and pinned TLS', () => {
  const resolved = resolveDr133RollbackDrillEnvironment(environment());
  assert.match(
    resolved.adminPgConnectionString,
    /^postgresql:\/\/postgres:.+@127\.0\.0\.1:55432\/railway$/u,
  );
  assert.equal(resolved.databaseTlsServername, DR133_TARGET.databaseHost);
  assert.equal(new X509Certificate(resolved.databaseCa).ca, true);

  for (const overrides of [
    { LOR_DR133_MODE: 'migration' },
    { RAILWAY_PROJECT_ID: '11111111-1111-4111-8111-111111111111' },
    { RAILWAY_ENVIRONMENT_ID: '22222222-2222-4222-8222-222222222222' },
    { RAILWAY_ENVIRONMENT_NAME: 'staging' },
    { RAILWAY_SERVICE_ID: DR133_TARGET.applicationServiceId },
    { LOR_DR133_TUNNEL_HOST: 'localhost' },
    { LOR_DR133_TUNNEL_PORT: '5432' },
    {
      LOR_DR133_ADMIN_DATABASE_URL:
        privateUrl().replace(DR133_TARGET.databaseHost, 'public.example.invalid'),
    },
    { LOR_DR133_RUNTIME_DATABASE_CA: 'not-a-certificate' },
    { LOR_DR133_RUNTIME_DATABASE_CA: TEST_CA },
    { LOR_DR133_RUNTIME_DATABASE_URL: 'unexpected' },
  ]) {
    assert.throws(() => resolveDr133RollbackDrillEnvironment(environment(overrides)));
  }
});

test('successful drill hash-verifies fourteen artifacts, guards six stages, and rolls back all seven in exact reverse order', async () => {
  const sources = await artifactSources();
  const instances = [];
  const output = captureStream();
  const ClientClass = createFakeClientClass({ instances });

  const result = await runDr133ProductionRollbackDrill({
    environment: environment(),
    ClientClass,
    output: output.stream,
  });
  assert.deepEqual(result, { result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED' });
  assert.equal(instances.length, 1);
  const [client] = instances;
  assert.equal(client.connected, true);
  assert.equal(client.ended, true);
  assert.equal(client.options.enableChannelBinding, true);
  assert.equal(client.options.ssl.rejectUnauthorized, true);
  assert.equal(client.options.ssl.minVersion, 'TLSv1.2');
  assert.equal(client.options.ssl.servername, DR133_TARGET.databaseHost);
  assert.equal(client.options.application_name,
    'missionmed-f2-lor-1012-dr133-production-rollback-drill');

  const expectedRollbackIds = [
    ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => stage.rollbackId),
    'rls-rollback',
    'foundation-rollback',
  ];
  const dispatchedRollbackIds = client.queries
    .map(({ sql }) => expectedRollbackIds.find((id) => sql === sources.get(id)))
    .filter(Boolean);
  assert.deepEqual(dispatchedRollbackIds, expectedRollbackIds);

  const expectedGuards = [
    ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => (
      extractSuccessorRollbackGuardVerificationSql(sources.get(stage.rollbackId), stage.rollbackId)
    )),
    extractRollbackGuardVerificationSql(sources.get('rls-rollback')),
  ];
  assert.deepEqual(
    client.queries.filter(({ sql }) => expectedGuards.includes(sql)).map(({ sql }) => sql),
    expectedGuards,
  );
  for (const [index, rollbackId] of expectedRollbackIds.entries()) {
    const rollbackIndex = client.queries.findIndex(({ sql }) => sql === sources.get(rollbackId));
    const requiredPredecessor = rollbackId === 'foundation-rollback'
      ? DR133_FOUNDATION_SENTINEL_SQL
      : expectedGuards[index];
    assert.equal(client.queries[rollbackIndex - 1].sql, requiredPredecessor, rollbackId);
  }
  assert.equal(client.queries.filter(({ sql }) => sql === DR133_SUCCESSOR_PREFLIGHT_SQL).length, 2);
  assert.equal(
    client.queries.some(({ sql }) => sql === DR133_ROLLBACK_DRILL_EMPTY_RELATIONS_SQL),
    true,
  );
  assert.equal(client.queries.some(({ sql }) => sql === DR133_FOUNDATION_SENTINEL_SQL), true);
  assert.equal(client.queries.some(({ sql }) => sql === DR133_ROLLBACK_DRILL_ABSENCE_SQL), true);
  assert.equal(client.queries.filter(({ values }) => values?.length === 2).length,
    targetGucEntries().length);
  assert.equal(client.queries.at(-1).sql, DR133_ADVISORY_UNLOCK_SQL);

  const receipt = output.receipt();
  assert.equal(receipt.contract, DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT);
  assert.equal(receipt.mode, 'rollback-drill');
  assert.equal(receipt.result, 'ROLLBACK_DRILL_COMMITTED_VERIFIED');
  assert.equal(receipt.verifiedArtifactCount, 14);
  assert.equal(receipt.rollbackCount, 7);
  assert.equal(receipt.relationCount, DR133_RELATIONS.length);
  assert.equal(receipt.postgresMajor, 18);
  for (const artifact of DR133_ARTIFACTS) {
    assert.equal(Object.values(receipt).includes(artifact.sha256), true, artifact.id);
  }
  assert.doesNotMatch(output.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  assert.doesNotMatch(output.value(), /BEGIN CERTIFICATE|PRIVATE KEY|postgresql:\/\//u);
});

test('drill fails before connection on any artifact hash mismatch and emits no secret material', async () => {
  let constructed = false;
  class ForbiddenClient {
    constructor() {
      constructed = true;
    }
  }
  const output = captureStream();
  let first = true;
  const readFileFn = async (url) => {
    const bytes = await readFile(url);
    if (!first) return bytes;
    first = false;
    const corrupted = Buffer.from(bytes);
    corrupted[0] ^= 1;
    return corrupted;
  };
  await assert.rejects(
    runDr133ProductionRollbackDrill({
      environment: environment(),
      ClientClass: ForbiddenClient,
      readFileFn,
      output: output.stream,
    }),
    runnerError('ARTIFACT_HASH_MISMATCH'),
  );
  assert.equal(constructed, false);
  assert.deepEqual(output.receipt(), {
    contract: DR133_PRODUCTION_ROLLBACK_DRILL_CONTRACT,
    mode: 'rollback-drill',
    result: 'NO_MUTATION',
    runnerCode: 'ARTIFACT_HASH_MISMATCH',
    postgresCode: null,
    verifiedArtifactCount: 0,
    rollbackCount: 0,
  });
  assert.doesNotMatch(output.value(), new RegExp(ADMIN_PASSWORD, 'u'));
  assert.doesNotMatch(output.value(), /BEGIN CERTIFICATE|PRIVATE KEY/u);
});

test('advisory-lock denial and any nonempty relation fail before rollback dispatch', async (parent) => {
  const sources = await artifactSources();
  const rollbackSql = new Set([
    ...DR133_SUCCESSOR_STAGES.map((stage) => sources.get(stage.rollbackId)),
    sources.get('rls-rollback'),
    sources.get('foundation-rollback'),
  ]);
  for (const scenario of [
    {
      name: 'lock unavailable',
      override: ({ sql }) => sql === DR133_ADVISORY_LOCK_SQL
        ? { rows: [{ acquired: false }] }
        : undefined,
      code: 'ADVISORY_LOCK_UNAVAILABLE',
    },
    {
      name: 'nonempty relation',
      override: ({ sql }) => {
        if (sql === DR133_ROLLBACK_DRILL_EMPTY_RELATIONS_SQL) {
          throw Object.assign(new Error('nonempty'), { code: '55000' });
        }
        return undefined;
      },
      code: 'POSTGRES_55000',
    },
  ]) {
    await parent.test(scenario.name, async () => {
      const instances = [];
      const output = captureStream();
      const ClientClass = createFakeClientClass({
        instances,
        queryOverride: scenario.override,
      });
      await assert.rejects(
        runDr133ProductionRollbackDrill({
          environment: environment(),
          ClientClass,
          output: output.stream,
        }),
        runnerError(scenario.code),
      );
      assert.equal(instances[0].queries.some(({ sql }) => rollbackSql.has(sql)), false);
      assert.equal(output.receipt().result, 'NO_MUTATION');
      assert.equal(output.receipt().rollbackCount, 0);
    });
  }
});

test('known failure at every rollback step preserves only previously committed reverse progress', async (parent) => {
  const sources = await artifactSources();
  const rollbackIds = [
    ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => stage.rollbackId),
    'rls-rollback',
    'foundation-rollback',
  ];
  for (const [index, rollbackId] of rollbackIds.entries()) {
    await parent.test(rollbackId, async () => {
      const instances = [];
      const output = captureStream();
      const postgresError = Object.assign(new Error('must not appear in receipt'), { code: '42501' });
      const ClientClass = createFakeClientClass({
        instances,
        queryOverride: ({ sql }) => {
          if (sql === sources.get(rollbackId)) throw postgresError;
          return undefined;
        },
      });
      await assert.rejects(
        runDr133ProductionRollbackDrill({
          environment: environment(),
          ClientClass,
          output: output.stream,
        }),
        runnerError('POSTGRES_42501'),
      );
      const receipt = output.receipt();
      assert.equal(receipt.rollbackCount, index);
      assert.equal(receipt.postgresCode, '42501');
      assert.equal(receipt.result, index === 0 ? 'NO_MUTATION' : 'ROLLBACK_PROGRESS_PRESERVED');
      assert.equal(instances[0].queries.at(-1).sql, DR133_ADVISORY_UNLOCK_SQL);
      assert.doesNotMatch(output.value(), /must not appear|postgresql:\/\//u);
    });
  }
});

test('unknown rollback outcome, rejected absence, unknown verification, and cleanup failure remain distinct safe receipts', async (parent) => {
  const sources = await artifactSources();
  const firstRollbackId = DR133_SUCCESSOR_STAGES.at(-1).rollbackId;
  const scenarios = [
    {
      name: 'unknown rollback outcome',
      override: ({ sql }) => {
        if (sql === sources.get(firstRollbackId)) throw new Error('transport-secret');
        return undefined;
      },
      result: 'ROLLBACK_PROGRESS_OUTCOME_UNKNOWN',
      rollbackCount: 0,
    },
    {
      name: 'postflight rejection',
      override: ({ sql }) => sql === DR133_ROLLBACK_DRILL_ABSENCE_SQL
        ? { rows: [{ schema_count: '1', role_count: '0' }] }
        : undefined,
      result: 'ROLLBACK_DRILL_COMMITTED_POSTFLIGHT_REJECTED',
      rollbackCount: 7,
    },
    {
      name: 'postflight transport uncertainty',
      override: ({ sql }) => {
        if (sql === DR133_ROLLBACK_DRILL_ABSENCE_SQL) {
          throw Object.assign(new Error('transport-secret'), { code: '08006' });
        }
        return undefined;
      },
      result: 'ROLLBACK_DRILL_COMMITTED_VERIFICATION_UNKNOWN',
      rollbackCount: 7,
    },
    {
      name: 'verified cleanup failure',
      override: ({ sql }) => sql === DR133_ADVISORY_UNLOCK_SQL
        ? { rows: [{ released: false }] }
        : undefined,
      result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED_CLEANUP_FAILED',
      rollbackCount: 7,
    },
  ];
  for (const scenario of scenarios) {
    await parent.test(scenario.name, async () => {
      const output = captureStream();
      const ClientClass = createFakeClientClass({ queryOverride: scenario.override });
      await assert.rejects(runDr133ProductionRollbackDrill({
        environment: environment(),
        ClientClass,
        output: output.stream,
      }));
      const receipt = output.receipt();
      assert.equal(receipt.result, scenario.result);
      assert.equal(receipt.rollbackCount, scenario.rollbackCount);
      assert.doesNotMatch(output.value(), /transport-secret|BEGIN CERTIFICATE|postgresql:\/\//u);
    });
  }
});

function rollbackCursorRow(cursor) {
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

async function createStatefulRollbackFake({ cursor, failAfterCommitId = null }) {
  const sources = await artifactSources();
  const calls = [];
  let failureConsumed = false;
  const successorRollbackIndexes = new Map(DR133_SUCCESSOR_STAGES.map((stage, index) => [
    stage.rollbackId,
    index,
  ]));
  const guards = new Map(DR133_SUCCESSOR_STAGES.map((stage, index) => [
    extractSuccessorRollbackGuardVerificationSql(sources.get(stage.rollbackId), stage.rollbackId),
    index + 1,
  ]));
  guards.set(extractRollbackGuardVerificationSql(sources.get('rls-rollback')), 0);
  const rollbackSources = new Map([
    ...successorRollbackIndexes.keys(),
    'rls-rollback',
    'foundation-rollback',
  ].map((id) => [sources.get(id), id]));
  class FakeClient {
    async connect() { calls.push({ sql: 'CONNECT' }); }
    async end() { calls.push({ sql: 'END' }); }

    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === DR133_SUCCESSOR_PREFLIGHT_SQL) {
        return { rows: [rollbackCursorRow(cursor)] };
      }
      if (sql === DR133_ADVISORY_LOCK_SQL) return { rows: [{ acquired: true }] };
      if (sql === DR133_ADVISORY_UNLOCK_SQL) return { rows: [{ released: true }] };
      if (sql === DR133_ROLLBACK_DRILL_EMPTY_RELATIONS_SQL) return { rows: [] };
      if (sql === DR133_FOUNDATION_SENTINEL_SQL) {
        return { rows: [{ schema_sentinel: expectedDr133Sentinel() }] };
      }
      if (sql === DR133_ROLLBACK_DRILL_ABSENCE_SQL) {
        return { rows: [{
          schema_count: cursor.state === 'absent' ? '0' : '1',
          role_count: cursor.state === 'absent' ? '0' : '1',
        }] };
      }
      if (values?.length === 2 && sql.includes('set_config')) {
        return { rows: [{ configured_value: values[1] }] };
      }
      if (guards.has(sql)) {
        assert.deepEqual(cursor, { state: 'committed', index: guards.get(sql) });
        return { rows: [] };
      }
      const rollbackId = rollbackSources.get(sql);
      if (successorRollbackIndexes.has(rollbackId)) {
        const index = successorRollbackIndexes.get(rollbackId);
        assert.deepEqual(cursor, { state: 'committed', index: index + 1 });
        cursor.index = index;
      } else if (rollbackId === 'rls-rollback') {
        assert.deepEqual(cursor, { state: 'committed', index: 0 });
        cursor.state = 'foundation';
        delete cursor.index;
      } else if (rollbackId === 'foundation-rollback') {
        assert.deepEqual(cursor, { state: 'foundation' });
        cursor.state = 'absent';
      } else {
        return { rows: [] };
      }
      if (rollbackId === failAfterCommitId && !failureConsumed) {
        failureConsumed = true;
        throw Object.assign(new Error('secret-free simulated disconnect'), { code: '08006' });
      }
      return { rows: [] };
    }
  }
  return { calls, ClientClass: FakeClient, sources };
}

test('rollback drill resumes from the exact reverse cursor without replaying committed stages', async () => {
  const cursor = { state: 'committed', index: DR133_SUCCESSOR_STAGES.length };
  const failedRollbackId = 'ai-proposal-rollback';
  const fake = await createStatefulRollbackFake({ cursor, failAfterCommitId: failedRollbackId });
  const first = captureStream();
  await assert.rejects(runDr133ProductionRollbackDrill({
    environment: environment(),
    ClientClass: fake.ClientClass,
    output: first.stream,
  }), runnerError('POSTGRES_08006'));
  assert.equal(first.receipt().result, 'ROLLBACK_PROGRESS_OUTCOME_UNKNOWN');
  assert.equal(first.receipt().rollbackCount, 1);
  assert.deepEqual(cursor, { state: 'committed', index: 3 });

  const retry = captureStream();
  assert.deepEqual(await runDr133ProductionRollbackDrill({
    environment: environment(),
    ClientClass: fake.ClientClass,
    output: retry.stream,
  }), { result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED' });
  assert.equal(retry.receipt().rollbackCount, 7);
  assert.deepEqual(cursor, { state: 'absent' });
  for (const rollbackId of [
    ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => stage.rollbackId),
    'rls-rollback',
    'foundation-rollback',
  ]) {
    assert.equal(
      fake.calls.filter(({ sql }) => sql === fake.sources.get(rollbackId)).length,
      1,
      rollbackId,
    );
  }

  const alreadyAbsent = await createStatefulRollbackFake({ cursor });
  const absentCapture = captureStream();
  await runDr133ProductionRollbackDrill({
    environment: environment(),
    ClientClass: alreadyAbsent.ClientClass,
    output: absentCapture.stream,
  });
  assert.equal(absentCapture.receipt().rollbackCount, 7);
  assert.equal([...alreadyAbsent.sources.entries()].some(([id, source]) => (
    id.endsWith('-rollback')
      && alreadyAbsent.calls.some(({ sql }) => sql === source)
  )), false);
});

test('rollback drill resumes every exact foundation/base/successor/absence cursor', async () => {
  const rollbackIds = [
    ...[...DR133_SUCCESSOR_STAGES].reverse().map((stage) => stage.rollbackId),
    'rls-rollback',
    'foundation-rollback',
  ];
  for (const initial of [
    { state: 'foundation' },
    ...Array.from(
      { length: DR133_SUCCESSOR_STAGES.length + 1 },
      (_, index) => ({ state: 'committed', index }),
    ),
    { state: 'absent' },
  ]) {
    const cursor = { ...initial };
    const fake = await createStatefulRollbackFake({ cursor });
    const output = captureStream();
    assert.deepEqual(await runDr133ProductionRollbackDrill({
      environment: environment(),
      ClientClass: fake.ClientClass,
      output: output.stream,
    }), { result: 'ROLLBACK_DRILL_COMMITTED_VERIFIED' });
    assert.equal(output.receipt().rollbackCount, 7);
    assert.deepEqual(cursor, { state: 'absent' });

    const startIndex = initial.state === 'absent'
      ? 7
      : initial.state === 'foundation'
        ? 6
        : DR133_SUCCESSOR_STAGES.length - initial.index;
    for (const [index, rollbackId] of rollbackIds.entries()) {
      assert.equal(
        fake.calls.filter(({ sql }) => sql === fake.sources.get(rollbackId)).length,
        index < startIndex ? 0 : 1,
        `${JSON.stringify(initial)}:${rollbackId}`,
      );
    }
  }
});

test('rollback drill rejects foreign sentinel or prefixed role before reverse dispatch', async () => {
  const sources = await artifactSources();
  for (const rowOverrides of [
    { schema_sentinel: 'foreign' },
    { lor_role_count: '3' },
  ]) {
    const instances = [];
    const ClientClass = createFakeClientClass({
      instances,
      queryOverride: ({ sql }) => sql === DR133_SUCCESSOR_PREFLIGHT_SQL
        ? { rows: [{ ...successorPreflightRow(), ...rowOverrides }] }
        : undefined,
    });
    await assert.rejects(runDr133ProductionRollbackDrill({
      environment: environment(),
      ClientClass,
      output: captureStream().stream,
    }), runnerError('PRODUCTION_SCHEMA_CURSOR_INVALID'));
    assert.equal(instances[0].queries.some(({ sql }) => (
      [...sources.entries()].some(([id, source]) => id.endsWith('-rollback') && sql === source)
    )), false);
  }
});
