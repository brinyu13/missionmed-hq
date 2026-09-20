begin;

create table public.ivoc_credit_accounts (
  subject_id text primary key check (subject_id ~ '^wp:[1-9][0-9]{0,19}$'),
  version integer not null check (version > 0),
  allowance_seconds bigint not null check (allowance_seconds between 0 and 10000000),
  override_seconds bigint not null check (override_seconds between 0 and 10000000),
  consumed_seconds bigint not null check (consumed_seconds >= 0),
  balance_seconds bigint generated always as (
    allowance_seconds + override_seconds - consumed_seconds
  ) stored,
  period_started_at timestamptz not null,
  period_ends_at timestamptz not null,
  updated_by text not null check (updated_by ~ '^wp:[1-9][0-9]{0,19}$'),
  updated_at timestamptz not null default clock_timestamp(),
  check (consumed_seconds <= allowance_seconds + override_seconds),
  check (period_ends_at > period_started_at)
);

create table public.ivoc_credit_events (
  event_id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  subject_id text not null check (subject_id ~ '^wp:[1-9][0-9]{0,19}$'),
  account_version integer not null check (account_version > 0),
  action text not null check (action in ('set_allowance', 'set_override', 'consume', 'reset')),
  amount_seconds bigint not null check (amount_seconds between 0 and 10000000),
  allowance_after bigint not null check (allowance_after between 0 and 10000000),
  override_after bigint not null check (override_after between 0 and 10000000),
  consumed_after bigint not null check (consumed_after >= 0),
  balance_after bigint not null check (balance_after >= 0),
  period_started_at timestamptz not null,
  period_ends_at timestamptz not null,
  reason text not null check (char_length(reason) between 3 and 400),
  actor_subject text not null check (actor_subject ~ '^wp:[1-9][0-9]{0,19}$'),
  created_at timestamptz not null default clock_timestamp(),
  check (consumed_after <= allowance_after + override_after),
  check (balance_after = allowance_after + override_after - consumed_after),
  check (period_ends_at > period_started_at)
);

create index ivoc_credit_events_subject_version_idx
  on public.ivoc_credit_events (subject_id, account_version desc);

create or replace function public.ivoc_mutate_user_credits(
  p_subject_id text,
  p_expected_version integer,
  p_action text,
  p_amount_seconds bigint,
  p_idempotency_key uuid,
  p_reason text,
  p_actor text
) returns table (
  subject_id text,
  version integer,
  allowance_seconds bigint,
  override_seconds bigint,
  consumed_seconds bigint,
  balance_seconds bigint,
  period_started_at timestamptz,
  period_ends_at timestamptz,
  updated_by text,
  updated_at timestamptz,
  event_id uuid,
  event_action text
) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  current_account public.ivoc_credit_accounts%rowtype;
  existing_event public.ivoc_credit_events%rowtype;
  config_credits jsonb;
  next_allowance bigint;
  next_override bigint;
  next_consumed bigint;
  next_started timestamptz;
  next_ends timestamptz;
  next_version integer;
  reset_days integer;
  max_override bigint;
  written_event_id uuid;
begin
  if p_subject_id is null or p_subject_id !~ '^wp:[1-9][0-9]{0,19}$'
     or p_expected_version is null or p_expected_version < 0
     or p_action is null or p_action not in ('set_allowance', 'set_override', 'consume', 'reset')
     or p_amount_seconds is null or p_amount_seconds not between 0 and 10000000
     or p_idempotency_key is null
     or p_reason is null or char_length(btrim(p_reason)) not between 3 and 400
     or p_actor is null or p_actor !~ '^wp:[1-9][0-9]{0,19}$' then
    raise exception 'ivoc_credit_input_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_subject_id, 4902));

  select events.* into existing_event
  from public.ivoc_credit_events events
  where events.idempotency_key = p_idempotency_key;
  if found then
    if existing_event.subject_id <> p_subject_id
       or existing_event.action <> p_action
       or existing_event.amount_seconds <> p_amount_seconds
       or existing_event.actor_subject <> p_actor then
      raise exception 'ivoc_credit_idempotency_conflict' using errcode = 'P0001';
    end if;
    return query select existing_event.subject_id, existing_event.account_version,
      existing_event.allowance_after, existing_event.override_after,
      existing_event.consumed_after, existing_event.balance_after,
      existing_event.period_started_at, existing_event.period_ends_at,
      existing_event.actor_subject, existing_event.created_at,
      existing_event.event_id, existing_event.action;
    return;
  end if;

  select config.credits into config_credits
  from public.ivoc_admin_config_versions config
  order by config.version desc
  limit 1;
  if config_credits is null then
    raise exception 'ivoc_credit_config_unavailable' using errcode = 'P0001';
  end if;
  reset_days := (config_credits->>'reset_period_days')::integer;
  max_override := (config_credits->>'max_override_seconds')::bigint;
  if reset_days not between 1 and 366 or max_override not between 0 and 10000000 then
    raise exception 'ivoc_credit_config_invalid' using errcode = 'P0001';
  end if;

  select accounts.* into current_account
  from public.ivoc_credit_accounts accounts
  where accounts.subject_id = p_subject_id
  for update;

  if not found then
    if p_expected_version <> 0 then
      raise exception 'ivoc_credit_version_conflict' using errcode = 'P0001';
    end if;
    current_account.subject_id := p_subject_id;
    current_account.version := 0;
    current_account.allowance_seconds := coalesce((config_credits->>'default_allowance_seconds')::bigint, 0);
    current_account.override_seconds := 0;
    current_account.consumed_seconds := 0;
    current_account.period_started_at := clock_timestamp();
    current_account.period_ends_at := current_account.period_started_at + make_interval(days => reset_days);
  elsif current_account.version <> p_expected_version then
    raise exception 'ivoc_credit_version_conflict' using errcode = 'P0001';
  end if;

  next_allowance := current_account.allowance_seconds;
  next_override := current_account.override_seconds;
  next_consumed := current_account.consumed_seconds;
  next_started := current_account.period_started_at;
  next_ends := current_account.period_ends_at;

  case p_action
    when 'set_allowance' then
      next_allowance := p_amount_seconds;
    when 'set_override' then
      if p_amount_seconds > max_override then
        raise exception 'ivoc_credit_override_exceeds_limit' using errcode = 'P0001';
      end if;
      next_override := p_amount_seconds;
    when 'consume' then
      if p_amount_seconds = 0 then
        raise exception 'ivoc_credit_input_invalid' using errcode = '22023';
      end if;
      next_consumed := next_consumed + p_amount_seconds;
    when 'reset' then
      if p_amount_seconds <> 0 then
        raise exception 'ivoc_credit_input_invalid' using errcode = '22023';
      end if;
      next_consumed := 0;
      next_started := clock_timestamp();
      next_ends := next_started + make_interval(days => reset_days);
  end case;

  if next_consumed > next_allowance + next_override then
    raise exception 'ivoc_credit_balance_insufficient' using errcode = 'P0001';
  end if;

  next_version := current_account.version + 1;
  insert into public.ivoc_credit_accounts (
    subject_id, version, allowance_seconds, override_seconds, consumed_seconds,
    period_started_at, period_ends_at, updated_by, updated_at
  ) values (
    p_subject_id, next_version, next_allowance, next_override, next_consumed,
    next_started, next_ends, p_actor, clock_timestamp()
  )
  on conflict (subject_id) do update set
    version = excluded.version,
    allowance_seconds = excluded.allowance_seconds,
    override_seconds = excluded.override_seconds,
    consumed_seconds = excluded.consumed_seconds,
    period_started_at = excluded.period_started_at,
    period_ends_at = excluded.period_ends_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.ivoc_credit_events (
    idempotency_key, subject_id, account_version, action, amount_seconds,
    allowance_after, override_after, consumed_after, balance_after,
    period_started_at, period_ends_at, reason, actor_subject
  ) values (
    p_idempotency_key, p_subject_id, next_version, p_action, p_amount_seconds,
    next_allowance, next_override, next_consumed,
    next_allowance + next_override - next_consumed,
    next_started, next_ends, btrim(p_reason), p_actor
  ) returning ivoc_credit_events.event_id into written_event_id;

  return query
  select account.subject_id, account.version, account.allowance_seconds,
    account.override_seconds, account.consumed_seconds, account.balance_seconds,
    account.period_started_at, account.period_ends_at, account.updated_by,
    account.updated_at, written_event_id, p_action
  from public.ivoc_credit_accounts account
  where account.subject_id = p_subject_id;
end;
$$;

alter table public.ivoc_credit_accounts enable row level security;
alter table public.ivoc_credit_accounts force row level security;
alter table public.ivoc_credit_events enable row level security;
alter table public.ivoc_credit_events force row level security;

revoke all on table public.ivoc_credit_accounts from public, anon, authenticated, service_role;
revoke all on table public.ivoc_credit_events from public, anon, authenticated, service_role;
grant select, insert, update on table public.ivoc_credit_accounts to service_role;
grant select, insert on table public.ivoc_credit_events to service_role;

revoke all on function public.ivoc_mutate_user_credits(
  text, integer, text, bigint, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.ivoc_mutate_user_credits(
  text, integer, text, bigint, uuid, text, text
) to service_role;

comment on table public.ivoc_credit_accounts is
  'Server-owned current IVOC per-user credit balance with optimistic versioning.';
comment on table public.ivoc_credit_events is
  'Append-only actor-stamped IVOC allowance, override, consumption and reset ledger.';

commit;
