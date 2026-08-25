import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  canonicalWordPressLorRequest,
  createWordPressLorAuthState,
  createWordPressLorS2sClient,
  deriveWordPressLorS2sKey,
  signWordPressLorRequest,
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_PATH,
  WORDPRESS_LOR_ADMISSION_REQUEST_CONTRACT,
  WORDPRESS_LOR_AUDIENCE,
  WORDPRESS_LOR_BINDING_REVOCATION_CONTRACT,
  WORDPRESS_LOR_BINDING_REVOCATION_PATH,
  WORDPRESS_LOR_BINDING_REVOCATION_REQUEST_CONTRACT,
  WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH,
  WORDPRESS_LOR_BOOTSTRAP_REQUEST_CONTRACT,
  WORDPRESS_LOR_BOOTSTRAP_RESPONSE_CONTRACT,
} from '../../lor-studio/adapters/wordpress-lor-s2s-protocol.mjs';

const ORIGIN = 'https://missionmed.example.test';
const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
const NOW = Date.parse('2026-08-25T16:00:00.000Z');
const NONCE = `lorn1_${'n'.repeat(43)}`;
const CODE = `lorc1_${'c'.repeat(43)}`;
const BINDING = `lorb1_${'b'.repeat(43)}`;
const STATE_HASH = 'a'.repeat(64);
const CALLBACK = `${ORIGIN}/api/lor-studio/auth/callback?audience=lor-studio&state=${STATE_HASH}`;

function receipt(overrides = {}) {
  return {
    contract: WORDPRESS_LOR_ADMISSION_CONTRACT,
    subject: 'wp:123',
    admitted: true,
    evaluatedAt: '2026-08-25T15:59:30.000Z',
    expiresAt: '2026-08-25T16:03:30.000Z',
    ...overrides,
  };
}

function bootstrap(overrides = {}) {
  return {
    contract: WORDPRESS_LOR_BOOTSTRAP_RESPONSE_CONTRACT,
    audience: WORDPRESS_LOR_AUDIENCE,
    subject: 'wp:123',
    bindingId: BINDING,
    bindingExpiresAt: '2026-08-25T20:00:00.000Z',
    receipt: receipt(),
    ...overrides,
  };
}

function revocation(overrides = {}) {
  return {
    contract: WORDPRESS_LOR_BINDING_REVOCATION_CONTRACT,
    audience: WORDPRESS_LOR_AUDIENCE,
    subject: 'wp:123',
    bindingId: BINDING,
    revoked: true,
    revokedAt: '2026-08-25T16:00:00.000Z',
    ...overrides,
  };
}

function response(body, path, overrides = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  return {
    status: overrides.status ?? 200,
    redirected: overrides.redirected ?? false,
    url: overrides.url ?? `${ORIGIN}${path}`,
    headers: new Headers({
      'cache-control': 'private, no-store, max-age=0',
      'content-length': String(bytes.length),
      'content-type': 'application/json; charset=utf-8',
      ...(overrides.headers ?? {}),
    }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

function client(fetchImplementation) {
  return createWordPressLorS2sClient({
    origin: ORIGIN,
    sharedSecret: SECRET,
    fetchImplementation,
    clock: () => new Date(NOW),
    nonceFactory: () => NONCE,
  });
}

test('Node/PHP derive the same domain-separated key and fixed request signature', () => {
  const rawBody = JSON.stringify({
    contract: WORDPRESS_LOR_ADMISSION_REQUEST_CONTRACT,
    audience: WORDPRESS_LOR_AUDIENCE,
    bindingId: BINDING,
    subject: 'wp:123',
  });
  const timestamp = String(Math.floor(NOW / 1_000));
  const canonical = canonicalWordPressLorRequest({
    method: 'POST',
    path: WORDPRESS_LOR_ADMISSION_PATH,
    timestamp,
    nonce: NONCE,
    rawBody,
  });
  const nodeSignature = signWordPressLorRequest({
    sharedSecret: SECRET,
    method: 'POST',
    path: WORDPRESS_LOR_ADMISSION_PATH,
    timestamp,
    nonce: NONCE,
    rawBody,
  });
  const php = spawnSync('php', ['-r', `
$secret = ${JSON.stringify(SECRET)};
$canonical = ${JSON.stringify(canonical)};
$key = hash_hmac('sha256', 'missionmed.lor.s2s.key.v1', $secret, true);
echo 'v1=' . hash_hmac('sha256', $canonical, $key);
`], { encoding: 'utf8' });
  assert.equal(php.status, 0, php.stderr);
  assert.equal(php.stdout, nodeSignature);
  assert.equal(deriveWordPressLorS2sKey(SECRET).length, 32);
  assert.doesNotMatch(canonical, new RegExp(SECRET, 'u'));
});

test('mutation of every signed field changes the request signature', () => {
  const base = {
    sharedSecret: SECRET,
    method: 'POST',
    path: WORDPRESS_LOR_ADMISSION_PATH,
    timestamp: String(Math.floor(NOW / 1_000)),
    nonce: NONCE,
    rawBody: '{}',
  };
  const signature = signWordPressLorRequest(base);
  for (const candidate of [
    { ...base, sharedSecret: `${SECRET}x` },
    { ...base, path: WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH },
    { ...base, timestamp: String(Number(base.timestamp) + 1) },
    { ...base, nonce: `lorn1_${'x'.repeat(43)}` },
    { ...base, rawBody: '{ }' },
  ]) {
    assert.notEqual(signWordPressLorRequest(candidate), signature);
  }
});

test('bootstrap redemption is one exact signed no-cookie POST and returns only binding evidence', async () => {
  let observed;
  const result = await client(async (url, options) => {
    observed = { url, options };
    return response(bootstrap(), WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH);
  }).redeemBootstrap({ code: CODE, state: STATE_HASH, callback: CALLBACK });

  assert.equal(observed.url, `${ORIGIN}${WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH}`);
  assert.equal(observed.options.method, 'POST');
  assert.equal(observed.options.redirect, 'manual');
  assert.equal(observed.options.credentials, 'omit');
  assert.equal(observed.options.cache, 'no-store');
  assert.equal(observed.options.headers['X-MissionMed-LOR-S2S-Audience'], WORDPRESS_LOR_AUDIENCE);
  assert.equal(observed.options.headers['X-MissionMed-LOR-S2S-Nonce'], NONCE);
  assert.match(observed.options.headers['X-MissionMed-LOR-S2S-Signature'], /^v1=[a-f0-9]{64}$/u);
  assert.deepEqual(JSON.parse(observed.options.body), {
    contract: WORDPRESS_LOR_BOOTSTRAP_REQUEST_CONTRACT,
    audience: WORDPRESS_LOR_AUDIENCE,
    code: CODE,
    stateHash: STATE_HASH,
    callback: CALLBACK,
  });
  assert.equal(result.bindingId, BINDING);
  assert.equal(JSON.stringify(result).includes(CODE), false);
  assert.equal(JSON.stringify(observed).includes(SECRET), false);
});

test('every admission uses a fresh signed POST with binding and canonical subject', async () => {
  const observed = [];
  let counter = 0;
  const s2s = createWordPressLorS2sClient({
    origin: ORIGIN,
    sharedSecret: SECRET,
    clock: () => new Date(NOW),
    nonceFactory: () => `lorn1_${String(counter += 1).padStart(43, 'n')}`,
    fetchImplementation: async (_url, options) => {
      observed.push(options);
      return response(receipt(), WORDPRESS_LOR_ADMISSION_PATH);
    },
  });
  await s2s.admit({ bindingId: BINDING, subject: 'wp:123' });
  await s2s.admit({ bindingId: BINDING, subject: 'wp:123' });
  assert.equal(observed.length, 2);
  assert.notEqual(
    observed[0].headers['X-MissionMed-LOR-S2S-Nonce'],
    observed[1].headers['X-MissionMed-LOR-S2S-Nonce'],
  );
  assert.notEqual(
    observed[0].headers['X-MissionMed-LOR-S2S-Signature'],
    observed[1].headers['X-MissionMed-LOR-S2S-Signature'],
  );
  assert.deepEqual(JSON.parse(observed[0].body), {
    contract: WORDPRESS_LOR_ADMISSION_REQUEST_CONTRACT,
    audience: WORDPRESS_LOR_AUDIENCE,
    bindingId: BINDING,
    subject: 'wp:123',
  });
});

test('binding revocation is one exact signed no-cookie POST with a strict receipt', async () => {
  let observed;
  const result = await client(async (url, options) => {
    observed = { url, options };
    return response(revocation(), WORDPRESS_LOR_BINDING_REVOCATION_PATH);
  }).revokeBinding({ bindingId: BINDING, subject: 'wp:123' });

  assert.equal(observed.url, `${ORIGIN}${WORDPRESS_LOR_BINDING_REVOCATION_PATH}`);
  assert.equal(observed.options.method, 'POST');
  assert.equal(observed.options.redirect, 'manual');
  assert.equal(observed.options.credentials, 'omit');
  assert.deepEqual(JSON.parse(observed.options.body), {
    contract: WORDPRESS_LOR_BINDING_REVOCATION_REQUEST_CONTRACT,
    audience: WORDPRESS_LOR_AUDIENCE,
    bindingId: BINDING,
    subject: 'wp:123',
  });
  assert.deepEqual(result, revocation());

  await assert.rejects(
    client(async () => response(revocation({ bindingId: `lorb1_${'x'.repeat(43)}` }), WORDPRESS_LOR_BINDING_REVOCATION_PATH))
      .revokeBinding({ bindingId: BINDING, subject: 'wp:123' }),
  );
});

test('rejects unsafe origin, weak secret, malformed callback/code/state/binding/subject', async () => {
  for (const options of [
    { origin: 'http://missionmed.example.test', sharedSecret: SECRET },
    { origin: `${ORIGIN}/path`, sharedSecret: SECRET },
    { origin: ORIGIN, sharedSecret: 'too-short' },
  ]) {
    assert.throws(() => createWordPressLorS2sClient(options));
  }
  const s2s = client(async () => response(bootstrap(), WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH));
  await assert.rejects(s2s.redeemBootstrap({ code: 'bad', state: STATE_HASH, callback: CALLBACK }));
  await assert.rejects(s2s.redeemBootstrap({ code: CODE, state: 'bad', callback: CALLBACK }));
  await assert.rejects(s2s.redeemBootstrap({
    code: CODE,
    state: STATE_HASH,
    callback: `${ORIGIN}/api/lor-studio/auth/callback?state=${STATE_HASH}&audience=wrong`,
  }));
  await assert.rejects(s2s.admit({ bindingId: 'bad', subject: 'wp:123' }));
  await assert.rejects(s2s.admit({ bindingId: BINDING, subject: 'wp:0' }));
});

test('rejects redirects, denials, origin drift, cacheable/non-JSON and oversized responses', async () => {
  const bad = [
    response(receipt(), WORDPRESS_LOR_ADMISSION_PATH, { status: 403 }),
    response(receipt(), WORDPRESS_LOR_ADMISSION_PATH, { redirected: true }),
    response(receipt(), WORDPRESS_LOR_ADMISSION_PATH, { url: `${ORIGIN}/different` }),
    response(receipt(), WORDPRESS_LOR_ADMISSION_PATH, { headers: { 'content-type': 'text/html' } }),
    response(receipt(), WORDPRESS_LOR_ADMISSION_PATH, { headers: { 'cache-control': 'public' } }),
    response(receipt(), WORDPRESS_LOR_ADMISSION_PATH, { headers: { 'content-length': '16385' } }),
  ];
  for (const candidate of bad) {
    await assert.rejects(client(async () => candidate).admit({ bindingId: BINDING, subject: 'wp:123' }));
  }
});

test('accepts only exact fresh response schemas and time bounds', async () => {
  for (const candidate of [
    { ...receipt(), extra: true },
    { ...receipt(), subject: 'wp:456' },
    { ...receipt(), admitted: false },
    { ...receipt(), evaluatedAt: '2026-08-25T16:01:00.000Z' },
    { ...receipt(), expiresAt: '2026-08-25T16:10:00.000Z' },
  ]) {
    await assert.rejects(
      client(async () => response(candidate, WORDPRESS_LOR_ADMISSION_PATH))
        .admit({ bindingId: BINDING, subject: 'wp:123' }),
    );
  }
  for (const candidate of [
    { ...bootstrap(), privateEvidence: true },
    { ...bootstrap(), audience: 'hq' },
    { ...bootstrap(), bindingExpiresAt: '2026-08-27T16:00:00.000Z' },
    { ...bootstrap(), receipt: receipt({ subject: 'wp:456' }) },
  ]) {
    await assert.rejects(
      client(async () => response(candidate, WORDPRESS_LOR_BOOTSTRAP_REDEEM_PATH))
        .redeemBootstrap({ code: CODE, state: STATE_HASH, callback: CALLBACK }),
    );
  }
});

test('state hash and request nonce are 256-bit outputs with strict encodings', () => {
  assert.equal(
    createWordPressLorAuthState(() => Buffer.alloc(32, 0x01)),
    '72cd6e8422c407fb6d098690f1130b7ded7ec2f7f5e1d30bd9d521f015363793',
  );
});
