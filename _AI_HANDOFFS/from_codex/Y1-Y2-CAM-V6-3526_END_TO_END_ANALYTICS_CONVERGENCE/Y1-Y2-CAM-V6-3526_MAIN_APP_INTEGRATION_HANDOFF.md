# Y1-Y2-CAM-V6-3526 Main App Integration Handoff

## Source and route

- Merge source: commit `aac89b5fc066558dc1d01b23bca782b4057562fa` on `codex/y1-y2-cam-v6-3521-live-analytics-runtime`.
- Runtime source root: `ivprep-v6/public/live-analytics/`.
- HQ mount: `ivprep-v6/server/hq-mount.mjs`.
- Canonical route: `/iv-prep-on-call/live-analytics/` (`/iv-prep-on-call/live-analytics` redirects with 308).
- Assets remain same-origin under the IV Prep mount; CSP permits vendored WASM compilation but not JavaScript `eval`.

## Admission and permissions

1. The HQ mount calls `strictProjectHqSession` before serving IV Prep routes/API.
2. Anonymous, malformed, expired, or non-entitled sessions receive the existing IV Prep admission error and must not receive a usable analytics session.
3. The browser fetches `GET /api/ivprep-v6/session` with same-origin credentials and accepts only a bounded `wp:<id>` subject plus a mutation CSRF token.
4. Student access is the existing IV Prep entitlement. Founder/Admin roles additionally expose Lab diagnostics and session target controls; they do not change media ownership.
5. The word-timing POST requires the admitted session, exact origin, CSRF header, content type `application/vnd.missionmed.pcm-f32le`, 48 kHz sample rate, bounded body, and same-origin route.

## Session interface

The larger application should mount the route inside its admitted IV Prep session and provide interviewer/question context before capture. The current stable first-party hooks are:

- `ivprep:interviewer-turn-started` and `ivprep:interviewer-turn-ended` document events, or `window.__IVPREP_3522_INTERVIEWER_EVENT__(type, detail)`.
- `window.__IVPREP_3522_SET_NOTES_ACTIVE__(boolean)` for explicit note-taking context only.
- `window.__IVPREP_3522_EXPORT_DERIVED__()` for the claim-safe, derived-only behavior export.

Context details should include a stable question/answer identifier and a timestamp on the runtime session clock. Do not infer interviewer turns from the student's microphone when the orchestration layer already knows the interviewer channel.

## Recording hooks

This runtime owns live analysis, not durable recording. It requests one camera/microphone stream through `LiveAnalyticsMediaBridge`; hide/show and route presentation changes do not reacquire it. If the main app records media, it must attach a separately reviewed consumer to the already-owned session stream and provide an explicit recording lifecycle. Do not silently add persistence to this analytics code.

## Analytics output contract

The live projector exposes six presentation families with state, timestamp/window, confidence, and provenance:

- `VOLUME`
- `SPEED_WPM`
- `VOLUME_MODULATION`
- `PITCH`
- `HEAD_FACE`
- `BODY_HANDS`

The 3522 behavior envelope is derived-only and sanitized against PCM, samples, pixels, landmarks, blendshapes, transcript text, images, bitmaps, blobs, and other raw fields. Post-answer records use `missionmed.ivprep.behavior-answer.v1`; export uses `missionmed.ivprep.behavior-export.v1`; the between-answer card uses `missionmed.ivprep.post-answer-card.v1`.

## Downstream consumers

| Consumer | Integration input | Current state |
|---|---|---|
| Results | derived answer envelope and metric validity/provenance | contract available; durable write adapter not added in 3526 |
| Film Room | timestamped derived events/history plus separately owned media reference | event/history contract available; raw-media linking is external |
| Answer Vault | stable answer/question IDs plus derived coaching summary | metadata contract available; no 3526 database write |
| Mentor Review | raw-secondary metrics, corridor configuration, event counts, validity | live Mentor drawer implemented; durable mentor record external |
| Progress/history | versioned derived aggregates and calibration revision | export available; longitudinal persistence external |

## Calibration and preferences

Live Cues is session-scoped. Visibility persistence is allowlisted presentation data only. Personal baselines are derived scalars bound to the admitted subject and current device profile. A future durable adapter may persist only a reviewed versioned derivative schema; it must never add raw audio, video, landmark, PCM, or transcript-text retention.

## Database and provider impact

- Required 3526 database migrations: `NONE`.
- Paid provider dependency: `NONE`.
- Local word timing: bundled Sherpa ONNX runtime, memory-only, provider sessions `0`.
- Production deployment/Matrix activation: deliberately not performed by 3526.

## Exact merge procedure

1. Start from the target integration branch and verify a clean or explicitly preserved worktree.
2. Merge or cherry-pick `aac89b5fc066558dc1d01b23bca782b4057562fa` without rewriting unrelated changes.
3. Run from `ivprep-v6`: `node --test test/3521/*.test.mjs test/3522/*.test.mjs test/3526/*.test.mjs` and the broader `node --test test/analytics/*.test.mjs test/3521/*.test.mjs test/3522/*.test.mjs test/3526/*.test.mjs`.
4. Launch `npm run start:3521-live-analytics`; verify admitted live route and deterministic route separately.
5. Run the physical script before any production activation.
6. Verify anonymous denial, non-entitled denial, student access, and Founder/Admin Lab access in the target Matrix environment.
7. Only after those gates, deploy under the target mission's separate production authority and record the immutable revision/rollback candidate.

## Rollback boundary

The product change is one source commit with no migration. Before merge, abandon the feature commit. After merge but before deploy, revert the merge/cherry-pick. After deploy, redeploy the last verified immutable revision; do not edit migration history because 3526 created none.
