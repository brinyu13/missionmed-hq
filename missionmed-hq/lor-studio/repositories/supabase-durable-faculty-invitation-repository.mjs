import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  InvitationDeniedError,
  LorDomainError,
  ValidationError,
} from '../domain/errors.js';
import { deepFreeze, hashValue, sha256 } from '../domain/value-utils.js';
import { hashFacultyEmail } from '../security/faculty-invitations.js';
import { FacultyInvitationRepositoryPort } from '../services/ports.js';
import {
  LOR_TARGET_BINDING_CONTRACT,
  assertValidatedLorTargetBinding,
} from '../adapters/lor-target-binding.mjs';

const INTEGRATION = 'lor_faculty_invitation_repository';
const CANDIDATE_SCOPE_SCHEMA = 'missionmed.lor.faculty-invitation-candidate-scope.v1';
const RECEIPT_SCHEMA = 'missionmed.lor.faculty-invitation-command-receipt.v1';
const SAFE_RESULT_SCHEMA = 'missionmed.lor.faculty-verification-result.v2';
const VERIFY_OPERATION = 'verify_faculty_invitation';
const FACULTY_PURPOSE = 'faculty_private_edit';
const WP_SUBJECT = /^wp:[1-9][0-9]*$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LOCATOR = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const EVENT_REF = /^event_[a-f0-9]{64}$/u;
const RECEIPT_REF = /^faculty_command_[a-f0-9]{64}$/u;
const OTP = /^[0-9]{6}$/u;
const DENIAL_REASONS = new Set([
  'INVITATION_ALREADY_USED',
  'INVITATION_EXPIRED',
  'INVITATION_LOCKED',
  'INVITATION_REVOKED',
  'OTP_NOT_VERIFIED',
  'RECIPIENT_MISMATCH',
  'TOKEN_MISMATCH',
]);
const REQUEST_KEYS = new Set([
  'actorId',
  'idempotencyKey',
  'invitationId',
  'otpCode',
  'recipientEmail',
]);
const CANDIDATE_CREDENTIAL_KEYS = new Set([
  'schemaVersion',
  'authoritySource',
  'authenticatedSubject',
  'invitationId',
  'tokenHash',
  'flowNonceHash',
  'issuedAt',
  'expiresAt',
  'clientAsserted',
]);
const CANDIDATE_SCOPE_KEYS = new Set([
  'schemaVersion',
  'authoritySource',
  'authenticated',
  'roleVerified',
  'authUid',
  'authenticatedSubject',
  'actorId',
  'actorRole',
  'operation',
  'purpose',
  'invitationId',
  'entitlementVerified',
  'lorEnabled',
  'canaryAuthorized',
]);
const RECEIPT_KEYS = new Set([
  'schemaVersion',
  'receiptId',
  'action',
  'committed',
  'replayed',
  'caseId',
  'invitationId',
  'challengeIdHash',
  'invitationExpiresAt',
  'challengeExpiresAt',
  'caseRevision',
  'invitationRevision',
  'verified',
  'reasonCode',
  'auditEventRef',
  'transactionId',
]);

function snapshotExact(value, expectedKeys, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(message);
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new ValidationError(message);
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
    || keys.some((key) => {
      if (typeof key !== 'string') return true;
      const descriptor = descriptors[key];
      return !descriptor
        || descriptor.enumerable !== true
        || !Object.hasOwn(descriptor, 'value');
    })
  ) throw new ValidationError(message);
  return Object.freeze(Object.fromEntries(keys.map((key) => {
    if (typeof key !== 'string') throw new ValidationError(message);
    return [key, descriptors[key].value];
  })));
}

function assertDriver(driver) {
  if (
    !driver
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || driver.databaseClock !== true
    || driver.atomicFacultyInvitationCommands !== true
    || typeof driver.verifyFacultyInvitationAtomic !== 'function'
  ) throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_VERIFICATION_DRIVER_REQUIRED');
  return driver;
}

function assertSubject(value, fieldName = 'actorId') {
  if (typeof value !== 'string' || !WP_SUBJECT.test(value)) {
    throw new AuthorizationDeniedError(`${fieldName.toUpperCase()}_INVALID`);
  }
  return value;
}

function assertCandidateCredential(rawCredential, { actorId, invitationId }) {
  let credential;
  try {
    credential = snapshotExact(
      rawCredential,
      CANDIDATE_CREDENTIAL_KEYS,
      'candidate credential is invalid',
    );
  } catch {
    throw new InvitationDeniedError();
  }
  const issuedAt = Date.parse(String(credential.issuedAt ?? ''));
  const expiresAt = Date.parse(String(credential.expiresAt ?? ''));
  if (
    credential.schemaVersion !== 'missionmed.lor.faculty-candidate-credential.v1'
    || credential.authoritySource !== 'server_verified_sealed_candidate_cookie'
    || credential.authenticatedSubject !== actorId
    || credential.invitationId !== invitationId
    || !SHA256.test(credential.tokenHash ?? '')
    || !SHA256.test(credential.flowNonceHash ?? '')
    || credential.clientAsserted !== false
    || !Number.isFinite(issuedAt)
    || !Number.isFinite(expiresAt)
    || new Date(issuedAt).toISOString() !== credential.issuedAt
    || new Date(expiresAt).toISOString() !== credential.expiresAt
    || expiresAt <= issuedAt
  ) throw new InvitationDeniedError();
  return credential;
}

function assertString(value, fieldName, maxLength) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length < 1
    || value.length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw new ValidationError(`${fieldName} is invalid`);
  return value;
}

function assertLocator(value, fieldName) {
  if (typeof value !== 'string' || !LOCATOR.test(value)) {
    throw new ValidationError(`${fieldName} is invalid`);
  }
  return value;
}

function assertRevision(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new IntegrationDisabledError(INTEGRATION, `${fieldName.toUpperCase()}_INVALID`);
  }
  return value;
}

function assertCandidateScope(rawScope, { actorId, invitationId }) {
  let scope;
  try {
    scope = snapshotExact(rawScope, CANDIDATE_SCOPE_KEYS, 'candidate scope is invalid');
  } catch {
    throw new IntegrationDisabledError(INTEGRATION, 'VERIFIED_CANDIDATE_SCOPE_REQUIRED');
  }
  if (
    scope.schemaVersion !== CANDIDATE_SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_wordpress_invitation_candidate'
    || scope.authenticated !== true
    || scope.roleVerified !== true
    || typeof scope.authUid !== 'string'
    || !UUID.test(scope.authUid)
    || scope.authenticatedSubject !== actorId
    || scope.actorId !== actorId
    || scope.actorRole !== 'faculty'
    || scope.operation !== VERIFY_OPERATION
    || scope.purpose !== FACULTY_PURPOSE
    || scope.invitationId !== invitationId
    || scope.entitlementVerified !== true
    || scope.lorEnabled !== true
    || scope.canaryAuthorized !== true
  ) throw new AuthorizationDeniedError('VERIFIED_FACULTY_CANDIDATE_SCOPE_REQUIRED');
  return scope;
}

function assertReceipt(rawReceipt, { invitationId }) {
  let receipt;
  try {
    receipt = snapshotExact(rawReceipt, RECEIPT_KEYS, 'verification receipt is invalid');
  } catch {
    throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_VERIFICATION_RECEIPT_INVALID');
  }
  const reasonValid = receipt.verified === true
    ? receipt.reasonCode === null
    : DENIAL_REASONS.has(receipt.reasonCode);
  if (
    receipt.schemaVersion !== RECEIPT_SCHEMA
    || !RECEIPT_REF.test(receipt.receiptId ?? '')
    || receipt.action !== 'faculty.invitation.verify'
    || receipt.committed !== true
    || typeof receipt.replayed !== 'boolean'
    || !LOCATOR.test(receipt.caseId ?? '')
    || receipt.invitationId !== invitationId
    || (receipt.challengeIdHash !== null && !SHA256.test(receipt.challengeIdHash ?? ''))
    || receipt.invitationExpiresAt !== null
    || receipt.challengeExpiresAt !== null
    || typeof receipt.verified !== 'boolean'
    || !reasonValid
    || !EVENT_REF.test(receipt.auditEventRef ?? '')
    || typeof receipt.transactionId !== 'string'
    || !/^(?:0|[1-9][0-9]{0,39})$/u.test(receipt.transactionId)
  ) throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_VERIFICATION_RECEIPT_INVALID');
  assertRevision(receipt.caseRevision, 'caseRevision');
  assertRevision(receipt.invitationRevision, 'invitationRevision');
  return receipt;
}

export class SupabaseDurableFacultyInvitationRepository extends FacultyInvitationRepositoryPort {
  /**
   * @param {{binding?: unknown, driver?: unknown, candidateScopeProvider?: Function, candidateCredentialProvider?: Function}} [options]
   */
  constructor({ binding, driver, candidateScopeProvider, candidateCredentialProvider } = {}) {
    super();
    this.binding = assertValidatedLorTargetBinding(binding, INTEGRATION);
    this.driver = assertDriver(driver);
    if (typeof candidateScopeProvider !== 'function') {
      throw new IntegrationDisabledError(INTEGRATION, 'CANDIDATE_SCOPE_PROVIDER_REQUIRED');
    }
    if (typeof candidateCredentialProvider !== 'function') {
      throw new IntegrationDisabledError(INTEGRATION, 'CANDIDATE_CREDENTIAL_PROVIDER_REQUIRED');
    }
    this.candidateScopeProvider = candidateScopeProvider;
    this.candidateCredentialProvider = candidateCredentialProvider;
    this.isDurable = true;
    this.databaseClock = true;
    this.atomicOtpInvitationAndAudit = true;
    Object.freeze(this);
  }

  async create() {
    throw new IntegrationDisabledError(INTEGRATION, 'USE_ATOMIC_ISSUANCE_REPOSITORY');
  }

  async getById() {
    throw new IntegrationDisabledError(INTEGRATION, 'UNSCOPED_INVITATION_READ_PROHIBITED');
  }

  async save() {
    throw new IntegrationDisabledError(INTEGRATION, 'SPLIT_INVITATION_WRITE_PROHIBITED');
  }

  async verifyAndCommit(rawRequest) {
    const request = snapshotExact(rawRequest, REQUEST_KEYS, 'verification command is invalid');
    const actorId = assertSubject(request.actorId);
    const invitationId = assertLocator(request.invitationId, 'invitationId');
    const idempotencyKey = assertString(request.idempotencyKey, 'idempotencyKey', 200);
    const recipientEmail = assertString(request.recipientEmail, 'recipientEmail', 320);
    if (typeof request.otpCode !== 'string' || !OTP.test(request.otpCode)) {
      throw new ValidationError('otpCode must be exactly six digits');
    }
    let recipientEmailHash;
    try {
      recipientEmailHash = hashFacultyEmail(recipientEmail);
    } catch {
      // A malformed recipient remains indistinguishable from a wrong recipient at the DB boundary.
      recipientEmailHash = sha256('missionmed.lor.invalid-faculty-email.v1');
    }
    let rawCredential;
    try {
      rawCredential = await this.candidateCredentialProvider({ actorId, invitationId });
    } catch (error) {
      if (error instanceof InvitationDeniedError) throw error;
      throw new InvitationDeniedError();
    }
    const credential = assertCandidateCredential(rawCredential, { actorId, invitationId });
    const tokenHash = credential.tokenHash;
    const otpAttemptHash = sha256(`missionmed.lor.otp-attempt.v1:${request.otpCode}`);
    const requestHash = hashValue({
      schemaVersion: 'missionmed.lor.faculty-verification-command.v2',
      actorId,
      invitationId,
      recipientEmailHash,
      tokenHash,
      otpAttemptHash,
      idempotencyKey,
    });
    let rawScope;
    try {
      rawScope = await this.candidateScopeProvider({
        invitationId,
        operation: VERIFY_OPERATION,
      });
    } catch (error) {
      if (error instanceof LorDomainError) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'CANDIDATE_SCOPE_PROVIDER_UNAVAILABLE');
    }
    const candidateScope = assertCandidateScope(rawScope, { actorId, invitationId });
    let rawReceipt;
    try {
      rawReceipt = await this.driver.verifyFacultyInvitationAtomic({
        binding: this.binding,
        candidateScope,
        invitationId,
        recipientEmailHash,
        tokenHash,
        otpCode: request.otpCode,
        idempotencyKey,
        requestHash,
      });
    } catch (error) {
      if (error instanceof LorDomainError) throw error;
      throw new IntegrationDisabledError(INTEGRATION, 'ATOMIC_VERIFICATION_UNAVAILABLE');
    }
    const receipt = assertReceipt(rawReceipt, { invitationId });
    return deepFreeze({
      schemaVersion: SAFE_RESULT_SCHEMA,
      verified: receipt.verified,
      reasonCode: receipt.reasonCode,
      caseId: receipt.verified ? receipt.caseId : null,
      invitationId: receipt.verified ? receipt.invitationId : null,
      caseRevision: receipt.verified ? receipt.caseRevision : null,
      invitationRevision: receipt.invitationRevision,
      auditEventRef: receipt.auditEventRef,
      idempotentReplay: receipt.replayed,
      privateSessionIssued: false,
      privateEditGranted: receipt.verified,
    });
  }
}

export const SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT = deepFreeze({
  targetBinding: 'injected_validated_lor_target_binding',
  targetBindingSchema: LOR_TARGET_BINDING_CONTRACT.schemaVersion,
  targetBindingAuthority: LOR_TARGET_BINDING_CONTRACT.authority,
  defaultTarget: null,
  schema: LOR_TARGET_BINDING_CONTRACT.schema,
  candidateScopeSchema: CANDIDATE_SCOPE_SCHEMA,
  receiptSchema: RECEIPT_SCHEMA,
  safeResultSchema: SAFE_RESULT_SCHEMA,
  clientAcceptedFields: ['recipientEmail', 'otpCode'],
  serverResolvedFields: [
    'actorId', 'caseId', 'challengeId', 'facultyAuthUid', 'candidateTokenHash',
  ],
  candidateCredential: 'short_lived_server_verified_sealed_cookie_context_only',
  rawOtpBoundary: 'single_prepared_parameter_to_database_command_never_persisted_or_returned',
  atomicity: 'invitation_challenge_case_protected_chain_and_audit_one_database_transaction',
  privateSessionIssued: false,
  privateEditGrantedOnlyAfterCommit: true,
});
