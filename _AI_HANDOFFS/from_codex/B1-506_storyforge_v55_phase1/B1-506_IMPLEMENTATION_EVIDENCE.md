# B1-506 StoryForge V5.5 Phase 1 — Local Implementation Evidence

Recorded: 2026-07-29T06:09:37Z
Repository: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
Branch: `codex/b1-503-storyforge-product-recovery`
Implementation baseline: `6e630df672e47e50ae5e14592c8455979e2b1dac`
Initial local candidate commit: `a8a6d7b505af5d9205c40b15abcc1850b72dd2dd`
Stopped-lane evidence commit: `10ccf94e0236044ff001eea30954c8c034349aa9`
Release-stop commit: `78ccf096f00e76b8e64fc387d9042914c4a8a9b6`
Safety-parser hardening commit: `5305fdd9a9517de9843769510adeaa61cda5eb1e`
Production mutation: **NONE**

## Outcome

A default-off local Phase 1 candidate now implements the native StoryForge voice
capture experience, server boundaries, private object-storage seam, feature
controls, tests, and guarded release mechanics.

This candidate is **NOT READY FOR DEPLOYMENT OR ACTIVATION**. PostgreSQL 18
proves a critical contradiction inside the locked M1 database authority: the
prose and SQL comment require student-only access, but the exact SQL policies
admit any live eligible role that owns its own row. Four mentor/admin acceptance
regressions are now present and intentionally red. The database lane is stopped
pending the narrow Fable amendment in
`B1-506A_FABLE_AMENDMENT_REQUEST.md`.

Every binding release entrypoint now rejects the unchanged M1 before it can
write release output or read a production target: the package release assertion,
direct static builder, WordPress manifest builder, terminal provenance checker,
Railway API-only build, and migration runner all exit nonzero. The runner also
rejects hidden Git index flags and verifies every migration source byte against
the named commit or archive.

The feature remains off by default. No deployment, push, pull request, database
write, Cloudflare change, remote WordPress change, Railway change, R2 mutation,
credential mutation, or student activation occurred. Disposable PostgreSQL test
writes and committed local generated WordPress-source artifacts are not remote
or protected-system mutations.

## Implemented locally

### Product and browser

- Existing V5 typing and navigation remain canonical when the voice flag is off.
- Voice capture is native to Quick Capture rather than a competing workflow.
- Real `MediaRecorder` capture uses the bound 4-second opener and 15-second
  steady segments.
- Recording, pause, resume, stop, elapsed time, near-live segment status,
  editable review, retry, discard, and draft recovery states are present.
- Typed and voice-derived text provenance is tracked separately so discarding a
  take does not destroy text typed before or during recording.
- Local private segment buffers carry timestamps and expire at the seven-day
  backstop.
- The reviewed transcript feeds the existing StoryForge draft/save workflow;
  E7 attachment remains fail-closed until assembly authority is resolved.

### Backend and storage

- E1-E6 recording session, segment, status, finish, cancel, and retry seams are
  mounted.
- Segment writes use deterministic private keys and compensate ambiguous storage
  failures while the session transaction still owns its row lock.
- Cross-instance transcription claims accept only `received` or
  `transcribe_failed`, preventing duplicate provider submissions.
- The provider-neutral adapter supports bounded retry, session-scoped failover,
  medical lexicon flags, content-free events, and truthful unavailable behavior.
- R2 presigning uses path-style URLs so the signed URL origin is exactly the CSP
  origin.
- Playback and foreign/missing playback denial use content-free structured
  events and append-only audit attempts.
- Synthetic background student identities and nested role switching were
  removed. Background sweeps, assembled-object cleanup, and private draft-title
  reads fail closed until a bounded authority-approved lifecycle query exists.

### Feature and release controls

- `voice_capture` supports only `off`, `allowlist`, `cohort`, and
  `eligible_all`; `eligible_all` remains separately locked.
- Environment kill is evaluated on each request and wins over database scope.
- M2 seed identity is injected from a required, validated founder UUID; no
  “earliest user” substitution remains.
- Migration source, ledger hashes, production identities, backup identity, and
  exact two-migration prestate are guarded.
- M1 source safety is synchronous and centralized across every binding build
  path. It rejects unrestricted identity helpers, OR-broadened predicates,
  missing/extra/altered recording policies, malformed policy roles, and missing
  student-only checks.
- Serving layers derive `connect-src` and `media-src` from one exact,
  credential-free R2 endpoint.
- E11 global audit history and E13 error-category health summaries return 503
  rather than partial or unauthorized data until approved query authority
  exists.

## Source and generated-candidate hashes

| Artifact | SHA-256 |
|---|---|
| Canonical StoryForge V5 HTML | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` |
| M1 recording migration | `b175549e4f2e1606badccdd194f25e42a11b3954f95b435e0b75ebfb52d2cc5f` |
| M2 feature migration | `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a` |
| `public/app.js` | `e14303e7a51eca5dc554e076cd0190f3de8c1aff8a3ee57464a21218ca7c3549` |
| `public/styles.css` | `c5c693eb6530d2559ab1c9ba8dbb3f9a42692edefec184c36c5cf9bb5b7d7b04` |
| `server/recordings.mjs` | `4f420c82c1aaaae5ce09e3238a3af1e0d76048c5727f96f3926e8facb1366da2` |
| `server/flags.mjs` | `bd3013ab06886402511fad9c0c823ab792f6b6c67b2722fb7e0cf342ae960b0a` |
| `server/storage.mjs` | `a8cb02967c68d53c8c216816a1e1d85278e4d1dcec753e5adee6ee2f5805f359` |
| `server/transcription/adapter.mjs` | `568e890d676490351a822c895df14c8f37ce0b8a362fd24798e010b258c8a732` |
| Generated `dist/index.html` | `ac1f3a4f39d174f5de30c2e1d9277d8fee44e9780e90f83c71a78f96c0216bdb` |
| Generated app asset | `9cf10e07fc9ec1f22c70a7c848eec2dff50a1f32289184651a275090b5a6d150` |
| Generated auth asset | `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` |
| Generated stylesheet | `98bfa8dd2b0e5d1d9c4b14159565bb43ecb50d84b59a52ecbb6bd60cb8cbbe12` |
| Generated WordPress `release.php` | `44ef76cf5bd23a5fe447e47574ef75bd6f94d277a432385c614b65a01519b30e` |
| Generated WordPress route | `e2bc940667ffc4d50cc4da1f3dcffaf80440f4842c7fc4d2e67f0f84bb3ea0c7` |

The generated local candidate identifies as `v-2f3ce82ab6c52b4d`. These bytes
are committed local candidate artifacts, not a deployable receipt: the M1 gate
intentionally prevents release certification.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Canonical authority | PASS | Exact V5 SHA above |
| Unit suite | PASS | 114/114 after release-stop integration |
| Focused release/cutover/build-security | PASS | 13/13 after parser hardening |
| PostgreSQL 18.4 | **FAIL / EXPECTED RED** | Existing baseline and B1-503 suites pass; Phase 1 is 2/6 because four new role regressions expose unchanged M1 |
| Flag-off product conformance | PRIOR CANDIDATE PASS | 72/72 across desktop, tablet, mobile, keyboard, shell, and axe gates; product source unchanged since that receipt |
| Browser E2E | PRIOR CANDIDATE PARTIAL | 33/34; discard fails closed because `sf_append_audit` execution authority is absent |
| Release-source and direct release builders | **STOP** | clean committed source exits 1 on unrestricted M1 before release output writes |
| API-only provider build | **STOP** | clean committed source exits 1 on unrestricted M1 |
| Production migration preflight/apply | **STOP** | exits 1 on M1 before required environment checks or database target reads |
| Secret scan | PASS | clean |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities |
| R2 signer/CSP parity | PASS | real AWS presigner unit coverage |
| `git diff --check` | PASS | no whitespace errors |
| Remote/production mutation | PASS | none occurred |

The prior green two-test Phase 1 receipt proved student-owner isolation only.
The current six-test set adds mentor/admin self-row and student-to-mentor/admin
role-change cases. Those four cases fail against unchanged M1 and therefore
control the current database verdict.

## Critical stopped lane: M1 role contradiction

Authority prose says:

- “students only; mentors and admins have NO policy on recordings”
- “Mentors: zero visibility”
- “Admin: flag tables only; no content tables”

The exact M1 SQL at
`infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql:55`
and `:60` calls `sf_has_live_identity()` without a student-role argument.
`sf_has_live_identity()` accepts any live eligible identity when its role list
is omitted.

Disposable PostgreSQL 18.4 probes against the exact migration proved:

- eligible mentor self-owned session insert/read: **ALLOWED**;
- eligible mentor self-owned segment insert/read: **ALLOWED**;
- eligible admin self-owned session insert/read: **ALLOWED**;
- a student changed to mentor retains access to the pre-save recording:
  **ALLOWED**.

This violates the higher-level rule while matching the printed SQL. Per the
kickoff, Codex may not resolve that contradiction as an architectural choice.
The mentor/admin self-row and role-change acceptance regressions are now present
and failing. Fable must authorize the exact four-predicate student-only
correction and resulting M1 hash before the migration or runner pins may change.

## Other stopped lanes and required authority/external inputs

1. **Audit writer:** neither `authenticated` nor `storyforge_app` can directly
   execute `sf_append_audit`. Audit-dependent recording/flag mutations,
   including discard, correctly roll back.
2. **Transcription runtime:** provider/model/request authority conflicts with
   current provider contracts. The neutral adapter exists; no unapproved real
   driver or credential call was added.
3. **Assembly and E7:** RP-8 did not select an implementable assembly path.
   Story save with voice remains 503-blocked.
4. **Retention and retirement:** FG-1 and the approved atomic archive/delete
   lifecycle transaction are absent. E8/archive and background sweeps remain
   fail-closed.
5. **Private cross-row queries:** approved bounded queries/grants are absent for
   E11 global feature history, E13 error categories, and draft/audio-aware
   cleanup.
6. **R2 and routing:** production bucket privacy, CORS, lifecycle, credentials,
   Railway variables, and the non-secret WordPress
   `MISSIONMED_STORYFORGE_R2_ENDPOINT` value are not verified or installed.
7. **Release chain:** fresh backups/restore rehearsal, S7-S14 evidence,
   bake-off, denied-identity production probes, failure drills, founder device
   acceptance, and student activation are outstanding.
8. **Integration environment:** the committed-clean-source integration gate was
   not rerun because the synchronous M1 safety gate rejects the source before
   integration may start. A prior attempt also encountered local Docker
   storage/VM failure. No destructive Docker cleanup was attempted.
9. **Privileged Kinsta installer:** the binding S10 sequence requires
   `npm run build:release` before the existing B1-503 pointer installer, so the
   authorized sequence is stopped. The generic installer can still be invoked
   manually with operator-supplied artifacts and is not itself a release
   authorizer. Do not use it for B1-506 until the build gate passes; if Fable
   requires cryptographic receipt binding at the host boundary, that requires a
   separate trust-anchor amendment rather than a forgeable local marker.

## Next authorized action

Return `B1-506A_FABLE_AMENDMENT_REQUEST.md` and this stopped-lane evidence to
Fable. After the narrow amendment is issued, preserve the existing red
regressions, update only M1 and its three runner pins, rerun every local gate,
and then address the remaining audit/lifecycle/provider/assembly inputs before
the guarded S7-S14 chain can resume.
