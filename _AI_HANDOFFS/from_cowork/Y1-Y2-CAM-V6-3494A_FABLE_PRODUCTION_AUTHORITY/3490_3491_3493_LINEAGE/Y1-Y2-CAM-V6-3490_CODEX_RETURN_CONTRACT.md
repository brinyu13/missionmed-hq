# Y1-Y2-CAM-V6-3490 — CODEX RETURN / DEPLOY CONTRACT

Return handoff for the Codex runtime/deploy lane once the Claude Code build lands. **This run deployed nothing, mutated no provider sessions, ran no LemonSlice tests.**

## 1. State Codex receives

- Design converged: 3490 architecture + showroom + North Star composite; 3471C IDs preserved; 3472 grammar lock ratified into the North Star (pending Founder dispositions in `_SHOWROOM_SELECTIONS.md`).
- Frontend contract: instrument interface + frame shape + adapter seam per `_CLAUDE_CODE_BUILD_CONTRACT.md`. Synthetic scenario source S1–S6 is the QA fixture; live source plugs into the same `attachSource`.
- Runtime truth unchanged from the 3483 forensic report as restated in the ticket: shell WORKING · Dr Kelly PARTIAL (appeared + audible once; no natural initiation; short exchange) · human QA loop NOT VERIFIED · Delivery Intelligence PARTIAL (accepted primitives only) · production BLOCKED.

## 2. Codex responsibilities

1. **Telemetry adapters:** map the capture pipeline's accepted primitives (dBFS/clipping, speech-active/pause/energy-variation, transcript-rate, hand presence/centers/zones/episodes, torso/face/framing, coverage/confidence, SessionClock) into the frame contract. Fail-closed mapping is part of the adapter, not the UI.
2. **Dr Kelly path:** LiveKit → Profile B worker → OpenAI gpt-realtime-2.1 → LemonSlice Self-Managed → agent_9bdfc50ec0086043 → browser. Deliver the QA loop endpoints (READY/START/STOP/cleanup) so a HUMAN Founder can run: READY → START → conversation → STOP/timeout → cleanup → TEST AGAIN. Fix natural initiation. Verify the fallback ladder downgrades cleanly (LIVE→VOICE→PREGEN→TEXT) without losing the session or the Delivery Intelligence stream.
3. **Persistence:** derived lanes + events + consented recordings only; raw audio/frames/landmarks never persisted; mentor marks attributed + timestamped; exports (timeline PNG, events CSV) per contract.
4. **Entitlements:** tier gates (TIER2) enforced server-side; avatar tier carries HUMAN-QA-REQUIRED flag until verified.
5. **String-lint in CI:** the 3472 §13 prohibited-word list runs against UI strings, logs, telemetry keys, exports on every build.

## 3. Blockers Codex must not bypass

- No autonomous paid LemonSlice sessions — Founder-initiated only.
- No production deploy while human QA loop is unverified.
- No composite (L2/L3) ships student-facing before the ADM2/ADM3 human-validation pass records tuned weights.
- No phase-aware coaching claims before the phase contract exists (manual markers interim).

## 4. Return payload expected from Codex

`CURRENT_STATE.json` update (per 3483 convention) covering: adapter coverage per detector, Dr Kelly QA loop status (per-step verified/unverified), fallback ladder test matrix, entitlement wiring, lint status, and a delta list against this contract. Plus updated forensic handoff if any runtime truth changed.
