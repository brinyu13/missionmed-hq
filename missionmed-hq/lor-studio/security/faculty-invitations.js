import { randomBytes, timingSafeEqual } from 'node:crypto';

import { DomainInvariantError, InvitationDeniedError, ValidationError } from '../domain/errors.js';
import {
  assertNonEmptyString,
  cloneFrozen,
  deepFreeze,
  makeId,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { assertPort } from '../services/ports.js';

const MINIMUM_TOKEN_BYTES = 16;
const DEFAULT_TOKEN_BYTES = 32;

export function normalizeFacultyEmail(email) {
  assertNonEmptyString(email, 'recipientEmail', { maxLength: 320 });
  const normalized = email.normalize('NFKC').trim().toLowerCase();
  if (/\s/u.test(normalized) || !/^[^@]+@[^@]+\.[^@]+$/u.test(normalized)) {
    throw new ValidationError('Faculty recipient email is invalid');
  }
  return normalized;
}

export function hashFacultyEmail(email) {
  return sha256(normalizeFacultyEmail(email));
}

function tokenDigest(rawToken) {
  return Buffer.from(sha256(rawToken), 'hex');
}

function hashesEqual(leftHex, rightBuffer) {
  if (typeof leftHex !== 'string' || !/^[a-f0-9]{64}$/u.test(leftHex)) return false;
  const left = Buffer.from(leftHex, 'hex');
  return left.length === rightBuffer.length && timingSafeEqual(left, rightBuffer);
}

function assertInvitation(invitation) {
  if (!invitation || invitation.schemaVersion !== 'missionmed.lor.faculty-invitation.v1') {
    throw new DomainInvariantError('Unsupported faculty invitation schema');
  }
  if (!Number.isSafeInteger(invitation.revision) || invitation.revision < 0) {
    throw new DomainInvariantError('Invitation revision must be non-negative');
  }
  return invitation;
}

export function createFacultyInvitation({
  id,
  caseId,
  recipientEmail,
  expiresAt,
  now = new Date(),
  maxAttempts = 5,
  attemptWindowMs = 15 * 60 * 1_000,
  lockoutMs = 30 * 60 * 1_000,
  tokenFactory = (length) => randomBytes(length),
  idFactory,
}) {
  assertNonEmptyString(caseId, 'caseId');
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new ValidationError('maxAttempts must be between 1 and 20');
  }
  if (!Number.isSafeInteger(attemptWindowMs) || attemptWindowMs < 1_000) {
    throw new ValidationError('attemptWindowMs is too short');
  }
  if (!Number.isSafeInteger(lockoutMs) || lockoutMs < 1_000) {
    throw new ValidationError('lockoutMs is too short');
  }
  const tokenBytes = tokenFactory(DEFAULT_TOKEN_BYTES);
  if (!Buffer.isBuffer(tokenBytes) || tokenBytes.byteLength < MINIMUM_TOKEN_BYTES) {
    throw new ValidationError('Faculty invitation tokens require at least 128 bits of randomness');
  }
  const rawToken = tokenBytes.toString('base64url');
  const created = new Date(toIso(now, 'now'));
  const expiry = new Date(toIso(expiresAt, 'expiresAt'));
  if (expiry.valueOf() <= created.valueOf()) {
    throw new ValidationError('Faculty invitation expiry must be in the future');
  }
  const invitation = deepFreeze({
    schemaVersion: 'missionmed.lor.faculty-invitation.v1',
    id: id ?? makeId('invite', idFactory),
    caseId,
    tokenHash: sha256(rawToken),
    recipientEmailHash: hashFacultyEmail(recipientEmail),
    createdAt: created.toISOString(),
    expiresAt: expiry.toISOString(),
    revokedAt: null,
    usedAt: null,
    verifiedFacultyId: null,
    failedAttempts: 0,
    attemptWindowStartedAt: null,
    lockedUntil: null,
    maxAttempts,
    attemptWindowMs,
    lockoutMs,
    lastFailureCode: null,
    revision: 0,
  });
  return deepFreeze({ rawToken, invitation });
}

export function revokeFacultyInvitation(invitation, { now = new Date() } = {}) {
  assertInvitation(invitation);
  if (invitation.usedAt) throw new DomainInvariantError('Used invitations cannot be revoked retroactively');
  if (invitation.revokedAt) return cloneFrozen(invitation);
  return deepFreeze({
    ...structuredClone(invitation),
    revokedAt: toIso(now, 'now'),
    revision: invitation.revision + 1,
  });
}

function terminalReason(invitation, now) {
  if (invitation.revokedAt) return 'INVITATION_REVOKED';
  if (invitation.usedAt) return 'INVITATION_ALREADY_USED';
  if (new Date(now).valueOf() >= new Date(invitation.expiresAt).valueOf()) return 'INVITATION_EXPIRED';
  if (invitation.lockedUntil && new Date(now).valueOf() < new Date(invitation.lockedUntil).valueOf()) {
    return 'INVITATION_LOCKED';
  }
  return null;
}

function nextFailureState(invitation, failureCode, now) {
  const timestamp = new Date(now);
  const windowStart = invitation.attemptWindowStartedAt
    ? new Date(invitation.attemptWindowStartedAt)
    : null;
  const withinWindow =
    windowStart && timestamp.valueOf() - windowStart.valueOf() < invitation.attemptWindowMs;
  const failedAttempts = withinWindow ? invitation.failedAttempts + 1 : 1;
  const lockedUntil =
    failedAttempts >= invitation.maxAttempts
      ? new Date(timestamp.valueOf() + invitation.lockoutMs).toISOString()
      : null;
  return deepFreeze({
    ...structuredClone(invitation),
    failedAttempts,
    attemptWindowStartedAt: withinWindow ? invitation.attemptWindowStartedAt : timestamp.toISOString(),
    lockedUntil,
    lastFailureCode: failureCode,
    revision: invitation.revision + 1,
  });
}

function boundVerifiedPrincipal(invitation, otpProof, now) {
  if (
    !otpProof ||
    otpProof.schemaVersion !== 'missionmed.lor.otp-proof.v1' ||
    otpProof.verified !== true ||
    otpProof.invitationId !== invitation.id ||
    !hashesEqual(
      invitation.recipientEmailHash,
      Buffer.from(otpProof.recipientEmailHash ?? '', 'hex'),
    ) ||
    typeof otpProof.principalId !== 'string' ||
    otpProof.principalId.trim() === '' ||
    !/^[a-f0-9]{64}$/u.test(otpProof.proofId ?? '')
  ) {
    return null;
  }
  const verifiedAt = new Date(otpProof.verifiedAt);
  if (
    Number.isNaN(verifiedAt.valueOf()) ||
    verifiedAt.valueOf() < new Date(invitation.createdAt).valueOf() ||
    verifiedAt.valueOf() > new Date(now).valueOf() ||
    verifiedAt.valueOf() >= new Date(invitation.expiresAt).valueOf()
  ) {
    return null;
  }
  return otpProof.principalId;
}

export function evaluateFacultyInvitationAttempt(invitation, {
  rawToken,
  recipientEmail,
  otpProof = null,
  now = new Date(),
}) {
  assertInvitation(invitation);
  const timestamp = new Date(toIso(now, 'now'));
  const terminal = terminalReason(invitation, timestamp);
  if (terminal) {
    return deepFreeze({ verified: false, reasonCode: terminal, changed: false, invitation: cloneFrozen(invitation) });
  }
  let failureCode = null;
  let verifiedPrincipalId = null;
  if (typeof rawToken !== 'string' || !hashesEqual(invitation.tokenHash, tokenDigest(rawToken))) {
    failureCode = 'TOKEN_MISMATCH';
  } else {
    let presentedEmailHash;
    try {
      presentedEmailHash = hashFacultyEmail(recipientEmail);
    } catch {
      presentedEmailHash = null;
    }
    if (
      !presentedEmailHash ||
      !hashesEqual(invitation.recipientEmailHash, Buffer.from(presentedEmailHash, 'hex'))
    ) {
      failureCode = 'RECIPIENT_MISMATCH';
    } else if (!(verifiedPrincipalId = boundVerifiedPrincipal(invitation, otpProof, timestamp))) {
      failureCode = 'OTP_NOT_VERIFIED';
    }
  }
  if (failureCode) {
    const next = nextFailureState(invitation, failureCode, timestamp);
    return deepFreeze({ verified: false, reasonCode: failureCode, changed: true, invitation: next });
  }
  assertNonEmptyString(verifiedPrincipalId, 'verifiedPrincipalId');
  const next = deepFreeze({
    ...structuredClone(invitation),
    usedAt: timestamp.toISOString(),
    verifiedFacultyId: verifiedPrincipalId,
    failedAttempts: 0,
    lockedUntil: null,
    lastFailureCode: null,
    revision: invitation.revision + 1,
  });
  return deepFreeze({ verified: true, reasonCode: null, changed: true, invitation: next });
}

export class FacultyInvitationVerificationService {
  constructor({ repository, otpPort, clock = () => new Date() }) {
    this.repository = assertPort(repository, ['getById', 'save'], 'faculty invitation repository');
    this.otpPort = assertPort(otpPort, ['verify'], 'otpPort');
    this.clock = clock;
  }

  async verify(request) {
    if ('facultyId' in request || 'principalId' in request) {
      throw new ValidationError('Faculty principal must come from the bound OTP provider proof');
    }
    const {
      invitationId,
      rawToken,
      recipientEmail,
      otpChallengeId,
      otpCode,
    } = request;
    const invitation = await this.repository.getById(invitationId);
    const now = this.clock();
    const terminal = terminalReason(invitation, now);
    if (terminal) throw new InvitationDeniedError(terminal);

    const tokenMatches =
      typeof rawToken === 'string' && hashesEqual(invitation.tokenHash, tokenDigest(rawToken));
    let recipientMatches = false;
    try {
      recipientMatches = hashesEqual(
        invitation.recipientEmailHash,
        Buffer.from(hashFacultyEmail(recipientEmail), 'hex'),
      );
    } catch {
      recipientMatches = false;
    }
    let otpProof = null;
    if (tokenMatches && recipientMatches) {
      otpProof = await this.otpPort.verify({
        challengeId: otpChallengeId,
        code: otpCode,
        recipientEmailHash: invitation.recipientEmailHash,
        invitationId,
      });
    }
    const outcome = evaluateFacultyInvitationAttempt(invitation, {
      rawToken,
      recipientEmail,
      otpProof,
      now,
    });
    if (outcome.changed) {
      await this.repository.save(outcome.invitation, { expectedRevision: invitation.revision });
    }
    if (!outcome.verified) throw new InvitationDeniedError(outcome.reasonCode);
    return outcome;
  }
}
