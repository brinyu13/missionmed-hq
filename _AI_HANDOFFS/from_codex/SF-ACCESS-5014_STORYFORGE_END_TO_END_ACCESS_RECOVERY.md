# SF-ACCESS-5014 — StoryForge End-to-End Access Recovery

## 1. RESULT

**BLOCKED — NOT DEPLOYED**

The downstream rejection was proven and a two-runtime-file candidate was built and
focused-tested locally. Production deployment was not attempted because the mandatory
Matrix runtime safety preflight returned `BLOCKED` before the full regression/deploy
gates. This ticket authorized no Matrix override, and its zero-blast-radius contract
requires a hard stop on any safety-gate failure.

No SF-ACCESS-5014 production write occurred. Production remained on the verified SSO
predecessor SHA-256
`c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`.

## 2. Root cause

The exact rejecting application path is
`storyforge-v5/server/app.mjs`, function `api()`, `/api/session` branch at the
base revision's lines 1363–1383. It selects the signed subject from `public.sf_users`
under the authenticated RLS context. A zero-row result is mapped directly to
`eligibility_required` and HTTP 403.

The exact database predicate producing that zero-row result is
`storyforge-v5/infra/postgres/migrations/20260806130000_b1_511a_wordpress_admin_authority.sql`,
`public.sf_has_live_identity(text[])`, lines 52–69. It requires all of:

- the row UUID to match the signed `sub`;
- the row WordPress ID to match the signed `wp_user_id`;
- the row to be eligible;
- the signed eligibility claim to be true; and
- `sf_users.role` to equal the signed token's base `app_role`.

Fresh read-only production evidence showed that the real failing canonical WordPress
administrator has a stable mapped `sf_users` row, but that historical row has role
`student` while the repaired WordPress SSO correctly signs `app_role=admin`. The final
role-equality predicate is therefore false. `sf_has_live_identity()` returns false,
the `sf_users_read` policy suppresses the row, and `/api/session` emits the observed
403. This proves the cause independently of the error name.

The other mapped administrator identities were checked by one-way subject hashes only;
no token, credential, or PII was retained.

## 3. Before authorization flow

1. WordPress verifies the current account and canonical `manage_options` privilege.
2. The reviewed SSO candidate signs an unexpired JWT with stable `sub`, matching
   `wp_user_id`, `app_role=admin`, `wordpress_admin=true`, and
   `storyforge_eligible=true`.
3. `server/auth.mjs::verifyToken()` verifies signature, issuer, audience, expiry,
   token ID, UUID subject, WordPress ID, role allowlist, and eligibility.
4. `server/db.mjs::withIdentity()` sets transaction-local authenticated claims,
   including the verified WordPress-admin boolean.
5. `/api/session` selects the actor's `sf_users` row.
6. RLS calls `sf_has_live_identity()`.
7. The signed role `admin` does not equal the historical row role `student`, so the
   live-identity predicate is false and RLS returns zero rows.
8. `/api/session` maps the missing visible row to HTTP 403
   `eligibility_required` before capability resolution.

## 4. After authorization flow

The local candidate composes the two already-authoritative paths:

`signed eligibility AND (matching eligible profile identity OR signed canonical
WordPress admin with app_role=admin)`.

`server/app.mjs::sessionUserForIdentity()` then preserves a verified canonical admin
as the same signed admin actor. It never adopts the historical student role, cohort,
academic data, or student subject. When no profile exists, it returns only a bounded,
non-persisted admin session projection sourced from verified token claims and neutral
preference defaults.

The local end-to-end route result for the production-shaped role mismatch changed from
HTTP 403 `eligibility_required` to HTTP 200 with the same signed subject and
WordPress ID, `role=admin`, `wordpress_admin=true`, and `cohort=null`.

## 5. Authority model

Canonical administrator authority is not inferred from a role name supplied by the
browser. It is the exact `wordpress_admin=true` boolean produced by WordPress's
canonical `manage_options` predicate, carried inside a signature-verified, unexpired
StoryForge token. The application alone installs those claims as transaction-local
database settings.

The candidate requires all three admin facts simultaneously:

- signed `storyforge_eligible=true` (the existing StoryForge-enabled boundary);
- signed `app_role=admin`; and
- signed `wordpress_admin=true`.

An ordinary student, mentor/staff identity, generic authenticated user, forged admin
role, expired token, invalid token, or globally disabled eligibility cannot enter the
admin branch. Existing feature-level flags, admin-console allowlists, actor/subject
mode, population scope, and RLS policies are unchanged.

## 6. Files changed

### Runtime implementation

- `storyforge-v5/server/app.mjs`
- `storyforge-v5/infra/postgres/migrations/20260908193000_sf_access_5014_canonical_admin_identity.sql`

The migration replaces only `public.sf_has_live_identity(text[])`; it changes no
table, row, role, grant surface, or RLS policy.

### Tests/harnesses

- `storyforge-v5/tests/e2e/sf-access-5014-admin-access.spec.mjs`
- `storyforge-v5/tests/postgres/sf-access-5014-canonical-admin-authority.test.mjs`
- `storyforge-v5/tests/unit/runtime-contracts.test.mjs`
- `storyforge-v5/tests/integration/storyforge-sso.spec.mjs`
- `storyforge-v5/tests/postgres/helpers/ephemeral-postgres.mjs`
- `storyforge-v5/scripts/run-e2e.sh`
- `storyforge-v5/scripts/run-integration.sh`
- `storyforge-v5/scripts/run-conformance.sh`
- `storyforge-v5/scripts/run-local.sh`
- `storyforge-v5/scripts/run-postgres-tests.sh`

### Generated artifacts not deployed

- Local `node_modules` installed by `npm ci` (ignored dependency workspace).
- Disposable PostgreSQL clusters and Playwright output under temporary/test paths.
- This report.

## 7. Local/disposable reproduction

PostgreSQL 18.4 was selected explicitly with
`STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin`.

Before the runtime fix, the new production-shaped Playwright case used an existing
eligible student-profile UUID/WordPress mapping but signed it exactly as a canonical
administrator. Result:

- legitimate fixture 360 path: existing baseline remained available;
- canonical admin over historical student profile: HTTP 403
  `eligibility_required` — PASS reproduction;
- no production identity or row was created or mutated.

After the fix, the same case and negative matrix produced:

- mapped canonical admin over historical student profile: HTTP 200, admin actor;
- canonical admin without a profile: HTTP 200, bounded admin projection;
- ordinary non-360/unmapped student: HTTP 403;
- `app_role=admin` without signed WordPress-admin authority: HTTP 403;
- StoryForge eligibility disabled: HTTP 403;
- expired token: HTTP 401;
- invalid token: HTTP 401;
- anonymous: HTTP 401.

Targeted after-fix command:

```bash
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin \
  npm run test:e2e -- tests/e2e/sf-access-5014-admin-access.spec.mjs
```

Result: **3/3 PASS**.

## 8. Full test suite

| Area | Command | Result |
|---|---|---|
| Targeted admin route | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:e2e -- tests/e2e/sf-access-5014-admin-access.spec.mjs` | PASS, 3/3 after fix; predecessor reproduction separately PASS, 1/1 returning the expected 403 |
| Targeted PostgreSQL authority | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin node --test tests/postgres/sf-access-5014-canonical-admin-authority.test.mjs tests/postgres/b1-511a-wordpress-admin-authority.test.mjs` | PASS, 2/2 |
| Unit + SSO contract suite | `npm test` | PASS, 503/503 |
| Full PostgreSQL/RLS | `npm run test:postgres` | NOT RUN — hard-stop safety gate had failed |
| Production build/provenance | `npm run build:release` / provenance checks | NOT RUN — hard stop |
| Disposable WordPress integration | `npm run test:integration` | NOT RUN — hard stop |
| Full Playwright | `npm run test:e2e` | NOT RUN — hard stop |
| Secret scan | `npm run scan:secrets` | NOT RUN — hard stop |
| PHP/shell syntax | applicable lint commands | NOT RUN after final candidate — hard stop |
| Diff check | `git diff --check` | NOT RUN after final candidate — hard stop |

Because the mandatory full suites were not completed, the candidate is not eligible
for commit or production deployment.

## 9. RLS/data-security proof

The focused PostgreSQL 18 test exercised the current migration chain and proved:

- canonical admin live identity: true;
- canonical admin role restriction: true only for `admin`, false for `student`;
- only the actor's own `sf_users` row visible while admin-console population access
  remains disabled;
- an explicit private story owned by another student remains invisible;
- removing the signed WordPress-admin boolean denies the new branch;
- disabling signed StoryForge eligibility denies the new branch;
- an unrelated mentor identity receives no new authority.

No RLS policy or table grant was changed. The Supabase/PostgreSQL safety guidance was
followed by retaining least privilege and avoiding generic `authenticated` widening or
a `SECURITY DEFINER` bypass endpoint.

## 10. Actor/subject proof

For the production-shaped historical profile mismatch, the post-fix session returned:

- `user.id` equal to the JWT `sub`;
- `user.wp_user_id` equal to the JWT WordPress ID;
- `user.role=admin`;
- `user.wordpress_admin=true`;
- `cohort`, `academic_year`, `specialty`, and `application_cycle` all null.

The existing founder dual-access model remains separate: a signed student base role
with WordPress-admin authority remains a student until the server selects bounded
`adminMode`; the new canonical-admin branch requires base `app_role=admin`. No student
impersonation or role mutation occurs.

## 11. Blast-radius proof

Intended runtime scope is exactly two files in one authorization path: the API session
projection and the central database live-identity predicate. No frontend, Matrix,
LearnDash, WordPress role, enrollment, plugin, dependency version, unrelated route,
feature flag, or private-data policy was changed.

The Matrix runtime safety preflight command was:

```bash
python3 _SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/SF-ACCESS-5014 \
  --assets all --verify-public
```

Result: **BLOCKED**. The c254-based worktree contains none of the protected
`wp-content/plugins/missionmed-hub` sources, as required by this ticket's do-not-touch
boundary. Independently, the guard reported approved-lock drift for production
`student_os_js`, `student_os_css`, `class_mmed_student_os_php`, `calendar_v4_js`,
`calendar_v4_css`, and `storyforge_js`; several origin/public hashes differ from the
approved manifest. No attempt was made to repair, copy, deploy, or override those
assets.

## 12. Git state

- Worktree: `/Users/brianb/MissionMed_worktrees/SF-ACCESS-5014`
- Branch: `codex/sf-access-5014-end-to-end-admin-access`
- Base HEAD: `c25470efce1ab0d7701af98d7fea7c4b4d2508b3`
- Starting status: clean
- Final status: intentionally dirty with the uncommitted candidate/tests/report
- Implementation commit: none; Phase 7 was not reached after the hard stop
- Runtime hashes: not promoted or recorded as deployable because full gates did not run
- Reviewed WordPress SSO candidate remained unchanged at
  `0c9f3828dce34a43754cf75b8d7f9d2456aa4f2b0677b4204d1d86d3287c4934`

`/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` was not modified, cleaned,
reset, stashed, staged, or used as a deployment source.

## 13. Production predecessors

No SF-ACCESS-5014 production predecessor backup was captured because the safety gate
failed before Phase 8 and before any production write was permissible.

Fresh read-only Phase 0 verification confirmed the live SSO file at:

`/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`

with SHA-256
`c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`.

The prior SF-ACCESS-5012 backup remains historical evidence only and was not treated
as the fresh backup required for a new deployment.

## 14. Deployment

- Exact targets: none
- UTC deployment time: none
- Mechanism: none
- Postdeploy SHAs: not applicable
- Metadata: not applicable

No Railway deployment, database migration, Kinsta replacement, cache purge, service
restart, flag mutation, role mutation, or enrollment mutation occurred.

## 15. Production canary matrix

| Canary | Result |
|---|---|
| Baseline `/storyforge/` | PASS, HTTP 200 before local work |
| Baseline `/storyforge/healthz` | PASS, HTTP 200 with StoryForge service payload |
| Baseline anonymous `/storyforge/api/session` | PASS fail-closed, HTTP 401 `auth_required` |
| Baseline live SSO predecessor | PASS exact required SHA |
| Current real 360 | Previously healthy in SF-ACCESS-5012; no postdeploy canary because nothing deployed |
| Real canonical admin | NOT RUN after candidate; candidate not deployed |
| Ordinary non-360 | NOT RUN in production after candidate; candidate not deployed |
| Mentor/staff | NOT RUN in production after candidate; candidate not deployed |
| Identity/actor-subject | Locally PASS only |
| Private-data boundary | Locally PASS only |
| Logs | No postdeploy window; nothing deployed |
| Frontend immutability | No frontend deployment occurred |
| Matrix unchanged by ticket | PASS: no Matrix write; independent lock drift remains the blocker |

## 16. Rollback

Rollback invoked: **NO**. There was no SF-ACCESS-5014 production change to roll back.

The final live SSO SHA remained the predecessor:
`c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`.

## 17. Final production state

Exactly the pre-ticket production state remains live. The reviewed WordPress SSO
candidate is not live. The SF-ACCESS-5014 API and database candidates are not live.
Baseline StoryForge and health routes were healthy, anonymous access was fail-closed,
and no production system was mutated by this ticket.

## 18. Residual uncertainty

- The Matrix protected-runtime manifest drift must be reconciled by its owning ticket,
  or Brian must explicitly approve the exact SF-ACCESS-5014 Matrix override phrase,
  before this blocked production path can resume safely.
- Full PostgreSQL/RLS, integration, full Playwright, release build/provenance, secret,
  final syntax, and final diff gates remain unexecuted after the hard stop.
- No fresh SF-ACCESS-5014 API deployment artifact/rollback identifier, PostgreSQL
  backup, or migration runner receipt exists.
- Real production 360 and canonical-admin acceptance for this candidate remains
  unproven because deployment was correctly not attempted.

The correct next action is to resolve the Matrix lock baseline outside this ticket,
then resume this same worktree at the safety preflight. Do not deploy the local
candidate directly and do not copy protected Matrix sources into this worktree.
