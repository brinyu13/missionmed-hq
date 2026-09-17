# F2-LOR-1012 Phase 1 Sanitized Resource-Binding Receipt

Record-creation status: `PARTIAL_CANDIDATE / NOT_STAGED / NOT_COMMITTED / NOT_PUSHED / NOT_INDEPENDENTLY_VERIFIED`

Mission: `F2-LOR-1012`

Observation date: `2026-08-13`

This receipt records only sanitized Phase 1 facts. It authorizes no provider,
configuration, data, route, deployment, email, Matrix, user, or production
mutation. It is not a resource-binding PASS, a production-readiness claim, or
an AAA-live claim.

The record-creation status above is intentionally historical. Canonical Git
custody and fresh independent review must be resolved from external commit,
remote, and verdict evidence; neither can turn this partial receipt into a
resource-binding PASS while required fields remain unresolved.

## Authority and custody

| Surface | Classification | Sanitized fact |
| --- | --- | --- |
| MissionMed OS | `AUTHORITY_VERIFIED` | Canonical `main` and `origin/main` are `357470ae8e8b89f0f756af35d1583cafe2bd3fea`. Universal and `F2-LOR-1012` BOOT dependency validation passed. |
| Dark-launch authority | `AUTHORITY_VERIFIED` | DR-073 and DR-074 are canonically filed at `357470ae8e8b89f0f756af35d1583cafe2bd3fea`; the coordinating task records a fresh inherited-context-free non-builder PASS. |
| Product repository | `REPOSITORY_VERIFIED` | `brinyu13/missionmed-hq`, worktree `/Users/brianb/MissionMed_worktrees/F2-LOR-1009`, branch `codex/f2-lor-1009-production-release`. |
| Product custody | `REPOSITORY_VERIFIED` | Clean tracked and index state at `fd67883ac4ff07e9b849d9cc1efbf708bac179e2`; exact upstream branch is at the same commit. |
| Accepted implementation | `REPOSITORY_VERIFIED / CONTRACT_MOCK_ONLY` | `60587386451d616f798e93c0730d124e9a7e17fc`; this is bounded contract and mock behavior only, not a live driver, migration, deployment, or provider proof. |
| Base divergence | `REPOSITORY_VERIFIED` | The product branch is 2 commits behind and 29 commits ahead of current `origin/main` at `139ae65fcdc6a78c7c23c06f8a63a267494dba9c`. No merge, rebase, or reconciliation is authorized by this receipt. |
| Pull request | `GITHUB_VERIFIED` | PR `#24` is open and draft. Its head custody is the product branch above; it is unmerged and is not production evidence. |

PR `#24` has zero submitted reviews, zero review threads, zero commit statuses,
zero check runs, and zero branch workflow runs at its current head. GitHub's
combined status is `pending` only because no statuses exist; it is not a
running or passing release gate. The current pull request changes 92 files and
contains inherited non-LOR/shared history, so final promotion requires a fresh
exact-scope lineage audit.

## Evidence and sanitization boundary

The connected background in-app Browser provider tabs were unauthenticated.
No login, cookie, session, browser storage, credential, masked value, form,
toggle, save, download, export, screenshot, or provider mutation was used.

The Supabase facts below came from the connected read-only Supabase provider
integration and were reduced in memory to the allowlisted fields in this
receipt, not from an authenticated Browser tab. A fresh bounded refresh began
at `2026-08-13T17:09:43Z` and ended at `2026-08-13T17:09:50Z`.

This receipt includes only reviewed identifiers, public routes, regions,
versions, hashes, counts, booleans, and status classes. It includes no row
bodies, user or faculty records, protected content, provider bodies, headers,
cookies, sessions, environment or variable values, API keys, connection
material, private endpoints, logs, or advisor finding bodies.

## Current provider-verified Supabase inventory

Evidence source: approved read-only sanitized provider inventory.

Classification: `PROVIDER_VERIFIED / PHASE_1_PARTIAL`.

| Field | Sanitized current fact |
| --- | --- |
| Project ref | `fglyvdykwgbuivikqoah` |
| Project name | `missionmed-ranklistiq` |
| Region | `us-east-2` |
| Health | `ACTIVE_HEALTHY` |
| PostgreSQL version | `17.6.1.063` |
| Migration version records | `71` |
| Migration-version digest | SHA-256 `79506c317476f892266c960e761d3adc697a908514aaa9e9fc681c7966bb3173`; the version list is intentionally not reproduced here. |
| `lor_studio` tables | `0` |
| `public` tables | `119`; RLS enabled on all 119 observed tables. |
| `storage` tables | `8`; RLS enabled on all 8 observed tables. |
| `auth` tables | `23`; 7 observed platform OAuth/WebAuthn tables have RLS disabled. |
| `supabase_migrations` tables | `1`; the platform migration ledger table has RLS disabled. |
| Security advisor findings | `271` total: `31 INFO`, `7 ERROR`, `233 WARN`. Finding bodies are not captured. |
| Performance advisor findings | `624` total: `228 INFO`, `396 WARN`. Finding bodies are not captured. |

The migration digest was computed by sorting the 71 records ascending by
`version`, then `name`; serializing a compact JSON array of exact objects with
keys in the order `{name,version}`; and hashing the bytes formed by the domain
prefix `missionmed.f2_lor_1012.supabase_migration_versions.v1` followed by one
NUL byte and the 4,779-byte canonical JSON. No migration name or version is
recorded in this receipt.

The seven observed platform OAuth/WebAuthn tables with RLS disabled are:

- `auth.oauth_clients`
- `auth.oauth_authorizations`
- `auth.oauth_consents`
- `auth.oauth_client_states`
- `auth.custom_oauth_providers`
- `auth.webauthn_credentials`
- `auth.webauthn_challenges`

These provider facts establish current project identity and sanitized inventory
only. They do not establish an LOR schema, applied LOR migrations, LOR RLS,
private LOR Storage, backup, restore, rollback, service-role custody,
application connectivity, or production readiness. Project-wide advisor
counts are not an LOR-specific security or performance PASS. No protected row
body or configuration value was read, retained, or changed.

## Railway and HQ runtime

### Repository-verified source contract

| Field | Classification | Sanitized fact |
| --- | --- | --- |
| Deployment config | `REPOSITORY_VERIFIED` | `railway.json`, SHA-256 `ed1a059b7d14967654743a9958933f91d1b6ae46fa03c7557015487e68f1e8de`. |
| Builder | `REPOSITORY_VERIFIED` | `NIXPACKS`. |
| Start command | `REPOSITORY_VERIFIED` | `node missionmed-hq/server.mjs`. |
| Restart policy | `REPOSITORY_VERIFIED` | `ON_FAILURE`, maximum 10 retries. |
| Runtime source | `REPOSITORY_VERIFIED` | `missionmed-hq/server.mjs`, SHA-256 `140bc7f61782eded6bcd4d4f90863115f7b2af1e650eca89bf0495481a11437b`. |
| Source health routes | `REPOSITORY_VERIFIED` | `GET /health` and `/api/health` exist in source. No live response is claimed. |
| Source feature default | `REPOSITORY_VERIFIED_NOT_LIVE` | `MMHQ_LOR_STUDIO_ENABLED=false`. |
| Source kill-switch default | `REPOSITORY_VERIFIED_NOT_LIVE` | `MMHQ_LOR_STUDIO_KILL_SWITCH=true`. |
| Source canary default | `REPOSITORY_VERIFIED_NOT_LIVE` | `MMHQ_LOR_STUDIO_REQUIRE_CANARY=true`. |
| Source entitlement state | `REPOSITORY_VERIFIED_NOT_LIVE` | Runtime uses a fail-closed unavailable resolver with reason `exact_learndash_360_contract_unverified`. |

The three source defaults are code fallbacks only. They do not prove deployed
production configuration, configuration presence, current feature state, or
live denial behavior.

### Historical candidate, not current target binding

The following values are preserved only as historical candidates:

- project `missionmed-hq-fix005`, ID
  `29afe885-b9b1-425d-8fd8-8611cd275409`;
- environment `production`, ID
  `ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`;
- service `missionmed-hq`, ID
  `3d18b017-4fc9-4b22-b097-ba879816d374`; and
- public domain `missionmed-hq-production.up.railway.app`.

Classification: `HISTORICAL_CANDIDATE_ONLY / CURRENT_PROVIDER_UNRESOLVED`.

Current Railway account, project, environment, service, source binding,
deployment ID, deployed commit, runtime command, domains, health,
configuration-presence flags, monitoring, backup, restore, and rollback target
have not been provider-verified in this Phase 1 receipt. The historical values
may not be used as mutation targets by inference.

One background in-app Browser navigation to the historical candidate's public
`/health` route was attempted without cookies or authorization and was blocked
by the Browser client before an HTTP response was observed. It was not retried.
That client-side result proves no route, TLS, application, or health state.

### Current GitHub deployment evidence

Classification: `GITHUB_VERIFIED / RAILWAY_TARGET_CONTRADICTION`.

GitHub currently records four Railway deployment environments:

| GitHub environment | Environment ID | Latest deployment | Source | Status |
| --- | ---: | ---: | --- | --- |
| `adequate-reflection / production` | `13642831715` | `5881261593` | current `main` `139ae65fcdc6a78c7c23c06f8a63a267494dba9c` | `failure` |
| `athletic-strength / production` | `13643998429` | `5881261482` | current `main` `139ae65fcdc6a78c7c23c06f8a63a267494dba9c` | `success` |
| `missionmed-hq-fix005 / production` | `13720818632` | `5187833682` | historical `420c36693d426b1d24d4001e710304451886451c` | `inactive` |
| `robust-tranquility / production` | `13632367525` | `5881261559` | current `main` `139ae65fcdc6a78c7c23c06f8a63a267494dba9c` | `success` |

The current-`main` deployment metadata maps those three current environments
to Railway project/environment pairs:

- `adequate-reflection`: project
  `efd41aa5-6a64-4024-8e82-fc0dfb702a34`, environment
  `1a84a17c-6021-4457-92d8-9dd1e665ed3d`;
- `athletic-strength`: project
  `018803ac-12ad-426a-ba00-031adc70fc83`, environment
  `82ec2b8e-3608-41ea-85d1-f9bcd58773f5`; and
- `robust-tranquility`: project
  `bf3e98ee-6c6e-4088-91a8-aed91747dadf`, environment
  `b0f15a1d-2b6e-428e-b93b-5169c7bf00e2`.

The `fix005` historical candidate maps to project
`29afe885-b9b1-425d-8fd8-8611cd275409` and environment
`ed3353f7-bcc7-4e25-a000-3c9fc628a9a7`, but its latest GitHub deployment is
inactive. No GitHub deployment exists for accepted implementation
`60587386451d616f798e93c0730d124e9a7e17fc` or current product custody
`fd67883ac4ff07e9b849d9cc1efbf708bac179e2`.

GitHub therefore prevents treating `fix005` as current but cannot select one
of the other three projects as canonical. GitHub Actions contains zero
repository or environment secrets and zero repository or environment
variables across the four environments. This proves only that GitHub Actions
holds no such configuration; it does not prove absence from Railway or another
provider secret store. Exact Railway identity, active deployment, public URL,
runtime configuration presence, health, and rollback remain `UNRESOLVED`.

## WordPress, MyKinsta, and LearnDash

| Field | Classification | Sanitized fact |
| --- | --- | --- |
| LOR WordPress contract candidate | `REPOSITORY_VERIFIED_NOT_LIVE` | `wp-content/mu-plugins/missionmed-lor-studio-contract.php`, version `0.1.0`, SHA-256 `dda48fcebb9cbcbbdd0baa5998c19316d926072049899a8a402faa575cefd03a`; explicitly unbound and feature-off. |
| HQ entitlement consumer | `REPOSITORY_VERIFIED_NOT_LIVE` | `missionmed-hq/lor-studio/adapters/wordpress-entitlement-consumer.mjs`, SHA-256 `f5d1369013f20919dccda7bfa2124f950255860ffe3e7aeca08be84c9f07eb92`. |
| LearnDash admission identifier | `CANDIDATE_ONLY` | Course `3893`; no live current course, group, product, purchase, expiry, restriction, removal, or revocation binding exists. |
| Auth-handoff canonical source | `REPOSITORY_VERIFIED_NOT_LIVE` | `origin/main` has version `1.0.1`, SHA-256 `e1a68de6de4c4909598d7b2adc3da540d67c858a240d51c607b8d65d2199c9cf`. The clean product worktree matches this hash. |
| Separate local auth-handoff hotfix candidate | `REPOSITORY_DIVERGENCE_NOT_CURRENT_HEAD` | Previously observed version `1.0.2`, SHA-256 `89c3a9496253989ef6ce536516724253338dcd390992b601e7ca2d29e8ae658c`; it is not the clean product HEAD source and is not a deployment target. |
| Historical live auth-handoff observation | `HISTORICAL_ONLY` | Version `1.0.4`; no current provider or byte proof binds that historical observation now. |

Current WordPress/MyKinsta site and environment identity, WordPress and
LearnDash versions, live plugin bytes, LOR plugin presence, identity producer,
server-side `brinyu` and `brinyu_test` principal binding, 360 entitlement
producer, exact admission identifiers, freshness, expiry, restriction,
revocation, backup, restore, and rollback are `UNRESOLVED`. Repository and
historical facts do not prove live behavior.

## Cloudflare/R2, Postmark, monitoring, backup, and rollback

The following are all `UNRESOLVED_CURRENT_PROVIDER`:

- Cloudflare account and whether R2 is the canonical LOR storage plane;
- any LOR bucket, prefix, policy, encryption, versioning, retention, deletion,
  backup, restore, or rollback identity;
- whether Supabase Storage, R2, or another approved existing plane owns LOR
  objects;
- Postmark account, server, sender, stream, template, controlled recipient,
  suppression, bounce, complaint, rate, privacy, and rollback contracts;
- production logging and redaction contracts;
- monitoring checks, alert destinations, restart behavior, and accountable
  owners; and
- current readable recovery points and executable restore and rollback paths
  for Railway, Supabase, storage, WordPress, Matrix, and feature state.

No duplicate storage plane, bucket, prefix, sender, route, or service may be
created to bypass these unresolved bindings.

## Critical Systems and Matrix custody

Classification: `REPOSITORY_VERIFIED_BLOCKER`.

The expected canonical Critical Systems contract and manifest are absent from
the fetched `missionmed-hq` `origin/main` tree at
`139ae65fcdc6a78c7c23c06f8a63a267494dba9c`. Local-only copies, if present
elsewhere, are not canonical deployment authority.

The local MissionMed worktree has unrelated tracked modifications in
`_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`. The file was inspected
read-only and was not edited, staged, cleaned, reset, or used as a deployment
baseline. Its owner, canonical source, exact accepted diff, current runtime
hashes, Kinsta backup, guard result, and rollback remain unresolved.

These conditions do not invalidate this read-only receipt candidate. They are
hard stops before any corresponding protected HQ, Railway, WordPress,
Supabase-routing, CDN/R2, or Matrix mutation.

## Population and untouched surfaces

The intended later populations remain policy only, not current live proof:

1. the two server-resolved WordPress administrator principals that current
   authority must bind to `brinyu` and `brinyu_test`; and
2. only after named-canary PASS, current server-verified eligible and
   rollout-enabled Mission Residency 360 students with no expiry, restriction,
   removal, or revocation.

Anonymous users, ordinary or non-allowlisted administrators, non-360 students,
expired or revoked students, direct-route callers without current server
authorization, unrelated faculty, and search engines remain deny classes.
Faculty receive no general LOR application access.

StoryForge, Timeline, File Vault, RISE, unrelated Matrix modules, shared
WordPress identity producers, root `supabase/migrations/**`, unrelated schemas,
unrelated storage, and unrelated provider configuration remain untouched.

## Exact blocker and Phase 1 disposition

Phase 1 remains `PARTIAL / NOT PASSED`.

For every unresolved provider class, the exact next prerequisite is either:

1. an existing authenticated background provider session, with the smallest
   Founder manual sign-in or MFA step if required; or
2. a separately approved no-write sanitizer that emits only fixed, reviewed,
   non-secret fields.

No foreground Chrome takeover, secret retrieval, cookie or session inspection,
provider action, configuration write, mutation, deployment, migration, user
activation, email, or Matrix change is authorized. A complete sanitized
target-binding receipt must resolve current provider identities, exact
observation timestamps, deployment and runtime custody, backup, restore,
rollback, monitoring, storage topology, Critical Systems custody, and Matrix
custody, then be committed, pushed, and freshly independently approved before
any later production mutation can open.
