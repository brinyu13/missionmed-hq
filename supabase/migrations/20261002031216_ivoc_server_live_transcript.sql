-- Server-observed transcript fragments only. This is not turn completion,
-- speaker identity, word alignment, or evidence of audio actually heard.
-- Additive and inactive until the server observer is deliberately wired.
create table public.ivoc_live_transcript_events (
  observation_id uuid not null,
  seq integer not null check (seq between 1 and 8194),
  session_id uuid not null references public.ivoc_sessions(id),
  owner_subject text not null check (owner_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  provider_session_id text not null check (provider_session_id ~ '^[A-Za-z0-9_-]{8,160}$'),
  kind text not null check (kind in ('attached', 'fragment', 'terminal')),
  speaker text,
  provider_event_id text check (provider_event_id is null or provider_event_id ~ '^[A-Za-z0-9_.:-]{1,160}$'),
  fragment_text text check (fragment_text is null or octet_length(fragment_text) <= 16384),
  provider_start_ms integer,
  provider_end_ms integer,
  server_received_at timestamptz not null,
  terminal_status text,
  terminal_reason text,
  database_received_at timestamptz not null default now(),
  primary key (observation_id, seq),
  constraint ivoc_live_fragment_shape check ((
    (kind = 'fragment' and seq > 1 and speaker in ('input', 'output')
      and fragment_text is not null and provider_start_ms between 0 and 86400000
      and provider_end_ms between provider_start_ms and 86400000
      and terminal_status is null and terminal_reason is null)
    or (kind in ('attached', 'terminal') and speaker is null
      and provider_event_id is null and fragment_text is null
      and provider_start_ms is null and provider_end_ms is null
      and ((kind = 'attached' and seq = 1 and terminal_status is null and terminal_reason is null)
        or (kind = 'terminal' and seq > 1
          and ((terminal_status = 'PROVIDER_CLOSED' and terminal_reason = 'provider_closed')
            or (terminal_status = 'INCOMPLETE' and terminal_reason in (
              'socket_closed', 'socket_error', 'connect_timeout', 'duration_limit',
              'finish_timeout', 'queue_limit', 'event_limit', 'byte_limit',
              'invalid_event', 'conflicting_event_id', 'persistence_failure',
              'persistence_timeout', 'connect_failure'))))))
  ) is true)
);
create index ivoc_live_transcript_session_idx
  on public.ivoc_live_transcript_events(session_id, owner_subject, observation_id, seq);
create unique index ivoc_live_transcript_provider_attachment_idx
  on public.ivoc_live_transcript_events(provider_session_id) where kind = 'attached';
create unique index ivoc_live_transcript_provider_event_idx
  on public.ivoc_live_transcript_events(observation_id, provider_event_id)
  where provider_event_id is not null;

create function public.ivoc_live_transcript_append_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare prior public.ivoc_live_transcript_events; root public.ivoc_live_transcript_events;
begin
  if tg_op <> 'INSERT' then raise exception 'ivoc_live_transcript_append_only'; end if;
  -- Serialize one observation, not all interview sessions.
  perform pg_advisory_xact_lock(hashtextextended('ivoc-live:' || new.observation_id::text, 0));
  select * into prior from public.ivoc_live_transcript_events
    where observation_id = new.observation_id and seq = new.seq;
  if found then
    if (to_jsonb(prior) - 'database_received_at') = (to_jsonb(new) - 'database_received_at') then return null; end if;
    raise exception 'ivoc_live_transcript_retry_conflict';
  end if;
  if not exists (select 1 from public.ivoc_sessions s
    where s.id = new.session_id and s.owner_subject = new.owner_subject
      and s.interviewer_provider = 'openai-gpt-live'
      and (new.kind <> 'attached' or s.state = 'active'))
    then raise exception 'ivoc_live_transcript_owner_binding_invalid'; end if;
  if new.kind = 'attached' then
    if new.seq <> 1 then raise exception 'ivoc_live_transcript_sequence_invalid'; end if;
    return new;
  end if;
  select * into root from public.ivoc_live_transcript_events
    where observation_id = new.observation_id and seq = 1;
  if not found or root.kind <> 'attached' or root.session_id <> new.session_id
    or root.owner_subject <> new.owner_subject or root.provider_session_id <> new.provider_session_id
    then raise exception 'ivoc_live_transcript_identity_invalid'; end if;
  select * into prior from public.ivoc_live_transcript_events
    where observation_id = new.observation_id order by seq desc limit 1;
  if prior.kind = 'terminal' or new.seq <> prior.seq + 1
    then raise exception 'ivoc_live_transcript_sequence_invalid'; end if;
  return new;
end;
$$;
revoke all on function public.ivoc_live_transcript_append_guard() from public, anon, authenticated, service_role;
create trigger ivoc_live_transcript_append_guard
  before insert or update or delete on public.ivoc_live_transcript_events
  for each row execute function public.ivoc_live_transcript_append_guard();
alter table public.ivoc_live_transcript_events enable row level security;
alter table public.ivoc_live_transcript_events force row level security;
revoke all on public.ivoc_live_transcript_events from public, anon, authenticated, service_role;
grant select, insert on public.ivoc_live_transcript_events to service_role;
comment on table public.ivoc_live_transcript_events is
  'Private server-observed GPT-Live fragments. Provider timeline is approximate; no completed-turn, word-boundary, microphone identity or heard-playback assertion. Missing terminal means incomplete.';
