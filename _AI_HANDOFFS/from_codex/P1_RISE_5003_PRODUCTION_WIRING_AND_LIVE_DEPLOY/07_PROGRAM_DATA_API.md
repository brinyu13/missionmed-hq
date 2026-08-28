# 07 — Program Data API

The isolated candidate serves same-origin `/rise/` assets and authenticated `/api/rise/v1/*` APIs.

Implemented read surfaces:

- `GET /api/rise/v1/session`
- `GET /api/rise/v1/status`
- `GET /api/rise/v1/programs/catalog` — all active canonical list identities in one bounded bootstrap
- `GET /api/rise/v1/programs` — paginated search/filter API, max page size 50
- `GET /api/rise/v1/program-specialties/:id`
- `GET /api/rise/v1/program-specialties/:id/evidence`
- `GET /api/rise/v1/me/programs`

Implemented student-state mutations:

- `PUT /api/rise/v1/me/programs/:programSpecialtyId`
- `DELETE /api/rise/v1/me/programs/:programSpecialtyId`

The catalog/list views contain canonical IDs, ACGME identifiers where authorized, exact designation/entry format, display identity, official URL where known, evidence summary, source authority/date, and unknown-safe visa states. Search includes IDs and external identifiers. Combined specialties require explicit browse membership handling.

No source-controlled index can start in production without matching artifact hashes, source-rights pins, current revocation check, and an activation receipt. Real registry data is not live.
