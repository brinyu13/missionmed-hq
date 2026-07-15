# V1 Study Schedule — Repository, Branch, and Worktree Map

## Canonical topology

| Item | Value | Interpretation |
|---|---|---|
| Origin | `https://github.com/brinyu13/missionmed-hq.git` | Canonical repository |
| Default branch | `main` | Hosted default; not the recovered implementation base |
| `origin/main` | `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` | Merge base |
| Recovered-source ref | `origin/d9-matrix-plan-415-source-recovery` | Canonical recovered source |
| Recovered-source commit | `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0` | V1 implementation foundation |
| Current branch | `codex/v1-study-schedule-8000` | Began at recovered source; receives one handoff-only publication commit |
| Current worktree | `/Users/brianb/MissionMed_worktrees/V1-StudyScheduler-8000` | Reconciliation home |
| Upstream at run start | none | Publication must explicitly set branch/upstream |

For the recovered application source, `origin/main...d4455bf` is `0 6` by
left/right count and 220 paths differ from main. Those metrics intentionally bind
to `d4455bf`, not to the later documentation commit. Therefore a V1-8000 draft
PR must target `d9-matrix-plan-415-source-recovery`; targeting `main` would
misrepresent the handoff as a large application recovery change.

## Recovery lineage

| Commit | Recovery role |
|---|---|
| `c340a3a` | Observed production import |
| `9469437` | Backup quarantine |
| `e12cd99` | Provenance reconciliation |
| `a81a3af` | Validation evidence |
| `030fe10` | Review corrections |
| `d4455bf` | Final D9-415 reports and source foundation |

## Worktree census

- Registered worktrees: 142.
- Source base (`d4455bf`) tracked files: 510.
- Source-base `missionmed-hub` tracked files: 125.
- Source-base top-level MU-plugin files: 21.
- Only the D9-415 recovery worktree is a byte-current implementation twin for the
  Study source; other worktrees are historical, unrelated, or duplicate refs.

The large worktree count is evidence-search scope, not authority. No unrelated
worktree was modified.

## Existing hosted review state

An earlier draft PR exists for D9 recovery and is explicitly marked “DO NOT
MERGE.” It is evidence of the source-recovery lineage, not the V1-8000 review.
The canonical repository was verified as public, with `main` as the hosted
default and sufficient connected-app permission for the later handoff-only
publication.

## Branch policy for subsequent runs

- V1-8000: commit only the corrected reconciliation directory.
- V1-8010: new branch/worktree at `d4455bf` plus the accepted V1-8000 handoff.
- V1-8010A must choose a durable long-term source/release destination: a
  long-lived V1 branch, separately reviewed recovered-baseline promotion, or an
  exact package-based release. Production must not depend on an orphaned
  historical D9 branch.
- Never modify the D9-415 evidence branch in place.
- Do not rebase the recovery lineage onto main during the product implementation.
- Use content-hashed release assets and a package manifest.
- Keep schema, entitlement, UI, and rollout changes in separately revertible
  commits.
