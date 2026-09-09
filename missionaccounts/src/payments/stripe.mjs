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
  constructor({ secretKey, webhookSecret, apiVersion = '', mode = 'disabled', liveMutationsEnabled = false } = {}) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
    this.apiVersion = apiVersion;
    this.mode = mode;
    this.liveMutationsEnabled = liveMutationsEnabled === true;
  }

  verifyWebhook(rawBody, signatureHeader) {
    if (!this.webhookSecret) throw Object.assign(new Error('Stripe webhook handling is not configured'), { status: 503 });
    if (!verifyStripeSignature(rawBody, signatureHeader, this.webhookSecret)) {
      throw Object.assign(new Error('Stripe webhook signature invalid'), { status: 400 });
    }
  }

  assertTestMode() {
    if (this.mode !== 'test' || !/^(?:sk|rk)_test_/.test(String(this.secretKey || ''))) {
      throw new Error('Stripe mutation is disabled outside configured Test Mode');
    }
  }

  assertMutationAllowed() {
    const key = String(this.secretKey || '');
    const testAllowed = this.mode === 'test' && /^(?:sk|rk)_test_/.test(key);
    const liveAllowed = this.mode === 'live'
      && this.liveMutationsEnabled
      && /^(?:sk|rk)_live_/.test(key);
    if (!testAllowed && !liveAllowed) {
      throw new Error('Stripe mutation is disabled for this environment');
    }
  }

  assertConfigured() {
    if (!/^(?:sk|rk)_(?:test|live)_/.test(String(this.secretKey || ''))) {
      throw Object.assign(new Error('Stripe is not configured'), { status: 503 });
    }
  }

  configurationState() {
    const key = String(this.secretKey || '');
    const keyMode = /^(?:sk|rk)_test_/.test(key) ? 'test'
      : /^(?:sk|rk)_live_/.test(key) ? 'live'
        : 'unconfigured';
    return {
      mode: this.mode,
      key_mode: keyMode,
      credentials_configured: keyMode !== 'unconfigured',
      webhook_configured: /^whsec_[A-Za-z0-9_]+$/.test(String(this.webhookSecret || '')),
      mutations_enabled: (this.mode === 'test' && keyMode === 'test')
        || (this.mode === 'live' && keyMode === 'live' && this.liveMutationsEnabled),
      live_mutations_enabled: this.mode === 'live' && keyMode === 'live' && this.liveMutationsEnabled,
    };
  }

  async request(path, params, idempotencyKey) {
    this.assertMutationAllowed();
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

  async retrieve(path) {
    this.assertConfigured();
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        ...(this.apiVersion ? { 'stripe-version': this.apiVersion } : {}),
      },
    });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error?.message || 'Stripe request failed'), { status: response.status, stripe: body });
    return body;
  }

  createCustomer({ studentId, email, name }) {
    return this.request('customers', {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      'metadata[student_id]': studentId,
    }, `missionaccounts:customer:${studentId}`);
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

  retrievePaymentMethod(paymentMethodId) {
    if (!/^pm_[A-Za-z0-9_]+$/.test(String(paymentMethodId || ''))) {
      throw Object.assign(new Error('Stripe payment method reference is invalid'), { status: 400 });
    }
    return this.retrieve(`payment_methods/${encodeURIComponent(paymentMethodId)}`);
  }

  detachPaymentMethod(paymentMethodId, requestId) {
    if (!/^pm_[A-Za-z0-9_]+$/.test(String(paymentMethodId || ''))) {
      throw Object.assign(new Error('Stripe payment method reference is invalid'), { status: 400 });
    }
    return this.request(
      `payment_methods/${encodeURIComponent(paymentMethodId)}/detach`,
      {},
      `missionaccounts:payment-method-remove:${requestId}`,
    );
  }

  createDayCharge({ customerId, paymentMethodId, studentId, attendanceDayId, receiptEmail }) {
    const normalizedReceiptEmail = String(receiptEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedReceiptEmail)) {
      throw Object.assign(new Error('A valid student receipt email is required before charging'), { status: 409 });
    }
    return this.request('payment_intents', {
      amount: '2500',
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      receipt_email: normalizedReceiptEmail,
      confirm: 'true',
      off_session: 'true',
      'metadata[student_id]': studentId,
      'metadata[attendance_day_id]': attendanceDayId,
    }, `missionaccounts:billable-day:${attendanceDayId}:v1`);
  }

  createManualCycleCharge({
    customerId, paymentMethodId, studentId, cycleKey, decisionId,
    manualCycleChargeId, amountCents, receiptEmail, idempotencyKey,
  }) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const normalizedReceiptEmail = String(receiptEmail || '').trim().toLowerCase();
    if (!/^cus_[A-Za-z0-9_]+$/.test(String(customerId || ''))
      || !/^pm_[A-Za-z0-9_]+$/.test(String(paymentMethodId || ''))
      || !uuid.test(String(studentId || ''))
      || !uuid.test(String(decisionId || ''))
      || !uuid.test(String(manualCycleChargeId || ''))
      || !/^2026-cycle-[123]$/.test(String(cycleKey || ''))
      || !Number.isInteger(amountCents) || amountCents <= 0
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedReceiptEmail)
      || String(idempotencyKey || '') !== `missionaccounts:manual-cycle:${decisionId}:v1`) {
      throw Object.assign(new Error('Stripe manual cycle charge request is invalid'), { status: 400 });
    }
    return this.request('payment_intents', {
      amount: String(amountCents),
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      receipt_email: normalizedReceiptEmail,
      confirm: 'true',
      off_session: 'true',
      'metadata[kind]': 'manual_cycle_charge',
      'metadata[manual_cycle_charge_id]': manualCycleChargeId,
      'metadata[student_id]': studentId,
      'metadata[cycle_key]': cycleKey,
      'metadata[billing_decision_id]': decisionId,
      'metadata[amount_cents]': String(amountCents),
    }, idempotencyKey);
  }

  async createHostedInvoice({ customerId, internalInvoiceId, studentId, cycleKey, amountCents, description, dueDays }) {
    if (!/^cus_[A-Za-z0-9_]+$/.test(String(customerId || ''))
      || !/^[0-9a-f-]{36}$/i.test(String(internalInvoiceId || ''))
      || !/^[0-9a-f-]{36}$/i.test(String(studentId || ''))
      || !Number.isInteger(amountCents) || amountCents <= 0
      || !Number.isInteger(dueDays) || dueDays < 1 || dueDays > 90
      || !String(cycleKey || '').trim() || !String(description || '').trim()) {
      throw Object.assign(new Error('Stripe hosted invoice request is invalid'), { status: 400 });
    }
    const invoice = await this.request('invoices', {
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: String(dueDays),
      auto_advance: 'false',
      description: String(description).slice(0, 500),
      'metadata[missionaccounts_invoice_id]': internalInvoiceId,
      'metadata[student_id]': studentId,
      'metadata[cycle_key]': cycleKey,
    }, `missionaccounts:hosted-invoice:${internalInvoiceId}:v1`);
    if (!/^in_[A-Za-z0-9_]+$/.test(String(invoice.id || ''))
      || invoice.customer !== customerId
      || invoice.metadata?.missionaccounts_invoice_id !== internalInvoiceId) {
      throw Object.assign(new Error('Stripe hosted invoice binding is invalid'), { status: 502 });
    }

    let current = invoice;
    if (current.status === 'draft') {
      await this.request('invoiceitems', {
        customer: customerId,
        invoice: current.id,
        amount: String(amountCents),
        currency: 'usd',
        description: String(description).slice(0, 500),
        'metadata[missionaccounts_invoice_id]': internalInvoiceId,
      }, `missionaccounts:hosted-invoice-item:${internalInvoiceId}:v1`);
      current = await this.request(`invoices/${encodeURIComponent(current.id)}/finalize`, {
        auto_advance: 'false',
      }, `missionaccounts:hosted-invoice-finalize:${internalInvoiceId}:v1`);
    }
    if (!['open', 'paid'].includes(current.status)
      || Number(current.amount_due) !== amountCents
      || current.customer !== customerId) {
      throw Object.assign(new Error('Stripe finalized invoice controls do not match MissionAccounts'), { status: 502 });
    }
    if (current.status === 'open') {
      current = await this.request(`invoices/${encodeURIComponent(current.id)}/send`, {},
        `missionaccounts:hosted-invoice-send:${internalInvoiceId}:v1`);
    }
    return current;
  }

  resendHostedInvoice(providerInvoiceId, internalInvoiceId, requestId) {
    if (!/^in_[A-Za-z0-9_]+$/.test(String(providerInvoiceId || ''))) {
      throw Object.assign(new Error('Stripe invoice reference is invalid'), { status: 400 });
    }
    return this.request(`invoices/${encodeURIComponent(providerInvoiceId)}/send`, {},
      `missionaccounts:hosted-invoice-resend:${internalInvoiceId}:${requestId}`);
  }

  voidHostedInvoice(providerInvoiceId, internalInvoiceId, requestId) {
    if (!/^in_[A-Za-z0-9_]+$/.test(String(providerInvoiceId || ''))) {
      throw Object.assign(new Error('Stripe invoice reference is invalid'), { status: 400 });
    }
    return this.request(`invoices/${encodeURIComponent(providerInvoiceId)}/void`, {},
      `missionaccounts:hosted-invoice-void:${internalInvoiceId}:${requestId}`);
  }

  retrieveAccount() {
    return this.retrieve('account');
  }
}
