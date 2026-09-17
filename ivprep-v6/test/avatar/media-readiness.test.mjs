import test from 'node:test';
import assert from 'node:assert/strict';

import { liveMediaReady, liveMediaState } from '../../public/avatar/media-readiness.mjs';

test('avatar cannot claim live from video alone or from a muted/unplayable audio track', () => {
  assert.equal(liveMediaReady({ videoReady: true }), false);
  assert.equal(liveMediaReady({ videoReady: true, audioReady: true }), false);
  assert.equal(liveMediaState({ videoReady: true, audioReady: true }), 'audio-blocked');
  assert.equal(liveMediaReady({ videoReady: true, audioReady: true, audioPlaybackReady: true }), true);
  assert.equal(liveMediaState({ videoReady: true, audioReady: true, audioPlaybackReady: true }), 'live');
});

test('audio without the synchronized video track remains degraded', () => {
  assert.equal(liveMediaReady({ audioReady: true, audioPlaybackReady: true }), false);
  assert.equal(liveMediaState({ audioReady: true, audioPlaybackReady: true }), 'audio-only-degraded');
});
