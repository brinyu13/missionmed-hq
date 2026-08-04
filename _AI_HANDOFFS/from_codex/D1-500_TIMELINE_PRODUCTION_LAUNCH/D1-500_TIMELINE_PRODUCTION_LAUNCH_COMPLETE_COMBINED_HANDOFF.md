# D1-500 Timeline Production Launch Complete Combined Handoff

This file contains the complete, unabridged substantive content of every D1-500 Markdown report in this package.


---

<!-- SOURCE: D1_500_AUTHORITY_AND_SOURCE_MANIFEST.md -->

# D1-500 Authority and Source Manifest

- Governing authority: MissionMed Platform Constitution Revision 3, current
  Engineering OS, MR-079, DR-016, DR-017, and DR-018.
- Canonical repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Accepted base: `49ba56dacd2cddfc2fb2241839d54a03e85bc271`.
- Sealed source: `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`.
- Branch: `codex/d1-timeline-production-500`.
- Draft review: `https://github.com/brinyu13/missionmed-hq/pull/21`.
- Protected-system registration branch:
  `codex/d1-500-critical-registration`.
- Protected-system registration commit: `b75c789`.
- Protected-system registration review:
  `https://github.com/brinyu13/missionmed-hq/pull/22`.
- Protected presentation: D1-409H-A1.
- Protected active JavaScript SHA-256:
  `ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-c228658bc70bc395`.
- Static release-manifest SHA-256:
  `11284009e537b9eee790c9f3e90b41a59f615595ca3bd501b3ab613f4275854a`.
- WordPress runtime SHA-256:
  `c6f34f86e72bead2feaf2c725c22736c3e2d06e53b9cf232112ee45e4bfe6abc`.

Two clean release builds were byte-identical. Ignored binary assets were copied
only after verification against the accepted D1-413 asset manifest. Personal
sample-photo fixtures were excluded. The accepted presentation files were not
redesigned.

Live entitlement authority was verified directly on 2026-08-04: LearnDash post
`3893`, “Mission Residency: 360 Match Mentorship Student Dashboard & Guidance
Hub,” is published, uses Closed enrollment, and has course-level access
expiration disabled. Active LearnDash access to that exact course is the student
eligibility signal; WordPress login or role alone is insufficient.

Critical Systems reconciliation completed on 2026-08-04. USCE live
SHA-256 `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`
and Arena live SHA-256
`7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`
are byte-identical between private origin, public CDN, and their retained
deployment/source evidence. The approved metadata amendment and Timeline
protected-system registration are applied at `b75c789`; the resulting Critical
Systems gate passes 140 checks with 0 failures. No unauthorized live drift was
found and no protected application runtime was changed by the amendment.

Matrix recovery source is immutable, remotely reachable commit
`60e7169b544e6c93eb41f0de9717d8e61d2d49d0`. An official guard run from a
disposable archive of that commit passed all ten local/source, origin, and
public hashes. No Matrix override or production copy is required. Exact
reconciliation findings and the subsequently approved amendment are in
`D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md`.


---

<!-- SOURCE: D1_500_BACKUP_RESTORE_AND_ROLLBACK_RECEIPT.md -->

# D1-500 Backup, Restore, and Rollback Receipt

Local/disposable recovery proof: PASS.

- PostgreSQL proof cluster: `/tmp/d1-500-pg.Y5bd9y/data`, loopback port 55412.
- Custom-format backup:
  `/tmp/d1-500-pg.Y5bd9y/d1_500_proof.backup`.
- Backup SHA-256:
  `47543f7923a487870713b42e5e2ebb7d36bb5d19f9c3f72e0e666fc3aa9cd73f`.
- Isolated restore, schema validation, migration down-safety, and reapply: PASS.
- Feature kill switch: WordPress `timeline_enabled=false` and
  `rollout_stage=off`.
- Application rollback: restore the prior immutable Railway deployment.
- WordPress rollback: disable admission/navigation, restore the previous exact
  `current` pointer, then verify unrelated routes.
- Database rollback policy: preserve successful additive hardening migrations;
  restore only for verified corruption. Security-broadening down migration is
  prohibited.

Production recovery checkpoint at `2026-08-04T15:21:16Z`:

- Kinsta Timeline-scoped pre-state snapshot: PASS at
  `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- The plugin, MU route, Matrix Timeline asset directory, Timeline settings
  option, and Timeline plugin status are all recorded as absent with a verified
  SHA-256 manifest and mode-restricted files.
- Standard WP-CLI WordPress bootstrap exits with signal 139 while loading the
  existing production MU-plugin set. A non-mutating `WPMU_PLUGIN_DIR` isolation
  bootstrap succeeds and independently confirms the Timeline plugin and option
  are absent. No production MU plugin was changed or disabled for web traffic.
- Kinsta provider-native manual backup: BLOCKED because all five retained
  manual-backup slots are occupied. No existing backup was deleted.
- Railway provider-native volume backup: NOT RUN; provider UI authentication is
  required.
- Railway logical PostgreSQL backup: BLOCKED by
  `RAILWAY_SSH_UNAUTHORIZED`; no database command or migration ran.

The scoped snapshot is not a substitute for the mandatory fresh provider-native
Kinsta backup and Railway/PostgreSQL backups. No Timeline production payload may
be installed until those backups are READY and their provider receipts are
recorded.


---

<!-- SOURCE: D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md -->

# D1-500 Critical Systems Reconciliation

Prepared: 2026-08-04T14:42:16Z
Scope: read-only authority, source, private-origin, public-CDN, rollback, and
Matrix recovery-source reconciliation. No Kinsta, WordPress, Matrix, USCE,
Arena, CDN, R2, DNS, manifest, or other production state was changed.

## Verdict

The two Critical Systems asset failures are **not unexplained or unauthorized
production drift**.

| Check | Central pin | Verified live SHA-256 | Classification |
|---|---|---|---|
| `cdn_usce_admin_live` | `115aa040f57a0fdaf3f49f6e398423b93635633b901eb01d7ffc85142e91ddd4` | `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c` | Primary: stale/incomplete manifest. Secondary: source-repository synchronization problem. |
| `cdn_arena_live` | `19a519f583439056af56bcf513f2fb26f872369c458ac958093bde48d9acb12a` | `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705` | Primary: stale/incomplete manifest. Secondary: source-repository synchronization problem. |

Both current objects were created by documented, bounded production changes,
but those accepted bytes were never ratified into the active central manifest.
The current central `LIVE/` files match neither the old pins nor the live
objects, so they must not be used as deployment source.

## USCE proof

- Private R2 and public CDN are byte-identical: 172,888 bytes, SHA-256
  `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`.
- Public `Last-Modified`: `2026-06-29T19:40:48Z`.
- The retained post-deployment artifact is byte-identical:
  `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/CX-OFFER-337-USCE-ADMIN-LOGIN-COPY/_AI_BACKUPS/MM-USCE-ADMIN-ARCHIVE-PERSISTENCE-20260629T194005Z/usce_admin-after.html`.
- The deployment report records the exact transition from `115aa040...ddd4`
  to `9b6eade1...c29c`, live marker validation, the pre-change backups, and the
  rollback hash:
  `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/CX-OFFER-337-USCE-ADMIN-LOGIN-COPY/_AI_HANDOFFS/from_codex/MM-USCE-ADMIN-ARCHIVE-PERSISTENCE_FIX_REPORT.md`.
- Repeated fresh public downloads were byte-identical and contained all four
  required Critical Systems markers.

## Arena proof and safety caveat

- Private R2 and public CDN are byte-identical: 975,417 bytes, SHA-256
  `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`.
- Public `Last-Modified`: `2026-07-15T04:29:49Z`.
- The accepted source is byte-identical:
  `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4006/candidates/arena/arena.html`.
- The retained rollback capture is also byte-identical:
  `/Users/brianb/MissionMed_AI_Sandbox/_ROLLBACK/U1_GR_2518R_SHARED_20260715T154252Z/files/arena/arena.html`.
- Y1-CAM-4005R records the exact Arena deployment and final live hash;
  Y1-CAM-4006 preserves and verifies that same Arena baseline without changing
  it; Y1-CAM-4007 independently validates the accepted source hash.
- Repeated fresh public downloads were byte-identical and contained all three
  required Critical Systems markers.

This observed/accepted-byte reconciliation is **not an Arena safety
certification**. Y1-CAM-4008A separately records an open credential-logging P0
in the accepted `7bb0...` runtime and an undeployed redaction candidate. D1-500
must not edit, deploy, or imply remediation of Arena.

## Prior authority implementation

Commit `f23d7daeb289c7340ec4ab1903956cc4cfec282a` on pushed branches
`b1-502-storyforge-production-deployment` and
`codex/b1-503-storyforge-product-recovery` already implements these exact two
metadata pins and explains that neither USCE nor Arena was mutated. It is not in
`origin/main` and contains broad StoryForge registration, so it must **not** be
cherry-picked wholesale. Only the two asset-check changes may be reproduced in
a clean, scoped authority commit after Founder approval.

## Matrix recovery-source resolution

The Matrix source gap is resolved without a runtime override or production
copy. Immutable Git commit
`60e7169b544e6c93eb41f0de9717d8e61d2d49d0`, tree
`291a1f4dff573e2f64635ddd069ac9275f3984ff`, contains all ten current lock
assets at the exact canonical paths and hashes. It is remotely reachable from:

- `origin/codex/v1-study-schedule-production-connected-rc`;
- `origin/codex/v1-study-schedule-8010d-validation`.

The official Matrix guard was run from a disposable `git archive` extraction of
that immutable commit. All ten local/source hashes, production-origin hashes,
and requested public hashes matched; result: **PASS**. No Matrix source or live
asset was edited. A Matrix runtime-lock override is neither needed nor
recommended.

The clean local J1 File Vault implementation worktree independently contains
the same ten exact bytes, but immutable commit `60e7169b...` is the preferred
recovery reference because it is remotely reachable. These histories are
parallel; `60e7169b...` does not descend from J1.

## Exact bounded manifest amendment

After Founder approval, change only the following existing asset-check fields
in a clean D1-500 authority worktree. Set `last_updated_utc` to the amendment
commit time. Do not copy the broad StoryForge commit and do not touch live
objects.

```json
{
  "asset_checks": {
    "cdn_usce_admin_live": {
      "approved_sha256": "9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c",
      "local_source_note": "Metadata-only reconciliation to the documented 2026-06-29 archive-precedence repair. Private R2, public CDN, and retained post-deploy artifact are byte-identical. Central LIVE source remains SOURCE_SYNC_UNRESOLVED. No USCE runtime mutation is authorized by this amendment."
    },
    "cdn_arena_live": {
      "approved_sha256": "7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705",
      "local_source_path": "/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4006/candidates/arena/arena.html",
      "local_source_note": "Metadata-only reconciliation to the Y1-CAM-4005R deployed and Y1-CAM-4006/4007 validated baseline. Private R2, public CDN, accepted source, and retained rollback capture are byte-identical. Central LIVE source remains SOURCE_SYNC_UNRESOLVED. Open Y1-CAM-4008A credential-logging P0 remains unresolved; this pin is not a safety certification. No Arena runtime mutation is authorized by this amendment."
    }
  }
}
```

The amendment must also record Matrix recovery reference
`60e7169b544e6c93eb41f0de9717d8e61d2d49d0` and its ten-of-ten guard PASS as
source recovery evidence. It must not change any Matrix approved hash, version,
production path, or public URL.

## Timeline protected-system registration required before installation

Timeline is not yet represented in the active central Critical Systems
manifest. The same clean authority commit must register, while feature and
access remain off:

- system `timeline_builder`, owner `MissionMed Matrix / Founder`;
- runtime owner `railway_mission_timeline`, project
  `295b3d56-f555-4851-91f4-eb32d7dc88e1`, production environment
  `d0705d67-83d5-4b53-942d-3862d9906529`, API service
  `12bfaf69-f883-42b5-a380-b6beea49f251`, PostgreSQL service
  `134e537e-d48b-4452-acf6-8c3af2ce03db`, start command `npm start`, health
  path `/healthz`;
- WordPress owner `missionmed-timeline-sso` and MU owner
  `missionmed-timeline-route.php`;
- canonical routes `/timeline/`, `/timeline/api/**`, and
  `/wp-json/missionmed-timeline/v1/token`;
- protected source paths under `packages/mission-timeline/`,
  `wp-content/plugins/missionmed-timeline-sso/`, and the Timeline MU route;
- exact release `timeline-wp-c228658bc70bc395`, payload SHA-256
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`;
- default-off WordPress option `missionmed_timeline_settings` with
  `timeline_enabled=false` and `rollout_stage=off`;
- canonical eligibility authority: active LearnDash access to published Closed
  course `3893`, never WordPress login or generic role alone;
- anonymous redirect, feature-off denial, direct-API denial, health/release,
  canary, eligible-360, ineligible, revoked, logout, account-switch, and
  cross-student browser checks;
- fresh Kinsta and Timeline PostgreSQL backups before mutation; kill switch by
  setting Timeline rollout off; rollback limited to the Timeline plugin, MU
  route, immutable release pointer, API deployment, and Timeline-owned schema.

## Rollback-safe procedure after approval

1. Use the existing clean D1-500 worktree; do not touch the dirty canonical
   checkout.
2. Apply only the two asset-check changes, Matrix recovery-reference metadata,
   and Timeline registration above.
3. Validate JSON and review the exact protected-manifest diff.
4. Run the Critical Systems gate with network enforcement and the Matrix guard
   against an immutable extraction of `60e7169b...`.
5. Require zero asset, route, import, source, origin, or public mismatch.
   Protected-path dirtiness outside the clean worktree remains a global warning
   and cannot be relabeled as clean.
6. Commit and push the bounded authority amendment for review.
7. Before any production install, create and verify fresh Kinsta and Timeline
   PostgreSQL backups and confirm the exact provider targets.
8. Install only the sealed Timeline payload feature-off/access-off. Stop on any
   new failure or unexpected hash. Roll back only Timeline if verification
   fails.

## Founder decision required

The evidence is sufficient to amend stale metadata and register Timeline, but
the governing protected manifest cannot be changed under the current
reconciliation-only authorization. The release block remains active until the
Founder approves the bounded authority amendment and the clean gates pass.

Exact authorization wording:

> I, Brian, authorize D1-500 to modify the protected MissionMed Critical
> Systems manifest in the existing clean D1-500 worktree only. The amendment
> may (1) replace the USCE Admin approved SHA-256 with
> `9b6eade1c5e5d60044a418d6ec334958f037ba8ae948472673ad064a0862c29c`,
> (2) replace the Arena approved SHA-256 with
> `7bb0ad1cf1cf9e3d1fbaa021606d98fbd0000b2b0cac3898bce6c73225a37705`,
> (3) add the source-sync and Arena-P0 notes exactly recorded in
> `D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md`, (4) record immutable Matrix
> recovery source commit `60e7169b544e6c93eb41f0de9717d8e61d2d49d0`
> and its ten-of-ten guard PASS without changing any Matrix approved hash or
> production asset, and (5) register Timeline Builder's exact owners, protected
> paths, routes, Railway/PostgreSQL targets, release identity, default-off
> controls, checks, backups, kill switch, and rollback described in that
> report. This is metadata and registration authority only; it does not
> authorize any USCE, Arena, Matrix, CDN/R2, HQ, Supabase, DNS, Kinsta,
> WordPress, or other production mutation. Apply the amendment as a bounded
> reviewed commit, run the Critical Systems and Matrix gates, and stop on any
> new failure or unexpected hash. The Arena pin acknowledges observed accepted
> bytes and does not certify or waive the open Y1-CAM-4008A P0.


---

<!-- SOURCE: D1_500_DEPLOYMENT_AND_RELEASE_RECEIPT.md -->

# D1-500 Deployment and Release Receipt

- Sealed commit: `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-c228658bc70bc395`.
- WordPress payload archive:
  `artifacts/D1-500_KINSTA_FEATURE_OFF_PAYLOAD.tar.gz`.
- Payload SHA-256:
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`.
- GitHub draft PR: `https://github.com/brinyu13/missionmed-hq/pull/21`.
- Protected-system registration commit: `b75c789` on
  `codex/d1-500-critical-registration`.
- Protected-system registration draft PR:
  `https://github.com/brinyu13/missionmed-hq/pull/22`.
- Critical Systems gate: 140 PASS, 3 WARN, 0 FAIL.
- Matrix immutable-source/live guard: 10 PASS, 0 FAIL.
- Railway topology: created, access off, application not deployed.
- Kinsta/WordPress payload: prepared, not uploaded.
- Kinsta Timeline-scoped pre-state backup: READY at
  `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- Provider-native backup gate: BLOCKED; Kinsta manual capacity is 5/5 and
  Railway SSH/provider UI require Founder reauthorization.
- Production deployment identifier: NONE.
- Live URL: NOT LIVE.

The payload contains only the Timeline SSO plugin, its Matrix launch asset, the
Timeline MU route, and immutable runtime release
`timeline-wp-c228658bc70bc395`. It contains no secret value.


---

<!-- SOURCE: D1_500_EXECUTIVE_RELEASE_REPORT.md -->

# D1-500 Executive Release Report

Status as of 2026-08-04: **PARTIAL — production activation blocked at the
pre-mutation gate**.

The accepted Timeline Builder has been converted into a clean, deterministic,
default-off production candidate and pushed for review. The application and
security core pass 614 automated tests, API-only packaging, PHP lint, dependency
audit, and a disposable PostgreSQL forced-RLS proof. The isolated Railway
project, production/staging environments, API service, and PostgreSQL service
exist. No user access is enabled and no Kinsta/WordPress application bytes have
been changed.

The Critical Systems reconciliation and protected Timeline registration are now
applied on `codex/d1-500-critical-registration` at commit `b75c789` and pushed
for review in draft PR 22. The full protected-systems gate passes 140 checks
with 0 failures. Immutable Matrix commit `60e7169b...` contains all ten approved
source bytes, and the controlling Matrix guard passes local/source/origin/public
verification without override. The Critical Systems production block is closed.

The mandatory pre-mutation backup/access gate is still open. A verified,
mode-restricted Timeline-scoped Kinsta snapshot exists at
`/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`, but all
five provider-native Kinsta manual slots are occupied. Railway CLI topology
access works, while Railway SSH requires Founder reauthorization. No provider
backup was deleted, no database migration ran, and no Kinsta application byte
was installed.

One consolidated Founder intervention is required before execution can resume:

1. reauthorize Railway CLI/SSH with `railway login`;
2. install the named Railway and Kinsta/WordPress secrets without exposing their
   values to Git, terminal output, evidence, or chat;
3. authorize removal of one existing Kinsta manual backup, or increase provider
   backup capacity, so a fresh `D1-500-PRE-<UTC>` backup can be created; and
4. provide or authorize controlled fixtures for the remaining canary personas:
   Founder, second eligible student, non-360 student, and expired/revoked
   student. One administrator and one active 360 test identity are verified
   directly in production and are referenced only by opaque handles; no
   password is stored in this package.

Consent version `d1-500-v1` and PostgreSQL service ID
`134e537e-d48b-4452-acf6-8c3af2ce03db` are Founder-approved. After the remaining
actions, the saved checkpoint resumes at provider backups, database migration,
feature-off deployment, Kinsta install, Founder/admin canary, 360 rollout,
independent verification, and release seal.


---

<!-- SOURCE: D1_500_FOUNDER_ADMIN_CANARY_REPORT.md -->

# D1-500 Founder and Administrator Canary Report

Status: NOT RUN; production access remains disabled.

The sealed source and local harness pass student-canary, administrator-canary,
non-allowlisted denial, consent required/record/withdraw, JWT round trip,
entitlement-change rejection, and remote-sync authorization checks.

One administrator and one active 360 student test identity have been supplied in
the private task context. They are represented only by opaque handles
`D1-500-ADMIN-TEST-01` and `D1-500-STUDENT-360-01`; no password is stored in
evidence or Git. Required production journeys remain Founder student-persona
create/save/reload/export, approved administrator entry, unapproved
administrator denial, student denial during canary, second-user denial,
anonymous/direct-API denial, logout, account switching, stale-token rejection,
session expiry, health, logs, kill switch, and rollback. Founder, second eligible
student, non-360, and expired/revoked personas or controlled fixtures remain
unavailable.


---

<!-- SOURCE: D1_500_IDENTITY_ENTITLEMENT_AUTHORIZATION_AND_RLS.md -->

# D1-500 Identity, Entitlement, Authorization, and RLS

Identity is an immutable mapping from WordPress numeric user ID to a UUID
Timeline principal. The browser cannot supply or change that identity. Tokens
are short lived, bind issuer, audience, key ID, WordPress user, Timeline role,
course access, rollout stage, entitlement version, consent version, and remote
sync authority. Account or persona changes lock the local production client.

Student authorization requires all of: authenticated WordPress session, current
LearnDash access to course 3893, enabled rollout stage, immutable principal
mapping, and current consent version. Administrators require explicit canary
allowlisting and do not gain student-document access merely from the WordPress
administrator role. Access to a student record requires a separate exact,
time-bounded, audited resource grant.

Disposable PostgreSQL proof result: PASS.

- schema `d1-timeline-db-500.1`;
- 3 safe runtime roles;
- 0 least-privilege leaks;
- 0 public access surfaces;
- 0 tables without forced RLS;
- owner read/write: PASS;
- cross-student read/write denial: PASS;
- absent-course-entitlement denial: PASS;
- administrator without grant denial: PASS;
- exact administrator read grant: PASS;
- grant mutation, reuse, deletion, and missing-audit denial: PASS;
- grant revocation: PASS;
- immutable identity update denial: PASS.

Production result remains NOT RUN because the provider database migration and
principal fixtures are blocked before secret binding and canary identity
approval.


---

<!-- SOURCE: D1_500_IMPLEMENTATION_AND_CHANGE_LEDGER.md -->

# D1-500 Implementation and Change Ledger

Implemented and sealed at commit
`b668cc4d3eaa8075a357d35a60456fcaaaffa18c`:

- production release identity and required health release marker;
- execution-private WordPress runtime packaging with extensionless,
  content-addressed assets;
- accepted-asset authority verification and private-fixture exclusion;
- WordPress default-off route, canary and eligible-360 rollout stages;
- live LearnDash 3893 entitlement check;
- explicit student remote-sync consent record and withdrawal seams;
- immutable WordPress-user-to-Timeline-principal mapping;
- short-lived issuer/audience/key-bound JWT exchange;
- same-origin gateway and direct-API denial boundary;
- persona-bound IndexedDB cache and conflict-safe hybrid persistence;
- PostgreSQL D1-500 schema/grant hardening, forced RLS, and exact admin grants;
- dependency-aware health, sanitized logging, kill-switch controls, and rollback
  scripts.

Production provider changes completed:

- isolated Railway project, environments, API service, PostgreSQL service;
- non-secret, no-deploy API configuration only.

Production provider changes not completed:

- schema migration, runtime login binding, secret installation, API deploy;
- Kinsta backup, payload install, plugin activation, release pointer, route or
  navigation activation;
- canary and student rollout.


---

<!-- SOURCE: D1_500_KNOWN_LIMITATIONS_AND_FOLLOWUPS.md -->

# D1-500 Known Limitations and Follow-ups

Blocking:

- The approved Critical Systems amendment and Timeline registration are applied
  on `codex/d1-500-critical-registration`. The full protected-systems gate passes
  140 checks with 0 failures, and the controlling Matrix guard passes all 10
  local/source/origin/public checks. This authority blocker is closed.
- Railway SSH database connection reports unauthorized despite an authenticated
  CLI session. Founder provider reauthorization is required before the logical
  backup or migration.
- All five Kinsta manual-backup slots are occupied. Creating the mandatory fresh
  D1-500 provider backup requires Founder authorization to remove one existing
  manual restore point, or a provider-side capacity increase.
- Production secret installation is Founder-only under DR-018. The required
  names are `TIMELINE_JWT_SECRET` and `TIMELINE_GATEWAY_SECRET` on the Railway
  API service, and `MISSIONMED_TIMELINE_JWT_SECRET` and
  `MISSIONMED_TIMELINE_GATEWAY_SECRET` in the Kinsta live WordPress server-side
  runtime. No value is stored in this package.
- Standard Kinsta WP-CLI WordPress bootstrap crashes in the existing MU-plugin
  layer with exit 139. A CLI-only `WPMU_PLUGIN_DIR` isolation bootstrap works;
  web traffic and protected MU-plugin bytes remain unchanged. Timeline-only
  activation/configuration must use that bounded bootstrap or WordPress admin.
- One approved administrator and one active 360 test identity are verified in
  production. Founder, second eligible student, non-360, and expired/revoked
  identities or controlled fixtures remain required. No password is stored in
  this package.
- Consent version `d1-500-v1` is Founder-approved.
- Railway database display name remains provider default `Postgres`; stable
  service ID is recorded.
- The central Matrix checkout lacks the protected source files, but immutable
  remote commit `60e7169b...` contains all ten exact bytes and passes the
  official local/origin/public guard. This closes the recovery-byte gap without
  authorizing a source restore or live Matrix mutation.

Intentional release boundaries:

- Remote object storage is unconfigured and fails closed.
- Remote File Vault publication and File Vault v2 are disabled.
- Accepted local import and client-side export remain available.
- Administrator access never implies student-record access; explicit audited
  grants are required.

Unrelated state preserved:

- no Supabase, DNS, Cloudflare, StoryForge, shared Matrix asset, shared Railway
  service, LearnDash course, WooCommerce, user, or production data mutation;
- no unrelated dirty worktree cleanup or overwrite.


---

<!-- SOURCE: D1_500_LIVE_BROWSER_AND_VISUAL_VERIFICATION.md -->

# D1-500 Live Browser and Visual Verification

Local accepted presentation preview: PASS. The accepted 407F dark MissionMed
shell, orange primary actions, Home, File Vault, timeline canvas, Builder,
responsive behaviors, and client-side export remain present.

Sealed production bundle outside WordPress: PASS FAIL-CLOSED. Without a trusted
WordPress identity bootstrap it renders only “Timeline could not be loaded
safely.” This is the intended negative behavior, not a visual regression.

Live canonical route `https://missionmedinstitute.com/timeline/`: NOT LIVE at
the last verified probe. Authenticated production rendering, responsive
journeys, browser console, navigation discoverability, logout, account switch,
and live visual comparison remain NOT RUN.

No decorative screenshots were added to the package. In-thread previews were
used for the accepted app and fail-closed sealed runtime.


---

<!-- SOURCE: D1_500_LIVE_HEALTH_AND_OPERATIONS.md -->

# D1-500 Live Health and Operations

Local production handler health checks: PASS, including dependency failure,
timeout, recovery, release identity, and content-free errors.

Railway PostgreSQL has been provisioned but is not migrated. Railway API is not
deployed because required production secrets are intentionally absent.
Production Timeline health therefore has no live endpoint and is NOT RUN.

The service logs structured, content-free lifecycle events. Telemetry rejects
PII-shaped keys, URLs, tokens, unknown event types, and document content. Remote
media/object operations return a sanitized 503 until separately authorized
private storage exists. File Vault v2 remains disabled.

Operational activation order is database backup/migration, API deploy and
health, Kinsta backup/install feature-off, canary, rollback rehearsal, then
eligible-360 activation and early monitoring.


---

<!-- SOURCE: D1_500_PRODUCTION_ARCHITECTURE_AND_TARGETS.md -->

# D1-500 Production Architecture and Targets

The canonical route is `https://missionmedinstitute.com/timeline/` on the current
WordPress origin. WordPress owns session, live LearnDash entitlement, consent,
principal mapping, and short-lived JWT issuance. The same-origin gateway strips
WordPress cookies and forwards only a bounded gateway credential and Timeline
JWT to the isolated API. PostgreSQL owns Timeline records and forces RLS.

Verified targets:

- Kinsta company: `Brian's company`.
- Kinsta site: `MissionMed Institute`.
- Kinsta environment: `Live`.
- Kinsta company ID: `60d2928a-3253-4350-89e9-8f58a0827584`.
- Kinsta site ID: `abb6097b-9884-4b75-a9c7-d247728395cc`.
- Kinsta environment ID: `a23bbbca-55af-4d03-9447-1015a1e18dc8`.
- Kinsta public root: `/www/theresidencyacademy_209/public`.
- Railway workspace ID: `b6ab449c-1c87-46e0-95f8-3394c3ca7b14`.
- Railway project: `missionmed-timeline`
  (`295b3d56-f555-4851-91f4-eb32d7dc88e1`).
- Production environment: `d0705d67-83d5-4b53-942d-3862d9906529`.
- Staging environment: `2dd3eedd-c029-41ad-9e03-ae4e63ff7bf8`.
- API service: `mission-timeline-api`
  (`12bfaf69-f883-42b5-a380-b6beea49f251`).
- PostgreSQL service ID: `134e537e-d48b-4452-acf6-8c3af2ce03db`;
  provider display name is currently `Postgres` pending bounded rename or
  Founder acceptance of the stable ID.

Supabase, DNS, Cloudflare, StoryForge resources, and shared Railway services are
outside this topology and were not modified.


---

<!-- SOURCE: D1_500_STUDENT_ROLLOUT_REPORT.md -->

# D1-500 Student Rollout Report

Status: WITHHELD.

The canonical eligibility source is verified as current LearnDash access to
published course 3893 with Closed enrollment. Navigation and direct route remain
off. No student has been exposed to the release.

Direct production verification on `2026-08-04` confirmed that course `3893` is
published as “Mission Residency: 360 Match Mentorship Student Dashboard &
Guidance Hub,” uses Closed access, and has no course-level start, end, or expiry
window. The approved active-student handle resolves to WordPress user ID `141`,
and the authoritative `sfwd_lms_has_access(3893, 141)` check returns `true`.
The approved administrator handle exists and has `manage_options`. Credentials
were not printed, persisted, or added to evidence.

Required production evidence is not yet available for eligible students A/B,
non-360 denial, expired/revoked denial, cross-student isolation, direct-route
behavior, persistence, export, logout/re-entry, account switching, and
entitlement activation/revocation. Student activation is prohibited until the
Founder/admin canary and rollback gate pass.

The verified active 360 identity is referenced as `D1-500-STUDENT-360-01`; no
password is stored in this package. A second eligible identity plus non-360 and
expired/revoked personas or controlled fixtures are still required for the
mandatory isolation and denial proofs.
