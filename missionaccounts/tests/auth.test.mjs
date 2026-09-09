import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyMatrixJwt } from '../src/security/auth.mjs';

const secret = 'missionaccounts-test-signing-secret-32-bytes-minimum';
const config = {
  issuer: 'https://missionmedinstitute.com/wp-json/missionmed/v1/missionaccounts',
  audience: 'missionaccounts',
  jwtSecret: secret,
  jwksUrl: 'https://issuer.invalid/jwks',
};

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token(overrides = {}, headerOverrides = {}, signingSecret = secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT', ...headerOverrides });
  const payload = encode({
    iss: config.issuer,
    aud: config.audience,
    sub: '11111111-1111-4111-8111-111111111111',
    iat: now,
    nbf: now - 2,
    exp: now + 120,
    jti: '22222222-2222-4222-8222-222222222222',
    wp_user_id: 1101,
    app_role: 'student',
    missionaccounts_eligible: true,
    name: 'Test Student',
    first_name: 'Test',
    email: 'student@example.invalid',
    ...overrides,
  });
  const signed = `${header}.${payload}`;
  const signature = createHmac('sha256', signingSecret).update(signed).digest('base64url');
  return `${signed}.${signature}`;
}

test('MissionAccounts accepts the product-scoped WordPress HS256 token and maps one signed role', async () => {
  const identity = await verifyMatrixJwt(token(), config);
  assert.deepEqual(identity.roles, ['student']);
  assert.equal(identity.userId, '11111111-1111-4111-8111-111111111111');
  assert.equal(identity.wpUserId, 1101);
  assert.equal(identity.firstName, 'Test');
});

test('registered Matrix users receive normalized program access without gaining a student role', async () => {
  const identity = await verifyMatrixJwt(token({
    app_role: 'registered',
    program_access: {
      registered: true,
      programs: {
        mission_residency: { enrolled: true },
        examprep: { enrolled: false },
        clinicals: { enrolled: false },
      },
    },
  }), config);
  assert.deepEqual(identity.roles, ['registered']);
  assert.equal(identity.programAccess.registered, true);
  assert.equal(identity.programAccess.programs.mission_residency.enrolled, true);
  assert.equal(identity.programAccess.programs.examprep.enrolled, false);
});

test('registered role fails closed without a server-signed registered program-access object', async () => {
  await assert.rejects(verifyMatrixJwt(token({ app_role: 'registered' }), config), /program access is invalid/i);
  await assert.rejects(verifyMatrixJwt(token({
    app_role: 'registered',
    program_access: { registered: false, programs: {} },
  }), config), /program access is invalid/i);
});

test('MissionAccounts rejects a token signed by another product secret', async () => {
  await assert.rejects(
    verifyMatrixJwt(token({}, {}, 'another-product-secret-that-is-at-least-32-bytes'), config),
    /signature invalid/i,
  );
});

test('MissionAccounts pins HS256 and rejects algorithm or kid confusion in shared-secret mode', async () => {
  await assert.rejects(verifyMatrixJwt(token({}, { alg: 'HS384' }), config), /unsupported identity token/i);
  await assert.rejects(verifyMatrixJwt(token({}, { kid: 'unexpected' }), config), /unsupported identity token/i);
});

test('MissionAccounts requires exact eligibility, role, subject, token id, and WordPress identity claims', async () => {
  for (const overrides of [
    { missionaccounts_eligible: false },
    { app_role: 'admin' },
    { sub: 'not-a-uuid' },
    { jti: 'not-a-uuid' },
    { wp_user_id: 0 },
  ]) {
    await assert.rejects(verifyMatrixJwt(token(overrides), config));
  }
});

test('MissionAccounts rejects expired or not-yet-active tokens', async () => {
  const now = Math.floor(Date.now() / 1000);
  await assert.rejects(verifyMatrixJwt(token({ exp: now - 1 }), config), /expired/i);
  await assert.rejects(verifyMatrixJwt(token({ nbf: now + 60 }), config), /not active/i);
});

test('MissionAccounts never treats an HS256 token as a JWKS token when no product secret is configured', async () => {
  await assert.rejects(
    verifyMatrixJwt(token(), { ...config, jwtSecret: '' }),
    /unsupported identity token/i,
  );
});
