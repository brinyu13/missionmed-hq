BEGIN;
-- Pass 1: compute seed, question_ids, choices_order for rows missing content_hash.
UPDATE public.duel_challenges c
SET
  dataset_version = COALESCE(c.dataset_version, public.dataset_registry_current()),
  question_ids = public.pick_questions_seeded(
    encode(digest(c.id::text || ':' || COALESCE(c.dataset_version, public.dataset_registry_current()), 'sha256'), 'hex'),
    20,
    COALESCE(c.dataset_version, public.dataset_registry_current())
  ),
  choices_order = public.shuffle_choices_seeded(
    encode(digest(c.id::text || ':' || COALESCE(c.dataset_version, public.dataset_registry_current()), 'sha256'), 'hex'),
    public.pick_questions_seeded(
      encode(digest(c.id::text || ':' || COALESCE(c.dataset_version, public.dataset_registry_current()), 'sha256'), 'hex'),
      20,
      COALESCE(c.dataset_version, public.dataset_registry_current())
    ),
    COALESCE(c.dataset_version, public.dataset_registry_current())
  )
WHERE c.content_hash IS NULL;
-- Pass 2: compute answer_map + content_hash + sealed_at.
UPDATE public.duel_challenges c
SET
  answer_map = public.answer_map_for(c.question_ids, c.dataset_version),
  content_hash = public.content_hash_compute(c.question_ids, c.choices_order, c.dataset_version),
  sealed_at = COALESCE(c.sealed_at, c.created_at, now())
WHERE c.content_hash IS NULL AND c.question_ids IS NOT NULL;
-- Pass 3: defensive state reconciliation (Phase 1.1 already mapped, but re-assert so the
-- backfill is idempotent even if new rows arrived between Phase 1.1 and Phase 2.3).
UPDATE public.duel_challenges
SET state = 'void'
WHERE state IS NOT NULL
  AND state NOT IN ('pending','active','finalized','void');
COMMIT;
-- Verification block (informational, no changes).
SELECT
  COUNT(*) FILTER (WHERE content_hash IS NULL) AS rows_still_missing_hash,
  COUNT(*) FILTER (WHERE content_hash IS NOT NULL) AS rows_sealed,
  COUNT(*) FILTER (WHERE state NOT IN ('pending','active','finalized','void')) AS rows_with_noncanonical_state
FROM public.duel_challenges;
