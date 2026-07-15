# V1 Study Schedule 8010R - 8010E Requirements Ledger

Updated: 2026-07-15 UTC  
Milestone: 8010E Week vertical slice  
Status: E0 + E1 VERIFIED; E2 COMMAND WORK NEXT; DEFAULT HIDDEN; SYNTHETIC ONLY

## Product identity

| Field | Governing value |
|---|---|
| Product | V1 Study Schedule |
| Purpose | Learner academic study planning and execution |
| Historical aliases | Matrix Plan; Study Schedule; Study Scheduler; D9 Matrix Plan |
| Not this product | MissionMed Scheduler; appointment booking; Calendar; Webex Scheduler |
| Matrix route | `#study` |

Files or systems containing `scheduler` are not treated as V1 evidence unless
their content proves a direct dependency. Appointment and Webex flows are
regression surfaces only.

## Authority and accepted starting state

1. Brian's current `V1-STUDY-SCHEDULE-8010E_THROUGH_8040` directive.
2. Accepted V1-8010A Decisions 02 through 14 and the 8010R founder authority.
3. D9-360 product experience and prototype.
4. D9-350 behavioral constitution where D9-360 does not supersede it.
5. D9-300 visual and interaction foundation.
6. The accepted 8010C source and verified 8010D five-table capability kernel.
7. Current Matrix runtime truth and lock.

The isolated 8010D kernel is accepted and is not being repeated. Its closure
explicitly left the physical reader, command writer, shared Calendar/V1 owner
arbiter, normalized Week persistence, rollback reader, and visible product for
later work. Those missing seams are 8010E entry gates, not evidence that the
kernel failed.

## Current control and runtime evidence

- MissionMed_OS is read-only, locally dirty, and its `CURRENT.md` is stale and
  unrelated. Brian's recorded 8010R override governs this worktree.
- Decision 12 remains HOLD. It blocks real learner data, real exposure,
  production options/schema, telemetry, cohort activation, and deployment. It
  does not block isolated synthetic engineering or fixture UI.
- The mandatory Matrix all-assets preflight passed on 2026-07-15. Local source,
  production origin, and declared public assets matched the current lock.
- Approved Matrix controller SHA-256:
  `b514638b6089b12057ab53e715bc18c13b0dc21cba64e63d04be0a14cc0739d2`.
- Approved immutable Student OS SHA-256:
  `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a`.
- No production, option, schema, learner, cache, flag, Git, PR, or deployment
  mutation occurred during this reconciliation.
- E0 exact validation commit `9e8e2f247c3b1fb74872eefc0e97017c5faa3a5d`
  passed the 8010E MySQL 8/MariaDB 10.11 and PHP 7.4/8.3 matrix plus every
  8010C, containment, and 8010D regression job. E0 closes the normalized Week/
  Block domain and exact physical-schema contract only.
- E1 exact validation commit `e9c537abbe465289b3b6cd1037565d8cec08acf4`
  and tree `95ae6a8542dafa72e630acfef64fd523241fe20c` passed all 21
  jobs in the 8010E, 8010C, containment, and 8010D workflows. E1 closes the
  restart-safe generation-2 migrator and isolated bounded current reader only.

## Accepted E1 closure

E1 now provides the shared-lock, ledger-owned, restart-safe migration from an
empty generation-1 store to exact generation 2. It validates the immutable
parent ledger, rejects initialized generation-1 truth without a proved
transformer, commissions migrations 6–7 and the generation/gate atomically,
and reconciles every distinct durable SIGKILL state.

The isolated current reader re-proves physical provenance on each positive
call, rejects same-session temporary shadows for all seven owned tables, pins a
clean native connection, preserves caller transactions/savepoints/XA and
isolation, and rebuilds the canonical Plan from normalized Week/Block rows in
one read-only consistent snapshot. Plan/receipt/row/census inputs are bounded
before or at maximum-plus-one materialization. A two-connection revision tear
and two positive owners passed on both supported database families. No E1 P0 or
P1 remains after two independent final read-only reviews.

E1 remains isolated and inert. It does not bind the repository into plugin
runtime or provide the Plan command writer, shared Calendar/V1 owner arbiter,
REST routes, actor adapter, rollback reader, feature control, or visible UI.

## Governing 8010E scope

8010E owns Week arrangement and its read-only Mission projection:

- create a learner-owned flexible block;
- move by drag, touch, or keyboard through one command contract;
- resize through pointer, touch, or accessible keyboard controls;
- tombstone/delete a learner-owned flexible block;
- reload canonical server state;
- stable server-issued UUIDs;
- monotonic decimal-string Plan revisions;
- exact idempotent replay and stale-revision/conflict handling;
- Monday civil-week semantics in the server-owned learner IANA timezone;
- explicit DST gap/fold behavior;
- collision and fixed-anchor protection;
- deterministic Mission derivation from the same revision;
- D9-360 behavior and D9-300 visual language;
- Matrix App Mode mount/unmount without unrelated-route hydration.

Completion, actuals, partials, Focus, closeout, streak mutation, Reserve,
recovery, undo, recurrence, Month, Journey, Review, mentor proposals, adapters,
settings, and governed quotes remain later milestones unless a narrow
prerequisite is required. In particular, 8010E must not invent 8010F execution
facts.

## Canonical state and command law

The Plan command service and its Plan-owned repository are the only writers.
Browser storage, Calendar, adapters, administrators, and mentors cannot mutate
Plan truth.

Each mutation requires an exact body containing only:

```json
{
  "idempotency_key": "case-sensitive-16-to-64-bytes",
  "expected_revision": "0",
  "command": "create_block",
  "payload": {}
}
```

Actor and learner owner are always server-derived. Request hashing binds the
contract, actor, owner, semantic command, expected revision, and normalized
payload. Receipt replay is checked before stale revision. The same key and same
request replays the stored result; the same key with changed bytes conflicts;
two new keys at one expected revision produce exactly one commit.

The transaction lock order is:

`store gate shared -> exact control rows shared -> owner Plan row FOR UPDATE -> relevant Calendar Study rows ascending -> Week/domain rows -> operation receipt`

The first accepted V1 command atomically creates Plan and Block UUIDs, advances
revision 0 to 1, stores the operation, rebuilds the verified reader snapshot,
and writes the permanent learner cutover watermark. Legacy Study and V1 must
use the same owner fence before activation.

## Week data law

- Week membership is Monday 00:00 through the next Monday 00:00 in the
  server-derived learner profile timezone.
- The 06:00 through 24:00 canvas is a display/edit window, not the civil-day
  boundary.
- Occupancy uses half-open UTC intervals. Adjacent blocks are valid.
- Manual blocks are `planned_flexible`. Server-owned anchors are
  `planned_fixed`. Delete creates a durable `tombstoned` state.
- A tombstone does not occupy capacity and cannot silently resurrect.
- Every scheduled occurrence records UTC instant, IANA zone, local date/time
  intent, temporal policy version, fold choice, provenance, classification,
  and created/updated/tombstone revisions.
- A DST gap rejects with a safe suggestion. A DST fold requires explicit
  `earlier` or `later`; it is never guessed.
- Collision is rechecked inside the owner transaction.

Normalized Week and obligation rows plus append-only operations are canonical.
`plans.plan_json` is an atomically rebuilt, hash-verified current-reader
snapshot. It is not a second independently writable truth.

## Mission integration law

The 8010E Mission surface is a read-only projection from the same authorized
Plan and exact Week revision. It is never stored separately and never receives
its own mutation route.

Selection order:

1. critical block today;
2. assessment-class block today;
3. largest goal-linked block;
4. largest movable block;
5. `Protect the day` empty state.

Ties resolve by earliest local start and then UUID. Every accepted Week command
returns Week and Mission together so stale Mission state cannot drive a command.

## Security and privacy response law

- `GET /missionmed-study-schedule/v1/week` and
  `POST /missionmed-study-schedule/v1/commands` are learner-only.
- Authentication, nonce, current entitlement, explicit actor role, rollout,
  repository mode, owner, and exact field authorization are recomputed server
  side.
- Administrators remain audit-only and mentors remain proposal-only in later
  endpoints; neither may use Week learner routes.
- Foreign or missing objects are non-enumerating.
- All namespace responses, including errors, are private and no-store.
- No Plan content, UUIDs, schedule times, request bodies, entitlement details,
  or learner identifiers enter observability events.
- No Plan truth is written to localStorage, Cache API, service workers, or
  durable browser storage.
- Student text renders with DOM text APIs, never raw HTML interpolation.

## Verification gates

Before 8010E can close, evidence must cover:

- pure command/state, canonical serialization, UUID, tombstone, collision, and
  Mission property tests;
- DST gap, both fold choices, Monday boundaries, multiple zones, and display
  boundary tests;
- exact additive schema/migration/inspection on MariaDB 10.11 and MySQL 8;
- physical current-reader and hash-corruption failures;
- first-operation atomicity and failpoints;
- same-key replay, changed-key conflict, stale revisions, two owners, and
  multi-process races;
- legacy-first and V1-first Calendar cutover races;
- REST nonce/auth/entitlement/role/field/body/non-enumeration/privacy tests;
- create, move, resize, delete, reload, pointer, touch, keyboard, conflict,
  network, route-race, and repeated mount/unmount browser tests;
- reduced motion, WCAG 2.2 AA, desktop/tablet/mobile, performance budgets, and
  Matrix cross-app regression;
- independent Herschel, Avicenna, Lorentz, Darwin, and Miyamoto closure.

## Active blockers

| ID | Gate | Current effect |
|---|---|---|
| BLK-12 | Retention/privacy policy HOLD | Blocks real data, exposure, and deployment only |
| BLK-E-COMMAND | Canonical Plan command writer and first-operation transaction absent | Blocks persistent Week mutation claim |
| BLK-E-ARBITER | Shared Calendar/V1 owner transaction absent | Blocks any writer activation |
| BLK-E-ACTOR | Production explicit learner actor adapter absent | Blocks learner exposure |
| BLK-E-ROLLBACK | Current/N-1 and backup/restore proof absent | Blocks promotion/deployment |
| BLK-E-UI | Week client/App Mode and browser evidence absent | Blocks milestone/UI/UX closure |

These are implementation work items. Only BLK-12 is currently an external
legal/privacy stop, and only at the real-data or production-exposure boundary.
