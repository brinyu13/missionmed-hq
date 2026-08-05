# B1-511 Submission and Review Workflow

## State machine

Student stories remain private by default. A student must explicitly submit a
story before any authorized reviewer can discover it. The additive workflow is:

`private -> awaiting -> in_review -> changes/reviewed/approved`

The owning student may withdraw eligible submitted work back to `private` or
resubmit after changes. All mutations are row-version checked, server enforced,
and append audited. Direct-ID reads obey the same privacy boundary as lists.

## Ownership and visibility

- Students may mutate only their own stories.
- Reviewers see only explicit submissions; private and archived stories are
  absent from search, queue, and direct-ID reads.
- Student-visible feedback and internal administrator notes are separate.
- Internal notes never appear in a student or mentor projection.
- Student priority and mentor/admin score remain different fields and powers.

## Evidence

The lifecycle is implemented by
`storyforge-v5/infra/postgres/migrations/20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql`,
`storyforge-v5/server/admin-console.mjs`, `storyforge-v5/server/app.mjs`, and the
sole renderer `storyforge-v5/public/app.js`.

Automated proof includes 17/17 PostgreSQL runtime/integration tests, 130/130
acceptance tests, and the B1-511 E2E lifecycle test covering submission,
reviewer visibility, published feedback, withdrawal, and cross-user denial.
Production remains at the controlled canary boundary because exercising a real
student submission would mutate that student's private record without explicit
canary consent.
