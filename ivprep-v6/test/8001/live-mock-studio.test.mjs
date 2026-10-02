import assert from 'node:assert/strict';
import test from 'node:test';

import { LiveMockStudioCapability } from '../../public/capabilities/live-mock-studio.mjs';
import { liveMockRecordingCheckLabel } from '../../public/studio/presentation-view-model.mjs';
import { readFileSync } from 'node:fs';

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

test('manual recording recheck observes owner processing-to-ready without retaining URLs', async () => {
  let checks = 0;
  const capability = new LiveMockStudioCapability({ fetchImpl: async () => {
    checks += 1;
    return response({ status: checks === 1 ? 'processing' : 'ready', has_recording: checks > 1,
      playback_url: checks > 1 ? 'https://webex.example/private' : null });
  } });
  const first = await capability.recordingStatus('appt-1');
  assert.equal(liveMockRecordingCheckLabel(first), 'Recording processing · Check again');
  const second = await capability.recordingStatus('appt-1');
  assert.equal(liveMockRecordingCheckLabel(second), 'Private recording ready · Recheck');
  assert.doesNotMatch(JSON.stringify(second), /webex\.example/u);
  assert.equal(liveMockRecordingCheckLabel(null, { failed: true }), 'Recording check failed · Retry');
});

test('Live Mock check control is restored in finally on success and failure', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf("action.addEventListener('click', async () => {"), source.indexOf('row.append(copy, action)'));
  assert.match(handler, /finally\s*\{[\s\S]*action\.disabled = false/u);
  assert.match(handler, /action\.disabled = true/u);
});

test('student-owned browser teaching guidance is available without Scheduler or provider calls', () => {
  const capability = new LiveMockStudioCapability({ fetchImpl: () => { throw new Error('No owner request needed.'); } });
  const workflow = capability.teachingWorkflow();
  assert.equal(workflow.title, 'Student practice + teacher review');
  assert.equal(workflow.steps.length, 4);
  assert.match(workflow.steps.join(' '), /student signs into their own IVOC account/u);
  assert.match(workflow.steps.join(' '), /Refresh saved attempts/u);
  assert.match(workflow.boundary, /No Webex recording is required/u);
  assert.match(workflow.boundary, /does not capture or save media as another student/u);
  assert.match(workflow.boundary, /not teacher or remote-participant audio/u);
  assert.equal(Object.isFrozen(workflow.steps), true);
});
