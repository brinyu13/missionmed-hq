# B1-507A Phase 1 Canonical Scope

Date: 2026-07-29

## Completion definition

StoryForge Phase 1 is complete only when an authorized user can record in the browser, receive and edit a near-live transcript, save the story, obtain a permanent private audio attachment, replay it, recover delayed work, and receive the approved cleanup and automatic-deletion protections in production.

A hidden or default-off deployment is a legitimate rollout stage. A text-only Founder pilot is not the completed Phase 1 release.

## Required workflow

1. The student opens the normal StoryForge route through WordPress/Matrix and remains in the familiar story workflow.
2. The student may type exactly as before or choose the native microphone control.
3. On first use, StoryForge presents the approved consent/privacy notice and requests browser microphone permission.
4. The browser records with a supported `MediaRecorder` MIME type, shows unmistakable active state and elapsed time, and supports pause, resume, stop, cancel, and interruption recovery.
5. Audio is segmented and stored in a short-lived local buffer, then uploaded as authenticated multipart requests with retry/idempotency protections.
6. Private temporary audio objects are written under the student/recording namespace.
7. StoryForge requests transcription through the provider adapter and polls about every two seconds. Ordered transcript text is merged into the normal editable story field without overwriting student edits.
8. The student reviews and corrects the transcript, including medical terminology, while ordinary story autosave/provenance continues.
9. On finish/save, StoryForge schedules the selected audio-assembly executor and preserves the transcript independently of audio completion.
10. If audio takes more than 90 seconds, the exact dialog offers **Keep Waiting** or **Save Without Audio**. Keep Waiting continues polling. Save Without Audio saves the byte-identical text and leaves recovery able to attach audio later.
11. Assembly creates or verifies the permanent private audio asset, attaches it transactionally to the story, and deletes temporary objects only after verification.
12. The authorized student can replay the saved audio with play/pause, progress, time, and signed-URL refresh behavior.
13. Cancelled, abandoned, expired, failed, and orphaned temporary objects are cleaned under the approved schedules.
14. Student deletion, story deletion, account closure, and the approved retention lifecycle retire and delete permanent audio with append-only audit evidence.
15. Weekly reconciliation operates first in `dry_run`, then `on` only after Founder review, while suspension and rollback controls remain available.

## Feature status

| Capability | Status at local HEAD | What remains |
|---|---|---|
| Familiar V5 text workflows | Live in B1-503 | Regression testing after Phase 1 cutover |
| Voice UI and `MediaRecorder` states | Implemented; fake-browser tested; disabled in production | Real-device/browser evidence and production activation |
| Permission, pause/resume/stop/cancel | Implemented; simulated tests | iPhone Safari/Android Chrome and assistive-tech evidence |
| IndexedDB buffering and segmented upload | Implemented; local/API-direct tested | WordPress multipart fix, R2, real route test |
| Near-live transcript polling/merge | Implemented; fake provider tested | Provider project/key, corpus bakeoff, real service evidence |
| Transcript preservation/editing | Implemented; locally tested | Production end-to-end proof |
| Assembly Option A and Option B | Both implemented/tested | RP-8-equivalent authority, selection, runtime wiring |
| 90-second dialog | Implemented and strongly tested | Production timing/failure proof |
| Permanent attachment | Implemented/tested with fakes | Migrations, R2, executor selection, production proof |
| Replay | Backend path and ordered playback implemented/tested | Product-conformant pause/progress/time UI and production proof |
| Explicit audio deletion | Backend endpoint implemented/tested | FG-1, visible control if required, WordPress DELETE support |
| Temporary cleanup/sweeps | Implemented/tested locally | Production schedule/config and R2 evidence |
| Delayed/restart recovery | Implemented/tested locally | Selected executor, real storage, restart/device proof |
| Automatic deletion/reconciliation | Implemented against fake storage; default off | C1-C5 rulings/evidence, production dry-run, Founder approval for `on` |
| Phase 1 database/RLS/audit | Implemented and PostgreSQL-tested locally | Fresh backup/restore proof and production migration |
| Feature flags/force-off | Implemented and locally tested | Production migration/config and activation evidence |

## Configuration-only versus infrastructure versus authority

- **Configuration after prerequisites:** provider mode, exact model names, R2 endpoint/region/bucket, signed-URL TTL, sweeps, voice force-off, reconciliation mode/suspension, daily-minute limit, and scoped database feature flags.
- **Production infrastructure:** R2 buckets/tokens/CORS/lifecycle; OpenAI project/key and data posture; Phase 1 migrations; Railway release; Kinsta immutable release and WordPress gateway; fresh backups and restore rehearsal.
- **Code still required:** multipart and DELETE gateway support; replay conformance; the selected assembly executor’s runtime wiring; any exact UI/copy resulting from FG-1; any implementation required by C1-C4.
- **Authority/evidence required:** FG-1, RP-8 equivalent and selection, C1-C4, C5 topology or coordination proof, and final 360-enrollment authority/receipt.

## Explicitly deferred

Student-facing AI assessment, scoring, rewriting, theme generation, analogies, coaching, Socratic questions, and mentor intelligence remain out of Phase 1. No audio/provider name should be exposed as product branding. Public access is prohibited.

## Intended audience

- Founder
- WordPress administrators
- currently enrolled 360 Match Mentorship students

All other identities must fail closed. The product is not public.
