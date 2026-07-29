# B1-506B StoryForge V5.5 — Final Two Binding Fable Rulings

**READY FOR SPECIFICATION EXPANSION**

Recorded: 2026-07-29T14:15:03Z

Controlling evidence: `B1506A_COMPLETE_COMBINED_HANDOFF.md` and
`B1506A_IMPLEMENTATION_HANDOFF.md` (both recorded 2026-07-29T13:13:43Z),
plus direct read of the repository at
`/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` on branch
`codex/b1-503-storyforge-product-recovery` (worktree state as staged
2026-07-29): `storyforge-v5/public/app.js`, `storyforge-v5/server/recordings.mjs`,
`storyforge-v5/server/storage.mjs`, `storyforge-v5/server/config.mjs`, and
`storyforge-v5/infra/postgres/migrations/20260729010000_b1_506a_voice_audit_lifecycle.sql`.

Scope of this document: exactly two binding decisions resolving blockers
FABLE-1 and FABLE-2. It does not redesign StoryForge, expand scope, restate
settled authority, alter M1/M2/M3 bytes, add audit vocabulary, or authorize any
deployment, migration apply, provider call, executor wiring, or activation.
All B1-506A external gates remain exactly as recorded.

Interpretation precedence within this document: where any sentence here could
be read two ways, the reading that (a) preserves student text, (b) preserves a
stored object, and (c) declines to claim audio success is binding.

Both rulings are closed. No Founder decision is required to expand either
ruling into specification and implementation. The two Founder items listed
under Decision 2 §6 are operational gates on *enablement*, not on
specification or code.

---

## DECISION 1 — Post-90-second audio assembly (resolves FABLE-1)

### 1. Binding ruling

The authority's reference to an "existing E5 discard confirm flow" is ruled to
mean the **server E5 cancel endpoint** (`cancelRecording`, already implemented
and idempotent), not the client-side `voiceDiscard()` routine. No existing
client confirm satisfies the contract; a single new client confirmation dialog
is hereby authorized and fully specified below. It is the only new UI surface
authorized by this ruling.

When `saveRecordedStoryWhenAssembled` reaches its 90-second deadline
(`public/app.js:2584`), the client must present the confirmation dialog
specified in §3 instead of throwing `voice_assembly_pending`. The dialog
offers exactly two choices: **Keep Waiting** (safe default) and
**Save Without Audio**.

Binding invariants for every path in this decision:

- All transcript text present in the editor body is preserved verbatim into
  the saved story. The voice-span scrub inside `voiceDiscard()`
  (`public/app.js:2374–2395`) is **prohibited** on every path of this flow.
- No user-facing copy may state or imply that audio was saved unless the E7
  attach transaction durably committed.
- The server remains the sole arbiter of the E5-cancel versus E7-attach race
  via the existing row-lock state machine; the client never assumes an
  outcome, it reads one.
- No new audit action, no new endpoint, no new table, and no SQL change is
  authorized or required by this decision.

### 2. Exact state transitions / operational sequence

**Trigger.** The 2-second poll loop (`voiceAssemblyRetryMs = 2_000`) reaches
`voiceAssemblyWaitMs = 90_000` without the recording reaching a saveable
state. Draft, session, editor text, and voice spans are untouched at this
moment. The busy state is released so the dialog is interactive.

**Path K — Keep Waiting (and every dismissal).**

1. Dialog closes. No server call is made. No state changes anywhere.
2. Polling resumes with a **fresh 90-second deadline**.
3. At each subsequent deadline expiry the same dialog is presented again.
   There is no cap on Keep Waiting cycles; the user stays in control and the
   normal discard control remains available outside the save flow.
4. Server-side `failed` detection during any wait window continues to follow
   the existing immutable assembly-failure path unchanged.

**Path S — Save Without Audio.**

1. Both dialog buttons disable immediately (single-flight; see idempotency).
2. Client calls **E5 cancel** (`api.cancelRecording(recordingId)`).
3. **S-a: E5 succeeds** (2xx, including the idempotent no-change case):
   - Server behavior is the existing E5: DB-commit-first cancel, temporary
     `storyforge-rec/` object deletion with one immediate retry, service
     audit `recording_cancelled`, transcription session release.
   - Client then creates the story through the **canonical typed path**:
     `api.createStory` with the full current editor text (typed text plus
     transcript text, unmodified), `captureType: 'text'`, **no**
     `recordingId`, and the current `draftVersion`.
   - On story-create success only: normal post-save cleanup (draft cleared,
     voice state reset, overlay closed). Success copy per §3; it must not
     mention audio as saved.
   - On story-create failure: draft and editor text remain intact; the
     existing save-error handling applies; the session is already cancelled
     and stays cancelled. Nothing is retried automatically.
4. **S-b: E5 is refused with `state_conflict` (409)** — the race case:
   - Client performs **exactly one** re-read of the recording
     (`api.recording(recordingId)`).
   - If the re-read state is `assembled` or `attached`: client issues
     **exactly one** E7 attempt (`api.createStory` with `recordingId`, the
     unmodified original story payload). If E7 commits, the story is saved
     **with audio** — this is the required better outcome, and only here may
     copy claim audio was saved (E7's one-transaction commit is the
     durable-attachment bar; playback availability continues to follow the
     existing truthful playback states).
   - If the single E7 attempt fails for any reason (including
     `voice_assembly_pending`), **or** the re-read shows any other state:
     **typed-only fallback** — create the story exactly as in S-a
     (full text, `captureType: 'text'`, no `recordingId`), then attempt E5
     cancel **once** more. If that second cancel also conflicts or fails, the
     session is left untouched for the existing maintenance sweep to resolve;
     no further client retries of any kind.
5. **S-c: E5 fails with a network or other non-conflict error:** no story is
   created, nothing is lost, the dialog re-enables (returns to the §3 prompt
   state) and the existing error notification copy applies.

**Recording session disposition after a completed Path S typed-only save
(S-a, or S-b fallback with successful second cancel):** the session is
terminally cancelled; transcripts/segments are purged per the existing E5
transaction; temporary objects are deleted (leftovers covered by the 7-day
`storyforge-rec/` expiry); **later audio attachment eligibility is NONE** —
the story saved without audio can never have this recording's audio attached
afterward, and no code path may offer it. If the S-b fallback's second cancel
was refused, the session's terminal disposition belongs to the server
maintenance path; eligibility for later attachment to the already-saved
typed-only story is still NONE.

**`state_conflict` re-read/retry behavior, exact and closed:** one E5 →
on 409 `state_conflict`: one re-read → at most one E7 → typed-only fallback →
at most one further E5. No loops, no additional retries, no client-side timers
beyond these steps.

**Idempotency.**

- The dialog is single-flight: after either button activates, both buttons
  are disabled until the chosen path reaches a terminal outcome; a second
  activation is impossible while the first is in flight.
- E5 is idempotent server-side (cancelling a cancelled session returns
  success without change); re-issuing E7 hits the existing pre-read
  idempotency and returns the already-attached result rather than
  duplicating.
- The typed-only create must complete before draft cleanup; a reload before
  story-create success therefore recovers the full draft, and a reload after
  success finds the draft cleared — no path can produce two stories from one
  choice.

**Required audit events.** None new. This decision is satisfied entirely by
events the reused endpoints already emit: `recording_cancelled` (service, on
E5), `audio_attached` (on E7 commit), the canonical story-create audit
behavior for the typed-only save, and the unchanged denial bookkeeping. The
dialog itself is a client rendering and is **not** audited; inventing an
audit action for it is prohibited (the M3 action vocabularies are
CHECK-constrained and closed).

**Acceptance criteria.**

1. At exactly the 90-second deadline with assembly still pending, the dialog
   in §3 appears; before the deadline it never appears.
2. Keep Waiting and every dismissal are behaviorally identical, change no
   state, and re-arm a fresh 90-second window that re-prompts on expiry.
3. Save Without Audio on a cancellable session yields: one story whose text
   equals the full editor text including all transcript text; no audio
   asset; a cancelled session; deleted temp objects; success copy without
   any audio claim.
4. When assembly won the race: E5 returns `state_conflict`, exactly one
   re-read and one E7 occur, and the story saves with audio; copy claims
   audio only in this case.
5. When the single E7 retry fails: a typed-only story is created with the
   transcript intact, exactly one further cancel is attempted, and a still-
   conflicted session is left for maintenance.
6. Double-activation, reload mid-flow, and repeat submission produce exactly
   one story.
7. No new audit action names, endpoints, tables, or SQL appear in the diff.

### 3. Exact user copy and accessibility contract

Dialog element: modal `role="alertdialog"`, `aria-modal="true"`,
`aria-labelledby` pointing at the title node, `aria-describedby` pointing at
the body node. On open, focus moves to **Keep Waiting**. Focus is trapped
within the dialog while open. On close, focus returns to the control that
initiated the save. The alertdialog semantics provide the single screen-reader
announcement; no supplemental `aria-live` region may duplicate it.

- **Title (exact):** `Your audio is still being prepared`
- **Body (exact):** `Every word of your story is already captured below and
  will be saved with it. Only the audio is still being prepared. You can keep
  waiting, or save your story now without the audio.`
- **Buttons (exact, in this order):** `Keep Waiting` (default focus, safe
  default), `Save Without Audio`.
- **Escape key:** identical to activating Keep Waiting. Backdrop click or any
  other dismissal affordance, if present: identical to Keep Waiting. There is
  no destructive dismissal.
- **Success copy, typed-only save (exact notification):**
  `Saved. Every word was kept — this story has no audio attached.`
- **Success copy, race-won E7 attach:** the existing successful-save
  notification path applies unchanged (audio attached truthfully by commit).
- **While Save Without Audio is in flight:** the existing busy affordance;
  no additional copy is authorized.

This copy is binding and independent of FG-1. FG-1 remains the authority for
retention/consent copy elsewhere; it does not block this dialog.

### 4. Required tests

1. Unit (client flow logic, using the existing E2E assembly stub): deadline
   fires at 90 000 ms ±1 poll; dialog state machine covers K, S-a, S-b
   (both sub-branches), S-c.
2. E2E `voice-save-attach.spec.mjs` additions:
   - dialog appearance, exact title/body/button strings, default focus,
     Escape-equals-Keep-Waiting, focus trap, focus restore;
   - Keep Waiting → re-prompt on second expiry;
   - Save Without Audio happy path: story text byte-equality with editor
     content including transcript spans; session cancelled; no audio asset;
     exact typed-only success copy; no audio claim;
   - race fixture (session flips to `assembled` between deadline and
     cancel): `state_conflict` → single re-read → single E7 → story with
     audio; audio-claiming copy only here;
   - E7-retry-failure fixture: typed-only story, transcript intact, one
     further cancel, session left pending sweep;
   - double-click/single-flight test: exactly one story row.
3. Server (existing suites, must stay green unchanged): E5 idempotency, E7
   pre-read idempotency, concurrent race-loser re-read, 409 pending
   response — no server behavior change is expected and no server diff is
   authorized for Decision 1.
4. Accessibility assertions: `role`, `aria-modal`, `aria-labelledby`,
   `aria-describedby` present; no `aria-live` duplication.
5. Regression: normal discard (`voiceDiscard()`) still scrubs voice spans in
   its own flow; assembly-`failed` path and its immutable safe-text string
   (SHA-256 `669fc79d…`) byte-unchanged.

### 5. Prohibited interpretations

1. Reusing `voiceDiscard()`'s text scrub for Save Without Audio, or removing
   any transcript text on any path of this decision.
2. Treating Save Without Audio as a silent background cancel without the
   dialog, or auto-choosing either option on the user's behalf at any
   timeout.
3. Claiming, in any copy or state, that audio was saved, attached, or "will
   appear shortly" on the typed-only path — including after the E7 retry
   failed.
4. Retrying E5, the re-read, or E7 more times than §2 permits; adding
   client-side reconciliation loops; or having the client infer the race
   winner without the server re-read.
5. Preserving the recording session as "attachable later" after a typed-only
   save, or offering post-save audio attachment for it anywhere in the
   product.
6. Adding audit actions, endpoints, tables, columns, flags, or SQL of any
   kind under this decision; auditing dialog display; widening the M3
   vocabularies.
7. Making Escape, backdrop, or dismissal destructive, or defaulting focus to
   Save Without Audio.
8. Sending `captureType: 'audio'` or a `recordingId` on the typed-only
   create.

### 6. Founder decision still required

None. This ruling is complete and self-contained. (FG-1 continues to govern
unrelated retention/consent copy exactly as B1-506A recorded.)

---

## DECISION 2 — Weekly permanent-audio reconciliation (resolves FABLE-2)

### 1. Binding ruling

The weekly `storyforge-audio/` backstop runs **in-process, inside the
existing maintenance loop** in `server/recordings.mjs`: `runMaintenance()`
gains a fourth failure-isolated `Promise.allSettled` lane,
`runWeeklyAudioReconciliation()`, driven by the existing `startSweeps()`
interval timer and its existing `STORYFORGE_SWEEPS` gate. No external cron,
no pg_cron, no new process, no new endpoint, and **no new database table** —
a new table is ruled *not indispensable*. Durable state is carried entirely
by: two deployment configuration keys, one control object in storage, the
append-only `sf_audit_events` history via the already-ruled service actions
(`reconciliation_deleted`, `object_delete_retried`), and the presence of the
M3 function `public.sf_voice_audio_reference_check` itself.

The execution principal is the existing **service principal** — the
`storyforge_app` service lane and service transaction wrapper
(`withServiceTransaction`) that already own sweeps and pending-asset
recovery. No student, mentor, admin, or Founder identity ever executes
reconciliation.

The rollback rung 6/7 suspension is **fail-closed and double-walled**:

1. **Explicit operator suspension (primary, binding runbook amendment).**
   Setting `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` to any non-empty
   value suspends reconciliation entirely. The runbook for rollback rungs 6
   and 7 is amended (mechanical) to require setting this key — recommended
   value `rung6-<date>` or `rung7-<date>` — **before** executing the rung.
   The human operator executing the rung sets it. Only an operator acting on
   an explicit Founder review decision may clear it, and the clearance
   evidence (Founder decision reference, date, operator) must be recorded in
   the operations log before the key is removed.
2. **Inherent structural suspension (secondary, automatic).** Every run must
   successfully execute `public.sf_voice_audio_reference_check` before any
   deletion. Rung 6/7 rollback removes the M3 objects, so after such a
   rollback the call fails and the run aborts with **zero deletions**,
   regardless of configuration. No configuration value can override this.

Fail-closed is universal: any error, timeout, missing datum, unparseable
metadata, failed audit write, or ambiguity of any kind **preserves the
object** (and, where specified, aborts the run). Deletion requires every
predicate to affirmatively pass; nothing is deleted by default, by absence of
information, or by fallback.

### 2. Exact operational sequence

**Configuration gate (evaluated at each maintenance tick, in this order):**

1. If `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` is set (non-empty): emit a
   `suspended` telemetry result; perform **no list, no reference check, no
   delete**; stop.
2. Read `STORYFORGE_AUDIO_RECONCILIATION`: `off` | `dry_run` | `on`.
   Absent ⇒ `off`. Any other value ⇒ `off` plus an invalid-config telemetry
   result. `off` ⇒ stop.
3. Cadence check: read the control object
   `storyforge-audio/_control/reconciliation.json`. Due when the object is
   absent, unreadable, or its `completedAt` is ≥ 7 days old. Not due ⇒ stop.
   (An unreadable marker affects cadence only — running early is safe
   because every deletion predicate is independently guarded; it can never
   relax a deletion predicate.)

**Run sequence (mode `dry_run` or `on`):**

1. **LIST first.** Enumerate `storyforge-audio/` via the storage list API in
   pages of ≤ 1000 keys, up to the evaluation cap of **5000 keys per run**
   (excess deferred to the next run, and the truncation is reported in
   telemetry — no silent cap).
2. **Filter.** A key is a *candidate* only if all hold:
   - it is under `storyforge-audio/` and **not** under
     `storyforge-audio/_control/` (the control prefix is categorically
     exempt);
   - its storage last-modified timestamp exists, parses, and is
     **older than 7 full days (> 168 hours)** at evaluation time — missing
     or unparseable ⇒ preserve;
   - a UUID is parseable from its filename stem (server-generated keys are
     `storyforge-audio/<studentId>/<storyId>/<uuid>.<ext>` and derived
     stem/segment forms) — no parseable UUID ⇒ preserve, because the
     required audit row could not be truthfully attributed.
   `storyforge-rec/` is **never** touched by this run; it remains governed
   by the 7-day transient lifecycle.
3. **Reference check.** Pass candidates through
   `sf_voice_audio_reference_check` in batches of ≤ 1000 (the SQL-enforced
   cap), via the existing `checkAudioObjectReferences` seam. Any batch error
   ⇒ abort the entire run with zero deletions. `referenced = true` ⇒
   preserve. Only an affirmative `referenced = false` proceeds. (The
   function's documented false-positive direction is accepted as safe:
   over-reporting references only delays deletion.)
4. **Delete, bounded and ordered.** For each unreferenced candidate, up to
   the deletion cap of **200 objects per run** (excess deferred, reported):
   - issue the storage delete; on failure, exactly **one immediate retry**,
     recorded through the existing `object_delete_retried` service audit;
     if the retry also fails, preserve (the object simply remains a
     candidate next week — this is the backstop's own backstop);
   - on confirmed deletion, write the service audit
     `reconciliation_deleted` (`entity_type = 'audio_asset'`,
     `entity_id` = the UUID from the filename stem, `student_id`/`story_id`
     parsed from the key path where present, content-free payload with
     object count/byte metadata per the existing payload vocabulary);
   - if a `reconciliation_deleted` audit write fails, **abort all further
     deletions in the run** (the already-deleted objects' prior audit rows
     stand; nothing further proceeds without evidence).
   In `dry_run` mode, step 4 performs **no delete and no delete-audit**;
   the would-delete set is reported in telemetry only.
5. **Marker write.** On run completion (including an aborted run), write
   `storyforge-audio/_control/reconciliation.json` with `mode`, `startedAt`,
   `completedAt`, counts (listed, truncated, candidates, referenced,
   preserved-with-reason, deleted, retried, failed), and an `aborted`
   reason if any. A failed marker write is telemetry-visible and makes the
   next tick due again — which is safe, per the guard rails.

**Ordering rule (binding):** list → filter → reference-check → delete, with
the reference check and its dependent deletes inside the **same run**; no
deletion may rely on a reference result from a previous run or tick.

**Retry and idempotency.** The run is restart-safe and idempotent: every run
begins from a fresh LIST; deleting an already-absent object is a success
no-op; a crash mid-run loses nothing (undeleted candidates reappear next
run); double execution deletes nothing extra because every predicate is
re-evaluated per object per run. No state other than the marker, the audit
rows, and the objects themselves is kept anywhere.

**Telemetry and evidence.** The `runMaintenance()` return value gains an
`audioReconciliation` member (mode, suspended/aborted flags, all counts) with
the same failure-isolation shape as the existing three lanes. The audit rows
(`reconciliation_deleted`, `object_delete_retried`) are the durable
per-object evidence; they surface to administrators through the existing
bounded E11 feature-audit tail without any new read grant.

**Rollback requirements.** The feature is configuration-gated only: rollback
of reconciliation = set `STORYFORGE_AUDIO_RECONCILIATION=off` (or unset).
There is no schema change, so no migration and no migration-rollback rung is
added or altered. Deletions themselves are irreversible by nature — which is
exactly why `dry_run` gating, the Founder promotion gate (§6), the age
threshold, the affirmative reference check, the caps, and the double-walled
suspension exist.

**Acceptance criteria.**

1. With `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` set, a due run performs
   zero storage calls and reports `suspended`.
2. With mode absent, `off`, or invalid, no run executes; invalid values are
   telemetry-visible.
3. With M3 rolled back (function absent), a configured-`on` run aborts with
   zero deletions.
4. `dry_run` deletes nothing, audits no deletions, and reports the exact
   would-delete set and marker.
5. In `on` mode: an unreferenced object > 168 h old is deleted with a
   `reconciliation_deleted` audit row; a referenced object, an object
   ≤ 168 h old, any `_control/` object, any `storyforge-rec/` object, and
   any object with missing metadata or a non-UUID stem are all preserved.
6. A delete failure produces exactly one retry and an
   `object_delete_retried` row; a twice-failed object survives to the next
   run.
7. Caps are enforced and reported: > 5000 listed ⇒ evaluation truncation
   reported; > 200 eligible ⇒ exactly 200 deleted, remainder preserved.
8. A run < 7 days after the last `completedAt` does not execute; marker
   absence or corruption makes the run due without weakening any deletion
   predicate.
9. A mid-run crash followed by a rerun converges with no duplicate audits
   for the same surviving object and no lost evidence for deleted ones.
10. The diff adds no table, no endpoint, no SQL, no new audit action, and no
    scheduler outside `runMaintenance()`/`startSweeps()`.

### 3. Exact configuration contract

- `STORYFORGE_AUDIO_RECONCILIATION` — `off` (default; absent ⇒ `off`) |
  `dry_run` | `on`. Any other value ⇒ treated as `off`, reported.
- `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` — unset (default) or any
  non-empty string ⇒ suspended. Set by the human operator as a mandatory
  pre-step of any rollback rung 6/7 execution (runbook amendment,
  mechanical). Cleared only on an explicit Founder review decision, with the
  clearance evidence recorded before removal.
- Existing `STORYFORGE_SWEEPS` continues to gate the whole maintenance
  timer; if sweeps are disabled, reconciliation cannot run (acceptable and
  fail-closed by construction).
- Fixed constants (binding, not configurable): age threshold 168 hours;
  list page ≤ 1000; reference-check batch ≤ 1000; evaluation cap 5000 keys
  per run; deletion cap 200 objects per run; one delete retry; cadence 7
  days measured from last `completedAt`; control object key
  `storyforge-audio/_control/reconciliation.json`; permanent prefix
  `storyforge-audio/`; exempt prefix `storyforge-audio/_control/`.

### 4. Required tests

1. Unit (`recordings-orchestration` / new reconciliation unit file):
   configuration gate order (suspension before mode before cadence); invalid
   mode ⇒ off; cadence due/not-due including absent and corrupt marker;
   filter predicates (age boundary at exactly 168 h ⇒ preserve, > 168 h ⇒
   candidate; `_control/` exemption; non-UUID stem ⇒ preserve; missing
   mtime ⇒ preserve); caps and truncation reporting; dry-run zero-delete;
   delete retry then preserve; audit-failure abort; batch-error abort;
   idempotent rerun.
2. PostgreSQL suite: `sf_voice_audio_reference_check` invoked by the run
   under the service principal only; referenced states
   (`pending`,`uploaded`,`verified`) preserve and `retired`/absent rows
   permit; function-absent (simulated rung 6/7) ⇒ run aborts, zero deletes;
   `reconciliation_deleted` and `object_delete_retried` rows carry
   content-free payloads and append-only history (M3 rollback/reapply test
   remains green and unchanged).
3. Maintenance integration: `runMaintenance()` four-lane
   `Promise.allSettled` failure isolation — a reconciliation abort never
   disturbs sweeps, pending-asset recovery, or transcription recovery, and
   vice versa.
4. Storage-fake E2E: full weekly cycle in `dry_run` then `on` against a
   seeded mix (referenced, unreferenced-old, unreferenced-new, control
   object, transient object, junk filename) asserting the exact surviving
   set and audit rows.
5. Regression: all existing suites green with no changes to E5/E7/E8, sweep,
   pending-asset, or transient-lifecycle behavior.

### 5. Prohibited interpretations

1. Creating a new database table, view, column, sequence, or any schema
   object for scheduler state, suspension state, or run history — ruled not
   indispensable; using anything other than the two configuration keys, the
   control object, the audit rows, and M3-function presence for durable
   state.
2. Running reconciliation under any identity other than the service
   principal, from any scheduler other than the existing maintenance timer,
   or exposing it as an endpoint.
3. Deleting on ambiguity: treating a failed, timed-out, or partial
   reference check as "unreferenced"; deleting objects with missing
   metadata, unparseable stems, or unverifiable age; deleting when the
   audit write cannot be made; carrying a reference result across runs.
4. Touching `storyforge-rec/`, the `_control/` prefix, or any key outside
   `storyforge-audio/`; widening the LIKE-based reference match; treating
   the documented false-positive direction as a defect to "fix" by loosening
   it.
5. Auto-clearing suspension, clearing it on a timer, letting any automated
   run set or clear it, or promoting `dry_run` → `on` without the Founder
   gate in §6.
6. Exceeding or making configurable the binding caps and thresholds in §3;
   removing the one-retry limit; adding bulk multi-object delete calls that
   bypass per-object audit.
7. Interpreting this ruling as enabling reconciliation in production: it
   ships `off` by default and remains subject to every B1-506A external
   gate.
8. Adding audit vocabulary — `reconciliation_deleted` and
   `object_delete_retried` already exist in M3 and are the only actions
   this lane may write.

### 6. Founder decision still required

None for specification or implementation. Two **operational** Founder gates
attach to enablement, exercised later through the existing gate process:

1. **Promotion `dry_run` → `on`:** requires Founder sign-off after reviewing
   the evidence (telemetry counts and would-delete set) of at least one
   completed production `dry_run` cycle.
2. **Clearing a rung 6/7 suspension:** requires an explicit Founder review
   decision, recorded before `STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED` is
   removed.

---

End of B1-506B. Opus 4.8 translates these two rulings into execution
materials without alteration.
