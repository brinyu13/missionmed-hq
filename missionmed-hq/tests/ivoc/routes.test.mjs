import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { createIvocHandler } from '../../ivoc/routes.mjs';

class ResponseCapture {
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  write(body = '') { this.body = `${this.body || ''}${Buffer.from(body).toString()}`; return true; }
  end(body = '') { this.body = `${this.body || ''}${Buffer.from(body).toString()}`; }
  json() { return this.body ? JSON.parse(this.body) : null; }
}

function request(method = 'GET', body = null, headers = {}) {
  const stream = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = headers;
  return stream;
}

function rawRequest(method, body, headers = {}) {
  const bytes = Buffer.from(body);
  const stream = Readable.from([bytes]);
  stream.method = method;
  stream.headers = { 'content-length': String(bytes.length), ...headers };
  return stream;
}

function session(id = 42, roles = ['student']) {
  return {
    version: 1, issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    csrfToken: 'a'.repeat(24), authSource: 'wordpress-cookie',
    user: { id, roles, displayName: `Student ${id}`, login: `student${id}` },
  };
}

function registry() {
  return {
    refreshSubject: async () => {}, isRevoked: () => false,
    entitlementFor: (subject) => ({ subject, revision: 'test', expiresAtMs: Date.now() + 60_000, voice: true, video: true, founder: false }),
  };
}

function repository() {
  const inserts = [];
  const updates = [];
  return {
    inserts, updates,
    single: async () => null,
    request: async (path) => path.startsWith('ivoc_sessions?owner_subject=eq.wp%3A42') ? [] : [],
    insert: async (table, body) => {
      inserts.push({ table, body });
      if (table === 'ivoc_sessions') return { id: '00000000-0000-4000-8000-000000000042', ...body, started_at: new Date().toISOString(), created_at: new Date().toISOString() };
      return { id: 1, ...body };
    },
    update: async (path, body) => { updates.push({ path, body }); return { ...body }; },
  };
}

function handler(repo = repository()) {
  return { repo, route: createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false },
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64), MMHQ_CIE_BASE: 'https://media.test' },
  }) };
}

const foreignSessionId = '00000000-0000-4000-8000-000000000007';
const foreignRecordingId = '00000000-0000-4000-8000-000000000008';

function scopedRepository({ assigned = false } = {}) {
  const foreign = {
    id: foreignSessionId, owner_subject: 'wp:7', owner_display_name: 'Student 7',
    title: 'Foreign take', session_type: 'question', question_id: 'q1', question_text: 'Tell me about yourself.',
    state: 'saved', started_at: new Date().toISOString(), ended_at: new Date().toISOString(), duration_ms: 12_000,
    interviewer_provider: 'missionmed-static', created_at: new Date().toISOString(),
  };
  const recording = {
    id: foreignRecordingId, session_id: foreignSessionId, owner_subject: 'wp:7', status: 'saved',
    mime_type: 'video/webm', storage_object_key: 'private/never-return-this.webm', size_bytes: 1234,
    duration_ms: 12_000, paused_spans: [{ startMs: 4_000, endMs: 5_500 }],
    sealed_at: new Date().toISOString(), created_at: new Date().toISOString(),
  };
  return {
    single: async (path) => {
      if (path.startsWith(`ivoc_sessions?id=eq.${foreignSessionId}`)) return foreign;
      if (path.startsWith(`ivoc_recordings?session_id=eq.${foreignSessionId}`)) return recording;
      if (path.startsWith(`ivoc_reviews?session_id=eq.${foreignSessionId}`)) return assigned ? { id: 'review-1', status: 'assigned', mentor_subject: 'wp:42' } : null;
      return null;
    },
    request: async () => [],
    insert: async (table, body) => ({ id: 1, ...body }),
    update: async () => null,
  };
}

const base = {
  cookieFingerprint: 'f'.repeat(64), hqSessionMaxTtlSeconds: 28_800, expectedOrigin: 'https://hq.test',
};

test('anonymous API request fails closed', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL('https://hq.test/api/ivoc/v1/bootstrap'), hqSession: null });
  assert.equal(response.status, 401);
  assert.equal(response.json().error, 'ivprep_authentication_required');
});

test('entitled owner bootstraps without exposing credentials', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL('https://hq.test/api/ivoc/v1/bootstrap'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.equal(response.json().identity.subject, 'wp:42');
  assert.equal(response.json().csrfToken, 'a'.repeat(24));
  assert.ok(!/service|secret|objectKey/u.test(response.body));
});

test('session creation requires same-origin CSRF and persists server identity', async () => {
  const { route, repo } = handler();
  const denied = new ResponseCapture();
  await route({ ...base, request: request('POST', { title: 'Take' }, { origin: 'https://hq.test' }), response: denied, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session() });
  assert.equal(denied.status, 403);

  const allowed = new ResponseCapture();
  await route({ ...base, request: request('POST', { title: 'Take', sessionType: 'question' }, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }), response: allowed, url: new URL('https://hq.test/api/ivoc/v1/sessions'), hqSession: session() });
  assert.equal(allowed.status, 201);
  assert.equal(repo.inserts.find((row) => row.table === 'ivoc_sessions').body.owner_subject, 'wp:42');
});

test('results preserve explicit duration vocabulary while the library duration follows playable media', async () => {
  const repo = repository();
  const sessionId = '00000000-0000-4000-8000-000000000042';
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)) return { id: sessionId, owner_subject: 'wp:42' };
    if (path.startsWith(`ivoc_results?session_id=eq.${sessionId}`)) return null;
    return null;
  };
  const { route } = handler(repo);
  const response = new ResponseCapture();
  const resultEnvelope = {
    schema: 'ivoc.analytics.v1', schemaVersion: 1,
    durationMs: 25_000, sessionDurationMs: 41_000, recordingDurationMs: 25_000,
    playableDurationMs: 24_500, activeAnsweringDurationMs: 18_000,
    analyticsObservationDurationMs: 39_500,
    recordingStartSessionMs: 8_000,
    pausedSpans: [{ startMs: 11_000, endMs: 13_000 }],
    scores: { pace: 7.4, volume: 7.8, variety: 8.1 }, counters: { gestures: 4 }, history: [],
  };
  await route({
    ...base,
    request: request('POST', resultEnvelope, { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/sessions/${sessionId}/results`),
    hqSession: session(),
  });
  assert.equal(response.status, 200);
  const resultInsert = repo.inserts.find((entry) => entry.table === 'ivoc_results');
  assert.deepEqual(resultInsert.body.summary.durations, {
    sessionDurationMs: 41_000,
    recordingDurationMs: 25_000,
    playableDurationMs: 24_500,
    activeAnsweringDurationMs: 18_000,
    analyticsObservationDurationMs: 39_500,
  });
  assert.equal(resultInsert.body.payload.recordingStartSessionMs, 8_000);
  assert.deepEqual(resultInsert.body.payload.pausedSpans, [{ startMs: 11_000, endMs: 13_000 }]);
  const sessionUpdate = repo.updates.find((entry) => entry.path.startsWith(`ivoc_sessions?id=eq.${sessionId}`));
  assert.equal(sessionUpdate.body.duration_ms, 24_500);
});

test('student cannot read another student session', async () => {
  const { route } = handler(scopedRepository());
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session() });
  assert.equal(response.status, 404);
  assert.equal(response.json().error, 'not_found');
});

test('assigned mentor can read results without receiving the private object key', async () => {
  const { route } = handler(scopedRepository({ assigned: true }));
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['mentor']) });
  assert.equal(response.status, 200);
  assert.equal(response.json().recording.id, foreignRecordingId);
  assert.equal(response.json().ownerDisplayName, 'Student 7');
  assert.deepEqual(response.json().recording.pausedSpans, [{ startMs: 4_000, endMs: 5_500 }]);
  assert.equal(response.json().reviewStatus, 'assigned');
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('administrator can read any session without receiving the private object key', async () => {
  const { route } = handler(scopedRepository());
  const response = new ResponseCapture();
  await route({ ...base, request: request('GET'), response, url: new URL(`https://hq.test/api/ivoc/v1/sessions/${foreignSessionId}`), hqSession: session(42, ['administrator']) });
  assert.equal(response.status, 200);
  assert.doesNotMatch(response.body, /storage_object_key|never-return-this/u);
});

test('authenticated UI response carries camera, microphone, and font policy', async () => {
  const { route } = handler();
  const response = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response, url: new URL('https://hq.test/iv-prep-analytics/'), hqSession: session() });
  assert.equal(response.status, 200);
  assert.match(response.headers['Permissions-Policy'], /camera=\(self\).*microphone=\(self\)/u);
  assert.match(response.headers['Content-Security-Policy'], /fonts\.googleapis\.com.*fonts\.gstatic\.com/u);
});

test('authenticated UI serves the frozen design tokens and arena art with exact MIME types', async () => {
  const { route } = handler();
  const tokens = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response: tokens, url: new URL('https://hq.test/iv-prep-analytics/styles/tokens.css'), hqSession: session() });
  assert.equal(tokens.status, 200);
  assert.equal(tokens.headers['Content-Type'], 'text/css; charset=utf-8');

  const arena = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response: arena, url: new URL('https://hq.test/iv-prep-analytics/assets/arena-world-day.jpg'), hqSession: session() });
  assert.equal(arena.status, 200);
  assert.equal(arena.headers['Content-Type'], 'image/jpeg');

  const scanner = new ResponseCapture();
  await route({ ...base, request: request('HEAD'), response: scanner, url: new URL('https://hq.test/iv-prep-analytics/assets/founder-face-scanner.png'), hqSession: session() });
  assert.equal(scanner.status, 200);
  assert.equal(scanner.headers['Content-Type'], 'image/png');
});

test('recording media upload is same-origin proxied without exposing the private object key', async () => {
  const recordingId = '00000000-0000-4000-8000-000000000099';
  const bytes = Buffer.from('private-media-bytes');
  const recording = {
    id: recordingId, session_id: foreignSessionId, owner_subject: 'wp:42', status: 'uploading',
    storage_object_key: 'ivoc/recordings/wp_42/ivoc_private.webm', mime_type: 'video/webm', etag: 'opaque-upload-state', created_at: new Date().toISOString(),
  };
  const repo = repository();
  repo.single = async (path) => path.startsWith(`ivoc_recordings?id=eq.${recordingId}`) ? recording : null;
  const uploaded = [];
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: {
      createUpload: () => { throw new Error('not used'); },
      validateUploadToken: ({ recordingId: id, uploadToken, expiresAtMs }) => id === recordingId && uploadToken === 'opaque-token' && expiresAtMs > Date.now(),
      uploadPart: async (input) => { uploaded.push({ ...input, body: Buffer.from(input.body) }); return { etag: '"part-etag"', uploadState: 'next-opaque-upload-state' }; },
    },
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64), MMHQ_CIE_BASE: 'https://media.test' },
  });
  const response = new ResponseCapture();
  const expiresAtMs = Date.now() + 60_000;
  await route({
    ...base,
    request: rawRequest('PUT', bytes, {
      origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24),
      'x-ivoc-upload-token': 'opaque-token', 'x-ivoc-upload-expires': String(expiresAtMs),
      'content-type': 'application/octet-stream', 'content-range': `bytes 0-${bytes.length - 1}/${bytes.length}`,
    }),
    response,
    url: new URL(`https://hq.test/api/ivoc/v1/recordings/${recordingId}/media?part=1&parts=1`),
    hqSession: session(),
  });
  assert.equal(response.status, 204);
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].part, 1);
  assert.equal(uploaded[0].parts, 1);
  assert.equal(uploaded[0].body.toString(), bytes.toString());
  assert.equal(repo.updates.at(-1).body.etag, 'next-opaque-upload-state');
  assert.doesNotMatch(response.body || '', /storage_object_key|dboc-iv/u);
});

test('authorized playback remains same-origin and never returns the private object key', async () => {
  const repo = scopedRepository({ assigned: true });
  repo.single = async (path) => {
    if (path.startsWith(`ivoc_recordings?id=eq.${foreignRecordingId}`)) return {
      id: foreignRecordingId, session_id: foreignSessionId, owner_subject: 'wp:7', status: 'saved',
      mime_type: 'video/webm', storage_object_key: 'ivoc/recordings/private/never-return.webm',
    };
    if (path.startsWith(`ivoc_sessions?id=eq.${foreignSessionId}`)) return {
      id: foreignSessionId, owner_subject: 'wp:7', title: 'Foreign take', state: 'saved',
    };
    if (path.startsWith(`ivoc_reviews?session_id=eq.${foreignSessionId}`)) return { id: 'review-1', status: 'assigned', mentor_subject: 'wp:42' };
    return null;
  };
  const storage = {
    createPlayback: () => ({ token: 'opaque-playback-token', expiresAt: '2027-01-15T09:10:00.000Z', expiresAtMs: 1_800_000_600_000, disposition: 'inline' }),
    validatePlaybackToken: ({ playbackToken }) => playbackToken === 'opaque-playback-token',
    fetchObject: async () => new Response('private-media', { headers: { 'Content-Type': 'video/webm', ETag: 'private-etag' } }),
  };
  const route = createIvocHandler({
    registry: registry(), repository: repo, storage,
    env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_SESSION_SECRET: 's'.repeat(64) },
  });
  const linkResponse = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: linkResponse,
    url: new URL(`https://hq.test/api/ivoc/v1/recordings/${foreignRecordingId}/playback-url`),
    hqSession: session(42, ['mentor']),
  });
  assert.equal(linkResponse.status, 200);
  assert.match(linkResponse.json().url, new RegExp(`^/api/ivoc/v1/recordings/${foreignRecordingId}/playback\\?`, 'u'));
  assert.doesNotMatch(linkResponse.body, /storage_object_key|never-return|cloudflarestorage/u);

  const mediaResponse = new ResponseCapture();
  await route({
    ...base, request: request('GET'), response: mediaResponse,
    url: new URL(`https://hq.test/api/ivoc/v1/recordings/${foreignRecordingId}/playback?token=opaque-playback-token&expires=1800000600000&disposition=inline`),
    hqSession: session(42, ['mentor']),
  });
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaResponse.body, 'private-media');
  assert.equal(mediaResponse.headers['Content-Type'], 'video/webm');
});
