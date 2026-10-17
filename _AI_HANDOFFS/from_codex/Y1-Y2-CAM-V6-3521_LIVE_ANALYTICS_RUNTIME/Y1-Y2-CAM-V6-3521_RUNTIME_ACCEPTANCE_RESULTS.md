# Y1-Y2-CAM-V6-3521 Runtime Acceptance Results

Audit date: 2026-08-21

Scope: isolated IV Prep On-Call Live Analytics Runtime

Overall release result: **BLOCKED — PHYSICAL HUMAN CAMERA/MICROPHONE ACCEPTANCE NOT RUN; PHYSICAL WPM UNAVAILABLE**

## Outcome

The scoped automated runtime, privacy, lifecycle, visibility, overlay, route, and deterministic-QA checks pass. The runtime does not fabricate unsupported live values.

This is not full physical acceptance:

- The deterministic localhost fixture is **PASS** for labelled automation and visual QA only.
- The physical human webcam/microphone procedure is **NOT RUN**.
- Physical speaking speed/WPM is **UNAVAILABLE** because normal live mode has no trustworthy observed word-timing producer.
- Therefore this artifact does not claim that genuine slow/fast physical speech changes the WPM instrument.

## Scoped automated evidence

| Command / check | Result | Scope |
|---|---:|---|
| `npm run test:3521` | PASS — 51/51 | Dedicated route, media bridge, projector, visibility, deterministic runtime, focus recovery, mode-aware status, camera recovery, overlay gates, and provider boundary. |
| `node --test --test-concurrency=1 --test-reporter=dot test/analytics/*.test.mjs test/3521/*.test.mjs` | PASS — 240/240 | Complete analytics plus 3521 scoped regression set, including epoch/stale-frame safety, primary lock, privacy lifecycle, transient overlays, Founder instrumentation, and shared-runtime recovery. |
| `node scripts/analytics/check-syntax.mjs` | PASS — 41 modules | Analytics JavaScript syntax coverage. |
| `git diff --check` | PASS | No whitespace-error findings in the current scoped worktree changes. |
| `npm test` | NOT GREEN — unrelated 3441R runner pending | The pre-existing `test/3441r/t1-durable-lease-keeper.test.mjs` remained pending after its long keeper cases and reported `Promise resolution is still pending but the event loop has already resolved`; the run was terminated after approximately 248 seconds, cancelling later files. No 3521 failure was observed before termination. The out-of-scope runner was not repaired. |
| Hostile camera recovery probe | PASS | Camera mute/end keeps polling; first valid resumed frame closes `camera_or_vision_disconnected`. |
| Live route CSP with a configured LiveKit origin | PASS | HTTP 200 document policy retained `connect-src 'self'`; configured provider origin was absent. |

These are scoped results only; they do not substitute for the required physical human test.

## Deterministic fixture acceptance

Route: `/iv-prep-on-call/live-analytics/?testInput=deterministic-local-signals`

| Check | Result | Evidence boundary |
|---|---:|---|
| Fixture activation restricted to localhost plus exact query | PASS | Normal/non-local mode cannot opt into deterministic values. |
| Test input visibly identified | PASS | Runtime and stream status identify `DETERMINISTIC TEST INPUT · LOCAL`. |
| Production RMS, F0, compact-geometry, and projector code exercised | PASS | Synthetic input enters the same bounded projectors; input itself remains synthetic. |
| Deterministic timing refreshes without going stale | PASS | Labelled aggregate windows update after warm-up. This is not physical WPM evidence. |
| Second fixture interview resets histories and accepts a fresh session clock | PASS | Prior timestamps/counters do not contaminate the new fixture session. |
| Full, Custom, reflow, and Interview Only visuals captured | PASS | PNGs in this handoff folder are deterministic visual-QA evidence, not webcam evidence. |

Deterministic screenshots:

- `3521_V0_COMPOSITION_1626x968.png`
- `3521_V1_VISION_WIREFRAMES_DETERMINISTIC_1626x968.png`
- `3521_V2_VOICE_HUD_DETERMINISTIC_1626x968.png`
- `3521_V3_FULL_COACHING_1626x968.png`
- `3521_CUSTOM_VISIBILITY_DRAWER_1626x968.png`
- `3521_CUSTOM_REFLOW_1626x968.png`
- `3521_V4_INTERVIEW_ONLY_CAPTURE_CONTINUES_1626x968.png`

## Runtime and lifecycle acceptance

| Requirement | Automated result | Physical result | Current truth |
|---|---:|---:|---|
| Connect failure cleanup | PASS | NOT RUN | Failed acquisition/playback releases owned media, clears the video, restores idle controls, and permits retry. |
| Start, finish, and second-session reset | PASS | NOT RUN | Finish releases media/pipeline state; a new session resets projector histories and timestamp guards. |
| Late capture fencing and idempotent teardown | PASS | NOT RUN | A late `getUserMedia` resolution is fenced and cleaned; stop/destroy remove tracks and observers. |
| Track readiness and `devicechange` reporting | PASS | NOT RUN | Mute, unmute, ended, and device-list changes publish bounded readiness/recovery state. |
| Camera mute/end recovery | PASS | NOT RUN | Vision polling remains alive; the first valid recovered frame records/closes the observation gap. |
| Camera/microphone switching | PASS | NOT RUN | Stream, pipeline, session clock, and opposite device remain stable; camera switch reselects the primary person. |
| Primary-person/bystander safety | PASS | NOT RUN | Ambiguity and occlusion withhold person-derived metrics; a bystander is not silently promoted. |
| Four independent overlay switches | PASS | NOT RUN | Face, hands, body, and framing have separate worker gates with legacy defaults. |
| Overlay clearing and cover-fit | PASS | NOT RUN | Transient bitmap clears on signal gaps/finish/destroy and cover-fits the mirrored student surface. |
| Hiding analytics leaves measurement active | PASS | NOT RUN | Presentation state does not call capture, detector, projector reset, or provider paths; hidden counters/histories continue. |

## Physical human acceptance gate

No physical camera or microphone was opened during this verifier run.

| Founder physical check | Status | Reason / next evidence required |
|---|---:|---|
| Face left/right/up/down changes geometry | NOT RUN | Observe a real person and confirm live compact geometry/overlay response. |
| Left, right, and both hands change visibility | NOT RUN | Confirm genuine hand-landmark presence changes. |
| Lean/center movement changes body geometry | NOT RUN | Confirm lateral-lean and centering proxies respond. |
| Quiet/normal/loud speech changes Volume | NOT RUN | Confirm local microphone dBFS response. |
| Monotone/varied loudness changes Modulation | NOT RUN | Confirm RMS-envelope history visibly differs. |
| Voiced pitch changes Pitch | NOT RUN | Confirm validated F0 frames and speaker-relative register response. |
| Slow/fast speech changes WPM | UNAVAILABLE / BLOCKED | No normal-live observed word-timing producer exists. Do not use deterministic timing as evidence. |
| Hide/restore individual metrics while capture continues | NOT RUN physically | Automated visibility/history continuity passes; repeat during physical capture. |
| Camera/microphone selectors show permitted devices | NOT RUN | Requires real browser permission and hardware. |
| Camera mute/end or switch recovers live vision | NOT RUN physically | Automated recovery passes; verify with real devices. |

## Truth, privacy, and provider boundary

| Gate | Result | Exact boundary |
|---|---:|---|
| Fake normal-live values | PASS | No deterministic or random values enter normal live mode. Unsupported metrics render unavailable/proxy states. |
| Physical WPM claim | BLOCKED | Remains unavailable; no completion claim is permitted. |
| Deterministic provenance | PASS | Localhost-only and visibly labelled test input. |
| External analytics/provider egress | PASS | Live document CSP is self-only; worker fetch/XHR is same-origin; no provider call site exists in the runtime. |
| Provider sessions | PASS — 0 | Local harness has no provider controller and paid provider creation is disabled. No provider was invoked during this work. |
| Raw media/biometric persistence | PASS | No raw frames, PCM, landmarks, blendshapes, transcript text, embeddings, or identity state are stored. |
| Local persistence | PASS WITH BOUNDARY | Only allowlisted presentation visibility IDs and schema version are stored locally; no analytics evidence is persisted. |
| Localhost QA seam | PASS | Frozen read-only snapshot only; excludes bridge, stream, device IDs, PCM, landmarks, and lifecycle mutation methods. |
| Production / Railway / databases | NOT TOUCHED | No deployment or production mutation is part of this acceptance run. |

## Release blocker and next gate

The sole known implementation blocker is the absent physical WPM producer. The safest behavior is the current fail-closed state until a verified local/on-device aggregate word-timing adapter exists. It must not retain raw transcript text or introduce unapproved egress.

After that implementation is independently tested, run the complete physical human camera/microphone checklist above. Until both conditions are satisfied, report:

`AUTOMATION: PASS`

`DETERMINISTIC FIXTURE: PASS — QA ONLY`

`PHYSICAL CAMERA/MIC: NOT RUN`

`PHYSICAL WPM: UNAVAILABLE`

`RELEASE: BLOCKED`
