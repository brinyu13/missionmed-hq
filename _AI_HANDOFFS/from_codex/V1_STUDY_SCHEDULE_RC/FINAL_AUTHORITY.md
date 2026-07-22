# V1 Study Schedule — Final Authority and Post-E3 Binding Decision

Date: 2026-07-22  
Ticket: `V1-STUDY-SCHEDULE-RC`  
Status: ACCEPTED FOR A DEFAULT-OFF, NONDEPLOYED PRODUCTION-CONNECTED RELEASE CANDIDATE

## Product identity

- Product: **V1 Study Schedule**
- Purpose: learner academic study planning and execution
- Historical aliases: Matrix Plan, Study Schedule, Study Scheduler, D9 Matrix Plan
- Excluded products: MissionMed Scheduler, appointment booking, Calendar App, Webex scheduling, office-hours scheduling, and interview scheduling

## Governing authority

The Founder restart directive in the active Codex task authorizes recovery of the highest verified state and completion of a production-connected release candidate. It expressly prohibits production deployment before Founder review and approval.

Accepted V1-8010A decisions and the 8010R/E0-E3 contracts remain binding where they do not conflict with this later, narrower release-candidate decision. D9-360 is the current visual and interaction donor; V1 identity, access, privacy, persistence, and role contracts outrank prototype behavior.

MissionMed_OS has no current V1 mission or passport and `CURRENT.md` is unrelated. Local and fetched MissionMed_OS authority are byte-aligned at `8aacfa690ed7e033d0997af392bf07a9b648dd46`; its unrelated untracked handoffs are preserved. The active Founder directive therefore supplies the mission authority for this product worktree. MissionMed_OS remains read-only.

## Source authority

- Last fully green rollback base: `458f93bb2cf7a2cc9b20f9289ce8e241d97815c7`
- Newest implemented parent: `f91a2d7b6b86ea7a9282b1a7381f75cd5378fcc2`
- Parent tree: `39245e4dd98a290156a97f09a9804ae4dcfc5aef`
- RC worktree: `/Users/brianb/MissionMed_worktrees/V1-StudySchedule-RC`
- RC branch: `codex/v1-study-schedule-production-connected-rc`

`f91a2d7` is an implemented but initially red candidate, not a verified release authority. Its four red jobs shared one stale 8010C wildcard assertion. The isolated repair retains the exact E3 exception and proves that the owner arbiter remains absent from plugin bootstrap. No application behavior was changed by that repair.

## Post-E3 decision

The E3 prohibition on runtime binding is superseded only for source-level construction and verification of this default-off release candidate. This decision does not approve schema commissioning, live options, real learner data, cohort exposure, production telemetry, staging mutation, or deployment.

The RC may add or modify the minimum product-repository source required to prove:

1. an explicit request-local runtime factory that fails closed and is inactive unless exact release control authorizes it;
2. a single shared owner transaction and lock order for legacy Calendar Study and V1 commands;
3. a revision-zero importer that consumes the exact locked eligible legacy Study snapshot or refuses cutover;
4. a commit-fresh, same-connection permit/revocation epoch authorizer;
5. additive physical schema descriptors, restore census, and current/N-1 reader compatibility without commissioning a real database;
6. hidden learner-only Week read and command endpoints with exact nonce, method, content-type, size, shape, rate, role, entitlement, privacy, and response allowlists;
7. one content-addressed V1 client and one Matrix `#study` mount owner, with no dual hydration or dual writer;
8. explicit containment or shared-arbiter routing for Calendar bulk, enrollment, Session Manager, and other proven `study_block` write seams;
9. exact-digest packaging, rollback evidence, browser review evidence, and cross-application regression coverage.

## Protected boundaries

- The canonical Matrix lock manifest and MissionMed_OS are not write targets.
- Protected Matrix controller and immutable base JavaScript remain unchanged.
- Any protected application-source edit requires a passing Matrix preflight first and fresh post-change regression evidence.
- Shared authentication, entitlement, Calendar non-Study behavior, and unrelated Matrix applications must remain behaviorally compatible.
- No secrets, student content, identifiers, tokens, credentials, or private data may enter reports, fixtures, screenshots, command arguments, or Git history.
- Persistence changes are additive source descriptors only in this mission; no live WordPress database mutation is authorized.

## Decision 12 and deployment

Decision 12 remains **HOLD** for real learner data, cohort exposure, activation, production telemetry, and deployment. The release candidate must stay fail-closed and default-hidden. Founder design-freeze review is required before any later deployment approval.

