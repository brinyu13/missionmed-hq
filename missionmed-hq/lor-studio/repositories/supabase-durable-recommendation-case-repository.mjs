import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  NotFoundError,
  StaleRevisionError,
  ValidationError,
} from '../domain/errors.js';
import {
  assertFacultyCaseProjection,
  assertMentorCaseProjection,
  assertRecommendationCase,
  assertStudentSafeRecommendationCase,
} from '../domain/recommendation-case.js';
import {
  assertNonEmptyString,
  canonicalize,
  cloneFrozen,
  deepFreeze,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { RecommendationCaseRepositoryPort } from '../services/ports.js';
import { validateMetadataServiceEvent } from '../services/metadata-events.js';
import { assertTrustedStudentAuthorization } from '../security/authorization-policy.js';
import {
  LOR_TARGET_BINDING_CONTRACT,
  assertValidatedLorTargetBinding,
} from '../adapters/lor-target-binding.mjs';

// DR-119 clause 7: the Supabase target identity is NOT a module constant here.
// This repository previously hard-coded the RankListIQ production project ref and
// the historical no-touch branch id, which made production the only reachable
// target. The target now arrives only as a binding validated by
// adapters/lor-target-binding.mjs, which has no default and denies both of those
// identifiers outright.
const SERVER_SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const DRIVER_AUTHORIZATION_SCHEMA = 'missionmed.lor.driver-authorization-binding.v1';
const CREATION_RESERVATION_RECEIPT_SCHEMA = 'missionmed.lor.case-creation-reservation-receipt.v1';
const LEGACY_ATOMIC_COMMIT_RECEIPT_SCHEMA = 'missionmed.lor.atomic-commit-receipt.v1';
const ATOMIC_COMMAND_RECEIPT_SCHEMA = 'missionmed.lor.atomic-command-receipt.v2';
const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'founder', 'support', 'service']);
const HUMAN_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'founder', 'support']);
const STUDENT_COMMAND_SPECS = deepFreeze({
  'student.case.create': {
    method: 'commitStudentCaseCreate',
    action: 'case.create',
    operation: 'create',
    eventType: 'case.created',
    receiptType: null,
  },
  'student.builder.autosave': {
    method: 'commitStudentBuilderAutosave',
    action: 'builder.autosave',
    operation: 'save',
    eventType: 'builder.autosaved',
    receiptType: null,
  },
  'student.builder.complete': {
    method: 'commitStudentBuilderComplete',
    action: 'builder.complete_step',
    operation: 'save',
    eventType: 'builder.step_completed',
    receiptType: null,
  },
  'student.consent.record': {
    method: 'commitStudentConsentReceipt',
    action: 'consent.record',
    operation: 'save',
    eventType: 'consent.recorded',
    receiptType: 'consent',
  },
  'student.waiver.record': {
    method: 'commitStudentWaiverReceipt',
    action: 'waiver.record',
    operation: 'save',
    eventType: 'waiver.recorded',
    receiptType: 'waiver',
  },
});
const FACULTY_RELEASE_SPEC = deepFreeze({
  method: 'commitFacultyFinalDocumentRelease',
  action: 'faculty.final_document_release',
  operation: 'save',
  eventType: 'faculty.final_document_released',
});
const STUDENT_READ_REQUEST_KEYS = new Set([
  'caseId',
  'studentId',
  'studentAccessAuthorization',
]);
const MENTOR_READ_REQUEST_KEYS = new Set(['caseId', 'actorId']);
const FACULTY_READ_REQUEST_KEYS = new Set(['caseId', 'actorId']);
const FACULTY_RELEASE_REQUEST_KEYS = new Set([
  'caseId',
  'actorId',
  'expectedRevision',
  'documentId',
  'idempotencyKey',
  'requestHash',
  'event',
]);
const STUDENT_CREATE_REQUEST_KEYS = new Set([
  'state',
  'idempotencyKey',
  'requestHash',
  'event',
  'versionEntry',
  'studentWriteAuthorization',
]);
const STUDENT_SAVE_REQUEST_KEYS = new Set([
  ...STUDENT_CREATE_REQUEST_KEYS,
  'expectedRevision',
]);
const STUDENT_RECEIPT_REQUEST_KEYS = new Set([
  ...STUDENT_SAVE_REQUEST_KEYS,
  'receipt',
]);
const VERSION_ENTRY_KEYS = new Set([
  'revision',
  'eventType',
  'actorId',
  'occurredAt',
  'changedFields',
  'changeHash',
]);
const ATOMIC_COMMAND_RECEIPT_KEYS = new Set([
  'schemaVersion',
  'action',
  'committed',
  'replayed',
  'sameTransaction',
  'caseId',
  'studentId',
  'revision',
  'idempotencyKey',
  'requestHash',
  'safeRecordHash',
  'protectedStateHash',
  'eventHash',
  'auditEventRef',
  'transactionId',
  'state',
]);
const STUDENT_READ_RESULT_KEYS = new Set(['found', 'state']);
const MENTOR_READ_RESULT_KEYS = new Set(['found', 'projection']);
const FACULTY_READ_RESULT_KEYS = new Set(['found', 'projection']);
const SERVER_SCOPE_KEYS = new Set([
  'schemaVersion',
  'authoritySource',
  'authenticated',
  'roleVerified',
  'authUid',
  'authenticatedSubject',
  'actorId',
  'actorRole',
  'resourceStudentId',
  'caseId',
  'operation',
  'purpose',
  'assignmentId',
  'invitationId',
  'administrativeGrantId',
  'entitlementVerified',
  'lorEnabled',
  'canaryAuthorized',
]);

/**
 * @typedef {object} AtomicRlsCaseDriver
 * @property {boolean} [atomicStateAndAudit]
 * @property {boolean} [rlsEnforced]
 * @property {boolean} [serverOnly]
 * @property {boolean} [actorSafeCommands]
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} selectCase
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} readStudentSafeCase
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} readFacultyCaseProjection
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} readMentorCaseProjection
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} reserveCaseCreation
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} commitStudentCaseCreate
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} commitStudentBuilderAutosave
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} commitStudentBuilderComplete
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} commitStudentConsentReceipt
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} commitStudentWaiverReceipt
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} commitFacultyFinalDocumentRelease
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} executeAtomicCaseCommand
 */

/**
 * @typedef {object} ServerScopeRequest
 * @property {string} caseId
 * @property {string} operation
 * @property {string} [resourceStudentId]
 */

/**
 * @typedef {object} DurableRepositoryOptions
 * @property {Record<string, unknown> | null} [binding]
 * @property {AtomicRlsCaseDriver | null} [driver]
 * @property {((request: ServerScopeRequest) => Promise<Record<string, unknown> | null | undefined>) | null} [scopeProvider]
 */

/**
 * @typedef {object} CaseCreationReservationRequest
 * @property {unknown} [actorId]
 * @property {unknown} [idempotencyKey]
 * @property {unknown} [requestHash]
 * @property {{caseId?: unknown, builderSessionId?: unknown, createdAt?: unknown} | null} [proposedIdentifiers]
 */

function assertSha256(value, fieldName) {
  if (!/^[a-f0-9]{64}$/u.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`, { fieldName });
  }
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertBinding(binding) {
  // Fail closed unless the caller injected a target binding that
  // resolveLorTargetBinding() actually validated. A plain object that merely
  // looks like a binding is rejected: there is no shape a call site can hand-roll
  // to reach a Supabase project from here.
  return assertValidatedLorTargetBinding(binding, 'lor_supabase_repository');
}

function assertDriver(driver) {
  if (
    !driver
    || driver.atomicStateAndAudit !== true
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || driver.actorSafeCommands !== true
    || typeof driver.selectCase !== 'function'
    || typeof driver.readStudentSafeCase !== 'function'
    || typeof driver.readFacultyCaseProjection !== 'function'
    || typeof driver.readMentorCaseProjection !== 'function'
    || typeof driver.reserveCaseCreation !== 'function'
    || typeof driver.commitStudentCaseCreate !== 'function'
    || typeof driver.commitStudentBuilderAutosave !== 'function'
    || typeof driver.commitStudentBuilderComplete !== 'function'
    || typeof driver.commitStudentConsentReceipt !== 'function'
    || typeof driver.commitStudentWaiverReceipt !== 'function'
    || typeof driver.commitFacultyFinalDocumentRelease !== 'function'
    || typeof driver.executeAtomicCaseCommand !== 'function'
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_RLS_DRIVER_REQUIRED');
  }
  return driver;
}

function assertScope(rawScope, { caseId, operation }) {
  if (
    !hasExactKeys(rawScope, SERVER_SCOPE_KEYS)
    || rawScope.schemaVersion !== SERVER_SCOPE_SCHEMA
    || rawScope.authoritySource !== 'server_verified_session_crosswalk'
    || rawScope.authenticated !== true
    || rawScope.roleVerified !== true
    || rawScope.clientAsserted === true
  ) {
    throw new IntegrationDisabledError('lor_supabase_scope', 'VERIFIED_SERVER_SCOPE_REQUIRED');
  }
  for (const field of ['entitlementVerified', 'lorEnabled', 'canaryAuthorized']) {
    if (typeof rawScope[field] !== 'boolean') {
      throw new IntegrationDisabledError('lor_supabase_scope', 'VERIFIED_STUDENT_WRITE_AXES_REQUIRED');
    }
  }
  assertNonEmptyString(rawScope.authUid, 'scope.authUid', { maxLength: 200 });
  assertNonEmptyString(rawScope.authenticatedSubject, 'scope.authenticatedSubject', { maxLength: 200 });
  assertNonEmptyString(rawScope.actorId, 'scope.actorId', { maxLength: 200 });
  assertNonEmptyString(rawScope.resourceStudentId, 'scope.resourceStudentId', { maxLength: 200 });
  assertNonEmptyString(rawScope.caseId, 'scope.caseId', { maxLength: 200 });
  assertNonEmptyString(rawScope.purpose, 'scope.purpose', { maxLength: 160 });
  if (!ACTOR_ROLES.has(rawScope.actorRole)) {
    throw new ValidationError('scope.actorRole is not recognized');
  }
  if (
    rawScope.caseId !== caseId
    || rawScope.operation !== operation
    || !['read', 'create', 'save'].includes(rawScope.operation)
  ) {
    throw new DomainInvariantError('RLS scope must be bound to the requested case and operation');
  }
  if (!/^wp:[1-9][0-9]*$/u.test(rawScope.resourceStudentId)) {
    throw new ValidationError('scope.resourceStudentId must be the canonical student wp:<id> subject');
  }
  if (HUMAN_ROLES.has(rawScope.actorRole)) {
    if (
      !/^wp:[1-9][0-9]*$/u.test(rawScope.authenticatedSubject)
      || rawScope.actorId !== rawScope.authenticatedSubject
    ) {
      throw new AuthorizationDeniedError('AUTHENTICATED_SUBJECT_ACTOR_MISMATCH');
    }
  } else if (
    !/^service:[A-Za-z0-9_.:-]{1,160}$/u.test(rawScope.authenticatedSubject)
    || rawScope.actorId !== rawScope.authenticatedSubject
  ) {
    throw new AuthorizationDeniedError('AUTHENTICATED_SERVICE_SUBJECT_MISMATCH');
  }
  if (rawScope.actorRole === 'faculty') {
    assertNonEmptyString(rawScope.invitationId, 'scope.invitationId', { maxLength: 200 });
    if (
      rawScope.assignmentId != null
      || rawScope.administrativeGrantId != null
      || rawScope.purpose !== 'faculty_private_edit'
      || rawScope.entitlementVerified !== true
      || rawScope.lorEnabled !== true
      || rawScope.canaryAuthorized !== true
    ) {
      throw new AuthorizationDeniedError('FACULTY_SCOPE_EVIDENCE_INVALID');
    }
  }
  if (rawScope.actorRole === 'mentor') {
    assertNonEmptyString(rawScope.assignmentId, 'scope.assignmentId', { maxLength: 200 });
    if (rawScope.invitationId != null || rawScope.administrativeGrantId != null) {
      throw new AuthorizationDeniedError('MENTOR_SCOPE_EVIDENCE_INVALID');
    }
  }
  if (['admin', 'founder', 'support', 'service'].includes(rawScope.actorRole)) {
    assertNonEmptyString(rawScope.administrativeGrantId, 'scope.administrativeGrantId', { maxLength: 200 });
    if (rawScope.invitationId != null || rawScope.assignmentId != null) {
      throw new AuthorizationDeniedError('ADMINISTRATIVE_SCOPE_EVIDENCE_INVALID');
    }
  }
  if (
    rawScope.actorRole === 'student'
    && (rawScope.invitationId != null || rawScope.assignmentId != null || rawScope.administrativeGrantId != null)
  ) {
    throw new AuthorizationDeniedError('STUDENT_SCOPE_EVIDENCE_INVALID');
  }
  if (
    rawScope.actorRole === 'student'
    && ['create', 'save'].includes(rawScope.operation)
    && (
      rawScope.entitlementVerified !== true
      || rawScope.lorEnabled !== true
      || rawScope.canaryAuthorized !== true
    )
  ) {
    throw new AuthorizationDeniedError('STUDENT_WRITE_ELIGIBILITY_SCOPE_INVALID');
  }
  return deepFreeze({
    schemaVersion: SERVER_SCOPE_SCHEMA,
    authoritySource: rawScope.authoritySource,
    authenticated: true,
    roleVerified: true,
    authUid: rawScope.authUid,
    authenticatedSubject: rawScope.authenticatedSubject,
    actorId: rawScope.actorId,
    actorRole: rawScope.actorRole,
    resourceStudentId: rawScope.resourceStudentId,
    caseId: rawScope.caseId,
    operation: rawScope.operation,
    purpose: rawScope.purpose,
    assignmentId: rawScope.assignmentId || null,
    invitationId: rawScope.invitationId || null,
    administrativeGrantId: rawScope.administrativeGrantId || null,
    entitlementVerified: rawScope.entitlementVerified,
    lorEnabled: rawScope.lorEnabled,
    canaryAuthorized: rawScope.canaryAuthorized,
  });
}

function assertRecordScopeBinding(record, scope) {
  if (
    record.id !== scope.caseId
    || record.studentId !== scope.resourceStudentId
    || (scope.actorRole === 'student' && scope.actorId !== record.studentId)
  ) {
    throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
  }
}

function assertSafeStateScopeBinding(state, scope) {
  if (
    state.id !== scope.caseId
    || state.studentId !== scope.resourceStudentId
    || scope.actorRole !== 'student'
    || scope.actorId !== state.studentId
    || scope.authenticatedSubject !== state.studentId
  ) {
    throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
  }
}

function assertStudentAuthorizationScopeBinding(authorization, scope) {
  assertTrustedStudentAuthorization(authorization);
  if (
    scope.entitlementVerified !== authorization.entitlementVerified
    || scope.lorEnabled !== authorization.lorEnabled
    || scope.canaryAuthorized !== authorization.canaryAuthorized
  ) {
    throw new IntegrationDisabledError(
      'lor_supabase_scope',
      'STUDENT_AUTHORIZATION_SCOPE_DIVERGED',
    );
  }
}

function assertCreationScopeBinding(scope, actorId) {
  if (
    scope.actorRole !== 'student'
    || scope.actorId !== actorId
    || scope.resourceStudentId !== actorId
    || scope.authenticatedSubject !== actorId
  ) {
    throw new AuthorizationDeniedError('CASE_CREATION_SUBJECT_SCOPE_MISMATCH');
  }
}

function assertDriverAuthorizationBinding(binding, scope) {
  if (
    !binding
    || binding.schemaVersion !== DRIVER_AUTHORIZATION_SCHEMA
    || binding.authUid !== scope.authUid
    || binding.authenticatedSubject !== scope.authenticatedSubject
    || binding.actorId !== scope.actorId
    || binding.actorRole !== scope.actorRole
    || binding.resourceStudentId !== scope.resourceStudentId
    || binding.caseId !== scope.caseId
    || binding.operation !== scope.operation
    || binding.purpose !== scope.purpose
    || binding.invitationId !== scope.invitationId
    || binding.assignmentId !== scope.assignmentId
    || binding.administrativeGrantId !== scope.administrativeGrantId
    || binding.entitlementVerified !== scope.entitlementVerified
    || binding.lorEnabled !== scope.lorEnabled
    || binding.canaryAuthorized !== scope.canaryAuthorized
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'DRIVER_AUTHORIZATION_BINDING_INVALID');
  }
}

function assertEventScopeBinding(event, scope, record) {
  const expectedCaseRef = `case_${sha256(`lor-studio:case:${record.id}`)}`;
  const expectedActorRef = `actor_${sha256(`lor-studio:actor:${scope.actorId}`)}`;
  if (
    event.caseRef !== expectedCaseRef
    || event.actorRef !== expectedActorRef
    || event.actorRole !== scope.actorRole
    || event.revision !== record.revision
    || event.occurredAt !== record.updatedAt
  ) {
    throw new DomainInvariantError('Metadata audit event must be bound to the scoped actor and exact case revision');
  }
}

function assertVersionEntryBinding(versionEntry, { spec, state, scope }) {
  if (!hasExactKeys(versionEntry, VERSION_ENTRY_KEYS)) {
    throw new ValidationError('Version entry must contain exactly its canonical metadata fields');
  }
  if (
    !Number.isSafeInteger(versionEntry.revision)
    || versionEntry.revision !== state.revision
    || versionEntry.eventType !== spec.eventType
    || versionEntry.actorId !== scope.actorId
    || toIso(versionEntry.occurredAt, 'versionEntry.occurredAt') !== state.updatedAt
    || !Array.isArray(versionEntry.changedFields)
    || versionEntry.changedFields.length === 0
    || versionEntry.changedFields.some((field) => (
      typeof field !== 'string'
      || field.trim() === ''
      || field.length > 100
    ))
    || new Set(versionEntry.changedFields).size !== versionEntry.changedFields.length
    || [...versionEntry.changedFields].sort().some((field, index) => (
      field !== versionEntry.changedFields[index]
    ))
  ) {
    throw new DomainInvariantError('Version entry is not bound to the exact student action revision');
  }
  assertSha256(versionEntry.changeHash, 'versionEntry.changeHash');
}

function assertStudentReceiptBinding(receipt, { spec, state }) {
  if (spec.receiptType === null) {
    if (receipt !== null) {
      throw new DomainInvariantError('A non-receipt command cannot carry a receipt');
    }
    return;
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new ValidationError('Student receipt command requires one canonical receipt');
  }
  const field = spec.receiptType === 'consent' ? 'consentReceipts' : 'waiverReceipts';
  const receiptHash = hashValue(receipt);
  if (!state[field].some((candidate) => hashValue(candidate) === receiptHash)) {
    throw new DomainInvariantError('Student receipt payload is not present in the committed safe state');
  }
}

function assertStudentCommandRequest(commandType, request) {
  const spec = STUDENT_COMMAND_SPECS[commandType];
  if (!spec) throw new ValidationError('Student command type is not recognized');
  const expectedKeys = spec.operation === 'create'
    ? STUDENT_CREATE_REQUEST_KEYS
    : spec.receiptType === null
      ? STUDENT_SAVE_REQUEST_KEYS
      : STUDENT_RECEIPT_REQUEST_KEYS;
  if (!hasExactKeys(request, expectedKeys)) {
    throw new ValidationError('Student command contains unrecognized or missing fields');
  }
  assertStudentSafeRecommendationCase(request.state);
  assertTrustedStudentAuthorization(request.studentWriteAuthorization);
  assertNonEmptyString(request.idempotencyKey, 'idempotencyKey', { maxLength: 200 });
  assertSha256(request.requestHash, 'requestHash');
  validateMetadataServiceEvent(request.event);
  if (
    request.event.eventType !== spec.eventType
    || request.event.revision !== request.state.revision
    || request.event.occurredAt !== request.state.updatedAt
  ) {
    throw new DomainInvariantError('Student command event is not bound to the exact action revision');
  }
  if (spec.operation === 'create') {
    if (request.state.revision !== 0) {
      throw new DomainInvariantError('Student case creation must begin at revision zero');
    }
  } else if (
    !Number.isSafeInteger(request.expectedRevision)
    || request.expectedRevision < 0
  ) {
    throw new DomainInvariantError('Student save requires a non-negative expected revision');
  }
  assertStudentReceiptBinding(request.receipt ?? null, { spec, state: request.state });
  return spec;
}

function assertAtomicStudentCommandReceipt(result, { spec, command, scope }) {
  if (!hasExactKeys(result, ATOMIC_COMMAND_RECEIPT_KEYS)) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_COMMAND_RECEIPT_FIELDS_INVALID');
  }
  assertStudentSafeRecommendationCase(result.state);
  assertSha256(result.safeRecordHash, 'atomic receipt safeRecordHash');
  assertSha256(result.protectedStateHash, 'atomic receipt protectedStateHash');
  assertSha256(result.eventHash, 'atomic receipt eventHash');
  assertNonEmptyString(result.auditEventRef, 'atomic receipt auditEventRef', { maxLength: 200 });
  assertNonEmptyString(result.transactionId, 'atomic receipt transactionId', { maxLength: 200 });
  const expectedEventHash = hashValue(command.event);
  if (
    result.schemaVersion !== ATOMIC_COMMAND_RECEIPT_SCHEMA
    || result.action !== spec.action
    || result.committed !== true
    || (result.replayed !== true && result.replayed !== false)
    || result.sameTransaction !== true
    || result.caseId !== command.state.id
    || result.studentId !== command.state.studentId
    || !Number.isSafeInteger(result.revision)
    || result.revision < 0
    || result.revision !== result.state.revision
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.state.id !== scope.caseId
    || result.state.studentId !== scope.resourceStudentId
    || (result.replayed === false && (
      result.revision !== command.state.revision
      || canonicalize(result.state) !== canonicalize(command.state)
      || result.eventHash !== expectedEventHash
      || result.auditEventRef !== command.event.eventRef
    ))
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_COMMAND_RECEIPT_BINDING_INVALID');
  }
  return cloneFrozen(result.state);
}

function assertFacultyReleaseRequest(request) {
  if (!hasExactKeys(request, FACULTY_RELEASE_REQUEST_KEYS)) {
    throw new ValidationError('Faculty release contains unrecognized or missing fields');
  }
  const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
  const actorId = assertNonEmptyString(request.actorId, 'actorId', { maxLength: 200 });
  if (!/^wp:[1-9][0-9]*$/u.test(actorId)) {
    throw new ValidationError('Faculty actorId must be the canonical wp:<id> subject');
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    throw new ValidationError('Faculty release expectedRevision must be a non-negative integer');
  }
  assertNonEmptyString(request.documentId, 'documentId', { maxLength: 200 });
  assertNonEmptyString(request.idempotencyKey, 'idempotencyKey', { maxLength: 240 });
  assertSha256(request.requestHash, 'requestHash');
  validateMetadataServiceEvent(request.event);
  if (
    request.event.eventType !== FACULTY_RELEASE_SPEC.eventType
    || request.event.actorRole !== 'faculty'
    || request.event.revision !== request.expectedRevision + 1
  ) {
    throw new DomainInvariantError('Faculty release event is not bound to the requested revision');
  }
  return { caseId, actorId };
}

function assertFacultyReleaseScopeBinding(request, scope) {
  if (
    scope.actorRole !== 'faculty'
    || scope.actorId !== request.actorId
    || scope.authenticatedSubject !== request.actorId
    || request.event.caseRef !== `case_${sha256(`lor-studio:case:${request.caseId}`)}`
    || request.event.actorRef !== `actor_${sha256(`lor-studio:actor:${request.actorId}`)}`
  ) throw new AuthorizationDeniedError('FACULTY_RELEASE_SCOPE_INVALID');
}

function assertAtomicFacultyReleaseReceipt(result, { request, scope }) {
  if (!hasExactKeys(result, ATOMIC_COMMAND_RECEIPT_KEYS)) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_COMMAND_RECEIPT_FIELDS_INVALID');
  }
  assertFacultyCaseProjection(result.state);
  assertSha256(result.safeRecordHash, 'atomic receipt safeRecordHash');
  assertSha256(result.protectedStateHash, 'atomic receipt protectedStateHash');
  assertSha256(result.eventHash, 'atomic receipt eventHash');
  assertNonEmptyString(result.auditEventRef, 'atomic receipt auditEventRef', { maxLength: 200 });
  assertNonEmptyString(result.transactionId, 'atomic receipt transactionId', { maxLength: 200 });
  if (
    result.schemaVersion !== ATOMIC_COMMAND_RECEIPT_SCHEMA
    || result.action !== FACULTY_RELEASE_SPEC.action
    || result.committed !== true
    || (result.replayed !== true && result.replayed !== false)
    || result.sameTransaction !== true
    || result.caseId !== request.caseId
    || result.studentId !== scope.resourceStudentId
    || result.state.caseId !== request.caseId
    || !Number.isSafeInteger(result.revision)
    || result.revision !== result.state.revision
    || result.idempotencyKey !== request.idempotencyKey
    || result.requestHash !== request.requestHash
    || (result.replayed === false && (
      result.revision !== request.expectedRevision + 1
      || result.eventHash !== hashValue(request.event)
      || result.auditEventRef !== request.event.eventRef
    ))
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_COMMAND_RECEIPT_BINDING_INVALID');
  }
  return cloneFrozen(result.state);
}

function assertAtomicCommitBinding(result, command) {
  const intendedRecordHash = hashValue(command.record);
  const intendedEventHash = hashValue(command.event);
  if (
    result.schemaVersion !== LEGACY_ATOMIC_COMMIT_RECEIPT_SCHEMA
    || result.operation !== command.operation
    || result.caseId !== command.record.id
    || result.revision !== command.record.revision
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.recordHash !== intendedRecordHash
    || result.eventHash !== intendedEventHash
    || result.auditEventRef !== command.event.eventRef
    || hashValue(result.record) !== intendedRecordHash
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_COMMIT_BINDING_INVALID');
  }
}

function assertCreationReservationReceipt(result, command) {
  assertDriverAuthorizationBinding(result?.authorizationBinding, command.scope);
  assertNonEmptyString(result?.caseId, 'creation reservation caseId', { maxLength: 200 });
  assertNonEmptyString(
    result?.builderSessionId,
    'creation reservation builderSessionId',
    { maxLength: 200 },
  );
  const createdAt = toIso(result?.createdAt, 'creation reservation createdAt');
  if (
    result.schemaVersion !== CREATION_RESERVATION_RECEIPT_SCHEMA
    || result.reserved !== true
    || result.durable !== true
    || result.sameTransaction !== true
    || typeof result.transactionId !== 'string'
    || result.transactionId.trim() === ''
    || typeof result.replayed !== 'boolean'
    || result.creationRef !== command.creationRef
    || result.actorRef !== command.actorRef
    || result.idempotencyKey !== command.idempotencyKey
    || result.requestHash !== command.requestHash
    || result.caseId === result.builderSessionId
    || (result.replayed === false && (
      result.caseId !== command.proposedIdentifiers.caseId
      || result.builderSessionId !== command.proposedIdentifiers.builderSessionId
      || createdAt !== command.proposedIdentifiers.createdAt
    ))
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'CREATION_RESERVATION_UNPROVEN');
  }
  return deepFreeze({
    caseId: result.caseId,
    builderSessionId: result.builderSessionId,
    createdAt,
    replayed: result.replayed,
  });
}

function assertAtomicCommand(command) {
  if (!['create', 'save'].includes(command?.operation)) {
    throw new ValidationError('Atomic case operation must be create or save');
  }
  assertRecommendationCase(command.record);
  assertNonEmptyString(command.idempotencyKey, 'idempotencyKey', { maxLength: 200 });
  assertSha256(command.requestHash, 'requestHash');
  validateMetadataServiceEvent(command.event);
  if (command.operation === 'create') {
    if (command.expectedRevision !== null || command.record.revision !== 0) {
      throw new DomainInvariantError('Atomic case creation must begin at revision zero');
    }
  } else {
    if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be a non-negative integer');
    }
    if (command.record.revision !== command.expectedRevision + 1) {
      throw new DomainInvariantError('Atomic case save must advance exactly one revision');
    }
  }
}

function throwDriverFailure(result, command) {
  if (result?.errorCode === 'NOT_FOUND') throw new NotFoundError('recommendation_case', command.record.id);
  if (result?.errorCode === 'STALE_REVISION') {
    throw new StaleRevisionError({
      caseId: command.record.id,
      expectedRevision: command.expectedRevision,
      actualRevision: result.actualRevision,
    });
  }
  if (result?.errorCode === 'IDEMPOTENCY_CONFLICT') {
    throw new IdempotencyConflictError({ idempotencyKey: command.idempotencyKey });
  }
  throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_COMMIT_UNPROVEN');
}

export class SupabaseDurableRecommendationCaseRepository extends RecommendationCaseRepositoryPort {
  /** @param {DurableRepositoryOptions} [options] */
  constructor({ binding, driver, scopeProvider } = {}) {
    super();
    this.binding = assertBinding(binding);
    this.driver = assertDriver(driver);
    if (typeof scopeProvider !== 'function') {
      throw new IntegrationDisabledError('lor_supabase_scope', 'SCOPE_PROVIDER_REQUIRED');
    }
    this.scopeProvider = scopeProvider;
    this.durability = 'DURABLE_PROVIDER_BOUND';
    this.isDurable = true;
    this.atomicStateAndEvent = true;
    this.actorSafeCommands = true;
    Object.freeze(this);
  }

  describePersistence() {
    return deepFreeze({
      durability: this.durability,
      environment: this.binding.environment,
      productionEligible: this.binding.environment === 'production',
      atomicStateAndEvent: true,
      actorSafeCommands: true,
      rlsBound: true,
      provider: this.binding.provider,
      projectId: this.binding.projectId,
      environmentId: this.binding.environmentId,
      serviceId: this.binding.serviceId,
      databaseName: this.binding.databaseName,
      region: this.binding.region,
      schema: this.binding.schema,
    });
  }

  assertProductionReady() {
    if (this.binding.environment !== 'production') {
      throw new IntegrationDisabledError('lor_supabase_repository', 'PRODUCTION_DATA_BINDING_REQUIRED');
    }
    return this.describePersistence();
  }

  async create() {
    throw new DomainInvariantError('Durable case writes require commitWithEvent');
  }

  async save() {
    throw new DomainInvariantError('Durable case writes require commitWithEvent');
  }

  /** @param {CaseCreationReservationRequest} [request] */
  async reserveCaseCreation(request = {}) {
    const { actorId, idempotencyKey, requestHash, proposedIdentifiers } = request;
    const normalizedActorId = assertNonEmptyString(actorId, 'actorId', { maxLength: 200 });
    const normalizedIdempotencyKey = assertNonEmptyString(
      idempotencyKey,
      'idempotencyKey',
      { maxLength: 200 },
    );
    assertSha256(requestHash, 'requestHash');
    assertNonEmptyString(proposedIdentifiers?.caseId, 'proposedIdentifiers.caseId', { maxLength: 200 });
    assertNonEmptyString(
      proposedIdentifiers?.builderSessionId,
      'proposedIdentifiers.builderSessionId',
      { maxLength: 200 },
    );
    const proposedCreatedAt = toIso(proposedIdentifiers?.createdAt, 'proposedIdentifiers.createdAt');
    if (proposedIdentifiers.caseId === proposedIdentifiers.builderSessionId) {
      throw new ValidationError('Case and protected builder identifiers must be distinct');
    }
    const creationRef = `case_creation_${hashValue({
      schemaVersion: 'missionmed.lor.case-creation-key.v1',
      actorId: normalizedActorId,
      idempotencyKey: normalizedIdempotencyKey,
    })}`;
    const scope = assertScope(
      await this.scopeProvider({
        caseId: creationRef,
        operation: 'create',
        resourceStudentId: normalizedActorId,
      }),
      { caseId: creationRef, operation: 'create' },
    );
    assertCreationScopeBinding(scope, normalizedActorId);
    const command = {
      binding: this.binding,
      scope,
      operation: 'reserve_create',
      creationRef,
      actorRef: `actor_${sha256(`lor-studio:actor:${normalizedActorId}`)}`,
      idempotencyKey: normalizedIdempotencyKey,
      requestHash,
      proposedIdentifiers: {
        caseId: proposedIdentifiers.caseId,
        builderSessionId: proposedIdentifiers.builderSessionId,
        createdAt: proposedCreatedAt,
      },
    };
    const result = await this.driver.reserveCaseCreation(structuredClone(command));
    return assertCreationReservationReceipt(result, command);
  }

  async readStudentSafeCase(request = {}) {
    if (!hasExactKeys(request, STUDENT_READ_REQUEST_KEYS)) {
      throw new ValidationError('Student-safe read requires exact case, student, and authorization fields');
    }
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const studentId = assertNonEmptyString(request.studentId, 'studentId', { maxLength: 200 });
    if (!/^wp:[1-9][0-9]*$/u.test(studentId)) {
      throw new ValidationError('studentId must be the canonical wp:<id> subject');
    }
    const authorization = assertTrustedStudentAuthorization(
      request.studentAccessAuthorization,
    );
    const scope = assertScope(
      await this.scopeProvider({ caseId, operation: 'read', resourceStudentId: studentId }),
      { caseId, operation: 'read' },
    );
    if (
      scope.actorRole !== 'student'
      || scope.actorId !== studentId
      || scope.authenticatedSubject !== studentId
      || scope.resourceStudentId !== studentId
    ) {
      throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
    }
    assertStudentAuthorizationScopeBinding(authorization, scope);
    const result = await this.driver.readStudentSafeCase({
      binding: this.binding,
      scope,
      caseId,
    });
    if (
      hasExactKeys(result, STUDENT_READ_RESULT_KEYS)
      && result.found === false
      && result.state === null
    ) {
      throw new NotFoundError('recommendation_case', caseId);
    }
    if (!hasExactKeys(result, STUDENT_READ_RESULT_KEYS) || result.found !== true) {
      throw new IntegrationDisabledError('lor_supabase_repository', 'STUDENT_SAFE_READ_UNPROVEN');
    }
    assertStudentSafeRecommendationCase(result.state);
    assertSafeStateScopeBinding(result.state, scope);
    return cloneFrozen(result.state);
  }

  async readFacultyCaseProjection(request = {}) {
    if (!hasExactKeys(request, FACULTY_READ_REQUEST_KEYS)) {
      throw new ValidationError('Faculty projection read requires exact caseId and actorId fields');
    }
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const actorId = assertNonEmptyString(request.actorId, 'actorId', { maxLength: 200 });
    const scope = assertScope(
      await this.scopeProvider({ caseId, operation: 'read' }),
      { caseId, operation: 'read' },
    );
    if (scope.actorRole !== 'faculty' || scope.actorId !== actorId) {
      throw new AuthorizationDeniedError('FACULTY_SCOPE_EVIDENCE_INVALID');
    }
    const result = await this.driver.readFacultyCaseProjection({
      binding: this.binding,
      scope,
      caseId,
    });
    if (
      hasExactKeys(result, FACULTY_READ_RESULT_KEYS)
      && result.found === false
      && result.projection === null
    ) throw new NotFoundError('recommendation_case', caseId);
    if (!hasExactKeys(result, FACULTY_READ_RESULT_KEYS) || result.found !== true) {
      throw new IntegrationDisabledError('lor_supabase_repository', 'FACULTY_PROJECTION_READ_UNPROVEN');
    }
    assertFacultyCaseProjection(result.projection);
    if (result.projection.caseId !== caseId) {
      throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
    }
    return cloneFrozen(result.projection);
  }

  async readMentorCaseProjection(request = {}) {
    if (!hasExactKeys(request, MENTOR_READ_REQUEST_KEYS)) {
      throw new ValidationError('Mentor projection read requires exact caseId and actorId fields');
    }
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const actorId = assertNonEmptyString(request.actorId, 'actorId', { maxLength: 200 });
    const scope = assertScope(
      await this.scopeProvider({ caseId, operation: 'read' }),
      { caseId, operation: 'read' },
    );
    if (scope.actorRole !== 'mentor' || scope.actorId !== actorId) {
      throw new AuthorizationDeniedError('MENTOR_SCOPE_EVIDENCE_INVALID');
    }
    const result = await this.driver.readMentorCaseProjection({
      binding: this.binding,
      scope,
      caseId,
    });
    if (
      hasExactKeys(result, MENTOR_READ_RESULT_KEYS)
      && result.found === false
      && result.projection === null
    ) {
      throw new NotFoundError('recommendation_case', caseId);
    }
    if (!hasExactKeys(result, MENTOR_READ_RESULT_KEYS) || result.found !== true) {
      throw new IntegrationDisabledError('lor_supabase_repository', 'MENTOR_PROJECTION_READ_UNPROVEN');
    }
    assertMentorCaseProjection(result.projection);
    if (result.projection.caseId !== caseId) {
      throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
    }
    return cloneFrozen(result.projection);
  }

  async #commitStudentCommand(commandType, request = {}) {
    const spec = assertStudentCommandRequest(commandType, request);
    const scope = assertScope(
      await this.scopeProvider({
        caseId: request.state.id,
        operation: spec.operation,
        resourceStudentId: request.state.studentId,
      }),
      { caseId: request.state.id, operation: spec.operation },
    );
    assertSafeStateScopeBinding(request.state, scope);
    assertStudentAuthorizationScopeBinding(request.studentWriteAuthorization, scope);
    assertEventScopeBinding(request.event, scope, request.state);
    assertVersionEntryBinding(request.versionEntry, {
      spec,
      state: request.state,
      scope,
    });
    const command = {
      binding: this.binding,
      scope,
      state: structuredClone(request.state),
      expectedRevision: spec.operation === 'create' ? null : request.expectedRevision,
      idempotencyKey: request.idempotencyKey,
      requestHash: request.requestHash,
      event: structuredClone(request.event),
      versionEntry: structuredClone(request.versionEntry),
      receipt: spec.receiptType === null ? null : structuredClone(request.receipt),
    };
    const commandMethod = this.driver[spec.method];
    const result = await commandMethod.call(this.driver, command);
    return assertAtomicStudentCommandReceipt(result, { spec, command, scope });
  }

  async commitStudentCaseCreate(request = {}) {
    return this.#commitStudentCommand('student.case.create', request);
  }

  async commitStudentBuilderAutosave(request = {}) {
    return this.#commitStudentCommand('student.builder.autosave', request);
  }

  async commitStudentBuilderComplete(request = {}) {
    return this.#commitStudentCommand('student.builder.complete', request);
  }

  async commitStudentConsentReceipt(request = {}) {
    return this.#commitStudentCommand('student.consent.record', request);
  }

  async commitStudentWaiverReceipt(request = {}) {
    return this.#commitStudentCommand('student.waiver.record', request);
  }

  async commitFacultyFinalDocumentRelease(request = {}) {
    assertFacultyReleaseRequest(request);
    const scope = assertScope(
      await this.scopeProvider({ caseId: request.caseId, operation: 'save' }),
      { caseId: request.caseId, operation: 'save' },
    );
    assertFacultyReleaseScopeBinding(request, scope);
    const command = {
      binding: this.binding,
      scope,
      expectedRevision: request.expectedRevision,
      documentId: request.documentId,
      idempotencyKey: request.idempotencyKey,
      requestHash: request.requestHash,
      event: structuredClone(request.event),
    };
    const result = await this.driver.commitFacultyFinalDocumentRelease(command);
    return assertAtomicFacultyReleaseReceipt(result, { request, scope });
  }

  async getById(caseId) {
    assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
    const scope = assertScope(
      await this.scopeProvider({ caseId, operation: 'read' }),
      { caseId, operation: 'read' },
    );
    const result = await this.driver.selectCase({
      binding: this.binding,
      scope,
      caseId,
    });
    if (!result || result.found !== true) {
      throw new NotFoundError('recommendation_case', caseId);
    }
    assertRecommendationCase(result.record);
    assertRecordScopeBinding(result.record, scope);
    assertDriverAuthorizationBinding(result.authorizationBinding, scope);
    return cloneFrozen(result.record);
  }

  async commitWithEvent(command) {
    assertAtomicCommand(command);
    const caseId = command.record.id;
    const scope = assertScope(
      await this.scopeProvider({
        caseId,
        operation: command.operation,
        resourceStudentId: command.record.studentId,
      }),
      { caseId, operation: command.operation },
    );
    assertRecordScopeBinding(command.record, scope);
    assertEventScopeBinding(command.event, scope, command.record);
    const result = await this.driver.executeAtomicCaseCommand({
      binding: this.binding,
      scope,
      operation: command.operation,
      record: structuredClone(command.record),
      expectedRevision: command.expectedRevision,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
      event: structuredClone(command.event),
    });
    if (
      !result
      || result.committed !== true
      || result.stateCommitted !== true
      || result.auditCommitted !== true
      || result.sameTransaction !== true
      || typeof result.transactionId !== 'string'
      || result.transactionId.trim() === ''
    ) {
      throwDriverFailure(result, command);
    }
    assertDriverAuthorizationBinding(result.authorizationBinding, scope);
    assertRecommendationCase(result.record);
    assertRecordScopeBinding(result.record, scope);
    assertAtomicCommitBinding(result, command);
    if (result.record.id !== caseId || result.record.revision !== command.record.revision) {
      throw new DomainInvariantError('Atomic commit receipt does not match the requested case revision');
    }
    return cloneFrozen(result.record);
  }
}

export const SUPABASE_LOR_REPOSITORY_CONTRACT = deepFreeze({
  // No target descriptors are published here. Exporting a ready-made production
  // target is itself an implicit binding path, so callers must build and ratify a
  // configuration and resolve it through the target-binding adapter.
  targetBinding: 'injected_validated_lor_target_binding',
  targetBindingSchema: LOR_TARGET_BINDING_CONTRACT.schemaVersion,
  targetBindingAuthority: LOR_TARGET_BINDING_CONTRACT.authority,
  defaultTarget: null,
  schema: LOR_TARGET_BINDING_CONTRACT.schema,
  serverScopeSchema: SERVER_SCOPE_SCHEMA,
  driverAuthorizationSchema: DRIVER_AUTHORIZATION_SCHEMA,
  creationReservationReceiptSchema: CREATION_RESERVATION_RECEIPT_SCHEMA,
  identifierAllocation: 'durable_atomic_server_only_creation_reservation',
  legacyAtomicCommitReceiptSchema: LEGACY_ATOMIC_COMMIT_RECEIPT_SCHEMA,
  atomicCommandReceiptSchema: ATOMIC_COMMAND_RECEIPT_SCHEMA,
  actorSafeCommands: [...Object.keys(STUDENT_COMMAND_SPECS), FACULTY_RELEASE_SPEC.action],
  studentReadBoundary: 'exact_student_safe_case_v1_only',
  facultyReadBoundary: 'exact_seven_field_faculty_projection_only',
  facultyReleaseBoundary: FACULTY_RELEASE_SPEC.action,
  mentorReadBoundary: 'exact_five_field_projection_only',
  commandReplay: 'receipt_lookup_and_action_request_binding_before_candidate_validation',
  writeAtomicity: 'case_state_and_metadata_audit_same_transaction',
  commitBinding: 'canonical_record_event_request_idempotency_operation_case_revision_and_audit',
  queryBoundary: 'verified_subject_role_case_operation_and_assignment_or_invitation_or_grant',
});
