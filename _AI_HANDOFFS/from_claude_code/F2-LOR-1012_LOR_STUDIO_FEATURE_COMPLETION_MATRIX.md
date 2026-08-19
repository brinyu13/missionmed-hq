# F2-LOR-1012 — LOR Studio Feature Completion Matrix

**Ticket:** F2-LOR-1012
**Builder:** Claude Code (DR-118 executor substitution)
**Authority:** DR-118 + DR-119 (LOCAL_DRAFT — see filing note)
**Worktree:** `/Users/brianb/MissionMed_worktrees/F2-LOR-1009`
**Branch:** `codex/f2-lor-1009-production-release` @ `1a5beb9` (clean at inventory time)
**Generated:** 2026-08-19
**Method:** six parallel read-only subsystem inventories + independent synthesis; every claim carries a `file:line` reference.

---

## Headline

**22 features inventoried. Zero are WORKING.**

| State | Count |
|---|---|
| MISSING BINDING | 6 |
| PARTIAL | 5 |
| MISSING | 4 |
| BROKEN | 3 |
| STUB | 1 |
| FAIL-CLOSED | 1 |
| EXTERNALLY BLOCKED | 1 |
| DEAD-ABANDONED | 1 |
| **WORKING** | **0** |

The domain layer is genuinely excellent — complete, pure, invariant-enforcing, and passing
**116/116 tests** (`node --test`, 487ms). The product is dark not because the logic is wrong but
because **the composition root was never built**: `server.mjs:267-276` constructs
`createLorStudioRuntime()` without the `application` option, so `application` defaults to null
(`runtime.mjs:352`) and every `/api/lor-studio/*` request returns
`503 lor_application_unavailable` (`runtime.mjs:429`, `:476`).

`createLorApplicationAdapter` — the sole caller of `RecommendationCaseService` — is imported
**only by tests**. Wiring the composition root converts roughly 20 features from
MISSING BINDING to testable in a single change.

### A test-suite caveat that matters

Every existing test builds its **own** runtime. **The 116 tests would stay green if the
production mount in `server.mjs` were deleted entirely.** Green tests currently prove the domain
is correct; they prove nothing about whether the product is reachable.

---

## Definition of WORKING

A feature is WORKING only when this full chain is proven:

> UI → frontend contract → API → service/domain → persistence/provider/export → returned state → UI re-render/re-entry

Fixture-backed or mock-only behaviour is **not** WORKING. No feature currently meets this bar.

---

## Matrix

Legend: `WORKING` · `PARTIAL` · `FAIL-CLOSED` · `STUB` · `MISSING BINDING` · `BROKEN` · `DEAD-ABANDONED` · `EXTERNALLY BLOCKED` · `MISSING`

### 1. Enter LOR Studio at all (protected shell + entitlement gate)
**State:** `FAIL-CLOSED` — **Release: blocked**
`server.mjs:274` injects `createUnavailableLorEntitlementResolver('exact_learndash_360_contract_unverified')`. Flags default `enabled=false` (404) / `killSwitch=true` (423). `WordPressEntitlementConsumer` has exactly one importer — a test.
**HAZARD:** the consumer emits `actorId` as `wp:<n>` but `server.mjs:8579` sets session id to `Number(user?.id||0)`. `runtime.mjs:390` therefore **permanently 403s** even once entitlement is bound. An identity crosswalk is mandatory.

### 2. Create a recommendation case
**State:** `MISSING BINDING` — **Release: blocked**
`server.mjs:267-276` omits `application`. No repository is constructed outside tests.

### 3. Eight-step builder: autosave, sequential completion, resume/progress
**State:** `MISSING BINDING` — **Release: blocked**
Composition-root gap, plus a total vocabulary mismatch: the frontend uses a numeric step index, the domain uses canonical string step ids. **No code bridges them.**

### 4. Consent receipt + FERPA waiver decision (supersession chain)
**State:** `MISSING BINDING` — **Release: blocked**
**Highest-leverage single gap.** `recordReceipt` exists on the service but is absent from the `RecommendationCaseServiceContract` typedef (`application-adapter.mjs:16-22`) and has **no route**. Waiver state gates final-letter release at `authorization-policy.js:211-217`, so **letter delivery is dead without it** — and it has zero test coverage.

### 5. Invite a faculty writer
**State:** `MISSING` — **Release: blocked**
No issuance service, no route, no persistence. `PostmarkFacultyInvitationAdapter` requires an injected `transport.sendBoundInvitation` that exists nowhere. Emitting `faculty.invited` would also throw — absent from `metadata-events.js:11-19`.

### 6. Faculty OTP verification and secure workspace access
**State:** `EXTERNALLY BLOCKED` — **Release: blocked**
Atomic driver unwritten, schema unratified. Even on success, `durable-faculty-invitation-verification-service.mjs:56-57` and the repo at `:955-956` hardcode `privateSessionIssued:false` / `privateEditGranted:false` — **no faculty principal is ever issued**. OTP *issuance* does not exist at all; only verification (which is well-tested, 15/15).

### 7. Faculty private authoring, approval, and signature attestation
**State:** `MISSING` — **Release: blocked**
**There is no document state machine in the domain.** `documentState==='faculty_final'`, `facultyApproval.approved`, `signatureAttested` exist only at `documents/recommendation-artifacts.mjs:29-32`. The case aggregate has no such fields — **the artifact renderer demands a shape the domain can never produce.**

### 8. Waiver-gated final letter release to the student
**State:** `BROKEN` — **Release: blocked**
Nothing anywhere sets `releasedToStudentAt`. No service method, no domain helper, no route. A permanently closed door with no key, compounded by the missing receipts route (#4).

### 9. Case lifecycle transitions and status tracking
**State:** `PARTIAL` — **Release: blocked**
Domain logic complete (`ALLOWED_TRANSITIONS`, terminal immutability). But wiring through `#commitWrite` **throws today**: `metadata-events.js:11-19` allowlists 7 types and omits `case.faculty_verified/faculty_review/faculty_approved/delivered/closed/cancelled` and `faculty.invited`. **Prerequisite for all lifecycle work.**

### 10. AI-assisted draft generation with provenance + mandatory human decision
**State:** `MISSING BINDING` — **Release: blocked**
**Hard architectural constraint:** `claim-validator.js:61-64` requires `text.trim() === claims.join('\n\n')`, which *structurally forbids* a generative model from writing salutations, transitions, or closings. Grounding is **referential only** — `supportIds` are checked for existence, never entailment. Requires a decision record before any provider work.

### 11. Applicant variants (3-5 distinct evidence-grounded options)
**State:** `PARTIAL` — **Release: blocked**
No generator, no persistence, no route. `createApplicantVariantSet` requires distinct angles **and** distinct `sha256(text)` per variant — a naive parameter sweep over the deterministic concatenator will violate this.

### 12. Evidence import from StoryForge / Timeline with consent linkage
**State:** `PARTIAL` — **Release: blocked**
`StoryForgePort`/`TimelinePort` exist (`ports.js:111,115`) but only fail-closed disabled adapters implement them (`disabled-adapters.js:36,42`). No service consumes either. **Evidence cannot enter the system, which starves the entire AI plane.**

### 13. DOCX / PDF artifact generation and export download
**State:** `MISSING` — **Release: blocked**
Four missing links: no artifact-model producer from the aggregate; nothing joins `planCaseExport` to a renderer; no binary response path in `runtime.mjs` (everything funnels through `sendJson`); and `buildWriterDepotRecord` needs raw `objectKey`/`versionId`/`encrypted:true` which the storage adapter's hashed-ref receipt can never supply. PDF also mangles all non-ASCII to `?` (`recommendation-artifacts.mjs:98-105`). The OOXML writer itself is genuine and complete.

### 14. Writer Depot (sharing configuration + writer-facing page)
**State:** `STUB` — **Release: blocked**
No durable home for depot configuration. Under production CSP the `blob:` video src and download anchors would be blocked. **Security:** the storage adapter binds capability to `request.caseId` (`:158`) and checks `studentId===actorId` (`:177`) but never independently verifies the actor **owns** that case — delegated to an unwritten provider. Latent, not currently exploitable.

### 15. Potential Writers, readiness engine, rotations, programs
**State:** `MISSING` — **Release: blocked**
**~60% of the rendered UI has no durable source of truth.** The student projection carries no writers, rotations, programs, mentor notes, depot config, library state, or tracking events. An unmade design decision that gates the size of every frontend task.

### 16. Examples & Templates library
**State:** `MISSING BINDING` — **Release: blocked**
Entirely synthetic and localStorage-backed. **Lowest-risk candidate** for static read-only durable backing — carries no student PII.

### 17. Mentor coverage and deadline views
**State:** `PARTIAL` — **Release: blocked**
The durable mentor projection carries only 6 fields. It structurally cannot feed the coverage matrix (needs per-case evidence tags) or the deadline table (needs `request.deadline`).

### 18. Optimistic concurrency and idempotent retries
**State:** `MISSING BINDING` — **Release: blocked**
No driver enforcing `WHERE revision = expectedRevision`, so **no concurrency control at all**. No durable idempotency store. The frontend has no revision concept whatsoever.

### 19. Retention, deletion intents, privacy requests
**State:** `PARTIAL` — **Release: blocked**
No scheduler, job, service, or route. `createDeletionIntent` returns `remoteMutationPerformed:false` and nothing performs the mutation. **Compliance-visible:** the 35-day recoverable-backup deadline is computed and discarded.

### 20. Audit trail and operational health
**State:** `DEAD-ABANDONED` — **Release: blocked**
**Two competing event systems** disagreeing on type names: `audit-events.mjs` (14 types, production-dead) vs `services/metadata-events.js` (7 types, actually wired). Neither covers artifact/export/deletion/denial. **Two competing health implementations**: `observability/health.mjs` uses integer `schemaVersion 1`, incompatible with the `'missionmed.lor.dependency-health.v1'` string `ProductionHydrationAdapter` asserts. **P1 leak:** `redactForOperationalTelemetry` returns numbers and booleans unchanged, so `{studentId: 44821}` survives redaction.

### 21. Operational metadata read by admin / founder / support
**State:** `BROKEN` — **Release: blocked**
**P1 authorization asymmetry:** any actor with role `admin|founder|support` can read the operational projection of **every case for every student** with no per-case grant. This contradicts `artifact-access-policy.mjs:128-133` and `private-versioned-storage-adapter.mjs:197-210`, which both demand an administrative grant. Separately, `audit-events.mjs` `ACTOR_ROLES` omits `founder` and `support`, so such access **cannot even be audited**.

### 22. Build and release pipeline for the frozen frontend
**State:** `BROKEN` — **Release: blocked**
`defaultSource` is the machine-absolute path `/Users/brianb/MissionMed/F2-LOR-1003-functional-prototype.html`. On any other host `npm run build` fails at step 1. `SAFE_ASSETS` admits exactly 3 files, so any new hydration bundle 404s until added. CSP has no `font-src`, so all three brand typefaces silently fall back.

---

## Externally blocked — requires Founder action

These cannot be closed by engineering alone.

1. **Supabase project/schema ratification.** `schema-design.contract.json:10` names this as the single `blockingDecision`. `targetProject`, `targetEnvironment`, `targetSchema`, `migrationLedger` are all `null`; `migrationFileAuthorized: false`.
   **⚠ SAFETY CONTRADICTION:** the durable repos **hard-code** `projectRef fglyvdykwgbuivikqoah` (RANKLISTIQ **production**/main) and branch `mftguikkftmrxjxrkdln` (lor-staging) — a child the LOR passport explicitly declares *"historical no-touch and not a release target."* **Must be resolved by decision before any DDL exists.**
2. **Supabase binding credentials** — `assertBinding` requires `providerResourceBound`, `independentlyVerified`, `health==='ready'`, `environmentBound`. No verified binding exists outside test fakes.
3. **Storage bucket `lor-writer-depot`** — must be private + versioned + serverMediated + policyVerified.
4. **Backup / verified restore rehearsal / rollback** — 9 release proofs enumerated at `schema-design.sql:102-110`.
5. **LearnDash / Tier-3 360 entitlement contract** — `server.mjs:274` names the blocker verbatim.
6. **WordPress mu-plugin enablement** — `MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED` must be a literal `true`, plus verified course ids, program tiers, consent version.
7. **Postmark server token + verified sender** — blocks all faculty invitation email.
8. **AI provider account and key** — *no generative provider exists anywhere in lor-studio* (grep for `anthropic|openai|claude|llm` returns zero hits). `PORT_CONTRACTS.ai` prohibits provider training on this data, so the account must carry a no-training commitment.
9. **Privacy authority for administrative grants** — requires a named authority and a written-authorization process that does not exist.
10. **Host environment flags** (Railway/Kinsta) — final release action.
11. **CI build host** — decide where the governed prototype source of truth lives.

---

## Work completed this cycle

Six file-disjoint unblocked defects, all local, no external gates touched:

| Step | Fix | Lane |
|---|---|---|
| 2 | Extend `ALLOWED_EVENT_TYPES` to cover all domain-emitted events | services |
| 3 | Collapse `INVITATION_DENIED` to an opaque 403 (denial oracle) | http adapter |
| 4 | Redact numeric/boolean scalars in operational telemetry; add missing `ACTOR_ROLES` | audit |
| 5 | Independent case-ownership assertion in private storage | adapters |
| 6 | Require per-case administrative grant for operational metadata reads | security |
| 22 | Make the materializer host-portable without drifting the frozen digest | build |

Each fix was independently verified by an adversarial reviewer instructed to defeat it.

---

## Filing note

DR-119 is `LOCAL_DRAFT`. The record, its `authority_index.json` entry, and the `missions.json`
gate update are written and JSON-valid on disk but **uncommitted** — the session's permission
classifier blocks `git commit` in `MissionMed_OS`. Under the Filing Law the decision is
therefore **not filed**. Founder action required.
