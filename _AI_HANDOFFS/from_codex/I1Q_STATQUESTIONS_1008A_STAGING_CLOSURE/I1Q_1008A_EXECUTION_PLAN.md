# I1Q-1008A Execution Plan

## Objective

Close the authority and infrastructure gap between the verified local candidate and a genuinely authenticated staging system, without touching production or enabling student and consumer releases.

## Gate Sequence

1. Freeze source integrity, authority, protected hashes, agent ownership, and feature-flag baseline.
2. Map the observed canonical identity chain, datastore authority, deployment topology, and protected runtime drift.
3. Specify and implement an additive I1Q identity adapter with closed role fixtures and adversarial tests.
4. Resolve the exact RANKLISTIQ preview target, project-pinned migration path, runtime role, migration role, and auditor role.
5. Reproduce static and disposable PostgreSQL proofs before any external database action.
6. Apply only to an explicitly authorized preview or staging target after the complete MR-078A checklist passes.
7. Verify schema, grants, forced RLS, role matrix, negative attacks, migration history, and drift.
8. Execute preserving rollback on preview, prove the prior checksum, reapply, and reproduce the post-application proof.
9. Integrate the existing app with canonical identity and unprivileged datastore access using synthetic content only.
10. Deploy through the canonical GitHub staging route only if the provider, workflow, secrets, rollback, and target are authoritative.
11. Run staging security, accessibility, responsive, UI/UX, performance, dependent-system, and monitoring gates.
12. Run a fresh independent red team, repair actionable findings, rerun, then build the exact combined handoff.

## Stop Conditions

- Missing canonical credentials or authorized preview target
- Missing canonical staging provider or GitHub deployment workflow
- Authority conflict that cannot be resolved from Brian, DR-006, and active contracts
- Active Git operation
- Stale Matrix runtime warning
- Unexpected migration or schema state
- Critical or high unresolved security finding
- No viable rollback
- Any need to expose a secret or environment value in files, logs, screenshots, or handoffs

## State Claims

- State A requires a canonical identity contract and authenticated role fixtures with a passing attack suite.
- State B requires actual preview application, real RLS proof, executed rollback, and successful reapplication.
- State C requires an authenticated non-localhost staging URL and every stated staging gate.
- State D is a certification plan only. Production deployment is outside this ticket.

No lower-scope local proof may be used to claim a higher state.
