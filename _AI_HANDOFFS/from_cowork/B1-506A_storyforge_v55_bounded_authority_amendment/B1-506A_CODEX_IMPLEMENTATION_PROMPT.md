# [B1-506A-IMPL] STORYFORGE V5.5 PHASE 1 · BOUNDED AMENDMENT IMPLEMENTATION

Model: Codex GPT-5.6 Sol Ultra. Paste this document as the run prompt.

Codex may implement this amendment. Codex may not reinterpret it.

## Authority

1. `_AI_HANDOFFS/from_cowork/B1-506A_storyforge_v55_bounded_authority_amendment/B1-506A_FABLE_AUTHORITY_AMENDMENT.md` (the six rulings) and `B1-506A_EXECUTABLE_SQL_AND_CONTRACTS.md` (literal SQL and contracts; it governs on any wording difference).
2. Everything else stands unchanged: B1-504A/B1-504B technical authority, B1-505C sequencing, your own committed safe implementation, both verbatim stop rules, the stop scope, and the fail-closed posture for every lane this amendment does not touch.

Work only in worktree `B1-StoryForge-502` on branch `codex/b1-503-storyforge-product-recovery`, starting from HEAD `411b7aeedced351cf15c1e25601a7714c119d1fa`. Preflight: verify that HEAD, verify current M1 SHA `b175549e...`, M1 rollback `669f6c24...`, M2 `8899d7d6...`, and the B1-506A MANIFEST.sha256. Any mismatch = STOP.

## Scope (exactly six lanes; nothing else)

1. M1 RLS: apply the four approved `ARRAY['student']` substitutions in place; post-edit M1 SHA MUST equal `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`; update the three runner pin locations; the four red PostgreSQL denial cases turn green.
2. Audit writers: add migration `20260729010000_b1_506a_voice_audit_lifecycle.sql` and its rollback EXACTLY as printed in the SQL document; wire `db.mjs` to the two-writer pattern (`appendAudit` -> `sf_append_voice_audit`; new `appendServiceAudit` -> `sf_append_voice_audit_service`); route every `withServiceTransaction` audit call site through the service writer; the expected e2e red at `tests/e2e/voice-dock-states.spec.mjs:138` turns green.
3. E11/E13: wire `readFeatureAuditTail` and `readVoiceErrorSummary` to `sf_feature_audit_tail` and `sf_voice_error_summary` under `withIdentity`; keep the 503 seams for absence or failure; flip the corresponding unit expectations.
4. Lifecycle: implement `sweepCandidates`/`sweepSession` through `sf_voice_sweep_candidates`/`sf_voice_sweep_purge` (sweepSession also deletes the session's whole `storyforge-rec/` prefix); adopt DB-commit-first ordering in `cancelSession` and `deleteAudio` (via `sf_retire_story_audio`, prefix deletion); wire the weekly reconciliation through `sf_voice_audio_reference_check`; archive propagation is a STRUCTURAL NO-OP (implement only the test asserting no open session carries story_id; the `story_archived` reason is reserved); attached audio is always retained on archive.
5. Provider: implement `openai-gpt-4o-transcribe.mjs` and `openai-whisper1.mjs` drivers per the contract table (singular `language`, prompt composition, `include[]=logprobs` on the primary, json format, fixed error mapping); extend `createTranscriptionAdapterForProvider('openai')`; amend `validateConfig` to accept exactly `none` or `openai` (key required for `openai`); production remains `none`. Do NOT call any provider in this run; drivers ship inert.
6. E4/E7: `markAssembled` drops its asset-id parameter; E7 implements the exact pre-read flow (attached returns the linked story; finishing returns 409 `voice_assembly_pending`; assembled runs `sf_create_story_v5` + `sf_attach_recording` in one identity transaction, with the race-loser re-read); post-commit copy/verify/finalize phase through `sf_voice_asset_pending_candidates` / `sf_voice_asset_mark_verified` / `sf_voice_asset_mark_failed` per the SQL document Section 3; the client 90-second pending path with the race rule (a refused E5 cancel retries E7 once); both assembly executors built behind the injected boundary; NEITHER is wired: Option A vs Option B remains selected ONLY by a valid RP-8 container probe, which stays blocked on Docker health. The one new PA-immutable error string ships exactly as printed (SHA `669fc79d...`).

## Hard boundaries

No deployment, no production or remote mutation, no provider calls, no new tables or endpoints beyond the printed migration, no Docker repair or destructive Docker action, no scope or flag change, no edits to any B1-504A/B1-504B/B1-505C/B1-506A document, no change to the approved UX beyond the printed error string and the 409 retry behavior, no mock transcription in production paths (test doubles inside tests are permitted). If repository or runtime evidence contradicts this amendment, stop the affected lane, preserve the evidence, and return the discrepancy to Fable; do not redesign around it.

## Verification (all local)

Run, in order: `npm test`; PostgreSQL suite; e2e suite; conformance; `npm run scan:secrets`; `npm audit --audit-level=high`; `git diff --check`; then the four release entrypoints (`build:release`, `build:api`, integration entry, migration preflight entry) which must now pass their M1 gate and stop only on their remaining external gates (integration remains blocked on Docker health and must not be forced). Required outcome: the four M1 PostgreSQL reds and the one audit e2e red are green; the pre-amendment 142 PostgreSQL cases and 34 e2e cases all pass; conformance stays exactly 72/72; the new test files named in the SQL document Section 6 exist and pass; ZERO unexpected failures anywhere; a zero exit code is never success by itself.

## Output

One complete combined handoff at `_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/B1-506A_IMPLEMENTATION_HANDOFF.md`: commit hashes, the amended M1 hash proof, the new migration hashes, the PRE-EDIT and post-edit hashes of `scripts/apply-production-migrations.sh`, full suite receipts with exact counts, the remaining external gates restated verbatim from `B1-506A_READINESS_AND_EXTERNAL_GATES.md`, and a mutation statement. Stop after the handoff; S4 and later runbook steps require their own credentials, evidence, and founder actions and are NOT part of this run.
