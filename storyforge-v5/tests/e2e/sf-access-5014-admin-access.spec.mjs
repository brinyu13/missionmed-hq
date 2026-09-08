import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode('b1-500-local-e2e-secret-not-for-production');

async function token({
  sub,
  wpUserId,
  role,
  wordpressAdmin = false,
  eligible = true,
  expiration = '5m',
}) {
  return new SignJWT({
    app_role: role,
    storyforge_eligible: eligible,
    wp_user_id: wpUserId,
    wordpress_admin: wordpressAdmin,
    name: role === 'admin' ? 'Canonical Administrator' : 'Fixture User',
    first_name: role === 'admin' ? 'Canonical Administrator' : 'Fixture User',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('storyforge-local-e2e')
    .setAudience('storyforge')
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .setJti(crypto.randomUUID())
    .sign(secret);
}

function bearer(value) {
  return { Authorization: `Bearer ${value}` };
}

test('canonical administrator with a mapped student profile remains an admin actor', async ({ request }) => {
  const admin = await token({
    sub: '11111111-1111-4111-8111-111111111111',
    wpUserId: 1101,
    role: 'admin',
    wordpressAdmin: true,
  });
  const response = await request.get('/api/session', { headers: bearer(admin) });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.user).toMatchObject({
    id: '11111111-1111-4111-8111-111111111111',
    wp_user_id: '1101',
    role: 'admin',
    eligible: true,
    wordpress_admin: true,
    cohort: null,
  });
  expect(body.user.display_name).toBe('Canonical Administrator');
});

test('canonical administrator without a profile receives an admin-only session projection', async ({ request }) => {
  const admin = await token({
    sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    wpUserId: 9101,
    role: 'admin',
    wordpressAdmin: true,
  });
  const response = await request.get('/api/session', { headers: bearer(admin) });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.user).toMatchObject({
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    wp_user_id: '9101',
    role: 'admin',
    eligible: true,
    wordpress_admin: true,
    cohort: null,
    academic_year: null,
    specialty: null,
    application_cycle: null,
  });
});

test('admin claim composition remains fail-closed', async ({ request }) => {
  const cases = [
    {
      name: 'ordinary non-360',
      expected: 403,
      claims: {
        sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        wpUserId: 9102,
        role: 'student',
      },
    },
    {
      name: 'admin role without canonical WordPress authority',
      expected: 403,
      claims: {
        sub: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        wpUserId: 9103,
        role: 'admin',
      },
    },
    {
      name: 'global StoryForge eligibility disabled',
      expected: 403,
      claims: {
        sub: '11111111-1111-4111-8111-111111111111',
        wpUserId: 1101,
        role: 'admin',
        wordpressAdmin: true,
        eligible: false,
      },
    },
    {
      name: 'expired canonical admin token',
      expected: 401,
      claims: {
        sub: '11111111-1111-4111-8111-111111111111',
        wpUserId: 1101,
        role: 'admin',
        wordpressAdmin: true,
        expiration: Math.floor(Date.now() / 1000) - 10,
      },
    },
  ];

  for (const item of cases) {
    const response = await request.get('/api/session', {
      headers: bearer(await token(item.claims)),
    });
    expect(response.status(), item.name).toBe(item.expected);
  }
  expect((await request.get('/api/session')).status()).toBe(401);
  expect((await request.get('/api/session', {
    headers: bearer('invalid.invalid.invalid'),
  })).status()).toBe(401);
});
