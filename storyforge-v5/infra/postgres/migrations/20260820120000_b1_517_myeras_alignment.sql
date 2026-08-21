\set ON_ERROR_STOP on

-- B1-517: additive MyERAS alignment for StoryForge.
-- Authority: DR-123 / DR-124.
-- Existing StoryForge capture, story rows, visibility, media, and review semantics
-- are not changed. Every new capability is seeded off.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-517-myeras-alignment', 0));

SELECT set_config(
  'storyforge.b1_517_founder_user_id',
  (SELECT updated_by::text FROM public.sf_feature_flags WHERE key='admin_console'),
  true
);

CREATE TABLE public.sf_eras_profiles (
  profile_key text PRIMARY KEY,
  label text NOT NULL,
  season_year integer NOT NULL CHECK (season_year BETWEEN 2020 AND 2200),
  active boolean NOT NULL DEFAULT false,
  limits jsonb NOT NULL,
  published_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  CHECK (jsonb_typeof(limits) = 'object')
);

CREATE UNIQUE INDEX sf_eras_profiles_one_active_idx
  ON public.sf_eras_profiles (active) WHERE active;

CREATE TABLE public.sf_eras_taxonomy_terms (
  profile_key text NOT NULL REFERENCES public.sf_eras_profiles(profile_key) ON DELETE RESTRICT,
  dimension text NOT NULL CHECK (dimension IN (
    'experience_type','primary_focus','key_characteristic','setting',
    'participation_frequency','clinical_specialty','clinical_setting',
    'clinical_acuity','clinical_role'
  )),
  term_id text NOT NULL CHECK (term_id ~ '^[a-z0-9_]+$'),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (profile_key, dimension, term_id)
);

CREATE TABLE public.sf_story_eras_tags (
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  profile_key text NOT NULL,
  dimension text NOT NULL,
  term_id text NOT NULL,
  source text NOT NULL DEFAULT 'student' CHECK (source IN ('student','admin','mapped_accepted')),
  assigned_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  assigned_role text NOT NULL CHECK (assigned_role IN ('student','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, profile_key, dimension, term_id),
  FOREIGN KEY (profile_key, dimension, term_id)
    REFERENCES public.sf_eras_taxonomy_terms(profile_key, dimension, term_id) ON DELETE RESTRICT
);

CREATE INDEX sf_story_eras_tags_story_idx
  ON public.sf_story_eras_tags (story_id, profile_key, dimension);

CREATE TABLE public.sf_eras_legacy_theme_map (
  profile_key text NOT NULL REFERENCES public.sf_eras_profiles(profile_key) ON DELETE RESTRICT,
  legacy_dimension text NOT NULL CHECK (legacy_dimension IN ('theme','category','classification')),
  legacy_value text NOT NULL CHECK (length(btrim(legacy_value)) BETWEEN 1 AND 120),
  dimension text NOT NULL,
  term_id text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('exact','strong','weak')),
  mapped_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  mapped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_key, legacy_dimension, legacy_value, dimension, term_id),
  FOREIGN KEY (profile_key, dimension, term_id)
    REFERENCES public.sf_eras_taxonomy_terms(profile_key, dimension, term_id) ON DELETE RESTRICT
);

CREATE TABLE public.sf_myeras_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  profile_key text NOT NULL REFERENCES public.sf_eras_profiles(profile_key) ON DELETE RESTRICT,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, profile_key)
);

CREATE TABLE public.sf_myeras_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.sf_myeras_workspaces(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  slot_no smallint NOT NULL CHECK (slot_no BETWEEN 1 AND 40),
  organization text NOT NULL DEFAULT '' CHECK (length(organization) <= 200),
  experience_type text,
  position_title text NOT NULL DEFAULT '' CHECK (length(position_title) <= 200),
  is_current boolean NOT NULL DEFAULT false,
  start_month date,
  end_month date,
  country text CHECK (country IS NULL OR length(country) <= 120),
  state_province text CHECK (state_province IS NULL OR length(state_province) <= 120),
  city text CHECK (city IS NULL OR length(city) <= 120),
  postal_code text CHECK (postal_code IS NULL OR length(postal_code) <= 32),
  participation_frequency text,
  setting text,
  primary_focus text,
  key_characteristic text,
  description_text text NOT NULL DEFAULT '' CHECK (length(description_text) <= 4000),
  most_meaningful boolean NOT NULL DEFAULT false,
  most_meaningful_rank smallint CHECK (most_meaningful_rank BETWEEN 1 AND 10),
  most_meaningful_text text NOT NULL DEFAULT '' CHECK (length(most_meaningful_text) <= 2000),
  archived_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sf_myeras_experiences_workspace_slot_key
    UNIQUE (workspace_id, slot_no) DEFERRABLE INITIALLY IMMEDIATE,
  CHECK (end_month IS NULL OR start_month IS NULL OR end_month >= start_month),
  CHECK ((most_meaningful AND most_meaningful_rank IS NOT NULL)
         OR (NOT most_meaningful AND most_meaningful_rank IS NULL))
);

CREATE INDEX sf_myeras_experiences_student_order_idx
  ON public.sf_myeras_experiences (student_id, archived_at, slot_no, id);

CREATE TABLE public.sf_myeras_experience_stories (
  experience_id uuid NOT NULL REFERENCES public.sf_myeras_experiences(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  link_role text NOT NULL DEFAULT 'supporting' CHECK (link_role IN ('primary','supporting')),
  linked_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experience_id, story_id)
);

CREATE INDEX sf_myeras_experience_stories_story_idx
  ON public.sf_myeras_experience_stories (story_id, experience_id);

CREATE TABLE public.sf_myeras_impactful (
  workspace_id uuid PRIMARY KEY REFERENCES public.sf_myeras_workspaces(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body_text text NOT NULL DEFAULT '' CHECK (length(body_text) <= 4000),
  source_story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  promoted_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  promoted_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_story_clinical_case (
  story_id uuid PRIMARY KEY REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  specialty text,
  care_setting text,
  acuity text,
  role_in_case text,
  patient_context text NOT NULL DEFAULT '' CHECK (length(patient_context) <= 500),
  outcome_focus text NOT NULL DEFAULT '' CHECK (length(outcome_focus) <= 500),
  deident_confirmed boolean NOT NULL DEFAULT false,
  deident_confirmed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  deident_confirmed_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deident_confirmed = false OR
    (deident_confirmed_by IS NOT NULL AND deident_confirmed_at IS NOT NULL)),
  CHECK (deident_confirmed OR (patient_context = '' AND outcome_focus = ''))
);

CREATE TABLE public.sf_story_use_ranks (
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  use_id text NOT NULL CHECK (use_id IN (
    'ps','iv','letter','myeras_experiences','myeras_most_impactful','later'
  )),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 99),
  pinned boolean NOT NULL DEFAULT false,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, use_id)
);

CREATE INDEX sf_story_use_ranks_student_use_idx
  ON public.sf_story_use_ranks (student_id, use_id, pinned DESC, rank, story_id);

-- Expand-only constraints. The deployed runtime emits only the original values.
ALTER TABLE public.sf_story_versions
  DROP CONSTRAINT sf_story_versions_version_key_check;
ALTER TABLE public.sf_story_versions
  ADD CONSTRAINT sf_story_versions_version_key_check
  CHECK (version_key IN ('thirty_second','nnq_setup','myeras_experience','myeras_impactful'))
  NOT VALID;

ALTER TABLE public.sf_ai_suggestions
  DROP CONSTRAINT sf_ai_suggestions_mode_check;
ALTER TABLE public.sf_ai_suggestions
  ADD CONSTRAINT sf_ai_suggestions_mode_check
  CHECK (mode IN ('general','clinical','condense_experience','condense_impactful','condense_most_meaningful'))
  NOT VALID;

INSERT INTO public.sf_eras_profiles (
  profile_key,label,season_year,active,limits,published_by,published_at
) VALUES (
  'eras_2027','ERAS 2027 season',2027,true,
  '{"max_experiences":10,"max_most_meaningful":3,"experience_description_chars":750,"most_meaningful_chars":300,"impactful_chars":750,"hobbies_chars":300,"patient_context_chars":240}'::jsonb,
  current_setting('storyforge.b1_517_founder_user_id')::uuid,
  '2026-08-20T00:00:00Z'::timestamptz
);

INSERT INTO public.sf_eras_taxonomy_terms (
  profile_key,dimension,term_id,label,sort_order
) VALUES
  ('eras_2027','experience_type','education_training','Education/training',10),
  ('eras_2027','experience_type','military_service','Military service',20),
  ('eras_2027','experience_type','other_extracurricular_activities_clubs','Other extracurricular activities/clubs',30),
  ('eras_2027','experience_type','professional_organization','Professional organization',40),
  ('eras_2027','experience_type','research','Research',50),
  ('eras_2027','experience_type','teaching_mentoring','Teaching/mentoring',60),
  ('eras_2027','experience_type','volunteer_service_advocacy','Volunteer/service/advocacy',70),
  ('eras_2027','experience_type','work','Work',80),
  ('eras_2027','primary_focus','basic_science','Basic science',10),
  ('eras_2027','primary_focus','clinical_translational_science','Clinical/translational science',20),
  ('eras_2027','primary_focus','community_involvement_outreach','Community involvement/outreach',30),
  ('eras_2027','primary_focus','customer_service','Customer service',40),
  ('eras_2027','primary_focus','healthcare_administration','Healthcare administration',50),
  ('eras_2027','primary_focus','improving_access_to_healthcare','Improving access to healthcare',60),
  ('eras_2027','primary_focus','medical_education','Medical education',70),
  ('eras_2027','primary_focus','music_athletics_art','Music/Athletics/Art',80),
  ('eras_2027','primary_focus','promoting_wellness','Promoting wellness',90),
  ('eras_2027','primary_focus','public_health','Public health',100),
  ('eras_2027','primary_focus','quality_improvement','Quality improvement',110),
  ('eras_2027','primary_focus','social_justice_advocacy','Social justice/advocacy',120),
  ('eras_2027','primary_focus','technology','Technology',130),
  ('eras_2027','key_characteristic','communication','Communication',10),
  ('eras_2027','key_characteristic','critical_thinking_and_problem_solving','Critical Thinking and Problem Solving',20),
  ('eras_2027','key_characteristic','cultural_humility_and_awareness','Cultural Humility and Awareness',30),
  ('eras_2027','key_characteristic','empathy_and_compassion','Empathy and Compassion',40),
  ('eras_2027','key_characteristic','ethical_responsibility','Ethical Responsibility',50),
  ('eras_2027','key_characteristic','ingenuity_and_innovation','Ingenuity and Innovation',60),
  ('eras_2027','key_characteristic','reliability_and_dependability','Reliability and Dependability',70),
  ('eras_2027','key_characteristic','resilience_and_adaptability','Resilience and Adaptability',80),
  ('eras_2027','key_characteristic','self_reflection_and_improvement','Self Reflection and Improvement',90),
  ('eras_2027','key_characteristic','teamwork_and_leadership','Teamwork and Leadership',100),
  ('eras_2027','setting','rural','Rural',10),
  ('eras_2027','setting','rural_suburban','Rural/Suburban',20),
  ('eras_2027','setting','suburban','Suburban',30),
  ('eras_2027','setting','suburban_urban','Suburban/Urban',40),
  ('eras_2027','setting','urban','Urban',50),
  ('eras_2027','setting','virtual','Virtual',60);

INSERT INTO public.sf_eras_legacy_theme_map (
  profile_key,legacy_dimension,legacy_value,dimension,term_id,confidence,mapped_by,mapped_at
) VALUES
  ('eras_2027','theme','comm','key_characteristic','communication','exact',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','team','key_characteristic','teamwork_and_leadership','strong',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','leader','key_characteristic','teamwork_and_leadership','strong',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','resil','key_characteristic','resilience_and_adaptability','exact',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','mistake','key_characteristic','self_reflection_and_improvement','strong',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','growth','key_characteristic','self_reflection_and_improvement','strong',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','patient','key_characteristic','empathy_and_compassion','strong',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','conflict','key_characteristic','critical_thinking_and_problem_solving','weak',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','identity','key_characteristic','cultural_humility_and_awareness','weak',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz),
  ('eras_2027','theme','advoc','key_characteristic','ethical_responsibility','weak',current_setting('storyforge.b1_517_founder_user_id')::uuid,'2026-08-20T00:00:00Z'::timestamptz);

INSERT INTO public.sf_feature_flags (key,scope,allowlist,cohorts,updated_by,updated_at)
SELECT key,'off','{}'::uuid[],'{}'::text[],
  current_setting('storyforge.b1_517_founder_user_id')::uuid,
  '2026-08-20T00:00:00Z'::timestamptz
FROM unnest(ARRAY[
  'eras_taxonomy','myeras_workspace','clinical_case_metadata',
  'use_ranking','myeras_versions','ai_condensation'
]) AS feature(key);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.sf_feature_flags
      WHERE key = ANY(ARRAY['eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation'])
        AND scope = 'off' AND cardinality(allowlist)=0 AND cardinality(cohorts)=0) <> 6 THEN
    RAISE EXCEPTION 'B1-517 flags were not seeded exactly off';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sf_eras_active_profile()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_payload jsonb;
BEGIN
  IF public.sf_actor_role()='student' THEN
    IF NOT (
      public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student'])
      OR public.sf_story_feature_enabled('myeras_workspace',ARRAY['student'])
      OR public.sf_story_feature_enabled('clinical_case_metadata',ARRAY['student'])
      OR public.sf_story_feature_enabled('use_ranking',ARRAY['student'])
      OR public.sf_story_feature_enabled('myeras_versions',ARRAY['student'])
    ) THEN RAISE EXCEPTION 'ERAS profile is unavailable' USING ERRCODE='42501'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    PERFORM public.sf_admin_assert_enabled();
    IF NOT EXISTS (
      SELECT 1 FROM public.sf_feature_flags flag
      WHERE flag.key=ANY(ARRAY['eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions'])
        AND flag.scope<>'off'
    ) THEN RAISE EXCEPTION 'ERAS profile is unavailable' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'ERAS profile is unavailable' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'profileKey',profile.profile_key,'label',profile.label,'seasonYear',profile.season_year,
    'limits',profile.limits,'publishedAt',profile.published_at,'rowVersion',profile.row_version
  ) INTO v_payload FROM public.sf_eras_profiles profile WHERE profile.active;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.sf_eras_taxonomy(p_dimension text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_payload jsonb;
BEGIN
  IF public.sf_actor_role()='student' THEN
    IF NOT public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student']) THEN
      RAISE EXCEPTION 'ERAS taxonomy is unavailable' USING ERRCODE='42501'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    PERFORM public.sf_admin_assert_enabled();
    IF NOT EXISTS (SELECT 1 FROM public.sf_feature_flags WHERE key='eras_taxonomy' AND scope<>'off') THEN
      RAISE EXCEPTION 'ERAS taxonomy is unavailable' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'ERAS taxonomy is unavailable' USING ERRCODE='42501'; END IF;
  IF p_dimension IS NOT NULL AND p_dimension NOT IN (
    'experience_type','primary_focus','key_characteristic','setting','participation_frequency',
    'clinical_specialty','clinical_setting','clinical_acuity','clinical_role'
  ) THEN RAISE EXCEPTION 'invalid ERAS taxonomy dimension' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'profileKey',term.profile_key,'dimension',term.dimension,'termId',term.term_id,
    'label',term.label,'sortOrder',term.sort_order
  ) ORDER BY term.dimension,term.sort_order,term.term_id),'[]'::jsonb)
  INTO v_payload
  FROM public.sf_eras_taxonomy_terms term
  JOIN public.sf_eras_profiles profile ON profile.profile_key=term.profile_key AND profile.active
  WHERE term.active AND (p_dimension IS NULL OR term.dimension=p_dimension);
  RETURN v_payload;
END $$;

CREATE OR REPLACE FUNCTION public.sf_b1_517_admin_feature_enabled(
  p_key text,p_student_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_enabled boolean;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_key NOT IN ('eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation') THEN
    RAISE EXCEPTION 'unsupported B1-517 feature flag' USING ERRCODE='22023';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.sf_feature_flags flag
    LEFT JOIN public.sf_users student ON student.id=p_student_id
    WHERE flag.key=p_key AND (
      (p_student_id IS NULL AND flag.scope<>'off') OR flag.scope='eligible_all'
      OR (flag.scope='allowlist' AND p_student_id=ANY(flag.allowlist))
      OR (flag.scope='cohort' AND student.cohort IS NOT NULL AND student.cohort=ANY(flag.cohorts))
    ) AND (p_student_id IS NULL OR public.sf_admin_subject_in_scope(p_student_id))
  ) INTO v_enabled;
  RETURN v_enabled;
END $$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_b1_517_feature_flag(
  p_key text,p_scope text,p_allowlist uuid[],p_cohorts text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_before public.sf_feature_flags; v_after public.sf_feature_flags; v_audit_id bigint;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_key NOT IN ('eras_taxonomy','myeras_workspace','clinical_case_metadata','use_ranking','myeras_versions','ai_condensation') THEN
    RAISE EXCEPTION 'unsupported B1-517 feature flag' USING ERRCODE='22023';
  END IF;
  IF p_scope NOT IN ('off','allowlist','cohort','eligible_all') THEN
    RAISE EXCEPTION 'invalid B1-517 feature scope' USING ERRCODE='22023'; END IF;
  p_allowlist:=coalesce(p_allowlist,'{}'::uuid[]); p_cohorts:=coalesce(p_cohorts,'{}'::text[]);
  IF cardinality(p_allowlist)>50 OR cardinality(p_cohorts)>20 THEN
    RAISE EXCEPTION 'B1-517 feature scope is too broad' USING ERRCODE='22023'; END IF;
  IF (p_scope='off' AND (cardinality(p_allowlist)<>0 OR cardinality(p_cohorts)<>0))
    OR (p_scope='allowlist' AND (cardinality(p_allowlist)=0 OR cardinality(p_cohorts)<>0))
    OR (p_scope='cohort' AND (cardinality(p_cohorts)=0 OR cardinality(p_allowlist)<>0))
    OR (p_scope='eligible_all' AND (cardinality(p_allowlist)<>0 OR cardinality(p_cohorts)<>0)) THEN
    RAISE EXCEPTION 'invalid B1-517 feature scope values' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_allowlist) requested(id)
    LEFT JOIN public.sf_users student ON student.id=requested.id
    WHERE student.id IS NULL OR student.role<>'student' OR NOT student.eligible
      OR NOT public.sf_admin_subject_in_scope(student.id)) THEN
    RAISE EXCEPTION 'B1-517 allowlist must contain in-scope eligible students' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_cohorts) cohort(value)
    WHERE btrim(value)='' OR value<>btrim(value)) THEN
    RAISE EXCEPTION 'B1-517 cohorts must be normalized' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM public.sf_feature_flags WHERE key=p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'B1-517 feature flag is unavailable' USING ERRCODE='P0002'; END IF;
  UPDATE public.sf_feature_flags SET scope=p_scope,allowlist=p_allowlist,cohorts=p_cohorts,
    updated_by=public.sf_actor_id(),updated_at=now() WHERE key=p_key RETURNING * INTO v_after;
  v_audit_id:=public.sf_append_audit('feature_scope_changed','feature_flag',NULL,'system',NULL,NULL,NULL,
    jsonb_build_object('key',v_before.key,'scope',v_before.scope,'allowlist_count',cardinality(v_before.allowlist),'cohort_count',cardinality(v_before.cohorts)),
    jsonb_build_object('key',v_after.key,'scope',v_after.scope,'allowlist_count',cardinality(v_after.allowlist),'cohort_count',cardinality(v_after.cohorts)));
  RETURN jsonb_build_object('key',v_after.key,'scope',v_after.scope,'allowlist',to_jsonb(v_after.allowlist),
    'cohorts',to_jsonb(v_after.cohorts),'updatedBy',v_after.updated_by,'updatedAt',v_after.updated_at,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_set_story_eras_tags(
  p_story_id uuid,p_profile_key text,p_tags jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_story public.sf_stories; v_tag jsonb; v_audit_id bigint; v_count integer;
BEGIN
  IF NOT public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student']) THEN
    RAISE EXCEPTION 'ERAS taxonomy is unavailable' USING ERRCODE='42501'; END IF;
  IF p_profile_key IS NULL OR jsonb_typeof(p_tags)<>'array' OR jsonb_array_length(p_tags)>9 THEN
    RAISE EXCEPTION 'invalid ERAS tags' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_story FROM public.sf_stories
    WHERE id=p_story_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tags) item
    WHERE item->>'dimension' NOT IN ('experience_type','primary_focus','key_characteristic','setting','participation_frequency','clinical_specialty','clinical_setting','clinical_acuity','clinical_role')
      OR coalesce(item->>'termId','')=''
      OR NOT EXISTS (SELECT 1 FROM public.sf_eras_taxonomy_terms term
        WHERE term.profile_key=p_profile_key AND term.dimension=item->>'dimension'
          AND term.term_id=item->>'termId' AND term.active)) THEN
    RAISE EXCEPTION 'unknown ERAS taxonomy term' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tags) item
    GROUP BY item->>'dimension' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'ERAS dimensions are single-select' USING ERRCODE='22023'; END IF;
  DELETE FROM public.sf_story_eras_tags WHERE story_id=p_story_id AND profile_key=p_profile_key;
  INSERT INTO public.sf_story_eras_tags(story_id,profile_key,dimension,term_id,source,assigned_by,assigned_role)
  SELECT p_story_id,p_profile_key,item->>'dimension',item->>'termId',
    CASE WHEN item->>'source'='mapped_accepted' THEN 'mapped_accepted' ELSE 'student' END,
    public.sf_actor_id(),'student' FROM jsonb_array_elements(p_tags) item;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  v_audit_id:=public.sf_append_audit('story.eras_tags_saved','story',p_story_id,'workspace',v_story.student_id,p_story_id,NULL,
    NULL,jsonb_build_object('profileKey',p_profile_key,'tagCount',v_count));
  RETURN jsonb_build_object('storyId',p_story_id,'profileKey',p_profile_key,'tagCount',v_count,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_list_story_eras_tags(p_story_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_story public.sf_stories; v_payload jsonb;
BEGIN
  SELECT * INTO v_story FROM public.sf_stories WHERE id=p_story_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  IF public.sf_actor_role()='student' THEN
    IF NOT public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student'])
      OR NOT public.sf_story_observable_to_actor(v_story.student_id,v_story.status,v_story.visibility,v_story.archived_at) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    IF NOT public.sf_b1_517_admin_feature_enabled('eras_taxonomy',v_story.student_id)
      OR NOT public.sf_story_observable_to_actor(v_story.student_id,v_story.status,v_story.visibility,v_story.archived_at) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  ELSE RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('dimension',tag.dimension,'termId',tag.term_id,
    'label',term.label,'source',tag.source) ORDER BY term.sort_order,tag.term_id),'[]'::jsonb)
  INTO v_payload FROM public.sf_story_eras_tags tag JOIN public.sf_eras_taxonomy_terms term
    USING(profile_key,dimension,term_id) WHERE tag.story_id=p_story_id;
  RETURN v_payload;
END $$;

CREATE OR REPLACE FUNCTION public.sf_eras_legacy_suggestions(p_story_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_story public.sf_stories; v_payload jsonb;
BEGIN
  SELECT * INTO v_story FROM public.sf_stories WHERE id=p_story_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  IF public.sf_actor_role()='student' THEN
    IF NOT public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student'])
      OR NOT public.sf_story_observable_to_actor(v_story.student_id,v_story.status,v_story.visibility,v_story.archived_at) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    IF NOT public.sf_b1_517_admin_feature_enabled('eras_taxonomy',v_story.student_id)
      OR NOT public.sf_story_observable_to_actor(v_story.student_id,v_story.status,v_story.visibility,v_story.archived_at) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  ELSE RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('legacyValue',mapping.legacy_value,
    'dimension',mapping.dimension,'termId',mapping.term_id,'label',term.label,'confidence',mapping.confidence)),'[]'::jsonb)
  INTO v_payload FROM public.sf_eras_legacy_theme_map mapping
  JOIN public.sf_eras_taxonomy_terms term USING(profile_key,dimension,term_id)
  WHERE mapping.profile_key=(SELECT profile_key FROM public.sf_eras_profiles WHERE active)
    AND mapping.legacy_dimension='theme' AND mapping.legacy_value=ANY(coalesce(v_story.themes,'{}'::text[]));
  RETURN v_payload;
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_workspace(p_student_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_student_id uuid; v_profile public.sf_eras_profiles; v_workspace public.sf_myeras_workspaces;
  v_experiences jsonb; v_impactful jsonb; v_fit jsonb;
BEGIN
  IF public.sf_actor_role()='student' THEN
    v_student_id:=public.sf_actor_id();
    IF p_student_id IS NOT NULL AND p_student_id<>v_student_id THEN RAISE EXCEPTION 'workspace not found' USING ERRCODE='P0002'; END IF;
    IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) THEN RAISE EXCEPTION 'MyERAS workspace is unavailable' USING ERRCODE='42501'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    v_student_id:=p_student_id;
    IF v_student_id IS NULL OR NOT public.sf_b1_517_admin_feature_enabled('myeras_workspace',v_student_id) THEN
      RAISE EXCEPTION 'workspace not found' USING ERRCODE='P0002'; END IF;
  ELSE RAISE EXCEPTION 'workspace is unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_profile FROM public.sf_eras_profiles WHERE active;
  SELECT * INTO v_workspace FROM public.sf_myeras_workspaces WHERE student_id=v_student_id AND profile_key=v_profile.profile_key;
  IF v_workspace.id IS NULL AND public.sf_actor_role()='student' THEN
    INSERT INTO public.sf_myeras_workspaces(student_id,profile_key)
      VALUES(v_student_id,v_profile.profile_key) RETURNING * INTO v_workspace;
  END IF;
  IF v_workspace.id IS NULL THEN
    RETURN jsonb_build_object('profile',public.sf_eras_active_profile(),'workspace',NULL,'experiences','[]'::jsonb,'impactful',NULL,'storyFit','[]'::jsonb);
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',experience.id,'slotNo',experience.slot_no,'organization',experience.organization,
    'experienceType',experience.experience_type,'positionTitle',experience.position_title,
    'isCurrent',experience.is_current,'startMonth',experience.start_month,'endMonth',experience.end_month,
    'country',experience.country,'stateProvince',experience.state_province,'city',experience.city,'postalCode',experience.postal_code,
    'participationFrequency',experience.participation_frequency,'setting',experience.setting,
    'primaryFocus',experience.primary_focus,'keyCharacteristic',experience.key_characteristic,
    'descriptionText',experience.description_text,'mostMeaningful',experience.most_meaningful,
    'mostMeaningfulRank',experience.most_meaningful_rank,'mostMeaningfulText',experience.most_meaningful_text,
    'rowVersion',experience.row_version,'linkedStories',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'storyId',link.story_id,'linkRole',link.link_role) ORDER BY link.linked_at,link.story_id)
      FROM public.sf_myeras_experience_stories link
      JOIN public.sf_stories linked_story ON linked_story.id=link.story_id
      WHERE link.experience_id=experience.id
        AND public.sf_story_observable_to_actor(linked_story.student_id,linked_story.status,linked_story.visibility,linked_story.archived_at)),'[]'::jsonb)
  ) ORDER BY experience.slot_no,experience.id),'[]'::jsonb) INTO v_experiences
  FROM public.sf_myeras_experiences experience WHERE experience.workspace_id=v_workspace.id AND experience.archived_at IS NULL;
  SELECT jsonb_build_object('bodyText',impactful.body_text,'sourceStoryId',CASE
      WHEN impactful.source_story_id IS NULL OR EXISTS (
        SELECT 1 FROM public.sf_stories source_story WHERE source_story.id=impactful.source_story_id
          AND public.sf_story_observable_to_actor(source_story.student_id,source_story.status,source_story.visibility,source_story.archived_at)
      ) THEN impactful.source_story_id ELSE NULL END,
    'rowVersion',impactful.row_version,'updatedAt',impactful.updated_at)
    INTO v_impactful FROM public.sf_myeras_impactful impactful WHERE impactful.workspace_id=v_workspace.id;
  v_fit:=public.sf_myeras_story_fit(v_student_id);
  RETURN jsonb_build_object('profile',public.sf_eras_active_profile(),'workspace',jsonb_build_object(
    'id',v_workspace.id,'studentId',v_workspace.student_id,'profileKey',v_workspace.profile_key,'rowVersion',v_workspace.row_version),
    'experiences',v_experiences,'impactful',v_impactful,'storyFit',v_fit);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_upsert_experience(
  p_experience_id uuid,p_payload jsonb,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_profile public.sf_eras_profiles; v_workspace public.sf_myeras_workspaces; v_before public.sf_myeras_experiences;
  v_after public.sf_myeras_experiences; v_slot smallint; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) THEN RAISE EXCEPTION 'MyERAS workspace is unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_payload)<>'object' OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid MyERAS experience' USING ERRCODE='22023'; END IF;
  IF p_payload?'participationFrequency' THEN
    RAISE EXCEPTION 'participation frequency vocabulary is not yet available' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) key WHERE key NOT IN (
    'slotNo','organization','experienceType','positionTitle','isCurrent','startMonth','endMonth','country','stateProvince','city','postalCode',
    'participationFrequency','setting','primaryFocus','keyCharacteristic','descriptionText','mostMeaningful','mostMeaningfulRank','mostMeaningfulText')) THEN
    RAISE EXCEPTION 'invalid MyERAS experience fields' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_profile FROM public.sf_eras_profiles WHERE active;
  INSERT INTO public.sf_myeras_workspaces(student_id,profile_key) VALUES(public.sf_actor_id(),v_profile.profile_key)
    ON CONFLICT(student_id,profile_key) DO UPDATE SET student_id=excluded.student_id RETURNING * INTO v_workspace;
  IF p_experience_id IS NULL THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'MyERAS experience conflict' USING ERRCODE='40001'; END IF;
    v_slot:=coalesce((p_payload->>'slotNo')::smallint,(SELECT coalesce(max(slot_no),0)+1 FROM public.sf_myeras_experiences WHERE workspace_id=v_workspace.id));
    INSERT INTO public.sf_myeras_experiences(workspace_id,student_id,slot_no,organization,experience_type,position_title,is_current,
      start_month,end_month,country,state_province,city,postal_code,participation_frequency,setting,primary_focus,key_characteristic,
      description_text,most_meaningful,most_meaningful_rank,most_meaningful_text)
    VALUES(v_workspace.id,public.sf_actor_id(),v_slot,coalesce(p_payload->>'organization',''),nullif(p_payload->>'experienceType',''),
      coalesce(p_payload->>'positionTitle',''),coalesce((p_payload->>'isCurrent')::boolean,false),nullif(p_payload->>'startMonth','')::date,
      nullif(p_payload->>'endMonth','')::date,nullif(p_payload->>'country',''),nullif(p_payload->>'stateProvince',''),nullif(p_payload->>'city',''),
      nullif(p_payload->>'postalCode',''),nullif(p_payload->>'participationFrequency',''),nullif(p_payload->>'setting',''),
      nullif(p_payload->>'primaryFocus',''),nullif(p_payload->>'keyCharacteristic',''),coalesce(p_payload->>'descriptionText',''),
      coalesce((p_payload->>'mostMeaningful')::boolean,false),nullif(p_payload->>'mostMeaningfulRank','')::smallint,coalesce(p_payload->>'mostMeaningfulText',''))
    RETURNING * INTO v_after;
  ELSE
    SELECT * INTO v_before FROM public.sf_myeras_experiences WHERE id=p_experience_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'MyERAS experience not found' USING ERRCODE='P0002'; END IF;
    IF v_before.row_version<>p_expected_version THEN RAISE EXCEPTION 'MyERAS experience conflict' USING ERRCODE='40001'; END IF;
    UPDATE public.sf_myeras_experiences SET
      slot_no=coalesce((p_payload->>'slotNo')::smallint,slot_no),organization=coalesce(p_payload->>'organization',organization),
      experience_type=CASE WHEN p_payload?'experienceType' THEN nullif(p_payload->>'experienceType','') ELSE experience_type END,
      position_title=coalesce(p_payload->>'positionTitle',position_title),is_current=coalesce((p_payload->>'isCurrent')::boolean,is_current),
      start_month=CASE WHEN p_payload?'startMonth' THEN nullif(p_payload->>'startMonth','')::date ELSE start_month END,
      end_month=CASE WHEN p_payload?'endMonth' THEN nullif(p_payload->>'endMonth','')::date ELSE end_month END,
      country=CASE WHEN p_payload?'country' THEN nullif(p_payload->>'country','') ELSE country END,
      state_province=CASE WHEN p_payload?'stateProvince' THEN nullif(p_payload->>'stateProvince','') ELSE state_province END,
      city=CASE WHEN p_payload?'city' THEN nullif(p_payload->>'city','') ELSE city END,
      postal_code=CASE WHEN p_payload?'postalCode' THEN nullif(p_payload->>'postalCode','') ELSE postal_code END,
      participation_frequency=CASE WHEN p_payload?'participationFrequency' THEN nullif(p_payload->>'participationFrequency','') ELSE participation_frequency END,
      setting=CASE WHEN p_payload?'setting' THEN nullif(p_payload->>'setting','') ELSE setting END,
      primary_focus=CASE WHEN p_payload?'primaryFocus' THEN nullif(p_payload->>'primaryFocus','') ELSE primary_focus END,
      key_characteristic=CASE WHEN p_payload?'keyCharacteristic' THEN nullif(p_payload->>'keyCharacteristic','') ELSE key_characteristic END,
      description_text=coalesce(p_payload->>'descriptionText',description_text),most_meaningful=coalesce((p_payload->>'mostMeaningful')::boolean,most_meaningful),
      most_meaningful_rank=CASE WHEN p_payload?'mostMeaningfulRank' THEN nullif(p_payload->>'mostMeaningfulRank','')::smallint ELSE most_meaningful_rank END,
      most_meaningful_text=coalesce(p_payload->>'mostMeaningfulText',most_meaningful_text),row_version=row_version+1,updated_at=now()
      WHERE id=v_before.id RETURNING * INTO v_after;
  END IF;
  UPDATE public.sf_myeras_workspaces SET row_version=row_version+1,updated_at=now() WHERE id=v_workspace.id;
  v_audit_id:=public.sf_append_audit('myeras.experience_saved','myeras_experience',v_after.id,'workspace',v_after.student_id,NULL,NULL,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE jsonb_build_object('rowVersion',v_before.row_version) END,
    jsonb_build_object('rowVersion',v_after.row_version,'slotNo',v_after.slot_no,'mostMeaningful',v_after.most_meaningful));
  RETURN jsonb_build_object('id',v_after.id,'slotNo',v_after.slot_no,'rowVersion',v_after.row_version,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_set_experience_order(p_experience_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_count integer; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) OR cardinality(coalesce(p_experience_ids,'{}'::uuid[]))>40 THEN
    RAISE EXCEPTION 'MyERAS workspace is unavailable' USING ERRCODE='42501'; END IF;
  IF cardinality(p_experience_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_experience_ids) id) OR EXISTS (
    SELECT 1 FROM unnest(p_experience_ids) id LEFT JOIN public.sf_myeras_experiences e ON e.id=id AND e.student_id=public.sf_actor_id() AND e.archived_at IS NULL WHERE e.id IS NULL
  ) THEN RAISE EXCEPTION 'invalid MyERAS experience order' USING ERRCODE='22023'; END IF;
  SET CONSTRAINTS sf_myeras_experiences_workspace_slot_key DEFERRED;
  UPDATE public.sf_myeras_experiences e SET slot_no=ordered.ordinality,updated_at=now(),row_version=row_version+1
    FROM unnest(p_experience_ids) WITH ORDINALITY ordered(id,ordinality) WHERE e.id=ordered.id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  v_audit_id:=public.sf_append_audit('myeras.experiences_reordered','myeras_workspace',NULL,'workspace',public.sf_actor_id(),NULL,NULL,NULL,jsonb_build_object('count',v_count));
  RETURN jsonb_build_object('count',v_count,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_set_most_meaningful(
  p_experience_id uuid,p_most_meaningful boolean,p_rank integer,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_before public.sf_myeras_experiences; v_after public.sf_myeras_experiences; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) THEN RAISE EXCEPTION 'MyERAS workspace is unavailable' USING ERRCODE='42501'; END IF;
  IF (p_most_meaningful AND (p_rank IS NULL OR p_rank NOT BETWEEN 1 AND 10)) OR (NOT p_most_meaningful AND p_rank IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid most meaningful rank' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM public.sf_myeras_experiences WHERE id=p_experience_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MyERAS experience not found' USING ERRCODE='P0002'; END IF;
  IF v_before.row_version<>p_expected_version THEN RAISE EXCEPTION 'MyERAS experience conflict' USING ERRCODE='40001'; END IF;
  UPDATE public.sf_myeras_experiences SET most_meaningful=p_most_meaningful,most_meaningful_rank=p_rank,row_version=row_version+1,updated_at=now()
    WHERE id=v_before.id RETURNING * INTO v_after;
  v_audit_id:=public.sf_append_audit('myeras.most_meaningful_changed','myeras_experience',v_after.id,'workspace',v_after.student_id,NULL,NULL,
    jsonb_build_object('enabled',v_before.most_meaningful,'rank',v_before.most_meaningful_rank),jsonb_build_object('enabled',v_after.most_meaningful,'rank',v_after.most_meaningful_rank));
  RETURN jsonb_build_object('id',v_after.id,'mostMeaningful',v_after.most_meaningful,'mostMeaningfulRank',v_after.most_meaningful_rank,'rowVersion',v_after.row_version,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_link_story(p_experience_id uuid,p_story_id uuid,p_link_role text DEFAULT 'supporting')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_experience public.sf_myeras_experiences; v_story public.sf_stories; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) OR p_link_role NOT IN ('primary','supporting') THEN
    RAISE EXCEPTION 'invalid MyERAS story link' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_experience FROM public.sf_myeras_experiences WHERE id=p_experience_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  SELECT * INTO v_story FROM public.sf_stories WHERE id=p_story_id AND student_id=public.sf_actor_id() AND archived_at IS NULL;
  IF v_experience.id IS NULL OR v_story.id IS NULL THEN RAISE EXCEPTION 'story or experience not found' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.sf_myeras_experience_stories(experience_id,story_id,link_role,linked_by)
    VALUES(p_experience_id,p_story_id,p_link_role,public.sf_actor_id()) ON CONFLICT(experience_id,story_id) DO UPDATE SET link_role=excluded.link_role,linked_by=excluded.linked_by,linked_at=now();
  v_audit_id:=public.sf_append_audit('myeras.story_linked','myeras_experience',p_experience_id,'workspace',v_story.student_id,p_story_id,NULL,NULL,jsonb_build_object('linkRole',p_link_role));
  RETURN jsonb_build_object('experienceId',p_experience_id,'storyId',p_story_id,'linkRole',p_link_role,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_unlink_story(p_experience_id uuid,p_story_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_student_id uuid; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) THEN RAISE EXCEPTION 'MyERAS workspace is unavailable' USING ERRCODE='42501'; END IF;
  SELECT student_id INTO v_student_id FROM public.sf_myeras_experiences WHERE id=p_experience_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.sf_myeras_experience_stories WHERE experience_id=p_experience_id AND story_id=p_story_id) THEN
    RAISE EXCEPTION 'story link not found' USING ERRCODE='P0002'; END IF;
  DELETE FROM public.sf_myeras_experience_stories WHERE experience_id=p_experience_id AND story_id=p_story_id;
  v_audit_id:=public.sf_append_audit('myeras.story_unlinked','myeras_experience',p_experience_id,'workspace',v_student_id,p_story_id);
  RETURN jsonb_build_object('experienceId',p_experience_id,'storyId',p_story_id,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_set_impactful(p_body_text text,p_source_story_id uuid,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_profile public.sf_eras_profiles; v_workspace public.sf_myeras_workspaces; v_before public.sf_myeras_impactful; v_after public.sf_myeras_impactful; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) OR p_expected_version<0 OR length(coalesce(p_body_text,''))>4000 THEN
    RAISE EXCEPTION 'invalid impactful experience' USING ERRCODE='22023'; END IF;
  IF p_source_story_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sf_stories WHERE id=p_source_story_id AND student_id=public.sf_actor_id() AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_profile FROM public.sf_eras_profiles WHERE active;
  INSERT INTO public.sf_myeras_workspaces(student_id,profile_key) VALUES(public.sf_actor_id(),v_profile.profile_key)
    ON CONFLICT(student_id,profile_key) DO UPDATE SET student_id=excluded.student_id RETURNING * INTO v_workspace;
  SELECT * INTO v_before FROM public.sf_myeras_impactful WHERE workspace_id=v_workspace.id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'impactful experience conflict' USING ERRCODE='40001'; END IF;
    INSERT INTO public.sf_myeras_impactful(workspace_id,student_id,body_text,source_story_id)
      VALUES(v_workspace.id,public.sf_actor_id(),coalesce(p_body_text,''),p_source_story_id) RETURNING * INTO v_after;
  ELSE
    IF v_before.row_version<>p_expected_version THEN RAISE EXCEPTION 'impactful experience conflict' USING ERRCODE='40001'; END IF;
    UPDATE public.sf_myeras_impactful SET body_text=coalesce(p_body_text,''),source_story_id=p_source_story_id,
      row_version=row_version+1,updated_at=now() WHERE workspace_id=v_workspace.id RETURNING * INTO v_after;
  END IF;
  v_audit_id:=public.sf_append_audit('myeras.impactful_saved','myeras_impactful',v_workspace.id,'workspace',public.sf_actor_id(),p_source_story_id,NULL,
    CASE WHEN v_before.workspace_id IS NULL THEN NULL ELSE jsonb_build_object('rowVersion',v_before.row_version,'length',length(v_before.body_text)) END,
    jsonb_build_object('rowVersion',v_after.row_version,'length',length(v_after.body_text),'sourceStoryId',v_after.source_story_id));
  RETURN jsonb_build_object('workspaceId',v_workspace.id,'bodyText',v_after.body_text,'sourceStoryId',v_after.source_story_id,'rowVersion',v_after.row_version,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_promote_impactful(p_story_id uuid,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_version public.sf_story_versions; v_result jsonb;
BEGIN
  IF NOT public.sf_story_feature_enabled('myeras_versions',ARRAY['student']) THEN RAISE EXCEPTION 'MyERAS versions are unavailable' USING ERRCODE='42501'; END IF;
  SELECT version.* INTO v_version FROM public.sf_story_versions version JOIN public.sf_stories story ON story.id=version.story_id
    WHERE version.story_id=p_story_id AND version.version_key='myeras_impactful' AND story.student_id=public.sf_actor_id() AND story.archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'impactful version not found' USING ERRCODE='P0002'; END IF;
  v_result:=public.sf_myeras_set_impactful(v_version.body,p_story_id,p_expected_version);
  UPDATE public.sf_myeras_impactful SET promoted_by=public.sf_actor_id(),promoted_at=now() WHERE workspace_id=(v_result->>'workspaceId')::uuid;
  PERFORM public.sf_append_audit('myeras.impactful_promoted','story_version',v_version.id,'workspace',public.sf_actor_id(),p_story_id,NULL,NULL,jsonb_build_object('workspaceId',v_result->>'workspaceId'));
  RETURN v_result||jsonb_build_object('promoted',true);
END $$;

CREATE OR REPLACE FUNCTION public.sf_set_story_clinical_case(p_story_id uuid,p_payload jsonb,p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_story public.sf_stories; v_before public.sf_story_clinical_case; v_after public.sf_story_clinical_case; v_confirm boolean; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('clinical_case_metadata',ARRAY['student']) THEN RAISE EXCEPTION 'clinical case metadata is unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_payload)<>'object' OR p_expected_version<0 OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) key WHERE key NOT IN (
    'specialty','careSetting','acuity','roleInCase','patientContext','outcomeFocus','deidentConfirmed')) THEN
    RAISE EXCEPTION 'invalid clinical case metadata' USING ERRCODE='22023'; END IF;
  v_confirm:=coalesce((p_payload->>'deidentConfirmed')::boolean,false);
  IF (coalesce(p_payload->>'patientContext','')<>'' OR coalesce(p_payload->>'outcomeFocus','')<>'') AND NOT v_confirm THEN
    RAISE EXCEPTION 'de-identification confirmation is required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_story FROM public.sf_stories WHERE id=p_story_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_before FROM public.sf_story_clinical_case WHERE story_id=p_story_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'clinical case conflict' USING ERRCODE='40001'; END IF;
    INSERT INTO public.sf_story_clinical_case(story_id,specialty,care_setting,acuity,role_in_case,patient_context,outcome_focus,
      deident_confirmed,deident_confirmed_by,deident_confirmed_at)
    VALUES(p_story_id,nullif(p_payload->>'specialty',''),nullif(p_payload->>'careSetting',''),nullif(p_payload->>'acuity',''),
      nullif(p_payload->>'roleInCase',''),coalesce(p_payload->>'patientContext',''),coalesce(p_payload->>'outcomeFocus',''),v_confirm,
      CASE WHEN v_confirm THEN public.sf_actor_id() END,CASE WHEN v_confirm THEN now() END) RETURNING * INTO v_after;
  ELSE
    IF v_before.row_version<>p_expected_version THEN RAISE EXCEPTION 'clinical case conflict' USING ERRCODE='40001'; END IF;
    UPDATE public.sf_story_clinical_case SET specialty=nullif(p_payload->>'specialty',''),care_setting=nullif(p_payload->>'careSetting',''),
      acuity=nullif(p_payload->>'acuity',''),role_in_case=nullif(p_payload->>'roleInCase',''),patient_context=coalesce(p_payload->>'patientContext',''),
      outcome_focus=coalesce(p_payload->>'outcomeFocus',''),deident_confirmed=v_confirm,
      deident_confirmed_by=CASE WHEN v_confirm THEN public.sf_actor_id() END,deident_confirmed_at=CASE WHEN v_confirm THEN now() END,
      row_version=row_version+1,updated_at=now() WHERE story_id=p_story_id RETURNING * INTO v_after;
  END IF;
  v_audit_id:=public.sf_append_audit('story.clinical_case_saved','story',p_story_id,'workspace',v_story.student_id,p_story_id,NULL,
    CASE WHEN v_before.story_id IS NULL THEN NULL ELSE jsonb_build_object('rowVersion',v_before.row_version,'deidentified',v_before.deident_confirmed) END,
    jsonb_build_object('rowVersion',v_after.row_version,'deidentified',v_after.deident_confirmed));
  RETURN jsonb_build_object('storyId',p_story_id,'specialty',v_after.specialty,'careSetting',v_after.care_setting,'acuity',v_after.acuity,
    'roleInCase',v_after.role_in_case,'patientContext',v_after.patient_context,'outcomeFocus',v_after.outcome_focus,
    'deidentConfirmed',v_after.deident_confirmed,'rowVersion',v_after.row_version,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_get_story_clinical_case(p_story_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_story public.sf_stories; v_case public.sf_story_clinical_case;
BEGIN
  SELECT * INTO v_story FROM public.sf_stories WHERE id=p_story_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  IF public.sf_actor_role()='student' THEN
    IF NOT public.sf_story_feature_enabled('clinical_case_metadata',ARRAY['student'])
      OR NOT public.sf_story_observable_to_actor(v_story.student_id,v_story.status,v_story.visibility,v_story.archived_at) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    IF NOT public.sf_b1_517_admin_feature_enabled('clinical_case_metadata',v_story.student_id)
      OR NOT public.sf_story_observable_to_actor(v_story.student_id,v_story.status,v_story.visibility,v_story.archived_at) THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  ELSE RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_case FROM public.sf_story_clinical_case WHERE story_id=p_story_id;
  IF v_case.story_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('storyId',p_story_id,'specialty',v_case.specialty,'careSetting',v_case.care_setting,'acuity',v_case.acuity,
    'roleInCase',v_case.role_in_case,'patientContext',v_case.patient_context,'outcomeFocus',v_case.outcome_focus,
    'deidentConfirmed',v_case.deident_confirmed,'rowVersion',v_case.row_version,'updatedAt',v_case.updated_at);
END $$;

CREATE OR REPLACE FUNCTION public.sf_set_story_use_rank(
  p_story_id uuid,p_use_id text,p_rank integer,p_pinned boolean,p_expected_version bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_story public.sf_stories; v_before public.sf_story_use_ranks; v_after public.sf_story_use_ranks; v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_feature_enabled('use_ranking',ARRAY['student']) OR p_use_id NOT IN ('ps','iv','letter','myeras_experiences','myeras_most_impactful','later')
    OR p_rank NOT BETWEEN 1 AND 99 OR p_expected_version<0 THEN RAISE EXCEPTION 'invalid story use rank' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_story FROM public.sf_stories WHERE id=p_story_id AND student_id=public.sf_actor_id() AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_before FROM public.sf_story_use_ranks WHERE story_id=p_story_id AND use_id=p_use_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'story use rank conflict' USING ERRCODE='40001'; END IF;
    INSERT INTO public.sf_story_use_ranks(story_id,use_id,student_id,rank,pinned) VALUES(p_story_id,p_use_id,v_story.student_id,p_rank,p_pinned) RETURNING * INTO v_after;
  ELSE
    IF v_before.row_version<>p_expected_version THEN RAISE EXCEPTION 'story use rank conflict' USING ERRCODE='40001'; END IF;
    UPDATE public.sf_story_use_ranks SET rank=p_rank,pinned=p_pinned,row_version=row_version+1,updated_at=now()
      WHERE story_id=p_story_id AND use_id=p_use_id RETURNING * INTO v_after;
  END IF;
  v_audit_id:=public.sf_append_audit('story.use_rank_saved','story',p_story_id,'workspace',v_story.student_id,p_story_id,NULL,
    CASE WHEN v_before.story_id IS NULL THEN NULL ELSE jsonb_build_object('useId',p_use_id,'rank',v_before.rank,'pinned',v_before.pinned,'rowVersion',v_before.row_version) END,
    jsonb_build_object('useId',p_use_id,'rank',v_after.rank,'pinned',v_after.pinned,'rowVersion',v_after.row_version));
  RETURN jsonb_build_object('storyId',p_story_id,'useId',p_use_id,'rank',v_after.rank,'pinned',v_after.pinned,'rowVersion',v_after.row_version,'auditId',v_audit_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.sf_myeras_story_fit(p_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_payload jsonb;
BEGIN
  IF public.sf_actor_role()='student' THEN
    IF p_student_id<>public.sf_actor_id() OR NOT public.sf_story_feature_enabled('myeras_workspace',ARRAY['student']) THEN RAISE EXCEPTION 'stories not found' USING ERRCODE='P0002'; END IF;
  ELSIF public.sf_actor_role()='admin' THEN
    IF NOT public.sf_b1_517_admin_feature_enabled('myeras_workspace',p_student_id) THEN RAISE EXCEPTION 'stories not found' USING ERRCODE='P0002'; END IF;
  ELSE RAISE EXCEPTION 'stories not found' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'storyId',story.id,'title',story.title,'status',story.status,'updatedAt',story.updated_at,
    'tagCompleteness',(SELECT count(DISTINCT tag.dimension)::integer FROM public.sf_story_eras_tags tag
      WHERE tag.story_id=story.id AND tag.dimension IN ('experience_type','primary_focus','key_characteristic')),
    'hasThirtySecond',EXISTS(SELECT 1 FROM public.sf_story_versions version WHERE version.story_id=story.id AND version.version_key='thirty_second'),
    'hasFullStory',length(btrim(story.current_text))>0,
    'hasImpactfulVersion',EXISTS(SELECT 1 FROM public.sf_story_versions version WHERE version.story_id=story.id AND version.version_key='myeras_impactful'),
    'hasAudio',EXISTS(SELECT 1 FROM public.sf_audio_assets audio WHERE audio.story_id=story.id AND audio.student_id=p_student_id AND audio.state='verified'),
    'linkedExperienceCount',(SELECT count(*)::integer FROM public.sf_myeras_experience_stories link WHERE link.story_id=story.id),
    'uses',coalesce((SELECT jsonb_agg(jsonb_build_object('useId',uses.use_id,'mentorQualifies',review.qualifies,'mentorScore',review.score,
      'studentRank',rank.rank,'studentPinned',rank.pinned,'rowVersion',rank.row_version) ORDER BY uses.ordinality)
      FROM unnest(ARRAY['ps','iv','letter','myeras_experiences','myeras_most_impactful','later']) WITH ORDINALITY uses(use_id,ordinality)
      LEFT JOIN public.sf_story_use_reviews review ON review.story_id=story.id AND review.use_id=uses.use_id
      LEFT JOIN public.sf_story_use_ranks rank ON rank.story_id=story.id AND rank.use_id=uses.use_id),'[]'::jsonb)
  ) ORDER BY story.updated_at DESC,story.id),'[]'::jsonb) INTO v_payload
  FROM public.sf_stories story WHERE story.student_id=p_student_id AND story.archived_at IS NULL
    AND public.sf_story_observable_to_actor(story.student_id,story.status,story.visibility,story.archived_at);
  RETURN v_payload;
END $$;

-- These two functions are copied from B1-514 byte-for-byte except for the
-- accepted p_version_key list, which is widened to the four-value superset.
CREATE OR REPLACE FUNCTION public.sf_save_story_version(
  p_story_id uuid,
  p_version_key text,
  p_body text,
  p_mode text,
  p_source text,
  p_expected_version bigint,
  p_recording_id uuid DEFAULT NULL,
  p_audio_asset_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_before public.sf_story_versions;
  v_after public.sf_story_versions;
  v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_versions_enabled()
    OR NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'story versions are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_version_key NOT IN ('thirty_second', 'nnq_setup', 'myeras_experience', 'myeras_impactful')
    OR p_mode NOT IN ('save', 'append', 'retell')
    OR p_source NOT IN ('typed', 'voice')
    OR p_expected_version < 0
    OR length(coalesce(p_body, '')) > 20000
    OR (p_mode <> 'retell' AND length(trim(coalesce(p_body, ''))) < 1) THEN
    RAISE EXCEPTION 'invalid story version mutation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id() AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;

  IF p_source = 'typed' AND (p_recording_id IS NOT NULL OR p_audio_asset_id IS NOT NULL) THEN
    RAISE EXCEPTION 'typed story versions cannot claim audio provenance' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'voice' AND (p_recording_id IS NULL OR p_audio_asset_id IS NULL) THEN
    RAISE EXCEPTION 'voice story versions require recording and audio provenance' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'voice' AND NOT EXISTS (
    SELECT 1
    FROM public.sf_recording_sessions recording
    JOIN public.sf_audio_assets audio ON audio.id = recording.assembled_asset_id
    WHERE recording.id = p_recording_id
      AND recording.student_id = v_story.student_id
      AND recording.story_id = v_story.id
      AND recording.state = 'attached'
      AND audio.id = p_audio_asset_id
      AND audio.student_id = v_story.student_id
      AND audio.story_id = v_story.id
      AND audio.state = 'verified'
  ) THEN
    RAISE EXCEPTION 'voice provenance does not belong to this story' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.sf_story_versions
  WHERE story_id = p_story_id AND version_key = p_version_key
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.sf_story_versions (
      story_id, version_key, body, source, recording_id, audio_asset_id
    ) VALUES (
      p_story_id, p_version_key, coalesce(p_body, ''), p_source, p_recording_id, p_audio_asset_id
    ) RETURNING * INTO v_after;
  ELSE
    IF v_before.row_version <> p_expected_version THEN
      RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
    END IF;
    IF v_before.body IS DISTINCT FROM coalesce(p_body, '')
      OR v_before.source IS DISTINCT FROM p_source
      OR v_before.recording_id IS DISTINCT FROM p_recording_id
      OR v_before.audio_asset_id IS DISTINCT FROM p_audio_asset_id THEN
      INSERT INTO public.sf_story_version_revisions (
        version_id, story_id, body, source, recording_id, audio_asset_id,
        saved_at, actor_user_id
      ) VALUES (
        v_before.id, v_before.story_id, v_before.body, v_before.source,
        v_before.recording_id, v_before.audio_asset_id, v_before.updated_at,
        public.sf_actor_id()
      );
      UPDATE public.sf_story_versions
      SET body = coalesce(p_body, ''), source = p_source,
          recording_id = p_recording_id, audio_asset_id = p_audio_asset_id,
          row_version = row_version + 1, updated_at = now()
      WHERE id = v_before.id
      RETURNING * INTO v_after;
    ELSE
      v_after := v_before;
    END IF;
  END IF;

  IF v_before.id IS NULL OR v_before.body IS DISTINCT FROM v_after.body THEN
    INSERT INTO public.sf_authored_segments (
      story_id, story_version_id, source_role, source_entity_type,
      source_entity_id, body_hash, recording_id, audio_asset_id, author_id
    ) VALUES (
      v_after.story_id, v_after.id,
      CASE WHEN p_source = 'voice' THEN 'student_spoken' ELSE 'student_typed' END,
      'story_version', v_after.id, encode(digest(convert_to(v_after.body, 'UTF8'), 'sha256'), 'hex'),
      p_recording_id, p_audio_asset_id, public.sf_actor_id()
    );
  END IF;

  SELECT public.sf_append_audit(
    'story.version_edited', 'story_version', v_after.id, 'workspace',
    v_story.student_id, v_story.id,
    NULL,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE jsonb_build_object('key', v_before.version_key, 'rowVersion', v_before.row_version) END,
    jsonb_build_object('key', v_after.version_key, 'rowVersion', v_after.row_version, 'mode', p_mode)
  ) INTO v_audit_id;

  RETURN jsonb_build_object(
    'id', v_after.id, 'key', v_after.version_key, 'body', v_after.body,
    'source', v_after.source, 'recordingId', v_after.recording_id,
    'audioAssetId', v_after.audio_asset_id, 'rowVersion', v_after.row_version,
    'createdAt', v_after.created_at, 'updatedAt', v_after.updated_at,
    'auditEventId', v_audit_id::text
  );
END $$;

CREATE OR REPLACE FUNCTION public.sf_restore_story_version(
  p_story_id uuid,
  p_version_key text,
  p_revision_id uuid,
  p_expected_version bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_before public.sf_story_versions;
  v_restore public.sf_story_version_revisions;
  v_after public.sf_story_versions;
  v_audit_id bigint;
BEGIN
  IF NOT public.sf_story_versions_enabled()
    OR NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'story versions are unavailable' USING ERRCODE = '42501';
  END IF;
  IF p_version_key NOT IN ('thirty_second', 'nnq_setup', 'myeras_experience', 'myeras_impactful') OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'invalid story version restore' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id() AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_before FROM public.sf_story_versions
  WHERE story_id = p_story_id AND version_key = p_version_key
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story version not found' USING ERRCODE = 'P0002'; END IF;
  IF v_before.row_version <> p_expected_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_restore FROM public.sf_story_version_revisions
  WHERE id = p_revision_id AND version_id = v_before.id AND story_id = p_story_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'earlier telling not found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.sf_story_version_revisions (
    version_id, story_id, body, source, recording_id, audio_asset_id,
    saved_at, actor_user_id
  ) VALUES (
    v_before.id, v_before.story_id, v_before.body, v_before.source,
    v_before.recording_id, v_before.audio_asset_id, v_before.updated_at,
    public.sf_actor_id()
  );
  UPDATE public.sf_story_versions
  SET body = v_restore.body, source = v_restore.source,
      recording_id = v_restore.recording_id, audio_asset_id = v_restore.audio_asset_id,
      row_version = row_version + 1, updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  INSERT INTO public.sf_authored_segments (
    story_id, story_version_id, source_role, source_entity_type,
    source_entity_id, body_hash, recording_id, audio_asset_id, author_id
  ) VALUES (
    v_after.story_id, v_after.id,
    CASE WHEN v_after.source='voice' THEN 'student_spoken' ELSE 'student_typed' END,
    'story_version', p_revision_id,
    encode(digest(convert_to(v_after.body,'UTF8'),'sha256'),'hex'),
    v_after.recording_id, v_after.audio_asset_id, public.sf_actor_id()
  );

  SELECT public.sf_append_audit(
    'story.version_restored', 'story_version', v_after.id, 'workspace',
    v_story.student_id, v_story.id,
    NULL,
    jsonb_build_object('key', v_before.version_key, 'rowVersion', v_before.row_version),
    jsonb_build_object('key', v_after.version_key, 'rowVersion', v_after.row_version, 'revisionId', p_revision_id)
  ) INTO v_audit_id;
  RETURN jsonb_build_object(
    'id', v_after.id, 'key', v_after.version_key, 'body', v_after.body,
    'source', v_after.source, 'recordingId', v_after.recording_id,
    'audioAssetId', v_after.audio_asset_id, 'rowVersion', v_after.row_version,
    'createdAt', v_after.created_at, 'updatedAt', v_after.updated_at,
    'auditEventId', v_audit_id::text
  );
END $$;

ALTER TABLE public.sf_eras_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_eras_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_eras_taxonomy_terms ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_eras_taxonomy_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_eras_tags ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_story_eras_tags FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_eras_legacy_theme_map ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_eras_legacy_theme_map FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_myeras_workspaces ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_myeras_workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_myeras_experiences ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_myeras_experiences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_myeras_experience_stories ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_myeras_experience_stories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_myeras_impactful ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_myeras_impactful FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_clinical_case ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_story_clinical_case FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_use_ranks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sf_story_use_ranks FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_eras_profiles_read ON public.sf_eras_profiles FOR SELECT TO authenticated USING (
  CASE public.sf_actor_role()
    WHEN 'student' THEN public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student'])
      OR public.sf_story_feature_enabled('myeras_workspace',ARRAY['student'])
      OR public.sf_story_feature_enabled('clinical_case_metadata',ARRAY['student'])
      OR public.sf_story_feature_enabled('use_ranking',ARRAY['student'])
      OR public.sf_story_feature_enabled('myeras_versions',ARRAY['student'])
    WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('eras_taxonomy',NULL)
      OR public.sf_b1_517_admin_feature_enabled('myeras_workspace',NULL)
      OR public.sf_b1_517_admin_feature_enabled('clinical_case_metadata',NULL)
      OR public.sf_b1_517_admin_feature_enabled('use_ranking',NULL)
      OR public.sf_b1_517_admin_feature_enabled('myeras_versions',NULL)
    ELSE false
  END
);
CREATE POLICY sf_eras_taxonomy_terms_read ON public.sf_eras_taxonomy_terms FOR SELECT TO authenticated USING (
  CASE public.sf_actor_role()
    WHEN 'student' THEN public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student'])
    WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('eras_taxonomy',NULL)
    ELSE false
  END
);
CREATE POLICY sf_story_eras_tags_read ON public.sf_story_eras_tags FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sf_stories story WHERE story.id=sf_story_eras_tags.story_id
    AND public.sf_story_observable_to_actor(story.student_id,story.status,story.visibility,story.archived_at)
    AND CASE public.sf_actor_role()
      WHEN 'student' THEN public.sf_story_feature_enabled('eras_taxonomy',ARRAY['student'])
      WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('eras_taxonomy',story.student_id)
      ELSE false
    END)
);
CREATE POLICY sf_myeras_workspaces_read ON public.sf_myeras_workspaces FOR SELECT TO authenticated USING (
  CASE public.sf_actor_role()
    WHEN 'student' THEN student_id=public.sf_actor_id() AND public.sf_story_feature_enabled('myeras_workspace',ARRAY['student'])
    WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('myeras_workspace',student_id)
    ELSE false
  END
);
CREATE POLICY sf_myeras_experiences_read ON public.sf_myeras_experiences FOR SELECT TO authenticated USING (
  CASE public.sf_actor_role()
    WHEN 'student' THEN student_id=public.sf_actor_id() AND public.sf_story_feature_enabled('myeras_workspace',ARRAY['student'])
    WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('myeras_workspace',student_id)
    ELSE false
  END
);
CREATE POLICY sf_myeras_links_read ON public.sf_myeras_experience_stories FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sf_myeras_experiences experience
    JOIN public.sf_stories story ON story.id=sf_myeras_experience_stories.story_id
    WHERE experience.id=sf_myeras_experience_stories.experience_id
      AND public.sf_story_observable_to_actor(story.student_id,story.status,story.visibility,story.archived_at)
      AND CASE public.sf_actor_role()
        WHEN 'student' THEN experience.student_id=public.sf_actor_id() AND public.sf_story_feature_enabled('myeras_workspace',ARRAY['student'])
        WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('myeras_workspace',experience.student_id)
        ELSE false
      END)
);
CREATE POLICY sf_myeras_impactful_read ON public.sf_myeras_impactful FOR SELECT TO authenticated USING (
  CASE public.sf_actor_role()
    WHEN 'student' THEN student_id=public.sf_actor_id() AND public.sf_story_feature_enabled('myeras_workspace',ARRAY['student'])
    WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('myeras_workspace',student_id)
      AND (source_story_id IS NULL OR EXISTS (SELECT 1 FROM public.sf_stories story WHERE story.id=source_story_id
        AND public.sf_story_observable_to_actor(story.student_id,story.status,story.visibility,story.archived_at)))
    ELSE false
  END
);
CREATE POLICY sf_story_clinical_case_read ON public.sf_story_clinical_case FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sf_stories story WHERE story.id=sf_story_clinical_case.story_id
    AND public.sf_story_observable_to_actor(story.student_id,story.status,story.visibility,story.archived_at)
    AND CASE public.sf_actor_role()
      WHEN 'student' THEN public.sf_story_feature_enabled('clinical_case_metadata',ARRAY['student'])
      WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('clinical_case_metadata',story.student_id)
      ELSE false
    END)
);
CREATE POLICY sf_story_use_ranks_read ON public.sf_story_use_ranks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sf_stories story WHERE story.id=sf_story_use_ranks.story_id
    AND public.sf_story_observable_to_actor(story.student_id,story.status,story.visibility,story.archived_at)
    AND CASE public.sf_actor_role()
      WHEN 'student' THEN sf_story_use_ranks.student_id=public.sf_actor_id() AND public.sf_story_feature_enabled('use_ranking',ARRAY['student'])
      WHEN 'admin' THEN public.sf_b1_517_admin_feature_enabled('use_ranking',sf_story_use_ranks.student_id)
      ELSE false
    END)
);

REVOKE ALL ON public.sf_eras_profiles,public.sf_eras_taxonomy_terms,public.sf_story_eras_tags,public.sf_eras_legacy_theme_map,
  public.sf_myeras_workspaces,public.sf_myeras_experiences,public.sf_myeras_experience_stories,public.sf_myeras_impactful,
  public.sf_story_clinical_case,public.sf_story_use_ranks FROM PUBLIC,anon;
GRANT SELECT ON public.sf_eras_profiles,public.sf_eras_taxonomy_terms,public.sf_story_eras_tags,
  public.sf_myeras_workspaces,public.sf_myeras_experiences,public.sf_myeras_experience_stories,public.sf_myeras_impactful,
  public.sf_story_clinical_case,public.sf_story_use_ranks TO authenticated;

REVOKE ALL ON FUNCTION public.sf_eras_active_profile(),public.sf_eras_taxonomy(text),public.sf_b1_517_admin_feature_enabled(text,uuid),
  public.sf_admin_set_b1_517_feature_flag(text,text,uuid[],text[]),public.sf_set_story_eras_tags(uuid,text,jsonb),
  public.sf_list_story_eras_tags(uuid),public.sf_eras_legacy_suggestions(uuid),public.sf_myeras_workspace(uuid),
  public.sf_myeras_upsert_experience(uuid,jsonb,bigint),public.sf_myeras_set_experience_order(uuid[]),
  public.sf_myeras_set_most_meaningful(uuid,boolean,integer,bigint),public.sf_myeras_link_story(uuid,uuid,text),
  public.sf_myeras_unlink_story(uuid,uuid),public.sf_myeras_set_impactful(text,uuid,bigint),public.sf_myeras_promote_impactful(uuid,bigint),
  public.sf_set_story_clinical_case(uuid,jsonb,bigint),public.sf_get_story_clinical_case(uuid),
  public.sf_set_story_use_rank(uuid,text,integer,boolean,bigint),public.sf_myeras_story_fit(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sf_eras_active_profile(),public.sf_eras_taxonomy(text),public.sf_set_story_eras_tags(uuid,text,jsonb),
  public.sf_list_story_eras_tags(uuid),public.sf_eras_legacy_suggestions(uuid),public.sf_myeras_workspace(uuid),
  public.sf_myeras_upsert_experience(uuid,jsonb,bigint),public.sf_myeras_set_experience_order(uuid[]),
  public.sf_myeras_set_most_meaningful(uuid,boolean,integer,bigint),public.sf_myeras_link_story(uuid,uuid,text),
  public.sf_myeras_unlink_story(uuid,uuid),public.sf_myeras_set_impactful(text,uuid,bigint),public.sf_myeras_promote_impactful(uuid,bigint),
  public.sf_set_story_clinical_case(uuid,jsonb,bigint),public.sf_get_story_clinical_case(uuid),
  public.sf_set_story_use_rank(uuid,text,integer,boolean,bigint),public.sf_myeras_story_fit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_b1_517_admin_feature_enabled(text,uuid),public.sf_admin_set_b1_517_feature_flag(text,text,uuid[],text[]) TO authenticated;

COMMIT;

ALTER TABLE public.sf_story_versions VALIDATE CONSTRAINT sf_story_versions_version_key_check;
ALTER TABLE public.sf_ai_suggestions VALIDATE CONSTRAINT sf_ai_suggestions_mode_check;
