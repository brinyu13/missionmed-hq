-- Fix private_generate_bot_attempt digest call for Supabase extension schema compatibility.
-- Keeps behavior unchanged; only qualifies digest() with extensions schema.
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

  v_payload_hash := encode(extensions.digest(v_score::text, 'sha256'), 'hex');

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
