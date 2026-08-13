import {
  IdempotencyConflictError,
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { hashFacultyEmail } from '../security/faculty-invitations.js';
import { validateMetadataServiceEvent } from '../services/metadata-events.js';
import { FacultyInvitationRepositoryPort } from '../services/ports.js';

const RANKLISTIQ_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const LOR_STAGING_BRANCH_ID = 'mftguikkftmrxjxrkdln';
const LOR_STAGING_BRANCH = 'lor-staging';
const RANKLISTIQ_MAIN_BRANCH = 'main';
const LOR_SCHEMA = 'lor_studio';
const FACULTY_PURPOSE = 'faculty_private_edit';
const VERIFIED_CONTEXT_SCHEMA = 'missionmed.lor.verified-faculty-context.v1';
const SCOPE_SCHEMA = 'missionmed.lor.faculty-verification-scope.v1';
const DRIVER_BINDING_SCHEMA = 'missionmed.lor.faculty-verification-driver-binding.v1';
const ATOMIC_RECEIPT_SCHEMA = 'missionmed.lor.atomic-faculty-verification-receipt.v1';
const DATABASE_TIME_SCHEMA = 'missionmed.lor.database-transaction-time.v1';
const ATTEMPT_STATE_SCHEMA = 'missionmed.lor.faculty-attempt-state.v1';
const SAFE_RESULT_SCHEMA = 'missionmed.lor.faculty-verification-result.v1';
const OPERATION = 'verify_faculty_invitation';
const AUDIT_ACTOR_ID = 'service:faculty-verification';
const DENIAL_REASONS = new Set([
  'INVITATION_ALREADY_USED',
  'INVITATION_EXPIRED',
  'INVITATION_LOCKED',
  'INVITATION_REVOKED',
  'OTP_NOT_VERIFIED',
  'RECIPIENT_MISMATCH',
  'TOKEN_MISMATCH',
]);
const RETRYABLE_DENIAL_REASONS = new Set([
  'OTP_NOT_VERIFIED',
  'RECIPIENT_MISMATCH',
  'TOKEN_MISMATCH',
]);
const TERMINAL_DENIAL_REASONS = new Set([
  'INVITATION_ALREADY_USED',
  'INVITATION_EXPIRED',
  'INVITATION_LOCKED',
  'INVITATION_REVOKED',
]);
const CANONICAL_WP_SUBJECT = /^wp:[1-9][0-9]*$/u;
const FORBIDDEN_RECEIPT_KEYS = new Set([
  'content',
  'objectKey',
  'objectLocator',
  'otpCode',
  'providerPayload',
  'rawToken',
  'recipientEmail',
  'sessionSecret',
  'sessionToken',
]);
const VERIFIED_CONTEXT_KEYS = new Set([
  'actorRole',
  'authenticated',
  'authenticatedSubject',
  'authoritySource',
  'bindingRef',
  'caseId',
  'clientAsserted',
  'operation',
  'purpose',
  'roleVerified',
  'schemaVersion',
]);
const SCOPE_KEYS = new Set([
  'actorRole',
  'authenticatedSubject',
  'authoritySource',
  'bindingRef',
  'caseId',
  'challengeId',
  'clientAsserted',
  'invitationId',
  'operation',
  'purpose',
  'recipientEmailHash',
  'schemaVersion',
]);
const INVITATION_KEYS = new Set([
  'attemptWindowMs',
  'attemptWindowStartedAt',
  'caseId',
  'createdAt',
  'expiresAt',
  'failedAttempts',
  'id',
  'lastFailureCode',
  'lockedUntil',
  'lockoutMs',
  'maxAttempts',
  'recipientEmailHash',
  'revision',
  'revokedAt',
  'schemaVersion',
  'tokenHash',
  'usedAt',
  'verifiedFacultyId',
]);
const DRIVER_BINDING_KEYS = new Set([
  'actorRole',
  'authenticatedSubject',
  'authoritySource',
  'caseId',
  'challengeRef',
  'contextBindingRef',
  'invitationId',
  'operation',
  'otpExpiresAt',
  'otpProofRef',
  'otpRevoked',
  'otpVerifiedAt',
  'principalAuthority',
  'purpose',
  'recipientEmailHash',
  'schemaVersion',
  'verifiedPrincipalId',
]);
const DATABASE_TIME_KEYS = new Set([
  'schemaVersion',
  'source',
  'transactionTimestamp',
]);
const ATTEMPT_STATE_KEYS = new Set([
  'attemptWindowStartedAt',
  'failedAttempts',
  'lastFailureCode',
  'lockedUntil',
  'revision',
  'revokedAt',
  'schemaVersion',
  'usedAt',
  'verifiedFacultyId',
]);
const ATOMIC_RECEIPT_KEYS = new Set([
  'auditCommitted',
  'auditEventRef',
  'authorizationBinding',
  'caseId',
  'challengeConsumed',
  'committed',
  'databaseTime',
  'durable',
  'event',
  'eventHash',
  'idempotencyKey',
  'invitation',
  'invitationId',
  'invitationStateCommitted',
  'otpChallengeCommitted',
  'privateSessionIssued',
  'priorAttemptState',
  'purpose',
  'reasonCode',
  'recordHash',
  'replayed',
  'requestHash',
  'sameTransaction',
  'schemaVersion',
  'nextAttemptState',
  'transactionRef',
  'verified',
]);

/**
 * @typedef {object} AtomicFacultyVerificationDriver
 * @property {boolean} [atomicInvitationOtpAndAudit]
 * @property {boolean} [databaseClock]
 * @property {boolean} [rlsEnforced]
 * @property {boolean} [serverOnly]
 * @property {(command: Record<string, any>) => Promise<any>} executeAtomicFacultyVerification
 */

/**
 * @typedef {object} DurableFacultyRepositoryOptions
 * @property {Record<string, any> | null} [binding]
 * @property {AtomicFacultyVerificationDriver | null} [driver]
 * @property {((request: {bindingRef: string, operation: string, purpose: string}) => Promise<any>) | null} [scopeProvider]
 * @property {(() => Promise<any>) | null} [verifiedContextProvider]
 */

/**
 * @typedef {object} FacultyVerificationRequest
 * @property {unknown} [idempotencyKey]
 * @property {unknown} [otpCode]
 * @property {unknown} [rawToken]
 * @property {unknown} [recipientEmail]
 */

function assertSha256(value, fieldName) {
  if (!/^[a-f0-9]{64}$/u.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`);
  }
}

function assertCanonicalIso(value, fieldName) {
  if (typeof value !== 'string' || toIso(value, fieldName) !== value) {
    throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`);
  }
  return value;
}

function assertCanonicalWpSubject(value, fieldName) {
  if (typeof value !== 'string' || !CANONICAL_WP_SUBJECT.test(value)) {
    throw new IntegrationDisabledError('lor_faculty_repository', `${fieldName}_CANONICAL_WP_SUBJECT_REQUIRED`);
  }
  return value;
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.health !== 'ready'
    || binding.environmentBound !== true
    || binding.schema !== LOR_SCHEMA
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'RESOURCE_BINDING_REQUIRED');
  }
  const staging = binding.environment === 'staging'
    && binding.projectRef === LOR_STAGING_BRANCH_ID
    && binding.parentProjectRef === RANKLISTIQ_PROJECT_REF
    && binding.branchName === LOR_STAGING_BRANCH
    && binding.branchId === LOR_STAGING_BRANCH_ID
    && binding.dataCopied === false;
  const production = binding.environment === 'production'
    && binding.projectRef === RANKLISTIQ_PROJECT_REF
    && binding.branchName === RANKLISTIQ_MAIN_BRANCH
    && binding.branchId === RANKLISTIQ_PROJECT_REF
    && binding.productionDataBindingPassed === true;
  if (!staging && !production) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'ENVIRONMENT_TARGET_BINDING_REQUIRED');
  }
  return deepFreeze({
    environment: binding.environment,
    projectRef: binding.projectRef,
    parentProjectRef: staging ? binding.parentProjectRef : null,
    branchName: binding.branchName,
    branchId: binding.branchId,
    schema: binding.schema,
  });
}

function assertDriver(driver) {
  if (
    !driver
    || driver.atomicInvitationOtpAndAudit !== true
    || driver.databaseClock !== true
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || typeof driver.executeAtomicFacultyVerification !== 'function'
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_FACULTY_DRIVER_REQUIRED');
  }
  return driver;
}

function assertVerifiedContext(rawContext) {
  if (
    !rawContext
    || !hasExactKeys(rawContext, VERIFIED_CONTEXT_KEYS)
    || rawContext.schemaVersion !== VERIFIED_CONTEXT_SCHEMA
    || rawContext.authoritySource !== 'server_verified_wordpress_session_crosswalk'
    || rawContext.authenticated !== true
    || rawContext.roleVerified !== true
    || rawContext.clientAsserted !== false
    || rawContext.actorRole !== 'faculty'
    || rawContext.operation !== OPERATION
    || rawContext.purpose !== FACULTY_PURPOSE
  ) {
    throw new IntegrationDisabledError('lor_faculty_context', 'VERIFIED_FACULTY_CONTEXT_REQUIRED');
  }
  assertCanonicalWpSubject(rawContext.authenticatedSubject, 'AUTHENTICATED_FACULTY_SUBJECT');
  assertNonEmptyString(rawContext.caseId, 'context.caseId', { maxLength: 200 });
  assertSha256(rawContext.bindingRef, 'context.bindingRef');
  return deepFreeze({
    schemaVersion: VERIFIED_CONTEXT_SCHEMA,
    authoritySource: rawContext.authoritySource,
    authenticated: true,
    roleVerified: true,
    clientAsserted: false,
    actorRole: 'faculty',
    authenticatedSubject: rawContext.authenticatedSubject,
    caseId: rawContext.caseId,
    operation: OPERATION,
    purpose: FACULTY_PURPOSE,
    bindingRef: rawContext.bindingRef,
  });
}

function assertScope(rawScope, context) {
  if (
    !rawScope
    || !hasExactKeys(rawScope, SCOPE_KEYS)
    || rawScope.schemaVersion !== SCOPE_SCHEMA
    || rawScope.authoritySource !== 'server_resolved_faculty_invitation_challenge'
    || rawScope.clientAsserted !== false
    || rawScope.operation !== OPERATION
    || rawScope.actorRole !== 'faculty'
    || rawScope.purpose !== FACULTY_PURPOSE
    || rawScope.authenticatedSubject !== context.authenticatedSubject
    || rawScope.caseId !== context.caseId
    || rawScope.bindingRef !== context.bindingRef
  ) {
    throw new IntegrationDisabledError('lor_faculty_scope', 'VERIFIED_INVITATION_SCOPE_REQUIRED');
  }
  assertNonEmptyString(rawScope.caseId, 'scope.caseId', { maxLength: 200 });
  assertNonEmptyString(rawScope.invitationId, 'scope.invitationId', { maxLength: 200 });
  assertNonEmptyString(rawScope.challengeId, 'scope.challengeId', { maxLength: 200 });
  assertSha256(rawScope.recipientEmailHash, 'scope.recipientEmailHash');
  return deepFreeze({
    schemaVersion: SCOPE_SCHEMA,
    authoritySource: rawScope.authoritySource,
    clientAsserted: false,
    actorRole: 'faculty',
    authenticatedSubject: rawScope.authenticatedSubject,
    caseId: rawScope.caseId,
    invitationId: rawScope.invitationId,
    challengeId: rawScope.challengeId,
    recipientEmailHash: rawScope.recipientEmailHash,
    operation: OPERATION,
    purpose: FACULTY_PURPOSE,
    bindingRef: rawScope.bindingRef,
  });
}

function metadataRef(namespace, value) {
  return `${namespace}_${sha256(`lor-studio:${namespace}:${value}`)}`;
}

function facultyRefForCanonicalSubject(subject) {
  return metadataRef('faculty', assertCanonicalWpSubject(subject, 'FACULTY_REF'));
}

function buildAuditBindings(scope, idempotencyKey) {
  const correlationId = `faculty-verification:${scope.invitationId}:${idempotencyKey}`;
  return deepFreeze({
    actorRef: metadataRef('actor', AUDIT_ACTOR_ID),
    caseRef: metadataRef('case', scope.caseId),
    correlationRef: metadataRef('correlation', correlationId),
    deniedEventRef: metadataRef('event', `${correlationId}:denied`),
    successEventRef: metadataRef('event', `${correlationId}:success`),
  });
}

function assertInvitationRecord(record, scope) {
  if (
    !record
    || !hasExactKeys(record, INVITATION_KEYS)
    || record.schemaVersion !== 'missionmed.lor.faculty-invitation.v1'
    || record.id !== scope.invitationId
    || record.caseId !== scope.caseId
    || record.recipientEmailHash !== scope.recipientEmailHash
    || !Number.isSafeInteger(record.revision)
    || record.revision < 0
    || !Number.isSafeInteger(record.failedAttempts)
    || record.failedAttempts < 0
    || !Number.isSafeInteger(record.maxAttempts)
    || record.maxAttempts < 1
    || record.maxAttempts > 20
    || record.failedAttempts > record.maxAttempts
    || !Number.isSafeInteger(record.attemptWindowMs)
    || record.attemptWindowMs < 1_000
    || !Number.isSafeInteger(record.lockoutMs)
    || record.lockoutMs < 1_000
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'INVITATION_RECORD_BINDING_INVALID');
  }
  assertSha256(record.tokenHash, 'invitation.tokenHash');
  const createdAt = assertCanonicalIso(record.createdAt, 'invitation.createdAt');
  const expiresAt = assertCanonicalIso(record.expiresAt, 'invitation.expiresAt');
  if (Date.parse(createdAt) >= Date.parse(expiresAt)) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'INVITATION_TIME_WINDOW_INVALID');
  }
  for (const [fieldName, value] of [
    ['invitation.revokedAt', record.revokedAt],
    ['invitation.usedAt', record.usedAt],
    ['invitation.attemptWindowStartedAt', record.attemptWindowStartedAt],
    ['invitation.lockedUntil', record.lockedUntil],
  ]) {
    if (value !== null) assertCanonicalIso(value, fieldName);
  }
  if (record.verifiedFacultyId !== null) {
    assertCanonicalWpSubject(record.verifiedFacultyId, 'INVITATION_FACULTY_ID');
  }
  if (
    (record.usedAt === null) !== (record.verifiedFacultyId === null)
    || (record.usedAt !== null && record.revokedAt !== null)
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'INVITATION_PRINCIPAL_STATE_INVALID');
  }
  return record;
}

function assertDriverAuthorizationBinding(binding, scope, result) {
  if (
    !binding
    || !hasExactKeys(binding, DRIVER_BINDING_KEYS)
    || binding.schemaVersion !== DRIVER_BINDING_SCHEMA
    || binding.authoritySource !== 'atomic_durable_otp_invitation_transaction'
    || binding.actorRole !== 'faculty'
    || binding.authenticatedSubject !== scope.authenticatedSubject
    || binding.caseId !== scope.caseId
    || binding.invitationId !== scope.invitationId
    || binding.challengeRef !== sha256(`lor-studio:challenge:${scope.challengeId}`)
    || binding.contextBindingRef !== scope.bindingRef
    || binding.recipientEmailHash !== scope.recipientEmailHash
    || binding.operation !== scope.operation
    || binding.purpose !== scope.purpose
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'DRIVER_AUTHORIZATION_BINDING_INVALID');
  }
  if (result.verified === true) {
    assertCanonicalWpSubject(binding.verifiedPrincipalId, 'VERIFIED_PRINCIPAL_ID');
    assertSha256(binding.otpProofRef, 'otpProofRef');
    const otpVerifiedAt = assertCanonicalIso(binding.otpVerifiedAt, 'otpVerifiedAt');
    const otpExpiresAt = assertCanonicalIso(binding.otpExpiresAt, 'otpExpiresAt');
    if (
      binding.principalAuthority !== 'durable_otp_provider_proof'
      || binding.otpRevoked !== false
      || Date.parse(otpVerifiedAt) >= Date.parse(otpExpiresAt)
    ) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'OTP_PRINCIPAL_AUTHORITY_INVALID');
    }
  } else if (
    binding.verifiedPrincipalId !== null
    || binding.otpProofRef !== null
    || binding.otpVerifiedAt !== null
    || binding.otpExpiresAt !== null
    || binding.otpRevoked !== null
    || binding.principalAuthority !== null
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'DENIED_PRINCIPAL_BINDING_INVALID');
  }
}

function assertDatabaseTime(evidence) {
  if (
    !hasExactKeys(evidence, DATABASE_TIME_KEYS)
    || evidence.schemaVersion !== DATABASE_TIME_SCHEMA
    || evidence.source !== 'database_transaction_timestamp'
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'DATABASE_TIME_EVIDENCE_INVALID');
  }
  const transactionTimestamp = assertCanonicalIso(
    evidence.transactionTimestamp,
    'database transactionTimestamp',
  );
  return { iso: transactionTimestamp, milliseconds: Date.parse(transactionTimestamp) };
}

function assertAttemptState(state, fieldName) {
  if (
    !hasExactKeys(state, ATTEMPT_STATE_KEYS)
    || state.schemaVersion !== ATTEMPT_STATE_SCHEMA
    || !Number.isSafeInteger(state.revision)
    || state.revision < 0
    || !Number.isSafeInteger(state.failedAttempts)
    || state.failedAttempts < 0
    || (state.lastFailureCode !== null && !RETRYABLE_DENIAL_REASONS.has(state.lastFailureCode))
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', `${fieldName}_INVALID`);
  }
  for (const [timestampField, value] of [
    ['attemptWindowStartedAt', state.attemptWindowStartedAt],
    ['lockedUntil', state.lockedUntil],
    ['revokedAt', state.revokedAt],
    ['usedAt', state.usedAt],
  ]) {
    if (value !== null) assertCanonicalIso(value, `${fieldName}.${timestampField}`);
  }
  if (
    (state.failedAttempts === 0 && (
      state.attemptWindowStartedAt !== null
      || state.lockedUntil !== null
      || state.lastFailureCode !== null
    ))
    || (state.failedAttempts > 0 && (
      state.attemptWindowStartedAt === null
      || state.lastFailureCode === null
    ))
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', `${fieldName}_INCONSISTENT`);
  }
  if (state.verifiedFacultyId !== null) {
    assertCanonicalWpSubject(state.verifiedFacultyId, `${fieldName}_FACULTY_ID`);
  }
  if (
    (state.usedAt === null) !== (state.verifiedFacultyId === null)
    || (state.usedAt !== null && state.revokedAt !== null)
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', `${fieldName}_PRINCIPAL_STATE_INVALID`);
  }
  return state;
}

function attemptStateFromRecord(record) {
  return {
    schemaVersion: ATTEMPT_STATE_SCHEMA,
    revision: record.revision,
    failedAttempts: record.failedAttempts,
    attemptWindowStartedAt: record.attemptWindowStartedAt,
    lockedUntil: record.lockedUntil,
    lastFailureCode: record.lastFailureCode,
    revokedAt: record.revokedAt,
    usedAt: record.usedAt,
    verifiedFacultyId: record.verifiedFacultyId,
  };
}

function expectedTerminalReason(record, priorAttemptState, databaseNow) {
  if (priorAttemptState.revokedAt !== null) return 'INVITATION_REVOKED';
  if (priorAttemptState.usedAt !== null) return 'INVITATION_ALREADY_USED';
  if (databaseNow >= Date.parse(record.expiresAt)) return 'INVITATION_EXPIRED';
  if (
    priorAttemptState.lockedUntil !== null
    && databaseNow < Date.parse(priorAttemptState.lockedUntil)
  ) {
    return 'INVITATION_LOCKED';
  }
  return null;
}

function assertAttemptTransition(result, record, command, databaseTime) {
  const prior = assertAttemptState(result.priorAttemptState, 'PRIOR_ATTEMPT_STATE');
  const next = assertAttemptState(result.nextAttemptState, 'NEXT_ATTEMPT_STATE');
  if (
    prior.failedAttempts > record.maxAttempts
    || next.failedAttempts > record.maxAttempts
    || ((prior.failedAttempts === record.maxAttempts) !== (prior.lockedUntil !== null))
    || ((next.failedAttempts === record.maxAttempts) !== (next.lockedUntil !== null))
    || hashValue(next) !== hashValue(attemptStateFromRecord(record))
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'ATTEMPT_STATE_RECORD_BINDING_INVALID');
  }
  const databaseNow = databaseTime.milliseconds;
  const invitationCreatedAt = Date.parse(record.createdAt);
  if (databaseNow < invitationCreatedAt) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'DATABASE_TIME_PRECEDES_INVITATION');
  }
  const priorWindowStartedAt = prior.attemptWindowStartedAt === null
    ? null
    : Date.parse(prior.attemptWindowStartedAt);
  const priorLockedUntil = prior.lockedUntil === null
    ? null
    : Date.parse(prior.lockedUntil);
  if (
    (priorWindowStartedAt !== null && (
      priorWindowStartedAt < invitationCreatedAt
      || priorWindowStartedAt > databaseNow
    ))
    || (priorLockedUntil !== null && (
      priorWindowStartedAt === null
      || priorLockedUntil <= priorWindowStartedAt
    ))
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'PRIOR_ATTEMPT_CHRONOLOGY_INVALID');
  }
  const terminalReason = expectedTerminalReason(record, prior, databaseNow);
  if (result.verified === true) {
    if (
      terminalReason !== null
      || next.revision !== prior.revision + 1
      || next.failedAttempts !== 0
      || next.attemptWindowStartedAt !== null
      || next.lockedUntil !== null
      || next.lastFailureCode !== null
      || next.revokedAt !== null
      || next.usedAt !== databaseTime.iso
      || next.verifiedFacultyId !== result.authorizationBinding.verifiedPrincipalId
    ) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'VERIFIED_ATTEMPT_TRANSITION_INVALID');
    }
    return;
  }
  if (TERMINAL_DENIAL_REASONS.has(result.reasonCode)) {
    if (
      result.reasonCode !== terminalReason
      || hashValue(next) !== hashValue(prior)
    ) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'TERMINAL_DENIAL_TRANSITION_INVALID');
    }
    return;
  }
  let expectedRetryableReason = 'OTP_NOT_VERIFIED';
  if (command.presentedTokenHash !== record.tokenHash) expectedRetryableReason = 'TOKEN_MISMATCH';
  else if (command.presentedRecipientEmailHash !== record.recipientEmailHash) {
    expectedRetryableReason = 'RECIPIENT_MISMATCH';
  }
  if (
    terminalReason !== null
    || result.reasonCode !== expectedRetryableReason
    || next.revision !== prior.revision + 1
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'RETRYABLE_DENIAL_TRANSITION_INVALID');
  }
  const withinWindow = priorWindowStartedAt !== null
    && databaseNow - priorWindowStartedAt < record.attemptWindowMs;
  const expectedFailedAttempts = withinWindow
    ? Math.min(prior.failedAttempts + 1, record.maxAttempts)
    : 1;
  const expectedWindowStartedAt = withinWindow
    ? prior.attemptWindowStartedAt
    : databaseTime.iso;
  const expectedLockedUntil = expectedFailedAttempts >= record.maxAttempts
    ? new Date(databaseNow + record.lockoutMs).toISOString()
    : null;
  if (
    next.failedAttempts !== expectedFailedAttempts
    || next.attemptWindowStartedAt !== expectedWindowStartedAt
    || next.lockedUntil !== expectedLockedUntil
    || next.lastFailureCode !== result.reasonCode
    || next.revokedAt !== prior.revokedAt
    || next.usedAt !== prior.usedAt
    || next.verifiedFacultyId !== prior.verifiedFacultyId
    || record.usedAt !== null
    || record.verifiedFacultyId !== null
    || record.revokedAt !== null
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'RETRYABLE_DENIAL_STATE_INVALID');
  }
}

function assertAuditEvent(event, result, record, auditBindings, databaseTime) {
  validateMetadataServiceEvent(event);
  const successful = result.verified === true;
  if (
    event.eventRef !== (successful ? auditBindings.successEventRef : auditBindings.deniedEventRef)
    || event.eventType !== (successful ? 'faculty.verified' : 'faculty.verification_denied')
    || event.caseRef !== auditBindings.caseRef
    || event.actorRef !== auditBindings.actorRef
    || event.actorRole !== 'service'
    || event.correlationRef !== auditBindings.correlationRef
    || event.outcome !== (successful ? 'success' : 'denied')
    || event.revision !== record.revision
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_AUDIT_BINDING_INVALID');
  }
  const occurredAt = assertCanonicalIso(event.occurredAt, 'audit occurredAt');
  if (
    occurredAt !== databaseTime.iso
    || (successful && record.usedAt !== occurredAt)
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'VERIFICATION_TIME_BINDING_INVALID');
  }
}

function assertNoForbiddenReceiptKeys(value, depth = 0) {
  if (depth > 8 || value == null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RECEIPT_KEYS.has(key)) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'RAW_SECRET_RECEIPT_REJECTED');
    }
    assertNoForbiddenReceiptKeys(child, depth + 1);
  }
}

function assertNoRawInputEcho(result, values) {
  let serialized;
  try {
    serialized = JSON.stringify(result);
  } catch {
    throw new IntegrationDisabledError('lor_faculty_repository', 'UNSERIALIZABLE_RECEIPT_REJECTED');
  }
  for (const value of values) {
    if (typeof value === 'string' && value.length >= 4 && serialized.includes(value)) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'RAW_INPUT_RECEIPT_REJECTED');
    }
  }
}

function throwDriverFailure(result, idempotencyKey) {
  if (result?.errorCode === 'IDEMPOTENCY_CONFLICT') {
    throw new IdempotencyConflictError({
      idempotencyKey: metadataRef('idempotency', idempotencyKey),
    });
  }
  throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_VERIFICATION_UNPROVEN');
}

function validateAtomicReceipt(result, command, rawInputs) {
  if (
    !result
    || !hasExactKeys(result, ATOMIC_RECEIPT_KEYS)
    || result.schemaVersion !== ATOMIC_RECEIPT_SCHEMA
    || result.committed !== true
    || result.durable !== true
    || result.sameTransaction !== true
    || result.invitationStateCommitted !== true
    || result.otpChallengeCommitted !== true
    || result.auditCommitted !== true
    || result.privateSessionIssued !== false
    || !/^transaction_[a-f0-9]{64}$/u.test(result.transactionRef ?? '')
    || typeof result.replayed !== 'boolean'
    || typeof result.verified !== 'boolean'
    || result.caseId !== command.scope.caseId
    || result.invitationId !== command.scope.invitationId
    || result.purpose !== command.scope.purpose
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
  ) {
    throwDriverFailure(result, command.idempotencyKey);
  }
  assertNoForbiddenReceiptKeys(result);
  assertNoRawInputEcho(result, [
    rawInputs.challengeId,
    rawInputs.otpCode,
    rawInputs.rawToken,
    rawInputs.recipientEmail,
  ]);
  const record = assertInvitationRecord(result.invitation, command.scope);
  const databaseTime = assertDatabaseTime(result.databaseTime);
  if (
    result.recordHash !== hashValue(record)
    || result.eventHash !== hashValue(result.event)
    || result.auditEventRef !== result.event?.eventRef
  ) {
    throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_RECEIPT_HASH_INVALID');
  }
  assertDriverAuthorizationBinding(result.authorizationBinding, command.scope, result);
  assertAuditEvent(result.event, result, record, command.auditBindings, databaseTime);
  assertAttemptTransition(result, record, command, databaseTime);
  if (result.verified === true) {
    const usedAt = Date.parse(record.usedAt);
    const createdAt = Date.parse(record.createdAt);
    const expiresAt = Date.parse(record.expiresAt);
    const otpVerifiedAt = Date.parse(result.authorizationBinding.otpVerifiedAt);
    const otpExpiresAt = Date.parse(result.authorizationBinding.otpExpiresAt);
    if (
      result.reasonCode !== null
      || result.challengeConsumed !== true
      || !record.usedAt
      || record.revokedAt !== null
      || record.lockedUntil !== null
      || record.failedAttempts !== 0
      || record.lastFailureCode !== null
      || command.challengeId !== command.scope.challengeId
      || command.presentedTokenHash !== record.tokenHash
      || command.presentedRecipientEmailHash !== record.recipientEmailHash
      || record.verifiedFacultyId !== result.authorizationBinding.verifiedPrincipalId
      || record.verifiedFacultyId !== command.scope.authenticatedSubject
      || usedAt < createdAt
      || usedAt >= expiresAt
      || otpVerifiedAt < createdAt
      || otpVerifiedAt > usedAt
      || usedAt >= otpExpiresAt
    ) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'VERIFIED_STATE_BINDING_INVALID');
    }
  } else {
    if (
      !DENIAL_REASONS.has(result.reasonCode)
      || result.challengeConsumed !== false
    ) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'DENIAL_STATE_BINDING_INVALID');
    }
    if (
      result.reasonCode !== 'INVITATION_ALREADY_USED'
      && record.verifiedFacultyId !== null
    ) {
      throw new IntegrationDisabledError('lor_faculty_repository', 'DENIED_INVITATION_PRINCIPAL_INVALID');
    }
  }
  return { record, event: result.event };
}

export class SupabaseDurableFacultyInvitationRepository extends FacultyInvitationRepositoryPort {
  /** @param {DurableFacultyRepositoryOptions} [options] */
  constructor({ binding, driver, scopeProvider, verifiedContextProvider } = {}) {
    super();
    this.binding = assertBinding(binding);
    this.driver = assertDriver(driver);
    if (typeof scopeProvider !== 'function') {
      throw new IntegrationDisabledError('lor_faculty_scope', 'SCOPE_PROVIDER_REQUIRED');
    }
    if (typeof verifiedContextProvider !== 'function') {
      throw new IntegrationDisabledError('lor_faculty_context', 'VERIFIED_CONTEXT_PROVIDER_REQUIRED');
    }
    this.scopeProvider = scopeProvider;
    this.verifiedContextProvider = verifiedContextProvider;
    this.durability = 'DURABLE_PROVIDER_BOUND';
    this.isDurable = true;
    this.atomicOtpInvitationAndAudit = true;
    Object.freeze(this);
  }

  describePersistence() {
    return deepFreeze({
      durability: this.durability,
      environment: this.binding.environment,
      productionEligible: this.binding.environment === 'production',
      atomicOtpInvitationAndAudit: true,
      rlsBound: true,
      projectRef: this.binding.projectRef,
      branchName: this.binding.branchName,
      branchId: this.binding.branchId,
      schema: this.binding.schema,
      privateSessionIssued: false,
    });
  }

  assertProductionReady() {
    if (this.binding.environment !== 'production') {
      throw new IntegrationDisabledError('lor_faculty_repository', 'PRODUCTION_DATA_BINDING_REQUIRED');
    }
    return this.describePersistence();
  }

  async create() {
    throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_ISSUANCE_NOT_YET_BOUND');
  }

  async getById() {
    throw new IntegrationDisabledError('lor_faculty_repository', 'UNSCOPED_INVITATION_READ_PROHIBITED');
  }

  async save() {
    throw new IntegrationDisabledError('lor_faculty_repository', 'SPLIT_INVITATION_WRITE_PROHIBITED');
  }

  /** @param {FacultyVerificationRequest} [request] */
  async verifyAndCommit(request = {}) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      throw new ValidationError('Faculty verification request must be an object');
    }
    const allowedKeys = new Set([
      'idempotencyKey',
      'otpCode',
      'rawToken',
      'recipientEmail',
    ]);
    if (Object.keys(request).some((key) => !allowedKeys.has(key))) {
      throw new ValidationError('Faculty verification request contains forbidden fields');
    }
    const idempotencyKey = assertNonEmptyString(request.idempotencyKey, 'idempotencyKey', { maxLength: 200 });
    const rawToken = assertNonEmptyString(request.rawToken, 'rawToken', { maxLength: 512 });
    const otpCode = assertNonEmptyString(request.otpCode, 'otpCode', { maxLength: 64 });
    if (otpCode.length < 6) {
      throw new ValidationError('otpCode must contain at least six characters');
    }
    const recipientEmail = assertNonEmptyString(request.recipientEmail, 'recipientEmail', { maxLength: 320 });
    let presentedRecipientEmailHash;
    try {
      presentedRecipientEmailHash = hashFacultyEmail(recipientEmail);
    } catch {
      presentedRecipientEmailHash = sha256('lor-studio:invalid-presented-faculty-email');
    }
    let rawContext;
    try {
      rawContext = await this.verifiedContextProvider();
    } catch {
      throw new IntegrationDisabledError('lor_faculty_context', 'VERIFIED_CONTEXT_PROVIDER_UNAVAILABLE');
    }
    let context;
    try {
      context = assertVerifiedContext(rawContext);
    } catch {
      throw new IntegrationDisabledError('lor_faculty_context', 'VERIFIED_FACULTY_CONTEXT_REQUIRED');
    }
    let rawScope;
    try {
      rawScope = await this.scopeProvider({
        bindingRef: context.bindingRef,
        operation: OPERATION,
        purpose: FACULTY_PURPOSE,
      });
    } catch {
      throw new IntegrationDisabledError('lor_faculty_scope', 'SCOPE_PROVIDER_UNAVAILABLE');
    }
    let scope;
    try {
      scope = assertScope(rawScope, context);
    } catch {
      throw new IntegrationDisabledError('lor_faculty_scope', 'VERIFIED_INVITATION_SCOPE_REQUIRED');
    }
    const invitationId = scope.invitationId;
    const challengeId = scope.challengeId;
    const presentedTokenHash = sha256(rawToken);
    const otpCodeHash = sha256(`lor-studio:otp-attempt:${challengeId}:${otpCode}`);
    const requestHash = hashValue({
      schemaVersion: 'missionmed.lor.faculty-verification-request.v1',
      invitationId,
      challengeIdHash: sha256(challengeId),
      contextBindingRef: scope.bindingRef,
      authenticatedSubjectRef: metadataRef('faculty', scope.authenticatedSubject),
      idempotencyKey,
      otpCodeHash,
      presentedRecipientEmailHash,
      presentedTokenHash,
    });
    const command = {
      binding: this.binding,
      scope,
      invitationId,
      challengeId,
      otpCode,
      presentedRecipientEmailHash,
      presentedTokenHash,
      idempotencyKey,
      requestHash,
      auditBindings: buildAuditBindings(scope, idempotencyKey),
    };
    let result;
    try {
      result = await this.driver.executeAtomicFacultyVerification(structuredClone(command));
    } catch {
      throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_VERIFICATION_UNAVAILABLE');
    }
    let validated;
    try {
      validated = validateAtomicReceipt(result, command, {
        challengeId,
        otpCode,
        rawToken,
        recipientEmail,
      });
    } catch (error) {
      if (error instanceof IdempotencyConflictError) throw error;
      throw new IntegrationDisabledError('lor_faculty_repository', 'ATOMIC_RECEIPT_INVALID');
    }
    const principalId = result.verified
      ? assertCanonicalWpSubject(
        result.authorizationBinding.verifiedPrincipalId,
        'RESULT_VERIFIED_PRINCIPAL_ID',
      )
      : null;
    return deepFreeze({
      schemaVersion: SAFE_RESULT_SCHEMA,
      verified: result.verified,
      reasonCode: result.reasonCode,
      caseRef: metadataRef('case', scope.caseId),
      invitationRef: metadataRef('invitation', scope.invitationId),
      facultyRef: principalId ? facultyRefForCanonicalSubject(principalId) : null,
      otpProofRef: result.verified ? result.authorizationBinding.otpProofRef : null,
      purpose: scope.purpose,
      revision: validated.record.revision,
      verifiedAt: result.verified ? validated.record.usedAt : null,
      auditEventRef: validated.event.eventRef,
      idempotentReplay: result.replayed,
      privateSessionIssued: false,
      privateEditGranted: false,
    });
  }
}

export const SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT = deepFreeze({
  targets: {
    staging: {
      environment: 'staging',
      projectRef: LOR_STAGING_BRANCH_ID,
      parentProjectRef: RANKLISTIQ_PROJECT_REF,
      branchName: LOR_STAGING_BRANCH,
      branchId: LOR_STAGING_BRANCH_ID,
      dataCopied: false,
    },
    production: {
      environment: 'production',
      projectRef: RANKLISTIQ_PROJECT_REF,
      branchName: RANKLISTIQ_MAIN_BRANCH,
      branchId: RANKLISTIQ_PROJECT_REF,
      productionDataBindingPassed: true,
    },
  },
  schema: LOR_SCHEMA,
  scopeSchema: SCOPE_SCHEMA,
  verifiedContextSchema: VERIFIED_CONTEXT_SCHEMA,
  driverBindingSchema: DRIVER_BINDING_SCHEMA,
  atomicReceiptSchema: ATOMIC_RECEIPT_SCHEMA,
  databaseTimeSchema: DATABASE_TIME_SCHEMA,
  attemptStateSchema: ATTEMPT_STATE_SCHEMA,
  safeResultSchema: SAFE_RESULT_SCHEMA,
  purpose: FACULTY_PURPOSE,
  serverResolution: 'verified_context_then_bound_invitation_and_challenge_without_client_locators',
  serverResolvedIdentifiers: ['invitationId', 'challengeId'],
  atomicity: 'otp_challenge_invitation_state_and_metadata_audit_same_transaction',
  idempotency: 'durable_key_plus_request_hash_cross_instance',
  privateSessionIssued: false,
  privateEditGranted: false,
});
