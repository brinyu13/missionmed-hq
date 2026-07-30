# B1-507A Complete Phase 1 Deployment Sequence

Date: 2026-07-29
Status: derived launch plan only; B1-507A authorizes no deployment.

## Safety invariant

Until every activation gate passes:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_VOICE_FORCE_OFF=true
```

The database feature flag remains off. No student audio may be uploaded or retained during dormant deployment.

## Ordered stages

| Stage | Inputs/predecessors | System/action | Verification | Rollback | Autonomous? |
|---:|---|---|---|---|---|
| 1 | Final local candidate and clean dossier | Resolve code/authority blockers: gateway multipart/DELETE, replay UI, FG-1 deltas, RP-8 selection/wiring, C1-C4 implementation | Full unit/PG/E2E/conformance plus production-shaped gateway/replay/reconciliation tests | Revert candidate commits before remote custody | Codex after Fable/Founder rulings |
| 2 | Stage 1 green | Push exact candidate to GitHub; protect/review branch; record SHA and deterministic archive | Local SHA equals GitHub SHA and release archive hash; required checks green | Do not advance; retain prior upstream | Codex with explicit remote-write authority |
| 3 | Exact GitHub SHA | Generate deterministic release and WordPress route manifest; scan secrets/audit | `npm run build:release`, route-manifest check, product provenance, bundle scan, `git diff --check` | Delete only disposable local build output or retain as evidence | Codex |
| 4 | Candidate frozen | Refresh `_SYSTEM` manifest through normal owner/writer | Manifest records current route, hashes, no Worker, release source | Retain previous manifest history; never hand-edit | Authorized platform writer |
| 5 | Production identity/read baseline | Create fresh PostgreSQL and Kinsta backups; export safe config/pointer/deployment receipts | Backup IDs/timestamps/hashes; restore rehearsal in isolated target; counts/system identifier match | Restore only under incident authority; otherwise no cutover | Codex where sessions permit; MFA may need Founder |
| 6 | FG-1 and R2 design fixed; no student traffic | Provision private StoryForge R2 staging/prod buckets, scoped least-privilege credentials, CORS, lifecycle/control object | No public access; PUT/HEAD/GET-signed/DELETE in private test namespace; cleanup; token scope | Revoke token, delete only disposable test objects; leave voice off | Codex with Cloudflare write authority/MFA |
| 7 | RP-7 account/privacy inputs and human corpus | Create StoryForge OpenAI project/key and run 40-passage/6-accent/3-run bakeoff | All accuracy, fairness, latency, failure, cost, logging, retention gates pass | Revoke key; provider remains `none` | Codex plus Founder/legal/corpus inputs |
| 8 | Authorized RP-8 equivalent | Run both executors in a non-production Nixpacks-equivalent runtime using the required 40×15-second corpus; select and wire winner | Full Chrome/Safari playback, bounded completion, hashes, <=60-second requirement, restart recovery | Restore unavailable executor and force-off | Codex after narrow authority; no local Docker required |
| 9 | Fresh DB backup/restore and exact source archive | Execute guarded migration preflight: `storyforge-v5/scripts/apply-production-migrations.sh preflight` with the full bound environment contract | Exact project/environment/service, PG18 client, system ID, counts, backup receipt, migration hashes, ledger all match | No write in preflight | Codex with production read credentials |
| 10 | Stage 9 pass and explicit apply authorization | Apply the three additive migrations with the guarded script | Ledger has eight exact versions; RLS, grants, role flags, Founder mapping, 12 TAP and full PG auth/conformance pass | Keep voice off; restore only from proven backup if migration damages baseline | Codex only with explicit DB write authority |
| 11 | DB/R2/provider secrets installed but provider still none | Deploy Railway backend candidate with selected executor, one-replica lock/evidence or coordination, sweeps set as approved | Health/config, origin/JWT, schema, no provider calls, no audio objects, restart recovery, logs clean | Railway previous deployment; provider none; voice/reconciliation off | Codex with explicit Railway deploy authority |
| 12 | Backend dormant healthy | Deploy WordPress route/plugin and immutable Kinsta release; do not activate voice | PHP syntax, protected guard, route hashes, text workflows, multipart/DELETE test fixtures, bootstrap/refresh/logout | Previous pointer/plugin/route and Kinsta backup | Codex with Kinsta/WordPress authority; MFA possible |
| 13 | 360 authority receipt and two-account fixtures | Verify Founder, WP admin, eligible 360 student, expired/ineligible student, anonymous, direct-API denial | Exact allow/deny matrix; no private cross-user IDs; token refresh/logout | Keep flags off; restore previous entitlement settings | Codex; Founder may supply/MFA representative accounts |
| 14 | All prior stages; real-device matrix ready | Enable provider and Founder-only voice flag while reconciliation stays off; run complete voice E2E with non-student scripted data | Permission, record/upload/transcribe/edit/save/assemble/replay/reload/recovery/cancel/retry/idempotency; no transcript loss | Provider none, force-off, flag off, previous deploy | Codex with explicit activation authority |
| 15 | Founder smoke passes | Add one WP-admin and the approved eligible 360 test account; repeat production acceptance on desktop/iPhone Safari/Android Chrome and accessibility tooling | Visual/interaction/AX evidence; storage/database/audit consistency; other MissionMed apps healthy | Remove scope; force-off/provider none | Codex; device/account access may need Founder |
| 16 | C1-C5 resolved; storage has safe test objects only | Set reconciliation `dry_run`, run/control one cycle, verify 168-hour/bounds/fairness/visibility/audit-zero-delete | Candidate counts/reasons, zero deletes, zero audit writes, one scheduler, suspension works | Set off/suspended | Codex with explicit operational authority |
| 17 | Founder reviews dry-run and approves | Set reconciliation `on` for a bounded disposable eligibility fixture; prove deletion/audit/retry/suspension | Object/database/audit truth matches the authorized C1/C3 model; batch/fairness limits hold | Immediate off/suspend; use backup/object evidence for incident recovery | Codex plus explicit Founder approval |
| 18 | All Phase 1 acceptance green | Activate Founder, WP admins, then currently enrolled 360 students in controlled cohorts | Monitoring window, zero unauthorized access, quality/latency/error SLOs, full audio lifecycle, no regressions | Roll back one rung at a time; global force-off available | Codex under final deployment authority |

## Guarded migration inputs

The existing script requires, among others, exact Railway project/environment/database-service IDs, backup ID/receipt/hash, deploy SHA/source mode, expected PG host/port/user/database/system identifier/counts, Founder StoryForge UUID, a rotated application DB password, Railway target variables, and PostgreSQL credentials. Values must come from fresh receipts; none are embedded here.

## Kinsta immutable-release inputs

- exact GitHub commit and deterministic source archive/hash;
- protected-runtime guard preflight;
- generated WordPress route manifest;
- current release pointer and rollback pointer;
- fresh Kinsta backup receipt;
- verified file ownership/modes and PHP syntax;
- route/plugin/settings receipts without secrets.

Existing scripts named `install-b1-503-kinsta-release.sh` and `rollback-b1-503-kinsta-release.sh` must not be assumed to accept V5.5 unchanged; the final megarun must inspect and either use their verified generic path or make the smallest authorized bounded update.

## Rollback ladder

1. Scope the affected cohort back to zero/Founder-only.
2. Set database voice flag off and `STORYFORGE_VOICE_FORCE_OFF=true`.
3. Set provider `none`.
4. Set reconciliation `off` and suspension nonempty.
5. Restore previous Kinsta route pointer/plugin.
6. Roll Railway back to the prior B1-503 deployment.
7. Preserve additive schema and evidence unless an authorized restore is necessary.
8. Restore from the fresh proven backups only for confirmed data corruption.

At every rung, existing text stories remain readable and editable.
