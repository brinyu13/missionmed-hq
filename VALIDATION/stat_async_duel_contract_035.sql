-- MR-STAT-HUMAN-ASYNC-DUEL-CONTRACT-REPAIR-035
-- Rollback-safe SQL harness for Supabase SQL Editor
-- Purpose: validate two-user async duel contract with sealed pack + submit + results
-- IMPORTANT: run as a single script in SQL Editor. It opens a transaction and ends with ROLLBACK.

begin;

-- -----------------------------------------------------------------------------
-- 0) Choose two distinct existing authenticated users (player profiles)
-- Replace USER_A_UUID / USER_B_UUID before running.
-- -----------------------------------------------------------------------------
-- Helpful discovery query:
-- select player_id, display_name, rating, created_at
-- from public.player_profiles
-- order by created_at desc
-- limit 20;

create temp table if not exists _mr035_users (
  user_a uuid not null,
  user_b uuid not null
) on commit drop;

insert into _mr035_users(user_a, user_b)
values (
  'USER_A_UUID'::uuid,
  'USER_B_UUID'::uuid
);

-- -----------------------------------------------------------------------------
-- 1) Player A creates duel (human async)
-- -----------------------------------------------------------------------------
create temp table if not exists _mr035_ctx (
  duel_id uuid not null,
  create_key text not null,
  accept_key text not null,
  submit_a_key text not null,
  submit_b_key text not null
) on commit drop;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select user_a::text from _mr035_users limit 1), true);

with keys as (
  select
    'mr035-create-'   || replace(gen_random_uuid()::text, '-', '') as create_key,
    'mr035-accept-'   || replace(gen_random_uuid()::text, '-', '') as accept_key,
    'mr035-submit-a-' || replace(gen_random_uuid()::text, '-', '') as submit_a_key,
    'mr035-submit-b-' || replace(gen_random_uuid()::text, '-', '') as submit_b_key
), created as (
  select
    k.*,
    public.create_duel(
      p_opponent_id := (select user_b from _mr035_users limit 1),
      p_question_set := null,
      p_idempotency_key := k.create_key,
      p_is_bot_match := false,
      p_bot_profile_id := null,
      p_source := 'mr035_sql_harness',
      p_dataset_version := null
    ) as payload
  from keys k
)
insert into _mr035_ctx(duel_id, create_key, accept_key, submit_a_key, submit_b_key)
select
  (payload->'duel'->>'id')::uuid,
  create_key,
  accept_key,
  submit_a_key,
  submit_b_key
from created;

select 'STEP_1_CREATE_DUEL' as step, * from _mr035_ctx;

-- -----------------------------------------------------------------------------
-- 2) Player B accepts duel (must work even if state already advanced)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select user_b::text from _mr035_users limit 1), true);

select
  'STEP_2_ACCEPT_DUEL' as step,
  public.accept_duel(
    (select duel_id from _mr035_ctx limit 1),
    (select accept_key from _mr035_ctx limit 1)
  ) as payload;

-- -----------------------------------------------------------------------------
-- 3) Both players fetch pack; pack/order/content_hash must match
-- -----------------------------------------------------------------------------
create temp table if not exists _mr035_pack_a as
select public.get_duel_pack((select duel_id from _mr035_ctx limit 1)) as payload;

select set_config('request.jwt.claim.sub', (select user_b::text from _mr035_users limit 1), true);
create temp table if not exists _mr035_pack_b as
select public.get_duel_pack((select duel_id from _mr035_ctx limit 1)) as payload;

select
  'STEP_3_PACK_COMPARE' as step,
  ((_mr035_pack_a.payload->'duel'->'question_ids') = (_mr035_pack_b.payload->'duel'->'question_ids')) as same_question_ids,
  ((_mr035_pack_a.payload->'duel'->'choices_order') = (_mr035_pack_b.payload->'duel'->'choices_order')) as same_choices_order,
  ((_mr035_pack_a.payload->'duel'->>'content_hash') = (_mr035_pack_b.payload->'duel'->>'content_hash')) as same_content_hash,
  ((_mr035_pack_a.payload->'duel') ? 'answer_map') as duel_envelope_leaks_answer_map
from _mr035_pack_a, _mr035_pack_b;

-- -----------------------------------------------------------------------------
-- 4) Player A submit attempt + pre-finalization fetch_results leak check
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select user_a::text from _mr035_users limit 1), true);

with duel as (
  select * from public.duel_challenges where id = (select duel_id from _mr035_ctx limit 1)
), answers as (
  select jsonb_agg(
           jsonb_build_object(
             'question_id', q.qid,
             'choice_index', 0,
             'time_ms', 1000
           )
           order by q.ord
         ) as payload
  from duel d,
       unnest(d.question_ids) with ordinality as q(qid, ord)
)
select
  'STEP_4A_SUBMIT_A' as step,
  public.submit_attempt(
    (select duel_id from _mr035_ctx limit 1),
    (select payload from answers),
    10000,
    (select submit_a_key from _mr035_ctx limit 1)
  ) as payload;

-- Duplicate submit should be idempotent-safe
with duel as (
  select * from public.duel_challenges where id = (select duel_id from _mr035_ctx limit 1)
), answers as (
  select jsonb_agg(
           jsonb_build_object(
             'question_id', q.qid,
             'choice_index', 0,
             'time_ms', 1000
           )
           order by q.ord
         ) as payload
  from duel d,
       unnest(d.question_ids) with ordinality as q(qid, ord)
)
select
  'STEP_4B_DUPLICATE_SUBMIT_A' as step,
  public.submit_attempt(
    (select duel_id from _mr035_ctx limit 1),
    (select payload from answers),
    10000,
    (select submit_a_key from _mr035_ctx limit 1)
  ) as payload;

-- Before B submits, fetch_results should NOT expose opponent attempt or answer_map
create temp table if not exists _mr035_pre_results as
select public.fetch_results((select duel_id from _mr035_ctx limit 1)) as payload;

select
  'STEP_4C_PRE_FINALIZATION_FETCH' as step,
  ((_mr035_pre_results.payload->'duel') ? 'answer_map') as duel_envelope_leaks_answer_map,
  (_mr035_pre_results.payload->'result') is null as result_is_null,
  (_mr035_pre_results.payload->'attempt_opponent') is null as opponent_attempt_hidden
from _mr035_pre_results;

-- -----------------------------------------------------------------------------
-- 5) Player B submit attempt and verify finalized results
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select user_b::text from _mr035_users limit 1), true);

with duel as (
  select * from public.duel_challenges where id = (select duel_id from _mr035_ctx limit 1)
), answers as (
  select jsonb_agg(
           jsonb_build_object(
             'question_id', q.qid,
             'choice_index', 0,
             'time_ms', 1200
           )
           order by q.ord
         ) as payload
  from duel d,
       unnest(d.question_ids) with ordinality as q(qid, ord)
)
select
  'STEP_5A_SUBMIT_B' as step,
  public.submit_attempt(
    (select duel_id from _mr035_ctx limit 1),
    (select payload from answers),
    12000,
    (select submit_b_key from _mr035_ctx limit 1)
  ) as payload;

create temp table if not exists _mr035_post_results as
select public.fetch_results((select duel_id from _mr035_ctx limit 1)) as payload;

select
  'STEP_5B_POST_FINALIZATION_FETCH' as step,
  ((_mr035_post_results.payload->'result') is not null) as result_present,
  ((_mr035_post_results.payload->'attempt_self') is not null) as attempt_self_present,
  ((_mr035_post_results.payload->'attempt_opponent') is not null) as attempt_opponent_present,
  ((_mr035_post_results.payload->'duel') ? 'answer_map') as duel_envelope_leaks_answer_map
from _mr035_post_results;

-- -----------------------------------------------------------------------------
-- 6) Summary checks
-- -----------------------------------------------------------------------------
select
  'STEP_6_SUMMARY' as step,
  (select state from public.duel_challenges where id = (select duel_id from _mr035_ctx limit 1)) as duel_state,
  (select count(*) from public.duel_attempts where duel_id = (select duel_id from _mr035_ctx limit 1)) as attempt_count,
  (select count(*) from public.duel_results where duel_id = (select duel_id from _mr035_ctx limit 1)) as result_count;

-- Rollback-safe harness: do not keep artifacts in production tables.
rollback;
