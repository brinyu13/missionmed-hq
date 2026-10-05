-- DR-387 source-only adapters. No grants to a new settlement principal or release activation.
begin;
alter table missionaccounts.financial_operating_gate add column stripe_account text check(stripe_account ~ '^acct_[A-Za-z0-9]+$');
alter table missionaccounts.financial_operating_gate add column charge_terms_version text;
alter table missionaccounts.financial_card_attempt add column transition_no bigint not null default 0;
create unique index financial_one_reserved_card_request on missionaccounts.financial_card_attempt(request_id)
 where state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED','SUCCEEDED');
create function missionaccounts.financial_actor_subject(p_principal uuid,p_wp_user_id bigint,p_subject text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_wp_user_id=1 then perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 elsif missionaccounts.financial_own_subject(p_principal,p_wp_user_id)<>p_subject then raise exception 'Own financial account required' using errcode='42501';end if;
end $$;
create function missionaccounts.financial_append_operation(p_actor uuid,p_wp bigint,p_subject text,p_operation text,p_before jsonb,p_after jsonb,p_request text,p_authority text,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;
begin
 insert into missionaccounts.financial_operating_event(subject_key,actor_id,actor_wp_user_id,operation,before_state,after_state,request_id,request_digest,authority_ref,evidence_sha256)
 values(p_subject,p_actor,p_wp,p_operation,p_before,p_after,p_request,p_digest,p_authority,p_digest) returning id into e;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,from_val,to_val,reason,request_id)
 values(p_actor::text,case when p_wp=1 then 'founder' else 'student' end,'mr_financial_operation',p_operation,p_before,p_after,p_authority,p_request);
 return e;
end $$;
create function missionaccounts.api_financial_setup_context(p_principal uuid,p_wp_user_id bigint,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; b missionaccounts.financial_card_binding; s missionaccounts.financial_card_setup; g missionaccounts.financial_operating_gate; snap jsonb; reservation missionaccounts.financial_operating_event; dg text;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);select * into strict g from missionaccounts.financial_operating_gate where id=1;
 if g.stripe_account is null then raise exception 'Mission Residency provider is not approved';end if;
 snap:=missionaccounts.financial_operating_snapshot(k);
 if (snap->'eligibility'->>'card_required')::boolean is distinct from true or (snap->'profile'->>'save_method_acknowledged')::boolean is distinct from true then raise exception 'Payment setup eligibility and acknowledgment required';end if;
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,160}$' then raise exception 'Stable setup identity required';end if;
 perform 1 from missionaccounts.financial_subject where subject_key=k for update;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_request_id)::text,'sha256'),'hex');
 select * into reservation from missionaccounts.financial_operating_event where request_id=p_request_id||':reserved';
 if found then if reservation.subject_key<>k or reservation.request_digest<>dg or reservation.operation<>'PAYMENT_SETUP_RESERVED' then raise exception 'Setup reservation replay conflict';end if;
 else
  perform missionaccounts.financial_append_operation(p_principal,p_wp_user_id,k,'PAYMENT_SETUP_RESERVED','{}','{}',p_request_id||':reserved','DR-387:OWN_SETUP',dg);
  select * into strict reservation from missionaccounts.financial_operating_event where request_id=p_request_id||':reserved';
 end if;
 select * into b from missionaccounts.financial_card_binding where subject_key=k;
 if b.subject_key is not null and b.provider_account<>g.stripe_account then raise exception 'Payment provider account conflict';end if;
 select * into s from missionaccounts.financial_card_setup where request_id=p_request_id;
 if s.id is not null and s.subject_key<>k then raise exception 'Setup identity owner conflict';end if;
 return jsonb_build_object('subject_key',k,'provider_account',g.stripe_account,'binding',to_jsonb(b),'setup',to_jsonb(s),'reserved_at',reservation.created_at);
end $$;
create function missionaccounts.api_financial_register_setup(p_principal uuid,p_wp_user_id bigint,p_request_id text,p_account text,p_customer text,p_intent text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; k text; b missionaccounts.financial_card_binding; s missionaccounts.financial_card_setup; dg text;
begin
 c:=missionaccounts.api_financial_setup_context(p_principal,p_wp_user_id,p_request_id);k:=c->>'subject_key';
 perform 1 from missionaccounts.financial_subject where subject_key=k for update;
 if p_account<>c->>'provider_account' then raise exception 'Provider account mismatch';end if;
 select * into b from missionaccounts.financial_card_binding where subject_key=k;
 if found then if b.provider_account<>p_account or b.customer_ref<>p_customer then raise exception 'Customer binding conflict';end if;
 else insert into missionaccounts.financial_card_binding(subject_key,provider_account,customer_ref) values(k,p_account,p_customer);end if;
 select * into s from missionaccounts.financial_card_setup where request_id=p_request_id;
 if found then if s.subject_key<>k or s.intent_ref<>p_intent then raise exception 'Setup replay conflict';end if;return jsonb_build_object('id',s.id,'duplicate',true);end if;
 insert into missionaccounts.financial_card_setup(subject_key,request_id,intent_ref) values(k,p_request_id,p_intent) returning * into s;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_account,p_customer,p_intent)::text,'sha256'),'hex');
 perform missionaccounts.financial_append_operation(p_principal,p_wp_user_id,k,'PAYMENT_SETUP_STARTED','{}',jsonb_build_object('setup_id',s.id),p_request_id||':registered','DR-387:OWN_SETUP',dg);
 return jsonb_build_object('id',s.id,'duplicate',false);
end $$;
create function missionaccounts.api_financial_confirm_setup(p_principal uuid,p_wp_user_id bigint,p_request_id text,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; s missionaccounts.financial_card_setup; m missionaccounts.financial_card_method; dg text;
begin
 c:=missionaccounts.api_financial_setup_context(p_principal,p_wp_user_id,p_request_id);
 select * into strict s from missionaccounts.financial_card_setup where request_id=p_request_id for update;
 if s.subject_key<>c->>'subject_key' or s.intent_ref<>p_proof->>'intent_ref' or p_proof->>'provider_account'<>c->>'provider_account' or p_proof->>'customer_ref'<>c->'binding'->>'customer_ref' then raise exception 'Setup proof owner conflict';end if;
 select * into m from missionaccounts.financial_card_method where setup_id=s.id;
 if found then if m.provider_pm_ref<>p_proof->>'payment_method_ref' then raise exception 'Saved method replay conflict';end if;return jsonb_build_object('id',m.id,'duplicate',true);end if;
 insert into missionaccounts.financial_card_method(subject_key,setup_id,provider_pm_ref,brand,last4,exp_month,exp_year)
 values(s.subject_key,s.id,p_proof->>'payment_method_ref',p_proof->>'brand',p_proof->>'last4',(p_proof->>'exp_month')::integer,(p_proof->>'exp_year')::integer) returning * into m;
 dg:=encode(extensions.digest(p_proof::text,'sha256'),'hex');
 perform missionaccounts.financial_append_operation(p_principal,p_wp_user_id,s.subject_key,'PAYMENT_METHOD_VERIFIED','{}',jsonb_build_object('method_id',m.id,'last4',m.last4),p_request_id||':verified','DR-387:STRIPE_SETUP',dg);
 return jsonb_build_object('id',m.id,'duplicate',false);
end $$;
-- Shared lock order is subject -> agreement -> request. Reservations persist on ambiguous/declined results.
-- A declined intent must be provider-cancelled before its reservation can be released.
create function missionaccounts.financial_payable_request(p_id uuid,p_method text)
returns missionaccounts.financial_payment_request language plpgsql security definer set search_path='' as $$
declare r missionaccounts.financial_payment_request; o missionaccounts.financial_obligation_state; s missionaccounts.financial_subject; st text;
begin
 select * into strict r from missionaccounts.financial_payment_request where id=p_id;
 select * into strict s from missionaccounts.financial_subject where subject_key=r.subject_key for update;
 perform 1 from missionaccounts.financial_agreement where subject_key=s.subject_key for update;
 select * into strict r from missionaccounts.financial_payment_request where id=p_id for update;
 if s.certification_state<>'CERTIFIED' or not(p_method=any(r.methods)) or r.expires_at<=now() then raise exception 'Request is not payable';end if;
 select x.state into st from missionaccounts.financial_request_result x join missionaccounts.financial_operating_event e on e.id=x.event_id where x.request_id=r.id order by e.sequence_no desc limit 1;
 if st is not null then raise exception 'Request is not open';end if;
 select * into strict o from missionaccounts.financial_obligation_state where id=r.obligation_id;
 if r.amount_cents>o.remaining_cents then raise exception 'Payment exceeds certified remaining obligation';end if;
 if r.installment_id is not null and not exists(select 1 from missionaccounts.financial_active_schedule i join missionaccounts.financial_schedule_revision v on v.id=i.revision_id where i.id=r.installment_id and i.remaining_cents>=r.amount_cents and not exists(select 1 from missionaccounts.financial_schedule_revision n where n.supersedes=v.id)) then raise exception 'Payment schedule is superseded or exhausted';end if;
 if r.installment_id is null and r.amount_cents>o.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=o.id) then raise exception 'Payment must identify its active scheduled installment';end if;
 return r;
end $$;
create function missionaccounts.api_financial_authorize_charge(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_method uuid,p_terms text,p_request_id text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; r missionaccounts.financial_payment_request; m missionaccounts.financial_card_method; a missionaccounts.financial_specific_authorization; e uuid; dg text; v text;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);
 if p_confirmed is distinct from true or p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' then raise exception 'Explicit specific charge authorization required';end if;
 r:=missionaccounts.financial_payable_request(p_request,'CARD');
 if r.subject_key<>k then raise exception 'Own payment request required' using errcode='42501';end if;
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and student_publication) then raise exception 'Specific charge authorization is not released' using errcode='42501';end if;
 select charge_terms_version into v from missionaccounts.financial_operating_gate where id=1;
 if v is null or v is distinct from p_terms then raise exception 'Approved current charge terms required';end if;
 select * into strict m from missionaccounts.financial_card_method where id=p_method and subject_key=k;
 if make_date(m.exp_year,m.exp_month,1)+interval '1 month'<=current_date then raise exception 'A current saved payment method is required';end if;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_request,p_method,r.amount_cents,p_terms)::text,'sha256'),'hex');
 select a2.* into a from missionaccounts.financial_specific_authorization a2 join missionaccounts.financial_operating_event e2 on e2.id=a2.event_id where e2.request_id=p_request_id;
 if found then if (select request_digest from missionaccounts.financial_operating_event where id=a.event_id)<>dg then raise exception 'Charge consent replay conflict';end if;return jsonb_build_object('id',a.id,'duplicate',true);end if;
 e:=missionaccounts.financial_append_operation(p_principal,p_wp_user_id,k,'AUTHORIZE_SPECIFIC_CHARGE','{}',jsonb_build_object('request_id',r.id,'amount_cents',r.amount_cents,'method_id',m.id,'terms_version',v),p_request_id,'DR-387:SPECIFIC_CHARGE',dg);
 insert into missionaccounts.financial_specific_authorization(request_id,subject_key,method_id,amount_cents,terms_version,event_id,expires_at)
 values(r.id,k,m.id,r.amount_cents,v,e,clock_timestamp()+interval '30 days') returning * into a;
 return jsonb_build_object('id',a.id,'duplicate',false);
end $$;
create function missionaccounts.api_financial_prepare_card(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_request_id text,p_account text,p_authorization uuid,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r missionaccounts.financial_payment_request; a missionaccounts.financial_card_attempt; b missionaccounts.financial_card_binding; c missionaccounts.financial_specific_authorization; m missionaccounts.financial_card_method; reserved bigint; residual bigint; dg text; e uuid;
begin
 if p_wp_user_id<=0 then raise exception 'A signed student or Founder initiator is required' using errcode='42501';end if;
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' or p_confirmed is distinct from true then raise exception 'Confirmed stable payment request required';end if;
 select * into strict r from missionaccounts.financial_payment_request where id=p_request;
 perform missionaccounts.financial_actor_subject(p_principal,p_wp_user_id,r.subject_key);
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and card_dispatch and stripe_account=p_account) then raise exception 'Card dispatch is disabled' using errcode='42501';end if;
 if p_wp_user_id<>1 and not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and student_publication) then raise exception 'Student financial publication disabled' using errcode='42501';end if;
 dg:=encode(extensions.digest(jsonb_build_array(p_principal,p_wp_user_id,p_request,p_account,p_authorization)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('mr-card-attempt:'||p_request_id,0));
 select * into a from missionaccounts.financial_card_attempt where request_identity=p_request_id;
 if found then if a.request_digest<>dg then raise exception 'Card attempt identity conflict';end if;
  if a.intent_ref is null then
   r:=missionaccounts.financial_payable_request(p_request,'CARD');
   if a.authorization_id is not null and not exists(select 1 from missionaccounts.financial_specific_authorization c2 join missionaccounts.financial_operating_gate g2 on g2.id=1 where c2.id=a.authorization_id and c2.expires_at>now() and c2.terms_version=g2.charge_terms_version and exists(select 1 from missionaccounts.financial_card_method m2 where m2.id=c2.method_id and make_date(m2.exp_year,m2.exp_month,1)+interval '1 month'>current_date)) then raise exception 'Specific charge authorization expired';end if;
   select remaining_cents into strict residual from missionaccounts.financial_obligation_state where id=r.obligation_id;
   select coalesce(sum(x.amount_cents),0) into reserved from missionaccounts.financial_card_attempt x join missionaccounts.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and x.id<>a.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED');
   if a.amount_cents+reserved>residual then raise exception 'Reserved payment no longer collectible';end if;
   if r.installment_id is null and a.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts.financial_card_attempt x join missionaccounts.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and q.installment_id is null and x.id<>a.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>residual-(select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=r.obligation_id) then raise exception 'Unscheduled residual is reserved by another payment';end if;
   if r.installment_id is not null and a.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts.financial_card_attempt x join missionaccounts.financial_payment_request q on q.id=x.request_id where q.installment_id=r.installment_id and x.id<>a.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>(select remaining_cents from missionaccounts.financial_active_schedule where id=r.installment_id) then raise exception 'Installment is reserved by another payment';end if;
  end if;
  select * into strict b from missionaccounts.financial_card_binding where subject_key=a.subject_key;
  select * into m from missionaccounts.financial_card_method where id=(select method_id from missionaccounts.financial_specific_authorization where id=a.authorization_id);
  return to_jsonb(a)||jsonb_build_object('customer_ref',b.customer_ref,'payment_method_ref',m.provider_pm_ref,'duplicate',true);end if;
 r:=missionaccounts.financial_payable_request(p_request,'CARD');
 select coalesce(sum(x.amount_cents),0) into reserved from missionaccounts.financial_card_attempt x join missionaccounts.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED');
 select remaining_cents into strict residual from missionaccounts.financial_obligation_state where id=r.obligation_id;
 if r.amount_cents+reserved>residual then raise exception 'Remaining obligation is reserved by another payment attempt';end if;
 if r.installment_id is null and r.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts.financial_card_attempt x join missionaccounts.financial_payment_request q on q.id=x.request_id where q.obligation_id=r.obligation_id and q.installment_id is null and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>residual-(select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=r.obligation_id) then raise exception 'Unscheduled residual is reserved by another payment';end if;
 if r.installment_id is not null and r.amount_cents+(select coalesce(sum(x.amount_cents),0) from missionaccounts.financial_card_attempt x join missionaccounts.financial_payment_request q on q.id=x.request_id where q.installment_id=r.installment_id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))>(select remaining_cents from missionaccounts.financial_active_schedule where id=r.installment_id) then raise exception 'Installment is reserved by another payment';end if;
 select * into strict b from missionaccounts.financial_card_binding where subject_key=r.subject_key and provider_account=p_account;
 if p_wp_user_id=1 then
  select * into strict c from missionaccounts.financial_specific_authorization where id=p_authorization and request_id=r.id and subject_key=r.subject_key and amount_cents=r.amount_cents and expires_at>now();
  if c.terms_version is distinct from (select charge_terms_version from missionaccounts.financial_operating_gate where id=1) then raise exception 'Charge authorization terms expired';end if;
  select * into strict m from missionaccounts.financial_card_method where id=c.method_id and subject_key=r.subject_key;
  if make_date(m.exp_year,m.exp_month,1)+interval '1 month'<=current_date then raise exception 'Authorized saved card has expired';end if;
 elsif p_authorization is not null then raise exception 'Student pay-now cannot use Founder charge authority';end if;
 insert into missionaccounts.financial_card_attempt(request_id,subject_key,amount_cents,provider_account,state,request_identity,request_digest,actor_id,authorization_id)
 values(r.id,r.subject_key,r.amount_cents,p_account,'PREPARED',p_request_id,dg,p_principal,p_authorization) returning * into a;
 e:=missionaccounts.financial_append_operation(p_principal,p_wp_user_id,r.subject_key,'CARD_ATTEMPT_PREPARED','{}',jsonb_build_object('attempt_id',a.id,'request_id',r.id,'amount_cents',r.amount_cents),p_request_id||':prepared','DR-387:CARD_REQUEST',dg);
 return to_jsonb(a)||jsonb_build_object('customer_ref',b.customer_ref,'payment_method_ref',m.provider_pm_ref,'duplicate',false);
end $$;
create function missionaccounts.api_financial_card_result(p_principal uuid,p_wp_user_id bigint,p_attempt uuid,p_intent text,p_state text,p_payment jsonb,p_settlement_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a missionaccounts.financial_card_attempt; r missionaccounts.financial_payment_request; g missionaccounts.financial_agreement; o missionaccounts.financial_obligation; paid jsonb; application uuid; ev uuid; dg text; artifact uuid; receipt_sha text;
begin
 select * into strict a from missionaccounts.financial_card_attempt where id=p_attempt;
 perform missionaccounts.financial_actor_subject(p_principal,p_wp_user_id,a.subject_key);
 perform 1 from missionaccounts.financial_subject where subject_key=a.subject_key for update;
 select * into strict g from missionaccounts.financial_agreement where subject_key=a.subject_key for update;
 select * into strict a from missionaccounts.financial_card_attempt where id=p_attempt for update;
 -- An authenticated beneficiary may complete SCA/reconcile a Founder-initiated attempt.
 -- The service verifies the exact existing provider intent and authorized method before settlement.
 if p_state not in ('SUBMITTED','REQUIRES_ACTION','DECLINED','AMBIGUOUS','SUCCEEDED','CANCELLED') or p_intent is null and p_state<>'AMBIGUOUS' then raise exception 'Invalid provider result';end if;
 if a.intent_ref is not null and a.intent_ref is distinct from p_intent then raise exception 'PaymentIntent replay conflict';end if;
 if a.state='SUCCEEDED' then return jsonb_build_object('state','SUCCEEDED','payment_id',a.payment_id,'duplicate',true);end if;
 if a.state='CANCELLED' then return jsonb_build_object('state','CANCELLED','duplicate',true);end if;
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and stripe_account=a.provider_account) then raise exception 'Provider account conflict';end if;
 select * into strict r from missionaccounts.financial_payment_request where id=a.request_id;
 select * into strict o from missionaccounts.financial_obligation where id=r.obligation_id;
 dg:=encode(extensions.digest(jsonb_build_array(p_attempt,p_intent,p_state,p_payment)::text,'sha256'),'hex');
 if p_state='SUCCEEDED' then
  if p_payment->>'provider' is distinct from 'Stripe' or p_payment->>'provider_account' is distinct from a.provider_account or p_payment->>'provider_identity' is distinct from p_intent or p_payment->>'subject_key' is distinct from a.subject_key or (p_payment->>'gross_cents')::bigint is distinct from a.amount_cents then raise exception 'Verified receipt owner or amount conflict';end if;
  receipt_sha:=encode(extensions.digest(p_payment::text,'sha256'),'hex');
  insert into missionaccounts.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
   values('mr_stripe_receipt','stripe:'||a.provider_account||':'||p_intent,receipt_sha,octet_length(p_payment::text),clock_timestamp()) returning id into artifact;
  paid:=missionaccounts.api_record_verified_financial_payment(p_settlement_actor,p_payment||jsonb_build_object('artifact_id',artifact,'agreement_version',g.version,'applications',jsonb_build_array(jsonb_build_object('obligation_key',o.obligation_key,'component',o.component,'amount_cents',a.amount_cents))));
  if r.installment_id is not null then
   select id into strict application from missionaccounts.financial_payment_application where payment_id=(paid->>'payment_id')::uuid and obligation_id=o.id;
   insert into missionaccounts.financial_schedule_application values(r.installment_id,application,a.amount_cents);
  end if;
  ev:=missionaccounts.financial_append_operation(p_principal,p_wp_user_id,a.subject_key,'CARD_PAYMENT_SETTLED',jsonb_build_object('state',a.state),jsonb_build_object('state',p_state,'payment_id',paid->>'payment_id','amount_cents',a.amount_cents),a.request_identity||':settled','DR-387:STRIPE_VERIFIED',dg);
  insert into missionaccounts.financial_request_result values(r.id,ev,'SETTLED',(paid->>'payment_id')::uuid);
 else
  if a.intent_ref is not distinct from p_intent and a.state=p_state then return jsonb_build_object('state',p_state,'duplicate',true);end if;
  perform missionaccounts.financial_append_operation(p_principal,p_wp_user_id,a.subject_key,'CARD_'||p_state,jsonb_build_object('state',a.state),jsonb_build_object('state',p_state,'attempt_id',a.id),a.request_identity||':transition:'||(a.transition_no+1)::text,'DR-387:STRIPE_RESULT',dg);
 end if;
 update missionaccounts.financial_card_attempt set transition_no=transition_no+1,state=p_state,intent_ref=p_intent,payment_id=case when paid is not null then (paid->>'payment_id')::uuid else payment_id end,updated_at=clock_timestamp() where id=a.id;
 return jsonb_build_object('state',p_state,'payment_id',paid->>'payment_id','duplicate',false);
end $$;
create function missionaccounts.api_financial_card_attempt(p_principal uuid,p_wp_user_id bigint,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a missionaccounts.financial_card_attempt; b missionaccounts.financial_card_binding;
begin
 select * into strict a from missionaccounts.financial_card_attempt where id=p_id;
 perform missionaccounts.financial_actor_subject(p_principal,p_wp_user_id,a.subject_key);
 select * into strict b from missionaccounts.financial_card_binding where subject_key=a.subject_key;
 return to_jsonb(a)||jsonb_build_object('customer_ref',b.customer_ref,'payment_method_ref',(select m.provider_pm_ref from missionaccounts.financial_specific_authorization c join missionaccounts.financial_card_method m on m.id=c.method_id where c.id=a.authorization_id));
end $$;
-- Student-reported Zelle is never a receipt or settlement.
create function missionaccounts.api_financial_report_zelle(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_request_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text; r missionaccounts.financial_payment_request; dg text; ev uuid;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and student_publication) then raise exception 'Financial publication disabled' using errcode='42501';end if;
 if p_request_id !~ '^[A-Za-z0-9._:-]{8,150}$' then raise exception 'Stable claim identity required';end if;
 select e.id into ev from missionaccounts.financial_operating_event e where e.request_id=p_request_id and e.subject_key=k and e.operation='ZELLE_PAYMENT_REPORTED' and e.after_state->>'request_id'=p_request::text;
 if found then return jsonb_build_object('state','AWAITING_CONFIRMATION','duplicate',true);end if;
 r:=missionaccounts.financial_payable_request(p_request,'ZELLE');
 if r.subject_key<>k then raise exception 'Own request required' using errcode='42501';end if;
 if exists(select 1 from missionaccounts.financial_card_attempt x where x.request_id=r.id and x.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED')) then raise exception 'Card result must be reconciled before Zelle claim';end if;
 dg:=encode(extensions.digest(jsonb_build_array(k,p_request)::text,'sha256'),'hex');
 ev:=missionaccounts.financial_append_operation(p_principal,p_wp_user_id,k,'ZELLE_PAYMENT_REPORTED','{}',jsonb_build_object('request_id',r.id,'state','AWAITING_CONFIRMATION'),p_request_id,'DR-387:OWN_CLAIM',dg);
 insert into missionaccounts.financial_request_result values(r.id,ev,'REPORTED',null);
 return jsonb_build_object('state','AWAITING_CONFIRMATION','duplicate',false);
end $$;
-- Own projection derives safe data only. It never returns private cases, payer contacts or evidence paths.
create function missionaccounts.financial_operational_due(p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 with parent as (
  select o.* from missionaccounts.financial_obligation_state o join missionaccounts.financial_agreement g on g.id=o.agreement_id where g.subject_key=p_subject
 ), dates as (
  select i.remaining_cents,i.due_on from missionaccounts.financial_active_schedule i where i.subject_key=p_subject and i.remaining_cents>0
  union all
  select greatest(o.remaining_cents-coalesce((select sum(i.remaining_cents) from missionaccounts.financial_active_schedule i where i.obligation_id=o.id),0),0),o.due_on from parent o
 ), totals as (
  select coalesce(sum(remaining_cents) filter(where due_on<=current_date),0) due,
   coalesce(sum(remaining_cents) filter(where due_on<current_date),0) overdue,
   coalesce(sum(remaining_cents) filter(where due_on is null),0) unknown,
   min(due_on) filter(where remaining_cents>0 and due_on>current_date) next_date from dates where remaining_cents>0
 ) select jsonb_build_object('currently_due_cents',case when unknown=0 then due else null end,'known_due_cents',due,
  'overdue_cents',case when unknown=0 then overdue else null end,'unknown_date_cents',unknown,'next_due_on',next_date,
  'next_amount_cents',(select coalesce(sum(d.remaining_cents),0) from dates d where d.due_on=t.next_date)) from totals t
$$;
create or replace function missionaccounts.api_financial_operating_command(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 return jsonb_build_object('gates',(select to_jsonb(g)-'id' from missionaccounts.financial_operating_gate g where id=1),
  'accounts',(select coalesce(jsonb_agg(missionaccounts.financial_operating_snapshot(subject_key)||
   jsonb_build_object('operational_due',case when certification_state='CERTIFIED' then missionaccounts.financial_operational_due(subject_key) else null end) order by subject_key),'[]'::jsonb) from missionaccounts.financial_subject));
end $$;
create function missionaccounts.api_financial_own_account(p_principal uuid,p_wp_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k text; s missionaccounts.financial_subject; g missionaccounts.financial_agreement;
begin
 k:=missionaccounts.financial_own_subject(p_principal,p_wp_user_id);
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and student_publication) then raise exception 'Student financial publication disabled' using errcode='42501';end if;
 select * into strict s from missionaccounts.financial_subject where subject_key=k;
 if s.certification_state='HELD' then return jsonb_build_object('state','ACCOUNT_REVIEW','program','Mission Residency','payments','[]'::jsonb,'requests','[]'::jsonb,'balance',null);end if;
 select * into strict g from missionaccounts.financial_agreement where subject_key=k;
 return jsonb_build_object('state',case when (select balance_cents from missionaccounts.financial_balance where subject_key=k)=0 then 'PAID_IN_FULL' else 'BALANCE_REMAINING' end,'program',g.program,
  'authorization_terms_version',(select charge_terms_version from missionaccounts.financial_operating_gate where id=1),
  'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'request_id',a.request_id,'state',a.state)) from missionaccounts.financial_card_attempt a where a.subject_key=k),'[]'::jsonb),
  'agreement',jsonb_build_object('tuition_cents',g.accepted_tuition_cents,'fees_cents',g.accepted_fees_cents,'plan',g.plan),
  'balance',(select to_jsonb(b)-'subject_key'-'agreement_id' from missionaccounts.financial_balance b where b.subject_key=k),
  'operational_due',missionaccounts.financial_operational_due(k),
  'credit_cents',(select coalesce(sum(credit_cents),0) from missionaccounts.financial_unapplied_credit where subject_key=k),
  'schedule',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'amount_cents',i.amount_cents,'applied_cents',i.applied_cents,'remaining_cents',i.remaining_cents,'due_on',i.due_on,'due_precision',i.due_precision) order by i.due_on nulls last,i.id) from missionaccounts.financial_active_schedule i where i.subject_key=k),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'amount_cents',p.gross_cents,'method',p.method,'date',p.received_at,'receipt_available',p.verification_state='VERIFIED') order by p.received_at,p.id) from missionaccounts.financial_payment p where p.subject_key=k),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'amount_cents',q.amount_cents,'description',q.description,'methods',q.methods,'expires_at',q.expires_at,'state',coalesce((select rr.state from missionaccounts.financial_request_result rr join missionaccounts.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN')) order by q.created_at,q.id) from missionaccounts.financial_payment_request q where q.subject_key=k),'[]'::jsonb));
end $$;
-- The existing Chase authenticity/global-claim adapter must verify proof before this RPC.
-- A browser claim cannot invoke it, supply raw evidence, or override deterministic matching.
create table missionaccounts.financial_zelle_review (
 fingerprint text primary key check(fingerprint ~ '^[a-f0-9]{64}$'),
 chase_reference text not null unique check(chase_reference ~ '^[0-9]+$'),
 amount_cents bigint not null check(amount_cents>0), payer text not null,
 reason text not null, evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
alter table missionaccounts.financial_zelle_review enable row level security;
alter table missionaccounts.financial_zelle_review force row level security;
revoke all on missionaccounts.financial_zelle_review from public,anon,authenticated,service_role;
grant select on missionaccounts.financial_zelle_review to service_role;
create trigger financial_zelle_review_immutable before update or delete on missionaccounts.financial_zelle_review for each row execute function missionaccounts.reject_immutable_change();
create function missionaccounts.api_financial_reconcile_chase(p_principal uuid,p_wp_user_id bigint,p_settlement_actor text,p_receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r missionaccounts.financial_payment_request; g missionaccounts.financial_agreement; o missionaccounts.financial_obligation; n integer; paid jsonb; artifact uuid; ev uuid; dg text; application uuid; existing missionaccounts.financial_payment;
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 perform missionaccounts.financial_require_principal(p_settlement_actor,'settle');
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and zelle_matcher) then raise exception 'Chase reconciliation adapter is not released' using errcode='42501';end if;
 if p_receipt->'authenticity_verified' is distinct from 'true'::jsonb or p_receipt->'global_claim_verified' is distinct from 'true'::jsonb or p_receipt->'commerce_consumed' is distinct from 'false'::jsonb or coalesce(p_receipt->>'reference','') !~ '^[0-9]+$' or coalesce(p_receipt->>'fingerprint','') !~ '^[a-f0-9]{64}$' or (p_receipt->>'amount_cents')::bigint<=0 then raise exception 'Authenticated unconsumed Chase proof required';end if;
 dg:=encode(extensions.digest(p_receipt::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:Chase:'||(p_receipt->>'reference'),0));
 select * into existing from missionaccounts.financial_payment where provider='Chase' and provider_identity=p_receipt->>'reference';
 if found then
  if existing.request_id<>'mr-chase:'||(p_receipt->>'fingerprint') then raise exception 'Chase evidence belongs to an existing payment';end if;
  if not exists(select 1 from missionaccounts.financial_operating_event e where e.request_id=existing.request_id and e.request_digest=dg and e.operation='CHASE_PAYMENT_SETTLED') then raise exception 'Chase proof replay conflict';end if;
  return jsonb_build_object('state','SETTLED','payment_id',existing.id,'duplicate',true);
 end if;
 -- Serialize requests and competing card reservations across the bounded population.
 perform 1 from missionaccounts.financial_subject order by subject_key for update;
 perform 1 from missionaccounts.financial_agreement order by subject_key for update;
 select count(*) into n from missionaccounts.financial_payment_request q join missionaccounts.financial_subject s on s.subject_key=q.subject_key
 join missionaccounts.financial_obligation_state os on os.id=q.obligation_id
 where s.certification_state='CERTIFIED' and 'ZELLE'=any(q.methods) and q.amount_cents=(p_receipt->>'amount_cents')::bigint and q.amount_cents<=os.remaining_cents and (q.expires_at is null or q.expires_at>now())
 and coalesce((select rr.state from missionaccounts.financial_request_result rr join missionaccounts.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN') in ('OPEN','REPORTED')
 and exists(select 1 from missionaccounts.financial_payer_alias a where a.subject_key=q.subject_key and lower(regexp_replace(trim(a.payer),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(p_receipt->>'payer'),'[[:space:]]+',' ','g')))
 and (q.installment_id is null or exists(select 1 from missionaccounts.financial_active_schedule i join missionaccounts.financial_schedule_revision v on v.id=i.revision_id where i.id=q.installment_id and i.remaining_cents>=q.amount_cents and not exists(select 1 from missionaccounts.financial_schedule_revision sn where sn.supersedes=v.id)))
 and (q.installment_id is not null or q.amount_cents<=os.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=q.obligation_id))
 and not exists(select 1 from missionaccounts.financial_card_attempt a join missionaccounts.financial_payment_request cr on cr.id=a.request_id where cr.obligation_id=q.obligation_id and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'));
 if n<>1 then
  insert into missionaccounts.financial_zelle_review values(p_receipt->>'fingerprint',p_receipt->>'reference',(p_receipt->>'amount_cents')::bigint,p_receipt->>'payer',case when n=0 then 'NO_UNIQUE_ELIGIBLE_OBLIGATION' else 'MULTIPLE_MATCHES' end,dg,clock_timestamp()) on conflict do nothing;
  return jsonb_build_object('state','REVIEW_REQUIRED','candidate_count',n);
 end if;
 select q.* into strict r from missionaccounts.financial_payment_request q join missionaccounts.financial_subject s on s.subject_key=q.subject_key
 join missionaccounts.financial_obligation_state os on os.id=q.obligation_id
 where s.certification_state='CERTIFIED' and 'ZELLE'=any(q.methods) and q.amount_cents=(p_receipt->>'amount_cents')::bigint and q.amount_cents<=os.remaining_cents and (q.expires_at is null or q.expires_at>now())
 and coalesce((select rr.state from missionaccounts.financial_request_result rr join missionaccounts.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN') in ('OPEN','REPORTED')
 and exists(select 1 from missionaccounts.financial_payer_alias a where a.subject_key=q.subject_key and lower(regexp_replace(trim(a.payer),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(p_receipt->>'payer'),'[[:space:]]+',' ','g')))
 and (q.installment_id is null or exists(select 1 from missionaccounts.financial_active_schedule i join missionaccounts.financial_schedule_revision v on v.id=i.revision_id where i.id=q.installment_id and i.remaining_cents>=q.amount_cents and not exists(select 1 from missionaccounts.financial_schedule_revision sn where sn.supersedes=v.id)))
 and (q.installment_id is not null or q.amount_cents<=os.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=q.obligation_id))
 and not exists(select 1 from missionaccounts.financial_card_attempt a join missionaccounts.financial_payment_request cr on cr.id=a.request_id where cr.obligation_id=q.obligation_id and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'));
 select * into strict g from missionaccounts.financial_agreement where subject_key=r.subject_key;
 select * into strict o from missionaccounts.financial_obligation where id=r.obligation_id;
 insert into missionaccounts.source_artifact(source_kind,source_path,sha256,byte_count,observed_at) values('mr_chase_receipt','chase:'||(p_receipt->>'reference'),dg,octet_length(p_receipt::text),clock_timestamp()) returning id into artifact;
 paid:=missionaccounts.api_record_verified_financial_payment(p_settlement_actor,jsonb_build_object('subject_key',r.subject_key,'agreement_version',g.version,'provider','Chase','provider_account',p_receipt->>'provider_account','provider_identity',p_receipt->>'reference','method','ZELLE','gross_cents',(p_receipt->>'amount_cents')::bigint,'payer',p_receipt->>'payer','received_at',p_receipt->>'received_at','received_precision','EXACT','verification_state','VERIFIED','request_id','mr-chase:'||(p_receipt->>'fingerprint'),'artifact_id',artifact,'evidence',jsonb_build_array(jsonb_build_object('type','CHASE_REFERENCE','reference',p_receipt->>'reference','fingerprint',p_receipt->>'fingerprint','metadata',jsonb_build_object('authenticity_verified',true))),'applications',jsonb_build_array(jsonb_build_object('obligation_key',o.obligation_key,'component',o.component,'amount_cents',r.amount_cents))));
 if r.installment_id is not null then
  select id into strict application from missionaccounts.financial_payment_application where payment_id=(paid->>'payment_id')::uuid and obligation_id=o.id;
  insert into missionaccounts.financial_schedule_application values(r.installment_id,application,r.amount_cents);
 end if;
 ev:=missionaccounts.financial_append_operation(p_principal,p_wp_user_id,r.subject_key,'CHASE_PAYMENT_SETTLED','{}',jsonb_build_object('request_id',r.id,'payment_id',paid->>'payment_id','amount_cents',r.amount_cents),'mr-chase:'||(p_receipt->>'fingerprint'),'DR-387:CHASE_VERIFIED',dg);
 insert into missionaccounts.financial_request_result values(r.id,ev,'SETTLED',(paid->>'payment_id')::uuid);
 return jsonb_build_object('state','SETTLED','payment_id',paid->>'payment_id','duplicate',false);
end $$;
-- Only server service-role may invoke the identity-checked adapters; private helpers are not RPCs.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='missionaccounts' and p.proname in ('financial_operational_due','financial_actor_subject','financial_append_operation','financial_payable_request','api_financial_setup_context','api_financial_register_setup','api_financial_confirm_setup','api_financial_authorize_charge','api_financial_prepare_card','api_financial_card_result','api_financial_card_attempt','api_financial_report_zelle','api_financial_own_account','api_financial_reconcile_chase') loop
  execute format('revoke execute on function %s from public,anon,authenticated,service_role',f.sig);
  if f.proname like 'api_%' then execute format('grant execute on function %s to service_role',f.sig);end if;
 end loop;
end $$;
commit;
