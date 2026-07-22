# 17 Remaining Risks and Opportunities

RESULT: `TRUST_FOUNDATION_COMPLETE_RELEASE_AND_PRODUCT_WORK_REMAINS`

## Remaining implementation and release risks

| Priority | Exact remaining risk | Required treatment |
| --- | --- | --- |
| Gate before any configured durable environment | Migration is additive and locally proven but unapplied outside disposable databases; no deployed schema hash exists | Independently review/freeze the recorded hash, perform the separately authorized isolated staging apply, then repeat RLS/two-session/recovery proof in staging |
| Gate before command enablement | Six domain commands have exact wire contracts but deliberately no generic handler | Inject one owning-kernel adapter per domain; prove atomic result mapping and no duplicate source of truth |
| Gate before durable traffic | HTTP composition has no durable command/query/job/asset/evidence/publication repository | Implement exact RPC adapters, safe failure mapping, health truth, and parity tests |
| Gate before durable mutation | SQL exposes reviewed worker/outbox/input RPCs but no runtime enqueue, artifact-output, domain-command, or publication-approval RPC | Design each owning mutation RPC, RLS/claim law, atomic receipt/audit/outbox, and adversarial tests in its authorized later run |
| Gate before student agency | Response contract permits only local schema-version-1 first records | Build append-only response RPC/route, optimistic versioning, supersession lineage, entitlement proof, and abuse/privacy controls |
| Gate before LIVE identity automation | LIVE automatic promotion is disabled | Signed immutable evaluation artifact, approved policy, durable replay/nonce store, reproducible corpus |
| Gate before provider calls | No supervised worker/provider runtime or live Webex proof | Queue supervisor, provider adapters, consent/retention approval, reconciliation/dead-letter tools, alerts, read-only canary |
| Gate before publication | No durable source→item mapper or student application | Exact persisted mapping, approval/current-head transaction, accessible authenticated student projection |
| Operational | No backup/restore or disaster-recovery rehearsal | PITR/replay/forward-repair drills with evidence and recovery objectives |
| Contract maintenance | JS/SQL vocabularies are checked by a local static contract, not a generated shared manifest in CI | Generate one parity artifact for enums, grants, states, RPCs, item kinds, errors, and feature planes |
| Product | Historical private UI and Partner Demo are sealed/rejected and mobile-unusable | Build CAM v2 from Architecture 005; do not renovate or inherit v1/demo design |

These are not hidden claims of 006 readiness for production. They define why the feature planes remain off and why no deployment or configured-environment migration apply occurred. The disposable PostgreSQL apply/reapply/rollback proof in reports 04 and 15 does not weaken those gates.

## Remaining product and workflow opportunities

- A ranked Today queue can explain source age, urgency, confidence, and next action instead of showing generic KPIs.
- Route-scoped student identity can unify briefing, plan, work, history, and evidence without mutable global selection.
- A provenance inspector can make AI proposals useful without presenting them as facts.
- Durable promises/open loops can measure mentor follow-through as well as student progress.
- Separate publication plus typed student responses can create an accountable acknowledgment/dispute/blocker loop after the durable stream exists.
- Typed job lineage can support transcript reprocessing, prompt/model comparisons, retention work, and accountable forward repair.
- A role-gated Operations workspace can keep pipeline health, dead letters, identity review, and reconciliation out of the mentoring flow.
- Hash-chain audit views can explain “who changed what and why” without exposing protected payloads.

## High-value improvements deliberately deferred to 007+

The remaining high-value work requires an authorized durable environment, owning-domain adapters, worker/provider operations, or product implementation. Adding shallow local handlers or a cosmetic UI in 006 would create architectural debt rather than close those gates.

Roadmap ownership is fixed by Architecture 005: MegaRun 007 owns Mentor CAM v2 Experience and Operations locally; 008 owns Student Authentication, Publication, and Agency locally; 009 owns Authorized Staging and Release Candidate work; 010 owns Production Preflight, Controlled Release, and Certification. No earlier run may borrow a later run's environment or deployment authority.

## Full-live production completion estimate

The engineering trust/data/worker foundation is materially stronger, but the end-to-end live product is approximately **25–35% complete**. The remaining 65–75% includes durable adapters and staging apply, supervised worker/provider operations, CAM v2 mentor UI, authenticated student experience, accessibility, observability, backup/restore, controlled canary, deployment authorization, and production rollout. No local test result should be converted into a higher deployment percentage.
