import { SupabaseRestStore } from '../storage/supabase-rest.mjs';
import { MissionResidencyStripe } from './stripe-provider.mjs';
import { FinancialOperationsService } from './operations-service.mjs';
import { FinancialReceiptRefundService } from './receipts-refunds.mjs';
import { fail } from './operations-domain.mjs';

export const FINANCIAL_QA_SCHEMA = 'missionaccounts_finance_qa';
export const FINANCIAL_QA_SUBJECT = 'match360:phase3_qa_brinyu2';
export const FINANCIAL_QA_TERMS_VERSION = 'DR-389:TEST-ONLY-EXACT-REQUEST-v1';
// Technical test consent only; no tuition contract, collection or automatic billing authorization.
export const FINANCIAL_QA_CONSENT = 'I authorize only the exact displayed synthetic QA payment using Stripe TEST mode. No real money is charged. This does not authorize automatic or recurring billing.';

export function assertFinancialQaProvider({ mode, secretKey, publishableKey, liveMutationsEnabled }) {
  if (mode !== 'test' || liveMutationsEnabled === true ||
      !/^(?:sk|rk)_test_[A-Za-z0-9_]+$/.test(secretKey || '') ||
      !/^pk_test_[A-Za-z0-9_]+$/.test(publishableKey || '')) throw fail('Financial QA requires exclusive Stripe TEST configuration', 503);
}
class FinancialQaStripe extends MissionResidencyStripe {
  constructor(options) { assertFinancialQaProvider(options); super({ ...options, mode: 'test', liveMutationsEnabled: false }); this.qaPublishableKey = options.publishableKey; }
  assertQa() {
    assertFinancialQaProvider({ mode: this.mode, secretKey: this.secretKey, publishableKey: this.qaPublishableKey, liveMutationsEnabled: this.liveMutationsEnabled });
  }
  async retrieve(...args) {
    this.assertQa();
    const result = await super.retrieve(...args);
    if (result?.livemode === true) throw fail('Live provider objects are forbidden in financial QA', 403);
    return result;
  }
  async request(...args) {
    this.assertQa();
    const result = await super.request(...args);
    if (result?.livemode === true) throw fail('Live provider objects are forbidden in financial QA', 403);
    return result;
  }
}

// Server construction supplies verified custody. Never pass request headers/body/schema here.
// An allowlisted pair still must pass the private QA database binding on every resolution.
export function createFinancialQaRuntime({ enabled = false, database, provider, founder, qaSubject, Store = SupabaseRestStore }) {
  if (!enabled) return null;
  if (founder?.wpUserId !== 1 || founder?.username !== 'brinyu' || qaSubject?.username !== 'brinyu2' ||
      !Number.isSafeInteger(qaSubject.wpUserId) || qaSubject.wpUserId <= 1 ||
      !/^[a-f0-9-]{36}$/i.test(founder.userId || '') || !/^[a-f0-9-]{36}$/i.test(qaSubject.userId || '') ||
      founder.userId === qaSubject.userId) throw fail('Verified Founder and private QA identity custody is required', 503);
  assertFinancialQaProvider(provider || {});
  const pinnedFounder = Object.freeze({ ...founder });
  const pinnedSubject = Object.freeze({ ...qaSubject });
  const store = new Store({ url: database?.url, serviceKey: database?.serviceKey, schema: FINANCIAL_QA_SCHEMA });
  const stripe = new FinancialQaStripe(provider);
  const config = Object.freeze({ operations: true, onboarding: true, publication: true, cardDispatch: true,
    providerEvents: false, zelleMatcher: false, automaticBilling: false, stripeAccount: provider.accountId,
    publishableKey: provider.publishableKey, chargeTermsVersion: FINANCIAL_QA_TERMS_VERSION, settlementActor: 'mr-finance-qa-settlement' });
  const operations = new FinancialOperationsService({ store, config, stripe });
  const receipts = new FinancialReceiptRefundService({ operations });
  return Object.freeze({
    schema: FINANCIAL_QA_SCHEMA,
    async resolve(identity) {
      // identity is the server-authenticated WP/private principal, not browser input.
      const pinned = identity?.wpUserId === pinnedFounder.wpUserId && identity?.userId === pinnedFounder.userId ? pinnedFounder
        : identity?.wpUserId === pinnedSubject.wpUserId && identity?.userId === pinnedSubject.userId ? pinnedSubject : null;
      if (!pinned) return null;
      const kind = pinned === pinnedFounder ? 'founder' : 'qa_subject';
      const binding = await store.rpc('api_financial_qa_identity', { p_principal: identity.userId, p_wp_user_id: identity.wpUserId });
      if (binding?.kind !== kind || binding?.username !== pinned.username || binding?.subject_key !== FINANCIAL_QA_SUBJECT) return null;
      // Only this verified synthetic subject receives the domain's student role for own-account checks.
      const domainIdentity = Object.freeze({ ...identity, roles: kind === 'founder' ? ['founder'] : ['student'] });
      return Object.freeze({ kind, identity: domainIdentity, operations, receipts, synthetic: true, test_only: true,
        consent: FINANCIAL_QA_CONSENT, terms_version: FINANCIAL_QA_TERMS_VERSION });
    },
  });
}
