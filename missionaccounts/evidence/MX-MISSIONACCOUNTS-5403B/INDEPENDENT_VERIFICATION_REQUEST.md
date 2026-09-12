# MX-MISSIONACCOUNTS-5403B independent verification request

Review only. Do not deploy, migrate production, change WordPress, alter Railway variables, publish billing terms, or contact Stripe.

DR-233 requires the builder and acceptance verifier to be distinct sessions. Review the current head of GitHub draft PR 28 against base `031a9e812de3575d225de0064cc4be209d86b72b`. Confirm the current PR head before testing. The original implementation commit is `a5ab97b53801202a682749b47a44c7d3fdbc5fcc`; the enrollment canonical-subject corrective source commit is `ea5c4176b7429873e558c7b9abd814b184470786`; and the consent canonical-subject corrective source commit is `d2d2ede1eae7190dd47f31fbf8374d479f4b21aa`.

The prior independent review of head `8e2860077a4fb8a21ba33f4f0fae60441af4c404` failed because `api_sync_program_enrollment` compared the authenticated canonical student UUID to the optional legacy `matrix_user_ref`. The corrective commit binds `p_student_id`, `p_actor_id`, and `p_source_subject` to `student.id`, updates PreviewStore so it cannot mask the production architecture, and adds explicit NULL-ref, numeric-ref, cross-student, subject-mismatch, and inactive-course-access regressions.

The next independent review of head `120ec6e147e59839d16aaff6cbbaa8e46fc244f3` failed because `api_set_billing_consent` still compared the canonical actor UUID to optional legacy `matrix_user_ref`. Commit `d2d2ede1eae7190dd47f31fbf8374d479f4b21aa` binds consent grant and revoke authorization to `student.id::text = p_actor_id`. Its disposable PostgreSQL regressions cover grant and revoke with NULL and numeric legacy refs, cross-student grant and revoke, the existing source-subject mismatch case, and a forged actor matching only the legacy ref.

Verify the change is confined to `missionaccounts/` and satisfies DR-232/DR-233:

- LearnDash course 6357 remains canonical; registration alone is insufficient.
- Signed enrollment projection is subject-bound, current, private, and fail-closed at shadow, claim, and final preparation.
- Student consent is independent from live dispatch, self-only, explicit, auditable, separately revocable, and requires DIRECT sponsorship, current enrollment, an on-file method, and exact approved terms text/hash.
- The migration does not insert or approve billing terms.
- The durable queue has a 24-hour minimum hold and no automatic 48-hour expiry.
- Historical and pre-rollout days cannot be revived through recomputation.
- Final preparation rechecks the exact Dr J-approved day, remaining approved amount, prior charge, valid receipt email, stable idempotency, service-worker authority, sponsorship, enrollment, consent, terms, and the database dispatch flag.
- Both the Railway feature flag and database contract must be enabled before any automatic provider action; defaults remain off.
- UCC/MUL, unresolved identities, grace, comp, no-charge, missing-method, missing-consent, stale enrollment, prior-paid, and held/review states fail closed.
- No Stripe request, PaymentIntent, hosted invoice, enrollment mutation, public grant, destructive DDL, or RLS weakening occurs in this closeout.
- Manual Dr J charging, payment-method setup, Zoom, privacy, and route behavior retain their regression coverage.

Run:

```bash
cd /path/to/missionmed-hq/missionaccounts
npm test
npm run validate:source
node --test tests/mandatory-vectors.test.mjs
```

Rehearse the new migration on disposable PostgreSQL using all schema migrations except the production-data-specific Antonio promotion migration `20260909105200_promote_antonio_real_student.sql`. Confirm the new migration applies and the functional result is equivalent to:

```bash
scripts/test-5403b-postgres-rehearsal.sh
```

```text
program enrollment rows = 1
pending durable candidates = 1
pre-rollout candidates revived = 0
charge rows = 0
consent after eligibility loss = revoked
live dispatch = false
```

Inspect the sanitized evidence in `missionaccounts/evidence/MX-MISSIONACCOUNTS-5403B/`.

Return exactly one of:

- `INDEPENDENT VERIFICATION: PASS` with reviewed commit, test counts, migration/security findings, and any non-blocking limits.
- `INDEPENDENT VERIFICATION: FAIL` with exact blocking file/line and reason.

Do not treat registration or builder tests alone as independent acceptance.
