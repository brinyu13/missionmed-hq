# Y2-3101 Contracts and Schemas

## Contract Set

Eight JSON schemas and runtime validators describe the Phase 0 boundary:

1. `persona-pack.schema.json`
2. `interview-plan.schema.json`
3. `grounding-ref.schema.json`
4. `brain-event-envelope.schema.json`
5. `session-ledger-revision.schema.json`
6. `interviewer-turn-decision.schema.json`
7. `model-adapter.schema.json`
8. `inactive-capabilities.schema.json`

The source of runtime authority is `interviewer-brain/src/contracts.mjs`; JSON schemas are documentation artifacts only. The amended-prompt audit found they are not yet executable parity contracts.

## Version Vocabulary

| Contract | Version |
|---|---|
| Persona | `missionmed.interviewer-persona.v1` |
| Plan | `missionmed.interview-plan.v1` |
| Grounding | `missionmed.grounding-ref.v1` |
| Event | `missionmed.brain-event-envelope.v1` |
| Ledger revision | `missionmed.session-ledger-revision.v1` |
| Turn decision | `missionmed.interviewer-turn-decision.v1` |
| Model adapter | `missionmed.model-adapter.v1` |
| File ledger | `missionmed.file-session-ledger.v1` |

Unknown fields and unsupported major versions fail closed. Canonical SHA-256 hashes bind content-bearing assets and revisions.

## Field Authority

- Persona and plan assets are immutable inputs.
- The Brain derives decision IDs, event order, hashes, policy/model references, actor, timestamp, and provenance.
- The model adapter supplies bounded analysis only; it cannot commit state.
- The policy supplies one validated move and rationale tags; it cannot bypass grounding resolution.
- The ledger owns idempotency, expected revision, event/revision chain, and durable commit.
- Voice and avatar descriptors are inactive, provider-null, and reject writes.

## Decision Contract

Each interviewer decision includes:

- decision/session/turn identity;
- one allowlisted move;
- public interviewer utterance;
- grounding IDs;
- policy rule;
- probe index and cap;
- active thread;
- unresolved and possible-inconsistency references;
- structured guard outcomes;
- uncertainty class;
- concise rationale tags;
- canonical content hash.

Private free-form reasoning, scores, rankings, emotion, personality, deception, readiness, program-fit, Match, and clinical conclusions are excluded.

## Event and Ledger Integrity

- Event payload and full event hashes are verified.
- `previous_event_hash` creates an ordered event chain.
- `previous_revision_hash` creates an ordered state chain.
- Event sequence and ledger revision are monotonic.
- Reopen validates the full chain before returning state.
- Duplicate idempotency key with different payload fails.
- Stale expected revision and stale disk writer fail.

## Compatibility Limits

These are Phase 0 synthetic contracts. They do not replace CIE timeline items, Y1 CAM sessions, consent receipts, media revisions, review grants, deletion jobs, or production audit events. A later adapter must translate them into accepted Y1/CIE contracts without granting these local IDs authority.

## Amended-Prompt Contract Audit

The current package is not contract-ready for substitution or integration:

- the decision JSON schema permits `PASS|BLOCKED`, while the runtime permits `PASS|ABSTAIN`;
- nested ledger JSON schema records are largely untyped, and tests parse schemas without validating runtime instances against them;
- the model descriptor accepts only `deterministic_rule`, provider-null operation and has no validated `ModelAnalysisV1` output contract;
- session-start idempotency binds persona, plan and first question but omits policy and model references;
- turn execution can use current policy/model components while recording prior ledger references;
- Y2 wall-clock events lack CIE's segmented monotonic clock, ranges, consent/visibility revisions and Ladder provenance.

These are P1 research prerequisites for `Y2-3103`. No direct Y1/CIE mount is permitted.
