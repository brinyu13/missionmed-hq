-- Authority: DR-292 / DR-293 / DR-294 / MX-MISSIONACCOUNTS-5404E
-- Contract: examprep-business-contract-2026-09-16-v1
-- Contract SHA-256: d57b8d8486f0be0741132d474130dcdbe4e8d600138081a1b4e62e88005d503d
-- Safety: additive, zero-money, no notification, no provider dispatch.
begin;

create table missionaccounts.business_contract_catalog (
  version text primary key check (version='examprep-business-contract-2026-09-16-v1'),
  body_sha256 text not null unique check (body_sha256 ~ '^[0-9a-f]{64}$'), terms jsonb not null,
  active boolean not null default false, registered_at timestamptz not null default now()
);
insert into missionaccounts.business_contract_catalog(version,body_sha256,terms,active) values(
  'examprep-business-contract-2026-09-16-v1','d57b8d8486f0be0741132d474130dcdbe4e8d600138081a1b4e62e88005d503d',
  jsonb_build_object('tutoring_hourly_cents',8500,'planning_30m_cents',5000,'tutoring_ten_pack_cents',80000,
    'live_group_monthly_cents',30000,'live_group_pay_go_day_cents',2500,'daily_drills_addon_cents',1999,
    'daily_drills_standalone_cents',9999,'daily_drills_audio_notes_cents',14999,'private_daily_drills_cents',3999,
    'trial_attended_days',5,'absence_consumes_trial_day',false,'same_day_sessions_count',1,
    'automatic_conversion',false,'automatic_charge',false,'late_fee',false,'max_provider_attempts',2),true);
create unique index business_contract_one_active on missionaccounts.business_contract_catalog(active) where active;

create table missionaccounts.student_live_group_plan_selection (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references missionaccounts.student(id),
  contract_version text not null references missionaccounts.business_contract_catalog(version),
  plan text not null check(plan in('monthly','pay_go')), request_id text not null unique check(request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'), actor_id text not null,
  actor_role text not null check(actor_role='student'), selected_at timestamptz not null default now(),
  superseded_at timestamptz, superseded_by_id uuid references missionaccounts.student_live_group_plan_selection(id)
);
create unique index student_live_group_plan_one_current on missionaccounts.student_live_group_plan_selection(student_id) where superseded_at is null;

create table missionaccounts.student_live_group_grandfathered_plan (
  student_id uuid primary key references missionaccounts.student(id),
  plan text not null check(plan='pay_go'),
  source text not null check(source='pre_5404e_active_billing_consent'),
  captured_at timestamptz not null default now()
);
insert into missionaccounts.student_live_group_grandfathered_plan(student_id,plan,source)
select distinct bc.student_id,'pay_go','pre_5404e_active_billing_consent'
from missionaccounts.billing_consent bc
where bc.superseded_by_id is null and bc.state='authorized'
on conflict(student_id) do nothing;

create table missionaccounts.student_trial_override (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references missionaccounts.student(id), starts_on date not null,
  reason text not null check(length(btrim(reason)) between 3 and 2000), request_id text not null unique check(request_id ~ '^[A-Za-z0-9._:-]{8,200}$'),
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'), actor_id text not null,
  actor_role text not null check(actor_role in('missionaccounts_admin','founder')), granted_at timestamptz not null default now(),
  superseded_at timestamptz, superseded_by_id uuid references missionaccounts.student_trial_override(id)
);
create unique index student_trial_override_one_current on missionaccounts.student_trial_override(student_id) where superseded_at is null;

create table missionaccounts.student_onboarding_launch_state (
  student_id uuid primary key references missionaccounts.student(id), version text not null check(version='examprep-onboarding-intro-2026-09-17-v1'),
  acknowledged_at timestamptz, enforcement_enabled boolean not null default false check(not enforcement_enabled),
  deadline_at timestamptz check(deadline_at is null), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table missionaccounts.student_onboarding_intro_ack (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references missionaccounts.student(id),
  request_id text not null unique check(request_id ~ '^[A-Za-z0-9._:-]{8,200}$'), request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),
  actor_id text not null, actor_role text not null check(actor_role='student'), acknowledged_at timestamptz not null default now()
);
create table missionaccounts.onboarding_email_template_registry (
  version text primary key, subject text not null, html_sha256 text not null check(html_sha256 ~ '^[0-9a-f]{64}$'),
  text_sha256 text not null check(text_sha256 ~ '^[0-9a-f]{64}$'), manifest_sha256 text not null check(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  credential_method text not null check(credential_method='existing-account-or-secure-password-recovery'),
  external_send_authorized boolean not null default false check(not external_send_authorized), registered_at timestamptz not null default now()
);
insert into missionaccounts.onboarding_email_template_registry(version,subject,html_sha256,text_sha256,manifest_sha256,credential_method) values(
 'examprep-onboarding-email-2026-09-17-v1','Your MyMissionMed Account is ready',
 '547a7c40966c0bc02232ec1e30e9fbb18b98c5e761f16a3e5c44d4bb1336850b',
 '926a8815c97fc921fdfd9e9eaaab30785dda2b43af14da8354aeef0e6c55bbda',
 'b1e32a186bc620199c9b239d86216842ccadc0696aa32f17687e7ffae5c590c7','existing-account-or-secure-password-recovery');

create function missionaccounts.assert_canonical_commerce_student(p_student_id uuid) returns void language plpgsql security definer
set search_path=pg_catalog,missionaccounts as $$ declare s missionaccounts.student%rowtype; r record; begin
 select * into s from missionaccounts.student where id=p_student_id;
 if not found then raise exception using errcode='P0002',message='student_not_found'; end if;
 select * into r from missionaccounts.identity_student_resolution where source_student_id=p_student_id;
 if s.identity_state<>'verified' or r.canonical_student_id is distinct from p_student_id or coalesce(r.absorbed,false) or coalesce(r.excluded,false)
 then raise exception using errcode='42501',message='commerce_canonical_identity_required'; end if;
end; $$;

create function missionaccounts.commerce_state_for_student(
 p_student_id uuid,p_existing_plan text default null,p_live_group_eligible boolean default false
) returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts as $$
declare trial_start date; attended_days date[]; used integer; stored_plan text; effective_plan text; selected_at timestamptz;
 existing_pay_go boolean; eligible boolean; source text;
begin
 perform missionaccounts.assert_canonical_commerce_student(p_student_id);
 if p_existing_plan is not null and p_existing_plan not in('monthly','pay_go') then raise exception using errcode='22023',message='commerce_existing_plan_invalid'; end if;
 select starts_on into trial_start from missionaccounts.student_trial_override where student_id=p_student_id and superseded_at is null order by granted_at desc limit 1;
 select coalesce(array_agg(attended_on order by attended_on),'{}'::date[]) into attended_days from(
  select distinct ae.local_day as attended_on from missionaccounts.attendance_event ae join missionaccounts.session sess on sess.id=ae.session_id
  where ae.student_id=p_student_id and ae.interpretation_state='effective' and ae.superseded_by_id is null
   and sess.state='confirmed' and sess.superseded_by_id is null and sess.step in('s1','s23') and (trial_start is null or ae.local_day>=trial_start)
 )d;
 used:=least(cardinality(attended_days),5);
 select plan,p.selected_at into stored_plan,selected_at from missionaccounts.student_live_group_plan_selection p where p.student_id=p_student_id and p.superseded_at is null limit 1;
	select exists(select 1 from missionaccounts.student_live_group_grandfathered_plan g where g.student_id=p_student_id and g.plan='pay_go') into existing_pay_go;
 effective_plan:=coalesce(p_existing_plan,case when existing_pay_go then 'pay_go' end,stored_plan);
 source:=case when p_existing_plan is not null or existing_pay_go then 'existing_active_arrangement' when stored_plan is not null then 'explicit_5404e_selection' end;
 eligible:=p_live_group_eligible or effective_plan is not null;
 return jsonb_build_object(
  'contract',jsonb_build_object('version','examprep-business-contract-2026-09-16-v1','sha256','d57b8d8486f0be0741132d474130dcdbe4e8d600138081a1b4e62e88005d503d',
   'prices',jsonb_build_object('tutoring_hourly',jsonb_build_object('amount_cents',8500,'unit','hour'),'tutoring_planning',jsonb_build_object('amount_cents',5000,'unit','30_minutes'),
    'tutoring_ten_pack',jsonb_build_object('amount_cents',80000,'unit','ten_sessions'),'live_group_monthly',jsonb_build_object('amount_cents',30000,'unit','month_prepaid'),
    'live_group_pay_go',jsonb_build_object('amount_cents',2500,'unit','distinct_attended_billable_day'),'daily_drills_addon',jsonb_build_object('amount_cents',1999,'unit','month'),
    'daily_drills_standalone',jsonb_build_object('amount_cents',9999,'unit','month'),'daily_drills_audio_notes',jsonb_build_object('amount_cents',14999,'unit','month')),
   'trial',jsonb_build_object('attended_day_limit',5,'absences_count',false,'same_day_sessions_count',1,'automatic_conversion',false,'automatic_charge',false),
   'automatic_billing_dispatch',false,'hosted_invoice_sending',false),
  'eligible',eligible,'trial_attended_days',case when eligible then used else 0 end,'trial_days_remaining',case when eligible then greatest(0,5-used) else 5 end,
  'trial_complete',eligible and used=5,'plan_required',eligible and used=5 and effective_plan is null,'selected_plan',effective_plan,'selection_source',source,
  'selection',case when effective_plan is null then null else jsonb_build_object('plan',effective_plan,'selected_at',selected_at,'source',source) end,
  'state',case when not eligible then 'NOT_ELIGIBLE' when effective_plan is not null then upper(effective_plan) when used=5 then 'PLAN_REQUIRED' else 'TRIAL' end,
  'trial_override',case when trial_start is null then null else jsonb_build_object('starts_on',trial_start) end,
  'private_offer',null,'dispatch_enabled',false,'charge_authorized',false);
end; $$;

create function missionaccounts.api_get_student_commerce(p_student_id uuid,p_actor_id text,p_actor_role text,p_existing_plan text default null,p_live_group_eligible boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts as $$ begin
 if p_actor_role<>'student' or p_actor_id<>p_student_id::text then raise exception using errcode='42501',message='commerce_student_subject_mismatch'; end if;
 return missionaccounts.commerce_state_for_student(p_student_id,p_existing_plan,p_live_group_eligible);
end; $$;

create function missionaccounts.api_select_student_commerce_plan(
 p_student_id uuid,p_plan text,p_actor_id text,p_actor_role text,p_request_id text,p_existing_plan text default null,p_live_group_eligible boolean default false
) returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts,extensions as $$
declare prior missionaccounts.student_live_group_plan_selection%rowtype; current_row missionaccounts.student_live_group_plan_selection%rowtype;
 request_hash text; state jsonb; new_id uuid;
begin
 if p_actor_role<>'student' or p_actor_id<>p_student_id::text then raise exception using errcode='42501',message='commerce_student_subject_mismatch'; end if;
 if p_plan not in('monthly','pay_go') or p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then raise exception using errcode='22023',message='commerce_request_invalid'; end if;
 perform missionaccounts.assert_canonical_commerce_student(p_student_id);
 perform 1 from missionaccounts.student where id=p_student_id for update;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('student_id',p_student_id,'plan',p_plan)::text,'UTF8'),'sha256'),'hex');
 select * into prior from missionaccounts.student_live_group_plan_selection where request_id=p_request_id;
 if found then
  if prior.student_id<>p_student_id or prior.plan<>p_plan or prior.request_sha256<>request_hash then raise exception using errcode='23505',message='commerce_idempotency_conflict'; end if;
  return jsonb_build_object('accepted',true,'duplicate',true,'commerce',missionaccounts.commerce_state_for_student(p_student_id,p_existing_plan,p_live_group_eligible),'provider_action',null,'money_moved_cents',0);
 end if;
 state:=missionaccounts.commerce_state_for_student(p_student_id,p_existing_plan,p_live_group_eligible);
 if not coalesce((state->>'eligible')::boolean,false) then raise exception using errcode='42501',message='commerce_live_group_eligibility_required'; end if;
 if state->>'selection_source'='existing_active_arrangement' then raise exception using errcode='55000',message='commerce_existing_arrangement_already_active'; end if;
 if not coalesce((state->>'trial_complete')::boolean,false) then raise exception using errcode='55000',message='commerce_plan_selection_requires_five_attended_trial_days'; end if;
 select * into current_row from missionaccounts.student_live_group_plan_selection where student_id=p_student_id and superseded_at is null for update;
 new_id:=gen_random_uuid();
 if found then update missionaccounts.student_live_group_plan_selection set superseded_at=transaction_timestamp(),superseded_by_id=new_id where id=current_row.id; end if;
	insert into missionaccounts.student_live_group_plan_selection(id,student_id,contract_version,plan,request_id,request_sha256,actor_id,actor_role)
	values(new_id,p_student_id,'examprep-business-contract-2026-09-16-v1',p_plan,p_request_id,request_hash,p_actor_id,p_actor_role);
	if p_plan='monthly' then
	 update missionaccounts.auto_charge_dispatch d set state='held',held_at=transaction_timestamp(),hold_reason='monthly_plan_selected'
	 from missionaccounts.attendance_day ad where d.attendance_day_id=ad.id and ad.student_id=p_student_id and d.state='pending';
	end if;
 insert into missionaccounts.audit_event(actor_id,actor_role,subject_student_id,kind,text,to_val,reason,request_id)
 values(p_actor_id,p_actor_role,p_student_id,'commerce_plan_selected','Student explicitly selected a Live Group Drilling plan',jsonb_build_object('plan',p_plan,'provider_action',null,'money_moved_cents',0),'Explicit post-trial plan choice',p_request_id);
 return jsonb_build_object('accepted',true,'duplicate',false,'commerce',missionaccounts.commerce_state_for_student(p_student_id,p_existing_plan,p_live_group_eligible),'provider_action',null,'money_moved_cents',0);
end; $$;

create function missionaccounts.guard_auto_charge_dispatch_commerce_plan() returns trigger language plpgsql security definer
set search_path=pg_catalog,missionaccounts as $$ declare sid uuid; begin
 select student_id into sid from missionaccounts.attendance_day where id=new.attendance_day_id;
 if exists(select 1 from missionaccounts.student_live_group_grandfathered_plan g where g.student_id=sid and g.plan='pay_go')
    or exists(select 1 from missionaccounts.student_live_group_plan_selection p where p.student_id=sid and p.plan='pay_go' and p.superseded_at is null)
 then return new; end if;
 return null;
end; $$;
create trigger auto_charge_dispatch_requires_pay_go_plan before insert on missionaccounts.auto_charge_dispatch
for each row execute function missionaccounts.guard_auto_charge_dispatch_commerce_plan();

create function missionaccounts.api_grant_student_trial_override(p_student_id uuid,p_starts_on date,p_reason text,p_actor_id text,p_actor_role text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts,extensions as $$
declare prior missionaccounts.student_trial_override%rowtype; current_row missionaccounts.student_trial_override%rowtype; request_hash text; new_id uuid;
begin
 if p_actor_role not in('missionaccounts_admin','founder') or p_actor_id is null then raise exception using errcode='42501',message='trial_override_admin_required'; end if;
 if p_starts_on is null or length(btrim(coalesce(p_reason,''))) not between 3 and 2000 or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then raise exception using errcode='22023',message='trial_override_invalid'; end if;
 perform missionaccounts.assert_canonical_commerce_student(p_student_id); perform 1 from missionaccounts.student where id=p_student_id for update;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('student_id',p_student_id,'starts_on',p_starts_on,'reason',btrim(p_reason))::text,'UTF8'),'sha256'),'hex');
 select * into prior from missionaccounts.student_trial_override where request_id=p_request_id;
 if found then
  if prior.student_id<>p_student_id or prior.starts_on<>p_starts_on or prior.request_sha256<>request_hash then raise exception using errcode='23505',message='trial_override_idempotency_conflict'; end if;
  return jsonb_build_object('accepted',true,'duplicate',true,'trial_override',jsonb_build_object('starts_on',prior.starts_on,'granted_at',prior.granted_at),'provider_action',null,'money_moved_cents',0);
 end if;
 select * into current_row from missionaccounts.student_trial_override where student_id=p_student_id and superseded_at is null for update;
 new_id:=gen_random_uuid(); if found then update missionaccounts.student_trial_override set superseded_at=transaction_timestamp(),superseded_by_id=new_id where id=current_row.id; end if;
 insert into missionaccounts.student_trial_override(id,student_id,starts_on,reason,request_id,request_sha256,actor_id,actor_role)
 values(new_id,p_student_id,p_starts_on,btrim(p_reason),p_request_id,request_hash,p_actor_id,p_actor_role);
 insert into missionaccounts.audit_event(actor_id,actor_role,subject_student_id,kind,text,to_val,reason,request_id)
 values(p_actor_id,p_actor_role,p_student_id,'commerce_trial_override_granted','Dr J granted a documented repeat five-day attended-class trial',jsonb_build_object('starts_on',p_starts_on,'provider_action',null,'money_moved_cents',0),btrim(p_reason),p_request_id);
 return jsonb_build_object('accepted',true,'duplicate',false,'trial_override',jsonb_build_object('starts_on',p_starts_on,'granted_at',transaction_timestamp()),'commerce',missionaccounts.commerce_state_for_student(p_student_id,null,true),'provider_action',null,'money_moved_cents',0);
end; $$;

create function missionaccounts.onboarding_launch_state_for_student(p_student_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts as $$
declare launch missionaccounts.student_onboarding_launch_state%rowtype; onboarding jsonb; begin
 perform missionaccounts.assert_canonical_commerce_student(p_student_id); onboarding:=missionaccounts.onboarding_state_for_student(p_student_id);
 select * into launch from missionaccounts.student_onboarding_launch_state where student_id=p_student_id;
 return jsonb_build_object('version','examprep-onboarding-intro-2026-09-17-v1','intro_required',(onboarding->>'status')<>'COMPLETE' and launch.acknowledged_at is null,
  'acknowledged_at',launch.acknowledged_at,'onboarding_complete',(onboarding->>'status')='COMPLETE','enforcement_enabled',false,'deadline_at',null,'notification_sent',false);
end; $$;
create function missionaccounts.api_get_student_onboarding_launch(p_student_id uuid,p_actor_id text,p_actor_role text) returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts as $$ begin
 if p_actor_role<>'student' or p_actor_id<>p_student_id::text then raise exception using errcode='42501',message='onboarding_student_subject_mismatch'; end if;
 return missionaccounts.onboarding_launch_state_for_student(p_student_id); end; $$;
create function missionaccounts.api_acknowledge_student_onboarding_intro(p_student_id uuid,p_actor_id text,p_actor_role text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,missionaccounts,extensions as $$
declare prior missionaccounts.student_onboarding_intro_ack%rowtype; request_hash text; begin
 if p_actor_role<>'student' or p_actor_id<>p_student_id::text or p_request_id !~ '^[A-Za-z0-9._:-]{8,200}$' then raise exception using errcode='42501',message='onboarding_student_subject_mismatch'; end if;
 perform missionaccounts.assert_canonical_commerce_student(p_student_id); perform 1 from missionaccounts.student where id=p_student_id for update;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('student_id',p_student_id,'version','examprep-onboarding-intro-2026-09-17-v1')::text,'UTF8'),'sha256'),'hex');
 select * into prior from missionaccounts.student_onboarding_intro_ack where request_id=p_request_id;
 if found then
  if prior.student_id<>p_student_id or prior.request_sha256<>request_hash then raise exception using errcode='23505',message='onboarding_idempotency_conflict'; end if;
  return jsonb_build_object('accepted',true,'duplicate',true,'onboarding_launch',missionaccounts.onboarding_launch_state_for_student(p_student_id),'notification_sent',false,'money_moved_cents',0);
 end if;
 insert into missionaccounts.student_onboarding_intro_ack(student_id,request_id,request_sha256,actor_id,actor_role) values(p_student_id,p_request_id,request_hash,p_actor_id,p_actor_role);
 insert into missionaccounts.student_onboarding_launch_state(student_id,version,acknowledged_at) values(p_student_id,'examprep-onboarding-intro-2026-09-17-v1',transaction_timestamp())
 on conflict(student_id) do update set acknowledged_at=coalesce(missionaccounts.student_onboarding_launch_state.acknowledged_at,excluded.acknowledged_at),updated_at=transaction_timestamp();
 insert into missionaccounts.audit_event(actor_id,actor_role,subject_student_id,kind,text,to_val,reason,request_id)
 values(p_actor_id,p_actor_role,p_student_id,'onboarding_intro_acknowledged','Student acknowledged the first-login onboarding introduction',jsonb_build_object('notification_sent',false,'money_moved_cents',0),'Continue to onboarding checklist',p_request_id);
 return jsonb_build_object('accepted',true,'duplicate',false,'onboarding_launch',missionaccounts.onboarding_launch_state_for_student(p_student_id),'notification_sent',false,'money_moved_cents',0);
end; $$;

do $$ declare n text; begin foreach n in array array['business_contract_catalog','student_live_group_plan_selection','student_live_group_grandfathered_plan','student_trial_override','student_onboarding_launch_state','student_onboarding_intro_ack','onboarding_email_template_registry'] loop
 execute format('alter table missionaccounts.%I enable row level security',n); execute format('revoke all on missionaccounts.%I from public,anon,authenticated',n); execute format('grant all on missionaccounts.%I to service_role',n); end loop; end $$;

revoke all on function missionaccounts.assert_canonical_commerce_student(uuid) from public,anon,authenticated;
revoke all on function missionaccounts.commerce_state_for_student(uuid,text,boolean) from public,anon,authenticated;
revoke all on function missionaccounts.api_get_student_commerce(uuid,text,text,text,boolean) from public,anon,authenticated;
revoke all on function missionaccounts.api_select_student_commerce_plan(uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function missionaccounts.api_grant_student_trial_override(uuid,date,text,text,text,text) from public,anon,authenticated;
revoke all on function missionaccounts.guard_auto_charge_dispatch_commerce_plan() from public,anon,authenticated;
revoke all on function missionaccounts.onboarding_launch_state_for_student(uuid) from public,anon,authenticated;
revoke all on function missionaccounts.api_get_student_onboarding_launch(uuid,text,text) from public,anon,authenticated;
revoke all on function missionaccounts.api_acknowledge_student_onboarding_intro(uuid,text,text,text) from public,anon,authenticated;
grant execute on function missionaccounts.api_get_student_commerce(uuid,text,text,text,boolean) to service_role;
grant execute on function missionaccounts.api_select_student_commerce_plan(uuid,text,text,text,text,text,boolean) to service_role;
grant execute on function missionaccounts.api_grant_student_trial_override(uuid,date,text,text,text,text) to service_role;
grant execute on function missionaccounts.api_get_student_onboarding_launch(uuid,text,text) to service_role;
grant execute on function missionaccounts.api_acknowledge_student_onboarding_intro(uuid,text,text,text) to service_role;
comment on table missionaccounts.onboarding_email_template_registry is 'Exact zero-send onboarding template registration. External delivery requires separate exact recipient and provider authority.';
comment on function missionaccounts.api_select_student_commerce_plan(uuid,text,text,text,text,text,boolean) is 'Records explicit plan choice after five distinct attended qualifying class days. Creates no invoice, PaymentIntent, notification, entitlement or charge.';
commit;
