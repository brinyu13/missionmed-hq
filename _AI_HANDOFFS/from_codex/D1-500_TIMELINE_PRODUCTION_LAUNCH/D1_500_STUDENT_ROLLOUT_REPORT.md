# D1-500 Student Rollout Report

Student rollout state: **LIVE for eligible 360 students**.

## Canonical eligibility

- Source: production LearnDash active access to published Closed course `3893`.
- Entitlement version: `learndash-course-3893-live-2026-08-04`.
- Login or generic student role alone is insufficient.
- Revocation removes route/token access and the Matrix entry.

## Live journeys

- Real active-360 student saw exactly one native Timeline entry in Matrix.
- Matrix entry opened the 200 consent page, accepted `d1-500-v1`, and returned through 303 to the canonical app.
- The real student created a controlled event, saved it remotely, reloaded in another browser, edited it, and observed the updated persisted value.
- A representative second eligible student exported `Canary_D1_Timeline_2026-08-04.png`; the real active-student account's export button was profile-incomplete because Full name was blank, so export acceptance is based on the authorized representative eligible identity.
- The second eligible student could not list, read, or write the first student's records.
- Non-360, expired/revoked, anonymous, and direct-URL/direct-API personas were denied.
- Logout/re-entry and account switching invalidated the previous principal context.
- Token expiry changed the UI to read-only and preserved local draft state; a valid session reload re-exchanged identity.

## Discoverability

- Navigation entry: live at `/member-dashboard/#timeline`.
- Direct route: live at `/timeline/` for entitled users.
- Anonymous direct route: 303/no-store to the approved Matrix flow.
- Operational versioned public Matrix adapter hash: `a13c9cd6fa5420f19cc47691c09da07e79f9813b6ee774066f0d89230c131b8c` (`?ver=500.0.2` and `?ver=500.0.7`). The bare URL is not the injected runtime URL.

All controlled synthetic users and entitlement rows were removed after the tests. Eligible-360 activation remains enabled.
