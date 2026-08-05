# B1-511 Live Acceptance Evidence

## Passed live checks

- canonical `/storyforge/` returned HTTP 200 through `wordpress-gateway`;
- release index/app/styles/auth matched exact accepted hashes;
- Railway `/healthz` returned `{"ok":true,"service":"storyforge-v5"}`;
- anonymous `/storyforge/api/session` returned HTTP 401;
- Founder admin signed identity returned HTTP 200 from the real admin-console
  home endpoint;
- the existing signed-in eligible student loaded the canonical release, showed
  `Student View`, `Search stories`, category controls, and priority sorting;
- no Bootstrap Demo or bounded-unavailable screen appeared;
- Railway logs showed no HTTP 5xx, fatal, uncaught, or unhandled evidence;
- database has 0 mentor notes, 0 mentor media, and 0 pending media deletion
  intents;
- private R2 has 0 objects and 0 bytes under `storyforge-mentor-notes/`.

## Honest boundary

A fresh authenticated Founder browser and an explicitly consented controlled
student submission were not available. Therefore the run did not create,
publish, or play a mentor note against a real student's record, and it did not
claim a human audio-quality judgment. Mentor notes remain double-disabled and
the four student-safe additions remain restricted to a 3-UUID allowlist.

The exact remaining canary is:

1. Founder `brinyu` opens Administrator View in the live browser.
2. A designated consenting student submits a synthetic non-private canary story.
3. Founder reviews it, records a non-private mentor note, verifies transcript,
   publishes, and judges playback.
4. The same student reads/plays it; a second student receives private 404.
5. Verify audit, cleanup, 0 transient residue, and 0 HTTP 5xx.
6. Only then consider `eligible_all` for student-safe additions and a bounded
   mentor-notes population scope.
