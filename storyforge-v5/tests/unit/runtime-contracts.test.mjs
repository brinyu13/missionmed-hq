import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import { createAppServer, publicError } from '../../server/app.mjs';
import { verifyToken } from '../../server/auth.mjs';

const encoder = new TextEncoder();
const signingKey = encoder.encode('runtime-contract-unit-secret-at-least-32-bytes');
const issuer = 'storyforge-runtime-contract-test';
const audience = 'storyforge';

async function signedToken({ algorithm = 'HS256', subject = '11111111-1111-4111-8111-111111111111' } = {}) {
  return new SignJWT({
    app_role: 'student',
    storyforge_eligible: true,
    wp_user_id: 101,
  })
    .setProtectedHeader({ alg: algorithm })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti(crypto.randomUUID())
    .sign(signingKey);
}

async function loadConfig(environment) {
  const names = [
    'PORT',
    'STORYFORGE_PORT',
    'STORYFORGE_DEV_AUTH',
    'STORYFORGE_ORIGIN_API_ONLY',
    'STORYFORGE_BASE_PATH',
    'STORYFORGE_JWKS_URL',
    'STORYFORGE_JWT_SECRET',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, environment);
    return await import(`../../server/config.mjs?runtime-contract=${crypto.randomUUID()}`);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test('provider PORT is used only when STORYFORGE_PORT is absent', async () => {
  const providerOnly = await loadConfig({ PORT: '5123' });
  assert.equal(providerOnly.config.port, 5123);

  const explicit = await loadConfig({ PORT: '5123', STORYFORGE_PORT: '6123' });
  assert.equal(explicit.config.port, 6123);
});

test('production shared-secret auth requires at least 32 characters', async () => {
  const shortSecret = await loadConfig({ STORYFORGE_JWT_SECRET: 'x'.repeat(31) });
  assert(shortSecret.validateConfig().includes(
    'STORYFORGE_JWT_SECRET must contain at least 32 characters',
  ));

  const minimumSecret = await loadConfig({ STORYFORGE_JWT_SECRET: 'x'.repeat(32) });
  assert(!minimumSecret.validateConfig().includes(
    'STORYFORGE_JWT_SECRET must contain at least 32 characters',
  ));
});

test('the public Railway origin is API-only by default outside local fixture mode', async () => {
  const production = await loadConfig({});
  assert.equal(production.config.originApiOnly, true);

  const fixture = await loadConfig({ STORYFORGE_DEV_AUTH: 'true' });
  assert.equal(fixture.config.originApiOnly, false);
});

test('production rejects standalone SPA serving and a noncanonical Matrix base path', async () => {
  const standalone = await loadConfig({ STORYFORGE_ORIGIN_API_ONLY: 'false' });
  assert(standalone.validateConfig().includes(
    'production requires STORYFORGE_ORIGIN_API_ONLY=true',
  ));

  const escapedBase = await loadConfig({ STORYFORGE_BASE_PATH: '/another-app/' });
  assert(escapedBase.validateConfig().includes(
    'production requires STORYFORGE_BASE_PATH=/storyforge/',
  ));

  const canonical = await loadConfig({
    STORYFORGE_ORIGIN_API_ONLY: 'true',
    STORYFORGE_BASE_PATH: '/storyforge/',
  });
  assert(!canonical.validateConfig().includes(
    'production requires STORYFORGE_ORIGIN_API_ONLY=true',
  ));
  assert(!canonical.validateConfig().includes(
    'production requires STORYFORGE_BASE_PATH=/storyforge/',
  ));
});

test('shared-secret verification accepts HS256 and rejects another HMAC algorithm', async () => {
  const valid = await verifyToken(await signedToken(), {
    key: signingKey,
    issuer,
    audience,
  });
  assert.equal(valid.sub, '11111111-1111-4111-8111-111111111111');

  await assert.rejects(
    verifyToken(await signedToken({ algorithm: 'HS384' }), {
      key: signingKey,
      issuer,
      audience,
    }),
    (error) => error.code === 'ERR_JOSE_ALG_NOT_ALLOWED',
  );
});

test('subject validation requires a canonical UUID with a valid version and variant', async () => {
  await assert.rejects(
    verifyToken(await signedToken({
      subject: '1111111-11111-4111-8111-111111111111',
    }), { key: signingKey, issuer, audience }),
    (error) => error.code === 'invalid_subject_claim',
  );
  await assert.rejects(
    verifyToken(await signedToken({
      subject: '11111111-1111-4111-7111-111111111111',
    }), { key: signingKey, issuer, audience }),
    (error) => error.code === 'invalid_subject_claim',
  );
});

test('public health response exposes only stable service status fields', async (context) => {
  const server = createAppServer({
    checkHealth: async () => ({
      database: 'private-database-name',
      project: 'private-project-id',
      version: 'private-version',
    }),
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'storyforge-v5',
  });
});

test('malformed bearer tokens fail as private 401 responses without reaching the database', async (context) => {
  const server = createAppServer();
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/session`, {
    headers: { Authorization: 'Bearer malformed' },
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal((await response.json()).error.code, 'ERR_JWS_INVALID');
});

test('signed identity-claim failures are rejected without becoming internal errors', () => {
  for (const code of ['invalid_token_identifier_claim', 'invalid_wp_user_id_claim']) {
    const error = new Error('issuer claim rejected');
    error.code = code;
    assert.deepEqual(publicError(error), {
      status: 403,
      code,
      message: 'issuer claim rejected',
    });
  }
});
