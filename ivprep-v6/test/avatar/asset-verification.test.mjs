import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyLockedLiveAvatarAssets } from '../../avatar/asset-verification.mjs';
import { LIVE_INTERVIEWER_TARGET } from '../../avatar/live-interviewer-target.mjs';

function response(data, { ok = true, status = 200 } = {}) {
  return { ok, status, async json() { return { code: 1000, data }; } };
}

test('authenticated target verification returns only sanitized exact asset evidence and the LITE voice constraint', async () => {
  const calls = [];
  const result = await verifyLockedLiveAvatarAssets({
    apiKey: 'unit-test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith(`/avatars/${LIVE_INTERVIEWER_TARGET.avatarId}`)) return response({
        id: LIVE_INTERVIEWER_TARGET.avatarId, name: LIVE_INTERVIEWER_TARGET.avatarDisplayName,
        type: 'VIDEO', status: 'ACTIVE', is_expired: false,
        preview_url: 'must-not-be-returned', space_id: 'must-not-be-returned',
        default_voice: { id: 'another-provider-default', name: 'Another voice' },
      });
      return response({
        id: LIVE_INTERVIEWER_TARGET.voiceId, name: LIVE_INTERVIEWER_TARGET.voiceDisplayName,
        language: 'en', gender: 'male', description: 'must-not-be-returned', tags: ['must-not-be-returned'],
      });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls.every((call) => call.options.headers['X-API-KEY'] === 'unit-test-key'), true);
  assert.equal(result.avatar.verified, true);
  assert.equal(result.voice.verified, true);
  assert.equal(result.avatar.defaultVoiceMatchesLockedTarget, false);
  assert.equal(result.liteCompatibility.compatible, false);
  assert.equal(JSON.stringify(result).includes('must-not-be-returned'), false);
});

test('target verification fails exact-name mismatches without substituting another asset', async () => {
  const result = await verifyLockedLiveAvatarAssets({
    apiKey: 'unit-test-key',
    fetchImpl: async (url) => url.includes('/avatars/')
      ? response({ id: LIVE_INTERVIEWER_TARGET.avatarId, name: 'Different avatar', is_expired: false })
      : response({ id: LIVE_INTERVIEWER_TARGET.voiceId, name: 'Different voice' }),
  });
  assert.equal(result.avatar.verified, false);
  assert.equal(result.avatar.name, null);
  assert.equal(result.voice.verified, false);
  assert.equal(result.voice.name, null);
});

test('target verification rejects provider envelopes without the documented success code', async () => {
  await assert.rejects(() => verifyLockedLiveAvatarAssets({
    apiKey: 'unit-test-key',
    fetchImpl: async () => ({ ok: true, async json() { return { code: 400, data: {} }; } }),
  }), /did not contain data/i);
});
