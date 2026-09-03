import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import {
  canonicalize,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { readTrustedRequestContext } from '../security/trusted-request-context.mjs';
import { PrivateVersionedStorageAdapter } from './private-versioned-storage-adapter.mjs';

const CAPABILITY_SCHEMA = 'missionmed.lor.storage-capability.v1';
const ENCRYPTED_VERSION_SCHEMA = 'missionmed.lor.encrypted-private-artifact-version.v1';
const DATABASE_RECEIPT_SCHEMA = 'missionmed.lor.private-storage-database-receipt.v1';
const BUCKET = 'lor-writer-depot';
const ENCRYPTION_PROFILE = 'aes-256-gcm+hkdf-sha256.v1';
const SHA256 = /^[a-f0-9]{64}$/u;
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,299}$/u;
const KEY_VERSION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/u;
const SAFE_CONTENT_TYPE = /^(?=.{3,160}$)[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:; ?[a-z0-9][a-z0-9!#$&^_.+-]*=[A-Za-z0-9][A-Za-z0-9!#$&^_.+:-]*)*$/u;
const STORAGE_ENV_NAMES = Object.freeze([
  'MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64',
  'MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION',
  'MMHQ_LOR_PRIVATE_STORAGE_IDENTITY',
  'MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED',
  'MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED',
]);
const STORAGE_BINDING_KEYS = new Set([
  'bucket', 'private', 'versioned', 'serverMediated', 'policyVerified',
  'providerResourceBound', 'independentlyVerified', 'storageIdentity',
]);
const CONTENT_CLASSES = new Set([
  'student_prepared',
  'faculty_private',
  'released_final',
  'structural_waiver_material',
]);
const PURPOSES = new Set([
  'case_workflow',
  'faculty_review',
  'final_delivery',
  'privacy_request',
  'restore_rehearsal',
]);
const CAPABILITY_REQUEST_KEYS = new Set([
  'caseId', 'contentClass', 'objectId', 'operation', 'purpose', 'versionId',
]);
const PUT_COMMAND_KEYS = new Set([
  'actorId', 'actorRole', 'aadHash', 'authTagBase64', 'byteLength', 'capabilityId',
  'caseId', 'checksum', 'ciphertextBase64', 'contentClass', 'contentType', 'evidenceId',
  'hkdfSaltBase64', 'idempotencyKey', 'ivBase64', 'keyVersion', 'objectId', 'objectKey',
  'purpose', 'requestHash', 'storageIdentity',
]);
const GET_COMMAND_KEYS = new Set([
  'actorId', 'actorRole', 'capabilityId', 'caseId', 'contentClass', 'evidenceId',
  'objectId', 'objectKey', 'purpose', 'storageIdentity', 'versionId',
]);
const KEYS = new WeakMap();

function unavailable(status) {
  return new IntegrationDisabledError('lor_private_storage', status);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function exactSnapshot(value, expected, status = 'PRIVATE_STORAGE_INPUT_INVALID') {
  if (!plain(value)) throw unavailable(status);
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw unavailable(status);
  }
  if (
    ownKeys.length !== expected.size
    || ownKeys.some((key) => typeof key !== 'string' || !expected.has(key))
  ) throw unavailable(status);
  const snapshot = {};
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      throw unavailable(status);
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function boundedString(value, maximum = 512) {
  return typeof value === 'string' && value.length >= 1 && value.length <= maximum;
}

function safeContentType(value) {
  return typeof value === 'string' && SAFE_CONTENT_TYPE.test(value);
}

function snapshotStorageEnvironment(environment) {
  if (!environment || (typeof environment !== 'object' && typeof environment !== 'function')) {
    throw unavailable('DEDICATED_PRIVATE_STORAGE_ENVIRONMENT_REQUIRED');
  }
  const snapshot = Object.create(null);
  try {
    for (const name of STORAGE_ENV_NAMES) {
      const descriptor = Object.getOwnPropertyDescriptor(environment, name);
      if (descriptor === undefined) {
        snapshot[name] = '';
      } else if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') {
        throw new TypeError('unsafe environment descriptor');
      } else {
        snapshot[name] = descriptor.value;
      }
    }
  } catch {
    throw unavailable('DEDICATED_PRIVATE_STORAGE_ENVIRONMENT_REQUIRED');
  }
  return Object.freeze(snapshot);
}

function exactProof(value, status) {
  if (value !== 'true') throw unavailable(status);
  return true;
}

function canonicalObjectKey(request) {
  return `cases/${encodeURIComponent(request.caseId)}/${request.contentClass}/${encodeURIComponent(request.objectId)}`;
}

function strictBase64(value, expectedLength, status) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 80_000_000) {
    throw unavailable(status);
  }
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64');
  } catch {
    throw unavailable(status);
  }
  if (
    (expectedLength !== null && decoded.byteLength !== expectedLength)
    || decoded.toString('base64') !== value
  ) {
    decoded.fill(0);
    throw unavailable(status);
  }
  return decoded;
}

function storageAad({
  storageIdentity,
  caseId,
  objectId,
  objectKey,
  contentClass,
  purpose,
  contentType,
  checksum,
  idempotencyKey,
}) {
  return Buffer.from(canonicalize({
    schemaVersion: ENCRYPTED_VERSION_SCHEMA,
    storageIdentity,
    bucket: BUCKET,
    caseId,
    objectId,
    objectKey,
    contentClass,
    purpose,
    contentType,
    checksum,
    idempotencyKey,
  }), 'utf8');
}

function deriveVersionKey(kek, salt, keyVersion) {
  return Buffer.from(hkdfSync(
    'sha256',
    kek,
    salt,
    Buffer.from(`missionmed.lor.private-artifact:${keyVersion}:${ENCRYPTION_PROFILE}`, 'utf8'),
    32,
  ));
}

function assertBinding(binding) {
  if (
    !plain(binding)
    || binding.bucket !== BUCKET
    || !boundedString(binding.storageIdentity, 300)
  ) throw unavailable('PRIVATE_BUCKET_BINDING_REQUIRED');
  return binding;
}

function assertDatabaseReceipt(raw, operation, expected) {
  if (!plain(raw)) throw unavailable('ENCRYPTED_STORAGE_DATABASE_RECEIPT_INVALID');
  if (
    raw.schemaVersion !== DATABASE_RECEIPT_SCHEMA
    || raw.operation !== operation
    || raw.storageIdentity !== expected.storageIdentity
    || raw.bucket !== BUCKET
    || raw.caseId !== expected.caseId
    || raw.objectId !== expected.objectId
    || raw.objectKey !== expected.objectKey
    || raw.contentClass !== expected.contentClass
    || raw.purpose !== expected.purpose
    || raw.capabilityId !== expected.capabilityId
    || raw.evidenceId !== expected.evidenceId
    || !boundedString(raw.versionId, 300)
    || !SHA256.test(raw.checksum ?? '')
    || !safeContentType(raw.contentType)
    || (expected.contentType !== undefined && raw.contentType !== expected.contentType)
    || !boundedString(raw.receiptId, 300)
    || !Number.isFinite(Date.parse(raw.occurredAt ?? ''))
    || raw.private !== true
    || raw.versionImmutable !== true
    || raw.policyChecked !== true
  ) throw unavailable('ENCRYPTED_STORAGE_DATABASE_RECEIPT_INVALID');
  return raw;
}

function safeDriverResult(receipt, content = undefined) {
  const result = {
    operation: receipt.operation,
    storageIdentity: receipt.storageIdentity,
    bucket: receipt.bucket,
    caseId: receipt.caseId,
    objectId: receipt.objectId,
    objectKey: receipt.objectKey,
    versionId: receipt.versionId,
    contentClass: receipt.contentClass,
    purpose: receipt.purpose,
    contentType: receipt.contentType,
    checksum: receipt.checksum,
    capabilityId: receipt.capabilityId,
    evidenceId: receipt.evidenceId,
    receiptId: receipt.receiptId,
    occurredAt: receipt.occurredAt,
    private: true,
    versionImmutable: true,
    policyChecked: true,
  };
  if (content !== undefined) result.content = Buffer.from(content);
  return Object.freeze(result);
}

function capabilityWindow(clock) {
  const issuedAt = new Date(clock());
  if (!Number.isFinite(issuedAt.valueOf())) throw unavailable('PRIVATE_STORAGE_CLOCK_INVALID');
  return Object.freeze({
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.valueOf() + 60_000).toISOString(),
  });
}

function assertCapabilityRequest(rawRequest) {
  if (!plain(rawRequest)) throw unavailable('STORAGE_CAPABILITY_REQUEST_INVALID');
  const operation = rawRequest.operation;
  const expectedKeys = operation === 'put'
    ? new Set([...CAPABILITY_REQUEST_KEYS].filter((key) => key !== 'versionId'))
    : CAPABILITY_REQUEST_KEYS;
  const request = exactSnapshot(rawRequest, expectedKeys, 'STORAGE_CAPABILITY_REQUEST_INVALID');
  if (
    !IDENTIFIER.test(request.caseId ?? '')
    || !IDENTIFIER.test(request.objectId ?? '')
    || !CONTENT_CLASSES.has(request.contentClass)
    || !PURPOSES.has(request.purpose)
    || !['put', 'get'].includes(request.operation)
    || (request.operation === 'put' && request.versionId !== undefined)
    || (request.operation === 'get' && !IDENTIFIER.test(request.versionId ?? ''))
  ) throw new ValidationError('Private storage capability request is invalid');
  return request;
}

/**
 * Database-bound capability issuer. It accepts no actor from an HTTP body: the actor is read from
 * the request-local trusted context and is then independently joined to the case by BOTH the
 * durable actor resolver and the exact read/save scope provider.
 */
export class DatabaseBoundPrivateStorageCapabilityProvider {
  constructor({ actorResolver, scopeProvider, clock = () => new Date() } = {}) {
    if (!actorResolver || typeof actorResolver.resolve !== 'function') {
      throw unavailable('DATABASE_ACTOR_RESOLVER_REQUIRED');
    }
    if (typeof scopeProvider !== 'function') throw unavailable('DATABASE_SCOPE_PROVIDER_REQUIRED');
    if (typeof clock !== 'function') throw unavailable('PRIVATE_STORAGE_CLOCK_REQUIRED');
    this.actorResolver = actorResolver;
    this.scopeProvider = scopeProvider;
    this.clock = clock;
    Object.freeze(this);
  }

  async resolveStorageCapability(rawRequest) {
    const request = assertCapabilityRequest(rawRequest);
    let context;
    try {
      context = readTrustedRequestContext();
    } catch {
      throw unavailable('TRUSTED_REQUEST_CONTEXT_REQUIRED');
    }
    if (context.actorRole === 'mentor') {
      throw new AuthorizationDeniedError('MENTOR_PRIVATE_STORAGE_DENIED');
    }
    const access = await this.actorResolver.resolve({
      authenticatedSubject: context.authenticatedSubject,
      caseId: request.caseId,
    });
    if (
      access.actorId !== context.authenticatedSubject
      || access.actorRole !== context.actorRole
      || access.caseId !== request.caseId
      || !SUBJECT.test(access.resourceStudentId ?? '')
    ) throw new AuthorizationDeniedError('DATABASE_CASE_ACCESS_MISMATCH');
    const scope = await this.scopeProvider({
      caseId: request.caseId,
      operation: request.operation === 'put' ? 'save' : 'read',
      resourceStudentId: context.actorRole === 'student' ? context.authenticatedSubject : null,
    });
    if (
      scope.actorId !== context.authenticatedSubject
      || scope.actorRole !== context.actorRole
      || scope.caseId !== request.caseId
      || scope.resourceStudentId !== access.resourceStudentId
    ) throw new AuthorizationDeniedError('DATABASE_CASE_SCOPE_MISMATCH');

    if (context.actorRole === 'student') {
      if (
        ['faculty_private', 'structural_waiver_material'].includes(request.contentClass)
        || (request.operation === 'put' && request.contentClass !== 'student_prepared')
      ) throw new AuthorizationDeniedError('STUDENT_STORAGE_OPERATION_DENIED');
    }
    if (
      context.actorRole === 'faculty'
      && request.operation === 'put'
      && !['faculty_private', 'released_final'].includes(request.contentClass)
    ) throw new AuthorizationDeniedError('FACULTY_STORAGE_OPERATION_DENIED');

    const window = capabilityWindow(this.clock);
    const objectKey = canonicalObjectKey(request);
    const evidenceId = `evidence_${hashValue({
      schemaVersion: 'missionmed.lor.storage-capability-evidence.v1',
      access,
      scope,
      operation: request.operation,
      contentClass: request.contentClass,
      purpose: request.purpose,
      objectKey,
      versionId: request.versionId ?? null,
      issuedAt: window.issuedAt,
    })}`;
    const capabilityId = `capability_${hashValue({
      schemaVersion: CAPABILITY_SCHEMA,
      evidenceId,
      actorId: context.authenticatedSubject,
      caseId: request.caseId,
      objectId: request.objectId,
      operation: request.operation,
      expiresAt: window.expiresAt,
    })}`;
    const capability = {
      schemaVersion: CAPABILITY_SCHEMA,
      authoritySource: 'trusted_server_capability_provider',
      authorized: true,
      actorId: context.authenticatedSubject,
      actorRole: context.actorRole,
      studentId: context.actorRole === 'student' ? context.authenticatedSubject : null,
      capabilityId,
      evidenceId,
      caseId: request.caseId,
      objectId: request.objectId,
      objectKey,
      versionId: request.operation === 'get' ? request.versionId : null,
      operation: request.operation,
      purpose: request.purpose,
      contentClass: request.contentClass,
      invitationId: scope.invitationId ?? null,
      administrativeGrantId: null,
      waiverState: context.actorRole === 'student' && request.contentClass === 'released_final'
        ? 'retained_and_released' : null,
      issuedAt: window.issuedAt,
      expiresAt: window.expiresAt,
      revokedAt: null,
    };
    if (context.actorRole === 'faculty') {
      capability.invitationProof = {
        schemaVersion: 'missionmed.lor.faculty-invitation-capability.v1',
        verified: true,
        invitationId: scope.invitationId,
        facultyId: context.authenticatedSubject,
        caseId: request.caseId,
        operation: request.operation,
        purpose: request.purpose,
        issuedAt: window.issuedAt,
        expiresAt: window.expiresAt,
        revokedAt: null,
      };
    }
    return Object.freeze(capability);
  }
}

/** PostgreSQL command-backed AES-256-GCM immutable object driver. */
export class PostgresEncryptedPrivateStorageDriver {
  constructor({ databaseDriver, kek, keyVersion, randomBytesFn = randomBytes } = {}) {
    if (
      !databaseDriver
      || typeof databaseDriver.putEncryptedPrivateArtifactAtomic !== 'function'
      || typeof databaseDriver.getEncryptedPrivateArtifactAtomic !== 'function'
    ) throw unavailable('ENCRYPTED_STORAGE_DATABASE_DRIVER_REQUIRED');
    const key = Buffer.isBuffer(kek) ? Buffer.from(kek) : Buffer.from(kek ?? []);
    if (key.byteLength !== 32) {
      key.fill(0);
      throw unavailable('AES_256_GCM_KEK_REQUIRED');
    }
    if (!KEY_VERSION.test(keyVersion ?? '')) {
      key.fill(0);
      throw unavailable('ENCRYPTION_KEY_VERSION_REQUIRED');
    }
    if (typeof randomBytesFn !== 'function') {
      key.fill(0);
      throw unavailable('CRYPTOGRAPHIC_RANDOM_SOURCE_REQUIRED');
    }
    this.databaseDriver = databaseDriver;
    this.keyVersion = keyVersion;
    this.randomBytesFn = randomBytesFn;
    this.privateOnly = true;
    this.immutableVersions = true;
    this.serverOnly = true;
    KEYS.set(this, key);
    Object.freeze(this);
  }

  async putImmutable(raw) {
    const binding = assertBinding(raw?.binding);
    const capability = raw?.capability;
    const content = Buffer.from(raw?.content ?? []);
    try {
      if (
        !capability
        || !SUBJECT.test(capability.actorId ?? '')
        || !['student', 'faculty'].includes(capability.actorRole)
        || raw.caseId !== capability.caseId
        || raw.objectId !== capability.objectId
        || !SHA256.test(raw.checksum ?? '')
        || sha256(content) !== raw.checksum
        || !safeContentType(raw.contentType)
        || !boundedString(raw.idempotencyKey, 200)
      ) throw unavailable('ENCRYPTED_STORAGE_PUT_INVALID');
      const salt = Buffer.from(this.randomBytesFn(32));
      const iv = Buffer.from(this.randomBytesFn(12));
      let aad = null;
      let ciphertext = null;
      let authTag = null;
      if (salt.byteLength !== 32 || iv.byteLength !== 12) {
        salt.fill(0);
        iv.fill(0);
        throw unavailable('CRYPTOGRAPHIC_RANDOM_SOURCE_INVALID');
      }
      try {
        aad = storageAad({
          storageIdentity: binding.storageIdentity,
          caseId: raw.caseId,
          objectId: raw.objectId,
          objectKey: capability.objectKey,
          contentClass: capability.contentClass,
          purpose: capability.purpose,
          contentType: raw.contentType,
          checksum: raw.checksum,
          idempotencyKey: raw.idempotencyKey,
        });
        const versionKey = deriveVersionKey(KEYS.get(this), salt, this.keyVersion);
        try {
          const cipher = createCipheriv('aes-256-gcm', versionKey, iv, { authTagLength: 16 });
          cipher.setAAD(aad, { plaintextLength: content.byteLength });
          ciphertext = Buffer.concat([cipher.update(content), cipher.final()]);
          authTag = cipher.getAuthTag();
        } finally {
          versionKey.fill(0);
        }
        const requestHash = hashValue({
          schemaVersion: ENCRYPTED_VERSION_SCHEMA,
          storageIdentity: binding.storageIdentity,
          caseId: raw.caseId,
          objectId: raw.objectId,
          objectKey: capability.objectKey,
          contentClass: capability.contentClass,
          purpose: capability.purpose,
          contentType: raw.contentType,
          checksum: raw.checksum,
          byteLength: content.byteLength,
          idempotencyKey: raw.idempotencyKey,
          keyVersion: this.keyVersion,
          aadHash: sha256(aad),
        });
        const command = exactSnapshot({
          actorId: capability.actorId,
          actorRole: capability.actorRole,
          aadHash: sha256(aad),
          authTagBase64: authTag.toString('base64'),
          byteLength: content.byteLength,
          capabilityId: capability.capabilityId,
          caseId: raw.caseId,
          checksum: raw.checksum,
          ciphertextBase64: ciphertext.toString('base64'),
          contentClass: capability.contentClass,
          contentType: raw.contentType,
          evidenceId: capability.evidenceId,
          hkdfSaltBase64: salt.toString('base64'),
          idempotencyKey: raw.idempotencyKey,
          ivBase64: iv.toString('base64'),
          keyVersion: this.keyVersion,
          objectId: raw.objectId,
          objectKey: capability.objectKey,
          purpose: capability.purpose,
          requestHash,
          storageIdentity: binding.storageIdentity,
        }, PUT_COMMAND_KEYS);
        const receipt = assertDatabaseReceipt(
          await this.databaseDriver.putEncryptedPrivateArtifactAtomic(command),
          'put',
          { ...command, bucket: BUCKET },
        );
        if (receipt.checksum !== raw.checksum) {
          throw unavailable('ENCRYPTED_STORAGE_DATABASE_RECEIPT_INVALID');
        }
        return safeDriverResult(receipt);
      } finally {
        salt.fill(0);
        iv.fill(0);
        authTag?.fill(0);
        ciphertext?.fill(0);
        aad?.fill(0);
      }
    } finally {
      content.fill(0);
    }
  }

  async getImmutable(raw) {
    const binding = assertBinding(raw?.binding);
    const capability = raw?.capability;
    if (
      !capability
      || !SUBJECT.test(capability.actorId ?? '')
      || !['student', 'faculty'].includes(capability.actorRole)
      || raw.caseId !== capability.caseId
      || raw.objectId !== capability.objectId
      || raw.versionId !== capability.versionId
    ) throw unavailable('ENCRYPTED_STORAGE_GET_INVALID');
    const command = exactSnapshot({
      actorId: capability.actorId,
      actorRole: capability.actorRole,
      capabilityId: capability.capabilityId,
      caseId: raw.caseId,
      contentClass: capability.contentClass,
      evidenceId: capability.evidenceId,
      objectId: raw.objectId,
      objectKey: capability.objectKey,
      purpose: capability.purpose,
      storageIdentity: binding.storageIdentity,
      versionId: raw.versionId,
    }, GET_COMMAND_KEYS);
    const receipt = assertDatabaseReceipt(
      await this.databaseDriver.getEncryptedPrivateArtifactAtomic(command),
      'get',
      command,
    );
    if (
      receipt.versionId !== raw.versionId
      || receipt.keyVersion !== this.keyVersion
      || !boundedString(receipt.contentType, 160)
      || !boundedString(receipt.idempotencyKey, 200)
      || !SHA256.test(receipt.aadHash ?? '')
    ) throw unavailable('ENCRYPTED_STORAGE_DATABASE_RECEIPT_INVALID');
    const salt = strictBase64(receipt.hkdfSaltBase64, 32, 'ENCRYPTED_STORAGE_CIPHERTEXT_INVALID');
    const iv = strictBase64(receipt.ivBase64, 12, 'ENCRYPTED_STORAGE_CIPHERTEXT_INVALID');
    const authTag = strictBase64(receipt.authTagBase64, 16, 'ENCRYPTED_STORAGE_CIPHERTEXT_INVALID');
    const ciphertext = strictBase64(
      receipt.ciphertextBase64,
      Number.isSafeInteger(receipt.byteLength) ? receipt.byteLength : null,
      'ENCRYPTED_STORAGE_CIPHERTEXT_INVALID',
    );
    const aad = storageAad({
      storageIdentity: binding.storageIdentity,
      caseId: receipt.caseId,
      objectId: receipt.objectId,
      objectKey: receipt.objectKey,
      contentClass: receipt.contentClass,
      purpose: receipt.purpose,
      contentType: receipt.contentType,
      checksum: receipt.checksum,
      idempotencyKey: receipt.idempotencyKey,
    });
    const observedAadHash = Buffer.from(sha256(aad), 'hex');
    const expectedAadHash = Buffer.from(receipt.aadHash, 'hex');
    if (
      observedAadHash.byteLength !== expectedAadHash.byteLength
      || !timingSafeEqual(observedAadHash, expectedAadHash)
    ) throw new DomainInvariantError('Private storage authenticated metadata was modified');
    const versionKey = deriveVersionKey(KEYS.get(this), salt, this.keyVersion);
    let content;
    try {
      const decipher = createDecipheriv('aes-256-gcm', versionKey, iv, { authTagLength: 16 });
      decipher.setAAD(aad, { plaintextLength: ciphertext.byteLength });
      decipher.setAuthTag(authTag);
      content = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new DomainInvariantError('Private storage ciphertext authentication failed');
    } finally {
      versionKey.fill(0);
      salt.fill(0);
      iv.fill(0);
      authTag.fill(0);
      ciphertext.fill(0);
      aad.fill(0);
      observedAadHash.fill(0);
      expectedAadHash.fill(0);
    }
    if (sha256(content) !== receipt.checksum || content.byteLength !== receipt.byteLength) {
      content.fill(0);
      throw new DomainInvariantError('Private storage plaintext integrity check failed');
    }
    try {
      return safeDriverResult(receipt, content);
    } finally {
      content.fill(0);
    }
  }
}

export function decodePrivateStorageKekBase64(value) {
  return strictBase64(value, 32, 'AES_256_GCM_KEK_REQUIRED');
}

export function createPostgresEncryptedPrivateStorageAdapter({
  binding,
  databaseDriver,
  actorResolver,
  scopeProvider,
  kek,
  keyVersion,
  clock = () => new Date(),
  randomBytesFn = randomBytes,
} = {}) {
  const driver = new PostgresEncryptedPrivateStorageDriver({
    databaseDriver,
    kek,
    keyVersion,
    randomBytesFn,
  });
  const capabilityProvider = new DatabaseBoundPrivateStorageCapabilityProvider({
    actorResolver,
    scopeProvider,
    clock,
  });
  return new PrivateVersionedStorageAdapter({ binding, driver, capabilityProvider, clock });
}

/**
 * Creates the production storage surface from six dedicated, data-descriptor-only environment
 * bindings. The KEK is decoded into a short-lived buffer, copied directly into the driver's
 * private WeakMap, and zeroed before this function returns. No generic database/provider secret
 * or asserted default is accepted as a substitute for these exact bindings.
 */
export function createPostgresEncryptedPrivateStorageAdapterFromEnvironment({
  binding = undefined,
  databaseDriver,
  actorResolver,
  scopeProvider,
  environment = process.env,
  clock = () => new Date(),
  randomBytesFn = randomBytes,
} = {}) {
  const env = snapshotStorageEnvironment(environment);
  exactProof(
    env.MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND,
    'PRIVATE_STORAGE_PROVIDER_RESOURCE_PROOF_REQUIRED',
  );
  exactProof(
    env.MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED,
    'PRIVATE_STORAGE_POLICY_PROOF_REQUIRED',
  );
  exactProof(
    env.MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED,
    'PRIVATE_STORAGE_INDEPENDENT_VERIFICATION_REQUIRED',
  );
  const storageIdentity = env.MMHQ_LOR_PRIVATE_STORAGE_IDENTITY;
  const keyVersion = env.MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION;
  if (!IDENTIFIER.test(storageIdentity ?? '')) {
    throw unavailable('PRIVATE_STORAGE_IDENTITY_REQUIRED');
  }
  if (!KEY_VERSION.test(keyVersion ?? '')) {
    throw unavailable('ENCRYPTION_KEY_VERSION_REQUIRED');
  }
  const resolvedBinding = Object.freeze({
    bucket: BUCKET,
    private: true,
    versioned: true,
    serverMediated: true,
    policyVerified: true,
    providerResourceBound: true,
    independentlyVerified: true,
    storageIdentity,
  });
  if (binding !== undefined) {
    const suppliedBinding = exactSnapshot(
      binding,
      STORAGE_BINDING_KEYS,
      'PRIVATE_BUCKET_BINDING_REQUIRED',
    );
    for (const [key, expected] of Object.entries(resolvedBinding)) {
      if (suppliedBinding[key] !== expected) throw unavailable('PRIVATE_BUCKET_BINDING_REQUIRED');
    }
  }
  const kek = decodePrivateStorageKekBase64(env.MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64);
  try {
    return createPostgresEncryptedPrivateStorageAdapter({
      binding: resolvedBinding,
      databaseDriver,
      actorResolver,
      scopeProvider,
      kek,
      keyVersion,
      clock,
      randomBytesFn,
    });
  } finally {
    kek.fill(0);
  }
}

export const POSTGRES_ENCRYPTED_PRIVATE_STORAGE_CONTRACT = Object.freeze({
  schemaVersion: ENCRYPTED_VERSION_SCHEMA,
  databaseReceiptSchema: DATABASE_RECEIPT_SCHEMA,
  bucket: BUCKET,
  encryptionProfile: ENCRYPTION_PROFILE,
  encryption: 'application_aes_256_gcm_per_version_hkdf_sha256',
  databaseContent: 'ciphertext_only',
  authorization: 'trusted_request_context_plus_database_actor_case_scope',
  immutable: true,
  idempotency: 'database_serialized_exact_request_replay',
  plaintextLogs: false,
  environmentBindings: STORAGE_ENV_NAMES,
});
