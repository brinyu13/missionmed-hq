\set ON_ERROR_STOP on

-- Migration: B1-514 V2.1 canonical Full Story and mentor-content provenance.
-- Authority: DR-042 / DR-043. This is prospective-only: it does not backfill or
-- infer authorship for historical rows.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-514-v21-authored-segment-writes', 0));

CREATE OR REPLACE FUNCTION public.sf_capture_full_story_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_previous_text text;
BEGIN
  SELECT story.* INTO v_story
  FROM public.sf_stories story
  WHERE story.id = NEW.story_id;

  IF NOT FOUND
    OR NEW.actor_id <> v_story.student_id
    OR length(trim(coalesce(NEW.text_snapshot, ''))) = 0
    OR NOT (
      (v_story.capture_type = 'text' AND NEW.reason IN ('capture', 'student_edit', 'resubmit'))
      OR (v_story.capture_type = 'audio' AND NEW.reason IN ('student_edit', 'resubmit'))
    ) THEN
    RETURN NEW;
  END IF;

  SELECT revision.text_snapshot INTO v_previous_text
  FROM public.sf_story_revisions revision
  WHERE revision.story_id = NEW.story_id
    AND revision.id <> NEW.id
  ORDER BY revision.revision_no DESC, revision.created_at DESC, revision.id DESC
  LIMIT 1;

  -- Title-only saves and repeated status transitions are not new authored text.
  IF FOUND AND v_previous_text IS NOT DISTINCT FROM NEW.text_snapshot THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sf_authored_segments (
    story_id, source_role, source_entity_type, source_entity_id,
    body_hash, author_id
  ) VALUES (
    NEW.story_id, 'student_typed', 'story', NEW.story_id,
    encode(digest(convert_to(NEW.text_snapshot, 'UTF8'), 'sha256'), 'hex'),
    NEW.actor_id
  );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sf_story_revisions_capture_authorship
  ON public.sf_story_revisions;
CREATE TRIGGER sf_story_revisions_capture_authorship
AFTER INSERT ON public.sf_story_revisions
FOR EACH ROW EXECUTE FUNCTION public.sf_capture_full_story_authorship();

CREATE OR REPLACE FUNCTION public.sf_capture_spoken_story_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
BEGIN
  IF NEW.state <> 'attached'
    OR OLD.state = 'attached'
    OR NEW.story_id IS NULL
    OR NEW.assembled_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT story.* INTO v_story
  FROM public.sf_stories story
  WHERE story.id = NEW.story_id
    AND story.student_id = NEW.student_id
    AND story.capture_type = 'audio'
    AND NOT EXISTS (
      SELECT 1
      FROM public.sf_story_originals original
      WHERE original.story_id = story.id
    );

  IF NOT FOUND OR length(trim(coalesce(v_story.original_text, ''))) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sf_authored_segments (
    story_id, source_role, source_entity_type, source_entity_id,
    body_hash, recording_id, audio_asset_id, author_id
  ) VALUES (
    v_story.id, 'student_spoken', 'story', v_story.id,
    encode(digest(convert_to(v_story.original_text, 'UTF8'), 'sha256'), 'hex'),
    NEW.id, NEW.assembled_asset_id, NEW.student_id
  );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sf_recording_sessions_capture_authorship
  ON public.sf_recording_sessions;
CREATE TRIGGER sf_recording_sessions_capture_authorship
AFTER UPDATE OF state, story_id, assembled_asset_id ON public.sf_recording_sessions
FOR EACH ROW EXECUTE FUNCTION public.sf_capture_spoken_story_authorship();

CREATE OR REPLACE FUNCTION public.sf_capture_mentor_content_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.state = 'published'
    AND OLD.state = 'draft'
    AND NOT NEW.internal_only
    AND length(trim(coalesce(NEW.body, ''))) > 0 THEN
    INSERT INTO public.sf_authored_segments (
      story_id, source_role, source_entity_type, source_entity_id,
      body_hash, author_id
    ) VALUES (
      NEW.story_id, 'mentor_content', 'mentor_note', NEW.id,
      encode(digest(convert_to(NEW.body, 'UTF8'), 'sha256'), 'hex'),
      NEW.author_id
    );
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sf_mentor_notes_capture_authorship
  ON public.sf_mentor_notes;
CREATE TRIGGER sf_mentor_notes_capture_authorship
AFTER UPDATE OF state ON public.sf_mentor_notes
FOR EACH ROW EXECUTE FUNCTION public.sf_capture_mentor_content_authorship();

REVOKE ALL ON FUNCTION public.sf_capture_full_story_authorship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_capture_spoken_story_authorship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sf_capture_mentor_content_authorship() FROM PUBLIC, anon, authenticated;

COMMIT;
