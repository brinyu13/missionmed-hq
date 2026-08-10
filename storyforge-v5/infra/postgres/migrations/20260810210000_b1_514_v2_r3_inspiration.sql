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
FOR ALL TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
)
WITH CHECK (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_events_owner_insert ON public.sf_inspiration_events
FOR INSERT TO authenticated
WITH CHECK (
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
FOR ALL TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
)
WITH CHECK (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
);

CREATE POLICY sf_inspiration_pins_owner ON public.sf_inspiration_pins
FOR ALL TO authenticated
USING (
  student_id = public.sf_actor_id()
  AND public.sf_story_feature_enabled('inspiration', ARRAY['student'])
)
WITH CHECK (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_inspiration_saved TO authenticated;
GRANT SELECT, INSERT ON public.sf_inspiration_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.sf_inspiration_favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_inspiration_pins TO authenticated;
GRANT SELECT ON public.sf_inspiration_prompt_history TO authenticated;

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
