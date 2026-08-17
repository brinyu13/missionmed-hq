# Y1-Y2-CAM-V6-3494A — CLAUDE CODE MASTER EXECUTION PLAN (CONSOLIDATED)

**THIS DOCUMENT SUPERSEDES the 3494 plan as the single implementation authority.** It contains the 3494 plan unchanged by reference (CC-00…CC-24, all laws, conventions, and boilerplate apply verbatim) plus the 3494A addendum tickets (CC-25…CC-36) and a revised sequencing that pulls the Question Engine into the MVP core loop. All 3494 execution laws apply to every ticket below (real product only; 1–3 files where practical; flags; string-lint; human-only provider spend; evidence/rollback/handoff per ticket).

## AMENDMENTS TO EXISTING 3494 TICKETS

- **CC-00 (recon)** — ADD: inspect Timeline Builder for reusable CV parser / contextual question engine and File Vault CV storage (bind `TIMELINEBUILDER_FILEVAULT_ADAPTER_SPEC` patterns); inventory any existing question-bank data structures.
- **CC-02 (wizard)** — STEP 2 gains the Question Drawer trigger + CORE collection surfaced first; STEP 3 lists interviewer packs (Kelly/Woods) with prerecorded-coverage note per Asset Plan §4.
- **CC-03 (loadout)** — hosts the Interview Set playlist (order/reorder/save/shuffle) fed by the drawer; presets list per Question Engine spec §5.
- **CC-04 (question library adapter)** — EXPANDED, now split into CC-25/26 below; CC-04 becomes the provider-registry substrate only (QuestionProviderRegistry + store + history join contract).
- **CC-17 (answer library)** — question-centric history explicitly binds drawer stats (attempts/last/PB/reviews) via the shared join; NEEDS WORK collection reads mastery tier.
- **CC-21/22/23 (avatar)** — unchanged; the hybrid engine (CC-31/32) consumes the same AvatarProvider for live segments.

## NEW TICKETS (3494A)

### CC-25 — QUESTION DATA IMPORT (CORE + MR142 + BEHAVIORAL)
OBJECTIVE: parse `_MVP_QUESTION_IMPORT_MANIFEST.md` → seed store: 10 CORE (pinned) + 142 MR142 + 41 BEH (+1 collection record), verbatim text, provenance, seed tags, links table empty.
READ: manifest, taxonomy map. NEW: import script + seed data + CI exclusion test (fails if any "Questions to Ask…" content appears in corpus). MODIFY: question store.
ACCEPTANCE: counts exact (10/142/41); CORE surfaces first; [sic] preserved; exclusion test green. TESTS: unit parse; count assertions. NEXT: CC-26.

### CC-26 — QUESTION DRAWER
OBJECTIVE: slide-out drawer per Question Engine spec §3 (search/filters/collections/sort/stats, drag+ADD+, context-preserving overlay) mounted in wizard STEP 2 and Pro Loadout.
MODIFY: wizard, loadout (mount points). NEW: Drawer component + drawer store.
ACCEPTANCE: drawer opens without losing setup state; search <50ms on 200 questions; drag (desktop) + ADD (mobile) both populate the set; CORE/BEHAVIORAL/NEVER-PRACTICED/NEEDS-WORK collections correct. NEXT: CC-27.

### CC-27 — INTERVIEW SET LOADOUT (PLAYLIST)
OBJECTIVE: ordered set UI per spec §4 (reorder/remove/duplicate/replace/shuffle/save/name) writing SessionConfiguration.questions.
ACCEPTANCE: saved loadout round-trips; shuffle respects opener/closer pins; asset-status column reflects selected interviewer. NEXT: CC-28.

### CC-28 — CORE TEN + BEHAVIORAL COLLECTIONS + PRESETS
OBJECTIVE: pinned CORE experience (one-tap "CORE 10" preset), BEHAVIORAL collection, preset grid populating SessionConfiguration only (no parallel engine).
ACCEPTANCE: "Tell me about yourself" reachable in ≤2 taps from Home; all presets produce valid configs. NEXT: CC-29 ∥ CC-31.

### CC-29 — CV SOURCE ADAPTER (TIMELINE BUILDER + FILE VAULT + UPLOAD)
OBJECTIVE: CVSourceAdapter priority chain + source picker UI per adapter spec; REUSE-FIRST: bind to Timeline Builder parser if CC-00 found one.
FLAGS: `cv_questions_enabled`. ACCEPTANCE: three source paths resolve to one NormalizedCV; no TB internals imported (boundary lint); student never re-uploads when TB/Vault has a CV. NEXT: CC-30.

### CC-30 — CV QUESTION GENERATOR + REVIEW
OBJECTIVE: CVQuestionGenerator (worthiness heuristics) + candidate records (FACT/QUESTION/WHY triplet) + review flow (ADD/REJECT/FAVORITE/EDIT/bulk-high-priority) + mentor-builds-for-student path.
ACCEPTANCE: candidates never auto-enter interviews; provenance rendered on every candidate; accepted → CVQ- Question records usable in drawer; CV text absent from logs. NEXT: joins main line.

### CC-31 — INTERVIEWER ASSET PACK REGISTRY + PRERECORDED PLAYBACK ENGINE
OBJECTIVE: InterviewerPackRegistry + pack manifests (Kelly, Woods stubs) + ask-video playback on the production stage + preload strategy + per-pack degrade ladder.
FLAGS: `hybrid_interviewer_enabled`. ACCEPTANCE: CORE question with asset plays interviewer video → transitions to listening; missing asset degrades honestly (voice-only/text) without session break. NEXT: CC-32.

### CC-32 — LISTENING STATE ENGINE + HYBRID FOLLOW-UP ROUTER
OBJECTIVE: listening loops between ask and answer-end; FollowUpRouter (config.followups × transcript signals × behavior profile) with SYSTEM-lane decision logging; live-follow-up handoff stub to AvatarProvider/voice (real live segment behind existing human-gate laws).
ACCEPTANCE: structured session runs end-to-end with zero live-provider consumption; router decisions logged + visible in Film Room; follow-up path invokes live stack only when warranted. NEXT: CC-33.

### CC-33 — LIVE CONVERSATIONAL STRATEGY
OBJECTIVE: LiveConversationalStrategy as a distinct InterviewExecutionStrategy (no fixed list; behavior-profile-driven probing) behind progression unlock + credits check; voice-first, avatar per tier.
FLAGS: `conversational_mode_enabled`. ACCEPTANCE: strategy selectable only when unlocked; consumes credits ledger; all session-engine/telemetry/recording behavior identical to other strategies. NEXT: CC-34.

### CC-34 — DR KELLY + DR WOODS ASSET PACKS (WAVE 1 CONTENT)
OBJECTIVE: ingest Wave-1 recordings per Asset Plan (30 clips), asset QA checklist, `Question.assets` status wiring, coverage note in wizard STEP 3.
DEPENDS: recordings supplied by MissionMed (content task, not code). ACCEPTANCE: CORE 10 fully prerecorded ×2 interviewers; 🎬 badges correct; stage crop QA passed on real mount. NEXT: —.

### CC-35 — PROGRESSION ENGINE + XP/RANK/BADGES
OBJECTIVE: ProgressionEngine (event inputs → XP/level/rank/badges/missions) with config-file thresholds, anti-grind rules, per-question mastery tiers, badge plates in Performance Engine style; Progress screen binds real data.
ACCEPTANCE: anti-grind property tests (100 flat reps plateau); mastery requires structure+delivery+review criteria; all thresholds config-loaded, none hardcoded. NEXT: CC-36.

### CC-36 — UNLOCK RULES + CREDITS LEDGER SEPARATION
OBJECTIVE: unlock eligibility service (conversational gate), XP vs LIVE-INTERVIEW-CREDITS as separate audited ledgers, admin grant/override with audit, wizard/tier surfaces show lock state honestly.
ACCEPTANCE: no code path converts XP→credits; locked mode renders EARN-path explanation (never a dead button); admin override audited. NEXT: CC-24 regression re-run.

## REVISED SEQUENCING (single authority)

```
CC-00(+A) → 01 → 02 → 25 → 26 → 27 → 28 → 03 → 05 → 06 → 07/08/09 → 10 → 11 → [M1]
→ 12 → 13 → 14 → 15 → [M2] → 16 → 17(+history) → 18 → [M3–M4 = TODAY'S FUNCTIONAL BETA GATE]
→ 19 → 20 → [M6]
Parallel from CC-10:  21 → 22 → 23 → [M5]
Parallel from CC-28:  31 → 32 → 34   (hybrid interviewer; 33 after 35/36)
Parallel from CC-17:  29 → 30        (CV intelligence)
Parallel from CC-17:  35 → 36 → 33   (progression → conversational unlock)
```

**TODAY'S FUNCTIONAL BETA (Founder MVP definition, binding):** CC-00…28 + 05…18 + 23(QA path) = Core questions, full corpus, search/filter, set builder, practice one question, real camera/mic/recording, real available DI, wireframes, AnswerRecord save/replay, question-centric history, async mentor replay, basic Film Room, Dr Kelly human-only QA path. CV intelligence (29/30) follows immediately; hybrid interviewer (31/32/34) populates incrementally; conversational (33) ships gated.

**Slice count: 37 total (CC-00…CC-36). To Founder MVP: 24 slices. Provider sessions created by automation: 0, forever.**
