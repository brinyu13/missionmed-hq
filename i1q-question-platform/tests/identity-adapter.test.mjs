import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  IDENTITY_CONTRACT_VERSION,
  createI1QIdentityResolver,
  createSupabaseRoleProfileResolver,
  createSupabaseUserVerifier,
  ranklistIqIdentityConfiguration,
} from '../src/identity-adapter.mjs';
import { createQuestionPlatformServer } from '../src/server.mjs';
import { QuestionPlatform } from '../src/platform.mjs';
import { MemoryRepository } from '../src/store.mjs';

const NOW = Date.now();
const ORIGIN = 'https://i1q-staging.missionmed.example';
const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000001';
const CONFIGURATION = ranklistIqIdentityConfiguration();

function token(overrides = {}, headerOverrides = {}) {
  const header = { typ: 'JWT', alg: 'ES256', kid: 'synthetic-key', ...headerOverrides };
  const claims = {
    iss: CONFIGURATION.issuer,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000) - 60,
    sub: ACTOR_ID,
    role: 'authenticated',
    aal: 'aal1',
    session_id: SESSION_ID,
    email: 'fixture@example.invalid',
    phone: '',
    is_anonymous: false,
    user_metadata: { roles: ['platform_admin'] },
    ...overrides,
  };
  return [
    Buffer.from(JSON.stringify(header)).toString('base64url'),
    Buffer.from(JSON.stringify(claims)).toString('base64url'),
    'synthetic-signature',
  ].join('.');
}

function request(accessToken = token(), overrides = {}) {
  return {
    method: 'GET',
    headers: {
      authorization: accessToken ? `Bearer ${accessToken}` : '',
      'x-request-id': 'fixture-request-1',
      ...(overrides.headers || {}),
    },
    ...overrides,
  };
}

function resolverOptions(overrides = {}) {
  return {
    expectedIssuer: CONFIGURATION.issuer,
    trustedOrigins: [ORIGIN],
    now: () => NOW,
    verifyAccessToken: async ({ claims }) => ({
      id: claims.sub,
      email: 'fixture@example.invalid',
      is_anonymous: false,
      user_metadata: { wp_user_id: 42, roles: ['administrator', 'physician_reviewer'] },
    }),
    resolveRoleProfile: async ({ actorId }) => ({
      actor_id: actorId,
      active: true,
      revoked: false,
      memberships: [{ name: 'platform_admin' }],
      credential_status: 'not_applicable',
    }),
    audit: async () => {},
    ...overrides,
  };
}

function errorCode(code) {
  return (error) => error?.code === code;
}

test('canonical RANKLISTIQ resolver emits the closed I1Q identity contract', async () => {
  const resolver = createI1QIdentityResolver({ ...resolverOptions(), includeEmail: true });
  const identity = await resolver(request());
  assert.equal(identity.validated, true);
  assert.deepEqual(identity.actor, { id: ACTOR_ID, roles: ['platform_admin'] });
  assert.equal(identity.session.id, SESSION_ID);
  assert.equal(identity.identity.contract_version, IDENTITY_CONTRACT_VERSION);
  assert.equal(identity.identity.supabase_user_id, ACTOR_ID);
  assert.equal(identity.identity.wordpress_user_id, 42);
  assert.equal(identity.identity.email, 'fixture@example.invalid');
  assert.equal(identity.request_security.transport, 'bearer');
});

test('browser and token role claims never create I1Q authority', async () => {
  const resolver = createI1QIdentityResolver(resolverOptions({
    resolveRoleProfile: async ({ actorId }) => ({
      actor_id: actorId,
      active: true,
      roles: ['read_only'],
      credential_status: 'not_applicable',
    }),
  }));
  const identity = await resolver(request(token({
    role: 'authenticated',
    user_metadata: { roles: ['platform_admin', 'physician_reviewer'] },
    app_metadata: { roles: ['release_manager'] },
  })));
  assert.deepEqual(identity.actor.roles, ['read_only']);
});

test('issuer, audience, role, anonymity, expiry, and session claims fail closed', async (t) => {
  const cases = [
    ['wrong issuer', { iss: 'https://wrong.supabase.co/auth/v1' }, 'token_issuer_invalid'],
    ['wrong audience', { aud: 'another-app' }, 'token_audience_invalid'],
    ['service role', { role: 'service_role' }, 'token_role_invalid'],
    ['anonymous', { is_anonymous: true }, 'anonymous_identity_forbidden'],
    ['expired', { exp: Math.floor(NOW / 1000) - 60 }, 'token_expired'],
    ['future issued at', { iat: Math.floor(NOW / 1000) + 300 }, 'token_issued_at_invalid'],
    ['wrong subject', { sub: 'not-a-uuid' }, 'token_subject_invalid'],
    ['wrong session', { session_id: 'not-a-uuid' }, 'token_session_invalid'],
  ];
  for (const [name, claims, code] of cases) {
    await t.test(name, async () => {
      const resolver = createI1QIdentityResolver(resolverOptions());
      await assert.rejects(resolver(request(token(claims))), errorCode(code));
    });
  }
});

test('missing, malformed, unverified, mismatched, revoked, and roleless identities fail closed', async (t) => {
  await t.test('missing bearer', async () => {
    const resolver = createI1QIdentityResolver(resolverOptions());
    await assert.rejects(resolver(request('')), errorCode('bearer_token_required'));
  });
  await t.test('malformed token', async () => {
    const resolver = createI1QIdentityResolver(resolverOptions());
    await assert.rejects(resolver(request('not-a-jwt')), errorCode('access_token_malformed'));
  });
  await t.test('signature verifier rejection', async () => {
    const resolver = createI1QIdentityResolver(resolverOptions({
      verifyAccessToken: async () => { throw new Error('synthetic signature rejection'); },
    }));
    await assert.rejects(resolver(request()), errorCode('identity_provider_unavailable'));
  });
  await t.test('verified user mismatch', async () => {
    const resolver = createI1QIdentityResolver(resolverOptions({
      verifyAccessToken: async () => ({ id: '10000000-0000-4000-8000-000000000099' }),
    }));
    await assert.rejects(resolver(request()), errorCode('verified_user_mismatch'));
  });
  await t.test('revoked app identity', async () => {
    const resolver = createI1QIdentityResolver(resolverOptions({
      resolveRoleProfile: async ({ actorId }) => ({ actor_id: actorId, active: false, revoked: true, roles: ['read_only'] }),
    }));
    await assert.rejects(resolver(request()), errorCode('identity_revoked'));
  });
  await t.test('no I1Q role', async () => {
    const resolver = createI1QIdentityResolver(resolverOptions({
      resolveRoleProfile: async ({ actorId }) => ({ actor_id: actorId, active: true, roles: [] }),
    }));
    await assert.rejects(resolver(request()), errorCode('i1q_role_required'));
  });
});

test('physician placeholder remains unverified even with its reviewer role', async () => {
  const resolver = createI1QIdentityResolver(resolverOptions({
    resolveRoleProfile: async ({ actorId }) => ({
      actor_id: actorId,
      active: true,
      roles: ['physician_reviewer'],
      credential_status: 'unverified',
    }),
  }));
  const identity = await resolver(request());
  assert.deepEqual(identity.actor.roles, ['physician_reviewer']);
  assert.equal(identity.identity.credential_verified, false);
  assert.equal(identity.identity.credential_status, 'unverified');
});

test('expired credential evidence cannot produce a verified credential context', async () => {
  const resolver = createI1QIdentityResolver(resolverOptions({
    resolveRoleProfile: async ({ actorId }) => ({
      actor_id: actorId,
      active: true,
      roles: ['physician_reviewer'],
      credential_status: 'verified',
      credential_verification_id: 'synthetic-credential-evidence',
      credential_expires_at: new Date(NOW - 60_000).toISOString(),
    }),
  }));
  const identity = await resolver(request());
  assert.equal(identity.identity.credential_status, 'verified');
  assert.equal(identity.identity.credential_verified, false);
});

test('every failed identity resolution emits a token-free audit event', async () => {
  const events = [];
  const resolver = createI1QIdentityResolver(resolverOptions({ audit: async (event) => events.push(event) }));
  const secretToken = token({ aud: 'wrong-audience' });
  await assert.rejects(resolver(request(secretToken)), errorCode('token_audience_invalid'));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'privileged_identity_resolution_failed');
  assert.equal(events[0].code, 'token_audience_invalid');
  assert.equal(events[0].request_id, 'fixture-request-1');
  assert.doesNotMatch(JSON.stringify(events), new RegExp(secretToken.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.deepEqual(Object.keys(events[0]).sort(), ['code', 'event', 'occurred_at', 'request_id']);
});

test('identity resolution requires a durable audit boundary and fails closed when it is unavailable', async () => {
  assert.throws(
    () => createI1QIdentityResolver(resolverOptions({ audit: undefined })),
    errorCode('identity_audit_sink_invalid'),
  );
  const resolver = createI1QIdentityResolver(resolverOptions({
    audit: async () => {
      throw new Error('synthetic audit outage');
    },
  }));
  await assert.rejects(
    resolver(request(token({ aud: 'wrong-audience' }))),
    errorCode('identity_audit_unavailable'),
  );
});

test('Supabase verifier pins RANKLISTIQ and never accepts a service-role key', async () => {
  let observed = null;
  const verifier = createSupabaseUserVerifier({
    supabaseUrl: CONFIGURATION.origin,
    projectRef: CONFIGURATION.projectRef,
    publishableKey: 'sb_publishable_synthetic_fixture',
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return new Response(JSON.stringify({ id: ACTOR_ID }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.deepEqual(await verifier({ accessToken: token() }), { id: ACTOR_ID });
  assert.equal(observed.url, `${CONFIGURATION.origin}/auth/v1/user`);
  assert.equal(observed.options.redirect, 'error');
  assert.match(observed.options.headers.Authorization, /^Bearer /u);

  const servicePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  assert.throws(() => createSupabaseUserVerifier({
    supabaseUrl: CONFIGURATION.origin,
    projectRef: CONFIGURATION.projectRef,
    publishableKey: `x.${servicePayload}.x`,
  }), errorCode('service_role_key_forbidden'));
  assert.throws(() => createSupabaseUserVerifier({
    supabaseUrl: CONFIGURATION.origin,
    projectRef: CONFIGURATION.projectRef,
    publishableKey: 'sb_secret_synthetic_private_key',
  }), errorCode('service_role_key_forbidden'));
  assert.throws(() => createSupabaseUserVerifier({
    supabaseUrl: CONFIGURATION.origin,
    projectRef: CONFIGURATION.projectRef,
    publishableKey: 'opaque_synthetic_key_material',
  }), errorCode('supabase_publishable_key_invalid'));

  const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
  const legacyAnon = createSupabaseUserVerifier({
    supabaseUrl: CONFIGURATION.origin,
    projectRef: CONFIGURATION.projectRef,
    publishableKey: `x.${anonPayload}.x`,
    fetchImpl: async () => new Response(JSON.stringify({ id: ACTOR_ID }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  assert.equal((await legacyAnon({ accessToken: token() })).id, ACTOR_ID);
});

test('role resolver calls only the scoped I1Q RPC with the verified user bearer', async () => {
  let observed = null;
  const resolver = createSupabaseRoleProfileResolver({
    supabaseUrl: CONFIGURATION.origin,
    projectRef: CONFIGURATION.projectRef,
    publishableKey: 'sb_publishable_synthetic_fixture',
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return new Response(JSON.stringify({
        identity_contract_version: IDENTITY_CONTRACT_VERSION,
        actor_id: ACTOR_ID,
        active: true,
        revoked: false,
        memberships: [{ name: 'read_only' }],
        credential_status: 'not_applicable',
        credential_verification_id: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const accessToken = token();
  const profile = await resolver({ accessToken });
  assert.equal(profile.actor_id, ACTOR_ID);
  assert.equal(observed.url, `${CONFIGURATION.origin}/rest/v1/rpc/resolve_current_identity`);
  assert.equal(observed.options.headers['Accept-Profile'], 'i1q');
  assert.equal(observed.options.headers['Content-Profile'], 'i1q');
  assert.equal(observed.options.headers.Authorization, `Bearer ${accessToken}`);
  assert.equal(observed.options.body, '{}');
});

test('fixture estate includes every required authenticated and denial persona', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('../fixtures/auth/i1q_authenticated_test_identities.json', import.meta.url),
    'utf8',
  ));
  assert.equal(fixture.medical_content, false);
  assert.deepEqual(fixture.identities.map(({ fixture_id }) => fixture_id), [
    'platform_administrator',
    'editorial_reviewer',
    'physician_reviewer_placeholder',
    'privacy_reviewer',
    'release_manager',
    'read_only_auditor',
    'unauthorized_student',
    'unauthenticated_visitor',
    'revoked_user',
    'expired_session',
  ]);
  assert.equal(
    fixture.identities.find(({ fixture_id }) => fixture_id === 'physician_reviewer_placeholder').credential_status,
    'unverified',
  );
});

test('bearer-backed API writes require the verified token and an exact trusted Origin', async () => {
  const repository = new MemoryRepository();
  repository.create('feature_flags', { key: 'internal_platform_enabled', enabled: true }, { id: 'flag_identity_test' });
  const platform = new QuestionPlatform({ repository });
  const identityResolver = createI1QIdentityResolver(resolverOptions());
  const server = createQuestionPlatformServer({ platform, identityResolver });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const authorization = `Bearer ${token()}`;
  try {
    const directApi = await fetch(`${baseUrl}/api/v1/session`, { headers: { Authorization: authorization } });
    assert.equal(directApi.status, 200);
    const session = await directApi.json();
    assert.deepEqual(Object.keys(session).sort(), ['actor', 'session']);
    assert.deepEqual(Object.keys(session.actor).sort(), ['id', 'roles']);
    assert.deepEqual(Object.keys(session.session).sort(), ['csrf_token', 'expires_at']);
    assert.equal(session.actor.id, ACTOR_ID);
    assert.equal(session.session.csrf_token, null);

    const unauthenticated = await fetch(`${baseUrl}/api/v1/dashboard`);
    assert.equal(unauthenticated.status, 401);

    const accepted = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
      method: 'POST',
      headers: { Authorization: authorization, Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Synthetic identity fixture' }),
    });
    assert.equal(accepted.status, 201);

    for (const origin of ['', 'https://hostile.example']) {
      const rejected = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
        method: 'POST',
        headers: { Authorization: authorization, Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Synthetic rejected fixture' }),
      });
      assert.equal(rejected.status, 403);
      assert.equal((await rejected.json()).error, 'request_verification_failed');
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('logout requires the canonical revocation adapter and rejects the old bearer afterward', async () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  let revoked = false;
  const identityResolver = createI1QIdentityResolver(resolverOptions({
    resolveRoleProfile: async ({ actorId }) => ({
      actor_id: actorId,
      active: !revoked,
      revoked,
      memberships: [{ name: 'read_only' }],
      credential_status: 'not_applicable',
    }),
  }));
  const authorization = `Bearer ${token()}`;

  const missingAdapterServer = createQuestionPlatformServer({ platform, identityResolver });
  await new Promise((resolve) => missingAdapterServer.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${missingAdapterServer.address().port}/api/v1/logout`, {
      method: 'POST',
      headers: { Authorization: authorization, Origin: ORIGIN },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'internal_error' });
  } finally {
    await new Promise((resolve, reject) => missingAdapterServer.close((error) => error ? reject(error) : resolve()));
  }

  const server = createQuestionPlatformServer({
    platform,
    identityResolver,
    logoutResolver: async ({ identityContext }) => {
      assert.equal(identityContext.actor.id, ACTOR_ID);
      revoked = true;
      return true;
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const logout = await fetch(`${baseUrl}/api/v1/logout`, {
      method: 'POST',
      headers: { Authorization: authorization, Origin: ORIGIN },
    });
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { logged_out: true });

    const oldBearer = await fetch(`${baseUrl}/api/v1/session`, {
      headers: { Authorization: authorization },
    });
    assert.equal(oldBearer.status, 401);
    assert.deepEqual(await oldBearer.json(), { error: 'session_revoked' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
