# Y1-Y2-CAM-V6-3521 Live Analytics Runtime Handoff

## Outcome

The isolated IV Prep On-Call Live Analytics Runtime is implemented at:

`/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/ivprep-v6/public/live-analytics/`

It provides the Founder-directed three-column interview composition, a dominant center interview stage, independently configurable Head/Face and Body/Posture analytics, and the four required Voice + Delivery instruments in the required order: Volume, Speaking Speed, Volume Modulation, and Pitch.

The local runtime and deterministic QA mode are functional. Release acceptance remains blocked because physical human camera/microphone response testing was not performed and normal physical mode has no verified local aggregate word-timing producer for WPM. Physical Speaking Speed therefore fails closed as `UNAVAILABLE`; no provider or unverified transcription fallback was introduced.

## Workspace and custody

- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521`
- Branch: `codex/y1-y2-cam-v6-3521-live-analytics-runtime`
- Clean base SHA: `6857fb48e5f7c7408d747bd1cae212e69b6dfee1`
- Implementation source commit: `e1b2eee49cc13c4ddb109bc79400369924cfc5ab`
- Donor/reference only: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440`
- 3440 modified by this run: **NO**
- Production/Railway/database modified: **NO**
- Paid or external provider sessions: **0**

## Launch

```sh
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521/ivprep-v6 && npm run start:3521-live-analytics
```

The harness prints its ephemeral localhost URL and `PROVIDER_SESSIONS=0`. For the visibly labelled zero-permission fixture, append:

`?testInput=deterministic-local-signals`

Normal mode does not generate deterministic values and requires an explicit user gesture before camera/microphone acquisition.

## Runtime architecture

The implementation keeps three concerns separate:

1. **Capture** — `media-bridge.mjs` owns user-gesture media acquisition, device enumeration, hot-swap, readiness, stop, and cleanup.
2. **Measurement/projection** — the reused local browser analytics pipeline and workers emit observable audio and vision diagnostics; `live-metric-projector.mjs` maps them into claim-safe display frames and fails unavailable inputs closed.
3. **Presentation** — `visibility-state.mjs`, `hud-renderers.mjs`, and `live-analytics.mjs` control only what is painted. They cannot stop capture, reset histories, reacquire media, or mutate evidence.

The page has a self-only `connect-src` CSP, no recording/upload path, no analytics persistence, no provider controller, and no network telemetry path. Only an allowlisted visibility preference is stored in `localStorage`.

## Implemented behavior

- Exact three-column desktop composition with responsive collapse behavior.
- Head/Face regional mesh, claim-safe region statuses, smile geometry/events, camera-facing dwell proxy, blink rate, WPM mirror, head nod availability, and geometry trend.
- Body/Posture scan, upper-body alignment proxy, in-frame status, hands visible, gesture/movement observations, unsupported repetitive/notes states, and movement trend.
- Segmented Volume bar, segmented WPM arc, RMS modulation trace, and speaker-relative pitch register.
- Face, hands, body, and framing center overlays can be switched independently.
- Full Coaching, Custom, Minimal, and Interview Only presets.
- Exact 22-metric visibility registry with family and per-metric controls.
- Custom subsets persist locally; corrupt, oversized, or unknown state fails safely to Minimal.
- Hiding a metric, family, rail, or all analytics leaves measurement histories and counters running.
- Restore controls transfer keyboard focus before their triggers disappear.
- Camera loss keeps bounded vision polling alive; the first recovered frame closes the observation gap.
- Device selectors, refresh, start/stop capture, start interview, finish, and primary-person reselection seams.
- Deterministic fixture uses the production projector and is prominently labelled local test input.

## Files changed

Modified:

- `ivprep-v6/package.json`
- `ivprep-v6/public/analytics/browser-pipeline.mjs`
- `ivprep-v6/public/analytics/holistic-worker.mjs`
- `ivprep-v6/scripts/analytics/check-syntax.mjs`
- `ivprep-v6/server/hq-mount.mjs`
- `ivprep-v6/test/analytics/privacy-lifecycle.test.mjs`

Added:

- `ivprep-v6/public/live-analytics/hud-renderers.mjs`
- `ivprep-v6/public/live-analytics/index.html`
- `ivprep-v6/public/live-analytics/live-analytics.css`
- `ivprep-v6/public/live-analytics/live-analytics.mjs`
- `ivprep-v6/public/live-analytics/live-metric-projector.mjs`
- `ivprep-v6/public/live-analytics/media-bridge.mjs`
- `ivprep-v6/public/live-analytics/visibility-state.mjs`
- `ivprep-v6/scripts/3521/start-live-analytics-harness.mjs`
- `ivprep-v6/test/3521/live-analytics-route.test.mjs`
- `ivprep-v6/test/3521/live-analytics-runtime.test.mjs`
- `ivprep-v6/test/3521/live-analytics-visibility.test.mjs`
- `ivprep-v6/test/3521/live-metric-projector.test.mjs`
- `ivprep-v6/test/3521/media-bridge.test.mjs`
- `ivprep-v6/test/3521/shared-runtime-recovery.test.mjs`
- All artifacts in this handoff directory.

The PNG checkpoint files are intentionally local handoff evidence under the repository's existing `_AI_HANDOFFS/**` binary ignore policy; the six Markdown handoff records are committed on the branch.

## Verification

- `npm run check:analytics` — PASS, 41 modules.
- `npm run test:3521` — PASS, 51/51.
- `node --test --test-concurrency=1 --test-reporter=dot test/analytics/*.test.mjs test/3521/*.test.mjs` — PASS, 240/240.
- `git diff --check` — PASS.
- `npm test` — NOT GREEN due an out-of-scope pre-existing 3441R runner issue: `test/3441r/t1-durable-lease-keeper.test.mjs` remained pending after its long keeper cases and reported `Promise resolution is still pending but the event loop has already resolved`; the run was terminated after approximately 248 seconds, cancelling later files. No 3521 failure was observed before termination, and the dedicated 3521 plus complete analytics/3521 scopes above pass independently. This unrelated 3441R issue was not repaired.
- Codex in-app Browser — PASS at 1626×968 using the localhost deterministic fixture.
- Same-session Full → Custom → Interview Only transition — PASS; clock advanced while hidden, both rails collapsed, center overlays disappeared, and the status read `MEASURING · ANALYTICS HIDDEN`.
- Physical camera/microphone human-response gate — **NOT RUN**.

## Known limitations and hard boundary

- Physical WPM is `UNAVAILABLE`: there is no verified local/on-device aggregate transcript-timing producer in the isolated runtime.
- Physical face/body/hand/audio response behavior is implemented through proven local engines but is not physically accepted until a person performs the required motion/voice matrix.
- Head/Face and Body/Posture interpretations are observable geometry or explicitly labelled proxies; the runtime does not infer emotion, personality, honesty, confidence, diagnosis, or intent.
- Notes detection, notes confidence, repetitive movement, and head-nod output remain unavailable where a validated detector does not exist.
- No review/Film Room evidence persistence was added in this isolated ticket.

## Required next acceptance step

At a user-controlled physical checkpoint, open the normal localhost route, grant camera/microphone permission, and execute face, hand, lean, volume, modulation, pitch, pace, visibility, and device-selector tests. Do not enable camera or microphone automatically. WPM cannot pass until a verified local aggregate word-timing source is integrated.
