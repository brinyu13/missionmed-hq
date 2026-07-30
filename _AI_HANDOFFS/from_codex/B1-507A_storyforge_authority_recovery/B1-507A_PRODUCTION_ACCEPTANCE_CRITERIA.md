# B1-507A Production Acceptance Criteria

Date: 2026-07-29

The declaration **STORYFORGE PHASE 1 IS FULLY LIVE** is permitted only when every mandatory row below passes in production with evidence tied to the exact GitHub SHA, Railway deployment, Kinsta release pointer, database migration ledger, R2 configuration, and provider project.

## Access and routing

- [ ] `https://missionmedinstitute.com/storyforge/` loads the exact approved V5/V5.5 product through WordPress; no direct standalone-HTML launch is required or supported.
- [ ] Founder access passes.
- [ ] WordPress administrator access passes.
- [ ] A currently enrolled qualifying 360 student passes.
- [ ] Expired, revoked, nonqualifying, arbitrary subscriber, anonymous, cross-student direct-ID, bad-origin, expired-JWT, and direct-Railway unauthorized access all fail.
- [ ] Bootstrap, refresh, expiration, logout, and return-to-Matrix flows pass.
- [ ] Route is private/noindex/no-store as designed and no public R2/object URL exists.

## Core voice workflow

- [ ] Microphone permission prompt, denial, recovery, and truthful messaging pass on supported desktop/mobile browsers.
- [ ] Recording state, elapsed time, pause, resume, stop, maximum duration, and cancel pass.
- [ ] Segmentation, IndexedDB recovery, authenticated multipart upload, retry, and partial failure pass through the real WordPress gateway.
- [ ] Duplicate segment/finish/save submissions are idempotent.
- [ ] Near-live ordered transcript appears within the approved latency envelope.
- [ ] Medical terminology and accent bakeoff passes every RP-7 threshold.
- [ ] Provider primary/fallback/timeout/retry/unavailable paths are truthful and do not lose text.
- [ ] Student corrections and ordinary typing remain editable and are never overwritten by late transcript results.
- [ ] Story save preserves the exact reviewed text.

## Permanent audio and replay

- [ ] RP-8-selected executor is wired and completes the authorized 40×15-second runtime probe.
- [ ] Storage verification precedes transaction-bound permanent attachment.
- [ ] Temporary objects are removed only after verified permanent attachment.
- [ ] Permanent key/metadata/ownership and audit rows are correct.
- [ ] Replay survives reload and signed-URL expiry, and implements play/pause, progress, elapsed/total time, and accessible status.
- [ ] Multi-segment/final-layout playback works in Chrome and Safari.
- [ ] A student cannot replay another student’s private audio by ID or URL.

## Delay, recovery, and failure

- [ ] At 90 seconds, exact **Keep Waiting** / **Save Without Audio** copy and behavior pass.
- [ ] Repeated Keep Waiting cycles neither duplicate jobs nor lose focus/text.
- [ ] Save Without Audio saves byte-identical text and allows later attachment recovery.
- [ ] Process restart, page reload, app switching, network loss, provider failure, storage timeout, delayed assembly, and pending-asset recovery pass.
- [ ] Terminal recovery bounds produce truthful failure rather than infinite work or fake success.
- [ ] Cancellation stops capture, cleans eligible local/server temporary data, and does not create a story/audio asset accidentally.

## Lifecycle, cleanup, and deletion

- [ ] FG-1 consent, retention, explicit-delete control, story deletion, account closure, cohort revocation, and wind-down behaviors are implemented and accepted.
- [ ] Abandoned/cancelled/expired temporary-object cleanup passes against real R2.
- [ ] Weekly reconciliation `dry_run` observes the 168-hour rule, bounds, fairness rule, and service-principal/RLS contract while performing zero deletes and zero audit writes.
- [ ] Founder reviews and explicitly approves the transition to `on`.
- [ ] A bounded production-safe `on` fixture proves delete/retry/audit truth under resolved C1/C3.
- [ ] Suspension halts action immediately.
- [ ] One-scheduler topology or authorized coordination is proven.
- [ ] Explicit, story, account-closure, and automatic deletion cannot delete an ineligible or referenced object.

## Privacy, accessibility, and quality

- [ ] StoryForge-scoped provider project/key, retention/logging, BAA/Healthcare Addendum/ZDR posture, rotation, and least privilege are evidenced.
- [ ] Logs/telemetry/audit contain no raw audio, transcripts, secrets, bearer tokens, or signed URLs.
- [ ] Keyboard-only flow, visible focus, modal focus trap/restore, timer/status/error announcements, touch targets, contrast, reduced motion, VoiceOver, and TalkBack pass.
- [ ] Visual state matrix passes at 1440×900 and 390×844, including permission, recording, paused, uploading/transcribing, 90-second dialog, recovered attachment, replay, and failures.
- [ ] iPhone Safari and Android Chrome pass permission, interruption, screen lock/app switch, MIME format, wake behavior, replay, and recovery.
- [ ] No student-facing AI/coaching is exposed.

## Operations and regressions

- [ ] Unit 189/189, PostgreSQL 150/150, E2E 45/45, conformance 72/72, plus new gateway/replay/C1-C5/real-service suites pass at the launch SHA.
- [ ] Fresh database and Kinsta backups exist and restore rehearsal passes.
- [ ] Railway, Kinsta, WordPress, R2, OpenAI, and system-manifest receipts match the exact launch.
- [ ] Force-off, provider-none, reconciliation-off/suspension, Railway rollback, Kinsta pointer rollback, and data-safe recovery are rehearsed.
- [ ] StoryForge text workflows and protected MissionMed applications/routes/assets show no regression.
- [ ] Post-cutover monitoring completes the required observation window with acceptable errors, latency, upload, transcription, assembly, cleanup, and authorization signals.

If any checkbox is not evidenced, the permitted verdict is **not fully live**. The system may be described only by the exact completed rollout rung.
