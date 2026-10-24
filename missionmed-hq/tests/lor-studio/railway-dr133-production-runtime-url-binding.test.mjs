import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import {
  DR133_RUNTIME_URL_BINDING_CONTRACT,
  DR133_RUNTIME_URL_VARIABLE_KEY,
  Dr133RuntimeUrlBindingError,
  bindDr133RailwayProductionRuntimeDatabaseUrl,
  dr133RuntimeUrlVariableSetArgs,
  validateDr133RuntimeUrlVariableSetReceipt,
} from '../../scripts/lor-studio/railway-dr133-production-runtime-url-binding.mjs';

const TOKEN = `railway_${'a'.repeat(32)}`;
const PASSWORD = 'b'.repeat(48);
const URL_VALUE = `postgresql://${DR133_RUNTIME_LOGIN}:${PASSWORD}`
  + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`;

function environment() {
  return {
    HOME: '/tmp',
    TMPDIR: '/tmp',
    RAILWAY_API_TOKEN: TOKEN,
    DATABASE_PRIVATE_URL: 'must-not-pass',
    DATABASE_PUBLIC_URL: 'must-not-pass',
    NODE_OPTIONS: '--require=must-not-pass',
    PGOPTIONS: 'must-not-pass',
  };
}

function outcome(stdout, overrides = {}) {
  return Object.freeze({
    exitCode: 0,
    stdout: Buffer.from(stdout),
    stderrBytes: 0,
    childStarted: true,
    spawnFailed: false,
    timedOut: false,
    overflow: false,
    killFailed: false,
    closeObserved: true,
    uncertainChild: false,
    processError: false,
    stdinError: false,
    stdoutError: false,
    stderrError: false,
    executableDrift: false,
    ...overrides,
  });
}

test('runtime URL staging uses one exact no-deploy stdin mutation and emits no secret', async () => {
  const descriptors = [];
  let observedInput;
  const receipt = await bindDr133RailwayProductionRuntimeDatabaseUrl({
    environment: environment(),
    runtimeDatabaseUrl: URL_VALUE,
    async commandRunner(descriptor) {
      descriptors.push(descriptor);
      observedInput = Buffer.from(descriptor.stdin);
      return outcome(JSON.stringify({
        keys: [DR133_RUNTIME_URL_VARIABLE_KEY],
        set: true,
      }));
    },
  });
  assert.deepEqual(receipt, {
    contract: DR133_RUNTIME_URL_BINDING_CONTRACT,
    result: 'RUNTIME_DATABASE_URL_STAGED_NO_DEPLOY_CONFIRMED',
    variableKey: DR133_RUNTIME_URL_VARIABLE_KEY,
  });
  assert.equal(descriptors.length, 1);
  assert.deepEqual(descriptors[0].args, dr133RuntimeUrlVariableSetArgs());
  assert.equal(descriptors[0].args.includes(URL_VALUE), false);
  assert.equal(observedInput.toString('utf8'), URL_VALUE);
  observedInput.fill(0);
  assert.equal(descriptors[0].stdin.every((byte) => byte === 0), true);
  assert.equal(descriptors[0].env.RAILWAY_API_TOKEN, TOKEN);
  assert.equal(Object.hasOwn(descriptors[0].env, 'NODE_OPTIONS'), false);
  assert.equal(Object.hasOwn(descriptors[0].env, 'PGOPTIONS'), false);
  assert.equal(Object.hasOwn(descriptors[0].env, 'DATABASE_PRIVATE_URL'), false);
  assert.equal(Object.hasOwn(descriptors[0].env, 'DATABASE_PUBLIC_URL'), false);
  assert.doesNotMatch(JSON.stringify(receipt), new RegExp(PASSWORD, 'u'));
});

test('runtime URL staging rejects target widening before invoking the provider', async () => {
  for (const value of [
    URL_VALUE.replace(DR133_TARGET.databaseHost, 'other.railway.internal'),
    URL_VALUE.replace(DR133_RUNTIME_LOGIN, 'postgres'),
    URL_VALUE.replace(`:${PASSWORD}@`, ':short@'),
    URL_VALUE.replace('sslmode=require', 'sslmode=disable'),
    `${URL_VALUE}&application_name=unsafe`,
  ]) {
    let invoked = false;
    await assert.rejects(
      bindDr133RailwayProductionRuntimeDatabaseUrl({
        environment: environment(),
        runtimeDatabaseUrl: value,
        async commandRunner() { invoked = true; },
      }),
      (error) => error instanceof Dr133RuntimeUrlBindingError
        && error.code === 'RUNTIME_DATABASE_URL_INVALID'
        && error.bindingState === 'NOT_ATTEMPTED',
    );
    assert.equal(invoked, false);
  }
});

test('started malformed or failed provider outcomes remain staged-unknown without deletion', async () => {
  for (const observed of [
    outcome('{"keys":["WRONG"],"set":true}'),
    outcome('', { exitCode: 1 }),
    outcome('', { timedOut: true, exitCode: null, closeObserved: false, uncertainChild: true }),
  ]) {
    let calls = 0;
    await assert.rejects(
      bindDr133RailwayProductionRuntimeDatabaseUrl({
        environment: environment(),
        runtimeDatabaseUrl: URL_VALUE,
        async commandRunner() { calls += 1; return observed; },
      }),
      (error) => error instanceof Dr133RuntimeUrlBindingError
        && error.code === 'VARIABLE_SET_OUTCOME_UNKNOWN'
        && error.bindingState === 'OUTCOME_UNKNOWN'
        && error.bindingCommitted === true,
    );
    assert.equal(calls, 1);
  }
});

test('a provider command proven not started reports no attempted binding', async () => {
  await assert.rejects(
    bindDr133RailwayProductionRuntimeDatabaseUrl({
      environment: environment(),
      runtimeDatabaseUrl: URL_VALUE,
      async commandRunner() {
        return outcome('', {
          exitCode: null,
          childStarted: false,
          spawnFailed: true,
          closeObserved: false,
        });
      },
    }),
    (error) => error instanceof Dr133RuntimeUrlBindingError
      && error.code === 'VARIABLE_SET_NOT_STARTED'
      && error.bindingState === 'NOT_ATTEMPTED'
      && error.bindingCommitted === false,
  );
});

test('receipt validator accepts only one exact safe key receipt', () => {
  assert.equal(validateDr133RuntimeUrlVariableSetReceipt(Buffer.from(
    JSON.stringify({ keys: [DR133_RUNTIME_URL_VARIABLE_KEY], set: true }),
  )), true);
  for (const value of [
    { keys: [DR133_RUNTIME_URL_VARIABLE_KEY], set: true, value: URL_VALUE },
    { keys: ['OTHER'], set: true },
    { keys: [DR133_RUNTIME_URL_VARIABLE_KEY], set: false },
  ]) {
    assert.throws(
      () => validateDr133RuntimeUrlVariableSetReceipt(Buffer.from(JSON.stringify(value))),
      (error) => error instanceof Dr133RuntimeUrlBindingError
        && error.bindingState === 'OUTCOME_UNKNOWN',
    );
  }
});

test('incident guard forbids broad variable reads and compensating deletes', async () => {
  const source = await readFile(new URL(
    '../../scripts/lor-studio/railway-dr133-production-runtime-url-binding.mjs',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(source, /variable['"],\s*['"]list|variable\s+list|runtimeUrlReadback/u);
  assert.doesNotMatch(source, /variable['"],\s*['"]delete|variable\s+delete|validateDeleteReceipt/u);
  assert.match(source, /'--stdin', '--skip-deploys', '--json'/u);
});
