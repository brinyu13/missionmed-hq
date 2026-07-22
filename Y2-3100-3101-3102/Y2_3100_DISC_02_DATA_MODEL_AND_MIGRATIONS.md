# Y2-3100 DISC-02 Data Model and Migrations

## Migration Inventory

**VERIFIED:** The accepted CAM donor contains these 21 ordered migrations under `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/`:

Every shortened migration citation in this report resolves beneath that exact absolute directory; no second migration root is implied.

1. `20260713030000_y1_cam_4002_rep_metadata.sql`
2. `20260713030100_y1_cam_4002_persistence.sql`
3. `20260713030200_y1_cam_4002_relational_ownership.sql`
4. `20260713030300_y1_cam_4002_mentor_share_access.sql`
5. `20260713030400_y1_cam_4002_soft_delete_rpc.sql`
6. `20260713030500_y1_cam_4002_rep_replay_soft_delete_repair.sql`
7. `20260713030600_y1_cam_4002_one_order_constraint.sql`
8. `20260713120000_y1_cam_4004_runtime_closure.sql`
9. `20260713125000_y1_cam_4004_story_soft_delete.sql`
10. `20260714202000_y1_cam_4005r_auth_session_foundation.sql`
11. `20260714203000_y1_cam_4005r_auth_session_enforcement.sql`
12. `20260715094500_y1_cam_4006_deletion_job_owner_policies.sql`
13. `20260715125500_y1_cam_4006_rep_idempotency_atomic_delete.sql`
14. `20260715133000_y1_cam_4006_atomic_delete_qualification.sql`
15. `20260715190000_y1_cam_4008a_integrity_expand.sql`
16. `20260715193000_y1_cam_4008a_authority_contract.sql`
17. `20260715200000_y1_cam_4008a_provider_replay_closure.sql`
18. `20260715203000_y1_cam_4008a_dev_findings_repair.sql`
19. `20260715210000_y1_cam_4008a_authority_deletion_certification.sql`
20. `20260715213000_y1_cam_4008a_certification_closure_repair.sql`
21. `20260715214000_y1_cam_4008a_review_deletion_race_repair.sql`

## Current Objects

- **VERIFIED:** `20260713030000_y1_cam_4002_rep_metadata.sql:7` defines `cam_rep_metadata`.
- **VERIFIED:** `20260713030100_y1_cam_4002_persistence.sql:23`, `:41`, `:54`, `:68`, `:84`, `:98`, `:112`, `:127`, and `:139` define media assets, replay packages, review grants, review sessions, Vault items, bookmarks, stories, audit events, and deletion jobs.
- **VERIFIED:** `20260713120000_y1_cam_4004_runtime_closure.sql:36` defines coaching quarantine storage.
- **VERIFIED:** `20260714202000_y1_cam_4005r_auth_session_foundation.sql:6` and `:28` define CAM authority sessions and handoff nonces.
- **VERIFIED:** `20260715190000_y1_cam_4008a_integrity_expand.sql:53`, `:70`, `:94`, `:123`, `:141`, `:155`, and `:170` add mutation receipts, provider capability grants, deletion jobs v2, deletion resource steps, review contexts, normalized notes, and normalized Orders.

## Complete Verbatim Object Inventory

The lists below contain each distinct identifier created anywhere in the 21-migration sequence. Later migrations may replace, revoke, or supersede an earlier definition; this is an inventory of creation names, not a claim that every early authority remains effective.

### Tables

**VERIFIED:** The exact table identifiers are:

`cam_rep_metadata`, `cam_media_assets`, `cam_replay_packages`, `cam_review_grants`, `cam_review_sessions`, `cam_vault_items`, `cam_bookmarks`, `cam_stories`, `cam_audit_events`, `cam_deletion_jobs`, `cam_coaching_quarantine`, `cam_auth_sessions`, `cam_auth_handoff_nonces`, `cam_mutation_receipts`, `cam_provider_capability_grants`, `cam_deletion_jobs_v2`, `cam_deletion_resource_steps`, `cam_review_contexts`, `cam_review_notes_v2`, `cam_review_orders_v2`.

Sources: `/Users/brianb/MissionMed_worktrees/Y1-CAM-3000/Y1-CAM-4008A/candidates/cam-api/migrations/20260713030000_y1_cam_4002_rep_metadata.sql:7`; `20260713030100_y1_cam_4002_persistence.sql:23-151`; `20260713120000_y1_cam_4004_runtime_closure.sql:36`; `20260714202000_y1_cam_4005r_auth_session_foundation.sql:6-39`; `20260715190000_y1_cam_4008a_integrity_expand.sql:53-184`.

### Functions

**VERIFIED:** The exact distinct function identifiers are:

`cam_set_updated_at`, `cam_soft_delete_rep_metadata`, `cam_soft_delete_replay_package`, `cam_soft_delete_media_asset`, `cam_soft_delete_vault_item`, `cam_soft_delete_story`, `cam_guard_rep_metadata`, `cam_is_trusted_reviewer`, `cam_reviewer_public_author`, `cam_guard_review_grant`, `cam_guard_review_session`, `cam_cascade_review_revocation`, `cam_audit_review_insert`, `cam_revoke_review_grant`, `cam_append_review_note`, `cam_append_review_order`, `cam_request_claims`, `cam_has_fresh_entitlement`, `cam_has_active_session`, `cam_create_rep_metadata_idempotent`, `cam_delete_rep_metadata_with_evidence`, `cam_increment_row_version`, `cam_issue_auth_session_v2`, `cam_create_review_grant_v2`, `cam_open_review_session_v2`, `cam_attach_review_context_v2`, `cam_revoke_review_context_v2`, `cam_append_review_note_v2`, `cam_append_review_order_v2`, `cam_prevent_unclosed_account_delete`, `cam_bind_upload_capability_v1`, `cam_create_replay_package_v1`, `cam_complete_replay_package_v1`, `cam_acquire_deletion_job_v2`, `cam_revoke_review_grant_v2`, `cam_revoke_review_capabilities_v2`, `cam_renew_deletion_job_v2`, `cam_deletion_closure_verified`, `cam_guard_deletion_completion_v2`, `cam_canonical_jsonb_text`, `cam_canonical_jsonb_sha256`, `cam_guard_active_rep_parent`, `cam_guard_replay_media_parents`, `cam_guard_bookmark_vault_parent`, `cam_guard_story_rep_parents`, `cam_guard_review_context_parent`, `cam_guard_capability_parents`, `cam_guard_deletion_job_identity_v3`, `cam_guard_deletion_step_evidence_v3`, `cam_begin_deletion_job_v3`, `cam_deletion_expected_steps`, `cam_guard_media_identity_v1`, `cam_resource_has_verified_closure`, `cam_lock_active_review_rep_v1`, `cam_guard_review_rep_parent_v1`.

Definition sources by migration:

- **VERIFIED:** `20260713030100_y1_cam_4002_persistence.sql:13` defines `cam_set_updated_at`.
- **VERIFIED:** `20260713030400_y1_cam_4002_soft_delete_rpc.sql:11-79`, `20260713030500_y1_cam_4002_rep_replay_soft_delete_repair.sql:11-57`, and `20260713125000_y1_cam_4004_story_soft_delete.sql:11-31` define the initial `cam_soft_delete_*` functions.
- **VERIFIED:** `20260713120000_y1_cam_4004_runtime_closure.sql:105-607` defines the original rep guard, reviewer authority, review guard/cascade/audit, revoke, note, and Order functions.
- **VERIFIED:** `20260714203000_y1_cam_4005r_auth_session_enforcement.sql:51-170` defines request-claim, fresh-entitlement, and active-session functions; `:244-300` wraps the delete/revoke/review commands.
- **VERIFIED:** `20260715125500_y1_cam_4006_rep_idempotency_atomic_delete.sql:36-165` defines idempotent rep creation and evidence deletion; `20260715133000_y1_cam_4006_atomic_delete_qualification.sql:6-63` replaces the latter.
- **VERIFIED:** `20260715190000_y1_cam_4008a_integrity_expand.sql:33-511` defines row-version, SessionRegistryV2, review v2, rep-provenance guard, and account-delete functions.
- **VERIFIED:** `20260715200000_y1_cam_4008a_provider_replay_closure.sql:33-214` defines upload binding, replay create/complete, deletion lease, and review grant v2 functions.
- **VERIFIED:** `20260715210000_y1_cam_4008a_authority_deletion_certification.sql:43-367` replaces session, active-session, review-revocation, deletion lease/renewal/closure/guard functions.
- **VERIFIED:** `20260715213000_y1_cam_4008a_certification_closure_repair.sql:8-807` defines canonical JSON/hash, final session/parent/deletion/provider guards, deletion job v3, expected-step/closure logic, lease renewal, upload binding, closure lookup, and account-delete prevention.
- **VERIFIED:** `20260715214000_y1_cam_4008a_review_deletion_race_repair.sql:9-281` defines the final review lock, review-parent guard, review cascade/context, open-session, note, and Order functions.

### Policies

**VERIFIED:** Static policy identifiers created in source are:

`cam_rep_metadata_student_select_own`, `cam_rep_metadata_student_insert_own`, `cam_rep_metadata_student_update_own`, `cam_rep_metadata_student_delete_own`, `cam_review_grants_owner_select`, `cam_review_grants_mentor_select`, `cam_review_grants_owner_insert`, `cam_review_grants_owner_update`, `cam_review_sessions_owner_select`, `cam_review_sessions_mentor_select`, `cam_review_sessions_owner_insert`, `cam_review_sessions_mentor_insert`, `cam_review_sessions_owner_update`, `cam_review_sessions_mentor_update`, `cam_audit_events_actor_select`, `cam_audit_events_actor_insert`, `cam_rep_metadata_mentor_select_granted`, `cam_media_assets_mentor_select_granted`, `cam_replay_packages_mentor_select_granted`, `cam_media_assets_owner_insert`, `cam_media_assets_owner_update`, `cam_replay_packages_owner_insert`, `cam_replay_packages_owner_update`, `cam_vault_items_owner_insert`, `cam_vault_items_owner_update`, `cam_bookmarks_owner_insert`, `cam_bookmarks_owner_update`, `cam_stories_owner_insert`, `cam_stories_owner_update`, `cam_deletion_jobs_owner_select`, `cam_deletion_jobs_owner_insert`, `cam_deletion_jobs_owner_update`.

Sources: `20260713030000_y1_cam_4002_rep_metadata.sql:58-81`; `20260713030100_y1_cam_4002_persistence.sql:315-480`; `20260713030200_y1_cam_4002_relational_ownership.sql:14-293`; `20260713030300_y1_cam_4002_mentor_share_access.sql:13-50`; `20260713120000_y1_cam_4004_runtime_closure.sql:618-740`; `20260715094500_y1_cam_4006_deletion_job_owner_policies.sql:14-37`.

**VERIFIED:** `20260713030100_y1_cam_4002_persistence.sql:287-307` dynamically creates `<table>_owner_select`, `<table>_owner_insert`, `<table>_owner_update`, and `<table>_owner_delete` for each of `cam_media_assets`, `cam_replay_packages`, `cam_vault_items`, `cam_bookmarks`, `cam_stories`, and `cam_deletion_jobs`. Expanded exact identifiers are:

`cam_media_assets_owner_select`, `cam_media_assets_owner_insert`, `cam_media_assets_owner_update`, `cam_media_assets_owner_delete`, `cam_replay_packages_owner_select`, `cam_replay_packages_owner_insert`, `cam_replay_packages_owner_update`, `cam_replay_packages_owner_delete`, `cam_vault_items_owner_select`, `cam_vault_items_owner_insert`, `cam_vault_items_owner_update`, `cam_vault_items_owner_delete`, `cam_bookmarks_owner_select`, `cam_bookmarks_owner_insert`, `cam_bookmarks_owner_update`, `cam_bookmarks_owner_delete`, `cam_stories_owner_select`, `cam_stories_owner_insert`, `cam_stories_owner_update`, `cam_stories_owner_delete`, `cam_deletion_jobs_owner_select`, `cam_deletion_jobs_owner_insert`, `cam_deletion_jobs_owner_update`, `cam_deletion_jobs_owner_delete`.

**VERIFIED:** `20260714203000_y1_cam_4005r_auth_session_enforcement.sql:182-213` dynamically creates these restrictive policies:

`cam_rep_metadata_active_cam_session`, `cam_media_assets_active_cam_session`, `cam_replay_packages_active_cam_session`, `cam_review_grants_active_cam_session`, `cam_review_sessions_active_cam_session`, `cam_vault_items_active_cam_session`, `cam_bookmarks_active_cam_session`, `cam_stories_active_cam_session`, `cam_audit_events_active_cam_session`, `cam_deletion_jobs_active_cam_session`, `cam_coaching_quarantine_active_cam_session`.

## Authority Evolution

- **VERIFIED:** `20260713030100_y1_cam_4002_persistence.sql:287` through `:307` originally installs generic owner select/insert/update/delete policies across media, replay, Vault, bookmarks, stories, and deletion jobs.
- **VERIFIED:** `20260714203000_y1_cam_4005r_auth_session_enforcement.sql:182` through `:213` adds restrictive active-session policies across 11 CAM tables.
- **VERIFIED:** `20260715193000_y1_cam_4008a_authority_contract.sql:5` through `:18` revokes authenticated lifecycle writes and unsafe base-media reads.
- **VERIFIED:** `20260715203000_y1_cam_4008a_dev_findings_repair.sql:4` through `:55` exposes safe owner and exact-grant projections instead of provider-bearing base rows.
- **VERIFIED:** `20260715190000_y1_cam_4008a_integrity_expand.sql:462` through `:484` applies FORCE RLS and revokes direct authenticated DML on new internal lifecycle tables.
- **INFERENCE:** The final migration state, not an early permissive policy in isolation, is the relevant authority surface. Any Y2 migration must preserve that expand-then-contract pattern.

## Smallest Additive Y2 Sketch

The following is a design sketch only; it is not implemented or authorized for CAM:

| Object | Minimum server-owned fields | Client-declared fields |
|---|---|---|
| `cam_interview_sessions` | id, owner, authority session, state, plan/persona refs, row version, timestamps | approved plan selection |
| `cam_interview_turn_events` | session, monotonic turn sequence, actor, event type, policy/model refs, request/correlation/causation ids, content hash | bounded answer or instructor input |
| `cam_transcript_revisions` | immutable revision, source event range, provenance, consent ref, status, deletion state | corrections through a command contract only |
| `cam_session_ledger_revisions` | immutable revision and chain hash, reconnect checkpoint, policy snapshot | none directly |
| `cam_interview_consent_receipts` | purpose, policy hash/version, subject, grant/withdrawal/expiry, authority | explicit consent choices |
| `cam_interview_visibility_grants` | exact artifact and grantee, consent basis, issue/revoke/expiry | explicit share request |

- **ASSUMPTION:** These may be separate tables or compatible extensions after a release architecture decision.
- **VERIFIED:** No equivalent interviewer session, turn-event, transcript revision, or session-ledger tables exist in the inspected CAM migration set.
- **INFERENCE:** A conforming additive Y2 schema must copy `row_version`, idempotency key plus canonical request hash, request/correlation/causation ids, server-derived ownership/timestamps, append-only revisions, FORCE RLS, and no direct authenticated lifecycle DML.

## Boundary Verdict

CAM offers mature persistence patterns worth adopting. It does not contain a hidden interviewer schema. Y2 must be additive, versioned, and fail closed, and remains blocked from integration by the current capability kill.
