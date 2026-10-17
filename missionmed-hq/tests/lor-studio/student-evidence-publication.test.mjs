import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATOMIC_RLS_CASE_DRIVER_CONTRACT,
  ATOMIC_RLS_CASE_STATEMENTS,
  createAtomicRlsCaseDriver,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  appendStudentSafeReceipt,
  assertStudentEvidencePublicationEligible,
  autosaveStudentSafeBuilderStep,
  completeStudentSafeBuilderStep,
  createStudentSafeRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { createConsentReceipt } from '../../lor-studio/domain/receipts.js';
import { hashValue } from '../../lor-studio/domain/value-utils.js';
import {
  SUPABASE_LOR_REPOSITORY_CONTRACT,
  SupabaseDurableRecommendationCaseRepository,
} from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';

const CASE_ID = 'case_evidence_publication_1';
const STUDENT_ID = 'wp:401';
const AUTH_UID = '445fb648-06cf-46f1-ac4d-f1924cbaff19';
const CLOCK = '2026-08-26T14:00:00.000Z';
const AUTHORIZATION = Object.freeze({
  schemaVersion: 'missionmed.lor.trusted-student-authorization.v1',
  authoritySource: 'server_verified_entitlement',
  entitlementVerified: true,
  lorEnabled: true,
  canaryAuthorized: true,
  clientAsserted: false,
});

const BINDING = resolveLorTargetBinding({
  schemaVersion: LOR_TARGET_BINDING_SCHEMA,
  ratified: true,
  decisionRecord: 'DR-133',
  environment: 'staging',
  provider: 'railway-postgres',
  projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
  environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
  serviceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
  databaseName: 'railway',
  region: 'us-west2',
  schema: 'lor_studio',
  migrationLedger: 'lor_studio/migrations/staging',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: false,
});

function eligibleState() {
  let transition = createStudentSafeRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT_ID,
    actorId: STUDENT_ID,
    builderSessionId: 'builder_evidence_publication_1',
    now: '2026-08-26T13:00:00.000Z',
  });
  const stepData = {
    case_basics: { summary: 'Application evidence' },
    writer_relationship: { writerRole: 'Attending' },
    evidence_selection: {
      priorityEvidence: 'Led a quality-improvement effort on overnight rounds.',
      evidenceSummary: 'Reduced handoff omissions through a checklist.',
    },
    timeline_highlights: {
      standoutMoment: 'Presented the result at conference.',
      timelineSummary: 'Iterated with nursing and resident feedback.',
    },
    writer_preferences: { tonePreference: 'Specific and direct' },
    consent_and_waiver: { understanding: 'I consent to grounded drafting from these facts.' },
  };
  let minute = 1;
  for (const [stepId, data] of Object.entries(stepData)) {
    transition = autosaveStudentSafeBuilderStep(transition.state, {
      actorId: STUDENT_ID,
      stepId,
      stepData: data,
      now: `2026-08-26T13:${String(minute++).padStart(2, '0')}:00.000Z`,
    });
    transition = completeStudentSafeBuilderStep(transition.state, {
      actorId: STUDENT_ID,
      stepId,
      now: `2026-08-26T13:${String(minute++).padStart(2, '0')}:00.000Z`,
    });
  }
  const receipt = createConsentReceipt({
    id: 'consent_evidence_publication_1',
    caseId: CASE_ID,
    studentId: STUDENT_ID,
    scopes: ['ai_drafting', 'evidence_grounding'],
    policyVersion: 'dr-133-identified-education-record-v1',
    recordedAt: '2026-08-26T13:20:00.000Z',
  });
  return appendStudentSafeReceipt(transition.state, {
    actorId: STUDENT_ID,
    receiptType: 'consent',
    receipt,
    now: receipt.recordedAt,
  }).state;
}

function publishedState(current, occurredAt = CLOCK) {
  return {
    ...structuredClone(current),
    revision: current.revision + 1,
    updatedAt: occurredAt,
    studentEvidence: [{
      id: `evidence_${'a'.repeat(64)}`,
      caseId: CASE_ID,
      text: 'Led a quality-improvement effort on overnight rounds.',
      contentHash: 'b'.repeat(64),
      consentReceiptId: 'consent_evidence_publication_1',
    }],
  };
}

function entitlement() {
  return {
    studentId: STUDENT_ID,
    producerStatus: 'VERIFIED',
    revoked: false,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
  };
}

function scope({ caseId = CASE_ID, operation = 'save' } = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: AUTH_UID,
    authenticatedSubject: STUDENT_ID,
    actorId: STUDENT_ID,
    actorRole: 'student',
    resourceStudentId: STUDENT_ID,
    caseId,
    operation,
    purpose: operation === 'read' ? 'student_case_read' : 'student_case_write',
    assignmentId: null,
    invitationId: null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  };
}

test('evidence publication is declared on both actor-safe production contracts', () => {
  assert.equal(
    ATOMIC_RLS_CASE_DRIVER_CONTRACT.actorSafeMethods.includes(
      'commitStudentEvidencePublication',
    ),
    true,
  );
  assert.equal(
    ATOMIC_RLS_CASE_DRIVER_CONTRACT.securityDefinerFunctions.includes(
      'commit_student_evidence_publication',
    ),
    true,
  );
  assert.equal(
    SUPABASE_LOR_REPOSITORY_CONTRACT.actorSafeCommands.includes(
      'student.evidence.publish',
    ),
    true,
  );
});

test('domain eligibility requires completed evidence/consent steps and both explicit scopes', () => {
  const state = eligibleState();
  assert.deepEqual(assertStudentEvidencePublicationEligible(state), {
    sourceFieldCount: 4,
    consentReceiptId: 'consent_evidence_publication_1',
  });
  const withoutScope = structuredClone(state);
  withoutScope.consentReceipts[0].scopes = ['ai_drafting'];
  withoutScope.consentReceipts[0].receiptHash = hashValue(
    Object.fromEntries(Object.entries(withoutScope.consentReceipts[0]).filter(([key]) => key !== 'receiptHash')),
  );
  assert.throws(
    () => assertStudentEvidencePublicationEligible(withoutScope),
    /requires current drafting and grounding consent/u,
  );
  const stalePolicy = structuredClone(state);
  stalePolicy.consentReceipts[0].policyVersion = 'dr-119-v1';
  stalePolicy.consentReceipts[0].receiptHash = hashValue(
    Object.fromEntries(Object.entries(stalePolicy.consentReceipts[0]).filter(([key]) => key !== 'receiptHash')),
  );
  assert.throws(
    () => assertStudentEvidencePublicationEligible(stalePolicy),
    /requires current drafting and grounding consent/u,
  );
});

test('the latest append-only withdrawal revokes every older drafting consent', () => {
  const active = eligibleState();
  const withdrawal = createConsentReceipt({
    id: 'consent_evidence_publication_withdrawal',
    caseId: CASE_ID,
    studentId: STUDENT_ID,
    scopes: ['consent_withdrawn'],
    policyVersion: 'dr-133-identified-education-record-v1',
    recordedAt: '2026-08-26T13:21:00.000Z',
  });
  const withdrawn = appendStudentSafeReceipt(active, {
    actorId: STUDENT_ID,
    receiptType: 'consent',
    receipt: withdrawal,
    now: withdrawal.recordedAt,
  }).state;

  assert.throws(
    () => assertStudentEvidencePublicationEligible(withdrawn),
    /requires current drafting and grounding consent/u,
  );
  assert.throws(
    () => createConsentReceipt({
      caseId: CASE_ID,
      studentId: STUDENT_ID,
      scopes: ['consent_withdrawn', 'ai_drafting'],
      policyVersion: 'dr-133-identified-education-record-v1',
    }),
    /explicit scopes/u,
  );
});

test('service sends the durable command no caller evidence, IDs, hashes, provenance, support, or visibility', async () => {
  const state = eligibleState();
  let command;
  const unavailable = async () => { throw new Error('not used'); };
  const repository = {
    isDurable: true,
    atomicStateAndEvent: true,
    actorSafeCommands: true,
    reserveCaseCreation: unavailable,
    readStudentSafeCase: async () => state,
    commitStudentCaseCreate: unavailable,
    commitStudentBuilderAutosave: unavailable,
    commitStudentBuilderComplete: unavailable,
    commitStudentConsentReceipt: unavailable,
    commitStudentWaiverReceipt: unavailable,
    readFacultyCaseProjection: unavailable,
    commitFacultyPrivateContent: unavailable,
    commitFacultyFinalDocumentRelease: unavailable,
    readMentorCaseProjection: unavailable,
    getById: unavailable,
    commitWithEvent: unavailable,
    async commitStudentEvidencePublication(input) {
      command = structuredClone(input);
      return publishedState(state, input.event.occurredAt);
    },
  };
  const service = new RecommendationCaseService({
    repository,
    entitlementPort: { getStudentEntitlement: async () => entitlement() },
    clock: () => new Date(CLOCK),
  });
  const result = await service.publishStudentEvidence({
    caseId: CASE_ID,
    actor: { id: STUDENT_ID, role: 'student' },
    expectedRevision: state.revision,
    idempotencyKey: 'idem-evidence-publication-1',
  });
  assert.equal(result.revision, state.revision + 1);
  assert.deepEqual(Object.keys(command).sort(), [
    'caseId', 'event', 'expectedRevision', 'idempotencyKey', 'requestHash',
    'studentId', 'studentWriteAuthorization',
  ]);
  assert.equal(command.event.eventType, 'student.material_updated');
  const serialized = JSON.stringify(command);
  for (const forbidden of [
    'priorityEvidence', 'evidenceSummary', 'consentReceiptId', 'contentHash',
    'provenance', 'supportIds', 'facultyVisibility',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);

  await assert.rejects(
    service.publishStudentEvidence({
      caseId: CASE_ID,
      actor: { id: STUDENT_ID, role: 'student' },
      expectedRevision: state.revision,
      idempotencyKey: 'idem-hostile',
      evidence: [{ text: 'caller chosen' }],
    }),
    /only its narrow command fields/u,
  );
});

test('repository and driver bind the five-parameter SQL command to trusted RLS scope', async () => {
  const current = eligibleState();
  const next = publishedState(current);
  const event = createMetadataServiceEvent({
    eventId: 'evidence-publication-driver',
    eventType: 'student.material_updated',
    caseId: CASE_ID,
    actorId: STUDENT_ID,
    actorRole: 'student',
    correlationId: 'evidence-publication-driver',
    revision: next.revision,
    occurredAt: CLOCK,
  });
  const requestHash = hashValue({
    operation: 'student.evidence.publish',
    caseId: CASE_ID,
    actorId: STUDENT_ID,
    payload: {},
  });
  const statements = [];
  const executor = {
    serverOnly: true,
    transactional: true,
    databaseRole: 'lor_studio_app',
    async withConnection(handler) {
      return handler({
        async transaction(run) {
          return run({
            async execute(statement) {
              statements.push(statement);
              if (statement.statementId === ATOMIC_RLS_CASE_STATEMENTS.bindIdentity) {
                return { rows: [{}] };
              }
              assert.equal(
                statement.statementId,
                ATOMIC_RLS_CASE_STATEMENTS.commitStudentEvidencePublication,
              );
              const submittedEvent = JSON.parse(statement.values[3]);
              return { rows: [{ result: {
                schemaVersion: 'missionmed.lor.atomic-command-receipt.v2',
                action: 'student.evidence.publish',
                committed: true,
                replayed: false,
                sameTransaction: true,
                caseId: CASE_ID,
                studentId: STUDENT_ID,
                revision: String(next.revision),
                idempotencyKey: statement.values[1],
                requestHash: statement.values[2],
                safeRecordHash: hashValue({ safe: next }),
                protectedStateHash: 'c'.repeat(64),
                eventHash: statement.values[4],
                auditEventRef: submittedEvent.eventRef,
                transactionId: '101',
                state: next,
              } }] };
            },
          });
        },
      });
    },
  };
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider: ({ caseId, operation }) => scope({ caseId, operation }),
  });
  const stored = await repository.commitStudentEvidencePublication({
    caseId: CASE_ID,
    studentId: STUDENT_ID,
    expectedRevision: current.revision,
    idempotencyKey: 'idem-evidence-publication-driver',
    requestHash,
    event,
    studentWriteAuthorization: AUTHORIZATION,
  });
  assert.deepEqual(stored, next);
  assert.equal(statements.length, 2);
  const command = statements[1];
  assert.match(command.text, /^SELECT lor_studio\.commit_student_evidence_publication\(/u);
  assert.deepEqual(command.values.slice(0, 3), [
    current.revision,
    'idem-evidence-publication-driver',
    requestHash,
  ]);
  assert.equal(command.values.length, 5);
  assert.equal(command.values.some((value) => String(value).includes('priorityEvidence')), false);
});
