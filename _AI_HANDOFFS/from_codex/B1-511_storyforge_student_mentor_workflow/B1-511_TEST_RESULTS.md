# B1-511 Test Results

| Gate | Result |
|---|---:|
| Unit suite | 270/270 PASS |
| PostgreSQL runtime/integration | 17/17 PASS |
| Acceptance | 130/130 PASS |
| Browser E2E | 66/66 PASS |
| Conformance/accessibility | 72/72 PASS |
| Focused B1-511 E2E rerun | 2/2 PASS |
| Focused admin-console E2E rerun | 2/2 PASS |
| API-only package check | PASS |
| Deterministic release/provenance | PASS |
| Secret scan | PASS |
| npm audit | 0 vulnerabilities |
| Critical Systems after live reconciliation | 112 PASS / 2 known WARN / 0 FAIL after the manifest commit |
| `git diff --check` | PASS |

The first screenshot-evidence attempt failed because the test driver tried to
click a category while the search suggestion list was intentionally open. The
test was corrected to dismiss/clear search first; the exact focused rerun passed
2/2. This was not a production defect and did not change product source.

Two migration attempts rolled back safely before the successful transaction:
the first exposed a constant-expression assertion planner issue; the second
named `sf_mentor_note_audio` instead of the implemented
`sf_mentor_note_media`. The migration ledger remained absent after both failed
transactions. The corrected transaction applied once with migration SHA-256
`9bae7859f5966a8e9fc2f29fe9ccb37b0e59675e830c6b7ccdaef3914532c05f`.
