import assert from 'node:assert/strict';
import test from 'node:test';

import { SupabaseAdmissionRegistry } from '../../server/providers/supabase-durable-adapter.mjs';

const NOW = Date.parse('2026-08-25T10:00:00.000Z');
const COOKIE_FINGERPRINT = 'a'.repeat(64);

function response(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function restHarness(existing = null) {
  const operations = [];
  return {
    operations,
    rest: {
      async table(name, query, options = {}) {
        operations.push({ name, query, options });
        if (name === 'ivprep_cookie_revocations') return [];
        if (name === 'ivprep_entitlements' && options.method == null) return existing ? [existing] : [];
        return null;
      },
    },
  };
}

function registry({ rest, fetchImpl, founderSubjects = new Set(), adminSubjects = new Set() }) {
  return new SupabaseAdmissionRegistry({
    rest,
    founderSubjects,
    adminSubjects,
    studentCourseIds: new Set([3893]),
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl,
    videoEnabled: true,
    now: () => NOW,
  });
}

test('a WordPress user enrolled in the configured 360 course receives a bounded student entitlement', async () => {
  const { rest, operations } = restHarness();
  const requests = [];
  const admission = registry({
    rest,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return response([{ id: 3893 }]);
    },
  });
  const refreshed = await admission.refreshSubject({
    hqSession: { user: { id: 441, roles: ['subscriber'] }, wpAuthorization: `Basic ${'x'.repeat(24)}` },
    cookieFingerprint: COOKIE_FINGERPRINT,
  });
  assert.equal(refreshed, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/wp-json\/ldlms\/v2\/users\/441\/courses/u);
  assert.match(requests[0].url, /include=3893/u);
  assert.equal(requests[0].options.redirect, 'error');
  const created = operations.find((operation) => operation.options.method === 'POST');
  assert.equal(created.options.body.founder, false);
  assert.equal(created.options.body.voice_enabled, true);
  assert.equal(created.options.body.video_enabled, false);
  assert.equal(admission.entitlementFor('wp:441').revision, 'hosted-3522-matrix-v1');
});

test('an authenticated but non-entitled WordPress user remains denied without a durable write', async () => {
  const { rest, operations } = restHarness();
  const admission = registry({ rest, fetchImpl: async () => response([]) });
  const refreshed = await admission.refreshSubject({
    hqSession: { user: { id: 442, roles: ['subscriber'] }, wpAuthorization: `Bearer ${'y'.repeat(24)}` },
    cookieFingerprint: COOKIE_FINGERPRINT,
  });
  assert.equal(refreshed, false);
  assert.equal(admission.entitlementFor('wp:442'), null);
  assert.equal(operations.some((operation) => ['POST', 'PATCH'].includes(operation.options.method)), false);
});

test('an expired privileged canary entitlement is renewed during admission instead of failing after one day', async () => {
  const { rest, operations } = restHarness({
    subject: 'wp:1',
    revision: 'hosted-3472a-v1',
    founder: true,
    voice_enabled: true,
    video_enabled: true,
    granted_video_seconds: 120,
    expires_at: '2026-08-20T00:00:00.000Z',
  });
  const admission = registry({ rest, fetchImpl: async () => response([]), founderSubjects: new Set(['wp:1']) });
  const refreshed = await admission.refreshSubject({
    hqSession: { user: { id: 1, roles: ['administrator'] }, wpAuthorization: `Basic ${'z'.repeat(24)}` },
    cookieFingerprint: COOKIE_FINGERPRINT,
  });
  assert.equal(refreshed, true);
  const renewed = operations.find((operation) => operation.options.method === 'PATCH');
  assert.equal(renewed.options.body.revision, 'hosted-3522-matrix-v1');
  assert.ok(Date.parse(renewed.options.body.expires_at) > NOW);
  assert.equal(admission.entitlementFor('wp:1').founder, true);
});
