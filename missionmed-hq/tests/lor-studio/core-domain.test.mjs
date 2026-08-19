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
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  builderProgress,
  completeBuilderStep,
  createRecommendationCase,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import {
  createConsentReceipt,
  createWaiverReceipt,
  currentWaiverState,
} from '../../lor-studio/domain/receipts.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
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
