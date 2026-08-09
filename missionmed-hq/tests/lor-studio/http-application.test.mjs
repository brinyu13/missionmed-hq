import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { StaticEntitlementTestAdapter, MetadataOnlyEventBuffer } from '../../lor-studio/adapters/test-adapters.js';
import { createLorApplicationAdapter } from '../../lor-studio/http/application-adapter.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';

function eligible(studentId) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
  };
}

function harness() {
  const repository = new InMemoryRecommendationCaseRepository();
  const entitlementPort = new StaticEntitlementTestAdapter([eligible('student-1'), eligible('student-2')]);
  const eventSink = new MetadataOnlyEventBuffer();
  const service = new RecommendationCaseService({
    repository,
    entitlementPort,
    eventSink,
    requireCanary: true,
    clock: () => new Date('2026-08-09T16:00:00.000Z'),
  });
  const adapter = createLorApplicationAdapter({
    caseService: service,
    repository,
    allowNonDurableForTests: true,
  });
  return { adapter, eventSink, repository };
}

function request(method, body = null, headers = {}) {
  const stream = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = {
    ...(body === null ? {} : { 'content-type': 'application/json' }),
    ...headers,
  };
  return stream;
}

async function call(adapter, pathname, { method = 'GET', body = null, actor = { id: 'student-1', role: 'student' }, key = '' } = {}) {
  const headers = key ? { 'idempotency-key': key } : {};
  return adapter.handleRequest({
    request: request(method, body, headers),
    url: new URL(pathname, 'https://hq.example.test'),
    actor,
  });
}

test('application adapter refuses non-durable persistence without an explicit test harness', () => {
  const repository = new InMemoryRecommendationCaseRepository();
  assert.throws(
    () => createLorApplicationAdapter({ caseService: {}, repository }),
    /explicit test harness/u,
  );
});

test('in-memory application bootstrap is truthful and cannot enter live mode', async () => {
  const { adapter } = harness();
  assert.deepEqual(await adapter.getBootstrap(), {
    operational: false,
    runtimeMode: 'unavailable',
    storageMode: 'NON_DURABLE_TEST_ONLY',
    providersReady: false,
    capabilities: {
      builder: true,
      autosave: true,
      resume: true,
      versionHistory: true,
      durableStorage: false,
      fullAcceptedFunctionSet: false,
    },
  });
});

test('student case creation, autosave, completion, and resume work end to end with safe projections', async () => {
  const { adapter, eventSink } = harness();
  const created = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'case-1' },
    key: 'create-case-1',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.case.caseId, 'case-1');
  assert.equal('facultyPrivate' in created.body.case, false);

  const saved = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: {
      expectedRevision: 0,
      stepId: 'case_basics',
      stepData: { specialty: 'Internal Medicine' },
    },
    key: 'save-case-1-step-1',
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.case.revision, 1);
  assert.equal('facultyPrivate' in saved.body.case, false);

  const completed = await call(adapter, '/api/lor-studio/cases/case-1/builder/complete', {
    method: 'POST',
    body: { expectedRevision: 1, stepId: 'case_basics' },
    key: 'complete-case-1-step-1',
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.case.revision, 2);

  const resumed = await call(adapter, '/api/lor-studio/cases/case-1/builder');
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.progress.completedSteps, 1);
  assert.equal(resumed.body.progress.nextStepId, 'writer_relationship');
  assert.equal('facultyPrivate' in resumed.body.projection, false);
  assert.equal(eventSink.snapshot().length, 3);
});

test('stale writes, idempotency conflicts, IDOR attempts, and unknown fields are safe', async () => {
  const { adapter } = harness();
  await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'case-1' },
    key: 'create-case-1',
  });
  await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'IM' } },
    key: 'save-1',
  });

  const stale = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'FM' } },
    key: 'save-2',
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'stale_revision');
  assert.doesNotMatch(JSON.stringify(stale), /case-1|student-1/u);

  const idempotencyConflict = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'different-case' },
    key: 'create-case-1',
  });
  assert.equal(idempotencyConflict.status, 201, 'idempotency keys are resource-scoped, so another case may reuse a key');

  const denied = await call(adapter, '/api/lor-studio/cases/case-1', {
    actor: { id: 'student-2', role: 'student' },
  });
  const missing = await call(adapter, '/api/lor-studio/cases/does-not-exist');
  assert.equal(denied.status, 404);
  assert.equal(denied.body.error, 'not_found');
  assert.deepEqual(denied.body, missing.body, 'foreign and missing cases must be externally indistinguishable');
  for (const actor of [
    { id: 'faculty-unbound', role: 'faculty' },
    { id: 'mentor-unassigned', role: 'mentor' },
    { id: 'service-ungranted', role: 'service' },
  ]) {
    const actorDenied = await call(adapter, '/api/lor-studio/cases/case-1', { actor });
    assert.equal(actorDenied.status, 404);
    assert.deepEqual(actorDenied.body, missing.body, `${actor.role} denial must not reveal case existence`);
  }

  const unknown = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'case-3', role: 'admin' },
    key: 'create-case-3',
  });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error, 'validation_failed');
});

test('same-resource idempotent retry replays and conflicting payload fails without raw key leakage', async () => {
  const { adapter } = harness();
  const first = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'case-1' },
    key: 'safe-retry-key',
  });
  const replay = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'case-1' },
    key: 'safe-retry-key',
  });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.case.revision, 0);

  const conflict = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'IM' } },
    key: 'builder-retry-key',
  });
  assert.equal(conflict.status, 200);
  const changedRetry = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'FM' } },
    key: 'builder-retry-key',
  });
  assert.equal(changedRetry.status, 409);
  assert.equal(changedRetry.body.error, 'idempotency_conflict');
  assert.doesNotMatch(JSON.stringify(changedRetry), /builder-retry-key/u);
});
