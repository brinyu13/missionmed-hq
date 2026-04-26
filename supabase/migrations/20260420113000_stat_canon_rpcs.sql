-- =============================================================================
-- 20260420_stat_canon_rpcs.sql
-- MR-702 STAT Async Duel V1 | Phase 2, Step 2.2
-- (B3)-STAT-PH2-CLAUDE-HIGH-002
--
-- UPDATE CREATE RPCS + ADD CANONICAL PACK RPCS (signatures preserved).
--
-- Authority: MR-702 v1.1 (corrected via MR-703). Builds on:
--   20260420_stat_canon_schema.sql    (Phase 1: canonical pack columns,
--                                      state canon pending|active|finalized|void,
--                                      monotonic state-transition trigger,
--                                      dataset_registry)
--   20260420_stat_dataset_ingest.sql  (Phase 1.2: 845-row dataset_questions seed,
--                                      dataset_canonical_hash, registry row)
--   20260420_stat_canon_helpers.sql   (Phase 2.1: pick_questions_seeded,
--                                      shuffle_choices_seeded,
--                                      content_hash_compute,
--                                      answer_map_for)
--
-- SIGNATURE DISCIPLINE (non-negotiable):
--   * submit_attempt(uuid, jsonb, integer, text)     - body rewrite only
--   * accept_duel(uuid, text)                        - body rewrite only
--   * finalize_duel(uuid, text)                      - body rewrite only
--     (existing default `p_idempotency_key text default null` preserved)
--   * create_duel(uuid, jsonb, text, boolean, uuid, text, text)
--     - OLD: 6-param. NEW: 7-param. p_dataset_version text DEFAULT NULL at END.
--     The 6-param overload is DROPPED to prevent ambiguity. Old callers that
--     passed 6 positional args continue to resolve because param 7 has a
--     DEFAULT NULL.
--   * create_bot_duel(uuid, text, text) - NEW. p_dataset_version at END.
--   * get_duel_pack(uuid)               - NEW
--   * get_duel_result(uuid)             - NEW
--
-- NAMED ERRORS (raised with errcode 'P0001' via `raise exception`):
--   auth_required, idempotency_key_required, dataset_version_unknown,
--   dataset_version_mismatch, insufficient_questions, duel_not_found,
--   duel_pack_unsealed, duel_state_invalid, duel_not_ready_for_finalize,
--   duel_not_finalized, answer_count_mismatch, not_duel_participant,
--   not_duel_opponent, cannot_challenge_self, opponent_id_required_for_human_duel,
--   no_active_bot_profiles
--
-- ANTI-CHEAT: the server NEVER accepts a client-provided score. submit_attempt
-- rehydrates the sealed canonical pack from duel_challenges, resolves each
-- client choice_index through choices_order, and compares the unshuffled
-- letter to answer_map server-side. Clients receive only display order plus
-- shuffled prompts until the duel is finalized.
-- =============================================================================

begin;
-- =============================================================================
-- TASK A.1 - Drop old 6-param create_duel to avoid overload ambiguity.
-- =============================================================================
-- If a caller still dispatches on 6 positional args we rely on the 7-param
-- overload's trailing DEFAULT NULL to resolve, NOT on a second overload sitting
-- alongside. DROP IF EXISTS keeps re-runs idempotent.
drop function if exists public.create_duel(uuid, jsonb, text, boolean, uuid, text);
-- =============================================================================
-- TASK A.2 - create_duel (canonical-seal rewrite).
-- =============================================================================
-- Human vs human and (legacy) human vs bot path. Seals the canonical pack at
-- insert time using the Phase 2.1 helpers and the Phase 1 schema columns.
--
-- Envelope returned DOES NOT include answer_map. Clients must call
-- get_duel_pack after insert.
create or replace function public.create_duel(
  p_opponent_id uuid default null,
  p_question_set jsonb default null,  -- retained for backward compatibility; ignored under canonical seal
  p_idempotency_key text default null,
  p_is_bot_match boolean default false,
  p_bot_profile_id uuid default null,
  p_source text default 'direct',
  p_dataset_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor              uuid        := auth.uid();
  v_duel               public.duel_challenges%rowtype;
  v_existing           public.duel_challenges%rowtype;
  v_dataset_version    text;
  v_duel_id            uuid        := gen_random_uuid();
  v_seed               text;
  v_question_ids       text[];
  v_choices_order      jsonb;
  v_answer_map         jsonb;
  v_content_hash       text;
  v_bot_id             uuid;
  v_bot_run            jsonb;
  v_pack_count         integer     := 10;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key_required';
  end if;

  -- Idempotent re-entry: return the already-sealed duel unchanged.
  select * into v_existing
  from public.duel_challenges
  where challenger_id = v_actor
    and create_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'status',     'ok',
      'idempotent', true,
      'duel',       public.private_duel_envelope(v_existing)
    );
  end if;

  perform public.ensure_player_profile(v_actor);

  -- Resolve dataset_version: explicit argument -> registry current -> error.
  v_dataset_version := coalesce(
    nullif(btrim(p_dataset_version), ''),
    public.dataset_registry_current()
  );

  if v_dataset_version is null then
    raise exception 'dataset_version_unknown';
  end if;

  -- Bot-match path: seal + auto-activate + generate bot attempt.
  if p_is_bot_match then
    if p_bot_profile_id is null then
      select id into v_bot_id
      from public.bot_profiles
      where active = true
      order by
        case tier
          when 'resident'  then 1
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

    -- Canonical seal.
    v_seed          := encode(digest(v_duel_id::text || ':' || v_dataset_version, 'sha256'), 'hex');
    v_question_ids  := public.pick_questions_seeded(v_seed, v_pack_count, v_dataset_version);
    v_choices_order := public.shuffle_choices_seeded(v_seed, v_question_ids, v_dataset_version);
    v_answer_map    := public.answer_map_for(v_question_ids, v_dataset_version);
    v_content_hash  := public.content_hash_compute(v_question_ids, v_choices_order, v_dataset_version);

    insert into public.duel_challenges (
      id,
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
      match_expires_at,
      dataset_version,
      question_ids,
      choices_order,
      answer_map,
      content_hash,
      sealed_at
    )
    values (
      v_duel_id,
      v_actor,
      null,
      true,
      v_bot_id,
      false,
      coalesce(nullif(btrim(p_source), ''), 'bot'),
      '[]'::jsonb,
      'pending',
      p_idempotency_key,
      now(),
      now(),
      now() + interval '48 hours',
      v_dataset_version,
      v_question_ids,
      v_choices_order,
      v_answer_map,
      v_content_hash,
      now()
    )
    returning * into v_duel;

    -- Bot matches auto-activate (pending -> active is allowed by trigger).
    update public.duel_challenges
    set state = 'active', updated_at = now()
    where id = v_duel_id
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
      jsonb_build_object(
        'is_bot_match',    true,
        'bot_profile_id',  v_bot_id,
        'dataset_version', v_dataset_version,
        'content_hash',    v_content_hash
      )
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

    -- Bot attempt generated out of band; its scoring runs against the sealed
    -- canonical answer_map through private_generate_bot_attempt.
    v_bot_run := public.private_generate_bot_attempt(v_duel.id, v_bot_id);

    return jsonb_build_object(
      'status',   'ok',
      'duel',     public.private_duel_envelope(v_duel),
      'bot_run',  v_bot_run
    );
  end if;

  -- Human vs human path.
  if p_opponent_id is null then
    raise exception 'opponent_id_required_for_human_duel';
  end if;

  if p_opponent_id = v_actor then
    raise exception 'cannot_challenge_self';
  end if;

  perform public.ensure_player_profile(p_opponent_id);

  -- Canonical seal.
  v_seed          := encode(digest(v_duel_id::text || ':' || v_dataset_version, 'sha256'), 'hex');
  v_question_ids  := public.pick_questions_seeded(v_seed, v_pack_count, v_dataset_version);
  v_choices_order := public.shuffle_choices_seeded(v_seed, v_question_ids, v_dataset_version);
  v_answer_map    := public.answer_map_for(v_question_ids, v_dataset_version);
  v_content_hash  := public.content_hash_compute(v_question_ids, v_choices_order, v_dataset_version);

  insert into public.duel_challenges (
    id,
    challenger_id,
    opponent_id,
    is_bot_match,
    bot_profile_id,
    is_ranked,
    source,
    question_set,
    state,
    create_idempotency_key,
    challenge_expires_at,
    dataset_version,
    question_ids,
    choices_order,
    answer_map,
    content_hash,
    sealed_at
  )
  values (
    v_duel_id,
    v_actor,
    p_opponent_id,
    false,
    null,
    true,
    coalesce(nullif(btrim(p_source), ''), 'direct'),
    '[]'::jsonb,
    'pending',
    p_idempotency_key,
    now() + interval '24 hours',
    v_dataset_version,
    v_question_ids,
    v_choices_order,
    v_answer_map,
    v_content_hash,
    now()
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
    jsonb_build_object(
      'is_bot_match',    false,
      'opponent_id',     p_opponent_id,
      'dataset_version', v_dataset_version,
      'content_hash',    v_content_hash
    )
  );

  return jsonb_build_object(
    'status', 'ok',
    'duel',   public.private_duel_envelope(v_duel)
  );
end;
$$;
comment on function public.create_duel(uuid, jsonb, text, boolean, uuid, text, text) is
  'Server-authoritative duel creation with canonical seal. MR-702 Phase 2.2. p_question_set is retained for back-compat but ignored; server seals from dataset_version.';
-- =============================================================================
-- TASK A.3 - create_bot_duel (new dedicated bot entry point).
-- =============================================================================
create or replace function public.create_bot_duel(
  p_bot_profile_id uuid default null,
  p_idempotency_key text default null,
  p_dataset_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.create_duel(
    null,                 -- p_opponent_id
    null,                 -- p_question_set (ignored by canonical seal)
    p_idempotency_key,    -- p_idempotency_key
    true,                 -- p_is_bot_match
    p_bot_profile_id,     -- p_bot_profile_id
    'bot',                -- p_source
    p_dataset_version     -- p_dataset_version (resolved inside create_duel)
  );
end;
$$;
comment on function public.create_bot_duel(uuid, text, text) is
  'Convenience wrapper for create_duel(p_is_bot_match=true). MR-702 Phase 2.2.';
-- =============================================================================
-- Private helper: envelope builder (no answer_map leak).
-- =============================================================================
-- Every RPC that returns a duel row routes through this helper so the
-- answer_map column can never accidentally ship to clients before
-- finalization. Only get_duel_result (TASK F) reads answer_map directly.
create or replace function public.private_duel_envelope(
  p_duel public.duel_challenges
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',                    p_duel.id,
    'challenger_id',         p_duel.challenger_id,
    'opponent_id',           p_duel.opponent_id,
    'is_bot_match',          p_duel.is_bot_match,
    'bot_profile_id',        p_duel.bot_profile_id,
    'is_ranked',             p_duel.is_ranked,
    'source',                p_duel.source,
    'state',                 p_duel.state,
    'dataset_version',       p_duel.dataset_version,
    'question_ids',          to_jsonb(p_duel.question_ids),
    'choices_order',         p_duel.choices_order,
    'content_hash',          p_duel.content_hash,
    'sealed_at',             p_duel.sealed_at,
    'challenge_expires_at',  p_duel.challenge_expires_at,
    'match_expires_at',      p_duel.match_expires_at,
    'accepted_at',           p_duel.accepted_at,
    'completed_at',          p_duel.completed_at,
    'created_at',            p_duel.created_at,
    'updated_at',            p_duel.updated_at
  );
$$;
comment on function public.private_duel_envelope(public.duel_challenges) is
  'Builds the client-safe duel envelope. Never leaks answer_map. MR-702 Phase 2.2.';
-- =============================================================================
-- TASK B - get_duel_pack (participant-gated, no answer_map).
-- =============================================================================
create or replace function public.get_duel_pack(
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_duel  public.duel_challenges%rowtype;
  v_prompts jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  -- Leak-safe participant gate: any unauthorized read (including unknown id)
  -- raises duel_not_found so existence of a duel the user does not own is
  -- never disclosed through side channels.
  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
    and (
      challenger_id = v_actor
      or opponent_id = v_actor
    );

  if not found then
    raise exception 'duel_not_found';
  end if;

  if v_duel.content_hash is null or v_duel.sealed_at is null then
    raise exception 'duel_pack_unsealed';
  end if;

  -- Rehydrate display prompts for the sealed question_ids in canonical order.
  -- Client displays choices in the shuffled order from choices_order[i].
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id',   dq.question_id,
        'prompt',        dq.prompt,
        'choice_a',      dq.choice_a,
        'choice_b',      dq.choice_b,
        'choice_c',      dq.choice_c,
        'choice_d',      dq.choice_d,
        'display_order', v_duel.choices_order -> (ord - 1)
      )
      order by ord
    ),
    '[]'::jsonb
  )
  into v_prompts
  from unnest(v_duel.question_ids) with ordinality as u(qid, ord)
  join public.dataset_questions dq
    on dq.dataset_version = v_duel.dataset_version
   and dq.question_id     = u.qid;

  return jsonb_build_object(
    'status',    'ok',
    'duel',      public.private_duel_envelope(v_duel),
    'questions', v_prompts
  );
end;
$$;
comment on function public.get_duel_pack(uuid) is
  'Returns canonical pack envelope for a participant. Never returns answer_map. MR-702 Phase 2.2.';
-- =============================================================================
-- TASK C - accept_duel (body rewrite, signature preserved).
-- =============================================================================
create or replace function public.accept_duel(
  p_duel_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := auth.uid();
  v_duel    public.duel_challenges%rowtype;
  v_updated integer;
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
    raise exception 'duel_not_found';
  end if;

  if v_duel.is_bot_match then
    -- Bot duels are auto-activated during create; reject explicit accept.
    raise exception 'duel_state_invalid';
  end if;

  if v_duel.opponent_id is distinct from v_actor then
    raise exception 'not_duel_opponent';
  end if;

  -- Idempotent re-entry on the same key: return current envelope unchanged.
  if exists (
    select 1
    from public.duel_events e
    where e.duel_id = p_duel_id
      and e.idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object(
      'status',     'ok',
      'idempotent', true,
      'duel',       public.private_duel_envelope(v_duel)
    );
  end if;

  -- Canon: pending -> active. Monotonic trigger rejects anything else.
  update public.duel_challenges
  set
    state            = 'active',
    accepted_at      = coalesce(accepted_at, now()),
    match_expires_at = coalesce(match_expires_at, now() + interval '48 hours'),
    updated_at       = now()
  where id = p_duel_id
    and state = 'pending'
  returning * into v_duel;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'duel_state_invalid';
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

  return jsonb_build_object(
    'status', 'ok',
    'duel',   public.private_duel_envelope(v_duel)
  );
end;
$$;
comment on function public.accept_duel(uuid, text) is
  'Activates a pending duel; canonical state transition pending->active. MR-702 Phase 2.2.';
-- =============================================================================
-- TASK D - submit_attempt (body rewrite, signature LOCKED).
-- =============================================================================
-- Client payload contract for p_answers:
--   [
--     {"question_id": "UQ-...", "choice_index": 0..3, "time_ms": N},
--     ...
--   ]
-- Array length MUST match array_length(duel_challenges.question_ids, 1).
-- choice_index is 0-based into duel_challenges.choices_order[i].
-- Server derives is_correct from choices_order[i][choice_index] vs answer_map[i].answer.
-- Client-provided correctness flags or scores are IGNORED.
create or replace function public.submit_attempt(
  p_duel_id uuid,
  p_answers jsonb,
  p_total_time_ms integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor            uuid := auth.uid();
  v_duel             public.duel_challenges%rowtype;
  v_existing         public.duel_attempts%rowtype;
  v_other_attempt    public.duel_attempts%rowtype;
  v_attempt          public.duel_attempts%rowtype;
  v_pack_size        integer;
  v_answers_size     integer;
  v_idx              integer;
  v_row              jsonb;
  v_choice_index     integer;
  v_picked           text;
  v_canonical        text;
  v_is_correct       boolean;
  v_correct_count    integer := 0;
  v_time_ms          integer;
  v_scored_answers   jsonb   := '[]'::jsonb;
  v_finalize_result  jsonb;
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
    raise exception 'duel_not_found';
  end if;

  -- Participant gate.
  if v_duel.is_bot_match then
    if v_actor is distinct from v_duel.challenger_id then
      raise exception 'not_duel_participant';
    end if;
  else
    if v_actor is distinct from v_duel.challenger_id
       and v_actor is distinct from v_duel.opponent_id then
      raise exception 'not_duel_participant';
    end if;
  end if;

  -- Request-level idempotency (this exact submit key replayed).
  select * into v_existing
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor
    and submit_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'status',          'ok',
      'idempotent',      true,
      'attempt_id',      v_existing.id,
      'correct_count',   v_existing.correct_count,
      'total_questions', v_existing.total_questions,
      'total_time_ms',   v_existing.total_time_ms,
      'score',           v_existing.correct_count
    );
  end if;

  -- Participant-level idempotency (already submitted under another key).
  select * into v_existing
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_actor;

  if found then
    return jsonb_build_object(
      'status',          'ok',
      'idempotent',      true,
      'attempt_id',      v_existing.id,
      'correct_count',   v_existing.correct_count,
      'total_questions', v_existing.total_questions,
      'total_time_ms',   v_existing.total_time_ms,
      'score',           v_existing.correct_count
    );
  end if;

  -- Canonical state gate.
  if v_duel.state <> 'active' then
    raise exception 'duel_state_invalid';
  end if;

  if v_duel.content_hash is null
     or v_duel.question_ids is null
     or v_duel.choices_order is null
     or v_duel.answer_map is null
  then
    raise exception 'duel_pack_unsealed';
  end if;

  -- Length gate. jsonb_array_length only runs on arrays; coerce with safety.
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answer_count_mismatch';
  end if;

  v_pack_size    := coalesce(array_length(v_duel.question_ids, 1), 0);
  v_answers_size := jsonb_array_length(p_answers);

  if v_pack_size <> v_answers_size then
    raise exception 'answer_count_mismatch';
  end if;

  -- Score server-side. Resolve each client choice_index through choices_order
  -- into the unshuffled letter, compare to answer_map canonical answer.
  -- Each iteration is self-contained; no state carries over from prior qs.
  for v_idx in 0..(v_pack_size - 1) loop
    v_row          := p_answers -> v_idx;
    v_choice_index := coalesce((v_row ->> 'choice_index')::integer, -1);
    v_time_ms      := coalesce((v_row ->> 'time_ms')::integer, 0);

    -- Invalid choice_index (out of 0..3) -> picked letter is null -> incorrect.
    if v_choice_index < 0 or v_choice_index > 3 then
      v_picked := null;
    else
      v_picked := (v_duel.choices_order -> v_idx) ->> v_choice_index;
    end if;

    v_canonical := (v_duel.answer_map -> v_idx) ->> 'answer';

    -- Single deterministic boolean per iteration. No carry-over.
    v_is_correct := (v_picked is not null and v_picked = v_canonical);

    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_scored_answers := v_scored_answers || jsonb_build_array(
      jsonb_build_object(
        'question_id',      v_duel.question_ids[v_idx + 1],
        'choice_index',     v_choice_index,
        'picked_letter',    v_picked,
        'canonical_letter', v_canonical,
        'is_correct',       v_is_correct,
        'time_ms',          v_time_ms
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
    coalesce(p_total_time_ms, 0),
    now(),
    now(),
    p_idempotency_key
  )
  returning * into v_attempt;

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
      'correct_count',   v_attempt.correct_count,
      'total_questions', v_attempt.total_questions,
      'total_time_ms',   v_attempt.total_time_ms
    )
  );

  -- Auto-finalize when the second attempt lands.
  if (
    select count(*) from public.duel_attempts where duel_id = p_duel_id
  ) >= 2 then
    v_finalize_result := public.finalize_duel(
      p_duel_id,
      format('%s:auto-finalize', p_idempotency_key)
    );

    return jsonb_build_object(
      'status',          'ok',
      'attempt_id',      v_attempt.id,
      'correct_count',   v_attempt.correct_count,
      'total_questions', v_attempt.total_questions,
      'total_time_ms',   v_attempt.total_time_ms,
      'score',           v_attempt.correct_count,
      'finalized',       true,
      'finalize',        v_finalize_result
    );
  end if;

  return jsonb_build_object(
    'status',          'ok',
    'attempt_id',      v_attempt.id,
    'correct_count',   v_attempt.correct_count,
    'total_questions', v_attempt.total_questions,
    'total_time_ms',   v_attempt.total_time_ms,
    'score',           v_attempt.correct_count,
    'finalized',       false
  );
end;
$$;
comment on function public.submit_attempt(uuid, jsonb, integer, text) is
  'Server-authoritative scoring against sealed answer_map. Client score is never trusted. MR-702 Phase 2.2.';
-- =============================================================================
-- TASK E - finalize_duel (body rewrite around canonical state).
-- =============================================================================
-- Canonical transition: active -> finalized, guarded by (count(attempts) >= 2).
-- Idempotent on finalized state: returns the cached result. Accepts service
-- role (v_actor may be null) for oppy server-side finalization calls.
create or replace function public.finalize_duel(
  p_duel_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor            uuid := auth.uid();
  v_duel             public.duel_challenges%rowtype;
  v_attempt_count    integer;
  v_challenger_att   public.duel_attempts%rowtype;
  v_opponent_att     public.duel_attempts%rowtype;
  v_winner_user_id   uuid;
  v_challenger_score integer;
  v_opponent_score   integer;
  v_challenger_time  integer;
  v_opponent_time    integer;
  v_final_key        text;
begin
  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'duel_not_found';
  end if;

  -- Participant gate (skip when called by service role).
  if v_actor is not null then
    if v_duel.is_bot_match then
      if v_actor is distinct from v_duel.challenger_id then
        raise exception 'not_duel_participant';
      end if;
    else
      if v_actor is distinct from v_duel.challenger_id
         and v_actor is distinct from v_duel.opponent_id then
        raise exception 'not_duel_participant';
      end if;
    end if;
  end if;

  v_final_key := coalesce(
    nullif(btrim(p_idempotency_key), ''),
    format('finalize:%s:%s', p_duel_id, coalesce(v_actor::text, 'service'))
  );

  -- If already finalized: return summary, do not re-transition.
  if v_duel.state = 'finalized' then
    -- Fall through to summary computation below.
    null;
  elsif v_duel.state = 'active' then
    select count(*) into v_attempt_count
    from public.duel_attempts
    where duel_id = p_duel_id;

    if v_attempt_count < 2 then
      raise exception 'duel_not_ready_for_finalize';
    end if;

    -- Canon transition: active -> finalized. Monotonic trigger permits it.
    update public.duel_challenges
    set state      = 'finalized',
        completed_at = now(),
        updated_at = now()
    where id = p_duel_id
      and state = 'active'
    returning * into v_duel;

    perform public.private_append_duel_event(
      p_duel_id,
      'duel_finalized',
      v_final_key,
      v_actor,
      null,
      null,
      null,
      null,
      jsonb_build_object('finalized_at', now())
    );
  else
    -- pending or void: cannot finalize.
    raise exception 'duel_state_invalid';
  end if;

  -- Compute summary from sealed attempts.
  select * into v_challenger_att
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_duel.challenger_id
  order by submitted_at asc
  limit 1;

  if v_duel.is_bot_match then
    select * into v_opponent_att
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id
    order by submitted_at asc
    limit 1;
  else
    select * into v_opponent_att
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = v_duel.opponent_id
    order by submitted_at asc
    limit 1;
  end if;

  v_challenger_score := coalesce(v_challenger_att.correct_count, 0);
  v_opponent_score   := coalesce(v_opponent_att.correct_count, 0);
  v_challenger_time  := coalesce(v_challenger_att.total_time_ms, 0);
  v_opponent_time    := coalesce(v_opponent_att.total_time_ms, 0);

  if v_challenger_score > v_opponent_score then
    v_winner_user_id := v_duel.challenger_id;
  elsif v_opponent_score > v_challenger_score then
    v_winner_user_id := case when v_duel.is_bot_match then null else v_duel.opponent_id end;
  else
    -- Tie on score: faster total_time_ms wins; bot tie returns null.
    if v_challenger_time < v_opponent_time then
      v_winner_user_id := v_duel.challenger_id;
    elsif v_opponent_time < v_challenger_time then
      v_winner_user_id := case when v_duel.is_bot_match then null else v_duel.opponent_id end;
    else
      v_winner_user_id := null;
    end if;
  end if;

  return jsonb_build_object(
    'status',             'ok',
    'duel_id',            p_duel_id,
    'state',              v_duel.state,
    'challenger_score',   v_challenger_score,
    'opponent_score',     v_opponent_score,
    'challenger_time_ms', v_challenger_time,
    'opponent_time_ms',   v_opponent_time,
    'winner_user_id',     v_winner_user_id
  );
end;
$$;
comment on function public.finalize_duel(uuid, text) is
  'Canonical finalize: active -> finalized when attempts >= 2. Idempotent on finalized. MR-702 Phase 2.2.';
-- =============================================================================
-- TASK F - get_duel_result (finalized-only, includes answer_map).
-- =============================================================================
create or replace function public.get_duel_result(
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor            uuid := auth.uid();
  v_duel             public.duel_challenges%rowtype;
  v_challenger_att   public.duel_attempts%rowtype;
  v_opponent_att     public.duel_attempts%rowtype;
  v_challenger_score integer;
  v_opponent_score   integer;
  v_challenger_time  integer;
  v_opponent_time    integer;
  v_winner_user_id   uuid;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  select * into v_duel
  from public.duel_challenges
  where id = p_duel_id
    and (
      challenger_id = v_actor
      or opponent_id = v_actor
    );

  if not found then
    raise exception 'duel_not_found';
  end if;

  if v_duel.state <> 'finalized' then
    raise exception 'duel_not_finalized';
  end if;

  select * into v_challenger_att
  from public.duel_attempts
  where duel_id = p_duel_id
    and player_id = v_duel.challenger_id
  order by submitted_at asc
  limit 1;

  if v_duel.is_bot_match then
    select * into v_opponent_att
    from public.duel_attempts
    where duel_id = p_duel_id
      and bot_profile_id = v_duel.bot_profile_id
    order by submitted_at asc
    limit 1;
  else
    select * into v_opponent_att
    from public.duel_attempts
    where duel_id = p_duel_id
      and player_id = v_duel.opponent_id
    order by submitted_at asc
    limit 1;
  end if;

  v_challenger_score := coalesce(v_challenger_att.correct_count, 0);
  v_opponent_score   := coalesce(v_opponent_att.correct_count, 0);
  v_challenger_time  := coalesce(v_challenger_att.total_time_ms, 0);
  v_opponent_time    := coalesce(v_opponent_att.total_time_ms, 0);

  if v_challenger_score > v_opponent_score then
    v_winner_user_id := v_duel.challenger_id;
  elsif v_opponent_score > v_challenger_score then
    v_winner_user_id := case when v_duel.is_bot_match then null else v_duel.opponent_id end;
  else
    if v_challenger_time < v_opponent_time then
      v_winner_user_id := v_duel.challenger_id;
    elsif v_opponent_time < v_challenger_time then
      v_winner_user_id := case when v_duel.is_bot_match then null else v_duel.opponent_id end;
    else
      v_winner_user_id := null;
    end if;
  end if;

  return jsonb_build_object(
    'status',             'ok',
    'duel',               public.private_duel_envelope(v_duel),
    'answer_map',         v_duel.answer_map,
    'challenger_attempt', case when v_challenger_att.id is null then null else to_jsonb(v_challenger_att) end,
    'opponent_attempt',   case when v_opponent_att.id   is null then null else to_jsonb(v_opponent_att)   end,
    'challenger_score',   v_challenger_score,
    'opponent_score',     v_opponent_score,
    'challenger_time_ms', v_challenger_time,
    'opponent_time_ms',   v_opponent_time,
    'winner_user_id',     v_winner_user_id
  );
end;
$$;
comment on function public.get_duel_result(uuid) is
  'Finalized-only result with answer_map. Raises duel_not_finalized otherwise. MR-702 Phase 2.2.';
-- =============================================================================
-- TASK G - GRANT EXECUTE on every new and overloaded signature.
-- =============================================================================
grant execute on function public.create_duel(uuid, jsonb, text, boolean, uuid, text, text) to authenticated;
grant execute on function public.create_bot_duel(uuid, text, text)                          to authenticated;
grant execute on function public.get_duel_pack(uuid)                                        to authenticated;
grant execute on function public.accept_duel(uuid, text)                                    to authenticated;
grant execute on function public.submit_attempt(uuid, jsonb, integer, text)                 to authenticated;
grant execute on function public.finalize_duel(uuid, text)                                  to authenticated;
grant execute on function public.get_duel_result(uuid)                                      to authenticated;
-- private_duel_envelope is called internally by SECURITY DEFINER functions
-- only; no external grant needed. If Supabase PostgREST must see it later,
-- uncomment the next line.
-- grant execute on function public.private_duel_envelope(public.duel_challenges) to authenticated;


-- =============================================================================
-- Sanity probe (apply-time assert).
-- =============================================================================
-- Confirms the seven target functions exist at the expected signatures.
do $assert$
declare
  v_missing text[] := '{}';
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_duel'
      and pg_get_function_identity_arguments(p.oid) = 'p_opponent_id uuid, p_question_set jsonb, p_idempotency_key text, p_is_bot_match boolean, p_bot_profile_id uuid, p_source text, p_dataset_version text'
  ) then
    v_missing := v_missing || 'create_duel(7-param)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_bot_duel'
      and pg_get_function_identity_arguments(p.oid) = 'p_bot_profile_id uuid, p_idempotency_key text, p_dataset_version text'
  ) then
    v_missing := v_missing || 'create_bot_duel(3-param)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'accept_duel'
      and pg_get_function_identity_arguments(p.oid) = 'p_duel_id uuid, p_idempotency_key text'
  ) then
    v_missing := v_missing || 'accept_duel(2-param)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_attempt'
      and pg_get_function_identity_arguments(p.oid) = 'p_duel_id uuid, p_answers jsonb, p_total_time_ms integer, p_idempotency_key text'
  ) then
    v_missing := v_missing || 'submit_attempt(4-param)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'finalize_duel'
      and pg_get_function_identity_arguments(p.oid) = 'p_duel_id uuid, p_idempotency_key text'
  ) then
    v_missing := v_missing || 'finalize_duel(2-param)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_duel_pack'
      and pg_get_function_identity_arguments(p.oid) = 'p_duel_id uuid'
  ) then
    v_missing := v_missing || 'get_duel_pack(1-param)';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_duel_result'
      and pg_get_function_identity_arguments(p.oid) = 'p_duel_id uuid'
  ) then
    v_missing := v_missing || 'get_duel_result(1-param)';
  end if;

  -- Old 6-param create_duel MUST be gone.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_duel'
      and pg_get_function_identity_arguments(p.oid) = 'p_opponent_id uuid, p_question_set jsonb, p_idempotency_key text, p_is_bot_match boolean, p_bot_profile_id uuid, p_source text'
  ) then
    v_missing := v_missing || 'LEAK: old create_duel(6-param) still present';
  end if;

  if array_length(v_missing, 1) > 0 then
    raise exception 'MR-702 Phase 2.2 signature audit failed: %', array_to_string(v_missing, ', ');
  end if;
end;
$assert$;
commit;
-- =============================================================================
-- End of 20260420_stat_canon_rpcs.sql
-- =============================================================================;
