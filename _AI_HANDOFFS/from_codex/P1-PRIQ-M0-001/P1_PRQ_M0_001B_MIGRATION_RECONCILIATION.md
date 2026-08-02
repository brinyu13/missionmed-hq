# P1-PRIQ-M0-001B migration reconciliation

## Decision

No migration was applied. The single proposed sequence is `infra/priq/migrations/20260802095500_priq_foundation.sql`, SHA-256 `706ad56ac63a43da322420c795ed82d8cb8e79da20d3b544f2cdf9df0e14c5e0`. Its location explicitly marks it as provisional until a canonical PRIQ database/auth authority is chosen.

## Comparison

The removed competing candidate was `supabase/migrations/20260802090000_priq_m0_foundation.sql`, SHA-256 `558caba9f464aba22bb708fda81747742c117424721425f37b8e7b28b807a138`. It targeted shared `public` tables and included student/coach policies, but multiple staff/coach policies lacked tenant predicates. It also conflicted with the absence of a canonical Supabase target.

The retained proposal uses an isolated `priq` schema, tenant predicates, role constraints, evidence-bound claims, feature flags, model runs, and append-only audit permissions. It does not assert that production auth/storage exists.

## Recommendation

Founder must choose the canonical database project, auth/JWT tenant claim, storage project/bucket, service ownership, backup/restore procedure, and migration runner before this proposal is moved into an executable migration path. Then an independent database/security review must reconcile student publication reads and service-role writes.

## Rollback analysis

Because neither candidate was applied, rollback is currently source-only: revert the reconciliation commit. If a future approved migration is applied, rollback must be a reviewed down migration after traffic disablement and audit export; never drop tables or audit rows ad hoc.

## Approval gate

BLOCKED: do not apply, move into `supabase/migrations`, or connect a shared database without a separate founder-approved database ticket.
