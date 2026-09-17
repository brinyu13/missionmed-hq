# Mission Timeline Builder D1-500

This package is the default-off production launch candidate for the accepted
D1-413 Timeline Builder. It preserves the protected D1-409H-A1 presentation and
adds the authenticated WordPress/Matrix route, same-origin API boundary,
PostgreSQL persistence and RLS, hybrid IndexedDB recovery, consent gating,
release controls, and rollback support authorized by D1-500.

The package does not use the MissionMed Supabase migration root. Remote object
storage and File Vault publication remain disabled and fail closed; the accepted
local import and client-side export workflows remain available.

## Source authority

- Accepted source base: Git commit `49ba56dacd2cddfc2fb2241839d54a03e85bc271`.
- Protected presentation: D1-409H-A1, validated by `PROTECTED_HASHES.sha256`.
- D1-500 production authority: MissionMed OS DR-016, DR-017, and DR-018.
- Canonical student entitlement: current LearnDash access to published course
  `3893`, “Mission Residency: 360 Match Mentorship Student Dashboard & Guidance
  Hub.” The live course uses Closed enrollment; a WordPress login or generic
  role is not sufficient.

## Commands

```bash
npm --prefix packages/mission-timeline run typecheck
npm --prefix packages/mission-timeline test
npm --prefix packages/mission-timeline run build:api
npm --prefix packages/mission-timeline run check:api-only
npm --prefix packages/mission-timeline run test:411c:rls
```

Release builds require the exact accepted binary-asset source and its accepted
manifest because ignored presentation assets are deliberately not duplicated in
Git:

```bash
TIMELINE_EXPECTED_COMMIT=<sealed-commit> \
TIMELINE_ACCEPTED_WEB_ASSET_ROOT=<absolute-accepted-web-root> \
TIMELINE_ACCEPTED_ASSET_MANIFEST=<absolute-accepted-manifest> \
npm --prefix packages/mission-timeline run build:release
```

The static builder verifies every copied presentation asset against the accepted
manifest, injects only content-addressed runtime URLs into the WordPress bundle,
and excludes personal sample-photo fixtures.

## Production boundaries

- Matrix owns login and session validation.
- WordPress verifies live LearnDash course-3893 access and issues short-lived,
  audience-bound Timeline identity claims.
- Students must record the approved remote-sync consent version before remote
  persistence is enabled. Administrators do not receive a false student-consent
  claim.
- Timeline API owns editable `TimelineDocument` records, versions, review, approval, artifacts, and audit.
- IndexedDB remains the immediate local cache and recovery layer.
- Production media/object endpoints return service-unavailable until a separately
  authorized private object store exists.
- FileVault v2 remains disabled and unratified; FileVault is not the draft
  database.
- The accepted client-side renderer remains the active export authority for this
  release.
