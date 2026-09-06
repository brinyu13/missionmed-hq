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

test('Stripe mutations fail closed unless configured with a Test Mode key', async () => {
  const gateway = new StripeGateway({ secretKey: 'sk_live_forbidden', mode: 'test' });
  await assert.rejects(() => gateway.createSetupIntent('cus_1', 'student_1', 'request_1'), /disabled outside configured Test Mode/);
});
