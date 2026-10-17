# Y1-Y2-CAM-V6-3494 — PRODUCTION ACCEPTANCE MATRIX

A slice/milestone ships only when its rows pass. "H" = human test (Founder or designee). No synthetic telemetry may pass a REAL row.

## A. Cartridge modularity (architecture proofs)

| # | Test | Procedure | Pass |
|---|---|---|---|
| A1 | Renderer hot-swap | Register dummy SPD-X renderer; flip renderer flag; run session; restore SPD-C | SPD-X appears/works; session engine, recording, HUD host, Film Room host, all other metrics show zero diff; restore clean |
| A2 | Module disable | Disable `pitch` flag | `PITCH — UNAVAILABLE` chip everywhere pitch surfaces; volume/pace/hands unaffected; Film Room pitch lane hatched; composites show reduced denominator, never zero |
| A3 | Module version swap | Register `speaking_pace@2` (stub), flip version flag | Film Room still keys `speaking_pace`; historical records unaffected; rollback = flag flip |
| A4 | No hardcoded metric lists | Static scan: HUD/Film/Lab/post enumerate DIRegistry only | zero metric-id literals in console components |

## B. Vision / wireframes

| # | Test | Procedure | Pass |
|---|---|---|---|
| B1 (H) | Independent layer toggles | Live camera; toggle FACE/BODY/ARMS/L-HAND/R-HAND/FINGERS one by one | each layer renders/hides independently; no other layer changes |
| B2 (H) | Display ≠ measurement | All overlays OFF; move hands, head, body | gesture/camera telemetry + evidence continue identically (diff evidence streams) |
| B3 | Coordinate portability | Same evidence rendered in live, mentor, Film Room, mobile geometries | landmarks land on the same body positions in all four |
| B4 | Backpressure honesty | Throttle detector | dropped-frame diagnostic increments; coverage → LOW; no queue growth, no silent gaps |

## C. Real telemetry (M1/M2 gates) — all H

| # | Human action | Expected |
|---|---|---|
| C1 | speak quietly → louder | VOL-E column + level lane respond directionally, ≤300ms |
| C2 | raise pitch | PIT-A responds if `pitch_enabled`; else honest UNAVAILABLE (never fake) |
| C3 | speed up speech | SPD-C needle rises; SLOW DOWN arbitrated per 3472 dwell rules |
| C4 | deliberate pause | pause event on lane; PAUSE zone neutral, not failure |
| C5 | move L hand / R hand | respective landmarks + lanes move; other hand unaffected |
| C6 | raise both hands | gesture zone/range responds |
| C7 | move head / shift torso | head/torso lanes respond |
| C8 | lean toward/away, shift off-center | camera_framing directives correct (MOVE BACK/CLOSER/SHIFT) |
| C9 | cover camera / mute mic | fail-closed states (NOT DETECTED), no crash, session survives |
| C10 | REAL vs SIM branding | student session cannot enable sim source (guard test); Founder debug shows persistent SIMULATED chip |

## D. Session & product flow (M3/M4)

| # | Test | Pass |
|---|---|---|
| D1 (H) | Wizard 5 steps on phone | one decision/screen; two-tap repeat session; ADVANCED ↗ preserves config both directions |
| D2 | One config model | wizard→loadout→wizard round-trip = deep-equal SessionConfiguration |
| D3 (H) | Quick Rep loop | question → record → instant read → again, under 30s to first recording |
| D4 (H) | Record → AnswerRecord | answer appears in Library (all applicable views) with metadata, DI summary, evidence |
| D5 (H) | Film Room replay | lanes = live values (spot-check 3 points); chips seek −2s; coverage gaps visible; wireframe replay from evidence |
| D6 (H) | Question-centric history | all attempts of one question listed; PB flagged; compare opens |
| D7 (H) | Async mentor review | mentor reviews without student present; marks/notes attributed; student notified; private lanes absent from student view (API-level check) |
| D8 | Simulation zero-HUD | hud.mode forced none; background telemetry + recording verified in evidence |
| D9 | Honest gating | every unbacked control renders COMING SOON/UNAVAILABLE/PROVIDER OFFLINE; zero dead decorative controls in main nav (click-crawl test) |

## E. Provider (M5) — all H, Founder-initiated

| # | Test | Pass |
|---|---|---|
| E1 | Automation guard | programmatic `start()` without UserActivation+FOUNDER role rejected (unit + integration) |
| E2 | Human loop ×5 | READY→START→Kelly joins (natural initiation)→converse→STOP/timeout→CLEANED (orphan check)→TEST AGAIN |
| E3 | Fallback mid-session | kill track → UNAVAILABLE card ≤1s → voice_only continues; telemetry/recording uninterrupted |
| E4 | No auto-retry | induced ERROR: system stays ERROR until human press; zero automatic provider recreation in logs |
| E5 | Real stage | QA session renders in the production stage mount (same geometry as student sessions) |

## F. Cross-cutting

| # | Test | Pass |
|---|---|---|
| F1 | String-lint | 3472 §13 list green over UI strings, evidence keys, logs, exports |
| F2 | Composite law | capMaster property tests (weakest+15, buckets of 5, denominator honesty) |
| F3 | Roles | student token cannot read mentor lanes/thresholds (API test); Founder-only QA panel |
| F4 | Flags fail clean | each flag off → owning surface degrades honestly; zero errors in unrelated modules |
| F5 | Observability | diagnostics panel reports all nine subsystems live; no secrets in DOM or logs |
| F6 | Regression deck | scenario deck (debug-only) drives integrated UI in Founder mode: MONO, QUIET, FAST, METRO, HANDLOST, SUPPRESS, WARM/COMP, CONGR, VVREC all render per 3472 §12 criteria |
