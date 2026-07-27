import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../infra/edge/worker.mjs';

test('canonicalizes the slashless StoryForge mount without losing the query', async () => {
  const response = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge?return=library'),
    {},
  );

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/storyforge/?return=library');
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
});

test('canonicalizes repeated slashes before choosing the API or static path', async () => {
  const response = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge//api/session?probe=1'),
    {},
  );

  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/storyforge/api/session?probe=1');
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
});

test('enforces private no-store caching on proxied API success and error responses', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  for (const status of [200, 401]) {
    globalThis.fetch = async () => new Response(
      JSON.stringify(status === 200 ? { ok: true } : { error: { code: 'auth_required' } }),
      {
        status,
        headers: {
          'Cache-Control': 'public, max-age=600',
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    );

    const response = await worker.fetch(
      new Request('https://missionmedinstitute.com/storyforge/api/session'),
      { STORYFORGE_ORIGIN: 'https://storyforge-app.example.test' },
    );

    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal(response.headers.get('pragma'), 'no-cache');
  }
});

test('proxies the exact API root and never caches a missing fingerprinted asset', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let proxiedPath = '';
  let proxiedCookie = null;
  let proxiedAuthorization = null;
  globalThis.fetch = async (request) => {
    proxiedPath = new URL(request.url).pathname;
    proxiedCookie = request.headers.get('cookie');
    proxiedAuthorization = request.headers.get('authorization');
    return new Response(JSON.stringify({ error: { code: 'not_found' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };

  const apiResponse = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge/api', {
      headers: {
        Authorization: 'Bearer signed-storyforge-token',
        Cookie: 'wordpress_logged_in=sensitive-session-cookie',
      },
    }),
    { STORYFORGE_ORIGIN: 'https://storyforge-app.example.test' },
  );
  assert.equal(proxiedPath, '/api');
  assert.equal(proxiedCookie, null);
  assert.equal(proxiedAuthorization, 'Bearer signed-storyforge-token');
  assert.equal(apiResponse.status, 404);
  assert.equal(apiResponse.headers.get('cache-control'), 'no-store, private');

  const assetResponse = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge/assets/app.deadbeefcafe.js'),
    {
      ASSETS: {
        fetch: async () => new Response('missing', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      },
    },
  );
  assert.equal(assetResponse.status, 404);
  assert.equal(assetResponse.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(assetResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.match(assetResponse.headers.get('content-security-policy'), /default-src 'self'/);
});

test('self-hosted fingerprinted fonts are immutable while license notices are not', async () => {
  const assets = {
    fetch: async (request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname.endsWith('.woff2')) {
        return new Response('font-binary', {
          status: 200,
          headers: { 'Content-Type': 'font/woff2' },
        });
      }
      return new Response('SIL Open Font License', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    },
  };

  const font = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge/assets/fonts/archivo-normal.7150c0ec5ad3.woff2'),
    { ASSETS: assets },
  );
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const license = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge/assets/fonts/OFL-Archivo.txt'),
    { ASSETS: assets },
  );
  assert.equal(license.status, 200);
  assert.equal(license.headers.get('cache-control'), 'no-cache');
});
