import { DependencyAwareMetadataHealthAdapter } from './operational-readiness-adapters.mjs';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import { IntegrationDisabledError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';

export const PRODUCTION_OPERATIONAL_READINESS_INTEGRATION =
  'lor_production_operational_readiness';
export const PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA =
  'missionmed.lor.production-dependency-receipt.v1';
export const PRODUCTION_PROVIDER_PROBE_COORDINATOR_SCHEMA =
  'missionmed.lor.production-provider-probe-coordinator.v1';

const TARGET_REFERENCE_SCHEMA = 'missionmed.lor.operational-target-reference.v1';
const PROBE_REQUEST_SCHEMA = 'missionmed.lor.production-provider-probe-request.v1';
const PROBE_EVIDENCE_SCHEMA = 'missionmed.lor.production-provider-probe-evidence.v1';
const SHA256 = /^[a-f0-9]{64}$/u;
const RECEIPT_KEYS = new Set([
  'dependency',
  'errorCode',
  'evidenceRef',
  'expiresAt',
  'observedAt',
  'schemaVersion',
  'state',
  'targetRef',
]);
const DATABASE_GROUP_KEYS = new Set(['auditCatalog', 'database', 'repository', 'rls']);
const PROVIDER_RECEIPT_DEPENDENCIES = Object.freeze([
  'administrativeGrants',
  'ai',
  'audit',
  'backupRestore',
  'email',
  'entitlement',
  'hydration',
  'otp',
  'storage',
]);
const PROVIDER_RECEIPT_DEPENDENCY_SET = new Set(PROVIDER_RECEIPT_DEPENDENCIES);
const PROVIDER_PROBE_RESULT_KEYS = new Set(['errorCode', 'evidenceRef', 'state']);
const PROVIDER_PROBE_COORDINATOR_OPTION_KEYS = new Set([
  'binding',
  'probeTimeoutMilliseconds',
  'probes',
]);
const RECEIPT_MAX_AGE_MS = 5 * 60 * 1_000;
const RECEIPT_MAX_LIFETIME_MS = 15 * 60 * 1_000;
const RECEIPT_CLOCK_SKEW_MS = 30 * 1_000;
const TRUSTED_RECEIPT_LIFETIME_MS = 2 * 60 * 1_000;
const DEFAULT_PROVIDER_PROBE_TIMEOUT_MS = 5 * 1_000;
const MAX_PROVIDER_PROBE_TIMEOUT_MS = 30 * 1_000;

// A coordinator is authority-bearing only by membership in this module-private
// registry. Its public value contains no callable receipt-minting surface, and a
// hand-built look-alike cannot be registered by shape.
const TRUSTED_PROVIDER_PROBE_COORDINATORS = new WeakMap();

function failClosed(status) {
  throw new IntegrationDisabledError(PRODUCTION_OPERATIONAL_READINESS_INTEGRATION, status);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return [Object.prototype, null].includes(Object.getPrototypeOf(value));
  } catch {
    return false;
  }
}

function exactDataSnapshot(value, expectedKeys) {
  if (!isPlainObject(value)) return null;
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  if (
    ownKeys.length !== expectedKeys.size
    || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) return null;
  const snapshot = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
    ) return null;
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function canonicalIso(value) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 32) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  try {
    if (new Date(milliseconds).toISOString() !== value) return null;
  } catch {
    return null;
  }
  return milliseconds;
}

function targetReferencePayload(binding) {
  return {
    schemaVersion: TARGET_REFERENCE_SCHEMA,
    bindingSchemaVersion: binding.schemaVersion,
    decisionRecord: binding.decisionRecord,
    environment: binding.environment,
    provider: binding.provider,
    projectId: binding.projectId,
    environmentId: binding.environmentId,
    serviceId: binding.serviceId,
    databaseName: binding.databaseName,
    region: binding.region,
    schema: binding.schema,
    migrationLedger: binding.migrationLedger,
  };
}

export function productionOperationalReadinessTargetRef(rawBinding) {
  const binding = assertValidatedLorTargetBinding(
    rawBinding,
    PRODUCTION_OPERATIONAL_READINESS_INTEGRATION,
  );
  return sha256(canonicalize(targetReferencePayload(binding)));
}

function snapshotCoordinatorOptions(rawOptions) {
  if (!isPlainObject(rawOptions)) failClosed('TRUSTED_PROBE_COORDINATOR_OPTIONS_REQUIRED');
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(rawOptions);
    descriptors = Object.getOwnPropertyDescriptors(rawOptions);
  } catch {
    failClosed('TRUSTED_PROBE_COORDINATOR_OPTIONS_INVALID');
  }
  if (
    ownKeys.some(
      (key) => typeof key !== 'string' || !PROVIDER_PROBE_COORDINATOR_OPTION_KEYS.has(key),
    )
    || !ownKeys.includes('binding')
    || !ownKeys.includes('probes')
  ) failClosed('TRUSTED_PROBE_COORDINATOR_OPTIONS_INVALID');
  const snapshot = {};
  for (const key of ownKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
    ) failClosed('TRUSTED_PROBE_COORDINATOR_OPTIONS_INVALID');
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotProviderProbes(rawProbes) {
  if (!isPlainObject(rawProbes)) failClosed('COMPLETE_PROVIDER_PROBES_REQUIRED');
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(rawProbes);
    descriptors = Object.getOwnPropertyDescriptors(rawProbes);
  } catch {
    failClosed('COMPLETE_PROVIDER_PROBES_REQUIRED');
  }
  if (
    ownKeys.length !== PROVIDER_RECEIPT_DEPENDENCIES.length
    || ownKeys.some(
      (key) => typeof key !== 'string' || !PROVIDER_RECEIPT_DEPENDENCY_SET.has(key),
    )
  ) failClosed('COMPLETE_PROVIDER_PROBES_REQUIRED');
  const probes = new Map();
  for (const dependency of PROVIDER_RECEIPT_DEPENDENCIES) {
    const descriptor = descriptors[dependency];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
      || typeof descriptor.value !== 'function'
    ) failClosed('COMPLETE_PROVIDER_PROBES_REQUIRED');
    probes.set(dependency, descriptor.value);
  }
  return probes;
}

/**
 * Registers one exact production target and one complete bounded probe set.
 * The returned descriptor is intentionally inert: only this module can claim
 * it and mint receipts, so raw configuration data can never impersonate it.
 */
export function createProductionProviderProbeCoordinator(rawOptions) {
  const options = snapshotCoordinatorOptions(rawOptions);
  const binding = assertValidatedLorTargetBinding(
    options.binding,
    PRODUCTION_OPERATIONAL_READINESS_INTEGRATION,
  );
  if (binding.environment !== 'production') failClosed('PRODUCTION_TARGET_REQUIRED');
  const probes = snapshotProviderProbes(options.probes);
  const probeTimeoutMilliseconds = options.probeTimeoutMilliseconds
    ?? DEFAULT_PROVIDER_PROBE_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(probeTimeoutMilliseconds)
    || probeTimeoutMilliseconds < 1
    || probeTimeoutMilliseconds > MAX_PROVIDER_PROBE_TIMEOUT_MS
  ) failClosed('PROVIDER_PROBE_TIMEOUT_INVALID');

  const coordinator = deepFreeze({
    schemaVersion: PRODUCTION_PROVIDER_PROBE_COORDINATOR_SCHEMA,
    metadataOnly: true,
    targetBound: true,
  });
  TRUSTED_PROVIDER_PROBE_COORDINATORS.set(coordinator, {
    claimed: false,
    collecting: false,
    generation: 0,
    probeTimeoutMilliseconds,
    probes,
    targetRef: productionOperationalReadinessTargetRef(binding),
  });
  return coordinator;
}

async function runBoundedProviderProbe({
  dependency,
  generation,
  nowMilliseconds,
  probe,
  probeTimeoutMilliseconds,
  targetRef,
}) {
  const controller = new AbortController();
  const request = Object.freeze({
    schemaVersion: PROBE_REQUEST_SCHEMA,
    dependency,
    targetRef,
    metadataOnly: true,
    signal: controller.signal,
  });
  let timeoutHandle;
  try {
    const timeout = new Promise((resolve) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, probeTimeoutMilliseconds);
      timeoutHandle.unref?.();
    });
    const rawResult = await Promise.race([
      Promise.resolve().then(() => probe(request)).catch(() => null),
      timeout,
    ]);
    const result = exactDataSnapshot(rawResult, PROVIDER_PROBE_RESULT_KEYS);
    if (
      !result
      || result.state !== 'ready'
      || result.errorCode !== ''
      || !SHA256.test(result.evidenceRef ?? '')
    ) return null;
    const observedAt = new Date(nowMilliseconds).toISOString();
    const expiresAt = new Date(nowMilliseconds + TRUSTED_RECEIPT_LIFETIME_MS).toISOString();
    return Object.freeze({
      schemaVersion: PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA,
      dependency,
      state: 'ready',
      errorCode: '',
      targetRef,
      // Salt the provider's safe evidence hash with an internal monotonic
      // generation. Even equal probe evidence at the same clock tick cannot
      // produce a replay-identical coordinator receipt.
      evidenceRef: sha256(canonicalize({
        schemaVersion: PROBE_EVIDENCE_SCHEMA,
        dependency,
        targetRef,
        generation,
        observedAt,
        providerEvidenceRef: result.evidenceRef,
      })),
      observedAt,
      expiresAt,
    });
  } catch {
    return null;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    controller.abort();
  }
}

function claimTrustedProviderProbeCoordinator(rawCoordinator, targetRef) {
  if (rawCoordinator === null || rawCoordinator === undefined) return null;
  let state;
  try {
    state = TRUSTED_PROVIDER_PROBE_COORDINATORS.get(rawCoordinator);
  } catch {
    state = null;
  }
  if (!state) failClosed('TRUSTED_PROBE_COORDINATOR_INVALID');
  if (state.claimed) failClosed('TRUSTED_PROBE_COORDINATOR_REPLAYED');
  if (state.targetRef !== targetRef) failClosed('TRUSTED_PROBE_COORDINATOR_TARGET_MISMATCH');
  state.claimed = true;

  return async (nowMilliseconds) => {
    if (!Number.isFinite(nowMilliseconds) || state.collecting) return new Map();
    state.collecting = true;
    state.generation += 1;
    const generation = state.generation;
    try {
      const entries = await Promise.all(PROVIDER_RECEIPT_DEPENDENCIES.map(
        async (dependency) => [dependency, await runBoundedProviderProbe({
          dependency,
          generation,
          nowMilliseconds,
          probe: state.probes.get(dependency),
          probeTimeoutMilliseconds: state.probeTimeoutMilliseconds,
          targetRef,
        })],
      ));
      return new Map(entries.filter(([, receipt]) => receipt !== null));
    } finally {
      state.collecting = false;
    }
  };
}

function snapshotProviderReceipts(rawReceipts) {
  if (!isPlainObject(rawReceipts)) failClosed('PROVIDER_RECEIPTS_REQUIRED');
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(rawReceipts);
    descriptors = Object.getOwnPropertyDescriptors(rawReceipts);
  } catch {
    failClosed('PROVIDER_RECEIPTS_INVALID');
  }
  // Raw application/configuration objects are not provider evidence. Earlier revisions accepted
  // a structurally green, fresh-looking map here, which meant a caller could mint every provider
  // ready state with arbitrary SHA-256 strings. Until the shared runtime binds a concrete probe
  // coordinator that mints instance-bound receipts after real bounded provider operations, every
  // non-empty caller receipt set is deliberately treated as untrusted/unwired. This keeps the
  // product dark instead of advertising a provider graph that has never been exercised.
  if (ownKeys.length !== 0) return new Map();
  if (ownKeys.some(
    (key) => typeof key !== 'string' || !PROVIDER_RECEIPT_DEPENDENCY_SET.has(key),
  )) failClosed('PROVIDER_RECEIPTS_INVALID');
  const snapshots = new Map();
  for (const key of PROVIDER_RECEIPT_DEPENDENCIES) {
    const descriptor = descriptors[key];
    if (!descriptor) continue;
    if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      failClosed('PROVIDER_RECEIPTS_INVALID');
    }
    snapshots.set(key, exactDataSnapshot(descriptor.value, RECEIPT_KEYS));
  }
  return snapshots;
}

function receiptState(receipt, dependency, targetRef, nowMilliseconds) {
  if (!receipt) return Object.freeze({ state: 'unavailable', errorCode: 'NOT_BOUND' });
  if (
    receipt.schemaVersion !== PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA
    || receipt.dependency !== dependency
    || receipt.state !== 'ready'
    || receipt.errorCode !== ''
    || receipt.targetRef !== targetRef
    || !SHA256.test(receipt.evidenceRef ?? '')
  ) return Object.freeze({ state: 'unavailable', errorCode: 'NOT_BOUND' });
  const observedAt = canonicalIso(receipt.observedAt);
  const expiresAt = canonicalIso(receipt.expiresAt);
  if (
    observedAt === null
    || expiresAt === null
    || expiresAt <= observedAt
    || expiresAt - observedAt > RECEIPT_MAX_LIFETIME_MS
    || observedAt > nowMilliseconds + RECEIPT_CLOCK_SKEW_MS
    || nowMilliseconds - observedAt > RECEIPT_MAX_AGE_MS
    || expiresAt <= nowMilliseconds
  ) return Object.freeze({ state: 'unavailable', errorCode: 'CHECK_FAILED' });
  return Object.freeze({ state: 'ready', errorCode: '' });
}

function unavailableDatabaseGroups() {
  return Object.freeze({
    auditCatalog: false,
    database: false,
    repository: false,
    rls: false,
  });
}

function safeDatabaseGroups(rawReceipt) {
  if (!isPlainObject(rawReceipt)) return unavailableDatabaseGroups();
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(rawReceipt);
  } catch {
    descriptors = {};
  }
  const ready = descriptors.ready;
  const reasonCode = descriptors.reasonCode;
  const rawGroups = descriptors.groups;
  const groups = ready
    && Object.hasOwn(ready, 'value')
    && typeof ready.value === 'boolean'
    && reasonCode
    && Object.hasOwn(reasonCode, 'value')
    && typeof reasonCode.value === 'string'
    && reasonCode.value.length > 0
    && rawGroups
    && Object.hasOwn(rawGroups, 'value')
    ? exactDataSnapshot(rawGroups.value, DATABASE_GROUP_KEYS)
    : null;
  if (!groups || Object.values(groups).some((value) => typeof value !== 'boolean')) {
    return unavailableDatabaseGroups();
  }
  if ((ready.value === true) !== (reasonCode.value === 'READY')) {
    return unavailableDatabaseGroups();
  }
  if (ready.value === true && groups.database !== true) {
    return unavailableDatabaseGroups();
  }
  return ready.value === true
    ? groups
    : Object.freeze({ ...groups, database: false });
}

function safeClock(clock) {
  try {
    const now = clock();
    const milliseconds = now instanceof Date
      ? now.valueOf()
      : typeof now === 'number'
        ? now
        : Date.parse(String(now));
    return Number.isFinite(milliseconds) ? milliseconds : null;
  } catch {
    return null;
  }
}

function snapshotFlags(rawFlags) {
  if (!isPlainObject(rawFlags)) {
    return Object.freeze({ enabled: false, killSwitch: true, requireCanary: null });
  }
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(rawFlags);
  } catch {
    return Object.freeze({ enabled: false, killSwitch: true, requireCanary: null });
  }
  const value = (key) => {
    const descriptor = descriptors[key];
    return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable === true
      ? descriptor.value
      : undefined;
  };
  return Object.freeze({
    enabled: value('enabled') === true,
    killSwitch: value('killSwitch') !== false,
    requireCanary: typeof value('requireCanary') === 'boolean'
      ? value('requireCanary')
      : null,
  });
}

export function createProductionOperationalReadiness({
  binding,
  runtimeReadiness,
  providerReceipts = {},
  trustedProbeCoordinator = null,
  flags = {},
  clock = () => new Date(),
} = {}) {
  const validatedBinding = assertValidatedLorTargetBinding(
    binding,
    PRODUCTION_OPERATIONAL_READINESS_INTEGRATION,
  );
  if (validatedBinding.environment !== 'production') {
    failClosed('PRODUCTION_TARGET_REQUIRED');
  }
  if (!runtimeReadiness || typeof runtimeReadiness.probe !== 'function') {
    failClosed('RUNTIME_READINESS_REQUIRED');
  }
  if (typeof clock !== 'function') failClosed('CLOCK_REQUIRED');
  const rawReceipts = snapshotProviderReceipts(providerReceipts);
  const targetRef = productionOperationalReadinessTargetRef(validatedBinding);
  const collectTrustedProviderReceipts = claimTrustedProviderProbeCoordinator(
    trustedProbeCoordinator,
    targetRef,
  );
  const safeFlags = snapshotFlags(flags);

  return Object.freeze({
    async snapshot() {
      const nowMilliseconds = safeClock(clock);
      let receipts = rawReceipts;
      if (nowMilliseconds !== null && collectTrustedProviderReceipts) {
        try {
          receipts = await collectTrustedProviderReceipts(nowMilliseconds);
        } catch {
          receipts = new Map();
        }
      }
      let databaseGroups = safeDatabaseGroups(null);
      if (nowMilliseconds !== null) {
        try {
          databaseGroups = safeDatabaseGroups(await runtimeReadiness.probe());
        } catch {
          databaseGroups = safeDatabaseGroups(null);
        }
      }
      const receiptFor = (dependency) => receiptState(
        receipts.get(dependency),
        dependency,
        targetRef,
        nowMilliseconds ?? Number.NaN,
      );
      const dependencies = {};
      for (const dependency of PROVIDER_RECEIPT_DEPENDENCIES) {
        dependencies[dependency] = {
          async probe() {
            const state = receiptFor(dependency);
            if (
              dependency === 'audit'
              && (databaseGroups.database !== true || databaseGroups.auditCatalog !== true)
            ) {
              return { state: 'unavailable', errorCode: 'POLICY_UNVERIFIED' };
            }
            return state;
          },
        };
      }
      dependencies.repository = {
        async probe() {
          return databaseGroups.database === true && databaseGroups.repository === true
            ? { state: 'ready', errorCode: '' }
            : { state: 'unavailable', errorCode: 'NOT_DURABLE' };
        },
      };
      dependencies.rls = {
        async probe() {
          return databaseGroups.database === true && databaseGroups.rls === true
            ? { state: 'ready', errorCode: '' }
            : { state: 'unavailable', errorCode: 'POLICY_UNVERIFIED' };
        },
      };
      const health = new DependencyAwareMetadataHealthAdapter({
        dependencies,
        flags: safeFlags,
        clock: () => new Date(nowMilliseconds ?? 0),
      });
      const healthSnapshot = await health.snapshot();
      return deepFreeze({
        ...healthSnapshot,
        databaseProbeGroups: databaseGroups,
      });
    },
  });
}

export const PRODUCTION_OPERATIONAL_READINESS_CONTRACT = deepFreeze({
  schemaVersion: 'missionmed.lor.production-operational-readiness.v1',
  providerReceiptSchemaVersion: PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA,
  providerReceiptDependencies: [...PROVIDER_RECEIPT_DEPENDENCIES],
  databaseReadinessGroups: [...DATABASE_GROUP_KEYS].sort(),
  receiptMaxAgeMilliseconds: RECEIPT_MAX_AGE_MS,
  receiptMaxLifetimeMilliseconds: RECEIPT_MAX_LIFETIME_MS,
  receiptClockSkewMilliseconds: RECEIPT_CLOCK_SKEW_MS,
  targetBinding: 'sha256_of_exact_validated_binding_identity',
  unwiredDependencyState: 'unavailable',
  rawProviderReceiptAcceptance: 'disabled',
  trustedProbeCoordinator: 'module_private_instance_bound_single_claim_registry',
  trustedProbeReceiptAcceptance: 'fresh_exact_target_bound_probe_results_only',
  trustedReceiptLifetimeMilliseconds: TRUSTED_RECEIPT_LIFETIME_MS,
  providerProbeTimeoutMilliseconds: DEFAULT_PROVIDER_PROBE_TIMEOUT_MS,
  providerProbeTimeoutMaximumMilliseconds: MAX_PROVIDER_PROBE_TIMEOUT_MS,
  replayProtection: 'per_snapshot_internal_generation_salted_evidence',
  protectedContent: 'prohibited',
});
