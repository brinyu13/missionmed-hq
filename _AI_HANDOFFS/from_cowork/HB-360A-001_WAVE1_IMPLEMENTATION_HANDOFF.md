# HB-360A-001 — HomeBase Wave 0/1 Implementation Handoff

Date: 2026-09-01
Author role: Cowork session (Fable 5 model) acting under direct ticket authority from Dr Brian
Ticket: HB-360A-001 (Fable 5 Master Prompt, EXTREME priority)
Recon adopted: `_AI_HANDOFFS/from_codex/HB-360A-000_SYSTEM_RECON_FOR_FABLE.md`

## Custody

- Branch: `fable/hb-360a-homebase-001-livebase`
- Worktree: `/Users/brianb/MissionMed_worktrees/hb-360a-homebase-001-livebase`
- Base: exact live StoryForge commit `084ce55c1ce377595314580ab979c213f1c0405f`
- Commits (on top of base):
  1. `db0e226` W0: fork StoryForge shell as HomeBase V1
  2. `70ad8df` W1: data model, RLS, Session A seed
  3. `9bcaa98` W1: API runtime and tests
- PUSH PENDING: the sandboxed shell has no GitHub credentials. Per the
  graceful-degradation law the work is committed locally; run
  `git push origin fable/hb-360a-homebase-001-livebase` from the worktree to
  complete filing. Until pushed, this handoff is NOT filed.
- BOOT dependency validation: PASS (universal profile) before work began.
- `missions.json` has no HB-360A-001 record; proceeding authority is the
  ticket itself. Registrar filing still owed.

## What was built

`homebase-v1/` — a sibling application to `storyforge-v5/`, cloned from the
live baseline (styles.css byte-identical + appended `HomeBase V1 additions`
block; fonts/logo byte-identical; same build/deploy pipeline).

- Frontend: `public/index.html`, `public/app.js`, `public/auth.js` — the
  StoryForge shell grammar (rail, header, panels, drawers, chips, empty
  states, view switch) adapted to HomeBase content.
  Student nav: HOME / MY PROGRESS / TASKS / PRIORITIES & ALERTS / CALENDAR /
  FILES. Admin nav: COMMAND CENTER / SESSION ROSTER / CHECKLIST MANAGER /
  TASKS / PRIORITIES & ALERTS / ACTIVITY, plus a read-only "Preview as
  student" subject lens (no impersonation; signed capability only).
- API: `server/app.mjs` + `auth.mjs` + `config.mjs` + `db.mjs`. Env surface
  `HOMEBASE_*`; JWT audience `homebase`; eligibility claim
  `homebase_eligible`; per-request DB identity via
  `request.jwt.claim.*` set_config; service role `homebase_app`.
- Data model (`infra/postgres/migrations/`):
  - `20260901120000_hb_360a_001_homebase_foundation.sql` —
    hb_programs / hb_sessions / hb_enrollments / hb_checklist_categories /
    hb_checklist_items / hb_item_states / hb_tasks / hb_task_assignments /
    hb_alerts / hb_alert_dismissals / hb_files / hb_activity, with RLS
    (students read only their own world; admin reads via signed
    wordpress_admin + admin_mode).
  - `20260901121000_hb_360a_001_session_a_seed.sql` — Session A program/
    session, the 12-person hard allowlist (missing fields NULL + flagged,
    never guessed), default checklist taxonomy from the legacy Master
    Roster sheet, 192 default item states, welcome priority + photo alert.
- Roster gate: enrollment resolution order = wp_user_id → signed email →
  signed username; successful email/username match auto-binds wp_user_id and
  records private activity; name-only match is admin review. Non-roster
  students receive `homebase_roster_required` (dedicated lockout screen).
- PS tracker: legacy 8-stage machine preserved verbatim (admin + student
  labels); stage changes create student-visible activity
  ("Dr B moved your Personal Statement from X → Y").
- WordPress seams:
  - `homebase-v1/infra/wordpress/missionmed-homebase-route.php` — `/homebase/`
    gateway forked from the StoryForge route adapter (release manifest
    placeholder still carries forked values; regenerate with
    `npm run build:release` before any deploy).
  - `wp-content/plugins/missionmed-homebase-sso/` — bootstrap
    (`missionmed_homebase_bootstrap`) + token endpoint
    (`/wp-json/missionmed/v1/homebase/token`), default-off, secret from
    `HOMEBASE_JWT_SECRET`, signed email claim added.
- File Vault / Calendar: reused, not rebuilt. `hb_files` stores metadata
  links only; frontend calls same-origin `/mmed/v2` + `/mmed/v1/events`
  with the WordPress cookie session (`wpRequest` in auth.js).

## Verification evidence (this session)

- Migrations applied cleanly to scratch PostgreSQL 16
  (12 enrollments / 6 categories / 16 items / 192 states / 2 alerts).
- API smoke: healthz, config, admin session, student email-bind (Afthab →
  matched), outsider denied, student home payload, admin command-center
  buckets (12 missing photo, 1 identity review), PS stage 0→4 with correct
  activity copy, session-wide task to 12 students, student submit →
  admin queue, add student → archive, student blocked from admin routes.
- Headless Chromium UI smoke: fixture login, admin command center, roster
  (12 cards), checklist manager, student detail, student home
  ("DR B HAS THE BALL"), progress (8 PS stage steps), tasks. Zero console
  errors with the real stylesheet.
- Unit tests 3/3 (`npm test`). All JS `node --check` clean; both forked PHP
  files `php -l` clean. Dev build produces content-addressed assets.

## Deployment state

NOT DEPLOYED. Wave 1 live activation requires (Brian gate):
1. New Railway service + PostgreSQL for HomeBase; set `HOMEBASE_*` env
   (secrets only in provider env); apply the two migrations; healthz green.
2. `npm run build:release` in `homebase-v1/` → regenerate route manifest →
   governed Kinsta deploy of `missionmed-homebase-route.php` (mu-plugin) and
   the SSO plugin; enable `homebase_enabled` for admin-only first.
3. Validate: anonymous denial, non-roster denial, roster student, admin
   lens, StoryForge/Matrix/File Vault/Calendar regression guards.

## Unresolved risks

1. Push pending (no repo credentials in sandbox).
2. HB-360A-001 not in missions.json (registrar filing owed).
3. Route adapter's generated manifest constants are forked placeholders
   until `build:release` runs.
4. WP-side `mmhb_entitlement_for_user` inherits the StoryForge entitlement
   filter chain; confirm 360 entitlement source before student activation.
5. Photo upload is state-machine + File Vault deep-link only in Wave 1
   (admin sets photo URL/state); dedicated upload flow is Wave 2.
6. Calendar/File Vault frontend calls are cookie+nonce same-origin; verify
   `/mmed/v1/events` response shape against production before relying on it.
7. Webex credential-exposure finding from HB-360A-000 remains untouched.

## Next acceptance criteria

- Branch pushed; mission registered.
- Hosted beta: Dr Brian logs into Matrix → /homebase/ → Command Center with
  the real 12; a roster student sees only their HomeBase; a non-roster
  student is denied. BETA — ACTIVE DEVELOPMENT badge on.
