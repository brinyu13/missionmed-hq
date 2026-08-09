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
const ALLOWED_OPERATIONS = new Set([
  'export_case_for_privacy_request',
  'investigate_delivery_failure',
  'read_case_content_for_privacy_request',
  'restore_case_from_verified_backup',
]);
const AUTHORITY_PATTERN = /^privacy-authority:[A-Za-z0-9_.:-]{1,120}$/u;
const AUDIT_REF_PATTERN = /^(?:event_)?[a-f0-9]{64}$/u;

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
}

export const ADMINISTRATIVE_GRANT_CONTRACT = deepFreeze({
  grantSchema: GRANT_SCHEMA,
  revocationSchema: REVOCATION_SCHEMA,
  operations: [...ALLOWED_OPERATIONS],
  mutation: 'append_grant_or_append_revocation_only',
  routineWordPressAdministratorAccess: 'not_a_content_grant',
});
