import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  LorDomainError,
  ValidationError,
} from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';
import { assertValidatedLorTargetBinding } from '../adapters/lor-target-binding.mjs';

const INTEGRATION = 'lor_faculty_invitation_command_repository';
const SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const WP_SUBJECT = /^wp:[1-9][0-9]*$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SCOPE_KEYS = new Set([
  'schemaVersion', 'authoritySource', 'authenticated', 'roleVerified', 'authUid',
  'authenticatedSubject', 'actorId', 'actorRole', 'resourceStudentId', 'caseId',
  'operation', 'purpose', 'assignmentId', 'invitationId', 'administrativeGrantId',
  'entitlementVerified', 'lorEnabled', 'canaryAuthorized',
]);
const ISSUE_KEYS = new Set([
  'actorId', 'caseId', 'expectedRevision', 'invitationId', 'recipientEmailHash',
  'tokenHash', 'challengeId', 'otpCodeHash', 'invitationExpiresAt',
  'challengeExpiresAt', 'maxAttempts', 'attemptWindowMs', 'lockoutMs',
  'idempotencyKey', 'requestHash',
]);
const RESEND_KEYS = new Set([
  'actorId', 'caseId', 'recipientEmailHash', 'challengeId', 'otpCodeHash',
  'challengeExpiresAt', 'idempotencyKey', 'requestHash',
]);
const REVOKE_KEYS = new Set(['actorId', 'caseId', 'idempotencyKey', 'requestHash']);
const DELIVERY_KEYS = new Set([
  'resourceStudentId', 'caseId', 'invitationId', 'providerMessageRefHash',
  'idempotencyKey', 'requestHash',
]);
const DELIVERY_RESERVATION_KEYS = new Set([
  'resourceStudentId', 'caseId', 'invitationId', 'deliveryAction',
  'idempotencyKey', 'requestHash',
]);
const DELIVERY_UNKNOWN_KEYS = new Set([
  'resourceStudentId', 'caseId', 'invitationId', 'idempotencyKey', 'requestHash',
]);

function snapshotExact(value, expectedKeys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(reason);
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new ValidationError(reason);
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
    || keys.some((key) => (
      !descriptors[key]
      || descriptors[key].enumerable !== true
      || !Object.hasOwn(descriptors[key], 'value')
    ))
  ) throw new ValidationError(reason);
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, descriptors[key].value])));
}

function assertDriver(driver) {
  if (
    !driver
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || driver.databaseClock !== true
    || driver.atomicFacultyInvitationCommands !== true
    || typeof driver.issueFacultyInvitationAtomic !== 'function'
    || typeof driver.resendFacultyInvitationOtpAtomic !== 'function'
    || typeof driver.revokeFacultyInvitationAtomic !== 'function'
    || typeof driver.reserveFacultyInvitationDeliveryAtomic !== 'function'
    || typeof driver.commitFacultyInvitationDeliveryAtomic !== 'function'
    || typeof driver.markFacultyInvitationDeliveryUnknownAtomic !== 'function'
  ) {
    throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_COMMAND_DRIVER_REQUIRED');
  }
  return driver;
}

function assertSubject(value, fieldName) {
  if (typeof value !== 'string' || !WP_SUBJECT.test(value)) {
    throw new AuthorizationDeniedError(`${fieldName.toUpperCase()}_INVALID`);
  }
  return value;
}

function assertCaseId(value) {
  if (typeof value !== 'string' || !CASE_ID.test(value)) {
    throw new ValidationError('caseId is invalid');
  }
  return value;
}

function assertDigest(value, fieldName) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`);
  }
  return value;
}

function assertString(value, fieldName, maxLength = 240) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    throw new ValidationError(`${fieldName} is invalid`);
  }
  return value;
}

function assertTimestamp(value, fieldName) {
  if (
    typeof value !== 'string'
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`);
  return value;
}

function validateStudentScope(rawScope, { actorId, caseId }) {
  let scope;
  try {
    scope = snapshotExact(rawScope, SCOPE_KEYS, 'scope is invalid');
  } catch {
    throw new IntegrationDisabledError(INTEGRATION, 'VERIFIED_STUDENT_SCOPE_REQUIRED');
  }
  if (
    scope.schemaVersion !== SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true
    || scope.roleVerified !== true
    || typeof scope.authUid !== 'string'
    || !UUID.test(scope.authUid)
    || scope.actorRole !== 'student'
    || scope.actorId !== actorId
    || scope.authenticatedSubject !== actorId
    || scope.resourceStudentId !== actorId
    || scope.caseId !== caseId
    || scope.operation !== 'save'
    || scope.purpose !== 'student_case_write'
    || scope.assignmentId !== null
    || scope.invitationId !== null
    || scope.administrativeGrantId !== null
    || scope.entitlementVerified !== true
    || scope.lorEnabled !== true
    || scope.canaryAuthorized !== true
  ) {
    throw new AuthorizationDeniedError('VERIFIED_STUDENT_SCOPE_REQUIRED');
  }
  return scope;
}

async function callDriver(status, callback) {
  try {
    const result = await callback();
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_COMMAND_RECEIPT_INVALID');
    }
    return deepFreeze(structuredClone(result));
  } catch (error) {
    if (error instanceof LorDomainError) throw error;
    throw new IntegrationDisabledError(INTEGRATION, status);
  }
}

export class SupabaseDurableFacultyInvitationCommandRepository {
  constructor({ binding, driver, scopeProvider } = {}) {
    this.binding = assertValidatedLorTargetBinding(binding, INTEGRATION);
    this.driver = assertDriver(driver);
    if (typeof scopeProvider !== 'function') {
      throw new IntegrationDisabledError(INTEGRATION, 'SCOPE_PROVIDER_REQUIRED');
    }
    this.scopeProvider = scopeProvider;
    this.isDurable = true;
    this.databaseClock = true;
    this.atomicInvitationOtpAndAudit = true;
    Object.freeze(this);
  }

  async #studentScope(actorId, caseId) {
    let rawScope;
    try {
      rawScope = await this.scopeProvider({
        caseId,
        operation: 'save',
        resourceStudentId: actorId,
      });
    } catch (error) {
      if (error instanceof LorDomainError) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'SCOPE_PROVIDER_UNAVAILABLE');
    }
    return validateStudentScope(rawScope, { actorId, caseId });
  }

  async issueAndCommit(rawRequest) {
    const request = snapshotExact(rawRequest, ISSUE_KEYS, 'issue command is invalid');
    const actorId = assertSubject(request.actorId, 'actorId');
    const caseId = assertCaseId(request.caseId);
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be a non-negative integer');
    }
    for (const field of ['invitationId', 'challengeId']) {
      assertString(request[field], field, 200);
      if (!CASE_ID.test(request[field])) throw new ValidationError(`${field} is invalid`);
    }
    for (const field of ['recipientEmailHash', 'tokenHash', 'otpCodeHash', 'requestHash']) {
      assertDigest(request[field], field);
    }
    for (const field of ['invitationExpiresAt', 'challengeExpiresAt']) {
      assertTimestamp(request[field], field);
    }
    if (
      !Number.isSafeInteger(request.maxAttempts)
      || request.maxAttempts < 1
      || request.maxAttempts > 20
      || !Number.isSafeInteger(request.attemptWindowMs)
      || request.attemptWindowMs < 1_000
      || !Number.isSafeInteger(request.lockoutMs)
      || request.lockoutMs < 1_000
    ) throw new ValidationError('invitation attempt policy is invalid');
    assertString(request.idempotencyKey, 'idempotencyKey');
    const scope = await this.#studentScope(actorId, caseId);
    return callDriver(
      'ISSUE_COMMAND_UNAVAILABLE',
      () => this.driver.issueFacultyInvitationAtomic({
        binding: this.binding,
        scope,
        ...request,
      }),
    );
  }

  async resendOtpAndCommit(rawRequest) {
    const request = snapshotExact(rawRequest, RESEND_KEYS, 'resend command is invalid');
    const actorId = assertSubject(request.actorId, 'actorId');
    const caseId = assertCaseId(request.caseId);
    assertDigest(request.recipientEmailHash, 'recipientEmailHash');
    assertString(request.challengeId, 'challengeId', 200);
    if (!CASE_ID.test(request.challengeId)) throw new ValidationError('challengeId is invalid');
    assertDigest(request.otpCodeHash, 'otpCodeHash');
    assertTimestamp(request.challengeExpiresAt, 'challengeExpiresAt');
    assertString(request.idempotencyKey, 'idempotencyKey');
    assertDigest(request.requestHash, 'requestHash');
    const scope = await this.#studentScope(actorId, caseId);
    return callDriver(
      'OTP_RESEND_COMMAND_UNAVAILABLE',
      () => this.driver.resendFacultyInvitationOtpAtomic({
        binding: this.binding,
        scope,
        ...request,
      }),
    );
  }

  async revokeAndCommit(rawRequest) {
    const request = snapshotExact(rawRequest, REVOKE_KEYS, 'revoke command is invalid');
    const actorId = assertSubject(request.actorId, 'actorId');
    const caseId = assertCaseId(request.caseId);
    assertString(request.idempotencyKey, 'idempotencyKey');
    assertDigest(request.requestHash, 'requestHash');
    const scope = await this.#studentScope(actorId, caseId);
    return callDriver(
      'REVOKE_COMMAND_UNAVAILABLE',
      () => this.driver.revokeFacultyInvitationAtomic({
        binding: this.binding,
        scope,
        ...request,
      }),
    );
  }

  async commitDelivery(rawRequest) {
    const request = snapshotExact(rawRequest, DELIVERY_KEYS, 'delivery command is invalid');
    const resourceStudentId = assertSubject(request.resourceStudentId, 'resourceStudentId');
    const caseId = assertCaseId(request.caseId);
    assertString(request.invitationId, 'invitationId', 200);
    if (!CASE_ID.test(request.invitationId)) throw new ValidationError('invitationId is invalid');
    assertDigest(request.providerMessageRefHash, 'providerMessageRefHash');
    assertString(request.idempotencyKey, 'idempotencyKey');
    assertDigest(request.requestHash, 'requestHash');
    const studentScope = await this.#studentScope(resourceStudentId, caseId);
    return callDriver(
      'DELIVERY_COMMAND_UNAVAILABLE',
      () => this.driver.commitFacultyInvitationDeliveryAtomic({
        binding: this.binding,
        studentScope,
        caseId,
        invitationId: request.invitationId,
        providerMessageRefHash: request.providerMessageRefHash,
        idempotencyKey: request.idempotencyKey,
        requestHash: request.requestHash,
      }),
    );
  }

  async reserveDelivery(rawRequest) {
    const request = snapshotExact(
      rawRequest,
      DELIVERY_RESERVATION_KEYS,
      'delivery reservation command is invalid',
    );
    const resourceStudentId = assertSubject(request.resourceStudentId, 'resourceStudentId');
    const caseId = assertCaseId(request.caseId);
    assertString(request.invitationId, 'invitationId', 200);
    if (!CASE_ID.test(request.invitationId)) throw new ValidationError('invitationId is invalid');
    if (!['issue', 'resend'].includes(request.deliveryAction)) {
      throw new ValidationError('deliveryAction is invalid');
    }
    assertString(request.idempotencyKey, 'idempotencyKey');
    assertDigest(request.requestHash, 'requestHash');
    const studentScope = await this.#studentScope(resourceStudentId, caseId);
    return callDriver(
      'DELIVERY_RESERVATION_UNAVAILABLE',
      () => this.driver.reserveFacultyInvitationDeliveryAtomic({
        binding: this.binding,
        studentScope,
        caseId,
        invitationId: request.invitationId,
        deliveryAction: request.deliveryAction,
        idempotencyKey: request.idempotencyKey,
        requestHash: request.requestHash,
      }),
    );
  }

  async markDeliveryUnknown(rawRequest) {
    const request = snapshotExact(
      rawRequest,
      DELIVERY_UNKNOWN_KEYS,
      'delivery unknown command is invalid',
    );
    const resourceStudentId = assertSubject(request.resourceStudentId, 'resourceStudentId');
    const caseId = assertCaseId(request.caseId);
    assertString(request.invitationId, 'invitationId', 200);
    if (!CASE_ID.test(request.invitationId)) throw new ValidationError('invitationId is invalid');
    assertString(request.idempotencyKey, 'idempotencyKey');
    assertDigest(request.requestHash, 'requestHash');
    const studentScope = await this.#studentScope(resourceStudentId, caseId);
    return callDriver(
      'DELIVERY_UNKNOWN_COMMAND_UNAVAILABLE',
      () => this.driver.markFacultyInvitationDeliveryUnknownAtomic({
        binding: this.binding,
        studentScope,
        caseId,
        invitationId: request.invitationId,
        idempotencyKey: request.idempotencyKey,
        requestHash: request.requestHash,
      }),
    );
  }
}

export const SUPABASE_DURABLE_FACULTY_INVITATION_COMMAND_CONTRACT = deepFreeze({
  scope: 'active_verified_student_request_only',
  commandScopePromotion: 'driver_allowlisted_postmark_delivery_only',
  rawSecretsAccepted: false,
  driverMethods: [
    'issueFacultyInvitationAtomic',
    'resendFacultyInvitationOtpAtomic',
    'revokeFacultyInvitationAtomic',
    'reserveFacultyInvitationDeliveryAtomic',
    'commitFacultyInvitationDeliveryAtomic',
    'markFacultyInvitationDeliveryUnknownAtomic',
  ],
  serverResolved: ['resend.invitationId', 'revoke.invitationId'],
  persistence: 'atomic_invitation_otp_protected_state_and_metadata_audit',
});
