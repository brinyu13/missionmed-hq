# MM-DNS-REDIRECT-SEV1-001D Transition Landing Page Report

Date: 2026-06-15
Operator: Codex

## Outcome

Completed the live upgrade for the Mission Residency legacy redirect landing experience.

Visitors who arrive at:

- `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency`

now receive a standalone premium transition landing page only. The normal Mission Residency sales page content is no longer rendered underneath the transition experience.

Direct visits remain unchanged:

- `https://missionmedinstitute.com/mission-residency/`
- `https://missionmedinstitute.com/mission-residency/?show_full=1`

## File Changed

- `wp-content/mu-plugins/missionmed-legacy-residency-transition.php`

The MU plugin was changed from banner injection into a `template_redirect`-owned standalone HTML response for `legacy_redirect=missionresidency`, unless `show_full=1` is present.

No other WordPress plugins, page builder content, DNS records, Cloudflare Worker routes, email routing, Matrix, Arena, Scheduler, LearnDash, or WooCommerce settings were modified.

## Media Asset Chosen

Chosen existing WordPress media-library asset:

- Media ID: `5985`
- Slug: `a-diverse-group-of-healthcare-professionals-including-doctors`
- Source URL: `https://missionmedinstitute.com/wp-content/uploads/2026/05/medical-team-collaborating-on-anatomy-study-in-hos-2026-03-24-05-03-34-utc-scaled.jpg`
- Deployed page size used: `https://missionmedinstitute.com/wp-content/uploads/2026/05/medical-team-collaborating-on-anatomy-study-in-hos-2026-03-24-05-03-34-utc-1536x1024.jpg`

Reason: existing MissionMed media-library image, physician/clinical teaching context, large enough for a cinematic navy/gold background treatment. No new logo or image asset was invented or uploaded.

## Backups

Live MU plugin backup before replacement:

- Remote backup: `/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001d-pre-plugin-20260615T162323Z/missionmed-legacy-residency-transition.php`
- Local backup: `BACKUPS/MM-DNS-REDIRECT-SEV1-001D_KINSTA_PLUGIN_PRE_20260615T162323Z/missionmed-legacy-residency-transition.php`
- Backup SHA256: `432d314f054a8c972bb828682b624f64aa24423ab8ee368f01caac4c3ea57551`

Deployment staging:

- Remote stage: `/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001d-deploy-20260615T162333Z/missionmed-legacy-residency-transition.php`
- Live file: `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-legacy-residency-transition.php`
- New live SHA256: `c18dbf426dcb36c6ae5feb9bc10987290632b429039f250ece2023f27ff2209d`

## Screenshots

Before:

- `_AI_HANDOFFS/from_codex/screenshots/MM-DNS-REDIRECT-SEV1-001D_before.png`
- Problem confirmed: page height about `16424px`; transition block present, but normal sales content continued below.

After:

- `_AI_HANDOFFS/from_codex/screenshots/MM-DNS-REDIRECT-SEV1-001D_after.png`
- Standalone page confirmed: page height about `1750px`; no nav/header elements; no sales-section signals.

Mobile after:

- `_AI_HANDOFFS/from_codex/screenshots/MM-DNS-REDIRECT-SEV1-001D_after_mobile.png`
- 390px viewport confirmed: standalone page present, no top-menu signals, no horizontal overflow.

## Validation Matrix

| Check | Result |
| --- | --- |
| Local PHP lint | Passed |
| Remote staged PHP lint | Passed |
| Remote live PHP lint | Passed |
| `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency` | 200 standalone page |
| Standalone page response header | `X-MissionMed-Legacy-Transition: standalone` |
| Standalone page includes new headline | Passed |
| Standalone page uses chosen media asset | Passed |
| Standalone page contains top menu/header/nav signals | No |
| Standalone page contains long sales-section signals | No |
| Primary CTA href | `https://missionmedinstitute.com/mission-residency/?show_full=1` |
| Secondary CTA href | `https://missionmedinstitute.com/` |
| `https://missionmedinstitute.com/mission-residency/` | 200 normal full page |
| `https://missionmedinstitute.com/mission-residency/?show_full=1` | 200 normal full page |
| `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency&show_full=1` | 200 normal full page |
| `https://missionresidency.com/` first hop | 301 to MissionMed target |
| `https://missionresidency.com/` final URL | standalone transition page, 200 |
| `https://www.missionresidency.com/` final URL | standalone transition page, 200 |

## Cache

Ran WordPress/Kinsta cache clearing after deployment.

Observed output included:

- `Success: The cache was flushed.`
- `Success: All caches were cleared. Changes usually appear globally within a few minutes.`

WP-CLI continued to print pre-existing plugin/theme notices and a nonstandard segfault after `wp cache flush`, matching the behavior observed in the previous cutover. HTTP validation confirmed the deployed response is live.

## Rollback

If rollback is required:

1. Restore the backed-up plugin:

```bash
scp BACKUPS/MM-DNS-REDIRECT-SEV1-001D_KINSTA_PLUGIN_PRE_20260615T162323Z/missionmed-legacy-residency-transition.php missionmed-kinsta:/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-legacy-residency-transition.php
```

2. Lint the restored live file:

```bash
ssh missionmed-kinsta 'php -l /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-legacy-residency-transition.php'
```

3. Clear caches:

```bash
ssh missionmed-kinsta 'cd /www/theresidencyacademy_209/public; wp cache flush; wp kinsta cache purge --all'
```

4. Revalidate:

```bash
curl -I https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency
curl -I https://missionresidency.com/
```
