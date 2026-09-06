# I1Q-1007X Baseline

Recorded: 2026-07-15, America/New_York

## Scope

This baseline opens ticket `I1Q-1007X-MA` for the MissionMed Question Platform. The authorized target is an authenticated internal application with student-facing publication disabled. State D is outside this run unless genuine credentialed physician approval records exist.

## Source Integrity

| Check | Result |
| --- | --- |
| Worktree | `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000` |
| Source branch | `i1q-question-platform-ultra-1006` |
| Target branch | `i1q-question-platform-ultra-1007x-ma` |
| Baseline HEAD | `0d6f78f2a2036731ec592398ce5fd845beb54333` |
| Required ancestor `0a05b4d` | PASS |
| Required ancestor `0d6f78f` | PASS |
| 1006 handoff SHA-256 | `ad311340c8ecbe7abf4f077fa92dc1ef32760d65bbac4ab9a70b76b4fe379572` |
| Expected handoff SHA-256 | MATCH |
| Remote | `origin https://github.com/brinyu13/missionmed-hq.git` |

The worktree contained pre-existing untracked historical handoff directories when this run began. They were not reset, cleaned, staged, or altered. No tracked source diff existed at branch creation.

## MissionMed OS Baseline

The MissionMed OS checkout initially had four modified tracked paths and 52 untracked paths while local `main` was 11 commits behind `origin/main`. No active Git operation existed, and the historical `.git/index.lock` was absent at inspection time.

Before recovery, the complete state was preserved externally at:

`/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/I1Q-1007X-MMOS-PRESERVATION-20260715T112333Z`

The package contains status, refs, worktrees, remotes, reflog, binary diffs, tracked and untracked archives, per-file hashes and metadata, and a verified all-refs Git bundle. The exact preserved state was committed and pushed on:

| Field | Value |
| --- | --- |
| Recovery branch | `codex/i1q-1007x-mmos-preexisting-recovery` |
| Recovery commit | `91a680b1a2e5befd4fbe16b47f6e36f70fdaf419` |
| Canonical starting commit | `7144435` |
| Registration branch | `codex/i1q-1007x-registration` |
| Registration commit | `e88b12c` |
| Authority commit | `b3d8089` |
| Review | `brinyu13/missionmed-os#12` |

MissionMed OS lint, 33 state-feed unit tests, adapter and renderer contracts, the full read-only validation suite, JSON uniqueness checks, and a secret-pattern scan passed on the registration branch. GitHub checks for the review were green when this baseline was written. Independent review remains required before merge.

## Authority Baseline

The registration branch adds mission `I1Q-1006`, product `question-platform`, its product passport, authority entries, and decision record `DR-006`. Brian is recorded only in the authorized interim governance roles. Medical governance remains `UNASSIGNED` and blocks medical approval, approved release eligibility, and student-facing publication.

The following remain protected and unchanged at baseline:

- Live STAT and sealed-pack behavior
- Live Drills and Daily Rounds ingestion
- Matrix and Arena runtime
- WordPress auth relay and route proxies
- Shared service-role flows and environment values
- Production Supabase data and production migrations
- Stream, R2, CDN, and source registry objects
- Student production data

## Known Baseline Defects

1. `_SYSTEM/scripts/mm-preflight.sh` exits on an unbound empty `tracked_files` array when no tracked dirty files exist.
2. The 1006 UI evidence generator hard-codes portions of browser and accessibility evidence.
3. `npm run validate` points to a missing `src/validate-evidence.mjs` entrypoint.
4. Several screenshot files use a `.png` extension but contain JPEG bytes and are absent from the artifact checksum manifest.
5. Real corpus inventory, real datastore execution, staging, production, rollback, monitoring, and independent final-wave clearance were not established by 1006.

These are inputs to this run, not proof of release readiness.

## Initial Release Verdict

`NOT RELEASE READY` at baseline. Highest demonstrated baseline state is below State A because no authorized real corpus inventory was yet completed. Student-content, STAT-consumer, and Drills-consumer flags must remain off.
