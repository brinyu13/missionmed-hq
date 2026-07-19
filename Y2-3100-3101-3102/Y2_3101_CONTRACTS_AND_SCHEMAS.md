# Y2-3101 Contracts and Schemas

## Contract Set

Eight JSON schemas and matching runtime validators define the Phase 0 boundary:

1. `persona-pack.schema.json`
2. `interview-plan.schema.json`
3. `grounding-ref.schema.json`
4. `brain-event-envelope.schema.json`
5. `session-ledger-revision.schema.json`
6. `interviewer-turn-decision.schema.json`
7. `model-adapter.schema.json`
8. `inactive-capabilities.schema.json`

The source of runtime authority is `interviewer-brain/src/contracts.mjs`; JSON schemas are interoperable documentation and static validation artifacts.

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
