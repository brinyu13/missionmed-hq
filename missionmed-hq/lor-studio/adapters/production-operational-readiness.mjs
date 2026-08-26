import { DependencyAwareMetadataHealthAdapter } from './operational-readiness-adapters.mjs';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import { IntegrationDisabledError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';

export const PRODUCTION_OPERATIONAL_READINESS_INTEGRATION =
  'lor_production_operational_readiness';
export const PRODUCTION_DEPENDENCY_RECEIPT_SCHEMA =
  'missionmed.lor.production-dependency-receipt.v1';

const TARGET_REFERENCE_SCHEMA = 'missionmed.lor.operational-target-reference.v1';
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
const RECEIPT_MAX_AGE_MS = 5 * 60 * 1_000;
const RECEIPT_MAX_LIFETIME_MS = 15 * 60 * 1_000;
const RECEIPT_CLOCK_SKEW_MS = 30 * 1_000;

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
  const receipts = snapshotProviderReceipts(providerReceipts);
  const targetRef = productionOperationalReadinessTargetRef(validatedBinding);
  const safeFlags = snapshotFlags(flags);

  return Object.freeze({
    async snapshot() {
      const nowMilliseconds = safeClock(clock);
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
  trustedProbeCoordinator: 'required_before_production_live',
  protectedContent: 'prohibited',
});
