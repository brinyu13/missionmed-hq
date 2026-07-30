# B1-507A Authority Precedence

Date: 2026-07-29

## Controlling order

| Rank | Authority | What it controls |
|---:|---|---|
| 1 | Founder-approved V5 HTML, SHA-256 `3ac2871f…db1` | Every unchanged StoryForge visual, interaction, navigation, and workflow surface |
| 2 | Founder-approved V5.5 prototype plus r2 | Phase 1 voice product experience and native insertion into V5 |
| 3 | B1-504A product authority documents | Phase 1 scope, student workflow, provider bakeoff, privacy, lifecycle, acceptance |
| 4 | B1-504B infrastructure/platform authority | WordPress/Matrix/Railway/PostgreSQL/R2 integration and fail-closed deployment model |
| 5 | B1-505C delivery authority | Sequencing and activation train; it cannot redefine product behavior |
| 6 | B1-506A Fable amendment | Exact bounded provider/schema/RLS/audit/E11/E13/lifecycle/assembly rulings |
| 7 | B1-506B Fable binding rulings | Exact 90-second UX and reconciliation behavior |
| 8 | Current B1-507A Founder scope confirmation | Full production Phase 1 must include recording through automatic permanent-audio deletion; audience is Founder, WP admins, and currently enrolled 360 students |
| 9 | Repository at verified HEAD | Implementation truth under the authorities above |
| 10 | B1-506C handoffs/test receipts | Evidence of what the repository implemented and tested |
| 11 | B1-503 production receipts plus fresh read-only probes | Truth about what is actually live |

## Conflict resolutions

1. The B1-504B provider document’s older `gpt-transcribe` label is superseded. The current binding pair is primary `gpt-4o-transcribe`, fallback `whisper-1`, through `/v1/audio/transcriptions`.
2. Any text-only or dormant/default-off deployment packet is a safe intermediate stage, not Phase 1 completion. The current Founder confirmation requires the entire audio lifecycle before “fully live.”
3. The two assembly executors in source are candidates, not an authorized choice. B1-506A explicitly left the choice for RP-8.
4. The B1-506C fixed local ledger (36/36) means authorized local implementation lanes were completed. It does not mean real-provider, R2, WordPress voice gateway, or production acceptance passed.
5. B1-506C’s earlier production table-count language is superseded by the fresh read-only probe: the Phase 1 tables tested do not exist in production.
6. B1-506C’s one-replica observation is evidence, not a locked scheduling invariant. It does not resolve PROBE-C5.
7. The V5.5 prototype’s audio player behavior controls over the current simplified replay implementation. Play/pause, progress, and time remain a conformance gap.
8. Existing WordPress entitlement code is concrete repository evidence, but it is not a substitute for the missing final B1-505 360-eligibility authority/receipt.
9. The stale `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` cannot establish current release or Cloudflare Worker state. Fresh platform evidence controls, and the manifest must be regenerated through its normal owner.

## Phase boundary

Phase 1 includes capture and transcription, not student-facing AI coaching, scoring, rewriting, themes, analogies, or Socratic questions. Those remain deferred. Original-audio preservation, replay, recovery, cleanup, and automatic deletion are not Phase 2; the current Founder scope explicitly makes them part of the complete Phase 1 production outcome.

## Open decisions that no existing document resolves

- FG-1: the final Founder retention/consent/delete-control/wind-down selection.
- RP-8 equivalence: current authority names a local Nixpacks-container comparison. Local container troubleshooting is now prohibited, but no existing binding authority identifies a non-Docker equivalent. A narrow ruling can authorize an ephemeral, non-production Nixpacks-equivalent probe without changing architecture.
- FABLE-C1 through C4: reconciliation’s non-atomic deletion/audit, operator visibility, orphan attribution, and bounded-list fairness contradictions.
- PROBE-C5: a proven single scheduler/replica operational invariant, or Fable-authorized coordination if multiple replicas are possible.
- The missing final B1-505 360-enrollment authority/receipt.

No product redesign is required to resolve these items.
