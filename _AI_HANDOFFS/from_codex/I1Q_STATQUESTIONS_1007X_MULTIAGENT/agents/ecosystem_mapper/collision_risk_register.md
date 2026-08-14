# I1Q-1007X Collision Risk Register

## Reading Rule

This register is source-level pre-mutation evidence. `OBSERVED` means the condition is present in tracked or current working-tree files. `RUNTIME UNKNOWN` means this mapper did not query production application, database, environment, or deployment state. No finding authorizes a protected-system edit.

Authority baseline: MissionMed OS `93c0404794fe105235b80514c75fffc3177f140b`, current DR-006, MR-078A, MR-078B, MR-079, Critical Systems Contract/Manifest, Matrix Runtime Lock, STAT Canon, and Architecture 1002.1.

## P0 Stop-The-Line Risks

| ID | Collision | Evidence | Runtime state | Impact | Owner and disposition |
| --- | --- | --- | --- | --- | --- |
| CR-001 | A tracked `bootstrap_match` RPC returns answer-equivalent fields, including answer, explanation, and correct index, before finalization and describes client-side grading. This conflicts with DR-006 class A isolation, MR-078B server-authoritative scoring, and the STAT sealed-pack contract. | `supabase/migrations/20260424121038_create_bootstrap_match_rpc.sql` | UNKNOWN whether applied/current | Pre-answer disclosure and scoring bypass | STAT/Data owner must establish production truth and retire or replace only through a new forward migration; I1Q must never depend on this RPC |
| CR-002 | Encrypted HQ sessions warn on missing, invalid, or expired `expiresAt` and still return the payload. | `missionmed-hq/server.mjs`, `readEncryptedSession` | OBSERVED in source; production parity UNKNOWN | Expired cookie or bearer session acceptance across shared consumers | HQ/Auth owner; fail closed, then independently regress Arena, STAT, HQ, Daily, and logout |
| CR-003 | HQ creates a random session secret when the configured secret is absent, while startup, exchange, persistence, and health checks test the always-present fallback. This conflicts with the Critical Systems Contract hard stop. | `missionmed-hq/server.mjs`, `CONFIGURED_SESSION_SECRET`, `SESSION_SECRET`, startup and exchange checks | OBSERVED in source; environment not inspected | Missing production configuration can look healthy; restart invalidates sessions | HQ/Auth owner; hard fail on absent configured secret and prove restart persistence without exposing values |
| CR-004 | Three backup `.php` route files are tracked directly in the auto-loaded mu-plugin root. The Critical Systems Contract explicitly stops deployment when a backup or duplicate PHP file sits there. | `wp-content/mu-plugins/arena-route-proxy_BACKUP_20260427_101948_A7-ARENA_ECO_FINETUNE-codex-high-2000-i.php`; `arena-route-proxy_BACKUP_20260427_102810_A7-ARENA_ECO_FINETUNE-2000-i-sync.php`; `stat-route-proxy_BACKUP_20260427_102810_A7-ARENA_ECO_FINETUNE-2000-i-sync.php` | OBSERVED in tracked source; Kinsta parity UNKNOWN | Duplicate hook/function loading, route collision, fatal redeclaration, or stale behavior | WordPress/Root owner; remove from auto-load root only under protected deployment procedure, then run full gate |
| CR-005 | Critical deploy baseline is incomplete: the manifest requires `.railwayignore`, which is absent; current HQ source differs from the known-good manifest pin. | `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`; missing worktree `.railwayignore`; diff of `missionmed-hq/server.mjs` from pinned commit | OBSERVED locally; production parity UNKNOWN | Railway bundle contamination or deployment from an unapproved baseline | Root/Release owner; reconcile manifest, ignore file, source commit, production hash, imports, and rollback before any deploy |
| CR-006 | Root Railway configuration always starts MissionMed HQ; there is no dedicated I1Q service declaration or local GitHub workflow. An attempted repository deployment could redeploy HQ rather than launch I1Q. | root `package.json`, `railway.json`, absent `.github/workflows/`, `i1q-question-platform/package.json` | OBSERVED | Protected-runtime replacement or silent non-deployment of I1Q | Root/Release owner; register a dedicated service/build context and pin its source/branch/rollback |
| CR-007 | The I1Q SQL is a design file named `0001_i1q_question_platform.sql`, lacks the required MR-078A header, and has no verified RANKLISTIQ promotion route. Root migrations are declared to target Growth Engine. | `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`; MR-078A/B | OBSERVED; SQL never applied by this mapper | Wrong-project migration, history desynchronization, or untested forced-RLS behavior | Architecture/Data designs; Root selects canonical path and applies preview-first; never copy into the Growth Engine route by convenience |

## P1 Integration Risks

| ID | Collision | Evidence | Runtime state | Required resolution |
| --- | --- | --- | --- | --- |
| CR-008 | Candidate RLS trusts `app.actor_id` and comma-separated `app.actor_roles` settings, while no proven server transaction/pool boundary sets and clears them. Generic reads allow any non-null actor. | I1Q candidate SQL session helpers and generated policies | Design-only | Build a server-owned repository; use transaction-local context; test GUC spoofing, pool reuse, rollback, cross-role, and cross-assignment denial |
| CR-009 | STAT Canon requires `get_duel_pack` to return exactly seven envelope fields. Tracked RPC source returns `{status, duel, questions}`, and the private duel object contains additional fields. | `_SYSTEM/STAT_CANON_SPEC.md`; `supabase/migrations/20260420113000_stat_canon_rpcs.sql`; `LIVE/stat.html` normalization | Source collision; active DB definition UNKNOWN | STAT owner ruling and production introspection before any adapter or dataset release |
| CR-010 | STAT Canon requires client hash recomputation; MR-078B says `content_hash` exists only server-side and is never recomputed client-side. | STAT Canon section 1/4; MR-078B source-of-truth rule | Authority conflict remains unresolved | STAT owner and authority maintainer must publish one precedence ruling; I1Q preserves the frozen test vector meanwhile |
| CR-011 | DR-006 requires question metadata identity to be `(dataset_version, question_id)`. Tracked `public.question_metadata` uses `question_id` alone as primary key and defaults version to `1.0`. | `supabase/migrations/20260426170000_mmos_arena_intel_question_metadata.sql` | Source collision; active DB state UNKNOWN | Additive composite-compatible design plus historical-join migration after owner review; never rewrite attempts or v4 rows |
| CR-012 | Drill ownership is split across authorities and runtime: MR-078B assigns `drill_registry` to Growth Engine; Arena/Daily use RANKLISTIQ controls; current `/api/drills` is an MMVS Railway registry. | MR-078B; `LIVE/arena.html`; `LIVE/daily.html`; `mmvs-drills-proxy.php` | OBSERVED | Drills/Data/Root must pin project, schema, table/API, ingestion owner, and stable key before certification |
| CR-013 | HQ CORS reflects the request Origin with credentials when the configured allowlist is blank. | `missionmed-hq/server.mjs`, `buildCorsHeaders` | Source observed; environment UNKNOWN | Require a fixed allowlist and deny hostile/missing origins as appropriate; test WordPress, CDN, and any dedicated I1Q origin |
| CR-014 | WordPress signs a nonce into each 60-second handoff, but the HQ parser validates signature/time and no nonce-consumption or replay store was observed. | `missionmed-hq-auth-handoff.php`; `missionmed-hq/server.mjs`, `parseWordPressHandoffToken` | Static absence observed; external mitigation UNKNOWN | HQ/Auth owner must prove one-time semantics or explicitly accept bounded replay risk; test same-token reuse |
| CR-015 | The Critical Systems Manifest omits `/api/auth/validate-wp` and `/api/auth/logout` from `auth_core.critical_routes` and does not list the WordPress handoff/proxy files as protected paths. I1Q is unregistered. | `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` | OBSERVED | Root must register every protected route/file, smoke expectation, owner, and rollback before extending auth |
| CR-016 | `MM-AUTH-ARCH-001` is referenced by MR-078B/MR-079 but absent. Product index entries for HQ, Arena, Matrix, and USCE point to passport paths absent at OS commit `93c0404`. | canonical file search; `products_index.json`; `PRODUCT_PASSPORTS/` | OBSERVED authority gap | Authority maintainer must file or remove stale references; until then runtime-backed contracts are evidence, not a substitute architecture ruling |
| CR-017 | DR-006 defines a separate authorized-internal-candidate-review flag. Candidate SQL implements only internal platform, STAT, Drills, and student booleans. | DR-006 Feature Flags; I1Q candidate SQL and `platform.mjs` | Design-only; no runtime flags exist | Add the missing independently controlled flag in the reviewed schema/API, default false, with audit and rollback behavior |
| CR-018 | Daily requires a nonempty transcript URL, while Drills allows explicit transcript absence. The new I1Q sidecar represents transcript availability explicitly but is not wired to either consumer. | `LIVE/daily.html`; `LIVE/drills.html`; `src/adapters/drills-v1.mjs` | Adapter exists locally; consumer flags off | Drills/Daily owner must approve a backward-compatible sidecar rule; do not weaken Daily silently or fabricate a URL |
| CR-019 | The HTML deployment primer names legacy local source paths and direct upload semantics, while current manifest/script use `LIVE/*`, a Git gate, R2 STAGING-to-LIVE promotion, and wrapper checks. | `_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md`; `_SYSTEM/DEPLOY_MANIFEST.json`; `_SYSTEM/deploy.sh` | OBSERVED documentation drift | Runtime/manifest wins; authority owner must reconcile prose before adding I1Q mappings |
| CR-020 | Historical v4 seed SQL uses `ON CONFLICT ... DO UPDATE`, while current authority treats `dataset_questions` as immutable after seed. | `supabase/migrations/20260420111000_stat_dataset_ingest.sql`; MR-078B INV-6; DR-006 | Historical source observed; applied state not queried | Never rerun or edit the applied artifact as an I1Q mechanism; publish a new additive dataset version through the owner route |
| CR-021 | MR-078A first labels `migration repair --status applied` banned, then permits it under strict reconciliation conditions. MR-079 and DR-006 are stricter for this mission. | MR-078A sections 3.2, 3.3, and 5.4; MR-079; DR-006 | Documentation conflict | I1Q rule is unambiguous: no repair, no history rewrite, forward migrations and reviewed forward compensation only |

## P1 Current Build Risk

| ID | Observation | Evidence | Disposition |
| --- | --- | --- | --- |
| CR-022 | The concurrent I1Q working snapshot is not green: 76 tests ran, 66 passed, and 10 failed. Six failures were localhost bind `EPERM` in this sandbox; four were implementation regressions involving release fixture identity and role behavior. | `npm test` in `i1q-question-platform` during this mapping run | Do not infer production readiness. The owning agents must repair the four real regressions and rerun API tests in an environment that permits localhost binding on one fixed commit |
| CR-023 | The worktree changed during mapping as other agents committed adapter work and modified auth. Any hash or test result is a point-in-time snapshot. | Git HEAD/status observations during the run | Root must freeze one integration commit before security, UX, RLS, consumer, and release certification |

## Standing Release Gates

| Gate | Current state |
| --- | --- |
| Internal authenticated platform | OFF by DR-006 until release certification |
| Authorized internal candidate review | OFF by DR-006; separate candidate implementation flag absent |
| Raw transcript access | Restricted |
| Physician approval | Unavailable; credentialed medical governance lead unassigned |
| Student content | OFF |
| STAT consumer | OFF |
| Drills consumer | OFF |
| Preview/staging/internal production | Not proven |
| Rollback/reapply and monitoring | Not proven |

## Resolved During Mapping

The inherited draft reported four root dependency advisories. The current lock resolves the cited package versions, and `npm audit --offline --json` returned zero known vulnerabilities. This removes that stale draft finding only; it does not clear the application, auth, datastore, deployment, or consumer gates above.

## Verdict

`BLOCK`. Read-only inventory and privacy-safe engineering may continue. No shared mutation, migration, protected deployment, consumer activation, or student publication is supportable from the current baseline.
