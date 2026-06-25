# MM-CRITICAL-SYSTEMS-GUARD-001 — Claude Cowork Architecture Audit Prompt

PROMPT NAME: MM-CRITICAL-SYSTEMS-GUARD-001-COWORK-HIGH-ARCH-REDTEAM
THREAD NAME: MissionMed — Critical Systems Regression Guard Architecture

---

Load:
- `/Users/brianb/MissionMed/_SYSTEM/PRIMER_CORE.md`
- `/Users/brianb/MissionMed/08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `/Users/brianb/MissionMed/_SYSTEM/DATA_FLOW_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

TASK TYPE: STRATEGY / ARCHITECTURE / RED TEAM
RISK LEVEL: LOW, read-only
AUTHORITY: Advisory architecture audit. Do not edit files. Do not deploy.

---

## Context

MissionMed had a SEV1 production incident on June 24, 2026 where both:

1. USCE admin
2. Arena login

were broken at the same time.

Codex repaired production by restoring the smallest shared surface:

- Railway `missionmed-hq` had an active crashed deploy caused by a missing `scheduler/routes.mjs` import.
- Shared auth/session/bootstrap paths used by Arena and USCE admin were therefore broken.
- After Kinsta restore, USCE admin still depended on newer HQ contract pieces missing from active source:
  - `/api/usce/admin/auth/relay`
  - CDN origin CORS support for `https://cdn.missionmedinstitute.com`
  - WordPress capability handoff propagation
  - `/api/usce/admin/public-intake-requests`
- Codex patched `missionmed-hq/server.mjs`, restored `missionmed-hq/routes/usce-public-intake.mjs`, added `.railwayignore`, and deployed Railway deployment `fd05e343-85d1-4737-9b68-57f3b9d71c5e`.

Production validation after repair:

- Arena route loaded authenticated browser state and showed `WELCOME BACK, PHILPERRI@GMAIL.COM` plus `ENTER ARENA`, with zero console errors.
- USCE admin auth relay loaded CDN admin, showed `LIVE PROTECTED`, secure queue loaded, 6 request rows, with zero console errors.
- HTTP smoke: `/`, `/arena`, `/usce-admin/`, `/usce/` all returned `200`.
- Railway logs showed:
  - `GET /api/auth/session status=200`
  - `GET /api/usce/admin/public-intake-requests status=200`
  - `GET /api/usce/admin/auth/relay status=302`

Brian now wants a permanent guardrail so MissionMed can keep building new systems, upgrading current systems, and expanding Matrix-owned apps without silently breaking live user-facing or admin-facing production.

Codex proposal so far:

- Create a MissionMed Critical Systems Contract + Deploy Gate.
- Include auth/session/bootstrap, Arena, USCE admin, WordPress/Kinsta proxy/auth bridge, Cloudflare R2/CDN live HTML/assets, MissionMed HQ/Railway routes, Supabase projects/RPCs, and all Matrix-owned apps.
- Reuse and extend the existing Matrix runtime lock rather than replacing it.
- Add lightweight primer/guardrail references and machine-checkable manifests/scripts.
- Prevent raw production deploys for protected surfaces by requiring a safe deploy wrapper and smoke checks.

Codex wants Claude Cowork to audit, improve, and red-team this before implementation.

---

## Required MissionMed System Scope

Audit and map the intended design and dependency relationships across:

### Shared Auth / Session / Bootstrap

- WordPress identity provider
- Railway `missionmed-hq` auth/session/exchange/bootstrap
- Supabase session provisioning
- Browser token/session handoff
- CORS and cookie behavior

Critical route examples:

- `/api/auth/session`
- `/api/auth/exchange`
- `/api/auth/bootstrap`
- `/api/usce/admin/auth/relay`

### MissionMed HQ / Railway

- `missionmed-hq/server.mjs`
- protected REST endpoints
- public/intake/admin USCE routes
- service role boundary
- environment variables
- Railway deploy artifact contents
- `.railwayignore` / deploy bundle hygiene

### WordPress / Kinsta

- WordPress as identity provider and wrapper/router
- Kinsta restoration and rollback behavior
- `admin-post.php?action=mmac_hq_auth_redirect`
- WordPress proxy routes and plugin/mu-plugin wiring
- wrapper pages such as `/arena`, `/usce-admin`, `/member-dashboard`

### Cloudflare R2 / CDN

- single-file HTML app source-of-truth and live keys
- R2/CDN-hosted production runtime files
- WordPress wrappers referencing CDN files
- CDN origin CORS requirements
- cache-busted validation and drift detection

Critical asset examples:

- `html-system/LIVE/arena.html`
- `html-system/LIVE/usce_admin.html`
- Matrix plugin assets under `wp-content/plugins/missionmed-hub/assets/`

### Supabase

- RANKLISTIQ project: `fglyvdykwgbuivikqoah`
- GROWTH ENGINE project: `plgndqcplokwiuimwhzh`
- service role vs anon/RLS boundaries
- RPC ownership
- command_center schemas
- public intake RPC/table dependencies
- Arena/STAT player/avatar/drill dependencies

### Arena

- WordPress route `/arena`
- anonymous shell vs authenticated browser state
- HQ auth bootstrap dependency
- Supabase RANKLISTIQ dependency
- CDN/runtime dependencies
- Matrix Arena bridge if relevant

### USCE Admin

- WordPress route `/usce-admin`
- CDN admin runtime
- HQ auth relay dependency
- protected admin list endpoint
- Growth Engine public intake RPC/table dependency
- admin action boundaries

### Matrix-Owned Apps

Include all current Matrix-owned apps and future ones by default.

Current protected Matrix surfaces include:

- Student OS / MissionMed Matrix shell
- My Match Path / Matrix LearnDash shell
- Calendar App Mode
- Scheduler App Mode
- File Vault App Mode
- Messages / communications / read receipts / video-adjacent Matrix UI
- StoryForge Matrix App Mode
- RankListIQ Matrix bridge
- Arena Matrix bridge
- Alumni Network Matrix module if/when promoted from spec/prototype
- Any future `matrix-app-mode-*` or Matrix-owned app route

Use the existing Matrix runtime lock as the authoritative Matrix-specific guardrail:

- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
- `/Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py`

Do not recommend replacing that lock unless you can prove a materially better alternative. Prefer integration.

---

## Codex Preliminary Findings Claude Should Challenge Or Confirm

Codex ran two read-only local reviews before preparing this prompt. Claude should independently verify or challenge these findings:

### Architecture Inventory Findings

- Production Railway currently starts `node missionmed-hq/server.mjs` from `railway.json`; do not assume `app/api/**` Next routes are active production owners unless deployment evidence proves it.
- WordPress proxies `/api/auth/*` to Railway through `wp-content/mu-plugins/missionmed-hq-proxy.php`.
- WordPress/Kinsta auth handoff involves `wp-content/mu-plugins/missionmed-hq-auth-handoff.php` and `admin-post.php?action=mmac_hq_auth_redirect`.
- Arena, STAT, Drills, and Daily use WordPress first-party routes that fetch CDN/R2 HTML.
- Current `_SYSTEM/DEPLOY_MANIFEST.json` only covers `arena/stat/drills/daily` staging HTML, not USCE admin, HQ routes, WordPress mu-plugins, Matrix assets, Supabase dependencies, or production LIVE keys.
- Existing `VALIDATION/validate_deploy.sh` and `VALIDATION/validate_runtime.sh` are useful but heavily marker/hash based. They do not prove authenticated browser journeys by themselves.
- Existing Matrix runtime lock is much stronger than the non-Matrix contract layer and should be reused.
- Potential source-of-truth conflict: `_SYSTEM/DATA_FLOW_CONTRACT.md` says `command_center.*` belongs to Growth Engine `plgndqcplokwiuimwhzh`, but current USCE public intake code paths appear pinned to RANKLISTIQ `fglyvdykwgbuivikqoah`. This must be resolved explicitly per table/RPC before new automation assumes either project.

### Red-Team Findings

Claude should design controls for these failure modes:

1. A guard validates inactive source while production uses a different runtime.
   - Example: editing `app/api/**` does not necessarily repair Railway `missionmed-hq/server.mjs`.
2. A route appears to exist but returns fake coverage such as `501 not wired`.
   - Manifest must assert expected status/body, not just path presence.
3. Marker checks pass while real login/admin runtime fails.
   - Need authenticated browser smoke for Arena, USCE admin, and Matrix.
4. CDN/R2/local source hashes drift while pages still superficially load.
   - Hash mismatch should be a stop-the-line event unless explicitly approved.
5. Matrix asset hashes pass but route behavior regresses.
   - Need browser route checks for `#dashboard`, `#calendar`, `#scheduler`, `#filevault`, `#messages`, `#storyforge`.
6. Auth proxy/cache behavior accidentally exposes private auth config in a public cached Arena shell.
   - Need logged-out and logged-in header/body tests.
7. Existing deploy wrappers or scripts include bypass flags such as skip git/cache checks.
   - Bypass should require explicit emergency ticket and Brian approval.
8. Broad Cloudflare/Kinsta/cache/auth rewrites can fix one symptom while breaking WooCommerce, LearnDash, `/my-account`, `/wp-admin`, Matrix, Arena, or USCE.
   - Require exact affected route list, rollback path, and browser proof.

Claude should explicitly state whether it agrees with these findings and where it disagrees.

---

## Questions Claude Must Answer

1. What are the true shared dependencies across Arena, USCE admin, Matrix, WordPress, HQ/Railway, Cloudflare/R2/CDN, and Supabase?

2. Which systems are independent enough to deploy separately, and which are only apparently independent but actually share auth/session/proxy/CDN/Supabase contracts?

3. What contracts should become protected and machine-checkable?

4. What should the global Critical Systems Contract manifest contain?

5. What should remain in the Matrix runtime lock manifest vs move into the global Critical Systems manifest?

6. What deploy paths must be banned or wrapped?

7. What pre-deploy checks would have caught the June 24 SEV1 before production?

8. What post-deploy checks prove the site is demo-safe for:
   - Arena login
   - USCE admin load
   - USCE authenticated admin read
   - Matrix shell and app routes
   - WordPress wrapper pages
   - CDN/R2 assets
   - Supabase route/RPC dependencies

9. What new-system onboarding rule ensures future Matrix-owned apps and future non-Matrix apps register their dependencies before launch?

10. Where is the proposed guardrail likely to become brittle, too broad, too slow, or easy for humans/AI to bypass?

11. What should Codex implement first, second, and third to maximize risk reduction with minimum disruption?

---

## Required Output

Please return a structured architecture audit with these sections:

### 1. Executive Recommendation

State the recommended guardrail architecture in 10 bullets or fewer.

### 2. System Dependency Map

Create a table:

| System | Owner | Source of Truth | Runtime Host | Shared Dependencies | Independent Boundaries | Critical Routes/Assets | Rollback Path |

### 3. Protected Contract Classes

Define contract classes, for example:

- auth/session
- route availability
- redirect/handoff
- CORS/header
- CDN/R2 asset
- WordPress wrapper/proxy
- Supabase project/RPC/table
- Matrix app-mode asset/runtime
- deploy artifact/bundle
- browser smoke/user journey

For each class, specify required manifest fields and smoke checks.

### 4. Global Manifest Schema Proposal

Propose a machine-readable JSON schema or example object for the global manifest.

It must support:

- current and future Matrix-owned apps
- non-Matrix apps
- routes
- assets
- env vars/secrets references without exposing secret values
- Supabase projects/RPCs/tables
- WordPress pages/proxy actions
- Cloudflare/R2/CDN keys
- Railway services/deploys
- expected unauthenticated status codes
- expected authenticated browser outcomes
- CORS/header expectations
- rollback instructions
- ownership/approval requirements

### 5. Deploy Gate Design

Design the deploy gate:

- local preflight
- production smoke
- browser smoke
- log checks
- route-contract diff check
- manifest update enforcement
- Matrix runtime guard integration
- safe Railway deploy wrapper
- safe R2/CDN deploy wrapper
- safe Kinsta/WordPress deploy wrapper
- stop-the-line rules

### 6. Red Team Findings

Rank top failure modes that could still break production even with the guard.

For each:

| Risk | Severity | How It Slips Through | Control |

### 7. Source-of-Truth Conflict Policy

Define exactly what to do when:

- local source differs from live CDN/R2
- WordPress restored version differs from HQ deploy
- Matrix lock differs from public assets
- Supabase RPC/table dependency exists live but not in local migrations/source
- production hotfix exists but source is stale

### 8. Documentation Update Plan

Tell Codex exactly which files to update and how much text to add:

- `_SYSTEM/PRIMER_CORE.md`
- `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `_SYSTEM/PROMPT_TEMPLATES/DEPLOY.md`
- `_SYSTEM/PROMPT_TEMPLATES/FIX.md`
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
- `_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`
- any new `_SYSTEM/*.md` or manifest files

Keep primer changes short. Put operational detail in dedicated contract docs/manifests/scripts.

### 9. Implementation Sequence

Give an implementation sequence:

- Phase 0: read-only inventory
- Phase 1: manifest/docs only
- Phase 2: smoke scripts
- Phase 3: safe deploy wrappers
- Phase 4: CI/monitoring
- Phase 5: future app onboarding automation

For each phase, define acceptance criteria and rollback.

### 10. Instructions To Codex

Give concrete instructions to Codex for what to implement next.

Important: Codex is allowed to push back, adjust, or reject any recommendation if it can justify a safer, smaller, or more maintainable approach. If Codex disagrees, it will write a counter-proposal and send it back to Claude Cowork for debate.

---

## Hard Constraints

- Do not recommend rewriting USCE admin.
- Do not recommend rewriting Arena.
- Do not recommend replacing Matrix runtime lock wholesale.
- Do not touch payment flows.
- Do not touch Supabase production data.
- Do not expose secret values.
- Preserve production behavior everywhere else.
- Prefer additive guardrails and manifests over broad refactors.
- Prefer small deploy wrappers and contract checks over huge framework work.
- Any destructive action requires explicit Brian approval.

---

## Desired Final Position

MissionMed should be able to keep building:

- new Matrix-owned apps
- new admin tools
- new CDN/R2 runtimes
- new HQ endpoints
- new Supabase-backed features
- new WordPress wrappers

without putting live user/admin-facing production at risk from:

- stale worktrees
- missing imports
- route removals
- CORS regressions
- auth/session contract drift
- CDN/R2 wrong-key uploads
- Kinsta restores rolling back only one layer
- Supabase project confusion
- Matrix asset downgrades
- raw deploys that skip smoke validation

End with:

1. `CLAUDE VERDICT:`
2. `TOP 5 CODEX ACTIONS:`
3. `QUESTIONS FOR BRIAN:`
4. `WHERE CLAUDE EXPECTS CODEX MIGHT DISAGREE:`
