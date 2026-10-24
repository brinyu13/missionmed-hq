# F2-LOR-1006 Founder Decisions Required

Only decisions that cannot be closed by repository evidence are listed. Recommendations are not ratified authority.

## Decision 1 — Canonical application identity and tier

- **Question:** Ratify the canonical name, application ID, aliases, bounded domain, and platform tier.
- **Why technical evidence cannot decide it:** Revision 3 reserves admission and ID issuance to Founder/Registrar authority; no F2 passport exists.
- **Evidence checked:** Revision 3 §3.1; F2-LOR-1003/1004 names; MissionMed OS passports, missions, product and authority indexes.
- **Recommended option:** Canonical name `MissionMed LOR Studio`; hero `Build My LOR`; `LOR Builder`, `Writer Depot`, and `Examples & Templates` as internal product areas. Registrar should issue an ID under the current naming canon rather than copying the ticket prefix.
- **Safest fallback:** No route, schema, cross-app contract, or implementation authority.
- **Consequence of delay:** Blocks implementation and every later gate.

## Decision 2 — Named accountable owners

- **Question:** Name and obtain acceptance from product, technical, operational, privacy, backup, rollback, health, evidence, and release owners; name the sole implementation/production writer per mission.
- **Why technical evidence cannot decide it:** Responsibility is a human authority assignment.
- **Evidence checked:** Revision 3 charter requirements; StoryForge and Timeline passport precedents; F2-LOR-1004 beta roles.
- **Recommended option:** Brian / MissionMed Founder as product owner; assign distinct competent named owners for technical, operations/privacy, and release evidence, allowing one person to hold multiple roles only explicitly.
- **Safest fallback:** Documentation and synthetic local planning only.
- **Consequence of delay:** Blocks implementation authority, provider work, backup/rollback, canary, and production.

## Decision 3 — Ratified privacy, waiver, and privileged-role law

- **Question:** Ratify the access matrix, especially non-waived final-letter release, waiver creation/revocation, faculty-private boundary, legal/compliance exceptions, internal mentor notes, and Founder/admin/support access.
- **Why technical evidence cannot decide it:** These are privacy and policy choices with student/faculty trust consequences.
- **Evidence checked:** Revision 3 Laws 4, 7, 14, 16; F2-LOR-1003/1004 confidentiality rules; no filed LOR privacy matrix found.
- **Recommended option:** Adopt the matrix in `F2-LOR-1006_PRIVACY_ACCESS_AND_DATA_OWNERSHIP.md`: waived and faculty-private content structurally denied to student, mentor, Founder, admin, support, and other apps; non-waived final released only after explicit faculty approval.
- **Safest fallback:** Protected content accessible only to the relevant verified faculty writer and minimum processing service.
- **Consequence of delay:** Does not block visual/local synthetic port after charter, but blocks real-data design, integration, staging, canary, and production.

## Decision 4 — Identity, entitlement, and beta cohort authority

- **Question:** Select the authoritative identity/entitlement owner and ratify exact current-360 eligibility, mentor assignment, admin/support scope, external faculty proofing, consent, cohort sequence, and revocation cadence.
- **Why technical evidence cannot decide it:** The repo does not verify exact claims/fields or who may participate.
- **Evidence checked:** F2-LOR-1004 beta audience and role matrix; Revision 3 identity chain; current OS route; identity source not found as an F2 contract.
- **Recommended option:** Platform session + stable subject ID; exact current-360 entitlement; assignment-scoped mentor; function-scoped admin/support; recipient-bound faculty link plus OTP; Beta 0 Founder/Admin synthetic, then 5–10 explicitly consenting 360 students.
- **Safest fallback:** Synthetic local accounts only; no real identities or links.
- **Consequence of delay:** Blocks platform adapter, real-data staging, canary, and activation.

## Decision 5 — Canonical data estate, migration ledger, route, and deployment target

- **Question:** Select the exact application data estate/schema isolation, migration owner/ledger, environments, same-origin route/runtime, providers/projects/services/buckets, and secret owner.
- **Why technical evidence cannot decide it:** “Inside Matrix” does not identify a deployable target; F2-LOR-1004 recommendations are not runtime evidence.
- **Evidence checked:** F2-LOR-1004 §§18 and 23; current MissionMed repo/OS; StoryForge and Timeline deployments as non-transferable precedent.
- **Recommended option:** Architecture Authority should choose the smallest existing Matrix-aligned runtime that is independently deployable/rollbackable, with an isolated LOR namespace/role and RLS. Do not copy StoryForge topology unless direct current evidence makes it the platform standard.
- **Safest fallback:** Self-contained local implementation with synthetic data and no provider connection.
- **Consequence of delay:** Blocks migrations, integration environments, backup, staging, canary, and production; may allow only framework-neutral UI planning after charter.

## Decision 6 — Retention, archive, export, deletion, and source-revocation schedule

- **Question:** Ratify durations and behavior for cases, drafts/options, faculty content, waived letters, AI records, media, OAuth/Depot tokens, provider metadata, audit events, exports, account deletion, legal hold, and backup expiry.
- **Why technical evidence cannot decide it:** Revision 3 requires a policy; legal/privacy/product tradeoffs are not in the current LOR authority.
- **Evidence checked:** Revision 3 Law 16 and §8 remaining decisions; F2-LOR-1004 lifecycle/security sections.
- **Recommended option:** Purpose-minimized schedule with short token/media lifetimes, explicit season closure, immutable minimal audit/provenance, and documented legal-hold exceptions; source revocation stops future use immediately and follows the ratified sealed-artifact rule.
- **Safest fallback:** No real data; synthetic fixtures only.
- **Consequence of delay:** Blocks real-data staging and production.

## Decision 7 — Provider and communication strategy

- **Question:** Approve whether Gmail is a beta provider, the OTP/transactional email owner, notification/event owner, AI broker/provider, and document-render service; name token/secret custody.
- **Why technical evidence cannot decide it:** Product intent names Gmail/OpenAI-first behavior but no provider accounts, clients, contracts, or owners are authorized.
- **Evidence checked:** F2-LOR-1003 AI/email contracts; F2-LOR-1004 §§9–12 and known unknowns; no F2 provider decision found.
- **Recommended option:** Keep provider adapters optional: copy/mailto first; add Gmail with `gmail.send` only after approval; use platform transactional email for OTP if governed; route AI through the platform broker where available; server-side document generation.
- **Safest fallback:** Deterministic labeled local generation, manual email handoff, no secure live Depot link.
- **Consequence of delay:** Does not block core synthetic UI implementation after authority, but blocks real AI, real Depot verification, integrated email, and beta gates.

## Decision 8 — Contract owners and MVP dependency set

- **Question:** Ratify which source integrations are required for MVP and direct their canonical owners to issue versioned contracts for Matrix, identity/entitlement, Timeline, StoryForge, File Vault/profile, RISE/program intelligence, audit, notification, email, and AI.
- **Why technical evidence cannot decide it:** One application cannot unilaterally grant access to another owner's records.
- **Evidence checked:** Revision 3 §§3.3–3.5 and Laws 2–3; F2-LOR-1004 integrations; source application passports where available.
- **Recommended option:** MVP-required: Matrix/identity/entitlement, Timeline projection, LOR data/audit, document render. Optional/deferred behind truthful states: StoryForge, File Vault/profile, RISE, Gmail/notifications. Real AI required only before AI beta exposure.
- **Safest fallback:** Manual entry with provenance and synthetic local data; never direct DB access.
- **Consequence of delay:** Blocks only the corresponding adapter, except identity/data/audit which block any real-user environment.

## Decision 9 — Production release and canary law

- **Question:** After implementation evidence exists, ratify the exact route, cohort, canary duration/thresholds, mandatory rollback triggers, release owner, and final go/no-go authority.
- **Why technical evidence cannot decide it:** Production population and risk acceptance are Founder/release decisions.
- **Evidence checked:** F2-LOR-1004 Beta 0/1/2 and release gates; Revision 3 Laws 8–9; StoryForge staged-release precedent.
- **Recommended option:** Feature-off deployment; synthetic Founder/Admin validation; explicit 5–10 student canary only after privacy/AI/backup/rollback gates; expand only after a bounded observation period with zero privacy P0/P1 events and a documented go decision.
- **Safest fallback:** Feature remains off and route inaccessible.
- **Consequence of delay:** Does not block authorized local implementation; blocks production mutation, canary, and activation.

## Decision package recommendation

Resolve Decisions 1–8 in an authority-closure ticket before product implementation. Decision 9 should be recorded as provisional release law then confirmed with evidence immediately before production. The Registrar should preserve each decision's scope, owner, effective date, expiry/exception behavior, and relationship to Revision 3.
