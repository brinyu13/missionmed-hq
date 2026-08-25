import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_GRANT_PROVENANCE,
  WORDPRESS_LOR_ADMISSION_PATH,
  WordPressCurrentUserAdmissionError,
  createWordPressCurrentUserAdmission,
} from '../../lor-studio/adapters/wordpress-current-user-admission.mjs';
import { runWithTrustedRequestContext } from '../../lor-studio/security/trusted-request-context.mjs';

const ORIGIN = 'https://missionmed.example.test';
const ENDPOINT = `${ORIGIN}${WORDPRESS_LOR_ADMISSION_PATH}`;
const NOW = Date.parse('2026-08-25T16:00:00.000Z');
const GRANT = `${'g'.repeat(64)}.${'a'.repeat(64)}`;

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

function response(body = receipt(), overrides = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  const headers = new Headers({
    'cache-control': 'private, no-store, max-age=0',
    'content-length': String(bytes.byteLength),
    'content-type': 'application/json; charset=utf-8',
    ...(overrides.headers ?? {}),
  });
  return {
    status: overrides.status ?? 200,
    redirected: overrides.redirected ?? false,
    url: overrides.url ?? ENDPOINT,
    headers,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

function session(overrides = {}) {
  return {
    user: { id: 123, roles: ['subscriber'] },
    lorAdmissionGrant: GRANT,
    lorAdmissionGrantProvenance: WORDPRESS_LOR_ADMISSION_GRANT_PROVENANCE,
    ...overrides,
  };
}

function admission(fetchImplementation) {
  return createWordPressCurrentUserAdmission({
    origin: ORIGIN,
    fetchImplementation,
    clock: () => new Date(NOW),
  });
}

async function resolvesToContext({ receiptOverrides = {}, sessionOverrides = {} } = {}) {
  const adapter = admission(async () => response(receipt(receiptOverrides)));
  const projection = await adapter.resolve({ subject: 'wp:123', session: session(sessionOverrides) });
  return { adapter, projection, context: adapter.consumeTrustedRequestContext(projection) };
}

test('uses one exact no-cookie, no-redirect server request and keeps the opaque grant private', async () => {
  let observed;
  const adapter = admission(async (url, options) => {
    observed = { url, options };
    return response();
  });
  const projection = await adapter.resolve({ subject: 'wp:123', session: session() });

  assert.equal(observed.url, ENDPOINT);
  assert.equal(observed.options.method, 'GET');
  assert.equal(observed.options.redirect, 'manual');
  assert.equal(observed.options.credentials, 'omit');
  assert.equal(observed.options.cache, 'no-store');
  assert.equal(observed.options.headers['X-MissionMed-LOR-Admission'], GRANT);
  assert.equal(observed.options.headers.Accept, 'application/json');
  assert.equal(JSON.stringify(projection).includes(GRANT), false);

  const context = adapter.consumeTrustedRequestContext(projection);
  assert.equal(JSON.stringify(context).includes(GRANT), false);
  assert.equal(context.authenticatedSubject, 'wp:123');
  assert.equal(context.actorRole, 'student');
  assert.match(context.sourceReferenceHash, /^[a-f0-9]{64}$/u);
  assert.match(context.proofHash, /^[a-f0-9]{64}$/u);
  assert.equal(context.clientAsserted, false);
});

test('derives stable database proof hashes without receipt timestamps or refresh grants', async () => {
  const first = await resolvesToContext();
  const second = await resolvesToContext({
    receiptOverrides: {
      evaluatedAt: '2026-08-25T15:59:45.000Z',
      expiresAt: '2026-08-25T16:04:00.000Z',
    },
    sessionOverrides: { lorAdmissionGrant: `${'z'.repeat(64)}.${'b'.repeat(64)}` },
  });
  assert.equal(first.context.sourceReferenceHash, second.context.sourceReferenceHash);
  assert.equal(first.context.proofHash, second.context.proofHash);
});

test('trusted context can be consumed once and a hand-built projection cannot be branded', async () => {
  const adapter = admission(async () => response());
  const projection = await adapter.resolve({ subject: 'wp:123', session: session() });
  adapter.consumeTrustedRequestContext(projection);
  assert.throws(
    () => adapter.consumeTrustedRequestContext(projection),
    (error) => error instanceof WordPressCurrentUserAdmissionError
      && error.code === 'TRUSTED_CONTEXT_UNAVAILABLE',
  );
  assert.throws(
    () => adapter.consumeTrustedRequestContext({ ...projection }),
    /TRUSTED_CONTEXT_UNAVAILABLE/u,
  );
});

test('case-service entitlement port is request-context bound and subject exact', async () => {
  const { adapter, context } = await resolvesToContext();
  await assert.rejects(adapter.getStudentEntitlement({ studentId: 'wp:123' }), /TRUSTED_CONTEXT_UNAVAILABLE/u);

  await runWithTrustedRequestContext(context, async () => {
    const entitlement = await adapter.getStudentEntitlement({ studentId: 'wp:123' });
    assert.deepEqual(entitlement, {
      studentId: 'wp:123',
      active: true,
      tier: 'tier3_360',
      lorEnabled: true,
      revoked: false,
      canaryEnabled: true,
      canaryConsented: true,
      producerStatus: 'WORDPRESS_ADMISSION_V2_VERIFIED',
    });
    await assert.rejects(
      adapter.getStudentEntitlement({ studentId: 'wp:456' }),
      /ENTITLEMENT_SUBJECT_MISMATCH/u,
    );
  });
});

test('rejects noncanonical and cross-subject sessions before transport', async () => {
  let calls = 0;
  const adapter = admission(async () => { calls += 1; return response(); });
  for (const input of [
    { subject: '123', session: session() },
    { subject: 'wp:123', session: session({ user: { id: 'wp:456', roles: ['subscriber'] } }) },
    { subject: 'wp:123', session: session({ user: { id: 'student-123', roles: ['subscriber'] } }) },
  ]) {
    await assert.rejects(adapter.resolve(input), WordPressCurrentUserAdmissionError);
  }
  assert.equal(calls, 0);
});

test('the student admission receipt, not a fictional singular session role, is role-authoritative', async () => {
  const adapter = admission(async () => response());
  const projection = await adapter.resolve({
    subject: 'wp:123',
    session: session({ user: { id: 123, roles: ['subscriber', 'student'] } }),
  });
  assert.equal(projection.role, 'student');
  assert.equal(adapter.consumeTrustedRequestContext(projection).actorRole, 'student');
});

test('requires the exact session grant provenance and never emits the grant in errors', async () => {
  const adapter = admission(async () => response());
  for (const overrides of [
    { lorAdmissionGrant: '' },
    { lorAdmissionGrant: 'x'.repeat(63) },
    { lorAdmissionGrant: `${'x'.repeat(64)}\n` },
    { lorAdmissionGrantProvenance: 'client_header' },
  ]) {
    await assert.rejects(
      adapter.resolve({ subject: 'wp:123', session: session(overrides) }),
      (error) => error instanceof WordPressCurrentUserAdmissionError
        && error.code === 'REFRESH_GRANT_UNAVAILABLE'
        && !error.message.includes(GRANT),
    );
  }
});

test('rejects redirects, origin drift, denial, oversized responses, and unsafe headers', async () => {
  const scenarios = [
    response(receipt(), { status: 403 }),
    response(receipt(), { redirected: true }),
    response(receipt(), { url: `${ORIGIN}/different` }),
    response(receipt(), { headers: { 'content-type': 'text/html' } }),
    response(receipt(), { headers: { 'content-type': 'application/json; charset=utf-8; profile=x' } }),
    response(receipt(), { headers: { 'cache-control': 'public, max-age=60' } }),
    response(receipt(), { headers: { 'cache-control': 'private, no-storeish' } }),
    response(receipt(), { headers: { 'content-length': '4097' } }),
  ];
  for (const candidate of scenarios) {
    const adapter = admission(async () => candidate);
    await assert.rejects(
      adapter.resolve({ subject: 'wp:123', session: session() }),
      WordPressCurrentUserAdmissionError,
    );
  }
});

test('transport deadline aborts stalled admission and returns only a safe code', async () => {
  let observedSignal;
  const adapter = createWordPressCurrentUserAdmission({
    origin: ORIGIN,
    clock: () => new Date(NOW),
    transportTimeoutMs: 50,
    fetchImplementation: async (_url, options) => {
      observedSignal = options.signal;
      return new Promise(() => {});
    },
  });
  const started = Date.now();
  await assert.rejects(
    adapter.resolve({ subject: 'wp:123', session: session() }),
    (error) => error instanceof WordPressCurrentUserAdmissionError
      && error.code === 'TRANSPORT_TIMEOUT'
      && !error.message.includes(GRANT),
  );
  assert.equal(observedSignal.aborted, true);
  assert.ok(Date.now() - started < 1_000);
});

test('streaming response cap rejects a lying or absent content length before buffering beyond the limit', async () => {
  const candidate = response();
  candidate.headers.delete('content-length');
  const oversized = Buffer.alloc(2_200, 0x61);
  candidate.body = new ReadableStream({
    start(controller) {
      controller.enqueue(oversized);
      controller.enqueue(oversized);
      controller.close();
    },
  });
  const adapter = admission(async () => candidate);
  await assert.rejects(
    adapter.resolve({ subject: 'wp:123', session: session() }),
    (error) => error instanceof WordPressCurrentUserAdmissionError
      && error.code === 'RESPONSE_TOO_LARGE',
  );
});

test('accepts only the exact fresh five-field receipt contract', async () => {
  const invalidReceipts = [
    { ...receipt(), evidence: 'private' },
    { ...receipt(), subject: 'wp:456' },
    { ...receipt(), admitted: false },
    { ...receipt(), contract: 'missionmed.lor.wordpress-admission.v1' },
    { ...receipt(), evaluatedAt: '2026-08-25T16:01:00.000Z' },
    { ...receipt(), evaluatedAt: '2026-08-25T15:50:00.000Z' },
    { ...receipt(), expiresAt: '2026-08-25T16:00:00.000Z' },
    { ...receipt(), expiresAt: '2026-08-25T16:10:00.000Z' },
    { ...receipt(), evaluatedAt: '2026-08-25T15:59:30+00:00' },
  ];
  for (const candidate of invalidReceipts) {
    const adapter = admission(async () => response(candidate));
    await assert.rejects(
      adapter.resolve({ subject: 'wp:123', session: session() }),
      WordPressCurrentUserAdmissionError,
    );
  }
});

test('requires an exact HTTPS origin with no path, credentials, query, or fragment', () => {
  for (const origin of [
    'http://missionmed.example.test',
    'https://missionmed.example.test/',
    'https://missionmed.example.test/path',
    'https://user:pass@missionmed.example.test',
    'https://missionmed.example.test?query=1',
    'https://missionmed.example.test#fragment',
  ]) {
    assert.throws(
      () => createWordPressCurrentUserAdmission({ origin, fetchImplementation: async () => response() }),
      /ORIGIN_INVALID/u,
    );
  }
});
