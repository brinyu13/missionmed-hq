# SF-ACCESS-5015 — StoryForge Resume With Scoped Matrix Drift Authorization

## 1. RESULT

**BLOCKED — NOT DEPLOYED**

SF-ACCESS-5015 successfully resolved the prior Matrix guard block through the
existing documented, six-asset `--brian-approved` preflight mechanism. The preserved
SF-ACCESS-5014 candidate was reviewed, minimally corrected to satisfy the locked
migration-header contract, fully committed, and passed the unit, complete PostgreSQL
18/RLS, release/provenance, disposable WordPress integration, conformance, secret,
syntax, and targeted authorization gates.

The mandatory full Playwright suite did not pass. One untouched B1-515 mentor-voice
timing test failed because a second deterministic transcript segment arrived after
Pause. The result was reproduced in an isolated rerun, so concurrent conformance load
cannot explain it. The complete run finished with 94 passed, 1 failed, and 2 not run;
the isolated three-test file finished with 1 failed and 2 not run.

The ticket requires a hard stop on any unexplained full-suite failure. No production
predecessor capture, database migration, Railway deployment, WordPress SSO deployment,
cache action, or production identity/data mutation was performed. No rollback was
needed.

Fresh closeout verification found production healthy and unchanged:

- live WordPress SSO SHA-256:
  `c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`;
- `/storyforge/`: HTTP 200;
- `/storyforge/healthz`: HTTP 200 with `{"ok":true,"service":"storyforge-v5"}`;
- anonymous `/storyforge/api/session`: HTTP 401 `auth_required`;
- frontend aliases remained CSS `03dfd2fc42f0`, app `6bc7f9341a22`, and logo
  `f091d62ac584`.

Real 360 and canonical-administrator production acceptance were not run because no
candidate runtime was deployed. The final production state is exactly the known-good
pre-ticket state.

## 2. Matrix drift authorization

### Documented mechanism

The current canonical guard, manifest, and protocol were read from
`/Users/brianb/MissionMed/_SYSTEM`. They are byte-identical to the worktree copies:

- `matrix_runtime_guard.py`:
  `cdfd669962e0bf3f613b47a183ca75cb6890b62461e181bad4a0f53ee945cab2`;
- `MATRIX_RUNTIME_LOCK_MANIFEST.json`:
  `f80463b2ff43340aaf460e43f90c6383117b78e1c3e4c905daba34291ac045f2`;
- `MATRIX_RUNTIME_LOCK_PROTOCOL.md`:
  `52552ac452aff1db7bb23cccf8a0d219802475c7813b71a72f729798592d1a3a`.

The guard's supported bounded mechanism is:

```bash
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/SF-ACCESS-5014 \
  --assets <exact-comma-separated-asset-keys> \
  --verify-public \
  --brian-approved
```

The manifest requires the human statement, “Brian explicitly approves Matrix runtime
lock override for `<ticket>` and `<asset keys>`.” The SF-ACCESS-5015 prompt supplied
equivalent explicit ticket-scoped authorization and named the exact six keys. The
guard itself implements the authorization through `--brian-approved`; it has no
ticket argument for preflight and no broader waiver state. The prior
MX-DASH-6010B closeout documents the same exact six-key drift set.

The command actually accepted was:

```bash
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/SF-ACCESS-5014 \
  --assets student_os_js,student_os_css,class_mmed_student_os_php,calendar_v4_js,calendar_v4_css,storyforge_js \
  --verify-public \
  --brian-approved
```

It exited 0 and printed `Override accepted by --brian-approved` for only those keys.
No guarded-deploy command was invoked.

### Authorized pre-existing drift: pre and closeout hashes

| Asset | Approved lock | Pre origin/public | Closeout origin/public |
|---|---|---|---|
| `student_os_js` | `8e5bc1629af8d7de4c18d900ccf705307024bd3c00e90de6f008d66257c5317c` | `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a` / same | same / same |
| `student_os_css` | `111942c48eb8fd5dbe4132f17b4a6df89eb6a30044b1cb076db190c0da794a33` | `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260` / same | same / same |
| `class_mmed_student_os_php` | `0adf5e50e7336c7987ee27fb114997244c496de64996c6d0b824d01e3fc1d9f6` | `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d` / n/a | same / n/a |
| `calendar_v4_js` | `dde1bf2697f6fc843c7aa0641217fd7bcb068b54b5f36cd3af2c078051dacd77` | `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480` / same | same / same |
| `calendar_v4_css` | `41b3a29530f23253827a707433e36fe48a121cd63aa39ed8433bef42e12ba385` | `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e` / same | same / same |
| `storyforge_js` | `989c141068049eb6bf738a1404a61845d1db690dc66add165581e26bd21c2c67` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` / same | same / same |

### No seventh drift

An all-asset precheck and an all-asset closeout check observed the same four
non-authorized assets at their approved hashes:

- `scheduler_mount_js`:
  `2a47b847c52ed53dbffe51bef85c45efb2eecabe9246b821bce8b54f218e7578`;
- `file_vault_js`:
  `f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd`;
- `file_vault_css`:
  `6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990`;
- `storyforge_css`:
  `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`.

The all-asset guard still exits 42 because this intentionally source-minimal worktree
contains no `missionmed-hub` protected source and because the six production hashes
differ from the stale approved manifest. No new production drift appeared.

### Proof this ticket did not touch Matrix

`git diff c25470efce1ab0d7701af98d7fea7c4b4d2508b3..d35c93f4a52a4a7e81d2364a189c30bb935eb25b`
is empty for:

- `wp-content/plugins/missionmed-hub/**`;
- `_SYSTEM/tools/matrix_runtime_guard.py`;
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`.

No Matrix source was copied into the worktree. No Matrix asset, lock, manifest, guard,
runtime, or cache was modified, staged, uploaded, restored, or refreshed. Pre and
closeout protected production fingerprints are byte-identical.

## 3. Root cause

The proven rejection path is unchanged from SF-ACCESS-5014:

1. The reviewed WordPress SSO candidate signs a valid, unexpired token with stable
   `sub`, matching `wp_user_id`, `app_role=admin`, `wordpress_admin=true`, and
   `storyforge_eligible=true` for the canonical `manage_options` administrator.
2. `storyforge-v5/server/auth.mjs::verifyToken()` validates cryptography, issuer,
   audience, expiry, token ID, subject, WordPress ID, role, and eligibility.
3. `storyforge-v5/server/db.mjs::withIdentity()` installs only those verified claims
   as transaction-local PostgreSQL settings.
4. `/api/session` in `storyforge-v5/server/app.mjs` selects the actor's
   `public.sf_users` row under RLS.
5. The predecessor `public.sf_has_live_identity(text[])` from
   `20260806130000_b1_511a_wordpress_admin_authority.sql` requires
   `sf_users.role = sf_actor_base_role()`.
6. The real administrator's historical StoryForge row has `role=student`, while the
   signed canonical token correctly has `app_role=admin`.
7. The role comparison fails, RLS suppresses the row, `/api/session` receives zero
   rows, and maps that result to HTTP 403 `eligibility_required`.

## 4. Final fix

The committed candidate changes exactly two runtime files in the same authorization
path.

### Application

`storyforge-v5/server/app.mjs` adds
`sessionUserForIdentity(identity, profile)` and applies it only to `/api/session`.
The canonical-admin branch requires all of:

- verified signed eligibility (`identity.eligible === true`);
- verified signed base role `admin`;
- verified signed `wordpressAdmin === true`.

It preserves the signed `sub` and WordPress ID, returns role `admin`, and sets student
profile fields (`cohort`, `academic_year`, `specialty`, `application_cycle`) to null.
It does not persist a profile, mutate a role, or select a student subject.

### Database predicate

`storyforge-v5/infra/postgres/migrations/20260908193000_sf_access_5014_canonical_admin_identity.sql`
uses `CREATE OR REPLACE` on only `public.sf_has_live_identity(text[])`.

The effective predicate is:

```text
sf_actor_eligible()
AND requested effective role matches
AND (
  exact eligible stored identity + WordPress ID + stored/base-role match
  OR
  sf_actor_wordpress_admin()
  AND sf_actor_base_role() = 'admin'
  AND sf_actor_role() = 'admin'
  AND signed actor UUID is non-null
  AND signed WordPress ID is positive
)
```

No RLS policy, table, row, identity, role, enrollment, table grant, generic
`authenticated` access, or new function endpoint is added. The migration preserves
the predecessor function's existing `SECURITY DEFINER`, fixed search path, revocation
from `PUBLIC`/`anon`, and bounded `authenticated` execute grant.

The only SF-ACCESS-5015 adjustment to the preserved candidate was adding the exact
locked migration header (`Migration`, `Authority`, `Date`, `Depends on`,
`Description`, `Idempotent`). The SQL body was not broadened.

Final runtime SHA-256 values:

- reviewed WordPress SSO candidate, unchanged:
  `0c9f3828dce34a43754cf75b8d7f9d2456aa4f2b0677b4204d1d86d3287c4934`;
- `storyforge-v5/server/app.mjs`:
  `ee4676dca602206cedc75413c7ea60dd018879c1b119d5a4ca761c941539c2fa`;
- `20260908193000_sf_access_5014_canonical_admin_identity.sql`:
  `d3b6ce602954ed4b10d1a2b39857559d34c7776aae30f13bc404433b40019ee3`.

## 5. Candidate preservation

Starting worktree state was exactly the instructed preserved state:

- worktree: `/Users/brianb/MissionMed_worktrees/SF-ACCESS-5014`;
- branch: `codex/sf-access-5014-end-to-end-admin-access`;
- HEAD: `c25470efce1ab0d7701af98d7fea7c4b4d2508b3`;
- status: nine modified tracked files and four untracked candidate/report files;
- no unrelated user changes were found;
- `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` was never used or
  modified.

The starting candidate fingerprints were recorded before any change:

| File | Starting SHA-256 |
|---|---|
| SF-ACCESS-5014 report | `c3ceeeb683bbfcf6553fd359c4d2f7c91735f1a0ae942cfafbf802a02ac6593e` |
| 5014 migration | `2c735dfe32fa82577306c173b69b39b59fb763c77a24bb161dd3b709d5f32d21` |
| `scripts/run-conformance.sh` | `6a1ad9bd65bcf32bdffd2a738a45f53d99c72dc136acd8065f16c865959a28e8` |
| `scripts/run-e2e.sh` | `b1705bb96dd91b2aa760203ecda82b70003b5dcdb85f371162043faa0c0e70b5` |
| `scripts/run-integration.sh` | `092a1b0235140e9397bce05a5a88eadd5966507901724bb9b287be2376eab9b5` |
| `scripts/run-local.sh` | `04ad8f8cb531517929e0197a0e4c45bc58df36f2cc3d045b603f8e06d8ff3e21` |
| `scripts/run-postgres-tests.sh` | `1aad48e4e227d975e75188819284753557f426bbe37ac3592ea84e0d8b0d2091` |
| `server/app.mjs` | `ee4676dca602206cedc75413c7ea60dd018879c1b119d5a4ca761c941539c2fa` |
| 5014 E2E test | `0c3bf09692a6c32582de4a81fcc4e6ee00c3456c20db8fa42f82637a16fa9e5b` |
| integration test | `c2c016a2836bae961b117ce400ac43634e03b8b07bc4edea3932b3aa29ed1b5a` |
| ephemeral PostgreSQL helper | `8dcf5de10fa816eaa8b6a0188804f4fa2428251611f89160f0d975cc9fc3d8b3` |
| 5014 PostgreSQL test | `d2b8e44cca8950377a179df01135c1799b03f1561cab2cd4f851e8bdc8d46149` |
| unit contract test | `b701877a1f319d1705acd588cc3b0101e991de55c968fdbbb0da0b9d8b13b1e6` |

Nothing was discarded, reset, stashed, cleaned, overwritten, or regenerated from
another worktree. The preserved candidate was committed directly after the required
header correction and green pre-commit gates.

## 6. Full regression results

| Gate | Exact command | Result |
|---|---|---|
| Diff whitespace | `git diff --check` | PASS |
| JS syntax | `node --check` on `server/app.mjs` and every touched `.mjs` test/helper | PASS |
| Shell syntax | `bash -n scripts/run-conformance.sh scripts/run-e2e.sh scripts/run-integration.sh scripts/run-local.sh scripts/run-postgres-tests.sh` | PASS |
| PHP syntax | `php -l wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php` | PASS |
| Unit + WordPress SSO contracts | `npm test` | PASS, 503/503 |
| Full PostgreSQL 18/RLS | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:postgres` | PASS, PostgreSQL 18.4; 37/37 primary including 5014 authority; reconciliation/survival sub-suite exited 0 with all checks green |
| Release build/provenance | `STORYFORGE_EXPECTED_COMMIT=d35c93f4a52a4a7e81d2364a189c30bb935eb25b npm run build:release` (invoked canonically by integration) | PASS; exact clean commit, canonical authority SHA, 15-file release and WordPress route manifest verified |
| Secret scan | `npm run scan:secrets` (invoked by integration) | PASS, `{"ok":true,"scanned":"dist"}` |
| Disposable WordPress integration | `STORYFORGE_EXPECTED_COMMIT=d35c93f4a52a4a7e81d2364a189c30bb935eb25b STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:integration` | PASS, 8/8; canonical admin token/session 200 included |
| Product conformance | `STORYFORGE_EXPECTED_COMMIT=d35c93f4a52a4a7e81d2364a189c30bb935eb25b STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:conformance` | PASS, 72/72 desktop/tablet/mobile/accessibility checks |
| Full Playwright/E2E | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:e2e` | **FAIL**, 94 passed, 1 failed, 2 not run; all three SF-ACCESS-5014 tests passed |
| Failed-file isolation | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:e2e -- tests/e2e/b1-515-fast-voice-repair.spec.mjs` | **FAIL**, same first test; 1 failed, 2 not run |

The exact failure is
`tests/e2e/b1-515-fast-voice-repair.spec.mjs:135`. After Pause, the test captures
`"Deterministic near-live transcript segment 1."`, waits 400 ms, and expects the
textarea to remain unchanged. It instead receives segment 2 during the pause window:

```text
Expected: "Deterministic near-live transcript segment 1."
Received: "Deterministic near-live transcript segment 1. Deterministic near-live transcript segment 2."
```

Neither the test nor its mentor/audio frontend/runtime was changed by this ticket.
That limits attribution, but it does not convert the mandatory red gate into a pass.
No third retry or unrelated voice repair was attempted.

Frontend build aliases remained unchanged:

- CSS: `03dfd2fc42f0`;
- app: `6bc7f9341a22`;
- logo: `f091d62ac584`;
- auth: `d2cfc4e447d2` in the canonical release build.

The SF-ACCESS-5012 shorthand labeled `f091d62ac584` as auth, but current canonical
build evidence identifies it as the logo and identifies auth as `d2cfc4e447d2`.
No frontend source or output changed in the implementation commit.

## 7. Security/RLS proof

The passing unit, PostgreSQL, targeted E2E, integration, and conformance gates prove:

- canonical admin admission requires a valid signed token, active signed StoryForge
  eligibility, signed `app_role=admin`, and signed `wordpress_admin=true`;
- an ordinary student cannot enter the admin branch;
- a mentor/staff identity cannot enter through a role name;
- `app_role=admin` without signed WordPress-admin authority is denied;
- invalid and expired tokens are denied;
- anonymous access is denied;
- disabling signed StoryForge eligibility denies both the mapped and profileless
  canonical-admin fixtures;
- the browser cannot manufacture the trusted admin boolean because it is consumed
  only after server-side JWT verification;
- the historical student profile is not adopted into the admin session: the same
  signed actor remains `admin`, and cohort/academic/specialty/application-cycle are
  null;
- founder student-base-role dual access remains on its existing bounded admin-mode
  path and is not converted to base-role admin;
- an explicit private story owned by another student remains invisible to the new
  base-role-admin branch while admin-console population authority is off;
- no RLS policy or table grant was widened;
- no generic `authenticated` policy was added;
- no new `SECURITY DEFINER` endpoint was added;
- no table, identity, role, enrollment, or production row was modified.

The Supabase security guidance was applied by retaining row authorization, testing
authorized and unauthorized PostgreSQL contexts directly, and refusing generic
`authenticated` widening or a new definer-based bypass. The migration only replaces
the central existing predicate, preserves its revoked/public execution surface, and
was validated against PostgreSQL 18.4.

Because the unrelated full Playwright gate remains red, these successful security
checks are insufficient to authorize production deployment.

## 8. Implementation commit

- Branch: `codex/sf-access-5014-end-to-end-admin-access`
- Implementation commit:
  `d35c93f4a52a4a7e81d2364a189c30bb935eb25b`
- Commit message: `SF-ACCESS-5014: repair downstream canonical admin session`
- Diff from base: 13 files, 716 insertions, 1 deletion
- Runtime implementation files: 2
- Reviewed WordPress SSO candidate: inherited unchanged from base commit
  `c25470efce1ab0d7701af98d7fea7c4b4d2508b3`
- Working tree after implementation commit and before this report: clean

Runtime implementation:

- `storyforge-v5/server/app.mjs`
- `storyforge-v5/infra/postgres/migrations/20260908193000_sf_access_5014_canonical_admin_identity.sql`

Test/harness scope:

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

Historical closeout artifact included in the implementation commit:

- `_AI_HANDOFFS/from_codex/SF-ACCESS-5014_STORYFORGE_END_TO_END_ACCESS_RECOVERY.md`

No production artifact from this commit is live. Fresh runtime predecessors were not
captured because the mandatory full-suite gate failed before production preparation.
The current live SSO predecessor is still
`c762fc2d9d3d40c53774fdfea0a1ca6e892b9a6059acdfdc58584ba5e6d33824`.

Safe resumption requires a separate, authorized resolution of the untouched
B1-515 mentor-voice pause race followed by a completely green full Playwright run.
Only then may SF-ACCESS-5015 resume at fresh production target/predecessor proof.
