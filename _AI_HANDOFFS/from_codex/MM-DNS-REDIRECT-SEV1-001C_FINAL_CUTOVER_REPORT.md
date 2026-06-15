# MM-DNS-REDIRECT-SEV1-001C Final Cutover Report

Date: 2026-06-15
Operator: Codex

## Outcome

Completed the Mission Residency legacy redirect cutover.

- Deployed the WordPress MU transition plugin to live Kinsta.
- Validated the transition message appears only when `legacy_redirect=missionresidency` is present.
- Revalidated the legacy domains while the Worker was still `302`.
- Switched the Cloudflare Worker redirect status to `301`.
- Revalidated the final production path after the `301` cutover.

## WordPress / Kinsta Work

Local source inspected:

- `wp-content/mu-plugins/missionmed-legacy-residency-transition.php`
- Local lint: `php -l` passed.

Live `mu-plugins` backup before deploy:

- Remote backup: `/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001c-mu-plugins-pre-20260615T155336Z/mu-plugins-pre-20260615T155336Z.tgz`
- Remote backup SHA256: `0cc719295c51f5446e6e925348eeaa2b7f373364cbf0435d4c70ba44cf406e4c`
- Local backup: `BACKUPS/MM-DNS-REDIRECT-SEV1-001C_KINSTA_MU_PLUGINS_PRE_20260615T155336Z/`
- Live file count at backup: 42 files.

Deploy:

- Staged to: `/www/theresidencyacademy_209/private/mm-dns-redirect-sev1-001c-deploy-20260615T155353Z/missionmed-legacy-residency-transition.php`
- Installed to: `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-legacy-residency-transition.php`
- Remote lint on staged file: passed.
- Remote lint on live file: passed.
- Live file SHA256: `432d314f054a8c972bb828682b624f64aa24423ab8ee368f01caac4c3ea57551`

Cache:

- Ran WordPress/Kinsta cache clearing.
- `wp cache flush` printed `Success: The cache was flushed.` and `Success: All caches were cleared.`
- `wp kinsta cache purge --all` printed `Success: All caches were cleared. Changes usually appear globally within a few minutes.`
- WP-CLI produced pre-existing plugin/theme notices and nonstandard exit behavior, but HTTP validation confirmed the live page changed correctly.

## Transition Validation

Validated after MU plugin deploy:

| URL | HTTP | Transition | Title Present | Squarespace |
| --- | --- | --- | --- | --- |
| `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency` | 200 | yes | yes | no |
| `https://missionmedinstitute.com/mission-residency/` | 200 | no | no | no |

Expected transition title found only on the query-gated URL:

- `Welcome to the Next Chapter of Mission Residency`

## Pre-301 Legacy Route Validation

Before permanent cutover, the Cloudflare Worker was still on `302`.

| URL | First Hop | Final | Redirects | Transition | Squarespace | Query Preserved |
| --- | --- | --- | --- | --- | --- | --- |
| `https://missionresidency.com/` | 302 | 200 | 1 | yes | no | n/a |
| `https://www.missionresidency.com/` | 302 | 200 | 1 | yes | no | n/a |
| `https://missionresidency.com/reviews` | 302 | 200 | 1 | yes | no | n/a |
| `https://www.missionresidency.com/events?source=test` | 302 | 200 | 1 | yes | no | yes |

## Cloudflare 301 Cutover

Changed only:

- `_SYSTEM/cloudflare/missionresidency-wrangler.toml`
- `REDIRECT_STATUS = "301"`

Redeploy command:

```bash
npx wrangler deploy --config missionresidency-wrangler.toml
```

Worker:

- Name: `missionresidency-to-missionmed`
- Current Version ID: `08d395c7-4a37-411c-a515-2ece9e8252db`
- Routes:
  - `missionresidency.com/*`
  - `www.missionresidency.com/*`

## Final 301 Validation

Public DNS snapshot during validation:

- `missionresidency.com` A: `172.66.40.153`
- `www.missionresidency.com` A: `172.66.40.153`

Final redirect checks:

| URL | First Hop | Location | Redirects | Final | Transition | Squarespace | Query Preserved |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `https://missionresidency.com/` | 301 | `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency` | 1 | 200 | yes | no | n/a |
| `https://www.missionresidency.com/` | 301 | `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency` | 1 | 200 | yes | no | n/a |
| `https://missionresidency.com/reviews` | 301 | `https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency` | 1 | 200 | yes | no | n/a |
| `https://www.missionresidency.com/events?source=test` | 301 | `https://missionmedinstitute.com/mission-residency/?source=test&legacy_redirect=missionresidency` | 1 | 200 | yes | no | yes |

Direct URL spot checks also returned Cloudflare `301` responses for:

- `https://missionresidency.com/`
- `https://www.missionresidency.com/`

## Constraints Observed

Did not touch unrelated:

- DNS email routing
- Other Cloudflare records
- WordPress plugin settings
- Matrix
- Arena
- Scheduler
- LearnDash
- WooCommerce
