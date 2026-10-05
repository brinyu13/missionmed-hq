import { financialReadAccess, financialReadIdentity } from './read-model.mjs';
import { fail, requestIdentity, provenance, cents, exactDate, validateSchedule, onboardingState, digest } from './operations-domain.mjs';

const ownIdentity = identity => {
  if (!identity?.roles?.some(r => ['student', 'registered'].includes(r)) || !Number.isSafeInteger(identity.wpUserId) ||
      identity.wpUserId <= 1 || !/^[a-f0-9-]{36}$/i.test(identity.userId || '')) throw fail('Own financial account is required', 403);
  return { p_principal: identity.userId, p_wp_user_id: identity.wpUserId };
};
export async function financialStudentAccess(store, identity, config) {
  if (config?.onboarding !== true) return false;
  try { return await store.rpc('api_financial_student_access', ownIdentity(identity)) === true; } catch { return false; }
}
export class FinancialOperationsService {
  constructor({ store, config, stripe, chaseEvidence }) { this.chaseEvidence = chaseEvidence; this.store = store; this.config = config || {}; this.stripe = stripe; }
  async founder(identity) {
    if (!await financialReadAccess(this.store, identity)) throw fail('Explicit Founder finance authority is required', 403);
    return financialReadIdentity(identity);
  }
  async command(identity) {
    const result = await this.store.rpc('api_financial_operating_command', await this.founder(identity));
    return { ...result, accounts: result.accounts.map(row => ({ ...row, readiness: onboardingState({
      subject: { certification_state: row.certification_state }, eligibility: row.eligibility, profile: row.profile,
      method: row.method, acknowledgment: row.profile, requiredTerms: [] }) })) };

  }
  async operate(identity, subject, operation, body, requestId) {
    const pair = await this.founder(identity);
    if (!this.config.operations) throw fail('Financial operations are not released', 403);
    requestIdentity(requestId); provenance(body);
    if (body.confirmed !== true) throw fail('Explicit Founder confirmation is required', 400);
    if (!/^match360:[a-z0-9_-]+$/.test(subject)) throw fail('Financial subject is invalid', 400);
    let payload = { confirmed: true, ...provenance(body) };
    switch (operation) {
      case 'SET_ONBOARDING_ELIGIBILITY':
        if (typeof body.required !== 'boolean' || typeof body.card_required !== 'boolean' || !body.reason?.trim()) throw fail('Documented arrangement eligibility is required', 400);
        Object.assign(payload, { required: body.required, card_required: body.card_required, reason: body.reason.trim().slice(0, 1000) }); break;
      case 'CREATE_OBLIGATION':
        if (!/^[A-Za-z0-9._:-]{1,100}$/.test(body.key || '') || !['DEPOSIT','TUITION_PRINCIPAL','INSTALLMENT','ADMIN_PROCESSING_FEE','OTHER_AUTHORIZED_FEE'].includes(body.component)) throw fail('Obligation component and key are required', 400);
        Object.assign(payload, { key: body.key, component: body.component, amount_cents: cents(body.amount_cents), ...exactDate(body.due_on) }); break;
      case 'SAVE_SCHEDULE': {
        const snapshot = await this.store.rpc('api_read_financial_command', pair);
        const account = snapshot.accounts.find(a => a.subject_key === subject);
        if (!account || account.state !== 'CERTIFIED') throw fail('A certified account is required');
        Object.assign(payload, { installments: validateSchedule({ obligations: account.obligations, installments: body.installments, evidence: body }), expected_revision: body.expected_revision || null }); break;
      }
      case 'ADJUST_OBLIGATION':
        if (!['WAIVER','CREDIT'].includes(body.kind)) throw fail('Only evidence-backed waiver or credit is supported', 400);
        Object.assign(payload, { obligation_id: body.obligation_id, kind: body.kind, amount_cents: cents(body.amount_cents) }); break;
      case 'REQUEST_PAYMENT':
        if (!body.description?.trim() || !Array.isArray(body.methods) || !body.methods.length || body.methods.some(m => !['CARD','ZELLE'].includes(m))) throw fail('Payment request description and allowed methods are required', 400);
        if (body.expires_at != null && !Number.isFinite(Date.parse(body.expires_at))) throw fail('Request expiration is invalid', 400);
        Object.assign(payload, { obligation_id: body.obligation_id, installment_id: body.installment_id || null,
          amount_cents: cents(body.amount_cents), description: body.description.trim().slice(0,300), methods: [...new Set(body.methods)], expires_at: body.expires_at || null }); break;
      default: throw fail('Unsupported financial operation', 400);
    }
    return this.store.rpc('api_financial_operate', { ...pair, p_subject: subject, p_operation: operation, p_payload: payload, p_request_id: requestId });
  }
  async onboarding(identity) {
    if (!this.config.onboarding) throw fail('Payment onboarding is not released', 403);
    const row = await this.store.rpc('api_financial_own_onboarding', ownIdentity(identity));
    const readiness = onboardingState({ subject: row, eligibility: row.eligibility, profile: row.profile,
      method: row.method, acknowledgment: row.profile && { arrangement_acknowledged: row.profile.arrangement_acknowledged }, requiredTerms: [] });
    return { readiness, profile: row.profile && { email: row.profile.email, phone: row.profile.phone,
      contact_confirmed: row.profile.contact_confirmed, arrangement_acknowledged: row.profile.arrangement_acknowledged,
      save_method_acknowledged: row.profile.save_method_acknowledged }, method: row.method, pending_setup: row.pending_setup,
      account_review: row.certification_state === 'HELD', automatic_billing: false };
  }
  providerReady() {
    const state = this.stripe?.configurationState();
    if (!state?.mutations_enabled || !this.config.stripeAccount || this.stripe.accountId !== this.config.stripeAccount ||
        !new RegExp(`^pk_${state.mode}_[A-Za-z0-9_]+$`).test(this.config.publishableKey || '')) throw fail('Mission Residency secure payment provider is not released', 503);
    return state;
  }
  async setup(identity, requestId) {
    if (!this.config.onboarding) throw fail('Payment onboarding is not released', 403);
    requestIdentity(requestId); const mode = this.providerReady().mode; const pair = ownIdentity(identity);
    const context = await this.store.rpc('api_financial_setup_context', { ...pair, p_request_id: requestId });
    if (!context.setup?.intent_ref && Date.now()-Date.parse(context.reserved_at)>23*3600_000) throw fail('Secure setup requires provider reconciliation before retry');
    if (context.provider_account !== this.stripe.accountId) throw fail('Payment provider account conflict', 503);
    let customer = context.binding?.customer_ref;
    if (!customer) {
      const created = await this.stripe.createResidencyCustomer({ subjectKey: context.subject_key, email: identity.email, name: identity.displayName });
      if (!/^cus_[A-Za-z0-9]+$/.test(created.id || '') || created.metadata?.financial_subject !== context.subject_key) throw fail('Payment customer could not be verified', 503);
      customer = created.id;
    }
    const setup = context.setup?.intent_ref ? await this.stripe.retrieve(`setup_intents/${context.setup.intent_ref}`)
      : await this.stripe.createResidencySetup({ customerId: customer, subjectKey: context.subject_key, requestId });
    if (setup.customer !== customer || setup.metadata?.financial_subject !== context.subject_key || setup.metadata?.request_id !== requestId ||
        setup.metadata?.namespace !== 'mission_residency_finance' || setup.livemode !== (mode === 'live')) throw fail('Payment setup ownership could not be verified', 503);
    await this.store.rpc('api_financial_register_setup', { ...pair, p_request_id: requestId, p_account: this.stripe.accountId, p_customer: customer, p_intent: setup.id });
    return { request_id: requestId, publishable_key: this.config.publishableKey, mode, client_secret: setup.client_secret };
  }
  async confirmSetup(identity, requestId) {
    if (!this.config.onboarding) throw fail('Payment onboarding is not released', 403);
    requestIdentity(requestId); this.providerReady(); const pair = ownIdentity(identity);
    const c = await this.store.rpc('api_financial_setup_context', { ...pair, p_request_id: requestId });
    if (!c.setup?.intent_ref) throw fail('Secure payment setup must be started first');
    const proof = await this.stripe.setupResult(c.setup.intent_ref, { subjectKey: c.subject_key, customerId: c.binding?.customer_ref, requestId });
    await this.store.rpc('api_financial_confirm_setup', { ...pair, p_request_id: requestId, p_proof: proof });
    return this.onboarding(identity);
  }
  async account(identity) {
    if (!this.config.publication) throw fail('Student financial accounts are not released', 403);
    return this.store.rpc('api_financial_own_account', ownIdentity(identity));
  }
  async authorizeCharge(identity, body, requestId) {
    if (!this.config.publication || !this.config.chargeTermsVersion || body.terms_version !== this.config.chargeTermsVersion) throw fail('Specific charge authorization is not released', 403);
    requestIdentity(requestId);
    return this.store.rpc('api_financial_authorize_charge', { ...ownIdentity(identity), p_request: body.request_id,
      p_method: body.method_id, p_terms: this.config.chargeTermsVersion, p_request_id: requestId, p_confirmed: body.confirmed === true });
  }
  async startCard(identity, body, requestId, founder = false) {
    if (!this.config.cardDispatch || (!founder && !this.config.publication)) throw fail('Card payment dispatch is not released', 403);
    const mode = this.providerReady().mode; requestIdentity(requestId);
    const pair = founder ? await this.founder(identity) : ownIdentity(identity);
    const attempt = await this.store.rpc('api_financial_prepare_card', { ...pair, p_request: body.request_id, p_request_id: requestId,
      p_account: this.stripe.accountId, p_authorization: founder ? body.authorization_id : null, p_confirmed: body.confirmed === true });
    if (attempt.state === 'SUCCEEDED' || attempt.state === 'CANCELLED') return { state: attempt.state, attempt_id: attempt.id };
    // Never recreate an unlocated ambiguous intent after Stripe's idempotency retention window.
    if (!attempt.intent_ref && Date.now() - Date.parse(attempt.created_at) > 23 * 3600_000) throw fail('Payment attempt requires provider reconciliation before retry');
    let intent;
    try {
      intent = attempt.intent_ref ? await this.stripe.retrieve(`payment_intents/${attempt.intent_ref}`)
        : await this.stripe.createResidencyPayment({ attemptId: attempt.id, requestId: attempt.request_id, subjectKey: attempt.subject_key,
          amountCents: Number(attempt.amount_cents), customerId: attempt.customer_ref, paymentMethodId: founder ? attempt.payment_method_ref : null, offSession: founder });
    } catch (error) {
      // Stripe may have created an intent before a timeout or card error. Capture only its safe identifier.
      const reference = error.stripe?.error?.payment_intent?.id || attempt.intent_ref || null;
      await this.store.rpc('api_financial_card_result', { ...pair, p_attempt: attempt.id, p_intent: reference, p_state: 'AMBIGUOUS', p_payment: null, p_settlement_actor: this.config.settlementActor });
      throw fail('Payment result is awaiting provider reconciliation. Do not submit another charge.', 409);
    }
    await this.store.rpc('api_financial_card_result', { ...pair, p_attempt: attempt.id, p_intent: intent.id, p_state: 'SUBMITTED', p_payment: null, p_settlement_actor: this.config.settlementActor });
    const result = await this.reconcileCard(identity, attempt.id, founder);
    if (founder || result.state === 'SUCCEEDED') return result;
    return { ...result, mode, publishable_key: this.config.publishableKey, client_secret: intent.client_secret };
  }
  async reconcileCard(identity, attemptId, founder = false, providerPair = null, providerReference = null) {
    if (providerPair ? !this.config.providerEvents : !this.config.cardDispatch || (!founder && !this.config.publication)) throw fail('Card payment reconciliation is not released', 403);
    const pair = providerPair || (founder ? await this.founder(identity) : ownIdentity(identity));
    const attempt = await this.store.rpc('api_financial_card_attempt', { ...pair, p_id: attemptId });
    if (attempt.state === 'SUCCEEDED') return { state: 'SUCCEEDED', attempt_id: attempt.id, payment_id: attempt.payment_id };
    const intentRef=attempt.intent_ref||(providerPair?providerReference:null);
    if (!intentRef) return { state: 'AMBIGUOUS', attempt_id: attempt.id };
    this.providerReady();
    const result = await this.stripe.paymentResult(intentRef, { subjectKey: attempt.subject_key, customerId: attempt.customer_ref,
      amountCents: Number(attempt.amount_cents), attemptId: attempt.id, requestId: attempt.request_id, paymentMethodId: attempt.authorization_id ? attempt.payment_method_ref : null });
    let payment = null;
    if (result.state === 'SUCCEEDED') {
      const p = result.payment;
      payment = { subject_key: attempt.subject_key, provider: 'Stripe', provider_account: p.account_id, provider_identity: p.intent_id,
        method: 'CARD', gross_cents: p.amount_cents, payer: 'Authenticated Mission Residency account', received_at: p.received_at,
        received_precision: 'EXACT', verification_state: 'VERIFIED', request_id: `mr-stripe:${attempt.id}`,
        evidence: [{ type: 'STRIPE_PAYMENT_INTENT', reference: p.intent_id, fingerprint: digest(['Stripe', p.account_id, p.intent_id]), metadata: {} },
          { type: 'STRIPE_CHARGE', reference: p.charge_id, fingerprint: digest(['Stripe', p.account_id, p.charge_id]), metadata: {} }] };
    }
    const settled = await this.store.rpc('api_financial_card_result', { ...pair, p_attempt: attempt.id, p_intent: intentRef,
      p_state: result.state === 'PENDING' ? 'SUBMITTED' : result.state, p_payment: payment, p_settlement_actor: this.config.settlementActor });
    return { ...settled, attempt_id: attempt.id };
  }
  async resumeCard(identity, attemptId) {
    // Recovery only retrieves an existing owned intent. It never prepares or creates another charge.
    if (!this.config.cardDispatch || !this.config.publication) throw fail('Card payment recovery is not released', 403);
    const pair = ownIdentity(identity);
    const attempt = await this.store.rpc('api_financial_card_attempt', { ...pair, p_id: attemptId });
    const result = await this.reconcileCard(identity, attemptId);
    if (['SUCCEEDED', 'CANCELLED'].includes(result.state) || !attempt.intent_ref) return result;
    const mode = this.providerReady().mode;
    const intent = await this.stripe.retrieve(`payment_intents/${attempt.intent_ref}`);
    // Verify the second read as well: an asynchronous result must not replace the verified owned intent.
    if (intent.id !== attempt.intent_ref || intent.customer !== attempt.customer_ref || intent.amount !== Number(attempt.amount_cents) ||
        intent.currency !== 'usd' || intent.livemode !== (mode === 'live') || intent.metadata?.namespace !== 'mission_residency_finance' ||
        intent.metadata?.financial_subject !== attempt.subject_key || intent.metadata?.attempt_id !== attempt.id ||
        intent.metadata?.request_id !== attempt.request_id || (attempt.authorization_id && intent.payment_method !== attempt.payment_method_ref)) throw fail('Payment recovery ownership mismatch', 403);
    if (!['requires_action', 'requires_payment_method', 'requires_confirmation'].includes(intent.status)) return result;
    return { ...result, mode, publishable_key: this.config.publishableKey, client_secret: intent.client_secret };
  }
  async receiveProviderEvent(rawBody, signature) {
    if (!this.config.providerEvents) throw fail('Mission Residency provider events are not released', 503);
    this.stripe.verifyWebhook(rawBody, signature);
    let event;try{event=JSON.parse(rawBody.toString('utf8'));}catch{throw fail('Provider event JSON is invalid',400);}
    if (event.account && event.account !== this.config.stripeAccount) throw fail('Provider event account mismatch',403);
    const object=event.data?.object;
    if (object?.metadata?.namespace !== 'mission_residency_finance') return {received:true,ignored:true};
    const isSetup=event.type==='setup_intent.succeeded';
    if (!isSetup&&!['payment_intent.succeeded','payment_intent.payment_failed','payment_intent.requires_action','payment_intent.canceled','payment_intent.processing'].includes(event.type)) return {received:true,ignored:true};
    const context=await this.store.rpc('api_financial_provider_context',{p_actor:this.config.settlementActor,p_kind:isSetup?'setup':'payment',p_reference:object.id,p_request_id:isSetup?object.metadata.request_id:object.metadata.attempt_id});
    const pair={p_principal:context.principal,p_wp_user_id:0};
    if (!isSetup) return {received:true,...await this.reconcileCard(null,context.attempt_id,false,pair,object.id)};
    this.providerReady();
    const proof=await this.stripe.setupResult(context.intent_ref,{subjectKey:context.subject_key,customerId:context.customer_ref,requestId:context.request_id});
    const result=await this.store.rpc('api_financial_confirm_setup',{...pair,p_request_id:context.request_id,p_proof:proof});
    return {received:true,duplicate:result.duplicate};
  }
  async reconcileZelle(identity, requestId) {
    const pair = await this.founder(identity);
    if (!this.config.zelleMatcher || !this.chaseEvidence?.reserve || !this.config.settlementActor ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId || '')) {
      throw fail('Verified Chase request reconciliation is not released', 503);
    }
    // Browser supplies only a canonical request UUID. All match fields come from the private ledger.
    const context = await this.store.rpc('api_financial_chase_context', {
      ...pair, p_request: requestId, p_settlement_actor: this.config.settlementActor,
    });
    if (context.state === 'SETTLED') return { state: 'SETTLED', payment_id: context.payment_id, duplicate: true };
    const proof = await this.chaseEvidence.reserve(context);
    if (proof?.authenticity_verified !== true || proof.global_claim_verified !== true ||
        proof.reservation_verified !== true || proof.match_binding !== context.match_binding ||
        proof.amount_cents !== context.amount_cents || proof.provider_account !== 'info@missionmedinstitute.com' ||
        proof.provider !== 'Chase' || !/^[a-f0-9]{64}$/.test(proof.provider_identity || '')) {
      throw fail('Authenticated globally reserved Chase receipt is required');
    }
    // Final RPC revalidates current eligibility and binding. A failed settlement never releases the bank claim.
    return this.store.rpc('api_financial_settle_chase_request', {
      ...pair, p_request: requestId, p_settlement_actor: this.config.settlementActor, p_receipt: proof,
    });
  }
  async reportZelle(identity, body, requestId) {
    if (!this.config.publication) throw fail('Zelle requests are not released', 403);
    requestIdentity(requestId);
    return this.store.rpc('api_financial_report_zelle', { ...ownIdentity(identity), p_request: body.request_id, p_request_id: requestId });
  }
  async saveOnboarding(identity, body, requestId) {
    if (!this.config.onboarding) throw fail('Payment onboarding is not released', 403);
    requestIdentity(requestId);
    const email = String(identity.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Your verified account email is unavailable', 409);
    const phone = String(body.phone || '').trim();
    if (!/^[+\d() .-]{3,80}$/.test(phone)) throw fail('Enter your contact phone number', 400);
    const profile = { email, phone, contact_confirmed: body.contact_confirmed === true,
      arrangement_acknowledged: body.arrangement_acknowledged === true, save_method_acknowledged: body.save_method_acknowledged === true };
    await this.store.rpc('api_save_financial_onboarding', { ...ownIdentity(identity), p_profile: profile, p_request_id: requestId });
    return this.onboarding(identity);
  }
}
