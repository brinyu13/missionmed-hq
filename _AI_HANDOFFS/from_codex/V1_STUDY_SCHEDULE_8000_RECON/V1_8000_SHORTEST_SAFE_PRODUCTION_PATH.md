# V1 Study Schedule — Shortest Safe Production Path

## Strategy

Use an additive, default-off strangler module on the recovered D9-415 source.
Keep legacy Study available before cutover and as an explicit import/read-only
history source, but never expand it into the intended product or use
`mmed_events` as canonical Plan storage. After a learner's first V1 write/import,
rollback must preserve a truthful V1 read-only view rather than reactivate the
mutable legacy planner.

## V1-8010 implementation sequence

### A — Authority and baseline freeze

- Accept the V1-8000 handoff.
- Branch/worktree at `d4455bf`.
- Record identity, authority hierarchy, recovered/live hashes, Brian's controller
  override, and the one-writer boundary.
- Complete the exact 14-item authority checklist in the V1-8010 inputs,
  including physical store/transactions, access, temporal law, product-input
  durability, long-term source destination, and phase-aware rollback.
- Production characterization remains read-only. Any mutation characterization
  uses local fixtures or isolated staging only.

**Stop before schema or learner-visible code until these records pass review.**

### B — Legacy safety containment

- Tests first for owner/type and metadata preservation.
- Require Study-specific server access.
- Make update/delete reject non-Study and foreign events.
- Preserve metadata on partial update.
- No visual change.
- Mutation characterization and fixes are validated only against local fixtures
  or isolated staging; V1-8010 does not write production.

### C — Disabled seams

- Register default-off `v1_study_schedule`.
- Add access service, repository interfaces, versioned REST skeleton, tiny loader,
  route seam, and telemetry schema.
- No physical schema and no learner-visible behavior.

### D — Plan persistence

- Additive Plan-owned schema only after decision.
- Operation log, revisions, database-enforced idempotency, verified transaction
  engine/isolation, migration lock, tombstones, backups, snapshots/compaction,
  failure injection, atomic first-write/cutover watermark, preview-CAS, and
  dry-run evidence.
- Flag remains off.

### E — First vertical slice

- Explicit learner-principal staging Week canvas with D9-300 visual/interaction
  language; administrators remain audit-only.
- Create, move, resize, complete, delete, and reload one Plan-owned block.
- Prove refresh, duplicate retry, stale revision, two-tab, two-user, collision,
  timezone, keyboard, and touch behavior.

### F — Execution engine

- Mission, Day, Focus, now/next/later.
- Planned versus actual, partial/missed/completed/skip.
- Closeout and deterministic humane streak.

### G — Recovery and reserve

- Conservation rules, learner-confirmed reflow, explicit reserve, missed-work and
  rest-day edge cases.

### H — Complete temporal product

- Month, Journey, Review, Quick Build, recurrence, goals/runways, capacity,
  settings, mentor ghosts, fixed-anchor and context adapters, timer/pill/phone
  companion.

### I — Staging release package

- Immutable content-hashed assets.
- Runtime manifest and guard.
- Full CI/security/a11y/responsive/performance evidence.
- Migration preview, backup, mode state machine, current/N-1 fallback reader,
  atomic-watermark and pre/post-cutover continuity rehearsal.
- Exercise this staging-development package in staging only. No production
  deploy; it is not yet the release-candidate digest.

### J — Implementation closeout and staging handoff

- Run audit-only admin review and explicit learner-principal flows in staging.
- Close the implementation acceptance matrix and produce the V1-8020 input
  package.
- No production cohort, production E2E, or production mutation.

## Subsequent MegaRuns

- **V1-8020:** independent 9+/10 UI/UX/accessibility/mobile/performance loop in
  staging; every change reruns affected V1-8010 gates and produces a new staging
  package.
- **V1-8030:** integrated stress, migration, concurrency, security, and release
  candidate; freeze the immutable digest and rehearse its exact rollback package.
- **V1-8040:** only after V1-8020 and V1-8030 pass, controlled production
  deployment of that exact frozen digest, explicit learner pilot, 25% eligible,
  all eligible, and authenticated production end-to-end verification. Any
  post-freeze code/package change returns to V1-8030.
- **V1-8050:** post-launch monitoring, defect closure, rollback retention, and
  final closeout.

## Prohibited shortcuts

- Rename legacy Study and call it V1.
- Use Calendar `study_block`, unknown Supabase, or diagnostic tables as Plan
  storage.
- Add `study` to a client allowlist and call entitlement solved.
- Use generic `is_user_logged_in()` for V1 REST.
- Dual-write Calendar and Plan.
- Allow mentor direct edits or external silent completion.
- Deploy prototype HTML/localStorage.
- Edit the current hashed shell in place.
- Combine schema, UI, entitlement, and rollout in one commit.
- Refactor unrelated Student OS, Calendar, Scheduler, Webex, auth, or framework
  systems.
- Deploy or ramp production during V1-8010, V1-8020, or V1-8030.
- Drop Plan tables as rollback.

## Exact next action

Open V1-8010A on a new branch at `d4455bf` and complete the exact 14-item
authority checklist plus non-mutating production observation and local/isolated-
staging legacy characterization before any schema or visible V1 implementation.
