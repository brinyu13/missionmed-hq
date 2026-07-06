# Product

MissionMed HQ

# Status

Protected active product. Evidence: `/Users/brianb/MissionMed_worktrees/MM-OS-OPTIMIZATION/MISSIONMED_SYSTEM_STATE/products.json` lists MissionMed HQ with `health` = `protected_active`.

# Runtime Owner

Railway runtime starts `node missionmed-hq/server.mjs`. Evidence: `_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`, root `package.json`, `railway.json`, and `missionmed-hq/package.json`.

`app/api/**` is an inactive lookalike for current Railway production unless a later deployment record proves otherwise. Evidence: `_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md` and `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`.

# Source Locations

- `missionmed-hq/server.mjs`: active Railway server entry.
- `missionmed-hq/routes/*.mjs`: route modules used by the server.
- `missionmed-hq/package.json`: package-local start command.
- `package.json`: root start, build, test, and typecheck commands.
- `railway.json`: Railway start command.
- `app/api/**`: inactive-source warning area, not current Railway owner.

# Routes and Entry Points

- `/health`: server health route in `missionmed-hq/server.mjs`.
- `/api/auth/start`: auth start route in `missionmed-hq/server.mjs`.
- `/api/**`: API dispatcher in `missionmed-hq/server.mjs`.
- Browser/admin routes: NEEDS VERIFICATION against current critical manifest or live gate output before claiming production behavior.

# Authority Docs

- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/NAMING_CANON.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `/Users/brianb/MissionMed_OS/authority_index.json`

# Protected Paths

- `missionmed-hq/server.mjs`
- `missionmed-hq/routes/**`
- `railway.json`
- `package.json`
- `missionmed-hq/package.json`
- `app/api/**`, inactive for current Railway production unless evidence changes
- `_SYSTEM/**` authority files
- Supabase migrations and data paths

# Dependencies

- Railway runtime.
- WordPress/Kinsta auth and proxy layer.
- Supabase projects governed by `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`.
- CDN/LIVE assets when HQ routes or wrappers read them.
- MissionMed OS current state at `/Users/brianb/MissionMed_OS/CURRENT.md`.

# Validation Commands

```bash
node --check missionmed-hq/server.mjs
npm run build
npm test
npm run typecheck
```

NEEDS VERIFICATION in this branch: `_SYSTEM/tools/critical_systems_gate.py --skip-network` is named by the audit package but is not present on the clean `origin/main` worktree used for this passport.

# Smoke Tests

- Local or gated check: `GET /health` should return server health.
- Local or gated check: protected API routes should return expected auth failures, not route-missing failures.
- Do not smoke production without the Critical Systems Contract gate and explicit mission scope.

# Deploy and Rollback

- Do not deploy from this passport.
- Deploy gates and rollback baselines are governed by `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`.
- Current known-good baseline is recorded in the Critical Systems Contract.

# Known Risks

- Inactive-source trap: editing `app/api/**` may not affect live Railway production.
- Auth/session/bootstrap regressions affect Arena, USCE, Matrix, and HQ surfaces.
- Supabase project split-brain can route correct code to the wrong project.
- Runtime truth or manifest pins can supersede local committed source.

# Current State Pointer

- `/Users/brianb/MissionMed_OS/CURRENT.md`
- Mission registry: `/Users/brianb/MissionMed_OS/missions.json`

# Do Not Touch

- Do not edit Railway runtime behavior without a decision record and Critical Systems Contract gate.
- Do not edit auth/session endpoints casually.
- Do not add secrets, tokens, keys, cookies, env values, or credentials to files.
- Do not modify Supabase migrations, data, RLS, or RPCs under this passport ticket.

# Last Verified

2026-07-06 by Codex using the evidence paths named in this passport.
