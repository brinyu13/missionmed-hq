import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedFetch } from '../../public/auth.js';

test('a stalled browser request fails with a bounded, truthful unavailable state', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }, { once: true });
  });

  await assert.rejects(
    boundedFetch('https://storyforge.example.test/api/config', {}, 5),
    (error) => (
      error.code === 'request_timeout'
      && error.state === 'access_unavailable'
      && error.status === 503
      && error.message.includes('Return to Matrix')
    ),
  );
});
