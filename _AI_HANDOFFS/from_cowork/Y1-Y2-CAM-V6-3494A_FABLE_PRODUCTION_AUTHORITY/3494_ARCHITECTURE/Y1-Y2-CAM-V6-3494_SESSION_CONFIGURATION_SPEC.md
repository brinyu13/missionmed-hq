# Y1-Y2-CAM-V6-3494 — SESSION CONFIGURATION SPEC

One canonical object. Wizard populates it; Pro Loadout edits it; the session engine consumes it. **There is exactly one session engine.**

## 1. SessionConfiguration (canonical)

```ts
interface SessionConfiguration {
  id: string; createdBy: UserId; createdAt: ISO;
  mode: 'quick_rep'|'guided'|'delivery_training'|'simulation'|'baseline_capture';
  questions: { source:'single'|'set'|'preset'|'category'|'surprise'|'last_mission';
               ids: QuestionId[]; presetId?: PresetId; category?: string; count?: number };
  interviewStyle: PresetId|'custom';
  interviewer: { behavior: { presentation:'female'|'male'|'unspecified'; ageBand:'30s'|'40s'|'50s'|'60s+';
                  role:'pd'|'apd'|'faculty'|'chief'|'committee'|'interviewer';
                  styles: StyleTag[];              // ≤3
                  followupFreq:0..100; probingDepth:0..100; warmth:0..100;
                  pace:0..100; silenceTolerance:0..100; challenge:0..100 };
                 embodiment:'avatar_kelly'|'voice_only'|'pregenerated'|'text';   // ladder order
                 voice: VoiceProfileId;
                 riseProfile?: RiseSimulationProfileId };  // dormant seam — never fabricated
  environment: 'meetlink'|'conference_grid'|'webmeet'|'hospital_vc'|'desk';
  difficulty: 'gentle'|'realistic'|'pressure';
  followups: 'off'|'low'|'high'|'adaptive';
  durationSec?: number;
  hud: { mode:'none'|'minimal'|'standard'|'coaching'; modules: MetricId[] };   // display only
  overlays: { mode:'off'|'minimal'|'standard'|'lab'; layers: OverlayLayerId[] }; // display only
  measurement: { modules: MetricId[]; persistEvidence: boolean };   // core set defaults ON
  recording: { video: boolean; audio: boolean; consentAt?: ISO };
  storyforge: { hydration: boolean };
  privacy: { sharingDefault:'private' };
  flagsSnapshot: Record<string,boolean>;   // frozen at start for reproducibility
}
```

Validation invariants (engine-enforced, not UI-enforced): `simulation ⇒ hud.mode='none'` (hard) · `baseline_capture ⇒ hud.mode='none' ∧ overlays.mode='off' ∧ unscored` · `measurement.modules ⊇ CORE_TELEMETRY` regardless of hud/overlay config · embodiment downgrades follow the ladder only · recording requires consent timestamp.

## 2. Wizard (Setup A — default, mobile-first)

Five steps, one decision per screen, single column, ≥56px touch targets, huge type, 3492 plates. STEP 1 what (Quick Rep / Practice a Question / Delivery Training / Full Interview) → STEP 2 practice what (Choose Question → mini library sheet · Category · Surprise Me · Continue Last Mission) → STEP 3 interviewer (Dr Kelly [flag+entitlement gated, honest `PROVIDER OFFLINE` state] / Voice Only / Simple Interviewer / Advanced Setup ↗) → STEP 4 coaching (None / Minimal / Standard / Coach Me → maps to hud.mode; note "everything is still measured") → STEP 5 ready (camera+mic check inline, recording consent, summary plate, START). Every step has `ADVANCED ↗` which opens the Pro Loadout **with the same SessionConfiguration instance** — nothing is lost in either direction. Defaults: last-used config per mode; a returning student reaches START in two taps (STEP 1 → STEP 5).

## 3. Pro Loadout (Setup B)

The 3493 builder surfaces (Question Library tray, preset grid, Interviewer Builder, Environment, HUD EDIT, overlay controls, recording, StoryForge hydration, duration) — all bound to the same object, desktop-optimized, game-loadout feel. A `SIMPLE ↗` link returns to the wizard at the equivalent step.

## 4. Mobile law

Wizard + Quick Rep + Answer Library + review viewing: excellent on mobile. Dense telemetry configuration remains desktop-first. Mobile practice degrades honestly by capability detection: no landmark support ⇒ hands/gesture modules report UNAVAILABLE (never fake); recording falls back to platform-supported codecs; live instruments render PERFORMANCE-compact.

## 5. Engine consumption

`SessionEngine.start(config)` → resolves flags snapshot → asks DIRegistry to activate `measurement.modules` → opens buses → InterviewerController takes `questions + style + behavior` → EmbodimentEngine takes `embodiment + voice` → MediaStage takes `environment` → RecorderService takes `recording + persistEvidence`. Post-session, the config ID is stamped into every AnswerRecord for exact reproduction ("practice again" = clone config, bump attempt).
