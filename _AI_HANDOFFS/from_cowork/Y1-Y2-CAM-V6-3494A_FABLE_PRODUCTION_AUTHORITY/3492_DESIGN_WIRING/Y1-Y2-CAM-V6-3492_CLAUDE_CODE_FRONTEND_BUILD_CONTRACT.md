# Y1-Y2-CAM-V6-3492 — CLAUDE CODE FRONTEND BUILD CONTRACT

Translate `Y1-Y2-CAM-V6-3492_IVPREP_FINAL_NORTHSTAR.html` into production components. The prototype is **normative** for geometry, tokens, copy, and motion — do not infer from screenshots; read the reference implementation. Supersedes the 3490 contract's component layer; the 3490 interface contracts (instrument API, frame shape, adapter seam, arbitration, composite law, string-lint) carry over verbatim.

## 1. Component inventory (names are binding)

**Chrome:** `AppShell` (SHELL-A rail: brand, NewSessionButton, NavGroup/NavItem angular-select, RoleSwitcher, MatrixReturn) · `TopBar` (crumb + law chips) · `ScreenRouter` (280ms fade+rise transitions; lazy mount; per-screen instance registry; only active screen ticks).
**Instruments:** `PaceArc` (SPD-C) · `VolumePressure` (VOL-E hybrid: column, target window, peak cap, TraceMemory, HoldCharge) · `PitchRegisters` (PIT-A) · `AdaptiveRail` (HUD-C; plates + arbitration; consumes shell arbiter, never self-decides) · `SilhouetteFit` (CAM-C; zone set per mode INTERVIEW/TRAINING/BASELINE) · `GestureField` (pending Founder pick: implement selected of GF-B/C/D; all three exist in prototype) · `TerritoryTopology` (HT-B; toggles hands × view) · `GestureRegistry` (REG-A; live=toast only, post=counts, mentor=+confidence/moments) · `WarmthCompetenceField`.
**Composites:** `PerformanceMixer` (CON-B chassis; props: id, title, coreSlots[5], mode CORE|TRAIN; RadialLoadout child; capMaster math from shared lib) reused for `CompetenceCueProfile`, `WarmthCueProfile`, `AuthorityCueLens` (Mentor/LAB only), `CharismaCueBalance` (canonical cores locked; headline number PERFORMANCE mode only).
**Rooms:** `TrainingStage` (ST-B refined: QuestionPlate, SessionPlate, StudentStage w/ KellyMini, instrument column, AdaptiveRail) · `SimulationStage` (ST-B minus HUD; KellyStage full) · `PostAnswerCard` (Worked/Fix + SAFeCards) · `FlightRecorder` (FR-C: TrackGroup, TrackRow(eye,solo), zoom, scrub, ChipSeek(−2s), CoverageLane; add drag-reorder in build — deferred from prototype) · `CompareRoom` (FILM-B: PairSelector, SyncPlayhead, PhaseLanes, DeltaRead, OpenRecorderButtons) · `MentorStudio` (pending pick) · `AdminInspector` (CapArithmetic + ThresholdTable[CALIBRATE]) · `FingerprintFlow` (4 steps + TerritoryTopology + RecoveryDrill CTA) · `DeviceCheck` (SilhouetteFit + MicCorridor + consent) · Home/NewSession/Progress/Vault/StoryForgeSeam screens per prototype.

## 2. States & data

Every instrument implements the 3472 interface: `mount/update(frame)/setDensity/setMode/destroy/getCorrection`. Frame shape unchanged (`t, phase, targetRef, density, mode, coverage, confidence, value{}, target{}, baseline`). All corrections rendered only by the shell `CorrectionArbiter` (setup pre-empt → severity×correctability → 4s dwell → 2s gap → 3s answer-start suppression → one plate ever). Lock states are earned: in-corridor dwell timers (VOL charge 100%, PACE 3s, CAM 2s) trigger `lockSnap` animation exactly once per acquisition.

## 3. Events

`session:advance` (home→check→stage→post→film), `scenario:set` (QA fixture), `correction:shown/resolved/locked`, `chip:seek {t, laneId}` (recorder + registry + post replay chips), `mixer:swap {slot, metric, mode:TRAIN}` (must be a no-op on CORE), `kelly:state`, `kelly:fallback {VOICE|UNAVAILABLE}`, `mark:add {type, t, author}` (mentor-only channel).

## 4. Responsive & accessibility

Desktop-first (min 1180px full experience); below that, PERFORMANCE-compact layouts; live interview never runs on phone (Companion scope per 3490). All text on dark ≥ 4.5:1 (ink2 on p0 passes); correction plates also encode state via icon/text, never color alone; toasts announced via `aria-live=polite`; recorder tracks keyboard-navigable (eye/solo focusable, chips are buttons); `prefers-reduced-motion` collapses snaps/slides to opacity changes; skew transforms applied to decorative wrappers, not text nodes read by AT (use inner counter-skew spans as in prototype).

## 5. Fallbacks & fail-closed

Every instrument renders OK / LOW (desaturate 40%, suppress correction) / UNAVAILABLE (hatched chip; leaves composite denominators). Kelly fallback ladder is first-class UI (VOICE-ONLY waveform, AVATAR UNAVAILABLE card with continue actions); Delivery Intelligence continues through avatar failure. Fonts: Google Fonts with system-italic fallback stack; no layout dependency on font metrics.

## 6. Reuse

Reuse from prototype verbatim: token sheet, `capMaster`, scenario generator (S-deck) as the QA fixture and Storybook driver, housing/plate/chip CSS classes. The adapter seam (`attachSource`) is the only telemetry entry point — synthetic and live sources interchangeable (Wave 0 exit criterion unchanged: "all that remains is wiring real telemetry/provider/data").

## 7. Acceptance

3472 §12 scenarios S1–S6 verbatim + ticket scenarios (loud monotone, quiet→recovery, pace+phase, metronomic, hand-lost coverage, natural-vs-interview, warm/comp imbalance, congruence, vol-var recovery) drive the integrated screens, not isolated gauges. Two-foot test with numerics hidden. String-lint (3472 §13) green. One correction on screen in any live mode. Simulation shows zero HUD. Mentor lanes unreachable from student render tree (separate route + data scope, not CSS).
