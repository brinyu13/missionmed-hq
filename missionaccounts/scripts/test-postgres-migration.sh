#!/usr/bin/env bash
set -euo pipefail

for required in initdb pg_ctl psql; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "MissionAccounts PostgreSQL verification requires: $required" >&2
    exit 1
  fi
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)
pg_tmp=$(mktemp -d /tmp/mx5301p-pg.XXXXXX)

cleanup_pg() {
  pg_ctl -D "$pg_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  if [[ "$pg_tmp" == /tmp/mx5301p-pg.* ]]; then
    rm -r "$pg_tmp"
  fi
}
trap cleanup_pg EXIT

initdb -D "$pg_tmp/data" --no-locale --encoding=UTF8 --auth=trust >/dev/null
pg_ctl -D "$pg_tmp/data" -o "-F -p 55439 -k $pg_tmp -c listen_addresses=''" -w start >/dev/null

psql -h "$pg_tmp" -p 55439 -d postgres -v ON_ERROR_STOP=1 \
  -c "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.jwt() returns jsonb language sql stable as 'select jsonb_build_object()';" \
  >/dev/null

for migration in "$app_dir"/supabase/migrations/*.sql; do
  psql -h "$pg_tmp" -p 55439 -d postgres -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

identity_security=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
select
  ((select reloptions from pg_class where oid='missionaccounts.identity_student_resolution'::regclass) @> array['security_invoker=true']) || '|' ||
  ((select reloptions from pg_class where oid='missionaccounts.grace_window_projection'::regclass) @> array['security_invoker=true']) || '|' ||
  (not has_table_privilege('authenticated','missionaccounts.identity_grace_preservation','select')) || '|' ||
  has_table_privilege('service_role','missionaccounts.identity_grace_preservation','select') || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_decide_identity_cluster(text,text,uuid,date,text,text,text,text)','execute')) || '|' ||
  has_function_privilege('service_role','missionaccounts.api_decide_identity_cluster(text,text,uuid,date,text,text,text,text)','execute');
SQL
)
if [[ "$identity_security" != 'true|true|true|true|true|true' ]]; then
  echo "MissionAccounts identity privilege verification failed: $identity_security" >&2
  exit 1
fi

student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:4242','Integration Test') returning id")

results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan('$student_id','s2','2026-10-14','2026-09-01','wp:4242','student','pg-integration-0001')->>'duplicate';
select missionaccounts.api_submit_exam_plan('$student_id','s2','2026-10-14','2026-09-01','wp:4242','student','pg-integration-0001')->>'duplicate';
select missionaccounts.api_transition_exam_plan((select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),'approved',null,null,'2026-09-01','wp:admin','missionaccounts_admin','pg-integration-0003')->>'accepted';
select missionaccounts.api_transition_exam_plan((select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),'approved',null,null,'2026-09-01','wp:admin','missionaccounts_admin','pg-integration-0003')->>'duplicate';
select missionaccounts.api_transition_exam_plan((select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),'followup','not_passed','Verified result','2026-10-20','wp:admin','missionaccounts_admin','pg-integration-0004')->>'accepted';
select missionaccounts.api_transition_exam_plan((select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),'denied',null,'Invalid from follow-up','2026-10-20','wp:admin','missionaccounts_admin','pg-integration-0005')->>'accepted';
select missionaccounts.api_set_comp_allowance('$student_id',3,'2026-09-08','Verified exception',false,'wp:admin','missionaccounts_admin','pg-integration-0002')->>'duplicate';
select missionaccounts.api_set_comp_allowance('$student_id',3,'2026-09-08','Verified exception',false,'wp:admin','missionaccounts_admin','pg-integration-0002')->>'duplicate';
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.exam_transition) || '|' ||
  (select count(*) from missionaccounts.audit_event) || '|' ||
  (select count(*) from missionaccounts.notification_outbox) || '|' ||
  (select count(*) from missionaccounts.comp_allowance_change) || '|' ||
  (select comp_days_allowance from missionaccounts.student where id = '$student_id') || '|' ||
  (select state from missionaccounts.reminder limit 1) || '|' ||
  (select to_on from missionaccounts.grace_window limit 1)
from missionaccounts.exam_plan;
SQL
)

expected=$'false\ntrue\ntrue\ntrue\ntrue\nfalse\nfalse\ntrue\n1|4|5|3|1|3|cancelled|2026-10-20'
if [[ "$results" != "$expected" ]]; then
  echo "MissionAccounts PostgreSQL verification returned unexpected controls:" >&2
  echo "$results" >&2
  exit 1
fi

student_passed_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),
  'passed','passed','Student reported passing','2026-10-21','wp:4242','student','pg-student-passed-0001'
)->>'accepted';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),
  'passed','passed','Student reported passing','2026-10-21','wp:4242','student','pg-student-passed-0001'
)->>'duplicate';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null),
  'passed','passed','Attempt by another student','2026-10-21','wp:other','student','pg-student-passed-0002'
)->>'accepted';
reset role;
select state || '|' || passed_on from missionaccounts.exam_plan where student_id='$student_id' and superseded_by_id is null;
SQL
)

student_passed_expected=$'true\ntrue\nfalse\npassed|2026-10-21'
if [[ "$student_passed_results" != "$student_passed_expected" ]]; then
  echo "MissionAccounts student Passed verification returned unexpected controls:" >&2
  echo "$student_passed_results" >&2
  exit 1
fi

replacement_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:replacement','Replacement Test') returning id")

exam_replacement_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan(
  '$replacement_student_id','s1','2026-10-14','2026-09-01',
  'wp:replacement','student','pg-replacement-submit-0001'
)->>'duplicate';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$replacement_student_id' and superseded_by_id is null),
  'approved',null,null,'2026-09-01','wp:admin','missionaccounts_admin','pg-replacement-approve-0001'
)->>'accepted';
select missionaccounts.api_submit_exam_plan(
  '$replacement_student_id','s1','2026-11-11','2026-09-20',
  'wp:replacement','student','pg-replacement-submit-0002'
)->>'closed_grace_windows';
select missionaccounts.api_submit_exam_plan(
  '$replacement_student_id','s1','2026-11-11','2026-09-20',
  'wp:replacement','student','pg-replacement-submit-0002'
)->>'duplicate';
reset role;
select
  (select count(*) from missionaccounts.exam_plan where student_id='$replacement_student_id' and superseded_by_id is null) || '|' ||
  (select closed_reason from missionaccounts.grace_window where student_id='$replacement_student_id') || '|' ||
  (select to_on from missionaccounts.grace_window where student_id='$replacement_student_id') || '|' ||
  (select state from missionaccounts.reminder where student_id='$replacement_student_id');
SQL
)

exam_replacement_expected=$'false\ntrue\n1\ntrue\n1|plan_replaced|2026-10-14|cancelled'
if [[ "$exam_replacement_results" != "$exam_replacement_expected" ]]; then
  echo "MissionAccounts exam-plan replacement verification returned unexpected controls:" >&2
  echo "$exam_replacement_results" >&2
  exit 1
fi

reminder_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:reminder','Reminder Test') returning id")

reminder_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan(
  '$reminder_student_id','s1','2026-09-09','2026-09-01',
  'wp:reminder','student','pg-reminder-submit-0001'
)->>'duplicate';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$reminder_student_id' and superseded_by_id is null),
  'approved',null,null,'2026-09-01','wp:admin','missionaccounts_admin','pg-reminder-approve-0001'
)->>'accepted';
reset role;
update missionaccounts.notification_outbox set state='sent', sent_at='2026-09-29T15:00:00Z' where reminder_id is null;
set role service_role;
select missionaccounts.api_enqueue_due_exam_reminders('2026-09-29','2026-09-29T16:00:00Z',10)->>'queued';
select missionaccounts.api_enqueue_due_exam_reminders('2026-09-30','2026-09-30T16:00:00Z',10)->>'queued';
select missionaccounts.api_enqueue_due_exam_reminders('2026-09-30','2026-09-30T16:00:01Z',10)->>'queued';
select count(*) from missionaccounts.api_claim_notifications('pg-reminder-worker',10,'2026-09-30T16:00:02Z');
select state from missionaccounts.api_finish_notification(
  (select id from missionaccounts.notification_outbox where reminder_id is not null and state='sending'),
  'pg-reminder-worker',true,'matrix-reminder-1',null,'2026-09-30T16:00:03Z'
);
reset role;
select
  (select state from missionaccounts.reminder where student_id='$reminder_student_id') || '|' ||
  (select due_on from missionaccounts.reminder where student_id='$reminder_student_id') || '|' ||
  (select audience from missionaccounts.notification_outbox where reminder_id is not null and student_id='$reminder_student_id') || '|' ||
  (select event_kind from missionaccounts.notification_outbox where reminder_id is not null and student_id='$reminder_student_id') || '|' ||
  (select count(*) from missionaccounts.notification_outbox where reminder_id is not null and student_id='$reminder_student_id');
SQL
)

reminder_expected=$'false\ntrue\n0\n1\n0\n1\nsent\nsent|2026-09-30|student|exam_result_checkin|1'
if [[ "$reminder_results" != "$reminder_expected" ]]; then
  echo "MissionAccounts due-reminder verification returned unexpected controls:" >&2
  echo "$reminder_results" >&2
  exit 1
fi

cancelled_reminder_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:cancelled-reminder','Cancelled Reminder Test') returning id")

cancelled_reminder_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan(
  '$cancelled_reminder_student_id','s1','2026-09-09','2026-09-01',
  'wp:cancelled-reminder','student','pg-cancelled-reminder-submit-0001'
)->>'duplicate';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$cancelled_reminder_student_id' and superseded_by_id is null),
  'approved',null,null,'2026-09-01','wp:admin','missionaccounts_admin','pg-cancelled-reminder-approve-0001'
)->>'accepted';
select missionaccounts.api_enqueue_due_exam_reminders('2026-09-30','2026-09-30T17:00:00Z',10)->>'queued';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$cancelled_reminder_student_id' and superseded_by_id is null),
  'passed','passed','Student reported passing','2026-09-30',
  'wp:cancelled-reminder','student','pg-cancelled-reminder-result-0001'
)->>'accepted';
reset role;
select
  (select state from missionaccounts.reminder where student_id='$cancelled_reminder_student_id') || '|' ||
  (select state from missionaccounts.notification_outbox where reminder_id = (
    select id from missionaccounts.reminder where student_id='$cancelled_reminder_student_id'
  ));
SQL
)

cancelled_reminder_expected=$'false\ntrue\n1\ntrue\ncancelled|cancelled'
if [[ "$cancelled_reminder_results" != "$cancelled_reminder_expected" ]]; then
  echo "MissionAccounts cancelled-reminder verification returned unexpected controls:" >&2
  echo "$cancelled_reminder_results" >&2
  exit 1
fi

admin_exam_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:admin-exam','Admin Exam Entry Test') returning id")

admin_exam_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan(
  '$admin_exam_student_id','s3','2026-11-18','2026-09-06',
  'wp:admin','missionaccounts_admin','pg-admin-exam-submit-0001'
)->>'duplicate';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$admin_exam_student_id' and superseded_by_id is null),
  'denied',null,'Please choose the later sitting','2026-09-06',
  'wp:admin','missionaccounts_admin','pg-admin-exam-deny-0001','2026-12-02'
)->>'accepted';
reset role;
select
  (select suggested_on from missionaccounts.exam_plan where student_id='$admin_exam_student_id') || '|' ||
  (select actor_role from missionaccounts.exam_transition where request_id='pg-admin-exam-deny-0001') || '|' ||
  (select audience from missionaccounts.notification_outbox where idempotency_key='pg-admin-exam-submit-0001:exam-plan-submitted');
SQL
)

admin_exam_expected=$'false\ntrue\n2026-12-02|missionaccounts_admin|student'
if [[ "$admin_exam_results" != "$admin_exam_expected" ]]; then
  echo "MissionAccounts administrative exam-entry verification returned unexpected controls:" >&2
  echo "$admin_exam_results" >&2
  exit 1
fi

withdraw_exam_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:withdraw-exam','Withdraw Exam Test') returning id")

withdraw_exam_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan(
  '$withdraw_exam_student_id','s1','2026-09-09','2026-09-01',
  'wp:withdraw-exam','student','pg-withdraw-exam-submit-0001'
)->>'duplicate';
select missionaccounts.api_transition_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$withdraw_exam_student_id' and superseded_by_id is null),
  'approved',null,null,'2026-09-01',
  'wp:admin','missionaccounts_admin','pg-withdraw-exam-approve-0001',null
)->>'accepted';
select missionaccounts.api_withdraw_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$withdraw_exam_student_id' and superseded_by_id is null),
  '2026-09-30','wp:withdraw-exam','student','Student withdrew exam plan','pg-withdraw-exam-0001'
)->>'accepted';
select missionaccounts.api_withdraw_exam_plan(
  (select id from missionaccounts.exam_plan where student_id='$withdraw_exam_student_id' and withdrawn_at is not null),
  '2026-09-30','wp:withdraw-exam','student','Student withdrew exam plan','pg-withdraw-exam-0001'
)->>'duplicate';
reset role;
select
  (select count(*) from missionaccounts.exam_plan where student_id='$withdraw_exam_student_id') || '|' ||
  (select count(*) from missionaccounts.exam_plan where student_id='$withdraw_exam_student_id' and withdrawn_at is null) || '|' ||
  (select to_on from missionaccounts.grace_window where student_id='$withdraw_exam_student_id') || '|' ||
  (select state from missionaccounts.reminder where student_id='$withdraw_exam_student_id') || '|' ||
  (select audience from missionaccounts.notification_outbox where idempotency_key='pg-withdraw-exam-0001:exam-plan-withdrawn');
SQL
)

withdraw_exam_expected=$'false\ntrue\ntrue\ntrue\n1|0|2026-09-30|cancelled|missionaccounts_admin'
if [[ "$withdraw_exam_results" != "$withdraw_exam_expected" ]]; then
  echo "MissionAccounts exam-withdrawal verification returned unexpected controls:" >&2
  echo "$withdraw_exam_results" >&2
  exit 1
fi

billing_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.engine_run(engine_version, source_digest, state)
values ('integration-v1', repeat('a', 64), 'succeeded');
insert into missionaccounts.attendance_day(
  engine_run_id, student_id, cycle_key, day, kind, engine_version, source_digest
)
select
  (select id from missionaccounts.engine_run order by started_at desc limit 1),
  '$student_id',
  '2026-cycle-1',
  date '2026-06-08' + day_offset,
  'billable',
  'integration-v1',
  repeat('a', 64)
from generate_series(0, 14) as day_offset;
insert into missionaccounts.full_cycle_ceiling(student_id, cycle_key, status, basis)
values ('$student_id', '2026-cycle-1', 'candidate', jsonb_build_object('source', 'integration'));
set role service_role;
select missionaccounts.api_set_cycle_policy(
  '2026-cycle-1','per','Exercise the individual historical cap gate',
  'wp:admin','missionaccounts_admin','pg-cycle-policy-billing-0001'
)->>'duplicate';
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0001')->>'accepted';
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0001')->>'duplicate';
reset role;
set role service_role;
select missionaccounts.api_decide_full_cycle_ceiling(
  '$student_id','2026-cycle-1','verified','Verified historical full-cycle enrollment',
  'wp:admin','missionaccounts_admin','pg-ceiling-decision-0001'
)->>'duplicate';
select missionaccounts.api_decide_full_cycle_ceiling(
  '$student_id','2026-cycle-1','verified','Verified historical full-cycle enrollment',
  'wp:admin','missionaccounts_admin','pg-ceiling-decision-0001'
)->>'duplicate';
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0002')->'decision'->>'amount_cents';
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0002')->>'duplicate';
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.invoice) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind like 'billing_decision.%') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'full_cycle_ceiling.decided') || '|' ||
  (select status from missionaccounts.full_cycle_ceiling where student_id='$student_id' and cycle_key='2026-cycle-1' and superseded_by_id is null)
from missionaccounts.billing_decision;
SQL
)

billing_expected=$'false\nfalse\ntrue\nfalse\ntrue\n30000\ntrue\n1|1|2|1|verified'
if [[ "$billing_results" != "$billing_expected" ]]; then
  echo "MissionAccounts billing authority verification returned unexpected controls:" >&2
  echo "$billing_results" >&2
  exit 1
fi

invoice_readiness_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_set_student_contact(
  '$student_id','Verified.Student@Example.org','555-0102','Confirmed with student',
  'wp:admin','missionaccounts_admin','pg-contact-0001'
)->>'duplicate';
select missionaccounts.api_set_student_contact(
  '$student_id','Verified.Student@Example.org','555-0102','Confirmed with student',
  'wp:admin','missionaccounts_admin','pg-contact-0001'
)->>'duplicate';
select missionaccounts.api_set_invoice_readiness(
  (select id from missionaccounts.invoice where student_id='$student_id' and state='draft'),
  true,'Amount and email confirmed','wp:admin','missionaccounts_admin','pg-invoice-ready-0001'
)->>'accepted';
select missionaccounts.api_set_invoice_readiness(
  (select id from missionaccounts.invoice where student_id='$student_id' and state='ready'),
  true,'Amount and email confirmed','wp:admin','missionaccounts_admin','pg-invoice-ready-0001'
)->>'duplicate';
select from_val->>'state' from missionaccounts.audit_event
where request_id='pg-invoice-ready-0001' and kind='invoice.readiness';
select missionaccounts.api_set_student_contact(
  '$student_id',null,'555-0102','Student withdrew this email address',
  'wp:admin','missionaccounts_admin','pg-contact-0002'
)->>'demoted_ready_invoices';
select missionaccounts.api_set_invoice_readiness(
  (select id from missionaccounts.invoice where student_id='$student_id' and state='draft'),
  true,'Try without email','wp:admin','missionaccounts_admin','pg-invoice-ready-0002'
)->>'reason';
reset role;
select
  (select state from missionaccounts.invoice where student_id='$student_id' order by created_at desc limit 1) || '|' ||
  (select count(*) from missionaccounts.student_contact_change where student_id='$student_id') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='student.contact_changed' and subject_student_id='$student_id') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='invoice.readiness' and subject_student_id='$student_id');
SQL
)

invoice_readiness_expected=$'false\ntrue\ntrue\ntrue\ndraft\n1\nstudent_email_required\ndraft|2|2|2'
if [[ "$invoice_readiness_results" != "$invoice_readiness_expected" ]]; then
  echo "MissionAccounts contact/invoice-readiness verification returned unexpected controls:" >&2
  echo "$invoice_readiness_results" >&2
  exit 1
fi

correction_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.source_artifact(source_kind, source_path, sha256, byte_count, observed_at)
values ('integration', '/private/integration-source', repeat('b', 64), 1, now());
insert into missionaccounts.session(
  cycle_key, source_artifact_id, provider, provider_meeting_id, provider_instance_id,
  starts_at, held_on, step, state
)
values (
  '2026-cycle-1',
  (select id from missionaccounts.source_artifact where sha256 = repeat('b', 64)),
  'manual', 'integration-meeting', 'integration-instance',
  '2026-06-23T16:00:00Z', '2026-06-23', 's1', 'confirmed'
);
set role service_role;
select missionaccounts.api_append_attendance_correction(
  '$student_id',
  (select id from missionaccounts.session where provider_instance_id = 'integration-instance'),
  null, 'add', null, jsonb_build_object('present', true), 'Verified source', null,
  'wp:admin', 'missionaccounts_admin', 'pg-correction-0001'
)->>'stale_decisions';
select missionaccounts.api_append_attendance_correction(
  '$student_id',
  (select id from missionaccounts.session where provider_instance_id = 'integration-instance'),
  null, 'add', null, jsonb_build_object('present', true), 'Verified source', null,
  'wp:admin', 'missionaccounts_admin', 'pg-correction-0001'
)->>'duplicate';
select missionaccounts.api_append_attendance_correction(
  '$student_id',
  (select id from missionaccounts.session where provider_instance_id = 'integration-instance'),
  (select id from missionaccounts.attendance_event where student_id = '$student_id' and session_id = (select id from missionaccounts.session where provider_instance_id = 'integration-instance')),
  'remove', jsonb_build_object('present', true), jsonb_build_object('present', false), 'Correction reversed', null,
  'wp:admin', 'missionaccounts_admin', 'pg-correction-0002'
)->>'accepted';
select count(*) from missionaccounts.attendance_day
where student_id = '$student_id' and superseded_at is null;
select missionaccounts.api_append_attendance_correction(
  '$student_id',
  (select id from missionaccounts.session where provider_instance_id = 'integration-instance'),
  (select id from missionaccounts.attendance_event where student_id = '$student_id' and session_id = (select id from missionaccounts.session where provider_instance_id = 'integration-instance')),
  'add', jsonb_build_object('present', false), jsonb_build_object('present', true), 'Correction restored',
  (select id from missionaccounts.attendance_correction where request_id = 'pg-correction-0002'),
  'wp:admin', 'missionaccounts_admin', 'pg-correction-0003'
)->>'accepted';
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.attendance_event) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'attendance_correction.appended') || '|' ||
  (select count(*) from missionaccounts.attendance_day where student_id = '$student_id' and superseded_at is null) || '|' ||
  (select exists(select 1 from missionaccounts.attendance_correction where reverts_id = (select id from missionaccounts.attendance_correction where request_id = 'pg-correction-0002'))::text) || '|' ||
  (select state from missionaccounts.billing_decision where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_by_id is null) || '|' ||
  (select state from missionaccounts.invoice where student_id = '$student_id' and cycle_key = '2026-cycle-1' order by created_at desc limit 1)
from missionaccounts.attendance_correction;
SQL
)

correction_expected=$'1\ntrue\ntrue\n0\ntrue\n3|1|3|1|true|stale|void'
if [[ "$correction_results" != "$correction_expected" ]]; then
  echo "MissionAccounts attendance-correction verification returned unexpected controls:" >&2
  echo "$correction_results" >&2
  exit 1
fi

payment_setup_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.stripe_customer_private(student_id, provider, provider_customer_ref)
values ('$student_id', 'stripe', 'cus_test_integration');
insert into missionaccounts.provider_event_inbox(
  provider, provider_event_id, provider_object_id, event_type, payload, signature_verified, state
) values (
  'stripe', 'evt_setup_integration', 'seti_test_integration', 'setup_intent.succeeded',
  jsonb_build_object(
    'id', 'evt_setup_integration',
    'type', 'setup_intent.succeeded',
    'data', jsonb_build_object('object', jsonb_build_object(
      'id', 'seti_test_integration',
      'customer', 'cus_test_integration',
      'payment_method', 'pm_test_integration',
      'metadata', jsonb_build_object('student_id', '$student_id')
    ))
  ),
  true, 'received'
);
set role service_role;
select missionaccounts.api_process_stripe_setup_intent(
  'evt_setup_integration','$student_id','cus_test_integration','pm_test_integration',
  'visa','4242',12,2030
)->>'duplicate';
select missionaccounts.api_process_stripe_setup_intent(
  'evt_setup_integration','$student_id','cus_test_integration','pm_test_integration',
  'visa','4242',12,2030
)->>'duplicate';
reset role;
select
  (select state from missionaccounts.provider_event_inbox where provider_event_id = 'evt_setup_integration') || '|' ||
  (select status from missionaccounts.payment_method_private where student_id = '$student_id') || '|' ||
  (select last4 from missionaccounts.payment_method_private where student_id = '$student_id') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'payment_method.verified') || '|' ||
  (select count(*) from missionaccounts.notification_outbox where event_kind = 'payment_method.added');
SQL
)

payment_setup_expected=$'false\ntrue\nprocessed|on_file|4242|1|1'
if [[ "$payment_setup_results" != "$payment_setup_expected" ]]; then
  echo "MissionAccounts Stripe payment-setup verification returned unexpected controls:" >&2
  echo "$payment_setup_results" >&2
  exit 1
fi

consent_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
delete from missionaccounts.payment_method_private where student_id = '$student_id';
set role service_role;
select missionaccounts.api_set_billing_consent(
  '$student_id','authorize','integration-v1','127.0.0.1','Student accepted test terms',
  'wp:4242','student','pg-consent-0001'
)->>'reason';
reset role;
insert into missionaccounts.billing_terms(version, summary, body_sha256, status, approved_by, approved_at)
values ('integration-v1', 'Disposable integration-test terms', repeat('c', 64), 'approved', 'wp:founder', now());
set role service_role;
select missionaccounts.api_set_billing_consent(
  '$student_id','authorize','integration-v1','127.0.0.1','Student accepted test terms',
  'wp:4242','student','pg-consent-0002'
)->>'reason';
reset role;
insert into missionaccounts.payment_method_private(
  student_id, provider, provider_customer_ref, provider_pm_ref, brand, last4, exp_month, exp_year, status, verified_at
) values (
  '$student_id','stripe','cus_test_integration','pm_test_integration','visa','4242',12,2030,'on_file',now()
);
set role service_role;
select missionaccounts.api_set_billing_consent(
  '$student_id','authorize','integration-v1','127.0.0.1','Student accepted test terms',
  'wp:4242','student','pg-consent-0003'
)->>'accepted';
select missionaccounts.api_set_billing_consent(
  '$student_id','authorize','integration-v1','127.0.0.1','Student accepted test terms',
  'wp:4242','student','pg-consent-0003'
)->>'duplicate';
select missionaccounts.api_set_billing_consent(
  '$student_id','authorize','integration-v1','127.0.0.1','Student accepted test terms again',
  'wp:4242','student','pg-consent-0004'
)->>'reason';
select missionaccounts.api_set_billing_consent(
  '$student_id','revoke',null,null,'Student revoked automatic billing',
  'wp:4242','student','pg-consent-0005'
)->>'accepted';
select missionaccounts.api_set_billing_consent(
  '$student_id','revoke',null,null,'Student revoked automatic billing',
  'wp:4242','student','pg-consent-0005'
)->>'duplicate';
select missionaccounts.api_set_billing_consent(
  '$student_id','revoke',null,null,'Student revoked automatic billing again',
  'wp:4242','student','pg-consent-0006'
)->>'reason';
reset role;
select count(*) || '|' ||
  (select state from missionaccounts.billing_consent where student_id = '$student_id' and superseded_by_id is null) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'billing_consent.changed') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'billing_consent.rejected') || '|' ||
  (select count(*) from missionaccounts.notification_outbox where event_kind like 'billing_consent.%')
from missionaccounts.billing_consent where student_id = '$student_id';
SQL
)

consent_expected=$'approved_billing_terms_required\npayment_method_required\ntrue\ntrue\nauthorization_already_active\ntrue\ntrue\nactive_authorization_not_found\n2|revoked|2|4|2'
if [[ "$consent_results" != "$consent_expected" ]]; then
  echo "MissionAccounts billing-consent verification returned unexpected controls:" >&2
  echo "$consent_results" >&2
  exit 1
fi

charge_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_set_comp_allowance(
  '$student_id',0,'2026-09-08','Retroactive integration correction',true,
  'wp:admin','missionaccounts_admin','pg-comp-zero-0001'
)->>'duplicate';
select kind from missionaccounts.attendance_day
where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null;
select missionaccounts.api_approve_billing_decision(
  '$student_id','2026-cycle-1','confirm',null,'Re-approved after verified correction',
  'wp:admin','missionaccounts_admin','pg-billing-0003'
)->>'accepted';
select missionaccounts.api_set_billing_consent(
  '$student_id','authorize','integration-v1','127.0.0.1','Student reauthorized test billing',
  'wp:4242','student','pg-consent-0007'
)->>'accepted';
select missionaccounts.api_prepare_day_charge(
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  'wp:admin','missionaccounts_admin','pg-charge-no-email-0001',false
)->>'reason';
select missionaccounts.api_set_student_contact(
  '$student_id','Verified.Student@Example.org','555-0102','Receipt delivery verified',
  'wp:admin','missionaccounts_admin','pg-contact-receipt-0001'
)->>'duplicate';
select missionaccounts.api_prepare_day_charge(
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  'wp:admin','missionaccounts_admin','pg-charge-0001',false
)->>'accepted';
select missionaccounts.api_prepare_day_charge(
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  'wp:admin','missionaccounts_admin','pg-charge-0001',false
)->>'receipt_email';
select missionaccounts.api_prepare_day_charge(
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  'wp:admin','missionaccounts_admin','pg-charge-0001',false
)->>'duplicate';
select missionaccounts.api_prepare_day_charge(
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  'wp:admin','missionaccounts_admin','pg-charge-0002',false
)->>'reason';
reset role;
insert into missionaccounts.provider_event_inbox(
  provider, provider_event_id, provider_object_id, event_type, payload, signature_verified, state
) values (
  'stripe', 'evt_charge_integration', 'pi_test_integration', 'payment_intent.succeeded',
  jsonb_build_object(
    'id', 'evt_charge_integration',
    'type', 'payment_intent.succeeded',
    'data', jsonb_build_object('object', jsonb_build_object(
      'id', 'pi_test_integration',
      'metadata', jsonb_build_object(
        'student_id', '$student_id',
        'attendance_day_id', (select id::text from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1)
      )
    ))
  ),
  true, 'received'
);
set role service_role;
select missionaccounts.api_process_stripe_payment_intent(
  'evt_charge_integration','payment_intent.succeeded','pi_test_integration','$student_id',
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  null,null
)->>'duplicate';
select missionaccounts.api_process_stripe_payment_intent(
  'evt_charge_integration','payment_intent.succeeded','pi_test_integration','$student_id',
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  null,null
)->>'duplicate';
select missionaccounts.api_prepare_day_charge(
  (select id from missionaccounts.attendance_day where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_at is null order by day limit 1),
  'wp:admin','missionaccounts_admin','pg-charge-0003',false
)->>'reason';
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.charge_attempt) || '|' ||
  (select state from missionaccounts.charge limit 1) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'charge.started') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'charge.succeeded') || '|' ||
  (select count(*) from missionaccounts.notification_outbox where event_kind = 'charge.succeeded')
from missionaccounts.charge;
SQL
)

charge_expected=$'false\nbillable\ntrue\ntrue\nstudent_receipt_email_required\nfalse\ntrue\nverified.student@example.org\ntrue\ncharge_already_pending\nfalse\ntrue\ncharge_already_succeeded\n1|1|succeeded|1|1|1'
if [[ "$charge_results" != "$charge_expected" ]]; then
  echo "MissionAccounts automatic day-charge verification returned unexpected controls:" >&2
  echo "$charge_results" >&2
  exit 1
fi

payment_removal_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_prepare_payment_method_removal(
  '$student_id','wp:4242','student','pg-payment-remove-0001'
)->>'accepted';
select status from missionaccounts.payment_method_private where student_id = '$student_id';
select state from missionaccounts.billing_consent where student_id = '$student_id' and superseded_by_id is null;
select missionaccounts.api_finish_payment_method_removal(
  '$student_id','pg-payment-remove-0001',false,'Disposable provider failure'
)->'payment_method'->>'status';
select missionaccounts.api_prepare_payment_method_removal(
  '$student_id','wp:4242','student','pg-payment-remove-0001'
)->>'duplicate';
select missionaccounts.api_finish_payment_method_removal(
  '$student_id','pg-payment-remove-0001',true,null
)->'payment_method'->>'status';
select missionaccounts.api_prepare_payment_method_removal(
  '$student_id','wp:4242','student','pg-payment-remove-0001'
)->>'duplicate';
reset role;
select
  (select status from missionaccounts.payment_method_private where student_id = '$student_id') || '|' ||
  (select state from missionaccounts.billing_consent where student_id = '$student_id' and superseded_by_id is null) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'payment_method.removal_prepared') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'payment_method.removal_failed') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'payment_method.removed') || '|' ||
  (select count(*) from missionaccounts.notification_outbox where event_kind = 'payment_method.removed');
SQL
)

payment_removal_expected=$'true\nremoval_pending\nrevoked\non_file\ntrue\nremoved\ntrue\nremoved|revoked|1|1|1|1'
if [[ "$payment_removal_results" != "$payment_removal_expected" ]]; then
  echo "MissionAccounts payment-method removal verification returned unexpected controls:" >&2
  echo "$payment_removal_results" >&2
  exit 1
fi

notification_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
update missionaccounts.notification_outbox set state = 'sent', sent_at = now();
insert into missionaccounts.notification_outbox(
  student_id, channel, event_kind, payload, state, idempotency_key, available_at
) values
  ('$student_id','matrix','integration.first','{}','pending','pg-notification-0001','2026-09-15T16:00:00Z'),
  ('$student_id','matrix','integration.second','{}','pending','pg-notification-0002','2026-09-15T16:00:01Z');
set role service_role;
select count(*) from missionaccounts.api_claim_notifications('pg-worker',1,'2026-09-15T16:01:00Z');
select state from missionaccounts.api_finish_notification(
  (select id from missionaccounts.notification_outbox where state = 'sending'),
  'pg-worker',true,'matrix-provider-1',null,'2026-09-15T16:01:01Z'
);
select count(*) from missionaccounts.api_claim_notifications('pg-worker',1,'2026-09-15T16:01:02Z');
select state from missionaccounts.api_finish_notification(
  (select id from missionaccounts.notification_outbox where state = 'sending'),
  'pg-worker',false,null,'temporary provider failure','2026-09-15T16:01:03Z'
);
select count(*) from missionaccounts.api_claim_notifications('pg-worker',1,'2026-09-15T16:01:04Z');
select count(*) from missionaccounts.api_claim_notifications('pg-worker',1,'2026-09-15T16:04:00Z');
select state from missionaccounts.api_finish_notification(
  (select id from missionaccounts.notification_outbox where state = 'sending'),
  'pg-worker',true,'matrix-provider-2',null,'2026-09-15T16:04:01Z'
);
reset role;
select count(*) || '|' || sum(attempt_count) || '|' || count(provider_ref)
from missionaccounts.notification_outbox where event_kind like 'integration.%';
SQL
)

notification_expected=$'1\nsent\n1\nfailed\n0\n1\nsent\n2|3|2'
if [[ "$notification_results" != "$notification_expected" ]]; then
  echo "MissionAccounts notification outbox verification returned unexpected controls:" >&2
  echo "$notification_results" >&2
  exit 1
fi

policy_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:policy','Cycle Policy Test') returning id")

cycle_policy_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.engine_run(engine_version, source_digest, state)
values ('policy-integration-v1', repeat('d', 64), 'succeeded');
insert into missionaccounts.attendance_day(
  engine_run_id, student_id, cycle_key, day, kind, engine_version, source_digest
)
select
  (select id from missionaccounts.engine_run where engine_version = 'policy-integration-v1'),
  '$policy_student_id', '2026-cycle-2', date '2026-07-14' + day_offset,
  'billable', 'policy-integration-v1', repeat('d', 64)
from generate_series(0, 12) as day_offset;
set role service_role;
select missionaccounts.api_set_cycle_policy(
  '2026-cycle-2','cap','Use the full-cycle price for 13–15 days',
  'wp:admin','missionaccounts_admin','pg-cycle-policy-0001'
)->>'duplicate';
select missionaccounts.api_approve_billing_decision(
  '$policy_student_id','2026-cycle-2','confirm',null,null,
  'wp:admin','missionaccounts_admin','pg-cycle-policy-billing-0002'
)->'decision'->>'amount_cents';
select missionaccounts.api_set_cycle_policy(
  '2026-cycle-2','per','Use the written per-day amount for 13–15 days',
  'wp:admin','missionaccounts_admin','pg-cycle-policy-0002'
)->>'stale_decisions';
select missionaccounts.api_set_cycle_policy(
  '2026-cycle-2','per','Use the written per-day amount for 13–15 days',
  'wp:admin','missionaccounts_admin','pg-cycle-policy-0002'
)->>'duplicate';
select missionaccounts.api_approve_billing_decision(
  '$policy_student_id','2026-cycle-2','confirm',null,null,
  'wp:admin','missionaccounts_admin','pg-cycle-policy-billing-0003'
)->'decision'->>'amount_cents';
reset role;
select
  (select count(*) from missionaccounts.cycle_policy where cycle_key='2026-cycle-2') || '|' ||
  (select value->>'decision' from missionaccounts.cycle_policy where cycle_key='2026-cycle-2' and superseded_by_id is null) || '|' ||
  (select count(*) from missionaccounts.cycle_policy where cycle_key='2026-cycle-2' and superseded_by_id is not null) || '|' ||
  (select count(*) from missionaccounts.invoice where student_id='$policy_student_id' and state='void') || '|' ||
  (select count(*) from missionaccounts.invoice where student_id='$policy_student_id' and state='draft');
SQL
)

cycle_policy_expected=$'false\n30000\n1\ntrue\n32500\n2|per|1|1|1'
if [[ "$cycle_policy_results" != "$cycle_policy_expected" ]]; then
  echo "MissionAccounts cycle-policy verification returned unexpected controls:" >&2
  echo "$cycle_policy_results" >&2
  exit 1
fi

new_account_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(display_name) values ('New Account Link Test') returning id")
historical_account_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(display_name,joined_at) values ('Historical Account Link Test','2026-06-08') returning id")

account_link_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_link_student_account(
  '$new_account_student_id','10000000-0000-4000-8000-000000000099',null,'2026-09-06',
  'Verified new pilot identity','wp:admin','missionaccounts_admin','pg-account-link-0001'
)->>'duplicate';
select missionaccounts.api_link_student_account(
  '$new_account_student_id','10000000-0000-4000-8000-000000000099',null,'2026-09-06',
  'Verified new pilot identity','wp:admin','missionaccounts_admin','pg-account-link-0001'
)->>'duplicate';
select missionaccounts.api_link_student_account(
  '$historical_account_student_id','10000000-0000-4000-8000-000000000098',null,'2026-09-06',
  'Verified historical identity','wp:admin','missionaccounts_admin','pg-account-link-0002'
)->>'duplicate';
reset role;
select
  (select comp_days_allowance from missionaccounts.student where id='$new_account_student_id') || '|' ||
  (select joined_at from missionaccounts.student where id='$new_account_student_id') || '|' ||
  (select comp_days_allowance from missionaccounts.student where id='$historical_account_student_id') || '|' ||
  (select joined_at from missionaccounts.student where id='$historical_account_student_id') || '|' ||
  (select count(*) from missionaccounts.account_link_change) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='account_link.changed');
SQL
)

account_link_expected=$'false\ntrue\nfalse\n5|2026-09-06|0|2026-06-08|2|2'
if [[ "$account_link_results" != "$account_link_expected" ]]; then
  echo "MissionAccounts account-link verification returned unexpected controls:" >&2
  echo "$account_link_results" >&2
  exit 1
fi

auto_charge_student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name,email,identity_state) values ('wp:auto-charge','Automatic Charge Test','auto.charge@example.org','verified') returning id")

auto_charge_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.engine_run(engine_version, source_digest, state)
values ('auto-charge-integration-v1', repeat('e', 64), 'succeeded');
insert into missionaccounts.attendance_day(
  engine_run_id, student_id, cycle_key, day, kind, engine_version, source_digest, computed_at
) values (
  (select id from missionaccounts.engine_run where engine_version='auto-charge-integration-v1'),
  '$auto_charge_student_id','2026-cycle-1','2026-07-01','billable',
  'auto-charge-integration-v1',repeat('e',64),'2026-09-09T11:00:00Z'
);
insert into missionaccounts.stripe_customer_private(student_id,provider,provider_customer_ref)
values ('$auto_charge_student_id','stripe','cus_test_auto_charge_pg');
insert into missionaccounts.payment_method_private(
  student_id,provider,provider_customer_ref,provider_pm_ref,brand,last4,status,verified_at
) values (
  '$auto_charge_student_id','stripe','cus_test_auto_charge_pg','pm_test_auto_charge_pg','visa','4242','on_file','2026-09-09T10:00:00Z'
);
set role service_role;
select missionaccounts.api_approve_billing_decision(
  '$auto_charge_student_id','2026-cycle-1','confirm',null,null,
  'wp:admin','missionaccounts_admin','pg-auto-charge-decision-0001'
)->>'accepted';
select missionaccounts.api_set_billing_consent(
  '$auto_charge_student_id','authorize','integration-v1','127.0.0.1',
  'Student accepted automatic billing terms','wp:auto-charge','student','pg-auto-charge-consent-0001'
)->>'accepted';
select jsonb_array_length(result->'claimed') || '|' || (result->'claimed'->0->>'receipt_email')
from (
  select missionaccounts.api_claim_due_day_charges(
    '2026-09-10T12:00:00Z','pg-auto-charge-worker',10
  ) as result
) claimed;
select state from missionaccounts.auto_charge_dispatch where attendance_day_id = (
  select id from missionaccounts.attendance_day where student_id='$auto_charge_student_id'
);
select missionaccounts.api_finish_auto_charge_dispatch(
  (select id from missionaccounts.auto_charge_dispatch where attendance_day_id = (
    select id from missionaccounts.attendance_day where student_id='$auto_charge_student_id'
  )),
  'pg-auto-charge-worker',true,'pi_test_auto_charge_pg',null,'2026-09-10T12:00:01Z'
)->'dispatch'->>'state';
select jsonb_array_length(missionaccounts.api_claim_due_day_charges(
  '2026-09-10T12:00:02Z','pg-auto-charge-worker',10
)->'claimed');
reset role;
select
  (select state from missionaccounts.charge where student_id='$auto_charge_student_id') || '|' ||
  (select provider_ref from missionaccounts.charge where student_id='$auto_charge_student_id') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='auto_charge.submitted');
SQL
)

auto_charge_expected=$'true\ntrue\n1|auto.charge@example.org\nclaimed\nsubmitted\n0\npending|pi_test_auto_charge_pg|1'
if [[ "$auto_charge_results" != "$auto_charge_expected" ]]; then
  echo "MissionAccounts 24-48 hour automatic-charge verification returned unexpected controls:" >&2
  echo "$auto_charge_results" >&2
  exit 1
fi

zoom_ingestion_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_ingest_zoom_batch(
  'pg-zoom-ingest-0001','2026-09-01T00:00:00Z','2026-09-02T00:00:00Z',
  jsonb_build_object(
    'source_path','zoom-api://completed-meetings/pg-test',
    'sha256',repeat('c',64),'byte_count',512,'observed_at','2026-09-02T12:00:00Z'
  ),
  jsonb_build_array(jsonb_build_object(
    'cycle_key','2026-cycle-3','provider_meeting_id','pg-zoom-meeting-1',
    'provider_instance_id','pg-zoom-instance-1','starts_at','2026-09-01T16:00:00Z',
    'held_on','2026-09-01','time_zone','America/New_York','step','s1',
    'state','candidate','source_payload',jsonb_build_object('topic','Disposable test')
  )),
  jsonb_build_array(jsonb_build_object(
    'provider_instance_id','pg-zoom-instance-1','provider_source_id','pg-zoom-row-1',
    'participant_source_id','pg-zoom-participant-1','display_name','Unresolved attendee',
    'joined_at','2026-09-01T16:01:00Z','left_at','2026-09-01T17:00:00Z',
    'duration_seconds',3540,'payload',jsonb_build_object('source','disposable'),
    'payload_sha256',repeat('d',64)
  ))
)->>'accepted';
select missionaccounts.api_ingest_zoom_batch(
  'pg-zoom-ingest-0001','2026-09-01T00:00:00Z','2026-09-02T00:00:00Z',
  jsonb_build_object(
    'source_path','zoom-api://completed-meetings/pg-test',
    'sha256',repeat('c',64),'byte_count',512,'observed_at','2026-09-02T12:00:00Z'
  ),
  jsonb_build_array(jsonb_build_object(
    'cycle_key','2026-cycle-3','provider_meeting_id','pg-zoom-meeting-1',
    'provider_instance_id','pg-zoom-instance-1','starts_at','2026-09-01T16:00:00Z',
    'held_on','2026-09-01','time_zone','America/New_York','step','s1',
    'state','candidate','source_payload',jsonb_build_object('topic','Disposable test')
  )),
  jsonb_build_array(jsonb_build_object(
    'provider_instance_id','pg-zoom-instance-1','provider_source_id','pg-zoom-row-1',
    'participant_source_id','pg-zoom-participant-1','display_name','Unresolved attendee',
    'joined_at','2026-09-01T16:01:00Z','left_at','2026-09-01T17:00:00Z',
    'duration_seconds',3540,'payload',jsonb_build_object('source','disposable'),
    'payload_sha256',repeat('d',64)
  ))
)->>'duplicate';
select missionaccounts.api_record_zoom_sync_failure(
  'pg-zoom-failure-0001','2026-09-03T00:00:00Z','2026-09-04T00:00:00Z',
  'Disposable provider failure','2026-09-04T00:01:00Z'
)->>'state';
reset role;
select
  (select count(*) from missionaccounts.session where provider_instance_id='pg-zoom-instance-1') || '|' ||
  (select count(*) from missionaccounts.attendance_source_row where provider_source_id='pg-zoom-row-1') || '|' ||
  (select count(*) from missionaccounts.attendance_event ae join missionaccounts.session s on s.id=ae.session_id where s.provider_instance_id='pg-zoom-instance-1') || '|' ||
  (select state from missionaccounts.sync_run where request_id='pg-zoom-ingest-0001') || '|' ||
  (select count(*) from missionaccounts.integration_exception where idempotency_key='missionaccounts:zoom-sync-failure:pg-zoom-failure-0001');
SQL
)

zoom_ingestion_expected=$'true\ntrue\nfailed\n1|1|0|ok|1'
if [[ "$zoom_ingestion_results" != "$zoom_ingestion_expected" ]]; then
  echo "MissionAccounts Zoom ingestion-port verification returned unexpected controls:" >&2
  echo "$zoom_ingestion_results" >&2
  exit 1
fi

attendance_issue_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_attendance_issue(
  '$student_id','I attended the August 21 Step 2/3 class but it is missing.',
  jsonb_build_object('route','#/me/attendance?cycle=august'),
  'wp:4242','student','pg-attendance-issue-0001'
)->>'duplicate';
select missionaccounts.api_submit_attendance_issue(
  '$student_id','I attended the August 21 Step 2/3 class but it is missing.',
  jsonb_build_object('route','#/me/attendance?cycle=august'),
  'wp:4242','student','pg-attendance-issue-0001'
)->>'duplicate';
SQL
)

if [[ "$attendance_issue_results" != $'false\ntrue' ]]; then
  echo "MissionAccounts attendance-issue idempotency verification returned unexpected controls:" >&2
  echo "$attendance_issue_results" >&2
  exit 1
fi

# The ownership mismatch is verified in a separate transaction so ON_ERROR_STOP
# can fail closed without aborting the successful custody checks above.
set +e
attendance_issue_forbidden=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 2>&1 <<SQL
set role service_role;
select missionaccounts.api_submit_attendance_issue(
  '$student_id','Attempted report from another student.','{}'::jsonb,
  'wp:other','student','pg-attendance-issue-0002'
)->>'accepted';
SQL
)
attendance_issue_forbidden_status=$?
set -e
if [[ "$attendance_issue_forbidden_status" -eq 0 ]] || [[ "$attendance_issue_forbidden" != *"attendance_issue_student_binding_mismatch"* ]]; then
  echo "MissionAccounts attendance-issue ownership verification did not fail closed:" >&2
  echo "$attendance_issue_forbidden" >&2
  exit 1
fi

attendance_issue_controls=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "select (select count(*) from missionaccounts.attendance_issue where student_id='$student_id') || '|' || (select count(*) from missionaccounts.audit_event where kind='attendance_issue.submitted' and subject_student_id='$student_id') || '|' || (select count(*) from missionaccounts.notification_outbox where event_kind='attendance.issue_reported' and student_id='$student_id')")
if [[ "$attendance_issue_controls" != "1|1|1" ]]; then
  echo "MissionAccounts attendance-issue custody verification returned unexpected controls:" >&2
  echo "$attendance_issue_controls" >&2
  exit 1
fi

attendance_event_count_before_review=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "select count(*) from missionaccounts.attendance_event where student_id='$student_id'")
billing_decision_count_before_review=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "select count(*) from missionaccounts.billing_decision where student_id='$student_id'")

attendance_issue_review_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_resolve_attendance_issue(
  (select id from missionaccounts.attendance_issue where request_id='pg-attendance-issue-0001'),
  'resolved','Checked the Zoom record and restored the class separately.',
  'wp:admin','missionaccounts_admin','pg-attendance-issue-review-0001'
)->>'duplicate';
select missionaccounts.api_resolve_attendance_issue(
  (select id from missionaccounts.attendance_issue where request_id='pg-attendance-issue-0001'),
  'resolved','Checked the Zoom record and restored the class separately.',
  'wp:admin','missionaccounts_admin','pg-attendance-issue-review-0001'
)->>'duplicate';
reset role;
select
  (select state from missionaccounts.attendance_issue where request_id='pg-attendance-issue-0001') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='attendance_issue.reviewed' and subject_student_id='$student_id') || '|' ||
  (select count(*) from missionaccounts.notification_outbox where event_kind='attendance.issue_reviewed' and student_id='$student_id') || '|' ||
  (select count(*) from missionaccounts.attendance_event where student_id='$student_id') || '|' ||
  (select count(*) from missionaccounts.billing_decision where student_id='$student_id');
SQL
)

attendance_issue_review_expected=$(printf 'false\ntrue\nresolved|1|1|%s|%s' "$attendance_event_count_before_review" "$billing_decision_count_before_review")
if [[ "$attendance_issue_review_results" != "$attendance_issue_review_expected" ]]; then
  echo "MissionAccounts attendance-issue review verification returned unexpected controls:" >&2
  echo "$attendance_issue_review_results" >&2
  exit 1
fi

set +e
attendance_issue_review_forbidden=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 2>&1 <<SQL
set role service_role;
select missionaccounts.api_resolve_attendance_issue(
  (select id from missionaccounts.attendance_issue where request_id='pg-attendance-issue-0001'),
  'dismissed','Attempted student review.',
  'wp:4242','student','pg-attendance-issue-review-0002'
)->>'accepted';
SQL
)
attendance_issue_review_forbidden_status=$?
set -e
if [[ "$attendance_issue_review_forbidden_status" -eq 0 ]] || [[ "$attendance_issue_review_forbidden" != *"invalid_attendance_issue_resolution"* ]]; then
  echo "MissionAccounts attendance-issue review authority did not fail closed:" >&2
  echo "$attendance_issue_review_forbidden" >&2
  exit 1
fi

identity_adjudication_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.source_artifact(id,source_kind,source_path,sha256,byte_count,observed_at)
values ('22000000-0000-4000-8000-000000000001','identity-test','identity-test://cluster',repeat('1',64),1,'2026-09-06T12:00:00Z');
insert into missionaccounts.student(id,display_name,identity_state) values
  ('21000000-0000-4000-8000-000000000001','Identity Canonical','verified'),
  ('21000000-0000-4000-8000-000000000002','Identity Candidate','verified');
insert into missionaccounts.identity_alias(id,student_id,source_artifact_id,source_key,display_value,relationship_state) values
  ('24000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','identity-source-1','Identity Canonical','candidate'),
  ('24000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','identity-source-2','Identity Candidate','candidate');
insert into missionaccounts.identity_cluster(ref,source_artifact_id,state,evidence)
values ('cluster:pg-identity','22000000-0000-4000-8000-000000000001','open','{}');
insert into missionaccounts.identity_cluster_member(cluster_ref,identity_alias_id) values
  ('cluster:pg-identity','24000000-0000-4000-8000-000000000001'),
  ('cluster:pg-identity','24000000-0000-4000-8000-000000000002');
insert into missionaccounts.session(
  id,cycle_key,source_artifact_id,provider,provider_meeting_id,provider_instance_id,
  starts_at,held_on,time_zone,step,state,source_payload
) values
  ('23000000-0000-4000-8000-000000000001','2026-cycle-1','22000000-0000-4000-8000-000000000001','zoom','identity-meeting-1','identity-instance-1','2026-06-10T16:00:00Z','2026-06-10','America/New_York','s1','confirmed','{}'),
  ('23000000-0000-4000-8000-000000000002','2026-cycle-1','22000000-0000-4000-8000-000000000001','zoom','identity-meeting-2','identity-instance-2','2026-06-10T19:00:00Z','2026-06-10','America/New_York','s23','confirmed','{}');
insert into missionaccounts.attendance_event(
  student_id,session_id,cycle_key,local_day,step,interpretation_state,provenance
) values
  ('21000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','2026-cycle-1','2026-06-10','s1','effective','{}'),
  ('21000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','2026-cycle-1','2026-06-10','s23','effective','{}');
insert into missionaccounts.exam_plan(
  id,student_id,step,exam_on,state,submitted_by,decided_by,decided_at
) values (
  '25000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','s1','2026-06-09','approved','wp:identity','wp:admin','2026-06-01T12:00:00Z'
);
insert into missionaccounts.grace_window(student_id,exam_plan_id,from_on)
values ('21000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','2026-06-09');
insert into missionaccounts.full_cycle_ceiling(student_id,cycle_key,status,basis) values
  ('21000000-0000-4000-8000-000000000001','2026-cycle-1','verified',jsonb_build_object('source','identity-canonical-verified')),
  ('21000000-0000-4000-8000-000000000002','2026-cycle-1','candidate',jsonb_build_object('source','identity-candidate'));
set role service_role;
select missionaccounts.recompute_student_attendance('21000000-0000-4000-8000-000000000001','pg-identity-initial-a')->>'days';
select missionaccounts.recompute_student_attendance('21000000-0000-4000-8000-000000000002','pg-identity-initial-b')->>'days';
select (result->>'duplicate') || '|' || (result->>'propagated_cap_holds')
from (
  select missionaccounts.api_decide_identity_cluster(
    'cluster:pg-identity','same','21000000-0000-4000-8000-000000000001','2026-09-06',
    'Dr J confirmed one student','wp:admin','missionaccounts_admin','pg-identity-same-0001'
  ) as result
) decision;
select missionaccounts.api_decide_identity_cluster(
  'cluster:pg-identity','same','21000000-0000-4000-8000-000000000001','2026-09-06',
  'Dr J confirmed one student','wp:admin','missionaccounts_admin','pg-identity-same-0001'
)->>'duplicate';
reset role;
select
  (select count(*) from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000001' and superseded_at is null) || '|' ||
  (select kind from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000001' and superseded_at is null) || '|' ||
  (select same_day_multiple_events from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000001' and superseded_at is null) || '|' ||
  (select count(*) from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000002' and superseded_at is null) || '|' ||
  (select count(*) from missionaccounts.attendance_event where student_id in ('21000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002')) || '|' ||
  (select count(distinct student_id) from missionaccounts.attendance_event_projection where source_student_id in ('21000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002')) || '|' ||
  (select count(*) from missionaccounts.full_cycle_ceiling where student_id='21000000-0000-4000-8000-000000000001' and status='candidate' and superseded_by_id is null) || '|' ||
  (select count(*) from missionaccounts.full_cycle_ceiling where student_id='21000000-0000-4000-8000-000000000001' and status='verified' and superseded_by_id is not null) || '|' ||
  (select cardinality(member_student_ids) from missionaccounts.identity_decision where cluster_ref='cluster:pg-identity' and superseded_by_id is null) || '|' ||
  (select count(*) from missionaccounts.identity_decision where cluster_ref='cluster:pg-identity') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='identity_cluster.decided' and request_id='pg-identity-same-0001');
set role service_role;
select missionaccounts.api_decide_identity_cluster(
  'cluster:pg-identity','different',null,'2026-09-06',
  'Dr J confirmed separate students','wp:admin','missionaccounts_admin','pg-identity-different-0001'
)->>'copied_grace_windows';
reset role;
select
  (select state from missionaccounts.identity_cluster where ref='cluster:pg-identity') || '|' ||
  (select decision from missionaccounts.identity_decision where cluster_ref='cluster:pg-identity' and superseded_by_id is null) || '|' ||
  (select count(*) from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000001' and superseded_at is null) || '|' ||
  (select kind from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000001' and superseded_at is null) || '|' ||
  (select count(*) from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000002' and superseded_at is null) || '|' ||
  (select kind from missionaccounts.attendance_day where student_id='21000000-0000-4000-8000-000000000002' and superseded_at is null) || '|' ||
  (select count(distinct canonical_student_id) from missionaccounts.identity_student_resolution where source_student_id in ('21000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002')) || '|' ||
  (select count(*) from missionaccounts.grace_window_projection where student_id in ('21000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002')) || '|' ||
  (select count(*) from missionaccounts.grace_window where student_id in ('21000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002') and to_on is null) || '|' ||
  (select count(*) from missionaccounts.identity_grace_preservation where student_id='21000000-0000-4000-8000-000000000002') || '|' ||
  (select count(*) from missionaccounts.identity_decision where cluster_ref='cluster:pg-identity') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='identity_cluster.decided' and request_id in ('pg-identity-same-0001','pg-identity-different-0001'));
SQL
)

identity_adjudication_expected=$'1\n1\nfalse|1\ntrue\n1|grace|true|0|2|1|1|1|2|1|1\n1\nresolved|different|1|grace|1|grace|2|2|0|1|2|2'
if [[ "$identity_adjudication_results" != "$identity_adjudication_expected" ]]; then
  echo "MissionAccounts identity-adjudication verification returned unexpected controls:" >&2
  echo "$identity_adjudication_results" >&2
  exit 1
fi

set +e
identity_membership_guard=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 -c "set role service_role; insert into missionaccounts.identity_cluster_member(cluster_ref,identity_alias_id) values ('cluster:pg-identity','24000000-0000-4000-8000-000000000001');" 2>&1)
identity_membership_exit=$?
identity_alias_guard=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 -c "set role service_role; update missionaccounts.identity_alias set display_value='Mutated identity evidence' where id='24000000-0000-4000-8000-000000000001';" 2>&1)
identity_alias_exit=$?
set -e
if [[ "$identity_membership_exit" -eq 0 ]] || [[ "$identity_membership_guard" != *"adjudicated_identity_membership_is_immutable"* ]]; then
  echo "MissionAccounts allowed adjudicated cluster membership to mutate:" >&2
  echo "$identity_membership_guard" >&2
  exit 1
fi
if [[ "$identity_alias_exit" -eq 0 ]] || [[ "$identity_alias_guard" != *"adjudicated_identity_alias_is_immutable"* ]]; then
  echo "MissionAccounts allowed adjudicated identity evidence to mutate:" >&2
  echo "$identity_alias_guard" >&2
  exit 1
fi

psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.billing_decision(
  id,student_id,cycle_key,treatment,amount_cents,basis,basis_sha256,state,decided_by,decided_at,request_id
) values (
  '26000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','2026-cycle-1',
  'confirm',2500,'{}',repeat('a',64),'approved','wp:admin',now(),'pg-identity-financial-decision'
);
insert into missionaccounts.invoice(
  id,student_id,cycle_key,decision_id,state,amount_cents,lines,sent_at
) values (
  '27000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','2026-cycle-1',
  '26000000-0000-4000-8000-000000000001','sent',2500,'[]',now()
);
SQL
set +e
identity_financial_guard=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 -c "set role service_role; select missionaccounts.api_decide_identity_cluster('cluster:pg-identity','same','21000000-0000-4000-8000-000000000001','2026-09-06','Unsafe post-invoice merge','wp:admin','missionaccounts_admin','pg-identity-financial-guard');" 2>&1)
identity_financial_exit=$?
set -e
if [[ "$identity_financial_exit" -eq 0 ]] || [[ "$identity_financial_guard" != *"identity_transition_requires_financial_finality_review"* ]]; then
  echo "MissionAccounts allowed an identity transition across financial finality:" >&2
  echo "$identity_financial_guard" >&2
  exit 1
fi

psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.student(id,display_name,identity_state) values
  ('21000000-0000-4000-8000-000000000011','Comp Identity A','needs_review'),
  ('21000000-0000-4000-8000-000000000012','Comp Identity B','needs_review');
insert into missionaccounts.identity_alias(id,student_id,source_artifact_id,source_key,display_value,relationship_state) values
  ('24000000-0000-4000-8000-000000000011','21000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000001','identity-comp-1','Comp Identity A','candidate'),
  ('24000000-0000-4000-8000-000000000012','21000000-0000-4000-8000-000000000012','22000000-0000-4000-8000-000000000001','identity-comp-2','Comp Identity B','candidate');
insert into missionaccounts.identity_cluster(ref,source_artifact_id,state,evidence)
values ('cluster:pg-identity-comp','22000000-0000-4000-8000-000000000001','open','{}');
insert into missionaccounts.identity_cluster_member(cluster_ref,identity_alias_id) values
  ('cluster:pg-identity-comp','24000000-0000-4000-8000-000000000011'),
  ('cluster:pg-identity-comp','24000000-0000-4000-8000-000000000012');
insert into missionaccounts.comp_day_consumption(student_id,day,comp_index)
values ('21000000-0000-4000-8000-000000000011','2026-06-10',1);
SQL
set +e
identity_comp_guard=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 -c "set role service_role; select missionaccounts.api_decide_identity_cluster('cluster:pg-identity-comp','same','21000000-0000-4000-8000-000000000011','2026-09-06','Unsafe merge with allocated comp day','wp:admin','missionaccounts_admin','pg-identity-comp-guard');" 2>&1)
identity_comp_exit=$?
set -e
if [[ "$identity_comp_exit" -eq 0 ]] || [[ "$identity_comp_guard" != *"identity_transition_requires_comp_day_review"* ]]; then
  echo "MissionAccounts allowed an identity transition across comp-day custody:" >&2
  echo "$identity_comp_guard" >&2
  exit 1
fi

identity_open_question_result=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.student(id,display_name,identity_state) values
  ('21000000-0000-4000-8000-000000000021','Multi Cluster A','needs_review'),
  ('21000000-0000-4000-8000-000000000022','Multi Cluster B','needs_review'),
  ('21000000-0000-4000-8000-000000000023','Multi Cluster C','needs_review');
insert into missionaccounts.identity_alias(id,student_id,source_artifact_id,source_key,display_value,relationship_state) values
  ('24000000-0000-4000-8000-000000000021','21000000-0000-4000-8000-000000000021','22000000-0000-4000-8000-000000000001','identity-multi-1','Multi Cluster A','candidate'),
  ('24000000-0000-4000-8000-000000000022','21000000-0000-4000-8000-000000000022','22000000-0000-4000-8000-000000000001','identity-multi-2','Multi Cluster B','candidate'),
  ('24000000-0000-4000-8000-000000000023','21000000-0000-4000-8000-000000000023','22000000-0000-4000-8000-000000000001','identity-multi-3','Multi Cluster C','candidate'),
  ('24000000-0000-4000-8000-000000000024','21000000-0000-4000-8000-000000000022','22000000-0000-4000-8000-000000000001','identity-device-linked','iPhone','device');
insert into missionaccounts.identity_cluster(ref,source_artifact_id,state,evidence) values
  ('cluster:pg-identity-multi-a','22000000-0000-4000-8000-000000000001','open','{}'),
  ('cluster:pg-identity-multi-b','22000000-0000-4000-8000-000000000001','open','{}');
insert into missionaccounts.identity_cluster_member(cluster_ref,identity_alias_id) values
  ('cluster:pg-identity-multi-a','24000000-0000-4000-8000-000000000021'),
  ('cluster:pg-identity-multi-a','24000000-0000-4000-8000-000000000022'),
  ('cluster:pg-identity-multi-b','24000000-0000-4000-8000-000000000021'),
  ('cluster:pg-identity-multi-b','24000000-0000-4000-8000-000000000023');
set role service_role;
select missionaccounts.api_decide_identity_cluster(
  'cluster:pg-identity-multi-a','different',null,'2026-09-06',
  'Confirmed different while another question remains','wp:admin','missionaccounts_admin','pg-identity-multi-a'
)->>'cluster_state';
reset role;
select
  (select identity_state from missionaccounts.student where id='21000000-0000-4000-8000-000000000021') || '|' ||
  (select identity_state from missionaccounts.student where id='21000000-0000-4000-8000-000000000022');
set role service_role;
select missionaccounts.api_decide_identity_cluster(
  'cluster:pg-identity-multi-b','unsure',null,'2026-09-06',
  'More source evidence is needed','wp:admin','missionaccounts_admin','pg-identity-multi-b-unsure'
)->>'cluster_state';
reset role;
insert into missionaccounts.student(id,display_name,identity_state)
values ('21000000-0000-4000-8000-000000000024','Later Evidence Member','needs_review');
insert into missionaccounts.identity_alias(id,student_id,source_artifact_id,source_key,display_value,relationship_state)
values ('24000000-0000-4000-8000-000000000025','21000000-0000-4000-8000-000000000024','22000000-0000-4000-8000-000000000001','identity-multi-later','Later Evidence Member','candidate');
insert into missionaccounts.identity_cluster_member(cluster_ref,identity_alias_id)
values ('cluster:pg-identity-multi-b','24000000-0000-4000-8000-000000000025');
select count(*) from missionaccounts.identity_cluster_member where cluster_ref='cluster:pg-identity-multi-b';
SQL
)
if [[ "$identity_open_question_result" != $'resolved\nneeds_review|needs_review\nopen\n3' ]]; then
  echo "MissionAccounts incorrectly verified a student with another open identity question:" >&2
  echo "$identity_open_question_result" >&2
  exit 1
fi

unhandled_provider_results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
insert into missionaccounts.provider_event_inbox(
  provider, provider_event_id, provider_object_id, event_type, payload, signature_verified, state
) values (
  'stripe','evt_unhandled_integration','cus_unhandled_integration','customer.updated',
  jsonb_build_object('id','evt_unhandled_integration','type','customer.updated'),true,'received'
);
set role service_role;
select missionaccounts.api_mark_provider_event_unhandled(
  'stripe','evt_unhandled_integration','No MissionAccounts transition is registered for customer.updated'
)->>'duplicate';
select missionaccounts.api_mark_provider_event_unhandled(
  'stripe','evt_unhandled_integration','No MissionAccounts transition is registered for customer.updated'
)->>'duplicate';
reset role;
select
  (select state from missionaccounts.provider_event_inbox where provider_event_id='evt_unhandled_integration') || '|' ||
  (select count(*) from missionaccounts.integration_exception where kind='unhandled_webhook_event' and idempotency_key='stripe:evt_unhandled_integration:unhandled') || '|' ||
  (select count(*) from missionaccounts.audit_event where kind='provider_event.unhandled' and request_id='stripe:evt_unhandled_integration:unhandled');
SQL
)

if [[ "$unhandled_provider_results" != $'false\ntrue\nignored|1|1' ]]; then
  echo "MissionAccounts unhandled-provider-event verification returned unexpected controls:" >&2
  echo "$unhandled_provider_results" >&2
  exit 1
fi

echo "MissionAccounts PostgreSQL migration, account linkage/default comp, identity adjudication and split-grace custody, contact custody, invoice readiness, billing and cycle-policy authority, corrections, student attendance issue custody and admin review, exam decisions, comp transactions, Stripe payment setup/removal, billing consent, 24-48 hour automatic-charge dispatch, unhandled-provider exception custody, Zoom source ingestion, one-charge-per-day dispatch, and notification outbox delivery: PASS"
