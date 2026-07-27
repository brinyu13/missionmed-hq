# B1-502M Remote Mutation Ledger

Updated: 2026-07-27T20:15:47Z

This ledger records every remote write performed by the B1-502M Supervisor.
Read-only provider, Git, HTTP, SSH, and browser observations are excluded.

## 1. MissionMed OS authority

Remote: canonical MissionMed OS Git origin.

Normal pushes:

1. 2026-07-27T16:51:04Z —
   `18df24dc4f1360551c7bf217f08d257a6e0cfee3`
   — register DR-011, B1-502M mission, StoryForge passport, indexes, generated
   `CURRENT.md`, activity log, and receipt.
   Outcome: push succeeded; rollback reference is parent
   `f197c54c0d6098d73cab5a5398f034bdd50e4698`.
2. 2026-07-27T16:57:25Z —
   `4f3c7e89efbb55956a39066bce7e42598f55a244`
   — correct the protected mission track, filed receipt state, passport
   premutation wording, and opaque founder evidence handle.
   Outcome: push succeeded; rollback reference is
   `18df24dc4f1360551c7bf217f08d257a6e0cfee3`.

Verification:

- normal non-force pushes;
- canonical local `main` and local `origin/main` both resolved to
  `4f3c7e89efbb55956a39066bce7e42598f55a244`;
- unrelated untracked MissionMed OS directories were not staged or changed.

## 2. Isolated Railway foundation

Remote: Railway.

Created at approximately 2026-07-27T17:11:18Z:

- project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- empty application service `dab015bf-15ef-4698-9f16-cbf8cf23de7a`;
- PostgreSQL service `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- provider PostgreSQL deployment
  `f5c7179e-b805-4e82-b080-d2349a0a47cf`
  (provider creation timestamp 2026-07-27T17:12:00.436Z).

Outcome: all four isolated resources exist in the exact production
environment; PostgreSQL deployment status is `SUCCESS`; application source,
deployment, and domains remain absent.

Rollback reference: delete only the empty application service and isolated
project if the release is abandoned; preserve the database until its backup
and evidence-retention requirements are satisfied. No existing MissionMed
Railway resource is in scope.

State at this ledger update:

- application source/deployment/domain: absent;
- StoryForge schema/roles/data: absent;
- application and JWT secrets: absent.

## 3. Kinsta private restore point

Remote: Kinsta production filesystem.

Created at 2026-07-27T17:46:25Z:

`/www/theresidencyacademy_209/private/b1-502m/B1-502M-RP-KINSTA-PRE-20260727T174625Z`

Scope:

- copied `wp-config.php`;
- archived complete `missionmed-hub`;
- exported complete WordPress database;
- wrote sanitized receipt.

This backup write did not alter the live WordPress application, active plugin
set, option state, Matrix assets, database contents, or request behavior.

Outcome: archive and database readability passed; the receipt hashes are
retained under `evidence/provider-prestate/KINSTA_PRESTATE.md`.

Rollback reference: the backup is additive private evidence and requires no
rollback.

## 4. Kinsta private archive restoration rehearsal

At 2026-07-27T18:06:40Z an isolated temporary directory was created beneath
`/www/theresidencyacademy_209/private/b1-502m`, the complete protected plugin
archive was extracted, four protected hashes were verified, and the exact
temporary directory was removed.

Outcome: `KINSTA_ARCHIVE_RESTORE_REHEARSAL_PASS`; no live file, option, plugin,
database row, or request behavior changed.

Rollback reference: the rehearsal directory was removed successfully during
the operation; no residual remote state remains.

## 5. No other remote write as of this update

- B1-502M application repository push: none;
- WordPress StoryForge plugin/configuration: none;
- StoryForge database schema/roles/users/assignments: none;
- Railway application deployment/domain/variables: none;
- Cloudflare Worker/version/deployment/routes/DNS/cache: none;
- production StoryForge feature flag: not installed;
- founder enablement: none;
- general users or mentors enabled: none;
- pull request: none;
- production rollback: not required.

Later remote writes must be appended immediately with provider revision,
timestamp, scope, validation, and rollback reference.

## 6. Guarded application source push

At 2026-07-27T18:54:13Z, commit
`f23d7daeb289c7340ec4ab1903956cc4cfec282a`
(`B1-502M: prepare guarded StoryForge V5 founder release`) was pushed normally
to branch `b1-502-storyforge-production-deployment` in the canonical
application repository.

Outcome: 96 source/evidence files were committed; no force push or pull request
was used.

Rollback reference: parent
`e76193176e50fa0f0c329b40017c3e48b94510ef`.

## 7. Isolated Railway database and API

The three guarded StoryForge migrations were applied to the isolated
PostgreSQL service using source revision
`f23d7daeb289c7340ec4ab1903956cc4cfec282a` and verified pre-migration restore
identifier `B1-502M-RP-DB-PRE-20260727T173144Z`.

Outcome:

- migration ledger 3/3 with exact checksums;
- all 15 StoryForge tables have RLS enabled;
- least-privilege `storyforge_app` login established;
- zero StoryForge users, assignments, stories, questions, imports,
  notifications, or audit events;
- post-schema restore identifier
  `B1-502M-RP-DB-SCHEMA-20260727T190219Z`, SHA-256
  `60e12d7c38963ce05ffcbe735beb71d1e037225dd370a7ab32747182f80b2c00`.

Railway application deployment
`fb43a551-04c8-41f7-a6e6-fb16aae3894e` completed successfully for service
`dab015bf-15ef-4698-9f16-cbf8cf23de7a`. Public domain
`https://storyforge-v5-api-production.up.railway.app` was created with provider
domain identifier `167947f8-ab20-4ecd-a971-b00c1c8441f9`. An initial provider
port mismatch was corrected by pinning the application to port 8080.

Validation: sanitized health passed; direct UI root returned 404; production
configuration was accepted; unapproved origin returned 403; unauthenticated
session returned 401; development, fake AI, and fake audio paths remained
disabled; no secret was printed.

Rollback reference: feature off and remove only the isolated application
domain/service if required; restore the isolated database from the verified
pre-migration dump only for corruption.

## 8. Kinsta feature-off SSO bridge

The isolated `missionmed-storyforge-sso` plugin was uploaded and activated on
the pinned Kinsta WordPress site. The signing secret was created only in the
private B1-502M directory and referenced by `wp-config.php`; its value is not
stored in this ledger or Git.

Outcome:

- plugin source 4/4 files matched the pushed candidate;
- `storyforge_enabled=false`;
- founder allowlist empty;
- role overrides empty;
- student application role only;
- mentor access disabled;
- all seven WordPress administrators denied while feature-off;
- token signer and protected REST boundary validated.

The protected `missionmed-hub` and legacy StoryForge hashes remained exact.
One WP-CLI invocation segfaulted after the requested activation had completed;
isolated plugin/configuration checks and public shared-site probes verified the
result and no rollback was required.

Rollback reference: force the flag off, deactivate/remove only
`missionmed-storyforge-sso`, remove only its private secret reference when the
bridge itself must be rolled back, and verify the protected hashes.

## 9. Cloudflare feature-off experiment and containment

The isolated Worker `missionmed-storyforge-v5` and two exact StoryForge route
bindings were created:

- exact route `37a1ba80b39043a08cc7b482cfa7e3c6`;
- wildcard route `fcb362908f22443187a5b0541bf61a75`.

Direct production probes proved these bindings inert because the apex remains
DNS-only to Kinsta. No DNS record, unrelated Worker route, cache rule, Pages
project, or shared service was changed.

During a read-only diagnostic parser failure, the authenticated Cloudflare
credential was echoed only into private tool output. It was never written to
Git or shown publicly. The session was immediately invalidated with a normal
provider logout, and a follow-up identity check confirmed that Wrangler was no
longer authenticated. The credential value is intentionally absent here.

Required cleanup after the Kinsta route passes: establish a fresh authenticated
Cloudflare session, remove only the two identifiers above, verify every
unrelated binding is unchanged, delete only the isolated Worker, and reverify
the Kinsta route.

Rollback reference: these records never became traffic authority. Removing
them must not alter live `/storyforge/` behavior.

## 10. MissionMed OS DR-012 amendment

At 2026-07-27T20:14Z, commit
`d7c5f3b26dd4f51928d0145e12b3e84bfa99dfb6`
(`B1-502M: authorize Kinsta StoryForge gateway amendment`) was pushed normally
to canonical MissionMed OS `main`.

Scope: forward-only DR-012, StoryForge passport, mission and product indexes,
authority index, generated `CURRENT.md`, and append-only activity log. DR-011
and historical receipts were preserved.

Outcome: remote `main`, local HEAD, and local `origin/main` matched the exact
commit; OS lint, JSON validation, and Git whitespace checks passed.

Rollback reference: parent
`4f3c7e89efbb55956a39066bce7e42598f55a244`. This amendment reflects actual
runtime ownership and is not reverted while the Kinsta gateway is the selected
route mechanism.

## 11. State at this update

- Railway database/API: deployed and feature-inaccessible without valid
  identity;
- WordPress SSO: installed and feature-off;
- Kinsta MU gateway/private release: not yet installed;
- live `/storyforge/`: prior WordPress 404;
- founder allowlist/profile: not yet created;
- Cloudflare StoryForge Worker/routes: inert and decommission-pending;
- general users and mentors: not enabled;
- pull request: none;
- production rollback: not required.
