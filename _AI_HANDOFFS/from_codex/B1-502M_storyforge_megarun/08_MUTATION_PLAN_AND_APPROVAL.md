# B1-502M Mutation Plan and Approval

Recorded: 2026-07-27

Risk: **HIGH — production authentication, private data, protected Matrix, edge
routing, and database**

Founder authorization: **PRESENT under MissionMed OS DR-011, with routing
amended forward by DR-012 and runtime asset delivery amended forward by DR-013**

Supervisor mutation rule: no application/schema/plugin/edge mutation until the
canonical V5 UI, manifest, source inventory, full local suite, rollback
evidence, and independent reviews all pass.

## Exact planned systems

1. isolated StoryForge PostgreSQL service on Railway;
2. isolated StoryForge Node application service on Railway;
3. isolated `missionmed-storyforge-sso` plugin on Kinsta;
4. isolated `missionmed-storyforge-route.php` Kinsta MU gateway;
5. one deterministic guarded `release.php` containing the approved logical
   14-file release, staged in an immutable commit-named directory below the
   MU-plugin root and selected by an atomic runtime `current` pointer;
6. one exact founder WordPress allowlist entry and one matching StoryForge
   profile row;
7. MissionMed Critical Systems registration for the final deployed artifacts.

Protected `missionmed-hub`, legacy StoryForge assets, shared DNS, unrelated
Workers, existing Supabase projects, and all other WordPress accounts are
outside the mutation set.

The sibling private 14-file tree deployed during the first Kinsta attempt is now
immutable evidence only. It is outside the DR-013 runtime mutation set and must
not be deleted, overwritten, moved, or publicly mirrored.

## Restore identifiers

- Kinsta/WordPress/Matrix:
  `B1-502M-RP-KINSTA-PRE-20260727T174625Z`;
- PostgreSQL:
  `B1-502M-RP-DB-PRE-20260727T173144Z`;
- Cloudflare absent prestate:
  `B1-502M-RP-CF-ABSENT-20260727T174734Z`;
- Railway application absent prestate:
  `B1-502M-RP-RWY-ABSENT-20260727T171118Z`.

## Execution state after the DR-013 cache-repair retry

- The isolated Railway database and API are deployed.
- The isolated WordPress SSO plugin is installed with the feature flag false,
  empty founder allowlist, empty role overrides, and mentor access disabled.
- The first Kinsta gateway revision
  `94504372c710372ea121a0b62ad7094e893e026b` failed closed because PHP-FPM
  could not read the sibling private release and Nginx intercepted
  extension-bearing asset paths.
- The active pointer and MU route file were physically removed, caches were
  purged, StoryForge routes returned the prior 404, and shared-site health
  remained intact.
- MissionMed OS DR-013 is filed at
  `d49fffbd1cd92854bd1390fb5f4dbf68be95796d`.
- Exact DR-013 commit
  `62ed421309c236d4b6ac05faca606108c0143592` and exact cache-repair commit
  `4bd956b6ea222d20428c41415236a73b93576447` were pushed and installed
  feature-off in separate guarded attempts.
- Both attempts were physically rolled back. The second kept Cloudflare
  dynamic but proved Kinsta's managed server cache still stores the route.
- The active route and pointer are absent; StoryForge routes return the prior
  404; no user is enabled.
- Founder enablement remains unauthorized pending the exact Kinsta cache
  exclusion, fresh founder-authenticated binding, and same-UID authority
  decision.

## Remaining guarded order

### Stage 0 — DR-013 source and authority (completed)

The approved dark V5 correction, independent reviews, reproducible build,
complete local gate suite, exact-tree cleanup, source commits, and normal
pushes are complete through
`4bd956b6ea222d20428c41415236a73b93576447`.

### Stage 1 — database and origin (schema/API completed; founder row pending)

1. reverify the exact PostgreSQL before-state and backup;
2. generate application credentials without printing or persisting them in
   Git;
3. execute the guarded migrations using the final Git SHA and exact backup ID;
4. prove ledger/checksums, RLS, role attributes, ownership, grants, and zero
   user/assignment counts;
5. create a post-migration backup;
6. keep production at zero users and zero mentor assignments until Stage 3 can
   atomically reconcile the sole founder WordPress binding and sole founder
   student row;
7. deploy the Railway app API-only with the `storyforge_app` connection using
   `storyforge-v5/` as the exact upload/root directory and
   `storyforge-v5/railway.json`; never upload the repository root;
8. verify the provider health check and that direct-origin UI access fails
   closed.

### Stage 2 — feature-off WordPress and same-origin gateway

The isolated SSO plugin portion is complete and remains feature-off. Items 1–3
are retained preconditions. Items 4–8 passed locally and during feature-off
execution but must be repeated after Kinsta applies the exact `/storyforge`
server/full-page and edge-cache exclusion. Item 9 remains pending fresh
Cloudflare authentication.

1. upload and activate only `missionmed-storyforge-sso`;
2. install protected configuration with an empty allowlist and the flag
   explicitly false;
3. verify shared WordPress, Matrix, member-dashboard, and legacy behavior;
4. deterministically generate the single guarded bundle from exactly the
   approved 14 committed files and verify every full hash, size, MIME type,
   cache class, byte payload, and unique alias;
5. stage `release.php` in
   `wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/`,
   prove the directory name equals the final committed product revision, set
   immutable read-only ownership/modes, and atomically point the runtime
   `current` symlink to that release;
6. stage and PHP-lint `missionmed-storyforge-route.php` outside `mu-plugins`,
   then move only that file into the auto-loaded directory;
7. prove no release PHP, duplicate, loader, backup, or temporary PHP file exists
   in the root MU-plugin directory and direct nested-bundle requests disclose
   zero content;
8. purge Kinsta site/CDN cache and verify route isolation, cache policy,
   feature-off protected-API denial, every approved non-index extensionless
   alias, raw-path absence, static hashes, and shared-system health;
9. after the Kinsta route is proven, remove the two inert Cloudflare
   StoryForge bindings and isolated Worker to prevent split-brain ownership.

### Stage 3 — exact founder enablement

1. create exactly one founder student row and configure the same protected
   founder WordPress ID as the sole allowlist entry and student-role override;
2. prove the WordPress and database identifiers match and assignments remain
   zero;
3. set the flag true;
4. verify the founder journey, no second login, dark V5 UI, deep links,
   refresh, Back to Matrix, startup resolution, private story workflow, and
   zero-mentor submission denial;
5. verify a second administrator and every other tested cohort remain denied;
6. verify logout/revocation, direct-ID privacy, cache, bundles, logs, and
   absence of demo records or secrets.

## Rollback order

1. set `storyforge_enabled=false`;
2. atomically restore or disable only the execution-private runtime `current`
   pointer, move only `missionmed-storyforge-route.php` out of `mu-plugins` when
   route absence is required, and purge Kinsta site/CDN cache;
3. prove every `/storyforge*` request returns the recorded WordPress 404;
4. deactivate/remove only `missionmed-storyforge-sso` if the SSO seam itself
   must be removed;
5. take the isolated Railway application offline;
6. restore the isolated database only if corruption requires it;
7. verify Matrix login, member dashboard, legacy StoryForge, unrelated routes,
   and the recorded protected hashes.

## Premutation gate table

| Gate | Required state before first application/schema/plugin/edge mutation |
|---|---|
| Production target | Exact Kinsta, Railway, Cloudflare targets proven |
| Source/revision | Clean committed and pushed final candidate |
| WordPress/Matrix | Isolated deploy path and feature-off behavior proven |
| Same-origin gateway | Exact route ownership, execution-private bundle, immutable evidence release, alias/cache/header behavior, and rollback proven |
| Database | Atomic runner, readable backup, collision-free target, least privilege |
| Founder entitlement | Exact account only; all other admins denied |
| Assignment | Mentor access disabled; zero active assignments |
| Restore points | Readable target-specific receipts |
| Privacy/secrets | Default deny, no private caching, clean bundle/log/source scans |
| Legacy fallback | Protected assets unchanged and shared health proven |
| Product/UI | Canonical dark V5 and recovery/mobile/accessibility reviews pass |

The final approval decision and timestamp are appended after Sentinel reviews
the exact final tree.

## Initial foundation Sentinel decision

Recorded: 2026-07-27T18:53Z

**GO — bounded feature-off Stage A after the verified release commit and
normal push. Founder enablement remains gated.**

Before founder enablement, the Supervisor must uniquely re-prove exactly one
founder WordPress account; install that account as the sole allowlist entry and
sole student-role override; bind the same WordPress ID to the sole
`public.sf_users` UUID row; keep assignments and demo data at zero; and verify
every other tested administrator, student, mentor, and anonymous request is
denied. After gateway routing, repeated effective cache probes must show no
`CF-Cache-Status: HIT`, no `Age`, and no weakening of private/no-store headers.
Any failure invokes the recorded rollback order.

Initial feature-off foundation precommit evidence for
`f23d7daeb289c7340ec4ab1903956cc4cfec282a`:

- intended staged files: 96;
- unstaged/untracked files: 0/0;
- protected `missionmed-hub` changes: 0;
- `git diff --cached --check`: PASS;
- critical gate: 32 PASS, 32 expected dirty/network-skip WARN, 0 FAIL;
- locked local artifacts: 14/14 exact;
- unit: 23/23;
- PostgreSQL authorization: PASS;
- browser: 7/7;
- production-style integration: 7/7 through the actual WordPress gateway;
- bundle secrets, dependency audit, PHP/Bash/Node syntax, deterministic build,
  and Wrangler dry-run: PASS.

That decision predates both the failed first Kinsta gateway attempt and DR-013.
It remains evidence for the initial Railway/database/SSO foundation only and is
not approval for the execution-private bundle candidate.

## DR-013 exact-tree Sentinel decision

Recorded: 2026-07-27T21:12:35Z

**GO — guarded commit/push and feature-off deployment gates only.**

Fresh Sentinel review initially returned NO-GO because the runtime loader did
not reject every symlinked release hop. The candidate was not staged or
deployed. The loader now rejects a symlinked runtime root, releases root,
selected release directory, bundle file, and noncanonical `current` target; it
requires exact `releases/<40hex>`, canonical direct-child equality, and
`current == selected`.

The corrected regression proves that a formerly acceptable chained symlink to
a second valid 40-hex release directory fails closed and that exact physical
restoration returns the loader to `OK`. Independent Sentinel reruns passed:

- runtime symlink regression: PASS;
- full unit suite: 27/27;
- PHP lint: PASS;
- exact 14-file WordPress manifest check: PASS;
- `git diff --check`: PASS.

The Supervisor also recorded 7/7 existing browser tests, PostgreSQL
authorization PASS, deterministic build and syntax checks, bundle secret scan,
npm audit, and Wrangler dry-run PASS. No remaining DR-013 source blocker was
found.

This GO authorized only guarded staging, source commit/push, and the
feature-off production gates. It was not founder enablement, general release,
or live-production completion. Exact pushed commits `62ed421...` and
`4bd956...` subsequently passed the release-directory, pointer,
direct-execution, root-autoload, alias/raw-path, protected-hash, rollback, and
shared-health checks. The cache gate failed at Kinsta's managed server layer,
both attempts were physically rolled back, and founder enablement remains
`NO_GO`.
