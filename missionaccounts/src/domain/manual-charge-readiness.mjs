const historicalCycles = new Set(['2026-cycle-1', '2026-cycle-2', '2026-cycle-3']);
const nonCollectibleTreatments = new Set(['ucc', 'mul', 'waived', 'prepaid', 'already_paid', 'already_invoiced']);

function profileStatus(profile) {
  if (!profile) return 'NOT_STARTED';
  const required = ['school_name', 'best_contact_method', 'mailing_line1', 'mailing_city',
    'mailing_region', 'mailing_postal_code', 'mailing_country_code'];
  return required.every(key => String(profile[key] || '').trim()) ? 'COMPLETE' : 'IN_PROGRESS';
}

export function buildManualChargeReadiness({
  decisions = [], students = [], identities = [], profiles = [], invoices = [], customers = [], methods = [], charges = [],
} = {}) {
  const byId = rows => new Map(rows.map(row => [row.student_id || row.id, row]));
  const studentById = new Map(students.map(row => [row.id, row]));
  const identityById = new Map(identities.map(row => [row.id, row]));
  const profileById = byId(profiles);
  const customerById = byId(customers);
  const methodById = byId(methods);
  const latestInvoice = new Map();
  for (const invoice of [...invoices].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))) {
    if (!latestInvoice.has(invoice.decision_id)) latestInvoice.set(invoice.decision_id, invoice);
  }
  const chargesByCycle = new Map();
  for (const charge of charges) {
    const key = `${charge.student_id}:${charge.cycle_key}`;
    const list = chargesByCycle.get(key) || [];
    list.push(charge);
    chargesByCycle.set(key, list);
  }
  const rows = [];
  for (const decision of decisions) {
    if (!historicalCycles.has(decision.cycle_key) || decision.state !== 'approved'
      || decision.superseded_by_id || !Number.isInteger(decision.amount_cents)
      || decision.amount_cents <= 0) continue;
    const student = studentById.get(decision.student_id);
    const identity = identityById.get(decision.student_id);
    const profile = profileById.get(decision.student_id);
    const customer = customerById.get(decision.student_id);
    const method = methodById.get(decision.student_id);
    const invoice = latestInvoice.get(decision.id);
    const cycleCharges = chargesByCycle.get(`${decision.student_id}:${decision.cycle_key}`) || [];
    const active = cycleCharges.find(charge => charge.state === 'succeeded')
      || cycleCharges.find(charge => charge.state === 'pending');
    const failed = cycleCharges.some(charge => charge.state === 'failed');
    let status = 'NEEDS_ACTION';
    let reason = 'Review this approved balance';
    if (active?.state === 'succeeded') { status = 'COLLECTED'; reason = 'Already collected'; }
    else if (active?.state === 'pending') { status = 'PROCESSING'; reason = 'Charge processing; wait for Stripe confirmation'; }
    else if (failed) reason = 'Prior charge failed; review before retry';
    else if (!student || student.identity_state !== 'verified' || !student.matrix_user_ref
      || !identity || identity.absorbed !== false || identity.excluded !== false
      || identity.canonical_student_id !== decision.student_id) reason = 'Verify and link canonical student identity';
    else if (student.sponsor_type !== 'DIRECT' || nonCollectibleTreatments.has(decision.treatment)) reason = 'No direct student collection';
    else if (!invoice || invoice.student_id !== decision.student_id || invoice.cycle_key !== decision.cycle_key
      || invoice.amount_cents !== decision.amount_cents || !['draft', 'ready'].includes(invoice.state)
      || invoice.provider_ref) reason = 'Review matching collectible invoice';
    else if (!customer || !method || method.status !== 'on_file'
      || method.provider_customer_ref !== customer.provider_customer_ref
      || !/^\d{4}$/.test(String(method.last4 || ''))) reason = 'Saved card needs setup or review';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(student.email || '').trim())) reason = 'Add a valid receipt email';
    else { status = 'READY'; reason = 'Ready for your explicit confirmation'; }
    rows.push({
      student_id: decision.student_id, student_name: student?.display_name || 'Student record unavailable',
      cycle_key: decision.cycle_key, decision_id: decision.id, amount_cents: decision.amount_cents,
      profile_status: profileStatus(profile),
      payment_method: method?.status === 'on_file'
        ? { status: 'ON_FILE', brand: method.brand || 'Card', last4: method.last4 || null }
        : { status: 'MISSING', brand: null, last4: null },
      status, reason,
    });
  }
  const order = { READY: 0, NEEDS_ACTION: 1, PROCESSING: 2, COLLECTED: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status]
    || a.student_name.localeCompare(b.student_name) || a.cycle_key.localeCompare(b.cycle_key));
  const ready = rows.filter(row => row.status === 'READY');
  return {
    rows,
    summary: {
      approved_count: rows.length,
      profile_complete_count: rows.filter(row => row.profile_status === 'COMPLETE').length,
      card_on_file_count: rows.filter(row => row.payment_method.status === 'ON_FILE').length,
      ready_count: ready.length,
      ready_amount_cents: ready.reduce((sum, row) => sum + row.amount_cents, 0),
      needs_action_count: rows.filter(row => row.status === 'NEEDS_ACTION').length,
      processing_count: rows.filter(row => row.status === 'PROCESSING').length,
      collected_count: rows.filter(row => row.status === 'COLLECTED').length,
    },
  };
}
