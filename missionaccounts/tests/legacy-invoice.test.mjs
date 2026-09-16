import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeLegacyInvoicePreview, FROZEN_GROUP_LEDGER_SHA256,
  FROZEN_IDENTITY_GRAPH_SHA256, FROZEN_RAW_ZOOM_SOURCE_SHA256,
  FROZEN_SOURCE_COUNTS,
  normalizeLegacyManualService,
} from '../src/domain/legacy-invoice-composer.mjs';
import { readFileSync } from 'node:fs';

const id = '11111111-1111-4111-8111-111111111111';
const hash = 'a'.repeat(64);
const cycleKey = '2026-cycle-1';
const student = {
  id, identity_state: 'verified',
  matrix_user_ref: '22222222-2222-4222-8222-222222222222',
  sponsor_type: 'DIRECT', absorbed: false, excluded: false,
  email: 'qa-student@example.test',
};
const frozenEvidence = {
  group_ledger_sha256: FROZEN_GROUP_LEDGER_SHA256,
  identity_graph_sha256: FROZEN_IDENTITY_GRAPH_SHA256,
  raw_zoom_source_sha256: FROZEN_RAW_ZOOM_SOURCE_SHA256,
  counts: FROZEN_SOURCE_COUNTS,
};
const source = {
  id: '33333333-3333-4333-8333-333333333333',
  student_id: id, cycle_key: cycleKey, artifact_sha256: FROZEN_GROUP_LEDGER_SHA256,
  source_state: 'READY', source_tier: '1-15 / $25 per attendance',
  source_events: 2, source_amount_cents: 5000,
};
const days = [
  { student_id: id, cycle_key: cycleKey, day: '2026-06-09', kind: 'billable' },
  { student_id: id, cycle_key: cycleKey, day: '2026-06-10', kind: 'billable' },
];
const base = () => ({
  student, cycleKey, groupSources: [source], attendanceDays: days,
  frozenEvidence, sourceDigestSha256: hash, stripeCustomerReady: true,
});

test('exact frozen group source and unique days yield Dr J review only', () => {
  const preview = composeLegacyInvoicePreview(base());
  assert.equal(preview.state, 'needs-drj-approval');
  assert.equal(preview.total_cents, 5000);
  assert.deepEqual(preview.lines[0].attendance_days, ['2026-06-09', '2026-06-10']);
  assert.equal(preview.provider_action_allowed, false);
  assert.match(preview.digest_sha256, /^[0-9a-f]{64}$/);
});

test('exact-row approval becomes ready and source change invalidates it', () => {
  const preview = composeLegacyInvoicePreview(base());
  const approval = {
    student_id: id, cycle_key: cycleKey, preview_digest_sha256: hash,
    source_digest_sha256: hash, amount_cents: 5000, approved_by: 'dr-j',
  };
  assert.equal(composeLegacyInvoicePreview({
    ...base(), approval, serverPreviewDigestSha256: hash,
  }).state, 'approval-ready');
  const changed = composeLegacyInvoicePreview({
    ...base(), attendanceDays: [{ ...days[0], day: '2026-06-11' }, days[1]], approval,
    serverPreviewDigestSha256: 'b'.repeat(64),
  });
  assert.equal(changed.approval_valid, false);
  assert.equal(changed.state, 'needs-drj-approval');
});

test('approval-ready requires the server digest and hosted-invoice customer path', () => {
  const preview = composeLegacyInvoicePreview({ ...base(), stripeCustomerReady: false });
  assert.equal(preview.state, 'held');
  assert.ok(preview.holds.includes('hosted_invoice_customer_missing'));
  const approval = { student_id: id, cycle_key: cycleKey,
    preview_digest_sha256: hash, source_digest_sha256: hash,
    amount_cents: 5000, approved_by: 'dr-j' };
  assert.notEqual(composeLegacyInvoicePreview({ ...base(), approval }).state, 'approval-ready');
});

test('attendance count, same-day duplicate and cap drift all hold', () => {
  assert.ok(composeLegacyInvoicePreview({
    ...base(), attendanceDays: [days[0]],
  }).holds.includes('frozen_event_count_mismatch'));
  assert.ok(composeLegacyInvoicePreview({
    ...base(), attendanceDays: [days[0], { ...days[0] }],
  }).holds.includes('attendance_day_duplicate'));
  assert.ok(composeLegacyInvoicePreview({
    ...base(), groupSources: [{ ...source, source_amount_cents: 37500 }],
  }).holds.includes('historical_cap_unresolved'));
});

test('frozen artifact drift and source holds cannot become collectible', () => {
  const result = composeLegacyInvoicePreview({
    ...base(), groupSources: [{ ...source, artifact_sha256: hash, source_state: 'IDENTITY_HOLD' }],
  });
  assert.equal(result.state, 'held');
  assert.ok(result.holds.includes('group_source_hash_drift'));
  assert.ok(result.holds.includes('group_source_identity_hold'));
});

test('sponsor and unresolved Matrix identity stay held', () => {
  assert.ok(composeLegacyInvoicePreview({
    ...base(), student: { ...student, sponsor_type: 'UCC' },
  }).holds.includes('sponsor_non_collectible'));
  assert.ok(composeLegacyInvoicePreview({
    ...base(), student: { ...student, matrix_user_ref: null },
  }).holds.includes('identity_not_canonical'));
});

test('all frozen artifacts, exact population, source digest and recipient are required', () => {
  assert.ok(composeLegacyInvoicePreview({
    ...base(), frozenEvidence: { ...frozenEvidence, raw_zoom_source_sha256: hash },
  }).holds.includes('frozen_source_hash_drift'));
  assert.ok(composeLegacyInvoicePreview({
    ...base(), frozenEvidence: {
      ...frozenEvidence, counts: { ...FROZEN_SOURCE_COUNTS, ready: 319 },
    },
  }).holds.includes('frozen_source_population_drift'));
  assert.ok(composeLegacyInvoicePreview({
    ...base(), sourceDigestSha256: null,
  }).holds.includes('source_digest_missing'));
  assert.ok(composeLegacyInvoicePreview({
    ...base(), student: { ...student, email: '' },
  }).holds.includes('recipient_email_missing'));
});

test('a dated historical 1-on-1 is included only with source and rate', () => {
  const manual = {
    student_id: id, cycle_key: cycleKey, service_key: 'service-1',
    revision: 1, state: 'attested', service_on: '2026-06-12',
    duration_minutes: 60, rate_cents: 8500, amount_cents: 8500,
    source_ref: 'Dr J attested service record', source_sha256: hash,
    treatment: 'none', reason: 'June tutorial', actor_id: 'dr-j',
  };
  const complete = composeLegacyInvoicePreview({ ...base(), manualServices: [manual] });
  assert.equal(complete.total_cents, 13500);
  assert.equal(complete.state, 'needs-drj-approval');
  const missing = composeLegacyInvoicePreview({
    ...base(), manualServices: [{ ...manual, rate_cents: null, source_ref: null }],
  });
  assert.equal(missing.state, 'held');
  assert.ok(missing.holds.includes('historical_rate_missing'));
  assert.ok(missing.holds.includes('manual_service_source_missing'));
  assert.throws(() => normalizeLegacyManualService({ ...manual, service_on: '2026-09-10' }));
});

test('latest manual revision wins, a withdrawal removes the charge', () => {
  const manual = {
    student_id: id, cycle_key: cycleKey, service_key: 'service-1',
    revision: 1, state: 'attested', service_on: '2026-06-12',
    duration_minutes: 60, rate_cents: 8500, amount_cents: 8500,
    source_ref: 'service attestation', source_sha256: hash,
    treatment: 'none', reason: 'June tutorial', actor_id: 'dr-j',
  };
  const withdrawal = { ...manual, revision: 2, state: 'withdrawn',
    reason: 'Corrected entry' };
  const result = composeLegacyInvoicePreview({
    ...base(), manualServices: [manual, withdrawal],
  });
  assert.equal(result.total_cents, 5000);
  assert.equal(result.lines.filter(line => line.kind === 'manual_1on1').length, 0);
});

test('existing invoice, succeeded charge and zero treatment block duplicates', () => {
  const result = composeLegacyInvoicePreview({
    ...base(),
    invoices: [{ student_id: id, cycle_key: cycleKey, state: 'paid' }],
    manualCharges: [{ student_id: id, cycle_key: cycleKey, state: 'succeeded' }],
    currentDecision: { student_id: id, cycle_key: cycleKey, treatment: 'ucc',
      state: 'approved', superseded_by_id: null },
  });
  assert.equal(result.state, 'held');
  assert.ok(result.holds.includes('already_paid_invoice'));
  assert.ok(result.holds.includes('already_paid_manual_charge'));
  assert.ok(result.holds.includes('existing_zero_treatment'));
});

test('a pending manual charge blocks a second collectible approval', () => {
  const result = composeLegacyInvoicePreview({
    ...base(), manualCharges: [{ student_id: id, cycle_key: cycleKey, state: 'pending' }],
  });
  assert.equal(result.state, 'held');
  assert.ok(result.holds.includes('pending_manual_charge'));
});

test('void history and every existing provider custody path block approval', () => {
  const result = composeLegacyInvoicePreview({
    ...base(),
    invoices: [{ student_id: id, cycle_key: cycleKey, state: 'void' }],
    dayCharges: [{ student_id: id, cycle_key: cycleKey, state: 'succeeded' }],
    autoChargeDispatches: [{ student_id: id, cycle_key: cycleKey, state: 'claimed' }],
    invoiceDispatches: [{ student_id: id, cycle_key: cycleKey, state: 'prepared' }],
  });
  assert.equal(result.state, 'held');
  assert.ok(result.holds.includes('void_invoice_history'));
  assert.ok(result.holds.includes('existing_day_charge'));
  assert.ok(result.holds.includes('existing_auto_charge_dispatch'));
  assert.ok(result.holds.includes('existing_invoice_dispatch'));
});

test('a sourced credit reduces the exact proposal but never triggers a provider', () => {
  const result = composeLegacyInvoicePreview({
    ...base(), credits: [{
      student_id: id, cycle_key: cycleKey, amount_cents: 1000,
      reason: 'Prior authorized credit', source_ref: 'credit ledger',
      source_sha256: hash, actor_id: 'dr-j',
    }],
  });
  assert.equal(result.total_cents, 4000);
  assert.equal(result.provider_action_allowed, false);
});

test('SQL authority recomputes the exact snapshot and pins every frozen source', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260915184500_legacy_invoice_5404c.sql', import.meta.url),
    'utf8',
  );
  for (const token of [
    FROZEN_GROUP_LEDGER_SHA256,
    FROZEN_IDENTITY_GRAPH_SHA256,
    FROZEN_RAW_ZOOM_SOURCE_SHA256,
    'legacy_frozen_sources_valid',
    'legacy_expected_invoice_lines',
    'legacy_invoice_preview_snapshot',
    'billing_has_financial_custody(p_student_id,p_cycle_key)',
    'legacy_identity_and_attendance_provenance_valid',
    "'stripe_customer_ready'",
    'legacy-approval:request:',
    "'identity_provenance'",
    "'source_links'",
    "'session_artifact_sha256'",
    "ir.source_controls->>'manifest_sha256'='5209775bceca32b4db848154d54b116a5ff9820d409cda648c9c9698ab6a1b60'",
    "(ir.source_controls->'raw_exports') ? sa.sha256",
    'legacy_frozen_source_bundle',
    'e.student_id=p_student_id',
    'e.cycle_key=p_cycle_key',
    'e.local_day=d.day',
    "p_lines is distinct from (v_preview->'lines')",
    "p_preview_digest_sha256<>(v_preview->>'preview_digest_sha256')",
  ]) assert.ok(migration.includes(token), token);
});
