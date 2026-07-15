# V1-8010A Characterization Baseline

## Current truth

- The authenticated administrator route `/member-dashboard/#study` renders the
  legacy Calendar-backed Study Schedule week grid, not V1 Study Schedule.
- The active Student OS asset is the governed fingerprinted bundle recorded in
  Decision 14.
- The legacy REST boundary `/mmed/v1/study-blocks` authenticates only at a broad
  logged-in level and delegates update/delete by numeric event ID without V1
  learner entitlement, owner, or governed event-type proof.
- Legacy rows are Calendar-owned `wp_mmed_events` records with numeric IDs,
  naïve datetime fields, and JSON metadata. They are not V1 Plan truth.
- No V1 route mode, V1 data store, V1 REST command boundary, or production V1
  feature flag exists at the accepted implementation base.
- Current administrator rendering showed no console errors, but the timeline
  exposed no focusable controls; previous/next and date controls lacked adequate
  accessible labels.
- At a 390×844 viewport, the Study content begins far below the first screen,
  making the current experience operationally poor on mobile.
- Eligible 360 learner route and mutation behavior remains unverified.

## Characterization suite required before modifying a shared seam

1. admin, eligible learner, and non-entitled bootstrap/access payloads;
2. direct `#study` navigation and shell/loader race;
3. legacy REST list/create/update/delete permission matrix;
4. administrator, impersonation, mentor-field, foreign-owner, and foreign-type
   negative mutation tests;
5. metadata preservation and Calendar/Admin/Session writer inventory;
6. timezone, range, DST, and cross-midnight behavior;
7. every shared Matrix route with V1 off;
8. public/source asset hashes and runtime guard;
9. CSRF/nonce, encoding, mass-assignment, enumeration, and mutation-rate tests;
10. pre/post-watermark readers and legacy-writer denial.

All mutation characterization uses local fixtures or isolated synthetic staging.
Production observation remains read-only until the release phase.

## Product-behavior baseline

The accepted product includes Mission, Day, Week, Month, Journey, Review, Focus,
Quick Build/manual creation, drag/move/resize/nudge, recurrence, Reserve,
Recovery, partial/release/remainder, goals/runways/capacity, mentor proposals,
timer/session state, settings, humane motivation, onboarding, responsive and
keyboard operation, persistence, offline/failure behavior, observability, and
rollback. Prototype behavior receives no production credit until exercised
through the governed command/data/access boundaries.
