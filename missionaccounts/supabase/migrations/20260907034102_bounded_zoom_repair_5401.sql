-- MX-MISSIONACCOUNTS-5401R: exact June 8 technical repair. No raw deletion or human identity adjudication.
create table missionaccounts.zoom_5401_repair_receipt (
 id uuid primary key default gen_random_uuid(),request_id text not null unique,
 expected_before_sha256 text not null check(expected_before_sha256 ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('prepared','applied','reversed')),actor_id text not null,
 before_state jsonb not null,after_state jsonb,after_operation_sha256 text,
 result_controls jsonb not null default '{}',applied_at timestamptz,reversed_at timestamptz,
 reversal_request_id text unique,reversal_actor_id text,reversal_controls jsonb,created_at timestamptz not null default now(),
 check ((state='prepared' and applied_at is null and reversed_at is null) or (state='applied' and applied_at is not null and reversed_at is null) or (state='reversed' and applied_at is not null and reversed_at is not null and reversal_request_id is not null and reversal_actor_id is not null))
);
alter table missionaccounts.zoom_5401_repair_receipt enable row level security;
alter table missionaccounts.zoom_5401_repair_receipt force row level security;
revoke all on missionaccounts.zoom_5401_repair_receipt from public,anon,authenticated;
grant select,insert,update on missionaccounts.zoom_5401_repair_receipt to service_role;

create function missionaccounts.guard_zoom_5401_receipt() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception using errcode='23514',message='zoom_repair_receipt_is_immutable';end if;
 if (to_jsonb(old)-array['state','after_state','after_operation_sha256','result_controls','applied_at','reversed_at','reversal_request_id','reversal_actor_id','reversal_controls']) is distinct from (to_jsonb(new)-array['state','after_state','after_operation_sha256','result_controls','applied_at','reversed_at','reversal_request_id','reversal_actor_id','reversal_controls']) then
  raise exception using errcode='23514',message='zoom_repair_preimage_is_immutable';end if;
 if old.state='prepared' and new.state='applied' then return new;end if;
 if old.state='applied' and new.state='reversed' and old.after_state=new.after_state and old.after_operation_sha256=new.after_operation_sha256 and old.result_controls=new.result_controls and old.applied_at=new.applied_at then return new;end if;
 raise exception using errcode='23514',message='invalid_zoom_repair_transition';
end $$;
create trigger zoom_5401_receipt_guard before update or delete on missionaccounts.zoom_5401_repair_receipt for each row execute function missionaccounts.guard_zoom_5401_receipt();

create function missionaccounts.zoom_5401_snapshot() returns jsonb language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
declare
 v_api uuid[];v_history uuid[];v_students uuid[];v_events uuid[];v_raw uuid[];v_days uuid[];v_imports uuid[];
 refs jsonb:='{}';ref record;ref_count bigint; result jsonb;
begin
 select coalesce(array_agg(s.id order by s.id),'{}') into v_api from missionaccounts.session s join missionaccounts.source_artifact a on a.id=s.source_artifact_id
 where s.provider='zoom' and s.state='confirmed' and a.source_kind='zoom_api_window' and not(s.source_payload @> '{"historical_import":true}')
 and ((s.step='s1' and s.starts_at='2026-06-08T16:16:34Z') or(s.step='s23' and s.starts_at='2026-06-08T18:03:16Z'));
 select coalesce(array_agg(distinct h.id order by h.id),'{}') into v_history from missionaccounts.session s join missionaccounts.session h on h.id<>s.id and h.starts_at=s.starts_at and h.step=s.step and h.held_on=s.held_on and h.cycle_key=s.cycle_key
 where s.id=any(v_api) and h.state='confirmed' and h.canonical_status='active' and h.superseded_by_id is null and missionaccounts.zoom_is_custodied_history(h.id);
 select coalesce(array_agg(distinct e.student_id order by e.student_id),'{}') into v_students from missionaccounts.attendance_event e where e.session_id=any(v_api);
 select coalesce(array_agg(e.id order by e.id),'{}') into v_events from missionaccounts.attendance_event e where e.student_id=any(v_students);
 select coalesce(array_agg(r.id order by r.id),'{}'),coalesce(array_agg(distinct r.import_run_id order by r.import_run_id),'{}') into v_raw,v_imports from missionaccounts.attendance_source_row r where r.session_id=any(v_api);
 select coalesce(array_agg(d.id order by d.id),'{}') into v_days from missionaccounts.attendance_day d where d.student_id=any(v_students) and d.superseded_at is null;
 for ref in select relation.relname table_name,string_agg(distinct format('t.%I=any($1)',attribute.attname),' or ') predicate
  from pg_constraint fk join pg_class relation on relation.oid=fk.conrelid join pg_namespace ns on ns.oid=relation.relnamespace
  join pg_attribute attribute on attribute.attrelid=relation.oid and attribute.attnum=any(fk.conkey)
  where fk.contype='f' and fk.confrelid='missionaccounts.student'::regclass and ns.nspname='missionaccounts'
   and relation.relname not in ('attendance_event','attendance_day','identity_alias','zoom_shadow_retirement') group by relation.relname
 loop
  execute format('select count(*) from missionaccounts.%I t where %s',ref.table_name,ref.predicate) into ref_count using v_students;
  if ref_count<>0 then refs:=refs||jsonb_build_object(ref.table_name,ref_count);end if;
 end loop;
 select count(*) into ref_count from missionaccounts.identity_decision d where d.member_student_ids && v_students;
 if ref_count<>0 then refs:=refs||jsonb_build_object('identity_decision_members',ref_count);end if;
 select count(*) into ref_count from missionaccounts.identity_cluster_member m join missionaccounts.identity_alias a on a.id=m.identity_alias_id where a.student_id=any(v_students);
 if ref_count<>0 then refs:=refs||jsonb_build_object('identity_cluster_alias_members',ref_count);end if;
 result:=jsonb_build_object('api_session_ids',v_api,'historical_session_ids',v_history,'student_ids',v_students,'event_ids',v_events,'source_row_ids',v_raw,'active_day_ids',v_days,'import_ids',v_imports,'domain_refs',refs);
 result:=result||jsonb_build_object('sessions',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.session t where t.id=any(v_api)));
 result:=result||jsonb_build_object('students',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.student t where t.id=any(v_students)));
 result:=result||jsonb_build_object('aliases',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.identity_alias t where t.student_id=any(v_students)));
 result:=result||jsonb_build_object('events',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_event t where t.student_id=any(v_students)));
 result:=result||jsonb_build_object('days',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_day t where t.student_id=any(v_students)));
 result:=result||jsonb_build_object('source_rows',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_source_row t where t.session_id=any(v_api)));
 result:=result||jsonb_build_object('event_source_links',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_event_source_row t where t.attendance_event_id=any(v_events)));
 result:=result||jsonb_build_object('day_event_links',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_day_event t where exists(select 1 from missionaccounts.attendance_day d where d.id=t.attendance_day_id and d.student_id=any(v_students))));
 result:=result||jsonb_build_object('mappings',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.zoom_session_canonicalization t where t.source_session_id=any(v_api)));
 result:=result||jsonb_build_object('corroborations',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.zoom_source_corroboration t where t.source_row_id=any(v_raw)));
 result:=result||jsonb_build_object('retirements',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.zoom_shadow_retirement t where t.student_id=any(v_students)));
 result:=result||jsonb_build_object('cycle_counts',(select jsonb_object_agg(key,(select count(*) from missionaccounts.session s where s.cycle_key=c.key and s.state='confirmed' and s.canonical_status='active' and s.superseded_by_id is null)) from missionaccounts.cycle c where c.key in ('2026-cycle-1','2026-cycle-2','2026-cycle-3')));
 result:=result||jsonb_build_object('all_raw_sha256',encode(extensions.digest((select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from missionaccounts.attendance_source_row t)::text,'sha256'),'hex'));
 result:=result||jsonb_build_object('historical_sha256',encode(extensions.digest(jsonb_build_object('students',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.student t where not(t.id=any(v_students))),'aliases',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.identity_alias t where t.student_id is null or not(t.student_id=any(v_students))),'sessions',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.session t where not(t.id=any(v_api))),'events',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_event t where not(t.student_id=any(v_students))),'days',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.attendance_day t where not(t.student_id=any(v_students))),'artifacts',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.source_artifact t where true),'historical_accounts',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.historical_account_source t where true))::text,'sha256'),'hex'));
 result:=result||jsonb_build_object('financial_sha256',encode(extensions.digest(jsonb_build_object('billing_decision',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.billing_decision t where true),'cycle_policy',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.cycle_policy t where true),'invoice',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.invoice t where true),'charge',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.charge t where true),'billing_consent',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.billing_consent t where true),'stripe_invoice_dispatch',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.stripe_invoice_dispatch t where true),'auto_charge_dispatch',(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from missionaccounts.auto_charge_dispatch t where true))::text,'sha256'),'hex'));
 return result;
end $$;

create function missionaccounts.zoom_5401_digest(p_state jsonb) returns text language sql immutable strict security invoker set search_path=pg_catalog as $$select encode(extensions.digest(p_state::text,'sha256'),'hex')$$;
create function missionaccounts.zoom_5401_operation_digest(p_state jsonb) returns text language sql immutable strict security invoker set search_path=pg_catalog,missionaccounts as $$select missionaccounts.zoom_5401_digest(p_state-array['historical_sha256','financial_sha256','all_raw_sha256','cycle_counts'])$$;

create function missionaccounts.assert_zoom_5401_preimage(p jsonb) returns void language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
begin
 if jsonb_array_length(p->'api_session_ids')<>2 or jsonb_array_length(p->'historical_session_ids')<>2 or jsonb_array_length(p->'students')<>76 or jsonb_array_length(p->'events')<>77 or jsonb_array_length(p->'source_rows')<>77 or jsonb_array_length(p->'aliases')<>76 or jsonb_array_length(p->'active_day_ids')<>76 or jsonb_array_length(p->'import_ids')<>1 or p->'domain_refs'<>'{}'::jsonb then raise exception using errcode='23514',message='zoom_repair_bounded_population_changed';end if;
 -- Canonicalization processes the complete import, so every row must belong to this bounded pair.
 if exists(select 1 from missionaccounts.attendance_source_row r where (p->'import_ids') ? r.import_run_id::text and not((p->'api_session_ids') ? r.session_id::text)) then raise exception using errcode='23514',message='zoom_repair_import_outside_scope';end if;
 if exists(select 1 from jsonb_array_elements(p->'sessions') s where (select count(*) from jsonb_array_elements(p->'source_rows') r where r->>'session_id'=s->>'id')<>(case s->>'step' when 's1' then 42 when 's23' then 35 else -1 end) or (select count(*) from jsonb_array_elements(p->'events') e where e->>'session_id'=s->>'id')<>(case s->>'step' when 's1' then 42 when 's23' then 35 else -1 end)) then raise exception using errcode='23514',message='zoom_repair_class_partition_changed';end if;
 if exists(select 1 from jsonb_array_elements(p->'students') s where (select count(*) from jsonb_array_elements(p->'aliases') a where a->>'student_id'=s->>'id')<>1) or exists(select 1 from jsonb_array_elements(p->'events') e where not exists(select 1 from jsonb_array_elements(p->'aliases') a where a->>'student_id'=e->>'student_id' and a->>'id'=e#>>'{provenance,identity_alias_id}' and split_part(a->>'source_key',':',3)=e#>>'{provenance,source_key_sha256}')) then raise exception using errcode='23514',message='zoom_repair_alias_provenance_changed';end if;
 if exists(select 1 from jsonb_array_elements(p->'events') e where (select count(*) from jsonb_array_elements(p->'event_source_links') link where link->>'attendance_event_id'=e->>'id')<>1) then raise exception using errcode='23514',message='zoom_repair_event_link_custody';end if;
 if exists(select 1 from jsonb_array_elements(p->'day_event_links') link where not exists(select 1 from jsonb_array_elements(p->'events') e join jsonb_array_elements(p->'days') d on d->>'student_id'=e->>'student_id' and d->>'cycle_key'=e->>'cycle_key' and d->>'day'=e->>'local_day' where e->>'id'=link->>'attendance_event_id' and d->>'id'=link->>'attendance_day_id')) or exists(select 1 from jsonb_array_elements(p->'events') e where (select count(*) from jsonb_array_elements(p->'day_event_links') link where link->>'attendance_event_id'=e->>'id')<>1) then raise exception using errcode='23514',message='zoom_repair_day_event_custody';end if;
 if jsonb_array_length(p->'mappings')<>0 or jsonb_array_length(p->'corroborations')<>0 or jsonb_array_length(p->'retirements')<>0 or p->'cycle_counts'<>'{"2026-cycle-1":36,"2026-cycle-2":35,"2026-cycle-3":31}'::jsonb then raise exception using errcode='23514',message='zoom_repair_expected_original_projection';end if;
 if exists(select 1 from jsonb_array_elements(p->'sessions') x where x->>'canonical_status'<>'active' or x->>'superseded_by_id' is not null) then raise exception using errcode='23514',message='zoom_repair_source_already_interpreted';end if;
 if exists(select 1 from jsonb_array_elements(p->'events') x where x->>'interpretation_state'<>'effective' or x#>>'{provenance,origin}' is distinct from 'zoom_reconciliation' or x->>'superseded_by_id' is not null or not(p->'api_session_ids' ? (x->>'session_id'))) then raise exception using errcode='23514',message='zoom_repair_independent_attendance';end if;
 if exists(select 1 from jsonb_array_elements(p->'students') x where x->>'identity_state'<>'needs_review' or x->>'matrix_user_ref' is not null or x->>'email' is not null or x->>'phone' is not null or (x->>'comp_days_allowance')::integer<>0) then raise exception using errcode='23514',message='zoom_repair_independent_student_state';end if;
 if exists(select 1 from jsonb_array_elements(p->'aliases') x where x->>'relationship_state'<>'device' or x->>'source_key' not like 'zoom:%' or x->>'superseded_by_id' is not null) then raise exception using errcode='23514',message='zoom_repair_independent_alias_state';end if;
 if exists(select 1 from jsonb_array_elements(p->'days') x where x->>'kind'<>'needs_review' or x->>'day'<>'2026-06-08' or x->>'cycle_key'<>'2026-cycle-1') then raise exception using errcode='23514',message='zoom_repair_independent_day_state';end if;
 if exists(select 1 from jsonb_array_elements(p->'retirements') x where x->>'superseded_by_id' is null and x->>'reversed_at' is null) then raise exception using errcode='23514',message='zoom_repair_already_retired';end if;
 if exists(select 1 from jsonb_array_elements(p->'mappings') x where x->>'superseded_by_id' is null and (x->>'disposition'<>'duplicate' or not(p->'historical_session_ids' ? (x->>'canonical_session_id')))) then raise exception using errcode='23514',message='zoom_repair_prior_mapping_conflict';end if;
 if exists(select 1 from jsonb_array_elements(p->'source_rows') raw where (select count(*) from jsonb_array_elements(p->'event_source_links') link where link->>'source_row_id'=raw->>'id')<>1) or jsonb_array_length(p->'event_source_links')<>77 then raise exception using errcode='23514',message='zoom_repair_raw_link_custody';end if;
 if exists(select 1 from jsonb_array_elements(p->'event_source_links') link join jsonb_array_elements(p->'events') e on e->>'id'=link->>'attendance_event_id' join jsonb_array_elements(p->'source_rows') r on r->>'id'=link->>'source_row_id' where e->>'session_id'<>r->>'session_id') then raise exception using errcode='23514',message='zoom_repair_source_class_mismatch';end if;
end $$;

create function missionaccounts.api_preview_zoom_5401() returns jsonb language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
declare p jsonb;begin p:=missionaccounts.zoom_5401_snapshot();perform missionaccounts.assert_zoom_5401_preimage(p);return jsonb_build_object('before_sha256',missionaccounts.zoom_5401_digest(p),'source_classes',2,'derived_events',77,'technical_students',76,'active_review_days',76,'cycle_counts',p->'cycle_counts','historical_sha256',p->'historical_sha256','all_raw_sha256',p->'all_raw_sha256','financial_sha256',p->'financial_sha256');end $$;

create function missionaccounts.zoom_5401_lock_scope(p jsonb) returns void language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
begin
 perform 1 from missionaccounts.import_run i where (p->'import_ids') ? i.id::text order by i.id for update;
 perform pg_advisory_xact_lock(hashtextextended('missionaccounts:zoom-class:drills:2026-06-08:s1',0));
 perform pg_advisory_xact_lock(hashtextextended('missionaccounts:zoom-class:drills:2026-06-08:s23',0));
 perform 1 from missionaccounts.session s where (p->'api_session_ids') ? s.id::text order by s.id for no key update;
 perform 1 from missionaccounts.student s where (p->'student_ids') ? s.id::text order by s.id for update;
 perform 1 from missionaccounts.attendance_day d where (p->'student_ids') ? d.student_id::text order by d.id for update;
end $$;

create function missionaccounts.api_repair_zoom_5401(p_request_id text,p_expected_before_sha256 text,p_actor_id text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
<<repair>>
declare prior missionaccounts.zoom_5401_repair_receipt%rowtype;before_state jsonb;after_state jsonb;v_id uuid:=gen_random_uuid();v_import uuid;canonical jsonb;controls jsonb;changed integer;field text;
begin
 if p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' or p_expected_before_sha256 is null or p_expected_before_sha256 !~ '^[0-9a-f]{64}$' or nullif(btrim(p_actor_id),'') is null then raise exception using errcode='22023',message='invalid_zoom_repair_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('missionaccounts:5401R:June8-repair',0));
 select * into prior from missionaccounts.zoom_5401_repair_receipt r where r.request_id=p_request_id for update;
 if found then
  if prior.expected_before_sha256<>p_expected_before_sha256 or prior.actor_id<>p_actor_id then raise exception using errcode='23505',message='idempotency_key_reuse';end if;
  return jsonb_build_object('accepted',true,'duplicate',true,'repair_id',prior.id,'state',prior.state,'controls',prior.result_controls);
 end if;
 before_state:=missionaccounts.zoom_5401_snapshot();perform missionaccounts.zoom_5401_lock_scope(before_state);before_state:=missionaccounts.zoom_5401_snapshot();perform missionaccounts.assert_zoom_5401_preimage(before_state);
 if missionaccounts.zoom_5401_digest(before_state)<>p_expected_before_sha256 then raise exception using errcode='23514',message='zoom_repair_preimage_changed';end if;
 insert into missionaccounts.zoom_5401_repair_receipt(id,request_id,expected_before_sha256,state,actor_id,before_state) values(v_id,p_request_id,p_expected_before_sha256,'prepared',p_actor_id,before_state);
 v_import:=(before_state#>>'{import_ids,0}')::uuid;
 canonical:=missionaccounts.api_canonicalize_zoom_import(v_import,'5401-repair:'||v_id::text);
 if (select count(*) from missionaccounts.zoom_session_canonicalization m where (before_state->'api_session_ids') ? m.source_session_id::text and m.superseded_by_id is null and m.disposition='duplicate' and (before_state->'historical_session_ids') ? m.canonical_session_id::text)<>2 then raise exception using errcode='23514',message='zoom_repair_exact_targets_missing';end if;
 if (select count(*) from missionaccounts.zoom_source_corroboration c where (before_state->'source_row_ids') ? c.source_row_id::text and c.superseded_by_id is null and c.disposition='exact_occurrence')<>72 or (select count(*) from missionaccounts.zoom_source_corroboration c where (before_state->'source_row_ids') ? c.source_row_id::text and c.superseded_by_id is null and c.disposition='unresolved_occurrence')<>5 then raise exception using errcode='23514',message='zoom_repair_occurrence_controls_changed';end if;
 update missionaccounts.attendance_day d set superseded_at=transaction_timestamp() where (before_state->'active_day_ids') ? d.id::text and d.superseded_at is null;
 get diagnostics changed=row_count;if changed<>76 then raise exception using errcode='23514',message='zoom_repair_day_count_changed';end if;
 insert into missionaccounts.zoom_shadow_retirement(student_id,reason,evidence,request_id)
 select value::uuid,'duplicate_canonicalization_artifact',jsonb_build_object('repair_id',v_id,'before_sha256',p_expected_before_sha256,'raw_evidence_preserved',true,'human_identity_decision',false),'5401-repair:'||v_id::text||':student:'||value from jsonb_array_elements_text(before_state->'student_ids');
 after_state:=missionaccounts.zoom_5401_snapshot();
 foreach field in array array['students','aliases','events','source_rows','event_source_links','day_event_links','historical_sha256','all_raw_sha256','financial_sha256','domain_refs'] loop
  if before_state->field is distinct from after_state->field then raise exception using errcode='23514',message='zoom_repair_custody_changed:'||field;end if;
 end loop;
 if after_state->'cycle_counts'<>'{"2026-cycle-1":34,"2026-cycle-2":35,"2026-cycle-3":31}'::jsonb or jsonb_array_length(after_state->'active_day_ids')<>0 or (select count(*) from jsonb_array_elements(after_state->'retirements') x where x->>'superseded_by_id' is null and x->>'reversed_at' is null)<>76 then raise exception using errcode='23514',message='zoom_repair_postconditions_failed';end if;
 if (select jsonb_agg(x-array['canonical_status','superseded_by_id'] order by x->>'id') from jsonb_array_elements(before_state->'sessions') x) is distinct from (select jsonb_agg(x-array['canonical_status','superseded_by_id'] order by x->>'id') from jsonb_array_elements(after_state->'sessions') x) or (select jsonb_agg(x-'superseded_at' order by x->>'id') from jsonb_array_elements(before_state->'days') x) is distinct from (select jsonb_agg(x-'superseded_at' order by x->>'id') from jsonb_array_elements(after_state->'days') x) then raise exception using errcode='23514',message='zoom_repair_unexpected_projection_change';end if;
 controls:=jsonb_build_object('source_classes',2,'exact_corroborations',72,'unresolved_occurrences',5,'retired_technical_students',76,'retired_review_days',76,'physical_events_preserved',77,'raw_rows_preserved',77,'cycle_counts',after_state->'cycle_counts','historical_sha256',after_state->'historical_sha256','all_raw_sha256',after_state->'all_raw_sha256','financial_sha256',after_state->'financial_sha256');
 update missionaccounts.zoom_5401_repair_receipt set state='applied',after_state=repair.after_state,after_operation_sha256=missionaccounts.zoom_5401_operation_digest(repair.after_state),result_controls=controls,applied_at=now() where id=v_id;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id) values(p_actor_id,'system','zoom_repair.applied','Retired isolated duplicate technical projections; preserved historical and raw evidence',controls||jsonb_build_object('repair_id',v_id),'Founder-authorized MX-MISSIONACCOUNTS-5401R bounded repair',p_request_id);
 return jsonb_build_object('accepted',true,'duplicate',false,'repair_id',v_id,'state','applied','controls',controls);
end $$;

-- This RPC cannot inspect WordPress/Railway. The caller must first verify public
-- containment and paused Zoom, then bind those provider readbacks by SHA-256.
create function missionaccounts.api_reverse_zoom_5401(p_repair_id uuid,p_reversal_request_id text,p_actor_id text,p_posture_sha256 text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,missionaccounts as $$
declare
 receipt missionaccounts.zoom_5401_repair_receipt%rowtype;current_state jsonb;final_state jsonb;
 m missionaccounts.zoom_session_canonicalization%rowtype;c missionaccounts.zoom_source_corroboration%rowtype;
 new_id uuid;new_mapping uuid;source_session uuid;controls jsonb;changed integer;field text;
begin
 if p_repair_id is null or p_reversal_request_id is null or p_reversal_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' or nullif(btrim(p_actor_id),'') is null or p_posture_sha256 is null or p_posture_sha256 !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='invalid_zoom_reversal_request';end if;
 perform pg_advisory_xact_lock(hashtextextended('missionaccounts:5401R:June8-repair',0));
 select * into receipt from missionaccounts.zoom_5401_repair_receipt r where r.id=p_repair_id for update;
 if not found then raise exception using errcode='23503',message='zoom_repair_not_found';end if;
 if receipt.state='reversed' then
  if receipt.reversal_request_id<>p_reversal_request_id or receipt.reversal_actor_id<>p_actor_id or receipt.reversal_controls->>'posture_sha256'<>p_posture_sha256 then raise exception using errcode='23505',message='idempotency_key_reuse';end if;
  return receipt.reversal_controls||jsonb_build_object('duplicate',true);
 end if;
 if receipt.state<>'applied' then raise exception using errcode='23514',message='applied_zoom_repair_required';end if;
 perform missionaccounts.zoom_5401_lock_scope(receipt.before_state);
 current_state:=missionaccounts.zoom_5401_snapshot();
 if missionaccounts.zoom_5401_operation_digest(current_state)<>receipt.after_operation_sha256 then raise exception using errcode='23514',message='zoom_reversal_intervening_activity';end if;
 update missionaccounts.zoom_shadow_retirement t set reversed_at=transaction_timestamp(),reversal_request_id=p_reversal_request_id
 where t.evidence->>'repair_id'=p_repair_id::text and t.superseded_by_id is null and t.reversed_at is null;
 get diagnostics changed=row_count;if changed<>76 then raise exception using errcode='23514',message='zoom_reversal_retirement_count_changed';end if;
 update missionaccounts.attendance_day d set superseded_at=(x->>'superseded_at')::timestamptz from jsonb_array_elements(receipt.before_state->'days') x
 where d.id=(x->>'id')::uuid and (receipt.before_state->'active_day_ids') ? d.id::text;
 get diagnostics changed=row_count;if changed<>76 then raise exception using errcode='23514',message='zoom_reversal_day_count_changed';end if;
 for m in select * from missionaccounts.zoom_session_canonicalization t where (receipt.before_state->'api_session_ids') ? t.source_session_id::text and t.superseded_by_id is null order by t.id loop
  new_id:=gen_random_uuid();
  insert into missionaccounts.zoom_session_canonicalization(id,source_session_id,canonical_session_id,disposition,rule_version,evidence,request_id,superseded_by_id)
  values(new_id,m.source_session_id,m.source_session_id,'active','5401r-operational-reversal-v1',jsonb_build_object('repair_id',p_repair_id,'reverses_mapping_id',m.id,'restores_known_pre_repair_state',true),p_reversal_request_id||':session:'||m.source_session_id::text,m.id);
  update missionaccounts.zoom_session_canonicalization set superseded_by_id=new_id where id=m.id and superseded_by_id is null;
  update missionaccounts.zoom_session_canonicalization set superseded_by_id=null where id=new_id;
 end loop;
 update missionaccounts.session s set canonical_status=x->>'canonical_status',superseded_by_id=(x->>'superseded_by_id')::uuid from jsonb_array_elements(receipt.before_state->'sessions') x where s.id=(x->>'id')::uuid;
 for c in select * from missionaccounts.zoom_source_corroboration t where (receipt.before_state->'source_row_ids') ? t.source_row_id::text and t.superseded_by_id is null order by t.id loop
  select r.session_id into source_session from missionaccounts.attendance_source_row r where r.id=c.source_row_id;
  select t.id into new_mapping from missionaccounts.zoom_session_canonicalization t where t.source_session_id=source_session and t.superseded_by_id is null;
  new_id:=gen_random_uuid();
  insert into missionaccounts.zoom_source_corroboration(id,source_row_id,canonicalization_id,canonical_session_id,disposition,evidence,request_id,superseded_by_id)
  values(new_id,c.source_row_id,new_mapping,source_session,'unresolved_occurrence',jsonb_build_object('repair_id',p_repair_id,'reverses_corroboration_id',c.id,'operational_reversal',true,'human_identity_decision',false),p_reversal_request_id||':source:'||c.source_row_id::text,c.id);
  update missionaccounts.zoom_source_corroboration set superseded_by_id=new_id where id=c.id and superseded_by_id is null;
  update missionaccounts.zoom_source_corroboration set superseded_by_id=null where id=new_id;
 end loop;
 final_state:=missionaccounts.zoom_5401_snapshot();
 foreach field in array array['students','aliases','events','source_rows','event_source_links','day_event_links','days','sessions','domain_refs'] loop
  if receipt.before_state->field is distinct from final_state->field then raise exception using errcode='23514',message='zoom_reversal_custody_changed:'||field;end if;
 end loop;
 foreach field in array array['historical_sha256','all_raw_sha256','financial_sha256'] loop
  if current_state->field is distinct from final_state->field then raise exception using errcode='23514',message='zoom_reversal_unrelated_state_changed:'||field;end if;
 end loop;
 controls:=jsonb_build_object('accepted',true,'duplicate',false,'repair_id',p_repair_id,'state','reversed','restored_review_days',76,'restored_technical_students',76,'public_containment_required',true,'zoom_pause_required',true,'posture_sha256',p_posture_sha256,'cycle_counts',final_state->'cycle_counts');
 update missionaccounts.zoom_5401_repair_receipt set state='reversed',reversed_at=now(),reversal_request_id=p_reversal_request_id,reversal_actor_id=p_actor_id,reversal_controls=controls where id=p_repair_id;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id) values(p_actor_id,'system','zoom_repair.reversed','Operationally restored the bounded pre-repair projection; all evidence retained',controls,'Verified contained and paused operational rollback',p_reversal_request_id);
 return controls;
end $$;

revoke execute on function missionaccounts.guard_zoom_5401_receipt() from public,anon,authenticated;
grant execute on function missionaccounts.guard_zoom_5401_receipt() to service_role;

revoke execute on function missionaccounts.zoom_5401_snapshot() from public,anon,authenticated;
grant execute on function missionaccounts.zoom_5401_snapshot() to service_role;

revoke execute on function missionaccounts.zoom_5401_digest(jsonb) from public,anon,authenticated;
grant execute on function missionaccounts.zoom_5401_digest(jsonb) to service_role;

revoke execute on function missionaccounts.zoom_5401_operation_digest(jsonb) from public,anon,authenticated;
grant execute on function missionaccounts.zoom_5401_operation_digest(jsonb) to service_role;

revoke execute on function missionaccounts.assert_zoom_5401_preimage(jsonb) from public,anon,authenticated;
grant execute on function missionaccounts.assert_zoom_5401_preimage(jsonb) to service_role;

revoke execute on function missionaccounts.api_preview_zoom_5401() from public,anon,authenticated;
grant execute on function missionaccounts.api_preview_zoom_5401() to service_role;

revoke execute on function missionaccounts.zoom_5401_lock_scope(jsonb) from public,anon,authenticated;
grant execute on function missionaccounts.zoom_5401_lock_scope(jsonb) to service_role;

revoke execute on function missionaccounts.api_repair_zoom_5401(text,text,text) from public,anon,authenticated;
grant execute on function missionaccounts.api_repair_zoom_5401(text,text,text) to service_role;

revoke execute on function missionaccounts.api_reverse_zoom_5401(uuid,text,text,text) from public,anon,authenticated;
grant execute on function missionaccounts.api_reverse_zoom_5401(uuid,text,text,text) to service_role;
