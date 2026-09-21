\set ON_ERROR_STOP on

-- B1-STORYFORGE-5021 / DR-320 / DR-321
-- Additive, owner-scoped IV Prep projection consent and minimized read model.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-storyforge-5021-ivoc-projection', 0));

CREATE TABLE public.sf_ivoc_projection_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  policy_version text NOT NULL CHECK (policy_version = 'ivoc-approved-stories-1'),
  decision text NOT NULL CHECK (decision IN ('grant', 'revoke')),
  story_row_version bigint NOT NULL CHECK (story_row_version >= 0),
  approved_summary text,
  include_student_visible_tips boolean NOT NULL DEFAULT false,
  audit_event_id bigint NOT NULL UNIQUE REFERENCES public.sf_audit_events(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (decision = 'grant'
      AND approved_summary IS NOT NULL
      AND length(btrim(approved_summary)) BETWEEN 1 AND 1200
      AND array_length(regexp_split_to_array(btrim(approved_summary), E'\\s+'), 1) BETWEEN 1 AND 60)
    OR
    (decision = 'revoke' AND approved_summary IS NULL AND NOT include_student_visible_tips)
  )
);

CREATE INDEX sf_ivoc_projection_consents_owner_story_idx
  ON public.sf_ivoc_projection_consents
  (student_id, story_id, policy_version, decided_at DESC, id DESC);

ALTER TABLE public.sf_ivoc_projection_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_ivoc_projection_consents FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_ivoc_projection_consents_owner_read
ON public.sf_ivoc_projection_consents FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['student'])
  AND student_id = public.sf_actor_id()
);

REVOKE ALL ON public.sf_ivoc_projection_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_ivoc_projection_consents TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_forbid_ivoc_projection_consent_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IV Prep projection consent is append-only' USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_ivoc_projection_consents_append_only
BEFORE UPDATE OR DELETE ON public.sf_ivoc_projection_consents
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_ivoc_projection_consent_mutation();

CREATE OR REPLACE FUNCTION public.sf_decide_ivoc_projection_consent(
  p_story_id uuid,
  p_expected_version bigint,
  p_decision text,
  p_approved_summary text,
  p_include_student_visible_tips boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_consent public.sf_ivoc_projection_consents;
  v_audit_id bigint;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('grant', 'revoke') THEN
    RAISE EXCEPTION 'invalid IV Prep consent decision' USING ERRCODE = '22023';
  END IF;

  SELECT story.* INTO v_story
  FROM public.sf_stories story
  WHERE story.id = p_story_id
    AND story.student_id = public.sf_actor_id()
    AND story.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_story.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  IF p_decision = 'grant' AND (
    v_story.status <> 'approved'
    OR NOT EXISTS (
      SELECT 1 FROM public.sf_story_publications publication
      WHERE publication.story_id = v_story.id
        AND publication.student_id = v_story.student_id
        AND publication.destination = 'iv_prep_on_call'
        AND publication.active
    )
  ) THEN
    RAISE EXCEPTION 'story is not approved for IV Prep' USING ERRCODE = '42501';
  END IF;

  v_audit_id := public.sf_append_audit(
    CASE WHEN p_decision = 'grant'
      THEN 'student.ivoc_projection_consent_granted'
      ELSE 'student.ivoc_projection_consent_revoked' END,
    'story', v_story.id, 'workspace', v_story.student_id, v_story.id, NULL,
    NULL,
    jsonb_build_object(
      'policy_version', 'ivoc-approved-stories-1',
      'decision', p_decision,
      'story_row_version', v_story.row_version,
      'student_visible_tips', coalesce(p_include_student_visible_tips, false)
    ),
    NULL, 'both'
  );

  INSERT INTO public.sf_ivoc_projection_consents (
    student_id, story_id, policy_version, decision, story_row_version,
    approved_summary, include_student_visible_tips, audit_event_id
  ) VALUES (
    v_story.student_id, v_story.id, 'ivoc-approved-stories-1', p_decision,
    v_story.row_version,
    CASE WHEN p_decision = 'grant' THEN btrim(p_approved_summary) ELSE NULL END,
    CASE WHEN p_decision = 'grant' THEN coalesce(p_include_student_visible_tips, false) ELSE false END,
    v_audit_id
  )
  RETURNING * INTO v_consent;

  RETURN jsonb_build_object(
    'consentId', v_consent.id,
    'storyId', v_consent.story_id,
    'policyVersion', v_consent.policy_version,
    'decision', v_consent.decision,
    'storyVersion', v_consent.story_row_version,
    'includeStudentVisibleTips', v_consent.include_student_visible_tips,
    'decidedAt', v_consent.decided_at,
    'auditEventId', v_consent.audit_event_id
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_ivoc_approved_story_projection()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stories jsonb;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (consent.story_id)
      consent.*
    FROM public.sf_ivoc_projection_consents consent
    WHERE consent.student_id = public.sf_actor_id()
      AND consent.policy_version = 'ivoc-approved-stories-1'
    ORDER BY consent.story_id, consent.decided_at DESC, consent.id DESC
  ),
  eligible AS (
    SELECT story.*, consent.id AS consent_id,
      consent.approved_summary, consent.include_student_visible_tips,
      consent.decided_at AS consented_at
    FROM latest consent
    JOIN public.sf_stories story
      ON story.id = consent.story_id
     AND story.student_id = consent.student_id
    JOIN public.sf_story_publications publication
      ON publication.story_id = story.id
     AND publication.student_id = story.student_id
     AND publication.destination = 'iv_prep_on_call'
     AND publication.active
    WHERE consent.decision = 'grant'
      AND story.status = 'approved'
      AND story.archived_at IS NULL
      AND story.row_version = consent.story_row_version
      AND NOT EXISTS (
        SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id
      )
    ORDER BY story.id
    LIMIT 12
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'storyId', story.id,
      'consentId', story.consent_id,
      'version', story.row_version,
      'title', story.title,
      'themes', to_jsonb(coalesce(story.themes, ARRAY[]::text[])),
      'summary', story.approved_summary,
      'consentedAt', story.consented_at,
      'maturity', jsonb_build_object(
        'mentorScore', story.mentor_score,
        'reviewSuitability', story.review_suitability
      ),
      'applicability', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'questionId', item.id,
          'canonicalKey', item.canonical_key,
          'family', item.family,
          'question', item.text
        ) ORDER BY item.canonical_key NULLS LAST, item.id)
        FROM (
          SELECT question.id, question.canonical_key, question.family, question.text
          FROM public.sf_story_questions pair
          JOIN public.sf_questions question ON question.id = pair.question_id
          WHERE pair.story_id = story.id
            AND pair.state = 'confirmed'
            AND question.governance_state <> 'retired'
          ORDER BY question.canonical_key NULLS LAST, question.id
          LIMIT 12
        ) item
      ), '[]'::jsonb),
      'tips', CASE WHEN story.include_student_visible_tips THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'noteId', tip.id,
          'body', left(tip.body, 280),
          'publishedAt', tip.published_at
        ) ORDER BY tip.published_at DESC, tip.id DESC)
        FROM (
          SELECT note.id, note.body, note.published_at
          FROM public.sf_mentor_notes note
          WHERE note.story_id = story.id
            AND note.student_id = story.student_id
            AND note.state = 'published'
            AND NOT note.internal_only
          ORDER BY note.published_at DESC, note.id DESC
          LIMIT 3
        ) tip
      ), '[]'::jsonb) ELSE '[]'::jsonb END
    ) ORDER BY story.id
  ), '[]'::jsonb)
  INTO v_stories
  FROM eligible story;

  IF jsonb_array_length(v_stories) = 0 THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'policyVersion', 'ivoc-approved-stories-1',
    'stories', v_stories
  );
END
$$;

REVOKE ALL ON FUNCTION public.sf_decide_ivoc_projection_consent(uuid,bigint,text,text,boolean)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_ivoc_approved_story_projection()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sf_decide_ivoc_projection_consent(uuid,bigint,text,text,boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_ivoc_approved_story_projection()
  TO authenticated;

COMMIT;
