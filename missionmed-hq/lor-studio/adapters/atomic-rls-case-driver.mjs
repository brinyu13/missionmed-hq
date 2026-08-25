import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  LorDomainError,
  NotFoundError,
  StaleRevisionError,
  ValidationError,
} from '../domain/errors.js';
import {
  assertFacultyCaseProjection,
  assertMentorCaseProjection,
  assertStudentSafeRecommendationCase,
  FACULTY_CASE_PROJECTION_SCHEMA,
  STUDENT_SAFE_CASE_SCHEMA,
} from '../domain/recommendation-case.js';
import {
  assertNonEmptyString,
  canonicalize,
  deepFreeze,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { validateMetadataServiceEvent } from '../services/metadata-events.js';
import {
  assertValidatedLorTargetBinding,
  isDeniedTargetIdentifier,
} from './lor-target-binding.mjs';

/**
 * Actor-safe PostgreSQL/RLS driver for durable LOR recommendation cases.
 *
 * Student writes cross the database boundary only through the five DR-120
 * SECURITY DEFINER command functions. The application role cannot directly
 * mutate recommendation-case, protected-state, audit, or receipt relations.
 * Student reads use one fixed projection statement; mentor reads use one fixed
 * five-field function. No caller value is interpolated into SQL.
 */

export const ATOMIC_RLS_CASE_DRIVER_INTEGRATION = 'lor_atomic_rls_case_driver';

const LOR_SCHEMA = 'lor_studio';
const APPLICATION_DB_ROLE = 'lor_studio_app';
const SERVER_SCOPE_SCHEMA = 'missionmed.lor.server-query-scope.v1';
const DRIVER_AUTHORIZATION_SCHEMA = 'missionmed.lor.driver-authorization-binding.v1';
const CREATION_RESERVATION_RECEIPT_SCHEMA = 'missionmed.lor.case-creation-reservation-receipt.v1';
const ATOMIC_COMMAND_RECEIPT_SCHEMA = 'missionmed.lor.atomic-command-receipt.v2';
const TARGET_BINDING_SCHEMA = 'missionmed.lor.target-binding.v1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STUDENT_SUBJECT_PATTERN = /^wp:[1-9][0-9]*$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CREATION_REF_PATTERN = /^case_creation_[a-f0-9]{64}$/u;

const RELATIONS = deepFreeze({
  studentCaseProjection: `${LOR_SCHEMA}.student_recommendation_case_projection`,
  creationReservations: `${LOR_SCHEMA}.recommendation_case_creation_reservations`,
  consentReceipts: `${LOR_SCHEMA}.consent_receipts`,
  waiverReceipts: `${LOR_SCHEMA}.waiver_receipts`,
});

/** Stable driver-local identifiers; they are not node-pg prepared names. */
export const ATOMIC_RLS_CASE_STATEMENTS = deepFreeze({
  bindIdentity: 'lor_case_bind_identity',
  transactionId: 'lor_case_transaction_id',
  readStudentSafeCase: 'lor_case_read_student_safe_case',
  readFacultyCaseProjection: 'lor_case_read_faculty_projection',
  readMentorCaseProjection: 'lor_case_read_mentor_projection',
  commitStudentCaseCreate: 'lor_case_commit_student_case_create',
  commitStudentBuilderAutosave: 'lor_case_commit_student_builder_autosave',
  commitStudentBuilderComplete: 'lor_case_commit_student_builder_complete',
  commitStudentConsentReceipt: 'lor_case_commit_student_consent_receipt',
  commitStudentWaiverReceipt: 'lor_case_commit_student_waiver_receipt',
  commitFacultyFinalDocumentRelease: 'lor_case_commit_faculty_final_document_release',
  insertCreationReservation: 'lor_case_insert_creation_reservation',
  selectCreationReservation: 'lor_case_select_creation_reservation',
});

const SCOPE_KEYS = new Set([
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
const READ_REQUEST_KEYS = new Set(['binding', 'scope', 'caseId']);
const RESERVATION_REQUEST_KEYS = new Set([
  'binding',
  'scope',
  'operation',
  'creationRef',
  'actorRef',
  'idempotencyKey',
  'requestHash',
  'proposedIdentifiers',
]);
const PROPOSED_IDENTIFIER_KEYS = new Set(['caseId', 'builderSessionId', 'createdAt']);
const STUDENT_COMMAND_KEYS = new Set([
  'binding',
  'scope',
  'state',
  'expectedRevision',
  'idempotencyKey',
  'requestHash',
  'event',
  'versionEntry',
  'receipt',
]);
const FACULTY_RELEASE_COMMAND_KEYS = new Set([
  'binding',
  'scope',
  'expectedRevision',
  'documentId',
  'idempotencyKey',
  'requestHash',
  'event',
]);
const VERSION_ENTRY_KEYS = new Set([
  'revision',
  'eventType',
  'actorId',
  'occurredAt',
  'changedFields',
  'changeHash',
]);
const COMMAND_RECEIPT_KEYS = new Set([
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
const SAFE_RECORD_KEYS = new Set(['builder', 'studentEvidence', 'applicantOptions', 'delivery']);
const BINDING_IDENTITY_FIELDS = Object.freeze([
  'schemaVersion',
  'decisionRecord',
  'environment',
  'projectRef',
  'parentProjectRef',
  'branchName',
  'branchId',
  'schema',
  'migrationLedger',
]);
const BINDING_KEYS = new Set(BINDING_IDENTITY_FIELDS);

const BIND_IDENTITY_SQL = `SELECT
  pg_catalog.set_config('role', $1, true) AS database_role,
  pg_catalog.set_config('request.jwt.claim.sub', $2, true) AS auth_uid,
  pg_catalog.set_config('${LOR_SCHEMA}.student_auth_subject', $3, true) AS student_auth_subject,
  pg_catalog.set_config('${LOR_SCHEMA}.actor_role', $4, true) AS actor_role,
  pg_catalog.set_config('${LOR_SCHEMA}.resource_student_id', $5, true) AS resource_student_id,
  pg_catalog.set_config('${LOR_SCHEMA}.case_id', $6, true) AS case_id,
  pg_catalog.set_config('${LOR_SCHEMA}.operation', $7, true) AS operation,
  pg_catalog.set_config('${LOR_SCHEMA}.purpose', $8, true) AS purpose,
  pg_catalog.set_config('${LOR_SCHEMA}.invitation_id', $9, true) AS invitation_id,
  pg_catalog.set_config('${LOR_SCHEMA}.assignment_id', $10, true) AS assignment_id,
  pg_catalog.set_config('${LOR_SCHEMA}.administrative_grant_id', $11, true) AS administrative_grant_id,
  pg_catalog.set_config('${LOR_SCHEMA}.entitlement_verified', $12, true) AS entitlement_verified,
  pg_catalog.set_config('${LOR_SCHEMA}.lor_enabled', $13, true) AS lor_enabled,
  pg_catalog.set_config('${LOR_SCHEMA}.canary_authorized', $14, true) AS canary_authorized`;

const TRANSACTION_ID_SQL = 'SELECT pg_catalog.pg_current_xact_id()::text AS transaction_id';

/** The sole student-safe read; protected/private relations never appear here. */
const READ_STUDENT_SAFE_CASE_SQL = `SELECT
    projected.case_id,
    projected.student_auth_subject,
    projected.revision,
    projected.status,
    projected.created_at,
    projected.updated_at,
    projected.closed_at,
    projected.record,
    projected.final_document_id,
    projected.final_document_text,
    projected.final_document_content_hash,
    projected.final_document_mime_type,
    projected.approval_approved,
    projected.approval_at,
    projected.approval_faculty_ref,
    projected.approval_signature_attested,
    projected.release_document_id,
    projected.release_document_hash,
    projected.released_at,
    projected.released_at_revision,
    projected.waiver_receipt_id,
    projected.snapshot_hash,
    COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.consent-receipt.v1',
        'id', consent.receipt_id,
        'caseId', consent.case_id,
        'actorId', consent.student_auth_subject,
        'scopes', pg_catalog.to_jsonb(consent.scopes),
        'policyVersion', consent.policy_version,
        'recordedAt', consent.recorded_at,
        'receiptHash', consent.receipt_hash
      ) ORDER BY consent.case_revision, consent.recorded_at, consent.receipt_id)
      FROM ${RELATIONS.consentReceipts} AS consent
      WHERE consent.case_id = projected.case_id
        AND consent.student_auth_subject = projected.student_auth_subject
        AND consent.case_revision <= projected.revision
    ), '[]'::jsonb) AS consent_receipts,
    COALESCE((
      SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'schemaVersion', 'missionmed.lor.waiver-receipt.v1',
        'id', waiver.receipt_id,
        'caseId', waiver.case_id,
        'actorId', waiver.student_auth_subject,
        'waived', waiver.waived,
        'policyVersion', waiver.policy_version,
        'priorReceiptId', waiver.prior_receipt_id,
        'acknowledgment', waiver.acknowledgment,
        'recordedAt', waiver.recorded_at,
        'receiptHash', waiver.receipt_hash
      ) ORDER BY waiver.case_revision, waiver.recorded_at, waiver.receipt_id)
      FROM ${RELATIONS.waiverReceipts} AS waiver
      WHERE waiver.case_id = projected.case_id
        AND waiver.student_auth_subject = projected.student_auth_subject
        AND waiver.case_revision <= projected.revision
    ), '[]'::jsonb) AS waiver_receipts
  FROM ${RELATIONS.studentCaseProjection} AS projected
  WHERE projected.case_id = $1 AND projected.student_auth_subject = $2`;

const READ_MENTOR_CASE_PROJECTION_SQL =
  `SELECT ${LOR_SCHEMA}.read_mentor_case_projection() AS result`;
const READ_FACULTY_CASE_PROJECTION_SQL =
  `SELECT ${LOR_SCHEMA}.read_faculty_case_projection() AS result`;
const COMMIT_FACULTY_FINAL_DOCUMENT_RELEASE_SQL =
  `SELECT ${LOR_SCHEMA}.commit_faculty_final_document_release(
    $1::bigint, $2, $3, $4, $5::jsonb, $6
  ) AS result`;

const INSERT_CREATION_RESERVATION_SQL = `INSERT INTO ${RELATIONS.creationReservations}
    (creation_ref, student_auth_subject, student_auth_uid, actor_ref, idempotency_key,
     request_hash, case_id, builder_session_id, created_at, transaction_id, reserved_at)
  VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9::timestamptz,
     pg_catalog.pg_current_xact_id()::text, pg_catalog.statement_timestamp())
  ON CONFLICT (creation_ref) DO NOTHING
  RETURNING case_id, builder_session_id, created_at, request_hash, transaction_id`;

const SELECT_CREATION_RESERVATION_SQL = `SELECT case_id, builder_session_id, created_at,
    request_hash, transaction_id
  FROM ${RELATIONS.creationReservations}
  WHERE creation_ref = $1 AND student_auth_subject = $2 AND student_auth_uid = $3::uuid
    AND actor_ref = $4`;

const STUDENT_COMMANDS = deepFreeze({
  commitStudentCaseCreate: {
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentCaseCreate,
    operation: 'create',
    action: 'case.create',
    sql: `SELECT ${LOR_SCHEMA}.commit_student_case_create(
      $1::jsonb, $2, $3, $4::jsonb, $5, $6::jsonb
    ) AS result`,
    receipt: false,
  },
  commitStudentBuilderAutosave: {
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentBuilderAutosave,
    operation: 'save',
    action: 'builder.autosave',
    sql: `SELECT ${LOR_SCHEMA}.commit_student_builder_autosave(
      $1::jsonb, $2::bigint, $3, $4, $5::jsonb, $6, $7::jsonb
    ) AS result`,
    receipt: false,
  },
  commitStudentBuilderComplete: {
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentBuilderComplete,
    operation: 'save',
    action: 'builder.complete_step',
    sql: `SELECT ${LOR_SCHEMA}.commit_student_builder_complete(
      $1::jsonb, $2::bigint, $3, $4, $5::jsonb, $6, $7::jsonb
    ) AS result`,
    receipt: false,
  },
  commitStudentConsentReceipt: {
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentConsentReceipt,
    operation: 'save',
    action: 'consent.record',
    sql: `SELECT ${LOR_SCHEMA}.commit_student_consent_receipt(
      $1::jsonb, $2::bigint, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb
    ) AS result`,
    receipt: true,
  },
  commitStudentWaiverReceipt: {
    statementId: ATOMIC_RLS_CASE_STATEMENTS.commitStudentWaiverReceipt,
    operation: 'save',
    action: 'waiver.record',
    sql: `SELECT ${LOR_SCHEMA}.commit_student_waiver_receipt(
      $1::jsonb, $2::bigint, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb
    ) AS result`,
    receipt: true,
  },
});

const FACULTY_RELEASE_COMMAND = deepFreeze({
  statementId: ATOMIC_RLS_CASE_STATEMENTS.commitFacultyFinalDocumentRelease,
  operation: 'save',
  action: 'faculty.final_document_release',
  eventType: 'faculty.final_document_released',
  sql: COMMIT_FACULTY_FINAL_DOCUMENT_RELEASE_SQL,
});

function failClosed(status) {
  throw new IntegrationDisabledError(ATOMIC_RLS_CASE_DRIVER_INTEGRATION, status);
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

/** Snapshot each allowlisted property once before validation. */
function snapshotExact(value, keys, status) {
  if (!hasExactKeys(value, keys)) failClosed(status);
  const snapshot = {};
  for (const key of keys) snapshot[key] = value[key];
  return snapshot;
}

function assertSha256(value, fieldName) {
  if (!SHA256_PATTERN.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a SHA-256 digest`, { fieldName });
  }
  return value;
}

function assertUuid(value, fieldName) {
  if (!UUID_PATTERN.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be a UUID`, { fieldName });
  }
  return value;
}

function canonicalClone(value) {
  return JSON.parse(canonicalize(value));
}

/** Mechanically prove every caller value occupies one contiguous placeholder. */
function statement(statementId, text, values = []) {
  const placeholders = text.match(/\$[0-9]+/gu) ?? [];
  const indexes = new Set(placeholders.map((token) => Number(token.slice(1))));
  if (indexes.size !== values.length) failClosed('STATEMENT_PARAMETER_MISMATCH');
  for (let index = 1; index <= values.length; index += 1) {
    if (!indexes.has(index)) failClosed('STATEMENT_PARAMETER_MISMATCH');
  }
  for (const value of values) {
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
      failClosed('STATEMENT_PARAMETER_UNSUPPORTED');
    }
  }
  return Object.freeze({ statementId, text, values: Object.freeze([...values]) });
}

function assertExecutor(executor) {
  if (
    !executor
    || executor.serverOnly !== true
    || executor.transactional !== true
    || typeof executor.withConnection !== 'function'
  ) failClosed('SQL_EXECUTOR_PORT_REQUIRED');
  return executor;
}

function assertConnection(connection) {
  if (!connection || typeof connection.transaction !== 'function') {
    failClosed('SQL_CONNECTION_CONTRACT_VIOLATED');
  }
  return connection;
}

function assertTransaction(transaction) {
  if (!transaction || typeof transaction.execute !== 'function') {
    failClosed('SQL_TRANSACTION_CONTRACT_VIOLATED');
  }
  return transaction;
}

function assertTargetBinding(binding, target) {
  if (!hasExactKeys(binding, BINDING_KEYS)) failClosed('TARGET_BINDING_REQUIRED');
  for (const field of BINDING_IDENTITY_FIELDS) {
    if (binding[field] !== target[field]) failClosed('TARGET_BINDING_MISMATCH');
  }
  for (const field of ['projectRef', 'parentProjectRef', 'branchId', 'branchName']) {
    if (isDeniedTargetIdentifier(binding[field])) failClosed('TARGET_BINDING_DENIED');
  }
}

function assertCanonicalStudentSubject(value, fieldName) {
  if (!STUDENT_SUBJECT_PATTERN.test(value ?? '')) {
    throw new ValidationError(`${fieldName} must be the canonical wp:<id> subject`, { fieldName });
  }
  return value;
}

function assertScopeEnvelope(rawScope, { operation, caseId, actorRole }) {
  const scope = snapshotExact(rawScope, SCOPE_KEYS, 'SERVER_SCOPE_FIELDS_UNRECOGNIZED');
  if (
    scope.schemaVersion !== SERVER_SCOPE_SCHEMA
    || scope.authoritySource !== 'server_verified_session_crosswalk'
    || scope.authenticated !== true
    || scope.roleVerified !== true
  ) failClosed('VERIFIED_SERVER_SCOPE_REQUIRED');

  assertUuid(scope.authUid, 'scope.authUid');
  for (const field of [
    'authenticatedSubject',
    'actorId',
    'resourceStudentId',
    'caseId',
    'purpose',
  ]) assertNonEmptyString(scope[field], `scope.${field}`, { maxLength: 200 });
  assertCanonicalStudentSubject(scope.resourceStudentId, 'scope.resourceStudentId');
  for (const field of ['assignmentId', 'invitationId', 'administrativeGrantId']) {
    if (scope[field] !== null) {
      assertNonEmptyString(scope[field], `scope.${field}`, { maxLength: 200 });
    }
  }
  for (const field of ['entitlementVerified', 'lorEnabled', 'canaryAuthorized']) {
    if (typeof scope[field] !== 'boolean') failClosed('VERIFIED_STUDENT_WRITE_AXES_REQUIRED');
  }
  if (scope.actorId !== scope.authenticatedSubject) {
    throw new AuthorizationDeniedError('DRIVER_IDENTITY_SUBJECT_MISMATCH');
  }
  if (scope.operation !== operation || scope.caseId !== caseId || scope.actorRole !== actorRole) {
    throw new DomainInvariantError('RLS scope must match the exact actor, case, and operation');
  }
  if (actorRole === 'student') {
    assertCanonicalStudentSubject(scope.authenticatedSubject, 'scope.authenticatedSubject');
    if (
      scope.authenticatedSubject !== scope.resourceStudentId
      || scope.assignmentId !== null
      || scope.invitationId !== null
      || scope.administrativeGrantId !== null
    ) throw new AuthorizationDeniedError('STUDENT_SCOPE_EVIDENCE_INVALID');
    if (
      ['create', 'save'].includes(operation)
      && (
        scope.entitlementVerified !== true
        || scope.lorEnabled !== true
        || scope.canaryAuthorized !== true
      )
    ) throw new AuthorizationDeniedError('STUDENT_WRITE_ELIGIBILITY_SCOPE_INVALID');
  }
  if (actorRole === 'mentor') {
    assertCanonicalStudentSubject(scope.authenticatedSubject, 'scope.authenticatedSubject');
    if (
      !scope.assignmentId
      || scope.invitationId !== null
      || scope.administrativeGrantId !== null
    ) throw new AuthorizationDeniedError('MENTOR_SCOPE_EVIDENCE_INVALID');
  }
  if (actorRole === 'faculty') {
    assertCanonicalStudentSubject(scope.authenticatedSubject, 'scope.authenticatedSubject');
    if (
      !scope.invitationId
      || scope.assignmentId !== null
      || scope.administrativeGrantId !== null
      || scope.purpose !== 'faculty_private_edit'
      || scope.entitlementVerified !== true
      || scope.lorEnabled !== true
      || scope.canaryAuthorized !== true
    ) throw new AuthorizationDeniedError('FACULTY_SCOPE_EVIDENCE_INVALID');
  }
  return deepFreeze(scope);
}

function deriveRlsIdentity(scope) {
  return Object.freeze({
    databaseRole: APPLICATION_DB_ROLE,
    authUid: scope.authUid,
    studentAuthSubject: scope.authenticatedSubject,
    actorRole: scope.actorRole,
    resourceStudentId: scope.resourceStudentId,
    caseId: scope.caseId,
    operation: scope.operation,
    purpose: scope.purpose,
    invitationId: scope.invitationId ?? '',
    assignmentId: scope.assignmentId ?? '',
    administrativeGrantId: scope.administrativeGrantId ?? '',
    entitlementVerified: String(scope.entitlementVerified),
    lorEnabled: String(scope.lorEnabled),
    canaryAuthorized: String(scope.canaryAuthorized),
  });
}

function bindIdentityStatement(scope) {
  const identity = deriveRlsIdentity(scope);
  return statement(ATOMIC_RLS_CASE_STATEMENTS.bindIdentity, BIND_IDENTITY_SQL, [
    identity.databaseRole,
    identity.authUid,
    identity.studentAuthSubject,
    identity.actorRole,
    identity.resourceStudentId,
    identity.caseId,
    identity.operation,
    identity.purpose,
    identity.invitationId,
    identity.assignmentId,
    identity.administrativeGrantId,
    identity.entitlementVerified,
    identity.lorEnabled,
    identity.canaryAuthorized,
  ]);
}

function authorizationBinding(scope) {
  return deepFreeze({
    schemaVersion: DRIVER_AUTHORIZATION_SCHEMA,
    authUid: scope.authUid,
    authenticatedSubject: scope.authenticatedSubject,
    actorId: scope.actorId,
    actorRole: scope.actorRole,
    resourceStudentId: scope.resourceStudentId,
    caseId: scope.caseId,
    operation: scope.operation,
    purpose: scope.purpose,
    invitationId: scope.invitationId,
    assignmentId: scope.assignmentId,
    administrativeGrantId: scope.administrativeGrantId,
    entitlementVerified: scope.entitlementVerified,
    lorEnabled: scope.lorEnabled,
    canaryAuthorized: scope.canaryAuthorized,
  });
}

function firstRow(result) {
  if (!Array.isArray(result?.rows)) failClosed('SQL_RESULT_CONTRACT_VIOLATED');
  if (result.rows.length > 1) failClosed('SQL_RESULT_NOT_UNIQUE');
  return result.rows.length === 1 ? result.rows[0] : null;
}

function normalizeRevision(value) {
  if (Number.isSafeInteger(value) && value >= 0) return value;
  let bigint;
  if (typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(value)) {
    bigint = BigInt(value);
  } else if (typeof value === 'bigint' && value >= 0n) {
    bigint = value;
  } else {
    failClosed('PERSISTED_REVISION_INVALID');
  }
  if (bigint > BigInt(Number.MAX_SAFE_INTEGER)) failClosed('PERSISTED_REVISION_UNSAFE');
  return Number(bigint);
}

function normalizeStudentSafeState(value) {
  if (!isPlainObject(value)) failClosed('STUDENT_SAFE_CASE_FIELDS_INVALID');
  const normalized = structuredClone(value);
  normalized.revision = normalizeRevision(value.revision);
  normalized.createdAt = toIso(value.createdAt, 'studentSafeCase.createdAt');
  normalized.updatedAt = toIso(value.updatedAt, 'studentSafeCase.updatedAt');
  normalized.closedAt = value.closedAt === null
    ? null
    : toIso(value.closedAt, 'studentSafeCase.closedAt');
  if (isPlainObject(value.builder)) {
    normalized.builder.autosavedAt = value.builder.autosavedAt === null
      ? null
      : toIso(value.builder.autosavedAt, 'studentSafeCase.builder.autosavedAt');
  }
  for (const field of ['consentReceipts', 'waiverReceipts']) {
    if (!Array.isArray(value[field])) failClosed('STUDENT_SAFE_RECEIPTS_INVALID');
    normalized[field] = value[field].map((receipt, index) => {
      if (!isPlainObject(receipt)) failClosed('STUDENT_SAFE_RECEIPTS_INVALID');
      const normalizedReceipt = structuredClone(receipt);
      normalizedReceipt.recordedAt = toIso(
        receipt?.recordedAt,
        `studentSafeCase.${field}[${index}].recordedAt`,
      );
      return normalizedReceipt;
    });
  }
  if (isPlainObject(value.delivery) && value.delivery.deliveredAt !== null) {
    normalized.delivery.deliveredAt = toIso(
      value.delivery?.deliveredAt,
      'studentSafeCase.delivery.deliveredAt',
    );
  }
  if (isPlainObject(value.releasedDocument)) {
    normalized.releasedDocument.finalDocument.releasedToStudentAt = toIso(
      value.releasedDocument?.finalDocument?.releasedToStudentAt,
      'studentSafeCase.releasedDocument.finalDocument.releasedToStudentAt',
    );
    normalized.releasedDocument.facultyApproval.approvedAt = toIso(
      value.releasedDocument?.facultyApproval?.approvedAt,
      'studentSafeCase.releasedDocument.facultyApproval.approvedAt',
    );
    normalized.releasedDocument.release.releasedAt = toIso(
      value.releasedDocument?.release?.releasedAt,
      'studentSafeCase.releasedDocument.release.releasedAt',
    );
    normalized.releasedDocument.release.releasedAtRevision = normalizeRevision(
      value.releasedDocument?.release?.releasedAtRevision,
    );
  }
  const canonical = canonicalClone(normalized);
  assertStudentSafeRecommendationCase(canonical);
  return deepFreeze(canonical);
}

const RELEASE_ROW_FIELDS = Object.freeze([
  'final_document_id',
  'final_document_text',
  'final_document_content_hash',
  'final_document_mime_type',
  'approval_approved',
  'approval_at',
  'approval_faculty_ref',
  'approval_signature_attested',
  'release_document_id',
  'release_document_hash',
  'released_at',
  'released_at_revision',
  'waiver_receipt_id',
  'snapshot_hash',
]);

function studentSafeStateFromRow(row) {
  if (!isPlainObject(row?.record) || !hasExactKeys(row.record, SAFE_RECORD_KEYS)) {
    failClosed('PERSISTED_SAFE_RECORD_UNREADABLE');
  }
  const hasRelease = row.snapshot_hash !== null && row.snapshot_hash !== undefined;
  if (!hasRelease && RELEASE_ROW_FIELDS.some((field) => row[field] !== null && row[field] !== undefined)) {
    failClosed('PARTIAL_RELEASE_SNAPSHOT_REJECTED');
  }
  const releasedDocument = hasRelease
    ? {
      finalDocument: {
        id: row.final_document_id,
        text: row.final_document_text,
        contentHash: row.final_document_content_hash,
        mimeType: row.final_document_mime_type,
        releasedToStudentAt: row.released_at,
      },
      facultyApproval: {
        approved: row.approval_approved,
        approvedAt: row.approval_at,
        facultyRef: row.approval_faculty_ref,
        signatureAttested: row.approval_signature_attested,
      },
      release: {
        documentId: row.release_document_id,
        documentHash: row.release_document_hash,
        releasedAt: row.released_at,
        releasedAtRevision: row.released_at_revision,
        waiverReceiptId: row.waiver_receipt_id,
      },
      snapshotHash: row.snapshot_hash,
    }
    : null;
  return normalizeStudentSafeState({
    schemaVersion: STUDENT_SAFE_CASE_SCHEMA,
    id: row.case_id,
    studentId: row.student_auth_subject,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at ?? null,
    builder: row.record.builder,
    studentEvidence: row.record.studentEvidence,
    applicantOptions: row.record.applicantOptions,
    consentReceipts: row.consent_receipts,
    waiverReceipts: row.waiver_receipts,
    delivery: row.record.delivery,
    releasedDocument,
  });
}

function normalizeMentorProjection(value) {
  const projection = canonicalClone(value);
  assertMentorCaseProjection(projection);
  return deepFreeze(projection);
}

function normalizeFacultyProjection(value) {
  if (!isPlainObject(value)) failClosed('FACULTY_PROJECTION_FIELDS_INVALID');
  const normalized = structuredClone(value);
  normalized.revision = normalizeRevision(value.revision);
  if (Array.isArray(value.studentShared?.consentReceipts)) {
    normalized.studentShared.consentReceipts = value.studentShared.consentReceipts.map(
      (receipt, index) => {
        if (!isPlainObject(receipt)) failClosed('FACULTY_PROJECTION_CONSENT_INVALID');
        return {
          ...structuredClone(receipt),
          recordedAt: toIso(
            receipt.recordedAt,
            `facultyProjection.studentShared.consentReceipts[${index}].recordedAt`,
          ),
        };
      },
    );
  }
  const finalDocument = value.facultyPrivate?.finalDocument;
  if (isPlainObject(finalDocument) && finalDocument.releasedToStudentAt !== null) {
    normalized.facultyPrivate.finalDocument.releasedToStudentAt = toIso(
      finalDocument.releasedToStudentAt,
      'facultyProjection.facultyPrivate.finalDocument.releasedToStudentAt',
    );
  }
  if (isPlainObject(value.delivery) && value.delivery.deliveredAt !== null) {
    normalized.delivery.deliveredAt = toIso(
      value.delivery.deliveredAt,
      'facultyProjection.delivery.deliveredAt',
    );
  }
  const projection = canonicalClone(normalized);
  if (projection.schemaVersion !== FACULTY_CASE_PROJECTION_SCHEMA) {
    failClosed('FACULTY_PROJECTION_SCHEMA_INVALID');
  }
  assertFacultyCaseProjection(projection);
  return deepFreeze(projection);
}

/** Shape/type checks only; SQL performs semantic checks after replay lookup. */
function normalizeVersionEntryShape(value) {
  if (!hasExactKeys(value, VERSION_ENTRY_KEYS)) {
    failClosed('VERSION_ENTRY_FIELDS_UNRECOGNIZED');
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
    throw new ValidationError('versionEntry.revision must be a non-negative integer');
  }
  assertNonEmptyString(value.eventType, 'versionEntry.eventType', { maxLength: 100 });
  assertNonEmptyString(value.actorId, 'versionEntry.actorId', { maxLength: 200 });
  toIso(value.occurredAt, 'versionEntry.occurredAt');
  if (
    !Array.isArray(value.changedFields)
    || value.changedFields.length === 0
    || value.changedFields.some((field) => typeof field !== 'string' || field.length === 0)
    || value.changedFields.some((field, index, all) => index > 0 && field <= all[index - 1])
  ) throw new ValidationError('versionEntry.changedFields must be sorted and unique');
  assertSha256(value.changeHash, 'versionEntry.changeHash');
  return canonicalClone(value);
}

/**
 * Deliberately performs only structural/type/authorization checks before SQL.
 * The function must look up an exact idempotent replay before validating a
 * reconstructed candidate's revision/event/version semantics.
 */
function normalizeStudentCommand(rawCommand, spec, target) {
  const command = snapshotExact(
    rawCommand,
    STUDENT_COMMAND_KEYS,
    'STUDENT_COMMAND_FIELDS_UNRECOGNIZED',
  );
  assertTargetBinding(command.binding, target);
  const state = normalizeStudentSafeState(command.state);
  const scope = assertScopeEnvelope(command.scope, {
    operation: spec.operation,
    caseId: state.id,
    actorRole: 'student',
  });
  if (state.studentId !== scope.resourceStudentId) {
    throw new AuthorizationDeniedError('STUDENT_COMMAND_SCOPE_INVALID');
  }
  if (spec.operation === 'create') {
    if (command.expectedRevision !== null) {
      throw new ValidationError('Create expectedRevision must be null');
    }
  } else if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new ValidationError('Save expectedRevision must be a non-negative integer');
  }
  const idempotencyKey = assertNonEmptyString(
    command.idempotencyKey,
    'idempotencyKey',
    { maxLength: 240 },
  );
  const requestHash = assertSha256(command.requestHash, 'requestHash');
  const event = canonicalClone(command.event);
  validateMetadataServiceEvent(event);
  if (
    event.actorRole !== 'student'
    || event.actorRef !== `actor_${sha256(`lor-studio:actor:${scope.actorId}`)}`
    || event.caseRef !== `case_${sha256(`lor-studio:case:${state.id}`)}`
  ) throw new AuthorizationDeniedError('STUDENT_EVENT_SCOPE_INVALID');
  const versionEntry = normalizeVersionEntryShape(command.versionEntry);
  if (versionEntry.actorId !== scope.actorId) {
    throw new AuthorizationDeniedError('STUDENT_VERSION_ENTRY_SCOPE_INVALID');
  }
  if (spec.receipt !== (command.receipt !== null)) {
    throw new ValidationError('Receipt presence does not match the student action');
  }
  const receipt = command.receipt === null ? null : canonicalClone(command.receipt);
  return {
    state,
    scope,
    expectedRevision: command.expectedRevision,
    idempotencyKey,
    requestHash,
    event,
    eventHash: hashValue(event),
    versionEntry,
    receipt,
  };
}

function normalizeCommandReceipt(value, { input, spec }) {
  if (!hasExactKeys(value, COMMAND_RECEIPT_KEYS)) {
    failClosed('ATOMIC_COMMAND_RECEIPT_FIELDS_INVALID');
  }
  const state = normalizeStudentSafeState(value.state);
  const revision = normalizeRevision(value.revision);
  const replayed = value.replayed === true;
  for (const field of ['safeRecordHash', 'protectedStateHash', 'eventHash']) {
    if (!SHA256_PATTERN.test(value[field] ?? '')) {
      failClosed('ATOMIC_COMMAND_RECEIPT_HASH_INVALID');
    }
  }
  if (
    value.schemaVersion !== ATOMIC_COMMAND_RECEIPT_SCHEMA
    || value.action !== spec.action
    || value.committed !== true
    || (value.replayed !== true && value.replayed !== false)
    || value.sameTransaction !== true
    || value.caseId !== input.state.id
    || value.studentId !== input.scope.resourceStudentId
    || state.id !== value.caseId
    || state.studentId !== value.studentId
    || revision !== state.revision
    || value.idempotencyKey !== input.idempotencyKey
    || value.requestHash !== input.requestHash
    || (!replayed && (
      revision !== input.state.revision
      || canonicalize(state) !== canonicalize(input.state)
      || value.eventHash !== input.eventHash
      || value.auditEventRef !== input.event.eventRef
    ))
  ) failClosed('ATOMIC_COMMAND_RECEIPT_BINDING_INVALID');
  assertNonEmptyString(value.auditEventRef, 'auditEventRef', { maxLength: 200 });
  assertNonEmptyString(value.transactionId, 'transactionId', { maxLength: 200 });
  return deepFreeze({ ...value, revision, state });
}

function normalizeFacultyReleaseCommand(rawCommand, target) {
  const command = snapshotExact(
    rawCommand,
    FACULTY_RELEASE_COMMAND_KEYS,
    'FACULTY_RELEASE_COMMAND_FIELDS_UNRECOGNIZED',
  );
  assertTargetBinding(command.binding, target);
  const caseId = assertNonEmptyString(command.scope?.caseId, 'scope.caseId', { maxLength: 200 });
  const scope = assertScopeEnvelope(command.scope, {
    operation: 'save',
    caseId,
    actorRole: 'faculty',
  });
  if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new ValidationError('Faculty release expectedRevision must be a non-negative integer');
  }
  const documentId = assertNonEmptyString(command.documentId, 'documentId', { maxLength: 200 });
  const idempotencyKey = assertNonEmptyString(
    command.idempotencyKey,
    'idempotencyKey',
    { maxLength: 240 },
  );
  const requestHash = assertSha256(command.requestHash, 'requestHash');
  const event = canonicalClone(command.event);
  validateMetadataServiceEvent(event);
  if (
    event.eventType !== FACULTY_RELEASE_COMMAND.eventType
    || event.actorRole !== 'faculty'
    || event.actorRef !== `actor_${sha256(`lor-studio:actor:${scope.actorId}`)}`
    || event.caseRef !== `case_${sha256(`lor-studio:case:${caseId}`)}`
    || event.revision !== command.expectedRevision + 1
  ) throw new AuthorizationDeniedError('FACULTY_RELEASE_EVENT_SCOPE_INVALID');
  return {
    scope,
    expectedRevision: command.expectedRevision,
    documentId,
    idempotencyKey,
    requestHash,
    event,
    eventHash: hashValue(event),
  };
}

function normalizeFacultyReleaseReceipt(value, { input }) {
  if (!hasExactKeys(value, COMMAND_RECEIPT_KEYS)) {
    failClosed('ATOMIC_COMMAND_RECEIPT_FIELDS_INVALID');
  }
  const state = normalizeFacultyProjection(value.state);
  const revision = normalizeRevision(value.revision);
  const replayed = value.replayed === true;
  for (const field of ['safeRecordHash', 'protectedStateHash', 'eventHash']) {
    if (!SHA256_PATTERN.test(value[field] ?? '')) {
      failClosed('ATOMIC_COMMAND_RECEIPT_HASH_INVALID');
    }
  }
  assertNonEmptyString(value.auditEventRef, 'auditEventRef', { maxLength: 200 });
  assertNonEmptyString(value.transactionId, 'transactionId', { maxLength: 200 });
  if (
    value.schemaVersion !== ATOMIC_COMMAND_RECEIPT_SCHEMA
    || value.action !== FACULTY_RELEASE_COMMAND.action
    || value.committed !== true
    || (value.replayed !== true && value.replayed !== false)
    || value.sameTransaction !== true
    || value.caseId !== input.scope.caseId
    || value.studentId !== input.scope.resourceStudentId
    || state.caseId !== value.caseId
    || revision !== state.revision
    || value.idempotencyKey !== input.idempotencyKey
    || value.requestHash !== input.requestHash
    || (!replayed && (
      revision !== input.expectedRevision + 1
      || value.eventHash !== input.eventHash
      || value.auditEventRef !== input.event.eventRef
    ))
  ) failClosed('ATOMIC_COMMAND_RECEIPT_BINDING_INVALID');
  return deepFreeze({ ...value, revision, state });
}

function mapDatabaseError(error, context) {
  const exact = `${typeof error?.code === 'string' ? error.code : ''}/${
    typeof error?.message === 'string' ? error.message : ''}`;
  if (exact === 'P1001/LOR_CASE_NOT_FOUND') {
    return new NotFoundError('recommendation_case', context.caseId);
  }
  if (exact === 'P1002/LOR_STALE_REVISION') {
    return new StaleRevisionError({
      caseId: context.caseId,
      expectedRevision: context.expectedRevision ?? null,
      actualRevision: null,
    });
  }
  if (exact === 'P1003/LOR_IDEMPOTENCY_CONFLICT') {
    return new IdempotencyConflictError({ idempotencyKey: context.idempotencyKey });
  }
  if (exact === 'P1004/LOR_AUTHORIZATION_DENIED') {
    return new AuthorizationDeniedError('DATABASE_COMMAND_AUTHORIZATION_DENIED');
  }
  if (exact === 'P1005/LOR_COMMAND_INVALID') {
    return new IntegrationDisabledError(
      ATOMIC_RLS_CASE_DRIVER_INTEGRATION,
      'DATABASE_COMMAND_INVALID',
    );
  }
  return new IntegrationDisabledError(
    ATOMIC_RLS_CASE_DRIVER_INTEGRATION,
    'ATOMIC_TRANSACTION_FAILED',
  );
}

export class AtomicRlsCaseDriver {
  constructor({ binding, executor } = {}) {
    const validated = assertValidatedLorTargetBinding(
      binding,
      ATOMIC_RLS_CASE_DRIVER_INTEGRATION,
    );
    if (validated.schemaVersion !== TARGET_BINDING_SCHEMA) failClosed('TARGET_BINDING_REQUIRED');
    if (validated.schema !== LOR_SCHEMA) failClosed('TARGET_SCHEMA_MISMATCH');
    for (const field of ['projectRef', 'parentProjectRef', 'branchId', 'branchName']) {
      if (isDeniedTargetIdentifier(validated[field])) failClosed('TARGET_BINDING_DENIED');
    }
    this.target = deepFreeze(
      Object.fromEntries(BINDING_IDENTITY_FIELDS.map((field) => [field, validated[field]])),
    );
    this.executor = assertExecutor(executor);
    this.atomicStateAndAudit = true;
    this.rlsEnforced = true;
    this.serverOnly = true;
    this.actorSafeCommands = true;
    Object.freeze(this);
  }

  async #withRlsTransaction(scope, handler) {
    return this.executor.withConnection(async (rawConnection) => {
      const connection = assertConnection(rawConnection);
      return connection.transaction(async (rawTransaction) => {
        const transaction = assertTransaction(rawTransaction);
        await transaction.execute(bindIdentityStatement(scope));
        return handler(transaction);
      });
    });
  }

  async #transact(scope, handler, context = {}) {
    try {
      return await this.#withRlsTransaction(scope, handler);
    } catch (error) {
      if (error instanceof LorDomainError) throw error;
      throw mapDatabaseError(error, { caseId: scope.caseId, ...context });
    }
  }

  async #captureTransactionId(transaction) {
    const row = firstRow(
      await transaction.execute(
        statement(ATOMIC_RLS_CASE_STATEMENTS.transactionId, TRANSACTION_ID_SQL),
      ),
    );
    return assertNonEmptyString(row?.transaction_id, 'transactionId', { maxLength: 200 });
  }

  /** Full aggregate reads are permanently closed at this compatibility seam. */
  async selectCase(request) {
    void request;
    failClosed('FULL_AGGREGATE_READ_REQUIRES_ACTOR_SAFE_ADAPTER');
  }

  /** Full aggregate writes are permanently closed at this compatibility seam. */
  async executeAtomicCaseCommand(command) {
    void command;
    failClosed('FULL_AGGREGATE_WRITE_REQUIRES_ACTOR_SAFE_COMMAND');
  }

  async readStudentSafeCase(rawRequest) {
    const request = snapshotExact(rawRequest, READ_REQUEST_KEYS, 'READ_REQUEST_FIELDS_UNRECOGNIZED');
    assertTargetBinding(request.binding, this.target);
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const scope = assertScopeEnvelope(request.scope, {
      operation: 'read',
      caseId,
      actorRole: 'student',
    });
    return this.#transact(scope, async (transaction) => {
      const row = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.readStudentSafeCase,
            READ_STUDENT_SAFE_CASE_SQL,
            [caseId, scope.resourceStudentId],
          ),
        ),
      );
      if (!row) return deepFreeze({ found: false, state: null });
      const state = studentSafeStateFromRow(row);
      if (state.id !== caseId || state.studentId !== scope.resourceStudentId) {
        throw new AuthorizationDeniedError('DRIVER_CASE_SCOPE_MISMATCH');
      }
      return deepFreeze({ found: true, state });
    });
  }

  async readFacultyCaseProjection(rawRequest) {
    const request = snapshotExact(rawRequest, READ_REQUEST_KEYS, 'READ_REQUEST_FIELDS_UNRECOGNIZED');
    assertTargetBinding(request.binding, this.target);
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const scope = assertScopeEnvelope(request.scope, {
      operation: 'read',
      caseId,
      actorRole: 'faculty',
    });
    return this.#transact(scope, async (transaction) => {
      const row = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.readFacultyCaseProjection,
            READ_FACULTY_CASE_PROJECTION_SQL,
          ),
        ),
      );
      if (!row) return deepFreeze({ found: false, projection: null });
      const projection = normalizeFacultyProjection(row.result);
      if (projection.caseId !== caseId) failClosed('FACULTY_PROJECTION_CASE_DIVERGED');
      return deepFreeze({ found: true, projection });
    });
  }

  async readMentorCaseProjection(rawRequest) {
    const request = snapshotExact(rawRequest, READ_REQUEST_KEYS, 'READ_REQUEST_FIELDS_UNRECOGNIZED');
    assertTargetBinding(request.binding, this.target);
    const caseId = assertNonEmptyString(request.caseId, 'caseId', { maxLength: 200 });
    const scope = assertScopeEnvelope(request.scope, {
      operation: 'read',
      caseId,
      actorRole: 'mentor',
    });
    return this.#transact(scope, async (transaction) => {
      const row = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.readMentorCaseProjection,
            READ_MENTOR_CASE_PROJECTION_SQL,
          ),
        ),
      );
      if (!row) return deepFreeze({ found: false, projection: null });
      const projection = normalizeMentorProjection(row.result);
      if (projection.caseId !== caseId) failClosed('MENTOR_PROJECTION_CASE_DIVERGED');
      return deepFreeze({ found: true, projection });
    });
  }

  async reserveCaseCreation(rawRequest) {
    const request = snapshotExact(
      rawRequest,
      RESERVATION_REQUEST_KEYS,
      'RESERVATION_REQUEST_FIELDS_UNRECOGNIZED',
    );
    assertTargetBinding(request.binding, this.target);
    if (request.operation !== 'reserve_create') {
      throw new ValidationError('Creation reservation operation must be reserve_create');
    }
    if (!CREATION_REF_PATTERN.test(request.creationRef ?? '')) {
      throw new ValidationError('creationRef must be the canonical creation digest');
    }
    const creationRef = request.creationRef;
    const actorRef = assertNonEmptyString(request.actorRef, 'actorRef', { maxLength: 200 });
    const idempotencyKey = assertNonEmptyString(
      request.idempotencyKey,
      'idempotencyKey',
      { maxLength: 200 },
    );
    const requestHash = assertSha256(request.requestHash, 'requestHash');
    const proposed = snapshotExact(
      request.proposedIdentifiers,
      PROPOSED_IDENTIFIER_KEYS,
      'RESERVATION_IDENTIFIERS_UNRECOGNIZED',
    );
    const proposedCaseId = assertNonEmptyString(proposed.caseId, 'proposedIdentifiers.caseId', {
      maxLength: 200,
    });
    const proposedBuilderSessionId = assertNonEmptyString(
      proposed.builderSessionId,
      'proposedIdentifiers.builderSessionId',
      { maxLength: 200 },
    );
    if (proposedCaseId === proposedBuilderSessionId) {
      throw new ValidationError('Case and protected builder identifiers must be distinct');
    }
    const proposedCreatedAt = toIso(proposed.createdAt, 'proposedIdentifiers.createdAt');
    const scope = assertScopeEnvelope(request.scope, {
      operation: 'create',
      caseId: creationRef,
      actorRole: 'student',
    });
    if (actorRef !== `actor_${sha256(`lor-studio:actor:${scope.actorId}`)}`) {
      throw new AuthorizationDeniedError('CASE_CREATION_ACTOR_REF_MISMATCH');
    }

    return this.#transact(scope, async (transaction) => {
      const currentTransactionId = await this.#captureTransactionId(transaction);
      const inserted = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.insertCreationReservation,
            INSERT_CREATION_RESERVATION_SQL,
            [
              creationRef,
              scope.resourceStudentId,
              scope.authUid,
              actorRef,
              idempotencyKey,
              requestHash,
              proposedCaseId,
              proposedBuilderSessionId,
              proposedCreatedAt,
            ],
          ),
        ),
      );
      if (inserted) {
        if (inserted.transaction_id !== currentTransactionId) failClosed('ATOMIC_TRANSACTION_SPLIT');
        return this.#reservationReceipt({
          row: inserted,
          scope,
          request,
          transactionId: currentTransactionId,
          replayed: false,
          expected: { proposedCaseId, proposedBuilderSessionId, proposedCreatedAt },
        });
      }
      const existing = firstRow(
        await transaction.execute(
          statement(
            ATOMIC_RLS_CASE_STATEMENTS.selectCreationReservation,
            SELECT_CREATION_RESERVATION_SQL,
            [creationRef, scope.resourceStudentId, scope.authUid, actorRef],
          ),
        ),
      );
      if (!existing) failClosed('CREATION_RESERVATION_UNREADABLE');
      if (existing.request_hash !== requestHash) {
        throw new IdempotencyConflictError({ idempotencyKey });
      }
      return this.#reservationReceipt({
        row: existing,
        scope,
        request,
        transactionId: assertNonEmptyString(
          existing.transaction_id,
          'reservation transactionId',
          { maxLength: 200 },
        ),
        replayed: true,
        expected: null,
      });
    }, { caseId: creationRef, idempotencyKey });
  }

  #reservationReceipt({ row, scope, request, transactionId, replayed, expected }) {
    const caseId = assertNonEmptyString(row.case_id, 'reservation case_id', { maxLength: 200 });
    const builderSessionId = assertNonEmptyString(
      row.builder_session_id,
      'reservation builder_session_id',
      { maxLength: 200 },
    );
    const createdAt = toIso(row.created_at, 'reservation created_at');
    if (
      caseId === builderSessionId
      || row.request_hash !== request.requestHash
      || (expected && (
        caseId !== expected.proposedCaseId
        || builderSessionId !== expected.proposedBuilderSessionId
        || createdAt !== expected.proposedCreatedAt
      ))
    ) failClosed('CREATION_RESERVATION_BINDING_INVALID');
    return deepFreeze({
      schemaVersion: CREATION_RESERVATION_RECEIPT_SCHEMA,
      reserved: true,
      durable: true,
      sameTransaction: true,
      transactionId,
      replayed,
      creationRef: request.creationRef,
      actorRef: request.actorRef,
      idempotencyKey: request.idempotencyKey,
      requestHash: request.requestHash,
      caseId,
      builderSessionId,
      createdAt,
      authorizationBinding: authorizationBinding(scope),
    });
  }

  async #runStudentCommand(rawCommand, spec) {
    const input = normalizeStudentCommand(rawCommand, spec, this.target);
    const values = spec.operation === 'create'
      ? [
        canonicalize(input.state),
        input.idempotencyKey,
        input.requestHash,
        canonicalize(input.event),
        input.eventHash,
        canonicalize(input.versionEntry),
      ]
      : [
        canonicalize(input.state),
        input.expectedRevision,
        input.idempotencyKey,
        input.requestHash,
        canonicalize(input.event),
        input.eventHash,
        canonicalize(input.versionEntry),
        ...(spec.receipt ? [canonicalize(input.receipt)] : []),
      ];
    return this.#transact(input.scope, async (transaction) => {
      const row = firstRow(
        await transaction.execute(statement(spec.statementId, spec.sql, values)),
      );
      if (!row) failClosed('ATOMIC_COMMAND_RECEIPT_MISSING');
      return normalizeCommandReceipt(row.result, { input, spec });
    }, {
      caseId: input.state.id,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async commitStudentCaseCreate(command) {
    return this.#runStudentCommand(command, STUDENT_COMMANDS.commitStudentCaseCreate);
  }

  async commitStudentBuilderAutosave(command) {
    return this.#runStudentCommand(command, STUDENT_COMMANDS.commitStudentBuilderAutosave);
  }

  async commitStudentBuilderComplete(command) {
    return this.#runStudentCommand(command, STUDENT_COMMANDS.commitStudentBuilderComplete);
  }

  async commitStudentConsentReceipt(command) {
    return this.#runStudentCommand(command, STUDENT_COMMANDS.commitStudentConsentReceipt);
  }

  async commitStudentWaiverReceipt(command) {
    return this.#runStudentCommand(command, STUDENT_COMMANDS.commitStudentWaiverReceipt);
  }

  async commitFacultyFinalDocumentRelease(command) {
    const input = normalizeFacultyReleaseCommand(command, this.target);
    const values = [
      input.expectedRevision,
      input.documentId,
      input.idempotencyKey,
      input.requestHash,
      canonicalize(input.event),
      input.eventHash,
    ];
    return this.#transact(input.scope, async (transaction) => {
      const row = firstRow(
        await transaction.execute(statement(
          FACULTY_RELEASE_COMMAND.statementId,
          FACULTY_RELEASE_COMMAND.sql,
          values,
        )),
      );
      if (!row) failClosed('ATOMIC_COMMAND_RECEIPT_MISSING');
      return normalizeFacultyReleaseReceipt(row.result, { input });
    }, {
      caseId: input.scope.caseId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
    });
  }
}

export function createAtomicRlsCaseDriver(options) {
  return new AtomicRlsCaseDriver(options);
}

export const ATOMIC_RLS_CASE_DRIVER_CONTRACT = deepFreeze({
  integration: ATOMIC_RLS_CASE_DRIVER_INTEGRATION,
  authority: 'DR-120',
  relations: RELATIONS,
  relationOwnership: 'sole_layer_that_names_tables_or_columns',
  statements: ATOMIC_RLS_CASE_STATEMENTS,
  parameterization: 'all_caller_values_bound_never_interpolated',
  applicationDatabaseRole: APPLICATION_DB_ROLE,
  identitySource: 'server_verified_scope_only',
  identityScope: 'exact_14_axis_transaction_local_set_config',
  identityReset: null,
  studentRead: 'one_fixed_student_safe_projection_statement',
  facultyRead: 'one_fixed_seven_field_security_definer_function',
  mentorRead: 'one_fixed_five_field_security_definer_function',
  actorSafeMethods: [
    ...Object.keys(STUDENT_COMMANDS),
    'commitFacultyFinalDocumentRelease',
  ],
  securityDefinerFunctions: [
    ...Object.values(STUDENT_COMMANDS).map(({ sql }) => (
      sql.match(/lor_studio\.([a-z_]+)/u)?.[1]
    )),
    'read_mentor_case_projection',
    'read_faculty_case_projection',
    'commit_faculty_final_document_release',
  ],
  commandReceiptSchema: ATOMIC_COMMAND_RECEIPT_SCHEMA,
  commandReceiptKeys: [...COMMAND_RECEIPT_KEYS],
  atomicity: 'database_command_state_audit_protected_chain_and_receipt_one_transaction',
  concurrency: 'database_command_case_lock_and_exact_expected_revision',
  idempotency: 'database_command_action_and_request_replay_precedes_candidate_validation',
  compatibility: {
    selectCase: 'fail_closed',
    executeAtomicCaseCommand: 'fail_closed',
  },
  creationReservationReceiptSchema: CREATION_RESERVATION_RECEIPT_SCHEMA,
  executorPort: {
    withConnection: 'exclusive_connection_for_the_handler',
    transaction: 'commit_on_resolve_rollback_and_rethrow_on_reject',
    statementShape: ['statementId', 'text', 'values'],
  },
});
