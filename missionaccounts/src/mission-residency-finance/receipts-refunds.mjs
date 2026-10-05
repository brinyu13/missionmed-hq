import { fail, cents, provenance, requestIdentity } from './operations-domain.mjs';

// Readback only. Issuing a provider refund is a separate explicitly authorized action.
export async function confirmedStripeRefund(stripe, refundId, expected) {
  if (!/^re_[A-Za-z0-9]+$/.test(refundId || '')) throw fail('Refund reference is invalid', 400);
  await stripe.verifyAccount();
  if (stripe.accountId !== expected.provider_account) throw fail('Refund provider account mismatch', 403);
  const refund = await stripe.retrieve(`refunds/${refundId}`);
  if (!/^ch_[A-Za-z0-9]+$/.test(refund?.charge || '')) throw fail('Verified refund charge evidence is required');
  const charge = await stripe.retrieve(`charges/${refund.charge}`);
  if (refund.id !== refundId || refund.status !== 'succeeded' || refund.currency !== 'usd' ||
      refund.amount !== cents(expected.amount_cents) || refund.payment_intent !== expected.provider_identity ||
      refund.livemode !== (stripe.mode === 'live') || charge.id !== refund.charge ||
      charge.payment_intent !== expected.provider_identity || charge.currency !== 'usd' ||
      charge.amount !== expected.gross_cents || charge.amount_refunded < refund.amount ||
      charge.paid !== true || charge.livemode !== refund.livemode) throw fail('Provider-confirmed exact refund evidence is required');
  return { provider: 'Stripe', provider_account: stripe.accountId, provider_identity: expected.provider_identity,
    refund_reference: refund.id, amount_cents: refund.amount, confirmed_at: new Date(refund.created * 1000).toISOString(), confirmed: true };
}

export function canonicalRefundPayload(body, proof) {
  requestIdentity(body.request_id); provenance(body); cents(body.amount_cents);
  if (body.confirmed !== true || proof?.confirmed !== true || proof.amount_cents !== body.amount_cents ||
      !['Stripe', 'Chase', 'Bank'].includes(proof.provider) || !proof.refund_reference || !proof.provider_account || !proof.provider_identity ||
      !Number.isFinite(Date.parse(proof.confirmed_at))) throw fail('Confirmed refund evidence and explicit Founder confirmation are required');
  if (proof.provider !== 'Stripe' && proof.authenticity_verified !== true) throw fail('Verified receiving-bank refund evidence is required');
  if (!Array.isArray(body.reversals) || body.reversals.length > 100) throw fail('Bounded application reversals are required', 400);
  const seen = new Set();
  const reversals = body.reversals.map(r => {
    if (!/^[a-f0-9-]{36}$/i.test(r.application_id || '') || seen.has(r.application_id)) throw fail('Unique canonical application references are required', 400);
    seen.add(r.application_id); return { application_id: r.application_id, amount_cents: cents(r.amount_cents) };
  });
  if (reversals.reduce((n, r) => n + r.amount_cents, 0) > body.amount_cents) throw fail('Reversals exceed the confirmed refund');
  return { ...provenance(body), confirmed: true, amount_cents: body.amount_cents, reversals,
    proof: { provider: proof.provider, provider_account: proof.provider_account, provider_identity: proof.provider_identity,
      refund_reference: proof.refund_reference, amount_cents: proof.amount_cents, confirmed_at: proof.confirmed_at,
      confirmed: true, authenticity_verified: proof.authenticity_verified === true } };
}

export class FinancialReceiptRefundService {
  constructor({ operations, verifiedBankRefund }) { this.operations = operations; this.verifiedBankRefund = verifiedBankRefund; }
  async refund(identity, paymentId, body, requestId) {
    const pair = await this.operations.founder(identity);
    if (!this.operations.config.operations) throw fail('Financial operations are not released', 403);
    requestIdentity(requestId); provenance(body);
    if (body.confirmed !== true) throw fail('Explicit Founder confirmation is required', 400);
    // Context comes from the private canonical ledger, never from browser provider fields.
    const context = await this.operations.store.rpc('api_financial_refund_context', { ...pair, p_payment: paymentId });
    const expected = { ...context, amount_cents: cents(body.amount_cents) };
    let proof;
    if (context.provider === 'Stripe') {
      this.operations.providerReady();
      proof = await confirmedStripeRefund(this.operations.stripe, body.refund_reference, expected);
    } else {
      if (!this.verifiedBankRefund) throw fail('Verified bank refund readback is unavailable', 503);
      proof = await this.verifiedBankRefund(body.refund_reference, expected);
    }
    if (proof?.refund_reference !== body.refund_reference) throw fail('Refund evidence reference mismatch');
    const payload = canonicalRefundPayload({ ...body, request_id: requestId }, proof);
    return this.operations.store.rpc('api_financial_record_refund', { ...pair, p_payment: paymentId, p_payload: payload, p_request_id: requestId });
  }
  async founderHistory(identity, subject) {
    const pair = await this.operations.founder(identity);
    return this.operations.store.rpc('api_financial_founder_history', { ...pair, p_subject: subject });
  }
  async ownHistory(identity) {
    if (!this.operations.config.publication || !Number.isSafeInteger(identity?.wpUserId) || identity.wpUserId <= 1 ||
        !identity.roles?.some(r => ['student', 'registered'].includes(r))) throw fail('Student financial history is not released', 403);
    return this.operations.store.rpc('api_financial_own_history', { p_principal: identity.userId, p_wp_user_id: identity.wpUserId });
  }
}
