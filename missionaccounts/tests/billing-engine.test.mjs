import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionBasis, calculateCycleAmount, decisionIsStale, deriveBillableDays, localDayFromIso } from '../src/domain/billing-engine.mjs';

const student = { id: 'student-1', comp_days_allowance: 0 };
const sessions = [
  { id: 's1', state: 'confirmed', starts_at: '2026-06-10T16:00:00Z' },
  { id: 's2', state: 'confirmed', starts_at: '2026-06-10T19:00:00Z' },
  { id: 's3', state: 'confirmed', starts_at: '2026-06-11T16:00:00Z' },
];
const events = [
  { id: 'e1', student_id: 'student-1', session_id: 's1', cycle_key: 'june', local_day: '2026-06-10', step: 's1' },
  { id: 'e2', student_id: 'student-1', session_id: 's2', cycle_key: 'june', local_day: '2026-06-10', step: 's23' },
  { id: 'e3', student_id: 'student-1', session_id: 's3', cycle_key: 'june', local_day: '2026-06-11', step: 's1' },
];

test('same-day Step 1 and Step 2/3 collapse to one billable day', () => {
  const days = deriveBillableDays({ student, sessions, events });
  assert.equal(days.length, 2);
  assert.equal(days[0].event_ids.length, 2);
  assert.equal(calculateCycleAmount({ days }).amount_cents, 5_000);
});

test('removing one of two same-day events preserves the day', () => {
  const days = deriveBillableDays({
    student,
    sessions,
    events,
    corrections: [{ type: 'remove', attendance_event_id: 'e1' }],
  });
  assert.equal(days.length, 2);
  assert.deepEqual(days[0].event_ids, ['e2']);
});

test('an append-only add correction can restore a removed attendance event', () => {
  const days = deriveBillableDays({
    student,
    sessions,
    events,
    corrections: [
      { id: 'c1', created_at: '2026-09-01T10:00:00Z', type: 'remove', attendance_event_id: 'e1' },
      { id: 'c2', created_at: '2026-09-01T11:00:00Z', type: 'add', attendance_event_id: 'e1', reverts_id: 'c1' },
    ],
  });
  assert.deepEqual(days[0].event_ids, ['e1', 'e2']);
});

test('step relabel changes interpretation without changing source event identity', () => {
  const days = deriveBillableDays({
    student,
    sessions,
    events: [events[0]],
    corrections: [{ id: 'c1', type: 'step_relabel', attendance_event_id: 'e1', to_val: { step: 's23' } }],
  });
  assert.deepEqual(days[0].event_ids, ['e1']);
  assert.deepEqual(days[0].steps, ['s23']);
  assert.equal(events[0].step, 's1');
});

test('comp days apply to otherwise-billable days and grace is not consumed', () => {
  const days = deriveBillableDays({
    student: { ...student, comp_days_allowance: 1 },
    sessions,
    events,
    graceWindows: [{ from_on: '2026-06-09', to_on: '2026-06-10' }],
  });
  assert.equal(days[0].kind, 'grace');
  assert.equal(days[1].kind, 'comped');
  assert.equal(days[1].comp_index, 1);
});

test('grace is strictly after exam date and inclusive of its close date', () => {
  const days = deriveBillableDays({
    student,
    sessions,
    events,
    graceWindows: [{ from_on: '2026-06-10', to_on: '2026-06-11' }],
  });
  assert.equal(days[0].kind, 'billable');
  assert.equal(days[1].kind, 'grace');
});

test('verified historical full-cycle arrangement cannot increase above $300', () => {
  const days = Array.from({ length: 15 }, (_, index) => ({ kind: 'billable', day: `2026-06-${String(index + 1).padStart(2, '0')}` }));
  assert.equal(calculateCycleAmount({ days }).amount_cents, 37_500);
  assert.equal(calculateCycleAmount({ days, historicalArrangement: { verified: true, type: 'full_cycle_300' } }).amount_cents, 30_000);
});

test('unverified cap eligibility is never invented', () => {
  const days = Array.from({ length: 15 }, () => ({ kind: 'billable' }));
  assert.equal(calculateCycleAmount({ days, historicalArrangement: { verified: false, type: 'full_cycle_300' } }).amount_cents, 37_500);
});

test('decision basis becomes stale when derived counts change', () => {
  const days = deriveBillableDays({ student, sessions, events });
  const financial = { source_digest: 'source-1', treatment: 'confirm', amount_cents: 5_000, account_state: 'approved' };
  const basis = buildDecisionBasis(days, financial);
  const decision = { basis, basis_sha256: basis.basis_sha256 };
  assert.equal(decisionIsStale(decision, days, financial), false);
  assert.equal(decisionIsStale(decision, days.slice(0, 1)), true);
});

test('financially material changes make an approval stale', () => {
  const days = deriveBillableDays({ student, sessions, events });
  const financial = {
    source_digest: 'source-1',
    treatment: 'confirm',
    amount_cents: 5_000,
    account_state: 'approved',
    cap: { id: 'cap-1', status: 'verified', ceiling_cents: 30_000 },
  };
  const basis = buildDecisionBasis(days, financial);
  const decision = { basis, basis_sha256: basis.basis_sha256 };
  assert.equal(decisionIsStale(decision, days, { ...financial, treatment: 'mul', amount_cents: 0 }), true);
  assert.equal(decisionIsStale(decision, days, { ...financial, cap: { ...financial.cap, status: 'rejected' } }), true);
  assert.equal(decisionIsStale(decision, days, { ...financial, source_digest: 'source-2' }), true);
});

test('same-day event membership change makes an approval stale even when the day count is unchanged', () => {
  const days = deriveBillableDays({ student, sessions, events });
  const financial = { source_digest: 'source-1', treatment: 'confirm', amount_cents: 5_000 };
  const basis = buildDecisionBasis(days, financial);
  const decision = { basis, basis_sha256: basis.basis_sha256 };
  const changed = structuredClone(days);
  changed[0].event_ids = ['e1'];
  assert.equal(decisionIsStale(decision, changed, financial), true);
});

test('local calendar day is timezone-correct at 23:30 ET', () => {
  assert.equal(localDayFromIso('2026-06-11T03:30:00Z', 'America/New_York'), '2026-06-10');
});
