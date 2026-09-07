import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authSource = (await readFile(path.join(root, 'public/missionaccounts-auth.js'), 'utf8')).replaceAll('export ', '');
const fixtureToken = claims => `fixture.${Buffer.from(JSON.stringify({ sub: 'fixture-a', app_role: 'student', exp: 9999999999, ...claims })).toString('base64url')}.fixture`;
function client(fetcher) {
  const events = {}, locks = [], reloads = [], redirects = [];
  const window = { addEventListener: (name, fn) => { events[name] = fn; }, clearTimeout() {}, setTimeout: () => 1,
    location: { origin: 'https://app.invalid', href: 'https://app.invalid/missionaccounts/', reload: () => reloads.push(true), assign: url => redirects.push(url) } };
  const context = vm.createContext({ window, document: { addEventListener() {} }, URL, AbortController, Blob, FormData, setTimeout, clearTimeout, atob, fetch: fetcher });
  const factory = vm.runInContext(`${authSource}\ncreateMissionAccountsAuthClient`, context);
  const auth = factory({ onLockout: (...args) => locks.push(args), onSessionChanged: () => reloads.push(true) });
  auth.configure({ basePath: '/missionaccounts/' });
  return { auth, events, locks, reloads, redirects };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test('authenticated fetch forces no-store, including caller override', async () => {
  let captured;
  const c = client(async (url, init) => { captured = { url, init }; return json({ own: true }); });
  c.auth.setToken(fixtureToken());
  assert.equal((await c.auth.request('/ui/bootstrap', { cache: 'force-cache' })).own, true);
  assert.equal(captured.init.cache, 'no-store');
  assert.equal(captured.init.credentials, 'omit');
  assert.match(captured.init.headers.Authorization, /^Bearer /);
});

test('bridge denial preserves typed failure, clears memory and redirects only to returned login', async () => {
  for (const status of [401, 403, 503]) {
    const c = client(async () => json({ success: false, data: { code: 'fixture_denied', state: 'access_unavailable', message: 'Denied', login_url: 'https://app.invalid/login' } }, status));
    await assert.rejects(c.auth.exchange(), error => error.status === status && error.code === 'fixture_denied');
    assert.equal(c.auth.token, '');
    assert.equal(c.locks.length, 1);
    assert.equal(c.redirects.length, status === 401 ? 1 : 0);
  }
});

test('pagehide wipes access and a restored browser page reloads', () => {
  const c = client(() => { throw new Error('Unexpected request'); });
  c.auth.setToken(fixtureToken());
  c.events.pagehide();
  assert.equal(c.auth.token, '');
  assert.equal(c.locks[0][0], 'session_ended');
  c.events.pageshow({ persisted: true });
  assert.equal(c.reloads.length, 1);
});

test('late bootstrap body cannot restore private data after clearing', async () => {
  let resolveBody;
  const c = client(async () => ({ ok: true, status: 200, json: () => new Promise(resolve => { resolveBody = resolve; }) }));
  c.auth.setToken(fixtureToken());
  const pending = c.auth.request('/ui/bootstrap');
  while (!resolveBody) await new Promise(resolve => setImmediate(resolve));
  c.events.pagehide();
  resolveBody({ private: 'fixture' });
  await assert.rejects(pending, error => error.code === 'session_ended');
});

test('late token exchange cannot resurrect a session after logout', async () => {
  let resolveToken;
  const c = client(async url => String(url).includes('admin-ajax')
    ? json({ success: true, data: { token_endpoint: 'https://app.invalid/token', nonce: 'fixture-only' } })
    : new Promise(resolve => { resolveToken = resolve; }));
  const pending = c.auth.exchange();
  while (!resolveToken) await new Promise(resolve => setImmediate(resolve));
  c.events.pagehide();
  resolveToken(json({ token: fixtureToken() }));
  await assert.rejects(pending, error => error.code === 'session_ended');
  assert.equal(c.auth.token, '');
});

test('changed principal or app_role clears previous payload before reload; ordinary refresh preserves session', () => {
  for (const claims of [{ sub: 'fixture-b' }, { app_role: 'missionaccounts_admin' }]) {
    const c = client(() => {});
    c.auth.setToken(fixtureToken());
    assert.throws(() => c.auth.setToken(fixtureToken(claims)), error => error.code === 'session_changed');
    assert.equal(c.auth.token, '');
    assert.equal(c.locks[0][0], 'session_changed');
    assert.equal(c.reloads.length, 1);
  }
  const c = client(() => {});
  c.auth.setToken(fixtureToken());
  c.auth.setToken(fixtureToken({ exp: 9999999998, jti: 'new-fixture-jti' }));
  assert.equal(c.locks.length, 0);
});

test('canonical clearing removes private arrays, derived cache and hydrated DOM', async () => {
  const html = await readFile(path.join(root, 'public/index.production.html'), 'utf8');
  const fn = html.match(/function clearSensitiveState\(\)\{[\s\S]+?\n\}/)?.[0];
  assert.ok(fn);
  const D = Object.fromEntries(['sessions', 'students', 'events', 'groups', 'clusters', 'devices', 'distinct', 'excluded'].map(key => [key, [{ private: true }]]));
  let removed = 0;
  const context = vm.createContext({ D, ORIG_TOTAL: { june: 123 }, WS: { private: true }, CACHE: { private: true }, CACHE_REV: 1, REV: 1,
    fresh: () => ({}), document: { body: { querySelectorAll: () => [{ remove: () => removed++ }] } } });
  vm.runInContext(`${fn}\nclearSensitiveState()`, context);
  assert.equal(D.students.length, 0);
  assert.equal(D.events.length, 0);
  assert.equal(context.CACHE, null);
  assert.equal(Object.keys(context.WS).length, 0);
  assert.equal(Object.keys(context.ORIG_TOTAL).length, 0);
  assert.equal(removed, 1);
});

async function gateway(run) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'mma-gateway-fixture-'));
  const routePath = path.join(root, 'infra/wordpress/missionmed-missionaccounts-route.php').replaceAll("'", "\\'");
  const router = `<?php
  define('ABSPATH', __DIR__); define('MISSIONACCOUNTS_ROUTE_ENABLED', true);
  function add_action() {} function wp_unslash($v) { return $v; }
  function wp_parse_url($u,$c=-1) { return parse_url($u,$c); }
  function status_header($s) { http_response_code($s); }
  function nocache_headers() { header('Cache-Control: no-cache'); }
  function wp_json_encode($v) { return json_encode($v); }
  function sanitize_text_field($v) { return $v; }
  function wp_remote_retrieve_response_code($r) { return $r['status']; }
  function wp_remote_retrieve_body($r) { return $r['body']; }
  function wp_remote_retrieve_header($r,$h) { return $r[$h] ?? ''; }
  require '${routePath}';
  if ($_SERVER['REQUEST_URI'] === '/fixture-private-response') mmma_emit_response(['status'=>200,'body'=>'{"fixture":true}','content-type'=>'application/json'],$_SERVER['REQUEST_METHOD'],'/api/ui/bootstrap');
  mmma_proxy_request(); http_response_code(404); echo 'outside namespace';`;
  await writeFile(path.join(tmp, 'router.php'), router);
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening'); const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const process = spawn('php', ['-S', `127.0.0.1:${port}`, path.join(tmp, 'router.php')], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { process.stderr.once('data', resolve); process.once('error', reject); process.once('exit', () => reject(new Error('PHP fixture exited'))); });
    await run(`http://127.0.0.1:${port}`);
  } finally { process.kill(); await once(process, 'exit'); await rm(tmp, { recursive: true, force: true }); }
}

test('real PHP responses keep the whole namespace contained and private, including HEAD and warm requests', async () => {
  await gateway(async base => {
    for (const uri of ['/missionaccounts', '/missionaccounts/', '/missionaccounts/api/ui/bootstrap', '/missionaccounts/api/session?fixture=1']) {
      for (const method of ['GET', 'GET', 'HEAD', 'POST']) {
        const response = await fetch(base + uri, { method });
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'no-store, private');
        assert.equal(response.headers.get('vary'), 'Authorization, Cookie');
        assert.equal(response.headers.get('x-accel-expires'), '0');
        const body = await response.text();
        if (method === 'HEAD') assert.equal(body, '');
        else assert.equal(JSON.parse(body).code, 'missionaccounts_temporarily_unavailable');
      }
    }
    assert.equal((await fetch(base + '/unrelated')).status, 404);
    const response = await fetch(base + '/fixture-private-response');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal(response.headers.get('vary'), 'Authorization, Cookie');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { fixture: true });
  });
});
