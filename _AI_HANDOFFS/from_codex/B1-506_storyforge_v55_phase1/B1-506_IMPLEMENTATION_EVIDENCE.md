# B1-506 StoryForge V5.5 Phase 1 — Local Implementation Evidence

Recorded: 2026-07-29T05:37:14Z
Repository: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
Branch: `codex/b1-503-storyforge-product-recovery`
Implementation baseline: `6e630df672e47e50ae5e14592c8455979e2b1dac`
Local candidate commit: `a8a6d7b505af5d9205c40b15abcc1850b72dd2dd`
Production mutation: **NONE**

## Outcome

A default-off local Phase 1 candidate now implements the native StoryForge voice
capture experience, server boundaries, private object-storage seam, feature
controls, tests, and guarded release mechanics.

This candidate is **NOT READY FOR DEPLOYMENT OR ACTIVATION**. A direct
PostgreSQL 18 proof found a critical contradiction inside the locked M1 database
authority: the prose and SQL comment require student-only access, but the exact
SQL policies admit any live eligible role that owns its own row. The database
lane is stopped pending a narrow Fable authority amendment. Other named
authority and external gates also remain.

The feature remains off by default. No deployment, push, pull request, database
write, Cloudflare change, WordPress change, Railway change, R2 mutation,
credential mutation, or student activation occurred.

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
- Serving layers derive `connect-src` and `media-src` from one exact,
  credential-free R2 endpoint.
- E11 global audit history and E13 error-category health summaries return 503
  rather than partial or unauthorized data until approved query authority
  exists.

## Source hashes

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

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Canonical authority | PASS | Exact V5 SHA above |
| Unit suite | PASS | 112/112 |
| PostgreSQL parity | PASS | PostgreSQL 18.4; baseline, B1-503, and Phase 1 suites; Phase 1 2/2 |
| Flag-off product conformance | PASS | 72/72 across desktop, tablet, mobile, keyboard, shell, and axe gates |
| Browser E2E | PARTIAL / EXPECTED STOP | 33/34; discard fails closed because `sf_append_audit` execution authority is absent |
| API-only provider build | PASS | self-contained; nondeployable local validation |
| Secret scan | PASS | clean |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities |
| R2 signer/CSP parity | PASS | real AWS presigner unit coverage |
| `git diff --check` | PASS | no whitespace errors |
| Remote/production mutation | PASS | none occurred |

The green Phase 1 PostgreSQL suite proves owner isolation between two students,
but it did not contain mentor/admin self-row or role-change cases. The fresh
security probe below is therefore the controlling result.

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
Required amendment: approve an explicit student-only predicate for both session
and segment policies (for example the house helper with a student-only role
list), issue the amended M1 hash/runner pins, and require mentor/admin self-row
plus role-change PostgreSQL regressions.

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
   not rerun on this uncommitted snapshot; the prior attempt also encountered
   local Docker storage/VM failure. No destructive Docker cleanup was attempted.

## Next authorized action

Return the exact stopped-lane evidence to Fable. After a narrow amendment is
issued, update M1 and the audit/lifecycle query authority, add the missing
PostgreSQL regressions, rerun all local gates, create a clean committed release
candidate, and only then resume the guarded S7-S14 chain.
