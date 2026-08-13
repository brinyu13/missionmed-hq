import { InvitationDeniedError, ValidationError } from '../domain/errors.js';
import { assertPort } from './ports.js';

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
  }

  /** @param {Record<string, unknown>} [input] */
  async verify(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ValidationError('Faculty verification input must be an object');
    }
    const allowedKeys = new Set([
      'idempotencyKey',
      'otpCode',
      'rawToken',
      'recipientEmail',
    ]);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      throw new ValidationError('Invitation, challenge, case, role, purpose, principal, and session state are server-resolved');
    }
    const result = await this.repository.verifyAndCommit(input);
    if (result.verified !== true) {
      throw new InvitationDeniedError();
    }
    return result;
  }
}

export const DURABLE_FACULTY_VERIFICATION_SERVICE_CONTRACT = Object.freeze({
  clientAcceptedFields: Object.freeze([
    'idempotencyKey',
    'otpCode',
    'rawToken',
    'recipientEmail',
  ]),
  serverResolvedFields: Object.freeze([
    'authenticatedSubject',
    'caseId',
    'actorRole',
    'purpose',
    'invitationId',
    'challengeId',
    'verifiedPrincipalId',
  ]),
  productionFallback: 'none',
  privateSessionIssued: false,
  privateEditGranted: false,
});
