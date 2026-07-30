# [B1-507B-IMPL] STORYFORGE V5.5 PHASE 1 - FINAL BINDING IMPLEMENTATION

Model: Codex GPT-5.6 Sol Ultra. Paste this document as the run prompt.

Codex may implement these rulings. Codex may not reinterpret them.

## Authority

1. `_AI_HANDOFFS/from_cowork/B1-507B_storyforge_phase1_final_binding/B1-507B_FABLE_BINDING_AUTHORITY.md` (the seven rulings).
2. `B1-507B_EXECUTABLE_CONTRACTS.md` (literal SQL, schemas, procedures; it GOVERNS on any wording difference).
3. `B1-507B_TEST_AND_ACCEPTANCE_MATRIX.md` (174 tests across 10 sections).
4. Everything else stands unchanged: B1-504A/B technical authority, B1-505C sequencing, B1-506A/B amendment, the B1-507A Codex build, both verbatim stop rules, the stop scope, and the fail-closed posture for every lane this ruling does not touch.

Work only in worktree `B1-StoryForge-502` on branch `codex/b1-503-storyforge-product-recovery`, starting from HEAD of the B1-507A build. Preflight: verify HEAD, verify M1 through M3 migration SHAs match the committed runner pins, verify the B1-507B MANIFEST.sha256. Any mismatch = STOP.

## Scope (exactly four implementation lanes)

### Lane 1: M4 migration

Add migration `infra/postgres/migrations/20260730000100_b1_507b_reconciliation_state.sql` and its rollback EXACTLY as printed in the executable contracts document Section 1. This migration:

- Creates three tables: `sf_audio_deletion_intents`, `sf_reconciliation_runs`, `sf_reconciliation_state`
- Creates the `sf_reconciliation_report` SECURITY DEFINER function
- Replaces `sf_append_voice_audit_service` with the expanded action/entity allowlists
- Replaces `sf_voice_audit_payload_ok` with the expanded key/value allowlists
- Creates `sf_reconciliation_sweep_old_runs`
- Seeds the singleton reconciliation_state row

Post-apply verification: all T0 tests from the acceptance matrix pass. The three tables exist, RLS is FORCE-enabled, grants are isolated, the singleton row has id=1 and cursor_key=''. The partial unique index exists. The rollback SQL cleanly drops all three tables. Add migration SHA to the runner pin locations alongside M1-M3.

### Lane 2: Reconciliation service module

Create `server/reconciliation.mjs` implementing the complete state machine from executable contracts Sections 2.1 through 2.9:

- `createReconciliationService(deps)` factory accepting `{ pool, r2Client, config, logger }`
- Configuration constants from Section 2.1 (fixed in code, NO new environment variables)
- Lease protocol from Section 2.2 (acquisition, renewal, guard, release; database now() only)
- Run lifecycle from Section 2.3 (start, page loop, finish, abort)
- Intent-first deletion from Section 2.4 (INTEND/DELETE/RESOLVE, exactly as printed)
- Unresolved intent recovery from Section 2.5
- Suspension check from Section 2.6
- Cursor advancement from Section 2.7 (per-page under lease guard, wrap on exhaustion)
- Cursor digest computation from Section 2.8
- Key parsing and attribution from Section 4.3 (parseKeyAttribution function)

The module reads `STORYFORGE_AUDIO_RECONCILIATION` ('off'|'dry_run'|'on') and `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` from config. It calls the EXISTING `sf_voice_audio_reference_check` (M3) for live-asset determination. It calls the EXISTING `sf_append_voice_audit_service` (M4-updated) for all audit events. Orphan audit events pass `p_student_id = NULL` and `p_story_id = NULL` when ref_state is not 'live'.

Wire the scheduler in `server/index.mjs`: weekly interval, replicaId from `crypto.randomUUID()` at boot, check mode and suspension before calling `reconciliationService.run()`.

Post-implementation verification: all T2, T4, T5, T6 tests pass.

### Lane 3: E13 reconciliation report integration

Extend the existing E13 voice-health handler per Section 2.9:

- Call `sf_reconciliation_report(5)` under `withIdentity`
- Return the result under the `reconciliation` key in the E13 response
- 503 seam: if the report function raises 42501 or any error, set `reconciliation: null`; the rest of E13 is unaffected

Post-implementation verification: all T3 tests pass.

### Lane 4: RP-8 probe infrastructure

1. Add ffmpeg to the Nixpacks configuration per Section 3.1 (additive, dormant; the ONE authorized production-config commit).
2. Create `scripts/rp8-probe-server.mjs` per Section 3.2 (deterministic fixture generation, both-option dual runs, manifest output, token-gated serving).
3. Wire the post-selection executor routing per Section 3.6: `STORYFORGE_ASSEMBLY_EXECUTOR` with values `concat` (Option A) and `copy` (Option B); absent or invalid = `assembly_authority_blocked`.

Post-implementation verification: all T1 UNIT tests pass. The MANUAL tests (T1-13 through T1-23) are executed by the operator AFTER the probe environment is created; Codex does not create the probe environment.

## Known deliberate choices (DO NOT second-guess)

These eleven items from executable contracts Section 5 are binding design decisions, not oversights:

1. The singleton sf_reconciliation_state row is seeded in the migration (not lazily).
2. sf_audio_deletion_intents has NO foreign key to sf_reconciliation_runs; run_id is a plain UUID.
3. The partial unique index on (object_key) WHERE state = 'intended' prevents duplicate open intents while allowing historical rows.
4. cursor_key in sf_reconciliation_state is the actual R2 key; cursor_digest_start/end in run rows are SHA-256 hashes.
5. Lease comparisons use database now() exclusively; no Date.now() or client timestamps.
6. sf_reconciliation_report is granted to authenticated (not storyforge_app) because admin's identity context calls it via withIdentity.
7. The 180-day sweep deletes only rows with finished_at set; unfinished rows are retained.
8. storyforge_app has no DELETE grant on sf_audio_deletion_intents; intents transition to terminal states.
9. sf_append_voice_audit_service replacement is CREATE OR REPLACE with the same signature; existing M3 callers are unaffected.
10. Keys where ref_state='live' (student/story entity exists but no live asset row references this key) are PRESERVED unconditionally. No intent row is created. This prevents permanent reconciliation blockage on keys belonging to active entities.
11. sf_audio_deletion_intents has a multi-column CHECK enforcing state/resolved_at consistency: intended requires resolved_at NULL; terminal states require resolved_at NOT NULL.

## Hard boundaries

No deployment, no production or remote mutation, no provider calls, no R2 operations against real buckets, no creation of the RP-8 Railway probe environment (operator-only), no tables or functions beyond the printed M4 migration, no new endpoints, no Docker repair or destructive Docker action, no scope or flag change, no edits to any B1-504A/B1-504B/B1-505C/B1-506A/B1-507A/B1-507B document, no change to the approved UX, no mock transcription in production paths (test doubles inside tests are permitted). If repository or runtime evidence contradicts these rulings, stop the affected lane, preserve the evidence, and return the discrepancy to Fable; do not redesign around it.

## Test expectations

### New test files to create

All tests from B1-507B_TEST_AND_ACCEPTANCE_MATRIX.md Sections T0 through T9. Organize as:

- `tests/pg/b1-507b-migration.test.mjs` -- T0 tests (M4 structural)
- `tests/pg/b1-507b-deletion-intents.test.mjs` -- T2 tests (C1)
- `tests/pg/b1-507b-reconciliation-report.test.mjs` -- T3 INTEGRATION tests (C2)
- `tests/pg/b1-507b-orphan-attribution.test.mjs` -- T4 tests (C3)
- `tests/pg/b1-507b-cursor-fairness.test.mjs` -- T5 tests (C4)
- `tests/pg/b1-507b-lease-coordination.test.mjs` -- T6 INTEGRATION tests (C5)
- `tests/pg/b1-507b-audit-functions.test.mjs` -- T7 tests
- `tests/unit/rp8-probe.test.mjs` -- T1 UNIT tests
- `tests/unit/reconciliation-service.test.mjs` -- T6 UNIT tests, T8 INTEGRATION tests (using R2 mock and test DB)
- `tests/e2e/voice-health-reconciliation.spec.mjs` -- T3 E2E and T8 E2E tests
- `tests/pg/b1-507b-security.test.mjs` -- T9 tests

### Verification (all local)

Run, in order:

1. `npm test` -- all existing tests continue to pass
2. PostgreSQL suite -- all M1-M4 tests pass, including all new T0/T2/T3/T4/T5/T6/T7/T9 tests
3. E2E suite -- all existing + new voice-health-reconciliation tests pass
4. Unit suite -- all existing + new rp8-probe and reconciliation-service tests pass
5. Conformance -- stays at or above the prior count
6. `npm run scan:secrets` -- clean
7. `npm audit --audit-level=high` -- clean
8. `git diff --check` -- clean

Required outcome: all 174 tests from the acceptance matrix that are not marked MANUAL pass (163 automated tests). The prior test suite (PostgreSQL, e2e, conformance, unit) remains fully green. ZERO unexpected failures anywhere. A zero exit code is never success by itself; verify actual pass counts.

## Output

One complete combined handoff at `_AI_HANDOFFS/from_codex/B1-507B_storyforge_phase1_final_binding/B1-507B_IMPLEMENTATION_HANDOFF.md`:

- Commit hashes for all changes
- M4 migration SHA-256 and rollback SHA-256
- Updated runner pin values for M1-M4
- Full suite receipts with exact counts (PostgreSQL, e2e, unit, conformance)
- Per-lane completion status
- The remaining external gates restated verbatim from B1-507B_COMPLETE_COMBINED_HANDOFF.md Section "Remaining external gates"
- Mutation statement: what was changed and what was not

Stop after the handoff. The RP-8 probe execution (creating the Railway environment, running the probe, collecting evidence) is a SEPARATE operator action requiring the sealed receipt workflow from Ruling 1. The reconciliation dry_run requires real R2 credentials, the E13 surface live, and a fresh rollback point. Neither is part of this Codex run.
