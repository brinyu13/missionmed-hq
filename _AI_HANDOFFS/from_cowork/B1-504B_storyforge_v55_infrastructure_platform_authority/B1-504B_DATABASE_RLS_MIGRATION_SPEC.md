# B1-504B · Database, RLS, and Migration Specification

Labels and ladder per the Infrastructure Authority Lock. Database identity (AA, evidence in that lock): isolated Railway PostgreSQL 18, roles `anon` / `authenticated` / `storyforge_app` (VST `infra/postgres/bootstrap_production.sql`), guarded runner `scripts/apply-production-migrations.sh`, migrations dir `storyforge-v5/infra/postgres/migrations/` (five applied through B1-503, VPT). The root `supabase/` tree is out of bounds.

## 1. Existing entities: disposition (VST, all 25 tables enumerated this run)

RETAINED UNCHANGED (authoritative, already covering the platform model): `sf_users` (student and mentor identity; UUID PK, referenced by existing FKs), `sf_mentor_assignments`, `sf_stories` (status, row_version, capture_type, themes/uses/birds/positions), `sf_story_originals` (immutable original telling: original_transcript, audio_asset_id, capture_type), `sf_story_revisions` (editable version history), `sf_story_drafts` + `sf_save_story_draft(jsonb,bigint)` (durable drafts, atomic consumption), `sf_story_reflections`, `sf_story_craft`, `sf_feedback` (mentor reviews/comments), `sf_questions` (governed library), `sf_story_questions` (story-question pairing incl. strengths and confirmation), `sf_question_preferences` (preferred mapping), `sf_pair_followups`, `sf_question_coaching_notes`, `sf_next_questions`, `sf_use_suggestions`, `sf_coaching_sessions` + `sf_coaching_session_items`, `sf_notifications`, `sf_import_batches` + `sf_import_rows`, `sf_audit_events` (append-only, trigger-protected), `sf_audio_assets` (state machine pending/uploaded/verified/failed/retired), `sf_ai_suggestions` (existing V5 AI feature, flag-off; untouched by Phase 1), `sf_workshops`.
ALTERED: none. Phase 1 changes no existing table shape (carried B1-504A rejection of `sf_stories`/`sf_story_originals`/`sf_audio_assets` changes stands).
FORBIDDEN: direct external access to any of these tables by other applications (Platform Contract doc); any Codex-invented table not in this spec.

Identity note (AA): student identity = `sf_users.id` UUID minted from the WordPress mapping (`mmsf_storyforge_user_id`), carried as JWT `sub`. This is the durable tenant key for all platform contracts.

## 2. New migrations: exact files, exact SQL

Two files, applied in order, one transaction each, via the guarded runner. Names:

- `infra/postgres/migrations/20260729T0001_b1_506_voice_recording_sessions.sql`
- `infra/postgres/migrations/20260729T0002_b1_506_feature_flags.sql`

(If the runner requires the house timestamp format seen in existing files, `YYYYMMDDHHMMSS`, Codex renames to match the pattern EXACTLY while preserving order; this is a naming convention, not a design choice.)

### M1 `..._b1_506_voice_recording_sessions.sql` (production-ready SQL)

```sql
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
```

### M2 `..._b1_506_feature_flags.sql` (production-ready SQL)

```sql
BEGIN;

CREATE TABLE public.sf_feature_flags (
  key text PRIMARY KEY,
  scope text NOT NULL DEFAULT 'off'
    CHECK (scope IN ('off','allowlist','cohort','eligible_all')),
  allowlist uuid[] NOT NULL DEFAULT '{}',
  cohorts text[] NOT NULL DEFAULT '{}',
  updated_by uuid NOT NULL REFERENCES public.sf_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sf_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_feature_flags FORCE ROW LEVEL SECURITY;

CREATE POLICY sf_feature_flags_admin_read ON public.sf_feature_flags
FOR SELECT TO authenticated
USING (public.sf_has_live_identity() AND public.sf_actor_role() = 'admin');

CREATE POLICY sf_feature_flags_admin_write ON public.sf_feature_flags
FOR UPDATE TO authenticated
USING (public.sf_has_live_identity() AND public.sf_actor_role() = 'admin')
WITH CHECK (public.sf_has_live_identity() AND public.sf_actor_role() = 'admin');

REVOKE ALL ON public.sf_feature_flags FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.sf_feature_flags TO authenticated;
GRANT SELECT ON public.sf_feature_flags TO storyforge_app;
CREATE POLICY sf_feature_flags_service_read ON public.sf_feature_flags
FOR SELECT TO storyforge_app USING (true);
-- capability computation (E10) for non-admin callers reads through the service path.

INSERT INTO public.sf_feature_flags (key, scope, updated_by)
SELECT 'voice_capture', 'off', u.id
FROM public.sf_users u
ORDER BY u.created_at ASC, u.id ASC
LIMIT 1;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.sf_feature_flags WHERE key = 'voice_capture') <> 1 THEN
    RAISE EXCEPTION 'voice_capture flag row was not seeded (sf_users empty?)';
  END IF;
END $$;

COMMIT;
```

Seeding notes (binding): the seed runs under the privileged migration runner (FORCE RLS does not bind it); flag rows are created ONLY by migration (fixed key set) and admins may only UPDATE them, which is why no INSERT policy exists. `updated_by` selects the earliest-created user deterministically (tie-broken by id); when RP-10 confirms the founder's mapped UUID, the runner injects it explicitly as a documented parameter override and records which UUID was used. The `DO` block makes an empty-`sf_users` state a hard migration failure instead of a silent zero-row seed. Scope value set: `('off','allowlist','cohort','eligible_all')`; the earlier `founder` scope value is REMOVED (superseding B1-504A wording): the founder-only stage is scope `allowlist` containing exactly the founder's pilot UUID, which eliminates any out-of-band founder-identity constant.

Non-student capability computation (AA): the caller's own flag capability (E10) is computed by the SERVICE inside `withIdentity` transactions using a SECURITY DEFINER helper `public.sf_voice_capability()` OR by an app-layer read with the service's own privileged connection. Binding choice: app-layer read using the existing service connection pattern already used for cross-student mentor views; no new SECURITY DEFINER function is created for flags (smallest surface; the admin RLS above protects raw flag rows).

## 3. RLS and SECURITY DEFINER rules (AA)

- House helpers `sf_has_live_identity()`, `sf_actor_id()`, `sf_actor_role()`, `sf_is_assigned()` (VST) are the only identity primitives new policies may use.
- No new SECURITY DEFINER function may read or write across students except the two service-path needs already carried by the house design (draft save and story creation functions exist; the new E7 attach check is EXPLICIT in the transaction regardless of definer context, carried B1-504A rule).
- Mentors: zero visibility into `sf_recording_sessions` / `sf_recording_segments` (no policy exists for them, and FORCE RLS guarantees it).
- Admin: flag tables only; no content tables gain admin policies in Phase 1.

## 4. Pre-migration checks, validation, rollback (binding runbook fragment)

Pre: guarded runner preflight; `SELECT count(*) FROM public.sf_schema_migrations` equals the B1-503 value (five StoryForge rows, VPT) plus any B1-505 additions recorded in its authority; RP-13 evidence consumed (service-role attributes, `sf_users` columns, `sf_audit_events` PK type, story-deletion model, runner transaction behavior with embedded BEGIN/COMMIT); full PG dump + restore rehearsal per B1-503 discipline; Railway variable export.

Story deletion decision table (bound by RP-13 evidence): IF the house model is soft delete or status-archive (suggested by the existing `sf_audio_assets.story_id ... ON DELETE RESTRICT`, which would block hard deletes of voiced stories today), THEN the platform 410 derives from that status and M1's `ON DELETE SET NULL` never fires; the story-delete handler transitions any session for that story to `cancelled` and purges its segments. IF the house model hard-deletes, THEN the existing delete handler already retires assets first (or deletion of voiced stories is currently impossible, which is a BLOCKER finding to Fable), and the handler extension does the same session transition BEFORE the row delete; 410 derives from the `story.deleted` audit event. Either way the handler extension is: retire+delete audio objects, cancel sessions, purge segments, audit; exact branch selected by evidence, not by Codex preference.
Validation queries after apply (each must return the stated value):
1. `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('sf_recording_sessions','sf_recording_segments','sf_feature_flags');` all true.
2. `SELECT scope FROM public.sf_feature_flags WHERE key='voice_capture';` = `off` (and the DO-block guarantees the row exists).
3. Cross-student probe under fixture identities (existing PostgreSQL suite pattern): student B selecting student A's session rows returns zero; INSERT with foreign student_id fails.
4. Catalog check (SQL, not psql meta): `SELECT conname FROM pg_constraint WHERE conrelid='public.sf_recording_segments'::regclass AND contype='u';` includes the (session_id, seq) unique.
5. Service-path proof: as the service connection role, UPDATE a fixture segment's transcript and DELETE a fixture cancelled segment row (succeeds); as a fixture student, SELECT the flag row (fails, admin-only) while the E10 capability call (service path) returns a boolean.
Rollback: M1/M2 are additive and inert while `voice_capture='off'`; containment never requires schema rollback. The reversal files (DROP TABLE in reverse order) exist as `..._rollback.sql` companions but run ONLY with founder authorization and a fresh backup (carried rule: never drop to disable a feature). Saved stories, transcripts, audio rows, and relationships are untouched by both forward and reverse paths (no existing table is altered).
Failure stop: any validation mismatch stops the deployment lane; evidence to Fable.

## 5. Data ownership entities required by the Platform Contract

All platform read models resolve from the RETAINED tables plus M1 (Platform Contract doc Section 3 maps each field). No new tables are needed for Phase 1 platform contracts except the change-feed outbox, which is DEFERRED (not in Phase 1 scope; the change feed ships as a cursor read over existing audit + row timestamps; see Platform Contract Section 7). This is a deliberate anti-invention decision (AA).
