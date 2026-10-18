-- EXTERNAL DISABLED PROPOSAL. No grant insertion or arming. Allocate the new
-- production migration name only after canonical admission; never edit old history.
-- Only the two admission RPCs change. All other RPCs, ownership, ACLs and RLS stay.
alter table ivoc_private.native_voice_grants
 alter column session_id drop not null,
 add column financial_mode text not null default 'HARD_CEILING_VERIFIED',
 add column risk_acceptance_sha256 text,
 add column residual_exposure text,
 alter column maximum_exposure_minor drop not null,
 alter column hard_ceiling_kind drop not null,
 alter column hard_ceiling_evidence drop not null,
 alter column hard_ceiling_verified_at drop not null,
 alter column hard_ceiling_expires_at drop not null;
-- Existing unnamed positive/rate/length checks remain. Explicit branch CHECK
-- prevents NULL from weakening their verified-ceiling meaning.
alter table ivoc_private.native_voice_grants add constraint native_voice_financial_mode_contract check ((
 (financial_mode='HARD_CEILING_VERIFIED' and session_id is not null
  and maximum_exposure_minor is not null and maximum_exposure_minor>0
  and hard_ceiling_kind is not null and length(hard_ceiling_kind)>0
  and hard_ceiling_evidence is not null and length(hard_ceiling_evidence)>0
  and hard_ceiling_verified_at is not null and hard_ceiling_expires_at is not null
  and hard_ceiling_verified_at<hard_ceiling_expires_at
  and risk_acceptance_sha256 is null and residual_exposure is null)
 or
 (financial_mode='RISK_ACCEPTED_SUPERVISED' and hard_ceiling_verified=false
  and ((session_id is null)=(consumed_at is null))
  and maximum_exposure_minor is null and hard_ceiling_kind is null and hard_ceiling_evidence is null
  and hard_ceiling_verified_at is null and hard_ceiling_expires_at is null
  and risk_acceptance_sha256 ~ '^[0-9a-f]{64}$'
  and length(btrim(residual_exposure)) between 1 and 2048
  and duration_ms<=360000 and startup_ms<=15000)
) is true);
-- This exact approval can never mint a second grant, including after a closed
-- session. No DELETE/INSERT/arm rights are granted to the application service.
create unique index native_voice_one_grant_per_risk_acceptance
 on ivoc_private.native_voice_grants(risk_acceptance_sha256)
 where financial_mode='RISK_ACCEPTED_SUPERVISED';
comment on column ivoc_private.native_voice_grants.financial_mode is
 'RISK_ACCEPTED_SUPERVISED is a single Founder-operated session with accepted residual financial exposure, not proof of a hard monetary ceiling.';

create or replace function public.ivoc_native_voice_reserve(p_binding jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz; candidate_count integer:=0;

begin
if p_binding->>'ownerSubject' is distinct from 'wp:1' or p_binding->'administrator' is distinct from 'true'::jsonb
 or p_binding->>'model' is distinct from 'gpt-live-1' or coalesce(p_binding->>'cookieFingerprint','')!~'^[0-9a-f]{64}$'
 or coalesce(p_binding->>'requestHash','')!~'^[0-9a-f]{64}$' or coalesce(p_binding->>'entitlementRevision','')='' then raise exception 'native_voice_denied'; end if;
 select * into g from ivoc_private.native_voice_grants
 where owner_subject='wp:1' and session_id=(p_binding->>'ivocSessionId')::uuid
 and credential_fingerprint=p_binding->>'credentialFingerprint' and model=p_binding->>'model'
 order by issued_at desc limit 1 for update;
 if not found then
  -- Only this admitted risk approval may start unbound. Lock before any bind.
  for g in select * from ivoc_private.native_voice_grants
   where owner_subject='wp:1' and session_id is null and armed and consumed_at is null
   and financial_mode='RISK_ACCEPTED_SUPERVISED'
   and authority_reference='IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018'
   and authority_sha256='cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9'
   and risk_acceptance_sha256='b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0'
   and credential_fingerprint=p_binding->>'credentialFingerprint' and model=p_binding->>'model'
   and clock_timestamp()>=issued_at and clock_timestamp()<expires_at
   and clock_timestamp()>=rate_verified_at and clock_timestamp()<rate_expires_at
   order by id for update
  loop candidate_count:=candidate_count+1; end loop;
  if candidate_count>1 then raise exception 'native_voice_denied'; end if;
  if candidate_count=0 then
   -- A concurrent identical reserve may have bound the row while this request
   -- waited for its lock. Re-read the exact UUID, never select another grant.
   select * into g from ivoc_private.native_voice_grants
    where owner_subject='wp:1' and session_id=(p_binding->>'ivocSessionId')::uuid
    and credential_fingerprint=p_binding->>'credentialFingerprint' and model=p_binding->>'model'
    order by issued_at desc limit 1 for update;
   if not found then raise exception 'native_voice_denied'; end if;
  end if;
 end if;
 if jsonb_typeof(g.charging_units) is distinct from 'object' or not (g.charging_units ? 'seconds')
 or (g.charging_units-'seconds') is distinct from '{}'::jsonb then raise exception 'native_voice_denied'; end if;
 select * into r from ivoc_private.native_voice_reservations where grant_id=g.id for update;
 t := clock_timestamp(); -- Sample after all potentially blocking row locks.
 if found then
  if r.session_id::text is distinct from p_binding->>'ivocSessionId' or g.session_id is distinct from r.session_id
   or r.idempotency_key is distinct from p_binding->>'ivocSessionId' or r.request_hash is distinct from p_binding->>'requestHash'
   or r.cookie_fingerprint is distinct from p_binding->>'cookieFingerprint' or r.entitlement_revision is distinct from p_binding->>'entitlementRevision'
   then raise exception 'native_voice_denied'; end if;
  return to_jsonb(r) || jsonb_build_object('ok',true,'reservation_id',r.id,'model',g.model,
 'credential_fingerprint',g.credential_fingerprint,'account_fingerprint',g.account_fingerprint,
 'hard_ceiling_verified',g.hard_ceiling_verified,'presence_ms',g.presence_ms,'heartbeat_ms',g.heartbeat_ms,
 'cleanup_ms',g.cleanup_ms,'financial_mode',g.financial_mode,
 'maximum_exposure_minor',g.maximum_exposure_minor,'risk_acceptance_sha256',g.risk_acceptance_sha256,
 'residual_exposure',g.residual_exposure,'authority_reference',g.authority_reference,
 'authority_sha256',g.authority_sha256,'authorization_expires_at',g.expires_at,
 'duration_ms',g.duration_ms,'startup_ms',g.startup_ms);
 end if;
 if not g.armed or g.consumed_at is not null or t<g.issued_at or t>=g.expires_at
 or t<g.rate_verified_at or t>=g.rate_expires_at
 or (g.financial_mode='HARD_CEILING_VERIFIED' and (not g.hard_ceiling_verified
   or t<g.hard_ceiling_verified_at or t>=g.hard_ceiling_expires_at))
 or g.financial_mode not in ('HARD_CEILING_VERIFIED','RISK_ACCEPTED_SUPERVISED')
 or (g.financial_mode='RISK_ACCEPTED_SUPERVISED' and (g.session_id is not null
   or g.authority_reference<>'IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018'
   or g.authority_sha256<>'cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9'
   or g.risk_acceptance_sha256<>'b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0'))
 or not exists(select 1 from public.ivoc_sessions s where s.id=(p_binding->>'ivocSessionId')::uuid and s.owner_subject='wp:1'
   and s.state='active' and s.interviewer_provider='openai-gpt-live'
   and (g.financial_mode='HARD_CEILING_VERIFIED' or s.created_at>g.issued_at)) then raise exception 'native_voice_denied'; end if;
 insert into ivoc_private.native_voice_reservations(grant_id,owner_subject,session_id,idempotency_key,request_hash,cookie_fingerprint,entitlement_revision,
 deadline_at,startup_deadline_at,presence_expires_at)
 values(g.id,g.owner_subject,(p_binding->>'ivocSessionId')::uuid,p_binding->>'ivocSessionId',p_binding->>'requestHash',p_binding->>'cookieFingerprint',p_binding->>'entitlementRevision',
 least(t+g.duration_ms*interval '1 millisecond',g.expires_at,g.rate_expires_at,case when g.financial_mode='HARD_CEILING_VERIFIED' then g.hard_ceiling_expires_at else g.expires_at end),
 least(t+g.startup_ms*interval '1 millisecond',g.expires_at,g.rate_expires_at,case when g.financial_mode='HARD_CEILING_VERIFIED' then g.hard_ceiling_expires_at else g.expires_at end),
 least(t+g.startup_ms*interval '1 millisecond',g.expires_at,g.rate_expires_at,case when g.financial_mode='HARD_CEILING_VERIFIED' then g.hard_ceiling_expires_at else g.expires_at end)) returning * into r;
 if g.financial_mode='RISK_ACCEPTED_SUPERVISED' then
  perform ivoc_private.consume_supervised_risk_grant_20261018(g.id,r.id,p_binding);
  select * into g from ivoc_private.native_voice_grants where id=g.id;
 else
  update ivoc_private.native_voice_grants set consumed_at=t where id=g.id;
 end if;
 return to_jsonb(r) || jsonb_build_object('ok',true,'reservation_id',r.id,'model',g.model,
 'credential_fingerprint',g.credential_fingerprint,'account_fingerprint',g.account_fingerprint,
 'hard_ceiling_verified',g.hard_ceiling_verified,'presence_ms',g.presence_ms,'heartbeat_ms',g.heartbeat_ms,
 'cleanup_ms',g.cleanup_ms,'financial_mode',g.financial_mode,
 'maximum_exposure_minor',g.maximum_exposure_minor,'risk_acceptance_sha256',g.risk_acceptance_sha256,
 'residual_exposure',g.residual_exposure,'authority_reference',g.authority_reference,
 'authority_sha256',g.authority_sha256,'authorization_expires_at',g.expires_at,
 'duration_ms',g.duration_ms,'startup_ms',g.startup_ms);
end;
$$;

create or replace function public.ivoc_native_voice_claim_create(p_reservation_id uuid, p_binding jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
select grant_id into gid from ivoc_private.native_voice_reservations where id=p_reservation_id;
 select * into g from ivoc_private.native_voice_grants where id=gid for update;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id for update;
 if not found or g.id is null then raise exception 'native_voice_denied'; end if;
 t := clock_timestamp(); -- Lock waits cannot preserve stale admission time.
 if jsonb_typeof(g.charging_units) is distinct from 'object' or not (g.charging_units ? 'seconds')
 or (g.charging_units-'seconds') is distinct from '{}'::jsonb then raise exception 'native_voice_denied'; end if;
 if g.session_id is distinct from r.session_id or r.state<>'reserved' or r.create_attempted_at is not null or t>=r.deadline_at or t>=r.startup_deadline_at
 or not g.armed or t<g.issued_at or t>=g.expires_at or t<g.rate_verified_at or t>=g.rate_expires_at
 or (g.financial_mode='HARD_CEILING_VERIFIED' and (not g.hard_ceiling_verified
   or t<g.hard_ceiling_verified_at or t>=g.hard_ceiling_expires_at))
 or g.financial_mode not in ('HARD_CEILING_VERIFIED','RISK_ACCEPTED_SUPERVISED')
 or p_binding->>'ownerSubject' is distinct from 'wp:1' or p_binding->'administrator' is distinct from 'true'::jsonb
 or p_binding->>'ivocSessionId' is distinct from r.session_id::text or p_binding->>'requestHash' is distinct from r.request_hash
 or p_binding->>'cookieFingerprint' is distinct from r.cookie_fingerprint or p_binding->>'entitlementRevision' is distinct from r.entitlement_revision
 or p_binding->>'credentialFingerprint' is distinct from g.credential_fingerprint or p_binding->>'model' is distinct from g.model
 or not exists(select 1 from public.ivoc_sessions s where s.id=r.session_id and s.owner_subject=r.owner_subject
  and s.state='active' and s.interviewer_provider='openai-gpt-live') then raise exception 'native_voice_denied'; end if;
 update ivoc_private.native_voice_reservations set state='create_attempted',create_attempted_at=t where id=r.id;
 return jsonb_build_object('ok',true,'claimed',true,'reservation_id',r.id);

end;
$$;

-- CREATE OR REPLACE preserves existing security-invoker ownership and execute ACL.
-- No grants, no arm toggle, no history DML, no data reset, no provider action.


-- This private helper is not an exposed PostgREST endpoint. reserve remains
-- SECURITY INVOKER; only this exact NULL->UUID+consumed update needs tableowner.
create function ivoc_private.consume_supervised_risk_grant_20261018(
 p_grant_id uuid,p_reservation_id uuid,p_binding jsonb
) returns void
language plpgsql security definer set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; t timestamptz;
begin
 select * into g from ivoc_private.native_voice_grants where id=p_grant_id for update;
 if not found then raise exception 'native_voice_denied'; end if;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id and grant_id=g.id for update;
 if not found then raise exception 'native_voice_denied'; end if;
 t:=clock_timestamp();
 if g.financial_mode<>'RISK_ACCEPTED_SUPERVISED' or g.session_id is not null or g.consumed_at is not null
 or not g.armed or g.hard_ceiling_verified or t<g.issued_at or t>=g.expires_at
 or t<g.rate_verified_at or t>=g.rate_expires_at
 or g.authority_reference<>'IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018'
 or g.authority_sha256<>'cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9'
 or g.risk_acceptance_sha256<>'b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0'
 or g.owner_subject<>'wp:1' or g.model<>'gpt-live-1'
 or p_binding->>'ownerSubject' is distinct from g.owner_subject or p_binding->'administrator' is distinct from 'true'::jsonb
 or p_binding->>'model' is distinct from g.model or p_binding->>'credentialFingerprint' is distinct from g.credential_fingerprint
 or r.owner_subject<>g.owner_subject or r.session_id::text is distinct from p_binding->>'ivocSessionId'
 or r.idempotency_key is distinct from p_binding->>'ivocSessionId'
 or r.cookie_fingerprint is distinct from p_binding->>'cookieFingerprint'
 or r.request_hash is distinct from p_binding->>'requestHash'
 or r.entitlement_revision is distinct from p_binding->>'entitlementRevision'
 or r.cookie_fingerprint!~'^[0-9a-f]{64}$' or r.request_hash!~'^[0-9a-f]{64}$' or r.entitlement_revision=''
 or r.state<>'reserved' or r.create_attempted_at is not null or r.provider_session_id is not null
 or r.created_at<g.issued_at or t>=r.deadline_at or t>=r.startup_deadline_at
 or not exists(select 1 from public.ivoc_sessions s where s.id=r.session_id
   and s.owner_subject=g.owner_subject and s.state='active' and s.interviewer_provider='openai-gpt-live'
   and s.created_at>g.issued_at)
 then raise exception 'native_voice_denied'; end if;
 update ivoc_private.native_voice_grants set session_id=r.session_id,consumed_at=t where id=g.id;
end;
$$;
create function ivoc_private.native_voice_risk_binding_immutable() returns trigger
language plpgsql security invoker set search_path = pg_catalog
as $$ begin
 if old.financial_mode='RISK_ACCEPTED_SUPERVISED' and (old.session_id is not null or old.consumed_at is not null) and
  (new.session_id is distinct from old.session_id or new.consumed_at is distinct from old.consumed_at
   or new.financial_mode is distinct from old.financial_mode
   or new.risk_acceptance_sha256 is distinct from old.risk_acceptance_sha256
   or new.authority_reference is distinct from old.authority_reference
   or new.authority_sha256 is distinct from old.authority_sha256)
 then raise exception 'native_voice_binding_immutable'; end if;
 return new;
end; $$;
create trigger native_voice_risk_binding_immutable before update of session_id,consumed_at,financial_mode,risk_acceptance_sha256,authority_reference,authority_sha256
 on ivoc_private.native_voice_grants for each row execute function ivoc_private.native_voice_risk_binding_immutable();
revoke all on function ivoc_private.consume_supervised_risk_grant_20261018(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function ivoc_private.consume_supervised_risk_grant_20261018(uuid,uuid,jsonb) to service_role;
revoke all on function ivoc_private.native_voice_risk_binding_immutable() from public,anon,authenticated;

-- Exact approval-only privileged exception. No web route or base-table service grants.
-- External proposal remains unadmitted. Canonical decision must independently pin
-- both leaf authority hashes and this exact source before installation/execution.
create function public.ivoc_native_voice_arm_supervised_20261018(
 p_credential_fingerprint text, p_account_fingerprint text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare t timestamptz:=clock_timestamp(); gid uuid;
 cutoff constant timestamptz:='2026-10-19T12:00:00Z';
begin
 if t>=cutoff or coalesce(p_credential_fingerprint,'')!~'^[0-9a-f]{64}$'
 or coalesce(p_account_fingerprint,'')!~'^[0-9a-f]{64}$'

 or exists(select 1 from ivoc_private.native_voice_reservations where owner_subject='wp:1' and state<>'closed')
 then raise exception 'native_voice_denied'; end if;
 insert into ivoc_private.native_voice_grants(owner_subject,session_id,armed,
 authority_reference,authority_sha256,issued_by,issued_at,expires_at,model,
 credential_fingerprint,account_fingerprint,account_binding_evidence,max_creates,
 duration_ms,startup_ms,cleanup_ms,presence_ms,heartbeat_ms,currency,maximum_exposure_minor,
 rate_source,rate_version,rate_verified_at,rate_expires_at,charging_units,
 hard_ceiling_verified,hard_ceiling_kind,hard_ceiling_evidence,hard_ceiling_verified_at,hard_ceiling_expires_at,
 financial_mode,risk_acceptance_sha256,residual_exposure)
 values('wp:1',NULL,true,'IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018','cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9',
 'fixed-one-test-server-registrar',t,least(t+interval '1800 seconds',cutoff),'gpt-live-1',
 p_credential_fingerprint,p_account_fingerprint,
 'Fixed org-n8nCMMSe7DlBUK56v3msVqje / proj_UTCDEhLVMT6aQnCXnBElihZT selected by Founder. Current selected-tuple source/deployment and prior selected-context GET200 recorded in evidence SHA7c059cbb33143bef41414f27cff5e301ebea6d60f45f6bf812714bc7ff709b1e; response echoed IDs null. No historical/default-billing identity or global-zero assertion.',1,
 360000,15000,15000,10000,1000,'USD',NULL,
 'https://developers.openai.com/api/docs/pricing','official-page-fetched-20261018-this-turn',
 '2026-10-18T21:46:40.018567Z'::timestamptz,cutoff,
 '{"seconds":{"unit":"native_session_seconds","currency":"USD","minor_units":5,"per_seconds":60,"billing_increment_seconds":1,"scope":"native_voice_only_not_final_invoice"}}'::jsonb,
 false,NULL,NULL,NULL,NULL,'RISK_ACCEPTED_SUPERVISED',
 'b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0',
 'No guaranteed currency ceiling is established. Unknown provider session ID, control loss, failed/delayed shutdown or absent terminal event can accrue charges beyond intended360s or priorUSD5. Only this single bounded supervised attempt and necessary admitted termination/investigation are authorized; no continuation, extra CREATE or paid retry. Missing terminal/usage is UNKNOWN/quarantined.')
 returning id into gid;
 -- A single atomic INSERT arms the new grant. No ON CONFLICT/UPDATE/rearm/reset.
 -- Exact approval partial UNIQUE remains after consumption/close/disarm/expiry.
 return jsonb_build_object('ok',true,'grant_id',gid,'armed',true,'financial_mode','RISK_ACCEPTED_SUPERVISED');
end;
$$;
create function public.ivoc_native_voice_disarm_supervised_20261018(p_grant_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare gid uuid;
begin
 update ivoc_private.native_voice_grants set armed=false
 where id=p_grant_id and owner_subject='wp:1' and model='gpt-live-1'
 and authority_reference='IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018'
 and authority_sha256='cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9'
 and financial_mode='RISK_ACCEPTED_SUPERVISED'
 and risk_acceptance_sha256='b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0'
 returning id into gid;
 if gid is null then raise exception 'native_voice_denied'; end if;
 return jsonb_build_object('ok',true,'grant_id',gid,'armed',false,'provider_terminal_confirmed',false);
end;
$$;
-- Fixed private control data for the server-only arm/termination executor.
-- Raw provider identity stays in runtime memory; executor output is sanitized.
create function public.ivoc_native_voice_supervised_control_20261018() returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype;
begin
 select * into g from ivoc_private.native_voice_grants
 where owner_subject='wp:1' and model='gpt-live-1' and financial_mode='RISK_ACCEPTED_SUPERVISED'
 and authority_reference='IVOC-8200-RISK-ACCEPTED-ONE-TEST-20261018'
 and authority_sha256='cb863c68de753a629c647a7eeec342918ef3720a72bedc12129d073f967c37d9'
 and risk_acceptance_sha256='b4ea2e2197cd7838b888ca2675b07fb70f9df36d71032ae0f65bf1e9bcc8b9b0';
 if not found then return jsonb_build_object('ok',true,'grant_present',false); end if;
 select * into r from ivoc_private.native_voice_reservations where grant_id=g.id;
 return jsonb_build_object('ok',true,'grant_present',true,'grant_id',g.id,'armed',g.armed,
  'consumed',g.consumed_at is not null,'bound',g.session_id is not null,'expires_at',g.expires_at,
  'reservation_id',r.id,'reservation_state',r.state,'provider_session_id',r.provider_session_id,
  'termination_requested',r.termination_requested_at is not null,
  'provider_terminal_confirmed',r.terminal_confirmed_at is not null,
  'native_voice_seconds_complete',coalesce(r.accounting_complete,false),
  'usage_status',coalesce(r.usage_status,'UNKNOWN'),'deadline_at',r.deadline_at);
end; $$;
-- Reuse existing private-table owner, giving service only narrow function EXECUTE.
-- SECURITY DEFINER is deliberate here: existing service ACL cannot INSERT/arm.
do $$ declare owner_name text; begin
 select pg_get_userbyid(c.relowner) into owner_name from pg_class c
 join pg_namespace n on n.oid=c.relnamespace where n.nspname='ivoc_private' and c.relname='native_voice_grants';
 execute format('alter function ivoc_private.consume_supervised_risk_grant_20261018(uuid,uuid,jsonb) owner to %I',owner_name);
 execute format('alter function public.ivoc_native_voice_arm_supervised_20261018(text,text) owner to %I',owner_name);
 execute format('alter function public.ivoc_native_voice_supervised_control_20261018() owner to %I',owner_name);
 execute format('alter function public.ivoc_native_voice_disarm_supervised_20261018(uuid) owner to %I',owner_name);
end; $$;
revoke all on function public.ivoc_native_voice_arm_supervised_20261018(text,text) from public,anon,authenticated;
revoke all on function public.ivoc_native_voice_disarm_supervised_20261018(uuid) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_arm_supervised_20261018(text,text) to service_role;
grant execute on function public.ivoc_native_voice_disarm_supervised_20261018(uuid) to service_role;
revoke all on function public.ivoc_native_voice_supervised_control_20261018() from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_supervised_control_20261018() to service_role;
