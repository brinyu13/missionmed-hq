# V1-8010A Decision 07 — Authentication, 360 Entitlement, and Authorization

**Status:** ACCEPTED

## Decision

V1 access is fail-closed and keeps four independent decisions:

1. authenticated WordPress actor;
2. verified 360 product entitlement;
3. rollout exposure/mode;
4. action, resource-owner, assignment, and field authorization.

The existing `mmhq_cam_build_entitlement()` behavior may be characterized and
normalized as evidence for a V1-specific 360 claim. V1 does not inherit CAM
product semantics or CAM’s administrator override. Access requires active,
trusted, current-access-verified, revocation-checked, unexpired, unrestricted
evidence under the already accepted purchase/current-legacy authority mode.

Administrators receive an explicit audit-only V1 surface and cannot create,
edit, import, complete, or impersonate a learner. Eligible 360 learners mutate
only their own resources. Mentors receive only assignment-scoped,
server-filtered proposal access.

## Non-authorities

Generic Matrix access, program tier alone, any-course enrollment, client flags,
administrator status, and rollout exposure do not grant learner V1 access.
Changing qualifying products/courses or legacy-without-purchase treatment is a
money/entitlement decision outside this record.

## Verification

Every REST action requires nonce/CSRF validation, entitlement, rollout, action,
owner/assignment, and field checks. Denials are non-enumerating. Required tests
cover admin-negative mutation, forged IDs, foreign ownership/type, revoked and
expired claims, stale claims, and direct endpoint access with navigation hidden.
