import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutomaticBillingShadow } from '../src/domain/auto-billing-shadow.mjs';

function fixture(overrides = {}) {
  const studentId = overrides.studentId || '00000000-0000-4000-8000-000000000001';
  const dayId = overrides.dayId || '10000000-0000-4000-8000-000000000001';
  return {
    now: '2026-09-11T16:00:00.000Z',
    rolloutCutoff: '2026-09-09T12:00:00.000Z',
    attendanceDays: [{
      id: dayId, student_id: studentId, cycle_key: '2026-cycle-3', day: '2026-09-10',
      kind: 'billable', same_day_multiple_events: true, computed_at: '2026-09-10T12:00:00.000Z',
    }],
    students: [{ id: studentId, display_name: 'Student One', email: 'student@example.test', identity_state: 'verified', sponsor_type: 'DIRECT' }],
    billingDecisions: [{
      id: 'decision-1', student_id: studentId, cycle_key: '2026-cycle-3', treatment: 'confirm',
      amount_cents: 2500, state: 'approved', basis: { days: [{ id: dayId, kind: 'billable' }] },
    }],
    paymentMethods: [{ student_id: studentId, status: 'on_file', brand: 'visa', last4: '4242' }],
    billingConsents: [{ student_id: studentId, state: 'authorized' }],
    enrollmentProjections: [{
      student_id: studentId, program_key: 'examprep', provider: 'learndash', course_id: 6357,
      enrolled: true, valid_until: '2026-09-12T16:00:00.000Z',
    }],
    charges: [],
    ruleDecisions: [{ rule: 'one_charge_per_calendar_day', effective_from: '2026-01-01' }],
  };
}

test('zero-money shadow reports an eligible direct day without creating a provider action', () => {
  const result = buildAutomaticBillingShadow(fixture());
  assert.equal(result.live_money_moved_cents, 0);
  assert.equal(result.live_dispatch_enabled, false);
  assert.equal(result.summary.would_charge_students, 1);
  assert.equal(result.summary.would_charge_days, 1);
  assert.equal(result.summary.would_charge_total_cents, 2500);
  assert.equal(result.rows[0].status, 'WOULD_CHARGE');
  assert.equal(result.rows[0].attendance_evidence, 'multiple_events_one_day');
  assert.equal(result.rows[0].active_enrollment_gate.active, true);
  assert.equal(result.contract.automatic_expiry_hours, null);
});

test('sponsored, unresolved, missing-method, missing-consent and failed-charge rows fail closed', () => {
  const base = fixture();
  const copies = [
    { suffix: '2', student: { sponsor_type: 'UCC' }, expected: 'sponsored_direct_liability_blocked' },
    { suffix: '3', student: { identity_state: 'needs_review' }, expected: 'student_identity_requires_review' },
    { suffix: '4', method: null, expected: 'payment_method_required' },
    { suffix: '5', consent: null, expected: 'billing_authorization_required' },
    { suffix: '6', charge: { state: 'failed', amount_cents: 2500 }, expected: 'explicit_retry_required' },
  ];
  const input = { ...base, attendanceDays: [], students: [], billingDecisions: [], paymentMethods: [], billingConsents: [], enrollmentProjections: [], charges: [] };
  for (const item of copies) {
    const studentId = `00000000-0000-4000-8000-00000000000${item.suffix}`;
    const dayId = `10000000-0000-4000-8000-00000000000${item.suffix}`;
    input.attendanceDays.push({ ...base.attendanceDays[0], id: dayId, student_id: studentId });
    input.students.push({ ...base.students[0], id: studentId, display_name: `Student ${item.suffix}`, ...item.student });
    input.billingDecisions.push({ ...base.billingDecisions[0], id: `decision-${item.suffix}`, student_id: studentId, basis: { days: [{ id: dayId, kind: 'billable' }] } });
    if (item.method !== null) input.paymentMethods.push({ ...base.paymentMethods[0], student_id: studentId });
    if (item.consent !== null) input.billingConsents.push({ ...base.billingConsents[0], student_id: studentId });
    input.enrollmentProjections.push({ ...base.enrollmentProjections[0], student_id: studentId });
    if (item.charge) input.charges.push({ ...item.charge, student_id: studentId, attendance_day_id: dayId });
  }
  const result = buildAutomaticBillingShadow(input);
  assert.equal(result.summary.would_charge_days, 0);
  for (const item of copies) {
    assert.equal(result.rows.some(row => row.reasons.includes(item.expected)), true, item.expected);
  }
  assert.equal(result.summary.sponsored_excluded, 1);
  assert.equal(result.summary.sponsored_excluded_students, 1);
  assert.equal(result.summary.sponsored_excluded_rows, 1);
  assert.equal(result.summary.missing_payment_method, 1);
  assert.equal(result.summary.missing_consent, 1);
});

test('durable candidates do not expire after 48 hours and stale enrollment fails closed', () => {
  const durable = fixture();
  durable.now = '2026-09-14T16:00:00.000Z';
  durable.enrollmentProjections[0].valid_until = '2026-09-15T16:00:00.000Z';
  const eligible = buildAutomaticBillingShadow(durable);
  assert.equal(eligible.rows[0].status, 'WOULD_CHARGE');
  assert.equal(eligible.rows[0].reasons.includes('automatic_charge_window_missed'), false);

  durable.enrollmentProjections[0].valid_until = '2026-09-14T15:59:59.000Z';
  const stale = buildAutomaticBillingShadow(durable);
  assert.equal(stale.rows[0].status, 'WOULD_NOT_CHARGE');
  assert.ok(stale.rows[0].reasons.includes('examprep_enrollment_projection_stale'));
});

test('an old calendar day cannot be revived by post-rollout recomputation', () => {
  const input = fixture();
  input.rolloutCutoff = '2026-09-11T12:00:00.000Z';
  input.attendanceDays[0].day = '2026-09-10';
  input.attendanceDays[0].computed_at = '2026-09-11T13:00:00.000Z';
  input.now = '2026-09-12T14:00:00.000Z';
  input.enrollmentProjections[0].valid_until = '2026-09-13T00:00:00.000Z';
  const result = buildAutomaticBillingShadow(input);
  assert.equal(result.rows[0].status, 'WOULD_NOT_CHARGE');
  assert.ok(result.rows[0].reasons.includes('pre_rollout_attendance_not_chargeable'));
});

test('same-day dual-track remains one $25 candidate and prior success prevents repeat charge', () => {
  const input = fixture();
  input.charges = [{
    student_id: input.students[0].id,
    attendance_day_id: input.attendanceDays[0].id,
    amount_cents: 2500,
    state: 'succeeded',
  }];
  input.billingDecisions[0].amount_cents = 5000;
  const result = buildAutomaticBillingShadow(input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].status, 'WOULD_NOT_CHARGE');
  assert.ok(result.rows[0].reasons.includes('charge_already_succeeded'));
  assert.equal(result.summary.would_charge_total_cents, 0);
});
