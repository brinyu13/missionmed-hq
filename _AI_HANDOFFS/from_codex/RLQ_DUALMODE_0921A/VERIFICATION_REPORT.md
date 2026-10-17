# RLQ-DUALMODE-0921A verification report

## Verdict

**PASS — promoted to production, accepted through the real protected workflow,
and independently verified read-only with conditions noted below.** The
temporary QA surface is withdrawn and all anonymous canary URLs return `404`.

## Acceptance matrix

| Gate | Result | Evidence |
|---|---|---|
| Isolated implementation | PASS | Clean worktree; source repair `d4553ab1`; final dist commit `3147ca2` |
| Automated/runtime verification | PASS | `26/26` tests; `17/17` executable inline scripts parse |
| Protected pre-promotion path | PASS | anonymous `404`; authenticated Founder `200`; existing entitlement boundary preserved |
| Live RISE read/import | PASS | authenticated GET-only; five programs; source order `[1,2,3,4,5]`; no RISE write |
| Authorized Save Progress | PASS | final version `2a0d567a-ec97-4acb-b895-62dafb3dc38c`; three BFF `200` POSTs; two version rows after idempotent retry behavior |
| Reload round-trip | PASS | exact Application state restored; SHA-256 `13faf819b0a34d9d0c8788d2f5d30d2a313527b8b8285f9b6bad15d374f8c357` |
| Rank-mode preservation | PASS | original seven programs and rank-only surfaces retained; rank-slot hash unchanged |
| Production deployment | PASS | live SHA-256 `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`; route `200` |
| Genuine score interaction | PASS after fix-forward | score `0 -> 4`, total `0 -> 12.0`; controls survive re-render on protected and live production builds |
| Responsive acceptance | PASS | desktop and `390x844`; zero horizontal overflow; primary controls visible |
| Boundary preservation | PASS | page 4216 content/Elementor/template, BFF, and entitlement guard hashes unchanged |
| Canary withdrawal | PASS | post 9174 draft; five anonymous QA/canary URLs `404`; files preserved privately mode `0600` |
| Fresh independent verifier | APPROVE WITH CONDITIONS | all requested read-only tests/hashes/HTTP/SQL/security/repair checks passed; did not duplicate the authenticated write; build-label caveat below |

## Production data-write result

The only data-write acceptance was performed through the existing production
RankListIQ `Save Progress` workflow in the currently authenticated Founder
workspace. The save traversed the unchanged WordPress BFF and returned the
accepted version id `2a0d567a-ec97-4acb-b895-62dafb3dc38c` with `saved_at`
`2026-09-21T11:12:09-04:00`.

The browser/request audit observed three successful save requests and two new
version rows; one retry resolved idempotently without another version. No
program-interview endpoint, unrelated RankListIQ endpoint, other user row,
schema, RLS policy, Edge Function, BFF, entitlement, RISE, or Matrix state was
modified. A full production reload returned the same final version and exact
Application workspace.

## Fix-forward discovered during acceptance

The first live scoring probe exposed a frontend-only defect: the legacy score
render replaced the ranked cards and removed the new Decision/Signal controls.
The promoted candidate was fixed forward with a scoped MutationObserver that
restores the controls after re-render. The repaired build was retested in the
protected path and again on the real production page. Controls, RISE labels,
selected decisions, selected signals, and signal budgets persisted without
duplicates or an observer-triggered autosave.

## Rollback and withdrawal

The exact pre-promotion live artifact remains available privately at:

`/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z/rank_list_engine_WORKING.pre-production-promotion-20260921T152314Z.html`

The temporary QA gate/runtime files were moved, not deleted, to:

`/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z/final-withdrawal-20260921T153515Z`

Post 9174 is draft. `/qa-0921a/`, `/rank-list-engine/next/`, the protected
runtime path, and both root gate paths each return `404` anonymously.

## Security boundary

The known plaintext developer-unlock values are absent from the Git-safe and
promoted artifacts, and all affected frontend checks fail closed. No secret is
reproduced here. Broader credential rotation/audit remains separately scoped
and was not performed.

## Independent-verifier scope and non-blocking caveat

The fresh verifier was intentionally read-only. It did not repeat the
authenticated Founder save/reload or assert learner-persona acceptance; the
root acceptance evidence above covers the authorized authenticated workspace.

The output contains the correct embedded build metadata and exact artifact
hashes, but the legacy base later shadows the runtime
`window.__RANKLISTIQ_BUILD__` global with its historical label. This is a
provenance-label cleanup, not a functional, data-integrity, entitlement, or
release blocker; the source marker and SHA-256 hashes above are authoritative.
