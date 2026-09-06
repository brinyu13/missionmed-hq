import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCTION_OPERATIONAL_READINESS_CONTRACT,
  PRODUCTION_PROVIDER_PROBE_COORDINATOR_SCHEMA,
  createProductionOperationalReadiness,
  createProductionProviderProbeCoordinator,
  productionOperationalReadinessTargetRef,
} from '../../lor-studio/adapters/production-operational-readiness.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import { sha256 } from '../../lor-studio/domain/value-utils.js';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function productionConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'production',
    provider: 'railway-postgres',
    projectId: 'lor-provider-probe-project',
    environmentId: 'lor-provider-probe-environment',
    serviceId: 'lor-provider-probe-service',
    databaseName: 'railway',
    region: 'us-west2',
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/production',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: true,
    ...overrides,
  };
}

function runtimeReadiness() {
  return {
    async probe() {
      return {
        ready: true,
        reasonCode: 'READY',
        groups: {
          auditCatalog: true,
          database: true,
          repository: true,
          rls: true,
        },
      };
    },
  };
}

function greenProbes({ calls = [], override = {} } = {}) {
  return Object.fromEntries(
    PRODUCTION_OPERATIONAL_READINESS_CONTRACT.providerReceiptDependencies.map((dependency) => [
      dependency,
      override[dependency] ?? (async (request) => {
        calls.push(request);
        return {
          state: 'ready',
          errorCode: '',
          evidenceRef: sha256(`bounded-provider-probe:${dependency}`),
        };
      }),
    ]),
  );
}

function failureStatus(fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    return error.details.status;
  }
  return assert.fail('expected production readiness to fail closed');
}

test('a branded coordinator probes every exact dependency freshly and exposes metadata only', async () => {
  const binding = resolveLorTargetBinding(productionConfiguration());
  const calls = [];
  const coordinator = createProductionProviderProbeCoordinator({
    binding,
    probes: greenProbes({ calls }),
  });
  assert.deepEqual(coordinator, {
    schemaVersion: PRODUCTION_PROVIDER_PROBE_COORDINATOR_SCHEMA,
    metadataOnly: true,
    targetBound: true,
  });
  assert.equal(Object.isFrozen(coordinator), true);

  const readiness = createProductionOperationalReadiness({
    binding,
    runtimeReadiness: runtimeReadiness(),
    trustedProbeCoordinator: coordinator,
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => NOW,
  });
  const first = await readiness.snapshot();
  const second = await readiness.snapshot();

  assert.equal(first.status, 'ready');
  assert.equal(first.productionOperational, true);
  assert.equal(second.status, 'ready');
  assert.equal(second.productionOperational, true);
  assert.equal(
    calls.length,
    PRODUCTION_OPERATIONAL_READINESS_CONTRACT.providerReceiptDependencies.length * 2,
    'every snapshot must run a new complete probe generation instead of replaying receipts',
  );
  const expectedTargetRef = productionOperationalReadinessTargetRef(binding);
  for (const request of calls) {
    assert.equal(request.metadataOnly, true);
    assert.equal(request.targetRef, expectedTargetRef);
    assert.equal(Object.isFrozen(request), true);
    assert.equal(request.signal instanceof AbortSignal, true);
  }
  assert.doesNotMatch(
    JSON.stringify(first),
    /evidenceRef|targetRef|bounded-provider-probe|content|secret/iu,
  );
});

test('raw or shape-forged receipt authority remains unable to mint readiness', async () => {
  const binding = resolveLorTargetBinding(productionConfiguration());
  const targetRef = productionOperationalReadinessTargetRef(binding);
  const rawReceipts = Object.fromEntries(
    PRODUCTION_OPERATIONAL_READINESS_CONTRACT.providerReceiptDependencies.map((dependency) => [
      dependency,
      {
        schemaVersion: 'missionmed.lor.production-dependency-receipt.v1',
        dependency,
        state: 'ready',
        errorCode: '',
        targetRef,
        evidenceRef: sha256(`caller-minted:${dependency}`),
        observedAt: '2026-08-26T12:00:00.000Z',
        expiresAt: '2026-08-26T12:02:00.000Z',
      },
    ]),
  );
  const rawReadiness = createProductionOperationalReadiness({
    binding,
    runtimeReadiness: runtimeReadiness(),
    providerReceipts: rawReceipts,
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => NOW,
  });
  const snapshot = await rawReadiness.snapshot();
  assert.equal(snapshot.status, 'blocked');
  assert.equal(snapshot.productionOperational, false);

  assert.equal(failureStatus(() => createProductionOperationalReadiness({
    binding,
    runtimeReadiness: runtimeReadiness(),
    trustedProbeCoordinator: {
      schemaVersion: PRODUCTION_PROVIDER_PROBE_COORDINATOR_SCHEMA,
      metadataOnly: true,
      targetBound: true,
    },
  })), 'TRUSTED_PROBE_COORDINATOR_INVALID');
});

test('one coordinator is single-claim and cannot cross an exact target boundary', () => {
  const binding = resolveLorTargetBinding(productionConfiguration());
  const otherBinding = resolveLorTargetBinding(productionConfiguration({
    projectId: 'lor-provider-probe-other-project',
  }));
  const replayed = createProductionProviderProbeCoordinator({
    binding,
    probes: greenProbes(),
  });
  createProductionOperationalReadiness({
    binding,
    runtimeReadiness: runtimeReadiness(),
    trustedProbeCoordinator: replayed,
  });
  assert.equal(failureStatus(() => createProductionOperationalReadiness({
    binding,
    runtimeReadiness: runtimeReadiness(),
    trustedProbeCoordinator: replayed,
  })), 'TRUSTED_PROBE_COORDINATOR_REPLAYED');

  const crossTarget = createProductionProviderProbeCoordinator({
    binding,
    probes: greenProbes(),
  });
  assert.equal(failureStatus(() => createProductionOperationalReadiness({
    binding: otherBinding,
    runtimeReadiness: runtimeReadiness(),
    trustedProbeCoordinator: crossTarget,
  })), 'TRUSTED_PROBE_COORDINATOR_TARGET_MISMATCH');
});

test('probe sets and results are exact data-only surfaces and fail closed without leakage', async () => {
  const binding = resolveLorTargetBinding(productionConfiguration());
  const missing = greenProbes();
  delete missing.storage;
  assert.equal(failureStatus(() => createProductionProviderProbeCoordinator({
    binding,
    probes: missing,
  })), 'COMPLETE_PROVIDER_PROBES_REQUIRED');

  const extra = greenProbes();
  extra.unexpected = async () => ({
    state: 'ready',
    errorCode: '',
    evidenceRef: sha256('unexpected'),
  });
  assert.equal(failureStatus(() => createProductionProviderProbeCoordinator({
    binding,
    probes: extra,
  })), 'COMPLETE_PROVIDER_PROBES_REQUIRED');

  const coordinator = createProductionProviderProbeCoordinator({
    binding,
    probes: greenProbes({
      override: {
        storage: async () => ({
          state: 'ready',
          errorCode: '',
          evidenceRef: sha256('storage-safe-evidence'),
          content: 'protected-content-must-never-escape',
        }),
      },
    }),
  });
  const readiness = createProductionOperationalReadiness({
    binding,
    runtimeReadiness: runtimeReadiness(),
    trustedProbeCoordinator: coordinator,
    flags: { enabled: true, killSwitch: false, requireCanary: false },
    clock: () => NOW,
  });
  const snapshot = await readiness.snapshot();
  assert.equal(snapshot.status, 'blocked');
  assert.equal(snapshot.dependencies.storage.state, 'unavailable');
  assert.equal(snapshot.dependencies.storage.errorCode, 'DEPENDENCY_NOT_BOUND');
  assert.doesNotMatch(JSON.stringify(snapshot), /protected-content-must-never-escape/u);
});
