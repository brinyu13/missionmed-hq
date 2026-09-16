# Admin Students Implementation

Implemented source:

- `rise/sql/015_admin_students_application_intelligence.sql`
- `rise/sql/015_admin_students_application_intelligence.down.sql`
- `rise/adapters/postgres-runtime.mjs`
- `rise/server.mjs`
- `rise/web/app.js`
- `rise/tests/admin-students.test.mjs`

Capabilities:

- Students is the first administrator navigation destination.
- Search supports available display identity and safe pseudonymous fallback.
- Index filters/sorts include activity, program count, gold-only, and name/recency ordering.
- Student detail shows saved/application state, gold status, specialty/state/institution context, status filters, gold-only filtering, and deterministic sorting.
- Program rows open the existing Program File and return to the selected student.
- My Programs exposes the same gold-star state and prioritizes gold-starred rows.
- Identity projection is refreshed from the authenticated session during bootstrap and My Programs reads.

No administrator mutation endpoint was added.
