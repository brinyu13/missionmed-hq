# Tests and Browser QA

## Automated verification

- Focused application/filter/review suite: 20/20 PASS.
- Browser suite: 18/18 PASS in 48.5 seconds.
- Browser coverage includes resident country rendering, country-filter count reduction, leadership rendering, no false empty leadership state, numeric filters, responsive/mobile layout, and no horizontal overflow.
- Earlier full test run: 214 PASS, 0 FAIL, 2 CANCELLED out of 216.

The two cancelled legacy files were `tests/postgres-runtime.test.mjs` and `tests/soap-2026.test.mjs`. Both report a pending-promise/event-loop lifecycle cancellation rather than an assertion failure. Direct SOAP import inspection stalled in the pre-existing legacy workbook import path. This was not changed in 5012J.

## Live authenticated browser QA

Authenticated Founder/admin QA through `https://missionmedinstitute.com/rise/` verified:

- Registry headline: 6,139 programs.
- Specialty taxonomy: 31 specialties.
- IMG evidence: 3,514.
- Visa published: 4,470.
- SOAP 2026 count: 883.
- Matrix profile and admin controls remain present.
- My Programs retains the existing saved-program count.
- University of Texas Southwestern Medical Center Program opens from the live catalog.
- The Residents tab shows 44 full-width roster entries, official composition, a distinct roster-derived estimate, 44/44 coverage, resident/school/PGY/school-country/category controls, and country options Iran, United States, and United States (Puerto Rico).
- The Leadership & Faculty tab displays Lauren Phillips as Program Director and no longer shows the false empty-state copy.
- Long evidence is contained without controlling the full card height.

Live filter counts observed: Deep Research 375; Enriched Research 598; Basic Profile 5,165; Research Pending 1; DO evidence 3,671; Caribbean evidence 122; US MD evidence 5,005; J-1 4,420; H-1B 1,304; J-1 or H-1B 4,464; Any Visa 4,470.

Internal Medicine live combinations: baseline 695; Any Visa 518; J-1 512; J-1 + IMG 452; J-1 + Deep Research 99. Clear filters restored 6,139.

## Negative control

Anonymous request to the normal live URL returned HTTP 302 to WordPress login with `no-store, no-cache`, Cloudflare dynamic, and Kinsta bypass/MISS headers. No RISE data was exposed.

