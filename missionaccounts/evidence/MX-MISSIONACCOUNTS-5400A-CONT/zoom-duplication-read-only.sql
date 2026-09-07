with added_sessions as (
 select * from missionaccounts.session where held_on='2026-06-08' and state='confirmed' and not (source_payload ? 'historical_import')
), added_raw as (select r.*,s.starts_at,s.step from missionaccounts.attendance_source_row r join added_sessions s on s.id=r.session_id),
added_events as (select e.* from missionaccounts.attendance_event e join added_sessions s on s.id=e.session_id),
added_students as (select distinct student_id from added_events)
select jsonb_build_object(
'observed_at',now(),'added_sessions',(select count(*) from added_sessions),
'added_source_rows',(select count(*) from added_raw),
'raw_rows_with_exact_historical_evidence',(select count(*) from added_raw a where exists(select 1 from missionaccounts.attendance_source_row h join missionaccounts.session s on s.id=h.session_id where s.source_payload ? 'historical_import' and s.starts_at=a.starts_at and s.step=a.step and lower(trim(regexp_replace(h.display_name,'\s+',' ','g')))=lower(trim(regexp_replace(a.display_name,'\s+',' ','g'))) and h.joined_at=a.joined_at and h.left_at=a.left_at)),
'added_events',(select count(*) from added_events),
'event_states',(select jsonb_agg(x) from (select interpretation_state,count(*) from added_events group by 1)x),
'affected_students',(select count(*) from added_students),
'identity_states',(select jsonb_agg(x) from (select identity_state,count(*) from missionaccounts.student_identity_projection s join added_students a on a.student_id=s.id group by 1)x),
'active_day_kinds',(select jsonb_agg(x) from (select d.kind,count(*) from missionaccounts.attendance_day d join added_students a on a.student_id=d.student_id where d.superseded_at is null group by 1)x)
) as audit;
