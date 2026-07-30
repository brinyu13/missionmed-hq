# B1-507 Narrow Fable Authority Request

## Role

You are Fable, providing a **binding, bounded architecture amendment** for the
existing StoryForge V5.5 Phase 1 implementation.

Do not redesign StoryForge. Do not reopen settled product behavior, provider
choice, WordPress/Matrix integration, PostgreSQL/RLS architecture, R2 privacy,
the 90-second UX, or the weekly reconciliation decision except where the five
contradictions below make the existing ruling impossible or incomplete.

Return exact executable rulings only.

## Verified authority and repository baseline

- V5 product authority:
  `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`
  SHA-256
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- V5.5 product authority:
  `_AI_HANDOFFS/from_cowork/B1-504A_storyforge_v5_5_production_authority/`.
- Infrastructure authority:
  `_AI_HANDOFFS/from_cowork/B1-504B_storyforge_v55_infrastructure_platform_authority/`.
- Existing bounded amendment:
  `_AI_HANDOFFS/from_cowork/B1-506A_storyforge_v55_bounded_authority_amendment/`.
- Existing final rulings:
  `_AI_HANDOFFS/from_cowork/B1-506B_storyforge_v55_final_binding_rulings/B1-506B_FABLE_BINDING_RULINGS.md`.
- Contradiction evidence:
  `_AI_HANDOFFS/from_codex/B1-506C_storyforge_v55_final_two_rulings/B1-506C_COMPLETE_COMBINED_HANDOFF.md`,
  section 11.
- Current launch dossier:
  `_AI_HANDOFFS/from_codex/B1-507A_storyforge_authority_recovery/B1-507A_COMPLETE_COMBINED_HANDOFF.md`.
- Repository/worktree:
  `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`.
- Current starting HEAD:
  `82669485c187cd3127ab2c84cb79864d827e0aef`.
- Both assembly executors exist and pass local fake-boundary tests.
- Reconciliation is implemented but production mode remains `off`.

## Required ruling 1 — RP-8 equivalent runtime and executor selection

Historical RP-8 requires comparing Option A and Option B with 40 fixtures of
15 seconds each (10 minutes total), Chrome and Safari playback, and completion
within the authorized threshold. The old instruction names a local Nixpacks
container. Local Docker/container-runtime troubleshooting is explicitly
prohibited in B1-507.

Authorize or reject this exact equivalent:

1. Build the exact Git-frozen StoryForge candidate through Railway's normal
   Nixpacks builder in a **temporary nonproduction StoryForge service**.
2. Give that service no production database, no production R2 credentials, no
   production provider key, and no student data.
3. Run the same 40×15-second deterministic fixture set through Option A and
   Option B inside that built runtime.
4. Download only the generated nonstudent test artifacts, verify hashes, and
   perform complete Chrome and Safari playback.
5. Record build identity, runtime identity, per-option completion time,
   output layout/hash, playback result, restart behavior, and cleanup.
6. Select the option that satisfies the existing RP-8 thresholds. If both
   pass, state the exact tie-breaker. If neither passes, fail the gate.
7. Delete the disposable service and fixture objects only after evidence is
   sealed.

State:

- whether this is bindingly equivalent to the historical local Nixpacks probe;
- the exact pass/fail and tie-break rule;
- which executor may be selected if both pass;
- the exact runtime wiring that is authorized after selection;
- any evidence needed before deleting the disposable probe.

Do not authorize a different product workflow or a permanent new service.

## Required ruling 2 — FABLE-C1 deletion and audit truth

Existing wording implies delete-first plus PostgreSQL audit evidence, but R2
and PostgreSQL have no shared transaction.

Define the exact durable state machine and recovery truth for:

- delete intent creation;
- R2 delete success/failure/timeout;
- PostgreSQL audit write success/failure;
- crash before or after each boundary;
- retry when the object is already absent;
- reconciliation recovery after restart;
- when the system may truthfully call an object deleted;
- what durable evidence must exist before processing the next object.

Choose the smallest model compatible with existing additive PostgreSQL,
service-principal, R2, and append-only-audit architecture. Explicitly state
whether a new additive table/columns/function are indispensable. Do not claim
cross-system atomicity.

## Required ruling 3 — FABLE-C2 operator visibility

E11 is currently a feature-flag surface and cannot truthfully expose
reconciliation actions.

Define the minimum approved visibility:

- authorized role(s);
- exact existing or new bounded endpoint/query/report;
- fields for run mode, dry-run, candidate/preserved/deleted/retried/failed,
  abort reason, suspension, cursor/fairness state, and timestamps;
- retention of operational records;
- required redactions;
- whether WordPress administrators may see the surface;
- explicit prohibition on raw transcript/audio/signed URL/object credential
  exposure.

Do not create a broad admin platform.

## Required ruling 4 — FABLE-C3 orphan attribution

An R2 key may encode a student/story/audio UUID whose database row never
existed or was deleted. Existing audit foreign keys can therefore reject a
truthful orphan-deletion event.

Define:

- the exact attribution model for valid rows, deleted rows, nonexistent rows,
  invalid UUIDs, and malformed keys;
- whether nullable foreign keys, immutable tombstones, a system-owned entity,
  or a content-free orphan-evidence record is authorized;
- deletion eligibility for each category;
- evidence retained after deletion;
- how the model preserves privacy and avoids fabricating a student/story link.

## Required ruling 5 — FABLE-C4 fairness and continuation

The current first-5,000-key cap can starve later objects.

Define:

- deterministic ordering;
- persisted cursor/checkpoint representation and owner;
- advancement rules for success, abort, suspension, and partial failure;
- wrap/reset behavior;
- interaction with the 1,000-key page, 5,000-key evaluation, and 200-delete
  caps;
- restart and concurrent-run behavior;
- proof that every eligible prefix/key receives bounded future consideration.

Use the smallest durable state compatible with the approved weekly loop.

## Conditional ruling 6 — PROBE-C5 scheduler coordination

Fresh production evidence shows one Railway API replica, but not a locked
single-scheduler invariant.

Rule as follows:

- If Railway can enforce exactly one reconciliation-capable replica, define
  the exact configuration, monitoring, alert, and pre-run proof that makes the
  single-scheduler invariant binding.
- Otherwise, authorize the smallest lease/compare-and-set/ownership mechanism
  compatible with the C1/C4 state. Define acquisition, renewal, expiry,
  takeover, clock assumptions, crash behavior, and tests.

No reconciliation `on` activation is permitted with uncontrolled concurrent
schedulers.

## Required response format

Return one Markdown document titled:

`B1-507 FABLE RP-8 AND RECONCILIATION BINDING AMENDMENT`

For RP-8 and each C1–C5 item include:

1. **Binding ruling**
2. **Exact schema/config/API/runtime changes authorized**
3. **Explicitly rejected interpretations**
4. **Migration and backward-compatibility effect**
5. **Tests and production evidence required**
6. **Rollback behavior**
7. **Whether the item is fully resolved by this amendment**

Finish with:

- the exact RP-8 execution decision;
- the selected-executor decision rule;
- a complete ordered reconciliation state transition;
- the exact point at which `dry_run` may begin;
- the exact point at which `on` may begin;
- a statement that all other StoryForge authority remains unchanged.

Do not provide general strategy. Do not defer choices back to Codex. Do not
change Founder policy FG-1 or production activation approval.
