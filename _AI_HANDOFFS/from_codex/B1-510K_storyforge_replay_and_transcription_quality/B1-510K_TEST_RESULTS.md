# B1-510K Test Results

| Gate | Final result |
|---|---|
| Focused replay/transcription | 78/78 PASS |
| Final focused store/transcription | 28/28 PASS |
| Focused voice save/replay E2E | 11/11 PASS |
| Unit | 253/253 PASS |
| PostgreSQL runtime/RLS | 13/13 PASS |
| Acceptance | 130/130 PASS, zero skips |
| Browser E2E | 64/64 PASS |
| Conformance/accessibility | 72/72 PASS |
| API-only build | PASS |
| Deterministic release | PASS, clean provenance |
| Canonical authority | PASS, SHA-256 `3ac2871f…` |
| Secret scan | PASS |
| npm audit | 0 vulnerabilities |
| Critical Systems | 112 PASS / 2 known WARN / 0 FAIL |
| `git diff --check` | PASS |

## Resolved failures

1. Three newly written unit fixtures accidentally changed a word or used a
   case-sensitive replacement. Fixtures were corrected; production code was
   unchanged; focused result became 78/78.
2. The first focused E2E command found PostgreSQL 16. Prefixing the already
   installed PostgreSQL 18 binary resolved the environment mismatch.
3. The first full unit run found two stale assertions expecting 13 release
   aliases after the accepted logo made the canonical count 14. Only those
   literal test expectations changed.
4. The first full E2E run correctly denied a new direct story-table update with
   HTTP 403. The implementation was changed to existing security-definer APIs;
   focused 11/11 and full 64/64 then passed.
5. The first release invocation used an incorrect full commit pin and failed
   before generating bytes. The exact pin was used; deterministic release then
   passed from a clean commit.

No unexpected test, security, product, or production failure remains.
