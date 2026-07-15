# V1-8010A Decision 03 — Implementation Home

**Status:** ACCEPTED

## Decision

The canonical repository is `brinyu13/missionmed-hq`. V1-8010A work occurs in:

- worktree: `/Users/brianb/MissionMed_worktrees/V1-StudySchedule-8010A`;
- branch: `codex/v1-study-schedule-8010a`;
- evidence parent: `c988666eb35a108674508830e5555f09c28607b3`;
- immutable application foundation: `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0`.

Draft V1-8000 PR #10 remains reconnaissance-only. V1-8010A decision records and
each implementation slice use separately revertible commits/stacked branches.
No recovered D9 branch is edited, rebased, or rewritten.

## Long-lived destination

Until the V1-8000 evidence PR is accepted, V1-8010A is stacked on the
`codex/v1-study-schedule-8000` evidence tip. Each later PR targets the previously
accepted V1 integration tip. Promotion to the release branch occurs only through
reviewed, exact-digest commits.

## Verification and rollback

`git status` was clean when the branch/worktree was created. A slice may be
reverted independently; history rewriting and cross-worktree cleanup are
forbidden.
