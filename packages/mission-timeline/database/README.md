# Timeline database package

This directory contains the Timeline v1 PostgreSQL schema, the 413.2 and
D1-411C forward migrations, and the D1-500 single-use administrator-grant
hardening migration with rollback scripts. It is intentionally isolated from
the repository's live Supabase migration tree. D1-500 uses its own managed
PostgreSQL service and does not modify Supabase.

The migration establishes deny-by-default row-level security for student ownership, active advisor assignment, program administration, time-bound faculty grants, and narrowly scoped service principals. Matrix identity claims are expected to be translated by the trusted BFF into `sub`, `timeline_role`, `program_ids`, and `service_scopes` claims before database access.

Apply migrations in filename order, then apply role scripts in filename order.
The D1-500 production schema identity is `d1-timeline-db-500.1`. Its runtime
roles are credential-free, non-inheriting, non-BYPASSRLS group roles. Provider
login roles must be created separately and granted exactly one group role.

The disposable migration, RLS, repository, backup/restore, down, and reapply
checks under `evidence/413` remain historical evidence. D1-500 release evidence
is produced by its separately authorized production-launch mission.
