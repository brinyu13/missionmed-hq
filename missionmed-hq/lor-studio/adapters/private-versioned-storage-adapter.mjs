import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { PrivateStoragePort } from '../services/ports.js';

const BUCKET_NAME = 'lor-writer-depot';
const STORAGE_CAPABILITY_SCHEMA = 'missionmed.lor.storage-capability.v1';
const PRIVATE_STORAGE_RECEIPT_SCHEMA = 'missionmed.lor.private-storage-receipt.v1';
const CONTENT_CLASSES = new Set([
  'student_prepared',
  'faculty_private',
  'released_final',
  'structural_waiver_material',
]);
const PURPOSES = new Set(['case_workflow', 'faculty_review', 'final_delivery', 'privacy_request', 'restore_rehearsal']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_CONTENT_TYPE = /^(?=.{3,160}$)[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:; ?[a-z0-9][a-z0-9!#$&^_.+-]*=[A-Za-z0-9][A-Za-z0-9!#$&^_.+:-]*)*$/u;
const HUMAN_ROLES = new Set(['student', 'faculty']);
const ADMINISTRATIVE_ROLES = new Set(['service', 'admin', 'founder']);
const PUT_FIELDS = new Set([
  'caseId',
  'checksum',
  'content',
  'contentClass',
  'contentType',
  'idempotencyKey',
  'objectId',
  'purpose',
]);
const GET_FIELDS = new Set(['caseId', 'contentClass', 'objectId', 'purpose', 'versionId']);
const VERIFIED_PRIVATE_STORAGE_ADAPTERS = new WeakSet();

/**
 * @typedef {object} PrivateVersionedStorageDriver
 * @property {boolean} [privateOnly]
 * @property {boolean} [immutableVersions]
 * @property {boolean} [serverOnly]
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} putImmutable
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} getImmutable
 */

/**
 * @typedef {object} StorageCapabilityProvider
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} resolveStorageCapability
 */

/**
 * @typedef {object} PrivateStorageAdapterOptions
 * @property {Record<string, unknown> | null} [binding]
 * @property {PrivateVersionedStorageDriver | null} [driver]
 * @property {StorageCapabilityProvider | null} [capabilityProvider]
 * @property {() => Date | string | number} [clock]
 */

function canonicalObjectKey(request) {
  return `cases/${encodeURIComponent(request.caseId)}/${request.contentClass}/${encodeURIComponent(request.objectId)}`;
}

function assertBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.bucket !== BUCKET_NAME
    || binding.private !== true
    || binding.versioned !== true
    || binding.serverMediated !== true
    || binding.policyVerified !== true
    || typeof binding.storageIdentity !== 'string'
    || binding.storageIdentity.trim() === ''
  ) {
    throw new IntegrationDisabledError('lor_private_storage', 'PRIVATE_BUCKET_BINDING_REQUIRED');
  }
  return deepFreeze({ bucket: BUCKET_NAME, storageIdentity: String(binding.storageIdentity || '') });
}

function assertDriver(driver) {
  if (
    !driver
    || driver.privateOnly !== true
    || driver.immutableVersions !== true
    || driver.serverOnly !== true
    || typeof driver.putImmutable !== 'function'
    || typeof driver.getImmutable !== 'function'
  ) {
    throw new IntegrationDisabledError('lor_private_storage', 'PRIVATE_VERSIONED_DRIVER_REQUIRED');
  }
  return driver;
}

function assertExactRequestKeys(request, allowed) {
  const unexpected = Object.keys(request).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new ValidationError('Private storage request contains forbidden fields', { fields: unexpected });
  }
}

function assertActiveWindow(record, nowMs, label) {
  const issuedAt = Date.parse(String(record?.issuedAt || ''));
  const expiresAt = Date.parse(String(record?.expiresAt || ''));
  if (
    !Number.isFinite(issuedAt)
    || !Number.isFinite(expiresAt)
    || issuedAt > nowMs
    || expiresAt <= nowMs
    || issuedAt >= expiresAt
    || record.revokedAt !== null
  ) {
    throw new AuthorizationDeniedError(`${label}_EXPIRED_REVOKED_OR_INVALID`);
  }
}

function assertFacultyInvitationProof(proof, capability, request, operation, nowMs) {
  if (
    !proof
    || proof.schemaVersion !== 'missionmed.lor.faculty-invitation-capability.v1'
    || proof.verified !== true
    || proof.invitationId !== capability.invitationId
    || proof.facultyId !== capability.actorId
    || proof.caseId !== request.caseId
    || proof.operation !== operation
    || proof.purpose !== request.purpose
  ) {
    throw new AuthorizationDeniedError('FACULTY_INVITATION_CAPABILITY_MISMATCH');
  }
  assertActiveWindow(proof, nowMs, 'FACULTY_INVITATION');
}

function assertAdministrativeGrantProof(grant, capability, request, operation, nowMs) {
  if (
    !grant
    || grant.schemaVersion !== 'missionmed.lor.administrative-grant-capability.v1'
    || grant.verified !== true
    || grant.grantId !== capability.administrativeGrantId
    || grant.granteeId !== capability.actorId
    || grant.caseId !== request.caseId
    || grant.operation !== operation
    || grant.purpose !== request.purpose
  ) {
    throw new AuthorizationDeniedError('ADMINISTRATIVE_GRANT_CAPABILITY_MISMATCH');
  }
  assertActiveWindow(grant, nowMs, 'ADMINISTRATIVE_GRANT');
}

// TRUST BOUNDARY - READ BEFORE IMPLEMENTING capabilityProvider.
//
// assertCapability below proves the capability is INTERNALLY CONSISTENT with the request:
// same caseId, same objectId, same objectKey, same operation, live time window, and for a
// student that capability.studentId === capability.actorId. Those checks are complete for
// what this layer can see.
//
// What this layer CANNOT see, and therefore CANNOT verify, is the join between the actor and
// the case: that the requesting actor is genuinely entitled to THIS caseId. A capability that
// is perfectly self-consistent but names a case the actor does not own will pass every check
// here. That join is delegated wholly to the injected capabilityProvider, which the
// `authoritySource === 'trusted_server_capability_provider'` check takes on trust.
//
// No capabilityProvider implementation exists yet, so nothing is currently exploitable - every
// route returns 503. But whoever writes it MUST enforce, server-side and against durable
// state, that the authenticated actor is authorised for request.caseId before returning
// authorized: true. Omitting that check yields cross-student access to private LOR artifacts
// with no second line of defence, because this adapter will not catch it.
function assertCapability(capability, request, operation, nowMs) {
  if (
    !capability
    || capability.schemaVersion !== STORAGE_CAPABILITY_SCHEMA
    || capability.authoritySource !== 'trusted_server_capability_provider'
    || capability.authorized !== true
    || capability.caseId !== request.caseId
    || capability.objectId !== request.objectId
    || capability.operation !== operation
    || capability.purpose !== request.purpose
    || capability.contentClass !== request.contentClass
    || capability.objectKey !== canonicalObjectKey(request)
    || (operation === 'get' && capability.versionId !== request.versionId)
  ) {
    throw new AuthorizationDeniedError('PRIVATE_STORAGE_CAPABILITY_INVALID');
  }
  assertNonEmptyString(capability.actorId, 'capability.actorId', { maxLength: 200 });
  assertNonEmptyString(capability.capabilityId, 'capability.capabilityId', { maxLength: 200 });
  assertNonEmptyString(capability.evidenceId, 'capability.evidenceId', { maxLength: 200 });
  assertNonEmptyString(capability.objectKey, 'capability.objectKey', { maxLength: 1_024 });
  if (!HUMAN_ROLES.has(capability.actorRole) && !ADMINISTRATIVE_ROLES.has(capability.actorRole)) {
    throw new AuthorizationDeniedError('PRIVATE_STORAGE_ROLE_INVALID');
  }
  assertActiveWindow(capability, nowMs, 'PRIVATE_STORAGE_CAPABILITY');
  if (capability.actorRole === 'student') {
    if (capability.studentId !== capability.actorId) {
      throw new AuthorizationDeniedError('STUDENT_CAPABILITY_SUBJECT_MISMATCH');
    }
    if (request.contentClass === 'faculty_private' || request.contentClass === 'structural_waiver_material') {
      throw new AuthorizationDeniedError('FACULTY_PRIVATE_OR_WAIVER_CONTENT_DENIED');
    }
    if (operation === 'put' && request.contentClass !== 'student_prepared') {
      throw new AuthorizationDeniedError('STUDENT_STORAGE_WRITE_DENIED');
    }
    if (request.contentClass === 'released_final' && capability.waiverState !== 'retained_and_released') {
      throw new AuthorizationDeniedError('FINAL_RELEASE_WAIVER_STATE_DENIED');
    }
  }
  if (capability.actorRole === 'faculty') {
    assertNonEmptyString(capability.invitationId, 'capability.invitationId', { maxLength: 200 });
    assertFacultyInvitationProof(capability.invitationProof, capability, request, operation, nowMs);
    if (operation === 'put' && !['faculty_private', 'released_final'].includes(request.contentClass)) {
      throw new AuthorizationDeniedError('FACULTY_STORAGE_WRITE_DENIED');
    }
  }
  if (ADMINISTRATIVE_ROLES.has(capability.actorRole)) {
    assertNonEmptyString(
      capability.administrativeGrantId,
      'capability.administrativeGrantId',
      { maxLength: 200 },
    );
    assertAdministrativeGrantProof(
      capability.administrativeGrant,
      capability,
      request,
      operation,
      nowMs,
    );
  }
  return deepFreeze({
    schemaVersion: STORAGE_CAPABILITY_SCHEMA,
    authoritySource: capability.authoritySource,
    authorized: true,
    actorId: capability.actorId,
    actorRole: capability.actorRole,
    capabilityId: capability.capabilityId,
    evidenceId: capability.evidenceId,
    caseId: request.caseId,
    objectId: request.objectId,
    objectKey: capability.objectKey,
    versionId: operation === 'get' ? capability.versionId : null,
    operation,
    purpose: request.purpose,
    contentClass: request.contentClass,
    invitationId: capability.invitationId || null,
    administrativeGrantId: capability.administrativeGrantId || null,
    waiverState: capability.waiverState || null,
    expiresAt: toIso(capability.expiresAt, 'capability.expiresAt'),
  });
}

function assertRequestBase(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new ValidationError('Private storage request must be an object');
  }
  assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
  assertNonEmptyString(request.objectId, 'objectId', { maxLength: 200 });
  if (!CONTENT_CLASSES.has(request.contentClass)) throw new ValidationError('Unknown storage contentClass');
  if (!PURPOSES.has(request.purpose)) throw new ValidationError('Unknown storage purpose');
}

function bytesFor(content) {
  if (Buffer.isBuffer(content)) return Buffer.from(content);
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (typeof content === 'string') return Buffer.from(content, 'utf8');
  throw new ValidationError('Private storage content must be bytes or a string');
}

function assertSafeContentType(value) {
  if (typeof value !== 'string' || !SAFE_CONTENT_TYPE.test(value)) {
    throw new ValidationError('Private storage contentType must be a safe canonical media type');
  }
  return value;
}

function assertNoPublicLocator(result) {
  if (
    'publicUrl' in (result || {})
    || 'signedUrl' in (result || {})
    || 'url' in (result || {})
  ) {
    throw new DomainInvariantError('Private storage drivers may not return object URLs');
  }
}

function safeReceipt({ operation, request, result, checksum, binding, capability }) {
  assertNoPublicLocator(result);
  if (
    !result
    || result.private !== true
    || result.versionImmutable !== true
    || result.policyChecked !== true
    || result.storageIdentity !== binding.storageIdentity
    || result.bucket !== binding.bucket
    || result.caseId !== request.caseId
    || result.objectId !== request.objectId
    || result.objectKey !== capability.objectKey
    || result.contentClass !== request.contentClass
    || result.purpose !== request.purpose
    || result.operation !== operation
    || result.capabilityId !== capability.capabilityId
    || result.evidenceId !== capability.evidenceId
    || typeof result.versionId !== 'string'
    || result.versionId.trim() === ''
    || (operation === 'get' && result.versionId !== request.versionId)
    || result.checksum !== checksum
    || typeof result.receiptId !== 'string'
    || result.receiptId.trim() === ''
  ) {
    throw new IntegrationDisabledError('lor_private_storage', 'VERSIONED_RECEIPT_INVALID');
  }
  return deepFreeze({
    schemaVersion: PRIVATE_STORAGE_RECEIPT_SCHEMA,
    operation: result.operation,
    bucket: result.bucket,
    storageIdentityRef: sha256(`lor-studio:storage-identity:${result.storageIdentity}`),
    caseRef: sha256(`lor-studio:case:${result.caseId}`),
    objectRef: sha256(`lor-studio:object:${result.objectId}`),
    objectKeyRef: sha256(`lor-studio:object-key:${result.objectKey}`),
    versionRef: sha256(`lor-studio:version:${result.versionId}`),
    receiptRef: sha256(`lor-studio:storage-receipt:${result.receiptId}`),
    capabilityRef: sha256(`lor-studio:storage-capability:${result.capabilityId}`),
    evidenceRef: sha256(`lor-studio:storage-evidence:${result.evidenceId}`),
    checksum: result.checksum,
    purpose: result.purpose,
    contentClass: result.contentClass,
    private: true,
    immutableVersion: true,
    policyChecked: true,
    occurredAt: toIso(result.occurredAt, 'occurredAt'),
  });
}

export class PrivateVersionedStorageAdapter extends PrivateStoragePort {
  /** @param {PrivateStorageAdapterOptions} [options] */
  constructor({ binding, driver, capabilityProvider, clock } = {}) {
    super();
    this.binding = assertBinding(binding);
    this.driver = assertDriver(driver);
    if (!capabilityProvider || typeof capabilityProvider.resolveStorageCapability !== 'function') {
      throw new IntegrationDisabledError('lor_private_storage', 'TRUSTED_CAPABILITY_PROVIDER_REQUIRED');
    }
    if (typeof clock !== 'function') {
      throw new IntegrationDisabledError('lor_private_storage', 'INJECTED_CLOCK_REQUIRED');
    }
    this.capabilityProvider = capabilityProvider;
    this.clock = clock;
    this.durability = 'DURABLE_PROVIDER_BOUND';
    VERIFIED_PRIVATE_STORAGE_ADAPTERS.add(this);
    Object.freeze(this);
  }

  async put(request) {
    assertRequestBase(request);
    assertExactRequestKeys(request, PUT_FIELDS);
    assertNonEmptyString(request.idempotencyKey, 'idempotencyKey', { maxLength: 200 });
    assertSafeContentType(request.contentType);
    const content = bytesFor(request.content);
    try {
      if (content.byteLength === 0) throw new ValidationError('Private storage content cannot be empty');
      const checksum = sha256(content);
      if (request.checksum !== checksum) throw new ValidationError('Private storage checksum mismatch');
      const capability = assertCapability(
        await this.capabilityProvider.resolveStorageCapability({
          caseId: request.caseId,
          objectId: request.objectId,
          contentClass: request.contentClass,
          purpose: request.purpose,
          operation: 'put',
        }),
        request,
        'put',
        new Date(toIso(this.clock(), 'clock')).valueOf(),
      );
      const result = await this.driver.putImmutable({
        binding: this.binding,
        capability,
        caseId: request.caseId,
        objectId: request.objectId,
        content,
        contentType: request.contentType,
        checksum,
        idempotencyKey: request.idempotencyKey,
      });
      return safeReceipt({
        operation: 'put',
        request,
        result,
        checksum,
        binding: this.binding,
        capability,
      });
    } finally {
      content.fill(0);
    }
  }

  async get(request) {
    assertRequestBase(request);
    assertExactRequestKeys(request, GET_FIELDS);
    assertNonEmptyString(request.versionId, 'versionId', { maxLength: 300 });
    const capability = assertCapability(
      await this.capabilityProvider.resolveStorageCapability({
        caseId: request.caseId,
        objectId: request.objectId,
        versionId: request.versionId,
        contentClass: request.contentClass,
        purpose: request.purpose,
        operation: 'get',
      }),
      request,
      'get',
      new Date(toIso(this.clock(), 'clock')).valueOf(),
    );
    const result = await this.driver.getImmutable({
      binding: this.binding,
      capability,
      caseId: request.caseId,
      objectId: request.objectId,
      versionId: request.versionId,
    });
    assertNoPublicLocator(result);
    const driverContent = result?.content;
    const content = bytesFor(driverContent);
    try {
      const contentType = assertSafeContentType(result?.contentType);
      const checksum = sha256(content);
      const receipt = safeReceipt({
        operation: 'get',
        request,
        result,
        checksum,
        binding: this.binding,
        capability,
      });
      return Object.freeze({ content: Buffer.from(content), contentType, receipt });
    } finally {
      content.fill(0);
      if (Buffer.isBuffer(driverContent) || driverContent instanceof Uint8Array) {
        driverContent.fill(0);
      }
    }
  }
}

/**
 * Only instances constructed through the validating adapter above may satisfy the
 * production application's concrete storage surface. A caller-supplied object with
 * no-op `put`/`get` methods and a durability string is deliberately insufficient.
 *
 * @param {unknown} value
 */
export function isVerifiedPrivateVersionedStorageAdapter(value) {
  return Boolean(value && typeof value === 'object' && VERIFIED_PRIVATE_STORAGE_ADAPTERS.has(value));
}

export const PRIVATE_VERSIONED_STORAGE_CONTRACT = deepFreeze({
  bucket: BUCKET_NAME,
  capabilitySchema: STORAGE_CAPABILITY_SCHEMA,
  receiptSchema: PRIVATE_STORAGE_RECEIPT_SCHEMA,
  access: 'private_server_mediated_only',
  callerSuppliedAuthority: 'rejected',
  versions: 'immutable_receipted',
  receiptBinding: 'storage_bucket_case_object_key_class_purpose_operation_capability_version_checksum',
  getCapabilityVersionBinding: 'exact_requested_version_id',
  studentFacultyPrivateAccess: 'denied',
  studentStructuralWaiverAccess: 'denied',
  storedContentTypeReadback: 'validated_canonical_media_type',
  httpDownloadContentType: 'application/octet-stream',
  plaintextOwnership: 'adapter_intermediates_and_response_owned_buffer_zeroed',
});
