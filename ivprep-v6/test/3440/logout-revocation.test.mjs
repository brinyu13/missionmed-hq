import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { fingerprintIvPrepHqCookie } from '../../server/hq-auth-lifecycle.mjs';

const HQ_SERVER = new URL('../../../missionmed-hq/server.mjs', import.meta.url);

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function encryptedSession(secret, payload) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return `v1.${base64Url(iv)}.${base64Url(ciphertext)}.${base64Url(cipher.getAuthTag())}`;
}

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => socket.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  return address.port;
}

async function waitForServer(origin, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error('HQ logout test server exited before readiness.');
    try {
      const response = await fetch(`${origin}/health`, { redirect: 'error' });
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('HQ logout test server did not become ready.');
}

test('cookie fingerprints are stable, domain-separated, and never retain the cookie', () => {
  const raw = 'v1.sensitive.encrypted.cookie';
  const fingerprint = fingerprintIvPrepHqCookie(raw);
  assert.match(fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(fingerprint, fingerprintIvPrepHqCookie(raw));
  assert.equal(fingerprint.includes(raw), false);
  assert.equal(fingerprintIvPrepHqCookie(''), null);
});

test('successful logout revokes admission and requests bound interview termination once', async () => {
  let now = 1_000;
  const registry = new InMemoryAdmissionRegistry({ now: () => now });
  const fingerprint = 'b'.repeat(64);
  registry.grantSyntheticEntitlement({ subject: 'wp:9', revision: 'rev-9', expiresAtMs: 20_000, voice: true });
  registry.bindInterview({ interviewId: 'interview-9', subject: 'wp:9', cookieFingerprint: fingerprint, entitlementRevision: 'rev-9' });
  const requested = [];
  registry.setTerminationHandler('interview-9', async (reason) => requested.push(reason));
  const first = registry.recordLogout({ cookieFingerprint: fingerprint });
  const duplicate = registry.recordLogout({ cookieFingerprint: fingerprint });
  assert.deepEqual(first, { recorded: true, duplicate: false, terminationRequests: 1 });
  assert.deepEqual(duplicate, { recorded: true, duplicate: true, terminationRequests: 0 });
  assert.equal(registry.isRevoked(fingerprint), true);
  assert.equal(registry.bindingFor('interview-9').terminationRequested, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requested, ['hq_logout']);
  now += 24 * 60 * 60 * 1000 + 1;
  assert.equal(registry.isRevoked(fingerprint), false);
});

test('account, cookie, and entitlement revision switching all fail ownership checks', () => {
  const registry = new InMemoryAdmissionRegistry();
  registry.bindInterview({ interviewId: 'one', subject: 'wp:1', cookieFingerprint: 'c'.repeat(64), entitlementRevision: 'r1' });
  assert.equal(registry.assertBinding({ interviewId: 'one', subject: 'wp:2', cookieFingerprint: 'c'.repeat(64), entitlementRevision: 'r1' }).ok, false);
  assert.equal(registry.assertBinding({ interviewId: 'one', subject: 'wp:1', cookieFingerprint: 'd'.repeat(64), entitlementRevision: 'r1' }).ok, false);
  assert.equal(registry.assertBinding({ interviewId: 'one', subject: 'wp:1', cookieFingerprint: 'c'.repeat(64), entitlementRevision: 'r2' }).ok, false);
});

test('actual HQ logout denies replay only after correct CSRF and preserves cookie clearing', { skip: !existsSync(HQ_SERVER) }, async () => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const secret = 'synthetic-3440-logout-test-secret';
  const csrfToken = 'csrf_logout_test_1234567890';
  const now = Date.now();
  const token = encryptedSession(secret, {
    version: 1,
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    csrfToken,
    authSource: 'wordpress-cookie',
    user: { id: 4242, roles: ['administrator'] },
  });
  const cookie = `mmhq_session=${encodeURIComponent(token)}`;
  const child = spawn(process.execPath, [HQ_SERVER.pathname], {
    cwd: new URL('../../../', import.meta.url).pathname,
    env: {
      PATH: process.env.PATH || '',
      NODE_ENV: 'development',
      PORT: String(port),
      MMHQ_SESSION_SECRET: secret,
      HQ_BASE_URL: origin,
      IVPREP_ENABLED: 'true',
      IVPREP_ADMIN_CANARY_ENABLED: 'true',
      IVPREP_VIDEO_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];
  child.stdout.on('data', (chunk) => output.push(String(chunk).slice(0, 2_000)));
  child.stderr.on('data', (chunk) => output.push(String(chunk).slice(0, 2_000)));
  try {
    await waitForServer(origin, child);
    const before = await fetch(`${origin}/api/ivprep-v6/session`, { headers: { cookie }, redirect: 'error' });
    assert.equal(before.status, 403);

    const wrong = await fetch(`${origin}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie, 'x-mmhq-csrf': 'wrong-csrf-token' },
      redirect: 'error',
    });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.headers.get('set-cookie'), null);
    const afterWrong = await fetch(`${origin}/api/ivprep-v6/session`, { headers: { cookie }, redirect: 'error' });
    assert.equal(afterWrong.status, 403);

    const correct = await fetch(`${origin}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie, 'x-mmhq-csrf': csrfToken },
      redirect: 'error',
    });
    assert.equal(correct.status, 200);
    assert.match(String(correct.headers.get('set-cookie') || ''), /^mmhq_session=;.*Max-Age=0/iu);
    const replay = await fetch(`${origin}/api/ivprep-v6/session`, { headers: { cookie }, redirect: 'error' });
    assert.equal(replay.status, 401);
  } catch (error) {
    error.message += `\nBounded HQ child output:\n${output.join('').slice(0, 4_000)}`;
    throw error;
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  }
});
