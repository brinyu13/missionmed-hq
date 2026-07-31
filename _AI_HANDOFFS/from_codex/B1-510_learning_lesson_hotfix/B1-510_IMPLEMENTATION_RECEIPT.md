# B1-510 Implementation Receipt

## Verdict

The B1-510 source and deterministic release implementation is complete. The
dead `Add more now — optional` disclosure has been removed and the existing
Learning Lesson body is permanently open. No component was rebuilt.

## Product source change

Only `storyforge-v5/public/app.js` changed in production source:

- `<details class="capMore">` became `<div class="capMore open">`;
- the dead `<summary>` line was removed;
- the matching closing tag became `</div>`.

All existing child fields, copy, IDs, names, CSS classes, event handlers,
autosave payloads, persistence payloads, voice controls, and story-save paths
remain unchanged.

## Repository-baseline repair

Before B1-510 editing, the only worktree change was the pre-existing deletion
of `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`.
The Founder authorized restoring only that file byte-for-byte from starting
HEAD `587a3f67df0027b6e328e928356e9b265617ea3b`.

- Restored SHA-256:
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- The restored file has no diff and was not modified or committed as B1-510
  product work.

## Commits

- `89720d096741bcc3289fa10c563916d4ed21146b` — B1-510 source and tests.
- `1bb6e8b917d6993c4af08e9ff2408313835f123d` — deterministic generated release.

## Release

- Release ID: `v-a790ce4e3168384f`
- App asset: `assets/app.9aaf9d3670ee.js`
- App SHA-256:
  `9aaf9d3670eea84ff41aa84859384c4bd945b753c80dd880601a9637fa8361df`
- Release PHP SHA-256:
  `01c6871355683ee87ce9e648480bb226ce0d393ef05cae77700943e086552f2f`
- Deterministic rebuild from clean commit: PASS.

## Deployment

- Production URL: `https://missionmedinstitute.com/storyforge/`
- Immutable Kinsta source:
  `releases/1bb6e8b917d6993c4af08e9ff2408313835f123d`
- Active release ID: `v-a790ce4e3168384f`
- Live route SHA-256:
  `2837cde673a9bb66d334c903053926c51cddf1582f6d52b698ab20e4964b616a`
- Live release PHP SHA-256:
  `01c6871355683ee87ce9e648480bb226ce0d393ef05cae77700943e086552f2f`
- Live app SHA-256:
  `9aaf9d3670eea84ff41aa84859384c4bd945b753c80dd880601a9637fa8361df`
- Kinsta file modes: route/release `0444`; release directory `0555`.
- MyKinsta `Clear all caches`: completed; live index and app returned the
  exact new hashes afterward.

Fresh private recovery point:

- `/www/theresidencyacademy_209/private/b1-510/B1-510-RP-KINSTA-PRE-20260731T145156Z`
- Manifest SHA-256:
  `5b4501dc0cdf0897a160dc719414103f420920cc14b79985fb031ae5474d9d73`

Sealed rollback receipt:

- `/www/theresidencyacademy_209/private/b1-510/rollback/B1-510-KINSTA-ROLLBACK-20260731T145156Z/rollback.tsv`
- SHA-256:
  `abd1dcc91081a920c52ef0576e26a01bee84491767a4de36433665aa013e7015`
- Guarded rollback preflight: PASS against the active release and route.

The WordPress settings were drained for the cutover and restored byte-for-byte
to their pre-cutover JSON. Pre/post SHA-256:
`8171d6ce5fa569d9f5470c6847edc297ea7f714aaaf4180fd2158463ac4e959f`.

The authenticated Founder student live smoke showed the existing recovered
voice draft, the immediately visible Learning Lesson, themes, and score, and no
`Add more now` disclosure. No draft field was edited or saved during smoke.
