import assert from 'node:assert/strict';
import test from 'node:test';

import { createCollaborationService } from '../../server/collaboration.mjs';
import { createAdminConsoleService } from '../../server/admin-console.mjs';

const STUDENT = { sub: '11111111-1111-4111-8111-111111111111', role: 'student', eligible: true };
const STORY = '22222222-2222-4222-8222-222222222222';
const PEER = '33333333-3333-4333-8333-333333333333';
const GRANT = '44444444-4444-4444-8444-444444444444';

test('collaboration capabilities default closed before database access', async () => {
  let called = false;
  const service = createCollaborationService({
    withIdentity: async () => { called = true; },
    environment: {},
  });
  assert.deepEqual(await service.capabilities(STUDENT), {
    storyArchive: false, peerShare: false, storyPromotions: false, perUseScoring: false,
  });
  assert.equal(called, false);
  assert.throws(() => service.share(STUDENT, STORY, { recipientIds: [PEER], expectedVersion: 0 }), /disabled/);
});

test('collaboration validates exact peer ids and delegates only bounded RPCs', async () => {
  const calls = [];
  const withIdentity = async (_identity, operation) => operation({
    async query(sql, values = []) {
      calls.push([sql, values]);
      if (sql.includes('sf_peer_audio_claim')) {
        return { rows: [{ payload: {
          audioId: STORY, objectKey: 'private/object', contentType: 'audio/webm', durationMs: 1000, byteSize: 3,
        } }] };
      }
      return { rows: [{ payload: { ok: true } }] };
    },
  });
  const service = createCollaborationService({
    withIdentity,
    signPlayback: async ({ objectKey }) => {
      assert.equal(objectKey, 'private/object');
      return { playbackUrl: 'https://audio.example.test/signed', expiresIn: 300 };
    },
    environment: {
      STORYFORGE_STORY_ARCHIVE_FORCE_OFF: '0',
      STORYFORGE_PEER_SHARE_FORCE_OFF: '0',
      STORYFORGE_STORY_PROMOTIONS_FORCE_OFF: '0',
      STORYFORGE_PER_USE_SCORING_FORCE_OFF: '0',
    },
  });
  await service.setCollection(STUDENT, STORY, 'trashed', 4);
  await service.share(STUDENT, STORY, { recipientIds: [PEER], expectedVersion: 4, confirmPrivate: true });
  await service.revoke(STUDENT, GRANT);
  await service.feedback(STUDENT, GRANT, { body: 'Bounded feedback.' });
  const playback = await service.playback(STUDENT, GRANT);
  assert.equal(playback.playbackUrl, 'https://audio.example.test/signed');
  assert.equal(Object.hasOwn(playback, 'objectKey'), false);
  assert.ok(calls.every(([sql]) => /sf_(set_story_collection|peer_share_story|peer_revoke_grant|peer_add_feedback|peer_audio_claim)/.test(sql)));
  assert.throws(() => service.share(STUDENT, STORY, { recipientIds: ['username'], expectedVersion: 0 }), /not valid/);
  assert.throws(() => service.share(STUDENT, STORY, { recipientIds: [PEER, PEER], expectedVersion: 0 }), /only be selected once/);
});

test('administrator collection controls use a bounded admin-mode RPC and fail closed', async () => {
  const calls = [];
  const identity = { ...STUDENT, wordpressAdmin: true };
  const withIdentity = async (_identity, operation, options = {}) => operation({
    async query(sql, values = []) {
      calls.push({ sql, values, options });
      if (sql.includes('sf_admin_console_enabled')) return { rows: [{ enabled: true }] };
      return { rows: [{ payload: { collection: values[2] } }] };
    },
  });
  const enabled = createAdminConsoleService({
    withIdentity,
    environment: {
      STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
      STORYFORGE_STORY_ARCHIVE_FORCE_OFF: '0',
    },
  });
  assert.deepEqual(await enabled.collection(identity, STORY, {
    collection: 'trashed', expectedVersion: 4,
  }), { collection: 'trashed' });
  const mutation = calls.find(({ sql }) => sql.includes('sf_set_story_collection'));
  assert.deepEqual(mutation.values, [STORY, 4, 'trashed']);
  assert.equal(mutation.options.adminMode, true);
  assert.throws(
    () => enabled.collection(identity, STORY, { collection: 'deleted', expectedVersion: 4 }),
    /not recognized/,
  );
  const closed = createAdminConsoleService({
    withIdentity,
    environment: {
      STORYFORGE_ADMIN_CONSOLE_FORCE_OFF: '0',
      STORYFORGE_STORY_ARCHIVE_FORCE_OFF: '1',
    },
  });
  assert.throws(
    () => closed.collection(identity, STORY, { collection: 'active', expectedVersion: 4 }),
    /runtime kill switch/,
  );
});
