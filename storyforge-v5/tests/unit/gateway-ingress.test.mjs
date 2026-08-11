import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { createGatewayIngressVerifier } from '../../server/gateway-ingress.mjs';

const secret = 'g'.repeat(48);
const pseudonym = 'a'.repeat(64);
const timestamp = '1786417200';
const pathname = `/api/requests/guest/${'A'.repeat(43)}`;

function request(overrides = {}) {
  const method = overrides.method || 'GET';
  const signature = createHmac('sha256', secret)
    .update(`${method}\n${pathname}\n${timestamp}\n${pseudonym}`)
    .digest('hex');
  return {
    method,
    headers: {
      'x-storyforge-client-pseudonym': pseudonym,
      'x-storyforge-gateway-timestamp': timestamp,
      'x-storyforge-gateway-signature': signature,
      ...(overrides.headers || {}),
    },
  };
}

test('accepts a current gateway-signed privacy-safe client pseudonym', () => {
  const verify = createGatewayIngressVerifier({
    environment: { STORYFORGE_GATEWAY_SHARED_SECRET: secret },
    now: () => Number(timestamp) * 1000,
  });
  assert.equal(verify(request(), pathname), pseudonym);
});

test('rejects missing configuration, direct bypass, replay, and path tampering', () => {
  assert.throws(() => createGatewayIngressVerifier({ environment: {} })(request(), pathname),
    (error) => error.code === 'gateway_ingress_unavailable' && error.status === 503);
  const verify = createGatewayIngressVerifier({
    environment: { STORYFORGE_GATEWAY_SHARED_SECRET: secret },
    now: () => Number(timestamp) * 1000,
  });
  assert.throws(() => verify({ method: 'GET', headers: {} }, pathname),
    (error) => error.code === 'gateway_ingress_required');
  assert.throws(() => verify(request(), `${pathname}/extra`),
    (error) => error.code === 'gateway_ingress_required');
  const expired = createGatewayIngressVerifier({
    environment: { STORYFORGE_GATEWAY_SHARED_SECRET: secret },
    now: () => (Number(timestamp) + 91) * 1000,
  });
  assert.throws(() => expired(request(), pathname),
    (error) => error.code === 'gateway_ingress_expired');
});
