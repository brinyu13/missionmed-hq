import { createHmac, timingSafeEqual } from 'node:crypto';

function constantTimeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000)) {
  if (!secret) return false;
  const pieces = String(signatureHeader || '').split(',').reduce((result, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return result;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key && value) (result[key] ||= []).push(value);
    return result;
  }, {});
  const timestamp = Number(pieces.t?.[0]);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceSeconds || !pieces.v1?.length) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return pieces.v1.some(signature => constantTimeEqual(expected, signature));
}

export class StripeGateway {
  constructor({ secretKey, webhookSecret, apiVersion = '', mode = 'disabled' } = {}) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
    this.apiVersion = apiVersion;
    this.mode = mode;
  }

  verifyWebhook(rawBody, signatureHeader) {
    if (!this.webhookSecret) throw Object.assign(new Error('Stripe webhook handling is not configured'), { status: 503 });
    if (!verifyStripeSignature(rawBody, signatureHeader, this.webhookSecret)) {
      throw Object.assign(new Error('Stripe webhook signature invalid'), { status: 400 });
    }
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
        ...(this.apiVersion ? { 'stripe-version': this.apiVersion } : {}),
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
