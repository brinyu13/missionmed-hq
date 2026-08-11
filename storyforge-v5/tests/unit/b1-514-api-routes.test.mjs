import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppServer } from '../../server/app.mjs';

const identity = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
});
const token = 'A'.repeat(43);

async function withServer(options, operation) {
  const server = createAppServer({
    checkHealth: async () => true,
    authorizeRequest: async () => identity,
    storyVersionsService: {
      capability: async () => false,
      list: async () => ({ thirtySecond: null, nnqSetup: null }),
      save: async (_identity, storyId, key, body) => ({ storyId, key, body: body.body }),
      restore: async () => ({ restored: true }),
    },
    inspirationService: {
      capability: async () => false,
      adminCapability: async () => false,
      browse: async (_identity, input) => ({ layout: input.layout, prompts: [] }),
      next: async () => ({ prompt: null }),
      save: async () => ({ id: 'saved' }),
      removeSaved: async () => ({ removed: true }),
      setFavorite: async (_identity, _id, enabled) => ({ favorite: enabled }),
      setPin: async (_identity, _id, position) => ({ pinned: position != null }),
      setPins: async (_identity, promptIds) => ({ promptIds }),
      setLayout: async (_identity, layout) => ({ layout }),
      adminList: async () => ({ prompts: [] }),
      adminValidate: async (_identity, body) => ({ draft: body }),
      adminPublish: async () => ({ prompt: null }),
      adminHistory: async () => ({ history: [] }),
      adminParseBulk: async () => ({ prompts: [], count: 0, persisted: false }),
      adminCommitBulk: async () => ({ prompts: [] }),
      event: async () => ({ recorded: true }),
    },
    requestsService: {
      capability: async () => false,
      guestView: async (guestToken) => ({ guestToken }),
      contribute: async (_token, body) => ({ transcriptLength: body.transcript.length }),
      processWebhook: async () => ({ accepted: true }),
      list: async () => [],
      create: async () => ({ id: 'invitation' }),
      send: async () => ({ dryRun: true }),
      revoke: async () => ({ status: 'revoked' }),
    },
    postmarkService: { verifyWebhook: () => true },
    phaseOneRuntime: {
      flagService: {},
      transcription: { transcribeSegment: async () => ({ text: '' }) },
      recordingsService: {
        saveRecordingVersion: async (_identity, recordingId, storyId) => ({
          recordingId,
          storyId,
          audioAssetId: '44444444-4444-4444-8444-444444444444',
          transcript: 'Voice telling',
        }),
      },
    },
    ...options,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await operation(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('guest contribution routes are token-bounded and bypass JWT only on exact paths', async () => {
  let authorizeCalls = 0;
  await withServer({ authorizeRequest: async () => { authorizeCalls += 1; throw new Error('unexpected auth'); } }, async (origin) => {
    const view = await fetch(`${origin}/api/requests/guest/${token}`);
    assert.equal(view.status, 200);
    assert.equal((await view.json()).guestToken, token);
    const contribution = await fetch(`${origin}/api/requests/guest/${token}/contributions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: 'A story' }),
    });
    assert.equal(contribution.status, 201);
    assert.equal((await contribution.json()).contribution.transcriptLength, 7);
  });
  assert.equal(authorizeCalls, 0);
});

test('webhook requires the bounded signature verifier before service mutation', async () => {
  let mutations = 0;
  await withServer({
    postmarkService: { verifyWebhook: () => false },
    requestsService: {
      capability: async () => false,
      processWebhook: async () => { mutations += 1; },
    },
  }, async (origin) => {
    const response = await fetch(`${origin}/api/webhooks/postmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-StoryForge-Webhook-Signature': 'invalid' },
      body: JSON.stringify({ RecordType: 'Delivery' }),
    });
    assert.equal(response.status, 401);
  });
  assert.equal(mutations, 0);
});

test('authenticated V2 version, Inspiration, and request routes delegate to bounded services', async () => {
  await withServer({}, async (origin) => {
    const browse = await fetch(`${origin}/api/inspiration/browse?layout=list&query=clinical`);
    assert.equal(browse.status, 200);
    assert.deepEqual(await browse.json(), { layout: 'list', prompts: [] });

    const storyId = '22222222-2222-4222-8222-222222222222';
    const version = await fetch(`${origin}/api/stories/${storyId}/versions/thirty_second`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Concise story' }),
    });
    assert.equal(version.status, 200);
    assert.equal((await version.json()).version.key, 'thirty_second');

    const recordingId = '33333333-3333-4333-8333-333333333333';
    const attached = await fetch(`${origin}/api/stories/${storyId}/version-recordings/${recordingId}/attach`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(attached.status, 200);
    assert.deepEqual(await attached.json(), {
      recordingId,
      storyId,
      audioAssetId: '44444444-4444-4444-8444-444444444444',
      transcript: 'Voice telling',
    });

    const invitation = await fetch(`${origin}/api/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(invitation.status, 201);
    assert.equal((await invitation.json()).invitation.id, 'invitation');
  });
});
