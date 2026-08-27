import assert from 'node:assert/strict';
import test from 'node:test';

import { createProductionProviderRuntime } from '../../lor-studio/adapters/production-provider-runtime.mjs';
import { isAuthenticOpenAiGroundedProposalAdapter } from '../../lor-studio/adapters/openai-grounded-proposal-adapter.mjs';
import { isAuthenticPostmarkFacultyInvitationAdapter } from '../../lor-studio/adapters/faculty-otp-postmark-adapters.mjs';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { signedOpenAiPrivacyEnvironment } from './fixtures/signed-openai-privacy-attestations.mjs';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function probeRequest(dependency) {
  return Object.freeze({
    schemaVersion: 'missionmed.lor.production-provider-probe-request.v1',
    dependency,
    targetRef: sha256('production-provider-runtime-test-target'),
    metadataOnly: true,
    signal: new AbortController().signal,
  });
}

function assertReadyProbe(result) {
  assert.deepEqual(Object.keys(result).sort(), ['errorCode', 'evidenceRef', 'state']);
  assert.equal(result.state, 'ready');
  assert.equal(result.errorCode, '');
  assert.match(result.evidenceRef, /^[a-f0-9]{64}$/u);
}

function environment() {
  return {
    MMHQ_LOR_OPENAI_API_KEY: 'sk-proj-test-token-value',
    MMHQ_LOR_OPENAI_PROJECT_ID: 'proj_lorproduction',
    ...signedOpenAiPrivacyEnvironment('proj_lorproduction'),
    MMHQ_LOR_POSTMARK_SERVER_TOKEN: 'postmark-test-token-value',
    MMHQ_LOR_POSTMARK_SERVER_ID: '12345',
    MMHQ_LOR_POSTMARK_FROM_EMAIL: 'letters@example.test',
    MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL: 'support@example.test',
    MMHQ_LOR_INVITATION_ORIGIN: 'https://hq.example.test',
    MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED: 'true',
    MMHQ_LOR_INVITATION_HMAC_KEY: Buffer.alloc(32, 7).toString('base64url'),
    MMHQ_LOR_INVITATION_HMAC_KEY_VERSION: 'lor-v1',
    MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED: 'true',
  };
}

function jsonResponse(url, payload) {
  return {
    url,
    status: 200,
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    async text() { return JSON.stringify(payload); },
  };
}

test('production provider runtime builds authentic surfaces and bounded metadata-only probes', async () => {
  const calls = [];
  const runtime = await createProductionProviderRuntime({
    environment: environment(),
    clock: () => NOW,
    async fetchImplementation(url, options) {
      calls.push({ url, method: options.method, headers: Object.keys(options.headers).sort() });
      if (url.endsWith('/v1/models')) {
        return jsonResponse(url, { object: 'list', data: [{ id: 'gpt-5.6-terra' }] });
      }
      return jsonResponse(url, { Alias: 'lor-faculty-invitation-v1', Active: true, AssociatedServerId: 12345 });
    },
  });

  assert.equal(isAuthenticOpenAiGroundedProposalAdapter(runtime.aiProposalProvider), true);
  assert.equal(isAuthenticPostmarkFacultyInvitationAdapter(runtime.facultyEmailPort), true);
  assert.equal(typeof runtime.facultyInvitationSecretDeriver.deriveIssue, 'function');
  assert.equal(runtime.facultyInvitationSecretBinding.serverSideSecret, true);
  assert.equal(runtime.facultyInvitationKeyProvider.serverOnly, true);
  assert.equal(typeof runtime.facultyInvitationKeyProvider.getKey, 'function');
  assert.equal(runtime.invitationOrigin, 'https://hq.example.test');
  assertReadyProbe(await runtime.probes.ai(probeRequest('ai')));
  assertReadyProbe(await runtime.probes.email(probeRequest('email')));
  assertReadyProbe(await runtime.probes.otp(probeRequest('otp')));
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['https://api.openai.com/v1/models', 'GET'],
    ['https://api.postmarkapp.com/templates/lor-faculty-invitation-v1', 'GET'],
  ]);
  assert.doesNotMatch(JSON.stringify(runtime), /sk-proj|postmark-test-token|BwcHBw/u);
});

test('provider probes fail closed on cross-server or malformed metadata without leaking credentials', async () => {
  const runtime = await createProductionProviderRuntime({
    environment: environment(),
    clock: () => NOW,
    async fetchImplementation(url) {
      if (url.endsWith('/v1/models')) return jsonResponse(url, { object: 'not-list' });
      return jsonResponse(url, { Alias: 'wrong', Active: true, AssociatedServerId: 999 });
    },
  });
  await assert.rejects(runtime.probes.ai(probeRequest('ai')), /unavailable/u);
  await assert.rejects(runtime.probes.email(probeRequest('email')), /unavailable/u);
  await assert.rejects(runtime.probes.otp(probeRequest('email')), /unavailable/u);
});

test('OpenAI readiness rejects a valid project response when the exact proposal model is absent', async () => {
  const runtime = await createProductionProviderRuntime({
    environment: environment(),
    clock: () => NOW,
    async fetchImplementation(url) {
      if (url.endsWith('/v1/models')) {
        return jsonResponse(url, { object: 'list', data: [{ id: 'different-model' }] });
      }
      return jsonResponse(url, {
        Alias: 'lor-faculty-invitation-v1',
        Active: true,
        AssociatedServerId: 12345,
      });
    },
  });
  await assert.rejects(
    runtime.probes.ai(probeRequest('ai')),
    (error) => error?.code === 'INTEGRATION_DISABLED'
      && error?.details?.status === 'OPENAI_PROBE_RESPONSE_INVALID',
  );
});
