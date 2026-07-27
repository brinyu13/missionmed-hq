# TURING — Adversarial, Failure-Mode, and Rollback Review

Recorded: `2026-07-27T18:50:00Z`

Verdict: **PASS — LOCAL ADVERSARIAL AND ROLLBACK RELEASE-CANDIDATE GATES ARE GREEN**

This is not deployment authority. The authenticated production founder Matrix
journey and all provider-side post-deploy checks remain Supervisor-controlled
production gates.

## Scope and authority

- Reviewed B1-502M as a local, adversarial release-candidate exercise.
- Reverified the sole canonical StoryForge V5 product artifact at SHA-256
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- Base branch/HEAD observed:
  `b1-502-storyforge-production-deployment` /
  `e76193176e50fa0f0c329b40017c3e48b94510ef`.
- Did not edit application, infrastructure, WordPress, test, or authority
  source. The only TURING write is this report.
- Did not stage, commit, push, deploy, contact production, or mutate any
  provider or remote system.
- Local browser/database probes used disposable fixtures and were cleaned up.

## Final candidate identity

| Artifact | SHA-256 |
|---|---|
| `storyforge-v5/dist/index.html` | `e01b4565a81b0ca796e485dbda29417adc7e30c7f4dcb55144a4624a1bdcd7b6` |
| `storyforge-v5/dist/assets/app.be5fd3fe4ee9.js` | `be5fd3fe4ee9ff840d103dab448010bec5204a01748f83ba2785f839185399fd` |
| `storyforge-v5/dist/assets/auth.960289f115f2.js` | `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` |
| `storyforge-v5/dist/assets/styles.0938034a27f6.css` | `0938034a27f6a288ae621eb2c222f2d5748bb0d6f880ab58ad08af2a9414fb4e` |

The source-to-dist reconstruction was byte-identical. The dist inventory
contained only the expected application, auth, stylesheet, and font tree. All
seven WOFF2 files have valid filename/content fingerprints; the three OFL
notices are present and byte-identical between source and dist.

The critical-systems manifest contains **14/14 exact local StoryForge asset
pins**: index, app, auth, styles, seven fonts, and three licenses. TURING
independently verified every local path, SHA-256, and required marker.

## Adversarial findings repaired and retested

| Failure mode found | Final result |
|---|---|
| A stalled configuration request could leave the browser indefinitely on “Opening your story workspace…” | Bounded fetch fails to an actionable screen in about 10 seconds; Retry recovers; Back to Matrix remains available; no raw network error is exposed. |
| A missing fingerprinted asset could receive a one-year immutable 404 | Non-2xx assets are `no-store`; only successful fingerprinted assets receive immutable caching. |
| Malformed or signed-invalid bearer tokens could become internal errors | Malformed tokens return private `401`; signed identity-claim failures return private `403`; neither reaches the database as a `500`. |
| Slashless, duplicate-slash, and exact API-root paths were ambiguous | Slashless and repeated-slash paths canonicalize with `308`, queries are preserved, the exact API root is handled, and route precedence is deterministic. |
| Non-session failures could be falsely presented as “session ended” | Disabled, ineligible, revoked, session-ended, and generic startup states now use distinct truthful presentations. |
| Browser WordPress cookies could accompany API calls and the Worker could forward cookies upstream | Browser API requests use omitted credentials; the Worker forwards only its explicit allowlist and strips cookies/untrusted headers. |
| JWT identity data was under-constrained | Production verification requires `exp`, `iat`, `jti`, canonical UUID identity values, a positive safe WordPress user ID, purpose/issuer/audience, eligibility, and `HS256`. |
| Runtime authorization did not bind the WordPress ID claim into database identity | Database identity now binds WordPress ID as well as subject, role, and eligibility; mismatches fail closed for reads, RPCs, and preferences. |
| A founder with no eligible mentor assignment could submit a private story | Additive policy/state-transition gating denies submission without an active assignment; the UI disables the action and truthfully preserves private editability. |
| The production migration runner could expose role/bootstrap or partial-ledger risks | The application role is bootstrapped `NOLOGIN`, receives a SCRAM password, becomes `LOGIN` only afterward, remains non-superuser/no-BYPASSRLS/NOINHERIT, and all migrations plus ledger writes share one transaction. |
| A forced migration-ledger collision could leave partial schema state | The runner exits nonzero and rolls back schema, roles, and new ledger entries atomically; the preexisting sentinel remains the only ledger row. |
| Local integration scripts used stale/hard-coded ports and weak cookie/report handling | Dynamic-port, cookie, evidence-path, founder, cache, and cleanup paths were repaired; the final WordPress/PostgreSQL/edge integration suite is 6/6. |
| Production configuration could fail open into standalone SPA serving or a noncanonical base path | Production requires API-only origin mode and the exact `/storyforge/` base; invalid combinations fail startup. Direct Railway SPA/asset paths remain unavailable. |
| Railway deploy-root ambiguity could launch the unrelated repository-root service | The manifest pins `deploy_root: storyforge-v5`, `storyforge-v5/railway.json`, and the exact `railway up storyforge-v5 --path-as-root ...` command shape. |
| Post-build source changes repeatedly made dist and manifest pins stale | The final rebuild, source-to-dist byte comparison, exact inventory check, manifest reconciliation, and unchanged deterministic rebuild all pass. |
| Skip navigation changed routes; alert roles displaced `main`; Prep/Students skipped heading levels | The skip link retains the active route, live regions sit inside an intact main landmark, card headings use valid levels with scoped 18 px typography, and the focused axe/browser regressions pass. |
| External font loading and heading promotion created privacy, integrity, and density risks | Fonts are self-hosted with fingerprint validation and OFL notices; Worker caching distinguishes fingerprinted fonts from license text; Interview Prep remains readable without overflow. |

No open local product, authorization, routing, cache, rollback, or
accessibility defect remains from this review.

## Final verification matrix

| Gate | Result |
|---|---|
| Unit suite | **23/23 PASS** |
| Real PostgreSQL authorization suite | **PASS** — `STORYFORGE_POSTGRES_SUITE_PASS` |
| Browser/E2E suite | **7/7 PASS** |
| WordPress/PostgreSQL/edge integration | **6/6 PASS**, including self-hosted-font checks |
| Critical-systems local asset gate | **14/14 PASS** |
| Deterministic build and exact dist inventory | **PASS** |
| Wrangler dry-run asset inventory | **PASS** — exact candidate asset set |
| Bundle secret scan | **PASS** |
| `npm audit --audit-level=high` | **0 vulnerabilities** |
| JavaScript, PHP, Bash, and JSON syntax | **PASS** |
| `git diff --check` | **PASS** |
| Canonical V5 authority hash | **PASS** |
| Immutable B1-500 foundation migration | **PASS**, SHA-256 `93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f` |
| Protected `missionmed-hub`, `LIVE/`, `missionmed-hq/`, and root `supabase/` scope | **UNCHANGED** |

The PostgreSQL matrix includes direct-ID privacy, self/other students,
assigned/unassigned mentors, administrator and anonymous access, revoked
eligibility, mismatched WordPress identity, owner-bound background preference,
zero-assignment submission denial, immutable revision/lifecycle behavior,
audit events, imports, and notification/state-transition coupling.

The browser and edge matrices include eligible and ineligible entry, stale,
expired, revoked, and malformed identity; deep-link refresh; startup failure;
no infinite opening state; route precedence; exact API-root behavior;
fingerprinted success/missing-asset cache policy; compact mobile navigation;
full axe checks; reduced motion; and Back to Matrix escape paths.

## Rollback and interrupted-deploy result

The local rollback receipt is:

`_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/local-integration/rollback-local-verification.txt`

Verified stages:

1. Default-off WordPress shortcodes render no StoryForge launch.
2. Turning the feature flag off returns `storyforge_disabled`.
3. Removing the StoryForge Worker route makes the isolated route unavailable.
4. Deactivating only the StoryForge SSO plugin forces the feature flag off.
5. The legacy Matrix StoryForge fallback and protected Matrix assets remain
   untouched.
6. The isolated database can remain dormant on ordinary rollback; restore is
   reserved for corruption.
7. A deliberately interrupted/failed migration-ledger transaction left no
   partial StoryForge schema or role mutation.
8. Missing or mismatched fingerprinted assets do not become sticky cache
   failures, allowing a corrected asset deployment to recover safely.

The rollback ordering is therefore independently coherent: disable founder
entry first, remove only the two StoryForge edge routes if needed, deactivate
only the isolated SSO plugin if needed, and preserve the isolated database
unless a verified database restore is required.

## Release hygiene and production-pending gates

The following generated local paths were still present at TURING closeout and
must be removed or explicitly excluded before staging:

- `.wrangler/`
- `_SYSTEM/tools/__pycache__/`
- `storyforge-v5/playwright-integration-report/`

They are tool output, not release source or evidence.

Before any production claim, the Supervisor must still complete the approved
provider sequence and verify the real founder journey: exact WordPress founder
identity, no second login, founder-only visibility, deep-link refresh,
logout/revocation, Back to Matrix session continuity, production hashes/cache
headers, unrelated-route non-regression, backups/restore points, and final
feature-off rollback readiness.

Final TURING disposition: **PASS for the local adversarial release candidate;
production remains unclaimed and founder-gated.**
