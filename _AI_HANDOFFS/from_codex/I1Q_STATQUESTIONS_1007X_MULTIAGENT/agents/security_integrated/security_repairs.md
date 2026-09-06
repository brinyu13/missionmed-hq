# I1Q-1007X Integrated Security Repairs

## Current Scope

This is a repair specification only. The specialist was read-only outside this report directory and made no product change.

## Required Repairs

| ID | Priority | Repair | Required regression proof |
| --- | --- | --- | --- |
| REP-001 | P1 | Apply assignment-scoped filters to generic `list` and `get`, matching the SQL policies for revisions, sources, review records, candidates, and restricted operational records | Unassigned read-only, author, reviewer, and cross-assignment IDOR matrix |
| REP-002 | P1 | Add server middleware that denies operational routes unless `internal_platform_enabled` is true and denies review mutations unless `internal_review_enabled` is true | Flag-off HTTP 403 tests, ordered enablement tests, direct URL and direct API tests |
| REP-003 | P1 | Gate each STAT and Drills artifact route with its exact consumer flag in addition to phase and role | Flag-off artifact denial for every channel and phase |
| REP-004 | P1 | Require `has_active_role(assignment.required_role)` in SQL reviewer answer access; require current medical credential for medical review access; decide and encode whether completed assignments retain access | Revoked, expired, reassigned, completed, and credential-expired database attacks |
| REP-005 | P1 | Bind `channel_security_policies.channel` and immutable policy rules to requested channel, phase, and data class; validate Class A payload before insert | Mismatched policy and answer-bearing pre-answer SQL tests |
| REP-006 | P1 | Require both `student_content_enabled` and `student_release_enabled` for publication in application and SQL | One-flag-only negative tests at both layers |
| REP-007 | P1 | Mirror exact assembler, validator, medical ratifier, and publisher actor-separation rules in SQL | Same-actor promotion attacks for every transition |
| REP-008 | P1 | Implement and wire the canonical MissionMed identity resolver, credential verifier, publication ratification verifier, and participant finalization resolver | Live expiry, revocation, logout, outage, role, CSRF, Origin, and finalization matrix |
| REP-009 | P1 | Wire the application to the approved `PostgresRepository` through an unprivileged `NOBYPASSRLS` role and an owner-reviewed explicit grant manifest | Proof that HTTP requests exercise RLS, not memory-only authorization |
| REP-010 | P1 | Run migration apply, exact reapply, negative role attacks, compensation twice, rollback verification, and intended reapply on an isolated approved database | Complete non-skipped PostgreSQL suite and preserved logs |
| REP-011 | P2 | Add transitive delegation and conflict-graph checks or explicitly document a bounded one-edge policy | Multi-hop self-review attacks |
| REP-012 | P2 | Add real browser XSS, CORS, cookie, cache, path, CSP, zoom, and session tests on staging | Browser evidence tied to exact commit and URL |
| REP-013 | P1 | Require the complete official leak-test set, stored per-artifact results, and exact evidence-hash binding before validation can pass | Missing, duplicate, caller-invented, stale, and cross-release validation attacks |
| REP-014 | P1 | Reject expired rights in both application and SQL release assembly | Expired clearance with otherwise valid status must fail |
| REP-015 | P1 | Replace shared table-wide metadata RLS with own-lineage, assignment, governance, analytics, and incident scopes | Positive and negative role matrix for every metadata table |
| REP-016 | P2 | Make compensation audit idempotence concurrency safe with a database uniqueness or lock invariant | Two simultaneous compensation calls yield one exact event |
| REP-017 | P2 | Encode immutable Source Record, Privacy Redaction Record, and Extraction Run semantics and the approved revision lifecycle | Update, delete, retirement, supersession, and draft-freeze tests |
| REP-018 | P1 | Complete the current open-assignment application repair and update direct tests to accept assignments before review | Current focused and full suites return to zero failures |

## Evidence

REP-001 through REP-007 and REP-013 through REP-018 derive from direct source inspection, reproduced synthetic attacks, and the current failing test run. REP-008 through REP-010 derive from missing canonical integration and the skipped disposable PostgreSQL test. REP-011 and REP-012 are residual defense-in-depth and certification gaps.

## Findings

The candidate has strong local defensive primitives. The remaining defects are integration and policy-enforcement gaps, not reasons to weaken auth, RLS, immutable history, or protected consumer contracts.

## Changes

No repairs were implemented in this specialist pass.

## Tests

Every repair must add a direct negative regression test and then rerun the full application, adapter, privacy, evidence, migration, repository, protected-consumer, and independent red-team suites. Static tests alone cannot clear REP-008 through REP-010.

## Risks And Blockers

Root must coordinate REP-008 through REP-010 with the named identity, data, and deployment owners. Manual SQL, broad grants, service-role application traffic, direct production changes, and shared-auth weakening are prohibited shortcuts.

## Confidence

High, `0.97`, that the listed repairs cover every release-blocking security finding identified in this pass.

## Paths

The primary repair surface is app-owned: `i1q-question-platform/src/server.mjs`, `src/platform.mjs`, `src/postgres-repository.mjs`, and the timestamped migration plus tests. Shared systems require separate authority and are not part of this patch surface.

## Root Handoff

Implement REP-001 through REP-007 and REP-013 through REP-018 locally before requesting external integration. Keep all flags off. After owner-provided canonical routes exist, execute REP-008 through REP-012 and request a fresh independent security verdict.
