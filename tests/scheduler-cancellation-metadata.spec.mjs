import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemorySchedulerRepository } from '../missionmed-hq/lib/scheduler/persistence.mjs';
import { handleSchedulerApiRoute } from '../missionmed-hq/lib/scheduler/routes.mjs';

const APPOINTMENT_ID = 'qa-cancel-metadata-regression';
const START_AT = '2026-09-20T14:00:00.000Z';
const END_AT = '2026-09-20T14:30:00.000Z';

function studentSession() {
  return {
    supabaseUserId: 'student-a',
    csrfToken: 'csrf-token',
    user: {
      id: 101,
      wpUserId: 101,
      email: 'student-a@example.test',
      login: 'student-login',
      displayName: 'Student A',
      roles: ['student'],
    },
  };
}

function cancellationRepository() {
  const repository = createMemorySchedulerRepository({
    seed: {
      appointmentTypes: [],
      providers: [{ id: 'provider-a', active: true, status: 'active' }],
    },
  });
  repository.store.appointments.push({
    id: APPOINTMENT_ID,
    student_user_id: 'student-a',
    student_wp_user_id: 101,
    provider_id: 'provider-a',
    appointment_type_id: 'missing-appointment-type',
    start_at: START_AT,
    end_at: END_AT,
    timezone: 'America/New_York',
    status: 'booked',
    metadata: null,
  });
  return repository;
}

async function callCancel(repository, idempotencyKey) {
  const response = {
    status: null,
    payload: null,
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(bodyText = '') {
      this.body = bodyText;
    },
  };
  const session = studentSession();
  const request = {
    method: 'POST',
    headers: { 'x-mmhq-csrf': session.csrfToken },
  };

  await handleSchedulerApiRoute(
    request,
    response,
    new URL('/api/scheduler/cancel', 'http://scheduler.test'),
    {
      session,
      authHeaders: {},
      schedulerRepository: repository,
      readJsonBody: async () => ({
        appointment_id: APPOINTMENT_ID,
        idempotency_key: idempotencyKey,
      }),
      validateCsrf: (req, authSession) => req.headers['x-mmhq-csrf'] === authSession?.csrfToken,
      sendJson(res, status, payload, headers = {}) {
        res.status = status;
        res.payload = payload;
        res.headers = headers;
      },
      sendMethodNotAllowed(res, methods) {
        res.status = 405;
        res.payload = { ok: false, error: 'method_not_allowed', methods };
      },
    },
  );
  return response;
}

test('cancel succeeds when appointment and appointment type metadata are null or unavailable', async () => {
  const repository = cancellationRepository();
  const response = await callCancel(repository, 'cancel-metadata-null-first');

  assert.equal(response.status, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.data.result.appointment.status, 'canceled');
  assert.equal(response.payload.data.integrations.meeting.status, 'not_required');
  assert.equal(response.payload.data.integrations.notifications.length, 2);
  assert.equal(repository.store.appointments[0].status, 'canceled');
  assert.equal(repository.store.auditEvents.filter((event) => event.action === 'appointment.canceled').length, 1);
});

test('cancel replay is idempotent and a new-key duplicate fails without additional mutation', async () => {
  const repository = cancellationRepository();
  const idempotencyKey = 'cancel-metadata-null-replay';
  const first = await callCancel(repository, idempotencyKey);
  const auditCount = repository.store.auditEvents.length;
  const notificationCount = repository.store.notifications.length;
  const replay = await callCancel(repository, idempotencyKey);
  const duplicate = await callCancel(repository, 'cancel-metadata-null-duplicate');

  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.payload.data.result.idempotentReplay, true);
  assert.equal(replay.payload.data.integrations.idempotency_replay, true);
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.payload.error, 'appointment_not_cancelable');
  assert.equal(repository.store.appointments[0].status, 'canceled');
  assert.equal(repository.store.auditEvents.length, auditCount);
  assert.equal(repository.store.notifications.length, notificationCount);
});
