# V1 Study Schedule — V1-8000 Decision Ledger

Date opened: 2026-07-14
Mission: `V1-STUDY-SCHEDULE-8000`
Scope: reconciliation and program lock only; no application implementation or deployment

## D-001 — Active product identity

**Decision:** All new work uses **V1 Study Schedule** and the ticket range
`V1-STUDY-SCHEDULE-8000` through `V1-STUDY-SCHEDULE-8099`.

**Reason:** The founder's explicit scope correction supersedes the older nomenclature
inside the attached historical mega-run prompt. `Matrix Plan`, `Study Schedule`,
`Study Scheduler`, and `D9 Matrix Plan` remain searchable historical aliases, but
new outputs do not use those aliases as the active product name.

**Not this product:** MissionMed Scheduler, Appointment Scheduler, Calendar, or
Webex Scheduler. Those systems may be inspected only when direct shared-contract
evidence requires it.

## D-002 — Controlling run boundary

**Decision:** V1-8000 is a read-only engineering reconciliation run except for
handoff reports, evidence inventories, deterministic build helpers inside this
handoff directory, and the final handoff-only Git publication permitted by the
canonical prompt.

**Reason:** The attached prompt explicitly states that V1-8000 must not implement
application code, mutate runtime/data/auth/flags/caches, or deploy. Implementation
belongs to V1-8010.

## D-003 — Resume branch and starting point

**Decision:** Reconcile from the founder-specified resume state without rewriting
history:

- Worktree: `/Users/brianb/MissionMed_worktrees/V1-StudyScheduler-8000`
- Branch: `codex/v1-study-schedule-8000`
- Starting HEAD: `d4455bf4ee40`

The older prompt's expected branch and recovered-source-base statements are
evidence to verify, not instructions to replace the explicit resume state.

## D-004 — Disposition of provisional files from the activation-only overrun

The supervisor reinspected all four provisional file groups before continuing.

| Provisional file | SHA-256 | Lines | Disposition | Reason |
|---|---:|---:|---|---|
| `_AI_HANDOFFS/from_codex/V1_STUDY_SCHEDULE_8000/V1_8000_PRODUCT_IDENTITY_LEDGER.md` | `0be3b7f5871fdff407f6836fd497754e212146ce49d368a5ad4a4822b0e1e6fc` | 35 | **Replace** | Its product boundary is useful, but it is incomplete and outside the canonical recon deliverable set. Verified identity content is restated in D-001; the provisional file is removed. |
| `_AI_HANDOFFS/from_codex/V1_STUDY_SCHEDULE_8000/V1_8000_PROTECTED_SOURCE_DECISION.md` | `0b222e957c92633ef45353c5465e2fdaa29a276d7ce10735c07181bb48da873e` | 60 | **Replace and reverify** | It incorrectly declares source implementation active and prematurely chooses persistence and implementation details. Its hashes, branch claims, and founder override remain hypotheses until independently verified in the final authority reports. The provisional file is removed. |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-study-plan-access.php` | `2864bbdb59eb3999f7ba59eb82be57eb893bdaf3c24b3b1f2691664fecb084f6` | 140 | **Delete** | This is unintegrated application source created outside V1-8000's write authority. Keeping it would violate the zero-application-source-diff closeout gate. |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-study-plan-installer.php` | `25aea4db112356915b538f2a5fcf9c3505f3c8da649dbf333cd6d31356b258de` | 113 | **Delete** | This is unintegrated application/database schema source and embodies an unverified data-authority choice. V1-8000 may recommend, but may not implement, such a choice. |

No content from the two PHP drafts is treated as canonical evidence. Removal only
restores the pre-overrun application-source state; no tracked file is changed.

## D-005 — Named-agent order and write authority

**Decision:** Herschel, Avicenna, and Lorentz run concurrently as the first wave,
followed by Darwin as soon as a slot opens. All four remain read-only. The main
supervisor alone writes reconciliation artifacts and independently verifies every
load-bearing conclusion.

**Reason:** This follows the founder's explicit resume order while retaining the
canonical prompt's requirement that Darwin receive the verified first-wave maps
before finalizing recommendations.

## D-006 — Product, visual, behavioral, and refinement authority

**Decision:** Brian's corrected V1 identity controls the run. D9-300 is the
canonical visual and interaction foundation. D9-350 is behavioral authority
where consistent. D9-360 is later refinement and quality evidence that must be
revalidated and does not close G-D9-4.

**Reason:** This resolves inherited documents that called D9-360 final authority
without discarding its useful six-view, settings, Journey, test, and screenshot
evidence.

## D-007 — Canonical source and route

**Decision:** Source implementation authority is
`d4455bf4ee401eaa8b074603497eb9fcd6eb04a0` on
`origin/d9-matrix-plan-415-source-recovery`. The current production route is
recorded as **NONE VERIFIED**; `/member-dashboard/#study` is only a
source-inferred legacy candidate.

**Reason:** D9-415 provides a point-in-time 135/135 source-to-production map and
the currently public hashed asset matches. Anonymous and browser checks reached
WordPress login, not an authenticated Study UI; current live PHP was not read.

## D-008 — Physical persistence

**Decision:** V1-8000 does not select an existing Calendar, Supabase, or
diagnostic table as the V1 Plan store. A Plan-owned WordPress repository is the
lowest-risk recommendation, but V1-8010A must record the data-plane decision
before schema work.

**Reason:** WordPress identity is established, while no Supabase target or
existing Plan table has authoritative ownership. A recommendation is not
constitutional authority.

## D-009 — Identity, entitlement, and rollout

**Decision:** WordPress user identity is authoritative. Whether/how Plan data is
partitioned by program/course context remains open. A structured fail-closed
access service separates actor identity, entitlement, rollout exposure, and
action/resource/field authorization. Administrators are audit-only for learner
Plan data. The default-off feature flag is rollout control, not authorization.

**Reason:** The legacy client locks Study for ordinary users while REST grants
all logged-in callers, proving the current boundaries disagree.

## D-010 — One-writer and legacy boundary

**Decision:** V1 owns canonical plans, blocks, series, sessions, actuals,
reserve, recovery, reviews, and learner responses through one repository and
operation log. Profile remains owner of runway/exam/profile facts; goal-field,
context-partition, and settings ownership remain 8010A decisions. Calendar,
Admin OS, Session Manager, and mentor tools cannot write canonical Plan state;
excluded appointment systems are not an assumed V1 dependency. Legacy
`study_block` is an explicit import candidate only.

**Reason:** Current shared writers create a verified dual-writer risk.

## D-011 — Completion authority

**Decision:** Completion is a learner operation. Course/Arena outcomes attach
evidence or propose completion but do not silently set a block to done. Mentor
input is an immutable ghost suggestion requiring a learner response.

**Reason:** D9-350's later, specific behavioral constitution resolves broader
D9-100 language that could be read to permit external auto-completion.

## D-012 — Evolution path

**Decision:** Use an initially default-off strangler module with immutable lazy-
loaded assets and the phase-aware modes in D-020. Do not edit the active hashed
Student OS shell in place and do not grow legacy Calendar CRUD into V1.

**Reason:** This creates the smallest protected change surface, separates Plan
ownership, and preserves a rollback path.

## D-013 — Next-ticket readiness

**Decision:** `V1-STUDY-SCHEDULE-8010` is **not ready for schema or
learner-visible implementation**. Its A-phase authority and characterization
work may begin immediately after this handoff is accepted, limited to decisions,
source freeze, non-mutating production observation, and local/isolated-staging
characterization.

**Reason:** Physical store, context, entitlement, timezone, settings, legacy
handling, flag, and rollback boundaries remain mandatory gates that can be
resolved autonomously inside 8010A.

## D-014 — Publication base

**Decision:** Any V1-8000 draft PR targets
`d9-matrix-plan-415-source-recovery`, not `main`.

**Reason:** The V1 branch is six recovery commits and 220 paths ahead of main but
exactly equal to the recovered-source base before the handoff. A main-targeted PR
would misstate the change.

## D-015 — Runtime-lock override

**Decision:** Record Brian's exact approval of the Matrix runtime lock override
for `V1-STUDY-SCHEDULE-8000` and `class_mmed_student_os_php`. Apply it only to
this read-only reconciliation.

**Reason:** The local guard differs only for the recovered Student OS controller
source. The current live PHP controller was not read. The
override resolves investigation startup but is not permission to modify the
protected controller in V1-8000.

## D-016 — MissionMed_OS stale Git lock

**Decision:** The earlier startup removed only
`/Users/brianb/MissionMed_OS/.git/index.lock` after recording its zero-byte
metadata and proving no live Git process owned or required it. The resumed run
observed the lock absent. MissionMed_OS dirty files remained untouched.

**Reason:** This follows the founder's explicit stale-lock resolution directive
and distinguishes the initial safe removal from the later “not present”
observation.

## D-017 — Application-source mutation accounting

**Decision:** Report zero **net/final application-source diff** and zero persisted,
tracked, staged, committed, pushed, runtime, or deployed source. Also disclose
that the activation-only overrun created two provisional untracked PHP drafts and
resume disposition deleted those two files.

**Reason:** “Zero historical filesystem operations” would contradict D-004.
Truthful closeout distinguishes four provisional create/delete operations from
the verified zero final source change.

## D-018 — Corrected output-directory authority

**Decision:** The canonical output directory is
`_AI_HANDOFFS/from_codex/V1_STUDY_SCHEDULE_8000_RECON/`. The superseded attached
prompt's `_AI_HANDOFFS/from_codex/V1_STUDY_SCHEDULER_8000_RECON/` path is not a
missing deliverable and must not be created.

**Reason:** Brian's later product-identity correction controls all new names and
explicitly forbids using “Study Scheduler” as the active product name. Historical
artifact names remain unchanged only where they identify evidence.

## D-019 — Active-shell runtime-governance gap

**Decision:** Treat the active hashed Student OS bundle as protected by blast
radius even though the global lock and stale Matrix passport do not inventory
that hashed path. V1-8010A must pin the controller, active hashed bundle,
unversioned source twin, and cache-delivery behavior as one governed descriptor
before any protected seam change.

**Reason:** A passing guard over declared inputs is not proof that every active
runtime input is declared. The public hashed bundle matches recovered source,
while the lock covers only unversioned `assets/student-os.js` and the public
unversioned object has a different hash.

## D-020 — Executable phase-aware rollback

**Decision:** One feature flag is insufficient. V1 uses distinct
`LEGACY_PRECUTOVER`, `V1_ACTIVE_READ_WRITE`, `V1_DEGRADED_READ_ONLY`, and
`V1_HIDDEN`-only-without-V1-truth modes. The first Plan operation/import and
cutover watermark commit atomically. A current/N-1 minimal reader remains
deployable after cutover; mutable legacy cannot return for a migrated learner.

**Reason:** The recovered `d4455bf` package cannot read future V1 Plan data.
Restoring it after the first V1 write would preserve bytes while presenting a
stale second planning truth.

## D-021 — Transaction capability before schema

**Decision:** A Plan-owned WordPress repository remains the recommendation, but
V1-8010A/D must prove the selected engine's transaction/isolation behavior,
database uniqueness for revision/idempotency, concurrent migration locking,
failure recovery, atomic first-operation/watermark creation, and forward schema/
snapshot/compaction compatibility before a first write.

**Reason:** “Atomic” is not an application-layer assertion; it depends on real
storage and migration capabilities.

## D-022 — Authorization execution order

**Decision:** V1 authenticates and validates the REST nonce, checks entitlement/
rollout/action permission, queries through a learner-scoped repository, then
checks resource/field authorization on that scoped result using a
non-enumerating response policy.

**Reason:** Ownership cannot be safely decided before loading a scoped resource.
This order also gives CSRF, stored-content encoding, mass-assignment,
enumeration, and rate tests an executable boundary.

## D-023 — Mutation characterization boundary

**Decision:** V1-8010 production observation remains read-only. Any legacy
list/create/update/delete mutation characterization uses local fixtures or an
isolated staging environment only. V1-8040 remains the first production mutation
or deployment ticket.

**Reason:** Current live PHP/backend and the authenticated Study route are not
verified, so characterization language must not be construed as production-write
authority.

## D-024 — Release-candidate and excluded-integration boundaries

**Decision:** V1-8010I produces a staging-development package. V1-8020 fixes
rerun affected 8010 gates. V1-8030 freezes and rehearses one immutable RC digest;
V1-8040 may deploy only that exact digest, and any change returns to 8030. No
appointment-system implementation is part of V1-8010; only a generic fixed-
anchor seam may exist unless direct necessity is later proven.

**Reason:** This prevents a quality-loop package from silently becoming a stale
release candidate and prevents excluded booking work from re-entering through an
unproven adapter assumption.
