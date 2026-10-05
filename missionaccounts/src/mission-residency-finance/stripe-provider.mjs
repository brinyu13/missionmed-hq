import { StripeGateway } from '../payments/stripe.mjs';
import { fail, requestIdentity, cents } from './operations-domain.mjs';

// A separate instance and account pin: never use the ExamPrep gateway/customer binding.
export class MissionResidencyStripe extends StripeGateway {
  constructor({ accountId, ...options } = {}) { super({ requestTimeoutMs: 15_000, ...options }); this.accountId = accountId; }
  async verifyAccount() {
    if (!/^acct_[A-Za-z0-9]+$/.test(this.accountId || '')) throw fail('Mission Residency Stripe account is not pinned', 503);
    const account = await this.retrieveAccount();
    if (account.id !== this.accountId || account.charges_enabled !== true) throw fail('Mission Residency Stripe account verification failed', 503);
    return { id: account.id, charges_enabled: true };
  }
  async createResidencyCustomer({ subjectKey, email, name }) {
    await this.verifyAccount();
    return this.request('customers', { email, name, 'metadata[namespace]': 'mission_residency_finance',
      'metadata[financial_subject]': subjectKey }, `mr-finance:customer:${subjectKey}:v1`);
  }
  async setupResult(intentId, expected) {
    await this.verifyAccount();
    if (!/^seti_[A-Za-z0-9]+$/.test(intentId || '')) throw fail('Setup reference is invalid', 400);
    const setup = await this.retrieve(`setup_intents/${intentId}?expand[]=payment_method`);
    if (setup.customer !== expected.customerId || setup.metadata?.namespace !== 'mission_residency_finance' ||
        setup.metadata?.financial_subject !== expected.subjectKey || setup.metadata?.request_id !== expected.requestId ||
        setup.livemode !== (this.mode === 'live')) throw fail('Payment setup owner mismatch', 403);
    if (setup.status !== 'succeeded') throw fail('Secure card setup is not complete');
    const method = setup.payment_method;
    if (!/^pm_[A-Za-z0-9]+$/.test(method?.id || '') || method.customer !== expected.customerId || method.type !== 'card' ||
        method.livemode !== setup.livemode || !method.card?.last4) throw fail('Verified saved card is unavailable');
    return { intent_ref: setup.id, provider_account: this.accountId, customer_ref: setup.customer,
      payment_method_ref: method.id, brand: method.card.brand, last4: method.card.last4,
      exp_month: method.card.exp_month, exp_year: method.card.exp_year };
  }
  async createResidencySetup({ customerId, subjectKey, requestId }) {
    await this.verifyAccount(); requestIdentity(requestId);
    return this.request('setup_intents', { customer: customerId, usage: 'off_session', 'payment_method_types[]': 'card',
      'metadata[namespace]': 'mission_residency_finance', 'metadata[financial_subject]': subjectKey,
      'metadata[request_id]': requestId }, `mr-finance:setup:${requestId}:v1`);
  }
  async createResidencyPayment({ attemptId, requestId, customerId, paymentMethodId, subjectKey, amountCents, offSession }) {
    await this.verifyAccount(); requestIdentity(attemptId); requestIdentity(requestId); cents(amountCents);
    if (!/^cus_[A-Za-z0-9]+$/.test(customerId || '') || paymentMethodId && !/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) throw fail('Payment provider binding is invalid', 400);
    if (offSession && !paymentMethodId) throw fail('An authorized saved payment method is required');
    const params = { customer: customerId, amount: String(amountCents), currency: 'usd', 'payment_method_types[]': 'card',
      'metadata[namespace]': 'mission_residency_finance', 'metadata[financial_subject]': subjectKey,
      'metadata[request_id]': requestId, 'metadata[attempt_id]': attemptId };
    if (paymentMethodId) params.payment_method = paymentMethodId;
    if (offSession) { params.confirm = 'true'; params.off_session = 'true'; }
    return this.request('payment_intents', params, `mr-finance:payment:${attemptId}:v1`);
  }
  async paymentResult(intentId, expected) {
    await this.verifyAccount();
    if (!/^pi_[A-Za-z0-9]+$/.test(intentId || '')) throw fail('PaymentIntent reference is invalid', 400);
    const result = await this.retrieve(`payment_intents/${intentId}?expand[]=latest_charge`);
    if (result.customer !== expected.customerId || (expected.paymentMethodId && result.payment_method !== expected.paymentMethodId) || result.amount !== expected.amountCents || result.currency !== 'usd' ||
        result.metadata?.namespace !== 'mission_residency_finance' || result.metadata?.financial_subject !== expected.subjectKey ||
        result.metadata?.attempt_id !== expected.attemptId || result.metadata?.request_id !== expected.requestId || result.livemode !== (this.mode === 'live')) throw fail('Stripe payment ownership or amount mismatch', 403);
    if (result.status !== 'succeeded') return { state: result.status === 'canceled' ? 'CANCELLED' : result.status === 'requires_action' ? 'REQUIRES_ACTION' : result.status === 'requires_payment_method' ? 'DECLINED' : 'PENDING', payment: null };
    const charge = result.latest_charge;
    if (result.amount_received !== expected.amountCents || !charge || charge.paid !== true || charge.captured !== true ||
        charge.amount_captured !== expected.amountCents || charge.amount !== expected.amountCents || charge.currency !== 'usd' ||
        charge.payment_intent !== intentId || charge.refunded || charge.amount_refunded) throw fail('Stripe receipt is incomplete or reversed');
    return { state: 'SUCCEEDED', payment: { intent_id: intentId, charge_id: charge.id, amount_cents: result.amount,
      account_id: this.accountId, received_at: new Date(charge.created * 1000).toISOString() } };
  }
}
