# B1-512 Private story media

## Implemented release-candidate foundation

- JPEG/PNG/WebP up to 5 MB; MP4/WebM up to 50 MB and declared maximum 60 seconds.
- Direct private signed upload, byte-signature verification, pending-to-permanent promotion, signed playback refresh, caption, order controls, remove, durable deletion intent, audit, and archived-story denial.
- Separate `storyforge-media/` namespace; no public bucket or permanent browser URL.
- Forced RLS and RPC-only mutations enforce owner, assigned-mentor submitted-story, and bounded administrator submitted-story access.
- Exact R2 origin is admitted to `img-src`, `media-src`, and `connect-src`; no wildcard.
- `STORYFORGE_STORY_MEDIA_FORCE_OFF=1` defaults the lane closed.

## External production gates

Media must remain off until both are proven:

1. a seven-day lifecycle rule exists for only `storyforge-media/pending/`; and
2. production has a trusted server-side container/duration probe. The current browser-supplied duration is bounded but is not sufficient production authority for permanent video acceptance.

These gates do not block the Finish It, submission, configuration, text-size, environment, or Interview Prep repairs.
