# Y1-CIE-C0-0001 Opportunity and Priority

## Manual Opportunity

C0 has one active write capability: `mentor_manual_opportunity`. The contract requires:

- verified mentor author;
- exact active grant to a covering student Moment;
- one replayable single-segment range;
- immutable skill snapshot from the session owner;
- membership in the current priority set;
- L1 replay evidence and a distinct nonnumeric L3 human interpretation;
- synthetic/simulation provenance where applicable;
- idempotent creation and canonical hash;
- `student_visible: false` in C0.
- visible only to the authoring mentor while that mentor retains exact live authority to the source Moment.

Student-authored, AI-authored, transcript-derived, cardless, out-of-priority, numeric, cross-mentor, or unsupported Opportunity reads/writes are rejected without disclosing or creating an artifact.

## Atomic 1+1 Priority

The active set contains exactly:

- one Spotlight snapshot with lifecycle `ACTIVE_SPOTLIGHT`;
- one distinct Supporting snapshot with lifecycle `CONSOLIDATING`.

Both snapshots are immutable, owner-scoped, content-addressed, and sourced from the complete 32-field card contract. Activation writes one versioned priority track and one CAS-protected priority projection in one transaction. A stale row version returns conflict without overwrite.

## C1 and C2 Boundary

C0 can import a verified published snapshot or a signed synthetic fixture for tests. It does not implement WordPress skill-library publishing, library/admin UX, Replay Studio, Mentor Tray, longitudinal analysis, or learner Opportunity projection. Those remain future tickets.
