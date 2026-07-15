# 18 Expert Board Red Team and Scoring

RESULT: `ARCHITECTURE_PASSES_AFTER_MANDATORY_REPAIR_AT_IMPLEMENTATION_GATE`

## Scoring law

Scores evaluate this architecture specification, not unimplemented production behavior. Anchors:

- **0–2:** absent or materially harmful;
- **3–5:** concepts/prototype with major unsafe or incoherent gaps;
- **6–7:** useful coherent direction, incomplete contracts/evidence;
- **8:** implementation-ready in many areas, one or more material ambiguities;
- **9:** coherent, measurable, threat-tested architecture with explicit ownership, recovery, and release gates;
- **10:** independently validated production behavior over representative use—not available in this architecture phase.

Any security/privacy, mentor/student workflow, accessibility/responsive, implementation-safety, UI, or UX score below 9 rejects the proposal. Partner Demo fidelity carries **0%** weight.

## Initial rejection and repair audit

The final independent red team did **not** approve the first synthesized draft. Its initial verdict was `CONDITIONAL REJECT`: implementation safety was 8.2 and reliability was 8.0, while product reviewers held the proposal below 9 because policy authority, student co-authorship, offline truth, review load, exact responsive anatomy, media/cognitive/i18n accessibility, cutover, and failure semantics were incomplete. No score was raised merely by editorial vote.

The board required and then re-read repairs across reports 03–17 and 20–22. The repaired authority now includes: a versioned advising-policy registry and prohibited claim classes; student-authored goals/preferences/reflections/recourse and authorship-distinct states; `no-store`/no-durable-offline truth; three-plus-four Today budgeting and complexity-banded review timing; exact route anatomy, tokens, responsive transforms, media and cognitive accessibility; five realistic implementation runs; logical ERD/API/worker contracts; one-transaction canonical writes; single-writer cutover; generation-fenced leases; outbox consumer inbox; server-derived idempotency identity/payload hash/current-authority replay; distinct mentor/student/worker principals; consent sequencing; tamper-evident audit/restore; evidence attribution/contradiction/lineage; and quantitative concurrency, identity, publication, withdrawal, and recovery gates. The scores below are the board's **post-repair architecture scores**, not production evidence.

## Fifteen-reviewer board

| Reviewer | Current | Proposed | Attempted rejection / top risk | Mandatory repair incorporated |
| --- | ---: | ---: | --- | --- |
| Product strategist | 4.6 | 9.3 | Feature inventory could remain a dashboard instead of an operating system | Four-job IA, one-minute brief, policy/outcome/countermetric contract. |
| Senior mentor/advisor | 6.0 | 9.3 | Review burden could replace mentoring time | Presence-first session, ≤2m prep, complexity-banded review, starvation/alert budgets, manual fallback. |
| IMG education specialist | 3.4 | 9.2 | Scores and wording could shame or mislead culturally diverse learners | Decomposed signals, plain language, differential fairness, student research, correction/agency. |
| Residency workflow expert | 4.0 | 9.2 | “Readiness” could imply match prediction or misuse official terminology | Objective milestone rubrics, versioned advising policies, prohibited claim classes, non-causal/no-guarantee law. |
| UX director | 4.0 | 9.3 | Too many screens and global student selectors | Today/Students/Work/Reviews, route identity, contextual tabs/inspector, exact state anatomy. |
| UI design director | 5.4 | 9.2 | CAM could become either generic dark cards or distracting game chrome | Exact tokens/anatomy, dominant vessel, continuity signature, accent budget, calm causal motion, prototype gate. |
| Accessibility specialist | 2.4 | 9.2 | Current controls/mobile cannot support core workflows | WCAG 2.2 AA contracts, six viewport/zoom gates, media/cognitive/i18n/RTL and AT matrix. |
| Privacy/security engineer | 5.4 | 9.3 | File/credential/identity/publication boundaries can leak sensitive data | Consent sequence, distinct principals, exact origins, opaque assets, attested identity, separate projection, kill switches. |
| Data architect | 4.5 | 9.2 | Full-state sync and one status create drift/duplicates | Kind-constrained objects, orthogonal states, exact commands/versions/idempotency, atomic audit/lineage/outbox. |
| AI safety/evaluation specialist | 3.0 | 9.3 | Unreviewed AI and unverifiable quotes become fact | Proposal-only writes, speaker/support/contradiction spans, edit recheck, item review, lineage/rollback/evaluation. |
| Reliability engineer | 3.4 | 9.1 | Synchronous multi-write pipeline cannot recover safely | One-transaction canonical commit, generation-fenced leases, outbox/inbox, crash/concurrency/restore thresholds. |
| Frontend architect | 4.3 | 9.2 | Global state/cloned UI may survive behind new CSS | Real routes, one subject authority, modular projections, state boundaries, no sensitive durable offline cache. |
| Backend architect | 4.4 | 9.2 | Shared server could become an unbounded monolith | Thin HQ gateway, bounded modules, separate least-privilege worker, exact RPC/contracts and single-writer cutover. |
| Student advocate | 1.8 | 9.2 | Student remains passive or sees hidden judgment | Separate mobile-first product, co-authored goals/statements, decline/alternative/escalation, correction, publication isolation. |
| Operational administrator | 2.8 | 9.2 | Queues lack owners/SLO/reconciliation and expose sensitive internals | Role-gated cockpit, stage ownership, safe aggregates, policy registry, runbooks/escalation. |

No reviewer granted unconditional implementation or production approval. Proposed scores assume every mandatory gate in reports 14, 16, 17, 22, and 23 remains release blocking.

## Board disagreements and resolutions

1. **CAM spectacle versus calm advising.** UI direction favored strong family identity; mentor/accessibility reviewers rejected attention-speed effects. Resolution: deep-ink stable chrome, crafted geometry, ember action, human-gold/machine-cyan semantics, and a dominant vessel survive; XP, confetti, game voice, decorative particles, tiny microtype, and endless glow do not.
2. **Reviews versus Operations.** Product reviewers wanted one inbox; security/operations wanted role separation. Resolution: Reviews contains human decisions relevant to mentor work; Operations owns source policy, jobs, retries, prompts, and diagnostics behind a separate capability.
3. **Attention score versus no ranking.** Operations wanted deterministic ordering; Osler/student advocate rejected a student score. Resolution: queue ordering uses visible, correctable condition precedence and due time. No holistic person score is persisted or shown.
4. **Student transparency versus mentor privacy.** Student advocate requested provenance; privacy reviewers rejected internal confidence/notes. Resolution: students receive publisher, date, source category, corrections, and agreed rationale appropriate to the published item—not private evidence, identity, risk, or model internals.
5. **Offline continuity versus sensitive local storage.** UX wanted recovery; security rejected implied local persistence. Resolution: the initial release uses `no-store`, no Service Worker, and no durable protected browser cache. Unsent memory-only content is labeled `NOT SAVED`; encrypted persistence is a future ADR and cannot be implied.
6. **Event sourcing versus incremental safety.** Reliability favored complete replay; implementability rejected a rewrite. Resolution: versioned canonical records plus immutable review/audit/outbox and rebuildable projections; full event sourcing remains unnecessary.
7. **Partner Demo preservation versus product authority.** Historical preservation is useful; Brian rejects its design. Resolution: file preserved, design rejected, feature concepts independently validated, zero scoring weight.

## Architecture repairs produced by red teaming

- Split gateway/data/worker planes and make provider work asynchronous.
- Require route-local bounded payload handling and exact credential origins.
- Make fixtures structurally unable to enter authoritative modes.
- Replace AI persistence with proposal/evidence/review/promotion.
- Replace browser identity evidence with attested envelopes and reversible decisions.
- Separate Assignment from identity and recheck it during jobs/publication.
- Replace visibility boolean with versioned publication objects and student-principal readback.
- Replace risk/readiness/trust composites with evidence-backed dimensions and unknown states.
- Add conflict, atomic-outcome/readback, truthful offline, stale, revocation, dead-letter, correction, and withdrawal architecture.
- Make accessibility, phone/tablet reflow, keyboard/focus, and state announcements test contracts.
- Add policy registry, co-author/recourse objects, SLOs, audit completeness, countermetrics, kill switches, and explicit future authority gates.
- Add one-transaction canonical mutations, generation fencing, consumer inbox, single-writer cutover, exact APIs, logical ERD, evidence lineage, and quantitative crash/concurrency/restore gates.
- Reject Partner Demo hierarchy/visuals and derive MMC’s CAM signature from stronger MissionMed authority.

## Measurable acceptance-score rubric

| Category | 9.0 gate |
| --- | --- |
| UI | CAM family and MMC signature visible; dominant decision in 5s; no Partner inheritance; contrast/visual states pass. |
| UX | Representative users meet triage/prep/review/student comprehension targets; correction/recovery complete. |
| Security/privacy | Zero isolation/private/unreviewed/wrong-identity cases; exact origin/file/consent/publication controls and rollback proven. |
| Accessibility/responsive | Zero unwaived WCAG A/AA; keyboard/AT core loops; no overflow at six viewports/200%; all states usable. |
| Mentor workflow | Correct who/why/next ≤60s; one pinned session; exact per-item review/readback; provider-independent fallback. |
| Student workflow | Next action understood ≤30s; acknowledge/clarify/block/dispute/correct; exact deny-by-default projection. |
| Implementation safety | Version/idempotency/fault/concurrency/stress suites pass; protected/shared regressions green; rollback proven. |
| Truth/evidence | 100% eligible exact-span evidence; no blanket verified/unknown defaults; correction/supersession/audit complete. |
| Operations | Queue owner/age/SLO/retry/reconcile/kill switches and incident exercises proven without sensitive telemetry. |

## Final board scores

| Gate category | Score |
| --- | ---: |
| Proposed UI architecture | 9.2 |
| Proposed UX architecture | 9.3 |
| Security/privacy architecture | 9.3 |
| Accessibility/responsive architecture | 9.2 |
| Mentor workflow architecture | 9.3 |
| Student workflow architecture | 9.2 |
| Implementation-safety architecture | 9.2 |
| Reliability architecture | 9.1 |
| Trust/evidence architecture | 9.3 |
| Overall architecture | 9.2 |

## Verdict

`PASS AFTER MANDATORY REPAIR FOR LOCAL IMPLEMENTATION · NOT PRODUCTION AUTHORIZATION`.

The board would reject any implementation that treats these target scores as earned without the observed evidence, weakens a mandatory gate, restores Partner Demo inheritance, or enables live AI/Webex/student publication before the explicit authority sequence.
