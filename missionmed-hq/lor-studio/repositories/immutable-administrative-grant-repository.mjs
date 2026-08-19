import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IntegrationDisabledError,
  NotFoundError,
  ValidationError,
} from '../domain/errors.js';
import {
  assertNonEmptyString,
  canonicalize,
  cloneFrozen,
  deepFreeze,
  sha256,
  toIso,
} from '../domain/value-utils.js';

const GRANT_SCHEMA = 'missionmed.lor.administrative-grant.v1';
const REVOCATION_SCHEMA = 'missionmed.lor.administrative-grant-revocation.v1';
const ACTIVATION_SCHEMA = 'missionmed.lor.administrative-grant-activation.v1';

// Grants come in two disjoint capability classes and neither implies the other.
//
// CONTENT_OPERATIONS reach case content. OPERATIONAL_METADATA_OPERATIONS reach only the
// operational metadata projection - no student identity, no student evidence, no faculty
// private material. DR-119 clause 9 added the metadata class because operational-role
// membership was, on its own, opening every case's metadata to every admin/founder/support
// actor. Closing that needed a capability to point at, so one exists here.
//
// The classes are kept apart deliberately. A content grant does NOT authorise a metadata read
// and a metadata grant does NOT authorise a content read; each is issued, bound, expired,
// revoked, and audited on its own. In particular, adding the metadata class does not
// reclassify routine WordPress administrator access as content access - routine access
// remains no grant at all.
const CONTENT_OPERATIONS = new Set([
  'export_case_for_privacy_request',
  'investigate_delivery_failure',
  'read_case_content_for_privacy_request',
  'restore_case_from_verified_backup',
]);
const OPERATIONAL_METADATA_OPERATIONS = new Set([
  'read_operational_case_metadata',
  'emergency_operational_case_metadata_break_glass',
]);
// Break glass is a NAMED, opt-in operation, never an implicit consequence of holding a role.
// It is issued, case-bound, expiring, privacy-authority-bound, and audit-ref-bound exactly
// like every other grant; the only thing the separate name buys is that an auditor can tell
// emergency access apart from routine authorised access after the fact.
const BREAK_GLASS_OPERATIONS = new Set(['emergency_operational_case_metadata_break_glass']);
const ALLOWED_OPERATIONS = new Set([...CONTENT_OPERATIONS, ...OPERATIONAL_METADATA_OPERATIONS]);

// A revocation check is a ledger read, so it cannot be re-derived from an offline grant
// record. An activation proof records that the read happened and when, and callers must
// refresh it rather than replaying an old one against a grant revoked in the meantime.
const DEFAULT_ACTIVATION_MAX_AGE_MS = 60_000;
const AUTHORITY_PATTERN = /^privacy-authority:[A-Za-z0-9_.:-]{1,120}$/u;
const AUDIT_REF_PATTERN = /^(?:event_)?[a-f0-9]{64}$/u;

/**
 * @typedef {object} AdministrativeGrantInput
 * @property {string} [grantId]
 * @property {string} [granteeId]
 * @property {string} [caseId]
 * @property {string} [operation]
 * @property {string} [purpose]
 * @property {string} [privacyAuthority]
 * @property {Date | string | number} [issuedAt]
 * @property {Date | string | number} [expiresAt]
 * @property {string} [auditEventRef]
 */

/**
 * @typedef {object} AdministrativeGrantDriver
 * @property {boolean} [appendOnly]
 * @property {(grant: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} appendGrant
 * @property {(revocation: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} appendRevocation
 * @property {(request: {grantId: string}) => Promise<Record<string, unknown> | null | undefined>} readGrantWithRevocation
 */

/**
 * @typedef {object} AdministrativeGrantRepositoryOptions
 * @property {Record<string, unknown> | null} [binding]
 * @property {AdministrativeGrantDriver | null} [driver]
 * @property {() => Date | string | number} [clock]
 */

/**
 * @typedef {object} ActiveAdministrativeGrantRequest
 * @property {string} [grantId]
 * @property {string} [granteeId]
 * @property {string} [caseId]
 * @property {string} [operation]
 * @property {string} [purpose]
 */

function assertBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.appendOnly !== true
    || binding.auditBound !== true
    || binding.revocationLedger !== true
  ) {
    throw new IntegrationDisabledError('lor_administrative_grants', 'IMMUTABLE_GRANT_BINDING_REQUIRED');
  }
}

function assertDriver(driver) {
  if (
    !driver
    || driver.appendOnly !== true
    || typeof driver.appendGrant !== 'function'
    || typeof driver.appendRevocation !== 'function'
    || typeof driver.readGrantWithRevocation !== 'function'
  ) {
    throw new IntegrationDisabledError('lor_administrative_grants', 'APPEND_ONLY_DRIVER_REQUIRED');
  }
  return driver;
}

function assertAuditRef(value, fieldName) {
  if (!AUDIT_REF_PATTERN.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must bind to a metadata audit event`);
  }
}

function hashGrant(unsigned) {
  return sha256(canonicalize(unsigned));
}

/** @param {AdministrativeGrantInput} [input] */
export function createAdministrativeGrant({
  grantId,
  granteeId,
  caseId,
  operation,
  purpose,
  privacyAuthority,
  issuedAt,
  expiresAt,
  auditEventRef,
} = {}) {
  assertNonEmptyString(grantId, 'grantId', { maxLength: 200 });
  assertNonEmptyString(granteeId, 'granteeId', { maxLength: 200 });
  assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
  assertNonEmptyString(purpose, 'purpose', { maxLength: 500 });
  if (!ALLOWED_OPERATIONS.has(operation)) throw new ValidationError('Administrative grant operation is not allowlisted');
  if (!AUTHORITY_PATTERN.test(privacyAuthority ?? '')) {
    throw new ValidationError('Administrative grant privacyAuthority is invalid');
  }
  assertAuditRef(auditEventRef, 'auditEventRef');
  const issued = toIso(issuedAt, 'issuedAt');
  const expiry = toIso(expiresAt, 'expiresAt');
  if (new Date(expiry).valueOf() <= new Date(issued).valueOf()) {
    throw new ValidationError('Administrative grant expiry must follow issuance');
  }
  const unsigned = {
    schemaVersion: GRANT_SCHEMA,
    grantId,
    granteeId,
    caseId,
    operation,
    purpose: purpose.trim(),
    privacyAuthority,
    issuedAt: issued,
    expiresAt: expiry,
    auditEventRef,
    revokedAt: null,
  };
  return deepFreeze({ ...unsigned, grantHash: hashGrant(unsigned) });
}

export function validateAdministrativeGrant(grant) {
  if (!grant || grant.schemaVersion !== GRANT_SCHEMA) {
    throw new DomainInvariantError('Unsupported administrative grant schema');
  }
  const reconstructed = createAdministrativeGrant(grant);
  if (grant.grantHash !== reconstructed.grantHash || canonicalize(grant) !== canonicalize(reconstructed)) {
    throw new DomainInvariantError('Administrative grant is not the immutable canonical record');
  }
  return true;
}

/**
 * The class is DERIVED from the allowlisted operation, never stored on the grant. A stored
 * class field could contradict its own operation; a derived one cannot.
 *
 * @param {unknown} operation
 * @returns {'case_content' | 'operational_metadata' | null} null for anything unrecognised,
 *   so callers fail closed rather than defaulting to a class.
 */
export function administrativeGrantOperationClass(operation) {
  // A non-string operation is not merely unclassified, it is unrecognised: normalise it to a
  // value no allowlist contains rather than letting it reach a Set lookup untyped.
  const name = typeof operation === 'string' ? operation : '';
  if (CONTENT_OPERATIONS.has(name)) return 'case_content';
  if (OPERATIONAL_METADATA_OPERATIONS.has(name)) return 'operational_metadata';
  return null;
}

/** @param {unknown} operation */
export function isBreakGlassAdministrativeOperation(operation) {
  return typeof operation === 'string' && BREAK_GLASS_OPERATIONS.has(operation);
}

/**
 * Records that the revocation ledger was consulted for one grant and found it live. `revoked`
 * must be passed as an explicit `false`: an omitted field must never be readable as "not
 * revoked".
 *
 * The hash binds the proof to one grant and makes tampering detectable. It is not an
 * authenticator - it cannot defend against a compromised server, only against a proof that
 * was edited or built for a different grant.
 *
 * @param {{ grant?: Record<string, unknown>, revoked?: boolean, checkedAt?: Date | string | number }} [input]
 */
export function createAdministrativeGrantActivation({ grant, revoked, checkedAt } = {}) {
  validateAdministrativeGrant(grant);
  if (revoked !== false) throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOKED');
  const unsigned = {
    schemaVersion: ACTIVATION_SCHEMA,
    grantId: grant.grantId,
    grantHash: grant.grantHash,
    revocationLedgerChecked: true,
    revoked: false,
    checkedAt: toIso(checkedAt, 'checkedAt'),
  };
  return deepFreeze({ ...unsigned, activationHash: hashGrant(unsigned) });
}

function assertActivationProof(activation, grant, nowMs, maxAgeMs) {
  if (
    !activation
    || typeof activation !== 'object'
    || activation.schemaVersion !== ACTIVATION_SCHEMA
    || activation.grantId !== grant.grantId
    || activation.grantHash !== grant.grantHash
    || activation.revocationLedgerChecked !== true
    || activation.revoked !== false
  ) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOCATION_UNPROVEN');
  }
  const { activationHash, ...unsigned } = activation;
  if (activationHash !== hashGrant(unsigned)) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOCATION_UNPROVEN');
  }
  const checkedMs = Date.parse(String(activation.checkedAt ?? ''));
  if (!Number.isFinite(checkedMs) || checkedMs > nowMs || nowMs - checkedMs > maxAgeMs) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOCATION_STALE');
  }
}

/**
 * Verifies a case-scoped operational-metadata capability. Every failure raises
 * AuthorizationDeniedError - there is no boolean return a caller could accidentally read the
 * wrong way round - and the HTTP layer collapses that error to an undifferentiated 404, so a
 * denial here cannot be used to probe whether a case exists.
 *
 * @param {{
 *   grant?: Record<string, unknown>,
 *   activation?: Record<string, unknown>,
 *   granteeId?: string,
 *   caseId?: string,
 *   purpose?: string,
 *   now?: Date | string | number,
 *   maxActivationAgeMs?: number,
 * }} [request]
 */
export function assertOperationalMetadataGrant({
  grant,
  activation,
  granteeId,
  caseId,
  purpose,
  now = new Date(),
  maxActivationAgeMs = DEFAULT_ACTIVATION_MAX_AGE_MS,
} = {}) {
  try {
    validateAdministrativeGrant(grant);
  } catch {
    // Canonical-record failures are folded into the same denial as every other failure below:
    // a caller learns only that access was refused.
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_INVALID');
  }
  if (administrativeGrantOperationClass(grant.operation) !== 'operational_metadata') {
    // A content grant is not silently accepted as a metadata grant. Issue the metadata grant.
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_OPERATION_CLASS_MISMATCH');
  }
  if (
    grant.granteeId !== granteeId
    || grant.caseId !== caseId
    || (purpose !== undefined && grant.purpose !== purpose)
  ) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_BINDING_MISMATCH');
  }
  const nowMs = now instanceof Date ? now.valueOf() : Date.parse(String(now));
  if (!Number.isFinite(nowMs)) throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_CLOCK_INVALID');
  const issuedMs = Date.parse(String(grant.issuedAt));
  const expiresMs = Date.parse(String(grant.expiresAt));
  if (
    !Number.isFinite(issuedMs)
    || !Number.isFinite(expiresMs)
    || nowMs < issuedMs
    || nowMs >= expiresMs
  ) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_EXPIRED_OR_NOT_YET_VALID');
  }
  assertActivationProof(activation, grant, nowMs, maxActivationAgeMs);
  return deepFreeze({
    granted: true,
    grantId: grant.grantId,
    granteeId: grant.granteeId,
    caseId: grant.caseId,
    operation: grant.operation,
    operationClass: 'operational_metadata',
    breakGlass: isBreakGlassAdministrativeOperation(grant.operation),
    purpose: grant.purpose,
    privacyAuthority: grant.privacyAuthority,
    auditEventRef: grant.auditEventRef,
    expiresAt: grant.expiresAt,
  });
}

function createRevocation({ grant, revokedAt, revokedByAuthority, reasonCode, auditEventRef }) {
  validateAdministrativeGrant(grant);
  if (!AUTHORITY_PATTERN.test(revokedByAuthority ?? '')) {
    throw new ValidationError('Revoking privacy authority is invalid');
  }
  if (!/^[A-Z0-9_:-]{1,120}$/u.test(reasonCode ?? '')) {
    throw new ValidationError('Grant revocation reasonCode is invalid');
  }
  assertAuditRef(auditEventRef, 'auditEventRef');
  const timestamp = toIso(revokedAt, 'revokedAt');
  if (new Date(timestamp).valueOf() < new Date(grant.issuedAt).valueOf()) {
    throw new ValidationError('Grant revocation cannot predate issuance');
  }
  const unsigned = {
    schemaVersion: REVOCATION_SCHEMA,
    grantId: grant.grantId,
    grantHash: grant.grantHash,
    revokedAt: timestamp,
    revokedByAuthority,
    reasonCode,
    auditEventRef,
  };
  return deepFreeze({ ...unsigned, revocationHash: hashGrant(unsigned) });
}

function validateRevocation(revocation, grant) {
  if (!revocation) return null;
  const canonical = createRevocation({
    grant,
    revokedAt: revocation.revokedAt,
    revokedByAuthority: revocation.revokedByAuthority,
    reasonCode: revocation.reasonCode,
    auditEventRef: revocation.auditEventRef,
  });
  if (canonicalize(canonical) !== canonicalize(revocation)) {
    throw new DomainInvariantError('Administrative grant revocation is not canonical');
  }
  return canonical;
}

export class ImmutableAdministrativeGrantRepository {
  /** @param {AdministrativeGrantRepositoryOptions} [options] */
  constructor({ binding, driver, clock = () => new Date() } = {}) {
    assertBinding(binding);
    this.driver = assertDriver(driver);
    if (typeof clock !== 'function') throw new TypeError('clock must be injected');
    this.clock = clock;
    this.durability = 'DURABLE_APPEND_ONLY_PROVIDER_BOUND';
    this.isDurable = true;
    Object.freeze(this);
  }

  async create(grant) {
    validateAdministrativeGrant(grant);
    const result = await this.driver.appendGrant(structuredClone(grant));
    if (
      !result
      || result.appended !== true
      || result.auditBound !== true
      || result.immutable !== true
      || canonicalize(result.grant) !== canonicalize(grant)
    ) {
      throw new IntegrationDisabledError('lor_administrative_grants', 'GRANT_APPEND_UNPROVEN');
    }
    return cloneFrozen(result.grant);
  }

  async revoke({ grantId, revokedByAuthority, reasonCode, auditEventRef }) {
    const aggregate = await this.#readAggregate(grantId);
    if (aggregate.revocation) return cloneFrozen(aggregate.revocation);
    const revocation = createRevocation({
      grant: aggregate.grant,
      revokedAt: this.clock(),
      revokedByAuthority,
      reasonCode,
      auditEventRef,
    });
    const result = await this.driver.appendRevocation(structuredClone(revocation));
    if (
      !result
      || result.appended !== true
      || result.auditBound !== true
      || result.immutable !== true
      || canonicalize(result.revocation) !== canonicalize(revocation)
    ) {
      throw new IntegrationDisabledError('lor_administrative_grants', 'GRANT_REVOCATION_UNPROVEN');
    }
    return cloneFrozen(result.revocation);
  }

  async #readAggregate(grantId) {
    assertNonEmptyString(grantId, 'grantId', { maxLength: 200 });
    const aggregate = await this.driver.readGrantWithRevocation({ grantId });
    if (!aggregate?.grant) throw new NotFoundError('administrative_grant', grantId);
    validateAdministrativeGrant(aggregate.grant);
    if (aggregate.grant.grantId !== grantId) {
      throw new DomainInvariantError('Administrative grant driver returned a different grant');
    }
    return deepFreeze({
      grant: cloneFrozen(aggregate.grant),
      revocation: validateRevocation(aggregate.revocation, aggregate.grant),
    });
  }

  /** @param {ActiveAdministrativeGrantRequest} [request] */
  async getActiveGrant({ grantId, granteeId, caseId, operation, purpose } = {}) {
    const aggregate = await this.#readAggregate(grantId);
    const { grant, revocation } = aggregate;
    const now = new Date(toIso(this.clock(), 'clock')).valueOf();
    if (revocation) throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOKED');
    if (now < new Date(grant.issuedAt).valueOf() || now >= new Date(grant.expiresAt).valueOf()) {
      throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_EXPIRED_OR_NOT_YET_VALID');
    }
    if (
      grant.granteeId !== granteeId
      || grant.caseId !== caseId
      || grant.operation !== operation
      || grant.purpose !== purpose
    ) {
      throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_BINDING_MISMATCH');
    }
    return cloneFrozen(grant);
  }

  /**
   * Resolves the capability an operational-metadata read needs: the live grant plus proof the
   * revocation ledger was just consulted. Reaching the activation line means getActiveGrant
   * already rejected a revoked, expired, or mis-bound grant, which is why `revoked: false` can
   * be asserted here rather than guessed.
   *
   * @param {ActiveAdministrativeGrantRequest} [request]
   */
  async getActiveOperationalMetadataGrant({ grantId, granteeId, caseId, operation, purpose } = {}) {
    if (administrativeGrantOperationClass(operation) !== 'operational_metadata') {
      throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_OPERATION_CLASS_MISMATCH');
    }
    const grant = await this.getActiveGrant({ grantId, granteeId, caseId, operation, purpose });
    return deepFreeze({
      grant,
      activation: createAdministrativeGrantActivation({
        grant,
        revoked: false,
        checkedAt: this.clock(),
      }),
    });
  }
}

export const ADMINISTRATIVE_GRANT_CONTRACT = deepFreeze({
  grantSchema: GRANT_SCHEMA,
  revocationSchema: REVOCATION_SCHEMA,
  activationSchema: ACTIVATION_SCHEMA,
  operations: [...ALLOWED_OPERATIONS],
  operationClasses: {
    case_content: [...CONTENT_OPERATIONS],
    operational_metadata: [...OPERATIONAL_METADATA_OPERATIONS],
  },
  breakGlassOperations: [...BREAK_GLASS_OPERATIONS],
  activationMaxAgeMs: DEFAULT_ACTIVATION_MAX_AGE_MS,
  mutation: 'append_grant_or_append_revocation_only',
  routineWordPressAdministratorAccess: 'not_a_content_grant',
  // DR-119 clause 9. Routine operational-role membership is still not a grant of any kind.
  // A metadata read now needs its own case-scoped grant, and holding one conveys no content
  // authority - the line above keeps its original meaning.
  routineOperationalRoleCaseMetadataAccess: 'not_a_grant_requires_case_scoped_metadata_grant',
  operationalMetadataGrant: 'not_a_content_grant',
});
