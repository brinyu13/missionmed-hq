import test from 'node:test';
import assert from 'node:assert/strict';

import { LiveAvatarBrowserProvider } from '../../public/avatar-provider.mjs';

function response(payload = {}) {
  return { ok: true, async json() { return payload; } };
}

test('a browser audio-stream reader failure interrupts the provider event and clears local ownership', async () => {
  const calls = [];
  const provider = new LiveAvatarBrowserProvider({
    videoContainer: null,
    fetchImpl: async (path, options) => {
      calls.push([path, JSON.parse(options.body)]);
      return response(path.endsWith('/interrupt') ? { interrupted: true } : { accepted: true });
    },
  });
  provider.sessionId = 'browser-session';
  provider.alphaSessionId = 'alpha-session';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      controller.error(new Error('reader-failed'));
    },
  });

  await assert.rejects(provider.attachAudioStream(stream, { eventId: 'stream-failure' }), /reader-failed/);
  assert.equal(calls.some(([path, body]) => path.endsWith('/interrupt') && body.eventId === 'stream-failure'), true);
  assert.equal(provider.activeAudioEventId, null);
});

test('an empty browser audio stream is explicitly cancelled rather than left open', async () => {
  const calls = [];
  const provider = new LiveAvatarBrowserProvider({
    videoContainer: null,
    fetchImpl: async (path, options) => {
      calls.push([path, JSON.parse(options.body)]);
      return response({ interrupted: true });
    },
  });
  provider.sessionId = 'browser-session';
  provider.alphaSessionId = 'alpha-session';

  const result = await provider.attachAudioStream(new ReadableStream({ start(controller) { controller.close(); } }), { eventId: 'empty-stream' });
  assert.equal(result.accepted, false);
  assert.equal(calls.some(([path, body]) => path.endsWith('/interrupt') && body.eventId === 'empty-stream'), true);
  assert.equal(provider.activeAudioEventId, null);
});
