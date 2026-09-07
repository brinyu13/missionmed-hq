begin;
set local role service_role;

do $$
declare
  ledger_artifact uuid;
  csv_artifact uuid;
  historical_import uuid;
  historical_sessions uuid[] := '{}';
  historical_students uuid[] := '{}';
  historical_events uuid[] := '{}';

  session_id uuid;
  student_id uuid;
  event_id uuid;
  raw_id uuid;
  step_key text;
  starts_at_value timestamptz;
  row_total integer;
  unique_people integer;
  person_index integer;
  global_row integer := 0;
  row_name text;
  api_name text;
  joined_at_value timestamptz;
  left_at_value timestamptz;

  api_sessions jsonb := '[]';
  api_rows jsonb := '[]';
  api_artifact jsonb;
  batch_text text;
  first_result jsonb;
  retry_result jsonb;
  replay_result jsonb;
  api_import uuid;

  before_students bigint;
  before_events bigint;
  before_days bigint;
  before_engines bigint;
  before_financial text;
  before_sources text;
  before_historical_events text;
  before_duration bigint;

  after_digest text;
  n integer;
  k integer;
begin
  assert inet_server_addr() is null,
    'Run this synthetic custody fixture only in the disposable Unix-socket harness';

  insert into missionaccounts.source_artifact(
    source_kind, source_path, sha256, byte_count, observed_at
  ) values (
    'reconciled_ledger',
    'fixture://5401-zoom/ledger',
    '6a38967fcb369ba6b9bb71daee8f66697efee0042ab6ebd421a0edf1aaeba108',
    1,
    '2026-09-01T00:00:00Z'
  ) returning id into ledger_artifact;

  insert into missionaccounts.source_artifact(
    source_kind, source_path, sha256, byte_count, observed_at
  ) values (
    'zoom_csv',
    'fixture://5401-zoom/raw.csv',
    repeat('a',64),
    1,
    '2026-09-01T00:00:00Z'
  ) returning id into csv_artifact;

  insert into missionaccounts.import_run(
    artifact_id, request_id, state, source_controls, result_controls
  ) values (
    ledger_artifact,
    '5401-zoom-fixture-historical',
    'applied',
    '{"fixture":true}',
    '{"fixture":true}'
  ) returning id into historical_import;

  -- 38 S1 people + 33 S23 people = 71 historical events.
  -- Reconnect/source rows bring raw counts to 42 + 35 = 77.
  for n in 1..71 loop
    insert into missionaccounts.student(
      display_name, source_name, identity_state
    ) values (
      '5401 Historical Person ' || n,
      '5401 Historical Person ' || n,
      'verified'
    ) returning id into student_id;
    historical_students[n] := student_id;
  end loop;

  for k in 1..2 loop
    step_key := case when k=1 then 's1' else 's23' end;
    starts_at_value := case
      when k=1 then '2026-06-08T16:16:34Z'::timestamptz
      else '2026-06-08T18:03:16Z'::timestamptz
    end;
    row_total := case when k=1 then 42 else 35 end;
    unique_people := case when k=1 then 38 else 33 end;

    insert into missionaccounts.session(
      cycle_key, source_artifact_id, provider,
      provider_meeting_id, provider_instance_id,
      starts_at, held_on, time_zone, step, state, source_payload
    ) values (
      '2026-cycle-1', csv_artifact, 'zoom',
      'fixture-history-meeting-' || step_key,
      'fixture-history-instance-' || step_key,
      starts_at_value, '2026-06-08', 'America/New_York',
      step_key, 'confirmed',
      '{"historical_import":true,"confirmed_by_5000b":true,"fixture":true}'
    ) returning id into session_id;
    historical_sessions[k] := session_id;

    api_sessions := api_sessions || jsonb_build_array(
      jsonb_build_object(
        'cycle_key','2026-cycle-1',
        'provider_meeting_id',
          case when k=1 then '12345678901' else '12345678902' end,
        'provider_instance_id','fixture-api-instance-' || step_key,
        'starts_at',starts_at_value,
        'held_on','2026-06-08',
        'time_zone','America/New_York',
        'step',step_key,
        'state','confirmed',
        'source_payload',jsonb_build_object(
          'fixture',true,
          'classification',jsonb_build_object(
            'rule',
            'weekday_11_45_to_16_00_et_and_participants_over_15_ignore_duration',
            'participant_count',row_total,
            'failed_parameters','[]'::jsonb
          )
        )
      )
    );

    for n in 1..row_total loop
      global_row := global_row + 1;
      person_index := case
        when n <= unique_people then n
        else n - unique_people
      end;
      if k=2 then person_index := person_index + 38; end if;

      student_id := historical_students[person_index];
      event_id := historical_events[person_index];

      if event_id is null then
        insert into missionaccounts.attendance_event(
          student_id, session_id, cycle_key, local_day,
          step, interpretation_state, provenance
        ) values (
          student_id, session_id, '2026-cycle-1', '2026-06-08',
          step_key, 'effective', '{"fixture_historical":true}'
        ) returning id into event_id;
        historical_events[person_index] := event_id;
      end if;

      row_name := '5401 Historical Person ' || person_index;
      joined_at_value := starts_at_value + n * interval '1 second';
      left_at_value := joined_at_value + interval '30 minutes';

      insert into missionaccounts.attendance_source_row(
        import_run_id, session_id, provider_source_id,
        participant_source_id, display_name,
        joined_at, left_at, duration_seconds,
        payload, payload_sha256
      ) values (
        historical_import,
        session_id,
        'fixture-history-row-' || global_row,
        'fixture-history-person-' || person_index,
        row_name,
        joined_at_value, left_at_value, 1800,
        jsonb_build_object('fixture',true,'row',global_row),
        encode(extensions.digest(
          'fixture-history-row-' || global_row, 'sha256'
        ), 'hex')
      ) returning id into raw_id;

      insert into missionaccounts.attendance_event_source_row(
        attendance_event_id, source_row_id
      ) values (event_id, raw_id);

      -- Two S1 and three S23 name mismatches: 72 exact + 5 unresolved.
      api_name := case
        when (k=1 and n>40) or (k=2 and n>32)
          then '5401 Unresolved API Label ' || global_row
        else row_name
      end;

      api_rows := api_rows || jsonb_build_array(
        jsonb_build_object(
          'provider_instance_id','fixture-api-instance-' || step_key,
          'provider_source_id','fixture-api-row-' || global_row,
          -- 77 observations / 76 provider identifiers.
          'participant_source_id',
            'fixture-api-person-' ||
            case when global_row=77 then 1 else global_row end,
          'display_name',api_name,
          'joined_at',joined_at_value,
          'left_at',left_at_value,
          'duration_seconds',1800,
          'payload',jsonb_build_object('fixture',true,'row',global_row),
          'payload_sha256',encode(extensions.digest(
            'fixture-api-row-' || global_row, 'sha256'
          ), 'hex')
        )
      );
    end loop;
  end loop;

  assert jsonb_array_length(api_rows)=77;
  assert (
    select count(*)=71
    from missionaccounts.attendance_event
    where missionaccounts.attendance_event.session_id=any(historical_sessions)
  );

  select count(*) into before_students from missionaccounts.student;
  select count(*) into before_events from missionaccounts.attendance_event;
  select count(*) into before_days from missionaccounts.attendance_day;
  select count(*) into before_engines from missionaccounts.engine_run;

  select encode(extensions.digest(
    coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text,'sha256'
  ),'hex')
  into before_sources
  from missionaccounts.attendance_source_row r
  where r.import_run_id=historical_import;

  select encode(extensions.digest(
    coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text,'sha256'
  ),'hex')
  into before_historical_events
  from missionaccounts.attendance_event e
  where e.session_id=any(historical_sessions);

  select coalesce(sum(duration_minutes),0) into before_duration
  from missionaccounts.attendance_event_projection
  where missionaccounts.attendance_event_projection.session_id=any(historical_sessions);

  select jsonb_build_object(
    'decisions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
                 from missionaccounts.billing_decision t),
    'invoices',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
                from missionaccounts.invoice t),
    'charges',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
               from missionaccounts.charge t),
    'consents',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
                from missionaccounts.billing_consent t)
  )::text into before_financial;

  batch_text := jsonb_build_object(
    'sessions',api_sessions,'source_rows',api_rows
  )::text;

  api_artifact := jsonb_build_object(
    'source_path','zoom-api://5401-disposable-fixture',
    'sha256',encode(extensions.digest(batch_text,'sha256'),'hex'),
    'byte_count',octet_length(batch_text),
    'observed_at','2026-09-07T00:00:00Z'
  );

  first_result := missionaccounts.api_ingest_and_reconcile_zoom_batch(
    '5401-zoom-fixture-first',
    '2026-06-08T00:00:00Z',
    '2026-06-09T00:00:00Z',
    api_artifact,api_sessions,api_rows
  );
  api_import := (first_result->>'import_run_id')::uuid;

  assert first_result->>'accepted'='true';
  assert (first_result->>'attendance_events_created')::integer=0;
  assert (first_result->>'review_identities_created')::integer=0;
  assert (first_result->>'students_recomputed')::integer=0;
  assert (
    first_result#>>'{canonicalization,new_exact_corroborations}'
  )::integer=72;
  assert (
    first_result#>>'{canonicalization,new_unresolved_corroborations}'
  )::integer=5;

  assert (
    select count(*)=2
    from missionaccounts.zoom_session_canonicalization mapping
    where mapping.canonical_session_id=any(historical_sessions)
      and mapping.disposition='duplicate'
      and mapping.superseded_by_id is null
  );
  assert (
    select count(*)=77
    from missionaccounts.attendance_source_row
    where import_run_id=api_import
  );

  retry_result := missionaccounts.api_ingest_and_reconcile_zoom_batch(
    '5401-zoom-fixture-first',
    '2026-06-08T00:00:00Z',
    '2026-06-09T00:00:00Z',
    api_artifact,api_sessions,api_rows
  );
  assert retry_result->>'duplicate'='true';

  replay_result := missionaccounts.api_ingest_and_reconcile_zoom_batch(
    '5401-zoom-fixture-new-request',
    '2026-06-08T00:00:00Z',
    '2026-06-09T00:00:00Z',
    api_artifact,api_sessions,api_rows
  );
  assert (replay_result->>'attendance_events_created')::integer=0;
  assert (replay_result->>'review_identities_created')::integer=0;
  assert (replay_result->>'students_recomputed')::integer=0;

  -- Provider identifiers and report order do not define a canonical class or a person.
  select jsonb_agg(value || jsonb_build_object('provider_instance_id','rotated-'||(value->>'provider_instance_id'),'provider_meeting_id','rotated-'||(value->>'provider_meeting_id')) order by value->>'step' desc) into api_sessions from jsonb_array_elements(api_sessions);
  select jsonb_agg(value || jsonb_build_object('provider_instance_id','rotated-'||(value->>'provider_instance_id'),'participant_source_id','rotated-'||(value->>'participant_source_id')) order by value->>'provider_source_id' desc) into api_rows from jsonb_array_elements(api_rows);
  api_artifact:=jsonb_set(api_artifact,'{sha256}',to_jsonb(encode(extensions.digest(api_rows::text,'sha256'),'hex')));
  replay_result:=missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-zoom-fixture-rotated','2026-06-08','2026-06-09',api_artifact,api_sessions,api_rows);
  assert replay_result->>'attendance_events_created'='0' and replay_result->>'review_identities_created'='0';
  assert replay_result#>>'{canonicalization,new_exact_corroborations}'='72' and replay_result#>>'{canonicalization,new_unresolved_corroborations}'='5';
  begin
   perform missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-zoom-fixture-rotated','2026-06-08','2026-06-09',api_artifact,api_sessions,jsonb_set(api_rows,'{0,display_name}','"Changed request"'));
   raise exception 'changed source payload reused request';
  exception when unique_violation then assert SQLERRM='idempotency_key_reuse';end;
  assert (select count(*)=before_students from missionaccounts.student);
  assert (select count(*)=before_events from missionaccounts.attendance_event);
  assert (select count(*)=before_days from missionaccounts.attendance_day);
  assert (select count(*)=before_engines from missionaccounts.engine_run);
  assert (
    select coalesce(sum(duration_minutes),0)=before_duration
    from missionaccounts.attendance_event_projection
    where missionaccounts.attendance_event_projection.session_id=any(historical_sessions)
  );

  select encode(extensions.digest(
    coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]')::text,'sha256'
  ),'hex')
  into after_digest
  from missionaccounts.attendance_source_row r
  where r.import_run_id=historical_import;
  assert after_digest=before_sources,'historical raw evidence changed';

  select encode(extensions.digest(
    coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]')::text,'sha256'
  ),'hex')
  into after_digest
  from missionaccounts.attendance_event e
  where e.session_id=any(historical_sessions);
  assert after_digest=before_historical_events,'historical events changed';

  select jsonb_build_object(
    'decisions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
                 from missionaccounts.billing_decision t),
    'invoices',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
                from missionaccounts.invoice t),
    'charges',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
               from missionaccounts.charge t),
    'consents',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]')
                from missionaccounts.billing_consent t)
  )::text into after_digest;
  assert after_digest=before_financial,'financial state changed';
end;
$$;

DO $$
DECLARE
 s jsonb; rows jsonb; art jsonb; r jsonb; original jsonb; changed jsonb;
 instance text:='5401-forward-instance'; sid uuid; a uuid; ae uuid; n integer; digest_before text;
BEGIN
 s:=jsonb_build_array(jsonb_build_object('cycle_key','2026-cycle-1','provider_meeting_id','5401-forward-meeting','provider_instance_id',instance,'starts_at','2026-06-19T16:00:00Z','held_on','2026-06-19','step','s1','state','confirmed'));
 select jsonb_agg(jsonb_build_object('provider_instance_id',instance,'provider_source_id','5401-forward-row-'||g,'participant_source_id','5401-forward-person-'||g,'display_name','Forward fixture '||g,'joined_at','2026-06-19T16:00:00Z','left_at','2026-06-19T17:00:00Z','duration_seconds',3600,'payload_sha256',repeat('8',64))) into rows from generate_series(1,16) g;
 original:=rows;
 art:=jsonb_build_object('source_path','zoom-api://5401-forward','sha256',repeat('7',64),'byte_count',10,'observed_at','2026-09-07T01:00:00Z');
 r:=missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-forward-first','2026-06-19','2026-06-20',art,s,rows);
 assert r->>'attendance_events_created'='16' and r->>'review_identities_created'='16','new distinct class was suppressed';
 select id into sid from missionaccounts.session where provider_instance_id=instance;
 select e.student_id,e.id into a,ae from missionaccounts.attendance_event e join missionaccounts.attendance_event_source_row l on l.attendance_event_id=e.id join missionaccounts.attendance_source_row src on src.id=l.source_row_id where src.provider_source_id='5401-forward-row-1';
 assert (select duration_minutes=60 from missionaccounts.attendance_event_projection where id=ae);
 -- An incomplete repeat, changed label/participant key and revised overlapping interval are held.
 for n in 1..3 loop
  changed:=jsonb_build_array((original->0)||case n when 1 then '{"joined_at":null}'::jsonb when 2 then '{"display_name":"Changed name","participant_source_id":"changed-source-id"}'::jsonb else '{"left_at":"2026-06-19T17:01:00Z"}'::jsonb end);
  art:=jsonb_set(art,'{sha256}',to_jsonb(encode(extensions.digest(changed::text,'sha256'),'hex')));
  r:=missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-forward-held-'||n,'2026-06-19','2026-06-20',art,s,changed);
  assert r->>'attendance_events_created'='0' and r->>'review_identities_created'='0' and r->>'students_recomputed'='0','uncertain repeat created canonical state';
  assert r#>>'{canonicalization,new_unresolved_corroborations}'='1','uncertain repeat hidden from review';
 end loop;
 assert (select duration_minutes=60 from missionaccounts.attendance_event_projection where id=ae),'repeat doubled duration';
 -- Full report after uncertain observations corroborates the original complete occurrences.
 art:=jsonb_set(art,'{sha256}',to_jsonb(repeat('6',64)));
 r:=missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-forward-complete','2026-06-19','2026-06-20',art,s,original);
 assert r->>'attendance_events_created'='0' and r#>>'{canonicalization,new_exact_corroborations}'='16';
 -- A distinct nonoverlapping reconnect of an already bound provider identity adds one source link, not an event/day/person.
 rows:=jsonb_build_array((original->0)||'{"provider_source_id":"5401-forward-reconnect","joined_at":"2026-06-19T17:10:00Z","left_at":"2026-06-19T17:20:00Z","duration_seconds":600}'::jsonb);
 art:=jsonb_set(art,'{sha256}',to_jsonb(repeat('5',64)));
 r:=missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-forward-reconnect','2026-06-19','2026-06-20',art,s,rows);
 assert r->>'attendance_events_created'='0' and r->>'review_identities_created'='0' and r->>'attendance_source_links_created'='1','safe reconnect not attached to original event';
 assert (select duration_minutes=70 from missionaccounts.attendance_event_projection where id=ae),'disjoint reconnect duration wrong';
 assert (select count(*)=1 from missionaccounts.attendance_day where student_id=a and superseded_at is null),'reconnect created two active days';
 -- S23 on the same calendar date remains a distinct class but one billable interpretation day per person.
 s:=jsonb_build_array((s->0)||'{"provider_instance_id":"5401-forward-s23","provider_meeting_id":"5401-forward-s23-meeting","starts_at":"2026-06-19T18:00:00Z","step":"s23"}'::jsonb);
 select jsonb_agg(value||'{"provider_instance_id":"5401-forward-s23","joined_at":"2026-06-19T18:00:00Z","left_at":"2026-06-19T19:00:00Z"}'::jsonb) into rows from jsonb_array_elements(original);
 art:=jsonb_set(art,'{sha256}',to_jsonb(repeat('4',64)));
 r:=missionaccounts.api_ingest_and_reconcile_zoom_batch('5401-forward-s23','2026-06-19','2026-06-20',art,s,rows);
 assert r->>'attendance_events_created'='16' and r->>'review_identities_created'='0','distinct Step class did not reuse provider identities';
 assert (select count(*)=1 from missionaccounts.attendance_day where student_id=a and superseded_at is null),'same-day steps inflated days';
 assert (select count(*)=2 from missionaccounts.attendance_event where student_id=a and local_day='2026-06-19');
 -- Membership is checked before insertion; prior known sessions cannot be smuggled into another submitted batch.
 begin
  perform missionaccounts.api_ingest_zoom_batch('5401-forward-outside-batch','2026-06-19','2026-06-20',art,'[]',rows);
  raise exception 'source outside submitted class set accepted';
 exception when invalid_parameter_value then assert SQLERRM='zoom_source_session_not_in_batch';end;
 assert not exists(select 1 from missionaccounts.import_run where request_id='5401-forward-outside-batch');
END $$;

rollback;
