# Y1-Y2-CAM-V6-3494 — AVATAR PROVIDER SPEC

Interviewer = three replaceable layers. Dr Kelly is the current premium **visual embodiment**, not the interviewer.

## 1. Layer separation

```
InterviewerController (brain)   ← SessionConfiguration.interviewer.behavior
  questions · follow-up policy · probing/warmth/pace/silence/challenge · phase markers
VoiceProvider                   ← OpenAI gpt-realtime-2.1 (current) — swappable
AvatarProvider                  ← LemonSlice Self-Managed → Dr Kelly agent_9bdfc50ec0086043 (current) — swappable
```

The brain never knows which embodiment renders it. Fallback ladder is embodiment-layer only: `avatar_kelly → voice_only → pregenerated → text`; a downgrade never touches the brain, the session clock, telemetry, or recording.

## 2. Canonical provider states (the only states the UI knows)

`OFF → READY → STARTING → CONNECTED → SPEAKING ⇄ LISTENING → STOPPING → CLEANED` + `ERROR{reason}`.

Mapping to stage UI (3492 avatar contract carried forward): READY/STARTING → placeholder + `CONNECTING` plate pulse; CONNECTED first-frame → 300ms crossfade into the mount (`object-fit:cover; object-position:50% 28%`); SPEAKING/LISTENING/REACTING drive the state plate (dot + literal word — silence never reads as a crash); ERROR → `AVATAR UNAVAILABLE` card with explicit continue actions; auto-continue to voice_only after 10s unanswered `[CALIBRATE]`; upgrade re-offer only at question boundaries. UI may only display states received from ProviderBus — no optimistic states, ever. No LemonSlice-specific fields leak past the adapter.

## 3. Adapter interface

```ts
interface AvatarProvider {
  id: 'lemonslice_self_managed'|...;
  state(): ProviderState;                     // canonical enum above
  start(session: ProviderSessionSpec): void;  // HUMAN-GATED — see §5
  stop(reason:'human'|'timeout'|'error'): void;
  on(event:'state'|'track'|'error', cb): void;
  cleanup(): Promise<CleanupReport>;          // idempotent; orphan check mandatory
}
```

Current pipeline behind the adapter: MissionMed → LiveKit → Profile B worker → OpenAI Realtime → LemonSlice SM → browser. Evidence remains PARTIAL (appeared + audible once; no natural initiation; QA loop unverified). **This spec does not declare LemonSlice solved.**

## 4. In-product Provider QA (no test mule)

The REAL deployed IV Prep app carries a Founder/Admin-gated `PROVIDER QA` panel (3493 Admin panel wired real): status lights fed by ProviderBus · `START HUMAN TEST` (requires a trusted human UI event — pointer event with user activation; rejected otherwise) · live conversation window per current Founder QA policy duration · `STOP`/timeout → `cleanup()` → `TEST AGAIN` re-arms to READY. Every transition logged to the session SYSTEM lane with timestamps. The avatar occupies the **real production stage** during QA — same mount, same geometry as student sessions.

## 5. Human-only law (absolute, enforced in code)

No Fable run, Claude Code automation, browser automation, headless process, or CI job may call `start()`. Enforcement: `start()` requires a fresh `UserActivation` token + role≥FOUNDER claim + `avatar_enabled`; server side, the session-create endpoint requires an interactive auth session and rate-caps to manual cadence. **No automatic paid retry. No automatic provider recreation.** ERROR → READY requires a human press. CI can exercise the adapter only against a `MockAvatarProvider` (state-machine faithful, zero spend).

## 6. Acceptance (gates M5)

Human loop ×5: READY → START → Kelly joins with natural initiation → conversation → STOP/timeout → `CLEANED` with clean orphan check → TEST AGAIN. Track-loss mid-session → fallback card ≤1s → voice_only continues session, telemetry and recording uninterrupted. Diagnostics panel shows every transition. Until pass: avatar tier renders `HUMAN QA REQUIRED` at the tier gate and wizard STEP 3 shows Dr Kelly as honestly gated.
