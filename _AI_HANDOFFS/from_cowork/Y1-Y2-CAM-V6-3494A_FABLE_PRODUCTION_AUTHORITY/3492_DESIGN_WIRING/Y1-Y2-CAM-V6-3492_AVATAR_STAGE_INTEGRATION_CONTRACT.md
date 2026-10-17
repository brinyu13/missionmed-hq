# Y1-Y2-CAM-V6-3492 — AVATAR / STAGE INTEGRATION CONTRACT

Pipeline (unchanged): MissionMed → LiveKit → Profile B worker → OpenAI gpt-realtime-2.1 → LemonSlice Self-Managed → Dr Kelly (`agent_9bdfc50ec0086043`) → browser. **No provider testing in this run; human-Founder-gated QA loop only** (READY → human START → conversation → STOP/timeout → cleanup → TEST AGAIN).

## 1. Stage geometry

`KellyStage` mount: SIMULATION = left panel of a two-panel stage (≈48% width, full height, min 420×520); TRAINING = mini-feed 120×76 docked top-right of the student stage (voice-forward; face optional at this size); the placeholder figure + `LEMONSLICE STREAM MOUNTS HERE` watermark occupy the mount until a real track attaches. Video track contract: `object-fit: cover; object-position: 50% 28%` (head-and-shoulders bias), letterbox never shown; aspect drift absorbed by cover-crop, not layout shift; portrait tracks center-crop with the same position bias. The state plate and tag chrome render **above** the video layer and never depend on track presence.

## 2. State machine (UI states — provider truth never implied)

`READY → CONNECTING → ASKING ⇄ LISTENING ⇄ REACTING → FOLLOW-UP → ENDING`, plus `VOICE_ONLY` and `AVATAR_UNAVAILABLE` as first-class designed states. Rules: every state renders a colored dot + literal word in the state plate (silence must never read as a crash); `CONNECTING` shows plate pulse, never a spinner over the face; state changes animate the plate only (250ms), never the video; the UI may only display a state it received from the session layer — no optimistic ASKING, no fabricated LISTENING. Loading: mount shows placeholder figure + `CONNECTING` until `track-subscribed`; first-frame swap is a 300ms crossfade.

## 3. Fallback hierarchy

`AVATAR LIVE → VOICE ONLY → PRE-GENERATED → TEXT`. Downgrade triggers (track lost >4s, subscribe failure, provider refusal) present the `AVATAR UNAVAILABLE` card with explicit continue actions; auto-continue to VOICE_ONLY after 10s if unanswered [CALIBRATE]. VOICE_ONLY renders the waveform halo + same state plate + same choreography timing. Upgrades mid-answer are not attempted; re-offer at next question boundary. **Delivery Intelligence, recording, and the session clock are provider-independent and continue through every fallback.** Session value is never lost to avatar failure.

## 4. Events consumed / emitted

Consumed: `kelly:connected`, `kelly:state {state}`, `kelly:track {on|off}`, `kelly:error {reason}`. Emitted to session layer: `kelly:fallback-accepted {tier}`, `kelly:retry-requested` (human-gated), `answer:boundary` (for re-offer). All transitions logged to the recorder's SYSTEM lane with timestamps for Film Room forensics.

## 5. QA readiness checklist (for the Founder-run loop, per Codex contract)

Natural initiation on START · state plate tracks provider states without gaps · track loss → fallback card ≤ 1s · VOICE_ONLY audio continuity · cleanup on STOP/timeout leaves no orphaned session · repeatable ×5. Until this passes, avatar tier carries `HUMAN QA REQUIRED` in the tier gate and Simulation defaults to VOICE_ONLY/PRE-GENERATED per entitlement.
