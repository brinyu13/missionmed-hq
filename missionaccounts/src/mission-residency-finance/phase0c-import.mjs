import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const SEALED_INPUT = Object.freeze({
  ledger: '2f27f12314d43f7f36834164ff210b4f208697c7f64458d7aaa2ce0696121006',
  crosswalk: '5a82a3e240de1268a6043878e28d1d42033c931f21706bf25f804129118d3b47',
  evidence: '5b74922f032950185c76a75624e4dc51fa5a76f34bd941c103a12c8d582e5e51',
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function assert(value, message) { if (!value) throw new Error(message); }
function cents(value) { assert(Number.isSafeInteger(value) && value >= 0, 'Invalid integer cents'); return value; }
function timestamp(value) { const date = new Date(value); assert(Number.isFinite(date.getTime()), 'Missing verified receipt timestamp'); return date.toISOString(); }
export function buildCertifiedBundle(ledger, crosswalk, byteCount) {
  assert(ledger.students.length === 17, 'Wrong certified accounting population');
  const identity = new Map(crosswalk.students.map(row => [row.student_key, row.identity_crosswalk]));
  const certified = ledger.students.filter(row => row.financial_certification_complete === true);
  const held = ledger.students.filter(row => row.financial_certification_complete !== true);
  assert(certified.length === 11 && held.length === 6, 'Wrong certification partition');
  const accounts = new Map(certified.map(row => [row.student_key, row]));
  const applications = new Map();
  for (const app of ledger.payment_applications) {
    assert(accounts.has(app.student_key) && !applications.has(app.payment_id), 'Held/duplicate certified payment');
    assert(cents(app.received_cents) === cents(app.principal_cents) + cents(app.fees_cents) + cents(app.unapplied_credit_cents), 'Payment split mismatch');
    applications.set(app.payment_id, app);
  }
  const subject = row => {
    const ids = identity.get(row.student_key) ?? [];
    if (row.financial_certification_complete) assert(ids.length === 1 && Number.isSafeInteger(ids[0].wp_id) && ids[0].wp_id > 0, 'Certified WP identity ambiguous');
    return { subject_key: `match360:${row.student_key}`, wp_subject: ids.length === 1 && Number.isSafeInteger(ids[0].wp_id) ? `wp:${ids[0].wp_id}` : null };
  };
  const payments = [];
  const seenEvidence = new Set();
  const agreementRows = certified.map(row => {
    const id = subject(row);
    const sums = { principal: 0, fees: 0, credit: 0 };
    assert(row.certified_adjustments_cents === 0, 'Unexpected adjustment requires reviewed import revision');
    const aliases = new Map();
    for (const receipt of row.provider_receipts) {
      const app = applications.get(receipt.payment_id);
      assert(app && app.student_key === row.student_key && receipt.beneficiary_key === row.student_key, 'Wrong beneficiary/application');
      assert(receipt.amount_cents === app.received_cents && receipt.currency === 'USD', 'Receipt mismatch');
      assert(receipt.provider === 'Chase' ? receipt.authentication_pass === true : receipt.provider === 'Stripe' && receipt.status === 'succeeded' && receipt.amount_refunded_cents === 0, 'Unverified or refunded receipt');
      const evidence = [];
      const addEvidence = (type, reference, fingerprint, metadata) => {
        assert(reference && /^[a-f0-9]{64}$/.test(fingerprint) && !seenEvidence.has(fingerprint), 'Evidence ownership replay');
        seenEvidence.add(fingerprint); evidence.push({ type, reference, fingerprint, metadata });
      };
      if (receipt.provider === 'Chase') {
        assert(receipt.chase_reference && receipt.cross_mailbox_reference_key, 'Global Chase reference required');
        addEvidence('CHASE_REFERENCE', receipt.chase_reference, receipt.cross_mailbox_reference_key, {
          source_gmail_id: receipt.gmail_id, message_fingerprint: receipt.message_fingerprint,
          donor_fingerprint: receipt.donor_fingerprint,
          bank_corroboration: (receipt.bank_corroboration ?? []).map(({ source_sha256, page, posted_date }) => ({ source_sha256, page, posted_date })),
        });
      } else {
        assert(receipt.charge_id && receipt.provider_account, 'Stripe account/charge ownership required');
        addEvidence('STRIPE_PAYMENT_INTENT', receipt.payment_id.slice(7), sha256(`Stripe:${receipt.provider_account}:${receipt.payment_id}`), { provider_account: receipt.provider_account, refunded_cents: 0 });
        addEvidence('STRIPE_CHARGE', receipt.charge_id, sha256(`Stripe:${receipt.provider_account}:${receipt.charge_id}`), { order_id: receipt.order_id, tuition_cents: receipt.tuition_cents, processing_fee_cents: receipt.customer_processing_fee_cents });
      }
      const payer = receipt.payer ?? row.known_payers.join('; ');
      // Do not infer kinship. Exact attested relationship prose is retained as provenance.
      const explicitFamily = row.known_payers.some(statement => statement.toUpperCase().includes(payer.toUpperCase()) && /\b(father|mother|brother|sister|parent|wife|husband|family)\b/i.test(statement));
      aliases.set(payer, { payer, relationship: explicitFamily ? 'EXPLICIT_FAMILY' : 'VERIFIED_BENEFICIARY_RELATIONSHIP_UNKNOWN', provenance: { statements: row.known_payers, agreement_evidence_ids: row.agreement_evidence_ids, auto_settle: false } });
      payments.push({ ...id, provider: receipt.provider, provider_account: receipt.provider_account ?? 'Chase:sealed-receiving-account',
        provider_identity: receipt.provider === 'Chase' ? receipt.chase_reference : receipt.payment_id.slice(7),
        method: receipt.method, gross_cents: cents(receipt.amount_cents), payer,
        received_at: timestamp(receipt.received_at ?? receipt.notification_received_at), received_precision: receipt.received_at_precision ?? 'PROVIDER_EXACT',
        verification_state: 'VERIFIED', request_id: `match360-phase0c:${receipt.payment_id}`, evidence,
        applications: [
          ...(app.principal_cents > 0 ? [{ obligation_key: 'tuition-principal', component: 'TUITION_PRINCIPAL', amount_cents: cents(app.principal_cents) }] : []),
          ...(app.fees_cents > 0 ? [{ obligation_key: 'admin-processing-fee', component: 'ADMIN_PROCESSING_FEE', amount_cents: cents(app.fees_cents) }] : []),
        ],
      });
      sums.principal += app.principal_cents; sums.fees += app.fees_cents; sums.credit += app.unapplied_credit_cents;
    }
    assert(sums.principal === row.verified_principal_applied_cents && sums.fees === row.verified_fees_applied_cents && sums.credit === row.certified_credit_cents, 'Certified account application mismatch');
    const tuition = cents(row.accepted_tuition_cents), fees = cents(row.certified_plan_or_processing_fees_total_cents);
    assert(tuition - sums.principal + fees - sums.fees === row.certified_balance_cents, 'Certified balance mismatch');
    assert(row.next_due_date === null && (row.certified_balance_cents === 0 ? row.currently_due_amount_cents === 0 && row.overdue === false : row.currently_due_amount_cents === null && row.overdue === null), 'Unexpected due-date certification');
    return { ...id, program: row.program, tier: '360', tuition_cents: tuition, fees_cents: fees,
      deposit_cents: row.deposit_state === 'ACCEPTED' ? row.deposit_cents : null,
      certification_status: row.certification_status,
      plan: { description: row.plan, status: row.plan_status, next_due_date: null, next_due_date_state: 'UNKNOWN', operational_holds: row.operational_holds,
        verified_source_binding: (identity.get(row.student_key) ?? []).map(({ wp_id, missionaccounts_uuid, binding_state }) => ({ wp_id, missionaccounts_uuid, binding_state })) },
      discount_provenance: { embedded_cents: row.price_discount_embedded_cents, note: row.certified_adjustments_note, waiver_note: row.waiver_note },
      agreement_evidence: { ids: row.agreement_evidence_ids, evidence_sha256: SEALED_INPUT.evidence, reason: row.certification_reason, refund_state: row.refund_state },
      payer_aliases: [...aliases.values()].sort((a,b) => a.payer.localeCompare(b.payer)),
    };
  });
  assert(payments.length === applications.size, 'Orphan certified application');
  return { version: 'match360-phase0c-v1', request_id: `match360-phase0c:${SEALED_INPUT.ledger}`,
    source_ref: 'sealed:match360-phase0c-v1/certified-ledger.json', source_sha256: SEALED_INPUT.ledger,
    byte_count: byteCount, certified_at: timestamp(ledger.audit_time),
    certified: agreementRows.sort((a,b) => a.subject_key.localeCompare(b.subject_key)),
    held: held.map(row => ({ ...subject(row), hold_class: row.certification_status, reason: row.remaining_hold })).sort((a,b) => a.subject_key.localeCompare(b.subject_key)),
    payments: payments.sort((a,b) => a.request_id.localeCompare(b.request_id)),
  };
}
export async function loadSealedBundle({ ledgerPath, crosswalkPath, evidencePath }) {
  const [ledger, crosswalk, evidence] = await Promise.all([readFile(ledgerPath), readFile(crosswalkPath), readFile(evidencePath)]);
  assert(sha256(ledger) === SEALED_INPUT.ledger && sha256(crosswalk) === SEALED_INPUT.crosswalk && sha256(evidence) === SEALED_INPUT.evidence, 'Sealed input integrity failure');
  return buildCertifiedBundle(JSON.parse(ledger), JSON.parse(crosswalk), ledger.length);
}
