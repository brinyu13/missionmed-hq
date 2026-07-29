# B1-506 StoryForge V5.5 Phase 1 — Complete Combined Handoff

**READY FOR FABLE AMENDMENT AND PRODUCTION PREFLIGHT**

Recorded: 2026-07-29
Repository: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
Branch: `codex/b1-503-storyforge-product-recovery`
Verified source commit: `de1828ccb2c3672cc66b39e1ecbf46d1bfda5d1b`
Production or remote mutation: **NONE**

This is the canonical B1-506 closeout handoff requested by
`B1-506-STATUS-STEER-001`. It consolidates the implementation, current test
receipts, stopped-lane evidence, Fable amendment packet, Founder checklist,
local launch instructions, production preflight cards, and exact file
inventory. Earlier B1-506 handoffs remain historical evidence; where their
counts differ, this document's clean-commit reruns control.

## 1. Verdict

- Percentage of full Phase 1 **local implementation completed: 92%**.
- Authorized, noncontradictory offline work completed in this run: **100%**.
- Estimated progress through founder-scope production activation S12a: **58%**.
- Unexpected local regressions: **0**.
- Production-deployable artifact available now: **NO**.
- Runnable local development candidate available now: **YES**.
- Feature posture: voice remains default-off; real transcription remains
  provider-off; unresolved mutations and private queries fail closed.

The difference between 92% local implementation and 100% authorized offline
completion is deliberate. The remaining local code is exactly the work that
would require Codex to choose among contradictory or missing authorities:
student-only M1 predicates, audit execution/grants, E11/E13 query shapes,
recording lifecycle queries, provider model/request fields, RP-8 assembly, and
the E4/E7 finishing transaction. Those seams are preserved as explicit 503 or
release stops rather than guessed.

The combined clean-commit suite recorded **371 passing tests/assertions, five
expected authority-blocked reds, and zero unexpected failures**:

- unit: 128 pass;
- PostgreSQL: 138 pass, four expected Fable-blocked failures;
- browser E2E: 33 pass, one expected audit-authority-blocked failure;
- conformance: 72 pass.

The focused 18/18 release/cutover/build-security gate is a subset of the 128
unit tests and is not double-counted.

## 2. Repository and commit state

### Exact Git state before this handoff

- Repository root:
  `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Upstream: `origin/codex/b1-503-storyforge-product-recovery`
- Verified implementation HEAD:
  `de1828ccb2c3672cc66b39e1ecbf46d1bfda5d1b`
- Ahead/behind before this handoff commit: `0 behind / 8 ahead`
- `git status --short`: empty
- No unrelated tracked or untracked file was present.

### B1-506 commits on the branch

1. `a3255ad` — `B1-506: commit B1-504A/B1-504B authority folders (per RP-2)`
2. `6e630df` — `B1-506: record B1-505C founder execution authority`
3. `a8a6d7b` — `B1-506: implement default-off StoryForge voice candidate`
4. `10ccf94` — `B1-506: record stopped-lane implementation evidence`
5. `78ccf09` — `B1-506: enforce M1 release stop and file amendment request`
6. `5305fdd` — `B1-506: harden recording policy release parser`
7. `1baf546` — `B1-506: reconcile handoff with release-stop evidence`
8. `de1828c` — `B1-506: complete offline voice release candidate safeguards`

The commit that adds this self-contained handoff is reported by the supervising
Codex response. A tracked file cannot include the hash of the commit that
contains itself.

## 3. Authority and immutable hashes

Authority ordering is fixed by
`_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:5-16`.

| Artifact | Verified SHA-256 |
|---|---|
| Canonical StoryForge V5 HTML | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| Canonical V5.5 prototype | `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90` |
| V5.5 r2 copy revision | `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b` |
| Current locked M1 | `b175549e4f2e1606badccdd194f25e42a11b3954f95b435e0b75ebfb52d2cc5f` |
| Requested Fable-amended M1 | `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2` |
| M1 rollback | `669f6c2404222d07217dc6cd47c1eab57c52cdc70a6af20571a85ef347f5dca5` |
| M2 | `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a` |
| Current `public/app.js` | `0dab5f306819f49b11b5b8f0de88f06af7947bd49a9e5e2c9bfd62db9ffef107` |
| Current `public/styles.css` | `c5c693eb6530d2559ab1c9ba8dbb3f9a42692edefec184c36c5cf9bb5b7d7b04` |
| Current `server/recordings.mjs` | `c4cb5d9b81d072c2aa91c744389121999aa7e3602f6da25e24ffe9fb39e97843` |
| Current `server/flags.mjs` | `bd3013ab06886402511fad9c0c823ab792f6b6c67b2722fb7e0cf342ae960b0a` |
| Current transcription adapter | `a30f84d9f034af11de42d9b01ddf3d570cc90f2a3e8cab6b7f047fff90072983` |
| Current bake-off scorer CLI | `9b269ab030c10dca4451ff63728cfb96de8c5f733ad6809e2afd5b98cadba1d3` |
| Current bake-off library | `9f5b9981e13faad2fb0dce63e8183379150654283575267d7364181d442bd58c` |

The safe development output is isolated under `.local/development-dist` and
explicitly carries `deployable:false`.

| Development artifact | SHA-256 |
|---|---|
| `DEVELOPMENT_ONLY.json` | `00bd86dd9f03bb65c17b222908b67f47fe463ef20049c7f75999dc9e4700ee82` |
| `index.html` | `2ecc303bda43ce56efd6ca3d93056f0b90affd415db91440401a01afaa7e43e7` |
| app asset | `6c7227888d9ea3e963f5e16136c514eff8fcc586eb0e703dc569f4cdaa4f604e` |
| auth asset | `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` |
| stylesheet | `98bfa8dd2b0e5d1d9c4b14159565bb43ecb50d84b59a52ecbb6bd60cb8cbbe12` |

The previously committed `storyforge-v5/dist` bytes are historical candidate
bytes only. The release-source safety gate rejects them as a current B1-506
release. They must not be installed.

## 4. Safe offline implementation completed

### Product and browser

- Preserved canonical StoryForge typing, navigation, and V5 conformance with
  the voice flag off.
- Added native voice capture to Quick Capture without a competing information
  architecture.
- Implemented browser `MediaRecorder` capture, 4-second opener, 15-second
  steady segments, pause, resume, stop, elapsed time, interruption states,
  editable review, terminology corrections, retry affordances, and local
  recovery.
- Preserved typed text byte-for-byte while tracking voice-derived spans
  separately.
- Added deterministic overlap merging and ordered segment display.
- Added truthful permission-denial, network-recovery, provider-unavailable,
  upload-failure, and rollback states.
- Added mobile/narrow-width behavior and accessibility coverage.

### API, privacy, and storage boundaries

- Implemented E1-E6 session, segment, status, finish, cancel, and retry seams.
- Implemented bounded multipart parsing, size/duration/segment/daily caps,
  deterministic private object keys, compensating deletes, and
  transaction-locked state changes.
- Added cross-instance transcription claims and at-most-two in-flight provider
  calls per recording.
- Added private playback/denial behavior and exact-origin R2 signing/CSP seams.
- Preserved foreign-ID indistinguishability and content-free logging/audit
  payloads.
- Removed synthetic service impersonation and stopped cross-student queries
  without approved authority.

### Feature, release, and rollback controls

- Implemented `off`, `allowlist`, `cohort`, and separately locked
  `eligible_all` scopes.
- Made the environment kill switch win on every request.
- Kept production platform exposure forced off.
- Centralized M1 student-only safety validation across release build,
  WordPress route generation, Railway API build, integration, provenance, and
  production migration entrypoints.
- Guarded source commit/archive identity, migration hashes and ledgers,
  production target identity, backup receipt identity, and hidden Git index
  flags.
- Preserved deterministic seven-rung rollback mechanics in tests.

### Provider-off and offline bake-off foundation

- `STORYFORGE_TRANSCRIBE_PROVIDER=none` is the only accepted provider selection
  until Fable amends the authority.
- Provider-off mode stores new recording work without claiming or queueing it,
  does not consume retry budget, does not expire/requeue transcription claims,
  and reports `transcriptionAvailable:false`.
- Previously interrupted transcription work remains preserved for a later
  approved provider recovery.
- Added a deterministic provider-neutral bake-off scorer for 40 governed
  passages, six exact accent groups, human-only accent coverage, six
  specialties, medical-term occurrence tags, lab/number cases, three runs per
  passage, hash-pinned source/provenance artifacts, and bounded strict schemas.
- The scorer emits raw WER, medical, accent, latency, reliability, and cost
  metrics with `metricsUsableForActivation:false`; it does not call providers
  or invent a cutover verdict.

### Explicitly not invented

- no real transcription provider driver;
- no audio assembly implementation;
- no E7 voice attachment transaction;
- no E8/archive/background-lifecycle transaction;
- no unapproved global E11/E13 queries;
- no broad audit grants or substitute audit table writer;
- no fake transcription, audio success, AI assessment, rewriting, coaching, or
  mentor intelligence;
- no production deployment or activation.

## 5. Final verification — tests passed and failed

| Gate | Exact command | Result |
|---|---|---|
| Full unit suite | `npm test` | **128/128 PASS**, exit 0 |
| Focused release/cutover/build-security | `node --test tests/unit/b1-503-release-blockers.test.mjs tests/unit/build-security.test.mjs tests/unit/cutover-scripts.test.mjs tests/unit/release-provenance.test.mjs` | **18/18 PASS**, exit 0; subset of unit count |
| PostgreSQL 18 | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:postgres` | **138 PASS / 4 EXPECTED FABLE-BLOCKED FAIL**, exit 1 |
| Browser E2E | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:e2e` | **33 PASS / 1 EXPECTED AUDIT-BLOCKED FAIL**, exit 1 |
| Product conformance | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:conformance:development` | **72/72 PASS**, exit 0 |
| Development build | `npm run build:development` | PASS; isolated and explicitly nondeployable |
| Local full-stack launch | command in Section 6 | PASS; health 200, browser rendered |
| Integration entry | `STORYFORGE_EXPECTED_COMMIT=de1828ccb2c3672cc66b39e1ecbf46d1bfda5d1b STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:integration` | EXPECTED STOP on M1 before Docker or integration resources |
| Release build entry | `STORYFORGE_EXPECTED_COMMIT=de1828ccb2c3672cc66b39e1ecbf46d1bfda5d1b npm run build:release` | EXPECTED STOP on M1 before release writes |
| Railway API build entry | `STORYFORGE_EXPECTED_COMMIT=de1828ccb2c3672cc66b39e1ecbf46d1bfda5d1b npm run build:api` | EXPECTED STOP on M1 |
| Migration preflight entry | `bash scripts/apply-production-migrations.sh preflight` | EXPECTED STOP on M1 before environment validation or database reads |
| Secret scan | `npm run scan:secrets` | PASS, `{"ok":true,"scanned":"dist"}` |
| Dependency audit | `npm audit --audit-level=high` | PASS, 0 vulnerabilities |
| Whitespace | `git diff --check` and `git diff --cached --check` | PASS |
| Worktree | `git status --short --untracked-files=all` | clean before handoff creation |

### PostgreSQL expected-red detail

The 138 passes are:

- existing authorization matrix: 66/66 and
  `STORYFORGE_POSTGRES_SUITE_PASS`;
- B1-503 conformance matrix: 70/70 and
  `STORYFORGE_B1_503_CONFORMANCE_SUITE_PASS`;
- Phase 1 Node PostgreSQL cases: 2 pass.

The four failures are:

1. mentor self-owned recording denial;
2. admin self-owned recording denial;
3. student-to-mentor retained-access closure;
4. student-to-admin retained-access closure.

They are acceptance tests for the requested Fable M1 amendment, not unexpected
regressions.

### Browser expected-red detail

The failing case is:

`tests/e2e/voice-dock-states.spec.mjs:138`

The browser preserves text typed both before and during the take. Cancel then
fails closed because the production-equivalent database role cannot execute
the required append-only audit writer. The UI stays in review and displays the
generic failure rather than claiming that private recording objects were
deleted. Repository proofs:

- `storyforge-v5/public/app.js:2357-2405`;
- `storyforge-v5/server/db.mjs:76-102`;
- `storyforge-v5/tests/unit/recording-store-sideeffects.test.mjs:27-61`.

### Integration and release-stop detail

The exact stop for integration, release, API build, and migration preflight is:

```text
StoryForge Phase 1 release safety failed:
M1 contains an unrestricted live-identity policy predicate.
```

Integration stopped before its first Docker action. No Docker container,
volume, WordPress fixture, release output, production target read, or remote
request was created by that run.

## 6. Runnable local release candidate

Directly opening `storyforge-v5/public/index.html` is **not supported**. The
product requires the local StoryForge API, signed fixture identity, and
PostgreSQL.

Exact startup:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502/storyforge-v5
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin \
STORYFORGE_TRANSCRIBE_PROVIDER=none \
npm run dev:db
```

Canonical local URL:

`http://127.0.0.1:4180/`

Verified launch evidence:

- `GET /healthz` -> HTTP 200,
  `{"ok":true,"service":"storyforge-v5"}`;
- `GET /` -> HTTP 200, title `StoryForge V5 · MissionMed`;
- browser rendered the local identity gate and the complete Maya Student home
  workspace after identity selection;
- auth mode was `local-signed-fixture`;
- `audioAvailable:false`;
- the authenticated local student was eligible;
- `capabilities.voiceCapture:false` under default-off scope;
- no remote service or credential was used.

Provider-off behavior is truthful: no transcription work is claimed,
queued, retried, or recovered; API state reports transcription unavailable;
recording state remains preserved without fake text.

Shutdown was clean:

- zero listeners on ports 4180 and 55441;
- zero residual `/tmp/storyforge-v5.local.*` directories;
- clean Git status.

The local candidate is suitable for Founder/Fable inspection and continued
implementation. It is not a production artifact.

## 7. Blocker and authority-amendment register

Every blocker below records the exact contradiction or missing fact, authority,
repository evidence, smallest unblock, and the work that is already safe.

### FABLE-1 — Student-only M1 RLS

- **Contradiction:** the authority says recordings are student-only and
  mentors/admins have no content access, while its printed SQL calls
  `sf_has_live_identity()` without a role argument. The helper's default
  `NULL` role accepts every eligible matching role.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_DATABASE_RLS_MIGRATION_SPEC.md:78-91,165-170`.
- **Repository evidence:**
  `storyforge-v5/infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql:54-67`;
  `storyforge-v5/infra/postgres/migrations/20260727170000_b1_502_storyforge_submit_assignment_gate.sql:21-37`;
  four current PostgreSQL reds.
- **Smallest ruling:** approve exactly the four
  `sf_has_live_identity(ARRAY['student'])` predicate substitutions in
  `_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/B1-506A_FABLE_AMENDMENT_REQUEST.md:26-43`,
  and approve the amended M1 hash
  `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`.
- **Safe and complete now:** the red denial tests, current M1 checksum,
  unchanged rollback, release-source parser, and every release-entry stop are
  committed and verified. Nothing with unrestricted M1 can be released.

### FABLE-2 — Bounded audit-writer authority

- **Missing fact:** neither `authenticated` nor `storyforge_app` can execute
  `sf_append_audit`, yet recording transitions, deletion, denials, sweeps, and
  flag changes require in-transaction audit events.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:37`;
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:192-207`.
- **Repository evidence:**
  `storyforge-v5/server/db.mjs:76-102`;
  `storyforge-v5/server/flags.mjs:190-237`;
  `storyforge-v5/tests/unit/recording-store-sideeffects.test.mjs:27-92`;
  browser discard expected red.
- **Smallest ruling:** specify one exact bounded function/grant pattern,
  parameter set, transaction ownership, role grants, revokes, and tests for
  authenticated and service-path audit writes. Do not grant broad insert or
  direct cross-student read access.
- **Safe and complete now:** all audit payloads are content-free; mutations
  requiring audit prove audit authority first and roll back/fail closed when it
  is absent.

### FABLE-3 — E11 and E13 query/schema authority

- **Contradiction:** the observability authority queries `metadata`, but the
  actual audit table has no `metadata` column. The locked schema also has no
  recording `error_category` field and the service lacks an approved
  cross-student audit read.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_OBSERVABILITY_OPERATOR_RUNBOOK.md:18-25`;
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:174-215`.
- **Repository evidence:**
  `storyforge-v5/server/flags.mjs:160-188,240-289`;
  `storyforge-v5/tests/unit/flags-capability.test.mjs`;
  `storyforge-v5/tests/unit/phase1-routes.test.mjs:291-296`.
- **Smallest ruling:** print the exact bounded global E11 audit-tail SQL and E13
  last-24-hour error-category SQL, define the approved content-free source
  field(s), result schema, grants, limits, ordering, and unavailable/error
  behavior.
- **Safe and complete now:** caller-filtered or partial substitutes are
  forbidden; E11 and E13 return privacy-safe 503 responses until the injected
  approved queries exist.

### FABLE-4 — Private lifecycle and retirement transactions

- **Missing fact:** the authority requires draft-aware 24-hour sweeps,
  72-hour finishing cleanup, audio retirement, story archive propagation, and
  reconciliation, but does not provide an implementable bounded private query
  or atomic transaction under the observed grants.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md:37-45`;
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:170-207`.
- **Repository evidence:**
  `storyforge-v5/server/recordings.mjs:234-246,841-847,1427-1464`;
  `storyforge-v5/tests/unit/recording-store-sideeffects.test.mjs:94-117`.
- **Smallest ruling:** provide the exact draft/audio-aware candidate query,
  service grants, row-lock order, audit-before-object-delete behavior,
  archive/delete atomicity, failed-object compensation, and retry semantics.
- **Safe and complete now:** local/private segment retention, cancel/delete
  ordering tests, injected retirement boundary, and isolated sweep failure
  handling are complete; E8 and background sweeps return 503 instead of
  impersonating a student or querying private data without authority.

### FABLE-5 — Transcription provider contract

- **Contradiction:** the lock names `gpt-transcribe`, plural `languages`,
  separate `keywords`, and `gpt-live-transcribe`; current official contract
  evidence recorded different model identifiers and singular `language` plus
  `prompt`.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_TRANSCRIPTION_RUNTIME_AND_PROVIDER_LOCK.md:10-36`;
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:217-234`.
- **Repository evidence:**
  `storyforge-v5/server/config.mjs:79-117`;
  `storyforge-v5/server/transcription/adapter.mjs:78-226`;
  `storyforge-v5/scripts/transcription-bakeoff-lib.mjs`.
- **Smallest ruling/probe:** after an RP-7 model-list probe using the
  StoryForge-scoped key, approve exact current model identifiers, request
  fields, response fields, confidence semantics, scorer normalization and
  aggregation, and which candidate/baseline configurations enter the governed
  bake-off. No provider call should precede that ruling.
- **Safe and complete now:** provider-neutral orchestration, truthful
  provider-off mode, raw deterministic scorer, retry/failover taxonomy, medical
  lexicon, and privacy boundaries are complete. No unapproved provider driver
  exists.

### FABLE-6 — RP-8 assembly and E4/E7 finishing transaction

- **Missing fact/contradiction:** RP-8 did not select Option A or B. The
  authority also allows E7 to encounter a `finishing` session while requiring
  story creation, immutable original transcript, session attachment, and audio
  linkage in one transaction; a finishing session has no assembled asset to
  link.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md:24-35`;
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:236-251`.
- **Repository evidence:**
  `storyforge-v5/server/recordings.mjs:1322-1368`;
  `storyforge-v5/server/app.mjs:47-54,640-650`;
  `storyforge-v5/tests/unit/phase1-routes.test.mjs:279-289`.
- **Smallest probe/ruling:** supply a healthy local Docker/Nixpacks environment
  and run RP-8 exactly. Fable then confirms the one resulting option and the
  exact finishing-to-assembled-to-attached transaction protocol, including
  client retry and rollback behavior.
- **Safe and complete now:** E4 orchestration boundary, state models, API
  wiring, transcript review, and typing-only story save are complete. Voice
  finish/attach returns 503 before partial story or fake asset creation.

### FOUNDER-1 — FG-1 retention, consent, and deactivation wind-down

- **Missing decision:** final retention copy, delete control, consent notice,
  and deactivated-student/account-closure wind-down are not founder-ruled.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_PRODUCTION_DEPLOYMENT_ROLLBACK_RUNBOOK.md:3-5`;
  `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:66,69`.
- **Smallest Founder action:** select the printed FG-1 option and explicitly
  rule the deactivation wind-down/fallback. Do not ask engineering to infer it.
- **Safe and complete now:** the original default-safe copy path can support
  hidden and founder-only S10-S13 work; no student S14 activation occurs until
  the ruled copy, consent, and delete behavior are live.

### FOUNDER-2 — Two-account founder activation and signatures

- **Missing action:** S12a requires a pilot account that remains a student and
  a separate founder-controlled admin account; S13 requires Founder
  acceptance.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_PRODUCTION_DEPLOYMENT_ROLLBACK_RUNBOOK.md:22-24`;
  `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:63-66`.
- **Smallest Founder action:** confirm the two account holders, execute S12a
  via the admin account only after the execution card is green, complete the
  desktop/iPhone workflow, and sign S13.
- **Safe and complete now:** local identities and role-isolation tests exist;
  Codex has not created an account or changed an override/allowlist.

### FOUNDER-3 — Human corpus, roster, operations, and S14

- **Missing action:** the governed bake-off needs consented human recordings
  and hand-verified references; S14 needs a verified roster, Founder-executed
  access-policy additions/flag allowlist, support address, wake channel, and
  operational owner.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:45-47,62-67,75`.
- **Smallest Founder action:** name the corpus readers/verifier and private
  custody location, provide the scoped roster and operational contacts, then
  execute S14 only after the complete gate packet is green.
- **Safe and complete now:** the offline corpus contract and scorer are ready;
  synthetic audio is excluded from accent scoring; no human/private corpus was
  collected or stored by Codex.

### CREDENTIAL-1 — Cloudflare and private R2

- **Missing credential/fact:** Cloudflare authentication was unavailable;
  Worker-route/DNS state, bucket existence, public-access, CORS, lifecycle, and
  scoped token state are unverified. Current Railway names-only inventory did
  not include B1-506 R2 variables.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md:12-14`;
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md:10-22`.
- **Repository evidence:**
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:67-98`;
  `storyforge-v5/server/config.mjs:71-77`.
- **Smallest credential/probe:** provide authenticated read-only Cloudflare
  access for RP-4/RP-6. If resources are absent, later provide the separately
  authorized scoped write session for S5. Never put values in Git or evidence.
- **Safe and complete now:** storage adapter, exact-origin CSP, private keys,
  signer tests, and fail-closed `audioAvailable:false` behavior are complete.

### CREDENTIAL-2 — StoryForge-scoped provider key and contractual state

- **Missing credential/fact:** no `STORYFORGE_OPENAI_API_KEY` was installed or
  authorized for a model-list call. MissionMed's current ZDR/BAA/Healthcare
  Addendum state is not proven.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md:15,20`;
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_TRANSCRIPTION_RUNTIME_AND_PROVIDER_LOCK.md:38-40`.
- **Repository evidence:**
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:90-98,158-168`.
- **Smallest credential/probe:** authorize a non-logging RP-7 model-list probe
  using only the StoryForge-scoped key and provide current contractual-policy
  evidence. The hq key is never used for StoryForge transcription.
- **Safe and complete now:** provider-off mode and all offline scorer inputs,
  schemas, and privacy constraints are complete.

### CREDENTIAL-3 — Fresh production identity, backups, and deployment access

- **Missing current fact:** prior RP-3/RP-5/RP-10 evidence is a historical
  2026-07-29 snapshot, not authority to mutate or a substitute for immediate
  preflight. Fresh RP-3/4/5/6/7/10/12/13, S4 backups/restore, Railway, Kinsta,
  WordPress, and production PostgreSQL sessions are required.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_PRODUCTION_DEPLOYMENT_ROLLBACK_RUNBOOK.md:11-24`;
  `_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:53-66`.
- **Smallest credential/probe:** provide time-bounded, least-privilege
  read/preflight sessions; create fresh immutable recovery points and a
  PostgreSQL 18 dump with successful restore rehearsal; then separately grant
  the exact deployment sessions after every preflight is green.
- **Safe and complete now:** guarded preflight/build/install/migration scripts
  and evidence schemas are ready; no remote access was attempted under stale
  receipts.

### EXTERNAL-1 — Docker/Nixpacks RP-8 environment

- **Missing fact:** the required container probe failed because Docker reported
  hard-link I/O failures, `metadata_v2.db` I/O failure, and no space. No valid
  Option A/B result exists.
- **Authority:**
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md:24-35`.
- **Repository evidence:**
  `_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md:100-115`.
- **Smallest external action:** an authorized human/IT workflow restores a
  healthy Docker engine and sufficient capacity without this run pruning,
  resetting, or deleting Docker state. Codex then reruns only the binding local
  RP-8 container probe.
- **Safe and complete now:** host-only timings are retained as supplemental
  evidence but do not select an architecture. No destructive Docker action
  occurred.

### Scope note — B1-505 and S18+

The absent B1-505 final access artifacts block S18 and later cohort activation,
not the exact one-founder S12a path or the designated-student S14 scope governed
by B1-505C. S18+ remains outside B1-506 and is not reconstructed from local
fixtures. Authority:
`_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md:67,73`.

## 8. Concise Fable amendment packet

Fable can unblock the stopped code lanes with one bounded amendment that:

1. approves the exact four student-only M1 predicate substitutions and amended
   M1 hash;
2. prints exact bounded audit-writer function/grant/revoke SQL for authenticated
   and service transactions;
3. prints exact E11 audit-tail and E13 error-category queries, result schemas,
   grants, limits, and failure behavior against the observed audit schema;
4. prints the private draft/audio lifecycle candidate query, archive/delete
   transaction, lock order, compensation, and retry behavior;
5. reconciles current provider model identifiers and request/response fields,
   then confirms scorer normalization/aggregation and the exact RP-11
   configurations;
6. consumes the eventual RP-8 result and selects only Option A or Option B;
7. specifies the E4 finishing, assembly completion, E7 transactional attach,
   retry, and rollback sequence;
8. states which assertions/hashes must change and which current fail-closed
   tests remain acceptance gates.

No broader platform, AI, mentor, audio-provider, table, endpoint, or feature
scope is requested.

## 9. Founder action checklist — critical path

### To reach founder-only S12a

1. Route Section 8 plus
   `B1-506A_FABLE_AMENDMENT_REQUEST.md` to Fable and obtain a signed amendment.
2. Arrange non-destructive external repair of the Docker environment so RP-8
   can produce a binding Option A/B fact.
3. Provide time-bounded read-only Cloudflare, Railway, WordPress/Kinsta,
   PostgreSQL, and StoryForge-scoped provider access for fresh probes.
4. Confirm two separate Founder-controlled identities:
   - pilot identity remains `student`;
   - admin identity performs E11/E13 and scope changes.
5. Confirm the founder wake channel and the holder of the physical founder
   test devices.
6. After the amended local candidate is completely green, authorize fresh S4
   recovery points and preflights.
7. Allow Codex/operator to execute S7-S11 with the feature still off.
8. Personally execute the two-minute S12a allowlist activation from the admin
   account only after the one-line execution card is green.

### Additional actions before designated-student S14

9. Rule FG-1 retention, delete, consent, and deactivation wind-down.
10. Provide consented human corpus readers across the six fixed accent groups,
    the hand-verifying reviewer, and a private custody/deletion location.
11. Approve the exact roster; allow each never-logged-in student to establish
    identity while the feature is off.
12. Complete founder desktop Chrome and iPhone Safari acceptance and sign S13.
13. Name the daily health owner, support address, scheduled review time, and
    privacy-event response channel.
14. Personally perform any WordPress access-policy additions and S14 flag
    allowlist change, backup-first and audited.

No Founder action in this checklist authorizes S18+, cohort expansion,
production platform exposure, or student-facing AI.

## 10. Production preflight command cards

These are prepared commands, not authorization. Do not run a remote or
mutating card until its listed amendment, credential, backup, and Founder gate
is satisfied. Keep shell tracing off; never copy secrets, tokens, cookies,
signed URLs, transcripts, or audio into evidence.

### 10.1 Clean amended-source and local gates

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502

git status --short --branch
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
git diff --check

cd storyforge-v5
npm test
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:postgres
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:e2e
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin \
  npm run test:conformance:development
npm run scan:secrets
npm audit --audit-level=high

export STORYFORGE_EXPECTED_COMMIT="$(git -C .. rev-parse HEAD)"
npm run build:release
npm run build:api
```

Expected after the amendment: every command exits 0, PostgreSQL is 142/142,
browser E2E is 34/34, conformance is 72/72, release output is reproducible, and
Git remains clean.

The current integration script contains local Docker volume removal and must
not be run under the current no-destructive-Docker steer. After a healthy
isolated engine exists, either obtain explicit narrow authority for its
ephemeral compose project or use a Fable/Founder-approved non-destructive
equivalent. The currently prepared invocation is:

```bash
STORYFORGE_EXPECTED_COMMIT="$(git -C .. rev-parse HEAD)" \
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin \
npm run test:integration
```

### 10.2 Production migration preflight — read-only

Run only after Fable amends M1 and its three runner pins, the clean commit is
release-certified, RP-10/RP-13 are fresh, and S4 has produced a current
restorable backup receipt.

The operator loads values from the secure deployment session without printing
them:

```bash
set +x
umask 077

: "${STORYFORGE_RAILWAY_PROJECT_ID:?}"
: "${STORYFORGE_RAILWAY_ENVIRONMENT_ID:?}"
: "${STORYFORGE_RAILWAY_DATABASE_SERVICE_ID:?}"
: "${STORYFORGE_DB_BACKUP_ID:?}"
: "${STORYFORGE_DB_BACKUP_RECEIPT:?}"
: "${STORYFORGE_DB_BACKUP_RECEIPT_SHA256:?}"
: "${STORYFORGE_DEPLOY_GIT_COMMIT:?}"
: "${STORYFORGE_SOURCE_MODE:?}"
: "${STORYFORGE_APP_DB_PASSWORD:?}"
: "${STORYFORGE_EXPECTED_PGHOST:?}"
: "${STORYFORGE_EXPECTED_PGPORT:?}"
: "${STORYFORGE_EXPECTED_PGUSER:?}"
: "${STORYFORGE_EXPECTED_PGDATABASE:?}"
: "${STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER:?}"
: "${STORYFORGE_EXPECTED_USER_COUNT:?}"
: "${STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT:?}"
: "${STORYFORGE_FOUNDER_USER_ID:?}"
: "${RAILWAY_PROJECT_ID:?}"
: "${RAILWAY_ENVIRONMENT_ID:?}"
: "${RAILWAY_SERVICE_ID:?}"
: "${PGHOST:?}"
: "${PGPORT:?}"
: "${PGUSER:?}"
: "${PGPASSWORD:?}"
: "${PGDATABASE:?}"

export PATH="/opt/homebrew/opt/postgresql@18/bin:${PATH}"
export PGSSLMODE=require
bash scripts/apply-production-migrations.sh preflight
```

Expected sentinel:

```text
B1_506_PRODUCTION_MIGRATION_PREFLIGHT_PASS
```

Apply is a separate, explicitly authorized S7 mutation and is not part of
preflight:

```bash
export STORYFORGE_MIGRATION_CONFIRM=B1-506-APPLY-TWO-MIGRATIONS
bash scripts/apply-production-migrations.sh apply
```

Expected apply sentinel:

```text
B1_506_PRODUCTION_MIGRATIONS_APPLIED
```

### 10.3 Kinsta hidden-release and rollback preflights

These execute on the Kinsta host after `npm run build:release` and artifact
hash/size capture. Replace every angle-bracket placeholder from the signed
receipt; never guess it.

```bash
bash scripts/install-b1-503-kinsta-release.sh preflight \
  --remote-root '<ABSOLUTE_WORDPRESS_ROOT>' \
  --release-commit '<40_HEX_RELEASE_COMMIT>' \
  --route-source '<ABSOLUTE_PRIVATE_STAGING_ROUTE_PHP>' \
  --release-source '<ABSOLUTE_PRIVATE_STAGING_RELEASE_PHP>' \
  --route-sha256 '<64_HEX_ROUTE_SHA256>' \
  --route-size '<ROUTE_BYTES>' \
  --release-sha256 '<64_HEX_RELEASE_SHA256>' \
  --release-size '<RELEASE_BYTES>' \
  --release-id '<v-16_HEX_RELEASE_ID>' \
  --expected-owner '<USER:GROUP>' \
  --expected-current-target '<absent_OR_releases/40_HEX>' \
  --expected-route-sha256 '<absent_OR_64_HEX>' \
  --rollback-dir '<ABSOLUTE_PRIVATE_ROLLBACK_DIR>' \
  --wp-cli '<ABSOLUTE_WP_CLI>' \
  --php-cli '<ABSOLUTE_PHP_CLI>'
```

Rollback preflight:

```bash
bash scripts/rollback-b1-503-kinsta-release.sh preflight \
  --remote-root '<ABSOLUTE_WORDPRESS_ROOT>' \
  --receipt '<ABSOLUTE_PRIVATE_ROLLBACK_RECEIPT_TSV>' \
  --receipt-sha256 '<64_HEX_RECEIPT_SHA256>' \
  --wp-cli '<ABSOLUTE_WP_CLI>' \
  --php-cli '<ABSOLUTE_PHP_CLI>'
```

Install and rollback confirmation tokens are intentionally omitted here because
this is a preflight packet, not mutation authority.

### 10.4 External read-only probe cards

Use the exact RP definitions in
`B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md:11-21`. The current CLI/account selectors
must come from the authenticated provider session; this handoff does not invent
account IDs or command syntax.

Required current outputs:

- RP-3: authenticated production document/runtime hashes, Kinsta pointer,
  Railway deployment and image identity;
- RP-4: Cloudflare Worker routes and DNS filtered to `/storyforge*`;
- RP-5: Railway service identities and variable **names only**;
- RP-6: R2 bucket names, public-access setting, CORS, lifecycle, scoped-token
  posture;
- RP-7: StoryForge key name present and filtered model availability;
- RP-10: summary-only WordPress policy/plugin/embed state;
- RP-12: current official provider data-retention/ZDR/healthcare posture and
  MissionMed contractual state;
- RP-13: service role, grants, schema, migration ledger, production target
  identity, and pre-counts.

For the provider model-list probe, use a non-logging shell and write only a
filtered model-name result to the private evidence location:

```bash
set +x
umask 077
: "${STORYFORGE_OPENAI_API_KEY:?}"
: "${STORYFORGE_MODEL_IDS_CSV:?}"
: "${PRIVATE_EVIDENCE_DIR:?}"

node --input-type=module > "${PRIVATE_EVIDENCE_DIR}/rp7-model-names.json" <<'NODE'
const response = await fetch('https://api.openai.com/v1/models', {
  headers: { authorization: `Bearer ${process.env.STORYFORGE_OPENAI_API_KEY}` },
});
if (!response.ok) throw new Error(`Model-list probe failed with HTTP ${response.status}`);
const body = await response.json();
const available = new Set(Array.isArray(body.data)
  ? body.data.map(({ id }) => String(id))
  : []);
const requested = String(process.env.STORYFORGE_MODEL_IDS_CSV)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (requested.length === 0) throw new Error('No Fable-approved model IDs were supplied');
const result = Object.fromEntries(requested.map((id) => [id, available.has(id)]));
process.stdout.write(`${JSON.stringify({ models: result }, null, 2)}\n`);
NODE

shasum -a 256 "${PRIVATE_EVIDENCE_DIR}/rp7-model-names.json"
```

Do not store the key, request headers, full account response, or private
provider/account metadata in the repository.

## 11. Evidence template and step ledger

### Claim-level evidence template

Use one record per claim:

```markdown
# <STEP_OR_PROBE> — <CLAIM>

- Authority: `<document:section-or-lines>`
- Observation class: `LOCAL_CURRENT | PRODUCTION_READ_ONLY_CURRENT | MUTATION_RECEIPT`
- Captured at UTC: `<RFC3339>`
- Operator: `<name-or-role>`
- Source commit/archive: `<full SHA and archive SHA-256 if used>`
- Target identity: `<non-secret exact service/release/database identity>`
- Command/action: `<exact command or UI action; secrets redacted>`
- Exit/result: `<exit code, HTTP status, or provider result>`
- Expected: `<exact gate>`
- Observed: `<exact privacy-safe fact>`
- Raw capture: `<private or repository path>`
- Raw capture SHA-256: `<64 hex>`
- Redactions: `<what was removed and why>`
- Mutations: `NONE | <exact bounded mutation>`
- Outcome: `PASS | FAIL | BLOCKED`
- Rollback point: `<receipt identity or N/A>`
- Independent verifier: `<name/agent and UTC>`
- Next permitted action: `<one bounded action>`
```

A zero exit code is never the whole claim. No evidence may contain story text,
transcripts, audio bytes, patient/student names, credentials, tokens, cookies,
JWTs, signed URLs, or mentor notes.

### Required step evidence

| Step | Required current evidence and proceed condition |
|---|---|
| S3 | Completed B1-505 handoff/access receipt quoted exactly; absent blocks S18+, not S12a/S14. |
| S4 | New Kinsta recovery point; PostgreSQL 18 dump and successful restore rehearsal; Railway variable export; WordPress plugin and settings export; all identities/hashes pinned. |
| S5 | Fresh RP-5/6/7; private R2 posture; scoped credentials present; provider key present; secret scan green; no values in evidence. |
| S6 | Human-corpus bake-off record, raw hashes, three-run metrics, threshold table, and deterministic proceed/block outcome. Required before S14, not S7-S12a. |
| S7 | Migration preflight sentinel, fresh S4 receipt, exact clean source, apply sentinel, seven exact ledger rows, validation queries, post-counts, and rollback packet. |
| S8 | Railway deployment/image identity; `/healthz`; scope-off E1 and legacy upload denials; variables entered only here; no frontend exposure. |
| S9 | Unit, PostgreSQL, E2E/integration, platform-off contract, scan, audit, and log-content gates green against deployed dormant backend. |
| S10 | RP-4 and RP-10 current; immutable Kinsta release and sealed rollback receipt; pointer/route hashes; feature still off. |
| S11 | 72/72 flag-off conformance and screenshot matrix at 1440x900 and 390x844 with only approved deltas. |
| S12a | Founder executes founder-pilot UUID allowlist from the separate admin account; audit row captured; no Codex scope mutation. |
| S13 | Founder-pilot desktop Chrome and iPhone Safari A2-A22 results; privacy/auth failures kill immediately; Founder signature. |
| S14 | S13 signed; S15/P4X complete; S6 proceed; any configuration-delta retest complete; FG-1 live; Fable audit SQL confirmed; roster UUIDs verified; Founder performs access-policy/flag changes and releases invites. |
| S15 | Ineligible/foreign attach/object denials before S14; flag-scoped ownership denials rerun after allowlisting and before invites; record which denial path fired. |
| S16 | Desktop Safari and Android Chrome capture, interruption, and no-word-loss evidence. |
| S17 | Exact mic, app-switch/lock, network, provider-off, controlled R2 outage, reload, delete, and rollback drills; no operator improvisation. |
| S23 | Complete production receipt: source commit/archive, release IDs, Railway deployment/image, Kinsta pointer, migration rows, flag state, runtime hashes, evidence index, and mutation ledger. |
| S24 | Prior Kinsta/Railway builds retained, rollback scripts preflight green, reverse SQL filed, fresh backups restorable, and restore guard documented. |

Ordering corrections from B1-505C remain binding:

- S6 is required before S14, not before S7-S11 or founder-only S12a;
- S15 and S17 execute before S14;
- founder-scope S12a uses the separate admin account;
- the Founder, not Codex, performs S12a and S14 access/flag changes;
- S18+ is outside this run.

## 12. Shortest safe path to founder-scope activation

1. Fable issues the bounded amendment in Section 8.
2. External Docker health is restored without this run deleting or pruning
   Docker state; RP-8 produces the binding assembly fact.
3. Codex implements only the amended M1, audit, query, lifecycle, provider, and
   assembly/attach decisions.
4. Rerun all local gates to 142/142 PostgreSQL, 34/34 E2E, 72/72 conformance,
   128+ unit, green integration, reproducible release/API builds, clean scan,
   clean audit, and clean Git.
5. Recapture RP-3/4/5/6/7/10/12/13 with current least-privilege sessions.
6. Create fresh S4 recovery points and prove restore.
7. Execute S7 migrations with the feature off.
8. Execute S8 dormant backend and S9 deployed-backend verification.
9. Execute S10 hidden frontend and S11 flag-off conformance.
10. Founder uses the separate admin account to execute S12a for the founder
    pilot student only.

RP-11 human bake-off, FG-1, S13, S15/S17, and roster operations remain mandatory
before S14, but B1-505C explicitly permits truthfully labeled pre-bake-off
founder scope at S12a.

## 13. Time remaining after blockers clear

Assuming Fable supplies complete executable rulings, RP-8 supplies one valid
option, current credentials work, no live baseline drift exists, and fresh
backups pass:

- amendment implementation and local green reruns: **10-16 active engineering
  hours**;
- current remote probes, backup/restore, S7-S11 preflight/deployment/evidence:
  **8-12 active engineering hours**;
- estimated total to founder-only S12a: **18-28 active engineering hours**.

Additional active engineering for S13/S14 after human/provider inputs are ready:
**4-8 hours**, excluding Founder/device time, corpus recording/review time,
credential waiting, and observation windows.

This is an engineering-effort estimate, not elapsed calendar time. A new
authority contradiction, live drift, failed restore, provider threshold miss,
or privacy/auth defect reopens the applicable stop.

## 14. Exact changed-file inventory

Relative to
`origin/codex/b1-503-storyforge-product-recovery`, the eight B1-506 commits
through `de1828c` changed exactly 101 files. This handoff adds one file, for a
total B1-506 branch delta of 102 files before any later amendment.

### Authority, discovery, and handoff records

```text
_AI_HANDOFFS/from_codex/B1-505D_discovery/B1-505D_DISCOVERY_EVIDENCE.md
_AI_HANDOFFS/from_codex/B1-506/B1-506_COMPLETE_COMBINED_HANDOFF.md
_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/B1-506A_FABLE_AMENDMENT_REQUEST.md
_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/B1-506_COMBINED_HANDOFF.md
_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/B1-506_IMPLEMENTATION_EVIDENCE.md
_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/S1_BASELINE_LOCK_EVIDENCE.md
_AI_HANDOFFS/from_codex/B1-506_storyforge_v55_phase1/S2_BASELINE_SUITES_EVIDENCE.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_API_DATA_FEATURE_FLAG_CONTRACTS.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_CODEX_5.6_SOL_ULTRA_MEGARUN.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_COMBINED_HANDOFF.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_PHASE1_PRODUCTION_BLUEPRINT.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_PRODUCTION_ACCEPTANCE_ROLLOUT_ROLLBACK.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_PRODUCT_AUTHORITY_LOCK.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_R2_AUDIO_STORAGE_PRIVACY_LIFECYCLE.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/B1-504A_TRANSCRIPTION_PROVIDER_BAKEOFF.md
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/MANIFEST.sha256
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/storyforge-v5.5-prototype-r2.html
_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/storyforge-v5.5-prototype.html
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_CODEX_DISCOVERY_ONLY_PACKET.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_COMBINED_HANDOFF.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_DATABASE_RLS_MIGRATION_SPEC.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_EXECUTIVE_DECISION_AND_READINESS.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_FEATURE_FLAG_ROLLOUT_AUTHORITY.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_INFRASTRUCTURE_AUTHORITY_LOCK.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_OBSERVABILITY_OPERATOR_RUNBOOK.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_PRODUCTION_DEPLOYMENT_ROLLBACK_RUNBOOK.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_PRODUCT_CONFORMANCE_ACCEPTANCE_MATRIX.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_ROUTING_CDN_WORDPRESS_MATRIX_SPEC.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_STORYFORGE_PLATFORM_INTEGRATION_CONTRACT.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/B1-504B_TRANSCRIPTION_RUNTIME_AND_PROVIDER_LOCK.md
_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/MANIFEST.sha256
_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_CODEX_B1-506_COMBINED_RUN_KICKOFF.md
_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/B1-505C_DELIVERY_EXECUTION_PLAN.md
_AI_HANDOFFS/from_cowork/B1-505C_storyforge_v55_delivery_plan/MANIFEST.sha256
```

### Runtime, infrastructure, and generated candidate

```text
storyforge-v5/.env.example
storyforge-v5/dist/assets/app.9cf10e07fc9e.js
storyforge-v5/dist/assets/auth.d2cfc4e447d2.js
storyforge-v5/dist/assets/styles.98bfa8dd2b0e.css
storyforge-v5/dist/index.html
storyforge-v5/infra/edge/generated-asset-aliases.mjs
storyforge-v5/infra/edge/local-router.mjs
storyforge-v5/infra/edge/worker.mjs
storyforge-v5/infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql
storyforge-v5/infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions_rollback.sql
storyforge-v5/infra/postgres/migrations/20260729000200_b1_506_feature_flags.sql
storyforge-v5/infra/postgres/migrations/20260729000200_b1_506_feature_flags_rollback.sql
storyforge-v5/infra/wordpress/missionmed-storyforge-route.php
storyforge-v5/infra/wordpress/missionmed-storyforge-runtime/release.php
storyforge-v5/package.json
storyforge-v5/public/app.js
storyforge-v5/public/auth.js
storyforge-v5/public/styles.css
storyforge-v5/scripts/apply-production-migrations.sh
storyforge-v5/scripts/check-api-only-build.mjs
storyforge-v5/scripts/phase-one-release-safety.mjs
storyforge-v5/scripts/release-source.mjs
storyforge-v5/scripts/run-conformance.sh
storyforge-v5/scripts/run-e2e.sh
storyforge-v5/scripts/run-integration.sh
storyforge-v5/scripts/run-local.sh
storyforge-v5/scripts/run-postgres-tests.sh
storyforge-v5/scripts/score-transcription-bakeoff.mjs
storyforge-v5/scripts/transcription-bakeoff-lib.mjs
storyforge-v5/server/app.mjs
storyforge-v5/server/auth.mjs
storyforge-v5/server/config.mjs
storyforge-v5/server/db.mjs
storyforge-v5/server/flags.mjs
storyforge-v5/server/recordings.mjs
storyforge-v5/server/storage.mjs
storyforge-v5/server/transcription/adapter.mjs
storyforge-v5/server/transcription/keywords.mjs
storyforge-v5/server/transcription/lexicon.mjs
```

The three old generated asset paths were renamed and therefore are no longer
present:

```text
storyforge-v5/dist/assets/app.71f618e9afac.js
storyforge-v5/dist/assets/auth.960289f115f2.js
storyforge-v5/dist/assets/styles.41e546d34bfd.css
```

### Verification files

```text
storyforge-v5/tests/conformance/authority-contract.mjs
storyforge-v5/tests/conformance/helpers/harness.mjs
storyforge-v5/tests/e2e/storyforge.spec.mjs
storyforge-v5/tests/e2e/transcript-check.spec.mjs
storyforge-v5/tests/e2e/voice-dock-states.spec.mjs
storyforge-v5/tests/e2e/voice-fixture.mjs
storyforge-v5/tests/e2e/voice-hero.spec.mjs
storyforge-v5/tests/e2e/voice-rollback.spec.mjs
storyforge-v5/tests/postgres/flags-rls.test.mjs
storyforge-v5/tests/postgres/helpers/ephemeral-postgres.mjs
storyforge-v5/tests/postgres/recording-rls.test.mjs
storyforge-v5/tests/unit/b1-503-release-blockers.test.mjs
storyforge-v5/tests/unit/build-security.test.mjs
storyforge-v5/tests/unit/csp-audio-origin.test.mjs
storyforge-v5/tests/unit/cutover-scripts.test.mjs
storyforge-v5/tests/unit/flags-capability.test.mjs
storyforge-v5/tests/unit/phase1-routes.test.mjs
storyforge-v5/tests/unit/recording-store-sideeffects.test.mjs
storyforge-v5/tests/unit/recordings-orchestration.test.mjs
storyforge-v5/tests/unit/release-provenance.test.mjs
storyforge-v5/tests/unit/runtime-contracts.test.mjs
storyforge-v5/tests/unit/transcription-adapter.test.mjs
storyforge-v5/tests/unit/transcription-bakeoff.test.mjs
storyforge-v5/tests/unit/voice-local-retention.test.mjs
storyforge-v5/tests/unit/voice-overlap-merge.test.mjs
storyforge-v5/tests/unit/voice-segment-plan.test.mjs
storyforge-v5/tests/unit/voice-text-provenance.test.mjs
```

## 15. Mutation and custody statement

This run made only local repository commits, local disposable PostgreSQL test
clusters, local browser processes, and isolated development output. All local
processes and disposable clusters were shut down cleanly.

It did **not**:

- push a branch;
- open a pull request;
- deploy or change a Railway service;
- migrate or read a production database during the final gates;
- install or change a Kinsta/WordPress release;
- change WordPress access policy or feature scope;
- change Cloudflare, DNS, Worker routes, R2, or CDN configuration;
- create or rotate a credential;
- call a transcription provider;
- collect a human/private corpus;
- activate a Founder, student, mentor, admin, or cohort;
- prune, reset, delete, or otherwise destructively repair Docker.

Current safe containment remains:

- voice scope off;
- `STORYFORGE_VOICE_FORCE_OFF=1` available as environment kill;
- `STORYFORGE_TRANSCRIBE_PROVIDER=none`;
- production platform exposure off;
- release and migration entrypoints reject M1;
- prior production release remains untouched.
