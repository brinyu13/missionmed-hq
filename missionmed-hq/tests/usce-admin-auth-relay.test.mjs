import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productionOrigin = 'https://missionmed-hq-production.up.railway.app';
const wordpressOrigin = 'https://missionmedinstitute.com';
const relayPath = '/api/usce/admin/auth/relay';
const adminCdnUrl = 'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_admin.html';
const handoffToken = 'usce-admin-handoff-test-token';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signedRiseToken(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    wp_user_id: 42,
    email: 'usce-rise-isolation@example.test',
    username: 'usce-rise-isolation',
    display_name: 'USCE RISE Isolation',
    roles: ['administrator'],
    rise_beta_access: true,
    rise_beta_course_ids: [3893],
    rise_beta_entitlements: ['FULL_RISE_BETA_ACCESS'],
    auth_audience: 'rise',
    iat: now,
    exp: now + 60,
    nonce: randomUUID(),
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${createHmac('sha256', secret).update(body).digest('hex')}`;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startHq() {
  const port = await freePort();
  const secret = randomBytes(32).toString('hex');
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: hqRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      HQ_BASE_URL: productionOrigin,
      MMHQ_AUTH_REQUIRED: 'true',
      MMHQ_SESSION_SECRET: randomBytes(32).toString('hex'),
      MMHQ_HANDOFF_SECRET: secret,
      MMHQ_WP_BASE: wordpressOrigin,
      MMHQ_DBOC_PIPELINE_SAFE_MODE: 'true',
      MMHQ_DBOC_TRANSCRIBE_SAFE_MODE: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`HQ test server timeout: ${output.slice(-500)}`)), 15_000);
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.includes('HQ server running on port:')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`HQ test server exited ${code}: ${output.slice(-500)}`));
    });
  });
  return {
    child,
    origin: `http://127.0.0.1:${port}`,
    secret,
    output: () => output,
  };
}

function relayUrl(runtime, params = {}) {
  const url = new URL(relayPath, runtime.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

test('USCE admin relay is exact-target, fragment-only, and reachable from a RISE session', async () => {
  const runtime = await startHq();
  try {
    const anonymousSession = await fetch(`${runtime.origin}/api/auth/session?audience=usce_admin`);
    assert.equal(anonymousSession.status, 200);
    assert.equal((await anonymousSession.json()).authenticated, false);

    const rejectedMethod = await fetch(relayUrl(runtime), {
      method: 'POST',
      redirect: 'manual',
    });
    assert.equal(rejectedMethod.status, 405);
    assert.equal(rejectedMethod.headers.get('allow'), 'GET');

    const start = await fetch(relayUrl(runtime, {
      target: 'https://evil.example.test/steal?secret=1#fragment',
    }), { redirect: 'manual' });
    assert.equal(start.status, 302);
    assert.equal(start.headers.get('cache-control'), 'no-store');
    const wordpressRedirect = new URL(start.headers.get('location'));
    assert.equal(wordpressRedirect.origin, wordpressOrigin);
    assert.equal(wordpressRedirect.pathname, '/wp-admin/admin-post.php');
    assert.equal(wordpressRedirect.searchParams.get('action'), 'mmac_hq_auth_redirect');
    const returnTo = new URL(wordpressRedirect.searchParams.get('return_to'));
    assert.equal(returnTo.origin, productionOrigin);
    assert.equal(returnTo.pathname, relayPath);
    assert.equal(returnTo.searchParams.get('target'), adminCdnUrl);

    const callback = await fetch(relayUrl(runtime, {
      target: `${adminCdnUrl}?queue=open#discard-me`,
      token: handoffToken,
    }), { redirect: 'manual' });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('cache-control'), 'no-store');
    const callbackLocation = new URL(callback.headers.get('location'));
    assert.equal(callbackLocation.origin, new URL(adminCdnUrl).origin);
    assert.equal(callbackLocation.pathname, new URL(adminCdnUrl).pathname);
    assert.equal(callbackLocation.searchParams.get('queue'), 'open');
    assert.equal(callbackLocation.searchParams.has('token'), false);
    const fragment = new URLSearchParams(callbackLocation.hash.slice(1));
    assert.equal(fragment.get('mmhq_handoff_token'), handoffToken);

    const riseExchange = await fetch(`${runtime.origin}/api/auth/session?audience=rise&token=${encodeURIComponent(signedRiseToken(runtime.secret))}`);
    assert.equal(riseExchange.status, 200);
    const riseCookie = String(riseExchange.headers.get('set-cookie') || '').match(/^mmhq_session=([^;]+)/u)?.[1];
    assert.ok(riseCookie);
    const fromRiseSession = await fetch(relayUrl(runtime), {
      redirect: 'manual',
      headers: { Cookie: `mmhq_session=${riseCookie}` },
    });
    assert.equal(fromRiseSession.status, 302);
    assert.equal(new URL(fromRiseSession.headers.get('location')).origin, wordpressOrigin);

    assert.equal(runtime.output().includes(handoffToken), false);
  } finally {
    runtime.child.kill('SIGTERM');
    await new Promise((resolve) => runtime.child.once('exit', resolve));
  }
});
