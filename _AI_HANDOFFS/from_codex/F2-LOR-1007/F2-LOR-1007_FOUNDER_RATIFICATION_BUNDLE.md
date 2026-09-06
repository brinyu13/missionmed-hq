# F2-LOR-1007 Founder Ratification Bundle

**Founder response:** `APPROVE ALL`
**Approval date:** 2026-08-04
**Approved source SHA-256:** `7fcafb546c56a327245ac7ac094484ed7837e5850e1135f69ae7917bba198206`
**Effect:** Sections 1–12 below are ratified exactly as supplied. Filing becomes effective only when the corresponding MissionMed OS authority commit is confirmed on canonical remote `main`.

---

MISSIONMED FOUNDER DECISION AND RATIFICATION BUNDLE

TICKET: F2‑LOR‑1007‑RATIFICATION
APPLICATION: MissionMed LOR Studio
STATUS: PROPOSED — NOT EFFECTIVE UNTIL APPROVED BY THE FOUNDER
AUTHORITY BASIS: F2‑LOR‑1006 Constitutional Reconciliation and Deployment-Gate Authority Packet

PURPOSE

This instrument resolves the Founder-level decisions isolated by F2‑LOR‑1006. It preserves the accepted F2‑LOR‑1003 prototype and F2‑LOR‑1004 production-beta specification without redesign.

Approval of this instrument authorizes authority registration and implementation preparation. It does not authorize production deployment, unrestricted protected-content access, intended-user activation, or destructive data operations.

=========================================================

1. APPLICATION IDENTITY AND ADMISSION
    =========================================================

RATIFIED DECISION:

• Canonical application name: MissionMed LOR Studio
• Canonical application identifier: F2‑LOR
• Primary user-facing experience: Build My LOR
• Recognized product areas: LOR Builder, Writer Depot, and Examples & Templates
• Application tier: Tier 2 — Protected Workflow Application
• Application domain: Recommendation-case preparation, evidence selection, applicant-prepared letter options, faculty collaboration, faculty approval, document generation, and delivery/tracking metadata
• Canonical repository: brinyu13/missionmed-hq
• Protected visual and behavioral authority: F2‑LOR‑1003 and F2‑LOR‑1004, subordinate to the MissionMed Platform v1 Governing Constitution Revision 3

MissionMed LOR Studio is admitted as a bounded MissionMed Platform application. It does not own identity, enrollment, StoryForge stories, Timeline chronology, canonical files, student profiles, or RISE program intelligence.

=========================================================
2. ACCOUNTABLE OWNERS

RATIFIED DECISION:

Until formally delegated through a later Founder decision, Dr Brian, MissionMed Founder, is the interim accountable:

• product owner;
• technical authority;
• operational owner;
• privacy authority;
• backup authority;
• rollback authority;
• health and observability authority;
• evidence authority;
• release and go/no-go authority.

These assignments establish accountability. They do not grant routine access to faculty-private or waived-letter content.

Claude, Codex, contractors, service identities, and automated systems are execution resources—not owners—and receive only ticket-specific, least-privilege authority.

No other person is assigned an ownership role through this instrument.

=========================================================
3. PRIVACY, WAIVER, AND FACULTY-PRIVATE LAW

RATIFIED DECISION:

A. Student/applicant access

Students may access:

• their evidence and source selections;
• applicant-prepared options;
• writer identity and relationship information they supplied;
• consent and waiver receipts;
• permitted status and delivery metadata;
• non-waived final letters only when the faculty writer affirmatively releases the letter to the student.

Students may never access:

• faculty-private questionnaires;
• faculty-private notes;
• faculty editing history designated private;
• waived final letters;
• provider secrets, internal audit records, or another student’s records.

B. Faculty-writer access

A verified faculty writer may access only the assigned recommendation case and the student material purposefully shared for that case.

The faculty writer controls:

• faculty questionnaire responses;
• faculty-private notes;
• faculty edits;
• approval or rejection of proposed language;
• the final letter;
• signature authorization;
• whether a non-waived final letter is released to the student.

The faculty writer remains the final human authority for all letter language.

C. Mentor access

Mentors receive assignment-scoped status and strategy information only.

Mentors may not access:

• faculty questionnaires;
• applicant-prepared letter text;
• faculty edits or notes;
• waived or non-waived final letters;
• protected exports.

Any broader mentor access requires a later explicit Founder decision and appropriate student and faculty consent.

D. Founder, administrator, support, and operator access

Founder, administrator, support, and operator roles do not confer routine access to faculty-private or waived-letter content.

They may access the minimum metadata required for:

• case administration;
• access troubleshooting;
• delivery troubleshooting;
• security investigation;
• audit verification;
• legally required records handling.

Protected letter content remains structurally denied unless access is compelled by law or affirmatively authorized in writing by the faculty writer for a specific purpose. Any exceptional access must be time-limited, purpose-bound, and immutably audited.

E. Service identities

Service identities receive only the minimum case-scoped information needed to perform an authorized operation. They may not reuse content for model training, advertising, unrelated analytics, or secondary product development.

F. Waiver law

Waiver state must be explicit, versioned, timestamped, and supported by an immutable receipt.

A waived letter is structurally unavailable to the student, mentor, routine administrator, support operator, Founder, and unrelated applications.

A waiver may not be silently reversed. Any legally permissible change requires a new explicit receipt and must not retroactively disclose previously protected content.

=========================================================
4. IDENTITY, ENTITLEMENT, AND INITIAL COHORT

RATIFIED DECISION:

• LOR Studio will use the governed MissionMed/Matrix identity chain and will not create an independent student login system.
• Initial student entitlement is limited to active Tier 3 / 360 Match Mentorship students specifically enabled for LOR Studio.
• Menu visibility or possession of a URL does not constitute authorization.
• Authorization must be enforced server-side at the application and resource level.
• Faculty access requires a recipient-bound, expiring, revocable invitation plus verified email possession using a one-time code or equivalent approved verification.
• A URL alone is insufficient for faculty access.
• Faculty access terminates upon revocation, expiration, completed delivery where applicable, or case closure.
• Initial real-user beta is limited to three to five consenting 360 students and their verified faculty writers.
• Synthetic-data testing and privacy-negative testing must pass before any real-user beta begins.
• No real-user cohort is activated automatically by this ratification.

=========================================================
5. DATA ESTATE, ROUTE, AND TECHNICAL TOPOLOGY

RATIFIED POLICY:

• LOR Studio will own a logically isolated F2‑LOR application schema or equivalent bounded data domain within the constitutionally approved MissionMed data estate.
• It will not create undocumented direct dependencies on another application’s tables or database.
• Cross-application information must arrive through registered, versioned contracts.
• Migrations must use the authoritative MissionMed migration ledger and additive, reversible procedures.
• Row-level or equivalent authoritative-layer security is mandatory.
• The implementation must default to feature-off.
• The intended Matrix entry label is “LOR Studio,” with “Build My LOR” as the principal experience.
• The recommended public application route is /lor-studio/, subject to collision and platform-route verification during F2‑LOR‑1007.
• No production database, schema, bucket, route, runtime, or provider may be created merely from this recommendation.
• F2‑LOR‑1007 must identify the exact existing platform authorities and register the final technical values before mutation.

If repository or platform evidence demonstrates that /lor-studio/ conflicts with an established route, Codex must stop and report the conflict rather than silently choose another production route.

=========================================================
6. RETENTION, ARCHIVE, EXPORT, AND DELETION

RATIFIED DEFAULT POLICY:

• Active working records are retained while the recommendation case is open.
• Drafts, source selections, consent receipts, and collaboration records are retained for 12 months after case closure.
• Final-letter provenance, approval receipts, delivery metadata, and essential audit evidence are retained for seven years after case closure.
• Routine application and operational logs are retained for 12 months.
• Security and privileged-access audit records are retained for 24 months unless a longer period is legally required.
• Recoverable backups may retain deleted data for no longer than 35 days after deletion from the active system.
• A verified deletion request must remove eligible active data within 30 days.
• Legal hold, active dispute, security investigation, or governing law may suspend deletion for the minimum necessary period.
• Archived data remains subject to the same access controls as active data.
• Exports must be logged with actor, case, artifact hash, recipient or destination, purpose, and timestamp.
• MissionMed does not control copies lawfully downloaded or retained by an authorized faculty writer, but the export event must remain recorded.
• Source-system revocation must prevent future reads and must not silently rewrite sealed historical evidence. Any governed historical snapshot must retain its provenance and authorization basis.

Before real-user activation, the privacy authority must confirm that these periods do not conflict with applicable contractual or legal requirements.

=========================================================
7. PROVIDER STRATEGY

RATIFIED DECISION:

LOR Studio must remain provider-portable and use governed MissionMed service boundaries.

• Email and notifications: use the approved MissionMed transactional communications service. Direct dependency on a personal Gmail mailbox is not required for MVP.
• Faculty verification: use the approved transactional email/OTP service through a bounded identity contract.
• AI: use a governed MissionMed AI-provider broker or equivalent server-side abstraction. Protected data must not be exposed to client-side secrets or reused for model training.
• Document generation: use a governed server-side document-rendering service capable of producing verifiable DOCX and PDF artifacts.
• Secrets: store only in the approved secrets manager and inject them at runtime.
• Analytics: protected letter text, faculty-private content, and waived content are prohibited from general analytics payloads.

Exact vendors, accounts, regions, and commercial commitments must be verified from platform authority. Any new paid provider, new legal data processor, or material change in protected-data handling requires Founder approval.

=========================================================
8. CONTRACTS AND MVP DEPENDENCIES

RATIFIED DECISION:

Required for MVP:

• Matrix navigation and application registration;
• platform identity and entitlement;
• LOR-owned data, provenance, and audit handling;
• Timeline Builder’s governed read-only projection;
• faculty invitation and verification;
• document generation and export;
• delivery/tracking metadata.

Optional or deferrable with truthful fallback:

• StoryForge integration;
• File Vault and extended profile imports;
• RISE/program-intelligence integration;
• direct email-provider integration beyond transactional delivery;
• enhanced notification services.

The product must remain usable through permitted manual evidence entry when an optional dependency is unavailable.

Every contract must specify:

• canonical owner;
• producer and consumer;
• minimum data;
• purpose and consent basis;
• authorization rule;
• version and freshness;
• failure and revocation behavior;
• audit requirements;
• prohibited payloads;
• lifecycle compatibility.

All protected-data dependencies fail closed. No application may use another application’s database as an undocumented integration interface.

=========================================================
9. AI AND HUMAN-ACCEPTANCE LAW

RATIFIED DECISION:

• AI-generated language is always a proposal.
• No AI output becomes final letter content until affirmatively accepted or edited by the verified faculty writer.
• The student may prepare multiple differentiated options, but may not represent them as faculty-approved.
• Unsupported claims, fabricated relationships, fabricated observations, invented anecdotes, and patient-identifying information are prohibited.
• AI provenance must record the authorized source references, prompt or template version, model/provider identity, generation time, output version or hash, and subsequent human decisions.
• Model output must not overwrite its source evidence.
• Generic-language detection, specialty relevance, evidence strength, and authenticity guidance are educational assistance—not factual certification.
• Faculty voice must be preserved.
• Protected content may not be used for provider training or unrelated MissionMed model development without separate explicit authority and consent.

=========================================================
10. CANARY AND PRODUCTION RELEASE LAW

RATIFIED DECISION:

The release sequence is:

1. authority registration;
2. implementation with synthetic data and feature off;
3. deterministic local build and automated tests;
4. authorization and privacy-negative tests;
5. staging verification;
6. document-generation verification;
7. fresh backup and isolated rollback proof;
8. production installation with feature off;
9. bounded canary;
10. Founder go/no-go decision;
11. intended-user activation;
12. sealed evidence closure.

The initial canary is limited to three to five consenting 360 students and their verified faculty writers.

The canary must run for at least 14 calendar days and include at least five complete recommendation-case journeys, unless the Founder issues a written exception.

Immediate containment or rollback is required for:

• cross-student or cross-case access;
• unauthorized faculty-private or waived-content disclosure;
• authentication or entitlement bypass;
• incorrect waiver enforcement;
• corrupted or lost authoritative data;
• material document-generation defects affecting final content;
• provider behavior that violates the ratified privacy rules;
• inability to produce or read a verified backup;
• a critical security defect;
• any health threshold ratified in the release checklist.

Only the Founder may authorize:

• real-user canary activation;
• expansion beyond the canary cohort;
• general intended-user activation;
• acceptance of a material release exception.

A kill switch is mandatory but does not substitute for executable rollback.

=========================================================
11. MR‑079 EXECUTION AUTHORITY

RATIFIED DECISION:

F2‑LOR‑1007 is authorized to perform bounded documentation and control-plane registration necessary to:

• preserve and register the F2‑LOR‑1006 authority packet;
• create or update the LOR charter and passport;
• register the application mission and authority route;
• register this Founder decision record;
• register required contract requirements without inventing unapproved APIs;
• create the F2-specific MR‑079 execution annex;
• update authoritative indexes and generated current-state records where repository conventions require;
• validate documentation and authority consistency;
• stage, commit, and push only the verified F2‑LOR‑1006 and F2‑LOR‑1007 authority artifacts on the existing authorized branch;
• open a pull request if required by the governing repository workflow.

F2‑LOR‑1007 does not authorize:

• product-source implementation;
• database or migration execution;
• WordPress mutation;
• real-data ingestion;
• provider provisioning;
• secret retrieval or disclosure;
• staging or production mutation;
• deployment;
• canary activation;
• intended-user activation.

The F2 MR‑079 annex must define exact commands, paths, branch, remote, evidence requirements, sole-writer scope, expiry condition, and prohibited operations before later implementation begins.

=========================================================
12. AUTHORIZED NEXT STEP

Upon Founder approval, the next authorized ticket is:

F2‑LOR‑1007 — LOR Studio Application Admission, Founder Ratification, Authority Registration, and MR‑079 Execution Annex.

Its objective is to register this ratification and the F2‑LOR‑1006 packet as governing authority, establish the complete F2 control-plane route, safely preserve the documentation in Git, and produce the exact bounded authority required for the subsequent implementation ticket.

F2‑LOR‑1008 may be prepared but may not begin product implementation until F2‑LOR‑1007 passes and its implementation authority is verified.

=========================================================
FOUNDER APPROVAL

Choose one response:

APPROVE ALL

This approves Sections 1–12 exactly as written and authorizes preparation and execution of F2‑LOR‑1007 within its stated limits.

APPROVE WITH CHANGES

List the section number and replacement decision for each change.

DO NOT APPROVE

The bundle remains a proposal and no authority is granted.
