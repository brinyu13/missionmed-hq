# 04 CAM v2 Schema and RLS Kernel

RESULT: `ADDITIVE_DURABLE_KERNEL_IMPLEMENTED_UNAPPLIED`

## Migration boundary

MegaRun 006 adds one transaction-wrapped, uniquely sequenced migration:

`supabase/migrations/20260715155243_a1_mmc_006_trust_data_worker_kernel.sql`

It creates only additive `mmc.cam_v2_*` objects plus standard pgcrypto digest support. Its explicit schema-build-target guard is LOCAL/STAGING/CI-only; MegaRun 006 used only disposable local PostgreSQL targets and marked the final proof target `local`. The migration is unapplied to every configured MissionMed database (`schemaApplied: false` in the file-mode validator) and all planes remain sealed. It does not alter an existing MMC v1 table, shared MissionMed application table, auth table, migration-history row, bootstrap, or production resource. The companion `supabase/snippets/20260715_mmc_cam_v2_rls_validation.sql` is an owner-seeded synthetic isolation/recovery fixture for a disposable database; it is not a migration, live end-to-end proof, or production command.

## Durable object inventory

The schema separates 31 tables by ownership:

| Plane | Tables |
| --- | --- |
| Trust and control | `tenants`, `principals`, `subject_links`, `assignments`, `policy_versions`, `authority_grants`, `cutover_states` |
| Command and audit | `command_receipts`, `idempotency_records`, `audit_events` |
| Canonical mentor/student state | `sessions`, `tasks`, `commitments`, `goals`, `milestones`, `student_statements`, `student_responses` |
| Asset, evidence, and review | `source_assets`, `transcript_versions`, `evidence_spans`, `analysis_runs`, `ai_proposals`, `review_decisions`, `lineage_edges` |
| Publication | `publications`, `publication_items` |
| Worker and delivery | `jobs`, `job_inputs`, `outbox_events`, `consumer_effects`, `consumer_inbox` |

All durable IDs are UUIDs at the SQL boundary. Composite unique keys and foreign keys repeat tenant/environment and, where applicable, assignment/subject/mentor/job/grant. This prevents a valid ID from one scope being joined to another scope merely because its opaque value matches.

Persisted environments use the same canonical contract as JavaScript: `FIXTURE`, `LOCAL`, `STAGING`, and `LIVE`. That data vocabulary is distinct from the migration's schema-build-target guard (`local`/`staging`/`ci`), which prevents an unscoped apply and does not redefine runtime data. MegaRun 006 used only disposable local PostgreSQL 16 targets; the final clean proof used build target `local`. It did not apply to MissionMed staging or production.

## RLS and authority law

- Every CAM v2 table enables and forces RLS.
- Authenticated direct table access is SELECT-only and limited by exact principal, mentor assignment, student ownership/publication entitlement, worker workload/queue, or trust-operator policy.
- Authenticated execution is narrow: worker lease/result/recovery, outbox/inbox, and typed job-input/handoff RPCs only. There is no reviewed runtime RPC for enqueue, canonical artifact-output creation, domain commands, or publication approval/render mutation.
- Direct authenticated mutation policies are absent. The owner-seeded fixture can build synthetic rows to prove constraints, but that owner path is not a runtime adapter or application authorization model.
- RPC/helper `search_path` is pinned; public execution is revoked before narrow role grants.
- Claims derive tenant, environment, principal, workload, queue, lease generation, and outbox lease generation from signed application metadata. Request parameters cannot replace them.
- Authority checks lock tenant, principal, policy, grant, assignment, cutover, job, and handoff rows that could revoke or change eligibility during mutation.
- Feature planes and the single-writer state default off; a valid role alone cannot bypass cutover.

The inbox effect RPC is one reviewed exception to the usual RLS-on function posture: as a security-definer it uses `row_security = off` so an exact durable receipt can be checked before a now-expired delivery lease, which is necessary for lost-response idempotency. It still derives active actor/scope/capability/queue from signed claims, binds the exact event/effect/target, returns `false` only for exact replay, conflicts on mismatch, and requires a current generation-bound lease for any new effect.

The settled bounded static and dynamic red-team found no residual P0/P1 defect in the migration, companion validation snippet, and static contract validator. It additionally repaired owner-path terminal-transition coherence, exact expired-lease reclaim shape, active-lineage endpoint version protection, cutover cleanup, and student-scoped outbox revocation. The current source also seals every terminal job against later evidence/completion rewrites, binds successful jobs to exact provider receipt/idempotency event evidence, and applies an exact-version fence plus active-lineage guard to publication items. These last hardenings change existing function bodies and add nested rollback probes only: they add no table, function, trigger, or top-level validation block. The validator reports 31 tables and 31 forced-RLS tables. Independent catalog inventory found 74 `SECURITY DEFINER` functions, 74 exact-signature execute revokes, and zero missing revokes; authenticated retains execute on only 21 reviewed outer RPC/read helpers. It also found 51 durable digest columns, all 51 protected by lowercase SHA-256 checks. This is static/schema-contract closure, not evidence that a configured MissionMed database was applied.

## Worker/data integrity

Jobs use the same six exact `jobKind` values as the JavaScript boundary and one primary authority grant. The stable provider-idempotency-key digest is required and immutable in both proven and unproven modes; “proven” additionally requires a policy digest. Generation, attempt, lease owner/expiry, dispatch intent, result digest, result authority state, and recovery evidence are explicit columns rather than an arbitrary status blob. A row already in `SUCCEEDED`, `FAILED`, `DEAD_LETTER`, or `CANCELLED` rejects every later update, sealing both completion identity and provider evidence. Deferred success validation binds the job to one exact generation result event, including result digest/time, provider receipt digest, provider-idempotency truth, and provider-idempotency-key digest.

Typed `job_inputs` bind a producer generation and exact artifact digest to a consumer. Acquisition success requires a matching active source-asset handoff to transcript processing; transcript success requires a matching active transcript handoff to AI analysis. Completion and recovery share the same exact-success validator so reconciliation cannot manufacture success that normal completion would reject.

Provider-result recording preserves evidence but leaves its delivery event quarantined. Only a current-authority completion/reconciliation path can emit a deliverable operational transition. The outbox consumer effect and inbox receipt are separately durable and bind exact event/effect/aggregate identities.

## Evidence, publication, and audit integrity

Transcript/evidence/proposal/review rows preserve source and assignment lineage. AI proposal kinds exclude free-form `RISK_SIGNAL`; attention/risk remains a separately governed deterministic projection. Publication rows and items use exact state/source/version/predecessor/content bindings rather than a mentor-table view. Student publication policies require the exact student, readable state, enabled plane, and current durable record.

Publication item JSON is not an extension bag: a trigger enforces exact discriminator keys/types, per-field byte bounds, source version hash, item payload digest, correction-predecessor identity, and safe plain-text/date fields. Its RFC 3339 helper checks real calendar/offset syntax (including the `14:00` maximum) while the canonical JSON payload preserves 1–9 fractional digits for digest/readback parity. Every publication-item update preserves `created_at`, advances `object_version` by exactly one, and receives a server timestamp; an active exact-version lineage edge blocks that advance until the edge is governed to an invalidated state. JavaScript `projectionDigest` remains the wire-projection authority; SQL separately seals an `item_set_digest` over 1–100 exact child attestations. Parent/child locking prevents late inserts and cross-parent moves, and deferred constraints prevent incoherent corrections or two readable current heads for one subject. `CORRECTED` is deliberately terminal in this migration because the current JavaScript contract does not authorize a correction to become readable again; a later authority change requires a forward migration plus matching JavaScript contract change. Audit events are append-only and scoped hash chains. The trigger assigns the next scoped sequence and previous digest under lock, then seals the event digest; update/delete is rejected. This provides tamper evidence without copying sensitive payload bodies into the audit row.

## Why this design

The rejected alternatives were broad service-role table access, client-supplied scope claims, arbitrary JSON job/publication blobs, grant arrays with ambiguous semantics, and retry-based recovery that bypassed exact producer output. The selected design increases DDL/RPC size and requires explicit adapters, but makes revocation, lineage, idempotency, publication, and provider uncertainty enforceable at the last durable boundary. Its intentionally sealed mutation gaps are release gates, not implied functionality.

## Settled disposable PostgreSQL proof

The final artifacts were frozen and independently checksummed:

| Artifact | SHA-256 |
| --- | --- |
| `supabase/migrations/20260715155243_a1_mmc_006_trust_data_worker_kernel.sql` | `244739e1451ea3ac06c1693cf4c005b4678d2f1de4673b4d9fb9aa278186895f` |
| `supabase/snippets/20260715_mmc_cam_v2_rls_validation.sql` | `d3630a78be1ca6ae37debd0f0d3b8ea40915a0edf57df7bdd15c962bb70c8c0e` |
| `missionmed-hq/tests/mmc-cam/schema/mmc-v2-schema-contract-validation.mjs` | `3c27860ac4f1fa915e58f1c3aa2ae11b0aa0033b37d2364ad0f7199fef279df3` |

PostgreSQL 16.13 (Homebrew) cluster `/private/tmp/mmc006-final-proof4.fjnmwh` was disposable, local, and isolated from configured MissionMed projects. With schema build target `local`, the exact frozen migration applied cleanly, the 40-block owner/authenticated validation fixture passed, deferred constraints were explicitly forced, and the transaction ended with `ROLLBACK`. The post-rollback catalog check returned zero rows across all 31 CAM v2 tables. The migration then reapplied cleanly and the same fixture also passed through `COMMIT`. The disposable server was stopped; its data and logs were preserved as local evidence.

Catalog evidence after apply was exact: 31 CAM v2 tables, all 31 with RLS enabled and forced; authenticated had SELECT and no direct table mutation on all 31; `anon` had no table privilege on all 31; 65 authenticated policies were SELECT-only; 144 user triggers were enabled; and all 74 `SECURITY DEFINER` functions denied default `PUBLIC` and `anon` execution. Authenticated execute remained limited to 21 reviewed functions. The 23 invoker helpers retain PostgreSQL's default execute but are unreachable to `PUBLIC`/`anon` because those roles have no `mmc` schema usage. The 51/51 durable digest-check inventory matched the static proof. The static validator returned `MMC_V2_SCHEMA_CONTRACT_VALID` with `schemaApplied: false`; that value correctly describes its no-database file mode and does not contradict the separate disposable PostgreSQL proof.

Four current-byte two-session proofs passed. Readable-head and late-child contenders visibly waited on `Lock|transactionid`; exactly one readable head and one committed successor child remained, while the duplicate head and late child were rejected. Job-completion and outbox-terminal contenders visibly waited on scoped advisory locks and converged on one `FAILED` job transition and one `DEAD_LETTER` delivery transition without replay mutations. All 144 user triggers remained enabled. The final 64-event audit chain had unique contiguous sequences and digests with zero gaps or link breaks. Details are recorded in report 15.

## Rollback and production posture

The migration is unapplied to every configured MissionMed environment in this run. Before a first authorized apply, rollback is file/commit scoped. After any environment applies the immutable migration, corrections must use a new forward migration; never edit the applied file or repair history manually. Feature planes remain off until reconciliation and staged adapter proof.

No configured Supabase project or RLS policy, migration history, production/staging database, credential, or deployment was mutated. The disposable proof establishes DDL, fixture, catalog, cleanup, and lock behavior only; it does not supply the absent runtime enqueue, canonical artifact-output, domain-command, publication mutation, or LIVE identity-promotion adapters. No production readiness is inferred from DDL presence.
