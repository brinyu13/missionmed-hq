import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

import {
  IntegrationDisabledError,
  InvitationDeniedError,
} from '../domain/errors.js';
import { deepFreeze, sha256 } from '../domain/value-utils.js';
import {
  FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
  createFacultyCandidateCredentialContext,
} from '../security/faculty-candidate-credential-context.mjs';
import { assertValidatedLorTargetBinding } from '../adapters/lor-target-binding.mjs';

const INTEGRATION = 'lor_faculty_candidate_auth';
const HANDOFF_SCHEMA = 'missionmed.lor.faculty-candidate-auth-handoff.v1';
const HANDOFF_METADATA_SCHEMA =
  'missionmed.lor.faculty-candidate-auth-handoff-metadata.v1';
const SEALED_PAYLOAD_SCHEMA = 'missionmed.lor.faculty-candidate-auth-sealed-payload.v1';
const RESERVATION_RECEIPT_SCHEMA =
  'missionmed.lor.faculty-candidate-auth-reservation-receipt.v1';
const REDEMPTION_RECEIPT_SCHEMA =
  'missionmed.lor.faculty-candidate-auth-redemption-receipt.v1';
const INVITATION_SECRET_BINDING_SCHEMA =
  'missionmed.lor.faculty-invitation-secret-binding.v1';
const HANDOFF_PREFIX = 'lorch1';
const AUTHORITY_SOURCE = 'server_verified_invitation_token_exchange';
const CREDENTIAL_AUTHORITY_SOURCE = 'server_verified_sealed_candidate_cookie';
const KEY_PURPOSE = 'lor_faculty_invitation_hmac';
const KEY_DERIVATION_INFO = Buffer.from(
  'missionmed.lor.faculty-candidate-auth.aes-256-gcm.v1',
  'utf8',
);
const DEFAULT_LIFETIME_SECONDS = 10 * 60;
const MAXIMUM_LIFETIME_SECONDS = 15 * 60;
const MINIMUM_LIFETIME_SECONDS = 60;
const CLOCK_SKEW_MS = 30 * 1_000;
const FLOW_NONCE_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const MAXIMUM_CIPHERTEXT_BYTES = 2_048;
const LOCATOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const RAW_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const SUBJECT = /^wp:[1-9][0-9]*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TRANSACTION_ID = /^(?:0|[1-9][0-9]{0,39})$/u;
const SEALED_HANDOFF =
  /^lorch1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{16,3700}\.[A-Za-z0-9_-]{22}$/u;
const OPTION_KEYS = new Set([
  'binding',
  'clock',
  'driver',
  'ivFactory',
  'keyProvider',
  'maximumLifetimeSeconds',
  'nonceFactory',
  'secretBinding',
]);
const EXCHANGE_KEYS = new Set(['invitationId', 'rawToken']);
const REDEEM_KEYS = new Set([
  'authenticatedSubject',
  'invitationId',
  'sealedHandoff',
]);
const INSPECT_KEYS = new Set(['sealedHandoff']);
const SECRET_BINDING_KEYS = new Set([
  'schemaVersion',
  'providerResourceBound',
  'independentlyVerified',
  'serverSideSecret',
  'keyVersion',
]);
const SEALED_PAYLOAD_KEYS = new Set([
  'schemaVersion',
  'authoritySource',
  'invitationId',
  'caseId',
  'requiresOtpVerification',
  'tokenHash',
  'flowNonceHash',
  'issuedAt',
  'expiresAt',
  'keyVersion',
  'singlePurpose',
  'clientAsserted',
]);
const RESERVATION_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'action',
  'reserved',
  'replayed',
  'invitationId',
  'caseId',
  'requiresOtpVerification',
  'tokenHash',
  'flowNonceHash',
  'issuedAt',
  'expiresAt',
  'transactionId',
]);
const REDEMPTION_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'action',
  'redeemed',
  'replayed',
  'invitationId',
  'caseId',
  'requiresOtpVerification',
  'tokenHash',
  'flowNonceHash',
  'authenticatedSubject',
  'issuedAt',
  'expiresAt',
  'transactionId',
]);
const AUTHENTIC_SERVICES = new WeakSet();

function unavailable(status) {
  return new IntegrationDisabledError(INTEGRATION, status);
}

function denied() {
  return new InvitationDeniedError();
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return [Object.prototype, null].includes(Object.getPrototypeOf(value));
  } catch {
    return false;
  }
}

function exactSnapshot(value, expectedKeys, onInvalid) {
  if (!plain(value)) throw onInvalid();
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw onInvalid();
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) throw onInvalid();
  const snapshot = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, 'value')
    ) throw onInvalid();
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function optionSnapshot(value) {
  if (!plain(value)) throw unavailable('OPTIONS_INVALID');
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw unavailable('OPTIONS_INVALID');
  }
  if (keys.some((key) => typeof key !== 'string' || !OPTION_KEYS.has(key))) {
    throw unavailable('OPTIONS_INVALID');
  }
  const snapshot = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string') throw unavailable('OPTIONS_INVALID');
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw unavailable('OPTIONS_INVALID');
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function validateSecretBinding(rawBinding) {
  const binding = exactSnapshot(
    rawBinding,
    SECRET_BINDING_KEYS,
    () => unavailable('VERIFIED_SECRET_BINDING_REQUIRED'),
  );
  if (
    binding.schemaVersion !== INVITATION_SECRET_BINDING_SCHEMA
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.serverSideSecret !== true
    || typeof binding.keyVersion !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/u.test(binding.keyVersion)
  ) throw unavailable('VERIFIED_SECRET_BINDING_REQUIRED');
  return binding;
}

function validateDriver(driver) {
  if (
    !driver
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || driver.databaseClock !== true
    || driver.atomicFacultyCandidateHandoffs !== true
    || typeof driver.reserveFacultyCandidateAuthHandoffAtomic !== 'function'
    || typeof driver.redeemFacultyCandidateAuthHandoffAtomic !== 'function'
  ) throw unavailable('ATOMIC_DURABLE_CANDIDATE_HANDOFF_DRIVER_REQUIRED');
  return driver;
}

function validateKeyProvider(keyProvider) {
  if (
    !keyProvider
    || keyProvider.serverOnly !== true
    || typeof keyProvider.getKey !== 'function'
  ) throw unavailable('SERVER_ONLY_HANDOFF_KEY_PROVIDER_REQUIRED');
  return keyProvider;
}

function canonicalInstant(value, status) {
  if (typeof value !== 'string') throw unavailable(status);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw unavailable(status);
  }
  return timestamp;
}

function currentTime(clock) {
  let value;
  try {
    value = clock();
  } catch {
    throw unavailable('CLOCK_UNAVAILABLE');
  }
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) throw unavailable('CLOCK_UNAVAILABLE');
  return timestamp;
}

function canonicalRawToken(value) {
  if (typeof value !== 'string' || !RAW_TOKEN.test(value)) throw denied();
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64url');
    if (decoded.byteLength !== 32 || decoded.toString('base64url') !== value) throw denied();
    return value;
  } catch {
    throw denied();
  } finally {
    decoded?.fill(0);
  }
}

function randomBuffer(factory, byteLength, status) {
  let value;
  try {
    value = factory(byteLength);
  } catch {
    throw unavailable(status);
  }
  if (!Buffer.isBuffer(value) || value.byteLength !== byteLength) {
    throw unavailable(status);
  }
  return Buffer.from(value);
}

function base64UrlDecode(value, byteLength = null) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(value)) throw denied();
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64url');
  } catch {
    throw denied();
  }
  if (
    decoded.toString('base64url') !== value
    || (byteLength !== null && decoded.byteLength !== byteLength)
  ) throw denied();
  return decoded;
}

function aad(keyVersion) {
  return Buffer.from(`${HANDOFF_PREFIX}\n${SEALED_PAYLOAD_SCHEMA}\n${keyVersion}`, 'utf8');
}

function validateReservationReceipt(rawReceipt, expected, now, lifetimeSeconds) {
  const receipt = exactSnapshot(
    rawReceipt,
    RESERVATION_RECEIPT_KEYS,
    () => unavailable('CANDIDATE_HANDOFF_RESERVATION_RECEIPT_INVALID'),
  );
  const issuedAt = canonicalInstant(
    receipt.issuedAt,
    'CANDIDATE_HANDOFF_RESERVATION_RECEIPT_INVALID',
  );
  const expiresAt = canonicalInstant(
    receipt.expiresAt,
    'CANDIDATE_HANDOFF_RESERVATION_RECEIPT_INVALID',
  );
  if (
    receipt.schemaVersion !== RESERVATION_RECEIPT_SCHEMA
    || receipt.action !== 'faculty.candidate_handoff.reserve'
    || receipt.reserved !== true
    || receipt.replayed !== false
    || receipt.invitationId !== expected.invitationId
    || !LOCATOR.test(receipt.caseId ?? '')
    || typeof receipt.requiresOtpVerification !== 'boolean'
    || receipt.tokenHash !== expected.tokenHash
    || receipt.flowNonceHash !== expected.flowNonceHash
    || !TRANSACTION_ID.test(receipt.transactionId ?? '')
    || issuedAt > now + CLOCK_SKEW_MS
    || expiresAt <= now
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > lifetimeSeconds * 1_000
  ) throw unavailable('CANDIDATE_HANDOFF_RESERVATION_RECEIPT_INVALID');
  return receipt;
}

function validateRedemptionReceipt(rawReceipt, expected) {
  const receipt = exactSnapshot(
    rawReceipt,
    REDEMPTION_RECEIPT_KEYS,
    () => unavailable('CANDIDATE_HANDOFF_REDEMPTION_RECEIPT_INVALID'),
  );
  if (
    receipt.schemaVersion !== REDEMPTION_RECEIPT_SCHEMA
    || receipt.action !== 'faculty.candidate_handoff.redeem'
    || receipt.redeemed !== true
    || receipt.replayed !== false
    || receipt.invitationId !== expected.invitationId
    || receipt.caseId !== expected.caseId
    || receipt.requiresOtpVerification !== expected.requiresOtpVerification
    || receipt.tokenHash !== expected.tokenHash
    || receipt.flowNonceHash !== expected.flowNonceHash
    || receipt.authenticatedSubject !== expected.authenticatedSubject
    || receipt.issuedAt !== expected.issuedAt
    || receipt.expiresAt !== expected.expiresAt
    || !TRANSACTION_ID.test(receipt.transactionId ?? '')
  ) throw unavailable('CANDIDATE_HANDOFF_REDEMPTION_RECEIPT_INVALID');
  return receipt;
}

function validateSealedPayload(rawPayload, expected, now, lifetimeSeconds) {
  let payload;
  try {
    payload = exactSnapshot(rawPayload, SEALED_PAYLOAD_KEYS, denied);
  } catch {
    throw denied();
  }
  let issuedAt;
  let expiresAt;
  try {
    issuedAt = canonicalInstant(payload.issuedAt, 'SEALED_HANDOFF_INVALID');
    expiresAt = canonicalInstant(payload.expiresAt, 'SEALED_HANDOFF_INVALID');
  } catch {
    throw denied();
  }
  if (
    payload.schemaVersion !== SEALED_PAYLOAD_SCHEMA
    || payload.authoritySource !== AUTHORITY_SOURCE
    || !LOCATOR.test(payload.invitationId ?? '')
    || !LOCATOR.test(payload.caseId ?? '')
    || typeof payload.requiresOtpVerification !== 'boolean'
    || (expected.invitationId !== null && payload.invitationId !== expected.invitationId)
    || !SHA256.test(payload.tokenHash ?? '')
    || !SHA256.test(payload.flowNonceHash ?? '')
    || payload.keyVersion !== expected.keyVersion
    || payload.singlePurpose !== true
    || payload.clientAsserted !== false
    || issuedAt > now + CLOCK_SKEW_MS
    || expiresAt <= now
    || expiresAt <= issuedAt
    || expiresAt - issuedAt > lifetimeSeconds * 1_000
  ) throw denied();
  return payload;
}

/**
 * Durable, opaque faculty-candidate bootstrap.
 *
 * Raw invitation tokens cross only this method boundary, are immediately hashed, and are never
 * passed to PostgreSQL, returned, logged, or sealed. PostgreSQL owns active-invitation validation,
 * the handoff window, and atomic one-time redemption. AES-GCM protects only the hash-bound handoff
 * state which the authenticated WordPress callback later presents for database consumption.
 */
export class DurableFacultyCandidateAuthService {
  #binding;

  #clock;

  #driver;

  #ivFactory;

  #keyProvider;

  #lifetimeSeconds;

  #nonceFactory;

  #secretBinding;

  constructor(rawOptions = {}) {
    const options = optionSnapshot(rawOptions);
    this.#binding = assertValidatedLorTargetBinding(options.binding, INTEGRATION);
    this.#driver = validateDriver(options.driver);
    this.#secretBinding = validateSecretBinding(options.secretBinding);
    this.#keyProvider = validateKeyProvider(options.keyProvider);
    this.#clock = options.clock ?? (() => new Date());
    this.#nonceFactory = options.nonceFactory ?? ((length) => randomBytes(length));
    this.#ivFactory = options.ivFactory ?? ((length) => randomBytes(length));
    if (
      typeof this.#clock !== 'function'
      || typeof this.#nonceFactory !== 'function'
      || typeof this.#ivFactory !== 'function'
    ) throw unavailable('OPTIONS_INVALID');
    this.#lifetimeSeconds = options.maximumLifetimeSeconds ?? DEFAULT_LIFETIME_SECONDS;
    if (
      !Number.isSafeInteger(this.#lifetimeSeconds)
      || this.#lifetimeSeconds < MINIMUM_LIFETIME_SECONDS
      || this.#lifetimeSeconds > MAXIMUM_LIFETIME_SECONDS
    ) throw unavailable('HANDOFF_LIFETIME_INVALID');
    Object.freeze(this);
    AUTHENTIC_SERVICES.add(this);
  }

  async #deriveEncryptionKey() {
    let provided;
    try {
      provided = await this.#keyProvider.getKey({
        keyVersion: this.#secretBinding.keyVersion,
        purpose: KEY_PURPOSE,
      });
    } catch {
      throw unavailable('HANDOFF_KEY_UNAVAILABLE');
    }
    if (!Buffer.isBuffer(provided) || provided.byteLength < 32 || provided.byteLength > 256) {
      throw unavailable('HANDOFF_KEY_UNAVAILABLE');
    }
    const inputKey = Buffer.from(provided);
    try {
      return Buffer.from(hkdfSync(
        'sha256',
        inputKey,
        Buffer.from(
          `missionmed.lor.faculty-candidate-auth.salt.v1:${this.#secretBinding.keyVersion}`,
          'utf8',
        ),
        KEY_DERIVATION_INFO,
        32,
      ));
    } catch {
      throw unavailable('HANDOFF_KEY_DERIVATION_FAILED');
    } finally {
      inputKey.fill(0);
      provided.fill(0);
    }
  }

  async #readSealedPayload(sealedHandoff, expectedInvitationId = null) {
    if (typeof sealedHandoff !== 'string' || !SEALED_HANDOFF.test(sealedHandoff)) {
      throw denied();
    }
    const parts = sealedHandoff.split('.');
    const iv = base64UrlDecode(parts[1], AES_GCM_IV_BYTES);
    const ciphertext = base64UrlDecode(parts[2]);
    const tag = base64UrlDecode(parts[3], AES_GCM_TAG_BYTES);
    if (ciphertext.byteLength < 1 || ciphertext.byteLength > MAXIMUM_CIPHERTEXT_BYTES) {
      iv.fill(0);
      ciphertext.fill(0);
      tag.fill(0);
      throw denied();
    }
    let key;
    try {
      key = await this.#deriveEncryptionKey();
    } catch (error) {
      iv.fill(0);
      ciphertext.fill(0);
      tag.fill(0);
      throw error;
    }
    let payload;
    try {
      let plaintext;
      try {
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(aad(this.#secretBinding.keyVersion), {
          plaintextLength: ciphertext.byteLength,
        });
        decipher.setAuthTag(tag);
        plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        payload = JSON.parse(plaintext.toString('utf8'));
      } catch {
        throw denied();
      } finally {
        plaintext?.fill(0);
      }
    } finally {
      key.fill(0);
      iv.fill(0);
      ciphertext.fill(0);
      tag.fill(0);
    }
    return validateSealedPayload(
      payload,
      {
        invitationId: expectedInvitationId,
        keyVersion: this.#secretBinding.keyVersion,
      },
      currentTime(this.#clock),
      this.#lifetimeSeconds,
    );
  }

  async inspectSealedHandoff(rawInput) {
    const input = exactSnapshot(rawInput, INSPECT_KEYS, denied);
    const payload = await this.#readSealedPayload(input.sealedHandoff);
    return deepFreeze({
      schemaVersion: HANDOFF_METADATA_SCHEMA,
      authoritySource: CREDENTIAL_AUTHORITY_SOURCE,
      identityClass: 'faculty_candidate',
      invitationId: payload.invitationId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      singlePurpose: true,
      clientAsserted: false,
    });
  }

  async exchangeInvitationToken(rawInput) {
    const input = exactSnapshot(rawInput, EXCHANGE_KEYS, denied);
    if (!LOCATOR.test(input.invitationId ?? '')) throw denied();
    const rawToken = canonicalRawToken(input.rawToken);
    const tokenHash = sha256(rawToken);
    const flowNonce = randomBuffer(
      this.#nonceFactory,
      FLOW_NONCE_BYTES,
      'FLOW_NONCE_GENERATION_FAILED',
    );
    const iv = randomBuffer(this.#ivFactory, AES_GCM_IV_BYTES, 'HANDOFF_IV_GENERATION_FAILED');
    const flowNonceHash = sha256(flowNonce);
    flowNonce.fill(0);
    let key;
    try {
      key = await this.#deriveEncryptionKey();
    } catch (error) {
      iv.fill(0);
      throw error;
    }
    try {
      let rawReceipt;
      try {
        rawReceipt = await this.#driver.reserveFacultyCandidateAuthHandoffAtomic({
          binding: this.#binding,
          invitationId: input.invitationId,
          tokenHash,
          flowNonceHash,
          maximumLifetimeSeconds: this.#lifetimeSeconds,
        });
      } catch (error) {
        if (error instanceof InvitationDeniedError) throw denied();
        if (error instanceof IntegrationDisabledError) throw error;
        throw unavailable('CANDIDATE_HANDOFF_RESERVATION_UNAVAILABLE');
      }
      const receipt = validateReservationReceipt(
        rawReceipt,
        { invitationId: input.invitationId, tokenHash, flowNonceHash },
        currentTime(this.#clock),
        this.#lifetimeSeconds,
      );
      const payload = {
        schemaVersion: SEALED_PAYLOAD_SCHEMA,
        authoritySource: AUTHORITY_SOURCE,
        invitationId: receipt.invitationId,
        caseId: receipt.caseId,
        requiresOtpVerification: receipt.requiresOtpVerification,
        tokenHash: receipt.tokenHash,
        flowNonceHash: receipt.flowNonceHash,
        issuedAt: receipt.issuedAt,
        expiresAt: receipt.expiresAt,
        keyVersion: this.#secretBinding.keyVersion,
        singlePurpose: true,
        clientAsserted: false,
      };
      const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
      let ciphertext;
      let tag;
      try {
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(aad(this.#secretBinding.keyVersion), {
          plaintextLength: plaintext.byteLength,
        });
        ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        tag = cipher.getAuthTag();
      } catch {
        throw unavailable('HANDOFF_ENCRYPTION_FAILED');
      } finally {
        plaintext.fill(0);
      }
      if (
        ciphertext.byteLength < 1
        || ciphertext.byteLength > MAXIMUM_CIPHERTEXT_BYTES
        || tag.byteLength !== AES_GCM_TAG_BYTES
      ) throw unavailable('HANDOFF_ENCRYPTION_FAILED');
      const sealedHandoff = `${HANDOFF_PREFIX}.${iv.toString('base64url')}`
        + `.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
      if (!SEALED_HANDOFF.test(sealedHandoff)) throw unavailable('HANDOFF_ENCRYPTION_FAILED');
      return deepFreeze({
        schemaVersion: HANDOFF_SCHEMA,
        authoritySource: AUTHORITY_SOURCE,
        invitationId: receipt.invitationId,
        sealedHandoff,
        issuedAt: receipt.issuedAt,
        expiresAt: receipt.expiresAt,
        singlePurpose: true,
        clientAsserted: false,
      });
    } finally {
      key.fill(0);
      iv.fill(0);
    }
  }

  async redeemSealedHandoff(rawInput) {
    const input = exactSnapshot(rawInput, REDEEM_KEYS, denied);
    if (
      !SUBJECT.test(input.authenticatedSubject ?? '')
      || !LOCATOR.test(input.invitationId ?? '')
      || typeof input.sealedHandoff !== 'string'
      || !SEALED_HANDOFF.test(input.sealedHandoff)
    ) throw denied();
    const payload = await this.#readSealedPayload(input.sealedHandoff, input.invitationId);
    const now = currentTime(this.#clock);
    let rawReceipt;
    try {
      rawReceipt = await this.#driver.redeemFacultyCandidateAuthHandoffAtomic({
        binding: this.#binding,
        invitationId: payload.invitationId,
        tokenHash: payload.tokenHash,
        flowNonceHash: payload.flowNonceHash,
        authenticatedSubject: input.authenticatedSubject,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      });
    } catch (error) {
      if (error instanceof InvitationDeniedError) throw denied();
      if (error instanceof IntegrationDisabledError) throw error;
      throw unavailable('CANDIDATE_HANDOFF_REDEMPTION_UNAVAILABLE');
    }
    const receipt = validateRedemptionReceipt(rawReceipt, {
      invitationId: payload.invitationId,
      caseId: payload.caseId,
      requiresOtpVerification: payload.requiresOtpVerification,
      tokenHash: payload.tokenHash,
      flowNonceHash: payload.flowNonceHash,
      authenticatedSubject: input.authenticatedSubject,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    });
    return createFacultyCandidateCredentialContext({
      schemaVersion: FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
      authoritySource: CREDENTIAL_AUTHORITY_SOURCE,
      authenticatedSubject: input.authenticatedSubject,
      invitationId: payload.invitationId,
      caseId: receipt.caseId,
      requiresOtpVerification: receipt.requiresOtpVerification,
      tokenHash: payload.tokenHash,
      flowNonceHash: payload.flowNonceHash,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      clientAsserted: false,
    }, now);
  }
}

Object.freeze(DurableFacultyCandidateAuthService.prototype);

export function isAuthenticDurableFacultyCandidateAuthService(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  try {
    return AUTHENTIC_SERVICES.has(value)
      && Object.getPrototypeOf(value) === DurableFacultyCandidateAuthService.prototype;
  } catch {
    return false;
  }
}

export const DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT = deepFreeze({
  handoffSchema: HANDOFF_SCHEMA,
  handoffMetadataSchema: HANDOFF_METADATA_SCHEMA,
  sealedPayloadSchema: SEALED_PAYLOAD_SCHEMA,
  reservationReceiptSchema: RESERVATION_RECEIPT_SCHEMA,
  redemptionReceiptSchema: REDEMPTION_RECEIPT_SCHEMA,
  credentialSchema: FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
  exchangeClientFields: ['invitationId', 'rawToken'],
  inspectionServerFields: ['sealedHandoff'],
  inspectionSafeMetadataFields: [
    'schemaVersion',
    'authoritySource',
    'identityClass',
    'invitationId',
    'issuedAt',
    'expiresAt',
    'singlePurpose',
    'clientAsserted',
  ],
  redemptionServerFields: ['authenticatedSubject', 'invitationId', 'sealedHandoff'],
  driverMethods: [
    'reserveFacultyCandidateAuthHandoffAtomic',
    'redeemFacultyCandidateAuthHandoffAtomic',
  ],
  databaseFunctions: [
    'reserve_faculty_candidate_auth_handoff(text,text,text,integer)',
    'redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamptz,timestamptz)',
  ],
  maximumLifetimeSeconds: MAXIMUM_LIFETIME_SECONDS,
  defaultLifetimeSeconds: DEFAULT_LIFETIME_SECONDS,
  tokenPersistence: 'sha256_only',
  handoffCipher: 'aes-256-gcm_hkdf_sha256_key_separation',
  freshnessAuthority: 'database_clock',
  replayProtection: 'atomic_database_reservation_and_single_redemption',
  inspectionConsumption: 'none',
  denialSurface: 'generic_invitation_denied',
  rawTokenInSealedPayload: false,
  rawTokenInDatabaseCommand: false,
  inMemoryProductionFallback: false,
});
