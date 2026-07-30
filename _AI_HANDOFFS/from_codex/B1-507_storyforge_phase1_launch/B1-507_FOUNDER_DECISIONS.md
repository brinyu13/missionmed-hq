# B1-507 Founder Decisions

## Settled for this run

- Continue the current implementation; do not redesign StoryForge.
- Bypass unavailable local container-runtime work.
- Defer RP-8 as evidence for voice enablement, not dormant deployment.
- Keep provider traffic disabled and reconciliation off.
- Do not claim production recording/transcription is enabled.
- Preserve Founder-only, non-voice StoryForge access.

## Still unresolved but not required for dormant deployment

FG-1 still requires one Founder lifecycle ruling covering first-use consent, retention, explicit deletion, story/account deletion, wind-down, permanent-audio deletion, and all student-facing retention language. Until ruled, the candidate preserves the canonical V5.5 text and exposes no production voice capability.

## Smallest decision needed for the current non-RP8 block

Provide the normal owner workflow for `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`, or explicitly authorize a bounded owner-reviewed manifest update that replaces stale StoryForge bundle/release hashes, records the current Kinsta/Railway topology, and removes the obsolete live-Worker assumption.
