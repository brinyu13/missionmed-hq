import { createHmac, timingSafeEqual } from 'node:crypto';

function constantTimeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000)) {
  const pieces = Object.fromEntries(String(signatureHeader || '').split(',').map(part => part.split('=', 2)));
  const timestamp = Number(pieces.t);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds || !pieces.v1) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return constantTimeEqual(expected, pieces.v1);
}

export class StripeGateway {
  constructor({ secretKey, webhookSecret, apiVersion = '2026-08-27.basil', mode = 'disabled' }) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
    this.apiVersion = apiVersion;
    this.mode = mode;
  }

  assertTestMode() {
    if (this.mode !== 'test' || !this.secretKey?.startsWith('sk_test_')) throw new Error('Stripe mutation is disabled outside configured Test Mode');
  }

  async request(path, params, idempotencyKey) {
    this.assertTestMode();
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
        'stripe-version': this.apiVersion,
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: new URLSearchParams(params),
    });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error?.message || 'Stripe request failed'), { status: response.status, stripe: body });
    return body;
  }

  createSetupIntent(customerId, studentId, requestId) {
    return this.request('setup_intents', {
      customer: customerId,
      usage: 'off_session',
      'payment_method_types[]': 'card',
      'metadata[student_id]': studentId,
      'metadata[request_id]': requestId,
    }, `missionaccounts:setup:${studentId}:${requestId}`);
  }

  createDayCharge({ customerId, paymentMethodId, studentId, attendanceDayId }) {
    return this.request('payment_intents', {
      amount: '2500',
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: 'true',
      off_session: 'true',
      'metadata[student_id]': studentId,
      'metadata[attendance_day_id]': attendanceDayId,
    }, `missionaccounts:billable-day:${attendanceDayId}:v1`);
  }
}
