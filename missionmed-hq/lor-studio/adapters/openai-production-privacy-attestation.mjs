import {
  createPublicKey,
  verify as verifyDetachedSignature,
} from 'node:crypto';

import { IntegrationDisabledError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';
import { OPENAI_GROUNDED_PROPOSAL_CONTRACT } from './openai-grounded-proposal-adapter.mjs';
import {
  PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  productionRestoreSignerKeyRef,
} from './production-readiness-surfaces.mjs';

const INTEGRATION = 'openai_grounded_proposal';
export const OPENAI_PRIVACY_ATTESTATION_SCHEMA =
  'missionmed.lor.openai-privacy-attestation.v1';
export const VERIFIED_OPENAI_PRIVACY_ATTESTATION_SCHEMA =
  'missionmed.lor.verified-openai-privacy-attestation.v1';

const PRIVACY_ATTESTATION_ENV_KEY = 'MMHQ_LOR_OPENAI_PRIVACY_ATTESTATION_BASE64URL';
const PRIVACY_VERIFICATION_SPKI_ENV_KEY = 'MMHQ_LOR_OPENAI_PRIVACY_VERIFICATION_SPKI_BASE64';
const MAXIMUM_VALIDITY_MS = 30 * 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 30 * 1_000;
const MAXIMUM_ATTESTATION_ENCODED_LENGTH = 32 * 1_024;
const MAXIMUM_SPKI_ENCODED_LENGTH = 2 * 1_024;
const SHA256 = /^[a-f0-9]{64}$/u;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{86}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const PROJECT_ID = /^proj_[A-Za-z0-9_-]{6,200}$/u;
const ATTESTATION_KEYS = new Set([
  'apiDataTrainingOptOut',
  'educationRecordProcessingAuthorized',
  'evidenceDigest',
  'expiresAt',
  'independentlyVerified',
  'issuedAt',
  'model',
  'projectDataRetention',
  'projectId',
  'provider',
  'schemaVersion',
  'signature',
  'signatureAlgorithm',
  'signerKeyRef',
]);
const UNSIGNED_ATTESTATION_KEYS = [...ATTESTATION_KEYS]
  .filter((key) => key !== 'signature');
const VERIFY_OPTIONS_KEYS = new Set([
  'attestation', 'clock', 'projectId', 'verificationKey',
]);
const ENVIRONMENT_OPTIONS_KEYS = new Set(['clock', 'environment', 'projectId']);
const CLAIM_OPTIONS_KEYS = new Set(['projectId', 'verifiedAttestation']);
const VERIFIED_DESCRIPTOR_KEYS = new Set([
  'attestationRef',
  'evidenceRef',
  'expiresAt',
  'issuedAt',
  'model',
  'projectRef',
  'provider',
  'schemaVersion',
]);

const VERIFIED_ATTESTATIONS = new WeakMap();

function fail(status) {
  throw new IntegrationDisabledError(INTEGRATION, status);
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

function optionSnapshot(value, allowedKeys, requiredKeys, status) {
  if (!isPlainObject(value)) fail(status);
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail(status);
  }
  if (
    keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
    || requiredKeys.some((key) => !keys.includes(key))
  ) fail(status);
  const snapshot = {};
  for (const key of keys) {
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

function canonicalInstant(value, status) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 32) fail(status);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail(status);
  }
  return Object.freeze({ iso: value, milliseconds });
}

function nowFrom(clock) {
  if (typeof clock !== 'function') fail('OPENAI_PRIVACY_ATTESTATION_CLOCK_INVALID');
  let raw;
  try {
    raw = clock();
  } catch {
    fail('OPENAI_PRIVACY_ATTESTATION_CLOCK_INVALID');
  }
  const date = raw instanceof Date ? new Date(raw.valueOf()) : new Date(raw);
  if (!Number.isFinite(date.valueOf())) fail('OPENAI_PRIVACY_ATTESTATION_CLOCK_INVALID');
  return date.valueOf();
}

function exactProjectId(value) {
  if (typeof value !== 'string' || !PROJECT_ID.test(value)) {
    fail('OPENAI_EXACT_PROJECT_BINDING_REQUIRED');
  }
  return value;
}

function exactEd25519PublicKey(rawKey) {
  try {
    if (
      !rawKey
      || typeof rawKey !== 'object'
      || rawKey.type !== 'public'
      || rawKey.asymmetricKeyType !== 'ed25519'
    ) fail('OPENAI_PRIVACY_ED25519_VERIFICATION_KEY_REQUIRED');
    const exported = rawKey.export({ format: 'der', type: 'spki' });
    if (!Buffer.isBuffer(exported) || exported.length < 32 || exported.length > 256) {
      fail('OPENAI_PRIVACY_ED25519_VERIFICATION_KEY_REQUIRED');
    }
    return rawKey;
  } catch (error) {
    if (error instanceof IntegrationDisabledError) throw error;
    fail('OPENAI_PRIVACY_ED25519_VERIFICATION_KEY_REQUIRED');
  }
}

function strictSignature(value) {
  if (typeof value !== 'string' || !BASE64URL_SIGNATURE.test(value)) {
    fail('OPENAI_PRIVACY_ATTESTATION_SIGNATURE_INVALID');
  }
  let bytes;
  try {
    bytes = Buffer.from(value, 'base64url');
  } catch {
    fail('OPENAI_PRIVACY_ATTESTATION_SIGNATURE_INVALID');
  }
  if (bytes.length !== 64 || bytes.toString('base64url') !== value) {
    bytes.fill(0);
    fail('OPENAI_PRIVACY_ATTESTATION_SIGNATURE_INVALID');
  }
  return bytes;
}

function snapshotAttestation(rawAttestation, expectedProjectId) {
  const attestation = exactSnapshot(
    rawAttestation,
    ATTESTATION_KEYS,
    'OPENAI_PRIVACY_ATTESTATION_INVALID',
  );
  const issuedAt = canonicalInstant(
    attestation.issuedAt,
    'OPENAI_PRIVACY_ATTESTATION_TIME_INVALID',
  );
  const expiresAt = canonicalInstant(
    attestation.expiresAt,
    'OPENAI_PRIVACY_ATTESTATION_TIME_INVALID',
  );
  if (
    attestation.schemaVersion !== OPENAI_PRIVACY_ATTESTATION_SCHEMA
    || attestation.provider !== 'openai'
    || attestation.projectId !== expectedProjectId
    || attestation.model !== OPENAI_GROUNDED_PROPOSAL_CONTRACT.model
    || attestation.projectDataRetention !== 'zero_data_retention'
    || attestation.apiDataTrainingOptOut !== true
    || attestation.educationRecordProcessingAuthorized !== true
    || attestation.independentlyVerified !== true
    || !SHA256.test(attestation.evidenceDigest ?? '')
    || attestation.signatureAlgorithm !== 'ed25519'
    || attestation.signerKeyRef !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF
    || expiresAt.milliseconds <= issuedAt.milliseconds
    || expiresAt.milliseconds - issuedAt.milliseconds > MAXIMUM_VALIDITY_MS
  ) fail('OPENAI_PRIVACY_ATTESTATION_INVALID');
  const unsigned = {};
  for (const key of UNSIGNED_ATTESTATION_KEYS) unsigned[key] = attestation[key];
  return Object.freeze({
    unsigned: deepFreeze(unsigned),
    issuedAt,
    expiresAt,
    signature: strictSignature(attestation.signature),
  });
}

function assertUsable(state, now) {
  if (
    state.issuedAtMilliseconds > now + CLOCK_SKEW_MS
    || now >= state.expiresAtMilliseconds
  ) fail('OPENAI_PRIVACY_ATTESTATION_NOT_CURRENT');
}

function strictBase64urlBytes(value, maximumLength, status) {
  if (typeof value !== 'string' || value.length > maximumLength || !BASE64URL.test(value)) {
    fail(status);
  }
  let bytes;
  try {
    bytes = Buffer.from(value, 'base64url');
  } catch {
    fail(status);
  }
  if (bytes.length === 0 || bytes.toString('base64url') !== value) {
    bytes.fill(0);
    fail(status);
  }
  return bytes;
}

function strictBase64Bytes(value, maximumLength, status) {
  if (
    typeof value !== 'string'
    || value.length > maximumLength
    || value.length % 4 !== 0
    || !BASE64.test(value)
  ) fail(status);
  let bytes;
  try {
    bytes = Buffer.from(value, 'base64');
  } catch {
    fail(status);
  }
  if (bytes.length === 0 || bytes.toString('base64') !== value) {
    bytes.fill(0);
    fail(status);
  }
  return bytes;
}

function strictCanonicalAttestationJson(encodedAttestation) {
  const bytes = strictBase64urlBytes(
    encodedAttestation,
    MAXIMUM_ATTESTATION_ENCODED_LENGTH,
    'OPENAI_PRIVACY_ATTESTATION_ENVIRONMENT_INVALID',
  );
  try {
    const text = bytes.toString('utf8');
    const roundTrip = Buffer.from(text, 'utf8');
    const validUtf8 = roundTrip.equals(bytes);
    roundTrip.fill(0);
    if (!validUtf8) fail('OPENAI_PRIVACY_ATTESTATION_JSON_INVALID');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      fail('OPENAI_PRIVACY_ATTESTATION_JSON_INVALID');
    }
    let canonical;
    try {
      canonical = canonicalize(parsed);
    } catch {
      fail('OPENAI_PRIVACY_ATTESTATION_JSON_INVALID');
    }
    if (canonical !== text) fail('OPENAI_PRIVACY_ATTESTATION_JSON_NOT_CANONICAL');
    return parsed;
  } finally {
    bytes.fill(0);
  }
}

function strictEd25519Spki(encodedSpki) {
  const bytes = strictBase64Bytes(
    encodedSpki,
    MAXIMUM_SPKI_ENCODED_LENGTH,
    'OPENAI_PRIVACY_VERIFICATION_SPKI_INVALID',
  );
  try {
    let key;
    try {
      key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
    } catch {
      fail('OPENAI_PRIVACY_VERIFICATION_SPKI_INVALID');
    }
    return exactEd25519PublicKey(key);
  } finally {
    bytes.fill(0);
  }
}

function environmentValue(environment, key, status) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) fail(status);
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(environment, key);
  } catch {
    fail(status);
  }
  if (
    !descriptor
    || !Object.hasOwn(descriptor, 'value')
    || typeof descriptor.value !== 'string'
    || descriptor.value.length === 0
  ) fail(status);
  return descriptor.value;
}

/** Verify an exact project/model/privacy attestation with the source-pinned release key. */
export function verifyOpenAiProductionPrivacyAttestation(rawOptions = {}) {
  const options = optionSnapshot(
    rawOptions,
    VERIFY_OPTIONS_KEYS,
    ['attestation', 'projectId', 'verificationKey'],
    'OPENAI_PRIVACY_ATTESTATION_OPTIONS_INVALID',
  );
  const projectId = exactProjectId(options.projectId);
  const clock = options.clock ?? (() => new Date());
  const attestation = snapshotAttestation(options.attestation, projectId);
  const now = nowFrom(clock);
  assertUsable({
    issuedAtMilliseconds: attestation.issuedAt.milliseconds,
    expiresAtMilliseconds: attestation.expiresAt.milliseconds,
  }, now);
  const verificationKey = exactEd25519PublicKey(options.verificationKey);
  if (
    productionRestoreSignerKeyRef(verificationKey)
      !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF
  ) fail('OPENAI_PRIVACY_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
  let verified = false;
  try {
    verified = verifyDetachedSignature(
      null,
      Buffer.from(canonicalize(attestation.unsigned), 'utf8'),
      verificationKey,
      attestation.signature,
    );
  } catch {
    fail('OPENAI_PRIVACY_ATTESTATION_SIGNATURE_INVALID');
  }
  if (verified !== true) fail('OPENAI_PRIVACY_ATTESTATION_SIGNATURE_INVALID');

  const attestationRef = sha256(canonicalize({
    unsigned: attestation.unsigned,
    signatureRef: sha256(attestation.signature),
  }));
  const descriptor = deepFreeze({
    schemaVersion: VERIFIED_OPENAI_PRIVACY_ATTESTATION_SCHEMA,
    provider: 'openai',
    projectRef: sha256(`missionmed:lor:openai-project:${projectId}`),
    model: OPENAI_GROUNDED_PROPOSAL_CONTRACT.model,
    issuedAt: attestation.issuedAt.iso,
    expiresAt: attestation.expiresAt.iso,
    evidenceRef: attestation.unsigned.evidenceDigest,
    attestationRef,
  });
  VERIFIED_ATTESTATIONS.set(descriptor, {
    claimed: false,
    clock,
    projectId,
    model: OPENAI_GROUNDED_PROPOSAL_CONTRACT.model,
    issuedAtMilliseconds: attestation.issuedAt.milliseconds,
    expiresAtMilliseconds: attestation.expiresAt.milliseconds,
    evidenceRef: attestation.unsigned.evidenceDigest,
    attestationRef,
  });
  return descriptor;
}

/** Read only the two canonical public attestation variables and verify them. */
export function verifyOpenAiProductionPrivacyAttestationFromEnvironment(rawOptions = {}) {
  const options = optionSnapshot(
    rawOptions,
    ENVIRONMENT_OPTIONS_KEYS,
    ['environment', 'projectId'],
    'OPENAI_PRIVACY_ATTESTATION_ENVIRONMENT_OPTIONS_INVALID',
  );
  const encodedAttestation = environmentValue(
    options.environment,
    PRIVACY_ATTESTATION_ENV_KEY,
    'OPENAI_PRIVACY_ATTESTATION_ENVIRONMENT_REQUIRED',
  );
  const encodedSpki = environmentValue(
    options.environment,
    PRIVACY_VERIFICATION_SPKI_ENV_KEY,
    'OPENAI_PRIVACY_VERIFICATION_SPKI_REQUIRED',
  );
  const attestation = strictCanonicalAttestationJson(encodedAttestation);
  const verificationKey = strictEd25519Spki(encodedSpki);
  if (
    productionRestoreSignerKeyRef(verificationKey)
      !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF
  ) fail('OPENAI_PRIVACY_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
  return verifyOpenAiProductionPrivacyAttestation({
    attestation,
    verificationKey,
    projectId: options.projectId,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });
}

/** Mint the legacy provider binding only from this module's verified descriptor brand. */
export function createOpenAiPrivacyBindingFromVerifiedAttestation(rawOptions = {}) {
  const options = exactSnapshot(
    rawOptions,
    CLAIM_OPTIONS_KEYS,
    'OPENAI_PRIVACY_BINDING_OPTIONS_INVALID',
  );
  const projectId = exactProjectId(options.projectId);
  const descriptor = exactSnapshot(
    options.verifiedAttestation,
    VERIFIED_DESCRIPTOR_KEYS,
    'VERIFIED_OPENAI_PRIVACY_ATTESTATION_REQUIRED',
    { frozen: true },
  );
  const state = VERIFIED_ATTESTATIONS.get(options.verifiedAttestation);
  if (
    !state
    || state.claimed
    || descriptor.schemaVersion !== VERIFIED_OPENAI_PRIVACY_ATTESTATION_SCHEMA
    || descriptor.provider !== 'openai'
    || descriptor.projectRef !== sha256(`missionmed:lor:openai-project:${projectId}`)
    || descriptor.model !== OPENAI_GROUNDED_PROPOSAL_CONTRACT.model
    || descriptor.evidenceRef !== state.evidenceRef
    || descriptor.attestationRef !== state.attestationRef
    || state.projectId !== projectId
    || state.model !== OPENAI_GROUNDED_PROPOSAL_CONTRACT.model
  ) fail(state?.claimed
    ? 'VERIFIED_OPENAI_PRIVACY_ATTESTATION_REPLAYED'
    : 'VERIFIED_OPENAI_PRIVACY_ATTESTATION_REQUIRED');
  assertUsable(state, nowFrom(state.clock));
  state.claimed = true;
  return deepFreeze({
    schemaVersion: 'missionmed.lor.openai-project-binding.v1',
    provider: 'openai',
    providerResourceBound: true,
    projectId,
    projectDataRetention: 'zero_data_retention',
    apiDataTrainingOptOut: true,
    educationRecordProcessingAuthorized: true,
    independentlyVerified: true,
  });
}

export const OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT = deepFreeze({
  schemaVersion: OPENAI_PRIVACY_ATTESTATION_SCHEMA,
  verifiedSchemaVersion: VERIFIED_OPENAI_PRIVACY_ATTESTATION_SCHEMA,
  provider: 'openai',
  model: OPENAI_GROUNDED_PROPOSAL_CONTRACT.model,
  signature: 'ed25519_detached_over_canonical_exact_attestation',
  pinnedSignerKeyRef: PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  maximumValidityMilliseconds: MAXIMUM_VALIDITY_MS,
  exactClaims: Object.freeze({
    projectDataRetention: 'zero_data_retention',
    apiDataTrainingOptOut: true,
    educationRecordProcessingAuthorized: true,
    independentlyVerified: true,
  }),
  evidence: 'required_sha256_digest',
  bindingAuthority: 'single_claim_module_branded_verified_descriptor_only',
  environmentKeys: Object.freeze([
    PRIVACY_ATTESTATION_ENV_KEY,
    PRIVACY_VERIFICATION_SPKI_ENV_KEY,
  ]),
  environmentEncoding: 'canonical_base64url_json_and_canonical_base64_der_spki',
  callerBooleanAuthority: false,
});
