# Security Validation

- Unit/contract: 137/137 pass.
- Browser/accessibility: 15/15 pass.
- HQ auth: 1/1 pass locally.
- PHP syntax: pass.
- PostgreSQL first SOAP ingest: 925 claims, 886 identities, zero spend.
- SOAP replay: 0 duplicate claims; replay count incremented.
- Non-admin RLS readback: 922 beta claims and 883 beta identities.
- Admin-only tail: 3 review-required claims and 3 review-required identities.
- Hostile non-admin source insert: denied.
- Provider-neutral replay: 541 replayed runs and 0 new claims.
- Fable source SHA-256: `1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987`.
- Client bundle contains no provider credentials; the only token reference is the runtime CSRF field.
- New Parallel spend: $0; reserved tranche untouched.

Production security review remains pending because DR-146 requires an independent database/security review for migration 007.

