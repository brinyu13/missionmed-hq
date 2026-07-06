# Product

Arena

# Status

Legacy protected product. Evidence: `/Users/brianb/MissionMed_worktrees/MM-OS-OPTIMIZATION/MISSIONMED_SYSTEM_STATE/products.json` lists Arena with `health` = `legacy_protected`.

Arena Next is separate draft platform work. Evidence: the same products file lists Arena Next with `health` = `draft`. Arena Next work must not modify legacy `/arena` without an explicit gate.

# Runtime Owner

Legacy `/arena` is served through WordPress/Kinsta route proxy and CDN LIVE HTML. Evidence: `wp-content/mu-plugins/arena-route-proxy.php` and `LIVE/arena.html`.

# Source Locations

- `LIVE/arena.html`: legacy Arena LIVE HTML source in this worktree.
- `UPLOAD ENGINE_Arena+Drills+Mode_HTML/arena.html`: upload-engine Arena source artifact.
- `wp-content/mu-plugins/arena-route-proxy.php`: WordPress route proxy for `/arena`.
- `wp-content/mu-plugins/arena-bypass.php`: Arena-related mu-plugin.
- `wp-content/mu-plugins/missionmed-arena-identity-guard.php`: Arena identity guard.
- `VALIDATION/validate_deploy.sh`: local LIVE asset checks.
- `VALIDATION/validate_runtime.sh`: CDN and WordPress proxy checks.

# Routes and Entry Points

- `/arena`: WordPress first-party route, proxied by `wp-content/mu-plugins/arena-route-proxy.php`.
- `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html`: CDN LIVE artifact named by proxy and validation scripts.
- `/api/auth/exchange` and `/api/auth/bootstrap`: auth endpoints referenced by `LIVE/arena.html` and validation scripts.
- `/stat` and `/drills?entry=daily_rounds`: Arena navigation targets checked by `VALIDATION/validate_deploy.sh`.

# Authority Docs

- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `/Users/brianb/MissionMed_worktrees/MM-OS-OPTIMIZATION/_AI_HANDOFFS/from_fable/MM-FABLE-MMOS-003_FINAL_UNIFIED_CHARTER.md`
- `/Users/brianb/MissionMed_OS/authority_index.json`

# Protected Paths

- `LIVE/arena.html`
- `UPLOAD ENGINE_Arena+Drills+Mode_HTML/arena.html`
- `wp-content/mu-plugins/arena-route-proxy.php`
- `wp-content/mu-plugins/arena-bypass.php`
- `wp-content/mu-plugins/missionmed-arena-identity-guard.php`
- Auth endpoints and Railway session/bootstrap code.
- Supabase project routing and Arena/STAT data flows.

# Dependencies

- WordPress/Kinsta route proxy.
- CDN LIVE asset storage.
- Railway auth exchange/bootstrap runtime.
- RANKLISTIQ Supabase for Arena/STAT data per `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`.
- MissionMed Platform only for future Arena Next work, not legacy `/arena` changes.
- Related modes: STAT and Drills. They are related modes, not duplicate Arena passport scope.

# Validation Commands

```bash
bash VALIDATION/validate_deploy.sh --prompt-id MM-SPINE-002
node --check missionmed-hq/server.mjs
npm run build
```

Use `VALIDATION/validate_runtime.sh` only in a mission that permits network checks. It performs CDN and WordPress reachability checks.

# Smoke Tests

- Confirm `/arena` route remains a first-party route.
- Confirm Arena uses `/api/auth/exchange` and `/api/auth/bootstrap`.
- Confirm Arena still routes STAT to `/stat`.
- Confirm Arena still routes Daily Drills to `/drills?entry=daily_rounds`.
- Confirm no `supabase.auth.signUp` or service-role string is introduced in LIVE Arena HTML.

# Deploy and Rollback

- Do not deploy from this passport.
- Use Critical Systems Contract gates for protected live-system fixes.
- Use existing validation scripts and manifest/hash proof before any deploy mission.

# Known Risks

- CDN/R2 and local source can drift.
- WordPress mu-plugin route behavior can differ from local HTML.
- Auth endpoint regressions can break Arena entry and STAT/Drills handoffs.
- Arena Next/platform work can be confused with legacy `/arena` unless the route is explicit.

# Current State Pointer

- `/Users/brianb/MissionMed_OS/CURRENT.md`
- Mission registry: `/Users/brianb/MissionMed_OS/missions.json`

# Do Not Touch

- Do not modify legacy `/arena`, LIVE assets, CDN assets, mu-plugins, auth, or Supabase without a scoped decision record.
- Do not route Arena Next through legacy `/arena` by default.
- Do not deploy, purge cache, or modify production from this passport ticket.

# Last Verified

2026-07-06 by Codex using the evidence paths named in this passport.
