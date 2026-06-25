# MM-CRITICAL-SYSTEMS-GUARD-001 — Claude Cowork Architecture Audit

**Prompt:** MM-CRITICAL-SYSTEMS-GUARD-001-COWORK-HIGH-ARCH-REDTEAM
**Reviewer:** Claude Cowork
**Date:** 2026-06-25
**Task type:** STRATEGY / ARCHITECTURE / RED TEAM · **Risk:** LOW (read-only) · **Authority:** Advisory only — no files edited, nothing deployed
**Scope of evidence:** Read the 7 referenced docs + `railway.json`, `.railwayignore`, `_SYSTEM/DEPLOY_MANIFEST.json`, `VALIDATION/validate_deploy.sh`, `VALIDATION/validate_runtime.sh`, `_SYSTEM/tools/matrix_runtime_guard.py`, `missionmed-hq/server.mjs`, `missionmed-hq/routes/usce-public-intake.mjs`, `wp-content/mu-plugins/*`, `app/api/**`, repo git state, and **read-only Supabase introspection** of both production projects.

> **Verification note:** Findings below are grounded in the actual repo and live schema, not in Codex's self-report. Where I confirm Codex, I say so; where reality differs, I correct it. Three findings are new (not in Codex's list) and one of them is the highest-priority item in this document.

---

## 1. Executive Recommendation

1. **The repo is the real risk, not the architecture.** Production was repaired by editing the working tree directly. Right now `missionmed-hq/routes/usce-public-intake.mjs` (the restored USCE route) and `_SYSTEM/KNOWN_GOOD/` (the Matrix lock) are **untracked in git**, and `missionmed-hq/server.mjs` is **modified-uncommitted**, on branch `audit/supabase-2026-grants-…`. A routine `git checkout`, `git clean -fd`, branch switch, or dual-Mac sync would silently re-break USCE and delete the Matrix lock. **Commit/tag a known-good baseline before building any guardrail.** (Phase 0, item 1.)
2. **Adopt a single machine-checkable `CRITICAL_SYSTEMS_MANIFEST.json`** that declares, per protected surface: runtime owner, source-of-truth path, expected unauthenticated status/body, expected authenticated browser outcome, Supabase project+schema+RPC pins, CORS expectations, and rollback path. Extend the Matrix manifest pattern; do not replace it.
3. **Keep the Matrix runtime lock as-is and make it a delegated module** of the global gate. It is the strongest control you have. The global manifest references Matrix asset keys but the `matrix_runtime_guard.py` stays authoritative for them.
4. **The deploy gate's job is to assert "which runtime is live" and "did the live runtime actually serve a correct authenticated journey."** Your current validators check neither — they string-match inactive local files.
5. **Ban raw deploys of protected surfaces.** Wrap Railway, R2/CDN, and Kinsta/WordPress deploys in thin scripts that take backup → deploy → verify origin → verify authenticated browser smoke → write report. Bypass requires an emergency ticket + Brian approval phrase.
6. **Pre-deploy preflight must diff the deploy artifact against the runtime owner.** The June 24 SEV1 (missing `scheduler/routes.mjs` import crashing `server.mjs`) is caught by a 2-second `node --check` + import-resolution check on the *actual* start command, which no current script runs.
7. **Resolve the Supabase split-brain in the manifest, per table/RPC.** Both projects have a `command_center` schema holding **different** tables. The live code is correct; `DATA_FLOW_CONTRACT.md` §0 is stale. Pin USCE → RANKLISTIQ and CRM → GROWTH ENGINE explicitly and machine-check it.
8. **Treat "marker pass" and "hash pass" as necessary-but-insufficient.** Add a small authenticated browser smoke (Arena login, USCE admin read, Matrix app-mode routes) as the only gate that proves demo-safety.
9. **Register-before-launch rule for every new app** (Matrix or not): no new route/asset/RPC goes live until it has a manifest entry with its dependencies and expected outcomes. This is how you keep building without re-introducing silent breakage.
10. **Sequence for risk reduction:** Phase 0 (commit baseline + freeze) → Phase 1 (manifest + docs) → Phase 2 (smoke scripts) → Phase 3 (deploy wrappers) → Phase 4 (CI/monitor) → Phase 5 (onboarding automation). Stop after each phase; each is independently valuable.

---

## 2. System Dependency Map

| System | Owner | Source of Truth | Runtime Host | Shared Dependencies | Independent Boundaries | Critical Routes / Assets | Rollback Path |
|---|---|---|---|---|---|---|---|
| **Shared Auth / Session / Bootstrap** | HQ (Railway) + WordPress proxy | `missionmed-hq/server.mjs` (**active**); `app/api/auth/*` is **inactive** | Railway `missionmed-hq` (`node missionmed-hq/server.mjs`) | WordPress proxy mu-plugin; Supabase auth.users (both projects); `MMHQ_SESSION_SECRET` | None — every user-facing system depends on this | `/api/auth/exchange`, `/api/auth/bootstrap`, `/api/auth/session`, `/api/usce/admin/auth/relay` | Redeploy last-good Railway deploy id; restore server.mjs from tagged baseline |
| **MissionMed HQ (Railway)** | HQ | `missionmed-hq/server.mjs` (425 KB monolith) + `routes/usce-public-intake.mjs` (61 KB, **untracked**) | Railway | Supabase (both projects) via service role; CORS allow-list; CDN origin | Deployable on its own — but it *is* the shared auth host, so "independent" is misleading | start cmd in `railway.json`; protected REST + USCE routes | Railway deploy rollback to `fd05e343-…` (last known good); re-commit untracked routes |
| **WordPress / Kinsta** | WordPress | mu-plugins in `wp-content/mu-plugins/` + Kinsta filesystem | Kinsta (managed WP) | Proxies `/api/auth/*` → Railway; hosts wrapper pages; identity provider | WooCommerce/LearnDash/`/my-account`/`/wp-admin` are independent **but share the same PHP runtime & mu-plugin load order** | `missionmed-hq-proxy.php`, `missionmed-hq-auth-handoff.php` (`action=mmac_hq_auth_redirect`), wrapper pages `/arena`, `/usce-admin`, `/member-dashboard` | Kinsta restore point; per-file mu-plugin restore from `private/` backups |
| **Cloudflare R2 / CDN** | HTML-system | Local single-file HTML (`arena_v1.html`, `stat_latest.html`, `drills_v1.html`, `ranklistiq.html`, `usce_admin.html`) | R2 origin → `cdn.missionmedinstitute.com` | WordPress wrappers reference CDN URLs; CDN origin CORS must allow `cdn.` origin | Static assets deploy independently of Railway/WordPress | `html-system/LIVE/arena.html`, `…/usce_admin.html`, Matrix assets under `…/missionmed-hub/assets/` | Re-upload timestamped backup to same key + purge edge cache |
| **Arena** | Arena | `arena_v1.html` (local) → R2/CDN | WordPress route `/arena` → fetches CDN HTML | HQ auth bootstrap; Supabase **RANKLISTIQ**; CDN runtime; arena mu-plugins (proxy, anon-shell, cache-bypass, identity-guard) | UI/runtime independent once authed shell loads | `/arena`, `arena.html`, `/api/auth/*` | Restore `arena_v1_BACKUP_*.html` to CDN; revert arena mu-plugins |
| **USCE Admin** | USCE | `usce_admin.html` (CDN) + `routes/usce-public-intake.mjs` (HQ) | CDN admin runtime + Railway relay | HQ `/api/usce/admin/auth/relay`; protected list endpoint; **RANKLISTIQ** `command_center.usce_*`; WP capability handoff | Admin UI independent of Arena, but shares auth host + Supabase project | `/usce-admin`, `/api/usce/admin/auth/relay` (302), `/api/usce/admin/public-intake-requests` (200) | Restore CDN admin HTML; Railway rollback; route file re-commit |
| **Matrix shell + apps** | Matrix (locked) | **Canonical worktrees + production hashes** (NOT main repo — local `missionmed-hub/` has only `backups/`) | Kinsta plugin `missionmed-hub` | HQ auth/session; Runtime v2 loader; LearnDash member-dashboard; (Scheduler → Scheduler Staging Supabase) | App-mode routes are route-isolated by design | `student-os.js/.css`, `…-calendar-v4.*`, `scheduler-mount.js`, `…-file-vault.*`, `…-storyforge.*`; routes `#calendar/#scheduler/#filevault/#messages/#storyforge` | `matrix_runtime_guard.py` Kinsta backup → restore; manifest hash revert |
| **Supabase RANKLISTIQ** `fglyvdykwgbuivikqoah` | Data | Migrations applied via separate path; **not** local `/supabase/migrations` | Supabase (us-east-2) | Arena/STAT player data **+ USCE `command_center.usce_*`** (intake 70 rows, offer_drafts 48, audit 369) | Project-scoped | `create/list_usce_public_intake_request*` RPCs; duel RPCs | Supabase PITR / migration revert (Brian-gated) |
| **Supabase GROWTH ENGINE** `plgndqcplokwiuimwhzh` | Data | Local `/supabase/migrations` target | Supabase (us-east-2) | HQ CRM (`command_center.students` 73, `payments`, `leads`, `email_drafts`, `events` 82) | Project-scoped | `mmac_cc_*` RPCs | Supabase PITR / migration revert (Brian-gated) |
| **Supabase Scheduler Staging** `avpdetdkpwmqqxtvomix` | Data (**undocumented**) | Unknown — not in any contract doc | Supabase (us-east-2) | Scheduler app mode (likely) | Project-scoped | TBD — must be inventoried | TBD |

---

## 3. Protected Contract Classes

For each class: **required manifest fields** and **smoke checks**. These are the building blocks of the manifest in §4.

**C1 — auth/session.** Fields: `runtime_owner`, `endpoints[]`, `proxy_path`, `session_secret_env` (name only), `cookie_flags`, `token_ttl`. Smoke: `GET /api/auth/session` → 200; logged-out `/arena` shows anonymous shell; logged-in shows authenticated state; secret env var **present and non-empty** (fail-closed).

**C2 — route availability.** Fields: `path`, `method`, `expected_unauth_status`, `expected_body_contains`, `must_not_return` (e.g. `501 not wired`). Smoke: real HTTP call asserts status **and** body marker, not just non-404.

**C3 — redirect/handoff.** Fields: `path`, `expected_status` (302), `expected_location_prefix`, `wp_action` (`mmac_hq_auth_redirect`), `capability_required`. Smoke: relay returns 302 to expected origin; capability handoff propagates.

**C4 — CORS/header.** Fields: `allowed_origins[]`, `methods[]`, `credentials`, `vary`. Smoke: preflight from `cdn.missionmedinstitute.com` returns the allow-origin header; disallowed origin is rejected; **no private auth header leaks into a cacheable anonymous response.**

**C5 — CDN/R2 asset.** Fields: `r2_key`, `public_url`, `local_source_path`, `approved_sha256`, `cache_busting`. Smoke: origin SHA256 == local; public cache-busted SHA256 == local; `</html>` closes; version header matches.

**C6 — WordPress wrapper/proxy.** Fields: `mu_plugin_file`, `hooks[]`, `wrapper_pages[]`, `proxy_target`. Smoke: wrapper page 200 + references correct CDN URL; proxy forwards only intended paths; **no stray auto-loaded `.php` in mu-plugins root.**

**C7 — Supabase project/RPC/table.** Fields: `project_ref`, `schema`, `table`, `rpc[]`, `access_role` (service vs anon), `rls_expected`, `exposed_via_data_api` (bool). Smoke: code's `project_ref` == manifest pin; RPC exists; RLS state matches expectation; `command_center` **not** exposed to anon Data API.

**C8 — Matrix app-mode asset/runtime.** Fields: delegated to `MATRIX_RUNTIME_LOCK_MANIFEST.json` (asset keys + `route_locks`). Smoke: `matrix_runtime_guard.py preflight` hash chain **+ new** browser route check for `body.matrix-app-mode-*` and Return control.

**C9 — deploy artifact/bundle.** Fields: `runtime_start_command`, `ignore_file`, `required_imports_resolve`, `bundle_excludes[]`. Smoke: `node --check` on start file; every `import` resolves; `.railwayignore` excludes secrets/media; no missing module.

**C10 — browser smoke / user journey.** Fields: `journey_id`, `steps[]`, `expected_console_errors: 0`, `expected_final_text`. Smoke: headless authenticated run (e.g. Arena → `WELCOME BACK …` / `ENTER ARENA`; USCE admin → `LIVE PROTECTED` + queue rows).

---

## 4. Global Manifest Schema Proposal

A single `CRITICAL_SYSTEMS_MANIFEST.json` (sibling to the Matrix manifest). It **references** the Matrix manifest rather than duplicating it. Secrets are referenced by env-var **name only**.

```jsonc
{
  "schema_version": "1.0",
  "status": "ACTIVE",
  "lock_name": "MissionMed Critical Systems Contract",
  "owner": "Brian",
  "last_updated_utc": "2026-06-25T00:00:00Z",
  "delegated_locks": {
    "matrix_runtime": "_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json"
  },
  "runtime_owners": {
    "railway_missionmed_hq": {
      "start_command": "node missionmed-hq/server.mjs",
      "active_source_roots": ["missionmed-hq/"],
      "inactive_lookalikes": ["app/api/**"],          // present but NOT served — edits here do NOT reach prod
      "ignore_file": ".railwayignore",
      "last_known_good_deploy": "fd05e343-85d1-4737-9b68-57f3b9d71c5e"
    }
  },
  "secrets": {                                          // names only, never values
    "MMHQ_SESSION_SECRET": { "required": true, "host": "railway", "fail_if_missing": true }
  },
  "systems": {
    "usce_admin": {
      "owner": "USCE",
      "classes": ["auth/session", "route", "redirect/handoff", "cors", "cdn-asset", "wp-wrapper", "supabase", "browser-journey"],
      "runtime_owner": "railway_missionmed_hq",
      "source_of_truth": {
        "cdn_asset": { "local": "html-system/LIVE/usce_admin.html",
                       "r2_key": "html-system/LIVE/usce_admin.html",
                       "public_url": "https://cdn.missionmedinstitute.com/html-system/LIVE/usce_admin.html",
                       "approved_sha256": "<fill>" },
        "route_file": "missionmed-hq/routes/usce-public-intake.mjs"
      },
      "routes": [
        { "path": "/api/usce/admin/auth/relay", "expected_unauth_status": 302,
          "expected_location_prefix": "https://cdn.missionmedinstitute.com" },
        { "path": "/api/usce/admin/public-intake-requests", "expected_auth_status": 200,
          "expected_body_contains": "requests", "must_not_return": [501, 404] }
      ],
      "cors": { "allowed_origins": ["https://missionmedinstitute.com",
                                    "https://www.missionmedinstitute.com",
                                    "https://cdn.missionmedinstitute.com"],
                "credentials": true },
      "supabase": {
        "project_ref": "fglyvdykwgbuivikqoah",          // RANKLISTIQ — verified live
        "schema": "command_center",
        "tables": ["usce_public_intake_requests", "usce_offer_drafts", "usce_audit"],
        "rpc": ["create_usce_public_intake_request", "list_usce_public_intake_requests",
                "update_usce_public_intake_request_status"],
        "access_role": "service_role",
        "exposed_via_data_api": false                    // MUST stay false; checked
      },
      "wordpress": { "wrapper_pages": ["/usce-admin"],
                     "proxy_actions": ["mmac_hq_auth_redirect"] },
      "browser_journey": {
        "journey_id": "usce_admin_authed_read",
        "expected_final_text": "LIVE PROTECTED",
        "expected_console_errors": 0,
        "expected_min_rows": 1
      },
      "rollback": "Restore usce_admin.html backup to R2 + purge; Railway rollback to last_known_good_deploy; re-commit routes/usce-public-intake.mjs",
      "approval": { "owner": "Brian", "change_requires_phrase": "Brian approves USCE critical-systems change for <ticket>" }
    },

    "arena": {
      "owner": "Arena",
      "runtime_owner": "railway_missionmed_hq",
      "source_of_truth": { "cdn_asset": { "local": "arena_v1.html", "approved_sha256": "<fill>" } },
      "supabase": { "project_ref": "fglyvdykwgbuivikqoah", "access_role": "anon+auth",
                    "forbidden_project_refs": ["plgndqcplokwiuimwhzh"] },
      "browser_journey": { "journey_id": "arena_login",
                           "expected_final_text": "ENTER ARENA", "expected_console_errors": 0 },
      "rollback": "Restore arena_v1_BACKUP_*.html to CDN + purge"
    },

    "matrix_shell": {
      "owner": "Matrix",
      "delegated_to": "matrix_runtime",                  // hashes owned by Matrix lock
      "source_of_truth_note": "Canonical worktrees + production hashes; main repo missionmed-hub/ holds only backups/",
      "browser_journey": {
        "routes": ["#dashboard", "#calendar", "#scheduler", "#filevault", "#messages", "#storyforge"],
        "assert_body_class_per_route": true,
        "assert_return_control": true,
        "dashboard_must_not_hydrate": ["calendar", "scheduler", "filevault"]
      }
    },

    "crm_growth_engine": {
      "owner": "HQ",
      "supabase": { "project_ref": "plgndqcplokwiuimwhzh", "schema": "command_center",
                    "tables": ["students", "leads", "payments", "email_drafts", "events"],
                    "access_role": "service_role", "exposed_via_data_api": false,
                    "rls_expected": "review" }                 // see §6 R3 security note
    }
  },

  "new_system_registration": {
    "rule": "No route/asset/RPC is demo-safe or deployable until it has a manifest entry with runtime_owner, source_of_truth, expected unauth status, expected authed journey, and supabase pin.",
    "required_fields": ["owner", "runtime_owner", "source_of_truth", "routes|cdn_asset",
                        "supabase?", "browser_journey", "rollback", "approval"]
  }
}
```

**What stays in the Matrix lock vs. moves to global:**

| Stays in `MATRIX_RUNTIME_LOCK_MANIFEST.json` | Moves to / lives in `CRITICAL_SYSTEMS_MANIFEST.json` |
|---|---|
| Matrix asset keys + `approved_sha256` + `approved_version` | Pointer to the Matrix manifest (`delegated_locks`) |
| `route_locks` body-class canon, `global_runtime_invariants` | Matrix **browser-journey** assertions (new), shared with global smoke runner |
| Kinsta plugin root, baseline backup path, override phrase | Auth/session, CORS, Supabase pins, Railway runtime owner, CDN keys for **non-Matrix** assets |
| `matrix_runtime_guard.py` ownership of hashes | New-system registration rule; cross-system deploy gate orchestration |

---

## 5. Deploy Gate Design

A thin orchestrator (`_SYSTEM/tools/critical_systems_gate.py`) that **calls** existing tools and fails closed. Stages:

1. **Local preflight (no network).**
   - `git` clean-state check on protected paths — **refuse to deploy from a tree with untracked/uncommitted protected files** (this alone would have flagged today's repo state).
   - Artifact integrity: `node --check missionmed-hq/server.mjs`; resolve every `import` against the deploy bundle (catches the June 24 missing `scheduler/routes.mjs`).
   - `.railwayignore` excludes `*.env`, `*.key`, media.
   - Manifest diff: changed routes/assets must have matching manifest entries (route-contract diff check).
2. **Safe deploy wrappers (per host).**
   - **Railway:** `railway up` only via wrapper that records prior deploy id, deploys, then runs stages 3–5; on fail, prints the rollback deploy id. No raw `railway up` for protected services.
   - **R2/CDN:** wrapper = backup current key → upload → verify origin SHA256 == local → purge → verify public cache-busted SHA256 == local. (Generalize `mirror_live_assets.sh` / PRIMER_EXT_HTML_DEPLOY Step 7.)
   - **Kinsta/WordPress + Matrix:** delegate to `matrix_runtime_guard.py guarded-deploy` for Matrix assets; for mu-plugins, wrapper takes per-file backup into `private/` and forbids deploying when stray `*_BACKUP_*.php` exist in the mu-plugins root.
3. **Production smoke (unauthenticated).** HTTP assert the manifest's `expected_unauth_status` + body markers for `/`, `/arena`, `/usce-admin/`, `/usce/`, `/api/auth/session`, relay 302. Status-only is not enough — assert body marker and `must_not_return`.
4. **Browser smoke (authenticated).** Headless journeys from the manifest: Arena login (`ENTER ARENA`, 0 console errors), USCE admin (`LIVE PROTECTED` + ≥1 row), Matrix routes (`body.matrix-app-mode-*` + Return control). This is the only stage that proves demo-safety.
5. **Log checks.** Tail Railway logs for the expected lines (`GET /api/auth/session 200`, `…/public-intake-requests 200`, `…/auth/relay 302`) and assert **zero** crash/restart events in the window.
6. **Matrix runtime guard integration.** If the change touches Matrix asset keys, stage 2 is *replaced* by `guarded-deploy`; stage 4 adds the route checks. The global gate never re-implements Matrix hashing.
7. **Stop-the-line rules (any → abort + report, no partial state advance):** dirty protected git tree; `node --check`/import failure; origin-vs-local hash mismatch; route returns `501/404` where manifest expects 200/302; authenticated journey console error or wrong final text; missing `MMHQ_SESSION_SECRET`; `command_center` reachable via anon Data API; stray auto-loaded mu-plugin backup; Supabase `project_ref` ≠ manifest pin.
8. **Bypass.** A single `--emergency <ticket>` flag, allowed only with Brian's approval phrase, which still runs stages 1+3 and writes a loud incident report. No flag may skip git-state + smoke together.

---

## 6. Red Team Findings

Ranked by residual risk **after** the proposed guard is in place (i.e., where the guard itself can still fail), interleaving Codex's 8 traps (confirmed) with 3 new findings (R-A/R-B/R-C).

| # | Risk | Severity | How it slips through | Control |
|---|---|---|---|---|
| **R-A (new)** | **Untracked production source.** Restored USCE route + Matrix lock are untracked; `server.mjs` modified-uncommitted on an `audit/*` branch | **CRITICAL** | `git clean`/`checkout`/branch-switch/dual-Mac sync deletes untracked files → instant USCE + Matrix regression; guard built on top inherits a vanishing baseline | Phase 0: commit + tag `known-good/2026-06-25`; gate refuses deploy from dirty protected tree; CI asserts protected paths are tracked |
| 1 (Codex) | Guard validates inactive source while prod uses another runtime | **CRITICAL** | `app/api/auth/*` (429+401 lines) and `app/api/usce/**` look authoritative but Railway runs `server.mjs` | Manifest `runtime_owner` + `inactive_lookalikes`; gate edits/validates only the active root; flag edits to lookalikes |
| **R-B (new)** | **Supabase `command_center` split-brain across two projects** | **HIGH** | Both projects have a `command_center` schema; doc says GROWTH ENGINE, USCE lives in RANKLISTIQ. "Fixing" code to match the doc repoints to an empty schema → orphans 70 live intake rows | Per-table/RPC `project_ref` pin (C7); gate asserts code ref == manifest; correct the stale doc (§7) |
| **R-C (new)** | **Ephemeral session secret + RLS-off CRM** | **HIGH** | `server.mjs` falls back to a random `SESSION_SECRET` if `MMHQ_SESSION_SECRET` unset → all sessions invalidated on deploy/replica; all 9 GROWTH ENGINE CRM tables + 5 RANKLISTIQ queue tables have **RLS disabled** | Gate fails if secret env missing; manifest `exposed_via_data_api:false` checked for `command_center`; surface RLS to Brian (advisory, do not auto-fix) |
| 2 (Codex) | Route returns fake coverage (`501 not wired`) | HIGH | Path exists, returns stub | Manifest asserts status **and** body + `must_not_return` |
| 3 (Codex) | Markers pass, real login/admin runtime fails | HIGH | Static `rg` checks pass on local files that never executed | Authenticated browser smoke (C10) is the gating stage |
| 4 (Codex) | CDN/R2/local hash drift, page still loads | HIGH | Superficial 200 hides stale/wrong asset | Origin + public cache-busted SHA256 == local; mismatch = stop-the-line |
| 5 (Codex) | Matrix hashes pass but route behavior regresses | HIGH | Guard checks hashes, not live DOM/body classes | Add browser route checks for `#calendar/#scheduler/#filevault/#messages/#storyforge` |
| 8 (Codex) | Broad Cloudflare/Kinsta/cache/auth rewrite breaks Woo/LearnDash/`/wp-admin` | HIGH | Shared WP/PHP runtime + mu-plugin load order; one change, wide blast radius | Require exact affected-route list + rollback + browser proof for WP/cache/auth changes; smoke includes `/my-account`, `/wp-admin`, checkout |
| 6 (Codex) | Auth config leaks into cached anonymous Arena shell | MEDIUM-HIGH | Cache-bypass mu-plugins + anon shell; a cached private header exposes config | Logged-out vs logged-in header/body diff test (C4); assert no auth header in cacheable response |
| 7 (Codex) | Deploy scripts contain skip/bypass flags | MEDIUM | Convenience flags skip git/cache/smoke | Single audited `--emergency` path; never skip git-state + smoke together; loud report |
| R-D (new, minor) | **Stray `*_BACKUP_*.php` in mu-plugins root are auto-loaded** | MEDIUM | WP loads every `.php` in `mu-plugins/`; backups register `add_action`/`function` → duplicate hooks or redeclare risk | Gate fails if non-canonical `.php` present in mu-plugins root; move backups out of auto-load path |

---

## 7. Source-of-Truth Conflict Policy

**Governing principle: production reality wins; the document is corrected to match, never the reverse — unless reality is itself the bug, in which case it is a Brian-approved fix, not a silent edit.**

| Conflict | Verified reality (this audit) | Policy / action |
|---|---|---|
| **Local source differs from live CDN/R2** | Per PRIMER_EXT_HTML_DEPLOY: R2/CDN is runtime truth; local is working copy | Hash both. If different → **stop-the-line**. CDN wins for "what's live"; reconcile by re-deriving local from the approved hash or re-deploying the intended local with the gate. Never assume local == live. |
| **WordPress restored version differs from HQ deploy** | Kinsta restore can roll back **one layer** (the June 24 pattern) | After any Kinsta restore, re-run the full gate across **all** systems, not just the restored one. Manifest's per-system `last_known_good` is the reconciliation target. |
| **Matrix lock differs from public assets** | Matrix guard already enforces local↔origin↔public hash equality | Keep `matrix_runtime_guard.py` authoritative. Mismatch = STALE_WARNING = stop until Brian approves the exact override. |
| **Supabase RPC/table exists live but not in local migrations** | Confirmed: USCE `command_center.usce_*` lives in **RANKLISTIQ**, applied via "separate deployment path"; local `/supabase/migrations` targets GROWTH ENGINE | Manifest pins truth per object. Add a read-only drift check (`list_tables`/`list_migrations`) comparing live schema to manifest. Do **not** "repair" by repointing code. `DATA_FLOW_CONTRACT.md` §0 must be corrected: `command_center.*` is **project-specific** — CRM→GROWTH ENGINE, USCE→RANKLISTIQ. |
| **Production hotfix exists but source is stale** | Confirmed today: `server.mjs` modified-uncommitted; `routes/` + `KNOWN_GOOD/` untracked | The hotfixed working tree **is** current truth and is unprotected. Phase 0 commits it to a tagged baseline immediately; until then, freeze destructive git ops. This is the policy's most urgent application. |

**Tie-break order when all else is ambiguous:** (1) live production runtime behavior → (2) the approved manifest hash/pin → (3) the committed source → (4) the prose contract doc. Today, prose (#4) is wrong and runtime (#1) is right; the policy correctly favors runtime.

---

## 8. Documentation Update Plan

Keep primers short; put operational detail in dedicated contracts/manifests/scripts.

| File | Change | Size |
|---|---|---|
| `_SYSTEM/PRIMER_CORE.md` | Add one row to §10 Extension Loader: load `CRITICAL_SYSTEMS_CONTRACT.md` when task touches auth/session, Arena, USCE, HQ/Railway, CDN/R2, WordPress proxy/wrappers, or Supabase project routing | ~3 lines |
| `_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md` *(new)* | The prose contract: contract classes (§3), runtime-owner table, source-of-truth policy (§7), deploy-gate stages (§5), stop-the-line rules | ~2 pages |
| `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` *(new)* | Machine-checkable manifest (§4) | per §4 |
| `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` | Add G-18 (deploy only via gate for protected surfaces; no raw `railway up`/`scp`/CDN upload) and G-19 (never edit `app/api/**` to fix production — it is inactive); add `CRITICAL_SYSTEMS_CONTRACT.md` to the copy-paste preamble | ~8 lines |
| `_SYSTEM/PROMPT_TEMPLATES/DEPLOY.md` | Require manifest entry + gate run + browser-smoke proof before COMPLETE | ~6 lines |
| `_SYSTEM/PROMPT_TEMPLATES/FIX.md` | Require stating the **runtime owner** of the file being fixed before editing (kills the `app/api/**` trap) | ~4 lines |
| `_SYSTEM/DATA_FLOW_CONTRACT.md` | **Correction (needs MR-ticket per its lock):** §0/§1.1 — `command_center.*` is project-specific: CRM (`students/leads/payments/email_drafts/events`)→GROWTH ENGINE; USCE (`usce_*`)→RANKLISTIQ. Add the third project `avpdetdkpwmqqxtvomix` (Scheduler Staging). | ~10 lines |
| `_SYSTEM/DEPLOY_MANIFEST.json` | Note it covers only arena/stat/drills/daily **staging**; point to the new global manifest as the authority for everything else | ~3 lines |
| `MATRIX_RUNTIME_LOCK_PROTOCOL.md` / `…_MANIFEST.json` | No content change to locks. Add one note: this lock is now a `delegated_lock` of the global contract; add browser route-check expectation reference | ~4 lines |
| `_SYSTEM_LOGS/LEARNINGS_LOG.jsonl` | Append entries: (a) untracked-prod-source near-miss, (b) `command_center` split-brain resolution, (c) ephemeral session-secret risk, (d) `app/api/**` inactive-lookalike trap | 4 entries |

---

## 9. Implementation Sequence

Each phase is independently shippable, has acceptance criteria, and a rollback. **Stop and review after each.**

**Phase 0 — Freeze & baseline (read/commit only).**
Commit `missionmed-hq/routes/`, `_SYSTEM/KNOWN_GOOD/`, `_SYSTEM/tools/`, and the modified `server.mjs`/guardrails to a tagged branch `known-good/2026-06-25`; confirm Railway is serving that exact tree.
*Accept:* `git status` clean on protected paths; tag pushed to both Macs. *Rollback:* none needed (additive); if a commit is wrong, `git revert`.

**Phase 1 — Manifest + docs (no executable enforcement).**
Author `CRITICAL_SYSTEMS_MANIFEST.json` + `CRITICAL_SYSTEMS_CONTRACT.md`; fill real SHA256s; correct `DATA_FLOW_CONTRACT` via MR-ticket.
*Accept:* manifest validates against schema; every live protected route/asset/RPC has an entry; `project_ref` pins match live introspection. *Rollback:* delete new files (docs only).

**Phase 2 — Smoke scripts (observe, don't block).**
Build `critical_systems_gate.py` stages 1,3,4,5 in **report-only** mode; run against current prod to establish green baseline.
*Accept:* unauth + authenticated journeys pass for Arena, USCE admin, Matrix routes with 0 console errors; matches the June 24 validation evidence. *Rollback:* scripts are read-only; disable by not invoking.

**Phase 3 — Safe deploy wrappers (enforce).**
Wrap Railway, R2/CDN, Kinsta/Matrix deploys; turn on stop-the-line. Keep `--emergency`.
*Accept:* a deliberate bad deploy (missing import; wrong Supabase ref; dirty git) is blocked in a staging dry-run. *Rollback:* wrappers call the same underlying commands; revert to direct invocation if a wrapper misfires (documented escape hatch, Brian-gated).

**Phase 4 — CI / monitoring.**
Nightly/post-deploy run of the gate; alert on drift (hash, RLS-exposure, untracked protected source, secret-missing).
*Accept:* a synthetic drift fires an alert within one cycle. *Rollback:* disable schedule.

**Phase 5 — New-app onboarding automation.**
A `register-system` helper that scaffolds a manifest entry and refuses CI green until journeys are defined.
*Accept:* a new `matrix-app-mode-*` route cannot pass CI without a manifest entry + journey. *Rollback:* make registration advisory.

---

## 10. Instructions to Codex

Concrete, in order. **Codex may push back** with a counter-proposal if it can justify smaller/safer/more maintainable.

1. **Phase 0 first, today.** Commit the untracked/modified protected files to `known-good/2026-06-25` and confirm Railway serves that tree. Do not build anything else until the baseline exists. (This is the highest-leverage action in this document.)
2. Create `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` from §4. Populate `approved_sha256` for `usce_admin.html`, `arena.html` from live origin. Pin Supabase per §7 (USCE→`fglyvdykwgbuivikqoah`, CRM→`plgndqcplokwiuimwhzh`). Add the third project.
3. Build `critical_systems_gate.py` in **report-only** mode (Phase 2). Reuse `matrix_runtime_guard.py` for Matrix hashes — do not reimplement. Implement stage-1 `node --check` + import-resolution against `railway.json`'s start command.
4. Add an authenticated browser-smoke runner (the only demo-safety proof). Encode the three journeys (Arena, USCE admin, Matrix routes) from the June 24 success evidence as the green baseline.
5. Add a **read-only** Supabase drift check (`list_tables`/`list_migrations` vs. manifest pins). No writes. Surface the RLS-disabled finding to Brian (§6 R-C); present remediation SQL, do not run it.
6. Correct `DATA_FLOW_CONTRACT.md` §0/§1.1 via a new MR-ticket (it is locked). Move the `app/api/**` clarification into `FIX.md` + guardrail G-19.
7. Move stray `*_BACKUP_*.php` out of `wp-content/mu-plugins/` root.
8. Only after Phases 0–2 are green: wrap deploys (Phase 3) and turn on stop-the-line.

---

## CLAUDE VERDICT:

**The proposal is correct in direction and should proceed — but its sequencing is backwards on the one thing that matters most.** Codex's eight red-team traps are real; I confirmed all eight against the actual code, including the headline trap (a full, inactive `app/api/**` auth+USCE tree that production does not serve). The Matrix runtime lock is genuinely strong and should be reused, not replaced. However, the most dangerous condition is **not** in the design — it is in the repo *right now*: the production-critical source that repaired the June 24 SEV1 (the USCE route, the Matrix lock, the modified server) is **untracked/uncommitted on an audit branch**, so an ordinary git or dual-Mac operation would silently re-create the outage and delete the very lock this project depends on. A guardrail built on an unprotected baseline is theater. Commit the baseline first, then build the manifest, then the smoke, then the wrappers. Also: the Supabase "conflict" Codex flagged resolves the opposite of the intuitive way — the **code is right and the contract doc is stale**; both projects carry a `command_center` schema with different tables, which is a live booby trap that must be pinned per-table. With Phase 0 done and the additive manifest/gate in place, MissionMed can keep shipping new Matrix and non-Matrix apps without risking live production. Net: **approve, re-sequence, and treat the manifest as additive — exactly as the hard constraints require.**

## TOP 5 CODEX ACTIONS:

1. **Phase 0 now:** commit untracked/modified protected files (`missionmed-hq/routes/usce-public-intake.mjs`, `_SYSTEM/KNOWN_GOOD/`, `_SYSTEM/tools/`, modified `server.mjs`) to a tagged `known-good/2026-06-25`; verify Railway serves it; freeze destructive git ops until done.
2. **Author `CRITICAL_SYSTEMS_MANIFEST.json`** with runtime-owner, per-route expected status/body, per-table Supabase `project_ref` pins, CORS, browser-journey, and rollback — referencing (not replacing) the Matrix lock.
3. **Build the report-only smoke gate** (artifact `node --check` + import-resolution, unauth HTTP asserts, authenticated browser journeys, Railway log checks); establish today's green baseline.
4. **Pin and correct the Supabase split-brain:** USCE→RANKLISTIQ, CRM→GROWTH ENGINE; add the third project; fix `DATA_FLOW_CONTRACT.md` via MR-ticket; add read-only drift check.
5. **Only then wrap deploys** (Railway/R2/Kinsta) with backup→deploy→verify-origin→browser-smoke and stop-the-line; keep a single audited `--emergency` bypass.

## QUESTIONS FOR BRIAN:

1. **Untracked prod source:** OK for Codex to commit the current working-tree hotfixes (incl. the 425 KB `server.mjs` and the untracked USCE route) to a `known-good` tag now? This is the urgent one.
2. **`app/api/**` Next tree:** Is it a planned future migration target, or dead code? If dead, can we quarantine it (move/rename) so no one "fixes prod" there again?
3. **Supabase RLS:** All 9 GROWTH ENGINE CRM tables (incl. `students`=73 rows, `payments`, `email_drafts`) and 5 RANKLISTIQ queue tables have **RLS disabled**. Is `command_center` confirmed **not** exposed via the anon Data API? If so this is defense-in-depth only; if not, it's an open door to student PII. (Advisory — I changed nothing.)
4. **Session secret:** Is `MMHQ_SESSION_SECRET` set as a persistent Railway env var? If not, every deploy/restart silently logs everyone out.
5. **Third Supabase project** `avpdetdkpwmqqxtvomix` (Scheduler Staging): in scope for the contract now, and is it staging-only or does any production path touch it?
6. **Scope of browser smoke:** beyond Arena/USCE/Matrix, do you want WooCommerce checkout, `/my-account`, and `/wp-admin` in the authenticated journey set (recommended, given shared WP runtime)?

## WHERE CLAUDE EXPECTS CODEX MIGHT DISAGREE:

1. **Phase 0 priority.** Codex may want to ship the manifest first (it's the visible deliverable). I'd push back: committing the baseline is 30 minutes and removes a CRITICAL re-outage path; the manifest is worthless if its protected source can vanish.
2. **One global manifest vs. per-system manifests.** Codex may prefer several small manifests. Acceptable if a single index references them and the gate reads them as one graph — but avoid drift between many files.
3. **Browser smoke cost.** Codex may argue headless journeys are slow/flaky for a gate. Fair; mitigate by keeping them to 3–5 critical journeys and allowing a fast unauth-only path for non-protected changes — but never let a protected deploy skip the authenticated journey.
4. **Correcting `DATA_FLOW_CONTRACT.md`.** It's locked under MR-078B; Codex may resist editing it. Agreed it needs an MR-ticket — but leaving the doc wrong is itself a hazard, so the ticket should be filed, not deferred.
5. **mu-plugin cleanup.** Codex may consider the stray `*_BACKUP_*.php` harmless. Even if non-fatal today, auto-loaded backups are an uncontrolled production surface; moving them out of the load path is cheap insurance.

---
*Prepared read-only. No MissionMed files were edited, nothing was deployed, and no Supabase data was modified — only schema metadata was read to resolve the project-pinning conflict.*
