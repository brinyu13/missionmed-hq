BEGIN;

-- =============================================================
-- B1-507B Ruling 2: sf_audio_deletion_intents (FABLE-C1)
-- =============================================================

CREATE TABLE public.sf_audio_deletion_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  object_key text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'orphan_deleted_ref', 'orphan_never_existed', 'orphan_invalid_key'
  )),
  student_ref uuid,
  story_ref uuid,
  ref_state text NOT NULL CHECK (ref_state IN (
    'live', 'deleted', 'never_existed', 'invalid_key'
  )),
  state text NOT NULL DEFAULT 'intended' CHECK (state IN (
    'intended', 'deleted_confirmed', 'object_absent', 'failed'
  )),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (state = 'intended' AND resolved_at IS NULL) OR
    (state IN ('deleted_confirmed', 'object_absent', 'failed') AND resolved_at IS NOT NULL)
  )
);

-- Partial unique index: prevents duplicate open intents for the same key.
-- A resolved or failed intent does not block a new intent in a later run.
CREATE UNIQUE INDEX sf_deletion_intents_open_key_idx
  ON public.sf_audio_deletion_intents (object_key)
  WHERE state = 'intended';

CREATE INDEX sf_deletion_intents_run_idx
  ON public.sf_audio_deletion_intents (run_id, created_at);

CREATE INDEX sf_deletion_intents_unresolved_idx
  ON public.sf_audio_deletion_intents (state, created_at)
  WHERE state = 'intended';

ALTER TABLE public.sf_audio_deletion_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_audio_deletion_intents FORCE ROW LEVEL SECURITY;

-- Service-only: no authenticated policy exists; students/mentors/admins
-- cannot SELECT, INSERT, UPDATE, or DELETE these rows through any path.
CREATE POLICY sf_deletion_intents_service ON public.sf_audio_deletion_intents
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);

REVOKE ALL ON public.sf_audio_deletion_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sf_audio_deletion_intents TO storyforge_app;

-- =============================================================
-- B1-507B Ruling 3: sf_reconciliation_runs (FABLE-C2)
-- =============================================================

CREATE TABLE public.sf_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('dry_run', 'on')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pages_listed integer NOT NULL DEFAULT 0,
  keys_evaluated integer NOT NULL DEFAULT 0,
  candidates integer NOT NULL DEFAULT 0,
  preserved integer NOT NULL DEFAULT 0,
  deleted_confirmed integer NOT NULL DEFAULT 0,
  object_absent integer NOT NULL DEFAULT 0,
  retried integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  abort_reason text,
  suspended boolean NOT NULL DEFAULT false,
  suspension_reason text,
  cursor_digest_start text,
  cursor_digest_end text,
  replica_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Structural redaction: NO object keys, NO student or story UUIDs, NO
-- transcripts, audio, signed URLs, or credentials appear in this table.
-- cursor_digest_start and cursor_digest_end are SHA-256 of the cursor key
-- values, never the keys themselves.

CREATE INDEX sf_reconciliation_runs_started_idx
  ON public.sf_reconciliation_runs (started_at DESC);

ALTER TABLE public.sf_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_reconciliation_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_reconciliation_runs_service ON public.sf_reconciliation_runs
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);

REVOKE ALL ON public.sf_reconciliation_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sf_reconciliation_runs TO storyforge_app;

-- =============================================================
-- B1-507B Rulings 5+6: sf_reconciliation_state (FABLE-C4/C5)
-- =============================================================

CREATE TABLE public.sf_reconciliation_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor_key text NOT NULL DEFAULT '',
  lease_owner text,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforced singleton: the CHECK(id = 1) plus PRIMARY KEY guarantees
-- exactly zero or one row. Seed the singleton now.
INSERT INTO public.sf_reconciliation_state (id) VALUES (1);

ALTER TABLE public.sf_reconciliation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_reconciliation_state FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_reconciliation_state_service ON public.sf_reconciliation_state
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);

REVOKE ALL ON public.sf_reconciliation_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.sf_reconciliation_state TO storyforge_app;

-- =============================================================
-- B1-507B Ruling 3: sf_reconciliation_report (FABLE-C2)
-- =============================================================

CREATE OR REPLACE FUNCTION public.sf_reconciliation_report(p_limit integer DEFAULT 5)
RETURNS TABLE (
  run_id uuid,
  mode text,
  started_at timestamptz,
  finished_at timestamptz,
  pages_listed integer,
  keys_evaluated integer,
  candidates integer,
  preserved integer,
  deleted_confirmed integer,
  object_absent integer,
  retried integer,
  failed integer,
  abort_reason text,
  suspended boolean,
  suspension_reason text,
  cursor_digest_start text,
  cursor_digest_end text,
  replica_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.sf_has_live_identity(ARRAY['admin']) THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.id, r.mode, r.started_at, r.finished_at,
         r.pages_listed, r.keys_evaluated, r.candidates, r.preserved,
         r.deleted_confirmed, r.object_absent, r.retried, r.failed,
         r.abort_reason, r.suspended, r.suspension_reason,
         r.cursor_digest_start, r.cursor_digest_end, r.replica_id
  FROM public.sf_reconciliation_runs r
  ORDER BY r.started_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 5), 8));
END
$$;

REVOKE ALL ON FUNCTION public.sf_reconciliation_report(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_reconciliation_report(integer) TO authenticated;
-- The function body gates on sf_has_live_identity(ARRAY['admin']), so only
-- the verified StoryForge admin identity (the two-account rule) can read
-- the report. WordPress administrator status grants NOTHING.

-- =============================================================
-- B1-507B Ruling 2: sf_reconciliation_audit_service (FABLE-C1)
-- Service audit writer for reconciliation deletion events
-- =============================================================

-- Extend the existing sf_append_voice_audit_service to accept
-- reconciliation actions. The function is replaced with the
-- expanded action allowlist.
CREATE OR REPLACE FUNCTION public.sf_append_voice_audit_service(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_student_id uuid DEFAULT NULL,
  p_story_id uuid DEFAULT NULL,
  p_previous jsonb DEFAULT NULL,
  p_new jsonb DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id bigint;
BEGIN
  IF p_action NOT IN (
    'recording_cancelled','recording_swept','assembly_completed','assembly_failed',
    'segment_transcribed','segment_transcribe_failed','provider_failover',
    'reconciliation_deleted','object_delete_retried',
    'reconciliation_object_absent','reconciliation_delete_failed',
    'reconciliation_run_started','reconciliation_run_finished',
    'reconciliation_run_aborted','reconciliation_lease_acquired',
    'reconciliation_lease_lost'
  ) THEN
    RAISE EXCEPTION 'service audit action not permitted' USING ERRCODE = '22023';
  END IF;
  IF p_entity_type NOT IN (
    'recording_session','recording_segment','audio_asset','feature_flag',
    'deletion_intent','reconciliation_run','reconciliation_state'
  ) THEN
    RAISE EXCEPTION 'service audit entity not permitted' USING ERRCODE = '22023';
  END IF;
  IF NOT public.sf_voice_audit_payload_ok(p_previous)
     OR NOT public.sf_voice_audit_payload_ok(p_new) THEN
    RAISE EXCEPTION 'service audit payload not permitted' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sf_audit_events (
    actor_id, actor_role, actor_display, action, entity_type, entity_id,
    surface, student_id, story_id, question_id, previous_value, new_value,
    detail, visibility
  )
  VALUES (
    NULL, 'service', 'StoryForge system',
    p_action, p_entity_type, p_entity_id, 'system', p_student_id, p_story_id,
    NULL, p_previous, p_new, NULL, 'both'
  )
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END
$$;

-- Grants unchanged: the function signature is identical to M3's version.
-- storyforge_app EXECUTE grant already exists from M3.

-- =============================================================
-- B1-507B Ruling 2: sf_voice_audit_payload_ok update
-- Extend to accept reconciliation-specific payload keys
-- =============================================================

CREATE OR REPLACE FUNCTION public.sf_voice_audit_payload_ok(p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_element jsonb;
  v_allowed text[] := ARRAY[
    'state','scope','allowlist','cohorts','errorCategory','code','seq',
    'recordingId','transcribeState','retryCount','segmentCount','surface',
    'reason','durationMs','byteSize','provider','model','count','objectCount',
    'latencyMs',
    'mode','pagesListed','keysEvaluated','candidates','preserved',
    'deletedConfirmed','objectAbsent','retried','failed','abortReason',
    'category','refState','attempts','cursorDigest','replicaId',
    'leaseOwner','suspended','suspensionReason'
  ];
BEGIN
  IF p_payload IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p_payload) <> 'object' THEN RETURN false; END IF;
  IF length(p_payload::text) > 4096 THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_payload)) > 12 THEN RETURN false; END IF;
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_payload) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN RETURN false; END IF;
    IF jsonb_typeof(v_value) = 'array' THEN
      IF jsonb_array_length(v_value) > 64 THEN RETURN false; END IF;
      FOR v_element IN SELECT value FROM jsonb_array_elements(v_value) LOOP
        IF jsonb_typeof(v_element) NOT IN ('string','number')
           OR length(v_element::text) > 128 THEN RETURN false; END IF;
      END LOOP;
    ELSIF jsonb_typeof(v_value) IN ('object') THEN
      RETURN false;
    ELSIF length(v_value::text) > 128 THEN
      RETURN false;
    END IF;
  END LOOP;
  IF p_payload ? 'errorCategory'
     AND NOT (p_payload->>'errorCategory' = ANY(ARRAY['mic','upload','transcribe','assembly','save','auth'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'state'
     AND NOT (p_payload->>'state' = ANY(ARRAY[
       'recording','finishing','assembled','attached','cancelled','failed',
       'retired','pending','uploaded','verified',
       'intended','deleted_confirmed','object_absent'
     ])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'transcribeState'
     AND NOT (p_payload->>'transcribeState' = ANY(ARRAY['received','transcribing','transcribed','transcribe_failed'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'scope'
     AND NOT (p_payload->>'scope' = ANY(ARRAY['off','allowlist','cohort','eligible_all'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'reason'
     AND NOT (p_payload->>'reason' = ANY(ARRAY[
       'abandoned_24h','save_never_completed_72h','failed_24h','story_archived',
       'reconciliation_audit_failed','reconciliation_lease_lost',
       'reconciliation_caps_reached','reconciliation_suspension'
     ])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'code'
     AND NOT (p_payload->>'code' = ANY(ARRAY['transcribe_unavailable','transcribe_timeout','transcribe_rejected_format','transcribe_failed_permanent','transcribe_interrupted'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'surface'
     AND NOT (p_payload->>'surface' = ANY(ARRAY['quick','library','system','features','voice_capture','voice_health'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'provider'
     AND NOT (p_payload->>'provider' = ANY(ARRAY['openai','none'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'model'
     AND NOT (p_payload->>'model' = ANY(ARRAY['gpt-4o-transcribe','whisper-1'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'mode'
     AND NOT (p_payload->>'mode' = ANY(ARRAY['dry_run','on'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'category'
     AND NOT (p_payload->>'category' = ANY(ARRAY['orphan_deleted_ref','orphan_never_existed','orphan_invalid_key'])) THEN
    RETURN false;
  END IF;
  IF p_payload ? 'refState'
     AND NOT (p_payload->>'refState' = ANY(ARRAY['live','deleted','never_existed','invalid_key'])) THEN
    RETURN false;
  END IF;
  RETURN true;
END
$$;

-- =============================================================
-- Reconciliation run row sweep (180-day retention, Ruling 3)
-- =============================================================

CREATE OR REPLACE FUNCTION public.sf_reconciliation_sweep_old_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.sf_reconciliation_runs
  WHERE finished_at IS NOT NULL
    AND finished_at < now() - interval '180 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;

REVOKE ALL ON FUNCTION public.sf_reconciliation_sweep_old_runs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sf_reconciliation_sweep_old_runs() TO storyforge_app;

COMMIT;
