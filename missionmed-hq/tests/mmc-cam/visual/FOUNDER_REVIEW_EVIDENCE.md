# MMC CAM 007 Founder Review Evidence

This review surface uses only deterministic synthetic fixture data. It binds a dedicated `node:http` server to `127.0.0.1` on an ephemeral port, serves only `public/mmc-private/src/cam/**`, and stops the server and browser in `finally`. It does not start `missionmed-hq/server.mjs`, a watcher, a database, a provider, or a deployment.

## Stable review command

```bash
node missionmed-hq/tests/mmc-cam/browser/launch-mentor-review.mjs --headed
```

Press `Ctrl-C` in that terminal to close Chrome and the isolated server.

## Validation commands

```bash
node missionmed-hq/tests/mmc-cam/browser/run-mentor-review-suite.mjs
node missionmed-hq/tests/mmc-cam/browser/run-mentor-review-suite.mjs --capture
node missionmed-hq/tests/mmc-cam/browser/run-mentor-review-suite.mjs --static-only
```

The screenshot command writes bounded JPEG viewport captures plus `manifest.json` and `CHECKSUMS.sha256` under `missionmed-hq/tests/mmc-cam/visual/evidence/mentor-007/`. The manifest records route, fixture state, viewport, byte size, SHA-256, browser engine, synthetic-data classification, and explicit non-production status.

## Claim boundary

- Automated browser evidence is Chromium through the installed system Google Chrome only.
- Axe is not installed and is not claimed.
- Firefox and WebKit are not run and are not claimed.
- VoiceOver, NVDA, TalkBack, forced-colors, touch-device, and virtual-keyboard validation remain manual work.
- Automated usability checks are structural heuristics, not representative-mentor observation or a five-second comprehension result.
- Screenshots exclude signed-in browser chrome and contain synthetic records only.
