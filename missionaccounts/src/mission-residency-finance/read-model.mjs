const denied = () => Object.assign(new Error('Explicit Founder financial authorization required'), { status: 403 });
export function financialReadIdentity(identity) {
  if (!identity?.roles?.some(role => ['founder', 'missionaccounts_admin'].includes(role)) ||
      identity.wpUserId !== 1 ||
      !/^[a-f0-9-]{36}$/i.test(String(identity.userId || ''))) throw denied();
  return { p_principal: identity.userId, p_wp_user_id: identity.wpUserId };
}
export async function financialReadAccess(store, identity) {
  try { return Boolean(store?.rpc) && await store.rpc('api_financial_read_access', financialReadIdentity(identity)) === true; }
  catch { return false; } // An unavailable authorization store never grants access.
}
const sum = (rows, key) => rows.reduce((n, r) => n + Number(r[key] || 0), 0);
const reconciliation = {
 afthab: ['Accepted terms and conditional waiver need confirmation.', 'Confirm accepted contract terms and the conditional fee waiver.'],
 ezechiel: ['Principal and installment-fee allocation remains unresolved.', 'Confirm the $150 allocation between principal and installment fees.'],
 dhwani: ['Refund request and enrollment disposition remain unresolved.', 'Confirm refund approval, execution and enrollment disposition.'],
 ruth: ['Wire reported as cleared; incoming bank proof is missing. This is not an unpaid determination.', 'Provide the incoming receiving-bank wire record. Do not classify this account as unpaid.'],
 shobhit: ['The accepted tuition is not established by the conflicting correspondence.', 'Confirm the accepted tuition from the binding agreement.'],
 farees: ['Final admission and the binding payment plan are not established.', 'Confirm final admission and the binding payment plan.'],
};
export function financialCommandProjection(snapshot) {
  const accounts = snapshot.accounts.map(row => {
    const held = row.state === 'HELD';
    const balance = held ? null : row.balance;
    if (!held && (!row.agreement || !balance)) throw Object.assign(new Error('Certified financial projection unavailable'), { status: 503 });
    const obligations = row.obligations;
    const outstanding = obligations.filter(o => Number(o.remaining_cents) > 0);
    const nextDue = outstanding.some(o => o.due_precision !== 'EXACT') ? null : outstanding.map(o => o.due_on).sort()[0] || null;
    const holdType = row.cases[0]?.type || '';
    const status = held ? ({ REFUND_REVIEW: 'Held · refund review', NEEDS_BANK_EVIDENCE: 'Held · bank evidence', NEEDS_IDENTITY_REVIEW: 'Held · identity review', PARTIAL_REVIEW_REQUIRED: 'Held · allocation review' }[holdType] || 'Held · contract review')
      : Number(balance.balance_cents) === 0 ? 'Paid in full' : 'Balance remaining';
    const timeline = [{ at: row.created_at, event: held ? 'Reconciliation case recorded' : 'Financial account recorded', detail: held ? row.cases.map(c => c.reason).join(' ') : 'Private canonical ledger; student access remains off' }];
    if (row.agreement) timeline.push({ at: row.agreement.certified_at, event: 'Agreement certified', detail: row.agreement.certification_status.replaceAll('_', ' ').toLowerCase() });
    for (const p of row.payments) {
      timeline.push({ at: p.date, event: 'Payment received', detail: `${p.provider} · ${p.method} · ${p.payer}`, amount_cents: Number(p.amount_cents) });
      timeline.push({ at: p.verified_at, event: 'Payment verified in canonical ledger', detail: p.provider });
    }
    for (const a of row.applications) timeline.push({ at: a.recorded_at, event: 'Payment application recorded', detail: a.obligation, amount_cents: Number(a.amount_cents) });
    for (const a of row.adjustments) timeline.push({ at: a.created_at, event: `${a.kind.toLowerCase()} recorded`, detail: a.authority_ref, amount_cents: Number(a.amount_cents) });
    const credit = held ? 0 : sum(row.payments, 'unapplied_cents');
    const review = held ? reconciliation[row.subject_key.split(':').at(-1)] : null;
    return { ...row, balance, status, review_summary: review?.[0] || row.cases.map(c=>c.reason).join(' '), next_human_action: review?.[1] || 'Provide the evidence identified in the reconciliation case.', next_due_date: nextDue, applied_cents: row.applications.reduce((n,a)=>n+Number(a.net_cents??a.amount_cents),0), verified_cents: sum(row.payments, 'amount_cents'), credit_cents: credit,
      principal_remaining_cents: sum(outstanding.filter(o => ['DEPOSIT', 'TUITION_PRINCIPAL', 'INSTALLMENT'].includes(o.component)), 'remaining_cents'),
      fees_remaining_cents: sum(outstanding.filter(o => ['ADMIN_PROCESSING_FEE', 'OTHER_AUTHORIZED_FEE'].includes(o.component)), 'remaining_cents'),
      timeline: timeline.sort((a, b) => a.at.localeCompare(b.at)), methods: [...new Set(row.payments.map(p => p.method))] };
  });
  const certified = accounts.filter(a => a.state === 'CERTIFIED');
  return { observed_at: snapshot.observed_at, read_only: true, student_visible: false, accounts, summary: {
    certified: certified.length, paid_in_full: certified.filter(a => a.balance.balance_cents === 0).length,
    balance_remaining: certified.filter(a => a.balance.balance_cents > 0).length, held: accounts.length - certified.length,
    tuition_cents: certified.reduce((n,a) => n + Number(a.agreement.tuition_cents), 0),
    fees_cents: certified.reduce((n,a) => n + Number(a.agreement.fees_cents), 0), applied_cents: sum(certified, 'applied_cents'),
    credit_cents: sum(certified, 'credit_cents'), balance_cents: certified.reduce((n,a) => n + Number(a.balance.balance_cents), 0),
  } };
}
