# 16 Ecosystem Regression and Protected Systems

RESULT: `MMC_SCOPED_REGRESSIONS_GREEN_NO_EXTERNAL_MUTATION`

## Protected-system result

The fresh enforced critical-systems gate exited `0` with ten passes. It verified `.railwayignore`, the USCE intake route, Matrix protocol/manifest/guard references, the critical contract/manifest/gate, `node --check missionmed-hq/server.mjs`, and relative imports across the gate's 16 local files. Its three warnings were expected and non-blocking: the intentional dirty `server.mjs`, network checks skipped, and three browser journeys skipped.

The Matrix runtime preflight exited `42` because all ten protected Matrix source files are absent from this MMC-only worktree. No Matrix path is changed. This is an out-of-scope worktree skip, not a Matrix regression or a passed runtime proof.

Protected deployment/configuration owners remained unchanged: `.railwayignore`, `railway.json`, both package manifests, the critical-system contract/manifest/tool, and the Matrix protocol/manifest/tool. Railway's start owner remains `node missionmed-hq/server.mjs`; new MMC runtime imports are not ignored.

## Local runtime and route regressions

- Recursive import scan after the shared UUID/timestamp and canonical-path additions: 40 changed/new JavaScript files, 69 parsed relative imports, 0 missing.
- Syntax: `node --check` passed 40/40 changed/new JavaScript files.
- Safe historical MMC validators: 13/13 passed—v1 core; coaching worker core/route; coaching pipeline; Partner Demo; persistence integration; private mount; roster identity; roster verification; selection continuity; student resolution; Webex policy/route. Persistence integration additionally asserts the low-level legacy insert/update helpers throw without calling Supabase.
- Shared route/security validators: 4/4 passed—v2 gateway security, legacy boundary seal, principal derivation, and shared-server least-privilege role resolution.
- Custom/direct route matrix: 10/10 paths passed. `/api/mmc/persistence` remains a separate exact shared-server branch; v2/coaching near-prefix predicates are rejected in their route modules; shared server registrations remain unique; and the persistence branch precedes the coaching compatibility matcher. That matcher includes the exact `/api/mmc/v2/**` family and delegates it to the default-off v2 gateway, so the v2 source route is mounted indirectly rather than unmounted.
- Post-fix independent path verification passed 19/19 scoped validators. Its 12,288-case encoded-path fuzz produced zero private-surface bypasses: canonical decoding occurs before every private/API/static branch, while malformed escapes, NUL, backslash, and decoded dot segments fail closed with `400`.
- `git diff --check` passed at the audit checkpoint.

The shared `server.mjs` change is limited to canonical request-path enforcement, MMC role derivation, and the coaching compatibility bridge plus sealed historical boundaries, including unconditional low-level legacy insert/update denial. The v2 handler is already reached through that bridge but remains default-off and has no deployed/durable composition. Existing route order, startup owner, exports, auth/CSRF ownership, and non-MMC bootstraps were preserved.

## Repository scope and artifact hygiene

At the read-only audit checkpoint, every changed path belonged to the 006 handoff, MMC runtime/test surface, additive CAM v2 migration, or validation snippet. There were no out-of-scope changes, binary/media/cache/build artifacts, or files over 5 MiB. A secret scan found no real/high-confidence secret, env/credential file, service-role browser use, direct browser Supabase access, or deploy command. Credential-shaped values are deliberate synthetic DLP fixtures; `/Users/example` values are adversarial redaction fixtures. Existing Brian drop-zone constants were not changed.

The migration filename is a unique 14-digit latest sequence, wrapped in `BEGIN`/`COMMIT`, and additive under `mmc.cam_v2_*` (plus standard pgcrypto digest support). It does not modify an existing MMC v1 or shared-system object. Final schema behavior is covered separately by report 04.

## Explicit non-executed checks

Credential-dependent staging persistence, roster staging/browser, and provider/browser smokes were not run. The first exits at an explicit missing base URL/cookie precondition; the others require unavailable staging authorization, would start the prohibited full-server watchers, or would write a screenshot. Network, production, configured-database apply, provider, browser-service, deploy, and watcher activity is not represented as tested. Disposable local PostgreSQL validation is separately reported in 04 and 15.

## Local environmental incident

Browser tooling filled the local disk during the audit. Remediation deleted only two stale, unopened Chrome temporary/cache objects totaling approximately 13 GiB. No repository, project, migration archive, source, report, user document, or browser profile authority was deleted. The final `df -h /` checkpoint reported approximately 20 GiB available. The static audit server was stopped and browser tabs were finalized. This was the only local environmental issue and did not require external help.

## Ecosystem impact and rollback

Matrix, Arena, STAT, StoryForge, Scheduler, Calendar, Daily Drills, `video_registry.json`, R2, Stream, File Vault, WordPress/LearnDash, payments, production Supabase, Railway resources, Cloudflare resources, and provider accounts were not mutated. No watcher was started.

Before external v2 state exists, the MMC-scoped shared-server bridge can be reverted with the MegaRun commit or left inert by its default-off flags. Historical v1 mutations remain sealed; rollback must not reintroduce a writer. No P0/P1 ecosystem regression was found in the scoped local audit.
