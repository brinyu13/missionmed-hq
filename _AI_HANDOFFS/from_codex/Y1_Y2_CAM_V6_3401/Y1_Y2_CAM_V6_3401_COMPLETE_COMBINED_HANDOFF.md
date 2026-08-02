V6 AI/VOICE FOUNDATION READY

# Y1-Y2-CAM-V6-3401 complete combined handoff

## Completion boundary

This handoff freezes and integrates the local V6 AI/voice foundation. It does
not claim avatar integration, authenticated founder access, private deployment,
student beta readiness, or production readiness.

## Exact V6 authority

- Accepted source:
  `/Users/brianb/MissionMed_worktrees/Y1-IVPrepOnCall-Fable/IV Prep OnCall_V6.html`
- Source state before this ticket: standalone Fable artifact with no Git branch,
  HEAD, upstream, or deploy manifest.
- Source/frozen baseline SHA-256:
  `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`.
- Repository: `/Users/brianb/MissionMed`.
- Integration base: `origin/main` at
  `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`.
- Worktree:
  `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3401`.
- Branch: `codex/y1-y2-cam-v6-3401-ai-voice-integration`.
- Baseline import commit: `0d169f661d3455418c60daad09e67ca1ae1a8958`.
- Upstream: no branch upstream configured; the repository remote is
  `https://github.com/brinyu13/missionmed-hq.git`.

The source was selected because it is the unique V6 artifact, identifies
itself as V4 canonical architecture plus V5 coaching intelligence, contains
the founder-locked V6 screens, and is explicitly named by the current founder
ticket. The existing DBOC production route was not reclassified as V6.

## Freeze, rollback, and scope

- Immutable rollback tag:
  `y1-y2-cam-v6-3401-baseline-3053cf77`.
- A restored checkout in `/tmp/mm-v6-3401-restore.GOkcYP` matched the exact
  frozen baseline hash.
- Allowed paths:
  - `ivprep-v6/**`
  - `_AI_HANDOFFS/from_codex/Y1_Y2_CAM_V6_3401/**`
- The canonical V6 artifact, donor POC, Kinsta files, Matrix/WordPress paths,
  and unrelated worktrees were unchanged.
- Production route changes: none.

## Baseline product

The frozen source contains Splash, Home, Instant Interview, Custom Interview,
Interview Designer, interviewer selection, program, difficulty, duration,
review, Camera and Microphone Check, Station Check, Interview Room, self-rate,
Results, Replay/Evidence, Vault, debrief, stories, file, program intel, coaching
desk, student file, trends, operations, and interviewer registry. Twenty-four
baseline screen captures are under `evidence/baseline/`.

## Donor adoption map

The donor was read from
`/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-AI-POC-3200` and was not modified.

- Provider and model contracts → `ivprep-v6/providers/` and
  `ivprep-v6/config/models.mjs`.
- Voice presets and exact provider IDs → `ivprep-v6/config/voices.mjs`.
- Model/Voice/Behavior Studio → existing V6 Interviewer Registry through
  `public/v6-integration.mjs`.
- Continuous mic, five-second silence, natural-pause protection, and barge-in
  → `public/mic-controller.mjs` plus the existing V6 room lifecycle.
- Natural interviewer pass followed by separate instructor observer →
  server-only exchange endpoints.
- Transcript, exact model/voice telemetry, and instructor evidence → existing
  V6 Results.
- Future avatar seam → `AvatarProvider` and honest unavailable provider only;
  no avatar implementation or fake video exists in 3401.

## Files changed or added

- `ivprep-v6/public/index.html`
- `ivprep-v6/public/v6-integration.mjs`
- `ivprep-v6/public/mic-controller.mjs`
- `ivprep-v6/public/avatar-provider.mjs`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/providers/avatar-provider.mjs`
- `ivprep-v6/providers/errors.mjs`
- `ivprep-v6/providers/openai-model-discovery.mjs`
- `ivprep-v6/providers/openai-realtime.mjs`
- `ivprep-v6/providers/openai-responses.mjs`
- `ivprep-v6/providers/openai-speech.mjs`
- `ivprep-v6/config/models.mjs`
- `ivprep-v6/config/voices.mjs`
- `ivprep-v6/test/*.test.mjs`
- `ivprep-v6/package.json`, `package-lock.json`, `.env.template`, `README.md`,
  `ALLOWED_PATHS.txt`
- This handoff and its evidence files.

The frozen `ivprep-v6/baseline/IV Prep OnCall_V6.html` remains byte-identical
to the accepted source.

## AI and voice architecture

Browser requests terminate at the local V6 server. The server owns the OpenAI
key, performs exact model discovery, invokes the selected interviewer, invokes
the separate observer only after the natural utterance completes, and returns
sanitized structured results. No browser route returns an API credential or
ephemeral token.

Two selectable architectures are retained:

1. Responses + OpenAI Speech: natural utterance from the selected Responses
   model, separate `gpt-5.6-luna` observer, then
   `gpt-4o-mini-tts` speech.
2. Native Realtime: server-to-server Realtime WebSocket, returned audio sent to
   the browser, then separate `gpt-5.6-luna` observer.

Exact authenticated selectable models:

- `gpt-5.6-terra`
- `gpt-5.6-sol`
- `gpt-5.6-luna`
- `gpt-realtime-2.1`
- `gpt-realtime-2.1-mini`
- `gpt-realtime-2`

Defaults:

- architecture: Responses + OpenAI Speech;
- interviewer model: `gpt-5.6-terra`;
- observer model: `gpt-5.6-luna`;
- speech model: `gpt-4o-mini-tts`;
- exact voice ID: `cedar`;
- behavior: Direct Program Director.

`W. Clint Oxley` is retained only as an unverified founder-preferred display
name. No provider evidence maps that name to an ID, and it is not represented
as `cedar`.

## Continuous microphone and recovery

- Microphone becomes active after the interviewer finishes.
- Valid speech must precede completion.
- Natural pauses shorter than approximately five seconds do not end the turn.
- Approximately five seconds of genuine silence ends a spoken answer.
- Sustained candidate speech during interviewer audio triggers a single
  barge-in and stops the current playback.
- Mute cannot submit a turn.
- A no-transcript failure removes the empty failed take, revokes any temporary
  media URL, and reopens a clean protected answer window so the learner can
  speak again or use the visible typed fallback.
- Navigation, abandon, finish, unload, and interruption cancel active provider
  work and stop media/playback.

## Evidence and termination truth

Each frontier turn preserves the answered question, applicant answer,
completed next interviewer utterance, requested model, provider-returned
interviewer model, provider-returned observer model, exact voice, timings, and
observer record as separate fields. Plan exhaustion fails closed unless the
observer confirms a real final or terminated utterance.

Conduct termination displays and speaks the exact final boundary, prevents
another candidate turn, and enters self-rating. Replay is shown only when a
real local `blobUrl` exists. Metrics-only records are labeled Evidence / Results
or NO MEDIA; no fake replay is generated.

## Authentication, environment, and routes

- `OPENAI_API_KEY` was available to the server process; its value was never
  printed, copied, committed, or sent to the browser.
- `.env.template` contains a placeholder only.
- The local role chooser is not authentication.
- The server refuses non-loopback hosts. Do not expose it on a LAN or tunnel.
- Product route: `/`.
- Server APIs: `/api/health`, `/api/model-studio-config`,
  `/api/voice-studio-config`, `/api/avatar-provider-config`,
  `/api/interviewer-exchange`, `/api/interviewer-observe`, `/api/speech`, and
  `/api/realtime-turn`.

## Launch command

```bash
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3401/ivprep-v6
npm install
npm start
```

Open `http://127.0.0.1:8343/`.

## Tests and browser evidence

- Current V6 syntax: PASS.
- Current V6 tests: 33/33 PASS.
- Dependency audit: 0 vulnerabilities.
- Donor focused tests: 15/15 PASS.
- Donor retained contracts: 17/17 PASS.
- Donor verifier probes: 27/27 PASS.
- Exact model discovery: 6/6 available, 0 failures.
- Live Responses + Speech smoke: PASS.
- Live Realtime smoke: PASS.
- Live final-position smoke: PASS.
- Live conduct-termination smoke: PASS.
- Chrome microphone grant/device truth: PASS.
- Fresh Safari empty-transcript to typed-recovery journey: PASS; provider
  advanced to contextual Q2 and the prior dead end did not recur.
- Secret boundary: PASS.
- Baseline hash and rollback restoration: PASS.
- Bounded truth/accessibility review: PASS after replacing inference-style
  claims with observation-grounded copy, disclosing the browser/OpenAI speech
  boundary, adding native keyboard controls, and adding non-drag reordering.

Integration captures are under `evidence/integration/`. Read
`BROWSER_JOURNEY.md` before using images 03 or 04 as claim evidence: those two
images have explicit evidentiary limits. Raw test truth is in `TEST_RESULTS.md`.

## Unresolved limits

- Local-only; no authenticated founder boundary and no deployment.
- No avatar provider implementation in 3401.
- Safari supports typed fallback; its microphone path is not claimed here.
- No human perceptual claim is made about voice realism.
- The provider display name `W. Clint Oxley` is not verified.
- Media persists only for the current tab; durable persistence is a 3402 task.
- Founder roles remain a local presentation gate, not authentication. The
  server is loopback-only and must not be treated as a private online preview.
- Human screen-reader and voice-realism qualification remain unclaimed.

## Exact next action for Y1-Y2-CAM-V6-3402

Create the accepted successor branch/worktree from the sealed 3401 commit.
Read this handoff first. Verify LiveAvatar through the founder's authenticated
Chrome UI without reading browser storage or exposing a credential. Confirm
the supplied `a33a57ab-8388-49fc-a069-dbcfd1bc5405` only from provider evidence.
Implement `LiveAvatarProvider` behind the existing AvatarProvider seam, keep
OpenAI intelligence/voice ownership outside the avatar adapter, add the honest
Faculty Roster and Surprise Me workflow, durable local-alpha persistence,
usage caps, emergency disable, and voice-only fallback. Do not claim avatar
success unless synchronized live provider video is observed in the V6 room.
