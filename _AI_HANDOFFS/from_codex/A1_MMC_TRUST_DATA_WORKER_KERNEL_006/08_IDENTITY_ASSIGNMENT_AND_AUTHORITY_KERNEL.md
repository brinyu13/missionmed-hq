# 08 Identity, Assignment, and Authority Kernel

RESULT: `IDENTITY_PROMOTION_FAILS_CLOSED`

## Identity states

The attested identity kernel uses explicit states: `UNVERIFIED`, `PROBABLE`, `MANUAL_REVIEW`, `CONFLICT`, `VERIFIED_LOCAL_LINK`, and `REVOKED`. Evidence is signed, time-bound, issuer/audience bound, replay protected, and key-rotation aware. Signed timestamps use the shared strict RFC 3339 calendar proof and retain the identity envelope's canonical millisecond encoding. Identifier/nonce fields require strings and bounded configuration values require their declared numeric type; numeric and numeric-string coercion fail closed. Verification and resolution are factory closures over server-owned clocks; caller requests cannot supply security time or revive expired evidence with a forged old timestamp.

## Promotion rule

Matching identifiers alone cannot choose an arbitrary subject. Server-owned `subjectAnchorBindings` must bind tenant/environment/subject to the exact anchor type and digest. Without that binding, even exact evidence remains manual review. Conflicting anchors become `CONFLICT`; revocation is durable.

Automatic promotion is permitted only in explicitly configured non-LIVE environments after two independent attested source families match the exact server-owned anchor. `LIVE` automatic promotion is unconditionally rejected with `IDENTITY_LIVE_SIGNED_EVALUATION_REQUIRED`; caller-supplied evaluation metadata cannot enable it. A future LIVE path requires a signed, durable, replay-verifiable evaluation authority and policy activation.

## Isolation

Fixture/live, tenant, environment, and subject are independent bindings. Cross-scope lookups fail as not found. Five thousand deterministic adversarial negative pairs produced zero false automatic promotions, including an arbitrary-subject attack.

## Principal and assignment authority

Derived principals bind source and configured identity, tenant, environment, role, subject, assignment, workload, and queue. Principal identifiers and worker queue names require actual strings; numeric coercion fails closed. Role ceilings separate mentor review/publication, operator trust operations, student publication/response, worker claim/complete/inbox/analysis, and admin queueing. Authority is rechecked at every sensitive operation; cached DTO fields never substitute for persisted assignment or grant state.

## Publication lifecycle nuance

An active mentor assignment is required for preview/new approval. If the assignment expires or is revoked after approval, the former mentor loses preview authority, but the exact student retains an already-published immutable projection and response agency. This follows student entitlement rather than silently punishing the student for a later mentor-assignment change.

## SQL structural binding

The migration uses composite tenant/environment/assignment/subject/mentor keys so canonical rows cannot mix assignment A with subject B or mentor C. Final database proof is recorded in report 04.
