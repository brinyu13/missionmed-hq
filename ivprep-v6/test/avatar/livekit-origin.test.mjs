import test from 'node:test';
import assert from 'node:assert/strict';

import {
  providerOriginMatchesConfigured,
  validatedLiveAvatarLiveKitOrigin,
} from '../../avatar/livekit-origin.mjs';

test('accepts only an exact provider-returned LiveKit signaling origin', () => {
  assert.equal(validatedLiveAvatarLiveKitOrigin('wss://example-signal.livekit.cloud/'), 'wss://example-signal.livekit.cloud');
  assert.equal(providerOriginMatchesConfigured(
    'wss://example-signal.livekit.cloud/',
    'wss://example-signal.livekit.cloud',
  ), true);
});

test('rejects globally loosened or credential-bearing signaling endpoints', () => {
  for (const value of [
    'https://example-signal.livekit.cloud',
    'wss://livekit.cloud',
    'wss://example.com',
    'wss://user:pass@example-signal.livekit.cloud',
    'wss://example-signal.livekit.cloud/path',
    'wss://example-signal.livekit.cloud/?token=value',
  ]) assert.throws(() => validatedLiveAvatarLiveKitOrigin(value));
});
