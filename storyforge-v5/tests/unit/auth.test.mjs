import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT } from 'jose';
import { verifyToken } from '../../server/auth.mjs';

const encoder = new TextEncoder();
const key = encoder.encode('unit-test-signing-secret-at-least-32-bytes');
const wrongKey = encoder.encode('wrong-unit-signing-secret-at-least-32-bytes');
const issuer = 'storyforge-unit-test';
const audience = 'storyforge';

async function token(claims = {}, expiration = '5m', signingKey = key) {
  const builder = new SignJWT({
    app_role: 'student',
    storyforge_eligible: true,
    wp_user_id: 101,
    ...claims,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(claims.sub || '11111111-1111-4111-8111-111111111111')
    .setIssuedAt()
    .setJti(crypto.randomUUID());
  if (expiration) builder.setExpirationTime(expiration);
  return builder.sign(signingKey);
}

test('accepts a signed, purpose-bound, eligible identity', async () => {
  const identity = await verifyToken(await token({
    first_name: ' Dr ',
    username: 'brinyu',
    wordpress_admin: true,
  }), { key, issuer, audience });
  assert.equal(identity.sub, '11111111-1111-4111-8111-111111111111');
  assert.equal(identity.role, 'student');
  assert.equal(identity.eligible, true);
  assert.equal(identity.firstName, ' Dr ');
  assert.equal(identity.username, 'brinyu');
  assert.equal(identity.wordpressAdmin, true);
});

test('WordPress administrator authority requires the exact signed boolean claim', async () => {
  assert.equal((await verifyToken(await token(), { key, issuer, audience })).wordpressAdmin, false);
  assert.equal((await verifyToken(await token({ wordpress_admin: 'true' }), { key, issuer, audience })).wordpressAdmin, false);
  assert.equal((await verifyToken(await token({ wordpress_admin: true }), { key, issuer, audience })).wordpressAdmin, true);
});

test('preserves the signed WordPress first_name exactly and treats absence as blank', async () => {
  const exact = await verifyToken(await token({ first_name: 'Afthab' }), { key, issuer, audience });
  assert.equal(exact.firstName, 'Afthab');

  const absent = await verifyToken(await token(), { key, issuer, audience });
  assert.equal(absent.firstName, '');
  assert.equal(absent.username, '');

  const malformed = await verifyToken(await token({ first_name: {}, username: 42 }), { key, issuer, audience });
  assert.equal(malformed.firstName, '');
  assert.equal(malformed.username, '');
});

test('preserves only signed canonical Avatar Studio identity claims', async () => {
  const activeAvatarId = '55555555-5555-4555-8555-555555555555';
  const identity = await verifyToken(await token({
    avatar_snapshot: {
      avatar_thumbnail_url: '/matrix/avatar/headshot.webp',
      avatar_url: '/matrix/avatar/full.webp',
      active_avatar_id: activeAvatarId,
    },
  }), { key, issuer, audience });
  assert.equal(identity.avatarThumbnailUrl, '/matrix/avatar/headshot.webp');
  assert.equal(identity.avatarUrl, '/matrix/avatar/full.webp');
  assert.equal(identity.activeAvatarId, activeAvatarId);

  const malformed = await verifyToken(await token({
    avatar_thumbnail_url: {},
    avatar_url: 42,
    active_avatar_id: 'not-an-avatar-id',
  }), { key, issuer, audience });
  assert.equal(malformed.avatarThumbnailUrl, '');
  assert.equal(malformed.avatarUrl, '');
  assert.equal(malformed.activeAvatarId, '');
});

test('rejects an expired JWT', async () => {
  await assert.rejects(
    verifyToken(await token({}, '-10s'), { key, issuer, audience }),
    (error) => error.code === 'ERR_JWT_EXPIRED',
  );
});

test('rejects a forged signature', async () => {
  await assert.rejects(
    verifyToken(await token({}, '5m', wrongKey), { key, issuer, audience }),
    (error) => error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  );
});

test('rejects missing eligibility and a forged application role', async () => {
  await assert.rejects(
    verifyToken(await token({ storyforge_eligible: false }), { key, issuer, audience }),
    (error) => error.code === 'eligibility_required',
  );
  await assert.rejects(
    verifyToken(await token({ app_role: 'service_role' }), { key, issuer, audience }),
    (error) => error.code === 'invalid_role_claim',
  );
});

test('rejects non-expiring tokens and malformed issuer identity metadata', async () => {
  await assert.rejects(
    verifyToken(await token({}, null), { key, issuer, audience }),
    (error) => error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED',
  );
  await assert.rejects(
    verifyToken(await token({ wp_user_id: 0 }), { key, issuer, audience }),
    (error) => error.code === 'invalid_wp_user_id_claim',
  );
});
