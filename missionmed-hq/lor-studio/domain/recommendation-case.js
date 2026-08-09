import { DomainInvariantError, ValidationError } from './errors.js';
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
  idFactory,
}) {
  assertNonEmptyString(id, 'id', { maxLength: 200 });
  assertNonEmptyString(studentId, 'studentId', { maxLength: 200 });
  assertNonEmptyString(actorId, 'actorId', { maxLength: 200 });
  const timestamp = toIso(now, 'now');
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
      sessionId: makeId('builder', idFactory),
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

function mutateRecommendationCase(record, {
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

export function setFacultyPrivateContent(record, {
  actorId,
  facultyId,
  answers = record.facultyPrivate.answers,
  notes = record.facultyPrivate.notes,
  draftText = record.facultyPrivate.draftText,
  finalDocument = record.facultyPrivate.finalDocument,
  now = new Date(),
}) {
  assertRecommendationCase(record);
  if (!record.faculty.facultyId || record.faculty.facultyId !== facultyId) {
    throw new DomainInvariantError('Only the recipient-bound verified faculty writer may change private content');
  }
  return mutateRecommendationCase(record, {
    actorId,
    eventType: 'faculty.private_content_updated',
    changes: {
      facultyPrivate: structuredClone({ answers, notes, draftText, finalDocument }),
    },
    now,
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
