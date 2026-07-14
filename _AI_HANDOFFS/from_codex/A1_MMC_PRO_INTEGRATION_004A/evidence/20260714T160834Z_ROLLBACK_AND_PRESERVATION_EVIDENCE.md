# A1 MMC 004A Pre-change Rollback and Preservation Evidence

Captured at `2026-07-14T16:08:34Z` before any Goal 004a implementation edit.

## Immutable starting point

- Worktree: `/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-004`
- Branch: `a1-macair-mmc-mentor-intelligence-004`
- HEAD and upstream: `41a2dfbbdf5e42eec1b6f2b0179af752d5c03551`
- Remote main: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`
- Common ancestor with remote main: `5cc9144bfc770e5eda78124cc1fa886640041767`
- Branch relation to remote main: 13 commits ahead and 13 commits behind.

## Preserved pre-existing worktree change

The only pre-existing dirty path remains in place and was not reset, restored, stashed, cleaned, or overwritten:

`_AI_HANDOFFS/from_codex/A1_MMC_PRO_INTEGRATION_004/A1_MMC_PRO_INTEGRATION_004_COMPLETE_COMBINED_HANDOFF.md`

Its worktree SHA-256 was `16cf08007021a902ca1d49c06f8d94f5f552d1ba65a9a438d36746f7d24be62c`; its committed SHA-256 was `8145e60c7fce254a7a2926a8771b708bd3663a5e79a584c038de8dbfd52598a8`. The observed worktree delta was exactly one leading `x` before the opening Markdown heading. No provenance or intent is inferred until Prompt 004 reconstruction is complete.

The committed byte stream remains recoverable from Git object `d3b3034c5a1bef0782d81d2c2ecfafcadd73fa90`. The dirty byte stream is identified by Git blob `df9857e22373d34f472c6d75e17a75d15d9b1320`. These object identifiers permit byte-exact comparison without destructive Git commands.

## Protected-system boundary

The Matrix all-assets guard exited `42`. Goal 004a will not edit or import Matrix-protected runtime assets. The MMC reconciliation may inspect Matrix, Scheduler, Calendar, and Webex only as protected references. Production, deployment, database, auth, RLS, cache, R2, Stream, Scheduler, Calendar, Webex, and Daily Drills mutation remain prohibited.

## Rollback strategy

All Goal 004a changes will be additive or committed as a new corrective/finalization commit. Existing Prompt 004 history will not be rewritten. Before final commit, the diff against this HEAD and the protected-path diff will be reviewed explicitly. No force push is permitted.
