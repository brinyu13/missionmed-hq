import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DR133_RUNNER_CONTRACT,
  DR133_RUNTIME_LOGIN,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  DR133_RUNTIME_CA_TRANSFER_CONTRACT,
} from '../../scripts/lor-studio/railway-dr133-production-runtime-ca-transfer.mjs';
import {
  DR133_RUNTIME_URL_BINDING_CONTRACT,
  DR133_RUNTIME_URL_VARIABLE_KEY,
} from '../../scripts/lor-studio/railway-dr133-production-runtime-url-binding.mjs';
import {
  dr133ReleaseVariableValueSha256,
} from '../../scripts/lor-studio/railway-dr133-production-release-orchestrator.mjs';
import {
  DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT,
} from '../../scripts/lor-studio/run-dr133-railway-production-tunnel-operation.mjs';
import {
  DR133_RUNTIME_BINDING_LIFECYCLE_CONTRACT,
  Dr133RuntimeBindingLifecycleError,
  createDr133RailwayProductionRuntimeBindingLifecycle,
} from '../../scripts/lor-studio/complete-dr133-railway-production-runtime-binding.mjs';

const CA = await readFile(new URL('./dr133-production-root-ca.pem', import.meta.url), 'utf8');
const PASSWORD = 'z'.repeat(64);
const SOURCE_COMMIT = 'c'.repeat(40);

function sourceReceipt() {
  return {
    contract: DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT,
    result: 'SOURCE_CUSTODY_VERIFIED',
    sourceCommit: SOURCE_COMMIT,
    trackedPathCount: 30,
    dependencyPackageCount: 13,
  };
}

function caReceipt() {
  return {
    contract: DR133_RUNTIME_CA_TRANSFER_CONTRACT,
    result: 'ROOT_CA_BOUND_VERIFIED',
  };
}

function urlReceipt() {
  return {
    contract: DR133_RUNTIME_URL_BINDING_CONTRACT,
    result: 'RUNTIME_DATABASE_URL_STAGED_NO_DEPLOY_CONFIRMED',
  };
}

function tunnelReceipt() {
  return {
    contract: DR133_RUNNER_CONTRACT,
    mode: 'runtime-login',
    result: 'RUNTIME_LOGIN_COMMITTED_VERIFIED',
  };
}

test('lifecycle proves source before provider mutation, stages URL, then provisions login', async () => {
  const calls = [];
  const lifecycle = createDr133RailwayProductionRuntimeBindingLifecycle({
    createPassword: () => PASSWORD,
    async verifySourceCustody(options) {
      calls.push(['source', options]);
      return sourceReceipt();
    },
    async bindRootCa(options) { calls.push(['ca', options]); return caReceipt(); },
    async bindRuntimeUrl(options) { calls.push(['url', options]); return urlReceipt(); },
    async runTunnelOperation(options) {
      calls.push(['tunnel', options]);
      return tunnelReceipt();
    },
  });
  const receipt = await lifecycle({
    databaseCa: CA,
    environment: {},
    sourceCommit: SOURCE_COMMIT,
  });
  const stagedUrl = calls[2][1].runtimeDatabaseUrl;
  const stagedUrlBytes = Buffer.from(stagedUrl, 'utf8');
  let expectedValueSha256;
  try {
    expectedValueSha256 = dr133ReleaseVariableValueSha256(
      DR133_RUNTIME_URL_VARIABLE_KEY,
      stagedUrlBytes,
    );
  } finally {
    stagedUrlBytes.fill(0);
  }
  assert.deepEqual(receipt, {
    contract: DR133_RUNTIME_BINDING_LIFECYCLE_CONTRACT,
    result: 'RUNTIME_BINDING_STAGED_NO_DEPLOY_VERIFIED',
    role: DR133_RUNTIME_LOGIN,
    sourceCommit: SOURCE_COMMIT,
    variableKey: DR133_RUNTIME_URL_VARIABLE_KEY,
    valueSha256: expectedValueSha256,
  });
  assert.deepEqual(calls.map(([kind]) => kind), ['source', 'ca', 'url', 'tunnel']);
  assert.deepEqual(calls[0][1], { sourceCommit: SOURCE_COMMIT });
  assert.equal(calls[3][1].runtimeDatabaseUrl, stagedUrl);
  assert.equal(calls[3][1].sourceCommit, SOURCE_COMMIT);
  assert.match(stagedUrl, new RegExp(`:${PASSWORD}@`, 'u'));
  assert.equal(JSON.stringify(receipt).includes(stagedUrl), false);
  assert.equal(JSON.stringify(receipt).includes(PASSWORD), false);
});

test('source custody must pass before CA or URL provider mutation', async () => {
  const calls = [];
  const lifecycle = createDr133RailwayProductionRuntimeBindingLifecycle({
    createPassword: () => PASSWORD,
    async verifySourceCustody() { calls.push('source'); throw new Error('private drift'); },
    async bindRootCa() { calls.push('ca'); return caReceipt(); },
    async bindRuntimeUrl() { calls.push('url'); return urlReceipt(); },
    async runTunnelOperation() { calls.push('tunnel'); return tunnelReceipt(); },
  });
  await assert.rejects(
    lifecycle({ databaseCa: CA, environment: {}, sourceCommit: SOURCE_COMMIT }),
    (error) => error instanceof Dr133RuntimeBindingLifecycleError
      && error.code === 'SOURCE_CUSTODY_UNPROVEN'
      && error.roleAbsent === true
      && error.variableState === 'MUTATION_NOT_ATTEMPTED',
  );
  assert.deepEqual(calls, ['source']);
});

test('URL staging failure never provisions a database login or performs deletion cleanup', async () => {
  const calls = [];
  const lifecycle = createDr133RailwayProductionRuntimeBindingLifecycle({
    createPassword: () => PASSWORD,
    async verifySourceCustody() { calls.push('source'); return sourceReceipt(); },
    async bindRootCa() { calls.push('ca'); return caReceipt(); },
    async bindRuntimeUrl() {
      calls.push('url');
      const error = new Error('private provider failure');
      error.bindingState = 'OUTCOME_UNKNOWN';
      throw error;
    },
    async runTunnelOperation() { calls.push('tunnel'); return tunnelReceipt(); },
  });
  await assert.rejects(
    lifecycle({ databaseCa: CA, environment: {}, sourceCommit: SOURCE_COMMIT }),
    (error) => error instanceof Dr133RuntimeBindingLifecycleError
      && error.code === 'RUNTIME_URL_STAGING_FAILED'
      && error.roleAbsent === true
      && error.variableState === 'OUTCOME_UNKNOWN',
  );
  assert.deepEqual(calls, ['source', 'ca', 'url']);
});

test('tunnel-proven deprovision is recognized without redundant destructive cleanup', async () => {
  let tunnelCalls = 0;
  const lifecycle = createDr133RailwayProductionRuntimeBindingLifecycle({
    createPassword: () => PASSWORD,
    async verifySourceCustody() { return sourceReceipt(); },
    async bindRootCa() { return caReceipt(); },
    async bindRuntimeUrl() { return urlReceipt(); },
    async runTunnelOperation() {
      tunnelCalls += 1;
      const error = new Error('private provision failure');
      error.code = 'RUNTIME_LOGIN_OUTCOME_UNKNOWN_DEPROVISIONED';
      error.safeReceipt = {
        result: 'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
      };
      throw error;
    },
  });
  await assert.rejects(
    lifecycle({ databaseCa: CA, environment: {}, sourceCommit: SOURCE_COMMIT }),
    (error) => error instanceof Dr133RuntimeBindingLifecycleError
      && error.code === 'RUNTIME_LOGIN_FAILED_VARIABLE_STAGED_ROLE_ABSENT'
      && error.roleAbsent === true
      && error.variableState === 'STAGED_NO_DEPLOY',
  );
  assert.equal(tunnelCalls, 1);
});

test('unproven tunnel cleanup remains an explicit staged-variable blocker', async () => {
  const lifecycle = createDr133RailwayProductionRuntimeBindingLifecycle({
    createPassword: () => PASSWORD,
    async verifySourceCustody() { return sourceReceipt(); },
    async bindRootCa() { return caReceipt(); },
    async bindRuntimeUrl() { return urlReceipt(); },
    async runTunnelOperation() {
      const error = new Error('private cleanup failure');
      error.code = 'RUNTIME_LOGIN_CLEANUP_UNPROVEN';
      throw error;
    },
  });
  await assert.rejects(
    lifecycle({ databaseCa: CA, environment: {}, sourceCommit: SOURCE_COMMIT }),
    (error) => error instanceof Dr133RuntimeBindingLifecycleError
      && error.code === 'RUNTIME_LOGIN_FAILED_CLEANUP_UNPROVEN'
      && error.roleAbsent === false
      && error.variableState === 'STAGED_NO_DEPLOY',
  );
});

test('sourceCommit is mandatory at the lifecycle boundary', async () => {
  const lifecycle = createDr133RailwayProductionRuntimeBindingLifecycle({
    createPassword: () => PASSWORD,
    async verifySourceCustody() { throw new Error('must not run'); },
    async bindRootCa() { throw new Error('must not run'); },
    async bindRuntimeUrl() { throw new Error('must not run'); },
    async runTunnelOperation() { throw new Error('must not run'); },
  });
  await assert.rejects(
    lifecycle({ databaseCa: CA, environment: {} }),
    (error) => error instanceof Dr133RuntimeBindingLifecycleError
      && error.code === 'SOURCE_COMMIT_INVALID',
  );
});
