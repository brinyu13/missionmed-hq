import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { SignJWT } from 'jose';

process.env.HOMEBASE_DATABASE_URL ||= 'postgres://localhost:5432/homebase_test_placeholder';
process.env.HOMEBASE_JWT_ISSUER ||= 'http://127.0.0.1:4190';

const { createAppServer } = await import('../../server/app.mjs');
const { verifyToken } = await import('../../server/auth.mjs');

const signingKey = new TextEncoder().encode('unit-test-signing-key-with-32-characters');

async function signedToken(overrides = {}) {
  return new SignJWT({
    app_role: 'student',
    homebase_eligible: true,
    wp_user_id: 7001,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('https://issuer.example.invalid')
    .setAudience('homebase')
    .setSubject('31111111-1111-4111-8111-111111111111')
    .setIssuedAt()
    .setExpirationTime('5m')
    .setJti('32222222-2222-4222-8222-222222222222')
    .sign(signingKey);
}

test('signed HomeBase identity requires the eligibility intersection', async () => {
  const options = {
    key: signingKey,
    issuer: 'https://issuer.example.invalid',
    audience: 'homebase',
    algorithms: ['HS256'],
  };
  const accepted = await verifyToken(await signedToken(), options);
  assert.equal(accepted.eligible, true);
  assert.equal(accepted.wpUserId, 7001);
  const ineligibleToken = await signedToken({ homebase_eligible: false });
  await assert.rejects(
    () => verifyToken(ineligibleToken, options),
    (error) => error.code === 'eligibility_required',
  );
});

async function withServer(callback) {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('production API denies anonymous access and hides fixture routes', async () => {
  await withServer(async (base) => {
    const anonymous = await fetch(`${base}/api/class-progress`);
    assert.equal(anonymous.status, 401);
    const malformed = await fetch(`${base}/api/class-progress`, {
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(malformed.status, 401);
    const fixture = await fetch(`${base}/api/dev/session/student`, { method: 'POST' });
    assert.equal(fixture.status, 404);
    const staticAttempt = await fetch(`${base}/`);
    assert.equal(staticAttempt.status, 404);
  });
});

test('provider runtime fails closed when fixture auth is requested', () => {
  const environment = {
    ...process.env,
    HOMEBASE_DEV_AUTH: '1',
    HOMEBASE_DEV_JWT_SECRET: 'fixture-secret-with-at-least-24-characters',
    HOMEBASE_DATABASE_URL: 'postgres://localhost:5432/unused',
    HOMEBASE_JWT_ISSUER: 'https://www.missionmedinstitute.com/wp-json/missionmed/v1/homebase',
    RAILWAY_PROJECT_ID: 'fixture-provider-project',
  };
  const probe = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    "const {config,validateConfig}=await import('./server/config.mjs'); if(config.devAuth!==false)process.exit(2); if(!validateConfig().includes('HOMEBASE_DEV_AUTH is forbidden in provider environments'))process.exit(3);",
  ], { cwd: new URL('../..', import.meta.url), env: environment, encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
});
