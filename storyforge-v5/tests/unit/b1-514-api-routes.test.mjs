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
      adminReorder: async (_identity, body) => ({ promptIds: body.promptIds }),
      event: async () => ({ recorded: true }),
    },
    requestsService: {
      capability: async () => false,
      guestView: async (guestToken) => ({ guestToken }),
      guestStarted: async () => ({ status: 'started' }),
      contribute: async (_token, body) => ({ transcriptLength: body.transcript.length }),
      processWebhook: async () => ({ accepted: true }),
      list: async () => [],
      create: async () => ({ id: 'invitation' }),
      update: async () => ({ status: 'draft' }),
      preview: async () => ({ preview: { subject: 'Preview' } }),
      guestExperiencePreview: async (_identity, id) => ({ previewOnly: true, invitationId: id }),
      send: async () => ({ dryRun: true }),
      remind: async () => ({ dryRun: true, reminder: true }),
      reinvite: async () => ({ status: 'draft', reinvited: true }),
      revoke: async () => ({ status: 'revoked' }),
      listContributions: async () => [],
      contributionPlayback: async (_identity, id) => ({ contributionId: id, playbackUrl: 'https://audio.example.test/file' }),
      reviewContribution: async (_identity, id, body) => ({
        id,
        studentScore: body.score,
        studentReviewNote: body.note,
        rowVersion: Number(body.expectedVersion) + 1,
      }),
    },
    guestVoiceService: {
      open: async () => ({ recordingId: '33333333-3333-4333-8333-333333333333' }),
      status: async (_token, recordingId) => ({ recordingId, state: 'recording' }),
      addSegment: async (_token, recordingId, segment) => ({ recordingId, seq: Number(segment.seq), created: true }),
      retryTranscription: async (_token, recordingId, seq) => ({ recordingId, seq: Number(seq), queued: true }),
      finish: async () => ({ id: '55555555-5555-4555-8555-555555555555', kind: 'voice' }),
      cancel: async (_token, recordingId) => ({ recordingId, state: 'cancelled' }),
    },
    postmarkService: { verifyWebhook: () => true },
    gatewayIngressVerifier: () => 'a'.repeat(64),
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
    const started = await fetch(`${origin}/api/requests/guest/${token}/started`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(started.status, 200);
    assert.equal((await started.json()).status, 'started');
  });
  assert.equal(authorizeCalls, 0);
});

test('guest voice routes stay token-bounded and preserve the existing multipart segment contract', async () => {
  let authorizeCalls = 0;
  await withServer({ authorizeRequest: async () => { authorizeCalls += 1; throw new Error('unexpected auth'); } }, async (origin) => {
    const opened = await fetch(`${origin}/api/requests/guest/${token}/voice`, { method: 'POST' });
    assert.equal(opened.status, 201);
    const recordingId = (await opened.json()).recordingId;
    const form = new FormData();
    form.set('seq', '0');
    form.set('durationMs', '1000');
    form.set('mimeType', 'audio/webm');
    form.set('segment', new Blob([Buffer.from('voice')], { type: 'audio/webm' }), 'segment.webm');
    const uploaded = await fetch(`${origin}/api/requests/guest/${token}/voice/${recordingId}/segments`, {
      method: 'POST', body: form,
    });
    assert.equal(uploaded.status, 201);
    assert.equal((await uploaded.json()).seq, 0);
    assert.equal((await fetch(`${origin}/api/requests/guest/${token}/voice/${recordingId}`)).status, 200);
    const finished = await fetch(`${origin}/api/requests/guest/${token}/voice/${recordingId}/finish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId: '22222222-2222-4222-8222-222222222222' }),
    });
    assert.equal(finished.status, 201);
    assert.equal((await finished.json()).contribution.kind, 'voice');
    assert.equal((await fetch(`${origin}/api/requests/guest/${token}/voice/${recordingId}`, { method: 'DELETE' })).status, 200);
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

    for (const operation of ['update', 'preview', 'send', 'remind', 'reinvite', 'revoke']) {
      const response = await fetch(`${origin}/api/requests/${storyId}/${operation}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      assert.equal(response.status, 200, operation);
    }
    const contributionAudio = await fetch(`${origin}/api/requests/contributions/${storyId}/audio`);
    assert.equal(contributionAudio.status, 200);
    assert.equal((await contributionAudio.json()).contributionId, storyId);
    const contributionReview = await fetch(`${origin}/api/requests/contributions/${storyId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 2, score: 5, note: 'A vivid candidate.' }),
    });
    assert.equal(contributionReview.status, 200);
    assert.deepEqual(await contributionReview.json(), {
      id: storyId,
      studentScore: 5,
      studentReviewNote: 'A vivid candidate.',
      rowVersion: 3,
    });
    const guestPreview = await fetch(`${origin}/api/requests/${storyId}/guest-preview`);
    assert.equal(guestPreview.status, 200);
    assert.deepEqual(await guestPreview.json(), { previewOnly: true, invitationId: storyId });
  });
});

test('Content Studio reorder route delegates the exact bounded payload', async () => {
  const promptIds = ['22222222-2222-4222-8222-222222222222'];
  await withServer({}, async (origin) => {
    const response = await fetch(`${origin}/api/admin/console/inspiration/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptIds, expectedVersions: { [promptIds[0]]: 2 } }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).promptIds, promptIds);
  });
});
