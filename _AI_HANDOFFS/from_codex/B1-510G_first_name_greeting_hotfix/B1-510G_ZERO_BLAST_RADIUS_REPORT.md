# B1-510G Zero-Blast-Radius Report

## Scope result

The hand-authored production change is limited to the existing signed identity
path and the homepage name selector. There are no layout, CSS, component,
navigation, story, persistence, voice, transcription, storage, reconciliation,
feature-flag, cohort, role, LearnDash, authorization, or database changes.

## Changed-file inventory

Implementation and fixtures/tests:

- `storyforge-v5/public/app.js` — homepage name-source priority only.
- `storyforge-v5/server/auth.mjs` — type-checked signed claim transport plus
  local fixture first names.
- `storyforge-v5/server/app.mjs` — overlays the signed values on the existing
  authenticated session user object.
- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
  — adds the existing core first name and login to the existing signed JWT.
- `storyforge-v5/scripts/run-integration.sh` — local WordPress fixture only.
- `storyforge-v5/tests/integration/storyforge-sso.spec.mjs` — local real-bridge
  greeting assertion.
- `storyforge-v5/tests/unit/auth.test.mjs`
- `storyforge-v5/tests/unit/phase1-routes.test.mjs`
- `storyforge-v5/tests/unit/first-name-greeting.test.mjs`

Deterministically regenerated release artifacts:

- `storyforge-v5/dist/assets/app.0dd4ed77dc52.js` (replaces
  `app.9aaf9d3670ee.js`).
- `storyforge-v5/dist/index.html`.
- `storyforge-v5/infra/edge/generated-asset-aliases.mjs`.
- `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php`.
- `storyforge-v5/infra/wordpress/missionmed-storyforge-runtime/release.php`.

## Visual evidence

Before, current deployed production:

- `../B1-507_storyforge_phase1_launch/screenshots/007-live-storyforge-dormant-founder-home-after.png`
  shows `Good morning, brinyu.`

After, local release candidate:

- `evidence/B1-510G_after_desktop_2048x1216.png`
- `evidence/B1-510G_after_mobile_390x844.png`

The desktop and 390x844 checks show the same markup, typography, placement,
spacing, and time-of-day wording with only the selected name changed. At 390px,
the greeting occupies 344px from x=18 through x=362 and the document has no
horizontal overflow.

## Protected and unrelated systems

- Canonical Founder HTML remains byte-identical at SHA-256
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- `missionmed-hub` assets were not changed.
- No WordPress profile data was written.
- No database, R2, OpenAI/provider, Railway, Kinsta, Cloudflare, voice flag,
  reconciliation, cohort, allowlist, or role was mutated.
- Six older tracked reference screenshots rewritten by the conformance runner
  were restored to their exact starting-HEAD bytes and are not part of this
  ticket.
