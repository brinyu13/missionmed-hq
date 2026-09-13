# 5403B consent canonical-subject correction

## Failure corrected

Fresh independent verification failed PR 28 head `120ec6e147e59839d16aaff6cbbaa8e46fc244f3` because `api_set_billing_consent` required the authenticated canonical student UUID to equal optional legacy `matrix_user_ref`. That rejected genuine self-service when the legacy field was NULL or numeric.

## Source correction

Corrective source commit: `d2d2ede1eae7190dd47f31fbf8374d479f4b21aa`.

Consent authorization and revocation now require a verified student whose `student.id::text` equals `p_actor_id`. The change removes `matrix_user_ref` as consent authority while preserving student role, target student, prerequisite, idempotency, audit, and service-role RPC gates.

## Disposable PostgreSQL regressions

- Grant with NULL legacy ref: PASS
- Grant with numeric legacy ref: PASS
- Revoke with NULL legacy ref: PASS
- Revoke with numeric legacy ref: PASS
- Student A grant for Student B: blocked
- Student A revoke for Student B: blocked
- Enrollment source-subject/actor mismatch: blocked
- Actor matching only a numeric legacy ref: blocked

The full rehearsal applied every schema migration except the production-data-specific Antonio promotion migration. Result: one enrollment row, one pending durable candidate, zero pre-rollout candidates revived, zero charge rows, consent revoked after enrollment loss, live dispatch false, forced RLS true, authenticated RPC execution revoked, and service-role execution granted.

## Bounded same-class audit

- `api_sync_program_enrollment`: canonical `student.id` actor binding plus exact source-subject equality; corrected in REVFIX-01.
- `api_set_billing_consent`: canonical `student.id` actor binding; corrected in this pass.
- `SupabaseRestStore.studentByMatrixUser`: historical method name; production lookup is by `student.id`.
- `PreviewStore.studentByMatrixUser`, `syncProgramEnrollment`, and `setBillingConsent`: canonical `student.id` comparisons.
- Remaining `matrix_user_ref` occurrences in the changed files are legacy linkage metadata, sanitization, fixtures, or assertions for older migrations. Production student-owned RPCs are superseded by `20260909095640_align_student_write_identity_guards.sql`, which binds them to `student.id`. No additional 5403B consent/enrollment/queue defect was found.

## Validation and safety

- `npm test`: 206 passed, 0 failed
- `npm run validate:source`: PASS
- mandatory vectors: 45 passed, 0 failed
- disposable PostgreSQL rehearsal: PASS
- production mutation: NONE
- production deployment: NONE
- Stripe provider calls / PaymentIntents / charges: 0
- live dispatch: OFF
- historical revival: NONE

The current PR head must be confirmed from GitHub after the evidence-only commit is pushed. Fresh independent verification must review that final head; this builder evidence is not independent acceptance.
