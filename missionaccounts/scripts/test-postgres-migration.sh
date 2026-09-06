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

psql -h "$pg_tmp" -p 55439 -d postgres -v ON_ERROR_STOP=1 \
  -f "$app_dir/supabase/migrations/20260906062212_missionaccounts_initial_schema.sql" \
  >/dev/null

student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:4242','Integration Test') returning id")

results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan('$student_id','s2','2026-10-14','wp:4242','student','pg-integration-0001')->>'duplicate';
select missionaccounts.api_submit_exam_plan('$student_id','s2','2026-10-14','wp:4242','student','pg-integration-0001')->>'duplicate';
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
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0001')->>'accepted';
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0001')->>'duplicate';
reset role;
update missionaccounts.full_cycle_ceiling
set status = 'verified', decided_by = 'wp:admin', decided_at = now()
where student_id = '$student_id' and cycle_key = '2026-cycle-1';
set role service_role;
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0002')->'decision'->>'amount_cents';
select missionaccounts.api_approve_billing_decision('$student_id','2026-cycle-1','confirm',null,null,'wp:admin','missionaccounts_admin','pg-billing-0002')->>'duplicate';
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.invoice) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind like 'billing_decision.%')
from missionaccounts.billing_decision;
SQL
)

billing_expected=$'false\ntrue\n30000\ntrue\n1|1|2'
if [[ "$billing_results" != "$billing_expected" ]]; then
  echo "MissionAccounts billing authority verification returned unexpected controls:" >&2
  echo "$billing_results" >&2
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
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.attendance_event) || '|' ||
  (select count(*) from missionaccounts.audit_event where kind = 'attendance_correction.appended') || '|' ||
  (select state from missionaccounts.billing_decision where student_id = '$student_id' and cycle_key = '2026-cycle-1' and superseded_by_id is null) || '|' ||
  (select state from missionaccounts.invoice where student_id = '$student_id' and cycle_key = '2026-cycle-1' order by created_at desc limit 1)
from missionaccounts.attendance_correction;
SQL
)

correction_expected=$'1\ntrue\ntrue\n2|1|2|stale|void'
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

echo "MissionAccounts PostgreSQL migration, billing authority, corrections, exam decisions, comp transactions, Stripe payment setup, and billing consent: PASS"
