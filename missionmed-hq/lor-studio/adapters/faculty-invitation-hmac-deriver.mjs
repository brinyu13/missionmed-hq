import { createHmac } from 'node:crypto';

import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import {
  assertNonEmptyString,
  canonicalize,
  deepFreeze,
  sha256,
} from '../domain/value-utils.js';

const BINDING_SCHEMA = 'missionmed.lor.faculty-invitation-secret-binding.v1';
const BINDING_KEYS = new Set([
  'schemaVersion',
  'providerResourceBound',
  'independentlyVerified',
  'serverSideSecret',
  'keyVersion',
]);
const ISSUE_KEYS = new Set([
  'caseId',
  'expectedRevision',
  'recipientEmailHash',
  'idempotencyKey',
]);
const RESEND_KEYS = new Set([
  'caseId',
  'recipientEmailHash',
  'idempotencyKey',
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const ONE_MILLION = 1_000_000;
const UINT32_RANGE = 0x1_0000_0000;
const UNBIASED_UINT32_LIMIT = Math.floor(UINT32_RANGE / ONE_MILLION) * ONE_MILLION;

function snapshotExactRecord(value, expectedKeys, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`);
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new ValidationError(`${fieldName} is unreadable`);
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
    || keys.some((key) => (
      !descriptors[key]
      || descriptors[key].enumerable !== true
      || !Object.hasOwn(descriptors[key], 'value')
    ))
  ) {
    throw new ValidationError(`${fieldName} has an invalid shape`);
  }
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, descriptors[key].value])));
}

function validateBinding(rawBinding) {
  let binding;
  try {
    binding = snapshotExactRecord(rawBinding, BINDING_KEYS, 'secret binding');
  } catch {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_secrets',
      'VERIFIED_SECRET_BINDING_REQUIRED',
    );
  }
  if (
    binding.schemaVersion !== BINDING_SCHEMA
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.serverSideSecret !== true
    || typeof binding.keyVersion !== 'string'
    || !/^[A-Za-z0-9_.:-]{1,64}$/u.test(binding.keyVersion)
  ) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_secrets',
      'VERIFIED_SECRET_BINDING_REQUIRED',
    );
  }
  return binding;
}

function validateKey(rawKey) {
  if (!Buffer.isBuffer(rawKey) || rawKey.byteLength < 32 || rawKey.byteLength > 256) {
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_secrets',
      'BOUND_SECRET_KEY_REQUIRED',
    );
  }
  return Buffer.from(rawKey);
}

function validateCaseId(value) {
  assertNonEmptyString(value, 'caseId', { maxLength: 200 });
  if (!IDENTIFIER_PATTERN.test(value)) throw new ValidationError('caseId is invalid');
  return value;
}

function validateDigest(value, fieldName) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`);
  }
  return value;
}

function validateIdempotencyKey(value) {
  return assertNonEmptyString(value, 'idempotencyKey', { maxLength: 200 });
}

/**
 * Stable, server-only derivation for retryable invitation secrets.
 *
 * The database stores only hashes. Stable HMAC derivation lets an interrupted delivery retry
 * recover the exact token and OTP without putting either raw secret in PostgreSQL, a log, an
 * HTTP response, or a handoff artifact. The injected key is held in a private field and is never
 * exposed through the public surface or JSON serialization.
 */
export class HmacFacultyInvitationSecretDeriver {
  #key;

  constructor({ binding, key } = {}) {
    this.binding = validateBinding(binding);
    this.#key = validateKey(key);
    Object.freeze(this);
  }

  #digest(label, payload) {
    return createHmac('sha256', this.#key)
      .update(`${label}\n${this.binding.keyVersion}\n${canonicalize(payload)}`, 'utf8')
      .digest();
  }

  #otpCode(payload) {
    for (let counter = 0; counter < 64; counter += 1) {
      const candidate = this.#digest('faculty-otp-code-v1', { ...payload, counter }).readUInt32BE(0);
      if (candidate < UNBIASED_UINT32_LIMIT) {
        return String(candidate % ONE_MILLION).padStart(6, '0');
      }
    }
    // The rejection loop failing 64 consecutive times is cryptographically implausible. Treat
    // it as an unavailable key/runtime rather than falling back to biased or predictable output.
    throw new IntegrationDisabledError(
      'lor_faculty_invitation_secrets',
      'SECRET_DERIVATION_FAILED',
    );
  }

  tokenForInvitation(invitationId) {
    assertNonEmptyString(invitationId, 'invitationId', { maxLength: 200 });
    if (!IDENTIFIER_PATTERN.test(invitationId)) {
      throw new ValidationError('invitationId is invalid');
    }
    return this.#digest('faculty-invitation-token-v1', { invitationId }).toString('base64url');
  }

  deriveIssue(rawInput) {
    const input = snapshotExactRecord(rawInput, ISSUE_KEYS, 'issue secret request');
    const caseId = validateCaseId(input.caseId);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be a non-negative integer');
    }
    const recipientEmailHash = validateDigest(input.recipientEmailHash, 'recipientEmailHash');
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const identity = {
      caseId,
      expectedRevision: input.expectedRevision,
      recipientEmailHash,
      idempotencyKey,
    };
    const invitationId = `invite_${this.#digest('faculty-invitation-id-v1', identity).toString('hex')}`;
    const challengeId = `challenge_${this.#digest('faculty-otp-challenge-id-v1', identity).toString('hex')}`;
    const rawToken = this.tokenForInvitation(invitationId);
    const otpCode = this.#otpCode({ caseId, invitationId, challengeId, idempotencyKey });
    return deepFreeze({
      keyVersion: this.binding.keyVersion,
      invitationId,
      tokenHash: sha256(rawToken),
      rawToken,
      challengeId,
      otpCodeHash: sha256(`lor-studio:otp-attempt:${challengeId}:${otpCode}`),
      otpCode,
    });
  }

  deriveResend(rawInput) {
    const input = snapshotExactRecord(rawInput, RESEND_KEYS, 'resend secret request');
    const caseId = validateCaseId(input.caseId);
    const recipientEmailHash = validateDigest(input.recipientEmailHash, 'recipientEmailHash');
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const identity = { caseId, recipientEmailHash, idempotencyKey };
    const challengeId = `challenge_${this.#digest('faculty-otp-resend-challenge-id-v1', identity).toString('hex')}`;
    const otpCode = this.#otpCode({ caseId, challengeId, idempotencyKey });
    return deepFreeze({
      keyVersion: this.binding.keyVersion,
      challengeId,
      otpCodeHash: sha256(`lor-studio:otp-attempt:${challengeId}:${otpCode}`),
      otpCode,
    });
  }
}

export const FACULTY_INVITATION_SECRET_DERIVER_CONTRACT = deepFreeze({
  schemaVersion: BINDING_SCHEMA,
  keyMinimumBytes: 32,
  keyCustody: 'injected_server_secret_private_field_only',
  persistence: 'hashes_only_raw_token_and_otp_never_persisted',
  retrySemantics: 'same_idempotency_request_recovers_same_secrets',
  tokenTransport: 'email_link_fragment_only',
  otpDigits: 6,
});
