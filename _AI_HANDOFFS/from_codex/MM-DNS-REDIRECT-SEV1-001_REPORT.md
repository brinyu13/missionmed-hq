# MM-DNS-REDIRECT-SEV1-001 Report

Date: 2026-06-15
Operator: Codex

## Executive Finding

Cloudflare is the authoritative DNS layer for `missionresidency.com`, but the legacy `www` hostname is still delegated to Squarespace through `ext-cust.squarespace.com`. The apex host is proxied through Cloudflare and currently receives a Squarespace-origin 301 to `https://www.missionresidency.com/`. The `www` host then serves a Squarespace 404 / expired-site response directly.

The true authoritative redirect layer is Cloudflare, not WordPress, Kinsta, DreamHost, `.htaccess`, or a WordPress redirect plugin. Requests to the legacy domain do not reach the MissionMed WordPress/Kinsta stack today.

## Evidence Captured

Commands run from `/Users/brianb/MissionMed_worktrees/MM-DNS-REDIRECT-SEV1-001`.

- `dig +short NS missionresidency.com` returns `gerald.ns.cloudflare.com` and `ruth.ns.cloudflare.com`.
- `dig +trace NS missionresidency.com` confirms the `.com` delegation points to Cloudflare nameservers.
- `dig +short A missionresidency.com` returns Cloudflare anycast IPs `172.66.40.153` and `172.66.43.103`.
- `dig +short CNAME www.missionresidency.com` returns `ext-cust.squarespace.com`.
- `dig +short A www.missionresidency.com` returns Squarespace IPs `198.49.23.144`, `198.49.23.145`, `198.185.159.144`, and `198.185.159.145`.
- `curl -sSIL https://missionresidency.com` returns `301` to `https://www.missionresidency.com/` with Squarespace-origin headers including `x-contextid`.
- `curl -sSIL https://www.missionresidency.com` returns `404` with `Server: Squarespace`.
- `curl -sSIL https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency` returns `200` from the MissionMed/Kinsta/Cloudflare stack.

## Root Cause

1. Cloudflare is authoritative for the legacy zone.
2. `www.missionresidency.com` is a DNS record pointing to Squarespace (`ext-cust.squarespace.com`) and is currently not being intercepted by a Cloudflare redirect.
3. `missionresidency.com` is proxied by Cloudflare, but its current origin behavior is still Squarespace, which redirects apex traffic to `www`.
4. No checked-in WordPress, `.htaccess`, Kinsta, or repo-side redirect can fix the active legacy-domain request path because those requests terminate at Squarespace before reaching MissionMed.

## Implemented In Repo

- Added Cloudflare Worker source:
  - `_SYSTEM/cloudflare/missionresidency-redirect-worker.mjs`
- Added Cloudflare Worker deploy config:
  - `_SYSTEM/cloudflare/missionresidency-wrangler.toml`
- Added WordPress MU plugin for redirected visitor experience:
  - `wp-content/mu-plugins/missionmed-legacy-residency-transition.php`
- Added post-deploy validation script:
  - `VALIDATION/validate_missionresidency_redirect.sh`

The MU plugin only renders when `legacy_redirect=missionresidency` is present. It positions Mission Residency as the flagship residency division inside the larger MissionMed Institute ecosystem.

Live Cloudflare deployment was not executed from this workspace because `wrangler` is not installed and no Cloudflare API token or missionresidency zone ID is present in the environment.

## Required Cloudflare Deployment

Before changing anything, back up the current Cloudflare state:

```bash
mkdir -p BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001

curl -sS \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$MISSIONRESIDENCY_ZONE_ID/dns_records" \
  > BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001/dns_records_$(date +%Y%m%d_%H%M%S).json

curl -sS \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$MISSIONRESIDENCY_ZONE_ID/workers/routes" \
  > BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001/worker_routes_$(date +%Y%m%d_%H%M%S).json
```

Deploy the Worker to Cloudflare:

```bash
wrangler deploy --config _SYSTEM/cloudflare/missionresidency-wrangler.toml
```

Configure routes:

```text
missionresidency.com/*
www.missionresidency.com/*
```

Configure DNS:

- `missionresidency.com`: keep proxied through Cloudflare.
- `www.missionresidency.com`: change the existing CNAME from DNS-only to proxied so Worker routes can execute. After validation, remove Squarespace as an origin dependency by repointing `www` to a proxied non-Squarespace origin or Cloudflare placeholder record if your Cloudflare plan/workflow supports it.

Recommended deployment status:

- Testing window: set Worker variable `REDIRECT_STATUS=302` in `_SYSTEM/cloudflare/missionresidency-wrangler.toml`.
- After validation: set `REDIRECT_STATUS=301` and redeploy.

## Redirect Contract

Every request for:

- `http://missionresidency.com/*`
- `https://missionresidency.com/*`
- `http://www.missionresidency.com/*`
- `https://www.missionresidency.com/*`

must return a single redirect to:

```text
https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency
```

Existing query strings are preserved. Example:

```text
https://www.missionresidency.com/events?source=email
-> https://missionmedinstitute.com/mission-residency/?source=email&legacy_redirect=missionresidency
```

## Validation

Run:

```bash
chmod +x VALIDATION/validate_missionresidency_redirect.sh
EXPECTED_STATUS=302 VALIDATION/validate_missionresidency_redirect.sh
EXPECTED_STATUS=301 VALIDATION/validate_missionresidency_redirect.sh
```

Pass criteria:

- No response has `Server: Squarespace`.
- No legacy path returns 200/404 from Squarespace.
- Every legacy host and path redirects directly to the MissionMed target.
- `legacy_redirect=missionresidency` is present.
- Existing query strings are preserved.
- The final MissionMed target returns 200.

## Notes

Kinsta is active for `missionmedinstitute.com` and returns the target page successfully. DreamHost is not authoritative for the observed legacy-domain traffic path. WordPress redirect plugins and `.htaccess` are not the correct redirect layer for this incident because legacy-domain traffic is not reaching WordPress.
