# Matrix Runtime v2 patch contract

## Proposed host changes

1. Register `matrix/app-manifest.json` in the authoritative Matrix app registry.
2. Add the `/apps/timeline` feature-flagged route.
3. Render one Matrix-owned app root and call `mountMissionTimelineAppMode` with asset/API bases, the internal program ID, return URL, and a short-lived Timeline token obtained by the trusted BFF.
4. On route exit, call `unmountMissionTimelineAppMode` or perform a full page navigation after local flush.
5. Project metadata-only status/counts into Matrix. Never copy TimelineDocument text into Matrix notifications.

## Preserve

- Matrix owns authentication and global navigation.
- D1 owns its CAM v2 application workspace while App Mode is active.
- Blank Builder remains the default.
- Completed sample remains reference-only.
- IndexedDB recovery survives route rollback.
- Existing Matrix behavior outside the feature-flagged route remains unchanged.

## Do not do

- Do not embed the timeline in an iframe.
- Do not pass email or mutable profile fields as authorization.
- Do not expose a service-role database key to the browser.
- Do not clear IndexedDB during rollback.
- Do not enable production FileVault or Mac Pro export merely by mounting the UI.

The live Matrix source authority was not found during D1-411 and was not edited in D1-412. This contract must be mapped to that source before implementation can be called host-integrated.
