# F2-LOR-1006 Application Charter and Passport Candidate

**Status:** CANDIDATE — NOT RATIFIED, NOT REGISTERED, NOT IMPLEMENTATION AUTHORITY
**Controlling law:** MissionMed Platform v1 Governing Constitution Revision 3, §3.1
**Purpose:** Provide a decision-complete candidate in the repository's Markdown passport convention without mutating MissionMed OS authority.

## 1. Admission status

Revision 3 says an application without an approved charter has no canonical ID, route, schema, contract, or Codex authority. No F2-LOR charter/passport exists in the current MissionMed OS route. This file therefore cannot itself admit the application. Architecture Authority review, Founder approval, named-owner acceptance, and Registrar filing remain mandatory.

## 2. Candidate charter

| Field | Candidate value | Authority state |
|---|---|---|
| Canonical application name | MissionMed LOR Studio | FOUNDER DECISION REQUIRED; recommended because it names the complete application |
| Canonical application ID | MISSING — NOT VERIFIED | FOUNDER DECISION REQUIRED; do not infer an ID from ticket prefix |
| Product hero | Build My LOR | Accepted product decision |
| Aliases | LOR Builder; Writer Depot; Examples & Templates | Accepted product names; they are areas of LOR Studio, not separate applications |
| Bounded domain | Recommendation-case planning; applicant-prepared letter options; LOR-specific evidence selection; writer handoff; faculty review/approval workflow; authorized delivery/tracking projections | Candidate boundary derived from frozen product and Revision 3 |
| Application tier | MISSING — NOT VERIFIED | FOUNDER DECISION REQUIRED after platform tier definitions are confirmed |
| Product owner | Brian / MissionMed Founder is the recommended owner | PARTIAL; Founder approved product, but no filed charter acceptance was found |
| Technical owner | MISSING — NOT VERIFIED | Named acceptance required |
| Operational owner | MISSING — NOT VERIFIED | Named acceptance required |
| Privacy owner | MISSING — NOT VERIFIED | Named acceptance required |
| Backup owner | MISSING — NOT VERIFIED | Named acceptance required after data estate selection |
| Rollback owner | MISSING — NOT VERIFIED | Named acceptance required after topology selection |
| Health owner | MISSING — NOT VERIFIED | Named acceptance required |
| Evidence owner | MISSING — NOT VERIFIED | Registrar/release evidence role required |
| Canonical repository | `https://github.com/brinyu13/missionmed-hq.git` | Verified repository remote and GitHub repository metadata |
| Current documentation worktree | `/Users/brianb/MissionMed_worktrees/F2-LOR-1005` | Verified fact, not yet an implementation authority worktree |
| Current branch | `codex/f2-lor-1005-production-beta` | Verified fact; clean at preflight |
| Current HEAD | `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` | Verified fact |
| Accepted source baseline | F2-LOR-1003 prototype + handoff; F2-LOR-1004 frozen specification | Accepted decision |
| Protected visual authority | `/Users/brianb/MissionMed/F2-LOR-1003-functional-prototype.html`, SHA-256 `8560559341895f2973c51bdf7d7ba28ba7a9890d70c6bc6eb5976fc67371e037` | Protected frozen reference; no redesign |
| Deployment target/route | MISSING — NOT VERIFIED | FOUNDER DECISION REQUIRED; “inside Matrix” is intent, not a target |
| Data estate/provider | MISSING — NOT VERIFIED | FOUNDER DECISION REQUIRED after platform architecture recommendation |
| Current stage | Constitutional reconciliation / pre-admission | Verified classification |
| Next authorized step | Ratify and register charter, privacy decisions, platform contracts, mission route, and F2 MR-079 amendment | Recommendation |

## 3. Domain boundary

### LOR Studio may own

- recommendation cases and their LOR-specific lifecycle;
- LOR-specific writer/contact association and relationship assessment, without duplicating canonical identity or rotation facts;
- evidence-selection decisions and purpose-specific consent receipts for LOR use;
- references to externally owned records with source ID, version, purpose, and revocation state;
- applicant-prepared letter options, edits, provenance, and generation events;
- writer handoff package configuration and LOR-specific collaboration messages;
- faculty-private review workspace records and the faculty-approved final artifact, subject to the ratified privacy/waiver law;
- LOR delivery state and confidence-qualified tracking projections;
- LOR template-library content and editorial lifecycle;
- LOR-specific audit events before they are sealed into the platform audit authority.

### LOR Studio must not own

- WordPress/Matrix authentication, platform identity, roles, entitlements, or mentor assignments;
- canonical Timeline rotations, chronology, sites, or experience records;
- canonical StoryForge stories or private story vault contents;
- canonical CV/profile facts or files;
- canonical program intelligence, requirements, or residency outcomes;
- email-provider identity or mailbox content;
- provider credentials, secret values, or platform keys;
- another application's schema, migrations, audit ledger, or deployment route.

### Never-share data

The charter must explicitly record these as never-share outside their authorized lane:

1. waived-letter content to student, mentor, administrator, support/operator, or other applications;
2. faculty-private questionnaire answers, comparison, endorsement, notes, edit history, and unsealed/final text to student, mentor, ordinary administrator, support/operator, or other applications;
3. unpermissioned/private StoryForge content;
4. patient-identifying information;
5. provider secrets, OAuth tokens, OTP values, cookies, session material, raw credentials, or encryption keys;
6. AI inputs/outputs beyond the minimum named purpose and authorized service identity;
7. cross-student records;
8. raw private content in logs, analytics, screenshots, fixtures, handoffs, or sealed evidence.

## 4. Identity, entitlement, authorization, and consent

| Layer | Owner | LOR requirement | Current state |
|---|---|---|---|
| Authentication | Platform identity/WordPress-Matrix owner | Receive verified session identity through a filed contract; no LOR login | Contract missing |
| Identity mapping | Platform identity owner | Stable platform subject ID; recipient-bound faculty identity binding | Contract missing |
| Entitlement | Platform/LearnDash or successor | Exact current-360 entitlement, mentor assignment, admin scope, Founder role | Fields/owner unverified |
| Application identity | Registrar | Canonical LOR application ID and registered route | Missing |
| Domain authorization | LOR Studio | Case ownership, assigned mentor projection, writer-case scope, administrator function scope | Requirements defined; implementation absent |
| Consent | Canonical source + LOR | Per-source, per-case, per-purpose grant with revocation | Requirements defined; contract absent |

All failures must be fail-closed. Hidden navigation, role names alone, a possession-only URL, or client-side filtering are not authorization.

## 5. Providers and dependencies

No provider, route, project, service, database, bucket, environment variable, or secret store is authorized by this candidate.

| Dependency | Requirement | Status |
|---|---|---|
| Matrix entry/navigation | Registered module/route contract and independent rollback | Required; unresolved |
| Identity/entitlement | Platform contract with revocation and negative tests | Required; unresolved |
| Timeline Builder | Versioned rotation projection, read-only | Required for integrated experience; manual fallback permitted |
| StoryForge | Consent-bound story reference/snapshot contract | Optional for MVP but first-class for accepted product |
| File Vault/profile | Minimum verified reference/projection | Optional/deferred until contract exists |
| Email | Provider adapter; `gmail.send` only if approved; copy/mailto fallback | Optional for initial local implementation |
| Notification/event service | Bounded events, no protected payloads | Optional/deferred |
| AI broker/provider | Server-side governed broker with provenance/audit | Required for real AI; deterministic truthful fallback allowed before enablement |
| Document generation | Server-side authorized renderer with confidentiality marking | Required before beta |
| Data estate | Isolated, RLS-capable, migration-ledger governed | Required; unresolved |

Prohibited dependencies: undocumented database joins, direct source-app storage access, shared service credentials in the client, StoryForge/Timeline implementation reuse without contract, WordPress DB writes, and importing D1 or StoryForge provider authority by analogy.

## 6. Release and operational passport

| Area | Required passport entry | Current state |
|---|---|---|
| Mission ID | Current registered F2 implementation mission | Missing |
| Sole writer | Exact Codex task/worktree/branch allowed to mutate source | Missing |
| Accepted baseline | Exact prototype/spec hashes | Verified |
| Candidate commit | Exact implementation revision | Not applicable yet |
| Runtime owner | Exact route/runtime/provider | Missing |
| Database owner | Exact project/service/schema/role | Missing |
| Cohort | Exact identities/entitlement query and size | Product intent only; not registered |
| Feature state | Feature-off installation then bounded enablement | Requirement only |
| Restore points | Per-layer IDs, timestamps, scope, readability, RTO, owner | Missing |
| Rollback | Layer-specific executable procedure | Missing |
| Health | Shared-platform, application, auth, data, queue, document and provider checks | Requirements only |
| Evidence | Build/test/security/privacy/backup/rollback/canary receipts | Missing |
| Terminal state | Documented deployed/rolled-back/blocked vocabulary | To be defined by release authority |

## 7. Admission blockers

1. No Registrar-issued application ID, tier, or signed owner set.
2. No current F2 mission in `missions.json`, `products_index.json`, `authority_index.json`, or generated `CURRENT.md` on current remote MissionMed OS.
3. No F2 decision record adopting Revision 3 and the frozen LOR baseline into execution scope.
4. No ratified LOR privacy/access/waiver law.
5. No identity, entitlement, source-app, audit, retention, or provider contracts.
6. No selected data estate, migration ledger, route, deployment target, backup, or rollback owner.
7. MR-079 lacks an F2-scoped command/provider/path amendment for build, test, migration, commit, push, provider access, deploy, canary, or production verification.

## 8. Registration action required

The next authority ticket should convert this candidate—not re-derive it—into the repository's official control-plane records after Founder decisions. It must update the passport, mission registry, product index, authority index, decision record(s), and generated current-state record through the MissionMed OS registrar/generator. This document must not be copied into those records without owner acceptance and a scoped MR-079 amendment.

## 9. Evidence

- Revision 3 §3.1 charter requirements and §3.3 domain law: `/Users/brianb/MissionMed/MissionMed_Platform_v1_Governing_Constitution_Revision_3.docx`.
- Passport precedent: `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/storyforge.md` and remote `PRODUCT_PASSPORTS/timeline-builder.md`; precedent does not confer F2 authority.
- Current OS remote: `brinyu13/missionmed-os` `origin/main` `a7d456838de20c2144d116e7af8ca74306c33c78`, inspected 2026-08-04.
- Frozen application sources and hashes: `F2-LOR-1006_CONSTITUTIONAL_RECONCILIATION.md` §§2 and 7.
