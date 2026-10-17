import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AvatarProvider,
  NullAvatarProvider,
} from '../providers/avatar-provider.mjs';

const REQUIRED_METHODS = [
  'configure',
  'createSession',
  'start',
  'enqueueAudio',
  'attachAudioStream',
  'interrupt',
  'stop',
  'reconnect',
  'health',
  'usage',
  'close',
];

test('AvatarProvider exposes the complete future-provider contract', () => {
  const provider = new AvatarProvider();
  for (const method of REQUIRED_METHODS) {
    assert.equal(typeof provider[method], 'function', `${method} must remain in the provider contract`);
  }
});

test('abstract avatar operations fail explicitly rather than pretending success', async () => {
  const provider = new AvatarProvider();
  for (const method of ['configure', 'createSession', 'start', 'enqueueAudio', 'attachAudioStream', 'interrupt', 'stop', 'reconnect', 'close']) {
    await assert.rejects(provider[method](), /not implemented/);
  }
  assert.throws(() => provider.health(), /not implemented/);
  assert.throws(() => provider.usage(), /not implemented/);
});

test('unavailable avatar provider stays honest and inactive', async () => {
  const reason = 'Avatar integration is outside Y1-Y2-CAM-V6-3401.';
  const provider = new NullAvatarProvider(reason);

  assert.deepEqual(await provider.configure(), { status: 'unavailable', fallback: 'voice-only', reason });
  assert.deepEqual(await provider.createSession(), { status: 'unavailable', fallback: 'voice-only', reason });
  assert.deepEqual(await provider.start(), { status: 'unavailable', fallback: 'voice-only', reason });
  assert.deepEqual(await provider.enqueueAudio(new Uint8Array()), { accepted: false, fallback: 'voice-only', reason });
  assert.deepEqual(await provider.attachAudioStream(null), { accepted: false, fallback: 'voice-only', reason });
  assert.deepEqual(await provider.interrupt(), { interrupted: false, fallback: 'voice-only', reason });
  assert.deepEqual(await provider.reconnect(), { status: 'unavailable', fallback: 'voice-only', reason });
  assert.deepEqual(await provider.stop(), { stopped: true });
  assert.deepEqual(provider.health(), { provider: 'none', status: 'unavailable', available: false, configured: false, mode: null, deliveryProfileId: null, capabilityVersion: null, implemented: false, blockedReason: null, intelligenceOwner: null, capabilities: {}, providerAdvertisedCapabilities: {}, fallback: 'voice-only', reason });
  assert.deepEqual(provider.usage(), { provider: 'none', mode: null, usageClass: null, sessions: 0, minutes: 0 });
  assert.deepEqual(await provider.close(), { closed: true });
  assert.equal(provider.closed, true);
});
