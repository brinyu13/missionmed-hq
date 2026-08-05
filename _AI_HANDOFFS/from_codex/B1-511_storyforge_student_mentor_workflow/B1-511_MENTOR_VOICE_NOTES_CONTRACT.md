# B1-511 Mentor Voice Notes Contract

Mentor notes are a separate additive domain, not student recording reuse.

- Records: `sf_mentor_notes`, `sf_mentor_note_media`, and append-only deletion
  intents.
- Storage prefix: `storyforge-mentor-notes/{author}/{student}/{story}/{note}/...`.
- States: private draft, published, discarded, and failed media lifecycle.
- Only eligible `admin` or repository-defined `mentor` identities may author.
- Students can read only published, non-internal notes attached to their own
  submitted story.
- The transcript remains editable before publication.
- Audio receives a short-lived signed playback URL only after authorization.
- A failed upload/transcription schedules and completes bounded cleanup; draft
  text remains private.

The runtime kill switch `STORYFORGE_MENTOR_NOTES_FORCE_OFF` defaults closed and
is evaluated on every request. The database `mentor_notes` feature flag is an
independent second gate.

Local tests prove text, audio allocation, isolated keys, object HEAD
verification, transcription, publication, student playback authorization,
discard cleanup, internal-note denial, cross-user denial, and conflict
sanitization. Production currently has the environment kill switch set to `1`,
database flag `off`, 0 mentor notes, 0 mentor media rows, 0 pending deletion
intents, and 0 R2 objects/bytes under `storyforge-mentor-notes/`.

Production mentor voice remains intentionally dormant. It requires a real
Founder/controlled-student canary and human perceptual audio judgment before
the force-off value or population scope can change.
