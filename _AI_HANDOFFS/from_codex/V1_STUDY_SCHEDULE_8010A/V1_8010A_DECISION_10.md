# V1-8010A Decision 10 — Completion, Execution, and Adapters

**Status:** ACCEPTED

## Canonical command boundary

Only a learner-authorized V1 command may complete, partially resolve, move,
reserve, release, or recover Plan work. Courses, Arena, StoryForge, Vault,
Calendar, mentor systems, and other adapters contribute evidence or proposals
only.

Inbound evidence carries source system/object/version, event ID,
occurred/received timestamps, kind, tombstone/retraction state, and payload
schema version. Replay, stale, reordered, conflicting, or retracted evidence
cannot mutate canonical completion. External evidence, learner verdict,
actual-time fact, and adapter-delivery state remain separate. Outbound delivery
is idempotent and its failure never rolls back a valid local learner operation.

Mentor suggestions are immutable proposals with reason, author, assignment
scope, privacy filtering, withdrawal revision, and compare-and-swap learner
resolution. Adapter absence degrades locally.

## Behavioral rulings

### Partial and release

- Governed work quantity is conserved; rounded planned minutes are not proof.
- A partial source becomes a terminal historical parent and its remainder is a
  distinct lineage child.
- An accepted remainder disposition removes the parent from closeout triage;
  an active same-day child gates closeout independently.
- Undo is a lineage-aware compensating operation and conflicts after
  incompatible child changes.
- `skipped` is nonterminal. Every release requires a governed reason.
- A learner-authored 0% attempt may derive `attempted_no_progress`; captured
  attempt time survives and the released object cannot be silently resurrected.

### Ghosts and group acceptance

- Add: use a valid gap, otherwise Reserve with provenance.
- Move: move the existing obligation to a valid gap or atomically to Reserve.
- Resize: use a valid same/fallback slot; otherwise remain pending
  `needs_placement` with no Plan mutation.
- Defer: atomically move the existing obligation to Reserve.
- Missing target: withdraw/conflict; never accept.
- Modify: create an isolated learner draft; a separate save changes Plan.
- A group uses one tentative final Plan, one transaction, one operation, and one
  compensating undo. Any nonrecoverable member failure aborts all members.

### Recovery, Reserve, streaks, and actuals

- Recovery conserves exact work quantity; minute compression is a separate
  estimate change; true scope reduction is an explicit release.
- Reserve uses stored learner-visible order. It chooses the first item fitting
  both displayed flexible-capacity budget and a collision-free future slot
  after now, respecting fixed anchors, protected rest, and horizon. No hidden
  historical multiplier applies. No fit recommends closeout; placement
  revalidates revision/capacity/slot.
- Rest, quiet, and pause preserve continuity but do not increment
  `resolved_work_days_current`; unresolved closeout resets it. Milestones derive
  only from resolved work days and are delivered once per run.
- Actual duration provenance is `timer`, `learner_entered`, or
  `assumed_planned`. Zero is valid. Timer segments persist even if no outcome is
  chosen, sum once by unique IDs, and only timer-derived minutes may be labeled
  focused work.

## Required proof

Contract/property suites cover replay/reorder/tombstone, conservation and
lineage, two-tab races, mentor accept/withdraw, group failure, adapter outage,
Reserve capacity, streak sequences, actual provenance, crash recovery, and
read-model rebuild. No adapter may write Plan tables directly.
