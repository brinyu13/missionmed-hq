-- =============================================================================
-- 20260424164000_stat_avatar_snapshot_replay_bridge.sql
-- MR-0103: STAT Avatar Integration (snapshot + opponent + replay)
-- =============================================================================
-- Scope:
--   1) Upgrade match avatar snapshot persistence to immutable JSON snapshot
--   2) Add SECURITY DEFINER RPC for opponent avatar retrieval
--   3) Extend duel_replay_payload with avatar snapshots for both players
-- =============================================================================

begin;

alter table public.match_players
  add column if not exists avatar_snapshot jsonb not null default '{}'::jsonb;

update public.match_players
set avatar_snapshot = jsonb_build_object(
  'avatar_id', null,
  'avatar_url', coalesce(nullif(btrim(coalesce(avatar_thumbnail_url, '')), ''), ''),
  'snapshot_version', 'legacy_v0',
  'created_at', captured_at
)
where coalesce(avatar_snapshot, '{}'::jsonb) = '{}'::jsonb;

create or replace function public.record_match_player_avatar_snapshot(
  p_match_id uuid,
  p_player_id uuid,
  p_avatar_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_snapshot_source jsonb := coalesce(p_avatar_snapshot, '{}'::jsonb);
  v_snapshot_created_at timestamptz := now();
  v_avatar_id text;
  v_avatar_url text;
  v_snapshot_version text;
  v_source text;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_match_id is null then
    raise exception 'match_id_required';
  end if;

  if p_player_id is null then
    raise exception 'player_id_required';
  end if;

  if p_player_id <> v_actor then
    raise exception 'player_id_must_match_auth_user';
  end if;

  select *
    into v_duel
  from public.duel_challenges
  where id = p_match_id
  limit 1;

  if not found then
    raise exception 'duel_not_found';
  end if;

  if v_duel.is_bot_match then
    if v_duel.challenger_id is distinct from v_actor then
      raise exception 'not_duel_participant';
    end if;
  else
    if v_duel.challenger_id is distinct from v_actor
       and v_duel.opponent_id is distinct from v_actor then
      raise exception 'not_duel_participant';
    end if;
  end if;

  v_avatar_id := nullif(btrim(coalesce(v_snapshot_source ->> 'avatar_id', v_snapshot_source ->> 'id', '')), '');
  v_avatar_url := coalesce(
    nullif(btrim(coalesce(v_snapshot_source ->> 'avatar_url', '')), ''),
    nullif(btrim(coalesce(v_snapshot_source ->> 'avatar_thumbnail_url', '')), ''),
    ''
  );
  v_snapshot_version := coalesce(
    nullif(btrim(coalesce(v_snapshot_source ->> 'snapshot_version', '')), ''),
    'v1'
  );
  v_source := coalesce(
    nullif(btrim(coalesce(v_snapshot_source ->> 'source', '')), ''),
    'stat_match_start'
  );

  begin
    if nullif(btrim(coalesce(v_snapshot_source ->> 'created_at', '')), '') is not null then
      v_snapshot_created_at := (v_snapshot_source ->> 'created_at')::timestamptz;
    end if;
  exception
    when others then
      v_snapshot_created_at := now();
  end;

  insert into public.match_players (
    match_id,
    player_id,
    avatar_thumbnail_url,
    avatar_snapshot,
    metadata,
    captured_at
  )
  values (
    p_match_id,
    p_player_id,
    v_avatar_url,
    jsonb_build_object(
      'avatar_id', v_avatar_id,
      'avatar_url', v_avatar_url,
      'snapshot_version', v_snapshot_version,
      'created_at', v_snapshot_created_at
    ),
    jsonb_build_object(
      'source', v_source,
      'snapshot_version', v_snapshot_version,
      'saved_at', now()
    ),
    now()
  )
  on conflict (match_id, player_id) do nothing;
end;
$$;

create or replace function public.record_match_player_avatar_snapshot(
  p_match_id uuid,
  p_avatar_thumbnail_url text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  perform public.record_match_player_avatar_snapshot(
    p_match_id,
    v_actor,
    jsonb_build_object(
      'avatar_id', null,
      'avatar_url', coalesce(nullif(btrim(coalesce(p_avatar_thumbnail_url, '')), ''), ''),
      'snapshot_version', 'legacy_v0',
      'created_at', now(),
      'source', 'legacy_thumbnail_call'
    )
  );
end;
$$;

create or replace function public.get_match_opponent_avatar(
  p_match_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_duel public.duel_challenges%rowtype;
  v_players jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    raise exception 'auth_required';
  end if;

  if p_match_id is null then
    raise exception 'match_id_required';
  end if;

  select *
    into v_duel
  from public.duel_challenges
  where id = p_match_id
  limit 1;

  if not found then
    raise exception 'duel_not_found';
  end if;

  if v_duel.is_bot_match then
    if v_duel.challenger_id is distinct from v_actor then
      raise exception 'not_duel_participant';
    end if;
  else
    if v_duel.challenger_id is distinct from v_actor
       and v_duel.opponent_id is distinct from v_actor then
      raise exception 'not_duel_participant';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.player_id,
        'role', case when p.player_id = v_actor then 'self' else 'opponent' end,
        'avatar_snapshot',
          coalesce(
            nullif(mp.avatar_snapshot, '{}'::jsonb),
            jsonb_build_object(
              'avatar_id', null,
              'avatar_url', coalesce(nullif(btrim(coalesce(mp.avatar_thumbnail_url, '')), ''), ''),
              'snapshot_version', 'legacy_v0',
              'created_at', coalesce(mp.captured_at, now())
            )
          )
      )
      order by case when p.player_id = v_actor then 0 else 1 end
    ),
    '[]'::jsonb
  )
  into v_players
  from (
    select v_duel.challenger_id as player_id
    union all
    select v_duel.opponent_id as player_id
    where v_duel.opponent_id is not null
  ) p
  left join public.match_players mp
    on mp.match_id = p_match_id
   and mp.player_id = p.player_id;

  return jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'players', v_players
  );
end;
$$;

create or replace function public.duel_replay_payload(
  p_match_id uuid,
  p_target_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid;
  v_target_id uuid;
  v_match_row jsonb;
  v_questions jsonb;
  v_terminal_count int;
  v_pack_question_count int;
  v_duplicate_seq_count int;
  v_hash_values text[];
  v_hash_distinct int;
  v_warnings jsonb := '[]'::jsonb;
  v_caller_match_row record;
  v_duel_seed text;
  v_duel_question_ids text[];
  v_stored_question_ids jsonb := '[]'::jsonb;
  v_duel_pack_count int;
  v_avatar_snapshots jsonb := '[]'::jsonb;
  v_target_avatar_snapshot jsonb := null;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object(
      'ok', false,
      'error_code', 'auth_required',
      'message', 'Authentication required'
    );
  end if;

  v_target_id := coalesce(p_target_user_id, v_caller_id);

  if v_target_id <> v_caller_id then
    return jsonb_build_object(
      'ok', false,
      'error_code', 'ghost_consent_required',
      'message', 'Ghost replay requires target user opt-in consent. This feature is not yet available.'
    );
  end if;

  select jsonb_build_object(
    'id',                   ma.id,
    'match_id',             ma.match_id,
    'user_id',              ma.user_id,
    'session_id',           ma.session_id,
    'mode_type',            ma.mode_type,
    'dataset_version',      ma.dataset_version,
    'content_hash',         ma.content_hash,
    'pack_question_count',  ma.pack_question_count,
    'result_state',         ma.result_state,
    'scoring_version',      ma.scoring_version,
    'score_raw',            ma.score_raw,
    'score_normalized',     ma.score_normalized,
    'created_at',           ma.created_at,
    'updated_at',           ma.updated_at
  ),
  ma.pack_question_count
  into v_match_row, v_pack_question_count
  from match_attempts ma
  where ma.match_id = p_match_id
    and ma.user_id = v_target_id;

  if v_match_row is null then
    return jsonb_build_object(
      'ok', false,
      'error_code', 'match_not_found',
      'message', 'No match_attempt found for the given match_id and target user'
    );
  end if;

  select dc.seed, dc.question_ids, dc.pack_question_count
  into v_duel_seed, v_duel_question_ids, v_duel_pack_count
  from public.duel_challenges dc
  where dc.id = p_match_id;

  if found then
    v_stored_question_ids := coalesce(to_jsonb(v_duel_question_ids), '[]'::jsonb);
    if coalesce(v_pack_question_count, 0) = 0 then
      v_pack_question_count := coalesce(v_duel_pack_count, array_length(v_duel_question_ids, 1), 0);
    end if;

    v_match_row := v_match_row || jsonb_build_object(
      'seed', v_duel_seed,
      'question_ids', v_stored_question_ids,
      'pack_question_count', v_pack_question_count
    );
  else
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'stored_question_ids_missing',
        'detail', 'duel_challenges row missing for this match_id'
      )
    );
  end if;

  select coalesce(
    nullif(mp.avatar_snapshot, '{}'::jsonb),
    jsonb_build_object(
      'avatar_id', null,
      'avatar_url', coalesce(nullif(btrim(coalesce(mp.avatar_thumbnail_url, '')), ''), ''),
      'snapshot_version', 'legacy_v0',
      'created_at', coalesce(mp.captured_at, now())
    )
  )
  into v_target_avatar_snapshot
  from public.match_players mp
  where mp.match_id = p_match_id
    and mp.player_id = v_target_id
  limit 1;

  if v_target_avatar_snapshot is not null then
    v_match_row := v_match_row || jsonb_build_object(
      'avatar_snapshot', v_target_avatar_snapshot
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_id', p.player_id,
        'role', case when p.player_id = v_caller_id then 'self' else 'opponent' end,
        'avatar_snapshot',
          coalesce(
            nullif(mp.avatar_snapshot, '{}'::jsonb),
            jsonb_build_object(
              'avatar_id', null,
              'avatar_url', coalesce(nullif(btrim(coalesce(mp.avatar_thumbnail_url, '')), ''), ''),
              'snapshot_version', 'legacy_v0',
              'created_at', coalesce(mp.captured_at, now())
            )
          )
      )
      order by case when p.player_id = v_caller_id then 0 else 1 end
    ),
    '[]'::jsonb
  )
  into v_avatar_snapshots
  from (
    select dc.challenger_id as player_id
    from public.duel_challenges dc
    where dc.id = p_match_id
    union all
    select dc.opponent_id as player_id
    from public.duel_challenges dc
    where dc.id = p_match_id
      and dc.opponent_id is not null
  ) p
  left join public.match_players mp
    on mp.match_id = p_match_id
   and mp.player_id = p.player_id;

  if v_target_id <> v_caller_id then
    select * into v_caller_match_row
    from match_attempts
    where match_id = p_match_id
      and user_id = v_caller_id;

    if v_caller_match_row is null then
      return jsonb_build_object(
        'ok', false,
        'error_code', 'replay_version_mismatch',
        'message', 'Caller has no match_attempt for this match_id'
      );
    end if;

    if v_caller_match_row.dataset_version <> (v_match_row->>'dataset_version')
       or v_caller_match_row.content_hash <> (v_match_row->>'content_hash') then
      return jsonb_build_object(
        'ok', false,
        'error_code', 'replay_version_mismatch',
        'message', 'dataset_version or content_hash mismatch between caller and target match'
      );
    end if;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'question_id',                               qa.question_id,
      'server_sequence_index',                     qa.server_sequence_index,
      'displayed_choices_order',                   qa.displayed_choices_order,
      'computed_correct_index_after_permutation',  qa.computed_correct_index_after_permutation,
      'selected_index',                            qa.selected_index,
      'correct',                                   qa.correct,
      'result_state',                              qa.result_state,
      'question_started_at',                       qa.question_started_at,
      'question_answered_at',                      qa.question_answered_at,
      'time_to_first_answer_ms',                   qa.time_to_first_answer_ms,
      'total_time_on_question_ms',                 qa.total_time_on_question_ms,
      'content_hash',                              qa.content_hash,
      'dataset_version',                           qa.dataset_version
    )
    order by qa.server_sequence_index asc
  )
  into v_questions
  from question_attempts qa
  where qa.match_id = p_match_id
    and qa.user_id = v_target_id;

  if v_questions is null then
    v_questions := '[]'::jsonb;
  end if;

  select count(*)
  into v_terminal_count
  from question_attempts qa
  where qa.match_id = p_match_id
    and qa.user_id = v_target_id
    and qa.result_state not in ('presented', 'pending');

  if coalesce(v_pack_question_count, 0) > 0 and v_terminal_count <> v_pack_question_count then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'terminal_count_mismatch',
        'detail', format('terminal_count=%s but pack_question_count=%s', v_terminal_count, v_pack_question_count)
      )
    );
  end if;

  select count(*) - count(distinct qa.server_sequence_index)
  into v_duplicate_seq_count
  from question_attempts qa
  where qa.match_id = p_match_id
    and qa.user_id = v_target_id;

  if v_duplicate_seq_count > 0 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'duplicate_sequence_index',
        'detail', format('%s duplicate server_sequence_index values detected', v_duplicate_seq_count)
      )
    );
  end if;

  select array_agg(distinct qa.content_hash)
  into v_hash_values
  from question_attempts qa
  where qa.match_id = p_match_id
    and qa.user_id = v_target_id;

  v_hash_distinct := coalesce(array_length(v_hash_values, 1), 0);

  if v_hash_distinct > 1 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object(
        'code', 'content_hash_inconsistency',
        'detail', format('%s distinct content_hash values found across question_attempts', v_hash_distinct)
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'match_attempt', v_match_row,
    'question_ids', v_stored_question_ids,
    'question_attempts', v_questions,
    'question_count', jsonb_array_length(v_questions),
    'avatar_snapshots', v_avatar_snapshots,
    'warnings', v_warnings
  );
end;
$$;

grant execute on function public.record_match_player_avatar_snapshot(uuid, uuid, jsonb) to authenticated;
grant execute on function public.record_match_player_avatar_snapshot(uuid, text) to authenticated;
grant execute on function public.get_match_opponent_avatar(uuid) to authenticated;
grant execute on function public.duel_replay_payload(uuid, uuid) to authenticated;

commit;
