# V1 Study Schedule — Product Passport

Version: RC-1  
Date: 2026-07-22  
Status: LOCAL PRODUCT AUTHORITY FOR `V1-STUDY-SCHEDULE-RC`

## Identity

**V1 Study Schedule** is the learner-facing academic planning and execution application inside Matrix. It helps a learner decide what to do now, next, and later; build and adapt a study plan; protect work and recovery time; and reduce cognitive load.

Historical aliases are Matrix Plan, Study Schedule, Study Scheduler, and D9 Matrix Plan. User-facing copy must use **V1 Study Schedule**.

## Not this product

- MissionMed Scheduler or `scheduler_v1.html`
- appointment, Webex, office-hours, interview, or session booking
- Matrix Calendar as a standalone product
- Scheduler broker or scheduler-mount implementation
- unrelated CAM, Arena, RankListIQ, File Vault, StoryForge, or authentication work

Those systems may be inspected only to preserve shared Matrix, identity, entitlement, navigation, or Calendar Study write contracts.

## Personas and roles

- Learner: sole owner and mutator of Plan truth.
- Mentor: assignment-scoped proposals only; never direct Plan mutation.
- Administrator: audit and operational health only; never learner impersonation or Plan mutation.
- Unknown, expired, revoked, or ambiguous actor: fail closed and non-enumerating.

## Experience contract

The temporal rail is Mission, Day, Week, Month, Journey, and Review. Mission is the default. Week is the arrangement canvas. Focus, closeout, and recovery help execute and adapt the plan.

Preserve D9-360's CAM-family ink shell, ember interaction accent, family-color semantics, clear hierarchy, humane recovery language, Journey station geometry, and cognitive-load reductions. Remove prototype-only claims, external fonts, decorative pressure mechanics, and any behavior that conflicts with accessibility, privacy, or server truth.

Mobile Week is a day pager, not a compressed seven-column board. All direct manipulation requires keyboard and touch alternatives. Reduced-motion preference overrides in-app motion choices. Sound is off by default.

## Data ownership

- WordPress identity and role evidence remain server-owned.
- V1 Plan, Week, Block, operation, receipt, temporal, and watermark records are canonical only in the additive V1 InnoDB store.
- Calendar may supply locked legacy Study input during revision-zero cutover but is not Plan storage.
- `plan_json` is a verified current-reader projection, not an independent writer.
- Browser durable storage must not contain Plan truth, learner text, credentials, or private schedule data.

## Runtime and security

- V1 is default-hidden until exact control, entitlement, exposure, reader, release, and asset digests authorize it.
- Routes are private/no-store and learner-only unless a separately governed audit/proposal endpoint exists.
- Actor, owner, entitlement, assignment, timezone, and temporal policy are server-derived.
- Commands require exact bodies, decimal expected revision, and a 16–64 byte case-sensitive idempotency key.
- All shared Study mutations use one pinned database connection, one owner transaction, and one lock order.
- Unknown responses collapse to a generic safe error; no raw SQL, exceptions, identifiers, receipts, entitlement details, or learner content may escape.

## Protected and do-not-touch boundaries

- MissionMed_OS and canonical lock manifests
- protected Matrix controller/base assets except under a separately approved lock update
- shared auth/session/bootstrap/exchange behavior
- unrelated Calendar event types and unrelated Matrix applications
- live WordPress data, options, schema, feature flags, cohorts, and production telemetry in this mission
- production deployment without a later explicit Founder approval

## Release gates

The release candidate requires green deterministic and physical suites, exact digest identity, rollback package, no P0/P1 findings, WCAG 2.2 AA evidence, 320px–1440px responsive evidence, performance and security reports, independent review, and a Founder design-freeze package. Deployment remains a separate decision.

