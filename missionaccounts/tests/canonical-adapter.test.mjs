import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalModel } from '../public/missionaccounts-canonical-adapter.js';

const studentId = '00000000-0000-4000-8000-000000000001';
const sessionOne = '10000000-0000-4000-8000-000000000001';
const sessionTwo = '10000000-0000-4000-8000-000000000002';

function bootstrap(scope = 'student') {
  return {
    scope,
    ...(scope === 'admin' ? {
      health: {
        zoom_sync_enabled: true,
        zoom_provider_configured: true,
        open_integration_exceptions: 2,
        failed_provider_events: 1,
        failed_notifications: 0,
        latest_zoom_sync: {
          state: 'ok', started_at: '2026-09-06T12:00:00Z', finished_at: '2026-09-06T12:02:00Z', error: null,
          stats: { sessions: 3, source_rows: 57, private_detail: 'must not pass through' },
        },
      },
    } : {}),
    account: scope === 'student' ? {
      payment_method: { status: 'on_file', brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2029 },
      billing_consent: { state: 'authorized' },
    } : null,
    students: scope === 'admin' ? [{
      id: studentId,
      payment_method: { status: 'on_file', brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2029 },
      billing_consent: { state: 'authorized' },
    }] : undefined,
    canon: {
      schema_version: 'missionaccounts-canonical-data-v1',
      scope,
      cycles: [
        { key: '2026-cycle-1', label: 'June 8 – July 13, 2026', starts_on: '2026-06-08', ends_on: '2026-07-13', state: 'review' },
        { key: '2026-cycle-2', label: 'July 14 – August 11, 2026', starts_on: '2026-07-14', ends_on: '2026-08-11', state: 'review' },
        { key: '2026-cycle-3', label: 'August 12 – September 4, 2026', starts_on: '2026-08-12', ends_on: '2026-09-04', state: 'review' },
      ],
      sessions: [
        { id: sessionOne, cycle_key: '2026-cycle-1', provider_meeting_id: scope === 'admin' ? 'meeting-1' : undefined, starts_at: '2026-06-08T16:00:00Z', held_on: '2026-06-08', time_zone: 'America/New_York', step: 's1', state: 'confirmed' },
        { id: sessionTwo, cycle_key: '2026-cycle-1', provider_meeting_id: scope === 'admin' ? 'meeting-2' : undefined, starts_at: '2026-06-08T19:00:00Z', held_on: '2026-06-08', time_zone: 'America/New_York', step: 's23', state: 'confirmed' },
      ],
      students: [{ id: studentId, display_name: 'Preview Student', email: 'student@example.invalid', phone: null, joined_at: '2026-09-06', comp_days_allowance: 5, identity_state: 'verified' }],
      aliases: [{ id: 'alias-1', student_id: studentId, source_key: 'source-1', display_value: 'Preview Student', relationship_state: 'verified', confidence: 1 }],
      attendance_events: [
        { id: 'event-1', student_id: studentId, session_id: sessionOne, cycle_key: '2026-cycle-1', local_day: '2026-06-08', step: 's1', interpretation_state: 'effective', duration_minutes: 60, source_row_count: 1, source_display_name: 'Preview Student' },
        { id: 'event-2', student_id: studentId, session_id: sessionTwo, cycle_key: '2026-cycle-1', local_day: '2026-06-08', step: 's23', interpretation_state: 'effective', duration_minutes: 45, source_row_count: 1, source_display_name: 'Preview Student' },
      ],
      attendance_days: [{ id: 'day-1', student_id: studentId, cycle_key: '2026-cycle-1', day: '2026-06-08', kind: 'billable', comp_index: null, same_day_multiple_events: true }],
      billing_decisions: [], invoices: [], exam_plans: [], exam_transitions: [], grace_windows: [], reminders: [], attendance_corrections: [], full_cycle_ceilings: [], cycle_policies: [],
      rule_decisions: [{ rule: 'one_charge_per_calendar_day', mode: 'retroactive', effective_from: '2026-06-08', decided_at: '2026-09-06T12:00:00Z' }],
      ...(scope === 'admin' ? { identity_clusters: [] } : {}),
    },
  };
}

test('canonical adapter preserves two same-day source events while deriving one $25 day', () => {
  const model = buildCanonicalModel(bootstrap('student'));
  assert.equal(model.data.students.length, 1);
  assert.equal(model.data.students[0].c.june.att, 2);
  assert.equal(model.data.students[0].c.june.s1, 1);
  assert.equal(model.data.students[0].c.june.s23, 1);
  assert.equal(model.data.events.length, 2);
  assert.equal(model.data.cycles[0].amount, 25);
  assert.equal(model.data.cycles[0].days, 1);
  assert.equal(model.data.sessions[0].t, '2026-06-08T12:00:00');
  assert.equal(model.data.sessions[0].m, '');
  assert.equal(model.working.lens, 'student');
  assert.equal(model.working.comp[0].allowance, 5);
  assert.equal(model.working.pm[0].state, 'on_file');
  assert.equal(model.ids.students[0], studentId);
});

test('canonical adapter exposes meeting references only inside an admin-scoped payload', () => {
  const student = buildCanonicalModel(bootstrap('student'));
  const admin = buildCanonicalModel(bootstrap('admin'));
  assert.equal(student.data.sessions[0].m, '');
  assert.equal(admin.data.sessions[0].m, 'meeting-1');
  assert.equal(admin.working.lens, 'admin');
  assert.equal(Object.hasOwn(student.data.meta, 'integration_health'), false);
  assert.deepEqual(admin.data.meta.integration_health, {
    zoom_sync_enabled: true,
    zoom_provider_configured: true,
    latest_zoom_sync: {
      state: 'ok', started_at: '2026-09-06T12:00:00Z', finished_at: '2026-09-06T12:02:00Z', error: '',
      stats: { sessions: 3, source_rows: 57 },
    },
    open_integration_exceptions: 2,
    failed_provider_events: 1,
    failed_notifications: 0,
  });
});

test('canonical adapter rejects a payload whose authenticated scope and data scope disagree', () => {
  const mismatched = bootstrap('student');
  mismatched.scope = 'admin';
  assert.throws(() => buildCanonicalModel(mismatched), /scope mismatch/);
});

test('canonical adapter translates persisted server decision basis into the Founder canon without false staleness', () => {
  const source = bootstrap('admin');
  source.canon.billing_decisions = [{
    id: 'decision-1',
    student_id: studentId,
    cycle_key: '2026-cycle-1',
    treatment: 'confirm',
    amount_cents: 2_500,
    state: 'approved',
    decided_at: '2026-09-06T12:00:00Z',
    basis: {
      rule: 'one_charge_per_calendar_day',
      units: 'calendar_days',
      att: 2,
      billable: 1,
      comped: 0,
      grace: 0,
      dayCount: 1,
    },
  }];
  source.canon.invoices = [{
    id: 'invoice-1',
    student_id: studentId,
    cycle_key: '2026-cycle-1',
    decision_id: 'decision-1',
    state: 'ready',
    amount_cents: 2_500,
  }];
  const model = buildCanonicalModel(source);
  assert.deepEqual(model.working.dec[0].june.basis, {
    rule: 'day', u: 1, att: 2, billable: 1, comped: 0, grace: 0, dayCount: 1, kind: 'per',
  });
  assert.equal(model.working.ready[0].june, true);
});

test('canonical adapter hydrates the complete accepted exam history while showing only the active plan', () => {
  const source = bootstrap('student');
  source.canon.exam_plans = [
    {
      id: 'plan-old', student_id: studentId, step: 's1', exam_on: '2026-09-09', state: 'approved',
      submitted_at: '2026-08-01T12:00:00Z', withdrawn_at: null, superseded_by_id: 'plan-current',
    },
    {
      id: 'plan-current', student_id: studentId, step: 's2', exam_on: '2026-11-18', state: 'denied',
      suggested_on: '2026-12-02', submitted_at: '2026-10-01T12:00:00Z', withdrawn_at: null, superseded_by_id: null,
    },
  ];
  source.canon.exam_transitions = [
    { id: 'transition-1', exam_plan_id: 'plan-old', student_id: studentId, from_state: null, to_state: 'pending', result: null, accepted: true, reason: 'submitted', actor_role: 'student', created_at: '2026-08-01T12:00:00Z' },
    { id: 'transition-2', exam_plan_id: 'plan-old', student_id: studentId, from_state: 'pending', to_state: 'approved', result: null, accepted: true, reason: null, actor_role: 'missionaccounts_admin', created_at: '2026-08-02T12:00:00Z' },
    { id: 'transition-3', exam_plan_id: 'plan-current', student_id: studentId, from_state: null, to_state: 'pending', result: null, accepted: true, reason: 'submitted', actor_role: 'missionaccounts_admin', created_at: '2026-10-01T12:00:00Z' },
    { id: 'transition-4', exam_plan_id: 'plan-current', student_id: studentId, from_state: 'pending', to_state: 'denied', result: null, accepted: true, reason: 'Choose the later sitting', actor_role: 'missionaccounts_admin', created_at: '2026-10-02T12:00:00Z' },
  ];
  const model = buildCanonicalModel(source);
  assert.equal(model.working.exam[0].id, 'plan-current');
  assert.equal(model.working.exam[0].suggested, '2026-12-02');
  assert.deepEqual(model.working.exam[0].history.map(item => item.action), ['submitted', 'approve', 'submitted', 'deny']);
  assert.equal(model.working.exam[0].history[0].by, 'student');
  assert.equal(model.working.exam[0].history[3].note, 'Choose the later sitting');
});
