# F2-LOR-1006 Privacy, Access, and Data Ownership

**Status:** Evidence-backed candidate; Founder ratification required where marked
**Default posture:** least privilege, purpose limitation, fail closed, no database sharing

## 1. Access legend

- `N` — no access.
- `SP` — structurally prohibited; the API/data layer must be incapable of returning the content.
- `MD` — metadata/status only, never content.
- `R` — read.
- `C/E` — create/edit within owned scope.
- `A` — approve/accept as named human authority.
- `X` — export within owned scope.
- `ADM` — administer configuration/content, not protected user content.
- `FDR` — Founder decision required. Until ratified, apply the safest default shown in parentheses.

Role abbreviations: `STU` student/applicant; `FAC` faculty writer; `MEN` assigned mentor; `ADM` authorized LOR administrator; `FND` Founder; `OPS` support/operator; `SVC` authorized service identity; `APP` other MissionMed applications.

Access is always limited to the relevant person/case/assignment/purpose. A role label never grants cross-student access.

## 2. Privacy and access matrix

| Resource class | STU | FAC | MEN | ADM | FND | OPS | SVC | APP |
|---|---|---|---|---|---|---|---|---|
| Student-entered evidence | C/E/R/X own | R shared case only | R assigned strategy subset | R support-scoped | MD/R only if ratified purpose | R temporary support scope | R minimum for named operation | SP except governed contract |
| Imported StoryForge references | C/E consent and selection; R allowed snapshot | R shared case only | MD or R de-identified strategy subset | MD | MD | MD | R IDs/version only for operation | Owner may read own source; others SP |
| Imported Timeline references | C/E import decision; R | R focused shared rotation | R assigned strategy | R support | R/MD | R temporary support | R minimum projection | Timeline owns source; others contract only |
| CV/profile information | R; C/E only in canonical owner | R shared subset | R assigned strategy subset | R support | FDR (default MD) | R temporary support | R minimum projection | SP except owner contract |
| Writer identity/relationship data | C/E LOR-specific association | R/correct own association | R assigned strategy | R support | MD/R audit purpose | R support | R minimum | SP except identity contract |
| Writer questionnaire responses | SP | C/E/R own workspace | SP | SP | SP; audit metadata only | SP | Process only under isolated service role | SP |
| Applicant-prepared draft options | C/E/R/X own | R/C/E shared option | SP by safest default | R support only if explicitly granted | FDR (default MD) | FDR (default N) | Process for generation/rendering | SP |
| Faculty-edited drafts | SP | C/E/R/X own workspace | SP | SP | SP; audit metadata only | SP | Process only under isolated role | SP |
| Final faculty-approved letter | FDR: non-waived R/X; waived SP | A/R/X own | SP | SP | SP; sealed metadata only | SP | Process/export only for authorized delivery | SP |
| Waived-letter content | SP | A/R/X own | SP | SP | SP | SP | Process only for authorized faculty delivery | SP |
| Non-waived letter content | FDR (recommended R/X after faculty release) | A/R/X own | SP | SP | SP | SP | Process only for authorized delivery | SP |
| Faculty-private notes | SP | C/E/R own | SP | SP | SP | SP | Process only under isolated role | SP |
| Internal mentor notes | SP unless explicitly shared | N | C/E/R own assignment | FDR (default MD) | FDR (default MD) | FDR (default N) | Process only under mentor service scope | SP |
| AI prompts and outputs | R own applicant options; no provider internals | R shared/own faculty generation if enabled | SP | MD quality/audit, content only under explicit review protocol | MD quality/audit; content FDR | N | Process minimum; no secondary use | SP |
| Provenance records | R own option/source map | R/A relevant map | MD coverage only | R audit/support scope | R audit scope | MD | C/E append-only for operation | Contract projection only |
| Delivery/tracking metadata | R own; may record self-report | MD relevant case | MD assigned case | R support scope | R audit/operations | R support | C/E event-specific | Event contract only |
| Audit records | N | N or own action receipt | N | R assigned operational scope | R sealed audit scope | R minimum incident scope | C append-only; R only for operation | SP except audit owner |
| Exports | C/X own permitted artifacts | C/X own permitted artifacts | N | N except content-admin exports without user data | FDR (default N for protected content) | N | Generate/deliver only | SP |
| Deleted/archived records | MD own status where lawful | MD own-case status | MD assigned status | ADM lifecycle only, content N | ADM sealed lifecycle metadata | MD incident scope | Execute approved lifecycle policy | SP |

## 3. Structural protection laws

1. Student and mentor queries must never select from the faculty-private data boundary. A UI omission is insufficient.
2. Waived-letter content is structurally prohibited to student, mentor, administrator, Founder, support, and other applications. Only the faculty writer and narrowly authorized processing/delivery identities may access it.
3. Founder, administrator, and support access are functional scopes, not superuser content bypasses.
4. Service identities must be operation-specific, short-lived where possible, and unable to browse arbitrary records. Their reads and writes are audited.
5. Other applications receive only a contract projection/event, never LOR database access.
6. Every export is an authorization event with actor, case, artifact hash/version, purpose, recipient, and timestamp.
7. AI provider access is purpose-bound processing, not ownership or permission for training/secondary use. Exact provider terms remain a contract gate.
8. No patient-identifying information may enter prompts, options, logs, fixtures, screenshots, or exports.

## 4. Safest defaults pending Founder ratification

- Mentors see stage, deadline, readiness/coverage projections, and student-controlled evidence summaries; they do not see Builder text, Depot configuration, drafts, faculty content, or final letters.
- Authorized administrators and support staff troubleshoot metadata and access state; protected content access is denied.
- Founder sees health, audit, feature flags, quality metrics, and sealed evidence; faculty-private and waived content remains denied.
- Non-waived final letters are released to the student only after explicit faculty approval and a ratified release rule.
- Internal mentor notes remain private to the assigned mentor unless a separate sharing action is explicit.
- AI quality review uses synthetic/redacted cases by default. Access to real content requires a separately ratified review purpose and auditable case selection.

## 5. Canonical data ownership ledger

“Owner” means the application/service responsible for canonical truth. It does not erase the person's privacy, access, consent, or authorship rights.

| Fact/record | Canonical owner | LOR representation | Rule/state |
|---|---|---|---|
| Letter project / recommendation case | LOR Studio | Native record | APPLICATION-OWNED; one student, one writer association |
| Writer person identity | Platform identity/contact owner | Stable subject/reference ID | DEFERRED TO PLATFORM CONTRACT |
| Writer relationship for this recommendation | LOR Studio | LOR-specific assertion with source/provenance | APPLICATION-OWNED; Timeline rotation facts remain external |
| Evidence selection | LOR Studio | Native per-case selection/decision | APPLICATION-OWNED |
| Imported story | StoryForge | Source ID + version + consent + optional governed de-identified snapshot | StoryForge remains canonical |
| Imported timeline item | Timeline Builder | Source ID + version + import decision/projection | Timeline remains canonical |
| Profile/CV fact | Profile/File Vault owner | Source ID/version or governed snapshot | External canonical owner |
| Applicant-prepared option | LOR Studio | Native versioned artifact | APPLICATION-OWNED; proposal only |
| Faculty-edited version | LOR Studio faculty-private domain; faculty is content authority | Private immutable versions/edit history | Structurally isolated |
| Faculty-approved final version | LOR Studio faculty-private domain; faculty is named acceptor | Sealed artifact + hash/version | Visibility governed by waiver law |
| Waiver state | FDR: recommended LOR case authority sourced from explicit student/legal receipt | Immutable state + source/time | Must not be client-only or silently reversible |
| Delivery state | LOR Studio | Provider-confirmed or self-reported event with confidence | Events do not imply receipt/read/official upload |
| Tracking state | LOR Studio projection | Derived from immutable events | Confidence-qualified; never “Email opened” |
| Consent | Source owner for source sharing; LOR for LOR purpose receipt | Resource/case/purpose/expiry/revocation | Both receipts must reconcile |
| Access grant | Entitlement/identity owner for platform grants; LOR for case grants | Stable grant IDs and scope | Fail closed on revocation/expiry |
| Revocation | Grant/consent owner | Append-only event and current effective projection | Immediate exclusion from future use; prior sealed artifacts follow retention law |
| AI generation event | LOR Studio | Input hashes/refs, prompt/model version, output hashes, checks | No raw protected content in general audit logs |
| Provenance | LOR Studio for LOR transformations; source owner for source provenance | Chain of source IDs/versions and transformations | Permanent with generated/final artifact |
| Audit event | Platform audit/Registrar owner | LOR emits bounded append event | Audit store/retention contract missing |
| Export | LOR Studio | Artifact ID/hash/version, actor, recipient/purpose, timestamp | Content access follows waiver/faculty law |
| Retention state | Platform records/privacy authority, applied by LOR | Policy ID/version + per-record state | FOUNDER DECISION REQUIRED |
| Deletion/archive state | Platform records/privacy authority, applied by canonical owner | Tombstone/archive/export/legal-hold state | FOUNDER DECISION REQUIRED |

No owner may be replaced by a copied field. If a governed snapshot is necessary, its contract must name source ID, source version/as-of time, transformation/de-identification, purpose, expiry, revocation behavior, and whether it may remain in a sealed historical artifact.

## 6. Cross-application contract requirements

| Boundary | Producer / owner | Minimum data and purpose | Authorization/consent | Freshness/failure/revocation/audit | Stage |
|---|---|---|---|---|---|
| Matrix navigation | Matrix | App ID, route, subject, return route; enter LOR | Registered app + entitlement | Current per session; deny if missing; log entry | MVP required |
| Identity/entitlement | Platform identity/LearnDash successor | Subject ID, role/claims, current-360 entitlement, mentor assignment, admin scope | Authenticated session; no LOR credentials | Short TTL/current check; fail closed; log grant/revocation | MVP required |
| Timeline Builder | Timeline | Rotation ID/version, dates, site, setting, role, freshness | Student identity and case purpose | Stale marker/re-import; manual fallback; revoke future fetch; audit imports | MVP required for integration; fallback allowed |
| StoryForge | StoryForge | Story ID/version/title and approved de-identified excerpt only | Per-story/per-case purpose consent | Do not fetch private items; fail closed; immediate future-use revocation; audit | Optional MVP, required for full accepted experience |
| File Vault | File owner | File ID/version, type, verified metadata, authorized download/render handle | Student grant and file policy | No silent copy; unavailable state; revocation; export audit | Optional/deferred |
| Profile/CV | Profile owner | Minimum verified facts with source/version | Student purpose consent or ratified platform basis | Stale label; no edit in LOR; audit consumption | Optional/deferred |
| RISE/program intelligence | Program-intelligence owner | Program ID, requirements, source/version/date | Student purpose and product entitlement | Unknown stays unknown; no outcome prediction; versioned audit | Deferred unless program assignment is MVP |
| Email/provider | Approved email adapter/provider | Recipient, subject/body, authorized attachments/link, provider message ID/error | Student action + provider OAuth scope; faculty address purpose | Fail with copy/mailto fallback; revoke tokens; log outcome, not mailbox | Optional; `gmail.send` only if approved |
| Notification/events | Platform notification/event owner | Event type, recipient subject, minimal case/status pointer | Application authorization and recipient preference | Delivery is not read truth; retries/idempotency; revoke subscriptions; audit | Optional/deferred |
| AI broker/provider | Platform AI broker or approved provider owner | Minimum de-identified generation contract and provenance IDs | Student purpose + service identity; human acceptance required | Timeout/partial truthful; no secondary use; log model/prompt/output hashes | Real AI required before AI beta |

Prohibited contract payloads include raw private StoryForge vault content, patient identifiers, faculty-private/waived content outside the faculty lane, provider secrets, mailbox contents, unrelated student records, and unbounded profile/program data.

## 7. Retention, deletion, and incident requirements

Before staging with real data, the Founder/privacy owner must ratify:

- retention periods for cases, options, prompts/outputs, media, tokens, exports, provider metadata, and audit records;
- rules for withdrawn consent, revoked source references, account deletion, program-season closure, and legal hold;
- whether and how a sealed artifact retains the provenance snapshot after source revocation;
- deletion verification and tombstone behavior across adapters, caches, backups, exports, and providers;
- incident access, notification, evidence preservation, and credential revocation procedures.

Until then, no real user data should enter an implementation environment. Synthetic fixtures remain the only safe default.

## 8. Evidence basis

- Revision 3 §3.4 and Laws 2–7, 13–16.
- F2-LOR-1004 specification §§5–12 and §§15, 18, 21.
- F2-LOR-1003 handoff §§5–12 and §17.
- `_SYSTEM/DATA_FLOW_CONTRACT.md` for server authority, identity isolation, RLS, and source-owner constraints; application-specific details remain subject to Revision 3 and a new LOR contract.
- Current repository and OS inspection found no ratified LOR privacy matrix or data contract; cells marked FDR are not closed by this candidate.
