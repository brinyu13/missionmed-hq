import assert from 'node:assert/strict';
import test from 'node:test';

import { MetadataOnlyEventBuffer, StaticEntitlementTestAdapter } from '../../lor-studio/adapters/test-adapters.js';
import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  StaleRevisionError,
  ValidationError,
} from '../../lor-studio/domain/errors.js';
import {
  BUILDER_STEPS,
  CASE_STATUSES,
  appendReceipt,
  assertRecommendationCase,
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  builderProgress,
  completeBuilderStep,
  createRecommendationCase,
  finalDocumentContentHash,
  releaseFinalDocument,
  setFacultyPrivateContent,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import {
  createConsentReceipt,
  createWaiverReceipt,
  currentWaiverState,
} from '../../lor-studio/domain/receipts.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { projectCaseForActor } from '../../lor-studio/security/authorization-policy.js';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import {
  createMetadataServiceEvent,
  validateMetadataServiceEvent,
} from '../../lor-studio/services/metadata-events.js';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';

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

function deterministicIdFactory() {
  let value = 0;
  return () => `id-${++value}`;
}

function completeBuilder(record, actorId = record.studentId) {
  let next = record;
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    next = autosaveBuilderStep(next, {
      actorId,
      stepId,
      stepData: { acknowledged: true, index },
      now: new Date(T0.valueOf() + index * 2_000),
    });
    next = completeBuilderStep(next, {
      actorId,
      stepId,
      now: new Date(T0.valueOf() + index * 2_000 + 1_000),
    });
  }
  return next;
}

class DurableAtomicRepositoryTestDouble {
  constructor() {
    this.isDurable = true;
    this.atomicStateAndEvent = true;
    this.durability = 'DURABLE_ATOMIC_TEST_DOUBLE';
    this.inner = new InMemoryRecommendationCaseRepository();
    this.commits = [];
  }

  async getById(caseId) {
    return this.inner.getById(caseId);
  }

  async reserveCaseCreation(request) {
    return this.inner.reserveCaseCreation(request);
  }

  async commitWithEvent(transaction) {
    validateMetadataServiceEvent(transaction.event);
    const metadata = {
      idempotencyKey: transaction.idempotencyKey,
      requestHash: transaction.requestHash,
    };
    const stored = transaction.operation === 'create'
      ? await this.inner.create(transaction.record, metadata)
      : await this.inner.save(transaction.record, {
        expectedRevision: transaction.expectedRevision,
        ...metadata,
      });
    this.commits.push(structuredClone({
      operation: transaction.operation,
      expectedRevision: transaction.expectedRevision,
      event: transaction.event,
    }));
    return stored;
  }
}

test('RecommendationCase enforces an immutable eight-step builder and valid lifecycle', () => {
  const makeId = deterministicIdFactory();
  const original = createRecommendationCase({
    id: 'case-1',
    studentId: 'student-1',
    now: T0,
    idFactory: makeId,
  });

  assert.equal(original.builder.totalSteps, 8);
  assert.equal(BUILDER_STEPS.length, 8);
  assert.equal(builderProgress(original).percent, 0);
  assert.ok(Object.isFrozen(original));
  assert.throws(
    () => autosaveBuilderStep(original, {
      actorId: 'student-1',
      stepId: BUILDER_STEPS[1],
      stepData: {},
      now: T0,
    }),
    DomainInvariantError,
  );

  const completed = completeBuilder(original);
  assert.equal(original.revision, 0, 'domain operations must not mutate the loaded version');
  assert.deepEqual(completed.builder.completedStepIds, BUILDER_STEPS);
  assert.deepEqual(builderProgress(completed), {
    sessionId: 'builder_id-1',
    completedSteps: 8,
    totalSteps: 8,
    percent: 100,
    nextStepId: null,
    autosavedAt: '2026-08-09T12:00:15.000Z',
  });
  assert.equal(completed.versionHistory.length, completed.revision + 1);
  assert.equal(JSON.stringify(completed.versionHistory).includes('acknowledged'), false);

  const recipientEmailHash = sha256('writer@example.test');
  const invited = bindFacultyInvitation(completed, {
    actorId: 'student-1',
    invitationId: 'invite-1',
    recipientEmailHash,
    now: new Date('2026-08-09T13:00:00Z'),
  });
  const verified = bindVerifiedFaculty(invited, {
    actorId: 'faculty-1',
    invitationId: 'invite-1',
    facultyId: 'faculty-1',
    recipientEmailHash,
    now: new Date('2026-08-09T13:05:00Z'),
  });
  assert.throws(
    () => transitionRecommendationCase(verified, {
      actorId: 'faculty-1',
      toStatus: 'delivered',
      now: T0,
    }),
    DomainInvariantError,
  );
  const review = transitionRecommendationCase(verified, {
    actorId: 'faculty-1',
    toStatus: 'faculty_review',
    now: new Date('2026-08-09T13:10:00Z'),
  });
  const approved = transitionRecommendationCase(review, {
    actorId: 'faculty-1',
    toStatus: 'faculty_approved',
    now: new Date('2026-08-09T13:20:00Z'),
  });
  const delivered = transitionRecommendationCase(approved, {
    actorId: 'faculty-1',
    toStatus: 'delivered',
    delivery: {
      status: 'delivered',
      destinationClass: 'approved_institution_channel',
      deliveredAt: '2026-08-09T13:30:00.000Z',
    },
    now: new Date('2026-08-09T13:30:00Z'),
  });
  const closed = transitionRecommendationCase(delivered, {
    actorId: 'faculty-1',
    toStatus: 'closed',
    now: new Date('2026-08-09T14:00:00Z'),
  });
  assert.equal(closed.closedAt, '2026-08-09T14:00:00.000Z');
  assert.throws(
    () => transitionRecommendationCase(closed, {
      actorId: 'faculty-1',
      toStatus: 'cancelled',
      now: T0,
    }),
    DomainInvariantError,
  );
});

test('in-memory repository is truthful, optimistic, append-only, and idempotent', async () => {
  const repository = new InMemoryRecommendationCaseRepository();
  const record = createRecommendationCase({
    id: 'case-repo',
    studentId: 'student-1',
    now: T0,
    idFactory: () => 'builder-repo',
  });
  const created = await repository.create(record, {
    idempotencyKey: 'create-1',
    requestHash: sha256('create-request'),
  });
  assert.equal(repository.isDurable, false);
  assert.equal(repository.durability, 'NON_DURABLE_TEST_ONLY');
  assert.equal(repository.describePersistence().productionEligible, false);
  assert.throws(() => repository.assertProductionReady(), DomainInvariantError);

  const update = autosaveBuilderStep(created, {
    actorId: 'student-1',
    stepId: BUILDER_STEPS[0],
    stepData: { relationship: 'Private narrative' },
    now: new Date('2026-08-09T12:01:00Z'),
  });
  const saveMetadata = {
    expectedRevision: 0,
    idempotencyKey: 'save-1',
    requestHash: sha256('same-request'),
  };
  const saved = await repository.save(update, saveMetadata);
  const replay = await repository.save(update, saveMetadata);
  assert.deepEqual(replay, saved);
  assert.equal(replay.revision, 1);
  await assert.rejects(
    repository.save(update, { ...saveMetadata, requestHash: sha256('different-request') }),
    IdempotencyConflictError,
  );

  const stale = autosaveBuilderStep(created, {
    actorId: 'student-1',
    stepId: BUILDER_STEPS[0],
    stepData: { relationship: 'Concurrent value' },
    now: new Date('2026-08-09T12:02:00Z'),
  });
  await assert.rejects(
    repository.save(stale, {
      expectedRevision: 0,
      idempotencyKey: 'save-stale',
      requestHash: sha256('stale-request'),
    }),
    StaleRevisionError,
  );

  const validNext = completeBuilderStep(saved, {
    actorId: 'student-1',
    stepId: BUILDER_STEPS[0],
    now: new Date('2026-08-09T12:03:00Z'),
  });
  const historyRewrite = structuredClone(validNext);
  historyRewrite.versionHistory[0].eventType = 'case.rewritten';
  await assert.rejects(
    repository.save(historyRewrite, {
      expectedRevision: 1,
      idempotencyKey: 'history-attack',
      requestHash: sha256('history-attack'),
    }),
    DomainInvariantError,
  );
});

test('non-durable creation reservations fail closed at a fixed memory bound and replay without growth', async () => {
  const repository = new InMemoryRecommendationCaseRepository({ creationReservationCapacity: 2 });
  const reserve = (actorId, idempotencyKey, suffix, requestHash = sha256(`request-${actorId}`)) => (
    repository.reserveCaseCreation({
      actorId,
      idempotencyKey,
      requestHash,
      proposedIdentifiers: {
        caseId: `case-${suffix}`,
        builderSessionId: `builder-${suffix}`,
        createdAt: T0,
      },
    })
  );
  const first = await reserve('student-1', 'create-1', 'first');
  const replay = await reserve('student-1', 'create-1', 'attacker-proposal');
  assert.equal(replay.replayed, true);
  assert.equal(replay.caseId, first.caseId);
  assert.equal(replay.builderSessionId, first.builderSessionId);
  assert.equal(repository.describePersistence().creationReservationCount, 1);
  await assert.rejects(
    reserve('student-1', 'create-1', 'conflict', sha256('conflicting-request')),
    IdempotencyConflictError,
  );
  await reserve('student-2', 'create-2', 'second');
  await assert.rejects(
    reserve('student-3', 'create-3', 'capacity-attack'),
    /capacity is exhausted/u,
  );
  assert.equal(repository.describePersistence().creationReservationCount, 2);
});

test('case service resolves entitlement server-side, resumes autosave, rejects IDOR, and emits metadata only', async () => {
  const repository = new InMemoryRecommendationCaseRepository();
  const entitlements = new StaticEntitlementTestAdapter([eligible('student-1')]);
  const events = new MetadataOnlyEventBuffer();
  let clockMs = T0.valueOf();
  const service = new RecommendationCaseService({
    repository,
    entitlementPort: entitlements,
    eventSink: events,
    clock: () => new Date(clockMs += 1_000),
    caseIdFactory: () => 'case-service',
    protectedIdFactory: () => 'builder-service',
  });
  const actor = { id: 'student-1', role: 'student' };
  const created = await service.createCase({
    actor,
    idempotencyKey: 'service-create',
  });
  for (const clientIdentifier of [
    { caseId: 'client-selected-case' },
    { id: 'client-selected-id' },
    { builderSessionId: 'client-selected-builder' },
    { protectedId: 'client-selected-protected-id' },
  ]) {
    await assert.rejects(
      service.createCase({ ...clientIdentifier, actor, idempotencyKey: 'client-id-attack' }),
      ValidationError,
    );
  }
  const saved = await service.autosaveBuilder({
    caseId: created.id,
    actor,
    expectedRevision: created.revision,
    idempotencyKey: 'service-autosave',
    stepId: BUILDER_STEPS[0],
    stepData: { narrative: 'Private narrative that must not enter audit events' },
  });
  const retried = await service.autosaveBuilder({
    caseId: created.id,
    actor,
    expectedRevision: created.revision,
    idempotencyKey: 'service-autosave',
    stepId: BUILDER_STEPS[0],
    stepData: { narrative: 'Private narrative that must not enter audit events' },
  });
  assert.equal(retried.revision, saved.revision);

  const resumed = await service.resumeBuilder({ caseId: created.id, actor });
  assert.equal(resumed.progress.completedSteps, 0);
  assert.equal(resumed.progress.nextStepId, BUILDER_STEPS[0]);
  assert.equal(resumed.projection.revision, saved.revision);
  assert.equal(
    resumed.projection.builder.stepData.case_basics.narrative,
    'Private narrative that must not enter audit events',
  );
  assert.equal(JSON.stringify(events.snapshot()).includes('Private narrative'), false);
  assert.ok(events.snapshot().every((event) => Object.keys(event).length === 10));
  assert.ok(events.snapshot().every((event) => !('caseId' in event) && !('actorId' in event)));

  await assert.rejects(
    service.autosaveBuilder({
      caseId: created.id,
      actor,
      expectedRevision: 0,
      idempotencyKey: 'service-stale',
      stepId: BUILDER_STEPS[0],
      stepData: { narrative: 'stale' },
    }),
    StaleRevisionError,
  );
  await assert.rejects(
    service.getCaseProjection({
      caseId: created.id,
      actor: { id: 'student-2', role: 'student' },
    }),
    AuthorizationDeniedError,
  );
});

test('durable case writes require and use one atomic state-plus-event repository commit', async () => {
  const entitlements = new StaticEntitlementTestAdapter([eligible('student-1')]);
  assert.throws(
    () => new RecommendationCaseService({
      repository: {
        isDurable: true,
        atomicStateAndEvent: false,
        async getById() {},
        async commitWithEvent() {},
      },
      entitlementPort: entitlements,
    }),
    /atomicStateAndEvent=true/u,
  );

  const repository = new DurableAtomicRepositoryTestDouble();
  assert.throws(
    () => new RecommendationCaseService({
      repository,
      entitlementPort: entitlements,
      eventSink: new MetadataOnlyEventBuffer(),
    }),
    /no separate eventSink/u,
  );

  let clockMs = T0.valueOf();
  const service = new RecommendationCaseService({
    repository,
    entitlementPort: entitlements,
    clock: () => new Date(clockMs += 1_000),
    caseIdFactory: () => 'case-durable-atomic',
    protectedIdFactory: () => 'builder-durable-atomic',
  });
  assert.equal(service.persistenceMode, 'DURABLE_ATOMIC_STATE_AND_EVENT');
  const actor = { id: 'student-1', role: 'student' };
  const created = await service.createCase({
    actor,
    idempotencyKey: 'durable-create',
  });
  const saved = await service.autosaveBuilder({
    caseId: created.id,
    actor,
    expectedRevision: created.revision,
    idempotencyKey: 'durable-autosave',
    stepId: BUILDER_STEPS[0],
    stepData: { narrative: 'PROTECTED FACULTY LETTER STRING' },
  });
  assert.equal(saved.revision, 1);
  assert.equal(repository.commits.length, 2);
  assert.deepEqual(repository.commits.map((commit) => commit.operation), ['create', 'save']);
  assert.equal(repository.commits[1].expectedRevision, 0);
  const committedEvents = JSON.stringify(repository.commits.map((commit) => commit.event));
  assert.equal(committedEvents.includes('case-durable-atomic'), false);
  assert.equal(committedEvents.includes('student-1'), false);
  assert.equal(committedEvents.includes('PROTECTED FACULTY LETTER STRING'), false);
  assert.ok(repository.commits.every((commit) => /^case_[a-f0-9]{64}$/u.test(commit.event.caseRef)));

  const failingRepository = {
    isDurable: true,
    atomicStateAndEvent: true,
    commitCalls: 0,
    async reserveCaseCreation({ proposedIdentifiers }) {
      return { ...proposedIdentifiers, replayed: false };
    },
    async getById() { throw new Error('not stored'); },
    async commitWithEvent() {
      this.commitCalls += 1;
      throw new Error('atomic event transaction unavailable');
    },
  };
  const failingService = new RecommendationCaseService({
    repository: failingRepository,
    entitlementPort: entitlements,
    clock: () => T0,
    caseIdFactory: () => 'case-atomic-failure',
  });
  await assert.rejects(
    failingService.createCase({
      actor,
      idempotencyKey: 'atomic-failure',
    }),
    /atomic event transaction unavailable/u,
  );
  assert.equal(failingRepository.commitCalls, 1);
  await assert.rejects(failingRepository.getById('case-atomic-failure'), /not stored/u);
});

test('metadata service events pseudonymize all supplied strings and reject generic protected fields', () => {
  const protectedCaseValue = 'FACULTY LETTER CONTENT UNDER GENERIC CASE KEY';
  const protectedActorValue = 'PATIENT NAME UNDER GENERIC ACTOR KEY';
  const protectedCorrelationValue = 'SECRET TOKEN UNDER GENERIC CORRELATION KEY';
  const event = createMetadataServiceEvent({
    eventId: 'raw event identity',
    eventType: 'builder.autosaved',
    caseId: protectedCaseValue,
    actorId: protectedActorValue,
    actorRole: 'student',
    correlationId: protectedCorrelationValue,
    outcome: 'success',
    revision: 2,
    occurredAt: T0,
  });
  const serialized = JSON.stringify(event);
  for (const protectedValue of [protectedCaseValue, protectedActorValue, protectedCorrelationValue]) {
    assert.equal(serialized.includes(protectedValue), false);
  }
  assert.match(event.eventRef, /^event_[a-f0-9]{64}$/u);
  assert.match(event.caseRef, /^case_[a-f0-9]{64}$/u);
  assert.match(event.actorRef, /^actor_[a-f0-9]{64}$/u);
  assert.match(event.correlationRef, /^correlation_[a-f0-9]{64}$/u);
  assert.throws(
    () => validateMetadataServiceEvent({
      ...event,
      message: 'FACULTY LETTER CONTENT UNDER GENERIC KEY',
    }),
    ValidationError,
  );
  assert.throws(
    () => validateMetadataServiceEvent({
      ...event,
      caseRef: 'FACULTY_SECRET_UNHASHED',
    }),
    ValidationError,
  );
  assert.throws(
    () => createMetadataServiceEvent({
      eventType: 'custom.free_text_event',
      caseId: 'case-1',
      actorId: 'student-1',
      actorRole: 'student',
      correlationId: 'correlation-1',
    }),
    ValidationError,
  );
});

test('consent and waiver receipts are explicit, hash-sealed, versioned, and append-only', async () => {
  const makeId = deterministicIdFactory();
  const consent = createConsentReceipt({
    caseId: 'case-receipts',
    studentId: 'student-1',
    scopes: ['faculty_share', 'timeline_read', 'faculty_share'],
    policyVersion: 'dr-019-v1',
    recordedAt: T0,
    idFactory: makeId,
  });
  const waived = createWaiverReceipt({
    caseId: 'case-receipts',
    studentId: 'student-1',
    waived: true,
    policyVersion: 'dr-019-v1',
    acknowledgment: 'I knowingly waive access.',
    recordedAt: T0,
    idFactory: makeId,
  });
  const changed = createWaiverReceipt({
    caseId: 'case-receipts',
    studentId: 'student-1',
    waived: false,
    policyVersion: 'dr-019-v1',
    priorReceiptId: waived.id,
    acknowledgment: 'I explicitly replace my prior waiver choice.',
    recordedAt: new Date('2026-08-10T12:00:00Z'),
    idFactory: makeId,
  });
  assert.deepEqual(consent.scopes, ['faculty_share', 'timeline_read']);
  assert.match(consent.receiptHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(currentWaiverState([waived]), {
    decided: true,
    waived: true,
    receiptId: waived.id,
  });
  assert.deepEqual(currentWaiverState([waived, changed]), {
    decided: true,
    waived: false,
    receiptId: changed.id,
  });
  assert.throws(
    () => currentWaiverState([changed]),
    /First waiver receipt cannot supersede/u,
  );
  const retroactive = createWaiverReceipt({
    caseId: 'case-receipts',
    studentId: 'student-1',
    waived: false,
    policyVersion: 'dr-019-v1',
    priorReceiptId: waived.id,
    acknowledgment: 'This change is incorrectly backdated.',
    recordedAt: new Date('2026-08-08T12:00:00Z'),
    idFactory: makeId,
  });
  assert.throws(
    () => currentWaiverState([waived, retroactive]),
    /retroactively timestamped/u,
  );
});

test('every event type the domain can emit is accepted by the metadata sink', async () => {
  // Derived, not restated. The previous seven-entry allowlist had drifted out of step with the
  // domain, so the first lifecycle or faculty write would have thrown
  // ValidationError('Unknown metadata event type'). This test reads the aggregate's own source
  // so the two can never diverge again without failing here.
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = readFileSync(
    fileURLToPath(new URL('../../lor-studio/domain/recommendation-case.js', import.meta.url)),
    'utf8',
  );

  const emitted = new Set();
  for (const [, literal] of source.matchAll(/eventType:\s*'([a-z_]+\.[a-z_]+)'/gu)) {
    emitted.add(literal);
  }
  // Dynamic families: `case.${toStatus}` and `${receiptType}.recorded`.
  for (const status of CASE_STATUSES) emitted.add(`case.${status}`);
  for (const receiptType of ['consent', 'waiver']) emitted.add(`${receiptType}.recorded`);

  assert.ok(emitted.size >= 15, `expected the domain to emit many event types, saw ${emitted.size}`);

  for (const eventType of [...emitted].sort()) {
    assert.doesNotThrow(
      () => createMetadataServiceEvent({
        eventType,
        caseId: 'case-1',
        actorId: 'student-1',
        actorRole: 'student',
        correlationId: 'corr-1',
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      `metadata sink rejects '${eventType}', which the domain emits`,
    );
  }
});


// ---------------------------------------------------------------------------
// Final-document release state machine.
//
// Before this lane, setFacultyPrivateContent structuredCloned whatever `finalDocument` a caller
// passed straight into the aggregate - releasedToStudentAt included - and assertRecommendationCase
// never looked at facultyPrivate at all. authorization-policy.js:296 reads
// facultyPrivate.finalDocument.releasedToStudentAt as the gate deciding whether a student may see
// the final letter, so one unvalidated field granted a student sight of an unapproved letter with
// no release, no approval and no attestation anywhere in the aggregate. These tests hold that shut.
// ---------------------------------------------------------------------------

const FINAL_TEXT = 'FINAL LETTER WORDING';
const WAIVER_AT = new Date('2026-08-09T12:00:00.000Z');
const APPROVED_AT = '2026-08-09T14:30:00.000Z';
const RELEASE_AT = new Date('2026-08-09T15:00:00.000Z');

function approvalFixture(overrides = {}) {
  return {
    approved: true,
    approvedAt: APPROVED_AT,
    facultyId: 'faculty-1',
    signatureAttested: true,
    ...overrides,
  };
}

function releasableCase({
  waived = false,
  waiverDecided = true,
  documentState = 'faculty_final',
  facultyApproval = approvalFixture(),
  finalDocument = { id: 'document-1', text: FINAL_TEXT },
} = {}) {
  const idFactory = deterministicIdFactory();
  let record = createRecommendationCase({
    id: 'case-release',
    studentId: 'student-1',
    now: T0,
    idFactory,
  });
  if (waiverDecided) {
    record = appendReceipt(record, {
      actorId: 'student-1',
      receiptType: 'waiver',
      receipt: createWaiverReceipt({
        caseId: 'case-release',
        studentId: 'student-1',
        waived,
        policyVersion: 'dr-119-v1',
        acknowledgment: waived ? 'I waive access.' : 'I retain access to the final letter.',
        recordedAt: WAIVER_AT,
        idFactory,
      }),
      now: T0,
    });
  }
  record = completeBuilder(record);
  const recipientEmailHash = sha256('writer@example.test');
  record = bindFacultyInvitation(record, {
    actorId: 'student-1',
    invitationId: 'invite-release',
    recipientEmailHash,
    now: new Date('2026-08-09T13:00:00Z'),
  });
  record = bindVerifiedFaculty(record, {
    actorId: 'faculty-1',
    invitationId: 'invite-release',
    facultyId: 'faculty-1',
    recipientEmailHash,
    now: new Date('2026-08-09T13:05:00Z'),
  });
  record = transitionRecommendationCase(record, {
    actorId: 'faculty-1',
    toStatus: 'faculty_review',
    now: new Date('2026-08-09T13:10:00Z'),
  });
  if (finalDocument === null) return record;
  return setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    draftText: 'FACULTY PRIVATE DRAFT',
    finalDocument,
    documentState,
    facultyApproval,
    now: new Date('2026-08-09T14:30:00Z'),
  });
}

function studentSees(record) {
  return projectCaseForActor({
    actor: { id: record.studentId, role: 'student' },
    caseRecord: record,
    entitlement: eligible(record.studentId),
    now: RELEASE_AT,
  }).finalDocument;
}

function release(record, overrides = {}) {
  return releaseFinalDocument(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    caseId: record.id,
    documentId: 'document-1',
    expectedRevision: record.revision,
    now: RELEASE_AT,
    ...overrides,
  });
}

test('releasedToStudentAt is not writable through faculty content and cannot be forged into the aggregate', () => {
  // The exact call that used to grant a student sight of an unapproved letter.
  const record = releasableCase({
    documentState: undefined,
    facultyApproval: undefined,
    finalDocument: {
      id: 'document-1',
      text: FINAL_TEXT,
      releasedToStudentAt: '2026-08-09T14:00:00.000Z',
    },
  });
  assert.equal(record.facultyPrivate.finalDocument.releasedToStudentAt, null);
  assert.equal(record.finalDocumentState.release, null);
  assert.equal(studentSees(record), null, 'a content write must never grant student visibility');

  // Shape is now validated, so unknown or mistyped document fields cannot ride along.
  assert.throws(
    () => setFacultyPrivateContent(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      finalDocument: { id: 'document-1', text: FINAL_TEXT, smuggled: 'ARBITRARY' },
      now: RELEASE_AT,
    }),
    ValidationError,
  );
  assert.throws(
    () => setFacultyPrivateContent(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      finalDocument: { id: 'document-1', text: { nested: 'not a string' } },
      now: RELEASE_AT,
    }),
    ValidationError,
  );
  assert.throws(
    () => setFacultyPrivateContent(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      finalDocument: { id: 'document-1', text: FINAL_TEXT },
      documentState: 'released_to_student',
      now: RELEASE_AT,
    }),
    ValidationError,
    'the domain must not accept invented wording states',
  );
  assert.throws(
    () => setFacultyPrivateContent(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      finalDocument: null,
      documentState: 'faculty_final',
      facultyApproval: approvalFixture(),
      now: RELEASE_AT,
    }),
    ValidationError,
    'approval cannot exist without a document to approve',
  );

  // And a record forged around the domain - the shape a compromised store or a hand-built row
  // could produce - is rejected outright, because student visibility is a pure mirror of release.
  const forged = structuredClone(record);
  forged.facultyPrivate.finalDocument.releasedToStudentAt = '2026-08-09T14:00:00.000Z';
  assert.throws(
    () => assertRecommendationCase(forged),
    /releasedToStudentAt must mirror the recorded final-document release/u,
  );
});

test('an approval never survives a rewrite of the wording it attests to', () => {
  const record = releasableCase();
  assert.equal(record.finalDocumentState.documentState, 'faculty_final');
  assert.equal(record.finalDocumentState.facultyApproval.approved, true);

  const edited = setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    finalDocument: { id: 'document-1', text: 'SILENTLY REWORDED LETTER' },
    now: new Date('2026-08-09T14:45:00Z'),
  });
  assert.equal(edited.finalDocumentState.documentState, null);
  assert.equal(edited.finalDocumentState.facultyApproval, null);
  assert.throws(
    () => release(edited, { expectedRevision: edited.revision }),
    /Only faculty-final wording may be released/u,
  );

  // An unrelated edit that leaves the wording untouched keeps the attestation.
  const noteOnly = setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    notes: [{ id: 'note-1', text: 'FACULTY PRIVATE NOTE' }],
    now: new Date('2026-08-09T14:45:00Z'),
  });
  assert.equal(noteOnly.finalDocumentState.documentState, 'faculty_final');
  assert.equal(noteOnly.finalDocumentState.facultyApproval.approved, true);
});

test('releaseFinalDocument rejects every invalid release', () => {
  const record = releasableCase();

  assert.throws(() => release(record, { caseId: 'case-other' }), DomainInvariantError);
  assert.throws(() => release(record, { caseId: '' }), ValidationError);
  assert.throws(() => release(record, { facultyId: 'faculty-2' }), DomainInvariantError);
  assert.throws(() => release(record, { documentId: 'document-2' }), DomainInvariantError);
  assert.throws(() => release(record, { expectedRevision: 'latest' }), ValidationError);
  assert.throws(() => release(record, { expectedRevision: record.revision - 1 }), StaleRevisionError);
  assert.throws(
    () => release(record, { now: new Date('2026-08-09T11:00:00Z') }),
    /A release cannot predate the waiver decision/u,
  );

  assert.throws(
    () => release(releasableCase({ finalDocument: null })),
    /There is no final document to release/u,
  );
  assert.throws(
    () => release(releasableCase({ documentState: 'ai_proposal' })),
    /Only faculty-final wording may be released/u,
  );
  assert.throws(
    () => release(releasableCase({ facultyApproval: approvalFixture({ approved: false }) })),
    /Faculty approval and signature attestation are required/u,
  );
  assert.throws(
    () => release(releasableCase({ facultyApproval: approvalFixture({ signatureAttested: false }) })),
    /Faculty approval and signature attestation are required/u,
  );
  assert.throws(
    () => release(releasableCase({ finalDocument: { id: 'document-1', text: '   ' } })),
    /An empty final document cannot be released/u,
  );
  assert.throws(
    () => release(releasableCase({ waiverDecided: false })),
    /before the student records a waiver decision/u,
  );
  assert.throws(
    () => release(releasableCase({ waived: true })),
    /A waived final document can never be released/u,
  );

  const cancelled = transitionRecommendationCase(record, {
    actorId: 'faculty-1',
    toStatus: 'cancelled',
    now: new Date('2026-08-09T14:40:00Z'),
  });
  assert.throws(
    () => release(cancelled, { expectedRevision: cancelled.revision }),
    /Terminal recommendation cases are immutable/u,
  );

  // Nothing above may have leaked visibility as a side effect.
  assert.equal(studentSees(record), null);
});

test('a released final document is versioned, waiver-bound, student-visible, and idempotent to re-release', () => {
  const record = releasableCase();
  assert.equal(studentSees(record), null, 'approval alone is not release');

  const released = release(record);
  assert.ok(Object.isFrozen(released));
  assert.equal(released.revision, record.revision + 1);
  assert.equal(released.facultyPrivate.finalDocument.releasedToStudentAt, '2026-08-09T15:00:00.000Z');
  assert.deepEqual(released.finalDocumentState.release, {
    documentHash: finalDocumentContentHash(record.facultyPrivate.finalDocument),
    documentId: 'document-1',
    releasedAt: '2026-08-09T15:00:00.000Z',
    releasedAtRevision: released.revision,
    waiverReceiptId: currentWaiverState(released.waiverReceipts).receiptId,
  });

  const entry = released.versionHistory.at(-1);
  assert.equal(entry.eventType, 'faculty.final_document_released');
  assert.equal(entry.revision, released.revision);
  assert.deepEqual(entry.changedFields, ['facultyPrivate', 'finalDocumentState']);
  assert.equal(released.versionHistory.length, released.revision + 1);
  assert.equal(
    JSON.stringify(released.versionHistory).includes(FINAL_TEXT),
    false,
    'version history stays metadata-only',
  );

  assert.equal(studentSees(released).text, FINAL_TEXT);
  assert.equal(studentSees(released).releasedToStudentAt, '2026-08-09T15:00:00.000Z');

  // Re-release is a replay, not a second mutation - even from the pre-release revision.
  const replayed = release(released, { expectedRevision: released.revision });
  assert.equal(replayed, released);
  const staleReplay = release(released, { expectedRevision: record.revision });
  assert.equal(staleReplay.revision, released.revision);
  assert.equal(staleReplay.versionHistory.length, released.versionHistory.length);
  assert.equal(staleReplay.finalDocumentState.release.releasedAt, '2026-08-09T15:00:00.000Z');

  // A "replay" naming a different document is a re-scope attempt, not a replay.
  assert.throws(
    () => release(released, { documentId: 'document-2', expectedRevision: released.revision }),
    /cannot be re-scoped to a different version/u,
  );
});

test('a post-release edit cannot retroactively change what was released', () => {
  const released = release(releasableCase());
  const releasedHash = released.finalDocumentState.release.documentHash;

  assert.throws(
    () => setFacultyPrivateContent(released, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      finalDocument: { id: 'document-1', text: 'RETROACTIVELY SUBSTITUTED LETTER' },
      now: new Date('2026-08-09T16:00:00Z'),
    }),
    /A released final document and its approval are immutable/u,
  );
  assert.throws(
    () => setFacultyPrivateContent(released, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      documentState: 'ai_proposal',
      now: new Date('2026-08-09T16:00:00Z'),
    }),
    /A released final document and its approval are immutable/u,
  );
  assert.throws(
    () => setFacultyPrivateContent(released, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      facultyApproval: null,
      now: new Date('2026-08-09T16:00:00Z'),
    }),
    /A released final document and its approval are immutable/u,
  );

  // Faculty-private working material stays editable, and the release survives untouched.
  const stillReleased = setFacultyPrivateContent(released, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    notes: [{ id: 'note-2', text: 'POST RELEASE PRIVATE NOTE' }],
    now: new Date('2026-08-09T16:00:00Z'),
  });
  assert.equal(stillReleased.finalDocumentState.release.documentHash, releasedHash);
  assert.equal(stillReleased.facultyPrivate.finalDocument.releasedToStudentAt, '2026-08-09T15:00:00.000Z');
  assert.equal(studentSees(stillReleased).text, FINAL_TEXT);

  // Substituting the wording underneath a release outside the domain fails validation, so the
  // released digest can never end up describing a document the student was never released.
  const forged = structuredClone(released);
  forged.facultyPrivate.finalDocument.text = 'RETROACTIVELY SUBSTITUTED LETTER';
  assert.throws(
    () => assertRecommendationCase(forged),
    /immutably bound to the exact released version/u,
  );
});
