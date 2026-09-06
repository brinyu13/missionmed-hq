export function chargeEligibility({ day, decision, paymentMethod, consent, existingCharge }) {
  if (!day || day.kind !== 'billable') return { eligible: false, reason: 'day_not_billable' };
  if (!decision || decision.state !== 'approved') return { eligible: false, reason: 'decision_not_approved' };
  if (decision.stale) return { eligible: false, reason: 'decision_stale' };
  if (decision.amount_cents <= 0) return { eligible: false, reason: 'zero_treatment' };
  if (paymentMethod?.status !== 'on_file') return { eligible: false, reason: 'payment_method_missing' };
  if (consent?.state !== 'authorized') return { eligible: false, reason: 'consent_missing' };
  if (existingCharge && existingCharge.state !== 'failed') return { eligible: false, reason: 'logical_charge_exists' };
  return { eligible: true, reason: 'eligible' };
}

export class InMemoryChargeLedger {
  constructor() {
    this.chargesByDay = new Map();
    this.webhookEvents = new Set();
    this.receipts = new Set();
  }

  enqueue(dayId) {
    const existing = this.chargesByDay.get(dayId);
    if (existing) return existing;
    const charge = { dayId, idempotencyKey: `missionaccounts:billable-day:${dayId}:v1`, state: 'pending', providerRef: null };
    this.chargesByDay.set(dayId, charge);
    return charge;
  }

  processSucceededWebhook({ eventId, paymentIntentId, dayId }) {
    if (this.webhookEvents.has(eventId)) return { status: 'duplicate_event' };
    this.webhookEvents.add(eventId);
    const charge = this.enqueue(dayId);
    if (charge.providerRef && charge.providerRef !== paymentIntentId) return { status: 'provider_conflict' };
    if (charge.state === 'succeeded') return { status: 'already_succeeded' };
    charge.providerRef = paymentIntentId;
    charge.state = 'succeeded';
    this.receipts.add(dayId);
    return { status: 'succeeded' };
  }
}
