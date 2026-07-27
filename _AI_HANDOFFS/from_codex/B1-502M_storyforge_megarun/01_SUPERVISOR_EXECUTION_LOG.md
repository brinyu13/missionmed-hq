# B1-502M Supervisor Execution Log

Recorded: 2026-07-27

## Scope and operating rule

The Supervisor pursued the authorized founder-only production release through
feature-off deployment, repeated production verification, smallest-safe repair,
and immediate rollback on hard-gate failure. No general student or mentor
enablement was attempted. Secrets and raw founder identity were excluded from
Git and evidence.

This log summarizes the authoritative detailed receipts in
`evidence/REMOTE_MUTATION_LEDGER.md`; it does not replace that append-only
ledger.

## Execution chronology

### Authority and target resolution

1. Verified the B1-501 source baseline
   `5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc`, the canonical dark V5 artifact,
   and the production target `https://missionmedinstitute.com/storyforge/`.
2. Refreshed MissionMed OS through its normal writer and pushed the scoped
   authority chain:
   - `18df24dc4f1360551c7bf217f08d257a6e0cfee3` — DR-011 mission,
     passport, indexes, generated `CURRENT.md`, log, and receipt;
   - `4f3c7e89efbb55956a39066bce7e42598f55a244` — protected-track and
     filed-state corrections;
   - `d7c5f3b26dd4f51928d0145e12b3e84bfa99dfb6` — DR-012 Kinsta
     gateway amendment;
   - `d49fffbd1cd92854bd1390fb5f4dbf68be95796d` — DR-013
     execution-private asset amendment.
3. Pinned the canonical Kinsta site, WordPress/Matrix boundary, isolated
   Railway targets, and Cloudflare zone. Confirmed that role-based WordPress
   admission would be unsafe because seven administrator accounts exist.

### Restore-point establishment

4. Created and verified the private Kinsta restore point
   `B1-502M-RP-KINSTA-PRE-20260727T174625Z`, including `wp-config.php`, the
   complete protected `missionmed-hub` archive, the WordPress database, and a
   sanitized receipt.
5. Rehearsed archive extraction in an isolated private directory, verified the
   four protected hashes, and removed the rehearsal directory.
6. Recorded the empty PostgreSQL restore point
   `B1-502M-RP-DB-PRE-20260727T173144Z`, Cloudflare absent-state receipt
   `B1-502M-RP-CF-ABSENT-20260727T174734Z`, and Railway application
   absent-state receipt `B1-502M-RP-RWY-ABSENT-20260727T171118Z`.

### Isolated database and API foundation

7. Created isolated Railway project
   `875e7c17-d06f-4301-a4bb-e61016f153cf`, environment
   `bcef8734-e42b-44df-8488-c2a3de68213f`, application service
   `dab015bf-15ef-4698-9f16-cbf8cf23de7a`, and PostgreSQL service
   `a4a66362-c3ba-475a-ae21-2aa46624bafe`.
8. Pushed application foundation commit
   `f23d7daeb289c7340ec4ab1903956cc4cfec282a`.
9. Applied all three exact migrations transactionally. Verified 3/3 migration
   checksums, RLS on all 15 StoryForge tables, least-privilege application
   login, and zero application data. Created post-schema restore point
   `B1-502M-RP-DB-SCHEMA-20260727T190219Z`.
10. Deployed the API-only Railway service at deployment
    `fb43a551-04c8-41f7-a6e6-fb16aae3894e`. Corrected the isolated provider
    port binding to 8080. Health passed; the direct UI root remained 404;
    unapproved origin and unauthenticated access failed closed.

### WordPress and edge foundation

11. Installed and activated the isolated `missionmed-storyforge-sso` plugin.
    The signer remained protected server-side; the feature flag stayed false;
    the allowlist and role overrides stayed empty; all seven administrators
    remained denied.
12. Created the isolated Cloudflare Worker `missionmed-storyforge-v5` and two
    route records:
    - exact route ID `37a1ba80b39043a08cc7b482cfa7e3c6`;
    - wildcard route ID `fcb362908f22443187a5b0541bf61a75`.
13. Live diagnosis proved those bindings inert because the production apex
    reaches Kinsta through a DNS-only record. No DNS record or unrelated route
    was changed. A diagnostic parser exposed a credential only in private tool
    output; the provider session was immediately logged out and no credential
    was persisted in Git or the handoff.

### Feature-off Kinsta attempts and rollback

14. Pushed gateway commit
    `94504372c710372ea121a0b62ad7094e893e026b` and installed it feature-off.
    Kinsta PHP-FPM could not read the sibling private release and Kinsta Nginx
    intercepted extension-bearing asset paths. The gateway failed closed.
15. Physically removed the active pointer and MU route. The first install and
    rollback used Kinsta's broad `purge_complete_caches(true)` helper, which
    invalidated object, site, and CDN caches. This over-broad mutation is
    recorded as an execution defect. Shared-site health and protected hashes
    passed afterward; the broad helper was not used again.
16. Filed DR-013 and pushed exact runtime repair
    `62ed421309c236d4b6ac05faca606108c0143592`.
17. Installed `62ed421...` feature-off at `2026-07-27T21:23:59Z`. Route,
    bundle, topology, aliases, direct-execution denial, protected hashes, and
    feature-off access checks passed. Repeat requests returned cache hits and
    `public, max-age=0, s-maxage=86400`.
18. Physically removed the route and `current` pointer at
    `2026-07-27T21:37:13Z`. Separate Kinsta site-cache and CDN-cache purges each
    returned HTTP 200. After propagation, the three representative StoryForge
    routes returned the prior WordPress 404.
19. Pushed the smallest cache-header repair
    `4bd956b6ea222d20428c41415236a73b93576447` at
    `2026-07-27T21:43:09Z`.
20. Installed that exact candidate feature-off at
    `2026-07-27T21:44:33Z`. Pass one returned the exact application policy with
    Cloudflare `DYNAMIC` and Kinsta `MISS`. Passes two and three kept
    Cloudflare `DYNAMIC` but changed Kinsta to `HIT` and again replaced the
    application policy with `public, max-age=0, s-maxage=86400`.
21. Classified the remaining defect as Kinsta managed server/full-page
    caching, not another source-code defect. Physically removed the exact route
    and active pointer at `2026-07-27T21:45:23Z`. Scoped site-cache and
    CDN-cache purges each returned HTTP 200.
22. Reverified the restored state after propagation: StoryForge route family
    returned the prior 404; the feature remained false; no account was
    enabled; protected Matrix and legacy assets remained exact.
23. Committed and pushed evidence checkpoint
    `07d620f8b788c2f2c01180a464b93b0c0dddf143`. The locally recorded
    `origin/b1-502-storyforge-production-deployment` ref matches that commit.
24. Performed a sanitized read-only safe-state verification at
    `2026-07-27T22:04:58Z`. The route and pointer remained absent; SSO remained
    active but feature-off with zero allowlist, role overrides, mentor
    overrides, mentor assignments, or mentor access. Five representative
    StoryForge paths returned 404 with Cloudflare `DYNAMIC`, private/no-store
    policy, and Kinsta `EXPIRED` or `MISS`. Protected hashes remained exact.
    Railway API/database deployments remained `SUCCESS`; the database retained
    three migration rows, RLS on all 15 application tables, and zero users,
    assignments, stories, or audit events. No mutation occurred.

## Decisions

- **GO** for isolated source, database/API, feature-off SSO, and repeated
  feature-off Kinsta validation.
- **NO_GO** for founder enablement because the repeated effective cache gate
  failed at Kinsta's managed server layer.
- **NO_GO** for declaring StoryForge live, Matrix-integrated in production, or
  founder-test ready.
- **ROLLBACK EXECUTED** after each Kinsta hard-gate failure.

## Current external gates

The exact Kinsta Support request, Founder same-UID decision, fresh
founder-authenticated WordPress binding, and narrow Cloudflare cleanup are
specified in `16_UNRESOLVED_EXTERNAL_ACTION.md`.

The current terminal outcome is
`BLOCKED — ONE HUMAN AUTHENTICATION ACTION REQUIRED`. The one requested action
is Google sign-in for the Cloudflare account controlling
`missionmedinstitute.com` in the already-open browser tab. MyKinsta is
authenticated and the exact Support request is prepared but unsent; sending it
remains subject to action-time confirmation. The downstream provider and
Founder gates remain preserved rather than silently inferred.

No production mutation should resume until the provider cache exclusion is
confirmed. The next production action is a feature-off reinstall of exact
commit `4bd956b6ea222d20428c41415236a73b93576447`, followed by the complete
three-pass gate set.
