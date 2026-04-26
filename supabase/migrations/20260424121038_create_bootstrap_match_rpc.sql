
-- bootstrap_match: thin wrapper around get_duel_pack logic
-- Adds correct_index (original position: A=0,B=1,C=2,D=3) for client-side grading.
-- Created to unblock STAT v2 "Enter the Duel" flow.
-- Pre-existing gap: this RPC was referenced by stat_latest.html but never deployed.

CREATE OR REPLACE FUNCTION public.bootstrap_match(
  p_match_id uuid,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
declare
    v_actor   uuid := auth.uid();
    v_duel    public.duel_challenges%rowtype;
    v_prompts jsonb;
begin
    if v_actor is null then
        raise exception 'auth_required';
    end if;

    select * into v_duel
    from public.duel_challenges
    where id = p_match_id
      and (challenger_id = v_actor or opponent_id = v_actor);

    if not found then
        raise exception 'duel_not_found';
    end if;

    if v_duel.content_hash is null or v_duel.sealed_at is null then
        raise exception 'duel_pack_unsealed';
    end if;

    select coalesce(
               jsonb_agg(
                   jsonb_build_object(
                       'question_id',   dq.question_id,
                       'prompt',        dq.prompt,
                       'choice_a',      dq.choice_a,
                       'choice_b',      dq.choice_b,
                       'choice_c',      dq.choice_c,
                       'choice_d',      dq.choice_d,
                       'display_order', v_duel.choices_order -> ((ord - 1)::int),
                       'correct_index', case dq.answer
                           when 'A' then 0
                           when 'B' then 1
                           when 'C' then 2
                           when 'D' then 3
                           else 0
                       end,
                       'answer',        dq.answer,
                       'explanation',   dq.explanation
                   ) order by ord
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
;
