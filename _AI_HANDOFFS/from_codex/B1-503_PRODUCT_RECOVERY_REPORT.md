# B1-503 StoryForge Product Recovery Report

Status: IN PROGRESS

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

## 2. Exact source-to-production trace

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

The active production pointer was reverified read-only as:

`missionmed-storyforge-runtime/current -> releases/4bd956b6ea222d20428c41415236a73b93576447`

All 13 non-index aliases matched the generated release manifest. The B1-502
combined handoff's separate `be5fd3...`/`093803...` “stable frontend” table is
an intermediate stale receipt; it is not the deployed runtime identity.

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

Local release-candidate status: every canonical comparison surface is PASS at
desktop, tablet, and mobile widths. Production remains unchanged until the
backup and cutover gates in this report are complete.

| Founder-requested surface | Recovered production candidate |
|---|---:|
| Home | PASS |
| Library | PASS |
| Story Detail | PASS |
| Story Builder | PASS |
| Notifications | PASS |
| Quick Capture | PASS |
| Interview Prep | PASS |
| Mentor | PASS |
| Settings | PASS |
| Review | PASS |
| Question Coverage | PASS |
| Reflection | PASS |
| Story Classification | PASS |
| Program Fit | PASS through the canonical Ideal-for-position and Where-it-could-serve facets; no invented page |
| Mentor Notes | PASS across feedback, reflection asks, question coaching, and coaching history |

Additional canonical surfaces verified as PASS: Quick Look, Question Library,
Mentor Students, per-student Mentor Workspace, Review Queue, My Activity,
Teaching Mode, and active 1:1 Session.

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

The candidate changes are confined to:

- StoryForge public product assets (`public/`);
- StoryForge API modules (`server/`);
- two forward-only B1-503 PostgreSQL migrations;
- StoryForge unit, PostgreSQL, browser, integration, and conformance tests;
- deterministic release/provenance, Railway API-only, and collision-safe
  evidence scripts/configuration;
- this B1-503 report and combined handoff.

Protected `wp-content/plugins/missionmed-hub` assets, Matrix shell assets,
Cloudflare, DNS, and unrelated product files were not edited.

## 10. Commits

Pending exact source and generated-release commits after the locally verified
tree is frozen.

## 11. Deployment ID and runtime hashes

Pending gated deployment.

## 12. Before/after screenshots

Before-production, canonical-reference, and local-after screenshots are stored
under `_AI_HANDOFFS/from_codex/B1-503_evidence/`. Final authenticated
production screenshots will be added only after the guarded cutover.

## 13. Remaining differences

Local product candidate: NONE material identified by the final static,
behavioral, PostgreSQL, and 72-surface comparison gates.

Known infrastructure-dependent states must remain truthful:

- AI suggestions stay gated until separately approved and configured.
- Audio must either use the real MediaRecorder/private-storage/transcription
  chain or display a truthful unavailable state; no simulation may ship.
- No non-Founder or mentor account may be enabled under the expired
  one-Founder pilot acceptance.

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
