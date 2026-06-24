# MMC-019 RLS Test Plan

RESULT: COMPLETE

SUMMARY:
- VERIFIED: This is an RLS and access test plan only. It creates no policies, roles, schemas, migrations, credentials, or production changes.
- VERIFIED: The plan assumes deny-by-default RLS, no `service_role`, and no MMC RLS changes on non-MMC tables.
- VERIFIED: The plan requires proving admin allow, assigned mentor allow, unassigned mentor deny, student deny, logged-out deny, and audit behavior before any production write pilot.

## Scope

- VERIFIED: Applies only to future `mmc.*` persistence.
- VERIFIED: Existing Matrix, Scheduler, Calendar, CRM, LearnDash, Messages, File Vault, Arena, Drills, Webex, R2, WordPress, and production Supabase external tables are out of scope for MMC writes.
- CONFLICT: Running these tests against production before staging proof conflicts with MMC-018 gates.

## Required Test Principals

| Principal | Purpose | Status |
|---|---|---:|
| Logged-out/no session | Ensure no private data access | REQUIRED |
| Student/subscriber account | Ensure students cannot read mentor-private intelligence | REQUIRED |
| Unauthorized mentor | Ensure valid mentor cannot see unassigned students | REQUIRED |
| Assigned mentor | Ensure mentor can work only assigned subject refs | REQUIRED |
| MMC Admin/HQ operator | Ensure controlled admin access and audit override | REQUIRED |
| Read-only external reader | Ensure external read credential has no MMC write permissions | REQUIRED |
| Future system worker | Ensure recompute actor cannot bypass tenant/assignment/visibility | FUTURE |

## Test Dataset Requirements

- VERIFIED: Use staging or isolated test database only.
- VERIFIED: Seed at least two mentors: Mentor A and Mentor B.
- VERIFIED: Seed at least two external subject refs: Subject 1 assigned to Mentor A and Subject 2 assigned to Mentor B.
- VERIFIED: Include one student/subscriber principal that must be denied from all private MMC tables.
- VERIFIED: Include one admin/operator principal with audit-required override.
- VERIFIED: Include mentor-private, mentor/admin, and future-student-visible visibility flags.
- VERIFIED: Include archived/deleted records to test filtering.

## Table Coverage Matrix

| Table | Admin | Assigned Mentor | Unassigned Mentor | Student | Logged Out | Audit |
|---|---|---|---|---|---|---|
| `mmc.mentors` | READ/WRITE scoped | READ self | DENY others | DENY | DENY | Assignment/admin changes |
| `mmc.mentor_assignments` | READ/WRITE | READ own active assignments | DENY unrelated | DENY | DENY | REQUIRED |
| `mmc.coaching_sessions` | READ/WRITE | READ/WRITE assigned | DENY | DENY by default | DENY | Writes |
| `mmc.session_artifacts` | READ/WRITE | READ/WRITE assigned | DENY | DENY by default | DENY | Sensitive artifacts |
| `mmc.mentor_memory` | READ/WRITE | READ/WRITE assigned | DENY | DENY | DENY | REQUIRED |
| `mmc.private_notes` | READ/WRITE | READ/WRITE assigned/private | DENY | DENY | DENY | REQUIRED |
| `mmc.action_items` | READ/WRITE | READ/WRITE assigned | DENY | DENY by default | DENY | Writes/status changes |
| `mmc.goals` | READ/WRITE | READ/WRITE assigned | DENY | DENY by default | DENY | Writes/status changes |
| `mmc.open_loops` | READ/WRITE | READ/WRITE assigned | DENY | DENY | DENY | Writes/status changes |
| `mmc.intelligence_snapshots` | READ/WRITE | READ assigned/review scoped | DENY | DENY | DENY | Generation/review |
| `mmc.audit_events` | READ scoped | READ own audit if approved | DENY | DENY | DENY | Immutable append only |
| `mmc.identity_references` optional | READ/WRITE admin only | READ assigned ref only if needed | DENY | DENY | DENY | REQUIRED |

## Core Assertions

### Denial Assertions

1. VERIFIED required: Logged-out principal returns zero rows from every `mmc.*` table.
2. VERIFIED required: Student principal returns zero rows from private MMC tables.
3. VERIFIED required: Student principal cannot read `mmc.private_notes`, `mmc.mentor_memory`, `mmc.intelligence_snapshots`, `mmc.open_loops`, or mentor-private `session_artifacts`.
4. VERIFIED required: Unassigned mentor cannot read or mutate records tied to unassigned `subject_ref_id`.
5. VERIFIED required: Unassigned mentor cannot infer record existence by row ID, count query, error shape, or timing-sensitive detail.
6. VERIFIED required: Read-only external reader cannot insert, update, delete, or call write RPCs.

### Allow Assertions

1. VERIFIED required: Assigned mentor can read assigned subject briefing records.
2. VERIFIED required: Assigned mentor can create MMC-owned sessions, memory, notes, action items, goals, and open loops for assigned subjects only.
3. VERIFIED required: Admin can manage mentor assignments with an audit reason.
4. VERIFIED required: Admin override is logged to `mmc.audit_events`.

### Mutation Assertions

1. VERIFIED required: Inserts require actor principal, mentor scope, assignment scope, subject ref, visibility, and provenance.
2. VERIFIED required: Updates cannot change `subject_ref_id` or `mentor_id` in a way that bypasses assignment.
3. VERIFIED required: Soft delete/archival preserves audit trail.
4. VERIFIED required: Hard delete is forbidden except approved retention workflows.

## RLS Implementation Tests To Require Before Build Approval

- BLOCKED: Policy tests must run in CI or equivalent before migration execution.
- BLOCKED: Tests must fail if any query requires `service_role`.
- BLOCKED: Tests must fail if any policy is created on non-`mmc.*` tables.
- BLOCKED: Tests must fail if any student/subscriber role can see private memory, notes, relationship context, risk, readiness, or private snapshots.
- BLOCKED: Tests must fail if any mentor can access a subject without an active assignment.
- BLOCKED: Tests must fail if admin override is possible without an audit reason.

## Session Claim / Pooling Safety

- UNVERIFIED: Final implementation mechanism for database principal/claims is not approved.
- VERIFIED: If using DB session settings such as `current_setting`, tests must prove transaction-scoped setting, no pooled connection leakage, and correct reset on every request.
- VERIFIED: If using JWT claims, tests must prove claim forgery is not possible from client-controlled input.
- VERIFIED: If using backend-enforced filters plus RLS, tests must prove both layers deny unauthorized access independently.
- CONFLICT: RLS that depends only on app-layer filtering is not acceptable for production mentor-private data.

## External Read Boundary Tests

- VERIFIED: MMC RLS tests do not approve external reads.
- BLOCKED: Scheduler/Calendar safe-read tests remain separate and must prove no hidden writes, sync, cache mutation, or recording metadata writeback.
- BLOCKED: Webex, transcripts, R2, File Vault private contents, Drills, and StoryForge remain out of scope.
- CONFLICT: Any test plan that validates MMC by reading external production data through `service_role` is invalid.

## Integrity Check Matrix

Frontend:
  Pages load:        N/A - no frontend changed by this report.
  Layout renders:    N/A - no frontend changed by this report.
  Navigation:        N/A - no frontend changed by this report.

Backend:
  `/wp-admin`:       N/A - not touched and not probed.
  PHP errors:        N/A - no WordPress/PHP changes.
  DB connections:    N/A - no DB credentials used.

Functional:
  Core interactions: N/A - no runtime changed.
  No regressions:    PASS - local source validation passed without source edits.

## RLS Verdict

- READY: Use this plan to draft tests for a future staging-only schema build.
- BLOCKED: Production schema execution until tests are implemented and passing against a staging schema.
- BLOCKED: Production writes until assignment, identity references, audit logging, backup/rollback, and retention policy are approved.

