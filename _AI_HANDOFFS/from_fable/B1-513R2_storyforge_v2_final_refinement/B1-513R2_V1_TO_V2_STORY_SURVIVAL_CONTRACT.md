# B1-513R2 — V1→V2 Story Survival Contract (pass-2 affirmation)

The binding contract is **B1-513R doc 03** (`B1-513R_V1_TO_V2_STORY_SURVIVAL_CONTRACT.md`), unchanged. This document affirms it against every pass-2 addition and records the pass-2 delta — which is: **nothing in pass 2 touches a V1 story's bytes, ownership, visibility, or history.**

## The law (restated, binding)

100% of existing V1 stories survive V2 — same story, same owner, same text, same audio, same status, same visibility semantics, no exceptions. V1 Story → the SAME story row. V1 Working Version → V2 Full Story (a zero-copy relabel). Original Telling → protected forever (version API rejects overwrite; probed). 30-Second and NNQ → absent until the student creates them. All migrations additive; a pre-migration Survival Manifest and post-migration manifest must compare with **zero mismatches** — story loss 0, owner changes 0, unauthorized visibility changes 0, missing audio/transcripts 0, unexplained changes 0 — or Codex STOP-SAFEs (no fix-forward).

## Pass-2 additions audited against the law

| Pass-2 feature | Touches V1 story rows? | Survival note |
|---|---|---|
| Inspiration list/grid + preference | No | Preference column on the user, not the story. |
| Pins / favorites / Dr Brian Recommends | No | New per-user tables + a flag on *question* records. `answeredStoryId` is a read-time join from existing origin provenance — no story write. |
| Bulk question import | No | Writes question drafts only; stable question IDs are server-generated (red-team fix B) so historical answers can never be re-pointed. Retiring a question never deletes or edits stories that answered it. |
| Invitation lifecycle states | No | New columns on invitations; stories untouched. |
| Guest journeys / started signal | No | Invitation-scoped. |
| Contribution promotion | Creates NEW stories only | Starts Private (pass-1 P1-4), provenance minimal; never merges into an existing story. |
| Admin scale (sessions, saved views, pagination) | No | Session labels come from the canonical MissionMed 360 cohort concept — consumed for display/filtering, never written to stories; entitlement remains the only access truth. Saved views store filter/sort state only. |
| Content Studio tabs / reorder | No | Taxonomy reorder mutates sortOrder on taxonomy records; stories keep stable taxonomy IDs (existing B1-512 guarantee). |
| DARK/LIGHT/AUTO, environments, header, intros | No | Presentation only; user-level preference columns. |
| V2.1 prewiring seams | Additive columns only | Segment IDs and source_role are additive; legacy text = one implicit segment, never re-chunked or rewritten. |

## Pass-2 evidence

Probe suite (61/61 PASS) re-verified on this build: original-overwrite rejection, retell/restore monotone history (nothing lost in either direction), consent never retroactively widens historical stories, visibility changes audited, private stories structurally invisible to admin surfaces (count-only). The 122-student scale-out is synthetic directory data plus new synthetic stories — no existing fixture story was modified to build it (`R2_QUEUE_SEED` is append-only).

## Codex gate (unchanged)

Fresh locked Railway backup + MyKinsta snapshot + PG18 dump with isolated restore rehearsal, receipts, THEN pre-manifest → guarded single-transaction additive migration → post-manifest → zero-mismatch comparison, per release. Any mismatch: STOP-SAFE, restore posture, report. The 30-day retention window makes waiting safe and rushing unrecoverable — never rush a migration to beat a backup expiry; take a fresh backup instead.
