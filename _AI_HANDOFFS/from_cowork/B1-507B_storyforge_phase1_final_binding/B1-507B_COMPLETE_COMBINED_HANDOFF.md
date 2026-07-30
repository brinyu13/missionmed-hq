# B1-507B - Complete Combined Handoff

## Verdict

**READY FOR FINAL PHASE 1 IMPLEMENTATION**

All seven rulings are fully resolved. No ruling defers a decision back to the Founder that was not already a pre-existing gate (the dry_run-to-on Founder review gate is unchanged from the original authority). Codex can implement without discretion.

---

## 1. What this package contains

| Document | Purpose | Governs |
|---|---|---|
| B1-507B_FABLE_BINDING_AUTHORITY.md | Seven binding rulings answering the B1-507 authority request | Policy and architecture decisions |
| B1-507B_EXECUTABLE_CONTRACTS.md | Literal SQL, schemas, service contracts | Implementation detail (overrides authority doc on wording differences) |
| B1-507B_TEST_AND_ACCEPTANCE_MATRIX.md | 174 tests across 10 sections with 6 acceptance gates | Test completeness and gate sequencing |
| B1-507B_CODEX_IMPLEMENTATION_PROMPT.md | Paste-ready Codex run prompt with 4 lanes | Codex execution |
| B1-507B_COMPLETE_COMBINED_HANDOFF.md | This document: verdict, summary, gates, sequencing | Operator and Founder reference |

## 2. Rulings summary

### Ruling 1: RP-8 equivalent runtime and executor selection (AUTHORIZED)

The ephemeral Railway/Nixpacks probe is bindingly equivalent to the historical local container probe and is strictly more production-faithful. Docker Desktop, OrbStack, and local container runtimes are no longer required or permitted for RP-8.

Key decisions:
- One temporary Railway environment (`rp8-probe`) with zero production credentials
- ffmpeg added to the production Nixpacks configuration now (additive, dormant)
- 40 x 15-second synthetic fixtures, both options run twice, deterministic hashes
- Tie-break: both pass = Option A selected
- Post-selection wiring via `STORYFORGE_ASSEMBLY_EXECUTOR` environment variable
- Evidence sealed, probe environment deleted

### Ruling 2: FABLE-C1 deletion and audit truth (RULED)

Intent-first protocol replaces delete-first. Cross-system atomicity is not claimed; durable PostgreSQL intent rows provide crash-survivable truth.

Key decisions:
- New table `sf_audio_deletion_intents` with state machine: intended -> deleted_confirmed | object_absent | failed
- Three-phase protocol: INTEND (commit row) -> DELETE (R2 call) -> RESOLVE (commit state + audit atomically)
- Retry cap of 3 attempts; exhaustion aborts the run
- Crash between any phases leaves recoverable state

### Ruling 3: FABLE-C2 operator visibility (RULED)

Reconciliation visibility surfaces through E13 only, never E11. Admin-only, structurally redacted.

Key decisions:
- New table `sf_reconciliation_runs` (one row per run, no object keys or student/story UUIDs)
- `sf_reconciliation_report` function: SECURITY DEFINER, admin-gated, limit clamped 1-8
- 180-day retention sweep on finished runs; audit events remain append-only
- Cursor digests (SHA-256) instead of raw keys in all visible surfaces

### Ruling 4: FABLE-C3 orphan attribution (RULED)

Content-free reference values with no foreign keys. The system never fabricates a student or story link.

Key decisions:
- Intent row carries `student_ref`/`story_ref` as plain UUID columns (no FK)
- `ref_state` determines category: live (preserved), deleted/never_existed/invalid_key (eligible)
- Audit events for non-live references pass NULL student_id and story_id
- 7-day age floor on deletion eligibility
- Only `storyforge-audio/` and `storyforge-rec/` prefixes in scope

### Ruling 5: FABLE-C4 fairness and continuation (RULED)

Durable cursor in singleton table guarantees bounded consideration for every key.

Key decisions:
- `sf_reconciliation_state` singleton (CHECK id=1) holds cursor_key and lease
- Cursor advances per committed 1000-key page boundary, wraps on exhaustion
- Caps: 5 pages (5000 keys) and 200 deletes per run
- dry_run advances cursor identically (fairness machinery must be validated)
- Bounded-consideration proof: ceil(N/5000) runs covers all N keys

### Ruling 6: PROBE-C5 scheduler coordination (RULED)

Lease-based coordination replaces single-replica assumption. Railway replica count is mutable and rolling deploys create transient overlap.

Key decisions:
- Compare-and-set lease on the singleton row: 30-minute duration, 5-minute renewal
- Database clock (now()) exclusively; no client timestamps
- Lease guard embedded in every page-commit and delete-batch transaction
- Lost lease aborts the run with `reconciliation_lease_lost`
- Crash: lease expires naturally; next scheduler acquires

### Consolidated finish

- RP-8: ephemeral Railway probe is THE authorized path
- Selection rule: both pass = A; one passes = that one; neither = gate fails to Fable
- Complete reconciliation state transition documented in authority document
- dry_run may begin when M4 is implemented with full test matrix green, R2 exists, E13 is live, fresh rollback exists, suspension is empty
- on may begin after two consecutive clean dry_runs reviewed and approved by Founder

## 3. Implementation sequencing

### Phase 1: Codex build (paste B1-507B_CODEX_IMPLEMENTATION_PROMPT.md)

Four lanes, all local:
1. M4 migration (DDL, functions, grants, RLS, rollback)
2. Reconciliation service module (state machine, lease, cursor, intent protocol)
3. E13 report integration (withIdentity, 503 seam)
4. RP-8 infrastructure (Nixpacks config, probe script, executor wiring)

Gate: all 163 non-MANUAL tests green (174 total minus 11 MANUAL).

### Phase 2: RP-8 probe execution (operator, NOT Codex)

Requires: Phase 1 complete, candidate commit frozen.

1. Create temporary Railway environment `rp8-probe`
2. Deploy from candidate commit
3. Verify names-only variable listing (PORT and RP8_PROBE_TOKEN only)
4. Run probe (fixture generation, dual Option A/B runs)
5. Download manifest and artifacts, verify hashes locally
6. Chrome and Safari playback verification
7. Seal receipt
8. Delete probe environment, confirm deletion listing

Gate: sealed receipt with all T1-MANUAL evidence. Selection made (A, B, or gate-failed).

### Phase 3: Post-selection wiring (operator deployment)

Requires: Phase 2 complete with a selected executor.

1. Set `STORYFORGE_ASSEMBLY_EXECUTOR` to the ruled value (`concat` or `copy`) in the voice-activation deployment configuration
2. This is set ONLY in the later separately authorized voice-activation deployment
3. The live dormant service is not touched

### Phase 4: Reconciliation dry_run (operator, NOT Codex)

Requires: Phase 1 complete, R2 provisioned with real credentials (under its own authority), E13 live, fresh rollback point, suspension variable empty.

1. Set `STORYFORGE_AUDIO_RECONCILIATION=dry_run`
2. Wait for weekly scheduler to fire (or trigger manually in a controlled window)
3. Verify run row via E13: mode=dry_run, zero unexpected failures, counts plausible
4. Run a second dry_run cycle
5. Review both dry_run results

Gate: two consecutive clean dry_runs ready for Founder review.

### Phase 5: Founder review of dry_runs (FOUNDER ONLY)

Requires: Phase 4 complete with two clean dry_runs.

This is the PRE-EXISTING Founder review gate, unchanged. Not a new policy decision.

1. Review both dry_run run reports via E13
2. Approve transition to mode='on'

### Phase 6: Reconciliation live (operator, after Founder approval)

1. Set `STORYFORGE_AUDIO_RECONCILIATION=on`
2. Monitor first live run via E13

## 4. Remaining external gates (verbatim from prior authority)

These gates are NOT resolved by B1-507B and remain blocked on their own authorities:

- **B05 FG-1**: Founder guidance required before student-facing voice/lifecycle language. BLOCKED -- FOUNDER.
- **B07 R2**: R2 bucket provisioning with real credentials. BLOCKED -- INFRASTRUCTURE/POLICY. Required before voice and before reconciliation dry_run.
- **B09 OpenAI**: Provider contract and scoped production API key. BLOCKED -- CONTRACT/CREDENTIAL. Production provider remains `none`.
- **B10 RP-7 corpus**: Human corpus for transcription quality evaluation. BLOCKED -- HUMAN CORPUS.
- **B11 360 authority**: Broader access beyond Founder-only text pilot. BLOCKED -- AUTHORITY/IDENTITIES.
- **B18 real voice acceptance**: End-to-end real recording/provider/storage/assembly/replay acceptance. BLOCKED -- PRIOR GATES/DEVICES.

## 5. What B1-507B resolves in the blocker register

| Blocker | Prior status | B1-507B resolution |
|---|---|---|
| B06 RP-8 executor | BLOCKED -- FABLE/EVIDENCE | RESOLVED by Ruling 1 (probe authorized; selection rule defined; tie-break = A) |
| B12-C1 deletion/audit | BLOCKED -- FABLE | RESOLVED by Ruling 2 (intent-first protocol; M4 table) |
| B13-C2 operator visibility | BLOCKED -- FABLE | RESOLVED by Ruling 3 (E13 report; M4 table and function) |
| B14-C3 orphan attribution | BLOCKED -- FABLE | RESOLVED by Ruling 4 (content-free refs; NULL FKs for orphans) |
| B15-C4 fairness | BLOCKED -- FABLE | RESOLVED by Ruling 5 (durable cursor; bounded consideration) |
| B16-C5 scheduler | BLOCKED -- FABLE/PROBE | RESOLVED by Ruling 6 (lease-based coordination; replica invariant rejected) |

After B1-507B implementation (Phase 1) and RP-8 probe (Phase 2), blockers B06 and B12-B16 advance to CLOSED or to their next non-Fable gate (B07 R2 for reconciliation).

## 6. New database objects introduced

| Object | Type | Ruling | Purpose |
|---|---|---|---|
| sf_audio_deletion_intents | Table | C1 | Durable deletion intent state machine |
| sf_reconciliation_runs | Table | C2 | Per-run statistics for operator visibility |
| sf_reconciliation_state | Table | C4/C5 | Singleton: durable cursor and lease |
| sf_reconciliation_report(int) | Function | C2 | Admin-only report over run rows |
| sf_reconciliation_sweep_old_runs() | Function | C2 | 180-day retention sweep |
| sf_deletion_intents_open_key_idx | Partial index | C1 | Dedup open intents per key |
| sf_deletion_intents_run_idx | Index | C1 | Run-scoped intent lookup |
| sf_deletion_intents_unresolved_idx | Index | C1 | Unresolved intent recovery |
| sf_reconciliation_runs_started_idx | Index | C2 | Report ordering |

Updated (CREATE OR REPLACE, same signature):
| Object | Change |
|---|---|
| sf_append_voice_audit_service | Expanded action/entity allowlists for reconciliation events |
| sf_voice_audit_payload_ok | Expanded key/value allowlists for reconciliation payloads |

## 7. New environment variables

| Variable | Values | Default | Purpose | Set by |
|---|---|---|---|---|
| STORYFORGE_ASSEMBLY_EXECUTOR | `concat`, `copy` | absent (= assembly_authority_blocked) | Selects the RP-8-proven assembly executor | Operator, after RP-8 probe |

No new environment variables for reconciliation constants (fixed in code per Ruling 6). The existing `STORYFORGE_AUDIO_RECONCILIATION` (off/dry_run/on) and `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` variables are unchanged.

## 8. Authority chain

```
B1-504A (production architecture)
  -> B1-504B (evidence pass)
    -> B1-505C (delivery plan)
      -> B1-506A (bounded amendment)
        -> B1-507A (Codex build: 92% complete)
          -> B1-507B (THIS: final binding rulings for the remaining 8%)
            -> B1-507B-IMPL (Codex implementation)
              -> RP-8 probe (operator)
                -> Reconciliation dry_run (operator)
                  -> Founder review (unchanged gate)
                    -> Reconciliation live
```

## 9. Mutation statement

This package authorizes Codex to make the following mutations to the repository:

- ADD one migration file and one rollback file (M4)
- ADD one service module (`server/reconciliation.mjs`)
- ADD one probe script (`scripts/rp8-probe-server.mjs`)
- MODIFY the Nixpacks configuration to add ffmpeg
- MODIFY the E13 voice-health handler to include reconciliation report
- MODIFY the assembly executor routing to read STORYFORGE_ASSEMBLY_EXECUTOR
- ADD test files as specified in the Codex prompt
- MODIFY migration runner pins to include M4 SHA

This package does NOT authorize:

- Any deployment or production mutation
- Creation of the RP-8 probe Railway environment (operator-only)
- Setting STORYFORGE_AUDIO_RECONCILIATION to any value (operator-only)
- Setting STORYFORGE_ASSEMBLY_EXECUTOR to any value (operator-only, post-probe)
- Any R2 operations against real buckets
- Any provider calls
- Any changes to existing tables, endpoints, or documents not listed above
