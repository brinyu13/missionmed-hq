export class LorDomainError extends Error {
  constructor(message, { code = 'LOR_DOMAIN_ERROR', details = undefined } = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class DomainInvariantError extends LorDomainError {
  constructor(message, details) {
    super(message, { code: 'DOMAIN_INVARIANT', details });
  }
}

export class ValidationError extends LorDomainError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_FAILED', details });
  }
}

export class NotFoundError extends LorDomainError {
  constructor(resourceType, resourceId) {
    super(`${resourceType} not found`, {
      code: 'NOT_FOUND',
      details: { resourceType, resourceId },
    });
  }
}

export class StaleRevisionError extends LorDomainError {
  constructor({ caseId, expectedRevision, actualRevision }) {
    super('The recommendation case changed after it was loaded', {
      code: 'STALE_REVISION',
      details: { caseId, expectedRevision, actualRevision },
    });
  }
}

export class IdempotencyConflictError extends LorDomainError {
  constructor({ idempotencyKey }) {
    super('The idempotency key was already used for a different request', {
      code: 'IDEMPOTENCY_CONFLICT',
      details: { idempotencyKey },
    });
  }
}

export class AuthorizationDeniedError extends LorDomainError {
  constructor(reasonCode = 'DENIED') {
    super('Access denied', {
      code: 'AUTHORIZATION_DENIED',
      details: { reasonCode },
    });
  }
}

export class IntegrationDisabledError extends LorDomainError {
  constructor(integration, status = 'DISABLED_FAIL_CLOSED') {
    super(`${integration} integration is unavailable`, {
      code: 'INTEGRATION_DISABLED',
      details: { integration, status },
    });
  }
}

export class InvitationDeniedError extends LorDomainError {
  constructor(reasonCode = 'INVITATION_DENIED') {
    super('Faculty invitation verification denied', {
      code: 'INVITATION_DENIED',
      details: { reasonCode },
    });
  }
}
