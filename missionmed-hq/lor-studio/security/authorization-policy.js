import { AuthorizationDeniedError, ValidationError } from '../domain/errors.js';
import { builderProgress } from '../domain/recommendation-case.js';
import { currentWaiverState } from '../domain/receipts.js';
import { assertNonEmptyString, cloneFrozen, deepFreeze } from '../domain/value-utils.js';

export const ACTOR_ROLES = deepFreeze([
  'student',
  'faculty',
  'mentor',
  'admin',
  'founder',
  'support',
  'service',
]);

export const CASE_ACTIONS = deepFreeze([
  'read_student_projection',
  'write_builder',
  'record_receipt',
  'invite_faculty',
  'read_faculty_projection',
  'write_faculty_private',
  'approve_letter',
  'release_letter',
  'read_mentor_projection',
  'read_operational_metadata',
  'service_operation',
]);

const STUDENT_ACTIONS = new Set([
  'read_student_projection',
  'write_builder',
  'record_receipt',
  'invite_faculty',
]);
const FACULTY_ACTIONS = new Set([
  'read_faculty_projection',
  'write_faculty_private',
  'approve_letter',
  'release_letter',
]);
const OPERATIONAL_ROLES = new Set(['admin', 'founder', 'support']);

export function evaluateStudentEntitlement(record, {
  studentId,
  requireCanary = false,
} = {}) {
  if (!record || typeof record !== 'object') {
    return deepFreeze({ allowed: false, reasonCode: 'ENTITLEMENT_MISSING' });
  }
  if (record.producerStatus === 'MUST_VERIFY') {
    return deepFreeze({ allowed: false, reasonCode: 'ENTITLEMENT_PRODUCER_MUST_VERIFY' });
  }
  if (record.studentId !== studentId) {
    return deepFreeze({ allowed: false, reasonCode: 'ENTITLEMENT_SUBJECT_MISMATCH' });
  }
  if (record.revoked === true) {
    return deepFreeze({ allowed: false, reasonCode: 'ENTITLEMENT_REVOKED' });
  }
  if (record.active !== true) {
    return deepFreeze({ allowed: false, reasonCode: 'ENTITLEMENT_INACTIVE' });
  }
  if (record.tier !== 'tier3_360') {
    return deepFreeze({ allowed: false, reasonCode: 'ENTITLEMENT_INELIGIBLE_TIER' });
  }
  if (record.lorEnabled !== true) {
    return deepFreeze({ allowed: false, reasonCode: 'LOR_NOT_EXPLICITLY_ENABLED' });
  }
  if (requireCanary && record.canaryEnabled !== true) {
    return deepFreeze({ allowed: false, reasonCode: 'CANARY_NOT_ENABLED' });
  }
  if (requireCanary && record.canaryConsented !== true) {
    return deepFreeze({ allowed: false, reasonCode: 'CANARY_CONSENT_MISSING' });
  }
  return deepFreeze({ allowed: true, reasonCode: null });
}

function assertActor(actor) {
  if (!actor || typeof actor !== 'object') throw new AuthorizationDeniedError('ACTOR_MISSING');
  assertNonEmptyString(actor.id, 'actor.id');
  if (!ACTOR_ROLES.includes(actor.role)) throw new AuthorizationDeniedError('ROLE_UNRECOGNIZED');
}

function requireEligibleCase(entitlement, caseRecord, requireCanary) {
  const decision = evaluateStudentEntitlement(entitlement, {
    studentId: caseRecord.studentId,
    requireCanary,
  });
  if (!decision.allowed) throw new AuthorizationDeniedError(decision.reasonCode);
}

function requireServiceGrant({ actor, action, caseRecord, serviceGrant, now }) {
  if (
    !serviceGrant ||
    serviceGrant.serviceId !== actor.id ||
    serviceGrant.caseId !== caseRecord.id ||
    !Array.isArray(serviceGrant.allowedActions) ||
    !serviceGrant.allowedActions.includes(action) ||
    typeof serviceGrant.purpose !== 'string' ||
    serviceGrant.purpose.trim() === '' ||
    !serviceGrant.expiresAt ||
    new Date(now).valueOf() >= new Date(serviceGrant.expiresAt).valueOf()
  ) {
    throw new AuthorizationDeniedError('SERVICE_GRANT_INVALID');
  }
}

export function authorizeCaseAction({
  actor,
  action,
  caseRecord,
  entitlement,
  serviceGrant = null,
  requireCanary = false,
  now = new Date(),
}) {
  assertActor(actor);
  if (!CASE_ACTIONS.includes(action)) throw new AuthorizationDeniedError('ACTION_UNRECOGNIZED');
  if (!caseRecord || typeof caseRecord.id !== 'string' || typeof caseRecord.studentId !== 'string') {
    throw new AuthorizationDeniedError('RESOURCE_INVALID');
  }

  if (actor.role === 'student') {
    if (actor.id !== caseRecord.studentId) throw new AuthorizationDeniedError('CASE_OWNERSHIP_MISMATCH');
    requireEligibleCase(entitlement, caseRecord, requireCanary);
    if (!STUDENT_ACTIONS.has(action)) throw new AuthorizationDeniedError('ROLE_ACTION_DENIED');
  } else if (actor.role === 'faculty') {
    requireEligibleCase(entitlement, caseRecord, requireCanary);
    if (
      caseRecord.faculty?.facultyId !== actor.id ||
      !caseRecord.faculty?.verifiedAt ||
      !caseRecord.faculty?.recipientEmailHash
    ) {
      throw new AuthorizationDeniedError('FACULTY_RECIPIENT_BINDING_MISMATCH');
    }
    if (!FACULTY_ACTIONS.has(action)) throw new AuthorizationDeniedError('ROLE_ACTION_DENIED');
  } else if (actor.role === 'mentor') {
    requireEligibleCase(entitlement, caseRecord, requireCanary);
    const mentorIds = caseRecord.strategyMetadata?.mentorIds;
    if (!Array.isArray(mentorIds) || !mentorIds.includes(actor.id)) {
      throw new AuthorizationDeniedError('MENTOR_ASSIGNMENT_MISMATCH');
    }
    if (action !== 'read_mentor_projection') throw new AuthorizationDeniedError('ROLE_ACTION_DENIED');
  } else if (OPERATIONAL_ROLES.has(actor.role)) {
    if (action !== 'read_operational_metadata') {
      throw new AuthorizationDeniedError('ROUTINE_OPERATIONAL_ROLE_CONTENT_DENIED');
    }
  } else if (actor.role === 'service') {
    requireEligibleCase(entitlement, caseRecord, requireCanary);
    if (action !== 'service_operation') throw new AuthorizationDeniedError('ROLE_ACTION_DENIED');
    requireServiceGrant({ actor, action, caseRecord, serviceGrant, now });
  }
  return deepFreeze({ allowed: true, actorId: actor.id, action, caseId: caseRecord.id });
}

function operationalProjection(caseRecord) {
  return deepFreeze({
    schemaVersion: 'missionmed.lor.operational-projection.v1',
    caseId: caseRecord.id,
    status: caseRecord.status,
    revision: caseRecord.revision,
    createdAt: caseRecord.createdAt,
    updatedAt: caseRecord.updatedAt,
    closedAt: caseRecord.closedAt,
    builderProgress: builderProgress(caseRecord),
    deliveryStatus: caseRecord.delivery?.status ?? 'unknown',
  });
}

function permittedDeliveryProjection(caseRecord) {
  return deepFreeze({
    status: caseRecord.delivery?.status ?? 'unknown',
    destinationClass: caseRecord.delivery?.destinationClass ?? null,
    deliveredAt: caseRecord.delivery?.deliveredAt ?? null,
  });
}

function releasedFinalDocumentProjection(finalDocument) {
  if (!finalDocument) return null;
  return deepFreeze({
    id: finalDocument.id ?? null,
    text: finalDocument.text ?? null,
    contentHash: finalDocument.contentHash ?? null,
    mimeType: finalDocument.mimeType ?? null,
    releasedToStudentAt: finalDocument.releasedToStudentAt,
  });
}

export function projectCaseForActor({
  actor,
  caseRecord,
  entitlement,
  serviceGrant = null,
  requireCanary = false,
  now = new Date(),
}) {
  assertActor(actor);
  if (actor.role === 'student') {
    authorizeCaseAction({
      actor,
      action: 'read_student_projection',
      caseRecord,
      entitlement,
      requireCanary,
      now,
    });
    const waiver = currentWaiverState(caseRecord.waiverReceipts);
    const finalDocument =
      waiver.decided &&
      waiver.waived === false &&
      caseRecord.facultyPrivate?.finalDocument?.releasedToStudentAt
        ? releasedFinalDocumentProjection(caseRecord.facultyPrivate.finalDocument)
        : null;
    return deepFreeze({
      schemaVersion: 'missionmed.lor.student-projection.v1',
      caseId: caseRecord.id,
      revision: caseRecord.revision,
      status: caseRecord.status,
      builder: cloneFrozen(caseRecord.builder),
      studentEvidence: cloneFrozen(caseRecord.studentEvidence),
      applicantOptions: cloneFrozen(caseRecord.applicantOptions),
      consentReceipts: cloneFrozen(caseRecord.consentReceipts),
      waiverReceipts: cloneFrozen(caseRecord.waiverReceipts),
      delivery: permittedDeliveryProjection(caseRecord),
      finalDocument,
    });
  }

  if (actor.role === 'faculty') {
    authorizeCaseAction({
      actor,
      action: 'read_faculty_projection',
      caseRecord,
      entitlement,
      requireCanary,
      now,
    });
    return deepFreeze({
      schemaVersion: 'missionmed.lor.faculty-projection.v1',
      caseId: caseRecord.id,
      revision: caseRecord.revision,
      status: caseRecord.status,
      studentShared: {
        evidence: cloneFrozen(caseRecord.studentEvidence),
        applicantOptions: cloneFrozen(caseRecord.applicantOptions),
        consentReceipts: cloneFrozen(caseRecord.consentReceipts),
        waiverState: currentWaiverState(caseRecord.waiverReceipts),
      },
      facultyPrivate: cloneFrozen(caseRecord.facultyPrivate),
      delivery: permittedDeliveryProjection(caseRecord),
    });
  }

  if (actor.role === 'mentor') {
    authorizeCaseAction({
      actor,
      action: 'read_mentor_projection',
      caseRecord,
      entitlement,
      requireCanary,
      now,
    });
    return deepFreeze({
      schemaVersion: 'missionmed.lor.mentor-projection.v1',
      caseId: caseRecord.id,
      status: caseRecord.status,
      strategyStatus: caseRecord.strategyMetadata?.strategyStatus ?? null,
      nextMilestone: caseRecord.strategyMetadata?.nextMilestone ?? null,
      deliveryStatus: caseRecord.delivery?.status ?? null,
    });
  }

  if (OPERATIONAL_ROLES.has(actor.role)) {
    authorizeCaseAction({
      actor,
      action: 'read_operational_metadata',
      caseRecord,
      entitlement,
      requireCanary,
      now,
    });
    return operationalProjection(caseRecord);
  }

  if (actor.role === 'service') {
    authorizeCaseAction({
      actor,
      action: 'service_operation',
      caseRecord,
      entitlement,
      serviceGrant,
      requireCanary,
      now,
    });
    return deepFreeze({
      schemaVersion: 'missionmed.lor.service-projection.v1',
      caseId: caseRecord.id,
      status: caseRecord.status,
      revision: caseRecord.revision,
      grantedPurpose: serviceGrant.purpose,
    });
  }
  throw new AuthorizationDeniedError('ROLE_UNRECOGNIZED');
}

export function assertProjectionOmitsFacultyPrivateContent(projection) {
  const serialized = JSON.stringify(projection);
  for (const forbidden of ['facultyPrivate', 'draftText', 'answers', 'notes']) {
    if (serialized.includes(`"${forbidden}"`)) {
      throw new ValidationError('Projection contains faculty-private structure', { forbidden });
    }
  }
  return true;
}
