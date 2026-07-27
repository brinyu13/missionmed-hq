# B1-502M Remote Mutation Ledger

Updated: 2026-07-27T21:38:40Z

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

## 12. Pushed Kinsta gateway source

At 2026-07-27T20:18:32Z, the canonical application remote-tracking reflog
recorded a normal push of commit
`94504372c710372ea121a0b62ad7094e893e026b`
(`B1-502M: add isolated StoryForge WordPress gateway`) to
`b1-502-storyforge-production-deployment`.

Outcome: 24 source/evidence files were committed and pushed; no force push,
history rewrite, pull request, or unrelated branch mutation occurred.

Rollback reference: parent
`f23d7daeb289c7340ec4ab1903956cc4cfec282a`.

## 13. First Kinsta feature-off gateway attempt and safe rollback

After the gateway push and before DR-013 was filed, the exact
`94504372c710372ea121a0b62ad7094e893e026b` gateway and its 14-file release
were staged on the pinned Kinsta production site. The sibling evidence release
was placed under:

`/www/theresidencyacademy_209/private/b1-502m/runtime/storyforge-v5/releases/94504372c710372ea121a0b62ad7094e893e026b/`

The active sibling pointer and isolated
`public/wp-content/mu-plugins/missionmed-storyforge-route.php` were installed
only for feature-off validation. Required traversal/read mode changes were
applied during diagnosis. The exact provider mutation timestamps were not
captured in the earlier product ledger; none are invented here.

The attempt established two provider constraints:

1. Kinsta PHP-FPM could not read the sibling private release and the gateway
   failed closed with `release_unavailable`, even with required traversal and
   read permissions present.
2. Kinsta Nginx intercepted extension-bearing `/storyforge/assets/*` requests
   before WordPress and returned 404.

No founder or other user was enabled. Throughout the attempt:

- `storyforge_enabled=false`;
- founder allowlist empty;
- role overrides empty;
- mentor access disabled;
- protected `missionmed-hub` and legacy StoryForge assets unchanged;
- no Nginx, DNS, shared Worker, theme, or protected-plugin mutation.

Rollback was physical and immediate:

- the active sibling pointer was removed;
- the MU route file was moved out of active MU-plugin loading;
- temporary access-mode changes were restored;
- the initial install and rollback purge calls used Kinsta's
  `purge_complete_caches(true)` helper, invalidating object, site, and CDN
  caches; this broader-than-intended mutation is recorded explicitly, and all
  subsequent DR-013 operations are constrained to the separate site-cache and
  CDN-cache purge methods;
- independent StoryForge route probes returned the prior 404;
- root returned 200;
- anonymous member dashboard returned the expected 302 login handoff;
- WordPress REST returned 200.

Read-only verification after rollback recorded owner
`theresidencyacademy:www-data` and these final modes:

- `/www/theresidencyacademy_209/private`: `0755`;
- `private/b1-502m`: `0700`;
- `runtime`, `runtime/storyforge-v5`, `releases`, and the `94504372...` release
  directory: `0755`;
- evidence-release contents: three directories at `0755` and 14 files at
  `0644`;
- retained rollback directory: `0700`;
- retained gateway staging directory: `0750`;
- failed-installed gateway file retained outside active MU loading: `0644`.

All 14 evidence files matched the exact SHA-256 values in the committed
`94504372c710372ea121a0b62ad7094e893e026b` release. The sibling release remains
immutable private evidence only; it is not a PHP-FPM runtime source and must not
be deleted, overwritten, moved, or publicly mirrored.

Outcome: `ROLLED_BACK — SAFE PRODUCTION ROUTE ABSENCE RESTORED`.

Rollback reference: the pre-attempt WordPress 404 route state plus Kinsta
restore identifier `B1-502M-RP-KINSTA-PRE-20260727T174625Z`.

## 14. MissionMed OS DR-013 amendment

At 2026-07-27T20:35:45Z, commit
`d49fffbd1cd92854bd1390fb5f4dbf68be95796d`
(`B1-502M: authorize execution-private StoryForge assets`) was pushed normally
to canonical MissionMed OS `main`.

Scope: forward-only DR-013, StoryForge passport, mission and product indexes,
authority index, generated `CURRENT.md`, and append-only activity log. DR-011,
DR-012, and historical receipts were preserved.

Outcome: DR-013 authorizes only one deterministic guarded runtime bundle at
`wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/release.php`,
an atomic runtime `current` pointer, and exact extensionless SHA-derived aliases
for non-index assets. The sibling private release is evidence only. The
amendment authorizes no raw public asset copy, permission bypass, Nginx/DNS
change, root MU release autoload, broad cache purge, or founder enablement.

Rollback reference: parent
`d7c5f3b26dd4f51928d0145e12b3e84bfa99dfb6`. DR-013 records actual provider
constraints and remains active while the corrected delivery mechanism is
selected.

## 15. Current state at this update

- Railway database/API: deployed and inaccessible without valid authorized
  identity;
- WordPress SSO: installed, feature-off, empty allowlist, empty role overrides;
- Kinsta MU route file: not active;
- Kinsta active StoryForge release pointer: absent;
- live `/storyforge*`: restored prior WordPress 404;
- sibling `94504372...` release: byte-verified immutable evidence only;
- DR-013 nested `release.php`/extensionless-alias product revision: exact final
  commit pending;
- fresh exact-tree Sentinel decision: pending;
- founder profile/allowlist enablement: not performed;
- Cloudflare StoryForge Worker/routes: inert and decommission-pending;
- general users and mentors: not enabled;
- pull request: none.

## 16. DR-013 product source commit and push

At 2026-07-27T21:16:20Z, the canonical application remote-tracking reflog
recorded a normal push of commit
`62ed421309c236d4b6ac05faca606108c0143592`
(`B1-502M: harden Kinsta StoryForge runtime delivery`) to
`b1-502-storyforge-production-deployment`.

Scope: 30 source/evidence files, including the deterministic execution-private
`release.php`, extensionless non-index alias routing, Kinsta-compatible local
router parity, expanded unit/integration security coverage, the reconciled
Critical Systems manifest, and the first-attempt/rollback evidence.

Pinned release metadata:

- exact product source commit:
  `62ed421309c236d4b6ac05faca606108c0143592`;
- generated release ID: `v-963b8f5eb4d8c727`;
- generated `release.php` SHA-256:
  `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`;
- generated `release.php` size: 409,055 bytes.

Outcome: push succeeded normally. No force push, history rewrite, pull request,
deployment, Kinsta mutation, Railway mutation, Cloudflare mutation, database
mutation, feature enablement, or founder enablement occurred as part of this
source push.

This receipt supersedes section 15 only for source-revision status. Production
remains predeployment:

- the Kinsta MU route file is not active;
- the Kinsta execution-private runtime `current` pointer is absent;
- live `/storyforge*` remains the restored prior WordPress 404;
- WordPress SSO remains installed with feature false, empty allowlist, and empty
  role overrides;
- the sibling `94504372...` release remains immutable evidence only;
- the fresh Sentinel decision authorizes guarded commit/push and feature-off
  gates only, not founder enablement;
- general users and mentors remain disabled.

Rollback reference: parent
`94504372c710372ea121a0b62ad7094e893e026b`. This reference is source history,
not an instruction to restore the failed sibling-runtime mechanism.

## 17. DR-013 feature-off install, cache-gate failure, and physical rollback

At 2026-07-27T21:23:59Z, exact pushed product commit
`62ed421309c236d4b6ac05faca606108c0143592` was installed feature-off on the
pinned Kinsta site. The selected runtime topology was:

- route:
  `public/wp-content/mu-plugins/missionmed-storyforge-route.php`;
- release:
  `public/wp-content/mu-plugins/missionmed-storyforge-runtime/releases/62ed421309c236d4b6ac05faca606108c0143592/release.php`;
- atomic pointer target:
  `releases/62ed421309c236d4b6ac05faca606108c0143592`;
- route SHA-256:
  `78cecf86bbcffe6c30a7eefd43fbe15f5c7e01247f550397ccf14cae3084c432`;
- route size: 29,548 bytes;
- bundle SHA-256:
  `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`;
- bundle size: 409,055 bytes.

The route and bundle were hardened to mode `0444`; the runtime, releases, and
selected-release directories were hardened to `0555`. Exactly one root
StoryForge route PHP file and one nested release PHP file existed. The sibling
`94504372...` evidence release was not changed or selected. Cache invalidation
used only Kinsta's separate site-cache and CDN-cache purge methods.

Feature-off validation passed the route, bundle, alias, direct-execution,
raw-path, shared-health, SSO-denial, and protected-hash checks. It then found a
hard cache defect: after an initial origin response, Kinsta edge storage
returned HTML, health, configuration, and every approved alias as a cache hit
and replaced the manifest response policy with
`public, max-age=0, s-maxage=86400`. No founder or other account was enabled;
the protected API remained denied while the feature was off.

The owner/mode receipt also established a managed-hosting residual: PHP-FPM
and the deployment account share the same site owner. `0444`/`0555` prevents
ordinary writes, but the owner can in principle change modes or unlink entries
from an owner-writable parent. This remains a founder-enable gate pending an
explicit authority ruling or provider-enforced ownership.

At 2026-07-27T21:37:13Z, the Supervisor physically moved the exact route and
`current` pointer into the scoped private rollback directory. The exact release
directory remained dormant and byte-identical. Separate site-cache and
CDN-cache purge calls each returned HTTP 200. After provider propagation,
independent anonymous probes returned the prior WordPress 404 for:

- `/storyforge`;
- `/storyforge/`;
- `/storyforge/healthz`.

Shared root, anonymous Matrix login handoff, and WordPress REST remained
healthy. All four protected Matrix/legacy StoryForge hashes remained exact.
The feature flag remained false; allowlist and role overrides remained empty;
general users and mentors remained disabled.

Outcome: `ROLLED_BACK — SAFE PRODUCTION ROUTE ABSENCE RESTORED`.

A smallest local repair now marks all StoryForge responses ineligible for
Kinsta/Cloudflare edge storage while preserving the browser-facing
manifest cache class. It changes only the gateway and focused integration
assertions. Validation currently passes:

- unit: 27/27;
- WordPress integration: 7/7;
- browser E2E: 7/7;
- PostgreSQL authorization: `STORYFORGE_POSTGRES_SUITE_PASS`;
- secret scan and npm audit: clean;
- PHP lint and deterministic route-manifest check: pass.

The cache repair is local and uncommitted at this ledger update. It has not
been redeployed. Rollback reference remains the verified route-absent state
above.

## 18. Exact cache-repair push, feature-off retry, and safe rollback

This append-only entry supersedes only the time-bound candidate status at the
end of section 17. Exact repair commit
`4bd956b6ea222d20428c41415236a73b93576447`
(`B1-502M: prevent StoryForge edge cache storage`) was committed and pushed
normally to
`origin/b1-502-storyforge-production-deployment` at
`2026-07-27T21:43:09Z`.

At `2026-07-27T21:44:33Z`, that exact commit was installed feature-off on the
pinned Kinsta production site:

- route:
  `public/wp-content/mu-plugins/missionmed-storyforge-route.php`;
- selected release:
  `public/wp-content/mu-plugins/missionmed-storyforge-runtime/releases/4bd956b6ea222d20428c41415236a73b93576447/release.php`;
- atomic pointer target:
  `releases/4bd956b6ea222d20428c41415236a73b93576447`;
- route SHA-256:
  `23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`;
- route size: 30,528 bytes;
- bundle SHA-256:
  `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`;
- bundle size: 409,055 bytes;
- route and bundle mode: `0444`;
- runtime, releases, and exact release directory mode: `0555`.

The feature flag remained false, founder allowlist and role overrides remained
empty, and mentor access remained disabled. Scoped site-cache and CDN-cache
purges each returned HTTP 200.

Anonymous cache proof:

1. Pass one returned the exact application policies with
   `CF-Cache-Status: DYNAMIC` and `X-Kinsta-Cache: MISS`.
2. Passes two and three kept Cloudflare at `DYNAMIC`, proving that the repair
   prevented Cloudflare edge storage.
3. Passes two and three returned `X-Kinsta-Cache: HIT` and
   `public, max-age=0, s-maxage=86400` for the shell, deep link, health,
   configuration, application alias, and license alias.

This proved that the remaining cache defect is Kinsta's managed
server/full-page layer. At `2026-07-27T21:45:23Z`, the Supervisor physically
removed the exact route and active `current` pointer. Only the scoped Kinsta
site-cache and CDN-cache purge methods were used; both returned HTTP 200. After
provider propagation, `/storyforge`, `/storyforge/`, and
`/storyforge/healthz` returned the prior WordPress 404.

Current safe state:

- StoryForge route and active pointer: absent;
- exact `62ed421...` and `4bd956...` release directories: dormant;
- feature flag: false;
- founder allowlist and role overrides: empty;
- no founder, general user, or mentor enabled;
- protected Matrix and legacy StoryForge hashes: exact;
- Railway API and database: isolated, feature-inaccessible without valid
  identity;
- inert Cloudflare StoryForge Worker and routes: cleanup pending fresh
  authenticated Cloudflare access.

Remaining external/human gates:

1. authenticated MyKinsta access and Kinsta Support action to exclude URL paths
   beginning exactly with `/storyforge` from server/full-page and corresponding
   edge caching;
2. fresh founder-authenticated WordPress access for exact one-profile binding;
3. explicit Founder acceptance of the same-UID managed-hosting residual for
   this exact one-founder pilot, or provider-enforced different-principal
   isolation;
4. fresh authenticated Cloudflare access to remove only the inert isolated
   StoryForge Worker and its exact/wildcard routes.

Rollback reference remains the verified route-absent state above.

## 19. Evidence checkpoint push and read-only safe-state verification

Commit `07d620f8b788c2f2c01180a464b93b0c0dddf143`
(`B1-502M: record safe rollback and provider cache gate`) was pushed normally
to `origin/b1-502-storyforge-production-deployment` at
`2026-07-27T21:57:39Z`. The commit contains evidence and authority-record
updates only. The push used no force, history rewrite, pull request, provider
deployment, feature change, founder enablement, or other production mutation.

At `2026-07-27T22:04:58Z`, the Supervisor performed a sanitized read-only
safe-state verification. It proved:

- active StoryForge MU route: absent;
- runtime `current` pointer: absent;
- SSO plugin: active;
- settings option: present;
- `storyforge_enabled=false`;
- founder allowlist: 0;
- role overrides: 0;
- mentor role configured: false;
- mentor overrides: 0;
- mentor assignments: 0;
- mentor access: false.

Anonymous no-cookie/no-follow requests to `/storyforge`, `/storyforge/`,
`/storyforge/healthz`, `/storyforge/config`, and `/storyforge/library` all
returned 404 with `CF-Cache-Status: DYNAMIC`, a private/no-store policy, and
`X-Kinsta-Cache: EXPIRED` or `MISS`.

The protected runtime hashes remained exact and matched the current canonical
delegated Matrix lock:

| Asset | SHA-256 |
|---|---|
| Legacy StoryForge JS | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` |
| Legacy StoryForge CSS | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` |
| Matrix shell | `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a` |
| Matrix PHP | `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95` |

Railway application deployment
`fb43a551-04c8-41f7-a6e6-fb16aae3894e` and PostgreSQL deployment
`f5c7179e-b805-4e82-b080-d2349a0a47cf` both remained `SUCCESS` with
`stopped=false`. The API returned
`{"ok":true,"service":"storyforge-v5"}` from health, 404 at its origin root,
and 401 for an unauthenticated `/api/session` request.

Database reads returned three migration-ledger rows, 15 StoryForge application
tables with RLS enabled plus the separate migration ledger, zero users, zero
mentor assignments, zero stories, and zero audit events. The application role
remained least privilege with `rolbypassrls=false`.

This verification made no Git, Kinsta, WordPress, Cloudflare, Railway,
PostgreSQL, DNS, Matrix, cache, feature, identity, or production mutation.
Rollback reference remains the exact route-absent, feature-off state.

At `2026-07-27T22:21:37Z`, a further anonymous no-cookie/no-follow GET sample
rechecked the same five StoryForge paths. Every path still returned 404 with
`CF-Cache-Status: DYNAMIC`, `X-Kinsta-Cache: EXPIRED`, and
`Cache-Control: no-cache, must-revalidate, max-age=0, no-store, private`.
This was read-only and made no remote mutation.
