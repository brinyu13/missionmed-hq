import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createIvocContextPackResolver } from '../../server/providers/ivoc-context-pack-resolver.mjs';

// Execute the production class (including its real allowlists/request path),
// without importing the unrelated optional LiveKit worker dependency.
const source = readFileSync(new URL('../../server/providers/supabase-durable-adapter.mjs', import.meta.url), 'utf8');
const exactClass = source.slice(source.indexOf("const PRODUCT_PROJECT_REF ="), source.indexOf('export class SupabaseAdmissionRegistry'))
  .replace('export class IvPrepSupabaseRest', 'class IvPrepSupabaseRest');
const IvPrepSupabaseRest = vm.runInNewContext(`${exactClass}\nIvPrepSupabaseRest;`, {
  URL, fetch, AbortController, setTimeout, clearTimeout, console,
});
const REF = 'bscnrgqlwsyygyfrbhfn';
const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function adapter(reply = () => []) {
  const calls = [];
  const rest = new IvPrepSupabaseRest({ url: `https://${REF}.supabase.co`, expectedProjectRef: REF,
    serviceRoleKey: 'fixture-key-not-a-secret'.repeat(2), fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(reply(new URL(url))), { status: 200 });
    } });
  return { rest, calls };
}

test('real context adapter permits exactly GET reads of protected source tables', async () => {
  const { rest, calls } = adapter();
  for (const name of ['ivoc_sessions', 'ivoc_results', 'ivoc_recordings']) {
    const query = `?owner_subject=eq.wp%3A1&session_id=eq.${SESSION}&select=id&limit=1`;
    await rest.table(name, query);
    await rest.table(name, query, { method: 'GET' });
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD', 'get', null]) {
      assert.throws(() => rest.table(name, query, { method }), /not approved/);
    }
    assert.throws(() => rest.table(name, query, { body: {} }), /not approved/);
    assert.throws(() => rest.table(name, query, { prefer: 'resolution=merge-duplicates' }), /not approved/);
  }
  assert.equal(calls.length, 6);
  for (const { url, options } of calls) {
    assert.equal(new URL(url).origin, `https://${REF}.supabase.co`);
    assert.equal(new URL(url).searchParams.get('owner_subject'), 'eq.wp:1');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, null);
    assert.equal(options.redirect, 'error');
  }
  assert.throws(() => rest.table('ivoc_private_unknown', '?select=*'), /not approved/);
});

test('actual native resolver reaches the protected session read and rejects stale prior-context custody', async () => {
  const { rest, calls } = adapter(url => url.pathname.endsWith('/ivoc_context_packs') ? [{
    pack_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pack_version: 'c'.repeat(64),
    actor_block: 'AUTHORIZED APPLICATION CONTEXT\nfixture',
    source_receipts: [{ projection_type: 'ivoc.longitudinal_summary', owner_app: 'ivoc',
      projection_id: 'ivoc-longitudinal:wp:1', source_version: `source-bound-long-${'a'.repeat(32)}`,
      source_receipt_hash: 'b'.repeat(64), authorization_basis: 'owner_policy', degraded: null }],
  }] : []);
  assert.equal(await createIvocContextPackResolver({ rest })({ subject: 'wp:1', sessionId: SESSION }), null);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1].url).pathname, '/rest/v1/ivoc_sessions');
  assert.equal(new URL(calls[1].url).searchParams.get('id'), `eq.${SESSION}`);
  assert.equal(new URL(calls[1].url).searchParams.get('owner_subject'), 'eq.wp:1');
});

test('existing context-pack writes retain their established adapter behavior', async () => {
  const { rest, calls } = adapter();
  await rest.table('ivoc_context_packs', '', { method: 'POST', body: { fixture: true } });
  assert.equal(calls[0].options.method, 'POST');
});

test('native source revalidation traverses all three real read gates, never accepting absent analysis', async () => {
  const { rest, calls } = adapter(url => {
    if (url.pathname.endsWith('/ivoc_context_packs')) return [{
      pack_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pack_version: 'c'.repeat(64),
      actor_block: 'AUTHORIZED APPLICATION CONTEXT\nfixture',
      source_receipts: [{ projection_type: 'ivoc.longitudinal_summary', owner_app: 'ivoc',
        projection_id: 'ivoc-longitudinal:wp:1', source_version: `source-bound-long-${'a'.repeat(32)}`,
        source_receipt_hash: 'b'.repeat(64), authorization_basis: 'owner_policy', degraded: null }],
    }];
    if (url.pathname.endsWith('/ivoc_sessions')) {
      if (url.searchParams.get('id') === `eq.${SESSION}`) return [{ id: SESSION, owner_subject: 'wp:1', state: 'active', context: { contextSources: ['Prior IVOC'] } }];
      return ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']
        .map(id => ({ id, owner_subject: 'wp:1', state: 'saved' }));
    }
    return [];
  });
  assert.equal(await createIvocContextPackResolver({ rest })({ subject: 'wp:1', sessionId: SESSION }), null);
  assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
    '/rest/v1/ivoc_context_packs', '/rest/v1/ivoc_sessions', '/rest/v1/ivoc_sessions', '/rest/v1/ivoc_results', '/rest/v1/ivoc_recordings',
  ]);
  for (const call of calls) {
    assert.equal(call.options.method, 'GET');
    assert.equal(new URL(call.url).searchParams.get('owner_subject'), 'eq.wp:1');
  }
});
