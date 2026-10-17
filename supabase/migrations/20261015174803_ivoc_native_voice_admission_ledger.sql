-- DR462 source only. No grant is inserted or armed. Production apply is separate.
create schema if not exists ivoc_private;
create table ivoc_private.native_voice_grants (
 id uuid primary key default gen_random_uuid(), owner_subject text not null check(owner_subject='wp:1'),
 session_id uuid not null references public.ivoc_sessions(id), armed boolean not null default false,
 authority_reference text not null, authority_sha256 text not null check(authority_sha256 ~ '^[0-9a-f]{64}$'),
 issued_by text not null, issued_at timestamptz not null, expires_at timestamptz not null,
 model text not null check(model='gpt-live-1'),
 credential_fingerprint text not null check(credential_fingerprint ~ '^[0-9a-f]{64}$'),
 account_fingerprint text not null check(account_fingerprint ~ '^[0-9a-f]{64}$'),
 account_binding_evidence text not null,
 max_creates integer not null check(max_creates=1),
 duration_ms integer not null check(duration_ms between 1 and 3600000),
 startup_ms integer not null check(startup_ms between 1 and duration_ms),
 cleanup_ms integer not null check(cleanup_ms between 1 and 60000),
 presence_ms integer not null check(presence_ms between 1 and duration_ms),
 heartbeat_ms integer not null check(heartbeat_ms>0 and heartbeat_ms*2<=presence_ms),
 currency text not null check(currency ~ '^[A-Z]{3}$'), maximum_exposure_minor bigint not null check(maximum_exposure_minor>0),
 rate_source text not null, rate_version text not null, rate_verified_at timestamptz not null, rate_expires_at timestamptz not null,
 charging_units jsonb not null check(jsonb_typeof(charging_units)='object' and charging_units ? 'seconds' and charging_units-'seconds'='{}'::jsonb),
 hard_ceiling_verified boolean not null default false,
 hard_ceiling_kind text not null, hard_ceiling_evidence text not null,
 hard_ceiling_verified_at timestamptz not null, hard_ceiling_expires_at timestamptz not null,
 consumed_at timestamptz,
 check(issued_at<expires_at and rate_verified_at<rate_expires_at and hard_ceiling_verified_at<hard_ceiling_expires_at),
 check(length(authority_reference)>0 and length(issued_by)>0 and length(account_binding_evidence)>0
   and length(rate_source)>0 and length(rate_version)>0 and length(hard_ceiling_kind)>0 and length(hard_ceiling_evidence)>0)
);
create table ivoc_private.native_voice_reservations (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null unique references ivoc_private.native_voice_grants(id),
 owner_subject text not null check(owner_subject='wp:1'), session_id uuid not null unique references public.ivoc_sessions(id),
 idempotency_key text not null, request_hash text not null, cookie_fingerprint text not null, entitlement_revision text not null,
 generation uuid not null default gen_random_uuid(),
 state text not null default 'reserved' check(state in ('reserved','create_attempted','active','ending','quarantined','closed')),
 created_at timestamptz not null default clock_timestamp(), deadline_at timestamptz not null,
 startup_deadline_at timestamptz not null, presence_expires_at timestamptz not null,
 presence_sequence bigint not null default 0, create_attempted_at timestamptz, provider_session_id text unique,
 termination_requested_at timestamptz, terminal_confirmed_at timestamptz, accounting_complete boolean not null default false,
 usage_status text not null default 'UNKNOWN' check(usage_status in ('UNKNOWN','REPORTED_FINAL')),
 reason text, check(startup_deadline_at<=deadline_at and presence_expires_at<=deadline_at)
);
comment on column ivoc_private.native_voice_reservations.accounting_complete is 'Only final supported native voice seconds are complete; invoice, backend-token totals and dollar-ceiling enforcement remain separately unproven.';
create unique index native_voice_one_unresolved_owner on ivoc_private.native_voice_reservations(owner_subject) where state<>'closed';
create table ivoc_private.native_voice_events (
 reservation_id uuid not null references ivoc_private.native_voice_reservations(id),
 event_key text not null, kind text not null check(kind in ('usage','terminal')),
 evidence jsonb not null, received_at timestamptz not null default clock_timestamp(),
 primary key(reservation_id,kind,event_key)
);
alter table ivoc_private.native_voice_grants enable row level security;
alter table ivoc_private.native_voice_reservations enable row level security;
alter table ivoc_private.native_voice_events enable row level security;
-- No user-facing policies; service_role is explicitly tested as BYPASSRLS, not superuser.
revoke all on ivoc_private.native_voice_grants,ivoc_private.native_voice_reservations,ivoc_private.native_voice_events from public,anon,authenticated;
grant usage on schema ivoc_private to service_role;
grant select on ivoc_private.native_voice_grants to service_role;
grant update(consumed_at) on ivoc_private.native_voice_grants to service_role;
grant select,insert on ivoc_private.native_voice_reservations to service_role;
grant update(state,presence_expires_at,presence_sequence,create_attempted_at,provider_session_id,
 termination_requested_at,terminal_confirmed_at,accounting_complete,usage_status,reason) on ivoc_private.native_voice_reservations to service_role;
grant select,insert on ivoc_private.native_voice_events to service_role;

create function public.ivoc_native_voice_reserve(p_binding jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
if p_binding->>'ownerSubject' is distinct from 'wp:1' or p_binding->'administrator' is distinct from 'true'::jsonb
 or p_binding->>'model' is distinct from 'gpt-live-1' or coalesce(p_binding->>'cookieFingerprint','')!~'^[0-9a-f]{64}$'
 or coalesce(p_binding->>'requestHash','')!~'^[0-9a-f]{64}$' or coalesce(p_binding->>'entitlementRevision','')='' then raise exception 'native_voice_denied'; end if;
 select * into g from ivoc_private.native_voice_grants
 where owner_subject='wp:1' and session_id=(p_binding->>'ivocSessionId')::uuid
 and credential_fingerprint=p_binding->>'credentialFingerprint' and model=p_binding->>'model'
 order by issued_at desc limit 1 for update;
 if not found then raise exception 'native_voice_denied'; end if;
 if jsonb_typeof(g.charging_units) is distinct from 'object' or not (g.charging_units ? 'seconds')
 or (g.charging_units-'seconds') is distinct from '{}'::jsonb then raise exception 'native_voice_denied'; end if;
 select * into r from ivoc_private.native_voice_reservations where grant_id=g.id for update;
 t := clock_timestamp(); -- Sample after all potentially blocking row locks.
 if found then
  if r.idempotency_key is distinct from p_binding->>'ivocSessionId' or r.request_hash is distinct from p_binding->>'requestHash'
   or r.cookie_fingerprint is distinct from p_binding->>'cookieFingerprint' or r.entitlement_revision is distinct from p_binding->>'entitlementRevision'
   then raise exception 'native_voice_denied'; end if;
  return to_jsonb(r) || jsonb_build_object('ok',true,'reservation_id',r.id,'model',g.model,
 'credential_fingerprint',g.credential_fingerprint,'account_fingerprint',g.account_fingerprint,
 'hard_ceiling_verified',g.hard_ceiling_verified,'presence_ms',g.presence_ms,'heartbeat_ms',g.heartbeat_ms,
 'cleanup_ms',g.cleanup_ms);
 end if;
 if not g.armed or not g.hard_ceiling_verified or g.consumed_at is not null or t<g.issued_at or t>=g.expires_at
 or t<g.rate_verified_at or t>=g.rate_expires_at or t<g.hard_ceiling_verified_at or t>=g.hard_ceiling_expires_at
 or not exists(select 1 from public.ivoc_sessions s where s.id=g.session_id and s.owner_subject='wp:1'
   and s.state='active' and s.interviewer_provider='openai-gpt-live') then raise exception 'native_voice_denied'; end if;
 insert into ivoc_private.native_voice_reservations(grant_id,owner_subject,session_id,idempotency_key,request_hash,cookie_fingerprint,entitlement_revision,
 deadline_at,startup_deadline_at,presence_expires_at)
 values(g.id,g.owner_subject,g.session_id,p_binding->>'ivocSessionId',p_binding->>'requestHash',p_binding->>'cookieFingerprint',p_binding->>'entitlementRevision',
 least(t+g.duration_ms*interval '1 millisecond',g.expires_at,g.rate_expires_at,g.hard_ceiling_expires_at),
 least(t+g.startup_ms*interval '1 millisecond',g.expires_at,g.rate_expires_at,g.hard_ceiling_expires_at),
 least(t+g.startup_ms*interval '1 millisecond',g.expires_at,g.rate_expires_at,g.hard_ceiling_expires_at)) returning * into r;
 update ivoc_private.native_voice_grants set consumed_at=t where id=g.id;
 return to_jsonb(r) || jsonb_build_object('ok',true,'reservation_id',r.id,'model',g.model,
 'credential_fingerprint',g.credential_fingerprint,'account_fingerprint',g.account_fingerprint,
 'hard_ceiling_verified',g.hard_ceiling_verified,'presence_ms',g.presence_ms,'heartbeat_ms',g.heartbeat_ms,
 'cleanup_ms',g.cleanup_ms);
end;
$$;

create function public.ivoc_native_voice_claim_create(p_reservation_id uuid, p_binding jsonb) returns jsonb
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
 if r.state<>'reserved' or r.create_attempted_at is not null or t>=r.deadline_at or t>=r.startup_deadline_at
 or not g.armed or not g.hard_ceiling_verified or t>=g.expires_at or t>=g.rate_expires_at or t>=g.hard_ceiling_expires_at
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

create function public.ivoc_native_voice_bind_provider(p_reservation_id uuid, p_provider_id text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
select grant_id into gid from ivoc_private.native_voice_reservations where id=p_reservation_id;
 select * into g from ivoc_private.native_voice_grants where id=gid for update;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id for update;
 if not found or g.id is null then raise exception 'native_voice_denied'; end if;
 t := clock_timestamp(); -- Lock waits cannot preserve stale admission time.
 if coalesce(p_provider_id,'')!~'^[A-Za-z0-9_-]{8,160}$' or r.create_attempted_at is null
 or (r.provider_session_id is not null and r.provider_session_id<>p_provider_id) then raise exception 'native_voice_denied'; end if;
 -- Duplicate delivery is a readback, not a new activation or lease extension.
 if r.provider_session_id=p_provider_id then
  return jsonb_build_object('ok',r.state='active','reservation_id',r.id,'presence_expires_at',r.presence_expires_at);
 end if;
 -- Late first identity is retained for exact cleanup, never converted back to active.
 update ivoc_private.native_voice_reservations set provider_session_id=p_provider_id,
 state=case when r.state='create_attempted' and t<r.deadline_at and t<r.startup_deadline_at then 'active' else 'quarantined' end,
 presence_expires_at=least(r.deadline_at,t+g.presence_ms*interval '1 millisecond') where id=r.id returning * into r;
 return jsonb_build_object('ok',r.state='active','reservation_id',r.id,'presence_expires_at',r.presence_expires_at);

end;
$$;

create function public.ivoc_native_voice_heartbeat(p_reservation_id uuid, p_owner text, p_generation uuid, p_sequence bigint) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
select grant_id into gid from ivoc_private.native_voice_reservations where id=p_reservation_id;
 select * into g from ivoc_private.native_voice_grants where id=gid for update;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id for update;
 if not found or g.id is null then raise exception 'native_voice_denied'; end if;
 t := clock_timestamp(); -- Lock waits cannot preserve stale admission time.
 if p_owner is distinct from r.owner_subject or p_generation is distinct from r.generation or p_sequence is null
 or p_sequence<=r.presence_sequence or r.state<>'active' or t>=r.deadline_at or t>=r.presence_expires_at
 or not g.armed then raise exception 'native_voice_denied'; end if;
 update ivoc_private.native_voice_reservations set presence_sequence=p_sequence,
 presence_expires_at=least(deadline_at,t+g.presence_ms*interval '1 millisecond') where id=r.id returning * into r;
 return jsonb_build_object('ok',true,'reservation_id',r.id,'deadline_at',r.deadline_at,'presence_expires_at',r.presence_expires_at);

end;
$$;

create function public.ivoc_native_voice_request_end(p_reservation_id uuid, p_reason text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
select grant_id into gid from ivoc_private.native_voice_reservations where id=p_reservation_id;
 select * into g from ivoc_private.native_voice_grants where id=gid for update;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id for update;
 if not found or g.id is null then raise exception 'native_voice_denied'; end if;
 t := clock_timestamp(); -- Lock waits cannot preserve stale admission time.
 if p_reason is null or p_reason not in ('user_ended','server_shutdown','deadline','presence_expired','owner_changed','startup_failed','observer_failed','usage_limit','persistence_failed') then raise exception 'native_voice_denied'; end if;
 update ivoc_private.native_voice_reservations set state=case when state in ('closed','quarantined') then state else 'ending' end,
 termination_requested_at=coalesce(termination_requested_at,t),reason=coalesce(reason,p_reason) where id=r.id;
 return jsonb_build_object('ok',true,'termination_requested',true,'provider_terminal_confirmed',r.terminal_confirmed_at is not null);

end;
$$;

create function public.ivoc_native_voice_record_usage(p_reservation_id uuid, p_evidence jsonb) returns jsonb
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
 -- Native voice accounting is cumulative provider duration, not backend tokens
 -- or proof of an invoice/account-level hard ceiling. Missing final usage stays UNKNOWN.
 if p_evidence->>'providerSessionId' is distinct from r.provider_session_id or r.provider_session_id is null
 or coalesce(p_evidence->>'eventId','')!~'^[A-Za-z0-9_.:-]{1,160}$'
 or jsonb_typeof(p_evidence->'final') is distinct from 'boolean'
 or jsonb_typeof(p_evidence->'usage') is distinct from 'object'
 or jsonb_typeof(p_evidence->'usage'->'seconds') is distinct from 'number'
 or ((p_evidence->'usage') - 'seconds') is distinct from '{}'::jsonb
 or pg_column_size(p_evidence)>8192
 or exists(select 1 from jsonb_object_keys(p_evidence) k where k not in ('reservationId','kind','type','providerSessionId','eventId','source','usage','final'))
 or (p_evidence->'final'='true'::jsonb and (p_evidence->>'source' is distinct from 'provider_session_closed' or p_evidence->>'type' is distinct from 'session.closed'))
 or (p_evidence->'final'='false'::jsonb and (p_evidence->>'source' is distinct from 'provider_session_usage' or p_evidence->>'type' is distinct from 'session.usage.updated'))
 then raise exception 'native_voice_denied'; end if;
 if (p_evidence->'usage'->>'seconds')::numeric<0 then raise exception 'native_voice_denied'; end if;
 if exists(select 1 from ivoc_private.native_voice_events where reservation_id=r.id and kind='usage' and event_key=p_evidence->>'eventId') then
  if exists(select 1 from ivoc_private.native_voice_events where reservation_id=r.id and kind='usage' and event_key=p_evidence->>'eventId' and evidence<>p_evidence)
  then raise exception 'native_voice_evidence_conflict'; end if;
  return jsonb_build_object('ok',true,'accounting_complete',r.accounting_complete,'accounting_scope','native_voice_seconds',
   'usage_seconds',(p_evidence->'usage'->>'seconds')::numeric,'duration_limit_reached',(p_evidence->'usage'->>'seconds')::numeric>=g.duration_ms/1000.0);
 end if;
 if r.accounting_complete or exists(select 1 from ivoc_private.native_voice_events e where e.reservation_id=r.id and e.kind='usage'
   and (e.evidence->'usage'->>'seconds')::numeric>(p_evidence->'usage'->>'seconds')::numeric)
 then raise exception 'native_voice_evidence_conflict'; end if;
 insert into ivoc_private.native_voice_events(reservation_id,event_key,kind,evidence) values(r.id,p_evidence->>'eventId','usage',p_evidence);
 if p_evidence->'final'='true'::jsonb then
  update ivoc_private.native_voice_reservations set usage_status='REPORTED_FINAL',accounting_complete=true,
   state=case when terminal_confirmed_at is not null then 'closed' else state end where id=r.id returning * into r;
 end if;
 return jsonb_build_object('ok',true,'accounting_complete',r.accounting_complete,'accounting_scope','native_voice_seconds',
  'usage_seconds',(p_evidence->'usage'->>'seconds')::numeric,'duration_limit_reached',(p_evidence->'usage'->>'seconds')::numeric>=g.duration_ms/1000.0);

end;
$$;

create function public.ivoc_native_voice_record_terminal(p_reservation_id uuid, p_evidence jsonb) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
select grant_id into gid from ivoc_private.native_voice_reservations where id=p_reservation_id;
 select * into g from ivoc_private.native_voice_grants where id=gid for update;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id for update;
 if not found or g.id is null then raise exception 'native_voice_denied'; end if;
 t := clock_timestamp(); -- Lock waits cannot preserve stale admission time.
 if r.provider_session_id is null or p_evidence->>'providerSessionId' is distinct from r.provider_session_id
 or p_evidence->>'source' is distinct from 'provider_session_closed' or p_evidence->>'type' is distinct from 'session.closed'
 or coalesce(p_evidence->>'eventId','')!~'^[A-Za-z0-9_.:-]{1,160}$'
 or pg_column_size(p_evidence)>4096
 or exists(select 1 from jsonb_object_keys(p_evidence) k where k not in ('reservationId','kind','type','providerSessionId','eventId','source','reason'))
 or (p_evidence ? 'reason' and (jsonb_typeof(p_evidence->'reason') is distinct from 'string' or p_evidence->>'reason' not in ('close_requested','expired','content','remote_hangup','connection_lost'))) then raise exception 'native_voice_denied'; end if;
 if exists(select 1 from ivoc_private.native_voice_events where reservation_id=r.id and kind='terminal' and event_key=p_evidence->>'eventId' and evidence<>p_evidence)
 then raise exception 'native_voice_evidence_conflict'; end if;
 insert into ivoc_private.native_voice_events(reservation_id,event_key,kind,evidence) values(r.id,p_evidence->>'eventId','terminal',p_evidence) on conflict do nothing;
 update ivoc_private.native_voice_reservations set terminal_confirmed_at=coalesce(terminal_confirmed_at,t),
 state=case when accounting_complete then 'closed' else 'quarantined' end where id=r.id;
 return jsonb_build_object('ok',true,'provider_terminal_confirmed',true,'accounting_complete',r.accounting_complete,'accounting_scope','native_voice_seconds');

end;
$$;

create function public.ivoc_native_voice_quarantine(p_reservation_id uuid, p_reason text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog
as $$
declare g ivoc_private.native_voice_grants%rowtype; r ivoc_private.native_voice_reservations%rowtype; gid uuid; t timestamptz;

begin
select grant_id into gid from ivoc_private.native_voice_reservations where id=p_reservation_id;
 select * into g from ivoc_private.native_voice_grants where id=gid for update;
 select * into r from ivoc_private.native_voice_reservations where id=p_reservation_id for update;
 if not found or g.id is null then raise exception 'native_voice_denied'; end if;
 t := clock_timestamp(); -- Lock waits cannot preserve stale admission time.
 if p_reason is null or p_reason not in ('create_unknown','claim_unknown','binding_failed','cleanup_unconfirmed','accounting_unknown','persistence_failed','startup_failed','evidence_invalid') then raise exception 'native_voice_denied'; end if;
 update ivoc_private.native_voice_reservations set state=case when state='closed' then state else 'quarantined' end,reason=p_reason where id=r.id;
 return jsonb_build_object('ok',true,'quarantined',true);

end;
$$;

revoke all on function public.ivoc_native_voice_reserve(jsonb) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_reserve(jsonb) to service_role;
revoke all on function public.ivoc_native_voice_claim_create(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_claim_create(uuid,jsonb) to service_role;
revoke all on function public.ivoc_native_voice_bind_provider(uuid,text) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_bind_provider(uuid,text) to service_role;
revoke all on function public.ivoc_native_voice_heartbeat(uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_heartbeat(uuid,text,uuid,bigint) to service_role;
revoke all on function public.ivoc_native_voice_request_end(uuid,text) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_request_end(uuid,text) to service_role;
revoke all on function public.ivoc_native_voice_record_usage(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_record_usage(uuid,jsonb) to service_role;
revoke all on function public.ivoc_native_voice_record_terminal(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_record_terminal(uuid,jsonb) to service_role;
revoke all on function public.ivoc_native_voice_quarantine(uuid,text) from public,anon,authenticated;
grant execute on function public.ivoc_native_voice_quarantine(uuid,text) to service_role;
