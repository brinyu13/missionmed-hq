# MX-CAL-EVENT-COMMAND-CARD-V3 Task Packet

Date: 2026-10-08
Mission: MX-CAL-4200C
Product: Matrix Calendar only
Outcome: Restyle the existing centered V2 event-detail dialog as a premium Event Command Card without changing Calendar data, authorization, persistence, provider contracts, or shared-core behavior.

## Authority and custody

- Governing authority: DR-162, DR-163, DR-204, DR-205.
- Source worktree: `/Users/brianb/MissionMed_worktrees/mx-cal-examprep-sept-oct-2026`.
- Source branch: `codex/mx-cal-examprep-sept-oct-2026`.
- Accepted starting HEAD: `ca61152a99613ff88894368acf2b5a0906d03c0e`.
- Origin relationship at preflight: aligned, `0/0`.
- Preserved unrelated dirty path: `supabase/.temp/cli-latest`.
- Founder runtime-lock override: ticket `MX-CAL-EVENT-COMMAND-CARD-V3`; keys `calendar_v4_js`, `calendar_v4_css` only.
- Runtime-lock preflight: override accepted after local/origin/public equality and manifest drift were reported for only those keys.
- Narrow PATH lease write set: V2 JavaScript, V2 CSS, focused Calendar test, and this packet only.

## Verified production baseline

- V2 JavaScript SHA-256: `2d8990619a38d7ee844917abe7955b0a1090560cd36ce6aef72981c5775480f6`.
- V2 CSS SHA-256: `e1ed55706a5db72b166eab9fc3e59216718c71e5969c0c45405d56b3075d9d59`.
- Shared core SHA-256: `f83ae75440f53d515f7bf0cfa992d42cd774d191f27a87bd329bcde7e7a38d33`.
- Local and public V2/core bytes matched at preflight.

## Writable paths

1. `assets/calendar-v2/mmed-calendar-v2.js`
2. `assets/calendar-v2/mmed-calendar-v2.css`
3. `tests/mx-cal-4200c/calendar-core.test.js`
4. `tests/mx-cal-4200c/MX-CAL-EVENT-COMMAND-CARD-V3_TASK_PACKET.md`

Every other path is read-only or prohibited for this task.

## Implementation contract

- Retain the centered native dialog and existing focus, Escape, viewport, role, favorite, join, replay, edit, and delete behavior.
- Improve only event-detail hierarchy and presentation.
- Present star, replay, and join actions with distinct gold, cyan, and emerald command identities using meaningful inline SVG icons.
- Never synthesize replay or meeting availability. Preserve existing safe URL and capability gates.
- Keep unavailable actions truthful; no disabled-looking action may imply an available link.
- Add restrained atmospheric illumination and border motion with `prefers-reduced-motion` equivalence.
- Preserve Month, Week, Day, Agenda, density, five-row September, Scheduler degradation behavior, timezone, Drill schedule, mobile behavior, and the SEV1 retry-storm hotfix.

## Acceptance matrix

- Viewports: Founder desktop, 1366x768, 1440x900, 390x844.
- States: starred, unstarred, replay available/unavailable, join available/unavailable.
- Inputs: pointer, keyboard, visible focus, Escape, reduced motion.
- Roles: Administrator and Student presentation/capability boundaries.
- Regression: focused Calendar tests, syntax, diff check, four Calendar views, event opening, scheduler warning absent, no horizontal clipping.
- Release: exact preimage backup, guarded Calendar-only deploy, public/origin/browser hash readback, rollback path, and independent read-only production verification.

## Stop lines

- No shared-core, PHP, database, Scheduler, Webex provider, Zoom provider, Drills engine, StoryForge, Matrix shell, or unrelated product mutation.
- No authentication, authorization, entitlement, or URL-validation weakening.
- Stop on lease loss, fencing drift, new runtime-lock drift, unreadable preimage, deployment-target mismatch, or production regression.
