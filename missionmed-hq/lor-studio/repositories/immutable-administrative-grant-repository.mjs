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
const CAPABILITY_SCHEMA = 'missionmed.lor.operational-metadata-capability.v1';

/**
 * Capabilities this module actually ISSUED, after reading the revocation ledger.
 *
 * WHY THIS EXISTS. `createAdministrativeGrant` and `createAdministrativeGrantActivation` are
 * public and build over an UNKEYED sha256. The hash proves a record is internally consistent;
 * it proves NOTHING about provenance, because anybody who can call the constructor can compute
 * a matching hash. A never-issued, never-persisted grant built at a call site therefore used to
 * satisfy every check `assertOperationalMetadataGrant` made and yield the full operational
 * projection. That is only an in-process capability today, but it becomes a request-level
 * forgery the moment the composition root forwards a caller-supplied grant object.
 *
 * The fix is provenance by OBJECT IDENTITY, the same property adapters/lor-target-binding.mjs
 * relies on. Membership here cannot be computed, guessed, serialised, or copied: a spread copy
 * is a different object, and a JSON body deserialised from an HTTP request is a different
 * object. Only the issuing path below adds to this set.
 *
 * WHY THE WEAKSET GUARDS THE CAPABILITY AND NOT THE GRANT. Registering grants at construction
 * would be vacuous - the constructor is the public export, so a forgery would be registered too.
 * Registering grants after a durable read would break instead: a grant is DURABLE data that
 * crosses Supabase and comes back as a fresh object with fresh identity, so no WeakSet can
 * recognise it. The two concerns are therefore split by lifetime:
 *
 *   - the GRANT record crosses the persistence boundary, and is defended by its canonical hash
 *     plus the append-only revocation ledger (integrity, NOT authenticity);
 *   - the CAPABILITY is in-process and request-scoped, never persisted, never serialised, and
 *     is defended by unforgeable object identity (authenticity).
 *
 * A WeakSet alone would NOT have been sufficient had it been applied to the grant. Applied to
 * the capability it is sufficient, and it is the strongest model available here without
 * introducing a keyed MAC - which would require a server secret this architecture does not
 * hold, and which the founder security model explicitly does not want surfaced to callers.
 */
const ISSUED_CAPABILITIES = new WeakSet();

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

const GRANT_FIELDS = Object.freeze([
  'schemaVersion',
  'grantId',
  'granteeId',
  'caseId',
  'operation',
  'purpose',
  'privacyAuthority',
  'issuedAt',
  'expiresAt',
  'auditEventRef',
  'revokedAt',
  'grantHash',
]);

/**
 * Copy a candidate grant into an inert, own-properties-only, plain-data record.
 *
 * Two attacks are closed here and neither is theoretical.
 *
 * PROTOTYPE POLLUTION. Every read below is `Object.hasOwn`-guarded, so a grant-shaped object
 * that carries no `revokedAt`/`schemaVersion`/`grantHash` of its own cannot inherit one from a
 * polluted `Object.prototype` and be validated on the strength of fields it does not have.
 *
 * ACCESSOR TIME-OF-CHECK/TIME-OF-USE. The previous implementation read the caller's object
 * repeatedly - once through `createAdministrativeGrant`, again through `canonicalize`, and
 * later again when the projection was assembled. A `caseId` defined as a getter (or a Proxy)
 * could return the grantee's own case to the binding check and a victim's case to the
 * projection afterwards. Every field is now read EXACTLY ONCE, here, and every later read is
 * from this frozen copy, so no value can change underneath a check that already passed.
 *
 * Unknown or non-enumerable own properties fail closed rather than being silently dropped,
 * which is what keeps the canonical-record comparison downstream honest.
 *
 * @param {unknown} grant
 * @returns {Record<string, unknown> | null} null when the shape is not a plain grant record.
 */
function snapshotGrant(grant) {
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)) return null;
  /** @type {Record<string, unknown>} */
  const snapshot = {};
  let owned = 0;
  for (const field of GRANT_FIELDS) {
    if (!Object.hasOwn(grant, field)) continue;
    snapshot[field] = grant[field];
    owned += 1;
  }
  // EXACT own-property shape, in both directions.
  //
  // Every field must be present as an OWN property (`owned === GRANT_FIELDS.length`). This is
  // not pedantry: the snapshot is itself an ordinary object inheriting from Object.prototype,
  // so had a field been allowed to stay absent, reading `snapshot.revokedAt` would fall through
  // to the very polluted prototype this function exists to defend against, and the snapshot
  // would launder the pollution instead of blocking it.
  //
  // And no field may be present that GRANT_FIELDS does not name. Object.keys sees own
  // ENUMERABLE keys only, so comparing its length against the hasOwn count rejects unexpected
  // extra fields and non-enumerable fields smuggled in via defineProperty alike.
  if (owned !== GRANT_FIELDS.length) return null;
  if (Object.keys(grant).length !== owned) return null;
  return snapshot;
}

/**
 * Validate a candidate grant and return the module's own canonical reconstruction of it.
 *
 * The returned object is built here, never handed in, so callers downstream of this function
 * are reading module-owned plain data rather than the caller's object.
 *
 * @param {unknown} grant
 * @returns {Readonly<Record<string, unknown>>}
 */
function canonicalGrant(grant) {
  const snapshot = snapshotGrant(grant);
  if (!snapshot || snapshot.schemaVersion !== GRANT_SCHEMA) {
    throw new DomainInvariantError('Unsupported administrative grant schema');
  }
  const reconstructed = createAdministrativeGrant(snapshot);
  if (
    snapshot.grantHash !== reconstructed.grantHash
    || canonicalize(snapshot) !== canonicalize(reconstructed)
  ) {
    throw new DomainInvariantError('Administrative grant is not the immutable canonical record');
  }
  return reconstructed;
}

export function validateAdministrativeGrant(grant) {
  canonicalGrant(grant);
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

const ACTIVATION_FIELDS = Object.freeze([
  'schemaVersion',
  'grantId',
  'grantHash',
  'revocationLedgerChecked',
  'revoked',
  'checkedAt',
  'activationHash',
]);

/**
 * Same own-properties-only snapshot discipline as `snapshotGrant`, for the activation proof.
 *
 * This one matters especially: the proof is read field by field and then re-hashed from its own
 * rest-spread. A rest spread copies only OWN enumerable properties, so an activation whose
 * `revoked: false` and `revocationLedgerChecked: true` came from a polluted `Object.prototype`
 * used to hash as the empty object - and an attacker who pollutes `activationHash` to match
 * `sha256(canonicalize({}))` would have cleared the hash check with an EMPTY proof object.
 * Own-property gating removes that entirely.
 */
function snapshotActivation(activation) {
  if (!activation || typeof activation !== 'object' || Array.isArray(activation)) return null;
  const snapshot = {};
  let owned = 0;
  for (const field of ACTIVATION_FIELDS) {
    if (!Object.hasOwn(activation, field)) continue;
    snapshot[field] = activation[field];
    owned += 1;
  }
  // Exact own-property shape, for the same two reasons as snapshotGrant: a missing field would
  // otherwise be read off a polluted prototype, and an extra one would slip past the re-hash.
  if (owned !== ACTIVATION_FIELDS.length) return null;
  if (Object.keys(activation).length !== owned) return null;
  return snapshot;
}

function assertActivationProof(activation, grant, nowMs, maxAgeMs) {
  const proof = snapshotActivation(activation);
  if (
    !proof
    || proof.schemaVersion !== ACTIVATION_SCHEMA
    || proof.grantId !== grant.grantId
    || proof.grantHash !== grant.grantHash
    || proof.revocationLedgerChecked !== true
    || proof.revoked !== false
  ) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOCATION_UNPROVEN');
  }
  const { activationHash, ...unsigned } = proof;
  if (activationHash !== hashGrant(unsigned)) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOCATION_UNPROVEN');
  }
  const checkedMs = Date.parse(String(proof.checkedAt ?? ''));
  if (!Number.isFinite(checkedMs) || checkedMs > nowMs || nowMs - checkedMs > maxAgeMs) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_REVOCATION_STALE');
  }
}

/**
 * Mint the in-process operational-metadata capability.
 *
 * MODULE-PRIVATE ON PURPOSE. This is the ONLY function that adds to `ISSUED_CAPABILITIES`, and
 * it is not exported, so the sole way to obtain a capability is to go through
 * `ImmutableAdministrativeGrantRepository.getActiveOperationalMetadataGrant` - which resolves
 * the grant from the append-only ledger, rejects a revoked or expired one, and mints the
 * activation proof itself. Exporting this, or calling it anywhere the grant did not come from a
 * ledger read, would reopen exactly the forgery boundary it exists to close.
 *
 * @param {{ grant: Readonly<Record<string, unknown>>, activation: Readonly<Record<string, unknown>> }} issued
 */
function issueOperationalMetadataCapability({ grant, activation }) {
  const capability = deepFreeze({
    schemaVersion: CAPABILITY_SCHEMA,
    // Denormalised binding fields, so an audit or log line never has to reach into `grant`.
    grantId: grant.grantId,
    granteeId: grant.granteeId,
    caseId: grant.caseId,
    operation: grant.operation,
    grant,
    activation,
  });
  ISSUED_CAPABILITIES.add(capability);
  return capability;
}

/**
 * True only for a capability this module issued from a ledger read. Exported so a composition
 * root can fail a request early, and so the boundary is assertable from outside.
 *
 * @param {unknown} capability
 */
export function isIssuedOperationalMetadataCapability(capability) {
  return Boolean(capability)
    && typeof capability === 'object'
    && ISSUED_CAPABILITIES.has(capability);
}

/**
 * Verifies a case-scoped operational-metadata capability. Every failure raises
 * AuthorizationDeniedError - there is no boolean return a caller could accidentally read the
 * wrong way round - and the HTTP layer collapses that error to an undifferentiated 404, so a
 * denial here cannot be used to probe whether a case exists.
 *
 * The capability must be one this module ISSUED. A caller-supplied object is refused before any
 * field of it is examined, so a request body can never argue its way to authority no matter how
 * well-formed it is. Every check after the identity gate is defence in depth against a bug on
 * the issuing path, not the primary defence.
 *
 * @param {{
 *   capability?: Record<string, unknown>,
 *   granteeId?: string,
 *   caseId?: string,
 *   purpose?: string,
 *   now?: Date | string | number,
 *   maxActivationAgeMs?: number,
 * }} [request]
 */
export function assertOperationalMetadataGrant({
  capability,
  granteeId,
  caseId,
  purpose,
  now = new Date(),
  maxActivationAgeMs = DEFAULT_ACTIVATION_MAX_AGE_MS,
} = {}) {
  // THE GATE. Identity first, before any property of the candidate is trusted or even read.
  if (!isIssuedOperationalMetadataCapability(capability)) {
    throw new AuthorizationDeniedError('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED');
  }
  const activation = capability.activation;
  let grant;
  try {
    grant = canonicalGrant(capability.grant);
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
   * THE SOLE ISSUING PATH for an operational-metadata capability.
   *
   * Resolves the live grant from the append-only ledger and proves the revocation ledger was
   * just consulted. Reaching the activation line means getActiveGrant already rejected a
   * revoked, expired, or mis-bound grant, which is why `revoked: false` can be asserted here
   * rather than guessed - and it is why this, and only this, is allowed to mint.
   *
   * The returned capability is unforgeable by identity: callers may pass it on to downstream
   * services, but they cannot construct, copy, or deserialise an equivalent one.
   *
   * @param {ActiveAdministrativeGrantRequest} [request]
   */
  async getActiveOperationalMetadataGrant({ grantId, granteeId, caseId, operation, purpose } = {}) {
    if (administrativeGrantOperationClass(operation) !== 'operational_metadata') {
      throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_OPERATION_CLASS_MISMATCH');
    }
    const grant = await this.getActiveGrant({ grantId, granteeId, caseId, operation, purpose });
    return issueOperationalMetadataCapability({
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
  capabilitySchema: CAPABILITY_SCHEMA,
  // A grant record is durable data authenticated by nothing but an UNKEYED hash. Saying so
  // plainly is the point: the hash is an integrity check across the persistence boundary, and
  // must never be mistaken for proof that a grant was ever issued.
  grantRecordProof: 'unkeyed_canonical_hash_integrity_only',
  // Authority rides on the capability, whose provenance is object identity and therefore cannot
  // be constructed, spread, or deserialised by a caller.
  capabilityProof: 'module_private_issued_capability_registry',
  capabilityIssuedBy: 'repository_get_active_operational_metadata_grant_only',
  capabilitySubmittableByCaller: false,
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
