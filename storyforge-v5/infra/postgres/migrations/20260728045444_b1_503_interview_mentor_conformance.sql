-- Migration: 20260728045444_b1_503_interview_mentor_conformance.sql
-- Authority: B1-503
-- Date: 2026-07-28
-- Depends on: 20260728045100_b1_503_story_domain_conformance.sql
-- Description: Canonical V5 interview-question, pair, follow-up, coaching, craft, and 1:1 session model.
-- Idempotent: NO

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('b1-503-interview-mentor-conformance', 0));

ALTER TABLE public.sf_questions
  ADD COLUMN IF NOT EXISTS canonical_key text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.sf_questions
  ALTER COLUMN created_by DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sf_questions_canonical_key_uidx
  ON public.sf_questions (canonical_key)
  WHERE canonical_key IS NOT NULL;

INSERT INTO public.sf_questions (
  id, canonical_key, text, family, provenance, governance_state,
  created_by, approved_by, approved_at
)
VALUES
  ('50300000-0000-4000-8000-000000000001', 'q1',  'Tell me about yourself.', 'core', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000002', 'q2',  'Tell me about a time you made a mistake.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000003', 'q3',  'Describe a conflict with a team member and how you handled it.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000004', 'q4',  'Tell me about a patient you will never forget.', 'clinical', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000005', 'q5',  'Describe a time you showed leadership.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000006', 'q6',  'Tell me about a time you struggled and how you got through it.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000007', 'q7',  'How do you respond to criticism? Give me an example.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000008', 'q8',  'Describe a time you advocated for a patient.', 'clinical', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000009', 'q9',  'Tell me about a difficult conversation you had to have.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000010', 'q10', 'Why this specialty?', 'core', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000011', 'q11', 'Tell me about a time you saw something you disagreed with.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000012', 'q12', 'What is your greatest weakness, and when has it shown up?', 'redflag', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000013', 'q13', 'Why our program?', 'core', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000014', 'q14', 'Where do you see yourself in ten years?', 'core', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000015', 'q15', 'Tell me about a time a team member wasn’t pulling their weight.', 'behavioral', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000016', 'q16', 'Walk me through a challenging clinical decision you were part of.', 'clinical', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000017', 'q17', 'Tell me about a time you were wrong about a patient.', 'clinical', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000018', 'q18', 'Describe a time you escalated care. How did you know it was time?', 'clinical', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000019', 'q19', 'I see you volunteered at a free clinic — tell me more about that.', 'cv', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000020', 'q20', 'Tell me about your research. What was your actual contribution?', 'cv', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000021', 'q21', 'Which rotation surprised you most, and why?', 'cv', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000022', 'q22', 'Your Step 2 score is below our average. What happened?', 'redflag', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000023', 'q23', 'I noticed a gap in your third year. Walk me through it.', 'redflag', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000024', 'q24', 'What do you do outside of medicine?', 'personal', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000025', 'q25', 'Who is your hero, and why?', 'personal', 'missionmed', 'approved', NULL, NULL, now()),
  ('50300000-0000-4000-8000-000000000026', 'q26', 'What will you do when medicine disappoints you?', 'personal', 'missionmed', 'approved', NULL, NULL, now())
ON CONFLICT (id) DO UPDATE
SET canonical_key = EXCLUDED.canonical_key,
    text = EXCLUDED.text,
    family = EXCLUDED.family,
    provenance = EXCLUDED.provenance,
    governance_state = EXCLUDED.governance_state,
    updated_at = now();

CREATE UNIQUE INDEX sf_questions_active_global_normalized_uidx
  ON public.sf_questions (normalized_text)
  WHERE owner_student_id IS NULL
    AND governance_state <> 'retired';

CREATE UNIQUE INDEX sf_questions_active_owner_normalized_uidx
  ON public.sf_questions (owner_student_id, normalized_text)
  WHERE owner_student_id IS NOT NULL
    AND governance_state <> 'retired';

DROP POLICY IF EXISTS sf_questions_read ON public.sf_questions;
CREATE POLICY sf_questions_read ON public.sf_questions
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND governance_state <> 'retired'
  AND (
    (
      owner_student_id IS NULL
      AND governance_state = 'approved'
    )
    OR owner_student_id = public.sf_actor_id()
    OR (
      public.sf_actor_role() = 'mentor'
      AND (
        (
          owner_student_id IS NOT NULL
          AND public.sf_is_assigned(owner_student_id)
        )
        OR (
          owner_student_id IS NULL
          AND created_by = public.sf_actor_id()
        )
      )
    )
    OR (
      public.sf_actor_role() = 'admin'
      AND owner_student_id IS NULL
    )
  )
);

CREATE OR REPLACE FUNCTION public.sf_create_custom_question(
  p_text text,
  p_family text DEFAULT 'custom',
  p_surface text DEFAULT 'library'
)
RETURNS public.sf_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := public.sf_actor_id();
  v_actor_role text := public.sf_actor_role();
  v_text text := regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g');
  v_normalized_text text;
  v_family text := lower(trim(coalesce(p_family, '')));
  v_surface text := coalesce(nullif(lower(trim(p_surface)), ''), 'library');
  v_owner_student_id uuid;
  v_duplicate_id uuid;
  v_provenance text;
  v_question public.sf_questions;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible student or mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF length(v_text) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'question text must be between 3 and 2000 characters'
      USING ERRCODE = '22023';
  END IF;
  IF NOT v_family = ANY (
    ARRAY['core', 'behavioral', 'clinical', 'cv', 'redflag', 'personal', 'custom']
  ) THEN
    RAISE EXCEPTION 'invalid question family' USING ERRCODE = '22023';
  END IF;
  IF v_surface NOT IN ('library', 'workspace', 'workshop') THEN
    RAISE EXCEPTION 'invalid custom-question surface' USING ERRCODE = '22023';
  END IF;

  v_normalized_text := lower(regexp_replace(v_text, '\s+', ' ', 'g'));
  PERFORM pg_advisory_xact_lock(
    hashtextextended('sf-custom-question:' || v_normalized_text, 0)
  );

  SELECT question.id
  INTO v_duplicate_id
  FROM public.sf_questions question
  WHERE question.normalized_text = v_normalized_text
    AND question.governance_state <> 'retired'
    AND (
      (
        v_actor_role = 'student'
        AND (
          (
            question.owner_student_id IS NULL
            AND question.governance_state = 'approved'
          )
          OR question.owner_student_id = v_actor_id
        )
      )
      OR (
        v_actor_role = 'mentor'
        AND question.owner_student_id IS NULL
      )
    )
  ORDER BY
    CASE WHEN question.governance_state = 'approved' THEN 0 ELSE 1 END,
    question.created_at,
    question.id
  LIMIT 1;
  IF v_duplicate_id IS NOT NULL THEN
    RAISE EXCEPTION 'An exact duplicate already exists in your visible question library.'
      USING ERRCODE = '23505';
  END IF;

  v_owner_student_id := CASE WHEN v_actor_role = 'student' THEN v_actor_id END;
  v_provenance := CASE WHEN v_actor_role = 'student' THEN 'student' ELSE 'mentor' END;

  INSERT INTO public.sf_questions (
    text, family, provenance, owner_student_id, governance_state, created_by,
    approved_by, approved_at
  )
  VALUES (
    v_text,
    v_family,
    v_provenance,
    v_owner_student_id,
    'draft',
    v_actor_id,
    NULL,
    NULL
  )
  RETURNING * INTO v_question;

  PERFORM public.sf_append_audit(
    'question.custom_created',
    'question',
    v_question.id,
    v_surface,
    v_owner_student_id,
    NULL,
    v_question.id,
    NULL,
    jsonb_build_object(
      'family', v_question.family,
      'provenance', v_question.provenance,
      'governance_state', v_question.governance_state
    ),
    NULL,
    CASE WHEN v_actor_role = 'student' THEN 'both' ELSE 'mentor_only' END
  );

  RETURN v_question;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_approve_question(
  p_question_id uuid,
  p_surface text DEFAULT 'library'
)
RETURNS public.sf_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_questions;
  v_question public.sf_questions;
  v_surface text := coalesce(nullif(lower(trim(p_surface)), ''), 'library');
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor', 'admin']) THEN
    RAISE EXCEPTION 'eligible mentor or admin identity required' USING ERRCODE = '42501';
  END IF;
  IF v_surface NOT IN ('library', 'import') THEN
    RAISE EXCEPTION 'invalid question-approval surface' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.sf_questions
  WHERE id = p_question_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_before.owner_student_id IS NOT NULL
     OR v_before.provenance NOT IN ('mentor', 'imported') THEN
    RAISE EXCEPTION 'only governed institutional drafts may be approved'
      USING ERRCODE = '42501';
  END IF;
  IF v_before.governance_state NOT IN ('draft', 'review') THEN
    RAISE EXCEPTION 'question is not awaiting approval' USING ERRCODE = '23514';
  END IF;

  UPDATE public.sf_questions
  SET governance_state = 'approved',
      approved_by = public.sf_actor_id(),
      approved_at = now(),
      updated_at = now()
  WHERE id = p_question_id
  RETURNING * INTO v_question;

  PERFORM public.sf_append_audit(
    'question.approved',
    'question',
    v_question.id,
    v_surface,
    NULL,
    NULL,
    v_question.id,
    jsonb_build_object(
      'governance_state', v_before.governance_state,
      'approved_by', v_before.approved_by,
      'approved_at', v_before.approved_at
    ),
    jsonb_build_object(
      'governance_state', v_question.governance_state,
      'approved_by', v_question.approved_by,
      'approved_at', v_question.approved_at
    ),
    NULL,
    'mentor_only'
  );

  RETURN v_question;
END
$$;

ALTER TABLE public.sf_import_rows
  ADD COLUMN IF NOT EXISTS family text;

ALTER TABLE public.sf_import_rows
  DROP CONSTRAINT IF EXISTS sf_import_rows_family_check;

ALTER TABLE public.sf_import_rows
  ADD CONSTRAINT sf_import_rows_family_check
  CHECK (
    family IS NULL
    OR family IN ('core', 'behavioral', 'clinical', 'cv', 'redflag', 'personal', 'custom')
  )
  NOT VALID;

ALTER TABLE public.sf_import_rows
  VALIDATE CONSTRAINT sf_import_rows_family_check;

CREATE OR REPLACE FUNCTION public.sf_question_token_similarity(
  p_left text,
  p_right text
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  WITH left_tokens AS (
    SELECT DISTINCT token
    FROM regexp_split_to_table(lower(coalesce(p_left, '')), '[^[:alnum:]]+') token
    WHERE token <> ''
  ),
  right_tokens AS (
    SELECT DISTINCT token
    FROM regexp_split_to_table(lower(coalesce(p_right, '')), '[^[:alnum:]]+') token
    WHERE token <> ''
  ),
  token_counts AS (
    SELECT
      (SELECT count(*) FROM (
        SELECT token FROM left_tokens
        INTERSECT
        SELECT token FROM right_tokens
      ) overlap_tokens)::double precision AS intersection_count,
      (SELECT count(*) FROM (
        SELECT token FROM left_tokens
        UNION
        SELECT token FROM right_tokens
      ) all_tokens)::double precision AS union_count
  )
  SELECT CASE
    WHEN union_count = 0 THEN 0
    ELSE intersection_count / union_count
  END
  FROM token_counts
$$;

REVOKE ALL ON FUNCTION public.sf_question_token_similarity(text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sf_commit_question_import(
  p_source_name text,
  p_source_format text,
  p_rows jsonb
)
RETURNS public.sf_import_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.sf_import_batches;
  v_item jsonb;
  v_row_number integer := 0;
  v_selected_count integer := 0;
  v_text text;
  v_family text;
  v_selected boolean;
  v_near_duplicate_reviewed boolean;
  v_duplicate uuid;
  v_question uuid;
  v_error text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor', 'admin']) THEN
    RAISE EXCEPTION 'mentor or admin identity required' USING ERRCODE = '42501';
  END IF;
  IF p_source_format NOT IN ('paste', 'csv', 'xlsx') THEN
    RAISE EXCEPTION 'unsupported import format' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'import rows must be an array of at most 5000 items'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_import_batches (
    source_name, source_format, state, created_by, row_count, committed_at
  )
  VALUES (
    coalesce(nullif(trim(p_source_name), ''), 'Untitled import'),
    p_source_format, 'committed', public.sf_actor_id(),
    jsonb_array_length(p_rows), now()
  )
  RETURNING * INTO v_batch;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_row_number := v_row_number + 1;
    v_text := regexp_replace(trim(coalesce(v_item->>'text', '')), '\s+', ' ', 'g');
    v_family := lower(trim(coalesce(v_item->>'family', '')));
    v_selected := coalesce((v_item->>'selected')::boolean, false);
    v_near_duplicate_reviewed :=
      coalesce((v_item->>'nearDuplicateReviewed')::boolean, false);
    v_duplicate := NULL;
    v_question := NULL;
    v_error := NULL;

    IF length(v_text) < 3 THEN
      v_error := 'Question text is too short';
    ELSIF v_text ~ '^[=+@-]' THEN
      v_error := 'Formula-like cell prefix is not importable';
    ELSIF v_family NOT IN (
      'core', 'behavioral', 'clinical', 'cv', 'redflag', 'personal', 'custom'
    ) THEN
      v_error := 'Invalid question family';
    ELSE
      SELECT id INTO v_duplicate
      FROM public.sf_questions
      WHERE normalized_text = lower(regexp_replace(v_text, '\s+', ' ', 'g'))
        AND governance_state <> 'retired'
      ORDER BY created_at, id
      LIMIT 1;
      IF v_duplicate IS NOT NULL THEN
        v_error := 'Exact duplicate';
      ELSE
        SELECT question.id INTO v_duplicate
        FROM public.sf_questions question
        WHERE question.governance_state <> 'retired'
          AND public.sf_question_token_similarity(v_text, question.text) >= 0.75
        ORDER BY
          public.sf_question_token_similarity(v_text, question.text) DESC,
          question.created_at,
          question.id
        LIMIT 1;
        IF v_duplicate IS NOT NULL
           AND v_selected
           AND NOT v_near_duplicate_reviewed THEN
          v_error := 'Possible duplicate requires explicit preview review';
        END IF;
      END IF;
    END IF;

    IF v_selected AND v_error IS NULL THEN
      INSERT INTO public.sf_questions (
        text, family, provenance, import_batch_id, governance_state, created_by
      )
      VALUES (
        v_text, v_family, 'imported', v_batch.id, 'draft', public.sf_actor_id()
      )
      RETURNING id INTO v_question;
      v_selected_count := v_selected_count + 1;
    END IF;

    INSERT INTO public.sf_import_rows (
      batch_id, row_number, raw_text, normalized_text, family,
      duplicate_question_id, selected, error, created_question_id
    )
    VALUES (
      v_batch.id, v_row_number, v_text,
      lower(regexp_replace(v_text, '\s+', ' ', 'g')),
      CASE WHEN v_family IN (
        'core', 'behavioral', 'clinical', 'cv', 'redflag', 'personal', 'custom'
      ) THEN v_family ELSE NULL END,
      v_duplicate, v_selected, v_error, v_question
    );
  END LOOP;

  PERFORM public.sf_append_audit(
    'question_import.committed',
    'import_batch',
    v_batch.id,
    'import',
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'source_format', v_batch.source_format,
      'row_count', v_batch.row_count,
      'selected_count', v_selected_count
    ),
    NULL,
    'mentor_only'
  );
  RETURN v_batch;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_rollback_question_import(p_batch_id uuid)
RETURNS public.sf_import_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.sf_import_batches;
  v_retired integer;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor', 'admin']) THEN
    RAISE EXCEPTION 'mentor or admin identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_batch
  FROM public.sf_import_batches
  WHERE id = p_batch_id
    AND (created_by = public.sf_actor_id() OR public.sf_actor_role() = 'admin')
  FOR UPDATE;
  IF NOT FOUND OR v_batch.state <> 'committed' THEN
    RAISE EXCEPTION 'committed import batch not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.sf_questions question
  WHERE question.import_batch_id = p_batch_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.sf_questions question
    WHERE question.import_batch_id = p_batch_id
      AND question.governance_state <> 'draft'
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_story_questions pair ON pair.question_id = question.id
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_workshops workshop
      ON question.id IN (
        workshop.question_a_id,
        workshop.question_b_id,
        workshop.preferred_question_id
      )
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_question_preferences preference
      ON preference.question_id = question.id
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_question_coaching_notes note
      ON note.question_id = question.id
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_coaching_session_items item
      ON item.question_id = question.id
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_audit_events event
      ON event.question_id = question.id
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_notifications notification
      ON notification.question_id = question.id
    WHERE question.import_batch_id = p_batch_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sf_questions question
    JOIN public.sf_import_rows import_row
      ON import_row.duplicate_question_id = question.id
     AND import_row.batch_id <> p_batch_id
    WHERE question.import_batch_id = p_batch_id
  ) THEN
    RAISE EXCEPTION 'import rollback is unavailable after approval or downstream use'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.sf_questions
  SET governance_state = 'retired',
      updated_at = now()
  WHERE import_batch_id = p_batch_id
    AND governance_state <> 'retired';
  GET DIAGNOSTICS v_retired = ROW_COUNT;

  UPDATE public.sf_import_batches
  SET state = 'rolled_back',
      rolled_back_at = now()
  WHERE id = p_batch_id
  RETURNING * INTO v_batch;

  PERFORM public.sf_append_audit(
    'question_import.rolled_back',
    'import_batch',
    v_batch.id,
    'import',
    NULL,
    NULL,
    NULL,
    jsonb_build_object('state', 'committed'),
    jsonb_build_object('state', 'rolled_back', 'retired_question_count', v_retired),
    NULL,
    'mentor_only'
  );
  RETURN v_batch;
END
$$;

ALTER TABLE public.sf_story_questions
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'suggested'
    CHECK (state IN ('suggested', 'confirmed', 'rejected', 'removed')),
  ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS proposed_role text
    CHECK (proposed_role IS NULL OR proposed_role IN ('student', 'mentor', 'admin')),
  ADD COLUMN IF NOT EXISTS why text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clinical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0);

UPDATE public.sf_story_questions
SET state = CASE WHEN mentor_confirmed THEN 'confirmed' ELSE 'suggested' END,
    proposed_role = CASE WHEN student_proposed THEN 'student' ELSE 'mentor' END
WHERE state = 'suggested'
  AND (mentor_confirmed OR proposed_role IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS sf_story_questions_id_uidx
  ON public.sf_story_questions (id);
CREATE INDEX IF NOT EXISTS sf_story_questions_question_state_idx
  ON public.sf_story_questions (question_id, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.sf_question_preferences (
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  set_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0),
  set_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.sf_question_coaching_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  question_id uuid NOT NULL REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_question_coaching_student_question_idx
  ON public.sf_question_coaching_notes (student_id, question_id, created_at);

CREATE TABLE IF NOT EXISTS public.sf_pair_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_question_id uuid NOT NULL REFERENCES public.sf_story_questions(id) ON DELETE RESTRICT,
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 3 AND 2000),
  source text NOT NULL CHECK (source IN ('student', 'mentor', 'ai')),
  clinical boolean NOT NULL DEFAULT false,
  prepared boolean NOT NULL DEFAULT false,
  preparation_note text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  removed_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0)
);

CREATE INDEX IF NOT EXISTS sf_pair_followups_pair_order_idx
  ON public.sf_pair_followups (story_question_id, removed_at, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.sf_story_craft (
  story_id uuid PRIMARY KEY REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  detail smallint CHECK (detail BETWEEN 1 AND 3),
  stakes smallint CHECK (stakes BETWEEN 1 AND 3),
  turn smallint CHECK (turn BETWEEN 1 AND 3),
  honest smallint CHECK (honest BETWEEN 1 AND 3),
  lesson smallint CHECK (lesson BETWEEN 1 AND 3),
  scored_by uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  scored_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0)
);

CREATE TABLE IF NOT EXISTS public.sf_coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  mentor_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'completed', 'cancelled')),
  summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0 CHECK (row_version >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS sf_coaching_sessions_active_uidx
  ON public.sf_coaching_sessions (student_id, mentor_id)
  WHERE state = 'active';

CREATE TABLE IF NOT EXISTS public.sf_coaching_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sf_coaching_sessions(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 500),
  story_id uuid REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
  question_id uuid REFERENCES public.sf_questions(id) ON DELETE RESTRICT,
  route text,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_coaching_items_session_order_idx
  ON public.sf_coaching_session_items (session_id, sort_order, created_at);

ALTER TABLE public.sf_ai_suggestions
  ADD COLUMN IF NOT EXISTS story_question_id uuid REFERENCES public.sf_story_questions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.sf_question_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_question_coaching_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_pair_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_story_craft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_coaching_session_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sf_can_work_with_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sf_has_live_identity()
    AND (
      (public.sf_actor_role() = 'student' AND p_student_id = public.sf_actor_id())
      OR (
        public.sf_actor_role() = 'mentor'
        AND public.sf_is_assigned(p_student_id)
      )
    )
$$;

DROP POLICY IF EXISTS sf_audit_read ON public.sf_audit_events;
CREATE POLICY sf_audit_read ON public.sf_audit_events
FOR SELECT TO authenticated
USING (
  public.sf_has_live_identity()
  AND (
    (
      public.sf_actor_role() = 'student'
      AND visibility = 'both'
      AND (
        student_id = public.sf_actor_id()
        OR (
          student_id IS NULL
          AND story_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.sf_stories story
            WHERE story.id = sf_audit_events.story_id
              AND story.student_id = public.sf_actor_id()
          )
        )
        OR (
          student_id IS NULL
          AND story_id IS NULL
          AND actor_id = public.sf_actor_id()
        )
      )
    )
    OR (
      public.sf_actor_role() = 'mentor'
      AND (
        (
          student_id IS NOT NULL
          AND public.sf_is_assigned(student_id)
        )
        OR (
          student_id IS NULL
          AND story_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.sf_stories story
            WHERE story.id = sf_audit_events.story_id
              AND public.sf_is_assigned(story.student_id)
          )
        )
        OR (
          student_id IS NULL
          AND story_id IS NULL
          AND actor_id = public.sf_actor_id()
        )
      )
    )
    OR (
      public.sf_actor_role() = 'admin'
      AND student_id IS NULL
      AND story_id IS NULL
      AND actor_id = public.sf_actor_id()
    )
  )
);

DROP POLICY IF EXISTS sf_question_preferences_read ON public.sf_question_preferences;
CREATE POLICY sf_question_preferences_read ON public.sf_question_preferences
FOR SELECT TO authenticated
USING (
  public.sf_can_work_with_student(student_id)
  AND (
    student_id = public.sf_actor_id()
    OR EXISTS (
      SELECT 1 FROM public.sf_stories story
      WHERE story.id = sf_question_preferences.story_id
        AND story.status <> 'private'
        AND story.archived_at IS NULL
    )
  )
);

DROP POLICY IF EXISTS sf_question_coaching_notes_read ON public.sf_question_coaching_notes;
CREATE POLICY sf_question_coaching_notes_read ON public.sf_question_coaching_notes
FOR SELECT TO authenticated
USING (public.sf_can_work_with_student(student_id));

DROP POLICY IF EXISTS sf_pair_followups_read ON public.sf_pair_followups;
CREATE POLICY sf_pair_followups_read ON public.sf_pair_followups
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sf_story_questions pair
    JOIN public.sf_stories story ON story.id = pair.story_id
    WHERE pair.id = sf_pair_followups.story_question_id
      AND story.archived_at IS NULL
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_story_craft_read ON public.sf_story_craft;
CREATE POLICY sf_story_craft_read ON public.sf_story_craft
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sf_stories story
    WHERE story.id = sf_story_craft.story_id
      AND story.archived_at IS NULL
      AND (
        story.student_id = public.sf_actor_id()
        OR (
          public.sf_actor_role() = 'mentor'
          AND story.status <> 'private'
          AND public.sf_is_assigned(story.student_id)
        )
      )
  )
);

DROP POLICY IF EXISTS sf_coaching_sessions_read ON public.sf_coaching_sessions;
CREATE POLICY sf_coaching_sessions_read ON public.sf_coaching_sessions
FOR SELECT TO authenticated
USING (public.sf_can_work_with_student(student_id));

DROP POLICY IF EXISTS sf_coaching_session_items_read ON public.sf_coaching_session_items;
CREATE POLICY sf_coaching_session_items_read ON public.sf_coaching_session_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sf_coaching_sessions session
    WHERE session.id = sf_coaching_session_items.session_id
      AND public.sf_can_work_with_student(session.student_id)
  )
);

REVOKE ALL ON public.sf_question_preferences, public.sf_question_coaching_notes,
  public.sf_pair_followups, public.sf_story_craft, public.sf_coaching_sessions,
  public.sf_coaching_session_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sf_question_preferences, public.sf_question_coaching_notes,
  public.sf_pair_followups, public.sf_story_craft, public.sf_coaching_sessions,
  public.sf_coaching_session_items
  TO authenticated;

CREATE OR REPLACE FUNCTION public.sf_upsert_story_question(
  p_story_id uuid,
  p_question_id uuid,
  p_patch jsonb DEFAULT '{}'::jsonb,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_story_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_pair public.sf_story_questions;
  v_role text;
  v_strength smallint;
  v_actor_name text;
  v_question_text text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible student or mentor identity required' USING ERRCODE = '42501';
  END IF;
  v_role := public.sf_actor_role();
  v_strength := nullif(p_patch->>'strength', '')::smallint;
  IF v_strength IS NOT NULL AND v_strength NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'pair strength must be 1..5' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = p_story_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND
     OR (v_role = 'student' AND v_story.student_id <> public.sf_actor_id())
     OR (
       v_role = 'mentor'
       AND (v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id))
     ) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT text INTO v_question_text
  FROM public.sf_questions
  WHERE id = p_question_id
    AND governance_state <> 'retired'
    AND (
      governance_state = 'approved'
      OR owner_student_id = v_story.student_id
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'question not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sf_story_questions (
    story_id, question_id, student_strength, mentor_strength,
    student_proposed, mentor_confirmed, state, proposed_by, proposed_role,
    why, clinical, confirmed_by, confirmed_at, updated_at
  )
  VALUES (
    p_story_id, p_question_id,
    CASE WHEN v_role = 'student' THEN v_strength ELSE NULL END,
    CASE WHEN v_role = 'mentor' THEN v_strength ELSE NULL END,
    v_role = 'student',
    v_role = 'mentor',
    CASE WHEN v_role = 'mentor' THEN 'confirmed' ELSE 'suggested' END,
    public.sf_actor_id(), v_role,
    coalesce(p_patch->>'why', ''),
    coalesce((p_patch->>'clinical')::boolean, false),
    CASE WHEN v_role = 'mentor' THEN public.sf_actor_id() ELSE NULL END,
    CASE WHEN v_role = 'mentor' THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (story_id, question_id) DO UPDATE
  SET student_strength = CASE
        WHEN v_role = 'student' AND p_patch ? 'strength' THEN v_strength
        ELSE sf_story_questions.student_strength
      END,
      mentor_strength = CASE
        WHEN v_role = 'mentor' AND p_patch ? 'strength' THEN v_strength
        ELSE sf_story_questions.mentor_strength
      END,
      student_notes = CASE
        WHEN v_role = 'student' AND p_patch ? 'notes' THEN p_patch->>'notes'
        ELSE sf_story_questions.student_notes
      END,
      mentor_notes = CASE
        WHEN v_role = 'mentor' AND p_patch ? 'notes' THEN p_patch->>'notes'
        ELSE sf_story_questions.mentor_notes
      END,
      why = CASE WHEN p_patch ? 'why' THEN coalesce(p_patch->>'why', '') ELSE sf_story_questions.why END,
      clinical = CASE WHEN p_patch ? 'clinical' THEN (p_patch->>'clinical')::boolean ELSE sf_story_questions.clinical END,
      state = CASE
        WHEN v_role = 'mentor' THEN 'confirmed'
        WHEN sf_story_questions.state IN ('removed', 'rejected') THEN 'suggested'
        ELSE sf_story_questions.state
      END,
      student_proposed = sf_story_questions.student_proposed OR v_role = 'student',
      mentor_confirmed = sf_story_questions.mentor_confirmed OR v_role = 'mentor',
      confirmed_by = CASE WHEN v_role = 'mentor' THEN public.sf_actor_id() ELSE sf_story_questions.confirmed_by END,
      confirmed_at = CASE WHEN v_role = 'mentor' THEN now() ELSE sf_story_questions.confirmed_at END,
      rejected_by = NULL,
      rejected_at = NULL,
      rejection_reason = NULL,
      removed_by = NULL,
      removed_at = NULL,
      row_version = sf_story_questions.row_version + 1,
      updated_at = now()
  RETURNING * INTO v_pair;

  PERFORM public.sf_append_audit(
    CASE WHEN v_role = 'mentor' THEN 'question.assigned' ELSE 'question.suggested' END,
    'story_question', v_pair.id, p_surface, v_story.student_id, v_story.id,
    p_question_id, NULL,
    jsonb_build_object(
      'state', v_pair.state,
      'student_strength', v_pair.student_strength,
      'mentor_strength', v_pair.mentor_strength,
      'why', v_pair.why
    )
  );

  IF v_role = 'mentor' THEN
    SELECT display_name INTO v_actor_name FROM public.sf_users WHERE id = public.sf_actor_id();
    PERFORM public.sf_emit_notification(
      v_story.student_id, public.sf_actor_id(), v_story.id, p_question_id,
      'question.assigned', 'questions', 'Interview question assigned',
      v_actor_name || ' assigned “' || v_story.title || '” to an interview question.',
      '/prep?question=' || p_question_id::text
    );
  END IF;

  RETURN v_pair;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_review_story_question(
  p_pair_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_story_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pair public.sf_story_questions;
  v_story public.sf_stories;
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('confirmed', 'rejected') THEN
    RAISE EXCEPTION 'invalid pair decision' USING ERRCODE = '22023';
  END IF;

  SELECT pair.*
  INTO v_pair
  FROM public.sf_story_questions pair
  JOIN public.sf_stories story ON story.id = pair.story_id
  WHERE pair.id = p_pair_id
    AND story.status <> 'private'
    AND story.archived_at IS NULL
    AND public.sf_is_assigned(story.student_id)
  FOR UPDATE OF pair, story;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story-question pair not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO STRICT v_story
  FROM public.sf_stories
  WHERE id = v_pair.story_id;

  UPDATE public.sf_story_questions
  SET state = p_decision,
      mentor_confirmed = p_decision = 'confirmed',
      confirmed_by = CASE WHEN p_decision = 'confirmed' THEN public.sf_actor_id() ELSE NULL END,
      confirmed_at = CASE WHEN p_decision = 'confirmed' THEN now() ELSE NULL END,
      rejected_by = CASE WHEN p_decision = 'rejected' THEN public.sf_actor_id() ELSE NULL END,
      rejected_at = CASE WHEN p_decision = 'rejected' THEN now() ELSE NULL END,
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN nullif(trim(p_reason), '') ELSE NULL END,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_pair_id
  RETURNING * INTO v_pair;

  PERFORM public.sf_append_audit(
    'question.' || p_decision, 'story_question', v_pair.id, p_surface,
    v_story.student_id, v_story.id, v_pair.question_id, NULL,
    jsonb_build_object('state', v_pair.state, 'reason', v_pair.rejection_reason)
  );

  SELECT display_name INTO v_actor_name FROM public.sf_users WHERE id = public.sf_actor_id();
  PERFORM public.sf_emit_notification(
    v_story.student_id, public.sf_actor_id(), v_story.id, v_pair.question_id,
    'question.' || p_decision, 'questions',
    CASE WHEN p_decision = 'confirmed' THEN 'Interview answer confirmed' ELSE 'Interview answer adjusted' END,
    CASE
      WHEN p_decision = 'confirmed'
        THEN v_actor_name || ' confirmed “' || v_story.title || '” as an interview answer.'
      ELSE v_actor_name || ' suggested a different story for an interview question — see the workshop.'
    END,
    '/prep?question=' || v_pair.question_id::text
  );
  RETURN v_pair;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_remove_story_question(
  p_pair_id uuid,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_story_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pair public.sf_story_questions;
  v_story public.sf_stories;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pair FROM public.sf_story_questions WHERE id = p_pair_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'story-question pair not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = v_pair.story_id
    AND archived_at IS NULL;
  IF NOT FOUND
     OR (public.sf_actor_role() = 'student' AND v_story.student_id <> public.sf_actor_id())
     OR (
       public.sf_actor_role() = 'mentor'
       AND (v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id))
     ) THEN
    RAISE EXCEPTION 'story-question pair not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.sf_story_questions
  SET state = 'removed',
      mentor_confirmed = false,
      removed_by = public.sf_actor_id(),
      removed_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_pair_id
  RETURNING * INTO v_pair;

  PERFORM public.sf_append_audit(
    'question.removed', 'story_question', v_pair.id, p_surface,
    v_story.student_id, v_story.id, v_pair.question_id,
    NULL, jsonb_build_object('state', 'removed')
  );
  RETURN v_pair;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_set_question_preference(
  p_student_id uuid,
  p_question_id uuid,
  p_story_id uuid,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_question_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.sf_question_preferences;
  v_story public.sf_stories;
  v_actor_name text;
BEGIN
  IF NOT public.sf_can_work_with_student(p_student_id) THEN
    RAISE EXCEPTION 'student scope denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id
    AND student_id = p_student_id
    AND archived_at IS NULL
    AND (
      public.sf_actor_role() = 'student'
      OR status <> 'private'
    );
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.sf_story_questions pair
    WHERE pair.story_id = p_story_id
      AND pair.question_id = p_question_id
      AND pair.state IN ('suggested', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'active story-question pair required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.sf_question_preferences (
    student_id, question_id, story_id, set_by
  )
  VALUES (p_student_id, p_question_id, p_story_id, public.sf_actor_id())
  ON CONFLICT (student_id, question_id) DO UPDATE
  SET story_id = EXCLUDED.story_id,
      set_by = EXCLUDED.set_by,
      set_at = now(),
      updated_at = now(),
      row_version = sf_question_preferences.row_version + 1
  RETURNING * INTO v_row;

  PERFORM public.sf_append_audit(
    'question.preferred_story_set', 'question_preference', p_question_id,
    p_surface, p_student_id, p_story_id, p_question_id, NULL,
    jsonb_build_object('story_id', p_story_id)
  );

  IF public.sf_actor_role() = 'mentor' THEN
    SELECT display_name INTO v_actor_name FROM public.sf_users WHERE id = public.sf_actor_id();
    PERFORM public.sf_emit_notification(
      p_student_id, public.sf_actor_id(), p_story_id, p_question_id,
      'question.preference', 'questions', 'Preferred interview answer set',
      v_actor_name || ' set “' || v_story.title || '” as the preferred answer for an interview question.',
      '/prep?question=' || p_question_id::text
    );
  END IF;
  RETURN v_row;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_add_question_coaching_note(
  p_student_id uuid,
  p_question_id uuid,
  p_story_id uuid,
  p_body text,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_question_coaching_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note public.sf_question_coaching_notes;
  v_story public.sf_stories;
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor'])
     OR NOT public.sf_is_assigned(p_student_id) THEN
    RAISE EXCEPTION 'assigned mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF p_story_id IS NOT NULL THEN
    SELECT * INTO v_story FROM public.sf_stories
    WHERE id = p_story_id AND student_id = p_student_id AND status <> 'private' AND archived_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.sf_questions question
    WHERE question.id = p_question_id
      AND question.governance_state <> 'retired'
      AND (
        question.governance_state = 'approved'
        OR question.owner_student_id = p_student_id
      )
  ) THEN
    RAISE EXCEPTION 'question not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sf_question_coaching_notes (
    student_id, question_id, story_id, mentor_id, body
  )
  VALUES (
    p_student_id, p_question_id, p_story_id, public.sf_actor_id(), trim(p_body)
  )
  RETURNING * INTO v_note;

  PERFORM public.sf_append_audit(
    'question.coaching_note_added', 'question_coaching_note', v_note.id,
    p_surface, p_student_id, p_story_id, p_question_id, NULL,
    jsonb_build_object('body', v_note.body)
  );

  SELECT display_name INTO v_actor_name FROM public.sf_users WHERE id = public.sf_actor_id();
  PERFORM public.sf_emit_notification(
    p_student_id, public.sf_actor_id(), p_story_id, p_question_id,
    'question.coaching', 'coaching', 'Interview coaching added',
    v_actor_name || ' added a coaching note on an interview question.',
    '/prep?question=' || p_question_id::text
  );
  RETURN v_note;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_add_pair_followup(
  p_pair_id uuid,
  p_text text,
  p_clinical boolean DEFAULT false,
  p_prepared boolean DEFAULT false,
  p_note text DEFAULT '',
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_pair_followups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pair public.sf_story_questions;
  v_story public.sf_stories;
  v_followup public.sf_pair_followups;
  v_sort integer;
  v_actor_name text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pair
  FROM public.sf_story_questions
  WHERE id = p_pair_id AND state IN ('suggested', 'confirmed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active story-question pair not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories WHERE id = v_pair.story_id AND archived_at IS NULL;
  IF NOT FOUND
     OR (public.sf_actor_role() = 'student' AND v_story.student_id <> public.sf_actor_id())
     OR (
       public.sf_actor_role() = 'mentor'
       AND (v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id))
     ) THEN
    RAISE EXCEPTION 'active story-question pair not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(max(sort_order), -1) + 1 INTO v_sort
  FROM public.sf_pair_followups
  WHERE story_question_id = p_pair_id AND removed_at IS NULL;

  INSERT INTO public.sf_pair_followups (
    story_question_id, text, source, clinical, prepared, preparation_note,
    sort_order, created_by
  )
  VALUES (
    p_pair_id, trim(p_text), public.sf_actor_role(), coalesce(p_clinical, false),
    coalesce(p_prepared, false), coalesce(p_note, ''), v_sort, public.sf_actor_id()
  )
  RETURNING * INTO v_followup;

  PERFORM public.sf_append_audit(
    'question.followup_added', 'pair_followup', v_followup.id, p_surface,
    v_story.student_id, v_story.id, v_pair.question_id, NULL,
    jsonb_build_object('text', v_followup.text, 'clinical', v_followup.clinical)
  );

  IF public.sf_actor_role() = 'mentor' THEN
    SELECT display_name INTO v_actor_name FROM public.sf_users WHERE id = public.sf_actor_id();
    PERFORM public.sf_emit_notification(
      v_story.student_id, public.sf_actor_id(), v_story.id, v_pair.question_id,
      'question.followup', 'followup', 'Follow-up preparation added',
      v_actor_name || ' added follow-up questions to prepare on “' || v_story.title || '”.',
      '/prep?question=' || v_pair.question_id::text
    );
  END IF;
  RETURN v_followup;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_pair_followup(
  p_followup_id uuid,
  p_patch jsonb,
  p_expected_version bigint DEFAULT NULL,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_pair_followups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.sf_pair_followups;
  v_followup public.sf_pair_followups;
  v_pair public.sf_story_questions;
  v_story public.sf_stories;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_before FROM public.sf_pair_followups
  WHERE id = p_followup_id AND removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'follow-up not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_pair FROM public.sf_story_questions WHERE id = v_before.story_question_id;
  SELECT * INTO v_story FROM public.sf_stories WHERE id = v_pair.story_id AND archived_at IS NULL;
  IF NOT FOUND
     OR (public.sf_actor_role() = 'student' AND v_story.student_id <> public.sf_actor_id())
     OR (
       public.sf_actor_role() = 'mentor'
       AND (v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id))
     ) THEN
    RAISE EXCEPTION 'follow-up not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_before.row_version THEN
    RAISE EXCEPTION 'follow-up changed in another session' USING ERRCODE = '40001';
  END IF;

  UPDATE public.sf_pair_followups
  SET text = CASE WHEN p_patch ? 'text' THEN coalesce(nullif(trim(p_patch->>'text'), ''), text) ELSE text END,
      clinical = CASE WHEN p_patch ? 'clinical' THEN (p_patch->>'clinical')::boolean ELSE clinical END,
      prepared = CASE WHEN p_patch ? 'prepared' THEN (p_patch->>'prepared')::boolean ELSE prepared END,
      preparation_note = CASE WHEN p_patch ? 'note' THEN coalesce(p_patch->>'note', '') ELSE preparation_note END,
      sort_order = CASE WHEN p_patch ? 'sortOrder' THEN (p_patch->>'sortOrder')::integer ELSE sort_order END,
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_followup_id
  RETURNING * INTO v_followup;

  PERFORM public.sf_append_audit(
    'question.followup_updated', 'pair_followup', v_followup.id, p_surface,
    v_story.student_id, v_story.id, v_pair.question_id,
    jsonb_build_object(
      'text', v_before.text, 'clinical', v_before.clinical,
      'prepared', v_before.prepared, 'note', v_before.preparation_note,
      'sort_order', v_before.sort_order
    ),
    jsonb_build_object(
      'text', v_followup.text, 'clinical', v_followup.clinical,
      'prepared', v_followup.prepared, 'note', v_followup.preparation_note,
      'sort_order', v_followup.sort_order
    )
  );
  RETURN v_followup;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_remove_pair_followup(
  p_followup_id uuid,
  p_surface text DEFAULT 'workshop'
)
RETURNS public.sf_pair_followups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_followup public.sf_pair_followups;
  v_pair public.sf_story_questions;
  v_story public.sf_stories;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['student', 'mentor']) THEN
    RAISE EXCEPTION 'eligible identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_followup FROM public.sf_pair_followups
  WHERE id = p_followup_id AND removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'follow-up not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_pair FROM public.sf_story_questions WHERE id = v_followup.story_question_id;
  SELECT * INTO v_story
  FROM public.sf_stories
  WHERE id = v_pair.story_id
    AND archived_at IS NULL;
  IF NOT FOUND
     OR (public.sf_actor_role() = 'student' AND v_story.student_id <> public.sf_actor_id())
     OR (
       public.sf_actor_role() = 'mentor'
       AND (v_story.status = 'private' OR NOT public.sf_is_assigned(v_story.student_id))
     ) THEN
    RAISE EXCEPTION 'follow-up not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.sf_pair_followups
  SET removed_by = public.sf_actor_id(),
      removed_at = now(),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = p_followup_id
  RETURNING * INTO v_followup;

  PERFORM public.sf_append_audit(
    'question.followup_removed', 'pair_followup', v_followup.id, p_surface,
    v_story.student_id, v_story.id, v_pair.question_id,
    NULL, jsonb_build_object('removed', true)
  );
  RETURN v_followup;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_update_story_craft(
  p_story_id uuid,
  p_patch jsonb,
  p_surface text DEFAULT 'workspace'
)
RETURNS public.sf_story_craft
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_story public.sf_stories;
  v_row public.sf_story_craft;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_story FROM public.sf_stories
  WHERE id = p_story_id AND status <> 'private' AND archived_at IS NULL;
  IF NOT FOUND OR NOT public.sf_is_assigned(v_story.student_id) THEN
    RAISE EXCEPTION 'story not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.sf_story_craft (
    story_id, detail, stakes, turn, honest, lesson, scored_by
  )
  VALUES (
    p_story_id,
    nullif(p_patch->>'detail', '')::smallint,
    nullif(p_patch->>'stakes', '')::smallint,
    nullif(p_patch->>'turn', '')::smallint,
    nullif(p_patch->>'honest', '')::smallint,
    nullif(p_patch->>'lesson', '')::smallint,
    public.sf_actor_id()
  )
  ON CONFLICT (story_id) DO UPDATE
  SET detail = CASE WHEN p_patch ? 'detail' THEN nullif(p_patch->>'detail', '')::smallint ELSE sf_story_craft.detail END,
      stakes = CASE WHEN p_patch ? 'stakes' THEN nullif(p_patch->>'stakes', '')::smallint ELSE sf_story_craft.stakes END,
      turn = CASE WHEN p_patch ? 'turn' THEN nullif(p_patch->>'turn', '')::smallint ELSE sf_story_craft.turn END,
      honest = CASE WHEN p_patch ? 'honest' THEN nullif(p_patch->>'honest', '')::smallint ELSE sf_story_craft.honest END,
      lesson = CASE WHEN p_patch ? 'lesson' THEN nullif(p_patch->>'lesson', '')::smallint ELSE sf_story_craft.lesson END,
      scored_by = public.sf_actor_id(),
      scored_at = now(),
      row_version = sf_story_craft.row_version + 1
  RETURNING * INTO v_row;

  PERFORM public.sf_append_audit(
    'story.craft_updated', 'story', v_story.id, p_surface,
    v_story.student_id, v_story.id, NULL, NULL, to_jsonb(v_row)
  );
  RETURN v_row;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_start_coaching_session(
  p_student_id uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS public.sf_coaching_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.sf_coaching_sessions;
  v_item jsonb;
  v_order integer := 0;
  v_created boolean := false;
  v_existing_items integer := 0;
  v_label text;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor'])
     OR NOT public.sf_is_assigned(p_student_id) THEN
    RAISE EXCEPTION 'assigned mentor identity required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 12 THEN
    RAISE EXCEPTION 'session items must be an array of at most 12 items'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM public.sf_coaching_sessions
  WHERE student_id = p_student_id
    AND mentor_id = public.sf_actor_id()
    AND state = 'active'
  FOR UPDATE;
  IF FOUND THEN
    SELECT count(*)::integer INTO v_existing_items
    FROM public.sf_coaching_session_items
    WHERE session_id = v_session.id;
    IF v_existing_items > 0 OR jsonb_array_length(p_items) = 0 THEN
      RETURN v_session;
    END IF;
  ELSE
    INSERT INTO public.sf_coaching_sessions (student_id, mentor_id)
    VALUES (p_student_id, public.sf_actor_id())
    RETURNING * INTO v_session;
    v_created := true;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_label := trim(coalesce(v_item->>'label', ''));
    IF length(v_label) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'session item label must be between 1 and 500 characters'
        USING ERRCODE = '22023';
    END IF;
    IF nullif(v_item->>'storyId', '') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.sf_stories story
         WHERE story.id = (v_item->>'storyId')::uuid
           AND story.student_id = p_student_id
           AND story.status <> 'private'
           AND story.archived_at IS NULL
       ) THEN
      RAISE EXCEPTION 'session story not found' USING ERRCODE = 'P0002';
    END IF;
    IF nullif(v_item->>'questionId', '') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.sf_questions question
         WHERE question.id = (v_item->>'questionId')::uuid
           AND question.governance_state <> 'retired'
           AND (
             question.governance_state = 'approved'
             OR question.owner_student_id = p_student_id
           )
       ) THEN
      RAISE EXCEPTION 'session question not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.sf_coaching_session_items (
      session_id, label, story_id, question_id, route, sort_order
    )
    VALUES (
      v_session.id,
      v_label,
      nullif(v_item->>'storyId', '')::uuid,
      nullif(v_item->>'questionId', '')::uuid,
      nullif(v_item->>'route', ''),
      v_order
    );
    v_order := v_order + 1;
  END LOOP;

  PERFORM public.sf_append_audit(
    CASE
      WHEN v_created THEN 'coaching.session_started'
      ELSE 'coaching.session_agenda_initialized'
    END,
    'coaching_session', v_session.id, 'workspace',
    p_student_id, NULL, NULL, NULL,
    jsonb_build_object('agenda_count', v_order)
  );
  RETURN v_session;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_toggle_coaching_session_item(
  p_item_id uuid,
  p_completed boolean
)
RETURNS public.sf_coaching_session_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.sf_coaching_session_items;
  v_session public.sf_coaching_sessions;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  SELECT item.* INTO v_item
  FROM public.sf_coaching_session_items item
  JOIN public.sf_coaching_sessions session ON session.id = item.session_id
  WHERE item.id = p_item_id
    AND session.mentor_id = public.sf_actor_id()
    AND session.state = 'active'
    AND public.sf_is_assigned(session.student_id)
  FOR UPDATE OF item, session;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active session item not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_session FROM public.sf_coaching_sessions WHERE id = v_item.session_id;

  UPDATE public.sf_coaching_session_items
  SET completed = p_completed,
      completed_at = CASE WHEN p_completed THEN coalesce(completed_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  PERFORM public.sf_append_audit(
    'coaching.agenda_item_updated', 'coaching_session_item', v_item.id,
    'workspace', v_session.student_id, v_item.story_id, v_item.question_id,
    NULL, jsonb_build_object('completed', v_item.completed)
  );
  RETURN v_item;
END
$$;

CREATE OR REPLACE FUNCTION public.sf_end_coaching_session(
  p_session_id uuid,
  p_summary text DEFAULT NULL
)
RETURNS public.sf_coaching_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session public.sf_coaching_sessions;
  v_done integer;
  v_total integer;
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['mentor']) THEN
    RAISE EXCEPTION 'eligible mentor identity required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_session
  FROM public.sf_coaching_sessions
  WHERE id = p_session_id
    AND mentor_id = public.sf_actor_id()
    AND state = 'active'
    AND public.sf_is_assigned(student_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'active coaching session not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer, count(*) FILTER (WHERE completed)::integer
  INTO v_total, v_done
  FROM public.sf_coaching_session_items
  WHERE session_id = p_session_id;

  UPDATE public.sf_coaching_sessions
  SET state = 'completed',
      summary = nullif(trim(p_summary), ''),
      ended_at = now(),
      row_version = row_version + 1
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.sf_append_audit(
    'coaching.session_completed', 'coaching_session', v_session.id,
    'workspace', v_session.student_id, NULL, NULL, NULL,
    jsonb_build_object('completed', v_done, 'total', v_total, 'summary', v_session.summary)
  );
  RETURN v_session;
END
$$;

REVOKE ALL ON FUNCTION public.sf_can_work_with_student(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_upsert_story_question(uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_review_story_question(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_remove_story_question(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_set_question_preference(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_add_question_coaching_note(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_add_pair_followup(uuid, text, boolean, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_update_pair_followup(uuid, jsonb, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_remove_pair_followup(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_update_story_craft(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_start_coaching_session(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_toggle_coaching_session_item(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_end_coaching_session(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_create_custom_question(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sf_approve_question(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sf_upsert_story_question(uuid, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_can_work_with_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_review_story_question(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_remove_story_question(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_set_question_preference(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_add_question_coaching_note(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_add_pair_followup(uuid, text, boolean, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_pair_followup(uuid, jsonb, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_remove_pair_followup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_update_story_craft(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_start_coaching_session(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_toggle_coaching_session_item(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_end_coaching_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_create_custom_question(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sf_approve_question(uuid, text) TO authenticated;

COMMIT;
