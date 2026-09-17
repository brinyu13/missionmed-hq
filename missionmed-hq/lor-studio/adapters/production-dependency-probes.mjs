import { IntegrationDisabledError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';
import { isAuthenticLorApplicationAdapter } from '../http/application-adapter.mjs';
import {
  isAuthenticDurableArtifactAuditSink,
} from '../repositories/supabase-durable-artifact-audit-sink.mjs';
import { HmacFacultyInvitationSecretDeriver } from './faculty-invitation-hmac-deriver.mjs';
import { isAuthenticPostmarkFacultyInvitationAdapter } from './faculty-otp-postmark-adapters.mjs';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import { isAuthenticOpenAiGroundedProposalAdapter } from './openai-grounded-proposal-adapter.mjs';
import { BackupRestoreCheckAdapter } from './operational-readiness-adapters.mjs';
import { isVerifiedPrivateVersionedStorageAdapter } from './private-versioned-storage-adapter.mjs';
import { isAuthenticProductionPostgresReadiness } from './production-postgres-runtime.mjs';
import { productionOperationalReadinessTargetRef } from './production-operational-readiness.mjs';

const INTEGRATION = 'lor_production_dependency_probes';
const COORDINATOR_REQUEST_SCHEMA = 'missionmed.lor.production-provider-probe-request.v1';
const OPERATION_REQUEST_SCHEMA = 'missionmed.lor.production-dependency-operation-request.v1';
const SAFE_EVIDENCE_SCHEMA = 'missionmed.lor.production-dependency-safe-evidence.v1';
const SEALED_RESULT_SCHEMA = 'missionmed.lor.production-dependency-sealed-result.v1';
const SAFE_OUTPUT_EVIDENCE_SCHEMA = 'missionmed.lor.production-dependency-probe-evidence.v1';
const SURFACE_SCHEMA = 'missionmed.lor.production-bound-dependency-probe-surface.v1';
export const PRODUCTION_DEPENDENCY_PROBE_SET_SCHEMA =
  'missionmed.lor.production-dependency-probe-set.v1';

const SHA256 = /^[a-f0-9]{64}$/u;
const PROVIDER_DEPENDENCIES = Object.freeze(['ai', 'email', 'otp']);
const BOUND_DEPENDENCIES = Object.freeze([
  'administrativeGrants',
  'audit',
  'backupRestore',
  'entitlement',
  'hydration',
  'storage',
]);
const ALL_DEPENDENCIES = Object.freeze([
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
const OPERATIONS = Object.freeze({
  administrativeGrants: 'append_only_grant_ledger_metadata_probe',
  audit: 'append_only_audit_catalog_probe',
  backupRestore: 'isolated_synthetic_restore_rehearsal',
  entitlement: 'signed_s2s_resource_entitlement_probe',
  hydration: 'protected_bootstrap_projection_hydration_probe',
  storage: 'encrypted_private_immutable_version_probe',
});
const REHEARSAL_CHECKS = Object.freeze([
  'isolated_restore_target',
  'schema_restore',
  'rls_policy_restore',
  'case_and_audit_atomic_restore',
  'private_bucket_policy_restore',
  'object_version_manifest_checksums',
  'lor_only_rollback_or_forward_repair',
]);
const BACKUP_ERROR_CODES = new Set([
  '',
  'ATOMICITY_MISMATCH',
  'BUCKET_POLICY_MISMATCH',
  'CHECKSUM_MISMATCH',
  'CHECK_FAILED',
  'RESTORE_FAILED',
  'RLS_MISMATCH',
  'ROLLBACK_UNAVAILABLE',
  'SCHEMA_MISMATCH',
  'TARGET_NOT_ISOLATED',
]);
const COORDINATOR_REQUEST_KEYS = new Set([
  'dependency', 'metadataOnly', 'schemaVersion', 'signal', 'targetRef',
]);
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
const SAFE_EVIDENCE_KEYS = new Set([
  'dependency',
  'evidenceRef',
  'metadataOnly',
  'operation',
  'protectedContentObserved',
  'schemaVersion',
  'secretMaterialObserved',
  'targetRef',
]);
const SEALED_RESULT_KEYS = new Set([
  'dependency', 'metadataOnly', 'operational', 'schemaVersion', 'targetBound',
]);
const PROVIDER_RUNTIME_KEYS = new Set([
  'aiProposalProvider',
  'facultyEmailPort',
  'facultyInvitationKeyProvider',
  'facultyInvitationSecretBinding',
  'facultyInvitationSecretDeriver',
  'invitationOrigin',
  'probes',
]);
const BUILDER_OPTION_KEYS = new Set([
  'administrativeGrants',
  'audit',
  'backupRestore',
  'binding',
  'entitlement',
  'hydration',
  'providerRuntime',
  'storage',
]);

const BOUND_SURFACES = new WeakMap();
const SEALED_RESULTS = new WeakMap();

function unavailable(status) {
  return new IntegrationDisabledError(INTEGRATION, status);
}

function fail(status) {
  throw unavailable(status);
}

function isOwnFailure(error) {
  return error instanceof IntegrationDisabledError
    && error.details?.integration === INTEGRATION;
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
  const snapshot = {};
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

function validatedProductionBinding(rawBinding) {
  const binding = assertValidatedLorTargetBinding(rawBinding, INTEGRATION);
  if (binding.environment !== 'production') fail('PRODUCTION_TARGET_REQUIRED');
  return binding;
}

function exactPrototype(value, prototype, methods) {
  try {
    return Boolean(
      value
      && typeof value === 'object'
      && Object.isFrozen(value)
      && Object.getPrototypeOf(value) === prototype
      && methods.every((method) => value[method] === prototype[method])
    );
  } catch {
    return false;
  }
}

function assertProductionDatabaseReadiness(value) {
  if (!isAuthenticProductionPostgresReadiness(value)) {
    fail('AUTHENTIC_PRODUCTION_DATABASE_READINESS_REQUIRED');
  }
  return value;
}

function assertAuditSink(value) {
  if (!isAuthenticDurableArtifactAuditSink(value)) {
    fail('AUTHENTIC_DURABLE_AUDIT_SINK_REQUIRED');
  }
  return value;
}

function assertBackupRestoreAdapter(value) {
  if (!exactPrototype(value, BackupRestoreCheckAdapter.prototype, [
    'describePlan', 'runSyntheticRehearsal',
  ])) fail('AUTHENTIC_BACKUP_RESTORE_ADAPTER_REQUIRED');
  return value;
}

function assertSignedS2sEntitlementResolver(value) {
  const resolver = exactSnapshot(
    value,
    new Set(['resolve', 'signedS2s']),
    'SIGNED_S2S_ENTITLEMENT_RESOLVER_REQUIRED',
    { frozen: true },
  );
  if (resolver.signedS2s !== true || typeof resolver.resolve !== 'function') {
    fail('SIGNED_S2S_ENTITLEMENT_RESOLVER_REQUIRED');
  }
  return value;
}

function assertHydrationApplication(value) {
  if (!isAuthenticLorApplicationAdapter(value)) {
    fail('AUTHENTIC_PRODUCTION_HYDRATION_APPLICATION_REQUIRED');
  }
  return value;
}

function assertStorageAdapter(value) {
  if (!isVerifiedPrivateVersionedStorageAdapter(value)) {
    fail('VERIFIED_PRIVATE_STORAGE_ADAPTER_REQUIRED');
  }
  return value;
}

function assertExplicitSurfaceOptions(rawOptions, dependency, runtimeKey, runtimeValidator) {
  const keys = new Set(['binding', 'operation', runtimeKey]);
  const options = exactSnapshot(rawOptions, keys, `${dependency.toUpperCase()}_SURFACE_OPTIONS_INVALID`);
  const binding = validatedProductionBinding(options.binding);
  if (typeof options.operation !== 'function') {
    fail(`${dependency.toUpperCase()}_OPERATION_REQUIRED`);
  }
  return {
    binding,
    operation: options.operation,
    runtimeSurface: runtimeValidator(options[runtimeKey]),
  };
}

function registerSurface({ binding, dependency, operation = null, runtimeSurface }) {
  const descriptor = deepFreeze({
    schemaVersion: SURFACE_SCHEMA,
    dependency,
    metadataOnly: true,
    targetBound: true,
    protectedContentPermitted: false,
  });
  BOUND_SURFACES.set(descriptor, {
    claimed: false,
    dependency,
    operation,
    runtimeSurface,
    targetRef: productionOperationalReadinessTargetRef(binding),
  });
  return descriptor;
}

export function createProductionAdministrativeGrantsProbeSurface(rawOptions) {
  return registerSurface({
    dependency: 'administrativeGrants',
    ...assertExplicitSurfaceOptions(
      rawOptions,
      'administrativeGrants',
      'readiness',
      assertProductionDatabaseReadiness,
    ),
  });
}

export function createProductionAuditProbeSurface(rawOptions) {
  return registerSurface({
    dependency: 'audit',
    ...assertExplicitSurfaceOptions(rawOptions, 'audit', 'auditSink', assertAuditSink),
  });
}

export function createProductionBackupRestoreProbeSurface(rawOptions) {
  const options = exactSnapshot(
    rawOptions,
    new Set(['adapter', 'binding']),
    'BACKUPRESTORE_SURFACE_OPTIONS_INVALID',
  );
  const binding = validatedProductionBinding(options.binding);
  return registerSurface({
    binding,
    dependency: 'backupRestore',
    runtimeSurface: assertBackupRestoreAdapter(options.adapter),
  });
}

export function createProductionEntitlementProbeSurface(rawOptions) {
  return registerSurface({
    dependency: 'entitlement',
    ...assertExplicitSurfaceOptions(
      rawOptions,
      'entitlement',
      'resolver',
      assertSignedS2sEntitlementResolver,
    ),
  });
}

export function createProductionHydrationProbeSurface(rawOptions) {
  return registerSurface({
    dependency: 'hydration',
    ...assertExplicitSurfaceOptions(
      rawOptions,
      'hydration',
      'application',
      assertHydrationApplication,
    ),
  });
}

export function createProductionStorageProbeSurface(rawOptions) {
  return registerSurface({
    dependency: 'storage',
    ...assertExplicitSurfaceOptions(rawOptions, 'storage', 'adapter', assertStorageAdapter),
  });
}

function assertProviderRuntime(rawRuntime) {
  const runtime = exactSnapshot(
    rawRuntime,
    PROVIDER_RUNTIME_KEYS,
    'AUTHENTIC_PROVIDER_RUNTIME_REQUIRED',
    { frozen: true },
  );
  const probes = exactSnapshot(
    runtime.probes,
    new Set(PROVIDER_DEPENDENCIES),
    'COMPLETE_PROVIDER_RUNTIME_PROBES_REQUIRED',
    { frozen: true },
  );
  let invitationUrl;
  try {
    invitationUrl = new URL(runtime.invitationOrigin);
  } catch {
    fail('AUTHENTIC_PROVIDER_RUNTIME_REQUIRED');
  }
  if (
    !isAuthenticOpenAiGroundedProposalAdapter(runtime.aiProposalProvider)
    || !isAuthenticPostmarkFacultyInvitationAdapter(runtime.facultyEmailPort)
    || !exactPrototype(
      runtime.facultyInvitationSecretDeriver,
      HmacFacultyInvitationSecretDeriver.prototype,
      ['tokenForInvitation', 'deriveIssue', 'deriveResend'],
    )
    || runtime.facultyInvitationSecretBinding?.serverSideSecret !== true
    || runtime.facultyInvitationSecretBinding?.providerResourceBound !== true
    || runtime.facultyInvitationSecretBinding?.independentlyVerified !== true
    || runtime.facultyInvitationKeyProvider?.serverOnly !== true
    || typeof runtime.facultyInvitationKeyProvider?.getKey !== 'function'
    || invitationUrl.protocol !== 'https:'
    || PROVIDER_DEPENDENCIES.some((dependency) => typeof probes[dependency] !== 'function')
  ) fail('AUTHENTIC_PROVIDER_RUNTIME_REQUIRED');
  return probes;
}

function assertCoordinatorRequest(rawRequest, dependency, targetRef) {
  const request = exactSnapshot(
    rawRequest,
    COORDINATOR_REQUEST_KEYS,
    'COORDINATOR_PROBE_REQUEST_INVALID',
    { frozen: true },
  );
  if (
    request.schemaVersion !== COORDINATOR_REQUEST_SCHEMA
    || request.dependency !== dependency
    || request.targetRef !== targetRef
    || !SHA256.test(request.targetRef ?? '')
    || request.metadataOnly !== true
    || !(request.signal instanceof AbortSignal)
  ) fail('COORDINATOR_PROBE_REQUEST_INVALID');
  if (request.signal.aborted) fail('COORDINATOR_PROBE_ABORTED');
  return request;
}

async function abortable(signal, operation) {
  if (signal.aborted) fail('DEPENDENCY_PROBE_ABORTED');
  let abortListener;
  const aborted = new Promise((resolve, reject) => {
    abortListener = () => reject(unavailable('DEPENDENCY_PROBE_ABORTED'));
    signal.addEventListener('abort', abortListener, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), aborted]);
  } finally {
    signal.removeEventListener('abort', abortListener);
  }
}

function readyResult(dependency, targetRef, providerEvidenceRef) {
  return Object.freeze({
    state: 'ready',
    errorCode: '',
    evidenceRef: sha256(canonicalize({
      schemaVersion: SAFE_OUTPUT_EVIDENCE_SCHEMA,
      dependency,
      targetRef,
      providerEvidenceRef,
    })),
  });
}

function operationRequest(dependency, targetRef, signal) {
  return Object.freeze({
    schemaVersion: OPERATION_REQUEST_SCHEMA,
    dependency,
    targetRef,
    operation: OPERATIONS[dependency],
    metadataOnly: true,
    syntheticOnly: true,
    protectedContentPermitted: false,
    signal,
  });
}

function sealSafeEvidence(rawEvidence, { dependency, invocation, signal, targetRef }) {
  const evidence = exactSnapshot(
    rawEvidence,
    SAFE_EVIDENCE_KEYS,
    'SAFE_DEPENDENCY_EVIDENCE_INVALID',
    { frozen: true },
  );
  if (
    signal.aborted
    || evidence.schemaVersion !== SAFE_EVIDENCE_SCHEMA
    || evidence.dependency !== dependency
    || evidence.targetRef !== targetRef
    || evidence.operation !== OPERATIONS[dependency]
    || evidence.metadataOnly !== true
    || evidence.protectedContentObserved !== false
    || evidence.secretMaterialObserved !== false
    || !SHA256.test(evidence.evidenceRef ?? '')
  ) fail('SAFE_DEPENDENCY_EVIDENCE_INVALID');
  const sealed = Object.freeze({
    schemaVersion: SEALED_RESULT_SCHEMA,
    dependency,
    metadataOnly: true,
    targetBound: true,
    operational: true,
  });
  SEALED_RESULTS.set(sealed, { evidenceRef: evidence.evidenceRef, invocation });
  return sealed;
}

async function runExplicitProbe(state, rawRequest) {
  const request = assertCoordinatorRequest(rawRequest, state.dependency, state.targetRef);
  const invocation = Object.freeze({});
  const downstreamRequest = operationRequest(state.dependency, state.targetRef, request.signal);
  let active = true;
  let completed = false;
  const sealResult = (rawEvidence) => {
    if (!active || completed) fail('DEPENDENCY_PROBE_RESULT_REPLAYED');
    completed = true;
    return sealSafeEvidence(rawEvidence, {
      dependency: state.dependency,
      invocation,
      signal: request.signal,
      targetRef: state.targetRef,
    });
  };
  let rawResult;
  try {
    rawResult = await abortable(
      request.signal,
      () => state.operation(downstreamRequest, sealResult, state.runtimeSurface),
    );
  } catch (error) {
    if (isOwnFailure(error)) throw error;
    throw unavailable('DEPENDENCY_PROBE_FAILED');
  } finally {
    active = false;
  }
  const result = exactSnapshot(
    rawResult,
    SEALED_RESULT_KEYS,
    'SEALED_DEPENDENCY_RESULT_REQUIRED',
    { frozen: true },
  );
  const trusted = SEALED_RESULTS.get(rawResult);
  if (
    !trusted
    || trusted.invocation !== invocation
    || result.schemaVersion !== SEALED_RESULT_SCHEMA
    || result.dependency !== state.dependency
    || result.metadataOnly !== true
    || result.targetBound !== true
    || result.operational !== true
  ) fail('SEALED_DEPENDENCY_RESULT_REQUIRED');
  return readyResult(state.dependency, state.targetRef, trusted.evidenceRef);
}

function exactBackupPlan(rawPlan) {
  const plan = exactSnapshot(
    rawPlan,
    new Set([
      'checks',
      'protectedContentPermitted',
      'productionMutationPermitted',
      'schemaVersion',
      'syntheticOnly',
    ]),
    'BACKUP_RESTORE_PLAN_INVALID',
    { frozen: true },
  );
  if (
    plan.schemaVersion !== 'missionmed.lor.backup-restore-check-plan.v1'
    || plan.syntheticOnly !== true
    || plan.protectedContentPermitted !== false
    || plan.productionMutationPermitted !== false
    || !Array.isArray(plan.checks)
    || !Object.isFrozen(plan.checks)
    || canonicalize(plan.checks) !== canonicalize(REHEARSAL_CHECKS)
  ) fail('BACKUP_RESTORE_PLAN_INVALID');
  return plan;
}

function exactBackupResult(rawResult) {
  const result = exactSnapshot(
    rawResult,
    new Set(['completedAt', 'passed', 'results', 'schemaVersion', 'syntheticOnly']),
    'BACKUP_RESTORE_RESULT_INVALID',
    { frozen: true },
  );
  if (
    result.schemaVersion !== 'missionmed.lor.backup-restore-check-result.v1'
    || result.syntheticOnly !== true
    || result.passed !== true
    || !Array.isArray(result.results)
    || !Object.isFrozen(result.results)
    || result.results.length !== REHEARSAL_CHECKS.length
    || !Number.isFinite(Date.parse(result.completedAt ?? ''))
  ) fail('BACKUP_RESTORE_RESULT_INVALID');
  const safeResults = result.results.map((rawEntry, index) => {
    const entry = exactSnapshot(
      rawEntry,
      new Set(['check', 'errorCode', 'passed']),
      'BACKUP_RESTORE_RESULT_INVALID',
      { frozen: true },
    );
    if (
      entry.check !== REHEARSAL_CHECKS[index]
      || entry.passed !== true
      || entry.errorCode !== ''
      || !BACKUP_ERROR_CODES.has(entry.errorCode)
    ) fail('BACKUP_RESTORE_RESULT_INVALID');
    return entry;
  });
  return Object.freeze({
    completedAt: result.completedAt,
    results: Object.freeze(safeResults),
  });
}

async function runBackupRestoreProbe(state, rawRequest) {
  const request = assertCoordinatorRequest(rawRequest, state.dependency, state.targetRef);
  let plan;
  let result;
  try {
    plan = exactBackupPlan(state.runtimeSurface.describePlan());
    result = exactBackupResult(await abortable(
      request.signal,
      () => state.runtimeSurface.runSyntheticRehearsal(),
    ));
  } catch (error) {
    if (isOwnFailure(error)) throw error;
    throw unavailable('BACKUP_RESTORE_PROBE_FAILED');
  }
  return readyResult(state.dependency, state.targetRef, sha256(canonicalize({
    schemaVersion: SAFE_EVIDENCE_SCHEMA,
    dependency: state.dependency,
    targetRef: state.targetRef,
    operation: OPERATIONS[state.dependency],
    planChecks: plan.checks,
    completedAt: result.completedAt,
    results: result.results,
  })));
}

function claimBoundSurfaces(options, targetRef) {
  const entries = BOUND_DEPENDENCIES.map((dependency) => {
    const descriptor = options[dependency];
    const state = descriptor && typeof descriptor === 'object'
      ? BOUND_SURFACES.get(descriptor)
      : null;
    if (!state || state.dependency !== dependency) {
      fail('COMPLETE_BOUND_DEPENDENCY_SURFACES_REQUIRED');
    }
    if (state.claimed) fail('BOUND_DEPENDENCY_SURFACE_REPLAYED');
    if (state.targetRef !== targetRef) fail('BOUND_DEPENDENCY_SURFACE_TARGET_MISMATCH');
    return [dependency, state];
  });
  for (const [, state] of entries) state.claimed = true;
  return new Map(entries);
}

export function createProductionDependencyProbes(rawOptions) {
  const options = exactSnapshot(rawOptions, BUILDER_OPTION_KEYS, 'PROBE_SET_OPTIONS_INVALID');
  const binding = validatedProductionBinding(options.binding);
  const targetRef = productionOperationalReadinessTargetRef(binding);
  const providerProbes = assertProviderRuntime(options.providerRuntime);
  const surfaceStates = claimBoundSurfaces(options, targetRef);
  const probes = {};
  for (const dependency of ALL_DEPENDENCIES) {
    if (PROVIDER_DEPENDENCIES.includes(dependency)) {
      probes[dependency] = providerProbes[dependency];
      continue;
    }
    const state = surfaceStates.get(dependency);
    probes[dependency] = dependency === 'backupRestore'
      ? (request) => runBackupRestoreProbe(state, request)
      : (request) => runExplicitProbe(state, request);
  }
  return Object.freeze(probes);
}

export const PRODUCTION_DEPENDENCY_PROBE_SET_CONTRACT = deepFreeze({
  schemaVersion: PRODUCTION_DEPENDENCY_PROBE_SET_SCHEMA,
  dependencies: [...ALL_DEPENDENCIES],
  providerRuntimeDependencies: [...PROVIDER_DEPENDENCIES],
  boundSurfaceDependencies: [...BOUND_DEPENDENCIES],
  operations: { ...OPERATIONS },
  targetBinding: 'exact_validated_DR_133_production_binding',
  surfaceAuthority: 'module_private_single_claim_target_bound_registry',
  explicitResultAuthority: 'per_invocation_module_sealed_result_registry',
  backupRestore: 'authentic_adapter_isolated_synthetic_rehearsal',
  protectedContent: 'prohibited',
  secretMaterial: 'prohibited',
  output: 'state_error_code_and_safe_sha256_only',
  abortSignal: 'coordinator_signal_forwarded_exactly',
});
