# D1-500 Implementation and Change Ledger

## Source changes

- Added the production Railway API build, health identity, WordPress session/JWT/gateway adapter, same-origin API proxy, consent gate, LearnDash entitlement check, Matrix entry, and production release packaging.
- Added PostgreSQL identity, grant-hardening, role, RLS, migration, backup, and rollback assets.
- Repaired Railway build duplication without weakening typecheck or validation.
- Repaired anonymous handoff to explicit 303/no-store behavior.
- Repaired Matrix output injection to be nonrecursive after an experimental output-buffer build produced a blank Matrix response.
- Changed eligible Matrix navigation to use eligibility rather than post-consent access; route/token/API still require consent.
- Set consent GET/HEAD status explicitly to 200.
- Changed consent-page Referrer-Policy to `same-origin`, preserving the Origin needed for the same-site POST while withholding cross-site referrer detail.

## Production changes

- Created Kinsta and PostgreSQL backups.
- Applied six accepted PostgreSQL migration/role assets.
- Deployed Railway API deployment `d9ec6013-35e3-4f33-a75d-4ac5d936eed2`.
- Installed immutable WordPress runtime `timeline-wp-0fc51f8906decb8e`.
- Enabled Founder/admin canary, then eligible-360 rollout after security gates passed.
- Final settings: enabled, stage `eligible_360`, approved admin ID `85`, eligibility verified, entitlement version `learndash-course-3893-live-2026-08-04`, consent `d1-500-v1`.

## Final authority closure

- Reconciled only `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json` in commit `9e02238b195c548b10b5343a33bd247b5de0cee4`.
- Updated the exact five stale Matrix metadata groups and added immutable commit/tree/path/SHA-256 custody for all ten protected assets.
- Verified 10/10 immutable source, 10/10 private Kinsta origin, and 9/9 applicable public delivery hashes.
- Imported no unrelated dirty-worktree change and performed no live Matrix, CDN, WordPress, Kinsta, Railway, database, or DNS mutation during closure.

## Defects and disposition

- Duplicate Railway install: repaired.
- Missing provider secrets: Founder installed them server-side; no values entered evidence.
- Blank Matrix experiment: automatically rolled back, then repaired with bounded nonrecursive injection.
- Consent inherited 404: repaired.
- Consent POST rejected opaque Origin: repaired.
- Pre-consent eligible student lacked navigation entry: repaired.
- Synthetic residue: removed from WordPress, usermeta, LearnDash activity, Timeline programs, active documents, and active grants; principals are soft-DELETED and audit/outbox history remains.

No protected presentation redesign occurred.
