# MX-MISSIONACCOUNTS-5403B MR-078A migration-integrity correction

## Failure corrected

Fresh independent verification of PR 28 head `579b03860005605305ebabd1e9d8c1bfc717b5f1` failed because migration `20260911224524_autobilling_contract_closeout_5403b.sql` lacked the required MR-078A header and explicit transaction wrapper.

## Narrow authority

DR-238 was filed at MissionMed OS commit `43d41a3bb93a01f2113e5cb4d8d5e881cdff6ae1`, decision SHA-256 `b73d0a7d98da39aa436d5ad5daf8d2f8b9b671922fec1fa3559f65b196025a52`. It authorizes replacement of only this committed-but-unapplied migration at the same timestamp and ordering position. It does not relax MR-078A generally.

Provider-native readback on 2026-09-12 confirmed production migration history ends at `20260911132835`; version `20260911224524` is absent, `program_enrollment_projection` is absent, and `auto_charge_dispatch.eligible_after` is absent.

## Correction

Corrective source commit: `3955c28edf53595f5e0cc1f300f419954033e6b0`.

- Added the complete MR-078A header with authority DR-238.
- Preserved timestamp `20260911224524` and dependency `20260911131140_sponsor_control.sql`.
- Declared `Idempotent: NO` based on the existing create-only statements.
- Added explicit top-level `BEGIN;` and `COMMIT;`.
- Found no transaction-incompatible statement or nested transaction.
- Changed no substantive schema, authorization, billing, queue, sponsor, cutoff, or dispatch behavior.

## Atomicity and replay

The disposable PostgreSQL rehearsal now applies every prerequisite migration except the inherited production-data-specific Antonio promotion, then:

1. injects a forced failure immediately after the first 5403B schema statement;
2. proves the prior statement did not persist;
3. applies the unchanged migration body normally;
4. proves a replay fails as declared non-idempotent without corrupting the applied state;
5. runs the established enrollment, consent, queue, cutoff, RLS, grant, and dispatch-disabled assertions.

Result: PASS.

## Builder validation

- `npm test`: 206 passed, 0 failed.
- `npm run validate:source`: PASS.
- Mandatory vectors: 45 passed, 0 failed.
- Dedicated PostgreSQL rehearsal and forced-failure rollback: PASS.
- MR-078A header/wrapper and incompatible-statement assertions: PASS.
- `git diff --check`, shell syntax, and evidence JSON: PASS.

Production mutation: NONE. Deployment: NONE. Stripe calls, PaymentIntents, charges, and invoices: NONE. Live dispatch: OFF. Historical revival: NONE. Money moved: $0.00.

Fresh independent verification is required on the final pushed PR head.
