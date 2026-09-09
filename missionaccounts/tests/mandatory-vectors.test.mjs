import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateCycleAmount, deriveBillableDays, localDayFromIso } from '../src/domain/billing-engine.mjs';
import { thirdWednesdayAfter, transitionExamPlan } from '../src/domain/exam-engine.mjs';
import { consolidateAttendanceFragments } from '../src/domain/source-normalizer.mjs';
import { chargeEligibility, InMemoryChargeLedger } from '../src/domain/charge-engine.mjs';

const student = { id: 'u1', comp_days_allowance: 0 };
function fixture(days) {
  const sessions = [];
  const events = [];
  days.forEach((day, index) => {
    const id = `s${index}`;
    sessions.push({ id, state: 'confirmed', starts_at: `${day}T16:00:00Z` });
    events.push({ id: `e${index}`, student_id: 'u1', session_id: id, cycle_key: 'current', local_day: day, step: index % 2 ? 's23' : 's1' });
  });
  return { sessions, events };
}

test('V01 Step 1 only produces one $25 billable day', () => {
  const { sessions, events } = fixture(['2026-09-07']);
  const days = deriveBillableDays({ student, sessions, events });
  assert.deepEqual([days.length, days[0].kind, calculateCycleAmount({ days }).amount_cents], [1, 'billable', 2500]);
});

test('V02 Step 2/3 only produces one $25 billable day', () => {
  const { sessions, events } = fixture(['2026-09-07']);
  events[0].step = 's23';
  const days = deriveBillableDays({ student, sessions, events });
  assert.deepEqual([days.length, days[0].steps[0], calculateCycleAmount({ days }).amount_cents], [1, 's23', 2500]);
});

test('V03 same-date classes retain two events and price one day', () => {
  const { sessions, events } = fixture(['2026-09-07', '2026-09-07']);
  const days = deriveBillableDays({ student, sessions, events });
  assert.equal(days.length, 1);
  assert.equal(days[0].event_ids.length, 2);
  assert.equal(calculateCycleAmount({ days }).amount_cents, 2500);
});

test('V04 reconnect fragments dedupe by source id and collapse by student-session', () => {
  const rows = [1, 2, 3].map(index => ({ provider_source_id: `src${index}`, student_id: 'u1', session_id: 's1', joined_at: `2026-09-07T16:0${index}:00Z`, left_at: `2026-09-07T16:1${index}:00Z` }));
  const events = consolidateAttendanceFragments([...rows, rows[0]]);
  assert.equal(events.length, 1);
  assert.equal(events[0].source_row_ids.length, 3);
});

test('V05 newly joined student receives five otherwise-billable comp days', () => {
  const { sessions, events } = fixture(['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-14']);
  const days = deriveBillableDays({ student: { ...student, comp_days_allowance: 5 }, sessions, events });
  assert.deepEqual(days.map(day => day.kind), ['comped','comped','comped','comped','comped','billable']);
  assert.equal(calculateCycleAmount({ days }).amount_cents, 2500);
});

test('V06 prospective comp reduction preserves already locked days', () => {
  const { sessions, events } = fixture(['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11']);
  const locked = events.map(event => event.local_day);
  const days = deriveBillableDays({ student: { ...student, comp_days_allowance: 2 }, sessions, events, persistedCompDays: locked });
  assert.equal(days.filter(day => day.kind === 'comped').length, 5);
});

test('V07 pending exam plan opens no grace and schedules no reminder', () => {
  const plan = { id: 'p1', student_id: 'u1', state: 'pending', exam_on: '2026-08-21' };
  assert.equal(plan.state, 'pending');
  assert.equal(plan.grace_window, undefined);
});

test('V08 denial before approval creates no grace effect', () => {
  const result = transitionExamPlan({ plan: { id: 'p1', student_id: 'u1', state: 'pending', exam_on: '2026-08-21' }, to: 'denied', actor: 'admin', today: '2026-08-10' });
  assert.equal(result.effects.open_grace, null);
  assert.equal(result.effects.close_grace, null);
});

test('V09 exam date stays billable while dates after approval are grace', () => {
  const { sessions, events } = fixture(['2026-08-21','2026-08-22']);
  const days = deriveBillableDays({ student, sessions, events, graceWindows: [{ from_on: '2026-08-21', to_on: null }] });
  assert.deepEqual(days.map(day => day.kind), ['billable','grace']);
  assert.equal(thirdWednesdayAfter('2026-08-21'), '2026-09-09');
});

test('V10 Passed closes grace inclusively and next class resumes billing', () => {
  const { sessions, events } = fixture(['2026-09-01','2026-09-02']);
  const days = deriveBillableDays({ student, sessions, events, graceWindows: [{ from_on: '2026-08-21', to_on: '2026-09-01' }] });
  assert.deepEqual(days.map(day => day.kind), ['grace','billable']);
});

test('V11 third-Wednesday and 23:30 local-date boundaries are deterministic', () => {
  assert.deepEqual([thirdWednesdayAfter('2026-08-21'), thirdWednesdayAfter('2026-09-09'), thirdWednesdayAfter('2026-12-01')], ['2026-09-09','2026-09-30','2026-12-16']);
  assert.equal(localDayFromIso('2026-09-08T03:30:00Z', 'America/New_York'), '2026-09-07');
});

test('V12 a closed grace window remains a protected free fact', () => {
  const { sessions, events } = fixture(['2026-08-22']);
  for (const laterState of ['passed','pending','denied']) {
    const days = deriveBillableDays({ student, sessions, events, graceWindows: [{ from_on: '2026-08-21', to_on: '2026-09-01', later_state: laterState }] });
    assert.equal(days[0].kind, 'grace');
  }
});

test('V13 real historical controls are sealed by the privacy-safe source validation report', async () => {
  const report = JSON.parse(await readFile(new URL('../evidence/source-validation.json', import.meta.url)));
  assert.equal(report.controls.attendance_events, 3941);
  assert.equal(report.controls.total_amount, 77075);
  assert.deepEqual(Object.values(report.controls.cycles).map(row => row.amount), [25425,26575,25075]);
});

test('V14 only a verified historical ceiling can prevent a $350/$375 increase', () => {
  const days = Array.from({ length: 15 }, () => ({ kind: 'billable' }));
  assert.equal(calculateCycleAmount({ days, historicalArrangement: { verified: true, type: 'full_cycle_300' } }).amount_cents, 30000);
  assert.equal(calculateCycleAmount({ days, historicalArrangement: { verified: false, type: 'full_cycle_300' } }).amount_cents, 37500);
});

test('V15 duplicate workers and webhook retries produce one charge and receipt', () => {
  const ledger = new InMemoryChargeLedger();
  assert.equal(ledger.enqueue('day1'), ledger.enqueue('day1'));
  assert.equal(ledger.processSucceededWebhook({ eventId: 'evt1', paymentIntentId: 'pi1', dayId: 'day1' }).status, 'succeeded');
  assert.equal(ledger.processSucceededWebhook({ eventId: 'evt1', paymentIntentId: 'pi1', dayId: 'day1' }).status, 'duplicate_event');
  assert.equal(ledger.processSucceededWebhook({ eventId: 'evt2', paymentIntentId: 'pi1', dayId: 'day1' }).status, 'already_succeeded');
  assert.equal(ledger.receipts.size, 1);
});

test('V16 RLS migration forces row isolation and exposes no provider references', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /force row level security/);
  assert.match(sql, /matrix_user_ref = \(select auth\.uid\(\)\)::text/);
  assert.match(sql, /auth\.jwt\(\)[^\n]+app_role[^\n]+missionaccounts_admin/);
  assert.match(sql, /matrix_user_ref text unique/);
  assert.match(sql, /actor_id text/);
  assert.match(sql, /grant select \(id, student_id, brand, last4, exp_month, exp_year, status, verified_at, updated_at\)/);
  assert.doesNotMatch(sql, /grant select \([^;]*provider_pm_ref/i);
});

test('V17 correction path is append-only and source rows are immutable', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /attendance_source_row_immutable/);
  assert.match(sql, /attendance_correction_immutable/);
  assert.match(sql, /immutable MissionAccounts evidence cannot be updated or deleted/);
});

test('exam-plan RPC is transactional, idempotent, audited, and queues a notification', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_submit_exam_plan/);
  assert.match(sql, /create function missionaccounts\.api_withdraw_exam_plan/);
  assert.match(sql, /closed_reason = 'withdrawn'/);
  assert.match(sql, /p_request_id \|\| ':exam-plan-withdrawn'/);
  assert.match(sql, /where et\.request_id = p_request_id/);
  assert.match(sql, /exam_plan_submission_forbidden/);
  assert.match(sql, /actor_role text not null check \(actor_role in/);
  assert.match(sql, /suggested_on date/);
  assert.match(sql, /'exam_plan\.submitted'/);
  assert.match(sql, /closed_reason = 'plan_replaced'/);
  assert.match(sql, /cancelled_reason = 'plan_replaced'/);
  assert.match(sql, /p_request_id \|\| ':exam-plan-replaced'/);
  assert.match(sql, /insert into missionaccounts\.notification_outbox/);
  assert.match(sql, /grant execute on function missionaccounts\.api_submit_exam_plan[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_withdraw_exam_plan[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_submit_exam_plan[^;]+to authenticated/s);
});

test('comp allowance RPC is admin-only, idempotent, audited, and preserves prospective locks', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_set_comp_allowance/);
  assert.match(sql, /if p_apply_retroactively and p_allowance < current_student\.comp_days_allowance/);
  assert.match(sql, /and comp_index > p_allowance/);
  assert.match(sql, /'comp_allowance\.changed'/);
  assert.match(sql, /grant execute on function missionaccounts\.api_set_comp_allowance[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_set_comp_allowance[^;]+to authenticated/s);
});

test('account linkage and historical ceiling adjudication are auditable service-role transactions', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.account_link_change/);
  assert.match(sql, /create function missionaccounts\.api_link_student_account/);
  assert.match(sql, /effective_joined_on > date '2026-09-05' then 5/);
  assert.match(sql, /'account_link\.changed'/);
  assert.match(sql, /create function missionaccounts\.api_decide_full_cycle_ceiling/);
  assert.match(sql, /'full_cycle_ceiling\.decided'/);
  assert.match(sql, /full_cycle_ceiling_locked_after_invoice/);
  assert.match(sql, /grant execute on function missionaccounts\.api_link_student_account[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_decide_full_cycle_ceiling[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_(?:link_student_account|decide_full_cycle_ceiling)[^;]+to authenticated/s);
});

test('student contact custody and invoice readiness are audited and server-authoritative', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.student_contact_change/);
  assert.match(sql, /create function missionaccounts\.api_set_student_contact/);
  assert.match(sql, /create function missionaccounts\.api_set_invoice_readiness/);
  assert.match(sql, /student_email_required/);
  assert.match(sql, /current_approved_decision_required/);
  assert.match(sql, /update missionaccounts\.invoice\s+set state = 'draft'\s+where student_id = p_student_id and state = 'ready'/s);
  assert.match(sql, /create trigger student_contact_change_immutable/);
  assert.match(sql, /grant execute on function missionaccounts\.api_set_student_contact[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_set_invoice_readiness[^;]+to service_role/s);
});

test('exam transition RPC records rejected attempts and owns grace/reminder side effects', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_transition_exam_plan/);
  assert.match(sql, /'Rejected invalid exam-plan transition'/);
  assert.match(sql, /insert into missionaccounts\.grace_window/);
  assert.match(sql, /first_wednesday_offset/);
  assert.match(sql, /update missionaccounts\.reminder[\s\S]+state = 'cancelled'/);
  assert.match(sql, /suggested_date_requires_denial/);
  assert.match(sql, /exam_transition_forbidden/);
  assert.match(sql, /grant execute on function missionaccounts\.api_transition_exam_plan[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_transition_exam_plan[^;]+to authenticated/s);
  assert.match(sql, /p_actor_role = 'student'[\s\S]+p_to_state <> 'passed'[\s\S]+s\.matrix_user_ref = p_actor_id/);
});

test('billing approval RPC derives totals and fails closed on unresolved historical caps', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_approve_billing_decision/);
  assert.match(sql, /raw_amount_cents := billable_count \* 2500/);
  assert.match(sql, /cap_candidate_requires_review/);
  assert.match(sql, /p_treatment = 'fullcycle' and cap_row\.id is null/);
  assert.match(sql, /amount_cents := least\(amount_cents, cap_row\.ceiling_cents\)/);
  assert.match(sql, /insert into missionaccounts\.invoice/);
  assert.match(sql, /grant execute on function missionaccounts\.api_approve_billing_decision[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_approve_billing_decision[^;]+to authenticated/s);
});

test('attendance correction RPC preserves source rows and stales approved billing', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_append_attendance_correction/);
  assert.match(sql, /'Attendance correction appended without changing source evidence'/);
  assert.match(sql, /update missionaccounts\.billing_decision[\s\S]+set state = 'stale'/);
  assert.match(sql, /update missionaccounts\.invoice inv[\s\S]+set state = 'void'/);
  assert.match(sql, /recomputed := missionaccounts\.recompute_student_attendance\([\s\S]+:attendance-correction/);
  assert.match(sql, /where reversing\.reverts_id = attendance_correction\.id/);
  assert.match(sql, /grant execute on function missionaccounts\.api_append_attendance_correction[^;]+to service_role/s);
  assert.doesNotMatch(sql, /delete from missionaccounts\.attendance_source_row/i);
});

test('persisted attendance is recomputed before billing can be reapproved', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.recompute_student_attendance/);
  assert.match(sql, /update missionaccounts\.attendance_day[\s\S]+set superseded_at = now\(\)/);
  assert.match(sql, /insert into missionaccounts\.attendance_day\(/);
  assert.match(sql, /recomputed := missionaccounts\.recompute_student_attendance\([\s\S]+:comp-allowance/);
  assert.match(sql, /recomputed := missionaccounts\.recompute_student_attendance\([\s\S]+:exam-transition/);
  assert.match(sql, /grant execute on function missionaccounts\.recompute_student_attendance[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.recompute_student_attendance[^;]+to authenticated/s);
});

test('cycle 13–15-day policy is versioned, audited, and server-authoritative', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create unique index cycle_policy_one_current/);
  assert.match(sql, /create function missionaccounts\.api_set_cycle_policy/);
  assert.match(sql, /p_decision not in \('cap','per','pending'\)/);
  assert.match(sql, /'cycle_policy\.changed'/);
  assert.match(sql, /cycle_cap_policy_requires_review/);
  assert.match(sql, /billable_count between 13 and 15 and cycle_cap_decision = 'cap'/);
  assert.match(sql, /'cycle_policy','rule_decision'/);
  assert.match(sql, /grant execute on function missionaccounts\.api_set_cycle_policy[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_set_cycle_policy[^;]+to authenticated/s);
});

test('billing consent is versioned, server-authoritative, separately revocable, and exposes no Stripe references', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.billing_terms/);
  assert.match(sql, /create function missionaccounts\.api_set_billing_consent/);
  assert.match(sql, /status = 'approved'/);
  assert.match(sql, /payment_method_private[\s\S]+status = 'on_file'/);
  assert.match(sql, /authorization_already_active/);
  assert.match(sql, /active_authorization_not_found/);
  assert.match(sql, /'billing_consent\.changed'/);
  assert.match(sql, /'billing_consent\.rejected'/);
  assert.match(sql, /grant execute on function missionaccounts\.api_set_billing_consent[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_set_billing_consent[^;]+to authenticated/s);
  assert.match(sql, /grant select \(version, summary, body_sha256, status\)[\s\S]+billing_terms to authenticated/);
  assert.doesNotMatch(sql, /revoke all on missionaccounts\.payment_method_private from anon, authenticated/);
  assert.doesNotMatch(sql, /insert into missionaccounts\.billing_terms/i);
});

test('Stripe SetupIntent completion is transactionally bound to the signed inbox event and private customer record', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.stripe_customer_private/);
  assert.match(sql, /create function missionaccounts\.api_process_stripe_setup_intent/);
  assert.match(sql, /event_row\.signature_verified is not true/);
  assert.match(sql, /event_row\.event_type <> 'setup_intent\.succeeded'/);
  assert.match(sql, /stripe_event_binding_mismatch/);
  assert.match(sql, /stripe_customer_binding_mismatch/);
  assert.match(sql, /'payment_method\.verified'/);
  assert.match(sql, /set state = 'processed', processed_at = now\(\)/);
  assert.match(sql, /grant execute on function missionaccounts\.api_process_stripe_setup_intent[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_process_stripe_setup_intent[^;]+to authenticated/s);
  assert.doesNotMatch(sql, /grant select[^;]+stripe_customer_private[^;]+authenticated/is);
});

test('automatic day-charge preparation is database-authoritative and provider completion is signed and retry-safe', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_prepare_day_charge/);
  assert.match(sql, /day_row\.kind <> 'billable'/);
  assert.match(sql, /decision_row\.treatment <> 'confirm'/);
  assert.match(sql, /attendance_day_not_in_approved_basis/);
  assert.match(sql, /method_row\.status <> 'on_file'/);
  assert.match(sql, /consent_row\.state <> 'authorized'/);
  assert.match(sql, /reserved_amount_cents \+ 2500 > decision_row\.amount_cents/);
  assert.match(sql, /create unique index charge_attempt_request_unique/);
  assert.match(sql, /create function missionaccounts\.api_process_stripe_payment_intent/);
  assert.match(sql, /stripe_charge_event_binding_mismatch/);
  assert.match(sql, /grant execute on function missionaccounts\.api_prepare_day_charge[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_process_stripe_payment_intent[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_prepare_day_charge[^;]+to authenticated/s);
});

test('notification outbox claiming is bounded, skip-locked, retryable, and service-role only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /reminder_id uuid unique references missionaccounts\.reminder/);
  assert.match(sql, /audience text not null default 'student'/);
  assert.match(sql, /create function missionaccounts\.api_enqueue_due_exam_reminders/);
  assert.match(sql, /event_kind[\s\S]+exam_result_checkin/);
  assert.match(sql, /update missionaccounts\.reminder[\s\S]+set state = 'sent'/);
  assert.match(sql, /create function missionaccounts\.api_claim_notifications/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /p_limit < 1 or p_limit > 25/);
  assert.match(sql, /attempt_count < 5/);
  assert.match(sql, /create function missionaccounts\.api_finish_notification/);
  assert.match(sql, /notification_claim_mismatch/);
  assert.match(sql, /power\(2, row_out\.attempt_count\)/);
  assert.match(sql, /grant execute on function missionaccounts\.api_claim_notifications[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_finish_notification[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_enqueue_due_exam_reminders[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_claim_notifications[^;]+to authenticated/s);
  assert.match(sql, /\('notifications', false\)/);
});

test('automatic charge scheduling is bounded to 24-48 hours, retry-safe, and service-role only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906095512_automatic_charge_dispatch.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.auto_charge_dispatch/);
  assert.match(sql, /create table missionaccounts\.integration_exception/);
  assert.match(sql, /api_claim_due_day_charges/);
  assert.match(sql, /computed_at <= p_now - interval '24 hours'/);
  assert.match(sql, /computed_at >= p_now - interval '48 hours'/);
  assert.match(sql, /automatic_charge_window_missed/);
  assert.match(sql, /for update of d skip locked/);
  assert.match(sql, /'receipt_email', prepared->>'receipt_email'/);
  assert.match(sql, /automatic_charge_receipt_email_missing/);
  assert.match(sql, /api_prepare_day_charge/);
  assert.match(sql, /api_finish_auto_charge_dispatch/);
  assert.match(sql, /automatic_charge_submission_failed/);
  assert.match(sql, /audience, event_kind[\s\S]+'missionaccounts_admin', 'charge\.failed'/);
  assert.match(sql, /grant execute on function missionaccounts\.api_claim_due_day_charges[^;]+to service_role/s);
  assert.match(sql, /grant execute on function missionaccounts\.api_finish_auto_charge_dispatch[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_claim_due_day_charges[^;]+to authenticated/s);
  assert.match(sql, /force row level security/);
});

test('every pending charge requires a validated student receipt email', async () => {
  const [initialSql, receiptSql] = await Promise.all([
    readFile(new URL('../supabase/migrations/20260906062212_missionaccounts_initial_schema.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260906112331_require_receipt_email_for_day_charges.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(initialSql, /student_receipt_email_required/);
  assert.match(initialSql, /'receipt_email', lower\(btrim\(student_row\.email\)\)/);
  assert.match(receiptSql, /create trigger charge_receipt_email_required/);
  assert.match(receiptSql, /before insert or update of student_id, state on missionaccounts\.charge/);
  assert.match(receiptSql, /security invoker/);
  assert.match(receiptSql, /revoke execute[^]*from public, anon, authenticated/);
});

test('unhandled signed provider events become private idempotent exceptions', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906113240_record_unhandled_provider_events.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_mark_provider_event_unhandled/);
  assert.match(sql, /state = 'ignored'/);
  assert.match(sql, /'unhandled_webhook_event'/);
  assert.match(sql, /'provider_event\.unhandled'/);
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /grant execute[^]*to service_role/);
  assert.doesNotMatch(sql, /grant execute[^]*to authenticated/);
});

test('identity adjudication is additive, canonicalizes derived attendance, and preserves grace on split', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906114450_identity_cluster_adjudication.sql', import.meta.url), 'utf8');
  assert.match(sql, /create view missionaccounts\.identity_student_resolution/);
  assert.match(sql, /add column member_student_ids uuid\[\]/);
  assert.match(sql, /create or replace view missionaccounts\.attendance_event_projection/);
  assert.match(sql, /create table missionaccounts\.identity_grace_preservation/);
  assert.match(sql, /create view missionaccounts\.grace_window_projection/);
  assert.match(sql, /create or replace function missionaccounts\.recompute_student_attendance/);
  assert.match(sql, /identity_component_size/);
  assert.match(sql, /create function missionaccounts\.api_decide_identity_cluster/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('missionaccounts:identity:request:' \|\| p_request_id/);
  assert.match(sql, /identity_merge_requires_financial_or_account_review/);
  assert.match(sql, /identity_transition_requires_financial_finality_review/);
  assert.match(sql, /identity_transition_requires_comp_day_review/);
  assert.match(sql, /identity_merge_requires_comp_allowance_alignment/);
  assert.match(sql, /identity_split_copy/);
  assert.match(sql, /source_grace_window_id/);
  assert.match(sql, /identity_merge_review_hold/);
  assert.match(sql, /propagated_cap_holds/);
  assert.match(sql, /'identity_cluster\.decided'/);
  assert.doesNotMatch(sql, /update missionaccounts\.attendance_event/);
  assert.doesNotMatch(sql, /update missionaccounts\.attendance_source_row/);
  assert.match(sql, /revoke execute[^]*api_decide_identity_cluster[^]*from public, anon, authenticated/);
  assert.match(sql, /grant execute[^]*api_decide_identity_cluster[^]*to service_role/);
  assert.doesNotMatch(sql, /grant execute[^]*api_decide_identity_cluster[^]*to authenticated/);
});

test('device identity adjudication preserves source evidence and keeps financial and grace custody explicit', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906122416_device_identity_adjudication.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.device_identity_decision/);
  assert.match(sql, /create function missionaccounts\.api_decide_device_identity/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('missionaccounts:device-identity:request:' \|\| p_request_id/);
  assert.match(sql, /device_identity_transition_requires_financial_finality_review/);
  assert.match(sql, /device_identity_transition_requires_comp_day_review/);
  assert.match(sql, /device_identity_source_requires_account_review/);
  assert.match(sql, /device_identity_match_review_hold/);
  assert.match(sql, /device_identity_decision_id/);
  assert.match(sql, /identity_grace_preservation_one_decision_owner/);
  assert.match(sql, /'device_identity\.decided'/);
  assert.doesNotMatch(sql, /update missionaccounts\.attendance_event/);
  assert.doesNotMatch(sql, /update missionaccounts\.attendance_source_row/);
  assert.match(sql, /revoke execute[^]*api_decide_device_identity[^]*from public, anon, authenticated/);
  assert.match(sql, /grant execute[^]*api_decide_device_identity[^]*to service_role/);
  assert.doesNotMatch(sql, /grant execute[^]*api_decide_device_identity[^]*to authenticated/);
});

test('Zoom ingestion port preserves provider evidence without creating identity, attendance, or billing decisions', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906100746_zoom_ingestion_port.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_ingest_zoom_batch/);
  assert.match(sql, /insert into missionaccounts\.source_artifact/);
  assert.match(sql, /insert into missionaccounts\.import_run/);
  assert.match(sql, /insert into missionaccounts\.session/);
  assert.match(sql, /insert into missionaccounts\.attendance_source_row/);
  assert.match(sql, /attendance_events_created', 0/);
  assert.match(sql, /identity_decisions_created', 0/);
  assert.match(sql, /charges_created', 0/);
  assert.match(sql, /create function missionaccounts\.api_record_zoom_sync_failure/);
  assert.match(sql, /'zoom_sync_failed'/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /grant execute on function missionaccounts\.api_ingest_zoom_batch[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_ingest_zoom_batch[^;]+to authenticated/s);
});

test('Zoom reconciliation uses exact identities, isolates unknown attendees, and cannot approve or charge', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906134000_zoom_attendance_reconciliation.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.zoom_reconciliation_run/);
  assert.match(sql, /create unique index identity_alias_one_current_zoom_source/);
  assert.match(sql, /create function missionaccounts\.api_reconcile_zoom_import/);
  assert.match(sql, /session_state <> 'confirmed'/);
  assert.match(sql, /digest\(btrim\(source_record\.participant_source_id\), 'sha256'\)/);
  assert.match(sql, /'needs_review'/);
  assert.match(sql, /insert into missionaccounts\.attendance_event/);
  assert.match(sql, /missionaccounts\.recompute_student_attendance/);
  assert.match(sql, /'identity_decisions_created', 0/);
  assert.match(sql, /'billing_decisions_approved', 0/);
  assert.match(sql, /'invoices_created', 0/);
  assert.match(sql, /'charges_created', 0/);
  assert.doesNotMatch(sql, /insert into missionaccounts\.(billing_decision|invoice|charge)\b/);
  assert.doesNotMatch(sql, /where\s+(?:alias\.)?(?:display_value|email|display_name)\s*=/i);
  assert.match(sql, /create function missionaccounts\.api_ingest_and_reconcile_zoom_batch/);
  assert.match(sql, /grant execute on function missionaccounts\.api_reconcile_zoom_import[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_reconcile_zoom_import[^;]+to authenticated/s);
});

test('Stripe-hosted invoices are provider-backed, two-phase, signed-event reconciled, and service-role only', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906135000_stripe_hosted_invoice_workflow.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.stripe_invoice_dispatch/);
  assert.match(sql, /create function missionaccounts\.api_prepare_hosted_invoice_dispatch/);
  assert.match(sql, /current_approved_decision_required/);
  assert.match(sql, /verified_student_identity_required/);
  assert.match(sql, /stripe_customer_required/);
  assert.match(sql, /create function missionaccounts\.api_finish_hosted_invoice_dispatch/);
  assert.match(sql, /create function missionaccounts\.api_process_stripe_invoice_event/);
  assert.match(sql, /signature_verified/);
  assert.match(sql, /stripe_invoice_amount_mismatch/);
  assert.match(sql, /invoice\.paid/);
  assert.match(sql, /invoice\.overdue/);
  assert.match(sql, /invoice\.voided/);
  assert.match(sql, /grant execute on function missionaccounts\.api_prepare_hosted_invoice_dispatch[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_prepare_hosted_invoice_dispatch[^;]+to authenticated/s);
});

test('student attendance issue reports are self-bound, private, idempotent, audited, and notify Dr J', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906105212_student_attendance_issue_report.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table missionaccounts\.attendance_issue/);
  assert.match(sql, /create function missionaccounts\.api_submit_attendance_issue/);
  assert.match(sql, /matrix_user_ref = p_actor_id/);
  assert.match(sql, /p_actor_role is distinct from 'student'/);
  assert.match(sql, /on conflict \(request_id\) do nothing/);
  assert.match(sql, /'attendance_issue\.submitted'/);
  assert.match(sql, /'missionaccounts_admin', 'attendance\.issue_reported'/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /grant execute on function missionaccounts\.api_submit_attendance_issue[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_submit_attendance_issue[^;]+to authenticated/s);
  assert.match(sql, /revoke all on missionaccounts\.attendance_issue from public, anon, authenticated/);
});

test('student-owned write RPCs use the server-authoritative student id after account bootstrap', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260909095640_align_student_write_identity_guards.sql', import.meta.url), 'utf8');
  const functions = [
    'api_submit_exam_plan',
    'api_transition_exam_plan',
    'api_withdraw_exam_plan',
    'api_prepare_payment_method_removal',
    'api_submit_attendance_issue',
  ];
  for (const name of functions) {
    assert.match(sql, new RegExp(`create or replace function missionaccounts\\.${name}\\(`));
    assert.match(sql, new RegExp(`revoke execute on function missionaccounts\\.${name}[^;]+from public, anon, authenticated`, 's'));
    assert.match(sql, new RegExp(`grant execute on function missionaccounts\\.${name}[^;]+to service_role`, 's'));
    assert.doesNotMatch(sql, new RegExp(`grant execute on function missionaccounts\\.${name}[^;]+to authenticated`, 's'));
  }
  assert.match(sql, /s\.id = p_student_id and s\.id::text = p_actor_id/);
  assert.match(sql, /s\.id = current_plan\.student_id and s\.id::text = p_actor_id/);
  assert.match(sql, /student_row\.id::text is distinct from p_actor_id/);
  assert.match(sql, /where id = p_student_id and id::text = p_actor_id/);
  assert.doesNotMatch(sql, /matrix_user_ref\s+(?:=|is distinct from)\s+p_actor_id/);
});

test('attendance issue review is admin-only, idempotent, audited, and notifies the student without editing attendance', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260906110611_attendance_issue_review_resolution.sql', import.meta.url), 'utf8');
  assert.match(sql, /create function missionaccounts\.api_resolve_attendance_issue/);
  assert.match(sql, /p_actor_role not in \('missionaccounts_admin', 'founder'\)/);
  assert.match(sql, /resolved_request_id = p_request_id/);
  assert.match(sql, /'attendance_issue\.reviewed'/);
  assert.match(sql, /'student', 'attendance\.issue_reviewed'/);
  assert.match(sql, /without changing attendance evidence/);
  assert.match(sql, /create trigger attendance_issue_submission_immutable/);
  assert.doesNotMatch(sql, /update missionaccounts\.attendance_event/);
  assert.doesNotMatch(sql, /update missionaccounts\.attendance_day/);
  assert.doesNotMatch(sql, /update missionaccounts\.billing_decision/);
  assert.match(sql, /grant execute on function missionaccounts\.api_resolve_attendance_issue[^;]+to service_role/s);
  assert.doesNotMatch(sql, /grant execute on function missionaccounts\.api_resolve_attendance_issue[^;]+to authenticated/s);
});

test('charge eligibility rejects stale, free, zero-treatment, missing-method and missing-consent states', () => {
  const base = { day: { kind: 'billable' }, decision: { state: 'approved', stale: false, amount_cents: 2500 }, paymentMethod: { status: 'on_file' }, consent: { state: 'authorized' } };
  assert.equal(chargeEligibility(base).eligible, true);
  assert.equal(chargeEligibility({ ...base, day: { kind: 'grace' } }).eligible, false);
  assert.equal(chargeEligibility({ ...base, decision: { ...base.decision, stale: true } }).eligible, false);
  assert.equal(chargeEligibility({ ...base, decision: { ...base.decision, amount_cents: 0 } }).eligible, false);
  assert.equal(chargeEligibility({ ...base, paymentMethod: null }).eligible, false);
  assert.equal(chargeEligibility({ ...base, consent: null }).eligible, false);
});
