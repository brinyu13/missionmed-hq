import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DisabledAiProposalAdapter,
  DisabledEmailAdapter,
  DisabledEntitlementAdapter,
  DisabledOtpAdapter,
  DisabledPrivateStorageAdapter,
  DisabledStoryForgeAdapter,
  DisabledTimelineAdapter,
} from '../../lor-studio/adapters/disabled-adapters.js';
import { StaticOtpTestAdapter } from '../../lor-studio/adapters/test-adapters.js';
import {
  AuthorizationDeniedError,
  IntegrationDisabledError,
  InvitationDeniedError,
  ValidationError,
} from '../../lor-studio/domain/errors.js';
import {
  BUILDER_STEPS,
  appendReceipt,
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  completeBuilderStep,
  createRecommendationCase,
  setFacultyPrivateContent,
  setStrategyMetadata,
  setStudentPreparedMaterial,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { createWaiverReceipt } from '../../lor-studio/domain/receipts.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { createAuditEvent } from '../../lor-studio/audit/audit-events.mjs';
import { InMemoryFacultyInvitationRepository } from '../../lor-studio/repositories/in-memory-faculty-invitation-repository.js';
import {
  ADMINISTRATIVE_GRANT_CONTRACT,
  createAdministrativeGrant,
  createAdministrativeGrantActivation,
} from '../../lor-studio/repositories/immutable-administrative-grant-repository.mjs';
import {
  CASE_ACTIONS,
  assertProjectionOmitsFacultyPrivateContent,
  authorizeCaseAction,
  evaluateStudentEntitlement,
  privilegedAccessAuditInput,
  projectCaseForActor,
} from '../../lor-studio/security/authorization-policy.js';
import {
  FacultyInvitationVerificationService,
  createFacultyInvitation,
  evaluateFacultyInvitationAttempt,
  hashFacultyEmail,
  revokeFacultyInvitation,
} from '../../lor-studio/security/faculty-invitations.js';

const T0 = new Date('2026-08-09T12:00:00.000Z');

function eligible(studentId = 'student-1', overrides = {}) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    producerStatus: 'VERIFIED_TEST_FIXTURE',
    ...overrides,
  };
}

function verifiedOtpProof(invitation, principalId = 'faculty-1', overrides = {}) {
  const verifiedAt = '2026-08-09T12:00:30.000Z';
  return {
    schemaVersion: 'missionmed.lor.otp-proof.v1',
    verified: true,
    principalId,
    invitationId: invitation.id,
    recipientEmailHash: invitation.recipientEmailHash,
    proofId: sha256(`${invitation.id}:${invitation.recipientEmailHash}:${principalId}:${verifiedAt}`),
    verifiedAt,
    status: 'TEST_ONLY',
    ...overrides,
  };
}

const OPERATIONAL_PROJECTION_KEYS = [
  'schemaVersion',
  'caseId',
  'status',
  'revision',
  'createdAt',
  'updatedAt',
  'closedAt',
  'builderProgress',
  'deliveryStatus',
];

/**
 * Mints the case-scoped operational-metadata capability DR-119 clause 9 requires: the
 * canonical immutable grant plus proof its revocation ledger entry was just read.
 */
function operationalGrantFor({
  granteeId = 'admin-1',
  caseId = 'case-private',
  operation = 'read_operational_case_metadata',
  purpose = 'dr-119-operational-metadata-review',
  issuedAt = '2026-08-09T11:00:00.000Z',
  expiresAt = '2026-08-09T13:00:00.000Z',
  checkedAt = T0,
} = {}) {
  const grant = createAdministrativeGrant({
    grantId: `grant:${granteeId}:${caseId}:${operation}`,
    granteeId,
    caseId,
    operation,
    purpose,
    privacyAuthority: 'privacy-authority:founder-approved-operational-review',
    issuedAt,
    expiresAt,
    auditEventRef: sha256(`operational-grant:${granteeId}:${caseId}:${operation}`),
  });
  return {
    grant,
    activation: createAdministrativeGrantActivation({ grant, revoked: false, checkedAt }),
  };
}

function deniedWith(reasonCode) {
  return (error) => error instanceof AuthorizationDeniedError
    && error.code === 'AUTHORIZATION_DENIED'
    && error.details.reasonCode === reasonCode;
}

function buildPrivateCase({ waived = true, id = 'case-private' } = {}) {
  let sequence = 0;
  const idFactory = () => `fixture-${++sequence}`;
  let record = createRecommendationCase({
    id,
    studentId: 'student-1',
    now: T0,
    idFactory,
  });
  record = setStudentPreparedMaterial(record, {
    actorId: 'student-1',
    studentEvidence: [{ id: 'ev-1', summary: 'Student-authorized summary' }],
    applicantOptions: [{ id: 'option-1', value: 'Student-authored option' }],
    now: T0,
  });
  record = setStrategyMetadata(record, {
    actorId: 'admin-1',
    mentorIds: ['mentor-1'],
    strategyStatus: 'writer_selected',
    nextMilestone: 'faculty_review',
    now: T0,
  });
  const waiver = createWaiverReceipt({
    caseId: record.id,
    studentId: record.studentId,
    waived,
    policyVersion: 'dr-019-v1',
    acknowledgment: waived ? 'I waive access.' : 'I retain access if faculty releases the final.',
    recordedAt: T0,
    idFactory,
  });
  record = appendReceipt(record, {
    actorId: record.studentId,
    receiptType: 'waiver',
    receipt: waiver,
    now: T0,
  });
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    record = autosaveBuilderStep(record, {
      actorId: record.studentId,
      stepId,
      stepData: { complete: true, index },
      now: T0,
    });
    record = completeBuilderStep(record, {
      actorId: record.studentId,
      stepId,
      now: T0,
    });
  }
  const recipientEmailHash = hashFacultyEmail('writer@example.test');
  record = bindFacultyInvitation(record, {
    actorId: record.studentId,
    invitationId: 'invite-private',
    recipientEmailHash,
    now: T0,
  });
  record = bindVerifiedFaculty(record, {
    actorId: 'faculty-1',
    invitationId: 'invite-private',
    facultyId: 'faculty-1',
    recipientEmailHash,
    now: T0,
  });
  record = transitionRecommendationCase(record, {
    actorId: 'faculty-1',
    toStatus: 'faculty_review',
    now: T0,
  });
  record = setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    answers: [{ id: 'answer-1', text: 'FACULTY SECRET ANSWER' }],
    notes: [{ id: 'note-1', text: 'FACULTY PRIVATE NOTE' }],
    draftText: 'FACULTY PRIVATE DRAFT',
    finalDocument: {
      id: 'document-1',
      text: 'FACULTY FINAL LETTER',
      releasedToStudentAt: waived ? '2026-08-09T13:00:00.000Z' : null,
    },
    now: T0,
  });
  return record;
}

test('entitlement policy denies missing, ineligible, revoked, disabled, and non-canary subjects', async () => {
  assert.deepEqual(evaluateStudentEntitlement(null, { studentId: 'student-1' }), {
    allowed: false,
    reasonCode: 'ENTITLEMENT_MISSING',
  });
  assert.equal(
    evaluateStudentEntitlement(eligible('student-1', { active: false }), { studentId: 'student-1' }).reasonCode,
    'ENTITLEMENT_INACTIVE',
  );
  assert.equal(
    evaluateStudentEntitlement(eligible('student-1', { tier: 'tier2' }), { studentId: 'student-1' }).reasonCode,
    'ENTITLEMENT_INELIGIBLE_TIER',
  );
  assert.equal(
    evaluateStudentEntitlement(eligible('student-1', { lorEnabled: false }), { studentId: 'student-1' }).reasonCode,
    'LOR_NOT_EXPLICITLY_ENABLED',
  );
  assert.equal(
    evaluateStudentEntitlement(eligible('student-1', { revoked: true }), { studentId: 'student-1' }).reasonCode,
    'ENTITLEMENT_REVOKED',
  );
  assert.equal(
    evaluateStudentEntitlement(eligible('student-1', { canaryEnabled: false }), {
      studentId: 'student-1',
      requireCanary: true,
    }).reasonCode,
    'CANARY_NOT_ENABLED',
  );
  assert.equal(
    evaluateStudentEntitlement(eligible('student-1', { canaryConsented: false }), {
      studentId: 'student-1',
      requireCanary: true,
    }).reasonCode,
    'CANARY_CONSENT_MISSING',
  );
  const disabled = await new DisabledEntitlementAdapter().getStudentEntitlement({ studentId: 'student-1' });
  assert.equal(disabled.producerStatus, 'MUST_VERIFY');
  assert.equal(
    evaluateStudentEntitlement(disabled, { studentId: 'student-1' }).reasonCode,
    'ENTITLEMENT_PRODUCER_MUST_VERIFY',
  );
  assert.equal(evaluateStudentEntitlement(eligible(), { studentId: 'student-1' }).allowed, true);
});

test('authorization is resource-bound and structural projections enforce the waived/private negative matrix', () => {
  const record = buildPrivateCase({ waived: true });
  const entitlement = eligible(record.studentId);
  const student = { id: record.studentId, role: 'student' };

  const studentProjection = projectCaseForActor({ actor: student, caseRecord: record, entitlement });
  assert.equal(studentProjection.revision, record.revision);
  assert.equal(studentProjection.finalDocument, null, 'waived final must remain denied despite a release flag');
  assertProjectionOmitsFacultyPrivateContent(studentProjection);
  const studentJson = JSON.stringify(studentProjection);
  for (const secret of ['FACULTY SECRET ANSWER', 'FACULTY PRIVATE NOTE', 'FACULTY PRIVATE DRAFT', 'FACULTY FINAL LETTER']) {
    assert.equal(studentJson.includes(secret), false);
  }

  assert.throws(
    () => projectCaseForActor({
      actor: { id: 'student-2', role: 'student' },
      caseRecord: record,
      entitlement: eligible('student-2'),
    }),
    AuthorizationDeniedError,
  );
  assert.throws(
    () => projectCaseForActor({
      actor: { id: 'faculty-2', role: 'faculty' },
      caseRecord: record,
      entitlement,
    }),
    AuthorizationDeniedError,
  );

  const facultyProjection = projectCaseForActor({
    actor: { id: 'faculty-1', role: 'faculty' },
    caseRecord: record,
    entitlement,
  });
  assert.equal(facultyProjection.revision, record.revision);
  assert.equal(facultyProjection.facultyPrivate.draftText, 'FACULTY PRIVATE DRAFT');

  const mentorProjection = projectCaseForActor({
    actor: { id: 'mentor-1', role: 'mentor' },
    caseRecord: record,
    entitlement,
  });
  assert.deepEqual(mentorProjection, {
    schemaVersion: 'missionmed.lor.mentor-projection.v1',
    caseId: record.id,
    status: record.status,
    strategyStatus: 'writer_selected',
    nextMilestone: 'faculty_review',
    deliveryStatus: 'not_started',
  });

  // Operational roles are resource-bound exactly like every other role: membership alone
  // opens nothing. The granted path is exercised in the DR-119 clause 9 tests below.
  for (const role of ['admin', 'founder', 'support']) {
    assert.throws(
      () => projectCaseForActor({
        actor: { id: `${role}-1`, role },
        caseRecord: record,
        entitlement: null,
      }),
      deniedWith('OPERATIONAL_METADATA_GRANT_REQUIRED'),
      `${role} membership alone must not bind to a case`,
    );
  }

  const serviceGrant = {
    serviceId: 'service-1',
    caseId: record.id,
    allowedActions: ['service_operation'],
    purpose: 'render_private_document',
    expiresAt: '2026-08-10T12:00:00.000Z',
  };
  const serviceProjection = projectCaseForActor({
    actor: { id: 'service-1', role: 'service' },
    caseRecord: record,
    entitlement,
    serviceGrant,
    now: T0,
  });
  assert.equal(serviceProjection.grantedPurpose, 'render_private_document');
  assert.equal(JSON.stringify(serviceProjection).includes('FACULTY'), false);
  assert.throws(
    () => authorizeCaseAction({
      actor: { id: 'service-2', role: 'service' },
      action: 'service_operation',
      caseRecord: record,
      entitlement,
      serviceGrant,
      now: T0,
    }),
    AuthorizationDeniedError,
  );
});

test('operational roles are denied every content action and reach metadata only through a case-scoped grant', () => {
  const record = buildPrivateCase({ waived: false });
  const entitlement = eligible(record.studentId);
  const contentActions = CASE_ACTIONS.filter((action) => action !== 'read_operational_metadata');

  for (const role of ['admin', 'founder', 'support']) {
    const actor = { id: `${role}-1`, role };
    for (const action of contentActions) {
      assert.throws(
        () => authorizeCaseAction({ actor, action, caseRecord: record, entitlement, now: T0 }),
        deniedWith('ROUTINE_OPERATIONAL_ROLE_CONTENT_DENIED'),
        `${role} must not reach ${action}`,
      );
    }

    // DR-119 clause 9. Role membership is not case authorisation: without a grant an
    // operational actor cannot enumerate this case's metadata, and the denial is the same
    // AuthorizationDeniedError the HTTP layer already collapses to an undifferentiated 404.
    assert.throws(
      () => authorizeCaseAction({
        actor,
        action: 'read_operational_metadata',
        caseRecord: record,
        entitlement,
        now: T0,
      }),
      deniedWith('OPERATIONAL_METADATA_GRANT_REQUIRED'),
      `${role} must not authorise a grant-free metadata read`,
    );
    assert.throws(
      () => projectCaseForActor({ actor, caseRecord: record, entitlement, now: T0 }),
      deniedWith('OPERATIONAL_METADATA_GRANT_REQUIRED'),
      `${role} must not project a grant-free case`,
    );

    // Properly granted access is allowed - and still yields metadata only.
    const operationalGrant = operationalGrantFor({ granteeId: actor.id, caseId: record.id });
    const projection = projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement,
      operationalGrant,
      now: T0,
    });
    assert.deepEqual(
      Object.keys(projection),
      OPERATIONAL_PROJECTION_KEYS,
      `${role} must receive the operational metadata projection shape only`,
    );
    assertProjectionOmitsFacultyPrivateContent(projection);
    const serialized = JSON.stringify(projection);
    for (const protectedValue of [
      record.studentId,
      'Student-authorized summary',
      'Student-authored option',
      'FACULTY SECRET ANSWER',
      'FACULTY PRIVATE NOTE',
      'FACULTY PRIVATE DRAFT',
      'FACULTY FINAL LETTER',
    ]) {
      assert.equal(serialized.includes(protectedValue), false, `${role} metadata must omit ${protectedValue}`);
    }

    // A grant does not widen the action set either: content stays denied while one is held.
    for (const action of contentActions) {
      assert.throws(
        () => authorizeCaseAction({
          actor,
          action,
          caseRecord: record,
          entitlement,
          operationalGrant,
          now: T0,
        }),
        deniedWith('ROUTINE_OPERATIONAL_ROLE_CONTENT_DENIED'),
        `${role} must not reach ${action} while holding a metadata grant`,
      );
    }
  }
});

test('an operational metadata grant is case-, actor-, class-, and time-scoped and fails closed', () => {
  const caseAlpha = buildPrivateCase({ waived: false, id: 'case-alpha' });
  const caseBeta = buildPrivateCase({ waived: false, id: 'case-beta' });
  const actor = { id: 'admin-1', role: 'admin' };
  const grantForAlpha = operationalGrantFor({ granteeId: 'admin-1', caseId: 'case-alpha' });

  const allowed = projectCaseForActor({
    actor,
    caseRecord: caseAlpha,
    entitlement: null,
    operationalGrant: grantForAlpha,
    now: T0,
  });
  assert.equal(allowed.caseId, 'case-alpha');

  // The whole point of clause 9: a grant for one case does not open another.
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseBeta,
      entitlement: null,
      operationalGrant: grantForAlpha,
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_BINDING_MISMATCH'),
    'a grant for case-alpha must not open case-beta',
  );

  // Nor may a different operational actor borrow someone else's grant.
  assert.throws(
    () => projectCaseForActor({
      actor: { id: 'support-9', role: 'support' },
      caseRecord: caseAlpha,
      entitlement: null,
      operationalGrant: grantForAlpha,
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_BINDING_MISMATCH'),
  );

  // A content grant is a different capability class and must not be read as a metadata grant.
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseAlpha,
      entitlement: null,
      operationalGrant: operationalGrantFor({
        granteeId: 'admin-1',
        caseId: 'case-alpha',
        operation: 'read_case_content_for_privacy_request',
      }),
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_OPERATION_CLASS_MISMATCH'),
  );

  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseAlpha,
      entitlement: null,
      operationalGrant: operationalGrantFor({
        granteeId: 'admin-1',
        caseId: 'case-alpha',
        issuedAt: '2026-08-09T09:00:00.000Z',
        expiresAt: '2026-08-09T10:00:00.000Z',
        checkedAt: '2026-08-09T09:30:00.000Z',
      }),
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_EXPIRED_OR_NOT_YET_VALID'),
  );

  // A revocation check goes stale: an old activation proof cannot be replayed indefinitely
  // against a grant that may have been revoked since.
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseAlpha,
      entitlement: null,
      operationalGrant: operationalGrantFor({
        granteeId: 'admin-1',
        caseId: 'case-alpha',
        checkedAt: '2026-08-09T11:50:00.000Z',
      }),
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_REVOCATION_STALE'),
  );

  for (const [label, tampered] of [
    ['missing activation', { grant: grantForAlpha.grant, activation: null }],
    ['flipped revocation flag', {
      grant: grantForAlpha.grant,
      activation: { ...grantForAlpha.activation, revoked: true },
    }],
    ['unchecked ledger', {
      grant: grantForAlpha.grant,
      activation: { ...grantForAlpha.activation, revocationLedgerChecked: false },
    }],
  ]) {
    assert.throws(
      () => projectCaseForActor({
        actor,
        caseRecord: caseAlpha,
        entitlement: null,
        operationalGrant: tampered,
        now: T0,
      }),
      deniedWith('ADMINISTRATIVE_GRANT_REVOCATION_UNPROVEN'),
      label,
    );
  }

  // Editing a field of the immutable grant breaks its canonical hash.
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseBeta,
      entitlement: null,
      operationalGrant: {
        grant: { ...grantForAlpha.grant, caseId: 'case-beta' },
        activation: grantForAlpha.activation,
      },
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_INVALID'),
  );

  assert.throws(
    () => createAdministrativeGrantActivation({ grant: grantForAlpha.grant, checkedAt: T0 }),
    deniedWith('ADMINISTRATIVE_GRANT_REVOKED'),
    'an omitted revoked flag must never read as "not revoked"',
  );
});

test('privileged operational metadata reads are separately classed, break-glass aware, and auditable', () => {
  const record = buildPrivateCase({ waived: false, id: 'case-audit' });

  // The metadata class is additive: routine WordPress administrator access is still not a
  // content grant, and a metadata operation is never listed as a content operation.
  assert.equal(ADMINISTRATIVE_GRANT_CONTRACT.routineWordPressAdministratorAccess, 'not_a_content_grant');
  assert.equal(ADMINISTRATIVE_GRANT_CONTRACT.operationalMetadataGrant, 'not_a_content_grant');
  assert.ok(
    ADMINISTRATIVE_GRANT_CONTRACT.operationClasses.operational_metadata.includes('read_operational_case_metadata'),
  );
  assert.equal(
    ADMINISTRATIVE_GRANT_CONTRACT.operationClasses.case_content.includes('read_operational_case_metadata'),
    false,
  );
  for (const contentOperation of ADMINISTRATIVE_GRANT_CONTRACT.operationClasses.case_content) {
    assert.equal(
      ADMINISTRATIVE_GRANT_CONTRACT.operationClasses.operational_metadata.includes(contentOperation),
      false,
      `${contentOperation} must not be reachable as an operational metadata capability`,
    );
  }

  for (const role of ['admin', 'founder', 'support']) {
    const actor = { id: `${role}-1`, role };
    const decision = authorizeCaseAction({
      actor,
      action: 'read_operational_metadata',
      caseRecord: record,
      entitlement: null,
      operationalGrant: operationalGrantFor({ granteeId: actor.id, caseId: record.id }),
      now: T0,
    });
    assert.equal(decision.privilegedAccess.operationClass, 'operational_metadata');
    assert.equal(decision.privilegedAccess.breakGlass, false);

    // audit-events.mjs already allowlists founder and support alongside admin, so a
    // privileged read by any of the three is structurally capable of being audited.
    const event = createAuditEvent(privilegedAccessAuditInput(decision, { at: T0 }));
    assert.equal(event.actorRole, role);
    assert.equal(event.outcome, 'success');
    assert.equal(event.metadata.action, 'read_operational_metadata');
    assert.equal(event.metadata.result, 'authorized_grant');
    assert.notEqual(event.targetRef, '', 'the audit event must bind to the grant that allowed the read');
    const serialized = JSON.stringify(event);
    for (const identifier of [actor.id, record.id, record.studentId]) {
      assert.equal(serialized.includes(identifier), false, 'audit references must stay digested');
    }
  }

  // Break glass is an explicit, named, separately labelled capability - never a side effect
  // of holding an operational role.
  const breakGlass = authorizeCaseAction({
    actor: { id: 'founder-1', role: 'founder' },
    action: 'read_operational_metadata',
    caseRecord: record,
    entitlement: null,
    operationalGrant: operationalGrantFor({
      granteeId: 'founder-1',
      caseId: record.id,
      operation: 'emergency_operational_case_metadata_break_glass',
      purpose: 'incident-2026-08-09-delivery-outage',
    }),
    now: T0,
  });
  assert.equal(breakGlass.privilegedAccess.breakGlass, true);
  assert.ok(
    ADMINISTRATIVE_GRANT_CONTRACT.breakGlassOperations.includes(
      'emergency_operational_case_metadata_break_glass',
    ),
  );
  assert.equal(
    createAuditEvent(privilegedAccessAuditInput(breakGlass, { at: T0 })).metadata.result,
    'break_glass',
    'emergency access must be distinguishable from routine authorised access in the audit log',
  );

  // Non-privileged decisions carry no privileged-access record and cannot fake one.
  const studentDecision = authorizeCaseAction({
    actor: { id: record.studentId, role: 'student' },
    action: 'read_student_projection',
    caseRecord: record,
    entitlement: eligible(record.studentId),
    now: T0,
  });
  assert.equal(studentDecision.privilegedAccess, null);
  assert.throws(() => privilegedAccessAuditInput(studentDecision, { at: T0 }), ValidationError);
});

test('a non-waived final document is visible only after explicit faculty release', () => {
  let record = buildPrivateCase({ waived: false });
  const entitlement = eligible(record.studentId);
  const actor = { id: record.studentId, role: 'student' };
  assert.equal(projectCaseForActor({ actor, caseRecord: record, entitlement }).finalDocument, null);
  record = setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    finalDocument: {
      id: 'document-2',
      text: 'AFFIRMATIVELY RELEASED FINAL',
      releasedToStudentAt: '2026-08-09T14:00:00.000Z',
    },
    now: new Date('2026-08-09T14:00:00Z'),
  });
  const projection = projectCaseForActor({ actor, caseRecord: record, entitlement });
  assert.equal(projection.finalDocument.text, 'AFFIRMATIVELY RELEASED FINAL');
  assert.equal(JSON.stringify(projection).includes('FACULTY PRIVATE DRAFT'), false);
});

test('faculty invitation tokens are >=128-bit, hashed at rest, recipient-bound, expiring, revocable, one-use, and locked out', () => {
  const issued = createFacultyInvitation({
    id: 'invite-lockout',
    caseId: 'case-1',
    recipientEmail: 'Writer@Example.Test',
    expiresAt: new Date('2026-08-09T13:00:00Z'),
    now: T0,
    maxAttempts: 3,
    attemptWindowMs: 60_000,
    lockoutMs: 60_000,
    tokenFactory: () => Buffer.alloc(32, 7),
  });
  assert.ok(Buffer.from(issued.rawToken, 'base64url').byteLength >= 16);
  assert.match(issued.invitation.tokenHash, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(issued.invitation).includes(issued.rawToken), false);
  assert.equal('recipientEmail' in issued.invitation, false);
  assert.throws(
    () => createFacultyInvitation({
      caseId: 'case-1',
      recipientEmail: 'writer@example.test',
      expiresAt: new Date('2026-08-09T13:00:00Z'),
      now: T0,
      tokenFactory: () => Buffer.alloc(15),
    }),
    ValidationError,
  );

  let invitation = issued.invitation;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const outcome = evaluateFacultyInvitationAttempt(invitation, {
      rawToken: 'wrong-token',
      recipientEmail: 'writer@example.test',
      otpProof: verifiedOtpProof(invitation),
      now: new Date(T0.valueOf() + attempt * 1_000),
    });
    invitation = outcome.invitation;
  }
  assert.equal(invitation.failedAttempts, 3);
  assert.ok(invitation.lockedUntil);
  const locked = evaluateFacultyInvitationAttempt(invitation, {
    rawToken: issued.rawToken,
    recipientEmail: 'writer@example.test',
    otpProof: verifiedOtpProof(invitation),
    now: new Date(T0.valueOf() + 4_000),
  });
  assert.equal(locked.reasonCode, 'INVITATION_LOCKED');
  assert.equal(locked.changed, false);

  const successful = evaluateFacultyInvitationAttempt(invitation, {
    rawToken: issued.rawToken,
    recipientEmail: 'writer@example.test',
    otpProof: verifiedOtpProof(invitation),
    now: new Date(T0.valueOf() + 64_000),
  });
  assert.equal(successful.verified, true);
  assert.equal(successful.invitation.verifiedFacultyId, 'faculty-1');
  const replay = evaluateFacultyInvitationAttempt(successful.invitation, {
    rawToken: issued.rawToken,
    recipientEmail: 'writer@example.test',
    otpProof: verifiedOtpProof(successful.invitation),
    now: new Date(T0.valueOf() + 65_000),
  });
  assert.equal(replay.reasonCode, 'INVITATION_ALREADY_USED');

  const recipientMismatch = evaluateFacultyInvitationAttempt(issued.invitation, {
    rawToken: issued.rawToken,
    recipientEmail: 'other@example.test',
    otpProof: verifiedOtpProof(issued.invitation),
    now: new Date(T0.valueOf() + 1_000),
  });
  assert.equal(recipientMismatch.reasonCode, 'RECIPIENT_MISMATCH');
  const unboundProviderProof = evaluateFacultyInvitationAttempt(issued.invitation, {
    rawToken: issued.rawToken,
    recipientEmail: 'writer@example.test',
    otpProof: verifiedOtpProof(issued.invitation, 'faculty-1', {
      invitationId: 'different-invitation',
    }),
    now: new Date(T0.valueOf() + 1_000),
  });
  assert.equal(unboundProviderProof.reasonCode, 'OTP_NOT_VERIFIED');

  const expiredIssued = createFacultyInvitation({
    id: 'invite-expired',
    caseId: 'case-1',
    recipientEmail: 'writer@example.test',
    expiresAt: new Date(T0.valueOf() + 1_000),
    now: T0,
    tokenFactory: () => Buffer.alloc(32, 8),
  });
  assert.equal(evaluateFacultyInvitationAttempt(expiredIssued.invitation, {
    rawToken: expiredIssued.rawToken,
    recipientEmail: 'writer@example.test',
    otpProof: verifiedOtpProof(expiredIssued.invitation),
    now: new Date(T0.valueOf() + 1_000),
  }).reasonCode, 'INVITATION_EXPIRED');

  const revoked = revokeFacultyInvitation(expiredIssued.invitation, { now: new Date(T0.valueOf() + 500) });
  assert.equal(evaluateFacultyInvitationAttempt(revoked, {
    rawToken: expiredIssued.rawToken,
    recipientEmail: 'writer@example.test',
    otpProof: verifiedOtpProof(revoked),
    now: new Date(T0.valueOf() + 600),
  }).reasonCode, 'INVITATION_REVOKED');
});

test('faculty verification service consumes OTP abstraction once and disabled OTP fails closed', async () => {
  const repository = new InMemoryFacultyInvitationRepository();
  const issued = createFacultyInvitation({
    id: 'invite-service',
    caseId: 'case-1',
    recipientEmail: 'writer@example.test',
    expiresAt: new Date('2026-08-09T13:00:00Z'),
    now: T0,
    tokenFactory: () => Buffer.alloc(32, 9),
  });
  await repository.create(issued.invitation);
  const otpPort = new StaticOtpTestAdapter({
    acceptedCode: '654321',
    principalId: 'faculty-from-provider',
    clock: () => new Date('2026-08-09T12:04:59Z'),
  });
  await assert.rejects(
    otpPort.verify({
      code: '654321',
      invitationId: issued.invitation.id,
      recipientEmailHash: issued.invitation.recipientEmailHash,
      principalId: 'caller-asserted-attacker',
    }),
    /may not assert a principal/u,
  );
  const service = new FacultyInvitationVerificationService({
    repository,
    otpPort,
    clock: () => new Date('2026-08-09T12:05:00Z'),
  });
  await assert.rejects(
    service.verify({
      invitationId: issued.invitation.id,
      rawToken: issued.rawToken,
      recipientEmail: 'writer@example.test',
      otpChallengeId: 'challenge-1',
      otpCode: '000000',
    }),
    InvitationDeniedError,
  );
  await assert.rejects(
    service.verify({
      invitationId: issued.invitation.id,
      rawToken: issued.rawToken,
      recipientEmail: 'writer@example.test',
      otpChallengeId: 'challenge-1',
      otpCode: '654321',
      facultyId: 'caller-asserted-attacker',
    }),
    ValidationError,
  );
  const success = await service.verify({
    invitationId: issued.invitation.id,
    rawToken: issued.rawToken,
    recipientEmail: 'writer@example.test',
    otpChallengeId: 'challenge-1',
    otpCode: '654321',
  });
  assert.equal(success.verified, true);
  assert.equal(success.invitation.verifiedFacultyId, 'faculty-from-provider');
  await assert.rejects(
    service.verify({
      invitationId: issued.invitation.id,
      rawToken: issued.rawToken,
      recipientEmail: 'writer@example.test',
      otpChallengeId: 'challenge-1',
      otpCode: '654321',
    }),
    InvitationDeniedError,
  );

  const disabledRepository = new InMemoryFacultyInvitationRepository();
  const disabledIssued = createFacultyInvitation({
    id: 'invite-disabled-otp',
    caseId: 'case-1',
    recipientEmail: 'writer@example.test',
    expiresAt: new Date('2026-08-09T13:00:00Z'),
    now: T0,
    tokenFactory: () => Buffer.alloc(32, 10),
  });
  await disabledRepository.create(disabledIssued.invitation);
  const disabledService = new FacultyInvitationVerificationService({
    repository: disabledRepository,
    otpPort: new DisabledOtpAdapter(),
    clock: () => new Date('2026-08-09T12:05:00Z'),
  });
  await assert.rejects(
    disabledService.verify({
      invitationId: disabledIssued.invitation.id,
      rawToken: disabledIssued.rawToken,
      recipientEmail: 'writer@example.test',
      otpChallengeId: 'challenge-2',
      otpCode: '654321',
    }),
    InvitationDeniedError,
  );
});

test('all unconfigured real integration adapters are explicit and fail closed', async () => {
  assert.deepEqual(await new DisabledStoryForgeAdapter().getEvidenceProjection(), {
    available: false,
    status: 'DISABLED_FAIL_CLOSED',
    records: [],
  });
  assert.deepEqual(await new DisabledTimelineAdapter().getTimelineProjection(), {
    available: false,
    status: 'DISABLED_FAIL_CLOSED',
    records: [],
  });
  await assert.rejects(new DisabledAiProposalAdapter().generateProposal(), IntegrationDisabledError);
  await assert.rejects(new DisabledEmailAdapter().sendFacultyInvitation(), IntegrationDisabledError);
  await assert.rejects(new DisabledPrivateStorageAdapter().put(), IntegrationDisabledError);
  await assert.rejects(new DisabledPrivateStorageAdapter().get(), IntegrationDisabledError);
});
