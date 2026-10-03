import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAuthorizer } from '../../server/auth.mjs';

let php;
let base;
const origin = 'https://missionmedinstitute.com';
const bearer = 'Bearer synthetic.fixture.signature';
const headers = { Origin: origin, Authorization: bearer, 'X-IIQ-Nonce': 'synthetic-wp-nonce', 'Content-Type': 'application/json' };
before(async () => {
  const reserve = createServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  base = `http://127.0.0.1:${port}`;
  php = spawn(process.env.IIQ_PHP_BIN || 'php', ['-S', `127.0.0.1:${port}`, fileURLToPath(new URL('./http-fixture.php', import.meta.url))], { stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = '';
  php.stderr.on('data', value => { errors = (errors + value).slice(-4000); });
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const probe = async () => {
      try { await fetch(`${base}/`); resolve(); }
      catch {
        if (php.exitCode !== null || Date.now() > deadline) reject(new Error(`PHP fixture unavailable: ${errors}`));
        else setTimeout(probe, 50);
      }
    };
    php.once('error', reject); void probe();
  });
  const issued = await fetch(`${base}/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token`, {
    method: 'POST', headers, body: '{}',
  });
  assert.equal(issued.status, 200);
  headers.Authorization = `Bearer ${(await issued.json()).token}`;
});
after(async () => {
  if (php && php.exitCode === null) {
    const ended = new Promise(resolve => php.once('exit', resolve));
    php.kill('SIGTERM'); await ended;
  }
});
async function call(path, options = {}) {
  const response = await fetch(base + path, { redirect: 'manual', ...options });
  const body = await response.text();
  return { response, body, json: body ? JSON.parse(body) : null };
}
const post = (path, body = {}, extra = {}) => call(path, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });

test('bootstrap and token are private JSON with bounded memory-token contract', async () => {
  const boot = await post('/wp-admin/admin-ajax.php?action=missionmed_interviewiq_bootstrap');
  assert.equal(boot.response.status, 200);
  assert.equal(boot.json.api_base, '/interviewiq/api');
  assert.equal(boot.json.nonce, 'synthetic-wp-nonce');
  assert.match(boot.response.headers.get('cache-control'), /no-store/);
  assert.equal(boot.json.actor.id, '11111111-1111-4111-8111-111111111111');
  assert.equal('session_verifier' in boot.json.actor, false);
  const token = await post(boot.json.token_endpoint);
  assert.equal(token.response.status, 200);
  assert.equal(token.json.ttl_seconds, 60);
  assert.match(token.json.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});
test('actual HTTP bootstrap rejects cross-origin and missing nonce', async () => {
  assert.equal((await post('/wp-admin/admin-ajax.php?action=missionmed_interviewiq_bootstrap', {}, { Origin: 'https://attacker.invalid' })).response.status, 403);
  assert.equal((await post('/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token', {}, { 'X-IIQ-Nonce': '' })).response.status, 403);
});
test('gateway generates only its server credential, pins origin and suppresses cookies', async () => {
  const { response, json } = await post('/interviewiq/api/commands', { type: 'synthetic-command', requestId: randomUUID() });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-security-policy'), "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  assert.equal(json.forwarded.url, 'https://interviewiq-production.up.railway.app/api/commands');
  assert.equal(json.forwarded.gatewayMatched, true);
  assert.equal(json.forwarded.authorizationPresent, true);
  assert.equal(json.forwarded.origin, origin);
  assert.equal(json.forwarded.cookiesEmpty, true);
  assert.equal(json.forwarded.redirects, 0);
  assert.equal(json.forwarded.body.type, 'synthetic-command');
});
test('browser cannot inject gateway header', async () => {
  const result = await post('/interviewiq/api/commands', {}, { 'X-MMED-IIQ-Gateway': 'injected' });
  assert.equal(result.response.status, 400); assert.equal(result.json.error.code, 'reserved_header');
});
test('gateway rejects missing JWT and current-session logout independently', async () => {
  assert.equal((await post('/interviewiq/api/commands', {}, { Authorization: '' })).response.status, 401);
  assert.equal((await post('/interviewiq/api/commands', {}, { 'X-Fixture-Logout': '1' })).response.status, 401);
});
test('gateway mutation requires exact origin and nonce', async () => {
  assert.equal((await post('/interviewiq/api/commands', {}, { Origin: 'https://other.invalid' })).response.status, 403);
  assert.equal((await post('/interviewiq/api/commands', {}, { 'X-IIQ-Nonce': 'wrong' })).response.status, 403);
});
test('program search forwards only q and rejects query credentials', async () => {
  const valid = await call('/interviewiq/api/programs?q=New+York', { headers });
  assert.equal(valid.response.status, 200);
  assert.equal(valid.json.forwarded.url, 'https://interviewiq-production.up.railway.app/api/programs?q=New%20York');
  assert.equal((await call('/interviewiq/api/programs?q=x&token=fixture', { headers })).response.status, 400);
  assert.equal((await call('/interviewiq/api/bootstrap?q=x', { headers })).response.status, 400);
});
test('audio segments use bounded JSON and explicit lifecycle routes', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const segment = { segmentId: randomUUID(), seq: 0, contentType: 'audio/webm', audioBase64: 'Zml4dHVyZQ==', durationMs: 4000 };
  assert.equal((await post(`/interviewiq/api/recordings/${id}/segments`, segment)).json.forwarded.body.seq, 0);
  for (const action of ['pause', 'resume', 'finish', 'cancel', 'retry']) {
    assert.equal((await post(`/interviewiq/api/recordings/${id}/${action}`, {})).response.status, 200);
  }
  assert.equal((await post(`/interviewiq/api/recordings/${id}/segments`, { audioBase64: 'a'.repeat(1572864) })).response.status, 413);
});
test('gateway rejects wrong content type, redirects and HTML upstream responses', async () => {
  assert.equal((await post('/interviewiq/api/commands', {}, { 'Content-Type': 'text/plain' })).response.status, 415);
  assert.equal((await post('/interviewiq/api/commands', {}, { 'X-Fixture-Upstream': 'redirect' })).response.status, 502);
  assert.equal((await post('/interviewiq/api/commands', {}, { 'X-Fixture-Upstream': 'html' })).response.status, 502);
});
test('feature-off applies before private API access', async () => {
  assert.equal((await post('/interviewiq/api/commands', {}, { 'X-Fixture-Disabled': '1' })).response.status, 503);
});
test('anonymous UI entry uses normal WordPress login handoff', async () => {
  const result = await call('/interviewiq/', { headers: { 'X-Fixture-Anonymous': '1' } });
  assert.equal(result.response.status, 302);
  assert.match(result.response.headers.get('location'), /^https:\/\/missionmedinstitute\.com\/my-account\/\?redirect_to=/);
});
test('actual HTTP owner proof binds exact request and observes logout', async () => {
  const request = { audience: 'interviewiq-owner-introspection', subject: '11111111-1111-4111-8111-111111111111', wp_user_id: 42,
    session_verifier: createHash('sha256').update('synthetic-session-token-no-production-value').digest('hex'),
    nonce: randomUUID(), iat: Math.floor(Date.now() / 1000), action: 'GET /api/bootstrap' };
  const body = JSON.stringify(request);
  const key = 'synthetic-proof-key-only-for-local-tests-bbbbbbbb';
  const signature = createHmac('sha256', key).update(`mmiiq-introspection-request-v1\n${body}`).digest('hex');
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MMED-IIQ-Proof': signature }, body };
  const result = await call('/wp-json/missionmed-interviewiq/v1/introspect', options);
  assert.equal(result.response.status, 200);
  const proof = JSON.parse(result.json.payload);
  assert.equal(proof.allowed, true);
  assert.equal(proof.request_sha256, createHash('sha256').update(body).digest('hex'));
  assert.equal(result.json.signature, createHmac('sha256', key).update(`mmiiq-introspection-response-v1\n${result.json.payload}`).digest('hex'));
  const revoked = await call('/wp-json/missionmed-interviewiq/v1/introspect', { ...options, headers: { ...options.headers, 'X-Fixture-Logout': '1' } });
  assert.equal(JSON.parse(revoked.json.payload).allowed, false);
});
test('Node verifier accepts PHP token and proof, then denies that token after logout', async () => {
  let revoked = false;
  const authorize = createAuthorizer({
    jwtIssuer: origin,
    jwtSecret: 'synthetic-jwt-key-only-for-local-tests-aaaaaaaa',
    ownerProofSecret: 'synthetic-proof-key-only-for-local-tests-bbbbbbbb',
    ownerIntrospectionUrl: `${base}/wp-json/missionmed-interviewiq/v1/introspect`,
    ownerTimeoutMs: 2000,
  }, {
    fetchImpl: (url, options) => fetch(url, { ...options,
      headers: { ...options.headers, ...(revoked ? { 'X-Fixture-Logout': '1' } : {}) },
    }),
  });
  const request = { headers: { authorization: headers.Authorization } };
  const actor = await authorize(request, 'GET /api/bootstrap');
  assert.equal(actor.sub, '11111111-1111-4111-8111-111111111111');
  assert.equal(actor.wpUserId, 42);
  assert.equal(actor.role, 'student');
  assert.equal(actor.tier, '360');
  assert.equal(actor.displayName, 'Synthetic Student');
  assert.deepEqual(actor.assignments, []);
  revoked = true;
  await assert.rejects(authorize(request, 'GET /api/bootstrap'), error => error.code === 'session_unavailable');
});
