# B1-507 StoryForge Phase 1 Launch — Complete Combined Handoff

Recorded: 2026-07-30

## Verdict

**BLOCKED ON NON-RP8 EXTERNAL GATES**

The StoryForge V5.5 Phase 1 implementation and every authorized local and
read-only production-preflight gate are complete. The candidate can safely
proceed to a hidden, dormant, default-off, Founder-only deployment once the
external protected-system and fresh-recovery gates below are satisfied.

RP-8 is explicitly deferred. It does not block dormant deployment.

No production deployment, migration, configuration change, backup creation,
provider call, Cloudflare/R2 change, Kinsta change, WordPress setting change,
or student-audio operation occurred in B1-507.

## 1. Repository and release custody

| Item | Exact value |
|---|---|
| Worktree | `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` |
| Branch | `codex/b1-503-storyforge-product-recovery` |
| Authority recovery | `18db92b7fd2e62e54f3640573bb49292b05c0654` |
| Implementation | `e94a305c82c35d492ceb68f13667200b83e6d2dd` |
| Exact deployment source pin | `09878514fff39b2d1f2ba3ee40c4c3de55ffc473` |
| Release ID | `v-4f40609482162cbd` |
| Deterministic Git archive SHA-256 | `fcd8f773d1b1d4fd915244bac7e8d652b35ae5b538c5ed77af682b427a1fea56` |

Documentation-only commits after `09878514...` do not replace the exact
deployment source pin.

## 2. Authority resolution

Product authority remains the Founder-approved StoryForge artifacts:

- StoryForge V5 SHA-256:
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- StoryForge V5.5 SHA-256:
  `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90`
- StoryForge V5.5 r2 SHA-256:
  `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b`

The steering correction makes the following release boundary binding:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
```

Voice must remain forced off and the platform kill switch must remain on.
Recording/transcription must not be described as production-enabled.

## 3. Completed implementation

The 36/36 locally authorized implementation ledger remains complete.
B1-507 closed two additional production-integration defects without changing
the approved architecture:

1. The isolated WordPress gateway now permits only the exact authenticated UUID
   multipart segment-upload route and exact UUID audio DELETE route. It retains
   origin, authorization, feature-gate, response, and six-megabyte request
   bounds and does not forward client filenames.
2. Saved-audio replay now supports play, pause, resume, replay, current/total
   time, progress semantics, keyboard and screen-reader state, multiple
   segments, signed-URL refresh, expired-URL recovery, and responsive
   full/compact presentation.
3. The transcription bakeoff scorer now follows the binding B1-506A human
   corpus semantics. No provider was selected or called.

Changed implementation files:

- `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php`
- `storyforge-v5/public/app.js`
- `storyforge-v5/public/styles.css`
- `storyforge-v5/scripts/transcription-bakeoff-lib.mjs`
- `storyforge-v5/tests/e2e/voice-save-attach.spec.mjs`
- `storyforge-v5/tests/unit/transcription-bakeoff.test.mjs`
- `storyforge-v5/tests/unit/wordpress-gateway-phase1.test.mjs`

## 4. Deterministic release identity

| Artifact | SHA-256 / size |
|---|---|
| Candidate WordPress route | `51d800dbe52e734aafadb274ec744c7dd710f601291b0ec4af05bc25b570ac3f` / 37,413 bytes |
| Candidate `release.php` | `4304a2bad8818e47f7329e66cfd747604851c88ac0bf6248686765d64c9f6a93` / 867,355 bytes |
| Built index | `d15a7af658241ce686e14c870c6c656e78c54121490af736bb1c136d68777ccb` |
| Built app | `749ef6ff5e42743e758e203b5bb14e9684a7db1afaff54582906b4daa0df4bf8` |
| Built styles | `3acf10d52131c1c068377559a1a1409f0e70662dc42a2fabd36c13c9dfa2c742` |
| Edge aliases | `2e64d0d0a56e4fdbb07fd1fea653e1f2522fc1df161ba865a5bd527a9cf2578a` |

The release provenance correctly reports:

- `releaseArtifactEligible: true`
- `deployable: false`
- `deploymentAuthorized: false`

Those values remain truthful until the external gates and the authorized
deployment sequence complete.

## 5. Local verification

No local container runtime was used after the steering correction.

| Gate | Fresh result |
|---|---|
| Unit tests | 192/192 PASS |
| PostgreSQL parity/authorization runner | 12/12 PASS, including every required SQL PASS marker |
| Browser E2E | 46/46 PASS |
| Conformance/accessibility | 72/72 PASS |
| WordPress gateway focused tests | included in the 192 and PASS |
| Product provenance | PASS |
| Route-manifest verification | PASS |
| Phase 1 release safety | PASS |
| API build | PASS |
| Bundle secret scan | clean |
| `npm audit` | 0 vulnerabilities |
| `git diff --check` | PASS |

The Docker integration target was intentionally not executed and is not
represented as passing. RP-8 remains deferred evidence.

## 6. Read-only production baseline

### Railway and PostgreSQL

- project: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- production environment:
  `bcef8734-e42b-44df-8488-c2a3de68213f`
- API service: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`
- API deployment:
  `fa7ad084-4dae-4039-a154-2250a407d95e`, healthy
- PostgreSQL service:
  `a4a66362-c3ba-475a-ae21-2aa46624bafe`
- PostgreSQL deployment:
  `f5c7179e-b805-4e82-b080-d2349a0a47cf`, healthy
- topology: one API replica and one PostgreSQL replica
- PostgreSQL: 18.4 over SSL
- system identifier: `7667256745042145332`
- current data baseline: one StoryForge user, zero active assignments
- current migration ledger: exactly the five B1-503 migrations
- Phase 1 recording/feature-flag/lifecycle migrations: absent
- `storyforge_app`: LOGIN, non-superuser, non-BYPASSRLS

Pending migration hashes:

- M1 `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`
- M2 `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a`
- M3 `e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323`

### Kinsta and WordPress

- current release pointer:
  `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`
- live route SHA-256:
  `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61`
- live release SHA-256:
  `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e`
- route/release mode: `0444`; runtime parent `0555`
- expected owner: `theresidencyacademy:www-data`
- live text pilot: enabled for exactly one Founder allowlist/role override,
  allowed role `student`, zero cohorts, JWT TTL 60

Current production remains the healthy B1-503 Founder-only text release.

### Cloudflare/R2 and OpenAI

No StoryForge R2 bucket, route, credential, or Railway R2 variables were found.
No scoped StoryForge OpenAI project/key exists. No provider call was made.
This is correct for dormant deployment: keep those variables absent and the
provider set to `none`.

## 7. Core behavior with reconciliation off

No core text StoryForge function fails or becomes unsafe while
`STORYFORGE_AUDIO_RECONCILIATION=off`.

Founder-only text capture, editing, classification, review, Library, story
detail, and existing Matrix/WordPress navigation remain available.

What remains intentionally unavailable:

- production recording/upload;
- transcription-provider traffic;
- production audio assembly;
- permanent-audio reconciliation;
- student voice exposure;
- any claim that voice capture is production-complete.

FABLE-C1 through C4 and PROBE-C5 may be resolved after dormant deployment, but
must be resolved before reconciliation moves to `dry_run` or `on`.

## 8. Dormant production configuration

The following exact values are mandatory before the candidate is deployed:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_VOICE_FORCE_OFF=1
STORYFORGE_PLATFORM_OFF=1
```

Also require:

- `STORYFORGE_PLATFORM_CONSUMERS` absent or empty;
- reconciliation suspension/consumers absent or empty;
- all StoryForge R2 variables absent;
- all StoryForge OpenAI/provider credentials absent;
- database `voice_capture` feature flag off;
- no student audio uploaded or retained.

## 9. Completed and blocked production gates

Completed read-only:

- exact candidate/branch/release identity;
- deterministic archive and artifact hashes;
- Railway services and one-replica topology;
- production PostgreSQL version/system/ledger/count/role baseline;
- Kinsta pointer, immutable files, modes, ownership expectation, and WP setting
  summary;
- public WordPress route, JWT/bootstrap boundary, origin denial, and existing
  text shell;
- Cloudflare/R2 and OpenAI absence/fail-closed posture;
- historical rollback archive integrity.

Remaining non-RP8 external gates:

1. The owner-controlled `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` is stale.
   The report-only protected-system gate returns ten StoryForge failures.
   No authorized manifest generator/writer exists in this worktree. The
   manifest must be reconciled by its normal owner workflow or an exact,
   owner-reviewed emergency exception must be issued.
2. The Matrix runtime guard matched all available approved/origin/public
   hashes, but cannot produce a green canonical receipt because protected
   `wp-content/plugins/missionmed-hub` sources are absent from this worktree.
   The control-plane/Matrix owner must run the guard in the source-bearing
   worktree or issue the exact asset-scoped ruling.
3. GitHub custody requires the exact branch push and pull request.
4. A fresh recovery set is required: manual MyKinsta backup; private Kinsta
   pointer/route/plugin/settings receipt; PostgreSQL 18 custom-format dump;
   isolated restore rehearsal; locked non-expiring Railway backup; mode-0600
   variable export; and the fresh 16-field migration receipt.
5. Guarded database and Kinsta preflights require those receipts, scoped
   time-bounded credentials, the Founder StoryForge UUID, and a newly generated
   application-role password.
6. A bounded cutover session must be explicitly scheduled after the above
   evidence is green.

Historical B1-503 rollback remains valid evidence but is not a substitute for a
fresh B1-507 recovery point:

- archive:
  `/Users/brianb/MissionMed_private_backups/B1-503/storyforge-v5-6f45dbbd2150ba11000236a4959f70434f6edb77.tar`
- mode: `0600`
- SHA-256:
  `dd9452428631297cab15cc48304ed3f317eecb492801c5e5be6427f080668870`

## 10. Exact dormant-deployment authorization packet

Do not execute this packet until gates 1–5 above are closed and their receipts
are attached. No RP-8 evidence is needed for these dormant steps.

### A. Services changed

| System | Change | Reversible |
|---|---|---|
| GitHub | Push exact branch and open review PR | Yes; no production effect |
| Critical Systems control plane | Owner-generated current StoryForge manifest/receipt | Yes through normal Git history |
| MyKinsta/Kinsta | Fresh backup; temporarily disable StoryForge; stage/install immutable route/release; restore only one-Founder text scope | Yes using fresh receipt and prior pointer |
| Railway PostgreSQL | Locked backup, logical dump/restore proof, three additive migrations, app-role password rotation | Additive schema remains dormant; data restore only under incident authority |
| Railway API | Four explicit dormant variables and exact-source deployment | Yes using prior deployment plus matching new DB password |
| WordPress | Feature-off drain, hidden smoke, then restore existing one-Founder text setting only | Yes |

No Cloudflare/R2 or OpenAI write belongs to this dormant packet.

### B. Recovery evidence first

1. Create a manual MyKinsta backup and record its provider ID/time.
2. Privately copy the current Kinsta pointer, route, release, isolated plugin,
   and complete StoryForge setting summary; hash and mode the receipt.
3. Create a PostgreSQL 18 custom-format dump from the exact production target.
4. Restore it into an isolated non-production PostgreSQL 18 target and verify
   system-independent schema, migration ledger, one user, zero active
   assignments, authorization, and RLS checks.
5. Create and lock a non-expiring Railway volume backup.
6. Export the exact target-variable receipt to a mode-`0600` private file.
7. Seal the required 16-field migration receipt and its SHA-256.

### C. Kinsta private staging and read-only preflight

1. Copy only the exact candidate route and `release.php` to a private staging
   directory on Kinsta.
2. Set only `storyforge_enabled=false`, preserve the one-Founder mapping, and
   wait at least 65 seconds.
3. Run `install-b1-503-kinsta-release.sh preflight` on the Kinsta host with:

```text
--release-commit 09878514fff39b2d1f2ba3ee40c4c3de55ffc473
--route-sha256 51d800dbe52e734aafadb274ec744c7dd710f601291b0ec4af05bc25b570ac3f
--route-size 37413
--release-sha256 4304a2bad8818e47f7329e66cfd747604851c88ac0bf6248686765d64c9f6a93
--release-size 867355
--release-id v-4f40609482162cbd
--expected-owner theresidencyacademy:www-data
--expected-current-target releases/6f45dbbd2150ba11000236a4959f70434f6edb77
--expected-route-sha256 1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61
```

The remaining path arguments must be absolute private Kinsta paths from the
fresh backup/staging receipts.

### D. Database preflight and apply

From the exact product source:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5
./scripts/apply-production-migrations.sh preflight
```

Supply every environment input required by the guarded script from the fresh
receipt. Do not echo secrets. The deploy commit must be `09878514...`, the
system identifier must be `7667256745042145332`, expected counts must remain
one user and zero active assignments, and the Founder UUID must come from the
privacy-preserving identity receipt.

Only after preflight passes:

```bash
STORYFORGE_MIGRATION_CONFIRM=B1-506A-APPLY-THREE-MIGRATIONS \
  ./scripts/apply-production-migrations.sh apply
```

Synchronize the rotated `storyforge_app` password and Railway
`STORYFORGE_DATABASE_URL` in the same cutover window.

### E. Set and read back dormant Railway configuration

```bash
railway variable set \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --skip-deploys \
  STORYFORGE_TRANSCRIBE_PROVIDER=none \
  STORYFORGE_AUDIO_RECONCILIATION=off \
  STORYFORGE_VOICE_FORCE_OFF=1 \
  STORYFORGE_PLATFORM_OFF=1
```

Read back only those four non-secret values. Confirm platform/reconciliation
consumer fields are empty and R2/OpenAI variables are absent.

### F. Deploy exact Railway source

Create a temporary tree from exact commit `09878514...`, verify its archive
SHA-256 is `fcd8f773...`, then deploy:

```bash
railway up "$STORYFORGE_EXACT_TREE/storyforge-v5" \
  --path-as-root \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --detach \
  --json \
  --message "B1-507 dormant default-off StoryForge V5.5"
```

Do not derive `STORYFORGE_EXACT_TREE` from an unresolved variable, symlink, or
the documentation HEAD.

### G. Install Kinsta candidate

Rerun the exact successful Kinsta preflight arguments in `install` mode with:

```text
--confirm B1-503-INSTALL
```

Preserve the newly generated rollback receipt before the pointer changes.

### H. Hidden smoke and Founder-only restoration

While WordPress remains off:

- verify health/config and the exact route/release hashes;
- verify provider `none`, reconciliation `off`, voice force-off, and platform
  off;
- verify anonymous, expired, and unapproved direct API access is denied;
- verify no provider requests, R2 objects, audio rows, or student audio exist;
- verify all existing StoryForge text data and other Matrix products remain
  healthy.

Then restore only the existing one-Founder text pilot. Do not add cohorts,
admins, students, provider traffic, R2, or voice UI.

### I. Rollback

Before any code rollback:

1. set WordPress StoryForge off;
2. set the database voice flag off;
3. set `STORYFORGE_VOICE_FORCE_OFF=1`;
4. set provider `none`;
5. set reconciliation `off` and a nonempty suspension reason.

Restore the prior Kinsta pointer/route/plugin/settings from the fresh receipt
and roll Railway back to deployment
`fa7ad084-4dae-4039-a154-2250a407d95e`.

The three additive migrations may remain dormant. Because migration apply
rotates `storyforge_app`, a B1-503 code rollback must retain the new matching
database URL/password. Do not restore the old Railway database variable unless
the database-role password is also restored under explicit recovery authority.

## 11. Shortest path

1. Complete GitHub branch/PR custody.
2. Have the control-plane owner reconcile the stale Critical Systems manifest.
3. Obtain a green Matrix guard receipt from the canonical source-bearing
   worktree.
4. Authorize/create the fresh Kinsta and PostgreSQL recovery set and isolated
   restore rehearsal.
5. Supply time-bounded Kinsta/Railway/PostgreSQL sessions plus the Founder UUID
   and new app-role password.
6. Execute the packet above in a bounded window.

At that point the hidden dormant candidate and the existing Founder-only text
workflows can safely proceed. RP-8 remains outside that path and must be closed
before any voice activation.
