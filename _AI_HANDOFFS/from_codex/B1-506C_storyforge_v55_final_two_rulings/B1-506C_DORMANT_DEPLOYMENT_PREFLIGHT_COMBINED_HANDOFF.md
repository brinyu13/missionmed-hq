# B1-506C StoryForge V5.5 — Dormant Deployment Preflight Combined Handoff

Recorded: 2026-07-29T22:33:53Z

This supplemental handoff applies the Founder steering that defers RP-8 and
permits every other safe, read-only production-preflight action for a hidden,
dormant, default-off, Founder-only StoryForge V5.5 release.

It does not replace the implementation record:

`_AI_HANDOFFS/from_codex/B1-506C_storyforge_v55_final_two_rulings/B1-506C_COMPLETE_COMBINED_HANDOFF.md`

It does not authorize a deployment, migration, configuration write, backup
creation, production feature change, provider call, R2 change, Cloudflare
change, or production audio.

## Verdict

**BLOCKED ON NON-RP8 EXTERNAL GATES**

The local candidate is complete and the dormant/default-off release path is
technically viable with:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_VOICE_FORCE_OFF=1
```

RP-8 is deferred and does not block a dormant backend, a hidden frontend,
additive migrations with `voice_capture=off`, or the existing Founder-only
text StoryForge workflows.

No core text-based StoryForge function was found that becomes unsafe or
unavailable because transcription is `none` and reconciliation is `off`.
Voice recording, transcription, assembly, permanent-audio reconciliation, and
student voice exposure must not be represented as production-enabled.

The release cannot be executed yet because the mandatory protected-system
manifest/gate is stale and because fresh backup, restore, staging, feature-off,
and explicit deployment-authority prerequisites require external human or
remote-write actions.

## 1. Custody and mutation statement

| Field | Verified value |
|---|---|
| Worktree | `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` |
| Branch | `codex/b1-503-storyforge-product-recovery` |
| Upstream | `origin/codex/b1-503-storyforge-product-recovery` |
| Candidate HEAD before this handoff | `df42c5e05dd11f63c7ea17f99127e43e2d03347c` |
| Exact product deployment source pin | `df42c5e05dd11f63c7ea17f99127e43e2d03347c` |
| Ahead / behind upstream | 17 / 0 |
| Source worktree before this handoff | clean |
| Goal deployment authority | none |
| Remote writes during this preflight | none |
| Production configuration changes | none |
| Database writes or student-content queries | none |
| Docker/container work after steering | none |

All remote inspection was read-only. Secrets and raw WordPress identity values
were not written to evidence.

## 2. Local candidate and release identity

| Artifact | Exact value |
|---|---|
| Release ID | `v-0892c26c62d96206` |
| Canonical V5 HTML SHA-256 | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| Route SHA-256 | `25c5c78549fadc28e02ba36e68a0e20186761bfab4a9ef00c0a52ac2640a22ff` |
| Route size | 31,654 bytes |
| WordPress `release.php` SHA-256 | `e74f985fc099d3a05b5670f6df3ed166cd7cf2c95d242ab76bf70db030eff086` |
| WordPress `release.php` size | 852,153 bytes |
| Built index | `997ca77751fa2b0d50a0bc762b16e1cfc9196546074a45e68c6c3d10f1fffe4f` |
| Built app | `3ae148bb98be766fff5f45a6289059c4302c480c5f456d8851503c7a68c5e8b4` |
| Built auth | `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` |
| Built styles | `08a392b234f52f15640e3cc7c6894d2688de089f9cfe8bc175e8dadfe4c28f35` |
| Fixed implementation ledger | 36/36 |
| Artifact eligible | true |
| Deployable under current authority | false |
| Deployment authorized | false |

The release remains a locally runnable deterministic candidate. The release
receipt's `deployable=false` and `deployment_authorized=false` are preserved.

## 3. Latest local verification in this run

No local container runtime was used.

| Gate | Latest verified result |
|---|---|
| `npm test` | 189/189 PASS |
| PostgreSQL 18 authorization/integration suites | 67/67 + 71/71 + 12/12 = 150/150 PASS |
| Browser E2E | 45/45 PASS |
| Development conformance and accessibility | 72/72 PASS |
| Product provenance | PASS |
| WordPress route manifest | PASS |
| API-only build | PASS |
| Phase-one release safety | PASS |
| Secret scan | PASS |
| `npm audit` all dependencies | 0 vulnerabilities |
| `npm audit --omit=dev` | 0 vulnerabilities |
| PHP lint, route and release | PASS |
| `git diff --check` | PASS |

These results were collected during the 2026-07-29 preflight represented by
this timestamped handoff. They are not substitutes for the exact post-cutover
rerun.

`npm run test:integration` was not run: its current script invokes destructive
container teardown, and the steering expressly forbids container-runtime work.
The counts above do not include that suite.

Independent smoke and adversarial results:

- accessibility: PASS for dormant text workflows; 72/72 conformance included
  keyboard, reduced-motion, Axe A/AA, mobile, and overflow checks;
- terminology/IMG: PASS for the canonical dormant text scope; medically and
  residency-oriented workflows are preserved without nationality or accent
  assumptions;
- explicit IMG/ECFMG/visa onboarding is absent from both canonical V5 and the
  candidate, so adding it now would require new product authority rather than
  a conformance repair;
- medical/accent transcription quality remains unclaimed until the required
  human corpus and real-provider bake-off pass;
- targeted fail-closed adversarial tests: 7/7 PASS.

The local browser candidate loaded at `http://127.0.0.1:4180/` with the
canonical student shell. With the voice controls closed, the DOM contained no
microphone button, voice dock, audio element, or iframe. No browser warning or
error was observed. This is expected dormant behavior, not evidence of
production voice readiness.

## 4. Production baseline read-only snapshot

### Railway

| Resource | Fresh read-only result |
|---|---|
| Project | `missionmed-storyforge-v5` / `875e7c17-d06f-4301-a4bb-e61016f153cf` |
| Environment | production / `bcef8734-e42b-44df-8488-c2a3de68213f` |
| API service | `storyforge-v5-api` / `dab015bf-15ef-4698-9f16-cbf8cf23de7a` |
| API deployment | `fa7ad084-4dae-4039-a154-2250a407d95e`, SUCCESS |
| API image | `sha256:fa952146914f1eb4ab3cdfd6ccfe7f2d0d69c1638f6de59668f2272443500d2b` |
| API topology | exactly one running instance; `us-west2=1` |
| PostgreSQL service | `a4a66362-c3ba-475a-ae21-2aa46624bafe` |
| PostgreSQL deployment | `f5c7179e-b805-4e82-b080-d2349a0a47cf`, SUCCESS |
| PostgreSQL image | `sha256:b2d7ada8780d7cad8167b3a23b54de0bd4ede0491ac04d80690fb61eb7bd4b8c` |
| PostgreSQL topology | exactly one running instance |
| Current deployed commit | `6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Current production release | `v-0912286e7dfc2327` |

Current production preserves:

```text
STORYFORGE_ORIGIN_API_ONLY=true
STORYFORGE_BASE_PATH=/storyforge/
STORYFORGE_DEV_AUTH=false
STORYFORGE_AI_MENTOR_BETA=false
STORYFORGE_AI_STUDENT_GENERAL=false
STORYFORGE_AI_CLINICAL_MENTOR=false
STORYFORGE_AI_CLINICAL_STUDENT=false
```

No candidate voice, provider, reconciliation, R2, OpenAI, or platform
variables are currently present. Their absence is expected because production
still runs B1-503. It is not a readback of the future dormant configuration.

### PostgreSQL

Fresh read-only evidence:

- PostgreSQL 18.4, SSL enabled;
- database `railway`;
- system identifier `7667256745042145332`;
- exactly the five known B1-503 migration-ledger rows and hashes;
- B1-506/B1-506A future tables are absent;
- one StoryForge user and zero active assignments;
- `anon` and `authenticated` cannot log in and have neither superuser nor
  bypass-RLS privileges;
- `storyforge_app` can log in and has neither superuser nor bypass-RLS
  privileges;
- the sole WordPress allowlisted identity maps to the sole `sf_users` identity,
  proved by privacy-preserving hash comparison.

No student story, transcript, or audio content was queried.

### Kinsta and WordPress

| Item | Fresh read-only result |
|---|---|
| SSH alias | `missionmed-kinsta`, available |
| WordPress root | `/www/theresidencyacademy_209/public` |
| PHP / WP-CLI | `/usr/bin/php` / `/usr/local/bin/wp` |
| Current release pointer | `releases/6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Current route SHA-256 | `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61` |
| Current route mode | `0444` |
| Current release mode | `0444`; parent runtime `0555` |
| Expected owner | `theresidencyacademy:www-data` |
| SSO plugin SHA-256 | `eaf740af712ec5ef94415bae78c3107b751977f74f413b3d60a8533202e120d7` |
| Private cutover lock | absent |
| Candidate target | absent, as expected before staging |

The SSO/plugin settings summary remains:

- `storyforge_enabled=true`;
- exactly one allowlisted Founder pilot account;
- exactly one `student` app-role override;
- allowed roles exactly `student`;
- zero cohorts;
- JWT TTL 60 seconds.

The in-app browser WordPress session had expired and reached the login page.
Therefore this run does not claim a fresh authenticated live browser journey.
The exact human action is to sign in with the existing Founder pilot account
immediately before cutover smoke testing and then open
`https://missionmedinstitute.com/storyforge/`.

### Public route and API boundary

Fresh anonymous HTTP evidence:

- `/storyforge` returns a canonical 308 to `/storyforge/`;
- `/storyforge/` returns 200 with `no-store`,
  `X-StoryForge-Route: wordpress-gateway`, `SAMEORIGIN`, `noindex`, and the
  expected CSP;
- `/storyforge/healthz` returns 200;
- `/storyforge/api/config` returns 200 and reports `audioAvailable=false`,
  signed-JWT identity, the WordPress bootstrap/token paths, and all AI flags
  false;
- WordPress bootstrap returns 401 when unauthenticated;
- `/storyforge/api/stories` returns 401 when unauthenticated;
- the Railway origin returns 404 at `/`, 200 at `/healthz`, 401 for protected
  API access, and 403 for an unapproved Origin.

Fresh live B1-503 static hashes:

| Asset | SHA-256 |
|---|---|
| index | `ade2b11958fa70305e6bb5a99e08f1e9621a37cb3cf7df5ce4af964016fee27b` |
| app | `71f618e9afac78d13c1b22d30b0ad43e2b2c7ab162b6e1d92ae607b3b853f3fb` |
| auth | `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` |
| styles | `41e546d34bfd73f0f9f446047640ba2cf7c303b092841b9f5115911293e7ddf1` |

These match the B1-503 production receipt.

### Cloudflare and R2

No Cloudflare CLI credential or authenticated dashboard session was available.
RP-4 and the provider-side portion of RP-6 were not guessed.

Fresh Railway evidence shows no `STORYFORGE_R2_*` variables. Dormant StoryForge
therefore remains audio-unconfigured and fail-closed. No R2 bucket, token, CORS,
lifecycle, DNS, Worker, or cache configuration was created or changed.

Smallest later action: provide a time-bounded read-only Cloudflare session or
API token with Zone/DNS, Workers Routes, and R2 bucket configuration-list
permissions. RP-4/RP-6 provider-side proof is mandatory before dormant
cutover unless a higher authority explicitly waives it. If a `/storyforge*`
Worker route or public audio bucket is found, stop and return it to the
architecture authority.

## 5. RP-8 deferred contract

RP-8 remains required before:

- enabling transcription-provider traffic;
- enabling production audio assembly;
- selecting the permanent audio-assembly executor;
- claiming production voice capture complete;
- exposing voice capture to students.

RP-8 does not block:

- a dormant/default-off backend deployment;
- a hidden frontend deployment;
- additive database migration with `voice_capture=off`;
- WordPress route deployment;
- existing Founder-only text StoryForge workflows;
- text-only production smoke testing.

The source fails closed while the executor remains unresolved:
`server/app.mjs` selects `assembly_authority_blocked`, and provider `none`
selects the unavailable transcription adapter. No source was changed to
simulate RP-8.

FABLE-C1 through C4 and PROBE-C5 remain blockers to permanent-audio
reconciliation `dry_run`/`on`, not to the dormant core release under this
Founder steering. They may be resolved after dormant deployment, but all must
be resolved before reconciliation changes from `off` to `dry_run` or `on`.

### Newly verified future voice-activation seam

An adversarial source audit found a separate production-integration blocker
for later voice activation:

- `public/app.js` sends recording segments as `FormData`, which produces a
  multipart POST;
- the same client uses HTTP `DELETE` for saved-audio deletion;
- the canonical WordPress gateway currently allows only `GET`, `POST`, and
  `PATCH`;
- that gateway requires `application/json` for every `POST` and `PATCH`.

Therefore, if voice were enabled through the canonical `/storyforge/` route
today, segment upload would fail with 415 and saved-audio deletion would fail
with 405. Existing API-direct tests do not prove these two operations through
the WordPress gateway.

This does **not** block the dormant/text-only deployment because the database
flag, environment kill, provider `none`, absent R2 configuration, and hidden UI
prevent these calls. It does block every later claim of end-to-end production
voice readiness independently of RP-8.

Smallest later action: authorize a bounded gateway compatibility repair that
permits multipart only for the exact authenticated segment-upload route and
permits `DELETE` only for the exact authenticated audio-delete route, while
preserving size limits, origin checks, JWT forwarding, response limits, and all
other method/content-type denials. Add WordPress-gateway integration tests for
both operations and pass them before any voice activation. This is not an
architecture redesign and was not implemented in this read-only preflight.

The 36/36 count remains the fixed local implementation ledger; it must not be
misstated as end-to-end production voice conformance until this gateway seam,
RP-8, and the remaining provider/audio gates pass.

## 6. Non-RP8 external gates

### Gate A — stale protected-system manifest

This is the decisive deployment blocker.

`_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md` states:

- the manifest pin wins over committed source for deployment readiness;
- unapproved protected hash mismatches require a stop;
- protected route/hash mismatches cannot be reconciled by assumption.

`_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` G-18 prohibits raw protected deployment
without the Critical Systems Contract gate or an explicit Brian emergency
bypass.

The current `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` still describes a
pre-B1-503 StoryForge state:

- release commit `4bd956b6ea222d20428c41415236a73b93576447`;
- release ID `v-963b8f5eb4d8c727`;
- `production_active=false`;
- obsolete StoryForge index/app/auth/styles hashes and aliases.

The fresh live state is B1-503 commit `6f45dbbd...`, and the proposed candidate
is B1-506C `df42c5e...`.

A report-only critical gate run produced StoryForge failures for the local
index, missing obsolete app/auth/styles files, and live hashes/aliases. This is
authority drift, not a candidate defect.

Smallest required action: the authorized MissionMed control-plane owner must
reconcile the manifest from the verified B1-503 live baseline through the
B1-506C candidate transition and define pre/post-cutover pins, or Brian must
explicitly authorize the exact G-18 emergency bypass. Codex must not hand-edit
or mechanically substitute these protected pins.

What remains safe and complete without it: all local testing, release
generation, public read-only checks, production baseline mapping, deployment
command preparation, rollback preparation, and backup templates.

### Gate B — fresh backup and restore evidence

Historical B1-503 rollback evidence is intact, but it cannot substitute for a
fresh pre-B1-506C recovery point.

Required before any schema, credential, configuration, application, or cutover
mutation. Authorized recovery-point and backup creation occurs first and is
itself the only permitted initial remote write:

1. a new MyKinsta manual recovery point with visible restore control;
2. private Kinsta copies/receipts for the current pointer, route bytes/mode/
   owner, SSO plugin, and the complete `missionmed_storyforge_settings`
   option; the private rollback copy retains exact values, while committed
   evidence contains only a hash and redacted/count summary;
3. a PostgreSQL 18 custom-format logical dump;
4. a successful isolated PostgreSQL 18 restore rehearsal;
5. a new locked, non-expiring Railway provider-native PostgreSQL backup;
6. a private mode-`0600` Railway variable export;
7. a fresh 16-field database backup receipt accepted by the guarded runner.

Current B1-503 rollback anchors remain available:

- archive:
  `/Users/brianb/MissionMed_private_backups/B1-503/storyforge-v5-6f45dbbd2150ba11000236a4959f70434f6edb77.tar`;
- SHA-256:
  `dd9452428631297cab15cc48304ed3f317eecb492801c5e5be6427f080668870`;
- historical sealed Kinsta rollback receipt and prior versioned `0555` release
  (defense in depth, not host-enforced immutability).

Smallest required action: an authorized operator creates the fresh backup set
and files its receipts. Backup creation is a remote write and was not
authorized by the current Goal.

### Gate C — guarded migration preflight prerequisites

Source review and fresh production target facts are green. A valid formal
preflight cannot run until Gate B supplies the exact fresh backup receipt and a
secure time-bounded `storyforge_app` password.

Expected preflight sentinel:

```text
B1_506_PRODUCTION_MIGRATION_PREFLIGHT_PASS
```

Apply requires separate authority and:

```text
STORYFORGE_MIGRATION_CONFIRM=B1-506A-APPLY-THREE-MIGRATIONS
```

Smallest required action: provide the fresh receipt and scoped secret session,
then execute the existing runner in `preflight` mode. Do not apply migrations
without explicit migration/deployment authority.

### Gate D — Kinsta private staging and feature-off

Kinsta prestate is resolved, but the versioned-release preflight (the existing
script/runbook's “immutable release” label) deliberately
requires:

- exact candidate route and release files privately staged outside public root;
- `storyforge_enabled=false`;
- an absent, freshly selected rollback directory.

Private staging and the WordPress feature change are remote writes. Production
is currently enabled, so a valid preflight would correctly refuse now.

Required sequence once authorized:

1. complete Gate B;
2. stage only the exact verified route/release files and unchanged scripts in a
   new private directory;
3. set only `storyforge_enabled=false`, preserving the one-Founder allowlist,
   student override, allowed role, zero cohorts, and TTL;
4. record the time, wait at least 65 seconds, and verify feature-off again;
5. choose one new absent rollback child;
6. run the existing versioned-release install script in `preflight` mode.

Expected sentinel:

```text
B1_503_KINSTA_INSTALL_PREFLIGHT_PASS
```

### Gate E — authenticated cutover sessions and Cloudflare read-only access

Required at the cutover window:

- a fresh Founder WordPress session for authenticated browser smoke;
- the currently available scoped Railway and Kinsta sessions revalidated;
- a time-bounded read-only Cloudflare session/token for mandatory RP-4/RP-6
  provider-side route/bucket proof, unless higher authority explicitly waives
  that proof.

No password, MFA, or access challenge was bypassed.

### Gate F — access expansion evidence

The completed B1-505 production access handoff and receipt expected by later
cohort stages are absent. This does not block retaining the existing exact
one-Founder text pilot. It blocks any student/cohort/general expansion.

A separate Founder-controlled admin mapping is also not currently proved. It
is required later for the E11 voice-administration account, not for dormant
text StoryForge.

## 7. Required dormant configuration

Before candidate upload, export the current Railway variables privately and
then set/read back:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED absent or empty
STORYFORGE_VOICE_FORCE_OFF=1
STORYFORGE_PLATFORM_OFF=1
STORYFORGE_PLATFORM_CONSUMERS absent or empty
STORYFORGE_R2_* absent
STORYFORGE_OPENAI_API_KEY absent
```

Preserve:

```text
STORYFORGE_ORIGIN_API_ONLY=true
STORYFORGE_BASE_PATH=/storyforge/
STORYFORGE_DEV_AUTH=false
STORYFORGE_AI_MENTOR_BETA=false
STORYFORGE_AI_STUDENT_GENERAL=false
STORYFORGE_AI_CLINICAL_MENTOR=false
STORYFORGE_AI_CLINICAL_STUDENT=false
```

`STORYFORGE_PLATFORM_OFF` is not currently consumed by runtime code and
`/platform/v1` is absent. The endpoint is therefore absent/fail-closed, but the
variable must not be claimed as an exercised software kill switch.

## 8. Deployment authorization template and fixed command packet

This packet is prepared, not authorized or executed. All currently knowable
service identifiers, hashes, sizes, paths, and confirmation tokens are fixed
below. Operator-created private backup/staging paths, newly issued receipt
values, scoped secrets, and the explicit authority reference must be filled
from the cutover session; they cannot truthfully be pre-invented.

### Services that would change

| Service | Exact change | Reversible |
|---|---|---|
| MissionMed control plane | authoritative StoryForge manifest transition | authority-owned; must define rollback pins |
| Railway PostgreSQL | three additive B1-506/B1-506A migrations, feature seeded `off`, and guarded `storyforge_app` password/LOGIN transition | schema normally remains dormant; password is synchronized, restore only for corruption |
| Railway API | matching new database URL, dormant variables, and exact B1-506C API upload | yes, redeploy verified B1-503 archive while retaining the matching database credential |
| Kinsta WordPress | temporary StoryForge feature-off, private staging, versioned release and isolated route/pointer cutover | yes, sealed pointer/route rollback |
| WordPress settings | restore exact one-Founder text access after smoke | yes, restore fresh option backup |

Not authorized or required:

- Cloudflare/DNS/Worker/cache changes;
- R2 bucket/token/CORS/lifecycle changes;
- OpenAI or any transcription-provider key;
- provider traffic;
- audio upload/retention;
- assembly-executor selection;
- reconciliation `dry_run` or `on`;
- voice activation;
- cohort/student/general access expansion;
- Matrix-owned asset edits.

Binding execution order after authorization:

1. complete Packet A;
2. execute Packet D only through private backup, staging, feature-off, the
   65-second drain, and Kinsta `preflight`;
3. execute Packet B preflight/apply and synchronize the new app-role password;
4. execute Packet C dormant variable readback and Railway deploy;
5. return to Packet D for the Kinsta install and sealed rollback receipt;
6. execute Packet E while every voice layer remains off;
7. leave Packet F for a later, separately authorized voice-activation run.

### Packet A — authority, backup, and exact source gate

Expected result:

- protected manifest/gate reconciled or exact G-18 bypass recorded;
- fresh backup/restore receipts complete;
- scoped sessions current;
- Cloudflare RP-4/RP-6 read-only proof complete or a higher-authority waiver
  recorded;
- no schema, credential, configuration, application, or cutover mutation before
  all listed prerequisites are true; only the separately authorized
  recovery-point creation occurs first.

Verification:

- run the complete Critical Systems Contract gate:
  `python3 _SYSTEM/tools/critical_systems_gate.py --enforce`;
- verify current B1-503 hashes and pointers again;
- verify the B1-503 rollback archive hash.

The protected-pin transition has three distinct evidence points:

1. current B1-503 live pins and a green gate before mutation;
2. candidate-local validation under the control-plane owner's explicitly
   approved transition procedure; and
3. B1-506C candidate/live pins plus a green gate immediately after cutover.

Do not imply that one single-state manifest can truthfully pin both old and new
production at the same instant, and do not invent a new manifest schema. The
authorized control-plane owner must define and record the transition.

Rollback: no cutover has occurred; discard private staging only if explicitly
authorized.

Create one private, hash-recorded deployment archive from the exact product
source pin. A later documentation-only handoff commit is not the product
deployment commit and does not change this pin:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502

B1_506_PRODUCT_COMMIT="df42c5e05dd11f63c7ea17f99127e43e2d03347c"
B1_506_SOURCE_ARCHIVE="<ABSOLUTE_PRIVATE_MODE_0600_ARCHIVE_PATH>"

git archive --format=tar \
  --output="$B1_506_SOURCE_ARCHIVE" \
  "$B1_506_PRODUCT_COMMIT"
chmod 0600 "$B1_506_SOURCE_ARCHIVE"
test "$(git get-tar-commit-id < "$B1_506_SOURCE_ARCHIVE")" = \
  "$B1_506_PRODUCT_COMMIT"
test "$(shasum -a 256 "$B1_506_SOURCE_ARCHIVE" | awk '{print $1}')" = \
  "315318b5f6b874bf85ea923f574fb16c739638006e0ba35a3acbcd681a9814c8"
```

Record the archive hash in the authorization receipt. Use this same archive
for the migration runner's archive mode and Railway upload.

### Packet B — guarded database migration

From:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5
```

Load secrets only through the approved scoped session. Pin the fresh project,
environment, database service, host/port/user/database, system identifier,
user count `1`, active-assignment count `0`, Founder UUID, new app-role
password, source archive/hash, and 16-field backup receipt.

The runner performs two consequential credential writes in the same guarded
transaction:

```sql
ALTER ROLE storyforge_app PASSWORD <new scoped password>;
ALTER ROLE storyforge_app LOGIN;
```

Before apply, prepare a new Railway `STORYFORGE_DATABASE_URL` containing that
same new password using a secret-safe method and stage it with
`--skip-deploys`. Do not print it. Temporarily force WordPress StoryForge off
and drain the 60-second JWT TTL before the role-password change. Apply the
migrations and deploy the candidate API in one controlled cutover window so
the current B1-503 pool is not expected to reconnect with the old password.

In an approved isolated shell with command tracing disabled, set the value via
stdin so it is not placed in the command arguments:

```bash
set +x
test -n "${NEW_STORYFORGE_DATABASE_URL:-}" \
  || { echo "load NEW_STORYFORGE_DATABASE_URL through the approved secret session" >&2; exit 1; }
printf '%s' "$NEW_STORYFORGE_DATABASE_URL" |
railway variable set STORYFORGE_DATABASE_URL \
  --stdin \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --skip-deploys \
  --json >/dev/null
unset NEW_STORYFORGE_DATABASE_URL

railway variable list \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --json |
jq '{storyforge_database_url_present: has("STORYFORGE_DATABASE_URL")}'
```

The expected presence-only result is `true`; never print the URL.

Required environment template; replace only the receipt paths/hashes and
secret values from fresh scoped evidence:

```bash
export STORYFORGE_RAILWAY_PROJECT_ID="875e7c17-d06f-4301-a4bb-e61016f153cf"
export STORYFORGE_RAILWAY_ENVIRONMENT_ID="bcef8734-e42b-44df-8488-c2a3de68213f"
export STORYFORGE_RAILWAY_DATABASE_SERVICE_ID="a4a66362-c3ba-475a-ae21-2aa46624bafe"
export STORYFORGE_DB_BACKUP_ID="<FRESH_LOCKED_BACKUP_ID>"
export STORYFORGE_DB_BACKUP_RECEIPT="<ABSOLUTE_PRIVATE_16_FIELD_RECEIPT>"
export STORYFORGE_DB_BACKUP_RECEIPT_SHA256="<FRESH_RECEIPT_SHA256>"
export STORYFORGE_DEPLOY_GIT_COMMIT="df42c5e05dd11f63c7ea17f99127e43e2d03347c"
export STORYFORGE_SOURCE_MODE="archive"
export STORYFORGE_SOURCE_ARCHIVE="$B1_506_SOURCE_ARCHIVE"
export STORYFORGE_SOURCE_ARCHIVE_SHA256="315318b5f6b874bf85ea923f574fb16c739638006e0ba35a3acbcd681a9814c8"
export STORYFORGE_APP_DB_PASSWORD="<NEW_SCOPED_APP_ROLE_PASSWORD>"
export STORYFORGE_EXPECTED_PGHOST="sakura.proxy.rlwy.net"
export STORYFORGE_EXPECTED_PGPORT="10257"
export STORYFORGE_EXPECTED_PGUSER="postgres"
export STORYFORGE_EXPECTED_PGDATABASE="railway"
export STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER="7667256745042145332"
export STORYFORGE_EXPECTED_USER_COUNT="1"
export STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT="0"
export STORYFORGE_FOUNDER_USER_ID="<FOUNDER_STORYFORGE_UUID_FROM_SCOPED_SESSION>"
export RAILWAY_PROJECT_ID="$STORYFORGE_RAILWAY_PROJECT_ID"
export RAILWAY_ENVIRONMENT_ID="$STORYFORGE_RAILWAY_ENVIRONMENT_ID"
export RAILWAY_SERVICE_ID="$STORYFORGE_RAILWAY_DATABASE_SERVICE_ID"
export PGHOST="$STORYFORGE_EXPECTED_PGHOST"
export PGPORT="$STORYFORGE_EXPECTED_PGPORT"
export PGUSER="$STORYFORGE_EXPECTED_PGUSER"
export PGPASSWORD="<CURRENT_PRIVILEGED_MIGRATION_PASSWORD>"
export PGDATABASE="$STORYFORGE_EXPECTED_PGDATABASE"
export PGSSLMODE="require"
```

Re-read and re-pin the host, port, system identifier, counts, identity mapping,
and receipt immediately before invoking the runner. If any current value
differs from this snapshot, stop rather than editing the runner around it.

Read-only:

```bash
./scripts/apply-production-migrations.sh preflight
```

Authorized write:

```bash
STORYFORGE_MIGRATION_CONFIRM=B1-506A-APPLY-THREE-MIGRATIONS \
  ./scripts/apply-production-migrations.sh apply
```

Expected result:

- exactly three pending migrations become exactly eight ledger rows;
- `voice_capture` exists with scope `off`;
- user and active-assignment counts remain unchanged;
- the deployed API's `STORYFORGE_DATABASE_URL` authenticates as
  `storyforge_app` with the newly applied password;
- authorization/effective-authority validation passes.

Rollback:

- normal application rollback leaves additive schema dormant;
- a B1-503 code rollback must retain the new matching database URL/password;
  do not restore the old database URL from the variable export unless the
  database role password is also restored through an expressly authorized
  database recovery;
- reverse SQL or database restore only for verified corruption and fresh
  Founder authorization.

### Packet C — Railway dormant variables and API

After the private variable export:

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

Verify the two optional variables are absent/empty and all R2/OpenAI variables
remain absent without printing secret values:

```bash
railway variable list \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --json |
jq '{
  transcription: .STORYFORGE_TRANSCRIBE_PROVIDER,
  reconciliation: .STORYFORGE_AUDIO_RECONCILIATION,
  suspension_empty: (((.STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED // "") | length) == 0),
  voice_force_off: .STORYFORGE_VOICE_FORCE_OFF,
  platform_off: .STORYFORGE_PLATFORM_OFF,
  platform_consumers_empty: (((.STORYFORGE_PLATFORM_CONSUMERS // "") | length) == 0),
  r2_names_present: ([keys[] | select(startswith("STORYFORGE_R2_"))] | length),
  openai_key_present: has("STORYFORGE_OPENAI_API_KEY")
}'
```

Deploy from the exact private archive, not from a later documentation-only
worktree HEAD:

```bash
B1_506_DEPLOY_TREE="$(mktemp -d /tmp/b1-506c-railway-deploy.XXXXXX)"
tar -xf "$B1_506_SOURCE_ARCHIVE" -C "$B1_506_DEPLOY_TREE"

railway up "$B1_506_DEPLOY_TREE/storyforge-v5" \
  --path-as-root \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --detach --json \
  --message "B1-506C dormant default-off StoryForge V5.5"
```

Expected result:

- deployment SUCCESS;
- exactly one API replica;
- `/healthz` 200;
- direct origin `/` 404;
- unauthenticated API 401;
- unapproved Origin 403;
- no provider, R2, assembly, reconciliation, AI, dev-auth, or platform work.

Rollback:

```bash
B1_506_ROLLBACK_ARCHIVE="/Users/brianb/MissionMed_private_backups/B1-503/storyforge-v5-6f45dbbd2150ba11000236a4959f70434f6edb77.tar"
test "$(shasum -a 256 "$B1_506_ROLLBACK_ARCHIVE" | awk '{print $1}')" = \
  "dd9452428631297cab15cc48304ed3f317eecb492801c5e5be6427f080668870"

B1_506_ROLLBACK_TREE="$(mktemp -d /tmp/b1-506c-railway-rollback.XXXXXX)"
tar -xf "$B1_506_ROLLBACK_ARCHIVE" -C "$B1_506_ROLLBACK_TREE"

railway up "$B1_506_ROLLBACK_TREE/storyforge-v5" \
  --path-as-root \
  --project 875e7c17-d06f-4301-a4bb-e61016f153cf \
  --environment bcef8734-e42b-44df-8488-c2a3de68213f \
  --service dab015bf-15ef-4698-9f16-cbf8cf23de7a \
  --detach --json \
  --message "Rollback B1-506C to verified B1-503"
```

Then restore the pre-cutover non-database variables and re-run the
health/auth/origin checks. Retain the new matching
`STORYFORGE_DATABASE_URL` unless an authorized database recovery also restores
the old role password. The Railway CLI cannot select the prior deployment ID
for redeployment; rollback re-uploads the hash-verified archive.

### Packet D — Kinsta versioned frontend preparation and install

Complete private staging and the 65-second feature-off gate before preflight.

Privately back up the complete WordPress option before changing it:

```bash
KINSTA_WP_ROOT="/www/theresidencyacademy_209/public"
PRIVATE_SETTINGS_BACKUP="<ABSOLUTE_PRIVATE_SETTINGS_BACKUP_JSON>"
umask 077
/usr/local/bin/wp --path="$KINSTA_WP_ROOT" \
  option get missionmed_storyforge_settings --format=json \
  > "$PRIVATE_SETTINGS_BACKUP"
chmod 0600 "$PRIVATE_SETTINGS_BACKUP"
test -s "$PRIVATE_SETTINGS_BACKUP"
shasum -a 256 "$PRIVATE_SETTINGS_BACKUP"
```

The private file must retain the complete option. File only its SHA-256 and
this safe summary in committed evidence:

```bash
/usr/local/bin/wp --path="$KINSTA_WP_ROOT" eval '
$s = get_option("missionmed_storyforge_settings", array());
if (!is_array($s)) { throw new RuntimeException("settings unavailable"); }
echo wp_json_encode(array(
  "enabled" => !empty($s["storyforge_enabled"]),
  "allowed_user_count" => count((array)($s["allowed_user_ids"] ?? array())),
  "role_override_count" => count((array)($s["app_role_overrides"] ?? array())),
  "role_override_values" => array_values((array)($s["app_role_overrides"] ?? array())),
  "allowed_roles" => array_values((array)($s["allowed_roles"] ?? array())),
  "cohort_count" => count((array)($s["allowed_cohorts"] ?? array())),
  "token_ttl_seconds" => (int)($s["token_ttl_seconds"] ?? 0),
)) . PHP_EOL;
'
```

Set only the feature flag off:

```bash
/usr/local/bin/wp --path="$KINSTA_WP_ROOT" eval '
$s = get_option("missionmed_storyforge_settings", array());
if (!is_array($s)) { throw new RuntimeException("settings unavailable"); }
$s["storyforge_enabled"] = false;
update_option("missionmed_storyforge_settings", $s);
$v = get_option("missionmed_storyforge_settings", array());
if (!is_array($v) || !empty($v["storyforge_enabled"])) {
  throw new RuntimeException("feature-off verification failed");
}
echo "storyforge_enabled=false\n";
'
```

Record the timestamp, wait at least 65 seconds, rerun the safe summary, and
require the same one user, one `student` override, allowed roles exactly
`student`, zero cohorts, and TTL 60 before Kinsta preflight.

On the Kinsta host, from the private staging directory, resolve only the two
operator-created absolute paths. The product commit is fixed:

```bash
B1_506_PRODUCT_COMMIT="df42c5e05dd11f63c7ea17f99127e43e2d03347c"
PRIVATE_STAGING="<ABSOLUTE_PRIVATE_STAGING_DIRECTORY>"
PRIVATE_ROLLBACK_DIR="<ABSOLUTE_NEW_PRIVATE_ROLLBACK_DIRECTORY>"

test ! -e "/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-storyforge-runtime/releases/$B1_506_PRODUCT_COMMIT"
test ! -L "/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-storyforge-runtime/releases/$B1_506_PRODUCT_COMMIT"
test ! -e "$PRIVATE_ROLLBACK_DIR"
test ! -L "$PRIVATE_ROLLBACK_DIR"
test ! -e "$(dirname "$PRIVATE_ROLLBACK_DIR")/.b1-503-cutover-lock"

bash "$PRIVATE_STAGING/install-b1-503-kinsta-release.sh" preflight \
  --remote-root /www/theresidencyacademy_209/public \
  --release-commit "$B1_506_PRODUCT_COMMIT" \
  --route-source "$PRIVATE_STAGING/missionmed-storyforge-route.php" \
  --release-source "$PRIVATE_STAGING/release.php" \
  --route-sha256 25c5c78549fadc28e02ba36e68a0e20186761bfab4a9ef00c0a52ac2640a22ff \
  --route-size 31654 \
  --release-sha256 e74f985fc099d3a05b5670f6df3ed166cd7cf2c95d242ab76bf70db030eff086 \
  --release-size 852153 \
  --release-id v-0892c26c62d96206 \
  --expected-owner theresidencyacademy:www-data \
  --expected-current-target releases/6f45dbbd2150ba11000236a4959f70434f6edb77 \
  --expected-route-sha256 1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61 \
  --rollback-dir "$PRIVATE_ROLLBACK_DIR" \
  --wp-cli /usr/local/bin/wp \
  --php-cli /usr/bin/php
```

Authorized install:

```bash
bash "$PRIVATE_STAGING/install-b1-503-kinsta-release.sh" install \
  --remote-root /www/theresidencyacademy_209/public \
  --release-commit "$B1_506_PRODUCT_COMMIT" \
  --route-source "$PRIVATE_STAGING/missionmed-storyforge-route.php" \
  --release-source "$PRIVATE_STAGING/release.php" \
  --route-sha256 25c5c78549fadc28e02ba36e68a0e20186761bfab4a9ef00c0a52ac2640a22ff \
  --route-size 31654 \
  --release-sha256 e74f985fc099d3a05b5670f6df3ed166cd7cf2c95d242ab76bf70db030eff086 \
  --release-size 852153 \
  --release-id v-0892c26c62d96206 \
  --expected-owner theresidencyacademy:www-data \
  --expected-current-target releases/6f45dbbd2150ba11000236a4959f70434f6edb77 \
  --expected-route-sha256 1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61 \
  --rollback-dir "$PRIVATE_ROLLBACK_DIR" \
  --wp-cli /usr/local/bin/wp \
  --php-cli /usr/bin/php \
  --confirm B1-503-INSTALL
```

Expected result:

- versioned `0555` release directory; this is defense in depth, not
  host-enforced immutability under the accepted shared Unix owner;
- regular `0444` `release.php`;
- atomic `current` pointer and isolated route replacement;
- sealed rollback receipt and receipt hash;
- only scoped Kinsta cache purges;
- prior release directories untouched.

Rollback:

```bash
bash "$PRIVATE_STAGING/rollback-b1-503-kinsta-release.sh" preflight \
  --remote-root /www/theresidencyacademy_209/public \
  --receipt "$EXACT_EMITTED_ROLLBACK_RECEIPT" \
  --receipt-sha256 "$EXACT_EMITTED_RECEIPT_SHA256" \
  --wp-cli /usr/local/bin/wp \
  --php-cli /usr/bin/php
```

Then use identical pinned arguments in rollback mode with:

```bash
bash "$PRIVATE_STAGING/rollback-b1-503-kinsta-release.sh" rollback \
  --remote-root /www/theresidencyacademy_209/public \
  --receipt "$EXACT_EMITTED_ROLLBACK_RECEIPT" \
  --receipt-sha256 "$EXACT_EMITTED_RECEIPT_SHA256" \
  --wp-cli /usr/local/bin/wp \
  --php-cli /usr/bin/php \
  --confirm B1-503-ROLLBACK
```

### Packet E — hidden smoke and exact text re-enable

While `storyforge_enabled=false`, verify:

- root, immutable asset aliases, denied index alias, raw asset denial, direct
  release denial, health, bootstrap 401, and API 401 expectations;
- exact candidate hashes and route header;
- Critical Systems Contract gate and protected Matrix locks;
- Railway one-replica topology and dormant-variable readback;
- no voice UI, audio configuration, provider calls, or student audio.

Then restore only `storyforge_enabled=true`, preserving:

- the exact one-Founder allowlist;
- pilot app role `student`;
- allowed roles exactly `student`;
- zero cohorts;
- TTL 60;
- database voice flag `off`;
- environment voice kill `1`;
- provider `none`;
- reconciliation `off`.

Use the freshly authenticated Founder session to smoke:

- Matrix launch;
- Home, Library, Story Detail, Story Builder, Review, Settings, and other
  canonical text surfaces using read-only navigation;
- logout and denied identity behavior.

Do not create, edit, save, or delete a production story in this dormant smoke.
Any later disposable-content journey requires a separately listed
production-data mutation, retention/cleanup rule, and receipt.

Re-enable only the preserved text pilot and verify the safe summary:

```bash
/usr/local/bin/wp --path="$KINSTA_WP_ROOT" eval '
$s = get_option("missionmed_storyforge_settings", array());
if (!is_array($s)) { throw new RuntimeException("settings unavailable"); }
$s["storyforge_enabled"] = true;
update_option("missionmed_storyforge_settings", $s);
$v = get_option("missionmed_storyforge_settings", array());
if (!is_array($v) || empty($v["storyforge_enabled"])) {
  throw new RuntimeException("text-pilot re-enable verification failed");
}
$users = array_values((array)($v["allowed_user_ids"] ?? array()));
$overrides = array_values((array)($v["app_role_overrides"] ?? array()));
$roles = array_values((array)($v["allowed_roles"] ?? array()));
$cohorts = array_values((array)($v["allowed_cohorts"] ?? array()));
if (
  count($users) !== 1
  || $overrides !== array("student")
  || $roles !== array("student")
  || count($cohorts) !== 0
  || (int)($v["token_ttl_seconds"] ?? 0) !== 60
) {
  throw new RuntimeException("text-pilot settings changed unexpectedly");
}
echo "storyforge_enabled=true; allowlist=1; override=student; roles=student; cohorts=0; ttl=60\n";
'
```

Using the authenticated eligible Founder pilot identity, verify E1 and the
legacy presign/confirm routes return HTTP 403 with code `voice_disabled`.
Anonymous requests are expected to return 401 and do not prove the voice kill.

No voice capture is claimed or exposed.

### Packet F — later two-account voice preparation

Do not perform during dormant cutover unless separately authorized.

Two separate allowlists must not be conflated:

1. WordPress `missionmed_storyforge_settings.allowed_user_ids` controls who may
   launch StoryForge and obtain a JWT.
2. PostgreSQL `sf_feature_flags.allowlist` for `voice_capture` controls whose
   already-authorized student identity may use voice.

After a new complete private WordPress option backup, the separately authorized
WordPress change is:

```text
allowed_user_ids = [exact existing Founder pilot WP ID, exact separate Founder-admin WP ID]
app_role_overrides[existing pilot WP ID] = student
app_role_overrides[separate admin WP ID] = admin
allowed_roles = [student, admin]
allowed_cohorts = []
token_ttl_seconds = 60
```

Both IDs must come from the scoped session and be hash-recorded rather than
printed in committed evidence. The existing pilot remains `student`; the
separate Founder-controlled identity receives `admin`.

Only after RP-8, provider/data-posture, R2, gateway multipart/DELETE,
real-device, and Founder gates pass, the separate authenticated admin may call
E11 with:

```json
{
  "scope": "allowlist",
  "allowlist": ["<EXACT_EXISTING_PILOT_STORYFORGE_UUID>"],
  "cohorts": []
}
```

The voice allowlist contains only the pilot StoryForge UUID. The admin identity
is not added to that student voice allowlist. Require the append-only feature
audit row.

Rollback order:

1. set `STORYFORGE_VOICE_FORCE_OFF=1`;
2. use E11 to restore `voice_capture` scope `off`;
3. verify the feature audit row;
4. restore the exact complete WordPress option from its private backup using a
   local file read inside WP-CLI, not by placing option bytes in command
   arguments:

```bash
STORYFORGE_SETTINGS_BACKUP_PATH="$PRIVATE_SETTINGS_BACKUP" \
/usr/local/bin/wp --path="$KINSTA_WP_ROOT" eval '
$path = getenv("STORYFORGE_SETTINGS_BACKUP_PATH");
$s = json_decode((string)file_get_contents($path), true);
if (!is_array($s)) { throw new RuntimeException("invalid settings backup"); }
update_option("missionmed_storyforge_settings", $s);
echo "storyforge_settings_restored\n";
'
```

RP-8, provider/data-posture, R2, real-device, and Founder gates must all pass
before clearing `STORYFORGE_VOICE_FORCE_OFF=1`.

## 9. Text-based Founder-only readiness

**YES, technically**, the existing Founder-only text StoryForge can proceed
through the dormant release once the non-RP8 authority, backup, guarded
preflight, and remote-write gates above are satisfied.

Reconciliation `off` does not affect story creation, editing, review,
classification, reflection, question coverage, program fit, notifications,
mentor notes, or other existing text workflows. Provider `none` and the voice
kill deliberately suppress only the unreleased voice path.

This is not permission to deploy. It is a scoped product/runtime determination.

## 10. Shortest critical path

1. Control-plane owner reconciles the protected StoryForge manifest, or Brian
   grants the exact G-18 emergency bypass.
2. Obtain explicit bounded authorization for recovery-point creation, private
   backup/export creation, private Kinsta staging, and temporary WordPress
   feature-off; these are remote writes even though they precede cutover.
3. Operator obtains fresh scoped sessions, creates the complete fresh
   backup/restore set, proves Cloudflare RP-4/RP-6 (or records the
   higher-authority waiver), stages privately, turns the feature off, drains
   the TTL, and runs guarded database/Kinsta preflights.
4. Confirm explicit full cutover authority for the listed Railway PostgreSQL,
   Railway API, Kinsta route/pointer, and WordPress settings writes.
5. Apply migrations, deploy dormant Railway, install the hidden Kinsta candidate,
   and run feature-off smoke.
6. Re-enable only the existing one-Founder text pilot and run authenticated
   text conformance.
7. Leave RP-8, provider, R2, reconciliation, voice, and student expansion for
   their later gates.

## 11. Final claim boundary

Completed:

- 36/36 local implementation preserved;
- all applicable no-container suites rerun; the destructive
  container-integration script remains intentionally unexecuted;
- deterministic candidate and hashes verified;
- Railway/API/PostgreSQL topology and baseline verified read-only;
- Kinsta/WordPress pointer, route, plugin, and settings verified read-only;
- public route and unauthenticated auth boundary verified; a fresh
  authenticated Founder journey remains pending;
- migration and versioned-release preflight prerequisites reduced exactly;
- backup, deployment, verification, and rollback packet prepared;
- RP-8 correctly deferred.

Not completed:

- protected manifest reconciliation;
- fresh B1-506C backups and restore rehearsal;
- valid guarded production migration preflight;
- private Kinsta staging and feature-off preflight;
- fresh authenticated live Founder browser smoke;
- Cloudflare provider-side RP-4/RP-6;
- WordPress-gateway multipart upload and audio `DELETE` compatibility required
  before any later voice activation;
- any deployment or remote write;
- any provider, R2, audio, reconciliation, or voice enablement.

The next production-preflight task is:

**Have the authorized control-plane owner reconcile the StoryForge critical
manifest from the verified B1-503 live baseline to the B1-506C dormant
candidate, then create the fresh backup/restore receipt set before any other
remote mutation.**
