# B1-507 Authority Resolution

The active steering authorizes the dormant/default-off path without a local container runtime.

Required dormant settings:

```text
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_VOICE_FORCE_OFF=1
STORYFORGE_PLATFORM_OFF=1
```

`STORYFORGE_PLATFORM_OFF` is a declaration-only defense-in-depth value in the current runtime; `STORYFORGE_PLATFORM_CONSUMERS` must remain absent or empty. The database `voice_capture` flag must remain `off`.

RP-8 remains mandatory before provider traffic, production assembly, a voice-complete claim, or student voice exposure. FABLE-C1 through C4 and PROBE-C5 remain mandatory before reconciliation `dry_run` or `on`. FG-1 remains mandatory before student-facing recording consent, retention, or deletion language is changed.

The active Goal and Founder steering supplied bounded deployment authority.
After live bytes were verified, the owner-controlled Critical Systems manifest
was reconciled only for the StoryForge production deployment, release, route,
and asset pins. No unrelated system entry changed. The enforced gate then
passed with 0 FAIL.

The Matrix runtime guard passed against the canonical source-bearing J1
worktree and public production with no override. No `missionmed-hub` asset was
edited.
