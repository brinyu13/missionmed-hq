# B1-507 Blocker Closure Register

| Blocker | Dormant status | Evidence / smallest next action |
|---|---|---|
| B01 GitHub custody | In progress | Push final bounded branch, open PR, record checks/review |
| B02 stale protected manifest | BLOCKED non-RP8 | Owner workflow or explicit bounded owner-reviewed update required |
| B03 multipart/DELETE gateway | Closed locally | Production proof follows guarded install |
| B04 replay conformance | Closed locally | Production proof follows guarded install |
| B05 FG-1 | Deferred | Required before student-facing voice/lifecycle language |
| B06 RP-8 executor | Deferred by steering | Run saved Fable request and authorized probe before voice |
| B07 R2 | Deferred safely | Required before voice; absent for dormant |
| B08 backups/migrations | Blocked behind B02 and remote-write gate | Fresh backups, restore rehearsal, preflight, then apply |
| B09 OpenAI | Deferred safely | Provider remains `none` |
| B10 RP-7 corpus | Deferred safely | Required before provider activation |
| B11 360 authority | Deferred safely | Founder-only text pilot only |
| B12-C1 deletion/audit | Deferred safely | Required before reconciliation dry-run/on |
| B13-C2 operator visibility | Deferred safely | Required before reconciliation dry-run/on |
| B14-C3 orphan attribution | Deferred safely | Required before reconciliation dry-run/on |
| B15-C4 fairness | Deferred safely | Required before reconciliation dry-run/on |
| B16-C5 scheduler | Deferred safely | Required before reconciliation dry-run/on unless locked one-replica proof passes |
| B17 fresh rollback | OPEN non-RP8 | Fresh Kinsta/PG recovery points and isolated restore |
| B18 real voice acceptance | Deferred safely | Required before voice exposure, not dormant deployment |

Additional deploy gate: the Matrix guard matched every available public hash but
blocked because the protected `wp-content/plugins/missionmed-hub` StoryForge
sources are absent from this worktree. The current task did not edit those
assets and did not use an override. The control-plane/Matrix owner must supply a
current guard receipt from the canonical source-bearing worktree, or explicitly
authorize the exact asset-scoped exception.

The exact current blocking chain is B02 plus the Matrix guard receipt → fresh recovery points/restore → migration preflight/apply → dormant Railway/Kinsta deployment.
