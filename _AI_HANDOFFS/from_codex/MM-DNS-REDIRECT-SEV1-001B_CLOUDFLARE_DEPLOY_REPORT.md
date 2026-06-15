# MM-DNS-REDIRECT-SEV1-001B Cloudflare Deploy Report

Date: 2026-06-15
Operator: Codex

## Executive Status

Cloudflare Worker deployment succeeded and `www.missionresidency.com` was changed from DNS-only to Proxied in Cloudflare.

Current redirect status is intentionally still `302`.

The requested final `301` redeploy was not performed because the required transition-message validation failed: the live MissionMed target page returns 200, but the premium transition message is absent both with and without `legacy_redirect=missionresidency`.

## Cloudflare Account / Zone

- Cloudflare account: `Brinyu@yahoo.com's Account`
- Account ID: `eeaaf73d1670b47a162d251ca67e7cfa`
- Wrangler user: `info@missionresidency.com`
- Zone touched: `missionresidency.com`
- DNS record touched: `www.missionresidency.com` only
- Other DNS/email/WordPress/Matrix/Arena/Scheduler/WooCommerce/LearnDash settings: not touched

## Pre-Change Root Cause Confirmed

Before changes:

- `missionresidency.com` was already routed through Cloudflare.
- `www.missionresidency.com` resolved to `ext-cust.squarespace.com` and Squarespace IPs.
- `https://www.missionresidency.com/` returned `Server: Squarespace` and HTTP 404.
- Apex requests redirected to `www`, then landed on Squarespace.

Backups/evidence saved under:

```text
BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001B/
```

## Actions Completed

1. Authenticated Wrangler through Cloudflare OAuth.
2. Set `_SYSTEM/cloudflare/missionresidency-wrangler.toml` to:

```toml
REDIRECT_STATUS = "302"
```

3. Deployed Worker:

```bash
npx wrangler deploy --config missionresidency-wrangler.toml
```

4. Worker deployment result:

```text
Worker: missionresidency-to-missionmed
Version ID: 6631150e-97f3-4152-89b0-39ace46c5791
Routes:
  missionresidency.com/*
  www.missionresidency.com/*
```

5. In Cloudflare DNS dashboard, changed only:

```text
www.missionresidency.com
Type: CNAME
Target: ext-cust.squarespace.com
Proxy status: DNS only -> Proxied
```

Cloudflare dashboard confirmed: `DNS record updated successfully`.

## DNS Validation

Cloudflare authoritative nameservers and public resolvers now return Cloudflare IPs for `www.missionresidency.com`:

```text
@ruth.ns.cloudflare.com   172.66.40.153, 172.66.43.103
@gerald.ns.cloudflare.com 172.66.40.153, 172.66.43.103
@1.1.1.1                  172.66.40.153, 172.66.43.103
@8.8.8.8                  172.66.40.153, 172.66.43.103
```

Note: the local macOS `getaddrinfo` path continued to return stale Squarespace IPs during validation even after `dscacheutil -flushcache`. Direct `dig` queries against the same network resolver returned Cloudflare IPs, so this is local resolver cache staleness, not Cloudflare DNS state.

## 302 Redirect Validation

Validated against Cloudflare edge:

```text
https://missionresidency.com/
302 -> https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency

https://www.missionresidency.com/
302 -> https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency

https://missionresidency.com/reviews
302 -> https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency

https://www.missionresidency.com/events?source=test
302 -> https://missionmedinstitute.com/mission-residency/?source=test&legacy_redirect=missionresidency
```

Confirmed:

- No Squarespace response on the Cloudflare edge path.
- No redirect loop.
- Query string preserved for `source=test`.
- Redirect chain for HTTPS test URLs is one hop to the MissionMed target.
- Final target resolves to HTTP 200.

Evidence files:

```text
BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001B/http_302_edge_validated.txt
BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001B/redirect_chain_302.txt
BACKUPS/cloudflare/MM-DNS-REDIRECT-SEV1-001B/target_transition_validation.txt
```

## Validation Gap Blocking 301

The live MissionMed target page loads successfully:

```text
https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency
status=200
redirects=0
```

But the transition experience is not present:

```text
legacy_redirect=missionresidency: transition_text=absent
no legacy_redirect:              transition_text=absent
```

Search terms checked:

```text
mm-legacy-residency-transition
Welcome to the Next Chapter of Mission Residency
Mission Residency has grown
```

Interpretation: the WordPress MU plugin created in the prior repo step is not live on `missionmedinstitute.com`. This workspace does not contain a WordPress/Kinsta MU-plugin deployment path, and WordPress settings were not touched.

## Current Production State

- Worker is live.
- Routes are live.
- `www.missionresidency.com` is proxied through Cloudflare.
- Redirect status remains `302`.
- `301` cutover is pending transition-message deployment/validation.

## Safe Completion Steps

After deploying the WordPress-side transition experience to the live MissionMed site:

1. Verify:

```bash
curl -sSL 'https://missionmedinstitute.com/mission-residency/?legacy_redirect=missionresidency' | rg 'Welcome to the Next Chapter of Mission Residency|mm-legacy-residency-transition'
curl -sSL 'https://missionmedinstitute.com/mission-residency/' | rg 'Welcome to the Next Chapter of Mission Residency|mm-legacy-residency-transition' || true
```

2. Change `_SYSTEM/cloudflare/missionresidency-wrangler.toml`:

```toml
REDIRECT_STATUS = "301"
```

3. Redeploy:

```bash
cd _SYSTEM/cloudflare
npx wrangler deploy --config missionresidency-wrangler.toml
```

4. Re-run HTTPS validation for the four ticket URLs.
