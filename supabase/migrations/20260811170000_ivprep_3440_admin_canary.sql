-- Y1-Y2-CAM-V6-3440 offline-only schema candidate.
-- DR-052 prohibits applying this migration until a later exact database decision.

create table if not exists public.ivprep_entitlements (
  subject text primary key check (subject ~ '^wp:[1-9][0-9]{0,19}$'),
  revision text not null check (revision ~ '^[A-Za-z0-9._:-]{1,80}$'),
  founder boolean not null default false,
  voice_enabled boolean not null default false,
  video_enabled boolean not null default false,
  granted_video_seconds bigint not null default 0 check (granted_video_seconds >= 0),
  consumed_video_seconds bigint not null default 0 check (consumed_video_seconds >= 0),
  reserved_video_seconds bigint not null default 0 check (reserved_video_seconds >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consumed_video_seconds + reserved_video_seconds <= granted_video_seconds)
);

create table if not exists public.ivprep_cookie_revocations (
  cookie_fingerprint text primary key check (cookie_fingerprint ~ '^[a-f0-9]{64}$'),
  reason text not null check (char_length(reason) between 1 and 40),
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > revoked_at)
);

create table if not exists public.ivprep_interview_bindings (
  interview_id text primary key check (interview_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  subject text not null references public.ivprep_entitlements(subject) on update restrict on delete restrict,
  cookie_fingerprint text not null check (cookie_fingerprint ~ '^[a-f0-9]{64}$'),
  entitlement_revision text not null check (entitlement_revision ~ '^[A-Za-z0-9._:-]{1,80}$'),
  termination_requested boolean not null default false,
  termination_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (termination_reason is null or char_length(termination_reason) between 1 and 40),
  unique (interview_id, subject)
);

create index if not exists ivprep_interview_bindings_subject_idx
  on public.ivprep_interview_bindings (subject);

create table if not exists public.ivprep_provider_reservations (
  reservation_id text primary key check (reservation_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  interview_id text not null unique,
  subject text not null,
  test_number smallint not null check (test_number between 1 and 3),
  profile text not null check (profile = 'PROFILE_B_OPENAI_NATIVE_AUDIO'),
  reservation_nonce text not null unique check (reservation_nonce ~ '^[a-f0-9]{64}$'),
  agent_name text not null check (agent_name = 'ivprep-3440-profile-b'),
  participant_identity text not null check (participant_identity ~ '^[A-Za-z0-9._:-]{1,120}$'),
  reserved_seconds integer not null,
  consumed_seconds integer not null default 0 check (consumed_seconds between 0 and 59),
  refunded_seconds integer not null default 0 check (refunded_seconds between 0 and 59),
  state text not null check (state in ('RESERVED', 'DISPATCHED', 'WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY', 'TERMINATION_REQUESTED', 'RECONCILING', 'CLOSED', 'FAILED_CLOSED')),
  room_name text check (room_name is null or room_name ~ '^[A-Za-z0-9._:-]{1,120}$'),
  dispatch_id text,
  livekit_job_id text check (livekit_job_id is null or livekit_job_id ~ '^[A-Za-z0-9._:-]{1,120}$'),
  provider_create_attempted boolean not null default false,
  provider_session_hash text check (provider_session_hash is null or provider_session_hash ~ '^[a-f0-9]{64}$'),
  worker_claimed_at timestamptz,
  worker_joined_at timestamptz,
  browser_video_decoded_at timestamptz,
  browser_audio_playable_at timestamptz,
  media_ready_at timestamptz,
  audio_authority text check (audio_authority is null or audio_authority = 'avatar-livekit'),
  termination_requested boolean not null default false,
  termination_reason text check (termination_reason is null or char_length(termination_reason) between 1 and 40),
  termination_accepted boolean,
  provider_terminal_status text check (provider_terminal_status is null or provider_terminal_status in ('COMPLETED', 'TIMED_OUT', 'FAILED', 'UNRESOLVED')),
  provider_native_cost numeric check (
    provider_native_cost is null
    or (provider_native_cost >= 0 and provider_native_cost::text not in ('NaN', 'Infinity', '-Infinity'))
  ),
  cost_evidence text check (cost_evidence is null or cost_evidence in ('VERIFIED', 'NOT_EXPOSED', 'UNRESOLVED')),
  local_elapsed_ms bigint check (local_elapsed_ms is null or local_elapsed_ms between 0 and 59000),
  unknown_remote_create boolean not null default false,
  cleanup_failure_codes text[] not null default '{}'::text[] check (
    cardinality(cleanup_failure_codes) <= 8
    and array_to_string(cleanup_failure_codes, ',') ~ '^(?:[a-z0-9_]{1,40}(?:,[a-z0-9_]{1,40})*)?$'
  ),
  created_at timestamptz not null default now(),
  terminal_at timestamptz,
  foreign key (interview_id, subject) references public.ivprep_interview_bindings(interview_id, subject) on update restrict on delete restrict,
  foreign key (subject) references public.ivprep_entitlements(subject) on update restrict on delete restrict,
  check (
    (test_number in (1, 2) and reserved_seconds between 1 and 45)
    or (test_number = 3 and reserved_seconds between 1 and 59)
  ),
  check (consumed_seconds + refunded_seconds <= reserved_seconds),
  check (state in ('RESERVED', 'CLOSED', 'FAILED_CLOSED') or (room_name is not null and dispatch_id is not null)),
  check (state not in ('WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY', 'TERMINATION_REQUESTED', 'RECONCILING') or livekit_job_id is not null),
  check (state <> 'MEDIA_READY' or (worker_joined_at is not null and media_ready_at is not null and browser_video_decoded_at is not null and browser_audio_playable_at is not null and audio_authority = 'avatar-livekit' and provider_session_hash is not null)),
  check (local_elapsed_ms is null or local_elapsed_ms <= case when test_number = 3 then 59000 else 45000 end),
  check (terminal_at is null or state in ('CLOSED', 'FAILED_CLOSED'))
);

create unique index if not exists ivprep_provider_reservations_subject_test_unique
  on public.ivprep_provider_reservations (subject, test_number);

create unique index if not exists ivprep_provider_reservations_dispatch_unique
  on public.ivprep_provider_reservations (dispatch_id) where dispatch_id is not null;
create unique index if not exists ivprep_provider_reservations_room_unique
  on public.ivprep_provider_reservations (room_name) where room_name is not null;
create unique index if not exists ivprep_provider_reservations_job_unique
  on public.ivprep_provider_reservations (livekit_job_id) where livekit_job_id is not null;
create unique index if not exists ivprep_provider_reservations_session_unique
  on public.ivprep_provider_reservations (provider_session_hash) where provider_session_hash is not null;
create index if not exists ivprep_provider_reservations_subject_state_idx
  on public.ivprep_provider_reservations (subject, state);

create table if not exists public.ivprep_provider_control (
  singleton boolean primary key default true check (singleton),
  paid_tests_enabled boolean not null default false,
  kill_switch_tripped boolean not null default true,
  kill_reason text not null default 'not_activated' check (char_length(kill_reason) between 1 and 80),
  updated_at timestamptz not null default now()
);

insert into public.ivprep_provider_control (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.ivprep_validate_provider_reservation_eligibility()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  entitlement_is_founder boolean;
  entitlement_video_enabled boolean;
  entitlement_is_active boolean;
begin
  select founder, video_enabled, expires_at > now()
  into entitlement_is_founder, entitlement_video_enabled, entitlement_is_active
  from public.ivprep_entitlements
  where subject = new.subject;
  if entitlement_video_enabled is distinct from true or entitlement_is_active is distinct from true then
    raise exception 'A current video entitlement is required for a paid provider reservation.';
  end if;
  if new.test_number = 3 and entitlement_is_founder is distinct from true then
    raise exception 'Founder Test 3 requires a current Founder entitlement.';
  end if;
  return new;
end;
$$;

revoke all on function public.ivprep_validate_provider_reservation_eligibility() from public, anon, authenticated;
grant execute on function public.ivprep_validate_provider_reservation_eligibility() to service_role;

drop trigger if exists ivprep_provider_reservations_founder_guard on public.ivprep_provider_reservations;
drop trigger if exists ivprep_provider_reservations_eligibility_guard on public.ivprep_provider_reservations;
create trigger ivprep_provider_reservations_eligibility_guard
before insert or update of subject, test_number on public.ivprep_provider_reservations
for each row execute function public.ivprep_validate_provider_reservation_eligibility();

create or replace function public.ivprep_trip_provider_kill_switch(p_reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.ivprep_provider_control as control
  set kill_switch_tripped = true,
      paid_tests_enabled = false,
      kill_reason = case
        when p_reason ~ '^[a-z0-9_]{1,80}$' then p_reason
        else 'provider_contract_mismatch'
      end,
      updated_at = pg_catalog.now()
  where control.singleton;
end;
$$;

create or replace function public.ivprep_reserve_provider_test(
  p_reservation_id text,
  p_interview_id text,
  p_subject text,
  p_entitlement_revision text,
  p_test_number smallint,
  p_reserved_seconds integer,
  p_reservation_nonce text,
  p_participant_identity text,
  p_profile text,
  p_agent_name text
)
returns table (
  reservation_id text,
  reservation_nonce text,
  participant_identity text,
  reserved_seconds integer,
  reservation_state text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.ivprep_provider_reservations%rowtype;
  current_entitlement public.ivprep_entitlements%rowtype;
  matching_reservations integer;
begin
  perform 1
  from public.ivprep_provider_control as control
  where control.singleton
    and control.paid_tests_enabled
    and not control.kill_switch_tripped
  for update;
  if not found then
    return;
  end if;

  if p_reservation_id is null
    or p_interview_id is null
    or p_subject is null
    or p_entitlement_revision is null
    or p_test_number is null
    or p_reserved_seconds is null
    or p_reservation_nonce is null
    or p_participant_identity is null
    or p_profile is null
    or p_agent_name is null
    or p_reservation_id !~ '^[A-Za-z0-9._:-]{1,120}$'
    or p_interview_id !~ '^[A-Za-z0-9._:-]{1,120}$'
    or p_subject !~ '^wp:[1-9][0-9]{0,19}$'
    or p_entitlement_revision !~ '^[A-Za-z0-9._:-]{1,80}$'
    or p_reservation_nonce !~ '^[a-f0-9]{64}$'
    or p_participant_identity !~ '^[A-Za-z0-9._:-]{1,120}$'
    or p_profile <> 'PROFILE_B_OPENAI_NATIVE_AUDIO'
    or p_agent_name <> 'ivprep-3440-profile-b'
    or p_test_number not between 1 and 3
    or not (
      (p_test_number in (1, 2) and p_reserved_seconds between 1 and 45)
      or (p_test_number = 3 and p_reserved_seconds between 1 and 59)
    )
  then
    perform public.ivprep_trip_provider_kill_switch('provider_reservation_invalid');
    return;
  end if;

  select entitlement.*
  into current_entitlement
  from public.ivprep_entitlements as entitlement
  where entitlement.subject = p_subject
  for update;
  if not found
    or current_entitlement.revision <> p_entitlement_revision
    or not current_entitlement.video_enabled
    or current_entitlement.expires_at <= pg_catalog.now()
    or (p_test_number = 3 and not current_entitlement.founder)
  then
    perform public.ivprep_trip_provider_kill_switch('provider_entitlement_mismatch');
    return;
  end if;

  perform 1
  from public.ivprep_interview_bindings as binding
  where binding.interview_id = p_interview_id
    and binding.subject = p_subject
    and binding.entitlement_revision = p_entitlement_revision
    and not binding.termination_requested;
  if not found then
    perform public.ivprep_trip_provider_kill_switch('provider_binding_mismatch');
    return;
  end if;

  select pg_catalog.count(*)::integer
  into matching_reservations
  from public.ivprep_provider_reservations as reservation
  where reservation.reservation_nonce = p_reservation_nonce
     or (reservation.subject = p_subject and reservation.test_number = p_test_number);
  if matching_reservations > 1 then
    perform public.ivprep_trip_provider_kill_switch('provider_reservation_replay_mismatch');
    return;
  end if;

  select reservation.*
  into target
  from public.ivprep_provider_reservations as reservation
  where reservation.reservation_nonce = p_reservation_nonce
     or (reservation.subject = p_subject and reservation.test_number = p_test_number)
  order by reservation.reservation_id
  limit 1
  for update;
  if found then
    if target.reservation_id = p_reservation_id
      and target.interview_id = p_interview_id
      and target.subject = p_subject
      and target.test_number = p_test_number
      and target.reserved_seconds = p_reserved_seconds
      and target.reservation_nonce = p_reservation_nonce
      and target.participant_identity = p_participant_identity
      and target.profile = p_profile
      and target.agent_name = p_agent_name
    then
      return query values (
        target.reservation_id,
        target.reservation_nonce,
        target.participant_identity,
        target.reserved_seconds,
        target.state
      );
      return;
    end if;
    perform public.ivprep_trip_provider_kill_switch('provider_reservation_replay_mismatch');
    return;
  end if;

  begin
    update public.ivprep_entitlements as entitlement
    set reserved_video_seconds = entitlement.reserved_video_seconds + p_reserved_seconds,
        updated_at = pg_catalog.now()
    where entitlement.subject = p_subject
      and entitlement.revision = p_entitlement_revision
      and entitlement.video_enabled
      and entitlement.expires_at > pg_catalog.now()
      and entitlement.consumed_video_seconds + entitlement.reserved_video_seconds + p_reserved_seconds <= entitlement.granted_video_seconds;
    if not found then
      perform public.ivprep_trip_provider_kill_switch('provider_reservation_balance_mismatch');
      return;
    end if;

    insert into public.ivprep_provider_reservations (
      reservation_id,
      interview_id,
      subject,
      test_number,
      profile,
      reservation_nonce,
      agent_name,
      participant_identity,
      reserved_seconds,
      state
    ) values (
      p_reservation_id,
      p_interview_id,
      p_subject,
      p_test_number,
      p_profile,
      p_reservation_nonce,
      p_agent_name,
      p_participant_identity,
      p_reserved_seconds,
      'RESERVED'
    );
  exception
    when unique_violation or check_violation or foreign_key_violation or not_null_violation or raise_exception then
      perform public.ivprep_trip_provider_kill_switch('provider_reservation_cas_failed');
      return;
  end;

  return query values (
    p_reservation_id,
    p_reservation_nonce,
    p_participant_identity,
    p_reserved_seconds,
    'RESERVED'::text
  );
end;
$$;

create or replace function public.ivprep_bind_provider_dispatch(
  p_reservation_nonce text,
  p_dispatch_id text,
  p_room_name text,
  p_agent_name text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.ivprep_provider_control as control
  where control.singleton
    and control.paid_tests_enabled
    and not control.kill_switch_tripped
  for update;
  if not found then
    return false;
  end if;

  begin
    update public.ivprep_provider_reservations as reservation
    set room_name = p_room_name,
        dispatch_id = p_dispatch_id,
        state = 'DISPATCHED'
    where reservation.reservation_nonce = p_reservation_nonce
      and reservation.state = 'RESERVED'
      and reservation.test_number = 1
      and reservation.profile = 'PROFILE_B_OPENAI_NATIVE_AUDIO'
      and reservation.agent_name = p_agent_name
      and p_agent_name = 'ivprep-3440-profile-b'
      and p_reservation_nonce ~ '^[a-f0-9]{64}$'
      and p_dispatch_id ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_room_name ~ '^[A-Za-z0-9._:-]{1,120}$';
  exception
    when unique_violation or check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_dispatch_binding_mismatch');
      return false;
  end;
  if found then
    return true;
  end if;
  perform public.ivprep_trip_provider_kill_switch('provider_dispatch_binding_mismatch');
  return false;
end;
$$;

create or replace function public.ivprep_refund_provider_before_job(
  p_reservation_id text,
  p_reservation_nonce text,
  p_subject text,
  p_dispatch_deleted boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.ivprep_provider_reservations%rowtype;
  current_entitlement public.ivprep_entitlements%rowtype;
begin
  perform 1
  from public.ivprep_provider_control as control
  where control.singleton
  for update;

  select reservation.*
  into target
  from public.ivprep_provider_reservations as reservation
  where reservation.reservation_id = p_reservation_id
    and reservation.reservation_nonce = p_reservation_nonce
    and reservation.subject = p_subject
  for update;
  if not found then
    perform public.ivprep_trip_provider_kill_switch('provider_pre_job_refund_binding_mismatch');
    return false;
  end if;

  if target.state = 'CLOSED'
    and target.consumed_seconds = 0
    and target.refunded_seconds = target.reserved_seconds
    and target.livekit_job_id is null
    and not target.provider_create_attempted
    and target.provider_session_hash is null
  then
    return true;
  end if;

  if target.state not in ('RESERVED', 'DISPATCHED')
    or target.livekit_job_id is not null
    or target.provider_create_attempted
    or target.provider_session_hash is not null
    or (target.state = 'DISPATCHED' and p_dispatch_deleted is distinct from true)
  then
    perform public.ivprep_trip_provider_kill_switch('provider_pre_job_refund_unsafe');
    return false;
  end if;

  select entitlement.*
  into current_entitlement
  from public.ivprep_entitlements as entitlement
  where entitlement.subject = target.subject
  for update;
  if not found or current_entitlement.reserved_video_seconds < target.reserved_seconds then
    update public.ivprep_provider_reservations as reservation
    set state = 'FAILED_CLOSED',
        terminal_at = pg_catalog.now(),
        cleanup_failure_codes = array['pre_job_refund_ledger_mismatch']::text[]
    where reservation.reservation_id = target.reservation_id;
    perform public.ivprep_trip_provider_kill_switch('provider_pre_job_refund_ledger_mismatch');
    return false;
  end if;

  begin
    update public.ivprep_entitlements as entitlement
    set reserved_video_seconds = entitlement.reserved_video_seconds - target.reserved_seconds,
        updated_at = pg_catalog.now()
    where entitlement.subject = target.subject
      and entitlement.reserved_video_seconds >= target.reserved_seconds;
    if not found then
      raise exception using errcode = 'P0001', message = 'provider pre-job refund entitlement CAS failed';
    end if;

    update public.ivprep_provider_reservations as reservation
    set consumed_seconds = 0,
        refunded_seconds = reservation.reserved_seconds,
        termination_requested = true,
        termination_reason = 'pre_job_refund',
        termination_accepted = true,
        provider_terminal_status = null,
        provider_native_cost = 0,
        cost_evidence = 'VERIFIED',
        local_elapsed_ms = 0,
        unknown_remote_create = false,
        cleanup_failure_codes = '{}'::text[],
        terminal_at = pg_catalog.now(),
        state = 'CLOSED'
    where reservation.reservation_id = target.reservation_id
      and reservation.state = target.state
      and reservation.livekit_job_id is null
      and not reservation.provider_create_attempted;
    if not found then
      raise exception using errcode = 'P0001', message = 'provider pre-job refund reservation CAS failed';
    end if;
  exception
    when raise_exception or check_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_pre_job_refund_cas_failed');
      return false;
  end;
  return true;
end;
$$;

create or replace function public.ivprep_claim_provider_job(
  p_reservation_nonce text,
  p_job_id text,
  p_dispatch_id text,
  p_room_name text,
  p_agent_name text
)
returns table (
  reservation_id text,
  participant_identity text,
  reservation_nonce text,
  dispatch_id text,
  room_name text,
  agent_name text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.ivprep_provider_control as control
  where control.singleton
    and control.paid_tests_enabled
    and not control.kill_switch_tripped
  for update;
  if not found then
    return;
  end if;

  begin
    return query
    update public.ivprep_provider_reservations as reservation
    set livekit_job_id = p_job_id,
        worker_claimed_at = pg_catalog.now(),
        state = 'WORKER_CLAIMED'
    where reservation.reservation_nonce = p_reservation_nonce
      and reservation.dispatch_id = p_dispatch_id
      and reservation.room_name = p_room_name
      and reservation.agent_name = p_agent_name
      and reservation.state = 'DISPATCHED'
      and reservation.test_number = 1
      and reservation.profile = 'PROFILE_B_OPENAI_NATIVE_AUDIO'
      and reservation.livekit_job_id is null
      and not reservation.termination_requested
      and p_reservation_nonce ~ '^[a-f0-9]{64}$'
      and p_job_id ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_dispatch_id ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_room_name ~ '^[A-Za-z0-9._:-]{1,120}$'
      and p_agent_name = 'ivprep-3440-profile-b'
      and exists (
        select 1
        from public.ivprep_interview_bindings as binding
        join public.ivprep_entitlements as entitlement
          on entitlement.subject = binding.subject
         and entitlement.revision = binding.entitlement_revision
        where binding.interview_id = reservation.interview_id
          and binding.subject = reservation.subject
          and not binding.termination_requested
          and entitlement.video_enabled
          and entitlement.expires_at > pg_catalog.now()
      )
    returning reservation.reservation_id,
              reservation.participant_identity,
              reservation.reservation_nonce,
              reservation.dispatch_id,
              reservation.room_name,
              reservation.agent_name;
  exception
    when unique_violation or check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_job_claim_mismatch');
      return;
  end;
  if not found then
    perform public.ivprep_trip_provider_kill_switch('provider_job_claim_mismatch');
  end if;
end;
$$;

create or replace function public.ivprep_mark_provider_worker_joined(
  p_reservation_id text,
  p_reservation_nonce text,
  p_job_id text,
  p_dispatch_id text,
  p_room_name text,
  p_provider_session_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.ivprep_provider_control as control where control.singleton for update;
  begin
    update public.ivprep_provider_reservations as reservation
    set provider_create_attempted = true,
        provider_session_hash = p_provider_session_hash,
        worker_joined_at = pg_catalog.now(),
        audio_authority = 'avatar-livekit',
        state = 'WORKER_JOINED'
    where reservation.reservation_id = p_reservation_id
      and reservation.reservation_nonce = p_reservation_nonce
      and reservation.livekit_job_id = p_job_id
      and reservation.dispatch_id = p_dispatch_id
      and reservation.room_name = p_room_name
      and reservation.state = 'WORKER_CLAIMED'
      and not reservation.termination_requested
      and p_provider_session_hash ~ '^[a-f0-9]{64}$';
  exception
    when unique_violation or check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_worker_join_mismatch');
      return false;
  end;
  if found then
    return true;
  end if;
  perform public.ivprep_trip_provider_kill_switch('provider_worker_join_mismatch');
  return false;
end;
$$;

create or replace function public.ivprep_mark_provider_media_ready(
  p_reservation_id text,
  p_subject text,
  p_cookie_fingerprint text,
  p_entitlement_revision text,
  p_job_id text,
  p_dispatch_id text,
  p_browser_video_decoded boolean,
  p_browser_audio_playable boolean,
  p_audio_authority text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.ivprep_provider_control as control where control.singleton for update;
  begin
    update public.ivprep_provider_reservations as reservation
    set browser_video_decoded_at = pg_catalog.now(),
        browser_audio_playable_at = pg_catalog.now(),
        media_ready_at = pg_catalog.now(),
        state = 'MEDIA_READY'
    where reservation.reservation_id = p_reservation_id
      and reservation.subject = p_subject
      and reservation.livekit_job_id = p_job_id
      and reservation.dispatch_id = p_dispatch_id
      and reservation.state = 'WORKER_JOINED'
      and reservation.audio_authority = 'avatar-livekit'
      and p_browser_video_decoded
      and p_browser_audio_playable
      and p_audio_authority = 'avatar-livekit'
      and not reservation.termination_requested
      and exists (
        select 1
        from public.ivprep_interview_bindings as binding
        join public.ivprep_entitlements as entitlement
          on entitlement.subject = binding.subject
         and entitlement.revision = binding.entitlement_revision
        where binding.interview_id = reservation.interview_id
          and binding.subject = p_subject
          and binding.cookie_fingerprint = p_cookie_fingerprint
          and binding.entitlement_revision = p_entitlement_revision
          and not binding.termination_requested
          and entitlement.video_enabled
          and entitlement.expires_at > pg_catalog.now()
      );
  exception
    when check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_media_ready_mismatch');
      return false;
  end;
  if found then
    return true;
  end if;
  perform public.ivprep_trip_provider_kill_switch('provider_media_ready_mismatch');
  return false;
end;
$$;

create or replace function public.ivprep_request_provider_termination(
  p_reservation_id text,
  p_reservation_nonce text,
  p_reason text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.ivprep_provider_control as control where control.singleton for update;
  begin
    update public.ivprep_provider_reservations as reservation
    set termination_requested = true,
        termination_reason = p_reason,
        state = 'TERMINATION_REQUESTED'
    where reservation.reservation_id = p_reservation_id
      and reservation.reservation_nonce = p_reservation_nonce
      and reservation.state in ('WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY')
      and not reservation.termination_requested
      and p_reason ~ '^[a-z0-9_]{1,40}$';
  exception
    when check_violation or not_null_violation then
      perform public.ivprep_trip_provider_kill_switch('provider_termination_request_mismatch');
      return false;
  end;
  if found then
    return true;
  end if;
  perform public.ivprep_trip_provider_kill_switch('provider_termination_request_mismatch');
  return false;
end;
$$;

create or replace function public.ivprep_observe_provider_termination(
  p_reservation_id text,
  p_reservation_nonce text,
  p_job_id text,
  p_dispatch_id text
)
returns table (
  requested boolean,
  reason text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.ivprep_provider_control as control where control.singleton for update;
  return query
  select reservation.termination_requested,
         reservation.termination_reason
  from public.ivprep_provider_reservations as reservation
  where reservation.reservation_id = p_reservation_id
    and reservation.reservation_nonce = p_reservation_nonce
    and reservation.livekit_job_id = p_job_id
    and reservation.dispatch_id = p_dispatch_id
    and reservation.state in ('WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY', 'TERMINATION_REQUESTED');
  if not found then
    perform public.ivprep_trip_provider_kill_switch('provider_termination_signal_mismatch');
  end if;
end;
$$;

create or replace function public.ivprep_reconcile_provider_job(
  p_reservation_id text,
  p_reservation_nonce text,
  p_job_id text,
  p_dispatch_id text,
  p_provider_create_attempted boolean,
  p_provider_session_hash text,
  p_termination_accepted boolean,
  p_provider_terminal_status text,
  p_provider_native_cost numeric,
  p_cost_evidence text,
  p_local_elapsed_ms bigint,
  p_unknown_remote_create boolean,
  p_cleanup_failure_codes text[]
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.ivprep_provider_reservations%rowtype;
  current_entitlement public.ivprep_entitlements%rowtype;
  reconciliation_ok boolean;
  consumed integer;
begin
  perform 1 from public.ivprep_provider_control as control where control.singleton for update;
  select reservation.*
  into target
  from public.ivprep_provider_reservations as reservation
  where reservation.reservation_id = p_reservation_id
    and reservation.reservation_nonce = p_reservation_nonce
    and reservation.livekit_job_id = p_job_id
    and reservation.dispatch_id = p_dispatch_id
    and reservation.state not in ('CLOSED', 'FAILED_CLOSED')
  for update;
  if not found then
    update public.ivprep_provider_control as control
    set kill_switch_tripped = true,
        paid_tests_enabled = false,
        kill_reason = 'provider_reconciliation_binding_mismatch',
        updated_at = pg_catalog.now()
    where control.singleton;
    return false;
  end if;

  select entitlement.*
  into current_entitlement
  from public.ivprep_entitlements as entitlement
  where entitlement.subject = target.subject
  for update;
  if not found then
    update public.ivprep_provider_control as control
    set kill_switch_tripped = true,
        paid_tests_enabled = false,
        kill_reason = 'provider_reconciliation_entitlement_missing',
        updated_at = pg_catalog.now()
    where control.singleton;
    return false;
  end if;

  reconciliation_ok := p_unknown_remote_create is false
    and p_cleanup_failure_codes is not null
    and pg_catalog.cardinality(p_cleanup_failure_codes) = 0
    and p_provider_create_attempted is not null
    and p_provider_create_attempted = target.provider_create_attempted
    and (
      (not p_provider_create_attempted and p_provider_session_hash is null)
      or (
        p_provider_create_attempted
        and p_provider_session_hash = target.provider_session_hash
        and p_termination_accepted
        and p_provider_terminal_status = 'COMPLETED'
        and p_cost_evidence = 'VERIFIED'
        and p_provider_native_cost is not null
        and p_provider_native_cost >= 0
        and p_provider_native_cost::text not in ('NaN', 'Infinity', '-Infinity')
      )
    )
    and p_local_elapsed_ms is not null
    and p_local_elapsed_ms between 0 and (case when target.test_number = 3 then 59000 else 45000 end)
    and current_entitlement.reserved_video_seconds >= target.reserved_seconds;

  if reconciliation_ok then
    begin
      consumed := least(
        target.reserved_seconds,
        pg_catalog.ceil(p_local_elapsed_ms / 1000.0)::integer
      );
      update public.ivprep_provider_reservations as reservation
      set provider_create_attempted = p_provider_create_attempted,
          provider_session_hash = p_provider_session_hash,
          termination_accepted = coalesce(p_termination_accepted, false),
          provider_terminal_status = case
            when not p_provider_create_attempted then null
            else p_provider_terminal_status
          end,
          provider_native_cost = case
            when not p_provider_create_attempted then null
            else p_provider_native_cost
          end,
          cost_evidence = case
            when not p_provider_create_attempted then 'UNRESOLVED'
            else p_cost_evidence
          end,
          local_elapsed_ms = p_local_elapsed_ms,
          unknown_remote_create = false,
          cleanup_failure_codes = p_cleanup_failure_codes,
          consumed_seconds = consumed,
          refunded_seconds = reservation.reserved_seconds - consumed,
          terminal_at = pg_catalog.now(),
          state = 'CLOSED'
      where reservation.reservation_id = target.reservation_id
        and reservation.reservation_nonce = p_reservation_nonce
        and reservation.livekit_job_id = p_job_id
        and reservation.dispatch_id = p_dispatch_id
        and reservation.state in ('WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY', 'TERMINATION_REQUESTED', 'RECONCILING');
      if not found then
        raise exception using errcode = 'P0001', message = 'provider reconciliation reservation CAS failed';
      end if;

      update public.ivprep_entitlements as entitlement
      set reserved_video_seconds = entitlement.reserved_video_seconds - target.reserved_seconds,
          consumed_video_seconds = entitlement.consumed_video_seconds + consumed,
          updated_at = pg_catalog.now()
      where entitlement.subject = target.subject
        and entitlement.reserved_video_seconds >= target.reserved_seconds
        and entitlement.consumed_video_seconds + consumed
          + entitlement.reserved_video_seconds - target.reserved_seconds <= entitlement.granted_video_seconds;
      if not found then
        raise exception using errcode = 'P0001', message = 'provider reconciliation entitlement CAS failed';
      end if;
    exception
      when raise_exception or check_violation or unique_violation or foreign_key_violation or not_null_violation or numeric_value_out_of_range then
        update public.ivprep_provider_reservations as reservation
        set cleanup_failure_codes = array['provider_reconciliation_cas_failed']::text[],
            terminal_at = pg_catalog.now(),
            state = 'FAILED_CLOSED'
        where reservation.reservation_id = target.reservation_id
          and reservation.reservation_nonce = p_reservation_nonce
          and reservation.livekit_job_id = p_job_id
          and reservation.dispatch_id = p_dispatch_id
          and reservation.state not in ('CLOSED', 'FAILED_CLOSED');
        perform public.ivprep_trip_provider_kill_switch('provider_reconciliation_cas_failed');
        return false;
    end;
    return true;
  end if;

  update public.ivprep_provider_reservations as reservation
  set provider_create_attempted = reservation.provider_create_attempted or coalesce(p_provider_create_attempted, false),
      termination_accepted = coalesce(p_termination_accepted, false),
      provider_terminal_status = case when p_provider_terminal_status in ('COMPLETED', 'TIMED_OUT', 'FAILED') then p_provider_terminal_status else 'UNRESOLVED' end,
      provider_native_cost = case
        when p_provider_native_cost >= 0 and p_provider_native_cost::text not in ('NaN', 'Infinity', '-Infinity') then p_provider_native_cost
        else null
      end,
      cost_evidence = case when p_cost_evidence in ('VERIFIED', 'NOT_EXPOSED') then p_cost_evidence else 'UNRESOLVED' end,
      local_elapsed_ms = case
        when p_local_elapsed_ms between 0 and (case when target.test_number = 3 then 59000 else 45000 end) then p_local_elapsed_ms
        else target.reserved_seconds * 1000
      end,
      unknown_remote_create = (
        reservation.unknown_remote_create
        or coalesce(p_unknown_remote_create, true)
        or (
          (reservation.provider_create_attempted or coalesce(p_provider_create_attempted, false))
          and reservation.provider_session_hash is null
        )
        or (p_provider_create_attempted is distinct from reservation.provider_create_attempted)
      ),
      cleanup_failure_codes = case
        when p_cleanup_failure_codes is not null
          and pg_catalog.cardinality(p_cleanup_failure_codes) <= 8
          and pg_catalog.array_to_string(p_cleanup_failure_codes, ',') ~ '^(?:[a-z0-9_]{1,40}(?:,[a-z0-9_]{1,40})*)?$'
        then p_cleanup_failure_codes
        else array['invalid_cleanup_evidence']::text[]
      end,
      terminal_at = pg_catalog.now(),
      state = 'FAILED_CLOSED'
  where reservation.reservation_id = target.reservation_id
    and reservation.reservation_nonce = p_reservation_nonce
    and reservation.livekit_job_id = p_job_id
    and reservation.dispatch_id = p_dispatch_id
    and reservation.state not in ('CLOSED', 'FAILED_CLOSED');
  perform public.ivprep_trip_provider_kill_switch('provider_reconciliation_unresolved');
  return false;
end;
$$;

revoke all on function public.ivprep_trip_provider_kill_switch(text) from public, anon, authenticated;
revoke all on function public.ivprep_reserve_provider_test(text, text, text, text, smallint, integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ivprep_bind_provider_dispatch(text, text, text, text) from public, anon, authenticated;
revoke all on function public.ivprep_refund_provider_before_job(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.ivprep_claim_provider_job(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ivprep_mark_provider_worker_joined(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ivprep_mark_provider_media_ready(text, text, text, text, text, text, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.ivprep_request_provider_termination(text, text, text) from public, anon, authenticated;
revoke all on function public.ivprep_observe_provider_termination(text, text, text, text) from public, anon, authenticated;
revoke all on function public.ivprep_reconcile_provider_job(text, text, text, text, boolean, text, boolean, text, numeric, text, bigint, boolean, text[]) from public, anon, authenticated;

grant execute on function public.ivprep_trip_provider_kill_switch(text) to service_role;
grant execute on function public.ivprep_reserve_provider_test(text, text, text, text, smallint, integer, text, text, text, text) to service_role;
grant execute on function public.ivprep_bind_provider_dispatch(text, text, text, text) to service_role;
grant execute on function public.ivprep_refund_provider_before_job(text, text, text, boolean) to service_role;
grant execute on function public.ivprep_claim_provider_job(text, text, text, text, text) to service_role;
grant execute on function public.ivprep_mark_provider_worker_joined(text, text, text, text, text, text) to service_role;
grant execute on function public.ivprep_mark_provider_media_ready(text, text, text, text, text, text, boolean, boolean, text) to service_role;
grant execute on function public.ivprep_request_provider_termination(text, text, text) to service_role;
grant execute on function public.ivprep_observe_provider_termination(text, text, text, text) to service_role;
grant execute on function public.ivprep_reconcile_provider_job(text, text, text, text, boolean, text, boolean, text, numeric, text, bigint, boolean, text[]) to service_role;

create table if not exists public.ivprep_idempotency (
  idempotency_hash text primary key check (idempotency_hash ~ '^[a-f0-9]{64}$'),
  subject text not null references public.ivprep_entitlements(subject) on update restrict on delete restrict,
  operation text not null check (operation in ('interview_start', 'interview_end', 'provider_reserve', 'provider_reconcile')),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_reference text check (response_reference is null or response_reference ~ '^[A-Za-z0-9._:-]{1,120}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index if not exists ivprep_idempotency_subject_idx
  on public.ivprep_idempotency (subject);

alter table public.ivprep_entitlements enable row level security;
alter table public.ivprep_entitlements force row level security;
alter table public.ivprep_cookie_revocations enable row level security;
alter table public.ivprep_cookie_revocations force row level security;
alter table public.ivprep_interview_bindings enable row level security;
alter table public.ivprep_interview_bindings force row level security;
alter table public.ivprep_provider_reservations enable row level security;
alter table public.ivprep_provider_reservations force row level security;
alter table public.ivprep_provider_control enable row level security;
alter table public.ivprep_provider_control force row level security;
alter table public.ivprep_idempotency enable row level security;
alter table public.ivprep_idempotency force row level security;

revoke all on table public.ivprep_entitlements from public, anon, authenticated;
revoke all on table public.ivprep_cookie_revocations from public, anon, authenticated;
revoke all on table public.ivprep_interview_bindings from public, anon, authenticated;
revoke all on table public.ivprep_provider_reservations from public, anon, authenticated;
revoke all on table public.ivprep_provider_control from public, anon, authenticated;
revoke all on table public.ivprep_idempotency from public, anon, authenticated;

grant select, insert, update on table public.ivprep_entitlements to service_role;
grant select, insert, update on table public.ivprep_cookie_revocations to service_role;
grant select, insert, update on table public.ivprep_interview_bindings to service_role;
grant select, insert, update on table public.ivprep_provider_reservations to service_role;
grant select, insert, update on table public.ivprep_provider_control to service_role;
grant select, insert, update on table public.ivprep_idempotency to service_role;

comment on table public.ivprep_entitlements is 'IV Prep server-side entitlement ledger; no browser access.';
comment on table public.ivprep_cookie_revocations is 'Domain-separated HQ cookie fingerprints only; never raw cookies.';
comment on table public.ivprep_interview_bindings is 'WP subject, cookie fingerprint, and entitlement revision ownership binding.';
comment on table public.ivprep_provider_reservations is 'Single-dispatch paid-provider reservation and terminal reconciliation ledger.';
comment on table public.ivprep_provider_control is 'Deny-by-default paid-provider kill switch; one server-only row.';
comment on table public.ivprep_idempotency is 'Hashed server-side idempotency records; never raw authorization material.';
