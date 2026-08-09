import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  NotFoundError,
  StaleRevisionError,
  ValidationError,
} from '../domain/errors.js';
import { assertRecommendationCase } from '../domain/recommendation-case.js';
import {
  assertNonEmptyString,
  cloneFrozen,
  deepFreeze,
  hashValue,
  sha256,
} from '../domain/value-utils.js';
import { RecommendationCaseRepositoryPort } from '../services/ports.js';
import { validateMetadataServiceEvent } from '../services/metadata-events.js';

const RANKLISTIQ_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const LOR_SCHEMA = 'lor_studio';
const LOR_STAGING_BRANCH = 'lor-staging';
const SERVER_SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const DRIVER_AUTHORIZATION_SCHEMA = 'missionmed.lor.driver-authorization-binding.v1';
const ATOMIC_COMMIT_RECEIPT_SCHEMA = 'missionmed.lor.atomic-commit-receipt.v1';
const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'founder', 'support', 'service']);
const HUMAN_ROLES = new Set(['student', 'faculty', 'mentor', 'admin', 'founder', 'support']);

function assertSha256(value, fieldName) {
  if (!/^[a-f0-9]{64}$/u.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`, { fieldName });
  }
}

function assertBinding(binding) {
  if (
    !binding
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.health !== 'ready'
    || binding.projectRef !== RANKLISTIQ_PROJECT_REF
    || binding.branchName !== LOR_STAGING_BRANCH
    || typeof binding.branchId !== 'string'
    || binding.branchId.trim() === ''
    || binding.schema !== LOR_SCHEMA
    || binding.dataCopied !== false
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'RESOURCE_BINDING_REQUIRED');
  }
  return deepFreeze({
    projectRef: binding.projectRef,
    branchName: binding.branchName,
    branchId: binding.branchId,
    schema: binding.schema,
  });
}

function assertDriver(driver) {
  if (
    !driver
    || driver.atomicStateAndAudit !== true
    || driver.rlsEnforced !== true
    || driver.serverOnly !== true
    || typeof driver.selectCase !== 'function'
    || typeof driver.executeAtomicCaseCommand !== 'function'
  ) {
    throw new IntegrationDisabledError('lor_supabase_repository', 'ATOMIC_RLS_DRIVER_REQUIRED');
  }
  return driver;
}

function assertScope(rawScope, { caseId, operation }) {
  if (
    !rawScope
    || rawScope.schemaVersion !== SERVER_SCOPE_SCHEMA
    || rawScope.authoritySource !== 'server_verified_session_crosswalk'
    || rawScope.authenticated !== true
    || rawScope.roleVerified !== true
    || rawScope.clientAsserted === true
  ) {
    throw new IntegrationDisabledError('lor_supabase_scope', 'VERIFIED_SERVER_SCOPE_REQUIRED');
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
    if (rawScope.assignmentId != null || rawScope.administrativeGrantId != null) {
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

function assertAtomicCommitBinding(result, command) {
  const intendedRecordHash = hashValue(command.record);
  const intendedEventHash = hashValue(command.event);
  if (
    result.schemaVersion !== ATOMIC_COMMIT_RECEIPT_SCHEMA
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
    Object.freeze(this);
  }

  describePersistence() {
    return deepFreeze({
      durability: this.durability,
      productionEligible: true,
      atomicStateAndEvent: true,
      rlsBound: true,
      projectRef: this.binding.projectRef,
      branchName: this.binding.branchName,
      branchId: this.binding.branchId,
      schema: this.binding.schema,
    });
  }

  assertProductionReady() {
    return this.describePersistence();
  }

  async create() {
    throw new DomainInvariantError('Durable case writes require commitWithEvent');
  }

  async save() {
    throw new DomainInvariantError('Durable case writes require commitWithEvent');
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
  projectRef: RANKLISTIQ_PROJECT_REF,
  branchName: LOR_STAGING_BRANCH,
  schema: LOR_SCHEMA,
  serverScopeSchema: SERVER_SCOPE_SCHEMA,
  driverAuthorizationSchema: DRIVER_AUTHORIZATION_SCHEMA,
  atomicCommitReceiptSchema: ATOMIC_COMMIT_RECEIPT_SCHEMA,
  writeAtomicity: 'case_state_and_metadata_audit_same_transaction',
  commitBinding: 'canonical_record_event_request_idempotency_operation_case_revision_and_audit',
  queryBoundary: 'verified_subject_role_case_operation_and_assignment_or_invitation_or_grant',
});
