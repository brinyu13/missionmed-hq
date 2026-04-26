-- VERSION: QSTAT_BACKEND_PATCH_003
-- CHANGES:
-- 1. event_seq made race-safe
-- 2. question_set_id added
-- 3. bot payload hash added
-- ============================================================================
-- TOURNAMED QSTAT CORE (DAY 1)
-- Implements a server-authoritative async duel system with lean activation.
-- Active logic: player_profiles, duel_challenges, duel_attempts, duel_events,
-- duel_results, daily_rounds, daily_participation.
-- Inactive logic placeholders only: duel_settlements.
-- ============================================================================

begin;
create extension if not exists pgcrypto;
-- ---------------------------------------------------------------------------
-- Shared trigger utility
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.player_profiles (
  player_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  rating integer not null default 1200 check (rating >= 100),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  duel_streak integer not null default 0 check (duel_streak >= 0),
  best_duel_streak integer not null default 0 check (best_duel_streak >= 0),
  daily_streak integer not null default 0 check (daily_streak >= 0),
  best_daily_streak integer not null default 0 check (best_daily_streak >= 0),
  last_daily_round_date date,
  no_show_strikes integer not null default 0 check (no_show_strikes >= 0),
  diagnostic_score numeric,
  diagnostic_tags jsonb not null default '[]'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.bot_profiles (
  id uuid primary key default gen_random_uuid(),
  bot_key text not null unique,
  display_name text not null,
  tier text not null check (tier in ('resident', 'attending', 'chief')),
  accuracy_target numeric(5,4) not null check (accuracy_target >= 0 and accuracy_target <= 1),
  median_time_ms integer not null check (median_time_ms > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.duel_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.player_profiles(player_id) on delete cascade,
  opponent_id uuid references public.player_profiles(player_id) on delete cascade,
  is_bot_match boolean not null default false,
  bot_profile_id uuid references public.bot_profiles(id),
  is_ranked boolean not null default true,
  source text not null default 'direct',
  question_set jsonb not null,
  state text not null default 'pending' check (
    state in (
      'created',
      'pending',
      'accepted',
      'player1_complete',
      'player2_complete',
      'completed',
      'expired',
      'settled'
    )
  ),
  create_idempotency_key text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  challenge_expires_at timestamptz not null default (now() + interval '24 hours'),
  match_expires_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (is_bot_match = false and opponent_id is not null and bot_profile_id is null)
    or
    (is_bot_match = true and opponent_id is null and bot_profile_id is not null)
  ),
  unique (challenger_id, create_idempotency_key)
);
create table if not exists public.duel_attempts (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duel_challenges(id) on delete cascade,
  player_id uuid references public.player_profiles(player_id) on delete cascade,
  bot_profile_id uuid references public.bot_profiles(id),
  is_bot_attempt boolean not null default false,
  attempt_status text not null default 'submitted' check (
    attempt_status in ('submitted', 'expired', 'forfeit')
  ),
  answers jsonb not null default '[]'::jsonb,
  total_questions integer not null default 0 check (total_questions >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  total_time_ms integer not null default 0 check (total_time_ms >= 0),
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  submit_idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_bot_attempt = false and player_id is not null and bot_profile_id is null)
    or
    (is_bot_attempt = true and player_id is null and bot_profile_id is not null)
  ),
  unique (duel_id, player_id),
  unique (player_id, submit_idempotency_key),
  unique (duel_id, bot_profile_id)
);
create table if not exists public.duel_events (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duel_challenges(id) on delete cascade,
  event_seq integer not null check (event_seq > 0),
  event_type text not null,
  actor_player_id uuid references public.player_profiles(player_id) on delete set null,
  actor_bot_id uuid references public.bot_profiles(id) on delete set null,
  question_index integer,
  is_correct boolean,
  response_ms integer,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (duel_id, event_seq),
  unique (duel_id, idempotency_key)
);
create table if not exists public.duel_results (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null unique references public.duel_challenges(id) on delete cascade,
  outcome text not null check (
    outcome in ('score_win', 'default_win', 'tie', 'void', 'challenge_expired')
  ),
  winner_player_id uuid references public.player_profiles(player_id) on delete set null,
  loser_player_id uuid references public.player_profiles(player_id) on delete set null,
  winner_bot_id uuid references public.bot_profiles(id) on delete set null,
  loser_bot_id uuid references public.bot_profiles(id) on delete set null,
  winner_score integer,
  loser_score integer,
  winner_time_ms integer,
  loser_time_ms integer,
  is_ranked boolean not null default true,
  rating_delta_winner integer not null default 0,
  rating_delta_loser integer not null default 0,
  finalized_at timestamptz not null default now(),
  finalize_idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb
);
-- Created but intentionally inactive for Day 1 logic.
create table if not exists public.duel_settlements (
  id uuid primary key default gen_random_uuid(),
  duel_result_id uuid not null unique references public.duel_results(id) on delete cascade,
  settlement_status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duel_challenges(id) on delete cascade,
  bot_profile_id uuid not null references public.bot_profiles(id) on delete cascade,
  run_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (duel_id, bot_profile_id)
);
alter table public.duel_challenges
  add column if not exists last_event_seq integer not null default 0;
alter table public.duel_challenges
  add column if not exists question_set_id uuid;
alter table public.bot_runs
  add column if not exists payload_hash text;
create table if not exists public.daily_rounds (
  id uuid primary key default gen_random_uuid(),
  round_date date not null unique,
  question_set jsonb not null,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.daily_participation (
  id uuid primary key default gen_random_uuid(),
  daily_round_id uuid not null references public.daily_rounds(id) on delete cascade,
  player_id uuid not null references public.player_profiles(player_id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  total_questions integer not null check (total_questions >= 0),
  correct_count integer not null check (correct_count >= 0),
  total_time_ms integer not null check (total_time_ms >= 0),
  score integer not null,
  rating_delta integer not null default 0,
  streak_after integer not null default 0,
  completed_at timestamptz not null default now(),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (daily_round_id, player_id),
  unique (player_id, idempotency_key)
);
-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_player_profiles_rating on public.player_profiles (rating);
create index if not exists idx_player_profiles_last_active on public.player_profiles (last_active_at desc);
create index if not exists idx_duel_challenges_challenger_state
  on public.duel_challenges (challenger_id, state, created_at desc);
create index if not exists idx_duel_challenges_opponent_state
  on public.duel_challenges (opponent_id, state, created_at desc);
create index if not exists idx_duel_challenges_bot_state
  on public.duel_challenges (is_bot_match, state, created_at desc);
create index if not exists idx_duel_challenges_expiry
  on public.duel_challenges (challenge_expires_at, match_expires_at);
create index if not exists idx_duel_attempts_duel on public.duel_attempts (duel_id);
create index if not exists idx_duel_attempts_player on public.duel_attempts (player_id, submitted_at desc);
create index if not exists idx_duel_events_duel_seq on public.duel_events (duel_id, event_seq);
create index if not exists idx_duel_events_duel_created on public.duel_events (duel_id, created_at);
create index if not exists idx_daily_rounds_date_status on public.daily_rounds (round_date, status);
create index if not exists idx_daily_participation_round_score_time
  on public.daily_participation (daily_round_id, score desc, total_time_ms asc, completed_at asc);
create index if not exists idx_daily_participation_player_date
  on public.daily_participation (player_id, completed_at desc);
-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_player_profiles_updated_at') then
    create trigger trg_player_profiles_updated_at
    before update on public.player_profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_bot_profiles_updated_at') then
    create trigger trg_bot_profiles_updated_at
    before update on public.bot_profiles
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_duel_challenges_updated_at') then
    create trigger trg_duel_challenges_updated_at
    before update on public.duel_challenges
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_duel_attempts_updated_at') then
    create trigger trg_duel_attempts_updated_at
    before update on public.duel_attempts
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_daily_rounds_updated_at') then
    create trigger trg_daily_rounds_updated_at
    before update on public.daily_rounds
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_duel_settlements_updated_at') then
    create trigger trg_duel_settlements_updated_at
    before update on public.duel_settlements
    for each row execute function public.set_updated_at();
  end if;
end
$$;
-- ---------------------------------------------------------------------------
-- Seed baseline bot roster (idempotent)
-- ---------------------------------------------------------------------------
insert into public.bot_profiles (bot_key, display_name, tier, accuracy_target, median_time_ms)
values
  ('resident_halsted', 'Dr. Halsted', 'resident', 0.65, 22000),
  ('attending_osler', 'Dr. Osler', 'attending', 0.78, 16000),
  ('chief_apgar', 'Dr. Apgar', 'chief', 0.88, 11000)
on conflict (bot_key) do update
set
  display_name = excluded.display_name,
  tier = excluded.tier,
  accuracy_target = excluded.accuracy_target,
  median_time_ms = excluded.median_time_ms,
  active = true,
  updated_at = now();
-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public.ensure_player_profile(p_player_id uuid)
returns public.player_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.player_profiles;
begin
  insert into public.player_profiles (player_id, last_active_at)
  values (p_player_id, now())
  on conflict (player_id) do update
  set
    last_active_at = now(),
    updated_at = now();

  select * into v_profile
  from public.player_profiles
  where player_id = p_player_id;

  return v_profile;
end;
$$;
create or replace function public.private_default_question_set(p_total_questions integer default 10)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', format('q%s', g),
        'correct_answer', (array['A','B','C','D'])[1 + ((g - 1) % 4)]
      )
      order by g
    ),
    '[]'::jsonb
  )
  from generate_series(1, greatest(1, p_total_questions)) as g;
$$;
create or replace function public.private_append_duel_event(
  p_duel_id uuid,
  p_event_type text,
  p_idempotency_key text,
  p_actor_player_id uuid default null,
  p_actor_bot_id uuid default null,
  p_question_index integer default null,
  p_is_correct boolean default null,
  p_response_ms integer default null,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_seq integer;
  v_next_seq integer;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required_for_event';
  end if;

  select e.event_seq
  into v_existing_seq
  from public.duel_events e
  where e.duel_id = p_duel_id
    and e.idempotency_key = p_idempotency_key;

  if v_existing_seq is not null then
    return v_existing_seq;
  end if;

  -- Atomically allocate strictly monotonic sequence per duel.
  update public.duel_challenges
  set last_event_seq = last_event_seq + 1
  where id = p_duel_id
  returning last_event_seq into v_next_seq;

  if v_next_seq is null then
    raise exception 'duel_not_found';
  end if;

  insert into public.duel_events (
    duel_id,
    event_seq,
    event_type,
    actor_player_id,
    actor_bot_id,
    question_index,
    is_correct,
    response_ms,
    payload,
    idempotency_key
  )
  values (
    p_duel_id,
    v_next_seq,
    p_event_type,
    p_actor_player_id,
    p_actor_bot_id,
    p_question_index,
    p_is_correct,
    p_response_ms,
    coalesce(p_payload, '{}'::jsonb),
    p_idempotency_key
  );

  return v_next_seq;
end;
$$;
create or replace function public.private_score_answers(
  p_question_set jsonb,
  p_answers jsonb,
  p_fallback_total_time_ms integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question jsonb;
  v_answer jsonb;
  v_normalized jsonb := '[]'::jsonb;
  v_qid text;
  v_selected text;
  v_correct_answer text;
  v_q_time_ms integer;
  v_is_correct boolean;
  v_correct_count integer := 0;
  v_total_questions integer := 0;
  v_total_time_ms integer := 0;
begin
  for v_question in
    select value from jsonb_array_elements(coalesce(p_question_set, '[]'::jsonb)) as q(value)
  loop
    v_total_questions := v_total_questions + 1;

    v_qid := coalesce(v_question->>'question_id', format('q%s', v_total_questions));
    v_correct_answer := coalesce(v_question->>'correct_answer', v_question->>'answer', '');

    select value
    into v_answer
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as a(value)
    where coalesce(value->>'question_id', value->>'id', value->>'q') = v_qid
    limit 1;

    if v_answer is null then
      v_answer := '{}'::jsonb;
    end if;

    v_selected := coalesce(v_answer->>'selected_answer', v_answer->>'answer', '');

    if coalesce(v_answer->>'time_ms', '') ~ '^[0-9]+$' then
      v_q_time_ms := (v_answer->>'time_ms')::integer;
    else
      v_q_time_ms := 0;
    end if;

    v_is_correct := (
      v_correct_answer <> ''
      and v_selected <> ''
      and lower(v_correct_answer) = lower(v_selected)
    );

    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_total_time_ms := v_total_time_ms + greatest(0, coalesce(v_q_time_ms, 0));

    v_normalized := v_normalized || jsonb_build_array(
      jsonb_build_object(
        'question_id', v_qid,
        'selected_answer', v_selected,
        'correct_answer', v_correct_answer,
        'is_correct', v_is_correct,
        'time_ms', greatest(0, coalesce(v_q_time_ms, 0))
      )
    );
  end loop;

  if v_total_time_ms = 0 then
    v_total_time_ms := greatest(0, coalesce(p_fallback_total_time_ms, 0));
  end if;

  return jsonb_build_object(
    'answers', v_normalized,
    'correct_count', v_correct_count,
    'total_questions', v_total_questions,
    'total_time_ms', v_total_time_ms,
    'score', v_correct_count
  );
end;
$$;
create or replace function public.private_generate_bot_attempt(
  p_duel_id uuid,
  p_bot_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.duel_challenges%rowtype;
  v_bot public.bot_profiles%rowtype;
  v_existing_attempt public.duel_attempts%rowtype;
  v_question jsonb;
  v_answers jsonb := '[]'::jsonb;
  v_qid text;
  v_correct_answer text;
  v_selected text;
  v_time_ms integer;
  v_is_correct boolean;
  v_correct integer := 0;
  v_total integer := 0;
  v_total_time integer := 0;
  v_score jsonb;
  v_payload_hash text;
  v_idx integer := 0;
begin
  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'duel_not_found';
  end if;

  select * into v_bot
  from public.bot_profiles
  where id = p_bot_profile_id
    and active = true;

  if not found then
    raise exception 'bot_profile_not_found_or_inactive';
  end if;

  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and bot_profile_id = p_bot_profile_id;

  if found then
    return jsonb_build_object(
      'status', 'exists',
      'attempt_id', v_existing_attempt.id,
      'correct_count', v_existing_attempt.correct_count,
      'total_questions', v_existing_attempt.total_questions,
      'total_time_ms', v_existing_attempt.total_time_ms
    );
  end if;

  for v_question in
    select value from jsonb_array_elements(coalesce(v_duel.question_set, '[]'::jsonb)) as q(value)
  loop
    v_idx := v_idx + 1;
    v_total := v_total + 1;
    v_qid := coalesce(v_question->>'question_id', format('q%s', v_idx));
    v_correct_answer := coalesce(v_question->>'correct_answer', 'A');

    v_is_correct := (random() <= v_bot.accuracy_target);

    if v_is_correct then
      v_selected := v_correct_answer;
      v_correct := v_correct + 1;
    else
      -- Deterministic wrong fallback on same alphabet used by default set.
      v_selected := case upper(v_correct_answer)
        when 'A' then 'B'
        when 'B' then 'C'
        when 'C' then 'D'
        else 'A'
      end;
    end if;

    v_time_ms := greatest(
      250,
      v_bot.median_time_ms + ((random() - 0.5) * v_bot.median_time_ms * 0.6)::integer
    );

    v_total_time := v_total_time + v_time_ms;

    v_answers := v_answers || jsonb_build_array(
      jsonb_build_object(
        'question_id', v_qid,
        'selected_answer', v_selected,
        'correct_answer', v_correct_answer,
        'is_correct', v_is_correct,
        'time_ms', v_time_ms
      )
    );
  end loop;

  v_score := jsonb_build_object(
    'answers', v_answers,
    'correct_count', v_correct,
    'total_questions', v_total,
    'total_time_ms', v_total_time,
    'score', v_correct
  );

  v_payload_hash := encode(digest(v_score::text, 'sha256'), 'hex');

  insert into public.bot_runs (duel_id, bot_profile_id, run_payload, payload_hash)
  values (p_duel_id, p_bot_profile_id, v_score, v_payload_hash)
  on conflict (duel_id, bot_profile_id) do update
  set run_payload = excluded.run_payload,
      payload_hash = excluded.payload_hash;

  insert into public.duel_attempts (
    duel_id,
    bot_profile_id,
    is_bot_attempt,
    attempt_status,
    answers,
    total_questions,
    correct_count,
    total_time_ms,
    started_at,
    submitted_at,
    submit_idempotency_key
  )
  values (
    p_duel_id,
    p_bot_profile_id,
    true,
    'submitted',
    v_answers,
    v_total,
    v_correct,
    v_total_time,
    now(),
    now(),
    format('bot-submit:%s:%s', p_duel_id, p_bot_profile_id)
  );

  -- Write bot per-question events.
  v_idx := 0;
  for v_question in
    select value from jsonb_array_elements(v_answers) as a(value)
  loop
    v_idx := v_idx + 1;
    perform public.private_append_duel_event(
      p_duel_id,
      'question_answered',
      format('bot-event:%s:%s:%s', p_duel_id, p_bot_profile_id, v_idx),
      null,
      p_bot_profile_id,
      v_idx,
      (v_question->>'is_correct')::boolean,
      (v_question->>'time_ms')::integer,
      jsonb_build_object('question_id', v_question->>'question_id')
    );
  end loop;

  perform public.private_append_duel_event(
    p_duel_id,
    'attempt_submitted',
    format('bot-attempt-submitted:%s:%s', p_duel_id, p_bot_profile_id),
    null,
    p_bot_profile_id,
    null,
    null,
    null,
    jsonb_build_object(
      'correct_count', v_correct,
      'total_questions', v_total,
      'total_time_ms', v_total_time
    )
  );

  return jsonb_build_object(
    'status', 'created',
    'bot_profile_id', p_bot_profile_id,
    'correct_count', v_correct,
    'total_questions', v_total,
    'total_time_ms', v_total_time
  );
end;
$$;
create or replace function public.private_finalize_duel_core(
  p_duel_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.duel_challenges%rowtype;
  v_result public.duel_results%rowtype;
  v_attempt_challenger public.duel_attempts%rowtype;
  v_attempt_opponent public.duel_attempts%rowtype;
  v_now timestamptz := now();
  v_outcome text;
  v_final_state text;
  v_final_key text;

  v_ch_rating integer;
  v_op_rating integer;
  v_expected_ch numeric;
  v_actual_ch numeric;
  v_k integer;
  v_delta_ch integer := 0;
  v_delta_op integer := 0;

  v_winner_player_id uuid;
  v_loser_player_id uuid;
  v_winner_bot_id uuid;
  v_loser_bot_id uuid;
  v_winner_score integer;
  v_loser_score integer;
  v_winner_time integer;
  v_loser_time integer;

  v_ch_win boolean := false;
  v_op_win boolean := false;
  v_tie boolean := false;

  v_is_ranked boolean;
begin
  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  v_final_key := coalesce(nullif(btrim(p_idempotency_key), ''), format('auto:%s', p_duel_id));
  v_final_key := format('%s:%s', p_duel_id, v_final_key);

  select * into v_result
  from public.duel_results
  where duel_id = p_duel_id;

  if found then
    return jsonb_build_object(
      'status', 'ok',
      'idempotent', true,
      'duel_id', p_duel_id,
      'result', to_jsonb(v_result)
    );
  end if;

  -- Challenge expired before acceptance.
  if v_duel.state in ('created', 'pending') then
    if v_now < v_duel.challenge_expires_at then
      return jsonb_build_object('status', 'pending', 'code', 'challenge_not_expired');
    end if;

    v_outcome := 'challenge_expired';
    v_final_state := 'expired';
    v_is_ranked := false;

    insert into public.duel_results (
      duel_id,
      outcome,
      is_ranked,
      finalize_idempotency_key,
      metadata
    )
    values (
      p_duel_id,
      v_outcome,
      v_is_ranked,
      v_final_key,
      jsonb_build_object('reason', 'challenge_not_accepted_before_24h_expiry')
    )
    returning * into v_result;

    update public.duel_challenges
    set
      state = v_final_state,
      completed_at = now(),
      updated_at = now()
    where id = p_duel_id;

    perform public.private_append_duel_event(
      p_duel_id,
      'duel_finalized',
      format('finalize-event:%s', v_final_key),
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object('outcome', v_outcome)
    );

    return jsonb_build_object('status', 'ok', 'duel_id', p_duel_id, 'result', to_jsonb(v_result));
  end if;

  -- Ensure a bot attempt exists for bot matches.
  if v_duel.is_bot_match and v_duel.bot_profile_id is not null then
    perform public.private_generate_bot_attempt(v_duel.id, v_duel.bot_profile_id);
  end if;

  select * into v_attempt_challenger
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_duel.challenger_id;

  if v_duel.is_bot_match then
    select * into v_attempt_opponent
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id;
  else
    select * into v_attempt_opponent
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = v_duel.opponent_id;
  end if;

  -- Not enough signals yet, and timer still open.
  if (
    (v_attempt_challenger.id is null or v_attempt_opponent.id is null)
    and (v_duel.match_expires_at is null or v_now < v_duel.match_expires_at)
  ) then
    return jsonb_build_object('status', 'pending', 'code', 'awaiting_second_player');
  end if;

  -- Expiry with zero attempts => void.
  if v_attempt_challenger.id is null and v_attempt_opponent.id is null then
    v_outcome := 'void';
    v_final_state := 'expired';
    v_is_ranked := false;
  elsif v_attempt_challenger.id is null or v_attempt_opponent.id is null then
    -- No-show default win.
    v_outcome := 'default_win';
    v_final_state := 'completed';
    v_is_ranked := (not v_duel.is_bot_match) and coalesce(v_duel.is_ranked, true);

    if v_attempt_challenger.id is not null then
      v_ch_win := true;
      v_winner_player_id := v_duel.challenger_id;
      if v_duel.is_bot_match then
        v_loser_bot_id := v_duel.bot_profile_id;
      else
        v_loser_player_id := v_duel.opponent_id;
      end if;
      v_winner_score := v_attempt_challenger.correct_count;
      v_winner_time := v_attempt_challenger.total_time_ms;
      v_loser_score := 0;
      v_loser_time := null;
    else
      v_op_win := true;
      if v_duel.is_bot_match then
        v_winner_bot_id := v_duel.bot_profile_id;
        v_loser_player_id := v_duel.challenger_id;
      else
        v_winner_player_id := v_duel.opponent_id;
        v_loser_player_id := v_duel.challenger_id;
      end if;
      v_winner_score := coalesce(v_attempt_opponent.correct_count, 0);
      v_winner_time := v_attempt_opponent.total_time_ms;
      v_loser_score := 0;
      v_loser_time := null;
    end if;
  else
    -- Both attempts present; score then time tie-break.
    v_final_state := 'completed';
    v_is_ranked := (not v_duel.is_bot_match) and coalesce(v_duel.is_ranked, true);

    if v_attempt_challenger.correct_count > v_attempt_opponent.correct_count then
      v_ch_win := true;
    elsif v_attempt_challenger.correct_count < v_attempt_opponent.correct_count then
      v_op_win := true;
    elsif v_attempt_challenger.total_time_ms < v_attempt_opponent.total_time_ms then
      v_ch_win := true;
    elsif v_attempt_challenger.total_time_ms > v_attempt_opponent.total_time_ms then
      v_op_win := true;
    else
      v_tie := true;
    end if;

    if v_tie then
      v_outcome := 'tie';
      v_winner_score := v_attempt_challenger.correct_count;
      v_loser_score := v_attempt_opponent.correct_count;
      v_winner_time := v_attempt_challenger.total_time_ms;
      v_loser_time := v_attempt_opponent.total_time_ms;
    else
      v_outcome := 'score_win';
      if v_ch_win then
        v_winner_player_id := v_duel.challenger_id;
        v_winner_score := v_attempt_challenger.correct_count;
        v_winner_time := v_attempt_challenger.total_time_ms;
        v_loser_score := v_attempt_opponent.correct_count;
        v_loser_time := v_attempt_opponent.total_time_ms;

        if v_duel.is_bot_match then
          v_loser_bot_id := v_duel.bot_profile_id;
        else
          v_loser_player_id := v_duel.opponent_id;
        end if;
      else
        if v_duel.is_bot_match then
          v_winner_bot_id := v_duel.bot_profile_id;
          v_loser_player_id := v_duel.challenger_id;
        else
          v_winner_player_id := v_duel.opponent_id;
          v_loser_player_id := v_duel.challenger_id;
        end if;

        v_winner_score := v_attempt_opponent.correct_count;
        v_winner_time := v_attempt_opponent.total_time_ms;
        v_loser_score := v_attempt_challenger.correct_count;
        v_loser_time := v_attempt_challenger.total_time_ms;
      end if;
    end if;
  end if;

  -- Lean Elo update for ranked human vs human only.
  if v_is_ranked and not v_tie then
    v_k := case when v_outcome = 'default_win' then 12 else 24 end;

    select rating into v_ch_rating from public.player_profiles where player_id = v_duel.challenger_id;
    select rating into v_op_rating from public.player_profiles where player_id = v_duel.opponent_id;

    if v_ch_rating is not null and v_op_rating is not null then
      v_expected_ch := 1 / (1 + power(10, (v_op_rating - v_ch_rating)::numeric / 400));
      if v_ch_win then
        v_actual_ch := 1;
      else
        v_actual_ch := 0;
      end if;

      v_delta_ch := round(v_k * (v_actual_ch - v_expected_ch));
      v_delta_op := -1 * v_delta_ch;
    end if;
  elsif v_is_ranked and v_tie then
    v_k := 24;

    select rating into v_ch_rating from public.player_profiles where player_id = v_duel.challenger_id;
    select rating into v_op_rating from public.player_profiles where player_id = v_duel.opponent_id;

    if v_ch_rating is not null and v_op_rating is not null then
      v_expected_ch := 1 / (1 + power(10, (v_op_rating - v_ch_rating)::numeric / 400));
      v_actual_ch := 0.5;
      v_delta_ch := round(v_k * (v_actual_ch - v_expected_ch));
      v_delta_op := -1 * v_delta_ch;
    end if;
  end if;

  insert into public.duel_results (
    duel_id,
    outcome,
    winner_player_id,
    loser_player_id,
    winner_bot_id,
    loser_bot_id,
    winner_score,
    loser_score,
    winner_time_ms,
    loser_time_ms,
    is_ranked,
    rating_delta_winner,
    rating_delta_loser,
    finalize_idempotency_key,
    metadata
  )
  values (
    p_duel_id,
    v_outcome,
    v_winner_player_id,
    v_loser_player_id,
    v_winner_bot_id,
    v_loser_bot_id,
    v_winner_score,
    v_loser_score,
    v_winner_time,
    v_loser_time,
    v_is_ranked,
    case
      when v_winner_player_id = v_duel.challenger_id then v_delta_ch
      when v_winner_player_id = v_duel.opponent_id then v_delta_op
      else 0
    end,
    case
      when v_loser_player_id = v_duel.challenger_id then v_delta_ch
      when v_loser_player_id = v_duel.opponent_id then v_delta_op
      else 0
    end,
    v_final_key,
    jsonb_build_object(
      'challenger_correct', coalesce(v_attempt_challenger.correct_count, 0),
      'challenger_time_ms', coalesce(v_attempt_challenger.total_time_ms, 0),
      'opponent_correct', coalesce(v_attempt_opponent.correct_count, 0),
      'opponent_time_ms', coalesce(v_attempt_opponent.total_time_ms, 0),
      'is_bot_match', v_duel.is_bot_match
    )
  )
  returning * into v_result;

  update public.duel_challenges
  set
    state = v_final_state,
    completed_at = now(),
    updated_at = now()
  where id = p_duel_id;

  -- Challenger profile updates.
  update public.player_profiles
  set
    wins = wins + case
      when v_outcome in ('score_win', 'default_win') and v_winner_player_id = v_duel.challenger_id then 1
      else 0
    end,
    losses = losses + case
      when v_outcome in ('score_win', 'default_win') and v_loser_player_id = v_duel.challenger_id then 1
      else 0
    end,
    draws = draws + case when v_outcome = 'tie' then 1 else 0 end,
    duel_streak = case
      when v_outcome in ('score_win', 'default_win') and v_winner_player_id = v_duel.challenger_id then duel_streak + 1
      when v_outcome in ('score_win', 'default_win') and v_loser_player_id = v_duel.challenger_id then 0
      else duel_streak
    end,
    best_duel_streak = greatest(
      best_duel_streak,
      case
        when v_outcome in ('score_win', 'default_win') and v_winner_player_id = v_duel.challenger_id then duel_streak + 1
        else duel_streak
      end
    ),
    rating = rating + case
      when v_is_ranked then v_delta_ch
      else 0
    end,
    no_show_strikes = no_show_strikes + case
      when v_outcome = 'default_win' and v_attempt_challenger.id is null then 1
      else 0
    end,
    last_active_at = now(),
    updated_at = now()
  where player_id = v_duel.challenger_id;

  -- Opponent profile updates for human-vs-human duels.
  if not v_duel.is_bot_match and v_duel.opponent_id is not null then
    update public.player_profiles
    set
      wins = wins + case
        when v_outcome in ('score_win', 'default_win') and v_winner_player_id = v_duel.opponent_id then 1
        else 0
      end,
      losses = losses + case
        when v_outcome in ('score_win', 'default_win') and v_loser_player_id = v_duel.opponent_id then 1
        else 0
      end,
      draws = draws + case when v_outcome = 'tie' then 1 else 0 end,
      duel_streak = case
        when v_outcome in ('score_win', 'default_win') and v_winner_player_id = v_duel.opponent_id then duel_streak + 1
        when v_outcome in ('score_win', 'default_win') and v_loser_player_id = v_duel.opponent_id then 0
        else duel_streak
      end,
      best_duel_streak = greatest(
        best_duel_streak,
        case
          when v_outcome in ('score_win', 'default_win') and v_winner_player_id = v_duel.opponent_id then duel_streak + 1
          else duel_streak
        end
      ),
      rating = rating + case
        when v_is_ranked then v_delta_op
        else 0
      end,
      no_show_strikes = no_show_strikes + case
        when v_outcome = 'default_win' and v_attempt_opponent.id is null then 1
        else 0
      end,
      last_active_at = now(),
      updated_at = now()
    where player_id = v_duel.opponent_id;
  end if;

  perform public.private_append_duel_event(
    p_duel_id,
    'duel_finalized',
    format('finalize-event:%s', v_final_key),
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object('outcome', v_outcome, 'state', v_final_state)
  );

  return jsonb_build_object(
    'status', 'ok',
    'duel_id', p_duel_id,
    'result', to_jsonb(v_result)
  );
end;
$$;
-- ---------------------------------------------------------------------------
-- Required RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_duel(
  p_opponent_id uuid default null,
  p_question_set jsonb default null,
  p_idempotency_key text default null,
  p_is_bot_match boolean default false,
  p_bot_profile_id uuid default null,
  p_source text default 'direct'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_existing public.duel_challenges%rowtype;
  v_question_set jsonb;
  v_bot_id uuid;
  v_bot_run jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_existing
  from public.duel_challenges
  where challenger_id = v_actor
    and create_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'duel', to_jsonb(v_existing));
  end if;

  if p_question_set is null
    or jsonb_typeof(p_question_set) <> 'array'
    or jsonb_array_length(p_question_set) = 0
  then
    v_question_set := public.private_default_question_set(10);
  else
    v_question_set := p_question_set;
  end if;

  if p_is_bot_match then
    if p_bot_profile_id is null then
      select id into v_bot_id
      from public.bot_profiles
      where active = true
      order by
        case tier
          when 'resident' then 1
          when 'attending' then 2
          else 3
        end,
        created_at
      limit 1;
    else
      v_bot_id := p_bot_profile_id;
    end if;

    if v_bot_id is null then
      raise exception 'no_active_bot_profiles';
    end if;

    insert into public.duel_challenges (
      challenger_id,
      opponent_id,
      is_bot_match,
      bot_profile_id,
      is_ranked,
      source,
      question_set,
      state,
      create_idempotency_key,
      accepted_at,
      challenge_expires_at,
      match_expires_at
    )
    values (
      v_actor,
      null,
      true,
      v_bot_id,
      false,
      coalesce(nullif(btrim(p_source), ''), 'bot'),
      v_question_set,
      'accepted',
      p_idempotency_key,
      now(),
      now(),
      now() + interval '48 hours'
    )
    returning * into v_duel;

    perform public.private_append_duel_event(
      v_duel.id,
      'challenge_created',
      format('%s:create', p_idempotency_key),
      v_actor,
      null,
      null,
      null,
      null,
      jsonb_build_object('is_bot_match', true, 'bot_profile_id', v_bot_id)
    );

    perform public.private_append_duel_event(
      v_duel.id,
      'challenge_accepted',
      format('%s:accept', p_idempotency_key),
      null,
      v_bot_id,
      null,
      null,
      null,
      jsonb_build_object('auto_accept', true)
    );

    v_bot_run := public.private_generate_bot_attempt(v_duel.id, v_bot_id);

    return jsonb_build_object(
      'status', 'ok',
      'duel', to_jsonb(v_duel),
      'bot_run', v_bot_run
    );
  end if;

  if p_opponent_id is null then
    raise exception 'opponent_id_required_for_human_duel';
  end if;

  if p_opponent_id = v_actor then
    raise exception 'cannot_challenge_self';
  end if;

  perform public.ensure_player_profile(p_opponent_id);

  -- Block duplicate active challenges to same target.
  select * into v_existing
  from public.duel_challenges d
  where d.challenger_id = v_actor
    and d.opponent_id = p_opponent_id
    and d.state in ('created', 'pending', 'accepted', 'player1_complete', 'player2_complete')
  order by d.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'exists',
      'duel', to_jsonb(v_existing),
      'message', 'active_duel_already_exists'
    );
  end if;

  insert into public.duel_challenges (
    challenger_id,
    opponent_id,
    is_bot_match,
    bot_profile_id,
    is_ranked,
    source,
    question_set,
    state,
    create_idempotency_key,
    challenge_expires_at
  )
  values (
    v_actor,
    p_opponent_id,
    false,
    null,
    true,
    coalesce(nullif(btrim(p_source), ''), 'direct'),
    v_question_set,
    'pending',
    p_idempotency_key,
    now() + interval '24 hours'
  )
  returning * into v_duel;

  perform public.private_append_duel_event(
    v_duel.id,
    'challenge_created',
    format('%s:create', p_idempotency_key),
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object('is_bot_match', false, 'opponent_id', p_opponent_id)
  );

  return jsonb_build_object('status', 'ok', 'duel', to_jsonb(v_duel));
end;
$$;
create or replace function public.accept_duel(
  p_duel_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  if v_duel.is_bot_match then
    return jsonb_build_object('status', 'error', 'code', 'bot_duel_auto_accepted');
  end if;

  if v_duel.opponent_id is distinct from v_actor then
    return jsonb_build_object('status', 'error', 'code', 'not_duel_opponent');
  end if;

  if exists (
    select 1
    from public.duel_events e
    where e.duel_id = p_duel_id
      and e.idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'duel', to_jsonb(v_duel));
  end if;

  if v_duel.state in ('completed', 'expired', 'settled') then
    return jsonb_build_object('status', 'ok', 'duel', to_jsonb(v_duel), 'message', 'already_terminal');
  end if;

  if now() > v_duel.challenge_expires_at then
    return public.private_finalize_duel_core(p_duel_id, format('%s:expired', p_idempotency_key));
  end if;

  if v_duel.state in ('created', 'pending') then
    update public.duel_challenges
    set
      state = 'accepted',
      accepted_at = now(),
      match_expires_at = now() + interval '48 hours',
      updated_at = now()
    where id = p_duel_id
    returning * into v_duel;
  end if;

  perform public.private_append_duel_event(
    p_duel_id,
    'challenge_accepted',
    p_idempotency_key,
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object('accepted_at', now())
  );

  return jsonb_build_object('status', 'ok', 'duel', to_jsonb(v_duel));
end;
$$;
create or replace function public.submit_attempt(
  p_duel_id uuid,
  p_answers jsonb,
  p_total_time_ms integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_existing_attempt public.duel_attempts%rowtype;
  v_other_attempt public.duel_attempts%rowtype;
  v_score jsonb;
  v_attempt public.duel_attempts%rowtype;
  v_answer jsonb;
  v_idx integer := 0;
  v_finalize_result jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  if v_duel.is_bot_match then
    if v_actor is distinct from v_duel.challenger_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  else
    if v_actor is distinct from v_duel.challenger_id and v_actor is distinct from v_duel.opponent_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  end if;

  -- Request-level idempotency.
  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor
    and submit_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'attempt', to_jsonb(v_existing_attempt));
  end if;

  -- Participant has already submitted; return existing row (retry-safe).
  select * into v_existing_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'attempt', to_jsonb(v_existing_attempt));
  end if;

  if v_duel.state in ('completed', 'expired', 'settled') then
    return jsonb_build_object('status', 'error', 'code', 'duel_terminal_state', 'state', v_duel.state);
  end if;

  if now() > coalesce(v_duel.match_expires_at, now() - interval '1 second')
    and v_duel.state in ('accepted', 'player1_complete', 'player2_complete')
  then
    return public.private_finalize_duel_core(p_duel_id, format('%s:match-expired', p_idempotency_key));
  end if;

  if v_duel.state not in ('accepted', 'player1_complete', 'player2_complete') then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_ready_for_attempt', 'state', v_duel.state);
  end if;

  v_score := public.private_score_answers(v_duel.question_set, p_answers, p_total_time_ms);

  insert into public.duel_attempts (
    duel_id,
    player_id,
    is_bot_attempt,
    attempt_status,
    answers,
    total_questions,
    correct_count,
    total_time_ms,
    started_at,
    submitted_at,
    submit_idempotency_key
  )
  values (
    p_duel_id,
    v_actor,
    false,
    'submitted',
    v_score->'answers',
    (v_score->>'total_questions')::integer,
    (v_score->>'correct_count')::integer,
    (v_score->>'total_time_ms')::integer,
    now(),
    now(),
    p_idempotency_key
  )
  returning * into v_attempt;

  -- Per-question event writes (monotonic event_seq, idempotency-safe).
  for v_answer in
    select value from jsonb_array_elements(v_score->'answers') as a(value)
  loop
    v_idx := v_idx + 1;
    perform public.private_append_duel_event(
      p_duel_id,
      'question_answered',
      format('%s:q:%s', p_idempotency_key, v_idx),
      v_actor,
      null,
      v_idx,
      (v_answer->>'is_correct')::boolean,
      (v_answer->>'time_ms')::integer,
      jsonb_build_object('question_id', v_answer->>'question_id')
    );
  end loop;

  perform public.private_append_duel_event(
    p_duel_id,
    'attempt_submitted',
    format('%s:submitted', p_idempotency_key),
    v_actor,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'total_questions', v_attempt.total_questions,
      'total_time_ms', v_attempt.total_time_ms
    )
  );

  if v_duel.is_bot_match then
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id;
  else
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = case
        when v_actor = v_duel.challenger_id then v_duel.opponent_id
        else v_duel.challenger_id
      end;
  end if;

  if v_other_attempt.id is not null then
    update public.duel_challenges
    set state = 'completed', updated_at = now()
    where id = p_duel_id;

    v_finalize_result := public.private_finalize_duel_core(
      p_duel_id,
      format('%s:auto-finalize', p_idempotency_key)
    );

    return jsonb_build_object(
      'status', 'ok',
      'attempt', to_jsonb(v_attempt),
      'finalized', true,
      'finalize', v_finalize_result
    );
  end if;

  update public.duel_challenges
  set
    state = case
      when v_actor = v_duel.challenger_id then 'player1_complete'
      else 'player2_complete'
    end,
    updated_at = now()
  where id = p_duel_id;

  return jsonb_build_object('status', 'ok', 'attempt', to_jsonb(v_attempt), 'finalized', false);
end;
$$;
create or replace function public.finalize_duel(
  p_duel_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_final_key text;
begin
  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  -- Service role may call with null auth.uid(); users must be participants.
  if v_actor is not null then
    if v_duel.is_bot_match then
      if v_actor is distinct from v_duel.challenger_id then
        return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
      end if;
    else
      if v_actor is distinct from v_duel.challenger_id and v_actor is distinct from v_duel.opponent_id then
        return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
      end if;
    end if;
  end if;

  v_final_key := coalesce(
    nullif(btrim(p_idempotency_key), ''),
    format('manual:%s:%s', p_duel_id, coalesce(v_actor::text, 'service'))
  );

  return public.private_finalize_duel_core(p_duel_id, v_final_key);
end;
$$;
drop function if exists public.fetch_results(uuid);
create or replace function public.fetch_results(
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_result public.duel_results%rowtype;
  v_self_attempt public.duel_attempts%rowtype;
  v_other_attempt public.duel_attempts%rowtype;
  v_events jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_found');
  end if;

  if v_duel.is_bot_match then
    if v_actor is distinct from v_duel.challenger_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  else
    if v_actor is distinct from v_duel.challenger_id and v_actor is distinct from v_duel.opponent_id then
      return jsonb_build_object('status', 'error', 'code', 'not_duel_participant');
    end if;
  end if;

  -- Opportunistic finalize on second completion or expiry.
  if not exists (select 1 from public.duel_results where duel_id = p_duel_id)
    and (
      (
        exists (select 1 from public.duel_attempts where duel_id = p_duel_id and player_id = v_duel.challenger_id)
        and (
          (not v_duel.is_bot_match and exists (select 1 from public.duel_attempts where duel_id = p_duel_id and player_id = v_duel.opponent_id))
          or
          (v_duel.is_bot_match and exists (select 1 from public.duel_attempts where duel_id = p_duel_id and bot_profile_id = v_duel.bot_profile_id))
        )
      )
      or now() > coalesce(v_duel.match_expires_at, v_duel.challenge_expires_at)
    )
  then
    perform public.private_finalize_duel_core(
      p_duel_id,
      format('fetch:%s:%s', p_duel_id, v_actor)
    );
  end if;

  select * into v_result
  from public.duel_results
  where duel_id = p_duel_id;

  select * into v_self_attempt
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor;

  if v_duel.is_bot_match then
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id;
  else
    select * into v_other_attempt
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = case
        when v_actor = v_duel.challenger_id then v_duel.opponent_id
        else v_duel.challenger_id
      end;
  end if;

  if v_result.id is null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'event_seq', e.event_seq,
      'event_type', e.event_type,
      'created_at', e.created_at,
      'payload', e.payload
    ) order by e.event_seq), '[]'::jsonb)
    into v_events
    from public.duel_events e
    where e.duel_id = p_duel_id
      and e.event_type in ('challenge_created', 'challenge_accepted', 'attempt_submitted', 'duel_finalized');
  else
    select coalesce(jsonb_agg(to_jsonb(e) order by e.event_seq), '[]'::jsonb)
    into v_events
    from public.duel_events e
    where e.duel_id = p_duel_id;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'duel', to_jsonb(v_duel),
    'result', case when v_result.id is null then null else to_jsonb(v_result) end,
    'attempt_self', case when v_self_attempt.id is null then null else to_jsonb(v_self_attempt) end,
    'attempt_opponent',
      case
        when v_result.id is null then null
        when v_other_attempt.id is null then null
        else to_jsonb(v_other_attempt)
      end,
    'events', coalesce(v_events, '[]'::jsonb)
  );
end;
$$;
-- ---------------------------------------------------------------------------
-- Daily rounds + leaderboard
-- ---------------------------------------------------------------------------
create or replace function public.submit_daily_round(
  p_round_date date,
  p_answers jsonb,
  p_total_time_ms integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.player_profiles%rowtype;
  v_round public.daily_rounds%rowtype;
  v_existing public.daily_participation%rowtype;
  v_score jsonb;
  v_rating_delta integer;
  v_new_streak integer;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  select * into v_profile from public.ensure_player_profile(v_actor);

  select * into v_round
  from public.daily_rounds
  where round_date = p_round_date
    and status in ('active', 'closed')
  limit 1;

  if not found then
    return jsonb_build_object('status', 'error', 'code', 'daily_round_not_found');
  end if;

  select * into v_existing
  from public.daily_participation
  where player_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'participation', to_jsonb(v_existing));
  end if;

  select * into v_existing
  from public.daily_participation
  where daily_round_id = v_round.id
    and player_id = v_actor;

  if found then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'participation', to_jsonb(v_existing));
  end if;

  v_score := public.private_score_answers(v_round.question_set, p_answers, p_total_time_ms);

  -- Lean daily rating delta: center around 50% score.
  v_rating_delta := greatest(
    -20,
    least(20, ((v_score->>'correct_count')::integer * 2) - (v_score->>'total_questions')::integer)
  );

  if v_profile.last_daily_round_date = p_round_date - 1 then
    v_new_streak := v_profile.daily_streak + 1;
  elsif v_profile.last_daily_round_date = p_round_date then
    v_new_streak := v_profile.daily_streak;
  else
    v_new_streak := 1;
  end if;

  update public.player_profiles
  set
    daily_streak = v_new_streak,
    best_daily_streak = greatest(best_daily_streak, v_new_streak),
    last_daily_round_date = p_round_date,
    rating = rating + v_rating_delta,
    last_active_at = now(),
    updated_at = now()
  where player_id = v_actor;

  insert into public.daily_participation (
    daily_round_id,
    player_id,
    answers,
    total_questions,
    correct_count,
    total_time_ms,
    score,
    rating_delta,
    streak_after,
    completed_at,
    idempotency_key
  )
  values (
    v_round.id,
    v_actor,
    v_score->'answers',
    (v_score->>'total_questions')::integer,
    (v_score->>'correct_count')::integer,
    (v_score->>'total_time_ms')::integer,
    (v_score->>'score')::integer,
    v_rating_delta,
    v_new_streak,
    now(),
    p_idempotency_key
  )
  returning * into v_existing;

  return jsonb_build_object('status', 'ok', 'participation', to_jsonb(v_existing));
end;
$$;
create or replace function public.daily_leaderboard(
  p_round_date date default current_date,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_round_id uuid;
  v_board jsonb;
  v_me jsonb;
begin
  select id into v_round_id
  from public.daily_rounds
  where round_date = p_round_date
  limit 1;

  if v_round_id is null then
    return jsonb_build_object('status', 'error', 'code', 'daily_round_not_found');
  end if;

  with ranked as (
    select
      dp.player_id,
      pp.display_name,
      dp.score,
      dp.correct_count,
      dp.total_time_ms,
      dp.streak_after,
      row_number() over (
        order by dp.score desc, dp.total_time_ms asc, dp.completed_at asc
      ) as rank_position
    from public.daily_participation dp
    join public.player_profiles pp on pp.player_id = dp.player_id
    where dp.daily_round_id = v_round_id
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank_position), '[]'::jsonb)
  into v_board
  from (
    select * from ranked order by rank_position limit greatest(1, p_limit)
  ) r;

  if v_actor is not null then
    with ranked as (
      select
        dp.player_id,
        pp.display_name,
        dp.score,
        dp.correct_count,
        dp.total_time_ms,
        dp.streak_after,
        row_number() over (
          order by dp.score desc, dp.total_time_ms asc, dp.completed_at asc
        ) as rank_position
      from public.daily_participation dp
      join public.player_profiles pp on pp.player_id = dp.player_id
      where dp.daily_round_id = v_round_id
    )
    select to_jsonb(r) into v_me
    from ranked r
    where r.player_id = v_actor;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'round_date', p_round_date,
    'leaderboard', coalesce(v_board, '[]'::jsonb),
    'me', v_me
  );
end;
$$;
-- ---------------------------------------------------------------------------
-- Matchmaking (V1, no queue)
-- ---------------------------------------------------------------------------
create or replace function public.duel_roster(
  p_limit integer default 25,
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_rows jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  with me as (
    select *
    from public.player_profiles
    where player_id = v_actor
  ),
  candidates as (
    select
      pp.player_id,
      pp.display_name,
      pp.rating,
      pp.wins,
      pp.losses,
      pp.last_active_at,
      abs(pp.rating - me.rating) as rating_gap,
      coalesce((
        select count(*)
        from jsonb_array_elements_text(coalesce(me.diagnostic_tags, '[]'::jsonb)) as my(tag)
        join jsonb_array_elements_text(coalesce(pp.diagnostic_tags, '[]'::jsonb)) as other(tag)
          on my.tag = other.tag
      ), 0) as diagnostic_overlap
    from public.player_profiles pp
    cross join me
    where pp.player_id <> v_actor
      and (
        p_search is null
        or pp.display_name ilike '%' || p_search || '%'
        or pp.player_id::text ilike '%' || p_search || '%'
      )
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by c.rating_gap asc, c.diagnostic_overlap desc, c.last_active_at desc), '[]'::jsonb)
  into v_rows
  from (
    select * from candidates
    order by rating_gap asc, diagnostic_overlap desc, last_active_at desc
    limit greatest(1, p_limit)
  ) c;

  return jsonb_build_object('status', 'ok', 'roster', coalesce(v_rows, '[]'::jsonb));
end;
$$;
create or replace function public.recommended_opponent()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_pick jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  perform public.ensure_player_profile(v_actor);

  with me as (
    select * from public.player_profiles where player_id = v_actor
  ),
  candidates as (
    select
      pp.player_id,
      pp.display_name,
      pp.rating,
      pp.wins,
      pp.losses,
      pp.last_active_at,
      abs(pp.rating - me.rating) as rating_gap,
      coalesce((
        select count(*)
        from jsonb_array_elements_text(coalesce(me.diagnostic_tags, '[]'::jsonb)) as my(tag)
        join jsonb_array_elements_text(coalesce(pp.diagnostic_tags, '[]'::jsonb)) as other(tag)
          on my.tag = other.tag
      ), 0) as diagnostic_overlap
    from public.player_profiles pp
    cross join me
    where pp.player_id <> v_actor
  )
  select to_jsonb(c)
  into v_pick
  from candidates c
  order by c.rating_gap asc, c.diagnostic_overlap desc, c.last_active_at desc
  limit 1;

  return jsonb_build_object('status', 'ok', 'recommended_opponent', v_pick);
end;
$$;
-- ---------------------------------------------------------------------------
-- RLS (lean policies for direct reads/writes when needed)
-- ---------------------------------------------------------------------------
alter table public.player_profiles enable row level security;
alter table public.duel_challenges enable row level security;
alter table public.duel_attempts enable row level security;
alter table public.duel_events enable row level security;
alter table public.duel_results enable row level security;
alter table public.duel_settlements enable row level security;
alter table public.bot_profiles enable row level security;
alter table public.bot_runs enable row level security;
alter table public.daily_rounds enable row level security;
alter table public.daily_participation enable row level security;
-- Player profiles
 do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_profiles' and policyname = 'player_profiles_select_authenticated'
  ) then
    create policy player_profiles_select_authenticated
      on public.player_profiles
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_profiles' and policyname = 'player_profiles_insert_self'
  ) then
    create policy player_profiles_insert_self
      on public.player_profiles
      for insert
      to authenticated
      with check (player_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_profiles' and policyname = 'player_profiles_update_self'
  ) then
    create policy player_profiles_update_self
      on public.player_profiles
      for update
      to authenticated
      using (player_id = auth.uid())
      with check (player_id = auth.uid());
  end if;
end
$$;
-- Duel visibility for participants.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'duel_challenges' and policyname = 'duel_challenges_select_participant'
  ) then
    create policy duel_challenges_select_participant
      on public.duel_challenges
      for select
      to authenticated
      using (
        challenger_id = auth.uid()
        or opponent_id = auth.uid()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'duel_attempts' and policyname = 'duel_attempts_select_participant'
  ) then
    create policy duel_attempts_select_participant
      on public.duel_attempts
      for select
      to authenticated
      using (
        player_id = auth.uid()
        or exists (
          select 1
          from public.duel_challenges d
          where d.id = duel_attempts.duel_id
            and (d.challenger_id = auth.uid() or d.opponent_id = auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'duel_events' and policyname = 'duel_events_select_participant'
  ) then
    create policy duel_events_select_participant
      on public.duel_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.duel_challenges d
          where d.id = duel_events.duel_id
            and (d.challenger_id = auth.uid() or d.opponent_id = auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'duel_results' and policyname = 'duel_results_select_participant'
  ) then
    create policy duel_results_select_participant
      on public.duel_results
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.duel_challenges d
          where d.id = duel_results.duel_id
            and (d.challenger_id = auth.uid() or d.opponent_id = auth.uid())
        )
      );
  end if;
end
$$;
-- Daily read policies.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_rounds' and policyname = 'daily_rounds_select_authenticated'
  ) then
    create policy daily_rounds_select_authenticated
      on public.daily_rounds
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_participation' and policyname = 'daily_participation_select_authenticated'
  ) then
    create policy daily_participation_select_authenticated
      on public.daily_participation
      for select
      to authenticated
      using (true);
  end if;
end
$$;
-- Bot tables are read-only to authenticated users.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bot_profiles' and policyname = 'bot_profiles_select_authenticated'
  ) then
    create policy bot_profiles_select_authenticated
      on public.bot_profiles
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bot_runs' and policyname = 'bot_runs_select_participant'
  ) then
    create policy bot_runs_select_participant
      on public.bot_runs
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.duel_challenges d
          where d.id = bot_runs.duel_id
            and d.challenger_id = auth.uid()
        )
      );
  end if;
end
$$;
-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select on public.player_profiles to authenticated;
grant select on public.daily_rounds to authenticated;
grant select on public.daily_participation to authenticated;
grant select on public.bot_profiles to authenticated;
grant execute on function public.create_duel(uuid, jsonb, text, boolean, uuid, text) to authenticated;
grant execute on function public.accept_duel(uuid, text) to authenticated;
grant execute on function public.submit_attempt(uuid, jsonb, integer, text) to authenticated;
grant execute on function public.finalize_duel(uuid, text) to authenticated;
grant execute on function public.fetch_results(uuid) to authenticated;
grant execute on function public.submit_daily_round(date, jsonb, integer, text) to authenticated;
grant execute on function public.daily_leaderboard(date, integer) to authenticated;
grant execute on function public.duel_roster(integer, text) to authenticated;
grant execute on function public.recommended_opponent() to authenticated;
commit;
