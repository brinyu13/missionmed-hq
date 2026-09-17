import { InvitationDeniedError, ValidationError } from '../domain/errors.js';
import { assertPort } from './ports.js';

const AUTHENTIC_DURABLE_FACULTY_INVITATION_VERIFICATION_SERVICES = new WeakSet();

export class DurableFacultyInvitationVerificationService {
  /** @param {{repository?: Record<string, any>}} [options] */
  constructor({ repository } = {}) {
    if (
      repository?.isDurable !== true
      || repository?.atomicOtpInvitationAndAudit !== true
    ) {
      throw new TypeError('Faculty verification requires durable atomic OTP, invitation, and audit persistence');
    }
    this.repository = assertPort(repository, ['verifyAndCommit'], 'faculty invitation repository');
    Object.freeze(this);
    AUTHENTIC_DURABLE_FACULTY_INVITATION_VERIFICATION_SERVICES.add(this);
  }

  /** @param {Record<string, unknown>} [input] */
  async verify(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ValidationError('Faculty verification input must be an object');
    }
    const allowedKeys = new Set([
      'actor',
      'idempotencyKey',
      'invitationId',
      'otpCode',
      'recipientEmail',
    ]);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      throw new ValidationError('Challenge, case, purpose, principal, and session state are server-resolved');
    }
    const actor = /** @type {{id?: unknown, role?: unknown} | null} */ (
      input.actor && typeof input.actor === 'object' && !Array.isArray(input.actor)
        ? input.actor
        : null
    );
    if (
      !actor
      || Object.keys(actor).length !== 2
      || actor.role !== 'faculty'
      || typeof actor.id !== 'string'
      || !/^wp:[1-9][0-9]*$/u.test(actor.id)
    ) throw new InvitationDeniedError();
    const result = await this.repository.verifyAndCommit({
      actorId: actor.id,
      idempotencyKey: input.idempotencyKey,
      invitationId: input.invitationId,
      otpCode: input.otpCode,
      recipientEmail: input.recipientEmail,
    });
    if (result.verified !== true) {
      throw new InvitationDeniedError();
    }
    return result;
  }
}

Object.freeze(DurableFacultyInvitationVerificationService.prototype);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAuthenticDurableFacultyInvitationVerificationService(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  try {
    return AUTHENTIC_DURABLE_FACULTY_INVITATION_VERIFICATION_SERVICES.has(value)
      && Object.getPrototypeOf(value) === DurableFacultyInvitationVerificationService.prototype;
  } catch {
    return false;
  }
}

export const DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT = Object.freeze({
  clientAcceptedFields: Object.freeze([
    'otpCode',
    'recipientEmail',
  ]),
  serverResolvedFields: Object.freeze([
    'authenticatedSubject',
    'idempotencyKey',
    'caseId',
    'actorRole',
    'purpose',
    'challengeId',
    'verifiedPrincipalId',
    'candidateTokenHash',
  ]),
  pathBoundFields: Object.freeze(['invitationId']),
  productionFallback: 'none',
  privateSessionIssued: false,
  privateEditGranted: 'only_after_atomic_database_commit',
});
