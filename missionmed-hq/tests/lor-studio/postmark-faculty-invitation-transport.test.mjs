import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PostmarkFacultyInvitationAdapter,
  isAuthenticPostmarkFacultyInvitationAdapter,
} from '../../lor-studio/adapters/faculty-otp-postmark-adapters.mjs';
import {
  POSTMARK_FACULTY_INVITATION_TRANSPORT_CONTRACT,
  PostmarkFacultyInvitationTransport,
  isAuthenticPostmarkFacultyInvitationTransport,
} from '../../lor-studio/adapters/postmark-faculty-invitation-transport.mjs';
import { IntegrationDisabledError, ValidationError } from '../../lor-studio/domain/errors.js';
import { hashFacultyEmail } from '../../lor-studio/security/faculty-invitations.js';

const ENDPOINT = 'https://api.postmarkapp.com/email/withTemplate';
const SECRET = 'postmark-test-server-token-value';
const T0 = new Date('2026-08-25T15:00:00.000Z');
const RECIPIENT = 'writer@example.test';
const RECIPIENT_HASH = hashFacultyEmail(RECIPIENT);
const INVITATION_ID = 'invitation-transport-1';
const RAW_TOKEN = 'a'.repeat(43);

const TRANSPORT_BINDING = Object.freeze({
  schemaVersion: 'missionmed.lor.postmark-transport-binding.v1',
  provider: 'postmark',
  providerResourceBound: true,
  independentlyVerified: true,
  serverId: 'postmark-server-lor-production',
  senderIdentityVerified: true,
  templateVerified: true,
  fromEmail: 'lor@example.test',
  replyToEmail: 'support@example.test',
  invitationOrigin: 'https://example.test',
  invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
  templateAlias: 'lor-faculty-invitation-v1',
  messageStream: 'outbound',
});

const ADAPTER_BINDING = Object.freeze({
  providerResourceBound: true,
  independentlyVerified: true,
  provider: 'postmark',
  senderIdentityVerified: true,
  serverSideCredentials: true,
  invitationOrigin: 'https://example.test',
  invitationRouteTemplate: '/lor-studio/invitations/{invitationId}',
  templateAlias: 'lor-faculty-invitation-v1',
});

function request(overrides = {}) {
  return {
    provider: 'postmark',
    recipientEmail: RECIPIENT,
    recipientEmailHash: RECIPIENT_HASH,
    invitationId: INVITATION_ID,
    invitationUrl: `https://example.test/lor-studio/invitations/${INVITATION_ID}#token=${RAW_TOKEN}`,
    oneTimeCode: '482901',
    otpExpiresAt: '2026-08-25T15:10:00.000Z',
    expiresAt: '2026-09-01T15:00:00.000Z',
    templateAlias: 'lor-faculty-invitation-v1',
    protectedLetterContent: null,
    ...overrides,
  };
}

function providerPayload(overrides = {}) {
  return {
    ErrorCode: 0,
    Message: 'OK',
    MessageID: '00000000-1111-2222-3333-444444444444',
    SubmittedAt: T0.toISOString(),
    To: RECIPIENT,
    ...overrides,
  };
}

function jsonResponse(payload, {
  status = 200,
  url = ENDPOINT,
  contentType = 'application/json; charset=utf-8',
  declaredLength,
} = {}) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    url,
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        const normalized = String(name).toLowerCase();
        if (normalized === 'content-type') return contentType;
        if (normalized === 'content-length') {
          return String(declaredLength ?? Buffer.byteLength(raw, 'utf8'));
        }
        return null;
      },
    },
    async text() { return raw; },
  };
}

function credentialProvider(tokens = [SECRET]) {
  const calls = [];
  let index = 0;
  return {
    serverOnly: true,
    calls,
    async getServerToken(providerRequest) {
      calls.push(providerRequest);
      return tokens[Math.min(index++, tokens.length - 1)];
    },
  };
}

function harness({
  binding = TRANSPORT_BINDING,
  credentials = credentialProvider(),
  response = jsonResponse(providerPayload()),
  fetchImplementation,
  timeoutMs = 100,
  clock = () => T0,
} = {}) {
  const calls = [];
  const fetcher = fetchImplementation ?? (async (url, options) => {
    calls.push({ url, options });
    return response;
  });
  const transport = new PostmarkFacultyInvitationTransport({
    binding,
    credentialProvider: credentials,
    fetchImplementation: fetcher,
    timeoutMs,
    clock,
  });
  return { calls, credentials, transport };
}

function assertSafeFailure(error) {
  assert.ok(error instanceof IntegrationDisabledError);
  const serialized = `${error.message} ${JSON.stringify(error.details)} ${JSON.stringify(error)}`;
  assert.equal(serialized.includes(SECRET), false);
  assert.equal(serialized.includes(RECIPIENT), false);
  assert.equal(serialized.includes(RAW_TOKEN), false);
  assert.equal('cause' in error, false);
  return true;
}

test('transport sends one exact non-tracking template request and returns a bound canonical receipt', async () => {
  const credentials = credentialProvider([SECRET, 'postmark-second-token-value']);
  const { calls, transport } = harness({ credentials });
  const receipt = await transport.sendBoundInvitation(request());
  await transport.sendBoundInvitation(request());

  assert.equal(calls.length, 2);
  assert.deepEqual(credentials.calls, [
    {
      provider: 'postmark',
      purpose: 'lor_faculty_invitation_delivery',
      serverId: TRANSPORT_BINDING.serverId,
    },
    {
      provider: 'postmark',
      purpose: 'lor_faculty_invitation_delivery',
      serverId: TRANSPORT_BINDING.serverId,
    },
  ]);
  const { url, options } = calls[0];
  assert.equal(url, ENDPOINT);
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(options.headers, {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Postmark-Server-Token': SECRET,
  });
  const body = JSON.parse(options.body);
  assert.deepEqual(body, {
    From: 'lor@example.test',
    To: RECIPIENT,
    ReplyTo: 'support@example.test',
    TemplateAlias: 'lor-faculty-invitation-v1',
    TemplateModel: {
      invitation_url: request().invitationUrl,
      one_time_code: '482901',
      otp_expires_at: '2026-08-25T15:10:00.000Z',
      invitation_expires_at: '2026-09-01T15:00:00.000Z',
    },
    MessageStream: 'outbound',
    TrackOpens: false,
    TrackLinks: 'None',
    Tag: 'lor-faculty-invitation',
  });
  assert.equal('Attachments' in body, false);
  assert.equal('HtmlBody' in body, false);
  assert.equal('TextBody' in body, false);
  assert.equal(options.body.includes('protectedLetterContent'), false);
  assert.equal(options.body.includes(SECRET), false);
  assert.equal(calls[1].options.headers['X-Postmark-Server-Token'], 'postmark-second-token-value');
  assert.deepEqual(receipt, {
    accepted: true,
    invitationId: INVITATION_ID,
    recipientEmailHash: RECIPIENT_HASH,
    invitationPath: `/lor-studio/invitations/${INVITATION_ID}`,
    templateAlias: 'lor-faculty-invitation-v1',
    messageId: '00000000-1111-2222-3333-444444444444',
    acceptedAt: T0.toISOString(),
  });
  assert.equal(JSON.stringify(transport).includes(SECRET), false);
});

test('transport composes with the policy adapter and leaves only hashed recipient/provider references', async () => {
  const { transport } = harness();
  const adapter = new PostmarkFacultyInvitationAdapter({
    binding: ADAPTER_BINDING,
    transport,
    clock: () => T0,
  });
  const receipt = await adapter.sendFacultyInvitation({
    invitationId: INVITATION_ID,
    invitationToken: RAW_TOKEN,
    recipientEmail: RECIPIENT,
    recipientEmailHash: RECIPIENT_HASH,
    invitationUrl: `https://example.test/lor-studio/invitations/${INVITATION_ID}`,
    oneTimeCode: '482901',
    otpExpiresAt: '2026-08-25T15:10:00.000Z',
    expiresAt: '2026-09-01T15:00:00.000Z',
    templateAlias: 'lor-faculty-invitation-v1',
  });
  assert.equal(receipt.status, 'accepted_for_delivery');
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes(RECIPIENT), false);
  assert.equal(serialized.includes(RAW_TOKEN), false);
  assert.equal(serialized.includes('00000000-1111-2222-3333-444444444444'), false);
});

test('only exact constructed Postmark transport and policy adapters satisfy authenticity', () => {
  const { transport } = harness();
  const adapter = new PostmarkFacultyInvitationAdapter({
    binding: ADAPTER_BINDING,
    transport,
    clock: () => T0,
  });
  assert.equal(isAuthenticPostmarkFacultyInvitationTransport(transport), true);
  assert.equal(isAuthenticPostmarkFacultyInvitationAdapter(adapter), true);

  for (const lookalike of [
    null,
    {},
    { async sendBoundInvitation() {} },
    Object.create(PostmarkFacultyInvitationTransport.prototype),
    new Proxy(transport, {}),
  ]) assert.equal(isAuthenticPostmarkFacultyInvitationTransport(lookalike), false);
  for (const lookalike of [
    null,
    {},
    { async sendFacultyInvitation() {} },
    Object.create(PostmarkFacultyInvitationAdapter.prototype),
    new Proxy(adapter, {}),
  ]) assert.equal(isAuthenticPostmarkFacultyInvitationAdapter(lookalike), false);

  class OverriddenTransport extends PostmarkFacultyInvitationTransport {
    async sendBoundInvitation() { return { accepted: true }; }
  }
  const overriddenTransport = new OverriddenTransport({
    binding: TRANSPORT_BINDING,
    credentialProvider: credentialProvider(),
    fetchImplementation: async () => jsonResponse(providerPayload()),
    clock: () => T0,
    timeoutMs: 100,
  });
  assert.equal(isAuthenticPostmarkFacultyInvitationTransport(overriddenTransport), false);

  class OverriddenAdapter extends PostmarkFacultyInvitationAdapter {
    async sendFacultyInvitation() { return { status: 'accepted_for_delivery' }; }
  }
  const overriddenAdapter = new OverriddenAdapter({
    binding: ADAPTER_BINDING,
    transport,
    clock: () => T0,
  });
  assert.equal(isAuthenticPostmarkFacultyInvitationAdapter(overriddenAdapter), false);
});

test('binding must be exact, verified and tied to the fixed template, origin and stream', () => {
  const invalidBindings = [
    null,
    {},
    { ...TRANSPORT_BINDING, providerResourceBound: false },
    { ...TRANSPORT_BINDING, independentlyVerified: false },
    { ...TRANSPORT_BINDING, senderIdentityVerified: false },
    { ...TRANSPORT_BINDING, templateVerified: false },
    { ...TRANSPORT_BINDING, serverId: '' },
    { ...TRANSPORT_BINDING, invitationOrigin: 'http://example.test' },
    { ...TRANSPORT_BINDING, templateAlias: 'unbound-template' },
    { ...TRANSPORT_BINDING, messageStream: 'broadcast' },
    { ...TRANSPORT_BINDING, extra: true },
  ];
  for (const binding of invalidBindings) {
    assert.throws(
      () => harness({ binding }),
      assertSafeFailure,
    );
  }
});

test('hostile or mismatched requests fail before credentials or provider I/O', async () => {
  const { transport, credentials, calls } = harness();
  const invalidRequests = [
    request({ protectedLetterContent: 'private letter' }),
    request({ recipientEmailHash: '0'.repeat(64) }),
    request({ invitationUrl: `https://evil.example/lor-studio/invitations/${INVITATION_ID}#token=${RAW_TOKEN}` }),
    request({ invitationUrl: `https://example.test/lor-studio/invitations/${INVITATION_ID}?token=${RAW_TOKEN}` }),
    request({ invitationUrl: `https://example.test/lor-studio/invitations/${INVITATION_ID}` }),
    request({ oneTimeCode: 'not-otp' }),
    request({ otpExpiresAt: '2026-08-25T15:00:00.000Z' }),
    request({ expiresAt: '2026-08-25T14:59:59.999Z' }),
    request({ otpExpiresAt: '2026-09-02T15:00:00.000Z' }),
    { ...request(), attackerSecret: 'must-not-echo' },
  ];
  for (const invalid of invalidRequests) {
    await assert.rejects(() => transport.sendBoundInvitation(invalid), ValidationError);
  }
  assert.equal(credentials.calls.length, 0);
  assert.equal(calls.length, 0);

  let getterCalls = 0;
  const accessorRequest = request();
  Object.defineProperty(accessorRequest, 'recipientEmail', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return RECIPIENT;
    },
  });
  await assert.rejects(() => transport.sendBoundInvitation(accessorRequest), ValidationError);
  assert.equal(getterCalls, 0);
});

test('provider, response-shape, origin, size and freshness failures are fixed and redacted', async () => {
  const cases = [
    jsonResponse({ ErrorCode: 10, Message: `${SECRET} ${RECIPIENT} ${RAW_TOKEN}` }, { status: 422 }),
    jsonResponse(providerPayload(), { status: 429 }),
    jsonResponse(providerPayload(), { status: 500 }),
    jsonResponse(providerPayload(), { url: 'https://evil.example/email/withTemplate' }),
    jsonResponse(providerPayload(), { contentType: 'text/html' }),
    jsonResponse('{'),
    jsonResponse(providerPayload({ ErrorCode: 1 })),
    jsonResponse(providerPayload({ MessageID: '' })),
    jsonResponse(providerPayload({ To: 'other@example.test' })),
    jsonResponse(providerPayload({ SubmittedAt: '2026-08-25T14:54:59.999Z' })),
    jsonResponse(providerPayload({ SubmittedAt: '2026-08-25T15:00:30.001Z' })),
    jsonResponse(providerPayload(), { declaredLength: 200_000 }),
    jsonResponse(`"${'x'.repeat(140_000)}"`, { declaredLength: 10 }),
  ];
  for (const response of cases) {
    const { transport } = harness({ response });
    await assert.rejects(() => transport.sendBoundInvitation(request()), assertSafeFailure);
  }
});

test('network ambiguity is attempted exactly once and never retried', async () => {
  let calls = 0;
  const { transport } = harness({
    fetchImplementation: async () => {
      calls += 1;
      throw new Error(`${SECRET} ${RECIPIENT} ${RAW_TOKEN}`);
    },
  });
  await assert.rejects(() => transport.sendBoundInvitation(request()), assertSafeFailure);
  assert.equal(calls, 1);
});

test('timeout aborts the one delivery attempt and returns a fixed safe failure', async () => {
  let sawAbort = false;
  const { transport } = harness({
    timeoutMs: 5,
    fetchImplementation: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        sawAbort = true;
        reject(new Error(`${SECRET} ${RECIPIENT} ${RAW_TOKEN}`));
      }, { once: true });
    }),
  });
  await assert.rejects(() => transport.sendBoundInvitation(request()), assertSafeFailure);
  assert.equal(sawAbort, true);
});

test('transport contract is fixed to the provider endpoint and disables tracking and retries', () => {
  assert.deepEqual(POSTMARK_FACULTY_INVITATION_TRANSPORT_CONTRACT, {
    endpoint: ENDPOINT,
    bindingSchema: 'missionmed.lor.postmark-transport-binding.v1',
    templateAlias: 'lor-faculty-invitation-v1',
    messageStream: 'outbound',
    tracking: 'disabled',
    retries: 'none_on_ambiguous_delivery',
    maximumRequestBytes: 64_000,
    maximumResponseBytes: 128_000,
  });
});
