# B1-507B - Test and Acceptance Matrix

Companion to `B1-507B_EXECUTABLE_CONTRACTS.md`. Every test below must pass before the relevant gate advances. Tests are grouped by ruling. Codex implements each test; the operator verifies the evidence column.

Conventions: "assert" means the test fails if the condition is false. "PG" means a PostgreSQL assertion (query or function call). "R2-mock" means a test-double R2 client injected into the reconciliation service. "service" means the reconciliation service module under test. Tests marked [UNIT] run without a database; [INTEGRATION] require the test database with M1-M4 applied; [E2E] require the full server stack; [MANUAL] require operator action.

---

## T0. Migration M4 structural acceptance

| ID | Test | Assert | Type |
|---|---|---|---|
| T0-01 | M4 migration applies cleanly after M1+M2+M3 | Migration completes without error; all three tables exist in `pg_tables` | INTEGRATION |
| T0-02 | M4 rollback restores prior state | Rollback drops all three tables, indexes, and policies; sf_append_voice_audit_service and sf_voice_audit_payload_ok revert to M3 versions on M3 re-apply | INTEGRATION |
| T0-03 | M4 is idempotent on function replacement | Running M4 twice produces no error (CREATE OR REPLACE) | INTEGRATION |
| T0-04 | sf_audio_deletion_intents schema check | Table has columns: id (uuid PK), run_id (uuid NOT NULL), object_key (text NOT NULL), category (text NOT NULL, CHECK), student_ref (uuid nullable), story_ref (uuid nullable), ref_state (text NOT NULL, CHECK), state (text NOT NULL DEFAULT 'intended', CHECK), attempts (int NOT NULL DEFAULT 0, CHECK 0..3), resolved_at (timestamptz nullable), created_at (timestamptz NOT NULL DEFAULT now()), updated_at (timestamptz NOT NULL DEFAULT now()); multi-column CHECK enforces state/resolved_at consistency | INTEGRATION |
| T0-05 | sf_reconciliation_runs schema check | Table has all 18 columns per DDL; mode CHECK ('dry_run','on'); counters default 0; suspended default false | INTEGRATION |
| T0-06 | sf_reconciliation_state schema check | Table has columns: id (int PK, CHECK id=1), cursor_key (text NOT NULL DEFAULT ''), lease_owner (text nullable), lease_expires_at (timestamptz nullable), updated_at (timestamptz NOT NULL DEFAULT now()) | INTEGRATION |
| T0-07 | Singleton row seeded | `SELECT count(*) FROM sf_reconciliation_state` = 1; id = 1; cursor_key = '' | INTEGRATION |
| T0-08 | Singleton enforcement | INSERT into sf_reconciliation_state with id=2 fails (CHECK violation); INSERT with id=1 fails (PK violation) | INTEGRATION |
| T0-09 | RLS enforcement on all three tables | All three tables have FORCE ROW LEVEL SECURITY enabled; `relforcerowsecurity = true` in pg_class | INTEGRATION |
| T0-10 | Grant isolation: deletion_intents | anon, authenticated, PUBLIC have no grants; storyforge_app has SELECT, INSERT, UPDATE (no DELETE) | INTEGRATION |
| T0-11 | Grant isolation: reconciliation_runs | anon, authenticated, PUBLIC have no grants; storyforge_app has SELECT, INSERT, UPDATE | INTEGRATION |
| T0-12 | Grant isolation: reconciliation_state | anon, authenticated, PUBLIC have no grants; storyforge_app has SELECT, UPDATE (no INSERT, no DELETE) | INTEGRATION |
| T0-13 | Partial unique index exists | Index `sf_deletion_intents_open_key_idx` exists on (object_key) WHERE state = 'intended' | INTEGRATION |
| T0-14 | Supporting indexes exist | `sf_deletion_intents_run_idx` on (run_id, created_at); `sf_deletion_intents_unresolved_idx` on (state, created_at) WHERE state = 'intended'; `sf_reconciliation_runs_started_idx` on (started_at DESC) | INTEGRATION |

---

## T1. RP-8 probe contracts (Ruling 1)

| ID | Test | Assert | Type |
|---|---|---|---|
| T1-01 | Nixpacks config includes ffmpeg | The Nixpacks configuration file lists `ffmpeg` in the setup phase packages | UNIT |
| T1-02 | Probe server script exists | `scripts/rp8-probe-server.mjs` exists and is valid ESM (node --check passes) | UNIT |
| T1-03 | Fixture generation is deterministic | Two runs of fixture generation with the same seed produce byte-identical files (SHA-256 match) | UNIT |
| T1-04 | Token authentication enforced | Requests to `/rp8/manifest.json` without `RP8_PROBE_TOKEN` header return 404; with correct token return 200 | UNIT |
| T1-05 | Token authentication on artifacts | Requests to `/rp8/artifacts.tar` without token return 404; with correct token return 200 | UNIT |
| T1-06 | Non-probe routes return 404 | Requests to any path other than `/rp8/manifest.json` and `/rp8/artifacts.tar` return 404 | UNIT |
| T1-07 | Manifest structure | manifest.json contains: per-option timings array (2 entries each), per-option hash arrays, per-option pass boolean, overall result string | UNIT |
| T1-08 | Option A pass criteria evaluated | Option A marked pass iff: ffmpeg present (which ffmpeg = 0), each assembly <= 60s, both run hashes identical, interruption rerun idempotent | UNIT |
| T1-09 | Option B pass criteria evaluated | Option B marked pass iff: segment validation + manifest <= 60s, both run manifests identical | UNIT |
| T1-10 | Tie-break: both pass selects A | When both options pass, manifest.result = 'option_a' | UNIT |
| T1-11 | Single pass: selects the passer | When only Option A passes, result = 'option_a'; when only B passes, result = 'option_b' | UNIT |
| T1-12 | Neither passes: gate fails | When neither passes, result = 'gate_failed' | UNIT |
| T1-13 | Probe environment variables | The probe service has ONLY PORT and RP8_PROBE_TOKEN; names-only listing confirms no other variables | MANUAL |
| T1-14 | ffmpeg available in probe build | `which ffmpeg` exits 0 inside the probe service container | MANUAL |
| T1-15 | Option A timing under threshold | Both Option A runs complete 40x15s assembly in <= 60 seconds | MANUAL |
| T1-16 | Option A hash determinism | Both Option A runs produce identical SHA-256 for each output artifact | MANUAL |
| T1-17 | Option B timing under threshold | Both Option B runs complete segment validation + manifest in <= 60 seconds | MANUAL |
| T1-18 | Option B manifest determinism | Both Option B runs produce identical manifest hashes | MANUAL |
| T1-19 | Chrome playback (selected option) | Selected option's output plays start to finish in Chrome | MANUAL |
| T1-20 | Safari playback (selected option) | Selected option's output plays start to finish in Safari | MANUAL |
| T1-21 | Interruption rerun (Option A) | After simulated interruption, rerun produces same output (idempotent) | MANUAL |
| T1-22 | Probe environment deleted | Post-probe Railway listing confirms rp8-probe environment and storyforge-rp8-probe service no longer exist | MANUAL |
| T1-23 | Sealed receipt complete | Receipt contains: build ID, deployment ID, image digest, empty-variable proof, per-option timings, hashes, playback evidence, interruption proof, post-deletion listing | MANUAL |

---

## T2. FABLE-C1 deletion and audit truth (Ruling 2)

| ID | Test | Assert | Type |
|---|---|---|---|
| T2-01 | INTEND inserts intent row | Calling INTEND for a key produces a row with state='intended', attempts=0, resolved_at=NULL, correct run_id/category/refs | INTEGRATION |
| T2-02 | INTEND is idempotent (same key) | Two INTEND calls for the same object_key while state='intended': second returns zero rows (ON CONFLICT DO NOTHING), no duplicate row created | INTEGRATION |
| T2-03 | INTEND after resolved allows new intent | After resolving an intent (state='deleted_confirmed'), a new INTEND for the same key succeeds (partial index allows it) | INTEGRATION |
| T2-04 | INTEND after failed allows new intent | After failing an intent (state='failed'), a new INTEND for the same key succeeds | INTEGRATION |
| T2-05 | DELETE success resolves as deleted_confirmed | After R2 DeleteObject succeeds (200), RESOLVE sets state='deleted_confirmed', resolved_at=now() | INTEGRATION |
| T2-06 | DELETE 404 resolves as object_absent | After R2 DeleteObject returns 404/NoSuchKey, RESOLVE sets state='object_absent', resolved_at=now() | INTEGRATION |
| T2-07 | DELETE failure increments attempts | R2 DeleteObject timeout: attempts incremented by 1, state stays 'intended' | INTEGRATION |
| T2-08 | Attempts cap at 3 triggers failure | After 3 failed DELETE attempts, state transitions to 'failed' | INTEGRATION |
| T2-09 | Failed intent aborts run | When an intent reaches state='failed', the run aborts with abort_reason containing 'reconciliation_audit_failed' | INTEGRATION |
| T2-10 | RESOLVE writes audit event atomically | The resolved intent and audit event are in the same transaction: both exist or neither | INTEGRATION |
| T2-11 | Audit event action: reconciliation_deleted | For state='deleted_confirmed', audit action = 'reconciliation_deleted' | INTEGRATION |
| T2-12 | Audit event action: reconciliation_object_absent | For state='object_absent', audit action = 'reconciliation_object_absent' | INTEGRATION |
| T2-13 | Audit event entity is deletion_intent | Entity type = 'deletion_intent', entity_id = intent row id | INTEGRATION |
| T2-14 | Audit event NULL student/story for orphans | When ref_state != 'live', p_student_id = NULL and p_story_id = NULL in the audit event | INTEGRATION |
| T2-15 | No intent row written in dry_run | In mode='dry_run', no rows appear in sf_audio_deletion_intents | INTEGRATION |
| T2-16 | No R2 DeleteObject in dry_run | In mode='dry_run', the R2 mock receives zero DeleteObject calls | INTEGRATION |
| T2-17 | Crash recovery: intended row survives | Simulate crash between INTEND and DELETE: intent row with state='intended' persists; next run recovers it | INTEGRATION |
| T2-18 | Crash recovery: re-DELETE is idempotent | After crash between DELETE and RESOLVE: re-issued DELETE returns 404; RESOLVE succeeds as 'object_absent' | INTEGRATION |
| T2-19 | State CHECK constraint enforced | INSERT/UPDATE with state not in ('intended','deleted_confirmed','object_absent','failed') raises CHECK violation | INTEGRATION |
| T2-20 | Category CHECK constraint enforced | INSERT with category not in ('orphan_deleted_ref','orphan_never_existed','orphan_invalid_key') raises CHECK violation | INTEGRATION |
| T2-21 | ref_state CHECK constraint enforced | INSERT with ref_state not in ('live','deleted','never_existed','invalid_key') raises CHECK violation | INTEGRATION |
| T2-22 | Attempts CHECK constraint enforced | UPDATE setting attempts > 3 or < 0 raises CHECK violation | INTEGRATION |
| T2-23 | No DELETE grant on intents table | storyforge_app cannot DELETE from sf_audio_deletion_intents (intent rows are never deleted) | INTEGRATION |
| T2-24 | Retry emits object_delete_retried audit | When DELETE fails and attempts < 3, an audit event with action='object_delete_retried' is appended, and run row retried counter increments | INTEGRATION |
| T2-25 | State/resolved_at consistency CHECK | INSERT with state='intended' and resolved_at set fails; INSERT with state='deleted_confirmed' and resolved_at NULL fails | INTEGRATION |

---

## T3. FABLE-C2 operator visibility (Ruling 3)

| ID | Test | Assert | Type |
|---|---|---|---|
| T3-01 | sf_reconciliation_report: admin succeeds | With admin identity (sf_has_live_identity(ARRAY['admin'])), function returns rows ordered by started_at DESC | INTEGRATION |
| T3-02 | sf_reconciliation_report: student denied | With student identity, function raises 42501 | INTEGRATION |
| T3-03 | sf_reconciliation_report: mentor denied | With mentor/instructor identity, function raises 42501 | INTEGRATION |
| T3-04 | sf_reconciliation_report: service role denied | As storyforge_app without admin identity context, function raises 42501 | INTEGRATION |
| T3-05 | sf_reconciliation_report: anon denied | As anon role, function is not executable (no GRANT) | INTEGRATION |
| T3-06 | sf_reconciliation_report: p_limit clamped low | p_limit=0 returns 1 row (clamped to greatest(1,...)) | INTEGRATION |
| T3-07 | sf_reconciliation_report: p_limit clamped high | p_limit=100 returns at most 8 rows (clamped to least(...,8)) | INTEGRATION |
| T3-08 | sf_reconciliation_report: default limit | NULL p_limit returns at most 5 rows (coalesce to 5) | INTEGRATION |
| T3-09 | Report contains all required fields | Returned columns: run_id, mode, started_at, finished_at, pages_listed, keys_evaluated, candidates, preserved, deleted_confirmed, object_absent, retried, failed, abort_reason, suspended, suspension_reason, cursor_digest_start, cursor_digest_end, replica_id | INTEGRATION |
| T3-10 | Report contains NO object keys | No column in sf_reconciliation_runs or sf_reconciliation_report output can hold an R2 object key | INTEGRATION |
| T3-11 | Report contains NO student/story UUIDs | No column in sf_reconciliation_runs references student or story identifiers | INTEGRATION |
| T3-12 | Cursor values are digests only | cursor_digest_start and cursor_digest_end are SHA-256 hex strings (64 chars) or empty, never raw keys | INTEGRATION |
| T3-13 | 180-day sweep deletes old finished runs | sf_reconciliation_sweep_old_runs deletes rows where finished_at < now() - 180 days and finished_at IS NOT NULL | INTEGRATION |
| T3-14 | 180-day sweep preserves unfinished runs | Rows with finished_at = NULL are not deleted regardless of age | INTEGRATION |
| T3-15 | 180-day sweep preserves recent runs | Rows with finished_at within 180 days are not deleted | INTEGRATION |
| T3-16 | E13 returns reconciliation report | GET /api/storyforge/voice-health with admin identity includes `reconciliation` array in response | E2E |
| T3-17 | E13 503 seam: non-admin | GET /api/storyforge/voice-health with non-admin identity: reconciliation field is null, rest of response intact | E2E |
| T3-18 | E13 503 seam: function error | If sf_reconciliation_report throws, reconciliation field is null, HTTP status still 200, rest of E13 unaffected | E2E |
| T3-19 | WordPress admin status insufficient | A user with WordPress administrator role but app_role != 'admin' cannot access the reconciliation report | INTEGRATION |

---

## T4. FABLE-C3 orphan attribution (Ruling 4)

| ID | Test | Assert | Type |
|---|---|---|---|
| T4-01 | Live-referenced key is preserved | Key matching a live asset row (state in pending/uploaded/verified) is never marked as deletion candidate | INTEGRATION |
| T4-02 | Deleted-ref key is eligible | Key whose student/story reference points to a deleted/retired entity gets category='orphan_deleted_ref', ref_state='deleted' | INTEGRATION |
| T4-03 | Never-existed key is eligible | Key whose parsed UUIDs match no entity gets category='orphan_never_existed', ref_state='never_existed' | INTEGRATION |
| T4-04 | Invalid key is eligible | Key with malformed/non-UUID path components gets category='orphan_invalid_key', ref_state='invalid_key' | INTEGRATION |
| T4-05 | Short key is invalid | Key with fewer than 4 path segments gets ref_state='invalid_key' | UNIT |
| T4-06 | storyforge-audio key parsing | `storyforge-audio/{student}/{story}/{asset}` correctly extracts student_ref and story_ref | UNIT |
| T4-07 | storyforge-rec key parsing | `storyforge-rec/{student}/{session}/...` correctly extracts student_ref; story_ref = null | UNIT |
| T4-08 | Out-of-scope key untouched | Key not under `storyforge-audio/` or `storyforge-rec/` is skipped entirely (not counted, no intent) | INTEGRATION |
| T4-09 | 7-day age floor enforced | Eligible key younger than 7 days (per R2 HeadObject LastModified) is preserved, not deleted | INTEGRATION |
| T4-10 | 7-day age floor: old key eligible | Eligible key older than 7 days proceeds to deletion | INTEGRATION |
| T4-11 | Content-free intent references | Intent row student_ref and story_ref are plain UUID columns with NO foreign key constraint; inserting arbitrary UUIDs succeeds | INTEGRATION |
| T4-12 | NULL audit FK for orphan | Audit event for orphan (ref_state != 'live') has student_id = NULL and story_id = NULL | INTEGRATION |
| T4-13 | No fabricated links | The system never inserts a non-NULL student_id or story_id in audit events for non-live references, even when student_ref/story_ref are populated in the intent row | INTEGRATION |
| T4-14 | Audit payload contains category and refState | p_new jsonb includes 'category' and 'refState' keys matching the intent row values | INTEGRATION |
| T4-15 | Reference check uses existing function | The reconciliation service calls sf_voice_audio_reference_check (M3) for live-asset determination | INTEGRATION |
| T4-16 | Live-entity unreferenced key preserved | Key NOT matched by sf_voice_audio_reference_check but parseKeyAttribution returns ref_state='live' (student entity exists, asset row gone): key is preserved, no intent row created, preserved counter incremented | INTEGRATION |
| T4-17 | dry_run age floor enforced | In dry_run mode, eligible key younger than 7 days is preserved (not counted as candidate) | INTEGRATION |

---

## T5. FABLE-C4 fairness and continuation (Ruling 5)

| ID | Test | Assert | Type |
|---|---|---|---|
| T5-01 | Cursor starts empty | Initial cursor_key in sf_reconciliation_state = '' (empty string) | INTEGRATION |
| T5-02 | R2 listing uses StartAfter | R2 ListObjectsV2 is called with StartAfter = cursor_key value | INTEGRATION |
| T5-03 | Cursor advances per page | After processing a full page (1000 keys), cursor_key = last evaluated key in that page | INTEGRATION |
| T5-04 | Cursor advances under lease guard | The cursor-advance UPDATE includes WHERE lease_owner = $self AND lease_expires_at > now() | INTEGRATION |
| T5-05 | Cursor wraps on exhaustion | When R2 IsTruncated = false (no more keys), cursor_key resets to '' | INTEGRATION |
| T5-06 | Partial page does not advance prematurely | If a run processes fewer than PAGE_SIZE keys (last page), cursor wraps to empty on finish | INTEGRATION |
| T5-07 | Abort preserves cursor at last boundary | On abort mid-page, cursor stays at the last committed page boundary (not advanced to the abort point) | INTEGRATION |
| T5-08 | dry_run advances cursor identically | In dry_run mode, cursor advances the same way as in 'on' mode | INTEGRATION |
| T5-09 | 5-page cap enforced | After 5 pages (5000 keys), the run exits the page loop even if keys remain | INTEGRATION |
| T5-10 | 200-delete cap enforced | After 200 deletions (deleted_confirmed + object_absent), the run exits even if pages remain | INTEGRATION |
| T5-11 | Caps interact correctly | A run hitting 200 deletes on page 3 stops at page 3, cursor at page 3's last key | INTEGRATION |
| T5-12 | Later run resumes from cursor | After a capped run, the next run starts R2 listing from the stored cursor_key | INTEGRATION |
| T5-13 | Full wrap covers all keys | With N keys, ceil(N/5000) sequential runs evaluate every key at least once before wrap | INTEGRATION |
| T5-14 | Cursor is durable across restarts | cursor_key persists in the database; a new service instance reads the correct value | INTEGRATION |
| T5-15 | Interrupted page is re-evaluated | On crash mid-page, the page's keys are re-evaluated next run (cursor did not advance past them) | INTEGRATION |
| T5-16 | Dedup on re-evaluation | Re-evaluating a page with existing 'intended' intents does not create duplicate intents (partial unique index) | INTEGRATION |

---

## T6. PROBE-C5 scheduler coordination (Ruling 6)

| ID | Test | Assert | Type |
|---|---|---|---|
| T6-01 | Lease acquisition: empty state | With lease_owner = NULL, acquisition UPDATE returns 1 row; lease_owner = replicaId, lease_expires_at = now() + 30 min | INTEGRATION |
| T6-02 | Lease acquisition: expired lease | With lease_expires_at in the past, acquisition UPDATE returns 1 row (takeover) | INTEGRATION |
| T6-03 | Lease acquisition: active lease blocked | With lease_owner = other and lease_expires_at in the future, acquisition UPDATE returns 0 rows | INTEGRATION |
| T6-04 | Lease renewal succeeds for owner | Renewal UPDATE with matching lease_owner returns 1 row; lease_expires_at extended | INTEGRATION |
| T6-05 | Lease renewal fails for non-owner | Renewal UPDATE with wrong lease_owner returns 0 rows | INTEGRATION |
| T6-06 | Lease guard in page commit | The cursor-advance UPDATE includes lease_owner and lease_expires_at guards; if lease lost, 0 rows returned, transaction rolls back | INTEGRATION |
| T6-07 | Lease lost aborts run | When lease guard returns 0 rows, run aborts with abort_reason = 'reconciliation_lease_lost' | INTEGRATION |
| T6-08 | Lease release on clean completion | After successful run, lease_owner = NULL and lease_expires_at = NULL in sf_reconciliation_state | INTEGRATION |
| T6-09 | Crash: lease expires naturally | After simulated crash (no explicit release), lease_expires_at passes; next acquisition succeeds | INTEGRATION |
| T6-10 | Concurrent run excluded | Two concurrent reconciliation service instances: only one acquires the lease; the other returns immediately without writing a run row | INTEGRATION |
| T6-11 | Replica ID is unique per boot | Two service boots produce different crypto.randomUUID() replica IDs | UNIT |
| T6-12 | Database clock only | All lease comparisons use now() (server-side); no Date.now() or client-side timestamp appears in lease SQL | UNIT |
| T6-13 | Lease constants fixed in code | LEASE_DURATION_MS = 1800000 (30 min), LEASE_RENEWAL_MS = 300000 (5 min); no environment variable overrides | UNIT |
| T6-14 | Renewal interval respected | Lease renewal is called approximately every 5 minutes during a long run (within 30-second tolerance) | INTEGRATION |
| T6-15 | Topology recorded but not relied on | Run row contains replica_id; no safety logic branches on replica_id or replica count | UNIT |

---

## T7. Updated audit functions (Rulings 2-4)

| ID | Test | Assert | Type |
|---|---|---|---|
| T7-01 | sf_append_voice_audit_service: existing M3 actions still work | All original M3 actions (recording_cancelled, recording_swept, assembly_completed, assembly_failed, segment_transcribed, segment_transcribe_failed, provider_failover) accepted | INTEGRATION |
| T7-02 | sf_append_voice_audit_service: new reconciliation actions accepted | reconciliation_deleted, object_delete_retried, reconciliation_object_absent, reconciliation_delete_failed, reconciliation_run_started, reconciliation_run_finished, reconciliation_run_aborted, reconciliation_lease_acquired, reconciliation_lease_lost all accepted | INTEGRATION |
| T7-03 | sf_append_voice_audit_service: unknown action rejected | Action 'reconciliation_unknown' raises 22023 | INTEGRATION |
| T7-04 | sf_append_voice_audit_service: new entity types accepted | deletion_intent, reconciliation_run, reconciliation_state accepted alongside existing M3 entity types | INTEGRATION |
| T7-05 | sf_append_voice_audit_service: unknown entity rejected | Entity type 'deletion_log' raises 22023 | INTEGRATION |
| T7-06 | sf_voice_audit_payload_ok: existing M3 keys pass | All M3-era keys (state, scope, allowlist, cohorts, errorCategory, code, seq, recordingId, etc.) still accepted | INTEGRATION |
| T7-07 | sf_voice_audit_payload_ok: new reconciliation keys pass | mode, pagesListed, keysEvaluated, candidates, preserved, deletedConfirmed, objectAbsent, retried, failed, abortReason, category, refState, attempts, cursorDigest, replicaId, leaseOwner, suspended, suspensionReason all accepted | INTEGRATION |
| T7-08 | sf_voice_audit_payload_ok: unknown key rejected | Key 'objectKey' (intentionally NOT in allowlist) returns false | INTEGRATION |
| T7-09 | sf_voice_audit_payload_ok: state allowlist expanded | New state values 'intended', 'deleted_confirmed', 'object_absent' accepted alongside M3 values | INTEGRATION |
| T7-10 | sf_voice_audit_payload_ok: reason allowlist expanded | New reason values 'reconciliation_audit_failed', 'reconciliation_lease_lost', 'reconciliation_caps_reached', 'reconciliation_suspension' accepted alongside M3 values | INTEGRATION |
| T7-11 | sf_voice_audit_payload_ok: mode values validated | mode must be 'dry_run' or 'on'; 'off' rejected | INTEGRATION |
| T7-12 | sf_voice_audit_payload_ok: category values validated | category must be 'orphan_deleted_ref', 'orphan_never_existed', or 'orphan_invalid_key' | INTEGRATION |
| T7-13 | sf_voice_audit_payload_ok: refState values validated | refState must be 'live', 'deleted', 'never_existed', or 'invalid_key' | INTEGRATION |
| T7-14 | sf_voice_audit_payload_ok: 4096-char cap preserved | Payload exceeding 4096 chars returns false | INTEGRATION |
| T7-15 | sf_voice_audit_payload_ok: 12-key cap preserved | Payload with > 12 keys returns false | INTEGRATION |
| T7-16 | Function signature unchanged | sf_append_voice_audit_service(text, text, uuid, uuid, uuid, jsonb, jsonb) returns bigint -- identical to M3 | INTEGRATION |

---

## T8. Integration and end-to-end

| ID | Test | Assert | Type |
|---|---|---|---|
| T8-01 | Full dry_run cycle: empty bucket | With zero R2 keys, run completes: pages_listed=0, keys_evaluated=0, candidates=0; cursor wraps to '' | INTEGRATION |
| T8-02 | Full dry_run cycle: mixed keys | R2 mock returns 10 keys (3 referenced, 2 orphan-deleted-ref, 2 orphan-never-existed, 1 invalid, 2 out-of-scope). Verify: keys_evaluated=8 (out-of-scope skipped), candidates=5, preserved=3, no intents written, no deletes issued | INTEGRATION |
| T8-03 | Full dry_run cycle: cursor advancement | With 2500 keys across 3 pages, dry_run advances cursor after each page and wraps on completion | INTEGRATION |
| T8-04 | Full 'on' cycle: single deletion | R2 mock with 1 orphan key older than 7 days: INTEND -> DELETE -> RESOLVE completes; intent row state='deleted_confirmed'; audit event exists; run row shows deleted_confirmed=1 | INTEGRATION |
| T8-05 | Full 'on' cycle: mixed outcomes | R2 mock with: 2 preserved (live ref), 1 preserved (< 7 days), 1 deleted_confirmed, 1 object_absent. Verify all counters correct in run row | INTEGRATION |
| T8-06 | Suspension check | With STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED='maintenance', no run starts, no run row written | INTEGRATION |
| T8-07 | Mode 'off' prevents run | With STORYFORGE_AUDIO_RECONCILIATION='off', scheduler does not call reconciliation service | E2E |
| T8-08 | Mode 'dry_run' activates dry_run | With STORYFORGE_AUDIO_RECONCILIATION='dry_run', service runs in dry_run mode | E2E |
| T8-09 | Mode 'on' activates live mode | With STORYFORGE_AUDIO_RECONCILIATION='on', service runs in 'on' mode | E2E |
| T8-10 | Unresolved intent recovery at start | Insert an 'intended' intent row from a prior (simulated crashed) run; start a new run; the recovery path resolves it before the page loop | INTEGRATION |
| T8-11 | Unresolved intent: exhausted attempts abort | Insert an 'intended' intent with attempts=3; new run detects it, sets state='failed', aborts | INTEGRATION |
| T8-12 | Run row completeness | Finished run row has all counters populated, finished_at set, abort_reason NULL, cursor digests are SHA-256 hex or empty | INTEGRATION |
| T8-13 | Aborted run row completeness | Aborted run row has abort_reason set, finished_at may be NULL, cursor at last committed boundary | INTEGRATION |
| T8-14 | E13 voice-health includes reconciliation | After a completed dry_run, E13 with admin identity returns reconciliation array with at least one run entry showing the correct counters | E2E |
| T8-15 | Weekly scheduler fires | The reconciliation scheduler triggers approximately every 7 days (verify via timer/cron configuration) | E2E |
| T8-16 | Post-selection wiring: concat | With STORYFORGE_ASSEMBLY_EXECUTOR='concat', the assembly path uses the ffmpeg concat executor | E2E |
| T8-17 | Post-selection wiring: copy | With STORYFORGE_ASSEMBLY_EXECUTOR='copy', the assembly path uses the segment-copy executor | E2E |
| T8-18 | Post-selection wiring: absent | With STORYFORGE_ASSEMBLY_EXECUTOR absent, assembly returns assembly_authority_blocked | E2E |
| T8-19 | Post-selection wiring: invalid | With STORYFORGE_ASSEMBLY_EXECUTOR='invalid', assembly returns assembly_authority_blocked | E2E |

---

## T9. Security and redaction

| ID | Test | Assert | Type |
|---|---|---|---|
| T9-01 | Student cannot read deletion intents | As authenticated with student identity, SELECT on sf_audio_deletion_intents returns 0 rows (no policy) | INTEGRATION |
| T9-02 | Student cannot read reconciliation runs | As authenticated with student identity, SELECT on sf_reconciliation_runs returns 0 rows | INTEGRATION |
| T9-03 | Student cannot read reconciliation state | As authenticated with student identity, SELECT on sf_reconciliation_state returns 0 rows | INTEGRATION |
| T9-04 | Mentor cannot read deletion intents | As authenticated with mentor identity, SELECT on sf_audio_deletion_intents returns 0 rows | INTEGRATION |
| T9-05 | Object keys never in report | sf_reconciliation_report output contains no column capable of holding an R2 object key string | INTEGRATION |
| T9-06 | Cursor digests are hashes | All cursor_digest_start/end values in sf_reconciliation_runs match /^[0-9a-f]{64}$/ or are empty string | INTEGRATION |
| T9-07 | No student/story UUID in run row | sf_reconciliation_runs schema has no student_id, story_id, or similar column | INTEGRATION |
| T9-08 | sf_reconciliation_report is SECURITY DEFINER | Function security = SECURITY DEFINER with search_path = public, pg_temp | INTEGRATION |
| T9-09 | Intent row object_key not surfaced | The object_key column in sf_audio_deletion_intents is service-visible only; no function or endpoint returns it to any user role | INTEGRATION |
| T9-10 | Audit events for orphans have NULL FKs | Every audit event with action in ('reconciliation_deleted','reconciliation_object_absent') for non-live ref_state has student_id = NULL and story_id = NULL | INTEGRATION |

---

## Acceptance gates

### Gate G1: M4 migration acceptance

All T0 tests pass. Required before any reconciliation code is tested.

### Gate G2: Reconciliation service unit/integration

All T2, T3, T4, T5, T6, T7 tests pass. Required before E2E or dry_run.

### Gate G3: RP-8 probe (code tests)

All T1 UNIT tests pass. Required before the probe environment is created.

### Gate G4: RP-8 probe (manual evidence)

All T1 MANUAL tests pass. Produces the sealed receipt. Required before STORYFORGE_ASSEMBLY_EXECUTOR is set.

### Gate G5: Integration and security

All T8 and T9 tests pass. Required before dry_run in production.

### Gate G6: dry_run acceptance (production)

Two consecutive clean dry_run runs with zero unexpected failures and counts reviewed. Required before mode='on'. This is the pre-existing Founder review gate (unchanged).

### Total test count

| Section | UNIT | INTEGRATION | E2E | MANUAL | Total |
|---|---|---|---|---|---|
| T0 Migration | 0 | 14 | 0 | 0 | 14 |
| T1 RP-8 | 12 | 0 | 0 | 11 | 23 |
| T2 C1 deletion | 0 | 25 | 0 | 0 | 25 |
| T3 C2 visibility | 0 | 16 | 3 | 0 | 19 |
| T4 C3 attribution | 2 | 15 | 0 | 0 | 17 |
| T5 C4 fairness | 0 | 16 | 0 | 0 | 16 |
| T6 C5 scheduler | 3 | 12 | 0 | 0 | 15 |
| T7 Audit functions | 0 | 16 | 0 | 0 | 16 |
| T8 Integration/E2E | 0 | 11 | 8 | 0 | 19 |
| T9 Security | 0 | 10 | 0 | 0 | 10 |
| **Total** | **17** | **135** | **11** | **11** | **174** |
