# SOAP Test Report

- Full unit/contract suite: 137/137 pass.
- Focused rights-safe suite: 3/3 pass.
- Independent browser/accessibility suite: 15/15 pass.
- SOAP source reconciliation: 925 rows, 886 identities, 883 private-beta identities, 3 internal-only identities, 0 ambiguous identities.
- Production first ingest: 925 claims, 886 identities, zero spend.
- Production readback: 922 private-beta approved claims and 3 internal review-required claims.
- Forced RLS: pass across canonical evidence and Student Intel tables.
- Least-privilege live verifier: pass, including cross-subject denial and rollback.
- Provider-neutral totals: 542 runs, 3,965 claims, 886 identities, spend `0.0000`.
- Post-rollback health: 200 with prior 26-program release; protected session, catalog, and SOAP endpoints: 401 anonymous.
- Fable hash: exact expected match.

Local candidate behavior passed, but eligible live browser QA did not pass because the production WordPress SSO file lacks the reviewed RISE entitlement projection.
