import test from 'node:test';
import assert from 'node:assert/strict';
import { previousCompleteLocalDayWindow, runZoomSync } from '../src/workers/zoom-sync.mjs';

test('Zoom daily worker derives an exact Eastern day across daylight-saving time', () => {
  assert.deepEqual(previousCompleteLocalDayWindow({ now: new Date('2026-03-09T12:00:00Z') }), {
    local_day: '2026-03-08',
    window_from: '2026-03-08T05:00:00.000Z',
    window_to: '2026-03-09T04:00:00.000Z',
    time_zone: 'America/New_York',
  });
});

test('Zoom daily worker sends one stable authenticated idempotent window and returns only controls', async () => {
  let observed;
  const result = await runZoomSync({
    env: {
      MISSIONACCOUNTS_INTERNAL_BASE_URL: 'https://missionaccounts.example.test/path-is-ignored',
      MISSIONACCOUNTS_WORKER_TOKEN: 'test-worker-token-at-least-24-characters',
    },
    now: new Date('2026-09-06T13:00:00Z'),
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return new Response(JSON.stringify({ accepted: true, duplicate: false, sessions: 2, source_rows: 41 }), { status: 201 });
    },
  });
  assert.equal(observed.url, 'https://missionaccounts.example.test/api/internal/zoom/sync');
  assert.equal(observed.options.headers.authorization, 'Bearer test-worker-token-at-least-24-characters');
  assert.equal(observed.options.headers['idempotency-key'], 'missionaccounts:zoom:daily:2026-09-05');
  assert.deepEqual(JSON.parse(observed.options.body), {
    window_from: '2026-09-05T04:00:00.000Z',
    window_to: '2026-09-06T04:00:00.000Z',
  });
  assert.deepEqual(result, { accepted: true, mode: 'effective', duplicate: false, local_day: '2026-09-05', sessions: 2, source_rows: 41 });
  assert.doesNotMatch(JSON.stringify(result), /worker-token/);
});

test('Zoom worker can run the provider-only shadow path with a distinct idempotency key', async () => {
  let observed;
  const result = await runZoomSync({
    env: {
      MISSIONACCOUNTS_INTERNAL_BASE_URL: 'https://missionaccounts.example.test',
      MISSIONACCOUNTS_WORKER_TOKEN: 'test-worker-token-at-least-24-characters',
      MISSIONACCOUNTS_ZOOM_WORKER_MODE: 'shadow',
    },
    now: new Date('2026-09-06T13:00:00Z'),
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return new Response(JSON.stringify({ accepted: true, sessions: 2, source_rows: 41 }), { status: 200 });
    },
  });
  assert.equal(observed.url, 'https://missionaccounts.example.test/api/internal/zoom/shadow');
  assert.equal(observed.options.headers['idempotency-key'], 'missionaccounts:zoom:shadow:daily:2026-09-05');
  assert.equal(result.mode, 'shadow');
});

test('Zoom daily worker rejects insecure remote origins and incomplete authentication', async () => {
  await assert.rejects(runZoomSync({
    env: {
      MISSIONACCOUNTS_INTERNAL_BASE_URL: 'http://missionaccounts.example.test',
      MISSIONACCOUNTS_WORKER_TOKEN: 'test-worker-token-at-least-24-characters',
    },
  }), /HTTPS application origin/i);
  await assert.rejects(runZoomSync({
    env: {
      MISSIONACCOUNTS_INTERNAL_BASE_URL: 'https://missionaccounts.example.test',
      MISSIONACCOUNTS_WORKER_TOKEN: 'short',
    },
  }), /worker token is not configured/i);
});
