# D1-500 Timeline Production Launch Combined Handoff

## Executive release report

Status as of 2026-08-04 is **PARTIAL — production activation blocked at the
pre-mutation gate**. The accepted Timeline Builder is a clean, deterministic,
default-off production candidate. The core passes 614 automated tests, API-only
packaging, PHP lint, dependency audit, and disposable PostgreSQL forced-RLS
proof. Isolated Railway production/staging topology exists. No Timeline user
access is enabled and no Kinsta application byte has changed.

Read-only reconciliation proves the unrelated USCE Admin and Arena failures are
stale central-manifest pins plus central-source divergence, not unexplained
production drift. Private origin, public CDN, and retained deployment/source
evidence match exactly. Immutable remote Matrix commit `60e7169b...` contains
all ten protected source bytes and passes the official local/origin/public
guard. No Matrix override is required. Kinsta mutation remains blocked until
the Founder approves the prepared central metadata amendment and registers
Timeline as a protected system.

One consolidated Founder intervention is required: approve the exact
metadata-only reconciliation and Timeline protected-system registration in
`D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md`; approve consent `d1-500-v1` and its
text; install the named Railway and Kinsta secrets without exposing values;
provide Founder, second eligible, non-360, and expired/revoked test personas or
controlled fixtures (one administrator and one active 360 identity are already
supplied only through the private task context); and
either rename Railway database service
`134e537e-d48b-4452-acf6-8c3af2ce03db` to
`mission-timeline-postgres` or approve its stable ID with display name
`Postgres`. Execution then resumes at migration, feature-off deployment, Kinsta
backup/install, canary, rollout, independent verification, and seal.

## Authority and source manifest

- Governing: Constitution Revision 3, current Engineering OS, MR-079, DR-016,
  DR-017, DR-018.
- Repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Accepted base: `49ba56dacd2cddfc2fb2241839d54a03e85bc271`.
- Sealed source: `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`.
- Branch: `codex/d1-timeline-production-500`.
- Review: `https://github.com/brinyu13/missionmed-hq/pull/21`.
- Protected presentation: D1-409H-A1; active JavaScript SHA-256
  `ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8`.
- Static release: `timeline-0c5cc515a76346d6`; manifest SHA-256
  `11284009e537b9eee790c9f3e90b41a59f615595ca3bd501b3ab613f4275854a`.
- WordPress runtime: `timeline-wp-c228658bc70bc395`; SHA-256
  `c6f34f86e72bead2feaf2c725c22736c3e2d06e53b9cf232112ee45e4bfe6abc`.

Two clean builds were byte-identical. Accepted binary assets were verified
before copy; personal fixtures were excluded; presentation was not redesigned.
Live entitlement authority is published LearnDash course 3893, “Mission
Residency: 360 Match Mentorship Student Dashboard & Guidance Hub,” with Closed
enrollment and no course-level expiration. Current LearnDash access to course
3893 is the eligibility signal; login or generic role is insufficient.

Critical Systems evidence now classifies the USCE live hash `9b6eade1...` and
Arena live hash `7bb0ad1c...` as documented releases missing from the stale
central manifest. Central `LIVE/` sources remain out of sync. Matrix immutable
source commit `60e7169b...` passes ten-of-ten local/origin/public checks. The
exact unapplied amendment is recorded in
`D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md`.

## Production architecture and targets

Canonical route is `https://missionmedinstitute.com/timeline/`. WordPress owns
session, live LearnDash entitlement, consent, principal mapping, and short-lived
JWTs. The same-origin gateway strips WordPress cookies and forwards only bounded
Timeline credentials to an isolated API. PostgreSQL owns records and forces RLS.

- Kinsta: `Brian's company` / `MissionMed Institute` / `Live`.
- Company ID: `60d2928a-3253-4350-89e9-8f58a0827584`.
- Site ID: `abb6097b-9884-4b75-a9c7-d247728395cc`.
- Environment ID: `a23bbbca-55af-4d03-9447-1015a1e18dc8`.
- Public root: `/www/theresidencyacademy_209/public`.
- Railway workspace: `b6ab449c-1c87-46e0-95f8-3394c3ca7b14`.
- Project: `missionmed-timeline`
  (`295b3d56-f555-4851-91f4-eb32d7dc88e1`).
- Production: `d0705d67-83d5-4b53-942d-3862d9906529`.
- Staging: `2dd3eedd-c029-41ad-9e03-ae4e63ff7bf8`.
- API: `mission-timeline-api`
  (`12bfaf69-f883-42b5-a380-b6beea49f251`).
- PostgreSQL: `134e537e-d48b-4452-acf6-8c3af2ce03db`, display name `Postgres`.

Supabase, DNS, Cloudflare, StoryForge, and shared Railway services are excluded
and untouched.

## Implementation and change ledger

The sealed commit adds production release identity; required health markers;
execution-private WordPress packaging; extensionless content-addressed assets;
accepted-asset validation; default-off canary/eligible-360 stages; live
LearnDash entitlement; student consent record/withdrawal; immutable principals;
short-lived JWT exchange; same-origin gateway; direct-API denial; persona-bound
IndexedDB; hybrid persistence; D1-500 database/grant hardening; forced RLS;
exact admin grants; dependency health; sanitized logs; kill switch; and rollback
scripts. Railway topology and non-secret no-deploy configuration exist. Schema,
runtime login, secret binding, API deploy, Kinsta install, route/navigation,
canary, and rollout are not complete.

## Identity, entitlement, authorization, and RLS

WordPress numeric user ID maps immutably to a UUID principal. Browser identity
input is never trusted. Tokens bind issuer, audience, key, WordPress user,
Timeline role, course access, rollout stage, entitlement version, consent, and
remote-sync authority. Account/persona changes lock the client.

Student access requires session, live course-3893 access, rollout admission,
mapped principal, and current consent. Administrators require explicit canary
allowlisting and a separate exact audited grant for any student record.

Disposable RLS proof: PASS, schema `d1-timeline-db-500.1`, 3 safe runtime roles,
0 privilege leaks, 0 public surfaces, 0 tables without forced RLS. Owner
read/write, cross-student denial, absent-entitlement denial, admin-without-grant
denial, exact read grant, revocation, grant immutability/audit, and immutable
identity checks pass. Production is NOT RUN pending migration and identities.

## Backup, restore, and rollback

Disposable recovery proof passes. Cluster is
`/tmp/d1-500-pg.Y5bd9y/data` on loopback port 55412; backup is
`/tmp/d1-500-pg.Y5bd9y/d1_500_proof.backup`, SHA-256
`47543f7923a487870713b42e5e2ebb7d36bb5d19f9c3f72e0e666fc3aa9cd73f`.
Isolated restore, schema validation, down-safety, and reapply pass.

Kill switch is `timeline_enabled=false`, `rollout_stage=off`. Application
rollback restores a prior immutable Railway deployment. WordPress rollback
disables admission/navigation and restores the previous exact current pointer.
Successful additive database hardening remains unless corruption requires an
isolated restore; security-broadening down migration is prohibited. Production
Kinsta and database backups are NOT RUN because the pre-mutation gate is red.

## Founder and administrator canary

NOT RUN; production access is disabled. Local harness checks pass student and
administrator canary, non-allowlisted denial, consent required/record/withdraw,
JWT round trip, entitlement-change rejection, and remote-sync authority.
One administrator and one active 360 identity are available only through opaque
private task handles; no password is recorded. Founder save/reload/export, approved admin,
unapproved admin denial, student denial during canary, second-user denial,
anonymous/direct API denial, logout, switching, stale token, session expiry,
health, logs, kill switch, and rollback remain required.

## Student rollout

WITHHELD. Eligibility authority is verified as current LearnDash access to
published course 3893 with Closed enrollment. Navigation and route remain off.
Eligible A/B, non-360, expired/revoked, cross-student, direct-route,
persistence, export, logout/re-entry, switch, and entitlement-change production
journeys remain required. Activation cannot precede canary and rollback PASS.

## Browser and visual verification

The accepted local presentation passes: 407F MissionMed shell, Home, File Vault,
timeline canvas, Builder, responsive behaviors, and client export remain. The
sealed production bundle outside WordPress correctly fail-closes with “Timeline
could not be loaded safely” because no trusted bootstrap exists. The live route
is not live. Authenticated production render, responsive journeys, console,
navigation, logout, switch, and visual comparison are NOT RUN. No decorative
screenshots were added; substantive in-thread previews were used.

## Deployment and release receipt

Source and release identifiers are listed above. Feature-off payload is
`artifacts/D1-500_KINSTA_FEATURE_OFF_PAYLOAD.tar.gz`, SHA-256
`e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`.
It contains only the Timeline SSO plugin, launch asset, MU route, and immutable
runtime, with no secret. Railway topology exists but API is not deployed.
Kinsta payload is prepared but not uploaded. Production deployment ID is NONE;
live URL is NOT LIVE.

## Live health and operations

Local production health checks pass dependency failure, timeout, recovery,
release identity, and content-free errors. Railway PostgreSQL is provisioned but
unmigrated. API is undeployed because governed secrets are absent; live health
is NOT RUN. Logs are structured and content-free. Telemetry rejects PII-shaped
keys, URLs, tokens, unknown events, and document content. Remote media/object
operations return sanitized 503; File Vault v2 is disabled. Activation order is
backup/migration, API health, Kinsta backup/install feature-off, canary,
rollback rehearsal, eligible-360 activation, and monitoring.

## Known limitations and follow-ups

Blocking: Founder approval to apply the proven USCE/Arena metadata amendment and
register Timeline; Railway SSH database connection unauthorized despite
authenticated CLI; Founder-only secrets; remaining negative/isolation personas;
consent approval; provider-default PostgreSQL display name. Arena's accepted
runtime retains a separately documented credential-logging P0; D1-500 does not
remediate or certify Arena. Intentional boundaries: remote storage unavailable
and fail closed; remote File Vault/v2 disabled; local import and client export
retained; administrators require audited resource grants.

No Supabase, DNS, Cloudflare, StoryForge, shared Matrix asset, shared Railway
service, LearnDash course, WooCommerce, user, production data, unrelated dirty
worktree, or unrelated application state was modified.
