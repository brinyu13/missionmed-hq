# B1-510I Test Results

## Local release candidate

| Gate | Result |
|---|---|
| unit | 246/246 PASS |
| PostgreSQL node suite | 13/13 PASS |
| acceptance | 130/130 PASS |
| PostgreSQL authorization/conformance SQL | PASS |
| browser E2E | 64/64 PASS |
| conformance/accessibility | 72/72 PASS |
| deterministic release | PASS, `v-18e88e1594474b75` |
| canonical authority hash | PASS |
| API-only build | PASS |
| WordPress route manifest | PASS |
| secret scan | PASS |
| npm audit | 0 vulnerabilities |
| `git diff --check` | PASS |

The Docker-wrapper integration harness was not run because it executes destructive local `docker compose down -v` operations and the controlling steering explicitly deferred the unavailable local container runtime. WordPress/JWT seams remain covered by unit/release tests and were exercised live.

## Resolved failures

1. E2E admin feature state leaked between tests. Test teardown now restores default-off; affected and adjacent suites passed.
2. The release builder initially rejected the ignored official logo. Two exact `.gitignore` exceptions admit only the intended logo assets.
3. One Railway upload built the repository root rather than the StoryForge package. It briefly replaced API health with the unrelated root service and returned 404, never 5xx. The exact `storyforge-v5` package was immediately redeployed as `9034a989-c3af-4bc1-a89e-55140e9f07f8`; final deployment `00496858-15f1-46d0-897b-379f63b7367c` is healthy. No schema, user data, auth, R2, or provider configuration was changed by the invalid package.
4. Kinsta's cache helper returned an unexpected body and PHP exit 139 after the immutable files had already published. Independent public bytes matched exactly; no speculative cache repair was attempted.

## Runtime guards

- Critical Systems enforced after manifest commit: 112 PASS / 2 WARN / 0 FAIL.
- Matrix origin/public hashes: PASS for all protected assets.
- Matrix local-source verification: blocked only because `missionmed-hub` protected source is not present in this isolated worktree; no override was used.
