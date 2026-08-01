# B1-510I Test Results

## Final/local

| Gate | Result |
|---|---|
| unit | 234/234 PASS |
| focused voice/flag tests | 17/17 PASS after final change |
| API-only build | PASS |
| deterministic static build | PASS; release `v-21d896bc96f9c454` |
| secret scan | PASS |
| npm audit (`high`) | 0 vulnerabilities |
| `git diff --check` | PASS |

## Full pre-deployment regression

| Gate | Result |
|---|---|
| unit at deployment checkpoint | 232/232 PASS |
| PostgreSQL runtime/RLS | 12/12 PASS |
| acceptance | 130/130 PASS |
| browser E2E | 59/59 PASS |
| conformance/accessibility | 72/72 PASS |
| PostgreSQL authorization | PASS |
| B1-503 product conformance | PASS |

The Docker-wrapper integration command was not used because the local container runtime is an accepted unavailable/deferred dependency. Equivalent accepted local PostgreSQL suites and live integrated canaries were used; this is not represented as a Docker integration pass.

## Runtime guards

Critical Systems enforced result: **109 PASS, 2 WARN, 3 FAIL**.

The failures are the old extensionless app alias (404), old expected index hash, and old expected app alias. The current live index/app/auth/styles hashes all exactly match the new release. B1-510I permits the Critical Systems manifest update only after the live voice canary passes, so the manifest was correctly left stale and the gate remains red.

Matrix lock preflight: protected public/origin hashes for `storyforge_js` and `storyforge_css` match the approved manifest. The exact worktree does not contain the Matrix-owned local source paths, so the tool reported that local-source limitation; no protected Matrix asset was edited.

## Live gate

- identical static bytes: PASS
- eligible-student capability during canary: PASS
- admin/anonymous negative authorization: PASS
- actual upload/provider/cleanup route: PASS
- controlled physical-microphone transcript: NOT PROVEN
- broad eligible-student activation: ROLLED BACK
- Phase A overall: FAIL CLOSED
