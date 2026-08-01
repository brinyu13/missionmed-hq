# B1-510K Deployment Receipt

## Release identity

- implementation commit: `6efc0868036fde193b0b36504976cf5f32f525ca`
- release commit: `4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981`
- Critical Systems reconciliation: `255972b`
- release ID: `v-cf6c4b91bad6ac65`
- index SHA-256:
  `25484c8730689abf4a3dc0263fcf6632823c63e0ae77cfaa4fc03fc0ac9c8a6d`
- app SHA-256:
  `b37fc23b87acb31dba13bb6f866983acbc637f7c493fe3ad21b8dfca8aaaeb33`
- route SHA-256:
  `e99a7f82b156962cb6f253a0b28f9a520cc87915288247ce6e1c3e40a05e34c1`
- release.php SHA-256:
  `15ecc508346fb65743190093315b2267246c79afe862e9734016249f3cfea610`

## Railway

- prior deployment: `00496858-15f1-46d0-897b-379f63b7367c`
- deployed exact package root: `storyforge-v5`
- new deployment: `0b64c2fc-9292-4d1a-9469-94f21b1a1ca4`
- status: `SUCCESS`; health: `ok`; replicas: one; HTTP 5xx: zero.
- live variables remained OpenAI / `gpt-4o-transcribe` / `whisper-1` /
  `concat` / reconciliation `off` / voice force-off `0`.

## Kinsta

- staged exact route/release bytes in private B1-510K staging.
- guarded preflight passed after the installer-required brief StoryForge-off
  window; the complete prior option was privately backed up.
- current pointer is the new release commit and both route/release hashes match.
- StoryForge was restored enabled immediately after publication.
- public index and app bytes match the release exactly.
- CSP includes only the exact configured private R2 origin.

The final cache-helper anomaly occurred after publication and is documented in
the rollback receipt. No deployment rollback was required.
