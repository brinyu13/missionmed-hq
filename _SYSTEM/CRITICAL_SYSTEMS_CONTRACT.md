# MissionMed Critical Systems Contract

Status: ACTIVE
Authority: MM-CRITICAL-SYSTEMS-GUARD-001
Effective: 2026-06-25

This contract protects MissionMed shared production surfaces from silent regressions while new systems continue to ship. It is additive: it does not replace the Matrix runtime lock, the data-flow contract, the Supabase migration protocol, or HTML deploy protocol.

## Protected Systems

The critical contract applies whenever work touches:

- Shared auth/session/bootstrap routes.
- MissionMed HQ / Railway runtime.
- WordPress/Kinsta proxy routes, mu-plugins, auth handoff, and wrapper pages.
- Cloudflare R2 / CDN live HTML assets.
- Supabase project routing, tables, RPCs, or RLS assumptions.
- Arena login/runtime bootstrap.
- USCE admin auth relay, protected admin reads, and CDN admin runtime.
- Matrix-owned apps, current and future.

Future Matrix-owned apps and future non-Matrix apps become protected before launch. A new route, asset, endpoint, RPC, iframe, CDN key, or app mode is not demo-safe until it has a manifest entry, smoke expectation, owner, and rollback path.

## Source-Of-Truth Rules

1. Production runtime behavior wins over prose documentation when they conflict.
2. The manifest pin wins over committed source when determining deploy readiness.
3. Committed source wins over local uncommitted source for deploy baselines.
4. Prose docs are advisory until reconciled into the manifest.

If local source differs from live CDN/R2, stop and report the hash mismatch. Do not assume local is current.

If WordPress/Kinsta restore changes one layer, rerun the full critical gate across HQ, WordPress, CDN, Supabase, Arena, USCE, and Matrix.

If Supabase project ownership is unclear, stop. Pin by project, schema, table, and RPC before changing code.

## Runtime Owner Rule

Every protected route must declare the runtime owner that actually serves production. For MissionMed HQ production, Railway starts:

```text
node missionmed-hq/server.mjs
```

The `app/api/**` Next tree is an inactive lookalike for current Railway production unless a later deployment record proves otherwise. Do not edit `app/api/**` to fix live Railway production.

## Contract Classes

Each protected system may declare one or more contract classes:

- `auth_session`: session, exchange, bootstrap, cookie, secret, and handoff behavior.
- `route`: HTTP method, expected status, expected body, and forbidden statuses.
- `redirect_handoff`: expected 302 destination, target allowlist, and WordPress action.
- `cors_header`: allowed origins, credentials, and Vary behavior.
- `cdn_asset`: live URL, R2 key, local source, approved hash, and cache-busted validation.
- `wordpress_wrapper`: wrapper page, mu-plugin file, proxy target, and cache expectations.
- `supabase_pin`: project ref, schema, table, RPC, role boundary, and RLS expectation.
- `matrix_runtime`: delegated to the Matrix runtime lock and browser app-mode checks.
- `deploy_artifact`: start command, import resolution, ignored files, and bundle hygiene.
- `browser_journey`: authenticated user/admin flow with final visible state and console expectations.

## Stop-The-Line Rules

Stop before deploy or destructive repair if any condition is true:

- A protected file or route is missing from the manifest.
- A protected file is untracked or dirty when creating a deploy baseline.
- The gate targets inactive source instead of the production runtime owner.
- `node --check` fails for the active Railway start file.
- A relative import from the active start file is missing.
- A protected route returns `404`, `5xx`, or unexpected `501`.
- A relay route that should redirect returns `401`.
- CDN/R2 live hash differs from the approved manifest hash without explicit approval.
- Matrix runtime guard reports stale source, missing source, or hash mismatch.
- CORS drops `https://cdn.missionmedinstitute.com` from HQ auth/admin reads.
- Supabase project ref in code does not match the manifest pin.
- A WordPress mu-plugin backup or duplicate `.php` file sits in the auto-loaded mu-plugin root.
- `MMHQ_SESSION_SECRET` is missing or configured as an ephemeral fallback in production.

## Deploy Gate Phases

The critical systems gate runs in phases:

1. Local artifact checks: git protection, syntax, start command, imports.
2. Unauthenticated HTTP checks: health, wrappers, relay, expected protected failures.
3. CDN/R2 asset checks: origin URL, approved SHA256, required markers.
4. Browser smoke checks: authenticated Arena, USCE admin, Matrix app routes.
5. Log checks: Railway status and recent errors.

The initial gate is report-only by default. Use `--enforce` to make failures non-zero.

## Matrix Delegation

Matrix app hashes and route invariants remain delegated to:

- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
- `/Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py`

The global manifest references Matrix as a delegated lock. It does not reimplement Matrix hash validation.

## Supabase Project Pinning

`command_center` exists in more than one Supabase project. Pin by object, not schema name:

- USCE `command_center.usce_*` objects are pinned to RANKLISTIQ `fglyvdykwgbuivikqoah`.
- CRM/HQ `command_center.students`, `leads`, `payments`, `email_drafts`, and `events` are pinned to Growth Engine `plgndqcplokwiuimwhzh`.
- Scheduler Staging `avpdetdkpwmqqxtvomix` exists and must be inventoried before production dependency claims.

Changing code to match stale prose documentation is forbidden. Correct the documentation or manifest first.

## Current Known-Good Baseline

As of 2026-06-25:

- Git commit: `3f0c27aac55dbf82748b3eaba360006d4041b539`
- Git tag: `known-good/2026-06-25-critical-auth-usce-arena-matrix`
- Railway deployment restored from clean minimal package: `27280193-c85b-49de-8b03-58e28ba0c9f3`

