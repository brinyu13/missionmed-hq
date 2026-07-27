# AVICENNA — Wave 2 Deployment-Gate Diagnosis

Recorded: `2026-07-27`

Scope: local diagnosis of the B1-502M Wave 1 findings and the committed
StoryForge V5 candidate.

Constraints honored:

- No production endpoint, provider API, SSH host, database, DNS service, or
  remote Git service was contacted.
- No production, remote, authority, configuration, or product-code state was
  mutated.
- No credentials, raw user identifiers, or private student data were read or
  recorded.
- Avicenna wrote only this report.

## Executive diagnosis

The candidate must not be deployed unchanged. The Wave 1 blockers are concrete
and locally repairable; none is an established external blocker.

The narrow production-safe repair is:

1. add an exact, default-empty WordPress user allowlist and force activation
   feature-off;
2. keep the founder's StoryForge application role `admin` for this founder-ready
   release and limit acceptance to the real admin/governance workspace;
3. preserve `no-store, private` for every API response at the application and
   edge;
4. bound logout/revocation with a 60-second production JWT and verify the old
   bearer is rejected by expiry plus the five-second verifier tolerance;
5. launch V5 from the current Matrix StoryForge entry with an isolated,
   founder-only plugin adapter, leaving protected Matrix and legacy V2 assets
   unchanged;
6. add a StoryForge-specific application-service deployment descriptor and
   support the hosting provider's injected `PORT`;
7. pin a dedicated StoryForge PostgreSQL target, backup/restore point, migration
   ledger, and least-privilege application login before changing the migration's
   explicit `UNPINNED` status;
8. restore the missing committed secret-scan script and extend tests to cover
   the production Worker and a second administrator.

## Local command observations

| Check | Result | Diagnosis |
|---|---|---|
| PHP syntax for `missionmed-storyforge-sso.php` | PASS | The current plugin parses. |
| Node syntax for `server/app.mjs` and `infra/edge/worker.mjs` | PASS | The current server and Worker parse. |
| `npm run scan:secrets --silent` | FAIL | `scripts/scan-bundle-secrets.mjs` is absent. The package script and integration runner both reference it. The path is also absent from commit `5ba56c7`. |
| `npm test --silent` | ENVIRONMENT FAIL | This worktree has no installed `node_modules`; imports of `jose` and `fflate` fail. Run `npm ci` before treating this as a code-test result. |

The missing scanner is a repository defect, not an authentication or provider
problem. The unit-test result is an unprepared local environment, not evidence
of a product regression.

## Root-cause matrix

### A1. Exact founder-only authorization is absent — RELEASE BLOCKER

Evidence:

- plugin defaults allow `student`, `mentor`, and `admin`;
- every `manage_options` user maps to `admin`;
- every mapped admin receives an automatically active entitlement;
- `mmsf_access_state()` checks only the global flag, role, student cohort, and
  entitlement;
- no exact WordPress user allowlist is evaluated.

Impact:

Enabling the current plugin for role `admin` enables every qualifying
administrator, not only the founder. Hiding navigation or omitting a database
row would not repair token issuance.

Smallest safe repair:

- add `allowed_user_ids` with an empty default;
- sanitize it to unique positive integer IDs;
- in `mmsf_access_state()`, after the global flag check and before role or
  entitlement evaluation, reject unless the current exact WordPress ID is in
  that list;
- use one stable error code such as `user_not_enabled`;
- make activation merge existing settings but always force
  `storyforge_enabled=false`;
- configure `allowed_roles=['admin']`,
  `allowed_user_ids=[exact founder ID]`, `allowed_cohorts=[]`, and no mentor
  roles for Stage B;
- keep the raw ID only in protected WordPress configuration; receipts should
  report a one-way digest and `allowed_user_count=1`.

Because navigation helpers, bootstrap, and token issuance all call
`mmsf_access_state()`, this one server-side gate covers those paths. The Node
API remains independently protected by the signed token and database identity.

Required tests:

1. founder admin: navigation present, bootstrap 200, token 200;
2. second admin with `manage_options`, a valid UUID mapping, and otherwise valid
   prerequisites: navigation absent, bootstrap 403 `user_not_enabled`, token
   unavailable;
3. student, mentor, anonymous, logged-out: denied;
4. feature off: everyone denied;
5. reactivation with a previously true option: feature remains off.

### A2. Founder WordPress identity and StoryForge role are different concepts

Evidence:

- `manage_options` always produces JWT `app_role=admin`;
- the V5 admin routes are Home, Students, Question Governance, and Audit;
- story capture, edit, and submit RPCs require a live `student` identity;
- database RLS intentionally gives admins no private-story override.

Diagnosis:

The founder's current WordPress account can safely launch V5 as a StoryForge
admin, but it cannot exercise the student story-authoring lifecycle. This is not
an SSO failure; it is the designed least-privilege role boundary.

Narrow disposition for `DEPLOYED — FOUNDER TEST READY`:

- create exactly one `sf_users` row matching the founder JWT subject,
  WordPress ID, role `admin`, and `eligible=true`;
- validate the real admin/governance workspace, empty-state behavior, Back to
  Matrix, and private-story denial;
- do not create demo students, stories, questions, assignments, or a dual-role
  identity;
- do not claim that founder validation covered student capture.

If a later acceptance run explicitly requires the founder to author a story,
add a protected exact-user application-role mapping to `student` and change the
single matching `sf_users` row in a transaction. Do not widen admin access, add
a client-side role toggle, or let one token act as both roles. That is a later
scoped test mode, not required for the initial founder-ready launch.

### A3. The production Worker downgrades private cache policy — RELEASE BLOCKER

Evidence:

- the Node origin starts responses with `Cache-Control: no-store`;
- the WordPress token response uses `no-store, private`;
- `worker.mjs` rewrites all non-HTML, non-fingerprinted responses, including
  `/storyforge/api/*`, to `Cache-Control: no-cache`;
- `no-cache` permits storage with revalidation;
- the current integration suite uses `local-router.mjs`, whose behavior does not
  reproduce this Worker rewrite.

Smallest safe repair:

- classify API paths before generic static policy;
- set API responses, API errors, and authenticated health failures to
  `Cache-Control: no-store, private`;
- preserve or strengthen an upstream `no-store` header, never weaken it;
- optionally set provider-specific CDN cache-control to `no-store` when
  supported;
- keep HTML `no-store, max-age=0`;
- keep only content-addressed assets public/immutable;
- configure a provider cache bypass for `/storyforge/api/*`, the WordPress
  bootstrap, the WordPress token route, `Authorization`, and WordPress cookies.

Required tests must call the actual Worker module with a fake origin, not only
the local router:

- 200 private JSON: `no-store` and `private`;
- 401/403/404 API JSON: `no-store` and `private`;
- HTML/deep link: `no-store`;
- fingerprinted asset: `public` and `immutable`;
- ordinary nonfingerprinted static response: not immutable;
- origin `no-store` cannot be downgraded.

### A4. Logout and entitlement revocation are bounded, not instantaneous

Evidence:

- the WordPress session and entitlement are rechecked only on bootstrap/token
  issue;
- an issued JWT is locally verifiable until `exp`;
- `jti` is not stored or checked;
- the verifier allows five seconds of clock tolerance;
- browser focus/visibility and scheduled refresh can lock the UI earlier, but
  do not revoke the old bearer server-side.

This is compatible with the MegaRun's explicit "revocation within TTL"
requirement if the bound is configured and measured.

Smallest founder-stage control:

- production `token_ttl_seconds=60`;
- record the maximum old-token bound as 65 seconds;
- verify WordPress logout or allowlist removal immediately prevents a new
  bootstrap/token;
- retain a captured old token only in test memory, prove it is rejected no later
  than 65 seconds, and never print it;
- verify focus/visibility promptly renders the truthful lockout;
- on emergency rollback, do not rely only on the WordPress flag: set the flag
  off and remove the edge route, which immediately prevents same-origin API
  use.

A revocation table, webhook, or per-request WordPress introspection would add a
new cross-system consistency service and is not warranted for the one-founder
pilot unless the 65-second bound is rejected.

### A5. The committed Matrix launch hooks are not consumed — RELEASE BLOCKER

Evidence:

- the plugin contributes `missionmed_matrix_navigation_items` and
  `missionmed_matrix_dashboard_tiles`;
- the inspected current Matrix source consumes neither filter;
- current Matrix PHP emits a fixed `storyforge` module;
- current Matrix JavaScript routes it to `#storyforge`;
- only the CAM route is transformed into an external `launch_url`.

The existing shortcode test proves a disposable WordPress page, not the real
Matrix shell.

Smallest safe repair:

- preserve the existing Matrix StoryForge module and legacy V2 assets;
- add a tiny script owned by the isolated SSO plugin;
- enqueue it only on the real member-dashboard page and only when
  `mmsf_user_can_enter()` passes the exact founder allowlist;
- use delegated, capture-phase handling for the current StoryForge Matrix link
  and dashboard controls, sending the founder to same-origin `/storyforge/`;
- handle the founder loading the existing `#storyforge` hash directly;
- when the feature is off or the plugin is deactivated, load no adapter, so the
  current legacy route remains unchanged for every user;
- retain Node/WordPress authorization as the real gate; the launch script is
  navigation only.

This avoids protected `missionmed-hub` edits. If a live browser proves the
isolated adapter cannot reliably intercept the exact current shell, stop that
approach and use a guarded two-file Matrix repair based on the exact current
locked PHP/JS source. Do not patch the stale untracked export.

Required validation:

- founder Matrix StoryForge control opens `/storyforge/` with no second login;
- another admin keeps the unchanged legacy behavior and cannot bootstrap V5;
- feature off/deactivation restores founder legacy behavior;
- Back to Matrix returns to `/member-dashboard/`;
- Dashboard, Calendar, Scheduler, File Vault, Messages, and legacy StoryForge
  remain healthy.

### A6. Application origin is not deployable from the current repository

Evidence:

- there is no StoryForge-specific `Dockerfile`, `railway.json`, `Procfile`, or
  equivalent service descriptor;
- the repository-root Railway descriptor starts
  `node missionmed-hq/server.mjs`, not StoryForge;
- StoryForge reads only `STORYFORGE_PORT` and ignores the common provider
  `PORT`;
- no application service/project/revision is pinned.

Smallest safe repair if Railway is confirmed as the origin provider:

- create `storyforge-v5/railway.json` with an explicit build
  (`npm ci` then `npm run build`), start (`npm start`), `/healthz` check, and
  bounded restart policy;
- configure the Railway service root as `storyforge-v5`, never the repository
  root HQ service;
- make `STORYFORGE_PORT` fall back to provider `PORT`;
- bind `0.0.0.0` in production;
- set `STORYFORGE_STATIC_DIR=dist`, exact public/Matrix origins, exact issuer and
  audience, and protected database/JWT references;
- leave all AI and R2 variables absent/false for founder launch;
- pin the service/project/environment, source commit, deployment ID, generated
  origin, and rollback revision in the receipt.

If direct provider evidence selects a different origin provider, create its
equivalent minimal descriptor. Do not reuse or mutate the existing MissionMed
HQ Railway service by inference.

### A7. Database target, migration history, and restore boundary are unpinned

Evidence:

- the migration itself says `Target project: UNPINNED — DO NOT APPLY OUTSIDE
  THE ISOLATED TEST HARNESS`;
- no StoryForge project is registered;
- the root linked Supabase project belongs to another product and is not
  StoryForge authority;
- no production `sf_*` collision query, migration ledger, app role, backup,
  PITR, RPO/RTO, or restore owner is recorded.

Narrowest safe target:

- prefer a dedicated StoryForge PostgreSQL/Supabase project;
- do not place V5 into RanklistIQ, Growth Engine, Scheduler, or any shared
  project merely because credentials exist;
- after direct provider evidence pins the project, update the migration target
  declaration/receipt and recalculate its hash;
- never run `seed_local.sql`;
- create only the exact founder `sf_users` row with role `admin`; create no
  mentor assignments or demo content;
- use a dedicated `storyforge_app` login that has no `BYPASSRLS`, no ownership
  of `sf_*` objects, and can `SET ROLE authenticated`;
- retain the deploy/migration credential separately from the app credential.

Required preflight, with connection material supplied through a protected
environment reference:

```sh
psql "$STORYFORGE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
  "select current_database(), current_user, current_setting('server_version_num');"

psql "$STORYFORGE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "select n.nspname, c.relname, c.relkind
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname like 'sf\\_%' escape '\\'
    order by c.relname;"

psql "$STORYFORGE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -P pager=off -c \
  "select rolname, rolcanlogin, rolinherit, rolbypassrls
     from pg_roles
    where rolname in ('anon','authenticated','storyforge_app')
    order by rolname;"

psql "$STORYFORGE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atc \
  "select to_regclass('supabase_migrations.schema_migrations'),
          exists(select 1 from pg_extension where extname='pgcrypto');"
```

Before apply:

- obtain a provider backup/PITR identifier and retention window;
- create a readable custom-format logical backup when provider policy permits;
- verify it with `pg_restore --list <backup-file>` without restoring over the
  live project;
- record migration-ledger pre-state and zero collision result;
- establish the exact restore process and an isolated restore target;
- do not use shared-database PITR merely to remove an additive StoryForge
  schema.

Apply only through the pinned project's approved migration-history mechanism
with `ON_ERROR_STOP`; the migration is transaction-bound. After apply, verify
all expected objects, RLS policies, grants, function owners, migration version,
and the production authorization matrix. Normal release rollback is feature
off plus route/plugin rollback, leaving the dormant additive schema intact.

### A8. Public health leaks the database name — RELEASE BLOCKER

Evidence:

- `healthCheck()` returns current database and server version;
- `/healthz` sends the database name to every caller;
- the edge exposes `/storyforge/healthz`.

Smallest safe repair:

- keep the internal database query, but return only
  `{"ok":true,"service":"storyforge-v5"}`;
- never return database name, version, host, project, or connection error
  details;
- retain the detailed failure only in protected provider logs, sanitized of
  credentials.

### A9. The secret-scan gate is missing from the commit — RELEASE BLOCKER

Evidence:

- `package.json` calls `scripts/scan-bundle-secrets.mjs`;
- `run-integration.sh` calls the same script before its test stack;
- the file does not exist in the current tree or B1-501 baseline;
- the command fails `MODULE_NOT_FOUND`.

Smallest safe repair:

- restore a tracked scanner that recursively inspects the built `dist` files;
- reject private-key blocks, service-role credentials, JWT signer material,
  provider secret names/values, and common live credential formats;
- permit only explicitly reviewed public identifiers;
- fail on unreadable or empty build output;
- test the scanner with safe and deliberately unsafe temporary fixtures;
- rebuild before scanning.

Do not preserve the B1-501 "bundle scan clean" claim as current proof. Generate
a fresh retained receipt from the repaired committed scanner.

### A10. `/storyforge` without the trailing slash is not owned explicitly

Evidence:

- Worker prefix matching requires `/storyforge/`;
- the configured route is only `missionmedinstitute.com/storyforge/*`;
- no canonical redirect for exact `/storyforge` is defined.

Smallest safe repair:

- pin explicit provider behavior for exact `/storyforge`;
- prefer a narrow 308 redirect to `/storyforge/` through a verified exact route
  or isolated WordPress redirect;
- never use a broad `storyforge*` route that can capture unrelated paths;
- verify the redirect disappears or restores its exact prior owner during
  rollback.

### A11. JWT verifier configuration needs production pinning

Evidence:

- WordPress emits HS256;
- the application prefers JWKS whenever both JWKS and the shared secret are
  configured;
- the verifier does not explicitly pin HS256 for the shared-secret mode;
- application validation accepts a nonempty shared secret, while WordPress
  requires at least 32 bytes;
- the application subject regex is looser than the WordPress UUID validator.

Smallest safe repair:

- for B1-502M, configure shared-secret mode only; leave JWKS unset;
- require the application secret to be at least 32 bytes;
- pin allowed algorithm `HS256` in shared-secret mode;
- use the same strict UUID pattern as WordPress;
- verify exact issuer, audience, and secret-presence fingerprint on both
  runtimes without printing the secret.

### A12. Audio confirmation bypasses the transaction-local identity helper

Evidence:

- almost all database access runs through `withIdentity()` and
  `SET LOCAL ROLE authenticated`;
- audio confirmation performs its final update through the base pool directly.

Founder-stage disposition:

- leave all R2 configuration absent so audio truthfully reports unavailable;
- prove `/api/audio/presign` returns the expected unavailable response;
- do not enable audio in B1-502M.

Before any later audio release, move confirmation into a role-checked database
function or a `withIdentity()` transaction with the necessary least-privilege
grant. A privileged production app connection must not be used to make the
current direct update work.

## Ordered local repair plan

1. WordPress plugin:
   - exact `allowed_user_ids`;
   - activation always feature-off;
   - founder-only Matrix launch adapter;
   - tests for founder and second admin.
2. Edge/server:
   - API `no-store, private`;
   - redacted health;
   - exact `/storyforge` canonical behavior;
   - production HS256/UUID validation.
3. Build/release:
   - restore tracked secret scanner;
   - add StoryForge-specific service descriptor;
   - add provider `PORT` fallback.
4. Database:
   - make no local target claim until direct provider evidence selects the
     dedicated project;
   - then update target declaration/hash, create restore evidence, apply through
     the real ledger, and insert only the founder admin identity.
5. Rerun all local validation and return the exact diff plus retained receipts
   to Sentinel before any production mutation.

## Exact local verification sequence after remediation

```sh
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5
npm ci
php -l ../wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php
node --check server/app.mjs
node --check server/auth.mjs
node --check server/config.mjs
node --check infra/edge/worker.mjs
npm run build
npm run scan:secrets
npm test
npm run test:postgres
npm run test:e2e
npm run test:integration
npm audit

cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502
git diff --check
git diff --exit-code -- storyforge-v5/dist
```

The revised suites must additionally prove:

- one exact founder admin allowed and a second fully qualified admin denied;
- all students and mentors denied for this launch;
- admin workspace loads against an empty, real schema;
- no fixture identity/session endpoint is available;
- API success and error responses are nonstoreable at origin and Worker;
- old bearer rejection occurs by TTL plus five seconds;
- the actual Matrix control launches V5 and plugin rollback restores legacy;
- exact `/storyforge` canonicalization, deep links, refresh, and route removal;
- health contains no database metadata;
- no demo records or fixture UUIDs exist;
- the app connection has no `BYPASSRLS` and cannot perform unauthorized direct
  table writes.

## Avicenna conclusion

There is no unknown failure requiring a broad redesign. The current no-go is
explained by specific local policy, cache, launch, deploy-descriptor, and
database-ownership gaps. The founder launch can remain narrow: one WordPress
account, StoryForge admin role, mentor disabled, audio disabled, AI disabled,
legacy V2 untouched, 60-second JWT, and a dedicated empty database with only
the founder identity.

After these local corrections pass and the real provider targets plus restore
points are pinned, Sentinel can evaluate a concrete feature-off mutation packet.

## Supervisor-validated closeout — 2026-07-27T22:10:13Z

The narrow security and authorization repairs described above are now present
in the exact pushed candidate. The isolated Railway API and PostgreSQL service
are healthy, the real PostgreSQL authorization suite passes, and the deployed
boundary rejects access without a valid authorized identity. Production
remains feature-off with an empty allowlist, empty role overrides, zero founder
cohort, zero mentor cohort, and no production fixture identity.

The `4bd956b6ea222d20428c41415236a73b93576447` cache repair correctly kept
Cloudflare `DYNAMIC`, but repeated requests were stored by Kinsta's managed
server/full-page cache and returned `X-Kinsta-Cache: HIT` with a rewritten
public cache policy. The active route and runtime `current` pointer were
removed immediately, scoped purges completed, and the prior 404 state was
restored. The protected Matrix and legacy StoryForge hashes remain exact
against the canonical lock under `/Users/brianb/MissionMed`; the delegated
copy in this worktree is stale and non-authoritative.

This is a secure rolled-back state. It does not authorize founder access.
Founder production acceptance remains pending:

1. a provider-applied server/full-page and corresponding edge-cache exclusion
   for paths beginning exactly with `/storyforge`;
2. a fresh founder-authenticated WordPress-to-UUID binding; and
3. explicit Founder acceptance of Kinsta PHP-FPM and the authorized deployment
   session sharing the same Unix owner for this exact one-founder pilot, or
   provider-enforced different-principal isolation.

File modes and per-request integrity checks remain defense in depth; they are
not same-principal compromise isolation. No student, mentor, other
administrator, or anonymous enablement is approved while these gates remain
open.
