# MX-GX Calendar native Return to Matrix

Mission: `MX-GX-20261013-001-CALENDAR-RETURN`
Authority: MissionMed OS DR-430 plus prospective fence-loss renewal DR-431 at `e8b5754ed1a6d070dd8fc42561c92f54a8e02787`
Base: `31bcb4f80caea0d182e37f650b349193c982e783`

## Bounded task

- Refine the existing Calendar V2 `.mcv2-matrix-link`; do not add a new shell or global runtime control.
- Visible label: left arrow plus `Return to Matrix`.
- Exact destination: `https://missionmedinstitute.com/member-dashboard/#dashboard`.
- Hide the separate global overlay only while the verified native Calendar control is mounted; remove the scoped body state on unmount.
- Confirm before leaving dirty Add/Edit Event, task-detail, or nonempty quick-add task state. Cancel preserves route, DOM values, modal state, and focus.
- Track every V2 mutating promise locally. While a write is active, block Return without unmounting, aborting, retrying, or duplicating it.
- Preserve all current Calendar rendering, Event Command Card, Scheduler enrichment, Drill schedule, roles, timezone, auth/entitlements, responsive density, and SEV1 retry-storm protection.

## Exact write set

1. `wp-content/plugins/missionmed-hub/assets/calendar-v2/mmed-calendar-v2.js`
2. `wp-content/plugins/missionmed-hub/assets/calendar-v2/mmed-calendar-v2.css`
3. `wp-content/plugins/missionmed-hub/tests/mx-cal-4200c/calendar-core.test.js`
4. This evidence file.

No runtime-lock override, manifest/shell/shared-core/backend/database/auth/event-data or sibling-product write.

## Pre-mutation gates

- Canonical DR-430 registration pushed/read back: PASS.
- Universal BOOT plus manual mission/passport/decision resolution: PASS.
- Canonical immutable full 15-asset runtime guard, origin and public: PASS.
- Exact PATH lease: epoch 5851, exact four-path fence: PASS.
- Existing unrelated `supabase/.temp/cli-latest` modification preserved.
- The first product PATH keeper lost its fence, expiring DR-430. No production
  mutation followed. DR-431 was independently reviewed, canonically filed,
  BOOT/runtime-guard revalidated, and the preserved candidate was prospectively
  adopted under fresh exact PATH epoch 5876; this is not retroactive authority.

## State delta

Pending implementation, tests, guarded publication, live visual/interaction QA,
independent verification, rollback readback, and lease release.
