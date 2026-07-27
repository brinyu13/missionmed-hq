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

## Route contract

The Worker owns exactly:

- `missionmedinstitute.com/storyforge`;
- `missionmedinstitute.com/storyforge/*`.

The slashless route returns a `308` to `/storyforge/`. Repeated slashes are
normalized before routing. Deep links beneath `/storyforge/` receive the
application shell. `/storyforge/api`, `/storyforge/api/*`, and
`/storyforge/healthz` are proxied to the isolated Railway origin.

No DNS, catch-all route, shared Worker, Pages project, or unrelated origin is
changed.

## Privacy and cache contract

- HTML and redirects: `no-store`;
- API and API errors: `no-store, private` plus `Pragma: no-cache`;
- non-success static responses: noncacheable;
- fingerprinted static assets: one-year immutable caching;
- other successful static resources: revalidate;
- WordPress cookies and unrelated request headers are not forwarded to
  Railway;
- origin redirects are not automatically followed;
- security headers include CSP, referrer policy, nosniff, same-origin framing,
  and a bounded permissions policy.

The browser uses a ten-second bounded request path so an origin or edge fault
cannot leave an indefinite opening state.

## Deployment boundary

The Worker version is uploaded before route activation. Routes are attached
only after the Railway API and feature-off WordPress seam pass their health
checks. The exact deployed Worker version, deployment revision, route receipt,
and post-deploy hashes are recorded in `09_DEPLOYMENT_LOG.md`.

Rollback removes only this Worker and its two StoryForge routes, returning the
recorded 404 before-state.
