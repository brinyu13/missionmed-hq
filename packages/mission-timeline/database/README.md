# Timeline database package

This directory contains the proposed D1 Timeline v1 PostgreSQL schema, the forward 413.2 hardening migration, and their rollback scripts. It is intentionally isolated from the repository's live Supabase migration tree. The migration chain has been applied only to disposable local PostgreSQL databases with synthetic fixtures; it has not been applied to Supabase, private staging, or production.

The migration establishes deny-by-default row-level security for student ownership, active advisor assignment, program administration, time-bound faculty grants, and narrowly scoped service principals. Matrix identity claims are expected to be translated by the trusted BFF into `sub`, `timeline_role`, `program_ids`, and `service_scopes` claims before database access.

The disposable migration, RLS, repository, backup/restore, down, and reapply checks are recorded under `evidence/413`. Promotion still requires managed-staging credentials, operational ownership, security review in that environment, and an explicit deployment prompt.
