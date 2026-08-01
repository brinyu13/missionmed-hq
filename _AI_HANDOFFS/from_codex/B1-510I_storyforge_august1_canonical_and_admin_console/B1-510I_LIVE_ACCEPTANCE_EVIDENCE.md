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
- the Founder completed the real physical-microphone canary and judged the transcript `PASS — accurate and usable`;
- the saved story and editable transcript persisted after reload;
- transient recording cleanup is complete: zero database segment rows and zero `storyforge-rec/` R2 objects;
- one permanent audio object remains attached to the saved Founder story;
- direct cross-user story access returned HTTP 404;
- production HTTP 5xx remained zero after activation;
- feature scope is audited `eligible_all` with empty allowlist and cohorts;
- Founder student, Ignacio, and a second eligible student report `voiceCapture=true`;
- Founder administrator reports `voiceCapture=false`;
- ineligible WordPress identity cannot obtain a StoryForge token;
- anonymous session remains HTTP 401;
- Critical Systems enforced gate: 111 PASS, 3 WARN, 0 FAIL.

## Separate non-blocking replay defect

The original saved audio did not play after reopening the story from the Library. Recording, upload, transcription, editable insertion, save, and transcript persistence passed. The replay problem is recorded separately and must be investigated without reopening or invalidating the Founder’s canary acceptance.

## Screenshot evidence

`screenshots/B1-510I_post_rollback_safe_gate.png` records the earlier fail-closed checkpoint. No private Founder story-title screenshot is committed. Phase B/C screenshots remain pending their gated implementation.
