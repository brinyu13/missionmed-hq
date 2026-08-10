# B1-513R3 Prototype-to-Production Delta

## Mapping principle

R3 is a presentation refinement of the accepted R2 prototype. It does not reopen the R2 architecture. The production implementation should move only the R3 renderer/style differences onto the existing R2-authorized seams.

## Exact mapping

### 1. Dr Brian Recommends

- Input: the existing governed Inspiration browse payload.
- Selection: `recommended=true`, unanswered preferred, two items maximum.
- Action: existing question-answer route and existing Inspiration navigation.
- Production delta: replace the compact Home strip markup with the contained R3 module and namespaced styles.
- No new state, endpoint, or recommendation authority.

### 2. StoryForge Home HUD

- Input: the existing signed-in student story list.
- Canonical privacy field: `story.visibility`; legacy status may be a fallback only when visibility is absent.
- Actions: existing `data-library-status` filters and Story Library navigation.
- Production delta: remove only the old compact status panel and append the full-width R3 HUD.
- No analytics endpoint and no cross-student aggregate.

### 3. Mentor/Admin voice feedback

- Record: existing MediaRecorder-based mentor-note flow.
- Preserve original: existing mentor-note audio asset and authorized playback URL.
- Transcribe: existing mentor-note upload/transcription response.
- Edit: existing draft body textarea and versioned draft update.
- Publish: existing audited non-internal publish action.
- Student read/play: existing published-note payload and authorized playback endpoint.
- Private admin notes: remain non-publishable and absent from student serialization and playback.
- Production delta: R3 markup, labels, pause/resume controls around the recorder state, and namespaced styles.
- No dependency on Story Media photo/video activation.

### 4. Mentorship/privacy

- Read: existing versioned policy endpoint.
- Decide: existing consent POST and receipt.
- Pre-consent: Private default.
- Post-consent: Mentor Visible default for newly created stories only.
- Override: existing per-story Private control.
- Submission: remains separate.
- Historical: no migration-side or client-side widening.
- Production delta: R3 dialog renderer/styles plus the corrected non-accepted Settings branch.

## Prototype-only elements

- Signed fixture identities.
- Synthetic backend state.
- Blob-backed synthetic audio.
- Local origin shim.
- `window.__B1513R3` verification helper.
- Single-file packaging.

These must not be promoted as production implementation.

## Production acceptance additions

In addition to the accepted R2 production gates, the later implementation must prove:

1. Home HUD totals are mutually exclusive and equal the signed-in student’s accessible story count.
2. A published mentor voice note exposes transcript + playback only to its authorized student and permitted mentor/admin identities.
3. Private admin notes are inaccessible by list, direct ID, playback ID, audit projection, and browser payload to students.
4. A deferred student can later consent in Settings and receives the versioned receipt.
5. Existing V1 visibility and content hashes remain unchanged across migration/promotion.
6. Dark/light, reduced-motion, text-size, desktop, and 390px checks pass with zero serious/critical accessibility issues and zero horizontal overflow.

## Release boundary

Prototype approval is not production deployment authority. Production remains on its existing release until the separately authorized V2 release train completes backups, migration gates, immutable build, canaries, Critical Systems checks, rollback proof, and Founder release authorization.
