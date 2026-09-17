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
