import { DomainInvariantError, StaleRevisionError, ValidationError } from './errors.js';
import { currentWaiverState } from './receipts.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  cloneFrozen,
  deepFreeze,
  hashValue,
  makeId,
  sha256,
  toIso,
} from './value-utils.js';

export const BUILDER_STEPS = deepFreeze([
  'case_basics',
  'writer_relationship',
  'evidence_selection',
  'timeline_highlights',
  'writer_preferences',
  'consent_and_waiver',
  'review',
  'faculty_handoff',
]);

export const CASE_STATUSES = deepFreeze([
  'draft',
  'faculty_invited',
  'faculty_verified',
  'faculty_review',
  'faculty_approved',
  'delivered',
  'closed',
  'cancelled',
]);

export const STRATEGY_STATUSES = deepFreeze([
  'not_started',
  'writer_selected',
  'writer_invited',
  'faculty_review',
  'approved',
  'delivered',
  'closed',
  'blocked',
]);

export const STRATEGY_MILESTONES = deepFreeze([
  'complete_builder',
  'invite_faculty',
  'faculty_verification',
  'faculty_review',
  'faculty_approval',
  'delivery',
  'closure',
]);

const ALLOWED_TRANSITIONS = deepFreeze({
  draft: ['faculty_invited', 'cancelled'],
  faculty_invited: ['faculty_verified', 'cancelled'],
  faculty_verified: ['faculty_review', 'cancelled'],
  faculty_review: ['faculty_approved', 'cancelled'],
  faculty_approved: ['delivered', 'cancelled'],
  delivered: ['closed'],
  closed: [],
  cancelled: [],
});

/**
 * The only final-wording states this codebase names. `faculty_final` is the single state the
 * release renderer will export (documents/recommendation-artifacts.mjs:29) and `ai_proposal` is
 * the non-final state that module's own contract rejects. Nothing further is invented here: the
 * case lifecycle is already modelled by CASE_STATUSES and is not duplicated per document.
 */
export const FINAL_DOCUMENT_STATES = deepFreeze(['ai_proposal', 'faculty_final']);

/**
 * The only case shape a student command or student read may hydrate from durable storage.
 * Protected faculty state, invitation bindings, mentor assignments, and the protected version
 * history are deliberately not members of this schema.
 */
export const STUDENT_SAFE_CASE_SCHEMA = 'missionmed.lor.student-safe-case.v1';
export const STUDENT_SAFE_CASE_FIELDS = deepFreeze([
  'schemaVersion',
  'id',
  'studentId',
  'status',
  'revision',
  'createdAt',
  'updatedAt',
  'closedAt',
  'builder',
  'studentEvidence',
  'applicantOptions',
  'consentReceipts',
  'waiverReceipts',
  'delivery',
  'releasedDocument',
]);

/** The database mentor read is intentionally five fields and nothing else. */
export const MENTOR_CASE_PROJECTION_FIELDS = deepFreeze([
  'caseId',
  'status',
  'strategyStatus',
  'nextMilestone',
  'deliveryStatus',
]);

/**
 * The durable faculty boundary preserves the established production transport shape while
 * excluding the full aggregate, invitation/OTP rows, protected history, and student builder.
 */
export const FACULTY_CASE_PROJECTION_SCHEMA = 'missionmed.lor.faculty-projection.v1';
export const FACULTY_CASE_PROJECTION_FIELDS = deepFreeze([
  'schemaVersion',
  'caseId',
  'revision',
  'status',
  'studentShared',
  'facultyPrivate',
  'delivery',
]);

const STUDENT_SAFE_BUILDER_FIELDS = deepFreeze([
  'sessionId',
  'totalSteps',
  'completedStepIds',
  'currentStepId',
  'stepData',
  'autosavedAt',
]);
const STUDENT_SAFE_DELIVERY_FIELDS = deepFreeze(['status', 'destinationClass', 'deliveredAt']);
const STUDENT_SAFE_RELEASE_FIELDS = deepFreeze([
  'finalDocument',
  'facultyApproval',
  'release',
  'snapshotHash',
]);
const STUDENT_SAFE_RELEASED_DOCUMENT_FIELDS = deepFreeze([
  'id',
  'text',
  'contentHash',
  'mimeType',
  'releasedToStudentAt',
]);
const STUDENT_SAFE_FACULTY_APPROVAL_FIELDS = deepFreeze([
  'approved',
  'approvedAt',
  'facultyRef',
  'signatureAttested',
]);
const STUDENT_SAFE_RELEASE_BINDING_FIELDS = deepFreeze([
  'documentId',
  'documentHash',
  'releasedAt',
  'releasedAtRevision',
  'waiverReceiptId',
]);
const STUDENT_SAFE_CONSENT_RECEIPT_FIELDS = deepFreeze([
  'schemaVersion',
  'id',
  'caseId',
  'actorId',
  'scopes',
  'policyVersion',
  'recordedAt',
  'receiptHash',
]);
const STUDENT_SAFE_WAIVER_RECEIPT_FIELDS = deepFreeze([
  'schemaVersion',
  'id',
  'caseId',
  'actorId',
  'waived',
  'policyVersion',
  'priorReceiptId',
  'acknowledgment',
  'recordedAt',
  'receiptHash',
]);
const FACULTY_STUDENT_SHARED_FIELDS = deepFreeze([
  'evidence',
  'applicantOptions',
  'consentReceipts',
  'waiverState',
]);
const FACULTY_WAIVER_STATE_FIELDS = deepFreeze(['decided', 'waived', 'receiptId']);

/**
 * `releasedToStudentAt` is deliberately absent from the content fields. It is not content, it is
 * the derived mirror of finalDocumentState.release, and releaseFinalDocument is the only writer.
 */
const FINAL_DOCUMENT_CONTENT_FIELDS = deepFreeze(['contentHash', 'id', 'mimeType', 'text']);
const FINAL_DOCUMENT_FIELDS = deepFreeze([...FINAL_DOCUMENT_CONTENT_FIELDS, 'releasedToStudentAt']);
const FACULTY_APPROVAL_FIELDS = deepFreeze(['approved', 'approvedAt', 'facultyId', 'signatureAttested']);
const FINAL_DOCUMENT_RELEASE_FIELDS = deepFreeze([
  'documentHash',
  'documentId',
  'releasedAt',
  'releasedAtRevision',
  'waiverReceiptId',
]);
const FINAL_DOCUMENT_STATE_FIELDS = deepFreeze(['documentState', 'facultyApproval', 'release']);
const FACULTY_PRIVATE_FIELDS = deepFreeze(['answers', 'draftText', 'finalDocument', 'notes']);

const TERMINAL_STATUSES = new Set(['closed', 'cancelled']);
const INVITED_STATUSES = new Set([
  'faculty_invited',
  'faculty_verified',
  'faculty_review',
  'faculty_approved',
  'delivered',
  'closed',
]);
const VERIFIED_FACULTY_STATUSES = new Set([
  'faculty_verified',
  'faculty_review',
  'faculty_approved',
  'delivered',
  'closed',
]);

function hasExactKeys(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function finalDocumentContent(finalDocument) {
  return {
    contentHash: finalDocument.contentHash ?? null,
    id: finalDocument.id ?? null,
    mimeType: finalDocument.mimeType ?? null,
    text: finalDocument.text ?? null,
  };
}

/**
 * The identity a release is bound to. Release records this digest, and the invariant below
 * re-derives it on every write, so a later edit of the wording cannot silently re-scope what was
 * already released to the student: the edited record simply fails validation.
 *
 * @param {Record<string, unknown> | null} finalDocument
 * @returns {string | null}
 */
export function finalDocumentContentHash(finalDocument) {
  return finalDocument === null || finalDocument === undefined
    ? null
    : hashValue(finalDocumentContent(finalDocument));
}

function normalizeFinalDocumentInput(finalDocument) {
  if (finalDocument === null || finalDocument === undefined) return null;
  assertPlainObject(finalDocument, 'finalDocument');
  for (const key of Object.keys(finalDocument)) {
    if (!FINAL_DOCUMENT_FIELDS.includes(key)) {
      throw new ValidationError('finalDocument contains an unsupported field', { fieldName: key });
    }
  }
  for (const key of FINAL_DOCUMENT_CONTENT_FIELDS) {
    const value = finalDocument[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new ValidationError(`finalDocument.${key} must be a string or null`, { fieldName: key });
    }
  }
  if (typeof finalDocument.text === 'string' && Buffer.byteLength(finalDocument.text, 'utf8') > 256_000) {
    throw new ValidationError('finalDocument.text exceeds the local safety limit');
  }
  // releasedToStudentAt is accepted syntactically and then discarded. It is never honoured from a
  // caller: student visibility of the final letter is granted by releaseFinalDocument alone.
  return finalDocumentContent(finalDocument);
}

function normalizeFacultyApprovalInput(facultyApproval) {
  if (facultyApproval === null || facultyApproval === undefined) return null;
  assertPlainObject(facultyApproval, 'facultyApproval');
  if (!hasExactKeys(facultyApproval, FACULTY_APPROVAL_FIELDS)) {
    throw new ValidationError('facultyApproval must declare approved, signatureAttested, approvedAt, and facultyId');
  }
  if (typeof facultyApproval.approved !== 'boolean' || typeof facultyApproval.signatureAttested !== 'boolean') {
    throw new ValidationError('facultyApproval approval and signature attestation must be explicit booleans');
  }
  assertNonEmptyString(facultyApproval.facultyId, 'facultyApproval.facultyId', { maxLength: 200 });
  return {
    approved: facultyApproval.approved,
    approvedAt: toIso(facultyApproval.approvedAt, 'facultyApproval.approvedAt'),
    facultyId: facultyApproval.facultyId,
    signatureAttested: facultyApproval.signatureAttested,
  };
}

function validateStepData(stepData) {
  assertPlainObject(stepData, 'stepData');
  const serialized = JSON.stringify(stepData);
  if (Buffer.byteLength(serialized, 'utf8') > 256_000) {
    throw new ValidationError('Builder step data exceeds the local safety limit');
  }
  return structuredClone(stepData);
}

function versionEntry({ revision, eventType, actorId, occurredAt, changes }) {
  assertNonEmptyString(eventType, 'eventType', { maxLength: 100 });
  assertNonEmptyString(actorId, 'actorId', { maxLength: 200 });
  return deepFreeze({
    revision,
    eventType,
    actorId,
    occurredAt: toIso(occurredAt, 'occurredAt'),
    changedFields: Object.keys(changes).sort(),
    changeHash: hashValue(changes),
  });
}

/**
 * Build the metadata-only entry that a protected version-history row appends in the database.
 * Student-safe state never contains the history itself; callers pass this value beside the
 * state so the command function can append it without accepting any prior protected entries.
 */
export function createRecommendationCaseVersionEntry(input) {
  const entry = assertPlainObject(input, 'version entry input');
  if (!Number.isSafeInteger(entry.revision) || entry.revision < 0) {
    throw new ValidationError('Version entry revision must be a non-negative integer');
  }
  assertPlainObject(entry.changes, 'version entry changes');
  return versionEntry(entry);
}

export function createRecommendationCase({
  id,
  studentId,
  actorId = studentId,
  now = new Date(),
  builderSessionId,
  idFactory = undefined,
}) {
  assertNonEmptyString(id, 'id', { maxLength: 200 });
  assertNonEmptyString(studentId, 'studentId', { maxLength: 200 });
  assertNonEmptyString(actorId, 'actorId', { maxLength: 200 });
  const timestamp = toIso(now, 'now');
  const resolvedBuilderSessionId = builderSessionId ?? makeId('builder', idFactory);
  assertNonEmptyString(resolvedBuilderSessionId, 'builderSessionId', { maxLength: 200 });
  if (resolvedBuilderSessionId === id) {
    throw new ValidationError('Case and protected builder identifiers must be distinct');
  }
  const initial = {
    schemaVersion: 'missionmed.lor.recommendation-case.v1',
    id,
    studentId,
    status: 'draft',
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
    builder: {
      sessionId: resolvedBuilderSessionId,
      totalSteps: BUILDER_STEPS.length,
      completedStepIds: [],
      currentStepId: BUILDER_STEPS[0],
      stepData: {},
      autosavedAt: null,
    },
    faculty: {
      invitationId: null,
      facultyId: null,
      recipientEmailHash: null,
      verifiedAt: null,
    },
    studentEvidence: [],
    applicantOptions: [],
    strategyMetadata: {},
    consentReceipts: [],
    waiverReceipts: [],
    facultyPrivate: {
      answers: [],
      notes: [],
      draftText: null,
      finalDocument: null,
    },
    finalDocumentState: {
      documentState: null,
      facultyApproval: null,
      release: null,
    },
    delivery: {
      status: 'not_started',
      destinationClass: null,
      deliveredAt: null,
    },
    versionHistory: [],
  };
  initial.versionHistory.push(
    versionEntry({
      revision: 0,
      eventType: 'case.created',
      actorId,
      occurredAt: timestamp,
      changes: { status: 'draft', studentId },
    }),
  );
  return deepFreeze(initial);
}

function assertStudentSafeBuilder(builder, caseId) {
  if (!hasExactKeys(builder, STUDENT_SAFE_BUILDER_FIELDS)) {
    throw new DomainInvariantError('Student-safe builder must contain exactly its canonical fields');
  }
  assertNonEmptyString(builder.sessionId, 'builder.sessionId', { maxLength: 200 });
  if (builder.sessionId === caseId) {
    throw new DomainInvariantError('Case and protected builder identifiers must be distinct');
  }
  if (builder.totalSteps !== BUILDER_STEPS.length) {
    throw new DomainInvariantError('Every builder session must have exactly eight steps');
  }
  const completed = builder.completedStepIds;
  if (!Array.isArray(completed) || completed.some((step, index) => step !== BUILDER_STEPS[index])) {
    throw new DomainInvariantError('Builder steps must be completed once and in canonical order');
  }
  if (builder.currentStepId !== (BUILDER_STEPS[completed.length] ?? null)) {
    throw new DomainInvariantError('Builder current step must equal the next canonical step');
  }
  if (
    !builder.stepData
    || typeof builder.stepData !== 'object'
    || Array.isArray(builder.stepData)
    || Object.keys(builder.stepData).some((stepId) => !BUILDER_STEPS.includes(stepId))
    || completed.some((stepId) => !(stepId in builder.stepData))
  ) {
    throw new DomainInvariantError('Builder step data must use canonical step identifiers');
  }
  for (const value of Object.values(builder.stepData)) validateStepData(value);
  if (builder.autosavedAt !== null) toIso(builder.autosavedAt, 'builder.autosavedAt');
}

function assertStudentSafeReceipt(receipt, { caseId, studentId, receiptType }) {
  const expectedSchema = `missionmed.lor.${receiptType}-receipt.v1`;
  const expectedFields = receiptType === 'consent'
    ? STUDENT_SAFE_CONSENT_RECEIPT_FIELDS
    : STUDENT_SAFE_WAIVER_RECEIPT_FIELDS;
  if (
    !hasExactKeys(receipt, expectedFields)
    || receipt.schemaVersion !== expectedSchema
    || receipt.caseId !== caseId
    || receipt.actorId !== studentId
  ) {
    throw new DomainInvariantError('Student-safe receipt must match its case, student, type, and schema');
  }
  assertNonEmptyString(receipt.id, `${receiptType} receipt id`, { maxLength: 200 });
  assertNonEmptyString(receipt.policyVersion, `${receiptType} receipt policyVersion`, { maxLength: 200 });
  if (receiptType === 'consent') {
    if (
      !Array.isArray(receipt.scopes)
      || receipt.scopes.length === 0
      || receipt.scopes.some((scope) => typeof scope !== 'string' || scope.length === 0)
    ) {
      throw new DomainInvariantError('Consent receipt scopes must be non-empty strings');
    }
  } else {
    if (typeof receipt.waived !== 'boolean') {
      throw new DomainInvariantError('Waiver receipt decision must be explicit');
    }
    if (receipt.priorReceiptId !== null) {
      assertNonEmptyString(receipt.priorReceiptId, 'waiver receipt priorReceiptId', { maxLength: 200 });
    }
    assertNonEmptyString(receipt.acknowledgment, 'waiver receipt acknowledgment', { maxLength: 2_000 });
  }
  toIso(receipt.recordedAt, `${receiptType} receipt recordedAt`);
  const receiptPayload = Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== 'receiptHash'),
  );
  if (receipt.receiptHash !== hashValue(receiptPayload)) {
    throw new DomainInvariantError('Student-safe receipt integrity hash is invalid');
  }
}

function assertStudentSafeReceipts(record) {
  if (!Array.isArray(record.consentReceipts) || !Array.isArray(record.waiverReceipts)) {
    throw new DomainInvariantError('Consent and waiver receipts must be append-only arrays');
  }
  const knownIds = new Set();
  for (const receipt of record.consentReceipts) {
    assertStudentSafeReceipt(receipt, {
      caseId: record.id,
      studentId: record.studentId,
      receiptType: 'consent',
    });
    if (knownIds.has(receipt.id)) throw new DomainInvariantError('Receipt IDs must be unique');
    knownIds.add(receipt.id);
  }
  for (const receipt of record.waiverReceipts) {
    assertStudentSafeReceipt(receipt, {
      caseId: record.id,
      studentId: record.studentId,
      receiptType: 'waiver',
    });
    if (knownIds.has(receipt.id)) throw new DomainInvariantError('Receipt IDs must be unique');
    knownIds.add(receipt.id);
  }
  // This also validates the explicit, chronological supersession chain.
  currentWaiverState(record.waiverReceipts);
}

function assertStudentSafeReleasedDocument(releasedDocument, record) {
  if (releasedDocument === null) return;
  if (!hasExactKeys(releasedDocument, STUDENT_SAFE_RELEASE_FIELDS)) {
    throw new DomainInvariantError('Released student document must contain exactly its canonical fields');
  }
  const { finalDocument, facultyApproval, release, snapshotHash } = releasedDocument;
  if (!hasExactKeys(finalDocument, STUDENT_SAFE_RELEASED_DOCUMENT_FIELDS)) {
    throw new DomainInvariantError('Released final document must contain exactly its canonical fields');
  }
  for (const field of ['id', 'text', 'contentHash', 'mimeType']) {
    if (finalDocument[field] !== null && typeof finalDocument[field] !== 'string') {
      throw new DomainInvariantError(`Released finalDocument.${field} must be a string or null`);
    }
  }
  toIso(finalDocument.releasedToStudentAt, 'released finalDocument.releasedToStudentAt');
  if (
    !hasExactKeys(facultyApproval, STUDENT_SAFE_FACULTY_APPROVAL_FIELDS)
    || facultyApproval.approved !== true
    || facultyApproval.signatureAttested !== true
  ) {
    throw new DomainInvariantError('Released document requires an approved, attested faculty approval');
  }
  if (!/^faculty_[a-f0-9]{64}$/u.test(facultyApproval.facultyRef ?? '')) {
    throw new DomainInvariantError('Faculty approval must expose only a pseudonymous faculty reference');
  }
  toIso(facultyApproval.approvedAt, 'facultyApproval.approvedAt');
  if (!hasExactKeys(release, STUDENT_SAFE_RELEASE_BINDING_FIELDS)) {
    throw new DomainInvariantError('Released document binding must contain exactly its canonical fields');
  }
  assertNonEmptyString(release.documentId, 'release.documentId', { maxLength: 200 });
  assertNonEmptyString(release.waiverReceiptId, 'release.waiverReceiptId', { maxLength: 200 });
  if (!/^[a-f0-9]{64}$/u.test(release.documentHash ?? '')) {
    throw new DomainInvariantError('Released document binding must contain a SHA-256 document hash');
  }
  if (!Number.isSafeInteger(release.releasedAtRevision) || release.releasedAtRevision < 0) {
    throw new DomainInvariantError('Released document revision must be a non-negative integer');
  }
  toIso(release.releasedAt, 'release.releasedAt');
  if (
    release.documentId !== finalDocument.id
    || release.documentHash !== finalDocumentContentHash(finalDocument)
    || release.releasedAt !== finalDocument.releasedToStudentAt
    || release.releasedAtRevision > record.revision
  ) {
    throw new DomainInvariantError('Released document is not bound to the exact visible version');
  }
  if (!/^[a-f0-9]{64}$/u.test(snapshotHash ?? '')) {
    throw new DomainInvariantError('Released document snapshot hash must be a SHA-256 digest');
  }
  const waiver = currentWaiverState(record.waiverReceipts);
  const releaseWaiver = record.waiverReceipts.find((receipt) => receipt.id === release.waiverReceiptId);
  if (waiver.decided !== true || waiver.waived !== false || releaseWaiver?.waived !== false) {
    throw new DomainInvariantError('Released document visibility requires a current non-waiver decision');
  }
}

/** Validate, without hydrating or consulting any protected aggregate fields. */
export function assertStudentSafeRecommendationCase(record) {
  if (!hasExactKeys(record, STUDENT_SAFE_CASE_FIELDS) || record.schemaVersion !== STUDENT_SAFE_CASE_SCHEMA) {
    throw new DomainInvariantError('Unsupported student-safe recommendation case schema');
  }
  assertNonEmptyString(record.id, 'id', { maxLength: 200 });
  assertNonEmptyString(record.studentId, 'studentId', { maxLength: 200 });
  if (!CASE_STATUSES.includes(record.status)) {
    throw new DomainInvariantError('Invalid recommendation case status');
  }
  if (!Number.isSafeInteger(record.revision) || record.revision < 0) {
    throw new DomainInvariantError('Revision must be a non-negative integer');
  }
  const createdAt = toIso(record.createdAt, 'createdAt');
  const updatedAt = toIso(record.updatedAt, 'updatedAt');
  if (new Date(updatedAt).valueOf() < new Date(createdAt).valueOf()) {
    throw new DomainInvariantError('Recommendation case cannot be updated before it is created');
  }
  if ((record.status === 'closed') !== (record.closedAt !== null)) {
    throw new DomainInvariantError('closedAt must exist only for closed cases');
  }
  if (record.closedAt !== null) toIso(record.closedAt, 'closedAt');
  assertStudentSafeBuilder(record.builder, record.id);
  if (!Array.isArray(record.studentEvidence) || !Array.isArray(record.applicantOptions)) {
    throw new DomainInvariantError('Student evidence and applicant options must be arrays');
  }
  if (!hasExactKeys(record.delivery, STUDENT_SAFE_DELIVERY_FIELDS)) {
    throw new DomainInvariantError('Student-safe delivery must contain exactly its canonical fields');
  }
  assertNonEmptyString(record.delivery.status, 'delivery.status', { maxLength: 100 });
  for (const field of ['destinationClass', 'deliveredAt']) {
    if (record.delivery[field] !== null && typeof record.delivery[field] !== 'string') {
      throw new DomainInvariantError(`delivery.${field} must be a string or null`);
    }
  }
  if (record.delivery.deliveredAt !== null) toIso(record.delivery.deliveredAt, 'delivery.deliveredAt');
  assertStudentSafeReceipts(record);
  assertStudentSafeReleasedDocument(record.releasedDocument, record);
  return record;
}

function studentSafeReleaseFromAggregate(record) {
  const waiver = currentWaiverState(record.waiverReceipts);
  const lifecycle = record.finalDocumentState;
  const sourceDocument = record.facultyPrivate.finalDocument;
  if (
    waiver.decided !== true
    || waiver.waived !== false
    || lifecycle.release === null
    || sourceDocument === null
    || !sourceDocument.releasedToStudentAt
  ) return null;
  const finalDocument = releasedFinalDocumentContent(sourceDocument);
  const facultyApproval = {
    approved: lifecycle.facultyApproval.approved,
    approvedAt: lifecycle.facultyApproval.approvedAt,
    facultyRef: `faculty_${sha256(`lor-studio:faculty:${lifecycle.facultyApproval.facultyId}`)}`,
    signatureAttested: lifecycle.facultyApproval.signatureAttested,
  };
  const release = structuredClone(lifecycle.release);
  return {
    finalDocument,
    facultyApproval,
    release,
    snapshotHash: hashValue({ finalDocument, facultyApproval, release }),
  };
}

function releasedFinalDocumentContent(finalDocument) {
  return {
    id: finalDocument.id ?? null,
    text: finalDocument.text ?? null,
    contentHash: finalDocument.contentHash ?? null,
    mimeType: finalDocument.mimeType ?? null,
    releasedToStudentAt: finalDocument.releasedToStudentAt,
  };
}

/** Convert a trusted full aggregate into the exact student-safe boundary shape. */
export function toStudentSafeRecommendationCase(record) {
  assertRecommendationCase(record);
  const safe = {
    schemaVersion: STUDENT_SAFE_CASE_SCHEMA,
    id: record.id,
    studentId: record.studentId,
    status: record.status,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    closedAt: record.closedAt,
    builder: structuredClone(record.builder),
    studentEvidence: structuredClone(record.studentEvidence),
    applicantOptions: structuredClone(record.applicantOptions),
    consentReceipts: structuredClone(record.consentReceipts),
    waiverReceipts: structuredClone(record.waiverReceipts),
    delivery: structuredClone(record.delivery),
    releasedDocument: studentSafeReleaseFromAggregate(record),
  };
  assertStudentSafeRecommendationCase(safe);
  return deepFreeze(safe);
}

/** Build revision zero without ever constructing faculty-private or strategy state. */
export function createStudentSafeRecommendationCase({
  id,
  studentId,
  actorId = studentId,
  now = new Date(),
  builderSessionId,
  idFactory = undefined,
}) {
  assertNonEmptyString(id, 'id', { maxLength: 200 });
  assertNonEmptyString(studentId, 'studentId', { maxLength: 200 });
  assertNonEmptyString(actorId, 'actorId', { maxLength: 200 });
  const timestamp = toIso(now, 'now');
  const resolvedBuilderSessionId = builderSessionId ?? makeId('builder', idFactory);
  assertNonEmptyString(resolvedBuilderSessionId, 'builderSessionId', { maxLength: 200 });
  const state = {
    schemaVersion: STUDENT_SAFE_CASE_SCHEMA,
    id,
    studentId,
    status: 'draft',
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
    builder: {
      sessionId: resolvedBuilderSessionId,
      totalSteps: BUILDER_STEPS.length,
      completedStepIds: [],
      currentStepId: BUILDER_STEPS[0],
      stepData: {},
      autosavedAt: null,
    },
    studentEvidence: [],
    applicantOptions: [],
    consentReceipts: [],
    waiverReceipts: [],
    delivery: {
      status: 'not_started',
      destinationClass: null,
      deliveredAt: null,
    },
    releasedDocument: null,
  };
  assertStudentSafeRecommendationCase(state);
  return deepFreeze({
    state: deepFreeze(state),
    versionEntry: createRecommendationCaseVersionEntry({
      revision: 0,
      eventType: 'case.created',
      actorId,
      occurredAt: timestamp,
      changes: { status: 'draft', studentId },
    }),
  });
}

function mutateStudentSafeRecommendationCase(record, {
  actorId,
  eventType,
  changes,
  versionChanges = changes,
  now = new Date(),
}) {
  assertStudentSafeRecommendationCase(record);
  assertNonEmptyString(actorId, 'actorId', { maxLength: 200 });
  assertNonEmptyString(eventType, 'eventType', { maxLength: 100 });
  assertPlainObject(changes, 'changes');
  assertPlainObject(versionChanges, 'version changes');
  if (TERMINAL_STATUSES.has(record.status)) {
    throw new DomainInvariantError('Terminal recommendation cases are immutable');
  }
  const timestamp = toIso(now, 'now');
  const next = structuredClone(record);
  for (const [field, value] of Object.entries(changes)) next[field] = structuredClone(value);
  next.revision = record.revision + 1;
  next.updatedAt = timestamp;
  assertStudentSafeRecommendationCase(next);
  return deepFreeze({
    state: deepFreeze(next),
    versionEntry: createRecommendationCaseVersionEntry({
      revision: next.revision,
      eventType,
      actorId,
      occurredAt: timestamp,
      changes: versionChanges,
    }),
  });
}

export function autosaveStudentSafeBuilderStep(record, {
  actorId,
  stepId,
  stepData,
  now = new Date(),
}) {
  assertStudentSafeRecommendationCase(record);
  if (record.status !== 'draft') {
    throw new DomainInvariantError('The student builder is locked after faculty invitation');
  }
  if (!BUILDER_STEPS.includes(stepId)) throw new ValidationError('Unknown builder step');
  const completed = record.builder.completedStepIds;
  if (BUILDER_STEPS.indexOf(stepId) > completed.length) {
    throw new DomainInvariantError('Builder steps cannot be skipped');
  }
  const timestamp = toIso(now, 'now');
  const builder = structuredClone(record.builder);
  builder.stepData[stepId] = validateStepData(stepData);
  builder.currentStepId = BUILDER_STEPS[completed.length] ?? null;
  builder.autosavedAt = timestamp;
  return mutateStudentSafeRecommendationCase(record, {
    actorId,
    eventType: 'builder.autosaved',
    changes: { builder },
    now: new Date(timestamp),
  });
}

export function completeStudentSafeBuilderStep(record, {
  actorId,
  stepId,
  now = new Date(),
}) {
  assertStudentSafeRecommendationCase(record);
  if (record.status !== 'draft') {
    throw new DomainInvariantError('The student builder is locked after faculty invitation');
  }
  const expectedStep = BUILDER_STEPS[record.builder.completedStepIds.length];
  if (stepId !== expectedStep) {
    throw new DomainInvariantError('Only the next canonical builder step may be completed');
  }
  if (!(stepId in record.builder.stepData)) {
    throw new DomainInvariantError('A builder step must be autosaved before completion');
  }
  const builder = structuredClone(record.builder);
  builder.completedStepIds.push(stepId);
  builder.currentStepId = BUILDER_STEPS[builder.completedStepIds.length] ?? null;
  builder.autosavedAt = toIso(now, 'now');
  return mutateStudentSafeRecommendationCase(record, {
    actorId,
    eventType: 'builder.step_completed',
    changes: { builder },
    now,
  });
}

export function appendStudentSafeReceipt(record, {
  actorId,
  receiptType,
  receipt,
  now = new Date(),
}) {
  assertStudentSafeRecommendationCase(record);
  if (!['consent', 'waiver'].includes(receiptType)) throw new ValidationError('Unknown receipt type');
  assertStudentSafeReceipt(receipt, {
    caseId: record.id,
    studentId: record.studentId,
    receiptType,
  });
  const field = receiptType === 'consent' ? 'consentReceipts' : 'waiverReceipts';
  if (record[field].some((item) => item.id === receipt.id)) {
    throw new DomainInvariantError('Receipt IDs are append-only and unique');
  }
  const receipts = [...record[field], cloneFrozen(receipt)];
  if (receiptType === 'waiver') currentWaiverState(receipts);
  const changes = { [field]: receipts };
  // A newly waived student must not carry previously released wording back through p_state.
  if (receiptType === 'waiver' && receipt.waived === true && record.releasedDocument !== null) {
    changes.releasedDocument = null;
  }
  return mutateStudentSafeRecommendationCase(record, {
    actorId,
    eventType: `${receiptType}.recorded`,
    changes,
    versionChanges: { [field]: receipts },
    now,
  });
}

export function studentSafeBuilderProgress(record) {
  assertStudentSafeRecommendationCase(record);
  const completedSteps = record.builder.completedStepIds.length;
  return deepFreeze({
    sessionId: record.builder.sessionId,
    completedSteps,
    totalSteps: BUILDER_STEPS.length,
    percent: Math.round((completedSteps / BUILDER_STEPS.length) * 100),
    nextStepId: BUILDER_STEPS[completedSteps] ?? null,
    autosavedAt: record.builder.autosavedAt,
  });
}

/** Preserve the established student HTTP projection without a full aggregate read. */
export function projectStudentSafeCase(record) {
  assertStudentSafeRecommendationCase(record);
  const waiver = currentWaiverState(record.waiverReceipts);
  const finalDocument = waiver.decided && waiver.waived === false
    ? record.releasedDocument?.finalDocument ?? null
    : null;
  return deepFreeze({
    schemaVersion: 'missionmed.lor.student-projection.v1',
    caseId: record.id,
    revision: record.revision,
    status: record.status,
    builder: cloneFrozen(record.builder),
    studentEvidence: cloneFrozen(record.studentEvidence),
    applicantOptions: cloneFrozen(record.applicantOptions),
    consentReceipts: cloneFrozen(record.consentReceipts),
    waiverReceipts: cloneFrozen(record.waiverReceipts),
    delivery: cloneFrozen(record.delivery),
    finalDocument: finalDocument === null ? null : cloneFrozen(finalDocument),
  });
}

function assertProjectionObjectArray(value, fieldName) {
  if (
    !Array.isArray(value)
    || value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
  ) {
    throw new DomainInvariantError(`${fieldName} must contain objects only`);
  }
}

/** Validate the exact seven-field DTO returned by the durable faculty projection function. */
export function assertFacultyCaseProjection(projection) {
  if (
    !hasExactKeys(projection, FACULTY_CASE_PROJECTION_FIELDS)
    || projection.schemaVersion !== FACULTY_CASE_PROJECTION_SCHEMA
  ) {
    throw new DomainInvariantError('Faculty case projection must contain exactly seven canonical fields');
  }
  assertNonEmptyString(projection.caseId, 'faculty projection caseId', { maxLength: 200 });
  if (!Number.isSafeInteger(projection.revision) || projection.revision < 0) {
    throw new DomainInvariantError('Faculty projection revision must be a non-negative integer');
  }
  if (!CASE_STATUSES.includes(projection.status)) {
    throw new DomainInvariantError('Faculty projection status must be canonical');
  }

  const shared = projection.studentShared;
  if (!hasExactKeys(shared, FACULTY_STUDENT_SHARED_FIELDS)) {
    throw new DomainInvariantError('Faculty studentShared projection is outside its exact allowlist');
  }
  assertProjectionObjectArray(shared.evidence, 'Faculty projection evidence');
  assertProjectionObjectArray(shared.applicantOptions, 'Faculty projection applicantOptions');
  if (!Array.isArray(shared.consentReceipts)) {
    throw new DomainInvariantError('Faculty projection consentReceipts must be an array');
  }
  const consentActors = new Set();
  for (const receipt of shared.consentReceipts) {
    if (!/^wp:[1-9][0-9]*$/u.test(receipt?.actorId ?? '')) {
      throw new DomainInvariantError('Faculty projection consent receipt actor must be canonical');
    }
    assertStudentSafeReceipt(receipt, {
      caseId: projection.caseId,
      studentId: receipt.actorId,
      receiptType: 'consent',
    });
    consentActors.add(receipt.actorId);
  }
  if (consentActors.size > 1) {
    throw new DomainInvariantError('Faculty projection consent receipts cannot cross students');
  }

  const waiverState = shared.waiverState;
  if (!hasExactKeys(waiverState, FACULTY_WAIVER_STATE_FIELDS)) {
    throw new DomainInvariantError('Faculty waiver state must contain exactly its canonical fields');
  }
  if (
    typeof waiverState.decided !== 'boolean'
    || (waiverState.decided === false && (
      waiverState.waived !== null
      || waiverState.receiptId !== null
    ))
    || (waiverState.decided === true && (
      typeof waiverState.waived !== 'boolean'
      || typeof waiverState.receiptId !== 'string'
      || waiverState.receiptId.trim() === ''
    ))
  ) {
    throw new DomainInvariantError('Faculty projection waiver state is invalid');
  }

  const privateState = projection.facultyPrivate;
  if (!hasExactKeys(privateState, FACULTY_PRIVATE_FIELDS)) {
    throw new DomainInvariantError('Faculty-private projection is outside its exact allowlist');
  }
  assertProjectionObjectArray(privateState.answers, 'Faculty-private answers');
  assertProjectionObjectArray(privateState.notes, 'Faculty-private notes');
  if (privateState.draftText !== null && typeof privateState.draftText !== 'string') {
    throw new DomainInvariantError('Faculty-private draft text must be a string or null');
  }
  if (privateState.finalDocument !== null) {
    if (!hasExactKeys(privateState.finalDocument, FINAL_DOCUMENT_FIELDS)) {
      throw new DomainInvariantError('Faculty final document must contain exactly its canonical fields');
    }
    for (const field of FINAL_DOCUMENT_FIELDS) {
      if (privateState.finalDocument[field] !== null && typeof privateState.finalDocument[field] !== 'string') {
        throw new DomainInvariantError(`Faculty finalDocument.${field} must be a string or null`);
      }
    }
    if (privateState.finalDocument.releasedToStudentAt !== null) {
      toIso(
        privateState.finalDocument.releasedToStudentAt,
        'faculty projection finalDocument.releasedToStudentAt',
      );
    }
  }

  if (!hasExactKeys(projection.delivery, STUDENT_SAFE_DELIVERY_FIELDS)) {
    throw new DomainInvariantError('Faculty delivery projection must contain exactly its canonical fields');
  }
  assertNonEmptyString(projection.delivery.status, 'faculty projection delivery.status', {
    maxLength: 100,
  });
  for (const field of ['destinationClass', 'deliveredAt']) {
    if (projection.delivery[field] !== null && typeof projection.delivery[field] !== 'string') {
      throw new DomainInvariantError(`Faculty delivery.${field} must be a string or null`);
    }
  }
  if (projection.delivery.deliveredAt !== null) {
    toIso(projection.delivery.deliveredAt, 'faculty projection delivery.deliveredAt');
  }
  return projection;
}

/** Convert a trusted full aggregate to the established faculty transport without extra custody. */
export function toFacultyCaseProjection(record) {
  assertRecommendationCase(record);
  const projection = {
    schemaVersion: FACULTY_CASE_PROJECTION_SCHEMA,
    caseId: record.id,
    revision: record.revision,
    status: record.status,
    studentShared: {
      evidence: structuredClone(record.studentEvidence),
      applicantOptions: structuredClone(record.applicantOptions),
      consentReceipts: structuredClone(record.consentReceipts),
      waiverState: currentWaiverState(record.waiverReceipts),
    },
    facultyPrivate: structuredClone(record.facultyPrivate),
    delivery: structuredClone(record.delivery),
  };
  assertFacultyCaseProjection(projection);
  return deepFreeze(projection);
}

export function assertMentorCaseProjection(projection) {
  if (!hasExactKeys(projection, MENTOR_CASE_PROJECTION_FIELDS)) {
    throw new DomainInvariantError('Mentor case projection must contain exactly five fields');
  }
  assertNonEmptyString(projection.caseId, 'mentor projection caseId', { maxLength: 200 });
  if (!CASE_STATUSES.includes(projection.status)) {
    throw new DomainInvariantError('Mentor projection status must be canonical');
  }
  if (projection.strategyStatus !== null && !STRATEGY_STATUSES.includes(projection.strategyStatus)) {
    throw new DomainInvariantError('Mentor projection strategyStatus must be canonical');
  }
  if (projection.nextMilestone !== null && !STRATEGY_MILESTONES.includes(projection.nextMilestone)) {
    throw new DomainInvariantError('Mentor projection nextMilestone must be canonical');
  }
  if (projection.deliveryStatus !== null && typeof projection.deliveryStatus !== 'string') {
    throw new DomainInvariantError('Mentor projection deliveryStatus must be a string or null');
  }
  return projection;
}

/**
 * facultyPrivate was previously unvalidated: assertRecommendationCase never inspected it, so a
 * caller could structuredClone any shape at all into the aggregate - including a
 * `releasedToStudentAt` of its own choosing, which authorization-policy.js:296 reads as the gate
 * controlling whether a student may see the final letter. These invariants close that: the shape
 * is now fixed, and student visibility is a pure mirror of a release record that only
 * releaseFinalDocument can create.
 *
 * @param {Record<string, any>} record
 */
function assertFinalDocumentInvariants(record) {
  const facultyPrivate = record.facultyPrivate;
  if (!hasExactKeys(facultyPrivate, FACULTY_PRIVATE_FIELDS)) {
    throw new DomainInvariantError('facultyPrivate must hold exactly answers, notes, draftText, and finalDocument');
  }
  if (!Array.isArray(facultyPrivate.answers) || !Array.isArray(facultyPrivate.notes)) {
    throw new DomainInvariantError('Faculty private answers and notes must be arrays');
  }
  if (facultyPrivate.draftText !== null && typeof facultyPrivate.draftText !== 'string') {
    throw new DomainInvariantError('Faculty private draft text must be a string or null');
  }
  const finalDocument = facultyPrivate.finalDocument;
  if (finalDocument !== null) {
    if (!hasExactKeys(finalDocument, FINAL_DOCUMENT_FIELDS)) {
      throw new DomainInvariantError(
        'finalDocument must hold exactly id, text, contentHash, mimeType, and releasedToStudentAt',
      );
    }
    for (const field of FINAL_DOCUMENT_CONTENT_FIELDS) {
      if (finalDocument[field] !== null && typeof finalDocument[field] !== 'string') {
        throw new DomainInvariantError(`finalDocument.${field} must be a string or null`);
      }
    }
  }
  const lifecycle = record.finalDocumentState;
  if (!hasExactKeys(lifecycle, FINAL_DOCUMENT_STATE_FIELDS)) {
    throw new DomainInvariantError(
      'finalDocumentState must hold exactly documentState, facultyApproval, and release',
    );
  }
  if (lifecycle.documentState !== null && !FINAL_DOCUMENT_STATES.includes(lifecycle.documentState)) {
    throw new DomainInvariantError('Final document state must be a canonical wording state');
  }
  const approval = lifecycle.facultyApproval;
  if (approval !== null) {
    if (
      !hasExactKeys(approval, FACULTY_APPROVAL_FIELDS) ||
      typeof approval.approved !== 'boolean' ||
      typeof approval.signatureAttested !== 'boolean' ||
      typeof approval.facultyId !== 'string' ||
      approval.facultyId.length === 0
    ) {
      throw new DomainInvariantError('Faculty approval must record explicit approval, attestation, time, and writer');
    }
    toIso(approval.approvedAt, 'finalDocumentState.facultyApproval.approvedAt');
  }
  const release = lifecycle.release;
  if (release !== null) {
    if (!hasExactKeys(release, FINAL_DOCUMENT_RELEASE_FIELDS)) {
      throw new DomainInvariantError('A final document release must hold exactly its canonical fields');
    }
    toIso(release.releasedAt, 'finalDocumentState.release.releasedAt');
    if (!/^[a-f0-9]{64}$/u.test(release.documentHash ?? '')) {
      throw new DomainInvariantError('A released final document must be bound by a content digest');
    }
    assertNonEmptyString(release.documentId, 'finalDocumentState.release.documentId', { maxLength: 200 });
    assertNonEmptyString(release.waiverReceiptId, 'finalDocumentState.release.waiverReceiptId', { maxLength: 200 });
    if (!Number.isSafeInteger(release.releasedAtRevision) || release.releasedAtRevision < 0) {
      throw new DomainInvariantError('A final document release revision must be a non-negative integer');
    }
  }
  if (finalDocument === null && (lifecycle.documentState !== null || approval !== null || release !== null)) {
    throw new DomainInvariantError('Final document lifecycle state cannot exist without a final document');
  }
  if (release !== null) {
    if (
      lifecycle.documentState !== 'faculty_final' ||
      approval?.approved !== true ||
      approval?.signatureAttested !== true
    ) {
      throw new DomainInvariantError('Only an approved, signature-attested faculty-final document can be released');
    }
    if (
      release.documentId !== finalDocument.id ||
      release.documentHash !== finalDocumentContentHash(finalDocument)
    ) {
      throw new DomainInvariantError('A released final document is immutably bound to the exact released version');
    }
  }
  // The gate authorization-policy.js:296 actually reads. Student visibility is a mirror of the
  // release record and nothing else, so there is no shape of this aggregate in which a student
  // can see a final letter that was never released through releaseFinalDocument.
  const releasedToStudentAt = finalDocument === null ? null : finalDocument.releasedToStudentAt;
  if (releasedToStudentAt !== (release === null ? null : release.releasedAt)) {
    throw new DomainInvariantError('releasedToStudentAt must mirror the recorded final-document release');
  }
}

export function assertRecommendationCase(record) {
  if (!record || record.schemaVersion !== 'missionmed.lor.recommendation-case.v1') {
    throw new DomainInvariantError('Unsupported recommendation case schema');
  }
  assertNonEmptyString(record.id, 'id');
  assertNonEmptyString(record.studentId, 'studentId');
  if (!CASE_STATUSES.includes(record.status)) {
    throw new DomainInvariantError('Invalid recommendation case status');
  }
  if (!Number.isSafeInteger(record.revision) || record.revision < 0) {
    throw new DomainInvariantError('Revision must be a non-negative integer');
  }
  if (!record.builder || record.builder.totalSteps !== 8) {
    throw new DomainInvariantError('Every builder session must have exactly eight steps');
  }
  assertNonEmptyString(record.builder.sessionId, 'builder.sessionId', { maxLength: 200 });
  if (record.builder.sessionId === record.id) {
    throw new DomainInvariantError('Case and protected builder identifiers must be distinct');
  }
  const completed = record.builder.completedStepIds;
  if (!Array.isArray(completed) || completed.some((step, index) => step !== BUILDER_STEPS[index])) {
    throw new DomainInvariantError('Builder steps must be completed once and in canonical order');
  }
  if (record.builder.currentStepId !== (BUILDER_STEPS[completed.length] ?? null)) {
    throw new DomainInvariantError('Builder current step must equal the next canonical step');
  }
  if (
    !record.builder.stepData ||
    typeof record.builder.stepData !== 'object' ||
    Object.keys(record.builder.stepData).some((stepId) => !BUILDER_STEPS.includes(stepId)) ||
    completed.some((stepId) => !(stepId in record.builder.stepData))
  ) {
    throw new DomainInvariantError('Builder step data must use canonical step identifiers');
  }
  if (INVITED_STATUSES.has(record.status) && completed.length !== BUILDER_STEPS.length) {
    throw new DomainInvariantError('Faculty workflow cannot begin before all eight builder steps complete');
  }
  if (
    INVITED_STATUSES.has(record.status) &&
    (!record.faculty?.invitationId || !/^[a-f0-9]{64}$/u.test(record.faculty?.recipientEmailHash ?? ''))
  ) {
    throw new DomainInvariantError('Faculty workflow requires a recipient-bound invitation');
  }
  if (
    VERIFIED_FACULTY_STATUSES.has(record.status) &&
    (!record.faculty?.facultyId || !record.faculty?.verifiedAt)
  ) {
    throw new DomainInvariantError('Faculty workflow requires a verified recipient-bound writer');
  }
  if ((record.status === 'closed') !== (record.closedAt !== null)) {
    throw new DomainInvariantError('closedAt must exist only for closed cases');
  }
  if (!Array.isArray(record.consentReceipts) || !Array.isArray(record.waiverReceipts)) {
    throw new DomainInvariantError('Consent and waiver receipts must be append-only arrays');
  }
  assertFinalDocumentInvariants(record);
  const strategy = record.strategyMetadata ?? {};
  if (
    strategy.mentorIds !== undefined &&
    (!Array.isArray(strategy.mentorIds) ||
      strategy.mentorIds.some((id) => typeof id !== 'string' || id.length === 0))
  ) {
    throw new DomainInvariantError('Strategy mentor assignments must contain identifiers only');
  }
  if (
    strategy.strategyStatus !== undefined &&
    strategy.strategyStatus !== null &&
    !STRATEGY_STATUSES.includes(strategy.strategyStatus)
  ) {
    throw new DomainInvariantError('Strategy status must be a canonical code');
  }
  if (
    strategy.nextMilestone !== undefined &&
    strategy.nextMilestone !== null &&
    !STRATEGY_MILESTONES.includes(strategy.nextMilestone)
  ) {
    throw new DomainInvariantError('Strategy milestone must be a canonical code');
  }
  if (!Array.isArray(record.versionHistory) || record.versionHistory.length !== record.revision + 1) {
    throw new DomainInvariantError('Version history must contain one append-only entry per revision');
  }
  record.versionHistory.forEach((entry, index) => {
    if (entry.revision !== index) {
      throw new DomainInvariantError('Version history revisions must be contiguous');
    }
    const keys = Object.keys(entry).sort();
    const expectedKeys = ['actorId', 'changeHash', 'changedFields', 'eventType', 'occurredAt', 'revision'];
    if (
      JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
      !Array.isArray(entry.changedFields) ||
      entry.changedFields.some((field) => typeof field !== 'string') ||
      !/^[a-f0-9]{64}$/u.test(entry.changeHash)
    ) {
      throw new DomainInvariantError('Version history entries must contain metadata and hashes only');
    }
    toIso(entry.occurredAt, 'versionHistory.occurredAt');
  });
  return record;
}

/**
 * @typedef {{
 *   actorId: string,
 *   eventType: string,
 *   changes: Record<string, unknown>,
 *   now?: Date | string | number,
 * }} RecommendationCaseMutation
 */

function mutateRecommendationCase(record, /** @type {RecommendationCaseMutation} */ {
  actorId,
  eventType,
  changes,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  assertNonEmptyString(actorId, 'actorId');
  assertNonEmptyString(eventType, 'eventType');
  assertPlainObject(changes, 'changes');
  if (TERMINAL_STATUSES.has(record.status)) {
    throw new DomainInvariantError('Terminal recommendation cases are immutable');
  }
  const timestamp = toIso(now, 'now');
  const next = structuredClone(record);
  for (const [field, value] of Object.entries(changes)) next[field] = structuredClone(value);
  next.revision = record.revision + 1;
  next.updatedAt = timestamp;
  next.versionHistory.push(
    versionEntry({
      revision: next.revision,
      eventType,
      actorId,
      occurredAt: timestamp,
      changes,
    }),
  );
  assertRecommendationCase(next);
  return deepFreeze(next);
}

export function autosaveBuilderStep(record, {
  actorId,
  stepId,
  stepData,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (record.status !== 'draft') {
    throw new DomainInvariantError('The student builder is locked after faculty invitation');
  }
  if (!BUILDER_STEPS.includes(stepId)) throw new ValidationError('Unknown builder step');
  const completed = record.builder.completedStepIds;
  const nextIndex = completed.length;
  const stepIndex = BUILDER_STEPS.indexOf(stepId);
  if (stepIndex > nextIndex) {
    throw new DomainInvariantError('Builder steps cannot be skipped');
  }
  const timestamp = toIso(now, 'now');
  const builder = structuredClone(record.builder);
  builder.stepData[stepId] = validateStepData(stepData);
  builder.currentStepId = BUILDER_STEPS[nextIndex] ?? null;
  builder.autosavedAt = timestamp;
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'builder.autosaved',
    changes: { builder },
    now: timestamp,
  });
}

export function completeBuilderStep(record, {
  actorId,
  stepId,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (record.status !== 'draft') {
    throw new DomainInvariantError('The student builder is locked after faculty invitation');
  }
  const expectedStep = BUILDER_STEPS[record.builder.completedStepIds.length];
  if (stepId !== expectedStep) {
    throw new DomainInvariantError('Only the next canonical builder step may be completed');
  }
  if (!(stepId in record.builder.stepData)) {
    throw new DomainInvariantError('A builder step must be autosaved before completion');
  }
  const builder = structuredClone(record.builder);
  builder.completedStepIds.push(stepId);
  builder.currentStepId = BUILDER_STEPS[builder.completedStepIds.length] ?? null;
  builder.autosavedAt = toIso(now, 'now');
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'builder.step_completed',
    changes: { builder },
    now,
  });
}

export function builderProgress(record) {
  assertRecommendationCase(record);
  const completedSteps = record.builder.completedStepIds.length;
  return deepFreeze({
    sessionId: record.builder.sessionId,
    completedSteps,
    totalSteps: BUILDER_STEPS.length,
    percent: Math.round((completedSteps / BUILDER_STEPS.length) * 100),
    nextStepId: BUILDER_STEPS[completedSteps] ?? null,
    autosavedAt: record.builder.autosavedAt,
  });
}

export function bindFacultyInvitation(record, {
  actorId,
  invitationId,
  recipientEmailHash,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (record.status !== 'draft') throw new DomainInvariantError('Faculty may only be invited from draft');
  if (record.builder.completedStepIds.length !== BUILDER_STEPS.length) {
    throw new DomainInvariantError('All eight builder steps must be complete before faculty invitation');
  }
  assertNonEmptyString(invitationId, 'invitationId');
  if (!/^[a-f0-9]{64}$/u.test(recipientEmailHash)) {
    throw new ValidationError('recipientEmailHash must be a SHA-256 digest');
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'faculty.invited',
    changes: {
      status: 'faculty_invited',
      faculty: {
        ...record.faculty,
        invitationId,
        recipientEmailHash,
      },
    },
    now,
  });
}

export function bindVerifiedFaculty(record, {
  actorId,
  invitationId,
  facultyId,
  recipientEmailHash,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (record.status !== 'faculty_invited') {
    throw new DomainInvariantError('Faculty verification requires an invited case');
  }
  if (
    record.faculty.invitationId !== invitationId ||
    record.faculty.recipientEmailHash !== recipientEmailHash
  ) {
    throw new DomainInvariantError('Verified faculty identity must match the recipient-bound invitation');
  }
  assertNonEmptyString(facultyId, 'facultyId');
  const verifiedAt = toIso(now, 'now');
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'faculty.verified',
    changes: {
      status: 'faculty_verified',
      faculty: {
        ...record.faculty,
        facultyId,
        verifiedAt,
      },
    },
    now: verifiedAt,
  });
}

export function transitionRecommendationCase(record, {
  actorId,
  toStatus,
  now = new Date(),
  delivery = undefined,
}) {
  assertRecommendationCase(record);
  if (!CASE_STATUSES.includes(toStatus)) throw new ValidationError('Unknown lifecycle status');
  if (!ALLOWED_TRANSITIONS[record.status].includes(toStatus)) {
    throw new DomainInvariantError(`Invalid lifecycle transition from ${record.status} to ${toStatus}`);
  }
  const changes = { status: toStatus };
  if (toStatus === 'closed') changes.closedAt = toIso(now, 'now');
  if (delivery !== undefined) changes.delivery = structuredClone(delivery);
  return mutateRecommendationCase(record, {
    actorId,
    eventType: `case.${toStatus}`,
    changes,
    now,
  });
}

export function appendReceipt(record, {
  actorId,
  receiptType,
  receipt,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (!['consent', 'waiver'].includes(receiptType)) throw new ValidationError('Unknown receipt type');
  const field = receiptType === 'consent' ? 'consentReceipts' : 'waiverReceipts';
  const existing = record[field];
  const expectedSchema = `missionmed.lor.${receiptType}-receipt.v1`;
  if (
    !receipt ||
    receipt.schemaVersion !== expectedSchema ||
    receipt.caseId !== record.id ||
    receipt.actorId !== record.studentId
  ) {
    throw new DomainInvariantError('Receipt must match its case, student, type, and schema');
  }
  const receiptPayload = Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== 'receiptHash'),
  );
  if (receipt.receiptHash !== hashValue(receiptPayload)) {
    throw new DomainInvariantError('Receipt integrity hash is invalid');
  }
  if (existing.some((item) => item.id === receipt.id)) {
    throw new DomainInvariantError('Receipt IDs are append-only and unique');
  }
  if (receiptType === 'waiver') {
    currentWaiverStateForAppend([...existing, receipt]);
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: `${receiptType}.recorded`,
    changes: { [field]: [...existing, cloneFrozen(receipt)] },
    now,
  });
}

function currentWaiverStateForAppend(receipts) {
  for (const [index, item] of receipts.entries()) {
    if (index === 0 && item.priorReceiptId !== null) {
      throw new DomainInvariantError('First waiver receipt cannot supersede another receipt');
    }
    if (index > 0) {
      const prior = receipts[index - 1];
      if (item.priorReceiptId !== prior.id) {
        throw new DomainInvariantError('Waiver changes must explicitly supersede the current receipt');
      }
      if (new Date(item.recordedAt).valueOf() <= new Date(prior.recordedAt).valueOf()) {
        throw new DomainInvariantError('Waiver changes cannot be retroactively timestamped');
      }
    }
  }
}

/**
 * Faculty authoring. This writes wording, not permission: `releasedToStudentAt` supplied by a
 * caller is stripped here and re-derived from the aggregate's own release record, so the one
 * field authorization-policy.js:296 trusts cannot be forged through the content path.
 *
 * @param {Record<string, any>} record
 * @param {{
 *   actorId: string,
 *   facultyId: string,
 *   answers?: unknown[],
 *   notes?: unknown[],
 *   draftText?: string | null,
 *   finalDocument?: Record<string, unknown> | null,
 *   documentState?: string | null,
 *   facultyApproval?: Record<string, unknown> | null,
 *   now?: Date | string | number,
 * }} input
 */
export function setFacultyPrivateContent(record, {
  actorId,
  facultyId,
  answers = record.facultyPrivate.answers,
  notes = record.facultyPrivate.notes,
  draftText = record.facultyPrivate.draftText,
  finalDocument = record.facultyPrivate.finalDocument,
  documentState,
  facultyApproval,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (!record.faculty.facultyId || record.faculty.facultyId !== facultyId) {
    throw new DomainInvariantError('Only the recipient-bound verified faculty writer may change private content');
  }
  const lifecycle = record.finalDocumentState;
  const nextDocument = normalizeFinalDocumentInput(finalDocument);
  const contentUnchanged =
    finalDocumentContentHash(nextDocument) === finalDocumentContentHash(record.facultyPrivate.finalDocument);
  // An approval attests to exact wording. Rewriting the wording drops the attestation with it
  // unless this same call re-attests; approval is never inherited across a content change.
  const nextState = documentState === undefined
    ? (contentUnchanged ? lifecycle.documentState : null)
    : documentState;
  const nextApproval = facultyApproval === undefined
    ? (contentUnchanged ? lifecycle.facultyApproval : null)
    : normalizeFacultyApprovalInput(facultyApproval);
  if (nextState !== null && !FINAL_DOCUMENT_STATES.includes(nextState)) {
    throw new ValidationError('documentState must be a canonical wording state');
  }
  if (nextDocument === null && (nextState !== null || nextApproval !== null)) {
    throw new ValidationError('Wording state and faculty approval require a final document');
  }
  if (
    lifecycle.release !== null &&
    (!contentUnchanged ||
      nextState !== lifecycle.documentState ||
      hashValue(nextApproval) !== hashValue(lifecycle.facultyApproval))
  ) {
    throw new DomainInvariantError('A released final document and its approval are immutable');
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'faculty.private_content_updated',
    changes: {
      facultyPrivate: structuredClone({
        answers,
        notes,
        draftText,
        finalDocument: nextDocument === null
          ? null
          : { ...nextDocument, releasedToStudentAt: lifecycle.release === null ? null : lifecycle.release.releasedAt },
      }),
      finalDocumentState: structuredClone({
        documentState: nextState,
        facultyApproval: nextApproval,
        release: lifecycle.release,
      }),
    },
    now,
  });
}

/**
 * The only writer of facultyPrivate.finalDocument.releasedToStudentAt, and therefore the only way
 * a student can ever be granted sight of the final letter (authorization-policy.js:296).
 *
 * Every gate a release depends on is enforced here rather than at a caller: the case identity,
 * the aggregate version the caller reasoned about, the recipient-bound writer, the student's
 * current waiver decision, and the document's own exportable state - `faculty_final`, approved,
 * signature attested - which is exactly the shape documents/recommendation-artifacts.mjs:29-32
 * demands before it will render a release artifact.
 *
 * Re-releasing the same document is idempotent: it returns the record untouched rather than
 * minting a second revision, a second version entry, and a second release timestamp.
 *
 * @param {Record<string, any>} record
 * @param {{
 *   actorId: string,
 *   facultyId: string,
 *   caseId: string,
 *   documentId: string,
 *   expectedRevision: number,
 *   now?: Date | string | number,
 * }} input
 */
export function releaseFinalDocument(record, {
  actorId,
  facultyId,
  caseId,
  documentId,
  expectedRevision,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
  assertNonEmptyString(documentId, 'documentId', { maxLength: 200 });
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new ValidationError('expectedRevision must be a non-negative integer');
  }
  if (caseId !== record.id) {
    throw new DomainInvariantError('A final document can only be released against its own case');
  }
  if (!record.faculty.facultyId || record.faculty.facultyId !== facultyId) {
    throw new DomainInvariantError('Only the recipient-bound verified faculty writer may release the final document');
  }
  const lifecycle = record.finalDocumentState;
  const finalDocument = record.facultyPrivate.finalDocument;
  // Idempotent replay is decided before the revision check, because a caller replaying a release
  // necessarily still holds the pre-release revision. A replay that names a different document is
  // not a replay - it is an attempt to re-scope what was released - and is refused.
  if (lifecycle.release !== null) {
    if (
      lifecycle.release.documentId !== documentId ||
      lifecycle.release.documentHash !== finalDocumentContentHash(finalDocument)
    ) {
      throw new DomainInvariantError('A released final document cannot be re-scoped to a different version');
    }
    return record;
  }
  if (expectedRevision !== record.revision) {
    throw new StaleRevisionError({
      caseId: record.id,
      expectedRevision,
      actualRevision: record.revision,
    });
  }
  if (finalDocument === null) {
    throw new DomainInvariantError('There is no final document to release');
  }
  if (finalDocument.id !== documentId) {
    throw new DomainInvariantError('A release must name the exact current final document');
  }
  if (lifecycle.documentState !== 'faculty_final') {
    throw new DomainInvariantError('Only faculty-final wording may be released to the student');
  }
  if (lifecycle.facultyApproval?.approved !== true || lifecycle.facultyApproval?.signatureAttested !== true) {
    throw new DomainInvariantError('Faculty approval and signature attestation are required before release');
  }
  if (typeof finalDocument.text !== 'string' || finalDocument.text.trim() === '') {
    throw new DomainInvariantError('An empty final document cannot be released');
  }
  const waiver = currentWaiverState(record.waiverReceipts);
  if (waiver.decided !== true) {
    throw new DomainInvariantError('A final document cannot be released before the student records a waiver decision');
  }
  if (waiver.waived !== false) {
    throw new DomainInvariantError('A waived final document can never be released to the student');
  }
  const releasedAt = toIso(now, 'now');
  const latestWaiverRecordedAt = record.waiverReceipts.at(-1).recordedAt;
  if (new Date(releasedAt).valueOf() < new Date(latestWaiverRecordedAt).valueOf()) {
    throw new DomainInvariantError('A release cannot predate the waiver decision it relies on');
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'faculty.final_document_released',
    changes: {
      facultyPrivate: structuredClone({
        ...record.facultyPrivate,
        finalDocument: { ...finalDocumentContent(finalDocument), releasedToStudentAt: releasedAt },
      }),
      finalDocumentState: structuredClone({
        documentState: lifecycle.documentState,
        facultyApproval: lifecycle.facultyApproval,
        release: {
          documentHash: finalDocumentContentHash(finalDocument),
          documentId,
          releasedAt,
          releasedAtRevision: record.revision + 1,
          waiverReceiptId: waiver.receiptId,
        },
      }),
    },
    now: releasedAt,
  });
}

export function setStudentPreparedMaterial(record, {
  actorId,
  studentEvidence,
  applicantOptions,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (record.status !== 'draft') {
    throw new DomainInvariantError('Student-prepared material is locked after faculty invitation');
  }
  if (!Array.isArray(studentEvidence) || !Array.isArray(applicantOptions)) {
    throw new ValidationError('Student evidence and applicant options must be arrays');
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'student.material_updated',
    changes: {
      studentEvidence: structuredClone(studentEvidence),
      applicantOptions: structuredClone(applicantOptions),
    },
    now,
  });
}

export function setStrategyMetadata(record, {
  actorId,
  mentorIds = [],
  strategyStatus = null,
  nextMilestone = null,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (!Array.isArray(mentorIds) || mentorIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new ValidationError('mentorIds must contain identifiers');
  }
  if (strategyStatus !== null && !STRATEGY_STATUSES.includes(strategyStatus)) {
    throw new ValidationError('strategyStatus must be a canonical status code');
  }
  if (nextMilestone !== null && !STRATEGY_MILESTONES.includes(nextMilestone)) {
    throw new ValidationError('nextMilestone must be a canonical milestone code');
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'strategy.metadata_updated',
    changes: {
      strategyMetadata: {
        mentorIds: [...new Set(mentorIds)],
        strategyStatus,
        nextMilestone,
      },
    },
    now,
  });
}
