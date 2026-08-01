# B1-510I Live Acceptance Evidence

## Proven live

- production `/storyforge/` index SHA matches `ffeb8b...d93a`;
- app, auth, and styles alias bytes match their deterministic local release hashes;
- live Railway service is online on deployment `80e39e8e-954f-4964-9bfc-6b7c98fac1a4`;
- live health is HTTP 200 with the bounded StoryForge health document;
- audited `eligible_all` canary admitted an eligible student and continued to deny voice to the administrator;
- anonymous session remained HTTP 401;
- actual MediaRecorder upload, WordPress gateway, provider orchestration, and cancellation lifecycle executed;
- no canary story was saved;
- the latest canary recording is cancelled with zero retained segments;
- feature scope was restored to `allowlist:1:0`.

## Not proven

A transcript faithful to a known physical-microphone phrase was not obtained. Synthetic macOS speech was not reliably picked up by the selected microphone, and ambient/provider output cannot be accepted as evidence. Transcript bodies are intentionally omitted from this handoff.

## Screenshot evidence

`screenshots/B1-510I_post_rollback_safe_gate.png` records the privacy-safe fail-closed state after rollback. A live Founder home screenshot containing private story titles was deliberately not retained. Phase B/C checkpoint images do not exist because those phases were not started.

## Required next canary

1. Open an allowlisted Founder student session.
2. Confirm the current release hashes and recording control.
3. Speak a short non-private phrase directly into the selected microphone.
4. Confirm exact/acceptable transcript fidelity.
5. Save and reload only if the phrase passes.
6. Delete the canary through the authorized lifecycle.
7. Verify cross-user denial, zero orphaned transient objects, and zero HTTP 5xx.
8. Only then activate `eligible_all`, rerun the student matrix, and update Critical Systems.
