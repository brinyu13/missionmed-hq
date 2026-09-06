\set ON_ERROR_STOP on

do $verify$
begin
  if (select count(*) from missionaccounts.import_run where state='applied') <> 1 then raise exception 'import_run_control_failed'; end if;
  if (select count(*) from missionaccounts.source_artifact) <> 6 then raise exception 'artifact_control_failed'; end if;
  if (select count(*) from missionaccounts.student) <> 271 then raise exception 'student_control_failed'; end if;
  if (select count(*) from missionaccounts.student where identity_state='needs_review') <> 67 then raise exception 'student_review_control_failed'; end if;
  if (select count(*) from missionaccounts.session) <> 419 then raise exception 'session_control_failed'; end if;
  if (select count(*) from missionaccounts.session where state='confirmed') <> 100 then raise exception 'confirmed_session_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_source_row) <> 5498 then raise exception 'source_row_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_event) <> 3941 then raise exception 'event_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_event where interpretation_state='needs_review') <> 4 then raise exception 'event_review_control_failed'; end if;
  if (select count(*) from missionaccounts.attendance_day) <> 3264 then raise exception 'day_control_failed'; end if;
  if (select count(*) from missionaccounts.historical_account_source) <> 498 then raise exception 'historical_account_control_failed'; end if;
  if (select count(*) from missionaccounts.historical_account_source where source_state='READY') <> 320 then raise exception 'ready_class_control_failed'; end if;
  if (select count(*) from missionaccounts.historical_account_source where source_state='IDENTITY_HOLD') <> 107 then raise exception 'identity_hold_control_failed'; end if;
  if (select count(*) from missionaccounts.historical_account_source where source_state='CAP_HOLD') <> 69 then raise exception 'cap_hold_control_failed'; end if;
  if (select count(*) from missionaccounts.historical_account_source where source_state='SOURCE_LINK_HOLD') <> 2 then raise exception 'source_link_hold_control_failed'; end if;
  if (select count(*) from missionaccounts.full_cycle_ceiling where status='candidate') <> 74 then raise exception 'cap_candidate_control_failed'; end if;
  if exists (select 1 from missionaccounts.feature_flag where enabled) then raise exception 'feature_flag_control_failed'; end if;
  if (select count(*) from missionaccounts.billing_decision) <> 0
    or (select count(*) from missionaccounts.invoice) <> 0
    or (select count(*) from missionaccounts.charge) <> 0 then
    raise exception 'financial_mutation_control_failed';
  end if;
end
$verify$;

select 'PASS'
  || '|students=' || (select count(*) from missionaccounts.student)
  || '|sessions=' || (select count(*) from missionaccounts.session)
  || '|events=' || (select count(*) from missionaccounts.attendance_event)
  || '|days=' || (select count(*) from missionaccounts.attendance_day)
  || '|ready=320|identity_hold=107|cap_hold=69|source_link_hold=2'
  || '|financial_mutations=0';
