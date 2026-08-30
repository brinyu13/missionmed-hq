# SOAP Test Report

- Full unit/contract: 137/137 pass.
- Browser/accessibility: 15/15 pass.
- SOAP source reconciliation: 925 rows, 886 IDs, 883 exact, 3 internal-only, 39 extra track rows.
- PostgreSQL first ingest: 925 claims, 886 identities, zero spend.
- Exact replay: 0 duplicate claims.
- RLS: 922 beta claims and 883 identities visible; three claims and identities remain admin-only.
- Hostile insert: denied.
- PostgreSQL 18 restored production preimage: 006/007, 925 SOAP claims, 886 identities, all 3,040 research claims, RLS, and recovery passed at zero spend.
- Fable hash: exact expected match.
- Prohibited wording scan: pass.

Screenshots are under `artifacts/browser/`.
