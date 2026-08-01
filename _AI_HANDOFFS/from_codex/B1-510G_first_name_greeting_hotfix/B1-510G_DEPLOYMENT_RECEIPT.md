# B1-510G Deployment Receipt

## Status

**NOT DEPLOYED — FAIL-CLOSED BEFORE REMOTE WRITES.**

No Railway, Kinsta, WordPress, PostgreSQL, R2, OpenAI/provider, Cloudflare, or
other remote mutation occurred during B1-510G-B.

## Release candidate

- Release source commit:
  `d88d320561f31680f6f252160e45b6402d184587`.
- Deterministic release commit:
  `0250ab7591518c2a0589c377e4862bcd82c2e1b3`.
- Release ID: `v-21d896bc96f9c454`.
- App asset SHA-256:
  `0dd4ed77dc52731cf49e95033c6962ad371cec2c3db3cc1248d5fa71c6b03176`.
- Index SHA-256:
  `ffeb8b5f603d3c6113bca008cc2647fde8b7f17175ba268d6293d0c05349d93a`.
- Release PHP SHA-256:
  `3afec2a55716420b616d4dabd4c35baed741e2e88a219592f0690235d940b147`.
- Route SHA-256:
  `e673ed291b5fc070330d3c3b30a7ff7b267a7d8ce46f98ab9db8a8f854553925`.

## Verified live prestate

Read-only public verification at 2026-08-01T13:28Z found the existing B1-510
deployment unchanged:

- index SHA-256:
  `2071b79c42260b97b5369e26c7662b517d0ed67948e4d15d848e38c574fe5263`;
- app alias `9aaf9d3670ee`, full SHA-256
  `9aaf9d3670eea84ff41aa84859384c4bd945b753c80dd880601a9637fa8361df`;
- auth SHA-256
  `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`;
- styles SHA-256
  `644548c5ff24b3b357c4194b97e56ce8525feab59b0f4914e3bf9779099e00fe`.

## Blocking release-safety contradiction

The binding critical-systems gate fails three StoryForge checks because
`_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` still pins the older B1-508 index and
app (`5a5dd916…` and alias `fded51e056c6`), while production is already on the
later accepted B1-510 bytes above. The stale alias returns 404, the pinned index
hash mismatches, and the pinned app fetch fails.

B1-510G expressly prohibits unrelated-file modification. The critical manifest
is a protected, generator/authority-owned system file, so it was not silently
rewritten or bypassed. The smallest required external action is:

1. have the critical-systems manifest owner reconcile and approve the already
   deployed B1-510 index/app/alias baseline;
2. rerun `_SYSTEM/tools/critical_systems_gate.py --json` and obtain zero FAIL;
3. provide the unavailable local WordPress integration evidence from a working
   container runner, or explicitly rule that the passing signed-claim unit and
   route evidence may substitute for this hotfix;
4. then create a fresh Kinsta/WordPress/Railway recovery point and execute the
   existing guarded deployment/verification/rollback path.

No recovery point or rollback receipt was created because the stop occurred
before any remote write. The accepted current production release remains the
rollback state.
