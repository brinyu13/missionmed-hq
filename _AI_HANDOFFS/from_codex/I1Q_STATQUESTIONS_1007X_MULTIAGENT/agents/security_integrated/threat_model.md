# I1Q-1007X Integrated Threat Model

## Current Scope

This review covers commit `ccb8b73899c81ba0d028638be0d79b6a351f0ceb` plus the current uncommitted review-workflow delta. The current `platform.mjs` hash is `121f4ac1ed0a13a6044b6c4e1370d76c6c7bf44afa8e2e1add9346ae190a828a`. The datastore candidate is identified by these hashes:

- Forward migration: `9ccf9b29b402fb271e449be26d6b11deb496e834d3b7caa7ec875ba582749ca8`
- Compensating migration: `25e317428ca75c8cce29269e19c7002ea69860080aac7f59496312bbed34446a`
- PostgreSQL repository: `f4c5f6e3acffc0925c9c36a027471f5d02ec6606ea65ca7e48abfb701f7edee3`

The review was read-only outside this report directory. No application, test, migration, evidence, feature flag, Git, provider, secret, environment, or production state was changed.

## Protected Assets

1. Canonical MissionMed identity and session state.
2. I1Q role memberships, review assignments, and credential evidence.
3. Exact immutable Item Revisions and their review history.
4. Answer keys, explanations, rationales, and post-answer artifacts.
5. Restricted source references and privacy-safe working transcript data.
6. Release manifests, validation evidence, promotion chains, and feature flags.
7. Audit events and chain heads.
8. STAT sealed-pack secrecy and Drills source ownership.

## Trust Boundaries

| Boundary | Trusted input required | Current state | Security result |
| --- | --- | --- | --- |
| Browser to I1Q HTTP service | Fresh canonical session, server-derived roles, trusted Origin, session-bound CSRF | Resolver interface exists, canonical resolver does not | Fail closed but not deployable |
| I1Q service to datastore | Canonical actor, unprivileged role, forced RLS, fixed RPC grants | Offline SQL and adapter only | Not runtime proven |
| Review workflow | Assignment, reviewer, actor, role, credential, and exact revision hash | Strong application and SQL checks | Mechanically strong, live identity absent |
| Answer access | Purpose, actor, active role, assignment, revision, finalization | App isolation tests pass; SQL assignment branch omits active-role check | Release blocker |
| Source access | Privacy or system role, restricted purpose, audit | SQL reader is role and purpose scoped | Static only |
| Release artifact creation | Exact policy, channel, phase, data class, payload validation, flags | SQL does not bind policy to artifact fields or scan Class A payload | Release blocker |
| Consumer delivery | Correct phase plus enabled exact consumer flag | Application artifact route ignores consumer flags | Release blocker |
| Publication | Both student flags, exact evidence, independent actors, Brian ratification | Application locks both flags; SQL checks only `student_release_enabled` | Contract drift blocker |
| Rollback | Canonical migration owner and fixed compensating command | Preserving compensation exists | Not executed |

## Threat Findings

| ID | Threat | Severity | Evidence | Result |
| --- | --- | --- | --- | --- |
| SEC-INT-001 | Cross-record read and IDOR | P1 | `QuestionPlatform.list` and `get` require only a generic read role for most entities | Reproduced: unassigned `read_only` actor received one draft revision and one source record |
| SEC-INT-002 | Internal feature-gate bypass | P1 | Server routes do not check `internal_platform_enabled` or `internal_review_enabled` | Reproduced: dashboard returned HTTP 200 with no enabled internal flags |
| SEC-INT-003 | Consumer feature-gate bypass | P1 | `artifactForPhase` does not check STAT or Drills flags | Reproduced: STAT pre-answer artifact returned with every restricted flag off |
| SEC-INT-004 | Revoked reviewer answer access | P1 | SQL assignment branch in `read_item_revision_answers` omits `has_active_role` and current credential checks | Statically disproved fail-closed revocation semantics |
| SEC-INT-005 | Artifact policy and Class A confusion | P1 | `create_channel_artifact` accepts independent policy, channel, phase, data class, and arbitrary JSON | Static attack path exists for mislabeled answer-bearing payload |
| SEC-INT-006 | Student publication gate mismatch | P1 | SQL publication checks `student_release_enabled` but not `student_content_enabled` | Static contract mismatch |
| SEC-INT-007 | Runtime authorization bypass by repository choice | P1 | Main server constructs `QuestionPlatform` with `MemoryRepository`; `PostgresRepository` is not wired | RLS cannot protect the current HTTP service |
| SEC-INT-008 | Missing canonical identity | P1 | Main server supplies no `identityResolver` | Safe 401 default, State C unavailable |
| SEC-INT-009 | Unproven RLS and rollback | P1 | Disposable PostgreSQL test skipped; no canonical project-pinned route | No database security clearance |
| SEC-INT-010 | Release actor-separation drift | P2 | SQL ratification and publication do not match stronger application actor separation | Static mismatch |
| SEC-INT-011 | Browser-only attack coverage gap | P2 | No authenticated staging URL or in-app Browser run | XSS, cookie, CORS, and live session behavior remain unproven |
| SEC-INT-012 | Arbitrary release validation evidence | P1 | App and SQL accept any nonempty caller-named passing check list | Required leak checks and stored results are not enforced |
| SEC-INT-013 | Expired rights bypass | P1 | Release assembly checks rights status but not `expires_at` | Expired clearance can remain eligible |
| SEC-INT-014 | Broad metadata RLS | P1 | Shared metadata policy grants table-wide reads to authors and reviewers | Binding own-lineage and assignment scope is not encoded |
| SEC-INT-015 | Compensation audit race | P2 | `IF NOT EXISTS` followed by append has no unique compensation key | Concurrent calls can append duplicates |
| SEC-INT-016 | Incomplete immutable lifecycle | P2 | Source, redaction, and extraction records lack immutable triggers; draft revisions cannot be edited | Architecture lifecycle is not fully represented |
| SEC-INT-017 | Current review patch is not green | P1 | Assignments now start open but tests do not accept them | Current focused run has six failures |

## Evidence And Tests

- Current focused security, platform, privacy, migration, and repository run: 112 passed, 6 failed, 1 skipped out of 119.
- Prior committed local full suite observed before the uncommitted review-workflow delta: 194 passed, 0 failed, 1 skipped out of 195. It is historical evidence, not the current verdict.
- Skipped case: disposable PostgreSQL apply, reapply, RLS role attacks, compensation, and reapply.
- Root dependency audit: 0 vulnerabilities.
- Relevant secret-pattern scan: no findings.
- Independent synthetic attack probe: three security claims disproved as listed above.

## Changes

No product change was made. This specialist created only the seven files in `agents/security_integrated/`.

## Risks And Blockers

The local estate proves useful mechanics but the current worktree is not green. Security vetoes State C until the six review failures, IDOR and feature-gate bypasses, release validation, rights, artifact, RLS, and compensation defects are repaired, the canonical resolver and unprivileged database role are wired, and the complete PostgreSQL attack and rollback matrix passes on an authorized isolated target.

## Confidence

High, `0.97`, for the local findings and release veto. No confidence claim is made for live RLS, auth, or rollback because those paths were not available.

## Paths

Primary evidence paths are `i1q-question-platform/src/auth.mjs`, `src/server.mjs`, `src/platform.mjs`, `src/privacy.mjs`, `src/pipeline.mjs`, `src/postgres-repository.mjs`, the two timestamped SQL files, and their focused tests.

## Root Handoff

Root should treat this packet as a security release veto, not as a request to weaken any protected system. Repair the app-owned boundaries first, then obtain the canonical identity, database, and deployment routes and rerun an independent security review on the exact frozen commit.
