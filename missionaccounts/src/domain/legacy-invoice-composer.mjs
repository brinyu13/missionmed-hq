import { createHash } from 'node:crypto';

// Source-only June–August composer. A preview never submits, sends or charges.
export const LEGACY_CYCLES = Object.freeze({
  '2026-cycle-1': ['2026-06-08', '2026-07-13'],
  '2026-cycle-2': ['2026-07-14', '2026-08-11'],
  '2026-cycle-3': ['2026-08-12', '2026-09-04'],
});
export const FROZEN_GROUP_LEDGER_SHA256 =
  '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108';
export const FROZEN_IDENTITY_GRAPH_SHA256 =
  'c8e89ab0217c5a6df21e4506f133f06d9470c8cd5b51c81eec356de251bce5ee';
export const FROZEN_RAW_ZOOM_SOURCE_SHA256 =
  '5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60';
export const FROZEN_SOURCE_COUNTS = Object.freeze({
  total: 498, ready: 320, identity_hold: 107, cap_hold: 69, source_link_hold: 2,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZERO_TREATMENTS = new Set([
  'ucc', 'mul', 'waived', 'prepaid', 'already_paid', 'already_invoiced',
  'guarantee', 'repeat',
]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function legacyDigest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function integer(value, minimum = 0) {
  return Number.isInteger(value) && value >= minimum;
}

function dateInCycle(day, cycleKey) {
  const limits = LEGACY_CYCLES[cycleKey];
  return /^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))
    && limits && day >= limits[0] && day <= limits[1];
}

// Missing historical source/rate is accepted as a held draft, never priced
// from the current prospective public tutoring offer.
export function normalizeLegacyManualService(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || !UUID.test(String(input.student_id || ''))
    || !LEGACY_CYCLES[input.cycle_key]
    || !dateInCycle(input.service_on, input.cycle_key)
    || !/^[A-Za-z0-9._:-]{1,120}$/.test(String(input.service_key || ''))
    || !integer(input.revision, 1)
    || !['attested', 'withdrawn'].includes(input.state)
    || !integer(input.duration_minutes, 1)
    || !integer(input.amount_cents, 0)
    || !['none', ...ZERO_TREATMENTS].includes(input.treatment)
    || !String(input.reason || '').trim()
    || !String(input.actor_id || '').trim()) {
    throw new Error('Legacy 1-on-1 attestation is incomplete or invalid');
  }
  const rate = input.rate_cents == null ? null : Number(input.rate_cents);
  if (rate != null && !integer(rate, 1)) throw new Error('Historical hourly rate is invalid');
  const ref = String(input.source_ref || '').trim();
  const sourceSha = String(input.source_sha256 || '').trim();
  if (ref.length > 500 || (sourceSha && !SHA.test(sourceSha))) {
    throw new Error('Legacy 1-on-1 source reference is invalid');
  }
  return {
    student_id: String(input.student_id).toLowerCase(),
    cycle_key: input.cycle_key,
    service_key: input.service_key,
    revision: input.revision,
    service_on: input.service_on,
    duration_minutes: input.duration_minutes,
    rate_cents: rate,
    amount_cents: input.amount_cents,
    source_ref: ref || null,
    source_sha256: sourceSha || null,
    treatment: input.treatment,
    state: input.state,
    reason: String(input.reason).trim(),
    actor_id: String(input.actor_id).trim(),
    supersedes_id: input.supersedes_id || null,
  };
}

function latestServices(rows, studentId, cycleKey, holds) {
  const byKey = new Map();
  for (const raw of rows) {
    let item;
    try { item = normalizeLegacyManualService(raw); }
    catch { holds.add('manual_service_invalid'); continue; }
    if (item.student_id !== studentId || item.cycle_key !== cycleKey) {
      holds.add('manual_service_identity_or_cycle_mismatch');
      continue;
    }
    const prior = byKey.get(item.service_key);
    if (prior && prior.revision === item.revision) holds.add('manual_service_revision_conflict');
    if (!prior || item.revision > prior.revision) byKey.set(item.service_key, item);
  }
  return [...byKey.values()].sort((a, b) =>
    a.service_on.localeCompare(b.service_on) || a.service_key.localeCompare(b.service_key));
}

export function composeLegacyInvoicePreview({
  student, cycleKey, groupSources = [], attendanceDays = [],
  manualServices = [], credits = [], invoices = [], manualCharges = [],
  dayCharges = [], autoChargeDispatches = [], invoiceDispatches = [],
  currentDecision = null, exceptionFlags = {}, approval = null,
  frozenEvidence = null, sourceDigestSha256 = null,
  stripeCustomerReady = false, paymentMethodOnFile = false,
  serverPreviewDigestSha256 = null,
}) {
  if (!student || !UUID.test(String(student.id || '')) || !LEGACY_CYCLES[cycleKey]) {
    throw new Error('A canonical student and June–August cycle are required');
  }
  const studentId = String(student.id).toLowerCase();
  const holds = new Set();
  const lines = [];
  const observedCounts = frozenEvidence?.counts || {};
  const observedFrozen = {
    group_ledger_sha256: frozenEvidence?.group_ledger_sha256 || null,
    identity_graph_sha256: frozenEvidence?.identity_graph_sha256 || null,
    raw_zoom_source_sha256: frozenEvidence?.raw_zoom_source_sha256 || null,
    counts: Object.fromEntries(Object.keys(FROZEN_SOURCE_COUNTS)
      .map(key => [key, observedCounts[key] ?? null])),
  };
  if (observedFrozen.group_ledger_sha256 !== FROZEN_GROUP_LEDGER_SHA256
    || observedFrozen.identity_graph_sha256 !== FROZEN_IDENTITY_GRAPH_SHA256
    || observedFrozen.raw_zoom_source_sha256 !== FROZEN_RAW_ZOOM_SOURCE_SHA256) {
    holds.add('frozen_source_hash_drift');
  }
  if (Object.entries(FROZEN_SOURCE_COUNTS)
    .some(([key, expected]) => observedFrozen.counts[key] !== expected)) {
    holds.add('frozen_source_population_drift');
  }
  const sourceDigest = String(sourceDigestSha256 || '').toLowerCase();
  if (!SHA.test(sourceDigest)) holds.add('source_digest_missing');
  const recipientEmail = String(student.email || '').trim().toLowerCase();
  if (!EMAIL.test(recipientEmail)) holds.add('recipient_email_missing');
  if (stripeCustomerReady !== true) holds.add('hosted_invoice_customer_missing');
  if (student.identity_state !== 'verified' || !student.matrix_user_ref
    || student.absorbed === true || student.excluded === true) holds.add('identity_not_canonical');
  const sponsor = String(student.sponsor_type || '').toLowerCase();
  if (sponsor !== 'direct') holds.add(sponsor === 'ucc' || sponsor === 'mul'
    ? 'sponsor_non_collectible' : 'sponsor_unresolved');
  for (const [key, present] of Object.entries(exceptionFlags)) {
    if (present && ZERO_TREATMENTS.has(key)) holds.add('exception_' + key);
  }
  if (currentDecision && currentDecision.superseded_by_id == null) {
    if (ZERO_TREATMENTS.has(currentDecision.treatment)) holds.add('existing_zero_treatment');
    else if (currentDecision.state === 'approved') holds.add('existing_approved_decision');
  }
  for (const invoice of invoices) {
    if (invoice.student_id === studentId && invoice.cycle_key === cycleKey) {
      holds.add(invoice.state === 'paid' ? 'already_paid_invoice'
        : invoice.state === 'void' ? 'void_invoice_history' : 'existing_invoice');
    }
  }
  for (const charge of manualCharges) {
    if (charge.student_id === studentId && charge.cycle_key === cycleKey
      && ['pending', 'succeeded'].includes(charge.state)) holds.add(charge.state === 'succeeded'
        ? 'already_paid_manual_charge' : 'pending_manual_charge');
  }
  if (dayCharges.some(row => row.student_id === studentId && row.cycle_key === cycleKey)) {
    holds.add('existing_day_charge');
  }
  if (autoChargeDispatches.some(row => row.student_id === studentId
    && row.cycle_key === cycleKey)) holds.add('existing_auto_charge_dispatch');
  if (invoiceDispatches.some(row => row.student_id === studentId
    && row.cycle_key === cycleKey)) holds.add('existing_invoice_dispatch');

  const sources = groupSources.filter(row => row.student_id === studentId
    && row.cycle_key === cycleKey);
  if (groupSources.length !== sources.length) holds.add('group_source_identity_or_cycle_mismatch');
  if (sources.length > 1) holds.add('multiple_group_sources');
  const source = sources[0];
  if (!source) holds.add('group_source_missing');
  else {
    if (source.artifact_sha256 !== FROZEN_GROUP_LEDGER_SHA256) holds.add('group_source_hash_drift');
    if (source.source_state !== 'READY') holds.add('group_source_' + String(source.source_state || 'unknown').toLowerCase());
    if (!integer(source.source_events) || !integer(source.source_amount_cents)) holds.add('group_source_invalid');
    if (source.source_amount_cents > 30000) holds.add('historical_cap_unresolved');
    const days = attendanceDays.filter(day => day.student_id === studentId
      && day.cycle_key === cycleKey && dateInCycle(day.day, cycleKey));
    if (days.length !== attendanceDays.length) holds.add('attendance_identity_or_cycle_mismatch');
    const unique = new Set(days.map(day => day.day));
    if (unique.size !== days.length) holds.add('attendance_day_duplicate');
    if (days.some(day => day.kind !== 'billable')) holds.add('attendance_day_review');
    if (integer(source.source_events) && days.length !== source.source_events) {
      holds.add('frozen_event_count_mismatch');
    }
    if (source.source_tier === '1-15 / $25 per attendance'
      && integer(source.source_events) && source.source_amount_cents !== source.source_events * 2500) {
      holds.add('frozen_amount_mismatch');
    }
    lines.push({
      kind: 'frozen_group', student_id: studentId, cycle_key: cycleKey,
      source_id: source.id, artifact_sha256: source.artifact_sha256,
      source_state: source.source_state, source_tier: source.source_tier,
      source_events: source.source_events, attendance_days: [...unique].sort(),
      amount_cents: source.source_amount_cents,
    });
  }

  for (const service of latestServices(manualServices, studentId, cycleKey, holds)) {
    if (service.state === 'withdrawn') continue;
    if (ZERO_TREATMENTS.has(service.treatment)) holds.add('manual_service_non_collectible');
    if (!service.source_ref || !service.source_sha256) holds.add('manual_service_source_missing');
    if (!service.rate_cents) holds.add('historical_rate_missing');
    else if (service.amount_cents !== Math.round(service.rate_cents * service.duration_minutes / 60)) {
      holds.add('manual_service_rate_amount_mismatch');
    }
    lines.push({
      kind: 'manual_1on1', student_id: studentId, cycle_key: cycleKey,
      service_key: service.service_key, revision: service.revision,
      service_on: service.service_on, duration_minutes: service.duration_minutes,
      rate_cents: service.rate_cents, amount_cents: service.amount_cents,
      source_ref: service.source_ref, source_sha256: service.source_sha256,
      treatment: service.treatment, reason: service.reason, actor_id: service.actor_id,
    });
  }
  for (const credit of credits) {
    if (credit.student_id !== studentId || credit.cycle_key !== cycleKey
      || !integer(credit.amount_cents, 1) || !String(credit.reason || '').trim()
      || !String(credit.source_ref || '').trim() || !SHA.test(String(credit.source_sha256 || ''))) {
      holds.add('credit_source_invalid');
      continue;
    }
    lines.push({
      kind: 'credit', student_id: studentId, cycle_key: cycleKey,
      amount_cents: -credit.amount_cents, reason: credit.reason,
      source_ref: credit.source_ref, source_sha256: credit.source_sha256,
      actor_id: credit.actor_id || null,
    });
  }
  const total = lines.reduce((sum, line) => sum + line.amount_cents, 0);
  if (total <= 0) holds.add('non_positive_total');
  const sortedHolds = [...holds].sort();
  const evidence = {
    student_id: studentId, cycle_key: cycleKey, lines, total_cents: total,
    source_digest_sha256: sourceDigest || null, recipient_email: recipientEmail || null,
    frozen_sources: observedFrozen,
  };
  const digest = legacyDigest(evidence);
  const serverDigest = String(serverPreviewDigestSha256 || '').toLowerCase();
  const signed = approval && SHA.test(serverDigest) && approval.student_id === studentId
    && approval.cycle_key === cycleKey && approval.preview_digest_sha256 === serverDigest
    && approval.source_digest_sha256 === sourceDigest
    && approval.amount_cents === total && approval.approved_by
    && sortedHolds.length === 0;
  return {
    student_id: studentId, cycle_key: cycleKey, lines, total_cents: total,
    holds: sortedHolds, digest_sha256: digest, preview_digest_sha256: SHA.test(serverDigest) ? serverDigest : null,
    source_digest_sha256: sourceDigest || null, recipient_email: recipientEmail || null,
    payment_path: 'hosted_invoice', stripe_customer_ready: stripeCustomerReady === true,
    payment_method_on_file: paymentMethodOnFile === true,
    state: sortedHolds.length ? 'held' : signed ? 'approval-ready' : 'needs-drj-approval',
    approval_valid: Boolean(signed), provider_action_allowed: false,
  };
}
