# V1 Study Schedule — V1-8010 Next-Run Inputs

## Required immutable inputs

1. This complete V1-8000 handoff and file manifest.
2. Repository `https://github.com/brinyu13/missionmed-hq.git`.
3. Base `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0`.
4. D9-300 canonical HTML SHA
   `cd7737649afeb581fa3a18abb774cfa8ade1860372e0215cc8bd3fa375d0dc67`
   plus its design/interaction reports.
5. D9-350 behavioral constitution, decision tables, temporal, streak, closeout,
   recovery, and edge-case reports.
6. D9-360 prototype/suite/screenshots as refinement evidence only.
7. D9-415 source/runtime/provenance/package/rollback reports.
8. Brian's exact approval: Matrix runtime lock override for
   `V1-STUDY-SCHEDULE-8000` and `class_mmed_student_os_php`.
9. Load-bearing hashes in the canonical source decision.

## Mandatory 8010A decision records

| Decision | Required content | Default recommendation |
|---|---|---|
| Product/authority | Identity, D9-300 foundation, D9-350 law, D9-360 evidence status | Accept V1-8000 hierarchy |
| Product-input durability | Verify accepted D9 hashes and authorize non-destructive durable filing | Do not rely on local-only paths without a pinned integrity record |
| Implementation home | Repo/base/worktree/branch/rollback source plus durable long-term source/release destination | New `codex/` branch at `d4455bf`; choose long-lived V1 branch, reviewed baseline promotion, or exact package release |
| One-writer boundary | Objects and prohibited writers | V1 repository only |
| Physical store | Ownership, engine/isolation transactions, uniqueness, migration lock/failure, backups, snapshots/compaction, repository interface | Additive Plan-owned WordPress tables only after capability proof |
| Identity/context | Actor key, Profile-owned facts, and whether/how Plan is partitioned | WordPress learner owner; context partition remains an explicit decision |
| Access | Authentication, entitlement, rollout exposure, and action/resource/field authorization | Fail closed; administrators audit-only; mutation pilots use learner principals |
| Temporal law | IANA zone, local intent, week/streak boundary | Persist instant + zone + local intent |
| Legacy/import | Read/preview/import/export/provenance/rollback; preview bound to source version/hash/owner/type/expiry and CAS commit | Explicit idempotent one-way import; reject preview drift |
| Completion/adapters | External outcomes and mentor writes | Evidence/proposal only; learner decides |
| Settings | Canonical semantic/physical owner, version/default/migration | Ownership TBD; V1 settings service is a recommendation |
| Retention/history | 90-day inherited op-log rule, ReviewRecord/aggregate retention, privacy/legal, deletion, backup | Revalidate before implementation |
| Flag/release | Separate exposure/write/reader modes, atomic cutover watermark, current/N-1 reader, assets, RC digest, canary, kill switch | Legacy precutover, V1 active read/write, V1 degraded read-only, hidden-only-without-V1-truth |
| Runtime lock | Protected files, current hashes, update process | Record override; immutable descriptors |

## Characterization tests before product code

Current production observation is read-only. Every list/create/update/delete
mutation characterization below runs only against local fixtures or an isolated
staging environment; no V1-8010 phase may write production.

- current module and access payload for admin/enrolled/non-entitled users;
- direct `#study` routing and shell/loader race;
- REST list/create/update/delete permission matrix;
- negative administrator mutation/import, impersonation, mentor-field, and
  ownership tests;
- foreign-user and foreign-event-type mutation denial;
- metadata preservation on completion;
- current timezone/range/cross-midnight behavior;
- Calendar/Admin/Session writer inventory;
- flag-off snapshot of every shared Matrix route;
- public/source hashed asset parity.
- transactional engine/isolation and concurrent migration capability;
- CSRF/REST nonce, stored-content encoding, mass-assignment, enumeration, and
  mutation-rate limits;
- pre/post-cutover reader-mode continuity and legacy-write denial.

## First-slice acceptance

The first visible slice is a staging Week canvas used through an explicit learner
test principal; administrators remain audit-only. It:

- visibly preserves D9-300 language;
- creates, moves, resizes, completes, deletes, and reloads one V1 block;
- uses a Plan-owned UUID/revision/operation;
- rejects collision and stale revision;
- survives refresh, retry, duplicate request, two tabs, two users, and DST cases;
- has keyboard and touch alternatives;
- leaves Calendar, MissionMed Scheduler, CAM, and all unrelated Matrix routes
  unchanged in precutover/off mode without implementing booking behavior.

## Inputs that are not authority

- the legacy panel as a product specification;
- `mmed_events` as Plan storage;
- any unknown Supabase project;
- unrelated `study_plans`/`tasks` diagnostic tables;
- D9-360 self-scores;
- client temporary-open routes;
- a flag as entitlement;
- a static prototype or localStorage adapter;
- appointment/Webex Scheduler source.

## Stop conditions

Do not continue past authority into schema if any of the exact 14 decisions is
missing. Production observation remains read-only through V1-8030.
Stop rollout on any auth leakage, foreign mutation, dual writer, persistence
divergence, protected-hash mismatch, P0/P1 quality defect, absent rollback, or
cross-app regression.
