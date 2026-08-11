import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createStoryMediaService, storyMediaForceOff } from '../../server/story-media.mjs';
import { storyMediaSpec } from '../../server/storage.mjs';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const server = await readFile(new URL('../../server/app.mjs', import.meta.url), 'utf8');
const storage = await readFile(new URL('../../server/storage.mjs', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../infra/postgres/migrations/20260806190000_b1_512_concrete_configuration_media.sql', import.meta.url), 'utf8');

test('story media is default-closed and enforces the approved type and size bounds', () => {
  assert.equal(storyMediaForceOff({}), true);
  assert.equal(storyMediaForceOff({ STORYFORGE_STORY_MEDIA_FORCE_OFF: '0' }), false);
  assert.equal(storyMediaSpec('image/jpeg', 5 * 1024 * 1024).kind, 'photo');
  assert.equal(storyMediaSpec('video/webm', 50 * 1024 * 1024).kind, 'video');
  assert.throws(() => storyMediaSpec('image/svg+xml', 100), { code: 'unsupported_story_media_format' });
  assert.throws(() => storyMediaSpec('image/png', (5 * 1024 * 1024) + 1), { code: 'invalid_story_media_size' });
});

test('story media verification checks actual file signatures before private promotion', () => {
  assert.match(storage, /validStoryMediaSignature/);
  assert.match(storage, /89504e470d0a1a0a/);
  assert.match(storage, /66747970/);
  assert.match(storage, /Range: 'bytes=0-31'/);
  assert.match(storage, /storyforge-media\/pending\//);
  assert.match(storage, /targetObjectKey = `storyforge-media\//);
});

test('story media service rejects non-students for mutation and keeps signed reads server-authorized', async () => {
  const fakeStorage = {
    spec: storyMediaSpec,
    createUpload: async () => ({}),
    verifyUpload: async () => ({}),
    promoteObject: async () => ({}),
    signPlayback: async () => ({}),
    deleteObject: async () => {},
  };
  const service = createStoryMediaService({
    environment: { STORYFORGE_STORY_MEDIA_FORCE_OFF: '0' },
    withIdentity: async (_identity, operation) => operation({ query: async () => ({ rows: [] }) }),
    storage: fakeStorage,
  });
  await assert.rejects(
    service.allocate({ eligible: true, role: 'admin' }, { storyId: crypto.randomUUID(), mimeType: 'image/png', byteSize: 10 }),
    (error) => error.code === 'student_required' && error.status === 403,
  );
  assert.match(server, /storyMediaService\.playback\(identity, mediaId\)/);
  assert.match(server, /Cache-Control', 'no-store, private'/);
});

test('dual-access Founder reads owned private media in student mode while application admins use admin mode', async () => {
  const adminModes = [];
  const fakeStorage = {
    spec: storyMediaSpec,
    createUpload: async () => ({}),
    verifyUpload: async () => ({}),
    promoteObject: async () => ({}),
    signPlayback: async () => ({}),
    deleteObject: async () => {},
  };
  const service = createStoryMediaService({
    environment: { STORYFORGE_STORY_MEDIA_FORCE_OFF: '0' },
    withIdentity: async (_identity, operation, options) => {
      adminModes.push(options?.adminMode);
      return operation({ query: async () => ({ rows: [{ media: [] }] }) });
    },
    storage: fakeStorage,
  });

  await service.list({ eligible: true, role: 'student', wordpressAdmin: true }, crypto.randomUUID());
  await service.list({ eligible: true, role: 'admin', wordpressAdmin: true }, crypto.randomUUID());

  assert.deepEqual(adminModes, [false, true]);
});

test('private media UI provides upload progress, cancel, retry, caption, reorder, remove, and signed refresh', () => {
  for (const marker of [
    'storyMediaUploadForm', 'data-story-media-progress', 'data-story-media-cancel',
    'data-story-media-retry', 'data-story-media-meta', 'data-story-media-move',
    'data-story-media-remove', 'storyMediaPlayback',
  ]) assert.match(app, new RegExp(marker));
});

test('story media tables force RLS and preserve private, archived, admin, and deletion-intent boundaries', () => {
  assert.match(migration, /ALTER TABLE public\.sf_story_media FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.sf_story_media_deletion_intents FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /story\.archived_at IS NULL/);
  assert.match(migration, /story\.status <> 'private'/);
  assert.match(migration, /sf_admin_console_enabled\(\)/);
  assert.match(migration, /sf_mentor_assignments/);
  assert.match(migration, /sf_story_media_open_delete_idx/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.sf_story_media FROM PUBLIC, anon, authenticated/);
});
