import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DR133_TARGET,
  Dr133RunnerError,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  DR133_PRODUCTION_CONNECTIVITY_CONTRACT,
  DR133_PRODUCTION_CONNECTIVITY_SQL,
  verifyDr133RailwayProductionConnectivity,
} from '../../scripts/lor-studio/verify-dr133-railway-production-connectivity.mjs';

const CA = await readFile(new URL('./dr133-production-root-ca.pem', import.meta.url), 'utf8');
const PASSWORD = 'a'.repeat(48);

function environment(overrides = {}) {
  return {
    LOR_DR133_ADMIN_DATABASE_URL:
      `postgresql://postgres:${PASSWORD}@${DR133_TARGET.databaseHost}:5432/railway?sslmode=require`,
    LOR_DR133_RUNTIME_DATABASE_CA: CA,
    LOR_DR133_MODE: 'connectivity-preflight',
    LOR_DR133_TUNNEL_HOST: '127.0.0.1',
    LOR_DR133_TUNNEL_PORT: '55432',
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
    ...overrides,
  };
}

function capture() {
  let text = '';
  return {
    output: { write(fragment) { text += fragment; } },
    receipt: () => JSON.parse(text.trim()),
  };
}

function row(overrides = {}) {
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
    schema_count: '0',
    role_count: '0',
    ...overrides,
  };
}

test('connectivity preflight proves the exact fresh private TLS target through the tunnel', async () => {
  const instances = [];
  class FakeClient {
    constructor(options) { this.options = options; instances.push(this); }
    async connect() { this.connected = true; }
    async query(sql) { this.sql = sql; return { rows: [row()] }; }
    async end() { this.ended = true; }
  }
  const observed = capture();
  const result = await verifyDr133RailwayProductionConnectivity({
    environment: environment(), ClientClass: FakeClient, output: observed.output,
  });
  assert.deepEqual(result, { result: 'FRESH_PRIVATE_TARGET_VERIFIED' });
  assert.equal(instances.length, 1);
  assert.equal(new URL(instances[0].options.connectionString).hostname, '127.0.0.1');
  assert.equal(new URL(instances[0].options.connectionString).port, '55432');
  assert.equal(instances[0].options.ssl.servername, DR133_TARGET.databaseHost);
  assert.equal(instances[0].options.ssl.rejectUnauthorized, true);
  assert.equal(instances[0].options.enableChannelBinding, true);
  assert.equal(instances[0].sql, DR133_PRODUCTION_CONNECTIVITY_SQL);
  assert.equal(instances[0].ended, true);
  assert.deepEqual(observed.receipt(), {
    contract: DR133_PRODUCTION_CONNECTIVITY_CONTRACT,
    result: 'FRESH_PRIVATE_TARGET_VERIFIED',
    postgresMajor: 18,
  });
});

test('connectivity preflight rejects every identity, TLS, or freshness widening safely', async () => {
  for (const mutation of [
    { database_name: 'other' },
    { current_user: 'other' },
    { session_user: 'other' },
    { database_owner: 'other' },
    { postgres_major: 17 },
    { private_server_address: false },
    { ssl_active: false },
    { ssl_version: 'TLSv1' },
    { ssl_cipher: '' },
    { schema_count: '1' },
    { role_count: '1' },
  ]) {
    class FakeClient {
      async connect() {}
      async query() { return { rows: [row(mutation)] }; }
      async end() {}
    }
    const observed = capture();
    await assert.rejects(
      verifyDr133RailwayProductionConnectivity({
        environment: environment(), ClientClass: FakeClient, output: observed.output,
      }),
      (error) => error instanceof Dr133RunnerError
        && error.code === 'CONNECTIVITY_PREFLIGHT_REJECTED',
    );
    assert.deepEqual(observed.receipt(), {
      contract: DR133_PRODUCTION_CONNECTIVITY_CONTRACT,
      result: 'BLOCKED',
      runnerCode: 'CONNECTIVITY_PREFLIGHT_REJECTED',
      postgresCode: null,
    });
  }
});

test('connectivity preflight rejects wrong CA and tunnel identity before client construction', async () => {
  let constructed = false;
  class ForbiddenClient { constructor() { constructed = true; } }
  for (const overrides of [
    { LOR_DR133_RUNTIME_DATABASE_CA: 'not-a-ca' },
    { LOR_DR133_TUNNEL_HOST: 'localhost' },
    { LOR_DR133_TUNNEL_PORT: '5432' },
    { RAILWAY_SERVICE_ID: DR133_TARGET.applicationServiceId },
  ]) {
    const observed = capture();
    await assert.rejects(
      verifyDr133RailwayProductionConnectivity({
        environment: environment(overrides), ClientClass: ForbiddenClient, output: observed.output,
      }),
      (error) => error instanceof Dr133RunnerError,
    );
    assert.equal(observed.receipt().result, 'BLOCKED');
  }
  assert.equal(constructed, false);
});

test('connectivity cleanup failure is an explicit safe blocker', async () => {
  class FakeClient {
    async connect() {}
    async query() { return { rows: [row()] }; }
    async end() { throw new Error('secret-bearing cleanup failure'); }
  }
  const observed = capture();
  await assert.rejects(
    verifyDr133RailwayProductionConnectivity({
      environment: environment(), ClientClass: FakeClient, output: observed.output,
    }),
    (error) => error instanceof Dr133RunnerError
      && error.code === 'CONNECTIVITY_CLEANUP_FAILED',
  );
  assert.deepEqual(observed.receipt(), {
    contract: DR133_PRODUCTION_CONNECTIVITY_CONTRACT,
    result: 'BLOCKED',
    runnerCode: 'CONNECTIVITY_CLEANUP_FAILED',
    postgresCode: null,
  });
});
