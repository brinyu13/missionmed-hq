# MX-GX Calendar native Return to Matrix

Mission: `MX-GX-20261013-001-CALENDAR-RETURN`
Authority: MissionMed OS DR-430/431/437 plus prospective final-closeout renewal DR-439 at `a3531f6f3341667154cef8226d3d997cb7ddefc9`
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

## DR-439 final-closeout state delta

- Product source HEAD/upstream: `35eae8798f29fee601d1dd7d019361e2e07c5605`.
- Unrelated pre-existing `supabase/.temp/cli-latest` modification remains untouched.
- Canonical DR-439 six-path filing/readback: PASS at
  `a3531f6f3341667154cef8226d3d997cb7ddefc9`; fresh independent verifier PASS.
- Fresh universal BOOT: PASS at canonical HQ tip
  `4b8c1a236ded7c4f12fee13e57229df51e0e2418`. This mission has no declared
  mission-profile validator; manual DR-430/431/437/439 resolution PASS.
- Canonical origin-manifest guard: 15/15 source-reference, production and 12
  public assets PASS. The initially consulted stale local HQ checkout manifest
  was rejected and no mismatched asset was normalized or overwritten.
- Fresh focused Calendar tests: 29/29 PASS; JavaScript syntax and diff checks
  PASS.
- Reviewed CSS-only accessibility delta deployed atomically:
  `36dee994e8d21841ab59e01e26523b938b1d84330cea4942d041a9d5bb8c63df`.
- Calendar V2 JS remains
  `4d3a31b117db53bb4580ddb871c6323d506e585574edffe1c09d05974335f6e0`;
  Calendar core remains
  `f83ae75440f53d515f7bf0cfa992d42cd774d191f27a87bd329bcde7e7a38d33`.
- Exact private CSS rollback preimage:
  `/tmp/mx-gx-calendar-return-dr439-rollback.j0Ah2V/mmed-calendar-v2.css`
  (`9774db6f4e890b004fa05a10c6628a8db326c33bc690021b59cc4421f6b6c65a`).
- Authenticated Administrator rendered QA PASS at 1536x864, 1366x768,
  1440x900 and 390x844. Screenshots captured at each viewport. The native link
  is unique, visibly labeled, points to `#dashboard`, measures 44px high at all
  four viewports, has 10px mobile type, and produces no horizontal overflow.
- Month data, five-row October geometry, both Drill rows, compact centered
  navigation, view switcher, Event Command Card, absent enrichment warning and
  scoped hiding of the duplicate global overlay remain present.
- The unchanged deployed JavaScript had already passed authenticated dirty Add
  Event confirm/cancel preservation and genuine-student desktop/mobile Return
  navigation before the CSS-only release. Fresh deterministic coverage still
  proves dirty Add/Edit/task/quick-add and all active-write blocking without
  mutating event or todo data.

Remaining closeout: final browser interaction recheck when the shared Chrome
debugger is uncontended, final independent live read-only verdict, evidence
commit/push, normal PATH lease release and provider-zero readback.
