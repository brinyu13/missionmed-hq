# B1-506A StoryForge V5.5 Phase 1 — Implementation Handoff

Recorded: 2026-07-29T13:13:43Z

Repository: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`

Branch: `codex/b1-503-storyforge-product-recovery`

Upstream: `origin/codex/b1-503-storyforge-product-recovery`

## Verdict

**READY FOR FABLE AMENDMENT AND PRODUCTION PREFLIGHT**

This is a **partial, local, non-release candidate**. It is release-buildable
locally, default-off, and fully tested for every implemented outcome, but it is
not eligible for migration apply, deployment, or activation.

Defined local implementation completion is **34 of 36 outcomes, 94.4%**.
All repository-resolvable work that did not require inventing UX or a rollback
control plane is complete. The two incomplete outcomes are:

1. the authority-required post-90-second E5 choice and cancel/E7 race; and
2. the weekly permanent-audio reconciliation scheduler with rung 6/7
   suspension.

Both require a narrow Fable ruling. They are preserved as blockers below.

## Repository and commit record

- Required starting HEAD, verified before edits:
  `411b7aeedced351cf15c1e25601a7714c119d1fa`
- Authority intake:
  `87b3772eddf71eeecc094e7e36273e1155c13d15`
  (`B1-506A: record bounded authority amendment`)
- Six-lane implementation:
  `b32a025c31a5d2fd64c36def8454d35d3abc9f83`
  (`B1-506A: implement bounded Phase 1 amendment`)
- Generated local release candidate:
  `b69b42ba5bd1970e0cd9f66bdcffced796856b08`
  (`B1-506A: regenerate local release candidate`)
- Fresh-review correction:
  `d836cbb4e4a24fe05199edf654282c6f413267a0`
  (`B1-506A: preserve existing service role grants`)
- The commit containing this handoff is intentionally reported by Git history
  and the supervising final report rather than self-referenced inside the file.

No commit was pushed. No pull request was opened.

## Authority and hash proof

| Artifact | SHA-256 | Result |
|---|---|---|
| Canonical StoryForge V5 parent | `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1` | exact |
| Canonical StoryForge V5.5 prototype | `0df61b561b2a6dfa3e132255381bef05028fd384597adfc8969929c646129c90` | exact |
| Conditional V5.5 r2 copy | `95104069500fdca8b92dbe81d5ce9ee7701a5f97400e1d1653414d19d4f13c0b` | exact |
| M1 before amendment | `b175549e4f2e1606badccdd194f25e42a11b3954f95b435e0b75ebfb52d2cc5f` | exact at starting HEAD |
| M1 after four approved substitutions | `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2` | exact |
| M1 rollback, unchanged | `669f6c2404222d07217dc6cd47c1eab57c52cdc70a6af20571a85ef347f5dca5` | exact |
| M2, unchanged | `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a` | exact |
| M3 forward | `e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323` | byte-matches governing SQL |
| M3 rollback | `1a4004fd5c5d7e14a6fe65745815a317a53bd6f4470b241da68451e397a05566` | byte-matches governing SQL |
| Effective-authority verifier | `01cb05e46882c2937a02182e22f11586782e8daac129e86e71fc222688dc3b1c` | exact |
| Effective-authority fingerprint | 244 rows / `3b412d5773c7f757da09d57d68f76e9d1d5b25705eeb09e6030b8044d265f1f6` | exact in PostgreSQL 18 |
| Immutable assembly-failure string | `669fc79d5bc8b51689f4112c9032d7d440c242b86a100119288f75b606577ff8` | exact |

The first five file rows in `MANIFEST.sha256` all verify. Lines 7 onward are
documentary `INPUT:` records, not paths for `shasum -c`. No B1-506A authority
document was edited after intake.

### Migration-runner hashes

- Pre-edit runner at required starting HEAD:
  `dd7ed32eeb498048f824a6625c42c428ab8de14368949920be751fffa610cd64`
- Initial six-lane runner before fresh-scope correction:
  `94a539c84ad829f1d9b20c029cf95dccfbb3b85da92e8793091498c3763f0b50`
- Final corrected runner:
  `4fa115c78f8feee976238a2b671c98393913acc01d101b506a11c84ffd9f2352`

The final runner does not revoke or recreate the existing
`authenticated -> storyforge_app` membership. It verifies the membership and
its least-privilege closure, preserving the amendment's rule that service
grants remain untouched.

## Six-lane completion ledger

| Lane | Complete | Total | Status |
|---|---:|---:|---|
| 1. M1 student-only RLS and pins | 3 | 3 | complete |
| 2. Bounded authenticated/service audit writers | 5 | 5 | complete |
| 3. Bounded E11/E13 admin reads | 2 | 2 | complete |
| 4. Lifecycle, privacy, and reconciliation | 7 | 8 | weekly scheduler/suspension blocked |
| 5. Inert OpenAI provider pair | 5 | 5 | complete; no provider call |
| 6. E4/E7, durable audio, playback, executors | 12 | 13 | post-90-second E5 choice/race blocked |
| **Total** | **34** | **36** | **94.4%** |

The explicit RP-8 requirement that neither assembly executor be wired before
the container probe is not counted as incomplete implementation. Both
executors exist behind the injected boundary; wiring remains an expected
external gate.

## Implemented outcomes

### Lane 1 — M1

- Applied exactly four student-role predicate substitutions.
- Updated the three required M1 hash pins.
- Mentor/admin self-row and student-to-mentor/admin closure tests are green.
- M1 rollback and M2 remain byte-identical to their authorized inputs.

### Lane 2 — audit writers

- Added the exact M3 forward and rollback SQL.
- Added disjoint authenticated and service audit functions without table-wide
  insert or read authority.
- Routed identity transactions and service transactions to their respective
  writers.
- Kept mutation audits fail-closed and the ruled denial-bookkeeping exception.
- Preserved content-free payload vocabulary and append-only history.

### Lane 3 — E11/E13

- Wired bounded admin feature-audit tail and 24-hour voice-error summary calls
  through the already-open identity transaction.
- Preserved 503 behavior when the approved functions are absent or fail.

### Lane 4 — lifecycle

- Implemented candidate selection, locked revalidation, transcript/segment
  purge, full temporary-prefix deletion, and content-free lifecycle audits.
- Made cancel and E8 retirement database-commit-first, with storage deletion
  and one immediate retry after commit.
- Implemented pending-asset recovery/finalization and terminal failure.
- Implemented the bounded `sf_voice_audio_reference_check` store/service seam.
- Proved archive propagation is a structural no-op and attached audio is
  retained.
- Did not invent the missing weekly scheduler or rollback-suspension state.

### Lane 5 — providers

- Added inert `gpt-4o-transcribe` and `whisper-1` drivers with the exact
  multipart fields, fixed models, prompt composition, confidence behavior,
  bounded error mapping, and response privacy.
- Added the `openai` adapter branch and exact `none|openai` validation.
- Production behavior remains `none`; no key was installed and no provider was
  called.

### Lane 6 — E4/E7 and durable audio

- Implemented option-independent finish/assembly state transitions.
- Implemented E7 pre-read idempotency, 409 pending response, one-transaction
  story creation plus attach, and concurrent-race re-read.
- Implemented post-commit Option A/Option B copy plans, HEAD verification,
  checksum/byte accounting, finalization, temp purge, and truthful unavailable
  playback states.
- Implemented legacy full-key and new stem/segment playback-key rules.
- Added both assembly executors behind an unwired injected boundary.
- Added the exact immutable safe-text assembly-failure message.
- Implemented 2-second E7 retry polling through 90 seconds without silent data
  loss.
- Did not invent the absent confirmation interaction required after 90 seconds.

## Two remaining Fable blockers

### FABLE-1 — post-90-second E5 choice and race

- Controlling authority:
  `B1-506A_EXECUTABLE_SQL_AND_CONTRACTS.md:757`.
- Required behavior: after 90 seconds, offer “keep waiting” or save typed-only
  through an **existing E5 discard confirm**; if cancel is refused with
  `state_conflict`, retry E7 once and save with audio.
- Repository evidence:
  `public/app.js:2358` has an immediate `voiceDiscard()` with no confirmation;
  `public/app.js:2584` preserves the draft/session and returns
  `voice_assembly_pending` because the referenced confirm does not exist.
- Smallest required ruling: identify or authorize the exact confirmation
  interaction and copy, plus the typed-only save transition that may call E5.
- Safe and complete without it: all polling up to 90 seconds, successful E7,
  server race handling, draft/session preservation, normal discard, and the
  immutable assembly-failure path.

### FABLE-2 — weekly permanent-audio reconciliation and restore suspension

- Controlling authority:
  `B1-504B_R2_AUDIO_STORAGE_LIFECYCLE_SPEC.md:42`,
  `B1-506A_CODEX_IMPLEMENTATION_PROMPT.md:19`, and
  `B1-506A_FABLE_AUTHORITY_AMENDMENT.md:47`.
- Required behavior: weekly list/reference/delete of unreferenced
  `storyforge-audio/` objects older than seven days, suspended after any
  rollback rung 6/7 event pending Founder review.
- Repository evidence:
  `server/recordings.mjs:1898` maintenance runs session, pending-asset, and
  transcription recovery only; `server/recordings.mjs:2127` exposes the
  reference-check seam but no caller, scheduler, or suspension signal exists.
- Smallest required ruling: define the durable source, owner, and clear
  semantics for the rung 6/7 suspension signal, and identify the authorized
  weekly scheduler/execution principal without adding an unruled table.
- Safe and complete without it: transient `storyforge-rec/` seven-day expiry,
  immediate cancel/sweep cleanup, E8 retirement, one retry, pending-asset
  recovery, and bounded reference checks. Permanent-audio reconciliation is not
  claimed.

## Verification receipts

| Gate | Result | Exact receipt |
|---|---|---|
| Unit | PASS | 160/160 |
| PostgreSQL 18.4 | PASS | 149/149: 67 authorization SQL + 71 B1-503 SQL + 11 Node/TAP |
| Production SQL-stream transaction | PASS | 2/2, included in the 11 Node/TAP |
| Browser E2E | PASS | 38/38 |
| Canonical conformance | PASS | exactly 72/72 |
| Release build | PASS | clean committed source `d836cbb4...` |
| API-only build | PASS | self-contained; no canonical product build invoked |
| Secret scan | PASS | clean `dist` |
| npm audit | PASS | 0 vulnerabilities |
| `git diff --check` | PASS | no whitespace errors |
| Migration preflight entry | EXPECTED STOP | missing external `STORYFORGE_RAILWAY_PROJECT_ID`, after local source gate |
| Integration entry | NOT RUN | script performs destructive `docker compose down -v`; prohibited by the steer |
| Provider call | NOT RUN | prohibited; drivers remain inert |

The exact PostgreSQL stream proved:

- all eight ledger rows committed atomically;
- the application login is SCRAM and least privilege;
- the 244-row effective-authority fingerprint is exact;
- literal M3 rollback/reapply retains append-only audit history; and
- injected authenticated privilege drift aborts and rolls back to the five-row
  baseline.

## Local release-candidate receipt

- Release ID: `v-7b18dd964cdd8f2c`
- Release artifact eligible: `true`
- Deployable: `false`
- Deployment authorized: `false`
- Source `public/app.js`:
  `db60b4912bb7e6562c645dc7318be7bd9474a58f2ae28e5c524666531f29a69b`
- Generated app asset:
  `e83cf02a1594c67dc0ecb37f8ccf2d4e4189232656abe938d18cf33d443c754f`
- Generated `dist/index.html`:
  `dfbefb5c813c4505aabddd22c90e1ed8b998c680cd181863cad772d4d161bb27`
- Generated WordPress `release.php`:
  `7302f64cffab2cb6bf6ced9d40160224cc8fb0b09a0549d2a692dd56bea064b9`
- Generated WordPress route:
  `7b00c123f06ff4ed7975c7152d6683fc5b50e3b42aa42704a4b72f217eea52bd`

This receipt proves deterministic local buildability only. It grants no
production or migration authority.

## Remaining external gates — verbatim

- FOUNDER: FG-1 retention/consent/wind-down ruling (blocks the ruled copy and S14, not implementation); two-account confirmation and the S12a activation; corpus readers, verifier, custody (blocks the bake-off); roster and operations items; S13 signature; any WordPress access-policy or flag change.
- CREDENTIALS: Cloudflare read-only session (RP-4/RP-6) then the separately authorized R2 provisioning (S5); StoryForge-scoped OpenAI key plus the RP-7 model probe (`gpt-4o-transcribe,whisper-1`) and the MissionMed ZDR/BAA contractual evidence (before S14); fresh time-bounded Railway/Kinsta/WordPress/PostgreSQL sessions and new S4 backups with restore rehearsal (before S7).
- DOCKER/RP-8: a healthy container engine restored by an authorized human workflow (no destructive repair by any run), then the binding Nixpacks probe selects Option A or Option B per the R2 spec table; the selected executor is then WIRED (mechanical).
- PRODUCTION PREFLIGHT: fresh RP-3/4/5/6/7/10/12/13, then S7 to S11 per the runbook, then S12a; the bake-off decision record plus FG-1 copy plus S13/S15/P4X gate S14 exactly as B1-505C bound them.

## Resolved findings and unexpected command failures

No unexpected product or test failure remains.

1. A fresh reviewer found that the runner normalized an existing service-role
   membership despite the “grants untouched” ruling. Commit `d836cbb4...`
   removed that mutation; strict membership verification and both focused
   transaction tests remain green.
2. A first release command earlier in the run used an incorrectly copied full
   implementation hash. The provenance gate rejected it. The exact HEAD was
   used on rerun.
3. Regenerating the candidate after the implementation commit changed tracked
   release artifacts; the terminal clean-source check correctly rejected an
   uncommitted state. The generated files were committed in `b69b42ba...`, and
   a clean rerun passed.
4. A naive whole-file `shasum -c MANIFEST.sha256` treated documentary `INPUT:`
   records as filenames. Verification was corrected to the first five actual
   authority file rows; all matched.
5. Two final browser-suite launch attempts initially selected Homebrew
   PostgreSQL 16.13 and stopped before testing. They were rerun with
   `/opt/homebrew/opt/postgresql@18/bin`; E2E passed 38/38 and conformance passed
   72/72.
6. The final release command initially omitted the mandatory explicit
   `STORYFORGE_EXPECTED_COMMIT`; it failed closed and then passed with exact
   `d836cbb4e4a24fe05199edf654282c6f413267a0`.

## Exact next action and time

Shortest path to Founder-scope activation:

1. Fable issues two narrow rulings for FABLE-1 and FABLE-2.
2. Codex implements only those rulings and reruns the same offline gates
   (estimated 2–4 active engineering hours).
3. An authorized human restores a healthy Docker engine; RP-8 selects one
   executor and Codex wires it mechanically.
4. Founder and credential owners clear the verbatim external gates.
5. Run fresh probes/backups and S7–S11, then Founder executes S12a
   (estimated 8–12 active engineering hours after credentials are available).

Estimated remaining active engineering after both authority rulings and all
external prerequisites are available: **10–16 hours total**, including the
two narrow code closures and the production preflight/deployment sequence.
Founder, credential, corpus, observation, and human Docker-recovery wait time is
excluded.

## Mutation statement

This run changed only local repository source, tests, generated local candidate
artifacts, authority intake copies, and handoff evidence. It did **not**:

- deploy;
- call a transcription provider;
- push;
- open a pull request;
- change any remote or production system;
- repair or destructively modify Docker;
- create credentials, buckets, routes, flags, cohorts, or allowlists;
- edit protected Matrix runtime assets; or
- edit the B1-506A Fable authority documents after intake.

The feature remains default-off. Nothing in this handoff authorizes migration
apply, deployment, or user activation.
