# State Delta

## Before

- Registry: 6,139 programs / 31 specialties.
- Current ACGME scoped universe: 6,219.
- Missing current ACGME IDs: 106.
- Newly accredited discovery: absent.
- Durable current-report refresh: absent.

## After

- Registry release: 6,245 programs / 31 specialties.
- Active ACGME-scoped programs represented: 6,219.
- Added current ACGME IDs: 106.
- Duplicates introduced: 0.
- Existing identities/research overwritten: 0.
- Newly Accredited: 326 current programs across AY 2025-2026 and AY 2026-2027.
- Badge/filter: live and verified.
- API: supports newlyAccredited=true and accreditation-aware read models.
- UI: badge, filter, newest-accreditation sort support, Program File accreditation status/date/source.
- New zero-spend research queue: 106.
- Paid-provider executions: 0.
- Spend: $0.00.
- 1,405 ambiguous identity-drift rows: review required, unchanged.
- 26 rows absent from current Report 1: review required, retained.
- Auth/admin/student/anonymous boundary: preserved.
- Fable chassis: preserved.
- Source commit: 68f2a29 on codex/p1-rise-5015-newly-accredited-hotfix.
- Live deployment: b9111ae6-269f-4823-9265-85552ddab11e.

## Follow-up

Schedule the tested refresh daily during application season and route ambiguous stale/inactive candidates through human review. Do not launch the 106-program research queue without a separate budget authorization.
