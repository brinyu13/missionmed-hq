import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { StripeGateway, verifyStripeSignature } from '../src/payments/stripe.mjs';
import { confirmStripeSetup, isSafeTestPublishableKey } from '../public/missionaccounts-stripe.js';

test('browser Stripe setup rejects non-test publishable keys', () => {
  assert.equal(isSafeTestPublishableKey('pk_test_browser_123'), true);
  assert.equal(isSafeTestPublishableKey('pk_live_forbidden'), false);
  assert.equal(isSafeTestPublishableKey('sk_test_secret'), false);
  assert.equal(isSafeTestPublishableKey(''), false);
});

test('browser Stripe setup validates Elements before confirmSetup and preserves explicit future-use consent', async () => {
  const calls = [];
  const elements = {
    async submit() { calls.push(['submit']); return {}; },
  };
  const stripe = {
    async confirmSetup(options) {
      calls.push(['confirmSetup', options]);
      return { setupIntent: { status: 'succeeded' } };
    },
  };
  const result = await confirmStripeSetup({
    stripe,
    elements,
    returnUrl: 'https://missionmedinstitute.com/missionaccounts/#/me/billing?stripe_setup=return',
  });
  assert.equal(result.setupIntent.status, 'succeeded');
  assert.equal(calls[0][0], 'submit');
  assert.equal(calls[1][0], 'confirmSetup');
  assert.equal(calls[1][1].elements, elements);
  assert.equal(calls[1][1].redirect, 'if_required');
  assert.deepEqual(calls[1][1].confirmParams, {
    return_url: 'https://missionmedinstitute.com/missionaccounts/#/me/billing?stripe_setup=return',
    payment_method_data: { allow_redisplay: 'always' },
  });
});

test('browser Stripe setup stops on Payment Element validation errors', async () => {
  let confirmed = false;
  const error = { message: 'Card details are incomplete.' };
  const result = await confirmStripeSetup({
    elements: { async submit() { return { error }; } },
    stripe: { async confirmSetup() { confirmed = true; } },
    returnUrl: 'https://missionmedinstitute.com/missionaccounts/',
  });
  assert.equal(result.error, error);
  assert.equal(confirmed, false);
});

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

test('Stripe day charges require and normalize a receipt email', async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return { ok: true, json: async () => ({ id: 'pi_test_receipt_1' }) };
  };
  try {
    const gateway = new StripeGateway({ secretKey: 'sk_test_example', mode: 'test' });
    assert.throws(() => gateway.createDayCharge({
      customerId: 'cus_1', paymentMethodId: 'pm_1', studentId: 'student_1', attendanceDayId: 'day_1',
    }), /receipt email is required/i);
    await gateway.createDayCharge({
      customerId: 'cus_1', paymentMethodId: 'pm_1', studentId: 'student_1', attendanceDayId: 'day_1',
      receiptEmail: ' Verified.Student@Example.org ',
    });
    assert.equal(observed.url, 'https://api.stripe.com/v1/payment_intents');
    assert.equal(observed.options.body.get('receipt_email'), 'verified.student@example.org');
    assert.equal(observed.options.headers['idempotency-key'], 'missionaccounts:billable-day:day_1:v1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Stripe payment-method detach is Test-Mode-only and idempotently keyed', async () => {
  const originalFetch = globalThis.fetch;
  let observed;
  globalThis.fetch = async (url, options) => {
    observed = { url, options };
    return { ok: true, json: async () => ({ id: 'pm_test_remove_1' }) };
  };
  try {
    const gateway = new StripeGateway({ secretKey: 'sk_test_example', mode: 'test' });
    await gateway.detachPaymentMethod('pm_test_remove_1', 'remove-request-0001');
    assert.equal(observed.url, 'https://api.stripe.com/v1/payment_methods/pm_test_remove_1/detach');
    assert.equal(observed.options.method, 'POST');
    assert.equal(observed.options.headers['idempotency-key'], 'missionaccounts:payment-method-remove:remove-request-0001');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
