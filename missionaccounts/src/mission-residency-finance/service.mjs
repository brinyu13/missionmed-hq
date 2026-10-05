// Server-only adapter. No HTTP routes, provider dispatch, account provisioning or UI are added.
export class MissionResidencyFinancialService {
  constructor({ store, resolveFinancialPrincipal }) {
    if (!store?.rpc || typeof resolveFinancialPrincipal !== 'function') throw new Error('Explicit financial authorization required');
    this.store = store; this.resolveFinancialPrincipal = resolveFinancialPrincipal;
  }
  async principal(session, capability) {
    const principal = await this.resolveFinancialPrincipal(session);
    if (!principal?.actorId || !principal?.authorityRef || !principal.capabilities?.includes(capability)) {
      throw Object.assign(new Error('Financial capability denied'), { status: 403 });
    }
    return principal.actorId;
  }
  async accounts(session) {
    const actor = await this.principal(session, 'read');
    return this.store.rpc('api_read_financial_accounts', { p_actor: actor });
  }
  async stageCertifiedBundle(session, bundle) {
    const actor = await this.principal(session, 'stage');
    await this.principal(session, 'settle');
    return this.store.rpc('api_stage_certified_financial_bundle', { p_actor: actor, p_bundle: bundle });
  }
  async recordVerifiedPayment(session, payment) {
    const actor = await this.principal(session, 'settle');
    return this.store.rpc('api_record_verified_financial_payment', { p_actor: actor, p_payment: payment });
  }
}
