import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { StripeGateway } from '../src/payments/stripe.mjs';
import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';

const localConfig = {
  production: false,
  localAuth: true,
  issuer: 'https://issuer.invalid',
  audience: 'missionaccounts',
  jwksUrl: 'https://issuer.invalid/jwks',
};

async function withServer(options, run) {
  const server = createMissionAccountsServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
}

function stripeSignature(body, secret, timestamp) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test('Stripe webhook verifies the untouched body and stores a retry only once', async () => {
  const secret = 'whsec_server_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const body = '{\n  "id": "evt_1", "type": "payment_intent.succeeded", "data": {"object": {"id": "pi_1"}}\n}';
  const headers = { 'content-type': 'application/json', 'stripe-signature': stripeSignature(body, secret, timestamp) };
  await withServer({
    config: localConfig,
    store: new PreviewStore(),
    stripeGateway: new StripeGateway({ webhookSecret: secret }),
  }, async base => {
    const first = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { received: true, duplicate: false });

    const retry = await fetch(`${base}/api/webhooks/stripe`, { method: 'POST', headers, body });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), { received: true, duplicate: true });
  });
});

test('Stripe webhook fails closed before parsing or storing an invalid signature', async () => {
  await withServer({
    config: localConfig,
    store: new PreviewStore(),
    stripeGateway: new StripeGateway({ webhookSecret: 'whsec_server_test' }),
  }, async base => {
    const response = await fetch(`${base}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=invalid' },
      body: '{not json}',
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /signature invalid/);
  });
});

test('student role cannot read the administrative health endpoint', async () => {
  await withServer({
    config: localConfig,
    store: new PreviewStore(),
    stripeGateway: new StripeGateway(),
  }, async base => {
    const response = await fetch(`${base}/api/admin/health`, { headers: { 'x-missionaccounts-local-role': 'student' } });
    assert.equal(response.status, 403);
  });
});
