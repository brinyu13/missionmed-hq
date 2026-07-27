# B1-500 Stage 1 — Foundation Evidence

**Outcome:** `PASS AS ISOLATED CANDIDATE / NOT PRODUCTION-APPLIED`

## Implemented

- Purpose-bound JWT verification with issuer, audience, expiration, signature, UUID subject, actor role, and `storyforge_eligible` enforcement.
- Local signed fixture identities only when explicitly enabled and bound to loopback.
- Real PostgreSQL schema for:
  - users and many-to-many active mentor assignments;
  - stories, immutable originals, durable revisions, feedback, private audio metadata;
  - transaction-bound notifications and append-only audit events;
  - questions, story-question pair strengths, workshops, next-natural questions;
  - import batches/rows and AI provenance records.
- PostgreSQL RLS for student-self, student-other, assigned mentor, unassigned mentor, admin, and anonymous.
- Security-definer state transitions with direct client DML revoked.
- Student create/edit/submit/resubmit, mentor open/review/approve, notification-read, workshop, manual question, import commit/rollback, and audio-metadata RPCs.
- Narrow co-assignment helpers so mentor attribution is visible without broadening story access.

## Real PostgreSQL evidence

Command:

```sh
bash scripts/run-postgres-tests.sh
```

Final result: `STORYFORGE_POSTGRES_SUITE_PASS`.

The suite executed 29 named assertions against an ephemeral PostgreSQL 16 server, including:

- student-self reads private;
- student-other, assigned mentor, unassigned mentor, and admin all receive zero private rows by direct ID;
- anonymous has no table privilege;
- revoked/missing eligibility closes reads and creates;
- authenticated clients have no direct story update privilege;
- immutable original differs from later current text and revisions persist;
- assigned-only visibility after submission;
- unassigned crafted review RPC denied;
- notification and mentor mutation commit together;
- revise/resubmit/approve state sequence;
- two distinct mentor actors and co-mentor display attribution;
- separate student/mentor workshop strengths;
- draft-first import, exact duplicate flag, retire-on-rollback;
- append-only audit and multi-actor history.

## JWT/parser/unit evidence

Command:

```sh
npm test
```

Final result: seven passed, zero failed.

- Valid signed eligible token accepted.
- Expired token rejected.
- Forged signature rejected.
- Missing eligibility and forged service role rejected.
- Paste duplicate/near-duplicate/formula/empty-row checks pass.
- Valid XLSX parsing passes.
- Unsupported format and row limits fail closed.

## Not production-applied

The migration remains in `storyforge-v5/infra/postgres/migrations`, not root `supabase/migrations`, because the StoryForge project ref, migration history, PITR/backup state, and credentials are unresolved.
