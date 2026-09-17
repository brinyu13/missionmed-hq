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
  DomainInvariantError,
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
  releaseFinalDocument,
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
  ImmutableAdministrativeGrantRepository,
  assertOperationalMetadataGrant,
  createAdministrativeGrant,
  createAdministrativeGrantActivation,
  isIssuedOperationalMetadataCapability,
  validateAdministrativeGrant,
} from '../../lor-studio/repositories/immutable-administrative-grant-repository.mjs';
import {
  CASE_ACTIONS,
  TRUSTED_STUDENT_AUTHORIZATION_FIELDS,
  assertTrustedStudentAuthorization,
  assertProjectionOmitsFacultyPrivateContent,
  authorizeCaseAction,
  evaluateStudentEntitlement,
  privilegedAccessAuditInput,
  projectCaseForActor,
  resolveTrustedStudentAuthorization,
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

const GRANT_LEDGER_BINDING = {
  providerResourceBound: true,
  independentlyVerified: true,
  appendOnly: true,
  auditBound: true,
  revocationLedger: true,
};

/** Append-only grant ledger standing in for the durable provider. */
function grantLedger() {
  const grants = new Map();
  const revocations = new Map();
  return {
    appendOnly: true,
    async appendGrant(grant) {
      grants.set(grant.grantId, structuredClone(grant));
      return { appended: true, auditBound: true, immutable: true, grant };
    },
    async appendRevocation(revocation) {
      revocations.set(revocation.grantId, structuredClone(revocation));
      return { appended: true, auditBound: true, immutable: true, revocation };
    },
    async readGrantWithRevocation({ grantId }) {
      return { grant: grants.get(grantId), revocation: revocations.get(grantId) ?? null };
    },
  };
}

/** Builds the canonical immutable grant RECORD - durable data, carrying no authority by itself. */
function administrativeGrantRecord({
  granteeId = 'admin-1',
  caseId = 'case-private',
  operation = 'read_operational_case_metadata',
  purpose = 'dr-119-operational-metadata-review',
  issuedAt = '2026-08-09T11:00:00.000Z',
  expiresAt = '2026-08-09T13:00:00.000Z',
} = {}) {
  return createAdministrativeGrant({
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
}

/**
 * Obtains the case-scoped operational-metadata capability DR-119 clause 9 requires, THROUGH THE
 * TRUSTED ISSUING PATH: the grant is appended to the ledger, then the repository reads it back,
 * confirms it is unrevoked and live, and mints the capability itself.
 *
 * This helper deliberately no longer hand-assembles `{ grant, activation }`. Doing so is exactly
 * the forgery the capability boundary now refuses, so a test that built its fixtures that way
 * would be asserting the vulnerable shape still works.
 */
async function operationalGrantFor({
  granteeId = 'admin-1',
  caseId = 'case-private',
  operation = 'read_operational_case_metadata',
  purpose = 'dr-119-operational-metadata-review',
  issuedAt = '2026-08-09T11:00:00.000Z',
  expiresAt = '2026-08-09T13:00:00.000Z',
  checkedAt = T0,
  ledger = grantLedger(),
} = {}) {
  const grant = administrativeGrantRecord({ granteeId, caseId, operation, purpose, issuedAt, expiresAt });
  const repository = new ImmutableAdministrativeGrantRepository({
    binding: GRANT_LEDGER_BINDING,
    driver: ledger,
    clock: () => new Date(checkedAt),
  });
  await repository.create(grant);
  return repository.getActiveOperationalMetadataGrant({
    grantId: grant.grantId,
    granteeId,
    caseId,
    operation,
    purpose,
  });
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

test('trusted student authorization exposes exactly the three server-verified database axes', () => {
  const authorization = resolveTrustedStudentAuthorization(eligible(), {
    studentId: 'student-1',
    requireCanary: true,
  });
  assert.deepEqual(Object.keys(authorization), TRUSTED_STUDENT_AUTHORIZATION_FIELDS);
  assert.deepEqual(
    {
      entitlementVerified: authorization.entitlementVerified,
      lorEnabled: authorization.lorEnabled,
      canaryAuthorized: authorization.canaryAuthorized,
      clientAsserted: authorization.clientAsserted,
    },
    { entitlementVerified: true, lorEnabled: true, canaryAuthorized: true, clientAsserted: false },
  );
  assert.equal(assertTrustedStudentAuthorization(authorization), authorization);
  assert.throws(
    () => assertTrustedStudentAuthorization({ ...authorization, clientAsserted: true }),
    AuthorizationDeniedError,
  );
  assert.throws(
    () => resolveTrustedStudentAuthorization(eligible('student-1', { canaryConsented: false }), {
      studentId: 'student-1',
      requireCanary: true,
    }),
    AuthorizationDeniedError,
  );
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

test('operational roles are denied every content action and reach metadata only through a case-scoped grant', async () => {
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
    const operationalGrant = await operationalGrantFor({ granteeId: actor.id, caseId: record.id });
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

test('faculty private and AI-drafting mutations fail closed after delivery', () => {
  const record = buildPrivateCase({ waived: false });
  const delivered = { ...record, status: 'delivered' };
  assert.throws(
    () => authorizeCaseAction({
      actor: { id: 'faculty-1', role: 'faculty' },
      action: 'write_faculty_private',
      caseRecord: delivered,
      entitlement: eligible(delivered.studentId),
      now: T0,
    }),
    deniedWith('CASE_STATUS_DENIED'),
  );
  assert.equal(
    authorizeCaseAction({
      actor: { id: 'faculty-1', role: 'faculty' },
      action: 'read_faculty_projection',
      caseRecord: delivered,
      entitlement: eligible(delivered.studentId),
      now: T0,
    }).allowed,
    true,
  );
});

test('an operational metadata grant is case-, actor-, class-, and time-scoped and fails closed', async () => {
  const caseAlpha = buildPrivateCase({ waived: false, id: 'case-alpha' });
  const caseBeta = buildPrivateCase({ waived: false, id: 'case-beta' });
  const actor = { id: 'admin-1', role: 'admin' };
  const grantForAlpha = await operationalGrantFor({ granteeId: 'admin-1', caseId: 'case-alpha' });

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
  // The class check now bites one layer EARLIER than it used to: the issuing path refuses to
  // mint a metadata capability from a content grant at all, so there is no longer any object
  // for projectCaseForActor to reject. The property under test is unchanged and strictly
  // better enforced - a content grant can never become metadata authority.
  await assert.rejects(
    () => operationalGrantFor({
      granteeId: 'admin-1',
      caseId: 'case-alpha',
      operation: 'read_case_content_for_privacy_request',
    }),
    deniedWith('ADMINISTRATIVE_GRANT_OPERATION_CLASS_MISMATCH'),
  );

  const expiredCapability = await operationalGrantFor({
    granteeId: 'admin-1',
    caseId: 'case-alpha',
    issuedAt: '2026-08-09T09:00:00.000Z',
    expiresAt: '2026-08-09T10:00:00.000Z',
    checkedAt: '2026-08-09T09:30:00.000Z',
  });
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseAlpha,
      entitlement: null,
      operationalGrant: expiredCapability,
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_EXPIRED_OR_NOT_YET_VALID'),
    'a genuinely issued capability still expires - issuance is not a permanent pass',
  );

  // A revocation check goes stale: an old activation proof cannot be replayed indefinitely
  // against a grant that may have been revoked since.
  const staleCapability = await operationalGrantFor({
    granteeId: 'admin-1',
    caseId: 'case-alpha',
    checkedAt: '2026-08-09T11:50:00.000Z',
  });
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: caseAlpha,
      entitlement: null,
      operationalGrant: staleCapability,
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_REVOCATION_STALE'),
  );

  // Every one of these tampered wrappers is still REFUSED - that assertion is unchanged.
  //
  // What changed is WHERE it is refused. Each is a hand-assembled `{ grant, activation }`
  // object, which is precisely the shape the capability boundary now rejects on identity before
  // it reads a single field. The denial is therefore earlier and broader than the per-field
  // activation checks that used to catch these, and those per-field checks are still exercised
  // directly further down (see the tampered-ledger cases), so no coverage is lost.
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
      deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
      label,
    );
  }

  // Editing a field of the immutable grant breaks its canonical hash - and the re-wrapping
  // needed to carry the edit is itself no longer an issued capability, so it is refused twice
  // over. The hash check that catches the edit on its own is asserted against the ledger below.
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
    deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
  );

  assert.throws(
    () => createAdministrativeGrantActivation({ grant: grantForAlpha.grant, checkedAt: T0 }),
    deniedWith('ADMINISTRATIVE_GRANT_REVOKED'),
    'an omitted revoked flag must never read as "not revoked"',
  );
});

test('privileged operational metadata reads are separately classed, break-glass aware, and auditable', async () => {
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
      operationalGrant: await operationalGrantFor({ granteeId: actor.id, caseId: record.id }),
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
    operationalGrant: await operationalGrantFor({
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
  // Rerouted through the real transition. This previously set releasedToStudentAt directly in the
  // setFacultyPrivateContent payload, which is exactly the hole DR-119 closed: a caller could
  // hand a student an unapproved, never-released letter by writing one field. That field is now
  // stripped on input and re-derived from the aggregate's own release record, so a release must
  // be earned - approved, signature-attested, and past a decided non-waived waiver.
  record = setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    finalDocument: { id: 'document-2', text: 'AFFIRMATIVELY RELEASED FINAL' },
    documentState: 'faculty_final',
    facultyApproval: {
      approved: true,
      approvedAt: '2026-08-09T13:50:00.000Z',
      facultyId: 'faculty-1',
      signatureAttested: true,
    },
    now: new Date('2026-08-09T13:50:00Z'),
  });

  // Approved and attested is still not released.
  assert.equal(
    projectCaseForActor({ actor, caseRecord: record, entitlement }).finalDocument,
    null,
    'approval alone must not expose the letter - only an explicit release may',
  );

  record = releaseFinalDocument(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    caseId: record.id,
    documentId: 'document-2',
    expectedRevision: record.revision,
    now: new Date('2026-08-09T14:00:00Z'),
  });

  const projection = projectCaseForActor({ actor, caseRecord: record, entitlement });
  assert.equal(projection.finalDocument.text, 'AFFIRMATIVELY RELEASED FINAL');
  assert.equal(projection.finalDocument.releasedToStudentAt, '2026-08-09T14:00:00.000Z');
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

/**
 * TASK 4 - the administrative-grant forgery boundary.
 *
 * REPRODUCED BEFORE THE FIX: `createAdministrativeGrant` and
 * `createAdministrativeGrantActivation` are public exports over an UNKEYED sha256, so a grant
 * that was never issued and never persisted could be built at any call site, wrapped as
 * `{ grant, activation }`, and handed to `projectCaseForActor`, which accepted it and returned
 * the full operational projection for an arbitrary victim case.
 *
 * The hash was never the defence it looked like: anyone who can call the constructor can
 * compute a matching hash, so the record authenticated nothing. Authority now rides on an
 * ISSUED CAPABILITY whose provenance is object identity - uncomputable, uncopyable, and
 * unreachable from anything that arrived as data.
 */
test('a caller-supplied administrative grant confers no authority - only an issued capability does', async () => {
  const record = buildPrivateCase({ waived: false, id: 'case-private' });
  const actor = { id: 'admin-1', role: 'admin' };

  // The exact forgery, reproduced: a well-formed, correctly hashed, never-issued grant.
  const forgedGrant = administrativeGrantRecord({ granteeId: 'admin-1', caseId: 'case-private' });
  const forgedActivation = createAdministrativeGrantActivation({
    grant: forgedGrant,
    revoked: false,
    checkedAt: T0,
  });
  // It really is internally valid - the forgery is not being rejected as malformed.
  assert.equal(validateAdministrativeGrant(forgedGrant), true);
  assert.equal(isIssuedOperationalMetadataCapability({ grant: forgedGrant, activation: forgedActivation }), false);

  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement: null,
      operationalGrant: { grant: forgedGrant, activation: forgedActivation },
      now: T0,
    }),
    deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
    'a never-issued grant must not yield the operational projection',
  );

  // The genuine article, minted through the ledger-reading issuing path, is accepted.
  const issued = await operationalGrantFor({ granteeId: 'admin-1', caseId: 'case-private' });
  assert.equal(isIssuedOperationalMetadataCapability(issued), true);
  assert.equal(
    projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement: null,
      operationalGrant: issued,
      now: T0,
    }).caseId,
    'case-private',
  );

  // A capability is not plain data and must not survive a serialisation round trip, because a
  // request body is exactly that. This is the property that protects the composition root the
  // moment it starts forwarding caller-supplied input.
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement: null,
      operationalGrant: JSON.parse(JSON.stringify(issued)),
      now: T0,
    }),
    deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
    'a deserialised capability is data, not authority',
  );
});

test('altering any binding field of a genuine capability fails closed', async () => {
  const record = buildPrivateCase({ waived: false, id: 'case-private' });
  const actor = { id: 'admin-1', role: 'admin' };
  const issued = await operationalGrantFor({ granteeId: 'admin-1', caseId: 'case-private' });

  // Copies. A spread copy, a nested-rebuild copy, a prototype-chained view, and a transparent
  // Proxy are all DIFFERENT OBJECTS, so none of them is the capability that was issued - even
  // though every field they expose is byte-identical to the genuine one.
  for (const [label, lookalike] of [
    ['spread copy', { ...issued }],
    ['nested rebuild', { ...issued, grant: { ...issued.grant }, activation: { ...issued.activation } }],
    ['prototype-chained view', Object.create(issued)],
    ['transparent proxy', new Proxy(issued, {})],
    ['structured clone', structuredClone(issued)],
  ]) {
    assert.equal(isIssuedOperationalMetadataCapability(lookalike), false, label);
    assert.throws(
      () => projectCaseForActor({
        actor,
        caseRecord: record,
        entitlement: null,
        operationalGrant: lookalike,
        now: T0,
      }),
      deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
      label,
    );
  }

  // Altered actor, case, operation and role - each re-forged as a complete, correctly hashed
  // grant so that nothing is caught merely for being malformed.
  const alterations = [
    ['altered actor', { granteeId: 'attacker-1', caseId: 'case-private' }],
    ['altered caseId', { granteeId: 'admin-1', caseId: 'case-someone-else' }],
    ['altered operation', {
      granteeId: 'admin-1',
      caseId: 'case-private',
      operation: 'emergency_operational_case_metadata_break_glass',
      purpose: 'self-authorised emergency',
    }],
  ];
  for (const [label, overrides] of alterations) {
    const grant = administrativeGrantRecord(overrides);
    assert.equal(validateAdministrativeGrant(grant), true, `${label} must be internally valid`);
    assert.throws(
      () => projectCaseForActor({
        actor,
        caseRecord: record,
        entitlement: null,
        operationalGrant: {
          grant,
          activation: createAdministrativeGrantActivation({ grant, revoked: false, checkedAt: T0 }),
        },
        now: T0,
      }),
      deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
      label,
    );
  }

  // Altered ROLE. A capability issued to an admin is not a bearer token: another operational
  // actor cannot present it, and this denial comes from the binding check INSIDE a genuine
  // capability, not from the identity gate - so both layers are shown to bite.
  assert.throws(
    () => projectCaseForActor({
      actor: { id: 'support-9', role: 'support' },
      caseRecord: record,
      entitlement: null,
      operationalGrant: issued,
      now: T0,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_BINDING_MISMATCH'),
    'a genuine capability is bound to its grantee, not to whoever holds it',
  );

  // A non-operational role cannot reach the operational branch at all, capability in hand or
  // not: the student is still routed by ROLE and still receives the student projection. A
  // capability widens nothing - it only satisfies a gate the operational branch already had.
  const studentProjection = projectCaseForActor({
    actor: { id: record.studentId, role: 'student' },
    caseRecord: record,
    entitlement: eligible(record.studentId),
    operationalGrant: issued,
    now: T0,
  });
  assert.equal(
    studentProjection.schemaVersion,
    'missionmed.lor.student-projection.v1',
    'holding an operational capability must not reclassify a student',
  );
  assert.notEqual(studentProjection.schemaVersion, 'missionmed.lor.operational-projection.v1');
});

test('prototype and accessor tricks cannot manufacture an administrative grant', async () => {
  const record = buildPrivateCase({ waived: false, id: 'case-private' });
  const actor = { id: 'admin-1', role: 'admin' };
  const genuine = administrativeGrantRecord({ granteeId: 'admin-1', caseId: 'case-private' });

  // ACCESSOR TIME-OF-CHECK/TIME-OF-USE. `caseId` reads as the grantee's own case the first
  // time and as a victim's case afterwards. Nothing may be authorised on the strength of a
  // value that changes after it was checked.
  let caseIdReads = 0;
  const tocTouGrant = {};
  for (const key of Object.keys(genuine)) {
    if (key === 'caseId') continue;
    Object.defineProperty(tocTouGrant, key, { value: genuine[key], enumerable: true });
  }
  Object.defineProperty(tocTouGrant, 'caseId', {
    enumerable: true,
    get() {
      caseIdReads += 1;
      return caseIdReads === 1 ? 'case-private' : 'case-victim';
    },
  });
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement: null,
      operationalGrant: {
        grant: tocTouGrant,
        activation: createAdministrativeGrantActivation({ grant: genuine, revoked: false, checkedAt: T0 }),
      },
      now: T0,
    }),
    deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
  );

  // And at the INNER layer the shifting field is PINNED rather than merely rejected, so the
  // defence does not depend on the identity gate having caught it first. The grant validates as
  // the value the getter returned the FIRST time, and the getter is never consulted again -
  // which is the whole property, since a second read is what a TOCTOU attack needs. Asserting
  // the read count is what makes this bite: were the snapshot removed, the count would climb
  // and 'case-victim' would reach the projection.
  assert.equal(validateAdministrativeGrant(tocTouGrant), true);
  assert.equal(caseIdReads, 1, 'a grant field must be read exactly once, so it cannot change under a check');

  // OBJECT.PROTOTYPE POLLUTION. Before the own-property snapshot, an EMPTY activation object
  // authenticated itself: the proof fields were inherited from the polluted prototype while the
  // rest-spread that recomputed the hash saw only own properties - that is, `{}` - so an
  // attacker who polluted `activationHash` with sha256(canonicalize({})) cleared the hash check
  // with a proof carrying no content whatsoever.
  const pollution = {
    schemaVersion: ADMINISTRATIVE_GRANT_CONTRACT.activationSchema,
    grantId: genuine.grantId,
    grantHash: genuine.grantHash,
    revocationLedgerChecked: true,
    revoked: false,
    checkedAt: T0.toISOString(),
    activationHash: sha256('{}'),
  };
  try {
    for (const [key, value] of Object.entries(pollution)) {
      Object.defineProperty(Object.prototype, key, {
        value,
        configurable: true,
        writable: true,
        enumerable: false,
      });
    }
    // Sanity: the pollution really is readable through an empty object.
    assert.equal({}.revoked, false, 'the pollution fixture must actually pollute');
    assert.equal({}.revocationLedgerChecked, true);

    assert.throws(
      () => projectCaseForActor({
        actor,
        caseRecord: record,
        entitlement: null,
        operationalGrant: { grant: genuine, activation: {} },
        now: T0,
      }),
      deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
      'an inherited activation proof must never authorise a read',
    );

    // A grant missing its own `revokedAt` must not inherit one either.
    const inheritedGrant = { ...genuine };
    delete inheritedGrant.revokedAt;
    Object.defineProperty(Object.prototype, 'revokedAt', {
      value: null,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    assert.equal(inheritedGrant.revokedAt, null, 'the pollution fixture must actually pollute');
    assert.throws(() => validateAdministrativeGrant(inheritedGrant), DomainInvariantError);
  } finally {
    for (const key of [...Object.keys(pollution), 'revokedAt']) delete Object.prototype[key];
  }
  assert.equal({}.revoked, undefined, 'pollution must be cleaned up');

  // A null-prototype look-alike is still not an issued capability.
  const nullProto = Object.assign(Object.create(null), { grant: genuine, activation: null });
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement: null,
      operationalGrant: nullProto,
      now: T0,
    }),
    deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
  );
});

test('the issuing path is the only route to a capability, and it consults the revocation ledger', async () => {
  const record = buildPrivateCase({ waived: false, id: 'case-private' });
  const actor = { id: 'admin-1', role: 'admin' };

  // DIRECT SERVICE INVOCATION, bypassing authorizeCaseAction entirely. The downstream gate is
  // not protected merely by its callers - it refuses forged input on its own.
  assert.throws(
    () => assertOperationalMetadataGrant({
      capability: {
        grant: administrativeGrantRecord({ granteeId: 'admin-1', caseId: 'case-private' }),
        activation: null,
      },
      granteeId: 'admin-1',
      caseId: 'case-private',
      now: T0,
    }),
    deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
  );
  for (const bogus of [undefined, null, 0, '', 'capability', [], () => {}]) {
    assert.throws(
      () => assertOperationalMetadataGrant({ capability: bogus, granteeId: 'admin-1', caseId: 'case-private', now: T0 }),
      deniedWith('OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED'),
      `capability=${String(bogus)}`,
    );
  }

  // REVOKED GRANT. Once the ledger carries a revocation, the issuing path stops minting - the
  // revocation is enforced at the source rather than being left to the holder to honour.
  const ledger = grantLedger();
  const issued = await operationalGrantFor({ granteeId: 'admin-1', caseId: 'case-private', ledger });
  assert.equal(isIssuedOperationalMetadataCapability(issued), true);
  const repository = new ImmutableAdministrativeGrantRepository({
    binding: GRANT_LEDGER_BINDING,
    driver: ledger,
    clock: () => T0,
  });
  await repository.revoke({
    grantId: issued.grantId,
    revokedByAuthority: 'privacy-authority:founder-approved-operational-review',
    reasonCode: 'ACCESS_WITHDRAWN',
    auditEventRef: sha256('operational-grant-revocation'),
  });
  await assert.rejects(
    () => repository.getActiveOperationalMetadataGrant({
      grantId: issued.grantId,
      granteeId: 'admin-1',
      caseId: 'case-private',
      operation: 'read_operational_case_metadata',
      purpose: 'dr-119-operational-metadata-review',
    }),
    deniedWith('ADMINISTRATIVE_GRANT_REVOKED'),
    'a revoked grant must not mint a fresh capability',
  );

  // REPLAY. The capability minted before the revocation is time-boxed by its activation proof,
  // so a holder cannot replay it indefinitely against a grant revoked in the meantime.
  const afterWindow = new Date(T0.valueOf() + ADMINISTRATIVE_GRANT_CONTRACT.activationMaxAgeMs + 1_000);
  assert.throws(
    () => projectCaseForActor({
      actor,
      caseRecord: record,
      entitlement: null,
      operationalGrant: issued,
      now: afterWindow,
    }),
    deniedWith('ADMINISTRATIVE_GRANT_REVOCATION_STALE'),
    'an issued capability must not outlive its revocation check',
  );

  // A LYING LEDGER cannot smuggle a grant past the canonical-record check either: the hash
  // comparison still bites on the durable read path, which is where a grant actually crosses
  // the persistence boundary and where the unkeyed hash is a genuine integrity control.
  const genuine = administrativeGrantRecord({ granteeId: 'admin-1', caseId: 'case-private' });
  const lyingLedger = {
    appendOnly: true,
    async appendGrant(grant) { return { appended: true, auditBound: true, immutable: true, grant }; },
    async appendRevocation(revocation) { return { appended: true, auditBound: true, immutable: true, revocation }; },
    async readGrantWithRevocation() {
      return { grant: { ...genuine, caseId: 'case-victim' }, revocation: null };
    },
  };
  await assert.rejects(
    () => new ImmutableAdministrativeGrantRepository({
      binding: GRANT_LEDGER_BINDING,
      driver: lyingLedger,
      clock: () => T0,
    }).getActiveOperationalMetadataGrant({
      grantId: genuine.grantId,
      granteeId: 'admin-1',
      caseId: 'case-victim',
      operation: 'read_operational_case_metadata',
      purpose: 'dr-119-operational-metadata-review',
    }),
    DomainInvariantError,
    'an edited grant must not survive the durable read',
  );

  // The contract states the model plainly, including the honest limit of the hash.
  assert.equal(ADMINISTRATIVE_GRANT_CONTRACT.capabilitySubmittableByCaller, false);
  assert.equal(ADMINISTRATIVE_GRANT_CONTRACT.grantRecordProof, 'unkeyed_canonical_hash_integrity_only');
  assert.equal(
    ADMINISTRATIVE_GRANT_CONTRACT.capabilityIssuedBy,
    'repository_get_active_operational_metadata_grant_only',
  );
});
