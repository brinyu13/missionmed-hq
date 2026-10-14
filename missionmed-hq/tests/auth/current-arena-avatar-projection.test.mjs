import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const hqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uuid = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const selectedUser = uuid('1');
const selectedImage = 'https://cdn.missionmedinstitute.com/arena/full-body/selected.png';

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function signedSession(secret, { userId = 42, supabaseUserId = selectedUser } = {}) {
  const now = Date.now();
  const payload = {
    version: 1,
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    csrfToken: 'synthetic-csrf',
    authSource: 'wordpress_handoff',
    audience: 'hq',
    apiScope: 'hq',
    user: { id: userId, subject: `wp:${userId}`, role: 'subscriber', roles: ['subscriber'] },
    ...(supabaseUserId ? { supabaseUserId } : {}),
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

async function startRuntime() {
  const port = await freePort();
  const secret = randomBytes(32).toString('hex');
  const events = [];
  const stub = `
    globalThis.fetch = async (target, options = {}) => {
      const url = new URL(String(target));
      const headers = options.headers || {};
      const wp = url.hostname === 'missionmedinstitute.com' && url.pathname === '/wp-json/wp/v2/users/me';
      const avatar = url.hostname === 'fglyvdykwgbuivikqoah.supabase.co' && url.pathname === '/rest/v1/user_avatars';
      process.send?.({kind:'outbound', destination:wp?'wp':avatar?'avatar':'unexpected',
        method:options.method, redirect:options.redirect,
        hasCookie:Boolean(headers.Cookie), hasNonce:Boolean(headers['X-WP-Nonce'])});
      if (options.method !== 'GET' || options.redirect !== 'error') throw Error('unsafe outbound request');
      if (wp) {
        if (headers['X-WP-Nonce'] === 'redirectnonce') return Response.redirect('https://untrusted.invalid/', 302);
        if (headers['X-WP-Nonce'] === 'mismatchnonce') return Response.json({id:99});
        if (headers['X-WP-Nonce'] === 'deniednonce') return Response.json({}, {status:403});
        return Response.json({id:42});
      }
      if (avatar) {
        const id = String(url.searchParams.get('user_id') || '').replace(/^eq\\./, '');
        if (url.searchParams.get('is_active') !== 'eq.true' || url.searchParams.get('limit') !== '2'
            || url.searchParams.get('select') !== 'id,user_id,avatar_url,is_active') throw Error('unbounded avatar query');
        const row = {id:'avatar-1', user_id:id, avatar_url:'${selectedImage}', is_active:true};
        if (id.startsWith('22222222')) return Response.json([]);
        if (id.startsWith('33333333')) return Response.json([row,row]);
        if (id.startsWith('44444444')) return Response.json([{...row,user_id:'${selectedUser}'}]);
        if (id.startsWith('55555555')) return Response.json([{...row,avatar_url:'https://untrusted.invalid/a.png'}]);
        if (id.startsWith('66666666')) return Response.json([{...row,avatar_url:'https://cdn.missionmedinstitute.com/a.png?token=secret'}]);
        return Response.json([row]);
      }
      throw Error('unexpected outbound destination');
    };
  `;
  const child = spawn(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(stub), 'server.mjs'], {
    cwd: hqRoot,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'development',
      PORT: String(port),
      MMHQ_AUTH_REQUIRED: 'true',
      MMHQ_SESSION_SECRET: secret,
      MMHQ_WP_BASE: 'https://missionmedinstitute.com',
      MMHQ_SUPABASE_URL: 'https://fglyvdykwgbuivikqoah.supabase.co',
      MMHQ_SUPABASE_KEY: 'synthetic-server-only-key',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.on('message', (message) => events.push(message));
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HQ startup timeout')), 15_000);
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
      const category = output.split('\n').find((line) => /SyntaxError|Error:|ERR_/u.test(line)) || 'unknown';
      reject(new Error(`HQ exited before startup: ${code}; ${category.replace(/[A-Za-z0-9_-]{32,}/gu, '[redacted]')}`));
    });
  });
  return { child, secret, origin: `http://127.0.0.1:${port}`, events };
}

test('current Arena selection is read-only, same-subject, and fail-closed', async () => {
  const runtime = await startRuntime();
  const request = async ({ token = signedSession(runtime.secret), wpCookie = true,
    nonce = 'validnonce1', url = '/api/auth/arena-avatar', method = 'GET', authorization = '' } = {}) => {
    const before = runtime.events.length;
    const response = await fetch(runtime.origin + url, {
      method,
      headers: {
        ...(token ? { Cookie: `mmhq_session=${token}${wpCookie ? '; wordpress_logged_in_test=synthetic' : ''}` } : {}),
        ...(nonce ? { 'X-WP-Nonce': nonce } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    const body = await response.json();
    await new Promise((resolve) => setImmediate(resolve));
    return { response, body, outbound: runtime.events.slice(before) };
  };
  try {
    for (const denied of [
      { token: '' },
      { wpCookie: false },
      { nonce: '' },
      { token: signedSession(runtime.secret, { supabaseUserId: '' }) },
      { token: signedSession(runtime.secret, { supabaseUserId: 'not-a-uuid' }) },
      { url: '/api/auth/arena-avatar?user_id=999' },
      { authorization: 'Bearer invalid' },
    ]) {
      const result = await request(denied);
      assert.deepEqual(result.body, { available: false, imageUrl: null });
      assert.equal(result.outbound.length, 0);
    }
    for (const nonce of ['mismatchnonce', 'redirectnonce', 'deniednonce']) {
      const result = await request({ nonce });
      assert.deepEqual(result.body, { available: false, imageUrl: null });
      assert.equal(result.outbound.filter((event) => event.destination === 'avatar').length, 0);
      assert.equal(result.outbound[0]?.redirect, 'error');
    }
    for (const digit of ['2', '3', '4', '5', '6']) {
      const result = await request({ token: signedSession(runtime.secret, { supabaseUserId: uuid(digit) }) });
      assert.deepEqual(result.body, { available: false, imageUrl: null });
      assert.equal(result.outbound.filter((event) => event.destination === 'avatar').length, 1);
    }
    const success = await request();
    assert.equal(success.response.status, 200);
    assert.equal(success.response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(success.body, { available: true, imageUrl: selectedImage });
    assert.deepEqual(success.outbound.map((event) => event.destination), ['wp', 'avatar']);
    assert.equal(success.outbound.every((event) => event.method === 'GET' && event.redirect === 'error'), true);
    assert.equal(success.outbound[0].hasCookie && success.outbound[0].hasNonce, true);
    assert.equal(success.outbound[1].hasCookie || success.outbound[1].hasNonce, false);
    assert.equal(JSON.stringify(success.body).includes('synthetic-server-only-key'), false);
  } finally {
    runtime.child.kill('SIGTERM');
  }
});
