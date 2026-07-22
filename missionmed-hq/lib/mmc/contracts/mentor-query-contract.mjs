import crypto from 'node:crypto';

import { buildQueryEnvelope } from './state-contract.mjs';
import { canonicalUuid } from './uuid-contract.mjs';
import { MmcHttpError } from '../trust/security.mjs';

export const MMC_MENTOR_QUERY_SCHEMA_VERSION = 1;
export const MMC_MENTOR_COMMAND_SCHEMA_VERSION = 1;

const enumOf = (...values) => Object.freeze(Object.fromEntries(values.map((value) => [value, value])));

export const MENTOR_QUERY_KIND = Object.freeze({
  TODAY: 'MENTOR_TODAY',
  STUDENTS: 'STUDENT_DIRECTORY',
  STUDENT_OVERVIEW: 'STUDENT_OVERVIEW',
  STUDENT_PLAN: 'STUDENT_PLAN',
  STUDENT_HISTORY: 'STUDENT_HISTORY',
  SESSION_DETAIL: 'SESSION_DETAIL',
  STUDENT_FILES: 'STUDENT_FILES',
  CALL_PREP: 'CALL_PREP',
  LIVE_SESSION: 'LIVE_SESSION',
  SESSION_REVIEW: 'SESSION_REVIEW',
  WORK: 'MENTOR_WORK',
  REVIEWS: 'MENTOR_REVIEWS',
  OPERATIONS: 'MENTOR_OPERATIONS',
});

export const MMC_MENTOR_COMMAND_KINDS = Object.freeze([
  'session.start',
  'capture.save',
  'session.pause',
  'session.resume',
  'session.end_for_review',
  'review.decide',
  'attention.defer',
  'attention.dismiss',
  'plan.update',
  'commitment.upsert',
  'task.upsert',
]);

export const MENTOR_CAPTURE_KINDS = Object.freeze([
  'STUDENT_TASK',
  'MENTOR_TASK',
  'MUTUAL_COMMITMENT',
  'PRIVATE_MEMORY',
  'QUESTION',
  'FLAG',
  'PUBLICATION_CANDIDATE',
]);

export const MENTOR_ATTENTION_CATEGORY = enumOf(
  'PRIVACY_SAFETY_DECISION',
  'AUTHORITATIVE_DEADLINE',
  'OVERDUE_MENTOR_PROMISE',
  'SCHEDULED_CALL_PREP',
  'STUDENT_COMMITMENT_FOLLOW_THROUGH',
  'REVIEW_WAIT',
  'DATA_SUFFICIENCY',
);
export const MENTOR_SESSION_STATE = enumOf('SCHEDULED', 'ACTIVE', 'PAUSED', 'REVIEW_REQUIRED', 'CLOSED');
export const MENTOR_REVIEW_DECISION = enumOf('ACCEPT', 'REJECT', 'DEFER', 'REQUEST_EVIDENCE');
export const MENTOR_PLAN_STATE = enumOf('DRAFT', 'ACTIVE', 'ACHIEVED', 'PAUSED', 'CANCELLED');
export const MENTOR_WORK_OWNER = enumOf('MENTOR', 'STUDENT', 'SHARED');
export const MENTOR_TASK_STATE = enumOf('DRAFT', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
export const MENTOR_COMMITMENT_STATE = enumOf(
  'DRAFT', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'DISPUTED',
);
export const MENTOR_SAVE_STATE = enumOf('SAVED', 'SAVING', 'NOT_SAVED', 'FAILED', 'CONFLICT');
export const MENTOR_CONNECTIVITY = enumOf('ONLINE', 'OFFLINE');
export const MENTOR_REVIEW_COMPLEXITY = enumOf('SMALL_MANUAL', 'BOUNDED_ASSISTED', 'COMPLEX_DEFERRED');

const QUERY_DATA_KEYS = Object.freeze({
  [MENTOR_QUERY_KIND.TODAY]: Object.freeze([
    'kind', 'version', 'attention', 'disclosure', 'upcomingCall', 'mentorPromises',
    'reviewWaits', 'operatingState',
  ]),
  [MENTOR_QUERY_KIND.STUDENTS]: Object.freeze([
    'kind', 'version', 'students', 'total', 'nextCursor',
  ]),
  [MENTOR_QUERY_KIND.STUDENT_OVERVIEW]: Object.freeze([
    'kind', 'subjectLink', 'assignment', 'version', 'changes', 'nextSafeMove',
    'upcomingCall', 'commitments', 'dataSufficiency', 'handlingContext',
  ]),
  [MENTOR_QUERY_KIND.STUDENT_PLAN]: Object.freeze([
    'kind', 'subjectLinkId', 'version', 'goals', 'milestones', 'tasks',
    'commitments', 'openLoops',
  ]),
  [MENTOR_QUERY_KIND.STUDENT_HISTORY]: Object.freeze([
    'kind', 'subjectLinkId', 'version', 'sessions', 'observations', 'timeline',
    'corrections', 'nextCursor',
  ]),
  [MENTOR_QUERY_KIND.SESSION_DETAIL]: Object.freeze([
    'kind', 'subjectLinkId', 'session', 'captures', 'proposals', 'evidence',
  ]),
  [MENTOR_QUERY_KIND.STUDENT_FILES]: Object.freeze([
    'kind', 'subjectLinkId', 'version', 'files', 'nextCursor',
  ]),
  [MENTOR_QUERY_KIND.CALL_PREP]: Object.freeze([
    'kind', 'subjectLinkId', 'version', 'objective', 'changes', 'commitments',
    'nextQuestion', 'milestone', 'handlingContext', 'dataGaps', 'pinnedObjectIds',
  ]),
  [MENTOR_QUERY_KIND.LIVE_SESSION]: Object.freeze([
    'kind', 'subjectLinkId', 'session', 'objective', 'priorCommitments', 'captures',
    'saveState', 'connectivity', 'subjectLocked',
  ]),
  [MENTOR_QUERY_KIND.SESSION_REVIEW]: Object.freeze([
    'kind', 'subjectLinkId', 'session', 'items', 'complexityBand', 'publicationPlane',
  ]),
  [MENTOR_QUERY_KIND.WORK]: Object.freeze([
    'kind', 'version', 'items', 'total', 'nextCursor', 'filters',
  ]),
  [MENTOR_QUERY_KIND.REVIEWS]: Object.freeze([
    'kind', 'version', 'queueKind', 'items', 'total', 'nextCursor',
  ]),
  [MENTOR_QUERY_KIND.OPERATIONS]: Object.freeze([
    'kind', 'version', 'areas', 'health', 'providerIntegrations',
    'durablePersistence', 'studentPublication',
  ]),
});

const COMMAND_FIELDS = Object.freeze([
  'commandId',
  'idempotencyKey',
  'expectedVersion',
  'targetId',
  'kind',
  'purpose',
  'payload',
  'schemaVersion',
]);

export const MMC_ROUTE_SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u;

export function isMmcRouteSafeId(value) {
  return typeof value === 'string' && MMC_ROUTE_SAFE_ID_PATTERN.test(value);
}

const AUTHORITY_FIELD_PATTERN = /^(?:tenant|tenantId|environment|principal|principalId|actor|actorId|role|capabilities|assignment|assignmentId|workload|workloadId|queueName|issuer|audience)$/u;

export function buildMentorQueryEnvelope({ kind, data, meta }) {
  validateMentorQueryData(kind, data);
  return buildQueryEnvelope({ data, meta });
}

export function validateMentorQueryData(kind, data) {
  const allowedKeys = QUERY_DATA_KEYS[kind];
  if (!allowedKeys) throw queryInvalid('MENTOR_QUERY_KIND_INVALID', 'The mentor query kind is invalid.');
  assertPlainObject(data, 'query data', queryInvalid);
  assertExactFields(data, allowedKeys, allowedKeys, 'query data', queryInvalid);
  if (data.kind !== kind) throw queryInvalid('MENTOR_QUERY_KIND_MISMATCH', 'The mentor query payload kind is invalid.');

  validateQueryVersion(data);
  validateQueryResource(kind, data);
  return true;
}

export function validateMentorCommandEnvelope(input) {
  assertPlainObject(input, 'command', commandInvalid);
  assertExactFields(input, COMMAND_FIELDS, COMMAND_FIELDS, 'command', commandInvalid);
  const kind = requireEnum(input.kind, MMC_MENTOR_COMMAND_KINDS, 'kind');
  const targetId = requireRouteSafeId(input.targetId, 'targetId');
  if (kind === 'capture.save' && `review_capture_${targetId}`.length > 200) {
    throw commandInvalid(
      'MENTOR_COMMAND_IDENTIFIER_INVALID',
      'targetId is too long for a capture review identifier.',
    );
  }
  const command = {
    commandId: requireUuid(input.commandId, 'commandId'),
    idempotencyKey: requireOpaqueText(input.idempotencyKey, 'idempotencyKey', 8, 200),
    expectedVersion: requireNonNegativeInteger(input.expectedVersion, 'expectedVersion'),
    targetId,
    kind,
    purpose: requirePlainText(input.purpose, 'purpose', 3, 160),
    payload: validateMentorCommandPayload(kind, input.payload),
    schemaVersion: requireExactInteger(
      input.schemaVersion,
      MMC_MENTOR_COMMAND_SCHEMA_VERSION,
      'schemaVersion',
    ),
  };
  assertNoAuthorityFields(command.payload);
  return deepFreeze(command);
}

export function mentorCommandSemanticHash(input) {
  const command = validateMentorCommandEnvelope(input);
  return sha256(canonicalJson({
    expectedVersion: command.expectedVersion,
    kind: command.kind,
    payload: command.payload,
    purpose: command.purpose,
    schemaVersion: command.schemaVersion,
    targetId: command.targetId,
  }));
}

export function mentorCommandIdempotencyScope(input, principal) {
  const command = validateMentorCommandEnvelope(input);
  const scope = {
    tenantId: requireOpaqueText(principal?.tenantId, 'principal.tenantId', 3, 200),
    environment: requireEnum(principal?.environment, ['FIXTURE', 'LOCAL'], 'principal.environment'),
    principalId: requireOpaqueText(principal?.id, 'principal.id', 3, 200),
    kind: command.kind,
    targetId: command.targetId,
    schemaVersion: command.schemaVersion,
    idempotencyKey: command.idempotencyKey,
  };
  return sha256(canonicalJson(scope));
}

export function validateMentorCommandResult(result) {
  assertPlainObject(result, 'command result', commandResultInvalid);
  const fields = [
    'ok', 'status', 'commandId', 'aggregateVersion', 'objectResults', 'auditId',
    'correlationId', 'replayed', 'readback',
  ];
  assertExactFields(result, fields, fields, 'command result', commandResultInvalid);
  if (result.ok !== true || result.status !== 'COMMITTED' || typeof result.replayed !== 'boolean') {
    throw commandResultInvalid('MENTOR_COMMAND_RESULT_INVALID', 'The mentor command result is invalid.');
  }
  requireUuid(result.commandId, 'command result commandId');
  requirePositiveInteger(result.aggregateVersion, 'command result aggregateVersion');
  requireOpaqueText(result.auditId, 'command result auditId', 8, 200);
  requireOpaqueText(result.correlationId, 'command result correlationId', 8, 200);
  if (!Array.isArray(result.objectResults) || result.objectResults.length < 1 || result.objectResults.length > 100) {
    throw commandResultInvalid('MENTOR_COMMAND_RESULT_INVALID', 'The mentor command result is invalid.');
  }
  for (const objectResult of result.objectResults) {
    assertPlainObject(objectResult, 'command object result', commandResultInvalid);
    assertExactFields(
      objectResult,
      ['id', 'kind', 'version'],
      ['id', 'kind', 'version'],
      'command object result',
      commandResultInvalid,
    );
    requireRouteSafeId(objectResult.id, 'command object result id');
    requireEnum(objectResult.kind, [
      'SESSION', 'CAPTURE', 'PROPOSAL', 'ATTENTION', 'PLAN', 'COMMITMENT', 'TASK',
    ], 'command object result kind');
    requirePositiveInteger(objectResult.version, 'command object result version');
  }
  assertPlainObject(result.readback, 'command readback', commandResultInvalid);
  assertExactFields(
    result.readback,
    ['id', 'kind', 'version', 'subjectLinkId', 'assignmentId', 'state'],
    ['id', 'kind', 'version', 'subjectLinkId', 'assignmentId', 'state'],
    'command readback',
    commandResultInvalid,
  );
  if (result.readback.id !== result.objectResults[0].id
      || result.readback.kind !== result.objectResults[0].kind
      || result.readback.version !== result.objectResults[0].version) {
    throw commandResultInvalid('MENTOR_COMMAND_READBACK_MISMATCH', 'The command readback is inconsistent.');
  }
  return true;
}

function validateQueryVersion(data) {
  if (Object.hasOwn(data, 'version')) requirePositiveInteger(data.version, 'query data version', queryInvalid);
}

function validateQueryResource(kind, data) {
  switch (kind) {
    case MENTOR_QUERY_KIND.TODAY:
      requireArray(data.attention, 'attention', 7);
      data.attention.forEach(validateAttention);
      requireArray(data.mentorPromises, 'mentorPromises', 100);
      requireArray(data.reviewWaits, 'reviewWaits', 100);
      assertPlainObject(data.disclosure, 'disclosure', queryInvalid);
      assertExactFields(data.disclosure, ['initialLimit', 'additionalCount'], ['initialLimit', 'additionalCount'], 'disclosure', queryInvalid);
      requireIntegerRange(data.disclosure.initialLimit, 1, 3, 'disclosure.initialLimit', queryInvalid);
      requireIntegerRange(data.disclosure.additionalCount, 0, 4, 'disclosure.additionalCount', queryInvalid);
      assertPlainObject(data.operatingState, 'operatingState', queryInvalid);
      assertExactFields(
        data.operatingState,
        ['authority', 'persistence', 'providers', 'studentPublication'],
        ['authority', 'persistence', 'providers', 'studentPublication'],
        'operatingState',
        queryInvalid,
      );
      requireEnum(data.operatingState.authority, ['DETERMINISTIC_LOCAL_FIXTURE'], 'operatingState.authority');
      requireEnum(data.operatingState.persistence, ['LOCAL_IN_MEMORY'], 'operatingState.persistence');
      requireEnum(data.operatingState.providers, ['DISABLED'], 'operatingState.providers');
      requireEnum(data.operatingState.studentPublication, ['DISABLED_UNTIL_008'], 'operatingState.studentPublication');
      break;
    case MENTOR_QUERY_KIND.STUDENTS:
      requireArray(data.students, 'students', 100);
      data.students.forEach(validateStudentSummary);
      validatePagination(data.total, data.nextCursor);
      break;
    case MENTOR_QUERY_KIND.STUDENT_OVERVIEW:
      validateSubjectLink(data.subjectLink);
      validateAssignment(data.assignment);
      requireArray(data.changes, 'changes', 100);
      requireArray(data.commitments, 'commitments', 100);
      requireArray(data.dataSufficiency, 'dataSufficiency', 100);
      requireArray(data.handlingContext, 'handlingContext', 100);
      break;
    case MENTOR_QUERY_KIND.STUDENT_PLAN:
      requireSubjectLinkId(data.subjectLinkId);
      ['goals', 'milestones', 'tasks', 'commitments', 'openLoops'].forEach((field) => requireArray(data[field], field, 100));
      break;
    case MENTOR_QUERY_KIND.STUDENT_HISTORY:
      requireSubjectLinkId(data.subjectLinkId);
      ['sessions', 'observations', 'timeline', 'corrections'].forEach((field) => requireArray(data[field], field, 100));
      validateOptionalCursor(data.nextCursor);
      break;
    case MENTOR_QUERY_KIND.SESSION_DETAIL:
      requireSubjectLinkId(data.subjectLinkId);
      validateSession(data.session);
      ['captures', 'proposals', 'evidence'].forEach((field) => requireArray(data[field], field, 100));
      break;
    case MENTOR_QUERY_KIND.STUDENT_FILES:
      requireSubjectLinkId(data.subjectLinkId);
      requireArray(data.files, 'files', 100);
      validateOptionalCursor(data.nextCursor);
      break;
    case MENTOR_QUERY_KIND.CALL_PREP:
      requireSubjectLinkId(data.subjectLinkId);
      ['changes', 'commitments', 'handlingContext', 'dataGaps', 'pinnedObjectIds'].forEach((field) => requireArray(data[field], field, 100));
      break;
    case MENTOR_QUERY_KIND.LIVE_SESSION:
      requireSubjectLinkId(data.subjectLinkId);
      validateSession(data.session);
      requireArray(data.priorCommitments, 'priorCommitments', 100);
      requireArray(data.captures, 'captures', 100);
      requireEnum(data.saveState, Object.values(MENTOR_SAVE_STATE), 'saveState');
      requireEnum(data.connectivity, Object.values(MENTOR_CONNECTIVITY), 'connectivity');
      if (data.subjectLocked !== true) throw queryInvalid('MENTOR_QUERY_SUBJECT_UNLOCKED', 'A live session must pin its subject.');
      break;
    case MENTOR_QUERY_KIND.SESSION_REVIEW:
      requireSubjectLinkId(data.subjectLinkId);
      validateSession(data.session);
      requireArray(data.items, 'items', 100);
      requireEnum(data.complexityBand, Object.values(MENTOR_REVIEW_COMPLEXITY), 'complexityBand');
      requireEnum(data.publicationPlane, ['DISABLED_UNTIL_008'], 'publicationPlane');
      break;
    case MENTOR_QUERY_KIND.WORK:
      requireArray(data.items, 'items', 100);
      validatePagination(data.total, data.nextCursor);
      requireArray(data.filters, 'filters', 20);
      break;
    case MENTOR_QUERY_KIND.REVIEWS:
      requireArray(data.items, 'items', 100);
      validatePagination(data.total, data.nextCursor);
      requirePlainText(data.queueKind, 'queueKind', 1, 64);
      break;
    case MENTOR_QUERY_KIND.OPERATIONS:
      requireArray(data.areas, 'areas', 20);
      assertPlainObject(data.health, 'health', queryInvalid);
      requireEnum(data.providerIntegrations, ['UNAVAILABLE'], 'providerIntegrations');
      requireEnum(data.durablePersistence, ['UNAVAILABLE'], 'durablePersistence');
      requireEnum(data.studentPublication, ['DISABLED_UNTIL_008'], 'studentPublication');
      break;
    default:
      throw queryInvalid('MENTOR_QUERY_KIND_INVALID', 'The mentor query kind is invalid.');
  }
}

function validateMentorCommandPayload(kind, payload) {
  assertPlainObject(payload, 'payload', commandInvalid);
  if (Buffer.byteLength(canonicalJson(payload), 'utf8') > 32 * 1024) {
    throw new MmcHttpError(413, 'MENTOR_COMMAND_PAYLOAD_TOO_LARGE', 'The mentor command payload is too large.');
  }

  switch (kind) {
    case 'session.start':
      assertExactFields(payload, ['subjectLinkId', 'objective', 'scheduledCallId'], ['subjectLinkId', 'objective'], 'payload', commandInvalid);
      return compact({
        subjectLinkId: requireRouteSafeId(payload.subjectLinkId, 'payload.subjectLinkId'),
        objective: requirePlainText(payload.objective, 'payload.objective', 3, 1000),
        scheduledCallId: optionalOpaqueText(payload.scheduledCallId, 'payload.scheduledCallId'),
      });
    case 'capture.save':
      assertExactFields(payload, ['subjectLinkId', 'sessionId', 'captureKind', 'text', 'occurredAt'], ['subjectLinkId', 'sessionId', 'captureKind', 'text'], 'payload', commandInvalid);
      return compact({
        subjectLinkId: requireRouteSafeId(payload.subjectLinkId, 'payload.subjectLinkId'),
        sessionId: requireRouteSafeId(payload.sessionId, 'payload.sessionId'),
        captureKind: requireEnum(payload.captureKind, MENTOR_CAPTURE_KINDS, 'payload.captureKind'),
        text: requirePlainText(payload.text, 'payload.text', 1, 8000),
        occurredAt: optionalUtcTimestamp(payload.occurredAt, 'payload.occurredAt'),
      });
    case 'session.pause':
      assertExactFields(payload, ['reason'], [], 'payload', commandInvalid);
      return compact({ reason: optionalPlainText(payload.reason, 'payload.reason', 1000) });
    case 'session.resume':
      assertExactFields(payload, [], [], 'payload', commandInvalid);
      return {};
    case 'session.end_for_review':
      assertExactFields(payload, ['summary'], [], 'payload', commandInvalid);
      return compact({ summary: optionalPlainText(payload.summary, 'payload.summary', 8000) });
    case 'review.decide':
      assertExactFields(payload, ['decision', 'editedText', 'rationale', 'policyVersionId'], ['decision', 'rationale', 'policyVersionId'], 'payload', commandInvalid);
      return compact({
        decision: requireEnum(payload.decision, Object.values(MENTOR_REVIEW_DECISION), 'payload.decision'),
        editedText: optionalPlainText(payload.editedText, 'payload.editedText', 8000),
        rationale: requirePlainText(payload.rationale, 'payload.rationale', 3, 2000),
        policyVersionId: requireOpaqueText(payload.policyVersionId, 'payload.policyVersionId', 3, 200),
      });
    case 'attention.defer':
    case 'attention.dismiss':
      assertExactFields(payload, ['sourceVersion', 'reason', 'expiresAt'], ['sourceVersion', 'reason', 'expiresAt'], 'payload', commandInvalid);
      return {
        sourceVersion: requirePositiveInteger(payload.sourceVersion, 'payload.sourceVersion'),
        reason: requirePlainText(payload.reason, 'payload.reason', 3, 1000),
        expiresAt: requireUtcTimestamp(payload.expiresAt, 'payload.expiresAt'),
      };
    case 'plan.update':
      assertExactFields(payload, ['subjectLinkId', 'title', 'objective', 'status', 'targetDate'], ['subjectLinkId', 'title', 'objective', 'status'], 'payload', commandInvalid);
      return compact({
        subjectLinkId: requireRouteSafeId(payload.subjectLinkId, 'payload.subjectLinkId'),
        title: requirePlainText(payload.title, 'payload.title', 1, 300),
        objective: requirePlainText(payload.objective, 'payload.objective', 3, 4000),
        status: requireEnum(payload.status, Object.values(MENTOR_PLAN_STATE), 'payload.status'),
        targetDate: optionalDate(payload.targetDate, 'payload.targetDate'),
      });
    case 'commitment.upsert':
      assertExactFields(payload, ['subjectLinkId', 'title', 'details', 'ownerType', 'dueAt', 'status', 'sensitivity'], ['subjectLinkId', 'title', 'ownerType', 'status', 'sensitivity'], 'payload', commandInvalid);
      return compact({
        subjectLinkId: requireRouteSafeId(payload.subjectLinkId, 'payload.subjectLinkId'),
        title: requirePlainText(payload.title, 'payload.title', 1, 300),
        details: optionalPlainText(payload.details, 'payload.details', 4000),
        ownerType: requireEnum(payload.ownerType, Object.values(MENTOR_WORK_OWNER), 'payload.ownerType'),
        dueAt: optionalUtcTimestamp(payload.dueAt, 'payload.dueAt'),
        status: requireEnum(payload.status, Object.values(MENTOR_COMMITMENT_STATE), 'payload.status'),
        sensitivity: requireEnum(payload.sensitivity, ['NORMAL', 'RESTRICTED', 'SENSITIVE'], 'payload.sensitivity'),
      });
    case 'task.upsert':
      assertExactFields(payload, ['subjectLinkId', 'title', 'details', 'dueAt', 'ownerType', 'status', 'sensitivity'], ['subjectLinkId', 'title', 'ownerType', 'status', 'sensitivity'], 'payload', commandInvalid);
      return compact({
        subjectLinkId: requireRouteSafeId(payload.subjectLinkId, 'payload.subjectLinkId'),
        title: requirePlainText(payload.title, 'payload.title', 1, 300),
        details: optionalPlainText(payload.details, 'payload.details', 4000),
        dueAt: optionalUtcTimestamp(payload.dueAt, 'payload.dueAt'),
        ownerType: requireEnum(payload.ownerType, Object.values(MENTOR_WORK_OWNER), 'payload.ownerType'),
        status: requireEnum(payload.status, Object.values(MENTOR_TASK_STATE), 'payload.status'),
        sensitivity: requireEnum(payload.sensitivity, ['NORMAL', 'RESTRICTED', 'SENSITIVE'], 'payload.sensitivity'),
      });
    default:
      throw commandInvalid('MENTOR_COMMAND_KIND_UNSUPPORTED', 'The mentor command kind is unsupported.');
  }
}

function validateAttention(value) {
  assertPlainObject(value, 'attention item', queryInvalid);
  const keys = [
    'id', 'version', 'subjectLinkId', 'studentName', 'category', 'reason', 'dueAt',
    'firstObservedAt', 'sourceVersion', 'nextAction', 'evidence', 'ageDays', 'disposition',
  ];
  assertExactFields(value, keys, keys, 'attention item', queryInvalid);
  requireOpaqueText(value.id, 'attention.id', 3, 200);
  requirePositiveInteger(value.version, 'attention.version', queryInvalid);
  requireSubjectLinkId(value.subjectLinkId);
  requireEnum(value.category, Object.values(MENTOR_ATTENTION_CATEGORY), 'attention.category');
  requirePositiveInteger(value.sourceVersion, 'attention.sourceVersion');
  requireIntegerRange(value.ageDays, 0, 100_000, 'attention.ageDays', queryInvalid);
  requireEnum(value.disposition, ['OPEN'], 'attention.disposition');
  assertPlainObject(value.evidence, 'attention.evidence', queryInvalid);
  assertExactFields(value.evidence, ['origin', 'freshness', 'reviewState', 'sourceLabel', 'observedAt'], ['origin', 'freshness', 'reviewState', 'sourceLabel', 'observedAt'], 'attention.evidence', queryInvalid);
}

function validateStudentSummary(value) {
  assertPlainObject(value, 'student summary', queryInvalid);
  const keys = ['subjectLinkId', 'displayName', 'program', 'cohort', 'assignmentId', 'assignmentState', 'freshness', 'nextAction'];
  assertExactFields(value, keys, keys, 'student summary', queryInvalid);
  requireSubjectLinkId(value.subjectLinkId);
  requireOpaqueText(value.assignmentId, 'student.assignmentId', 3, 200);
  requireEnum(value.assignmentState, ['ACTIVE'], 'student.assignmentState');
}

function validateSubjectLink(value) {
  assertPlainObject(value, 'subject link', queryInvalid);
  assertExactFields(value, ['id', 'displayName', 'identityState', 'version'], ['id', 'displayName', 'identityState', 'version'], 'subject link', queryInvalid);
  requireSubjectLinkId(value.id);
  requireEnum(value.identityState, ['VERIFIED_LOCAL_LINK'], 'subjectLink.identityState');
  requirePositiveInteger(value.version, 'subjectLink.version');
}

function validateAssignment(value) {
  assertPlainObject(value, 'assignment', queryInvalid);
  assertExactFields(value, ['id', 'state', 'version', 'startedAt', 'expiresAt'], ['id', 'state', 'version', 'startedAt', 'expiresAt'], 'assignment', queryInvalid);
  requireOpaqueText(value.id, 'assignment.id', 3, 200);
  requireEnum(value.state, ['ACTIVE'], 'assignment.state');
  requirePositiveInteger(value.version, 'assignment.version');
}

function validateSession(value) {
  assertPlainObject(value, 'session', queryInvalid);
  const required = ['id', 'version', 'status', 'startedAt', 'updatedAt', 'subjectLinkId', 'assignmentId'];
  for (const field of required) {
    if (!Object.hasOwn(value, field)) throw queryInvalid('MENTOR_QUERY_SESSION_INVALID', `Missing session field: ${field}.`);
  }
  requireOpaqueText(value.id, 'session.id', 3, 200);
  requirePositiveInteger(value.version, 'session.version');
  requireEnum(value.status, Object.values(MENTOR_SESSION_STATE), 'session.status');
  requireSubjectLinkId(value.subjectLinkId);
  requireOpaqueText(value.assignmentId, 'session.assignmentId', 3, 200);
}

function validatePagination(total, nextCursor) {
  requireIntegerRange(total, 0, Number.MAX_SAFE_INTEGER, 'total', queryInvalid);
  validateOptionalCursor(nextCursor);
}

function validateOptionalCursor(value) {
  if (value !== null) requireOpaqueText(value, 'nextCursor', 8, 1000);
}

function requireSubjectLinkId(value) {
  return requireRouteSafeId(value, 'subjectLinkId');
}

function requireArray(value, label, max) {
  if (!Array.isArray(value) || value.length > max) {
    throw queryInvalid('MENTOR_QUERY_ARRAY_INVALID', `${label} is invalid.`);
  }
  return value;
}

function assertNoAuthorityFields(value, path = 'payload') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoAuthorityFields(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (AUTHORITY_FIELD_PATTERN.test(key)) {
      throw commandInvalid('CLIENT_AUTHORITY_FIELD_FORBIDDEN', `${path}.${key} is server-derived.`);
    }
    assertNoAuthorityFields(entry, `${path}.${key}`);
  }
}

function assertPlainObject(value, label, errorFactory = commandInvalid) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw errorFactory('MENTOR_OBJECT_REQUIRED', `${label} must be a plain JSON object.`);
  }
}

function assertExactFields(value, allowed, required, label, errorFactory = commandInvalid) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length) throw errorFactory('MENTOR_UNKNOWN_FIELD', `Unknown ${label} field: ${unknown[0]}.`);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw errorFactory('MENTOR_FIELD_REQUIRED', `Missing ${label} field: ${missing[0]}.`);
}

function requireUuid(value, label) {
  const normalized = canonicalUuid(value);
  if (!normalized) throw commandInvalid('MENTOR_COMMAND_UUID_INVALID', `${label} must be a canonical UUID.`);
  return normalized;
}

function requireOpaqueText(value, label, min, max) {
  if (typeof value !== 'string') throw commandInvalid('MENTOR_COMMAND_IDENTIFIER_INVALID', `${label} is invalid.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(normalized)) {
    throw commandInvalid('MENTOR_COMMAND_IDENTIFIER_INVALID', `${label} is invalid.`);
  }
  return normalized;
}

function requireRouteSafeId(value, label) {
  if (!isMmcRouteSafeId(value)) {
    throw commandInvalid('MENTOR_COMMAND_IDENTIFIER_INVALID', `${label} is not route safe.`);
  }
  return value;
}

function optionalOpaqueText(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireOpaqueText(value, label, 3, 200);
}

function requirePlainText(value, label, min, max) {
  if (typeof value !== 'string') throw commandInvalid('MENTOR_COMMAND_TEXT_INVALID', `${label} must be text.`);
  const normalized = value.normalize('NFC').replace(/\r\n?/gu, '\n').trim();
  if (normalized.length < min || normalized.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    throw commandInvalid('MENTOR_COMMAND_TEXT_INVALID', `${label} is outside the allowed text boundary.`);
  }
  return normalized;
}

function optionalPlainText(value, label, max) {
  if (value === undefined || value === null || value === '') return undefined;
  return requirePlainText(value, label, 1, max);
}

function requireEnum(value, allowed, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!allowed.includes(normalized)) throw commandInvalid('MENTOR_COMMAND_ENUM_INVALID', `${label} is invalid.`);
  return normalized;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw commandInvalid('MENTOR_COMMAND_VERSION_INVALID', `${label} is invalid.`);
  return value;
}

function requirePositiveInteger(value, label, errorFactory = commandInvalid) {
  if (!Number.isSafeInteger(value) || value < 1) throw errorFactory('MENTOR_VERSION_INVALID', `${label} is invalid.`);
  return value;
}

function requireIntegerRange(value, min, max, label, errorFactory) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw errorFactory('MENTOR_INTEGER_INVALID', `${label} is invalid.`);
  }
  return value;
}

function requireExactInteger(value, expected, label) {
  if (value !== expected) throw commandInvalid('MENTOR_COMMAND_SCHEMA_VERSION_UNSUPPORTED', `${label} must equal ${expected}.`);
  return value;
}

function requireUtcTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(value)) {
    throw commandInvalid('MENTOR_COMMAND_TIMESTAMP_INVALID', `${label} must be an RFC3339 UTC timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== value.slice(0, 19)) {
    throw commandInvalid('MENTOR_COMMAND_TIMESTAMP_INVALID', `${label} is invalid.`);
  }
  return new Date(milliseconds).toISOString();
}

function optionalUtcTimestamp(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireUtcTimestamp(value, label);
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)
      || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) {
    throw commandInvalid('MENTOR_COMMAND_DATE_INVALID', `${label} is invalid.`);
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw commandInvalid('MENTOR_COMMAND_NUMBER_INVALID', 'Command numbers must be finite.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  assertPlainObject(value, 'command value', commandInvalid);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function queryInvalid(code, message) {
  return new TypeError(`${code}: ${message}`);
}

function commandInvalid(code, message) {
  return new MmcHttpError(422, code, message);
}

function commandResultInvalid(code, message) {
  return new TypeError(`${code}: ${message}`);
}
