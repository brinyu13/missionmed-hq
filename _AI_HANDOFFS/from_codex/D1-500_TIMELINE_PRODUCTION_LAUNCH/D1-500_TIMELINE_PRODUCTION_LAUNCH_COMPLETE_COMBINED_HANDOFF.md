# D1-500 Timeline Production Launch Complete Combined Handoff

Checkpoint status: PARTIAL. Timeline is installed feature-off/access-off and is not live to authorized users.

This document contains the complete, unabridged substantive content of every D1-500 Markdown report in this package.

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
- Provider checkpoint commit: `16fe6a4`.
- Deployment-config repair commit: `7cf30eb`.
- Registered Critical Systems manifest SHA-256:
  `4c7694b47e9112822f0424fc59f8705ec6bf5b5dcbb3a95b63513e6f213c88e2`.
- Matrix runtime-lock manifest SHA-256:
  `f80463b2ff43340aaf460e43f90c6383117b78e1c3e4c905daba34291ac045f2`.
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

Current execution lineage is accepted source `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`,
protected-system registration `b75c789`, provider checkpoint `16fe6a4`, and
deployment-config repair `7cf30eb`, on branch
`codex/d1-500-critical-registration` under draft review 22. The package manifest
is regenerated after every substantive evidence change and is the controlling
hash receipt for the final evidence set.

<!-- SOURCE: D1_500_BACKUP_RESTORE_AND_ROLLBACK_RECEIPT.md -->

# D1-500 Backup, Restore, and Rollback Receipt

Local/disposable recovery proof: PASS.

- Prior disposable PostgreSQL restore/down/reapply proof: PASS.
- Feature kill switch: `timeline_enabled=false`, `rollout_stage=off`.
- Database rollback policy: preserve successful additive hardening migrations;
  restore only for verified corruption.

Production recovery receipts:

- Timeline-scoped Kinsta snapshot: PASS at
  `/www/theresidencyacademy_209/private/d1-500-backups/20260804T152116Z`.
- Deleted provider backup: exactly `B1-508 pre deployment 2026-07-31`, after
  re-verifying it was the oldest manual backup, the August 4 daily backup and
  all four newer manual backups remained, the D1-500 snapshot remained intact,
  and matching B1-508 private recovery artifacts existed locally and remotely.
  The deleted MyKinsta manual item is not recoverable through MyKinsta; its
  verified private recovery sets remain.
- Replacement provider backup: `D1-500-PRE-20260804T161859Z`, created August 4
  at 12:19 PM EDT, expires August 18, READY with a restore control.
- Railway provider-native PostgreSQL volume backup: created August 4 at 12:20
  PM EDT, manual, 843 MB, READY with a restore control.
- Logical PostgreSQL dump:
  `/Users/brianb/MissionMed_private_backups/D1-500/20260804T162100Z/timeline-pre-migration.dump`.
- Logical dump SHA-256:
  `65ae8326ee7a2ba7115486187ec978494c7beae714daeb32379c2873f89436cd`.
- Dump format: PostgreSQL 18.4 custom archive; isolated restore: PASS; temporary
  restore database removed after validation.

WordPress rollback is bounded to disabling Timeline admission, deactivating the
Timeline plugin, removing its MU route, and restoring the pre-state recorded in
the scoped snapshot. Railway has no successful application deployment to roll
back yet. The failed deployment attempts created no serving release.

<!-- SOURCE: D1_500_CRITICAL_SYSTEMS_RECONCILIATION.md -->

# D1-500 Critical Systems Reconciliation

Historical checkpoint note: the approval request and pre-mutation language in
this report were satisfied by the Founder and superseded by protected-system
registration commit `b75c789`. The resulting Critical Systems gate passes 140
checks with 3 warnings and 0 failures; no protected application runtime was
changed by the metadata amendment.

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

<!-- SOURCE: D1_500_DEPLOYMENT_AND_RELEASE_RECEIPT.md -->

# D1-500 Deployment and Release Receipt

- Accepted source commit: `b668cc4d3eaa8075a357d35a60456fcaaaffa18c`.
- Deployment-config repair commit: `7cf30eb`.
- Static release: `timeline-0c5cc515a76346d6`.
- WordPress runtime: `timeline-wp-c228658bc70bc395`.
- WordPress payload SHA-256:
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`.
- Critical Systems gate: 140 PASS, 3 WARN, 0 FAIL.
- Matrix immutable-source/live guard: 10 PASS, 0 FAIL.
- PostgreSQL schema: `d1-timeline-db-500.1`, migrated and verified.
- Railway URL: `https://mission-timeline-api-production.up.railway.app`.
- First deployment `fcd4805f-153d-48b7-8b0e-1207ecdb2cbd`: FAILED CLOSED
  during image build because the generated Nixpacks plan performed duplicate
  `npm ci` operations.
- Repaired deployment `5d682cfe-ac05-42d4-8026-af9afd6eebb2`: image build
  PASS; FAILED CLOSED at `/healthz` because the API service did not contain
  `TIMELINE_JWT_SECRET` or `TIMELINE_GATEWAY_SECRET`.
- Railway application state: offline; no successful deployment identifier yet.
- Kinsta payload: installed at the exact authorized hash.
- Kinsta settings: feature off, rollout off, no canaries, no eligible users.
- Canonical route: `https://missionmedinstitute.com/timeline/`, installed but
  not live to authorized users.
- Anonymous route behavior: `302` to the approved Matrix member-dashboard
  flow.
- Anonymous token POST: denied `401` with `session_required`.

The payload contains only the Timeline SSO plugin, Matrix launch asset, MU
route, and immutable runtime release. No secret value is present in the
artifact, Git history, logs, screenshots, or evidence.

<!-- SOURCE: D1_500_EXECUTIVE_RELEASE_REPORT.md -->

# D1-500 Executive Release Report

Status as of 2026-08-04: **PARTIAL — production remains access-off at the
server-secret binding gate**.

Audited execution progress is 35 of 45 defined work units (78%). This measure
tracks execution work, not final acceptance: live canary and 360 rollout remain
mandatory. Engineering confidence is 92%; confidence that this execution loop
ends with Timeline live inside Matrix is 74%, contingent on the Founder-only
secret bindings becoming verifiable.

The accepted Timeline Builder remains sealed as static release
`timeline-0c5cc515a76346d6` and WordPress runtime
`timeline-wp-c228658bc70bc395`. The product and security core pass 614
automated tests. Critical Systems passes 140 checks with zero failures and the
controlling Matrix lock passes ten of ten checks.

Production backup, data, and feature-off installation work is complete:

- the exact oldest Kinsta manual backup was deleted only after re-verifying the
  inventory and its independent local and remote recovery copies;
- replacement Kinsta backup `D1-500-PRE-20260804T161859Z` is READY with a
  restore control and all four newer retained backups remain;
- a Railway manual PostgreSQL volume backup is READY at 843 MB with a restore
  control;
- a PostgreSQL 18 custom logical dump is stored outside Git, hash-verified, and
  passed an isolated restore;
- all six accepted Timeline SQL assets applied successfully; production reads
  back `d1-timeline-db-500.1`, 20 tables, 53 policies, zero missing forced-RLS
  tables, and zero public schema/table access;
- the exact authorized Kinsta payload SHA-256
  `e0eed7020fe23028f7168676d3d45455c9ca56f1a9a723f4530d873c4fb3fb11`
  is installed and active with `timeline_enabled=false`,
  `rollout_stage=off`, an empty canary list, and eligibility unverified;
- anonymous `/timeline/` access returns to the approved Matrix flow and an
  anonymous token POST is denied `401`.

The first Railway image build failed closed because Nixpacks ran a locked
install and the repository build command attempted a second `npm ci` against
the active cache. The narrow config-only repair at commit `7cf30eb` retains the
Nixpacks locked install and runs typecheck, API build, and API-only validation
once. The retry built successfully but failed its `/healthz` gate before going
online because the production API service lacks its two required secret
variables. The PostgreSQL reference and all seven non-secret variables are
installed. No API container is live and no user access is enabled.

One consolidated Founder-only action remains: install matching secret pairs in
the exact server-side locations below without exposing their values:

- Railway project `295b3d56-f555-4851-91f4-eb32d7dc88e1`, production API
  service `12bfaf69-f883-42b5-a380-b6beea49f251`:
  `TIMELINE_JWT_SECRET`, `TIMELINE_GATEWAY_SECRET`;
- Kinsta production WordPress PHP runtime:
  `MISSIONMED_TIMELINE_JWT_SECRET`,
  `MISSIONMED_TIMELINE_GATEWAY_SECRET`.

The JWT values must match each other across Railway and Kinsta, and the gateway
values must match each other. After those four named bindings exist, resume at
API deploy/health, then principal provisioning, Founder/admin canary,
eligible-360 activation, browser/security verification, rollback rehearsal,
and release seal.

<!-- SOURCE: D1_500_FOUNDER_ADMIN_CANARY_REPORT.md -->

# D1-500 Founder and Administrator Canary Report

Status: NOT RUN; the production route is installed but feature and access remain
disabled at the server-secret binding gate.

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
session expiry, health, logs, kill switch, and rollback. Controlled fixtures for
the remaining personas are Founder-authorized; their creation is intentionally
deferred until the API health gate passes so they exercise the real production
authorization path.

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

<!-- SOURCE: D1_500_IMPLEMENTATION_AND_CHANGE_LEDGER.md -->

# D1-500 Implementation and Change Ledger

Accepted product implementation remains sealed at
`b668cc4d3eaa8075a357d35a60456fcaaaffa18c` with release identities
`timeline-0c5cc515a76346d6` and `timeline-wp-c228658bc70bc395`.

Production changes completed:

- Critical Systems metadata amendment and Timeline registration;
- Kinsta and Railway provider-native backups plus logical database backup;
- six accepted database migration/role assets and runtime-role binding;
- Railway non-secret service configuration and PostgreSQL reference;
- Railway provider domain;
- exact Kinsta payload installation, plugin activation, immutable release
  pointer, and default-off settings;
- anonymous Matrix redirect and anonymous token-denial verification.

Defect and repair:

- defect: generated Nixpacks plan ran its install stage and the configured build
  ran a second `npm ci`, producing an `EBUSY` cache failure;
- repair: commit `7cf30eb` removes only the duplicate install from the build
  command; local typecheck/API build/API-only validation pass and the Railway
  retry image built successfully.

Production changes not completed:

- matching Railway/Kinsta JWT and gateway secret bindings;
- successful API health and immutable deployment receipt;
- principal provisioning, canary, eligible-360 activation, navigation proof,
  and final browser/security/rollback evidence.

No unrelated application, Matrix, Arena, USCE Admin, CDN, DNS, or provider
setting was changed. A separate staged Railway `function-bun` service was
inspected read-only and left untouched.

<!-- SOURCE: D1_500_KNOWN_LIMITATIONS_AND_FOLLOWUPS.md -->

# D1-500 Known Limitations and Follow-ups

Blocking at the 2026-08-04T16:34:00Z checkpoint:

- The approved Critical Systems amendment and Timeline registration are applied
  on `codex/d1-500-critical-registration`. The full protected-systems gate passes
  140 checks with 0 failures, and the controlling Matrix guard passes all 10
  local/source/origin/public checks. This authority blocker is closed.
- Railway authorization, provider-native backup, the logical backup, isolated
  restore proof, and all six accepted production database assets are complete.
- Kinsta backup capacity was reconciled under the explicit Founder deletion
  authorization. The exact oldest manual item was replaced by
  `D1-500-PRE-20260804T161859Z`, which is READY with a restore control.
- Production secret installation remains Founder-only under DR-018. Current
  Railway name-only inspection proves the API service lacks
  `TIMELINE_JWT_SECRET` and `TIMELINE_GATEWAY_SECRET`; the corresponding Kinsta
  runtime bindings are not verifiable. The required
  names are `TIMELINE_JWT_SECRET` and `TIMELINE_GATEWAY_SECRET` on the Railway
  API service, and `MISSIONMED_TIMELINE_JWT_SECRET` and
  `MISSIONMED_TIMELINE_GATEWAY_SECRET` in the Kinsta live WordPress server-side
  runtime. No value is stored in this package.
- Standard Kinsta WP-CLI WordPress bootstrap crashes in the existing MU-plugin
  layer with exit 139. A CLI-only `WPMU_PLUGIN_DIR` isolation bootstrap works;
  web traffic and protected MU-plugin bytes remain unchanged. Timeline-only
  activation/configuration must use that bounded bootstrap or WordPress admin.
- One approved administrator and one active 360 test identity are verified in
  production. Founder-equivalent, second eligible student, non-360, and
  expired/revoked controlled fixtures are authorized but cannot truthfully run
  through the production path until API health passes. No password is stored in
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

<!-- SOURCE: D1_500_LIVE_BROWSER_AND_VISUAL_VERIFICATION.md -->

# D1-500 Live Browser and Visual Verification

Local accepted presentation preview: PASS. The accepted 407F dark MissionMed
shell, orange primary actions, Home, File Vault, timeline canvas, Builder,
responsive behaviors, and client-side export remain present.

Sealed production bundle outside WordPress: PASS FAIL-CLOSED. Without a trusted
WordPress identity bootstrap it renders only “Timeline could not be loaded
safely.” This is the intended negative behavior, not a visual regression.

Live canonical route `https://missionmedinstitute.com/timeline/`: INSTALLED,
APPLICATION NOT LIVE. Anonymous access returns `302` into the approved Matrix
member-dashboard flow, and an anonymous token POST is denied `401` with
`session_required`. These prove fail-closed route integration, not an
authenticated live application. The Railway API domain has no healthy serving
deployment.

Authenticated production rendering, responsive journeys, browser console,
navigation discoverability, logout, account switch, and live visual comparison
remain NOT RUN.

No decorative screenshots were added to the package. In-thread previews were
used for the accepted app and fail-closed sealed runtime.

<!-- SOURCE: D1_500_LIVE_HEALTH_AND_OPERATIONS.md -->

# D1-500 Live Health and Operations

Local production handler health tests pass, including dependency failure,
timeout, recovery, release identity, and content-free errors.

Production PostgreSQL is migrated and healthy at schema
`d1-timeline-db-500.1`. The repaired Railway image passes its build gates, but
the deployment fails closed at `/healthz` because the API service does not yet
have the two required secret bindings. The provider domain therefore returns
Railway's application-not-found response and must not be classified as live.

WordPress is installed feature-off. `/timeline/` exists and anonymous traffic
returns to the Matrix member-dashboard flow. The token endpoint is registered;
anonymous POST is denied `401`. No Founder, administrator, or student has been
admitted.

Next operational step after secret binding is an immutable API redeploy. A
successful health response must identify service `mission-timeline`, release
`timeline-0c5cc515a76346d6`, and schema `d1-timeline-db-500.1` before canary
configuration changes. File Vault v2 remains disabled.

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

<!-- SOURCE: D1_500_STUDENT_ROLLOUT_REPORT.md -->

# D1-500 Student Rollout Report

Status: WITHHELD.

The canonical eligibility source is verified as current LearnDash access to
published course 3893 with Closed enrollment. The direct WordPress route is
installed but access-off; the eligible-student navigation entry remains off. No
student has been exposed to the release.

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
password is stored in this package. Founder-authorized controlled fixtures for a
second eligible identity, non-360 identity, and expired/revoked identity will be
created only after the API health gate passes and removed or restored after the
mandatory isolation and denial proofs.
