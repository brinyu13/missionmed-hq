# B1-502M Edge Routing and Cache Evidence

Recorded: 2026-07-27

## Before-state

Cloudflare authentication succeeded for the MissionMed account. Before
deployment:

- Worker `missionmed-storyforge-v5` did not exist;
- no Worker version or deployment existed;
- the exact and wildcard StoryForge routes did not exist;
- the complete eight-route inventory contained no exact, prefix, apex
  catch-all, wildcard-host catch-all, or no-script precedence overlap;
- `/storyforge`, `/storyforge/`, and `/storyforge/healthz` returned 404.

Restore/prestate receipt:
`B1-502M-RP-CF-ABSENT-20260727T174734Z`

The active OAuth credential could not list zone Cache Rules or legacy Page
Rules. This configuration-level fact remains explicitly unknown. Effective
before-state behavior was nevertheless observed twice: `CF-Cache-Status:
DYNAMIC`, private/no-store headers, no `Age`, and HTTP 404. Post-deploy repeated
response checks are required to prove the effective policy and trigger
immediate rollback on any private/HTML cache hit.

## Cloudflare route diagnosis

The isolated Worker and both intended route records were created:

- `missionmedinstitute.com/storyforge`;
- `missionmedinstitute.com/storyforge/*`.

Repeated live probes nevertheless continued to return the Kinsta WordPress
404 with no Worker marker. The same behavior occurred on pre-existing Worker
route patterns. Current DNS and retained authenticated inventory establish
that the apex reaches Kinsta through a DNS-only record, so zone Worker routes
do not enter the request path.

Changing the apex to proxied would activate eight unrelated legacy Worker
routes and subject the whole site to unreadable account-level rules. B1-502M
therefore rejects that broad DNS mutation. The two inert StoryForge bindings
and isolated Worker are decommission-pending after the replacement gateway is
verified.

## Active route contract

An isolated Kinsta MU gateway owns exactly `/storyforge` and
`/storyforge/*`. It serves only the 14 manifest-approved bytes from a
versioned private release, uses the application shell for safe extensionless
deep links, and proxies only `/storyforge/api`, `/storyforge/api/*`, and
`/storyforge/healthz` to the pinned Railway HTTPS origin.

All other paths fall through untouched to WordPress/Matrix. No DNS, shared
Worker, protected `missionmed-hub` file, public `storyforge` directory, or
unrelated origin changes.

## Privacy and cache contract

- HTML and redirects: `no-store`;
- API and API errors: `no-store, private` plus `Pragma: no-cache`;
- non-success static responses: noncacheable;
- fingerprinted static assets: one-year immutable caching;
- other successful static resources: revalidate;
- WordPress cookies and unrelated request headers are not forwarded to
  Railway;
- origin redirects are not automatically followed;
- security headers include CSP with `object-src 'none'`, referrer policy,
  nosniff, same-origin framing, `noindex`, and a bounded permissions policy.

The browser uses a ten-second bounded request path so an origin or edge fault
cannot leave an indefinite opening state.

## Deployment boundary

The exact 14-file release is uploaded into a new private version directory.
Its hash manifest is verified before an atomic `current` pointer switch. The
MU file is staged outside the auto-loaded directory and moved into place only
after PHP lint, local gateway tests, restore-point checks, and feature-off
configuration pass.

Rollback sets the feature off, moves only the StoryForge MU file out of the
auto-loaded directory, restores the prior release pointer if needed, purges
Kinsta site/CDN cache, and verifies the recorded WordPress 404 before-state.
