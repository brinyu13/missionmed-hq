# B1-502M Production Architecture Map

Recorded: 2026-07-27

## Canonical request flow

1. The founder signs into the existing MissionMed WordPress/Matrix session.
2. The protected Matrix page remains owned by the active
   `missionmed-hub` plugin.
3. The isolated `missionmed-storyforge-sso` adapter intercepts only the
   eligible founder's StoryForge control or `#storyforge` deep link.
4. The browser opens the same-origin URL
   `https://missionmedinstitute.com/storyforge/`.
5. After feature-off deployment, an isolated Kinsta must-use plugin owns only
   the exact `/storyforge` and `/storyforge/*` route patterns.
6. The gateway loads one guarded generated `release.php` from a commit-named
   immutable directory below the MU-plugin autoload root, verifies the bundle
   hash, size, release identifier, and complete 14-file manifest, and serves
   non-index assets only through exact extensionless SHA-derived aliases.
7. The gateway proxies `/storyforge/api/*` and `/storyforge/healthz` to an
   isolated Railway origin.
8. The browser uses the existing WordPress session only against the
   same-origin WordPress bootstrap and token endpoints.
9. The WordPress seam issues a short-lived signed token only for the exact
   allowlisted founder account.
10. The MU gateway strips WordPress cookies and forwards only the permitted
   API headers to Railway.
11. The Railway Node service validates the signed token and executes all
    database work through the least-privilege `storyforge_app` login and
    transaction-local `authenticated` policy role.

## Ownership

| Boundary | Owner | B1-502M target |
|---|---|---|
| Matrix and legacy StoryForge | Protected Kinsta `missionmed-hub` | Inspected and hash-verified; **DO NOT TOUCH** |
| WordPress SSO/entitlement seam | Isolated Kinsta plugin | `wp-content/plugins/missionmed-storyforge-sso/` |
| Same-origin static/API gateway | Isolated Kinsta MU plugin | `storyforge-v5/infra/wordpress/missionmed-storyforge-route.php` deployed as `public/wp-content/mu-plugins/missionmed-storyforge-route.php` |
| Runtime asset bundle | Execution-private Kinsta MU subtree | `public/wp-content/mu-plugins/missionmed-storyforge-runtime/releases/<exact-product-commit>/release.php` through atomic runtime `current` pointer |
| Immutable evidence release | Private Kinsta sibling tree | `private/b1-502m/runtime/storyforge-v5/releases/94504372c710372ea121a0b62ad7094e893e026b/`; retained byte-identical, never used by PHP-FPM at runtime |
| Application origin | Railway | project `875e7c17-d06f-4301-a4bb-e61016f153cf`, service `dab015bf-15ef-4698-9f16-cbf8cf23de7a` |
| PostgreSQL | Railway | service `a4a66362-c3ba-475a-ae21-2aa46624bafe` |
| Release authority | MissionMed OS DR-011 as amended by DR-012 and DR-013 | Founder-only, feature-off first |

The Railway upload root is exactly `storyforge-v5/`, using
`storyforge-v5/railway.json`. A repository-root Railway upload is prohibited
because the repository root contains the unrelated MissionMed HQ runtime.

## Isolation properties

- No protected `missionmed-hub` file is changed.
- The legacy Matrix route
  `https://missionmedinstitute.com/member-dashboard/#storyforge` and its V2
  assets remain the fallback until founder acceptance.
- No raw JavaScript, CSS, font, license, or HTML copy has an alternate public
  `wp-content` or other web URL.
- The nested PHP bundle refuses direct execution unless WordPress has already
  defined `ABSPATH`; it is not a root MU-plugin entrypoint.
- The sibling private 14-file tree is immutable evidence only and is not a
  runtime dependency.
- The Railway origin is API-only outside local development.
- The StoryForge database is isolated from all existing MissionMed Supabase
  projects and the existing HQ Railway service.
- The initial database contains one founder student profile only, zero mentor
  assignments, and no demo or fixture data.
- Mentor access remains disabled.
- AI and audio capabilities remain disabled/unconfigured for the founder
  launch.
- The two initially configured Cloudflare Worker routes are not traffic
  authoritative because the apex reaches Kinsta through a DNS-only record.
  They remain decommission-pending until the Kinsta gateway passes live
  feature-off checks, after which the exact bindings and isolated Worker are
  removed to prevent future split-brain ownership.

## Exact public surface

- `GET /storyforge` — permanent canonical redirect to `/storyforge/`;
- `GET /storyforge/` and client deep links — V5 application shell;
- `GET /storyforge/_asset/<sha12>` — exact approved non-index asset alias;
- raw extension-bearing `/storyforge/assets/*`, unknown or malformed aliases,
  the index hash as an asset alias, and direct bundle URLs — unavailable;
- `/storyforge/api/*` — private, noncacheable API proxy;
- `GET /storyforge/healthz` — redacted service health;
- all other paths — existing WordPress/Matrix ownership.

## Current production state

Commit `94504372c710372ea121a0b62ad7094e893e026b` was deployed for the first
feature-off Kinsta gateway attempt. Production established two provider
constraints:

1. Kinsta PHP-FPM could not read the sibling private release and the gateway
   failed closed with `release_unavailable`, even with required traversal and
   read permissions present.
2. Kinsta Nginx intercepted extension-bearing `/storyforge/assets/*` requests
   before WordPress and returned 404.

The feature flag stayed false and the allowlist stayed empty. The MU route file
and active pointer were physically removed, Kinsta caches were purged, and
independent follow-up probes again returned the recorded 404 for StoryForge
routes. Root returned 200, the anonymous member dashboard retained its 302 login
redirect, and WordPress REST returned 200. The architecture above is therefore
the DR-013 repair candidate, not a claim that StoryForge is currently live.
