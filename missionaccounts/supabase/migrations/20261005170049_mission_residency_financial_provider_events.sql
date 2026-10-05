-- DR-387 source only. Empty provider binding means webhooks fail closed until separately released.
begin;
create table missionaccounts.financial_provider_binding (
 actor_id uuid primary key, actor_name text not null unique references missionaccounts.financial_principal(actor_id),
 authority_ref text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$')
);
alter table missionaccounts.financial_provider_binding enable row level security;
alter table missionaccounts.financial_provider_binding force row level security;
revoke all on missionaccounts.financial_provider_binding from public,anon,authenticated,service_role;
create trigger financial_provider_binding_immutable before update or delete on missionaccounts.financial_provider_binding for each row execute function missionaccounts.reject_immutable_change();
create function missionaccounts.financial_provider_actor(p_actor text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare a uuid;
begin
 perform missionaccounts.financial_require_principal(p_actor,'settle');
 select actor_id into strict a from missionaccounts.financial_provider_binding where actor_name=p_actor;
 return a;
end $$;
create or replace function missionaccounts.financial_actor_subject(p_principal uuid,p_wp_user_id bigint,p_subject text)
returns void language plpgsql security definer set search_path='' as $$
declare name text;
begin
 if p_wp_user_id=0 then
  select actor_name into strict name from missionaccounts.financial_provider_binding where actor_id=p_principal;
  perform missionaccounts.financial_require_principal(name,'settle');
 elsif p_wp_user_id=1 then perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 elsif missionaccounts.financial_own_subject(p_principal,p_wp_user_id)<>p_subject then raise exception 'Own financial account required' using errcode='42501';end if;
end $$;
create or replace function missionaccounts.financial_append_operation(p_actor uuid,p_wp bigint,p_subject text,p_operation text,p_before jsonb,p_after jsonb,p_request text,p_authority text,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;
begin
 insert into missionaccounts.financial_operating_event(subject_key,actor_id,actor_wp_user_id,operation,before_state,after_state,request_id,request_digest,authority_ref,evidence_sha256)
 values(p_subject,p_actor,p_wp,p_operation,p_before,p_after,p_request,p_digest,p_authority,p_digest) returning id into e;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
 values(p_actor::text,case when p_wp=0 then 'provider' when p_wp=1 then 'founder' else 'student' end,'mr_financial_operation',p_operation,p_before,p_after,p_authority,p_request);
 return e;
end $$;
create function missionaccounts.api_financial_provider_context(p_actor text,p_kind text,p_reference text,p_request_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; a missionaccounts.financial_card_attempt; s missionaccounts.financial_card_setup; b missionaccounts.financial_card_binding;
begin
 actor:=missionaccounts.financial_provider_actor(p_actor);
 if p_kind='payment' then
  select * into strict a from missionaccounts.financial_card_attempt where id=p_request_id::uuid;
  if a.intent_ref is not null and a.intent_ref<>p_reference then raise exception 'Provider reference conflict';end if;
  select * into strict b from missionaccounts.financial_card_binding where subject_key=a.subject_key;
  return jsonb_build_object('principal',actor,'wp_user_id',0,'attempt_id',a.id,'subject_key',a.subject_key);
 elsif p_kind='setup' then
  select * into strict s from missionaccounts.financial_card_setup where request_id=p_request_id and intent_ref=p_reference;
  select * into strict b from missionaccounts.financial_card_binding where subject_key=s.subject_key;
  if not exists(select 1 from missionaccounts.financial_operating_gate g where g.id=1 and g.stripe_account=b.provider_account) then raise exception 'Provider account conflict';end if;
  return jsonb_build_object('principal',actor,'wp_user_id',0,'subject_key',s.subject_key,'customer_ref',b.customer_ref,'request_id',s.request_id,'intent_ref',s.intent_ref);
 end if;
 raise exception 'Unsupported provider context';
end $$;
create or replace function missionaccounts.api_financial_confirm_setup(p_principal uuid,p_wp_user_id bigint,p_request_id text,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; s missionaccounts.financial_card_setup; m missionaccounts.financial_card_method; dg text; name text;
begin
 if p_wp_user_id=0 then
  select actor_name into strict name from missionaccounts.financial_provider_binding where actor_id=p_principal;
  c:=missionaccounts.api_financial_provider_context(name,'setup',p_proof->>'intent_ref',p_request_id);
  c:=c||jsonb_build_object('provider_account',(select provider_account from missionaccounts.financial_card_binding where subject_key=c->>'subject_key'),
   'binding',jsonb_build_object('customer_ref',c->>'customer_ref'));
 else c:=missionaccounts.api_financial_setup_context(p_principal,p_wp_user_id,p_request_id);end if;
 select * into strict s from missionaccounts.financial_card_setup where request_id=p_request_id for update;
 if s.subject_key is distinct from c->>'subject_key' or s.intent_ref is distinct from p_proof->>'intent_ref' or p_proof->>'provider_account' is distinct from c->>'provider_account' or p_proof->>'customer_ref' is distinct from c->'binding'->>'customer_ref' then raise exception 'Setup proof owner conflict';end if;
 select * into m from missionaccounts.financial_card_method where setup_id=s.id;
 if found then if m.provider_pm_ref is distinct from p_proof->>'payment_method_ref' then raise exception 'Saved method replay conflict';end if;return jsonb_build_object('id',m.id,'duplicate',true);end if;
 insert into missionaccounts.financial_card_method(subject_key,setup_id,provider_pm_ref,brand,last4,exp_month,exp_year)
 values(s.subject_key,s.id,p_proof->>'payment_method_ref',p_proof->>'brand',p_proof->>'last4',(p_proof->>'exp_month')::integer,(p_proof->>'exp_year')::integer) returning * into m;
 dg:=encode(extensions.digest(p_proof::text,'sha256'),'hex');
 perform missionaccounts.financial_append_operation(p_principal,p_wp_user_id,s.subject_key,'PAYMENT_METHOD_VERIFIED','{}',jsonb_build_object('method_id',m.id,'last4',m.last4),p_request_id||':verified','DR-387:STRIPE_SETUP',dg);
 return jsonb_build_object('id',m.id,'duplicate',false);
end $$;
revoke execute on function missionaccounts.financial_provider_actor(text) from public,anon,authenticated,service_role;
revoke execute on function missionaccounts.api_financial_provider_context(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function missionaccounts.api_financial_provider_context(text,text,text,text) to service_role;
commit;
