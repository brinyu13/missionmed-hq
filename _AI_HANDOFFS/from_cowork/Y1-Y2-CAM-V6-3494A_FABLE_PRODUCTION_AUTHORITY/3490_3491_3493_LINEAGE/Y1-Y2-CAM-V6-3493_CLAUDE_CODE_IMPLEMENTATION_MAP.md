# Y1-Y2-CAM-V6-3493 — CLAUDE CODE IMPLEMENTATION MAP

Bounded slices; each independently shippable and testable. Normative reference: `Y1-Y2-CAM-V6-3493_IVPREP_COMPLETE_NORTHSTAR.html` (lift components, tokens, copy, and interaction verbatim). Do NOT attempt the whole application in one pass. The 3492 build/wiring/avatar contracts remain binding beneath this map.

**Founder priority ordering (per §25): F (real telemetry) is the highest-value slice and may run in parallel with A from day one. Visual iteration on gauges is explicitly deferred.**

## Slice A — Question Library + Session Builder
Scope: `QuestionLibrary` (search/filter chips/favorite/multi-select/loadout tray/saved sets), `InterviewBuilder` (preset grid + loadout summary + START), question metadata schema, saved-set store, BUILD session-config contract handed to the session engine.
Reuse: `card/scen/lawchip` components, loadout tray pattern, `BUILD` state object, QUESTIONS schema from prototype.
Done when: student picks 1 or N questions (or a preset), saves a set, starts a session with that config.

## Slice B — Interviewer Builder + Presets
Scope: `InterviewerBuilder` (presentation/age/role, ≤3 style chips, 6 behavior sliders, preview panel, "SIMULATED INTERVIEW STYLE" language enforced), preset→behavior mapping, config → interviewer-cognition prompt/policy contract (embodiment-independent per §22), RISE hydration seam (typed contract, no claims).
Reuse: chip/slider markup, kellyStage preview, BUILD.interviewer.
Done when: behavior params demonstrably alter the realtime interviewer policy in a test harness (text tier is sufficient).

## Slice C — Answer Video Library + Admin Review
Scope: canonical `AnswerRecord` (question, video ref, date, session, attempt, type, preset, interviewer, duration, SAF(e) notes, DI summary, mentor status, story links, PB, marks, sharing) + view indexes (ALL/SESSIONS/QUESTIONS/PB/MENTOR/SAVED/FAV); `MyAnswers` screens incl. question-centric history; `MentorReview` async flow (student select, unreviewed queue, video+transcript+DI, marks PERFECT/REMEMBER/NEEDS WORK/REVIEWED, notes, attribution, notify).
Reuse: `answerCard`, detail panel, review pane from prototype; StoryForge review precedent for status/metadata patterns.
Done when: one recording is addressable through every view with no duplication, and a mentor completes an async review end-to-end.

## Slice D — StoryForge Integration
Scope: prep hydration (question → story candidates → USE/REMIND/ignore), post-answer suggestions (alternatives never auto-ranked), usage-relationship records (story → used-in, attempts, best delivery), Film Room evidence links, StoryForge "Interview Performance History" payload.
Reuse: storyforge screen + post-answer cards; STORIES schema.
Done when: using a story in an answer creates a queryable two-way record.

## Slice E — HUD + Overlay Controls
Scope: `hudFull` 14-metric adaptive rail + `EDIT HUD` (CORE/ADVANCED/CUSTOM, persisted per user), `ovlControls` + `overlayCanvas` (7 overlay items, OFF/MINIMAL/FULL), hard architectural separation display-config vs measurement (render-layer only; telemetry pipeline unaware of HUDCFG/OVLSET).
Reuse: components verbatim from prototype; arbitration engine from 3492.
Done when: hiding every overlay and every HUD plate provably changes zero telemetry records.

## Slice F — Delivery Intelligence Real Wiring  ★ FOUNDER PRIORITY
Scope: adapters per the 3492 wiring contract table: SPD-C ← real pace, VOL-E ← real dBFS/spread, PIT-A ← F0 stack (UNAVAILABLE until real), gesture/hand modules ← landmark streams, CAM-C ← framing telemetry, recorder lanes ← derived streams; fail-closed mapping in adapters; scenario generator remains the CI fixture.
Done when: a live mic+camera session drives the selected gauges with no synthetic data and coverage honesty intact. **Functional measurement > more art direction.**

## Slice G — Dr Kelly Human-Only QA
Scope: Admin `AVATAR TEST` panel wired to real session layer (READY → HUMAN START → join → ≤60s → STOP/timeout → cleanup → TEST AGAIN), status lights from real state, event log, fallback ladder verification. Hard gates: no automatic paid test, no headless test, no auto-retry — button handlers require human UI events; CI must not be able to trigger START.
Done when: Founder completes the loop ×5 with logs; natural initiation fixed (Codex scope).

## Slice H — Film Room Persistence
Scope: per-answer lane/event/mark/opportunity store; recorder loads any AnswerRecord; chip-seek contract; coverage gaps persisted as first-class data; exports (PNG/CSV) per 3472 §10.3.
Reuse: `recorderFinal` + `compareFinal` components.
Done when: any saved answer reopens with identical lanes, marks, and gaps.

## Slice I — MatchBridge Consent Seam
Scope: sharing state on AnswerRecord (PRIVATE ↔ MATCHBRIDGE-ELIGIBLE), explicit consent dialog (scope, revocation, audit trail), revoke path, audit log; no MatchBridge consumer built; PD-view payload contract typed (approved video, question, date, approved context).
Done when: consent state changes are audited, revocable, and nothing is shared automatically anywhere in the codebase.

**Sequencing:** F ∥ A → B → C → E → H → D → G → I. C blocks D and I (record schema). G is independent and Founder-scheduled. Every slice ships behind the string-lint and the scenario-deck acceptance run.
