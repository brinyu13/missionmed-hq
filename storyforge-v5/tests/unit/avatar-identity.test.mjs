import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAvatarIdentityService,
  resolveAvatarIdentity,
} from '../../server/avatar-identity.mjs';

const identity = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  role: 'student',
  eligible: true,
  firstName: 'Brian',
  name: 'Brian Yu',
  username: 'brinyu',
  avatarThumbnailUrl: 'https://cdn.missionmedinstitute.com/avatars/headshot.webp',
  avatarUrl: 'https://cdn.missionmedinstitute.com/avatars/full.webp',
  activeAvatarId: '55555555-5555-4555-8555-555555555555',
});

const enabledEnvironment = Object.freeze({
  STORYFORGE_AVATAR_IDENTITY_FORCE_OFF: '0',
});

test('Avatar Studio identity is default-off and falls back to initials', () => {
  const result = resolveAvatarIdentity(identity, { enabled: true, environment: {} });
  assert.deepEqual(result, {
    available: false,
    source: 'initials',
    firstName: 'Brian',
    initials: 'B',
    headshotUrl: null,
    fullBodyUrl: null,
    activeAvatarId: null,
  });
});

test('enabled canonical Arena Lobby CDN headshot resolves without creating an avatar service', () => {
  const result = resolveAvatarIdentity(identity, {
    enabled: true,
    environment: enabledEnvironment,
  });
  assert.equal(result.available, true);
  assert.equal(result.source, 'arena_lobby');
  assert.equal(result.headshotUrl, 'https://cdn.missionmedinstitute.com/avatars/headshot.webp');
  assert.equal(result.fullBodyUrl, 'https://cdn.missionmedinstitute.com/avatars/full.webp');
  assert.equal(result.activeAvatarId, identity.activeAvatarId);
});

test('untrusted or absent headshots fail closed to initials', () => {
  const result = resolveAvatarIdentity({
    ...identity,
    avatarThumbnailUrl: 'https://untrusted.example/avatar.webp',
    avatarUrl: 'javascript:alert(1)',
  }, { enabled: true, environment: enabledEnvironment });
  assert.equal(result.available, false);
  assert.equal(result.source, 'initials');
  assert.equal(result.headshotUrl, null);
  assert.equal(result.fullBodyUrl, null);
});

test('relative, credentialed, query-bearing, and unbound Arena assets fail closed', () => {
  for (const patch of [
    { avatarThumbnailUrl: '/avatars/headshot.webp' },
    { avatarThumbnailUrl: 'https://user:pass@cdn.missionmedinstitute.com/avatars/headshot.webp' },
    { avatarThumbnailUrl: 'https://cdn.missionmedinstitute.com/avatars/headshot.webp?token=secret' },
    { activeAvatarId: 'not-a-uuid' },
  ]) {
    assert.equal(resolveAvatarIdentity({ ...identity, ...patch }, {
      enabled: true, environment: enabledEnvironment,
    }).available, false);
  }
});

test('service requires both the kill switch and database feature flag', async () => {
  let queries = 0;
  const service = createAvatarIdentityService({
    environment: enabledEnvironment,
    withIdentity: async (_identity, operation) => operation({
      query: async (sql) => {
        queries += 1;
        assert.match(sql, /avatar_identity/);
        return { rows: [{ enabled: true }] };
      },
    }),
  });
  assert.equal((await service.resolve(identity)).available, true);
  assert.equal(queries, 1);

  const forcedOff = createAvatarIdentityService({
    environment: { STORYFORGE_AVATAR_IDENTITY_FORCE_OFF: '1' },
    withIdentity: async () => { throw new Error('must not query'); },
  });
  assert.equal((await forcedOff.resolve(identity)).available, false);
});

test('feature lookup failure cannot block StoryForge identity', async () => {
  const service = createAvatarIdentityService({
    environment: enabledEnvironment,
    withIdentity: async () => { throw new Error('database unavailable'); },
  });
  const result = await service.resolve(identity);
  assert.equal(result.available, false);
  assert.equal(result.initials, 'B');
});
