-- MMOS-ARENA-INTEL-01 P0 canonical analytics view
-- Read-only additive object: unified answer stream for intelligence pipeline

create or replace view public.qstat_answers_v1 as
with duel_attempt_rows as (
  select
    da.player_id as user_id,
    coalesce(a.elem->>'question_id', a.elem->>'id', a.elem->>'q') as question_id,
    case
      when a.elem ? 'is_correct' then (a.elem->>'is_correct')::boolean
      else null
    end as is_correct,
    case
      when coalesce(a.elem->>'time_ms', '') ~ '^[0-9]+$' then (a.elem->>'time_ms')::integer
      else null
    end as response_ms,
    da.submitted_at as answered_at,
    format('duel_attempt:%s:%s', da.id, a.ordinality) as source_event_id,
    'duel_attempt'::text as source_type
  from public.duel_attempts da
  cross join lateral jsonb_array_elements(coalesce(da.answers, '[]'::jsonb))
    with ordinality as a(elem, ordinality)
  where da.player_id is not null
),
daily_participation_rows as (
  select
    dp.player_id as user_id,
    coalesce(a.elem->>'question_id', a.elem->>'id', a.elem->>'q') as question_id,
    case
      when a.elem ? 'is_correct' then (a.elem->>'is_correct')::boolean
      else null
    end as is_correct,
    case
      when coalesce(a.elem->>'time_ms', '') ~ '^[0-9]+$' then (a.elem->>'time_ms')::integer
      else null
    end as response_ms,
    dp.completed_at as answered_at,
    format('daily_participation:%s:%s', dp.id, a.ordinality) as source_event_id,
    'daily_participation'::text as source_type
  from public.daily_participation dp
  cross join lateral jsonb_array_elements(coalesce(dp.answers, '[]'::jsonb))
    with ordinality as a(elem, ordinality)
  where dp.player_id is not null
),
duel_event_rows as (
  select
    de.actor_player_id as user_id,
    coalesce(
      de.payload->>'question_id',
      de.payload->>'id',
      de.payload->>'q',
      (dc.question_set -> greatest(coalesce(de.question_index, 1) - 1, 0)) ->> 'question_id'
    ) as question_id,
    de.is_correct as is_correct,
    de.response_ms as response_ms,
    de.created_at as answered_at,
    de.id::text as source_event_id,
    'duel_event'::text as source_type
  from public.duel_events de
  join public.duel_challenges dc
    on dc.id = de.duel_id
  where de.actor_player_id is not null
    and de.event_type = 'question_answered'
),
question_attempt_rows as (
  select
    qa.user_id as user_id,
    qa.question_id as question_id,
    qa.correct as is_correct,
    coalesce(qa.total_time_on_question_ms, qa.time_to_first_answer_ms) as response_ms,
    coalesce(qa.question_answered_at, qa.server_received_answered_at, qa.updated_at, qa.created_at) as answered_at,
    coalesce(qa.client_event_id::text, qa.id::text) as source_event_id,
    'question_attempt'::text as source_type
  from public.question_attempts qa
  where qa.user_id is not null
)
select
  r.user_id,
  r.question_id,
  r.is_correct,
  r.response_ms,
  r.answered_at,
  r.source_event_id,
  r.source_type
from (
  select * from duel_attempt_rows
  union all
  select * from daily_participation_rows
  union all
  select * from duel_event_rows
  union all
  select * from question_attempt_rows
) r
where r.question_id is not null
  and btrim(r.question_id) <> '';
