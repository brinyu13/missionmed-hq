# V1-8010R Darwin Wave 2 Containment Review

## Initial verdict

`NO-GO` for completing the initially reviewed 8010B draft; `GO` for local
refinement. No files were modified by Darwin.

## Findings

1. **P1 — Calendar response overexposure.** Legacy GET embedded a complete
   Calendar event, while POST/PUT returned the complete Calendar response.
   Owner, meeting, recurrence, source identity, timestamps, priority, and the
   unrestricted metadata bag were exposed although the active Study UI used
   only ten explicit block fields.
2. **P1 — False revision claim.** The attempted compare-and-swap used
   second-resolution `updated_at` plus `meta_json`. Same-second non-metadata
   writes and stale resurrection after soft delete could pass. A PHP string-map
   fixture could not prove MySQL JSON or concurrency behavior. Monotonic V1
   revision belongs in 8010D.
3. **P1 — Incomplete characterization.** The initial fixtures did not cover the
   route permission baseline, CSRF/nonce integration, entitlement,
   administrator-negative behavior, mass assignment, rate behavior, or generic
   Calendar controls. Login-only legacy access may remain documented for 8010B,
   but cannot be reported as resolved.
4. **P1 — Preserve generic Calendar behavior.** The private-audience seam was
   necessary and narrow. The newly introduced delete-on-database-failure error
   needed to be strict-Study-only or separately justified. Unscoped
   administrator and learner update/delete controls were required.
5. **P2 — Test durability.** Tests needed PHP 7.4-compatible syntax, a repeatable
   runner, tracking, and executable evidence.

## Supervisor resolution

- Removed the timestamp/metadata CAS and all 409/revision claims.
- Reduced GET/POST/PUT to the exact Study allowlist: `id`, `title`, `subject`,
  `notes`, `start_at`, `end_at`, `duration`, `status`, `completed`, `category`.
- Preserved internal metadata during partial updates without returning it.
- Added mass-assignment, foreign-owner, foreign-type, administrator-negative,
  explicit-private, unscoped Calendar, and route-baseline fixtures.
- Conditionalized delete database-failure reporting to strict Study calls so
  historical unscoped Calendar behavior is unchanged.
- Added a PHP 7.4/8.3 runner and remote validation workflow.

Entitlement, nonce integration, real WordPress/MySQL behavior, rate controls,
monotonic revision, and cutover-writer denial remain explicit later gates; this
slice does not claim them.

## Manifest review

The existing V1 controller descriptor is consistent with committed 8010A
normalization evidence. Keeping `source_owner` and `validation_ticket` at
V1-8010A preserves historical provenance; 8010R governs subsequent work. The
dirty global manifest must be reconciled before any protected deployment, and
all future V1 loader/assets require registered exact hashes.

## Final re-review

**GO for local 8010B containment.** Darwin found no remaining P0/P1 issue in
the corrected source/tests and confirmed `git diff --check` was clean. This is
not production or deployment approval.

After that review, GitHub Actions run `29386935391` passed the corrected head
under PHP 7.4.33 and PHP 8.3.32 with clean lint and all four fixtures passing.
