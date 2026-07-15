# V1-8010A Decision 01 — Product and Authority

**Status:** ACCEPTED

## Decision

The product is V1 Study Schedule. D9-300 is the visual and interaction
foundation. D9-350 is the behavioral authority where internally consistent;
the explicit V1-8010A rulings in Decisions 08–13 supersede its contradictions.
D9-360 is refinement and test evidence, not self-ratifying production authority.

The implementation foundation is repository commit
`d4455bf4ee401eaa8b074603497eb9fcd6eb04a0`; V1-8000 reconciliation commit
`c988666eb35a108674508830e5555f09c28607b3` is evidence layered on that base.
Observed production is runtime evidence only and cannot silently override the
product law.

## Rejected authorities

- the current legacy Calendar-backed `#study` panel as product specification;
- `mmed_events` as Plan ownership;
- a prototype’s localStorage or mock write-back;
- D9-360 self-scores;
- appointment/Webex Scheduler source;
- MissionMed_OS `CURRENT.md` for this founder-authorized mission.

## Verification

Independent source, behavior, and boundary reviewers agreed on this hierarchy.
The product identity ledger is mandatory in every later handoff.

## Rollback consequence

Any slice that diverges from D9-300 language or an explicit V1 behavior ruling
must be reverted or re-adjudicated before it can become a release candidate.
