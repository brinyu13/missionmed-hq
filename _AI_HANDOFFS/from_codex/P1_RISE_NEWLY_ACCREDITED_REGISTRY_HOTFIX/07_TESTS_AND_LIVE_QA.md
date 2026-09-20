# Tests and Live QA

## Automated

- npm test --prefix rise: 231 passed, 0 failed.
- npm run test:browser --prefix rise: 19 passed, 0 failed.
- Focused refresh tests cover exact identity preservation, research preservation, idempotency, and source-failure fail-closed behavior.
- Browser suite covers canonical catalog, search, filters, Program File, My Programs persistence, compare, admin controls, mobile overflow, and critical accessibility.

## Authenticated live QA

- Home reported 6,245 canonical identities.
- Find Programs reported 6,245 programs and all 31 specialties.
- Newly Accredited filter reported 326 and showed the NEWLY ACCREDITED badge.
- 2025-2026 example: BayCare Health System (St. Joseph's Hospital) Program, Anesthesiology, ACGME 0401100006, Initial Accreditation 04/20/2026.
- 2026-2027 example: Florida International University/Baptist Health Program, Anesthesiology, ACGME 0401100008, Initial Accreditation 09/14/2026.
- Exact-name search located both named examples.
- Anesthesiology + Florida + Newly Accredited composed to the expected named result.
- Program File displayed accreditation status, effective date, ACGME ID, source-check date, and honest Research Pending state.
- Save persisted to My Programs.
- Gold star toggled on and off correctly.
- Priority moved and was restored correctly.
- Admin Research route loaded with the 6,245-program scope and paid execution disabled.
- Delegated admin student directory loaded verified RISE private-beta identities and existing program/gold counts.
- Browser console errors: none.

## Negative access

A clean anonymous in-app browser request to https://missionmedinstitute.com/rise/ redirected to the WordPress login page. Unauthorized access failed closed.

## Test-state note

The named BayCare test program remains saved in the Founder QA account as acceptance evidence. Gold state is off and the preexisting priority order was restored. Removing a saved cloud record through browser automation requires separate destructive-action confirmation.
