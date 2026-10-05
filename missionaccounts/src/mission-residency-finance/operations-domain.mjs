import { createHash } from 'node:crypto';

export const fail = (message, status = 409) => Object.assign(new Error(message), { status });
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function cents(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw fail('A positive whole-cent amount is required', 400);
  return value;
}
export function requestIdentity(value) {
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(String(value || ''))) throw fail('A stable request identity is required', 400);
  return value;
}
export function provenance(value) {
  if (!value || !/^[A-Za-z0-9._:-]{3,160}$/.test(value.authority_ref || '') ||
      !/^[a-f0-9]{64}$/.test(value.evidence_sha256 || '')) throw fail('Accounting authority and evidence are required', 400);
  return { authority_ref: value.authority_ref, evidence_sha256: value.evidence_sha256 };
}
export function exactDate(value) {
  if (value === null) return { due_on: null, due_precision: 'UNKNOWN' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw fail('Use an established calendar date or explicitly unknown', 400);
  }
  return { due_on: value, due_precision: 'EXACT' };
}

// Schedules allocate the existing canonical residual. They never create a second tuition balance.
export function validateSchedule({ obligations, installments, evidence }) {
  provenance(evidence);
  if (!Array.isArray(installments) || !installments.length || installments.length > 60) throw fail('A bounded payment schedule is required', 400);
  const totals = new Map(), seen = new Set();
  const rows = installments.map(row => {
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(row.key || '') || seen.has(row.key)) throw fail('Installment keys must be unique', 400);
    seen.add(row.key);
    const obligation = obligations.find(o => o.id === row.obligation_id);
    if (!obligation || obligation.certified === false) throw fail('Schedule must allocate a certified obligation');
    const amount = cents(row.amount_cents);
    totals.set(obligation.id, (totals.get(obligation.id) || 0) + amount);
    if (totals.get(obligation.id) > obligation.remaining_cents) throw fail('Schedule exceeds the remaining canonical obligation');
    return { key: row.key, obligation_id: obligation.id, amount_cents: amount, ...exactDate(row.due_on) };
  });
  return rows;
}

export function onboardingState({ subject, eligibility, profile, method, acknowledgment, requiredTerms }) {
  const required = eligibility?.required === true;
  // A certification hold never creates debt or a card requirement by itself.
  if (!required) return { required: false, state: 'NOT_REQUIRED', payment_ready: method?.state === 'READY', missing: [] };
  const missing = [];
  if (!profile?.contact_confirmed || !profile?.phone?.trim() || !profile?.email?.trim()) missing.push('identity_contact');
  if (!acknowledgment?.arrangement_acknowledged) missing.push('arrangement_acknowledgment');
  if (eligibility.card_required && method?.state !== 'READY') missing.push('payment_method');
  for (const term of requiredTerms || []) if (!acknowledgment?.accepted_terms?.includes(term.version)) missing.push('consent:' + term.version);
  const started = Boolean(profile || acknowledgment || method);
  return { required: true, state: !missing.length ? 'COMPLETE' : started ? 'IN_PROGRESS' : 'NOT_STARTED',
    payment_ready: method?.state === 'READY', account_review: subject.certification_state === 'HELD', missing };
}

export function payableRequest({ subject, obligation, request, now = new Date() }) {
  if (subject.certification_state !== 'CERTIFIED') throw fail('Account review does not establish a payable amount');
  if (!request || request.state !== 'OPEN' || !request.authority_ref || !request.evidence_sha256) throw fail('An explicitly authorized payment request is required');
  if (!obligation || obligation.id !== request.obligation_id || obligation.subject_key !== subject.subject_key) throw fail('Payment request ownership mismatch', 403);
  if (request.expires_at && new Date(request.expires_at) <= now) throw fail('Payment request has expired');
  const amount = cents(request.amount_cents);
  if (amount > obligation.remaining_cents) throw fail('Requested payment exceeds the remaining obligation');
  return amount;
}
export function chargeAuthorization({ subject, obligation, request, method, authorization, confirmation, now }) {
  const amount = payableRequest({ subject, obligation, request, now });
  if (confirmation !== true) throw fail('Explicit Founder confirmation is required', 400);
  if (!method || method.state !== 'READY' || method.subject_key !== subject.subject_key) throw fail('A verified payment method is required');
  if (!authorization || authorization.state !== 'ACTIVE' || authorization.subject_key !== subject.subject_key ||
      authorization.request_id !== request.id || authorization.payment_method_id !== method.id ||
      authorization.amount_cents !== amount || authorization.scope !== 'SPECIFIC_OBLIGATION' ||
      !authorization.terms_version || !authorization.accepted_at ||
      (authorization.expires_at && new Date(authorization.expires_at) <= (now || new Date()))) {
    throw fail('Saving a card does not authorize this charge');
  }
  return amount;
}

export function deterministicZelleMatch({ receipt, candidates, consumedReferences, consumedFingerprints }) {
  // Only the server's Chase-authenticity adapter may supply receipt.verified.
  if (receipt?.verified !== true || receipt.provider !== 'Chase' || !/^\d+$/.test(receipt.reference || '') ||
      !/^[a-f0-9]{64}$/.test(receipt.fingerprint || '')) throw fail('Authentic Chase evidence is required');
  cents(receipt.amount_cents);
  if (consumedReferences.includes(receipt.reference) || consumedFingerprints.includes(receipt.fingerprint)) throw fail('Chase evidence has already been consumed');
  const normalize = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const payer = normalize(receipt.payer);
  if (!payer) throw fail('Verified payer evidence is required');
  const matches = candidates.filter(c => c.certified === true && c.state === 'OPEN' && c.amount_cents === receipt.amount_cents &&
    c.beneficiary_verified === true && c.payers.some(p => p.verified === true && normalize(p.name) === payer));
  return matches.length === 1 ? { state: 'MATCHED', candidate: matches[0] }
    : { state: 'REVIEW_REQUIRED', reason: matches.length ? 'MULTIPLE_MATCHES' : 'NO_MATCH', candidate: null };
}

export function aggregateApplications(allocations) {
  const totals = new Map();
  for (const a of allocations) totals.set(a.obligation_id, (totals.get(a.obligation_id) || 0) + cents(a.amount_cents));
  return [...totals].map(([obligation_id, amount_cents]) => ({ obligation_id, amount_cents }));
}

export function safeStudentProjection(account, readiness, requests) {
  const held = account.state === 'HELD';
  return { program: account.program, state: held ? 'ACCOUNT_REVIEW' : account.status,
    agreement: held ? null : account.agreement && { tuition_cents: account.agreement.tuition_cents, fees_cents: account.agreement.fees_cents, plan: account.agreement.plan },
    balance: held ? null : account.balance, credit_cents: held ? null : account.credit_cents,
    next_due_date: held ? null : account.next_due_date,
    // No payer contact details, private cases, raw mail, service credentials or evidence links.
    payments: held ? [] : account.payments.map(p => ({ id: p.id, date: p.date, amount_cents: p.amount_cents, method: p.method,
      applied_cents: p.applied_cents, receipt_available: p.verification_state === 'VERIFIED' })),
    onboarding: readiness, payment_requests: held ? [] : requests.map(r => ({ id: r.id, amount_cents: r.amount_cents, description: r.description, methods: r.methods, state: r.state })) };
}
