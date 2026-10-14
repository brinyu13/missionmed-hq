# Matrix website header exclusion — DR-450

Source branch: `codex/mx-dashboard-header-20261014` from `7eb283e17c09f780ae48f849e241002a3964a3b0`.

The additive MU adapter excludes WPCode snippet 6023 and Astra's fallback only when WordPress resolves page 4243 at `/member-dashboard[/]` for the authenticated current user's valid logged-in cookie on a frontend request. It leaves all other routes, snippets, the public website, Matrix application code, appearance preferences, Arena art, and admin toolbar untouched. No database or preference mutation is part of this change.

Validation: focused native PHP request fixture, PHP lint, canonical preflight, and full 15-asset Matrix runtime guard are required before deployment. Independent source and guarded release review are pending.

Production activation: one new MU PHP path only, using a private readable absence rollback and exclusive atomic install after exact source, fence, origin, and lint checks. Real administrator desktop/mobile Dark/Light and public-page browser checks are Foreman-owned. Genuine student browser acceptance remains OPEN until observed with a student account; administrator evidence cannot close it.

Rollback: verify the installed MU file by exact hash and stat, then quarantine that exact file to the private rollback directory, restoring the prior absence. Do not change WPCode, theme, preferences, or other assets.
