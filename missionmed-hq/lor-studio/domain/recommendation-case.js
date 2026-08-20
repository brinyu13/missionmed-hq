import { DomainInvariantError, StaleRevisionError, ValidationError } from './errors.js';
import { currentWaiverState } from './receipts.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  cloneFrozen,
  deepFreeze,
  hashValue,
  makeId,
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

export function createRecommendationCase({
  id,
  studentId,
  actorId = studentId,
  now = new Date(),
  builderSessionId,
  idFactory,
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
