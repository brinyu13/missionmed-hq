import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { StripeGateway, verifyStripeSignature } from '../src/payments/stripe.mjs';

test('Stripe webhook signature verification accepts valid signed payload once within tolerance', () => {
  const secret = 'whsec_test';
  const body = '{"id":"evt_1"}';
  const timestamp = 1_800_000_000;
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, 300, timestamp + 10), true);
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret, 300, timestamp + 301), false);
});

test('Stripe webhook verification accepts any valid v1 signature during secret rotation', () => {
  const secret = 'whsec_rotating';
  const body = '{"id":"evt_rotation"}';
  const timestamp = 1_800_000_000;
  const valid = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=invalid,v0=legacy,v1=${valid}`, secret, 300, timestamp), true);
  assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=invalid,v1=also-invalid`, secret, 300, timestamp), false);
});

test('Stripe requests use the account default API version unless an explicit verified version is configured', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ id: 'seti_test' }) };
  };
  try {
    const accountDefault = new StripeGateway({ secretKey: 'sk_test_example', mode: 'test' });
    await accountDefault.createSetupIntent('cus_1', 'student_1', 'request_1');
    assert.equal(requests[0].options.headers['stripe-version'], undefined);

    const pinned = new StripeGateway({ secretKey: 'sk_test_example', mode: 'test', apiVersion: '2026-02-25.clover' });
    await pinned.createSetupIntent('cus_1', 'student_1', 'request_2');
    assert.equal(requests[1].options.headers['stripe-version'], '2026-02-25.clover');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Stripe mutations fail closed unless configured with a Test Mode key', async () => {
  const gateway = new StripeGateway({ secretKey: 'sk_live_forbidden', mode: 'test' });
  await assert.rejects(() => gateway.createSetupIntent('cus_1', 'student_1', 'request_1'), /disabled outside configured Test Mode/);
});
