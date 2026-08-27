import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT,
  createProductionAdministrativeGrantsProbeSurface,
  createProductionAuditProbeSurface,
  createProductionBackupRestoreProbeSurface,
  createProductionDependencyProbes,
  createProductionEntitlementProbeSurface,
  createProductionHydrationProbeSurface,
  createProductionStorageProbeSurface,
} from '../../lor-studio/adapters/production-dependency-probes.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import { BackupRestoreCheckAdapter } from '../../lor-studio/adapters/operational-readiness-adapters.mjs';
import { PrivateVersionedStorageAdapter } from '../../lor-studio/adapters/private-versioned-storage-adapter.mjs';
import {
  createProductionPostgresRuntimeDependencies,
} from '../../lor-studio/adapters/production-postgres-runtime.mjs';
import {
  PRODUCTION_RUNTIME_TARGET_ENV_KEYS,
  PRODUCTION_RUNTIME_TARGET_SCHEMA,
} from '../../lor-studio/adapters/production-runtime-target.mjs';
import {
  createProductionOperationalReadiness,
  createProductionProviderProbeCoordinator,
  productionOperationalReadinessTargetRef,
} from '../../lor-studio/adapters/production-operational-readiness.mjs';
import { createProductionProviderRuntime } from '../../lor-studio/adapters/production-provider-runtime.mjs';
import { MetadataOnlyEventBuffer, StaticEntitlementTestAdapter } from '../../lor-studio/adapters/test-adapters.js';
import { createLorStudioApplication } from '../../lor-studio/composition.mjs';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import { SupabaseDurableArtifactAuditSink } from '../../lor-studio/repositories/supabase-durable-artifact-audit-sink.mjs';
import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import { signedOpenAiPrivacyEnvironment } from './fixtures/signed-openai-privacy-attestations.mjs';

const NOW = new Date('2026-08-26T12:00:00.000Z');
const REQUEST_SCHEMA = 'missionmed.lor.production-provider-probe-request.v1';
const SAFE_EVIDENCE_SCHEMA = 'missionmed.lor.production-dependency-safe-evidence.v1';
const SEALED_RESULT_SCHEMA = 'missionmed.lor.production-dependency-sealed-result.v1';
const PRODUCTION_CA = await readFile(
  new URL('./dr133-production-root-ca.pem', import.meta.url),
  'utf8',
);
const DEPLOYMENT_ID = '00000000-0000-4000-8000-000000000202';

class ReadinessPool {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    this.listeners.set(event, listener);
    return this;
  }

  removeListener(event, listener) {
    if (this.listeners.get(event) === listener) this.listeners.delete(event);
    return this;
  }

  async connect() {
    throw new Error('focused surface tests must not query PostgreSQL');
  }

  async end() {}
}

function configuration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'production',
    provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId,
    environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId,
    databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region,
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

function providerEnvironment() {
  return {
    MMHQ_LOR_OPENAI_API_KEY: 'sk-proj-bounded-test-token',
    MMHQ_LOR_OPENAI_PROJECT_ID: 'proj_lordependencyprobe',
    ...signedOpenAiPrivacyEnvironment('proj_lordependencyprobe'),
    MMHQ_LOR_POSTMARK_SERVER_TOKEN: 'postmark-bounded-test-token',
    MMHQ_LOR_POSTMARK_SERVER_ID: '12345',
    MMHQ_LOR_POSTMARK_FROM_EMAIL: 'letters@example.test',
    MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL: 'support@example.test',
    MMHQ_LOR_INVITATION_ORIGIN: 'https://hq.example.test',
    MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED: 'true',
    MMHQ_LOR_INVITATION_HMAC_KEY: Buffer.alloc(32, 11).toString('base64url'),
    MMHQ_LOR_INVITATION_HMAC_KEY_VERSION: 'lor-dependency-v1',
    MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED: 'true',
  };
}

function jsonResponse(url, payload) {
  return {
    url,
    status: 200,
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    async text() { return JSON.stringify(payload); },
  };
}

async function providerRuntime(fetchCalls = []) {
  return createProductionProviderRuntime({
    environment: providerEnvironment(),
    clock: () => NOW,
    async fetchImplementation(url, options) {
      fetchCalls.push({ url, method: options.method });
      if (url.endsWith('/v1/models')) {
        return jsonResponse(url, { object: 'list', data: [{ id: 'gpt-5.6-terra' }] });
      }
      return jsonResponse(url, {
        Alias: 'lor-faculty-invitation-v1',
        Active: true,
        AssociatedServerId: 12345,
      });
    },
  });
}

function postgresEnvironment() {
  return {
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.schemaVersion]: PRODUCTION_RUNTIME_TARGET_SCHEMA,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.environmentName]: DR133_TARGET.environmentName,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId]: DR133_TARGET.applicationServiceId,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseHost]: DR133_TARGET.databaseHost,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseAdmin]: DR133_TARGET.databaseAdmin,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.runtimeLogin]: DR133_RUNTIME_LOGIN,
    LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
    LOR_DR133_RUNTIME_DATABASE_URL:
      `postgresql://${DR133_RUNTIME_LOGIN}:bounded-production-probe-password`
      + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`,
    RAILWAY_DEPLOYMENT_ID: DEPLOYMENT_ID,
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_REPLICA_REGION: DR133_TARGET.region,
    RAILWAY_SERVICE_ID: DR133_TARGET.applicationServiceId,
  };
}

const productionBinding = resolveLorTargetBinding(configuration());
const postgresDependencies = createProductionPostgresRuntimeDependencies(productionBinding, {
  environment: postgresEnvironment(),
  PoolClass: ReadinessPool,
});
test.after(async () => postgresDependencies.close());

function productionDatabaseReadiness() {
  return postgresDependencies.readiness;
}

function auditSink(binding) {
  return new SupabaseDurableArtifactAuditSink({
    binding,
    driver: {
      rlsEnforced: true,
      serverOnly: true,
      databaseClock: true,
      appendOnlyArtifactAudit: true,
      async appendArtifactExportAuditAtomic() {},
    },
    async scopeProvider() {},
  });
}

function backupRestoreAdapter(checker = async () => ({ passed: true, errorCode: '' })) {
  return new BackupRestoreCheckAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      syntheticOnly: true,
      isolatedRestoreTarget: true,
      databaseAndAuditTogether: true,
      storageVersionManifest: true,
    },
    checker: { runCheck: checker },
    clock: () => NOW,
  });
}

function signedS2sEntitlementResolver() {
  return Object.freeze({
    signedS2s: true,
    async resolve() {},
  });
}

function hydrationApplication() {
  const composed = createLorStudioApplication({
    targetConfiguration: configuration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
    testRepository: new InMemoryRecommendationCaseRepository(),
    eventSink: new MetadataOnlyEventBuffer(),
    allowNonDurableForTests: true,
    clock: () => NOW,
  });
  assert.ok(composed.application);
  return composed.application;
}

function storageAdapter() {
  return new PrivateVersionedStorageAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      bucket: 'lor-writer-depot',
      private: true,
      versioned: true,
      serverMediated: true,
      policyVerified: true,
      storageIdentity: 'postgres-encrypted-storage-test',
    },
    driver: {
      privateOnly: true,
      immutableVersions: true,
      serverOnly: true,
      async putImmutable() {},
      async getImmutable() {},
    },
    capabilityProvider: { async resolveStorageCapability() {} },
    clock: () => NOW,
  });
}

function successfulOperation(calls, dependency) {
  return async (request, sealResult, runtimeSurface) => {
    calls.push({ request, runtimeSurface });
    return sealResult(Object.freeze({
      schemaVersion: SAFE_EVIDENCE_SCHEMA,
      dependency,
      targetRef: request.targetRef,
      operation: PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT.operations[dependency],
      metadataOnly: true,
      protectedContentObserved: false,
      secretMaterialObserved: false,
      evidenceRef: sha256(`safe-live-operation:${dependency}`),
    }));
  };
}

function surfaceOptions(binding, calls, overrides = {}) {
  const operation = (dependency) => overrides[dependency] ?? successfulOperation(calls, dependency);
  return {
    administrativeGrants: createProductionAdministrativeGrantsProbeSurface({
      binding,
      readiness: productionDatabaseReadiness(),
      operation: operation('administrativeGrants'),
    }),
    audit: createProductionAuditProbeSurface({
      binding,
      auditSink: auditSink(binding),
      operation: operation('audit'),
    }),
    backupRestore: createProductionBackupRestoreProbeSurface({
      binding,
      adapter: overrides.backupRestoreAdapter ?? backupRestoreAdapter(),
    }),
    entitlement: createProductionEntitlementProbeSurface({
      binding,
      resolver: signedS2sEntitlementResolver(),
      operation: operation('entitlement'),
    }),
    hydration: createProductionHydrationProbeSurface({
      binding,
      application: hydrationApplication(),
      operation: operation('hydration'),
    }),
    storage: createProductionStorageProbeSurface({
      binding,
      adapter: storageAdapter(),
      operation: operation('storage'),
    }),
  };
}

async function harness({ binding = resolveLorTargetBinding(configuration()), overrides = {} } = {}) {
  const calls = [];
  const fetchCalls = [];
  const runtime = await providerRuntime(fetchCalls);
  const surfaces = surfaceOptions(binding, calls, overrides);
  const options = { binding, providerRuntime: runtime, ...surfaces };
  return { binding, calls, fetchCalls, options, runtime, surfaces };
}

function coordinatorRequest(binding, dependency, controller = new AbortController()) {
  return Object.freeze({
    schemaVersion: REQUEST_SCHEMA,
    dependency,
    targetRef: productionOperationalReadinessTargetRef(binding),
    metadataOnly: true,
    signal: controller.signal,
  });
}

function statusOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    return error.details.status;
  }
  return assert.fail('expected fail-closed construction');
}

async function rejectionStatus(promise) {
  try {
    await promise;
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    return error.details.status;
  }
  return assert.fail('expected fail-closed probe');
}

test('builder maps the exact nine dependencies, reuses authentic provider probes, and emits only safe hashes', async () => {
  const context = await harness();
  const probes = createProductionDependencyProbes(context.options);
  assert.equal(Object.isFrozen(probes), true);
  assert.deepEqual(Object.keys(probes), PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT.dependencies);
  assert.equal(probes.ai, context.runtime.probes.ai);
  assert.equal(probes.email, context.runtime.probes.email);
  assert.equal(probes.otp, context.runtime.probes.otp);

  const results = {};
  for (const dependency of PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT.dependencies) {
    results[dependency] = await probes[dependency](coordinatorRequest(context.binding, dependency));
    assert.deepEqual(Object.keys(results[dependency]).sort(), ['errorCode', 'evidenceRef', 'state']);
    assert.equal(results[dependency].state, 'ready');
    assert.equal(results[dependency].errorCode, '');
    assert.match(results[dependency].evidenceRef, /^[a-f0-9]{64}$/u);
  }
  assert.deepEqual(
    context.calls.map(({ request }) => request.dependency),
    ['administrativeGrants', 'audit', 'entitlement', 'hydration', 'storage'],
  );
  for (const { request, runtimeSurface } of context.calls) {
    assert.equal(Object.isFrozen(request), true);
    assert.equal(request.schemaVersion, 'missionmed.lor.production-dependency-operation-request.v1');
    assert.equal(request.metadataOnly, true);
    assert.equal(request.syntheticOnly, true);
    assert.equal(request.protectedContentPermitted, false);
    assert.equal(request.operation, PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT.operations[request.dependency]);
    assert.equal(request.signal instanceof AbortSignal, true);
    assert.equal(typeof runtimeSurface, 'object');
  }
  assert.deepEqual(context.fetchCalls.map(({ method }) => method), ['GET', 'GET']);
  assert.doesNotMatch(
    JSON.stringify(results),
    /sk-proj|postmark-bounded|protected-content|secret-material/iu,
  );
});

test('the exact probe set is accepted by the trusted coordinator and can mint fresh readiness', async () => {
  const context = await harness();
  const probes = createProductionDependencyProbes(context.options);
  const coordinator = createProductionProviderProbeCoordinator({
    binding: context.binding,
    probes,
    probeTimeoutMilliseconds: 100,
  });
  const readiness = createProductionOperationalReadiness({
    binding: context.binding,
    runtimeReadiness: {
      async probe() {
        return {
          ready: true,
          reasonCode: 'READY',
          groups: { auditCatalog: true, database: true, repository: true, rls: true },
        };
      },
    },
    trustedProbeCoordinator: coordinator,
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => NOW,
  });
  const snapshot = await readiness.snapshot();
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.productionOperational, true);
  assert.equal(Object.values(snapshot.dependencies).every(({ state }) => state === 'ready'), true);
  assert.doesNotMatch(JSON.stringify(snapshot), /evidenceRef|targetRef|credential|protected/iu);
});

test('missing or extra builder and provider functions fail closed before any surface is claimed', async () => {
  const missingBuilder = await harness();
  const { storage: omitted, ...missingOptions } = missingBuilder.options;
  assert.ok(omitted);
  assert.equal(
    statusOf(() => createProductionDependencyProbes(missingOptions)),
    'PROBE_SET_OPTIONS_INVALID',
  );

  const extraBuilder = await harness();
  assert.equal(statusOf(() => createProductionDependencyProbes({
    ...extraBuilder.options,
    unexpected: async () => {},
  })), 'PROBE_SET_OPTIONS_INVALID');

  const missingProvider = await harness();
  const { otp: omittedOtp, ...twoProbes } = missingProvider.runtime.probes;
  assert.equal(typeof omittedOtp, 'function');
  const runtimeWithoutOtp = Object.freeze({
    ...missingProvider.runtime,
    probes: Object.freeze(twoProbes),
  });
  assert.equal(statusOf(() => createProductionDependencyProbes({
    ...missingProvider.options,
    providerRuntime: runtimeWithoutOtp,
  })), 'COMPLETE_PROVIDER_RUNTIME_PROBES_REQUIRED');

  const extraProvider = await harness();
  const runtimeWithExtra = Object.freeze({
    ...extraProvider.runtime,
    probes: Object.freeze({ ...extraProvider.runtime.probes, storage: async () => {} }),
  });
  assert.equal(statusOf(() => createProductionDependencyProbes({
    ...extraProvider.options,
    providerRuntime: runtimeWithExtra,
  })), 'COMPLETE_PROVIDER_RUNTIME_PROBES_REQUIRED');
});

test('raw look-alikes, cross-target surfaces, and replayed surfaces cannot acquire readiness authority', async () => {
  const bindingForBrands = resolveLorTargetBinding(configuration());
  const operation = successfulOperation([], 'administrativeGrants');
  const readiness = productionDatabaseReadiness();
  for (const lookAlike of [
    Object.freeze({ async probe() {} }),
    Object.freeze({ probe: readiness.probe }),
    Object.freeze({ ...readiness }),
  ]) {
    assert.equal(statusOf(() => createProductionAdministrativeGrantsProbeSurface({
      binding: bindingForBrands,
      readiness: lookAlike,
      operation,
    })), 'AUTHENTIC_PRODUCTION_DATABASE_READINESS_REQUIRED');
  }
  assert.equal(statusOf(() => createProductionAdministrativeGrantsProbeSurface({
    binding: bindingForBrands,
    repository: Object.freeze({}),
    operation,
  })), 'ADMINISTRATIVEGRANTS_SURFACE_OPTIONS_INVALID');

  const application = hydrationApplication();
  for (const lookAlike of [
    Object.freeze({ async getBootstrap() {}, async handleRequest() {} }),
    Object.freeze({
      getBootstrap: application.getBootstrap,
      handleRequest: application.handleRequest,
    }),
    Object.freeze({ ...application }),
  ]) {
    assert.equal(statusOf(() => createProductionHydrationProbeSurface({
      binding: bindingForBrands,
      application: lookAlike,
      operation: successfulOperation([], 'hydration'),
    })), 'AUTHENTIC_PRODUCTION_HYDRATION_APPLICATION_REQUIRED');
  }
  assert.equal(statusOf(() => createProductionHydrationProbeSurface({
    binding: bindingForBrands,
    adapter: Object.freeze({ async hydrate() {} }),
    operation: successfulOperation([], 'hydration'),
  })), 'HYDRATION_SURFACE_OPTIONS_INVALID');

  const forged = await harness();
  const forgedAdministrative = Object.freeze({ ...forged.surfaces.administrativeGrants });
  assert.equal(statusOf(() => createProductionDependencyProbes({
    ...forged.options,
    administrativeGrants: forgedAdministrative,
  })), 'COMPLETE_BOUND_DEPENDENCY_SURFACES_REQUIRED');

  const binding = resolveLorTargetBinding(configuration());
  const otherBinding = resolveLorTargetBinding(configuration({ projectId: 'lor-other-probe-project' }));
  const crossTarget = await harness({ binding });
  const otherCalls = [];
  const otherAdministrative = createProductionAdministrativeGrantsProbeSurface({
    binding: otherBinding,
    readiness: productionDatabaseReadiness(),
    operation: successfulOperation(otherCalls, 'administrativeGrants'),
  });
  assert.equal(statusOf(() => createProductionDependencyProbes({
    ...crossTarget.options,
    administrativeGrants: otherAdministrative,
  })), 'BOUND_DEPENDENCY_SURFACE_TARGET_MISMATCH');

  const replay = await harness();
  createProductionDependencyProbes(replay.options);
  assert.equal(
    statusOf(() => createProductionDependencyProbes(replay.options)),
    'BOUND_DEPENDENCY_SURFACE_REPLAYED',
  );

  const invalidSurface = resolveLorTargetBinding(configuration({ projectId: 'lor-invalid-surface-project' }));
  assert.equal(statusOf(() => createProductionStorageProbeSurface({
    binding: invalidSurface,
    adapter: storageAdapter(),
  })), 'STORAGE_SURFACE_OPTIONS_INVALID');
  assert.equal(statusOf(() => createProductionStorageProbeSurface({
    binding: invalidSurface,
    adapter: storageAdapter(),
    operation: successfulOperation([], 'storage'),
    extra: true,
  })), 'STORAGE_SURFACE_OPTIONS_INVALID');
});

test('shape-forged, secret-shaped, throwing, and aborted explicit operations fail closed without leakage', async () => {
  const rawShape = await harness({
    overrides: {
      administrativeGrants: async () => Object.freeze({
        schemaVersion: SEALED_RESULT_SCHEMA,
        dependency: 'administrativeGrants',
        metadataOnly: true,
        targetBound: true,
        operational: true,
      }),
    },
  });
  const rawProbes = createProductionDependencyProbes(rawShape.options);
  assert.equal(
    await rejectionStatus(rawProbes.administrativeGrants(
      coordinatorRequest(rawShape.binding, 'administrativeGrants'),
    )),
    'SEALED_DEPENDENCY_RESULT_REQUIRED',
  );

  const secretMarker = 'credential-marker-that-must-not-escape';
  const secretShape = await harness({
    overrides: {
      audit: async (request, sealResult) => sealResult(Object.freeze({
        schemaVersion: SAFE_EVIDENCE_SCHEMA,
        dependency: 'audit',
        targetRef: request.targetRef,
        operation: PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT.operations.audit,
        metadataOnly: true,
        protectedContentObserved: false,
        secretMaterialObserved: false,
        evidenceRef: sha256('safe-audit-evidence'),
        token: secretMarker,
      })),
    },
  });
  const secretProbes = createProductionDependencyProbes(secretShape.options);
  let secretError;
  try {
    await secretProbes.audit(coordinatorRequest(secretShape.binding, 'audit'));
  } catch (error) {
    secretError = error;
  }
  assert.equal(secretError?.details?.status, 'SAFE_DEPENDENCY_EVIDENCE_INVALID');
  assert.doesNotMatch(JSON.stringify(secretError), new RegExp(secretMarker, 'u'));

  const throwing = await harness({
    overrides: {
      entitlement: async () => { throw new Error(secretMarker); },
    },
  });
  const throwingProbes = createProductionDependencyProbes(throwing.options);
  await assert.rejects(
    throwingProbes.entitlement(coordinatorRequest(throwing.binding, 'entitlement')),
    (error) => {
      assert.equal(error.details?.status, 'DEPENDENCY_PROBE_FAILED');
      assert.doesNotMatch(`${error.message}\n${JSON.stringify(error)}`, new RegExp(secretMarker, 'u'));
      return true;
    },
  );

  let downstreamSignal;
  const hanging = await harness({
    overrides: {
      storage: async (request) => {
        downstreamSignal = request.signal;
        return new Promise(() => {});
      },
    },
  });
  const hangingProbes = createProductionDependencyProbes(hanging.options);
  const controller = new AbortController();
  const pending = hangingProbes.storage(coordinatorRequest(hanging.binding, 'storage', controller));
  controller.abort();
  assert.equal(await rejectionStatus(pending), 'DEPENDENCY_PROBE_ABORTED');
  assert.equal(downstreamSignal, controller.signal);
});

test('malformed requests and failed restore rehearsals cannot produce safe readiness evidence', async () => {
  const malformed = await harness();
  const probes = createProductionDependencyProbes(malformed.options);
  const request = coordinatorRequest(malformed.binding, 'storage');
  assert.equal(await rejectionStatus(probes.storage({ ...request })), 'COORDINATOR_PROBE_REQUEST_INVALID');
  assert.equal(await rejectionStatus(probes.storage(Object.freeze({
    ...request,
    unexpected: true,
  }))), 'COORDINATOR_PROBE_REQUEST_INVALID');
  assert.equal(await rejectionStatus(probes.storage(Object.freeze({
    ...request,
    dependency: 'audit',
  }))), 'COORDINATOR_PROBE_REQUEST_INVALID');

  const failedRestore = await harness({
    overrides: {
      backupRestoreAdapter: backupRestoreAdapter(async () => ({
        passed: false,
        errorCode: 'TOKEN_DO_NOT_EXPOSE',
      })),
    },
  });
  const failedRestoreProbes = createProductionDependencyProbes(failedRestore.options);
  let error;
  try {
    await failedRestoreProbes.backupRestore(
      coordinatorRequest(failedRestore.binding, 'backupRestore'),
    );
  } catch (caught) {
    error = caught;
  }
  assert.equal(error?.details?.status, 'BACKUP_RESTORE_RESULT_INVALID');
  assert.doesNotMatch(JSON.stringify(error), /TOKEN_DO_NOT_EXPOSE/u);
});
