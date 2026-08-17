# Y1-Y2-CAM-V6-3494 — PRODUCTION ARCHITECTURE
## IV Prep On-Call — the real product, hot-swappable by law

STATUS: `ARCHITECTURE FREEZE — READY FOR CLAUDE CODE EXECUTION`
Continuation of 3490/3491/3492/3493. Visuals frozen at 3492/3493. This document defines how the approved frontend becomes the ACTUAL IV Prep On-Call application — real camera, mic, telemetry, recording, Dr Kelly stage, authenticated Matrix access. No sandbox, no demo mule, no parallel app.

## 0. Source-authority honesty

Present in this design session: 3471C signal contract, 3472 grammar lock, 3490–3493 outputs (all produced here). NOT present: the orchestrator migration prompt, 3483 CURRENT_STATE.json, and the live repository. Consequence: every file path in the execution plan is a **pattern to be bound by ticket CC-00 (repo reconnaissance)** before any modification. Runtime truth carried forward unchanged: hosted shell WORKING · Dr Kelly PARTIAL · human QA NOT VERIFIED · production BLOCKED until acceptance passes.

## 1. System decomposition (ten engines, one application)

```
MATRIX AUTH (roles: STUDENT / MENTOR / ADMIN / FOUNDER)
└── IV PREP ON-CALL  (canonical hosted route — the only surface)
    ├── SESSION ENGINE            SessionConfiguration → session lifecycle → phase clock
    ├── INTERVIEWER ENGINE        behavior profile → question flow → follow-ups   (brain)
    ├── EMBODIMENT ENGINE         VoiceProvider + AvatarProvider + fallback ladder (face/voice)
    ├── MEDIA STAGE               getUserMedia · student video · platform environments
    ├── VISION PIPELINE           landmark detection → normalized LandmarkFrame bus
    ├── VISION OVERLAY ENGINE     render-only subscriber of the landmark bus
    ├── DELIVERY INTELLIGENCE     DIRegistry + metric cartridges (measure/interpret/visualize/coach)
    ├── RECORDING + EVIDENCE      MediaRecorder + evidence lanes → AnswerRecord
    ├── FILM ROOM / COMPARE       consumers of AnswerRecord evidence (never recompute video)
    ├── LIBRARIES                 QuestionLibrary · AnswerLibrary (one record, many views)
    ├── REVIEW                    Mentor/Admin async review (separate data scope)
    ├── PROGRESSION               baseline · personal best · missions · mastery
    └── SEAMS                     StoryForge (two-way) · MatchBridge (consent-only) · RISE (dormant)
```

## 2. The five buses (everything communicates through these; nothing reaches into internals)

1. **SessionBus** — lifecycle events: `session:configured/started/question/answer-start/answer-end/completed`, phase markers, correction events. Single monotonic `SessionClock` (3471C law).
2. **AudioBus** — `AudioFrame {t, rms, peak, clipping, speaking, f0?, f0Conf?}` at 10 Hz + transcript token events when ASR is on.
3. **LandmarkBus** — `LandmarkFrame` (normalized coordinate contract, see Vision spec) at detector rate. Consumers: overlay renderer, gesture/camera cartridges, evidence recorder. **Overlay visibility never gates this bus.**
4. **MetricBus** — cartridge outputs: `MetricSample {moduleId, t, value, norm, state, confidence, coverage}` + `MetricEvent {moduleId, t, type, payload, confidence}`. HUD, composites, recorder, and coach arbiter subscribe here.
5. **ProviderBus** — avatar/voice provider state transitions (Avatar spec §states). UI reacts to bus states only; no LemonSlice internals in components.

## 3. Cartridge law (console + cartridges)

The console = session engine, buses, HUD host, recorder, Film Room host, libraries, review, shells. Cartridges = every Delivery Intelligence metric and every visual instrument renderer. Contract in `_MODULE_CARTRIDGE_SPEC.md`. Hard rules: UI asks `DIRegistry` for modules (never hardcodes a metric list); replacing `SPEAKING_PACE` v1→v2 = register + flag flip; replacing renderer SPD-C→SPD-X touches one renderer registration; Film Room keys on `moduleId`, never on renderer identity; higher-order profiles (congruence, cue profiles, charisma) consume lower modules **through the registry** only; a missing/disabled cartridge yields honest `UNAVAILABLE` + reduced composite denominators, never breakage. Proofs: the two cartridge acceptance tests + wireframe test in `_PRODUCTION_ACCEPTANCE_MATRIX.md`.

## 4. Four-layer separation (mandatory per analytic)

MEASUREMENT (processor: e.g., audio worklet computes dBFS/F0) → INTERPRETATION (module derives norm/state/corridor vs target refs) → VISUALIZATION (registered renderers: live instrument, compact HUD chip, film track, post panel, mentor detail) → COACHING (the single shell **CorrectionArbiter**, 3472 §9.2 unchanged: setup pre-empts → severity×correctability → 4s dwell → 2s gap → one correction ever). Never fused in one file. Renderers cannot write to buses. Coach reads MetricBus + module `getCorrection()` candidates only.

## 5. Display ≠ measurement (law, enforced structurally)

Per module, four independent switches: `measure` (default ON for core telemetry) · `hud` · `film` · `post`. HUD/overlay config lives in a render-layer store the pipeline never imports. Hiding every overlay and every HUD chip changes zero telemetry records (acceptance-tested).

## 6. Honesty law (production UI)

No decorative controls on the canonical surface. Unbacked features render `COMING SOON` / `UNAVAILABLE` / `PROVIDER OFFLINE` plates from the 3492 design system. The scenario deck survives ONLY behind `role≥FOUNDER && debug_sim_enabled`, and any simulated feed brands the UI with a persistent `SIMULATED TELEMETRY` law chip; student sessions can never run synthetic readings (hard guard in the adapter layer, not the UI).

## 7. Auth / roles

STUDENT: own sessions, own library, no mentor lanes (separate API scope, not CSS). MENTOR: assigned students' records, private live rail, async review, training-mix customization (never canonical writes). ADMIN: cohort, thresholds `[CALIBRATE]`, diagnostics. FOUNDER: ADMIN + provider QA panel + debug sim. Role gates enforced server-side; frontend renders from the role claim.

## 8. Feature flags (fail clean, never infect neighbors)

`avatar_enabled` · `pitch_enabled` (F0 stack) · `cadence_enabled` · `gesture_semantics_enabled` · `storyforge_hydration_enabled` · `matchbridge_sharing_enabled` · `debug_sim_enabled` · per-cartridge `di.<moduleId>.version`. A disabled flag ⇒ module reports `UNAVAILABLE`; registry handles the rest (coverage denominators, hatched lanes).

## 9. Observability (Founder/Admin diagnostics — Codex-less troubleshooting)

Diagnostics panel (real product, role-gated): camera (device, resolution, fps), mic (device, level, worklet state), landmark detector (model, fps, dropped frames), DIRegistry (module list, version, status, last sample age), recording (state, bytes, duration), LiveKit (room state, track subs), OpenAI Realtime (session state, latency), LemonSlice (provider state machine state + last transition), cleanup ledger (orphan check). Structured logs on ProviderBus + SessionBus; no secrets ever rendered or logged.

## 10. Milestones (Founder opens the REAL app at each)

M1 real camera/mic + wireframes + basic telemetry (volume, framing, hands) → M2 real HUD (pace, volume, pitch-where-available, hands, head, frame) → M3 wizard + builder + question practice → M4 record + Answer Library + post + Film Room → M5 Dr Kelly human-only live session → M6 StoryForge + Mentor/Admin. Mapped to slices in the execution plan; no milestone waits for the ones after it.

## 11. Build order (bias honored, dependency-corrected)

Shell/config/wizard + media stage + vision pipeline + registry FIRST (CC-00…CC-10) → base telemetry + HUD + recording (CC-11…CC-16) → libraries, Film Room, review, StoryForge (CC-17…CC-20) → avatar abstraction ∥ LemonSlice stage ∥ human QA (CC-21…CC-23, parallel-safe) → integration/regression (CC-24). Each slice targets 1–3 files where practical; details in the master plan.

## 12. Stop conditions (unchanged)

No provider spend by any automation, ever. Human-only LemonSlice QA. No deploy past a failed acceptance row. Raw frames/audio/landmarks never persisted beyond the session buffer except the compact evidence contract in `_RECORDING_EVIDENCE_SPEC.md`.
