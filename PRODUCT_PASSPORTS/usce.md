# Product

USCE

# Status

Protected active product with recent repairs. Evidence: `/Users/brianb/MissionMed_worktrees/MM-OS-OPTIMIZATION/MISSIONMED_SYSTEM_STATE/products.json` lists USCE with `health` = `protected_active_with_recent_repairs`.

# Runtime Owner

USCE runs through the MissionMed HQ Railway runtime and LIVE wrappers. Evidence: `_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`, `missionmed-hq/server.mjs`, `missionmed-hq/routes/usce-public-intake.mjs`, `missionmed-hq/routes/usce-offer-portal.mjs`, `missionmed-hq/routes/usce-status-tracker.mjs`, `LIVE/usce_admin.html`, and `LIVE/usce_student.html`.

# Source Locations

- `missionmed-hq/server.mjs`: mounts USCE API routes.
- `missionmed-hq/routes/usce-public-intake.mjs`: public intake and admin public-intake routes.
- `missionmed-hq/routes/usce-offer-portal.mjs`: offer portal and admin offer routes.
- `missionmed-hq/routes/usce-status-tracker.mjs`: student status tracker route.
- `missionmed-hq/public/usce.html`
- `missionmed-hq/public/usce-admin.html`
- `missionmed-hq/public/usce-student.html`
- `LIVE/usce_admin.html`
- `LIVE/usce_student.html`
- `supabase/migrations/*usce*.sql`: historical migration files, do not edit in this ticket.

# Routes and Entry Points

- `/api/usce/public/requests`
- `/api/usce/public/config`
- `/api/usce/admin/public-intake-requests`
- `/api/usce/offer/**`
- `/api/usce/portal/**`
- `/api/usce/student/status`
- `/api/usce/health`
- /api/usce/admin/auth/relay
  Admin auth relay.
  Highest regression-risk route based on prior MissionMed repair history.

- /api/usce/analytics/**
- /api/usce/cron/**
- /api/usce/webhook/**
- LIVE wrapper pages: `LIVE/usce_admin.html` and `LIVE/usce_student.html`
- Evidence: route constants and route patterns in `missionmed-hq/server.mjs` and `missionmed-hq/routes/usce-*.mjs`.

# Authority Docs

- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `/Users/brianb/MissionMed_OS/authority_index.json`

# Protected Paths

- `missionmed-hq/server.mjs`
- `missionmed-hq/routes/usce-*.mjs`
- `LIVE/usce_admin.html`
- `LIVE/usce_student.html`
- `missionmed-hq/public/usce*.html`
- `supabase/migrations/*usce*.sql`
- USCE Supabase tables, RPCs, auth relay, offer flow, email notification path, and public route wrappers.

# Dependencies

- Railway MissionMed HQ runtime.
- WordPress session and auth relay.
- CDN LIVE wrappers.
- RANKLISTIQ Supabase `command_center.usce_*` data per `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`.
- Email notification provider integration. NEEDS VERIFICATION before claiming current live-send state.
- LearnDash and payment handoffs named by USCE route code. NEEDS VERIFICATION before changing.

# Validation Commands

```bash
node --check missionmed-hq/server.mjs
node --check missionmed-hq/routes/usce-public-intake.mjs
node --check missionmed-hq/routes/usce-offer-portal.mjs
node --check missionmed-hq/routes/usce-status-tracker.mjs
npm run build
```

Do not run production smoke, email send, payment, cache, deploy, or Supabase mutation commands from this passport ticket.

# Smoke Tests

- Local or gated check: unauthenticated protected USCE admin/API routes should return expected auth failure, not route-missing failure.
- Public intake route behavior must be validated without writing production data unless an explicit mission authorizes it.
- Offer portal, status tracker, email notification, payment, and LearnDash handoffs require scoped validation before release.

# Deploy and Rollback

- Do not deploy from this passport.
- Critical Systems Contract controls deploy gates and rollback.
- Supabase migrations are immutable; write new migrations only under a separate authorized migration mission.

# Known Risks

- Admin auth relay regression.
- Offer flow token and portal regression.
- Supabase project/schema split-brain.
- Email notification send-state ambiguity.
- Public route drift between Railway routes, LIVE wrappers, and CDN.
- Runtime repair history for USCE route, offer runtime, public intake, and auth relay.

# Current State Pointer

- `/Users/brianb/MissionMed_OS/CURRENT.md`
- Mission registry: `/Users/brianb/MissionMed_OS/missions.json`

# Do Not Touch

- Do not modify USCE runtime behavior from this passport ticket.
- Do not touch Supabase migrations, tables, data, RPCs, or RLS.
- Do not send emails, trigger payments, purge cache, deploy, or alter production routes.
- Do not write secrets, tokens, keys, cookies, env values, or credentials.

# Last Verified

2026-07-06 by Codex using the evidence paths named in this passport.
