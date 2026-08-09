# Timeline UX Implementation 006 - Production Verification

## Live state

- Status: **LIVE**.
- URL: `https://missionmedinstitute.com/timeline/`.
- Source: `14fb4dd3258fb8bf920910fc066495e9835503f5`.
- Static: `timeline-390aab3459459825`.
- WordPress: `timeline-wp-ed84301a63d1ed11`.
- App asset: `_asset/745937a8bdf7`, local full SHA-256 `745937a8bdf7bb522af520cfb45794b6032142d2924c3c9e15b6d73d34888134`.
- API unchanged: `timeline-c9eda9eeb7d6cf98`, deployment `b0c3401a-c482-4aac-9580-8e0067554289`, schema `d1-timeline-db-500.1`.
- Rollout: `eligible_360`, LearnDash course `3893` authority `learndash-course-3893-live-2026-08-04`.

## Authenticated Chrome verification

The current live route opened in the existing authorized Chrome session with:

- WordPress administrator eligibility verified;
- administrator access and unlimited timelines;
- protected kernel `D1-409H-A1`;
- exact app asset token `745937a8bdf7`;
- Matrix return to `/member-dashboard/`;
- no browser warnings or errors.

The loaded document was `Brian RC1 Canary`, containing two events and accumulated editor mutations. It is now explicitly classified as `EDITOR TORTURE FIXTURE - NOT VISUAL AUTHORITY` and was preserved unchanged.

## Canonical fidelity verification

The clean fixture ran in a fresh isolated Chrome profile on the exact final source and immutable bundle. It passed editor entry, all panels, zoom, save, reload, Matrix return, and three exports without canonical visual-model drift. The baseline and reload had zero normalized pixel differences. PNG, Letter PDF, and A4 PDF were opened and visually inspected.

## Current safety probes

- Homepage: HTTP 200.
- Timeline anonymous route: HTTP 303 to approved authentication flow.
- Same-origin direct document API without a session: HTTP 401 `session_required`.
- StoryForge: HTTP 200.
- Arena: HTTP 200.
- Unrelated application impact: **NONE**.

The API service was not changed in this commission. Its accepted deployment health receipt remains release `timeline-c9eda9eeb7d6cf98`, schema `d1-timeline-db-500.1`. An attempted public vanity-host probe resolved to an unrelated/nonexistent route and is excluded; the authoritative health contract remains the authenticated same-origin `/timeline/api/v1/healthz` receipt.

## Access/personas

- Founder/approved administrator: PASS.
- Eligible 360 student: PASS from the accepted unchanged auth/API release and prior live canary.
- Non-360: denied.
- Revoked/expired: denied.
- Anonymous: redirected/denied.
- Direct API without session: denied.
- Cross-student RLS: PASS from unchanged service/database release.

## Rollback and backups

- Immediate rollback: `releases/timeline-wp-7890b335cbbbe44e`.
- Provider backup: `TIMELINE-RC1-EDITOR-UX-004-PRE-20260808T161951Z`.
- Scoped snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260809T181853Z-timeline-ux-006`.
- Feature containment: `timeline_enabled=false` or rollout-stage restriction.

No rollback was triggered because no code/default/render/export drift was found.
