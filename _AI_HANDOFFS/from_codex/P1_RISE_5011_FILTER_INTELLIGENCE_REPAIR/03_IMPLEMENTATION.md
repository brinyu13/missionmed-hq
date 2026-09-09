# Implementation

Source commit: `af97194ae748ba2103fd139dce7279826e7b834e`

Branch: `codex/p1-rise-5007-private-beta-full-registry-student-intel`

Remote readback after push: ahead 0, behind 0; `git ls-remote` returned the exact commit above.

Committed source files:

- `rise/config/filter-intelligence.v1.json`
- `rise/src/filter-intelligence.mjs`
- `rise/adapters/postgres-runtime.mjs`
- `rise/server.mjs`
- `rise/web/app.js`
- `rise/web/styles.css`
- `rise/tests/filter-intelligence.test.mjs`
- `rise/tests/server.test.mjs`
- `rise/tests/browser/fixture-server.mjs`
- `rise/tests/browser/rise.spec.mjs`

The commit adds the reusable provider-neutral contract, safe database projection and cache, authenticated endpoint, real frontend predicates, dynamic contextual counts, independent resident groups, disabled-zero handling, selected-state styling, and focused unit/API/browser coverage. It also retains the bounded 1,000-row catalog pagination used by the deployed full-registry source so all 6,139 programs load without a single giant response.

Pre-existing dirty files and unrelated hunks were not staged. In particular, unrelated shared HQ, WordPress, source-rights fallback, SOAP merge, RankList IQ copy, build artifacts, release artifacts, importer, SQL, and configuration changes remain in the worktree exactly as found. The production image was built from the preserved current production-source composite; current deployed composite hashes and source-commit hashes are distinguished in the checksum receipt.

No migration 008 was necessary. No database row, RLS policy, auth seam, WordPress file, Matrix mapping, LearnDash entitlement, or research producer was changed.

