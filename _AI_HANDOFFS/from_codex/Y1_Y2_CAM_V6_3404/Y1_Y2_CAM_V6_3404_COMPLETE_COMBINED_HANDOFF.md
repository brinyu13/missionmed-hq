# Y1-Y2-CAM-V6-3404 · LiveAvatar Activation and Founder Acceptance

## Status

**BLOCKED ON HUMAN LIVEAVATAR ACTION**

The real LiveAvatar integration is activated and rendered the verified Dexter avatar in Google Chrome. The current Free workspace accepts a 120-second LITE session but rejects 300-, 600-, 900-, and 1200-second requests. That provider-owned cap prevents the inherited 15-minute Founder Alpha from completing with the avatar.

## Authority

- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3403`
- Branch: `codex/y1-y2-cam-v6-3404-liveavatar-activation`
- Accepted baseline: `fc1b5e3fd8224c6eff1e66240805d4ed79dfc07d`
- Rollback tags: `y1-y2-cam-v6-3403-founder-alpha-local` and `y1-y2-cam-v6-3404-inherited-3403`
- Canonical V6 root: `ivprep-v6/`
- No production deployment or unrelated MissionMed mutation occurred.

## Provider truth

- LiveAvatar LITE; server-only authorization.
- Dexter Doctor Sitting: `bd43ce31-7425-4379-8407-60f029548e61`.
- Verified LiveAvatar voice metadata: W. Clint Oxley, `a33a57ab-8388-49fc-a069-dbcfd1bc5405`.
- Actual audible LITE BYO-TTS voice: OpenAI `cedar`, PCM16 mono at 24 kHz. W. Clint Oxley is not claimed as heard.
- Default interviewer: `gpt-5.6-terra`; observer: `gpt-5.6-luna`.
- Approved LiveKit origin: `wss://heygen-feapbkvq.livekit.cloud`.
- The LiveAvatar key was confirmed present and non-empty only. It was never printed, copied, logged, committed, screenshotted, or written here.

`ivprep-v6/.env.local` and `ivprep-v6/.env` are ignored, untracked, and mode `0600`. The first holds the existing server secret. The second holds nonsecret activation values and the verified provider-accepted 120-second cap. MissionMed still owns a 15-minute default and 20-minute hard application maximum; 120 seconds is the honest current-provider constraint.

## Activated flow

1. `gpt-5.6-terra` produces the completed interviewer utterance.
2. OpenAI Speech produces `cedar` PCM.
3. The server creates the verified Dexter LITE session.
4. PCM is sent over the control WebSocket as `agent.speak` plus `agent.speak_end`.
5. Completion comes from the real `agent.speak_ended` event.
6. The browser attaches real LiveKit tracks only after exact-origin approval.
7. Genuine video subscription and browser audio playback are separately required for a synchronized-live claim.
8. The shared speaking state drives microphone barge-in and manual interruption.
9. The instructor-observer remains a separate post-utterance pass.

## Repairs

- Wait for a real subscribed video track; expose audio-blocked recovery.
- Keep video, audio-track, and audio-playback truth separate.
- Remove stale/unsubscribed tracks, prevent mirroring, and preserve final provider playback truth.
- Make avatar TTS/chunk delivery abortable so interrupted speech cannot restart.
- Route browser reconnect to the server control-socket boundary.
- Await stream completion and settle terminal provider states.
- Add provider request timeouts and three-attempt remote-stop retry.
- Serialize durable alpha ending independently from browser cleanup.
- Validate the alpha record before its end route can stop the provider.
- Persist real avatar-start and fallback delivery-mode changes.
- Add accessible primary interviewer status and the 3404 allowed path.

## Files changed

- `ivprep-v6/ALLOWED_PATHS.txt`
- `ivprep-v6/persistence/alpha-store.mjs`
- `ivprep-v6/providers/liveavatar-provider.mjs`
- `ivprep-v6/public/avatar-provider.mjs`
- `ivprep-v6/public/index.html`
- `ivprep-v6/public/v6-integration.mjs`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/test/liveavatar-provider.test.mjs`
- `ivprep-v6/test/avatar-activation-contract.test.mjs` (new)
- this handoff (new)

Ignored runtime configuration was not added to Git.

## Chrome evidence

URL: `http://localhost:8320/`

- Existing Chrome camera/microphone permission on this origin remained usable.
- Dexter appeared as a genuine remote video participant, not a loop or local stand-in.
- The first real interview produced four persisted turns and a results transcript.
- A fresh session generated and delivered: “Walk me through the two years between graduation and your first U.S. clinical experience.”
- During that utterance, the remote avatar element, provider-live notice, and interviewer-speaking state were simultaneously observed; two frames 500 ms apart showed changing facial performance.
- Candidate interruption changed speaking to stopped/listening.
- Continuous microphone stayed enabled, and a three-second natural pause did not end the answer.
- The local Chrome audio environment stayed above the silence threshold during the quiet attempt. Therefore a live five-second-silence completion was not directly demonstrated; the exact 4.999/5.000-second unit contract is not substituted for that observation.
- A second provider interview launched cleanly.
- Deliberate `Avatar off` removed video and showed the truthful voice-only state.
- After exit, provider health was stopped and inactive, video was absent, and no new interviewer audio continued.
- At 120 seconds the current account ended avatar media and the app continued voice-only without claiming live-avatar success.

The transport and changing live facial performance were directly observed. The automation surface could not independently listen to output, so this handoff does not overclaim a subjective human lip-sync judgment.

### Fresh Verifier

Independent result: partial pass / full acceptance fail. In a separate fresh Chrome tab, the verifier directly observed Dexter video, live camera/microphone, configured/connected health with the exact avatar ID, and contextual model follow-ups including “What was your specific role in that medication-reconciliation research?” Exit removed the media elements and health reported disconnected. The utterance ended before the verifier could click interrupt, so the verifier did not independently prove interruption; the supervisor did directly prove it in the preceding run. The verifier also reran 57/57 tests and found no browser/UI credential exposure.

## Persistence and restart

The supervisor restart preserved 4 records byte-for-byte at that checkpoint. The independent verifier then created and closed one additional bounded session. Current durable evidence is:

- 5 durable records; all ended, none active.
- Delivery modes: 1 voice-only activation failure and 4 avatar sessions.
- Transcript turn counts: 0, 4, 3, 1, 4.
- Usage ledger entries: 5.
- No provider session remained active after restart.

## Tests and safety

- `npm run check`: pass.
- `npm test`: **57/57 pass, 0 fail**; inherited 51 plus 6 activation/lifecycle tests.
- Exact five-second silence, natural 4.999-second pause, barge-in, reconnect, transient stop retry, shutdown cleanup, and restart durability tests pass.
- `/.env.local` and `/.env`: HTTP 404.
- Actual key literal: 0 tracked, diff, public-file, or browser-response hits.
- Browser/tracked credential markers: 0.
- `git diff --check`: pass.
- Changed paths remain within `ivprep-v6/**` or this authorized handoff path.

## Rollback and launch

Both rollback tags resolve to the accepted baseline `fc1b5e3fd8224c6eff1e66240805d4ed79dfc07d`.

```bash
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3403/ivprep-v6
HOST=127.0.0.1 PORT=8320 npm start
```

Open `http://localhost:8320/` in Google Chrome. This is loopback-only and not a production deployment.

## Single remaining founder action

In LiveAvatar, upgrade or enable the workspace plan/account setting that accepts a production-mode LITE `max_session_duration` of at least 900 seconds. Do not paste or rotate any secret in chat. Then set the ignored `LIVEAVATAR_MAX_SESSION_SECONDS` to `900`, restart locally, and rerun the 15-minute founder acceptance, including a human audible lip-sync judgment and a quiet five-second microphone completion.
