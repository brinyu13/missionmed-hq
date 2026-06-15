# MM-DNS-REDIRECT-SEV1-001D Logo + Parallax Update Report

Date: 2026-06-15
Operator: Codex

## Outcome

Updated the live standalone Mission Residency transition page with:

- Copy changed to `For nearly two decades...`
- Mission Residency logo added.
- MissionMed Institute logo added.
- MissionMed logo converted into a light-on-dark PNG variant.
- Scroll parallax added for the hero background and transition card.

Live page:

- `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency`

The working Cloudflare `301` redirect was not changed.

## Files / Assets Changed

MU plugin:

- `wp-content/mu-plugins/missionmed-legacy-residency-transition.php`

Local assets:

- `_SYSTEM/assets/missionresidency-transition/mission-residency-logo-dark.png`
- `_SYSTEM/assets/missionresidency-transition/missionmed-institute-logo-dark.png`
- `_SYSTEM/assets/missionresidency-transition/missionmed-institute-logo-dark-preview.png`

Live assets:

- `https://missionmedinstitute.com/wp-content/uploads/2026/06/mm-legacy-transition/mission-residency-logo-dark.png`
- `https://missionmedinstitute.com/wp-content/uploads/2026/06/mm-legacy-transition/missionmed-institute-logo-dark.png`

## Logo Conversion

Mission Residency logo source:

- `/Users/brianb/MissionMed/06_AI_CONTEXT/chatgpt-history/file-85o7izs9L7JlSq7rrgzsZGXZ-2019 Mission Logo for Dark Backgrounds.png`

MissionMed logo source:

- `/Users/brianb/MissionMed_worktrees/MM-SPEED-HOME-011/_AI_HANDOFFS/from_codex/_evidence/MM-SPEED-DRILLS-005/assets/variants/missionmed-drills-logo-mm-speed-drills-005-q98.webp`

The MissionMed logo was converted deterministically with local image processing:

- Cropped to meaningful alpha bounds.
- Removed faint WebP transparency noise.
- Preserved the shield artwork.
- Recolored the wordmark to light blue-white.
- Recolored `INSTITUTE` and divider lines to gold.
- Saved as transparent PNG for the dark standalone page.

No generative image editing was used for the logo, to avoid altering the brand mark or text.

## Deployment

Pre-update live plugin backup:

- `/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001d-logo-parallax-pre-20260615T163711Z/missionmed-legacy-residency-transition.php`
- SHA256: `c18dbf426dcb36c6ae5feb9bc10987290632b429039f250ece2023f27ff2209d`

Plugin backup before parallax fallback patch:

- `/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001d-parallax-fallback-pre-20260615T163929Z/missionmed-legacy-residency-transition.php`
- SHA256: `122551dc55ebe11b5684844d3aa51beb3e5cde066c71f9b20b95e155203d143c`

Final live plugin SHA256:

- `3729e85d64a6bbba7a3b590ef3d726d56e36b2039f58e4071c970f6732e9ea71`

Live asset SHA256:

- Mission Residency logo: `1ecbcbade865fa6210c94abf11e9377d2316fbae03e5eb4deb3818a2d2ec7439`
- MissionMed logo: `2af6a860b268a6a288a6c182286185e0ea717e128c831bc22fb5c50bc5ef1e6b`

## Parallax

Implemented lightweight scroll parallax in the MU plugin:

- Background image shifts subtly with scroll.
- Transition card shifts slightly in the opposite direction.
- Uses `requestAnimationFrame` when available.
- Falls back to `setTimeout` if `requestAnimationFrame` is unavailable.
- Respects `prefers-reduced-motion: reduce` and disables motion for those users.

## Validation

| Check | Result |
| --- | --- |
| Local PHP lint | Passed |
| Remote staged PHP lint | Passed |
| Remote live PHP lint | Passed |
| Legacy standalone URL | 200 |
| `X-MissionMed-Legacy-Transition` header | `standalone` |
| Copy says `For nearly two decades` | Passed |
| Old `For more than a decade` copy absent | Passed |
| Mission Residency logo referenced | Passed |
| MissionMed logo referenced | Passed |
| Mission Residency logo asset | 200 `image/png` |
| MissionMed logo asset | 200 `image/png` |
| Parallax script present | Passed |
| Fallback scheduler present | Passed |
| Sales/menu signals absent from standalone page | Passed |
| Direct Mission Residency page unchanged | 200 normal full page |
| `?show_full=1` unchanged | 200 normal full page |
| `https://missionresidency.com/` first hop | 301 to MissionMed standalone target |

Browser notes:

- Desktop screenshot confirmed both logos, corrected copy, and standalone page composition.
- Mobile screenshot confirmed both logos, no horizontal overflow, and no menu/sales signals.
- The validation browser reports `prefers-reduced-motion: reduce`, so runtime motion correctly remains disabled there.

## Screenshots

- Desktop: `_AI_HANDOFFS/from_codex/screenshots/MM-DNS-REDIRECT-SEV1-001D_logo_parallax_after.png`
- Mobile: `_AI_HANDOFFS/from_codex/screenshots/MM-DNS-REDIRECT-SEV1-001D_logo_parallax_after_mobile.png`
- MissionMed converted logo preview: `_SYSTEM/assets/missionresidency-transition/missionmed-institute-logo-dark-preview.png`

## Cache

Ran Kinsta/WordPress cache clearing after deploy. WP-CLI again printed the known plugin/theme notices and a nonstandard segfault after `wp cache flush`, but it also printed:

- `Success: The cache was flushed.`
- `Success: All caches were cleared. Changes usually appear globally within a few minutes.`

HTTP validation confirmed the updated response is live.

## Rollback

To roll back to the pre-logo/parallax standalone page:

```bash
scp missionmed-kinsta:/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001d-logo-parallax-pre-20260615T163711Z/missionmed-legacy-residency-transition.php /tmp/missionmed-legacy-residency-transition.rollback.php
scp /tmp/missionmed-legacy-residency-transition.rollback.php missionmed-kinsta:/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-legacy-residency-transition.php
ssh missionmed-kinsta 'php -l /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-legacy-residency-transition.php'
ssh missionmed-kinsta 'cd /www/theresidencyacademy_209/public; wp cache flush; wp kinsta cache purge --all'
```

The added assets can remain harmlessly unused after plugin rollback. If removal is required, remove only:

```bash
/www/theresidencyacademy_209/public/wp-content/uploads/2026/06/mm-legacy-transition/mission-residency-logo-dark.png
/www/theresidencyacademy_209/public/wp-content/uploads/2026/06/mm-legacy-transition/missionmed-institute-logo-dark.png
```
