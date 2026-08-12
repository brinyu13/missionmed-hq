import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppServer } from '../../server/app.mjs';

const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111', role: 'student', eligible: true, wpUserId: 101,
});
const ADMIN = Object.freeze({
  sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'admin', eligible: true,
  wordpressAdmin: true, wpUserId: 107,
});
const STORY = '22222222-2222-4222-8222-222222222222';
const PEER = '33333333-3333-4333-8333-333333333333';
const GRANT = '44444444-4444-4444-8444-444444444444';

async function fixture(context) {
  const calls = [];
  const adminConsoleService = {
    reviewStatus: async (...args) => (calls.push(['reviewStatus', ...args]), { id: STORY, status: args[2].status, rowVersion: 5 }),
    useReviews: async (...args) => (calls.push(['useReviews', ...args]), { reviews: [] }),
    promotion: async (...args) => (calls.push(['promotion', ...args]), { active: true }),
    collection: async (...args) => (calls.push(['adminCollection', ...args]), { id: STORY, collection: args[2].collection }),
  };
  const collaborationService = {
    capabilities: async () => ({ storyArchive: true }),
    setCollection: async (...args) => (calls.push(['studentCollection', ...args]), { id: STORY, collection: args[2] }),
    candidates: async (...args) => (calls.push(['candidates', ...args]), [{ id: PEER, displayName: 'Peer' }]),
    inbox: async (...args) => (calls.push(['inbox', ...args]), []),
    outbox: async (...args) => (calls.push(['outbox', ...args]), []),
    share: async (...args) => (calls.push(['share', ...args]), { grants: [{ id: GRANT }] }),
    story: async () => ({ grantId: GRANT }),
    revoke: async (...args) => (calls.push(['revoke', ...args]), { id: GRANT, status: 'revoked' }),
    feedback: async (...args) => (calls.push(['feedback', ...args]), { id: GRANT }),
    playback: async () => ({ playbackUrl: 'https://signed.invalid' }),
  };
  const server = createAppServer({
    authorizeRequest: async (request) => request.headers['x-test-role'] === 'admin' ? ADMIN : STUDENT,
    identityTransaction: async (_identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    phaseOneRuntime: {
      transcription: { available: false, transcribeSegment: async () => { throw new Error('unavailable'); } },
      flagService: { voiceCapture: async () => false },
      recordingsService: {},
    },
    adminConsoleService,
    collaborationService,
    reportError() {},
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { calls, origin: `http://127.0.0.1:${server.address().port}` };
}

async function call(origin, path, { method = 'POST', body, admin = false } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(admin ? { 'x-test-role': 'admin' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test('B1-515 routes preserve separate student, administrator, and peer authority contracts', async (context) => {
  const { calls, origin } = await fixture(context);
  assert.equal((await call(origin, `/api/stories/${STORY}/trash`, { body: { expectedVersion: 4 } })).status, 200);
  assert.equal((await call(origin, `/api/admin/console/stories/${STORY}/collection`, {
    admin: true, body: { collection: 'trashed', expectedVersion: 4 },
  })).status, 200);
  assert.equal((await call(origin, `/api/admin/console/stories/${STORY}/review-status`, {
    admin: true, body: { status: 'awaiting', expectedVersion: 4 },
  })).status, 200);
  assert.equal((await call(origin, `/api/admin/console/stories/${STORY}/use-reviews`, {
    admin: true, body: { expectedVersion: 4, reviews: [{ useId: 'iv', qualifies: true, score: 5 }] },
  })).status, 200);
  assert.equal((await call(origin, `/api/admin/console/stories/${STORY}/promotions/personal-statement`, {
    admin: true, body: { expectedVersion: 4, active: true, confirmReplace: false },
  })).status, 200);
  const candidates = await call(origin, '/api/peer/candidates', { method: 'GET' });
  assert.deepEqual(candidates.body.classmates, [{ id: PEER, displayName: 'Peer' }]);
  assert.deepEqual((await call(origin, '/api/peer/inbox', { method: 'GET' })).body.shares, []);
  assert.deepEqual((await call(origin, '/api/peer/outbox', { method: 'GET' })).body.grants, []);
  assert.equal((await call(origin, `/api/stories/${STORY}/peer-share`, {
    body: { recipientIds: [PEER], expectedVersion: 4, confirmPrivate: true },
  })).status, 201);
  assert.equal((await call(origin, `/api/peer/grants/${GRANT}`, { method: 'DELETE' })).status, 200);

  assert.deepEqual(calls.map(([name]) => name), [
    'studentCollection', 'adminCollection', 'reviewStatus', 'useReviews', 'promotion', 'candidates', 'inbox', 'outbox', 'share', 'revoke',
  ]);
  assert.deepEqual(calls.find(([name]) => name === 'studentCollection').slice(2), [STORY, 'trashed', 4]);
  assert.deepEqual(calls.find(([name]) => name === 'adminCollection')[3], { collection: 'trashed', expectedVersion: 4 });
  assert.deepEqual(calls.find(([name]) => name === 'share')[3], {
    recipientIds: [PEER], expectedVersion: 4, confirmPrivate: true,
  });
});
