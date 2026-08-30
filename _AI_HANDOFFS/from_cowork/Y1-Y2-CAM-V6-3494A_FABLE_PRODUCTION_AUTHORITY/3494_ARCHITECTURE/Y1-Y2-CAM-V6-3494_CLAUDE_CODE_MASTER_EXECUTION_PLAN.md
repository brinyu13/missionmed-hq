# Y1-Y2-CAM-V6-3494 — CLAUDE CODE MASTER EXECUTION PLAN

## 0. EXECUTION LAW (prepended to EVERY ticket)

> THIS IS THE REAL IV PREP PRODUCT. DO NOT CREATE A NEW DEMO. DO NOT CREATE A NEW SANDBOX. DO NOT CREATE A PARALLEL APP. MODIFY THE EXISTING CANONICAL IV PREP SURFACE. No provider spend by automation — LemonSlice `start()` is human-only (Avatar spec §5). No synthetic telemetry in student mode. Unbacked UI renders COMING SOON / UNAVAILABLE / PROVIDER OFFLINE. Every slice: 1–3 files where practical, feature-flagged, reversible, string-lint green.

**Shared conventions for all tickets below:**
- FILE PATHS: written as ⟨patterns⟩ until CC-00 emits `REPO_BINDING_MAP.md`; after CC-00, tickets are executed against bound real paths only.
- DO NOT TOUCH (default for every ticket unless the ticket says otherwise): auth, billing/entitlements, StoryForge production code, provider session creation, unrelated cartridges, deployment config.
- EVIDENCE (every ticket): before/after screenshots of the touched surface, console-error-free session video or log, diff summary, acceptance rows exercised.
- ROLLBACK (every ticket): single revert commit + feature flag off; flags default OFF until acceptance passes.
- HANDOFF (every ticket): `CC-XX_HANDOFF.md` — what changed, flags, test results, next-slice preconditions.
- SPEC AUTHORITY: 3494 spec pack + 3492 design system/wiring/avatar contracts + 3493 NorthStar (`Y1-Y2-CAM-V6-3493_IVPREP_COMPLETE_NORTHSTAR.html`) as the normative UI reference — lift markup/tokens/copy, do not reinterpret.

---

### CC-00 — REPO RECONNAISSANCE + BINDING MAP  *(mandatory first; read-only)*
OBJECTIVE: bind this plan to the actual repository. WHY: the plan was authored without repo access; blast-radius control depends on real paths.
READ: entire IV Prep app tree, router, state management, existing camera/audio/overlay code (prior Face/Body toggle engineering), Matrix auth integration, hosting config, MISSIONMED_IV_PREP_ON_CALL_FULL_ORCHESTRATOR_MIGRATION_PROMPT.md, 3483 CURRENT_STATE.
MODIFY: none. NEW: `REPO_BINDING_MAP.md` (pattern→path for every ticket; existing components reusable per slice; dependency corrections to slice order; list of already-implemented capabilities e.g. overlay toggles), `CC-00_HANDOFF.md`.
ACCEPTANCE: every CC-ticket below has bound paths + reuse notes; corrected slice order approved by Founder note. NEXT: CC-01.

### CC-01 — PRODUCTION SHELL + ROUTING/STATE HOST
OBJECTIVE: SHELL-A (3492) as the canonical IV Prep route shell: rail nav, role switcher (Matrix roles), law chips, screen router with 280ms transitions, per-screen mount registry.
READ: binding map; existing route/layout. MODIFY: ⟨app shell/layout⟩, ⟨router⟩. NEW: ⟨PerformanceShell component⟩.
INPUT: Matrix auth session (role claim). OUTPUT: routed screens; role-gated nav items. UI STATES: student/mentor/admin/founder nav variants. ERROR: unauthenticated → Matrix. FLAGS: none (shell always on).
TESTS: unit route table; browser click-crawl (D9 zero dead ends — unbacked targets show COMING SOON plates); human: Founder opens real app, sees shell. ACCEPTANCE: D9 partial; F3 nav gating. NEXT: CC-02.

### CC-02 — SESSIONCONFIGURATION + QUICK WIZARD
OBJECTIVE: canonical SessionConfiguration store + 5-step mobile-first wizard (Session spec §1–2).
READ: binding map, Session spec, 3493 wizard/newsession markup. MODIFY: ⟨session store⟩, ⟨new-session route⟩. NEW: ⟨SessionConfig model + validators⟩, ⟨WizardScreens⟩.
INPUT: user picks. OUTPUT: valid SessionConfiguration → SessionEngine.start stub. UI: 5 steps, ADVANCED↗ links. DATA: last-used defaults per mode. ERROR: invariant violations blocked at engine (sim⇒no HUD etc.). FLAGS: none.
TESTS: unit invariants; D1 phone test; D2 round-trip deep-equal. ACCEPTANCE: D1, D2. NEXT: CC-03.

### CC-03 — PRO LOADOUT (INTERVIEW BUILDER)
OBJECTIVE: full loadout editor over the same config object (presets grid, summary rows, EDIT links).
READ: 3493 builder/interviewer/platform screens. MODIFY: ⟨builder route⟩ (+ config store touch only). NEW: ⟨LoadoutScreen⟩.
CONTRACTS: reads/writes SessionConfiguration only. UI: preset select, row edit, START. ERROR: invalid combos surfaced inline. FLAGS: none.
TESTS: D2 both directions; browser: preset→wizard→loadout retention. ACCEPTANCE: D2. NEXT: CC-04.

### CC-04 — QUESTION LIBRARY ADAPTER
OBJECTIVE: real question data behind the 3493 library UI (search/filter/favorite/multi-select/saved sets) + metadata schema.
READ: existing question content source. MODIFY: ⟨library route⟩. NEW: ⟨QuestionRepo adapter⟩, ⟨SavedSetStore⟩.
INPUT: question DB/content files. OUTPUT: QuestionId[] into config; attempts/PB fields join AnswerRecords (stubbed until CC-16, shown as "—"). ERROR: empty search states. FLAGS: none.
TESTS: unit filters; browser loadout tray; human browse-pick-start. ACCEPTANCE: D3 precondition. NEXT: CC-05.

### CC-05 — MEDIA STAGE + STUDENT VIDEO (REAL CAMERA/MIC)
OBJECTIVE: getUserMedia stage in the production Training/Simulation routes: device pick, permissions, mirrored self-view, platform environment shells (3493 §6 skins), mic level from an audio worklet.
READ: existing media code per binding map. MODIFY: ⟨stage component⟩, ⟨device check route⟩. NEW: ⟨MediaStageService⟩ (streams + AudioBus start).
OUTPUT: AudioBus frames (rms/peak/clipping/speaking). UI: permission states, device errors, environment skins. ERROR: denied/no-device → honest blocks with retry. FLAGS: none.
TESTS: C1 responds; C9 fail-closed; browser permission mocks. ACCEPTANCE: C1, C9 partial. **MILESTONE 1 begins.** NEXT: CC-06.

### CC-06 — VISION PIPELINE + LANDMARKBUS
OBJECTIVE: worker-hosted landmark detection (face/pose/hands) → normalized LandmarkFrame bus (Vision spec §1–2). Reuse prior Face/Body engineering per CC-00 findings.
MODIFY: ⟨vision worker⟩/new. NEW: ⟨LandmarkBus⟩, ⟨detector worker⟩.
OUTPUT: LandmarkFrame @ target fps + diagnostics (fps, drops). ERROR: model load failure → hands/face modules UNAVAILABLE. FLAGS: none.
TESTS: B4 backpressure; unit coordinate normalization (incl. mirroring). ACCEPTANCE: B4. NEXT: CC-07.

### CC-07/08/09 — OVERLAY CARTRIDGES: FACE/HEAD · BODY/ARMS · HANDS/FINGERS  *(3 sibling tickets, 1–2 files each)*
OBJECTIVE: VisionOverlayEngine layers per Vision spec §3–4, with the 3493 control panel (OFF/MINIMAL/STANDARD/LAB + per-layer toggles), role defaults.
MODIFY: ⟨overlay engine⟩, ⟨overlay controls⟩. NEW per ticket: one layer-pack renderer.
CONTRACT: render-only LandmarkBus subscriber; OverlayDisplayStore isolated (lint rule added here). ERROR: none visible — missing landmarks simply don't draw. FLAGS: none.
TESTS: B1 independent toggles; B2 display≠measurement (with CC-10 telemetry); B3 portability. ACCEPTANCE: B1–B3. **MILESTONE 1 gate after CC-09 + CC-11.** NEXT: CC-10.

### CC-10 — DELIVERY INTELLIGENCE REGISTRY
OBJECTIVE: DIRegistry + MetricBus + module interface (Cartridge spec §1–2), CorrectionArbiter host, capMaster lib, string-lint CI hook.
NEW: ⟨di/registry⟩, ⟨di/types⟩, ⟨di/capMaster⟩, ⟨coach/arbiter⟩. MODIFY: none of the UI yet.
TESTS: F2 property tests; A4 static scan added to CI. ACCEPTANCE: A4, F2. NEXT: CC-11.

### CC-11 — VOICE MODULE ADAPTERS (VOLUME + VARIATION + PAUSES)
OBJECTIVE: first real cartridges: voice_volume, volume_variation, pauses from AudioBus; VOL-E renderer bound.
NEW: 3 module files + renderer registration. MODIFY: ⟨training route⟩ mounts via registry.
TESTS: C1 human; A2-style disable check; unit corridor/hysteresis. ACCEPTANCE: C1, C4. **MILESTONE 1 gate (with CC-05..09).** NEXT: CC-12.

### CC-12 — PACE MODULE + SPD-C
OBJECTIVE: speaking_pace (+pace_variation) from transcript timing/VAD, confidence-gated; SPD-C renderer with phase-arc.
NEW: modules + renderer reg. TESTS: C3; arbitration dwell (3472 S2 criteria vs live speech). ACCEPTANCE: C3. NEXT: CC-13.

### CC-13 — PITCH MODULE + PIT-A  *(flag: pitch_enabled)*
OBJECTIVE: pitch/pitch_variation modules over F0 (worklet or lib per CC-00); semitones vs personal median; PIT-A bound; honest UNAVAILABLE until flag on and confidence sufficient.
TESTS: C2 both branches (enabled + disabled); A2 exact test. ACCEPTANCE: A2, C2. NEXT: CC-14.

### CC-14 — GESTURE MODULES
OBJECTIVE: left_hand, right_hand, gesture_range (+gesture_synchrony basic) from LandmarkBus; Founder's GF pick as live renderer; gesture_events behind `gesture_semantics_enabled` (registry counts only, candidate labels).
TESTS: C5, C6; B2 re-run. ACCEPTANCE: C5, C6. NEXT: CC-15.

### CC-15 — HUD DYNAMIC REGISTRY
OBJECTIVE: HUD host consumes DIRegistry.enabled() ∩ config.hud.modules → compact chips + one arbitrated expansion (3493 hudFull behavior); EDIT HUD (CORE/ADVANCED/CUSTOM) persisted per user; display-only law.
MODIFY: ⟨training route⟩, ⟨hud host⟩. TESTS: A1 renderer swap harness; add/enable vocal_landing stub without HUD code change (architecture proof); C10 sim-guard. ACCEPTANCE: A1, A3, C10. **MILESTONE 2 gate.** NEXT: CC-16.

### CC-16 — RECORDING / ANSWERRECORD
OBJECTIVE: RecorderService + EvidenceRecorder + atomic AnswerRecord commit (Recording spec §1–3); consent flow; post-answer SAVE.
NEW: ⟨recorder service⟩, ⟨answer record model/store⟩. MODIFY: ⟨post route⟩.
TESTS: D4; skew budget unit; privacy scan (no raw frames/meshes persisted). ACCEPTANCE: D4. NEXT: CC-17.

### CC-17 — ANSWER LIBRARY
OBJECTIVE: MY ANSWERS views (ALL/SESSIONS/QUESTIONS/PB/MENTOR/SAVED/FAV) + detail + question-centric history + practice-again (config clone) + MatchBridge consent seam (state+audit only, `matchbridge_sharing_enabled` default off).
TESTS: D6; I-seam audit unit tests; F3 scope. ACCEPTANCE: D6 + sharing seam rows. NEXT: CC-18.

### CC-18 — FILM ROOM (REAL EVIDENCE)
OBJECTIVE: FR-C recorder over EvidenceBundle: lanes from persisted samples, chips seek video, coverage hatching from coverage map, overlay replay from landmark evidence, exports.
TESTS: D5 spot-check protocol; B3 replay branch. ACCEPTANCE: D5. **MILESTONE 4 gate (with CC-16/17).** NEXT: CC-19.

### CC-19 — ADMIN/MENTOR REVIEW
OBJECTIVE: async review flow (queue, player, transcript, DI, marks, notes, status, notify) on AnswerRecord review scope; mentor-private separation server-side.
TESTS: D7 incl. API-level student-scope check. ACCEPTANCE: D7, F3. NEXT: CC-20.

### CC-20 — STORYFORGE SEAM
OBJECTIVE: contract per 3494 architecture §seams: prep hydration (candidates in wizard STEP 2 / prep screen), USE/REMIND actions, usage-relationship writes, performance-history payload; `storyforge_hydration_enabled`.
TESTS: contract mocks; post-answer suggestion flow; two-way record query. ACCEPTANCE: matrix rows 10–11 (3493). **MILESTONE 6 with CC-19.** NEXT: CC-21.

### CC-21 — AVATARPROVIDER ABSTRACTION  *(parallel-safe from CC-10)*
OBJECTIVE: ProviderBus + canonical state machine + MockAvatarProvider + stage mount reactions (Avatar spec §2–3); voice_only/pregenerated/text tiers live NOW behind the same interface.
TESTS: state-machine unit; E1 automation guard (mock); fallback ladder in-session. ACCEPTANCE: E1, E3 (mock). NEXT: CC-22.

### CC-22 — LEMONSLICE REAL STAGE INTEGRATION  *(no session creation in this slice)*
OBJECTIVE: LemonSlice adapter behind AvatarProvider (LiveKit room join, track subscribe → production stage mount, cleanup routine); everything testable against mock signaling; real `start()` remains human-gated and UNEXERCISED by CI.
TESTS: track-mount crossfade with fake track; cleanup idempotency; E1 re-run against real adapter (must reject). ACCEPTANCE: E1; E5 readiness. NEXT: CC-23.

### CC-23 — FOUNDER HUMAN-ONLY PROVIDER QA
OBJECTIVE: PROVIDER QA panel in the real Admin surface (3493 panel wired to ProviderBus + diagnostics): READY/START(human)/timer/STOP/cleanup/TEST AGAIN, transition log to SYSTEM lane, `avatar_enabled` + FOUNDER role + UserActivation triple-gate.
HUMAN TESTS: Founder executes E2 loop ×5 (this is where the only paid sessions ever occur, human-pressed). ACCEPTANCE: E2, E4, E5. **MILESTONE 5 gate.** NEXT: CC-24.

### CC-24 — PRODUCTION INTEGRATION / REGRESSION
OBJECTIVE: full acceptance matrix sweep (A–F), scenario deck locked behind Founder debug, diagnostics panel completing F5, click-crawl D9, performance pass (overlay ≤2ms, HUD tick budget), release notes.
ACCEPTANCE: entire matrix green or explicitly waived by Founder per row. HANDOFF: `CC-24_RELEASE_CANDIDATE.md` + updated CURRENT_STATE.

---

## SEQUENCING SUMMARY

`CC-00 → 01 → 02 → 03/04 (parallel) → 05 → 06 → 07/08/09 → 10 → 11 → [M1] → 12 → 13 → 14 → 15 → [M2] → 16 → 17 → 18 → [M3–M4] → 19 → 20 → [M6]`, with `21 → 22 → 23 → [M5]` running parallel from CC-10 onward. CC-00 may legitimately reorder — its binding map is authoritative.

Estimated slices to first real human-testable product (M1): **CC-00 … CC-11 = 12 slices.** Full plan: **25 slices** (CC-00–CC-24).
