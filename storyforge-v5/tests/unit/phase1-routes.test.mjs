import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import { createAppServer } from '../../server/app.mjs';
import { verifyToken } from '../../server/auth.mjs';
import { appendAudit } from '../../server/db.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const recordingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const audioId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const student = Object.freeze({
  sub: studentId,
  role: 'student',
  eligible: true,
  cohort: 'G7',
  wpUserId: 101,
});
const admin = Object.freeze({
  sub: adminId,
  role: 'admin',
  eligible: true,
  cohort: '',
  wpUserId: 102,
});

function runtimeFixture(overrides = {}) {
  const calls = {
    addSegment: [],
    assertVoiceEnabled: [],
    cancel: [],
    create: [],
    deleteAudio: [],
    finish: [],
    get: [],
    retry: [],
    updateFlag: [],
  };
  const flagService = {
    async voiceCapture() {
      return true;
    },
    async assertVoiceEnabled(identity) {
      calls.assertVoiceEnabled.push(identity);
    },
    async getAdminFeatures() {
      return {
        flag: {
          key: 'voice_capture',
          scope: 'off',
          allowlist: [],
          cohorts: [],
        },
        audit: [],
      };
    },
    async updateVoiceCapture(identity, input) {
      calls.updateFlag.push({ identity, input });
      return { key: 'voice_capture', ...input };
    },
    async getVoiceHealth() {
      return {
        windowHours: 24,
        sessionsByState: [{ state: 'recording', count: 1 }],
        errorsByCategory: [],
      };
    },
    ...overrides.flagService,
  };
  const recordingsService = {
    async createRecording(identity) {
      calls.create.push(identity);
      return {
        recordingId,
        segmentPlanMs: [4_000, 15_000],
        caps: { maxSegmentBytes: 5 * 1024 * 1024 },
        created: true,
      };
    },
    async addSegment(identity, id, input) {
      calls.addSegment.push({ identity, id, input });
      return { seq: Number(input.seq), state: 'received', created: true };
    },
    async getRecording(identity, id) {
      calls.get.push({ identity, id });
      return {
        state: 'recording',
        segments: [],
        fullText: '',
        totalDurationMs: 0,
        assembled: false,
      };
    },
    async finishRecording(identity, id, input) {
      calls.finish.push({ identity, id, input });
      return { state: 'finishing' };
    },
    async cancelRecording(identity, id) {
      calls.cancel.push({ identity, id });
      return { state: 'cancelled' };
    },
    async retryTranscription(identity, id, input) {
      calls.retry.push({ identity, id, input });
      return { segments: [] };
    },
    async deleteAudio(identity, id) {
      calls.deleteAudio.push({ identity, id });
      return { state: 'retired' };
    },
    ...overrides.recordingsService,
  };
  return {
    calls,
    phaseOneRuntime: Object.freeze({ flagService, recordingsService }),
  };
}

async function startFixture(context, fixture, options = {}) {
  const server = createAppServer({
    authorizeRequest: async (request) => (
      request.headers['x-test-role'] === 'admin' ? admin : student
    ),
    identityTransaction: async (identity, operation) => operation({
      async query(sql) {
        if (String(sql).includes('FROM public.sf_users WHERE id')) {
          return {
            rows: [{
              id: identity.sub,
              wp_user_id: identity.wpUserId,
              display_name: identity.role === 'admin' ? 'Admin' : 'Student',
              role: identity.role,
              eligible: true,
              cohort: identity.cohort,
            }],
          };
        }
        throw new Error(`Unexpected database query in route fixture: ${sql}`);
      },
    }),
    phaseOneRuntime: fixture.phaseOneRuntime,
    reportError() {},
    ...options,
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function json(response) {
  return {
    status: response.status,
    body: await response.json(),
  };
}

test('E1-E6 and E8 mount with bounded multipart decoding and preserve service ownership', async (context) => {
  const fixture = runtimeFixture();
  const origin = await startFixture(context, fixture);

  const opened = await json(await fetch(`${origin}/api/recordings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }));
  assert.equal(opened.status, 201);
  assert.equal(opened.body.recordingId, recordingId);

  const form = new FormData();
  form.set('seq', '7');
  form.set('durationMs', '4000');
  form.set('segment', new Blob([Buffer.from('voice-bytes')], {
    type: 'audio/webm;codecs=opus',
  }), 'seg-00007.webm');
  const accepted = await json(await fetch(`${origin}/api/recordings/${recordingId}/segments`, {
    method: 'POST',
    body: form,
  }));
  assert.deepEqual(accepted, {
    status: 201,
    body: { seq: 7, state: 'received', created: true },
  });
  assert.equal(fixture.calls.addSegment[0].id, recordingId);
  assert.equal(fixture.calls.addSegment[0].input.mimeType, 'audio/webm;codecs=opus');
  assert.equal(fixture.calls.addSegment[0].input.buffer.toString(), 'voice-bytes');

  assert.equal((await fetch(`${origin}/api/recordings/${recordingId}`)).status, 200);
  assert.equal((await fetch(`${origin}/api/recordings/${recordingId}/finish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientDurationMs: 4_000 }),
  })).status, 200);
  assert.equal((await fetch(`${origin}/api/recordings/${recordingId}/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })).status, 200);
  assert.equal((await fetch(`${origin}/api/recordings/${recordingId}/retry-transcription`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seq: 7 }),
  })).status, 200);
  assert.deepEqual(await (await fetch(`${origin}/api/audio/${audioId}`, {
    method: 'DELETE',
  })).json(), { state: 'retired' });

  assert.equal(fixture.calls.get.length, 1);
  assert.deepEqual(fixture.calls.finish[0].input, { clientDurationMs: 4_000 });
  assert.deepEqual(fixture.calls.retry[0].input, { seq: 7 });
  assert.equal(fixture.calls.cancel.length, 1);
  assert.equal(fixture.calls.deleteAudio[0].id, audioId);
});

test('E10 returns only the caller capability and E11 routes preserve admin service checks', async (context) => {
  const fixture = runtimeFixture();
  const origin = await startFixture(context, fixture);

  const session = await json(await fetch(`${origin}/api/session`));
  assert.equal(session.status, 200);
  assert.deepEqual(session.body.capabilities, { voiceCapture: true });
  assert.equal(session.body.user.id, studentId);

  const features = await json(await fetch(`${origin}/api/admin/features`, {
    headers: { 'x-test-role': 'admin' },
  }));
  assert.equal(features.status, 200);
  assert.equal(features.body.flag.scope, 'off');

  const updated = await json(await fetch(`${origin}/api/admin/features/voice_capture`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-role': 'admin',
    },
    body: JSON.stringify({
      scope: 'allowlist',
      allowlist: [studentId],
      cohorts: [],
    }),
  }));
  assert.equal(updated.status, 200);
  assert.equal(updated.body.flag.scope, 'allowlist');
  assert.equal(fixture.calls.updateFlag[0].identity.role, 'admin');
});

test('blocked authority seams fail closed and legacy upload endpoints check the kill gate first', async (context) => {
  const blocked = new Error('Voice capture is currently unavailable.');
  blocked.code = 'voice_disabled';
  blocked.status = 403;
  const healthBlocked = new Error('Approved audit query is unavailable.');
  healthBlocked.code = 'voice_health_audit_unavailable';
  healthBlocked.status = 503;
  const fixture = runtimeFixture({
    flagService: {
      async assertVoiceEnabled() {
        throw blocked;
      },
      async getVoiceHealth() {
        throw healthBlocked;
      },
    },
  });
  const origin = await startFixture(context, fixture);

  const legacy = await json(await fetch(`${origin}/api/audio/presign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      storyId: recordingId,
      contentType: 'audio/webm',
      byteSize: 10,
    }),
  }));
  assert.equal(legacy.status, 403);
  assert.equal(legacy.body.error.code, 'voice_disabled');

  const attached = await json(await fetch(`${origin}/api/stories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'Reviewed transcript',
      recordingId,
    }),
  }));
  assert.equal(attached.status, 503);
  assert.equal(attached.body.error.code, 'assembly_authority_blocked');
  assert.equal(attached.body.error.message, 'StoryForge could not complete this request.');

  const health = await json(await fetch(`${origin}/api/admin/voice/health`, {
    headers: { 'x-test-role': 'admin' },
  }));
  assert.equal(health.status, 503);
  assert.equal(health.body.error.code, 'voice_health_audit_unavailable');
  assert.equal(health.body.error.message, 'StoryForge could not complete this request.');
});

test('segment upload rejects non-multipart input before the recording service', async (context) => {
  const fixture = runtimeFixture();
  const origin = await startFixture(context, fixture);
  const response = await json(await fetch(`${origin}/api/recordings/${recordingId}/segments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }));
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'invalid_multipart');
  assert.equal(fixture.calls.addSegment.length, 0);
});

test('API preflight explicitly permits the privacy DELETE route', async (context) => {
  const fixture = runtimeFixture();
  const origin = await startFixture(context, fixture);
  const response = await fetch(`${origin}/api/audio/${audioId}`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://127.0.0.1:4180' },
  });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-methods'), /DELETE/);
});

test('foreign or missing audio playback is audited and returns the same private 404', async (context) => {
  const fixture = runtimeFixture();
  const audits = [];
  const events = [];
  const origin = await startFixture(context, fixture, {
    identityTransaction: async (identity, operation) => operation({
      async query(sql) {
        if (String(sql).includes('FROM public.sf_audio_assets')) return { rows: [] };
        throw new Error(`Unexpected playback query: ${sql}`);
      },
    }),
    async auditWriter(client, event) {
      audits.push(event);
    },
    reportEvent(event) {
      events.push(event);
    },
  });
  const response = await json(await fetch(`${origin}/api/audio/${audioId}/playback`));
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'P0002');
  assert.deepEqual(audits.map(({ action, entityType, surface }) => ({
    action,
    entityType,
    surface,
  })), [{
    action: 'unauthorized_denied',
    entityType: 'audio_asset',
    surface: 'workspace',
  }]);
  assert.equal(events[0].event, 'unauthorized_denied');
  assert.equal(events[0].assetId, audioId);
});

test('restoring a linked voice draft emits only content-free recovery metadata', async (context) => {
  const fixture = runtimeFixture();
  const events = [];
  const origin = await startFixture(context, fixture, {
    identityTransaction: async (identity, operation) => operation({
      async query(sql) {
        if (String(sql).includes('FROM public.sf_story_drafts')) {
          return {
            rows: [{
              payload: {
                title: 'Private title must not be logged',
                voice: { recordingId },
              },
              row_version: 3,
            }],
          };
        }
        throw new Error(`Unexpected draft query: ${sql}`);
      },
    }),
    reportEvent(event) {
      events.push(event);
    },
  });
  const response = await json(await fetch(`${origin}/api/drafts/story-builder`));
  assert.equal(response.status, 200);
  assert.equal(events[0].event, 'draft_recovered');
  assert.equal(events[0].recordingId, recordingId);
  assert.equal(JSON.stringify(events).includes('Private title'), false);
});

test('JWT verification surfaces a string cohort claim and defaults malformed claims closed', async () => {
  const key = new TextEncoder().encode('phase-one-route-secret-at-least-32-bytes');
  async function token(cohort) {
    return new SignJWT({
      app_role: 'student',
      storyforge_eligible: true,
      wp_user_id: 101,
      cohort,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('phase-one-routes')
      .setAudience('storyforge')
      .setSubject(studentId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti(crypto.randomUUID())
      .sign(key);
  }
  assert.equal((await verifyToken(await token(' G7 '), {
    key,
    issuer: 'phase-one-routes',
    audience: 'storyforge',
  })).cohort, 'G7');
  assert.equal((await verifyToken(await token(['G7']), {
    key,
    issuer: 'phase-one-routes',
    audience: 'storyforge',
  })).cohort, '');
});

test('generic audit helper calls the existing append-only function without content logging', async () => {
  let captured;
  const id = await appendAudit({
    async query(sql, values) {
      captured = { sql, values };
      return { rows: [{ id: '42' }] };
    },
  }, {
    action: 'recording_started',
    entityType: 'recording_session',
    entityId: recordingId,
    surface: 'quick',
    studentId,
    previousValue: null,
    newValue: { state: 'recording' },
  });
  assert.equal(id, '42');
  assert.match(captured.sql, /public\.sf_append_audit/);
  assert.equal(captured.values[0], 'recording_started');
  assert.equal(captured.values[7], null);
  assert.equal(captured.values[8], '{"state":"recording"}');
  assert.equal(JSON.stringify(captured).includes('transcript'), false);
  assert.equal(JSON.stringify(captured).includes('audio bytes'), false);
});

test('generic audit helper fails closed when the service role lacks execute authority', async () => {
  await assert.rejects(
    appendAudit({
      async query() {
        const error = new Error('permission denied for function sf_append_audit');
        error.code = '42501';
        throw error;
      },
    }, {
      action: 'feature_scope_changed',
      entityType: 'feature_flag',
      surface: 'system',
    }),
    (error) => (
      error.code === 'audit_writer_unavailable'
      && error.status === 503
      && !error.message.includes('permission denied')
    ),
  );
});
