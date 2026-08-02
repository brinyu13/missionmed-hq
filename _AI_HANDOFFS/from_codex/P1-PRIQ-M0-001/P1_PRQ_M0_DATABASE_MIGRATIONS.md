# Database migrations

Candidate order: `infra/priq/migrations/20260802095500_priq_foundation.sql`.

It creates an isolated `priq` schema with subjects, memberships, sources, evidence-bound claims, feature flags, model runs, and append-only audit events. RLS is enabled on every table; policies are tenant/role scoped and contain no `USING (true)`. The migration was not applied because no canonical PRIQ Supabase project or `MIR_DATABASE_URL` was authorized.
