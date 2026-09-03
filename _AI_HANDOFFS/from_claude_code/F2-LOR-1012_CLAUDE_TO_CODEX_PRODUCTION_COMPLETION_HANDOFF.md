# F2-LOR-1012 — Claude Code → Codex production completion handoff

**Outgoing Builder:** Claude Code
**Incoming executor:** Codex 5.6 Sol
**Date:** 2026-08-20
**Every fact below was verified against the working tree immediately before writing.**

---

## 0. Read this first

You are receiving a **complete, tested, local** LOR Studio build. Nothing has been deployed,
no migration has been applied, no provider credential is bound, and no production system has been
mutated. Your scope is the external half: target binding, migration, provider, deployment, Matrix
registration, browser E2E, canary, release.

**Do not reconstruct the DR-088 → DR-104 history.** It is a governance chain about source-custody
forensics that DR-119 removed from the critical path for construction. You need §2 only.

**Three things that will bite you if you skim:**

1. **The branch is 9 commits ahead of `origin` and unpushed.** The entire build exists only in the
   local worktree. Push or lose it.
2. **There is no executable migration.** `schema-design.sql` is still `DESIGN ONLY` with a
   `RAISE EXCEPTION` hard stop. You will author the migration; it does not exist.
3. **329 passing tests are NOT launch verification.** See §5.

---

## 1. Current canonical state (verified)

| | |
|---|---|
| Product repo | `brinyu13/missionmed-hq` |
| Worktree | `/Users/brianb/MissionMed_worktrees/F2-LOR-1009` |
| Branch | `codex/f2-lor-1009-production-release` |
| HEAD | `3f50184ccf430609dd58900945c3f09a0fe54872` |
| Working tree | **clean** |
| Remote | **9 ahead, 0 behind `origin/codex/f2-lor-1009-production-release` — UNPUSHED** |
| Governance repo | `/Users/brianb/MissionMed_OS`, `main` @ `8c403cd`, pushed, no tracked drift |

---

## 2. Governance state

**Controlling authority: DR-119**, filed and pushed at `MissionMed_OS` `8c403cd`
(`decisions/DR-119_f2_lor_1012_lor_studio_product_binding_and_construction_authority.md`).

**DR-119 grants:** LOR Studio bound as the canonical product (legacy Matrix "LOR Writer" is
non-canonical); Claude Code as Builder; full-scope **local, non-deployed** construction under
`missionmed-hq/lor-studio/**` plus the exact `server.mjs` LOR mount block.

**Gates still CLOSED (clause 6) — every one of these is your scope and each needs authority:**
migration apply to any environment · provider credential binding · entitlement target binding ·
Railway deployment · Matrix registration or asset deploy · merge of PR #24 · storage write · live
email · student exposure · protected-path or manifest registration. Feature flags remain
disabled, killed, and canary-required.

**Independent verification:** the BOOT Verifier role is **Cowork**, filing to
`handoffs/from_cowork/` with `APPROVE` / `APPROVE WITH CONDITIONS` / `BLOCK`. The Independence Law
holds — builder and verifier are never the same session.

**DR namespace verified: highest existing is DR-119. `DR-120` is free.** Do not assume it is
allocated; re-check live before using it.

**Next authority needed** — one decision, recommended as DR-120:

> Ratify a dedicated Supabase project as the exact LOR Studio target (project ref, region,
> environment, `lor_studio` schema, migration ledger, owner); adopt the textual `wp:<n>` identity
> model and record that the `auth.uid()`-keyed RLS clause in DR-104's schema design is superseded
> as unimplementable; authorize migration application to that target only, with backup, verified
> restore rehearsal, and rollback; authorize provider binding with the no-training posture
> confirmed. The denylist stands: no historical denied ref may be targeted.

---

## 3. What Claude built

**Composition root** — `lor-studio/composition.mjs`. The production mount previously constructed
the runtime *without* an `application`, so every `/api/lor-studio/*` request returned 503 while the
whole domain sat unreachable. Target identity comes only from explicit external configuration; no
default, no fallback. Declines with a truthful reason code when unconfigured. `server.mjs` passes
its result to `createLorStudioRuntime`.

**Final-document state machine** — `domain/recommendation-case.js`. `setFacultyPrivateContent`
previously `structuredClone`d a caller-supplied `finalDocument` wholesale *including*
`releasedToStudentAt`, and `authorization-policy.js` reads that field as the student-visibility
gate. Proven by execution: a student was shown an unapproved, never-released letter. Now
`finalDocumentState {documentState, facultyApproval, release}` is validated, `releasedToStudentAt`
is stripped on input and re-derived from the release record, and a release binds immutably to the
exact document hash.

**releaseFinalDocument** — domain transition + service + route. Gated on recipient-bound verified
writer, `faculty_final` + approved + signature attested, decided non-waived waiver, exact revision
and document id. Idempotent on replay; refuses re-scoping.

**Receipts route** — `POST /cases/:id/receipts`. Receipts are **minted server-side** behind a
client-field allowlist; a client-supplied consent receipt would be forgeable.

**operationalGrant propagation + administrative-grant hardening** — case-level grants required for
operational metadata reads; role membership alone grants nothing. Grants are issued inside the
trusted server boundary and validated by identity, so caller-constructed, copied, cloned,
serialised, proxied, prototype-polluted and accessor-backed candidates are all refused.

**Supabase target resolver** — `adapters/lor-target-binding.mjs`. See §7.

**Atomic RLS driver** — `adapters/atomic-rls-case-driver.mjs`. See §10.

**Grounded AI drafting** — `services/ai-proposal-service.js` + three routes. See §12.

**Production hydration + frontend write path** — `public/lor-studio/production-projection-ui.js`
(new renderer) and `production-adapter.js`. See §5 for what is and is not verified.

**Export** — `services/artifact-service.js` + route + a binary `sendBuffer` path in `runtime.mjs`.
The OOXML DOCX writer was complete but unreachable. PDF also fixed: it ran `NFKD` then mapped
non-ASCII to `?`, rendering `José Álvarez` as `Jose? A?lvarez`; it now transliterates.

**Telemetry hardening** — `redactForOperationalTelemetry` passed arrays and object keys verbatim.
`{count:[4471]}` leaked; a per-identifier counter map published the identifier in the key. Both
closed.

**Event vocabulary** — metadata ledger and audit sink are separate sets that had drifted. Both now
closed for `faculty.final_document_released` and the two `ai.*` types, with a test that **derives**
the emitted types from source so a new one fails the build rather than going unrecorded.

**Build portability** — the materializer hardcoded a machine-absolute prototype path, so
`npm run build` could not run on any other host. Now overridable via
`LOR_STUDIO_PROTOTYPE_SOURCE` with the SHA-256 pin preserved.

**Security fixes found by adversarial review:** TOCTOU against the target denylist; salutation slot
admitting fabricated facts; `__proto__` edit-buffer data loss; cross-student receipt replay;
telemetry array/key leaks; invitation denial oracle.

---

## 4. Test state (verified)

**329 passing · 0 failing · `lor:check` PASS.** Run: `npm run lor:test` from the worktree.

17 suites under `missionmed-hq/tests/lor-studio/`:

| Kind | Suites |
|---|---|
| Unit / domain | `core-domain`, `core-variants`, `core-ai-retention`, `core-security` |
| Integration (in-process HTTP adapter) | `http-application`, `http-runtime`, `faculty-durable-verification`, `tranche-a-adapters` |
| **Composition** (real runtime + real composition root) | `production-composition` |
| **Real-socket E2E** | `e2e-student-journey` |
| Security / adversarial | `core-security`, `artifact-security`, `target-binding`, `wordpress-contract` |
| Driver | `atomic-rls-case-driver` |
| jsdom (browser DOM, not a browser) | `production-projection-ui`, `frontend-adapter` |
| Contract | `schema-contract` |
| **True browser** | **none — see §5** |

**Mutation / negative controls** exist for: the composition root (removing `application` reddens
the source guard), the cross-student receipt replay, the `__proto__` edit buffer, the telemetry
redaction gate, the event vocabulary across both planes, and drafting composition. Several were
verified by an independent reviewer re-executing them rather than trusting the claim — one earlier
lane's claimed mutation turned out to be an equivalent mutant that passed either way.

---

## 5. Honest unverified state — read before claiming anything

**Real foreground browser keystroke E2E has NOT been proven.**

The in-app browser pane held the tab at `document.visibilityState === 'hidden'` throughout, even
after fronting it. Synthetic `input` events could not be driven reliably, and I twice misread the
resulting DOM state — once as a re-entry defect that a mutation check later disproved. What **was**
verified in a real browser: page hydration, in-page case creation (server-allocated id), a fresh
page load returning persisted builder state, `localStorage` key count of 0, and the frozen
prototype staying quarantined.

**What this means for you:** the write path — typing, autosave, the save indicator, conflict
recovery, release and export initiated from the interface — is proven in **jsdom and over HTTP**,
not by real keystrokes. Before student exposure you need one of: a working foreground browser
harness, Playwright outside the pane, or a real canary user.

**Do not read 329 passing tests as production launch verification.** They prove the local build is
internally correct. They prove nothing about a real database, a real provider, a real deployment,
or a real browser.

---

## 6. Feature Completion Matrix

Path: `_AI_HANDOFFS/from_claude_code/F2-LOR-1012_LOR_STUDIO_FEATURE_COMPLETION_MATRIX.md`
(revision 4 is current; earlier revisions are retained below it as history).

**WORKING 0 · EXTERNALLY BLOCKED 8 · PARTIAL 9 · MISSING 4 · STUB 1**

**What prevents promotion to WORKING:** `WORKING` requires the full chain
UI → adapter → API → service/domain → persistence → response → rendered/re-entered state. Two
things block every candidate: durability is an in-memory stand-in, not a database; and browser
keystroke E2E is unproven (§5). The 8 EXTERNALLY BLOCKED rows are blocked *only* on
`SUPABASE_DURABLE_TARGET` — their full local chain is proven. That classification is a promotion
from PARTIAL, not a downgrade: it means done except the binding.

**Do not mass-promote rows after the migration lands.** Prove each chain.

---

## 7. Database target recommendation

**Recommend a dedicated new Supabase project for LOR Studio.**

The fact that decides it: `AUTH_ALLOWED_SUPABASE_PROJECT = 'fglyvdykwgbuivikqoah'`
(`missionmed-hq/server.mjs:157`) is the **only** project HQ may create student auth sessions in,
enforced by `isAuthSupabaseProjectAllowed`. **That same ref is on the LOR denylist.** So the LOR
database cannot be the project holding students' `auth.users` rows. Reusing an existing MissionMed
project means either the denied RankListIQ production project, or a project with no student auth
namespace. A dedicated project is the only non-contradictory option.

**Forbidden / non-target refs, encoded at `adapters/lor-target-binding.mjs:39-42`:**

| Ref | Classification |
|---|---|
| `fglyvdykwgbuivikqoah` | `RANKLISTIQ_PRODUCTION_PROJECT` |
| `mftguikkftmrxjxrkdln` | `LOR_HISTORICAL_NO_TOUCH_BRANCH` |

These are the only two currently encoded. They are checked against **all four** identity fields
(`projectRef`, `parentProjectRef`, `branchId`, `branchName`) and fail closed **even when passed
explicitly** — re-enabling one requires amending the denylist under a later decision, not passing
it at a call site.

**Defences already implemented, verified by 24 attack variants (4 fields × 2 refs ×
direct/getter/Proxy) yielding zero bindings containing a denied identifier:**

- the 16-key configuration is **snapshotted into inert plain data before validation**, so an
  accessor or Proxy cannot return a benign value to the denylist and a denied ref to the binding
  constructor (this was a real TOCTOU, found by adversarial review and reproduced end to end);
- the denylist is re-run against the **constructed** binding before registration;
- validated bindings live in a module-private `WeakSet`, so a hand-rolled look-alike or even a
  spread copy of a genuine binding is rejected;
- absent configuration fails closed with `lor_target_not_configured`.

---

## 8. Identity model

**Recommended: `student_auth_subject TEXT NOT NULL CHECK (student_auth_subject ~ '^wp:[1-9][0-9]*$')`.**

**Why `auth.uid()`-keyed ownership was rejected:** the RLS contract in `schema-design.sql` requires
`auth.uid()` to come from "the selected Supabase Auth session created by the WordPress-to-Railway
bootstrap" — but that session belongs to the forbidden project (§7). A uuid column would carry a
**cross-project identifier the LOR database cannot resolve, cannot foreign-key to `auth.users(id)`,
and cannot verify**. It is not merely imprecise; it is unpopulatable with a trustworthy value on
migration day. **The `auth.uid()`-keyed RLS clause is therefore unimplementable as written and must
be superseded by DR-120.**

**Rejected alternatives:** separate `uuid` + `bigint` columns with a discriminator (two nullable
ownership keys invite ambiguity and neither is reliably populatable); a dedicated mapping table as
the *primary* answer (it does not say what owns the row — it is a mechanism the textual model may
use, not an alternative to it).

**Auth binding:** the Supabase uuid is demoted from ownership key to an **authentication binding
recorded in a separate server-written table** — proposed, not implemented.

---

## 9. Final schema

**13 tables** under a dedicated `lor_studio` schema (count verified against
`scripts/lor-studio/schema-design.sql`): `recommendation_cases`, `case_revisions`,
`builder_sessions`, `evidence_links`, `letter_variants`, `consent_receipts`, `waiver_receipts`,
`faculty_invitations`, `faculty_private_content`, `writer_depot_artifacts`, `idempotency_records`,
`audit_events`, `deletion_intents`.

**⚠ NO EXECUTABLE MIGRATION EXISTS.** `scripts/lor-studio/schema-design.sql` opens with
`-- F2-LOR-1009 DESIGN ONLY. THIS FILE IS NOT A MIGRATION.`, every DDL line is comment-prefixed,
and it retains a `RAISE EXCEPTION` hard stop. **You author the migration.** Note that
`tests/lor-studio/schema-contract.test.mjs` currently *asserts* non-executability — that assertion
must be updated deliberately when you author the migration, not deleted to make things pass.

**`write_receipts` correction:** the driver relation needs a `student_id` column. Without it the
receipt table is owner-blind and no RLS policy on it is expressible. This is already reflected in
the driver's `INSERT`/`SELECT` statements — carry it into the migration.

**RLS model:** student writes keyed on the textual subject with a security-definer projection that
omits waived letter text, faculty-private content, private artifacts, and raw invitation material
at the database boundary; faculty require a consumed, recipient-bound, unexpired, unrevoked
invitation for that exact case; admin/founder/support require a short-lived case-bound grant —
ordinary administrator status is insufficient; audit accepts allowlisted metadata only, with
UPDATE/DELETE denied outside ratified retention procedures; **service-role identity is never a user
authorization boundary.**

**Ordering:** preflight (identity, backup, restore rehearsal) → schema → tables → constraints and
indexes → policies → verification → RLS negative matrix → smoke → rollback rehearsal.

---

## 10. Atomic RLS driver

**Files:** `missionmed-hq/lor-studio/adapters/atomic-rls-case-driver.mjs` and
`missionmed-hq/tests/lor-studio/atomic-rls-case-driver.test.mjs` (13 tests).

- **Transaction model:** one transaction per command. `UPDATE … WHERE revision = expectedRevision`
  returning `STALE_REVISION` with the actual revision; the audit row commits in the **same**
  transaction. A partial commit storing state without its audit row is the exact failure the
  atomicity requirement exists to prevent, and a test proves rollback of both.
- **Identity:** established server-side per transaction, set before any statement and cleared on
  exit **including on failure**, so session state cannot bleed between users. No caller-supplied
  value can influence it (tested).
- **Concurrency:** two writers on the same `expectedRevision` yield exactly one winner.
- **Replay defence:** an idempotent replay returns the prior receipt rather than double-committing.
- **Cross-student protection — this was a real hole.** The receipt lookup bound
  `case_id + idempotency_key` only, with no owner predicate, unlike its sibling `selectCase` and
  `selectRevision` statements which both bind `student_id`. An idempotency key is unique only
  *within* a case, so a caller scoped to one student who reused or guessed a key on another
  student's case **received that student's stored record back**. The repository above caught it, so
  it was never reachable end to end — but the driver owns table access and must not rely on a
  caller further up. Fixed at both levels: the row carries `student_id` and the lookup binds it,
  and the replay re-checks the stored record's owner the way `selectCase` does.
- **The test fake was dishonest and is fixed.** Its `selectWriteReceipt` handler keyed on
  `case_id + idempotency_key` and **ignored** the new parameter, making it strictly more forgiving
  than PostgreSQL and hiding the very hole above. **A fake that cannot fail the way the database
  fails proves nothing.** It now applies the predicate. Mutation check: removing both protections
  turns the cross-student test red; restoring returns 13/13, byte-identical by `shasum`.

**Your obligation:** the driver has never run against PostgreSQL. Implement the executor port with
a real client and **re-run the whole suite against a real database**. Treat every fake-backed
guarantee as unproven until then.

---

## 11. AI provider

**Architectural recommendation (Claude Code): Anthropic `claude-opus-5`.**
**Founder-ratified provider: NONE. Nothing is bound. This is a recommendation, not a decision.**

**The real operational counterargument, stated plainly:** MissionMed already runs OpenAI —
`server.mjs:148` reads `OPENAI_API_KEY || MMHQ_OPENAI_API_KEY` for embeddings and Whisper. Choosing
OpenAI means no new vendor, no new contract, no new credential path. That nearly decided it, and I
was recommending Claude while running on Claude, which is a bias worth naming.

**What tipped it:** both providers exclude API data from training by default, so that is a wash;
but **OpenAI's zero-data-retention is gated behind an Enterprise Agreement or MCA**, which is a
procurement dependency for student data. The task is long-form professional prose under hard
structural constraints, and the port abstraction makes the choice cheap to reverse.

**Must be verified before binding:** Anthropic ZDR eligibility for the account; whether
abuse-monitoring retention of student/recommender content is acceptable; current pricing.
**Constraint:** Claude Fable 5 is *not* available under ZDR — Opus 5 is unaffected.

**Env var names (values never in chat, repo, or logs):** `MMHQ_LOR_AI_PROVIDER`,
`MMHQ_LOR_AI_MODEL`, `MMHQ_LOR_AI_API_KEY`.

**Already enforced by the port contract** (`services/ports.js:56-61`):
`prohibited: ['automatic_finalization', 'provider_training', 'unrelated_analytics']`,
`failure: 'disabled_or_deterministic_local_fallback'`.

---

## 12. AI grounding model

The invariant, after DR-119 clause 8 amended the original `text === claims.join('\n\n')` identity
rule (which structurally forbade salutations and transitions and made the product impossible):

**Every material factual assertion must be grounded in approved source material.** Connective and
compositional prose may be generated. The AI may synthesise multiple approved facts into polished
prose but must not invent a new underlying fact.

- **Facts are resolved server-side** from consented, hash-verified case evidence. A caller may only
  *narrow* the set by id — **never supply fact text**. This is load-bearing: if a caller could post
  fact text, they could ground any sentence and the entailment gate would then *attest a
  fabrication*.
- **A proposal is never content.** Only an explicit human decision sets `acceptedContent`; edited
  wording is stamped `groundedAsAttested: false`; the decision record binds to the exact proposal
  output hash.
- **Entailment fails closed** when no verifier is bound. Referential existence of a `supportId` is
  never treated as factual support.
- **Connective prose is an allowlist, not a denylist.** The original denylist admitted **16 of 18**
  ordinary factual sentences as ungrounded — including *"He was suspended for falsifying records."*
  A denylist over natural language is an unbounded surface; inverting it to a fail-closed allowlist
  took the corpus to 0/16.
- **The salutation slot was hardened.** It accepted any title-cased phrase, and an adversarial
  review landed `"Dear Committee Smith Fails Boards,"` **mid-letter** with no provenance — the verb
  guard barred only `-ed`/`-ing`, so third-person present tense passed. The addressee is now a
  closed grammar: 14 attack payloads rejected, 9 legitimate salutations still accepted.
- **Provider is the deterministic local adapter.** It holds no credential, reads no env key, opens
  no socket. The grounding gate does not soften when a real provider replaces it.

---

## 13. Matrix / WordPress integration

**The proven pattern is the IV Prep front door** (DR-111/112/113, shipped 2026-08-15/16), branch
`codex/y1-y2-cam-v6-3472c-matrix-frontdoor`. Eight steps: PHP access payload → fixed server-side
launch-URL builder → module registry entry → a small `student-os.js` delta with a **client-side
allowlist validator** → content-addressed asset (`student-os.<16hex>.js`) → contract test →
`matrix_runtime_guard.py guarded-deploy --brian-approved` → evidence receipt.

**The DR-113 lesson — do not repeat it.** The first authenticated click landed on
`/arena?just_logged_in=1` because HQ nests its final destination *inside* the allowlisted
`return_to` URL, while the mu-plugin read only a **top-level** `final` param and allowed only
WordPress hosts. Fix was to preserve the nested `final` and allow exactly one extra final host.
Use `http_build_query(..., PHP_QUERY_RFC3986)`, not `add_query_arg()` — the latter leaves a literal
`#` that the browser treats as the outer fragment and silently drops the destination.

**Constraints DR-111/112 impose:** use the existing module registry and sidebar; no WordPress admin
menu item, no second sidebar, no detached launcher, no public bypass; no credential or user-supplied
host in browser source; Matrix Runtime Lock preflight must pass for all ten asset keys before
editing; bounded cache purge only.

**Studio-side preparation that exists:** `wp-content/mu-plugins/missionmed-lor-studio-contract.php`
(candidate, not installed) and `tests/lor-studio/wordpress-contract.test.mjs`.
**Remaining production mutation:** everything — registry entry, `student-os.js` delta, hashed asset,
guarded deploy, mu-plugin install and constants.

**Note:** a legacy Matrix-native "LOR Writer" module (`class-mmed-lor-writer.php`, REST `mmed/v1/lor`)
already exists and is wired. DR-119 declares it **non-canonical**. Do not route Studio through it.

---

## 14. Deployment

**Target:** Railway service `missionmed-hq`, environment `production`. No CI exists anywhere — no
`.github/workflows`. Every deploy is manual.

```
git archive --format=tar HEAD package.json package-lock.json railway.json .railwayignore missionmed-hq \
  | tar -xf - -C /tmp/<stage-dir>
railway up --detach --service missionmed-hq --environment production --path-as-root /tmp/<stage-dir>
```

**Flags (all default closed):** `MMHQ_LOR_STUDIO_ENABLED=false`, `MMHQ_LOR_STUDIO_KILL_SWITCH=true`,
`MMHQ_LOR_STUDIO_REQUIRE_CANARY=true`. Route returns 404 when disabled, 423 when killed.

**Target configuration (16 keys, all required, no defaults):** `MMHQ_LOR_STUDIO_TARGET_*` — see
`LOR_TARGET_ENV_KEYS` in `composition.mjs`. Absent → `lor_target_not_configured`, fails closed.

**WordPress constants:** `MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED` (literal `true`),
`MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS`, `MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS`.

**Health/readiness:** `GET /api/lor-studio/bootstrap`. Distinguish carefully —
`lor_application_unavailable` means the application was never constructed (the historical defect);
`lor_durable_runtime_required` means it was reached and correctly refused live mode without durable
storage. `providersReady` and `allAcceptedFunctionsOperational` are **caller assertions, not
measurements** — the dependency probes that would measure them are unbuilt. Production composition
leaves both `false`.

**Canary population:** the two server-resolved WordPress principals bound to `brinyu` and
`brinyu_test`, then server-verified eligible 360 students after the named canary passes.

**Rollback:** Railway has no automated rollback — `git checkout <known-good>` → `git archive` →
`railway up`. Known-good pinned in `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`: commit `3f0c27aa`,
tag `known-good/2026-06-25-critical-auth-usce-arena-matrix`. Matrix assets roll back from the
guard's timestamped Kinsta backup. Static/CDN uses `_SYSTEM/rollback.sh`.

**Local verification server:** `scripts/lor-studio/dev-server.mjs` — refuses to start without
`LOR_STUDIO_DEV_SERVER=1`, loopback only, explicit non-production target, imported by no product
code. Its `LocalVerificationDurableRepository` satisfies the *shape* of the durable contract in
memory: **no transaction, no RLS, no storage. It is not a durability claim.**

---

## 15. Exact remaining work

- [ ] **A.** Obtain and ratify a dedicated Supabase project (DR-120). Record ref, region,
      environment, schema, migration ledger, owner.
- [ ] **B.** Populate the 16 `MMHQ_LOR_STUDIO_TARGET_*` keys; confirm composition resolves and that
      a denied ref still fails closed.
- [ ] **C.** Author the executable migration (§9 — it does not exist) and update
      `schema-contract.test.mjs` deliberately. Include `write_receipts.student_id`.
- [ ] **D.** Apply to a non-production environment first. Verify schema and RLS against **real
      PostgreSQL** — the driver has never met a database.
- [ ] **E.** Run live cross-student adversarial tests against real RLS: cross-student read, write,
      export, replay, and the negative matrix for student/faculty/admin/service/anonymous.
- [ ] **F.** Ratify the privacy posture, then bind the provider (§11).
- [ ] **G.** Verify real provider structured output against the grounding gate; confirm the
      entailment verifier is bound and that an ungrounded assertion is still refused.
- [ ] **H.** Deploy to Railway with flags closed.
- [ ] **I.** Verify production health; confirm bootstrap reports honestly.
- [ ] **J.** Register the Matrix front door via the DR-111/112 pattern with the DR-113 correction.
- [ ] **K.** **Run true foreground browser E2E** (§5). This is not optional before exposure.
- [ ] **L.** Named canary (`brinyu`, `brinyu_test`) with kill switch armed.
- [ ] **M.** Fix production defects; rollback rather than fix forward if data or security safety is
      uncertain.
- [ ] **N.** Fresh Cowork independent verification where DR-119 requires it.
- [ ] **O.** Expand to verified eligible 360 students.
- [ ] **P.** Final release report with evidence.

---

## 16. DO NOT REGRESS

Each of these was earned by finding a real defect. Weakening any of them to make deployment easier
is a governance violation, and several were caught only because a test went red.

1. **Denied Supabase targets** — `fglyvdykwgbuivikqoah`, `mftguikkftmrxjxrkdln` fail closed in all
   four identity fields, even when passed explicitly.
2. **Target-binding snapshot** — the 16 keys are copied to inert data before validation. Removing
   it reopens a proven TOCTOU that reached RankListIQ production.
3. **`WeakSet` binding registry** — a look-alike or spread copy must never satisfy the gate.
4. **Case-level grants** — role membership alone must never bind an actor to a case.
5. **Administrative-grant unforgeability** — caller-constructed grants must be refused before a
   field is read.
6. **Release state machine** — approval alone must not expose a letter; release binds to the exact
   document hash.
7. **No caller-supplied `releasedToStudentAt`** — stripped on input, re-derived from the release
   record. This was a live student-visibility bypass.
8. **Server-minted receipts** — a client-supplied consent receipt would be forgeable.
9. **Factual grounding** — every material assertion grounded; connective prose is an **allowlist**.
10. **Caller cannot submit grounding fact text** — else the gate attests fabrications.
11. **Telemetry redaction** — arrays recurse with an empty fieldName; identifier-shaped keys are
    dropped whole.
12. **Prototype-free edit buffer** — a plain object literal silently discarded a student's typing
    while the UI said "Up to date".
13. **Optimistic concurrency** — `expectedRevision` on every write; no silent overwrite.
14. **No fake entitlement** — `createUnavailableLorEntitlementResolver` stays until a real contract
    is ratified.
15. **No implicit production target** — no default, no fallback, no env inference.
16. **Fail-closed readiness** — `providersReady` / `allAcceptedFunctionsOperational` default false.
17. **Honest test fakes** — a fake must be able to fail the way the real dependency fails.

---

## 17. Rollback

**Local:** the build is 9 commits on `codex/f2-lor-1009-production-release` from `1a5beb9`. Revert
individually or reset the branch to `1a5beb9`. No external state is touched by any of it.

**Production:** Railway — `git checkout 3f0c27aa` → `git archive` → `railway up`. Matrix — restore
scoped files from the guard's timestamped Kinsta backup; never `git reset`/`clean`. Database —
rollback SQL authored with the migration (does not yet exist); take a fresh backup and rehearse the
restore **before** applying anything.

---

## 18. Codex first commands (read-only)

```bash
cd /Users/brianb/MissionMed_worktrees/F2-LOR-1009
git branch --show-current                 # expect codex/f2-lor-1009-production-release
git rev-parse HEAD                        # expect 3f50184ccf430609dd58900945c3f09a0fe54872
git status --porcelain                    # expect clean
git rev-list --left-right --count origin/codex/f2-lor-1009-production-release...HEAD   # expect 0  9
npm run lor:test                          # expect 329 pass, 0 fail
npm run lor:check                         # expect exit 0
```

```bash
cd /Users/brianb/MissionMed_OS
git log --oneline -1                                      # expect 8c403cd DR-119
ls decisions/ | grep -oE '^DR-[0-9]+' | sort -u | sort -t- -k2 -n | tail -3   # confirm DR-120 free
```

Then read, in order: `decisions/DR-119_*.md`, this handoff, and
`_AI_HANDOFFS/from_claude_code/F2-LOR-1012_LOR_STUDIO_FEATURE_COMPLETION_MATRIX.md`.

**Do not touch production until DR-120 exists.** Every external gate in DR-119 clause 6 is still
closed.
