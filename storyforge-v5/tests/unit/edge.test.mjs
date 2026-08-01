import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../../infra/edge/worker.mjs';
import assetAliases from '../../infra/edge/generated-asset-aliases.mjs';

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

  let rawAssetFetches = 0;
  const assetResponse = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge/assets/app.deadbeefcafe.js'),
    {
      ASSETS: {
        fetch: async () => {
          rawAssetFetches += 1;
          return new Response('unexpected');
        },
      },
    },
  );
  assert.equal(assetResponse.status, 404);
  assert.equal(rawAssetFetches, 0);
  assert.equal(assetResponse.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(assetResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.match(assetResponse.headers.get('content-security-policy'), /default-src 'self'/);
});

test('all non-index aliases resolve to exact pinned bytes, MIME, and cache policy while raw paths stay denied', async () => {
  const byPath = new Map();
  for (const entry of Object.values(assetAliases)) {
    const bytes = await readFile(new URL(`../../dist/${entry.path}`, import.meta.url));
    byPath.set(`/${entry.path}`, bytes);
  }
  const assets = {
    fetch: async (request) => {
      const pathname = new URL(request.url).pathname;
      const bytes = byPath.get(pathname);
      return bytes
        ? new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
        : new Response('missing', { status: 404 });
    },
  };

  assert.equal(Object.keys(assetAliases).length, 14);
  for (const [alias, entry] of Object.entries(assetAliases)) {
    const response = await worker.fetch(
      new Request(`https://missionmedinstitute.com/storyforge/_asset/${alias}`),
      { ASSETS: assets },
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, entry.path);
    assert.equal(bytes.length, entry.size, entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
    assert.equal(response.headers.get('content-type'), entry.type, entry.path);
    assert.equal(
      response.headers.get('cache-control'),
      entry.cache === 'immutable'
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      entry.path,
    );

    const raw = await worker.fetch(
      new Request(`https://missionmedinstitute.com/storyforge/${entry.path}`),
      { ASSETS: assets },
    );
    assert.equal(raw.status, 404, entry.path);
    assert.equal(raw.headers.get('cache-control'), 'no-store, max-age=0', entry.path);
  }

  const index = await readFile(new URL('../../dist/index.html', import.meta.url));
  const indexAlias = createHash('sha256').update(index).digest('hex').slice(0, 12);
  const indexAliasResponse = await worker.fetch(
    new Request(`https://missionmedinstitute.com/storyforge/_asset/${indexAlias}`),
    { ASSETS: assets },
  );
  assert.equal(indexAliasResponse.status, 404);
  const rawIndex = await worker.fetch(
    new Request('https://missionmedinstitute.com/storyforge/index.html'),
    { ASSETS: assets },
  );
  assert.equal(rawIndex.status, 404);
});

test('a known alias fails closed when the static binding bytes do not match', async () => {
  const [alias] = Object.keys(assetAliases);
  const response = await worker.fetch(
    new Request(`https://missionmedinstitute.com/storyforge/_asset/${alias}`),
    {
      ASSETS: {
        fetch: async () => new Response('tampered', { status: 200 }),
      },
    },
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
});
