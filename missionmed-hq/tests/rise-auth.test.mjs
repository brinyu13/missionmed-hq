import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RISE_ENTITLEMENT = 'FULL_RISE_BETA_ACCESS';
const TEST_EMAIL = 'rise-auth-contract@example.test';
const TEST_NONCE = '123e4567-e89b-42d3-a456-426614174000';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signedToken(secret, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    wp_user_id: 42,
    email: TEST_EMAIL,
    username: 'rise-auth-contract',
    display_name: 'RISE Auth Contract',
    roles: ['subscriber'],
    rise_beta_access: true,
    rise_beta_course_ids: [3893],
    rise_beta_entitlements: [RISE_ENTITLEMENT],
    auth_audience: 'rise',
    iat: now,
    exp: now + 60,
    nonce: randomUUID(),
    ...overrides,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
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
      MMHQ_AUTH_REQUIRED: 'true',
      MMHQ_SESSION_SECRET: randomBytes(32).toString('hex'),
      MMHQ_HANDOFF_SECRET: secret,
      MMHQ_WP_BASE: 'https://missionmedinstitute.com',
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

async function exchange(runtime, token, audience = 'rise') {
  return fetch(`${runtime.origin}/api/auth/session?audience=${encodeURIComponent(audience)}&token=${encodeURIComponent(token)}`, {
    redirect: 'manual',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'missionmed-hq-production.up.railway.app',
    },
  });
}

test('RISE auth is entitlement-bound, audience-isolated, and non-RISE compatible', async () => {
  const runtime = await startHq();
  try {
    const health = await fetch(`${runtime.origin}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, 'missionmed-hq');

    const hqStart = await fetch(`${runtime.origin}/api/auth/start`, { redirect: 'manual' });
    assert.equal(hqStart.status, 302);
    const hqLocation = new URL(hqStart.headers.get('location'));
    assert.equal(hqLocation.searchParams.get('action'), 'mmac_hq_auth_redirect');
    assert.equal(new URL(hqLocation.searchParams.get('return_to')).searchParams.has('audience'), false);

    const riseStart = await fetch(`${runtime.origin}/api/auth/start?audience=rise&final=${encodeURIComponent('https://evil.example.test/steal')}`, {
      redirect: 'manual',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'missionmed-hq-production.up.railway.app',
      },
    });
    assert.equal(riseStart.status, 302);
    const riseLocation = new URL(riseStart.headers.get('location'));
    assert.equal(riseLocation.searchParams.get('action'), 'mmed_rise_auth_redirect');
    const riseReturnTo = new URL(riseLocation.searchParams.get('return_to'));
    assert.equal(riseReturnTo.origin, 'https://missionmed-hq-production.up.railway.app');
    assert.equal(riseReturnTo.pathname, '/api/auth/session');
    assert.equal(riseReturnTo.searchParams.get('audience'), 'rise');
    assert.equal(riseReturnTo.toString().includes('evil.example.test'), false);

    for (const route of ['/api/auth/start', '/api/auth/session']) {
      const invalidAudience = await fetch(`${runtime.origin}${route}?audience=definitely-unknown`);
      assert.equal(invalidAudience.status, 400);
      assert.equal((await invalidAudience.json()).error, 'invalid_auth_audience');
    }

    const invalidExchangeAudience = await fetch(`${runtime.origin}/api/auth/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: signedToken(runtime.secret, {
          roles: ['administrator'],
          auth_audience: undefined,
          nonce: undefined,
        }),
        mode: 'definitely-unknown',
      }),
    });
    assert.equal(invalidExchangeAudience.status, 400);
    assert.equal((await invalidExchangeAudience.json()).error, 'invalid_auth_audience');

    const anonymous = await fetch(`${runtime.origin}/api/auth/session?audience=rise`);
    assert.equal(anonymous.status, 200);
    const anonymousPayload = await anonymous.json();
    assert.equal(anonymousPayload.authenticated, false);
    assert.equal(anonymousPayload.accessToken, '');
    assert.equal(anonymousPayload.authAudience, null);
    assert.equal(anonymousPayload.risePrivateBeta, false);
    assert.deepEqual(anonymousPayload.riseEntitlements, []);

    for (const courseId of [3893, 3646]) {
      const eligible = await exchange(runtime, signedToken(runtime.secret, {
        wp_user_id: 40 + courseId,
        rise_beta_course_ids: [courseId],
      }));
      assert.equal(eligible.status, 200);
      const payload = await eligible.json();
      assert.equal(payload.authenticated, true);
      assert.equal(payload.authAudience, 'rise');
      assert.equal(payload.audience, 'rise');
      assert.equal(payload.apiScope, 'rise');
      assert.equal(payload.risePrivateBeta, true);
      assert.deepEqual(payload.riseEntitlements, [RISE_ENTITLEMENT]);
      assert.equal(Object.hasOwn(payload.user, 'riseBetaCourseIds'), false);
    }

    const administrator = await exchange(runtime, signedToken(runtime.secret, {
      wp_user_id: 7,
      roles: ['administrator'],
      rise_beta_access: false,
      rise_beta_course_ids: [],
      rise_beta_entitlements: [],
    }));
    assert.equal(administrator.status, 200);
    assert.equal((await administrator.json()).risePrivateBeta, true);

    const redirectToken = signedToken(runtime.secret);
    const redirectTarget = 'https://missionmed-hq-production.up.railway.app/rise/callback';
    const redirected = await fetch(
      `${runtime.origin}/api/auth/session?audience=rise&token=${encodeURIComponent(redirectToken)}&final=${encodeURIComponent(redirectTarget)}`,
      {
        redirect: 'manual',
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'missionmed-hq-production.up.railway.app',
        },
      },
    );
    assert.equal(redirected.status, 302);
    const redirectedLocation = new URL(redirected.headers.get('location'));
    assert.equal(redirectedLocation.origin, 'https://missionmed-hq-production.up.railway.app');
    assert.equal(redirectedLocation.pathname, '/rise/callback');
    assert.ok(redirectedLocation.searchParams.get('rise_session'));

    const token = signedToken(runtime.secret, { nonce: TEST_NONCE });
    const exchanged = await exchange(runtime, token);
    assert.equal(exchanged.status, 200);
    const payload = await exchanged.json();
    const setCookie = String(exchanged.headers.get('set-cookie') || '');
    assert.match(setCookie, /^mmhq_session=/u);
    assert.match(setCookie, /; Path=\//iu);
    assert.match(setCookie, /; HttpOnly/iu);
    assert.match(setCookie, /; Secure/iu);
    assert.match(setCookie, /; SameSite=Lax/iu);
    const cookie = setCookie.match(/^mmhq_session=([^;]+)/u)?.[1];
    assert.ok(cookie);

    const replayed = await exchange(runtime, token);
    assert.equal(replayed.status, 401);
    assert.equal((await replayed.json()).message, 'handoff_token_replayed');

    const concurrentToken = signedToken(runtime.secret);
    const concurrentStatuses = (await Promise.all([
      exchange(runtime, concurrentToken),
      exchange(runtime, concurrentToken),
    ])).map((result) => result.status).sort();
    assert.deepEqual(concurrentStatuses, [200, 401]);

    const introspected = await fetch(`${runtime.origin}/api/auth/session?audience=rise`, {
      headers: { Cookie: `mmhq_session=${cookie}` },
    });
    assert.equal(introspected.status, 200);
    assert.equal((await introspected.json()).authAudience, 'rise');

    const audienceConfusion = await fetch(`${runtime.origin}/api/auth/session?audience=hq`, {
      headers: { Cookie: `mmhq_session=${cookie}` },
    });
    assert.equal(audienceConfusion.status, 200);
    assert.equal((await audienceConfusion.json()).authenticated, false);

    const isolated = await fetch(`${runtime.origin}/api/summary`, {
      headers: { Cookie: `mmhq_session=${cookie}` },
    });
    assert.equal(isolated.status, 403);
    assert.equal((await isolated.json()).error, 'rise_audience_isolated');

    const riseHealth = await fetch(`${runtime.origin}/api/health`, {
      headers: { Cookie: `mmhq_session=${cookie}` },
    });
    assert.equal(riseHealth.status, 200);

    const rejectedCases = [
      ['revoked', { rise_beta_access: false }, 403],
      ['no-course', { rise_beta_course_ids: [] }, 403],
      ['wrong-course', { rise_beta_course_ids: [9999] }, 403],
      ['no-entitlement', { rise_beta_entitlements: [] }, 403],
      ['missing-email', { email: '' }, 401],
      ['expired', { iat: Math.floor(Date.now() / 1000) - 120, exp: Math.floor(Date.now() / 1000) - 60 }, 401],
      ['not-yet-valid', { iat: Math.floor(Date.now() / 1000) + 600, exp: Math.floor(Date.now() / 1000) + 660 }, 401],
      ['overlong', { exp: Math.floor(Date.now() / 1000) + 600 }, 401],
      ['missing-audience', { auth_audience: undefined }, 401],
      ['wrong-audience', { auth_audience: 'missionmed-hq' }, 401],
      ['missing-nonce', { nonce: undefined }, 401],
      ['malformed-nonce', { nonce: 'not-a-uuid' }, 401],
    ];
    for (const [label, overrides, expectedStatus] of rejectedCases) {
      const rejected = await exchange(runtime, signedToken(runtime.secret, overrides));
      assert.equal(rejected.status, expectedStatus, label);
    }

    const mismatch = await fetch(`${runtime.origin}/api/auth/session?token=${encodeURIComponent(token)}`);
    assert.equal(mismatch.status, 401);

    const malformedBody = base64url('not-json');
    const malformed = await exchange(runtime, `${malformedBody}.${'0'.repeat(64)}`);
    assert.equal(malformed.status, 401);
    const malformedJsonBody = base64url('{not-json');
    const malformedJson = await exchange(runtime, `${malformedJsonBody}.${createHmac('sha256', runtime.secret).update(malformedJsonBody).digest('hex')}`);
    assert.equal(malformedJson.status, 401);
    const tampered = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
    assert.equal((await exchange(runtime, tampered)).status, 401);
    const [tokenBody, tokenSignature] = token.split('.');
    const nonceTamperedPayload = JSON.parse(Buffer.from(tokenBody, 'base64url').toString('utf8'));
    nonceTamperedPayload.nonce = 'ffffffff-e89b-42d3-a456-426614174000';
    const nonceTampered = `${base64url(JSON.stringify(nonceTamperedPayload))}.${tokenSignature}`;
    assert.equal((await exchange(runtime, nonceTampered)).status, 401);

    const wrongCsrf = await fetch(`${runtime.origin}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `mmhq_session=${cookie}`, 'x-mmhq-csrf': 'wrong' },
    });
    assert.equal(wrongCsrf.status, 403);
    assert.equal(wrongCsrf.headers.has('set-cookie'), false);

    const logout = await fetch(`${runtime.origin}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `mmhq_session=${cookie}`, 'x-mmhq-csrf': payload.csrfToken },
    });
    assert.equal(logout.status, 200);
    const cleared = String(logout.headers.get('set-cookie') || '');
    assert.match(cleared, /^mmhq_session=/u);
    assert.match(cleared, /Max-Age=0/iu);
    assert.equal(cleared.includes('mmhq_lor_session'), false);
    assert.equal(cleared.includes('mmhq_rise_session'), false);

    const output = runtime.output();
    assert.equal(output.includes(token), false);
    assert.equal(output.includes(TEST_EMAIL), false);
    assert.equal(output.includes(TEST_NONCE), false);
  } finally {
    runtime.child.kill('SIGTERM');
    await new Promise((resolve) => runtime.child.once('exit', resolve));
  }
});
