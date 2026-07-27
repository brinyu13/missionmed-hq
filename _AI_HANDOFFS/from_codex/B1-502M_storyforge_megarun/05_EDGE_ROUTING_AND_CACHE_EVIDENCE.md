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

## DR-013 production cache evidence

Exact pushed commit
`62ed421309c236d4b6ac05faca606108c0143592` was installed feature-off at
`2026-07-27T21:23:59Z`. The route, release, topology, aliases, direct-execution
guards, protected hashes, and feature-off denials passed. Repeated requests
then proved that Kinsta/Cloudflare storage returned StoryForge HTML, health,
configuration, and all 13 approved aliases as cache hits and replaced the
manifest policy with `public, max-age=0, s-maxage=86400`. The route and pointer
were physically removed at `2026-07-27T21:37:13Z`; scoped Kinsta site-cache and
CDN-cache purges each returned HTTP 200; `/storyforge`, `/storyforge/`, and
`/storyforge/healthz` returned the prior WordPress 404 after propagation.

## Exact cache-repair retry

Exact pushed repair commit
`4bd956b6ea222d20428c41415236a73b93576447` was installed feature-off at
`2026-07-27T21:44:33Z`. Its route SHA-256 was
`23ca6d28268a780c46c27083a726dab18c3e6125a46a6fda600fd9c03eee2d88`
at 30,528 bytes. Its generated bundle remained exactly
`845289a4c646b0ea496fa864186a0b9f534425ff8aad8b40e0e3993ebf05a3f1`
at 409,055 bytes.

The first anonymous pass returned the exact application policies with
`CF-Cache-Status: DYNAMIC` and `X-Kinsta-Cache: MISS`. The second and third
passes kept Cloudflare at `DYNAMIC`, proving the application repair prevented
edge storage, but changed to `X-Kinsta-Cache: HIT` and
`public, max-age=0, s-maxage=86400` for the shell, deep link, health,
configuration, application alias, and license alias. This is a managed
server/full-page cache boundary, not a remaining source-code defect.

The route and pointer were physically removed at `2026-07-27T21:45:23Z`.
Scoped site-cache and CDN-cache purges each returned HTTP 200. After
propagation, `/storyforge`, `/storyforge/`, and `/storyforge/healthz` again
returned the prior 404. The feature flag remained false; the allowlist and role
overrides remained empty; no founder or other account was enabled.

Kinsta's current documentation identifies its full-page server cache as a
managed layer and directs customers to Support for a specific-page cache
exclusion. Its edge-cache documentation likewise directs specific exclusion
requests to Support:

- <https://kinsta.com/docs/wordpress-hosting/caching/site-caching/>
- <https://kinsta.com/docs/wordpress-hosting/caching/edge-caching/>

Required provider action: exclude URL paths beginning exactly with
`/storyforge` from Kinsta server/full-page caching and the corresponding
edge-cache layer, without disabling global caching or changing unrelated
routes. Founder enablement remains `NO_GO` until this exclusion is applied and
the repeated cache gate passes.
