BEGIN;

CREATE TABLE public.sf_recording_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.sf_users(id) ON DELETE RESTRICT,
  story_id uuid REFERENCES public.sf_stories(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'recording'
    CHECK (state IN ('recording','finishing','assembled','attached','cancelled','failed')),
  mime_type text,
  total_duration_ms integer NOT NULL DEFAULT 0 CHECK (total_duration_ms BETWEEN 0 AND 1300000),
  segment_count integer NOT NULL DEFAULT 0 CHECK (segment_count BETWEEN 0 AND 200),
  assembled_asset_id uuid REFERENCES public.sf_audio_assets(id) ON DELETE RESTRICT,
  provider_id text, model_id text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sf_recording_sessions_student_idx
  ON public.sf_recording_sessions (student_id, state, created_at DESC);
CREATE UNIQUE INDEX sf_recording_sessions_one_active
  ON public.sf_recording_sessions (student_id)
  WHERE state = 'recording';
-- 'finishing'/'assembled' exist only inside the save flow (session model, Storage Spec
-- Section 5): Done is client-side review, Record more continues the SAME session, and
-- E4 finish fires at Save time. Legal state transitions, binding:
-- recording -> finishing -> assembled -> attached; recording|finishing -> cancelled;
-- recording|finishing|assembled -> failed (sweep). No other transition is permitted.

CREATE TABLE public.sf_recording_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sf_recording_sessions(id) ON DELETE RESTRICT,
  seq integer NOT NULL CHECK (seq BETWEEN 0 AND 199),
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('audio/webm','audio/mp4','audio/ogg','audio/wav')),
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 60000),
  transcribe_state text NOT NULL DEFAULT 'received'
    CHECK (transcribe_state IN ('received','transcribing','transcribed','transcribe_failed')),
  transcript text,
  flagged_terms jsonb NOT NULL DEFAULT '[]',
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);
CREATE INDEX sf_recording_segments_session_idx
  ON public.sf_recording_segments (session_id, seq);

ALTER TABLE public.sf_recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_recording_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_recording_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sf_recording_segments FORCE ROW LEVEL SECURITY;

-- students only; mentors and admins have NO policy on recordings (pre-save, private by definition)
CREATE POLICY sf_recording_sessions_rw ON public.sf_recording_sessions
FOR ALL TO authenticated
USING (public.sf_has_live_identity() AND student_id = public.sf_actor_id())
WITH CHECK (public.sf_has_live_identity() AND student_id = public.sf_actor_id());

CREATE POLICY sf_recording_segments_rw ON public.sf_recording_segments
FOR ALL TO authenticated
USING (public.sf_has_live_identity() AND EXISTS (
  SELECT 1 FROM public.sf_recording_sessions rs
  WHERE rs.id = session_id AND rs.student_id = public.sf_actor_id()))
WITH CHECK (public.sf_has_live_identity() AND EXISTS (
  SELECT 1 FROM public.sf_recording_sessions rs
  WHERE rs.id = session_id AND rs.student_id = public.sf_actor_id()));

REVOKE ALL ON public.sf_recording_sessions, public.sf_recording_segments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.sf_recording_sessions, public.sf_recording_segments TO authenticated;

-- Service path (transcription worker updates, sweeps, E13 aggregates): explicit, not assumed.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_recording_sessions, public.sf_recording_segments TO storyforge_app;
CREATE POLICY sf_recording_sessions_service ON public.sf_recording_sessions
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);
CREATE POLICY sf_recording_segments_service ON public.sf_recording_segments
FOR ALL TO storyforge_app USING (true) WITH CHECK (true);
-- storyforge_app is server-internal only (NOLOGIN role assumed by the service connection;
-- VST bootstrap_production.sql), never reachable by any end-user token. RP-13 captures its
-- actual attributes; if the service connection does not run as storyforge_app, Fable amends
-- the role name here before the execution MegaRun. Purge semantics: cancel and the sweeps
-- DELETE segment rows (erasing transcript and flagged_terms) and delete their R2 objects;
-- discarded words leave the database, not only the bucket.

COMMIT;
