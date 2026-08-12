\set ON_ERROR_STOP on

-- Migration: B1-515 StoryForge V2.0.1 reviews, reversible collections, and peer review.
-- Authority: DR-059 / DR-060.
-- Safety: additive only; no historical story, ownership, visibility, or media mutation.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('b1-515-v201-reviews-collections-peer', 0));

CREATE TABLE public.sf_story_trash (
  story_id uuid PRIMARY KEY REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  trashed_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  trashed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_story_trash_student_idx
  ON public.sf_story_trash (student_id, trashed_at DESC, story_id);

CREATE TABLE public.sf_story_use_reviews (
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  use_id text NOT NULL CHECK (use_id IN (
    'ps', 'iv', 'letter', 'myeras_experiences', 'myeras_most_impactful', 'later'
  )),
  qualifies boolean NOT NULL DEFAULT false,
  score smallint CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  reviewer_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, use_id)
);

CREATE TABLE public.sf_story_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  destination text NOT NULL CHECK (destination IN ('personal_statement', 'iv_prep_on_call')),
  active boolean NOT NULL DEFAULT true,
  activated_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  activated_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((active AND revoked_at IS NULL AND revoked_by IS NULL) OR (NOT active AND revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX sf_story_publications_one_active_destination
  ON public.sf_story_publications (student_id, destination)
  WHERE active;
CREATE INDEX sf_story_publications_story_idx
  ON public.sf_story_publications (story_id, destination, active);

CREATE TABLE public.sf_peer_story_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  recipient_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  cohort_snapshot text NOT NULL CHECK (length(trim(cohort_snapshot)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  private_confirmed boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  CHECK (owner_id <> recipient_id),
  CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX sf_peer_story_grants_one_active
  ON public.sf_peer_story_grants (story_id, recipient_id)
  WHERE status = 'active';
CREATE INDEX sf_peer_story_grants_recipient_idx
  ON public.sf_peer_story_grants (recipient_id, status, granted_at DESC, id);
CREATE INDEX sf_peer_story_grants_owner_idx
  ON public.sf_peer_story_grants (owner_id, story_id, status, id);

CREATE TABLE public.sf_peer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.sf_peer_story_grants(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sf_peer_feedback_story_idx
  ON public.sf_peer_feedback (story_id, created_at, id);

ALTER TABLE public.sf_story_use_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_use_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_publications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_peer_story_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_peer_story_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_peer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_peer_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_trash FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_story_trash_owner_read ON public.sf_story_trash
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['student'])
  AND student_id = public.sf_actor_id()
);

CREATE POLICY sf_story_trash_admin_read ON public.sf_story_trash
FOR SELECT TO authenticated
USING (
  public.sf_admin_console_enabled()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_trash.story_id AND story.status <> 'private'
  )
);

CREATE POLICY sf_story_use_reviews_read ON public.sf_story_use_reviews
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_use_reviews.story_id
      AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id)
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

CREATE POLICY sf_story_publications_read ON public.sf_story_publications
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_publications.story_id
      AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id)
      AND public.sf_story_observable_to_actor(
        story.student_id, story.status, story.visibility, story.archived_at
      )
  )
);

CREATE POLICY sf_peer_story_grants_participant_read ON public.sf_peer_story_grants
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['student'])
  AND public.sf_story_feature_enabled('peer_share', ARRAY['student'])
  AND (owner_id = public.sf_actor_id()
    OR (recipient_id = public.sf_actor_id() AND status = 'active'))
);

CREATE POLICY sf_peer_feedback_participant_read ON public.sf_peer_feedback
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity(ARRAY['student'])
  AND public.sf_story_feature_enabled('peer_share', ARRAY['student'])
  AND EXISTS (
    SELECT 1 FROM public.sf_peer_story_grants grant_row
    WHERE grant_row.id = sf_peer_feedback.grant_id
      AND (grant_row.owner_id = public.sf_actor_id()
        OR (grant_row.recipient_id = public.sf_actor_id() AND grant_row.status = 'active'))
  )
);

REVOKE ALL ON public.sf_story_trash, public.sf_story_use_reviews, public.sf_story_publications,
  public.sf_peer_story_grants, public.sf_peer_feedback
  FROM PUBLIC, anon, authenticated, storyforge_app;
GRANT SELECT ON public.sf_story_trash, public.sf_story_use_reviews, public.sf_story_publications,
  public.sf_peer_story_grants, public.sf_peer_feedback TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_forbid_peer_feedback_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'peer feedback is append-only' USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER sf_peer_feedback_append_only
BEFORE UPDATE OR DELETE ON public.sf_peer_feedback
FOR EACH ROW EXECUTE FUNCTION public.sf_forbid_peer_feedback_mutation();

INSERT INTO public.sf_feature_flags (key, scope, allowlist, cohorts, updated_by, updated_at)
SELECT feature.key, 'off', ARRAY[]::uuid[], ARRAY[]::text[], founder.updated_by,
       timestamptz '2026-08-12 12:00:00+00'
FROM (VALUES
  ('story_archive'), ('story_promotions'), ('per_use_scoring'), ('peer_share')
) AS feature(key)
CROSS JOIN (
  SELECT updated_by FROM public.sf_feature_flags WHERE key = 'admin_console'
) founder;

CREATE OR REPLACE FUNCTION public.sf_set_story_collection(
  p_story_id uuid,
  p_expected_version bigint,
  p_collection text,
  p_surface text DEFAULT 'library'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_after public.sf_stories;
  v_before_trashed_at timestamptz;
  v_owner boolean;
  v_admin boolean;
BEGIN
  IF p_collection NOT IN ('active', 'archived', 'trashed') THEN
    RAISE EXCEPTION 'invalid story collection' USING ERRCODE = '22023';
  END IF;
  IF p_surface NOT IN ('library', 'workspace') THEN
    RAISE EXCEPTION 'invalid StoryForge surface' USING ERRCODE = '22023';
  END IF;
  IF NOT public.sf_has_live_identity(ARRAY['student', 'admin']) THEN
    RAISE EXCEPTION 'eligible StoryForge identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sf_story_feature_enabled('story_archive', ARRAY['student', 'admin']) THEN
    RAISE EXCEPTION 'story collections disabled' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before FROM public.sf_stories WHERE id = p_story_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  v_owner := public.sf_actor_role() = 'student' AND v_before.student_id = public.sf_actor_id();
  v_admin := public.sf_actor_role() = 'admin'
    AND public.sf_admin_console_enabled()
    AND v_before.status <> 'private';
  IF NOT v_owner AND NOT v_admin THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;

  SELECT trashed_at INTO v_before_trashed_at
  FROM public.sf_story_trash WHERE story_id = p_story_id FOR UPDATE;

  IF p_collection = 'trashed' THEN
    INSERT INTO public.sf_story_trash (story_id, student_id, trashed_by)
    VALUES (v_before.id, v_before.student_id, public.sf_actor_id())
    ON CONFLICT (story_id) DO NOTHING;
  ELSE
    DELETE FROM public.sf_story_trash WHERE story_id = p_story_id;
  END IF;

  UPDATE public.sf_stories
  SET archived_at = CASE WHEN p_collection = 'archived' THEN now() ELSE NULL END,
      archived_by = CASE WHEN p_collection = 'archived' THEN public.sf_actor_id() ELSE NULL END,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_after;

  PERFORM public.sf_append_audit(
    'story.collection_changed', 'story', v_after.id, p_surface,
    v_after.student_id, v_after.id, NULL,
    jsonb_build_object(
      'collection', CASE WHEN v_before_trashed_at IS NOT NULL THEN 'trashed'
                         WHEN v_before.archived_at IS NOT NULL THEN 'archived' ELSE 'active' END
    ),
    jsonb_build_object('collection', p_collection), NULL,
    CASE WHEN v_admin THEN 'admin_only' ELSE 'both' END
  );
  RETURN to_jsonb(v_after) || jsonb_build_object(
    'collection', p_collection,
    'trashedAt', CASE WHEN p_collection = 'trashed' THEN (
      SELECT trashed_at FROM public.sf_story_trash WHERE story_id = p_story_id
    ) ELSE NULL END
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_save_use_reviews(
  p_story_id uuid,
  p_expected_version bigint,
  p_reviews jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_item jsonb;
  v_use text;
  v_qualifies boolean;
  v_score smallint;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('per_use_scoring', ARRAY['admin']) THEN
    RAISE EXCEPTION 'per-use scoring disabled' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_reviews) <> 'array' OR jsonb_array_length(p_reviews) > 6 THEN
    RAISE EXCEPTION 'invalid per-use reviews' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = p_story_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_story.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_reviews) LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_item) key WHERE key NOT IN ('useId','qualifies','score')) THEN
      RAISE EXCEPTION 'invalid per-use review item' USING ERRCODE = '22023';
    END IF;
    v_use := v_item->>'useId';
    IF v_use IS NULL OR v_use NOT IN ('ps','iv','letter','myeras_experiences','myeras_most_impactful','later')
      OR v_use = ANY(v_seen) THEN
      RAISE EXCEPTION 'invalid or duplicate intended use' USING ERRCODE = '22023';
    END IF;
    v_seen := array_append(v_seen, v_use);
    v_qualifies := coalesce((v_item->>'qualifies')::boolean, false);
    v_score := CASE WHEN v_item->'score' IS NULL OR v_item->'score' = 'null'::jsonb
      THEN NULL ELSE (v_item->>'score')::smallint END;
    IF v_score IS NOT NULL AND (v_score < 1 OR v_score > 5) THEN
      RAISE EXCEPTION 'invalid per-use score' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.sf_story_use_reviews (
      story_id, use_id, qualifies, score, reviewer_id
    ) VALUES (
      p_story_id, v_use, v_qualifies, v_score, public.sf_actor_id()
    )
    ON CONFLICT (story_id, use_id) DO UPDATE
      SET qualifies = EXCLUDED.qualifies,
          score = EXCLUDED.score,
          reviewer_id = EXCLUDED.reviewer_id,
          row_version = public.sf_story_use_reviews.row_version + 1,
          updated_at = now();
  END LOOP;

  UPDATE public.sf_stories
  SET row_version = row_version + 1, updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  PERFORM public.sf_append_audit(
    'admin.story_use_reviews_saved', 'story', p_story_id, 'workspace',
    v_story.student_id, p_story_id, NULL, NULL,
    jsonb_build_object('uses', v_seen), NULL, 'admin_only'
  );
  RETURN jsonb_build_object(
    'storyId', p_story_id,
    'rowVersion', v_story.row_version,
    'reviews', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'useId', review.use_id, 'qualifies', review.qualifies,
        'score', review.score, 'reviewerId', review.reviewer_id,
        'rowVersion', review.row_version, 'updatedAt', review.updated_at
      ) ORDER BY review.use_id)
      FROM public.sf_story_use_reviews review WHERE review.story_id = p_story_id
    ), '[]'::jsonb)
  );
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_story_publication(
  p_story_id uuid,
  p_expected_version bigint,
  p_destination text,
  p_active boolean,
  p_confirm_replace boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_existing public.sf_story_publications;
  v_result public.sf_story_publications;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('story_promotions', ARRAY['admin']) THEN
    RAISE EXCEPTION 'story promotions disabled' USING ERRCODE = '42501';
  END IF;
  IF p_destination NOT IN ('personal_statement', 'iv_prep_on_call') THEN
    RAISE EXCEPTION 'invalid publication destination' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = p_story_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_story.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_existing FROM public.sf_story_publications
  WHERE student_id = v_story.student_id AND destination = p_destination AND active
  FOR UPDATE;

  IF p_active THEN
    IF FOUND AND v_existing.story_id <> p_story_id AND NOT p_confirm_replace THEN
      RAISE EXCEPTION 'publication replacement confirmation required' USING ERRCODE = '40001';
    END IF;
    IF FOUND AND v_existing.story_id <> p_story_id THEN
      UPDATE public.sf_story_publications
      SET active = false, revoked_by = public.sf_actor_id(), revoked_at = now(),
          row_version = row_version + 1, updated_at = now()
      WHERE id = v_existing.id;
      PERFORM public.sf_append_audit(
        'admin.story_publication_replaced', 'story', v_existing.story_id, 'workspace',
        v_story.student_id, v_existing.story_id, NULL,
        jsonb_build_object('destination', p_destination, 'active', true),
        jsonb_build_object('destination', p_destination, 'active', false), NULL, 'admin_only'
      );
    ELSIF FOUND AND v_existing.story_id = p_story_id THEN
      RETURN to_jsonb(v_existing) || jsonb_build_object('storyRowVersion', v_story.row_version);
    END IF;
    INSERT INTO public.sf_story_publications (
      story_id, student_id, destination, activated_by
    ) VALUES (p_story_id, v_story.student_id, p_destination, public.sf_actor_id())
    RETURNING * INTO v_result;
  ELSE
    IF NOT FOUND OR v_existing.story_id <> p_story_id THEN
      RAISE EXCEPTION 'active publication not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.sf_story_publications
    SET active = false, revoked_by = public.sf_actor_id(), revoked_at = now(),
        row_version = row_version + 1, updated_at = now()
    WHERE id = v_existing.id RETURNING * INTO v_result;
  END IF;

  UPDATE public.sf_stories
  SET row_version = row_version + 1, updated_at = now()
  WHERE id = p_story_id
  RETURNING * INTO v_story;

  PERFORM public.sf_append_audit(
    CASE WHEN p_active THEN 'admin.story_published' ELSE 'admin.story_publication_revoked' END,
    'story', p_story_id, 'workspace', v_story.student_id, p_story_id, NULL,
    NULL, jsonb_build_object('destination', p_destination, 'active', p_active),
    NULL, 'admin_only'
  );
  RETURN to_jsonb(v_result) || jsonb_build_object('storyRowVersion', v_story.row_version);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_candidates()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor public.sf_users;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_actor FROM public.sf_users WHERE id = public.sf_actor_id();
  IF v_actor.cohort IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', peer.id, 'displayName', peer.display_name) ORDER BY peer.display_name, peer.id)
    FROM public.sf_users peer
    WHERE peer.role = 'student' AND peer.eligible AND peer.id <> v_actor.id AND peer.cohort = v_actor.cohort
  ), '[]'::jsonb);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_share_story(
  p_story_id uuid,
  p_expected_version bigint,
  p_recipient_ids uuid[],
  p_confirm_private boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_owner public.sf_users;
  v_recipient public.sf_users;
  v_recipient_id uuid;
  v_grants jsonb := '[]'::jsonb;
  v_grant public.sf_peer_story_grants;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_ids IS NULL OR cardinality(p_recipient_ids) NOT BETWEEN 1 AND 10
    OR cardinality(p_recipient_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(p_recipient_ids))) THEN
    RAISE EXCEPTION 'invalid peer recipients' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_owner FROM public.sf_users WHERE id = public.sf_actor_id();
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND student_id = public.sf_actor_id()
    AND archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = p_story_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_story.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  IF v_owner.cohort IS NULL THEN
    RAISE EXCEPTION 'verified cohort required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(v_story.visibility, 'private') = 'private' AND NOT p_confirm_private THEN
    RAISE EXCEPTION 'private story sharing confirmation required' USING ERRCODE = '42501';
  END IF;

  FOREACH v_recipient_id IN ARRAY p_recipient_ids LOOP
    SELECT * INTO v_recipient FROM public.sf_users
    WHERE id = v_recipient_id AND role = 'student' AND eligible
      AND cohort = v_owner.cohort AND id <> v_owner.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'peer recipient unavailable' USING ERRCODE = 'P0002'; END IF;
    INSERT INTO public.sf_peer_story_grants (
      story_id, owner_id, recipient_id, cohort_snapshot, private_confirmed
    ) VALUES (
      p_story_id, v_owner.id, v_recipient.id, v_owner.cohort,
      p_confirm_private AND coalesce(v_story.visibility, 'private') = 'private'
    )
    ON CONFLICT (story_id, recipient_id) WHERE status = 'active'
    DO UPDATE SET row_version = public.sf_peer_story_grants.row_version + 1
    RETURNING * INTO v_grant;
    v_grants := v_grants || jsonb_build_array(jsonb_build_object(
      'id', v_grant.id, 'recipientId', v_grant.recipient_id,
      'status', v_grant.status, 'grantedAt', v_grant.granted_at
    ));
  END LOOP;
  PERFORM public.sf_append_audit(
    'story.peer_shared', 'story', p_story_id, 'workspace', v_story.student_id,
    p_story_id, NULL, NULL,
    jsonb_build_object('recipientCount', cardinality(p_recipient_ids), 'privateConfirmed', p_confirm_private),
    NULL, 'both'
  );
  RETURN jsonb_build_object('storyId', p_story_id, 'grants', v_grants);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_revoke_grant(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_grant public.sf_peer_story_grants;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sf_peer_story_grants
  SET status = 'revoked', revoked_at = now(), row_version = row_version + 1
  WHERE id = p_grant_id AND owner_id = public.sf_actor_id() AND status = 'active'
  RETURNING * INTO v_grant;
  IF NOT FOUND THEN RAISE EXCEPTION 'peer grant not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.sf_append_audit(
    'story.peer_share_revoked', 'story', v_grant.story_id, 'workspace',
    v_grant.owner_id, v_grant.story_id, NULL, NULL,
    jsonb_build_object('grantId', v_grant.id), NULL, 'both'
  );
  RETURN jsonb_build_object('id', v_grant.id, 'status', v_grant.status, 'revokedAt', v_grant.revoked_at);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_inbox()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'grantId', grant_row.id, 'storyId', story.id, 'ownerId', grant_row.owner_id,
      'ownerName', owner_user.display_name, 'title', story.title,
      'grantedAt', grant_row.granted_at, 'feedbackCount', (
        SELECT count(*) FROM public.sf_peer_feedback feedback WHERE feedback.grant_id = grant_row.id
      )
    ) ORDER BY grant_row.granted_at DESC, grant_row.id DESC)
    FROM public.sf_peer_story_grants grant_row
    JOIN public.sf_stories story ON story.id = grant_row.story_id
    JOIN public.sf_users owner_user ON owner_user.id = grant_row.owner_id
    WHERE grant_row.recipient_id = public.sf_actor_id() AND grant_row.status = 'active'
      AND story.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id)
  ), '[]'::jsonb);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_outbox()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'grantId', grant_row.id, 'storyId', story.id, 'title', story.title,
      'recipientId', grant_row.recipient_id, 'recipientName', recipient.display_name,
      'status', grant_row.status, 'grantedAt', grant_row.granted_at,
      'revokedAt', grant_row.revoked_at, 'feedback', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', feedback.id, 'body', feedback.body,
          'authorName', feedback_author.display_name, 'createdAt', feedback.created_at
        ) ORDER BY feedback.created_at, feedback.id)
        FROM public.sf_peer_feedback feedback
        JOIN public.sf_users feedback_author ON feedback_author.id = feedback.author_id
        WHERE feedback.grant_id = grant_row.id
      ), '[]'::jsonb)
    ) ORDER BY grant_row.granted_at DESC, grant_row.id DESC)
    FROM public.sf_peer_story_grants grant_row
    JOIN public.sf_stories story ON story.id = grant_row.story_id
    JOIN public.sf_users recipient ON recipient.id = grant_row.recipient_id
    WHERE grant_row.owner_id = public.sf_actor_id()
  ), '[]'::jsonb);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_story_view(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'grantId', grant_row.id, 'storyId', story.id,
    'ownerName', owner_user.display_name, 'title', story.title,
    'text', story.current_text, 'lesson', story.lesson,
    'feedback', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', feedback.id, 'body', feedback.body, 'authorName', author.display_name,
      'createdAt', feedback.created_at
    ) ORDER BY feedback.created_at, feedback.id)
      FROM public.sf_peer_feedback feedback JOIN public.sf_users author ON author.id = feedback.author_id
      WHERE feedback.grant_id = grant_row.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.sf_peer_story_grants grant_row
  JOIN public.sf_stories story ON story.id = grant_row.story_id
  JOIN public.sf_users owner_user ON owner_user.id = grant_row.owner_id
  WHERE grant_row.id = p_grant_id AND grant_row.recipient_id = public.sf_actor_id()
    AND grant_row.status = 'active' AND story.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id);
  IF v_result IS NULL THEN RAISE EXCEPTION 'peer grant not found' USING ERRCODE = 'P0002'; END IF;
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_add_feedback(p_grant_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_grant public.sf_peer_story_grants; v_feedback public.sf_peer_feedback;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_body, ''))) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'invalid peer feedback' USING ERRCODE = '22023';
  END IF;
  SELECT grant_row.* INTO v_grant FROM public.sf_peer_story_grants grant_row
  JOIN public.sf_stories story ON story.id = grant_row.story_id
  WHERE grant_row.id = p_grant_id AND grant_row.recipient_id = public.sf_actor_id()
    AND grant_row.status = 'active' AND story.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id)
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'peer grant not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.sf_peer_feedback (grant_id, story_id, author_id, body)
  VALUES (v_grant.id, v_grant.story_id, public.sf_actor_id(), trim(p_body))
  RETURNING * INTO v_feedback;
  PERFORM public.sf_append_audit(
    'story.peer_feedback_added', 'story', v_grant.story_id, 'workspace',
    v_grant.owner_id, v_grant.story_id, NULL, NULL,
    jsonb_build_object('feedbackId', v_feedback.id), NULL, 'both'
  );
  RETURN jsonb_build_object('id', v_feedback.id, 'body', v_feedback.body, 'createdAt', v_feedback.created_at);
END
$$;

CREATE OR REPLACE FUNCTION public.sf_peer_audio_claim(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.sf_story_feature_enabled('peer_share', ARRAY['student']) THEN
    RAISE EXCEPTION 'peer sharing disabled' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'audioId', audio.id, 'objectKey', audio.object_key,
    'contentType', audio.content_type, 'durationMs', audio.duration_ms,
    'byteSize', audio.byte_size
  ) INTO v_result
  FROM public.sf_peer_story_grants grant_row
  JOIN public.sf_stories story ON story.id = grant_row.story_id
  JOIN LATERAL (
    SELECT asset.* FROM public.sf_audio_assets asset
    WHERE asset.story_id = story.id AND asset.student_id = story.student_id AND asset.state = 'verified'
    ORDER BY asset.verified_at DESC NULLS LAST, asset.created_at DESC LIMIT 1
  ) audio ON true
  WHERE grant_row.id = p_grant_id AND grant_row.recipient_id = public.sf_actor_id()
    AND grant_row.status = 'active' AND story.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = story.id);
  IF v_result IS NULL THEN RAISE EXCEPTION 'peer audio not found' USING ERRCODE = 'P0002'; END IF;
  RETURN v_result;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_admin_set_review_status_v201(
  p_story_id uuid,
  p_expected_version bigint,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_stories;
  v_after public.sf_stories;
BEGIN
  PERFORM public.sf_admin_assert_enabled();
  IF NOT public.sf_story_feature_enabled('admin_review_controls', ARRAY['admin']) THEN
    RAISE EXCEPTION 'direct administrator review controls disabled' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('awaiting', 'in_review', 'changes', 'reviewed', 'approved') THEN
    RAISE EXCEPTION 'invalid administrator review status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_before FROM public.sf_stories
  WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.sf_story_trash trash WHERE trash.story_id = p_story_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'story version conflict' USING ERRCODE = '40001';
  END IF;
  IF p_status = v_before.status THEN
    RETURN jsonb_build_object('id', v_before.id, 'status', v_before.status, 'rowVersion', v_before.row_version);
  END IF;
  UPDATE public.sf_stories
  SET status = p_status,
      reviewed_by = public.sf_actor_id(), reviewed_at = now(), status_changed_at = now(),
      approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
      revised = false, row_version = row_version + 1, updated_at = now()
  WHERE id = p_story_id RETURNING * INTO v_after;
  PERFORM public.sf_append_audit(
    'story.status_changed', 'story', p_story_id, 'workspace', v_before.student_id,
    p_story_id, NULL, jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', p_status, 'reviewer_role', 'admin'), NULL, 'both'
  );
  PERFORM public.sf_emit_notification(
    v_before.student_id, public.sf_actor_id(), p_story_id, NULL,
    'story.' || p_status, 'status', 'Story review updated',
    'The review status for “' || v_before.title || '” is now ' || replace(p_status, '_', ' ') || '.',
    '/library?story=' || p_story_id::text
  );
  RETURN jsonb_build_object(
    'id', v_after.id, 'status', v_after.status, 'rowVersion', v_after.row_version,
    'reviewedAt', v_after.reviewed_at, 'approvedAt', v_after.approved_at,
    'statusChangedAt', v_after.status_changed_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.sf_set_story_collection(uuid,bigint,text,text),
  public.sf_admin_save_use_reviews(uuid,bigint,jsonb),
  public.sf_admin_set_story_publication(uuid,bigint,text,boolean,boolean),
  public.sf_admin_set_review_status_v201(uuid,bigint,text),
  public.sf_peer_candidates(), public.sf_peer_share_story(uuid,bigint,uuid[],boolean),
  public.sf_peer_revoke_grant(uuid), public.sf_peer_inbox(), public.sf_peer_outbox(), public.sf_peer_story_view(uuid),
  public.sf_peer_add_feedback(uuid,text), public.sf_peer_audio_claim(uuid)
  FROM PUBLIC, anon, authenticated, storyforge_app;
GRANT EXECUTE ON FUNCTION public.sf_set_story_collection(uuid,bigint,text,text),
  public.sf_admin_save_use_reviews(uuid,bigint,jsonb),
  public.sf_admin_set_story_publication(uuid,bigint,text,boolean,boolean),
  public.sf_admin_set_review_status_v201(uuid,bigint,text),
  public.sf_peer_candidates(), public.sf_peer_share_story(uuid,bigint,uuid[],boolean),
  public.sf_peer_revoke_grant(uuid), public.sf_peer_inbox(), public.sf_peer_outbox(), public.sf_peer_story_view(uuid),
  public.sf_peer_add_feedback(uuid,text), public.sf_peer_audio_claim(uuid)
  TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sf_story_trash)
    OR EXISTS (SELECT 1 FROM public.sf_story_use_reviews)
    OR EXISTS (SELECT 1 FROM public.sf_story_publications)
    OR EXISTS (SELECT 1 FROM public.sf_peer_story_grants)
    OR EXISTS (SELECT 1 FROM public.sf_peer_feedback) THEN
    RAISE EXCEPTION 'B1-515 additive domain tables must begin empty';
  END IF;
END
$$;

COMMIT;
