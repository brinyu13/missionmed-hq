import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { createIvocHandler } from '../../ivoc/routes.mjs';

class ResponseCapture {
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  end(body = '') { this.body = String(body); }
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
  return {
    inserts,
    single: async () => null,
    request: async (path) => path.startsWith('ivoc_sessions?owner_subject=eq.wp%3A42') ? [] : [],
    insert: async (table, body) => {
      inserts.push({ table, body });
      if (table === 'ivoc_sessions') return { id: '00000000-0000-4000-8000-000000000042', ...body, started_at: new Date().toISOString(), created_at: new Date().toISOString() };
      return { id: 1, ...body };
    },
    update: async () => null,
  };
}

function handler(repo = repository()) {
  return { repo, route: createIvocHandler({
    registry: registry(), repository: repo,
    storage: { createUpload: () => { throw new Error('not used'); }, validateUploadToken: () => false, signedUrl: () => ({}) },
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
    duration_ms: 12_000, sealed_at: new Date().toISOString(), created_at: new Date().toISOString(),
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

test('recording media upload is same-origin proxied without exposing the private object key', async () => {
  const recordingId = '00000000-0000-4000-8000-000000000099';
  const bytes = Buffer.from('private-media-bytes');
  const recording = {
    id: recordingId, session_id: foreignSessionId, owner_subject: 'wp:42', status: 'uploading',
    storage_object_key: 'dboc-iv/wp_42/ivoc/private.webm', mime_type: 'video/webm', created_at: new Date().toISOString(),
  };
  const repo = repository();
  repo.single = async (path) => path.startsWith(`ivoc_recordings?id=eq.${recordingId}`) ? recording : null;
  const forwarded = [];
  const route = createIvocHandler({
    registry: registry(), repository: repo,
    storage: {
      createUpload: () => { throw new Error('not used'); },
      validateUploadToken: ({ recordingId: id, uploadToken, expiresAtMs }) => id === recordingId && uploadToken === 'opaque-token' && expiresAtMs > Date.now(),
      signedUrl: () => ({ url: 'https://media.test/dboc-iv/private?x-dboc-signature=sig&x-dboc-expires=9999999999999' }),
    },
    fetchImpl: async (url, options) => { forwarded.push({ url: String(url), options }); return { ok: true }; },
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
  assert.equal(forwarded.length, 1);
  assert.match(forwarded[0].url, /part=1&parts=1/u);
  assert.equal(forwarded[0].options.headers['Content-Range'], `bytes 0-${bytes.length - 1}/${bytes.length}`);
  assert.doesNotMatch(response.body || '', /storage_object_key|dboc-iv/u);
});
