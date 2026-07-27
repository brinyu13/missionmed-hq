# B1-502M Mutation Plan and Approval

Recorded: 2026-07-27

Risk: **HIGH — production authentication, private data, protected Matrix, edge
routing, and database**

Founder authorization: **PRESENT under MissionMed OS DR-011, with the routing
mechanism amended forward by DR-012**

Supervisor mutation rule: no application/schema/plugin/edge mutation until the
canonical V5 UI, manifest, source inventory, full local suite, rollback
evidence, and independent reviews all pass.

## Exact planned systems

1. isolated StoryForge PostgreSQL service on Railway;
2. isolated StoryForge Node application service on Railway;
3. isolated `missionmed-storyforge-sso` plugin on Kinsta;
4. isolated `missionmed-storyforge-route.php` Kinsta MU gateway;
5. one private, versioned 14-file static release and atomic `current` pointer;
6. one exact founder WordPress allowlist entry and one matching StoryForge
   profile row;
7. MissionMed Critical Systems registration for the final deployed artifacts.

Protected `missionmed-hub`, legacy StoryForge assets, shared DNS, unrelated
Workers, existing Supabase projects, and all other WordPress accounts are
outside the mutation set.

## Restore identifiers

- Kinsta/WordPress/Matrix:
  `B1-502M-RP-KINSTA-PRE-20260727T174625Z`;
- PostgreSQL:
  `B1-502M-RP-DB-PRE-20260727T173144Z`;
- Cloudflare absent prestate:
  `B1-502M-RP-CF-ABSENT-20260727T174734Z`;
- Railway application absent prestate:
  `B1-502M-RP-RWY-ABSENT-20260727T171118Z`.

## Guarded order

### Stage 0 — source and authority

1. complete the approved dark V5 correction;
2. run Miyamoto, Vitruvius, Turing, Sagan, Osler, and Sentinel review;
3. build reproducibly and register exact final asset paths and hashes;
4. run the complete local unit, PostgreSQL, browser, integration, syntax,
   bundle, dependency, manifest, diff, and rollback suite;
5. remove generated reports and restore historical screenshot drift;
6. verify every changed/untracked file is B1-502M source or evidence;
7. commit and push the approved release revision normally.

### Stage 1 — database and origin

1. reverify the exact PostgreSQL before-state and backup;
2. generate application credentials without printing or persisting them in
   Git;
3. execute the guarded migrations using the final Git SHA and exact backup ID;
4. prove ledger/checksums, RLS, role attributes, ownership, grants, and zero
   user/assignment counts;
5. create a post-migration backup;
6. create exactly one founder student row and zero mentor assignments;
7. deploy the Railway app API-only with the `storyforge_app` connection using
   `storyforge-v5/` as the exact upload/root directory and
   `storyforge-v5/railway.json`; never upload the repository root;
8. verify the provider health check and that direct-origin UI access fails
   closed.

### Stage 2 — feature-off WordPress and same-origin gateway

1. upload and activate only `missionmed-storyforge-sso`;
2. install protected configuration with an empty allowlist and the flag
   explicitly false;
3. verify shared WordPress, Matrix, member-dashboard, and legacy behavior;
4. upload the exact 14-file release into a new private version directory and
   verify every manifest hash;
5. atomically point the private `current` symlink to that release;
6. stage and PHP-lint `missionmed-storyforge-route.php` outside `mu-plugins`,
   then move only that file into the auto-loaded directory;
7. purge Kinsta site/CDN cache and verify route isolation, cache policy,
   feature-off protected-API denial, static hashes, and shared-system health;
8. after the Kinsta route is proven, remove the two inert Cloudflare
   StoryForge bindings and isolated Worker to prevent split-brain ownership.

### Stage 3 — exact founder enablement

1. configure the one protected founder WordPress ID and student-role override;
2. set the flag true;
3. verify the founder journey, no second login, dark V5 UI, deep links,
   refresh, Back to Matrix, startup resolution, private story workflow, and
   zero-mentor submission denial;
4. verify a second administrator and every other tested cohort remain denied;
5. verify logout/revocation, direct-ID privacy, cache, bundles, logs, and
   absence of demo records or secrets.

## Rollback order

1. set `storyforge_enabled=false`;
2. move only `missionmed-storyforge-route.php` out of `mu-plugins`, restore the
   prior private release pointer if needed, and purge Kinsta site/CDN cache;
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
| Same-origin gateway | Exact route ownership, private release, cache, header, and rollback behavior proven |
| Database | Atomic runner, readable backup, collision-free target, least privilege |
| Founder entitlement | Exact account only; all other admins denied |
| Assignment | Mentor access disabled; zero active assignments |
| Restore points | Readable target-specific receipts |
| Privacy/secrets | Default deny, no private caching, clean bundle/log/source scans |
| Legacy fallback | Protected assets unchanged and shared health proven |
| Product/UI | Canonical dark V5 and recovery/mobile/accessibility reviews pass |

The final approval decision and timestamp are appended after Sentinel reviews
the exact final tree.

## Final Sentinel decision

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

The separate Kinsta MU gateway repair is committed and recorded only after its
DR-012 authority amendment, strengthened 7/7 integration run, 23/23 unit run,
7/7 existing browser run, PostgreSQL authorization run, audit, deterministic
manifest build, PHP/Bash/Node syntax, and Git whitespace checks pass.
