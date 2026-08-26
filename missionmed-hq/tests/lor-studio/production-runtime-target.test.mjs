import assert from 'node:assert/strict';
import test from 'node:test';

import { IntegrationDisabledError } from '../../lor-studio/domain/errors.js';
import { resolveLorTargetBinding } from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  PRODUCTION_RUNTIME_TARGET_CONTRACT,
  PRODUCTION_RUNTIME_TARGET_ENV_KEYS,
  PRODUCTION_RUNTIME_TARGET_SCHEMA,
  assertResolvedProductionRuntimeTarget,
  resolveProductionRuntimeTarget,
} from '../../lor-studio/adapters/production-runtime-target.mjs';
import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  expectedDr133SuccessorSentinel,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';

function configuration(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.target-binding.v2',
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'staging',
    provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId,
    environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId,
    databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region,
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/staging',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
    ...overrides,
  };
}

function environment(overrides = {}) {
  return {
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.schemaVersion]: PRODUCTION_RUNTIME_TARGET_SCHEMA,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.environmentName]: DR133_TARGET.environmentName,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId]: DR133_TARGET.executionServiceId,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseHost]: DR133_TARGET.databaseHost,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseAdmin]: DR133_TARGET.databaseAdmin,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.runtimeLogin]: DR133_RUNTIME_LOGIN,
    ...overrides,
  };
}

function statusIs(expected) {
  return (error) => error instanceof IntegrationDisabledError
    && error.details?.status === expected;
}

test('resolves the existing exact staging target without importing it as a runtime default', () => {
  const binding = resolveLorTargetBinding(configuration());
  const target = resolveProductionRuntimeTarget(binding, environment());

  assert.equal(Object.isFrozen(target), true);
  assert.equal(assertResolvedProductionRuntimeTarget(target), target);
  assert.equal(target.projectId, binding.projectId);
  assert.equal(target.environmentId, binding.environmentId);
  assert.equal(target.databaseServiceId, binding.serviceId);
  assert.equal(target.executionServiceId, DR133_TARGET.executionServiceId);
  assert.equal(target.successorSentinel, expectedDr133SuccessorSentinel());
  assert.equal(JSON.stringify(target).includes('password'), false);
  assert.throws(
    () => assertResolvedProductionRuntimeTarget({ ...target }),
    statusIs('RESOLVED_RUNTIME_TARGET_REQUIRED'),
  );
});

test('derives a distinct production sentinel and identity from the validated production binding', () => {
  const binding = resolveLorTargetBinding(configuration({
    environment: 'production',
    projectId: '11111111-1111-4111-8111-111111111111',
    environmentId: '22222222-2222-4222-8222-222222222222',
    serviceId: '33333333-3333-4333-8333-333333333333',
    region: 'us-east4',
    migrationLedger: 'lor_studio/migrations/production',
    productionDataBindingPassed: true,
  }));
  const target = resolveProductionRuntimeTarget(binding, environment({
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.environmentName]: 'production',
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId]:
      '44444444-4444-4444-8444-444444444444',
  }));

  assert.equal(target.deploymentEnvironment, 'production');
  assert.equal(target.projectId, binding.projectId);
  assert.equal(target.databaseServiceId, binding.serviceId);
  assert.equal(target.environmentName, 'production');
  assert.match(target.successorSentinel, /project=11111111-1111-4111-8111-111111111111/u);
  assert.match(target.successorSentinel, /service=33333333-3333-4333-8333-333333333333/u);
  assert.doesNotMatch(target.successorSentinel, new RegExp(DR133_TARGET.projectId, 'u'));
  assert.notEqual(target.successorSentinel, expectedDr133SuccessorSentinel());
});

test('rejects an exact staging tuple relabeled as production and any alternate staging tuple', () => {
  const relabeledStaging = resolveLorTargetBinding(configuration({
    environment: 'production',
    migrationLedger: 'lor_studio/migrations/production',
    productionDataBindingPassed: true,
  }));
  assert.throws(
    () => resolveProductionRuntimeTarget(relabeledStaging, environment()),
    statusIs('RUNTIME_TARGET_PRODUCTION_IDENTITY_MISMATCH'),
  );

  const alternateStaging = resolveLorTargetBinding(configuration({
    projectId: '11111111-1111-4111-8111-111111111111',
    environmentId: '22222222-2222-4222-8222-222222222222',
    serviceId: '33333333-3333-4333-8333-333333333333',
  }));
  assert.throws(
    () => resolveProductionRuntimeTarget(alternateStaging, environment({
      [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.environmentName]: 'alternate-staging',
      [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId]:
        '44444444-4444-4444-8444-444444444444',
    })),
    statusIs('RUNTIME_TARGET_STAGING_IDENTITY_MISMATCH'),
  );
});

test('fails closed for absent, partial, accessor, forged, or altered runtime target identity', () => {
  const binding = resolveLorTargetBinding(configuration());
  assert.throws(
    () => resolveProductionRuntimeTarget(binding, {}),
    statusIs('RUNTIME_TARGET_CONFIGURATION_REQUIRED'),
  );
  assert.throws(
    () => resolveProductionRuntimeTarget(binding, environment({
      MMHQ_LOR_STUDIO_RUNTIME_TARGET_PASSWORD: 'must-not-be-accepted',
    })),
    statusIs('RUNTIME_TARGET_CONFIGURATION_REQUIRED'),
  );
  assert.throws(
    () => resolveProductionRuntimeTarget({ ...binding }, environment()),
    (error) => error instanceof IntegrationDisabledError,
  );

  const accessor = environment();
  Object.defineProperty(accessor, PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId, {
    enumerable: true,
    get() { throw new Error('must not execute'); },
  });
  assert.throws(
    () => resolveProductionRuntimeTarget(binding, accessor),
    statusIs('RUNTIME_TARGET_CONFIGURATION_REQUIRED'),
  );

  for (const [key, value] of [
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.schemaVersion, 'missionmed.lor.production-runtime-target.v0'],
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.environmentName, 'production secret'],
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId, DR133_TARGET.databaseServiceId],
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseHost, 'public.example.test'],
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseAdmin, 'admin'],
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.runtimeLogin, 'postgres'],
  ]) {
    assert.throws(
      () => resolveProductionRuntimeTarget(binding, environment({ [key]: value })),
      (error) => error instanceof IntegrationDisabledError,
    );
  }
});

test('contract exposes no default, fallback, or secret configuration field', () => {
  assert.equal(PRODUCTION_RUNTIME_TARGET_CONTRACT.defaultTarget, null);
  assert.equal(PRODUCTION_RUNTIME_TARGET_CONTRACT.fallbackTarget, null);
  assert.equal(PRODUCTION_RUNTIME_TARGET_CONTRACT.secretConfiguration, 'prohibited');
  assert.equal(PRODUCTION_RUNTIME_TARGET_CONTRACT.runtimeLogin, DR133_RUNTIME_LOGIN);
  assert.equal(PRODUCTION_RUNTIME_TARGET_CONTRACT.databaseHost, DR133_TARGET.databaseHost);
  assert.equal(PRODUCTION_RUNTIME_TARGET_CONTRACT.databaseAdmin, DR133_TARGET.databaseAdmin);
  assert.equal(
    Object.values(PRODUCTION_RUNTIME_TARGET_ENV_KEYS).some((key) => /secret|token|password/iu.test(key)),
    false,
  );
});
