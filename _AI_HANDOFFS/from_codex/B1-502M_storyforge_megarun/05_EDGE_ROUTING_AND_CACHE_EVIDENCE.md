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

## First Kinsta gateway attempt

Pushed gateway commit `94504372c710372ea121a0b62ad7094e893e026b`
was installed feature-off with the sibling private 14-file release. The attempt
failed closed and established two production routing constraints:

1. Kinsta PHP-FPM could not read the sibling private release and returned
   `release_unavailable`, even when required traversal and file-read
   permissions were present.
2. Kinsta Nginx intercepted extension-bearing `/storyforge/assets/*` requests
   before WordPress and returned 404.

No permission bypass, Nginx change, public raw asset copy, DNS mutation, or broad
WordPress router was attempted. The flag remained false and the allowlist
remained empty. The active release pointer and MU route file were physically
removed, Kinsta caches were purged, and independently repeated StoryForge probes
returned the prior 404. Root remained 200, the anonymous member dashboard kept
its 302 login handoff, and WordPress REST remained 200.

## DR-013 route candidate

After feature-off deployment, the isolated Kinsta MU gateway owns exactly
`/storyforge` and `/storyforge/*`. It loads only one guarded generated bundle
from
`wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/release.php`
through an atomic runtime `current` pointer. The sibling private release remains
immutable evidence only.

The application shell and safe extensionless SPA deep links resolve to bundled
`index.html`. Non-index browser assets resolve only through unique exact
`/storyforge/_asset/<sha12>` aliases. Raw extension-bearing logical paths,
unknown or malformed aliases, the index hash as an asset alias, root MU release
files, and direct nested-bundle execution fail closed. API ownership remains
limited to `/storyforge/api`, `/storyforge/api/*`, and `/storyforge/healthz`
against the pinned Railway HTTPS origin.

All other paths fall through untouched to WordPress/Matrix. No DNS, shared
Worker, protected `missionmed-hub` file, public raw-asset directory, or unrelated
origin changes.

## Privacy and cache contract

- HTML and redirects: `no-store`;
- API and API errors: `no-store, private` plus `Pragma: no-cache`;
- non-success static responses: noncacheable;
- approved SHA-derived non-index aliases: one-year immutable caching only when
  their generated cache class is `immutable`;
- other successful static resources: revalidate;
- WordPress cookies and unrelated request headers are not forwarded to
  Railway;
- origin redirects are not automatically followed;
- security headers include CSP with `object-src 'none'`, referrer policy,
  nosniff, same-origin framing, `noindex`, and a bounded permissions policy.

The browser uses a ten-second bounded request path so an origin or edge fault
cannot leave an indefinite opening state.

## Deployment boundary

The exact committed 14-file release deterministically generates one guarded
`release.php`. The bundle is staged into a new commit-named immutable directory
below the MU-plugin root. Its complete manifest, bytes, hash, size, direct
execution guard, owner, and modes are verified before an atomic runtime
`current` pointer switch. No release PHP file, duplicate, loader, backup, or
temporary PHP file may exist in the root MU-plugin autoload directory. The MU
route file is staged outside that root and moved into place only after PHP lint,
local gateway tests, restore-point checks, feature-off configuration, and fresh
exact-tree Sentinel approval pass.

Rollback sets the feature off, atomically restores or disables only the runtime
pointer, moves only the StoryForge MU route file out of the auto-loaded
directory when route absence is required, leaves the sibling evidence release
unchanged, purges Kinsta site/CDN cache, and verifies the recorded WordPress 404
before-state.
