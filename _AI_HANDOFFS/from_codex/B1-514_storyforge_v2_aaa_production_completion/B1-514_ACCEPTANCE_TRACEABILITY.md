# B1-514 Production Acceptance Traceability

This document maps the Founder-approved B1-513R2 61-probe prototype contract to production-owned executable evidence. Prototype probes remain product-contract evidence; production tests establish the real API, PostgreSQL, RLS, storage, gateway, and sole-renderer implementation.

| Authority group | Production evidence | Status |
| --- | --- | --- |
| Cross-student, unassigned mentor, admin-private, anonymous, ineligible, and direct-ID denial | `tests/postgres/authorization_matrix.sql`, `b1-514-v2-domains-rls.test.mjs`, `b1-514-r1-visibility-activity.test.mjs`, `b1-514-guest-voice.test.mjs` | PASS |
| Consent, private-safe history, new-story default, per-story override, submission independence | R1 PostgreSQL test plus `B1-514-E2E-01` | PASS |
| Purposeful versions, immutable history, append/retell/restore, typed/voice provenance | `b1-514-v2-domains-rls.test.mjs`, `b1-514-v21-authored-segments.test.mjs`, version unit suites, `B1-514-E2E-02` | PASS |
| Inspiration active-only, answered state, saved/favorite/pin order, List/Grid persistence, recommendations | Inspiration unit/PG suites, admin Content Studio contracts, `B1-514-E2E-01/02` | PASS |
| RT-A retired prompt denial and RT-B server-owned bulk IDs/retired-only import | Inspiration service/admin unit suites and V2 domain PostgreSQL suite | PASS |
| Request draft, truthful preview, send reservation, lifecycle monotonicity, cap, revoke/expiry/bounce/complaint | Request lifecycle/delivery unit and PostgreSQL suites, `B1-514-E2E-03` | PASS locally; live provider canary pending |
| Guest token scope, bounded text/voice, original audio, cleanup, promotion-private | Request/guest voice unit and PostgreSQL suites, signed gateway route tests, `B1-514-E2E-03` | PASS locally |
| Postmark no-resend ambiguity, metadata reconciliation, custom-header ingress | delivery-attempt unit/PG suites and WordPress functional HMAC test | PASS locally; provider configuration/canary pending |
| Admin scale, filters, paging cap, saved views, review check, same-room review | admin scale/service tests and frontend contract tests | PASS locally |
| Mentor transcript plus original voice, private internal note separation | B1-511 unit/PG/E2E plus `B1-514-E2E-04` | PASS |
| Dark/Light/Auto, text sizes, energetic environments, reduced motion | B1-512 settings E2E, conformance suite, `B1-514-E2E-05` | PASS |
| One renderer, Matrix bootstrap, signed identity, first name, LearnDash eligibility, admin mode | frontend source-contract tests, auth tests, full E2E, existing WordPress integration suite | PASS except external container rerun pending |
| V1 zero-loss across additive V2 migration | sealed PG18 PRE/POST comparator with R2 HEAD | PASS, zero differences |
| Release integrity, immutable assets, rollback topology | deterministic release/provenance, Kinsta installer/rollback unit gates, Critical Systems | PASS locally; fresh remote recovery points pending |

## External acceptance not converted into a local pass

- A healthy-container execution of `npm run test:integration` against the real WordPress/PHP gateway image.
- Verified Postmark sender, Reply-To, server token, custom webhook header, and one controlled non-private lifecycle canary.
- Fresh Railway and Kinsta recovery points immediately before cutover.
- Authenticated live Founder/admin/student/mentor/guest canary ladder after default-off deployment.
