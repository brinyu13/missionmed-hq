# I1Q-1008A Deployment Topology

## Verdict

`EXISTING SHARED TOPOLOGY OBSERVED; NO I1Q STAGING OR PRODUCTION ROUTE REGISTERED`

MissionMed currently has protected WordPress, Railway, Supabase, R2/CDN, and Matrix deployment surfaces. None is registered as an I1Q service route. The repository's root Railway definition starts MissionMed HQ, not I1Q. The HTML deploy route promotes Arena, STAT, Drills, and Daily assets only. No I1Q GitHub workflow, service, host, health URL, environment, monitoring target, or rollback selector exists.

## Current Provider Topology

```text
GitHub repository: brinyu13/missionmed-hq
  |
  +-> Railway production service: MissionMed HQ
  |     start: node missionmed-hq/server.mjs
  |     health: https://missionmed-hq-production.up.railway.app/health
  |     auth: /api/auth/*
  |
  +-> WordPress/Kinsta first-party site
  |     wrappers: /arena, /stat, /drills, /daily, Matrix routes
  |     auth proxy: /api/auth/* -> Railway HQ
  |
  +-> Cloudflare R2/CDN protected HTML
  |     html-system/STAGING/{arena,stat,drills,daily}.html
  |     html-system/LIVE/{arena,stat,drills,daily}.html
  |
  +-> Supabase RANKLISTIQ
        auth and data plane for Arena, STAT, USCE, future i1q schema

I1Q local source: i1q-question-platform/
  -> no registered provider
  -> no staging host
  -> no production host
  -> untracked identity-adapter candidate, no startup/provider wiring
  -> no database connection
```

## Existing Runtime Owners

| Surface | Provider | Runtime source or artifact | Control evidence | I1Q use |
| --- | --- | --- | --- | --- |
| MissionMed HQ | Railway | `missionmed-hq/server.mjs` | `railway.json`; Critical Systems Manifest | Protected dependency only. Root deploy config cannot launch I1Q. |
| WordPress auth and wrappers | WordPress/Kinsta | `wp-content/mu-plugins/*.php` and Matrix plugin assets | Critical Systems Contract; Matrix Runtime Lock | Protected dependency. No I1Q wrapper registered. |
| Arena, STAT, Drills, Daily | Cloudflare R2/CDN | `html-system/STAGING/*` and `html-system/LIVE/*` | `_SYSTEM/DEPLOY_MANIFEST.json`; `_SYSTEM/deploy.sh` | Existing consumers only. Not an I1Q app route. |
| RANKLISTIQ | Supabase | Project `fglyvdykwgbuivikqoah` | MR-078B; DR-006; Critical Manifest | Authorized future `i1q` target, not applied. |
| I1Q local app | Local Node | `i1q-question-platform/src/server.mjs`; untracked `src/identity-adapter.mjs` | Local package and concurrent in-flight source only | Synthetic localhost candidate; no application composition root, provider binding, or authority ratification. |

The live HQ health URL returned HTTP 200 on 2026-07-15. This proves reachability only. It does not prove a safe I1Q auth contract or source parity.

## HQ Railway Route

Tracked deployment definition:

`/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/railway.json`

```text
builder: NIXPACKS
start command: node missionmed-hq/server.mjs
restart policy: ON_FAILURE, maximum 10 retries
```

The Critical Systems Manifest pins:

- runtime owner `railway_missionmed_hq`;
- environment `production`;
- known-good Git commit `3f0c27aac55dbf82748b3eaba360006d4041b539`;
- known-good Railway deployment `27280193-c85b-49de-8b03-58e28ba0c9f3`.

Current tracked `missionmed-hq/server.mjs` SHA-256 is `870e6065fe8f19849d1dfc6484478d66b2ac6d74ee9e1db4fcda9be89b3a2db8`, and the source differs from the known-good commit. Current production source parity was not established by this lane.

`MISSING`: exact Railway project ID, service ID, source branch, automatic deployment trigger, environment binding, build ID, current deployment commit, and rollback selector are not represented in inspected repository files.

`PROTECTED`: deploying the repository root as I1Q would start or redeploy MissionMed HQ. It is not a safe I1Q path.

## WordPress Route Topology

| First-party path | Source | Upstream |
| --- | --- | --- |
| `/api/auth/*` | `wp-content/mu-plugins/missionmed-hq-proxy.php` | Hardcoded production HQ Railway origin |
| WordPress handoff | `wp-content/mu-plugins/missionmed-hq-auth-handoff.php` | HQ `/api/auth/session` |
| `/arena` | `wp-content/mu-plugins/arena-route-proxy.php` | CDN Arena runtime |
| `/stat` | `wp-content/mu-plugins/stat-route-proxy.php` | CDN STAT runtime |
| `/drills`, `/daily` | `wp-content/mu-plugins/drills-route-proxy.php` | CDN Drills or Daily runtime |
| Matrix routes | Matrix plugin and locked assets | Kinsta production runtime |

No `question-platform`, `i1q`, or I1Q route was found in the WordPress proxy sources, MissionMed HQ routes, LIVE assets, Deploy Manifest, or Critical Systems Manifest.

The current handoff allowlist permits the production HQ Railway host as a return host and WordPress hosts as final targets. It does not permit an independent I1Q staging host.

## R2/CDN HTML Promotion

Files:

- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/_SYSTEM/DEPLOY_MANIFEST.json`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/_SYSTEM/deploy.sh`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/VALIDATION/validate_deploy.sh`
- `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/VALIDATION/validate_runtime.sh`

Observed sequence:

```text
tracked LIVE source
  -> local validation
  -> clean deploy-scope check
  -> HEAD equals upstream Git ref
  -> local rollback snapshot
  -> authenticated R2 upload to STAGING
  -> STAGING runtime validation
  -> R2 server-side copy to LIVE
  -> cache purge or cache-busted fallback
  -> LIVE runtime validation and wrapper probes
```

The manifest contains only Arena, STAT, Drills, and Daily mappings. This is a local protected deploy script with a Git synchronization gate. It is not an I1Q GitHub Actions workflow, and it must not be extended or executed by this ticket lane.

## GitHub Workflow Inventory

Source branch `i1q-statquestions-1008a` contains no `.github/workflows/` directory. The source remote branch `origin/i1q-question-platform-ultra-1007x-ma` also contains none.

A read-only GitHub API query on 2026-07-15 reported these active repository workflows:

| Workflow | Path | I1Q relevance |
| --- | --- | --- |
| D9 Matrix source validation | `.github/workflows/d9-matrix-source-validation.yml` | Matrix only |
| V1 Study Schedule 8010C integration seam | `.github/workflows/v1-study-schedule-8010c.yml` | Scheduler only |
| V1 Study Schedule 8010D persistence kernel | `.github/workflows/v1-study-schedule-8010d.yml` | Scheduler only |
| V1 Study Schedule 8010E Week contract | `.github/workflows/v1-study-schedule-8010e.yml` | Scheduler only |
| V1 Study Schedule containment | `.github/workflows/v1-study-schedule-containment.yml` | Scheduler only |
| Dependabot Updates | Dynamic GitHub workflow | Dependency automation only |

`MISSING`: no I1Q, Question Platform, MR-078A, RANKLISTIQ preview, I1Q staging, I1Q rollback, or I1Q monitoring workflow is active.

## I1Q Deployment Registration Gaps

| Required pin | Current state |
| --- | --- |
| Provider | `MISSING`; do not assume Railway merely because HQ uses it. |
| Service or project ID | `MISSING` |
| Build root | `MISSING`; expected candidate is `i1q-question-platform/`, not repository root. |
| Start command | Local package has `node src/server.mjs`; no provider registration. |
| Source branch and commit policy | `MISSING` |
| Staging hostname | `MISSING` |
| Staging health URL | `MISSING` |
| Production hostname | `MISSING` and not authorized by this ticket |
| WordPress wrapper or direct-host decision | `MISSING` |
| Auth issuer, audience, and callback | `MISSING` |
| Allowed origins | `MISSING`; current HQ runtime reflects hostile origins. |
| RANKLISTIQ preview binding | `MISSING` |
| Unprivileged database role | `MISSING` |
| Secret-store binding | `MISSING`; values were not inspected. |
| Monitoring destination | `MISSING` |
| Rollback artifact selector | `MISSING` |
| Critical Systems Manifest entry | `MISSING` |
| Deployment Manifest entry | `MISSING` |

The I1Q evidence manifest truthfully reports `BLOCKED_NOT_DEPLOYED`, no deployment URLs, no canonical route, and all six flags false.

## Safe Integration Topology

The following is a proposed sequence, not a provider decision:

```text
Reviewed I1Q commit
  -> dedicated GitHub CI for the exact commit and build root
  -> project-pinned RANKLISTIQ preview migration job
  -> real RLS, compensation, and reapply proof
  -> dedicated authenticated I1Q staging service
  -> canonical narrow HQ identity assertion or introspection
  -> I1Q-owned role lookup and unprivileged RANKLISTIQ connection
  -> authenticated staging tests and dependent consumer tests
  -> registered monitoring and rollback
```

`PROPOSED SAFE PATH` rules:

1. Deployment owner selects and records a dedicated provider, service, build root, source branch, environment, hostname, health route, and rollback selector.
2. Do not reuse root `railway.json`, overload HQ, mount I1Q into protected HQ by convenience, or use the HTML CDN as an application server.
3. Register the I1Q route in the Critical Systems Manifest with owner, runtime owner, source of truth, route checks, auth audience, datastore pin, browser journey, monitoring, and rollback.
4. Root chooses either a first-party WordPress wrapper or a separately allowlisted authenticated host. Both require explicit handoff, CORS, cookie, CSRF, and final-target evidence.
5. Register a dedicated GitHub workflow that checks out the exact SHA, validates it, applies only the project-pinned preview migration, deploys the same artifact, and records build and rollback identities.
6. Keep internal platform, internal review, student, STAT, Drills, and publication flags false during infrastructure certification.
7. Only Root may trigger preview migration, deployment, rollback, or reapplication.

## Ownership And Blockers

| Boundary | Current owner | Required action |
| --- | --- | --- |
| I1Q product and release | Brian; Root executes | Approve exact service and route registration. |
| HQ Railway | HQ/Auth owner under Critical Systems | Repair auth defects and provide narrow adapter behavior. |
| WordPress/Kinsta | WordPress/HQ owner | Register final route and handoff behavior if selected. |
| RANKLISTIQ | Datastore owner not named; Root has ticket execution authority | Register preview target, roles, and workflow. |
| I1Q deployment provider | `MISSING OWNER BINDING` | Name provider owner and service binding. |
| R2/CDN consumers | Root plus Arena, STAT, Drills, and Daily owners | Reconcile source drift before any consumer integration. |
| Matrix | Brian and Matrix Runtime Lock | No I1Q route change without separate Matrix authority. |

## Protected No-Touch Boundary

No workflow, provider, deployment, route, manifest, cache, R2/CDN object, Railway service, WordPress file, database, feature flag, or protected runtime was changed or triggered.
