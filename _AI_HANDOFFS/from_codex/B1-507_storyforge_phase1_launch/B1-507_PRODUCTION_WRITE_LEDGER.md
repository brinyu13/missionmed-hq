# B1-507 Production Write Ledger

This ledger records the required prestate, recovery point, bounded write,
verification, and rollback before each B1-507 dormant production mutation.
No secret values are recorded.

## W1 — additive Phase 1 database migrations

- Status: **COMPLETE / VERIFIED**
- Production prestate:
  - PostgreSQL `18.4`;
  - system identifier `7667256745042145332`;
  - exact five-row B1-500/B1-502/B1-503 migration ledger;
  - 26 public tables, 25 RLS tables, 25 policies;
  - 1 StoryForge user and 0 active mentor assignments;
  - Phase 1 recording and feature-flag migrations absent.
- Recovery points:
  - Railway provider backup
    `aed95152-2d7e-46ac-9d5d-d303c1c6a474`, created
    `2026-07-30T05:07:51.779Z`, locked, `expiresAt=null`;
  - PostgreSQL custom dump SHA-256
    `42b9394b609b732ceb4b70ddccf45c70a481f8caf586867ff5a0849dfb35f53f`;
  - isolated PostgreSQL 18 restore rehearsal: PASS.
- Executed write:
  - transition the already-live B1-503 `storyforge_app` role to `NOLOGIN`
    immediately before the guarded transaction because the runner proves that
    exact pre-LOGIN state; restore `LOGIN` immediately on any failure;
  - stage a rotated private application-role credential in Railway while
    deploys are suppressed, rotate the database role only after the WordPress
    drain, and cut over the matching dormant backend immediately;
  - run `scripts/apply-production-migrations.sh apply` from release commit
    `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`;
  - add exactly the three pinned B1-506/B1-506A migrations;
  - keep `voice_capture` seeded `off`.
- Verification:
  - exact eight-row ledger and pinned hashes;
  - migration runner postconditions;
  - RLS/FORCE RLS, functions, grants, counts, Founder mapping, and service-role
    tests;
  - no unrelated schema changes.
- Rollback:
  - normal dormant rollback is flag/env disablement and leaves the additive
    schema in place;
  - for actual corruption only, restore Railway backup
    `aed95152-2d7e-46ac-9d5d-d303c1c6a474` or the verified logical dump.
- Expected rollback result: the exact pre-W1 five-row database identity and
  data counts.

Outcome:

- first apply attempt rolled back fully on the existing-role LOGIN
  precondition;
- second guarded apply passed after the bounded temporary NOLOGIN transition;
- exact eight-row ledger;
- `storyforge_app` LOGIN restored with a newly rotated private credential;
- `voice_capture` scope `off`, empty allowlist/cohorts;
- 0 sessions, segments, audio assets, and stories.

## W2 — dormant Railway backend

- Status: **COMPLETE / VERIFIED**
- Production prestate:
  - API deployment `fa7ad084-4dae-4039-a154-2250a407d95e`;
  - one API replica in `us-west2`;
  - B1-503 text product healthy.
- Recovery points:
  - W1 database recovery points above;
  - previous Railway deployment ID above.
- Executed write:
  - set the four dormant variables with provider `none`, reconciliation `off`,
    voice force-off `1`, and platform-off `1`;
  - deploy only the deterministic candidate rooted at
    `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.
- Verification:
  - deployment success and one-replica topology;
  - health and text endpoints remain healthy;
  - every voice entrypoint is disabled;
  - no provider, R2, or audio traffic.
- Rollback:
  - restore the four force-off variables first;
  - re-upload the verified B1-503 archive because deployment
    `fa7ad084-4dae-4039-a154-2250a407d95e` is REMOVED and cannot be redeployed
    by ID; retain the rotated database credential unless an authorized database
    restore also restores the old role password.
- Expected rollback result: B1-503 backend identity with text workflow intact.

Outcome:

- deployment `2fe2f8e9-9f24-47c4-b0bd-3a7a0a26a82d` SUCCESS;
- Railway deployment `meta.imageDigest`
  `sha256:2eafe61cfe9400e1395c94fe7938474f82f051fbf07276603bf0ff46a35b4a6d`;
- exactly one RUNNING API replica;
- health/config/auth/origin denials passed;
- authenticated E1/presign/confirm each 403 `voice_disabled`;
- provider none, reconciliation off, R2/OpenAI absent.

## W3 — hidden dormant Kinsta release and route

- Status: **COMPLETE / VERIFIED**
- Production prestate:
  - pointer
    `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`;
  - route SHA-256
    `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61`;
  - release SHA-256
    `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e`.
- Recovery points:
  - MyKinsta manual backup note
    `B1-507 dormant preflight 2026-07-30`;
  - private Kinsta recovery point
    `B1-507-RP-KINSTA-PRE-20260730T050907Z`;
  - WordPress SQL SHA-256
    `5903fd816bf3e657937fe9fff612f1f19ba25545f7a971ab924ecf851c1ac7b6`;
  - runtime archive SHA-256
    `19bffc46997ca26412becf6e9ad9a9617651fee008ffc42f63c453f86359c3a4`.
- Executed write:
  - publish immutable release
    `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`;
  - install only its pinned route and release bundle;
  - preserve Founder-only WordPress entitlement settings;
  - keep all voice/platform force-off controls active.
- Verification:
  - exact route/release hashes, sizes, modes, owner, and pointer;
  - hidden/default-off browser conformance;
  - authenticated Founder text workflows;
  - unauthenticated and ineligible denial;
  - unrelated Matrix routes unchanged.
- Rollback:
  - run the guarded Kinsta rollback using the sealed W3 rollback receipt;
  - restore the previous pointer and route hash above.
- Expected rollback result: exact B1-503 Kinsta pointer and route with the
  Founder text workflow intact.

Outcome:

- active pointer
  `releases/09878514fff39b2d1f2ba3ee40c4c3de55ffc473`;
- exact route and release hashes/modes/owner verified;
- provider PHP cache purge failed after successful publication; MyKinsta
  **Clear all caches** completed the bounded purge;
- live index SHA
  `d15a7af658241ce686e14c870c6c656e78c54121490af736bb1c136d68777ccb`
  on three consecutive requests, cache bypassed;
- guarded rollback preflight PASS;
- exact one-Founder text pilot restored and authenticated smoke passed.
