# V1 Study Schedule 8010C — Independent Review Closure

Date: 2026-07-15 UTC  
Final verdict: GO FOR SEPARATE INERT SOURCE GOVERNANCE; NO-GO FOR ACTIVATION OR DEPLOYMENT

## Review wave

- Herschel mapped the V1 Study Schedule authority, dependencies, mounts, repository evidence, and protected Matrix runtime boundary.
- Avicenna diagnosed access, rollout, actor, REST, test, and deployment risks.
- Lorentz reviewed release/store identity, physical provenance, Calendar/V1 writer boundaries, reader floors, and rollback semantics.
- Darwin received the verified findings after the first wave and reviewed the minimum safe evolution sequence.
- The supervisor independently checked every accepted finding against current bytes and exact remote test evidence.

All subagents remained read-only. The supervisor was the sole writer.

## Findings closed before governance

1. Entitlement no longer promotes an unknown actor; learner status requires explicit server role evidence.
2. Generic Calendar create/update/delete/type-transition and bulk Study paths no longer bypass the compatibility fence.
3. Store/release generations and exact release fingerprints are matched.
4. Injected physical repository provenance must match state, store ID, and generation; reversible controls cannot hide a commissioned store.
5. REST success and denial responses receive private/no-store/must-revalidate headers and vary on cookie and nonce.
6. Route registration honors the Matrix enable boundary.
7. Authorization is cached only for the exact request object.
8. Foreign script/style registrations fail closed, even when the URL exactly matches the expected asset.
9. The release fingerprint is reproducible from a checked-in content-addressed canonical manifest.
10. Canonical release identity and executable loader identity are separate.
11. JavaScript binds the current script filename to `release.asset_digest` while idempotency remains bound to canonical `release.digest`.
12. Cross-layer tests independently recompute both hashes, parse the PHP constants, and exercise mismatch behavior.

## Final severity assessment

| Severity | Unresolved inert-8010C defects |
|---|---:|
| P0 | 0 |
| P1 | 0 |

The review does not approve activation. It approves only the inert source boundary represented by commit `08e3681b6ea21f1ad65bc87db4ffae0597adc951`.

## Mandatory later gates

- Pre-provision and verify matched `never_commissioned + LEGACY_PRECUTOVER + hold + exposure=false + stop=false` controls before live C source activation. Missing controls intentionally block legacy Study writes.
- Build one database-transactional, per-owner writer arbiter shared by Calendar legacy Study and V1 Plan writers.
- Atomically couple the first V1 operation with the owner watermark.
- Prove legacy-vs-V1, V1-vs-V1, retry, crash, stale generation, owner isolation, generic bypass, and database-failure races with two sessions.
- Make commissioning monotonic and repository detection independent of reversible release configuration.
- Preserve the commissioned repository and current/N-1 reader floor after the first watermark.
- Add a server-owned production learner/mentor actor provider before exposure.
- Build a full release-candidate package manifest before RC/deployment claims.
- Keep Decision 12 HOLD until founder decisions cover cohorts, real learner data, telemetry, retention, and production launch.

## Darwin sequencing verdict

1. Freeze and remotely validate C.
2. Define the explicit production actor adapter.
3. Establish monotonic store commissioning, generation, and current/N-1 readers.
4. Implement the shared transactional per-owner writer arbiter.
5. Run the complete two-session race oracle and failure-injection matrix.
6. Prepare idempotent default-hold pre-provisioning and readback evidence without deployment.
7. Only with later deployment authority, provision controls before source activation.
8. Activate hidden/read-only first, then cut over per owner through the arbiter.
9. After any watermark, rollback only to compatible read-only; never restore the legacy writer.
