import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import { deepFreeze, sha256, toIso } from '../domain/value-utils.js';

const DEPENDENCY_NAMES = Object.freeze([
  'administrativeGrants',
  'audit',
  'backupRestore',
  'email',
  'entitlement',
  'hydration',
  'otp',
  'repository',
  'rls',
  'storage',
]);
const DEPENDENCY_STATES = new Set(['ready', 'degraded', 'unavailable', 'disabled', 'unknown']);
const GENERIC_DEPENDENCY_ERROR_CODES = new Set([
  '',
  'DEPENDENCY_CHECK_FAILED',
  'DEPENDENCY_FAILURE',
  'DEPENDENCY_NOT_ATOMIC',
  'DEPENDENCY_NOT_BOUND',
  'DEPENDENCY_NOT_DURABLE',
  'DEPENDENCY_POLICY_UNVERIFIED',
  'DEPENDENCY_UNAVAILABLE',
]);
const DEPENDENCY_ERROR_MAP = new Map([
  ['', ''],
  ['AUTH_FAILED', 'DEPENDENCY_UNAVAILABLE'],
  ['CHECK_FAILED', 'DEPENDENCY_CHECK_FAILED'],
  ['CONNECTION_FAILED', 'DEPENDENCY_UNAVAILABLE'],
  ['NOT_ATOMIC', 'DEPENDENCY_NOT_ATOMIC'],
  ['NOT_BOUND', 'DEPENDENCY_NOT_BOUND'],
  ['NOT_DURABLE', 'DEPENDENCY_NOT_DURABLE'],
  ['POLICY_UNVERIFIED', 'DEPENDENCY_POLICY_UNVERIFIED'],
  ['TIMEOUT', 'DEPENDENCY_UNAVAILABLE'],
  ['UNREACHABLE', 'DEPENDENCY_UNAVAILABLE'],
]);
const SAFE_EVENT_TYPES = new Set([
  'dependency.probe',
  'hydration.blocked',
  'provider.failure',
  'restore.rehearsal',
  'storage.receipt',
  'transaction.commit',
]);
const SAFE_OUTCOMES = new Set(['success', 'denied', 'degraded', 'failed']);
const SAFE_METADATA_KEYS = new Set([
  'dependency',
  'errorCode',
  'operation',
  'reasonCode',
  'result',
  'state',
]);
const PROTECTED_FIELD = /(answer|authorization|body|content|cookie|email|evidence|letter|name|note|prompt|secret|signature|story|text|token)/iu;
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
const SAFE_METADATA_ENUMS = Object.freeze({
  dependency: new Set(DEPENDENCY_NAMES),
  errorCode: new Set([...GENERIC_DEPENDENCY_ERROR_CODES, ...BACKUP_ERROR_CODES]),
  operation: new Set([
    'case_create',
    'case_read',
    'case_save',
    'email_send',
    'hydrate',
    'otp_verify',
    'restore_check',
    'storage_get',
    'storage_put',
  ]),
  reasonCode: new Set([
    'dependency_not_ready',
    'feature_disabled',
    'hydration_blocked',
    'kill_switch_active',
    'provider_unavailable',
    'receipt_invalid',
  ]),
  result: new Set(['blocked', 'committed', 'denied', 'failed', 'passed', 'ready', 'unavailable']),
  state: new Set(DEPENDENCY_STATES),
});

function mapDependencyErrorCode(rawCode, state) {
  const normalized = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!normalized) return state === 'ready' ? '' : 'DEPENDENCY_UNAVAILABLE';
  return DEPENDENCY_ERROR_MAP.get(normalized) ?? 'DEPENDENCY_FAILURE';
}

function safeProbeResult(raw) {
  const state = DEPENDENCY_STATES.has(raw?.state) ? raw.state : 'unknown';
  const errorCode = mapDependencyErrorCode(raw?.errorCode, state);
  return deepFreeze({
    state: errorCode ? 'unavailable' : state,
    errorCode,
  });
}

export class DependencyAwareMetadataHealthAdapter {
  constructor({ dependencies, flags, clock = () => new Date() } = {}) {
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      throw new IntegrationDisabledError('lor_health', 'DEPENDENCY_PROBES_REQUIRED');
    }
    const unexpected = Object.keys(dependencies).filter((name) => !DEPENDENCY_NAMES.includes(name));
    if (unexpected.length || DEPENDENCY_NAMES.some((name) => typeof dependencies[name]?.probe !== 'function')) {
      throw new IntegrationDisabledError('lor_health', 'COMPLETE_DEPENDENCY_PROBES_REQUIRED');
    }
    if (!flags || typeof flags !== 'object') throw new IntegrationDisabledError('lor_health', 'FEATURE_FLAGS_REQUIRED');
    if (typeof clock !== 'function') throw new TypeError('clock must be injected');
    this.dependencies = dependencies;
    this.flags = Object.freeze({
      enabled: flags.enabled === true,
      killSwitch: flags.killSwitch !== false,
      requireCanary: flags.requireCanary === true,
    });
    this.metadataOnly = true;
    this.clock = clock;
    Object.freeze(this);
  }

  async snapshot() {
    const entries = await Promise.all(DEPENDENCY_NAMES.map(async (name) => {
      try {
        const result = safeProbeResult(await this.dependencies[name].probe());
        return [name, result];
      } catch {
        return [name, deepFreeze({ state: 'unavailable', errorCode: 'PROBE_FAILED' })];
      }
    }));
    const dependencies = Object.freeze(Object.fromEntries(entries));
    let status = 'ready';
    let reason = 'all_dependencies_ready';
    if (!this.flags.enabled) {
      status = 'closed';
      reason = 'feature_disabled';
    } else if (this.flags.killSwitch) {
      status = 'paused';
      reason = 'kill_switch_active';
    } else if (!this.flags.requireCanary) {
      status = 'blocked';
      reason = 'canary_requirement_not_enforced';
    } else if (Object.values(dependencies).some((item) => item.state !== 'ready')) {
      status = 'blocked';
      reason = 'dependency_not_ready';
    }
    return deepFreeze({
      schemaVersion: 'missionmed.lor.dependency-health.v1',
      service: 'missionmed-lor-studio',
      at: toIso(this.clock(), 'clock'),
      status,
      reason,
      productionOperational: status === 'ready',
      dependencies,
    });
  }
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new ValidationError('Operational log metadata must be an object');
  }
  const output = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key) || PROTECTED_FIELD.test(key)) {
      throw new ValidationError('Operational log metadata key is not allowlisted', { field: key });
    }
    if (typeof value !== 'string' || !SAFE_METADATA_ENUMS[key].has(value)) {
      throw new ValidationError('Operational log metadata value is outside its finite enum', { field: key });
    }
    output[key] = value;
  }
  return output;
}

export class AllowlistedOperationalLogger {
  constructor({ sink, clock = () => new Date() } = {}) {
    if (!sink || typeof sink.writeMetadataEvent !== 'function') {
      throw new IntegrationDisabledError('lor_operational_logging', 'METADATA_SINK_REQUIRED');
    }
    if (typeof clock !== 'function') throw new TypeError('clock must be injected');
    this.sink = sink;
    this.clock = clock;
    Object.freeze(this);
  }

  async log({ eventType, outcome, correlationId, caseId = '', metadata = {} } = {}) {
    if (!SAFE_EVENT_TYPES.has(eventType)) throw new ValidationError('Operational event type is not allowlisted');
    if (!SAFE_OUTCOMES.has(outcome)) throw new ValidationError('Operational event outcome is not allowlisted');
    if (typeof correlationId !== 'string' || correlationId.trim() === '') {
      throw new ValidationError('Operational correlationId is required');
    }
    if (correlationId.length > 512 || String(caseId).length > 200) {
      throw new ValidationError('Operational identifier exceeds its maximum length');
    }
    const event = deepFreeze({
      schemaVersion: 'missionmed.lor.operational-event.v1',
      eventType,
      outcome,
      correlationRef: sha256(`lor-studio:correlation:${correlationId}`),
      caseRef: caseId ? sha256(`lor-studio:case:${caseId}`) : '',
      metadata: deepFreeze(safeMetadata(metadata)),
      occurredAt: toIso(this.clock(), 'clock'),
    });
    const receipt = await this.sink.writeMetadataEvent(event);
    if (receipt?.accepted !== true || receipt?.metadataOnly !== true) {
      throw new IntegrationDisabledError('lor_operational_logging', 'METADATA_SINK_RECEIPT_INVALID');
    }
    return event;
  }
}

function assertBackupBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.syntheticOnly !== true
    || binding.isolatedRestoreTarget !== true
    || binding.databaseAndAuditTogether !== true
    || binding.storageVersionManifest !== true
  ) {
    throw new IntegrationDisabledError('lor_backup_restore', 'BACKUP_RESTORE_BINDING_REQUIRED');
  }
}

export class BackupRestoreCheckAdapter {
  constructor({ binding, checker, clock = () => new Date() } = {}) {
    assertBackupBinding(binding);
    if (!checker || typeof checker.runCheck !== 'function') {
      throw new IntegrationDisabledError('lor_backup_restore', 'INJECTED_CHECKER_REQUIRED');
    }
    if (typeof clock !== 'function') throw new TypeError('clock must be injected');
    this.checker = checker;
    this.clock = clock;
    Object.freeze(this);
  }

  describePlan() {
    return deepFreeze({
      schemaVersion: 'missionmed.lor.backup-restore-check-plan.v1',
      syntheticOnly: true,
      checks: [...REHEARSAL_CHECKS],
      protectedContentPermitted: false,
      productionMutationPermitted: false,
    });
  }

  async runSyntheticRehearsal() {
    const results = [];
    for (const check of REHEARSAL_CHECKS) {
      let result;
      try {
        result = await this.checker.runCheck({ check, syntheticOnly: true, metadataOnly: true });
      } catch {
        result = { passed: false, errorCode: 'CHECK_FAILED' };
      }
      const rawErrorCode = typeof result?.errorCode === 'string'
        ? result.errorCode.trim().toUpperCase()
        : '';
      const errorCode = BACKUP_ERROR_CODES.has(rawErrorCode) ? rawErrorCode : 'CHECK_FAILED';
      results.push(deepFreeze({
        check,
        passed: result?.passed === true && errorCode === '',
        errorCode,
      }));
    }
    const passed = results.every((result) => result.passed);
    return deepFreeze({
      schemaVersion: 'missionmed.lor.backup-restore-check-result.v1',
      syntheticOnly: true,
      passed,
      results,
      completedAt: toIso(this.clock(), 'clock'),
    });
  }
}

export const OPERATIONAL_READINESS_CONTRACT = deepFreeze({
  dependencies: [...DEPENDENCY_NAMES],
  healthContent: 'dependency_state_and_error_code_only',
  productionCanaryConfiguration: 'requireCanary_must_be_explicitly_true',
  logContent: 'allowlisted_metadata_and_hashed_references_only',
  restoreChecks: [...REHEARSAL_CHECKS],
});
