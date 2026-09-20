import assert from 'node:assert/strict';
import test from 'node:test';

import { LiveMockStudioCapability } from '../../public/capabilities/live-mock-studio.mjs';

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('default browser fetch keeps its required global receiver', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function boundBrowserFetch() {
    assert.equal(this, globalThis);
    return Promise.resolve(response({ ok: true, data: { appointments: [] } }));
  };
  try {
    const capability = new LiveMockStudioCapability();
    const queue = await capability.adminQueue();
    assert.deepEqual(queue.appointments, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Live Mock Studio projects the Scheduler owner queue without provider secrets', async () => {
  const calls = [];
  const capability = new LiveMockStudioCapability({ fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return response({ ok: true, data: { appointments: [{
      id: 'appt-1', title: 'Friday supervised mock', status: 'completed', meeting_provider: 'webex',
      start_at: '2026-09-20T18:00:00Z', access_token: 'must-not-cross',
    }] } });
  } });
  const queue = await capability.adminQueue();
  assert.equal(calls[0].url, '/api/scheduler/admin/appointments');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.deepEqual(queue.appointments[0], {
    id: 'appt-1', label: 'Friday supervised mock', status: 'completed', provider: 'webex',
    startsAt: '2026-09-20T18:00:00Z', recordingEligible: true,
  });
  assert.doesNotMatch(JSON.stringify(queue), /access_token/u);
});

test('recording readiness exposes availability but never a Webex URL or download authority', async () => {
  const capability = new LiveMockStudioCapability({ fetchImpl: async () => response({ ok: true, data: {
    status: 'ready', has_recording: true, meeting_provider: 'webex', playback_url: 'https://webex.example/private',
    recording: { playback_url: 'https://webex.example/private', download_url: 'https://webex.example/download' },
  } }) });
  const status = await capability.recordingStatus('appt/1');
  assert.equal(status.playbackAvailable, true);
  assert.equal(status.downloadAllowed, false);
  assert.doesNotMatch(JSON.stringify(status), /webex\.example/u);
});

test('owner-declared missing recording remains an unavailable state, not an adapter outage', async () => {
  const capability = new LiveMockStudioCapability({ fetchImpl: async () => response({
    ok: false,
    error: 'scheduler_recording_meeting_missing',
    status: 'unavailable',
    has_recording: false,
  }) });
  const status = await capability.recordingStatus('appt-1');
  assert.equal(status.status, 'unavailable');
  assert.equal(status.playbackAvailable, false);
  assert.equal(status.downloadAllowed, false);
});

test('Scheduler denial fails closed instead of manufacturing Live Mock readiness', async () => {
  const capability = new LiveMockStudioCapability({ fetchImpl: async () => response({ ok: false, error: 'scheduler_admin_required' }, 403) });
  await assert.rejects(capability.adminQueue(), /scheduler_admin_required/u);
});
