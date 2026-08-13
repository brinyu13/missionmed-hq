BEGIN;

CREATE OR REPLACE FUNCTION public.sf_admin_publish_inspiration_prompt(p_prompt jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.sf_actor_id();
  v_id uuid;
  v_existing public.sf_inspiration_prompts;
  v_key text;
  v_row public.sf_inspiration_prompts;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('inspiration_admin', ARRAY['admin']) THEN
    RAISE EXCEPTION 'admin disabled' USING ERRCODE = '42501';
  END IF;

  v_id := NULLIF(p_prompt->>'id', '')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.sf_inspiration_prompts
     WHERE id = v_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'prompt not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.library_key <> p_prompt->>'libraryKey'
       OR v_existing.row_version <> ((p_prompt->>'expectedVersion')::bigint) THEN
      RAISE EXCEPTION 'prompt conflict' USING ERRCODE = '40001';
    END IF;
    IF v_existing.state = 'active'
       AND p_prompt->>'state' = 'retired'
       AND (SELECT count(*) FROM public.sf_inspiration_prompts WHERE state = 'active') <= 1 THEN
      RAISE EXCEPTION 'active bank cannot be empty' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.sf_inspiration_prompt_history(prompt_id, row_version, snapshot, actor_id)
    VALUES(v_existing.id, v_existing.row_version, to_jsonb(v_existing), v_actor)
    ON CONFLICT (prompt_id, row_version) DO NOTHING;

    UPDATE public.sf_inspiration_prompts
       SET text = p_prompt->>'text',
           who_ids = ARRAY(SELECT jsonb_array_elements_text(p_prompt->'who')),
           who_detail_ids = ARRAY(SELECT jsonb_array_elements_text(p_prompt->'whoDetail')),
           domain_ids = ARRAY(SELECT jsonb_array_elements_text(p_prompt->'domain')),
           energy_ids = ARRAY(SELECT jsonb_array_elements_text(p_prompt->'energy')),
           territory = p_prompt->>'territory',
           follow_up = p_prompt->>'followUp',
           interview_use = p_prompt->>'interviewUse',
           state = p_prompt->>'state',
           recommended = (p_prompt->>'recommended')::boolean,
           sort_order = (p_prompt->>'sortOrder')::integer,
           row_version = row_version + 1,
           updated_at = now()
     WHERE id = v_id
     RETURNING * INTO v_row;
  ELSE
    v_id := COALESCE(NULLIF(p_prompt->>'serverId', '')::uuid, gen_random_uuid());
    SELECT 'q-' || lpad((COALESCE(max(substring(library_key from 3)::integer), 0) + 1)::text, 3, '0')
      INTO v_key
      FROM public.sf_inspiration_prompts;
    INSERT INTO public.sf_inspiration_prompts(
      id, library_key, text, who_ids, who_detail_ids, domain_ids, energy_ids,
      territory, follow_up, interview_use, state, recommended, imported, sort_order
    )
    VALUES(
      v_id, v_key, p_prompt->>'text',
      ARRAY(SELECT jsonb_array_elements_text(p_prompt->'who')),
      ARRAY(SELECT jsonb_array_elements_text(p_prompt->'whoDetail')),
      ARRAY(SELECT jsonb_array_elements_text(p_prompt->'domain')),
      ARRAY(SELECT jsonb_array_elements_text(p_prompt->'energy')),
      p_prompt->>'territory', p_prompt->>'followUp', p_prompt->>'interviewUse',
      p_prompt->>'state', (p_prompt->>'recommended')::boolean,
      COALESCE((p_prompt->>'imported')::boolean, false),
      (p_prompt->>'sortOrder')::integer
    )
    RETURNING * INTO v_row;
  END IF;

  PERFORM public.sf_append_audit(
    'inspiration.prompt_published', 'inspiration_prompt', v_row.id, 'system',
    NULL, NULL, NULL, NULL,
    jsonb_build_object('rowVersion', v_row.row_version, 'state', v_row.state),
    NULL, 'admin_only'
  );
  RETURN to_jsonb(v_row);
END
$$;

REVOKE ALL ON FUNCTION public.sf_admin_publish_inspiration_prompt(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_admin_publish_inspiration_prompt(jsonb) TO authenticated;

COMMIT;
