# Partner Cost Sharing candidate

Mission PARTNER-COST-SHARING-20261004. Exactly Brian, Dr J and Phil are business partners. Existing worktree/branch is retained; neighboring product logic is unchanged. This is an isolated candidate, not a production acceptance report.

Native prototype: http://127.0.0.1:4184/missionaccounts/#/partner-costs/overview. Run node scripts/partner-cost-sharing-preview.mjs locally. Loopback only; synthetic role lenses, disposable in-memory journal, zero provider calls. Recovered original invoices remain outside Git and public directories. Historical balances default UNKNOWN.

Implemented: six native routes; private membership-bound API and own projections; exact integer allocation; reviewed expenses and certified periods; immutable evidence/audit/payment history; canonical partial/full completion; explicit signed credit/debit applications; monthly/annual statements, CSV, print/PDF and hash-checked invoice ZIP; private evidence custodian; shadow vendor/Gmail/AI proposal worker; disabled partner Stripe setup/method/consent/dispatch/webhook adapters. AI never posts liability or verifies payment. Provider setup/collection is intentionally not exposed as an active user action.

Validation: npm test 307/307 PASS (271 existing plus 36 partner tests); isolated PostgreSQL 16.13 rehearsal 49/49 PASS. Supabase production is PostgreSQL17; repeat exact migration rehearsal on17 before production application. No production migration has been applied. Browser role lenses are UX fixtures; HTTP tests separately exercise bound principals and server authorization.

See DONOR_PROVENANCE.md, RECONCILIATION.md, DEPLOYMENT.md, BLOCKER_LEDGER.md and FABLE_5_1_UX_PACKET.md. Preserve all financial history when disabling this module.
