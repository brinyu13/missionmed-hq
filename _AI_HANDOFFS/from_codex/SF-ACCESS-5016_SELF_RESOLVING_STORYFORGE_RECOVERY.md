# SF-ACCESS-5016 — Self-Resolving StoryForge Recovery

## 1. RESULT

**DEPLOYED — FULLY VERIFIED**

StoryForge now enforces the intended production access contract:

```text
valid authenticated identity
AND storyforge_enabled
AND (trusted active 360 entitlement OR canonical WordPress administrator)
```

The complete repair is live across the existing Kinsta WordPress SSO layer, the
Railway StoryForge API, and the isolated Railway PostgreSQL 18 database. A real
existing 360 student and a real existing canonical WordPress administrator without
LearnDash course 3893 enrollment both completed signed SSO and received HTTP 200
from `/storyforge/api/session`. Anonymous, invalid, expired, forged-admin, ordinary
non-360, and cross-student private-data paths remained fail-closed.

No rollback was invoked. Matrix, StoryForge frontend assets, LearnDash enrollment,
WordPress roles, feature flags, unrelated plugins, and unrelated services were not
changed.

## 2. Root cause

The verified downstream rejection path was:

1. The reviewed WordPress SSO repair signed a valid, unexpired canonical-admin token
   with stable `sub`, matching `wp_user_id`, `app_role=admin`,
   `wordpress_admin=true`, and `storyforge_eligible=true`.
2. `storyforge-v5/server/auth.mjs::verifyToken()` verified signature, issuer,
   audience, timestamps, token ID, subject, WordPress ID, role, admin authority, and
   eligibility.
3. `storyforge-v5/server/db.mjs::withIdentity()` installed only those verified
   claims as transaction-local PostgreSQL settings.
4. `storyforge-v5/server/app.mjs::api()`, in the `/api/session` branch, selected the
   actor's `public.sf_users` row under RLS.
5. The predecessor `public.sf_has_live_identity(text[])` from
   `20260806130000_b1_511a_wordpress_admin_authority.sql` required the stored
   `sf_users.role` to equal the signed token's base role.
6. The historical StoryForge row for the real administrator had `role=student`, but
   the canonical signed token correctly had `app_role=admin`.
7. The role comparison returned false, RLS suppressed the row, the session route saw
   zero visible rows, and it emitted HTTP 403 `eligibility_required`.

Production preflight independently reconfirmed the exact predecessor definition,
MD5 `24992aea52e2fadbf0d965d584f9709e`, before the migration.

## 3. Self-resolving blocker log

### Matrix guard drift

The unscoped all-asset guard remained blocked by the same six unrelated, pre-existing
Matrix runtime drifts. The current guard, lock manifest, protocol, and prior
Dashboard precedent documented the ticket-scoped `--brian-approved` mechanism. The
exact six-key command exited 0 before and after deployment. No seventh drift
appeared, and no Matrix byte or lock was touched.

### B1-515 mentor Pause Playwright race

Candidate commit `d35c93f4a52a4a7e81d2364a189c30bb935eb25b` reproduced the unchanged Pause assertion failure in
3/5 repetitions; untouched baseline `c25470efce1ab0d7701af98d7fea7c4b4d2508b3` reproduced the identical failure in
1/5. The product closes the current recording segment at Pause and applies its
already-recorded transcription asynchronously. The old test captured before that
request settled.

The test-only correction waits for the pause-triggered segment POST and deterministic
segment 2 before retaining the original 400 ms stability assertion. Baseline and
candidate both passed 5/5. Commit:
`84a073deac0f5dda4ba723236757dc4a0d452382`.

### B1-514 purposeful-version Playwright race

The next complete run surfaced an unrelated save/render race. The old test waited
for PATCH 200 but edited again before the application's post-response reload,
rerender, and `Purposeful version saved.` notification completed. The complete
baseline B1-514 file passed 5/5 before correction, proving no candidate product
regression.

The one-line test-only correction waits for the existing completion notification.
Five fresh-database runs passed on baseline (25/25) and candidate (25/25). Commit:
`5c6a45c6d3a5536a54c38245c863a3942377ed39`.

### Disposable restore prerequisite

The first local restore rehearsal correctly failed because a new empty PostgreSQL
sandbox did not yet contain roles `anon`, `authenticated`, and `storyforge_app`.
The same fresh production dump was restored again after pre-creating the canonical
roles; the full restore passed with 31 ledger rows, 441 users, 75 policies, and the
exact predecessor function. A second rehearsal applied the candidate and then the
prepared rollback SQL; it returned to 31 rows and the exact predecessor function.
No production write occurred during the failed rehearsal.

### Initial administrator selection

The first mapped administrator inspected was also enrolled in course 3893. No user
or enrollment was changed. A read-only scan found three mapped canonical admins,
including two not enrolled in 3893, and the decisive canary used an existing
non-enrolled canonical admin.

### Stability log classification

Two PostgreSQL `42501 administrator console is unavailable` entries appeared during
the first admin capability probes while the existing admin-console feature remained
off. They were caught fail-closed by the existing capability code and produced no
HTTP 5xx or access expansion. A later isolated real non-enrolled-admin canary at
`2026-09-08T23:43:28Z` remained HTTP 200, and the subsequent database/API log window
contained no error, fatal, panic, failed, or 5xx entries. This was not a migration
error and did not recur in the final seal window.

## 4. Final fix

Runtime implementation remains limited to two StoryForge files in the same
authorization path, plus the independently reviewed WordPress SSO candidate.

`storyforge-v5/server/app.mjs` adds
`sessionUserForIdentity(identity, profile)` for `/api/session`. The branch is entered
only when verified signed eligibility is true, signed `app_role` is `admin`, and
signed `wordpress_admin` is true. It preserves signed `sub` and WordPress ID, keeps
the actor role `admin`, and returns neutral/null cohort, academic-year, specialty,
and application-cycle fields. It does not create or substitute a student subject.

`20260908193000_sf_access_5014_canonical_admin_identity.sql` replaces only
`public.sf_has_live_identity(text[])` with:

```text
signed eligibility
AND requested effective-role match
AND (
  exact eligible stored identity + WordPress ID + stored/base-role match
  OR
  signed WordPress-admin authority
  AND signed base role = admin
  AND effective role = admin
  AND valid signed actor UUID and positive WordPress ID
)
```

The WordPress candidate reuses the canonical `manage_options` predicate and bypasses
only student/360 eligibility. It does not invent a role list or alter token
cryptography.

## 5. Candidate preservation and final code review

- Worktree: `/Users/brianb/MissionMed_worktrees/SF-ACCESS-5014`
- Branch: `codex/sf-access-5014-end-to-end-admin-access`
- Reviewed implementation commit:
  `d35c93f4a52a4a7e81d2364a189c30bb935eb25b`
- Test stabilization commits:
  `84a073deac0f5dda4ba723236757dc4a0d452382` and
  `5c6a45c6d3a5536a54c38245c863a3942377ed39`
- Pre-existing exception receipt commit:
  `a294d40afc8cce1487c0cccf7187098c70b1d7bb`
- Deployment source commit: `a294d40afc8cce1487c0cccf7187098c70b1d7bb`
- The intentionally dirty starting candidate was fingerprinted and committed without
  reset, stash, clean, reconstruction, or donor-tree use.
- `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` was never used or modified.

Implementation diff from base `c25470efce1ab0d7701af98d7fea7c4b4d2508b3` through deployment source contains 17
files, 1,201 insertions, and 1 deletion. Runtime implementation is exactly:

- `storyforge-v5/server/app.mjs`
- `storyforge-v5/infra/postgres/migrations/20260908193000_sf_access_5014_canonical_admin_identity.sql`

The reviewed WordPress runtime source is inherited byte-identically from
`c25470efce1ab0d7701af98d7fea7c4b4d2508b3`:

- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`

All other changes are tests, harness compatibility, or handoff evidence. No
StoryForge frontend, Matrix, dependency, unrelated route, or unrelated product file
changed.

## 6. Full regression results

Final verification used a clean detached worktree at exact code commit
`5c6a45c6d3a5536a54c38245c863a3942377ed39`; `a294d40afc8cce1487c0cccf7187098c70b1d7bb` adds only this ticket's
evidence receipt.

| Gate | Exact command | Result |
|---|---|---|
| Install | `npm ci` | PASS; 53 packages, 0 vulnerabilities |
| Diff | `git diff --check` | PASS |
| JS syntax | `node --check` on `server/app.mjs` and all touched `.mjs` files | PASS |
| Shell syntax | `bash -n` on all touched StoryForge shell scripts | PASS |
| PHP syntax | `php -l wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php` | PASS |
| Unit/SSO contracts | `npm test` | PASS, 503/503 |
| PostgreSQL/RLS | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:postgres` | PASS, PostgreSQL 18; 37/37 primary and 140/140 reconciliation/survival checks |
| Build/provenance/integration | `STORYFORGE_EXPECTED_COMMIT=5c6a45c6d3a5536a54c38245c863a3942377ed39 STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:integration` | PASS, 8/8; clean-source provenance, release build, and secret scan included |
| Conformance | `STORYFORGE_EXPECTED_COMMIT=5c6a45c6d3a5536a54c38245c863a3942377ed39 STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:conformance` | PASS, 72/72 |
| Full Playwright/E2E | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:e2e` | PASS, 97/97 in 6.3 minutes |
| Secret scan | `npm run scan:secrets` through canonical integration | PASS |
| Migration restore | Fresh production dump restored into disposable PostgreSQL 18.4 with canonical roles | PASS |
| Migration/rollback rehearsal | Fresh dump -> exact migration -> exact reversal SQL | PASS |

The complete Playwright suite is green. No red product result is waived. The
separate exception receipt is
`_AI_HANDOFFS/from_codex/SF-ACCESS-5016_PREEXISTING_PLAYWRIGHT_EXCEPTION.md`.

Frontend aliases and bytes remained exact:

- CSS: `03dfd2fc42f0`, full SHA-256
  `03dfd2fc42f0a80d9adf01805be094383421333e19c6fa62e4c6d9436e999409`
- logo: `f091d62ac584`, full SHA-256
  `f091d62ac5842cde0e9e455321839fd98b291598478aae6ce13b09ea3896ff56`
- app: `6bc7f9341a22`, full SHA-256
  `6bc7f9341a2232723269f00df910f00e402cbdee39e15d0b5335d82e21ce7a62`
- canonical release auth alias: `d2cfc4e447d2`

## 7. Security and RLS proof

The full suites and production canaries prove:

- signature, issuer, audience, expiry, stable identity, eligibility, and emergency
  disable checks remain intact;
- the new admin branch requires signed eligibility, `app_role=admin`, and
  `wordpress_admin=true` together;
- signed `app_role=admin` with `wordpress_admin=false` remains HTTP 403
  `eligibility_required`;
- expired token remains HTTP 401 `ERR_JWT_EXPIRED`;
- invalid token remains HTTP 401;
- anonymous remains HTTP 401 `auth_required`;
- ordinary trusted/verified but inactive non-360 remains WordPress 403
  `eligibility_required`, with no token issued;
- no non-admin mentor/staff account existed for a real safe canary; zero candidates
  were found, and none was created or changed;
- an explicit private story owned by another student returned HTTP 404 `P0002` to
  the real non-enrolled admin canary and returned no story content;
- actor and subject remain separated; the admin session kept the signed admin actor
  and did not adopt historical student cohort, academic year, specialty, or
  application cycle;
- founder student-base-role/admin-mode behavior is unchanged;
- no RLS policy changed; production policy count stayed 75;
- no table, row, identity, role, enrollment, or feature flag changed;
- no table grant was widened and no new `SECURITY DEFINER` endpoint was added;
- `storyforge_app` remains `NOBYPASSRLS`;
- the function ACL remains exactly
  `{postgres=X/postgres,authenticated=X/postgres}`, with `PUBLIC` and `anon`
  revoked.

The Supabase/PostgreSQL security workflow was applied even though the proven live
provider is Railway PostgreSQL, not Supabase: authorization was validated in direct
authorized and unauthorized database contexts, RLS remained enabled and specific,
and no generic `authenticated` widening or definer-based bypass was accepted.

## 8. Production runtime truth and predecessors

### WordPress SSO

- Provider: Kinsta
- SSH alias: `missionmed-kinsta`
- Site root: `/www/theresidencyacademy_209/public`
- Target:
  `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- Required and observed predecessor SHA-256:
  `c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`
- Predecessor: 29,340 bytes, owner/group
  `theresidencyacademy:www-data`, mode `0444`

Fresh private backup:

- path:
  `/www/theresidencyacademy_209/private/sf-access-5016/20260908T231423Z/missionmed-storyforge-sso.php.before`
- SHA-256:
  `c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`
- 29,340 bytes, owner/group `theresidencyacademy:www-data`, mode `0600`
- source mtime: `2026-09-08 19:05:34.337594722 +0000`
- PHP lint: PASS

Restore mechanism was prevalidated: create a same-directory hidden temp preserving
live owner/group/mode, copy the private predecessor bytes, lint and hash-check, and
atomically rename over the sole target.

### StoryForge API

- Provider/project: Railway `missionmed-storyforge-v5`
  (`875e7c17-d06f-4301-a4bb-e61016f153cf`)
- Environment: production
  (`bcef8734-e42b-44df-8488-c2a3de68213f`)
- Service: `storyforge-v5-api`
  (`dab015bf-15ef-4698-9f16-cbf8cf23de7a`)
- Health: `https://storyforge-v5-api-production.up.railway.app/healthz`
- Predecessor deployment: `74fc1dd0-037d-41d1-9ea5-d39a409298d8`
- Predecessor image:
  `sha256:98307f905f0f55b095898f3d685d57066d213437b7dd8f4e0502e431ba2b6bb3`
- Predecessor source and full live provenance variable:
  `f0f858f8d656683460126399923736882fe4b89e`; live `server/app.mjs` SHA-256
  `410f5145d8b900a996d9638f999aa9e5af1d0a509c1d9b8e62436d6c6b1946e8`

Fresh private source backups:

- predecessor archive:
  `/Users/brianb/MissionMed_recovery/SF-ACCESS-5016/20260908T231423Z/railway-api-predecessor-f0f858f.tar.gz`
  — SHA-256 `61500ae239580d8df3f182fb36283e171f77424dc7894bd056237e0d95dc408f`,
  2,158,700 bytes, mode `0600`;
- candidate archive:
  `/Users/brianb/MissionMed_recovery/SF-ACCESS-5016/20260908T231423Z/candidate-a294d40.tar.gz`
  — SHA-256 `ef61f54d69961dec6cca93134446ba78a6d12f79f743d2e3a96873a854cc4ecc`,
  2,161,149 bytes, mode `0600`.

Rollback is an exact standard Railway upload from the clean detached predecessor
`f0f858f8d656683460126399923736882fe4b89e`, after restoring `STORYFORGE_DEPLOY_GIT_COMMIT` to the recorded full
predecessor SHA.

### PostgreSQL

- Provider: isolated Railway PostgreSQL, not Supabase
- Service: `Postgres` (`a4a66362-c3ba-475a-ae21-2aa46624bafe`)
- Database/current user: `railway` / `postgres`
- Server: PostgreSQL 18.6, TLS true
- System identifier: `7667256745042145332`
- Predecessor ledger: 31 rows, latest
  `20260820120000_b1_517_myeras_alignment.sql`
- Protected baseline: 441 users, 102 stories, 75 public policies

Fresh logical backup:

- path:
  `/Users/brianb/MissionMed_recovery/SF-ACCESS-5016/20260908T231423Z/storyforge-production-before.dump`
- SHA-256:
  `07e43ea3a124d6b5abe6cbd60bbaf572e6e5e9965b24512495d24589d35eabae`
- 1,478,421 bytes, owner/group `brianb:staff`, mode `0600`
- source tool: PostgreSQL 18.6 `pg_dump --format=custom --no-owner --no-privileges`
- `pg_restore --list`: PASS
- full disposable restore: PASS

Exact forward rollback SQL:

- path:
  `/Users/brianb/MissionMed_recovery/SF-ACCESS-5016/20260908T231423Z/rollback-sf-has-live-identity.sql`
- SHA-256:
  `1f0951e7486faf0db4213c1cfdc56e00b85d3e597b6e2eba17db563f27885004`
- 1,658 bytes, mode `0600`
- exact candidate-definition and ledger preconditions, advisory lock, predecessor
  function restore, ACL restore, and exact ledger-row delete
- migration followed by rollback rehearsal: PASS

## 9. Deployment plan and execution

Backward-compatibility analysis selected **DB -> API -> WordPress SSO**:

1. The database predicate is backward compatible with existing student tokens. Old
   SSO still issued only the established student path, so the first step could not
   activate admin access prematurely.
2. The API admin projection is backward compatible with old SSO. After DB + API,
   existing students remained unchanged and the WordPress predecessor still blocked
   canonical-admin entry.
3. Installing SSO last activated admin token issuance only after both downstream
   layers were ready.

Deployment details:

| Layer | UTC | Mechanism | Exact result |
|---|---|---|---|
| PostgreSQL | `2026-09-08T23:21:59.625876Z` | Single transaction, advisory xact lock, exact committed migration body, exact ledger insert | ledger 32; candidate function MD5 `cf8d4371f10c775e82a2f2eb4e18f4c7`; counts 441/102; policies 75 |
| Railway API | created `2026-09-08T23:24:39.989Z` | Standard `railway deployment up storyforge-v5 --path-as-root` from clean `a294d40afc8cce1487c0cccf7187098c70b1d7bb` | deployment `3ac24043-9bf2-44a2-9890-730a65d7f464` SUCCESS; image `sha256:142d24c29f1fcfffa5cd24eb0214f7adb6dd958c496710cb075a7e94aed77b48` |
| WordPress SSO | `2026-09-08T23:29:43Z` | Private candidate -> same-directory metadata-preserving hidden temp -> PHP lint/hash assertions -> atomic rename | exact candidate SHA, 29,553 bytes, `theresidencyacademy:www-data`, `0444`, PHP lint PASS |

Postdeploy runtime hashes:

- WordPress SSO:
  `0c9f3828dce34a43754cf75b8d7f9d2456aa4f2b0677b4204d1d86d3287c4934`
- live Railway `server/app.mjs`:
  `ee4676dca602206cedc75413c7ea60dd018879c1b119d5a4ca761c941539c2fa`
- migration source:
  `d3b6ce602954ed4b10d1a2b39857559d34c7776aae30f13bc404433b40019ee3`
- live Railway provenance variable:
  `a294d40afc8cce1487c0cccf7187098c70b1d7bb`

After DB and again after API, the real 360 canary remained HTTP 200. No cache purge,
Matrix deploy, frontend release, feature-flag change, identity write, role mutation,
or enrollment mutation occurred.

## 10. Production acceptance matrix

| Canary | Result | Evidence |
|---|---|---|
| Real legitimate 360 | PASS | Existing non-admin, `wordpress_learndash_handoff` trusted/verified/active; signed subject matched; `app_role=student`; `/api/session` 200; same identity; role `student`; `no-store, private` |
| Real canonical admin without 360 | PASS | Existing mapped `manage_options` admin not enrolled in course 3893; `wordpress_admin_capability`; signed subject and WP ID matched; `app_role=admin`; `wordpress_admin=true`; `/api/session` 200; same actor; role `admin`; `no-store, private` |
| Admin actor/subject boundary | PASS | No impersonation; cohort, academic year, specialty, and application cycle all null |
| Ordinary non-360 | PASS DENY | Existing trusted/verified inactive student; WordPress 403 `eligibility_required`; no token issued |
| Mentor/staff | NOT SAFELY TESTABLE | Zero non-admin mentor/staff candidates found; no identity created or mutated |
| Anonymous | PASS DENY | HTTP 401 `auth_required` |
| Invalid token | PASS DENY | HTTP 401 |
| Expired signed token | PASS DENY | HTTP 401 `ERR_JWT_EXPIRED` |
| Signed admin role without WP-admin authority | PASS DENY | HTTP 403 `eligibility_required` |
| Cross-student private direct ID | PASS DENY | HTTP 404 `P0002`; no story content returned |
| Health | PASS | public and direct Railway `/healthz` HTTP 200, `{"ok":true,"service":"storyforge-v5"}` |
| Cache/security headers | PASS | private/no-store, CSP, noindex, nosniff, SAMEORIGIN, no-referrer preserved |

The final real 360 and non-enrolled-admin stability canaries both passed again after
deployment. The final non-enrolled-admin check at `2026-09-08T23:43:28Z` returned
HTTP 200 with matching identity and role `admin`.

## 11. Matrix scoped drift verification

The exact documented command used before and after was:

```bash
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/SF-ACCESS-5014 \
  --assets student_os_js,student_os_css,class_mmed_student_os_php,calendar_v4_js,calendar_v4_css,storyforge_js \
  --verify-public \
  --brian-approved
```

It exited 0 both times and printed `Override accepted by --brian-approved`.

| Asset | Approved lock | Pre origin/public | Post origin/public |
|---|---|---|---|
| `student_os_js` | `8e5bc1629af8d7de4c18d900ccf705307024bd3c00e90de6f008d66257c5317c` | `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a` / same | same / same |
| `student_os_css` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260` / same | same / same |
| `class_mmed_student_os_php` | `0adf5e50e7336c7987ee27fb114997244c496de64996c6d0b824d01e3fc1d9f6` | `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d` / n/a | same / n/a |
| `calendar_v4_js` | `dde1bf2697f6fc843c7aa0641217fd7bcb068b54b5f36cd3af2c078051dacd77` | `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480` / same | same / same |
| `calendar_v4_css` | `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` | `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e` / same | same / same |
| `storyforge_js` | `989c141068049eb6bf738a1404a61845d1db690dc66add165581e26bd21c2c67` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` / same | same / same |

No new/seventh drift appeared. `wp-content/plugins/missionmed-hub/**`, the manifest,
and the guard are absent from this ticket's diff. The current guard and manifest
hashes are respectively
`cdfd669962e0bf3f613b47a183ca75cb6890b62461e181bad4a0f53ee945cab2`
and `f80463b2ff43340aaf460e43f90c6383117b78e1c3e4c905daba34291ac045f2`.

## 12. Stability, immutability, and logs

- Stability window: database apply at `23:21:59Z` through final seal after
  `23:45Z` UTC, more than 24 minutes.
- Public `/storyforge/` and `/storyforge/healthz`: HTTP 200 throughout.
- Anonymous session: HTTP 401 throughout.
- Final API deployment remained `SUCCESS`; exact image and live source hashes were
  unchanged.
- Railway API HTTP logs contained zero 5xx for the deployment/stability window.
- Final API/database log interval after the isolated `23:43:28Z` admin canary had no
  new error/fatal/panic/failed entries.
- Current Kinsta debug/error log tail had no StoryForge/PHP fatal/parse/uncaught
  match.
- WordPress role snapshot stayed exactly 915 entries, SHA-256
  `da4f09f38eeb2f2a3b473605628b736951e54bafc25f7041869d36cc115c25ef`.
- LearnDash course 3893 enrollment stayed exactly 11 entries, SHA-256
  `1fac2e593ca0708f54c0c83248d3f946f100b28bfd74845fed1dff37e5e29aef`.
- Frontend aliases and bytes stayed exact as listed in Section 6.
- Matrix protected hashes stayed exact as listed in Section 11.
- The migration changed one function and added one ledger row only; users, stories,
  and policy counts stayed 441, 102, and 75.

## 13. Rollback

Rollback invoked: **NO**.

The full rollback order remains executable if a later attributable incident occurs:

1. atomically restore the exact Kinsta SSO predecessor from the fresh private copy;
2. restore the Railway provenance variable and upload the clean `f0f858f` API
   predecessor archive/source;
3. execute the rehearsed exact function/ledger reversal SQL under its advisory lock;
4. verify predecessor hashes, health, anonymous denial, real 360, and Matrix hashes.

No rollback condition occurred during the stability window.

## 14. Final production state

Live production now consists of:

- Kinsta WordPress SSO SHA-256
  `0c9f3828dce34a43754cf75b8d7f9d2456aa4f2b0677b4204d1d86d3287c4934`;
- Railway API deployment `3ac24043-9bf2-44a2-9890-730a65d7f464`, image
  `sha256:142d24c29f1fcfffa5cd24eb0214f7adb6dd958c496710cb075a7e94aed77b48`,
  source/provenance `a294d40afc8cce1487c0cccf7187098c70b1d7bb`, and live `server/app.mjs`
  SHA-256 `ee4676dca602206cedc75413c7ea60dd018879c1b119d5a4ca761c941539c2fa`;
- PostgreSQL ledger row `20260908193000` with source SHA-256
  `d3b6ce602954ed4b10d1a2b39857559d34c7776aae30f13bc404433b40019ee3`
  and function MD5 `cf8d4371f10c775e82a2f2eb4e18f4c7`.

The effective authorization state is healthy for both legitimate 360 students and
canonical WordPress administrators, while every exercised denial and private-data
boundary remains fail-closed.

## 15. Residual uncertainty

- No unrelated non-admin mentor/staff production identity existed for a safe live
  denial canary. This path remains covered by the full local unit, PostgreSQL/RLS,
  integration, and Playwright suites and was not manufactured in production.
- Production emergency disable was not toggled. Its current read-only state and
  unchanged first-gate source were verified, and the full disposable suites proved
  that disabling StoryForge denies both admin and student.
- The two initial caught admin-console-off capability errors are documented in
  Section 3. They caused no 5xx, no data disclosure, and did not recur during the
  final seal window.

No residual uncertainty affects the required real 360 or canonical-admin acceptance
contract.
