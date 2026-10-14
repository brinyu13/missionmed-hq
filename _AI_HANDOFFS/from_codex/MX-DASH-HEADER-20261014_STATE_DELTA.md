# Matrix website header exclusion — DR-450

Source branch: `codex/mx-dashboard-header-20261014` from `7eb283e17c09f780ae48f849e241002a3964a3b0`.

The additive MU adapter excludes WPCode snippet 6023 and Astra's fallback only when WordPress resolves page 4243 at `/member-dashboard[/]` for the authenticated current user's valid logged-in cookie on a frontend request. It leaves all other routes, snippets, the public website, Matrix application code, appearance preferences, Arena art, and admin toolbar untouched. No database or preference mutation is part of this change.

Validation: focused native PHP request fixture and PHP lint passed; the canonical source preflight and full 15-asset Matrix runtime guard passed before activation. Independent source and guarded release review approved exact source commit `770768c0bc632785d4fd7486c966aa1beb62c1ca` and adapter SHA-256 `251fe2f8a3ee8037c9aca64f387e17e68c061f5d7a7f45a28b694a72e102c71e`.

Production activation: one new MU PHP path only, installed through a private readable absence rollback and exclusive atomic hard link under exact lease epoch `5993`. Origin SHA-256 readback matched the approved adapter; origin PHP lint passed. Private rollback directory: `/www/theresidencyacademy_209/private/mx-dashboard-header-rollback-20261014T220723Z-5993`.

Foreman reported actual production browser readback on authenticated Administrator Chrome at 1234×600 and 390×844: `#mm-l5-header` and `#masthead` absent, native Matrix sidebar and WordPress admin toolbar retained, Dark appearance retained, `body::before` content `none`, Arena showcase present, and zero captured console errors. A refreshed public homepage retained `#mm-l5-header` and its original navigation. These are Administrator and public-page observations only. Genuine STUDENT and Light browser checks remain OPEN because the available IAB is at `wp-login` and the accessible Chrome session is Administrator. No preference change was made.

Rollback: verify the installed MU file by exact hash and stat, then quarantine that exact file to the private rollback directory, restoring the prior absence. Do not change WPCode, theme, preferences, or other assets.
