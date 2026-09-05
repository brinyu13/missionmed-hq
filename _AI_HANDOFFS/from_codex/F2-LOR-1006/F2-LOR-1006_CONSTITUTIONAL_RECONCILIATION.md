# F2-LOR-1006 Constitutional Reconciliation

**Ticket:** F2-LOR-1006
**Application:** MissionMed LOR Studio / LOR Builder — Build My LOR
**Date:** 2026-08-04
**Result:** PASS WITH CONDITIONS for constitutional documentation; no implementation or release authority

## 1. Authority ruling

Revision 3 is governing law for this packet. The later Founder directive in the F2-LOR-1006 ticket expressly adopts `MissionMed_Platform_v1_Governing_Constitution_Revision_3.docx`; therefore the document's title-page phrase “Finalization for Ratification” does not leave adoption unresolved for this work.

The control plane has not yet recorded a global Revision 3 adoption or an F2-LOR-specific adoption. Current `origin/main` of `brinyu13/missionmed-os` contains a D1-only adoption whose own text says it is not global. This is a filing and routing gap, not permission to ignore the F2-LOR-1006 Founder directive. Before product implementation, the Registrar must file the controlling F2/global decision and route an F2 mission, passport, and execution amendment.

Precedence used:

1. F2-LOR-1006 later Founder directive and Revision 3 constitutional law.
2. Application-specific Founder decisions that do not conflict with Revision 3.
3. F2-LOR-1004 frozen product/specification and F2-LOR-1003 frozen prototype/handoff.
4. Repository implementation and historical artifacts.
5. Recommendations in this packet, which are not ratified authority.

## 2. Continuity preserved

| Source | Preserved finding | Classification |
|---|---|---|
| `/Users/brianb/MissionMed/F2-LOR-1003-functional-prototype.html` | Frozen functional prototype; SHA-256 `8560559341895f2973c51bdf7d7ba28ba7a9890d70c6bc6eb5976fc67371e037` | Accepted product evidence, not production evidence |
| `/Users/brianb/Downloads/F2-LOR-1003-functional-prototype_1.html` | Byte-identical duplicate of the repository prototype | Verified fact |
| `/Users/brianb/Downloads/F2-LOR-1003-COMPLETE-HANDOFF.md` | Prior report: 48/48 demo assertions, 24/24 regressions, zero JS errors | Accepted prior test evidence |
| `/Users/brianb/Downloads/F2-LOR-1004_PRODUCTION_BETA_SPEC.md` | Founder-approved frozen product, workflow, IA, visual baseline, and implementation requirements | Accepted application decision, subordinate to Revision 3 |
| `/Users/brianb/Downloads/F2-LOR-1004_CODEX_IMPLEMENTATION_PROMPT.md` | Earlier executable implementation plan | Superseded as execution authority by the F2-LOR-1005 stop and this documentation-only ticket |
| F2-LOR-1005 evidence | Stopped before product code, database, WordPress, deployment, production access, backup, rollback, canary, or activation because routing and governance were absent | Verified stop condition preserved |

The prior browser assertion counts demonstrate prototype behavior only. They do not prove a deterministic production build, platform integration, authorization enforcement, staging readiness, or deployment readiness.

## 3. Revision 3 rules applied

| Revision 3 rule | Application consequence |
|---|---|
| §3.1 Application Charter | LOR Studio needs an approved name/ID, bounded domain and facts, tier, named owners, never-share data, signatures, and Registrar record before route, schema, contract, or Codex implementation authority. |
| §3.2 Shared services | LOR Studio may consume established platform services; it may not create a new shared service merely for anticipated reuse. |
| §3.3 Bounded domains | LOR Studio may own recommendation-workflow records only. It cannot take over StoryForge stories, Timeline chronology, identity, canonical files, or program intelligence. |
| §3.4 Communication contracts | Every cross-application read requires an owner-issued, Registrar-recorded contract. Direct cross-database reads are prohibited. |
| §3.5 Contract lifecycle | Contracts need active/deprecated/retired states, versioning, and N-1 compatibility where required. |
| §3.6 Exceptions | Any exception needs written scope, reason, compensating control, owner, and expiry. No oral or implicit exception is accepted. |
| §4 Lifecycle/change authority | Discovery, charter, implementation, verification, release, operation, and retirement are distinct stages with distinct authority. |
| Law 1 | Speed cannot bypass a safety stop; F2-LOR-1005 was constitutionally correct. |
| Law 2 | Every material fact has exactly one canonical owner. |
| Law 3 | Applications share contracts, never databases; allowed lanes are projections, events, or owner-mediated commands. |
| Law 4 | Identity is layered: authentication, mapping, entitlement, application identity, domain authorization, and consent; failures close access. |
| Law 5 | Events are signals, not truth. Email/link activity cannot become an unsupported “read” fact. |
| Law 6 | AI output remains a proposal until accepted by a named human; provenance remains attached. |
| Law 7 | Consent is purpose-specific, resource-specific, and revocable. |
| Law 8 | No production claim without sealed evidence. |
| Law 9 | LOR Studio must be independently deployable and rollbackable; a kill switch is not rollback. |
| Laws 14 and 16 | Student interest controls convenience, and retention/archive/export/deletion must be defined before production. |

## 4. Clause-level reconciliation matrix

`ALIGNED WITH CONDITIONS` means the product decision may stand after the named constitutional contract or authority is filed. `DEFERRED TO PLATFORM CONTRACT` means F2-LOR-1004 does not own the final implementation.

| F2-LOR-1004 assumption | Status | Constitutional reconciliation and required condition |
|---|---|---|
| Application identity “MissionMed LOR Studio / LOR Builder” | FOUNDER DECISION REQUIRED | Accepted aliases and hero name exist, but no Registrar-issued canonical application ID, tier, or signed charter exists. |
| Build My LOR as dominant entry | APPLICATION-OWNED | Frozen product law; within the eventual LOR application boundary. |
| WordPress session bootstrap | DEFERRED TO PLATFORM CONTRACT | Identity provider owns authentication. LOR must not implement its own login or copy StoryForge's exact bridge without an identity contract. |
| Matrix entry/navigation | ALIGNED WITH CONDITIONS | Matrix owns entry/navigation. LOR receives a registered route only after charter, entitlement, and rollback gates. |
| LearnDash/360 entitlement | UNKNOWN — EVIDENCE REQUIRED | The beta audience is accepted product intent, but exact entitlement owner, fields, cohort semantics, and revocation behavior are unverified. Fail closed. |
| Application authorization | ALIGNED WITH CONDITIONS | LOR owns case/resource authorization after authenticated identity and entitlement arrive through a governed contract. Server enforcement is mandatory. |
| Student ownership of cases/evidence/builds | ALIGNED WITH CONDITIONS | LOR may canonically own LOR workflow records. “Student owns” means subject/control rights, not application/database ownership. Source facts remain with source apps. |
| Faculty writer access through recipient link and OTP | ALIGNED WITH CONDITIONS | Requires identity proofing, recipient binding, revocation, rate limits, and a filed faculty-access contract. A URL token alone is not authorization. |
| Mentor assigned-student status access | ALIGNED WITH CONDITIONS | Requires authoritative assignment and entitlement contracts; status/projections only; faculty-private and waived content structurally prohibited. |
| Authorized administrator access | FOUNDER DECISION REQUIRED | “Support” and “content administration” must be separately scoped. Admin status cannot grant faculty-private or waived content. |
| Founder complete administrative/diagnostic access | SUPERSEDED | Revision 3 privacy law and the frozen permission matrix both reject unrestricted content access. Founder may administer/evaluate metadata and sealed evidence, not automatically read faculty-private drafts or waived letters. |
| Waived-letter restrictions | ALIGNED WITH CONDITIONS | Student and mentor access is structurally prohibited. Exact legal/compliance exception process and non-waived visibility require Founder/privacy ratification. |
| Faculty-private material in isolated partition/RLS | ALIGNED WITH CONDITIONS | Required invariant. Exact database, schema, service roles, and policies remain deployment-specific and cannot be selected by this packet. |
| StoryForge reads | DEFERRED TO PLATFORM CONTRACT | StoryForge owns canonical stories. LOR may receive only consented ID/version references or governed de-identified snapshots; no vault/list access or direct DB read. |
| Timeline Builder reads | DEFERRED TO PLATFORM CONTRACT | Timeline owns chronology. LOR may consume versioned rotation projections; no write-back. Manual LOR facts must be labeled noncanonical. |
| File Vault references | DEFERRED TO PLATFORM CONTRACT | File owner must issue a reference/download contract with purpose, version, revocation, and audit rules. |
| Student profile/CV reads | DEFERRED TO PLATFORM CONTRACT | Identity/profile owner retains canonical facts. LOR consumes the minimum verified projection and records source/version. |
| RISE/program-intelligence reads | DEFERRED TO PLATFORM CONTRACT | Only if required for program assignment; contract must prohibit copying a program-intelligence estate into LOR. MVP may defer it. |
| Gmail integration | ALIGNED WITH CONDITIONS | `gmail.send` least privilege is a product requirement, not provider authority. Account owner, OAuth client, token custody, retention, revocation, and audit require approval. Copy/mailto remains a safe fallback. |
| Notifications | DEFERRED TO PLATFORM CONTRACT | LOR emits bounded events; the notification owner decides channels and delivery. Events are not canonical read/approval facts. |
| AI provider access | DEFERRED TO PLATFORM CONTRACT | LOR owns the generation contract; a governed broker/provider route owns model credentials and policy. No direct client provider credential. |
| Prompts and generated options | APPLICATION-OWNED | LOR owns purpose-bound prompt templates, generation events, options, and provenance. Options remain proposals until faculty acceptance. |
| Four complete differentiated options | ALIGNED WITH CONDITIONS | Preserved product law. Every factual/evaluative statement needs provenance; differentiation may change style/emphasis, not facts. |
| Faculty ownership of final language | ALIGNED | The faculty writer is the named human acceptor. Applicant or AI text does not become final without explicit faculty review/approval/signature. |
| Database estate | FOUNDER DECISION REQUIRED | F2-LOR-1004's suggested LOR tables/schema are design inputs, not authority. Platform data estate, isolation, provider, and ledger owner must be selected. |
| Schema/migration ownership | DEFERRED TO PLATFORM CONTRACT | Exact migration system and sole writer must be named; MR-078A/MR-079 apply. No migration may begin under this ticket. |
| RLS | ALIGNED WITH CONDITIONS | Required at the authoritative data layer and backed by negative role tests. Policy details await the chosen estate and identity claims. |
| Documents/exports | ALIGNED WITH CONDITIONS | LOR may render disclosed applicant drafts and authorized faculty outputs. Export authority, confidentiality marking, access logging, and retention must be contractually defined. |
| Secrets | DEFERRED TO PLATFORM CONTRACT | Secret owner/vault injects runtime secrets; no values in Git, client bundles, logs, handoffs, or evidence. |
| Audit events | ALIGNED WITH CONDITIONS | LOR records bounded domain events; the platform audit/Registrar service owns immutable audit truth and retention. |
| Retention/deletion/archive/export | FOUNDER DECISION REQUIRED | Revision 3 requires a schedule. F2-LOR-1004 does not ratify one. Legal holds and waived-letter treatment must be explicit. |
| Backup | UNKNOWN — EVIDENCE REQUIRED | Exact data/files/provider and backup owner are unselected. A readable, target-specific restore receipt is required before mutation. |
| Rollback | UNKNOWN — EVIDENCE REQUIRED | Kill switch is not rollback. Code, route, schema, data, provider, and integration layers need independent forward/restore procedures. |
| Deployment topology | FOUNDER DECISION REQUIRED | “Within Matrix” is product intent, not a verified target, route, provider, or runtime contract. StoryForge topology is precedent, not reusable authority. |
| Health/observability | ALIGNED WITH CONDITIONS | Required metrics and alerts in F2-LOR-1004 are useful requirements; exact owners, infrastructure, SLOs, and privacy-safe logging are unresolved. |
| Evidence sealing | ALIGNED WITH CONDITIONS | Build, test, auth, privacy, migration, backup, rollback, canary, and production receipts must be sealed before claims. |
| Canary release | ALIGNED WITH CONDITIONS | Founder/Admin first, then explicit small 360 cohort is consistent, but cohort identity, consent, rollback, and go/no-go record must be filed. |
| Kill switch | ALIGNED WITH CONDITIONS | Required rapid containment control; cannot replace executable rollback or restoration proof. |
| Production activation | FOUNDER DECISION REQUIRED | Requires all gates, named release authority, intended cohort, sealed evidence, and explicit go decision. |

## 5. Conflicts and supersessions

1. F2-LOR-1004 called broad Founder access “complete.” That is superseded for protected content. Founder administration is not automatic faculty-private/waived-letter visibility.
2. F2-LOR-1004's concrete table list, separate schema recommendation, Gmail provider, and route assumptions are implementation proposals until the charter and platform contracts name owners and targets.
3. F2-LOR-1004 instructed Codex to proceed with implementation after repository inspection. F2-LOR-1005 and the later F2-LOR-1006 scope supersede that execution authority.
4. The local MissionMed OS `CURRENT.md` is stale and the current remote route contains no F2-LOR mission. Neither local nor remote D1-only authority may be borrowed for LOR.

## 6. Constitutional conclusion

The accepted product is constitutionally viable. Its strongest laws—bounded source ownership, faculty final authority, structural confidentiality, provenance, honest tracking, human acceptance, and rollback—align with Revision 3. Implementation remains blocked until the application is admitted by charter, identity/data/privacy contracts are ratified, a current F2 mission and MR-079 amendment are routed, and the deployment estate and owners are named.

## 7. Evidence

- Constitution: `/Users/brianb/MissionMed/MissionMed_Platform_v1_Governing_Constitution_Revision_3.docx`, §§3–5 and §8, SHA-256 `aea2be8e5e75495b2dee63f48de6c9ea63883c90c4b6f1d7ab4daa1989c232ce`.
- F2-LOR-1006 Founder directive: `/Users/brianb/.codex/attachments/13c00593-b897-42cc-8540-8ca1743321db/pasted-text.txt`, headings `CONTROLLING AUTHORITY`, `ACCEPTED LOR CONTINUITY`, and `PERMANENT PRODUCT AUTHORITY`, SHA-256 `c645d897fe8f07a6f547f62e01e77b007ba86bfde806220aca4549d47870e458`.
- Frozen prototype/handoff: paths and hashes in §2.
- Frozen production specification: `/Users/brianb/Downloads/F2-LOR-1004_PRODUCTION_BETA_SPEC.md`, especially §§3, 5–12, 18, 21–24, SHA-256 `7f5a6c1a8347edfcee071ae4bac024f8e3d1dc90f55fc8ce72d202b71957d8dd`.
- Execution guardrails: `/Users/brianb/MissionMed_worktrees/F2-LOR-1005/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`, MR-079 §§1, 3, 5, and 8.
- StoryForge precedent only: `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/storyforge.md` and `decisions/DR-011` through `DR-014`; these prove the required authority shape, not reusable F2 authority.
- Current control plane: `brinyu13/missionmed-os` `origin/main` at `a7d456838de20c2144d116e7af8ca74306c33c78`; no F2-LOR mission/passport/decision/authority registration found.
