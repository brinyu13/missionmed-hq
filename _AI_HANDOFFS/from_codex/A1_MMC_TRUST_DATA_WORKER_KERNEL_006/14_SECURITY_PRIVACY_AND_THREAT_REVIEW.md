# 14 Security, Privacy, and Threat Review

RESULT: `LOCAL_TRUST_BOUNDARIES_RED_TEAMED_PRODUCTION_UNAUTHORIZED`

## Threats exercised and controls

| Threat | Settled control/proof |
| --- | --- |
| Cross-tenant/environment access | Derived scoped principals, composite durable keys/FKs, forced RLS design, and same-ID multi-tenant tests |
| Shared-auth role escalation | Genuine string administrator roles only become CAM v2 admin; non-string roles are ignored, `hq_operator`/`operator` remain operator, and worker capabilities are workload-only |
| Caller-authored/coerced authority | Exact payload schemas reject tenant, environment, role, assignment, workload, queue, and protected lineage fields; principal/queue/CSRF values require actual strings |
| Identifier/parser drift | Gateway/command/job share RFC 9562 parsing; identity/policy/evidence use strict typed fields; uppercase v7 canonicalizes, v9 fails, and numeric/string coercion is rejected |
| Authority revoked during async work | Command, evidence review, asset revoke, and job transitions recheck literal-true authority immediately before commit |
| Arbitrary subject promotion | Server-owned anchor binding; 5,000 adversarial negative pairs with zero false promotions |
| LIVE automatic identity promotion | Always fails closed until signed, durable, replay-verifiable evaluation authority exists |
| Stale worker overwrite | Immutable provider-key digest, dispatch intent, exact queue/workload, lease generation fencing |
| Ambiguous provider return | Result is append-once quarantined evidence; expired/revoked outcome requires authorized adjudication; blind retry denied |
| Provider double effect | Proven-idempotency retry rule and exact-generation reconciliation; stable key survives generation history |
| Duplicate command/effect | Semantic command receipt, scoped IDs, transactional outbox/inbox, exact-effect binding, atomic effect/receipt/delivery |
| Outbox cross-tenant starvation/rebinding | Tenant/environment/queue cursor; server-bound effect/aggregate; caller-selected consumer identity rejected |
| Audit rewriting | Tenant/environment-scoped hash-chain validation in local kernels; append-only chained durable audit design |
| Evidence laundering | Exact UTF-8 spans, factual equality, separate human judgment, recursive revocation/reassessment; AI proposals never auto-operational |
| Student privacy leak | Separate exact projection, persisted approval/source/predecessor/current-head proof, byte-equivalent preview/readback, DLP |
| Former mentor access | Current assignment required for preview/new approval; revocation denies mentor operation |
| Student loss after assignment end | Historical-at-approval entitlement preserves exact already-published student read/respond; identity/publication revocation still denies |
| Fixture/live confusion | Exact `FIXTURE`/`LOCAL`/`STAGING`/`LIVE` binding and LIVE memory denial |
| Caller-forged security time | Identity, asset, publication, and cutover checks use server-owned/injected clocks; caller time is rejected or ignored |
| Timestamp parser drift | Shared state/command/asset/publication/identity RFC 3339 validation rejects calendar rollover/impossible dates and offsets beyond `14:00`; publication preserves 1–9 fractional digits and identity preserves canonical milliseconds |
| Legacy route bypass | Operational dependencies removed; auth/CSRF then `410`; historical private mount sealed with strict CSP |
| Encoded-path/private-static bypass | One strict pathname decode occurs before every route/static decision; malformed escapes, NUL, backslash, and decoded `.`/`..` segments fail with `400`; a 12,288-case independent fuzz found zero private-path bypasses |
| Webex token/path/root escape | Dedicated config, exact origin, redirect denial, bounded streams, safe errors, fixture-root realpath/inode checks, symlink rejection |

## Privacy and student-safety law

Mentor-private evidence, uncertainty, operational notes, reviewer data, provider metadata, and paths do not enter student bytes merely because they are useful internally. Publication admits only exact reviewed, normal-sensitivity, publication-candidate sources. A student response is authored by the exact student and cannot assert mentor verification or silently complete a canonical task. A `NOT_MET` milestone cannot be cosmetically rewritten.

The student-response boundary remains intentionally narrow: local schema version 1, first-version records only, no supersession, no durable handler/RPC/route. It is not described as a released agency workflow.

## Secret and diagnostic boundary

No env value, token, key, cookie, provider body, credential file, native asset path, or raw media is copied into the implementation reports. Public HTTP errors use one bounded nested envelope; credential/path-shaped text is rejected or redacted. Disposable PostgreSQL tests use synthetic local claims and data only. A final diff secret/path scan remains a mandatory pre-commit gate.

The encoded-path finding is closed for the scoped shared-server implementation: canonical-path unit cases and the independent fuzz both passed, and the post-fix scoped validator run was 19/19 green. This is local source/runtime validation, not a deployment claim.

## Residual security gates

- LIVE identity automation requires an independently signed evaluation artifact, durable nonce/replay store, and approved policy activation.
- Durable adapters must derive every principal/assignment/source/grant join from the database rather than trusting DTO attestations.
- Student response append/supersession needs an exact optimistic-concurrency RPC before the student feature plane can enable.
- Worker supervision needs reconciliation alerts, dead-letter review, and provider/retention runbooks before any external call.
- The additive migration must be reviewed/applied to isolated staging under the migration protocol before release; local proof is not production evidence.

## Alternatives, rollback, and production statement

Weak alternatives—service-role browser access, direct table mutation, unrestricted provider retry, arbitrary publication JSON, v1 fallback writes, and operator/admin capability inheritance—were rejected. The cost is more explicit adapters, durable joins, and operational review; the benefit is inspectable authority and recoverable ambiguity.

Rollback before any acknowledged external v2 write is commit/feature-plane scoped. After a write, preserve audit/evidence and forward-repair. No production deployment, configured-environment migration apply/database mutation, provider activation, credential creation, auth weakening, or RLS bypass was authorized or performed. The disposable local PostgreSQL apply/reapply/rollback proof used synthetic data and is not an external write plane.
