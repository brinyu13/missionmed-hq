import {
  createHash,
  createPublicKey,
  verify as verifyDetachedSignature,
} from 'node:crypto';

import { IntegrationDisabledError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import { BackupRestoreCheckAdapter } from './operational-readiness-adapters.mjs';
import { productionOperationalReadinessTargetRef } from './production-operational-readiness.mjs';
import {
  expectedDr133SuccessorSentinel as expectedDr133ProductionSuccessorSentinel,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';

const INTEGRATION = 'lor_production_restore_proof';
const RESTORE_KEY_REQUEST_SCHEMA =
  'missionmed.lor.production-restore-verification-key-request.v1';
export const PRODUCTION_RESTORE_PROOF_SCHEMA =
  'missionmed.lor.production-restore-proof.v1';
export const VERIFIED_PRODUCTION_RESTORE_PROOF_SCHEMA =
  'missionmed.lor.verified-production-restore-proof.v1';

const SHA256 = /^[a-f0-9]{64}$/u;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{86}$/u;
const MAXIMUM_RESTORE_PROOF_VALIDITY_MS = 30 * 24 * 60 * 60 * 1_000;
const MAXIMUM_RESTORE_RUN_DURATION_MS = 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 30 * 1_000;
const RESTORE_PROOF_ENV_KEY = 'MMHQ_LOR_RESTORE_PROOF_BASE64URL';
const RESTORE_VERIFICATION_SPKI_ENV_KEY = 'MMHQ_LOR_RESTORE_VERIFICATION_SPKI_BASE64';
const MAXIMUM_RESTORE_PROOF_ENCODED_LENGTH = 64 * 1_024;
const MAXIMUM_RESTORE_SPKI_ENCODED_LENGTH = 2 * 1_024;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export const PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF =
  '134a3eee5ee20d4ab55a25ace23f97532a0f7f5b679d68118f10772ce08886b5';

const REHEARSAL_CHECKS = Object.freeze([
  'isolated_restore_target',
  'schema_restore',
  'rls_policy_restore',
  'case_and_audit_atomic_restore',
  'private_bucket_policy_restore',
  'object_version_manifest_checksums',
  'lor_only_rollback_or_forward_repair',
]);
const PROOF_KEYS = new Set([
  'checks',
  'completedAt',
  'databaseRestoreRef',
  'expectedSuccessorSentinelRef',
  'isolatedRestoreTargetRef',
  'manifestRef',
  'productionMutation',
  'protectedContentObservation',
  'recoveryPointRef',
  'restoreMode',
  'restoreRunRef',
  'schemaVersion',
  'scope',
  'secretMaterialObservation',
  'signature',
  'signatureAlgorithm',
  'signerKeyRef',
  'sourceKind',
  'startedAt',
  'storageRestoreRef',
  'targetRef',
  'validUntil',
]);
const UNSIGNED_PROOF_KEYS = [...PROOF_KEYS].filter((key) => key !== 'signature');
const CHECK_KEYS = new Set(['check', 'evidenceRef']);
const KEY_PROVIDER_KEYS = new Set(['loadVerificationKey', 'signerKeyRef']);
const VERIFY_PROOF_OPTION_KEYS = new Set([
  'binding', 'clock', 'proof', 'verificationKeyProvider',
]);
const VERIFIED_PROOF_DESCRIPTOR_KEYS = new Set([
  'completedAt', 'evidenceRef', 'metadataOnly', 'schemaVersion', 'targetBound', 'validUntil',
]);
const BACKUP_ADAPTER_OPTIONS_KEYS = new Set(['binding', 'verifiedRestoreProof']);
const BACKUP_CHECK_REQUEST_KEYS = new Set(['check', 'metadataOnly', 'syntheticOnly']);
const ENVIRONMENT_ADAPTER_OPTION_KEYS = new Set(['binding', 'clock', 'environment']);

const VERIFIED_RESTORE_PROOFS = new WeakMap();
const CLAIMED_RESTORE_PROOF_REFS = new Set();

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

function validatedBinding(rawBinding) {
  const binding = assertValidatedLorTargetBinding(rawBinding, INTEGRATION);
  if (binding.environment !== 'production' || binding.decisionRecord !== 'DR-133') {
    fail('EXACT_DR133_PRODUCTION_TARGET_REQUIRED');
  }
  return binding;
}

function canonicalInstant(value, status) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 32) fail(status);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail(status);
  }
  return Object.freeze({ iso: value, milliseconds });
}

function nowFrom(clock, status = 'CLOCK_INVALID') {
  if (typeof clock !== 'function') fail(status);
  let raw;
  try {
    raw = clock();
  } catch {
    fail(status);
  }
  const date = raw instanceof Date ? new Date(raw.valueOf()) : new Date(raw);
  if (!Number.isFinite(date.valueOf())) fail(status);
  return Object.freeze({ iso: date.toISOString(), milliseconds: date.valueOf() });
}

function exactEd25519PublicKey(rawKey) {
  try {
    if (
      !rawKey
      || typeof rawKey !== 'object'
      || rawKey.type !== 'public'
      || rawKey.asymmetricKeyType !== 'ed25519'
    ) fail('ED25519_VERIFICATION_KEY_REQUIRED');
    const exported = rawKey.export({ format: 'der', type: 'spki' });
    if (!Buffer.isBuffer(exported) || exported.length < 32 || exported.length > 256) {
      fail('ED25519_VERIFICATION_KEY_REQUIRED');
    }
    return Object.freeze({ key: rawKey, exported: Buffer.from(exported) });
  } catch (error) {
    if (error instanceof IntegrationDisabledError) throw error;
    fail('ED25519_VERIFICATION_KEY_REQUIRED');
  }
}

/** Returns the pinned SHA-256 reference for an Ed25519 SPKI public key. */
export function productionRestoreSignerKeyRef(rawPublicKey) {
  const { exported } = exactEd25519PublicKey(rawPublicKey);
  return createHash('sha256')
    .update('missionmed.lor.production-restore-signer.v1\0', 'utf8')
    .update(exported)
    .digest('hex');
}

function strictSignature(rawSignature) {
  if (typeof rawSignature !== 'string' || !BASE64URL_SIGNATURE.test(rawSignature)) {
    fail('RESTORE_PROOF_SIGNATURE_INVALID');
  }
  let bytes;
  try {
    bytes = Buffer.from(rawSignature, 'base64url');
  } catch {
    fail('RESTORE_PROOF_SIGNATURE_INVALID');
  }
  if (bytes.length !== 64 || bytes.toString('base64url') !== rawSignature) {
    fail('RESTORE_PROOF_SIGNATURE_INVALID');
  }
  return bytes;
}

function proofChecks(rawChecks) {
  if (!Array.isArray(rawChecks) || rawChecks.length !== REHEARSAL_CHECKS.length) {
    fail('RESTORE_PROOF_CHECKS_INVALID');
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(rawChecks);
    descriptors = Object.getOwnPropertyDescriptors(rawChecks);
  } catch {
    fail('RESTORE_PROOF_CHECKS_INVALID');
  }
  const indexKeys = REHEARSAL_CHECKS.map((_, index) => String(index));
  if (
    keys.length !== indexKeys.length + 1
    || keys.some((key) => key !== 'length' && !indexKeys.includes(key))
    || descriptors.length?.value !== REHEARSAL_CHECKS.length
    || descriptors.length?.enumerable !== false
  ) fail('RESTORE_PROOF_CHECKS_INVALID');
  const checks = indexKeys.map((key, index) => {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
    ) fail('RESTORE_PROOF_CHECKS_INVALID');
    const rawEntry = descriptor.value;
    const entry = exactSnapshot(rawEntry, CHECK_KEYS, 'RESTORE_PROOF_CHECKS_INVALID');
    if (
      entry.check !== REHEARSAL_CHECKS[index]
      || !SHA256.test(entry.evidenceRef ?? '')
    ) fail('RESTORE_PROOF_CHECKS_INVALID');
    return Object.freeze({ check: entry.check, evidenceRef: entry.evidenceRef });
  });
  return Object.freeze(checks);
}

function snapshotRestoreProof(rawProof, targetRef) {
  const proof = exactSnapshot(rawProof, PROOF_KEYS, 'RESTORE_PROOF_INVALID');
  if (proof.targetRef !== targetRef) fail('RESTORE_PROOF_TARGET_MISMATCH');
  const started = canonicalInstant(proof.startedAt, 'RESTORE_PROOF_TIME_INVALID');
  const completed = canonicalInstant(proof.completedAt, 'RESTORE_PROOF_TIME_INVALID');
  const validUntil = canonicalInstant(proof.validUntil, 'RESTORE_PROOF_TIME_INVALID');
  if (
    proof.schemaVersion !== PRODUCTION_RESTORE_PROOF_SCHEMA
    || !SHA256.test(proof.targetRef ?? '')
    || proof.signerKeyRef !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF
    || proof.expectedSuccessorSentinelRef
      !== sha256(expectedDr133ProductionSuccessorSentinel())
    || proof.signatureAlgorithm !== 'ed25519'
    || proof.restoreMode !== 'real_isolated_restore'
    || proof.sourceKind !== 'provider_native_production_backup'
    || proof.scope !== 'lor_only'
    || proof.protectedContentObservation !== 'not_observed'
    || proof.secretMaterialObservation !== 'not_observed'
    || proof.productionMutation !== 'not_performed'
    || [
      proof.restoreRunRef,
      proof.recoveryPointRef,
      proof.isolatedRestoreTargetRef,
      proof.databaseRestoreRef,
      proof.storageRestoreRef,
      proof.manifestRef,
    ].some((value) => !SHA256.test(value ?? ''))
    || completed.milliseconds < started.milliseconds
    || completed.milliseconds - started.milliseconds > MAXIMUM_RESTORE_RUN_DURATION_MS
    || validUntil.milliseconds <= completed.milliseconds
    || validUntil.milliseconds - completed.milliseconds > MAXIMUM_RESTORE_PROOF_VALIDITY_MS
  ) fail('RESTORE_PROOF_INVALID');
  const checks = proofChecks(proof.checks);
  const unsigned = {};
  for (const key of UNSIGNED_PROOF_KEYS) {
    unsigned[key] = key === 'checks' ? checks : proof[key];
  }
  return Object.freeze({
    unsigned: deepFreeze(unsigned),
    signature: strictSignature(proof.signature),
    completed,
    validUntil,
    checks,
    signerKeyRef: proof.signerKeyRef,
  });
}

function assertUsableRestoreProof(state, now) {
  if (
    state.completedAtMilliseconds > now.milliseconds + CLOCK_SKEW_MS
    || now.milliseconds >= state.validUntilMilliseconds
  ) fail('RESTORE_PROOF_NOT_FRESH');
}

function keyProvider(rawProvider, proofSignerKeyRef) {
  const provider = exactSnapshot(
    rawProvider,
    KEY_PROVIDER_KEYS,
    'RESTORE_VERIFICATION_KEY_PROVIDER_REQUIRED',
    { frozen: true },
  );
  if (
    provider.signerKeyRef !== proofSignerKeyRef
    || provider.signerKeyRef !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF
    || typeof provider.loadVerificationKey !== 'function'
  ) fail('RESTORE_VERIFICATION_KEY_PROVIDER_INVALID');
  return provider;
}

/**
 * Verifies one exact, metadata-only, target-bound Ed25519 restore attestation.
 * The returned descriptor contains no provider payload and is accepted once only.
 */
export async function verifyProductionRestoreProof(rawOptions = {}) {
  const options = optionSnapshot(
    rawOptions,
    VERIFY_PROOF_OPTION_KEYS,
    ['binding', 'proof', 'verificationKeyProvider'],
    'RESTORE_PROOF_VERIFICATION_OPTIONS_INVALID',
  );
  const clock = options.clock ?? (() => new Date());
  const binding = validatedBinding(options.binding);
  const targetRef = productionOperationalReadinessTargetRef(binding);
  const proof = snapshotRestoreProof(options.proof, targetRef);
  assertUsableRestoreProof({
    completedAtMilliseconds: proof.completed.milliseconds,
    validUntilMilliseconds: proof.validUntil.milliseconds,
  }, nowFrom(clock));
  const provider = keyProvider(options.verificationKeyProvider, proof.signerKeyRef);
  const keyRequest = Object.freeze({
    schemaVersion: RESTORE_KEY_REQUEST_SCHEMA,
    signerKeyRef: proof.signerKeyRef,
    targetRef,
    metadataOnly: true,
  });
  let loadedKey;
  try {
    loadedKey = await provider.loadVerificationKey(keyRequest);
  } catch {
    fail('RESTORE_VERIFICATION_KEY_UNAVAILABLE');
  }
  const publicKey = exactEd25519PublicKey(loadedKey);
  if (
    productionRestoreSignerKeyRef(publicKey.key)
      !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF
  ) {
    fail('RESTORE_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
  }
  let verified = false;
  try {
    verified = verifyDetachedSignature(
      null,
      Buffer.from(canonicalize(proof.unsigned), 'utf8'),
      publicKey.key,
      proof.signature,
    );
  } catch {
    fail('RESTORE_PROOF_SIGNATURE_INVALID');
  }
  if (verified !== true) fail('RESTORE_PROOF_SIGNATURE_INVALID');

  const evidenceRef = sha256(canonicalize({
    schemaVersion: VERIFIED_PRODUCTION_RESTORE_PROOF_SCHEMA,
    targetRef,
    signerKeyRef: provider.signerKeyRef,
    unsignedProofRef: sha256(canonicalize(proof.unsigned)),
    signatureRef: sha256(proof.signature),
  }));
  const descriptor = deepFreeze({
    schemaVersion: VERIFIED_PRODUCTION_RESTORE_PROOF_SCHEMA,
    targetBound: true,
    metadataOnly: true,
    completedAt: proof.completed.iso,
    validUntil: proof.validUntil.iso,
    evidenceRef,
  });
  VERIFIED_RESTORE_PROOFS.set(descriptor, {
    claimed: false,
    targetRef,
    completedAtMilliseconds: proof.completed.milliseconds,
    validUntilMilliseconds: proof.validUntil.milliseconds,
    clock,
    checkEvidenceRefs: new Map(proof.checks.map((entry) => [entry.check, entry.evidenceRef])),
    evidenceRef,
  });
  return descriptor;
}

function verifiedRestoreProofState(rawDescriptor, targetRef) {
  const descriptor = exactSnapshot(
    rawDescriptor,
    VERIFIED_PROOF_DESCRIPTOR_KEYS,
    'VERIFIED_RESTORE_PROOF_REQUIRED',
    { frozen: true },
  );
  const state = VERIFIED_RESTORE_PROOFS.get(rawDescriptor);
  if (
    !state
    || descriptor.schemaVersion !== VERIFIED_PRODUCTION_RESTORE_PROOF_SCHEMA
    || descriptor.targetBound !== true
    || descriptor.metadataOnly !== true
    || !SHA256.test(descriptor.evidenceRef ?? '')
    || descriptor.evidenceRef !== state.evidenceRef
  ) fail('VERIFIED_RESTORE_PROOF_REQUIRED');
  if (state.claimed) fail('VERIFIED_RESTORE_PROOF_REPLAYED');
  if (state.targetRef !== targetRef) fail('VERIFIED_RESTORE_PROOF_TARGET_MISMATCH');
  if (CLAIMED_RESTORE_PROOF_REFS.has(state.evidenceRef)) {
    fail('VERIFIED_RESTORE_PROOF_REPLAYED');
  }
  assertUsableRestoreProof(state, nowFrom(state.clock));
  state.claimed = true;
  CLAIMED_RESTORE_PROOF_REFS.add(state.evidenceRef);
  return state;
}

/**
 * Creates the existing branded BackupRestoreCheckAdapter from one verified proof.
 * Its checker completes one ordered seven-check rehearsal and then rejects replay.
 */
export function createProductionBackupRestoreAdapterFromVerifiedProof(rawOptions) {
  const options = exactSnapshot(
    rawOptions,
    BACKUP_ADAPTER_OPTIONS_KEYS,
    'BACKUP_RESTORE_ADAPTER_OPTIONS_INVALID',
  );
  const binding = validatedBinding(options.binding);
  const proofState = verifiedRestoreProofState(
    options.verifiedRestoreProof,
    productionOperationalReadinessTargetRef(binding),
  );
  const state = { consumed: false, index: 0 };
  const checker = Object.freeze({
    async runCheck(rawRequest) {
      const request = exactSnapshot(
        rawRequest,
        BACKUP_CHECK_REQUEST_KEYS,
        'BACKUP_RESTORE_CHECK_REQUEST_INVALID',
      );
      if (
        state.consumed
        || request.check !== REHEARSAL_CHECKS[state.index]
        || request.metadataOnly !== true
        || request.syntheticOnly !== true
      ) {
        state.consumed = true;
        fail('BACKUP_RESTORE_PROOF_REPLAYED');
      }
      assertUsableRestoreProof(proofState, nowFrom(proofState.clock));
      if (!SHA256.test(proofState.checkEvidenceRefs.get(request.check) ?? '')) {
        state.consumed = true;
        fail('BACKUP_RESTORE_CHECK_EVIDENCE_INVALID');
      }
      state.index += 1;
      if (state.index === REHEARSAL_CHECKS.length) state.consumed = true;
      return Object.freeze({ passed: true, errorCode: '' });
    },
  });
  return new BackupRestoreCheckAdapter({
    // These internal flags are derived only after cryptographic proof validation;
    // no caller-provided boolean can establish backup readiness.
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      syntheticOnly: true,
      isolatedRestoreTarget: true,
      databaseAndAuditTogether: true,
      storageVersionManifest: true,
    },
    checker,
    clock: proofState.clock,
  });
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

function strictBase64urlBytes(value, maximumLength, status) {
  if (value.length > maximumLength || !BASE64URL.test(value)) fail(status);
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
    value.length > maximumLength
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

function strictCanonicalProofJson(encodedProof) {
  const bytes = strictBase64urlBytes(
    encodedProof,
    MAXIMUM_RESTORE_PROOF_ENCODED_LENGTH,
    'RESTORE_PROOF_ENVIRONMENT_INVALID',
  );
  try {
    const text = bytes.toString('utf8');
    const roundTrip = Buffer.from(text, 'utf8');
    const validUtf8 = roundTrip.equals(bytes);
    roundTrip.fill(0);
    if (!validUtf8) fail('RESTORE_PROOF_JSON_INVALID');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      fail('RESTORE_PROOF_JSON_INVALID');
    }
    let canonical;
    try {
      canonical = canonicalize(parsed);
    } catch {
      fail('RESTORE_PROOF_JSON_INVALID');
    }
    if (canonical !== text) fail('RESTORE_PROOF_JSON_NOT_CANONICAL');
    return parsed;
  } finally {
    bytes.fill(0);
  }
}

function strictEd25519Spki(encodedSpki) {
  const bytes = strictBase64Bytes(
    encodedSpki,
    MAXIMUM_RESTORE_SPKI_ENCODED_LENGTH,
    'RESTORE_VERIFICATION_SPKI_INVALID',
  );
  try {
    let key;
    try {
      key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
    } catch {
      fail('RESTORE_VERIFICATION_SPKI_INVALID');
    }
    return exactEd25519PublicKey(key).key;
  } finally {
    bytes.fill(0);
  }
}

/**
 * Server composition helper. It reads only the two dedicated variables, parses
 * canonical public evidence, verifies it through the existing proof boundary,
 * and returns the one-rehearsal branded backup adapter.
 */
export async function createProductionBackupRestoreAdapterFromEnvironment(rawOptions = {}) {
  const options = optionSnapshot(
    rawOptions,
    ENVIRONMENT_ADAPTER_OPTION_KEYS,
    ['binding', 'environment'],
    'BACKUP_RESTORE_ENVIRONMENT_OPTIONS_INVALID',
  );
  const binding = validatedBinding(options.binding);
  const clock = options.clock ?? (() => new Date());
  nowFrom(clock);
  const encodedProof = environmentValue(
    options.environment,
    RESTORE_PROOF_ENV_KEY,
    'RESTORE_PROOF_ENVIRONMENT_REQUIRED',
  );
  const encodedSpki = environmentValue(
    options.environment,
    RESTORE_VERIFICATION_SPKI_ENV_KEY,
    'RESTORE_VERIFICATION_SPKI_REQUIRED',
  );
  const proof = strictCanonicalProofJson(encodedProof);
  const verificationKey = strictEd25519Spki(encodedSpki);
  const derivedSignerKeyRef = productionRestoreSignerKeyRef(verificationKey);
  if (derivedSignerKeyRef !== PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF) {
    fail('RESTORE_VERIFICATION_KEY_FINGERPRINT_MISMATCH');
  }
  const verificationKeyProvider = Object.freeze({
    signerKeyRef: PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
    async loadVerificationKey() { return verificationKey; },
  });
  const verifiedRestoreProof = await verifyProductionRestoreProof({
    binding,
    proof,
    verificationKeyProvider,
    clock,
  });
  return createProductionBackupRestoreAdapterFromVerifiedProof({
    binding,
    verifiedRestoreProof,
  });
}

export const PRODUCTION_RESTORE_PROOF_CONTRACT = deepFreeze({
  schemaVersion: PRODUCTION_RESTORE_PROOF_SCHEMA,
  verifiedSchemaVersion: VERIFIED_PRODUCTION_RESTORE_PROOF_SCHEMA,
  authority: 'DR-133',
  signature: 'ed25519_detached_over_canonical_exact_metadata',
  signer: 'source_pinned_domain_separated_spki_sha256_secure_key_provider',
  pinnedSignerKeyRef: PINNED_PRODUCTION_RELEASE_CAPTAIN_SIGNER_KEY_REF,
  maximumValidityMilliseconds: MAXIMUM_RESTORE_PROOF_VALIDITY_MS,
  callerMaximumAgeAuthority: false,
  successorSentinelBinding: 'sha256_exact_current_dr133_production_successor_sentinel',
  use: 'single_signed_attestation_claim_per_process_single_adapter_single_rehearsal',
  checks: [...REHEARSAL_CHECKS],
  restoreMode: 'real_isolated_restore',
  sourceKind: 'provider_native_production_backup',
  scope: 'lor_only',
  content: 'metadata_only_no_protected_content_no_secret_material',
  rawReceiptAuthority: false,
  callerBooleanAuthority: false,
  environmentKeys: [RESTORE_PROOF_ENV_KEY, RESTORE_VERIFICATION_SPKI_ENV_KEY],
  environmentEncoding: 'canonical_base64url_canonical_json_and_canonical_base64_der_spki',
});
