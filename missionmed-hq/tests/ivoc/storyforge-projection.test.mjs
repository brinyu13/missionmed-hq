import assert from 'node:assert/strict';
import test from 'node:test';

import { createStoryForgeProjectionSource } from '../../ivoc/storyforge-projection.mjs';

const SESSION_ID = '00000000-0000-4000-8000-000000000042';
const STORY_ID = '33333333-3333-4333-8333-333333333333';
const JWT = 'header.payload.signature';

function projection(subject = 'wp:42', overrides = {}) {
  return {
    projection_id: `storyforge-approved-stories:${subject}`,
    owner_app: 'storyforge', projection_type: 'storyforge.approved_stories', schema_version: '1',
    subject_id: subject, source_version: 'sf-ivoc-123', produced_at: '2026-09-21T01:00:00.000Z',
    authorization: { basis: 'student_consent', consent_ref: 'storyforge:consent-42', scope: ['approved_story_summary'] },
    minimization: { fields_included: ['stories'] },
    payload: { stories: [{
      story_id: STORY_ID, version: '7', consent_state: 'granted', title: 'Night shift turnaround',
      themes: ['teamwork'], summary: 'I clarified roles, closed two safety gaps, and confirmed shared ownership.',
    }] },
    source_receipt: { owner_ref: 'storyforge:wp:42@sf-ivoc-123', hash: 'c'.repeat(64) },
    revocation: { revocable: true },
    ...overrides,
  };
}

function tokenResponse() {
  return new Response(JSON.stringify({
    token: JWT,
    expires_at: Math.floor(Date.now() / 1000) + 120,
    ttl_seconds: 120,
  }), { headers: { 'Content-Type': 'application/json' } });
}

test('server-only token exchange feeds one consented StoryForge projection without browser credentials', async () => {
  const calls = [];
  const source = createStoryForgeProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return calls.length === 1 ? tokenResponse() : new Response(JSON.stringify(projection()));
    },
  });
  const result = await source.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Bearer owner-session-token' });
  assert.equal(result.projection_type, 'storyforge.approved_stories');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://missionmed.example.test/wp-json/missionmed/v1/storyforge/ivoc-token');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer owner-session-token');
  assert.equal(calls[0].options.headers['X-MMED-Consumer'], 'ivoc');
  assert.equal(calls[0].options.headers.Origin, undefined);
  assert.equal(calls[1].url, 'https://missionmed.example.test/storyforge/api/ivoc/projection');
  assert.equal(calls[1].options.headers.Authorization, `Bearer ${JWT}`);
  assert.equal(calls[1].options.headers.Cookie, undefined);
});

test('absent owner projection returns null only after an authorized exchange', async () => {
  let calls = 0;
  const source = createStoryForgeProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => (++calls === 1 ? tokenResponse() : new Response('{}', { status: 404 })),
  });
  assert.equal(await source.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Basic YWJjZGVmZ2hpamtsbW5vcA==' }), null);
  assert.equal(calls, 2);
});

test('missing authority, cross-subject data, and malformed consent fail closed', async () => {
  let called = false;
  const noAuth = createStoryForgeProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async () => { called = true; return tokenResponse(); },
  });
  await assert.rejects(() => noAuth.read({ actor: 'wp:42', sessionId: SESSION_ID }), /authorization_required/u);
  assert.equal(called, false);

  const invalid = createStoryForgeProjectionSource({
    wordPressBase: 'https://missionmed.example.test',
    fetchImpl: async (url) => String(url).includes('ivoc-token')
      ? tokenResponse() : new Response(JSON.stringify(projection('wp:7'))),
  });
  await assert.rejects(
    () => invalid.read({ actor: 'wp:42', sessionId: SESSION_ID, authorization: 'Bearer owner-session-token' }),
    /projection_invalid/u,
  );
});
