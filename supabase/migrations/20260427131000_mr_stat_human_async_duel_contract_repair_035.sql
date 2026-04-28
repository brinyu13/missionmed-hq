-- Migration: 20260427131000_mr_stat_human_async_duel_contract_repair_035.sql
-- Authority: MR-STAT-HUMAN-ASYNC-DUEL-CONTRACT-REPAIR-035
-- Date: 2026-04-27
-- Depends on: 20260427044500_e3_backend_contract_repair.sql
-- Description: Align async submit scoring with sealed canonical pack fields and prevent pre-finalization answer leakage in fetch_results.
-- Idempotent: YES

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_attempt(p_duel_id uuid, p_answers jsonb, p_total_time_ms integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_existing_attempt public.duel_attempts%rowtype;
  v_other_attempt public.duel_attempts%rowtype;
  v_attempt public.duel_attempts%rowtype;
  v_row jsonb;
  v_idx integer := 0;
  v_answer jsonb;
  v_choice_index integer;
  v_picked_letter text;
  v_canonical_letter text;
  v_is_correct boolean;
  v_time_ms integer;
  v_pack_size integer := 0;
  v_answers_size integer := 0;
  v_correct_count integer := 0;
  v_scored_answers jsonb := '[]'::jsonb;
  v_finalize_result jsonb;
  v_allow_pre_accept_submit boolean := false;
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

  -- Participant-level idempotency.
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
    and v_duel.state in ('active', 'accepted', 'player1_complete', 'player2_complete')
  then
    return public.private_finalize_duel_core(p_duel_id, format('%s:match-expired', p_idempotency_key));
  end if;

  if (not v_duel.is_bot_match)
     and v_actor = v_duel.challenger_id
     and v_duel.state in ('pending', 'created')
  then
    v_allow_pre_accept_submit := true;
  end if;

  if v_duel.state not in ('active', 'accepted', 'player1_complete', 'player2_complete')
     and not v_allow_pre_accept_submit
  then
    return jsonb_build_object('status', 'error', 'code', 'duel_not_ready_for_attempt', 'state', v_duel.state);
  end if;

  if v_duel.question_ids is null
     or v_duel.choices_order is null
     or v_duel.answer_map is null
     or v_duel.content_hash is null
     or v_duel.sealed_at is null
  then
    return jsonb_build_object('status', 'error', 'code', 'duel_pack_unsealed');
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    return jsonb_build_object('status', 'error', 'code', 'answer_count_mismatch');
  end if;

  v_pack_size := coalesce(array_length(v_duel.question_ids, 1), 0);
  v_answers_size := jsonb_array_length(p_answers);

  if v_pack_size < 1 or v_answers_size <> v_pack_size then
    return jsonb_build_object(
      'status', 'error',
      'code', 'answer_count_mismatch',
      'expected', v_pack_size,
      'received', v_answers_size
    );
  end if;

  -- Server-authoritative scoring against sealed duel columns.
  for v_idx in 0..(v_pack_size - 1) loop
    v_row := coalesce(p_answers -> v_idx, '{}'::jsonb);

    if coalesce(v_row->>'choice_index', '') ~ '^-?[0-9]+$' then
      v_choice_index := (v_row->>'choice_index')::integer;
    elsif coalesce(v_row->>'selected_index', '') ~ '^-?[0-9]+$' then
      v_choice_index := (v_row->>'selected_index')::integer;
    else
      v_choice_index := -1;
    end if;

    if coalesce(v_row->>'time_ms', '') ~ '^[0-9]+$' then
      v_time_ms := greatest(0, (v_row->>'time_ms')::integer);
    else
      v_time_ms := 0;
    end if;

    if v_choice_index >= 0 and v_choice_index <= 3 then
      v_picked_letter := upper((v_duel.choices_order -> v_idx) ->> v_choice_index);
    else
      v_picked_letter := null;
    end if;

    v_canonical_letter := upper((v_duel.answer_map -> v_idx) ->> 'answer');
    v_is_correct := (v_picked_letter is not null and v_canonical_letter is not null and v_picked_letter = v_canonical_letter);

    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_scored_answers := v_scored_answers || jsonb_build_array(
      jsonb_build_object(
        'question_id', v_duel.question_ids[v_idx + 1],
        'choice_index', v_choice_index,
        'is_correct', v_is_correct,
        'time_ms', v_time_ms
      )
    );
  end loop;

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
    v_scored_answers,
    v_pack_size,
    v_correct_count,
    greatest(0, coalesce(p_total_time_ms, 0)),
    now(),
    now(),
    p_idempotency_key
  )
  returning * into v_attempt;

  -- Per-question event writes (monotonic event_seq, idempotency-safe).
  v_idx := 0;
  for v_answer in
    select value from jsonb_array_elements(v_scored_answers) as a(value)
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
$function$;

COMMENT ON FUNCTION public.submit_attempt(uuid, jsonb, integer, text) IS
  'MR-035 contract repair: server-authoritative scoring from sealed question_ids/choices_order/answer_map with active/accepted readiness and idempotent retries.';

CREATE OR REPLACE FUNCTION public.accept_duel(p_duel_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'duel', public.private_duel_envelope(v_duel));
  end if;

  if v_duel.state in ('completed', 'expired', 'settled', 'finalized', 'void') then
    return jsonb_build_object('status', 'error', 'code', 'duel_terminal_state', 'state', v_duel.state);
  end if;

  if v_duel.state in ('created', 'pending') then
    update public.duel_challenges
    set
      state = 'active',
      accepted_at = coalesce(accepted_at, now()),
      match_expires_at = coalesce(match_expires_at, now() + interval '48 hours'),
      updated_at = now()
    where id = p_duel_id
    returning * into v_duel;

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

    return jsonb_build_object('status', 'ok', 'duel', public.private_duel_envelope(v_duel));
  end if;

  if v_duel.state in ('active', 'accepted', 'player1_complete', 'player2_complete') then
    return jsonb_build_object('status', 'ok', 'idempotent', true, 'duel', public.private_duel_envelope(v_duel));
  end if;

  return jsonb_build_object('status', 'error', 'code', 'duel_state_invalid', 'state', v_duel.state);
end;
$function$;

COMMENT ON FUNCTION public.accept_duel(uuid, text) IS
  'MR-035 contract repair: idempotent accept across pending/created and already-active async states so challenger-first submissions do not block opponent entry.';

CREATE OR REPLACE FUNCTION public.fetch_results(p_duel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'duel', public.private_duel_envelope(v_duel),
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
$function$;

COMMENT ON FUNCTION public.fetch_results(uuid) IS
  'MR-035 contract repair: participant-gated fetch that never returns answer_map pre-finalization; duel envelope is sanitized.';

COMMIT;
