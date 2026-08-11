\set ON_ERROR_STOP on

-- Migration: B1-514 StoryForge V2 Inspiration domain.
-- Authority: DR-042 / DR-043; B1-513 Inspiration Product & Pedagogy Specification.
-- Depends on: 20260810200000_b1_514_v2_r2_story_versions_provenance.sql

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v2-r3-inspiration', 0));

ALTER TABLE public.sf_users
  ADD COLUMN inspiration_layout text NOT NULL DEFAULT 'list'
  CHECK (inspiration_layout IN ('list', 'grid'));

ALTER TABLE public.sf_stories
  ADD COLUMN origin jsonb
  CHECK (
    origin IS NULL OR (
      jsonb_typeof(origin) = 'object'
      AND origin->>'type' IN ('inspiration', 'contribution')
    )
  );

CREATE TABLE public.sf_inspiration_prompts (
  id uuid PRIMARY KEY,
  library_key text NOT NULL UNIQUE CHECK (library_key ~ '^q-[0-9]{3}$'),
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 10 AND 2000),
  who_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  who_detail_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  domain_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  energy_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  territory text NOT NULL CHECK (territory ~ '^[a-z][a-z0-9_]{0,63}$'),
  follow_up text NOT NULL CHECK (length(trim(follow_up)) BETWEEN 3 AND 1000),
  interview_use text NOT NULL CHECK (length(trim(interview_use)) BETWEEN 3 AND 1000),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retired')),
  recommended boolean NOT NULL DEFAULT false,
  imported boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL CHECK (sort_order BETWEEN 1 AND 100000),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_inspiration_saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  prompt_id uuid REFERENCES public.sf_inspiration_prompts(id) ON DELETE RESTRICT,
  prompt_text_snapshot text NOT NULL CHECK (length(trim(prompt_text_snapshot)) BETWEEN 3 AND 2000),
  draft text NOT NULL DEFAULT '' CHECK (length(draft) <= 20000),
  kind text NOT NULL DEFAULT 'saved' CHECK (kind IN ('saved', 'sparked')),
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'voice', 'mixed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_inspiration_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  prompt_id uuid NOT NULL REFERENCES public.sf_inspiration_prompts(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('shown', 'answered', 'skipped', 'promoted')),
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(dimensions) = 'object'),
  reason text CHECK (reason IS NULL OR reason IN ('skip', 'another', 'lighter')),
  input_source text CHECK (input_source IS NULL OR input_source IN ('typed', 'voice', 'mixed')),
  length_bucket text CHECK (length_bucket IS NULL OR length_bucket IN ('short', 'medium', 'long')),
  story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (dimensions ?| ARRAY['answer', 'draft', 'text', 'transcript', 'body']))
);

CREATE TABLE public.sf_inspiration_favorites (
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  prompt_id uuid NOT NULL REFERENCES public.sf_inspiration_prompts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, prompt_id)
);

CREATE TABLE public.sf_inspiration_pins (
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  prompt_id uuid NOT NULL REFERENCES public.sf_inspiration_prompts(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 99),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, prompt_id),
  UNIQUE (student_id, position)
);

CREATE TABLE public.sf_inspiration_prompt_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt_id uuid NOT NULL REFERENCES public.sf_inspiration_prompts(id) ON DELETE RESTRICT,
  row_version bigint NOT NULL CHECK (row_version >= 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  actor_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, row_version)
);

CREATE INDEX sf_inspiration_prompts_active_idx
  ON public.sf_inspiration_prompts (state, recommended DESC, sort_order, id);
CREATE INDEX sf_inspiration_saved_student_idx
  ON public.sf_inspiration_saved (student_id, created_at DESC, id DESC);
CREATE INDEX sf_inspiration_events_student_idx
  ON public.sf_inspiration_events (student_id, created_at DESC, id DESC);

ALTER TABLE public.sf_inspiration_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_prompts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_saved FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_pins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_prompt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_inspiration_prompt_history FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_inspiration_prompts_student_read ON public.sf_inspiration_prompts
FOR SELECT TO authenticated
USING (
  state = 'active'
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_prompts_admin_read ON public.sf_inspiration_prompts
FOR SELECT TO authenticated
USING (
  public.sf_actor_role() = 'admin'
  AND public.sf_actor_admin_mode()
  AND public.sf_story_feature_enabled('inspiration_admin', ARRAY['admin'])
);

CREATE POLICY sf_inspiration_saved_owner ON public.sf_inspiration_saved
FOR SELECT TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_events_owner_read ON public.sf_inspiration_events
FOR SELECT TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_favorites_owner ON public.sf_inspiration_favorites
FOR SELECT TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_pins_owner ON public.sf_inspiration_pins
FOR SELECT TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_history_admin_read ON public.sf_inspiration_prompt_history
FOR SELECT TO authenticated
USING (
  public.sf_actor_role() = 'admin'
  AND public.sf_actor_admin_mode()
  AND public.sf_story_feature_enabled('inspiration_admin', ARRAY['admin'])
);

REVOKE ALL ON public.sf_inspiration_prompts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_inspiration_saved FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_inspiration_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_inspiration_favorites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_inspiration_pins FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sf_inspiration_prompt_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_inspiration_prompts TO authenticated;
GRANT SELECT ON public.sf_inspiration_saved TO authenticated;
GRANT SELECT ON public.sf_inspiration_events TO authenticated;
GRANT SELECT ON public.sf_inspiration_favorites TO authenticated;
GRANT SELECT ON public.sf_inspiration_pins TO authenticated;
GRANT SELECT ON public.sf_inspiration_prompt_history TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_inspiration_assert_student()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_actor_id();
BEGIN
  IF v_actor IS NULL OR public.sf_actor_role()<>'student'
     OR NOT public.sf_story_feature_enabled('inspiration',ARRAY['student']) THEN
    RAISE EXCEPTION 'inspiration disabled' USING ERRCODE='42501';
  END IF;
  RETURN v_actor;
END $$;

CREATE OR REPLACE FUNCTION public.sf_inspiration_save(
  p_prompt_id uuid,p_prompt_text text,p_draft text,p_kind text,p_source text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_inspiration_assert_student(); v_row public.sf_inspiration_saved;
BEGIN
  IF p_prompt_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sf_inspiration_prompts WHERE id=p_prompt_id AND state='active') THEN
    RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002';
  END IF;
  INSERT INTO public.sf_inspiration_saved(student_id,prompt_id,prompt_text_snapshot,draft,kind,source)
  VALUES(v_actor,p_prompt_id,p_prompt_text,p_draft,p_kind,p_source) RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.sf_inspiration_remove_saved(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_inspiration_assert_student();
BEGIN
  DELETE FROM public.sf_inspiration_saved WHERE id=p_id AND student_id=v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'saved item not found' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('removed',true);
END $$;

CREATE OR REPLACE FUNCTION public.sf_inspiration_set_favorite(p_prompt_id uuid,p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_inspiration_assert_student();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sf_inspiration_prompts WHERE id=p_prompt_id AND state='active') THEN
    RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002';
  END IF;
  IF p_enabled THEN INSERT INTO public.sf_inspiration_favorites(student_id,prompt_id) VALUES(v_actor,p_prompt_id) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.sf_inspiration_favorites WHERE student_id=v_actor AND prompt_id=p_prompt_id; END IF;
  RETURN jsonb_build_object('favorite',p_enabled);
END $$;

CREATE OR REPLACE FUNCTION public.sf_inspiration_set_pins(p_prompt_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_inspiration_assert_student(); v_id uuid; v_position integer:=0;
BEGIN
  IF cardinality(p_prompt_ids)>100 OR cardinality(p_prompt_ids)<>cardinality(ARRAY(SELECT DISTINCT unnest(p_prompt_ids))) THEN
    RAISE EXCEPTION 'invalid pin order' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM public.sf_inspiration_prompts WHERE id=ANY(p_prompt_ids) AND state='active')<>cardinality(p_prompt_ids) THEN
    RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002';
  END IF;
  DELETE FROM public.sf_inspiration_pins WHERE student_id=v_actor;
  FOREACH v_id IN ARRAY p_prompt_ids LOOP
    INSERT INTO public.sf_inspiration_pins(student_id,prompt_id,position) VALUES(v_actor,v_id,v_position);
    v_position:=v_position+1;
  END LOOP;
  RETURN jsonb_build_object('promptIds',to_jsonb(p_prompt_ids));
END $$;

CREATE OR REPLACE FUNCTION public.sf_inspiration_set_layout(p_layout text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_inspiration_assert_student();
BEGIN
  IF p_layout NOT IN ('list','grid') THEN RAISE EXCEPTION 'invalid layout' USING ERRCODE='22023'; END IF;
  UPDATE public.sf_users SET inspiration_layout=p_layout WHERE id=v_actor;
  RETURN jsonb_build_object('layout',p_layout);
END $$;

CREATE OR REPLACE FUNCTION public.sf_inspiration_record_event(
  p_prompt_id uuid,p_session_id uuid,p_type text,p_dimensions jsonb,p_reason text,p_source text,p_bucket text,p_story_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_inspiration_assert_student(); v_id bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sf_inspiration_prompts WHERE id=p_prompt_id AND state='active') THEN
    RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002';
  END IF;
  INSERT INTO public.sf_inspiration_events(student_id,prompt_id,session_id,event_type,dimensions,reason,input_source,length_bucket,story_id)
  VALUES(v_actor,p_prompt_id,p_session_id,p_type,p_dimensions,p_reason,p_source,p_bucket,p_story_id) RETURNING id INTO v_id;
  RETURN jsonb_build_object('recorded',true,'eventId',v_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_admin_publish_inspiration_prompt(p_prompt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=public.sf_actor_id(); v_id uuid; v_existing public.sf_inspiration_prompts; v_key text; v_row public.sf_inspiration_prompts;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('inspiration_admin',ARRAY['admin']) THEN RAISE EXCEPTION 'admin disabled' USING ERRCODE='42501'; END IF;
  v_id:=NULLIF(p_prompt->>'id','')::uuid;
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.sf_inspiration_prompts WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'prompt not found' USING ERRCODE='P0002'; END IF;
    IF v_existing.library_key<>p_prompt->>'libraryKey' OR v_existing.row_version<>((p_prompt->>'expectedVersion')::bigint) THEN
      RAISE EXCEPTION 'prompt conflict' USING ERRCODE='40001';
    END IF;
    IF v_existing.state='active' AND p_prompt->>'state'='retired' AND (SELECT count(*) FROM public.sf_inspiration_prompts WHERE state='active')<=1 THEN
      RAISE EXCEPTION 'active bank cannot be empty' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.sf_inspiration_prompt_history(prompt_id,row_version,snapshot,actor_id)
    VALUES(v_existing.id,v_existing.row_version,to_jsonb(v_existing),v_actor);
    UPDATE public.sf_inspiration_prompts SET text=p_prompt->>'text',who_ids=ARRAY(SELECT jsonb_array_elements_text(p_prompt->'who')),
      who_detail_ids=ARRAY(SELECT jsonb_array_elements_text(p_prompt->'whoDetail')),domain_ids=ARRAY(SELECT jsonb_array_elements_text(p_prompt->'domain')),
      energy_ids=ARRAY(SELECT jsonb_array_elements_text(p_prompt->'energy')),territory=p_prompt->>'territory',follow_up=p_prompt->>'followUp',
      interview_use=p_prompt->>'interviewUse',state=p_prompt->>'state',recommended=(p_prompt->>'recommended')::boolean,
      sort_order=(p_prompt->>'sortOrder')::integer,row_version=row_version+1,updated_at=now() WHERE id=v_id RETURNING * INTO v_row;
  ELSE
    v_id:=COALESCE(NULLIF(p_prompt->>'serverId','')::uuid,gen_random_uuid());
    SELECT 'q-'||lpad((COALESCE(max(substring(library_key from 3)::integer),0)+1)::text,3,'0') INTO v_key FROM public.sf_inspiration_prompts;
    INSERT INTO public.sf_inspiration_prompts(id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,follow_up,interview_use,state,recommended,imported,sort_order)
    VALUES(v_id,v_key,p_prompt->>'text',ARRAY(SELECT jsonb_array_elements_text(p_prompt->'who')),ARRAY(SELECT jsonb_array_elements_text(p_prompt->'whoDetail')),
      ARRAY(SELECT jsonb_array_elements_text(p_prompt->'domain')),ARRAY(SELECT jsonb_array_elements_text(p_prompt->'energy')),p_prompt->>'territory',p_prompt->>'followUp',
      p_prompt->>'interviewUse',p_prompt->>'state',(p_prompt->>'recommended')::boolean,COALESCE((p_prompt->>'imported')::boolean,false),(p_prompt->>'sortOrder')::integer) RETURNING * INTO v_row;
  END IF;
  PERFORM public.sf_append_audit('inspiration.prompt_published','inspiration_prompt',v_row.id,'system',NULL,NULL,NULL,NULL,jsonb_build_object('rowVersion',v_row.row_version,'state',v_row.state),NULL,'admin_only');
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.sf_admin_publish_inspiration_bulk(p_prompts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_item jsonb; v_rows jsonb:='[]'::jsonb; v_row jsonb;
BEGIN
  IF jsonb_typeof(p_prompts)<>'array' OR jsonb_array_length(p_prompts) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid bulk' USING ERRCODE='22023'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_prompts) LOOP
    v_item:=(v_item-'id')||jsonb_build_object('state','retired','imported',true,'serverId',gen_random_uuid());
    v_row:=public.sf_admin_publish_inspiration_prompt(v_item);
    v_rows:=v_rows||jsonb_build_array(v_row);
  END LOOP;
  RETURN jsonb_build_object('prompts',v_rows);
END $$;

REVOKE ALL ON FUNCTION public.sf_inspiration_assert_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_inspiration_save(uuid,text,text,text,text), public.sf_inspiration_remove_saved(uuid), public.sf_inspiration_set_favorite(uuid,boolean), public.sf_inspiration_set_pins(uuid[]), public.sf_inspiration_set_layout(text), public.sf_inspiration_record_event(uuid,uuid,text,jsonb,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_inspiration_save(uuid,text,text,text,text), public.sf_inspiration_remove_saved(uuid), public.sf_inspiration_set_favorite(uuid,boolean), public.sf_inspiration_set_pins(uuid[]), public.sf_inspiration_set_layout(text), public.sf_inspiration_record_event(uuid,uuid,text,jsonb,text,text,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.sf_admin_publish_inspiration_prompt(jsonb), public.sf_admin_publish_inspiration_bulk(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_admin_publish_inspiration_prompt(jsonb), public.sf_admin_publish_inspiration_bulk(jsonb) TO authenticated;

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by)
SELECT feature.key, 'off', ARRAY[]::uuid[], ARRAY[]::text[], founder.updated_by
FROM (VALUES ('inspiration'), ('inspiration_admin'), ('inspiration_browse')) AS feature(key)
CROSS JOIN (
  SELECT updated_by FROM public.sf_feature_flags WHERE key = 'admin_console'
) founder;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_stories WHERE origin IS NOT NULL) THEN
    RAISE EXCEPTION 'B1-514 R3 refuses to synthesize historical story provenance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sf_inspiration_saved)
    OR EXISTS (SELECT 1 FROM public.sf_inspiration_events)
    OR EXISTS (SELECT 1 FROM public.sf_inspiration_favorites)
    OR EXISTS (SELECT 1 FROM public.sf_inspiration_pins) THEN
    RAISE EXCEPTION 'B1-514 R3 student tables must begin empty';
  END IF;
END
$$;

COMMIT;
