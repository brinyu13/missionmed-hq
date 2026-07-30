# B1-507B - Executable Contracts

Literal implementation text for the seven rulings in `B1-507B_FABLE_BINDING_AUTHORITY.md`. Where prose elsewhere disagrees with this document, this document GOVERNS. Migration sources keep their BEGIN/COMMIT markers; the guarded runner strips them (RP-13(e) mechanical rule, already applied by Codex).

## 1. New migration M4: `infra/postgres/migrations/20260730000100_b1_507b_reconciliation_state.sql`

```sql
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
```

Rollback `20260730000100_b1_507b_reconciliation_state_rollback.sql`:

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.sf_reconciliation_sweep_old_runs();
DROP FUNCTION IF EXISTS public.sf_reconciliation_report(integer);
DROP POLICY IF EXISTS sf_reconciliation_state_service ON public.sf_reconciliation_state;
DROP TABLE IF EXISTS public.sf_reconciliation_state;
DROP POLICY IF EXISTS sf_reconciliation_runs_service ON public.sf_reconciliation_runs;
DROP TABLE IF EXISTS public.sf_reconciliation_runs;
DROP POLICY IF EXISTS sf_deletion_intents_service ON public.sf_audio_deletion_intents;
DROP TABLE IF EXISTS public.sf_audio_deletion_intents;
-- sf_append_voice_audit_service and sf_voice_audit_payload_ok are replaced
-- (not dropped): if rollback of the action-list expansion is needed, re-apply
-- the M3 version of those functions from B1-506A_EXECUTABLE_SQL_AND_CONTRACTS.md.
-- Audit rows already written are append-only history and are retained.
COMMIT;
```

## 2. Reconciliation service contracts (server/reconciliation.mjs)

The reconciliation service is a NEW module. It exports `createReconciliationService(deps)` where deps provides the database pool, R2 client, config, and logger. The service implements the complete state machine from Rulings 2 through 6.

### 2.1 Configuration constants (fixed in code, Ruling 6)

```
LEASE_DURATION_MS      = 30 * 60 * 1000   // 30 minutes
LEASE_RENEWAL_MS       = 5 * 60 * 1000    // 5 minutes
PAGE_SIZE              = 1000             // keys per R2 ListObjectsV2 call
MAX_PAGES_PER_RUN      = 5               // 5000 keys evaluated max
MAX_DELETES_PER_RUN    = 200             // deletion cap
INTENT_MAX_ATTEMPTS    = 3               // C1 retry cap
ELIGIBLE_AGE_DAYS      = 7               // C3 minimum age for deletion
STORYFORGE_PREFIXES    = ['storyforge-audio/', 'storyforge-rec/']
```

No new environment variables are created for these constants. They are fixed in code per Ruling 6.

### 2.2 Lease protocol (Ruling 6)

Acquisition:

```sql
UPDATE public.sf_reconciliation_state
SET lease_owner = $1, lease_expires_at = now() + interval '30 minutes', updated_at = now()
WHERE id = 1
  AND (lease_owner IS NULL OR lease_expires_at < now())
RETURNING *;
```

If zero rows returned, another replica holds the lease. Abort without writing a run row.

Renewal (called every 5 minutes during the run):

```sql
UPDATE public.sf_reconciliation_state
SET lease_expires_at = now() + interval '30 minutes', updated_at = now()
WHERE id = 1 AND lease_owner = $1
RETURNING *;
```

If zero rows returned, lease was lost. Abort with `reconciliation_lease_lost`.

Lease guard (inside every page-commit and delete-batch transaction):

```sql
-- This WHERE clause is appended to the cursor-advance UPDATE:
AND lease_owner = $1 AND lease_expires_at > now()
```

If zero rows affected, lease lost mid-transaction; the transaction rolls back and the run aborts.

Release (clean completion):

```sql
UPDATE public.sf_reconciliation_state
SET lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
WHERE id = 1 AND lease_owner = $1;
```

Clock: `now()` is always server-side (database clock). Client clocks are never consulted.

Replica ID: generated at service boot as `crypto.randomUUID()`. Recorded in each run row. The replica ID is the lease_owner value.

### 2.3 Run lifecycle

1. **Start**: acquire lease (2.2). If acquired, insert run row (`mode`, `started_at`, `replica_id`, cursor digests from the current state). Append `reconciliation_run_started` service audit.

2. **Page loop** (up to MAX_PAGES_PER_RUN):
   - Read `cursor_key` from `sf_reconciliation_state`.
   - Call R2 `ListObjectsV2` with `Prefix` unset, `StartAfter = cursor_key` (empty string for first pass or after wrap), `MaxKeys = PAGE_SIZE`.
   - For each key in the response:
     - Skip keys not under STORYFORGE_PREFIXES.
     - Parse student_ref and story_ref from the key path (format: `storyforge-audio/{student_uuid}/{story_uuid}/{asset_uuid}` or `storyforge-rec/{student_uuid}/{session_uuid}/...`). Malformed UUIDs set ref_state to `invalid_key`.
     - Call `sf_voice_audio_reference_check([key])` to determine if the key is referenced by a live asset row.
     - If referenced: increment `preserved` counter. No intent row.
     - If not referenced: call `parseKeyAttribution(key)` to determine ref_state.
       - If ref_state is `live` (the student/story entity exists but this specific asset row does not): increment `preserved` counter. No intent row. This preserves objects belonging to active entities even when the specific asset row is gone (e.g., swept by 24h/72h cleanup or lost to a crash during save).
       - If ref_state is `deleted`, `never_existed`, or `invalid_key`:
         - Check object age via R2 HeadObject `LastModified`. If younger than ELIGIBLE_AGE_DAYS, skip (preserved).
         - If mode is `dry_run`: increment `candidates` counter. No intent row, no delete.
         - If mode is `on`: execute INTEND/DELETE/RESOLVE (2.4).
   - Increment `keys_evaluated` and `pages_listed`.
   - At page boundary: one transaction commits the page counters, advances cursor to the last evaluated key, all under lease guard (2.2).
   - Check caps: if `keys_evaluated >= MAX_PAGES_PER_RUN * PAGE_SIZE` or `deleted_confirmed + object_absent >= MAX_DELETES_PER_RUN`, exit loop.
   - Renew lease if renewal interval has elapsed.

3. **Finish**: if the R2 listing returned fewer keys than PAGE_SIZE (exhaustion), reset cursor to empty (wrap). Write finished run row with all counters. Release lease. Append `reconciliation_run_finished` service audit. Run `sf_reconciliation_sweep_old_runs()`.

4. **Abort**: on any failure, write the run row with `abort_reason`, leave cursor at last committed boundary. Lease expires naturally. Append `reconciliation_run_aborted` service audit.

### 2.4 Intent-first deletion protocol (Ruling 2)

For each deletion-eligible key (mode `on` only):

**(1) INTEND**: one PostgreSQL transaction:

```sql
INSERT INTO public.sf_audio_deletion_intents (
  run_id, object_key, category, student_ref, story_ref, ref_state, state
)
VALUES ($1, $2, $3, $4, $5, $6, 'intended')
ON CONFLICT (object_key) WHERE state = 'intended'
DO NOTHING
RETURNING *;
```

The `ON CONFLICT DO NOTHING` handles the idempotent re-evaluation of an interrupted page. If the row already exists (from a prior interrupted run), the service picks it up as an unresolved intent in the recovery path.

Commit. This committed row IS the durable evidence that must exist before the object is touched.

**(2) DELETE**: one R2 `DeleteObject` call. Success and 404/NoSuchKey are both acceptable. Timeout or other failure: increment `attempts` on the intent row.

```sql
UPDATE public.sf_audio_deletion_intents
SET attempts = attempts + 1, updated_at = now()
WHERE id = $1 AND state = 'intended';
```

If `attempts < INTENT_MAX_ATTEMPTS`: append `object_delete_retried` service audit with entity_type `deletion_intent`, entity_id = intent row id, p_new = `{ attempts, category, refState }`. The DELETE will be retried in the next run's unresolved-intent recovery (Section 2.5) or, if within the same page, on re-evaluation. Increment the run row's `retried` counter.

If `attempts >= INTENT_MAX_ATTEMPTS`: set `state = 'failed'`, `resolved_at = now()`, append `reconciliation_delete_failed` service audit, and ABORT the run with `reconciliation_audit_failed`.

**(3) RESOLVE**: one PostgreSQL transaction:

```sql
UPDATE public.sf_audio_deletion_intents
SET state = $2,  -- 'deleted_confirmed' or 'object_absent'
    resolved_at = now()
WHERE id = $1 AND state = 'intended'
RETURNING *;
```

In the SAME transaction, append the service audit event via `sf_append_voice_audit_service`:
- Action: `reconciliation_deleted` (for `deleted_confirmed`) or `reconciliation_object_absent` (for `object_absent`).
- Entity type: `deletion_intent`.
- Entity ID: the intent row's id.
- `p_student_id`: NULL always. No intent row has ref_state='live' (live-entity keys are preserved, not deleted), so the student_ref is always a content-free reference value.
- `p_story_id`: NULL always. The intent row's story_ref is a content-free reference value.
- `p_new`: `jsonb_build_object('category', category, 'refState', ref_state)`.

If this transaction fails, nothing is recorded. The intent stays `intended`. On the next run (or recovery within this run), the idempotent DELETE is re-issued (returns 404), and resolution is retried. The object is truthfully called deleted ONLY when both the resolved intent row AND its audit event exist.

### 2.5 Unresolved intent recovery

At run start, after acquiring the lease, query:

```sql
SELECT * FROM public.sf_audio_deletion_intents
WHERE state = 'intended'
ORDER BY created_at ASC;
```

For each unresolved intent: re-issue DELETE (idempotent; returns 404 if already gone), then RESOLVE. If resolution succeeds, the intent joins the current run's counts. If attempts are exhausted, abort.

### 2.6 Suspension

The existing `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` environment variable, when non-empty, prevents any run from starting. The service checks this before lease acquisition. If suspended, no run row is written; the scheduler simply skips the cycle. The suspension reason is recorded in the run row if the service started but discovers suspension mid-run (which cannot happen with the pre-check, but is defensive).

### 2.7 Cursor advancement (Ruling 5)

Per committed page boundary, in one transaction with lease guard:

```sql
UPDATE public.sf_reconciliation_state
SET cursor_key = $1, updated_at = now()
WHERE id = 1 AND lease_owner = $2 AND lease_expires_at > now()
RETURNING *;
```

Where `$1` is the last evaluated key in the page. If zero rows returned, lease lost; abort.

Wrap: when the R2 listing returns `IsTruncated = false` (fewer keys than PAGE_SIZE remain), set `cursor_key = ''` (empty string) in the finish transaction. This resets the cursor to the beginning for the next run.

`dry_run` advances the cursor identically. The fairness machinery must be validated in dry_run mode.

### 2.8 Cursor digest computation

Before recording in the run row, the cursor key is hashed:

```javascript
const cursorDigest = cursorKey
  ? crypto.createHash('sha256').update(cursorKey).digest('hex')
  : '';
```

The run row stores `cursor_digest_start` (at run start) and `cursor_digest_end` (at run finish). The actual key string is NEVER stored in the run row or surfaced through the report function.

### 2.9 E13 integration (Ruling 3)

The existing admin voice-health endpoint (E13) is extended with a new field in its response:

```javascript
// Inside the E13 handler, after the existing voice health fields:
const reconciliationReport = await withIdentity(pool, identity, async (client) => {
  const { rows } = await client.query(
    'SELECT * FROM public.sf_reconciliation_report($1)',
    [5]
  );
  return rows;
});
// Return as part of the E13 response body under key 'reconciliation'
```

The 503 seam: if `sf_reconciliation_report` raises 42501 (non-admin) or any other error, the reconciliation section is omitted from the E13 response (returns `reconciliation: null`). The rest of E13 is unaffected.

## 3. RP-8 probe contracts (Ruling 1)

### 3.1 Nixpacks configuration change

Add ffmpeg to the repository's production Nixpacks configuration. This is the ONE authorized commit from Ruling 1:

In `nixpacks.toml` (or the equivalent Nixpacks configuration file):

```toml
[phases.setup]
nixPkgs = ['...', 'ffmpeg']
```

This is additive and dormant: ffmpeg is available in the built runtime but unused while `STORYFORGE_ASSEMBLY_EXECUTOR` is absent (the fail-closed `assembly_authority_blocked` path). Option A cannot ship without ffmpeg; adding it now makes the probe build equal the production build.

### 3.2 Probe server script: `scripts/rp8-probe-server.mjs`

A committed script that:

1. Generates 40 x 15-second synthetic audio fixtures using seeded deterministic generation (NOT human corpus; RP-8 has never been an accuracy probe). Each fixture is a sine-wave tone at a distinct frequency, encoded as WebM via ffmpeg.

2. Runs Option A (ffmpeg concat) twice on the 40-fixture set. Records wall time per run. Writes SHA-256 of each output artifact.

3. Runs Option B (segment validation + manifest construction) twice on the same set. Records wall time per run. Writes SHA-256/manifest hash.

4. Writes `/rp8/manifest.json` containing: per-option timings (both runs), artifact hashes, pass/fail per the criteria, overall result.

5. Serves `/rp8/manifest.json` and `/rp8/artifacts.tar` (tarball of all generated artifacts) ONLY to requests bearing the `RP8_PROBE_TOKEN` header. All other requests return 404.

6. The script is self-contained ESM (no external dependencies beyond Node built-ins and ffmpeg).

### 3.3 Probe environment

- Environment name: `rp8-probe`
- Service name: `storyforge-rp8-probe`
- Variables: `PORT` (Railway-assigned), `RP8_PROBE_TOKEN` (operator-generated 64-hex)
- NO other variables. A names-only variable listing proving emptiness is mandatory pre-run evidence.
- Start command: `node scripts/rp8-probe-server.mjs`
- Built from the exact Git-frozen candidate commit.

### 3.4 Pass criteria

Option A passes iff:
- ffmpeg is present in the built runtime (`which ffmpeg` exits 0)
- Each 10-minute assembly (40 x 15s) completes in <= 60 seconds
- Both runs produce identical output hashes
- The assembled file plays start to finish in Chrome and Safari
- A simulated-interruption rerun completes idempotently

Option B passes iff:
- Segment validation plus manifest construction completes in <= 60 seconds
- Both runs produce identical manifests
- Ordered sequential playback of the 40 downloaded segments completes in Chrome and Safari

### 3.5 Selection rule

- Both pass: OPTION A IS SELECTED (tie-break per Ruling 1)
- One passes: that one is selected
- Neither passes: gate FAILS, returns to Fable; Codex selects nothing

### 3.6 Post-selection wiring

Environment variable `STORYFORGE_ASSEMBLY_EXECUTOR`:
- Value `concat`: Option A (ffmpeg stream-copy concatenation)
- Value `copy`: Option B (segment validation + manifest)
- Absent or any other value: `assembly_authority_blocked` (existing fail-closed path)

The ruled value is set ONLY in the later separately authorized voice-activation deployment. The live dormant service is not touched by the probe.

### 3.7 Evidence and cleanup

Sealed receipt must contain:
- Railway build ID, deployment ID, image digest
- Names-only variable listing (empty proof)
- Per-option timings for both runs
- Per-option artifact SHA-256 hashes
- Chrome and Safari playback confirmation
- Simulated-interruption rerun proof
- Post-deletion listing confirming environment/service/artifacts removed

## 4. Server wiring rulings (Rulings 2-6)

### 4.1 Reconciliation scheduler

A new scheduler in the existing `server/index.mjs` startup path (or a dedicated `server/reconciliation-scheduler.mjs`):

```javascript
// At service boot:
const RECONCILIATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const replicaId = crypto.randomUUID();

// The scheduler fires weekly. It calls reconciliationService.run().
// The lease protocol (2.2) ensures only one replica executes at a time.
// If the lease is already held, the call returns immediately.
```

The scheduler respects:
- `STORYFORGE_AUDIO_RECONCILIATION` environment variable: `off` (default), `dry_run`, or `on`
- `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED`: if non-empty, skip the run

### 4.2 Reference check integration

The reconciliation service calls the EXISTING `sf_voice_audio_reference_check` function (from B1-506A M3) for each key. This function checks whether the key matches a live asset row (`pending`, `uploaded`, `verified`) via prefix match. Referenced keys are PRESERVED unconditionally.

### 4.3 Key parsing and attribution (Ruling 4)

For each key under the StoryForge prefixes:

```javascript
function parseKeyAttribution(key) {
  // storyforge-audio/{student_uuid}/{story_uuid}/{asset_uuid}[/...]
  // storyforge-rec/{student_uuid}/{session_uuid}/...
  const parts = key.split('/');
  if (parts.length < 4) return { refState: 'invalid_key', studentRef: null, storyRef: null };

  const studentRef = parseUuidOrNull(parts[1]);
  const storyRef = parts[0] === 'storyforge-audio' ? parseUuidOrNull(parts[2]) : null;

  if (!studentRef) return { refState: 'invalid_key', studentRef: null, storyRef: null };

  // Check if the referenced entities exist
  // studentRef: look up in sf_users
  // storyRef: look up in sf_stories (for storyforge-audio keys)
  // Returns: 'live', 'deleted', 'never_existed', or 'invalid_key'
}
```

The ref_state determines the disposition (applied in Section 2.3 page loop):
- `live` (student/story entity exists): PRESERVED unconditionally, regardless of whether a specific asset row references this key. No intent row is created. This is a separate check from sf_voice_audio_reference_check; even if no live asset row matches, the key is safe if its entity is live.
- `deleted`: category = `orphan_deleted_ref` (the student/story row was retired/deleted). Deletion-eligible if older than 7 days.
- `never_existed`: category = `orphan_never_existed` (no row ever existed for this UUID). Deletion-eligible if older than 7 days.
- `invalid_key`: category = `orphan_invalid_key` (malformed or non-UUID path component). Deletion-eligible if older than 7 days.

Keys outside `storyforge-audio/` and `storyforge-rec/` are out of scope and untouched forever.

### 4.4 Audit event wiring for reconciliation

All reconciliation audit events use `sf_append_voice_audit_service` with the expanded action/entity allowlists from this M4 migration. The `p_student_id` and `p_story_id` parameters follow the Ruling 4 rule: NULL for any non-`live` reference. The system NEVER fabricates a student or story link.

## 5. Known deliberate choices Codex must NOT second-guess

- The singleton `sf_reconciliation_state` row is seeded in the migration itself (not lazily). This prevents any race on first access.
- `sf_audio_deletion_intents` has NO foreign key to `sf_reconciliation_runs`. The `run_id` is a plain UUID column. This is intentional: the intent row must survive independently of run-row lifecycle (180-day sweep), and the intent's durable evidence purpose is self-contained.
- The partial unique index on `sf_audio_deletion_intents (object_key) WHERE state = 'intended'` prevents duplicate open intents while allowing historical resolved/failed intents for the same key.
- `cursor_key` is the actual R2 key (needed for `StartAfter`); `cursor_digest_start/end` in the run row are SHA-256 hashes (never the key). The reconciliation_state table holds the real key; the report function returns only digests.
- The lease uses database `now()` exclusively. No `Date.now()` or client-side timestamps are ever compared against the lease.
- `sf_reconciliation_report` is granted to `authenticated` (not `storyforge_app`) because it must be callable under the admin's identity context via `withIdentity`. The function body's `sf_has_live_identity(ARRAY['admin'])` check is the authorization gate.
- The 180-day run sweep deletes only rows with `finished_at` set. Aborted runs without `finished_at` are retained until manually resolved or until a future run finishes them.
- `storyforge_app` has no DELETE grant on `sf_audio_deletion_intents`. Intent rows are never deleted; they transition to terminal states (`deleted_confirmed`, `object_absent`, `failed`). This preserves the complete audit trail.
- The `sf_append_voice_audit_service` replacement is a CREATE OR REPLACE with the SAME signature as the M3 version. The only change is the expanded action and entity allowlists. Existing M3 callers are unaffected.
- Keys where `ref_state = 'live'` (the student/story entity exists in the database but no live asset row references this specific R2 key) are PRESERVED unconditionally. No intent row is created for them. This prevents permanent reconciliation blockage: without this rule, a key belonging to an active student whose asset row was swept would have no valid category for the intent INSERT, causing a CHECK violation that aborts the run and blocks all subsequent runs at the same cursor position.
- `sf_audio_deletion_intents` has a multi-column CHECK constraining state/resolved_at consistency: `intended` requires `resolved_at IS NULL`; terminal states (`deleted_confirmed`, `object_absent`, `failed`) require `resolved_at IS NOT NULL`. This is defense-in-depth against code bugs.
- Both `dry_run` and `on` modes perform the R2 HeadObject age check before counting/deleting. The `dry_run` candidate count reflects actual deletion eligibility (keys older than 7 days with non-live ref_state), so the Founder review gate reviews accurate numbers.
