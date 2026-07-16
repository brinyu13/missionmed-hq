# I1Q-1008A Independent Red Team

**Decision:** `VETO`

**Highest achieved state:** `LOCAL BLOCKED ENGINEERING CANDIDATE`

No I1Q-1008A State A, B, C, or D is achieved or certified. Commit `483b0f76f42bc3a1da674ccd4f61432aab84668b` is immutable and contains useful fail-closed local controls, but it remains unwired, unapplied to an authorized preview target, and undeployed. Red Team does not authorize migration, preview application, staging deployment, feature enablement, production activity, or student use.

## Review Boundary

- Reviewed branch: `i1q-statquestions-1008a`
- Exact candidate commit: `483b0f76f42bc3a1da674ccd4f61432aab84668b`
- Candidate tree: `8e48125fbb160b73880516685aef0389d6854a82`
- Execution boundary: tests and validation ran from an isolated `git archive` of that commit. Post-commit uncommitted evidence-generator/report changes present in the shared worktree were excluded.
- Review time: 2026-07-16 UTC
- External boundary: no preview or staging target exists. No localhost result is treated as preview, staging, deployment, hosted RLS, or runtime proof.
- Independent exact-commit execution: `npm test` returned 287 total, 285 pass, 0 fail, and 2 database-target skips. `node --test tests/ui.test.mjs` returned 19/19. `npm run validate` returned `FAIL` with 14 integrity errors and reported claimed state `STATE_A`; that claim is not accepted.
- Database boundary: the supplied fresh disposable PostgreSQL results (13/13 base and 1/1 runtime) were inspected but not independently rerun because no independent disposable database URL was provisioned. The two database lanes skipped in the independent default run.
- Protected boundary: all 20 protected baseline hashes were independently rechecked and unchanged. Protected files were read only.

This verdict is bound only to commit `483b0f76f42bc3a1da674ccd4f61432aab84668b`. Shared-worktree changes above that commit are neither reviewed candidate bytes nor evidence for this verdict.

## State Verdict

| State | Red Team verdict | Disproof |
| --- | --- | --- |
| State A | `VETO / NOT ACHIEVED` | The identity contract is an unratified candidate, the executable server does not wire it, canonical users and lifecycle attacks are absent, and shared HQ auth has unresolved protected defects. |
| State B | `VETO / NOT ACHIEVED` | No authorized preview exists; no hosted RLS/grant attack run, apply, backup restoration, compensation, reapply, or required MR-078A diff proof exists. |
| State C | `VETO / NOT ACHIEVED` | No authenticated non-localhost I1Q service, deployment identity, smoke run, accessibility run, monitoring, rollback exercise, performance run, or burn-in exists. |
| State D | `VETO / OUT OF SCOPE AND BLOCKED` | Production and student release remain prohibited; prerequisite states are absent. |

## Findings

### RT-1008A-001 - Critical - No concrete canonical persistent runtime adapter exists

**Classification:** `LOCAL SAFETY PASS BOUNDED BY EXTERNAL IMPLEMENTATION BLOCKER`

The committed source closes the unsafe default path. `npm start` now enters `src/runtime.mjs`, requires authorized staging mode, an explicit bind, and a hash-pinned module under `runtime-adapters/`; it rejects `MemoryRepository`, synthetic platforms, missing persistent platform methods, and missing identity/static/logout/readiness/finalization/review-content resolvers. Server routes now await asynchronous platform methods, and direct `src/server.mjs` execution refuses non-demo startup. The runtime-composition regressions pass.

No `runtime-adapters/` directory or concrete adapter module exists. `PostgresRepository` still supplies only a transaction boundary rather than the complete platform surface, and no canonical identity, persistent workflow, readiness, finalization, or review-content implementation can be loaded. Thus the source now fails closed correctly, but it still cannot start an authenticated staging application.

**Readiness claim disproved:** a source-complete API and adapter candidate is not a deployable authenticated service.

**Achieved-state verdict:** blocks States A through C.

**Repairability:** `REPAIRABLE, MIXED LOCAL/EXTERNAL`. Implement and owner-ratify the hash-pinned canonical adapter, complete persistent platform surface, and all required resolvers, then prove the exact committed composition on a non-localhost target.

**Rerun trigger:** a committed production entrypoint and datastore adapter exist and an authenticated staging smoke proves persistence across restart.

### RT-1008A-002 - Critical - No preview, staging deployment, or external operation exists

**Classification:** `EXTERNAL EVIDENCE BLOCKER`

`deployment/preview-target.json` remains unassigned, no approval record or target secrets exist, and the preview workflow has never run. Root deployment, monitoring, rollback, and smoke records explicitly report `NOT DEPLOYED`, `DESIGN ONLY`, or `NOT RUN`. There is no authenticated non-localhost I1Q URL and no deployed commit or artifact identity.

**Readiness claim disproved:** local source and disposable-database checks cannot establish State B or C.

**Achieved-state verdict:** blocks States B through D and prevents external validation of State A integration.

**Repairability:** `REQUIRES EXTERNAL OWNER ACTION`. Assign an authorized synthetic-only preview, commit and approve exact target/candidate records, configure the protected GitHub environment, execute the workflow phases, deploy the application, and retain immutable evidence.

**Rerun trigger:** exact preview and staging targets, URLs, commits, approvals, workflow run IDs, and artifact hashes are available.

### RT-1008A-003 - Medium - Static MR-078A workflow controls pass, but authorization and execution are absent

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL GATES`

The latest workflow correctly separates secret-free validation, scopes secrets by step, pins actions, binds candidate artifacts and remote history, separates operation stages, performs post-operation RLS/grant/flag checks, uploads only after successful redaction, validates UTC/no-future timestamps and 60-second gaps, checks required headers, captures pre-action `supabase db diff`, and requires a zero-content post-action diff. The updated static workflow regressions pass. The earlier missing-diff/timestamp source finding is closed.

No target, approval record, protected-environment configuration, workflow run, generated diff, human diff review, backup/restore evidence, or run artifact exists. Exact approval provenance and MR-078A operation evidence therefore remain external facts that source inspection cannot grant.

The committed approval JSON is byte-bound, but its `approved_by` value is only data copied between two candidate-authored files. Authentic approver provenance therefore depends on external branch protection, CODEOWNERS/signature policy, and protected-environment reviewers, none of which is evidenced here.

**Readiness claim disproved:** static workflow hardening is not MR-078A execution readiness or authorization provenance.

**Achieved-state verdict:** blocks State B and every higher state.

**Repairability:** `REQUIRES EXTERNAL AUTHORITY AND EXECUTION`. Configure the owner-controlled protected environment, assign the synthetic target, run validation, review the exact diff, bind approval, and only then run an authorized operation.

**Rerun trigger:** workflow source includes all MR-078A checks, approval provenance is owner-controlled, static workflow tests pass, and a first authorized `validate` run produces reviewable artifacts before any apply.

### RT-1008A-004 - High - Committed evidence is stale, incomplete, and reports unsupported State A

**Classification:** `LOCAL SOURCE/EVIDENCE INTEGRITY GAP`

Against the exact commit, `npm run validate` fails with 14 errors: 12 stale checksum entries (`openapi.json`, `package.json`, `public/app.js`, `public/index.html`, `public/styles.css`, `src/auth.mjs`, `src/contracts.mjs`, `src/platform.mjs`, `src/server.mjs`, `tests/api.test.mjs`, `tests/security-regressions.test.mjs`, and `tests/ui.test.mjs`), `E_ARTIFACT_INVENTORY`, and `E_TEST_EVIDENCE_STALE`. The inventory omits current files including the runtime root, identity adapter, 1008A migrations, runtime tests, and preview workflow. More seriously, the validator reports claimed state `STATE_A` even though `deployment_manifest.json` says `BLOCKED_NOT_DEPLOYED`, the preview target is unassigned, and no canonical runtime adapter exists. The exact commit is immutable, but its evidence is neither synchronized nor whole-packet bound; the target manifest also contains no candidate commit or artifact hashes.

**Readiness claim disproved:** the exact candidate does not have a passing evidence-integrity result, and the validator's bounded scope would not establish whole-packet integrity even after checksum regeneration.

**Achieved-state verdict:** blocks certification of all states.

**Repairability:** `REPAIRABLE LOCAL`. Regenerate a complete evidence estate from this exact commit, bind workflow, migrations, deployment records, and closure reports, remove the unsupported achieved-state claim, and prevent post-signoff mutation.

**Rerun trigger:** the exact candidate has a passing validator, a complete manifest covering the entire current packet, and no state claim above the externally demonstrated state.

### RT-1008A-005 - High - Canonical identity and shared-auth safety are not closed

**Classification:** `MIXED LOCAL, PROTECTED DEPENDENCY, AND EXTERNAL`

The new identity adapter has substantial synthetic tests and now requires an explicit audit sink; audit-sink outage fails closed with 503. The runtime root requires all canonical resolvers. Those local repairs are accepted. A concrete canonical adapter, role-profile implementation, durable audit implementation, staging identity, and owner-ratified contract still do not exist.

Read-only inspection of protected HQ source independently reproduced these gates: `missionmed-hq/server.mjs:81-83` uses a random session-secret fallback; `readEncryptedSession()` at lines 1026-1037 warns on malformed or expired expiry and returns the payload; `buildCorsHeaders()` at lines 3058-3070 reflects request origin when no fixed allowlist is configured while allowing credentials. On 2026-07-16 UTC, a public read-only request to `/api/auth/session` with `Origin: https://red-team-invalid.example` returned that origin and `Access-Control-Allow-Credentials: true`. WordPress creates a handoff nonce, but one-time consumption remains unproved.

**Readiness claim disproved:** synthetic adapter tests do not establish a canonical, revocable, replay-safe, auditable authentication lifecycle.

**Achieved-state verdict:** blocks State A and all dependent states.

**Repairability:** `REQUIRES PROTECTED OWNER AND EXTERNAL VALIDATION`. Resolve through the Critical Systems process, ratify the I1Q identity contract, wire the adapter, and run login, invalid login, expiry, replay, revocation, role removal, logout, restart, outage, and hostile-origin tests.

**Rerun trigger:** protected auth fixes and decision records are present, runtime/source parity is proved, and the full canonical-user attack matrix passes on staging.

### RT-1008A-006 - High - RLS and grants are locally promising but target fidelity is absent

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL BLOCKER`

The migration creates non-login, non-inheriting, non-bypass capability roles, force-RLS remains asserted, direct table grants are denied, the browser receives only the caller-scoped identity RPC capability, application runtime remains deny-all, and feature flags remain off. No local broad-grant bypass was found.

That is not a functional or hosted grant model. Exact application grants and the transaction actor binder are intentionally absent. The runtime test creates its own `authenticated` and `anon` roles and its own `auth.uid()` stub (`tests/postgres-runtime-1008a.test.mjs:52-65`), so it does not prove actual hosted role attributes, PostgREST schema exposure, connection-pool actor isolation, or target ownership/default privileges. No hosted owner/non-owner/bypass matrix ran.

**Readiness claim disproved:** disposable PostgreSQL proof is not State B hosted RLS certification.

**Achieved-state verdict:** local deny-by-default contract only; State B not achieved.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Ratify exact grants and actor binding, test real target roles and pool behavior, and execute the complete attack matrix against the authorized preview.

**Rerun trigger:** app-runtime grants and binder are committed and approved, followed by fresh hosted RLS/grant tests for anonymous, authenticated, unauthorized, reviewer, admin, owner, and pooled-session substitution cases.

### RT-1008A-007 - High - Answer/source isolation has no production authorization path

**Classification:** `LOCAL CONTRACT GAP WITH EXTERNAL PROOF MISSING`

Unit tests cover pre-answer denial and synthetic finalization cases, and no local direct-answer bypass was found. But finalization and review-content authorization are only injectable resolver slots in `createQuestionPlatformServer`; the executable entrypoint injects neither. There is no production proof that accepted assignment, server-side finalization, phase transition, and source-content release are derived from authoritative persisted state. No sealed-pack or cross-user answer/source attack ran on a deployed system.

**Readiness claim disproved:** local policy functions do not prove deployed answer or source isolation.

**Achieved-state verdict:** blocks States A through C for answer-bearing workflows.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Implement authoritative persisted resolvers and execute pre-answer, post-answer, reviewer-assignment, cross-user, replay, stale-session, direct-URL, cache, export, and rollback attacks.

**Rerun trigger:** production resolver composition is committed and the staging isolation matrix passes with captured request/response and audit evidence.

### RT-1008A-008 - Medium - Pagination completeness is repaired locally, but persistent-stack performance is unproved

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL PERFORMANCE BLOCKER`

The latest `public/app.js:382-429` drains cursor pages, rejects invalid totals, total changes, overlapping IDs, cursor loops, incomplete results, and results above 50,000 rows. The new 250-row UI regression passes, so the prior silent first-page truncation finding is closed on current local bytes.

The implementation still serially loads complete resource sets into browser memory for many joins and filters. The 10,000-row load result exercises only the in-memory repository, while the 250-row UI test uses a mocked transport; neither is a database, network, browser-rendering, concurrency, or staging SLO result.

**Readiness claim disproved:** local microbenchmarks do not prove complete or performant operator workflows at corpus scale.

**Achieved-state verdict:** local pagination completeness passes; State C performance readiness remains blocked.

**Repairability:** `REQUIRES EXTERNAL VALIDATION`, with local optimization if thresholds fail. Run scale tests against the persistent staging stack and move expensive joins/filters server-side if the browser path misses approved thresholds.

**Rerun trigger:** authenticated staging load tests meet approved latency, memory, error, concurrency, and completeness thresholds at representative corpus sizes.

### RT-1008A-009 - High - Compensation and reapply are not an operational rollback

**Classification:** `LOCAL SAFETY SCRIPT WITH EXTERNAL EXECUTION BLOCKER`

The local compensation script is conservative: it revokes capability, preserves records, and keeps behavior flags off. The reapply restores only the reviewed identity-profile capability; it intentionally leaves application runtime deny-all and flags disabled. It therefore does not restore a functional service once real application grants and actor binding exist. No preview backup restore, compensation, reapply, data-integrity comparison, or application smoke has run, and the rollback acceptance interpretation remains unresolved in the closure packet.

**Readiness claim disproved:** idempotent disposable execution is not an operational rollback/recovery rehearsal.

**Achieved-state verdict:** blocks States B and C.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Ratify the rollback objective, extend reapply to the approved functional contract without auto-enabling behavior, then execute backup restore, compensate, reapply, schema/data diff, and app smoke on preview.

**Rerun trigger:** signed rollback criteria and complete target evidence for apply, compensation, restore, reapply, and post-recovery smoke are available.

### RT-1008A-010 - High - Fail-closed monitoring contracts exist, but monitoring operation is absent

**Classification:** `LOCAL IMPLEMENTATION GAP WITH EXTERNAL BLOCKER`

The local source now requires an audit function, fails closed on audit outage, requires a readiness resolver, and requires the runtime descriptor to claim durable audit. Those are useful contracts, not an implementation: no concrete runtime adapter, durable transport, metrics, tracing, alert routing, on-call ownership, dashboards, or tested runbook exists. The monitoring packet remains `DESIGN ONLY`; no staging logs, alert delivery, synthetic checks, burn-in, or rollback trigger has been observed.

**Readiness claim disproved:** a monitoring plan is not operating evidence.

**Achieved-state verdict:** blocks State C.

**Repairability:** `MIXED LOCAL/EXTERNAL`. Implement durable telemetry and readiness, define SLOs and redaction, assign responders, and exercise alerts and runbooks on staging.

**Rerun trigger:** immutable staging telemetry demonstrates request, auth, DB, isolation, error, latency, saturation, and rollback signals with a successful alert drill.

### RT-1008A-011 - High - Protected dependent-system source and runtime are unreconciled

**Classification:** `PROTECTED DEPENDENCY AND EXTERNAL RUNTIME BLOCKER`

The 20 protected local hashes remain unchanged, which proves this candidate did not alter them. It does not prove compatibility or deployment parity. Independent read-only hashing on 2026-07-16 reproduced different local-versus-CDN bytes for all four shared consumers:

| Consumer | Local SHA-256 | Public CDN SHA-256 |
| --- | --- | --- |
| Arena | `2b881db56490a3fe10f950bab2e3b744a7d00960a515797c91c53b190440750a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` |
| STAT | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `77303e6352d2bffa8ec0e7ce3ec1709fa559e0b13201188b59fdca29af885425` |
| Drills | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `c480c014d405a65d6b1b4ff47e613d476383de8aba018a654375e25a07b261cc` |
| Daily | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `409a89d01f072f8412f0259ea9b870bc62800b96f30cfd5580a3b223253ec6b7` |

Which copy is authoritative remains an owner decision. No authenticated I1Q launch/return, answer secrecy, source availability, backward-compatibility, or rollback journey exists against those consumers.

**Readiness claim disproved:** unchanged protected source is not dependent-system safety.

**Achieved-state verdict:** blocks State C integration.

**Repairability:** `REQUIRES PROTECTED OWNERS`. Reconcile authority, record the chosen bytes, and run before/after/rollback contract journeys without changing protected files outside the Critical Systems process.

**Rerun trigger:** owner-approved source/runtime reconciliation and dependent consumer regression evidence are present.

### RT-1008A-012 - Medium - OpenAPI security shape is repaired, but deployed conformance is absent

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL CONFORMANCE BLOCKER`

The latest `openapi.json` replaces the placeholder OIDC URL with an explicit HTTP bearer JWT scheme describing the closed `i1q.identity.v1` contract, and the API test asserts that exact shape together with the current route surface. The earlier placeholder source finding is closed. There is still no standards-validator output, generated-client compatibility run, deployed base URL, concrete canonical adapter, or end-to-end conformance test against a persistent staging composition.

**Readiness claim disproved:** path coverage and JSON shape are not a deployment-valid API contract.

**Achieved-state verdict:** local API shape passes; State C conformance remains blocked.

**Repairability:** `REQUIRES EXTERNAL VALIDATION`, with local correction if conformance fails. Run a standards validator and client compatibility suite, then compare authenticated staging responses with the exact spec.

**Rerun trigger:** the final OpenAPI document validates with real identity metadata and staging conformance passes.

### RT-1008A-013 - Medium - Local UI repairs pass, but accessibility certification remains not run

**Classification:** `LOCAL PASS BOUNDED BY EXTERNAL HUMAN-VALIDATION BLOCKER`

The latest bytes repair the challenged local defects. `public/styles.css` now contains page-root horizontal overflow, keeps table scrolling inside `.table-wrap`, prevents pagination controls from shrinking, and preserves wrapping mobile actor/environment context. `public/app.js` renders the full source, record, privacy, revision, comparison, and release hashes without title-only disclosure. Independent execution of `node --test tests/ui.test.mjs` passes 19/19, including the requested accessibility regressions, cursor draining, and distinct expired/revoked/provider-outage recovery states.

These are local source and JSDOM/static regression results, not a human accessibility certification. No authenticated staging run covers keyboard-only use, focus order, screen reader behavior, 200%/400% zoom, reflow, contrast, touch targets, error recovery, multiple browsers, or representative reviewer workflows. The pre-repair UX packet is now stale for current-byte defect status and must not be used to negate the repairs or to claim a current pass.

**Readiness claim disproved:** repaired source and passing local regressions do not establish WCAG 2.2 AA or operational usability on a nonexistent staging service.

**Achieved-state verdict:** blocks State C accessibility and UI readiness.

**Repairability:** `REQUIRES EXTERNAL VALIDATION`. Preserve the repaired bytes, regenerate synchronized evidence, complete the current human protocol on authenticated staging, and remediate any newly observed failures.

**Rerun trigger:** authenticated staging passes the documented human/AT/browser matrix with retained evidence and zero unresolved release blockers.

### RT-1008A-014 - Medium - Authority routing is locally permitted but not closure-ready

**Classification:** `AUTHORITY/EXTERNAL OWNER BLOCKER`

MMOS authority was current and DR-006 validly permits additive local I1Q work against RANKLISTIQ under the fail-closed boundaries. No authority conflict or protected-path mutation was found. However, the canonical global identity architecture record remains missing, the I1Q identity candidate is not ratified, and mission routing still identifies the earlier I1Q-1006/1007X work rather than this immutable 1008A candidate. Medical governance remains unassigned for any student-facing state.

**Readiness claim disproved:** authorization to build locally is not authorization to claim integration, staging, production, or student release.

**Achieved-state verdict:** local internal candidate only; all release states remain blocked.

**Repairability:** `REQUIRES AUTHORITY OWNERS`. File or explicitly supersede missing authority, ratify the versioned identity/grant/rollback contracts, and route this exact immutable candidate through canonical mission records.

**Rerun trigger:** authority records resolve identity, target, grants, rollback semantics, owners, and candidate routing without conflict.

## Domain Challenge Matrix

| Domain challenged | Classification | Independent result |
| --- | --- | --- |
| Authority | Local plus owner-external | DR-006 permits local work; no achieved-state authority exists. |
| Source integrity | Local | Commit `483b0f7` is immutable; its committed evidence manifest is stale and incomplete. |
| Identity | Local pass plus external | Adapter and durable-audit failure tests pass; canonical adapter, lifecycle, ratification, wiring, and users are absent. |
| Authentication | Protected plus external | Protected expiry/secret/CORS/replay gates block reliance on shared auth. |
| RLS/grants | Local plus external | Deny-by-default local contract passes; hosted roles, actor binding, app grants, and attacks are absent. |
| API contracts | Local plus external | Path and bearer-JWT shape tests pass; standards, client, and deployed conformance do not. |
| Answer/source isolation | Local plus external | Unit policy tests pass; production resolvers and deployed attacks do not exist. |
| Migration workflow | Local pass plus external | Diff/timestamp/header gates pass locally; target authorization, diff review, approval provenance, and every workflow phase remain not run. |
| Rollback/reapply | Local plus external | Conservative local scripts exist; no operational recovery or functional reapply proof exists. |
| Deployment | External | No I1Q preview or staging deployment exists. |
| Accessibility/UI | Local pass plus external | Current repairs and UI regressions pass; human/AT/browser staging certification remains not run. |
| Performance | Local pass plus external | Cursor completeness is repaired and locally tested; persistent-stack latency, memory, concurrency, and SLO evidence remain absent. |
| Dependent systems | Protected plus external | Protected files are unchanged, but local/CDN drift and journey safety are unresolved. |
| Monitoring | Local contract plus external | Audit/readiness fail-closed contracts exist; no concrete durable telemetry, alert, runbook, or burn-in evidence. |
| Evidence integrity | Local | Exact-commit validator fails 14 checks and reports unsupported `STATE_A`; the packet is not whole-manifest bound. |

## Reproduction Commands

For exact reproduction, export commit `483b0f76f42bc3a1da674ccd4f61432aab84668b` to a clean temporary directory, make the worktree's existing `node_modules` available read-only, and run without setting secrets. Running directly in the shared worktree may include post-commit evidence changes.

```sh
npm test --prefix i1q-question-platform
npm run validate --prefix i1q-question-platform
git status --short
rg -n "createQuestionPlatformServer|new QuestionPlatform|127.0.0.1" i1q-question-platform/src/server.mjs
rg -n "repository = new MemoryRepository" i1q-question-platform/src/platform.mjs
rg -n "supabase db diff|supabase db push|migration list" .github/workflows/i1q-1008a-preview.yml
rg -n "limit=200|next_cursor|listResource" i1q-question-platform/public/app.js
rg -n "MissionMedInternalSession|bearerFormat|securitySchemes" i1q-question-platform/openapi.json
rg -n "CONFIGURED_SESSION_SECRET|readEncryptedSession|buildCorsHeaders" missionmed-hq/server.mjs
shasum -a 256 LIVE/arena.html LIVE/stat.html LIVE/drills.html LIVE/daily.html
```

Read-only dependent-runtime checks used by this review:

```sh
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html | shasum -a 256
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html | shasum -a 256
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html | shasum -a 256
curl -fsSL https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html | shasum -a 256
curl -sS -D - -o /dev/null -H 'Origin: https://red-team-invalid.example' \
  https://missionmed-hq-production.up.railway.app/api/auth/session
```

These public dependency observations do not constitute I1Q preview or staging proof.

## Explicit Rerun Gate

Red Team will rerun only after all of the following are true:

1. Commit `483b0f76f42bc3a1da674ccd4f61432aab84668b` has a synchronized, complete, passing evidence manifest with no unsupported state claim.
2. Identity, app grants, actor binding, rollback semantics, target, and approver authority are ratified.
3. Protected shared-auth findings are fixed through the Critical Systems process and runtime parity is proved.
4. The production composition uses canonical identity and a persistent datastore with durable audit and readiness.
5. The workflow implements all MR-078A checks and first passes an authorized validation run.
6. A synthetic-only preview executes apply, hosted RLS attacks, backup restore, compensation, reapply, and post-action drift checks.
7. An authenticated non-localhost staging deployment passes API, answer/source isolation, dependent-system, accessibility, performance, monitoring, alert, restart, and rollback tests.
8. Security and Release withdraw their vetoes on the exact same candidate and evidence hashes.

Until then, Red Team veto remains in force.
