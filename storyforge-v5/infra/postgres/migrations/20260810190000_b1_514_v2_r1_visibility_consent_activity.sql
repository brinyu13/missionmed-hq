-- Migration: 20260810190000_b1_514_v2_r1_visibility_consent_activity.sql
-- Authority: DR-042 / DR-043; B1-513R2 R1 contracts
-- Description: Additive visibility, versioned mentorship consent, and
-- content-free activity foundation. Existing StoryForge rows are never
-- rewritten by this migration.
-- Idempotent: NO

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v2-r1-visibility-consent-activity', 0));

ALTER TABLE public.sf_stories
  ADD COLUMN visibility text NULL
    CHECK (visibility IN ('mentor_visible', 'private')),
  ADD COLUMN visibility_changed_at timestamptz NULL;

CREATE TABLE public.sf_mentorship_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  policy_version text NOT NULL CHECK (
    policy_version = btrim(policy_version)
    AND char_length(policy_version) BETWEEN 1 AND 80
  ),
  decision text NOT NULL CHECK (decision IN ('accept', 'defer')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  audit_event_id bigint NOT NULL UNIQUE
    REFERENCES public.sf_audit_events(id) ON DELETE RESTRICT
);

CREATE INDEX sf_mentorship_consent_user_decided_idx
  ON public.sf_mentorship_consent (user_id, audit_event_id DESC);

CREATE TABLE public.sf_activity_config (
  key text PRIMARY KEY CHECK (key = 'activity_tracking'),
  activated_at timestamptz NULL,
  updated_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sf_activity_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_beat_at timestamptz NOT NULL DEFAULT now(),
  active_ms bigint NOT NULL DEFAULT 0 CHECK (active_ms >= 0),
  surface text NOT NULL CHECK (surface IN (
    'home', 'library', 'story_detail', 'capture', 'settings',
    'notifications', 'interview_prep', 'inspiration'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (last_beat_at >= started_at)
);

CREATE INDEX sf_activity_sessions_user_last_beat_idx
  ON public.sf_activity_sessions (user_id, last_beat_at DESC, id DESC);

CREATE TABLE public.sf_activity_counters (
  user_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  counter_key text NOT NULL CHECK (counter_key IN (
    'stories_opened', 'stories_created', 'stories_advanced',
    'submissions', 'reviews_opened',
    'version_edits.thirty_second', 'version_edits.nnq_setup',
    'inspiration_shown', 'inspiration_answered',
    'inspiration_skipped', 'inspiration_promoted'
  )),
  count bigint NOT NULL DEFAULT 0 CHECK (count >= 0),
  first_at timestamptz NOT NULL,
  last_at timestamptz NOT NULL,
  available_from timestamptz NOT NULL,
  PRIMARY KEY (user_id, counter_key),
  CHECK (last_at >= first_at),
  CHECK (first_at >= available_from)
);

CREATE TABLE public.sf_admin_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  state jsonb NOT NULL CHECK (
    jsonb_typeof(state) = 'object'
    AND state - ARRAY['filter','session','sort'] = '{}'::jsonb
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, label)
);

CREATE TABLE public.sf_review_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  sent_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  notification_id uuid NOT NULL UNIQUE REFERENCES public.sf_notifications(id) ON DELETE RESTRICT,
  audit_event_id bigint NOT NULL UNIQUE REFERENCES public.sf_audit_events(id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_review_checks_student_sent_idx
  ON public.sf_review_checks (student_id, sent_at DESC, id DESC);

ALTER TABLE public.sf_mentorship_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_mentorship_consent FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_activity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_activity_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_activity_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_activity_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_activity_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_admin_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_admin_saved_views FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_review_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_review_checks FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_mentorship_consent_owner_read
ON public.sf_mentorship_consent
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['student'])
  AND user_id = public.sf_actor_id()
);

REVOKE ALL ON TABLE public.sf_mentorship_consent,
  public.sf_activity_config,
  public.sf_activity_sessions,
  public.sf_activity_counters,
  public.sf_admin_saved_views,
  public.sf_review_checks
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.sf_mentorship_consent TO authenticated;

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by)
SELECT feature.key, 'off', '{}'::uuid[], '{}'::text[], founder.updated_by
FROM (VALUES
  ('visibility_consent'), ('activity_tracking'), ('admin_directory'),
  ('review_check'), ('admin_review_controls'), ('library_refined_rows'),
  ('admin_mirror'), ('avatar_identity')
) AS feature(key)
CROSS JOIN (
  SELECT updated_by
  FROM public.sf_feature_flags
  WHERE key = 'admin_console'
) AS founder;

INSERT INTO public.sf_activity_config (key, activated_at, updated_by)
SELECT 'activity_tracking', NULL, updated_by
FROM public.sf_feature_flags
WHERE key = 'activity_tracking';

CREATE OR REPLACE FUNCTION public.sf_forbid_mentorship_consent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mentorship consent decisions are append-only'
    USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_mentorship_consent_append_only
BEFORE UPDATE OR DELETE ON public.sf_mentorship_consent
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_mentorship_consent_mutation();

CREATE OR REPLACE FUNCTION public.sf_visibility_consent_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_story_feature_enabled(
    'visibility_consent', ARRAY['student']
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_activity_tracking_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_story_feature_enabled(
    'activity_tracking', ARRAY['student']
  )
$$;

CREATE OR REPLACE FUNCTION public.sf_current_actor_has_mentorship_consent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_has_live_identity(ARRAY['student'])
    AND EXISTS (
      SELECT 1
      FROM public.sf_mentorship_consent consent
      WHERE consent.user_id = public.sf_actor_id()
        AND consent.policy_version = 'mentorship-visibility-1'
        AND consent.decision = 'accept'
        AND NOT EXISTS (
          SELECT 1
          FROM public.sf_mentorship_consent later
          WHERE later.user_id = consent.user_id
            AND later.audit_event_id > consent.audit_event_id
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_story_observable_to_actor(
  p_student_id uuid,
  p_status text,
  p_visibility text,
  p_archived_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_has_live_identity()
    AND (
      p_student_id = public.sf_actor_id()
      OR (
        p_archived_at IS NULL
        AND
        public.sf_actor_role() = 'mentor'
        AND public.sf_is_assigned(p_student_id)
        AND (
          p_status <> 'private'
          OR (
            coalesce(p_visibility, 'private') = 'mentor_visible'
            AND EXISTS (
              SELECT 1
              FROM public.sf_feature_flags flag
              JOIN public.sf_users student ON student.id = p_student_id
              WHERE flag.key = 'visibility_consent'
                AND student.role = 'student'
                AND student.eligible
                AND (
                  flag.scope = 'eligible_all'
                  OR (flag.scope = 'allowlist' AND student.id = ANY(flag.allowlist))
                  OR (
                    flag.scope = 'cohort'
                    AND student.cohort IS NOT NULL
                    AND student.cohort = ANY(flag.cohorts)
                  )
                )
            )
          )
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.sf_get_mentorship_consent()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_consent public.sf_mentorship_consent;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_consent
  FROM public.sf_mentorship_consent consent
  WHERE consent.user_id = public.sf_actor_id()
  ORDER BY consent.audit_event_id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_consent.id,
    'accepted', v_consent.decision = 'accept',
    'decision', v_consent.decision,
    'policyVersion', v_consent.policy_version,
    'decidedAt', v_consent.decided_at,
    'acceptedAt', CASE WHEN v_consent.decision = 'accept' THEN v_consent.decided_at ELSE NULL END,
    'deferredAt', CASE WHEN v_consent.decision = 'defer' THEN v_consent.decided_at ELSE NULL END,
    'auditId', v_consent.audit_event_id::text
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_decide_mentorship_consent(
  p_policy_version text,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_audit_id bigint;
  v_consent public.sf_mentorship_consent;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sf_visibility_consent_enabled() THEN
    RAISE EXCEPTION 'mentorship visibility is disabled' USING ERRCODE = '42501';
  END IF;
  IF p_policy_version <> 'mentorship-visibility-1' THEN
    RAISE EXCEPTION 'unsupported mentorship policy version' USING ERRCODE = '22023';
  END IF;
  IF p_decision NOT IN ('accept', 'defer') THEN
    RAISE EXCEPTION 'invalid mentorship consent decision' USING ERRCODE = '22023';
  END IF;

  v_audit_id := public.sf_append_audit(
    'mentorship.consent_decided', 'user', public.sf_actor_id(), 'system',
    public.sf_actor_id(), NULL, NULL, NULL,
    jsonb_build_object(
      'policy_version', p_policy_version,
      'decision', p_decision
    ),
    NULL, 'both'
  );

  INSERT INTO public.sf_mentorship_consent (
    user_id, policy_version, decision, audit_event_id
  )
  VALUES (
    public.sf_actor_id(), p_policy_version, p_decision, v_audit_id
  )
  RETURNING * INTO v_consent;

  RETURN jsonb_build_object(
    'consent', jsonb_build_object(
      'id', v_consent.id,
      'accepted', v_consent.decision = 'accept',
      'decision', v_consent.decision,
      'policyVersion', v_consent.policy_version,
      'decidedAt', v_consent.decided_at,
      'acceptedAt', CASE WHEN v_consent.decision = 'accept' THEN v_consent.decided_at ELSE NULL END,
      'deferredAt', CASE WHEN v_consent.decision = 'defer' THEN v_consent.decided_at ELSE NULL END,
      'auditId', v_audit_id::text
    ),
    'receipt', jsonb_build_object(
      'auditId', v_audit_id::text,
      'at', v_consent.decided_at,
      'policyVersion', v_consent.policy_version
    )
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_story_visibility(
  p_story_id uuid,
  p_visibility text,
  p_expected_version bigint
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_after public.sf_stories;
  v_detail text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sf_visibility_consent_enabled() THEN
    RAISE EXCEPTION 'mentorship visibility is disabled' USING ERRCODE = '42501';
  END IF;
  IF p_visibility NOT IN ('mentor_visible', 'private') THEN
    RAISE EXCEPTION 'invalid story visibility' USING ERRCODE = '22023';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'expected story version is required' USING ERRCODE = '22023';
  END IF;
  IF p_visibility = 'mentor_visible'
     AND NOT public.sf_current_actor_has_mentorship_consent() THEN
    RAISE EXCEPTION 'affirmative mentorship consent is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_stories story
  WHERE story.id = p_story_id
    AND story.student_id = public.sf_actor_id()
    AND story.archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.row_version <> p_expected_version THEN
    RAISE EXCEPTION 'story changed in another session' USING ERRCODE = '40001';
  END IF;
  IF p_visibility = 'private' AND v_before.status <> 'private' THEN
    RAISE EXCEPTION 'visibility_submitted' USING ERRCODE = '23514';
  END IF;

  IF v_before.visibility IS NOT DISTINCT FROM p_visibility THEN
    RETURN v_before;
  END IF;

  UPDATE public.sf_stories
  SET visibility = p_visibility,
      visibility_changed_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  v_detail := CASE p_visibility
    WHEN 'private' THEN 'to Private — visible only to me'
    ELSE 'to Mentor Visible'
  END;

  PERFORM public.sf_append_audit(
    'story.visibility_changed', 'story', v_after.id, 'workspace',
    v_after.student_id, v_after.id, NULL,
    jsonb_build_object('visibility', v_before.visibility),
    jsonb_build_object(
      'visibility', v_after.visibility,
      'row_version', v_after.row_version
    ),
    v_detail, 'both'
  );

  RETURN v_after;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_activity_heartbeat(
  p_session_id uuid,
  p_surface text,
  p_active_ms bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.sf_activity_sessions;
  v_session public.sf_activity_sessions;
  v_elapsed_ms bigint;
  v_credit_ms bigint;
  v_available_from timestamptz;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sf_activity_tracking_enabled() THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'disabled');
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'activity session identifier is required' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN (
    'home', 'library', 'story_detail', 'capture', 'settings',
    'notifications', 'interview_prep', 'inspiration'
  ) THEN
    RAISE EXCEPTION 'invalid activity surface' USING ERRCODE = '22023';
  END IF;
  IF p_active_ms IS NULL OR p_active_ms < 0 OR p_active_ms > 60000 THEN
    RAISE EXCEPTION 'invalid activity interval' USING ERRCODE = '22023';
  END IF;

  SELECT activated_at INTO v_available_from
  FROM public.sf_activity_config
  WHERE key = 'activity_tracking';
  IF v_available_from IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'not_activated');
  END IF;

  SELECT * INTO v_existing
  FROM public.sf_activity_sessions session
  WHERE session.id = p_session_id
  FOR UPDATE;

  IF FOUND AND v_existing.user_id <> public.sf_actor_id() THEN
    RAISE EXCEPTION 'activity session not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.sf_activity_sessions (
      id, user_id, active_ms, surface
    )
    VALUES (
      p_session_id, public.sf_actor_id(), p_active_ms, p_surface
    )
    RETURNING * INTO v_session;
  ELSE
    IF v_existing.last_beat_at < now() - interval '30 minutes' THEN
      RETURN jsonb_build_object(
        'accepted', false,
        'reason', 'session_closed',
        'sessionId', v_existing.id
      );
    END IF;
    v_elapsed_ms := greatest(
      0,
      floor(extract(epoch FROM (clock_timestamp() - v_existing.last_beat_at)) * 1000)::bigint
    );
    v_credit_ms := least(p_active_ms, v_elapsed_ms, 60000::bigint);
    UPDATE public.sf_activity_sessions
    SET last_beat_at = now(),
        active_ms = active_ms + v_credit_ms,
        surface = p_surface
    WHERE id = v_existing.id
    RETURNING * INTO v_session;
  END IF;

  RETURN jsonb_build_object(
    'accepted', true,
    'sessionId', v_session.id,
    'surface', v_session.surface,
    'startedAt', v_session.started_at,
    'lastBeatAt', v_session.last_beat_at,
    'activeMs', v_session.active_ms,
    'availableFrom', v_available_from
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_activity_for_student(
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_available_from timestamptz;
  v_enabled boolean;
  v_sessions jsonb;
  v_counters jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();

  IF NOT EXISTS (
    SELECT 1 FROM public.sf_users student
    WHERE student.id = p_student_id
      AND student.role = 'student'
      AND student.eligible
  ) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sf_feature_flags flag
    JOIN public.sf_users student ON student.id = p_student_id
    WHERE flag.key = 'activity_tracking'
      AND (
        flag.scope = 'eligible_all'
        OR (flag.scope = 'allowlist' AND student.id = ANY(flag.allowlist))
        OR (
          flag.scope = 'cohort'
          AND student.cohort IS NOT NULL
          AND student.cohort = ANY(flag.cohorts)
        )
      )
  ) INTO v_enabled;
  IF NOT v_enabled THEN
    RAISE EXCEPTION 'activity tracking is disabled' USING ERRCODE = '42501';
  END IF;

  SELECT activated_at INTO v_available_from
  FROM public.sf_activity_config
  WHERE key = 'activity_tracking';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'startedAt', session.started_at,
    'lastBeatAt', session.last_beat_at,
    'activeMs', session.active_ms,
    'surface', session.surface
  ) ORDER BY session.started_at DESC, session.id DESC), '[]'::jsonb)
  INTO v_sessions
  FROM public.sf_activity_sessions session
  WHERE session.user_id = p_student_id;

  SELECT coalesce(jsonb_object_agg(counter.counter_key, jsonb_build_object(
    'count', counter.count,
    'firstAt', counter.first_at,
    'lastAt', counter.last_at,
    'availableFrom', counter.available_from
  )), '{}'::jsonb)
  INTO v_counters
  FROM public.sf_activity_counters counter
  WHERE counter.user_id = p_student_id;

  RETURN jsonb_build_object(
    'studentId', p_student_id,
    'availableFrom', v_available_from,
    'sessions', v_sessions,
    'counters', v_counters
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_b1_514_feature_flag(
  p_key text,
  p_scope text,
  p_allowlist uuid[],
  p_cohorts text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_feature_flags;
  v_after public.sf_feature_flags;
  v_audit_id bigint;
BEGIN
  PERFORM public.sf_admin_assert_enabled();

  IF p_key NOT IN (
    'visibility_consent', 'activity_tracking', 'admin_directory',
    'review_check', 'admin_review_controls', 'library_refined_rows',
    'admin_mirror', 'avatar_identity'
  ) THEN
    RAISE EXCEPTION 'unsupported B1-514 feature flag' USING ERRCODE = '22023';
  END IF;
  IF p_scope NOT IN ('off', 'allowlist', 'cohort', 'eligible_all') THEN
    RAISE EXCEPTION 'invalid B1-514 feature scope' USING ERRCODE = '22023';
  END IF;
  p_allowlist := coalesce(p_allowlist, '{}'::uuid[]);
  p_cohorts := coalesce(p_cohorts, '{}'::text[]);
  IF cardinality(p_allowlist) > 50 OR cardinality(p_cohorts) > 20 THEN
    RAISE EXCEPTION 'B1-514 feature scope is too broad' USING ERRCODE = '22023';
  END IF;
  IF (p_scope = 'off' AND (cardinality(p_allowlist) <> 0 OR cardinality(p_cohorts) <> 0))
     OR (p_scope = 'allowlist' AND (cardinality(p_allowlist) = 0 OR cardinality(p_cohorts) <> 0))
     OR (p_scope = 'cohort' AND (cardinality(p_cohorts) = 0 OR cardinality(p_allowlist) <> 0))
     OR (p_scope = 'eligible_all' AND (cardinality(p_allowlist) <> 0 OR cardinality(p_cohorts) <> 0)) THEN
    RAISE EXCEPTION 'invalid B1-514 feature scope values' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_allowlist) requested(id)
    LEFT JOIN public.sf_users student ON student.id = requested.id
    WHERE student.id IS NULL OR student.role <> 'student' OR NOT student.eligible
  ) THEN
    RAISE EXCEPTION 'B1-514 allowlist must contain eligible students' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_cohorts) cohort(value)
    WHERE btrim(value) = '' OR value <> btrim(value)
  ) THEN
    RAISE EXCEPTION 'B1-514 cohorts must be normalized' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_feature_flags
  WHERE key = p_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'B1-514 feature flag is unavailable' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.sf_feature_flags
  SET scope = p_scope,
      allowlist = p_allowlist,
      cohorts = p_cohorts,
      updated_by = public.sf_actor_id(),
      updated_at = now()
  WHERE key = p_key
  RETURNING * INTO v_after;

  IF p_key = 'activity_tracking' AND p_scope <> 'off' THEN
    UPDATE public.sf_activity_config
    SET activated_at = coalesce(activated_at, now()),
        updated_by = public.sf_actor_id(),
        updated_at = now()
    WHERE key = 'activity_tracking';
  END IF;

  v_audit_id := public.sf_append_audit(
    'feature_scope_changed', 'feature_flag', NULL, 'system', NULL, NULL, NULL,
    jsonb_build_object(
      'key', v_before.key,
      'scope', v_before.scope,
      'allowlist_count', cardinality(v_before.allowlist),
      'cohort_count', cardinality(v_before.cohorts)
    ),
    jsonb_build_object(
      'key', v_after.key,
      'scope', v_after.scope,
      'allowlist_count', cardinality(v_after.allowlist),
      'cohort_count', cardinality(v_after.cohorts)
    )
  );

  RETURN jsonb_build_object(
    'key', v_after.key,
    'scope', v_after.scope,
    'allowlist', to_jsonb(v_after.allowlist),
    'cohorts', to_jsonb(v_after.cohorts),
    'updatedBy', v_after.updated_by,
    'updatedAt', v_after.updated_at,
    'auditId', v_audit_id::text
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_b1_514_admin_feature_enabled(
  p_key text,
  p_student_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  SELECT EXISTS (
    SELECT 1
    FROM public.sf_feature_flags flag
    LEFT JOIN public.sf_users student ON student.id = p_student_id
    WHERE flag.key = p_key
      AND (
        (p_student_id IS NULL AND flag.scope <> 'off')
        OR flag.scope = 'eligible_all'
        OR (flag.scope = 'allowlist' AND p_student_id = ANY(flag.allowlist))
        OR (
          flag.scope = 'cohort'
          AND student.cohort IS NOT NULL
          AND student.cohort = ANY(flag.cohorts)
        )
      )
  ) INTO v_enabled;
  RETURN v_enabled;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_directory(
  p_query text DEFAULT '',
  p_filter text DEFAULT 'all',
  p_session text DEFAULT '',
  p_sort text DEFAULT 'attention',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory') THEN
    RAISE EXCEPTION 'administrator directory is disabled' USING ERRCODE='42501';
  END IF;
  IF p_filter NOT IN ('all','awaiting','needs_review','never_active','never_started','needs_nudge','progressing','changes','warnings','inactive_7','inactive_30')
    OR p_sort NOT IN ('attention','name','recent','quiet','stories')
    OR p_page < 1 OR p_page > 1000000 OR p_page_size < 1 OR p_page_size > 50
    OR length(p_query) > 120 OR length(p_session) > 80 THEN
    RAISE EXCEPTION 'invalid administrator directory query' USING ERRCODE='22023';
  END IF;

  WITH population AS (
    SELECT student.id,student.wp_user_id,student.display_name,student.first_name,
      student.cohort,student.academic_year,student.specialty,student.application_cycle,
      count(story.id)::integer AS story_count,
      count(story.id) FILTER (WHERE story.status='private' AND coalesce(story.visibility,'private')='private')::integer AS private_count,
      count(story.id) FILTER (WHERE story.visibility='mentor_visible')::integer AS mentor_visible_count,
      count(story.id) FILTER (WHERE story.status='awaiting')::integer AS awaiting_count,
      count(story.id) FILTER (WHERE story.status='in_review')::integer AS in_review_count,
      count(story.id) FILTER (WHERE story.status='changes')::integer AS changes_count,
      count(story.id) FILTER (WHERE story.status='reviewed')::integer AS reviewed_count,
      count(story.id) FILTER (WHERE story.status='approved')::integer AS approved_count,
      max(story.updated_at) AS last_story_at,
      (SELECT max(session.last_beat_at) FROM public.sf_activity_sessions session WHERE session.user_id=student.id) AS last_activity_at,
      (SELECT max(checks.sent_at) FROM public.sf_review_checks checks WHERE checks.student_id=student.id) AS last_review_check_at
    FROM public.sf_users student
    LEFT JOIN public.sf_stories story ON story.student_id=student.id AND story.archived_at IS NULL
    WHERE student.role='student' AND student.eligible
      AND (p_query='' OR student.display_name ILIKE '%'||p_query||'%' OR coalesce(student.first_name,'') ILIKE '%'||p_query||'%' OR student.wp_user_id::text=p_query)
      AND (p_session='' OR coalesce(student.cohort,'')=p_session)
    GROUP BY student.id
  ), filtered AS (
    SELECT * FROM population
    WHERE p_filter='all'
      OR (p_filter IN ('awaiting','needs_review') AND awaiting_count>0)
      OR (p_filter IN ('never_active','never_started') AND last_activity_at IS NULL AND story_count=0)
      OR (p_filter='needs_nudge' AND coalesce(last_activity_at,last_story_at) < now()-interval '7 days')
      OR (p_filter='progressing' AND coalesce(last_activity_at,last_story_at) >= now()-interval '7 days')
      OR (p_filter='changes' AND changes_count>0)
      OR (p_filter='warnings' AND (story_count=0 OR coalesce(last_activity_at,last_story_at) < now()-interval '30 days'))
      OR (p_filter='inactive_7' AND coalesce(last_activity_at,last_story_at) < now()-interval '7 days')
      OR (p_filter='inactive_30' AND coalesce(last_activity_at,last_story_at) < now()-interval '30 days')
  ), ranked AS (
    SELECT *,count(*) OVER()::integer AS total
    FROM filtered
    ORDER BY
      CASE WHEN p_sort='attention' THEN awaiting_count+changes_count END DESC,
      CASE WHEN p_sort='name' THEN lower(display_name) END ASC,
      CASE WHEN p_sort='recent' THEN coalesce(last_activity_at,last_story_at) END DESC NULLS LAST,
      CASE WHEN p_sort='quiet' THEN coalesce(last_activity_at,last_story_at) END ASC NULLS FIRST,
      CASE WHEN p_sort='stories' THEN story_count END DESC,
      lower(display_name),id
    OFFSET (p_page-1)*p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'students',coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'wpUserId',wp_user_id,'displayName',display_name,'firstName',first_name,
      'cohort',cohort,'academicYear',academic_year,'specialty',specialty,'applicationCycle',application_cycle,
      'storyCount',story_count,'privateCount',private_count,'mentorVisibleCount',mentor_visible_count,
      'awaitingReview',awaiting_count,'inReview',in_review_count,'changesRequested',changes_count,
      'reviewed',reviewed_count,'approved',approved_count,'lastStoryAt',last_story_at,
      'lastActivityAt',last_activity_at,'lastReviewCheckAt',last_review_check_at
    )), '[]'::jsonb),
    'total',coalesce(max(total),0),'page',p_page,'pageSize',p_page_size,
    'boundaries',jsonb_build_object('activityFrom',(SELECT activated_at FROM public.sf_activity_config WHERE key='activity_tracking'))
  ) INTO v_payload FROM ranked;
  RETURN v_payload;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_directory_student(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory',p_student_id) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE='P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sf_users WHERE id=p_student_id AND role='student' AND eligible) THEN
    RAISE EXCEPTION 'student not found' USING ERRCODE='P0002';
  END IF;
  SELECT jsonb_build_object(
    'student',jsonb_build_object('id',student.id,'wpUserId',student.wp_user_id,'displayName',student.display_name,'firstName',student.first_name,'cohort',student.cohort,'academicYear',student.academic_year,'specialty',student.specialty,'applicationCycle',student.application_cycle),
    'counts',jsonb_build_object(
      'total',(SELECT count(*) FROM public.sf_stories s WHERE s.student_id=student.id AND s.archived_at IS NULL),
      'private',(SELECT count(*) FROM public.sf_stories s WHERE s.student_id=student.id AND s.archived_at IS NULL AND s.status='private' AND coalesce(s.visibility,'private')='private'),
      'mentorVisible',(SELECT count(*) FROM public.sf_stories s WHERE s.student_id=student.id AND s.archived_at IS NULL AND s.visibility='mentor_visible'),
      'awaiting',(SELECT count(*) FROM public.sf_stories s WHERE s.student_id=student.id AND s.status='awaiting' AND s.archived_at IS NULL),
      'approved',(SELECT count(*) FROM public.sf_stories s WHERE s.student_id=student.id AND s.status='approved' AND s.archived_at IS NULL)
    ),
    'stories',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'status',s.status,'visibility',s.visibility,'mentorScore',s.mentor_score,'reviewSuitability',s.review_suitability,'rowVersion',s.row_version,'updatedAt',s.updated_at) ORDER BY s.updated_at DESC,s.id DESC) FROM public.sf_stories s WHERE s.student_id=student.id AND s.archived_at IS NULL AND (s.status<>'private' OR (s.visibility='mentor_visible' AND public.sf_b1_514_admin_feature_enabled('visibility_consent',student.id)))),'[]'::jsonb),
    'activity',jsonb_build_object('availableFrom',(SELECT activated_at FROM public.sf_activity_config WHERE key='activity_tracking'),'lastActivityAt',(SELECT max(last_beat_at) FROM public.sf_activity_sessions WHERE user_id=student.id)),
    'reviewChecks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'body',c.body,'sentAt',c.sent_at,'notificationId',c.notification_id,'auditEventId',c.audit_event_id::text) ORDER BY c.sent_at DESC,c.id DESC) FROM public.sf_review_checks c WHERE c.student_id=student.id),'[]'::jsonb)
  ) INTO v_payload FROM public.sf_users student WHERE student.id=p_student_id;
  RETURN v_payload;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_saved_views()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory') THEN RAISE EXCEPTION 'directory disabled' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('views',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'label',label,'state',state,'createdAt',created_at,'updatedAt',updated_at) ORDER BY updated_at DESC,id DESC) FROM public.sf_admin_saved_views WHERE admin_id=public.sf_actor_id()),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.sf_admin_save_view(p_label text,p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_view public.sf_admin_saved_views;
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory') OR length(btrim(p_label)) NOT BETWEEN 1 AND 80 OR jsonb_typeof(p_state)<>'object' OR p_state-ARRAY['filter','session','sort']<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid saved view' USING ERRCODE='22023'; END IF;
  INSERT INTO public.sf_admin_saved_views(admin_id,label,state) VALUES(public.sf_actor_id(),btrim(p_label),p_state) ON CONFLICT(admin_id,label) DO UPDATE SET state=excluded.state,updated_at=now() RETURNING * INTO v_view;
  RETURN jsonb_build_object('id',v_view.id,'label',v_view.label,'state',v_view.state,'createdAt',v_view.created_at,'updatedAt',v_view.updated_at);
END $$;

CREATE OR REPLACE FUNCTION public.sf_admin_delete_saved_view(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('admin_directory') THEN RAISE EXCEPTION 'directory disabled' USING ERRCODE='42501'; END IF;
  DELETE FROM public.sf_admin_saved_views WHERE id=p_id AND admin_id=public.sf_actor_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'saved view not found' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('deleted',true,'id',p_id);
END $$;

CREATE OR REPLACE FUNCTION public.sf_admin_review_queue_scaled(p_query text,p_status text,p_session text,p_sort text,p_page integer,p_page_size integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payload jsonb;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF p_sort NOT IN ('oldest','newest','updated','student') OR p_page<1 OR p_page_size<1 OR p_page_size>50 OR length(p_query)>120 OR length(p_session)>80 THEN RAISE EXCEPTION 'invalid scaled queue query' USING ERRCODE='22023'; END IF;
  WITH matching AS (
    SELECT s.*,u.display_name AS student_name,u.cohort AS student_cohort,count(*) OVER()::integer AS total
    FROM public.sf_stories s JOIN public.sf_users u ON u.id=s.student_id
    WHERE s.status<>'private' AND s.archived_at IS NULL
      AND (coalesce(p_query,'')='' OR s.title ILIKE '%'||p_query||'%' OR u.display_name ILIKE '%'||p_query||'%')
      AND (p_status IS NULL OR p_status='' OR s.status=p_status OR (p_status='unscored' AND s.mentor_score IS NULL))
      AND (coalesce(p_session,'')='' OR coalesce(u.cohort,'')=p_session)
    ORDER BY CASE WHEN p_sort='oldest' THEN coalesce(s.last_submitted_at,s.updated_at) END ASC,CASE WHEN p_sort='newest' THEN coalesce(s.last_submitted_at,s.updated_at) END DESC,CASE WHEN p_sort='updated' THEN s.updated_at END DESC,CASE WHEN p_sort='student' THEN lower(u.display_name) END ASC,s.id
    OFFSET (p_page-1)*p_page_size LIMIT p_page_size
  ) SELECT jsonb_build_object('stories',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'studentId',student_id,'studentName',student_name,'cohort',student_cohort,'status',status,'mentorScore',mentor_score,'reviewSuitability',review_suitability,'rowVersion',row_version,'revised',revised,'updatedAt',updated_at,'submittedAt',coalesce(last_submitted_at,submitted_at))),'[]'::jsonb),'total',coalesce(max(total),0),'page',p_page,'pageSize',p_page_size) INTO v_payload FROM matching;
  RETURN v_payload;
END $$;

CREATE OR REPLACE FUNCTION public.sf_record_review_check(p_student_id uuid,p_preview boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_name text;v_body text;v_notification public.sf_notifications;v_audit bigint;v_check public.sf_review_checks;v_stamp text;
BEGIN
  IF NOT public.sf_b1_514_admin_feature_enabled('review_check',p_student_id) THEN RAISE EXCEPTION 'review check disabled' USING ERRCODE='42501'; END IF;
  SELECT display_name INTO v_name FROM public.sf_users WHERE id=p_student_id AND role='student' AND eligible;
  IF NOT FOUND THEN RAISE EXCEPTION 'student not found' USING ERRCODE='P0002'; END IF;
  v_stamp:=to_char(now(),'Mon FMDD, YYYY at FMHH12:MI AM TZ');
  IF NOT EXISTS(SELECT 1 FROM public.sf_stories WHERE student_id=p_student_id AND status<>'private' AND archived_at IS NULL) THEN v_body:='Dr Brian checked StoryForge for work to review on '||v_stamp||', but no stories had been submitted. When you''re ready, submit a story so your mentor can review it.';
  ELSIF EXISTS(SELECT 1 FROM public.sf_stories WHERE student_id=p_student_id AND status IN('reviewed','approved') AND archived_at IS NULL) THEN v_body:='Dr Brian checked StoryForge on '||v_stamp||' and reviewed your submitted work. Open your stories to see the latest feedback.';
  ELSE v_body:='Dr Brian checked StoryForge on '||v_stamp||'. Your submitted work is in the review queue — feedback will land in your notifications.'; END IF;
  IF p_preview THEN RETURN jsonb_build_object('preview',true,'studentId',p_student_id,'studentName',v_name,'body',v_body,'sent',false); END IF;
  IF EXISTS(SELECT 1 FROM public.sf_review_checks WHERE student_id=p_student_id AND sent_at>now()-interval '24 hours') THEN RAISE EXCEPTION 'A Review Check was already sent to this student in the last 24 hours.' USING ERRCODE='P0003'; END IF;
  SELECT * INTO v_notification FROM public.sf_emit_notification(p_student_id,public.sf_actor_id(),NULL,NULL,'review_check','system','StoryForge Review Check',v_body,'/notifications');
  v_audit:=public.sf_append_audit('admin.review_check_sent','student',p_student_id,'system',p_student_id,NULL,NULL,NULL,jsonb_build_object('notificationId',v_notification.id),NULL,'admin_only');
  INSERT INTO public.sf_review_checks(student_id,sent_by,body,notification_id,audit_event_id) VALUES(p_student_id,public.sf_actor_id(),v_body,v_notification.id,v_audit) RETURNING * INTO v_check;
  RETURN jsonb_build_object('id',v_check.id,'studentId',v_check.student_id,'sentAt',v_check.sent_at,'sentBy',v_check.sent_by,'body',v_check.body,'status','recorded','notificationId',v_check.notification_id,'auditEventId',v_check.audit_event_id::text);
END $$;

-- New stories get a mentor-visible default only for a currently enabled
-- student whose latest decision affirmatively accepts the current policy.
-- Existing stories are never touched.
CREATE OR REPLACE FUNCTION public.sf_create_story_v5(
  p_payload jsonb,
  p_surface text DEFAULT 'quick'
)
RETURNS public.sf_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_capture_type text := coalesce(nullif(p_payload->>'captureType', ''), 'text');
  v_title text := coalesce(nullif(trim(p_payload->>'title'), ''), 'Untitled story');
  v_text text := coalesce(p_payload->>'text', '');
  v_lesson text := coalesce(p_payload->>'lesson', '');
  v_prefix boolean := coalesce((p_payload->>'prefixEnabled')::boolean, true);
  v_score smallint := nullif(p_payload->>'studentScore', '')::smallint;
  v_draft_version bigint := nullif(p_payload->>'draftVersion', '')::bigint;
  v_draft public.sf_story_drafts;
  v_themes text[] := ARRAY[]::text[];
  v_uses text[] := ARRAY[]::text[];
  v_visibility text := NULL;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student']) THEN
    RAISE EXCEPTION 'eligible student identity required' USING ERRCODE = '42501';
  END IF;
  IF v_capture_type NOT IN ('text', 'audio', 'imported') THEN
    RAISE EXCEPTION 'invalid capture type' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN ('library', 'quick', 'workspace') THEN
    RAISE EXCEPTION 'invalid surface' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'draftVersion' THEN
    IF v_draft_version IS NULL OR v_draft_version < 0 THEN
      RAISE EXCEPTION 'a valid capture draft version is required'
        USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_draft
    FROM public.sf_story_drafts
    WHERE user_id = public.sf_actor_id()
    FOR UPDATE;
    IF FOUND AND v_draft.row_version <> v_draft_version THEN
      RAISE EXCEPTION 'draft changed in another session' USING ERRCODE = '40001';
    ELSIF NOT FOUND AND v_draft_version <> 0 THEN
      RAISE EXCEPTION 'draft changed in another session' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF jsonb_typeof(p_payload->'themes') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_themes
    FROM jsonb_array_elements_text(p_payload->'themes') item(value);
  END IF;
  IF jsonb_typeof(p_payload->'uses') = 'array' THEN
    SELECT coalesce(array_agg(value), ARRAY[]::text[]) INTO v_uses
    FROM jsonb_array_elements_text(p_payload->'uses') item(value);
  END IF;

  IF public.sf_visibility_consent_enabled()
     AND public.sf_current_actor_has_mentorship_consent() THEN
    v_visibility := 'mentor_visible';
  END IF;

  INSERT INTO public.sf_stories (
    student_id, title, original_text, current_text, capture_type, prefix_enabled,
    lesson, student_score, themes, uses, student_updated_at, status_changed_at,
    visibility, visibility_changed_at
  )
  VALUES (
    public.sf_actor_id(), v_title, v_text, v_text, v_capture_type, v_prefix,
    v_lesson, v_score, v_themes, v_uses, now(), now(),
    v_visibility, CASE WHEN v_visibility IS NULL THEN NULL ELSE now() END
  )
  RETURNING * INTO v_story;

  IF v_capture_type <> 'audio' THEN
    INSERT INTO public.sf_story_originals (
      story_id, original_transcript, capture_type, created_at
    )
    VALUES (v_story.id, v_text, v_capture_type, v_story.created_at);
  END IF;

  INSERT INTO public.sf_story_revisions (
    story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason
  )
  VALUES (
    v_story.id, 0, v_story.current_text, v_story.title,
    public.sf_actor_id(), 'capture'
  );

  PERFORM public.sf_append_audit(
    'story.captured', 'story', v_story.id, p_surface,
    v_story.student_id, v_story.id, NULL, NULL,
    jsonb_build_object(
      'status', v_story.status,
      'capture_type', v_story.capture_type,
      'prefix_enabled', v_story.prefix_enabled,
      'visibility', v_story.visibility
    )
  );

  IF p_payload ? 'draftVersion' THEN
    INSERT INTO public.sf_story_drafts (user_id, payload)
    VALUES (public.sf_actor_id(), '{}'::jsonb)
    ON CONFLICT (user_id) DO UPDATE
    SET payload = '{}'::jsonb,
        row_version = sf_story_drafts.row_version + 1,
        updated_at = now()
    RETURNING * INTO v_draft;

    PERFORM public.sf_append_audit(
      'story.draft_consumed', 'story_draft', v_draft.user_id, 'quick',
      v_draft.user_id, v_story.id, NULL, NULL,
      jsonb_build_object('row_version', v_draft.row_version)
    );
  END IF;

  RETURN v_story;
END
$$;

-- One total observation predicate is used by the canonical story and child
-- policies. Submitted-story behavior is preserved while ambient visibility is
-- independently flag-gated.
DROP POLICY IF EXISTS sf_stories_read ON public.sf_stories;
CREATE POLICY sf_stories_read ON public.sf_stories
FOR SELECT TO authenticated
USING (public.sf_story_observable_to_actor(
  student_id, status, visibility, archived_at
));

DROP POLICY IF EXISTS sf_revisions_read ON public.sf_story_revisions;
CREATE POLICY sf_revisions_read ON public.sf_story_revisions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_revisions.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_feedback_read ON public.sf_feedback;
CREATE POLICY sf_feedback_read ON public.sf_feedback
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_feedback.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_audio_read ON public.sf_audio_assets;
CREATE POLICY sf_audio_read ON public.sf_audio_assets
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_audio_assets.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_story_questions_read ON public.sf_story_questions;
CREATE POLICY sf_story_questions_read ON public.sf_story_questions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_questions.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_story_originals_read ON public.sf_story_originals;
CREATE POLICY sf_story_originals_read ON public.sf_story_originals
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_originals.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_story_reflections_read ON public.sf_story_reflections;
CREATE POLICY sf_story_reflections_read ON public.sf_story_reflections
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_reflections.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

DROP POLICY IF EXISTS sf_use_suggestions_read ON public.sf_use_suggestions;
CREATE POLICY sf_use_suggestions_read ON public.sf_use_suggestions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_use_suggestions.story_id
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

REVOKE ALL ON FUNCTION public.sf_forbid_mentorship_consent_mutation() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_visibility_consent_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_activity_tracking_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_current_actor_has_mentorship_consent() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_story_observable_to_actor(uuid, text, text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_get_mentorship_consent() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_decide_mentorship_consent(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_set_story_visibility(uuid, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_activity_heartbeat(uuid, text, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_activity_for_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_set_b1_514_feature_flag(text, text, uuid[], text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_b1_514_admin_feature_enabled(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_directory(text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_directory_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_saved_views() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_save_view(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_delete_saved_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_admin_review_queue_scaled(text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sf_record_review_check(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sf_visibility_consent_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_activity_tracking_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_current_actor_has_mentorship_consent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_story_observable_to_actor(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_get_mentorship_consent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_decide_mentorship_consent(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_set_story_visibility(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_activity_heartbeat(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_activity_for_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_set_b1_514_feature_flag(text, text, uuid[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_b1_514_admin_feature_enabled(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_directory(text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_directory_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_saved_views() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_save_view(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_delete_saved_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_admin_review_queue_scaled(text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_record_review_check(uuid, boolean) TO authenticated;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.sf_feature_flags
    WHERE key IN (
      'visibility_consent', 'activity_tracking', 'admin_directory',
      'review_check', 'admin_review_controls', 'library_refined_rows',
      'admin_mirror', 'avatar_identity'
    )
  ) <> 8 THEN
    RAISE EXCEPTION 'B1-514 R1 feature flags were not seeded exactly once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sf_feature_flags
    WHERE key IN (
      'visibility_consent', 'activity_tracking', 'admin_directory',
      'review_check', 'admin_review_controls', 'library_refined_rows',
      'admin_mirror', 'avatar_identity'
    )
      AND (
        scope <> 'off'
        OR cardinality(allowlist) <> 0
        OR cardinality(cohorts) <> 0
      )
  ) THEN
    RAISE EXCEPTION 'B1-514 R1 feature flags must default independently off';
  END IF;
  IF (SELECT count(*) FROM public.sf_activity_config WHERE key = 'activity_tracking') <> 1 THEN
    RAISE EXCEPTION 'B1-514 activity boundary configuration is unavailable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sf_activity_config WHERE activated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'B1-514 activity history must not be fabricated';
  END IF;
END
$$;

COMMIT;
