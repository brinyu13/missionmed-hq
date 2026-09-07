begin;
set local role service_role;

do $$
declare
  v_fill integer; v_row record; v_shadow uuid; v_event uuid; v_key text; v_snapshot jsonb; v_preview jsonb; v_receipt jsonb;
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

  -- Fill the disposable database to the exact production canonical class baseline.
  for k in 1..3 loop
    select count(*) into n from missionaccounts.session s where s.cycle_key='2026-cycle-'||k and s.state='confirmed' and s.canonical_status='active' and s.superseded_by_id is null;
    for v_fill in 1..((case k when 1 then 34 when 2 then 35 else 31 end)-n) loop
      insert into missionaccounts.session(cycle_key,source_artifact_id,provider,provider_meeting_id,provider_instance_id,starts_at,held_on,time_zone,step,state,source_payload)
      values('2026-cycle-'||k,csv_artifact,'zoom','5401-filler','5401-filler-'||k||'-'||v_fill,
        (case k when 1 then '2026-06-10' when 2 then '2026-07-20' else '2026-08-20' end)::date+time '10:00'+v_fill*interval '1 second',
        (case k when 1 then '2026-06-10' when 2 then '2026-07-20' else '2026-08-20' end)::date,'America/New_York','s1','confirmed','{"fixture":true}');
    end loop;
  end loop;
  first_result:=missionaccounts.api_ingest_zoom_batch('5401-repair-fixture-import','2026-06-08','2026-06-09',api_artifact,api_sessions,api_rows);
  api_import:=(first_result->>'import_run_id')::uuid;
  -- Simulate the deployed pre-5401 interpretation, preserving its raw import.
  update missionaccounts.session s set canonical_status='active' where exists(select 1 from missionaccounts.attendance_source_row r where r.import_run_id=api_import and r.session_id=s.id);
  for v_row in select r.*,s.cycle_key,s.held_on,s.step from missionaccounts.attendance_source_row r join missionaccounts.session s on s.id=r.session_id where r.import_run_id=api_import order by r.provider_source_id loop
    v_key:='zoom:user:'||encode(extensions.digest(v_row.participant_source_id,'sha256'),'hex');
    select a.student_id into v_shadow from missionaccounts.identity_alias a where a.source_key=v_key and a.superseded_by_id is null;
    if not found then
      insert into missionaccounts.student(display_name,source_name,joined_at,identity_state) values(v_row.display_name,v_row.display_name,v_row.held_on,'needs_review') returning id into v_shadow;
      insert into missionaccounts.identity_alias(student_id,source_artifact_id,source_key,display_value,relationship_state) values(v_shadow,(first_result->>'artifact_id')::uuid,v_key,v_row.display_name,'device');
    end if;
    insert into missionaccounts.attendance_event(student_id,session_id,cycle_key,local_day,step,interpretation_state,provenance) values(v_shadow,v_row.session_id,v_row.cycle_key,v_row.held_on,v_row.step,'effective',jsonb_build_object('origin','zoom_reconciliation','fixture',true,'identity_alias_id',(select a.id from missionaccounts.identity_alias a where a.source_key=v_key and a.superseded_by_id is null),'source_key_sha256',split_part(v_key,':',3))) returning id into v_event;
    insert into missionaccounts.attendance_event_source_row(attendance_event_id,source_row_id) values(v_event,v_row.id);
  end loop;
  for v_shadow in select distinct e.student_id from missionaccounts.attendance_event e join missionaccounts.attendance_source_row r on r.session_id=e.session_id where r.import_run_id=api_import loop
    perform missionaccounts.recompute_student_attendance(v_shadow,'5401-repair-fixture-before');
  end loop;
  v_snapshot:=missionaccounts.zoom_5401_snapshot();
  v_preview:=missionaccounts.api_preview_zoom_5401();
  assert v_preview->>'derived_events'='77' and v_preview->>'technical_students'='76';
  begin
    perform missionaccounts.api_repair_zoom_5401('5401-repair-fixture-bad-hash',repeat('0',64),'fixture:5401');
    raise exception 'repair accepted wrong preimage';
  exception when check_violation then assert SQLERRM='zoom_repair_preimage_changed';end;
  assert not exists(select 1 from missionaccounts.zoom_5401_repair_receipt where request_id='5401-repair-fixture-bad-hash');
  -- Malformed but count-preserving associations must not qualify as technical-origin proof.
  begin
    perform missionaccounts.assert_zoom_5401_preimage(jsonb_set(v_snapshot,'{events,0,provenance,identity_alias_id}',to_jsonb(gen_random_uuid())));
    raise exception 'repair accepted unrelated alias provenance';
  exception when check_violation then assert SQLERRM='zoom_repair_alias_provenance_changed';end;
  begin
    perform missionaccounts.assert_zoom_5401_preimage(jsonb_set(v_snapshot,'{event_source_links,0,attendance_event_id}',v_snapshot#>'{event_source_links,1,attendance_event_id}'));
    raise exception 'repair accepted two raw links on one event and none on another';
  exception when check_violation then assert SQLERRM='zoom_repair_event_link_custody';end;
  begin
    perform missionaccounts.assert_zoom_5401_preimage(jsonb_set(v_snapshot,'{day_event_links,0,attendance_day_id}',to_jsonb(gen_random_uuid())));
    raise exception 'repair accepted unrelated day ownership';
  exception when check_violation then assert SQLERRM='zoom_repair_day_event_custody';end;
  begin
    insert into missionaccounts.attendance_source_row(import_run_id,session_id,provider_source_id,participant_source_id,display_name,joined_at,left_at,duration_seconds,payload,payload_sha256)
    select r.import_run_id,historical_sessions[1],'5401-outside-scope',r.participant_source_id,r.display_name,r.joined_at,r.left_at,r.duration_seconds,r.payload,r.payload_sha256 from missionaccounts.attendance_source_row r where r.import_run_id=api_import limit 1;
    begin
      perform missionaccounts.assert_zoom_5401_preimage(v_snapshot);
      raise exception 'repair accepted extra class in same import';
    exception when check_violation then assert SQLERRM='zoom_repair_import_outside_scope';end;
    raise exception using errcode='P541R',message='rollback disposable import scope fixture';
  exception when sqlstate 'P541R' then null;end;
  v_receipt:=missionaccounts.api_repair_zoom_5401('5401-repair-fixture-apply',v_preview->>'before_sha256','fixture:5401');
  assert v_receipt->>'state'='applied';
  assert v_receipt#>'{controls,cycle_counts}'='{"2026-cycle-1":34,"2026-cycle-2":35,"2026-cycle-3":31}'::jsonb;
  assert v_receipt#>>'{controls,exact_corroborations}'='72' and v_receipt#>>'{controls,unresolved_occurrences}'='5';
  assert (select count(*)=76 from missionaccounts.zoom_shadow_retirement where reversed_at is null);
  assert (select count(*)=0 from missionaccounts.student_identity_projection where (v_snapshot->'student_ids') ? id::text),'retired students still visible';
  assert (select count(*)=0 from missionaccounts.attendance_event_projection where (v_snapshot->'event_ids') ? id::text),'duplicate events still effective';
  retry_result:=missionaccounts.api_repair_zoom_5401('5401-repair-fixture-apply',v_preview->>'before_sha256','fixture:5401');
  assert retry_result->>'duplicate'='true' and retry_result->>'repair_id'=v_receipt->>'repair_id';
  begin
    update missionaccounts.zoom_5401_repair_receipt set before_state='{}' where id=(v_receipt->>'repair_id')::uuid;
    raise exception 'private preimage mutable';
  exception when check_violation then assert SQLERRM='zoom_repair_preimage_is_immutable';end;
  -- New immutable source evidence must make rollback refuse; use a subtransaction to undo this disposable conflict fixture.
  begin
    insert into missionaccounts.attendance_source_row(import_run_id,session_id,provider_source_id,participant_source_id,display_name,joined_at,left_at,duration_seconds,payload,payload_sha256)
    select r.import_run_id,r.session_id,'5401-late-fixture-row',r.participant_source_id,r.display_name,r.joined_at,r.left_at,r.duration_seconds,r.payload,r.payload_sha256 from missionaccounts.attendance_source_row r where r.import_run_id=api_import limit 1;
    begin
      perform missionaccounts.api_reverse_zoom_5401((v_receipt->>'repair_id')::uuid,'5401-reverse-source-conflict','fixture:5401',repeat('1',64));
      raise exception 'rollback accepted new source';
    exception when check_violation then assert SQLERRM='zoom_reversal_intervening_activity';end;
    raise exception using errcode='P541R',message='rollback disposable conflict fixture';
  exception when sqlstate 'P541R' then null;end;
  -- A human audit referencing a shadow is independent activity, even without a financial mutation.
  begin
    insert into missionaccounts.audit_event(actor_id,actor_role,subject_student_id,kind,text,reason,request_id) values('fixture:human','founder',(v_snapshot#>>'{student_ids,0}')::uuid,'fixture.review','Independent fixture review','Conflict fixture','5401-human-conflict');
    begin
      perform missionaccounts.api_reverse_zoom_5401((v_receipt->>'repair_id')::uuid,'5401-reverse-domain-conflict','fixture:5401',repeat('1',64));
      raise exception 'rollback accepted human activity';
    exception when check_violation then assert SQLERRM='zoom_reversal_intervening_activity';end;
    raise exception using errcode='P541R',message='rollback disposable conflict fixture';
  exception when sqlstate 'P541R' then null;end;
  begin
    update missionaccounts.student set email='forbidden@example.invalid' where id=(v_snapshot#>>'{student_ids,0}')::uuid;
    raise exception 'retired projection remained writable';
  exception when check_violation then assert SQLERRM='student_is_retired_technical_projection';end;
  replay_result:=missionaccounts.api_reverse_zoom_5401((v_receipt->>'repair_id')::uuid,'5401-repair-fixture-reverse','fixture:5401',repeat('1',64));
  assert replay_result->>'state'='reversed';
  retry_result:=missionaccounts.api_reverse_zoom_5401((v_receipt->>'repair_id')::uuid,'5401-repair-fixture-reverse','fixture:5401',repeat('1',64));
  assert retry_result->>'duplicate'='true';
  assert (select count(*)=76 from missionaccounts.attendance_day d where d.superseded_at is null and (v_snapshot->'student_ids') ? d.student_id::text),'rollback did not restore exact review days';
  assert (select count(*)=4 from missionaccounts.zoom_session_canonicalization where (v_snapshot->'api_session_ids') ? source_session_id::text),'mapping history not preserved';
  assert (select count(*)=154 from missionaccounts.zoom_source_corroboration where (v_snapshot->'source_row_ids') ? source_row_id::text),'corroboration history not preserved';
  assert (select count(*)=77 from missionaccounts.attendance_source_row where import_run_id=api_import),'rollback rewrote source';
END $$;
rollback;
