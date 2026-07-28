# B1-503 StoryForge Product Recovery Report

Status: **COMPLETE — LIVE FOUNDER PILOT VERIFIED**

Canonical product authority:
`_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`

Required and observed SHA-256:
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

Production URL:
`https://missionmedinstitute.com/storyforge/`

## 1. Root cause

The production runtime is internally consistent, but it was built from an
incomplete manual port rather than from the Founder-approved executable HTML.

Three different authority layers emerged:

1. Normative product authority: the Founder-approved `storyforge-v5.html`.
2. De facto implementation authority: manually authored
   `storyforge-v5/public/index.html`, `public/app.js`, and `public/styles.css`.
3. Deployment authority: the generated WordPress `release.php` selected by the
   isolated StoryForge MU route.

The canonical HTML never entered the build graph. B1-500 manually recreated
part of the product in `public/`; B1-501 then treated that explicitly partial
foundation as complete, prohibited a product re-audit, and integrated only
authentication, routing, and Matrix seams. B1-502 corrected major visual drift
but retained the simplified manual application model. Its validation proved
release integrity, authentication, privacy, routing, caching, and rollback. It
did not prove complete product conformance.

There is no deployment-byte drift: production serves the exact generated
B1-502 bytes. The defect is source-authority drift.

## 2. Exact pre-recovery source-to-production trace

| Layer | Exact identity |
|---|---|
| Canonical V5 HTML | SHA-256 `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`; 291,239 bytes |
| B1-500 manual foundation | commit `be43c6d0a4520ed761a3d112a25452f26683f9ca` |
| B1-501 integration baseline | commit `5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc` |
| B1-502 visual/infrastructure foundation | commit `f23d7daeb289c7340ec4ab1903956cc4cfec282a` |
| Runtime packaging | commit `62ed421309c236d4b6ac05faca606108c0143592` |
| Deployed product commit/pointer | `4bd956b6ea222d20428c41415236a73b93576447` |
| Deployed index | SHA-256 `7132385f74c28b01fa8205f77aceb45b3ca141911c04cb3c6641875c947a8ac4` |
| Deployed app asset | SHA-256 `3a60a405a47d78d943d507720a9c3f0b91198876a9194d8046e5fe292cdcc82b` |
| Deployed auth asset | SHA-256 `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` |
| Deployed stylesheet | SHA-256 `c4724118cf635c83c2451e6cef4f84edab69cf03ed446c3c5a13227e909dee1d` |
| Generated release ID | `v-963b8f5eb4d8c727` |
| Generated `release.php` | SHA-256 `845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`; 409,055 bytes |
| Live route | SHA-256 `23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`; 30,528 bytes |

Before repair, the active production pointer was reverified read-only as:

`missionmed-storyforge-runtime/current -> releases/4bd956b6ea222d20428c41415236a73b93576447`

All 13 non-index aliases matched that generated release manifest. The B1-502
combined handoff's separate `be5fd3...`/`093803...` “stable frontend” table is
an intermediate stale receipt; it is not the deployed runtime identity.

The final recovered production trace is:

| Layer | Exact identity |
|---|---|
| Source-conformance commit | `36e823da7be1b436e336bfa9a9997611e6449117` |
| Generated-release commit | `5141939b6c7dc3d0d415e28899777dab372180c2` |
| Deployed cutover commit | `6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Railway deployment | `fa7ad084-4dae-4039-a154-2250a407d95e` (`SUCCESS`) |
| Railway image | `sha256:fa952146914f1eb4ab3cdfd6ccfe7f2d0d69c1638f6de59668f2272443500d2b` |
| Kinsta pointer | `releases/6f45dbbd2150ba11000236a4959f70434f6edb77` |
| Release ID | `v-0912286e7dfc2327` |
| Deployed index | `ade2b11958fa70305e6bb5a99e08f1e9621a37cb3cf7df5ce4af964016fee27b` |
| Deployed app | `71f618e9afac78d13c1b22d30b0ad43e2b2c7ab162b6e1d92ae607b3b853f3fb` |
| Deployed auth | `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` |
| Deployed CSS | `41e546d34bfd73f0f9f446047640ba2cf7c303b092841b9f5115911293e7ddf1` |
| Deployed route | `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61` |
| Deployed `release.php` | `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e` |

## 3. Authority drift

### B1-500

B1-500's own terminal record classified the implementation as a reversible
foundation with Student, Mentor, and Interview Intelligence stages only
partially complete. Missing GA surfaces included Quick Look/Review, full
mentor tooling, Teaching Mode, 1:1, richer activity/roster controls, complete
Question Workshop semantics, file import UX, and real audio.

### B1-501

B1-501's execution authority then stated “B1-500 is complete and accepted,”
forbade rediscovery/re-audit/redesign, treated the B1-500 product as a black
box, and scoped work to SSO, routing, auth, base-path, and integration seams.
That decision converted the incomplete `public/` implementation into the
operational product authority.

### B1-502

B1-502 performed a bounded dark-theme and accessibility reconciliation, then
generated and deployed the exact manual-port runtime. Its test suite compared
the candidate to its own source and hashes. No build or test referenced the
canonical HTML, and no canonical screenshot/behavior diff existed.

## 4. Initial product-conformance matrix

The canonical artifact was executed directly in Chrome. Production was
inspected through the authenticated Founder session. “Source,” “build,” and
“production” have the same rating because the live runtime matches its
generated source bytes.

| Requested surface | Canonical interpretation | Source/build/production | Initial reason |
|---|---|---:|---|
| Home | Student Home | PARTIAL | Production omits title-first capture, memory prompt, unfinished-story panel, mentor preview, and canonical status-chip navigation. |
| Library | Student Story Library | FAIL | Production lacks canonical search/sort/star/bird/position filters and rich rows with audio, lesson, independent S/M dots, question count, Quick Look, and Open actions. |
| Story Detail | Centered Quick Look plus full workspace | FAIL | No centered Quick Look exists; the full workspace is materially incomplete. |
| Story Builder | Quick Capture plus editable Working Version | FAIL | Production uses a separate simplified page and lacks canonical overlay, fields, drafting, reflection, classification, and revision flow. |
| Notifications | Student Notifications | PARTIAL | Real transaction-bound records exist, but the rail/Home badge, mark-all, trigger coverage, click semantics, and exact five-minute coalescing are incomplete. |
| Quick Capture | Centered capture overlay | PARTIAL | Secure private text creation exists, but the modal geometry, prefix, lesson, score, themes, prompt linking, draft restore, and real recording handler are absent. |
| Interview Prep | Readiness/families/questions landing | FAIL | Production shows six cards and a question-vs-question model instead of the canonical 26-question readiness and story-pair model. |
| Mentor | Role-gated suite | FAIL | Home, roster, per-student workspace, queue, Activity, Teaching Mode, and 1:1 are absent or materially simplified. |
| Settings | Shared Settings | PARTIAL | Six real environments and signed identity exist; canonical entitlement, timezone, and layout details are incomplete. |
| Review | Distributed Quick Review/full-workspace lifecycle | FAIL | Opening incorrectly changes status; status writes require feedback; Quick Review and Assign drawer are absent. |
| Question Coverage | Interview Prep readiness model | FAIL | The legacy question coverage concept was implemented as the wrong domain model. |
| Reflection | Embedded story-workspace reflections and mentor asks | FAIL | Not implemented. |
| Story Classification | Embedded Birds and Ideal-for-position facets | FAIL | Production has one scalar classification instead of both multi-select facets and attribution. |
| Program Fit | No standalone canonical screen | N/A | Canonical product has Ideal-for-position and Where-it-could-serve facets, not a Program Fit page. No new page will be invented. |
| Mentor Notes | Four distinct canonical workflows | FAIL | Feedback, mentor reflection asks, question coaching notes, and per-student coaching history are not implemented as separate provenance-bearing workflows. |

### Initial FAIL evidence and repair disposition

Line references below identify the final executable definitions in the pinned
canonical HTML, including later definitions that override earlier ones.

| Initial FAIL | Canonical HTML reference | Pre-recovery implementation and files | Reason | Executed repair |
|---|---|---|---|---|
| Library | `storyforge-v5.html:1314` | Simplified list in `public/app.js`, `public/styles.css`; limited DTOs in `server/app.mjs` | Missing search, sort, filters, rich rows, independent attribution, Quick Look, and full workspace actions | Ported canonical library renderer/filters and added the signed DTO/domain fields and authorization required to support them. |
| Story Detail | `storyforge-v5.html:1426-1607`, `1921-2003`, final Quick Look at `3019-3104` | One simplified workspace in `public/app.js`; conflated writes in `server/app.mjs` | No centered Quick Look; incomplete workspace and incorrect lifecycle/ownership semantics | Added Quick Look and full workspace, immutable telling/revisions, role-owned fields, audit history, and separate server transitions. |
| Story Builder | `storyforge-v5.html:1443-1607`, capture entry at `1825-1918` | Separate reduced capture page in `public/app.js`; narrow story schema | Missing title-first overlay, Working Version, reflection, classification, autosave, and revision flow | Ported canonical capture/workspace composition; added account-scoped drafts, atomic consumption, revision/history, reflection, and classification RPCs. |
| Interview Prep | final `renderPrep` at `2642-2701`; Workshop at `2704-2880`; Question Library at `2881-2943` | Six-card question-vs-question model in `public/app.js`; `sf_workshops` domain in the B1-500 schema | Wrong unit of comparison and no canonical 26-question readiness model | Implemented one-question/many-story pairs, preferred/confirmed/strength readiness, follow-ups, ordering, governed library/imports, and role ownership. |
| Mentor | `storyforge-v5.html:1610-1823`, Teaching Mode `2088-2161`, 1:1 `2163-2201` | Small mentor summary and unavailable placeholders in `public/app.js`; incomplete authorization in `server/app.mjs` | Home, roster, student workspace, queue, activity, Teaching Mode, and 1:1 were absent or materially reduced | Ported every canonical mentor surface and added assignment-bound, revocation-safe server policies, activity events, queues, and durable 1:1 operations. |
| Review | Quick Look/final actions at `3019-3104`; Review Queue at `1759-1775` | Opening/status/feedback were conflated in `public/app.js` and `server/app.mjs` | Opening changed status; review status required feedback; no Quick Review or assignment workflow | Separated first-open from lifecycle, status from feedback/score/classification, and added queue/Quick Look/assignment workflows with optimistic concurrency. |
| Question Coverage | final `renderPrep` at `2642-2701` | Question-vs-question workshop counts in `public/app.js` and old schema | Coverage was modeled against the wrong entity and readiness rule | Rebuilt coverage from story-question pairs using the exact preferred, mentor-confirmed, strength-at-least-3 rule. |
| Reflection | embedded workspace block at `1481-1501` | Absent from `public/app.js`, `server/app.mjs`, and schema | No student reflection or mentor reflection asks | Added separately attributed student reflections and mentor asks with server ownership, notifications, and audit. |
| Story Classification | Birds and Ideal-for-position at `1502-1521`; Quick Look actions at `3091-3100` | One scalar `classification` in `public/app.js`, `server/app.mjs`, and schema | Collapsed two multi-select domains and lost attribution | Added independent multi-select Birds and position facets with student/mentor ownership and immutable audit provenance. |
| Mentor Notes | workspace feedback/reflection at `1481-1546`; Quick Look feedback at `3101-3103`; activity at `1777-1823` | One generic note/feedback path in `public/app.js` and `server/app.mjs` | Four canonical note workflows were conflated | Added distinct feedback, reflection ask, question-coaching note, and per-student coaching-history operations and event types. |

## 5. Critical semantic defects identified before repair

1. `sf_open_story` mutates `submitted`/`resubmitted` to `opened`; canonical
   opening stamps `firstOpened` and an audit event without changing status.
2. `sf_review_story` conflates lifecycle, feedback, score, classification, and
   notification, and requires feedback for a one-click status change.
3. One `starred` boolean replaces independent student and mentor stars.
4. One scalar `classification` replaces Birds and Ideal-for-position.
5. `sf_workshops` compares question A with question B. Canonical Question
   Workshop opens one question and compares multiple story-question pairs.
6. Follow-ups are student-scoped instead of story-question-pair-scoped.
7. Notifications do not implement the exact five-minute coalescing rule.
8. Activity is not a filterable audit-event surface.
9. Teaching Mode and 1:1 are presented as unavailable despite being canonical
   GA features.
10. No canonical artifact hash or behavioral/screenshot assertion participates
    in the build or release gate.

## 6. Repair architecture

The recovery preserves the working infrastructure seams and replaces only the
product presentation and domain gaps:

- keep `public/auth.js`, WordPress SSO, JWT, Matrix handoff, base-path routing,
  Kinsta cache bypass, isolated MU route, and immutable release mechanism;
- mount the canonical DOM roots and port only the final executed canonical
  renderers, not dead overridden functions;
- derive production CSS from the canonical blocks in document order, using the
  existing self-hosted fonts;
- initialize product state only from signed API responses; no seeded production
  users/stories, product `localStorage`, client role switch, canned AI, or fake
  audio success;
- add forward-only PostgreSQL migrations and server-enforced RPCs for canonical
  lifecycle, story fields, story-question pairs, notifications, mentor
  operations, and audit;
- leave legacy tables/API objects dormant for compatibility rather than
  deleting or reinterpreting existing rows;
- add a hash-pinned canonical-vs-candidate browser gate at desktop, tablet, and
  mobile widths.

## 7. Infrastructure prestate preserved

Read-only production verification before B1-503 mutation:

- StoryForge feature enabled;
- exact allowlist count: 1;
- exact role-override count: 1;
- allowed role: student only;
- mentor access disabled;
- Railway API deployment `fb43a551-04c8-41f7-a6e6-fb16aae3894e` running;
- Railway PostgreSQL deployment
  `f5c7179e-b805-4e82-b080-d2349a0a47cf` running;
- database ledger contains exactly the three expected migrations;
- database counts: 1 StoryForge user, 0 stories, 0 questions, 0 audit events;
- protected Matrix/legacy StoryForge origin and public hashes matched;
- no B1-503 remote mutation has occurred at this checkpoint.

## 8. Repaired screens and workflows

Every canonical comparison surface passed at desktop, tablet, and mobile
widths. The deployed production bytes are the exact verified repository
release.

| Founder-requested surface | Canonical HTML | Repository | Production |
|---|---:|---:|---:|
| Home | PASS | PASS | PASS |
| Library | PASS | PASS | PASS |
| Story Detail | PASS | PASS | PASS |
| Story Builder | PASS | PASS | PASS |
| Notifications | PASS | PASS | PASS |
| Quick Capture | PASS | PASS | PASS |
| Interview Prep | PASS | PASS | PASS |
| Mentor | PASS | PASS | PASS through exact deployed bytes and authorization; role-gated under the student pilot |
| Settings | PASS | PASS | PASS |
| Review | PASS | PASS | PASS through exact deployed bytes and authorization; no production story was fabricated |
| Question Coverage | PASS | PASS | PASS |
| Reflection | PASS | PASS | PASS through exact deployed bytes; no production story was fabricated |
| Story Classification | PASS | PASS | PASS through exact deployed bytes; no production story was fabricated |
| Program Fit | PASS as canonical position/use facets | PASS | PASS; no standalone page was invented |
| Mentor Notes | PASS | PASS | PASS through exact deployed bytes and assignment authorization |

Additional canonical surfaces verified as PASS: Quick Look, Question Library,
Mentor Students, per-student Mentor Workspace, Review Queue, My Activity,
Teaching Mode, and active 1:1 Session.

Final gates:

- canonical authority/hash: PASS;
- unit suite: 44/44;
- PostgreSQL authorization and B1-503 conformance: PASS;
- browser E2E: 16/16;
- canonical browser comparisons: 72/72;
- responsive, keyboard, overflow, and serious accessibility checks: PASS;
- API-only build, secret scan, npm audit, and `git diff --check`: PASS;
- deterministic release/source provenance: PASS.

Recovered workflows include:

- title-first private Quick Capture with account-scoped durable autosave,
  atomic story creation/draft consumption, real MediaRecorder capture when
  configured, immutable originals, and truthful unavailable states;
- rich Library and mentor rows with development state, lesson, independent
  student/mentor scores and stars, audio duration, interview-question count,
  Quick Look, and full workspace actions;
- canonical submitted/opened/reviewed/revised lifecycle timestamps with named
  reviewer attribution and append-only history;
- separate mentor feedback, reflection asks, coaching notes, use suggestions,
  classification, and status writes with role-owned fields;
- one-question/many-story Interview Prep and Question Workshop, exact preferred
  confirmed strong-pair readiness, per-pair strength, follow-up editing,
  ordering, source, clinical classification, and family/theme suggestions;
- governed question single-add and paste/CSV/XLSX import with expansion bounds,
  duplicate review, server-rechecked preview fingerprints, draft-first commit,
  durable history, audited rollback, and downstream-use refusal;
- complete Mentor Home, roster, student workspace, queue, activity, Teaching
  Mode, and transaction-backed 1:1 agenda/session flows.

## 9. Files changed

The exact product/runtime inventory is:

- `storyforge-v5/public/app.js`
- `storyforge-v5/public/index.html`
- `storyforge-v5/public/styles.css`
- `storyforge-v5/server/app.mjs`
- `storyforge-v5/server/imports.mjs`
- `storyforge-v5/server/storage.mjs`
- `storyforge-v5/infra/postgres/migrations/20260728045100_b1_503_story_domain_conformance.sql`
- `storyforge-v5/infra/postgres/migrations/20260728045444_b1_503_interview_mentor_conformance.sql`
- `storyforge-v5/infra/edge/generated-asset-aliases.mjs`
- `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php`
- `storyforge-v5/infra/wordpress/missionmed-storyforge-runtime/release.php`
- `storyforge-v5/dist/index.html`
- `storyforge-v5/dist/assets/app.71f618e9afac.js` (replaces
  `app.3a60a405a47d.js`)
- `storyforge-v5/dist/assets/styles.41e546d34bfd.css` (replaces
  `styles.c4724118cf63.css`)
- `storyforge-v5/package.json`
- `storyforge-v5/railway.json`
- `storyforge-v5/playwright.conformance.config.mjs`
- `storyforge-v5/playwright.integration.config.mjs`

Exact safety/build/evidence tooling:

- `storyforge-v5/scripts/apply-production-migrations.sh`
- `storyforge-v5/scripts/assert-release-source.mjs`
- `storyforge-v5/scripts/build-static.mjs`
- `storyforge-v5/scripts/build-wordpress-route-manifest.mjs`
- `storyforge-v5/scripts/check-api-only-build.mjs`
- `storyforge-v5/scripts/check-canonical-authority.mjs`
- `storyforge-v5/scripts/check-product-provenance.mjs`
- `storyforge-v5/scripts/create-integration-evidence-dir.mjs`
- `storyforge-v5/scripts/install-b1-503-kinsta-release.sh`
- `storyforge-v5/scripts/release-source.mjs`
- `storyforge-v5/scripts/rollback-b1-503-kinsta-release.sh`
- `storyforge-v5/scripts/run-conformance.sh`
- `storyforge-v5/scripts/run-e2e.sh`
- `storyforge-v5/scripts/run-integration.sh`
- `storyforge-v5/scripts/run-local.sh`
- `storyforge-v5/scripts/run-postgres-tests.sh`
- `storyforge-v5/scripts/update-integration-evidence.mjs`

Exact test inventory:

- `storyforge-v5/tests/conformance/authority-contract.mjs`
- `storyforge-v5/tests/conformance/helpers/harness.mjs`
- `storyforge-v5/tests/conformance/product-conformance.spec.mjs`
- `storyforge-v5/tests/e2e/b1-503-behavioral-gates.spec.mjs`
- `storyforge-v5/tests/e2e/storyforge.spec.mjs`
- `storyforge-v5/tests/integration/storyforge-sso.spec.mjs`
- `storyforge-v5/tests/postgres/authorization_matrix.sql`
- `storyforge-v5/tests/postgres/b1_503_conformance_matrix.sql`
- `storyforge-v5/tests/unit/b1-503-release-blockers.test.mjs`
- `storyforge-v5/tests/unit/build-security.test.mjs`
- `storyforge-v5/tests/unit/cutover-scripts.test.mjs`
- `storyforge-v5/tests/unit/imports.test.mjs`
- `storyforge-v5/tests/unit/release-provenance.test.mjs`
- `storyforge-v5/tests/unit/runtime-contracts.test.mjs`

Closeout documents, receipts, and screenshot evidence are under
`_AI_HANDOFFS/from_codex/B1-503*`.

Protected `wp-content/plugins/missionmed-hub` assets, Matrix shell assets,
Cloudflare, DNS, and unrelated product files were not edited.

## 10. Commits

- `36e823da7be1b436e336bfa9a9997611e6449117` —
  `B1-503: restore StoryForge V5 product conformance`
- `5141939b6c7dc3d0d415e28899777dab372180c2` —
  `B1-503: generate canonical StoryForge release`
- `6f45dbbd2150ba11000236a4959f70434f6edb77` —
  `B1-503: add guarded production cutover and rollback`

The final evidence/handoff commit is reported by the completing Codex turn
because a document cannot include its own Git hash.

## 11. Deployment ID and runtime hashes

Railway deployment:
`fa7ad084-4dae-4039-a154-2250a407d95e` (`SUCCESS`), image
`sha256:fa952146914f1eb4ab3cdfd6ccfe7f2d0d69c1638f6de59668f2272443500d2b`.

Kinsta pointer:
`releases/6f45dbbd2150ba11000236a4959f70434f6edb77`.

| Object | SHA-256 |
|---|---|
| Index | `ade2b11958fa70305e6bb5a99e08f1e9621a37cb3cf7df5ce4af964016fee27b` |
| App | `71f618e9afac78d13c1b22d30b0ad43e2b2c7ab162b6e1d92ae607b3b853f3fb` |
| Auth | `960289f115f2661c8e1bcad314cca3e4e7a592ab918455c3da8acb37d497544e` |
| CSS | `41e546d34bfd73f0f9f446047640ba2cf7c303b092841b9f5115911293e7ddf1` |
| Route | `1cf024fc47f8130f980a79af6090c9f214148ac82c397fb8b94a8b7945c67f61` |
| `release.php` | `3215eed4837d9a9d712706003e352ead3423e399bea76c20818270d93fcb199e` |

Recovery points:

- MyKinsta manual backup
  `B1-503 pre product recovery 2026-07-28T08:03:10Z`;
- private Kinsta recovery point
  `B1-503-RP-KINSTA-PRE-20260728T080310Z`;
- PostgreSQL 18 dump
  `18d737fba373c0a5da0cd43874601a0cecd2a81a9c1c9ad40d55febdd9ccea6c`,
  isolated restore PASS;
- locked non-expiring Railway backup
  `59a491f8-ecb2-4fc8-b5b3-da43ccada133`;
- sealed Kinsta rollback receipt
  `a2f4cf3638e2356ae68037fc44ec102a67c841d80b5861d8d8ff066c1acd390b`.

The live pilot is enabled for exactly one allowlisted Founder mapped to
`student`, with one role override, zero cohort entries, a 60-second token TTL,
and an exact WordPress-to-database identity mapping. The post-validation
database contains five migration rows, one user, zero stories, zero drafts, 26
questions, zero notifications, zero audit events, zero active mentor
assignments, and 25 RLS-enabled StoryForge tables.

The authenticated production Home, Library, Interview Prep, Notifications,
Settings, Quick Capture, and Question Workshop all opened successfully. A
fresh later tab completed another token exchange. No data was created or
changed. Railway reported zero observed HTTP `5xx`; its only application
follow-up is a non-material `pg` deprecation warning about parallel queries on
one client.

The Kinsta install completed the release/pointer/route publication and all
identity checks, then WP-CLI exited `139` during the scoped site-cache command.
The provider had accepted the purge, the separate scoped CDN call returned
HTTP `200` and the exact success body, and repeated live checks proved exact
bytes, `CF-Cache-Status: DYNAMIC`, `X-Kinsta-Cache: BYPASS`, and no `Age`.
Install and rollback tooling now call only the scoped Kinsta PHP site/CDN
methods with strict response validation. No object, `--all`, or broad cache
purge occurred.

Protected remote/public hashes remained:

- legacy JavaScript
  `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`;
- legacy CSS
  `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`;
- Matrix PHP
  `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95`;
- Matrix shell
  `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a`.

## 12. Before/after screenshots

Browser-chrome-free initial production comparisons are stored in
`_AI_HANDOFFS/from_codex/B1-503_evidence/comparison-before/`:

- Library:
  `028482be7d176df0659e58d09b6f804597987c7ad5b3fbc3966e4ad805cada98`;
- Interview Prep:
  `f7a81ceb3ef490b52c596ae540da93642e9e48f5cfa6aeb0ff0e9d0758ec6e47`.

Authenticated final production screenshots are stored in
`_AI_HANDOFFS/from_codex/B1-503_evidence/production/`. Their exact hashes are
recorded in `B1-503_PRODUCTION_DEPLOYMENT_RECEIPT.md`. Canonical reference and
local 72-surface comparison images remain separately labeled under
`canonical/` and `after/`; none is presented as a live screenshot.

## 13. Remaining differences

**NONE material.**

Known infrastructure-dependent states must remain truthful:

- AI suggestions stay gated until separately approved and configured.
- Audio must either use the real MediaRecorder/private-storage/transcription
  chain or display a truthful unavailable state; no simulation may ship.
- The exact one-Founder student-pilot acceptance remains valid only for that
  pilot and expires before any non-Founder/mentor enablement or
  hosting-principal change.
- Data-dependent Story Detail/Review states were not opened live because the
  production database truthfully contains zero stories; mentor screens were
  not opened live because the pilot has no mentor assignment. Exact deployed
  bytes, 72/72 browser conformance, and PostgreSQL authorization cover those
  surfaces without fabricating data or broadening access.

## 14. Prevention recommendation

The canonical artifact must become a mandatory build/test input:

1. verify its pinned SHA-256 before every product build;
2. generate canonical semantic and visual baselines only from that exact hash;
3. require candidate interaction and screenshot comparison for every canonical
   surface before release;
4. bind source commit, deterministic dist hashes, generated release manifest,
   runtime pointer, and live alias hashes in one release receipt;
5. forbid “foundation complete” or integration-only acceptance from satisfying
   a product-conformance gate;
6. require any claimed Founder revision to include a new immutable artifact,
   hash, changed-screen inventory, and supersession record.
