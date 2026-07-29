# B1-506A — M1 Student-Only Recording RLS Correction

Status: **AUTHORITY AMENDMENT REQUEST — NOT APPROVAL**

## Decision requested

Authorize one narrow correction to the B1-506 M1 migration.

The binding architecture requires:

- recordings and segments visible only to students;
- mentors have zero visibility;
- admins have no content access.

The supplied exact SQL contradicts those rules by calling
`sf_has_live_identity()` without a role restriction. With its default `NULL`
argument, that helper accepts any eligible live role.

Disposable PostgreSQL 18.4 reproduction on the committed candidate proved:

- mentor self-session insert/read: allowed;
- admin self-session insert/read: allowed;
- mentor self-segment insert/read: allowed;
- student-to-mentor role change: the retained recording remained readable.

## Requested authorized SQL change

Change exactly four predicates in:

`storyforge-v5/infra/postgres/migrations/20260729000100_b1_506_voice_recording_sessions.sql`

```diff
-USING (public.sf_has_live_identity() AND student_id = public.sf_actor_id())
-WITH CHECK (public.sf_has_live_identity() AND student_id = public.sf_actor_id());
+USING (public.sf_has_live_identity(ARRAY['student']) AND student_id = public.sf_actor_id())
+WITH CHECK (public.sf_has_live_identity(ARRAY['student']) AND student_id = public.sf_actor_id());

-USING (public.sf_has_live_identity() AND EXISTS (
+USING (public.sf_has_live_identity(ARRAY['student']) AND EXISTS (

-WITH CHECK (public.sf_has_live_identity() AND EXISTS (
+WITH CHECK (public.sf_has_live_identity(ARRAY['student']) AND EXISTS (
```

Do not:

- change `sf_has_live_identity()` globally;
- change table grants;
- change the `storyforge_app` service policies;
- change M2;
- add application-layer authorization as a substitute;
- redesign the schema or introduce another role abstraction.

## Required PostgreSQL 18 regression tests

Extend `storyforge-v5/tests/postgres/recording-rls.test.mjs`.

### Mentor and admin self-row denial

For both seeded `mentor` and `admin` identities:

1. Self-owned session `INSERT` rejects with SQLSTATE `42501`.
2. Service-seeded self-owned session and segment return zero rows by direct ID.
3. Direct session and segment `UPDATE` affect zero rows.
4. Segment `INSERT` against the service-seeded self session rejects with
   SQLSTATE `42501`.

### Role-change closure

Parameterize for both `mentor` and `admin`:

1. Create a session and segment as a valid student.
2. Change that same `sf_users` row to the target role using the privileged test
   connection.
3. Use matching target-role claims with the unchanged UUID and WordPress ID.
4. Direct session and segment reads return zero rows.
5. Direct updates affect zero rows.
6. New segment insertion rejects with SQLSTATE `42501`.

### Preserve existing proofs

- student owner access succeeds;
- another student sees zero rows;
- an ineligible student sees zero rows;
- `storyforge_app` retains required worker and purge access.

Authoritative local command:

```bash
STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin \
npm run test:postgres
```

The amended predicates must fail the previously successful direct probes.

## Checksums and runner pins

Independently calculated from the exact four substitutions above:

- Current M1 SHA-256:
  `b175549e4f2e1606badccdd194f25e42a11b3954f95b435e0b75ebfb52d2cc5f`
- Requested amended M1 SHA-256:
  `6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2`
- Existing M1 rollback SHA-256:
  `669f6c2404222d07217dc6cd47c1eab57c52cdc70a6af20571a85ef347f5dca5`
- M2 remains unchanged:
  `8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a`

After approval, replace the current M1 hash in all three locations in
`storyforge-v5/scripts/apply-production-migrations.sh`:

1. `expected_hashes`;
2. the first post-migration ledger `VALUES` set;
3. the reverse-comparison ledger `VALUES` set.

Update evidence hashes after successful verification. Regenerate later release
manifests and receipts from the corrected source. Never hand-edit an already
applied database ledger.

## Rollback implications

If M1 has not been applied to a protected environment, amend it in place before
release. The existing rollback remains unchanged because it drops both
recording tables and does not encode policy predicates.

If version `20260729000100` has already been applied anywhere protected:

1. Stop.
2. Do not alter its recorded checksum or rewrite migration history.
3. Issue an additive corrective migration that atomically drops and recreates
   only the two authenticated policies with student-only predicates.
4. Before correction, count recording rows whose `student_id` maps to a
   non-student role.
5. A nonzero count requires incident and retention review; do not automatically
   delete those rows.

No rollback may restore the permissive policies. Safe containment remains
feature-off/environment-kill or, with existing founder authorization and fresh
backup requirements, the complete B1-506 table rollback.

## Acceptance

Approval is implemented only when:

- all new PostgreSQL 18 denial cases pass;
- the full PostgreSQL suite passes;
- all unit tests pass;
- `git diff --check` passes;
- migration source and all runner pins equal the amended hash;
- no protected environment contains an old-hash ledger entry;
- the release-source gate accepts both policies as explicitly student-only;
- no deployment or activation occurs until every remaining B1-506 gate passes.
