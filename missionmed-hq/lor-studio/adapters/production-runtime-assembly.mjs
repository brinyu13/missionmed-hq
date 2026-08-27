import { IntegrationDisabledError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';
import { DurableFacultyCandidateAuthService, isAuthenticDurableFacultyCandidateAuthService } from '../services/durable-faculty-candidate-auth-service.mjs';
import {
  createLorStudioApplication,
  createReadinessGatedLorStudioApplication,
} from '../composition.mjs';
import { resolveLorTargetBinding } from './lor-target-binding.mjs';
import { createPostgresEncryptedPrivateStorageAdapterFromEnvironment } from './postgres-encrypted-private-storage.mjs';
import {
  createProductionAdministrativeGrantsProbeSurface,
  createProductionAuditProbeSurface,
  createProductionBackupRestoreProbeSurface,
  createProductionDependencyProbes,
  createProductionEntitlementProbeSurface,
  createProductionHydrationProbeSurface,
  createProductionStorageProbeSurface,
} from './production-dependency-probes.mjs';
import {
  createProductionProviderProbeCoordinator,
  productionOperationalReadinessTargetRef,
} from './production-operational-readiness.mjs';
import { createProductionPostgresRuntimeDependencies } from './production-postgres-runtime.mjs';
import { createProductionProviderRuntime } from './production-provider-runtime.mjs';
import { createWordPressCurrentUserAdmission } from './wordpress-current-user-admission.mjs';
import {
  WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER,
  WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_CONTRACT,
} from './wordpress-lor-s2s-protocol.mjs';

const INTEGRATION = 'lor_production_runtime_assembly';
const SAFE_EVIDENCE_SCHEMA = 'missionmed.lor.production-dependency-safe-evidence.v1';
const ASSEMBLY_CONTRACT_SCHEMA = 'missionmed.lor.production-runtime-assembly.v1';
const OPERATION_REQUEST_SCHEMA = 'missionmed.lor.production-dependency-operation-request.v1';
const SHA256 = /^[a-f0-9]{64}$/u;

const OPTION_KEYS = new Set([
  'backupRestoreAdapter',
  'clock',
  'environment',
  'fetchImplementation',
  'poolClass',
  'probeTimeoutMilliseconds',
  'releaseFlags',
  'resourceEntitlementResolver',
  'signal',
  'targetConfiguration',
  'wordpressS2sClient',
]);
const RELEASE_FLAG_KEYS = new Set(['enabled', 'killSwitch', 'requireCanary']);
const S2S_CLIENT_KEYS = new Set([
  'admit',
  'getResourceStudentEntitlement',
  'probeResourceStudentEntitlement',
  'redeemBootstrap',
  'resourceEntitlementPort',
  'revokeBinding',
]);
const RESOURCE_RESOLVER_KEYS = new Set(['probe', 'resolve', 'signedS2s']);
const OPERATION_REQUEST_KEYS = new Set([
  'dependency',
  'metadataOnly',
  'operation',
  'protectedContentPermitted',
  'schemaVersion',
  'signal',
  'syntheticOnly',
  'targetRef',
]);
const RESOURCE_ENTITLEMENT_PROBE_KEYS = new Set([
  'audience',
  'contract',
  'evaluatedAt',
  'expiresAt',
  'metadataOnly',
  'producerStatus',
  'ready',
]);
const BOOTSTRAP_KEYS = new Set([
  'capabilities',
  'operational',
  'providersReady',
  'runtimeMode',
  'storageMode',
]);
const BOOTSTRAP_CAPABILITY_KEYS = new Set([
  'autosave',
  'builder',
  'durableStorage',
  'fullAcceptedFunctionSet',
  'resume',
  'studentEvidencePublication',
  'versionHistory',
]);
const READINESS_KEYS = new Set(['checks', 'groups', 'ready', 'reasonCode']);
const READINESS_GROUP_KEYS = new Set(['auditCatalog', 'database', 'repository', 'rls']);
const OPERATION_NAMES = Object.freeze({
  administrativeGrants: 'append_only_grant_ledger_metadata_probe',
  audit: 'append_only_audit_catalog_probe',
  entitlement: 'signed_s2s_resource_entitlement_probe',
  hydration: 'protected_bootstrap_projection_hydration_probe',
  storage: 'encrypted_private_immutable_version_probe',
});

function unavailable(status) {
  return new IntegrationDisabledError(INTEGRATION, status);
}

function fail(status) {
  throw unavailable(status);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return [Object.prototype, null].includes(Object.getPrototypeOf(value));
  } catch {
    return false;
  }
}

function exactSnapshot(value, expectedKeys, status, { frozen = false } = {}) {
  if (!isPlainObject(value) || (frozen && !Object.isFrozen(value))) fail(status);
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(status);
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) fail(status);
  const snapshot = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
    ) fail(status);
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotOptions(rawOptions) {
  if (!isPlainObject(rawOptions)) fail('OPTIONS_REQUIRED');
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(rawOptions);
    descriptors = Object.getOwnPropertyDescriptors(rawOptions);
  } catch {
    fail('OPTIONS_INVALID');
  }
  if (
    keys.some((key) => typeof key !== 'string' || !OPTION_KEYS.has(key))
    || !keys.includes('backupRestoreAdapter')
    || !keys.includes('releaseFlags')
    || !keys.includes('resourceEntitlementResolver')
    || !keys.includes('targetConfiguration')
    || !keys.includes('wordpressS2sClient')
  ) fail('OPTIONS_INVALID');
  const snapshot = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
    ) fail('OPTIONS_INVALID');
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function validatedReleaseFlags(rawFlags) {
  const flags = exactSnapshot(rawFlags, RELEASE_FLAG_KEYS, 'RELEASE_FLAGS_INVALID', {
    frozen: true,
  });
  if (
    typeof flags.enabled !== 'boolean'
    || typeof flags.killSwitch !== 'boolean'
    || typeof flags.requireCanary !== 'boolean'
  ) fail('RELEASE_FLAGS_INVALID');
  return rawFlags;
}

function validatedSignal(signal) {
  if (signal === null || signal === undefined) return null;
  if (
    typeof signal !== 'object'
    || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function'
    || typeof signal.aborted !== 'boolean'
  ) fail('SIGNAL_INVALID');
  return signal;
}

function validatedWordPressS2sClient(rawClient) {
  const client = exactSnapshot(rawClient, S2S_CLIENT_KEYS, 'WORDPRESS_S2S_CLIENT_INVALID', {
    frozen: true,
  });
  if (
    ['admit', 'getResourceStudentEntitlement', 'probeResourceStudentEntitlement',
      'redeemBootstrap', 'revokeBinding'].some((method) => typeof client[method] !== 'function')
    || !client.resourceEntitlementPort
    || typeof client.resourceEntitlementPort !== 'object'
  ) {
    fail('WORDPRESS_S2S_CLIENT_INVALID');
  }
  return rawClient;
}

function validatedResourceEntitlementResolver(rawResolver) {
  const resolver = exactSnapshot(
    rawResolver,
    RESOURCE_RESOLVER_KEYS,
    'SIGNED_RESOURCE_ENTITLEMENT_RESOLVER_INVALID',
    { frozen: true },
  );
  if (
    resolver.signedS2s !== true
    || typeof resolver.resolve !== 'function'
    || typeof resolver.probe !== 'function'
  ) {
    fail('SIGNED_RESOURCE_ENTITLEMENT_RESOLVER_INVALID');
  }
  return rawResolver;
}

function validatedOperationRequest(rawRequest, dependency, targetRef) {
  const request = exactSnapshot(
    rawRequest,
    OPERATION_REQUEST_KEYS,
    'DEPENDENCY_OPERATION_REQUEST_INVALID',
    { frozen: true },
  );
  if (
    request.schemaVersion !== OPERATION_REQUEST_SCHEMA
    || request.dependency !== dependency
    || request.operation !== OPERATION_NAMES[dependency]
    || request.targetRef !== targetRef
    || !SHA256.test(request.targetRef ?? '')
    || request.metadataOnly !== true
    || request.syntheticOnly !== true
    || request.protectedContentPermitted !== false
    || !(request.signal instanceof AbortSignal)
    || request.signal.aborted
  ) fail('DEPENDENCY_OPERATION_REQUEST_INVALID');
  return request;
}

function validatedDatabaseReadiness(rawReceipt) {
  const receipt = exactSnapshot(rawReceipt, READINESS_KEYS, 'DATABASE_CATALOG_NOT_READY');
  const groups = exactSnapshot(
    receipt.groups,
    READINESS_GROUP_KEYS,
    'DATABASE_CATALOG_NOT_READY',
    { frozen: true },
  );
  if (
    receipt.ready !== true
    || receipt.reasonCode !== 'READY'
    || !isPlainObject(receipt.checks)
    || !Object.isFrozen(receipt.checks)
    || Object.keys(receipt.checks).length < 1
    || Object.values(receipt.checks).some((value) => value !== true)
    || [...READINESS_GROUP_KEYS].some((key) => groups[key] !== true)
  ) fail('DATABASE_CATALOG_NOT_READY');
  return Object.freeze({
    ready: true,
    groups: Object.freeze(Object.fromEntries(
      [...READINESS_GROUP_KEYS].sort().map((key) => [key, true]),
    )),
  });
}

function validatedPreliminaryBootstrap(rawBootstrap) {
  const bootstrap = exactSnapshot(
    rawBootstrap,
    BOOTSTRAP_KEYS,
    'PRELIMINARY_BOOTSTRAP_INVALID',
  );
  const capabilities = exactSnapshot(
    bootstrap.capabilities,
    BOOTSTRAP_CAPABILITY_KEYS,
    'PRELIMINARY_BOOTSTRAP_INVALID',
  );
  if (
    bootstrap.operational !== false
    || bootstrap.runtimeMode !== 'unavailable'
    || bootstrap.storageMode !== 'durable'
    || bootstrap.providersReady !== false
    || capabilities.builder !== true
    || capabilities.autosave !== true
    || capabilities.resume !== true
    || capabilities.versionHistory !== true
    || capabilities.studentEvidencePublication !== true
    || capabilities.durableStorage !== true
    || capabilities.fullAcceptedFunctionSet !== false
  ) fail('PRELIMINARY_BOOTSTRAP_INVALID');
  return Object.freeze({
    durableStorage: true,
    studentEvidencePublication: true,
    preliminaryOnly: true,
  });
}

function canonicalInstant(value, status) {
  if (typeof value !== 'string') fail(status);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail(status);
  }
  return milliseconds;
}

function clockMilliseconds(clock) {
  let raw;
  try {
    raw = clock();
  } catch {
    fail('CLOCK_INVALID');
  }
  const milliseconds = raw instanceof Date ? raw.getTime() : Number(raw);
  if (!Number.isFinite(milliseconds)) fail('CLOCK_INVALID');
  return milliseconds;
}

function validatedEntitlementProbe(rawProbe, nowMilliseconds) {
  const probe = exactSnapshot(
    rawProbe,
    RESOURCE_ENTITLEMENT_PROBE_KEYS,
    'SIGNED_RESOURCE_ENTITLEMENT_PROBE_FAILED',
  );
  const evaluatedAt = canonicalInstant(
    probe.evaluatedAt,
    'SIGNED_RESOURCE_ENTITLEMENT_PROBE_FAILED',
  );
  const expiresAt = canonicalInstant(
    probe.expiresAt,
    'SIGNED_RESOURCE_ENTITLEMENT_PROBE_FAILED',
  );
  if (
    probe.contract !== WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_CONTRACT
    || probe.audience !== 'lor-studio'
    || probe.ready !== true
    || probe.metadataOnly !== true
    || probe.producerStatus !== WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER
    || evaluatedAt > nowMilliseconds + 30_000
    || evaluatedAt < nowMilliseconds - (5 * 60 * 1_000)
    || expiresAt <= nowMilliseconds
    || expiresAt <= evaluatedAt
    || expiresAt - evaluatedAt > 5 * 60 * 1_000
  ) fail('SIGNED_RESOURCE_ENTITLEMENT_PROBE_FAILED');
  return Object.freeze({
    metadataOnly: true,
    producerStatus: WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER,
    ready: true,
  });
}

function safeEvidence(dependency, targetRef, safeMetadata) {
  return Object.freeze({
    schemaVersion: SAFE_EVIDENCE_SCHEMA,
    dependency,
    targetRef,
    operation: OPERATION_NAMES[dependency],
    metadataOnly: true,
    protectedContentObserved: false,
    secretMaterialObserved: false,
    evidenceRef: sha256(canonicalize({
      schemaVersion: ASSEMBLY_CONTRACT_SCHEMA,
      dependency,
      targetRef,
      safeMetadata,
    })),
  });
}

function createMetadataOperations({
  administrativeGrantsReadiness,
  artifactAuditSink,
  bootstrapProbe,
  clock,
  databaseProbe,
  entitlementProbeSurface,
  hydrationApplication,
  resourceEntitlementResolver,
  storageAdapter,
  targetRef,
}) {
  const operation = (dependency, expectedSurface, inspect) => async (
    rawRequest,
    sealResult,
    runtimeSurface,
  ) => {
    const request = validatedOperationRequest(rawRequest, dependency, targetRef);
    if (typeof sealResult !== 'function' || runtimeSurface !== expectedSurface) {
      fail('DEPENDENCY_OPERATION_SURFACE_INVALID');
    }
    const safeMetadata = await inspect(request);
    if (request.signal.aborted) fail('DEPENDENCY_OPERATION_ABORTED');
    return sealResult(safeEvidence(dependency, targetRef, safeMetadata));
  };

  return Object.freeze({
    administrativeGrants: operation(
      'administrativeGrants',
      administrativeGrantsReadiness,
      async () => Object.freeze({
        catalog: await databaseProbe(),
        durability: 'DURABLE_APPEND_ONLY_PROVIDER_BOUND',
      }),
    ),
    audit: operation(
      'audit',
      artifactAuditSink,
      async () => Object.freeze({
        bootstrap: await bootstrapProbe(),
        catalog: await databaseProbe(),
        durability: 'DURABLE_ACTOR_CASE_BOUND_APPEND_ONLY',
      }),
    ),
    entitlement: operation(
      'entitlement',
      entitlementProbeSurface,
      async (request) => validatedEntitlementProbe(
        await resourceEntitlementResolver.probe(Object.freeze({ signal: request.signal })),
        clockMilliseconds(clock),
      ),
    ),
    hydration: operation(
      'hydration',
      hydrationApplication,
      async () => Object.freeze({
        bootstrap: await bootstrapProbe(),
        catalog: await databaseProbe(),
        hydrateInvoked: false,
      }),
    ),
    storage: operation(
      'storage',
      storageAdapter,
      async () => Object.freeze({
        bootstrap: await bootstrapProbe(),
        catalog: await databaseProbe(),
        storageMode: 'durable',
      }),
    ),
  });
}

function freezeComposition(composition) {
  if (!composition || typeof composition !== 'object' || composition.application === null) {
    fail('RUNTIME_READINESS_FAILED');
  }
  return Object.freeze({ ...composition });
}

/**
 * Assemble the one production graph used by the HTTP server.
 *
 * All credential-bearing objects remain closure/private-field backed. The returned object owns
 * exactly one PostgreSQL dependency set through `composition.runtimeDependencies`; callers must
 * hand that set to the standard shutdown coordinator. No caller-supplied readiness coordinator,
 * provider runtime, storage binding, or database dependency object is accepted.
 */
export async function createProductionRuntimeAssembly(rawOptions = {}) {
  const options = snapshotOptions(rawOptions);
  const releaseFlags = validatedReleaseFlags(options.releaseFlags);
  const signal = validatedSignal(options.signal);
  const resourceEntitlementResolver = validatedResourceEntitlementResolver(
    options.resourceEntitlementResolver,
  );
  const wordpressS2sClient = validatedWordPressS2sClient(options.wordpressS2sClient);
  if (
    wordpressS2sClient.resourceEntitlementPort !== resourceEntitlementResolver
    || wordpressS2sClient.getResourceStudentEntitlement !== resourceEntitlementResolver.resolve
    || wordpressS2sClient.probeResourceStudentEntitlement !== resourceEntitlementResolver.probe
  ) fail('SIGNED_RESOURCE_ENTITLEMENT_RESOLVER_MISMATCH');
  const clock = options.clock ?? (() => new Date());
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  if (typeof clock !== 'function') fail('CLOCK_INVALID');
  if (typeof fetchImplementation !== 'function') fail('FETCH_INVALID');
  if (options.poolClass !== undefined && typeof options.poolClass !== 'function') {
    fail('POOL_CLASS_INVALID');
  }
  if (
    options.probeTimeoutMilliseconds !== undefined
    && (
      !Number.isSafeInteger(options.probeTimeoutMilliseconds)
      || options.probeTimeoutMilliseconds < 1
      || options.probeTimeoutMilliseconds > 30_000
    )
  ) fail('PROBE_TIMEOUT_INVALID');

  let binding;
  try {
    binding = resolveLorTargetBinding(options.targetConfiguration);
  } catch {
    fail('EXACT_DR133_PRODUCTION_TARGET_REQUIRED');
  }
  if (binding.environment !== 'production' || binding.decisionRecord !== 'DR-133') {
    fail('EXACT_DR133_PRODUCTION_TARGET_REQUIRED');
  }

  let dependencies = null;
  let ownerTransferredToReadinessWrapper = false;
  let closeStarted = false;
  const closeOwnerOnce = async () => {
    if (!dependencies || closeStarted) return;
    closeStarted = true;
    try {
      await dependencies.close();
    } catch {
      // The assembly exposes one constant construction failure; close errors never widen it.
    }
  };

  try {
    const postgresOptions = options.poolClass === undefined
      ? { environment: options.environment ?? process.env }
      : { environment: options.environment ?? process.env, PoolClass: options.poolClass };
    dependencies = createProductionPostgresRuntimeDependencies(binding, postgresOptions);

    const providerRuntime = await createProductionProviderRuntime({
      environment: options.environment ?? process.env,
      fetchImplementation,
      clock,
    });
    const storageAdapter = createPostgresEncryptedPrivateStorageAdapterFromEnvironment({
      databaseDriver: dependencies.driver,
      actorResolver: dependencies.actorResolver,
      scopeProvider: dependencies.scopeProvider,
      environment: options.environment ?? process.env,
      clock,
    });
    const candidateAuthService = new DurableFacultyCandidateAuthService({
      binding,
      driver: dependencies.driver,
      secretBinding: providerRuntime.facultyInvitationSecretBinding,
      keyProvider: providerRuntime.facultyInvitationKeyProvider,
      clock,
    });
    if (!isAuthenticDurableFacultyCandidateAuthService(candidateAuthService)) {
      fail('AUTHENTIC_CANDIDATE_AUTH_SERVICE_REQUIRED');
    }

    const admission = createWordPressCurrentUserAdmission({
      s2sClient: wordpressS2sClient,
      actorResolver: dependencies.actorResolver,
      resourceEntitlementResolver,
      clock,
    });

    const sharedCompositionOptions = Object.freeze({
      targetConfiguration: options.targetConfiguration,
      entitlementPort: admission,
      boundRuntimeDependencies: dependencies,
      aiProposalProvider: providerRuntime.aiProposalProvider,
      facultyEmailPort: providerRuntime.facultyEmailPort,
      facultyInvitationSecretDeriver: providerRuntime.facultyInvitationSecretDeriver,
      invitationOrigin: providerRuntime.invitationOrigin,
      privateStorageService: storageAdapter,
      clock,
      requireCanary: releaseFlags.requireCanary,
    });
    const preliminary = createLorStudioApplication(sharedCompositionOptions);
    if (preliminary.application === null) {
      fail('PRELIMINARY_APPLICATION_GRAPH_UNAVAILABLE');
    }
    if (
      preliminary.runtimeDependencies !== dependencies
      || preliminary.entitlementPort !== admission
      || preliminary.privateStorageService !== storageAdapter
    ) fail('PRELIMINARY_APPLICATION_GRAPH_MISMATCH');
    if (
      preliminary.authenticProductionProviderGraph !== true
      || !preliminary.artifactAuditSink
    ) fail('PRELIMINARY_PROVIDER_GRAPH_INVALID');

    let activeDatabaseProbe = null;
    const databaseProbe = async () => {
      if (!activeDatabaseProbe) {
        activeDatabaseProbe = Promise.resolve()
          .then(() => dependencies.readiness.probe())
          .then(validatedDatabaseReadiness)
          .finally(() => {
            queueMicrotask(() => { activeDatabaseProbe = null; });
          });
      }
      return activeDatabaseProbe;
    };
    let activeBootstrapProbe = null;
    const bootstrapProbe = async () => {
      if (!activeBootstrapProbe) {
        activeBootstrapProbe = Promise.resolve()
          .then(() => preliminary.application.getBootstrap())
          .then(validatedPreliminaryBootstrap)
          .finally(() => {
            queueMicrotask(() => { activeBootstrapProbe = null; });
          });
      }
      return activeBootstrapProbe;
    };
    // Establish both non-content readiness inputs before any authority-bearing probe surface is
    // registered. A failure here is still a pre-wrapper failure and therefore closes the sole
    // database owner locally rather than transferring a partial graph.
    await Promise.all([databaseProbe(), bootstrapProbe()]);
    const targetRef = productionOperationalReadinessTargetRef(binding);
    // Compatibility with the dependency-probe module's narrower runtime-surface descriptor.
    // The actual operation still invokes the exact three-method port branded by the S2S client.
    const entitlementProbeSurface = Object.freeze({
      signedS2s: true,
      resolve: resourceEntitlementResolver.resolve,
    });
    const operations = createMetadataOperations({
      administrativeGrantsReadiness: dependencies.readiness,
      artifactAuditSink: preliminary.artifactAuditSink,
      bootstrapProbe,
      clock,
      databaseProbe,
      entitlementProbeSurface,
      hydrationApplication: preliminary.application,
      resourceEntitlementResolver,
      storageAdapter,
      targetRef,
    });

    const surfaces = Object.freeze({
      administrativeGrants: createProductionAdministrativeGrantsProbeSurface({
        binding,
        readiness: dependencies.readiness,
        operation: operations.administrativeGrants,
      }),
      audit: createProductionAuditProbeSurface({
        binding,
        auditSink: preliminary.artifactAuditSink,
        operation: operations.audit,
      }),
      backupRestore: createProductionBackupRestoreProbeSurface({
        binding,
        adapter: options.backupRestoreAdapter,
      }),
      entitlement: createProductionEntitlementProbeSurface({
        binding,
        resolver: entitlementProbeSurface,
        operation: operations.entitlement,
      }),
      hydration: createProductionHydrationProbeSurface({
        binding,
        application: preliminary.application,
        operation: operations.hydration,
      }),
      storage: createProductionStorageProbeSurface({
        binding,
        adapter: storageAdapter,
        operation: operations.storage,
      }),
    });
    const probes = createProductionDependencyProbes({
      binding,
      providerRuntime,
      ...surfaces,
    });
    const coordinatorOptions = options.probeTimeoutMilliseconds === undefined
      ? { binding, probes }
      : { binding, probes, probeTimeoutMilliseconds: options.probeTimeoutMilliseconds };
    const trustedProbeCoordinator = createProductionProviderProbeCoordinator(
      coordinatorOptions,
    );

    ownerTransferredToReadinessWrapper = true;
    const composition = await createReadinessGatedLorStudioApplication({
      ...sharedCompositionOptions,
      artifactAuditSink: preliminary.artifactAuditSink,
      releaseFlags,
      signal,
      trustedProbeCoordinator,
    });
    const frozenComposition = freezeComposition(composition);
    if (
      frozenComposition.runtimeDependencies !== dependencies
      || frozenComposition.entitlementPort !== admission
      || frozenComposition.privateStorageService !== storageAdapter
      || frozenComposition.artifactAuditSink !== preliminary.artifactAuditSink
      || frozenComposition.operationalReadiness?.status !== 'ready'
      || frozenComposition.operationalReadiness?.productionOperational !== true
    ) fail('RUNTIME_READINESS_FAILED');

    return Object.freeze({
      composition: frozenComposition,
      admission,
      candidateAuthService,
      resourceEntitlementResolver,
    });
  } catch (error) {
    // `close()` is idempotent. Always reclaim the sole pool on any assembly failure, including a
    // failure in our post-wrapper invariants after the readiness wrapper had returned success.
    // The previous ownership flag skipped that late path and could strand a live pool while the
    // server correctly remained dark.
    await closeOwnerOnce();
    if (
      error instanceof IntegrationDisabledError
      && error.details?.integration === INTEGRATION
    ) throw error;
    throw unavailable(
      ownerTransferredToReadinessWrapper
        ? 'RUNTIME_READINESS_FAILED'
        : 'ASSEMBLY_PREPARATION_FAILED',
    );
  }
}

export const PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT = deepFreeze({
  schemaVersion: ASSEMBLY_CONTRACT_SCHEMA,
  authority: 'DR-133',
  environment: 'production',
  databasePoolCount: 1,
  databaseOwner: 'composition.runtimeDependencies',
  providerRuntime: 'dedicated_verified_environment_bindings_only',
  privateStorage: 'postgres_ciphertext_only_application_aes_256_gcm',
  candidateHandoff: 'durable_single_use_aes_256_gcm',
  readinessDependencies: [
    'administrativeGrants',
    'ai',
    'audit',
    'backupRestore',
    'email',
    'entitlement',
    'hydration',
    'otp',
    'storage',
  ],
  readinessContent: 'metadata_only_synthetic_only',
  hydrationDuringReadiness: false,
  fallback: null,
  callerCoordinatorAccepted: false,
  callerProviderRuntimeAccepted: false,
  callerAdministrativeGrantSurfaceAccepted: false,
  callerHydrationSurfaceAccepted: false,
  secretOutput: 'prohibited',
});
