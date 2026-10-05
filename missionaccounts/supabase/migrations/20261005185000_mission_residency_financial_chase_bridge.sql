-- DR-389 / DR-387: source-only current Chase donor bridge. No runtime/provider/gate changes.
-- Future activation requires reciprocal Woo/private ambiguity and cross-system race verification.
-- Preserve historic numeric Chase identities; new evidence retains the accepted 64hex fingerprint.
begin;
create or replace function missionaccounts.api_record_verified_financial_payment(p_actor text,p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing missionaccounts.financial_payment; pid uuid; x jsonb; oid uuid; applied bigint:=0; digest text;
begin
 perform missionaccounts.financial_require_principal(p_actor,'settle');
 digest:=encode(extensions.digest(p_payment::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:'||(p_payment->>'provider')||':'||(p_payment->>'provider_identity'),0));
 select * into existing from missionaccounts.financial_payment where request_id=p_payment->>'request_id'
  or (provider=p_payment->>'provider' and provider_account=p_payment->>'provider_account' and provider_identity=p_payment->>'provider_identity');
 if found then
  if existing.request_digest<>digest then raise exception 'payment replay payload or owner conflict'; end if;
  return jsonb_build_object('payment_id',existing.id,'duplicate',true);
 end if;
 if jsonb_typeof(p_payment->'evidence') is distinct from 'array' or jsonb_typeof(p_payment->'applications') is distinct from 'array' or jsonb_array_length(p_payment->'evidence')<1 then raise exception 'verified payment evidence required'; end if;
 if p_payment->>'provider'='Chase' then
  if p_payment->>'method' is distinct from 'ZELLE' or jsonb_array_length(p_payment->'evidence')<>1
    or p_payment->'evidence'->0->>'reference' is distinct from p_payment->>'provider_identity'
    or (
      ((p_payment->>'provider_identity') ~ '^[0-9]+$' and p_payment->'evidence'->0->>'type'='CHASE_REFERENCE')
      or ((p_payment->>'provider_identity') ~ '^[a-f0-9]{64}$'
        and p_payment->'evidence'->0->>'type'='CHASE_TRANSACTION_V2_FINGERPRINT'
        and p_payment->'evidence'->0->>'fingerprint'=p_payment->>'provider_identity'
        and p_payment->>'provider_account'='info@missionmedinstitute.com'
        and p_payment->'evidence'->0->'metadata'->'authenticity_verified'='true'::jsonb
        and p_payment->'evidence'->0->'metadata'->'global_claim_verified'='true'::jsonb
        and coalesce(p_payment->'evidence'->0->'metadata'->>'match_binding','') ~ '^[a-f0-9]{64}$')
    ) is distinct from true then raise exception 'canonical Chase evidence namespace required'; end if;
 elsif p_payment->>'provider'='Stripe' then
  if (p_payment->>'provider_identity') !~ '^pi_[A-Za-z0-9]+$' or p_payment->>'method'<>'CARD'
   or jsonb_array_length(p_payment->'evidence')<>2
   or (select count(*) from jsonb_array_elements(p_payment->'evidence') e where e->>'type'='STRIPE_PAYMENT_INTENT' and e->>'reference'=p_payment->>'provider_identity')<>1
   or (select count(*) from jsonb_array_elements(p_payment->'evidence') e where e->>'type'='STRIPE_CHARGE' and e->>'reference' ~ '^ch_[A-Za-z0-9]+$')<>1
   then raise exception 'canonical Stripe intent and charge evidence required'; end if;
 elsif p_payment->>'provider'='Bank' then
  if p_payment->>'method'<>'WIRE' or jsonb_array_length(p_payment->'evidence')<>1 or p_payment->'evidence'->0->>'type'<>'BANK_REFERENCE' or p_payment->'evidence'->0->>'reference'<>p_payment->>'provider_identity' then raise exception 'canonical bank evidence required'; end if;
 else raise exception 'unsupported financial provider';
 end if;
 if p_payment->>'verification_state' is distinct from 'VERIFIED' then raise exception 'unverified payment denied'; end if;
 -- Lock the beneficiary agreement first: consistent lock order across settlement and import.
 perform 1 from missionaccounts.financial_agreement where subject_key=p_payment->>'subject_key' for update;
 if not found then raise exception 'certified agreement required'; end if;
 insert into missionaccounts.financial_payment(subject_key,provider,provider_account,provider_identity,method,currency,gross_cents,payer,received_at,received_precision,verification_state,request_id,request_digest,artifact_id)
 values(p_payment->>'subject_key',p_payment->>'provider',p_payment->>'provider_account',p_payment->>'provider_identity',p_payment->>'method','USD',(p_payment->>'gross_cents')::bigint,p_payment->>'payer',(p_payment->>'received_at')::timestamptz,p_payment->>'received_precision','VERIFIED',p_payment->>'request_id',digest,(p_payment->>'artifact_id')::uuid) returning id into pid;
 for x in select value from jsonb_array_elements(p_payment->'evidence') loop
  insert into missionaccounts.financial_payment_evidence(fingerprint,payment_id,evidence_type,provider,provider_reference,artifact_id,metadata,verified)
  values(x->>'fingerprint',pid,x->>'type',p_payment->>'provider',x->>'reference',(p_payment->>'artifact_id')::uuid,x->'metadata',true);
 end loop;
 for x in select value from jsonb_array_elements(p_payment->'applications') loop
  select o.id into strict oid from missionaccounts.financial_obligation o join missionaccounts.financial_agreement g on g.id=o.agreement_id
   where g.subject_key=p_payment->>'subject_key' and g.version=p_payment->>'agreement_version' and o.obligation_key=x->>'obligation_key' and o.component=x->>'component';
  insert into missionaccounts.financial_payment_application(payment_id,obligation_id,amount_cents) values(pid,oid,(x->>'amount_cents')::bigint);
  applied:=applied+(x->>'amount_cents')::bigint;
 end loop;
 insert into missionaccounts.audit_event(actor_id,actor_role,kind,text,to_val,reason,request_id)
 values(p_actor,'financial_service','financial.payment_recorded','Verified private financial payment and applications',jsonb_build_object('subject_key',p_payment->>'subject_key','payment_id',pid,'gross_cents',p_payment->'gross_cents','applied_cents',applied),'Certified evidence; no dispatch',p_payment->>'request_id');
 return jsonb_build_object('payment_id',pid,'duplicate',false,'applied_cents',applied,'credit_cents',(p_payment->>'gross_cents')::bigint-applied);
end $$;

create function missionaccounts.financial_chase_normalize_payer(p_payer text)
returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(trim(normalize(p_payer,NFKC)),'[[:space:]]+',' ','g'))
$$;
create function missionaccounts.financial_chase_binding(p_request uuid,p_account uuid,p_amount bigint,p_payer text,p_created bigint)
returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(concat_ws(E'\n','financial-chase-match/v1',p_request::text,p_account::text,p_amount::text,p_payer,p_created::text,'1'),'sha256'),'hex')
$$;
-- Count the full current population. Exact payer matching, no fuzzy identity selection.
create function missionaccounts.financial_chase_candidates(p_amount bigint,p_payer text)
returns setof missionaccounts.financial_payment_request language sql security definer set search_path='' as $$
 select q.* from missionaccounts.financial_payment_request q
 join missionaccounts.financial_subject s on s.subject_key=q.subject_key
 join missionaccounts.financial_obligation_state os on os.id=q.obligation_id
 where s.certification_state='CERTIFIED' and s.binding_state='VERIFIED'
 and exists(select 1 from missionaccounts.financial_runtime_binding b where b.subject_key=s.subject_key and b.active)
 and 'ZELLE'=any(q.methods) and q.amount_cents=p_amount and q.amount_cents<=os.remaining_cents
 and (q.expires_at is null or q.expires_at>now())
 and coalesce((select rr.state from missionaccounts.financial_request_result rr join missionaccounts.financial_operating_event e on e.id=rr.event_id where rr.request_id=q.id order by e.sequence_no desc limit 1),'OPEN') in ('OPEN','REPORTED')
 and exists(select 1 from missionaccounts.financial_payer_alias a where a.subject_key=q.subject_key and missionaccounts.financial_chase_normalize_payer(a.payer)=p_payer)
 and (q.installment_id is null or exists(select 1 from missionaccounts.financial_active_schedule i join missionaccounts.financial_schedule_revision v on v.id=i.revision_id where i.id=q.installment_id and i.remaining_cents>=q.amount_cents and not exists(select 1 from missionaccounts.financial_schedule_revision sn where sn.supersedes=v.id)))
 and (q.installment_id is not null or q.amount_cents<=os.remaining_cents-(select coalesce(sum(i.remaining_cents),0) from missionaccounts.financial_active_schedule i where i.obligation_id=q.obligation_id))
 and not exists(select 1 from missionaccounts.financial_card_attempt a join missionaccounts.financial_payment_request cr on cr.id=a.request_id where cr.obligation_id=q.obligation_id and a.state in ('PREPARED','SUBMITTED','REQUIRES_ACTION','AMBIGUOUS','DECLINED'))
$$;
create function missionaccounts.api_financial_chase_context(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_settlement_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r missionaccounts.financial_payment_request; account uuid; payer text; n integer; epoch bigint; existing uuid;
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 perform missionaccounts.financial_require_principal(p_settlement_actor,'settle');
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and founder_operations and zelle_matcher) then raise exception 'Chase adapter is not released' using errcode='42501';end if;
 if (select count(*) from missionaccounts.financial_subject)>100 or (select count(*) from missionaccounts.financial_payment_request)>1000 then raise exception 'Private candidate population exceeds reviewed bound';end if;
 -- Shared subject/agreement lock order also fences competing private card/app allocations.
 perform 1 from missionaccounts.financial_subject order by subject_key for update;
 perform 1 from missionaccounts.financial_agreement order by subject_key for update;
 select * into strict r from missionaccounts.financial_payment_request where id=p_request for update;
 select rr.payment_id into existing from missionaccounts.financial_request_result rr join missionaccounts.financial_operating_event e on e.id=rr.event_id
 where rr.request_id=r.id and rr.state='SETTLED' order by e.sequence_no desc limit 1;
 if found then return jsonb_build_object('state','SETTLED','payment_id',existing);end if;
 select count(distinct missionaccounts.financial_chase_normalize_payer(a.payer)),min(missionaccounts.financial_chase_normalize_payer(a.payer)) into n,payer
 from missionaccounts.financial_payer_alias a where a.subject_key=r.subject_key;
 if n<>1 or length(payer)<2 or length(payer)>120 then raise exception 'One verified private payer alias is required';end if;
 select count(*) into n from missionaccounts.financial_chase_candidates(r.amount_cents,payer);
 if n<>1 or not exists(select 1 from missionaccounts.financial_chase_candidates(r.amount_cents,payer) c where c.id=r.id) then raise exception 'No unique currently eligible private Chase request';end if;
 select g.id into strict account from missionaccounts.financial_agreement g join missionaccounts.financial_obligation o on o.agreement_id=g.id where o.id=r.obligation_id and g.subject_key=r.subject_key;
 epoch:=floor(extract(epoch from r.created_at))::bigint;
 return jsonb_build_object('state','OPEN','request_id',r.id,'account_id',account,'amount_cents',r.amount_cents,
   'payer_name',payer,'created_epoch',epoch,'match_slot',1,'eligible_match_count',n,
   'match_binding',missionaccounts.financial_chase_binding(r.id,account,r.amount_cents,payer,epoch));
end $$;
create function missionaccounts.api_financial_settle_chase_request(p_principal uuid,p_wp_user_id bigint,p_request uuid,p_settlement_actor text,p_receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; r missionaccounts.financial_payment_request; g missionaccounts.financial_agreement; o missionaccounts.financial_obligation;
 paid jsonb; artifact uuid; ev uuid; dg text; application uuid; fp text; existing missionaccounts.financial_payment;
begin
 perform missionaccounts.financial_require_founder(p_principal,p_wp_user_id);
 perform missionaccounts.financial_require_principal(p_settlement_actor,'settle');
 if not exists(select 1 from missionaccounts.financial_operating_gate where id=1 and founder_operations and zelle_matcher) then raise exception 'Chase adapter is not released' using errcode='42501';end if;
 fp:=p_receipt->>'provider_identity';
 if coalesce(fp,'') !~ '^[a-f0-9]{64}$' or p_receipt->>'provider' is distinct from 'Chase'
   or p_receipt->>'provider_account' is distinct from 'info@missionmedinstitute.com'
   or p_receipt->'authenticity_verified' is distinct from 'true'::jsonb
   or p_receipt->'global_claim_verified' is distinct from 'true'::jsonb
   or p_receipt->'reservation_verified' is distinct from 'true'::jsonb
   or coalesce(p_receipt->>'match_binding','') !~ '^[a-f0-9]{64}$'
   or coalesce(p_receipt->>'message_fingerprint','') !~ '^[a-f0-9]{64}$'
   or p_receipt->'money_moved' is distinct from 'false'::jsonb then raise exception 'Authenticated globally reserved current Chase proof required';end if;
 dg:=encode(extensions.digest(p_receipt::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('financial-payment:Chase:'||fp,0));
 select * into existing from missionaccounts.financial_payment where provider='Chase' and provider_identity=fp;
 if found then
  if not exists(select 1 from missionaccounts.financial_operating_event e where e.request_id='mr-chase-v2:'||fp and e.operation='CHASE_PAYMENT_SETTLED' and e.request_digest=dg and e.after_state->>'request_id'=p_request::text and e.after_state->>'payment_id'=existing.id::text) then raise exception 'Chase proof replay owner or payload conflict';end if;
  return jsonb_build_object('state','SETTLED','payment_id',existing.id,'duplicate',true);
 end if;
 ctx:=missionaccounts.api_financial_chase_context(p_principal,p_wp_user_id,p_request,p_settlement_actor);
 if ctx->>'state'<>'OPEN' or ctx->>'match_binding' is distinct from p_receipt->>'match_binding'
   or (ctx->>'amount_cents')::bigint is distinct from (p_receipt->>'amount_cents')::bigint
   or (p_receipt->>'received_at')::timestamptz < to_timestamp((ctx->>'created_epoch')::bigint)
   or (p_receipt->>'received_at')::timestamptz > clock_timestamp()+interval '300 seconds'
   or p_receipt->>'received_at' is null then raise exception 'Current private request or authenticated receipt binding changed';end if;
 select * into strict r from missionaccounts.financial_payment_request where id=p_request for update;
 select * into strict o from missionaccounts.financial_obligation where id=r.obligation_id;
 select * into strict g from missionaccounts.financial_agreement where id=o.agreement_id;
 insert into missionaccounts.source_artifact(source_kind,source_path,sha256,byte_count,observed_at)
 values('mr_chase_v2_receipt','chase-zelle-v2:'||fp,dg,octet_length(p_receipt::text),clock_timestamp()) returning id into artifact;
 paid:=missionaccounts.api_record_verified_financial_payment(p_settlement_actor,jsonb_build_object(
 'subject_key',r.subject_key,'agreement_version',g.version,'provider','Chase','provider_account',p_receipt->>'provider_account',
 'provider_identity',fp,'method','ZELLE','gross_cents',r.amount_cents,'payer',ctx->>'payer_name','received_at',p_receipt->>'received_at',
 'received_precision','EXACT','verification_state','VERIFIED','request_id','mr-chase-v2:'||fp,'artifact_id',artifact,
 'evidence',jsonb_build_array(jsonb_build_object('type','CHASE_TRANSACTION_V2_FINGERPRINT','reference',fp,'fingerprint',fp,
 'metadata',jsonb_build_object('authenticity_verified',true,'global_claim_verified',true,'match_binding',ctx->>'match_binding','message_fingerprint',p_receipt->>'message_fingerprint'))),
 'applications',jsonb_build_array(jsonb_build_object('obligation_key',o.obligation_key,'component',o.component,'amount_cents',r.amount_cents))));
 if r.installment_id is not null then
  select id into strict application from missionaccounts.financial_payment_application where payment_id=(paid->>'payment_id')::uuid and obligation_id=o.id;
  insert into missionaccounts.financial_schedule_application values(r.installment_id,application,r.amount_cents);
 end if;
 ev:=missionaccounts.financial_append_operation(p_principal,p_wp_user_id,r.subject_key,'CHASE_PAYMENT_SETTLED','{}',
 jsonb_build_object('request_id',r.id,'payment_id',paid->>'payment_id','amount_cents',r.amount_cents),'mr-chase-v2:'||fp,'DR-389:CHASE_V2_RESERVED',dg);
 insert into missionaccounts.financial_request_result values(r.id,ev,'SETTLED',(paid->>'payment_id')::uuid);
 return jsonb_build_object('state','SETTLED','payment_id',paid->>'payment_id','duplicate',false);
end $$;
revoke execute on function missionaccounts.financial_chase_normalize_payer(text),missionaccounts.financial_chase_binding(uuid,uuid,bigint,text,bigint),missionaccounts.financial_chase_candidates(bigint,text),missionaccounts.api_financial_chase_context(uuid,bigint,uuid,text),missionaccounts.api_financial_settle_chase_request(uuid,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function missionaccounts.api_financial_chase_context(uuid,bigint,uuid,text),missionaccounts.api_financial_settle_chase_request(uuid,bigint,uuid,text,jsonb) to service_role;
-- Existing writer permissions and all gates are preserved; no principal or provider config is granted.
commit;
