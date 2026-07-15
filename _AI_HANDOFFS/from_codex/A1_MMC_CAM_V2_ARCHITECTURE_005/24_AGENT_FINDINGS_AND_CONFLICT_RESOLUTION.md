# 24 Agent Findings and Conflict Resolution

RESULT: `INDEPENDENT_FINDINGS_SYNTHESIZED_WITH_DISSENT_PRESERVED`

## Method

Specialist agents performed read-only repository, runtime, architecture, security, product, accessibility, advising, reliability, and implementation reviews. The supervising synthesis retained their adverse findings, reconciled contradictions against MissionMed authority and observed code/runtime evidence, and revised the architecture before scoring. No specialist agent changed runtime code, production, providers, protected systems, branches, or external state.

## Findings by review lane

| Review lane | Principal finding | Architecture consequence |
| --- | --- | --- |
| Supervisor / authority | The task is architecture-only and must follow fresh MissionMed OS/Matrix authority; historical reports cannot silently become current truth | Explicit scope, protected matrix, future-authority gates, no mutation/deploy |
| Repository provenance (Herschel) | The mounted private UI, core oracle, and Partner Demo are parallel/cloned families; fixtures, global selection, static students, and decorative post-review state drift independently | One route subject authority, canonical projections/commands, fixture isolation, no incremental Partner connection |
| Data/truth (Sagan) | First-label origin checking, AI opt-in fallback, browser roster proof, nontransactional operations, weak transcript/Webex boundaries, and machine-local topology are unsafe | Exact origins, affirmative provider authority, server attestation, atomic commands, opaque assets, separate worker |
| Security (Sentinel) | Transcript path/symlink access, wrong-identity attachment, unreviewed AI, fixture resurrection, Webex token/host behavior, and missing publication isolation are P0 | 006-A security seal, forced RLS principals, consent sequence, TOCTOU-safe broker, student projection, kill switches |
| Advising safety (Avicenna/Osler) | Evidence alone does not authorize advice; composites and protected-trait proxies can harm; student recourse and mentor workload were underspecified | Advising policy registry, prohibited claims, decomposed signals, co-authorship/recourse, workload/error budgets |
| Product/UX (Miyamoto) | Current flow has valuable longitudinal concepts but dashboard density, global selectors, cloned panes, and Partner styling obscure the operating loop | Today/Students/Work/Reviews, contextual routes, one dominant vessel, exact mentor/student loops |
| Frontend evolution (Darwin role-equivalent coverage) | No separate Darwin worker was available/instantiated; the supervising agent combined Herschel's provenance map, Miyamoto's interaction model, Lorentz's boundaries, and direct source/runtime inspection rather than pretending Darwin ran | Explicit clone retirement, route/state evolution, compatibility boundaries and phased file map in reports 01, 08, 20, 21 |
| Accessibility (Vitruvius) | Clickable divs, focus/dialog gaps, tiny type, missing live states, clipped mobile, media gaps, and absent cognitive/i18n tests block core use | Semantic contracts, 16px/14px type floors, 44px touch, six widths/zoom, AT/media/RTL/cognitive gates |
| Backend/operations (Lorentz) | Shared server coupling, synchronous provider flow, weak job ownership/reconciliation, and incomplete observability risk ecosystem regression | Thin gateway, bounded modules, separate workload identity, durable jobs, owner/SLO/dead-letter/reconciliation |
| Concurrency/reliability (Turing) | First draft lacked generation fencing, consumer inbox, exact idempotency/current-auth replay, atomic multi-object commit, cutover, restore and quantitative races | CAS lease generation, outbox/inbox, server-derived hashes, one transaction, single writer, crash/race/restore thresholds |
| Expert product board | First synthesis remained below 9 because policy, student agency, offline truth, workload, exact anatomy, media/accessibility, roadmap and contracts were incomplete | Mandatory repair pass across reports 03–17 and 20–22 before final scoring |

## High-value repository findings retained

1. **Preserve, do not worship, current implementation.** Existing private routing/auth, persistence contracts, identity/roster lanes, Webex trigger policy, worker/pipeline code, intelligence functions, schemas, migrations, and validators are inputs to 006 archaeology. None is automatically current CAM v2 authority.
2. **Selection continuity is a genuine useful invariant.** The existing validator and subject-oriented concepts survive, strengthened into immutable route/session subject authority and cross-layer readback.
3. **Current student denial is a safety feature.** The preview is not a product. Student access stays off until exact principal resolution, separate publication tables/serializer, RLS/server isolation, recourse, and adversarial tests exist.
4. **AI output is not canonical evidence.** Schema-valid output and embedded quote text do not prove transcript support. CAM v2 records speaker, exact support and contradiction spans, lineage, model/prompt/run versions, and human decisions.
5. **Webex title policy is discovery, never consent.** `[MM-ADV]` can select candidates only after acquisition authority exists. It cannot authorize download, processing, identity attachment, AI transfer, retention, or publication.
6. **Fixture isolation must be structural.** Labels and conventions are insufficient; fixture/live tenant/environment constraints, principals, asset roots, and commands cannot cross.
7. **Strong CAM patterns are experiential, not decorative.** Stable chrome, dominant task, disciplined accent, causal motion and progressive disclosure survive. Sibling metaphors, gamification, particles, XP and cloned component styling do not.

## Conflict-resolution ledger

### CAM identity versus calm mentoring

- **Conflict:** Strong visual family identity could become spectacle; calm advising could become generic enterprise UI.
- **Resolution:** Keep deep ink, deliberate geometry, stable spatial model, one dominant vessel, ember action, human-gold/machine-cyan semantics, and semantic continuity/evidence signatures. Reject decorative ambient motion by default, particles, streaks, confetti, XP, game copy, tiny microtype, glow everywhere, and decorative telemetry.
- **Gate:** Five-second hierarchy plus reduced-motion/forced-colors/AT and mentor usability review in the 007 prototype.

### Fast review versus safe review

- **Conflict:** A universal 90-second review target encouraged rubber-stamping; an open-ended review queue could consume mentoring time.
- **Resolution:** Three-plus-four Today budget, deterministic ordering with dedup/per-student cap/starvation protection, and complexity bands: small manual median ≤90 seconds; bounded AI-assisted median ≤3 minutes/p90 ≤5 minutes; complex/sensitive sessions defer without penalty. Consequential, identity, sensitive, and publication decisions are never bulk approved.

### Offline recovery versus protected-data minimization

- **Conflict:** Product wanted resilient capture; security rejected ambiguous local persistence and false withdrawal claims.
- **Resolution:** Initial release uses `no-store`, no Service Worker, no durable sensitive cache. Disconnected memory-only input says `NOT SAVED` and may be lost. A future encrypted device-bound cache needs its own ADR/TTL/reauth/revocation disclosures. Exported or already viewed copies are never described as remotely erased.

### Atomic user actions versus distributed effects

- **Conflict:** Early language allowed a saga across canonical objects; reliability required one observable command outcome.
- **Resolution:** Canonical versions, idempotency result, audit, lineage and outbox commit in one database transaction or the command fails. Same scoped-key/full-semantic-hash replay rechecks current authority and returns the recorded outcome; scoped-key/hash mismatch is 409. Only external effects after outbox commit use resumable sagas.

### Assignment revocation versus student publication rights

- **Conflict:** Immediate revocation wording could accidentally remove a student's already-published plan or let a former mentor keep authority.
- **Resolution:** Mentor assignment expiry immediately denies mentor queries, commands, retries and new publication. Exact student entitlement is separately governed by publication correction/withdrawal/expiry/retention policy; it is not silently coupled to mentor assignment.

### Student transparency versus mentor privacy

- **Conflict:** Students need provenance and correction; exposing confidence internals, private notes or raw evidence would harm privacy and advising candor.
- **Resolution:** Student projection includes publisher, date, safe source category, agreed rationale, authorship and correction history. It excludes private notes, internal risk/confidence, unresolved identity, raw transcript/media, unreviewed AI and cross-student references. Preview/payload/readback run through the exact student principal.

### Student beneficiary versus student co-author

- **Conflict:** The first design still treated students primarily as recipients.
- **Resolution:** Add canonical student-authored goals, priorities, interests, preferences, reflections, blocker reports, attestations, consent and notification choices; distinguish acknowledged/agreed/disputed/self-reported/mentor-verified; allow decline, defer, renegotiate, alternative, correction and outside-mentor escalation. Escalation ownership is an explicit pre-live institutional dependency.

### Attention ranking versus harmful person scoring

- **Conflict:** Operations need ordering; a composite risk/readiness/trust score can encode sensitive traits, false certainty and peer ranking.
- **Resolution:** Rank queue conditions by visible policy, consequence/due time, sufficiency, caps and starvation rules. Show decomposed objective signals with unknown states. Never persist/show a holistic person score or use protected traits/proxies to disadvantage priority.

### Full event sourcing versus incremental implementation

- **Conflict:** Replayability favored full event sourcing; current system and delivery risk argued against a rewrite.
- **Resolution:** Versioned kind-constrained canonical records plus immutable evidence, review, lineage, audit, idempotency, outbox/inbox and rebuildable projections. Full event sourcing remains rejected unless future evidence proves necessity.

### Shared service convenience versus least privilege

- **Conflict:** Existing shared HQ/Webex/OpenAI/Supabase paths could accelerate implementation but broaden blast radius.
- **Resolution:** Same-origin HQ remains a thin auth/gateway shell; MMC modules are bounded; provider work runs in a separate least-privilege worker; no shared credential fallback, `service_role`, `BYPASSRLS`, browser secret, Scheduler/Calendar/Webex mutation, or broad server rewrite.

### Migration continuity versus dual-write risk

- **Conflict:** A gradual v1/v2 transition could invite dual writes and fork canonical truth.
- **Resolution:** Read-only inventory → deterministic backfill → shadow comparison → freeze v1 writer → atomic v2 gate → verify → retire old writes. Exactly one writer exists at every point. Roll back before writes or forward-repair after cutover; never silently enable dual write.

## Partner Demo steering resolution

The steering directive is binding. The Partner Demo is classified `HISTORICAL`, `SYNTHETIC`, `FUNCTIONAL-CONCEPT REFERENCE ONLY`, `DESIGN REJECTED`, and `NOT CAM V2.0 AUTHORITY`. It is preserved because some concepts—student visibility, mentor context, commitments, outcomes and continuity—are useful independently. Its yellow/gold brand framing, dashboard/card hierarchy, top-tab duplication, static synthetic state, information architecture and visual language have zero scoring weight and no inheritance path. The proposed architecture remains unchanged if that demo is removed from history.

## Initial red-team rejection and closed repairs

| Initial blocking finding | Closed by |
| --- | --- |
| No explicit advising policy authority/prohibited claim classes | Reports 03, 07, 11, 17, 21 |
| Student passive; acknowledgement conflated with agreement/completion | Reports 05, 07, 10, 21 |
| Offline/withdrawal claims could be false | Reports 01, 05, 09, 10, 15–17, 22 |
| Today/review load and 90s/5m targets conflicted | Reports 04, 09, 18, 22 |
| Visual direction lacked exact anatomy/tokens/prototype gate | Report 06 and MegaRun 007 |
| Media, cognitive, internationalization and AT states incomplete | Reports 06, 14, 15, 22 |
| Roadmap compressed incompatible trust/UI/student/staging work | Report 20 five-run sequence |
| ERD, API/RPC and cutover insufficiently concrete | Reports 07, 13, 21 |
| Leases/outbox/idempotency/atomicity/restore underspecified | Reports 07, 13, 16, 17, 21, 22 |
| Identity auto-link and AI/publication evaluation thresholds vague | Reports 11, 12, 22 |
| Consent, principals, RLS, headers, storage and audit gaps | Reports 13, 16, 20, 22 |

## Dissent preserved as implementation conditions

The product and engineering boards approve the repaired architecture for local implementation, not its future runtime. Reliability remains the lowest post-repair architecture score at 9.1 because distributed behavior must be earned through fault injection and restore. Student workflow remains contingent on unresolved institutional identity/escalation policy and observed student research. Accessibility remains contingent on multi-browser, VoiceOver/NVDA/TalkBack and cognitive/i18n evidence. Security remains contingent on 006-A and later staging introspection. These are explicit release gates, not reasons to weaken the architecture or inflate scores.

Final synthesized score: **9.2/10 architecture readiness**. Exit: `MMC_CAM_V2_ARCHITECTURE_READY_FOR_IMPLEMENTATION`; no production authorization is implied.
